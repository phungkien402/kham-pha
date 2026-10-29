// src/explore/to-co-nao/docVietNam.ts
// Các hàm thuần cho bước E3: "Bạn nghĩ Việt Nam dài đến mức nào?" (dọc Bắc -> Nam)
import docVnData from './data/doc-vn.json';
import docVnAnhData from './data/doc-vn-anh.json';

export interface StopPoint {
  id: number;
  name: string;
  province: string;
  lat: number;
  lng: number;
  type: string;
  wikiTitle: string;
  description: string;
  fact: string;
  x: number;
  y: number;
  kmFromStart: number;
}

export interface StopImage {
  src: string;
  w: number;
  h: number;
  tacGia: string;
  giayPhep: string;
  nguon: string;
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
  angleDeg: number;
}

export interface ZoomWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AutoPlayStopSchedule {
  stopIndex: number;
  stopId: number;
  startTravelMs: number;
  arriveMs: number;
  leaveMs: number;
  km: number;
  progress: number;
}

export interface AutoPlaySchedule {
  totalDurationMs: number;
  travelDurationMs: number;
  pauseMs: number;
  stops: AutoPlayStopSchedule[];
}

// Bán kính Trái Đất chuẩn (km)
export const EARTH_RADIUS_KM = 6371;

// 32 điểm dừng dọc tuyến hành trình (không bịa thêm số liệu)
export const STOPS: StopPoint[] = docVnData.stops as StopPoint[];

// Ảnh đại diện của các điểm dừng
export const STOP_IMAGES: Record<string, StopImage> = docVnAnhData as Record<string, StopImage>;

// Mảng khoảng cách tích luỹ (km) dọc tuyến
export const CUMULATIVE_DISTANCES: number[] = docVnData.cumulativeDistances;

// Tổng chiều dài tuyến (km)
export const TOTAL_ROUTE_KM: number = docVnData.totalKm;

// Chiều dài đường chim bay thẳng Lũng Cú – Mũi Cà Mau (km)
export const STRAIGHT_LINE_KM: number = docVnData.straightKm;

// Khung nhìn toàn quốc mặc định (gồm cả Hoàng Sa và Trường Sa)
export const NATIONAL_VIEWBOX: ZoomWindow = {
  x: -460,
  y: -800,
  width: 1740,
  height: 1840,
};

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
    bgGradient: 'radial-gradient(circle at 50% 25%, rgba(219, 234, 254, 0.6) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'bac-trung-bo': {
    id: 'bac-trung-bo',
    name: 'Bắc Trung Bộ',
    description: 'Bắc Trung Bộ · dải đất hẹp kẹp giữa Trường Sơn và biển, hay có bão mùa thu',
    badgeColor: '#047857',
    badgeBg: '#ecfdf5',
    bgGradient: 'radial-gradient(circle at 50% 35%, rgba(209, 250, 229, 0.6) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'hai-van': {
    id: 'hai-van',
    name: 'Ranh giới Hải Vân',
    description: 'Ranh giới khí hậu Hải Vân',
    badgeColor: '#b45309',
    badgeBg: '#fffbeb',
    bgGradient: 'radial-gradient(circle at 50% 50%, rgba(254, 243, 199, 0.65) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'nam-trung-bo': {
    id: 'nam-trung-bo',
    name: 'Nam Trung Bộ',
    description: 'Duyên hải Nam Trung Bộ · nắng nhiều, bãi biển dài',
    badgeColor: '#c2410c',
    badgeBg: '#fff7ed',
    bgGradient: 'radial-gradient(circle at 50% 60%, rgba(255, 237, 213, 0.6) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
  'nam-bo': {
    id: 'nam-bo',
    name: 'Nam Bộ',
    description: 'Nam Bộ · nóng quanh năm, hai mùa mưa – khô; đồng bằng sông Cửu Long',
    badgeColor: '#b91c1c',
    badgeBg: '#fef2f2',
    bgGradient: 'radial-gradient(circle at 50% 70%, rgba(254, 226, 226, 0.6) 0%, rgba(250, 248, 245, 0.95) 70%)',
  },
};

// Toạ độ tâm của 34 tỉnh thành trong hệ chiếu LAEA Việt Nam
export const PROVINCE_CENTERS: Record<string, { name: string; x: number; y: number }> = {
  'an-giang': { name: 'An Giang', x: -154.6, y: 700.2 },
  'bac-ninh': { name: 'Bắc Ninh', x: -2.6, y: -536.6 },
  'ca-mau': { name: 'Cà Mau', x: -138, y: 816.6 },
  'can-tho': { name: 'Cần Thơ', x: -74.7, y: 749.5 },
  'cao-bang': { name: 'Cao Bằng', x: -36.4, y: -695.5 },
  'da-nang': { name: 'Đà Nẵng', x: 177.3, y: 91.4 },
  'dak-lak': { name: 'Đắk Lắk', x: 217.3, y: 395.4 },
  'dien-bien': { name: 'Điện Biên', x: -353.2, y: -583.8 },
  'dong-nai': { name: 'Đồng Nai', x: 65, y: 561.5 },
  'dong-thap': { name: 'Đồng Tháp', x: -84.2, y: 685.0 },
  'gia-lai': { name: 'Gia Lai', x: 216, y: 287.9 },
  'ha-noi': { name: 'Hà Nội', x: -76.9, y: -501.7 },
  'ha-tinh': { name: 'Hà Tĩnh', x: -74.1, y: -200.7 },
  'hai-phong': { name: 'Hải Phòng', x: 7.3, y: -487 },
  'hue': { name: 'Huế', x: 114.4, y: 17 },
  'hung-yen': { name: 'Hưng Yên', x: -17.5, y: -459.2 },
  'khanh-hoa': { name: 'Khánh Hòa', x: 479.7, y: 546.6 },
  'lai-chau': { name: 'Lai Châu', x: -334.9, y: -650.9 },
  'lam-dong': { name: 'Lâm Đồng', x: 166.8, y: 534.7 },
  'lang-son': { name: 'Lạng Sơn', x: 18.7, y: -594.8 },
  'lao-cai': { name: 'Lào Cai', x: -215.6, y: -620.6 },
  'nghe-an': { name: 'Nghệ An', x: -156.8, y: -306.3 },
  'ninh-binh': { name: 'Ninh Bình', x: -40.9, y: -425.6 },
  'phu-tho': { name: 'Phú Thọ', x: -119.8, y: -503.6 },
  'quang-ngai': { name: 'Quảng Ngãi', x: 183.4, y: 190.4 },
  'quang-ninh': { name: 'Quảng Ninh', x: 87.5, y: -529.3 },
  'quang-tri': { name: 'Quảng Trị', x: 9.4, y: -84.1 },
  'son-la': { name: 'Sơn La', x: -245.8, y: -524.8 },
  'tay-ninh': { name: 'Tây Ninh', x: -29.8, y: 604.5 },
  'thai-nguyen': { name: 'Thái Nguyên', x: -63.4, y: -615.4 },
  'thanh-hoa': { name: 'Thanh Hóa', x: -117, y: -395.9 },
  'tp-ho-chi-minh': { name: 'TP. Hồ Chí Minh', x: 44.8, y: 622.6 },
  'tuyen-quang': { name: 'Tuyên Quang', x: -137.7, y: -667.4 },
  'vinh-long': { name: 'Vĩnh Long', x: -16, y: 721.6 },
};

export const PROVINCE_NAME_TO_SLUG: Record<string, string> = {
  'An Giang': 'an-giang',
  'Bắc Ninh': 'bac-ninh',
  'Cà Mau': 'ca-mau',
  'Cần Thơ': 'can-tho',
  'Cao Bằng': 'cao-bang',
  'Đà Nẵng': 'da-nang',
  'Đắk Lắk': 'dak-lak',
  'Điện Biên': 'dien-bien',
  'Đồng Nai': 'dong-nai',
  'Đồng Tháp': 'dong-thap',
  'Gia Lai': 'gia-lai',
  'Hà Nội': 'ha-noi',
  'Hà Tĩnh': 'ha-tinh',
  'Hải Phòng': 'hai-phong',
  'Huế': 'hue',
  'Hưng Yên': 'hung-yen',
  'Khánh Hòa': 'khanh-hoa',
  'Lai Châu': 'lai-chau',
  'Lâm Đồng': 'lam-dong',
  'Lạng Sơn': 'lang-son',
  'Lào Cai': 'lao-cai',
  'Nghệ An': 'nghe-an',
  'Ninh Bình': 'ninh-binh',
  'Phú Thọ': 'phu-tho',
  'Quảng Ngãi': 'quang-ngai',
  'Quảng Ninh': 'quang-ninh',
  'Quảng Trị': 'quang-tri',
  'Sơn La': 'son-la',
  'Tây Ninh': 'tay-ninh',
  'Thái Nguyên': 'thai-nguyen',
  'Thanh Hóa': 'thanh-hoa',
  'TP. Hồ Chí Minh': 'tp-ho-chi-minh',
  'TP.HCM': 'tp-ho-chi-minh',
  'Tuyên Quang': 'tuyen-quang',
  'Vĩnh Long': 'vinh-long',
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
    const second = STOPS[1];
    const angleDeg = Number(
      ((Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI).toFixed(1)
    );
    return {
      km: 0,
      lat: first.lat,
      lng: first.lng,
      x: first.x,
      y: first.y,
      segIndex: 0,
      angleDeg,
    };
  }

  if (clampedT >= 1) {
    const last = STOPS[STOPS.length - 1];
    const prev = STOPS[STOPS.length - 2];
    const angleDeg = Number(
      ((Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI).toFixed(1)
    );
    return {
      km: Math.round(totalKm),
      lat: last.lat,
      lng: last.lng,
      x: last.x,
      y: last.y,
      segIndex: STOPS.length - 2,
      angleDeg,
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

  const angleDeg = Number(
    ((Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI).toFixed(1)
  );

  return {
    km: Math.round(targetKm),
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    segIndex,
    angleDeg,
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
 * Xác định vùng khí hậu/địa hình theo quy tắc đặc tả E3 (32 điểm dừng):
 * - Bắc: Điểm 1–9
 * - Bắc Trung Bộ: Điểm 10–17
 * - Ranh giới Hải Vân: Điểm 18
 * - Nam Trung Bộ: Điểm 19–27
 * - Nam Bộ: Điểm 28–32
 */
export function regionAt(
  param:
    | number
    | { segIndex?: number; stopIndex?: number; id?: number; km?: number }
): RegionInfo {
  let stopNumber = 1;

  if (typeof param === 'number') {
    // Nếu truyền số <= 31: coi là segIndex hoặc stopIndex
    if (param < STOPS.length) {
      stopNumber = Math.max(1, Math.min(32, Math.floor(param) + 1));
    } else {
      // Coi là km
      const p = positionAt(param / TOTAL_ROUTE_KM);
      stopNumber = p.segIndex + 1;
    }
  } else if (typeof param === 'object') {
    if (typeof param.id === 'number') {
      stopNumber = param.id;
    } else if (typeof param.stopIndex === 'number') {
      stopNumber = param.stopIndex + 1;
    } else if (typeof param.segIndex === 'number') {
      stopNumber = param.segIndex + 1;
    } else if (typeof param.km === 'number') {
      const p = positionAt(param.km / TOTAL_ROUTE_KM);
      stopNumber = p.segIndex + 1;
    }
  }

  // 1–9: Miền núi phía Bắc → ĐBSH
  if (stopNumber <= 9) {
    return REGIONS['mien-bac'];
  }
  // 10–17: Bắc Trung Bộ
  if (stopNumber <= 17) {
    return REGIONS['bac-trung-bo'];
  }
  // 18: Hải Vân
  if (stopNumber === 18) {
    return REGIONS['hai-van'];
  }
  // 19–27: Nam Trung Bộ
  if (stopNumber <= 27) {
    return REGIONS['nam-trung-bo'];
  }
  // 28–32: Nam Bộ
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

/**
 * Tính cửa sổ zoom (viewBox SVG) theo vị trí hiện tại:
 * - 0% hoặc >= 99% (hoặc 100%): zoom ra toàn quốc (NATIONAL_VIEWBOX).
 * - Ở giữa hành trình: thu vào cửa sổ rộng ~450 km quanh điểm hiện tại.
 */
export function calculateZoomWindow(
  progress: number,
  currentPos: { x: number; y: number } = STOPS[0]
): ZoomWindow {
  if (progress <= 0 || progress >= 0.99) {
    return { ...NATIONAL_VIEWBOX };
  }

  const zoomWidth = 450;
  // Giữ tỉ lệ xấp xỉ của bản đồ toàn quốc (1840 / 1740 ≈ 1.057)
  const zoomHeight = Math.round(zoomWidth * (NATIONAL_VIEWBOX.height / NATIONAL_VIEWBOX.width));

  const x = Number((currentPos.x - zoomWidth / 2).toFixed(1));
  const y = Number((currentPos.y - zoomHeight / 2).toFixed(1));

  return {
    x,
    y,
    width: zoomWidth,
    height: zoomHeight,
  };
}

/**
 * Lập lịch trình tự động đi (hàm thuần):
 * Tổng hành trình ~60s di chuyển + dừng ~1,5s tại mỗi điểm đến (31 điểm đến).
 */
export function createAutoPlaySchedule(
  stops: StopPoint[] = STOPS,
  travelDurationMs: number = 60000,
  pauseMs: number = 1500
): AutoPlaySchedule {
  const totalKm = stops[stops.length - 1].kmFromStart;
  const scheduleStops: AutoPlayStopSchedule[] = [];

  let currentMs = 0;
  scheduleStops.push({
    stopIndex: 0,
    stopId: stops[0].id,
    startTravelMs: 0,
    arriveMs: 0,
    leaveMs: 0,
    km: 0,
    progress: 0,
  });

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const curr = stops[i];
    const segKm = Math.max(0.1, curr.kmFromStart - prev.kmFromStart);
    const segTravelMs = (segKm / totalKm) * travelDurationMs;

    const startTravelMs = currentMs;
    const arriveMs = startTravelMs + segTravelMs;
    const leaveMs = arriveMs + pauseMs;

    scheduleStops.push({
      stopIndex: i,
      stopId: curr.id,
      startTravelMs,
      arriveMs,
      leaveMs,
      km: curr.kmFromStart,
      progress: Number((curr.kmFromStart / totalKm).toFixed(4)),
    });

    currentMs = leaveMs;
  }

  return {
    totalDurationMs: currentMs,
    travelDurationMs,
    pauseMs,
    stops: scheduleStops,
  };
}

/**
 * Trả về tiến độ và trạng thái tại thời điểm elapsedMs trong chế độ tự đi.
 */
export function getAutoPlayStateAtTime(
  elapsedMs: number,
  schedule: AutoPlaySchedule = createAutoPlaySchedule(),
  reducedMotion: boolean = false
): {
  progress: number;
  currentStopIndex: number;
  isPaused: boolean;
  isFinished: boolean;
} {
  if (elapsedMs <= 0) {
    return {
      progress: 0,
      currentStopIndex: 0,
      isPaused: false,
      isFinished: false,
    };
  }

  if (elapsedMs >= schedule.totalDurationMs) {
    return {
      progress: 1,
      currentStopIndex: schedule.stops.length - 1,
      isPaused: true,
      isFinished: true,
    };
  }

  const stops = schedule.stops;
  for (let i = 1; i < stops.length; i++) {
    const curr = stops[i];
    const prev = stops[i - 1];

    // Đang trên đường đi từ prev -> curr
    if (elapsedMs >= curr.startTravelMs && elapsedMs < curr.arriveMs) {
      if (reducedMotion) {
        // Nhảy từng điểm, không trượt mượt
        return {
          progress: prev.progress,
          currentStopIndex: prev.stopIndex,
          isPaused: false,
          isFinished: false,
        };
      }
      const travelRatio = (elapsedMs - curr.startTravelMs) / (curr.arriveMs - curr.startTravelMs);
      const progress = prev.progress + (curr.progress - prev.progress) * travelRatio;
      return {
        progress: Math.min(1, Math.max(0, progress)),
        currentStopIndex: prev.stopIndex,
        isPaused: false,
        isFinished: false,
      };
    }

    // Đang dừng tại curr
    if (elapsedMs >= curr.arriveMs && elapsedMs < curr.leaveMs) {
      return {
        progress: curr.progress,
        currentStopIndex: curr.stopIndex,
        isPaused: true,
        isFinished: i === stops.length - 1,
      };
    }
  }

  return {
    progress: 1,
    currentStopIndex: stops.length - 1,
    isPaused: true,
    isFinished: true,
  };
}
