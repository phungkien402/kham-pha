# Bước E4 — đề bài thảo luận 3 bên (Claude · ChatGPT/Codex · Antigravity)
Trang: /to-co-nao, phần đầu "Bạn nghĩ Việt Nam dài đến mức nào?" (src/explore/to-co-nao/DocVietNam.svelte, docVietNam.ts, data/doc-vn.json, data/doc-vn-anh.json, scripts/build-doc-vn.mjs, scripts/fetch-doc-vn-anh.mjs). Đặc tả trước: docs/to-co-nao-e3-dac-ta.md.
Trang thật: https://kham-pha.phungkien4002.workers.dev/to-co-nao/

## Phản hồi của Kiên (chủ dự án), 29/10 10:44
1. Ảnh bị thu nhỏ: trên màn 1883×886, ảnh trong thẻ địa danh chỉ cao ~60 px (bị ép bởi chiều cao cột trái).
2. Định vị sai vị trí một số chỗ trên bản đồ (ví dụ đảo Lý Sơn nằm ngay bờ thay vì ngoài khơi; Mỹ Sơn có vẻ lệch). Có thể phép chiếu của điểm dừng khác phép chiếu của bản đồ. Ảnh Eo Gió lại là ảnh phố Quy Nhơn — ảnh lệch địa danh.
3. Nội dung chưa thực sự thu hút, chưa gợi tò mò. Văn mô tả kiểu sách du lịch, chung chung.
Mong muốn chung: sinh động, gợi tò mò, kiểu neal.fun; tránh quá yên tĩnh.

## Câu hỏi cho mỗi bên (trả lời ngắn, cụ thể, tiếng Việt)
A. Nội dung: làm sao để mỗi điểm dừng khiến người xem muốn kéo tiếp? Đề xuất cấu trúc nội dung mới cho 1 thẻ (ví dụ: câu móc/hook dạng câu hỏi, so sánh bất ngờ với thứ quen thuộc, con số trực quan, "đoán xem" nhỏ, âm thanh/cảm giác...). Viết thử lại 3 điểm (Mã Pì Lèng, Phong Nha – Kẻ Bàng, Mũi Cà Mau) theo cấu trúc đó. Chỉ dùng sự thật phổ thông chắc chắn; không bịa số liệu.
B. Tương tác: ngoài kéo thanh trượt, thêm gì để không "yên tĩnh" mà không rối (ví dụ: dự đoán trước "bạn nghĩ Việt Nam dài bao nhiêu km?" rồi so với thực tế; điểm dừng mở dần như mở khoá; thời tiết/khí hậu đổi trực quan; tốc độ di chuyển bằng xe máy/tàu/máy bay → giờ đi...).
C. Bố cục & ảnh: cách bố trí cột trái để ảnh luôn lớn (≥ 40% chiều cao màn), thẻ không bị ép; trên mobile thì sao.
D. Kỹ thuật cho lỗi 2: cách bảo đảm điểm dừng nằm đúng chỗ (cùng hàm chiếu; test point-in-polygon tỉnh); cách bảo đảm ảnh đúng địa danh.
E. Không đồng ý điều gì với hướng hiện tại?
