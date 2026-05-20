# Лабораторная работа №2 — Справочники

**ФИО:** Голуб Дмитрий Васильевич
**Год:** 2026
**Курс:** 3
**Группа:** 2

---

## Технологический стек

| Слой       | Технология                                  |
|------------|---------------------------------------------|
| СУБД       | **SQLite 3** (файл `lab2/lab2.db`)          |
| Backend    | Python 3.10+ · **FastAPI** · `uvicorn`      |
| Frontend   | HTML5 / CSS / vanilla JavaScript            |
| Установка клиента | не требуется (открывается в браузере) |

## Запуск

```bash
cd lab2
# Windows:
run.bat
# Linux / macOS:
./run.sh
```

Скрипт создаст виртуальное окружение, поставит зависимости и запустит сервер
на `http://127.0.0.1:8000`. Дальше — открыть адрес в браузере.

При первом запуске автоматически создаётся файл базы `lab2/lab2.db` (схема
`lab2/schema.sql`) и заполняется тестовыми данными `lab2/seed.sql`.

---

## Шаг 1. Справочники

### 1. Горные вершины (`mountain_peaks`) — главный справочник

| Поле                | Тип данных     | Описание                              |
|---------------------|----------------|---------------------------------------|
| id                  | INTEGER PK     | Автоинкремент                         |
| name                | TEXT           | Название вершины                      |
| mountain_range      | TEXT           | Горный хребет                         |
| country             | TEXT           | Страна                                |
| height_m            | INTEGER        | Высота над уровнем моря, м            |
| difficulty_rating   | NUMERIC(3,1)   | Сложность восхождения (1.0–10.0)      |
| first_ascent_date   | DATE           | Дата первого восхождения              |
| description         | TEXT           | Описание (многострочное)              |

### 2. Альпинистские экспедиции (`mountaineering_expeditions`) — зависимый

| Поле           | Тип данных     | Описание                                              |
|----------------|----------------|-------------------------------------------------------|
| id             | INTEGER PK     | Автоинкремент                                         |
| name           | TEXT           | Название экспедиции                                   |
| peak_id        | INTEGER **FK** | → `mountain_peaks(id)` — вершина                      |
| start_date     | DATE           | Дата начала экспедиции                                |
| duration_days  | INTEGER        | Длительность, дней                                    |
| team_size      | INTEGER        | Количество участников                                 |
| budget_usd     | NUMERIC(12,2)  | Бюджет экспедиции, USD                                |
| description    | TEXT           | Описание маршрута и целей (многострочное)             |

### Зависимость и сохранность данных

Поле `peak_id` в **экспедициях** — внешний ключ на запись в справочнике
**горных вершин**. Одна вершина может фигурировать в нескольких экспедициях.

Удаление в приложении **не уничтожает данные физически** — у каждой записи
есть флаг `is_deleted` (soft delete). Поэтому:
* при удалении вершины существующие экспедиции продолжают корректно
  ссылаться на неё (требование: «данные из зависимого справочника не должны
  удаляться»);
* история значений справочников сохраняется (факультативное требование +10%).

### Покрытие типов данных

| Тип                   | Поля                                                    |
|-----------------------|---------------------------------------------------------|
| Текст (однострочный)  | `name`, `mountain_range`, `country`                     |
| Текст (многострочный) | `description` (оба справочника)                         |
| Дата                  | `first_ascent_date`, `start_date`                       |
| Целое число           | `height_m`, `duration_days`, `team_size`                |
| Дробное число         | `difficulty_rating` NUMERIC(3,1), `budget_usd` NUMERIC(12,2) |
| Внешний ключ          | `peak_id` → `mountain_peaks(id)`                        |

---

## Шаг 2. Схема базы данных

Полная DDL находится в [lab2/schema.sql](lab2/schema.sql),
пример данных — в [lab2/seed.sql](lab2/seed.sql).

```sql
CREATE TABLE mountain_peaks (
    id                  INTEGER       PRIMARY KEY AUTOINCREMENT,
    name                TEXT          NOT NULL,
    mountain_range      TEXT          NOT NULL,
    country             TEXT          NOT NULL,
    height_m            INTEGER       NOT NULL,
    difficulty_rating   NUMERIC(3,1)  NOT NULL CHECK (difficulty_rating BETWEEN 1.0 AND 10.0),
    first_ascent_date   TEXT          NOT NULL,    -- ISO YYYY-MM-DD
    description         TEXT,
    is_deleted          INTEGER       NOT NULL DEFAULT 0,
    created_at          TEXT          NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT          NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE mountaineering_expeditions (
    id              INTEGER        PRIMARY KEY AUTOINCREMENT,
    name            TEXT           NOT NULL,
    peak_id         INTEGER        NOT NULL,
    start_date      TEXT           NOT NULL,
    duration_days   INTEGER        NOT NULL CHECK (duration_days > 0),
    team_size       INTEGER        NOT NULL CHECK (team_size > 0),
    budget_usd      NUMERIC(12,2)  NOT NULL CHECK (budget_usd >= 0),
    description     TEXT,
    is_deleted      INTEGER        NOT NULL DEFAULT 0,
    created_at      TEXT           NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT           NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (peak_id) REFERENCES mountain_peaks(id)
);
```

Пример данных (фрагмент `seed.sql`, id генерируются автоинкрементом):

| name       | mountain_range  | country         | height_m | difficulty_rating | first_ascent_date |
|------------|-----------------|-----------------|---------:|------------------:|-------------------|
| Эверест    | Гималаи         | Непал/Китай     |     8848 |               9.5 | 1953-05-29        |
| К2         | Каракорум       | Пакистан/Китай  |     8611 |               9.8 | 1954-07-31        |
| Эльбрус    | Кавказ          | Россия          |     5642 |               4.5 | 1829-07-22        |
| Брест      | Беловежская пуща| Беларусь        |      250 |               1.0 | 1900-01-01        |
| Брест      | Альпы           | Франция         |     1200 |               2.5 | 1880-08-15        |

> Записи «Брест/Беларусь» и «Брест/Франция» специально дают одинаковое
> название с разными `id` — для проверки требования к выпадающему списку.

---

## Шаг 3. Приложение

Веб-приложение находится в каталоге [lab2/](lab2/).

### Возможности

* В шапке указаны ФИО / курс / группа / год.
* Выбор справочника из выпадающего списка.
* Таблица справочника с **честной сортировкой по любой колонке**
  (числа — как числа, даты — как даты, выводятся как `ДД.ММ.ГГГГ`).
* Просмотр / добавление / редактирование / удаление записей.
* Использованы все требуемые средства ввода:
  * однострочное текстовое поле,
  * однострочное числовое поле,
  * многострочное текстовое поле,
  * календарь (`<input type="date">`, нельзя ввести 30 февраля),
  * выпадающий список значений другого справочника. **В `value`
    хранится `id` записи**, а не текстовое имя — корректно работает,
    если в списке два «Бреста» с разными id.
* В пользовательском интерфейсе **нет идентификаторов** (id скрыт).
* Soft delete: при удалении запись не уничтожается физически
  (`is_deleted = 1`). Экспедиции, ссылающиеся на удалённую вершину,
  сохраняются и продолжают корректно отображать своё значение.

### REST API

| Метод   | URL                                            | Назначение                           |
|---------|------------------------------------------------|--------------------------------------|
| GET     | `/api/dictionaries`                            | список справочников + их колонки     |
| GET     | `/api/dictionaries/{name}`                     | все строки справочника               |
| GET     | `/api/dictionaries/{name}/options`             | id + label для выпадающего списка    |
| POST    | `/api/dictionaries/{name}/records`             | создать запись                       |
| PUT     | `/api/dictionaries/{name}/records/{id}`        | обновить запись                      |
| DELETE  | `/api/dictionaries/{name}/records/{id}`        | soft delete                          |

---

## Структура репозитория

```
intelligent-systems-labs/
├── README.md             — этот файл
├── .gitignore
└── lab2/
    ├── README.md         — инструкции по запуску
    ├── schema.sql        — DDL
    ├── seed.sql          — пример данных
    ├── db.py             — инициализация БД
    ├── server.py         — FastAPI-приложение
    ├── requirements.txt
    ├── run.bat / run.sh  — запуск
    └── static/
        ├── index.html
        ├── app.js
        └── style.css
```
