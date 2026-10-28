// Test theo docs/to-co-nao-dac-ta.md (bước A) — viết độc lập với code
import { describe, it, expect } from 'vitest';
import { R, slugify, calcArea, project, pca, scsFilter, centroid } from './size-data-lib.mjs';

const square = (lng: number, lat: number, d = 1) => ({
  type: 'Polygon',
  coordinates: [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]],
});
const fc = (iso: string, polys: any[]) => ({
  type: 'Feature',
  properties: { ISO_A3: iso },
  geometry: { type: 'MultiPolygon', coordinates: polys },
});

describe('spec: hằng số & diện tích', () => {
  it('R = 6371.0088', () => expect(R).toBe(6371.0088));
  it('1°×1° ở xích đạo ≈ 12.364 km² (±1%)', () => {
    const a = calcArea(square(-0.5, -0.5));
    expect(Math.abs(a - 12364) / 12364).toBeLessThan(0.01);
  });
  it('diện tích trước/sau chiếu khớp ±1% (hình ở vĩ độ ~15°)', () => {
    const g = square(108, 14, 2);
    const a = calcArea(g);
    const p = project(g);
    expect(Math.abs(p.planarArea - a) / a).toBeLessThan(0.01);
  });
  it('chiếu: phía bắc có y âm (y dương xuống như SVG), tâm quanh (0,0)', () => {
    const p = project(square(100, 10, 2), [101, 11]);
    const [minX, minY, maxX, maxY] = p.bbox;
    expect(minX).toBeLessThan(0);
    expect(maxX).toBeGreaterThan(0);
    expect(minY).toBeLessThan(0);
    expect(maxY).toBeGreaterThan(0);
    expect(Math.abs(minY)).toBeGreaterThan(100);
    expect(Math.abs(minY)).toBeLessThan(125);
  });
  it('centroid của hình vuông đối xứng ở giữa', () => {
    const [lng, lat] = centroid(square(10, 20, 2));
    expect(lng).toBeCloseTo(11, 1);
    expect(lat).toBeCloseTo(21, 1);
  });
});

describe('spec: lọc Biển Đông', () => {
  const small = (lng: number, lat: number) => square(lng, lat, 0.1).coordinates;
  const bigOutside = square(120, 20, 5).coordinates;
  it('đảo nhỏ của nước khác trong vùng bị xoá', () => {
    for (const iso of ['CHN', 'TWN', 'PHL', 'MYS', 'BRN']) {
      const out: any = scsFilter(fc(iso, [small(112, 16), small(114, 10)]));
      expect(out.geometry.coordinates.length, iso).toBe(0);
    }
  });
  it('đảo lớn ngoài vùng được giữ, đảo nhỏ trong vùng bị xoá', () => {
    const out: any = scsFilter(fc('PHL', [small(112, 16), bigOutside]));
    expect(out.geometry.coordinates.length).toBe(1);
    expect(out.geometry.coordinates[0]).toEqual(bigOutside);
  });
  it('đảo nhỏ ngoài vùng (lat 30) được giữ', () => {
    const out: any = scsFilter(fc('CHN', [small(112, 30)]));
    expect(out.geometry.coordinates.length).toBe(1);
  });
  it('polygon trong vùng nhưng ≥ 2.000 km² được giữ', () => {
    const bigger = square(109.5, 17, 1.2).coordinates; // ~17.800 km²
    const out: any = scsFilter(fc('CHN', [bigger]));
    expect(out.geometry.coordinates.length).toBe(1);
  });
  it('Việt Nam không bị lọc: giữ Hoàng Sa/Trường Sa', () => {
    const out: any = scsFilter(fc('VNM', [small(112, 16.5), small(114, 10)]), { isVietnam: true });
    expect(out.geometry.coordinates.length).toBe(2);
  });
});

describe('spec: slugify', () => {
  it('không dấu, nối gạch ngang, chữ thường', () => {
    expect(slugify('Đồng Tháp')).toBe('dong-thap');
    expect(slugify('Hồ Chí Minh')).toBe('ho-chi-minh');
    expect(slugify('Việt Nam')).toBe('viet-nam');
    expect(slugify('Kon Tum')).toBe('kon-tum');
  });
  it('kết quả chỉ gồm [a-z0-9-]', () => {
    for (const s of ['Thừa Thiên Huế', 'Bà Rịa – Vũng Tàu', 'Đắk Nông']) {
      expect(slugify(s)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe('spec: PCA dài/rộng', () => {
  it('chữ nhật 200×50 ngang: len≈200, wid≈50', () => {
    const r = pca([[-100, -25], [100, -25], [100, 25], [-100, 25]]);
    expect(r.len).toBeCloseTo(200, 0);
    expect(r.wid).toBeCloseTo(50, 0);
  });
  it('chữ nhật dọc 50×200: len vẫn 200', () => {
    const r = pca([[-25, -100], [25, -100], [25, 100], [-25, 100]]);
    expect(r.len).toBeCloseTo(200, 0);
    expect(r.wid).toBeCloseTo(50, 0);
  });
  it('chữ nhật xoay 45° vẫn len≈200, wid≈50', () => {
    const t = Math.PI / 4;
    const pts = [[-100, -25], [100, -25], [100, 25], [-100, 25]].map(([x, y]) => [
      x * Math.cos(t) - y * Math.sin(t),
      x * Math.sin(t) + y * Math.cos(t),
    ]);
    const r = pca(pts);
    expect(r.len).toBeGreaterThan(190);
    expect(r.len).toBeLessThan(215);
    expect(r.wid).toBeGreaterThan(45);
    expect(r.wid).toBeLessThan(60);
  });
  it('len ≥ wid', () => {
    const r = pca([[0, 0], [10, 3], [4, 9], [-5, 2]]);
    expect(r.len).toBeGreaterThanOrEqual(r.wid);
  });
});
