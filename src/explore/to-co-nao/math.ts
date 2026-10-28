// src/explore/to-co-nao/math.ts
// Các hàm thuần tính toán toạ độ km ↔ màn hình, bounding box, fitView, so sánh diện tích, scaleBar, URL và kèo.

export interface Viewport {
  cx: number; // km (tâm khung nhìn)
  cy: number; // km
  scale: number; // px trên km (tỉ lệ thu phóng)
}

export interface PlacedShape {
  id: string;
  x: number; // km (toạ độ tâm so với gốc toạ độ)
  y: number; // km
  rotation?: number; // độ xoay (đơn vị độ, dương theo chiều kim đồng hồ)
  goc?: number; // bí danh của rotation
  bbox?: [number, number, number, number]; // [minX, minY, maxX, maxY] cục bộ (km)
}

export interface EntityLike {
  id: string;
  name: string;
  area: number;
  type?: string;
  [key: string]: any;
}

export interface PresetMatch {
  title: string;
  shapes: string[];
}

export const PRESET_MATCHES: PresetMatch[] = [
  { title: 'Lâm Đồng vs Bỉ', shapes: ['lam-dong', 'bel'] },
  { title: 'Việt Nam vs Nhật Bản', shapes: ['viet-nam', 'jpn'] },
  { title: 'TP.HCM vs Singapore', shapes: ['tp-ho-chi-minh', 'sgp'] },
  { title: 'Hà Nội vs Luxembourg', shapes: ['ha-noi', 'lux'] },
  { title: 'Việt Nam vs Ý', shapes: ['viet-nam', 'ita'] },
  { title: 'Nghệ An vs Slovenia', shapes: ['nghe-an', 'svn'] },
];

/**
 * Xoay một điểm (x, y) quanh gốc (0, 0) một góc angleDeg (độ).
 */
export function rotatePoint(x: number, y: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos - y * sin, x * sin + y * cos];
}

/**
 * Chuyển đổi toạ độ km sang toạ độ pixel trên màn hình theo viewport và kích thước khung.
 */
export function kmToScreen(
  km: { x: number; y: number } | [number, number],
  viewport: Viewport,
  width: number,
  height: number
): { x: number; y: number } {
  const kx = Array.isArray(km) ? km[0] : km.x;
  const ky = Array.isArray(km) ? km[1] : km.y;
  return {
    x: width / 2 + (kx - viewport.cx) * viewport.scale,
    y: height / 2 + (ky - viewport.cy) * viewport.scale,
  };
}

/**
 * Chuyển đổi toạ độ pixel trên màn hình sang toạ độ km theo viewport và kích thước khung.
 */
export function screenToKm(
  screen: { x: number; y: number } | [number, number],
  viewport: Viewport,
  width: number,
  height: number
): { x: number; y: number } {
  const sx = Array.isArray(screen) ? screen[0] : screen.x;
  const sy = Array.isArray(screen) ? screen[1] : screen.y;
  return {
    x: viewport.cx + (sx - width / 2) / viewport.scale,
    y: viewport.cy + (sy - height / 2) / viewport.scale,
  };
}

/**
 * Tính bounding box của một hình khi đã đặt ở vị trí (x, y) và xoay góc angleDeg.
 * @param bbox [minX, minY, maxX, maxY] trong toạ độ km cục bộ của hình
 */
export function getRotatedBBox(
  bbox: [number, number, number, number],
  x = 0,
  y = 0,
  angleDeg = 0
): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = bbox;
  const corners: [number, number][] = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];

  let rMinX = Infinity,
    rMinY = Infinity,
    rMaxX = -Infinity,
    rMaxY = -Infinity;

  for (const [cx, cy] of corners) {
    const [rx, ry] = rotatePoint(cx, cy, angleDeg);
    const px = rx + x;
    const py = ry + y;
    rMinX = Math.min(rMinX, px);
    rMaxX = Math.max(rMaxX, px);
    rMinY = Math.min(rMinY, py);
    rMaxY = Math.max(rMaxY, py);
  }

  return [rMinX, rMinY, rMaxX, rMaxY];
}

/**
 * Tính bounding box bao trọn toàn bộ các hình đã đặt trên bàn (có xét vị trí và góc xoay).
 */
export function getShapesBBox(
  shapes: PlacedShape[],
  lookupBBox?: (id: string) => [number, number, number, number] | undefined
): [number, number, number, number] | null {
  if (!shapes || shapes.length === 0) return null;

  let gMinX = Infinity,
    gMinY = Infinity,
    gMaxX = -Infinity,
    gMaxY = -Infinity;

  for (const s of shapes) {
    const localBBox = s.bbox ?? lookupBBox?.(s.id) ?? [-50, -50, 50, 50];
    const rot = s.rotation ?? s.goc ?? 0;
    const [rMinX, rMinY, rMaxX, rMaxY] = getRotatedBBox(localBBox, s.x, s.y, rot);
    gMinX = Math.min(gMinX, rMinX);
    gMinY = Math.min(gMinY, rMinY);
    gMaxX = Math.max(gMaxX, rMaxX);
    gMaxY = Math.max(gMaxY, rMaxY);
  }

  if (gMinX === Infinity) return null;
  return [gMinX, gMinY, gMaxX, gMaxY];
}

/**
 * Tự động cân chỉnh khung nhìn (viewport) để bao trọn tất cả các hình đang có trên bàn,
 * với lề an toàn mặc định là 12% (padding = 0.12).
 */
export function fitView(
  shapes: PlacedShape[],
  width: number,
  height: number,
  padding = 0.12,
  lookupBBox?: (id: string) => [number, number, number, number] | undefined
): Viewport {
  const collectiveBBox = getShapesBBox(shapes, lookupBBox);
  if (!collectiveBBox) {
    return { cx: 0, cy: 0, scale: 1 };
  }

  const [minX, minY, maxX, maxY] = collectiveBBox;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const bw = Math.max(maxX - minX, 1);
  const bh = Math.max(maxY - minY, 1);

  // Khung khả dụng sau khi trừ padding cả 2 bên
  const usableW = Math.max(width * (1 - 2 * padding), 10);
  const usableH = Math.max(height * (1 - 2 * padding), 10);

  const scale = Math.min(usableW / bw, usableH / bh);
  return { cx, cy, scale: Math.max(scale, 1e-4) };
}

/**
 * Định dạng số theo chuẩn tiếng Việt: dấu chấm ngăn cách hàng nghìn, dấu phẩy thập phân.
 * Ví dụ: 1234567 -> "1.234.567", 0.8 -> "0,8", 1234.5 -> "1.234,5".
 */
export function formatNumberVi(val: number, maxDecimals = 1): string {
  if (val == null || !Number.isFinite(val)) return '0';
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const rounded = Number(abs.toFixed(maxDecimals));
  const [intPart, decPart] = rounded.toString().split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const res = decPart && decPart !== '0' ? `${formattedInt},${decPart}` : formattedInt;
  return isNeg ? `-${res}` : res;
}

/**
 * Tính tỉ lệ diện tích: a / b.
 */
export function calcRatio(areaA: number, areaB: number): number {
  if (!areaB || areaB <= 0) return 0;
  return areaA / areaB;
}

export const ratio = calcRatio;

/**
 * Tạo câu so sánh diện tích giữa 2 thực thể theo đặc tả:
 * - "Lâm Đồng ≈ 0,8 lần Bỉ"
 * - Nếu tỉ lệ >= 10 lần: làm tròn số nguyên ("Việt Nam ≈ 10 lần Bỉ")
 * - Nếu tỉ lệ < 0,1: đảo chiều cho dễ đọc ("Bỉ ≈ 12 lần Lâm Đồng")
 * - Định dạng số chuẩn Việt (dấu chấm nghìn, dấu phẩy thập phân).
 */
export function formatComparison(
  itemA: string | { name: string; area: number },
  areaOrItemB: number | { name: string; area: number },
  maybeNameB?: string,
  maybeAreaB?: number
): string {
  let nameA = '';
  let areaA = 0;
  let nameB = '';
  let areaB = 0;

  if (typeof itemA === 'object' && itemA !== null) {
    nameA = itemA.name;
    areaA = itemA.area;
    const bObj = areaOrItemB as { name: string; area: number };
    nameB = bObj.name;
    areaB = bObj.area;
  } else {
    nameA = String(itemA);
    areaA = Number(areaOrItemB);
    nameB = String(maybeNameB ?? '');
    areaB = Number(maybeAreaB ?? 0);
  }

  if (!areaA || !areaB || areaA <= 0 || areaB <= 0) {
    return `${nameA} và ${nameB}`;
  }

  const r = areaA / areaB;

  // Nếu r < 0.1: đảo chiều so sánh
  if (r < 0.1) {
    const invR = areaB / areaA;
    const roundedInv = Math.round(invR);
    return `${nameB} ≈ ${formatNumberVi(roundedInv)} lần ${nameA}`;
  }

  // Nếu r >= 10: làm tròn số nguyên
  if (r >= 10) {
    const roundedR = Math.round(r);
    return `${nameA} ≈ ${formatNumberVi(roundedR)} lần ${nameB}`;
  }

  // 0.1 <= r < 10: làm tròn 1 chữ số thập phân
  const roundedR = Math.round(r * 10) / 10;
  return `${nameA} ≈ ${formatNumberVi(roundedR, 1)} lần ${nameB}`;
}

export const compareAreaText = formatComparison;

export interface ScaleBarResult {
  km: number;
  px: number;
  label: string;
}

/**
 * Chọn nấc thước tỉ lệ thích ứng dạng 1, 2, 5 × 10ⁿ km sao cho chiều dài trên màn hình đạt từ 60 đến 120 px.
 */
export function scaleBar(scale: number): ScaleBarResult {
  if (!scale || scale <= 0) {
    return { km: 100, px: 100, label: '100 km' };
  }

  const targetKm = 85 / scale;
  const power = Math.floor(Math.log10(targetKm));

  const candidates: number[] = [];
  for (let p = power - 1; p <= power + 2; p++) {
    const base = Math.pow(10, p);
    candidates.push(1 * base, 2 * base, 5 * base);
  }

  const valid = candidates
    .map((km) => ({ km, px: km * scale }))
    .filter((c) => c.px >= 60 && c.px <= 120);

  let chosen: { km: number; px: number };

  if (valid.length > 0) {
    valid.sort((a, b) => Math.abs(a.px - 85) - Math.abs(b.px - 85));
    chosen = valid[0];
  } else {
    candidates.sort((a, b) => {
      const distA = Math.min(Math.abs(a * scale - 60), Math.abs(a * scale - 120));
      const distB = Math.min(Math.abs(b * scale - 60), Math.abs(b * scale - 120));
      return distA - distB;
    });
    const bestKm = candidates[0];
    chosen = { km: bestKm, px: bestKm * scale };
  }

  return {
    km: chosen.km,
    px: chosen.px,
    label: `${formatNumberVi(chosen.km)} km`,
  };
}

export interface DecodedState {
  shapes: PlacedShape[];
  zoom?: number;
  scale?: number;
  cx?: number;
  cy?: number;
}

/**
 * Mã hoá trạng thái các hình trên bàn và zoom ra chuỗi tham số URL ?h=id:x:y:goc,...&z=...
 * Toạ độ x, y làm tròn km, góc làm tròn độ nguyên.
 */
export function encodeUrlState(
  shapes: PlacedShape[],
  zoomOrViewport?: number | Viewport
): string {
  const parts = shapes.map((s) => {
    const rx = Math.round(s.x || 0);
    const ry = Math.round(s.y || 0);
    const rot = Math.round(s.rotation ?? s.goc ?? 0);
    return `${s.id}:${rx}:${ry}:${rot}`;
  });

  const params = new URLSearchParams();
  if (parts.length > 0) {
    params.set('h', parts.join(','));
  }

  if (zoomOrViewport != null) {
    if (typeof zoomOrViewport === 'number') {
      params.set('z', zoomOrViewport.toFixed(2));
    } else if (typeof zoomOrViewport === 'object') {
      const zScale = Number(zoomOrViewport.scale.toFixed(4));
      const zCx = Math.round(zoomOrViewport.cx);
      const zCy = Math.round(zoomOrViewport.cy);
      params.set('z', `${zCx}:${zCy}:${zScale}`);
    }
  }

  return params.toString();
}

/**
 * Giải mã URL ?h=id:x:y:goc,...&z=...
 * Bỏ qua các id lạ không tồn tại, bỏ qua các số rác không hợp lệ (NaN).
 */
export function decodeUrlState(
  queryOrUrl: string,
  validIds?: Set<string> | ((id: string) => boolean)
): DecodedState {
  const result: DecodedState = { shapes: [] };
  if (!queryOrUrl) return result;

  let queryString = queryOrUrl;
  const qIdx = queryString.indexOf('?');
  if (qIdx !== -1) {
    queryString = queryString.slice(qIdx + 1);
  }
  const hashIdx = queryString.indexOf('#');
  if (hashIdx !== -1) {
    queryString = queryString.slice(0, hashIdx);
  }

  const params = new URLSearchParams(queryString);
  const hParam = params.get('h');
  const zParam = params.get('z');

  const isValidId = (id: string) => {
    if (!id || typeof id !== 'string') return false;
    if (!validIds) return true;
    if (typeof validIds === 'function') return validIds(id);
    return validIds.has(id);
  };

  if (hParam) {
    const entries = hParam.split(',');
    for (const entry of entries) {
      if (!entry.trim()) continue;
      const [id, xStr, yStr, gocStr] = entry.split(':');
      if (!id || xStr === undefined || yStr === undefined || gocStr === undefined) {
        continue;
      }
      if (!isValidId(id)) {
        continue;
      }
      const x = Number(xStr);
      const y = Number(yStr);
      const goc = Number(gocStr);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(goc)) {
        continue;
      }

      result.shapes.push({
        id,
        x: Math.round(x),
        y: Math.round(y),
        rotation: Math.round(goc),
        goc: Math.round(goc),
      });
    }
  }

  if (zParam) {
    if (zParam.includes(':')) {
      const [cxStr, cyStr, scaleStr] = zParam.split(':');
      const cx = Number(cxStr);
      const cy = Number(cyStr);
      const scale = Number(scaleStr);
      if (!!Number.isFinite(cx) && !!Number.isFinite(cy) && !!Number.isFinite(scale) && scale > 0) {
        result.cx = cx;
        result.cy = cy;
        result.scale = scale;
        result.zoom = scale;
      }
    } else {
      const zoom = Number(zParam);
      if (!!Number.isFinite(zoom) && zoom > 0) {
        result.zoom = zoom;
        result.scale = zoom;
      }
    }
  }

  return result;
}

/**
 * Chọn ngẫu nhiên một cặp so sánh (1 tỉnh VN × 1 quốc gia) có diện tích chênh lệch không quá 3 lần:
 * max(areaP, areaC) / min(areaP, areaC) <= 3.
 */
export function pickRandomMatch(
  provincesOrAll: EntityLike[],
  maybeCountries?: EntityLike[],
  randomFn: () => number = Math.random
): ([EntityLike, EntityLike] & { province: EntityLike; country: EntityLike }) | null {
  let provinces: EntityLike[] = [];
  let countries: EntityLike[] = [];

  if (maybeCountries && maybeCountries.length > 0) {
    provinces = provincesOrAll;
    countries = maybeCountries;
  } else {
    provinces = provincesOrAll.filter((item) => item.type === 'tinh');
    countries = provincesOrAll.filter((item) => item.type === 'nuoc');
  }

  const validPairs: [EntityLike, EntityLike][] = [];

  for (const p of provinces) {
    if (!p.area || p.area <= 0) continue;
    for (const c of countries) {
      if (!c.area || c.area <= 0) continue;
      const maxA = Math.max(p.area, c.area);
      const minA = Math.min(p.area, c.area);
      if (maxA / minA <= 3) {
        validPairs.push([p, c]);
      }
    }
  }

  if (validPairs.length === 0) return null;

  const idx = Math.floor(randomFn() * validPairs.length);
  const safeIdx = Math.min(Math.max(idx, 0), validPairs.length - 1);
  const [chosenP, chosenC] = validPairs[safeIdx];

  const result = [chosenP, chosenC] as [EntityLike, EntityLike] & {
    province: EntityLike;
    country: EntityLike;
  };
  result.province = chosenP;
  result.country = chosenC;
  return result;
}

export const getRandomMatch = pickRandomMatch;
