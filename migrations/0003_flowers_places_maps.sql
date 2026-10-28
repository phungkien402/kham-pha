-- Bảng lưu loài hoa bổ sung (do khách gửi chờ duyệt hoặc admin thêm trực tiếp)
CREATE TABLE IF NOT EXISTS flowers_extra (
  slug TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT NOT NULL CHECK (source IN ('admin', 'public')),
  data TEXT NOT NULL,
  submitter TEXT NULL,
  ip_hash TEXT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_flowers_extra_status_created ON flowers_extra(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flowers_extra_ip_created ON flowers_extra(ip_hash, created_at DESC);

-- Bảng lưu địa điểm ngắm hoa bổ sung (do khách gửi chờ duyệt hoặc admin thêm trực tiếp)
CREATE TABLE IF NOT EXISTS places_extra (
  slug TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  source TEXT NOT NULL CHECK (source IN ('admin', 'public')),
  data TEXT NOT NULL,
  submitter TEXT NULL,
  ip_hash TEXT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_places_extra_status_created ON places_extra(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_extra_ip_created ON places_extra(ip_hash, created_at DESC);

-- Bảng lưu trạng thái kích hoạt build (debounce 2 phút)
CREATE TABLE IF NOT EXISTS build_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Thêm cột maps_url cho bảng photos
ALTER TABLE photos ADD COLUMN maps_url TEXT NULL;
