// Logic dựng dữ liệu và vẽ Poster lịch hoa 12 tháng (bước 30).
// Hàm thuần `posterRows(flowers, region, year)` không phụ thuộc DOM/Astro để test bằng vitest.

import { site } from '../../config/site';
import { monthRangeLabel, peakLabel, peakMonth, peakMonths } from './detail';
import { REGION_LABELS } from './provinces';
import { inSeason, vnParts, type MonthDay, type Season, type SeasonFlower } from './season';
import type { Filter, Region } from './types';

export type PosterSizeKey = 'doc' | 'ngang' | 'a4';

export interface PosterSizeSpec {
  key: PosterSizeKey;
  label: string;
  description: string;
  width: number;
  height: number;
}

export const POSTER_SIZES: Record<PosterSizeKey, PosterSizeSpec> = {
  doc: {
    key: 'doc',
    label: 'Dọc điện thoại',
    description: '1080×1920',
    width: 1080,
    height: 1920,
  },
  ngang: {
    key: 'ngang',
    label: 'Ngang máy tính',
    description: '1920×1080',
    width: 1920,
    height: 1080,
  },
  a4: {
    key: 'a4',
    label: 'In A4',
    description: '2480×3508',
    width: 2480,
    height: 3508,
  },
};

export const POSTER_SIZE_LIST: PosterSizeSpec[] = [
  POSTER_SIZES.doc,
  POSTER_SIZES.ngang,
  POSTER_SIZES.a4,
];

export interface PosterFlowerInput {
  slug?: string;
  name?: string;
  color?: string;
  regions?: Region[];
  regionLabel?: string;
  seasons?: Season[];
  /** Tương thích dữ liệu thô từ flowers.json (trước khi qua zod transform). */
  season?: Season;
}

export interface PosterSegment {
  /** Chỉ số đợt nở trong `flower.seasons` (0-based). */
  seasonIndex: number;
  /** Tháng bắt đầu của đoạn thanh trên trục T1–T12 (1–12). */
  startMonth: number;
  /** Tháng kết thúc của đoạn thanh trên trục T1–T12 (1–12, luôn >= startMonth). */
  endMonth: number;
  /** Ngày bắt đầu trong `startMonth`. */
  startDay: number;
  /** Ngày kết thúc trong `endMonth`. */
  endDay: number;
  /** Vị trí bắt đầu liên tục trên thang 0..12 (tháng 1 là 0..1, tháng 12 là 11..12). */
  startCol: number;
  /** Vị trí kết thúc liên tục trên thang 0..12 (luôn > startCol). */
  endCol: number;
  /** Tỉ lệ bắt đầu trên dải 12 tháng (0..1). */
  startRatio: number;
  /** Tỉ lệ kết thúc trên dải 12 tháng (0..1). */
  endRatio: number;
  /** Độ rộng tỉ lệ trên dải 12 tháng (0..1). */
  widthRatio: number;
  /** Phần trăm vị trí bắt đầu (0..100). */
  startPct: number;
  /** Phần trăm độ rộng (0..100). */
  widthPct: number;
  /** Tháng đỉnh mùa nếu đỉnh của đợt rơi vào đoạn này (1–12). */
  peakMonth?: number;
  /** Ngày đỉnh mùa nếu đỉnh của đợt rơi vào đoạn này. */
  peakDay?: number;
  /** Vị trí đỉnh mùa liên tục trên thang 0..12 nếu rơi vào đoạn này. */
  peakCol?: number;
  /** Tỉ lệ vị trí đỉnh mùa trên dải 12 tháng (0..1) nếu rơi vào đoạn này. */
  peakRatio?: number;
  /** Đợt nở có vắt qua năm (ví dụ T12 → T2) hay không. */
  wrapped: boolean;
  /** Ghi chú ngắn của đợt (vd "Đợt Tết"). */
  note?: string;
}

export interface PosterRow {
  slug: string;
  name: string;
  color: string;
  regions: Region[];
  regionLabel: string;
  seasons: Season[];
  year: number;
  /** Nhãn năm trên poster, vd "2026–2027". */
  yearRange: string;
  /** Mảng 12 phần tử (T1..T12) cho biết loài có nở trong tháng đó không. */
  months: boolean[];
  /** Danh sách các tháng (1..12) loài có nở. */
  activeMonths: number[];
  /** Các đoạn thanh màu trên dải 12 tháng (mùa vắt năm tách thành 2 đoạn: đầu năm và cuối năm). */
  segments: PosterSegment[];
  /** Bí danh của `segments`. */
  bars: PosterSegment[];
  /** Chú thích ngắn đỉnh mùa (tái dùng `peakLabel` từ `detail.ts`, vd "giữa tháng 11"). */
  peakLabel: string;
  /** Chú thích đỉnh mùa kèm tiền tố hiển thị trên poster, vd "Đỉnh: giữa tháng 11". */
  peakNote: string;
  /** Tháng đỉnh mùa của đợt đầu tiên (1–12). */
  peakMonth: number;
  /** Danh sách tháng đỉnh mùa của từng đợt. */
  peakMonths: number[];
  /** Nhãn khoảng mùa nở (tái dùng `monthRangeLabel` từ `detail.ts`). */
  rangeLabel: string;
}

export type YearInput =
  | number
  | Date
  | { year: number; month?: number; day?: number }
  | string;

const VALID_REGIONS = new Set<string>(['bac', 'trung', 'nam']);

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function isValidMonthDay(md: MonthDay | undefined): md is MonthDay {
  if (!md || typeof md !== 'object') return false;
  if (typeof md.month !== 'number' || !Number.isInteger(md.month) || md.month < 1 || md.month > 12) {
    return false;
  }
  if (
    md.day !== undefined &&
    (typeof md.day !== 'number' || !Number.isFinite(md.day) || md.day < 1 || md.day > 31)
  ) {
    return false;
  }
  return true;
}

function isValidSeason(s: Season | undefined): s is Season {
  return !!s && typeof s === 'object' && isValidMonthDay(s.start) && isValidMonthDay(s.end);
}

function normalizeYear(yearInput: YearInput | undefined): number | null {
  if (yearInput === undefined) {
    return vnParts(new Date()).year;
  }
  if (typeof yearInput === 'number') {
    if (!Number.isInteger(yearInput) || yearInput < 1000 || yearInput > 9999) return null;
    return yearInput;
  }
  if (yearInput instanceof Date) {
    if (Number.isNaN(yearInput.getTime())) return null;
    return vnParts(yearInput).year;
  }
  if (typeof yearInput === 'string') {
    const trimmed = yearInput.trim();
    if (!trimmed) return null;
    if (/^\d{4}$/.test(trimmed)) {
      const y = Number(trimmed);
      return y >= 1000 && y <= 9999 ? y : null;
    }
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]);
      const d = Number(isoMatch[3]);
      if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
        return null;
      }
      return y;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return vnParts(parsed).year;
  }
  if (typeof yearInput === 'object' && yearInput !== null && 'year' in yearInput) {
    const y = yearInput.year;
    if (typeof y !== 'number' || !Number.isInteger(y) || y < 1000 || y > 9999) return null;
    if (yearInput.month !== undefined) {
      const m = yearInput.month;
      if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 12) return null;
      if (yearInput.day !== undefined) {
        const d = yearInput.day;
        if (typeof d !== 'number' || !Number.isInteger(d) || d < 1 || d > daysInMonth(y, m)) {
          return null;
        }
      }
    }
    return y;
  }
  return null;
}

function normalizeRegion(regionInput: Filter | string | undefined): Filter | null {
  if (regionInput === undefined || regionInput === 'all' || regionInput === 'ca-nuoc' || regionInput === '') {
    return 'all';
  }
  if (typeof regionInput === 'string' && VALID_REGIONS.has(regionInput)) {
    return regionInput as Region;
  }
  return null;
}

/** Tính đỉnh mùa (tháng + ngày) cho một đợt nở. */
function resolveSeasonPeak(season: Season, year: number): { month: number; day: number; col: number } {
  const { start, peak, end } = season;
  if (peak && isValidMonthDay(peak)) {
    const dim = daysInMonth(year, peak.month);
    const day = clamp(Math.trunc(peak.day ?? 15), 1, dim);
    const col = peak.month - 1 + (day - 0.5) / dim;
    return { month: peak.month, day, col };
  }
  const len = ((end.month - start.month + 12) % 12) + 1;
  const pMonth = ((start.month - 1 + Math.floor((len - 1) / 2)) % 12) + 1;
  const dim = daysInMonth(year, pMonth);
  let pDay = 15;
  if (start.month === end.month && (start.day !== undefined || end.day !== undefined)) {
    const sDay = clamp(Math.trunc(start.day ?? 1), 1, dim);
    const eDay = clamp(Math.trunc(end.day ?? dim), 1, dim);
    if (sDay <= eDay) {
      pDay = Math.round((sDay + eDay) / 2);
    }
  }
  pDay = clamp(pDay, 1, dim);
  const col = pMonth - 1 + (pDay - 0.5) / dim;
  return { month: pMonth, day: pDay, col };
}

function createSegment(params: {
  seasonIndex: number;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  year: number;
  peak: { month: number; day: number; col: number };
  wrapped: boolean;
  note?: string;
}): PosterSegment {
  const { seasonIndex, startMonth, startDay, endMonth, endDay, year, peak, wrapped, note } = params;
  const startDim = daysInMonth(year, startMonth);
  const endDim = daysInMonth(year, endMonth);
  const sDay = clamp(Math.trunc(startDay), 1, startDim);
  const eDay = clamp(Math.trunc(endDay), 1, endDim);

  const startCol = startMonth - 1 + (sDay - 1) / startDim;
  const rawEndCol = endMonth - 1 + eDay / endDim;
  const endCol = Math.max(startCol + 1 / 365, rawEndCol);

  const startRatio = startCol / 12;
  const endRatio = endCol / 12;
  const widthRatio = endRatio - startRatio;

  const hasPeak = peak.month >= startMonth && peak.month <= endMonth && peak.col >= startCol && peak.col <= endCol;

  const seg: PosterSegment = {
    seasonIndex,
    startMonth,
    endMonth,
    startDay: sDay,
    endDay: eDay,
    startCol,
    endCol,
    startRatio,
    endRatio,
    widthRatio,
    startPct: startRatio * 100,
    widthPct: widthRatio * 100,
    wrapped,
  };

  if (hasPeak) {
    seg.peakMonth = peak.month;
    seg.peakDay = peak.day;
    seg.peakCol = peak.col;
    seg.peakRatio = peak.col / 12;
  }
  if (note) {
    seg.note = note;
  }
  return seg;
}

/** Chuyển một đợt nở thành 1 đoạn (nếu trong năm) hoặc 2 đoạn (nếu vắt qua năm T12 → T1). */
function seasonToSegments(season: Season, seasonIndex: number, year: number): PosterSegment[] {
  const { start, end, note } = season;
  const peak = resolveSeasonPeak(season, year);
  const startDim = daysInMonth(year, start.month);
  const endDim = daysInMonth(year, end.month);
  const sDay = clamp(Math.trunc(start.day ?? 1), 1, startDim);
  const eDay = clamp(Math.trunc(end.day ?? endDim), 1, endDim);

  const wrapsYear =
    start.month > end.month || (start.month === end.month && sDay > eDay);

  if (!wrapsYear) {
    return [
      createSegment({
        seasonIndex,
        startMonth: start.month,
        startDay: sDay,
        endMonth: end.month,
        endDay: eDay,
        year,
        peak,
        wrapped: false,
        note,
      }),
    ];
  }

  // Mùa vắt qua năm: tách thành đoạn đầu năm (T1 → end) và đoạn cuối năm (start → T12)
  const earlySeg = createSegment({
    seasonIndex,
    startMonth: 1,
    startDay: 1,
    endMonth: end.month,
    endDay: eDay,
    year,
    peak,
    wrapped: true,
    note,
  });
  const lateSeg = createSegment({
    seasonIndex,
    startMonth: start.month,
    startDay: sDay,
    endMonth: 12,
    endDay: daysInMonth(year, 12),
    year,
    peak,
    wrapped: true,
    note,
  });

  return [earlySeg, lateSeg];
}

/** Tiêu đề poster theo năm, vd "Lịch mùa hoa Việt 2026–2027". */
export function posterTitle(yearInput: YearInput = new Date()): string {
  const year = normalizeYear(yearInput) ?? vnParts(new Date()).year;
  return `Lịch mùa hoa Việt ${year}–${year + 1}`;
}

/** Mã miền dùng trong tên file tải về (`ca-nuoc`, `bac`, `trung`, `nam`). */
export function posterRegionSlug(region: Filter | string = 'all'): string {
  const norm = normalizeRegion(region) ?? 'all';
  return norm === 'all' ? 'ca-nuoc' : norm;
}

/** Chuẩn hoá mã khổ poster (`doc`, `ngang`, `a4`). */
export function normalizePosterSize(size: PosterSizeKey | string = 'doc'): PosterSizeKey {
  const s = String(size ?? '').trim().toLowerCase();
  if (s === 'ngang' || s === '1920x1080' || s === '1920×1080' || s === 'desktop') return 'ngang';
  if (s === 'a4' || s === '2480x3508' || s === '2480×3508' || s === 'print') return 'a4';
  return 'doc';
}

/** Tên file PNG tải về: `lich-hoa-<mien>-<kho>.png`. */
export function posterFilename(
  region: Filter | string = 'all',
  size: PosterSizeKey | string = 'doc',
): string {
  const mien = posterRegionSlug(region);
  const kho = normalizePosterSize(size);
  return `lich-hoa-${mien}-${kho}.png`;
}

/**
 * Hàm thuần dựng dữ liệu các dòng loài hoa trên poster lịch hoa 12 tháng.
 * Lọc theo `region` ('all' | 'bac' | 'trung' | 'nam'), tính vị trí dải tháng theo `year`.
 */
export function posterRows(
  flowers: readonly PosterFlowerInput[],
  region: Filter | string = 'all',
  year: YearInput = new Date(),
): PosterRow[] {
  if (!Array.isArray(flowers)) return [];

  const normRegion = normalizeRegion(region);
  if (!normRegion) return [];

  const normYear = normalizeYear(year);
  if (normYear === null) return [];

  const yearRange = `${normYear}–${normYear + 1}`;
  const rows: PosterRow[] = [];

  for (const f of flowers) {
    if (!f || typeof f !== 'object') continue;
    if (f.slug !== undefined && typeof f.slug !== 'string') continue;
    if (f.name !== undefined && typeof f.name !== 'string') continue;

    const rawSeasons = Array.isArray(f.seasons)
      ? f.seasons
      : f.season
        ? [f.season]
        : [];
    const seasons = rawSeasons.filter(isValidSeason);
    if (seasons.length === 0) continue;

    const regions: Region[] = Array.isArray(f.regions)
      ? f.regions.filter((r): r is Region => typeof r === 'string' && VALID_REGIONS.has(r))
      : [];

    if (normRegion !== 'all' && !regions.includes(normRegion)) {
      continue;
    }

    const slug = (typeof f.slug === 'string' ? f.slug.trim() : '') || 'hoa';
    const name = (typeof f.name === 'string' ? f.name.trim() : '') || slug;
    const color =
      typeof f.color === 'string' && f.color.trim() ? f.color.trim() : '#D45B7A';
    const regionLabel =
      typeof f.regionLabel === 'string' ? f.regionLabel.trim() : '';

    const sf: SeasonFlower = { slug, seasons };
    const months = Array.from({ length: 12 }, (_, i) => inSeason(sf, i + 1));
    const activeMonths = months.flatMap((on, i) => (on ? [i + 1] : []));

    const segments = seasons
      .flatMap((s, idx) => seasonToSegments(s, idx, normYear))
      .sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);

    const pLabel = peakLabel(sf);
    const pNote = `Đỉnh: ${pLabel}`;

    rows.push({
      slug,
      name,
      color,
      regions,
      regionLabel,
      seasons,
      year: normYear,
      yearRange,
      months,
      activeMonths,
      segments,
      bars: segments,
      peakLabel: pLabel,
      peakNote: pNote,
      peakMonth: peakMonth(sf),
      peakMonths: peakMonths(sf),
      rangeLabel: monthRangeLabel(sf),
    });
  }

  return rows;
}

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Dựng chuỗi SVG hoàn chỉnh cho poster lịch hoa 12 tháng theo khổ (`doc`, `ngang`, `a4`).
 */
export function buildPosterSvg(
  flowers: readonly PosterFlowerInput[],
  region: Filter | string = 'all',
  year: YearInput = new Date(),
  size: PosterSizeKey | string = 'doc',
): string {
  const normRegion = normalizeRegion(region) ?? 'all';
  const normYear = normalizeYear(year) ?? vnParts(new Date()).year;
  const sizeKey = normalizePosterSize(size);
  const spec = POSTER_SIZES[sizeKey];
  const rows = posterRows(flowers, normRegion, normYear);

  // Khổ A4 (2480×3508) dùng hệ toạ độ logic 1240×1754 (tỉ lệ chính xác 1:2) để chữ/nét sắc nét.
  const vw = sizeKey === 'a4' ? 1240 : spec.width;
  const vh = sizeKey === 'a4' ? 1754 : spec.height;
  const isLandscape = sizeKey === 'ngang';

  const padX = isLandscape ? 64 : 56;
  const padTop = isLandscape ? 52 : 76;
  const padBottom = isLandscape ? 52 : 72;

  const headerHeight = isLandscape ? 116 : 164;
  const footerHeight = isLandscape ? 54 : 68;
  const monthHeaderHeight = isLandscape ? 44 : 52;

  const tableTop = padTop + headerHeight;
  const tableBottom = vh - padBottom - footerHeight;
  const tableHeight = tableBottom - tableTop;
  const bodyTop = tableTop + monthHeaderHeight;
  const bodyHeight = Math.max(120, tableHeight - monthHeaderHeight);

  const labelColWidth = isLandscape ? 370 : 284;
  const gridLeft = padX + labelColWidth;
  const gridRight = vw - padX;
  const gridWidth = gridRight - gridLeft;
  const colWidth = gridWidth / 12;

  const regionName = normRegion === 'all' ? 'Cả nước' : REGION_LABELS[normRegion];
  const titleText = posterTitle(normYear);
  const siteUrlClean = site.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const footerUrl = `${site.url.replace(/\/$/, '')}/mua-hoa-viet`;

  const rowCount = Math.max(1, rows.length);
  const rowHeight = bodyHeight / rowCount;
  const barHeight = clamp(Math.round(rowHeight * (isLandscape ? 0.34 : 0.26)), 12, 26);

  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="${escapeXml(titleText)}">`,
    `<rect width="${vw}" height="${vh}" fill="#FAF8F5" />`,
    `<rect x="${padX - 20}" y="${padTop - 20}" width="${vw - (padX - 20) * 2}" height="${vh - (padTop - 20) - (padBottom - 16)}" rx="28" fill="#FFFFFF" stroke="#E7E2D9" stroke-width="2" />`,
  ];

  // Header
  const kickerY = padTop + (isLandscape ? 22 : 28);
  const titleY = kickerY + (isLandscape ? 42 : 52);
  const subY = titleY + (isLandscape ? 30 : 36);

  svgParts.push(
    `<text x="${padX}" y="${kickerY}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 15 : 16}" font-weight="700" fill="#8C7A6B" letter-spacing="1.5">MÙA HOA VIỆT · ${escapeXml(regionName.toUpperCase())}</text>`,
    `<text x="${padX}" y="${titleY}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 36 : 42}" font-weight="700" fill="#1F1D1A">${escapeXml(titleText)}</text>`,
    `<text x="${padX}" y="${subY}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 16 : 18}" font-weight="400" fill="#6B655C">${rows.length} loài hoa · Thanh màu thể hiện đợt nở trong 12 tháng, chấm tròn đánh dấu đỉnh mùa</text>`,
  );

  // Month headers (T1..T12)
  svgParts.push(
    `<rect x="${padX}" y="${tableTop}" width="${vw - padX * 2}" height="${monthHeaderHeight}" rx="12" fill="#F3EEE5" />`,
    `<text x="${padX + 16}" y="${r2(tableTop + monthHeaderHeight / 2 + 5)}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 15 : 16}" font-weight="700" fill="#4A453E">Loài hoa &amp; đỉnh mùa</text>`,
  );

  for (let m = 1; m <= 12; m++) {
    const colX = gridLeft + (m - 1) * colWidth;
    const centerX = colX + colWidth / 2;
    if (m % 2 === 0) {
      svgParts.push(
        `<rect x="${r2(colX)}" y="${r2(bodyTop)}" width="${r2(colWidth)}" height="${r2(bodyHeight)}" fill="#FAF7F2" />`,
      );
    }
    svgParts.push(
      `<line x1="${r2(colX)}" y1="${r2(tableTop)}" x2="${r2(colX)}" y2="${r2(tableBottom)}" stroke="#EAE4DA" stroke-width="1" />`,
      `<text x="${r2(centerX)}" y="${r2(tableTop + monthHeaderHeight / 2 + 5)}" text-anchor="middle" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 15 : 16}" font-weight="700" fill="#1F1D1A">T${m}</text>`,
    );
  }

  // Rows
  if (rows.length === 0) {
    svgParts.push(
      `<text x="${vw / 2}" y="${r2(bodyTop + bodyHeight / 2)}" text-anchor="middle" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="20" fill="#6B655C">Chưa có loài hoa nào cho miền này.</text>`,
    );
  } else {
    rows.forEach((row, idx) => {
      const rowY = bodyTop + idx * rowHeight;
      const midY = rowY + rowHeight / 2;

      if (idx > 0) {
        svgParts.push(
          `<line x1="${padX}" y1="${r2(rowY)}" x2="${vw - padX}" y2="${r2(rowY)}" stroke="#EFEAE1" stroke-width="1" />`,
        );
      }

      const dotCx = padX + 16;
      const nameX = padX + 32;
      const nameFontSize = isLandscape ? 17 : 19;
      const subFontSize = isLandscape ? 13 : 14;

      if (isLandscape && rowHeight < 64) {
        // Bố cục gọn trên khổ ngang khi có nhiều loài
        svgParts.push(
          `<circle cx="${dotCx}" cy="${r2(midY - 8)}" r="6" fill="${escapeXml(row.color)}" />`,
          `<text x="${nameX}" y="${r2(midY - 3)}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${nameFontSize}" font-weight="700" fill="#1F1D1A">${escapeXml(row.name)}</text>`,
          `<text x="${nameX}" y="${r2(midY + 15)}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${subFontSize}" font-weight="400" fill="#6B655C">${escapeXml(row.peakNote)}</text>`,
        );
      } else {
        svgParts.push(
          `<circle cx="${dotCx}" cy="${r2(midY - 10)}" r="6.5" fill="${escapeXml(row.color)}" />`,
          `<text x="${nameX}" y="${r2(midY - 4)}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${nameFontSize}" font-weight="700" fill="#1F1D1A">${escapeXml(row.name)}</text>`,
          `<text x="${nameX}" y="${r2(midY + 17)}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${subFontSize}" font-weight="400" fill="#6B655C">${escapeXml(row.peakNote)}</text>`,
        );
      }

      // Track nền 12 tháng
      const barY = midY - barHeight / 2;
      const barRx = barHeight / 2;
      svgParts.push(
        `<rect x="${r2(gridLeft + 4)}" y="${r2(barY)}" width="${r2(gridWidth - 8)}" height="${barHeight}" rx="${r2(barRx)}" fill="#EFEAE1" opacity="0.65" />`,
      );

      // Các thanh màu theo đợt nở
      for (const seg of row.segments) {
        const segX = gridLeft + seg.startRatio * gridWidth;
        const segW = Math.max(barHeight, seg.widthRatio * gridWidth);
        svgParts.push(
          `<rect x="${r2(segX)}" y="${r2(barY)}" width="${r2(segW)}" height="${barHeight}" rx="${r2(barRx)}" fill="${escapeXml(row.color)}" />`,
        );
        if (seg.peakRatio !== undefined) {
          const peakX = clamp(
            gridLeft + seg.peakRatio * gridWidth,
            segX + barRx,
            segX + segW - barRx,
          );
          svgParts.push(
            `<circle cx="${r2(peakX)}" cy="${r2(midY)}" r="${r2(Math.max(4, barHeight * 0.28))}" fill="#FFFFFF" stroke="${escapeXml(row.color)}" stroke-width="2" />`,
          );
        }
      }
    });
  }

  // Footer
  const footerLineY = vh - padBottom - footerHeight + 14;
  const footerTextY = vh - padBottom - 8;
  svgParts.push(
    `<line x1="${padX}" y1="${r2(footerLineY)}" x2="${vw - padX}" y2="${r2(footerLineY)}" stroke="#E7E2D9" stroke-width="1.5" />`,
    `<text x="${padX}" y="${r2(footerTextY)}" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 15 : 16}" font-weight="600" fill="#4A453E">${escapeXml(site.name)} · Mùa Hoa Việt</text>`,
    `<text x="${vw - padX}" y="${r2(footerTextY)}" text-anchor="end" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="${isLandscape ? 15 : 16}" font-weight="600" fill="#6B655C">${escapeXml(footerUrl)} (${escapeXml(siteUrlClean)})</text>`,
    `</svg>`,
  );

  return svgParts.join('\n');
}

/**
 * Vẽ poster bằng SVG rồi xuất PNG qua `<canvas>` (chờ `document.fonts.ready`)
 * và tải về file `lich-hoa-<mien>-<kho>.png`.
 */
export async function downloadPosterPng(
  flowers: readonly PosterFlowerInput[],
  region: Filter | string = 'all',
  year: YearInput = new Date(),
  size: PosterSizeKey | string = 'doc',
): Promise<void> {
  if (typeof document === 'undefined') return;

  const sizeKey = normalizePosterSize(size);
  const spec = POSTER_SIZES[sizeKey];
  const filename = posterFilename(region, sizeKey);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Tiếp tục nếu trình duyệt không hỗ trợ FontFaceSet
  }

  const svgContent = buildPosterSvg(flowers, region, year, sizeKey);
  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = spec.width;
    canvas.height = spec.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, spec.width, spec.height);
    ctx.drawImage(img, 0, 0, spec.width, spec.height);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!pngBlob) return;

    const pngUrl = URL.createObjectURL(pngBlob);
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
