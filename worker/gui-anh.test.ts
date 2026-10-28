// Test bước 23: người ngoài gửi ảnh qua POST /api/gui-anh, Kiên duyệt ở /api/admin/*.
// D1 + R2 thật trong bộ nhớ (getPlatformProxy), Turnstile siteverify được mock qua env.TURNSTILE_FETCH.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const ORIGIN = 'https://kham-pha.test';
const IP = '203.0.113.7';

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let db: any;
let bucket: any;
let turnstileFetch: ReturnType<typeof vi.fn>;

function makeWebp(extra = 0): Uint8Array {
  const head = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const out = new Uint8Array(head.length + 20 + extra);
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
    IP_SALT: 'muoi-test',
    ...overrides,
  } as any;
}

const BYPASS = { DEV_BYPASS_AUTH: '1' };

function call(path: string, init?: RequestInit, envOverrides: Record<string, unknown> = {}) {
  return worker.fetch(new Request(`${ORIGIN}${path}`, init), makeEnv(envOverrides));
}

function submitForm(
  opts: {
    token?: string | null;
    author?: string | null;
    consent?: string | null;
    flower?: string;
    file?: Blob;
  } = {},
) {
  const form = new FormData();
  form.set('file', opts.file ?? new Blob([makeWebp()], { type: 'image/webp' }), 'a.webp');
  form.set('file600', new Blob([makeWebp()], { type: 'image/webp' }), 'a-600.webp');
  form.set('flower', opts.flower ?? 'da-quy');
  if (opts.token !== null) form.set('cf-turnstile-response', opts.token ?? 'token-tot');
  if (opts.author !== null) form.set('author', opts.author ?? 'Người gửi thử');
  if (opts.consent !== null) form.set('consent', opts.consent ?? 'on');
  return form;
}

function submit(form: FormData, ip = IP) {
  return call('/api/gui-anh', { method: 'POST', body: form, headers: { 'CF-Connecting-IP': ip } });
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

async function submitOk(ip = IP): Promise<string> {
  const res = await submit(submitForm(), ip);
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const rows = await db.prepare('SELECT id FROM photos ORDER BY created_at DESC, rowid DESC LIMIT 1').all();
  return rows.results[0].id as string;
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
  turnstileFetch = vi.fn(
    async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      const ok = body.response !== 'token-xau';
      return new Response(JSON.stringify({ success: ok }), { status: 200 });
    },
  );
  await db.prepare('DROP TABLE IF EXISTS photos').run();
  await applyMigrations();
  const keys = await listKeys();
  if (keys.length) await bucket.delete(keys);
});

async function expectNothingStored() {
  expect(await allRows()).toHaveLength(0);
  expect(await listKeys()).toHaveLength(0);
}

describe('Gửi ảnh công khai (bước 23)', () => {
  it('1a. thiếu token Turnstile → 400, không lưu gì', async () => {
    const res = await submit(submitForm({ token: null }));
    expect(res.status).toBe(400);
    await expectNothingStored();
  });

  it('1b. token bị siteverify từ chối → 400, không lưu gì', async () => {
    const res = await submit(submitForm({ token: 'token-xau' }));
    expect(res.status).toBe(400);
    expect(turnstileFetch).toHaveBeenCalled();
    await expectNothingStored();
  });

  it('2a. thiếu tên hiển thị → 400', async () => {
    const res = await submit(submitForm({ author: null }));
    expect(res.status).toBe(400);
    await expectNothingStored();
  });

  it('2b. không tick đồng ý giấy phép → 400', async () => {
    const res = await submit(submitForm({ consent: null }));
    expect(res.status).toBe(400);
    await expectNothingStored();
  });

  it('3a. file không phải WebP/JPEG (PNG giả đuôi .webp) → 400', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
    const res = await submit(submitForm({ file: new Blob([png], { type: 'image/webp' }) }));
    expect(res.status).toBe(400);
    await expectNothingStored();
  });

  it('3b. file > 3 MB → 413', async () => {
    const big = new Blob([makeWebp(3 * 1024 * 1024 + 1)], { type: 'image/webp' });
    const res = await submit(submitForm({ file: big }));
    expect(res.status).toBe(413);
    await expectNothingStored();
  });

  it('3c. loài không tồn tại → 400', async () => {
    const res = await submit(submitForm({ flower: 'hoa-gia' }));
    expect(res.status).toBe(400);
    await expectNothingStored();
  });

  it('4. gửi hợp lệ → 2xx, D1 pending/public/CC BY-SA 4.0, ip_hash không chứa IP thô, R2 chỉ có pending/', async () => {
    const res = await submit(submitForm());
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.status).toBe('pending');
    expect(row.source).toBe('public');
    expect(row.license).toBe('CC BY-SA 4.0');
    expect(row.author).toBe('Người gửi thử');
    expect(row.ip_hash).toBeTruthy();
    expect(String(row.ip_hash)).not.toContain(IP);

    const keys = await listKeys();
    expect(keys).toContain(`pending/${row.id}.webp`);
    expect(keys).toContain(`pending/${row.id}-600.webp`);
    expect(keys.filter((k) => k.startsWith('approved/'))).toHaveLength(0);
  });

  it('5. lần gửi thứ 11 trong ngày cùng IP → 429; IP khác vẫn gửi được', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await submit(submitForm());
      expect(res.status, `lần ${i + 1}`).toBeLessThan(300);
    }
    const eleventh = await submit(submitForm());
    expect(eleventh.status).toBe(429);
    expect(await allRows()).toHaveLength(10);

    const other = await submit(submitForm(), '198.51.100.99');
    expect(other.status).toBeGreaterThanOrEqual(200);
    expect(other.status).toBeLessThan(300);
    expect(await allRows()).toHaveLength(11);
  });

  it('6. ảnh pending không lộ ở /api/anh?flower=, /api/anh/bia, /api/anh/<id>.webp', async () => {
    const id = await submitOk();

    const list = await call('/api/anh?flower=da-quy');
    expect(list.status).toBe(200);
    expect(await list.text()).not.toContain(id);

    const bia = await call('/api/anh/bia');
    expect(bia.status).toBe(200);
    expect(await bia.text()).not.toContain(id);

    expect((await call(`/api/anh/${id}.webp`)).status).toBe(404);
    expect((await call(`/api/anh/${id}-600.webp`)).status).toBe(404);
  });

  it('7. GET /api/admin/anh/<id>.webp: không Access → 403; có Access → 200 đọc được ảnh pending', async () => {
    const id = await submitOk();

    const denied = await call(`/api/admin/anh/${id}.webp`);
    expect(denied.status).toBe(403);

    const ok = await call(`/api/admin/anh/${id}.webp`, undefined, BYPASS);
    expect(ok.status).toBe(200);
    const bytes = new Uint8Array(await ok.arrayBuffer());
    expect(bytes.byteLength).toBe(makeWebp().byteLength);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
  });

  it('8. approve: không Access → 403; có Access → approved, R2 approved/ có, pending/ đã xoá, hiện công khai', async () => {
    const id = await submitOk();

    const denied = await call(`/api/admin/photos/${id}/approve`, { method: 'POST' });
    expect(denied.status).toBe(403);
    expect((await allRows())[0].status).toBe('pending');

    const res = await call(`/api/admin/photos/${id}/approve`, { method: 'POST' }, BYPASS);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const rows = await allRows();
    expect(rows[0].status).toBe('approved');
    const keys = await listKeys();
    expect(keys).toContain(`approved/${id}.webp`);
    expect(keys).toContain(`approved/${id}-600.webp`);
    expect(keys).not.toContain(`pending/${id}.webp`);
    expect(keys).not.toContain(`pending/${id}-600.webp`);

    const list = await call('/api/anh?flower=da-quy');
    expect(await list.text()).toContain(id);
    const bia = await call('/api/anh/bia');
    expect(await bia.text()).toContain(id);
    expect((await call(`/api/anh/${id}.webp`)).status).toBe(200);
  });

  it('9. reject: status rejected, object R2 bị xoá, không hiện công khai', async () => {
    const id = await submitOk();

    const denied = await call(`/api/admin/photos/${id}/reject`, { method: 'POST' });
    expect(denied.status).toBe(403);

    const res = await call(`/api/admin/photos/${id}/reject`, { method: 'POST' }, BYPASS);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    expect((await allRows())[0].status).toBe('rejected');
    const keys = await listKeys();
    expect(keys.filter((k) => k.includes(id))).toHaveLength(0);

    expect(await (await call('/api/anh?flower=da-quy')).text()).not.toContain(id);
    expect(await (await call('/api/anh/bia')).text()).not.toContain(id);
    expect((await call(`/api/anh/${id}.webp`)).status).toBe(404);
  });
});
