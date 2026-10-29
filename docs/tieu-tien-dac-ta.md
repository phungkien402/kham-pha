# Đặc tả (bản chốt sau thảo luận) — "Tiêu thử 35 tỷ USD"
Nguồn: tieu-tien-y-tuong.md (Claude), tieu-tien-y-kien-chatgpt.md (cơ chế, danh mục, rủi ro), tieu-tien-y-kien-agy.md (UI/UX).

## Tên & khung
- URL /tieu-tien. Tiêu đề Kiên chốt (29/10 12:36): **"1 ngày làm PNV"**; dòng dưới: "Bạn có 35,2 tỷ USD — tiêu thế nào?"; phụ đề: "Mô phỏng theo ước tính tài sản ròng của tỷ phú Phạm Nhật Vượng do Forbes công bố ngày 10/10/2026" (theo ChatGPT — không dùng "tiền của ông…").
- Ngân sách = snapshot cố định có ngày + tỷ giá USD/VND có ngày (file dữ liệu có phiên bản). Bot crawl chỉ báo đề xuất cập nhật, người duyệt.
- Không ảnh chân dung, không logo, không phát ngôn; dòng miễn trừ ở đầu và trên hoá đơn: "Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới."
- Văn phong trung tính: "ngân sách", "ước tính", "khoảng"; không "đốt tiền".

## Vòng chơi (giữ tối giản — theo agy)
- Mua/Bán/ô số lượng, giữ nút để mua tăng tốc, số dư sticky đếm mượt + badge −/+; tính bằng số nguyên VND; không âm.
- Thanh tốc độ: "Nếu tiêu 100 triệu mỗi giây: còn … " (phép chia, ghi giả định).
- Thẻ góc nhìn khi qua 0,01% / 0,1% / 1% / 10% (toast, không chặn).
- Kết thúc mềm khi về 0: tổng kết + "hoàn tác món cuối".
- Hoá đơn cuộn giấy, cơ cấu theo nhóm (Đời thường / Xe & nhà / Cộng đồng / Hạ tầng), xuất PNG 1200×630, Web Share.
- BỎ: lưu 3 kịch bản (agy: quá tải).

## Danh mục
- ~35 món theo bảng của ChatGPT, tự sắp theo giá. Mỗi món có: giá, đơn vị, nguồn (URL), ngày truy cập, phạm vi/ghi chú; món † hiện phạm vi & nguồn trong chi tiết. Tên sản phẩm chỉ dạng chữ.
- Claude/Claude Code sẽ tra và kiểm chứng giá từng món trước khi code (nguồn: website hãng, nhà bán lẻ, quyết định đầu tư công đăng báo).

## UI (theo agy)
- Hero không popup; lưới thẻ 3–4 cột desktop, 1 cột mobile; cụm [−][SL][+] cao ≥ 48 px; âm thanh tắt mặc định; vibrate nhẹ.
- Minh hoạ: emoji/Fluent hoặc SVG phẳng cho đồ dùng; ảnh Wikimedia (CC) cho công trình công; khung thẻ đồng bộ site.
