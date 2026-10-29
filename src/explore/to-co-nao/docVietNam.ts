// src/explore/to-co-nao/docVietNam.ts
// Các hàm thuần cho bước E: "Bạn nghĩ Việt Nam dài đến mức nào?" (dọc Bắc -> Nam)
import docVnData from './data/doc-vn.json';

export interface StopPoint {
  id: number;
  name: string;
  province: string;
  lat: number;
  lng: number;
  description: string;
  x: number;
  y: number;
  kmFromStart: number;
}

export interface RegionInfo {
  id: string;
  name: string;
  description: string;
  badgeColor: string;
  badgeBg: string;
  bgGradient: string;
}

export interface Milestone {
  km: number;
  comparison: string;
}

export interface JourneyPosition {
  km: number;
  lat: number;
  lng: number;
  x: number;
  y: number;
  segIndex: number;
}

// Bán kính Trái Đất chuẩn (km)
export const EARTH_RADIUS_KM = 6371;

// 15 điểm dừng dọc tuyến hành trình (không bịa thêm số liệu)
export const STOPS: StopPoint[] = docVnData.stops as StopPoint[];

// Mảng khoảng cách tích luỹ (km) dọc tuyến
export const CUMULATIVE_DISTANCES: number[] = docVnData.cumulativeDistances;

// Tổng chiều dài tuyến (km)
export const TOTAL_ROUTE_KM: number = docVnData.totalKm;

// Chiều dài đường chim bay thẳng Lũng Cú – Mũi Cà Mau (km)
export const STRAIGHT_LINE_KM: number = docVnData.straightKm;

// Các mốc so sánh khoảng cách — khoảng cách đường chim bay, làm tròn
export const MILESTONES: readonly Milestone[] = [
  { km: 340, comparison: 'khoảng bằng London → Paris' }, // khoảng cách đường chim bay, làm tròn
  { km: 880, comparison: 'khoảng bằng Paris → Berlin' }, // khoảng cách đường chim bay, làm tròn
  { km: 1070, comparison: 'khoảng bằng Bắc Kinh → Thượng Hải' }, // khoảng cách đường chim bay, làm tròn
  { km: 1430, comparison: 'khoảng bằng London → Rome' }, // khoảng cách đường chim bay, làm tròn
];

// Định nghĩa 5 vùng khí hậu / địa hình dọc tuyến
export const REGIONS: Record<string, RegionInfo> = {
  'mien-bac': {
    id: 'mien-bac',
    name: 'Miền núi phía Bắc & ĐBSH',
    description: 'Miền núi phía Bắc → đồng bằng sông Hồng · khí hậu có mùa đông lạnh',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    bgGradient: 'radial-gradient(circle at 50% 25%, rgba(219, 234, 254, 0.5) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'bac-trung-bo': {
    id: 'bac-trung-bo',
    name: 'Bắc Trung Bộ',
    description: 'Bắc Trung Bộ · dải đất hẹp kẹp giữa Trường Sơn và biển, hay có bão mùa thu',
    badgeColor: '#047857',
    badgeBg: '#ecfdf5',
    bgGradient: 'radial-gradient(circle at 50% 35%, rgba(209, 250, 229, 0.5) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'hai-van': {
    id: 'hai-van',
    name: 'Ranh giới Hải Vân',
    description: 'Ranh giới khí hậu Hải Vân',
    badgeColor: '#b45309',
    badgeBg: '#fffbeb',
    bgGradient: 'radial-gradient(circle at 50% 50%, rgba(254, 243, 199, 0.55) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'nam-trung-bo': {
    id: 'nam-trung-bo',
    name: 'Nam Trung Bộ',
    description: 'Duyên hải Nam Trung Bộ · nắng nhiều, bãi biển dài',
    badgeColor: '#c2410c',
    badgeBg: '#fff7ed',
    bgGradient: 'radial-gradient(circle at 50% 60%, rgba(255, 237, 213, 0.5) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'nam-bo': {
    id: 'nam-bo',
    name: 'Nam Bộ',
    description: 'Nam Bộ · nóng quanh năm, hai mùa mưa – khô; đồng bằng sông Cửu Long',
    badgeColor: '#b91c1c',
    badgeBg: '#fef2f2',
    bgGradient: 'radial-gradient(circle at 50% 70%, rgba(254, 226, 226, 0.5) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
};

/**
 * Tính khoảng cách đại viên (Haversine) giữa 2 toạ độ địa lý (km).
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radius: number = EARTH_RADIUS_KM
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Tính mảng khoảng cách tích luỹ dọc qua danh sách điểm dừng.
 */
export function calculateCumulativeDistances(
  stops: { lat: number; lng: number }[] = STOPS,
  radius: number = EARTH_RADIUS_KM
): number[] {
  const distances: number[] = [0];
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const d = haversine(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng, radius);
    total += d;
    distances.push(total);
  }
  return distances;
}

/**
 * Tính vị trí trên tuyến tương ứng với tiến độ t (0 <= t <= 1).
 * t = 0 -> Điểm cực Bắc (Cột cờ Lũng Cú).
 * t = 1 -> Điểm cực Nam (Mũi Cà Mau).
 */
export function positionAt(t: number): JourneyPosition {
  const clampedT = Math.max(0, Math.min(1, t));
  const cumDists = CUMULATIVE_DISTANCES;
  const totalKm = cumDists[cumDists.length - 1];
  const targetKm = clampedT * totalKm;

  if (clampedT <= 0) {
    const first = STOPS[0];
    return {
      km: 0,
      lat: first.lat,
      lng: first.lng,
      x: first.x,
      y: first.y,
      segIndex: 0,
    };
  }

  if (clampedT >= 1) {
    const last = STOPS[STOPS.length - 1];
    return {
      km: Math.round(totalKm),
      lat: last.lat,
      lng: last.lng,
      x: last.x,
      y: last.y,
      segIndex: STOPS.length - 2,
    };
  }

  // Tìm đoạn chứa targetKm
  let segIndex = 0;
  for (let i = 0; i < cumDists.length - 1; i++) {
    if (targetKm >= cumDists[i] && targetKm <= cumDists[i + 1]) {
      segIndex = i;
      break;
    }
  }

  const p1 = STOPS[segIndex];
  const p2 = STOPS[segIndex + 1];
  const segStartKm = cumDists[segIndex];
  const segEndKm = cumDists[segIndex + 1];
  const segLen = Math.max(segEndKm - segStartKm, 1e-4);
  const ratio = (targetKm - segStartKm) / segLen;

  const lat = p1.lat + (p2.lat - p1.lat) * ratio;
  const lng = p1.lng + (p2.lng - p1.lng) * ratio;
  const x = p1.x + (p2.x - p1.x) * ratio;
  const y = p1.y + (p2.y - p1.y) * ratio;

  return {
    km: Math.round(targetKm),
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    segIndex,
  };
}

/**
 * Tìm điểm dừng gần nhất với toạ độ hoặc khoảng cách đã đi.
 */
export function nearestStop(
  target:
    | number
    | { lat: number; lng: number }
    | { km?: number; lat?: number; lng?: number; x?: number; y?: number },
  optionalLng?: number
): StopPoint {
  if (typeof target === 'number' && typeof optionalLng === 'number') {
    // target là lat, optionalLng là lng
    let minD = Infinity;
    let closest = STOPS[0];
    for (const stop of STOPS) {
      const d = haversine(target, optionalLng, stop.lat, stop.lng);
      if (d < minD) {
        minD = d;
        closest = stop;
      }
    }
    return closest;
  }

  if (typeof target === 'number') {
    // target là km dọc tuyến
    let minDiff = Infinity;
    let closest = STOPS[0];
    for (const stop of STOPS) {
      const diff = Math.abs(stop.kmFromStart - target);
      if (diff < minDiff) {
        minDiff = diff;
        closest = stop;
      }
    }
    return closest;
  }

  if (typeof target === 'object') {
    if (typeof target.lat === 'number' && typeof target.lng === 'number') {
      return nearestStop(target.lat, target.lng);
    }
    if (typeof target.km === 'number') {
      return nearestStop(target.km);
    }
    if (typeof target.x === 'number' && typeof target.y === 'number') {
      let minD = Infinity;
      let closest = STOPS[0];
      for (const stop of STOPS) {
        const d = (stop.x - target.x) ** 2 + (stop.y - target.y) ** 2;
        if (d < minD) {
          minD = d;
          closest = stop;
        }
      }
      return closest;
    }
  }

  return STOPS[0];
}

/**
 * Xác định vùng khí hậu/địa hình theo đoạn (segIndex) hoặc điểm dừng.
 * - Điểm 1–2: Miền núi phía Bắc → đồng bằng sông Hồng
 * - Điểm 3–7: Bắc Trung Bộ
 * - Điểm 8: Ranh giới khí hậu Hải Vân
 * - Điểm 9–12: Duyên hải Nam Trung Bộ
 * - Điểm 13–15: Nam Bộ
 */
export function regionAt(
  param:
    | number
    | { segIndex?: number; stopIndex?: number; id?: number; km?: number }
): RegionInfo {
  let segIndex = 0;

  if (typeof param === 'number') {
    segIndex = Math.max(0, Math.min(STOPS.length - 1, Math.floor(param)));
  } else if (typeof param === 'object') {
    if (typeof param.segIndex === 'number') {
      segIndex = param.segIndex;
    } else if (typeof param.stopIndex === 'number') {
      // Theo điểm dừng (đặc tả): 1–2 Bắc, 3–7 Bắc Trung Bộ, 8 Hải Vân, 9–12 Nam Trung Bộ, 13–15 Nam Bộ
      const s = param.stopIndex + 1;
      if (s <= 2) return REGIONS['mien-bac'];
      if (s <= 7) return REGIONS['bac-trung-bo'];
      if (s === 8) return REGIONS['hai-van'];
      if (s <= 12) return REGIONS['nam-trung-bo'];
      return REGIONS['nam-bo'];
    } else if (typeof param.id === 'number') {
      segIndex = param.id - 1;
    } else if (typeof param.km === 'number') {
      const pos = positionAt(param.km / TOTAL_ROUTE_KM);
      segIndex = pos.segIndex;
    }
  }

  // Đoạn 0 (Điểm 1 -> 2): Lũng Cú đến Hà Nội
  if (segIndex === 0) {
    return REGIONS['mien-bac'];
  }
  // Đoạn 1..5 (Điểm 2 -> 7): Hà Nội qua Tràng An, Thanh Hoá, Vinh, Phong Nha tới Huế
  if (segIndex >= 1 && segIndex <= 5) {
    return REGIONS['bac-trung-bo'];
  }
  // Đoạn 6..7 hoặc Điểm 8 (index 7): Huế tới Hải Vân và qua đèo
  if (segIndex === 6 || segIndex === 7) {
    return REGIONS['hai-van'];
  }
  // Đoạn 8..10 (Điểm 9 -> 12): Hội An, Quy Nhơn, Nha Trang, Phan Thiết
  if (segIndex >= 8 && segIndex <= 10) {
    return REGIONS['nam-trung-bo'];
  }
  // Đoạn 11..14 (Điểm 13 -> 15): TP.HCM, Cần Thơ, Mũi Cà Mau
  return REGIONS['nam-bo'];
}

/**
 * Trả về danh sách mốc so sánh khoảng cách vừa vượt qua từ prevKm đến currentKm.
 * Mỗi mốc trả về duy nhất 1 lần khi vượt qua, theo thứ tự km tăng dần.
 */
export function milestonesCrossed(prevKm: number, currentKm: number): Milestone[] {
  if (currentKm <= prevKm) return [];
  return MILESTONES.filter((m) => prevKm < m.km && currentKm >= m.km);
}

/**
 * Lấy tỉnh hiện tại (dựa vào điểm dừng gần nhất phía trước) và danh sách tỉnh đã đi qua.
 * Khi ở điểm cuối hành trình (isEnd = true hoặc segIndex trỏ tới/vượt quá điểm cuối),
 * vị trí hiện tại là Cà Mau và danh sách đã qua có đủ Cà Mau.
 */
export function getJourneyProvinces(
  segIndex: number,
  isEnd: boolean = false
): {
  currentProvince: string;
  passedProvinces: string[];
} {
  const lastIndex = STOPS.length - 1;
  const isFinal = isEnd || segIndex >= lastIndex;
  const safeIdx = isFinal
    ? lastIndex
    : Math.max(0, Math.min(lastIndex - 1, segIndex));
  const currentProvince = STOPS[safeIdx].province;

  const passed: string[] = [];
  for (let i = 0; i <= safeIdx; i++) {
    const prov = STOPS[i].province;
    if (!passed.includes(prov)) {
      passed.push(prov);
    }
  }

  return { currentProvince, passedProvinces: passed };
}
