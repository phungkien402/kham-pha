-- Migration 0005: Thống kê lựa chọn cộng đồng cho game Hiểu Việt Nam
CREATE TABLE IF NOT EXISTS hvn_dem (
  cau_id TEXT NOT NULL,
  lua_chon INTEGER NOT NULL,
  so_luot INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cau_id, lua_chon)
);

CREATE TABLE IF NOT EXISTS hvn_chong_lap (
  khoa TEXT PRIMARY KEY,
  ngay TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hvn_chong_lap_ngay ON hvn_chong_lap(ngay);
