# Trang mới: "Tiêu tiền của Phạm Nhật Vượng" (ý tưởng ban đầu của Claude)
Kiên muốn một trang tương tự neal.fun "Spend Bill Gates' Money" (bản Elon), cho site Khám Phá (Astro + Svelte 5, Cloudflare, tiếng Việt).

## Lõi (giống bản gốc)
- Đầu trang: ảnh/tên + số dư lớn dính trên cùng (sticky), bắt đầu bằng tài sản ròng theo Forbes (~35,2 tỷ USD ≈ ghi rõ "theo Forbes, ngày …", quy đổi VND theo một tỷ giá cố định có ghi ngày).
- Lưới vật phẩm: mỗi thẻ có ảnh/icon, tên, giá; nút Bán / ô số lượng / Mua. Số dư giảm/tăng, đếm mượt.
- Cuối trang: "Hoá đơn" liệt kê đã mua, tổng tiền; chia sẻ ảnh hoá đơn.
- Không thể tiêu âm; mua quá → nút mờ.

## Bản Việt hoá — vật phẩm gần gũi (giá tham khảo phải có nguồn, ghi "khoảng")
Ví dụ: ly cà phê sữa đá, bát phở, bánh mì, xe Honda Vision, iPhone, vé máy bay HN–SG, xe VinFast VF 3, VF 8/VF 9, căn hộ chung cư, biệt thự, mua cả một hòn đảo?, học phí đại học 4 năm, xây một trường học vùng cao, một cây cầu dân sinh, một bệnh viện tuyến huyện?, tàu bay A321, đội bóng V-League, sân vận động, xây một tuyến metro (Bến Thành–Suối Tiên)?, nuôi một đội tuyển... Giá công trình công lấy từ báo chí có số tổng mức đầu tư.

## Câu hỏi thảo luận
1. Cơ chế nào ngoài mua/bán để gợi tò mò hơn bản gốc? (ví dụ: "bạn tiêu hết trong bao lâu nếu mỗi giây tiêu 1 triệu", so sánh "bằng lương X người trong Y năm", thành tựu/huy hiệu, kết thúc khi hết tiền...)
2. Danh mục & thứ tự vật phẩm (nhỏ → lớn), bao nhiêu món (25–40?), nhóm theo chủ đề?
3. Rủi ro: người thật — tránh giọng chế giễu, không bịa phát ngôn, không dùng ảnh chân dung (ảnh chân dung người nổi tiếng không dùng); ghi rõ "trò chơi minh hoạ, không liên quan/không được tài trợ"; không dùng logo thương hiệu. Có nên dùng tên ông hay "tỷ phú giàu nhất Việt Nam"?
4. Dữ liệu tài sản cập nhật: cố định theo ngày hay để bot crawl định kỳ (site đã có cơ chế crawl 3 lần/tuần)?
5. UI/UX: bố cục, cảm giác "tiêu tiền đã tay", mobile.
