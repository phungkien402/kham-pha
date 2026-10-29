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
  minU?: number;
  maxU?: number;
  minV?: number;
  maxV?: number;
}

export interface ClusterLayoutItem {
  id: string;
  center: { x: number; z: number };
  bounds: ClusterBounds;
  width: number;
  depth: number;
  u: number;
  v: number;
  row: number;
  halfWu: number;
  halfDv: number;
  screenBottom: { x: number; z: number };
}

export interface ClusterPlacementOptions {
  baseGap?: number;
  rowGap?: number;
  maxRowWidth?: number;
  maxClustersPerRow?: number;
  minLabelDist?: number;
  labelGap?: number;
}

export interface ClustersPlacementResult {
  clusters: ClusterLayoutItem[];
  totalBounds: ClusterBounds;
  rowCount: number;
}

export interface CameraFitResult {
  target: { x: number; y: number; z: number };
  frustumSize: number;
  zoom: number;
  projBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    spanX: number;
    spanY: number;
  };
}

/**
 * Chuyển đổi toạ độ mặt đất (u, v) theo góc nhìn Isometric sang toạ độ thế giới (x, z):
 * - u: trục ngang màn hình (screen right), vector đơn vị (1/√2, 0, -1/√2)
 * - v: trục chiều sâu màn hình (hàng phía sau, đi lên trên), vector đơn vị (-1/√2, 0, -1/√2)
 */
export function uvToWorld(u: number, v: number): { x: number; z: number } {
  const x = (u - v) / Math.SQRT2;
  const z = (-u - v) / Math.SQRT2;
  return {
    x: Math.abs(x) < 1e-12 ? 0 : x,
    z: Math.abs(z) < 1e-12 ? 0 : z,
  };
}

/**
 * Chuyển đổi toạ độ thế giới (x, z) sang toạ độ mặt đất (u, v) theo góc nhìn Isometric
 */
export function worldToUv(x: number, z: number): { u: number; v: number } {
  return {
    u: (x - z) / Math.SQRT2,
    v: (-x - z) / Math.SQRT2,
  };
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
 * 3. Sắp xếp vị trí các cụm theo phong cách neal.fun:
 * - Các cụm nằm NGANG HÀNG trên màn hình theo vector screen right (u)
 * - Đáy các cụm trong cùng hàng thẳng hàng tại cùng toạ độ v (vMin = vBase)
 * - Nhãn ngay dưới chân mỗi cụm và căn giữa theo trục ngang (u)
 * - Nếu nhiều cụm hoặc quá rộng thì tự động xuống hàng mới phía sau (v tăng)
 * - Mỗi hàng đều được căn giữa khung hình theo trục U
 */
export function calculateClusterPositions(
  clusters: Array<{ id: string; width: number; depth: number }>,
  options?: number | ClusterPlacementOptions
): ClustersPlacementResult {
  if (!clusters || clusters.length === 0) {
    return {
      clusters: [],
      totalBounds: {
        minX: 0,
        maxX: 0,
        minZ: 0,
        maxZ: 0,
        minU: 0,
        maxU: 0,
        minV: 0,
        maxV: 0,
      },
      rowCount: 0,
    };
  }

  const baseGap = typeof options === 'number' ? options : (options?.baseGap ?? 4.0);
  const rowGap = typeof options === 'object' ? (options.rowGap ?? 6.0) : 6.0;
  const maxRowWidth = typeof options === 'object' ? (options.maxRowWidth ?? 70.0) : 70.0;
  const maxClustersPerRow = typeof options === 'object' ? (options.maxClustersPerRow ?? 4) : 4;
  const minLabelDist = typeof options === 'object' ? (options.minLabelDist ?? 8.5) : 8.5;
  const labelGap = typeof options === 'object' ? (options.labelGap ?? 0.8) : 0.8;

  // 1. Phân chia các cụm vào các hàng (wrap)
  interface IntermediateCluster {
    cluster: { id: string; width: number; depth: number };
    origIndex: number;
    halfWu: number;
    halfDv: number;
    spanU: number;
    spanV: number;
  }

  const intermediate: IntermediateCluster[] = clusters.map((c, i) => {
    // Chiếu kích thước (width, depth) sang trục chiếu màn hình u và v
    const spanU = (c.width + c.depth) / Math.SQRT2;
    const spanV = (c.width + c.depth) / Math.SQRT2;
    return {
      cluster: c,
      origIndex: i,
      halfWu: spanU / 2,
      halfDv: spanV / 2,
      spanU,
      spanV,
    };
  });

  const rows: IntermediateCluster[][] = [];
  let currentRow: IntermediateCluster[] = [];
  let currentLineWidth = 0;

  for (let i = 0; i < intermediate.length; i++) {
    const item = intermediate[i];
    let neededDist = 0;
    if (currentRow.length > 0) {
      const prev = currentRow[currentRow.length - 1];
      const geomDist = prev.halfWu + item.halfWu + baseGap;
      neededDist = Math.max(geomDist, minLabelDist);
    }

    const wouldExceedWidth =
      currentRow.length > 0 && currentLineWidth + neededDist + item.halfWu > maxRowWidth;
    const wouldExceedCount = currentRow.length >= maxClustersPerRow;

    if (wouldExceedWidth || wouldExceedCount) {
      rows.push(currentRow);
      currentRow = [];
      currentLineWidth = 0;
    }

    if (currentRow.length === 0) {
      currentLineWidth = item.spanU;
    } else {
      currentLineWidth += neededDist;
    }

    currentRow.push(item);
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // 2. Định vị từng hàng trên toạ độ (u, v):
  // Hàng r: đáy các cụm thẳng hàng tại vBase (vMin = vBase).
  // Đáy hàng 0 tại vBase = 0.
  // Hàng kế tiếp bắt đầu sau đỉnh cao nhất của hàng trước + rowGap.
  const placedItems: ClusterLayoutItem[] = [];
  let currentVBase = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    // Tính toạ độ u tương đối của các cụm trong hàng
    const relativeU: number[] = [];
    let curU = 0;
    for (let j = 0; j < row.length; j++) {
      if (j === 0) {
        curU = row[j].halfWu;
      } else {
        const prev = row[j - 1];
        const neededDist = Math.max(prev.halfWu + row[j].halfWu + baseGap, minLabelDist);
        curU += neededDist;
      }
      relativeU.push(curU);
    }

    // Căn giữa hàng theo trục U (u = 0 là tâm ngang)
    const minRowU = relativeU[0] - row[0].halfWu;
    const maxRowU = relativeU[row.length - 1] + row[row.length - 1].halfWu;
    const rowCenterU = (minRowU + maxRowU) / 2;

    let maxRowV = currentVBase;

    for (let j = 0; j < row.length; j++) {
      const item = row[j];
      const u = relativeU[j] - rowCenterU;
      // Đáy cụm thẳng hàng: vMin = currentVBase => centerV = currentVBase + halfDv
      const v = currentVBase + item.halfDv;
      const topV = currentVBase + item.spanV;
      if (topV > maxRowV) {
        maxRowV = topV;
      }

      const worldCenter = uvToWorld(u, v);
      const worldBottom = uvToWorld(u, currentVBase - labelGap);

      const minU = u - item.halfWu;
      const maxU = u + item.halfWu;
      const minV = currentVBase;
      const maxV = topV;

      // Giới hạn trong không gian 3D thế giới (x, z)
      const halfW = item.cluster.width / 2;
      const halfD = item.cluster.depth / 2;
      const bounds: ClusterBounds = {
        minX: worldCenter.x - halfW,
        maxX: worldCenter.x + halfW,
        minZ: worldCenter.z - halfD,
        maxZ: worldCenter.z + halfD,
        minU,
        maxU,
        minV,
        maxV,
      };

      placedItems.push({
        id: item.cluster.id,
        center: worldCenter,
        bounds,
        width: item.cluster.width,
        depth: item.cluster.depth,
        u,
        v,
        row: r,
        halfWu: item.halfWu,
        halfDv: item.halfDv,
        screenBottom: worldBottom,
      });
    }

    // Hàng sau lùi ra phía sau (v tăng)
    currentVBase = maxRowV + rowGap;
  }

  // Giữ nguyên thứ tự ban đầu của mảng clusters đầu vào
  placedItems.sort((a, b) => {
    const idxA = clusters.findIndex((c) => c.id === a.id);
    const idxB = clusters.findIndex((c) => c.id === b.id);
    return idxA - idxB;
  });

  // Tính totalBounds bao trùm mọi cụm
  let totalMinX = Infinity,
    totalMaxX = -Infinity;
  let totalMinZ = Infinity,
    totalMaxZ = -Infinity;
  let totalMinU = Infinity,
    totalMaxU = -Infinity;
  let totalMinV = Infinity,
    totalMaxV = -Infinity;

  for (const item of placedItems) {
    if (item.bounds.minX < totalMinX) totalMinX = item.bounds.minX;
    if (item.bounds.maxX > totalMaxX) totalMaxX = item.bounds.maxX;
    if (item.bounds.minZ < totalMinZ) totalMinZ = item.bounds.minZ;
    if (item.bounds.maxZ > totalMaxZ) totalMaxZ = item.bounds.maxZ;
    if (item.bounds.minU! < totalMinU) totalMinU = item.bounds.minU!;
    if (item.bounds.maxU! > totalMaxU) totalMaxU = item.bounds.maxU!;
    if (item.bounds.minV! < totalMinV) totalMinV = item.bounds.minV!;
    if (item.bounds.maxV! > totalMaxV) totalMaxV = item.bounds.maxV!;
  }

  const totalBounds: ClusterBounds = {
    minX: totalMinX,
    maxX: totalMaxX,
    minZ: totalMinZ,
    maxZ: totalMaxZ,
    minU: totalMinU,
    maxU: totalMaxU,
    minV: totalMinV,
    maxV: totalMaxV,
  };

  return {
    clusters: placedItems,
    totalBounds,
    rowCount: rows.length,
  };
}

/**
 * 4. Tính toán góc nhìn và zoom camera Orthographic bao trọn toàn bộ cụm theo bbox CHIẾU lên màn hình (cả nhãn)
 * Lấp ~80–85% khung hình, căn giữa khung; không để mô hình/nhãn bị cắt.
 */
export function calculateCameraFit(
  totalBounds: ClusterBounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 1.2,
  clusterCount = 1
): CameraFitResult {
  const vpW = Math.max(1, viewportWidth);
  const vpH = Math.max(1, viewportHeight);
  const aspect = vpW / vpH;

  // Hệ số chiếu Isometric chuẩn của Three.js OrthographicCamera:
  // cameraPosition = target + (dist, 1.2*dist, dist)
  // Xcam = u
  // Ycam = alpha * v + beta * y
  const alpha = 1.2 / Math.sqrt(3.44); // ~ 0.6470
  const beta = Math.SQRT2 / Math.sqrt(3.44); // ~ 0.7625

  const hasExtendedBounds =
    totalBounds.minU !== undefined &&
    totalBounds.maxU !== undefined &&
    totalBounds.minV !== undefined &&
    totalBounds.maxV !== undefined;

  let minU: number, maxU: number, minV: number, maxV: number;
  if (hasExtendedBounds) {
    minU = totalBounds.minU!;
    maxU = totalBounds.maxU!;
    minV = totalBounds.minV!;
    maxV = totalBounds.maxV!;
  } else {
    // Dự phòng tính từ minX, maxX, minZ, maxZ nếu không có u, v
    const corners = [
      { x: totalBounds.minX, z: totalBounds.minZ },
      { x: totalBounds.minX, z: totalBounds.maxZ },
      { x: totalBounds.maxX, z: totalBounds.minZ },
      { x: totalBounds.maxX, z: totalBounds.maxZ },
    ];
    const uvs = corners.map((p) => worldToUv(p.x, p.z));
    minU = Math.min(...uvs.map((p) => p.u));
    maxU = Math.max(...uvs.map((p) => p.u));
    minV = Math.min(...uvs.map((p) => p.v));
    maxV = Math.max(...uvs.map((p) => p.v));
  }

  // Dự phòng an toàn cho bề rộng nhãn và chiều cao nhãn/mô hình:
  const labelExtraU = hasExtendedBounds ? 3.5 : 0;
  const labelExtraV = hasExtendedBounds ? 3.0 : 0;
  const modelHeight =
    totalBounds.maxY !== undefined
      ? Math.max(0, totalBounds.maxY - (totalBounds.minY ?? 0))
      : hasExtendedBounds
        ? 4.5
        : 0;

  const projMinX = minU - labelExtraU;
  const projMaxX = maxU + labelExtraU;
  const projMinY = alpha * (minV - labelExtraV);
  const projMaxY = alpha * maxV + beta * modelHeight;

  const spanX = Math.max(2.0, projMaxX - projMinX);
  const spanY = Math.max(2.0, projMaxY - projMinY);

  // Tâm mục tiêu (target) trên màn hình chiếu về toạ độ thế giới 3D
  const midProjX = (projMinX + projMaxX) / 2;
  const midProjY = (projMinY + projMaxY) / 2;

  const targetU = midProjX;
  const targetV = midProjY / alpha;
  const targetPos = uvToWorld(targetU, targetV);
  const target = {
    x: targetPos.x,
    y: 0,
    z: targetPos.z,
  };

  // Frustum size cần thiết để bao quát cả chiều ngang và chiều cao
  const requiredFrustumH = Math.max(spanY, spanX / aspect);

  // Lấp ~80-85% khung hình:
  // padding = 1 / 0.825 ≈ 1.21
  const fitPadding = Math.max(1.15, Math.min(padding, 1.25));
  let frustumSize = requiredFrustumH * fitPadding;

  // Zoom gần nhẹ khi chỉ có 1-2 cụm
  let minFrustum = 8.0;
  let zoom = 1.0;
  if (clusterCount === 1) {
    minFrustum = 7.5;
    zoom = 1.05;
  } else if (clusterCount === 2) {
    minFrustum = 11.0;
    zoom = 1.0;
  }

  frustumSize = Math.max(minFrustum, frustumSize);

  return {
    target,
    frustumSize,
    zoom,
    projBounds: {
      minX: projMinX,
      maxX: projMaxX,
      minY: projMinY,
      maxY: projMaxY,
      spanX,
      spanY,
    },
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

/**
 * 7. BỐ CỤC 2.5D SPRITE ISOMETRIC THEO ĐẶC TẢ docs/tieu-tien-sprite-dac-ta.md
 */

/**
 * Chiếu toạ độ ô lưới isometric (col, row) sang toạ độ pixel (x, y) trên màn hình
 * Góc isometric chuẩn 30 độ (cos 30° = √3/2, sin 30° = 0.5)
 */
export function gridToIsometricPx(
  col: number,
  row: number,
  footprintW: number,
  footprintD: number,
  scale = 36
): { x: number; y: number } {
  const xw = col * footprintW;
  const zw = row * footprintD;
  const cos30 = Math.sqrt(3) / 2;
  const sin30 = 0.5;
  return {
    x: (xw - zw) * cos30 * scale,
    y: (xw + zw) * sin30 * scale,
  };
}

/**
 * Thứ tự vẽ Painter's Algorithm: sắp xếp các phần tử tăng dần theo (col + row)
 * Phần tử phía sau vẽ trước, phần tử phía trước vẽ sau đè lên tự nhiên
 */
export function getSpriteDrawOrder<T extends { col: number; row: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const depthA = a.col + a.row;
    const depthB = b.col + b.row;
    if (depthA !== depthB) return depthA - depthB;
    return a.col - b.col;
  });
}

export interface Cluster2DPlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  maxLabelWidth?: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export interface Clusters2DLayoutResult {
  clusters: Cluster2DPlacement[];
  totalBounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Sắp xếp các cụm 2D NGANG trên màn hình theo phong cách neal.fun:
 * - Đáy các cụm thẳng hàng tại y = 0
 * - Nhãn đặt dưới đáy cụm, không đè lên sprite của cụm khác
 * - Nhãn dài thì cắt "…" có tooltip, rộng tối đa = bề ngang cụm + 40px
 * - Nếu vẫn chồng nhãn thì nới khoảng cách cụm
 * - Căn giữa toàn bộ hàng cụm theo trục X
 */
export function calculateClusters2DLayout(
  clusters: Array<{
    id: string;
    width: number;
    height: number;
    labelWidth?: number;
    bottomOffsetY?: number;
  }>,
  options?: { gap?: number; minLabelDist?: number; labelGapY?: number }
): Clusters2DLayoutResult {
  if (!clusters || clusters.length === 0) {
    return {
      clusters: [],
      totalBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    };
  }

  const gap = options?.gap ?? 48;
  const labelGapY = options?.labelGapY ?? 16;

  // Tính vị trí tương đối dọc theo trục X
  const relativeX: number[] = [];
  let curX = 0;

  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const lblW = c.labelWidth ?? (c.width + 40);
    const effectiveHalfW = Math.max(c.width, lblW) / 2;

    if (i === 0) {
      curX = effectiveHalfW;
    } else {
      const prev = clusters[i - 1];
      const prevLblW = prev.labelWidth ?? (prev.width + 40);
      const prevHalfW = Math.max(prev.width, prevLblW) / 2;

      // Khoảng cách cơ bản đảm bảo không đè ảnh và nhãn
      const baseDist = prevHalfW + effectiveHalfW + gap;

      // Nếu vẫn chồng nhãn thì nới thêm khoảng cách cụm
      const minLabelDist = options?.minLabelDist ?? (prevLblW / 2 + lblW / 2 + 16);
      const dist = Math.max(baseDist, minLabelDist);

      curX += dist;
    }
    relativeX.push(curX);
  }

  // Căn giữa theo trục X (X = 0 là tâm ngang)
  const firstLblW = clusters[0].labelWidth ?? (clusters[0].width + 40);
  const firstHalf = Math.max(clusters[0].width, firstLblW) / 2;

  const lastCluster = clusters[clusters.length - 1];
  const lastLblW = lastCluster.labelWidth ?? (lastCluster.width + 40);
  const lastHalf = Math.max(lastCluster.width, lastLblW) / 2;

  const minLineX = relativeX[0] - firstHalf;
  const maxLineX = relativeX[relativeX.length - 1] + lastHalf;
  const lineCenterX = (minLineX + maxLineX) / 2;

  const placed: Cluster2DPlacement[] = [];
  let totalMinX = Infinity,
    totalMaxX = -Infinity,
    totalMinY = Infinity,
    totalMaxY = -Infinity;

  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const maxLabelW = c.width + 40;
    const lblW = c.labelWidth ?? maxLabelW;

    const x = relativeX[i] - lineCenterX;
    const y = 0; // Đáy cụm thẳng hàng tại y = 0

    // Đặt nhãn dưới đáy cụm (tính cả độ trải của lưới isometric và bóng)
    const bottomOffsetY = c.bottomOffsetY ?? 0;
    const labelY = y + bottomOffsetY + labelGapY;

    const minX = Math.min(x - c.width / 2, x - lblW / 2);
    const maxX = Math.max(x + c.width / 2, x + lblW / 2);
    const minY = y - c.height; // Phía trên đỉnh cụm
    const maxY = labelY + 44; // Đáy nhãn 2 dòng

    if (minX < totalMinX) totalMinX = minX;
    if (maxX > totalMaxX) totalMaxX = maxX;
    if (minY < totalMinY) totalMinY = minY;
    if (maxY > totalMaxY) totalMaxY = maxY;

    placed.push({
      id: c.id,
      x,
      y,
      width: c.width,
      height: c.height,
      labelX: x,
      labelY,
      labelWidth: lblW,
      maxLabelWidth: maxLabelW,
      bounds: { minX, maxX, minY, maxY },
    });
  }

  return {
    clusters: placed,
    totalBounds: {
      minX: totalMinX,
      maxX: totalMaxX,
      minY: totalMinY,
      maxY: totalMaxY,
    },
  };
}

export interface StageFitInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface Stage2DFitOptions {
  padding?: number;
  insets?: StageFitInsets;
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Tính toán góc nhìn và zoom fit toàn bộ sân khấu 2D (lấp ~80-85% viewport an toàn)
 * Hỗ trợ insets loại trừ các vùng bị UI che:
 * - Panel Mua sắm (bên phải ~380px trên desktop, bottom-sheet trên mobile)
 * - Khối số dư (phía trên ~135px)
 * - Toast mốc % (góc dưới trái ~90px)
 */
export function calculateStage2DFit(
  totalBounds: { minX: number; maxX: number; minY: number; maxY: number },
  viewportW: number,
  viewportH: number,
  paddingOrOptions: number | Stage2DFitOptions = 1.22
): { targetX: number; targetY: number; zoom: number } {
  let padding = 1.22;
  let insets: StageFitInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  let minZoom = 0.05;
  let maxZoom = 1.6;

  if (typeof paddingOrOptions === 'number') {
    padding = paddingOrOptions;
  } else if (paddingOrOptions) {
    if (paddingOrOptions.padding !== undefined) padding = paddingOrOptions.padding;
    if (paddingOrOptions.insets) insets = paddingOrOptions.insets;
    if (paddingOrOptions.minZoom !== undefined) minZoom = paddingOrOptions.minZoom;
    if (paddingOrOptions.maxZoom !== undefined) maxZoom = paddingOrOptions.maxZoom;
  }

  const topInset = insets.top ?? 0;
  const rightInset = insets.right ?? 0;
  const bottomInset = insets.bottom ?? 0;
  const leftInset = insets.left ?? 0;

  const vpW = Math.max(100, viewportW);
  const vpH = Math.max(100, viewportH);

  // Vùng nhìn thấy an toàn (không bị panel, balance card, toast mốc che)
  const safeW = Math.max(50, vpW - leftInset - rightInset);
  const safeH = Math.max(50, vpH - topInset - bottomInset);

  const spanX = Math.max(50, totalBounds.maxX - totalBounds.minX);
  const spanY = Math.max(50, totalBounds.maxY - totalBounds.minY);

  const scaleX = safeW / (spanX * padding);
  const scaleY = safeH / (spanY * padding);
  let zoom = Math.min(scaleX, scaleY);

  // Kẹp zoom hợp lý (không kẹp cứng ở 0.3 để tránh tràn màn hình khi nhiều cụm lớn)
  zoom = Math.max(minZoom, Math.min(zoom, maxZoom));

  // Tâm vùng an toàn tính từ toạ độ màn hình (0,0 là góc trên trái)
  const safeCenterX = leftInset + safeW / 2;
  const safeCenterY = topInset + safeH / 2;

  // Tâm của toàn bộ canvas/viewport
  const vpCenterX = vpW / 2;
  const vpCenterY = vpH / 2;

  // Độ lệch giữa tâm vùng an toàn và tâm canvas
  const offsetX = safeCenterX - vpCenterX;
  const offsetY = safeCenterY - vpCenterY;

  const boundsCenterX = (totalBounds.minX + totalBounds.maxX) / 2;
  const boundsCenterY = (totalBounds.minY + totalBounds.maxY) / 2;

  // Camera pan (targetX, targetY) sao cho boundsCenterX/Y được chiếu đúng vào safeCenterX/Y
  const targetX = boundsCenterX - offsetX / zoom;
  const targetY = boundsCenterY - offsetY / zoom;

  return { targetX, targetY, zoom };
}

/**
 * Định dạng nhãn 2 dòng cho cụm:
 * Dòng 1: "<số lượng> × <tên>"
 * Dòng 2: "<tổng tiền>"
 */
export function formatClusterLabelLines(
  count: number,
  item: { ten: string; gia: number }
): { line1: string; line2: string; badge: string } {
  const disp = getDisplayCount(count, 1000);
  const countStr = count.toLocaleString('vi-VN');
  const totalCost = count * item.gia;
  const costStr = formatVietnameseCurrency(totalCost, true);
  return {
    line1: `${countStr} × ${item.ten}`,
    line2: costStr,
    badge: disp.label,
  };
}

/**
 * Kiểm tra tính hợp lệ của manifest.json và các file sprite
 */
export function validateManifest(
  manifest: Record<string, any>,
  items: Array<{ id: string }>,
  checkFilesCallback?: (id: string) => { sprite: boolean; shadow: boolean; icon: boolean }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest rỗng hoặc không phải object'] };
  }

  for (const item of items) {
    const entry = manifest[item.id];
    if (!entry) {
      errors.push(`Thiếu entry trong manifest cho vật phẩm: ${item.id}`);
      continue;
    }
    if (typeof entry.w !== 'number' || entry.w <= 0) {
      errors.push(`${item.id}: w không hợp lệ (${entry.w})`);
    }
    if (typeof entry.h !== 'number' || entry.h <= 0) {
      errors.push(`${item.id}: h không hợp lệ (${entry.h})`);
    }
    if (typeof entry.anchorX !== 'number') {
      errors.push(`${item.id}: anchorX không phải số`);
    }
    if (typeof entry.anchorY !== 'number') {
      errors.push(`${item.id}: anchorY không phải số`);
    }
    if (typeof entry.footprintW !== 'number' || entry.footprintW <= 0) {
      errors.push(`${item.id}: footprintW không hợp lệ`);
    }
    if (typeof entry.footprintD !== 'number' || entry.footprintD <= 0) {
      errors.push(`${item.id}: footprintD không hợp lệ`);
    }
    if (entry.scale !== undefined && (typeof entry.scale !== 'number' || entry.scale <= 0)) {
      errors.push(`${item.id}: scale không hợp lệ`);
    }

    if (checkFilesCallback) {
      const files = checkFilesCallback(item.id);
      if (!files.sprite) errors.push(`${item.id}: Thiếu file sprite`);
      if (!files.shadow) errors.push(`${item.id}: Thiếu file shadow`);
      if (!files.icon) errors.push(`${item.id}: Thiếu file icon`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
