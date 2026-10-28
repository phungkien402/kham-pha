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

const GLOBAL_CACHE_KEY = '__muaHoaPublicPhotosCache';

function getCache(): Map<string, Promise<PublicPhoto[]>> {
  const g = globalThis as Record<string, unknown>;
  if (!(g[GLOBAL_CACHE_KEY] instanceof Map)) {
    g[GLOBAL_CACHE_KEY] = new Map<string, Promise<PublicPhoto[]>>();
  }
  return g[GLOBAL_CACHE_KEY] as Map<string, Promise<PublicPhoto[]>>;
}

export function clearPublicPhotosCache(): void {
  getCache().clear();
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
