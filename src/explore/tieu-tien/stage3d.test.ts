// src/explore/tieu-tien/stage3d.test.ts
// Kiểm thử các hàm thuần tính toán sân khấu 3D theo docs/tieu-tien-3d-dac-ta.md

import { describe, it, expect } from 'vitest';
import {
  getDisplayCount,
  calculateGridLayout,
  calculateClusterPositions,
  calculateCameraFit,
  formatClusterLabel,
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

  describe('3. Vị trí các cụm không chồng nhau theo toạ độ màn hình (calculateClusterPositions)', () => {
    it('danh sách rỗng an toàn', () => {
      const res = calculateClusterPositions([]);
      expect(res.clusters).toEqual([]);
      expect(res.totalBounds.minX).toBe(0);
      expect(res.rowCount).toBe(0);
    });

    it('nhiều cụm trong cùng hàng xếp ngang màn hình theo trục U, không chồng lấn và cách nhau >= gap', () => {
      const input = [
        { id: 'pho', width: 6, depth: 6 },
        { id: 'xe-may', width: 10, depth: 8 },
        { id: 'o-to', width: 14, depth: 10 },
      ];
      const gap = 4.0;
      const res = calculateClusterPositions(input, gap);
      expect(res.clusters.length).toBe(3);

      // Cùng nằm ở hàng 0
      for (const c of res.clusters) {
        expect(c.row).toBe(0);
      }

      for (let i = 0; i < res.clusters.length - 1; i++) {
        const c1 = res.clusters[i];
        const c2 = res.clusters[i + 1];
        // Cụm tiếp theo phải nằm ngoài biên phải của cụm trước theo trục chiếu màn hình U ít nhất là gap
        const distanceBetweenEdgesOnScreen = c2.bounds.minU! - c1.bounds.maxU!;
        expect(distanceBetweenEdgesOnScreen).toBeGreaterThanOrEqual(gap - 1e-6);
      }
    });

    it('đáy các cụm trong cùng một hàng thẳng hàng tại cùng toạ độ v (đáy thẳng hàng)', () => {
      const input = [
        { id: 'pho', width: 6, depth: 6 },
        { id: 'xe-may', width: 10, depth: 8 },
        { id: 'o-to', width: 14, depth: 10 },
      ];
      const res = calculateClusterPositions(input, 4.0);
      // Đáy cụm theo trục v (vMin) phải bằng nhau cho tất cả cụm trong cùng hàng
      const vBaseRow0 = res.clusters[0].bounds.minV;
      for (const c of res.clusters) {
        expect(c.bounds.minV).toBeCloseTo(vBaseRow0!, 5);
      }
    });

    it('khoảng cách giữa tâm các cụm nhỏ giãn rộng để nhãn không đè nhau', () => {
      const input = [
        { id: 'tra-da', width: 1.6, depth: 1.6 },
        { id: 'pho', width: 2.0, depth: 2.0 },
      ];
      const res = calculateClusterPositions(input);
      const c1 = res.clusters[0];
      const c2 = res.clusters[1];
      // Khoảng cách theo trục ngang màn hình U >= 8.5
      const screenCenterDist = Math.abs(c2.u - c1.u);
      expect(screenCenterDist).toBeGreaterThanOrEqual(8.5);
    });

    it('nhãn đặt ngay dưới chân mỗi cụm và căn giữa theo trục U', () => {
      const input = [
        { id: 'pho', width: 6, depth: 6 },
        { id: 'xe-may', width: 10, depth: 8 },
      ];
      const res = calculateClusterPositions(input);
      for (const c of res.clusters) {
        // screenBottom chiếu ra phải có toạ độ ngang u bằng đúng c.u
        const uvBottom = (c.screenBottom.x - c.screenBottom.z) / Math.SQRT2;
        expect(uvBottom).toBeCloseTo(c.u, 5);
      }
    });

    it('nhiều cụm quá rộng thì tự động xuống hàng mới phía sau (wrap) không đè hàng trước', () => {
      // 4 cụm kích thước lớn giống tình huống mua 100 phở, 100 vision, 100 vf8, 1 metro
      const input = [
        { id: 'pho', width: 20, depth: 20 },
        { id: 'vision', width: 25, depth: 25 },
        { id: 'vf8', width: 40, depth: 40 },
        { id: 'metro', width: 16, depth: 6 },
      ];
      const res = calculateClusterPositions(input, {
        baseGap: 4.0,
        rowGap: 6.0,
        maxRowWidth: 70.0,
        maxClustersPerRow: 4,
      });

      // Phải tự động chia thành 2 hàng
      expect(res.rowCount).toBeGreaterThanOrEqual(2);

      const row0Clusters = res.clusters.filter((c) => c.row === 0);
      const row1Clusters = res.clusters.filter((c) => c.row === 1);
      expect(row0Clusters.length).toBeGreaterThan(0);
      expect(row1Clusters.length).toBeGreaterThan(0);

      // Đáy hàng 1 phải nằm sau đỉnh cao nhất của hàng 0 ít nhất là rowGap
      const maxVRow0 = Math.max(...row0Clusters.map((c) => c.bounds.maxV!));
      const minVRow1 = Math.min(...row1Clusters.map((c) => c.bounds.minV!));
      expect(minVRow1).toBeGreaterThanOrEqual(maxVRow0 + 6.0 - 1e-6);
    });

    it('mỗi hàng đều được căn giữa khung hình theo trục U', () => {
      const input = [
        { id: 'a', width: 8, depth: 8 },
        { id: 'b', width: 12, depth: 10 },
      ];
      const res = calculateClusterPositions(input);
      const row0 = res.clusters.filter((c) => c.row === 0);
      const minU = Math.min(...row0.map((c) => c.bounds.minU!));
      const maxU = Math.max(...row0.map((c) => c.bounds.maxU!));
      expect((minU + maxU) / 2).toBeCloseTo(0, 5);
    });

    it('totalBounds bao quát trọn vẹn mọi cụm cả theo toạ độ 3D và toạ độ màn hình', () => {
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
        expect(c.bounds.minU!).toBeGreaterThanOrEqual(res.totalBounds.minU!);
        expect(c.bounds.maxU!).toBeLessThanOrEqual(res.totalBounds.maxU!);
        expect(c.bounds.minV!).toBeGreaterThanOrEqual(res.totalBounds.minV!);
        expect(c.bounds.maxV!).toBeLessThanOrEqual(res.totalBounds.maxV!);
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

    it('tính theo bbox chiếu lên màn hình (cả nhãn) và lấp ~80–85% khung', () => {
      const stageBounds = {
        minX: -15,
        maxX: 15,
        minZ: -10,
        maxZ: 10,
        minU: -25,
        maxU: 25,
        minV: 0,
        maxV: 20,
        maxY: 6,
      };
      const fit = calculateCameraFit(stageBounds, 1200, 800, 1.2);
      expect(fit.projBounds).toBeDefined();
      expect(fit.projBounds!.spanX).toBeGreaterThan(50); // bao gồm cả labelExtraU
      expect(fit.projBounds!.spanY).toBeGreaterThan(15);

      // FrustumSize lấp ~80-85% khung hình: tỉ lệ span / frustumSize ~ 1 / 1.2 ≈ 0.833
      const fillRatio = Math.max(fit.projBounds!.spanY, fit.projBounds!.spanX / (1200 / 800)) / fit.frustumSize;
      expect(fillRatio).toBeGreaterThanOrEqual(0.8);
      expect(fillRatio).toBeLessThanOrEqual(0.86);
    });

    it('màn hình hẹp (mobile) tăng frustumSize để không bị cắt 2 bên', () => {
      const bounds = { minX: -30, maxX: 30, minZ: -10, maxZ: 10, minU: -30, maxU: 30, minV: 0, maxV: 10 };
      const fitDesktop = calculateCameraFit(bounds, 1200, 800);
      const fitMobile = calculateCameraFit(bounds, 375, 667);
      expect(fitMobile.frustumSize).toBeGreaterThan(fitDesktop.frustumSize);
    });

    it('khi chỉ có 1 hoặc 2 cụm thì zoom gần hơn (frustum nhỏ hoặc zoom lớn)', () => {
      const singleBounds = { minX: -1.5, maxX: 1.5, minZ: -1.5, maxZ: 1.5 };
      const fit1 = calculateCameraFit(singleBounds, 1200, 800, 1.18, 1);
      const fit2 = calculateCameraFit(singleBounds, 1200, 800, 1.18, 2);
      const fitMany = calculateCameraFit(singleBounds, 1200, 800, 1.18, 5);

      expect(fit1.zoom).toBeGreaterThan(fit2.zoom);
      expect(fit2.zoom).toBeGreaterThanOrEqual(fitMany.zoom);
    });
  });

  describe('5. Định dạng nhãn cụm 3D không bị lặp chữ (formatClusterLabel)', () => {
    it('dùng mẫu "<số lượng> × <tên> (<tổng tiền>)"', () => {
      const metro = {
        ten: 'Tuyến metro số 1 Bến Thành – Suối Tiên',
        donVi: 'tuyến',
        gia: 43700000000000,
      };
      const label = formatClusterLabel(1, metro);
      expect(label).toBe('1 × Tuyến metro số 1 Bến Thành – Suối Tiên (43,7 nghìn tỷ đ)');
      expect(label).not.toContain('1 tuyến Tuyến');
    });

    it('định dạng số lượng lớn có phân cách hàng nghìn', () => {
      const traDa = {
        ten: 'Cốc trà đá vỉa hè',
        donVi: 'cốc',
        gia: 4000,
      };
      const label = formatClusterLabel(1000, traDa);
      expect(label).toBe('1.000 × Cốc trà đá vỉa hè (4 triệu đ)');
    });
  });

  describe('6. Gộp thẻ mốc % (getHighestMilestone & getNewMilestonesGrouped)', () => {
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
