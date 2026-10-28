// src/explore/to-co-nao/math.test.ts
import { describe, it, expect } from 'vitest';
import {
  kmToScreen,
  screenToKm,
  rotatePoint,
  getRotatedBBox,
  getShapesBBox,
  fitView,
  formatNumberVi,
  calcRatio,
  ratio,
  formatComparison,
  scaleBar,
  encodeUrlState,
  decodeUrlState,
  pickRandomMatch,
  PRESET_MATCHES,
} from './math';
import { getTenNuoc, isPopularCountry, TEN_NUOC_GHI_DE } from './ten-nuoc';
import {
  meta,
  metaMap,
  getShapeSync,
  searchEntities,
  loadChunk,
  getShape,
} from './dataLoader';

describe('math.ts - Module toán toạ độ và so sánh', () => {
  describe('toạ độ km ↔ màn hình (viewport khứ hồi)', () => {
    it('chuyển đổi khứ hồi km -> px -> km trả về đúng toạ độ ban đầu', () => {
      const viewport = { cx: 25.5, cy: -50.2, scale: 1.85 };
      const w = 1000;
      const h = 800;

      const originalKm = { x: 120.4, y: -85.6 };
      const screenPt = kmToScreen(originalKm, viewport, w, h);
      const restoredKm = screenToKm(screenPt, viewport, w, h);

      expect(restoredKm.x).toBeCloseTo(originalKm.x, 5);
      expect(restoredKm.y).toBeCloseTo(originalKm.y, 5);
    });

    it('chuyển đổi khứ hồi px -> km -> px trả về đúng toạ độ màn hình', () => {
      const viewport = { cx: 0, cy: 0, scale: 2.5 };
      const w = 375;
      const h = 667;

      const originalPx = { x: 250, y: 400 };
      const kmPt = screenToKm(originalPx, viewport, w, h);
      const restoredPx = kmToScreen(kmPt, viewport, w, h);

      expect(restoredPx.x).toBeCloseTo(originalPx.x, 5);
      expect(restoredPx.y).toBeCloseTo(originalPx.y, 5);
    });
  });

  describe('bounding box và xoay hình (getRotatedBBox)', () => {
    it('xoay hình 90 độ hoán đổi chiều kích thước bbox', () => {
      // Hộp bao hình chữ nhật: x từ -50 đến 50 (dài 100), y từ -10 đến 10 (rộng 20)
      const bbox: [number, number, number, number] = [-50, -10, 50, 10];
      const rotated = getRotatedBBox(bbox, 0, 0, 90);

      // Sau khi xoay 90 độ, x nằm trong khoảng [-10, 10], y nằm trong khoảng [-50, 50]
      expect(rotated[0]).toBeCloseTo(-10, 1);
      expect(rotated[1]).toBeCloseTo(-50, 1);
      expect(rotated[2]).toBeCloseTo(10, 1);
      expect(rotated[3]).toBeCloseTo(50, 1);
    });

    it('tính đúng collective bbox của nhiều hình', () => {
      const shapes = [
        { id: 'a', x: 0, y: 0, bbox: [-10, -10, 10, 10] as [number, number, number, number] },
        { id: 'b', x: 100, y: 50, bbox: [-20, -20, 20, 20] as [number, number, number, number] },
      ];
      const collective = getShapesBBox(shapes);
      expect(collective).toEqual([-10, -10, 120, 70]);
    });
  });

  describe('fitView (tự cân khung với padding 12%)', () => {
    it('cân khung hợp lý theo chiều rộng và chiều cao màn hình', () => {
      const shapes = [
        { id: 'a', x: 0, y: 0, bbox: [-100, -50, 100, 50] as [number, number, number, number] },
      ];
      const w = 1000;
      const h = 500;
      const padding = 0.12;

      const vp = fitView(shapes, w, h, padding);
      expect(vp.cx).toBe(0);
      expect(vp.cy).toBe(0);

      // Usable width = 1000 * (1 - 0.24) = 760px; shape width = 200km -> scale <= 3.8
      // Usable height = 500 * (1 - 0.24) = 380px; shape height = 100km -> scale <= 3.8
      expect(vp.scale).toBeCloseTo(3.8, 1);
    });

    it('trả về viewport mặc định khi không có hình nào', () => {
      const vp = fitView([], 800, 600);
      expect(vp.cx).toBe(0);
      expect(vp.cy).toBe(0);
      expect(vp.scale).toBe(1);
    });
  });

  describe('định dạng số kiểu Việt (formatNumberVi)', () => {
    it('dùng dấu chấm cho hàng nghìn và dấu phẩy cho số thập phân', () => {
      expect(formatNumberVi(12345)).toBe('12.345');
      expect(formatNumberVi(1234567)).toBe('1.234.567');
      expect(formatNumberVi(0.8, 1)).toBe('0,8');
      expect(formatNumberVi(1.6, 1)).toBe('1,6');
      expect(formatNumberVi(1234.5, 1)).toBe('1.234,5');
      expect(formatNumberVi(0)).toBe('0');
      expect(formatNumberVi(-5000)).toBe('-5.000');
    });
  });

  describe('ratio và câu so sánh tiếng Việt', () => {
    it('tính đúng tỉ lệ ratio(a, b)', () => {
      expect(ratio(100, 50)).toBe(2);
      expect(calcRatio(10, 20)).toBe(0.5);
      expect(ratio(10, 0)).toBe(0);
    });

    it('so sánh bình thường: 1 chữ số thập phân khi 0,1 <= r < 10', () => {
      // Lâm Đồng (10.373) vs Bỉ (30.688) -> tỉ lệ ~ 0.338 -> "0,3 lần"
      const text = formatComparison('Lâm Đồng', 10373, 'Bỉ', 30688);
      expect(text).toBe('Lâm Đồng ≈ 0,3 lần Bỉ');
    });

    it('làm tròn số nguyên khi tỉ lệ r >= 10', () => {
      // Việt Nam (331.212) vs Bỉ (30.688) -> tỉ lệ ~ 10.79 -> 11 lần
      const text = formatComparison('Việt Nam', 331212, 'Bỉ', 30688);
      expect(text).toBe('Việt Nam ≈ 11 lần Bỉ');
    });

    it('đảo chiều câu so sánh khi tỉ lệ r < 0,1', () => {
      // Lâm Đồng (10.373) vs Nga (17.098.246) -> r < 0.1 -> đảo chiều: Nga ≈ 1.648 lần Lâm Đồng
      const text = formatComparison('Lâm Đồng', 10373, 'Nga', 17098246);
      expect(text).toContain('Nga ≈');
      expect(text).toContain('lần Lâm Đồng');
      expect(text).not.toContain('0,0');
    });

    it('hỗ trợ truyền trực tiếp đối tượng { name, area }', () => {
      const a = { name: 'Hà Nội', area: 3359 };
      const b = { name: 'Luxembourg', area: 2586 };
      const text = formatComparison(a, b);
      expect(text).toBe('Hà Nội ≈ 1,3 lần Luxembourg');
    });
  });

  describe('scaleBar (thước tỉ lệ 1/2/5×10ⁿ km)', () => {
    it('chiều dài pixel nằm trong khoảng 60–120 px', () => {
      const scales = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 20];
      for (const s of scales) {
        const bar = scaleBar(s);
        expect(bar.px).toBeGreaterThanOrEqual(59.9);
        expect(bar.px).toBeLessThanOrEqual(120.1);

        // Khoảng cách km phải là dạng 1, 2, hoặc 5 nhân với luỹ thừa của 10
        const mantissa = bar.km / Math.pow(10, Math.floor(Math.log10(bar.km)));
        expect([1, 2, 5]).toContain(Math.round(mantissa));
        expect(bar.label).toContain('km');
      }
    });
  });

  describe('encodeUrlState và decodeUrlState', () => {
    it('mã hoá và giải mã trạng thái URL bảo toàn đúng dữ liệu', () => {
      const shapes = [
        { id: 'lam-dong', x: 12.3, y: -45.6, rotation: 30 },
        { id: 'bel', x: 100.8, y: 50.2, rotation: 45 },
      ];
      const encoded = encodeUrlState(shapes, 1.5);
      expect(encoded).toContain('h=lam-dong%3A12%3A-46%3A30%2Cbel%3A101%3A50%3A45');
      expect(encoded).toContain('z=1.50');

      const decoded = decodeUrlState(encoded);
      expect(decoded.shapes.length).toBe(2);
      expect(decoded.shapes[0]).toEqual({
        id: 'lam-dong',
        x: 12,
        y: -46,
        rotation: 30,
        goc: 30,
      });
      expect(decoded.shapes[1]).toEqual({
        id: 'bel',
        x: 101,
        y: 50,
        rotation: 45,
        goc: 45,
      });
      expect(decoded.zoom).toBe(1.5);
    });

    it('bỏ qua id lạ khi có danh sách hợp lệ và bỏ qua số rác (NaN)', () => {
      const validSet = new Set(['lam-dong', 'bel']);
      // Chứa id lạ 'unknown-country' và số rác 'abc'
      const query = '?h=lam-dong:10:20:0,unknown-country:50:50:0,bel:foo:bar:baz';
      const decoded = decodeUrlState(query, validSet);

      expect(decoded.shapes.length).toBe(1);
      expect(decoded.shapes[0].id).toBe('lam-dong');
    });
  });

  describe('pickRandomMatch (kèo ngẫu nhiên chênh <= 3 lần)', () => {
    it('chọn cặp có diện tích chênh lệch không quá 3 lần', () => {
      const items = [
        { id: 'lam-dong', name: 'Lâm Đồng', area: 10373, type: 'tinh' },
        { id: 'nghe-an', name: 'Nghệ An', area: 16490, type: 'tinh' },
        { id: 'bel', name: 'Bỉ', area: 30688, type: 'nuoc' },
        { id: 'svn', name: 'Slovenia', area: 20273, type: 'nuoc' },
        { id: 'rus', name: 'Nga', area: 17098246, type: 'nuoc' }, // Chênh quá lớn
      ];

      for (let i = 0; i < 20; i++) {
        const match = pickRandomMatch(items);
        expect(match).not.toBeNull();
        if (match) {
          const maxA = Math.max(match.province.area, match.country.area);
          const minA = Math.min(match.province.area, match.country.area);
          expect(maxA / minA).toBeLessThanOrEqual(3);
          expect(match.province.type).toBe('tinh');
          expect(match.country.type).toBe('nuoc');
        }
      }
    });
  });

  describe('PRESET_MATCHES (Kèo kinh điển)', () => {
    it('có đủ 6 kèo kinh điển theo đặc tả', () => {
      expect(PRESET_MATCHES.length).toBe(6);
      expect(PRESET_MATCHES[0].title).toBe('Lâm Đồng vs Bỉ');
      expect(PRESET_MATCHES[1].title).toBe('Việt Nam vs Nhật Bản');
      expect(PRESET_MATCHES[2].title).toBe('TP.HCM vs Singapore');
      expect(PRESET_MATCHES[3].title).toBe('Hà Nội vs Luxembourg');
      expect(PRESET_MATCHES[4].title).toBe('Việt Nam vs Ý');
      expect(PRESET_MATCHES[5].title).toBe('Nghệ An vs Slovenia');
    });
  });

  describe('ten-nuoc.ts (Bảng tên chuẩn hoá)', () => {
    it('chuẩn hoá đúng tên các nước Séc, Hàn Quốc, Triều Tiên, Bờ Biển Ngà', () => {
      expect(getTenNuoc('cze')).toBe('Séc');
      expect(getTenNuoc('kor')).toBe('Hàn Quốc');
      expect(getTenNuoc('prk')).toBe('Triều Tiên');
      expect(getTenNuoc('civ')).toBe('Bờ Biển Ngà');
      expect(getTenNuoc('bel')).toBe('Bỉ');
      expect(getTenNuoc('unknown_code', 'Default Country')).toBe('Default Country');
    });

    it('xác định đúng các nước thuộc nhóm phổ biến', () => {
      expect(isPopularCountry('bel')).toBe(true);
      expect(isPopularCountry('jpn')).toBe(true);
      expect(isPopularCountry('sgp')).toBe(true);
      expect(isPopularCountry('usa')).toBe(true);
    });
  });

  describe('dataLoader.ts', () => {
    it('nạp sẵn meta và default ngay lập tức', () => {
      expect(meta.length).toBeGreaterThanOrEqual(3);
      expect(metaMap.has('viet-nam')).toBe(true);
      expect(metaMap.has('lam-dong')).toBe(true);
      expect(metaMap.has('bel')).toBe(true);

      const lamDongSvg = getShapeSync('lam-dong');
      expect(lamDongSvg).toBeTruthy();
      expect(lamDongSvg?.startsWith('M')).toBe(true);
    });

    it('tìm kiếm thực thể không dấu linh hoạt', () => {
      const results = searchEntities('lam dong');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('lam-dong');
    });

    it('getShape nạp được shape qua Promise', async () => {
      const shape = await getShape('bel');
      expect(shape).toBeTruthy();
      expect(shape?.startsWith('M')).toBe(true);
    });
  });
});
