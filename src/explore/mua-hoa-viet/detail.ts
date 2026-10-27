// Chữ hiển thị cho trang chi tiết loài; thuần TypeScript để test được.
import {
  SOON_DAYS,
  daysUntilEnd,
  daysUntilPeak,
  daysUntilStart,
  statusOn,
  type BloomStatus,
  type SeasonFlower,
} from './season';

/** Tháng chứa đỉnh mùa (không ghi đỉnh thì lấy tháng giữa mùa). */
export function peakMonth(flower: SeasonFlower): number {
  const { start, peak, end } = flower.season;
  if (peak) return peak.month;
  const len = ((end.month - start.month + 12) % 12) + 1;
  return ((start.month - 1 + Math.floor((len - 1) / 2)) % 12) + 1;
}

/** "đầu / giữa / cuối tháng M" của đỉnh mùa. */
export function peakLabel(flower: SeasonFlower): string {
  const day = flower.season.peak?.day ?? 15;
  const part = day <= 10 ? 'đầu' : day <= 20 ? 'giữa' : 'cuối';
  return `${part} tháng ${peakMonth(flower)}`;
}

export function monthRangeLabel(flower: SeasonFlower): string {
  const { start, end } = flower.season;
  return start.month === end.month ? `tháng ${start.month}` : `tháng ${start.month} – tháng ${end.month}`;
}

export const STATUS_SHORT: Record<BloomStatus, string> = {
  'chua-no': 'Chưa đến mùa',
  'sap-no': 'Sắp nở',
  'dang-no': 'Đang nở',
  'dinh-mua': 'Đỉnh mùa',
  'sap-tan': 'Sắp tàn',
  'het-mua': 'Hết mùa',
};

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
  const { start, end } = flower.season;
  if (start.month === end.month) return `Đẹp nhất khoảng ${peakLabel(flower)}.`;
  return `Đẹp nhất khoảng ${peakLabel(flower)}, nở từ tháng ${start.month} đến hết tháng ${end.month}.`;
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
