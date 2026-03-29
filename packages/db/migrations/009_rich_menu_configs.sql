-- Migration 009: rich_menu_configs
-- リッチメニューのエイリアス・セグメント設定をローカルDBで管理するテーブル

CREATE TABLE IF NOT EXISTS rich_menu_configs (
  id              TEXT PRIMARY KEY,
  line_account_id TEXT REFERENCES line_accounts (id) ON DELETE CASCADE,
  rich_menu_id    TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT 'リッチメニュー',
  description     TEXT,
  target_segment  TEXT,
  is_default      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_rich_menu_configs_account ON rich_menu_configs (line_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rich_menu_configs_rich_menu_id ON rich_menu_configs (rich_menu_id);
