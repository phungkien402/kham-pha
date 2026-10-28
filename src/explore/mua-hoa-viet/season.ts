// Logic mùa nở: thuần TypeScript, không phụ thuộc Astro để test được bằng vitest.
// Ngày luôn tính theo giờ Việt Nam (Asia/Ho_Chi_Minh), xem spec mục 4.

export interface MonthDay {
  month: number; // 1–12
  day?: number;
}

/** Một đợt nở; `note` là ghi chú ngắn của đợt (vd "Đợt Tết"). */
export interface Season {
  start: MonthDay;
  peak?: MonthDay;
  end: MonthDay;
  note?: string;
}

export interface SeasonFlower {
  slug?: string;
  /** Các đợt nở, ít nhất một; loài có một mùa thì mảng một phần tử. */
  seasons: Season[];
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

function seasonCoversMonth({ start, end }: Season, month: number): boolean {
  return start.month <= end.month
    ? month >= start.month && month <= end.month
    : month >= start.month || month <= end.month;
}

/** Có đợt nở nào phủ tháng này không (chính xác theo tháng; đợt vắt năm như 12 → 2 được xử lý). */
export function inSeason(flower: SeasonFlower, month: number): boolean {
  return flower.seasons.some((s) => seasonCoversMonth(s, month));
}

interface Occurrence {
  start: number;
  end: number;
  peakStart: number;
  peakEnd: number;
}

// Một lần nở của đợt `season` bắt đầu vào năm `year` (kết thúc cùng năm, hoặc năm sau nếu vắt năm).
function occurrence(season: Season, year: number): Occurrence {
  const { start, peak, end } = season;
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

// Mọi lần nở của mọi đợt quanh hôm nay (năm trước, năm nay, năm sau), theo thứ tự thời gian.
function occurrencesAround(flower: SeasonFlower, date: Date): Occurrence[] {
  const { year } = vnParts(date);
  return [year - 1, year, year + 1]
    .flatMap((y) => flower.seasons.map((s) => occurrence(s, y)))
    .sort((a, b) => a.start - b.start);
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
  return flower.seasons.some((s) => s.end.month === viewMonth && s.start.month !== s.end.month);
}

/**
 * Loài có đang nở khi xem tháng `viewMonth` không.
 * Tháng hiện tại: theo `statusOn` của hôm nay (đang nở, đỉnh mùa, sắp tàn); tháng khác: theo tháng.
 */
export function isBloomingIn(
  flower: SeasonFlower,
  viewMonth: number,
  todayParts: { year: number; month: number; day: number },
): boolean {
  if (viewMonth !== todayParts.month) return inSeason(flower, viewMonth);
  const noon = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 5));
  const status = statusOn(flower, noon);
  return status === 'dang-no' || status === 'dinh-mua' || status === 'sap-tan';
}

/** Số ngày tới đầu mùa nở; 0 nếu đang trong mùa. */
export function daysUntilStart(flower: SeasonFlower, date: Date): number {
  const t = today(date);
  const occs = occurrencesAround(flower, date);
  if (occs.some((o) => t >= o.start && t <= o.end)) return 0;
  return occs.find((o) => o.start > t)!.start - t;
}

/** Số ngày còn lại tới cuối mùa; null nếu đang ngoài mùa. */
export function daysUntilEnd(flower: SeasonFlower, date: Date): number | null {
  const t = today(date);
  const current = occurrencesAround(flower, date).find((o) => t >= o.start && t <= o.end);
  return current ? current.end - t : null;
}


export {
  formatDistanceKm,
  haversineKm,
  nearestBlooming,
  type DateInput,
  type NearestFlowerInfo,
  type NearestInputFlower,
  type NearestInputPlace,
  type NearestPlaceResult,
} from './nearest';
