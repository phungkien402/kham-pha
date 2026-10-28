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

export interface ProvinceInfo {
  name: string;
  region: RegionCode;
}

export const PROVINCES_34: readonly ProvinceInfo[] = (
  ['bac', 'trung', 'nam'] as const
).flatMap((region) =>
  PROVINCES_BY_REGION[region].map((name) => ({ name, region })),
);

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
