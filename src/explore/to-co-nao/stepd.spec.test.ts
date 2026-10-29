// Test bước D theo docs/to-co-nao-d-dac-ta.md (viết độc lập với code): kỳ vọng tính thẳng từ meta.json
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { funFact, surprisingPairs } from './funFacts';
import { TOUR_STEPS, getTourComparison, parseHanhTrinhUrl } from './tourData';
import { decodeUrlState, encodeUrlState } from './math';

const dir = path.resolve(__dirname, 'data');
const meta: any[] = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const byId = new Map<string, any>(meta.map((m) => [m.id, m]));
const vn = byId.get('viet-nam');
const provinces = meta.filter((m) => m.type === 'tinh');
const countries = meta.filter((m) => m.type === 'nuoc' && m.id !== 'ata');

// Định dạng số Việt tự viết: chấm nghìn, phẩy thập phân
const viInt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const vi1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  const [i, d] = r.toString().split('.');
  const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return d ? `${ii},${d}` : ii;
};

describe('D3 funFact — tỉnh', () => {
  it('Lâm Đồng: hạng theo area giảm dần / 34, % diện tích VN, độ dài', () => {
    expect(provinces).toHaveLength(34);
    const sorted = [...provinces].sort((a, b) => b.area - a.area);
    const ld = byId.get('lam-dong');
    const k = sorted.findIndex((p) => p.id === 'lam-dong') + 1;
    const f = funFact(ld, meta);
    expect(f).toContain(`Lớn thứ ${k}/34 tỉnh`);
    expect(f).toContain(`${vi1((ld.area / vn.area) * 100)}% diện tích Việt Nam`);
    expect(f).toContain(`dài khoảng ${viInt(ld.len)} km`);
  });
  it('tỉnh nhỏ nhất xếp 34/34', () => {
    const smallest = [...provinces].sort((a, b) => a.area - b.area)[0];
    expect(funFact(smallest, meta)).toContain('Lớn thứ 34/34 tỉnh');
  });
});

describe('D3 funFact — Việt Nam', () => {
  it('hạng trong các nước (không tính tỉnh, bỏ ata), mẫu số = số nước', () => {
    const k = countries.filter((c) => c.area > vn.area).length + 1;
    const f = funFact(vn, meta);
    expect(f).toContain(`Lớn thứ ${k}/${countries.length} nếu xếp cùng các nước`);
    expect(f).toContain(`dài khoảng ${viInt(vn.len)} km`);
  });
});

describe('D3 funFact — nước', () => {
  it('nước lớn hơn VN: hạng thế giới (bỏ ata) + "bằng n lần Việt Nam"', () => {
    const rus = byId.get('rus');
    const k = countries.filter((c) => c.area > rus.area).length + 1;
    const f = funFact(rus, meta);
    expect(f).toContain(`Lớn thứ ${k} thế giới`);
    expect(f).toContain(`bằng ${viInt(rus.area / vn.area)} lần Việt Nam`);
  });
  it('xếp hạng không bị Nam Cực chen vào: nước lớn thứ hai không bị tụt hạng', () => {
    const sorted = [...countries].sort((a, b) => b.area - a.area);
    expect(funFact(sorted[0], meta)).toContain('Lớn thứ 1 thế giới');
    expect(funFact(sorted[1], meta)).toContain('Lớn thứ 2 thế giới');
  });
  it('nước nhỏ hơn VN: "Việt Nam bằng n lần nước này" + cỡ tỉnh gần nhất', () => {
    const bel = byId.get('bel');
    const near = [...provinces].sort(
      (a, b) => Math.abs(a.area - bel.area) - Math.abs(b.area - bel.area),
    )[0];
    const f = funFact(bel, meta);
    expect(f).toContain('Việt Nam bằng');
    expect(f).toContain('lần nước này');
    expect(f).toContain(`cỡ ${near.name}`);
    expect(f).not.toContain('lần Việt Nam');
  });
  it('nước lớn hơn VN không có hậu tố "cỡ <tỉnh>"', () => {
    expect(funFact(byId.get('fra'), meta)).not.toContain('cỡ ');
  });
  it('số lớn dùng dấu chấm nghìn (không dấu phẩy kiểu Anh)', () => {
    const f = funFact(byId.get('sgp'), meta);
    expect(f).not.toMatch(/\d,\d{3}\b/);
  });
});

describe('D4 surprisingPairs', () => {
  const pairs = surprisingPairs(meta);
  it('có kết quả và mỗi phần tử có a (tỉnh), b (nước), ratio', () => {
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      expect(byId.get(p.a).type).toBe('tinh');
      expect(byId.get(p.b).type).toBe('nuoc');
      expect(p.ratio).toBeCloseTo(byId.get(p.b).area / byId.get(p.a).area, 6);
    }
  });
  it('mọi cặp lệch ≤ 6%', () => {
    for (const p of pairs) expect(Math.abs(p.ratio - 1)).toBeLessThanOrEqual(0.06 + 1e-9);
  });
  it('mỗi tỉnh tối đa 1 cặp', () => {
    const ids = pairs.map((p) => p.a);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('bỏ nước < 50 km² và ata', () => {
    for (const p of pairs) {
      expect(p.b).not.toBe('ata');
      expect(byId.get(p.b).area).toBeGreaterThanOrEqual(50);
    }
  });
  it('mỗi cặp là nước gần nhất của tỉnh trong ngưỡng 6%', () => {
    const pool = countries.filter((c) => c.area >= 50);
    for (const p of pairs) {
      const pa = byId.get(p.a).area;
      const best = Math.min(...pool.map((c) => Math.abs(c.area / pa - 1)));
      expect(Math.abs(p.ratio - 1)).toBeCloseTo(best, 9);
    }
  });
  it('đủ tỉnh: không bỏ sót tỉnh nào có nước trong ngưỡng', () => {
    const pool = countries.filter((c) => c.area >= 50);
    const expected = provinces.filter((p) => pool.some((c) => Math.abs(c.area / p.area - 1) <= 0.06));
    expect(new Set(pairs.map((p) => p.a))).toEqual(new Set(expected.map((p) => p.id)));
  });
  it('sắp theo độ lệch tăng dần', () => {
    for (let i = 1; i < pairs.length; i++) {
      expect(Math.abs(pairs[i].ratio - 1)).toBeGreaterThanOrEqual(Math.abs(pairs[i - 1].ratio - 1) - 1e-9);
    }
  });
  it('đầu vào rỗng không lỗi', () => {
    expect(surprisingPairs([])).toEqual([]);
  });
});

describe('D2 10 chặng hành trình', () => {
  // Theo đặc tả: "id trong meta.json; [nhỏ, lớn] theo thứ tự xuất hiện"
  const SPEC: [string, string][] = [
    ['sgp', 'tp-ho-chi-minh'],
    ['lux', 'ha-noi'],
    ['kwt', 'nghe-an'],
    ['bel', 'lam-dong'],
    ['kor', 'viet-nam'],
    ['fin', 'viet-nam'],
    ['jpn', 'viet-nam'],
    ['fra', 'viet-nam'],
    ['chn', 'viet-nam'],
    ['rus', 'viet-nam'],
  ];
  it('đúng 10 chặng, đánh số 1..10', () => {
    expect(TOUR_STEPS).toHaveLength(10);
    TOUR_STEPS.forEach((s, i) => expect(s.step).toBe(i + 1));
  });
  it('đúng cặp id theo thứ tự chặng (không phân biệt hướng)', () => {
    SPEC.forEach(([a, b], i) => {
      const got = [TOUR_STEPS[i].smallId, TOUR_STEPS[i].largeId].sort();
      expect(got, `chặng ${i + 1}`).toEqual([a, b].sort());
    });
  });
  // Đặc tả tự mâu thuẫn ở hướng [nhỏ, lớn] (vd chặng 3 kwt lớn hơn nghe-an) nên chỉ kiểm hướng ở các chặng rõ ràng
  it('hướng [id1, id2] đúng đặc tả ở chặng 1, 2, 5, 6', () => {
    for (const i of [0, 1, 4, 5]) {
      expect([TOUR_STEPS[i].smallId, TOUR_STEPS[i].largeId], `chặng ${i + 1}`).toEqual(SPEC[i]);
    }
  });
  it('mỗi chặng có câu twist tiếng Việt không rỗng', () => {
    for (const s of TOUR_STEPS) expect(s.cau.trim().length).toBeGreaterThan(10);
  });
  it('headline tự tính từ meta cho mọi chặng', () => {
    for (const s of TOUR_STEPS) {
      const c = getTourComparison(s, byId)!;
      const a = byId.get(s.smallId).area, b = byId.get(s.largeId).area;
      const r = Math.max(a, b) / Math.min(a, b);
      if (Math.abs(r - 1) < 0.05) expect(c.headline).toBe('GẦN NHƯ BẰNG NHAU');
      else expect(c.headline).toMatch(/^GẤP [\d.,]+ LẦN$/);
      expect(c.sub).toContain(`${viInt(Math.max(a, b))} km²`);
      expect(c.sub).toContain(`${viInt(Math.min(a, b))} km²`);
    }
  });
  it('chặng 6 (Phần Lan – Việt Nam) ra "GẦN NHƯ BẰNG NHAU"', () => {
    const r = byId.get('fin').area / vn.area;
    expect(Math.abs(r - 1)).toBeLessThan(0.05);
    expect(getTourComparison(TOUR_STEPS[5], byId)!.headline).toBe('GẦN NHƯ BẰNG NHAU');
  });
  it('chặng 3 (Nghệ An – Kuwait, lệch ~4,8%) cũng theo quy tắc <5% → "GẦN NHƯ BẰNG NHAU"', () => {
    expect(getTourComparison(TOUR_STEPS[2], byId)!.headline).toBe('GẦN NHƯ BẰNG NHAU');
  });
});

describe('D2 parse ?hanh-trinh', () => {
  it('1..10 hợp lệ', () => {
    for (let n = 1; n <= 10; n++) expect(parseHanhTrinhUrl(`?hanh-trinh=${n}`)).toBe(n);
  });
  it('sai/ngoài dải → 1', () => {
    for (const v of ['0', '11', '-3', 'abc', '', '1.5x']) {
      expect(parseHanhTrinhUrl(`?hanh-trinh=${v}`), v).toBe(v === '1.5x' ? 1 : 1);
    }
  });
  it('không có tham số → null (không vào tour)', () => {
    expect(parseHanhTrinhUrl('')).toBeNull();
    expect(parseHanhTrinhUrl('?h=bel:0:0:0')).toBeNull();
  });
  it('lẫn với tham số khác vẫn đọc được', () => {
    expect(parseHanhTrinhUrl('?z=1&hanh-trinh=4')).toBe(4);
  });
});

describe('URL ?h= cũ vẫn decode như trước', () => {
  it('decode đúng id/x/y/góc và z', () => {
    const d = decodeUrlState('?h=lam-dong:0:0:0,bel:10:-20:45&z=0.5');
    expect(d.shapes.map((s) => s.id)).toEqual(['lam-dong', 'bel']);
    expect(d.shapes[1].x).toBe(10);
    expect(d.shapes[1].y).toBe(-20);
    expect(d.shapes[1].rotation ?? d.shapes[1].goc).toBe(45);
  });
  it('round-trip encode → decode', () => {
    const q = encodeUrlState([{ id: 'bel', x: 5, y: 6, rotation: 90 }]);
    const d = decodeUrlState(q);
    expect(d.shapes).toHaveLength(1);
    expect(d.shapes[0].id).toBe('bel');
    expect(d.shapes[0].x).toBe(5);
  });
  it('encode không sinh tham số hanh-trinh', () => {
    expect(encodeUrlState([{ id: 'bel', x: 0, y: 0, rotation: 0 }])).not.toContain('hanh-trinh');
  });
  it('id lạ bị bỏ qua, URL chỉ có ?hanh-trinh= thì không có hình', () => {
    expect(decodeUrlState('?h=zzz:0:0:0', (id) => byId.has(id)).shapes).toHaveLength(0);
    expect(decodeUrlState('?hanh-trinh=3').shapes).toHaveLength(0);
  });
});
