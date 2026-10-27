import { describe, expect, it } from 'vitest';
import { countdown, peakLabel, peakMonth, statusHeadline } from './detail';

const daQuy = {
  season: { start: { month: 10, day: 15 }, peak: { month: 11, day: 15 }, end: { month: 12, day: 31 } },
};
const d = (s: string) => new Date(`${s}T05:00:00Z`); // 12:00 giờ Việt Nam

describe('detail', () => {
  it('peakLabel / peakMonth', () => {
    expect(peakLabel(daQuy)).toBe('giữa tháng 11');
    expect(peakMonth({ season: { start: { month: 5 }, end: { month: 7 } } })).toBe(6);
    expect(peakMonth({ season: { start: { month: 12 }, end: { month: 2 } } })).toBe(1);
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
  it('ngoài mùa: đếm tới mùa nở', () => {
    expect(countdown(daQuy, d('2026-10-01')).label).toBe('nữa tới mùa nở');
    expect(countdown(daQuy, d('2026-10-01')).value).toBe('~14 ngày');
  });
});
