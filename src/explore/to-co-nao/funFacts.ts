// src/explore/to-co-nao/funFacts.ts
// Các hàm thuần tính Fun fact cho từng thực thể và phát hiện các cặp so sánh bất ngờ

import type { EntityMeta } from './types';
import { formatNumberVi } from './math';

export interface SurprisingPair {
  a: string; // id tỉnh
  b: string; // id nước
  ratio: number; // area_nước / area_tỉnh
}

/**
 * Sinh câu fun fact tự động cho một thực thể (tỉnh, Việt Nam hoặc nước) dựa trên số liệu meta.
 * - Xếp hạng theo area giảm dần.
 * - Bỏ 'ata' (Nam Cực) khỏi xếp hạng nước.
 * - Số được định dạng kiểu Việt (dấu chấm hàng nghìn, phẩy thập phân).
 */
export function funFact(e: EntityMeta, all: EntityMeta[]): string {
  if (!e || !all || all.length === 0) return '';

  const vn = all.find((m) => m.id === 'viet-nam' || m.type === 'vn');
  const vnArea = vn?.area || 330533;

  const provinces = all
    .filter((m) => m.type === 'tinh')
    .sort((a, b) => b.area - a.area);

  // Danh sách nước bỏ 'ata'
  const countries = all
    .filter((m) => m.type === 'nuoc' && m.id !== 'ata')
    .sort((a, b) => b.area - a.area);

  // 1. Nếu là tỉnh
  if (e.type === 'tinh') {
    const k = provinces.findIndex((p) => p.id === e.id) + 1;
    const total = provinces.length || 34;
    const pctVal = (e.area / vnArea) * 100;
    const pct = formatNumberVi(pctVal, 1);
    const len = formatNumberVi(Math.round(e.len || 0));
    return `Lớn thứ ${k}/${total} tỉnh · bằng ${pct}% diện tích Việt Nam · dài khoảng ${len} km`;
  }

  // 2. Nếu là toàn bộ Việt Nam
  if (e.type === 'vn') {
    const countriesWithVn = [...countries, e].sort((a, b) => b.area - a.area);
    const k = countriesWithVn.findIndex((m) => m.id === e.id) + 1;
    const len = formatNumberVi(Math.round(e.len || 0));
    return `Lớn thứ ${k}/${countries.length} nếu xếp cùng các nước · dài khoảng ${len} km`;
  }

  // 3. Nếu là quốc gia
  if (e.type === 'nuoc') {
    const k = countries.findIndex((c) => c.id === e.id) + 1;

    if (e.area >= vnArea) {
      const r = e.area / vnArea;
      const rFmt =
        r >= 10
          ? formatNumberVi(Math.round(r))
          : formatNumberVi(Math.round(r * 10) / 10, 1);
      return `Lớn thứ ${k} thế giới · bằng ${rFmt} lần Việt Nam`;
    } else {
      const r = vnArea / e.area;
      const rFmt =
        r >= 10
          ? formatNumberVi(Math.round(r))
          : formatNumberVi(Math.round(r * 10) / 10, 1);

      // Tìm tỉnh Việt Nam có diện tích gần nhất
      let closestP = provinces[0];
      let minDiff = Infinity;
      for (const p of provinces) {
        const diff = Math.abs(p.area - e.area);
        if (diff < minDiff) {
          minDiff = diff;
          closestP = p;
        }
      }

      const provinceSuffix = closestP ? ` · cỡ ${closestP.name}` : '';
      return `Lớn thứ ${k} thế giới · Việt Nam bằng ${rFmt} lần nước này${provinceSuffix}`;
    }
  }

  return '';
}

/**
 * Tìm các cặp so sánh bất ngờ (1 tỉnh VN × 1 quốc gia có diện tích gần như ngang bằng):
 * - Với mỗi tỉnh, nước có |area_nước / area_tỉnh - 1| <= 0,06 gần nhất.
 * - Bỏ nước < 50 km² và 'ata'.
 * - Mỗi tỉnh tối đa 1 cặp.
 * - Sắp xếp theo độ lệch tăng dần (cặp sát nhất lên đầu).
 */
export function surprisingPairs(all: EntityMeta[]): SurprisingPair[] {
  if (!all || all.length === 0) return [];

  const provinces = all.filter((m) => m.type === 'tinh');
  const validCountries = all.filter(
    (m) => m.type === 'nuoc' && m.id !== 'ata' && m.area >= 50
  );

  const pairs: (SurprisingPair & { diff: number })[] = [];

  for (const p of provinces) {
    if (!p.area || p.area <= 0) continue;

    let bestCountry: EntityMeta | null = null;
    let minDiff = Infinity;

    for (const c of validCountries) {
      if (!c.area || c.area <= 0) continue;
      const diff = Math.abs(c.area / p.area - 1);
      if (diff <= 0.06 && diff < minDiff) {
        minDiff = diff;
        bestCountry = c;
      }
    }

    if (bestCountry) {
      pairs.push({
        a: p.id,
        b: bestCountry.id,
        ratio: bestCountry.area / p.area,
        diff: minDiff,
      });
    }
  }

  pairs.sort((x, y) => x.diff - y.diff);

  return pairs.map(({ a, b, ratio }) => ({ a, b, ratio }));
}
