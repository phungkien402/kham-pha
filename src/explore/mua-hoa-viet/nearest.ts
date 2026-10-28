// Logic "Hôm nay đi đâu?": tìm các điểm ngắm gần nhất có hoa đang nở hôm nay.
// Thuần TypeScript, tái dùng `statusOn` từ `./season` để test bằng vitest.

import { statusOn, type BloomStatus, type MonthDay, type Season, type SeasonFlower } from './season';
import { PROVINCE_COORDS, getProvinceCoords, type ProvinceCoords } from './provinces';
import type { Region } from './types';

export { PROVINCE_COORDS, getProvinceCoords, type ProvinceCoords };

const EARTH_RADIUS_KM = 6371;

export interface NearestInputFlower {
  slug: string;
  name?: string;
  color?: string;
  seasons?: Season[];
  /** Tương thích dữ liệu thô từ flowers.json (trước khi qua zod transform). */
  season?: Season;
  places?: Array<{ slug: string; best?: string | { start: MonthDay; end: MonthDay } } | string>;
}

export interface NearestInputPlace {
  slug: string;
  name: string;
  province: string;
  region?: Region;
  lat?: number | null;
  lng?: number | null;
  maps_url?: string;
  flowers?: Array<{ slug: string; best?: string | { start: MonthDay; end: MonthDay } } | string>;
}

export interface NearestFlowerInfo {
  slug: string;
  name: string;
  color: string;
  status: BloomStatus;
  best: string;
}

export interface NearestPlaceResult {
  slug: string;
  name: string;
  province: string;
  region?: Region;
  lat: number;
  lng: number;
  maps_url?: string;
  /** Khoảng cách Haversine đã làm tròn (km). */
  distanceKm: number;
  /** Bí danh của `distanceKm`. */
  distance: number;
  /** Khoảng cách Haversine chính xác trước khi làm tròn (km). */
  rawDistanceKm: number;
  /** Chuỗi hiển thị khoảng cách, vd "~120 km". */
  distanceLabel: string;
  /** Danh sách các loài đang nở / đỉnh mùa / sắp tàn hôm nay tại điểm này. */
  flowers: NearestFlowerInfo[];
  /** Bí danh của `flowers` (tương thích với `spots[].now` trên trang chính). */
  now: NearestFlowerInfo[];
}

export type DateInput = Date | { year: number; month: number; day: number } | string | number;

/** Tính khoảng cách đường chim bay (km) giữa hai toạ độ WGS84 bằng công thức Haversine. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
}

/** Định dạng khoảng cách làm tròn theo mẫu "~120 km". */
export function formatDistanceKm(km: number): string {
  return `~${Math.round(km)} km`;
}

function toDateObject(date: DateInput | undefined): Date | null {
  if (date === undefined || date === null) return new Date();
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof date === 'string' || typeof date === 'number') {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof date === 'object' &&
    typeof date.year === 'number' &&
    typeof date.month === 'number' &&
    typeof date.day === 'number'
  ) {
    // 12:00 trưa giờ Việt Nam (UTC+7 = 05:00 UTC)
    return new Date(Date.UTC(date.year, date.month - 1, date.day, 5));
  }
  return null;
}

function formatBest(best: string | { start: MonthDay; end: MonthDay } | undefined): string {
  if (!best) return '';
  if (typeof best === 'string') return best;
  return `T${best.start.month} – T${best.end.month}`;
}

function isBloomingStatus(status: BloomStatus): boolean {
  return status === 'dang-no' || status === 'dinh-mua' || status === 'sap-tan';
}

/**
 * Tìm tối đa `n` điểm ngắm gần `(lat, lng)` nhất có ít nhất 1 loài đang nở / đỉnh mùa / sắp tàn
 * vào ngày `date` (tính theo giờ Việt Nam qua `statusOn` trong `season.ts`).
 */
export function nearestBlooming(
  places: readonly NearestInputPlace[],
  flowers: readonly NearestInputFlower[],
  lat: number,
  lng: number,
  date: DateInput = new Date(),
  n = 3,
): NearestPlaceResult[] {
  if (!Array.isArray(places) || !Array.isArray(flowers)) return [];
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return [];
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return [];

  const dateObj = toDateObject(date);
  if (!dateObj) return [];

  // Map các loài đang nở vào ngày `dateObj`
  const bloomingMap = new Map<
    string,
    {
      slug: string;
      name: string;
      color: string;
      status: BloomStatus;
      places?: NearestInputFlower['places'];
    }
  >();

  for (const f of flowers) {
    if (!f || typeof f.slug !== 'string') continue;
    const seasons = Array.isArray(f.seasons)
      ? f.seasons
      : f.season
        ? [f.season]
        : [];
    if (seasons.length === 0) continue;

    const sf: SeasonFlower = { slug: f.slug, seasons };
    const st = statusOn(sf, dateObj);
    if (isBloomingStatus(st)) {
      bloomingMap.set(f.slug, {
        slug: f.slug,
        name: f.name ?? f.slug,
        color: f.color ?? '#D45B7A',
        status: st,
        places: f.places,
      });
    }
  }

  if (bloomingMap.size === 0) return [];

  const matched: Array<{ item: NearestPlaceResult; idx: number }> = [];

  places.forEach((p, idx) => {
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;

    const flowerList: NearestFlowerInfo[] = [];
    const seenSlugs = new Set<string>();

    // 1. Loài gắn trực tiếp trong place.flowers
    for (const pf of p.flowers ?? []) {
      const slug = typeof pf === 'string' ? pf : pf?.slug;
      if (!slug || seenSlugs.has(slug)) continue;
      const bf = bloomingMap.get(slug);
      if (!bf) continue;
      seenSlugs.add(slug);
      const bestFromPlace = typeof pf === 'string' ? '' : formatBest(pf.best);
      flowerList.push({
        slug: bf.slug,
        name: bf.name,
        color: bf.color,
        status: bf.status,
        best: bestFromPlace,
      });
    }

    // 2. Loài gắn chiều ngược từ flower.places (bước 26)
    for (const bf of bloomingMap.values()) {
      if (seenSlugs.has(bf.slug) || !Array.isArray(bf.places)) continue;
      const reverseMatch = bf.places.find((fp) => (typeof fp === 'string' ? fp : fp?.slug) === p.slug);
      if (!reverseMatch) continue;
      seenSlugs.add(bf.slug);
      const bestFromFlower = typeof reverseMatch === 'string' ? '' : formatBest(reverseMatch.best);
      flowerList.push({
        slug: bf.slug,
        name: bf.name,
        color: bf.color,
        status: bf.status,
        best: bestFromFlower,
      });
    }

    if (flowerList.length === 0) return;

    const rawDistanceKm = haversineKm(lat, lng, p.lat, p.lng);
    const distanceKm = Math.round(rawDistanceKm);
    const distanceLabel = formatDistanceKm(rawDistanceKm);

    matched.push({
      idx,
      item: {
        slug: p.slug,
        name: p.name,
        province: p.province,
        region: p.region,
        lat: p.lat,
        lng: p.lng,
        maps_url: p.maps_url,
        distanceKm,
        distance: distanceKm,
        rawDistanceKm,
        distanceLabel,
        flowers: flowerList,
        now: flowerList,
      },
    });
  });

  matched.sort((a, b) => a.item.rawDistanceKm - b.item.rawDistanceKm || a.idx - b.idx);
  return matched.slice(0, Math.floor(n)).map((m) => m.item);
}
