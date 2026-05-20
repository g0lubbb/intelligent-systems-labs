-- Лабораторная работа №2 — Справочники
-- СУБД: SQLite 3
-- Главный справочник: mountain_peaks
-- Зависимый справочник: mountaineering_expeditions (peak_id → mountain_peaks.id)

PRAGMA foreign_keys = ON;

-- Справочник №1 (главный): Горные вершины
CREATE TABLE IF NOT EXISTS mountain_peaks (
    id                  INTEGER       PRIMARY KEY AUTOINCREMENT,
    name                TEXT          NOT NULL,                  -- однострочный текст
    mountain_range      TEXT          NOT NULL,                  -- однострочный текст
    country             TEXT          NOT NULL,                  -- однострочный текст
    height_m            INTEGER       NOT NULL,                  -- целое число
    difficulty_rating   NUMERIC(3,1)  NOT NULL                   -- число с фикс. запятой
                        CHECK (difficulty_rating BETWEEN 1.0 AND 10.0),
    first_ascent_date   TEXT          NOT NULL,                  -- дата в ISO формате YYYY-MM-DD
    description         TEXT,                                    -- многострочный текст
    is_deleted          INTEGER       NOT NULL DEFAULT 0,        -- soft delete (история изменений)
    created_at          TEXT          NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT          NOT NULL DEFAULT (datetime('now'))
);

-- Справочник №2 (зависимый): Альпинистские экспедиции
-- peak_id ссылается на mountain_peaks.id (внешний ключ).
-- При "удалении" вершины в главном справочнике (soft delete) физически
-- запись остаётся, поэтому ссылки из экспедиций не ломаются.
CREATE TABLE IF NOT EXISTS mountaineering_expeditions (
    id              INTEGER        PRIMARY KEY AUTOINCREMENT,
    name            TEXT           NOT NULL,                     -- однострочный текст
    peak_id         INTEGER        NOT NULL,                     -- FK → mountain_peaks.id
    start_date      TEXT           NOT NULL,                     -- дата
    duration_days   INTEGER        NOT NULL CHECK (duration_days > 0),
    team_size       INTEGER        NOT NULL CHECK (team_size > 0),
    budget_usd      NUMERIC(12,2)  NOT NULL CHECK (budget_usd >= 0),
    description     TEXT,                                        -- многострочный текст
    is_deleted      INTEGER        NOT NULL DEFAULT 0,
    created_at      TEXT           NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT           NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (peak_id) REFERENCES mountain_peaks(id)
);

CREATE INDEX IF NOT EXISTS idx_expeditions_peak ON mountaineering_expeditions(peak_id);
