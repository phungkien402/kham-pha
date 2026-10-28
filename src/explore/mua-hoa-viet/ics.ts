// Logic tạo file lịch nhắc mùa hoa (.ics) theo chuẩn RFC 5545.
// Thuần TypeScript, không phụ thuộc Astro/DOM trong `buildIcs` để test bằng vitest.

import { site } from '../../config/site';
import { vnParts, type MonthDay, type Season } from './season';
import type { DateInput } from './nearest';

export type { DateInput };

export interface IcsFlowerInput {
  slug?: string;
  name?: string;
  regionLabel?: string;
  seasons?: Season[];
  /** Tương thích dữ liệu thô từ flowers.json (trước khi qua zod transform). */
  season?: Season;
}

export type IcsEventKind = 'sap-no' | 'dinh-mua';

const DAY_MS = 86_400_000;
const MAX_LINE_OCTETS = 75;
const REMIND_DAYS_BEFORE_START = 7;

const utf8Encoder = new TextEncoder();

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const dayNumber = (year: number, month: number, day: number): number =>
  Date.UTC(year, month - 1, day) / DAY_MS;

function fromDayNumber(n: number): { year: number; month: number; day: number } {
  const d = new Date(n * DAY_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad4 = (n: number): string => String(n).padStart(4, '0');

/** Định dạng ngày UTC epoch-day thành chuỗi `YYYYMMDD` cho `VALUE=DATE` trong iCalendar. */
export function formatIcsDate(dayNum: number): string {
  const { year, month, day } = fromDayNumber(dayNum);
  return `${pad4(year)}${pad2(month)}${pad2(day)}`;
}

/**
 * Escape chuỗi văn bản theo chuẩn RFC 5545 mục 3.3.11:
 * backslash (`\`), chấm phẩy (`;`), dấu phẩy (`,`) và xuống dòng (`\n`).
 */
export function escapeIcsText(text: string): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Gập dòng dài quá 75 octet (UTF-8) theo chuẩn RFC 5545 mục 3.1:
 * chèn CRLF + 1 dấu cách (`\r\n `), không cắt giữa ký tự UTF-8 nhiều byte.
 */
export function foldIcsLine(line: string, maxOctets = MAX_LINE_OCTETS): string {
  if (typeof line !== 'string' || maxOctets < 4) return String(line ?? '');
  if (utf8Encoder.encode(line).length <= maxOctets) return line;

  const segments: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of line) {
    const chBytes = utf8Encoder.encode(ch).length;
    if (currentBytes + chBytes > maxOctets && current.length > 0) {
      segments.push(current);
      current = ' ' + ch;
      currentBytes = 1 + chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments.join('\r\n');
}

/** Mở gập dòng (unfold) chuỗi .ics để tiện đọc / kiểm tra nội dung. */
export function unfoldIcs(ics: string): string {
  return String(ics ?? '').replace(/\r\n[ \t]/g, '');
}

function toVnDateParts(
  date: DateInput | undefined,
): { year: number; month: number; day: number } | null {
  if (date === undefined || date === null) {
    return vnParts(new Date());
  }
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    return vnParts(date);
  }
  if (typeof date === 'number') {
    if (!Number.isFinite(date)) return null;
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? null : vnParts(d);
  }
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (!trimmed) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
        return null;
      }
      return { year, month, day };
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : vnParts(d);
  }
  if (
    typeof date === 'object' &&
    typeof date.year === 'number' &&
    typeof date.month === 'number' &&
    typeof date.day === 'number' &&
    Number.isFinite(date.year) &&
    Number.isFinite(date.month) &&
    Number.isFinite(date.day)
  ) {
    const year = Math.trunc(date.year);
    const month = Math.trunc(date.month);
    const day = Math.trunc(date.day);
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      return null;
    }
    return { year, month, day };
  }
  return null;
}

function isValidMonthDay(md: MonthDay | undefined): md is MonthDay {
  if (!md || typeof md.month !== 'number' || !Number.isFinite(md.month)) return false;
  if (md.month < 1 || md.month > 12) return false;
  if (
    md.day !== undefined &&
    (typeof md.day !== 'number' || !Number.isFinite(md.day) || md.day < 1 || md.day > 31)
  ) {
    return false;
  }
  return true;
}

function isValidSeason(s: Season | undefined): s is Season {
  return !!s && isValidMonthDay(s.start) && isValidMonthDay(s.end);
}

interface SeasonOccurrence {
  startDay: number;
  peakDay: number;
  endDay: number;
}

function computeOccurrence(season: Season, startYear: number): SeasonOccurrence {
  const { start, peak, end } = season;
  const endYear = end.month < start.month ? startYear + 1 : startYear;
  const sDay = Math.min(start.day ?? 1, daysInMonth(startYear, start.month));
  const eDay = Math.min(
    end.day ?? daysInMonth(endYear, end.month),
    daysInMonth(endYear, end.month),
  );
  const startDay = dayNumber(startYear, start.month, sDay);
  const endDay = dayNumber(endYear, end.month, eDay);

  let peakDay: number;
  if (peak && isValidMonthDay(peak)) {
    const peakYear = peak.month < start.month ? startYear + 1 : startYear;
    const pDay = Math.min(peak.day ?? 15, daysInMonth(peakYear, peak.month));
    peakDay = dayNumber(peakYear, peak.month, pDay);
  } else {
    peakDay = Math.round((startDay + endDay) / 2);
  }

  return { startDay, peakDay, endDay };
}

/**
 * Tìm đợt nở của năm tới gần nhất chưa qua (nếu đợt năm nay đã hết `endDay < today` thì lấy năm sau).
 * Xét `[year - 1, year, year + 1]` để xử lý đúng cả đợt nở vắt qua năm (vd tháng 12 → tháng 2).
 */
function nextSeasonOccurrence(
  season: Season,
  todayParts: { year: number; month: number; day: number },
): SeasonOccurrence {
  const t = dayNumber(todayParts.year, todayParts.month, todayParts.day);
  const { year } = todayParts;
  for (const y of [year - 1, year, year + 1]) {
    const occ = computeOccurrence(season, y);
    if (occ.endDay >= t) {
      return occ;
    }
  }
  return computeOccurrence(season, year + 1);
}

function sanitizeSlug(slug: string | undefined): string {
  const cleaned = String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'hoa';
}

/**
 * Tạo nội dung file lịch `.ics` (RFC 5545) cho một loài hoa tính từ ngày `today` (giờ Việt Nam).
 * Mỗi đợt nở trong `flower.seasons` sinh 2 sự kiện cả ngày lặp hằng năm (`RRULE:FREQ=YEARLY`)
 * kèm `VALARM` nhắc trước 1 ngày (`TRIGGER:-P1D`):
 * 1. `"Sắp tới mùa <tên hoa>"` vào 7 ngày trước ngày bắt đầu đợt nở (`UID: <slug>-<đợt>-sap-no@kham-pha`)
 * 2. `"<tên hoa> vào đỉnh mùa"` vào ngày đỉnh mùa (`UID: <slug>-<đợt>-dinh-mua@kham-pha`)
 */
export function buildIcs(flower: IcsFlowerInput, today: DateInput = new Date()): string {
  if (!flower || typeof flower !== 'object') return '';

  const rawSeasons = Array.isArray(flower.seasons)
    ? flower.seasons
    : flower.season
      ? [flower.season]
      : [];
  const seasons = rawSeasons.filter(isValidSeason);
  if (seasons.length === 0) return '';

  const todayParts = toVnDateParts(today);
  if (!todayParts) return '';

  const slug = sanitizeSlug(flower.slug);
  const name = String(flower.name ?? '').trim() || slug;
  const baseUrl = site.url.replace(/\/$/, '');
  const flowerUrl = `${baseUrl}/mua-hoa-viet/${slug}/`;
  const dtstamp = `${pad4(todayParts.year)}${pad2(todayParts.month)}${pad2(todayParts.day)}T000000Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kham Pha//Mua Hoa Viet//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`Mùa hoa: ${name}`)}`,
  ];

  seasons.forEach((season, index) => {
    const dot = index + 1;
    const occ = nextSeasonOccurrence(season, todayParts);
    const remindStartDay = occ.startDay - REMIND_DAYS_BEFORE_START;
    const peakDay = occ.peakDay;

    const notePart = season.note ? ` (${season.note})` : '';
    const regionPart = flower.regionLabel ? `, nơi ngắm: ${flower.regionLabel}` : '';

    const summarySoon = `Sắp tới mùa ${name}`;
    const descSoon = `${flowerUrl} — Còn 7 ngày nữa bắt đầu mùa ${name}${notePart}${regionPart}; xem điểm ngắm, mùa nở tại /mua-hoa-viet/${slug}/`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${slug}-${dot}-sap-no@kham-pha`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(remindStartDay)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(remindStartDay + 1)}`,
      'RRULE:FREQ=YEARLY',
      `SUMMARY:${escapeIcsText(summarySoon)}`,
      `DESCRIPTION:${escapeIcsText(descSoon)}`,
      `URL:${flowerUrl}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Nhắc lịch: ${summarySoon}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );

    const summaryPeak = `${name} vào đỉnh mùa`;
    const descPeak = `${flowerUrl} — ${name} vào đỉnh mùa nở rộ${notePart}${regionPart}; xem điểm ngắm, mùa nở tại /mua-hoa-viet/${slug}/`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${slug}-${dot}-dinh-mua@kham-pha`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(peakDay)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(peakDay + 1)}`,
      'RRULE:FREQ=YEARLY',
      `SUMMARY:${escapeIcsText(summaryPeak)}`,
      `DESCRIPTION:${escapeIcsText(descPeak)}`,
      `URL:${flowerUrl}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Nhắc lịch: ${summaryPeak}`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');

  return lines.map((line) => foldIcsLine(line, MAX_LINE_OCTETS)).join('\r\n') + '\r\n';
}

/** Tạo Blob `.ics` phía trình duyệt và kích hoạt tải về file `<slug>.ics`. */
export function downloadFlowerIcs(flower: IcsFlowerInput, today: DateInput = new Date()): void {
  if (typeof document === 'undefined') return;
  const content = buildIcs(flower, today);
  if (!content) return;
  const slug = sanitizeSlug(flower.slug);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.ics`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
