// src/explore/tieu-tien/stage3d.ts
// Các hàm thuần tính toán bố cục không gian 3D và thuật toán cho sân khấu /tieu-tien

import type { Milestone } from './types';
import { getNewMilestones, formatVietnameseCurrency } from './logic';

export interface DisplayCountResult {
  displayCount: number;
  overflowMultiplier: number;
  isOverflow: boolean;
  label: string;
}

export interface GridLayoutResult {
  rows: number;
  cols: number;
  positions: Array<{ x: number; z: number }>;
  width: number;
  depth: number;
}

export interface ClusterBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
}

export interface ClusterLayoutItem {
  id: string;
  center: { x: number; z: number };
  bounds: ClusterBounds;
  width: number;
  depth: number;
}

export interface ClustersPlacementResult {
  clusters: ClusterLayoutItem[];
  totalBounds: ClusterBounds;
}

export interface CameraFitResult {
  target: { x: number; y: number; z: number };
  frustumSize: number;
  zoom: number;
}

/**
 * 1. Giới hạn hiển thị 400 bản / cụm
 * Nếu vượt 400, trả về 400 và hệ số phóng đại "×N"
 */
export function getDisplayCount(actualCount: number, maxCount = 400): DisplayCountResult {
  if (!Number.isFinite(actualCount) || actualCount <= 0) {
    return { displayCount: 0, overflowMultiplier: 0, isOverflow: false, label: '' };
  }

  const rounded = Math.floor(actualCount);
  if (rounded <= maxCount) {
    return {
      displayCount: rounded,
      overflowMultiplier: 1,
      isOverflow: false,
      label: '',
    };
  }

  const mult = rounded / maxCount;
  // Làm tròn nhãn đẹp mắt: ví dụ ×2, ×2.5, ×10
  const formattedMult = mult >= 10 ? Math.round(mult).toString() : mult.toFixed(1).replace('.0', '');
  return {
    displayCount: maxCount,
    overflowMultiplier: mult,
    isOverflow: true,
    label: `×${formattedMult}`,
  };
}

/**
 * 2. Bố cục lưới n vật phẩm thành lưới chữ nhật gần vuông
 * Trả về hàng, cột, tọa độ tương đối (x, z) tâm ở (0, 0)
 */
export function calculateGridLayout(count: number, spacing = 2.0): GridLayoutResult {
  if (!Number.isFinite(count) || count <= 0) {
    return { rows: 0, cols: 0, positions: [], width: 0, depth: 0 };
  }

  const n = Math.floor(count);
  if (n === 1) {
    return {
      rows: 1,
      cols: 1,
      positions: [{ x: 0, z: 0 }],
      width: spacing,
      depth: spacing,
    };
  }

  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);

  const totalW = (cols - 1) * spacing;
  const totalD = (rows - 1) * spacing;
  const startX = -totalW / 2;
  const startZ = -totalD / 2;

  const positions: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * spacing,
      z: startZ + row * spacing,
    });
  }

  return {
    rows,
    cols,
    positions,
    width: Math.max(spacing, cols * spacing),
    depth: Math.max(spacing, rows * spacing),
  };
}

/**
 * 3. Sắp xếp vị trí các cụm sao cho không chồng lấn (non-overlapping)
 * Sắp xếp từ trái sang phải theo trục X
 * Khoảng cách giữa 2 cụm (gap) tự động giãn theo kích thước cụm + bề rộng nhãn để nhãn không đè nhau
 */
export function calculateClusterPositions(
  clusters: Array<{ id: string; width: number; depth: number }>,
  baseGap = 4.0
): ClustersPlacementResult {
  if (!clusters || clusters.length === 0) {
    return {
      clusters: [],
      totalBounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
    };
  }

  const items: ClusterLayoutItem[] = [];
  let currentX = 0;

  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const halfW = c.width / 2;
    const halfD = c.depth / 2;

    if (i === 0) {
      currentX = halfW;
    } else {
      const prev = items[i - 1];
      // Gap động: đảm bảo khoảng cách giữa tâm 2 nhãn liền kề đủ rộng (~8.5 đơn vị 3D)
      const minCenterDist = 8.5;
      const neededGap = Math.max(0, minCenterDist - (prev.width / 2 + halfW));
      const effectiveGap = Math.max(baseGap, neededGap);

      currentX = prev.bounds.maxX + effectiveGap + halfW;
    }

    const bounds: ClusterBounds = {
      minX: currentX - halfW,
      maxX: currentX + halfW,
      minZ: -halfD,
      maxZ: halfD,
    };

    items.push({
      id: c.id,
      center: { x: currentX, z: 0 },
      bounds,
      width: c.width,
      depth: c.depth,
    });
  }

  // Căn tâm toàn bộ hệ thống về gần 0 để camera dễ bắt
  const minX = items[0].bounds.minX;
  const maxX = items[items.length - 1].bounds.maxX;
  const shiftX = (minX + maxX) / 2;

  let totalMinZ = 0;
  let totalMaxZ = 0;

  for (const item of items) {
    item.center.x -= shiftX;
    item.bounds.minX -= shiftX;
    item.bounds.maxX -= shiftX;
    if (item.bounds.minZ < totalMinZ) totalMinZ = item.bounds.minZ;
    if (item.bounds.maxZ > totalMaxZ) totalMaxZ = item.bounds.maxZ;
  }

  const totalBounds: ClusterBounds = {
    minX: items[0].bounds.minX,
    maxX: items[items.length - 1].bounds.maxX,
    minZ: totalMinZ,
    maxZ: totalMaxZ,
  };

  return {
    clusters: items,
    totalBounds,
  };
}

/**
 * 4. Tính toán góc nhìn và zoom camera Orthographic bao trọn toàn bộ cụm
 * Lấp ~80% khung (padding nhỏ ~1.18).
 * Khi chỉ có 1-2 cụm thì zoom gần hơn.
 */
export function calculateCameraFit(
  totalBounds: ClusterBounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 1.18,
  clusterCount = 1
): CameraFitResult {
  const target = {
    x: (totalBounds.minX + totalBounds.maxX) / 2,
    y: 0,
    z: (totalBounds.minZ + totalBounds.maxZ) / 2,
  };

  const spanX = Math.max(1.5, totalBounds.maxX - totalBounds.minX);
  const spanZ = Math.max(1.5, totalBounds.maxZ - totalBounds.minZ);
  const spanY = Math.max(1.5, (totalBounds.maxY ?? 3) - (totalBounds.minY ?? 0));

  const vpW = Math.max(1, viewportWidth);
  const vpH = Math.max(1, viewportHeight);
  const aspect = vpW / vpH;

  // Chiếu isometric chuẩn: đường chéo X-Z
  const projWidth = (spanX + spanZ) * 0.72;
  const projHeight = (spanX + spanZ) * 0.42 + spanY;

  // Kích thước frustum cần bao phủ để lấp ~80-85% khung
  const fitPadding = Math.min(padding, 1.25);
  const requiredFrustumH = Math.max(projHeight, projWidth / aspect) * fitPadding;

  // Khi chỉ có 1–2 cụm thì zoom gần hơn
  let minFrustum = 3.5;
  let zoom = 1.0;
  if (clusterCount === 1) {
    minFrustum = 3.2;
    zoom = 1.15;
  } else if (clusterCount === 2) {
    minFrustum = 4.8;
    zoom = 1.05;
  }

  const frustumSize = Math.max(minFrustum, requiredFrustumH);

  return {
    target,
    frustumSize,
    zoom,
  };
}

/**
 * Định dạng nhãn cụm 3D: mẫu "<số lượng> × <tên> (<tổng tiền>)"
 * Tránh lặp từ như "1 tuyến Tuyến metro số 1..."
 */
export function formatClusterLabel(
  count: number,
  item: { ten: string; donVi?: string; gia: number }
): string {
  const countStr = count.toLocaleString('vi-VN');
  const totalCost = count * item.gia;
  const costStr = formatVietnameseCurrency(totalCost, true);
  return `${countStr} × ${item.ten} (${costStr})`;
}

/**
 * 5. Gộp mốc %: Lấy mốc có tỉ lệ % cao nhất trong danh sách
 */
export function getHighestMilestone(milestones: Milestone[]): Milestone | null {
  if (!milestones || milestones.length === 0) return null;
  return milestones.reduce((prev, curr) => (curr.tiLe > prev.tiLe ? curr : prev));
}

/**
 * Gộp mốc % khi một lần mua vượt nhiều mốc: chỉ trả về mốc cao nhất
 */
export function getNewMilestonesGrouped(
  prevSpent: number,
  newSpent: number,
  totalBudget: number
): Milestone[] {
  const newMs = getNewMilestones(prevSpent, newSpent, totalBudget);
  if (newMs.length <= 1) return newMs;
  const highest = getHighestMilestone(newMs);
  return highest ? [highest] : [];
}

/**
 * Kiểm tra xem môi trường hiện tại có hỗ trợ WebGL hay không
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
