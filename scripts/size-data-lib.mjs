// scripts/size-data-lib.mjs
// Các hàm thuần phục vụ xử lý toạ độ địa lý, phép chiếu LAEA, PCA và kiểm tra chủ quyền.
import { geoArea, geoCentroid, geoAzimuthalEqualArea } from 'd3-geo';

// Bán kính Trái Đất chuẩn (km) theo đặc tả WGS84 authalic sphere
export const R = 6371.0088;

/**
 * Tạo slug không dấu chuẩn tiếng Việt từ chuỗi đầu vào.
 * Ví dụ: "Lâm Đồng" -> "lam-dong", "Đà Nẵng" -> "da-nang".
 */
export function slugify(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Tính tâm hình cầu (kinh độ, vĩ độ) của đối tượng GeoJSON bằng d3.geoCentroid.
 * Tự động đảo chiều quay vòng (rewind) nếu polygon bị ngược chiều (enclosing > 2*PI steradians).
 * @param {object} geomOrFeature Đối tượng Feature hoặc Geometry GeoJSON
 * @returns {[number, number]} [lng, lat] toạ độ tâm (độ)
 */
export function centroid(geomOrFeature) {
  const geom0 = geomOrFeature.type === 'Feature' ? geomOrFeature.geometry : geomOrFeature;
  if (geom0.type === 'Polygon' || geom0.type === 'MultiPolygon') return geoCentroid(rewindGeom(geom0));
  const geom = geom0;
  const steradians = geoArea(geom);
  if (steradians > 2 * Math.PI) {
    const reverseRings = (coords) => {
      if (typeof coords[0]?.[0] === 'number') {
        return [...coords].reverse();
      }
      return coords.map(reverseRings);
    };
    const rewoundGeom = {
      type: geom.type,
      coordinates: reverseRings(geom.coordinates),
    };
    return geoCentroid(rewoundGeom);
  }
  return geoCentroid(geomOrFeature);
}

/**
 * Tính diện tích hình cầu (km²) từ đối tượng GeoJSON trên quả cầu bán kính R = 6371.0088 km.
 * Xử lý an toàn chiều quay vòng (winding order) của polygon.
 * @param {object} geomOrFeature
 * @returns {number} Diện tích tính bằng km² (số thực)
 */
export function calcArea(geomOrFeature) {
  const g = rewindGeom(geomOrFeature.type === 'Feature' ? geomOrFeature.geometry : geomOrFeature);
  return geoArea(g) * R * R;
}

/**
 * Sửa chiều vòng TỪNG polygon theo quy ước d3-geo (polygon nào bao > 2π sr thì đảo các vòng của nó).
 * Cần cho dữ liệu sau mapshaper (RFC 7946 ngược chiều d3) và MultiPolygon lẫn chiều.
 */
export function rewindGeom(geom) {
  if (!geom) return geom;
  const fixPoly = (rings) => {
    const sr = geoArea({ type: 'Polygon', coordinates: rings });
    return sr > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;
  };
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: fixPoly(geom.coordinates) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(fixPoly) };
  return geom;
}

export const geoAreaKm2 = calcArea;

/**
 * Diện tích phẳng của một vòng toạ độ (ring) bằng công thức Shoelace (Green's theorem).
 * @param {Array<[number, number]>} ring Mảng các điểm [x, y]
 * @returns {number} Diện tích phẳng
 */
export function planarRingArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) / 2;
}

/**
 * Diện tích phẳng của Polygon (đã trừ các lỗ nếu có).
 * @param {Array<Array<[number, number]>>} polygonCoords Mảng các rings
 * @returns {number}
 */
export function planarPolygonArea(polygonCoords) {
  if (!polygonCoords || polygonCoords.length === 0) return 0;
  let area = planarRingArea(polygonCoords[0]);
  for (let i = 1; i < polygonCoords.length; i++) {
    area -= planarRingArea(polygonCoords[i]);
  }
  return Math.max(0, area);
}

/**
 * Diện tích phẳng của MultiPolygon.
 * @param {Array<Array<Array<[number, number]>>>} multiCoords
 * @returns {number}
 */
export function planarMultiPolygonArea(multiCoords) {
  if (!multiCoords || multiCoords.length === 0) return 0;
  let sum = 0;
  for (const poly of multiCoords) {
    sum += planarPolygonArea(poly);
  }
  return sum;
}

/**
 * Chiếu toạ độ phẳng LAEA (Lambert Azimuthal Equal-Area) với tâm đặt tại centroid:
 * d3.geoAzimuthalEqualArea().rotate([-lng, -lat]).scale(R).translate([0, 0])
 * Đơn vị kết quả là km, trục y hướng nam (y dương xuống dưới như SVG).
 *
 * @param {object} geomOrFeature GeoJSON Geometry hoặc Feature
 * @param {[number, number]} [center] Toạ độ tâm [lng, lat] (nếu không truyền sẽ tự tính centroid)
 * @returns {{ type: string, coordinates: any, bbox: [number, number, number, number], planarArea: number }}
 */
export function project(geomOrFeature, center) {
  const geom = geomOrFeature.type === 'Feature' ? geomOrFeature.geometry : geomOrFeature;
  const [lng, lat] = center || centroid(geom);

  const proj = geoAzimuthalEqualArea()
    .rotate([-lng, -lat])
    .scale(R)
    .translate([0, 0]);

  const projectCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      const p = proj(coords);
      return p ? [p[0], p[1]] : [0, 0];
    }
    return coords.map(projectCoords);
  };

  const projectedCoordinates = projectCoords(geom.coordinates);
  const bbox = calcBBox(projectedCoordinates);
  const planarArea =
    geom.type === 'MultiPolygon'
      ? planarMultiPolygonArea(projectedCoordinates)
      : planarPolygonArea(projectedCoordinates);

  return {
    type: geom.type,
    coordinates: projectedCoordinates,
    bbox,
    planarArea,
  };
}

/**
 * Tính bounding box phẳng [minX, minY, maxX, maxY] từ mảng toạ độ (bất kỳ mức lồng nào).
 */
export function calcBBox(coords) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const traverse = (pt) => {
    if (typeof pt[0] === 'number' && typeof pt[1] === 'number') {
      minX = Math.min(minX, pt[0]);
      maxX = Math.max(maxX, pt[0]);
      minY = Math.min(minY, pt[1]);
      maxY = Math.max(maxY, pt[1]);
    } else {
      for (const item of pt) traverse(item);
    }
  };

  traverse(coords);
  if (minX === Infinity) return [0, 0, 0, 0];
  return [minX, minY, maxX, maxY];
}

/**
 * Phân tích thành phần chính (PCA) trên các đỉnh phẳng của hình học:
 * Trả về chiều dài (len), chiều rộng (wid) theo trục chính và góc xoay (angle) theo độ.
 * len luôn là kích thước dài hơn, wid là kích thước hẹp hơn.
 *
 * @param {Array<[number, number]> | object} verticesOrGeometry
 * @returns {{ len: number, wid: number, angle: number }}
 */
export function pca(verticesOrGeometry) {
  let points = [];
  const extract = (pt) => {
    if (typeof pt[0] === 'number' && typeof pt[1] === 'number') {
      points.push(pt);
    } else if (Array.isArray(pt)) {
      for (const item of pt) extract(item);
    }
  };

  if (Array.isArray(verticesOrGeometry)) {
    extract(verticesOrGeometry);
  } else if (verticesOrGeometry?.coordinates) {
    extract(verticesOrGeometry.coordinates);
  }

  const n = points.length;
  if (n === 0) return { len: 0, wid: 0, angle: 0 };
  if (n === 1) return { len: 0, wid: 0, angle: 0 };

  // 1. Tâm trung bình
  let sx = 0,
    sy = 0;
  for (let i = 0; i < n; i++) {
    sx += points[i][0];
    sy += points[i][1];
  }
  const mx = sx / n;
  const my = sy / n;

  // 2. Hiệp phương sai
  let cxx = 0,
    cyy = 0,
    cxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i][0] - mx;
    const dy = points[i][1] - my;
    cxx += dx * dx;
    cyy += dy * dy;
    cxy += dx * dy;
  }
  cxx /= n;
  cyy /= n;
  cxy /= n;

  // 3. Góc trục chính (hướng phương sai cực đại)
  let theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);

  // 4. Chiếu các đỉnh lên 2 trục vuông góc
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  let minU = Infinity,
    maxU = -Infinity;
  let minV = Infinity,
    maxV = -Infinity;

  for (let i = 0; i < n; i++) {
    const x = points[i][0];
    const y = points[i][1];
    const u = x * cosT + y * sinT;
    const v = -x * sinT + y * cosT;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  let spanU = maxU - minU;
  let spanV = maxV - minV;
  let angleDeg = (theta * 180) / Math.PI;

  let len = spanU;
  let wid = spanV;

  if (wid > len) {
    const tmp = len;
    len = wid;
    wid = tmp;
    angleDeg += 90;
  }

  // Chuẩn hoá góc về khoảng [-90, 90)
  while (angleDeg < -90) angleDeg += 180;
  while (angleDeg >= 90) angleDeg -= 180;

  return {
    len: Math.round(len),
    wid: Math.round(wid),
    angle: Math.round(angleDeg),
  };
}

/**
 * Kiểm tra xem một polygon địa lý có nằm trong vùng tranh chấp Biển Đông cần xoá hay không:
 * - Tâm hộp bao (bounding box) nằm trong: lng 109°E – 119°E và lat 6°N – 18°N
 * - Diện tích mặt cầu < 2.000 km²
 *
 * @param {Array<Array<[number, number]>>} polyCoords
 * @returns {boolean}
 */
export function isSCSPolygon(polyCoords) {
  const ring = polyCoords[0];
  if (!ring || ring.length === 0) return false;

  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const inZone = centerLng >= 109 && centerLng <= 119 && centerLat >= 6 && centerLat <= 18;
  if (!inZone) return false;

  const area = calcArea({ type: 'Polygon', coordinates: polyCoords });
  return area < 2000;
}

/**
 * Bộ lọc chủ quyền Biển Đông (SCS filter):
 * Với các quốc gia / thực thể KHÔNG phải Việt Nam:
 * Xoá mọi polygon có tâm khung trong lng 109–119, lat 6–18 và diện tích < 2.000 km².
 * Giữ nguyên các đảo lớn ngoài vùng hoặc đảo có diện tích >= 2.000 km² (ví dụ: Hải Nam, Palawan).
 * Việt Nam (và các tỉnh của VN) được bảo toàn nguyên vẹn mọi đảo (Hoàng Sa, Trường Sa).
 *
 * @param {object} featureOrGeom Feature hoặc Geometry GeoJSON
 * @param {boolean | { isVietnam?: boolean }} [options] Có phải thực thể Việt Nam không
 * @returns {object} Feature hoặc Geometry đã lọc
 */
export function scsFilter(featureOrGeom, options = false) {
  const isVietnam =
    typeof options === 'boolean'
      ? options
      : Boolean(options?.isVietnam);

  const isFeature = featureOrGeom.type === 'Feature';
  const geom = isFeature ? featureOrGeom.geometry : featureOrGeom;
  const props = isFeature ? featureOrGeom.properties || {} : {};

  const iso = (props.ISO_A3 || props.ADM0_A3 || props.SOV_A3 || props.isoA3 || '').toUpperCase();
  const id = (props.id || '').toLowerCase();
  const name = (props.NAME || props.NAME_EN || props.TinhThanh || '').toLowerCase();

  if (isVietnam || iso === 'VNM' || id === 'viet-nam' || name.includes('vietnam') || name.includes('việt nam')) {
    return featureOrGeom;
  }

  const deletedPolygons = [];

  if (geom.type === 'Polygon') {
    if (isSCSPolygon(geom.coordinates)) {
      deletedPolygons.push(geom.coordinates);
      const emptyGeom = { type: 'Polygon', coordinates: [] };
      return isFeature ? { ...featureOrGeom, geometry: emptyGeom, _deletedPolygons: deletedPolygons } : emptyGeom;
    }
    return featureOrGeom;
  }

  if (geom.type === 'MultiPolygon') {
    const kept = [];
    for (const poly of geom.coordinates) {
      if (isSCSPolygon(poly)) {
        deletedPolygons.push(poly);
      } else {
        kept.push(poly);
      }
    }
    const newGeom = { type: 'MultiPolygon', coordinates: kept };
    if (isFeature) {
      return {
        ...featureOrGeom,
        geometry: newGeom,
        _deletedPolygons: deletedPolygons,
      };
    }
    return newGeom;
  }

  return featureOrGeom;
}

/**
 * Sửa lỗi dữ liệu nguồn Provinces.geojson:
 * Tỉnh Đồng Tháp (vĩ độ < 15) bị ghi nhầm tên là "Lạng Sơn".
 * Tái dùng cùng logic của build-map.mjs.
 */
export function fixProvinceName(f) {
  const name = f.properties?.TinhThanh ?? f.properties?.name;
  const firstCoord =
    f.geometry?.type === 'MultiPolygon'
      ? f.geometry.coordinates?.[0]?.[0]?.[0]
      : f.geometry?.type === 'Polygon'
        ? f.geometry.coordinates?.[0]?.[0]
        : null;
  const lat = firstCoord ? firstCoord[1] : 0;
  return name === 'Lạng Sơn' && lat < 15 ? 'Đồng Tháp' : name;
}

export const nameOf = fixProvinceName;

/**
 * Chuyển đổi mảng toạ độ phẳng km thành chuỗi SVG path (thuộc tính d).
 * Quy tắc làm tròn toạ độ theo đặc tả:
 * - Hình diện tích > 5.000 km²: làm tròn bước 0.5 km.
 * - Hình diện tích <= 5.000 km²: làm tròn bước 0.1 km.
 *
 * @param {Array} coordinates Toạ độ phẳng km của Polygon hoặc MultiPolygon
 * @param {number} area Diện tích km²
 * @returns {string} Chuỗi SVG path d
 */
export function toSvgPath(coordinates, area) {
  const step = area > 5000 ? 0.5 : 0.1;
  const round = (val) => {
    const r = Math.round(val / step) * step;
    return Number(r.toFixed(1));
  };

  const ringsToPath = (rings) => {
    return rings
      .map((ring) => {
        if (!ring || ring.length === 0) return '';
        const pts = ring.map(([x, y]) => `${round(x)} ${round(y)}`);
        return `M${pts.join('L')}Z`;
      })
      .filter(Boolean)
      .join(' ');
  };

  // MultiPolygon: mảng các polygon (mỗi polygon là mảng các ring)
  if (Array.isArray(coordinates[0]?.[0]?.[0])) {
    return coordinates.map(ringsToPath).filter(Boolean).join(' ');
  }
  // Polygon: mảng các ring
  return ringsToPath(coordinates);
}
