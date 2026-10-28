// Chữ hiển thị cho trang chi tiết loài; thuần TypeScript để test được.
import {
  SOON_DAYS,
  daysUntilEnd,
  daysUntilPeak,
  daysUntilStart,
  statusOn,
  type BloomStatus,
  type MonthDay,
  type Season,
  type SeasonFlower,
} from './season';

/** Tháng chứa đỉnh của một đợt (không ghi đỉnh thì lấy tháng giữa đợt). */
function seasonPeakMonth({ start, peak, end }: Season): number {
  if (peak) return peak.month;
  const len = ((end.month - start.month + 12) % 12) + 1;
  return ((start.month - 1 + Math.floor((len - 1) / 2)) % 12) + 1;
}

/** Tháng chứa đỉnh mùa của đợt đầu tiên. */
export function peakMonth(flower: SeasonFlower): number {
  return seasonPeakMonth(flower.seasons[0]);
}

/** Tháng chứa đỉnh của từng đợt. */
export function peakMonths(flower: SeasonFlower): number[] {
  return flower.seasons.map(seasonPeakMonth);
}

/** "đầu / giữa / cuối tháng M" của đỉnh mùa; nhiều đợt thì nối bằng " và ". */
export function peakLabel(flower: SeasonFlower): string {
  return flower.seasons
    .map((s) => {
      const day = s.peak?.day ?? 15;
      const part = day <= 10 ? 'đầu' : day <= 20 ? 'giữa' : 'cuối';
      return `${part} tháng ${seasonPeakMonth(s)}`;
    })
    .join(' và ');
}

/** "đầu / giữa / cuối tháng M" theo ngày; không có ngày thì chỉ "tháng M". */
function dayLabel(md: MonthDay): string {
  if (md.day === undefined) return `tháng ${md.month}`;
  const part = md.day <= 10 ? 'đầu' : md.day <= 20 ? 'giữa' : 'cuối';
  return `${part} tháng ${md.month}`;
}

export function monthRangeLabel(flower: SeasonFlower): string {
  return flower.seasons
    .map(({ start, end }) => {
      const a = dayLabel(start);
      const b = dayLabel(end);
      return a === b ? a : `${a} – ${b}`;
    })
    .join(' · ');
}

/** Cụm đặt sau "nở": "từ giữa tháng 10 đến đầu tháng 12", hoặc "tháng 3" nếu chỉ một mốc. */
export function seasonPhrase(flower: SeasonFlower): string {
  return flower.seasons
    .map(({ start, end }) => {
      const a = dayLabel(start);
      const b = dayLabel(end);
      return a === b ? a : `từ ${a} đến ${b}`;
    })
    .join(' và ');
}

export const STATUS_SHORT: Record<BloomStatus, string> = {
  'chua-no': 'Chưa đến mùa',
  'sap-no': 'Sắp nở',
  'dang-no': 'Đang nở',
  'dinh-mua': 'Đỉnh mùa',
  'sap-tan': 'Sắp tàn',
  'het-mua': 'Hết mùa',
};

// Thứ tự hiện "Nở cùng thời điểm": đang nở / đỉnh mùa / sắp tàn, rồi sắp nở, rồi chưa đến mùa / hết mùa.
const STATUS_RANK: Record<BloomStatus, number> = {
  'dang-no': 0,
  'dinh-mua': 0,
  'sap-tan': 0,
  'sap-no': 1,
  'chua-no': 2,
  'het-mua': 2,
};

/** Sắp theo trạng thái ngày `date`; cùng nhóm giữ nguyên thứ tự ban đầu. */
export function sortByStatus<T extends SeasonFlower>(flowers: T[], date: Date): T[] {
  return flowers
    .map((f, i) => ({ f, i, rank: STATUS_RANK[statusOn(f, date)] }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.f);
}

export function statusHeadline(flower: SeasonFlower, date: Date): string {
  const status = statusOn(flower, date);
  if (status === 'dang-no') {
    const d = daysUntilPeak(flower, date);
    return d > 0 && d <= SOON_DAYS * 2 ? 'Đang nở · sắp vào đỉnh mùa' : 'Đang nở';
  }
  if (status === 'dinh-mua') return 'Đang nở · đỉnh mùa';
  if (status === 'sap-tan') return 'Đang nở · sắp tàn';
  return STATUS_SHORT[status];
}

export function statusSubline(flower: SeasonFlower): string {
  const phrase = seasonPhrase(flower);
  if (!phrase.startsWith('từ')) return `Đẹp nhất khoảng ${peakLabel(flower)}.`;
  return `Đẹp nhất khoảng ${peakLabel(flower)}, nở ${phrase}.`;
}

/** Ô số liệu đầu tiên: đếm ngược theo ngày hôm nay. */
export function countdown(flower: SeasonFlower, date: Date): { value: string; label: string } {
  const status = statusOn(flower, date);
  if (status === 'dinh-mua') return { value: 'Đỉnh mùa', label: 'đang là lúc đẹp nhất' };
  if (status === 'dang-no' || status === 'sap-tan') {
    const end = daysUntilEnd(flower, date)!;
    const peak = daysUntilPeak(flower, date);
    // Đã qua đỉnh (đỉnh kế tiếp là của năm sau) → đếm tới hết mùa.
    if (status === 'sap-tan' || peak > end) return { value: `~${end} ngày`, label: 'nữa hết mùa' };
    return { value: `~${peak} ngày`, label: 'nữa tới đỉnh mùa' };
  }
  return { value: `~${daysUntilStart(flower, date)} ngày`, label: 'nữa tới mùa nở' };
}

export {
  buildIcs,
  downloadFlowerIcs,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
  unfoldIcs,
  type IcsEventKind,
  type IcsFlowerInput,
} from './ics';

export {
  POSTER_SIZES,
  POSTER_SIZE_LIST,
  buildPosterSvg,
  downloadPosterPng,
  normalizePosterSize,
  posterFilename,
  posterRegionSlug,
  posterRows,
  posterTitle,
  type PosterFlowerInput,
  type PosterRow,
  type PosterSegment,
  type PosterSizeKey,
  type PosterSizeSpec,
  type YearInput,
} from './poster';

