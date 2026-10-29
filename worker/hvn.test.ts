// worker/hvn.test.ts
// Kiểm thử các endpoint thống kê lựa chọn cộng đồng cho game Hiểu Việt Nam:
// - POST /api/hvn/tra-loi: validate, chống lặp theo IP hash/ngày, rate limit, cộng đếm
// - GET /api/hvn/thong-ke: lấy số đếm theo câu hỏi, cache header

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import worker from './index';
import { clearHvnRateLimits } from './hvn';

const ORIGIN = 'https://kham-pha.test';

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>;
let db: any;

function makeEnv(overrides: Record<string, unknown> = {}) {
  return { DB: db, IP_SALT: 'test-salt-secret', ...overrides } as any;
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

beforeAll(async () => {
  proxy = await getPlatformProxy({ persist: false, remoteBindings: false });
  db = (proxy.env as any).DB;
  await applyMigrations();
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  clearHvnRateLimits();
  await db.prepare('DELETE FROM hvn_dem').run();
  await db.prepare('DELETE FROM hvn_chong_lap').run();
});

describe('HVN Backend: POST /api/hvn/tra-loi', () => {
  it('từ chối dữ liệu body không hợp lệ (400)', async () => {
    // Không phải JSON
    const res1 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'invalid-json',
    });
    expect(res1.status).toBe(400);

    // cauId không có trong dữ liệu
    const res2 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cauId: 'khong-ton-tai', luaChon: 0 }),
    });
    expect(res2.status).toBe(400);

    // luaChon ngoài khoảng 0-3
    const res3 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 5 }),
    });
    expect(res3.status).toBe(400);

    const res4 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: -1 }),
    });
    expect(res4.status).toBe(400);

    // luaChon không phải số nguyên
    const res5 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 1.5 }),
    });
    expect(res5.status).toBe(400);
  });

  it('ghi nhận lượt chọn hợp lệ và trả về thống kê đúng', async () => {
    const res = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '1.1.1.1',
      },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 2 }),
    });

    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.dem).toEqual([0, 0, 1, 0]);

    // Kiểm tra trong D1
    const row: any = await db
      .prepare('SELECT so_luot FROM hvn_dem WHERE cau_id = ? AND lua_chon = ?')
      .bind('bac-01', 2)
      .first();
    expect(row?.so_luot).toBe(1);
  });

  it('chống bấm lặp: cùng IP gửi lại cùng câu trong ngày không được tăng đếm', async () => {
    // Lần 1 từ IP 2.2.2.2
    const res1 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '2.2.2.2',
      },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 1 }),
    });
    expect(res1.status).toBe(200);
    const data1: any = await res1.json();
    expect(data1.dem).toEqual([0, 1, 0, 0]);

    // Lần 2 từ cùng IP 2.2.2.2 với cùng câu hỏi (dù chọn lựa chọn khác)
    const res2 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '2.2.2.2',
      },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 3 }),
    });
    expect(res2.status).toBe(200);
    const data2: any = await res2.json();
    // Vẫn trả thống kê nhưng KHÔNG tăng số lượt (vẫn là [0, 1, 0, 0])
    expect(data2.dem).toEqual([0, 1, 0, 0]);

    // IP khác (3.3.3.3) gửi cùng câu hỏi → được tăng
    const res3 = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '3.3.3.3',
      },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 3 }),
    });
    expect(res3.status).toBe(200);
    const data3: any = await res3.json();
    expect(data3.dem).toEqual([0, 1, 0, 1]);
  });

  it('tuyệt đối không lưu IP thô vào cơ sở dữ liệu', async () => {
    const testIp = '123.45.67.89';
    await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': testIp,
      },
      body: JSON.stringify({ cauId: 'trung-01', luaChon: 0 }),
    });

    const chongLapRows = (await db.prepare('SELECT * FROM hvn_chong_lap').all()).results;
    for (const r of chongLapRows) {
      expect(JSON.stringify(r)).not.toContain(testIp);
      expect((r as any).khoa).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    }
  });

  it('rate limit: tối đa 60 POST/phút/IP, vượt quá trả về 429', async () => {
    const ip = '99.99.99.99';
    // Gửi 60 request liên tiếp từ cùng IP
    for (let i = 0; i < 60; i++) {
      const res = await call('/api/hvn/tra-loi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify({ cauId: 'bac-01', luaChon: 0 }),
      });
      expect(res.status).toBe(200);
    }

    // Request thứ 61 từ cùng IP trong 1 phút bị chặn 429
    const blockedRes = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': ip,
      },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 0 }),
    });
    expect(blockedRes.status).toBe(429);

    // IP khác vẫn gửi được bình thường
    const otherIpRes = await call('/api/hvn/tra-loi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '88.88.88.88',
      },
      body: JSON.stringify({ cauId: 'bac-01', luaChon: 0 }),
    });
    expect(otherIpRes.status).toBe(200);
  });
});

describe('HVN Backend: GET /api/hvn/thong-ke', () => {
  it('từ chối nếu cauId không hợp lệ (400)', async () => {
    const res1 = await call('/api/hvn/thong-ke');
    expect(res1.status).toBe(400);

    const res2 = await call('/api/hvn/thong-ke?cauId=sai-id');
    expect(res2.status).toBe(400);
  });

  it('trả về số liệu thống kê kèm header cache 30s', async () => {
    // Thêm dữ liệu mẫu
    await db
      .prepare('INSERT INTO hvn_dem (cau_id, lua_chon, so_luot) VALUES (?, ?, ?)')
      .bind('nam-01', 0, 15)
      .run();
    await db
      .prepare('INSERT INTO hvn_dem (cau_id, lua_chon, so_luot) VALUES (?, ?, ?)')
      .bind('nam-01', 2, 45)
      .run();

    const res = await call('/api/hvn/thong-ke?cauId=nam-01');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=30');

    const data: any = await res.json();
    expect(data.dem).toEqual([15, 0, 45, 0]);
  });
});
