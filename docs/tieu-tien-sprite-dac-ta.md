# /tieu-tien — chuyển sang 2.5D "sprite isometric" như neal.fun + toàn màn hình (Kiên 29/10 15:13)

## Claude đã soi neal.fun/spend-elon (bằng trình duyệt của Kiên)
- KHÔNG phải 3D thời gian thực. Mỗi món là ẢNH 2D dựng sẵn (pre-rendered) từ mô hình 3D ở một góc isometric cố định: `spend-elon/optimized/images/bus.webp` (khung 1536×1392, nền trong suốt) + ảnh BÓNG riêng `bus-shadow.png`, kèm `manifest.json` ghi vùng cắt {x,y,w,h} của từng ảnh trong khung.
- Vẽ lên MỘT canvas (WebGL) như các quad 2D; xếp lưới isometric, vẽ theo thứ tự từ xa tới gần (painter's order) nên nhìn như 3D. Icon nhỏ trong thanh mua là bản thu nhỏ `optimized/icons/*.webp`.

## Yêu cầu
1. **Toàn màn hình**: sân khấu chiếm full viewport (100vw × 100svh, không khung, không lề 2 bên). Số dư + "Bạn đã tiêu…" nổi ở giữa trên (overlay). Thanh "Mua sắm" là panel cố định bên phải (~380px, cuộn riêng, nền trắng, bóng nhẹ) như neal.fun. Nút Căn giữa / Chia sẻ / Hoá đơn / 2D nổi góc trên phải sân khấu. Zoom +/− góc dưới phải. Header site (Trang chủ) thu gọn thành nút nhỏ góc trên trái. Mobile: sân khấu full màn, panel mua là bottom-sheet kéo lên/xuống (mặc định ~45svh).
2. **Sprite pre-render**: script `scripts/render-sprites-tieu-tien.mjs` chạy Playwright + three (headless, trên máy dev) nạp từng .glb/mô hình primitive hiện có, camera Orthographic isometric CỐ ĐỊNH chung cho mọi món (cùng góc, cùng ánh sáng — có thêm ánh sáng viền nhẹ cho đẹp), cùng tỉ lệ thế giới → px (để kích thước tương đối giữa các món đúng thật), xuất:
   - `public/tieu-tien/sprites/<id>.webp` (nền trong suốt, cắt sát), `<id>-shadow.webp` (bóng mềm mờ trên mặt đất), `<id>-icon.webp` (96px cho panel);
   - `public/tieu-tien/sprites/manifest.json`: {id: {w,h, anchorX, anchorY (điểm chạm đất), footprintW, footprintD (ô lưới theo đơn vị thế giới)}}.
   Commit các ảnh đã render (dung lượng tổng mục tiêu ≤ 3 MB).
3. **Sân khấu 2D**: bỏ three.js khỏi runtime trang (gỡ dependency nếu không còn dùng; script render vẫn dùng ở devDependencies). Vẽ bằng Canvas 2D (hoặc WebGL thuần nếu cần cho >5.000 sprite): mỗi cụm là lưới isometric các sprite, vẽ bóng trước rồi sprite, sắp theo (row+col) tăng dần; cụm xếp NGANG trên màn hình, nhãn dưới mỗi cụm (2 dòng: "100 × Bát phở" / "4 triệu đ"), không chồng nhãn; tối đa hiển thị ~1.000 sprite/cụm, quá thì "×N"; cache mỗi cụm vào OffscreenCanvas để kéo/zoom mượt; devicePixelRatio ≤ 2.
   Kéo để dịch (pan), cuộn/pinch để zoom, nút Căn giữa fit toàn bộ. Món mới: sprite rơi nhẹ vào chỗ (reduced-motion: hiện ngay).
4. Giữ dữ liệu, logic mua/bán/mốc %/hoá đơn/miễn trừ. Chế độ "Xem thẻ 2D" giữ như cũ.
5. Test: hàm thuần bố cục isometric (chiếu lưới → px, thứ tự vẽ, cụm không chồng, nhãn không chồng, fit), manifest hợp lệ (mọi id trong vat-pham.json có sprite+shadow+icon, file tồn tại). Test cũ vẫn qua. Lighthouse trang ≥ 85.
