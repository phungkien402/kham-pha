// Test bước 30 (Poster lịch hoa 12 tháng) theo spec docs/buoc-28-32-mua-hoa.md mục 30.
import { describe, expect, it } from 'vitest';
import { site } from '../../config/site';
import {
  buildPosterSvg,
  normalizePosterSize,
  posterFilename,
  posterRegionSlug,
  posterRows,
  posterTitle,
} from './poster';

const dao = {
  slug: 'hoa-dao',
  name: 'Hoa đào',
  color: '#E8A0B4',
  regions: ['bac'],
  seasons: [{ start: { month: 1, day: 5 }, peak: { month: 1, day: 25 }, end: { month: 2, day: 20 } }],
};
// Mùa vắt qua năm: T12 → T2
const mai = {
  slug: 'hoa-mai',
  name: 'Hoa mai',
  color: '#F2C94C',
  regions: ['nam'],
  seasons: [{ start: { month: 12, day: 10 }, peak: { month: 1, day: 20 }, end: { month: 2, day: 10 } }],
};
const sen = {
  slug: 'hoa-sen',
  name: 'Hoa sen',
  regions: ['bac', 'trung', 'nam'],
  seasons: [
    { start: { month: 5 }, end: { month: 6 } },
    { start: { month: 8 }, end: { month: 9 } },
  ],
};

describe('posterTitle', () => {
  it('"Lịch mùa hoa Việt <năm>–<năm+1>"', () => {
    expect(posterTitle(2026)).toBe('Lịch mùa hoa Việt 2026–2027');
  });
  it('nhận Date theo giờ VN', () => {
    expect(posterTitle(new Date(Date.UTC(2026, 9, 28, 5)))).toBe('Lịch mùa hoa Việt 2026–2027');
  });
  it('Date 31/12 17:30 UTC đã là 1/1 năm sau ở VN', () => {
    expect(posterTitle(new Date(Date.UTC(2026, 11, 31, 17, 30)))).toBe('Lịch mùa hoa Việt 2027–2028');
  });
});

describe('tên file / khổ / miền', () => {
  it('lich-hoa-<mien>-<kho>.png', () => {
    expect(posterFilename('all', 'doc')).toBe('lich-hoa-ca-nuoc-doc.png');
    expect(posterFilename('bac', 'ngang')).toBe('lich-hoa-bac-ngang.png');
    expect(posterFilename('trung', 'a4')).toBe('lich-hoa-trung-a4.png');
    expect(posterFilename('nam', 'doc')).toBe('lich-hoa-nam-doc.png');
  });
  it('giá trị rác rơi về cả nước / dọc', () => {
    expect(posterRegionSlug('xyz')).toBe('ca-nuoc');
    expect(posterRegionSlug(undefined)).toBe('ca-nuoc');
    expect(normalizePosterSize('lung tung')).toBe('doc');
    expect(normalizePosterSize(undefined)).toBe('doc');
    expect(posterFilename('???', '???')).toBe('lich-hoa-ca-nuoc-doc.png');
  });
});

describe('posterRows', () => {
  it('dữ liệu rỗng → []', () => {
    expect(posterRows([], 'all', 2026)).toEqual([]);
  });

  it('không phải mảng → []', () => {
    expect(posterRows(null as never, 'all', 2026)).toEqual([]);
    expect(posterRows(undefined as never, 'all', 2026)).toEqual([]);
  });

  it('mỗi loài một dòng, giữ tên và màu', () => {
    const rows = posterRows([dao, sen], 'all', 2026);
    expect(rows.map((r) => r.name)).toEqual(['Hoa đào', 'Hoa sen']);
    expect(rows[0].color).toBe('#E8A0B4');
    expect(rows[0].yearRange).toBe('2026–2027');
  });

  it('lọc theo miền', () => {
    const all = [dao, mai, sen];
    expect(posterRows(all, 'bac', 2026).map((r) => r.slug)).toEqual(['hoa-dao', 'hoa-sen']);
    expect(posterRows(all, 'nam', 2026).map((r) => r.slug)).toEqual(['hoa-mai', 'hoa-sen']);
    expect(posterRows(all, 'trung', 2026).map((r) => r.slug)).toEqual(['hoa-sen']);
  });

  it('mùa trong năm: months đúng 12 phần tử, bật đúng tháng', () => {
    const [r] = posterRows([dao], 'all', 2026);
    expect(r.months).toHaveLength(12);
    expect(r.activeMonths).toEqual([1, 2]);
    expect(r.months[0]).toBe(true);
    expect(r.months[2]).toBe(false);
  });

  it('mùa trong năm → 1 đoạn, không wrapped, vị trí tăng dần trong [0,12]', () => {
    const [r] = posterRows([dao], 'all', 2026);
    expect(r.segments).toHaveLength(1);
    const s = r.segments[0];
    expect(s.wrapped).toBe(false);
    expect(s.startCol).toBeGreaterThanOrEqual(0);
    expect(s.endCol).toBeLessThanOrEqual(12);
    expect(s.endCol).toBeGreaterThan(s.startCol);
    expect(s.startCol).toBeGreaterThanOrEqual(0);
    expect(s.startCol).toBeLessThan(1); // 5/1 nằm trong cột T1
    expect(s.endCol).toBeGreaterThan(1);
    expect(s.endCol).toBeLessThan(2); // 20/2 nằm trong cột T2
    expect(s.peakMonth).toBe(1);
  });

  it('mùa vắt qua năm T12→T2 → 2 đoạn: đầu năm và cuối năm', () => {
    const [r] = posterRows([mai], 'all', 2026);
    expect(r.segments).toHaveLength(2);
    expect(r.segments.every((s) => s.wrapped)).toBe(true);
    const [early, late] = r.segments;
    expect(early.startCol).toBe(0);
    expect(early.endMonth).toBe(2);
    expect(late.startMonth).toBe(12);
    expect(late.endCol).toBe(12);
    expect(late.startCol).toBeGreaterThan(early.endCol);
    // đỉnh 20/1 rơi vào đoạn đầu năm, không lặp ở đoạn cuối
    expect(early.peakMonth).toBe(1);
    expect(late.peakMonth).toBeUndefined();
    expect(r.activeMonths).toEqual([1, 2, 12]);
  });

  it('mọi đoạn nằm trong [0,12] và widthPct khớp tỉ lệ', () => {
    for (const r of posterRows([dao, mai, sen], 'all', 2026)) {
      for (const s of r.segments) {
        expect(s.startCol).toBeGreaterThanOrEqual(0);
        expect(s.endCol).toBeLessThanOrEqual(12);
        expect(s.endCol).toBeGreaterThan(s.startCol);
        expect(s.startPct + s.widthPct).toBeLessThanOrEqual(100 + 1e-9);
        expect(s.widthPct).toBeCloseTo(((s.endCol - s.startCol) / 12) * 100, 6);
      }
    }
  });

  it('nhiều đợt nở → nhiều đoạn, sắp theo thời gian', () => {
    const [r] = posterRows([sen], 'all', 2026);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].startCol).toBeLessThan(r.segments[1].startCol);
    expect(r.segments.map((s) => s.seasonIndex)).toEqual([0, 1]);
    expect(r.peakMonths).toHaveLength(2);
  });

  it('chú thích đỉnh mùa có tiền tố "Đỉnh:"', () => {
    const [r] = posterRows([dao], 'all', 2026);
    expect(r.peakNote).toBe(`Đỉnh: ${r.peakLabel}`);
    expect(r.peakLabel).toContain('tháng 1');
  });

  it('ngày 29/2: năm nhuận 2028 tháng 2 kéo tới hết cột T2', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 2, day: 1 }, end: { month: 2, day: 29 } }] };
    const [r] = posterRows([f], 'all', 2028);
    expect(r.segments[0].endDay).toBe(29);
    expect(r.segments[0].startCol).toBe(1);
    expect(r.segments[0].endCol).toBeCloseTo(2, 9);
  });

  it('ngày 29/2: năm thường 2027 bị kẹp về 28 và không tràn sang T3', () => {
    const f = { slug: 'x', name: 'X', seasons: [{ start: { month: 2, day: 1 }, end: { month: 2, day: 29 } }] };
    const [r] = posterRows([f], 'all', 2027);
    expect(r.segments[0].endDay).toBe(28);
    expect(r.segments[0].endCol).toBeCloseTo(2, 9);
  });

  it('đỉnh mùa 29/2 năm thường không văng ra ngoài tháng 2', () => {
    const f = {
      slug: 'x',
      name: 'X',
      seasons: [{ start: { month: 2, day: 1 }, peak: { month: 2, day: 29 }, end: { month: 3, day: 10 } }],
    };
    const [r] = posterRows([f], 'all', 2027);
    const s = r.segments[0];
    expect(s.peakCol).toBeGreaterThanOrEqual(1);
    expect(s.peakCol).toBeLessThanOrEqual(2);
  });

  it('dữ liệu rác: phần tử null / không có mùa / tháng ngoài khoảng bị bỏ qua, không ném lỗi', () => {
    const rac: unknown[] = [
      null,
      undefined,
      42,
      'hoa',
      {},
      { slug: 'a', name: 'A' },
      { slug: 'b', name: 'B', seasons: [] },
      { slug: 'c', name: 'C', seasons: [{ start: { month: 13 }, end: { month: 2 } }] },
      { slug: 'd', name: 'D', seasons: [{ start: { month: 0 }, end: { month: 2 } }] },
      { slug: 'e', name: 'E', seasons: [{ start: { month: 'ba' }, end: { month: 2 } }] },
      { slug: 'f', name: 'F', seasons: 'không phải mảng' },
      dao,
    ];
    let rows: ReturnType<typeof posterRows> = [];
    expect(() => {
      rows = posterRows(rac as never, 'all', 2026);
    }).not.toThrow();
    expect(rows.map((r) => r.slug)).toEqual(['hoa-dao']);
  });

  it('năm rác → [] chứ không ném lỗi', () => {
    for (const y of [NaN, -5, 0, 1.5, 'abc', 'xx', {}, { year: 'a' }, new Date('x')]) {
      expect(() => posterRows([dao], 'all', y as never)).not.toThrow();
      expect(posterRows([dao], 'all', y as never)).toEqual([]);
    }
  });

  it('miền rác → [] (không trộn miền khác)', () => {
    expect(posterRows([dao], 'khong-co', 2026)).toEqual([]);
  });

  it('nhận dữ liệu thô dùng khoá "season" (một đợt)', () => {
    const raw = { slug: 'r', name: 'R', season: { start: { month: 3 }, end: { month: 4 } } };
    const [r] = posterRows([raw], 'all', 2026);
    expect(r.activeMonths).toEqual([3, 4]);
  });

  it('không đổi dữ liệu đầu vào', () => {
    const copy = JSON.parse(JSON.stringify([dao, mai, sen]));
    posterRows(copy, 'all', 2026);
    expect(copy).toEqual([dao, mai, sen]);
  });
});

describe('buildPosterSvg', () => {
  const flowers = [dao, mai, sen];

  it('3 khổ có width/height đúng', () => {
    const doc = buildPosterSvg(flowers, 'all', 2026, 'doc');
    const ngang = buildPosterSvg(flowers, 'all', 2026, 'ngang');
    const a4 = buildPosterSvg(flowers, 'all', 2026, 'a4');
    expect(doc).toContain('width="1080" height="1920"');
    expect(ngang).toContain('width="1920" height="1080"');
    expect(a4).toContain('width="2480" height="3508"');
  });

  it('là SVG hợp lệ cơ bản, bắt đầu <svg và kết thúc </svg>', () => {
    const svg = buildPosterSvg(flowers, 'all', 2026, 'doc');
    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('có tiêu đề, 12 nhãn tháng T1–T12, tên loài, chân trang tên web + URL', () => {
    const svg = buildPosterSvg(flowers, 'all', 2026, 'doc');
    expect(svg).toContain('Lịch mùa hoa Việt 2026–2027');
    for (let m = 1; m <= 12; m++) expect(svg).toMatch(new RegExp(`>T${m}<`));
    expect(svg).toContain('Hoa đào');
    expect(svg).toContain('Hoa mai');
    expect(svg).toContain(site.name);
    expect(svg).toContain(site.url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  });

  it('có màu thanh của loài', () => {
    expect(buildPosterSvg([dao], 'all', 2026, 'doc')).toContain('#E8A0B4');
  });

  it('dữ liệu rỗng vẫn dựng được khung (tiêu đề + 12 tháng), không ném lỗi', () => {
    const svg = buildPosterSvg([], 'all', 2026, 'doc');
    expect(svg).toContain('Lịch mùa hoa Việt 2026–2027');
    expect(svg).toMatch(/>T12</);
  });

  it('thoát ký tự XML trong tên loài', () => {
    const f = { slug: 'x', name: 'A & <B> "C"', seasons: [{ start: { month: 1 }, end: { month: 2 } }] };
    const svg = buildPosterSvg([f], 'all', 2026, 'doc');
    expect(svg).not.toContain('<B>');
    expect(svg).toContain('A &amp; &lt;B&gt;');
  });

  it('khổ rác → dùng khổ dọc; không chứa NaN/undefined', () => {
    const svg = buildPosterSvg(flowers, 'all', 2026, 'rac');
    expect(svg).toContain('width="1080" height="1920"');
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('không có NaN/undefined ở mọi khổ khi có mùa vắt năm và năm nhuận', () => {
    for (const k of ['doc', 'ngang', 'a4']) {
      expect(buildPosterSvg(flowers, 'all', 2028, k)).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('lọc miền ảnh hưởng nội dung: miền Trung chỉ còn hoa sen', () => {
    const svg = buildPosterSvg(flowers, 'trung', 2026, 'doc');
    expect(svg).toContain('Hoa sen');
    expect(svg).not.toContain('Hoa đào');
    expect(svg).not.toContain('Hoa mai');
  });
});

// Phần cần DOM (canvas, document.fonts.ready, nút/hộp chọn khổ trong MuaHoaViet.svelte,
// downloadPosterPng) không có @testing-library/svelte → ghi vào "uncertain" của REVIEW.json.
