import { describe, expect, it } from 'vitest';
import { arcPath, monthFromAngle, needleAngle } from './wheel';

describe('monthFromAngle', () => {
  it('đầu và cuối vòng: -90° là đầu tháng 1, -91° là tháng 12', () => {
    expect(monthFromAngle(-90)).toBe(1);
    expect(monthFromAngle(-91)).toBe(12);
    expect(monthFromAngle(269)).toBe(12);
  });
  it('0° (hướng đông) rơi vào tháng 4, 90° (nam) vào tháng 7, 180° (tây) vào tháng 10', () => {
    expect(monthFromAngle(0)).toBe(4);
    expect(monthFromAngle(90)).toBe(7);
    expect(monthFromAngle(180)).toBe(10);
  });
  it('mỗi tháng rộng 30°', () => {
    expect(monthFromAngle(-90 + 29.9)).toBe(1);
    expect(monthFromAngle(-90 + 30)).toBe(2);
  });
});

describe('needleAngle', () => {
  const today = { year: 2026, month: 10, day: 27 };
  it('tháng hiện tại: đúng ngày hôm nay', () => {
    expect(needleAngle(10, today)).toBeCloseTo((9 + 27 / 31) * 30 - 90);
  });
  it('tháng khác: giữa tháng', () => {
    expect(needleAngle(3, today)).toBe(2.5 * 30 - 90);
  });
});

describe('arcPath', () => {
  it('mùa vắt năm (12 → 2) vẽ cung dài 90° − 4° cùng chiều kim đồng hồ, không phải cung lớn', () => {
    expect(arcPath(100, 12, 2)).toContain(' 0 0 1 ');
  });
  it('mùa cả năm dài hơn 180° dùng cờ large-arc', () => {
    expect(arcPath(100, 1, 12)).toContain(' 0 1 1 ');
  });
});
