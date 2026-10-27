# TODO — Giai đoạn nền (web chính)

Mục tiêu: trang chủ dạng lưới thẻ và khung chung cho trang khám phá chạy được trên điện thoại, đã lên mạng qua Cloudflare Pages. Chưa làm nội dung Mùa Hoa Việt.

Quy ước: làm theo thứ tự, xong thì tick `[x]` và ghi Nhật ký. Mỗi bước xong phải `npm run build` không lỗi.

## Việc cần làm

- [x] **1. Khởi tạo dự án**
  - `npm create astro@latest . -- --template minimal --typescript strict --install --git`
  - `npx astro add svelte sitemap` (đồng ý mọi câu hỏi)
  - `npm install @fontsource/be-vietnam-pro`
  - Tạo `.gitignore` chuẩn cho Node/Astro nếu chưa có.
  - Xong khi: `npm run dev` mở được trang trắng tại localhost:4321.

- [x] **2. Cấu hình chung**
  - `src/config/site.ts`: tên tạm "Khám Phá", URL tạm `https://example.com`, mô tả một câu.
  - Đặt `site` trong `astro.config.mjs` lấy từ `site.ts`.
  - `src/styles/global.css`: reset nhẹ, biến màu (nền, chữ, chữ phụ, viền), biến khoảng cách, font Be Vietnam Pro 400/600/700.
  - Xong khi: font hiển thị đúng dấu tiếng Việt ("Mùa Hoa Việt — Hôm nay hoa gì đang nở?").

- [x] **3. `BaseLayout.astro`**
  - Props: `title`, `description`, `ogImage?`, `noindex?`.
  - `<html lang="vi">`, viewport, theme-color, favicon, canonical, Open Graph, Twitter card.
  - Chỗ để script đo lường (comment sẵn, chưa bật).
  - **Sửa font**: kiểm tra trên trình duyệt cho thấy Be Vietnam Pro đang nạp cả file (unicode-range U+0-10FFFF), không chia subset. Sửa để chỉ nạp subset `vietnamese` + `latin` có unicode-range đúng (ví dụ import `@fontsource/be-vietnam-pro/vietnamese-700.css` và `latin-700.css` thay vì file chung), cho cả 400/600/700. Kiểm lại dấu vẫn đủ.
  - Xong khi: xem nguồn trang thấy đủ thẻ meta; tab Network chỉ tải các file font subset `.woff2` cần dùng.

- [ ] **4. Dữ liệu trang + trang chủ**
  - `src/data/pages.json` với 3 mục: Mùa Hoa Việt (`coming-soon`, launch 2026-12-14), "Trang thử nghiệm" (`live`, slug `thu-nghiem`), một trang `draft` bất kỳ để kiểm tra lọc.
  - `PageCard.astro` và `src/pages/index.astro`: lưới 2/3/4 cột, nhãn "Mới", thẻ "Sắp ra mắt" mờ không bấm được.
  - Ảnh thẻ tạm: khối màu `color` + tiêu đề, không cần ảnh thật.
  - Phần đầu trang chủ: tên web + một câu giới thiệu ngắn phía trên lưới.
  - Lề: nội dung không dính mép; lề hai bên ít nhất 16px trên điện thoại, nội dung căn giữa với độ rộng tối đa khoảng 1200px trên màn lớn.
  - Thẻ: bo góc, chữ tiêu đề đọc rõ trên nền màu (đủ tương phản), có trạng thái hover/focus nhìn thấy được khi dùng bàn phím.
  - Xong khi: ở 380px hiện 2 cột gọn, không cuộn ngang; trang `draft` không hiện.

- [ ] **5. Khung trang khám phá**
  - `ExploreLayout.astro`: nút về trang chủ, `ShareButton.svelte` (Web Share API, dự phòng copy link và báo "Đã sao chép"), `NextPage.astro` lấy trang `live` kế tiếp trong `pages.json`.
  - `src/pages/thu-nghiem/index.astro`: trang mẫu có một tương tác nhỏ (ví dụ nút đếm bằng Svelte, `client:visible`) để kiểm tra khung.
  - Xong khi: từ trang chủ bấm vào trang thử nghiệm, chia sẻ được, quay về được.

- [ ] **6. Trang phụ**
  - `gioi-thieu.astro`: vài câu giới thiệu, chỗ đăng ký nhận tin (chỉ giao diện, chưa nối dịch vụ).
  - `404.astro` có nút về trang chủ.
  - `SiteFooter.astro` dùng ở trang chủ và trang phụ.
  - `public/robots.txt` trỏ tới sitemap.

- [ ] **7. Kiểm tra chất lượng**
  - `npm run build` không lỗi, không cảnh báo.
  - Lighthouse (mobile) trang chủ và trang thử nghiệm: mỗi mục từ 90 trở lên. Ghi điểm vào Nhật ký.
  - Kiểm tra ở 380px, 768px, 1280px. Bật `prefers-reduced-motion` xem hoạt ảnh có tắt không.

- [ ] **8. Lên mạng**
  - Tạo repo GitHub (Kiên tự làm hoặc hướng dẫn Kiên), push code.
  - Hướng dẫn Kiên kết nối Cloudflare Pages: framework preset Astro, build `npm run build`, output `dist`, biến môi trường `NODE_VERSION=20`.
  - Xong khi: có link `*.pages.dev` mở được trên điện thoại.

## Câu hỏi cho Kiên

- Tên web và tên miền chính thức?
- Ảnh Open Graph mặc định `/og/default.png` chưa có file thật (BaseLayout đã trỏ sẵn). Cần Kiên cung cấp hoặc làm ở bước sau; tạm để vậy.

## Nhật ký

- 2026-10-27: Claude (claude.ai) tạo `CLAUDE.md` và `TODO.md`.
- 2026-10-27: Xong bước 1 — khởi tạo Astro (minimal, strict) + Svelte + sitemap + `@fontsource/be-vietnam-pro`; `npm run dev` trả 200 tại localhost:4321. Ghi chú: `npm create astro` với `.` lại tạo thư mục con `proto-phase`, đã chuyển nội dung lên `D:\Neal` và đổi tên package thành `kham-pha`. Astro 7 yêu cầu Node >=22.23.4 (máy có 24.21).
- 2026-10-27: Xong bước 2 — `src/config/site.ts` (tên tạm "Khám Phá", URL `https://example.com`), `site` + `output: 'static'` trong `astro.config.mjs`, `src/styles/global.css` (biến màu/khoảng cách, font 400/600/700 subset vietnamese + latin, reduced-motion). `index.astro` tạm hiện dòng tiếng Việt để kiểm tra font, sẽ thay ở bước 3–4. `npm run build` chạy sạch.
- 2026-10-27: Git chưa có user.name/email nên commit dùng `-c` tạm (email phungkien4002@gmail.com), chưa sửa cấu hình git của máy.
- 2026-10-27: Claude (claude.ai) mở localhost:4321 kiểm tra bước 2: font Be Vietnam Pro 700 hiển thị đủ dấu tiếng Việt. Phát hiện font nạp cả file thay vì subset → thêm việc sửa vào bước 3. Bổ sung yêu cầu lề và phần đầu trang vào bước 4. Từ bước 3 trở đi, mỗi bước một commit riêng.
- 2026-10-27: Xong bước 3 — `BaseLayout.astro` (title, description, canonical, OG, Twitter, theme-color, favicon `public/favicon.svg`, noindex, chỗ comment cho script đo lường). Sửa font: nguyên nhân là các file `vietnamese-*.css`/`latin-*.css` của fontsource KHÔNG có `unicode-range`, nên import riêng lẻ làm trình duyệt nạp cả hai và subset sau đè subset trước. Đổi sang import `400.css`/`600.css`/`700.css` (đã chia vietnamese/latin-ext/latin kèm unicode-range đúng) — khác gợi ý ban đầu trong TODO vì cách đó không hiệu quả. Build sạch, CSS build có unicode-range cho từng subset. Chưa xem Network trên trình duyệt thật.
