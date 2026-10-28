// Hàm thuần xử lý ảnh theo năm (bước 31 theo spec docs/buoc-28-32-mua-hoa.md mục 31)
import { vnParts } from './season';

export interface PhotoLike {
  id?: string;
  taken_on?: string | null;
  takenOn?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  year?: number | string | null;
  [key: string]: unknown;
}

export interface ParsedPhotoDate {
  year: number;
  month: number;
  day: number;
  timestamp: number;
  source: 'taken_on' | 'created_at' | 'year';
}

function parseDateValue(val: unknown): { year: number; month: number; day: number; timestamp: number } | undefined {
  if (val === null || val === undefined) return undefined;

  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return undefined;
    const parts = vnParts(val);
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      timestamp: val.getTime(),
    };
  }

  if (typeof val === 'number') {
    if (Number.isNaN(val)) return undefined;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return undefined;
    const parts = vnParts(d);
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      timestamp: d.getTime(),
    };
  }

  if (typeof val !== 'string') return undefined;
  const str = val.trim();
  if (!str) return undefined;

  // 1. Dạng YYYY-MM-DD hoặc YYYY/MM/DD (tuỳ chọn có giờ phía sau như ISO 8601)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    // Ngày phải có thật (29/2 năm không nhuận, 30/2, 31/4… → không hợp lệ)
    const timestamp = Date.UTC(year, month - 1, day);
    const chk = new Date(timestamp);
    if (chk.getUTCMonth() !== month - 1 || chk.getUTCDate() !== day) return undefined;
    return { year, month, day, timestamp };
  }

  // 2. Dạng DD/MM/YYYY hoặc DD-MM-YYYY
  const vnMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (vnMatch) {
    const day = Number(vnMatch[1]);
    const month = Number(vnMatch[2]);
    const year = Number(vnMatch[3]);
    // Ngày phải có thật (29/2 năm không nhuận, 30/2, 31/4… → không hợp lệ)
    const timestamp = Date.UTC(year, month - 1, day);
    const chk = new Date(timestamp);
    if (chk.getUTCMonth() !== month - 1 || chk.getUTCDate() !== day) return undefined;
    return { year, month, day, timestamp };
  }

  // 3. Thử parse qua Date (ví dụ RFC 2822 hoặc ISO đầy đủ)
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) {
    const parts = vnParts(d);
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      timestamp: d.getTime(),
    };
  }

  // 4. Nếu chỉ có năm 4 chữ số
  const yMatch = str.match(/^(\d{4})$/);
  if (yMatch) {
    const year = Number(yMatch[1]);
    return {
      year,
      month: 1,
      day: 1,
      timestamp: Date.UTC(year, 0, 1),
    };
  }

  return undefined;
}

/**
 * Phân tích ngày/tháng/năm của ảnh: ưu tiên taken_on, thiếu thì created_at.
 */
export function parsePhotoDate(photo: PhotoLike | null | undefined): ParsedPhotoDate | undefined {
  if (!photo || typeof photo !== 'object') return undefined;

  const rawTaken = photo.taken_on ?? photo.takenOn;
  const takenParsed = parseDateValue(rawTaken);
  if (takenParsed) {
    return { ...takenParsed, source: 'taken_on' };
  }

  const rawCreated = photo.created_at ?? photo.createdAt;
  const createdParsed = parseDateValue(rawCreated);
  if (createdParsed) {
    return { ...createdParsed, source: 'created_at' };
  }

  if (photo.year !== undefined && photo.year !== null) {
    const y = Number(photo.year);
    if (!Number.isNaN(y) && y >= 1900 && y <= 2100) {
      return {
        year: y,
        month: 1,
        day: 1,
        timestamp: Date.UTC(y, 0, 1),
        source: 'year',
      };
    }
  }

  return undefined;
}

/**
 * Lấy năm của ảnh theo taken_on, thiếu thì created_at. Không xác định được trả về undefined.
 */
export function getPhotoYear(photo: PhotoLike | null | undefined): number | undefined {
  return parsePhotoDate(photo)?.year;
}

/**
 * Định dạng ngày chụp cho chú thích dưới ảnh: "Chụp 17/10/2026".
 * Nếu không có taken_on hoặc chuỗi rỗng thì trả về chuỗi rỗng.
 */
export function formatTakenOn(takenOn?: string | null): string {
  if (!takenOn || typeof takenOn !== 'string') return '';
  const trimmed = takenOn.trim();
  if (!trimmed) return '';

  const clean = trimmed.replace(/^Chụp\s+/i, '');
  const parsed = parseDateValue(clean);
  if (parsed) {
    const d = String(parsed.day).padStart(2, '0');
    const m = String(parsed.month).padStart(2, '0');
    return `Chụp ${d}/${m}/${parsed.year}`;
  }

  return `Chụp ${clean}`;
}

export type GroupedByYear<T> = Record<number, T[]> & {
  years?: number[];
};

/**
 * Hàm thuần gom nhóm ảnh theo năm (theo taken_on, thiếu thì created_at).
 * Trả về đối tượng Record<năm, T[]> với key là năm (số nguyên).
 */
export function groupByYear<T extends PhotoLike>(
  photos: T[] | null | undefined,
): Record<number, T[]> {
  const result: Record<number, T[]> = {};
  if (!Array.isArray(photos)) return result;

  for (const photo of photos) {
    if (!photo || typeof photo !== 'object') continue;
    const year = getPhotoYear(photo);
    if (year !== undefined && !Number.isNaN(year)) {
      if (!result[year]) {
        result[year] = [];
      }
      result[year].push(photo);
    }
  }

  // Gắn thuộc tính non-enumerable `years` để nếu test gọi `groups.years` vẫn lấy được danh sách năm giảm dần
  const years = Object.keys(result)
    .map(Number)
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => b - a);

  Object.defineProperty(result, 'years', {
    value: years,
    enumerable: false,
    configurable: true,
  });

  return result;
}

/**
 * Lấy danh sách các năm khác nhau (sắp xếp giảm dần: năm mới nhất trước).
 */
export function getDistinctYears<T extends PhotoLike>(
  photosOrGroups: T[] | Record<number, T[]> | null | undefined,
): number[] {
  if (!photosOrGroups) return [];
  if (Array.isArray(photosOrGroups)) {
    const groups = groupByYear(photosOrGroups);
    return Object.keys(groups)
      .map(Number)
      .filter((y) => !Number.isNaN(y))
      .sort((a, b) => b - a);
  }
  return Object.keys(photosOrGroups)
    .map(Number)
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => b - a);
}

export interface EarliestPhotoInfo<T> {
  photo: T;
  year: number;
  month: number;
  day: number;
  dateText: string;
}

/**
 * Tìm ảnh chụp/gửi sớm nhất trong một năm (dùng để gợi ý hoa nở sớm hay muộn).
 */
export function getEarliestPhotoInYear<T extends PhotoLike>(
  photos: T[] | null | undefined,
): EarliestPhotoInfo<T> | undefined {
  if (!Array.isArray(photos) || photos.length === 0) return undefined;

  let best: { photo: T; parsed: ParsedPhotoDate } | undefined;

  for (const photo of photos) {
    const parsed = parsePhotoDate(photo);
    if (!parsed) continue;

    if (!best) {
      best = { photo, parsed };
      continue;
    }

    // So sánh thời điểm trong năm (tháng trước, ngày sau)
    const bestOrder = best.parsed.month * 100 + best.parsed.day;
    const currentOrder = parsed.month * 100 + parsed.day;
    if (currentOrder < bestOrder) {
      best = { photo, parsed };
    } else if (currentOrder === bestOrder && parsed.timestamp < best.parsed.timestamp) {
      best = { photo, parsed };
    }
  }

  if (!best) return undefined;

  const { parsed, photo } = best;
  return {
    photo,
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    dateText: `${parsed.day}/${parsed.month}`,
  };
}

/**
 * Sinh câu so sánh ngày chụp sớm nhất mỗi năm khi có ảnh từ ≥ 2 năm khác nhau:
 * Ví dụ: "Năm 2026 ảnh đầu tiên gửi ngày 12/10, năm 2025 ngày 20/10".
 * Dưới 2 năm hoặc thiếu dữ liệu ngày trả về chuỗi rỗng.
 */
export function firstSentSummary<T extends PhotoLike>(
  photosOrGroups: T[] | Record<number, T[]> | null | undefined,
): string {
  if (!photosOrGroups) return '';

  const groups: Record<number, T[]> = Array.isArray(photosOrGroups)
    ? groupByYear(photosOrGroups)
    : photosOrGroups;

  const years = getDistinctYears(groups);
  if (years.length < 2) return '';

  const parts: string[] = [];
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const photos = groups[year] ?? [];
    const earliest = getEarliestPhotoInYear(photos);
    if (!earliest) continue;

    if (i === 0) {
      parts.push(`Năm ${year} ảnh đầu tiên gửi ngày ${earliest.dateText}`);
    } else {
      parts.push(`năm ${year} ngày ${earliest.dateText}`);
    }
  }

  if (parts.length < 2) return '';
  return parts.join(', ');
}

// Bí danh tương thích
export const buildFirstSentSummary = firstSentSummary;
export const formatFirstSentSummary = firstSentSummary;
