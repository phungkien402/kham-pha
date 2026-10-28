// Dữ liệu và hàm thuần xử lý ảnh theo tuần cho bản đồ "đang nở" (bước 32 theo docs/buoc-28-32-mua-hoa.md)

export interface PhotoLike {
  id?: string;
  flower?: string | null;
  place?: string | null;
  status?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  taken_on?: string | null;
  takenOn?: string | null;
  [key: string]: unknown;
}

export interface WeeklyPhotoCounts {
  places: Record<string, number>;
  flowers: Record<string, number>;
}

export function parsePhotoTimestamp(val: unknown): number | undefined {
  if (val === null || val === undefined) return undefined;

  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isNaN(t) ? undefined : t;
  }

  if (typeof val === 'number') {
    return Number.isNaN(val) ? undefined : val;
  }

  if (typeof val !== 'string') return undefined;
  const str = val.trim();
  if (!str) return undefined;

  // 1. Thử qua Date (chuẩn ISO 8601 có giờ, ví dụ "2026-10-28T10:00:00.000Z")
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  // 2. Định dạng YYYY-MM-DD hoặc YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const chk = new Date(timestamp);
    if (chk.getUTCMonth() !== month - 1 || chk.getUTCDate() !== day) return undefined;
    return timestamp;
  }

  // 3. Định dạng DD/MM/YYYY hoặc DD-MM-YYYY
  const vnMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (vnMatch) {
    const day = Number(vnMatch[1]);
    const month = Number(vnMatch[2]);
    const year = Number(vnMatch[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const chk = new Date(timestamp);
    if (chk.getUTCMonth() !== month - 1 || chk.getUTCDate() !== day) return undefined;
    return timestamp;
  }

  // 4. Thử qua Date chung
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) {
    return d.getTime();
  }

  return undefined;
}

/**
 * Kiểm tra xem một ảnh có created_at (hoặc taken_on) trong N ngày gần nhất hay không.
 * Mặc định: N = 7 ngày. Chỉ tính ảnh có status = 'approved' (nếu có trường status).
 */
export function isPhotoInPastDays(
  photo: PhotoLike | null | undefined,
  now: Date | number | string = new Date(),
  days = 7,
): boolean {
  if (!photo || typeof photo !== 'object') return false;
  if (photo.status && photo.status !== 'approved') return false;

  const nowMs =
    now instanceof Date
      ? now.getTime()
      : typeof now === 'number'
        ? now
        : typeof now === 'string'
          ? parsePhotoTimestamp(now) ?? new Date(now).getTime()
          : Date.now();

  if (nowMs === undefined || Number.isNaN(nowMs)) return false;

  const windowMs = Math.max(0, days) * 24 * 60 * 60 * 1000;
  const cutoff = nowMs - windowMs;
  // Cho phép dung sai 24 giờ cho chênh lệch múi giờ hoặc ảnh chụp trong ngày
  const futureTolerance = nowMs + 24 * 60 * 60 * 1000;

  const createdRaw = photo.created_at ?? photo.createdAt;
  const takenRaw = photo.taken_on ?? photo.takenOn;

  const createdTs = parsePhotoTimestamp(createdRaw);
  const takenTs = parsePhotoTimestamp(takenRaw);

  const inWindow = (ts: number | undefined): boolean =>
    ts !== undefined && ts >= cutoff && ts <= futureTolerance;

  return inWindow(createdTs) || inWindow(takenTs);
}

/**
 * Bí danh cho 7 ngày gần nhất
 */
export function isPhotoInPast7Days(
  photo: PhotoLike | null | undefined,
  now?: Date | number | string,
): boolean {
  return isPhotoInPastDays(photo, now, 7);
}

/**
 * Đếm ảnh approved có created_at (hoặc taken_on) trong 7 ngày gần nhất theo địa điểm và loài hoa.
 * Trả về: { places: { [slug]: n }, flowers: { [slug]: n } }
 */
export function countWeeklyPhotos<T extends PhotoLike>(
  photos: T[] | null | undefined,
  now: Date | number | string = new Date(),
  days = 7,
): WeeklyPhotoCounts {
  const places: Record<string, number> = {};
  const flowers: Record<string, number> = {};

  if (!Array.isArray(photos)) {
    return { places, flowers };
  }

  for (const photo of photos) {
    if (!isPhotoInPastDays(photo, now, days)) continue;

    if (photo.flower && typeof photo.flower === 'string') {
      const fl = photo.flower.trim();
      if (fl) {
        flowers[fl] = (flowers[fl] || 0) + 1;
      }
    }

    if (photo.place && typeof photo.place === 'string') {
      const pl = photo.place.trim();
      if (pl) {
        places[pl] = (places[pl] || 0) + 1;
      }
    }
  }

  return { places, flowers };
}

export const tallyWeeklyPhotos = countWeeklyPhotos;
export const countRecentPhotos = countWeeklyPhotos;
export const calculateWeeklyPhotos = countWeeklyPhotos;

/**
 * Định dạng nhãn số lượng ảnh tuần này: "n ảnh tuần này"
 */
export function formatWeeklyPhotoLabel(count: number): string {
  if (!count || count <= 0) return '';
  return `${count} ảnh tuần này`;
}

export const GLOBAL_WEEKLY_CACHE_KEY = '__muaHoaWeeklyPhotosCache';

export function clearWeeklyPhotosCache(): void {
  const g = globalThis as Record<string, unknown>;
  delete g[GLOBAL_WEEKLY_CACHE_KEY];
}

/**
 * Gọi GET /api/anh/tuan đúng 1 lần mỗi trang (dùng chung một Promise đã cache).
 * Lỗi mạng hoặc HTTP error -> trả về { places: {}, flowers: {} } (không hiện gì thêm).
 */
export function fetchWeeklyPhotos(
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<WeeklyPhotoCounts> {
  if (!fetchImpl) {
    return Promise.resolve({ places: {}, flowers: {} });
  }

  const g = globalThis as Record<string, unknown>;
  const cached = g[GLOBAL_WEEKLY_CACHE_KEY] as Promise<WeeklyPhotoCounts> | undefined;
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<WeeklyPhotoCounts> => {
    try {
      const res = await fetchImpl('/api/anh/tuan');
      if (!res.ok) return { places: {}, flowers: {} };
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return { places: {}, flowers: {} };
      const data = await res.json();
      if (!data || typeof data !== 'object') return { places: {}, flowers: {} };

      const places: Record<string, number> = {};
      const flowers: Record<string, number> = {};

      if (data.places && typeof data.places === 'object') {
        for (const [k, v] of Object.entries(data.places)) {
          const num = Number(v);
          if (!Number.isNaN(num) && num > 0) {
            places[k] = num;
          }
        }
      }

      if (data.flowers && typeof data.flowers === 'object') {
        for (const [k, v] of Object.entries(data.flowers)) {
          const num = Number(v);
          if (!Number.isNaN(num) && num > 0) {
            flowers[k] = num;
          }
        }
      }

      return { places, flowers };
    } catch {
      return { places: {}, flowers: {} };
    }
  })();

  g[GLOBAL_WEEKLY_CACHE_KEY] = promise;
  return promise;
}
