# 8 ý tưởng mới cho Khám Phá

Tiêu chí: mỗi trang phải hiểu trong vài giây, tương tác bằng một thao tác chính,
và tạo được một kết quả/ảnh chia sẻ. Các ý tưởng dưới đây không lặp lại chủ đề
hiện có: Mùa Hoa Việt, Việt Nam to cỡ nào? và 1 ngày làm PNV.

## 1. Việt Nam lúc này: Trời ở đâu đang giống chỗ bạn?

**Câu móc:** “Kéo nhiệt kế: ở Việt Nam, bạn đang có thời tiết của tỉnh nào?”

Cách chơi:

- Chọn thành phố hoặc cho phép định vị gần đúng; hiện một thẻ nhiệt độ, mưa, gió.
- Bản đồ Việt Nam tô 3 địa điểm có “cảm giác trời” gần nhất ngay lúc đó.
- Kéo thanh “ấm/lạnh”, “khô/ướt” để xem nơi phù hợp đổi ra sao.
- Chạm một nơi để xem chênh lệch hôm nay với trung bình cùng ngày trong quá khứ.
- Chia sẻ thẻ: “Hôm nay Hà Nội có cảm giác như Đà Lạt / Cà Mau”.

Dữ liệu cần + nguồn khả thi: tọa độ tỉnh/thành tự biên soạn; dự báo và lịch sử
nhiệt độ, mưa, gió từ [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
và [Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api).

Độ khó: **2/5**. Rủi ro: kết quả là mô hình khí tượng, không phải số đo trạm;
cần ghi rõ “ước tính theo lưới dữ liệu” và không biến thành cảnh báo thời tiết.

## 2. Hạt gạo này đi từ đâu?

**Câu móc:** “Một bát cơm của bạn có thể bắt đầu từ cánh đồng nào?”

Cách chơi:

- Chọn loại gạo/bữa ăn hoặc kéo một hạt gạo vào bát.
- Hạt chạy qua bản đồ từ vùng trồng lớn tới bàn ăn, kèm quãng đường thẳng minh họa.
- Bấm các vụ Đông Xuân, Hè Thu, Mùa để đổi nhịp mùa vụ và vùng nổi bật.
- So sánh sản lượng một tỉnh với số bát cơm quy đổi (nêu rõ giả định gam/bát).
- Xuất ảnh động ngắn “Bát cơm của tôi bắt đầu ở…”.

Dữ liệu cần + nguồn khả thi: sản lượng lúa, diện tích và năng suất theo địa phương
từ [Cục Thống kê – Số liệu thống kê](https://www.gso.gov.vn/so-lieu-thong-ke/);
đường, sông và vị trí bằng [OpenStreetMap](https://www.openstreetmap.org/export).

Độ khó: **3/5**. Rủi ro: không thể truy xuất nguồn gốc thật của một bát cơm;
phải gọi đây là “hành trình đại diện”, không khẳng định nguồn hàng cá nhân.

## 3. Đêm nay nhìn thấy gì?

**Câu móc:** “Từ thành phố của bạn, bao lâu nữa mới thấy trăng tròn?”

Cách chơi:

- Chọn tỉnh/thành, màn hình là bầu trời tối giản và một Mặt Trăng đúng pha.
- Vuốt thời gian để xem trăng mọc/lặn, độ sáng và pha trong 30 ngày tới.
- Bật lớp mây: “cơ hội nhìn thấy” theo dự báo mây, không hứa chắc.
- Chạm vào ngày rằm/mùng một để thấy âm lịch và tên tháng.
- Chia sẻ một tấm “Lịch ngắm trăng ở [địa điểm]”.

Dữ liệu cần + nguồn khả thi: tính pha/trăng mọc bằng thư viện thiên văn
(SunCalc/Astronomy Engine); mây và giờ mặt trời từ [Open-Meteo](https://open-meteo.com/en/docs);
quy đổi âm lịch cần bộ dữ liệu/thuật toán được kiểm thử và ghi rõ quy ước múi giờ +07:00.

Độ khó: **3/5**. Rủi ro: sai khác phút do tọa độ, chân trời và lịch âm; không dùng
cho mục đích tín ngưỡng/chuyên môn cần độ chính xác pháp lý.

## 4. Việt Nam có bao nhiêu tiếng nói?

**Câu móc:** “Chạm bản đồ để nghe Việt Nam đổi giọng.”

Cách chơi:

- Bản đồ chỉ có các chấm âm thanh; chạm một chấm phát một câu chào ngắn.
- Đoán vùng trước khi lật đáp án; mỗi lượt chỉ 5–10 giây.
- So sánh một từ quen thuộc (ví dụ “mẹ”, “ăn cơm”) giữa các biến thể được cấp phép.
- Mở “đường nghe” 5 chặng Bắc–Trung–Nam, không xếp hạng giọng nào chuẩn hơn.
- Chia sẻ kết quả “Tôi đoán đúng 4/5 giọng”.

Dữ liệu cần + nguồn khả thi: danh sách ngôn ngữ/dân tộc từ ấn phẩm điều tra của
[Cục Thống kê](https://www.gso.gov.vn/dan-so/); âm thanh phải xin phép/thu mới
với giấy đồng ý rõ ràng, hoặc dùng kho CC có lưu giấy phép từng tệp.

Độ khó: **4/5**. Rủi ro: dễ củng cố định kiến vùng miền và vướng bản quyền/đồng ý
ghi âm; cần biên tập với người bản địa, nhãn nguồn, cơ chế gỡ nội dung.

## 5. Bạn đang cách biển bao xa?

**Câu móc:** “Từ chỗ bạn đứng, một con chim bay bao xa mới chạm biển?”

Cách chơi:

- Nhập địa danh hoặc chạm vào bản đồ Việt Nam.
- Một đường thẳng vẽ tới điểm bờ biển gần nhất, hiện km và hướng la bàn.
- Kéo điểm xuất phát để thấy con số thay đổi tức thì.
- Đổi sang “đi bộ/lái xe” chỉ khi có bộ định tuyến; mặc định là khoảng cách chim bay.
- Chia sẻ thẻ có đường kẻ và câu “Tôi cách biển … km”.

Dữ liệu cần + nguồn khả thi: đường bờ biển và địa danh từ [OpenStreetMap](https://www.openstreetmap.org/export)
(ODbL); biên giới nền từ [Natural Earth](https://www.naturalearthdata.com/downloads/).

Độ khó: **2/5**. Rủi ro: bờ biển, đảo và cửa sông khiến khái niệm “gần nhất” mơ hồ;
hiển thị định nghĩa rõ, cho chọn “đất liền” hoặc “kể cả đảo”.

## 6. Săn di sản trong 60 giây

**Câu móc:** “Bạn có nhận ra một mảnh Việt Nam trước khi đồng hồ về 0?”

Cách chơi:

- Mỗi lượt hiện một chi tiết đã cắt: kiến trúc, nhạc cụ, bản đồ hoặc mô tả ngắn.
- Người chơi chạm đoán địa điểm/di sản trên bản đồ.
- Lật đáp án với 2–3 fact đã kiểm chứng và liên kết đọc thêm.
- Chuỗi 5 câu tạo một huy hiệu chia sẻ, không có bảng xếp hạng áp lực.
- Cho chế độ “không ảnh” để vẫn chơi được bằng chữ và âm thanh.

Dữ liệu cần + nguồn khả thi: danh mục và mô tả từ [UNESCO World Heritage – Việt Nam](https://whc.unesco.org/en/statesparties/vn/)
và [UNESCO Intangible Heritage – Việt Nam](https://ich.unesco.org/en/state/viet-nam-VN?cp=VN&info=elements-on-the-lists&topic=fr-etat);
ảnh/âm thanh chỉ dùng tài sản tự có hoặc giấy phép rõ ràng.

Độ khó: **2/5**. Rủi ro: ảnh trên web không mặc nhiên được tái sử dụng; tránh biến
di sản thành câu đố phiến diện, thêm bối cảnh và nguồn ở mỗi đáp án.

## 7. Con sông qua tỉnh nào?

**Câu móc:** “Kéo một giọt nước: nó sẽ đi qua bao nhiêu nơi trước khi ra biển?”

Cách chơi:

- Chọn một sông lớn từ danh sách hoặc chạm lên đường sông.
- Giọt nước chạy theo một tuyến đã biên tập, từng chặng hiện tỉnh/thành đi qua.
- Dừng ở mỗi chặng để so diện tích, dân số hoặc một sự thật ngắn có nguồn.
- Mini-game: đoán cửa biển trước khi giọt đến nơi.
- Chia sẻ tuyến “Tôi đã theo dòng … qua … chặng”.

Dữ liệu cần + nguồn khả thi: hình học sông và biên giới từ [Geofabrik/OpenStreetMap](https://download.geofabrik.de/asia/vietnam.html);
dân số, diện tích địa phương từ [Cục Thống kê](https://www.gso.gov.vn/dan-so/).

Độ khó: **3/5**. Rủi ro: sông có nhánh, ranh giới hành chính thay đổi và OSM có thể
thiếu/khác tên; khởi đầu chỉ với 5–8 tuyến đã kiểm duyệt thủ công.

## 8. Một phút im lặng ở Việt Nam

**Câu móc:** “Ở nơi nào trong Việt Nam, một phút nghe sẽ khác hẳn?”

Cách chơi:

- Chọn cảnh: chợ sớm, mưa mái tôn, ruộng, ngõ, biển, phố đêm.
- Trình phát là một vòng nghe 20–60 giây với hoạt ảnh cực tối giản.
- Người nghe chọn 1–2 từ mô tả; cuối phiên tạo “bưu thiếp âm thanh”.
- Bật phụ đề/transcript và điều khiển giảm chuyển động để dễ tiếp cận.
- Chia sẻ liên kết đúng thời điểm phát, không tự phát âm thanh khi mở trang.

Dữ liệu cần + nguồn khả thi: bộ ghi âm gốc có mẫu đồng ý, tọa độ được làm mờ;
metadata địa danh kiểm tra bằng [OpenStreetMap](https://www.openstreetmap.org/export).

Độ khó: **3/5**. Rủi ro: quyền riêng tư (giọng người, biển số, hội thoại), bản quyền
và dung lượng; chỉ công bố clip đã biên tập/đồng ý, dùng CDN và định dạng nén.

## Top 3 nên làm trước

1. **Việt Nam lúc này: Trời ở đâu đang giống chỗ bạn?** — vòng tương tác cực ngắn,
   dữ liệu API sẵn có, mỗi ngày một kết quả mới và thẻ chia sẻ tự nhiên.
2. **Bạn đang cách biển bao xa?** — một thao tác, một con số gây tò mò, có thể làm
   gần như hoàn toàn trên client với dữ liệu tĩnh; phạm vi MVP rất gọn.
3. **Săn di sản trong 60 giây** — dễ tạo cảm giác chơi kiểu neal.fun, nội dung có
   giá trị lâu dài; bắt đầu bằng chữ/bản đồ để không bị chặn bởi bản quyền ảnh.

Thứ tự triển khai đề xuất: làm #5 để thử nhịp tương tác và tạo khung chia sẻ, làm
#1 để bổ sung hạ tầng dữ liệu động, rồi #6 với pipeline nội dung có kiểm chứng.
