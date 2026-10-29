# Ý kiến ChatGPT/Codex — E4

## A. Nội dung: biến mỗi thẻ thành một “lời hẹn” cho chặng kế

Đừng mở bằng mô tả bách khoa. Mỗi thẻ nên theo nhịp: **câu móc 1 dòng → điều mắt thấy/tai nghe → một sự thật neo trí nhớ → lời mời kéo tiếp**. Chỉ một ý gây ngạc nhiên/thẻ; số liệu chỉ dùng khi nguồn đã duyệt.

Mẫu UI: `Bạn có dám nhìn xuống?` / ảnh lớn / `Mã Pì Lèng · Núi` / 2 câu ngắn / `Gợi ý: kéo thêm để xem con sông dưới đáy vực` / nút nhỏ “Hiện đáp án” (mở fact). Không cần cả mô tả dài lẫn fact vàng cùng lúc: fact là phần thưởng sau một tương tác nhỏ.

**Đèo Mã Pì Lèng**

> **Nếu nhìn xuống, bạn có tìm thấy dòng Nho Quế không?**
> Con đèo men theo vách đá của cao nguyên đá Đồng Văn; phía dưới là sông Nho Quế và hẻm vực Tu Sản. Cung đường này nằm trên Con đường Hạnh Phúc, được mở bằng sức người trong nhiều năm.
> **Kéo tiếp:** cảnh núi đá sẽ nhường chỗ cho đồng bằng và biển.

**Phong Nha – Kẻ Bàng**

> **Bên dưới mảng xanh này là cả một thế giới tối?**
> Phong Nha – Kẻ Bàng nổi tiếng bởi hệ thống hang động, sông ngầm và thạch nhũ. Sơn Đoòng, hang động tự nhiên lớn nhất thế giới được biết đến, nằm trong vùng này.
> **Đoán xem:** Việt Nam sắp hẹp lại đến mức nào trước khi chạm Huế?

**Mũi Cà Mau**

> **Đi hết dải đất chữ S, phía trước còn là biển.**
> Đây là điểm cực Nam trên đất liền Việt Nam, giữa hệ sinh thái rừng ngập mặn Cà Mau. Phù sa và rừng ngập mặn vẫn cùng nhau tạo nên bờ đất ở nơi cuối hành trình.
> **Bạn đã đi hết tuyến:** thử so chiều dài đường đi với khoảng cách chim bay.

## B. Tương tác: một vòng lặp nhỏ, không thêm bảng điều khiển

Ưu tiên một “dự đoán → lật đáp án → tiếp tục” ở đầu: hỏi “Bạn đoán Lũng Cú–Mũi Cà Mau đường chim bay bao xa?”, cho chọn 1.000 / 1.500 / 2.000 km; chỉ hiện đáp án ở tổng kết. Lưu lựa chọn cục bộ để tạo payoff, không chặn người muốn kéo ngay.

Ở các điểm dừng, mở khóa tuần tự bằng chấm sáng và rung/pulse rất ngắn khi tới điểm; bấm chấm để nhảy. Mỗi lần đổi vùng chỉ đổi một tín hiệu cảm giác: nền chuyển sắc, biểu tượng gió/mưa/nắng, và nhãn “qua Hải Vân”; tránh âm thanh tự phát. Nếu thêm âm thanh, chỉ là nút chủ động, tắt mặc định và có nhãn rõ.

Thêm “đi bằng gì?” ở tổng kết hoặc popover: xe máy / tàu / máy bay, hiển thị **ước tính** thời gian và giả định thay vì giả vờ là lộ trình thực tế. Không nên nhồi thời tiết trực tiếp theo thời gian thực: nó dễ sai, làm loãng câu chuyện và cần nguồn/caching riêng.

## C. Bố cục và ảnh

Desktop: cho cột trái và bản đồ cùng cao `calc(100svh - header)`, nhưng chỉ cột trái cuộn. Đặt ảnh trước phần chữ, `block-size: clamp(22rem, 40svh, 34rem); flex: 0 0 auto; aspect-ratio: auto`, `img { object-fit: cover }`; thẻ và vùng ảnh đều `flex-shrink: 0`. Vì thế ở màn 1883×886 ảnh tối thiểu khoảng 354 px, thay vì bị flex nén còn ~60 px; phần text/context dư nằm trong vùng cuộn.

Không cần ép cả thẻ phải vừa một viewport. Có thể giữ stats gọn/sticky đầu cột, thẻ là nhân vật chính, còn badge khí hậu và chip “đã qua” sau thẻ. Ảnh crop phải có `object-position` lưu theo từng ảnh để không cắt mất chủ thể.

Mobile: map trước ở khoảng 38–44svh, thẻ sau; ảnh dùng `min(56vw, 22rem)` và tỷ lệ 4:3 hoặc 16:9, không khóa chiều cao cột. Thanh kéo đáy cần `position: fixed` (hoặc sticky trong đúng scroll container), safe-area padding và padding đáy nội dung đo từ chiều cao thật của thanh; tránh hai vùng cuộn lồng nhau.

## D. Kỹ thuật: khóa cùng hệ tọa độ và ảnh đúng địa danh

Hiện điểm dừng được tạo bằng LAEA tâm `[106.4399819, 16.4870768]`, trong khi SVG nền/tỉnh là dữ liệu pipeline khác; không nên duy trì hai công thức độc lập. Xuất **cả path bản đồ, ranh tỉnh, điểm dừng và tâm nhãn** trong một script/module dùng cùng `geoAzimuthalEqualArea`, cùng tâm, `scale(R)`, `translate([0,0])`; SVG chỉ render dữ liệu đã xuất. Không nội suy lat/lng rồi nội suy x/y theo hai cách khác nhau: với vị trí giữa chặng, nội suy địa lý rồi project một lần, hoặc tuyên bố rõ nội suy mặt phẳng là xấp xỉ hiển thị.

Thêm test build: mỗi stop phải `geoContains` polygon tỉnh kỳ vọng (riêng đảo dùng polygon/tập island của tỉnh), và point-in-path sau projection với sai số nhỏ. Snapshot/Playwright phải kiểm tra Lý Sơn nằm ngoài bờ, Mỹ Sơn trong polygon Đà Nẵng theo dữ liệu đang dùng, cùng vài điểm biên. Nếu bộ ranh giới không chứa đảo, đó là lỗi dữ liệu cần sửa, không “nudge” pixel thủ công.

Ảnh phải có manifest biên tập, không chọn kết quả đầu của Commons search: `{ stopId, canonicalTitle, commonsFile, verifiedAt, cropPosition }`. `wikiTitle` phải là địa danh chính xác; Eo Gió hiện dùng `Quy Nhơn` và metadata trỏ `Skyline_of_Quy_Nhon.jpg`, nên cần thay bằng file Eo Gió đã được người duyệt. Kiểm tra tự động chỉ xác nhận license/file/kích thước; kiểm tra đúng địa danh cần thumbnail contact sheet hoặc review thủ công trước commit. Khi không duyệt được, dùng gradient minh họa thay vì ảnh sai.

## E. Điều không đồng ý với hướng hiện tại

1. Không coi “nhiều animation hơn” là lời giải cho sự yên tĩnh. Nhịp nội dung, câu hỏi và payoff quan trọng hơn Ken Burns, confetti, pulse và dash chạy đồng thời.
2. Không để `nearestStop` quyết định toàn bộ lời kể khi đang ở giữa hai nơi: nó làm thẻ đổi quá sớm/muộn. Dùng chặng đang đến (`segIndex + 1`) hoặc ngưỡng chuyển rõ ràng, rồi thử bằng kéo chậm.
3. Không gọi tổng km qua 32 điểm là “chiều dài Việt Nam”. Đó là **km dọc hành trình**; câu hỏi đầu và tổng kết phải phân biệt với khoảng cách đường chim bay.
4. Không dùng các tỉnh “mới” nếu dữ liệu hình/tên và chính sách hiển thị chưa đồng bộ; bản đồ, chip, test và copy phải dùng cùng một bộ đơn vị hành chính.
