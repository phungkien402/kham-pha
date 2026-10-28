# Bước 22–23: đăng ảnh hoa (admin) và nhận ảnh người ngoài gửi

Kiên chốt 2026-10-28: **Kiên tự đăng ảnh** qua trang admin, **và** người ngoài được gửi ảnh, Kiên duyệt rồi mới hiện.

## Kiến trúc (giữ web tĩnh, thêm một Worker nhỏ)

- Site vẫn build tĩnh bằng Astro. Thêm Worker `worker/index.ts` ở chung project (`wrangler.jsonc`: `"main"`, binding `ASSETS`, `"run_worker_first": ["/api/*", "/admin*"]`), mọi đường khác vẫn phục vụ thẳng từ `dist/`.
- **R2** bucket `kham-pha-anh`: lưu file ảnh. Khoá: `pending/<id>.webp`, `approved/<id>.webp` (kèm bản nhỏ `approved/<id>-600.webp`). Ảnh phục vụ qua `GET /api/anh/<id>(-600)?.webp` (chỉ ảnh approved, cache dài).
- **D1** database `kham-pha-db`, bảng `photos`:
  `id TEXT PK, flower TEXT, place TEXT NULL, status TEXT ('pending'|'approved'|'rejected'), author TEXT, author_link TEXT NULL, license TEXT, caption TEXT NULL, taken_on TEXT NULL, width INT, height INT, source TEXT ('admin'|'public'), created_at TEXT, reviewed_at TEXT NULL, ip_hash TEXT NULL`. Migration trong `migrations/`.
- Trang loài: ảnh build sẵn trong `flowers.json` giữ nguyên; thêm ảnh approved bằng `fetch('/api/anh?flower=<slug>')` phía client (island nhỏ, lazy), hiện kèm tác giả + giấy phép. Không làm tụt Lighthouse (không chặn LCP).

## Bước 22 — Admin của Kiên

- Bảo vệ `/admin*` và `/api/admin/*` bằng **Cloudflare Access** (Zero Trust, miễn phí, đăng nhập bằng email Kiên). Worker **vẫn tự kiểm tra** header `Cf-Access-Jwt-Assertion` (verify JWT bằng certs của team domain, `aud` lấy từ biến môi trường `ACCESS_AUD`, `ACCESS_TEAM` ). Thiếu/sai → 403. Khi chạy local (`wrangler dev`) cho phép bỏ qua bằng biến `DEV_BYPASS_AUTH=1` (chỉ trong `.dev.vars`, không bao giờ trong `wrangler.jsonc`).
- Trang `/admin` (HTML do Worker trả hoặc trang Astro `noindex` gọi API): 
  - Tải ảnh lên: chọn loài, điểm ngắm (tuỳ chọn), chú thích, ngày chụp, tác giả (mặc định "Phùng Kiên"), giấy phép (mặc định "CC BY-SA 4.0"). Nhiều ảnh một lần.
  - Ảnh **nén ngay trên trình duyệt** (canvas → WebP, cạnh dài ≤ 2000px, chất lượng ~0,8; bản 600px cho lưới). Việc vẽ lại qua canvas cũng xoá EXIF/GPS — bắt buộc.
  - Ảnh Kiên đăng → `approved` luôn.
  - Danh sách ảnh đã đăng theo loài: ẩn (về rejected) / xoá hẳn (xoá cả R2).
- Xong khi: có test cho Worker (vitest + `@cloudflare/vitest-pool-workers` hoặc Miniflare): không có JWT → 403; upload → có bản ghi D1 + object R2; `/api/anh?flower=` chỉ trả approved. Build + deploy OK, Lighthouse trang loài ≥ 90.

## Bước 23 — Người ngoài gửi ảnh, Kiên duyệt

- Trang loài có nút "Gửi ảnh của bạn" → trang `/gui-anh?hoa=<slug>`: ảnh (1–3 ảnh), loài, điểm (tuỳ chọn), tên hiển thị (bắt buộc), link (tuỳ chọn), ngày chụp, ô tick bắt buộc: "Ảnh do tôi chụp, tôi đồng ý cho đăng theo giấy phép CC BY-SA 4.0 kèm tên tôi". Không hỏi email/số điện thoại.
- Chống spam: **Cloudflare Turnstile** (verify ở Worker bằng `TURNSTILE_SECRET`), giới hạn kích thước (≤ 3 MB sau nén), chỉ nhận `image/webp|jpeg`, kiểm tra magic bytes, giới hạn ~10 lần gửi/ngày/IP (lưu `ip_hash` = SHA-256(IP + salt), không lưu IP thô).
- Ảnh gửi → `pending`, không ai xem được trừ admin.
- `/admin` thêm tab "Chờ duyệt" (có số đếm): xem ảnh to, sửa loài/chú thích, **Duyệt** (chuyển R2 pending→approved, tạo bản 600px) / **Từ chối** (xoá file R2, giữ bản ghi rejected 30 ngày).
- Xong khi: test: thiếu Turnstile → 400; file không phải ảnh → 400; quá hạn mức → 429; pending không lộ ra `/api/anh`; duyệt xong thì lộ ra. Thử tay trên điện thoại.

## Việc Kiên phải tự làm trên Cloudflare (agent không làm thay)

1. `npx wrangler login` trên máy (nếu chưa).
2. Zero Trust → Access → Application cho `kham-pha.phungkien4002.workers.dev/admin*` và `/api/admin/*`, chính sách: email `phungkien4002@gmail.com`. Ghi lại team domain và AUD tag.
3. Turnstile → thêm site cho domain workers.dev → lấy site key + secret.
4. `npx wrangler secret put TURNSTILE_SECRET`, `IP_SALT`; đặt `ACCESS_TEAM`, `ACCESS_AUD`, `TURNSTILE_SITEKEY` trong `vars`.
