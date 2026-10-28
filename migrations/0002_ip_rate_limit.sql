-- Index phục vụ đếm số lần gửi ảnh công khai theo IP (ip_hash) trong ngày
CREATE INDEX IF NOT EXISTS idx_photos_ip_created ON photos(ip_hash, created_at DESC);
