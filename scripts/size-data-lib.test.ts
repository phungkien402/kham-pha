// scripts/size-data-lib.test.ts
import { describe, it, expect } from 'vitest';
import {
  R,
  slugify,
  centroid,
  calcArea,
  planarPolygonArea,
  project,
  pca,
  isSCSPolygon,
  scsFilter,
  fixProvinceName,
  toSvgPath,
} from './size-data-lib.mjs';

describe('size-data-lib', () => {
  describe('slugify', () => {
    it('chuyển đổi đúng tiếng Việt có dấu sang slug không dấu', () => {
      expect(slugify('Lâm Đồng')).toBe('lam-dong');
      expect(slugify('Đà Nẵng')).toBe('da-nang');
      expect(slugify('TP. Hồ Chí Minh')).toBe('tp-ho-chi-minh');
      expect(slugify('Bà Rịa - Vũng Tàu')).toBe('ba-ria-vung-tau');
      expect(slugify('Đắk Lắk')).toBe('dak-lak');
      expect(slugify('Thừa Thiên Huế')).toBe('thua-thien-hue');
    });

    it('xử lý chuỗi rỗng và ký tự đặc biệt', () => {
      expect(slugify('')).toBe('');
      expect(slugify('---hello---world---')).toBe('hello-world');
      expect(slugify('Việt  Nam   2026')).toBe('viet-nam-2026');
    });
  });

  describe('chiếu và diện tích (LAEA)', () => {
    it('hình vuông 1°×1° ở xích đạo có diện tích ≈ 12.364 km²', () => {
      // 1° kinh độ x 1° vĩ độ ở xích đạo: [-0.5, -0.5] đến [0.5, 0.5]
      const squareGeo = {
        type: 'Polygon',
        coordinates: [
          [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
            [-0.5, -0.5],
          ],
        ],
      };

      const areaKm2 = calcArea(squareGeo);
      // Kỳ vọng ≈ 12.364 km² (lệch không quá 1 km²)
      expect(Math.abs(areaKm2 - 12364)).toBeLessThan(1);
    });

    it('diện tích trước và sau phép chiếu LAEA khớp nhau trong phạm vi ±1%', () => {
      const squareGeo = {
        type: 'Polygon',
        coordinates: [
          [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
            [-0.5, -0.5],
          ],
        ],
      };

      const sphericalArea = calcArea(squareGeo);
      const projResult = project(squareGeo, [0, 0]);
      const planarArea = projResult.planarArea;

      // Sai số giữa diện tích mặt cầu và diện tích phẳng sau chiếu LAEA
      const diffPercent = Math.abs(planarArea - sphericalArea) / sphericalArea;
      expect(diffPercent).toBeLessThan(0.01); // Dưới 1%
    });

    it('tính đúng centroid của hình', () => {
      const poly = {
        type: 'Polygon',
        coordinates: [
          [
            [10, 10],
            [20, 10],
            [20, 20],
            [10, 20],
            [10, 10],
          ],
        ],
      };
      const c = centroid(poly);
      expect(c[0]).toBeCloseTo(15, 0);
      expect(c[1]).toBeCloseTo(15, 0);
    });
  });

  describe('PCA (Principal Component Analysis)', () => {
    it('tìm đúng chiều dài, chiều rộng và góc xoay của hình chữ nhật', () => {
      // Hình chữ nhật dài 100km (từ x = -50 đến 50), rộng 20km (từ y = -10 đến 10)
      const rectPoints = [
        [-50, -10],
        [50, -10],
        [50, 10],
        [-50, 10],
      ];
      const result = pca(rectPoints);
      expect(result.len).toBeCloseTo(100, -1);
      expect(result.wid).toBeCloseTo(20, -1);
      expect(result.angle).toBeCloseTo(0, 0);
    });

    it('len luôn lớn hơn hoặc bằng wid', () => {
      const points = [
        [0, -40],
        [0, 40],
        [-5, 0],
        [5, 0],
      ];
      const res = pca(points);
      expect(res.len).toBeGreaterThanOrEqual(res.wid);
    });
  });

  describe('Bộ lọc Biển Đông (scsFilter)', () => {
    it('xoá đảo nhỏ của nước khác có tâm trong lng 109–119, lat 6–18 và diện tích < 2.000 km²', () => {
      // Đảo nhỏ của nước ngoài tại lng 114, lat 10 (trong Biển Đông), kích thước 0.1° x 0.1° (~120 km²)
      const foreignSmallIsland = {
        type: 'Feature',
        properties: { ISO_A3: 'PHL', ADMIN: 'Philippines' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [113.95, 9.95],
              [114.05, 9.95],
              [114.05, 10.05],
              [113.95, 10.05],
              [113.95, 9.95],
            ],
          ],
        },
      };

      const filtered = scsFilter(foreignSmallIsland, false);
      expect(filtered.geometry.coordinates).toEqual([]);
      expect(filtered._deletedPolygons.length).toBe(1);
    });

    it('giữ lại đảo lớn (diện tích >= 2.000 km²) của nước ngoài', () => {
      // Đảo lớn (ví dụ kích thước 3° x 3° ~ 100.000 km² như đảo Hải Nam)
      const foreignBigIsland = {
        type: 'Feature',
        properties: { ISO_A3: 'CHN', ADMIN: 'China' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [108.5, 18.0],
              [111.0, 18.0],
              [111.0, 20.0],
              [108.5, 20.0],
              [108.5, 18.0],
            ],
          ],
        },
      };

      const filtered = scsFilter(foreignBigIsland, false);
      expect(filtered.geometry.coordinates.length).toBeGreaterThan(0);
      expect(filtered._deletedPolygons).toBeUndefined();
    });

    it('giữ lại đảo nhỏ nằm ngoài vùng toạ độ Biển Đông', () => {
      // Đảo nhỏ ngoài vùng (ví dụ lng 125, lat 10)
      const foreignOutsideIsland = {
        type: 'Feature',
        properties: { ISO_A3: 'PHL', ADMIN: 'Philippines' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [124.95, 9.95],
              [125.05, 9.95],
              [125.05, 10.05],
              [124.95, 10.05],
              [124.95, 9.95],
            ],
          ],
        },
      };

      const filtered = scsFilter(foreignOutsideIsland, false);
      expect(filtered.geometry.coordinates.length).toBeGreaterThan(0);
    });

    it('bảo toàn 100% đảo của Việt Nam trong vùng Biển Đông', () => {
      // Đảo của Việt Nam tại Hoàng Sa/Trường Sa
      const vnIsland = {
        type: 'Feature',
        properties: { ISO_A3: 'VNM', ADMIN: 'Vietnam', id: 'viet-nam' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [111.95, 16.45],
              [112.05, 16.45],
              [112.05, 16.55],
              [111.95, 16.55],
              [111.95, 16.45],
            ],
          ],
        },
      };

      const filtered = scsFilter(vnIsland, true);
      expect(filtered.geometry.coordinates.length).toBeGreaterThan(0);
      expect(filtered._deletedPolygons).toBeUndefined();
    });
  });

  describe('fixProvinceName (Đồng Tháp / Lạng Sơn)', () => {
    it('sửa đúng tên Lạng Sơn thành Đồng Tháp khi vĩ độ < 15', () => {
      const featureDongThap = {
        properties: { TinhThanh: 'Lạng Sơn' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[105.5, 10.5], [106.0, 10.5], [105.5, 10.5]]],
        },
      };
      expect(fixProvinceName(featureDongThap)).toBe('Đồng Tháp');
    });

    it('giữ nguyên tên Lạng Sơn khi vĩ độ > 15 (miền Bắc)', () => {
      const featureLangSon = {
        properties: { TinhThanh: 'Lạng Sơn' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[106.5, 21.8], [107.0, 21.8], [106.5, 21.8]]],
        },
      };
      expect(fixProvinceName(featureLangSon)).toBe('Lạng Sơn');
    });
  });

  describe('toSvgPath', () => {
    it('làm tròn 0.5 km cho hình có diện tích > 5.000 km²', () => {
      const coords = [
        [
          [10.26, 20.74],
          [30.12, 40.89],
          [10.26, 20.74],
        ],
      ];
      const path = toSvgPath(coords, 6000);
      expect(path).toContain('M10.5 20.5L30 41L10.5 20.5Z');
    });

    it('làm tròn 0.1 km cho hình có diện tích <= 5.000 km²', () => {
      const coords = [
        [
          [10.24, 20.76],
          [30.18, 40.82],
          [10.24, 20.76],
        ],
      ];
      const path = toSvgPath(coords, 3000);
      expect(path).toContain('M10.2 20.8L30.2 40.8L10.2 20.8Z');
    });
  });
});
