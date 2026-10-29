# Giải trình tốc độ xử lý của Antigravity (bước SPR2 và các task tương tự)

Dữ liệu thực tế phân tích từ log `transcript.jsonl` của task SPR2 (tổng 1.446s ~ 24,1 phút, 250 bước, 125 lượt gọi tool):

## 1. Thời gian đi vào đâu (Tỉ lệ thực tế từ log)
- **Chờ Model suy nghĩ & sinh token (Thinking & Generation): ~95% (~23 phút)**
  Tổng output tokens sinh ra trong task là **112.195 tokens** (chủ yếu là thinking tokens do cơ chế suy luận sâu).
- **Thực thi lệnh & công cụ trên máy (CPU execution): ~5% (~1 phút)**
  - Chạy `vitest`: ~2s/lần (7 lần = ~14s).
  - Chạy `npm run build`: ~5–7s/lần (3 lần = ~18s).
  - Render sprite (Playwright headless): ~6s.
  - Các thao tác đọc/sửa file cục bộ và git: < 15s.
- **Nguyên nhân vòng lặp kéo dài**:
  Có tới **61 lần `read_file`** (do đọc ngắt quãng từng 50–100 dòng) và **19 lần `edit_file`** rải rác. Mỗi lượt gọi tool là một lần model phải nhận lại context lớn (~240k tokens) và suy nghĩ tiếp, nhân số lượt round-trip lên 125 lần.

## 2. Model và giới hạn tốc độ / quota
- **Model đang dùng**: `gemini-3.8-flash-high` (Gemini 3.8 Flash, reasoning effort: `High`).
- **Quota & Rate limit**: Không bị lỗi 429 hay nghẽn quota.
- **Giới hạn vật lý**: Tốc độ streaming của API Gemini Flash đạt ~80–85 token/giây. Khi bật `High effort`, model sinh từ 2.000 đến 16.000 thinking tokens cho *mỗi bước*. Với 112.000 tokens, thời gian sinh văn bản thuần túy bắt buộc mất: `112.000 / 80 ≈ 1.400 giây (~23 phút)`.

## 3. Đề xuất cụ thể để chạy nhanh gấp 4–5 lần (dưới 5–7 phút/task)
1. **Hạ mức suy nghĩ của CLI (Hiệu quả tức thì và cao nhất)**:
   - Thêm cờ `--effort medium` hoặc `--effort low` (hoặc đổi sang `gemini-3.8-flash-medium`). Giảm ngay 70–80% thinking tokens vô ích, rút ngắn mỗi turn từ 20–30s xuống 3–5s.
2. **Claude viết task chỉ định sẵn file & vùng sửa**:
   - Ghi thẳng: `"Sửa hàm X tại file Y"` kèm gợi ý logic/diff. Tránh để Antigravity phải tự gọi 60 lệnh `read_file` để định vị mã nguồn.
3. **Chia nhỏ nhiệm vụ (1–2 mục tiêu/task)**:
   - Thay vì gom 5 việc (toán fit + CSS mobile + toast timer + render Playwright 58 ảnh), tách thành task nhỏ. Context gọn (< 50k tokens) giúp model sinh nhanh hơn và không bị overthinking.
4. **Chỉ định test mục tiêu**:
   - Ghi rõ: `"Chỉ chạy npx vitest run src/.../stage3d.test.ts"`. Chỉ chạy `npm run build` một lần duy nhất ở bước kết thúc task.
