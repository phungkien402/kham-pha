import {
  ensureSchema,
  getBucket,
  getDb,
  jsonResponse,
  type CoverItem,
  type Env,
  type PhotoItem,
  type PhotoRow,
} from './types';
import { isValidFlowerSlug } from './upload';

function rowToPhotoItem(row: PhotoRow, isAdmin = false): PhotoItem {
  const useAdminSrc = isAdmin && row.status === 'pending';
  const basePath = useAdminSrc ? '/api/admin/anh' : '/api/anh';
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
    src: `${basePath}/${row.id}.webp`,
    src600: `${basePath}/${row.id}-600.webp`,
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
    { 'Cache-Control': 'no-cache' },
  );
}

export async function listApprovedCovers(env: Env): Promise<Record<string, CoverItem>> {
  const db = getDb(env);
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, flower, status, author, license, width, height, created_at
       FROM (
         SELECT id, flower, status, author, license, width, height, created_at,
                ROW_NUMBER() OVER (PARTITION BY flower ORDER BY created_at DESC, rowid DESC) AS rn
         FROM photos
         WHERE status = 'approved'
       )
       WHERE rn = 1`,
    )
    .all<PhotoRow>();

  const covers: Record<string, CoverItem> = {};
  for (const row of results ?? []) {
    if (row.status && row.status !== 'approved') continue;
    if (!covers[row.flower]) {
      covers[row.flower] = {
        id: row.id,
        src: `/api/anh/${row.id}.webp`,
        src600: `/api/anh/${row.id}-600.webp`,
        author: row.author,
        license: row.license,
        width: Number(row.width ?? 0),
        height: Number(row.height ?? 0),
      };
    }
  }

  return covers;
}

export async function handleGetPhotoCovers(_request: Request, env: Env): Promise<Response> {
  const covers = await listApprovedCovers(env);
  return jsonResponse(
    { covers },
    200,
    { 'Cache-Control': 'no-cache' },
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

export async function handleGetAdminPhotoFile(
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

  if (!row || row.status === 'rejected') {
    return new Response('Not Found', { status: 404 });
  }

  const bucket = getBucket(env);
  const suffix = is600 ? '-600.webp' : '.webp';
  const candidateKeys =
    row.status === 'pending'
      ? [
          `pending/${id}${suffix}`,
          ...(is600 ? [`pending/${id}.webp`] : []),
          `approved/${id}${suffix}`,
          ...(is600 ? [`approved/${id}.webp`] : []),
        ]
      : [
          `approved/${id}${suffix}`,
          ...(is600 ? [`approved/${id}.webp`] : []),
          `pending/${id}${suffix}`,
          ...(is600 ? [`pending/${id}.webp`] : []),
        ];

  let obj = null;
  for (const key of candidateKeys) {
    obj = await bucket.get(key);
    if (obj) break;
  }

  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/webp');
  headers.set('Cache-Control', 'private, no-store');
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
  status?: string | null,
): Promise<PhotoItem[]> {
  const db = getDb(env);
  await ensureSchema(db);

  const trimmedFlower = flower?.trim() ?? '';
  const trimmedStatus = status?.trim() ?? '';

  if (trimmedFlower && trimmedStatus) {
    const { results } = await db
      .prepare(
        `SELECT id, flower, place, status, author, author_link, license,
                caption, taken_on, width, height, source, created_at, reviewed_at
         FROM photos
         WHERE flower = ? AND status = ?
         ORDER BY created_at DESC`,
      )
      .bind(trimmedFlower, trimmedStatus)
      .all<PhotoRow>();
    return (results ?? []).map((r) => rowToPhotoItem(r, true));
  }

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
    return (results ?? []).map((r) => rowToPhotoItem(r, true));
  }

  if (trimmedStatus) {
    const { results } = await db
      .prepare(
        `SELECT id, flower, place, status, author, author_link, license,
                caption, taken_on, width, height, source, created_at, reviewed_at
         FROM photos
         WHERE status = ?
         ORDER BY created_at DESC`,
      )
      .bind(trimmedStatus)
      .all<PhotoRow>();
    return (results ?? []).map((r) => rowToPhotoItem(r, true));
  }

  const { results } = await db
    .prepare(
      `SELECT id, flower, place, status, author, author_link, license,
              caption, taken_on, width, height, source, created_at, reviewed_at
       FROM photos
       ORDER BY created_at DESC`,
    )
    .all<PhotoRow>();
  return (results ?? []).map((r) => rowToPhotoItem(r, true));
}

export async function handleGetAdminPhotos(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const flower = url.searchParams.get('flower')?.trim() ?? '';
  if (flower && !isValidFlowerSlug(flower)) {
    return jsonResponse({ error: 'Loài hoa không tồn tại trong flowers.json' }, 400);
  }
  const status = url.searchParams.get('status')?.trim() ?? '';
  if (status && status !== 'pending' && status !== 'approved' && status !== 'rejected') {
    return jsonResponse({ error: 'Tham số status không hợp lệ' }, 400);
  }

  const photos = await listAdminPhotos(env, flower || null, status || null);
  return jsonResponse({ photos }, 200);
}

export interface ApprovePhotoUpdates {
  flower?: string | null;
  caption?: string | null;
  place?: string | null;
}

export async function approveAdminPhoto(
  env: Env,
  id: string,
  updates?: ApprovePhotoUpdates,
): Promise<PhotoItem | null> {
  const db = getDb(env);
  const bucket = getBucket(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(
      `SELECT id, flower, place, status, author, author_link, license,
              caption, taken_on, width, height, source, created_at, reviewed_at
       FROM photos
       WHERE id = ?`,
    )
    .bind(id)
    .first<PhotoRow>();

  if (!existing) return null;

  // Chuyển object R2 từ pending/<id>.webp và pending/<id>-600.webp sang approved/
  const pendingMain = await bucket.get(`pending/${id}.webp`);
  let mainBytes: ArrayBuffer | null = null;
  let mainContentType = 'image/webp';

  if (pendingMain) {
    mainBytes = await pendingMain.arrayBuffer();
    mainContentType = pendingMain.httpMetadata?.contentType || 'image/webp';
    await bucket.put(`approved/${id}.webp`, mainBytes, {
      httpMetadata: { contentType: mainContentType },
    });
    await bucket.delete(`pending/${id}.webp`);
  }

  const pending600 = await bucket.get(`pending/${id}-600.webp`);
  if (pending600) {
    const bytes600 = await pending600.arrayBuffer();
    const contentType600 = pending600.httpMetadata?.contentType || mainContentType;
    await bucket.put(`approved/${id}-600.webp`, bytes600, {
      httpMetadata: { contentType: contentType600 },
    });
    await bucket.delete(`pending/${id}-600.webp`);
  } else if (mainBytes) {
    const existingApproved600 = await bucket.get(`approved/${id}-600.webp`);
    if (!existingApproved600) {
      await bucket.put(`approved/${id}-600.webp`, mainBytes, {
        httpMetadata: { contentType: mainContentType },
      });
    }
  }

  const nextFlower =
    updates?.flower && updates.flower.trim() ? updates.flower.trim() : existing.flower;
  const nextCaption =
    updates && 'caption' in updates ? (updates.caption ?? null) : (existing.caption ?? null);
  const nextPlace =
    updates && 'place' in updates ? (updates.place ?? null) : (existing.place ?? null);
  const nowIso = new Date().toISOString();

  await db
    .prepare(
      `UPDATE photos
       SET status = 'approved', flower = ?, caption = ?, place = ?, reviewed_at = ?
       WHERE id = ?`,
    )
    .bind(nextFlower, nextCaption, nextPlace, nowIso, id)
    .run();

  return rowToPhotoItem(
    {
      ...existing,
      status: 'approved',
      flower: nextFlower,
      caption: nextCaption,
      place: nextPlace,
      reviewed_at: nowIso,
    },
    false,
  );
}

export async function handleApproveAdminPhoto(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!id) {
    return jsonResponse({ error: 'Thiếu id ảnh' }, 400);
  }

  const updates: ApprovePhotoUpdates = {};
  const contentType = request.headers.get('content-type') ?? '';

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    const fd = await request.formData().catch(() => null);
    if (fd) {
      const fl = fd.get('flower');
      if (typeof fl === 'string' && fl.trim()) updates.flower = fl.trim();
      if (fd.has('caption')) {
        const cap = fd.get('caption');
        updates.caption = typeof cap === 'string' && cap.trim() ? cap.trim() : null;
      }
      if (fd.has('place')) {
        const pl = fd.get('place');
        updates.place = typeof pl === 'string' && pl.trim() ? pl.trim() : null;
      }
    }
  } else {
    const rawText = await request.text().catch(() => '');
    if (rawText.trim()) {
      try {
        const body = JSON.parse(rawText) as Record<string, unknown>;
        if (body && typeof body === 'object') {
          if (typeof body.flower === 'string' && body.flower.trim()) {
            updates.flower = body.flower.trim();
          }
          if ('caption' in body) {
            updates.caption =
              typeof body.caption === 'string' && body.caption.trim()
                ? body.caption.trim()
                : null;
          }
          if ('place' in body) {
            updates.place =
              typeof body.place === 'string' && body.place.trim() ? body.place.trim() : null;
          }
        }
      } catch {
        // Bỏ qua nếu body không phải JSON
      }
    }
  }

  if (updates.flower !== undefined && updates.flower !== null && !isValidFlowerSlug(updates.flower)) {
    return jsonResponse({ error: 'Loài hoa không tồn tại trong flowers.json' }, 400);
  }

  const approved = await approveAdminPhoto(env, id, updates);
  if (!approved) {
    return jsonResponse({ error: 'Không tìm thấy ảnh' }, 404);
  }

  return jsonResponse(
    {
      ok: true,
      ...approved,
      photo: approved,
    },
    200,
  );
}

export async function rejectAdminPhoto(env: Env, id: string): Promise<boolean> {
  const db = getDb(env);
  const bucket = getBucket(env);
  await ensureSchema(db);

  const existing = await db
    .prepare(`SELECT id FROM photos WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>();

  await Promise.all([
    bucket.delete(`pending/${id}.webp`),
    bucket.delete(`pending/${id}-600.webp`),
    bucket.delete(`approved/${id}.webp`),
    bucket.delete(`approved/${id}-600.webp`),
  ]);

  if (!existing) return false;

  const nowIso = new Date().toISOString();
  await db
    .prepare(`UPDATE photos SET status = 'rejected', reviewed_at = ? WHERE id = ?`)
    .bind(nowIso, id)
    .run();
  return true;
}

export async function handleRejectAdminPhoto(
  _request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!id) {
    return jsonResponse({ error: 'Thiếu id ảnh' }, 400);
  }
  const rejected = await rejectAdminPhoto(env, id);
  if (!rejected) {
    return jsonResponse({ error: 'Không tìm thấy ảnh' }, 404);
  }
  const nowIso = new Date().toISOString();
  return jsonResponse({ ok: true, id, status: 'rejected', reviewed_at: nowIso }, 200);
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
    bucket.delete(`pending/${id}-600.webp`),
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
