// scripts/build-doc-vn.mjs
// Tạo dữ liệu tuyến hành trình Bắc -> Nam cho bước E4 (/to-co-nao) với 32 điểm dừng,
// đồng thời xuất ranh giới 34 tỉnh thành và bóng bản đồ Việt Nam trong cùng hệ chiếu LAEA.
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEqualArea, geoCentroid } from 'd3-geo';
import mapshaper from 'mapshaper';
import { R, slugify, fixProvinceName, toSvgPath } from './size-data-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_FILE = resolve(ROOT, 'src/explore/to-co-nao/data/doc-vn.json');
const PROVINCES_FILE = resolve(ROOT, 'raw-data/Provinces.geojson');

// Tâm phép chiếu LAEA của Việt Nam dùng đồng nhất trong toàn bộ pipeline dữ liệu
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
    hook: 'Nơi lá cờ 54 mét vuông tung bay kiêu hãnh trên đỉnh núi Rồng?',
    moTa: 'Đứng trên đỉnh cột cờ, bạn nhìn thấy những bản làng người Lô Lô ẩn hiện giữa thung lũng đá tai mèo. Gió biên ải lồng lộng thổi qua lá cờ đỏ sao vàng rộng đúng 54 mét vuông.',
    fact: 'Lá cờ trên đỉnh Lũng Cú có diện tích 54 mét vuông, tượng trưng cho 54 dân tộc anh em trên dải đất Việt Nam.',
    changKe: '…nơi con đèo hiểm trở men theo vách đá nhìn xuống dòng sông xanh ngắt.',
  },
  {
    id: 2,
    name: 'Đèo Mã Pì Lèng',
    province: 'Tuyên Quang',
    lat: 23.239,
    lng: 105.41,
    type: 'Núi',
    wikiTitle: 'Mã Pì Lèng',
    hook: 'Nếu nhìn xuống, bạn có tìm thấy dòng Nho Quế không?',
    moTa: 'Con đèo men theo vách đá của cao nguyên đá Đồng Văn; phía dưới là sông Nho Quế và hẻm vực Tu Sản. Cung đường này nằm trên Con đường Hạnh Phúc, được mở bằng sức người trong nhiều năm.',
    fact: 'Con đường Hạnh Phúc vắt qua đèo Con đường Hạnh Phúc được đồng bào các dân tộc cùng thanh niên xung phong dùng sức người đục đá, mở lối qua vách núi Mã Pì Lèng. suốt nhiều năm.',
    changKe: '…nơi những triền ruộng bậc thang lớp lớp uốn quanh sườn non.',
  },
  {
    id: 3,
    name: 'Ruộng bậc thang Hoàng Su Phì',
    province: 'Tuyên Quang',
    lat: 22.7,
    lng: 104.68,
    type: 'Núi',
    wikiTitle: 'Hoàng Su Phì',
    hook: 'Làm sao người ta gieo lúa trên những sườn núi dựng đứng?',
    moTa: 'Hàng ngàn thửa ruộng bậc thang xếp tầng từ thung lũng lên tận đỉnh đồi như những bậc thang khổng lồ bắc lên trời. Vào mùa lúa chín, cả thung lũng rực lên một sắc vàng óng ả.',
    fact: 'Kỹ thuật canh tác ruộng bậc thang độc đáo nơi đây là kết tinh lao động qua nhiều thế hệ của đồng bào Dao, Nùng và La Chí.',
    changKe: '…nơi đỉnh núi cao nhất bán đảo Đông Dương chạm vào mây trắng.',
  },
  {
    id: 4,
    name: 'Sa Pa – Fansipan',
    province: 'Lào Cai',
    lat: 22.336,
    lng: 103.844,
    type: 'Núi',
    wikiTitle: 'Phan Xi Păng',
    hook: 'Đứng trên \'nóc nhà Đông Dương\', bạn có chạm được vào mây?',
    moTa: 'Sa Pa thường chìm trong sương mờ bên chân dãy Hoàng Liên Sơn. Đỉnh Fansipan cao vút, ngày đẹp trời mở ra cả biển mây cuồn cuộn.',
    fact: 'Đỉnh Fansipan có độ cao 3.143 mét và là ngọn núi cao nhất trên toàn bán đảo Đông Dương.',
    changKe: '…nơi một hồ nước nhân tạo mênh mông ôm trọn hơn một nghìn hòn đảo.',
  },
  {
    id: 5,
    name: 'Hồ Thác Bà',
    province: 'Lào Cai',
    lat: 21.85,
    lng: 105.0,
    type: 'Thiên nhiên',
    wikiTitle: 'Hồ Thác Bà',
    hook: 'Một hồ nước ngọt trên núi mà có tới hơn một nghìn hòn đảo?',
    moTa: 'Lòng hồ Thác Bà phẳng lặng, ôm trọn những đảo nhỏ phủ xanh nhấp nhô giữa làn nước trong. Thuyền nhỏ rẽ nước đưa khách qua những làng bản ven hồ.',
    fact: 'Hồ Thác Bà hình thành khi xây dựng đập thủy điện Thác Bà và có hơn 1.300 hòn đảo lớn nhỏ trong lòng hồ.',
    changKe: '…nơi cội nguồn linh thiêng thờ các vua Hùng dựng nước.',
  },
  {
    id: 6,
    name: 'Đền Hùng',
    province: 'Phú Thọ',
    lat: 21.367,
    lng: 105.323,
    type: 'Lịch sử',
    wikiTitle: 'Đền Hùng',
    hook: 'Nơi triệu người con tìm về mỗi dịp mùng mười tháng ba âm lịch?',
    moTa: 'Quần thể đền cổ ẩn mình dưới tán rừng xanh trên núi Nghĩa Lĩnh. Đây là nơi người Việt hướng về cội nguồn thời các Vua Hùng dựng nước.',
    fact: 'Tín ngưỡng thờ cúng Hùng Vương đã được UNESCO ghi danh là Di sản văn hóa phi vật thể đại diện của nhân loại.',
    changKe: '…nơi trái tim thủ đô gắn liền với truyền thuyết trả gươm báu.',
  },
  {
    id: 7,
    name: 'Hồ Hoàn Kiếm',
    province: 'Hà Nội',
    lat: 21.028,
    lng: 105.852,
    type: 'Lịch sử',
    wikiTitle: 'Hồ Hoàn Kiếm',
    hook: 'Giữa lòng thủ đô triệu dân, khoảng nước xanh biếc này kể câu chuyện gì?',
    moTa: 'Tháp Rùa rêu phong soi bóng xuống mặt nước biếc; cầu Thê Húc son đỏ uốn cong dẫn lối vào đền Ngọc Sơn giữa hàng liễu rủ. Quanh hồ, nhịp sống ngàn năm của người Hà Nội vẫn êm đềm trôi.',
    fact: 'Tên gọi Hoàn Kiếm gắn liền với truyền thuyết vua Lê Lợi hoàn trả gươm thần cho Rùa Vàng sau khi đánh đuổi giặc ngoại xâm.',
    changKe: '…trường đại học đầu tiên lưu giữ những bia tiến sĩ trên lưng rùa đá.',
  },
  {
    id: 8,
    name: 'Văn Miếu – Quốc Tử Giám',
    province: 'Hà Nội',
    lat: 21.029,
    lng: 105.836,
    type: 'Lịch sử',
    wikiTitle: 'Văn Miếu – Quốc Tử Giám',
    hook: 'Trường quốc học đầu tiên của Việt Nam ra đời từ năm 1076, bạn đoán được ở đâu?',
    moTa: 'Khuê Văn Các cổ kính nép mình bên giếng Thiên Quang trong trẻo rợp bóng cây cổ thụ. Dãy bia đá tiến sĩ trầm mặc ghi nhận công lao của những bậc hiền tài xưa.',
    fact: '82 tấm bia tiến sĩ tại Văn Miếu được đặt trên lưng rùa đá uy nghiêm và 82 tấm bia tiến sĩ tại Văn Miếu được đặt trên lưng rùa đá và được UNESCO ghi danh là Di sản tư liệu khu vực châu Á – Thái Bình Dương.',
    changKe: '…nơi hàng nghìn đảo đá vôi kỳ vĩ mọc giữa làn nước xanh ngọc bích.',
  },
  {
    id: 9,
    name: 'Vịnh Hạ Long',
    province: 'Quảng Ninh',
    lat: 20.91,
    lng: 107.184,
    type: 'Biển',
    wikiTitle: 'Vịnh Hạ Long',
    hook: 'Hàng nghìn hòn đảo đá vôi mọc giữa biển xanh từ bao giờ?',
    moTa: 'Những cột đá vôi sừng sững nhấp nhô trên mặt biển ngọc bích như đàn rồng đáp xuống trần gian. Thuyền len lỏi qua các hang động lung linh thạch nhũ huyền ảo.',
    fact: 'Vịnh Hạ Long sở hữu gần 2.000 hòn đảo lớn nhỏ và đã hai lần được UNESCO công nhận là Di sản thiên nhiên thế giới.',
    changKe: '…nơi quần thể hang động và thung lũng nước được ví như Hạ Long trên cạn.',
  },
  {
    id: 10,
    name: 'Tràng An',
    province: 'Ninh Bình',
    lat: 20.253,
    lng: 105.896,
    type: 'Thiên nhiên',
    wikiTitle: 'Quần thể danh thắng Tràng An',
    hook: 'Ngồi thuyền chèo xuyên qua lòng núi đá vôi ngập nước, bạn thấy gì?',
    moTa: 'Dòng suối trong vắt uốn lượn dưới chân những vách núi đá vôi sừng sững phủ kín thảm thực vật xanh rì. Chiếc thuyền nan nhẹ trôi đưa du khách khám phá những hang động kỳ bí ngập nước.',
    fact: 'Tràng An là di sản thế giới hỗn hợp (cả văn hóa lẫn thiên nhiên) đầu tiên của Việt Nam, được UNESCO ghi danh năm 2014.',
    changKe: '…tòa thành quân sự bằng đá xanh sáu thế kỷ không dùng vữa.',
  },
  {
    id: 11,
    name: 'Thành nhà Hồ',
    province: 'Thanh Hóa',
    lat: 20.077,
    lng: 105.605,
    type: 'Lịch sử',
    wikiTitle: 'Thành nhà Hồ',
    hook: 'Những khối đá nặng hàng chục tấn được ghép khít khao không cần vữa bằng cách nào?',
    moTa: 'Bốn cổng vòm đá xanh đồ sộ vẫn đứng uy nghiêm giữa cánh đồng lộng gió sau hơn sáu trăm năm lịch sử. Những phiến đá vuông vức xếp khít đến mức mũi dao khó lách qua.',
    fact: 'Thành nhà Hồ được xây dựng bằng những phiến đá vôi lớn vào năm 1397 và được UNESCO công nhận là Di sản văn hóa thế giới.',
    changKe: '…bãi biển cát thoải nổi tiếng của xứ Thanh với hòn Trống Mái bên chân núi.',
  },
  {
    id: 12,
    name: 'Biển Sầm Sơn',
    province: 'Thanh Hóa',
    lat: 19.734,
    lng: 105.905,
    type: 'Biển',
    wikiTitle: 'Sầm Sơn',
    hook: 'Bãi tắm dài thoai thoải từng là nơi nghỉ dưỡng hơn một trăm năm trước?',
    moTa: 'Từng đợt sóng bạc đầu xô vào bờ cát mịn trải dài dưới chân dãy núi Trường Lệ xanh ngát. Tiếng sóng biển rì rào hòa cùng rặng phi lao đón gió khơi xa.',
    fact: 'Gần bờ biển Sầm Sơn có danh thắng hòn Trống Mái trên núi Trường Lệ gắn liền với câu chuyện tình thủy chung sâu sắc.',
    changKe: '…ngôi làng quê ngát hương sen, nơi Chủ tịch Hồ Chí Minh lớn lên thời niên thiếu.',
  },
  {
    id: 13,
    name: 'Làng Sen (quê Bác)',
    province: 'Nghệ An',
    lat: 18.701,
    lng: 105.535,
    type: 'Lịch sử',
    wikiTitle: 'Kim Liên, Nam Đàn',
    hook: 'Mái nhà tranh đơn sơ dưới bóng tre ngà đã nuôi dưỡng một tâm hồn lớn?',
    moTa: 'Ngôi nhà gỗ mộc mạc mái lá đơn sơ nằm nép mình bên hàng râm bụt đỏ và rặng tre xanh mát. Đầm sen trước ngõ tỏa hương thơm ngát mỗi độ hè về.',
    fact: 'Khu di tích Kim Liên lưu giữ nơi ở thời niên thiếu của Chủ tịch Hồ Chí Minh cùng những kỷ vật giản dị của gia đình Người.',
    changKe: '…bãi biển hoang sơ có tên gọi như cây đàn trời du dương bên chân núi.',
  },
  {
    id: 14,
    name: 'Biển Thiên Cầm',
    province: 'Hà Tĩnh',
    lat: 18.243,
    lng: 106.12,
    type: 'Biển',
    wikiTitle: 'Thiên Cầm',
    hook: 'Tại sao bờ biển này lại mang tên \'cây đàn trời\'?',
    moTa: 'Bãi cát trắng mịn uốn cong hình cánh cung bên làn nước biển xanh biếc và phẳng lặng. Theo lời kể, tiếng sóng gió dội vào vách núi Thiên Cầm nghe như tiếng đàn ngân nga.',
    fact: 'Tên gọi Thiên Cầm tương truyền xuất phát từ tiếng sóng gió dội vào vách núi tựa như tiếng đàn trời du dương.',
    changKe: '…bên dưới mảng rừng xanh ngát này là cả một thế giới hang động kỳ vĩ.',
  },
  {
    id: 15,
    name: 'Phong Nha – Kẻ Bàng',
    province: 'Quảng Trị',
    lat: 17.59,
    lng: 106.283,
    type: 'Thiên nhiên',
    wikiTitle: 'Vườn quốc gia Phong Nha – Kẻ Bàng',
    hook: 'Bên dưới mảng xanh này là cả một thế giới tối kỳ vĩ?',
    moTa: 'Phong Nha – Kẻ Bàng nổi tiếng bởi hệ thống hang động, sông ngầm và thạch nhũ hàng triệu năm tuổi. Sơn Đoòng, hang động tự nhiên lớn nhất thế giới được biết đến, nằm trong vùng núi đá vôi này.',
    fact: 'Khu vực này sở hữu hang Sơn Đoòng – hang động tự nhiên lớn nhất thế giới với hệ sinh thái và rừng nguyên sinh ngay bên trong.',
    changKe: '…dòng sông lịch sử từng chia cắt non sông suốt hơn hai mươi năm.',
  },
  {
    id: 16,
    name: 'Cầu Hiền Lương – sông Bến Hải',
    province: 'Quảng Trị',
    lat: 17.003,
    lng: 107.05,
    type: 'Lịch sử',
    wikiTitle: 'Cầu Hiền Lương',
    hook: 'Một cây cầu hẹp bắc qua dòng sông nhỏ từng chia đôi đất nước?',
    moTa: 'Cây cầu lịch sử nối đôi bờ sông Bến Hải êm trôi. Cột cờ Hiền Lương cao vút ghi dấu khát vọng non sông liền một dải.',
    fact: 'Cây cầu bắc qua vĩ tuyến 17 từng là giới tuyến quân sự tạm thời chia cắt hai miền Nam – Bắc suốt hơn hai mươi năm.',
    changKe: '…hoàng thành cổ kính soi bóng bên dòng sông Hương êm đềm xứ Huế.',
  },
  {
    id: 17,
    name: 'Đại Nội Huế',
    province: 'Huế',
    lat: 16.469,
    lng: 107.578,
    type: 'Lịch sử',
    wikiTitle: 'Hoàng thành Huế',
    hook: 'Kinh thành của triều đại phong kiến cuối cùng lưu giữ những dấu tích gì?',
    moTa: 'Cửa Ngọ Môn sừng sững mở vào sân rộng; điện Thái Hòa nguy nga giữa không gian cổ kính. Nét vàng son cung đình còn lại trong từng mái ngói, hoa văn.',
    fact: 'Quần thể Di tích Cố đô Huế là di sản thế giới đầu tiên của Việt Nam được UNESCO ghi danh vào năm 1993.',
    changKe: '…\'thiên hạ đệ nhất hùng quan\' ngăn hai miền khí hậu Bắc – Nam.',
  },
  {
    id: 18,
    name: 'Đèo Hải Vân',
    province: 'Đà Nẵng',
    lat: 16.193,
    lng: 108.13,
    type: 'Núi',
    wikiTitle: 'Đèo Hải Vân',
    hook: 'Con đèo hiểm trở đâm thẳng ra biển từng được mệnh danh là gì?',
    moTa: 'Đường đèo uốn lượn quanh co trên sườn dãy Bạch Mã với một bên là vách núi dựng đứng, một bên là vực sâu biển thẳm. Đỉnh đèo mây phủ bồng bềnh mở ra góc nhìn ngắm trọn vịnh Lăng Cô và vịnh Đà Nẵng.',
    fact: 'Đèo Hải Vân là ranh giới khí hậu tự nhiên ngăn gió mùa đông bắc tràn xuống phía nam, Trên đỉnh đèo có cổng Hải Vân Quan, được nhà Nguyễn xây từ đầu thế kỷ 19.',
    changKe: '…thành phố của những cây cầu với con rồng thép vươn mình ra biển.',
  },
  {
    id: 19,
    name: 'Cầu Rồng – sông Hàn',
    province: 'Đà Nẵng',
    lat: 16.061,
    lng: 108.227,
    type: 'Thành phố',
    wikiTitle: 'Cầu Rồng',
    hook: 'Cây cầu hình rồng bắc qua sông Hàn có khả năng đặc biệt nào?',
    moTa: 'Cây cầu mô phỏng hình rồng thời Lý màu vàng rực rỡ uốn lượn mạnh mẽ qua mặt nước sông Hàn. Về đêm, ánh đèn led chuyển màu rực rỡ thu hút đông đảo người dân và du khách đứng chật đôi bờ.',
    fact: 'Cầu Rồng có thiết kế độc đáo có thể phun ra lửa và nước vào các tối cuối tuần để phục vụ công chúng.',
    changKe: '…thương cảng cổ rêu phong rực rỡ sắc đèn lồng bên dòng sông Hoài.',
  },
  {
    id: 20,
    name: 'Phố cổ Hội An',
    province: 'Đà Nẵng',
    lat: 15.88,
    lng: 108.335,
    type: 'Lịch sử',
    wikiTitle: 'Hội An',
    hook: 'Những bức tường vàng rực hoa giấy đã chứng kiến thương thuyền từ những nước nào?',
    moTa: 'Những dãy nhà cổ mái ngói âm dương rêu phong nép mình bên dòng sông Hoài phẳng lặng. Đêm xuống, hàng ngàn chiếc đèn lồng lụa thắp sáng lung linh cả khu phố đi bộ.',
    fact: 'Đô thị cổ Hội An từng là thương cảng quốc tế sầm uất từ thế kỷ 16 và được UNESCO công nhận là Di sản văn hóa thế giới.',
    changKe: '…thung lũng đền tháp Chăm Pa nghìn năm tuổi ẩn mình giữa rừng núi.',
  },
  {
    id: 21,
    name: 'Thánh địa Mỹ Sơn',
    province: 'Đà Nẵng',
    lat: 15.764,
    lng: 108.124,
    type: 'Lịch sử',
    wikiTitle: 'Thánh địa Mỹ Sơn',
    hook: 'Bí ẩn nào ẩn giấu trong kỹ thuật ghép những viên gạch đỏ không lộ vữa?',
    moTa: 'Những ngọn tháp gạch Chăm Pa cổ kính màu đỏ nung vươn cao giữa thung lũng lòng chảo xanh ngắt. Các bức phù điêu vũ nữ Apsara uyển chuyển khắc tinh xảo trên thân gạch cổ.',
    fact: 'Thánh địa Mỹ Sơn từng là trung tâm cúng tế linh thiêng của vương quốc Chăm Pa cổ và được UNESCO công nhận là Di sản thế giới.',
    changKe: '…hòn đảo núi lửa ngoài khơi nổi tiếng với những ruộng tỏi trên cát san hô.',
  },
  {
    id: 22,
    name: 'Đảo Lý Sơn',
    province: 'Quảng Ngãi',
    lat: 15.38,
    lng: 109.12,
    type: 'Biển',
    wikiTitle: 'Lý Sơn',
    hook: 'Hòn đảo giữa biển khơi được tạo nên từ những miệng núi lửa cổ đại?',
    moTa: 'Vách đá Hang Câu sừng sững dựng đứng bên bờ biển xanh ngắt phẳng lặng nhìn ra ngút ngàn khơi xa. Những cánh đồng hành tỏi xanh mướt trải dài trên ruộng hành tỏi xanh mướt trải dài trên nền đất núi lửa pha cát ven biển.',
    fact: 'Đảo Lý Sơn hình thành từ các đợt phun trào núi lửa hàng triệu năm trước và được mệnh danh là vương quốc tỏi của Việt Nam.',
    changKe: '…eo biển lộng gió với con đường đi bộ men lưng chừng núi đá hướng ra biển.',
  },
  {
    id: 23,
    name: 'Eo Gió – Quy Nhơn',
    province: 'Gia Lai',
    lat: 13.88,
    lng: 109.29,
    type: 'Biển',
    wikiTitle: 'Quy Nhơn',
    hook: 'Eo biển quanh năm lộng gió với cung đường đi bộ ven núi đá kỳ vĩ?',
    moTa: 'Vách núi đá uốn lượn ôm lấy bờ vịnh nước xanh, quanh năm đón gió biển. Con đường nhỏ men theo lưng chừng núi đá, mở ra tầm nhìn bao la ra đại dương.',
    fact: 'Eo Gió là một eo biển hình cánh cung được tạo bởi hai mỏm núi đá cao vươn thẳng ra biển, nổi tiếng là nơi đón bình minh tuyệt đẹp.',
    changKe: '…tuyệt tác địa chất với hàng ngàn cột đá bazan lục lăng như tổ ong khổng lồ.',
  },
  {
    id: 24,
    name: 'Gành Đá Đĩa',
    province: 'Đắk Lắk',
    lat: 13.355,
    lng: 109.296,
    type: 'Thiên nhiên',
    wikiTitle: 'Gành Đá Đĩa',
    hook: 'Hàng vạn cột đá hình lục lăng xếp khít nhau như tổ ong vươn ra biển?',
    moTa: 'Những khối đá bazan đen bóng hình lục giác xếp lớp ken dày như chồng đĩa khổng lồ vươn ra mép sóng. Từng đợt bọt sóng trắng xóa bắn tung tóe vào gành đá tạo nên cảnh sắc thiên nhiên kỳ thú.',
    fact: 'Gành Đá Đĩa hình thành khi Gành Đá Đĩa hình thành khi dòng dung nham nguội đi, co lại và nứt thành những cột đá nhiều cạnh xếp khít nhau. thành các cột đá hình lăng trụ độc đáo.',
    changKe: '…vịnh biển nhiệt đới với bờ cát trắng uốn cong và nước biển xanh trong vắt.',
  },
  {
    id: 25,
    name: 'Vịnh Nha Trang',
    province: 'Khánh Hòa',
    lat: 12.238,
    lng: 109.196,
    type: 'Biển',
    wikiTitle: 'Vịnh Nha Trang',
    hook: 'Bờ biển uốn cong hình cánh cung bên làn nước ấm áp quanh năm?',
    moTa: 'Bãi cát trắng mịn trải dài men theo rặng dừa xanh soi bóng xuống làn nước biển êm đềm xanh ngọc. Xa xa ngoài vịnh, những hòn đảo lớn nhỏ nhấp nhô giữa làn sóng bạc.',
    fact: 'Vịnh Nha Trang là một trong những vịnh biển đẹp trên thế giới với hệ sinh thái rạn san hô vô cùng phong phú tại Hòn Mun.',
    changKe: '…thành phố ngàn hoa nằm trên cao nguyên mát lạnh rợp bóng thông reo.',
  },
  {
    id: 26,
    name: 'Đà Lạt – hồ Xuân Hương',
    province: 'Lâm Đồng',
    lat: 11.941,
    lng: 108.441,
    type: 'Núi',
    wikiTitle: 'Đà Lạt',
    hook: 'Thành phố sương mù trên cao nguyên mát mẻ quanh năm có gì đặc biệt?',
    moTa: 'Rừng thông bạt ngàn vi vu đón làn gió se lạnh đặc trưng của cao nguyên Lâm Viên. Mặt hồ Xuân Hương êm đềm uốn lượn như tấm gương soi bóng những vườn hoa rực rỡ.',
    fact: 'Đà Lạt nằm ở độ cao khoảng 1.500 mét so với mực nước biển nên có khí hậu mát mẻ quanh năm với nhiệt độ trung bình dễ chịu.',
    changKe: '…tiểu sa mạc ven biển liên tục thay đổi hình dáng theo từng đợt gió thổi.',
  },
  {
    id: 27,
    name: 'Đồi cát Mũi Né',
    province: 'Lâm Đồng',
    lat: 10.933,
    lng: 108.287,
    type: 'Thiên nhiên',
    wikiTitle: 'Mũi Né',
    hook: 'Đồi cát ven biển nào thay đổi hình dáng và màu sắc theo từng giờ?',
    moTa: 'Những triền cát thoai thoải trải dài mênh mông như sa mạc nhỏ sát ngay mép biển xanh. Gió biển thổi liên tục vẽ nên những vân cát kỳ ảo biến đổi không ngừng sau mỗi cơn gió.',
    fact: 'Đồi cát Mũi Né còn được gọi là đồi cát bay bởi hình dáng của các cồn cát thay đổi liên tục theo từng hướng gió thổi trong ngày.',
    changKe: '…nơi người thanh niên Nguyễn Tất Thành ra đi tìm đường cứu nước bên sông Sài Gòn.',
  },
  {
    id: 28,
    name: 'Bến Nhà Rồng – TP.HCM',
    province: 'TP.HCM',
    lat: 10.768,
    lng: 106.707,
    type: 'Thành phố',
    wikiTitle: 'Bến Nhà Rồng',
    hook: 'Tòa nhà cổ kính bên sông Sài Gòn đã chứng kiến bước ngoặt lịch sử nào?',
    moTa: 'Kiến trúc phương Tây cổ kính nổi bật với đôi rồng gốm uốn lượn chầu mặt trăng trên đỉnh mái ngói đỏ. Trước mặt bến cảng, dòng sông Sài Gòn tấp nập tàu thuyền qua lại đêm ngày.',
    fact: 'Năm 1911, người thanh niên yêu nước Nguyễn Tất Thành đã từ Bến Nhà Rồng ra đi tìm con đường cứu nước cho dân tộc Việt Nam.',
    changKe: '…mạng lưới địa đạo bí mật dài hàng trăm cây số ngoằn ngoèo dưới lòng đất.',
  },
  {
    id: 29,
    name: 'Địa đạo Củ Chi',
    province: 'TP.HCM',
    lat: 11.142,
    lng: 106.462,
    type: 'Lịch sử',
    wikiTitle: 'Địa đạo Củ Chi',
    hook: 'Cả một \'thành phố ngầm\' tồn tại dưới lòng đất trong khói lửa chiến tranh?',
    moTa: 'Hệ thống đường hầm chật hẹp ngoằn ngoèo xuyên qua lòng đất đất sét đỏ chắc nịch. Dưới lòng đất sâu là cả một hệ sinh thái kháng chiến kiên cường với bếp Hoàng Cầm, giếng nước và trạm cứu thương.',
    fact: 'Địa đạo Củ Chi là hệ thống đường hầm dài hơn 200 km, đan nhiều tầng dưới lòng đất. đan cài nhiều tầng sâu khác nhau dưới lòng đất.',
    changKe: '…khu chợ nổi rộn rã ghe xuồng buôn bán nông sản bằng \'cây bẹo\' từ tờ mờ sáng.',
  },
  {
    id: 30,
    name: 'Chợ nổi Cái Răng',
    province: 'Cần Thơ',
    lat: 10.003,
    lng: 105.746,
    type: 'Ẩm thực',
    wikiTitle: 'Chợ nổi Cái Răng',
    hook: 'Đi chợ giữa mênh mông sông nước mà không nghe tiếng rao, làm sao biết người ta bán gì?',
    moTa: 'Ghe xuồng tấp nập bồng bềnh từ tờ mờ sáng trên khúc sông Cần Thơ trù phú. Những món ăn nóng sốt và trái cây miệt vườn tươi rói được chuyền tay ngay trên mạn thuyền rộn rã.',
    fact: 'Thương hồ trên chợ nổi treo nông sản mình bán lên ngọn sào tre cao trước mũi thuyền gọi là \'cây bẹo\' để khách từ xa dễ nhận biết mà không cần cất tiếng rao.',
    changKe: '…thảm bèo xanh biếc phủ kín mặt nước dưới tán rừng tràm mùa nước nổi.',
  },
  {
    id: 31,
    name: 'Rừng tràm Trà Sư',
    province: 'An Giang',
    lat: 10.583,
    lng: 105.058,
    type: 'Thiên nhiên',
    wikiTitle: 'Rừng tràm Trà Sư',
    hook: 'Nơi chiếc xuồng ba lá lướt đi trên tấm thảm bèo xanh mướt như ngọc lục bảo?',
    moTa: 'Chiếc xuồng chèo nhẹ rẽ lối qua thảm bèo cám xanh rì phủ kín mặt nước tĩnh lặng. Dưới bóng rừng tràm xanh rợp, nhiều loài chim nước ríu rít gọi bầy trong nắng sớm., hàng ngàn cánh chim ríu rít gọi bầy trong nắng sớm.',
    fact: 'Rừng tràm Trà Sư là khu rừng ngập nước tiêu biểu của vùng Tây sông Hậu, nơi sinh sống của nhiều loài chim nước và thủy sinh quý hiếm.',
    changKe: '…điểm cực Nam đất liền Việt Nam, nơi đất nở ra và rừng vươn ra biển.',
  },
  {
    id: 32,
    name: 'Mũi Cà Mau',
    province: 'Cà Mau',
    lat: 8.6,
    lng: 104.72,
    type: 'Thiên nhiên',
    wikiTitle: 'Mũi Cà Mau',
    hook: 'Đi hết dải đất chữ S, phía trước còn là biển rộng bao la.',
    moTa: 'Đây là điểm cực Nam trên đất liền Việt Nam, giữa hệ sinh thái rừng ngập mặn Cà Mau bạt ngàn. Mốc tọa độ quốc gia và biểu tượng con tàu căng gió vươn mình ra biển khơi xanh thẳm.',
    fact: 'Rừng ngập mặn Cà Mau là khu dự trữ sinh quyển thế giới, nơi rừng đước vươn rễ bồi đắp phù sa lấn dần ra biển hàng năm.',
    changKe: 'Bạn đã đi hết tuyến hành trình 32 điểm dừng dọc theo chiều dài Việt Nam!',
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

export async function buildDocVnData() {
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
      description: s.moTa, // Alias bảo đảm tương thích ngược 100% với các test cũ
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

  // Đọc ranh giới 34 tỉnh và xuất chung 1 phép chiếu LAEA
  const provincesRaw = JSON.parse(readFileSync(PROVINCES_FILE, 'utf8'));
  for (const f of provincesRaw.features) {
    const fixed = fixProvinceName(f);
    f.properties.TinhThanh = fixed;
  }

  // Đơn giản hoá các tỉnh bằng mapshaper (8% điểm)
  const outSimpl = await mapshaper.applyCommands(
    '-i in.json -simplify visvalingam 8% keep-shapes -clean -o out.json format=geojson',
    { 'in.json': Buffer.from(JSON.stringify(provincesRaw)) }
  );
  const simplGeojson = JSON.parse(outSimpl['out.json'].toString());

  // Hợp nhất toàn quốc thành đường biên Việt Nam
  const outDissolve = await mapshaper.applyCommands(
    '-i in.json -dissolve -clean -o out.json format=geojson',
    { 'in.json': Buffer.from(outSimpl['out.json']) }
  );
  const dissolveGeojson = JSON.parse(outDissolve['out.json'].toString());

  const projectCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      const p = proj(coords);
      return p ? [Number(p[0].toFixed(1)), Number(p[1].toFixed(1))] : [0, 0];
    }
    return coords.map(projectCoords);
  };

  const provinces = {};
  for (const f of simplGeojson.features) {
    const name = f.properties.TinhThanh;
    const slug = slugify(name);
    const projCoords = projectCoords(f.geometry.coordinates);
    const d = toSvgPath(projCoords, 10000);
    const c = geoCentroid(f.geometry);
    const [cx, cy] = proj(c);
    provinces[slug] = {
      name,
      d,
      labelX: Number(cx.toFixed(1)),
      labelY: Number(cy.toFixed(1)),
    };
  }

  const vnGeom = dissolveGeojson.geometries ? dissolveGeojson.geometries[0] : dissolveGeojson.geometry;
  const vnProjCoords = projectCoords(vnGeom.coordinates);
  const vnPath = toSvgPath(vnProjCoords, 330000);

  return {
    center: VN_LAEA_CENTER,
    totalKm,
    straightKm,
    cumulativeDistances,
    stops,
    provinces,
    vnPath,
  };
}

async function main() {
  const data = await buildDocVnData();
  writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Đã xuất ${OUT_FILE}`);
  console.log(`- Điểm dừng: ${data.stops.length}`);
  console.log(`- Tỉnh thành: ${Object.keys(data.provinces).length}`);
  console.log(`- Tổng khoảng cách dọc tuyến: ${data.totalKm} km`);
  console.log(`- Đường thẳng Lũng Cú – Cà Mau: ${data.straightKm} km`);
}

main().catch((err) => {
  console.error('Lỗi build-doc-vn:', err);
  process.exit(1);
});
