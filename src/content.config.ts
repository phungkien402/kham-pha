import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const monthDay = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31).optional(),
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
  // Mỗi mục cần `id`; dùng `slug` làm id.
  loader: file('src/explore/mua-hoa-viet/data/flowers.json', {
    parser: (text) => JSON.parse(text).map((f: { slug: string }) => ({ id: f.slug, ...f })),
  }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    scientificName: z.string(),
    aka: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    // false = mùa nở và các chuyện thú vị là dữ liệu mẫu, chưa kiểm chứng
    verified: z.boolean().default(false),
    season: z.object({
      start: monthDay,
      peak: monthDay.optional(),
      end: monthDay,
    }),
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
  }),
});

const places = defineCollection({
  loader: file('src/explore/mua-hoa-viet/data/places.json', {
    parser: (text) => JSON.parse(text).map((p: { slug: string }) => ({ id: p.slug, ...p })),
  }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    province: z.string(),
    region: z.enum(['bac', 'trung', 'nam']),
    lat: z.number().optional(),
    lng: z.number().optional(),
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
