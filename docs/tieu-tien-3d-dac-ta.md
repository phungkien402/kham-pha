# /tieu-tien — sân khấu 3D kiểu neal.fun "Spend $1 trillion" (Kiên gửi ảnh mẫu 29/10 13:41)

## Mẫu cần đạt
- Bố cục: số dư lớn giữa trên ("903.232 tỷ đ còn lại" + "Bạn đã tiêu X / 903.232 tỷ"), nút Căn giữa, Chia sẻ; bên phải là thanh "Mua sắm" cuộn dọc (thẻ ảnh 3D nhỏ, tên, giá, Mua/Bán, nút ×10 ×100 ×1.000); ở giữa là SÂN KHẤU 3D góc nhìn isometric: mỗi món đã mua hiện thành một lưới các mô hình 3D xếp hàng (số lượng thật, có giới hạn hiển thị), dưới mỗi cụm có nhãn "100 xe buýt (15 tỷ đ)". Zoom +/−, kéo để xoay/dịch nhẹ.
- Mobile: sân khấu ở trên (≈ 50svh), thanh mua sắm ở dưới cuộn được.

## Kỹ thuật (site là Svelte 5 — KHÔNG dùng React/R3F/Drei)
- Dùng **three** (npm) trực tiếp trong component Svelte, import động (chỉ tải khi vào /tieu-tien) để không làm chậm trang khác. Không cần Rapier/postprocessing/howler/ffmpeg.
- Camera OrthographicCamera isometric; ánh sáng hemisphere + directional, bóng đổ mềm nhẹ (hoặc bóng giả bằng decal tròn để nhẹ).
- InstancedMesh cho mỗi loại món: hiển thị tối đa ~400 bản/cụm; vượt thì hiển thị 400 + nhãn "×N". Cụm xếp lưới chữ nhật gần vuông, các cụm xếp từ trái sang phải, camera tự fit (nút "Căn giữa").
- Món mới mua: các bản rơi/nảy vào chỗ (tween ngắn), reduced-motion thì hiện ngay.
- Mô hình: ưu tiên bộ low-poly **CC0** (Kenney: car kit, city kit, food kit…; Quaternius; Poly Pizza chỉ lấy model CC0) — tải về public/tieu-tien/models/*.glb, nén nhỏ (gltf-transform/meshopt nếu tiện), ghi giấy phép vào public/tieu-tien/models/LICENSES.md. Món không có model phù hợp (metro, sân bay, cao tốc, cầu, bệnh viện, trường…) → dựng low-poly bằng primitive của three (hộp/trụ, màu phẳng) có kích thước tương đối hợp lý; công trình lớn chỉ hiện 1 mô hình to + nhãn.
- Không dùng logo/thương hiệu trên model (xe máy/ô tô dùng model chung, không phải VinFast/Honda thật).
- Hiệu năng: tổng tam giác < ~300k, pixelRatio ≤ 2, dừng render khi tab ẩn / không thay đổi; Lighthouse trang ≥ 80 (mobile) — nếu WebGL không có thì rơi về giao diện thẻ 2D hiện tại.
- Giữ nguyên dữ liệu vat-pham.json, logic mua/bán/mốc %/hoá đơn hiện có (chỉ đổi giao diện), giữ miễn trừ.
- Gộp thẻ mốc %: khi một lần mua vượt nhiều mốc, chỉ hiện thẻ của mốc cao nhất.

## Test
- Hàm thuần: bố cục lưới (n → hàng/cột, vị trí), giới hạn hiển thị 400, vị trí các cụm không chồng nhau, fit camera bao trọn cụm, gộp mốc %. Test cũ vẫn qua.
