import { describe, expect, it } from 'vitest';
import { bloomingWith, daysUntilPeak, inSeason, statusOn, vnParts, type SeasonFlower } from './season';

// Giữa trưa giờ Việt Nam (05:00Z) của y-m-d, tránh sát ranh giới ngày.
const vn = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 5));

const daQuy: SeasonFlower = {
  slug: 'da-quy',
  season: { start: { month: 10, day: 15 }, peak: { month: 11, day: 15 }, end: { month: 12, day: 31 } },
};
const maiAnhDao: SeasonFlower = {
  slug: 'mai-anh-dao',
  season: { start: { month: 12 }, peak: { month: 1 }, end: { month: 2 } },
};
const hoaGao: SeasonFlower = { slug: 'hoa-gao', season: { start: { month: 3 }, end: { month: 3 } } };

describe('inSeason', () => {
  it('mùa trong năm', () => {
    expect(inSeason(daQuy, 9)).toBe(false);
    expect(inSeason(daQuy, 10)).toBe(true);
    expect(inSeason(daQuy, 12)).toBe(true);
    expect(inSeason(daQuy, 1)).toBe(false);
  });
  it('mùa vắt qua năm', () => {
    for (const m of [12, 1, 2]) expect(inSeason(maiAnhDao, m)).toBe(true);
    for (const m of [3, 6, 11]) expect(inSeason(maiAnhDao, m)).toBe(false);
  });
  it('mùa một tháng', () => {
    expect(inSeason(hoaGao, 3)).toBe(true);
    expect(inSeason(hoaGao, 4)).toBe(false);
  });
});

describe('statusOn', () => {
  it('trước mùa: chưa nở, rồi sắp nở', () => {
    expect(statusOn(daQuy, vn(2026, 7, 1))).toBe('chua-no');
    expect(statusOn(daQuy, vn(2026, 9, 29))).toBe('chua-no'); // còn 16 ngày
    expect(statusOn(daQuy, vn(2026, 10, 1))).toBe('sap-no'); // còn 14 ngày
    expect(statusOn(daQuy, vn(2026, 10, 14))).toBe('sap-no');
  });
  it('ngày đầu mùa là đang nở', () => {
    expect(statusOn(daQuy, vn(2026, 10, 15))).toBe('dang-no');
  });
  it('đỉnh mùa quanh ngày đỉnh', () => {
    expect(statusOn(daQuy, vn(2026, 11, 7))).toBe('dang-no');
    expect(statusOn(daQuy, vn(2026, 11, 8))).toBe('dinh-mua');
    expect(statusOn(daQuy, vn(2026, 11, 15))).toBe('dinh-mua');
    expect(statusOn(daQuy, vn(2026, 11, 22))).toBe('dinh-mua');
    expect(statusOn(daQuy, vn(2026, 11, 23))).toBe('dang-no');
  });
  it('sắp tàn trong 14 ngày cuối, kể cả ngày cuối mùa', () => {
    expect(statusOn(daQuy, vn(2026, 12, 16))).toBe('dang-no');
    expect(statusOn(daQuy, vn(2026, 12, 17))).toBe('sap-tan');
    expect(statusOn(daQuy, vn(2026, 12, 31))).toBe('sap-tan');
  });
  it('sau mùa: hết mùa, rồi chưa nở khi xa mùa sau', () => {
    expect(statusOn(daQuy, vn(2027, 1, 1))).toBe('het-mua');
    expect(statusOn(daQuy, vn(2027, 4, 1))).toBe('het-mua');
    expect(statusOn(daQuy, vn(2027, 6, 1))).toBe('chua-no');
  });
  it('mùa vắt năm: 31/12 → 1/1 không bị gián đoạn', () => {
    expect(statusOn(maiAnhDao, vn(2026, 11, 20))).toBe('sap-no');
    expect(statusOn(maiAnhDao, vn(2026, 12, 1))).toBe('dang-no');
    expect(statusOn(maiAnhDao, vn(2026, 12, 31))).toBe('dang-no');
    expect(statusOn(maiAnhDao, vn(2027, 1, 1))).toBe('dang-no');
    expect(statusOn(maiAnhDao, vn(2027, 1, 8))).toBe('dinh-mua');
    expect(statusOn(maiAnhDao, vn(2027, 1, 15))).toBe('dinh-mua');
    expect(statusOn(maiAnhDao, vn(2027, 2, 28))).toBe('sap-tan');
    expect(statusOn(maiAnhDao, vn(2027, 3, 1))).toBe('het-mua');
  });
  it('năm nhuận: 29/2 là ngày cuối mùa', () => {
    expect(statusOn(maiAnhDao, vn(2028, 2, 29))).toBe('sap-tan');
    expect(statusOn(maiAnhDao, vn(2028, 3, 1))).toBe('het-mua');
  });
  it('tính ngày theo giờ Việt Nam, không theo UTC', () => {
    // 17:00Z ngày 31/12 đã là 00:00 ngày 1/1 ở Việt Nam
    const instant = new Date('2026-12-31T17:00:00Z');
    expect(vnParts(instant)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(statusOn(daQuy, instant)).toBe('het-mua');
    expect(statusOn(daQuy, new Date('2026-12-31T16:59:00Z'))).toBe('sap-tan');
  });
});

describe('daysUntilPeak', () => {
  it('đếm ngược tới đầu đỉnh mùa', () => {
    expect(daysUntilPeak(daQuy, vn(2026, 10, 27))).toBe(12); // đỉnh bắt đầu 8/11
    expect(daysUntilPeak(daQuy, vn(2026, 11, 7))).toBe(1);
  });
  it('bằng 0 khi đang đỉnh mùa', () => {
    expect(daysUntilPeak(daQuy, vn(2026, 11, 8))).toBe(0);
    expect(daysUntilPeak(daQuy, vn(2026, 11, 22))).toBe(0);
  });
  it('sau đỉnh thì đếm tới đỉnh năm sau', () => {
    expect(daysUntilPeak(daQuy, vn(2026, 11, 23))).toBe(350); // 8/11/2027
  });
  it('đỉnh vắt năm', () => {
    expect(daysUntilPeak(maiAnhDao, vn(2026, 12, 20))).toBe(19); // đỉnh bắt đầu 8/1/2027
  });
});

describe('bloomingWith', () => {
  const all = [daQuy, maiAnhDao, hoaGao];
  it('lấy loài có chung tháng, kể cả mùa vắt năm, trừ chính nó', () => {
    expect(bloomingWith(daQuy, all)).toEqual([maiAnhDao]);
    expect(bloomingWith(maiAnhDao, all)).toEqual([daQuy]);
    expect(bloomingWith(hoaGao, all)).toEqual([]);
  });
});
