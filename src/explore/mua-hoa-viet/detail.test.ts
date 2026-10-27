import { describe, expect, it } from 'vitest';
import { countdown, monthRangeLabel, peakLabel, seasonPhrase, peakMonth, sortByStatus, statusHeadline } from './detail';

const daQuy = {
  seasons: [{ start: { month: 10, day: 15 }, peak: { month: 11, day: 15 }, end: { month: 12, day: 31 } }],
};
const d = (s: string) => new Date(`${s}T05:00:00Z`); // 12:00 giờ Việt Nam

describe('detail', () => {
  it('peakLabel / peakMonth', () => {
    expect(peakLabel(daQuy)).toBe('giữa tháng 11');
    expect(peakMonth({ seasons: [{ start: { month: 5 }, end: { month: 7 } }] })).toBe(6);
    expect(peakMonth({ seasons: [{ start: { month: 12 }, end: { month: 2 } }] })).toBe(1);
  });
  it('trước đỉnh: đếm tới đỉnh', () => {
    expect(countdown(daQuy, d('2026-10-27'))).toEqual({ value: '~12 ngày', label: 'nữa tới đỉnh mùa' });
    expect(statusHeadline(daQuy, d('2026-10-27'))).toBe('Đang nở · sắp vào đỉnh mùa');
  });
  it('đang đỉnh', () => {
    expect(countdown(daQuy, d('2026-11-15')).value).toBe('Đỉnh mùa');
  });
  it('sau đỉnh: đếm tới hết mùa', () => {
    expect(countdown(daQuy, d('2026-12-10'))).toEqual({ value: '~21 ngày', label: 'nữa hết mùa' });
  });
  it('sortByStatus: đang nở trước, rồi sắp nở, rồi chưa đến mùa / hết mùa', () => {
    const mk = (id: string, s: number, e: number) => ({ id, seasons: [{ start: { month: s }, end: { month: e } }] });
    const hetMua = mk('het', 3, 4);
    const sapNo = mk('sapno', 11, 12);
    const dangNo = mk('dang', 10, 11);
    const chuaNo = mk('chua', 7, 8);
    const sorted = sortByStatus([hetMua, sapNo, chuaNo, dangNo], d('2026-10-27'));
    expect(sorted.map((x) => x.id)).toEqual(['dang', 'sapno', 'het', 'chua']);
  });
  it('ngoài mùa: đếm tới mùa nở', () => {
    expect(countdown(daQuy, d('2026-10-01')).label).toBe('nữa tới mùa nở');
    expect(countdown(daQuy, d('2026-10-01')).value).toBe('~14 ngày');
  });
  it('câu chữ mùa nở theo ngày', () => {
    const tgm = { seasons: [{ start: { month: 10, day: 15 }, end: { month: 12, day: 5 } }] };
    expect(seasonPhrase(tgm)).toBe('từ giữa tháng 10 đến đầu tháng 12');
    expect(monthRangeLabel(tgm)).toBe('giữa tháng 10 – đầu tháng 12');
    expect(monthRangeLabel(daQuy)).toBe('giữa tháng 10 – cuối tháng 12');
    const khongNgay = { seasons: [{ start: { month: 3 }, end: { month: 5 } }] };
    expect(seasonPhrase(khongNgay)).toBe('từ tháng 3 đến tháng 5');
    expect(seasonPhrase({ seasons: [{ start: { month: 3 }, end: { month: 3 } }] })).toBe('tháng 3');
  });
});
