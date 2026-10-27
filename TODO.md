# TODO

Quy ước: làm theo thứ tự, xong thì tick `[x]` và ghi Nhật ký. Mỗi bước xong phải `npm run build` không lỗi, rồi commit riêng (message tiếng Việt, `git -c user.name=Kien -c user.email=phungkien4002@gmail.com`). Không push trừ khi Kiên bảo (push lên `main` = web tự cập nhật trên mạng).

## Giai đoạn 2 — Trang Mùa Hoa Việt (đang làm)

Mục tiêu: trang `/mua-hoa-viet` và trang chi tiết từng loài chạy đúng theo mockup đã chốt. **Đọc `docs/mua-hoa-viet-spec.md` trước khi làm** — đó là mô tả đầy đủ bố cục, bánh xe 12 tháng và quy tắc "hôm nay". Chưa làm phần quản trị/đăng ảnh. Bản đồ thật để giai đoạn sau (giờ dùng khung giữ chỗ).

- [x] **9. Dữ liệu và kiểu dữ liệu**
  - Dùng Astro content collections (file loader, schema bằng zod) cho `src/explore/mua-hoa-viet/data/flowers.json` và `places.json`; build phải báo lỗi nếu dữ liệu sai kiểu.
  - `flowers`: `slug`, `name`, `scientificName`, `aka?`, `color`, `season` { `start`: {month, day?}, `peak?`: {month, day?}, `end`: {month, day?} }, `regions` (mảng: `bac`/`trung`/`nam`), `regionLabel` (vd "Đà Lạt, Gia Lai, Ba Vì"), `summary?`, `facts?` [{value, label}], `identify?` [chuỗi], `confusedWith?` {name, ours, theirs}, `didYouKnow?` [{title, text}], `dayMoments?` [{label, color, headline, scene, tip}], `quote?` {text, author, place, year}, `photos` [{src?, alt, author, license, source?, status: "approved"|"pending"}], `tips?` [chuỗi].
  - `places`: `slug`, `name`, `province`, `region`, `lat?`, `lng?`, `flowers` [{slug, best: "T10 – T11" hoặc cấu trúc tháng}].
  - Dữ liệu mẫu: 12 loài trong bánh xe của mockup (mai anh đào 12–2, hoa ban 2–4, hoa gạo 3, loa kèn 4, phượng 5–7, bằng lăng 5–6, sen 6–7, lúa chín 9–10, hoa sữa 10–11, tam giác mạch 10–12, dã quỳ 10–12 đỉnh giữa T11, cúc hoạ mi 11–12) với màu như spec; riêng **dã quỳ** điền đủ mọi trường như mockup. Ghi chú trong file (hoặc trường `verified: false`) rằng mùa nở và các chuyện thú vị là dữ liệu mẫu, CHƯA kiểm chứng.
  - Ảnh: chưa có ảnh thật → mọi `photos[].src` để trống, giao diện tự hiện khối màu giữ chỗ.

- [x] **10. Logic mùa nở (thuần TypeScript, có test)**
  - `src/explore/mua-hoa-viet/season.ts`: `inSeason(flower, month)`, `statusOn(flower, date)` → `chua-no` / `sap-no` (≤14 ngày) / `dang-no` / `dinh-mua` / `sap-tan` (≤14 ngày) / `het-mua`, `daysUntilPeak(flower, date)`, `bloomingWith(flower)`; xử lý mùa vắt qua năm (12 → 2) và ngày theo giờ `Asia/Ho_Chi_Minh`.
  - Thêm `vitest` + script `npm test`; test các ca: mùa trong năm, mùa vắt năm, ngày đầu/cuối mùa, 31/12 → 1/1.

- [x] **11. Trang chính `/mua-hoa-viet`**
  - Theo spec mục 1, điện thoại trước rồi máy tính. Phần chọn tháng + lọc miền + danh sách là một island Svelte (`client:load` cho phần đầu trang); danh sách điểm ngắm, "Sắp nở" cập nhật theo tháng và miền.
  - Bánh xe tạm thời có thể là SVG tĩnh không kéo được (bước 12 làm phần kéo).
  - HTML build sẵn theo ngày build; island tính lại theo ngày thật ở trình duyệt (spec mục 4).
  - Đổi `pages.json`: Mùa Hoa Việt vẫn `coming-soon` trên trang chủ, nhưng route phải truy cập được bằng URL để thử.

- [x] **12. Bánh xe 12 tháng**
  - Component Svelte theo spec mục 3: vòng cung từng loài, quạt tháng đang xem, nhãn T1–T12, kim theo ngày hôm nay; kéo kim (pointer events) và phím mũi tên đổi tháng; `role="slider"`; tooltip tên loài khi rê/chạm vòng cung; tôn trọng `prefers-reduced-motion`.
  - Đồng bộ với hàng nút tháng (một nguồn state).

- [x] **12b. Chỉnh sau đợt kiểm tra bước 11–12** (commit riêng, trước bước 13)
  - Nhãn T1–T12 trên bánh xe đang `font-size="10"` → trên điện thoại chỉ còn ~9px, khó đọc. Đổi thành 12 như spec; chữ "Tháng" ở tâm cũng 12.
  - Nhãn "Sắp tàn": hiện loài nở trong đúng một tháng (loa kèn T4, hoa gạo T3) luôn bị gắn "Sắp tàn". Quy tắc mới: tháng đang xem là tháng hiện tại → dùng `statusOn(flower, hôm nay)` (`sap-tan`); tháng khác → chỉ gắn khi tháng đó là tháng cuối mùa VÀ mùa dài hơn một tháng.
  - Thêm test cho quy tắc trên.

- [x] **13. Trang chi tiết `/mua-hoa-viet/[slug]`**
  - `getStaticPaths` từ `flowers`; bố cục theo spec mục 2; phần nào thiếu dữ liệu thì ẩn.
  - "Một ngày trên đồi…" là island nhỏ (`client:visible`); dải 12 tháng, trạng thái, đếm ngược tính lại ở trình duyệt.
  - Mỗi trang có title/description/OG riêng (vd "Dã quỳ nở tháng mấy, ngắm ở đâu — Mùa Hoa Việt").
  - Thêm các trang loài vào sitemap.

- [x] **14. Kiểm tra**
  - `npm test`, `npm run build` sạch.
  - Báo Claude (claude.ai) kiểm tra trên trình duyệt ở 375 / 768 / 1280px và chạy Lighthouse (mục tiêu ≥90 cả 4 mục cho `/mua-hoa-viet` và `/mua-hoa-viet/da-quy`).

- [x] **15. Chỉnh sau đợt kiểm tra bước 14** (Kiên đã duyệt 2026-10-27; commit riêng, không push)
  - Gộp nút quay lại ở đầu trang chi tiết: hiện có cả "Trang chủ" (của `ExploreLayout`) lẫn "← Mùa Hoa Việt" / breadcrumb. Thêm prop chung cho `ExploreLayout` kiểu `back={{ href, label }}` (mặc định = Trang chủ) — đây là tính năng chung cho mọi trang khám phá có trang con, không phải sửa riêng cho Mùa Hoa Việt. Trang chi tiết truyền `back={{ href: '/mua-hoa-viet/', label: 'Mùa Hoa Việt' }}` và bỏ dòng "← Mùa Hoa Việt" riêng; breadcrumb trên máy tính giữ hay bỏ tuỳ thấy gọn, nhưng chỉ còn MỘT chỗ để quay lại ở đầu trang điện thoại.
  - "Nở cùng thời điểm": sắp loài theo trạng thái hôm nay — đang nở / đỉnh mùa / sắp tàn trước, rồi sắp nở, rồi chưa đến mùa / hết mùa.
  - (Dữ liệu dã quỳ đã sửa sẵn: ô số liệu "Mùa nở" thay bằng "Họ Cúc"; "Dễ nhầm với" đổi sang hướng dương.)

- [x] **16. Tính theo ngày, không chỉ theo tháng** (sau đợt kiểm chứng dữ liệu, giờ mùa nở có ngày cụ thể; commit riêng, không push)
  - Trang chính: khi tháng đang xem là tháng hiện tại, "Đang nở" / số loài ở hero / vòng cung sáng trên bánh xe / điểm ngắm phải dựa vào `statusOn(flower, hôm nay)` (đang nở, đỉnh mùa, sắp tàn), không dựa vào `inSeason(flower, month)`. Ví dụ 27/10: lúa chín hết mùa 15/10 → KHÔNG còn là "đang nở" (có thể cho vào mục "Vừa hết mùa" thu gọn, hoặc bỏ). Tháng khác vẫn tính theo tháng như cũ.
  - Câu chữ mùa nở (trang chi tiết, thẻ): dùng phần ngày. Ngày 1–10 = "đầu tháng", 11–20 = "giữa tháng", 21–cuối = "cuối tháng"; không có ngày thì chỉ "tháng M". Ví dụ tam giác mạch (15/10 → 5/12): "nở từ giữa tháng 10 đến đầu tháng 12", không phải "đến hết tháng 12".
  - Thêm test cho cả hai.

## Giai đoạn 1 — Nền (đã xong 2026-10-27)

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

- [x] **4. Dữ liệu trang + trang chủ**
  - `src/data/pages.json` với 3 mục: Mùa Hoa Việt (`coming-soon`, launch 2026-12-14), "Trang thử nghiệm" (`live`, slug `thu-nghiem`), một trang `draft` bất kỳ để kiểm tra lọc.
  - `PageCard.astro` và `src/pages/index.astro`: lưới 2/3/4 cột, nhãn "Mới", thẻ "Sắp ra mắt" mờ không bấm được.
  - Ảnh thẻ tạm: khối màu `color` + tiêu đề, không cần ảnh thật.
  - Phần đầu trang chủ: tên web + một câu giới thiệu ngắn phía trên lưới.
  - Lề: nội dung không dính mép; lề hai bên ít nhất 16px trên điện thoại, nội dung căn giữa với độ rộng tối đa khoảng 1200px trên màn lớn.
  - Thẻ: bo góc, chữ tiêu đề đọc rõ trên nền màu (đủ tương phản), có trạng thái hover/focus nhìn thấy được khi dùng bàn phím.
  - Xong khi: ở 380px hiện 2 cột gọn, không cuộn ngang; trang `draft` không hiện.

- [x] **5. Khung trang khám phá**
  - `ExploreLayout.astro`: nút về trang chủ, `ShareButton.svelte` (Web Share API, dự phòng copy link và báo "Đã sao chép"), `NextPage.astro` lấy trang `live` kế tiếp trong `pages.json`.
  - `src/pages/thu-nghiem/index.astro`: trang mẫu có một tương tác nhỏ (ví dụ nút đếm bằng Svelte, `client:visible`) để kiểm tra khung.
  - Sửa 2 lỗi từ đợt kiểm tra bước 3–4 (commit riêng, trước khi làm khung):
    - [x] Thẻ "Sắp ra mắt" đang `opacity: 0.55` cả thẻ nên chữ bị nhạt, khó đọc. Bỏ opacity toàn thẻ; thay bằng nền nhạt hơn (pha màu `color` với nền) và chữ vẫn đậm, đạt tương phản tối thiểu 4.5:1.
    - [x] `og:image` trỏ `/og/default.png` nhưng file chưa có (404). Tạo ảnh mặc định 1200×630 đơn giản (tên web + câu giới thiệu trên nền trung tính) đặt ở `public/og/default.png`.
  - Xong khi: từ trang chủ bấm vào trang thử nghiệm, chia sẻ được, quay về được.

- [x] **6. Trang phụ**
  - `gioi-thieu.astro`: vài câu giới thiệu, chỗ đăng ký nhận tin (chỉ giao diện, chưa nối dịch vụ).
  - `404.astro` có nút về trang chủ.
  - `SiteFooter.astro` dùng ở trang chủ và trang phụ.
  - `public/robots.txt` trỏ tới sitemap.

- [x] **7. Kiểm tra chất lượng**
  - `npm run build` không lỗi, không cảnh báo.
  - Lighthouse (mobile) trang chủ và trang thử nghiệm: mỗi mục từ 90 trở lên. Ghi điểm vào Nhật ký.
  - Kiểm tra ở 380px, 768px, 1280px. Bật `prefers-reduced-motion` xem hoạt ảnh có tắt không.

- [x] **8. Lên mạng** — https://kham-pha.phungkien4002.workers.dev
  - Tạo repo GitHub (Kiên tự làm hoặc hướng dẫn Kiên), push code.
  - Đổi hướng: Cloudflare hiện khuyến nghị Workers (static assets) thay cho Pages với dự án mới. Đã thêm `wrangler.jsonc` (assets từ `./dist`, 404 trả `404.html`) và `wrangler` trong devDependencies. Trên dashboard: Compute → Workers & Pages → Create application → Import a repository; build `npm run build`, deploy `npx wrangler deploy`.
  - (Ghi chú cũ) Hướng dẫn Kiên kết nối Cloudflare Pages: framework preset Astro, build `npm run build`, output `dist`, biến môi trường `NODE_VERSION=24` (Astro 7 cần Node >= 22.23.4; để 20 sẽ build lỗi). Thêm `"engines": { "node": ">=22.23.4" }` và file `.nvmrc` ghi `24` để khớp.
  - Trước khi lên mạng: `public/robots.txt` đang ghi cứng `https://example.com`. Nên chuyển thành `src/pages/robots.txt.ts` sinh từ `site` trong `site.ts`, để đổi tên miền chỉ cần sửa một chỗ.
  - Xong khi: có link `*.pages.dev` mở được trên điện thoại.

## Câu hỏi cho Kiên

- Tên web và tên miền chính thức?
- Mùa nở, vùng, điểm ngắm của 12 loài đã kiểm chứng (xem `docs/nguon-du-lieu.md`). Dã quỳ còn `verified: false` vì các mục Bạn có biết?, Một ngày trên đồi, lời người chụp vẫn là nội dung mẫu.

## Nhật ký

- 2026-10-27: Claude (claude.ai) tạo `CLAUDE.md` và `TODO.md`.
- 2026-10-27: Xong bước 1 — khởi tạo Astro (minimal, strict) + Svelte + sitemap + `@fontsource/be-vietnam-pro`; `npm run dev` trả 200 tại localhost:4321. Ghi chú: `npm create astro` với `.` lại tạo thư mục con `proto-phase`, đã chuyển nội dung lên `D:\Neal` và đổi tên package thành `kham-pha`. Astro 7 yêu cầu Node >=22.23.4 (máy có 24.21).
- 2026-10-27: Xong bước 2 — `src/config/site.ts` (tên tạm "Khám Phá", URL `https://example.com`), `site` + `output: 'static'` trong `astro.config.mjs`, `src/styles/global.css` (biến màu/khoảng cách, font 400/600/700 subset vietnamese + latin, reduced-motion). `index.astro` tạm hiện dòng tiếng Việt để kiểm tra font, sẽ thay ở bước 3–4. `npm run build` chạy sạch.
- 2026-10-27: Git chưa có user.name/email nên commit dùng `-c` tạm (email phungkien4002@gmail.com), chưa sửa cấu hình git của máy.
- 2026-10-27: Claude (claude.ai) mở localhost:4321 kiểm tra bước 2: font Be Vietnam Pro 700 hiển thị đủ dấu tiếng Việt. Phát hiện font nạp cả file thay vì subset → thêm việc sửa vào bước 3. Bổ sung yêu cầu lề và phần đầu trang vào bước 4. Từ bước 3 trở đi, mỗi bước một commit riêng.
- 2026-10-27: Xong bước 3 — `BaseLayout.astro` (title, description, canonical, OG, Twitter, theme-color, favicon `public/favicon.svg`, noindex, chỗ comment cho script đo lường). Sửa font: nguyên nhân là các file `vietnamese-*.css`/`latin-*.css` của fontsource KHÔNG có `unicode-range`, nên import riêng lẻ làm trình duyệt nạp cả hai và subset sau đè subset trước. Đổi sang import `400.css`/`600.css`/`700.css` (đã chia vietnamese/latin-ext/latin kèm unicode-range đúng) — khác gợi ý ban đầu trong TODO vì cách đó không hiệu quả. Build sạch, CSS build có unicode-range cho từng subset. Chưa xem Network trên trình duyệt thật.
- 2026-10-27: Xong bước 4 — `src/data/pages.json` (3 mục), `PageCard.astro`, trang chủ lưới 2/3/4 cột (lề 16px, tối đa 1200px), nhãn "Mới" (live, launch <30 ngày) và "Sắp ra mắt" (mờ, là `div` không bấm được), focus-visible rõ. Build sạch; HTML build chỉ có 2 thẻ, trang `draft` không hiện. Chưa xem bằng trình duyệt ở 380px (kiểm ở bước 7); link `/thu-nghiem/` sẽ 404 tới khi làm bước 5. Ảnh `card` trong JSON là đường dẫn dự phòng, hiện thẻ chỉ dùng khối màu.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 3–4 trên trình duyệt. Đạt: 375px ra 2 cột, không cuộn ngang; 1280px ra 4 cột trong khung tối đa 1200px; trang `draft` ẩn; meta đủ (lang vi, description, canonical, OG, Twitter, theme-color); font chỉ tải các file subset (vietnamese, latin, latin-ext). Chưa đạt: thẻ "Sắp ra mắt" mờ cả thẻ nên chữ khó đọc; `/og/default.png` trả 404 → thêm việc sửa vào bước 5.
- 2026-10-27: Sửa 2 lỗi đầu bước 5. Thẻ "Sắp ra mắt": bỏ `opacity`, dùng nền pha 30% màu thẻ với nền trang + viền đứt, chữ giữ màu đậm `#1f1d1a` (tương phản cao). Ảnh OG: tạo `public/og/default.png` 1200×630 bằng sharp từ SVG (font hệ thống Segoe UI vì máy không có Be Vietnam Pro; dấu hiển thị đủ). Đã xoá câu hỏi về ảnh OG.
- 2026-10-27: Xong bước 5 — `ExploreLayout.astro` (nút Trang chủ trái, `ShareButton.svelte` phải với `client:idle`, `NextPage` cuối trang), `ShareButton` (Web Share API → dự phòng copy link, hiện "Đã sao chép" 2 giây, cuối cùng là hộp thoại prompt), `NextPage.astro` (trang `live` kế tiếp, quay vòng; hiện chỉ có 1 trang live nên hiện khung "Xem tất cả trang" về trang chủ), `/thu-nghiem/` với nút đếm Svelte `client:visible` (`src/explore/thu-nghiem/Counter.svelte`). Build sạch, `/thu-nghiem/` trả 200. Chưa thử Web Share/clipboard trên trình duyệt thật.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 5 trên trình duyệt (375px): thẻ "Sắp ra mắt" giờ đọc rõ, vẫn không bấm được; `/og/default.png` trả 200 (PNG 45 KB). Bấm thẻ vào `/thu-nghiem/` → nút đếm chạy (bấm 2 lần ra "Đã bấm 2 lần"); nút Chia sẻ gọi Web Share với đủ title/text/url; khi không có Web Share thì copy link và báo "Đã sao chép liên kết" qua aria-live; nút Trang chủ quay về `/`. Không cuộn ngang. Bước 5 đạt.
- 2026-10-27: Xong bước 6 — `SiteFooter.astro` (dùng ở trang chủ, giới thiệu, 404), `gioi-thieu.astro` (vài câu giới thiệu + ô đăng ký email chỉ giao diện, đang `disabled`), `404.astro` (noindex, nút về trang chủ), `public/robots.txt` trỏ `https://example.com/sitemap-index.xml` (nhớ đổi khi có tên miền thật). Kiểm tra draft: tạm tạo `src/pages/ban-nhap/` để build thử — trang vẫn build ra nhưng không có trong `sitemap-0.xml`. Vì chưa có cơ chế lọc, thêm `filter` vào `sitemap()` trong `astro.config.mjs` đọc `pages.json` để loại mọi slug `draft`; đã xoá trang thử sau khi kiểm. Build sạch, không cảnh báo.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 6: build lại sạch (4 trang); `sitemap-0.xml` chỉ có `/`, `/gioi-thieu/`, `/thu-nghiem/` (không có 404, không có draft). Trên trình duyệt 375px: `/gioi-thieu/` không cuộn ngang, ô email và nút Đăng ký đang tắt đúng như dự định; đường dẫn lạ ra trang 404 tiếng Việt có `noindex` và nút về trang chủ; footer có ở trang chủ, giới thiệu, 404. Bước 6 đạt. Ghi chú thêm vào bước 8: robots.txt nên sinh từ `site.ts`.
- 2026-10-27: Xong bước 7 (Claude claude.ai chạy) — build sạch không cảnh báo. Lighthouse 12, chế độ mobile, trên bản build (`astro preview`): trang chủ Hiệu năng 98 / Trợ năng 100 / Thực hành tốt 100 / SEO 100 (FCP 1.9s, LCP 1.9s, TBT 0ms, CLS 0, 118 KiB); `/thu-nghiem/` 100 / 100 / 100 / 100 (FCP 0.8s, LCP 1.1s, CLS 0, 149 KiB). Bố cục: 375px 2 cột, 768px 3 cột, 1280px 4 cột, không cuộn ngang ở cả ba. Có quy tắc `prefers-reduced-motion` tắt animation/transition toàn trang. Báo cáo JSON để ở `%TEMP%\lh-neal`.
- 2026-10-27: Bước 8, phần code (chưa push). `public/robots.txt` đổi thành `src/pages/robots.txt.ts` sinh từ `site.url` trong `site.ts` (build ra `dist/robots.txt` đúng, trỏ `https://example.com/sitemap-index.xml`). `package.json` đã có sẵn `"engines": { "node": ">=22.23.4" }` từ trước nên giữ nguyên; thêm `.nvmrc` ghi `24`. Build sạch. Kiểm tra GitHub CLI: máy CHƯA cài `gh` (không tìm thấy ở cả bash lẫn PowerShell), nên chưa có đăng nhập để kiểm. Việc còn lại của bước 8: Kiên cài `gh` (`winget install GitHub.cli`) rồi `gh auth login`, hoặc tự tạo repo trên github.com; sau đó push và nối Cloudflare Pages.
- 2026-10-27: Claude (claude.ai) push code lên GitHub `phungkien402/kham-pha`, nhánh `main` (đổi nhánh local `master` → `main`, theo dõi `origin/main`). Máy chưa có `gh` nhưng git push qua HTTPS chạy được. Còn lại của bước 8: Kiên nối Cloudflare Pages với repo.
- 2026-10-27: Claude (claude.ai) chuyển hướng deploy sang Cloudflare Workers (static assets) theo khuyến nghị hiện tại của Cloudflare/Astro: thêm `wrangler.jsonc` (name `kham-pha`, assets `./dist`, `not_found_handling: 404-page`), cài `wrangler` devDependency. `npm run build` sạch, `npx wrangler deploy --dry-run` đọc được 38 file từ `dist`. Link sẽ có dạng `kham-pha.<tài-khoản>.workers.dev` thay vì `*.pages.dev`.
- 2026-10-27: Xong bước 8 — web chạy tại https://kham-pha.phungkien4002.workers.dev (Cloudflare Workers, tự build khi push `main`). Claude (claude.ai) kiểm tra bản trên mạng: trang chủ, `/thu-nghiem/`, `/gioi-thieu/`, `og/default.png`, `sitemap-index.xml` trả 200; đường dẫn lạ trả 404 kèm trang 404 tiếng Việt; font tải đúng 7 file subset. Đổi `site.url` trong `site.ts` từ example.com sang URL workers.dev để canonical, sitemap, robots trỏ đúng. Giai đoạn nền hoàn tất.
- 2026-10-27: Claude (claude.ai) mở giai đoạn 2 (Mùa Hoa Việt): thêm bước 9–14 vào TODO.md, viết `docs/mua-hoa-viet-spec.md` mô tả mockup Kiên đã chốt (trang chính có bánh xe 12 tháng, trang chi tiết loài), cập nhật dòng giai đoạn hiện tại trong CLAUDE.md. Thêm quy ước: không push trừ khi Kiên bảo.
- 2026-10-27: Xong bước 9 — `src/content.config.ts` (collection `flowers` và `places`, file loader + zod từ `astro/zod`, id lấy từ `slug`), dữ liệu mẫu 12 loài + 8 điểm ngắm trong `src/explore/mua-hoa-viet/data/`. Ảnh để trống (`src` bỏ qua, `status: pending`). Đã thử cố ý đặt tháng 13 → build báo `InvalidContentEntryDataError`, sửa lại thì build sạch.
- 2026-10-27: Xong bước 10 — `season.ts` (`inSeason`, `statusOn`, `daysUntilPeak`, `bloomingWith`, `vnParts`) + `season.test.ts` (16 test, `npm test` dùng vitest pass; build sạch). Quy ước mình chọn: đỉnh mùa = ngày đỉnh ±7 ngày (đỉnh chỉ ghi tháng thì lấy ngày 15; không ghi đỉnh thì lấy giữa mùa); `daysUntilPeak` trả 0 khi đang đỉnh, còn lại là số ngày tới đầu đỉnh mùa kế tiếp; ngoài mùa thì gần cuối mùa trước hơn → `het-mua`, gần mùa sau hơn → `chua-no`; `sap-tan` gồm cả ngày cuối mùa. `bloomingWith(flower, all)` nhận thêm danh sách loài (khác chữ ký trong TODO vì cần dữ liệu các loài khác), so theo tháng chung. Ngày tính bằng `Intl` múi giờ Asia/Ho_Chi_Minh.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 9–10: `npm test` 16/16 pass, build sạch; logic `season.ts` hợp lý (mùa vắt năm, đỉnh mùa ±7 ngày, giờ VN). Sửa dữ liệu: màu 12 loài lấy theo mockup (màu cũ của hoa ban, loa kèn, hoa sữa, cúc hoạ mi gần như trắng, gần như không thấy trên nền `#FAF8F5`); mọi màu giờ đạt ≥3:1 trên nền trắng, dã quỳ làm đậm thành `#B57F0A`. `regions` của dã quỳ và mai anh đào đổi `nam` → `trung` vì Đà Lạt, Gia Lai thuộc Tây Nguyên (xếp vào miền Trung). Câu hỏi màu đã trả lời.
- 2026-10-27: Xong bước 11 — `/mua-hoa-viet` (`src/pages/mua-hoa-viet/index.astro` đọc content collections, truyền dữ liệu rút gọn vào island `MuaHoaViet.svelte` `client:load`): hero (ngày, tiêu đề đổi theo tháng đang xem), bánh xe tĩnh `Wheel.svelte` (hình học ở `wheel.ts`), chú thích loài, hàng nút tháng, lọc miền, "Đang nở", "Sắp nở tháng M+1", "Ngắm ở đâu" (khung bản đồ giữ chỗ, ghi rõ sẽ có Hoàng Sa, Trường Sa). HTML build theo ngày build, `onMount` tính lại theo giờ Việt Nam. Layout: điện thoại một cột, từ 1024px hero 2 cột (bánh xe 480px bên phải). Khác spec một chút: ô "Sắp nở" luôn là một mục riêng, không nằm trong cột phải của "Ngắm ở đâu" trên máy tính. Link sang `/mua-hoa-viet/<slug>/` sẽ 404 tới khi làm bước 13. `pages.json` giữ `coming-soon`, route vẫn vào được bằng URL. Test 16/16, build sạch.
- 2026-10-27: Xong bước 12 — `Wheel.svelte` kéo được: kim là `role="slider"` (`aria-valuenow`/`aria-valuetext` "Tháng M"), kéo bằng pointer events (chuột và cảm ứng, `touch-action: none` trên kim) hoặc phím ←/→/↑/↓, Home, End (vòng quanh T12 ↔ T1); `month` là `$bindable` dùng chung với hàng nút tháng và lọc trong `MuaHoaViet.svelte` (một nguồn state). Kim quay theo đường ngắn nhất, chuyển 0,2 giây (tắt khi `prefers-reduced-motion`); khi thả thì kim về đúng ngày hôm nay (tháng hiện tại) hoặc giữa tháng. Tooltip "tên loài · mùa nở" khi rê chuột/chạm vào vòng cung (chạm tự ẩn sau ~2 giây). Thêm `wheel.test.ts` (7 test). Test 23/23, build sạch. Chưa thử kéo bằng trình duyệt thật — Claude (claude.ai) kiểm tra.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 11–12 trên bản build (`astro preview`). LỖI GẶP: dev server do Claude Code để chạy từ trước khi có content collections nên `getCollection` trả rỗng → trang báo "0 loài hoa", bánh xe trống; bản build vẫn đúng. Khởi động lại dev là hết. Rút kinh nghiệm: thêm/sửa `content.config.ts` thì phải khởi động lại dev server. Kết quả: 375px — 4 loài đang nở hôm nay (dã quỳ, hoa sữa, lúa chín "Sắp tàn", tam giác mạch), "Sắp nở tháng 11: cúc hoạ mi", 6 điểm ngắm, không cuộn ngang. Bấm "Tháng 3" → tiêu đề, kim, danh sách đổi đúng; phím ←/→ trên kim đổi tháng và đồng bộ nút tháng; kéo kim (pointer) từ T2 tới T6 → "Đang xem tháng 6". 1280px — hero 2 cột, nút tháng lưới 6×2, thẻ "Đang nở" 4 cột, bản đồ giữ chỗ + danh sách bên phải; khớp mockup. Sửa dữ liệu: màu dã quỳ `#B57F0A` gần trùng lúa chín `#B88F1F` → đổi dã quỳ sang cam `#C8650F` (3,94:1 trên nền trắng). Thêm bước 12b (cỡ chữ nhãn bánh xe, quy tắc "Sắp tàn").
- 2026-10-27: Xong bước 12b — nhãn T1–T12 và chữ "Tháng" ở tâm bánh xe đổi sang `font-size="12"`. Thêm `showEndingTag(flower, viewMonth, today)` trong `season.ts` (tháng hiện tại → `statusOn` = `sap-tan`; tháng khác → tháng cuối mùa và mùa dài hơn một tháng), `MuaHoaViet.svelte` dùng hàm này; thêm 3 test (26/26 pass), build sạch.
- 2026-10-27: Xong bước 13 — `src/pages/mua-hoa-viet/[slug].astro` (`getStaticPaths` từ collection `flowers`, 12 trang) theo spec mục 2; phần thiếu dữ liệu thì ẩn (vd sen chỉ có: mùa nở, ngắm ở đâu, nở cùng thời điểm). Island: `FlowerNow.svelte` (`client:load`: hộp trạng thái, 3 ô số liệu có đếm ngược, dải 12 tháng), `DayMoments.svelte` (`client:visible`, màu nền đổi 0,4 giây), `BloomingWith.svelte` (`client:visible`, trạng thái từng loài), `Carousel.svelte` (`client:idle`, vuốt ngang + chấm chỉ số). Logic chữ ở `detail.ts` (+5 test), thêm `daysUntilStart`/`daysUntilEnd` vào `season.ts`. Title dạng "Dã quỳ nở tháng mấy, ngắm ở đâu — Mùa Hoa Việt", mô tả lấy `summary`, OG lấy ảnh thật đầu tiên nếu có (không thì ảnh mặc định). 12 trang loài có trong sitemap. Khác spec: (1) khung chung `ExploreLayout` giữ nút "Trang chủ" ở góc trên trái (không sửa layout chung), nút "← Mùa Hoa Việt" / breadcrumb nằm ngay đầu nội dung; (2) chưa có hàng 6 ảnh nhỏ cạnh ảnh lớn và link "Xem cả N ảnh" vì mới có 1 ảnh giữ chỗ mỗi loài; mục "Ảnh" chỉ hiện khi có từ 2 ảnh. Có dòng ghi chú "dữ liệu mẫu, chưa kiểm chứng" cuối trang khi `verified: false`. Test 31/31, build sạch (17 trang). Chưa xem bằng trình duyệt.

- 2026-10-27: Xong bước 14 (Claude claude.ai kiểm tra trên bản build). Trang chi tiết dã quỳ 375px: đủ phần theo spec, không cuộn ngang, không lỗi console; trạng thái 'Đang nở · sắp vào đỉnh mùa', đếm ngược ~12 ngày; bấm 'Bình minh' → nền đổi màu, mẹo đổi, nút aria-pressed đúng; 'Nở cùng thời điểm' có 5 loài, link đúng. 1280px: ảnh 480px trái + tên/trạng thái phải, phần dưới ghép 2 cột. Lighthouse mobile: /mua-hoa-viet 98/100/100/100 (LCP 2,1s, CLS 0,061), /mua-hoa-viet/da-quy 98/100/100/100 (LCP 2,3s, CLS 0,001). Giai đoạn 2 hoàn tất phần code; còn chỉnh nhỏ và kiểm chứng nội dung — xem 'Việc tiếp theo'.
- 2026-10-27: Kiên duyệt kết quả bước 14 và bảo push. Claude (claude.ai) sửa dữ liệu dã quỳ (ô số liệu "Mùa nở" → "Họ Cúc · Cùng họ hướng dương"; "Dễ nhầm với" → hướng dương), thêm bước 15 (gộp nút quay lại qua prop chung của ExploreLayout; sắp "Nở cùng thời điểm" theo trạng thái), rồi push `main` lên GitHub → Cloudflare tự deploy. Trang chủ vẫn để Mùa Hoa Việt "Sắp ra mắt"; route `/mua-hoa-viet/` vào được bằng link.
- 2026-10-27: Xong bước 15 — `ExploreLayout` có prop `back?: { href, label }` (mặc định Trang chủ); trang chi tiết loài truyền `back` về Mùa Hoa Việt, bỏ dòng "← Mùa Hoa Việt" riêng (breadcrumb chỉ còn trên màn ≥1024px, điện thoại chỉ có một nút quay lại). Thêm `sortByStatus` trong `detail.ts` (đang nở/đỉnh mùa/sắp tàn → sắp nở → chưa đến mùa/hết mùa, cùng nhóm giữ thứ tự cũ), `BloomingWith.svelte` dùng hàm này theo ngày ở trình duyệt; thêm 1 test (32/32 pass), build sạch 17 trang.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 15 trên bản build: điện thoại chỉ còn một nút quay lại "Mùa Hoa Việt" ở đầu trang; máy tính có nút quay lại + breadcrumb Trang chủ / Mùa Hoa Việt; "Nở cùng thời điểm" xếp đúng: hoa sữa, lúa chín (sắp tàn), tam giác mạch → cúc hoạ mi (sắp nở) → mai anh đào (chưa đến mùa). Không cuộn ngang. Đạt, push `main`.

- 2026-10-27: Claude (claude.ai) kiểm chứng dữ liệu 12 loài (nguồn trong `docs/nguon-du-lieu.md`): mùa nở có ngày cụ thể (vd lúa chín 10/9 → 15/10, tam giác mạch 15/10 → 5/12, dã quỳ 20/10 → 10/11 → 15/12, cúc hoạ mi 20/11 → 10/12), sửa vùng và tên tỉnh sau sáp nhập 2025 (Hà Giang → Tuyên Quang, Yên Bái → Lào Cai; Đà Lạt, Gia Lai xếp miền Trung), tên khoa học tam giác mạch → Fagopyrum esculentum, places.json 10 điểm (thêm Nhật Tân – Tây Tựu, Chùa Hương; Đồng Tháp T8). 11 loài `verified: true`, dã quỳ còn `false`. Test 32/32, build sạch. Thêm bước 16 (tính 'đang nở' theo ngày cho tháng hiện tại; câu chữ đầu/giữa/cuối tháng). Push.
- 2026-10-27: Xong bước 16 — thêm `isBloomingIn(flower, viewMonth, today)` trong `season.ts` (tháng hiện tại dựa `statusOn`: đang nở / đỉnh mùa / sắp tàn; tháng khác vẫn theo `inSeason`); `MuaHoaViet.svelte` dùng hàm này nên số loài ở hero, danh sách, vòng cung sáng trên bánh xe và điểm ngắm đều theo ngày (27/10 lúa chín hết mùa 15/10 không còn "đang nở"; chưa làm mục "Vừa hết mùa"). Câu chữ mùa nở theo ngày: `monthRangeLabel`/`seasonPhrase` trong `detail.ts` (1–10 đầu, 11–20 giữa, 21–cuối tháng; không ngày thì "tháng M"), dùng ở thẻ, tooltip bánh xe, trang chi tiết và meta description. Thêm 4 test (36/36 pass), build sạch 17 trang.
- 2026-10-27: Claude (claude.ai) kiểm tra bước 16 trên bản build: 27/10 trang chính còn "3 loài hoa đang nở" (dã quỳ, hoa sữa, tam giác mạch), lúa chín không còn; bánh xe sáng đúng 3 vòng; câu chữ dạng "giữa tháng 10 – đầu tháng 12"; meta description tam giác mạch đúng. Test 36/36, build sạch. Đạt, push.
