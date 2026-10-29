// scripts/build-doc-vn.mjs
// Tạo dữ liệu tuyến hành trình Bắc -> Nam cho bước E3 (/to-co-nao) với 32 điểm dừng
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEqualArea } from 'd3-geo';
import { R } from './size-data-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_FILE = resolve(ROOT, 'src/explore/to-co-nao/data/doc-vn.json');

// Tâm phép chiếu LAEA của Việt Nam đã dùng trong pipeline dữ liệu
export const VN_LAEA_CENTER = [106.43998191237796, 16.487076751220748];

export const RAW_STOPS = [
  {
    id: 1,
    name: 'Cột cờ Lũng Cú',
    province: 'Tuyên Quang',
    lat: 23.364,
    lng: 105.316,
    type: 'Lịch sử',
    wikiTitle: 'Cột cờ Lũng Cú',
    description: 'Cột cờ Lũng Cú tọa lạc trên đỉnh núi Rồng thuộc cao nguyên đá Đồng Văn. Nơi đây đánh dấu điểm cực Bắc thiêng liêng của Tổ quốc, nơi lá cờ đỏ sao vàng luôn tung bay kiêu hãnh.',
    fact: 'Lá cờ trên đỉnh Lũng Cú có diện tích 54 mét vuông, tượng trưng cho 54 dân tộc anh em trên dải đất Việt Nam.',
  },
  {
    id: 2,
    name: 'Đèo Mã Pì Lèng',
    province: 'Tuyên Quang',
    lat: 23.239,
    lng: 105.41,
    type: 'Núi',
    wikiTitle: 'Mã Pì Lèng',
    description: 'Đèo Mã Pì Lèng là một trong tứ đại đỉnh đèo hiểm trở bậc nhất vùng núi phía Bắc. Cung đường uốn lượn men theo vách đá dựng đứng, nhìn thẳng xuống dòng sông Nho Quế xanh ngắt uốn lượn dưới hẻm vực Tu Sản.',
    fact: 'Con đường Hạnh Phúc vắt qua đèo được những người dân, thanh niên nhiều dân tộc đục đá, mở bằng sức người trong nhiều năm.',
  },
  {
    id: 3,
    name: 'Ruộng bậc thang Hoàng Su Phì',
    province: 'Tuyên Quang',
    lat: 22.7,
    lng: 104.68,
    type: 'Núi',
    wikiTitle: 'Hoàng Su Phì',
    description: 'Hoàng Su Phì nổi tiếng với những thửa ruộng bậc thang kỳ vĩ xếp tầng tầng lớp lớp men theo sườn non. Vào mùa lúa chín hoặc mùa nước đổ, cả thung lũng như một bức tranh thổ cẩm khổng lồ giữa đất trời.',
    fact: 'Kỹ thuật canh tác ruộng bậc thang độc đáo nơi đây là kết tinh lao động qua nhiều thế hệ của đồng bào Dao, Nùng và La Chí.',
  },
  {
    id: 4,
    name: 'Sa Pa – Fansipan',
    province: 'Lào Cai',
    lat: 22.336,
    lng: 103.844,
    type: 'Núi',
    wikiTitle: 'Phan Xi Păng',
    description: 'Sa Pa ẩn mình trong sương mây mát lành quanh năm với đỉnh Fansipan – nóc nhà của bán đảo Đông Dương. Vùng đất này hòa quyện giữa cảnh sắc núi non tráng lệ và nét văn hóa đa dạng của các bản làng vùng cao.',
    fact: 'Đỉnh Fansipan cao 3.143 mét và là ngọn núi cao nhất trên toàn bán đảo Đông Dương.',
  },
  {
    id: 5,
    name: 'Hồ Thác Bà',
    province: 'Lào Cai',
    lat: 21.85,
    lng: 105.0,
    type: 'Thiên nhiên',
    wikiTitle: 'Hồ Thác Bà',
    description: 'Hồ Thác Bà là một trong những hồ nước nhân tạo lớn nhất Việt Nam, hình thành khi xây dựng đài thủy điện Thác Bà. Lòng hồ mênh mông ôm trọn hơn một nghìn hòn đảo lớn nhỏ rải rác như một vịnh Hạ Long trên núi.',
    fact: 'Hồ Thác Bà có hơn 1.300 hòn đảo lớn nhỏ tạo nên hệ sinh thái và cảnh quan lòng hồ vô cùng đặc sắc.',
  },
  {
    id: 6,
    name: 'Đền Hùng',
    province: 'Phú Thọ',
    lat: 21.367,
    lng: 105.323,
    type: 'Lịch sử',
    wikiTitle: 'Đền Hùng',
    description: 'Khu di tích Đền Hùng ngự trên núi Nghĩa Lĩnh, cội nguồn thiêng liêng nơi các vua Hùng dựng nên nước Văn Lang. Hằng năm vào dịp giỗ Tổ, hàng triệu đồng bào khắp nơi lại hướng về dâng nén hương tưởng nhớ tổ tiên.',
    fact: 'Tín ngưỡng thờ cúng Hùng Vương đã được UNESCO ghi danh là Di sản văn hóa phi vật thể đại diện của nhân loại.',
  },
  {
    id: 7,
    name: 'Hồ Hoàn Kiếm',
    province: 'Hà Nội',
    lat: 21.028,
    lng: 105.852,
    type: 'Lịch sử',
    wikiTitle: 'Hồ Hoàn Kiếm',
    description: 'Hồ Hoàn Kiếm là trái tim của thủ đô Hà Nội, gắn liền với truyền thuyết vua Lê Lợi trả gươm báu cho Rùa Vàng. Giữa hồ có Tháp Rùa cổ kính soi bóng cùng cầu Thê Húc đỏ son dẫn vào đền Ngọc Sơn.',
    fact: 'Cầu Thê Húc cong cong dẫn vào đền Ngọc Sơn mang ý nghĩa là nơi ngưng tụ ánh sáng ban mai của mặt trời.',
  },
  {
    id: 8,
    name: 'Văn Miếu – Quốc Tử Giám',
    province: 'Hà Nội',
    lat: 21.029,
    lng: 105.836,
    type: 'Lịch sử',
    wikiTitle: 'Văn Miếu – Quốc Tử Giám',
    description: 'Văn Miếu – Quốc Tử Giám là quần thể di tích lịch sử và trường đại học đầu tiên của Việt Nam. Nơi đây lưu giữ 82 bia đá tiến sĩ vinh danh những bậc hiền tài làm rạng danh nền học vấn nước nhà.',
    fact: 'Các bia tiến sĩ tại Văn Miếu được đặt trên lưng rùa đá uy nghiêm và đã được UNESCO công nhận là Di sản tư liệu thế giới.',
  },
  {
    id: 9,
    name: 'Vịnh Hạ Long',
    province: 'Quảng Ninh',
    lat: 20.91,
    lng: 107.184,
    type: 'Biển',
    wikiTitle: 'Vịnh Hạ Long',
    description: 'Vịnh Hạ Long sở hữu hàng nghìn đảo đá vôi kỳ vĩ nhô lên giữa làn nước biển xanh ngọc bích. Vẻ đẹp huyền ảo cùng hệ thống hang động lung linh đã đưa danh thắng này nhiều lần được vinh danh là Di sản thiên nhiên thế giới.',
    fact: 'Vịnh Hạ Long có gần 2.000 hòn đảo lớn nhỏ với thảm thực vật nhiệt đới phong phú và lịch sử địa chất hàng triệu năm.',
  },
  {
    id: 10,
    name: 'Tràng An',
    province: 'Ninh Bình',
    lat: 20.253,
    lng: 105.896,
    type: 'Thiên nhiên',
    wikiTitle: 'Quần thể danh thắng Tràng An',
    description: 'Quần thể danh thắng Tràng An được ví như một vịnh Hạ Long trên cạn với hệ thống thung lũng ngập nước và hang động xuyên thủy. Du khách ngồi thuyền len lỏi qua các vách núi đá vôi sẽ cảm nhận được vẻ đẹp thanh bình hiếm có.',
    fact: 'Tràng An là di sản thế giới hỗn hợp đầu tiên của Việt Nam, được UNESCO công nhận cả về văn hóa lẫn thiên nhiên.',
  },
  {
    id: 11,
    name: 'Thành nhà Hồ',
    province: 'Thanh Hóa',
    lat: 20.077,
    lng: 105.605,
    type: 'Lịch sử',
    wikiTitle: 'Thành nhà Hồ',
    description: 'Thành nhà Hồ là công trình kiến trúc quân sự đồ sộ có tường và cổng xây bằng những khối đá lớn ghép khít. Trải qua hơn sáu thế kỷ, bốn cổng vòm thành đá vẫn đứng vững trước phong ba thời gian.',
    fact: 'Nhiều khối đá xây thành nặng tới hàng chục tấn được đẽo gọt vuông vức và lắp ghép vô cùng chuẩn xác.',
  },
  {
    id: 12,
    name: 'Biển Sầm Sơn',
    province: 'Thanh Hóa',
    lat: 19.734,
    lng: 105.905,
    type: 'Biển',
    wikiTitle: 'Sầm Sơn',
    description: 'Biển Sầm Sơn trải dài với bãi cát thoai thoải và những con sóng biển vỗ bờ mạnh mẽ quanh năm. Từ thời đầu thế kỷ trước, nơi đây đã là điểm nghỉ mát nổi tiếng bên chân núi Trường Lệ kỳ vĩ.',
    fact: 'Gần bờ biển Sầm Sơn có hòn Trống Mái dưới chân núi Trường Lệ gắn liền với câu chuyện tình thủy chung sâu sắc.',
  },
  {
    id: 13,
    name: 'Làng Sen (quê Bác)',
    province: 'Nghệ An',
    lat: 18.701,
    lng: 105.535,
    type: 'Lịch sử',
    wikiTitle: 'Kim Liên, Nam Đàn',
    description: 'Làng Sen là quê nội của Chủ tịch Hồ Chí Minh, nơi Người sống những năm tháng tuổi thơ; ngay cạnh là làng Hoàng Trù, quê ngoại, nơi Người sinh ra. Mái nhà tranh đơn sơ dưới rặng tre xanh và hương sen ngan ngát gợi nhớ không gian mộc mạc của làng quê xứ Nghệ.',
    fact: 'Vào mùa hè, đầm sen quanh làng nở rộ tỏa hương thơm ngát đúng như tên gọi Làng Sen thân thương.',
  },
  {
    id: 14,
    name: 'Biển Thiên Cầm',
    province: 'Hà Tĩnh',
    lat: 18.243,
    lng: 106.12,
    type: 'Biển',
    wikiTitle: 'Thiên Cầm',
    description: 'Biển Thiên Cầm nằm thoai thoải bên chân núi Thiên Cầm với bờ cát trắng mịn và làn nước trong xanh tĩnh lặng. Nơi đây giữ trọn vẻ đẹp hoang sơ tự nhiên, là điểm dừng chân yên ả của dải đất miền Trung nắng gió.',
    fact: 'Tên gọi Thiên Cầm tương truyền có nghĩa là cây đàn trời nhờ tiếng sóng biển dội vào vách núi tựa như khúc nhạc du dương.',
  },
  {
    id: 15,
    name: 'Phong Nha – Kẻ Bàng',
    province: 'Quảng Trị',
    lat: 17.59,
    lng: 106.283,
    type: 'Thiên nhiên',
    wikiTitle: 'Vườn quốc gia Phong Nha – Kẻ Bàng',
    description: 'Vườn quốc gia Phong Nha – Kẻ Bàng là xứ sở hang động kỳ vĩ bậc nhất thế giới với mạng lưới sông ngầm và thạch nhũ tráng lệ. Vùng này thuộc một trong những đoạn hẹp nhất của dải đất Việt Nam.',
    fact: 'Khu vực này sở hữu hang Sơn Đoòng – hang động tự nhiên lớn nhất thế giới với hệ sinh thái và rừng nguyên sinh ngay bên trong.',
  },
  {
    id: 16,
    name: 'Cầu Hiền Lương – sông Bến Hải',
    province: 'Quảng Trị',
    lat: 17.003,
    lng: 107.05,
    type: 'Lịch sử',
    wikiTitle: 'Cầu Hiền Lương',
    description: 'Cầu Hiền Lương bắc qua dòng sông Bến Hải là chứng tích lịch sử khắc ghi nỗi đau chia cắt hai miền Nam – Bắc suốt hơn hai mươi năm. Ngày nay, đôi bờ Hiền Lương là biểu tượng cho khát vọng hòa bình và ngày non sông thu về một mối.',
    fact: 'Cây cầu lịch sử từng được sơn hai màu riêng biệt tại vĩ tuyến 17 để phân định ranh giới tạm thời thời chiến tranh.',
  },
  {
    id: 17,
    name: 'Đại Nội Huế',
    province: 'Huế',
    lat: 16.469,
    lng: 107.578,
    type: 'Lịch sử',
    wikiTitle: 'Hoàng thành Huế',
    description: 'Đại Nội Huế là trung tâm quyền lực của triều Nguyễn, triều đại phong kiến cuối cùng trong lịch sử Việt Nam. Quần thể cung điện, đền đài nguy nga soi bóng bên dòng sông Hương thơ mộng, lưu giữ trọn vẹn nét vàng son một thuở.',
    fact: 'Hệ thống kiến trúc cung đình Huế được quy hoạch chặt chẽ theo nguyên tắc dịch lý và phong thủy phương Đông.',
  },
  {
    id: 18,
    name: 'Đèo Hải Vân',
    province: 'Đà Nẵng',
    lat: 16.193,
    lng: 108.13,
    type: 'Núi',
    wikiTitle: 'Đèo Hải Vân',
    description: 'Đèo Hải Vân cắt ngang dãy Bạch Mã đâm thẳng ra biển, được người xưa mệnh danh là thiên hạ đệ nhất hùng quan. Đây cũng là ranh giới khí hậu tự nhiên quan trọng, ngăn gió mùa đông bắc tràn xuống phương Nam.',
    fact: 'Đứng trên đỉnh Hải Vân Quan, du khách có thể phóng tầm mắt ngắm trọn vịnh Lăng Cô ở phía bắc và vịnh Đà Nẵng ở phía nam.',
  },
  {
    id: 19,
    name: 'Cầu Rồng – sông Hàn',
    province: 'Đà Nẵng',
    lat: 16.061,
    lng: 108.227,
    type: 'Thành phố',
    wikiTitle: 'Cầu Rồng',
    description: 'Cầu Rồng bắc qua sông Hàn là biểu tượng tràn đầy sức sống và tinh thần phát triển của thành phố Đà Nẵng hiện đại. Thiết kế cây cầu mô phỏng con rồng thời Lý mạnh mẽ hướng mình vươn ra biển lớn.',
    fact: 'Cầu Rồng có khả năng phun lửa và phun nước đặc sắc phục vụ người dân và du khách vào mỗi dịp cuối tuần.',
  },
  {
    id: 20,
    name: 'Phố cổ Hội An',
    province: 'Đà Nẵng',
    lat: 15.88,
    lng: 108.335,
    type: 'Lịch sử',
    wikiTitle: 'Hội An',
    description: 'Phố cổ Hội An từng là thương cảng quốc tế sầm uất với những ngôi nhà cổ tường vàng mái ngói rêu phong và giàn hoa giấy rực rỡ. Về đêm, cả khu phố lung linh huyền ảo trong ánh sáng của hàng ngàn chiếc đèn lồng đủ màu sắc.',
    fact: 'Chùa Cầu cổ kính tại Hội An do các thương nhân Nhật Bản xây dựng từ nhiều thế kỷ trước.',
  },
  {
    id: 21,
    name: 'Thánh địa Mỹ Sơn',
    province: 'Đà Nẵng',
    lat: 15.764,
    lng: 108.124,
    type: 'Lịch sử',
    wikiTitle: 'Thánh địa Mỹ Sơn',
    description: 'Thánh địa Mỹ Sơn là quần thể đền tháp Chăm Pa cổ kính nằm ẩn mình trong thung lũng khép kín bao quanh bởi núi non hùng vĩ. Những ngôi tháp gạch đỏ nung rực rỡ phản ánh đỉnh cao nghệ thuật kiến trúc và điêu khắc tôn giáo xưa.',
    fact: 'Kỹ thuật nung gạch và kết dính các khối gạch Chăm Pa tại Mỹ Sơn đến nay vẫn là đề tài nghiên cứu đầy cuốn hút.',
  },
  {
    id: 22,
    name: 'Đảo Lý Sơn',
    province: 'Quảng Ngãi',
    lat: 15.38,
    lng: 109.12,
    type: 'Biển',
    wikiTitle: 'Lý Sơn',
    description: 'Đảo Lý Sơn hình thành từ những miệng núi lửa cổ đại nhô lên giữa biển xanh mênh mông của miền Trung. Đảo nổi tiếng với những cánh đồng hành tỏi trải trên đất cát san hô cùng vách đá Hang Câu sừng sững.',
    fact: 'Lý Sơn được mệnh danh là vương quốc tỏi của Việt Nam nhờ hương vị thơm nồng đặc trưng được bồi đắp từ đất núi lửa.',
  },
  {
    id: 23,
    name: 'Eo Gió – Quy Nhơn',
    province: 'Gia Lai',
    lat: 13.88,
    lng: 109.29,
    type: 'Biển',
    wikiTitle: 'Quy Nhơn',
    description: 'Eo Gió là một eo biển lộng gió được bao bọc bởi những rặng núi đá uốn lượn hùng vĩ vươn dài ôm lấy làn nước xanh ngắt. Con đường đi bộ men lưng chừng núi mở ra góc nhìn khoáng đạt về phía đại dương bao la.',
    fact: 'Eo Gió là một vịnh nhỏ được vách núi đá ôm lấy, quanh năm lộng gió biển.',
  },
  {
    id: 24,
    name: 'Gành Đá Đĩa',
    province: 'Đắk Lắk',
    lat: 13.355,
    lng: 109.296,
    type: 'Thiên nhiên',
    wikiTitle: 'Gành Đá Đĩa',
    description: 'Gành Đá Đĩa là tuyệt tác địa chất kỳ thú với vô số cột đá bazan hình lục lăng xếp khít nhau như tổ ong khổng lồ vươn ra biển. Từng đợt sóng bạc đầu xô vào gành đá tạo nên cảnh tượng thiên nhiên tráng lệ.',
    fact: 'Gành Đá Đĩa là một trong những hiện tượng địa chất núi lửa dạng cột hiếm hoi và độc đáo bậc nhất trên thế giới.',
  },
  {
    id: 25,
    name: 'Vịnh Nha Trang',
    province: 'Khánh Hòa',
    lat: 12.238,
    lng: 109.196,
    type: 'Biển',
    wikiTitle: 'Vịnh Nha Trang',
    description: 'Vịnh Nha Trang là một trong những vịnh biển nhiệt đới đẹp nhất thế giới với bờ cát trắng mịn uốn cong hình cánh cung. Làn nước biển xanh ngắt ấm áp quanh năm ôm lấy các hòn đảo lớn nhỏ và rạn san hô rực rỡ.',
    fact: 'Vịnh Nha Trang sở hữu hệ sinh thái biển vô cùng phong phú với hàng trăm loài san hô và sinh vật biển quý hiếm.',
  },
  {
    id: 26,
    name: 'Đà Lạt – hồ Xuân Hương',
    province: 'Lâm Đồng',
    lat: 11.941,
    lng: 108.441,
    type: 'Núi',
    wikiTitle: 'Đà Lạt',
    description: 'Đà Lạt nằm trên cao nguyên Lâm Viên mát lành quanh năm với rừng thông bạt ngàn và ngàn hoa đua nở rực rỡ. Hồ Xuân Hương tĩnh lặng như một tấm gương biếc uốn lượn giữa trung tâm thành phố ngàn hoa.',
    fact: 'Đà Lạt nằm trên cao nguyên Lâm Viên, độ cao khoảng 1.500 m nên mát mẻ quanh năm.',
  },
  {
    id: 27,
    name: 'Đồi cát Mũi Né',
    province: 'Lâm Đồng',
    lat: 10.933,
    lng: 108.287,
    type: 'Thiên nhiên',
    wikiTitle: 'Mũi Né',
    description: 'Đồi cát Mũi Né được ví như một tiểu sa mạc ven biển với những đồi cát thoai thoải liên tục thay đổi hình dáng theo từng đợt gió. Sắc màu cát biến đổi kỳ ảo từ vàng, đỏ tới trắng tạo nên nét độc đáo giữa dải bờ biển Nam Trung Bộ.',
    fact: 'Gió biển tự nhiên thổi liên tục khiến những triền cát ở Mũi Né thay đổi diện mạo từng giờ, còn gọi là đồi cát bay.',
  },
  {
    id: 28,
    name: 'Bến Nhà Rồng – TP.HCM',
    province: 'TP.HCM',
    lat: 10.768,
    lng: 106.707,
    type: 'Thành phố',
    wikiTitle: 'Bến Nhà Rồng',
    description: 'Bến Nhà Rồng tọa lạc bên ngã ba sông Sài Gòn, nơi người thanh niên Nguyễn Tất Thành ra đi tìm đường cứu nước năm 1911. Tòa nhà cổ kính mang nét kiến trúc Á – Âu hài hòa nay là bảo tàng lưu giữ nhiều tư liệu quý giá.',
    fact: 'Tòa nhà mang tên Bến Nhà Rồng bởi trên đỉnh mái ngói có gắn đôi rồng gốm uốn lượn chầu mặt trăng.',
  },
  {
    id: 29,
    name: 'Địa đạo Củ Chi',
    province: 'TP.HCM',
    lat: 11.142,
    lng: 106.462,
    type: 'Lịch sử',
    wikiTitle: 'Địa đạo Củ Chi',
    description: 'Địa đạo Củ Chi là hệ thống công trình quân sự độc nhất vô nhị với hàng trăm km đường hầm ngầm ngoằn ngoèo dưới lòng đất. Nơi đây từng là căn cứ kháng chiến kiên cường với đầy đủ trạm y tế, phòng họp, bếp Hoàng Cầm và kho lương thực.',
    fact: 'Hệ thống địa đạo có tổng chiều dài hàng trăm km đan cài nhiều tầng sâu khác nhau dưới lòng đất.',
  },
  {
    id: 30,
    name: 'Chợ nổi Cái Răng',
    province: 'Cần Thơ',
    lat: 10.003,
    lng: 105.746,
    type: 'Ẩm thực',
    wikiTitle: 'Chợ nổi Cái Răng',
    description: 'Chợ nổi Cái Răng là nét văn hóa giao thương sông nước đặc trưng của miền Tây Nam Bộ trên dòng sông Cần Thơ. Hàng trăm ghe xuồng tấp nập mua bán nông sản, trái cây từ tờ mờ sáng trong tiếng máy chèo rộn rã.',
    fact: 'Thương hồ trên chợ nổi dùng một cây sào tre dài gọi là cây bẹo để treo loại nông sản mình bán giúp khách dễ nhận ra từ xa.',
  },
  {
    id: 31,
    name: 'Rừng tràm Trà Sư',
    province: 'An Giang',
    lat: 10.583,
    lng: 105.058,
    type: 'Thiên nhiên',
    wikiTitle: 'Rừng tràm Trà Sư',
    description: 'Rừng tràm Trà Sư là khu rừng ngập nước trù phú của vùng đồng bằng sông Cửu Long với thảm bèo cám xanh mướt phủ kín mặt nước. Ngồi xuồng chèo len lỏi dưới tán tràm rợp bóng, du khách có thể ngắm nhìn hàng ngàn cánh chim chao liệng.',
    fact: 'Vào mùa nước nổi, thảm bèo hoa dâu và bèo cám phủ xanh mướt toàn bộ mặt nước rừng tràm tựa như một tấm thảm lụa ngọc lục bảo.',
  },
  {
    id: 32,
    name: 'Mũi Cà Mau',
    province: 'Cà Mau',
    lat: 8.6,
    lng: 104.72,
    type: 'Thiên nhiên',
    wikiTitle: 'Mũi Cà Mau',
    description: 'Mũi Cà Mau là điểm cực Nam thiêng liêng của dải đất chữ S, nơi có mốc tọa độ quốc gia và biểu tượng con tàu vươn mình ra khơi. Đây là một trong số ít nơi trên đất liền Việt Nam có thể ngắm mặt trời mọc trên biển Đông và lặn ở biển Tây.',
    fact: 'Rừng ngập mặn Cà Mau là khu dự trữ sinh quyển thế giới với diện tích rừng đước, mắm rộng lớn giúp đất phù sa lấn dần ra biển hàng năm.',
  },
];

export function haversineDistance(lat1, lon1, lat2, lon2, radius = 6371) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function buildDocVnData() {
  const proj = geoAzimuthalEqualArea()
    .rotate([-VN_LAEA_CENTER[0], -VN_LAEA_CENTER[1]])
    .scale(R)
    .translate([0, 0]);

  let cumKm = 0;
  const cumulativeDistances = [0];

  const stops = RAW_STOPS.map((s, idx) => {
    const [x, y] = proj([s.lng, s.lat]);
    if (idx > 0) {
      const prev = RAW_STOPS[idx - 1];
      const d = haversineDistance(prev.lat, prev.lng, s.lat, s.lng);
      cumKm += d;
      cumulativeDistances.push(Number(cumKm.toFixed(3)));
    }
    return {
      ...s,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      kmFromStart: Number(cumKm.toFixed(1)),
    };
  });

  const totalKm = Number(cumKm.toFixed(1));
  const straightKm = Number(
    haversineDistance(
      RAW_STOPS[0].lat,
      RAW_STOPS[0].lng,
      RAW_STOPS[RAW_STOPS.length - 1].lat,
      RAW_STOPS[RAW_STOPS.length - 1].lng
    ).toFixed(1)
  );

  return {
    center: VN_LAEA_CENTER,
    totalKm,
    straightKm,
    cumulativeDistances,
    stops,
  };
}

const data = buildDocVnData();
writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(`Đã xuất ${OUT_FILE}`);
console.log(`- Điểm dừng: ${data.stops.length}`);
console.log(`- Tổng khoảng cách dọc tuyến: ${data.totalKm} km`);
console.log(`- Đường thẳng Lũng Cú – Cà Mau: ${data.straightKm} km`);
