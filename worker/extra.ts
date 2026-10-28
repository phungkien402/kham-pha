import flowersData from '../src/explore/mua-hoa-viet/data/flowers.json';
import placesData from '../src/explore/mua-hoa-viet/data/places.json';
import {
  FLOWER_COLOR_PALETTE,
  PROVINCES_34,
  PROVINCE_TO_REGION,
  REGION_LABELS,
  getRegionForProvince,
  type RegionCode,
} from '../src/explore/mua-hoa-viet/provinces';
import {
  ensureSchema,
  getDb,
  jsonResponse,
  type D1Database,
  type Env,
  type PhotoSource,
  type PhotoStatus,
} from './types';
import {
  VALID_FLOWER_SLUGS,
  getClientIp,
  hashIp,
  verifyTurnstileToken,
} from './upload';

export {
  FLOWER_COLOR_PALETTE,
  PROVINCES_34,
  PROVINCE_TO_REGION,
  REGION_LABELS,
  getRegionForProvince,
  type RegionCode,
};

export const MAX_PUBLIC_FLOWER_SUBMISSIONS_PER_DAY = 5;
export const MAX_PUBLIC_PLACE_SUBMISSIONS_PER_DAY = 5;
export const BUILD_DEBOUNCE_MS = 2 * 60 * 1000; // 2 phút

export const VALID_PLACE_SLUGS: ReadonlySet<string> = new Set(
  (placesData as Array<{ slug: string }>).map((p) => p.slug),
);

export const BASE_FLOWER_COLORS: ReadonlySet<string> = new Set(
  (flowersData as Array<{ color?: string }>)
    .map((f) => f.color?.toUpperCase())
    .filter((c): c is string => Boolean(c)),
);

export interface MonthDay {
  month: number;
  day?: number;
}

export interface FlowerSeason {
  start: MonthDay;
  peak?: MonthDay;
  end: MonthDay;
  note?: string;
}

export interface FlowerExtraData {
  slug: string;
  name: string;
  scientificName: string;
  aka?: string;
  color: string;
  verified: boolean;
  seasons: FlowerSeason[];
  regions: RegionCode[];
  regionLabel: string;
  summary?: string;
  facts?: Array<{ value: string; label: string }>;
  identify?: string[];
  confusedWith?: { name: string; ours: string; theirs: string };
  didYouKnow?: Array<{ title: string; text: string }>;
  dayMoments?: Array<{
    label: string;
    color: string;
    headline: string;
    scene: string;
    tip: string;
  }>;
  quote?: { text: string; author: string; place: string; year: number };
  photos: Array<{
    src?: string;
    alt: string;
    author: string;
    license: string;
    source?: string;
    status: 'approved' | 'pending';
  }>;
  tips?: string[];
  places?: Array<{ slug: string; best: string }>;
}

export interface PlaceExtraData {
  slug: string;
  name: string;
  province: string;
  region: RegionCode;
  lat?: number;
  lng?: number;
  maps_url?: string;
  flowers: Array<{
    slug: string;
    best: string | { start: MonthDay; end: MonthDay };
  }>;
}

export interface ExtraRow {
  slug: string;
  status: PhotoStatus;
  source: PhotoSource;
  data: string;
  submitter: string | null;
  ip_hash: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/**
 * Chuyển chuỗi tiếng Việt có dấu sang slug không dấu, chữ thường, nối bằng gạch ngang.
 * Ví dụ: "Hoa Ban Trắng" -> "hoa-ban-trang"
 */
export function slugifyVietnamese(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function generateUniqueFlowerSlug(
  db: D1Database,
  nameOrSlug: string,
): Promise<string> {
  const base = slugifyVietnamese(nameOrSlug) || 'hoa-moi';
  const taken = new Set<string>(VALID_FLOWER_SLUGS);

  try {
    const { results } = await db
      .prepare(`SELECT slug FROM flowers_extra`)
      .all<{ slug: string }>();
    for (const r of results ?? []) {
      if (r.slug) taken.add(r.slug);
    }
  } catch {
    // Bỏ qua nếu bảng chưa có
  }

  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

export async function generateUniquePlaceSlug(
  db: D1Database,
  nameOrSlug: string,
): Promise<string> {
  const base = slugifyVietnamese(nameOrSlug) || 'dia-diem-moi';
  const taken = new Set<string>(VALID_PLACE_SLUGS);

  try {
    const { results } = await db
      .prepare(`SELECT slug FROM places_extra`)
      .all<{ slug: string }>();
    for (const r of results ?? []) {
      if (r.slug) taken.add(r.slug);
    }
  } catch {
    // Bỏ qua nếu bảng chưa có
  }

  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

export async function isKnownFlowerSlug(
  db: D1Database,
  slug: string | null | undefined,
): Promise<boolean> {
  if (!slug || typeof slug !== 'string') return false;
  const trimmed = slug.trim();
  if (!trimmed) return false;
  if (VALID_FLOWER_SLUGS.has(trimmed)) return true;
  try {
    await ensureSchema(db);
    const row = await db
      .prepare(`SELECT slug FROM flowers_extra WHERE slug = ? AND status = 'approved'`)
      .bind(trimmed)
      .first<{ slug: string }>();
    return Boolean(row?.slug);
  } catch {
    return false;
  }
}

/**
 * Kiểm tra link Google Maps hợp lệ.
 * Chỉ chấp nhận host: google.com/maps, maps.google.*, maps.app.goo.gl, goo.gl/maps (giao thức http/https).
 */
export function isValidGoogleMapsUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  if (host === 'maps.app.goo.gl') {
    return pathname.length > 1;
  }

  if (host === 'goo.gl' || host === 'www.goo.gl') {
    return pathname === '/maps' || pathname.startsWith('/maps/');
  }

  if (/^maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host)) {
    return true;
  }

  if (/^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i.test(host)) {
    return pathname === '/maps' || pathname.startsWith('/maps/');
  }

  return false;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Trích xuất toạ độ (lat, lng) trực tiếp từ chuỗi URL Google Maps.
 * Hỗ trợ các mẫu:
 * - !3d<lat>!4d<lng>
 * - @<lat>,<lng>
 * - ?q=<lat>,<lng> hoặc &q=<lat>,<lng> (kể cả q=loc:lat,lng)
 * - ?ll=<lat>,<lng> / sll= / center= / query=
 */
export function parseCoordsFromMapsUrl(
  rawUrl: string | null | undefined,
): { lat: number; lng: number } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const text = rawUrl.trim();
  if (!text) return null;

  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // Giữ nguyên nếu % không hợp lệ
  }

  // 1. Mẫu !3d<lat>!4d<lng>
  const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    const lat = Number.parseFloat(bangMatch[1]);
    const lng = Number.parseFloat(bangMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Mẫu @<lat>,<lng>
  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number.parseFloat(atMatch[1]);
    const lng = Number.parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. Tham số query q=, ll=, query=, sll=, center=
  try {
    const u = new URL(text);
    for (const key of ['q', 'll', 'query', 'sll', 'center', 'destination', 'daddr']) {
      const val = u.searchParams.get(key);
      if (!val) continue;
      const coordMatch = val.match(/(?:^|loc:)\s*(-?\d+(?:\.\d+)?)\s*,\s*\+?(-?\d+(?:\.\d+)?)/i);
      if (coordMatch) {
        const lat = Number.parseFloat(coordMatch[1]);
        const lng = Number.parseFloat(coordMatch[2]);
        if (isValidLatLng(lat, lng)) return { lat, lng };
      }
    }
  } catch {
    // Bỏ qua nếu chuỗi truyền vào là đoạn text chứ không phải URL đầy đủ
  }

  const queryRegexMatch = decoded.match(
    /[?&](?:q|ll|query|sll|center)=(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*\+?(-?\d+(?:\.\d+)?)/i,
  );
  if (queryRegexMatch) {
    const lat = Number.parseFloat(queryRegexMatch[1]);
    const lng = Number.parseFloat(queryRegexMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

/**
 * Trích xuất toạ độ từ link Google Maps, tự theo dõi redirect nếu là link rút gọn (maps.app.goo.gl / goo.gl/maps).
 */
export async function resolveMapsUrlAndExtractCoords(
  rawUrl: string | null | undefined,
  env?: Env,
  customFetcher?: typeof fetch,
): Promise<{ lat: number; lng: number } | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const direct = parseCoordsFromMapsUrl(rawUrl);
  if (direct) return direct;

  const trimmed = rawUrl.trim();
  if (!isValidGoogleMapsUrl(trimmed)) return null;

  const fetcher = customFetcher ?? env?.MAPS_FETCH ?? env?.FETCH ?? globalThis.fetch;
  if (!fetcher) return null;

  let currentUrl = trimmed;
  for (let hop = 0; hop < 5; hop++) {
    const found = parseCoordsFromMapsUrl(currentUrl);
    if (found) return found;

    let res: Response;
    try {
      res = await fetcher(currentUrl, {
        method: 'GET',
        redirect: 'manual',
      });
    } catch {
      break;
    }

    if (!res) break;

    const loc = res.headers?.get('location') ?? res.headers?.get('Location');
    if (loc) {
      try {
        currentUrl = new URL(loc, currentUrl).toString();
      } catch {
        currentUrl = loc;
      }
      const fromLoc = parseCoordsFromMapsUrl(currentUrl);
      if (fromLoc) return fromLoc;
      continue;
    }

    if (res.url && res.url !== currentUrl) {
      const fromResUrl = parseCoordsFromMapsUrl(res.url);
      if (fromResUrl) return fromResUrl;
    }

    try {
      const bodyText = await res.text();
      if (bodyText) {
        const fromBody = parseCoordsFromMapsUrl(bodyText);
        if (fromBody) return fromBody;
      }
    } catch {
      // Bỏ qua lỗi đọc body
    }

    break;
  }

  return null;
}

export const extractMapsCoords = resolveMapsUrlAndExtractCoords;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function monthDayToDayOfYear(md: MonthDay): number {
  let d = 0;
  for (let m = 1; m < md.month; m++) {
    d += DAYS_IN_MONTH[m - 1];
  }
  return d + (md.day ?? 15);
}

function dayOfYearToMonthDay(doy: number): MonthDay {
  let normalized = ((Math.round(doy) - 1) % 365 + 365) % 365 + 1;
  for (let m = 1; m <= 12; m++) {
    const dim = DAYS_IN_MONTH[m - 1];
    if (normalized <= dim) {
      return { month: m, day: normalized };
    }
    normalized -= dim;
  }
  return { month: 12, day: 15 };
}

/**
 * Tính ngày đỉnh mặc định ở giữa đợt nở nếu người dùng không nhập ngày đỉnh.
 */
export function computeDefaultPeak(start: MonthDay, end: MonthDay): MonthDay {
  const s = monthDayToDayOfYear(start);
  let e = monthDayToDayOfYear(end);
  if (e < s) {
    e += 365;
  }
  const mid = s + Math.floor((e - s) / 2);
  return dayOfYearToMonthDay(mid);
}

/**
 * Chọn màu tự động từ bảng màu dự phòng, ưu tiên màu chưa được dùng bởi loài nào.
 */
export async function pickFlowerColor(db?: D1Database): Promise<string> {
  const used = new Set<string>(BASE_FLOWER_COLORS);
  if (db) {
    try {
      const { results } = await db
        .prepare(`SELECT data FROM flowers_extra`)
        .all<{ data: string }>();
      for (const r of results ?? []) {
        try {
          const parsed = JSON.parse(r.data) as { color?: string };
          if (parsed?.color) used.add(parsed.color.toUpperCase());
        } catch {
          // Bỏ qua JSON lỗi
        }
      }
    } catch {
      // Bỏ qua nếu bảng chưa khởi tạo
    }
  }

  for (const c of FLOWER_COLOR_PALETTE) {
    if (!used.has(c.toUpperCase())) {
      return c;
    }
  }
  return FLOWER_COLOR_PALETTE[used.size % FLOWER_COLOR_PALETTE.length];
}

export interface BuildTriggerResult {
  triggered: boolean;
  configured: boolean;
  debounced?: boolean;
  lastTriggeredAt?: string | null;
  warning?: string;
  error?: string;
}

export function hasBuildTriggerConfig(env: Env): boolean {
  if (env.CF_DEPLOY_HOOK && env.CF_DEPLOY_HOOK.trim().length > 0) {
    return true;
  }
  if (env.CF_BUILD_TOKEN && env.CF_BUILD_TOKEN.trim().length > 0) {
    return true;
  }
  return false;
}

export async function getBuildStatus(env: Env): Promise<{
  configured: boolean;
  lastTriggeredAt: string | null;
  warning?: string;
}> {
  const configured = hasBuildTriggerConfig(env);
  let lastTriggeredAt: string | null = null;
  try {
    const db = getDb(env);
    await ensureSchema(db);
    const row = await db
      .prepare(`SELECT value FROM build_state WHERE key = 'last_build_triggered_at'`)
      .first<{ value: string }>();
    lastTriggeredAt = row?.value ?? null;
  } catch {
    // Bỏ qua
  }
  return {
    configured,
    lastTriggeredAt,
    ...(configured ? {} : { warning: 'Chưa cấu hình build tự động' }),
  };
}

/**
 * Kích hoạt Cloudflare Workers Builds (qua CF_DEPLOY_HOOK hoặc CF_BUILD_TOKEN + CF_ACCOUNT_ID + CF_BUILD_TRIGGER_ID).
 * Mặc định gom (debounce): không gọi quá 1 lần mỗi 2 phút (lưu trong D1).
 * Nếu thiếu secret -> không ném lỗi, trả về configured: false kèm cảnh báo.
 */
export async function triggerBuildIfNeeded(
  env: Env,
  options?: { force?: boolean; now?: number; triggeredAtIso?: string },
): Promise<BuildTriggerResult> {
  const configured = hasBuildTriggerConfig(env);
  if (!configured) {
    return {
      triggered: false,
      configured: false,
      debounced: false,
      warning: 'Chưa cấu hình build tự động',
    };
  }

  const db = getDb(env);
  await ensureSchema(db);

  const nowMs = options?.now ?? Date.now();
  const nowIso = options?.triggeredAtIso ?? new Date(nowMs).toISOString();

  // Không gộp/bỏ qua lệnh build: mỗi lần duyệt đều gọi build để không lần duyệt nào bị bỏ sót.
  // Cloudflare tự xếp hàng các bản build; bản cuối cùng chứa đủ dữ liệu.

  const fetcher = env.BUILD_FETCH ?? env.FETCH ?? globalThis.fetch;

  try {
    await db
      .prepare(
        `INSERT INTO build_state (key, value) VALUES ('last_build_triggered_at', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(nowIso)
      .run();
  } catch {
    // Bỏ qua nếu không lưu được trạng thái
  }

  try {
    const deployHook = env.CF_DEPLOY_HOOK?.trim();
    if (deployHook) {
      const hookUrl = /^https?:\/\//i.test(deployHook)
        ? deployHook
        : `https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/${deployHook}`;
      await fetcher(hookUrl, { method: 'POST' });
    } else {
      const token = env.CF_BUILD_TOKEN!.trim();
      const accountId = env.CF_ACCOUNT_ID?.trim() || 'default-account';
      const triggerId = env.CF_BUILD_TRIGGER_ID?.trim() || 'default-trigger';
      const branch = env.CF_BUILD_BRANCH?.trim() || 'main';
      const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        accountId,
      )}/builds/triggers/${encodeURIComponent(triggerId)}/builds`;

      await fetcher(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch }),
      });
    }

    return {
      triggered: true,
      configured: true,
      debounced: false,
      lastTriggeredAt: nowIso,
    };
  } catch (err) {
    return {
      triggered: false,
      configured: true,
      debounced: false,
      lastTriggeredAt: nowIso,
      error: err instanceof Error ? err.message : 'Lỗi gọi API build Cloudflare',
    };
  }
}

export const triggerCloudflareBuild = triggerBuildIfNeeded;

/**
 * Đọc body từ request (hỗ trợ cả JSON lẫn FormData / urlencoded).
 */
async function parseRequestBody(request: Request): Promise<{
  body: Record<string, unknown>;
  formData: FormData | null;
} | null> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    try {
      const fd = await request.formData();
      const obj: Record<string, unknown> = {};
      for (const [key, val] of fd.entries()) {
        if (typeof val === 'string') {
          if (key in obj) {
            const prev = obj[key];
            obj[key] = Array.isArray(prev) ? [...prev, val] : [prev, val];
          } else {
            obj[key] = val;
          }
        }
      }
      return { body: obj, formData: fd };
    } catch {
      return null;
    }
  }

  try {
    const raw = await request.text();
    if (!raw.trim()) return { body: {}, formData: null };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { body: parsed as Record<string, unknown>, formData: null };
    }
    return null;
  } catch {
    return null;
  }
}

function extractTurnstileFromParsed(
  body: Record<string, unknown>,
  formData: FormData | null,
  request: Request,
): string | null {
  const keys = [
    'cf-turnstile-response',
    'turnstile_token',
    'turnstileToken',
    'turnstile',
    'token',
  ];
  for (const k of keys) {
    const v = formData ? formData.get(k) : body[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
  }
  const h =
    request.headers.get('cf-turnstile-response') ??
    request.headers.get('Cf-Turnstile-Response');
  if (h && h.trim()) return h.trim();
  return null;
}

function tryParseJson<T>(val: unknown): T | unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return val;
    }
  }
  return val;
}

function parseMonthDay(raw: unknown): MonthDay | null {
  const val = tryParseJson(raw);
  if (typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 12) {
    return { month: val };
  }
  if (typeof val === 'string' && val.trim()) {
    const s = val.trim();
    // Hỗ trợ "10", "15/10", "10-15"
    if (/^\d{1,2}$/.test(s)) {
      const m = Number.parseInt(s, 10);
      if (m >= 1 && m <= 12) return { month: m };
    }
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
      const d = Number.parseInt(slashMatch[1], 10);
      const m = Number.parseInt(slashMatch[2], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { month: m, day: d };
    }
  }
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const m = Number(obj.month);
    if (!Number.isInteger(m) || m < 1 || m > 12) return null;
    if (obj.day !== undefined && obj.day !== null && obj.day !== '') {
      const d = Number(obj.day);
      if (!Number.isInteger(d) || d < 1 || d > 31) return null;
      return { month: m, day: d };
    }
    return { month: m };
  }
  return null;
}

function parseSeasonItem(raw: unknown): FlowerSeason | null {
  const val = tryParseJson(raw);
  if (!val || typeof val !== 'object') return null;
  const obj = val as Record<string, unknown>;

  const start =
    parseMonthDay(obj.start) ??
    (obj.start_month || obj.startMonth
      ? parseMonthDay({
          month: obj.start_month ?? obj.startMonth,
          day: obj.start_day ?? obj.startDay,
        })
      : null);
  const end =
    parseMonthDay(obj.end) ??
    (obj.end_month || obj.endMonth
      ? parseMonthDay({
          month: obj.end_month ?? obj.endMonth,
          day: obj.end_day ?? obj.endDay,
        })
      : null);

  if (!start || !end) return null;

  let peak: MonthDay | undefined;
  const rawPeak =
    obj.peak ??
    (obj.peak_month || obj.peakMonth
      ? { month: obj.peak_month ?? obj.peakMonth, day: obj.peak_day ?? obj.peakDay }
      : undefined);

  if (rawPeak !== undefined && rawPeak !== null && rawPeak !== '') {
    const parsedPeak = parseMonthDay(rawPeak);
    if (!parsedPeak) return null;
    peak = parsedPeak;
  } else {
    peak = computeDefaultPeak(start, end);
  }

  const note =
    typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim() : undefined;

  return {
    start,
    peak,
    end,
    ...(note ? { note } : {}),
  };
}

export function parseSeasonsFromBody(body: Record<string, unknown>): FlowerSeason[] | null {
  const rawSeasons = tryParseJson(body.seasons);
  if (Array.isArray(rawSeasons)) {
    if (rawSeasons.length === 0) return null;
    const list: FlowerSeason[] = [];
    for (const item of rawSeasons) {
      const parsed = parseSeasonItem(item);
      if (!parsed) return null;
      list.push(parsed);
    }
    return list.length > 0 ? list : null;
  }

  if (body.season !== undefined && body.season !== null && body.season !== '') {
    const single = parseSeasonItem(body.season);
    return single ? [single] : null;
  }

  if (
    body.start !== undefined ||
    body.start_month !== undefined ||
    body.startMonth !== undefined
  ) {
    const flat = parseSeasonItem(body);
    return flat ? [flat] : null;
  }

  return null;
}

export function parseRegionsFromBody(body: Record<string, unknown>): RegionCode[] | null {
  const raw = tryParseJson(body.regions ?? body.region ?? body.vung ?? body.mien);
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,\s]+/).filter(Boolean)
      : [];

  const valid = new Set<RegionCode>();
  for (const r of items) {
    if (r === 'bac' || r === 'trung' || r === 'nam') {
      valid.add(r);
    }
  }
  return valid.size > 0 ? Array.from(valid) : null;
}

function parseStringArray(raw: unknown): string[] | undefined {
  const val = tryParseJson(raw);
  if (Array.isArray(val)) {
    const list = val
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  }
  if (typeof val === 'string' && val.trim()) {
    const list = val
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

function formatDefaultBestLabel(seasons: FlowerSeason[]): string {
  const s = seasons[0];
  if (!s) return 'Theo mùa';
  if (s.start.month === s.end.month) {
    return `T${s.start.month}`;
  }
  return `T${s.start.month} – T${s.end.month}`;
}

interface ParsedInlinePlace {
  name: string;
  province: string;
  region: RegionCode;
  maps_url?: string;
  lat?: number;
  lng?: number;
  best?: string;
}

interface ParsedPlaceSelection {
  existingPlaces: Array<{ slug: string; best?: string }>;
  newPlaces: ParsedInlinePlace[];
}

async function parseFlowerPlacesSelection(
  body: Record<string, unknown>,
  env: Env,
): Promise<{ ok: true; value: ParsedPlaceSelection } | { ok: false; error: string }> {
  const existingPlaces: Array<{ slug: string; best?: string }> = [];
  const newPlaces: ParsedInlinePlace[] = [];

  const rawCandidates: unknown[] = [];
  for (const key of ['places', 'place', 'place_slugs', 'placeSlugs', 'spots']) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      const parsed = tryParseJson(body[key]);
      if (Array.isArray(parsed)) {
        rawCandidates.push(...parsed);
      } else {
        rawCandidates.push(parsed);
      }
    }
  }

  for (const key of ['new_places', 'newPlaces', 'new_place', 'newPlace']) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      const parsed = tryParseJson(body[key]);
      if (Array.isArray(parsed)) {
        rawCandidates.push(...parsed);
      } else {
        rawCandidates.push(parsed);
      }
    }
  }

  // Trường phẳng tạo địa điểm mới ngay trong form loài
  if (typeof body.new_place_name === 'string' && body.new_place_name.trim()) {
    rawCandidates.push({
      name: body.new_place_name,
      province: body.new_place_province ?? body.province,
      region: body.new_place_region ?? body.place_region,
      maps_url: body.new_place_maps_url ?? body.maps_url,
      best: body.new_place_best,
    });
  }

  for (const item of rawCandidates) {
    if (typeof item === 'string') {
      const s = item.trim();
      if (s) existingPlaces.push({ slug: s });
      continue;
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const slug = typeof obj.slug === 'string' ? obj.slug.trim() : '';
      const name = typeof obj.name === 'string' ? obj.name.trim() : '';
      const best = typeof obj.best === 'string' && obj.best.trim() ? obj.best.trim() : undefined;

      if (slug && !name) {
        existingPlaces.push({ slug, best });
        continue;
      }
      if (slug && (VALID_PLACE_SLUGS.has(slug) || !obj.province)) {
        existingPlaces.push({ slug, best });
        continue;
      }
      if (name) {
        const province =
          typeof obj.province === 'string' ? obj.province.trim() : '';
        const regionRaw =
          (typeof obj.region === 'string' ? obj.region.trim() : '') ||
          getRegionForProvince(province) ||
          '';
        if (!province) {
          return { ok: false, error: 'Địa điểm mới thiếu tên tỉnh/thành' };
        }
        if (regionRaw !== 'bac' && regionRaw !== 'trung' && regionRaw !== 'nam') {
          return { ok: false, error: 'Địa điểm mới thiếu vùng hợp lệ (bac/trung/nam)' };
        }
        const mapsUrlRaw =
          typeof (obj.maps_url ?? obj.mapsUrl) === 'string'
            ? String(obj.maps_url ?? obj.mapsUrl).trim()
            : '';
        let lat: number | undefined;
        let lng: number | undefined;
        if (mapsUrlRaw) {
          if (!isValidGoogleMapsUrl(mapsUrlRaw)) {
            return { ok: false, error: 'Link Google Maps của địa điểm không hợp lệ' };
          }
          const coords = await resolveMapsUrlAndExtractCoords(mapsUrlRaw, env);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }
        if (typeof obj.lat === 'number' && typeof obj.lng === 'number' && isValidLatLng(obj.lat, obj.lng)) {
          lat = obj.lat;
          lng = obj.lng;
        }
        newPlaces.push({
          name,
          province,
          region: regionRaw,
          ...(mapsUrlRaw ? { maps_url: mapsUrlRaw } : {}),
          ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
          ...(best ? { best } : {}),
        });
      }
    }
  }

  if (existingPlaces.length === 0 && newPlaces.length === 0) {
    return {
      ok: false,
      error: 'Cần chọn ít nhất 1 địa điểm có sẵn hoặc tạo địa điểm mới',
    };
  }

  return { ok: true, value: { existingPlaces, newPlaces } };
}

function buildDefaultRegionLabel(
  explicitLabel: string | undefined,
  existingPlaceSlugs: string[],
  newPlaces: ParsedInlinePlace[],
  regions: RegionCode[],
): string {
  if (explicitLabel && explicitLabel.trim()) {
    return explicitLabel.trim();
  }
  const baseMap = new Map(
    (placesData as Array<{ slug: string; name: string; province: string }>).map((p) => [
      p.slug,
      `${p.name} (${p.province})`,
    ]),
  );
  const parts: string[] = [];
  for (const slug of existingPlaceSlugs) {
    parts.push(baseMap.get(slug) ?? slug);
  }
  for (const np of newPlaces) {
    parts.push(`${np.name} (${np.province})`);
  }
  if (parts.length > 0) {
    return parts.slice(0, 3).join(', ');
  }
  return regions.map((r) => REGION_LABELS[r]).join(', ');
}

export async function buildAndValidateFlowerPayload(
  body: Record<string, unknown>,
  env: Env,
  db: D1Database,
  options: { isAdmin: boolean; existingSlug?: string; existingData?: FlowerExtraData },
): Promise<
  | {
      ok: true;
      slug: string;
      flowerData: FlowerExtraData;
      createdPlaces: PlaceExtraData[];
      submitter: string | null;
    }
  | { ok: false; error: string }
> {
  const nameRaw =
    typeof (body.name ?? body.ten) === 'string'
      ? String(body.name ?? body.ten).trim()
      : options.existingData?.name ?? '';
  if (!nameRaw) {
    return { ok: false, error: 'Thiếu tên tiếng Việt của loài hoa' };
  }

  const seasons = parseSeasonsFromBody(body) ?? options.existingData?.seasons ?? null;
  if (!seasons || seasons.length === 0) {
    return { ok: false, error: 'Cần ít nhất 1 đợt nở hợp lệ (tháng bắt đầu và kết thúc)' };
  }

  const regions = parseRegionsFromBody(body) ?? options.existingData?.regions ?? null;
  if (!regions || regions.length === 0) {
    return { ok: false, error: 'Cần chọn ít nhất 1 vùng (bac, trung, nam)' };
  }

  let placeSelection: ParsedPlaceSelection;
  const parsedPlaces = await parseFlowerPlacesSelection(body, env);
  if (parsedPlaces.ok) {
    placeSelection = parsedPlaces.value;
  } else if (options.existingData?.places && options.existingData.places.length > 0) {
    placeSelection = {
      existingPlaces: options.existingData.places,
      newPlaces: [],
    };
  } else {
    return parsedPlaces;
  }

  const slug =
    options.existingSlug ?? (await generateUniqueFlowerSlug(db, nameRaw));

  const defaultBest = formatDefaultBestLabel(seasons);
  const createdPlaces: PlaceExtraData[] = [];
  const linkedPlaces: Array<{ slug: string; best: string }> = [];

  for (const ep of placeSelection.existingPlaces) {
    linkedPlaces.push({
      slug: ep.slug,
      best: ep.best || defaultBest,
    });
  }

  for (const np of placeSelection.newPlaces) {
    const placeSlug = await generateUniquePlaceSlug(db, np.name);
    const bestLabel = np.best || defaultBest;
    const placeData: PlaceExtraData = {
      slug: placeSlug,
      name: np.name,
      province: np.province,
      region: np.region,
      ...(np.lat !== undefined && np.lng !== undefined ? { lat: np.lat, lng: np.lng } : {}),
      ...(np.maps_url ? { maps_url: np.maps_url } : {}),
      flowers: [{ slug, best: bestLabel }],
    };
    createdPlaces.push(placeData);
    linkedPlaces.push({ slug: placeSlug, best: bestLabel });
  }

  const colorRaw =
    typeof body.color === 'string' && body.color.trim()
      ? body.color.trim()
      : options.existingData?.color ?? '';
  let color: string;
  if (colorRaw) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(colorRaw)) {
      return { ok: false, error: 'Mã màu không hợp lệ (cần dạng #RRGGBB)' };
    }
    color = colorRaw;
  } else {
    color = await pickFlowerColor(db);
  }

  const scientificName =
    typeof (body.scientificName ?? body.scientific_name) === 'string'
      ? String(body.scientificName ?? body.scientific_name).trim()
      : options.existingData?.scientificName ?? '';

  const aka =
    typeof body.aka === 'string' && body.aka.trim()
      ? body.aka.trim()
      : options.existingData?.aka;

  const summary =
    typeof body.summary === 'string' && body.summary.trim()
      ? body.summary.trim()
      : options.existingData?.summary;

  const explicitRegionLabel =
    typeof (body.regionLabel ?? body.region_label) === 'string'
      ? String(body.regionLabel ?? body.region_label)
      : options.existingData?.regionLabel;

  const regionLabel = buildDefaultRegionLabel(
    explicitRegionLabel,
    placeSelection.existingPlaces.map((p) => p.slug),
    placeSelection.newPlaces,
    regions,
  );

  const identify = parseStringArray(body.identify) ?? options.existingData?.identify;
  const tips = parseStringArray(body.tips) ?? options.existingData?.tips;

  let facts = options.existingData?.facts;
  const rawFacts = tryParseJson(body.facts);
  if (Array.isArray(rawFacts)) {
    const parsedFacts = rawFacts
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
      .map((x) => ({
        value: typeof x.value === 'string' ? x.value.trim() : '',
        label: typeof x.label === 'string' ? x.label.trim() : '',
      }))
      .filter((x) => x.value && x.label);
    facts = parsedFacts.length > 0 ? parsedFacts : undefined;
  }

  let confusedWith = options.existingData?.confusedWith;
  const rawConfused = tryParseJson(body.confusedWith ?? body.confused_with);
  if (rawConfused && typeof rawConfused === 'object' && !Array.isArray(rawConfused)) {
    const c = rawConfused as Record<string, unknown>;
    const cName = typeof c.name === 'string' ? c.name.trim() : '';
    const cOurs = typeof c.ours === 'string' ? c.ours.trim() : '';
    const cTheirs = typeof c.theirs === 'string' ? c.theirs.trim() : '';
    if (cName && cOurs && cTheirs) {
      confusedWith = { name: cName, ours: cOurs, theirs: cTheirs };
    }
  }

  let didYouKnow = options.existingData?.didYouKnow;
  const rawDidYouKnow = tryParseJson(body.didYouKnow ?? body.did_you_know);
  if (Array.isArray(rawDidYouKnow)) {
    const parsedDyk = rawDidYouKnow
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
      .map((x) => ({
        title: typeof x.title === 'string' ? x.title.trim() : '',
        text: typeof x.text === 'string' ? x.text.trim() : '',
      }))
      .filter((x) => x.title && x.text);
    didYouKnow = parsedDyk.length > 0 ? parsedDyk : undefined;
  }

  let dayMoments = options.existingData?.dayMoments;
  const rawMoments = tryParseJson(body.dayMoments ?? body.day_moments);
  if (Array.isArray(rawMoments)) {
    const parsedMoments = rawMoments
      .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
      .map((x) => ({
        label: typeof x.label === 'string' ? x.label.trim() : '',
        color:
          typeof x.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(x.color.trim())
            ? x.color.trim()
            : '#F7DC7A',
        headline: typeof x.headline === 'string' ? x.headline.trim() : '',
        scene: typeof x.scene === 'string' ? x.scene.trim() : '',
        tip: typeof x.tip === 'string' ? x.tip.trim() : '',
      }))
      .filter((x) => x.label && x.headline && x.scene);
    dayMoments = parsedMoments.length > 0 ? parsedMoments : undefined;
  }

  let quote = options.existingData?.quote;
  const rawQuote = tryParseJson(body.quote);
  if (rawQuote && typeof rawQuote === 'object' && !Array.isArray(rawQuote)) {
    const q = rawQuote as Record<string, unknown>;
    const text = typeof q.text === 'string' ? q.text.trim() : '';
    const author = typeof q.author === 'string' ? q.author.trim() : '';
    const place = typeof q.place === 'string' ? q.place.trim() : '';
    const year = Number(q.year) || new Date().getFullYear();
    if (text && author && place) {
      quote = { text, author, place, year };
    }
  }

  let photos = options.existingData?.photos;
  const rawPhotos = tryParseJson(body.photos);
  if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
    photos = rawPhotos as FlowerExtraData['photos'];
  }
  if (!photos || photos.length === 0) {
    photos = [
      {
        alt: `Hoa ${nameRaw.toLowerCase()} (ảnh giữ chỗ)`,
        author: 'Chưa có',
        license: 'Chưa có',
        status: 'pending',
      },
    ];
  }

  const verified =
    body.verified !== undefined
      ? Boolean(body.verified === true || body.verified === 'true' || body.verified === '1')
      : options.existingData?.verified ?? options.isAdmin;

  const submitter =
    typeof (body.submitter ?? body.author ?? body.display_name) === 'string' &&
    String(body.submitter ?? body.author ?? body.display_name).trim()
      ? String(body.submitter ?? body.author ?? body.display_name).trim()
      : null;

  const flowerData: FlowerExtraData = {
    slug,
    name: nameRaw,
    scientificName,
    ...(aka ? { aka } : {}),
    color,
    verified,
    seasons,
    regions,
    regionLabel,
    ...(summary ? { summary } : {}),
    ...(facts ? { facts } : {}),
    ...(identify ? { identify } : {}),
    ...(confusedWith ? { confusedWith } : {}),
    ...(didYouKnow ? { didYouKnow } : {}),
    ...(dayMoments ? { dayMoments } : {}),
    ...(quote ? { quote } : {}),
    photos,
    ...(tips ? { tips } : {}),
    places: linkedPlaces,
  };

  return {
    ok: true,
    slug,
    flowerData,
    createdPlaces,
    submitter,
  };
}

export async function buildAndValidatePlacePayload(
  body: Record<string, unknown>,
  env: Env,
  db: D1Database,
  options: { existingSlug?: string; existingData?: PlaceExtraData },
): Promise<
  | {
      ok: true;
      slug: string;
      placeData: PlaceExtraData;
      submitter: string | null;
    }
  | { ok: false; error: string }
> {
  const nameRaw =
    typeof (body.name ?? body.ten) === 'string'
      ? String(body.name ?? body.ten).trim()
      : options.existingData?.name ?? '';
  if (!nameRaw) {
    return { ok: false, error: 'Thiếu tên địa điểm' };
  }

  const provinceRaw =
    typeof (body.province ?? body.tinh) === 'string'
      ? String(body.province ?? body.tinh).trim()
      : options.existingData?.province ?? '';
  if (!provinceRaw) {
    return { ok: false, error: 'Thiếu tên tỉnh/thành' };
  }

  const regionInput =
    typeof (body.region ?? body.vung ?? body.mien) === 'string'
      ? String(body.region ?? body.vung ?? body.mien).trim()
      : options.existingData?.region ?? '';
  if (regionInput !== 'bac' && regionInput !== 'trung' && regionInput !== 'nam') {
    return { ok: false, error: 'Thiếu vùng hợp lệ (bac, trung, nam)' };
  }
  const region: RegionCode = regionInput;

  const hasMapsUrlKey =
    'maps_url' in body ||
    'mapsUrl' in body ||
    'google_maps_url' in body ||
    'map_url' in body ||
    'link_maps' in body;

  const rawMapsUrlVal =
    body.maps_url ??
    body.mapsUrl ??
    body.google_maps_url ??
    body.map_url ??
    body.link_maps;

  const mapsUrlRaw =
    typeof rawMapsUrlVal === 'string'
      ? rawMapsUrlVal.trim()
      : !hasMapsUrlKey
        ? (options.existingData?.maps_url ?? '')
        : '';

  let extractedCoords: { lat: number; lng: number } | null = null;
  if (mapsUrlRaw) {
    if (!isValidGoogleMapsUrl(mapsUrlRaw)) {
      return {
        ok: false,
        error:
          'Link Google Maps không hợp lệ (chỉ chấp nhận google.com/maps, maps.google.*, maps.app.goo.gl, goo.gl/maps)',
      };
    }
    extractedCoords = await resolveMapsUrlAndExtractCoords(mapsUrlRaw, env);
  }

  let lat: number | undefined = options.existingData?.lat;
  let lng: number | undefined = options.existingData?.lng;

  if (extractedCoords) {
    lat = extractedCoords.lat;
    lng = extractedCoords.lng;
  }

  if ('lat' in body || 'lng' in body) {
    const rawLat = body.lat;
    const rawLng = body.lng;
    if (
      (rawLat === null || rawLat === '') &&
      (rawLng === null || rawLng === '')
    ) {
      if (!extractedCoords) {
        lat = undefined;
        lng = undefined;
      }
    } else if (rawLat !== undefined && rawLng !== undefined && rawLat !== '' && rawLng !== '') {
      const parsedLat = Number(rawLat);
      const parsedLng = Number(rawLng);
      if (!isValidLatLng(parsedLat, parsedLng)) {
        return { ok: false, error: 'Toạ độ lat/lng không hợp lệ' };
      }
      lat = parsedLat;
      lng = parsedLng;
    }
  }

  // Danh sách loài hoa nở ở địa điểm này
  const flowersList: Array<{ slug: string; best: string | { start: MonthDay; end: MonthDay } }> = [];
  const rawFlowers = tryParseJson(body.flowers ?? body.flower ?? body.flower_slugs ?? body.flowerSlugs);
  const defaultBest =
    typeof body.best === 'string' && body.best.trim() ? body.best.trim() : 'Theo mùa';

  if (Array.isArray(rawFlowers)) {
    for (const item of rawFlowers) {
      if (typeof item === 'string' && item.trim()) {
        flowersList.push({ slug: item.trim(), best: defaultBest });
      } else if (item && typeof item === 'object') {
        const fo = item as Record<string, unknown>;
        const fSlug = typeof fo.slug === 'string' ? fo.slug.trim() : '';
        if (fSlug) {
          const fBest =
            typeof fo.best === 'string' && fo.best.trim()
              ? fo.best.trim()
              : fo.best && typeof fo.best === 'object'
                ? (fo.best as { start: MonthDay; end: MonthDay })
                : defaultBest;
          flowersList.push({ slug: fSlug, best: fBest });
        }
      }
    }
  } else if (typeof rawFlowers === 'string' && rawFlowers.trim()) {
    for (const part of rawFlowers.split(',').map((s) => s.trim()).filter(Boolean)) {
      flowersList.push({ slug: part, best: defaultBest });
    }
  } else if (options.existingData?.flowers) {
    flowersList.push(...options.existingData.flowers);
  }

  const slug =
    options.existingSlug ?? (await generateUniquePlaceSlug(db, nameRaw));

  const submitter =
    typeof (body.submitter ?? body.author ?? body.display_name) === 'string' &&
    String(body.submitter ?? body.author ?? body.display_name).trim()
      ? String(body.submitter ?? body.author ?? body.display_name).trim()
      : null;

  const placeData: PlaceExtraData = {
    slug,
    name: nameRaw,
    province: provinceRaw,
    region,
    ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    ...(mapsUrlRaw ? { maps_url: mapsUrlRaw } : {}),
    flowers: flowersList,
  };

  return {
    ok: true,
    slug,
    placeData,
    submitter,
  };
}

/**
 * GET /api/du-lieu -> { flowers: [...approved data], places: [...approved data] } (no-cache)
 */
export async function handleGetPublicData(_request: Request, env: Env): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  const [flowersRes, placesRes] = await Promise.all([
    db
      .prepare(
        `SELECT slug, data FROM flowers_extra WHERE status = 'approved' ORDER BY created_at ASC`,
      )
      .all<{ slug: string; data: string }>(),
    db
      .prepare(
        `SELECT slug, data FROM places_extra WHERE status = 'approved' ORDER BY created_at ASC`,
      )
      .all<{ slug: string; data: string }>(),
  ]);

  const flowers: FlowerExtraData[] = [];
  for (const r of flowersRes.results ?? []) {
    try {
      const parsed = JSON.parse(r.data) as FlowerExtraData;
      if (parsed && typeof parsed === 'object') {
        flowers.push({ ...parsed, slug: parsed.slug || r.slug });
      }
    } catch {
      // Bỏ qua JSON lỗi
    }
  }

  const places: PlaceExtraData[] = [];
  for (const r of placesRes.results ?? []) {
    try {
      const parsed = JSON.parse(r.data) as PlaceExtraData;
      if (parsed && typeof parsed === 'object') {
        places.push({ ...parsed, slug: parsed.slug || r.slug });
      }
    } catch {
      // Bỏ qua JSON lỗi
    }
  }

  const seasonOverrides: Array<{
    slug: string;
    year: number;
    start?: unknown;
    peak?: unknown;
    end?: unknown;
    note?: string | null;
    sources?: unknown[];
    source_url?: string | null;
  }> = [];

  try {
    const overridesRes = await db
      .prepare(
        `SELECT slug, year, start, peak, end, note, sources FROM season_overrides ORDER BY year DESC, slug ASC`,
      )
      .all<{
        slug: string;
        year: number;
        start: string | null;
        peak: string | null;
        end: string | null;
        note: string | null;
        sources: string | null;
      }>();

    for (const r of overridesRes.results ?? []) {
      let start: unknown = r.start;
      let peak: unknown = r.peak;
      let end: unknown = r.end;
      let sources: unknown = r.sources;
      try {
        if (typeof start === 'string' && (start.startsWith('{') || start.startsWith('['))) {
          start = JSON.parse(start);
        }
      } catch {}
      try {
        if (typeof peak === 'string' && (peak.startsWith('{') || peak.startsWith('['))) {
          peak = JSON.parse(peak);
        }
      } catch {}
      try {
        if (typeof end === 'string' && (end.startsWith('{') || end.startsWith('['))) {
          end = JSON.parse(end);
        }
      } catch {}
      try {
        if (typeof sources === 'string' && (sources.startsWith('[') || sources.startsWith('{'))) {
          sources = JSON.parse(sources);
        }
      } catch {}

      let sourceUrl: string | null = null;
      if (Array.isArray(sources) && sources.length > 0) {
        const first = sources[0];
        if (typeof first === 'string') {
          sourceUrl = first;
        } else if (first && typeof first === 'object' && typeof (first as { url?: string }).url === 'string') {
          sourceUrl = (first as { url: string }).url;
        }
      }

      seasonOverrides.push({
        slug: r.slug,
        year: Number(r.year),
        ...(start !== null && start !== undefined ? { start } : {}),
        ...(peak !== null && peak !== undefined ? { peak } : {}),
        ...(end !== null && end !== undefined ? { end } : {}),
        note: r.note ?? null,
        sources: Array.isArray(sources) ? sources : [],
        source_url: sourceUrl,
      });
    }
  } catch {
    // Bỏ qua nếu bảng season_overrides chưa có trong môi trường test
  }

  return jsonResponse(
    { flowers, places, seasonOverrides },
    200,
    { 'Cache-Control': 'no-cache' },
  );
}

/**
 * POST /api/them-hoa (khách gửi loài hoa mới, chờ duyệt)
 */
export async function handlePublicSubmitFlower(
  request: Request,
  env: Env,
): Promise<Response> {
  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return jsonResponse({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
  }
  const { body, formData } = parsed;

  // 1. Kiểm tra Turnstile
  const turnstileToken = extractTurnstileFromParsed(body, formData, request);
  if (!turnstileToken) {
    return jsonResponse({ error: 'Thiếu mã xác thực Turnstile' }, 400);
  }
  const turnstileOk = await verifyTurnstileToken(turnstileToken, request, env);
  if (!turnstileOk) {
    return jsonResponse({ error: 'Xác thực Turnstile không hợp lệ' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  // 2. Kiểm tra dữ liệu bắt buộc trước khi ghi
  const validated = await buildAndValidateFlowerPayload(body, env, db, {
    isAdmin: false,
  });
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  // 3. Giới hạn 5 lần/ngày/IP
  const clientIp = getClientIp(request);
  const ipHash = await hashIp(clientIp, env.IP_SALT ?? '');
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM flowers_extra WHERE ip_hash = ? AND created_at >= ?`,
    )
    .bind(ipHash, sinceIso)
    .first<{ cnt: number }>();

  if (Number(countRow?.cnt ?? 0) >= MAX_PUBLIC_FLOWER_SUBMISSIONS_PER_DAY) {
    return jsonResponse(
      { error: 'Bạn đã gửi quá giới hạn 5 loài hoa trong ngày. Vui lòng thử lại sau.' },
      429,
    );
  }

  const nowIso = new Date().toISOString();
  const { slug, flowerData, createdPlaces, submitter } = validated;

  for (const placeData of createdPlaces) {
    await db
      .prepare(
        `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
         VALUES (?, 'pending', 'public', ?, ?, ?, ?, NULL)`,
      )
      .bind(placeData.slug, JSON.stringify(placeData), submitter, ipHash, nowIso)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO flowers_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
       VALUES (?, 'pending', 'public', ?, ?, ?, ?, NULL)`,
    )
    .bind(slug, JSON.stringify(flowerData), submitter, ipHash, nowIso)
    .run();

  return jsonResponse(
    {
      ok: true,
      message: 'Cảm ơn! Loài hoa sẽ hiện sau khi được duyệt.',
      slug,
      status: 'pending',
      source: 'public',
      data: flowerData,
      flower: flowerData,
    },
    200,
  );
}

/**
 * POST /api/them-dia-diem (khách gửi địa điểm mới, chờ duyệt)
 */
export async function handlePublicSubmitPlace(
  request: Request,
  env: Env,
): Promise<Response> {
  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return jsonResponse({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
  }
  const { body, formData } = parsed;

  // 1. Kiểm tra Turnstile
  const turnstileToken = extractTurnstileFromParsed(body, formData, request);
  if (!turnstileToken) {
    return jsonResponse({ error: 'Thiếu mã xác thực Turnstile' }, 400);
  }
  const turnstileOk = await verifyTurnstileToken(turnstileToken, request, env);
  if (!turnstileOk) {
    return jsonResponse({ error: 'Xác thực Turnstile không hợp lệ' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  // 2. Kiểm tra dữ liệu địa điểm & trích xuất toạ độ
  const validated = await buildAndValidatePlacePayload(body, env, db, {});
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  // 3. Giới hạn 5 lần/ngày/IP
  const clientIp = getClientIp(request);
  const ipHash = await hashIp(clientIp, env.IP_SALT ?? '');
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM places_extra WHERE ip_hash = ? AND created_at >= ?`,
    )
    .bind(ipHash, sinceIso)
    .first<{ cnt: number }>();

  if (Number(countRow?.cnt ?? 0) >= MAX_PUBLIC_PLACE_SUBMISSIONS_PER_DAY) {
    return jsonResponse(
      { error: 'Bạn đã gửi quá giới hạn 5 địa điểm trong ngày. Vui lòng thử lại sau.' },
      429,
    );
  }

  const nowIso = new Date().toISOString();
  const { slug, placeData, submitter } = validated;

  await db
    .prepare(
      `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
       VALUES (?, 'pending', 'public', ?, ?, ?, ?, NULL)`,
    )
    .bind(slug, JSON.stringify(placeData), submitter, ipHash, nowIso)
    .run();

  return jsonResponse(
    {
      ok: true,
      message: 'Cảm ơn! Địa điểm sẽ hiện sau khi được duyệt.',
      slug,
      status: 'pending',
      source: 'public',
      lat: placeData.lat ?? null,
      lng: placeData.lng ?? null,
      data: placeData,
      place: placeData,
    },
    200,
  );
}

function rowToAdminExtraItem<T extends { slug: string }>(row: ExtraRow) {
  let parsedData: T = { slug: row.slug } as T;
  try {
    parsedData = JSON.parse(row.data) as T;
  } catch {
    // Bỏ qua
  }
  return {
    ...parsedData,
    slug: row.slug,
    status: row.status,
    source: row.source,
    submitter: row.submitter ?? null,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at ?? null,
    data: parsedData,
  };
}

export async function handleGetAdminFlowers(
  request: Request,
  env: Env,
): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  const url = new URL(request.url);
  const status = url.searchParams.get('status')?.trim() ?? '';
  if (status && status !== 'pending' && status !== 'approved' && status !== 'rejected') {
    return jsonResponse({ error: 'Tham số status không hợp lệ' }, 400);
  }

  const query = status
    ? `SELECT slug, status, source, data, submitter, ip_hash, created_at, reviewed_at
       FROM flowers_extra WHERE status = ? ORDER BY created_at DESC`
    : `SELECT slug, status, source, data, submitter, ip_hash, created_at, reviewed_at
       FROM flowers_extra ORDER BY created_at DESC`;

  const stmt = status ? db.prepare(query).bind(status) : db.prepare(query);
  const { results } = await stmt.all<ExtraRow>();
  const flowers = (results ?? []).map((r) => rowToAdminExtraItem<FlowerExtraData>(r));
  const buildStatus = await getBuildStatus(env);

  return jsonResponse({ flowers, buildStatus }, 200);
}

export async function handleCreateAdminFlower(
  request: Request,
  env: Env,
): Promise<Response> {
  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return jsonResponse({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const validated = await buildAndValidateFlowerPayload(parsed.body, env, db, {
    isAdmin: true,
  });
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const nowIso = new Date().toISOString();
  const { slug, flowerData, createdPlaces, submitter } = validated;

  for (const placeData of createdPlaces) {
    await db
      .prepare(
        `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
         VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
      )
      .bind(placeData.slug, JSON.stringify(placeData), submitter ?? 'Phùng Kiên', nowIso, nowIso)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO flowers_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
       VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
    )
    .bind(slug, JSON.stringify(flowerData), submitter ?? 'Phùng Kiên', nowIso, nowIso)
    .run();

  const build = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });

  return jsonResponse(
    {
      ok: true,
      slug,
      status: 'approved',
      source: 'admin',
      reviewed_at: nowIso,
      data: flowerData,
      flower: flowerData,
      build,
    },
    200,
  );
}

export async function handleUpdateAdminFlower(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug loài hoa' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug, status, source, data, submitter, created_at, reviewed_at FROM flowers_extra WHERE slug = ?`)
    .bind(slug)
    .first<ExtraRow>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy loài hoa trong D1' }, 404);
  }

  let existingData: FlowerExtraData | undefined;
  try {
    existingData = JSON.parse(existing.data) as FlowerExtraData;
  } catch {
    // Bỏ qua
  }

  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return jsonResponse({ error: 'Dữ liệu cập nhật không hợp lệ' }, 400);
  }

  const validated = await buildAndValidateFlowerPayload(parsed.body, env, db, {
    isAdmin: true,
    existingSlug: slug,
    existingData,
  });
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const nowIso = new Date().toISOString();
  const { flowerData, createdPlaces } = validated;

  for (const placeData of createdPlaces) {
    await db
      .prepare(
        `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
         VALUES (?, ?, 'admin', ?, ?, NULL, ?, ?)`,
      )
      .bind(
        placeData.slug,
        existing.status === 'approved' ? 'approved' : 'pending',
        JSON.stringify(placeData),
        existing.submitter ?? 'Phùng Kiên',
        nowIso,
        existing.status === 'approved' ? nowIso : null,
      )
      .run();
  }

  await db
    .prepare(`UPDATE flowers_extra SET data = ?, reviewed_at = COALESCE(reviewed_at, ?) WHERE slug = ?`)
    .bind(JSON.stringify(flowerData), nowIso, slug)
    .run();

  const build =
    existing.status === 'approved'
      ? await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso })
      : undefined;

  return jsonResponse(
    {
      ok: true,
      slug,
      status: existing.status,
      data: flowerData,
      flower: flowerData,
      ...(build ? { build } : {}),
    },
    200,
  );
}

export async function handleApproveAdminFlower(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug loài hoa' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug, status, source, data, submitter, created_at, reviewed_at FROM flowers_extra WHERE slug = ?`)
    .bind(slug)
    .first<ExtraRow>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy loài hoa' }, 404);
  }

  let flowerData: FlowerExtraData;
  try {
    flowerData = JSON.parse(existing.data) as FlowerExtraData;
  } catch {
    return jsonResponse({ error: 'Dữ liệu loài hoa bị hỏng' }, 500);
  }

  // Cho phép admin sửa các trường ngay khi bấm Duyệt
  const parsed = await parseRequestBody(request);
  if (parsed && Object.keys(parsed.body).length > 0) {
    const validated = await buildAndValidateFlowerPayload(parsed.body, env, db, {
      isAdmin: true,
      existingSlug: slug,
      existingData: flowerData,
    });
    if (!validated.ok) {
      return jsonResponse({ error: validated.error }, 400);
    }
    flowerData = validated.flowerData;
    const nowForPlaces = new Date().toISOString();
    for (const placeData of validated.createdPlaces) {
      await db
        .prepare(
          `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
           VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
        )
        .bind(placeData.slug, JSON.stringify(placeData), existing.submitter ?? 'Phùng Kiên', nowForPlaces, nowForPlaces)
        .run();
    }
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `UPDATE flowers_extra SET status = 'approved', data = ?, reviewed_at = ? WHERE slug = ?`,
    )
    .bind(JSON.stringify(flowerData), nowIso, slug)
    .run();

  // Duyệt luôn các địa điểm mới đi kèm loài hoa này (nếu còn pending)
  if (flowerData.places && flowerData.places.length > 0) {
    for (const p of flowerData.places) {
      await db
        .prepare(
          `UPDATE places_extra SET status = 'approved', reviewed_at = ? WHERE slug = ? AND status = 'pending'`,
        )
        .bind(nowIso, p.slug)
        .run();
    }
  }

  const build = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });

  return jsonResponse(
    {
      ok: true,
      slug,
      status: 'approved',
      reviewed_at: nowIso,
      data: flowerData,
      flower: flowerData,
      build,
    },
    200,
  );
}

export async function handleRejectAdminFlower(
  _request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug loài hoa' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug FROM flowers_extra WHERE slug = ?`)
    .bind(slug)
    .first<{ slug: string }>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy loài hoa' }, 404);
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(`UPDATE flowers_extra SET status = 'rejected', reviewed_at = ? WHERE slug = ?`)
    .bind(nowIso, slug)
    .run();

  return jsonResponse(
    {
      ok: true,
      slug,
      status: 'rejected',
      reviewed_at: nowIso,
    },
    200,
  );
}

export async function handleDeleteAdminFlower(
  _request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug loài hoa' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug FROM flowers_extra WHERE slug = ?`)
    .bind(slug)
    .first<{ slug: string }>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy loài hoa' }, 404);
  }

  await db.prepare(`DELETE FROM flowers_extra WHERE slug = ?`).bind(slug).run();
  return jsonResponse({ ok: true, slug, deleted: true }, 200);
}

export async function handleGetAdminPlaces(
  request: Request,
  env: Env,
): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  const url = new URL(request.url);
  const status = url.searchParams.get('status')?.trim() ?? '';
  if (status && status !== 'pending' && status !== 'approved' && status !== 'rejected') {
    return jsonResponse({ error: 'Tham số status không hợp lệ' }, 400);
  }

  const query = status
    ? `SELECT slug, status, source, data, submitter, ip_hash, created_at, reviewed_at
       FROM places_extra WHERE status = ? ORDER BY created_at DESC`
    : `SELECT slug, status, source, data, submitter, ip_hash, created_at, reviewed_at
       FROM places_extra ORDER BY created_at DESC`;

  const stmt = status ? db.prepare(query).bind(status) : db.prepare(query);
  const { results } = await stmt.all<ExtraRow>();
  const places = (results ?? []).map((r) => rowToAdminExtraItem<PlaceExtraData>(r));
  const buildStatus = await getBuildStatus(env);

  return jsonResponse({ places, buildStatus }, 200);
}

export async function handleCreateAdminPlace(
  request: Request,
  env: Env,
): Promise<Response> {
  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return jsonResponse({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const validated = await buildAndValidatePlacePayload(parsed.body, env, db, {});
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const nowIso = new Date().toISOString();
  const { slug, placeData, submitter } = validated;

  await db
    .prepare(
      `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
       VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
    )
    .bind(slug, JSON.stringify(placeData), submitter ?? 'Phùng Kiên', nowIso, nowIso)
    .run();

  const build = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });

  return jsonResponse(
    {
      ok: true,
      slug,
      status: 'approved',
      source: 'admin',
      reviewed_at: nowIso,
      lat: placeData.lat ?? null,
      lng: placeData.lng ?? null,
      data: placeData,
      place: placeData,
      build,
    },
    200,
  );
}

export async function handleUpdateAdminPlace(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug địa điểm' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug, status, source, data, submitter, created_at, reviewed_at FROM places_extra WHERE slug = ?`)
    .bind(slug)
    .first<ExtraRow>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy địa điểm trong D1' }, 404);
  }

  let existingData: PlaceExtraData | undefined;
  try {
    existingData = JSON.parse(existing.data) as PlaceExtraData;
  } catch {
    // Bỏ qua
  }

  const parsed = await parseRequestBody(request);
  if (!parsed) {
    return jsonResponse({ error: 'Dữ liệu cập nhật không hợp lệ' }, 400);
  }

  const validated = await buildAndValidatePlacePayload(parsed.body, env, db, {
    existingSlug: slug,
    existingData,
  });
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }

  const nowIso = new Date().toISOString();
  const { placeData } = validated;

  await db
    .prepare(`UPDATE places_extra SET data = ?, reviewed_at = COALESCE(reviewed_at, ?) WHERE slug = ?`)
    .bind(JSON.stringify(placeData), nowIso, slug)
    .run();

  const build =
    existing.status === 'approved'
      ? await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso })
      : undefined;

  return jsonResponse(
    {
      ok: true,
      slug,
      status: existing.status,
      lat: placeData.lat ?? null,
      lng: placeData.lng ?? null,
      data: placeData,
      place: placeData,
      ...(build ? { build } : {}),
    },
    200,
  );
}

export async function handleApproveAdminPlace(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug địa điểm' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug, status, source, data, submitter, created_at, reviewed_at FROM places_extra WHERE slug = ?`)
    .bind(slug)
    .first<ExtraRow>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy địa điểm' }, 404);
  }

  let placeData: PlaceExtraData;
  try {
    placeData = JSON.parse(existing.data) as PlaceExtraData;
  } catch {
    return jsonResponse({ error: 'Dữ liệu địa điểm bị hỏng' }, 500);
  }

  const parsed = await parseRequestBody(request);
  if (parsed && Object.keys(parsed.body).length > 0) {
    const validated = await buildAndValidatePlacePayload(parsed.body, env, db, {
      existingSlug: slug,
      existingData: placeData,
    });
    if (!validated.ok) {
      return jsonResponse({ error: validated.error }, 400);
    }
    placeData = validated.placeData;
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `UPDATE places_extra SET status = 'approved', data = ?, reviewed_at = ? WHERE slug = ?`,
    )
    .bind(JSON.stringify(placeData), nowIso, slug)
    .run();

  const build = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });

  return jsonResponse(
    {
      ok: true,
      slug,
      status: 'approved',
      reviewed_at: nowIso,
      lat: placeData.lat ?? null,
      lng: placeData.lng ?? null,
      data: placeData,
      place: placeData,
      build,
    },
    200,
  );
}

export async function handleRejectAdminPlace(
  _request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug địa điểm' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug FROM places_extra WHERE slug = ?`)
    .bind(slug)
    .first<{ slug: string }>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy địa điểm' }, 404);
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(`UPDATE places_extra SET status = 'rejected', reviewed_at = ? WHERE slug = ?`)
    .bind(nowIso, slug)
    .run();

  return jsonResponse(
    {
      ok: true,
      slug,
      status: 'rejected',
      reviewed_at: nowIso,
    },
    200,
  );
}

export async function handleDeleteAdminPlace(
  _request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  if (!slug) {
    return jsonResponse({ error: 'Thiếu slug địa điểm' }, 400);
  }

  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT slug FROM places_extra WHERE slug = ?`)
    .bind(slug)
    .first<{ slug: string }>();

  if (!existing) {
    return jsonResponse({ error: 'Không tìm thấy địa điểm' }, 404);
  }

  await db.prepare(`DELETE FROM places_extra WHERE slug = ?`).bind(slug).run();
  return jsonResponse({ ok: true, slug, deleted: true }, 200);
}

export async function handleGetAdminBuildStatus(
  _request: Request,
  env: Env,
): Promise<Response> {
  const status = await getBuildStatus(env);
  return jsonResponse({ ok: true, ...status }, 200);
}

export async function handleAdminTriggerBuild(
  _request: Request,
  env: Env,
): Promise<Response> {
  const result = await triggerBuildIfNeeded(env, { force: true });
  return jsonResponse(
    {
      ok: result.triggered || !result.configured,
      ...result,
    },
    200,
  );
}
