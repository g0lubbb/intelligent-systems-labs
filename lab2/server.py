from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import db

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="ЛР2 — Справочники")
db.initialize_database()


DICTIONARIES: dict[str, dict[str, Any]] = {
    "mountain_peaks": {
        "title": "Горные вершины",
        "fields": [
            {"code": "name",              "title": "Название",                 "type": "text",    "control": "text_short", "required": True},
            {"code": "mountain_range",    "title": "Горный хребет",            "type": "text",    "control": "text_short", "required": True},
            {"code": "country",           "title": "Страна",                   "type": "text",    "control": "text_short", "required": True},
            {"code": "height_m",          "title": "Высота, м",                "type": "integer", "control": "number",     "required": True, "step": "1", "min": 0},
            {"code": "difficulty_rating", "title": "Сложность (1.0–10.0)",     "type": "decimal", "control": "number",     "required": True, "step": "0.1", "min": 1.0, "max": 10.0},
            {"code": "first_ascent_date", "title": "Дата первого восхождения", "type": "date",    "control": "date",       "required": True},
            {"code": "description",       "title": "Описание",                 "type": "text",    "control": "text_long",  "required": False},
        ],
    },
    "mountaineering_expeditions": {
        "title": "Альпинистские экспедиции",
        "fields": [
            {"code": "name",          "title": "Название экспедиции", "type": "text",    "control": "text_short", "required": True},
            {"code": "peak_id",       "title": "Вершина",             "type": "ref",     "control": "dropdown",   "required": True,
             "ref": "mountain_peaks", "ref_label_field": "name", "ref_extra_field": "country"},
            {"code": "start_date",    "title": "Дата начала",         "type": "date",    "control": "date",       "required": True},
            {"code": "duration_days", "title": "Длительность, дней",  "type": "integer", "control": "number",     "required": True, "step": "1", "min": 1},
            {"code": "team_size",     "title": "Размер команды",      "type": "integer", "control": "number",     "required": True, "step": "1", "min": 1},
            {"code": "budget_usd",    "title": "Бюджет, USD",         "type": "decimal", "control": "number",     "required": True, "step": "0.01", "min": 0},
            {"code": "description",   "title": "Описание",            "type": "text",    "control": "text_long",  "required": False},
        ],
    },
}

EDITABLE_FIELDS = {
    code: [f["code"] for f in meta["fields"]]
    for code, meta in DICTIONARIES.items()
}


class RecordPayload(BaseModel):
    data: dict[str, Any]


def _ensure_dict(name: str) -> None:
    if name not in DICTIONARIES:
        raise HTTPException(status_code=404, detail="Unknown dictionary")


@app.get("/api/dictionaries")
def list_dictionaries():
    return [
        {"code": code, "title": meta["title"], "fields": meta["fields"]}
        for code, meta in DICTIONARIES.items()
    ]


@app.get("/api/dictionaries/{name}")
def get_dictionary(name: str):
    _ensure_dict(name)
    with db.get_connection() as conn:
        if name == "mountaineering_expeditions":
            sql = """
                SELECT e.*, p.name AS peak_name, p.country AS peak_country
                FROM mountaineering_expeditions e
                LEFT JOIN mountain_peaks p ON p.id = e.peak_id
                WHERE e.is_deleted = 0
                ORDER BY e.id
            """
        else:
            sql = f"SELECT * FROM {name} WHERE is_deleted = 0 ORDER BY id"
        rows = [dict(r) for r in conn.execute(sql).fetchall()]
    return {
        "code": name,
        "title": DICTIONARIES[name]["title"],
        "fields": DICTIONARIES[name]["fields"],
        "rows": rows,
    }


@app.get("/api/dictionaries/{name}/options")
def get_options(name: str):
    """Список значений для выпадающего списка: возвращает id, label, extra."""
    _ensure_dict(name)
    label_field = "name"
    extra_field = None
    if name == "mountain_peaks":
        extra_field = "country"
    with db.get_connection() as conn:
        cols = "id, " + label_field + (f", {extra_field}" if extra_field else "")
        rows = conn.execute(
            f"SELECT {cols} FROM {name} WHERE is_deleted = 0 ORDER BY {label_field}"
        ).fetchall()
        return [
            {
                "id": r["id"],
                "label": r[label_field],
                "extra": r[extra_field] if extra_field else None,
            }
            for r in rows
        ]


def _coerce_payload(name: str, data: dict[str, Any]) -> dict[str, Any]:
    """Только разрешённые поля; пустые строки -> None."""
    result: dict[str, Any] = {}
    for f in DICTIONARIES[name]["fields"]:
        code = f["code"]
        if code not in data:
            if f.get("required"):
                raise HTTPException(status_code=400, detail=f"Поле '{f['title']}' обязательно")
            continue
        val = data[code]
        if val == "":
            val = None
        if val is None and f.get("required"):
            raise HTTPException(status_code=400, detail=f"Поле '{f['title']}' обязательно")
        result[code] = val
    return result


@app.post("/api/dictionaries/{name}/records")
def create_record(name: str, payload: RecordPayload):
    _ensure_dict(name)
    data = _coerce_payload(name, payload.data)
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" for _ in data)
    with db.get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO {name} ({cols}) VALUES ({placeholders})",
            tuple(data.values()),
        )
        conn.commit()
        return {"id": cur.lastrowid}


@app.put("/api/dictionaries/{name}/records/{rec_id}")
def update_record(name: str, rec_id: int, payload: RecordPayload):
    _ensure_dict(name)
    data = _coerce_payload(name, payload.data)
    if not data:
        raise HTTPException(status_code=400, detail="Нет полей для обновления")
    sets = ", ".join(f"{k} = ?" for k in data)
    sets += ", updated_at = datetime('now')"
    with db.get_connection() as conn:
        cur = conn.execute(
            f"UPDATE {name} SET {sets} WHERE id = ? AND is_deleted = 0",
            tuple(data.values()) + (rec_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Запись не найдена")
    return {"ok": True}


@app.delete("/api/dictionaries/{name}/records/{rec_id}")
def delete_record(name: str, rec_id: int):
    """Soft delete: запись физически не удаляется (история сохраняется)."""
    _ensure_dict(name)
    with db.get_connection() as conn:
        cur = conn.execute(
            f"UPDATE {name} SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?",
            (rec_id,),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Запись не найдена")
    return {"ok": True}


@app.get("/")
def root():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
