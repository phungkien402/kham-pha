// src/explore/tieu-tien/stage3d.test.ts
// Kiểm thử các hàm thuần tính toán sân khấu 3D theo docs/tieu-tien-3d-dac-ta.md

import { describe, it, expect } from 'vitest';
import {
  getDisplayCount,
  calculateGridLayout,
  calculateClusterPositions,
  calculateCameraFit,
  getHighestMilestone,
  getNewMilestonesGrouped,
} from './stage3d';
import { MILESTONES } from './logic';

describe('Sân khấu 3D — Hàm thuần (stage3d)', () => {
  describe('1. Giới hạn hiển thị 400 bản / cụm (getDisplayCount)', () => {
    it('số lượng 0 hoặc âm thì trả về 0', () => {
      expect(getDisplayCount(0).displayCount).toBe(0);
      expect(getDisplayCount(-5).displayCount).toBe(0);
      expect(getDisplayCount(NaN).displayCount).toBe(0);
    });

    it('số lượng <= 400 thì hiển thị đủ, không overflow', () => {
      const r1 = getDisplayCount(1);
      expect(r1.displayCount).toBe(1);
      expect(r1.isOverflow).toBe(false);
      expect(r1.overflowMultiplier).toBe(1);
      expect(r1.label).toBe('');

      const r400 = getDisplayCount(400);
      expect(r400.displayCount).toBe(400);
      expect(r400.isOverflow).toBe(false);
    });

    it('số lượng > 400 thì chặn ở 400 và tạo nhãn phóng đại ×N', () => {
      const r800 = getDisplayCount(800);
      expect(r800.displayCount).toBe(400);
      expect(r800.isOverflow).toBe(true);
      expect(r800.overflowMultiplier).toBe(2);
      expect(r800.label).toBe('×2');

      const r1000 = getDisplayCount(1000);
      expect(r1000.displayCount).toBe(400);
      expect(r1000.isOverflow).toBe(true);
      expect(r1000.label).toBe('×2.5');

      const r4000 = getDisplayCount(4000);
      expect(r4000.displayCount).toBe(400);
      expect(r4000.overflowMultiplier).toBe(10);
      expect(r4000.label).toBe('×10');
    });
  });

  describe('2. Bố cục lưới n vật phẩm thành lưới gần vuông (calculateGridLayout)', () => {
    it('count <= 0 trả về mảng rỗng', () => {
      const r = calculateGridLayout(0);
      expect(r.positions).toEqual([]);
      expect(r.rows).toBe(0);
      expect(r.cols).toBe(0);
    });

    it('1 vật phẩm: 1 hàng, 1 cột, tâm ở (0, 0)', () => {
      const r = calculateGridLayout(1, 2.0);
      expect(r.rows).toBe(1);
      expect(r.cols).toBe(1);
      expect(r.positions).toEqual([{ x: 0, z: 0 }]);
    });

    it('4 vật phẩm: lưới 2x2 cân xứng qua gốc (0, 0)', () => {
      const r = calculateGridLayout(4, 2.0);
      expect(r.rows).toBe(2);
      expect(r.cols).toBe(2);
      expect(r.positions.length).toBe(4);
      // Tâm hình học các điểm cộng lại phải bằng 0
      const sumX = r.positions.reduce((acc, p) => acc + p.x, 0);
      const sumZ = r.positions.reduce((acc, p) => acc + p.z, 0);
      expect(Math.abs(sumX)).toBeLessThan(1e-6);
      expect(Math.abs(sumZ)).toBeLessThan(1e-6);
    });

    it('9 vật phẩm: lưới 3x3', () => {
      const r = calculateGridLayout(9, 1.5);
      expect(r.rows).toBe(3);
      expect(r.cols).toBe(3);
      expect(r.positions.length).toBe(9);
    });

    it('10 vật phẩm: cols = 4, rows = 3 (chữ nhật gần vuông)', () => {
      const r = calculateGridLayout(10, 2.0);
      expect(r.cols).toBe(4);
      expect(r.rows).toBe(3);
      expect(r.positions.length).toBe(10);
      // Đảm bảo không có 2 vị trí nào trùng nhau
      const keys = new Set(r.positions.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`));
      expect(keys.size).toBe(10);
    });
  });

  describe('3. Vị trí các cụm không chồng nhau (calculateClusterPositions)', () => {
    it('danh sách rỗng an toàn', () => {
      const res = calculateClusterPositions([]);
      expect(res.clusters).toEqual([]);
      expect(res.totalBounds.minX).toBe(0);
    });

    it('nhiều cụm xếp liền kề không chồng lấn và cách nhau >= gap', () => {
      const input = [
        { id: 'pho', width: 6, depth: 6 },
        { id: 'xe-may', width: 10, depth: 8 },
        { id: 'o-to', width: 14, depth: 10 },
      ];
      const gap = 4.0;
      const res = calculateClusterPositions(input, gap);
      expect(res.clusters.length).toBe(3);

      for (let i = 0; i < res.clusters.length - 1; i++) {
        const c1 = res.clusters[i];
        const c2 = res.clusters[i + 1];
        // Cụm tiếp theo phải nằm ngoài biên phải của cụm trước ít nhất là gap
        const distanceBetweenEdges = c2.bounds.minX - c1.bounds.maxX;
        expect(distanceBetweenEdges).toBeGreaterThanOrEqual(gap - 1e-6);
      }
    });

    it('totalBounds bao quát trọn vẹn mọi cụm', () => {
      const input = [
        { id: 'a', width: 4, depth: 5 },
        { id: 'b', width: 8, depth: 12 },
      ];
      const res = calculateClusterPositions(input, 3.0);
      for (const c of res.clusters) {
        expect(c.bounds.minX).toBeGreaterThanOrEqual(res.totalBounds.minX);
        expect(c.bounds.maxX).toBeLessThanOrEqual(res.totalBounds.maxX);
        expect(c.bounds.minZ).toBeGreaterThanOrEqual(res.totalBounds.minZ);
        expect(c.bounds.maxZ).toBeLessThanOrEqual(res.totalBounds.maxZ);
      }
    });
  });

  describe('4. Fit camera bao trọn cụm (calculateCameraFit)', () => {
    it('tính đúng tâm target và frustumSize lớn hơn 0', () => {
      const bounds = { minX: -20, maxX: 20, minZ: -10, maxZ: 10 };
      const fit = calculateCameraFit(bounds, 1200, 800);
      expect(fit.target.x).toBe(0);
      expect(fit.target.y).toBe(0);
      expect(fit.target.z).toBe(0);
      expect(fit.frustumSize).toBeGreaterThan(0);
    });

    it('màn hình hẹp (mobile) tăng frustumSize để không bị cắt 2 bên', () => {
      const bounds = { minX: -30, maxX: 30, minZ: -10, maxZ: 10 };
      const fitDesktop = calculateCameraFit(bounds, 1200, 800);
      const fitMobile = calculateCameraFit(bounds, 375, 667);
      expect(fitMobile.frustumSize).toBeGreaterThan(fitDesktop.frustumSize);
    });
  });

  describe('5. Gộp thẻ mốc % (getHighestMilestone & getNewMilestonesGrouped)', () => {
    it('chọn đúng mốc có tiLe cao nhất', () => {
      const subset = [MILESTONES[0], MILESTONES[2], MILESTONES[1]]; // 0.01%, 1%, 0.1%
      const highest = getHighestMilestone(subset);
      expect(highest?.nhan).toBe('1%');
      expect(highest?.tiLe).toBe(0.01);
    });

    it('mảng rỗng trả về null', () => {
      expect(getHighestMilestone([])).toBeNull();
    });

    it('vượt qua nhiều mốc trong một lần mua chỉ giữ lại mốc cao nhất', () => {
      const budget = 1000000000;
      // Nhảy vọt từ 0 lên 12% (vượt cả 0.01%, 0.1%, 1%, 10%)
      const grouped = getNewMilestonesGrouped(0, budget * 0.12, budget);
      expect(grouped.length).toBe(1);
      expect(grouped[0].nhan).toBe('10%');
    });

    it('chỉ vượt 1 mốc thì trả về đúng mốc đó', () => {
      const budget = 1000000000;
      const grouped = getNewMilestonesGrouped(0, budget * 0.00015, budget);
      expect(grouped.length).toBe(1);
      expect(grouped[0].nhan).toBe('0,01%');
    });

    it('không vượt mốc nào trả về mảng rỗng', () => {
      const budget = 1000000000;
      const grouped = getNewMilestonesGrouped(budget * 0.0002, budget * 0.0003, budget);
      expect(grouped).toEqual([]);
    });
  });
});
