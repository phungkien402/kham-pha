// Test bước 22 qua handler mặc định của worker/index.ts, với D1 + R2 thật trong bộ nhớ (getPlatformProxy của wrangler, persist: false).
// Viết theo spec docs/buoc-22-23-anh.md, không dựa vào cách cài đặt bên trong.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const ORIGIN = 'https://kham-pha.test';

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let db: any;
let bucket: any;
let assetsFetch: ReturnType<typeof vi.fn>;

// WebP tối thiểu: "RIFF" + size + "WEBP" + "VP8 " + đệm
function makeWebp(extra = 0): Uint8Array {
  const head = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const out = new Uint8Array(head.length + 20 + extra);
  out.set(head);
  return out;
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return { DB: db, BUCKET: bucket, ASSETS: { fetch: assetsFetch }, ...overrides } as any;
}

const BYPASS = { DEV_BYPASS_AUTH: '1' };

function call(path: string, init?: RequestInit, envOverrides: Record<string, unknown> = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), makeEnv(envOverrides));
}

function uploadForm(opts: { flower?: string; file?: Blob; filename?: string; file600?: Blob | null } = {}) {
  const form = new FormData();
  const file = opts.file ?? new Blob([makeWebp()], { type: 'image/webp' });
  form.set('file', file, opts.filename ?? 'a.webp');
  if (opts.file600 !== null) {
    form.set('file600', opts.file600 ?? new Blob([makeWebp()], { type: 'image/webp' }), 'a-600.webp');
  }
  form.set('flower', opts.flower ?? 'da-quy');
  return form;
}

function upload(form: FormData, envOverrides: Record<string, unknown> = BYPASS) {
  return call('/api/admin/upload', { method: 'POST', body: form }, envOverrides);
}

async function listKeys(): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await bucket.list({ cursor });
    out.push(...res.objects.map((o: any) => o.key));
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);
  return out;
}

async function allRows(): Promise<any[]> {
  return (await db.prepare('SELECT * FROM photos').all()).results;
}

async function insertRow(id: string, status: string, flower = 'da-quy') {
  await db
    .prepare(
      `INSERT INTO photos (id, flower, status, author, license, width, height, source, created_at)
       VALUES (?, ?, ?, 'Người thử', 'CC BY-SA 4.0', 10, 10, 'admin', '2026-10-28T00:00:00.000Z')`,
    )
    .bind(id, flower, status)
    .run();
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
  const keys = await listKeys();
  if (keys.length) await bucket.delete(keys);
});

describe('Worker ảnh hoa (bước 22)', () => {
  it('không có header Cf-Access-Jwt-Assertion và không bật DEV_BYPASS_AUTH thì mọi /api/admin/* trả 403; JWT rác cũng 403', async () => {
    const targets: Array<[string, string]> = [
      ['POST', '/api/admin/upload'],
      ['GET', '/api/admin/photos'],
      ['POST', '/api/admin/photos/abc/hide'],
      ['DELETE', '/api/admin/photos/abc'],
    ];
    for (const [method, path] of targets) {
      const res = await call(path, { method });
      expect(res.status, `${method} ${path} không JWT`).toBe(403);
    }
    const noBypass = { ACCESS_TEAM: 'test', ACCESS_AUD: 'aud', ACCESS_JWKS: { keys: [] } };
    for (const [method, path] of targets) {
      const res = await call(
        path,
        { method, headers: { 'Cf-Access-Jwt-Assertion': 'rac.rac.rac' } },
        noBypass,
      );
      expect(res.status, `${method} ${path} JWT rác`).toBe(403);
      const res2 = await call(
        path,
        { method, headers: { 'Cf-Access-Jwt-Assertion': 'khong-phai-jwt' } },
        noBypass,
      );
      expect(res2.status, `${method} ${path} JWT sai định dạng`).toBe(403);
    }
    expect(await allRows()).toHaveLength(0);
    expect(await listKeys()).toHaveLength(0);
  });

  it('DEV_BYPASS_AUTH=1 cho upload WebP hợp lệ kèm file600 thì ghi 1 dòng D1 approved/admin và 2 object R2', async () => {
    const res = await upload(uploadForm());
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('approved');
    expect(rows[0].source).toBe('admin');
    expect(rows[0].flower).toBe('da-quy');

    const id = rows[0].id as string;
    const keys = await listKeys();
    expect(keys).toContain(`approved/${id}.webp`);
    expect(keys).toContain(`approved/${id}-600.webp`);
  });

  it('upload loài hoa không tồn tại (hoa-gia) trả 400 và không ghi gì vào D1/R2', async () => {
    const res = await upload(uploadForm({ flower: 'hoa-gia' }));
    expect(res.status).toBe(400);
    expect(await allRows()).toHaveLength(0);
    expect(await listKeys()).toHaveLength(0);
  });

  it('upload file PNG hoặc text giả đuôi .webp (sai magic bytes) trả 400', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
    const resPng = await upload(
      uploadForm({ file: new Blob([png], { type: 'image/png' }), filename: 'gia.webp' }),
    );
    expect(resPng.status).toBe(400);

    const resText = await upload(
      uploadForm({
        file: new Blob(['day chi la van ban thuong, khong phai anh'], { type: 'image/webp' }),
        filename: 'gia.webp',
      }),
    );
    expect(resText.status).toBe(400);

    // file600 sai magic bytes cũng phải bị từ chối
    const resBad600 = await upload(
      uploadForm({ file600: new Blob([png], { type: 'image/webp' }) }),
    );
    expect(resBad600.status).toBe(400);

    expect(await allRows()).toHaveLength(0);
    expect(await listKeys()).toHaveLength(0);
  });

  it('upload file lớn hơn 3 MB trả 413', async () => {
    const big = new Blob([makeWebp(3 * 1024 * 1024 + 1)], { type: 'image/webp' });
    const res = await upload(uploadForm({ file: big }));
    expect(res.status).toBe(413);
    expect(await allRows()).toHaveLength(0);
    expect(await listKeys()).toHaveLength(0);
  });

  it('GET /api/anh?flower=da-quy chỉ trả ảnh approved, có author và license, không lộ pending/rejected', async () => {
    await insertRow('anh-approved', 'approved');
    await insertRow('anh-pending', 'pending');
    await insertRow('anh-rejected', 'rejected');
    await insertRow('anh-hoa-khac', 'approved', 'hoa-sen');

    const res = await call('/api/anh?flower=da-quy');
    expect(res.status).toBe(200);
    const body: any = await res.json();
    const photos: any[] = Array.isArray(body) ? body : body.photos;
    expect(photos.map((p) => p.id)).toEqual(['anh-approved']);
    expect(photos[0].author).toBe('Người thử');
    expect(photos[0].license).toBe('CC BY-SA 4.0');

    const text = JSON.stringify(body);
    expect(text).not.toContain('anh-pending');
    expect(text).not.toContain('anh-rejected');
  });

  it('GET /api/anh/<id>.webp: approved trả 200 image/webp; pending, rejected, không tồn tại trả 404', async () => {
    const bytes = makeWebp();
    for (const [id, status] of [
      ['ok-1', 'approved'],
      ['cho-1', 'pending'],
      ['tu-choi-1', 'rejected'],
    ] as const) {
      await insertRow(id, status);
      // đặt file ở cả hai thư mục để chắc chắn 404 là do trạng thái chứ không do thiếu file
      await bucket.put(`approved/${id}.webp`, bytes, { httpMetadata: { contentType: 'image/webp' } });
      await bucket.put(`pending/${id}.webp`, bytes, { httpMetadata: { contentType: 'image/webp' } });
    }

    const ok = await call('/api/anh/ok-1.webp');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/webp');
    expect(new Uint8Array(await ok.arrayBuffer()).byteLength).toBe(bytes.byteLength);

    expect((await call('/api/anh/cho-1.webp')).status).toBe(404);
    expect((await call('/api/anh/tu-choi-1.webp')).status).toBe(404);
    expect((await call('/api/anh/khong-co.webp')).status).toBe(404);
  });

  it('POST hide làm ảnh biến khỏi /api/anh?flower=; DELETE xoá cả object R2', async () => {
    const up = await upload(uploadForm());
    expect(up.status).toBe(200);
    const [{ id }] = await allRows();

    const before: any = await (await call('/api/anh?flower=da-quy')).json();
    expect((Array.isArray(before) ? before : before.photos).map((p: any) => p.id)).toContain(id);

    const hide = await call(`/api/admin/photos/${id}/hide`, { method: 'POST' }, BYPASS);
    expect(hide.status).toBe(200);
    const after: any = await (await call('/api/anh?flower=da-quy')).json();
    expect((Array.isArray(after) ? after : after.photos).map((p: any) => p.id)).not.toContain(id);
    expect((await call(`/api/anh/${id}.webp`)).status).toBe(404);

    const del = await call(`/api/admin/photos/${id}`, { method: 'DELETE' }, BYPASS);
    expect(del.status).toBeGreaterThanOrEqual(200);
    expect(del.status).toBeLessThan(300);
    const keys = await listKeys();
    expect(keys).not.toContain(`approved/${id}.webp`);
    expect(keys).not.toContain(`approved/${id}-600.webp`);
    expect(await allRows()).toHaveLength(0);
  });

  it('đường dẫn ngoài /api và /admin (vd /mua-hoa-viet/) vẫn đi tới ASSETS.fetch', async () => {
    const res = await call('/mua-hoa-viet/');
    expect(assetsFetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('asset');
  });
});
