// Logic mùa nở: thuần TypeScript, không phụ thuộc Astro để test được bằng vitest.
// Ngày luôn tính theo giờ Việt Nam (Asia/Ho_Chi_Minh), xem spec mục 4.

export interface MonthDay {
  month: number; // 1–12
  day?: number;
}

export interface SeasonFlower {
  slug?: string;
  season: { start: MonthDay; peak?: MonthDay; end: MonthDay };
}

export type BloomStatus = 'chua-no' | 'sap-no' | 'dang-no' | 'dinh-mua' | 'sap-tan' | 'het-mua';

/** Số ngày để coi là "sắp nở" / "sắp tàn". */
export const SOON_DAYS = 14;
/** Đỉnh mùa = ngày đỉnh ± số ngày này (đỉnh chỉ ghi tháng thì lấy ngày 15). */
export const PEAK_HALF_WIDTH = 7;

const DAY_MS = 86_400_000;

const vnFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Năm/tháng/ngày của một thời điểm theo giờ Việt Nam. */
export function vnParts(date: Date): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(vnFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

const dayNumber = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / DAY_MS;
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Mùa có phủ tháng này không (chính xác theo tháng; mùa vắt năm như 12 → 2 được xử lý). */
export function inSeason(flower: SeasonFlower, month: number): boolean {
  const { start, end } = flower.season;
  return start.month <= end.month
    ? month >= start.month && month <= end.month
    : month >= start.month || month <= end.month;
}

interface Occurrence {
  start: number;
  end: number;
  peakStart: number;
  peakEnd: number;
}

// Một lần nở bắt đầu vào năm `year` (kết thúc cùng năm, hoặc năm sau nếu vắt năm).
function occurrence(flower: SeasonFlower, year: number): Occurrence {
  const { start, peak, end } = flower.season;
  const endYear = end.month < start.month ? year + 1 : year;
  const s = dayNumber(year, start.month, start.day ?? 1);
  const e = dayNumber(endYear, end.month, end.day ?? daysInMonth(endYear, end.month));
  let peakPoint: number;
  if (peak) {
    const peakYear = peak.month < start.month ? year + 1 : year;
    peakPoint = dayNumber(peakYear, peak.month, peak.day ?? 15);
  } else {
    peakPoint = Math.round((s + e) / 2);
  }
  return { start: s, end: e, peakStart: peakPoint - PEAK_HALF_WIDTH, peakEnd: peakPoint + PEAK_HALF_WIDTH };
}

function today(date: Date): number {
  const { year, month, day } = vnParts(date);
  return dayNumber(year, month, day);
}

// Các lần nở quanh hôm nay (năm trước, năm nay, năm sau), theo thứ tự thời gian.
function occurrencesAround(flower: SeasonFlower, date: Date): Occurrence[] {
  const { year } = vnParts(date);
  return [year - 1, year, year + 1].map((y) => occurrence(flower, y));
}

/** Trạng thái của loài vào một ngày (theo giờ Việt Nam). */
export function statusOn(flower: SeasonFlower, date: Date): BloomStatus {
  const t = today(date);
  const occs = occurrencesAround(flower, date);

  const current = occs.find((o) => t >= o.start && t <= o.end);
  if (current) {
    if (t >= current.peakStart && t <= current.peakEnd) return 'dinh-mua';
    if (current.end - t <= SOON_DAYS) return 'sap-tan';
    return 'dang-no';
  }

  const next = occs.find((o) => o.start > t)!;
  const prev = [...occs].reverse().find((o) => o.end < t)!;
  const untilNext = next.start - t;
  if (untilNext <= SOON_DAYS) return 'sap-no';
  // Ngoài mùa: gần cuối mùa vừa rồi hơn thì "hết mùa", gần mùa tới hơn thì "chưa nở".
  return t - prev.end < untilNext ? 'het-mua' : 'chua-no';
}

/** Số ngày tới khi vào đỉnh mùa; 0 nếu đang trong đỉnh mùa. */
export function daysUntilPeak(flower: SeasonFlower, date: Date): number {
  const t = today(date);
  const occs = occurrencesAround(flower, date);
  if (occs.some((o) => t >= o.peakStart && t <= o.peakEnd)) return 0;
  return occs.find((o) => o.peakStart > t)!.peakStart - t;
}

/** Các loài khác có mùa nở chung ít nhất một tháng với loài này. */
export function bloomingWith<T extends SeasonFlower>(flower: T, all: T[]): T[] {
  return all.filter(
    (other) =>
      other !== flower &&
      (other.slug === undefined || other.slug !== flower.slug) &&
      Array.from({ length: 12 }, (_, i) => i + 1).some((m) => inSeason(flower, m) && inSeason(other, m)),
  );
}

/**
 * Có gắn nhãn "Sắp tàn" cho loài khi đang xem tháng `viewMonth` không.
 * Tháng hiện tại: theo `statusOn` của hôm nay. Tháng khác: tháng đó là tháng cuối mùa
 * và mùa dài hơn một tháng (loài chỉ nở đúng một tháng thì không gắn).
 */
export function showEndingTag(
  flower: SeasonFlower,
  viewMonth: number,
  todayParts: { year: number; month: number; day: number },
): boolean {
  if (viewMonth === todayParts.month) {
    // 12:00 trưa giờ Việt Nam (UTC+7) của hôm nay.
    const noon = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 5));
    return statusOn(flower, noon) === 'sap-tan';
  }
  const { start, end } = flower.season;
  return end.month === viewMonth && start.month !== end.month;
}
