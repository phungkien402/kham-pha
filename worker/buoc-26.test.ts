// Test bước 26: thêm loài hoa / địa điểm, link Google Maps, build kết hợp.
// D1 + R2 trong bộ nhớ (getPlatformProxy). Turnstile, redirect Maps và API build Cloudflare đều mock — không gọi mạng thật.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, {
  isValidGoogleMapsUrl,
  loadCombinedData,
  mergeBySlug,
  mergeRemoteData,
  parseCoordsFromMapsUrl,
  resolveMapsUrlAndExtractCoords,
  slugifyVietnamese,
} from './index';

const ORIGIN = 'https://kham-pha.test';
const IP = '203.0.113.7';
const BYPASS = { DEV_BYPASS_AUTH: '1' };
const BUILD_ENV = { CF_BUILD_TOKEN: 'tok', CF_ACCOUNT_ID: 'acc', CF_BUILD_TRIGGER_ID: 'trg' };

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let db: any;
let bucket: any;
let turnstileFetch: ReturnType<typeof vi.fn>;
let mapsFetch: ReturnType<typeof vi.fn>;
let buildFetch: ReturnType<typeof vi.fn>;

function makeWebp(): Uint8Array {
  const head = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const out = new Uint8Array(head.length + 20);
  out.set(head);
  return out;
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: db,
    BUCKET: bucket,
    ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
    TURNSTILE_SECRET: 'secret-test',
    TURNSTILE_FETCH: turnstileFetch,
    MAPS_FETCH: mapsFetch,
    BUILD_FETCH: buildFetch,
    IP_SALT: 'muoi-test',
    ...overrides,
  } as any;
}

function call(path: string, init?: RequestInit, envOverrides: Record<string, unknown> = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), makeEnv(envOverrides));
}

function postJson(path: string, body: unknown, envOverrides: Record<string, unknown> = {}, ip = IP) {
  return call(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify(body),
    },
    envOverrides,
  );
}

function flowerBody(over: Record<string, unknown> = {}) {
  return {
    name: 'Hoa Thử Nghiệm',
    seasons: [{ start: { month: 3, day: 1 }, end: { month: 4, day: 30 } }],
    regions: ['bac'],
    places: ['da-lat'],
    'cf-turnstile-response': 'token-tot',
    ...over,
  };
}

function placeBody(over: Record<string, unknown> = {}) {
  return {
    name: 'Đồi Hoa Thử',
    province: 'Lâm Đồng',
    region: 'trung',
    'cf-turnstile-response': 'token-tot',
    ...over,
  };
}

function without(obj: Record<string, unknown>, key: string) {
  const { [key]: _omit, ...rest } = obj;
  return rest;
}

async function applyMigrations() {
  const dir = join(process.cwd(), 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join(' ');
    for (const stmt of sql.split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
      await db.prepare(stmt).run();
    }
  }
}

async function rows(table: string): Promise<any[]> {
  return (await db.prepare(`SELECT * FROM ${table}`).all()).results;
}

async function publicData(): Promise<{ flowers: any[]; places: any[] }> {
  const res = await call('/api/du-lieu');
  expect(res.status).toBe(200);
  return res.json();
}

async function submitFlowerOk(over: Record<string, unknown> = {}, ip = IP): Promise<string> {
  const res = await postJson('/api/them-hoa', flowerBody(over), {}, ip);
  expect(res.status).toBe(200);
  return ((await res.json()) as any).slug;
}

async function submitPlaceOk(over: Record<string, unknown> = {}, ip = IP): Promise<string> {
  const res = await postJson('/api/them-dia-diem', placeBody(over), {}, ip);
  expect(res.status).toBe(200);
  return ((await res.json()) as any).slug;
}

function adminPost(path: string, body: unknown = {}, env: Record<string, unknown> = {}) {
  return postJson(path, body, { ...BYPASS, ...env });
}

beforeAll(async () => {
  proxy = await getPlatformProxy({ persist: false, remoteBindings: false });
  db = (proxy.env as any).DB;
  bucket = (proxy.env as any).BUCKET;
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  turnstileFetch = vi.fn(async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: body.response !== 'token-xau' }), { status: 200 });
  });
  mapsFetch = vi.fn(async (url: string) => {
    if (String(url).includes('maps.app.goo.gl/')) {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://www.google.com/maps/place/Ho+Guom/@21.0285,105.8542,17z' },
      });
    }
    return new Response('', { status: 200 });
  });
  buildFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));

  for (const t of ['photos', 'flowers_extra', 'places_extra', 'build_state']) {
    await db.prepare(`DROP TABLE IF EXISTS ${t}`).run();
  }
  await applyMigrations();
  const res: any = await bucket.list();
  const keys = res.objects.map((o: any) => o.key);
  if (keys.length) await bucket.delete(keys);
});

describe('1. Khách thêm loài (POST /api/them-hoa)', () => {
  for (const field of ['name', 'seasons', 'regions', 'places']) {
    it(`thiếu ${field} → 400, không ghi D1`, async () => {
      const res = await postJson('/api/them-hoa', without(flowerBody(), field));
      expect(res.status).toBe(400);
      expect(await rows('flowers_extra')).toHaveLength(0);
    });
  }

  it('thiếu Turnstile → 400, không gọi siteverify, không ghi D1', async () => {
    const res = await postJson('/api/them-hoa', without(flowerBody(), 'cf-turnstile-response'));
    expect(res.status).toBe(400);
    expect(turnstileFetch).not.toHaveBeenCalled();
    expect(await rows('flowers_extra')).toHaveLength(0);
  });

  it('Turnstile bị siteverify từ chối → 400', async () => {
    const res = await postJson('/api/them-hoa', flowerBody({ 'cf-turnstile-response': 'token-xau' }));
    expect(res.status).toBe(400);
    expect(turnstileFetch).toHaveBeenCalled();
    expect(await rows('flowers_extra')).toHaveLength(0);
  });

  it('hợp lệ → pending/public, KHÔNG có trong GET /api/du-lieu', async () => {
    const res = await postJson('/api/them-hoa', flowerBody());
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.status).toBe('pending');

    const stored = await rows('flowers_extra');
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe('pending');
    expect(stored[0].source).toBe('public');
    expect(String(stored[0].ip_hash)).not.toContain(IP);

    const data = await publicData();
    expect(data.flowers.map((f) => f.slug)).not.toContain(json.slug);
  });

  it('thiếu màu → tự chọn màu #RRGGBB; đỉnh nở mặc định được điền', async () => {
    const slug = await submitFlowerOk();
    const data = JSON.parse((await rows('flowers_extra')).find((r) => r.slug === slug).data);
    expect(data.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(data.seasons[0].peak).toBeTruthy();
  });
});

describe('2. Hạn mức 5 loài/ngày/IP', () => {
  it('lần thứ 6 cùng IP → 429; IP khác vẫn gửi được', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postJson('/api/them-hoa', flowerBody({ name: `Hoa Số ${i}` }));
      expect(res.status, `lần ${i + 1}`).toBe(200);
    }
    const sixth = await postJson('/api/them-hoa', flowerBody({ name: 'Hoa Số 6' }));
    expect(sixth.status).toBe(429);
    expect(await rows('flowers_extra')).toHaveLength(5);

    const other = await postJson('/api/them-hoa', flowerBody({ name: 'Hoa Số 6' }), {}, '198.51.100.99');
    expect(other.status).toBe(200);
  });

  it('địa điểm: lần thứ 6 cùng IP → 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postJson('/api/them-dia-diem', placeBody({ name: `Điểm ${i}` }));
      expect(res.status, `lần ${i + 1}`).toBe(200);
    }
    const sixth = await postJson('/api/them-dia-diem', placeBody({ name: 'Điểm 6' }));
    expect(sixth.status).toBe(429);
  });
});

describe('3. Admin thêm loài / quyền truy cập', () => {
  it('admin thêm loài → approved ngay, có trong /api/du-lieu', async () => {
    const res = await adminPost('/api/admin/flowers', flowerBody({ name: 'Hoa Admin' }));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.status).toBe('approved');
    expect(json.source).toBe('admin');
    const data = await publicData();
    expect(data.flowers.map((f) => f.slug)).toContain(json.slug);
  });

  it('admin thêm loài thiếu trường bắt buộc → 400', async () => {
    const res = await adminPost('/api/admin/flowers', without(flowerBody(), 'regions'));
    expect(res.status).toBe(400);
  });

  it('admin thêm địa điểm → approved ngay, có trong /api/du-lieu', async () => {
    const res = await adminPost('/api/admin/places', placeBody());
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.status).toBe('approved');
    const data = await publicData();
    expect(data.places.map((p) => p.slug)).toContain(json.slug);
  });

  const adminRoutes: Array<[string, string]> = [
    ['GET', '/api/admin/flowers'],
    ['POST', '/api/admin/flowers'],
    ['PUT', '/api/admin/flowers/x'],
    ['DELETE', '/api/admin/flowers/x'],
    ['POST', '/api/admin/flowers/x/approve'],
    ['POST', '/api/admin/flowers/x/reject'],
    ['GET', '/api/admin/places'],
    ['POST', '/api/admin/places'],
    ['PUT', '/api/admin/places/x'],
    ['DELETE', '/api/admin/places/x'],
    ['POST', '/api/admin/places/x/approve'],
    ['POST', '/api/admin/places/x/reject'],
    ['GET', '/api/admin/build-status'],
    ['POST', '/api/admin/build'],
  ];
  for (const [method, path] of adminRoutes) {
    it(`không Access → 403: ${method} ${path}`, async () => {
      const res = await call(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(flowerBody()),
      });
      expect(res.status).toBe(403);
      expect(await rows('flowers_extra')).toHaveLength(0);
      expect(await rows('places_extra')).toHaveLength(0);
      expect(buildFetch).not.toHaveBeenCalled();
    });
  }
});

describe('4. Duyệt / từ chối loài khách gửi', () => {
  it('duyệt → approved, xuất hiện trong /api/du-lieu', async () => {
    const slug = await submitFlowerOk();
    const res = await adminPost(`/api/admin/flowers/${slug}/approve`);
    expect(res.status).toBe(200);
    expect((await rows('flowers_extra'))[0].status).toBe('approved');
    const data = await publicData();
    expect(data.flowers.map((f) => f.slug)).toContain(slug);
  });

  it('từ chối → rejected, không có trong /api/du-lieu', async () => {
    const slug = await submitFlowerOk();
    const res = await adminPost(`/api/admin/flowers/${slug}/reject`);
    expect(res.status).toBe(200);
    expect((await rows('flowers_extra'))[0].status).toBe('rejected');
    const data = await publicData();
    expect(data.flowers.map((f) => f.slug)).not.toContain(slug);
  });

  it('duyệt địa điểm khách gửi → có trong /api/du-lieu; pending thì không', async () => {
    const slug = await submitPlaceOk();
    expect((await publicData()).places.map((p) => p.slug)).not.toContain(slug);
    const res = await adminPost(`/api/admin/places/${slug}/approve`);
    expect(res.status).toBe(200);
    expect((await publicData()).places.map((p) => p.slug)).toContain(slug);
  });

  it('duyệt slug không tồn tại → 404', async () => {
    const res = await adminPost('/api/admin/flowers/khong-co/approve');
    expect(res.status).toBe(404);
  });
});

describe('5. Slug', () => {
  it('slugifyVietnamese bỏ dấu, đ → d', () => {
    expect(slugifyVietnamese('Hoa Ban Trắng')).toBe('hoa-ban-trang');
    expect(slugifyVietnamese('Đồng Hoa Cải')).toBe('dong-hoa-cai');
  });

  it('tên có dấu → slug không dấu khi lưu', async () => {
    const slug = await submitFlowerOk({ name: 'Hoa Ban Trắng' });
    expect(slug).toBe('hoa-ban-trang');
  });

  it('trùng slug trong flowers.json (da-quy) → thêm hậu tố, không ghi đè', async () => {
    const slug = await submitFlowerOk({ name: 'Dạ Quý' });
    expect(slug).not.toBe('da-quy');
    expect(slug).toMatch(/^da-quy-\d+$/);
  });

  it('trùng slug với loài đã gửi trước → hậu tố tăng dần, cả hai còn nguyên', async () => {
    const a = await submitFlowerOk({ name: 'Hoa Trùng' });
    const b = await submitFlowerOk({ name: 'Hoa Trùng' });
    const c = await submitFlowerOk({ name: 'Hoa Trùng' });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(a).toBe('hoa-trung');
    expect(await rows('flowers_extra')).toHaveLength(3);
  });

  it('địa điểm trùng slug có sẵn (da-lat) → thêm hậu tố', async () => {
    const slug = await submitPlaceOk({ name: 'Đà Lạt' });
    expect(slug).toMatch(/^da-lat-\d+$/);
  });
});

describe('6. Link Google Maps của địa điểm', () => {
  it('host lạ → 400', async () => {
    for (const bad of ['https://evil.com/maps', 'https://maps.google.com.evil.com/x', 'ftp://www.google.com/maps/x']) {
      const res = await postJson('/api/them-dia-diem', placeBody({ maps_url: bad }));
      expect(res.status, bad).toBe(400);
    }
    expect(await rows('places_extra')).toHaveLength(0);
  });

  it('javascript: → 400', async () => {
    const res = await postJson('/api/them-dia-diem', placeBody({ maps_url: 'javascript:alert(1)' }));
    expect(res.status).toBe(400);
    const adminRes = await adminPost('/api/admin/places', placeBody({ maps_url: 'javascript:alert(1)' }));
    expect(adminRes.status).toBe(400);
    expect(await rows('places_extra')).toHaveLength(0);
  });

  it('isValidGoogleMapsUrl: chấp nhận 4 dạng host cho phép, từ chối còn lại', () => {
    expect(isValidGoogleMapsUrl('https://www.google.com/maps/place/X')).toBe(true);
    expect(isValidGoogleMapsUrl('https://maps.google.com/?q=1,2')).toBe(true);
    expect(isValidGoogleMapsUrl('https://maps.app.goo.gl/abc')).toBe(true);
    expect(isValidGoogleMapsUrl('https://goo.gl/maps/abc')).toBe(true);
    expect(isValidGoogleMapsUrl('https://www.google.com/search?q=x')).toBe(false);
    expect(isValidGoogleMapsUrl('https://evil.com/maps')).toBe(false);
    expect(isValidGoogleMapsUrl('javascript:alert(1)')).toBe(false);
    expect(isValidGoogleMapsUrl('')).toBe(false);
  });

  const coordCases: Array<[string, string, number, number]> = [
    ['@lat,lng', 'https://www.google.com/maps/place/X/@16.0471,108.2068,15z', 16.0471, 108.2068],
    ['!3d!4d', 'https://www.google.com/maps/place/X/data=!4m2!3d21.0285!4d105.8542', 21.0285, 105.8542],
    ['?q=lat,lng', 'https://maps.google.com/?q=10.7769,106.7009', 10.7769, 106.7009],
  ];
  for (const [label, url, lat, lng] of coordCases) {
    it(`trích toạ độ mẫu ${label}`, async () => {
      expect(parseCoordsFromMapsUrl(url)).toEqual({ lat, lng });
      const res = await postJson('/api/them-dia-diem', placeBody({ maps_url: url }));
      expect(res.status).toBe(200);
      const json: any = await res.json();
      expect(json.lat).toBeCloseTo(lat, 4);
      expect(json.lng).toBeCloseTo(lng, 4);
      const stored = JSON.parse((await rows('places_extra'))[0].data);
      expect(stored.lat).toBeCloseTo(lat, 4);
      expect(stored.lng).toBeCloseTo(lng, 4);
      expect(stored.maps_url).toBe(url);
    });
  }

  it('maps.app.goo.gl: theo redirect (mock) tới link có @lat,lng', async () => {
    const short = 'https://maps.app.goo.gl/AbCdEf123';
    expect(await resolveMapsUrlAndExtractCoords(short, undefined, mapsFetch as any)).toEqual({
      lat: 21.0285,
      lng: 105.8542,
    });
    const res = await postJson('/api/them-dia-diem', placeBody({ maps_url: short }));
    expect(res.status).toBe(200);
    expect(mapsFetch).toHaveBeenCalled();
    const json: any = await res.json();
    expect(json.lat).toBeCloseTo(21.0285, 4);
    expect(json.lng).toBeCloseTo(105.8542, 4);
  });

  it('link không có toạ độ → lưu được, lat/lng rỗng', async () => {
    const url = 'https://www.google.com/maps/place/Ho+Guom';
    const res = await postJson('/api/them-dia-diem', placeBody({ maps_url: url }));
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.lat).toBeNull();
    expect(json.lng).toBeNull();
    const stored = JSON.parse((await rows('places_extra'))[0].data);
    expect(stored.lat).toBeUndefined();
    expect(stored.lng).toBeUndefined();
    expect(stored.maps_url).toBe(url);
  });

  it('thiếu tên / tỉnh / vùng → 400', async () => {
    for (const f of ['name', 'province', 'region']) {
      const res = await postJson('/api/them-dia-diem', without(placeBody(), f));
      expect(res.status, f).toBe(400);
    }
  });

  it('không Turnstile → 400', async () => {
    const res = await postJson('/api/them-dia-diem', without(placeBody(), 'cf-turnstile-response'));
    expect(res.status).toBe(400);
  });
});

describe('7. Ảnh kèm maps_url (POST /api/gui-anh)', () => {
  function photoForm(mapsUrl?: string) {
    const form = new FormData();
    form.set('file', new Blob([makeWebp()], { type: 'image/webp' }), 'a.webp');
    form.set('file600', new Blob([makeWebp()], { type: 'image/webp' }), 'a-600.webp');
    form.set('flower', 'da-quy');
    form.set('cf-turnstile-response', 'token-tot');
    form.set('author', 'Người gửi thử');
    form.set('consent', 'on');
    if (mapsUrl !== undefined) form.set('maps_url', mapsUrl);
    return form;
  }
  const send = (form: FormData) =>
    call('/api/gui-anh', { method: 'POST', body: form, headers: { 'CF-Connecting-IP': IP } });

  it('maps_url hợp lệ → lưu vào cột photos.maps_url', async () => {
    const url = 'https://www.google.com/maps/place/X/@16.0471,108.2068,15z';
    const res = await send(photoForm(url));
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    const r = await rows('photos');
    expect(r).toHaveLength(1);
    expect(r[0].maps_url).toBe(url);
  });

  it('không có maps_url → vẫn lưu, maps_url null', async () => {
    const res = await send(photoForm());
    expect(res.status).toBeLessThan(300);
    expect((await rows('photos'))[0].maps_url).toBeNull();
  });

  it('maps_url host lạ → 400, không lưu ảnh nào', async () => {
    const res = await send(photoForm('https://evil.com/maps'));
    expect(res.status).toBe(400);
    expect(await rows('photos')).toHaveLength(0);
    const listed: any = await bucket.list();
    expect(listed.objects).toHaveLength(0);
  });
});

describe('8. Kích hoạt build', () => {
  // Quy tắc đổi 2026-10-28: không gộp build (gộp làm lần duyệt thứ 2 không bao giờ được build).
  it('duyệt 2 loài liên tiếp → mỗi lần duyệt đều gọi build (không bỏ sót)', async () => {
    const a = await submitFlowerOk({ name: 'Hoa Một' });
    const b = await submitFlowerOk({ name: 'Hoa Hai' });
    const r1 = await adminPost(`/api/admin/flowers/${a}/approve`, {}, BUILD_ENV);
    const r2 = await adminPost(`/api/admin/flowers/${b}/approve`, {}, BUILD_ENV);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(buildFetch).toHaveBeenCalledTimes(2);
    const state = await rows('build_state');
    expect(state).toHaveLength(1);
  });

  it('thiếu secret → duyệt vẫn thành công, không gọi API build, không ném lỗi', async () => {
    const slug = await submitFlowerOk();
    const res = await adminPost(`/api/admin/flowers/${slug}/approve`);
    expect(res.status).toBe(200);
    expect(buildFetch).not.toHaveBeenCalled();
    expect((await rows('flowers_extra'))[0].status).toBe('approved');
    const json: any = await res.json();
    expect(json.build?.configured).toBe(false);
  });

  it('API build ném lỗi mạng → duyệt vẫn thành công', async () => {
    buildFetch.mockRejectedValueOnce(new Error('network down'));
    const slug = await submitFlowerOk();
    const res = await adminPost(`/api/admin/flowers/${slug}/approve`, {}, BUILD_ENV);
    expect(res.status).toBe(200);
    expect((await rows('flowers_extra'))[0].status).toBe('approved');
  });

  it('gọi API build kèm Bearer token của secret', async () => {
    const slug = await submitFlowerOk();
    await adminPost(`/api/admin/flowers/${slug}/approve`, {}, BUILD_ENV);
    expect(buildFetch).toHaveBeenCalledTimes(1);
    const [url, init] = buildFetch.mock.calls[0] as [string, any];
    expect(String(url)).toContain('acc');
    expect(String(url)).toContain('trg');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('nút "Build lại web ngay" (POST /api/admin/build) bỏ qua debounce', async () => {
    const slug = await submitFlowerOk();
    await adminPost(`/api/admin/flowers/${slug}/approve`, {}, BUILD_ENV);
    expect(buildFetch).toHaveBeenCalledTimes(1);
    const res = await adminPost('/api/admin/build', {}, BUILD_ENV);
    expect(res.status).toBe(200);
    expect(buildFetch).toHaveBeenCalledTimes(2);
  });

  it('thiếu secret: nút build thủ công không lỗi, báo chưa cấu hình', async () => {
    const res = await adminPost('/api/admin/build');
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.configured).toBe(false);
    expect(buildFetch).not.toHaveBeenCalled();
  });
});

describe('Build kết hợp (remoteData)', () => {
  const baseFlowers = [{ slug: 'da-quy', name: 'Dạ Quý (gốc)' }];
  const basePlaces = [{ slug: 'da-lat', name: 'Đà Lạt (gốc)' }];

  it('mergeBySlug: JSON gốc thắng khi trùng slug, thêm slug mới', () => {
    const merged = mergeBySlug(baseFlowers, [
      { slug: 'da-quy', name: 'Bản API ghi đè?' },
      { slug: 'hoa-moi', name: 'Hoa mới' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((f) => f.slug === 'da-quy')!.name).toBe('Dạ Quý (gốc)');
    expect(merged.find((f) => f.slug === 'hoa-moi')).toBeTruthy();
  });

  it('mergeRemoteData: gộp cả flowers và places', () => {
    const out = mergeRemoteData(
      { flowers: baseFlowers, places: basePlaces },
      { flowers: [{ slug: 'hoa-moi', name: 'x' } as any], places: [{ slug: 'diem-moi', name: 'y' } as any] },
    );
    expect(out.flowers.map((f) => f.slug)).toEqual(['da-quy', 'hoa-moi']);
    expect(out.places.map((p) => p.slug)).toEqual(['da-lat', 'diem-moi']);
  });

  it('loadCombinedData: API thêm loài mới, JSON gốc thắng khi trùng', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            flowers: [
              { slug: 'da-quy', name: 'Ghi đè?' },
              { slug: 'hoa-moi', name: 'Hoa mới' },
            ],
            places: [],
          }),
          { status: 200 },
        ),
    );
    const out = await loadCombinedData({
      env: {},
      baseFlowers,
      basePlaces,
      fetchImpl: fetchImpl as any,
      siteUrl: 'https://site.test/',
      warn: () => {},
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String((fetchImpl.mock.calls[0] as any[])[0])).toBe('https://site.test/api/du-lieu');
    expect(out.flowers.map((f) => f.slug)).toEqual(['da-quy', 'hoa-moi']);
    expect(out.flowers[0].name).toBe('Dạ Quý (gốc)');
    expect(out.flowers.every((f) => f.id === f.slug)).toBe(true);
  });

  it('SKIP_REMOTE_DATA=1 bỏ qua API, chỉ dùng JSON, in cảnh báo', async () => {
    const fetchImpl = vi.fn();
    const warn = vi.fn();
    const out = await loadCombinedData({
      env: { SKIP_REMOTE_DATA: '1' },
      baseFlowers,
      basePlaces,
      fetchImpl: fetchImpl as any,
      warn,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(out.flowers.map((f) => f.slug)).toEqual(['da-quy']);
  });

  it('SKIP_REMOTE_DATA=1 với JSON thật vẫn ra đủ 13 loài gốc', async () => {
    const fetchImpl = vi.fn();
    const out = await loadCombinedData({ env: { SKIP_REMOTE_DATA: '1' }, fetchImpl: fetchImpl as any, warn: () => {} });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out.flowers).toHaveLength(13);
  });

  it('API lỗi khi build trên Cloudflare (strict) → ném lỗi, build thất bại', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    await expect(
      loadCombinedData({ env: {}, baseFlowers, basePlaces, fetchImpl: fetchImpl as any, strict: true, warn: () => {} }),
    ).rejects.toThrow();
  });

  it('API lỗi khi build local (không strict) → cảnh báo, dùng JSON', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const warn = vi.fn();
    const out = await loadCombinedData({
      env: {},
      baseFlowers,
      basePlaces,
      fetchImpl: fetchImpl as any,
      strict: false,
      warn,
    });
    expect(warn).toHaveBeenCalled();
    expect(out.flowers.map((f) => f.slug)).toEqual(['da-quy']);
  });
});
