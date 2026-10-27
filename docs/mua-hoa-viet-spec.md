# Mùa Hoa Việt — đặc tả theo mockup

Mockup do Claude (claude.ai) vẽ và Kiên đã chốt ngày 2026-10-27. File này mô tả lại mockup để code theo; Claude Code không mở được mockup.

Màu và chữ dùng chung với web: nền `#FAF8F5`, chữ `#1F1D1A`, chữ phụ `#6B655C` / `#4A453E`, viền `#E7E2D9`, nền phụ `#EFEAE1` / `#F1ECE3` / `#F3EEE5`, font Be Vietnam Pro. Thẻ bo góc 14–20px, viền mảnh, không đổ bóng, không gradient. Mỗi loài hoa có một `color` riêng dùng cho chấm, vòng cung, dải tháng; nền ảnh tạm = `color` pha 72% với trắng.

## 1. Trang chính `/mua-hoa-viet`

Điện thoại (một cột, từ trên xuống):

1. Khung chung `ExploreLayout` (Trang chủ ← trái, Chia sẻ phải).
2. **Hero**: dòng nhỏ ngày hôm nay ("Thứ Ba, 27 tháng 10"); tiêu đề lớn 36px "N loài hoa đang nở"; một câu giới thiệu. Khi người xem chọn tháng khác: "Đang xem tháng M" / "N loài hoa nở trong tháng M".
3. **Bánh xe 12 tháng** trong thẻ trắng (chi tiết mục 3).
4. Dưới bánh xe: chú thích tên + chấm màu các loài đang nở.
5. **Hàng nút "Tháng 1" … "Tháng 12"**, cuộn ngang, nút cao ≥44px, nút đang chọn nền tối chữ sáng, `aria-pressed`.
6. **Lọc miền**: nhóm 4 nút Cả nước / Bắc / Trung / Nam dạng segmented (nền `#EFEAE1`, nút chọn nền trắng).
7. **Đang nở**: thẻ ngang — ảnh 88×88 trái; phải: tên (17px đậm), nhãn "Sắp tàn" nếu tháng đang xem là tháng cuối mùa, vùng, dải 12 ô nhỏ (ô trong mùa tô `color`, ô tháng đang xem có viền tối), dòng "Mùa nở: tháng a – tháng b". Cả thẻ là link sang trang chi tiết.
8. **Sắp nở tháng M+1**: các loài bắt đầu nở tháng sau, thẻ viền đứt, chấm tròn viền màu. Không có loài nào → một dòng thông báo.
9. **Ngắm ở đâu**: khung bản đồ (giai đoạn này là khung giữ chỗ, ghi rõ bản đồ sẽ có đủ Hoàng Sa, Trường Sa) + danh sách điểm ngắm của các loài đang nở (chấm màu, tên điểm, tên loài).
10. `NextPage` ở cuối.

Máy tính (≥1024px, nội dung tối đa 1200px):
- Hero chia 2 cột: trái = ngày, tiêu đề 56px, câu giới thiệu, 12 nút tháng xếp lưới 6 cột × 2 hàng, lọc miền, chú thích loài; phải = thẻ bánh xe rộng ~480px.
- "Đang nở": lưới `repeat(auto-fill, minmax(260px, 1fr))`, thẻ dọc, ảnh trên cao 180px.
- "Ngắm ở đâu": bản đồ lớn bên trái (flex 999 1 560px, cao ≥440px); bên phải danh sách điểm + ô "Sắp nở tháng M+1".
- Mọi thứ phải tự xuống dòng về một cột ở màn hẹp (flex-wrap), không cuộn ngang.

## 2. Trang chi tiết `/mua-hoa-viet/[slug]`

Thứ tự phần trên điện thoại (máy tính: phần đầu chia 2 cột — trái ảnh lớn 480px + 6 ảnh nhỏ; phải tên, trạng thái, số liệu, dải tháng; các phần sau trải rộng, ghép 2 cột khi hợp lý):

1. Đầu trang: điện thoại "← Mùa Hoa Việt" + Chia sẻ; máy tính breadcrumb "Trang chủ / Mùa Hoa Việt / Tên loài".
2. **Ảnh lớn** vuốt ngang (chấm chỉ số ảnh), góc ảnh ghi "Ảnh: tên người chụp".
3. **Tên** (34px / 48px), tên khoa học in nghiêng + tên gọi khác, thẻ vùng (Tây Nguyên, Đà Lạt…).
4. **Trạng thái hôm nay**: hộp nền nhạt theo màu loài, chấm màu có quầng, dòng đậm ("Đang nở · sắp vào đỉnh mùa"), dòng phụ ("Đẹp nhất khoảng giữa tháng 11, tàn dần cuối tháng 12").
5. **3 ô số liệu**: ô đầu nền tối = đếm ngược "~N ngày nữa tới đỉnh mùa" (hoặc "đang đỉnh mùa", "còn N ngày nữa nở"); 2 ô sau lấy từ `facts`.
6. **Mùa nở trong năm**: 12 ô cao 28–32px; ô đỉnh mùa màu đậm, ô đang nở màu nhạt hơn, ô xám ngoài mùa; ô tháng hiện tại có viền tối; số tháng bên dưới; chú thích Đỉnh mùa / Đang nở / Tháng này.
7. **Một ngày trên đồi …** (tương tác): khung lớn đổi màu nền theo thời điểm (chuyển màu 400ms, tắt khi reduced-motion), trên khung có nhãn thời điểm, câu tả cảnh, mô tả ảnh; 4 nút Bình minh / Sáng / Trưa / Chiều (`aria-pressed`); hộp "MẸO LÚC NÀY".
8. **Ngắm ở đâu**: bản đồ nhỏ giữ chỗ + danh sách điểm, mỗi dòng có nhãn tháng đẹp nhất.
9. **Ảnh**: lưới 2 cột, mỗi ảnh ghi người chụp; link "Xem cả N ảnh".
10. **Cách nhận ra**: 3 ý đánh số tròn.
11. **Dễ nhầm với …**: 2 cột so sánh, mỗi bên ảnh + tên + một câu.
12. **Bạn có biết?**: 3 thẻ (điện thoại cuộn ngang, máy tính lưới).
13. **Lời người chụp**: khối nền màu nhạt, ảnh tròn, câu trích lớn trong `<blockquote>`, `<figcaption>` tên · nơi · năm.
14. **Về loài hoa này** + **Mẹo đi và chụp**.
15. **Nở cùng thời điểm**: các loài có mùa giao với loài này, thẻ ảnh + tên + vùng + trạng thái.

Phần nào loài không có dữ liệu thì ẩn hẳn, không để khung trống.

## 3. Bánh xe 12 tháng

SVG viewBox `-10 -10 340 340`, tâm (160,160).

- Mỗi loài một vòng tròn đồng tâm: bán kính `r = 58 + i * 7` (i = thứ tự loài, sắp theo tháng bắt đầu), nét 5.5, đầu nét tròn. Vòng nền xám `#F1ECE3` cùng bán kính. Nhiều hơn ~12 loài thì giảm khoảng cách hoặc chỉ vẽ các loài nổi bật.
- Vòng cung của loài chạy từ đầu tháng bắt đầu đến cuối tháng kết thúc, chừa 2° mỗi đầu:
  ```js
  const pt = (r, a) => [160 + r * Math.cos(a * Math.PI / 180), 160 + r * Math.sin(a * Math.PI / 180)];
  function arc(r, s, e) {            // s, e: tháng 1–12
    let a0 = (s - 1) * 30 - 90 + 2, a1 = e * 30 - 90 - 2;
    if (e < s) a1 += 360;            // mùa vắt qua năm (12 → 2)
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  }
  ```
- Loài đang nở ở tháng đang xem: opacity 1; còn lại 0.28.
- Hình quạt nền `#F3EEE5` tô tháng đang xem (từ r=50 đến r=146).
- Nhãn T1…T12 ở r=156, giữa mỗi tháng; tháng đang xem đậm và tối.
- Kim: đường từ tâm tới r=146 + chấm tròn r=6 ở đầu kim. Tháng hiện tại → kim ở đúng ngày hôm nay (`(month - 1 + day / daysInMonth) * 30 - 90`); tháng khác → giữa tháng.
- Vòng tròn trắng r=44 ở tâm: "Tháng" + số tháng lớn.
- Kéo kim bằng chuột/ngón tay đổi tháng (pointer events); phím mũi tên trái/phải khi kim được focus cũng đổi tháng; có `role="slider"` + `aria-valuenow`/`aria-valuetext` "Tháng 10".
- Rê chuột / chạm vào một vòng cung hiện tên loài (tooltip).
- `aria-label` mô tả bánh xe cho trình đọc màn hình.

## 4. Quy tắc về "hôm nay"

Web là web tĩnh: ngày lúc build KHÔNG phải ngày người xem mở trang. Mọi thứ phụ thuộc ngày hiện tại (đang nở, sắp tàn, đếm ngược, kim bánh xe) phải tính lại ở trình duyệt theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). HTML build sẵn có thể hiển thị theo ngày build để không trống trang, rồi island cập nhật khi chạy.
