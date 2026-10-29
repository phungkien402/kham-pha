# Báo cáo giá — “Tiêu thử 35 tỷ USD”

Ngày truy cập: 29/10/2026. Danh mục hiện có 24 mục đã qua ngưỡng nguồn. Giá là số nguyên VND, sắp tăng dần trong dữ liệu.

## Snapshot ngân sách

| Trường | Giá trị | Nguồn |
|---|---:|---|
| Ước tính tài sản ròng | 35,2 tỷ USD, 10/10/2026 | [StockBiz](https://stockbiz.vn/tin-tuc/ty-phu-pham-nhat-vuong-vua-lap-ky-luc-moi-chua-tung-co-o-viet-nam-tham-chi-con-vao-top-3-the-gioi/35966940) |
| Tỷ giá quy đổi | 26.040 VND/USD, giá bán Vietcombank, 29/10/2026 | [Vietcombank](https://www.vietcombank.com.vn/KHCN/Cong-cu-tien-ich/Ty-gia) |

Mức 26.040 là giá bán USD/VND của VCB được ghi nhận lúc 07:55 ngày 29/10, không phải tỷ giá tự do. Dữ liệu nguồn của VCB thay đổi trong ngày; đây là snapshot cố định.

## Tóm tắt danh mục được giữ

| Dải giá | Mục tiêu biểu | Cơ sở nguồn |
|---|---|---|
| 5.000–250.000 | trà đá, bánh mì, cà phê, phở, vé phim/xe, internet | báo chính thống hoặc biểu giá hãng/chuỗi |
| 15–40 triệu | laptop, điện thoại, Honda Vision, học phí | nhà bán lẻ/hãng/cơ quan quản lý |
| 285 triệu–2 tỷ | VF 3, VF 8, VF 9, nhượng quyền | VTC News/hãng hoặc báo chính thống |
| 3–50 tỷ | buýt điện, cầu, trạm y tế, trường | dự án hoặc tin báo chính thống |
| 500 tỷ–43,7 nghìn tỷ | bệnh viện, vành đai, sân vận động, Metro số 1 | tổng mức đầu tư dự án cụ thể |

Tất cả URL, phạm vi và cờ `tranhCai` đã được lưu trong `src/explore/tieu-tien/data/vat-pham.json`. Các công trình là **tổng mức đầu tư của dự án nêu tên**, không diễn đạt như hàng hóa có thể mua ngay.

## Mục tạm bỏ

| Mục | Lý do |
|---|---|
| Vé máy bay Hà Nội–TP.HCM | Giá thay đổi theo giờ bay, hạng vé và ngày; không khóa được một báo giá hãng cùng snapshot. |
| Điện thoại phổ thông, xe đạp điện, máy giặt | Chưa có trang sản phẩm/giá niêm yết cụ thể được xác minh trong lượt rà soát; danh mục loại thay vì dùng giá khái quát. |
| Học phí bốn năm | Suy ra bằng phép nhân từ mức năm học sẽ che khuất khác biệt ngành, tín chỉ và lộ trình tăng học phí. |
| Ô tô cũ, đất nông thôn, căn hộ, nhà phố, biệt thự | Không có dự án/sản phẩm cố định; giá rao và vị trí làm mức “đại diện” thiếu tin cậy. |
| Tàu bay Airbus A321neo | Giá catalogue quốc tế, thường không phản ánh giá hợp đồng và không phải nguồn Việt Nam. |

Các mức giá hàng tiêu dùng có cờ `tranhCai: true` vì khác biệt địa bàn/cấu hình/khuyến mại. Chúng cần luôn hiện phạm vi ngay trên chi tiết thẻ.
