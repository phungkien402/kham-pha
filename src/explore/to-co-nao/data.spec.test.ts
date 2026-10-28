// Kiểm dữ liệu đã sinh theo đặc tả. Dữ liệu hiện chỉ là khung tối thiểu thì phần đầy đủ được bỏ qua (skip).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = path.resolve(__dirname, 'data');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const gz = (f: string) => zlib.gzipSync(fs.readFileSync(path.join(dir, f))).length;
const meta: any[] = read('meta.json');
const full =
  meta.filter((m) => m.type === 'tinh').length >= 34 && meta.filter((m) => m.type === 'nuoc').length > 190;

describe('dữ liệu: luôn kiểm', () => {
  it('default.json có lam-dong, bel, viet-nam và đều có trong meta', () => {
    const d = read('default.json');
    for (const id of ['lam-dong', 'bel', 'viet-nam']) {
      expect(d[id], id).toBeTypeOf('string');
      expect(meta.find((m) => m.id === id), id).toBeTruthy();
    }
  });
  it('meta: id duy nhất, area > 0, len ≥ wid', () => {
    expect(new Set(meta.map((m) => m.id)).size).toBe(meta.length);
    for (const m of meta) {
      expect(m.area).toBeGreaterThan(0);
      expect(m.len).toBeGreaterThanOrEqual(m.wid);
    }
  });
  it('sources.json ghi nguồn Natural Earth và Free-GIS-Data', () => {
    const s = JSON.stringify(read('sources.json'));
    expect(s).toContain('Natural Earth');
    expect(s).toContain('Free-GIS-Data');
  });
  it('chỉ một viet-nam, không có entity "vnm" của Natural Earth', () => {
    expect(meta.filter((m) => m.id === 'viet-nam')).toHaveLength(1);
    expect(meta.find((m) => m.id === 'vnm')).toBeUndefined();
  });
});

describe.skipIf(!full)('dữ liệu đầy đủ', () => {
  it('34 tỉnh + viet-nam + > 190 nước', () => {
    expect(meta.filter((m) => m.type === 'tinh')).toHaveLength(34);
    expect(meta.filter((m) => m.type === 'vn')).toHaveLength(1);
    expect(meta.filter((m) => m.type === 'nuoc').length).toBeGreaterThan(190);
  });
  it('tổng diện tích 34 tỉnh ≈ Việt Nam (±3%)', () => {
    const sum = meta.filter((m) => m.type === 'tinh').reduce((a, m) => a + m.area, 0);
    const vn = meta.find((m) => m.id === 'viet-nam').area;
    expect(Math.abs(sum - vn) / vn).toBeLessThan(0.03);
  });
  it('giữ Monaco và Vatican', () => {
    expect(meta.find((m) => m.id === 'mco')).toBeTruthy();
    expect(meta.find((m) => m.id === 'vat')).toBeTruthy();
  });
  it('dung lượng gzip trong ngưỡng', () => {
    expect(gz('meta.json')).toBeLessThanOrEqual(25 * 1024);
    expect(gz('default.json')).toBeLessThanOrEqual(15 * 1024);
    expect(gz('vn.json')).toBeLessThanOrEqual(70 * 1024);
    for (const f of ['nuoc-pho-bien.json', 'nuoc-khac.json']) expect(gz(f)).toBeLessThanOrEqual(120 * 1024);
  });
  it('Việt Nam có nhiều mảnh (đảo Hoàng Sa, Trường Sa)', () => {
    const d = read('default.json')['viet-nam'] as string;
    expect((d.match(/M/g) || []).length).toBeGreaterThan(5);
  });
});
