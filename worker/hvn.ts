// worker/hvn.ts
// Xử lý API thống kê lựa chọn cộng đồng cho game Hiểu Việt Nam:
// - POST /api/hvn/tra-loi: nhận câu trả lời, chống lặp theo IP hash/ngày, cập nhật đếm
// - GET /api/hvn/thong-ke: lấy số đếm theo câu hỏi (cache 30s)

import questionsData from '../src/explore/hieu-viet-nam/data/cau-hoi.json';
import { getClientIp } from './upload';
import { getDb, jsonResponse, type Env } from './types';

export const VALID_CAU_IDS: ReadonlySet<string> = new Set(
  (questionsData as Array<{ id: string }>).map((q) => q.id),
);

// Map lưu timestamp của các request POST theo IP trong bộ nhớ isolate để giới hạn rate limit
const ipPostHistory = new Map<string, number[]>();

export function checkHvnPostRateLimit(
  ip: string,
  limit = 60,
  windowMs = 60_000,
  now = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const timestamps = ipPostHistory.get(ip) || [];
  const valid = timestamps.filter((t) => t > cutoff);
  if (valid.length >= limit) {
    ipPostHistory.set(ip, valid);
    return false;
  }
  valid.push(now);
  ipPostHistory.set(ip, valid);
  return true;
}

export function clearHvnRateLimits(): void {
  ipPostHistory.clear();
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getHvnStats(db: ReturnType<typeof getDb>, cauId: string): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT lua_chon, so_luot FROM hvn_dem WHERE cau_id = ?')
    .bind(cauId)
    .all<{ lua_chon: number; so_luot: number }>();

  const dem = [0, 0, 0, 0];
  if (Array.isArray(results)) {
    for (const r of results) {
      if (typeof r.lua_chon === 'number' && r.lua_chon >= 0 && r.lua_chon < 4) {
        dem[r.lua_chon] = Number(r.so_luot) || 0;
      }
    }
  }
  return dem;
}

export async function handleHvnTraLoi(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const clientIp = getClientIp(request);
  if (!checkHvnPostRateLimit(clientIp)) {
    return jsonResponse({ error: 'Quá giới hạn 60 lượt/phút' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Body JSON không hợp lệ' }, 400);
  }

  const cauId = body?.cauId;
  if (typeof cauId !== 'string' || !VALID_CAU_IDS.has(cauId)) {
    return jsonResponse({ error: 'cauId không hợp lệ' }, 400);
  }

  const luaChon = body?.luaChon;
  if (!Number.isInteger(luaChon) || luaChon < 0 || luaChon > 3) {
    return jsonResponse({ error: 'luaChon phải là số nguyên từ 0 đến 3' }, 400);
  }

  const db = getDb(env);
  const salt = env.IP_SALT ?? '';
  const ngay = new Date().toISOString().slice(0, 10);
  const rawKey = `${salt}${clientIp}${cauId}${ngay}`;
  const khoa = await sha256Hex(rawKey);

  const existing = await db
    .prepare('SELECT 1 FROM hvn_chong_lap WHERE khoa = ?')
    .bind(khoa)
    .first();

  if (!existing) {
    await db
      .prepare('INSERT INTO hvn_chong_lap (khoa, ngay) VALUES (?, ?)')
      .bind(khoa, ngay)
      .run();

    await db
      .prepare(
        `INSERT INTO hvn_dem (cau_id, lua_chon, so_luot)
         VALUES (?, ?, 1)
         ON CONFLICT(cau_id, lua_chon) DO UPDATE SET so_luot = hvn_dem.so_luot + 1`,
      )
      .bind(cauId, luaChon)
      .run();
  }

  const dem = await getHvnStats(db, cauId);
  return jsonResponse({ dem });
}

export async function handleHvnThongKe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const url = new URL(request.url);
  const cauId = url.searchParams.get('cauId');

  if (!cauId || !VALID_CAU_IDS.has(cauId)) {
    return jsonResponse({ error: 'cauId không hợp lệ' }, 400);
  }

  const db = getDb(env);
  const dem = await getHvnStats(db, cauId);

  return jsonResponse({ dem }, 200, {
    'Cache-Control': 'public, max-age=30',
  });
}
