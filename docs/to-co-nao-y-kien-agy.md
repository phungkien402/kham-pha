# Góp ý thiết kế & Kế hoạch triển khai: "Việt Nam to cỡ nào?"

> **Người thực hiện:** Antigravity (AGY)  
> **Dự án:** [D:/Neal](file:///D:/Neal) (Astro 7 + Svelte)  
> **Tài liệu tham chiếu:** [docs/to-co-nao-y-tuong.md](file:///D:/Neal/docs/to-co-nao-y-tuong.md), [CLAUDE.md](file:///D:/Neal/CLAUDE.md), [scripts/build-map.mjs](file:///D:/Neal/scripts/build-map.mjs), [src/explore/mua-hoa-viet/map/projection.ts](file:///D:/Neal/src/explore/mua-hoa-viet/map/projection.ts).

---

## 1. Đánh giá ý tưởng "Việt Nam to cỡ nào?"

### 1.1. Cái hay
- **Đánh đúng tâm lý khám phá và tự hào địa phương:** Người Việt rất tò mò về kích thước thực tế của nước mình và các tỉnh sau đợt sáp nhập 2025 (ví dụ: tỉnh Lâm Đồng mới rất rộng, hay Nghệ An rộng hơn nhiều quốc gia châu Âu).
- **Trải nghiệm Neal.fun đúng điệu:** Một màn hình trực quan, vào là tương tác được ngay không cần đăng nhập hay hướng dẫn dài dòng. Cặp mặc định ("Lâm Đồng ≈ 1,6 lần Bỉ") lập tức kích thích sự tò mò.
- **Phương pháp chiếu bản đồ chuẩn xác (Lambert Azimuthal Equal-Area theo centroid):** Đây là điểm cộng xuất sắc về mặt kỹ thuật địa lý, khắc phục hoàn toàn sự méo mó kinh điển của phép chiếu Mercator (vốn khiến các nước hàn đới trông khổng lồ so với các nước nhiệt đới).
- **Tính toán trước lúc build (Offline Pre-projection):** Đưa toàn bộ toạ độ về hệ phẳng km ngay lúc build giúp client cực nhẹ, không cần kéo thư viện GIS nặng nề về trình duyệt.

### 1.2. Cái thừa (Nên lược bỏ hoặc tối giản)
- **Tự động "hút" tâm (Auto-snapping) khi kéo gần:** Trong thao tác tự do, auto-snapping dễ gây ức chế khi người dùng cố tình căn chỉnh đường bờ biển, biên giới hoặc muốn đặt hai hình áp sát nhau để chụp ảnh.  
  *Khuyến nghị:* Bỏ auto-snap khi kéo. Thay bằng một nút bấm chủ động: **"Chồng tâm" (Overlay Centers)** hoặc **"Đặt cạnh nhau" (Side by side)**.
- **Câu so sánh tự sinh dạng trêu đùa ("...à không, 1,3 lần"):** Nếu trên bàn có từ 3 đến 6 hình, việc ghép câu văn phức tạp sẽ gây rối mắt và khó hiểu ngữ cảnh.  
  *Khuyến nghị:* Chỉ so sánh trực tiếp giữa **2 hình đang được chọn (Active)** hoặc hình vừa di chuyển với hình gần nhất. Hiển thị dạng thẻ số liệu tinh gọn: `[Hình A] ≈ X,X lần [Hình B]`.

### 1.3. Cái thiếu
- **Khả năng xoay hình (Rotation):** Việt Nam có hình chữ S hẹp và dài cong theo hướng Bắc – Nam (~1.650 km). Nếu không thể xoay, người dùng không thể so sánh chiều dài Việt Nam với chiều ngang nước Mỹ, không thể ướm bờ biển Việt Nam vào bờ tây châu Âu hay dọc theo Chile, Nhật Bản, Na Uy.
- **Độ tương phản khi chồng lấn (Visual Stacking):** Nếu chỉ dùng nền màu trong suốt, khi chồng 2-3 hình lên nhau các ranh giới sẽ bị chìm. Cần có viền nét mảnh tương phản (outline stroke) và hiệu ứng nổi bật (highlight) cho hình đang được focus.

### 1.4. Đề xuất 4 chi tiết làm trang "đáng chia sẻ" hơn (nhưng vẫn tối giản)
1. **Nút "Xuất ảnh thẻ so sánh" (Snapshot / Copy Image):**
   - Người dùng mạng xã hội (Facebook, Threads, X) thích chia sẻ ảnh trực quan hơn là chỉ gửi đường link text.
   - Thêm nút icon máy ảnh nhỏ: dùng `<canvas>` vẽ nhanh trạng thái bàn kéo hiện tại thành một bức ảnh tỷ lệ 1200×630 (hoặc 1:1) có nền kem, kèm nhãn tên 2 hình và tỷ lệ số liệu, có watermark nhỏ `kham-pha`. Hỗ trợ Web Share API (chia sẻ file ảnh trực tiếp trên điện thoại) hoặc Copy Image to Clipboard trên máy tính.
2. **Hàng chip "Kèo kinh điển" (Preset Battles) dưới thanh tìm kiếm:**
   - Thay vì chỉ có nút "Ngẫu nhiên", cung cấp sẵn 3–4 preset khơi gợi tranh luận:
     - *Kèo chiều dài:* **Việt Nam vs Nhật Bản** (sự tương đồng kỳ lạ về độ trải dài).
     - *Kèo đảo ngọc:* **Phú Quốc vs Singapore** (574 km² vs 728 km² — đảo Việt Nam gần bằng cả một quốc đảo).
     - *Kèo đại ngàn:* **Nghệ An vs Slovenia** (tỉnh rộng nhất VN lớn gần bằng một quốc gia châu Âu).
     - *Kèo thủ đô:* **Hà Nội vs Tokyo** (Hà Nội sau mở rộng 2008 rộng hơn cả Tokyo).
3. **Thước đo kích thước bao (Bounding Dimensions Ruler):**
   - Khi chọn một hình, ngoài diện tích km², hiện thêm kích thước bao dài nhất: ví dụ Việt Nam: *Dài 1.650 km | Hẹp nhất 50 km (Quảng Bình)*. Điều này tăng mạnh tính trực quan khi ướm thử.
4. **Ảnh xem trước động theo Preset (OG Image Previews):**
   - Chuẩn bị sẵn các ảnh Open Graph tương ứng cho các preset kinh điển (`/og/to-co-nao-lam-dong-bi.webp`, `/og/to-co-nao-vn-nhat-ban.webp`...). Khi người dùng bấm chia sẻ link có param preset, card hiển thị trên mạng xã hội sẽ có ngay hình so sánh thật, kích thích tỷ lệ click.

---

## 2. Trả lời 5 câu hỏi cuối file ý tưởng

### Câu hỏi 1: Trải nghiệm có gì thừa/thiếu? Có nên cho xoay hình?
- **Thừa:** Auto-snapping tự động (gây ức chế khi căn mép); câu văn diễn giải dài dòng khi có >2 hình.
- **Thiếu:** Nút căn chỉnh nhanh (Align centers / Side-by-side); độ tương phản viền khi chồng hình; phím tắt xoay.
- **Có nên cho xoay hình?** **RẤT NÊN (Bắt buộc phải có).** Đây là tính năng tạo nên trải nghiệm so sánh địa lý thú vị nhất (như trên The True Size Of). 
  - *Cách điều khiển tối giản:*
    - Mobile: Chụm 2 ngón xoay tự nhiên (pinch-to-rotate).
    - Desktop: Một chấm xoay tròn nhỏ ở đỉnh hình khi được chọn (rotation handle), hoặc lăn chuột khi giữ phím `Shift`/`Alt`, hoặc nút xoay 45° trong menu ngữ cảnh nhỏ của hình.

### Câu hỏi 2: Tỉ lệ & thu phóng trên màn hình điện thoại 375px khi hình chênh nhau 10.000 lần (Nga vs Hà Nội)?
- **Vấn đề:** Nếu khung hình vừa với nước Nga (~9.000 km bề ngang), Hà Nội (~60 km) chỉ còn khoảng 2 pixel, hoàn toàn tàng hình. Nếu zoom vừa Hà Nội, nước Nga sẽ tràn ra ngoài màn hình hàng chục ngàn pixel.
- **Giải pháp:**
  1. **Tự động cân khung (Auto Fit-Bounds):** Khi thêm một hình mới vào bàn, camera tự động lerp (zoom/pan mượt mà) để bao trọn hộp bao (bounding box) của toàn bộ các hình hiện có với lề an toàn 12%.
  2. **Vòng hào quang định vị (Halo Ring / Pin Indicator):** Khi tỷ lệ zoom hiện tại làm một hình co lại dưới 12px trên màn hình, thay vì để nó biến mất, tự động vẽ một vòng tròn hào quang xung quanh kèm tên thu nhỏ, bấm vào đó camera sẽ zoom nhanh tới hình đó.
  3. **Thước tỉ lệ thích ứng (Adaptive Scale Bar):** Thước ở góc tự động chuyển nấc: `10 km` $\rightarrow$ `50 km` $\rightarrow$ `200 km` $\rightarrow$ `1.000 km` $\rightarrow$ `5.000 km` tuỳ theo mức zoom.
  4. **Giới hạn zoom an toàn:** Đặt dải zoom từ `0.04x` (đủ nhìn toàn cảnh Nga, Canada) đến `25x` (đủ soi rõ các đảo nhỏ, Bắc Ninh, Hà Nam, Singapore).

### Câu hỏi 3: Cách chia file dữ liệu và kích thước?
- **Mục tiêu:** Tải trang tức thì, dữ liệu ban đầu < 40 KB gzip, không gây nghẽn network bằng hàng trăm request nhỏ.
- **Cấu trúc phân bổ:**
  - `meta.json` (~18 KB gzip): Danh sách toàn bộ ~234 thực thể (34 tỉnh VN + ~200 quốc gia). Gồm: `id`, `name` (tiếng Việt), `enName`, `type` (`vn-province` | `country`), `area` (km²), `bbox` [minX, minY, maxX, maxY], `searchTerms` (tên không dấu để tìm kiếm tức thì).
  - `default-shapes.json` (~12 KB gzip): Chứa sẵn SVG path toạ độ km của **Lâm Đồng**, **Bỉ**, và **Việt Nam toàn quốc**. Được nạp tĩnh ngay lúc load trang $\rightarrow$ vẽ bàn làm việc ngay lập tức không cần đợi fetch.
  - `shapes-vn.json` (~55 KB gzip): Toàn bộ 34 tỉnh thành Việt Nam. Nạp lười (`preload` khi idle hoặc khi người dùng focus vào ô tìm kiếm).
  - `shapes-world-popular.json` (~75 KB gzip): ~50 quốc gia phổ biến hay được so sánh (Mỹ, Nga, Trung Quốc, Nhật Bản, Pháp, Đức, Anh, Hàn Quốc, Thái Lan, Lào, Campuchia, Singapore, Úc...).
  - `shapes-world-other.json` (~90 KB gzip): Các quốc gia còn lại, chỉ fetch khi người dùng tìm kiếm đến.
- **Định dạng path:** Toạ độ km tương đối, làm tròn đến số nguyên hoặc 0.5 km (với quy mô địa lý, sai số 0.5 km là hoàn toàn mắt thường không thấy được, nhưng giảm 65% dung lượng file text so với toạ độ float).

### Câu hỏi 4: Cấu trúc code: Route, Component, Pointer Events?
- **Đường dẫn URL & Thư mục:**
  - URL chuẩn: `/to-co-nao` (ngắn gọn, trực diện, đúng tinh thần neal.fun: `neal.fun/deep-sea`, `neal.fun/size-of-space`).
  - Trang chính: `src/pages/to-co-nao/index.astro` (dùng `ExploreLayout`).
  - Khối mã nguồn: `src/explore/to-co-nao/`.
- **Cấu trúc Svelte:**
  - **MỘT Svelte island chính** (`ToCoNao.svelte`, `client:load`) bao bọc toàn bộ canvas để quản lý state tập trung (vị trí, góc xoay, lựa chọn, zoom).
  - Tách thành các component con bên trong thư mục:
    - `Canvas.svelte`: Quản lý toạ độ không gian, pan, zoom, scale bar.
    - `ShapeItem.svelte`: Đại diện cho một hình (kéo, xoay, click, outline).
    - `SearchBar.svelte`: Ô tìm kiếm nhanh không dấu, autocomplete.
    - `BottomBar.svelte`: Thanh so sánh diện tích, preset, chia sẻ, xuất ảnh.
- **Kéo thả:** **Dùng Pointer Events thuần (Không thư viện ngoài).**
  - Sử dụng API chuẩn: `setPointerCapture`, `onpointerdown`, `onpointermove`, `onpointerup`.
  - Hỗ trợ tốt đồng thời chuột máy tính, bút cảm ứng và đa điểm di động mà không cần thêm bất kỳ dependency nào.

### Câu hỏi 5: Trợ năng (Accessibility - a11y) cho thao tác kéo thả?
- **Giải pháp bàn phím:**
  - Mỗi hình trên bàn là một phần tử có thể focus (`tabindex="0"`, `role="region"`, `aria-label="Hình tỉnh/quốc gia [Tên], diện tích [X] km²"`).
  - Khi một hình đang được focus:
    - `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`: Dịch chuyển hình 10km (giữ `Shift`: dịch 50km).
    - Phím `[` / `]` hoặc `R` / `Shift+R`: Xoay hình từng nấc 15°.
    - Phím `Delete` / `Backspace`: Xoá hình khỏi bàn.
    - Phím `C` (Center): Căn trùng tâm với hình chọn trước đó.
  - Ô tìm kiếm `SearchBar`: Tuân thủ chuẩn ARIA Combobox (`role="combobox"`, phím mũi tên lên/xuống để duyệt gợi ý, `Enter` để thêm hình).
  - Vùng thông báo ẩn `aria-live="polite"`: Tự động đọc câu thông báo khi vị trí thay đổi hoặc tỷ lệ so sánh cập nhật (VD: *"Đã thêm Bỉ vào bàn. Lâm Đồng to gấp 1,6 lần Bỉ"*).

---

## 3. Rủi ro kỹ thuật & Cách phòng tránh

| Rủi ro kỹ thuật | Mức độ | Nguyên nhân | Giải pháp phòng tránh triệt để |
| :--- | :---: | :--- | :--- |
| **1. Giật lag (Drop FPS) khi kéo thả SVG nhiều đỉnh** | **Cao** | Kéo thả trực tiếp các thẻ `<path>` phức tạp trên mobile khiến trình duyệt recalculate style và repaint liên tục. | - **Transform cấp phần cứng (GPU):** Di chuyển và xoay toàn bộ bằng CSS `transform: translate3d(x, y, 0) rotate(θdeg)` trên thẻ `<g>` cha; tuyệt đối không tính toán lại chuỗi toạ độ `d` của path trong lúc kéo.<br>- **Tối ưu số đỉnh:** Dùng `mapshaper` lúc build để giản lược (visvalingam), khống chế mỗi hình $\le$ 300–500 điểm.<br>- **Tắt hit-testing tạm thời:** Khi đang kéo một hình, đặt `pointer-events: none` cho các hình khác để giảm tải xử lý sự kiện. |
| **2. Sai lệch diện tích & Biến dạng hình dáng** | **Trung bình** | Sử dụng sai hệ chiếu phẳng toàn cầu (Mercator làm phình cực, Mollweide méo góc). | - **Phép chiếu Lambert Azimuthal Equal-Area (LAEA) cục bộ:** Chiếu riêng từng hình với tâm quay `rotate([-lng0, -lat0])` đặt tại chính centroid của hình đó.<br>- Xuất toạ độ phẳng chuẩn hoá theo đơn vị **km** ($1\text{ unit} = 1\text{ km}$). Kích thước 100km của Lâm Đồng sẽ trùng khớp $100\%$ với 100km của Bỉ, Nga hay Canada. Client chỉ việc scale đồng nhất. |
| **3. Chủ quyền Hoàng Sa & Trường Sa trong dữ liệu quốc tế** | **NGHIÊM TRỌNG** | Nguồn Natural Earth Admin 0 phân loại 2 quần đảo là vùng tranh chấp, hoặc polygon của các nước lân cận (TQ, Philippines...) có thể bao gồm đảo của VN. | - **Việt Nam & 34 tỉnh:** Dùng nguồn [Free-GIS-Data/nguyenduy1133](file:///D:/Neal/scripts/build-map.mjs) (đã kiểm chứng ở Mùa Hoa Việt, chứa đầy đủ Hoàng Sa thuộc Đà Nẵng, Trường Sa thuộc Khánh Hoà).<br>- **Lọc dữ liệu Natural Earth lúc build:** Viết hàm cắt bỏ (clip/exclude) mọi đảo nằm trong toạ độ biển Việt Nam ($\text{lng}: 109.0^\circ \to 119.0^\circ\text{E}, \text{lat}: 6.0^\circ \to 18.0^\circ\text{N}$) khỏi polygon của Trung Quốc, Philippines, Malaysia, Brunei.<br>- **Kiểm duyệt tự động:** Script build sẽ assert kiểm tra không còn toạ độ lạ của nước khác trong vùng biển chủ quyền VN.<br>- Ghi chú nguồn ranh giới trang trọng ở chân trang. |
| **4. Tên nước tiếng Việt không chuẩn xác** | **Thấp** | Trường `NAME_VI` trong Natural Earth thường thiếu hoặc dịch máy ngô nghê. | - Xây dựng bảng tra cứu (mapping dictionary) `ISO_A3` $\rightarrow$ `Tên tiếng Việt chuẩn` dựa theo chuẩn Bộ Ngoại giao / Tổng cục Thống kê (vd: *Séc, Hàn Quốc, Bờ Biển Ngà, Triều Tiên, Hà Lan...*).<br>- Hỗ trợ bộ từ khoá tìm kiếm không dấu phong phú trong `meta.json`. |
| **5. Dung lượng dữ liệu phình to** | **Trung bình** | Xuất GeoJSON thô cho hơn 200 quốc gia có thể nặng > 15 MB. | - Loại bỏ cấu trúc GeoJSON cồng kềnh; chỉ xuất mảng SVG path dồn toạ độ km.<br>- Làm tròn số toạ độ đến 0.5 km.<br>- Nén gzip/brotli qua Cloudflare CDN (đạt tỉ lệ nén > 80%). |

---

## 4. Kế hoạch chia bước code & Danh sách file

### Danh sách file dự kiến
```text
scripts/
  └── build-size-data.mjs            # Pipeline tải Natural Earth + 34 tỉnh, lọc chủ quyền, chiếu LAEA, xuất SVG km
src/
  ├── data/
  │   └── pages.json                 # Đăng ký trang to-co-nao (status: draft)
  ├── pages/
  │   └── to-co-nao/
  │       └── index.astro            # Khung Astro dùng ExploreLayout, meta SEO, OG tags
  └── explore/
      └── to-co-nao/
          ├── types.ts               # Định nghĩa kiểu dữ liệu (EntityMeta, ShapeData, PlacedShape, Viewport)
          ├── math.ts                # Toán toạ độ km, ma trận transform, bounding box, fit-view, tỉ lệ so sánh
          ├── math.test.ts           # Vitest kiểm tra logic tính toán, tỉ lệ, URL state
          ├── dataLoader.ts          # Module nạp lười và cache shapes
          ├── ToCoNao.svelte         # Island Svelte chính điều phối state và tương tác
          ├── Canvas.svelte          # Khung nhìn vô cực, pan/zoom, vẽ lưới và thước đo
          ├── ShapeItem.svelte       # Một mảnh bản đồ SVG: kéo thả, xoay, focus, outline viền
          ├── SearchBar.svelte       # Ô tìm kiếm thực thể, autocomplete tiếng Việt không dấu
          ├── BottomBar.svelte       # Thanh hiển thị tỉ lệ diện tích, preset, nút ngẫu nhiên, xuất ảnh
          ├── ExportCard.ts          # Tiện ích render Canvas 1200x630 thành ảnh PNG chia sẻ
          └── data/
              ├── meta.json          # Danh mục tên, diện tích, bbox, search tags (~18 KB)
              ├── default.json       # Shapes mặc định: Lâm Đồng, Bỉ, Việt Nam (~12 KB)
              ├── shapes-vn.json     # Shapes 34 tỉnh thành Việt Nam (~55 KB)
              ├── shapes-popular.json# Shapes ~50 quốc gia phổ biến (~75 KB)
              └── shapes-other.json  # Shapes các quốc gia còn lại (~90 KB)
public/
  ├── cards/to-co-nao.webp           # Ảnh thẻ trang chủ (500x320)
  └── og/to-co-nao.webp              # Ảnh Open Graph mặc định (1200x630)
```

---

### Kế hoạch các bước thực hiện (Mỗi bước kiểm tra độc lập được)

#### Bước 1: Xây dựng pipeline dữ liệu bản đồ (`scripts/build-size-data.mjs`)
- Viết script tải dữ liệu Natural Earth 1:50m và kết hợp `Provinces.geojson` (34 tỉnh hậu 2025).
- Lọc triệt để chủ quyền: bảo toàn Hoàng Sa (Đà Nẵng), Trường Sa (Khánh Hoà); loại bỏ toàn bộ đa giác trong vùng toạ độ biển Đông khỏi các quốc gia khác.
- Chiếu LAEA cục bộ từng thực thể theo centroid đưa về toạ độ km phẳng; tính diện tích chuẩn bằng `d3.geoArea`.
- Xuất dữ liệu ra `src/explore/to-co-nao/data/`: `meta.json`, `default.json`, các chunk shapes.
- **Tiêu chí nghiệm thu (Test):** Chạy `node scripts/build-size-data.mjs` thành công; tổng dung lượng các file JSON < 250 KB; diện tích Lâm Đồng ~ 10.373 km², Bỉ ~ 30.688 km²; không có lỗi thiếu đảo chủ quyền.

#### Bước 2: Module toán học & nạp dữ liệu (Kiểm thử với Vitest)
- Tạo `types.ts`, `math.ts`, `dataLoader.ts`.
- Viết `math.test.ts`: kiểm tra hàm tính tỉ lệ diện tích, tính bounding box của nhiều hình, ma trận toạ độ màn hình $\leftrightarrow$ toạ độ km, serialize/deserialize trạng thái URL (`?h=lam-dong:0:0:0,BEL:100:50:45`).
- **Tiêu chí nghiệm thu (Test):** Chạy `npx vitest run src/explore/to-co-nao/math.test.ts` pass 100%.

#### Bước 3: Canvas tương tác cơ bản (Render 2 hình & Kéo thả Pointer Events)
- Dựng `Canvas.svelte` và `ShapeItem.svelte`.
- Hiển thị cặp mặc định (Lâm Đồng & Bỉ). Hỗ trợ kéo thả mượt mà bằng Pointer Events (`setPointerCapture`).
- Thước tỉ lệ km ở góc dưới tự nhảy vạch theo độ zoom.
- Pan & zoom bàn làm việc bằng chuột và cảm ứng 2 ngón.
- **Tiêu chí nghiệm thu (Test):** Kéo thả mượt mà 60fps trên DevTools mobile giả lập 375px; không bị cuộn trang ngoài ý muốn (`touch-action: none`).

#### Bước 4: Thao tác xoay hình & Trợ năng bàn phím
- Bổ sung thao tác xoay: chụm 2 ngón xoay trên mobile; handle xoay tròn / con lăn Shift trên desktop.
- Hỗ trợ đầy đủ phím tắt a11y: phím mũi tên dịch chuyển, `[` `]` xoay, `Delete` xoá, `C` căn tâm.
- Thêm đường viền nét tương phản (outline highlight) khi một hình được chọn hoặc khi 2 hình đè lên nhau.
- **Tiêu chí nghiệm thu (Test):** Xoay hình 360° trơn tru; dùng hoàn toàn bàn phím để di chuyển và xoay hình chuẩn xác.

#### Bước 5: Tìm kiếm thực thể & Preset kèo so sánh
- Dựng `SearchBar.svelte`: tìm kiếm fuzzy không dấu theo tên tỉnh / nước, tải lười chunk tương ứng khi thêm hình.
- Đặt giới hạn tối đa 6 hình trên bàn để giữ hiệu năng di động tối ưu.
- Bổ sung các chip "Kèo kinh điển" (Việt Nam vs Nhật Bản, Phú Quốc vs Singapore, Nghệ An vs Slovenia...) và nút "Ngẫu nhiên".
- Thêm hình mới tự động kích hoạt tính năng Fit-Bounds (zoom bao quát).
- **Tiêu chí nghiệm thu (Test):** Gõ tìm kiếm tiếng Việt không dấu phản hồi < 16ms; bấm chip đổi kèo lập tức hiển thị đúng hình.

#### Bước 6: Thanh so sánh diện tích, Xuất ảnh chia sẻ & URL state
- Dựng `BottomBar.svelte`: hiển thị câu số liệu so sánh diện tích giữa 2 hình đang chọn.
- Đồng bộ URL hai chiều (`history.replaceState` lưu danh sách hình, vị trí, góc xoay). Mở link chia sẻ tải lại đúng nguyên trạng bàn.
- Viết `ExportCard.ts`: render canvas ra ảnh PNG đẹp mắt, gắn nút chia sẻ/tải ảnh.
- **Tiêu chí nghiệm thu (Test):** Bấm "Chia sẻ" copy link, mở tab ẩn danh hiện đúng bố cục; xuất ảnh PNG rõ nét, đúng tỷ lệ.

#### Bước 7: Khung trang Astro, SEO, Đăng ký danh mục & Kiểm tra Lighthouse
- Tạo `src/pages/to-co-nao/index.astro`, nối vào `src/data/pages.json` (status: `draft`).
- Tạo ảnh thẻ `public/cards/to-co-nao.webp` và ảnh `public/og/to-co-nao.webp`.
- Tôn trọng `prefers-reduced-motion` khi zoom và chuyển cảnh.
- **Tiêu chí nghiệm thu (Test):** `npm run build` không có cảnh báo hay lỗi; chạy Lighthouse đạt điểm $\ge 90$ ở cả 4 hạng mục trên di động.
