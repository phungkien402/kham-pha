// Test bước 32 (Worker GET /api/anh/tuan) theo spec docs/buoc-28-32-mua-hoa.md mục 32.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { getWeeklyPhotosCount, handleGetWeeklyPhotos } from './index';

const ORIGIN = 'https://kham-pha.test';

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let db: any;
let bucket: any;
let assetsFetch: ReturnType<typeof vi.fn>;

function makeEnv(overrides: Record<string, unknown> = {}) {
  return { DB: db, BUCKET: bucket, ASSETS: { fetch: assetsFetch }, ...overrides } as any;
}

function call(path: string, init?: RequestInit, envOverrides: Record<string, unknown> = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), makeEnv(envOverrides));
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

async function insertPhoto(opts: {
  id: string;
  flower: string;
  place?: string | null;
  status?: string;
  created_at: string;
  taken_on?: string | null;
}) {
  await db
    .prepare(
      `INSERT INTO photos (id, flower, place, status, author, license, width, height, source, created_at, taken_on)
       VALUES (?, ?, ?, ?, 'Người thử', 'CC BY-SA 4.0', 10, 10, 'admin', ?, ?)`,
    )
    .bind(
      opts.id,
      opts.flower,
      opts.place ?? null,
      opts.status ?? 'approved',
      opts.created_at,
      opts.taken_on ?? null,
    )
    .run();
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
  assetsFetch = vi.fn(async () => new Response('<html>asset</html>', { status: 200 }));
  await db.prepare('DROP TABLE IF EXISTS photos').run();
  await applyMigrations();
});

describe('Worker: GET /api/anh/tuan (bước 32)', () => {
  it('trả về 200 kèm header Cache-Control: public, max-age=300 và Content-Type json', async () => {
    const res = await call('/api/anh/tuan');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');

    const data = await res.json();
    expect(data).toEqual({ places: {}, flowers: {} });
  });

  it('hỗ trợ cả đường dẫn có dấu gạch chéo cuối /api/anh/tuan/', async () => {
    const res = await call('/api/anh/tuan/');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ places: {}, flowers: {} });
  });

  it('đếm đúng ảnh approved trong 7 ngày gần nhất, bỏ qua pending/rejected và ảnh cũ', async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    const fourDaysAgo = new Date(now.getTime() - 4 * 86_400_000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000).toISOString();

    // 1. Approved dã quỳ ở Ba Vì (2 ngày trước) -> đếm
    await insertPhoto({
      id: 'p1',
      flower: 'da-quy',
      place: 'ba-vi',
      status: 'approved',
      created_at: twoDaysAgo,
    });

    // 2. Approved dã quỳ ở Ba Vì (4 ngày trước, có taken_on) -> đếm
    await insertPhoto({
      id: 'p2',
      flower: 'da-quy',
      place: 'ba-vi',
      status: 'approved',
      created_at: fourDaysAgo,
      taken_on: '2026-10-26',
    });

    // 3. Approved dã quỳ không có place (2 ngày trước) -> đếm flower, không đếm place
    await insertPhoto({
      id: 'p3',
      flower: 'da-quy',
      place: null,
      status: 'approved',
      created_at: twoDaysAgo,
    });

    // 4. Approved tam giác mạch ở Hà Giang (2 ngày trước) -> đếm
    await insertPhoto({
      id: 'p4',
      flower: 'tam-giac-mach',
      place: 'ha-giang',
      status: 'approved',
      created_at: twoDaysAgo,
    });

    // 5. Pending ở Ba Vì -> KHÔNG đếm
    await insertPhoto({
      id: 'p5',
      flower: 'da-quy',
      place: 'ba-vi',
      status: 'pending',
      created_at: twoDaysAgo,
    });

    // 6. Rejected ở Ba Vì -> KHÔNG đếm
    await insertPhoto({
      id: 'p6',
      flower: 'da-quy',
      place: 'ba-vi',
      status: 'rejected',
      created_at: twoDaysAgo,
    });

    // 7. Cũ hơn 7 ngày (10 ngày trước) -> KHÔNG đếm
    await insertPhoto({
      id: 'p7',
      flower: 'da-quy',
      place: 'ba-vi',
      status: 'approved',
      created_at: tenDaysAgo,
    });

    const res = await call('/api/anh/tuan');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.flowers).toEqual({
      'da-quy': 3, // p1, p2, p3
      'tam-giac-mach': 1, // p4
    });

    expect(data.places).toEqual({
      'ba-vi': 2, // p1, p2
      'ha-giang': 1, // p4
    });
  });

  it('hàm thuần getWeeklyPhotosCount và handleGetWeeklyPhotos xuất khẩu hợp lệ', async () => {
    expect(typeof getWeeklyPhotosCount).toBe('function');
    expect(typeof handleGetWeeklyPhotos).toBe('function');
  });
});

describe('Worker bước 32: ca biên', () => {
  it('mùa vắt qua năm: now = 3/1/2027 đếm ảnh cuối tháng 12/2026', async () => {
    await insertPhoto({ id: 'y1', flower: 'dao', place: 'moc-chau', created_at: '2026-12-29T10:00:00Z' });
    await insertPhoto({ id: 'y2', flower: 'dao', place: 'moc-chau', created_at: '2027-01-02T10:00:00Z' });
    await insertPhoto({ id: 'y3', flower: 'dao', place: 'moc-chau', created_at: '2026-12-20T10:00:00Z' });
    const r = await getWeeklyPhotosCount(makeEnv(), new Date('2027-01-03T12:00:00Z'));
    expect(r).toEqual({ places: { 'moc-chau': 2 }, flowers: { dao: 2 } });
  });

  it('ngày 29/2 năm nhuận: taken_on 2028-02-29 tính khi now = 3/3/2028', async () => {
    await insertPhoto({
      id: 'l1', flower: 'dao', place: 'p', created_at: '2020-01-01T00:00:00Z', taken_on: '2028-02-29',
    });
    const r = await getWeeklyPhotosCount(makeEnv(), new Date('2028-03-03T12:00:00Z'));
    expect(r.flowers).toEqual({ dao: 1 });
  });

  it('giá trị rác trong created_at/taken_on không làm route lỗi', async () => {
    await insertPhoto({ id: 'g1', flower: 'dao', place: 'p', created_at: 'rác', taken_on: '2027-02-29' });
    const res = await call('/api/anh/tuan');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ places: {}, flowers: {} });
  });

  it('phương thức POST không được xử lý như GET', async () => {
    const res = await call('/api/anh/tuan', { method: 'POST' });
    expect(res.status).not.toBe(200);
  });
});
