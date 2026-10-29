# Ý kiến ChatGPT — lõi trò chơi “Khám Phá”

## 1. Luận điểm và hướng chọn

- Ý tưởng có sức hút vì biến một con số rất trừu tượng thành những quyết định quen thuộc ở Việt Nam; đừng biến nó thành bài kiểm tra kiến thức tài chính hay lời bình về một cá nhân.
- Điểm khác biệt tốt nhất so với bản gốc là **quy mô và hệ quả**: một món nhỏ cho cảm giác “mua đã tay”, các mốc lớn cho thấy cùng số tiền ấy có thể là bao nhiêu năm lương, suất học, hoặc hạ tầng.
- Cần nói chính xác: đây là mô phỏng trên **ước tính tài sản ròng công khai**, không phải tiền mặt, tài khoản, hay khả năng chi tiêu thật của bất kỳ ai.
- Khuyến nghị tên an toàn nhất: **“Bạn sẽ phân bổ tài sản của một tỷ phú Việt Nam ra sao?”**. Nếu cần SEO/tên riêng, dùng phụ đề “Mô phỏng theo ước tính tài sản ròng công khai của Phạm Nhật Vượng, chụp ngày …”, không dùng lối sở hữu “tiền của ông…”.

## 2. Vòng lặp chơi và cơ chế gợi tò mò

1. Người chơi nhận một ngân sách cố định, có ngày chụp dữ liệu và tỷ giá cố định; thấy ngay “1% ngân sách = bao nhiêu đồng”.
2. Họ mua/bán nhanh các món nhỏ. Mỗi lần mua hiện một so sánh ngắn, ví dụ “bằng khoảng X bữa phở”, chỉ khi phép tính có nguồn giá cùng snapshot.
3. Khi tổng chi vượt các ngưỡng 0,01% / 0,1% / 1% / 10%, mở “thẻ góc nhìn” và thử thách mới; không khóa vật phẩm hay ép xem nội dung.
4. Họ tự đặt mục tiêu: “chi vừa đủ 1 tỷ”, “xây một tổ hợp”, “để lại 10%”, hoặc “đưa số dư về 0”. Mục tiêu tạo replay nhưng không chấm đạo đức đúng/sai.
5. Cuối lượt, hoá đơn kể một câu chuyện trung tính: cơ cấu chi theo nhu cầu cá nhân / nhà ở / giao thông / dự án cộng đồng / hạ tầng; cho phép chơi lại bằng một mục tiêu khác.

### Cơ chế cụ thể nên có

- **Thanh tốc độ tiêu**: quy đổi số dư còn lại thành thời gian nếu chi 1 triệu, 100 triệu, hoặc 1 tỷ VND mỗi giây. Chỉ là phép chia, ghi rõ giả định; không ám chỉ nhịp chi tiêu thật.
- **So sánh có ngữ cảnh**: mỗi vật phẩm chỉ có 1–2 “đơn vị so sánh” đã biên tập, ưu tiên giá trị tiền tệ hơn các tuyên bố xã hội dễ gây tranh cãi.
- **Bộ sưu tập quy mô**: mua đủ một dải (bữa ăn → xe → nhà → công trình) sẽ mở nhãn “nhìn thấy khoảng cách quy mô”, không có điểm, bảng xếp hạng, hay phần thưởng khoe tiêu nhiều.
- **Kế hoạch đối nghịch**: một nút lưu tối đa ba “hoá đơn” cục bộ để đặt cạnh nhau: “trải nghiệm”, “tài sản”, “cộng đồng”. Không lưu máy chủ mặc định.
- **Kết thúc mềm**: số dư bằng 0 mở trang tổng kết và nút “hoàn tác món cuối”; không làm hiệu ứng phá sản, chiến thắng, hoặc chế giễu.
- **Tính toán quyết định**: dùng số nguyên VND; mọi nút mua kiểm tra `quantity × price <= balance`; bán hoàn đúng giá snapshot để không biến thành mô phỏng đầu tư.

## 3. Danh mục đề xuất: 35 món, tăng dần

Ký hiệu †: giá biến động mạnh, phụ thuộc địa phương/cấu hình, hoặc tổng mức đầu tư dễ gây tranh luận; phải ghi phạm vi, ngày chụp và nguồn ngay trong chi tiết món.

| # | Món | Giá tham khảo | Loại nguồn cần kiểm chứng |
|---:|---|---:|---|
| 1 | Ly trà đá | khoảng 5.000 VND | khảo sát thực đơn quán, 3 thành phố |
| 2 | Bánh mì thịt | khoảng 25.000 VND | thực đơn chuỗi/quán địa phương |
| 3 | Cà phê sữa đá | khoảng 30.000 VND | thực đơn chuỗi/quán địa phương |
| 4 | Một bát phở | khoảng 50.000 VND | thực đơn chuỗi/quán địa phương |
| 5 | Vé xem phim 2D | khoảng 100.000 VND | bảng giá rạp chính thức |
| 6 | Vé tàu/xe liên tỉnh ngắn † | khoảng 200.000 VND | biểu giá nhà vận tải, tuyến/ngày cụ thể |
| 7 | Vé máy bay HN–TP.HCM một chiều † | khoảng 1.200.000 VND | website hãng, hạng vé và ngày tìm kiếm |
| 8 | Gói internet gia đình một tháng | khoảng 250.000 VND | bảng cước nhà mạng |
| 9 | Điện thoại phổ thông | khoảng 1.500.000 VND | giá niêm yết nhà bán lẻ |
| 10 | Xe đạp điện | khoảng 8.000.000 VND | giá hãng/đại lý |
| 11 | Laptop học tập | khoảng 15.000.000 VND | giá niêm yết nhà bán lẻ |
| 12 | Máy giặt phổ thông | khoảng 8.000.000 VND | giá niêm yết nhà bán lẻ |
| 13 | Học phí đại học công lập một năm † | khoảng 25.000.000 VND | đề án học phí trường, năm học |
| 14 | Xe máy Honda Vision | khoảng 40.000.000 VND | giá đề xuất hãng, chưa lăn bánh |
| 15 | Điện thoại cao cấp | khoảng 30.000.000 VND | giá niêm yết hãng/đại lý |
| 16 | Học phí đại học công lập bốn năm † | khoảng 100.000.000 VND | đề án học phí, nêu ngành/trường |
| 17 | Ô tô cũ hạng A | khoảng 250.000.000 VND | báo giá sàn xe cũ, tháng chụp |
| 18 | VinFast VF 3 | khoảng 285.000.000 VND | bảng giá VinFast chính thức |
| 19 | Một lô đất nông thôn nhỏ † | khoảng 500.000.000 VND | dữ liệu giao dịch/đơn vị địa phương; nêu tỉnh, diện tích |
| 20 | Căn hộ 1 phòng ngủ tỉnh/thành nhỏ † | khoảng 1.200.000.000 VND | báo cáo thị trường, dự án và thời điểm |
| 21 | VinFast VF 8 | khoảng 900.000.000 VND | bảng giá VinFast chính thức |
| 22 | VinFast VF 9 | khoảng 1.350.000.000 VND | bảng giá VinFast chính thức |
| 23 | Căn hộ 2 phòng ngủ Hà Nội/TP.HCM † | khoảng 3.500.000.000 VND | báo cáo thị trường, quận và dự án |
| 24 | Nhà phố ngoại thành † | khoảng 6.000.000.000 VND | báo cáo thị trường, vị trí/diện tích |
| 25 | Biệt thự nghỉ dưỡng † | khoảng 20.000.000.000 VND | bảng hàng dự án, không dùng giá rao cá nhân |
| 26 | Một trường mầm non tư thục quy mô nhỏ † | khoảng 30.000.000.000 VND | suất vốn đầu tư/thiết kế, nêu phạm vi đất–xây–thiết bị |
| 27 | Một cửa hàng tiện lợi nhượng quyền † | khoảng 2.000.000.000 VND | công bố nhượng quyền, bao gồm/loại trừ gì |
| 28 | Xe buýt điện thành phố | khoảng 3.000.000.000 VND | hồ sơ mua sắm/công bố nhà sản xuất |
| 29 | Một cầu dân sinh nhỏ † | khoảng 10.000.000.000 VND | quyết định đầu tư hoặc hồ sơ dự án |
| 30 | Trạm y tế xã mới † | khoảng 20.000.000.000 VND | quyết định đầu tư, quy mô công trình |
| 31 | Trường phổ thông vùng cao † | khoảng 50.000.000.000 VND | quyết định đầu tư, số phòng/chức năng |
| 32 | Bệnh viện huyện quy mô nhỏ † | khoảng 500.000.000.000 VND | quyết định đầu tư, giường bệnh/phạm vi |
| 33 | Sân vận động cấp tỉnh † | khoảng 1.500.000.000.000 VND | quyết định đầu tư; không dùng con số tin đồn |
| 34 | Một tàu bay Airbus A321neo † | khoảng 3.300.000.000.000 VND | giá công bố/hợp đồng công khai, tỷ giá snapshot |
| 35 | Tuyến metro Bến Thành–Suối Tiên † | khoảng 44.000.000.000.000 VND | quyết định điều chỉnh tổng mức đầu tư của cơ quan có thẩm quyền |

Ghi chú biên tập: mục 12 cần đặt trước mục 11 nếu giữ đúng giá; khi nhập dữ liệu thực tế, hệ thống phải tự sắp theo `price` thay vì tin thứ tự bản thảo. Các món 26–35 là **tổng vốn tham khảo**, không phải “mua được ngay”; mỗi thẻ phải nêu năm, phạm vi, vốn gồm những gì và liên kết nguồn.

## 4. Dữ liệu, cập nhật, và rủi ro pháp lý/đạo đức

- Chọn **snapshot có phiên bản**, không hiển thị tài sản chạy theo bot. Trang ghi rõ nguồn Forbes/công bố công khai, ngày chụp, tỷ giá USD/VND, công thức quy đổi và ngày rà soát tiếp theo.
- Bot crawl 3 lần/tuần chỉ nên tạo hàng đợi cảnh báo khi nguồn đổi giá; biên tập viên duyệt, lưu URL/bản chụp, rồi phát hành một phiên bản danh mục mới. Không crawl rồi tự xuất bản giá hay tài sản.
- Với mỗi giá, lưu `nguồn gốc`, `URL`, `ngày truy cập`, `phạm vi`, `đã gồm thuế/phí chưa`, và `mức tin cậy`. Hết hạn thì ẩn so sánh hoặc gắn “cần cập nhật”, không lặng lẽ dùng số cũ.
- Không dùng ảnh chân dung, giọng nói, chữ ký, ảnh đời tư, logo, hay nhận diện khiến người xem tưởng có hợp tác. Dùng minh hoạ nguyên gốc/biểu tượng chung; tên sản phẩm chỉ ở dạng văn bản cần thiết để định danh và có nguồn.
- Trang mở đầu và hoá đơn phải có tuyên bố: “Trò chơi minh hoạ độc lập; không liên kết, tài trợ hoặc đại diện cho cá nhân/doanh nghiệp được nhắc tới.”
- Chỉ nêu dữ kiện công khai có nguồn. Không suy đoán về tiền mặt, thuế, nợ, động cơ, đạo đức, quan hệ gia đình, hay phát ngôn; không cho người dùng nhập chú thích chia sẻ có thể bôi nhọ.
- Tránh động từ “đốt tiền”, “vung tay”, “tiền của…”. Văn phong nên là “ngân sách mô phỏng”, “phân bổ”, “ước tính”, và “khoảng”.
- Trước phát hành, pháp lý/biên tập rà tên trang, metadata chia sẻ, ảnh, nguồn giá, điều khoản thương hiệu và cơ chế gỡ/sửa nhanh. Có email liên hệ và lịch sử thay đổi công khai.
