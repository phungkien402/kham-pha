// Test bước 33 (bot thu thập tin mùa hoa) theo spec docs/buoc-33-thu-thap.md, mục Worker và "Xong khi".
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const ORIGIN = 'https://kham-pha.test';
const TOKEN = 'bot-secret-test';
const BYPASS = { DEV_BYPASS_AUTH: '1' };
const SRC = [{ url: 'https://vnexpress.net/bai-viet', title: 'Bài báo', published: '2026-10-27' }];

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let db: any;
let bucket: any;
let buildFetch: ReturnType<typeof vi.fn>;

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: db,
    BUCKET: bucket,
    ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
    BOT_TOKEN: TOKEN,
    BUILD_FETCH: buildFetch,
    CF_DEPLOY_HOOK: 'hook-test',
    ...overrides,
  } as any;
}

function call(path: string, init?: RequestInit, env: Record<string, unknown> = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), makeEnv(env));
}

function botPost(body: unknown, headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` }, env = {}) {
  return call(
    '/api/bot/de-xuat',
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) },
    env,
  );
}

function botGet(path: string, headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` }) {
  return call(path, { method: 'GET', headers });
}

function adminPost(path: string, body: unknown = {}) {
  return call(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    BYPASS,
  );
}

function newFlower(over: Record<string, unknown> = {}) {
  return {
    kind: 'new_flower',
    summary: 'Loài mới',
    confidence: 0.8,
    sources: SRC,
    dedupe_key: 'new_flower:hoa-bot-thu',
    payload: {
      name: 'Hoa Bot Thử',
      seasons: [{ start: { month: 3, day: 1 }, end: { month: 4, day: 30 } }],
      regions: ['bac'],
      places: ['da-lat'],
    },
    ...over,
  };
}

function newPlace(over: Record<string, unknown> = {}) {
  return {
    kind: 'new_place',
    summary: 'Điểm mới',
    sources: SRC,
    dedupe_key: 'new_place:doi-bot-thu',
    payload: { name: 'Đồi Bot Thử', province: 'Lâm Đồng', region: 'trung' },
    ...over,
  };
}

function seasonUpdate(over: Record<string, unknown> = {}) {
  return {
    kind: 'season_update',
    summary: 'Nở sớm',
    sources: SRC,
    dedupe_key: 'season_update:da-quy:2026',
    payload: {
      slug: 'da-quy',
      year: 2026,
      start: { month: 10, day: 15 },
      peak: { month: 11, day: 5 },
      end: { month: 12, day: 10 },
      note: 'Nở sớm hơn thường lệ',
    },
    ...over,
  };
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

async function publicData(): Promise<any> {
  const res = await call('/api/du-lieu');
  expect(res.status).toBe(200);
  return res.json();
}

async function submitOne(item: unknown): Promise<string> {
  const res = await botPost({ suggestions: [item] });
  expect(res.status).toBe(200);
  const json: any = await res.json();
  expect(json.inserted).toBe(1);
  const list = await rows('suggestions');
  return list[list.length - 1].id;
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
  buildFetch = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  for (const t of [
    'photos', 'flowers_extra', 'places_extra', 'build_state',
    'suggestions', 'season_overrides', 'bot_requests',
  ]) {
    await db.prepare(`DROP TABLE IF EXISTS ${t}`).run();
  }
  await applyMigrations();
});

describe('Xác thực Bearer', () => {
  it('thiếu header Authorization → 401', async () => {
    const res = await botPost({ suggestions: [] }, {});
    expect(res.status).toBe(401);
  });

  it('Bearer sai → 401', async () => {
    const res = await botPost({ suggestions: [] }, { Authorization: 'Bearer sai-token' });
    expect(res.status).toBe(401);
  });

  it('GET /api/bot/tom-tat thiếu/sai Bearer → 401', async () => {
    expect((await botGet('/api/bot/tom-tat', {})).status).toBe(401);
    expect((await botGet('/api/bot/tom-tat', { Authorization: 'Bearer x' })).status).toBe(401);
  });

  it('chưa đặt BOT_TOKEN → 503', async () => {
    const res = await botPost({ suggestions: [] }, { Authorization: `Bearer ${TOKEN}` }, { BOT_TOKEN: undefined });
    expect(res.status).toBe(503);
  });

  it('Bearer đúng + body rỗng hợp lệ → 200', async () => {
    const res = await botPost({ suggestions: [] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inserted: 0, skipped: 0, errors: [] });
  });
});

describe('Kiểm tra body POST /api/bot/de-xuat', () => {
  it('31 mục → 400, không ghi D1', async () => {
    const list = Array.from({ length: 31 }, (_, i) => newPlace({ dedupe_key: `k${i}` }));
    const res = await botPost({ suggestions: list });
    expect(res.status).toBe(400);
    expect(await rows('suggestions')).toHaveLength(0);
  });

  it('đúng 30 mục → 200', async () => {
    const list = Array.from({ length: 30 }, (_, i) => newPlace({ dedupe_key: `k${i}` }));
    const res = await botPost({ suggestions: list });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).inserted).toBe(30);
  });

  it('mục sai shape báo lỗi riêng, mục đúng vẫn vào', async () => {
    const res = await botPost({
      suggestions: [
        newPlace({ dedupe_key: 'a' }),
        { kind: 'new_place', sources: SRC, payload: {}, dedupe_key: 'b' },
        newFlower({ dedupe_key: 'c' }),
        { kind: 'khong-hop-le', sources: SRC, payload: {}, dedupe_key: 'd' },
      ],
    });
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.inserted).toBe(2);
    expect(json.errors).toHaveLength(2);
    expect(json.errors.map((e: any) => e.index).sort()).toEqual([1, 3]);
    expect(await rows('suggestions')).toHaveLength(2);
  });

  it('dedupe_key trùng → skipped, không lỗi', async () => {
    await submitOne(newPlace());
    const res = await botPost({ suggestions: [newPlace()] });
    const json: any = await res.json();
    expect(res.status).toBe(200);
    expect(json.inserted).toBe(0);
    expect(json.skipped).toBe(1);
    expect(json.errors).toEqual([]);
    expect(await rows('suggestions')).toHaveLength(1);
  });

  it('source không phải http(s) → lỗi', async () => {
    const res = await botPost({
      suggestions: [
        newPlace({ sources: [{ url: 'ftp://x.com/a' }], dedupe_key: 'a' }),
        newPlace({ sources: [{ url: 'javascript:alert(1)' }], dedupe_key: 'b' }),
        newPlace({ sources: [], dedupe_key: 'c' }),
      ],
    });
    const json: any = await res.json();
    expect(json.inserted).toBe(0);
    expect(json.errors).toHaveLength(3);
  });

  it('maps_url host lạ → lỗi; link Google Maps hợp lệ → vào', async () => {
    const bad = newPlace({
      dedupe_key: 'bad',
      payload: { name: 'Đồi X', province: 'Lâm Đồng', region: 'trung', maps_url: 'https://evil.example.com/maps/place/x' },
    });
    const good = newPlace({
      dedupe_key: 'good',
      payload: { name: 'Đồi Y', province: 'Lâm Đồng', region: 'trung', maps_url: 'https://www.google.com/maps/place/Doi/@11.9,108.4,17z' },
    });
    const json: any = await (await botPost({ suggestions: [bad, good] })).json();
    expect(json.inserted).toBe(1);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0].index).toBe(0);
  });

  it('mục > 20 KB → lỗi riêng', async () => {
    const big = newPlace({ dedupe_key: 'big', summary: 'x'.repeat(21 * 1024) });
    const json: any = await (await botPost({ suggestions: [big, newPlace({ dedupe_key: 'ok' })] })).json();
    expect(json.inserted).toBe(1);
    expect(json.errors).toHaveLength(1);
  });

  it('mục lưu ở trạng thái pending', async () => {
    await submitOne(newFlower());
    const [r] = await rows('suggestions');
    expect(r.status).toBe('pending');
    expect(r.kind).toBe('new_flower');
  });
});

describe('GET /api/bot/tom-tat', () => {
  it('trả loài/điểm hiện có và dedupe_key gần đây', async () => {
    await submitOne(newPlace({ dedupe_key: 'dk-gan-day' }));
    const res = await botGet('/api/bot/tom-tat');
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.flowers.map((f: any) => f.slug)).toContain('da-quy');
    expect(Array.isArray(json.places)).toBe(true);
    const keys = json.dedupe_keys ?? json.dedupeKeys;
    expect(keys).toContain('dk-gan-day');
  });
});

describe('Access: route bot và admin', () => {
  it('/api/bot/* không cần Access (chỉ cần Bearer)', async () => {
    const res = await botGet('/api/bot/tom-tat');
    expect(res.status).toBe(200);
  });

  it('/api/admin/de-xuat* không có Access → 403', async () => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/admin/de-xuat'],
      ['GET', '/api/admin/de-xuat?status=pending'],
      ['POST', '/api/admin/de-xuat/abc/apply'],
      ['POST', '/api/admin/de-xuat/abc/dismiss'],
    ];
    for (const [method, path] of routes) {
      const res = await call(path, { method, headers: { Authorization: `Bearer ${TOKEN}` } });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
  });

  it('GET /api/admin/de-xuat có Access → liệt kê, lọc theo status', async () => {
    const id = await submitOne(newPlace());
    await adminPost(`/api/admin/de-xuat/${id}/dismiss`);
    await submitOne(newPlace({ dedupe_key: 'khac' }));

    const pending: any = await (await call('/api/admin/de-xuat?status=pending', {}, BYPASS)).json();
    const list = Array.isArray(pending) ? pending : pending.suggestions ?? pending.items;
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('pending');
  });
});

describe('Áp dụng đề xuất', () => {
  it('new_flower → loài approved trong /api/du-lieu và gọi build', async () => {
    const id = await submitOne(newFlower());
    const res = await adminPost(`/api/admin/de-xuat/${id}/apply`);
    expect(res.status).toBe(200);
    const data = await publicData();
    expect(
      data.flowers.some((f: any) => f.slug === 'hoa-bot-thu' || f.name === 'Hoa Bot Thử'),
    ).toBe(true);
    expect(buildFetch).toHaveBeenCalled();
    const [s] = await rows('suggestions');
    expect(s.status).toBe('applied');
    expect(s.reviewed_at).toBeTruthy();
  });

  it('new_place → địa điểm approved trong /api/du-lieu và gọi build', async () => {
    const id = await submitOne(newPlace());
    const res = await adminPost(`/api/admin/de-xuat/${id}/apply`);
    expect(res.status).toBe(200);
    const data = await publicData();
    expect(data.places.some((p: any) => p.name === 'Đồi Bot Thử' || p.slug === 'doi-bot-thu')).toBe(true);
    expect(buildFetch).toHaveBeenCalled();
  });

  it('season_update loài gốc JSON (da-quy) → /api/du-lieu có seasonOverrides, gọi build', async () => {
    const id = await submitOne(seasonUpdate());
    const res = await adminPost(`/api/admin/de-xuat/${id}/apply`);
    expect(res.status).toBe(200);
    const data = await publicData();
    expect(Array.isArray(data.seasonOverrides)).toBe(true);
    const ov = data.seasonOverrides.find((o: any) => o.slug === 'da-quy' && o.year === 2026);
    expect(ov).toBeTruthy();
    expect(ov.note).toBe('Nở sớm hơn thường lệ');
    expect(buildFetch).toHaveBeenCalled();
  });

  it('news → chỉ đánh dấu đã xem, không đổi dữ liệu', async () => {
    const id = await submitOne({
      kind: 'news',
      sources: SRC,
      dedupe_key: 'news:1',
      payload: { slug: 'da-quy', text: 'Dã quỳ bắt đầu nở' },
    });
    const before = await publicData();
    const res = await adminPost(`/api/admin/de-xuat/${id}/apply`);
    expect(res.status).toBe(200);
    expect(await publicData()).toEqual(before);
    expect((await rows('suggestions'))[0].status).toBe('applied');
  });

  it('apply id không tồn tại → 404', async () => {
    const res = await adminPost('/api/admin/de-xuat/khong-co/apply');
    expect(res.status).toBe(404);
  });
});

describe('Bỏ qua đề xuất (dismiss)', () => {
  it('đánh dấu dismissed, không đổi dữ liệu, không gọi build', async () => {
    const ids = [
      await submitOne(newFlower()),
      await submitOne(newPlace()),
      await submitOne(seasonUpdate()),
    ];
    const before = await publicData();
    for (const id of ids) {
      const res = await adminPost(`/api/admin/de-xuat/${id}/dismiss`);
      expect(res.status).toBe(200);
    }
    expect(await publicData()).toEqual(before);
    expect(buildFetch).not.toHaveBeenCalled();
    expect(await rows('flowers_extra')).toHaveLength(0);
    expect(await rows('places_extra')).toHaveLength(0);
    expect(await rows('season_overrides')).toHaveLength(0);
    expect((await rows('suggestions')).every((r) => r.status === 'dismissed')).toBe(true);
  });
});

describe('Giới hạn 10 request/giờ cho /api/bot/*', () => {
  it('request thứ 11 → 429 (cả hai route)', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await botGet('/api/bot/tom-tat');
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
    expect((await botGet('/api/bot/tom-tat')).status).toBe(429);
    expect((await botPost({ suggestions: [] })).status).toBe(429);
  });
});
