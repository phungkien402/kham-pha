import type { ResponsiveImage } from './images';

export interface PublicPhoto {
  id: string;
  flower: string;
  place?: string | null;
  author: string;
  author_link?: string | null;
  license: string;
  caption?: string | null;
  taken_on?: string | null;
  maps_url?: string | null;
  width?: number;
  height?: number;
  created_at?: string;
  src?: string;
  src600?: string;
}

export interface CarouselPhoto {
  img?: ResponsiveImage;
  alt: string;
  author: string;
  license?: string;
  status?: 'approved' | 'pending';
  color: string;
}

export interface CoverPhoto {
  id: string;
  src: string;
  src600: string;
  author: string;
  license: string;
  width?: number;
  height?: number;
}

export type CoversMap = Record<string, CoverPhoto>;

export interface FlowerWithCover {
  slug: string;
  name?: string;
  photo?: ResponsiveImage;
  photoAlt?: string;
  status?: 'approved' | 'pending' | string;
  author?: string;
}

const GLOBAL_CACHE_KEY = '__muaHoaPublicPhotosCache';
const GLOBAL_COVERS_CACHE_KEY = '__muaHoaCoversCache';

function getCache(): Map<string, Promise<PublicPhoto[]>> {
  const g = globalThis as Record<string, unknown>;
  if (!(g[GLOBAL_CACHE_KEY] instanceof Map)) {
    g[GLOBAL_CACHE_KEY] = new Map<string, Promise<PublicPhoto[]>>();
  }
  return g[GLOBAL_CACHE_KEY] as Map<string, Promise<PublicPhoto[]>>;
}

export function clearCoversCache(): void {
  const g = globalThis as Record<string, unknown>;
  delete g[GLOBAL_COVERS_CACHE_KEY];
}

export function clearPublicPhotosCache(): void {
  getCache().clear();
  clearCoversCache();
}

export function sortPublicPhotosNewestFirst(list: PublicPhoto[]): PublicPhoto[] {
  return [...list].sort((a, b) => {
    if (a.created_at && b.created_at && a.created_at !== b.created_at) {
      return b.created_at.localeCompare(a.created_at);
    }
    return 0;
  });
}

/**
 * Gọi GET /api/anh?flower=<slug> và dùng chung một Promise cho từng loài
 * để Carousel đầu trang và ApprovedPhotos cuối trang không gọi API hai lần.
 */
export function fetchPublicPhotos(
  flowerSlug: string,
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<PublicPhoto[]> {
  const slug = flowerSlug.trim();
  if (!slug || !fetchImpl) {
    return Promise.resolve([]);
  }

  const cache = getCache();
  const cached = cache.get(slug);
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<PublicPhoto[]> => {
    try {
      const res = await fetchImpl(`/api/anh?flower=${encodeURIComponent(slug)}`);
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      const raw: PublicPhoto[] = Array.isArray(data) ? data : (data?.photos ?? []);
      if (!Array.isArray(raw) || raw.length === 0) return [];
      return sortPublicPhotosNewestFirst(raw);
    } catch {
      // Bỏ qua lỗi mạng khi chạy bản tĩnh không có Worker
      return [];
    }
  })();

  cache.set(slug, promise);
  return promise;
}

/**
 * Gọi GET /api/anh/bia đúng 1 lần mỗi trang (dùng chung một Promise)
 * để lấy ảnh bìa đã duyệt mới nhất cho từng loài hoa. Lỗi/rỗng → {}.
 */
export function fetchCovers(
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<CoversMap> {
  if (!fetchImpl) {
    return Promise.resolve({});
  }

  const g = globalThis as Record<string, unknown>;
  const cached = g[GLOBAL_COVERS_CACHE_KEY] as Promise<CoversMap> | undefined;
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<CoversMap> => {
    try {
      const res = await fetchImpl('/api/anh/bia');
      if (!res.ok) return {};
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) return {};
      const data = await res.json();
      if (!data || typeof data !== 'object') return {};
      const raw = 'covers' in data ? (data as { covers?: unknown }).covers : data;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

      const out: CoversMap = {};
      for (const [slug, val] of Object.entries(raw as Record<string, unknown>)) {
        if (!val || typeof val !== 'object') continue;
        const c = val as Partial<CoverPhoto>;
        if (!c.id && !c.src && !c.src600) continue;
        const id = c.id ?? '';
        out[slug] = {
          ...(c as CoverPhoto),
          id,
          src: c.src || `/api/anh/${id}.webp`,
          src600: c.src600 || `/api/anh/${id}-600.webp`,
          author: c.author ?? '',
          license: c.license ?? '',
        };
      }
      return out;
    } catch {
      return {};
    }
  })();

  g[GLOBAL_COVERS_CACHE_KEY] = promise;
  return promise;
}

export function coverToResponsiveImage(cover: CoverPhoto): ResponsiveImage {
  const src600 = cover.src600 || cover.src || `/api/anh/${cover.id}-600.webp`;
  return {
    src: src600,
    srcset: `${src600} 600w`,
    width: cover.width || 600,
    height: cover.height || 450,
  };
}

/**
 * Thay ảnh bìa cho loài chỉ có ảnh giữ chỗ (không có photo.src, hoặc status 'pending' / author 'Chưa có')
 * khi covers có ảnh của loài đó. Loài đã có ảnh Commons giữ nguyên ảnh Commons.
 */
export function applyCoverToFlower<T extends FlowerWithCover>(
  flower: T,
  covers: CoversMap | undefined | null,
): T {
  if (!covers || !flower?.slug) return flower;
  const cover = covers[flower.slug];
  if (!cover) return flower;

  const isPlaceholder =
    !flower.photo?.src ||
    flower.status === 'pending' ||
    flower.author === 'Chưa có';

  if (!isPlaceholder) {
    return flower;
  }

  const next: T = {
    ...flower,
    photo: coverToResponsiveImage(cover),
  };
  if ('photoAlt' in flower || flower.name) {
    next.photoAlt =
      flower.photoAlt && !flower.photoAlt.includes('ảnh giữ chỗ')
        ? flower.photoAlt
        : flower.name
          ? `Ảnh ${flower.name} — ${cover.author}`
          : `Ảnh — ${cover.author}`;
  }
  return next;
}

export function applyCoversToFlowers<T extends FlowerWithCover>(
  flowers: T[],
  covers: CoversMap | undefined | null,
): T[] {
  if (!covers || Object.keys(covers).length === 0) {
    return flowers;
  }
  return flowers.map((f) => applyCoverToFlower(f, covers));
}

export const mergeFlowerCover = applyCoverToFlower;
export const mergeFlowerCovers = applyCoversToFlowers;

export function isPlaceholderPhoto(p: {
  img?: ResponsiveImage;
  author: string;
  status?: string;
}): boolean {
  return !p.img || p.status === 'pending' || p.author === 'Chưa có';
}

export function publicPhotoToCarouselPhoto(
  p: PublicPhoto,
  color: string,
  flowerName?: string,
): CarouselPhoto {
  const srcFull = p.src || `/api/anh/${p.id}.webp`;
  const src600 = p.src600 || `/api/anh/${p.id}-600.webp`;
  return {
    img: {
      src: srcFull,
      srcset: `${src600} 600w, ${srcFull} 1200w`,
      width: p.width || 800,
      height: p.height || 600,
    },
    alt: p.caption || (flowerName ? `Ảnh ${flowerName} — ${p.author}` : `Ảnh — ${p.author}`),
    author: p.author,
    license: p.license,
    status: 'approved',
    color,
  };
}

/**
 * Kết hợp danh sách ảnh build sẵn (flowers.json) với ảnh đã duyệt từ API:
 * - Khi API rỗng/lỗi: giữ nguyên danh sách ảnh build sẵn.
 * - Khi loài chưa có ảnh thật (chỉ có ảnh giữ chỗ): thay ảnh giữ chỗ bằng ảnh đã duyệt (mới nhất trước).
 * - Khi loài đã có ảnh Commons: giữ nguyên các ảnh Commons ở đầu và nối ảnh đã duyệt vào cuối.
 */
export function mergeCarouselPhotos(
  initialPhotos: CarouselPhoto[],
  apiPhotos: PublicPhoto[],
  color?: string,
  flowerName?: string,
): CarouselPhoto[] {
  if (!apiPhotos || apiPhotos.length === 0) {
    return initialPhotos;
  }

  const fallbackColor = color || initialPhotos[0]?.color || '#ccc';
  const sortedApi = sortPublicPhotosNewestFirst(apiPhotos);
  const mappedApi = sortedApi.map((p) =>
    publicPhotoToCarouselPhoto(p, fallbackColor, flowerName),
  );

  const realInitial = initialPhotos.filter((p) => !isPlaceholderPhoto(p));
  if (realInitial.length === 0) {
    return mappedApi;
  }

  return [...realInitial, ...mappedApi];
}

export function formatCarouselCaption(p: {
  img?: ResponsiveImage;
  author: string;
  license?: string;
  status?: string;
}): string {
  if (isPlaceholderPhoto(p)) {
    return 'Ảnh giữ chỗ';
  }
  if (p.license && p.license !== 'Chưa có') {
    return `Ảnh: ${p.author} · ${p.license}`;
  }
  return `Ảnh: ${p.author}`;
}

export interface GridPhotoInput {
  img?: ResponsiveImage;
  fullImg?: ResponsiveImage;
  src?: string;
  src600?: string;
  alt: string;
  author: string;
  author_link?: string | null;
  license?: string;
  caption?: string | null;
  place?: string | null;
  taken_on?: string | null;
  maps_url?: string | null;
  status?: 'approved' | 'pending' | string;
  color?: string;
}

export interface GridPhotoItem {
  id: string;
  thumbSrc: string;
  thumbSrcset?: string;
  width: number;
  height: number;
  fullSrc: string;
  fullSrcset?: string;
  alt: string;
  author: string;
  authorLink?: string;
  license?: string;
  caption?: string;
  place?: string;
  takenOn?: string;
  mapsUrl?: string;
  color: string;
}

/**
 * Chỉ giữ link tác giả có giao thức http:// hoặc https:// hợp lệ.
 */
export function sanitizeAuthorLink(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // URL không hợp lệ
  }
  return undefined;
}

function largestSrcFromResponsive(img?: ResponsiveImage): string | undefined {
  if (!img) return undefined;
  if (img.srcset) {
    const parts = img.srcset
      .split(',')
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }
  return img.src;
}

export function publicPhotoToGridItem(
  p: PublicPhoto,
  color: string,
  flowerName?: string,
): GridPhotoItem {
  const fullSrc = p.src || `/api/anh/${p.id}.webp`;
  const thumbSrc = p.src600 || `/api/anh/${p.id}-600.webp`;
  return {
    id: `api-${p.id}`,
    thumbSrc,
    width: p.width || 800,
    height: p.height || 600,
    fullSrc,
    alt: p.caption || (flowerName ? `Ảnh ${flowerName} — ${p.author}` : `Ảnh — ${p.author}`),
    author: p.author,
    authorLink: sanitizeAuthorLink(p.author_link),
    license: p.license && p.license !== 'Chưa có' ? p.license : undefined,
    caption: p.caption || undefined,
    place: p.place || undefined,
    takenOn: p.taken_on || undefined,
    mapsUrl: sanitizeAuthorLink(p.maps_url),
    color,
  };
}

function initialPhotoToGridItem(
  p: GridPhotoInput,
  index: number,
  fallbackColor: string,
): GridPhotoItem {
  const thumbImg = p.img ?? p.fullImg;
  const fullImg = p.fullImg ?? p.img;
  const thumbSrc = p.src600 || thumbImg?.src || p.src || '';
  const fullSrc = p.src || largestSrcFromResponsive(fullImg) || thumbSrc;
  return {
    id: `init-${index}-${thumbSrc}`,
    thumbSrc,
    thumbSrcset: thumbImg?.srcset,
    width: thumbImg?.width || 640,
    height: thumbImg?.height || 480,
    fullSrc,
    fullSrcset: fullImg?.srcset,
    alt: p.alt,
    author: p.author,
    authorLink: sanitizeAuthorLink(p.author_link),
    license: p.license && p.license !== 'Chưa có' ? p.license : undefined,
    caption: p.caption || undefined,
    place: p.place || undefined,
    takenOn: p.taken_on || undefined,
    mapsUrl: sanitizeAuthorLink(p.maps_url),
    color: p.color || fallbackColor,
  };
}

/**
 * Gộp ảnh thật build sẵn (Commons) và ảnh đã duyệt từ API cho mục "Ảnh":
 * - Bỏ mọi ảnh giữ chỗ (author "Chưa có", status "pending", không có ảnh).
 * - Trả về mảng rỗng khi chưa có ảnh thật nào (ẩn mục "Ảnh").
 * - Khi có ảnh thật: ảnh Commons ở đầu, nối tiếp ảnh đã duyệt (mới nhất trước).
 */
export function mergeGridPhotos(
  initialPhotos: GridPhotoInput[] = [],
  apiPhotos: PublicPhoto[] = [],
  color?: string,
  flowerName?: string,
): GridPhotoItem[] {
  const fallbackColor = color || initialPhotos[0]?.color || '#ccc';
  const realInitial = initialPhotos
    .filter((p) => {
      const hasSource = Boolean(p.img?.src || p.fullImg?.src || p.src || p.src600);
      if (!hasSource || p.status === 'pending' || p.author === 'Chưa có') {
        return false;
      }
      return true;
    })
    .map((p, i) => initialPhotoToGridItem(p, i, fallbackColor));

  const sortedApi = sortPublicPhotosNewestFirst(apiPhotos ?? []);
  const mappedApi = sortedApi.map((p) =>
    publicPhotoToGridItem(p, fallbackColor, flowerName),
  );

  return [...realInitial, ...mappedApi];
}

