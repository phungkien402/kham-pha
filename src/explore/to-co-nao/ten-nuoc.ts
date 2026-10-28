// src/explore/to-co-nao/ten-nuoc.ts
// Bảng chuẩn hoá tên tiếng Việt cho các quốc gia từ dữ liệu Natural Earth NAME_VI.

export const TEN_NUOC_GHI_DE: Record<string, string> = {
  // Chuẩn hoá theo tên quen thuộc người Việt
  cze: 'Séc',
  kor: 'Hàn Quốc',
  prk: 'Triều Tiên',
  civ: 'Bờ Biển Ngà',
  rus: 'Nga',
  usa: 'Mỹ',
  gbr: 'Anh',
  nld: 'Hà Lan',
  lao: 'Lào',
  khm: 'Campuchia',
  deu: 'Đức',
  fra: 'Pháp',
  ita: 'Ý',
  jpn: 'Nhật Bản',
  chn: 'Trung Quốc',
  aus: 'Úc',
  ind: 'Ấn Độ',
  tha: 'Thái Lan',
  mys: 'Malaysia',
  sgp: 'Singapore',
  idn: 'Indonesia',
  phl: 'Philippines',
  mmr: 'Myanmar',
  brn: 'Brunei',
  tls: 'Đông Timor',
  bel: 'Bỉ',
  lux: 'Luxembourg',
  svn: 'Slovenia',
  che: 'Thụy Sĩ',
  swe: 'Thụy Điển',
  nor: 'Na Uy',
  fin: 'Phần Lan',
  esp: 'Tây Ban Nha',
  prt: 'Bồ Đào Nha',
  pol: 'Ba Lan',
  ukr: 'Ukraine',
  can: 'Canada',
  bra: 'Brazil',
  arg: 'Argentina',
  egy: 'Ai Cập',
  zaf: 'Nam Phi',
  tur: 'Thổ Nhĩ Kỳ',
  sau: 'Ả Rập Xê Út',
  irn: 'Iran',
  irq: 'Iraq',
  isr: 'Israel',
  nzl: 'New Zealand',
  cub: 'Cuba',
  mex: 'Mexico',
  chl: 'Chile',
  grc: 'Hy Lạp',
  aut: 'Áo',
  hun: 'Hungary',
  dnk: 'Đan Mạch',
  irl: 'Ireland',
  vat: 'Vatican',
  mco: 'Monaco',
};

/**
 * Lấy tên tiếng Việt chuẩn của quốc gia dựa trên mã ISO A3 và tên mặc định từ nguồn.
 */
export function getTenNuoc(isoA3: string, defaultName = ''): string {
  const code = (isoA3 || '').toLowerCase();
  return TEN_NUOC_GHI_DE[code] ?? defaultName ?? isoA3.toUpperCase();
}

/**
 * Danh sách mã ISO A3 (~50 nước) thuộc nhóm phổ biến (chunk nuoc-pho-bien.json):
 * Bao gồm các nước trong kèo kinh điển, ASEAN, Đông Á, G20 và các nước châu Âu lớn.
 */
export const POPULAR_COUNTRY_CODES: Set<string> = new Set([
  // Kèo kinh điển
  'bel', // Bỉ
  'jpn', // Nhật Bản
  'sgp', // Singapore
  'lux', // Luxembourg
  'ita', // Ý
  'svn', // Slovenia

  // ASEAN
  'tha',
  'mys',
  'idn',
  'phl',
  'lao',
  'khm',
  'mmr',
  'brn',
  'tls',

  // Đông Á
  'chn',
  'kor',
  'prk',
  'mng',
  'twn',

  // G20 & Cường quốc
  'usa',
  'rus',
  'gbr',
  'fra',
  'deu',
  'ind',
  'can',
  'aus',
  'bra',
  'arg',
  'mex',
  'zaf',
  'sau',
  'tur',

  // Châu Âu lớn & tiêu biểu
  'esp',
  'prt',
  'nld',
  'che',
  'swe',
  'nor',
  'fin',
  'pol',
  'ukr',
  'aut',
  'dnk',
  'irl',
  'grc',
  'cze',
  'hun',
  'rou',

  // Trung Đông & Châu Phi tiêu biểu
  'egy',
  'irn',
  'isr',
  'nzl',
]);

export function isPopularCountry(isoA3: string): boolean {
  return POPULAR_COUNTRY_CODES.has((isoA3 || '').toLowerCase());
}
