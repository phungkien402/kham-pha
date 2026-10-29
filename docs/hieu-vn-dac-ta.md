# Trang mới /hieu-viet-nam — "Bạn hiểu Việt Nam đến đâu?" (How Vietnamese Are You?)
Kiên chốt 29/10 17:01: theo hướng ChatGPT (trò khám phá văn hoá, không phải thước đo quốc tịch/yêu nước), làm BẢN CHỮ trước, ổn rồi mới thêm ảnh. Dữ liệu phải thật, có nguồn.

## Ngân hàng câu hỏi (src/explore/hieu-viet-nam/data/cau-hoi.json)
- 40 câu, chia đều 5 vùng: Bắc, Trung, Nam, Tây Nguyên, Biển đảo (8 câu/vùng) × 5 chủ đề: phương ngữ & cách gọi, món ăn vùng miền, phong tục & lễ hội, địa danh & địa lý, đời sống thường ngày.
- Mỗi câu: id, vung, chuDe, tinh (1 trong 34 tỉnh mới, để tô bản đồ), cauHoi, 4 lựa chọn, dapAn (chỉ số), giaiThich (1–2 câu, điều mới học được), nguon (URL thật, đọc được), ngayTruyCap.
- Chỉ câu có đáp án đúng kiểm chứng được. Không câu "bạn sẽ làm gì". Không chính trị, tôn giáo gây tranh cãi, không chế giễu vùng miền/dân tộc, không câu dựa trên ngoại hình con người. Phương ngữ: nêu là "thường dùng ở…", không tuyệt đối hoá.
- Nguồn ưu tiên: UNESCO, trang chính thức tỉnh/bộ ngành, báo chính thống, từ điển; Wikipedia tiếng Việt khi có trích dẫn.

## Cách chơi
- Màn đầu: "Bạn hiểu Việt Nam đến đâu?" + dòng phụ "How Vietnamese Are You? — một chuyến khám phá văn hoá, không phải bài kiểm tra quốc tịch".
- Mỗi lượt 12 câu bốc ngẫu nhiên, cân đối vùng. Chọn đáp án → lật ngay: đúng/sai + giải thích + link nguồn. Tỉnh của câu sáng lên trên bản đồ nhỏ (đúng: màu đậm, sai: màu nhạt "đã ghé").
- Kết quả: bản đồ 34 tỉnh đã khám phá + "Bạn đã khám phá X vùng" + 3 điều mới học (từ các câu sai/ngẫu nhiên) + danh hiệu vui không phán xét (ví dụ "Lữ khách miền Trung"). Không hiện %.
- Chia sẻ ảnh PNG 1200×630 (bản đồ + danh hiệu). Chơi lại ra bộ câu khác.
- Không lưu dữ liệu người chơi lên server.

## Kỹ thuật
- Astro + Svelte 5, bản đồ 34 tỉnh dùng lại dữ liệu to-co-nao (vn.json). Trang /hieu-viet-nam, pages.json, thẻ trang chủ, OG.
- Test: cau-hoi.json hợp lệ (40 câu, 8/vùng, 4 lựa chọn, dapAn hợp lệ, nguon https, tinh thuộc 34 tỉnh), bốc câu cân đối vùng, chấm điểm, chọn danh hiệu.
