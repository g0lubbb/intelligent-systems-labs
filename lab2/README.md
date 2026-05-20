# Лабораторная работа №2 — приложение

**Голуб Дмитрий Васильевич · 2026 · 3 курс · 2 группа**

Описание справочников и схемы — в [корневом README](../README.md).

## Стек

* СУБД: **SQLite 3** (файл `lab2.db` создаётся автоматически)
* Backend: **Python 3.10+** + **FastAPI** + `uvicorn`
* Frontend: HTML / CSS / vanilla JavaScript (без сборщиков и npm)

## Запуск

### Windows

```bat
run.bat
```

### Linux / macOS

```bash
chmod +x run.sh
./run.sh
```

Скрипт создаст `.venv`, поставит зависимости и запустит сервер.
Открыть в браузере: <http://127.0.0.1:8000>

### Ручной запуск (если скрипты по каким-то причинам не подходят)

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows
source .venv/bin/activate         # Linux/macOS
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

## Структура

```
lab2/
├── schema.sql          — DDL
├── seed.sql            — пример данных (3+ записи в каждом справочнике)
├── db.py               — инициализация БД и подключение
├── server.py           — FastAPI: CRUD-эндпоинты + раздача статики
├── requirements.txt
├── run.bat / run.sh    — запуск
└── static/
    ├── index.html      — единственная страница
    ├── app.js          — UI (таблица, сортировка, формы)
    └── style.css
```

## Сброс базы

Просто удалите файл `lab2.db` — при следующем запуске он будет
создан заново из `schema.sql` + `seed.sql`.
