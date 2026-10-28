import baseFlowersJson from './data/flowers.json';
import basePlacesJson from './data/places.json';
import { site } from '../../config/site';

export interface RemoteDuLieuPayload<
  TFlower extends { slug: string } = Record<string, unknown> & { slug: string },
  TPlace extends { slug: string } = Record<string, unknown> & { slug: string },
> {
  flowers?: TFlower[];
  places?: TPlace[];
}

export interface LoadCombinedDataOptions {
  siteUrl?: string;
  skipRemoteData?: boolean;
  isCloudflareBuild?: boolean;
  strict?: boolean;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  baseFlowers?: Array<Record<string, unknown> & { slug: string }>;
  basePlaces?: Array<Record<string, unknown> & { slug: string }>;
  warn?: (msg: string) => void;
}

/**
 * Gộp danh sách gốc (JSON) và danh sách từ API theo `slug`.
 * Khi trùng `slug`, phần tử trong JSON gốc luôn thắng (giữ nguyên không ghi đè).
 */
export function mergeBySlug<T extends { slug: string }>(
  baseItems: readonly T[],
  remoteItems?: readonly T[] | null,
): T[] {
  const result: T[] = [...baseItems];
  if (!remoteItems || !Array.isArray(remoteItems) || remoteItems.length === 0) {
    return result;
  }

  const seenSlugs = new Set<string>(
    baseItems.map((item) => item?.slug).filter((s): s is string => Boolean(s)),
  );

  for (const item of remoteItems) {
    if (!item || typeof item !== 'object' || typeof item.slug !== 'string') continue;
    const slug = item.slug.trim();
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    result.push(item);
  }

  return result;
}

export const mergeFlowers = mergeBySlug;
export const mergePlaces = mergeBySlug;

export function mergeRemoteData<
  TFlower extends { slug: string },
  TPlace extends { slug: string },
>(
  base: { flowers: readonly TFlower[]; places: readonly TPlace[] },
  remote?: RemoteDuLieuPayload<TFlower, TPlace> | null,
): { flowers: TFlower[]; places: TPlace[] } {
  return {
    flowers: mergeBySlug(base.flowers, remote?.flowers ?? []),
    places: mergeBySlug(base.places, remote?.places ?? []),
  };
}

function getProcessEnv(): Record<string, string | undefined> {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {};
}

export function isSkipRemoteDataEnabled(
  env: Record<string, string | undefined> = getProcessEnv(),
): boolean {
  const val = env.SKIP_REMOTE_DATA?.trim().toLowerCase();
  return val === '1' || val === 'true' || val === 'yes';
}

export function isCloudflareBuildEnv(
  env: Record<string, string | undefined> = getProcessEnv(),
): boolean {
  return Boolean(
    env.WORKERS_CI === '1' ||
      env.WORKERS_CI === 'true' ||
      env.WORKERS_CI_BRANCH ||
      env.CF_PAGES === '1' ||
      env.CF_PAGES === 'true' ||
      env.CF_PAGES_BUILD_ID ||
      env.CF_CI === '1' ||
      env.STRICT_REMOTE_DATA === '1' ||
      env.STRICT_REMOTE_DATA === 'true',
  );
}

let cachedDefaultLoadPromise: Promise<{
  flowers: Array<Record<string, unknown> & { id: string; slug: string }>;
  places: Array<Record<string, unknown> & { id: string; slug: string }>;
}> | null = null;

export function clearRemoteDataCache(): void {
  cachedDefaultLoadPromise = null;
}

function attachCollectionIds<T extends { slug: string }>(
  items: readonly T[],
): Array<T & { id: string }> {
  return items.map((item) => ({ id: item.slug, ...item }));
}

/**
 * Đọc flowers.json + places.json gốc và gộp với dữ liệu từ GET ${SITE_URL}/api/du-lieu.
 * - Khi SKIP_REMOTE_DATA=1: bỏ qua gọi API, in cảnh báo, chỉ dùng JSON.
 * - Khi gọi API lỗi trên Cloudflare Builds (WORKERS_CI / CF_PAGES / strict): ném lỗi để build thất bại.
 * - Khi gọi API lỗi ở máy local (không có mạng): in cảnh báo, chỉ dùng JSON.
 */
export async function loadCombinedData(options?: LoadCombinedDataOptions): Promise<{
  flowers: Array<Record<string, unknown> & { id: string; slug: string }>;
  places: Array<Record<string, unknown> & { id: string; slug: string }>;
}> {
  const env = options?.env ?? getProcessEnv();
  const baseFlowers = (options?.baseFlowers ??
    (baseFlowersJson as unknown as Array<Record<string, unknown> & { slug: string }>));
  const basePlaces = (options?.basePlaces ??
    (basePlacesJson as unknown as Array<Record<string, unknown> & { slug: string }>));
  const warn = options?.warn ?? ((msg: string) => console.warn(msg));

  const skip =
    options?.skipRemoteData !== undefined
      ? options.skipRemoteData
      : isSkipRemoteDataEnabled(env);

  if (skip) {
    warn('[content.config] SKIP_REMOTE_DATA=1: bỏ qua gọi /api/du-lieu, chỉ dùng dữ liệu JSON gốc.');
    return {
      flowers: attachCollectionIds(baseFlowers),
      places: attachCollectionIds(basePlaces),
    };
  }

  // Hỗ trợ truyền dữ liệu giả trực tiếp qua biến môi trường MOCK_REMOTE_DATA / REMOTE_DATA_JSON khi build test
  const inlineMockJson = env.MOCK_REMOTE_DATA ?? env.REMOTE_DATA_JSON;
  if (inlineMockJson && inlineMockJson.trim()) {
    const parsedMock = JSON.parse(inlineMockJson) as RemoteDuLieuPayload;
    const merged = mergeRemoteData(
      { flowers: baseFlowers, places: basePlaces },
      parsedMock,
    );
    return {
      flowers: attachCollectionIds(merged.flowers),
      places: attachCollectionIds(merged.places),
    };
  }

  const strict =
    options?.strict !== undefined
      ? options.strict
      : options?.isCloudflareBuild !== undefined
        ? options.isCloudflareBuild
        : isCloudflareBuildEnv(env);

  const siteUrl = (options?.siteUrl ?? env.SITE_URL ?? site.url).replace(/\/+$/, '');
  const endpoint = `${siteUrl}/api/du-lieu`;
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

  try {
    if (!fetchImpl) {
      throw new Error('fetch is not available');
    }
    const res = await fetchImpl(endpoint, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) {
      // Worker đang chạy chưa có route này (lần deploy đầu tiên của bước 26) → chưa có dữ liệu thêm.
      warn(`[content.config] ${endpoint} trả 404 (Worker cũ chưa có API) — chỉ dùng dữ liệu JSON.`);
      return {
        flowers: attachCollectionIds(baseFlowers),
        places: attachCollectionIds(basePlaces),
      };
    }
    if (!res.ok) {
      throw new Error(`GET ${endpoint} trả mã lỗi HTTP ${res.status}`);
    }
    const payload = (await res.json()) as RemoteDuLieuPayload;
    if (!payload || typeof payload !== 'object') {
      throw new Error(`GET ${endpoint} trả dữ liệu JSON không hợp lệ`);
    }

    const merged = mergeRemoteData(
      { flowers: baseFlowers, places: basePlaces },
      payload,
    );
    return {
      flowers: attachCollectionIds(merged.flowers),
      places: attachCollectionIds(merged.places),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (strict) {
      throw new Error(
        `[content.config] Lỗi tải dữ liệu từ ${endpoint} khi build trên Cloudflare: ${msg}`,
      );
    }
    warn(
      `[content.config] Không gọi được ${endpoint} (${msg}) — chỉ dùng dữ liệu JSON cục bộ.`,
    );
    return {
      flowers: attachCollectionIds(baseFlowers),
      places: attachCollectionIds(basePlaces),
    };
  }
}

export function loadCombinedDataCached(): Promise<{
  flowers: Array<Record<string, unknown> & { id: string; slug: string }>;
  places: Array<Record<string, unknown> & { id: string; slug: string }>;
}> {
  if (!cachedDefaultLoadPromise) {
    cachedDefaultLoadPromise = loadCombinedData();
  }
  return cachedDefaultLoadPromise;
}
