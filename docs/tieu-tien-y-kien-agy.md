# Đề xuất UI/UX trò chơi "Tiêu tiền tỷ phú" (Antigravity)

## 1. Bố cục Desktop & Mobile (Phác thảo ASCII)
```
[DESKTOP]
+--------------------------------------------------------------------------+
| <- Trang chủ     TIÊU THỬ 35 TỶ USD (FORBES SNAPSHOT)      [Chia sẻ] [🔊]|
+--------------------------------------------------------------------------+
| STICKY BAR: Số dư: 887.250.000.000.000 đ (98.6%) | Tiêu 100tr/s: còn 281 năm |
+--------------------------------------------------------------------------+
| [Thẻ góc nhìn]: Bạn đã tiêu 0.1% (~900 tỷ đ) = 30 trường học vùng cao [x]|
+--------------------------------------------------------------------------+
| [LƯỚI VẬT PHẨM (3-4 CỘT)]:                                               |
| +--------------------+ +--------------------+ +------------------------+ |
| | [Icon 🍵] Trà đá   | | [Icon 🚗] VF 3     | | [Ảnh 🏫] Trường vùng cao| |
| | Giá: 5.000 đ       | | Giá: 285.000.000 đ | | Giá: 50.000.000.000 đ  | |
| | [Bán]  1.500  [Mua]| | [Bán]    0    [Mua]| | [Bán]        0    [Mua]| |
| +--------------------+ +--------------------+ +------------------------+ |
+--------------------------------------------------------------------------+
| HOÁ ĐƠN DẠNG CUỘN GIẤY: Tổng đã chi: 12.750 tỷ đ | [Tải ảnh PNG] [Chơi lại] |
+--------------------------------------------------------------------------+

[MOBILE]
+------------------------------------+
| <- Trang chủ         [Chia sẻ] [🔇]|
| TIÊU THỬ 35 TỶ USD                 |
+------------------------------------+
| STICKY: 887.250 tỷ đ (98.6%)       |
| [===================>            ] |
| Tiêu 100tr/s: Còn 281 năm          |
+------------------------------------+
| [!] Đã tiêu 0.1% (900 tỷ đ)    [x] |
+------------------------------------+
| +--------------------------------+ |
| | [Icon] Honda Vision            | |
| | Giá: 40.000.000 đ              | |
| | [ - Bán ]   [ 2 ]   [ + Mua ]  | | <- Vùng ngón cái (Thumb zone, h=48px)
| +--------------------------------+ |
+------------------------------------+
| [ HOÁ ĐƠN & NÚT XUẤT ẢNH PNG ]     |
+------------------------------------+
```

## 2. Cảm giác "tiêu đã tay" (Tactile Feedback & Animation)
- **Số dư phản hồi tức thì**: Dùng Svelte tweened store, số nhảy mượt 300ms. Mua thì số dư co nhịp nhẹ, nổi badge `-X đ` màu đỏ mờ dần; bán nổi `+X đ` màu xanh lá.
- **Giữ nút mua liên tục (Hold-to-buy)**: Giữ 250ms bắt đầu tăng tốc tự động (+1/100ms -> sau 1s nhảy +10 -> sau 2s nhảy +100/tick) kèm âm thanh mô phỏng máy đếm tiền.
- **Rung phản hồi (Haptic)**: Kích hoạt `navigator.vibrate(10)` ở mỗi click/tick đếm trên mobile tạo độ đầm tay cơ học.
- **Âm thanh**: Hiệu ứng "ting" máy tính tiền và tiếng sột soạt tiền giấy; **mặc định TẮT (mute)**, có nút bật/tắt nổi bật trên thanh sticky.
- **Tối ưu ngón cái (Thumb zone)**: Cụm [-] [SL] [+] trên mobile cao tối thiểu 48px, đặt sát đáy thẻ; khoảng cách chạm rộng chống bấm nhầm thanh điều hướng hệ thống.

## 3. Minh hoạ vật phẩm (Phi thương hiệu & Nhất quán)
- **Hàng tiêu dùng/xe cộ**: Dùng **SVG nét phẳng (Flat Vector)** hoặc **Twemoji/Fluent emoji**, tạo hình ước lệ (xe điện SUV chung, xe máy phổ thông), tuyệt đối không dùng logo/tên thương hiệu vi phạm bản quyền.
- **Công trình công/Hạ tầng**: Ảnh chụp thực tế từ **Wikimedia Commons (CC BY/CC0)**; áp bộ lọc màu ấm (sepia 10%) đồng bộ nền kem `#faf8f5` của site.
- **Ngôn ngữ visual**: Đặt trong khung vuông bo góc `0.75rem` nền `#f3efe8`, khung thẻ viền `#e6e1d9` bo `1rem` đồng bộ toàn bộ trang `src/explore/`.

## 4. Màn mở đầu, Màn tổng kết & Ảnh chia sẻ hoá đơn
- **Màn mở đầu (Hero)**: Tích hợp ngay đầu trang, không dùng popup che khuất; hiển thị ngân sách snapshot (Forbes + ngày tỷ giá), tuyên bố miễn trừ và nút trượt nhanh xuống lưới.
- **Thẻ góc nhìn khi đạt mốc (0.01%, 0.1%, 1%, 10%)**: Card toast trượt nhẹ từ góc, quy đổi tương đương trực quan (VD: "0.1% = 30 trường học"), có nút [x] đóng nhanh, không chặn luồng bấm mua.
- **Màn tổng kết & Hoá đơn**: Thiết kế cuộn giấy in nhiệt với mép răng cưa ở cuối trang; tổng hợp danh sách đã mua và cơ cấu % (Cá nhân, Tài sản, Công trình xã hội).
- **Xuất ảnh chia sẻ**: Dùng Canvas (kế thừa `to-co-nao/exportImage.ts`) xuất ảnh PNG 1200×630 nền kem, font Be Vietnam Pro; kích hoạt Web Share API trên mobile để gửi qua Zalo/Facebook.

## 5. Phản biện ý ChatGPT dưới góc nhìn UX
- **Tên trang**: ChatGPT đề xuất *“Bạn sẽ phân bổ tài sản...”* tuy an toàn nhưng **quá hàn lâm, giống bài tập kinh tế**, triệt tiêu tính tò mò và lan toả của neal.fun.
  *Giải pháp UX*: Dùng tiêu đề hành động: **“Tiêu thử 35 tỷ USD”** (hoặc **“Nếu bạn có 900.000 tỷ...”**), kèm phụ đề chuẩn mực: *“Mô phỏng phân bổ theo ước tính Forbes của tỷ phú Phạm Nhật Vượng”*. Vừa hút tương tác, vừa đúng luật.
- **Độ phức tạp tính năng**: ChatGPT đề xuất lưu 3 kịch bản và phân tích sâu gây **quá tải nhận thức (cognitive overload)**. Sức hút cốt lõi của game là sự đối lập trực giác: *Bấm mỏi tay món nhỏ tiền không suy suyển -> Mua vài đại công trình tiền mới vơi*. Cần giữ vòng lặp mua/bán tối giản, nhanh và thoả mãn.
