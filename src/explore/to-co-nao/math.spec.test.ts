// Test theo docs/to-co-nao-dac-ta.md (bước A) — viết độc lập với code
import { describe, it, expect } from 'vitest';
import {
  kmToScreen, screenToKm, fitView, getShapesBBox, formatComparison, formatNumberVi,
  scaleBar, encodeUrlState, decodeUrlState, pickRandomMatch, PRESET_MATCHES,
} from './math';

describe('viewport km ↔ px', () => {
  const vp = { cx: 120, cy: -40, scale: 0.37 };
  it('khứ hồi km → px → km', () => {
    for (const [x, y] of [[0, 0], [500, -300], [-1234.5, 99.9]]) {
      const k = screenToKm(kmToScreen({ x, y }, vp, 800, 600), vp, 800, 600);
      expect(k.x).toBeCloseTo(x, 6);
      expect(k.y).toBeCloseTo(y, 6);
    }
  });
  it('khứ hồi px → km → px', () => {
    const s = kmToScreen(screenToKm({ x: 123, y: 456 }, vp, 800, 600), vp, 800, 600);
    expect(s.x).toBeCloseTo(123, 6);
    expect(s.y).toBeCloseTo(456, 6);
  });
  it('tâm viewport giữa khung; scale là px/km', () => {
    const s = kmToScreen({ x: vp.cx, y: vp.cy }, vp, 800, 600);
    expect(s).toEqual({ x: 400, y: 300 });
    expect(kmToScreen({ x: vp.cx + 100, y: vp.cy }, vp, 800, 600).x - s.x).toBeCloseTo(37, 6);
  });
});

describe('fitView', () => {
  const bbox: [number, number, number, number] = [-100, -50, 100, 50];
  const shapes = [{ id: 'a', x: 0, y: 0, rotation: 0, bbox }];
  it('chứa đủ hình với padding 12%', () => {
    const vp = fitView(shapes, 800, 600);
    const tl = kmToScreen({ x: -100, y: -50 }, vp, 800, 600);
    const br = kmToScreen({ x: 100, y: 50 }, vp, 800, 600);
    expect(tl.x).toBeGreaterThanOrEqual(800 * 0.12 - 1e-6);
    expect(br.x).toBeLessThanOrEqual(800 * 0.88 + 1e-6);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.y).toBeLessThanOrEqual(600);
  });
  it('tâm viewport = tâm bao', () => {
    const vp = fitView([{ id: 'a', x: 300, y: -200, rotation: 0, bbox }], 800, 600);
    expect(vp.cx).toBeCloseTo(300, 6);
    expect(vp.cy).toBeCloseTo(-200, 6);
  });
  it('bbox xét xoay 90°: bao đổi trục', () => {
    const b = getShapesBBox([{ id: 'a', x: 0, y: 0, rotation: 90, bbox }])!;
    expect(b[2] - b[0]).toBeCloseTo(100, 6);
    expect(b[3] - b[1]).toBeCloseTo(200, 6);
  });
  it('thêm hình ở xa thì scale giảm', () => {
    const v2 = fitView([...shapes, { id: 'b', x: 2000, y: 0, rotation: 0, bbox }], 800, 600);
    expect(v2.scale).toBeLessThan(fitView(shapes, 800, 600).scale);
  });
});

describe('câu so sánh tiếng Việt', () => {
  it('0,8 lần', () => {
    expect(formatComparison('Lâm Đồng', 9800, 'Bỉ', 12250)).toBe('Lâm Đồng ≈ 0,8 lần Bỉ');
  });
  it('≥ 10 làm tròn nguyên', () => {
    expect(formatComparison('Việt Nam', 331000, 'Bỉ', 30600)).toBe('Việt Nam ≈ 11 lần Bỉ');
  });
  it('< 0,1 đảo chiều', () => {
    expect(formatComparison('Bỉ', 30000, 'Việt Nam', 360000)).toBe('Việt Nam ≈ 12 lần Bỉ');
  });
  it('đúng 0,1 không đảo chiều', () => {
    expect(formatComparison('A', 100, 'B', 1000)).toBe('A ≈ 0,1 lần B');
  });
  it('1 lần', () => {
    expect(formatComparison('A', 500, 'B', 500)).toBe('A ≈ 1 lần B');
  });
  it('đảo chiều với số lớn dùng dấu chấm nghìn', () => {
    expect(formatComparison('A', 1, 'B', 12345)).toBe('B ≈ 12.345 lần A');
  });
  it('formatNumberVi', () => {
    expect(formatNumberVi(1234567)).toBe('1.234.567');
    expect(formatNumberVi(0.8)).toBe('0,8');
    expect(formatNumberVi(1234.5)).toBe('1.234,5');
    expect(formatNumberVi(0)).toBe('0');
  });
});

describe('scaleBar', () => {
  it('dài 60–120 px, km dạng 1/2/5×10ⁿ trên nhiều mức zoom', () => {
    for (let e = -3; e <= 1.5; e += 0.07) {
      const scale = Math.pow(10, e);
      const sb = scaleBar(scale);
      // Với bậc 1/2/5 (2→5 gấp 2,5 lần) cửa sổ 60–120 px (gấp 2 lần) không phải scale nào cũng có nấc hợp lệ:
      // chỉ yêu cầu nằm trong 60–120 khi tồn tại nấc như vậy.
      const feasible = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].some((p) =>
        [1, 2, 5].some((m) => {
          const px = m * Math.pow(10, p) * scale;
          return px >= 60 && px <= 120;
        }),
      );
      if (feasible) {
        expect(sb.px).toBeGreaterThanOrEqual(60 - 1e-6);
        expect(sb.px).toBeLessThanOrEqual(120 + 1e-6);
      }
      expect(sb.px).toBeCloseTo(sb.km * scale, 6);
      const mant = sb.km / Math.pow(10, Math.floor(Math.log10(sb.km) + 1e-9));
      expect([1, 2, 5]).toContain(Math.round(mant * 1e6) / 1e6);
    }
  });
  it('nhãn kết thúc "km" và dùng dấu chấm nghìn', () => {
    expect(scaleBar(0.1).label).toMatch(/km$/);
    expect(scaleBar(0.01).label).toContain('.');
  });
});

describe('URL state', () => {
  it('khứ hồi encode → decode', () => {
    const q = encodeUrlState(
      [
        { id: 'lam-dong', x: 12.4, y: -7.6, rotation: 15 },
        { id: 'bel', x: 300, y: 0, rotation: 0 },
      ],
      1,
    );
    const d = decodeUrlState('?' + q);
    expect(d.shapes.map((s) => s.id)).toEqual(['lam-dong', 'bel']);
    expect(d.shapes[0].x).toBe(12);
    expect(d.shapes[0].y).toBe(-8);
    expect(d.shapes[0].rotation).toBe(15);
  });
  it('định dạng h=id:x:y:goc', () => {
    const q = decodeURIComponent(encodeUrlState([{ id: 'bel', x: 1, y: 2, rotation: 3 }]));
    expect(q).toContain('h=bel:1:2:3');
  });
  it('id lạ bị bỏ qua', () => {
    const d = decodeUrlState('?h=bel:0:0:0,zzz:1:1:1', new Set(['bel']));
    expect(d.shapes.map((s) => s.id)).toEqual(['bel']);
  });
  it('số rác bị bỏ qua, không ném lỗi', () => {
    const d = decodeUrlState('?h=bel:abc:0:0,lam-dong:5:6:7,bel:1:NaN:0');
    expect(d.shapes.map((s) => s.id)).toEqual(['lam-dong']);
  });
  it('query rỗng / không có h', () => {
    expect(decodeUrlState('').shapes).toEqual([]);
    expect(decodeUrlState('?z=2').shapes).toEqual([]);
  });
  it('Infinity là số rác', () => {
    expect(decodeUrlState('?h=bel:Infinity:0:0').shapes).toEqual([]);
  });
});

describe('kèo', () => {
  it('6 kèo kinh điển, kèo đầu là Lâm Đồng vs Bỉ', () => {
    expect(PRESET_MATCHES).toHaveLength(6);
    expect(PRESET_MATCHES[0].shapes).toEqual(['lam-dong', 'bel']);
    expect(PRESET_MATCHES.map((m) => m.title)).toEqual([
      'Lâm Đồng vs Bỉ', 'Việt Nam vs Nhật Bản', 'TP.HCM vs Singapore',
      'Hà Nội vs Luxembourg', 'Việt Nam vs Ý', 'Nghệ An vs Slovenia',
    ]);
  });
  it('ngẫu nhiên: luôn 1 tỉnh × 1 nước chênh ≤ 3 lần', () => {
    const all = [
      { id: 'p1', name: 'P1', area: 10000, type: 'tinh' },
      { id: 'p2', name: 'P2', area: 500, type: 'tinh' },
      { id: 'c1', name: 'C1', area: 25000, type: 'nuoc' },
      { id: 'c2', name: 'C2', area: 31000, type: 'nuoc' },
      { id: 'c3', name: 'C3', area: 3000000, type: 'nuoc' },
      { id: 'c4', name: 'C4', area: 400, type: 'nuoc' },
    ];
    for (let i = 0; i < 200; i++) {
      const m = pickRandomMatch(all)!;
      expect(m[0].type).toBe('tinh');
      expect(m[1].type).toBe('nuoc');
      const r = Math.max(m[0].area, m[1].area) / Math.min(m[0].area, m[1].area);
      expect(r).toBeLessThanOrEqual(3);
    }
  });
  it('biên 3 lần chấp nhận; hơn 3 lần thì null', () => {
    expect(
      pickRandomMatch([
        { id: 'p', name: 'P', area: 1000, type: 'tinh' },
        { id: 'c', name: 'C', area: 3000, type: 'nuoc' },
      ]),
    ).not.toBeNull();
    expect(
      pickRandomMatch([
        { id: 'p', name: 'P', area: 1000, type: 'tinh' },
        { id: 'c', name: 'C', area: 3001, type: 'nuoc' },
      ]),
    ).toBeNull();
  });
});
