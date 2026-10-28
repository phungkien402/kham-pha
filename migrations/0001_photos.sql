-- Bảng lưu thông tin ảnh hoa (admin đăng và người ngoài gửi)
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  flower TEXT NOT NULL,
  place TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  author TEXT NOT NULL,
  author_link TEXT NULL,
  license TEXT NOT NULL,
  caption TEXT NULL,
  taken_on TEXT NULL,
  width INT,
  height INT,
  source TEXT NOT NULL CHECK (source IN ('admin', 'public')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT NULL,
  ip_hash TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_flower_status ON photos(flower, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_status_created ON photos(status, created_at DESC);
