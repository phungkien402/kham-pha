import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import {
  clearRemoteDataCache,
  isCloudflareBuildEnv,
  isSkipRemoteDataEnabled,
  loadCombinedData,
  loadCombinedDataCached,
  mergeBySlug,
  mergeFlowers,
  mergePlaces,
  mergeRemoteData,
  type LoadCombinedDataOptions,
  type RemoteDuLieuPayload,
} from './explore/mua-hoa-viet/remoteData';

export {
  clearRemoteDataCache,
  isCloudflareBuildEnv,
  isSkipRemoteDataEnabled,
  loadCombinedData,
  loadCombinedDataCached,
  mergeBySlug,
  mergeFlowers,
  mergePlaces,
  mergeRemoteData,
  type LoadCombinedDataOptions,
  type RemoteDuLieuPayload,
};

const monthDay = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31).optional(),
});

const season = z.object({
  start: monthDay,
  peak: monthDay.optional(),
  end: monthDay,
  note: z.string().optional(),
});

const photo = z.object({
  src: z.string().optional(),
  alt: z.string(),
  author: z.string(),
  license: z.string(),
  source: z.string().optional(),
  status: z.enum(['approved', 'pending']),
});

const flowers = defineCollection({
  // Đọc flowers.json + gộp dữ liệu từ GET ${SITE_URL}/api/du-lieu (slug trùng thì JSON gốc thắng).
  loader: async () => {
    const data = await loadCombinedDataCached();
    return data.flowers;
  },
  schema: z
    .object({
      slug: z.string(),
      name: z.string(),
      scientificName: z.string().optional().default(''),
      aka: z.string().optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      // false = mùa nở và các chuyện thú vị là dữ liệu mẫu, chưa kiểm chứng
      verified: z.boolean().default(false),
      // Một mùa (`season`) hoặc nhiều đợt (`seasons`); sau khi đọc luôn là `seasons`.
      season: season.optional(),
      seasons: z.array(season).min(1).optional(),
      regions: z.array(z.enum(['bac', 'trung', 'nam'])).min(1),
      regionLabel: z.string(),
      summary: z.string().optional(),
      facts: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      identify: z.array(z.string()).optional(),
      confusedWith: z
        .object({ name: z.string(), ours: z.string(), theirs: z.string() })
        .optional(),
      didYouKnow: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
      dayMoments: z
        .array(
          z.object({
            label: z.string(),
            color: z.string(),
            headline: z.string(),
            scene: z.string(),
            tip: z.string(),
          }),
        )
        .optional(),
      quote: z
        .object({ text: z.string(), author: z.string(), place: z.string(), year: z.number().int() })
        .optional(),
      photos: z.array(photo),
      tips: z.array(z.string()).optional(),
      places: z
        .array(
          z.object({
            slug: z.string(),
            best: z.string().optional().default('Theo mùa'),
          }),
        )
        .optional(),
    })
    .transform(({ season: single, seasons, ...rest }, ctx) => {
      const list = seasons ?? (single ? [single] : undefined);
      if (!list || (seasons && single)) {
        ctx.addIssue({ code: 'custom', message: 'Cần đúng một trong `season` hoặc `seasons`' });
        return z.NEVER;
      }
      return { ...rest, seasons: list };
    }),
});

const places = defineCollection({
  loader: async () => {
    const data = await loadCombinedDataCached();
    return data.places;
  },
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    province: z.string(),
    region: z.enum(['bac', 'trung', 'nam']),
    lat: z.number().optional(),
    lng: z.number().optional(),
    maps_url: z.string().optional(),
    flowers: z.array(
      z.object({
        slug: z.string(),
        best: z.union([
          z.string(),
          z.object({ start: monthDay, end: monthDay }),
        ]),
      }),
    ),
  }),
});

export const collections = { flowers, places };
