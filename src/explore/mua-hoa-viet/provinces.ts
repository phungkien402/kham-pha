export type RegionCode = 'bac' | 'trung' | 'nam';

export const PROVINCES_BY_REGION: Record<RegionCode, readonly string[]> = {
  bac: [
    'Hà Nội',
    'Hải Phòng',
    'Quảng Ninh',
    'Tuyên Quang',
    'Lào Cai',
    'Thái Nguyên',
    'Phú Thọ',
    'Bắc Ninh',
    'Hưng Yên',
    'Ninh Bình',
    'Cao Bằng',
    'Lạng Sơn',
    'Lai Châu',
    'Điện Biên',
    'Sơn La',
  ],
  trung: [
    'Thanh Hóa',
    'Nghệ An',
    'Hà Tĩnh',
    'Quảng Trị',
    'Huế',
    'Đà Nẵng',
    'Quảng Ngãi',
    'Gia Lai',
    'Khánh Hòa',
    'Đắk Lắk',
    'Lâm Đồng',
  ],
  nam: [
    'TP. Hồ Chí Minh',
    'Đồng Nai',
    'Tây Ninh',
    'Cần Thơ',
    'Vĩnh Long',
    'Đồng Tháp',
    'Cà Mau',
    'An Giang',
  ],
};

export interface ProvinceCoords {
  lat: number;
  lng: number;
}

/**
 * Bảng toạ độ trung tâm hành chính (tỉnh lỵ / trung tâm TP trực thuộc TW) của 34 tỉnh, thành phố
 * sau sáp nhập 2025 (theo Nghị quyết 202/2025/QH15).
 * Nguồn toạ độ: Cục Đo đạc, Bản đồ và Thông tin địa lý Việt Nam / OpenStreetMap (WGS84).
 */
export const PROVINCE_COORDS: Readonly<Record<string, ProvinceCoords>> = {
  // Miền Bắc (15)
  'Hà Nội': { lat: 21.0285, lng: 105.8542 },
  'Hải Phòng': { lat: 20.8449, lng: 106.6881 },
  'Quảng Ninh': { lat: 20.9599, lng: 107.0425 },
  'Tuyên Quang': { lat: 21.8236, lng: 105.2142 },
  'Lào Cai': { lat: 22.4856, lng: 103.9707 },
  'Thái Nguyên': { lat: 21.5942, lng: 105.8482 },
  'Phú Thọ': { lat: 21.3227, lng: 105.4019 },
  'Bắc Ninh': { lat: 21.1861, lng: 106.0763 },
  'Hưng Yên': { lat: 20.6464, lng: 106.0511 },
  'Ninh Bình': { lat: 20.2506, lng: 105.9745 },
  'Cao Bằng': { lat: 22.6657, lng: 106.2579 },
  'Lạng Sơn': { lat: 21.8537, lng: 106.7615 },
  'Lai Châu': { lat: 22.3862, lng: 103.4703 },
  'Điện Biên': { lat: 21.386, lng: 103.0169 },
  'Sơn La': { lat: 21.3256, lng: 103.9188 },
  // Miền Trung (11)
  'Thanh Hóa': { lat: 19.8067, lng: 105.7852 },
  'Nghệ An': { lat: 18.6796, lng: 105.6813 },
  'Hà Tĩnh': { lat: 18.3428, lng: 105.9057 },
  'Quảng Trị': { lat: 16.8163, lng: 107.1003 },
  'Huế': { lat: 16.4637, lng: 107.5909 },
  'Đà Nẵng': { lat: 16.0544, lng: 108.2022 },
  'Quảng Ngãi': { lat: 15.1205, lng: 108.7923 },
  'Gia Lai': { lat: 13.9833, lng: 108.0 },
  'Khánh Hòa': { lat: 12.2388, lng: 109.1967 },
  'Đắk Lắk': { lat: 12.6667, lng: 108.05 },
  'Lâm Đồng': { lat: 11.9404, lng: 108.4583 },
  // Miền Nam (8)
  'TP. Hồ Chí Minh': { lat: 10.7769, lng: 106.7009 },
  'Đồng Nai': { lat: 10.9574, lng: 106.8427 },
  'Tây Ninh': { lat: 11.31, lng: 106.0983 },
  'Cần Thơ': { lat: 10.0452, lng: 105.7469 },
  'Vĩnh Long': { lat: 10.2537, lng: 105.9722 },
  'Đồng Tháp': { lat: 10.4594, lng: 105.6325 },
  'Cà Mau': { lat: 9.1768, lng: 105.1524 },
  'An Giang': { lat: 10.3864, lng: 105.4352 },
};

export interface ProvinceInfo {
  name: string;
  region: RegionCode;
  lat: number;
  lng: number;
}

export const PROVINCES_34: readonly ProvinceInfo[] = (
  ['bac', 'trung', 'nam'] as const
).flatMap((region) =>
  PROVINCES_BY_REGION[region].map((name) => ({
    name,
    region,
    lat: PROVINCE_COORDS[name].lat,
    lng: PROVINCE_COORDS[name].lng,
  })),
);

export function getProvinceCoords(province: string | null | undefined): ProvinceCoords | undefined {
  if (!province) return undefined;
  const trimmed = province.trim();
  if (PROVINCE_COORDS[trimmed]) return PROVINCE_COORDS[trimmed];
  const lower = trimmed.toLowerCase();
  for (const p of PROVINCES_34) {
    if (lower.startsWith(p.name.toLowerCase())) {
      return { lat: p.lat, lng: p.lng };
    }
  }
  return undefined;
}

export const PROVINCE_NAMES_34: readonly string[] = PROVINCES_34.map((p) => p.name);

export const PROVINCE_TO_REGION: Readonly<Record<string, RegionCode>> = Object.fromEntries(
  PROVINCES_34.map((p) => [p.name, p.region]),
);

export function getRegionForProvince(province: string | null | undefined): RegionCode | undefined {
  if (!province) return undefined;
  const trimmed = province.trim();
  if (PROVINCE_TO_REGION[trimmed]) return PROVINCE_TO_REGION[trimmed];
  const lower = trimmed.toLowerCase();
  for (const p of PROVINCES_34) {
    if (lower.startsWith(p.name.toLowerCase())) {
      return p.region;
    }
  }
  return undefined;
}

export const REGION_LABELS: Record<RegionCode, string> = {
  bac: 'Miền Bắc',
  trung: 'Miền Trung',
  nam: 'Miền Nam',
};

/**
 * Bảng màu dự phòng khi người dùng không chọn màu cho loài hoa mới.
 * Tất cả đều có độ tương phản tốt trên nền sáng và khác với 13 màu gốc trong flowers.json.
 */
export const FLOWER_COLOR_PALETTE: readonly string[] = [
  '#D45B7A',
  '#6B5B95',
  '#C94A29',
  '#2E8B57',
  '#D9822B',
  '#8E44AD',
  '#2980B9',
  '#C0392B',
  '#16A085',
  '#B9770E',
  '#A93226',
  '#7D3C98',
  '#1F618D',
  '#117864',
  '#B7950B',
  '#AF601A',
  '#900C3F',
  '#581845',
  '#2874A6',
  '#239B56',
];
