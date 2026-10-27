# Web khám phá kiểu neal.fun — hướng dẫn cho Claude Code

Đây là dự án của Kiên: một website tập hợp nhiều "trang khám phá" tương tác nhỏ, mỗi trang một chủ đề, chạy ngay trên trình duyệt. Lấy cảm hứng từ neal.fun nhưng chủ đề gắn với Việt Nam. Trang đầu tiên sẽ là **Mùa Hoa Việt**.

Kế hoạch đầy đủ nằm ở tài liệu "Kế hoạch web khám phá kiểu neal.fun" (Claude trên claude.ai giữ). File này là bản tóm tắt để code theo.

**Giai đoạn hiện tại: giai đoạn 2 — trang Mùa Hoa Việt** (giai đoạn 1 dựng nền đã xong, web chạy tại https://kham-pha.phungkien4002.workers.dev). Việc cụ thể nằm trong `TODO.md`; bố cục chi tiết theo mockup nằm trong `docs/mua-hoa-viet-spec.md`.

## Cách phối hợp

- `TODO.md` là nơi theo dõi tiến độ chung. Làm xong một việc thì tick `[x]` và ghi một dòng vào mục **Nhật ký** ở cuối file (ngày, việc gì, ghi chú nếu có).
- Gặp quyết định chưa rõ thì ghi vào mục **Câu hỏi cho Kiên** trong `TODO.md`, chọn phương án an toàn nhất rồi làm tiếp. Không dừng lại chờ.
- Không xoá hay viết lại các mục trong file này. Nếu cần bổ sung, thêm vào mục **Quyết định đã chốt** ở cuối.
- Làm từng bước nhỏ, mỗi bước xong thì `npm run build` phải chạy được, rồi commit với message tiếng Việt ngắn gọn.

## Môi trường

- Máy Windows, dùng PowerShell. Lệnh trong tài liệu này viết cho PowerShell.
- Node.js 20 LTS trở lên, dùng `npm`.
- Lệnh chính:
  - `npm run dev`: chạy thử tại http://localhost:4321
  - `npm run build`: build ra thư mục `dist/`
  - `npm run preview`: xem bản build

## Công nghệ đã chọn

| Phần | Công cụ |
| --- | --- |
| Khung web | Astro, xuất web tĩnh (`output: 'static'`) |
| Phần tương tác | Svelte qua `@astrojs/svelte`, hoặc JavaScript thuần nếu đơn giản |
| Font | Be Vietnam Pro, tự host qua `@fontsource/be-vietnam-pro` (không gọi Google Fonts) |
| Sitemap | `@astrojs/sitemap` |
| Hosting | Cloudflare Pages: build `npm run build`, thư mục xuất `dist` |
| Đo lường | Để chỗ sẵn cho Cloudflare Web Analytics hoặc Umami, chưa bật |

Không thêm framework CSS lớn (Tailwind, Bootstrap). Dùng CSS thuần, biến CSS và scoped style của Astro.

## Cấu trúc thư mục

```
src/
  config/site.ts          # tên web, URL, mô tả, mạng xã hội — tên web đang là TẠM
  data/pages.json         # danh sách các trang khám phá (nguồn cho trang chủ)
  styles/global.css       # biến màu, font, reset
  layouts/
    BaseLayout.astro      # <head>, meta SEO, Open Graph, font
    ExploreLayout.astro   # khung chung cho mọi trang khám phá
  components/
    PageCard.astro        # một thẻ trên trang chủ
    ShareButton.svelte    # nút chia sẻ (Web Share API, dự phòng copy link)
    NextPage.astro        # gợi ý "Trang tiếp theo" ở cuối mỗi trang
    SiteFooter.astro
  pages/
    index.astro           # trang chủ: lưới thẻ
    gioi-thieu.astro
    404.astro
    <slug>/index.astro    # mỗi trang khám phá một thư mục
  explore/
    <slug>/               # component, dữ liệu, ảnh riêng của từng trang khám phá
public/
  cards/<slug>.webp       # ảnh thẻ trang chủ
  og/                     # ảnh chia sẻ
```

## Hợp đồng của một trang khám phá

Mỗi trang khám phá phải:

1. Có một mục trong `src/data/pages.json`:
   ```json
   {
     "slug": "mua-hoa-viet",
     "title": "Mùa Hoa Việt",
     "tagline": "Hôm nay hoa gì đang nở?",
     "color": "#E8A0B4",
     "status": "live | coming-soon | draft",
     "launchDate": "2026-12-14",
     "card": "/cards/mua-hoa-viet.webp"
   }
   ```
2. Có `src/pages/<slug>/index.astro` dùng `ExploreLayout`.
3. Đặt mọi thứ riêng của trang trong `src/explore/<slug>/`. Không sửa layout chung để phục vụ riêng một trang.
4. Tách dữ liệu ra file JSON, không viết cứng trong component.
5. Chỉ nạp JavaScript cho phần tương tác (`client:visible` hoặc `client:idle`), phần còn lại là HTML tĩnh.

Trang chủ chỉ hiện các trang `live` và `coming-soon`. Trang `draft` vẫn build được để thử nhưng không lên trang chủ và không vào sitemap.

## Nguyên tắc thiết kế

- **Mobile trước**: thiết kế cho màn 380px, desktop là bản mở rộng. Không có thanh cuộn ngang.
- **Trang chủ**: lưới thẻ 2 cột trên điện thoại, 3 cột từ 768px, 4 cột từ 1200px. Mỗi thẻ có màu riêng lấy từ `color`, nền trang chủ trung tính. Thẻ có nhãn "Mới" nếu ra mắt dưới 30 ngày. Thẻ `coming-soon` hiện mờ, không bấm được, có nhãn "Sắp ra mắt".
- **Khung trang khám phá**: nút về trang chủ ở góc trên trái, nút chia sẻ góc trên phải, khung "Trang tiếp theo" ở cuối trang. Khung chung phải gọn, không lấn át nội dung.
- **Tiếng Việt**: `<html lang="vi">`, kiểm tra dấu hiển thị đúng ở mọi cỡ chữ. Mọi chữ trên giao diện viết tiếng Việt.
- **Hiệu năng**: Lighthouse mobile từ 90 điểm trở lên ở cả 4 mục. Ảnh dùng WebP/AVIF, có `width`/`height`, ảnh dưới màn hình dùng `loading="lazy"`.
- **Tôn trọng `prefers-reduced-motion`**: tắt hoặc giảm hoạt ảnh khi người dùng yêu cầu.
- **Không thu dữ liệu cá nhân**: không cookie, không đăng nhập. Lưu trạng thái nhỏ bằng `localStorage`, luôn bọc `try/catch`.
- **Bản đồ Việt Nam** (khi có): phải thể hiện đủ quần đảo Hoàng Sa và Trường Sa.

## SEO và chia sẻ

- Mỗi trang có `<title>`, `description`, ảnh Open Graph và Twitter card riêng, truyền qua props của `BaseLayout`.
- URL dạng chữ thường, không dấu, nối bằng gạch ngang: `/mua-hoa-viet`.
- Có `sitemap.xml` và `robots.txt`.

## Quyết định đã chốt

- 2026-10-27: Dùng Astro + Svelte, host trên Cloudflare Pages, bắt đầu bằng phần nền trước khi làm Mùa Hoa Việt.
- 2026-10-27: Tên web chưa chốt. Tạm dùng "Khám Phá" trong `src/config/site.ts`, đổi sau.
- 2026-10-27: Giai đoạn 2 làm trang Mùa Hoa Việt theo mockup (đặc tả ở `docs/mua-hoa-viet-spec.md`). Phần quản trị/đăng ảnh và bản đồ thật để giai đoạn sau. Ngày "hôm nay" luôn tính ở trình duyệt theo giờ Việt Nam vì web là web tĩnh.
