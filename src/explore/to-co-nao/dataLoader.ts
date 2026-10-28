// src/explore/to-co-nao/dataLoader.ts
// Module nạp dữ liệu: nạp meta + default ngay lập tức, nạp lười và cache theo chunk, prefetch vn.json khi idle.

import type { EntityMeta, ShapeChunk } from './types';
import defaultShapesData from './data/default.json';
import metaRaw from './data/meta.json';

// Danh sách meta toàn bộ thực thể được nạp tĩnh ngay lúc load
export const meta: EntityMeta[] = metaRaw as EntityMeta[];

// Bảng tra cứu meta theo id
export const metaMap: Map<string, EntityMeta> = new Map(
  meta.map((item) => [item.id, item])
);

// Lưu trữ các shape đã nạp vào bộ nhớ (khởi tạo với các shape mặc định)
export const loadedShapes: Map<string, string> = new Map(
  Object.entries(defaultShapesData as ShapeChunk)
);

// Cache promise theo tên chunk để tránh fetch trùng lặp
export const chunkPromises: Map<string, Promise<ShapeChunk>> = new Map();

// Trình nạp động cho các chunk trong Vite
const CHUNK_IMPORTERS: Record<string, () => Promise<{ default: ShapeChunk } | ShapeChunk>> = {
  vn: () => import('./data/vn.json'),
  'nuoc-pho-bien': () => import('./data/nuoc-pho-bien.json'),
  'nuoc-khac': () => import('./data/nuoc-khac.json'),
};

/**
 * Nạp dữ liệu một chunk (vn, nuoc-pho-bien, nuoc-khac) với cơ chế cache promise.
 */
export async function loadChunk(chunkName: string): Promise<ShapeChunk> {
  if (chunkName === 'default') {
    return defaultShapesData as ShapeChunk;
  }

  if (chunkPromises.has(chunkName)) {
    return chunkPromises.get(chunkName)!;
  }

  const promise = (async () => {
    try {
      // 1. Thử dynamic import qua Vite
      if (CHUNK_IMPORTERS[chunkName]) {
        const mod = await CHUNK_IMPORTERS[chunkName]();
        const data = (mod && 'default' in mod ? mod.default : mod) as ShapeChunk;
        for (const [id, d] of Object.entries(data)) {
          loadedShapes.set(id, d);
        }
        return data;
      }

      // 2. Dự phòng: fetch qua HTTP nếu chạy trong trình duyệt
      if (typeof fetch !== 'undefined') {
        const res = await fetch(`/data/to-co-nao/${chunkName}.json`);
        if (res.ok) {
          const data = (await res.json()) as ShapeChunk;
          for (const [id, d] of Object.entries(data)) {
            loadedShapes.set(id, d);
          }
          return data;
        }
      }

      return {};
    } catch (err) {
      console.error(`[dataLoader] Lỗi nạp chunk "${chunkName}":`, err);
      return {};
    }
  })();

  chunkPromises.set(chunkName, promise);
  return promise;
}

/**
 * Lấy SVG path d của một thực thể (đồng bộ nếu đã có trong cache/default, bất đồng bộ nếu cần nạp chunk).
 */
export async function getShape(id: string): Promise<string | null> {
  if (!id) return null;

  if (loadedShapes.has(id)) {
    return loadedShapes.get(id)!;
  }

  const entity = metaMap.get(id);
  if (!entity) return null;

  const chunk = entity.chunk || 'nuoc-khac';
  await loadChunk(chunk);

  return loadedShapes.get(id) ?? null;
}

/**
 * Lấy SVG path d ngay lập tức nếu đã nạp trong bộ nhớ, nếu chưa trả về null.
 */
export function getShapeSync(id: string): string | null {
  if (!id) return null;
  return loadedShapes.get(id) ?? null;
}

/**
 * Lấy thông tin meta của thực thể theo id.
 */
export function getEntity(id: string): EntityMeta | undefined {
  return metaMap.get(id);
}

export const getEntityMeta = getEntity;

/**
 * Tìm kiếm thực thể theo từ khoá không dấu.
 */
export function searchEntities(query: string, limit = 20): EntityMeta[] {
  if (!query || !query.trim()) {
    return meta.slice(0, limit);
  }

  const normalized = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);

  return meta
    .filter((item) => {
      const q = item.q || '';
      return words.every((w) => q.includes(w) || item.id.includes(w));
    })
    .slice(0, limit);
}

/**
 * Tải trước dữ liệu 34 tỉnh thành Việt Nam (vn.json) khi trình duyệt rảnh rỗi (idle).
 */
export function prefetchVn(): void {
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        loadChunk('vn').catch(() => {});
      });
    } else {
      setTimeout(() => {
        loadChunk('vn').catch(() => {});
      }, 1000);
    }
  }
}

/**
 * Tải trước một chunk bất kỳ trong nền.
 */
export function prefetchChunk(chunkName: string): void {
  loadChunk(chunkName).catch(() => {});
}
