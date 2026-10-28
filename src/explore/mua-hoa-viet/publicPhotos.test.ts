import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyCoverToFlower,
  clearPublicPhotosCache,
  fetchCovers,
  fetchPublicPhotos,
  formatCarouselCaption,
  mergeCarouselPhotos,
  mergeGridPhotos,
  publicPhotoToCarouselPhoto,
  publicPhotoToGridItem,
  sanitizeAuthorLink,
  type CarouselPhoto,
  type PublicPhoto,
} from './publicPhotos';

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const photo = (id: string, created_at: string, extra: Partial<PublicPhoto> = {}): PublicPhoto => ({
  id,
  flower: 'da-quy',
  author: 'Nguyễn Văn A',
  license: 'CC BY 4.0',
  created_at,
  ...extra,
});

const placeholder: CarouselPhoto = { alt: 'giữ chỗ', author: 'Chưa có', status: 'pending', color: '#E8A0B4' };
const commons: CarouselPhoto = {
  img: { src: '/c.webp', srcset: '/c-600.webp 600w, /c.webp 1200w', width: 800, height: 600 },
  alt: 'Commons',
  author: 'Wikimedia User',
  license: 'CC BY-SA 4.0',
  status: 'approved',
  color: '#E8A0B4',
};

beforeEach(() => clearPublicPhotosCache());

describe('fetchPublicPhotos', () => {
  it('gọi /api/anh?flower=<slug> đúng 1 lần dù gọi nhiều lần cùng slug', async () => {
    const f = vi.fn(async () => jsonRes({ photos: [photo('a', '2026-01-01')] }));
    const [r1, r2, r3] = await Promise.all([
      fetchPublicPhotos('da-quy', f as any),
      fetchPublicPhotos('da-quy', f as any),
      fetchPublicPhotos('da-quy', f as any),
    ]);
    await fetchPublicPhotos('da-quy', f as any);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith('/api/anh?flower=da-quy');
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it('slug khác nhau thì gọi riêng', async () => {
    const f = vi.fn(async () => jsonRes({ photos: [] }));
    await fetchPublicPhotos('a', f as any);
    await fetchPublicPhotos('b', f as any);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('fetch throw → mảng rỗng, không ném lỗi', async () => {
    const f = vi.fn(async () => {
      throw new Error('mạng lỗi');
    });
    await expect(fetchPublicPhotos('x', f as any)).resolves.toEqual([]);
  });

  it('status 500 → mảng rỗng', async () => {
    const f = vi.fn(async () => jsonRes({ error: 'boom' }, 500));
    await expect(fetchPublicPhotos('x', f as any)).resolves.toEqual([]);
  });

  it('{photos:[]} → mảng rỗng', async () => {
    const f = vi.fn(async () => jsonRes({ photos: [] }));
    await expect(fetchPublicPhotos('x', f as any)).resolves.toEqual([]);
  });

  it('ảnh sắp xếp mới nhất trước theo created_at', async () => {
    const f = vi.fn(async () =>
      jsonRes({
        photos: [photo('cu', '2026-01-01T00:00:00Z'), photo('moi', '2026-09-01T00:00:00Z'), photo('giua', '2026-05-01T00:00:00Z')],
      }),
    );
    const r = await fetchPublicPhotos('da-quy', f as any);
    expect(r.map((p) => p.id)).toEqual(['moi', 'giua', 'cu']);
  });

  it('dùng được cả global fetch được mock', async () => {
    const f = vi.fn(async () => jsonRes({ photos: [photo('a', '2026-01-01')] }));
    vi.stubGlobal('fetch', f);
    try {
      await fetchPublicPhotos('da-quy', f as any);
      await fetchPublicPhotos('da-quy', f as any);
      expect(f).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('mergeCarouselPhotos', () => {
  const api = [photo('a', '2026-01-01'), photo('b', '2026-06-01')];

  it('chỉ có ảnh giữ chỗ + ảnh API → chỉ còn ảnh API (mới nhất trước)', () => {
    const r = mergeCarouselPhotos([placeholder], api, '#E8A0B4', 'Đá quý');
    expect(r).toHaveLength(2);
    expect(r.every((p) => p.status === 'approved' && p.author !== 'Chưa có')).toBe(true);
    expect(r[0].img?.src).toContain('b');
    expect(r[1].img?.src).toContain('a');
  });

  it('có ảnh Commons thật + ảnh API → Commons giữ nguyên ở đầu, API nối sau', () => {
    const r = mergeCarouselPhotos([commons], api, '#E8A0B4');
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual(commons);
    expect(r[1].img?.src).toContain('b');
    expect(r[2].img?.src).toContain('a');
  });

  it('API rỗng → giữ nguyên danh sách ban đầu', () => {
    expect(mergeCarouselPhotos([placeholder], [])).toEqual([placeholder]);
  });
});

describe('publicPhotoToCarouselPhoto', () => {
  it('có srcset gồm src600 (600w) và src (1200w), chú thích chứa tác giả và giấy phép', () => {
    const s = publicPhotoToCarouselPhoto(
      photo('x', '2026-01-01', { src: '/full.webp', src600: '/small.webp', author: 'Trần B', license: 'CC0' }),
      '#fff',
    );
    expect(s.img?.srcset).toContain('/small.webp 600w');
    expect(s.img?.srcset).toContain('/full.webp 1200w');
    expect(s.img?.src).toBe('/full.webp');
    expect(s.author).toBe('Trần B');
    expect(s.license).toBe('CC0');
    const caption = formatCarouselCaption(s);
    expect(caption).toContain('Trần B');
    expect(caption).toContain('CC0');
  });
});

describe('fetchCovers', () => {
  const cover = { id: 'x1', src: '/api/anh/x1.webp', src600: '/api/anh/x1-600.webp', author: 'A', license: 'CC0' };

  it('gọi /api/anh/bia đúng 1 lần dù gọi nhiều lần', async () => {
    const f = vi.fn(async () => jsonRes({ covers: { 'da-quy': cover } }));
    const [r1, r2] = await Promise.all([fetchCovers(f as any), fetchCovers(f as any)]);
    await fetchCovers(f as any);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith('/api/anh/bia');
    expect(r1['da-quy'].src600).toBe('/api/anh/x1-600.webp');
    expect(r2).toEqual(r1);
  });

  it('fetch lỗi mạng → {}', async () => {
    const f = vi.fn(async () => {
      throw new Error('mạng lỗi');
    });
    expect(await fetchCovers(f as any)).toEqual({});
  });

  it('HTTP 500 → {}', async () => {
    const f = vi.fn(async () => jsonRes({ error: 'x' }, 500));
    expect(await fetchCovers(f as any)).toEqual({});
  });
});

describe('applyCoverToFlower', () => {
  const cover = { id: 'x1', src: '/api/anh/x1.webp', src600: '/api/anh/x1-600.webp', author: 'A', license: 'CC0' };
  const covers = { 'da-quy': cover };

  it('loài chỉ có ảnh giữ chỗ + có cover → dùng src600 của cover', () => {
    const f = { slug: 'da-quy', name: 'Dã quỳ', status: 'pending', author: 'Chưa có' };
    const out = applyCoverToFlower(f, covers);
    expect(out.photo?.src).toBe('/api/anh/x1-600.webp');
    expect(out.photo?.srcset).toContain('/api/anh/x1-600.webp');
  });

  it('loài chưa có photo.src + có cover → dùng cover', () => {
    const out = applyCoverToFlower({ slug: 'da-quy' }, covers);
    expect(out.photo?.src).toBe('/api/anh/x1-600.webp');
  });

  it('loài có ảnh Commons thật → giữ nguyên', () => {
    const f = {
      slug: 'da-quy',
      status: 'approved',
      author: 'Wikimedia User',
      photo: { src: '/c.webp', srcset: '/c.webp 800w', width: 800, height: 600 },
    };
    const out = applyCoverToFlower(f, covers);
    expect(out).toBe(f);
    expect(out.photo?.src).toBe('/c.webp');
  });

  it('loài không có cover → giữ nguyên', () => {
    const f = { slug: 'sen', status: 'pending', author: 'Chưa có' };
    expect(applyCoverToFlower(f, covers)).toBe(f);
    expect(applyCoverToFlower(f, {})).toBe(f);
  });
});

describe('sanitizeAuthorLink', () => {
  it('chỉ chấp nhận http/https, từ chối javascript:/data:/rỗng', () => {
    expect(sanitizeAuthorLink('https://example.com/u')).toBe('https://example.com/u');
    expect(sanitizeAuthorLink('http://example.com/u')).toBe('http://example.com/u');
    expect(sanitizeAuthorLink('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeAuthorLink('data:text/html,<h1>x</h1>')).toBeUndefined();
    expect(sanitizeAuthorLink('')).toBeUndefined();
    expect(sanitizeAuthorLink(null)).toBeUndefined();
  });
});

describe('mergeGridPhotos & publicPhotoToGridItem', () => {
  const api = [
    photo('a', '2026-01-01', { src: '/a.webp', src600: '/a-600.webp', author_link: 'https://example.com/a' }),
    photo('b', '2026-06-01', { src: '/b.webp', src600: '/b-600.webp', author_link: 'javascript:evil()' }),
  ];

  it('chỉ có ảnh giữ chỗ và API rỗng → mảng rỗng (ẩn mục Ảnh, không hiện ảnh giữ chỗ)', () => {
    expect(mergeGridPhotos([placeholder], [])).toEqual([]);
  });

  it('chỉ có ảnh giữ chỗ + có ảnh duyệt → chỉ hiện ảnh duyệt (src600 trong lưới, src trong lightbox), bỏ giữ chỗ', () => {
    const r = mergeGridPhotos([placeholder], api, '#E8A0B4', 'Dã quỳ');
    expect(r).toHaveLength(2);
    expect(r[0].thumbSrc).toBe('/b-600.webp');
    expect(r[0].fullSrc).toBe('/b.webp');
    expect(r[0].authorLink).toBeUndefined();
    expect(r[1].thumbSrc).toBe('/a-600.webp');
    expect(r[1].fullSrc).toBe('/a.webp');
    expect(r[1].authorLink).toBe('https://example.com/a');
  });

  it('có 1 ảnh Commons thật + API rỗng → hiện 1 ảnh thật', () => {
    const r = mergeGridPhotos([commons], [], '#E8A0B4');
    expect(r).toHaveLength(1);
    expect(r[0].author).toBe('Wikimedia User');
    expect(r[0].license).toBe('CC BY-SA 4.0');
  });

  it('có ảnh Commons + ảnh duyệt → gộp chung trong một danh sách (Commons trước, ảnh duyệt mới nhất sau)', () => {
    const r = mergeGridPhotos([commons, placeholder], api, '#E8A0B4');
    expect(r).toHaveLength(3);
    expect(r[0].author).toBe('Wikimedia User');
    expect(r[1].thumbSrc).toBe('/b-600.webp');
    expect(r[2].thumbSrc).toBe('/a-600.webp');
  });

  it('publicPhotoToGridItem tạo đường dẫn dự phòng từ id khi thiếu src/src600', () => {
    const item = publicPhotoToGridItem(photo('p99', '2026-02-01'), '#fff', 'Hoa ban');
    expect(item.thumbSrc).toBe('/api/anh/p99-600.webp');
    expect(item.fullSrc).toBe('/api/anh/p99.webp');
    expect(item.license).toBe('CC BY 4.0');
  });
});

describe('lưới ảnh — bổ sung theo spec', () => {
  const three = [
    photo('a', '2026-01-01', { src: '/a.webp', src600: '/a-600.webp' }),
    photo('b', '2026-02-01', { src: '/b.webp', src600: '/b-600.webp' }),
    photo('c', '2026-03-01', { src: '/c.webp', src600: '/c-600.webp' }),
  ];

  it('chỉ ảnh giữ chỗ + 3 ảnh đã duyệt → đúng 3 ô, không có ô giữ chỗ', () => {
    const r = mergeGridPhotos([placeholder], three, '#E8A0B4', 'Dã quỳ');
    expect(r).toHaveLength(3);
    expect(r.every((i) => i.id.startsWith('api-'))).toBe(true);
    expect(r.every((i) => i.author !== 'Chưa có')).toBe(true);
  });

  it('không có gì (mảng rỗng cả hai) → lưới rỗng', () => {
    expect(mergeGridPhotos([], [])).toEqual([]);
  });

  it('mỗi ô mang tác giả và giấy phép để dựng chú thích', () => {
    const [item] = mergeGridPhotos([], [three[0]]);
    expect(item.author).toBe('Nguyễn Văn A');
    expect(item.license).toBe('CC BY 4.0');
    expect(item.thumbSrc).toBe('/a-600.webp');
    expect(item.fullSrc).toBe('/a.webp');
  });

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'ftp://x.com', '//evil.com', 'vbscript:x'])(
    'author_link %j bị bỏ',
    (link) => {
      const item = publicPhotoToGridItem(photo('x', '2026-01-01', { author_link: link }), '#fff');
      expect(item.authorLink).toBeUndefined();
    },
  );

  it('author_link https hợp lệ được giữ', () => {
    const item = publicPhotoToGridItem(photo('x', '2026-01-01', { author_link: 'https://a.vn/u' }), '#fff');
    expect(item.authorLink).toBe('https://a.vn/u');
  });

  it('Carousel và lưới cùng dùng chung một lần gọi /api/anh?flower=', async () => {
    const f = vi.fn(async () => jsonRes({ photos: three }));
    await Promise.all([
      fetchPublicPhotos('da-quy', f as unknown as typeof fetch),
      fetchPublicPhotos('da-quy', f as unknown as typeof fetch),
    ]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith('/api/anh?flower=da-quy');
  });
});
