import {
  ensureSchema,
  getBucket,
  getDb,
  jsonResponse,
  type Env,
  type PhotoItem,
  type PhotoRow,
} from './types';
import { isValidFlowerSlug } from './upload';

function rowToPhotoItem(row: PhotoRow): PhotoItem {
  return {
    id: row.id,
    flower: row.flower,
    place: row.place ?? null,
    status: row.status,
    author: row.author,
    author_link: row.author_link ?? null,
    license: row.license,
    caption: row.caption ?? null,
    taken_on: row.taken_on ?? null,
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    source: row.source,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at ?? null,
    src: `/api/anh/${row.id}.webp`,
    src600: `/api/anh/${row.id}-600.webp`,
  };
}

export async function listApprovedPhotos(env: Env, flower: string): Promise<PhotoItem[]> {
  const db = getDb(env);
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, flower, place, status, author, author_link, license,
              caption, taken_on, width, height, source, created_at, reviewed_at
       FROM photos
       WHERE flower = ? AND status = 'approved'
       ORDER BY created_at DESC`,
    )
    .bind(flower)
    .all<PhotoRow>();

  return (results ?? []).map(rowToPhotoItem);
}

export async function handleGetPublicPhotos(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const flower = url.searchParams.get('flower')?.trim() ?? '';
  if (!flower || !isValidFlowerSlug(flower)) {
    return jsonResponse({ error: 'Tham số flower không hợp lệ' }, 400);
  }

  const photos = await listApprovedPhotos(env, flower);
  return jsonResponse(
    { photos },
    200,
    { 'Cache-Control': 'public, max-age=60' },
  );
}

export async function handleGetPhotoFile(
  _request: Request,
  env: Env,
  id: string,
  is600: boolean,
): Promise<Response> {
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new Response('Not Found', { status: 404 });
  }

  const db = getDb(env);
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT id, status FROM photos WHERE id = ?`)
    .bind(id)
    .first<{ id: string; status: string }>();

  // Chỉ phục vụ ảnh đã được duyệt (approved)
  if (!row || row.status !== 'approved') {
    return new Response('Not Found', { status: 404 });
  }

  const bucket = getBucket(env);
  const primaryKey = is600 ? `approved/${id}-600.webp` : `approved/${id}.webp`;
  let obj = await bucket.get(primaryKey);
  if (!obj && is600) {
    obj = await bucket.get(`approved/${id}.webp`);
  }

  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/webp');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (obj.httpEtag) {
    headers.set('ETag', obj.httpEtag);
  }

  return new Response(obj.body, {
    status: 200,
    headers,
  });
}

export async function listAdminPhotos(
  env: Env,
  flower?: string | null,
): Promise<PhotoItem[]> {
  const db = getDb(env);
  await ensureSchema(db);

  const trimmedFlower = flower?.trim() ?? '';
  if (trimmedFlower) {
    const { results } = await db
      .prepare(
        `SELECT id, flower, place, status, author, author_link, license,
                caption, taken_on, width, height, source, created_at, reviewed_at
         FROM photos
         WHERE flower = ?
         ORDER BY created_at DESC`,
      )
      .bind(trimmedFlower)
      .all<PhotoRow>();
    return (results ?? []).map(rowToPhotoItem);
  }

  const { results } = await db
    .prepare(
      `SELECT id, flower, place, status, author, author_link, license,
              caption, taken_on, width, height, source, created_at, reviewed_at
       FROM photos
       ORDER BY created_at DESC`,
    )
    .all<PhotoRow>();
  return (results ?? []).map(rowToPhotoItem);
}

export async function handleGetAdminPhotos(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const flower = url.searchParams.get('flower')?.trim() ?? '';
  if (flower && !isValidFlowerSlug(flower)) {
    return jsonResponse({ error: 'Loài hoa không tồn tại trong flowers.json' }, 400);
  }

  const photos = await listAdminPhotos(env, flower || null);
  return jsonResponse({ photos }, 200);
}

export async function hideAdminPhoto(env: Env, id: string): Promise<boolean> {
  const db = getDb(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT id FROM photos WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();
  if (!existing) return false;

  const nowIso = new Date().toISOString();
  await db
    .prepare(`UPDATE photos SET status = 'rejected', reviewed_at = ? WHERE id = ?`)
    .bind(nowIso, id)
    .run();
  return true;
}

export async function handleHideAdminPhoto(
  _request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!id) {
    return jsonResponse({ error: 'Thiếu id ảnh' }, 400);
  }
  const updated = await hideAdminPhoto(env, id);
  if (!updated) {
    return jsonResponse({ error: 'Không tìm thấy ảnh' }, 404);
  }
  return jsonResponse({ ok: true, id, status: 'rejected' }, 200);
}

export async function deleteAdminPhoto(env: Env, id: string): Promise<boolean> {
  const db = getDb(env);
  const bucket = getBucket(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT id FROM photos WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();

  // Xoá từng khoá R2 riêng lẻ để tương thích cả R2 thật lẫn mock R2 đơn giản
  await Promise.all([
    bucket.delete(`approved/${id}.webp`),
    bucket.delete(`approved/${id}-600.webp`),
    bucket.delete(`pending/${id}.webp`),
  ]);

  if (!existing) return false;

  await db.prepare(`DELETE FROM photos WHERE id = ?`).bind(id).run();
  return true;
}

export async function handleDeleteAdminPhoto(
  _request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!id) {
    return jsonResponse({ error: 'Thiếu id ảnh' }, 400);
  }
  const deleted = await deleteAdminPhoto(env, id);
  if (!deleted) {
    return jsonResponse({ error: 'Không tìm thấy ảnh' }, 404);
  }
  return jsonResponse({ ok: true, id, deleted: true }, 200);
}
