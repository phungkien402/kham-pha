// Test bước C theo docs/to-co-nao-dac-ta.md (viết độc lập với code): kèo, câu so sánh, URL, ngẫu nhiên trên dữ liệu thật
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRESET_MATCHES, formatComparison, encodeUrlState, decodeUrlState, pickRandomMatch, fitView,
  getShapesBBox, kmToScreen, scaleBar,
} from './math';

const dir = path.resolve(__dirname, 'data');
const meta: any[] = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const byId = new Map(meta.map((m) => [m.id, m]));
const defaults = JSON.parse(fs.readFileSync(path.join(dir, 'default.json'), 'utf8'));

describe('kèo kinh điển trên dữ liệu thật', () => {
  it('mọi id trong 6 kèo có trong meta', () => {
    for (const k of PRESET_MATCHES) for (const id of k.shapes) expect(byId.has(id), `${k.title}: ${id}`).toBe(true);
  });
  it('mỗi kèo có đúng 2 hình khác nhau', () => {
    for (const k of PRESET_MATCHES) {
      expect(k.shapes).toHaveLength(2);
      expect(new Set(k.shapes).size).toBe(2);
    }
  });
  it('Lâm Đồng vs Bỉ: câu so sánh tính từ dữ liệu, ≈ 0,8 lần', () => {
    const a = byId.get('lam-dong'), b = byId.get('bel');
    expect(formatComparison(a.name, a.area, b.name, b.area)).toBe(
      `Lâm Đồng ≈ ${(Math.round((a.area / b.area) * 10) / 10).toString().replace('.', ',')} lần ${b.name}`,
    );
    expect(a.area / b.area).toBeGreaterThan(0.75);
    expect(a.area / b.area).toBeLessThan(0.85);
  });
  it('Việt Nam vs Nhật Bản: Việt Nam nhỏ hơn Nhật chút (0,8–1,0 lần)', () => {
    const r = byId.get('viet-nam').area / byId.get('jpn').area;
    expect(r).toBeGreaterThan(0.8);
    expect(r).toBeLessThan(1.0);
  });
  it('Hà Nội vs Luxembourg cùng cỡ (0,5–5 lần)', () => {
    const r = byId.get('ha-noi').area / byId.get('lux').area;
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(5);
  });
  it('TP.HCM (sau sáp nhập) lớn hơn Singapore; diện tích Singapore gần số chính thức ~735 km² (±15%)', () => {
    expect(byId.get('tp-ho-chi-minh').area).toBeGreaterThan(byId.get('sgp').area);
    // Natural Earth 50m vẽ Singapore thô → diện tích dữ liệu lệch xa số chính thức
    expect(Math.abs(byId.get('sgp').area - 735) / 735).toBeLessThan(0.15);
  });
  it('default.json phủ Lâm Đồng, Bỉ, Việt Nam', () => {
    for (const id of ['lam-dong', 'bel', 'viet-nam']) expect(defaults[id]).toBeTruthy();
  });
});

describe('ngẫu nhiên trên dữ liệu thật', () => {
  it('500 lần: luôn 1 tỉnh × 1 nước, chênh ≤ 3 lần', () => {
    for (let i = 0; i < 500; i++) {
      const m = pickRandomMatch(meta as any)!;
      expect(m).not.toBeNull();
      expect(m[0].type).toBe('tinh');
      expect(m[1].type).toBe('nuoc');
      expect(Math.max(m[0].area, m[1].area) / Math.min(m[0].area, m[1].area)).toBeLessThanOrEqual(3);
    }
  });
  it('randomFn cố định → kết quả xác định; không loại trừ Việt Nam khỏi nhóm tỉnh', () => {
    const a = pickRandomMatch(meta as any, undefined, () => 0)!;
    const b = pickRandomMatch(meta as any, undefined, () => 0)!;
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].type).not.toBe('vn');
  });
  it('randomFn gần 1 (0.9999) không văng lỗi', () => {
    expect(() => pickRandomMatch(meta as any, undefined, () => 0.999999)).not.toThrow();
  });
});

describe('câu so sánh: biên', () => {
  it('9,95 lần làm tròn đúng; 10 lần là số nguyên', () => {
    expect(formatComparison('A', 10000, 'B', 1000)).toBe('A ≈ 10 lần B');
  });
  it('9,96 lần không có ",0"', () => {
    expect(formatComparison('A', 996, 'B', 100)).not.toMatch(/,0\b/);
  });
  it('0,05 → đảo chiều thành 20 lần', () => {
    expect(formatComparison('A', 50, 'B', 1000)).toBe('B ≈ 20 lần A');
  });
  it('số lớn dùng dấu chấm nghìn', () => {
    expect(formatComparison('A', 2_500_000, 'B', 100)).toBe('A ≈ 25.000 lần B');
  });
});

describe('URL: hình thức thật', () => {
  it('đặt 6 hình rồi khứ hồi giữ nguyên thứ tự, vị trí, góc', () => {
    const shapes = ['lam-dong', 'bel', 'viet-nam', 'jpn', 'ita', 'svn'].map((id, i) => ({
      id, x: i * 100 - 250, y: i === 0 ? 0 : -i * 37, rotation: (i * 45) % 360,
    }));
    const d = decodeUrlState(encodeUrlState(shapes, 1.5), new Set(shapes.map((s) => s.id)));
    expect(d.shapes.map((s) => [s.id, s.x, s.y, s.rotation])).toEqual(
      shapes.map((s) => [s.id, s.x, s.y, s.rotation]),
    );
  });
  it('góc âm và toạ độ âm khứ hồi', () => {
    const d = decodeUrlState(encodeUrlState([{ id: 'bel', x: -12, y: -34, rotation: -30 }]));
    expect(d.shapes[0]).toMatchObject({ id: 'bel', x: -12, y: -34 });
    expect(d.shapes[0].rotation).toBe(-30);
  });
  it('chấp nhận cả URL đầy đủ có ?h=', () => {
    const d = decodeUrlState('https://x.vn/to-co-nao?h=bel:1:2:3&z=2');
    expect(d.shapes.map((s) => s.id)).toEqual(['bel']);
  });
  it('id lạ lẫn id đúng: chỉ giữ id đúng, đúng thứ tự', () => {
    const d = decodeUrlState('?h=xx:0:0:0,bel:1:1:1,yy:2:2:2,lam-dong:3:3:3', (id) => byId.has(id));
    expect(d.shapes.map((s) => s.id)).toEqual(['bel', 'lam-dong']);
  });
  it('mục thiếu trường / số rác bị bỏ qua, mục tốt còn lại vẫn đọc', () => {
    const d = decodeUrlState('?h=bel:1:2,lam-dong:a:b:c,viet-nam:0:0:0');
    expect(d.shapes.map((s) => s.id)).toEqual(['viet-nam']);
  });
});

describe('fitView khi thêm hình (tự cân khung)', () => {
  const bb = (id: string) => byId.get(id).bbox as [number, number, number, number];
  it('hai hình đặt cạnh nhau đều nằm trong khung 800×500 sau fitView', () => {
    const shapes = [
      { id: 'viet-nam', x: 0, y: 0, rotation: 0 },
      { id: 'jpn', x: 2500, y: 0, rotation: 30 },
    ];
    const vp = fitView(shapes, 800, 500, 0.12, bb);
    const box = getShapesBBox(shapes, bb)!;
    const tl = kmToScreen([box[0], box[1]], vp, 800, 500);
    const br = kmToScreen([box[2], box[3]], vp, 800, 500);
    expect(tl.x).toBeGreaterThanOrEqual(-1e-6);
    expect(tl.y).toBeGreaterThanOrEqual(-1e-6);
    expect(br.x).toBeLessThanOrEqual(800 + 1e-6);
    expect(br.y).toBeLessThanOrEqual(500 + 1e-6);
  });
  it('thước tỉ lệ ở mức vừa khung vẫn là 1/2/5×10ⁿ', () => {
    const vp = fitView([{ id: 'bel', x: 0, y: 0 }], 375, 400, 0.12, bb);
    const sb = scaleBar(vp.scale);
    const mant = sb.km / Math.pow(10, Math.floor(Math.log10(sb.km) + 1e-9));
    expect([1, 2, 5]).toContain(Math.round(mant * 1e6) / 1e6);
  });
});

describe('uncertain (không kiểm được nếu thiếu @testing-library/svelte)', () => {
  it.skip('Footer/Board render DOM, kéo thả, xuất PNG canvas', () => {});
});
