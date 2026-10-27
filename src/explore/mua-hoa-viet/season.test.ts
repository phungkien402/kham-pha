import { describe, expect, it } from 'vitest';
import flowersJson from './data/flowers.json';
import { bloomingWith, daysUntilPeak, inSeason, isBloomingIn, showEndingTag, statusOn, vnParts, type SeasonFlower } from './season';

// Giữa trưa giờ Việt Nam (05:00Z) của y-m-d, tránh sát ranh giới ngày.
const vn = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 5));

const daQuy: SeasonFlower = {
  slug: 'da-quy',
  seasons: [{ start: { month: 10, day: 15 }, peak: { month: 11, day: 15 }, end: { month: 12, day: 31 } }],
};
const maiAnhDao: SeasonFlower = {
  slug: 'mai-anh-dao',
  seasons: [{ start: { month: 12 }, peak: { month: 1 }, end: { month: 2 } }],
};
const hoaGao: SeasonFlower = { slug: 'hoa-gao', seasons: [{ start: { month: 3 }, end: { month: 3 } }] };

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

describe('showEndingTag', () => {
  const t = (year: number, month: number, day: number) => ({ year, month, day });
  const single = { seasons: [{ start: { month: 4 }, end: { month: 4 } }] };
  const multi = { seasons: [{ start: { month: 10 }, end: { month: 12 } }] };
  const wrap = { seasons: [{ start: { month: 12 }, end: { month: 2 } }] };

  it('loài nở đúng một tháng, xem tháng khác: không gắn', () => {
    expect(showEndingTag(single, 4, t(2026, 10, 27))).toBe(false);
  });
  it('tháng khác: gắn khi là tháng cuối của mùa dài hơn một tháng', () => {
    expect(showEndingTag(multi, 12, t(2026, 10, 27))).toBe(true);
    expect(showEndingTag(multi, 11, t(2026, 10, 27))).toBe(false);
    expect(showEndingTag(wrap, 2, t(2026, 10, 27))).toBe(true);
  });
  it('tháng hiện tại: theo statusOn của hôm nay', () => {
    expect(showEndingTag(single, 4, t(2026, 4, 10))).toBe(false);
    expect(showEndingTag(single, 4, t(2026, 4, 25))).toBe(true);
    expect(showEndingTag(multi, 12, t(2026, 12, 5))).toBe(false);
    expect(showEndingTag(multi, 12, t(2026, 12, 25))).toBe(true);
  });
});

describe('isBloomingIn', () => {
  const luaChin: SeasonFlower = {
    slug: 'lua-chin',
    seasons: [{ start: { month: 9, day: 15 }, end: { month: 10, day: 15 } }],
  };
  const t = { year: 2026, month: 10, day: 27 };
  it('tháng hiện tại: lúa chín hết mùa 15/10 thì không còn đang nở', () => {
    expect(inSeason(luaChin, 10)).toBe(true);
    expect(isBloomingIn(luaChin, 10, t)).toBe(false);
  });
  it('tháng hiện tại: dã quỳ đang nở', () => {
    expect(isBloomingIn(daQuy, 10, t)).toBe(true);
  });
  it('tháng khác vẫn tính theo tháng', () => {
    expect(isBloomingIn(luaChin, 9, t)).toBe(true);
    expect(isBloomingIn(daQuy, 11, t)).toBe(true);
    expect(isBloomingIn(daQuy, 9, t)).toBe(false);
  });
});

describe('nhiều đợt nở', () => {
  // Dữ liệu thử, không phải dữ liệu thật: đợt 1 tháng 10, đợt 2 vắt năm 25/12 → 15/1.
  const hd: SeasonFlower = {
    slug: 'hd',
    seasons: [
      { start: { month: 10, day: 5 }, peak: { month: 10, day: 17 }, end: { month: 10, day: 28 } },
      { start: { month: 12, day: 25 }, peak: { month: 1, day: 5 }, end: { month: 1, day: 15 } },
    ],
  };
  const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day, 5));

  it('trong đợt 1: đang nở / đỉnh mùa', () => {
    expect(statusOn(hd, d(2026, 10, 15))).toBe('dinh-mua');
    expect(statusOn(hd, d(2026, 10, 8))).toBe('dang-no');
  });
  it('giữa hai đợt (1/11) không phải đang nở; kế tiếp là đợt 2 nên chưa nở', () => {
    expect(statusOn(hd, d(2026, 11, 1))).toBe('het-mua');
    expect(statusOn(hd, d(2026, 12, 1))).toBe('chua-no');
    expect(isBloomingIn(hd, 11, { year: 2026, month: 11, day: 1 })).toBe(false);
  });
  it('sắp nở theo đợt kế tiếp', () => {
    expect(statusOn(hd, d(2026, 12, 15))).toBe('sap-no');
    expect(daysUntilPeak(hd, d(2026, 11, 1))).toBe(Date.UTC(2027, 0, 5) / 86_400_000 - 7 - Date.UTC(2026, 10, 1) / 86_400_000);
  });
  it('trong đợt 2 vắt năm: 26/12 đang nở, 31/12 và 1/1 vào đỉnh', () => {
    expect(statusOn(hd, d(2026, 12, 26))).toBe('dang-no');
    expect(statusOn(hd, d(2026, 12, 31))).toBe('dinh-mua');
    expect(statusOn(hd, d(2027, 1, 1))).toBe('dinh-mua');
    expect(statusOn(hd, d(2027, 1, 14))).toBe('sap-tan');
    expect(statusOn(hd, d(2027, 1, 25))).toBe('het-mua');
  });
  it('inSeason và showEndingTag theo mọi đợt', () => {
    expect(inSeason(hd, 10)).toBe(true);
    expect(inSeason(hd, 11)).toBe(false);
    expect(inSeason(hd, 1)).toBe(true);
    expect(showEndingTag(hd, 1, { year: 2026, month: 10, day: 27 })).toBe(true);
  });
});

describe('hướng dương (dữ liệu thật)', () => {
  const hd = (flowersJson as { slug: string; seasons?: SeasonFlower['seasons'] }[]).find((f) => f.slug === 'huong-duong') as SeasonFlower;
  const d = (m: number, day: number) => new Date(Date.UTC(2026, m - 1, day, 5));
  it('15/10 đang nở / đỉnh mùa, 1/11 không còn đang nở', () => {
    expect(['dang-no', 'dinh-mua']).toContain(statusOn(hd, d(10, 15)));
    expect(['dang-no', 'dinh-mua', 'sap-tan']).not.toContain(statusOn(hd, d(11, 1)));
    expect(isBloomingIn(hd, 11, { year: 2026, month: 11, day: 1 })).toBe(false);
  });
});
