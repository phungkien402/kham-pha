// src/explore/to-co-nao/tourData.ts
// Dữ liệu 10 chặng hành trình, hàm thuần tính nhịp so sánh và giải mã URL ?hanh-trinh=N

import type { EntityMeta } from './types';
import { formatNumberVi } from './math';
import { loadChunk } from './dataLoader';

export interface TourStep {
  step: number; // 1 đến 10
  smallId: string;
  largeId: string;
  cau: string;
}

/**
 * Danh sách 10 chặng vàng theo đặc tả (từ nhỏ đến lớn xoay quanh Việt Nam).
 * id1, id2 theo thứ tự xuất hiện [nhỏ, lớn] hoặc cặp so sánh chuẩn trong meta.json.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    smallId: 'sgp',
    largeId: 'tp-ho-chi-minh',
    cau: 'Cả một quốc đảo giàu có đặt gọn trong một góc TP.HCM.',
  },
  {
    step: 2,
    smallId: 'lux',
    largeId: 'ha-noi',
    cau: 'Thủ đô Việt Nam rộng hơn cả một đại công quốc châu Âu.',
  },
  {
    step: 3,
    smallId: 'nghe-an',
    largeId: 'kwt',
    cau: 'Nghệ An và Kuwait gần như cùng cỡ.',
  },
  {
    step: 4,
    smallId: 'lam-dong',
    largeId: 'bel',
    cau: 'Tỉnh lớn nhất Việt Nam gần bằng cả nước Bỉ.',
  },
  {
    step: 5,
    smallId: 'kor',
    largeId: 'viet-nam',
    cau: 'Nhiều người nghĩ Hàn Quốc rộng lớn — thật ra Việt Nam rộng gấp hơn 3 lần.',
  },
  {
    step: 6,
    smallId: 'fin',
    largeId: 'viet-nam',
    cau: 'Phần Lan và Việt Nam: chênh nhau chưa tới 50 km².',
  },
  {
    step: 7,
    smallId: 'viet-nam',
    largeId: 'jpn',
    cau: 'Nhật Bản rộng hơn một chút, và cũng trải dài như Việt Nam.',
  },
  {
    step: 8,
    smallId: 'viet-nam',
    largeId: 'fra',
    cau: 'Pháp — nước lớn nhất Tây Âu — gần gấp đôi Việt Nam.',
  },
  {
    step: 9,
    smallId: 'viet-nam',
    largeId: 'chn',
    cau: 'Trung Quốc chứa được khoảng 28 Việt Nam.',
  },
  {
    step: 10,
    smallId: 'viet-nam',
    largeId: 'rus',
    cau: 'Nước lớn nhất thế giới: khoảng 51 Việt Nam. Giờ đến lượt bạn.',
  },
];

/**
 * Định dạng tỉ lệ so sánh font lớn ở tầng (1):
 * - Nếu |tỉ lệ - 1| < 0,05: "GẦN NHƯ BẰNG NHAU"
 * - Nếu tỉ lệ >= 5: làm tròn số nguyên "GẤP n LẦN" (ví dụ: "GẤP 9 LẦN", "GẤP 28 LẦN", "GẤP 51 LẦN")
 * - Nếu tỉ lệ < 5: giữ 1 chữ số thập phân "GẤP 1,3 LẦN", "GẤP 3,4 LẦN"
 */
export function formatTourRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '';
  const diff = Math.abs(ratio - 1);
  if (diff < 0.05) {
    return 'GẦN NHƯ BẰNG NHAU';
  }
  if (ratio >= 5) {
    const rounded = Math.round(ratio);
    return `GẤP ${formatNumberVi(rounded)} LẦN`;
  }
  const rounded = Math.round(ratio * 10) / 10;
  return `GẤP ${formatNumberVi(rounded, 1)} LẦN`;
}

export interface TourComparisonResult {
  step: TourStep;
  headline: string;
  sub: string;
  cau: string;
  large: EntityMeta;
  small: EntityMeta;
  ratio: number;
  isNearlyEqual: boolean;
}

/**
 * Tính toán câu chữ 3 tầng cho một chặng hành trình từ dữ liệu meta thật.
 */
export function getTourComparison(
  step: TourStep,
  metaMap: Map<string, EntityMeta>
): TourComparisonResult | null {
  const e1 = metaMap.get(step.smallId);
  const e2 = metaMap.get(step.largeId);
  if (!e1 || !e2 || !e1.area || !e2.area) return null;

  const large = e1.area >= e2.area ? e1 : e2;
  const small = e1.area >= e2.area ? e2 : e1;
  const ratio = large.area / small.area;
  const headline = formatTourRatio(ratio);
  const isNearlyEqual = Math.abs(ratio - 1) < 0.05;

  const sub = `${large.name} ${formatNumberVi(large.area)} km² · ${small.name} ${formatNumberVi(small.area)} km²`;

  return {
    step,
    headline,
    sub,
    cau: step.cau,
    large,
    small,
    ratio,
    isNearlyEqual,
  };
}

/**
 * Phân tích tham số URL để tìm ?hanh-trinh=N.
 * Trả về số chặng (1..10). Nếu có tham số nhưng sai định dạng hoặc ngoài dải thì trả về 1.
 * Nếu không có tham số hanh-trinh trả về null.
 */
export function parseHanhTrinhUrl(searchOrUrl: string): number | null {
  if (!searchOrUrl) return null;

  let qs = searchOrUrl;
  const qIdx = qs.indexOf('?');
  if (qIdx !== -1) {
    qs = qs.slice(qIdx + 1);
  }
  const hashIdx = qs.indexOf('#');
  if (hashIdx !== -1) {
    qs = qs.slice(0, hashIdx);
  }

  const params = new URLSearchParams(qs);
  const val = params.get('hanh-trinh') ?? params.get('hanh_trinh');
  if (val === null) return null;

  const n = parseInt(val, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 10) {
    return n;
  }
  return 1;
}

/**
 * Tải trước mọi chunk cần cho chế độ hành trình (vn, nuoc-pho-bien, nuoc-khac).
 */
export async function prefetchTourData(): Promise<void> {
  try {
    await Promise.all([
      loadChunk('vn'),
      loadChunk('nuoc-pho-bien'),
      loadChunk('nuoc-khac'),
    ]);
  } catch (err) {
    console.error('[tourData] prefetchTourData error:', err);
  }
}
