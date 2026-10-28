-- Migration 0004: Tự động thu thập tin mùa hoa (bước 33)
-- Bảng lưu đề xuất từ bot thu thập
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('new_flower', 'new_place', 'season_update', 'news')),
  target_slug TEXT NULL,
  payload TEXT NOT NULL,
  sources TEXT NOT NULL,
  summary TEXT NULL,
  confidence REAL NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT NULL,
  dedupe_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status_created ON suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_kind_status ON suggestions(kind, status, created_at DESC);

-- Bảng lưu ghi đè mùa nở cho loài hoa gốc trong JSON
CREATE TABLE IF NOT EXISTS season_overrides (
  slug TEXT NOT NULL,
  year INT NOT NULL,
  start TEXT NULL,
  peak TEXT NULL,
  end TEXT NULL,
  note TEXT NULL,
  sources TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, year)
);

CREATE INDEX IF NOT EXISTS idx_season_overrides_slug ON season_overrides(slug);

-- Bảng đếm giới hạn request cho bot (/api/bot/*: 10 request/giờ)
CREATE TABLE IF NOT EXISTS bot_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_requests_created_at ON bot_requests(created_at DESC);
