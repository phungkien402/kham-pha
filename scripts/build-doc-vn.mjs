// scripts/build-doc-vn.mjs
// Tạo dữ liệu tuyến hành trình Bắc -> Nam cho bước E (/to-co-nao)
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
    description: 'Điểm cực Bắc Việt Nam, trên cao nguyên đá Đồng Văn.',
  },
  {
    id: 2,
    name: 'Hà Nội',
    province: 'Hà Nội',
    lat: 21.028,
    lng: 105.854,
    description: 'Thủ đô nghìn năm, giữa đồng bằng sông Hồng.',
  },
  {
    id: 3,
    name: 'Tràng An',
    province: 'Ninh Bình',
    lat: 20.253,
    lng: 105.896,
    description: 'Quần thể danh thắng được UNESCO công nhận, núi đá vôi giữa đồng lúa.',
  },
  {
    id: 4,
    name: 'Thanh Hoá',
    province: 'Thanh Hóa',
    lat: 19.807,
    lng: 105.776,
    description: 'Cửa ngõ Bắc Trung Bộ.',
  },
  {
    id: 5,
    name: 'Vinh',
    province: 'Nghệ An',
    lat: 18.673,
    lng: 105.692,
    description: 'Thành phố bên sông Lam.',
  },
  {
    id: 6,
    name: 'Phong Nha – Kẻ Bàng',
    province: 'Quảng Trị',
    lat: 17.590,
    lng: 106.283,
    description: 'Vùng hang động đá vôi nổi tiếng thế giới. Gần đây Việt Nam hẹp nhất, chỉ khoảng 50 km từ biển tới biên giới Lào.',
  },
  {
    id: 7,
    name: 'Huế',
    province: 'Huế',
    lat: 16.463,
    lng: 107.590,
    description: 'Cố đô triều Nguyễn bên sông Hương.',
  },
  {
    id: 8,
    name: 'Đèo Hải Vân',
    province: 'Đà Nẵng',
    lat: 16.193,
    lng: 108.130,
    description: 'Dãy Bạch Mã – Hải Vân là ranh giới khí hậu: phía Bắc có mùa đông lạnh, phía Nam ấm quanh năm.',
  },
  {
    id: 9,
    name: 'Hội An',
    province: 'Đà Nẵng',
    lat: 15.880,
    lng: 108.335,
    description: 'Phố cổ được UNESCO công nhận.',
  },
  {
    id: 10,
    name: 'Quy Nhơn',
    province: 'Gia Lai',
    lat: 13.782,
    lng: 109.219,
    description: 'Thành phố biển của Nam Trung Bộ.',
  },
  {
    id: 11,
    name: 'Nha Trang',
    province: 'Khánh Hòa',
    lat: 12.238,
    lng: 109.196,
    description: 'Vịnh biển nổi tiếng.',
  },
  {
    id: 12,
    name: 'Phan Thiết – Mũi Né',
    province: 'Lâm Đồng',
    lat: 10.933,
    lng: 108.102,
    description: 'Đồi cát đỏ, vùng khô hạn nhất Việt Nam nằm gần đây.',
  },
  {
    id: 13,
    name: 'TP. Hồ Chí Minh',
    province: 'TP.HCM',
    lat: 10.776,
    lng: 106.700,
    description: 'Đô thị lớn nhất cả nước.',
  },
  {
    id: 14,
    name: 'Cần Thơ',
    province: 'Cần Thơ',
    lat: 10.034,
    lng: 105.788,
    description: 'Trung tâm đồng bằng sông Cửu Long, chợ nổi.',
  },
  {
    id: 15,
    name: 'Mũi Cà Mau',
    province: 'Cà Mau',
    lat: 8.600,
    lng: 104.720,
    description: 'Điểm cực Nam đất liền, rừng ngập mặn.',
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
      RAW_STOPS[14].lat,
      RAW_STOPS[14].lng
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
