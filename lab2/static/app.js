"use strict";

const state = {
  dictionaries: {},      // code -> meta
  currentCode: null,
  currentData: null,     // {code, title, fields, rows}
  sortCol: null,
  sortDir: 1,            // 1 asc, -1 desc
};

const $ = (id) => document.getElementById(id);

const dictSelect   = $("dict-select");
const tableEl      = $("data-table");
const emptyState   = $("empty-state");
const addBtn       = $("add-btn");

const editDialog   = $("edit-dialog");
const editForm     = $("edit-form");
const dialogTitle  = $("dialog-title");
const formFields   = $("form-fields");
const cancelBtn    = $("cancel-btn");

const viewDialog   = $("view-dialog");
const viewTitle    = $("view-title");
const viewContent  = $("view-content");
const viewCloseBtn = $("view-close-btn");

let editingId = null;

// ---------- helpers ----------

function escapeHtml(s) {
  return String(s ?? "").replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function isoToDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
}

function formatNumber(value, type) {
  if (value === null || value === undefined || value === "") return "";
  if (type === "decimal") {
    return Number(value).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return Number(value).toLocaleString("ru-RU");
}

// ---------- API ----------

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const j = await res.json();
      if (j.detail) msg = j.detail;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ---------- init ----------

async function init() {
  try {
    const dicts = await api("/api/dictionaries");
    state.dictionaries = Object.fromEntries(dicts.map((d) => [d.code, d]));
    dictSelect.innerHTML = dicts
      .map((d) => `<option value="${d.code}">${escapeHtml(d.title)}</option>`)
      .join("");
    dictSelect.addEventListener("change", () => loadDictionary(dictSelect.value));
    addBtn.addEventListener("click", () => openEditDialog(null));
    cancelBtn.addEventListener("click", () => editDialog.close());
    editForm.addEventListener("submit", onSubmit);
    viewCloseBtn.addEventListener("click", () => viewDialog.close());
    if (dicts.length) await loadDictionary(dicts[0].code);
  } catch (e) {
    alert("Не удалось загрузить справочники: " + e.message);
  }
}

async function loadDictionary(code) {
  state.currentCode = code;
  state.sortCol = null;
  state.sortDir = 1;
  state.currentData = await api(`/api/dictionaries/${code}`);
  renderTable();
}

// ---------- table rendering & sorting ----------

function sortRows(rows) {
  if (!state.sortCol) return rows.slice();
  const field = state.currentData.fields.find((f) => f.code === state.sortCol);
  if (!field) return rows.slice();
  const dir = state.sortDir;
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    let va, vb;
    if (field.type === "ref") {
      va = (a.peak_name ?? "").toString();
      vb = (b.peak_name ?? "").toString();
      return va.localeCompare(vb, "ru") * dir;
    }
    if (field.type === "integer" || field.type === "decimal") {
      va = a[field.code]; vb = b[field.code];
      const na = va === null || va === undefined || va === "" ? Number.NEGATIVE_INFINITY : Number(va);
      const nb = vb === null || vb === undefined || vb === "" ? Number.NEGATIVE_INFINITY : Number(vb);
      return (na - nb) * dir;
    }
    if (field.type === "date") {
      // ISO YYYY-MM-DD сортируется как строка корректно
      va = (a[field.code] ?? "").toString();
      vb = (b[field.code] ?? "").toString();
      return va.localeCompare(vb) * dir;
    }
    va = (a[field.code] ?? "").toString();
    vb = (b[field.code] ?? "").toString();
    return va.localeCompare(vb, "ru") * dir;
  });
  return sorted;
}

function cellClass(field) {
  if (field.type === "integer" || field.type === "decimal") return "num";
  if (field.type === "date") return "date";
  return "";
}

function renderCell(row, field) {
  if (field.type === "date") return escapeHtml(isoToDisplay(row[field.code]));
  if (field.type === "ref") {
    const label = row.peak_name ?? "";
    const extra = row.peak_country ? ` (${row.peak_country})` : "";
    return escapeHtml(label + extra);
  }
  if (field.type === "integer" || field.type === "decimal") {
    return escapeHtml(formatNumber(row[field.code], field.type));
  }
  // Text. Для длинного текста — сокращаем + tooltip.
  const raw = row[field.code] ?? "";
  if (field.control === "text_long") {
    const short = raw.length > 60 ? raw.slice(0, 60) + "…" : raw;
    return `<span title="${escapeHtml(raw)}">${escapeHtml(short.replace(/\n/g, " ⏎ "))}</span>`;
  }
  return escapeHtml(raw);
}

function renderTable() {
  const fields = state.currentData.fields;
  const rows = sortRows(state.currentData.rows);

  const thead = tableEl.querySelector("thead");
  const tbody = tableEl.querySelector("tbody");

  emptyState.hidden = rows.length > 0;
  tableEl.hidden = rows.length === 0;

  thead.innerHTML =
    "<tr>" +
    fields
      .map((f) => {
        const arrow = state.sortCol === f.code ? (state.sortDir > 0 ? " ▲" : " ▼") : "";
        return `<th data-col="${f.code}">${escapeHtml(f.title)}${arrow}</th>`;
      })
      .join("") +
    `<th class="actions">Действия</th></tr>`;

  thead.querySelectorAll("th[data-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (state.sortCol === col) state.sortDir = -state.sortDir;
      else {
        state.sortCol = col;
        state.sortDir = 1;
      }
      renderTable();
    });
  });

  tbody.innerHTML = rows
    .map(
      (r) =>
        "<tr>" +
        fields
          .map((f) => `<td class="${cellClass(f)}">${renderCell(r, f)}</td>`)
          .join("") +
        `<td class="actions">
          <button class="view-row" data-id="${r.id}">Просмотр</button>
          <button class="edit-row" data-id="${r.id}">Изменить</button>
          <button class="delete-row danger" data-id="${r.id}">Удалить</button>
        </td></tr>`
    )
    .join("");

  tbody.querySelectorAll(".view-row").forEach((b) =>
    b.addEventListener("click", () => openViewDialog(+b.dataset.id))
  );
  tbody.querySelectorAll(".edit-row").forEach((b) =>
    b.addEventListener("click", () => openEditDialog(+b.dataset.id))
  );
  tbody.querySelectorAll(".delete-row").forEach((b) =>
    b.addEventListener("click", () => onDelete(+b.dataset.id))
  );
}

// ---------- view dialog ----------

function openViewDialog(id) {
  const row = state.currentData.rows.find((r) => r.id === id);
  if (!row) return;
  viewTitle.textContent = `Просмотр: ${row.name ?? "запись #" + id}`;
  viewContent.innerHTML = state.currentData.fields
    .map((f) => {
      let value;
      if (f.type === "date") value = isoToDisplay(row[f.code]);
      else if (f.type === "ref") {
        value =
          (row.peak_name ?? "") +
          (row.peak_country ? ` (${row.peak_country})` : "");
      } else if (f.type === "integer" || f.type === "decimal") {
        value = formatNumber(row[f.code], f.type);
      } else value = row[f.code] ?? "";
      return `<dt>${escapeHtml(f.title)}</dt><dd>${escapeHtml(value)}</dd>`;
    })
    .join("");
  viewDialog.showModal();
}

// ---------- edit dialog ----------

async function openEditDialog(id) {
  editingId = id;
  const fields = state.currentData.fields;
  const row = id ? state.currentData.rows.find((r) => r.id === id) : null;
  dialogTitle.textContent = id ? "Изменение записи" : "Новая запись";

  // Подгружаем опции для всех ref-полей
  const refOptions = {};
  for (const f of fields) {
    if (f.type === "ref") {
      refOptions[f.code] = await api(`/api/dictionaries/${f.ref}/options`);
    }
  }

  formFields.innerHTML = fields.map((f) => renderField(f, row, refOptions[f.code])).join("");
  editDialog.showModal();
}

function renderField(f, row, options) {
  const id = `field-${f.code}`;
  const val = row ? row[f.code] : "";
  const required = f.required ? "required" : "";
  const labelHtml = `<label for="${id}">${escapeHtml(f.title)}${
    f.required ? " *" : ""
  }</label>`;

  let inputHtml = "";

  if (f.control === "text_long") {
    inputHtml = `<textarea id="${id}" name="${f.code}" rows="4" ${required}>${escapeHtml(val ?? "")}</textarea>`;
  } else if (f.control === "number") {
    const step = f.step ?? "1";
    const min = f.min !== undefined ? `min="${f.min}"` : "";
    const max = f.max !== undefined ? `max="${f.max}"` : "";
    const v = val === null || val === undefined ? "" : val;
    inputHtml = `<input type="number" id="${id}" name="${f.code}" step="${step}" ${min} ${max} value="${escapeHtml(v)}" ${required}>`;
  } else if (f.control === "date") {
    const v = val ?? "";
    inputHtml = `<input type="date" id="${id}" name="${f.code}" value="${escapeHtml(v)}" ${required}>`;
  } else if (f.control === "dropdown") {
    // ВАЖНО: в качестве value хранится id, а не строка/название.
    // Два значения с одинаковым label, но разными id, корректно различаются.
    const opts = (options || [])
      .map((o) => {
        const label = o.extra ? `${o.label} (${o.extra})` : o.label;
        const selected = String(val) === String(o.id) ? "selected" : "";
        return `<option value="${o.id}" ${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
    inputHtml = `<select id="${id}" name="${f.code}" ${required}>
      <option value="">— выберите —</option>
      ${opts}
    </select>`;
  } else {
    // text_short
    inputHtml = `<input type="text" id="${id}" name="${f.code}" value="${escapeHtml(val ?? "")}" ${required}>`;
  }

  return `<div class="field">${labelHtml}${inputHtml}</div>`;
}

async function onSubmit(ev) {
  ev.preventDefault();
  const fields = state.currentData.fields;
  const data = {};
  for (const f of fields) {
    const el = document.getElementById(`field-${f.code}`);
    let v = el.value;
    if (v === "") {
      v = null;
    } else if (f.control === "number") {
      v = Number(v);
      if (Number.isNaN(v)) {
        alert(`Поле "${f.title}" должно быть числом`);
        return;
      }
    } else if (f.control === "dropdown") {
      v = Number(v);
    }
    data[f.code] = v;
  }
  try {
    if (editingId) {
      await api(`/api/dictionaries/${state.currentCode}/records/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ data }),
      });
    } else {
      await api(`/api/dictionaries/${state.currentCode}/records`, {
        method: "POST",
        body: JSON.stringify({ data }),
      });
    }
    editDialog.close();
    await loadDictionary(state.currentCode);
  } catch (e) {
    alert("Не удалось сохранить: " + e.message);
  }
}

async function onDelete(id) {
  if (!confirm("Удалить запись?")) return;
  try {
    await api(`/api/dictionaries/${state.currentCode}/records/${id}`, {
      method: "DELETE",
    });
    await loadDictionary(state.currentCode);
  } catch (e) {
    alert("Не удалось удалить: " + e.message);
  }
}

init();
