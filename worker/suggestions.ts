import baseFlowersJson from '../src/explore/mua-hoa-viet/data/flowers.json';
import basePlacesJson from '../src/explore/mua-hoa-viet/data/places.json';
import {
  buildAndValidateFlowerPayload,
  buildAndValidatePlacePayload,
  isValidGoogleMapsUrl,
  parseRegionsFromBody,
  parseSeasonsFromBody,
  slugifyVietnamese,
  triggerBuildIfNeeded,
  type FlowerExtraData,
  type PlaceExtraData,
} from './extra';
import {
  ensureSchema,
  getDb,
  jsonResponse,
  type D1Database,
  type Env,
  type SuggestionItem,
  type SuggestionKind,
  type SuggestionRow,
  type SuggestionSource,
} from './types';

const MAX_SUGGESTIONS_PER_REQUEST = 30;
const MAX_SUGGESTION_BYTES = 20 * 1024; // 20 KB
const BOT_RATE_LIMIT_PER_HOUR = 10;

/**
 * Kiểm tra và ghi nhận số lượt gọi bot trong 1 giờ qua (dùng D1 bot_requests).
 */
export async function checkAndRecordBotRateLimit(
  env: Env,
): Promise<{ allowed: boolean; count: number }> {
  const db = getDb(env);
  await ensureSchema(db);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let count = 0;
  try {
    const row = await db
      .prepare(`SELECT COUNT(*) AS cnt FROM bot_requests WHERE created_at >= ?`)
      .bind(oneHourAgo)
      .first<{ cnt: number }>();
    count = Number(row?.cnt ?? 0);
  } catch {
    count = 0;
  }

  if (count >= BOT_RATE_LIMIT_PER_HOUR) {
    return { allowed: false, count };
  }

  try {
    const nowIso = new Date().toISOString();
    await db
      .prepare(`INSERT INTO bot_requests (id, created_at) VALUES (?, ?)`)
      .bind(crypto.randomUUID(), nowIso)
      .run();
  } catch {
    // Bỏ qua nếu lỗi ghi nhận
  }

  return { allowed: true, count: count + 1 };
}

/**
 * POST /api/bot/de-xuat
 * Nhận đề xuất từ bot thu thập tự động.
 */
export async function handleBotSubmitSuggestions(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Body JSON không hợp lệ' }, 400);
  }

  if (!body || typeof body !== 'object' || !Array.isArray(body.suggestions)) {
    return jsonResponse(
      { error: 'Body phải chứa mảng suggestions: [...]' },
      400,
    );
  }

  const rawList = body.suggestions as unknown[];
  if (rawList.length > MAX_SUGGESTIONS_PER_REQUEST) {
    return jsonResponse(
      {
        error: `Quá giới hạn ${MAX_SUGGESTIONS_PER_REQUEST} đề xuất trong một lần gửi (nhận ${rawList.length})`,
      },
      400,
    );
  }

  const db = getDb(env);
  await ensureSchema(db);

  let inserted = 0;
  let skipped = 0;
  const errors: Array<{ index: number; reason: string }> = [];
  const seenBatchDedupe = new Set<string>();

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      errors.push({ index: i, reason: 'Mục đề xuất phải là một đối tượng JSON' });
      continue;
    }

    const obj = item as Record<string, unknown>;

    // Kiểm tra kích thước ≤ 20 KB
    let serialized: string;
    try {
      serialized = JSON.stringify(obj);
    } catch {
      errors.push({ index: i, reason: 'Không thể serialize đề xuất thành JSON' });
      continue;
    }

    const byteLen = new TextEncoder().encode(serialized).byteLength;
    if (byteLen > MAX_SUGGESTION_BYTES) {
      errors.push({
        index: i,
        reason: `Mục vượt quá giới hạn 20 KB (${byteLen} bytes)`,
      });
      continue;
    }

    // Kiểm tra kind
    const kind = obj.kind as SuggestionKind;
    if (
      kind !== 'new_flower' &&
      kind !== 'new_place' &&
      kind !== 'season_update' &&
      kind !== 'news'
    ) {
      errors.push({ index: i, reason: `kind không hợp lệ: ${String(obj.kind)}` });
      continue;
    }

    // Kiểm tra sources ≥ 1 URL http(s)
    if (!Array.isArray(obj.sources) || obj.sources.length === 0) {
      errors.push({ index: i, reason: 'Cần ít nhất 1 nguồn (sources)' });
      continue;
    }

    const normalizedSources: SuggestionSource[] = [];
    let sourcesValid = true;
    for (const s of obj.sources) {
      let urlStr = '';
      let title: string | undefined;
      let published: string | undefined;

      if (typeof s === 'string') {
        urlStr = s.trim();
      } else if (s && typeof s === 'object' && typeof (s as { url?: unknown }).url === 'string') {
        const sObj = s as Record<string, unknown>;
        urlStr = String(sObj.url).trim();
        if (typeof sObj.title === 'string' && sObj.title.trim()) {
          title = sObj.title.trim();
        }
        if (typeof sObj.published === 'string' && sObj.published.trim()) {
          published = sObj.published.trim();
        }
      } else {
        sourcesValid = false;
        break;
      }

      if (!urlStr) {
        sourcesValid = false;
        break;
      }

      try {
        const u = new URL(urlStr);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          sourcesValid = false;
          break;
        }
      } catch {
        sourcesValid = false;
        break;
      }

      normalizedSources.push({
        url: urlStr,
        ...(title ? { title } : {}),
        ...(published ? { published } : {}),
      });
    }

    if (!sourcesValid || normalizedSources.length === 0) {
      errors.push({
        index: i,
        reason: 'source không phải http(s) hoặc không đúng định dạng URL',
      });
      continue;
    }

    // Kiểm tra payload đúng shape theo kind
    const payload = obj.payload;
    if (!payload || typeof payload !== 'object') {
      errors.push({ index: i, reason: 'Thiếu payload hợp lệ' });
      continue;
    }

    const pObj = payload as Record<string, unknown>;
    let payloadError: string | null = null;
    let targetSlug: string | null =
      typeof obj.target_slug === 'string' && obj.target_slug.trim()
        ? obj.target_slug.trim()
        : null;

    if (kind === 'new_flower') {
      const nameRaw =
        typeof (pObj.name ?? pObj.ten) === 'string'
          ? String(pObj.name ?? pObj.ten).trim()
          : '';
      if (!nameRaw) {
        payloadError = 'new_flower: Thiếu tên tiếng Việt của loài hoa';
      } else {
        const seasons = parseSeasonsFromBody(pObj);
        if (!seasons || seasons.length === 0) {
          payloadError = 'new_flower: Cần ít nhất 1 đợt nở hợp lệ (tháng bắt đầu và kết thúc)';
        } else {
          const regions = parseRegionsFromBody(pObj);
          if (!regions || regions.length === 0) {
            payloadError = 'new_flower: Cần chọn ít nhất 1 vùng (bac, trung, nam)';
          }
        }
      }
      if (!targetSlug && nameRaw) {
        targetSlug =
          typeof pObj.slug === 'string' && pObj.slug.trim()
            ? pObj.slug.trim()
            : slugifyVietnamese(nameRaw);
      }
    } else if (kind === 'new_place') {
      const placeName =
        typeof (pObj.name ?? pObj.ten) === 'string'
          ? String(pObj.name ?? pObj.ten).trim()
          : '';
      const province =
        typeof (pObj.province ?? pObj.tinh) === 'string'
          ? String(pObj.province ?? pObj.tinh).trim()
          : '';
      const region =
        typeof (pObj.region ?? pObj.vung) === 'string'
          ? String(pObj.region ?? pObj.vung).trim()
          : '';

      if (!placeName) {
        payloadError = 'new_place: Thiếu tên địa điểm';
      } else if (!province) {
        payloadError = 'new_place: Thiếu tên tỉnh/thành';
      } else if (region !== 'bac' && region !== 'trung' && region !== 'nam') {
        payloadError = 'new_place: Thiếu vùng hợp lệ (bac, trung, nam)';
      } else {
        const mapsUrlRaw =
          pObj.maps_url ??
          pObj.mapsUrl ??
          pObj.google_maps_url ??
          pObj.map_url;
        if (typeof mapsUrlRaw === 'string' && mapsUrlRaw.trim()) {
          if (!isValidGoogleMapsUrl(mapsUrlRaw.trim())) {
            payloadError = 'maps_url host lạ hoặc không đúng link Google Maps hợp lệ';
          }
        }
      }
      if (!targetSlug && placeName) {
        targetSlug =
          typeof pObj.slug === 'string' && pObj.slug.trim()
            ? pObj.slug.trim()
            : slugifyVietnamese(placeName);
      }
    } else if (kind === 'season_update') {
      const slug =
        typeof pObj.slug === 'string' && pObj.slug.trim() ? pObj.slug.trim() : '';
      const rawYear = pObj.year;
      const year =
        typeof rawYear === 'number'
          ? rawYear
          : parseInt(String(rawYear ?? ''), 10);

      if (!slug) {
        payloadError = 'season_update: Thiếu slug loài hoa';
      } else if (!year || isNaN(year) || year < 2000 || year > 2100) {
        payloadError = 'season_update: Thiếu năm (year) hợp lệ (2000–2100)';
      }
      targetSlug = slug || targetSlug;
    } else if (kind === 'news') {
      const text =
        typeof pObj.text === 'string' && pObj.text.trim() ? pObj.text.trim() : '';
      if (!text) {
        payloadError = 'news: Thiếu nội dung tin (text)';
      }
      if (!targetSlug && typeof pObj.slug === 'string' && pObj.slug.trim()) {
        targetSlug = pObj.slug.trim();
      }
    }

    if (payloadError) {
      errors.push({ index: i, reason: payloadError });
      continue;
    }

    // Xác định dedupe_key
    let dedupeKey =
      typeof obj.dedupe_key === 'string' && obj.dedupe_key.trim()
        ? obj.dedupe_key.trim()
        : null;

    if (!dedupeKey) {
      if (kind === 'season_update') {
        dedupeKey = `season_update:${targetSlug}:${pObj.year}`;
      } else if (kind === 'new_flower') {
        dedupeKey = `new_flower:${targetSlug || pObj.name}`;
      } else if (kind === 'new_place') {
        dedupeKey = `new_place:${targetSlug || pObj.name}`;
      } else if (kind === 'news') {
        dedupeKey = `news:${normalizedSources[0].url}`;
      }
    }

    if (dedupeKey) {
      if (seenBatchDedupe.has(dedupeKey)) {
        skipped++;
        continue;
      }
      const existing = await db
        .prepare(`SELECT id FROM suggestions WHERE dedupe_key = ?`)
        .bind(dedupeKey)
        .first<{ id: string }>();
      if (existing) {
        skipped++;
        continue;
      }
      seenBatchDedupe.add(dedupeKey);
    }

    // Ghi vào suggestions
    const id =
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `sug_${crypto.randomUUID()}`;
    const summary =
      typeof obj.summary === 'string' && obj.summary.trim()
        ? obj.summary.trim()
        : null;
    const rawConf = obj.confidence;
    const confidence =
      typeof rawConf === 'number'
        ? rawConf
        : typeof rawConf === 'string'
          ? parseFloat(rawConf)
          : 0.9;
    const nowIso = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO suggestions (id, kind, target_slug, payload, sources, summary, confidence, status, created_at, reviewed_at, dedupe_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, ?)`,
      )
      .bind(
        id,
        kind,
        targetSlug,
        JSON.stringify(pObj),
        JSON.stringify(normalizedSources),
        summary,
        isNaN(confidence) ? 0.9 : confidence,
        nowIso,
        dedupeKey,
      )
      .run();

    inserted++;
  }

  return jsonResponse({ inserted, skipped, errors }, 200);
}

/**
 * GET /api/bot/tom-tat
 * Trả slug + tên + mùa của mọi loài/điểm hiện có và dedupe_key 60 ngày gần nhất.
 */
export async function handleBotGetSummary(
  _request: Request,
  env: Env,
): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  // 1. Danh sách loài hoa hiện có (JSON gốc + approved trong flowers_extra)
  const baseFlowersMap = new Map<string, { slug: string; name: string; seasons: unknown }>();
  for (const bf of baseFlowersJson as unknown as Array<{
    slug: string;
    name: string;
    season?: unknown;
    seasons?: unknown;
  }>) {
    baseFlowersMap.set(bf.slug, {
      slug: bf.slug,
      name: bf.name,
      seasons: bf.seasons ?? (bf.season ? [bf.season] : []),
    });
  }

  try {
    const extraFlowers = await db
      .prepare(`SELECT slug, data FROM flowers_extra WHERE status = 'approved'`)
      .all<{ slug: string; data: string }>();
    for (const r of extraFlowers.results ?? []) {
      if (baseFlowersMap.has(r.slug)) continue;
      try {
        const parsed = JSON.parse(r.data) as FlowerExtraData;
        baseFlowersMap.set(r.slug, {
          slug: r.slug,
          name: parsed.name || r.slug,
          seasons: parsed.seasons || [],
        });
      } catch {}
    }
  } catch {}

  // 2. Danh sách địa điểm hiện có (JSON gốc + approved trong places_extra)
  const basePlacesMap = new Map<
    string,
    { slug: string; name: string; province: string; flowers: unknown }
  >();
  for (const bp of basePlacesJson as unknown as Array<{
    slug: string;
    name: string;
    province: string;
    flowers?: unknown;
  }>) {
    basePlacesMap.set(bp.slug, {
      slug: bp.slug,
      name: bp.name,
      province: bp.province,
      flowers: bp.flowers ?? [],
    });
  }

  try {
    const extraPlaces = await db
      .prepare(`SELECT slug, data FROM places_extra WHERE status = 'approved'`)
      .all<{ slug: string; data: string }>();
    for (const r of extraPlaces.results ?? []) {
      if (basePlacesMap.has(r.slug)) continue;
      try {
        const parsed = JSON.parse(r.data) as PlaceExtraData;
        basePlacesMap.set(r.slug, {
          slug: r.slug,
          name: parsed.name || r.slug,
          province: parsed.province || '',
          flowers: parsed.flowers || [],
        });
      } catch {}
    }
  } catch {}

  // 3. dedupe_keys 60 ngày gần nhất
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const dedupeKeys: string[] = [];
  try {
    const dRows = await db
      .prepare(
        `SELECT dedupe_key FROM suggestions WHERE dedupe_key IS NOT NULL AND created_at >= ?`,
      )
      .bind(sixtyDaysAgo)
      .all<{ dedupe_key: string }>();
    for (const r of dRows.results ?? []) {
      if (r.dedupe_key && typeof r.dedupe_key === 'string') {
        dedupeKeys.push(r.dedupe_key);
      }
    }
  } catch {}

  return jsonResponse(
    {
      flowers: Array.from(baseFlowersMap.values()),
      places: Array.from(basePlacesMap.values()),
      dedupe_keys: dedupeKeys,
      dedupeKeys,
    },
    200,
    { 'Cache-Control': 'no-cache' },
  );
}

/**
 * GET /api/admin/de-xuat?status=
 * Admin xem danh sách đề xuất.
 */
export async function handleGetAdminSuggestions(
  request: Request,
  env: Env,
): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status')?.trim().toLowerCase();

  let rows: SuggestionRow[] = [];
  try {
    if (statusFilter && statusFilter !== 'all') {
      const res = await db
        .prepare(
          `SELECT id, kind, target_slug, payload, sources, summary, confidence, status, created_at, reviewed_at, dedupe_key
           FROM suggestions
           WHERE status = ?
           ORDER BY created_at DESC`,
        )
        .bind(statusFilter)
        .all<SuggestionRow>();
      rows = res.results ?? [];
    } else {
      const res = await db
        .prepare(
          `SELECT id, kind, target_slug, payload, sources, summary, confidence, status, created_at, reviewed_at, dedupe_key
           FROM suggestions
           ORDER BY created_at DESC`,
        )
        .all<SuggestionRow>();
      rows = res.results ?? [];
    }
  } catch {
    rows = [];
  }

  const suggestions: SuggestionItem[] = [];
  for (const r of rows) {
    let payload: Record<string, unknown> = {};
    let sources: SuggestionSource[] = [];
    try {
      payload = JSON.parse(r.payload) as Record<string, unknown>;
    } catch {}
    try {
      sources = JSON.parse(r.sources) as SuggestionSource[];
    } catch {}

    suggestions.push({
      id: r.id,
      kind: r.kind,
      target_slug: r.target_slug,
      payload,
      sources,
      summary: r.summary,
      confidence: r.confidence,
      status: r.status,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      dedupe_key: r.dedupe_key,
    });
  }

  return jsonResponse({ suggestions }, 200, { 'Cache-Control': 'no-cache' });
}

/**
 * POST /api/admin/de-xuat/:id/apply
 * Áp dụng đề xuất vào dữ liệu chính thức và kích hoạt build.
 */
export async function handleApplyAdminSuggestion(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  const row = await db
    .prepare(
      `SELECT id, kind, target_slug, payload, sources, summary, confidence, status, created_at, reviewed_at, dedupe_key
       FROM suggestions WHERE id = ?`,
    )
    .bind(id)
    .first<SuggestionRow>();

  if (!row) {
    return jsonResponse({ error: 'Không tìm thấy đề xuất' }, 404);
  }

  // Admin có thể gửi kèm body đã chỉnh sửa trước khi áp dụng
  let editedPayload: Record<string, unknown> | null = null;
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    if (rawBody && typeof rawBody === 'object') {
      if (rawBody.payload && typeof rawBody.payload === 'object') {
        editedPayload = rawBody.payload as Record<string, unknown>;
      } else if (Object.keys(rawBody).length > 0) {
        editedPayload = rawBody;
      }
    }
  } catch {}

  let payload: Record<string, unknown>;
  try {
    payload = editedPayload ?? (JSON.parse(row.payload) as Record<string, unknown>);
  } catch {
    payload = editedPayload ?? {};
  }

  const nowIso = new Date().toISOString();
  let buildResult: unknown = null;

  if (row.kind === 'new_flower') {
    const validated = await buildAndValidateFlowerPayload(payload, env, db, {
      isAdmin: true,
    });
    if (!validated.ok) {
      return jsonResponse({ error: validated.error }, 400);
    }

    const { slug, flowerData, createdPlaces, submitter } = validated;
    for (const placeData of createdPlaces) {
      await db
        .prepare(
          `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
           VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
        )
        .bind(placeData.slug, JSON.stringify(placeData), submitter ?? 'Phùng Kiên', nowIso, nowIso)
        .run();
    }

    await db
      .prepare(
        `INSERT INTO flowers_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
         VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
      )
      .bind(slug, JSON.stringify(flowerData), submitter ?? 'Phùng Kiên', nowIso, nowIso)
      .run();

    buildResult = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });
  } else if (row.kind === 'new_place') {
    const validated = await buildAndValidatePlacePayload(payload, env, db, {});
    if (!validated.ok) {
      return jsonResponse({ error: validated.error }, 400);
    }

    const { slug, placeData, submitter } = validated;
    await db
      .prepare(
        `INSERT INTO places_extra (slug, status, source, data, submitter, ip_hash, created_at, reviewed_at)
         VALUES (?, 'approved', 'admin', ?, ?, NULL, ?, ?)`,
      )
      .bind(slug, JSON.stringify(placeData), submitter ?? 'Phùng Kiên', nowIso, nowIso)
      .run();

    buildResult = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });
  } else if (row.kind === 'season_update') {
    const targetSlug =
      typeof payload.slug === 'string' && payload.slug.trim()
        ? payload.slug.trim()
        : row.target_slug ?? '';

    if (!targetSlug) {
      return jsonResponse({ error: 'season_update: thiếu slug loài hoa' }, 400);
    }

    // Kiểm tra xem loài có trong flowers_extra không
    const flowerExtraRow = await db
      .prepare(`SELECT slug, data FROM flowers_extra WHERE slug = ?`)
      .bind(targetSlug)
      .first<{ slug: string; data: string }>();

    if (flowerExtraRow) {
      // Ghi đè/thêm đợt cho loài trong flowers_extra
      try {
        const flowerData = JSON.parse(flowerExtraRow.data) as FlowerExtraData;
        const newSeasons = parseSeasonsFromBody(payload);
        if (newSeasons && newSeasons.length > 0) {
          flowerData.seasons = newSeasons;
        }
        await db
          .prepare(
            `UPDATE flowers_extra SET data = ?, reviewed_at = ? WHERE slug = ?`,
          )
          .bind(JSON.stringify(flowerData), nowIso, targetSlug)
          .run();
      } catch (err) {
        return jsonResponse(
          { error: `Không thể cập nhật flowers_extra: ${String(err)}` },
          500,
        );
      }
    } else {
      // Loài gốc trong JSON (như da-quy, mai-anh-dao...) → lưu vào bảng season_overrides
      const rawYear = payload.year;
      const year =
        typeof rawYear === 'number'
          ? rawYear
          : parseInt(String(rawYear ?? ''), 10) || new Date().getFullYear();

      const startStr =
        payload.start !== undefined && payload.start !== null
          ? typeof payload.start === 'object'
            ? JSON.stringify(payload.start)
            : String(payload.start)
          : null;
      const peakStr =
        payload.peak !== undefined && payload.peak !== null
          ? typeof payload.peak === 'object'
            ? JSON.stringify(payload.peak)
            : String(payload.peak)
          : null;
      const endStr =
        payload.end !== undefined && payload.end !== null
          ? typeof payload.end === 'object'
            ? JSON.stringify(payload.end)
            : String(payload.end)
          : null;
      const noteStr =
        typeof payload.note === 'string' && payload.note.trim()
          ? payload.note.trim()
          : null;
      const sourcesStr =
        row.sources ||
        (payload.sources ? JSON.stringify(payload.sources) : null);

      await db
        .prepare(
          `INSERT INTO season_overrides (slug, year, start, peak, end, note, sources, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(slug, year) DO UPDATE SET
             start = excluded.start,
             peak = excluded.peak,
             end = excluded.end,
             note = excluded.note,
             sources = excluded.sources,
             created_at = excluded.created_at`,
        )
        .bind(targetSlug, year, startStr, peakStr, endStr, noteStr, sourcesStr, nowIso)
        .run();
    }

    buildResult = await triggerBuildIfNeeded(env, { triggeredAtIso: nowIso });
  } else if (row.kind === 'news') {
    // news: chỉ đánh dấu đã xem
    // Cũng có thể kích hoạt build nếu cần
  }

  // Cập nhật trạng thái suggestion thành applied
  await db
    .prepare(
      `UPDATE suggestions SET status = 'applied', reviewed_at = ? WHERE id = ?`,
    )
    .bind(nowIso, id)
    .run();

  return jsonResponse(
    {
      ok: true,
      id,
      status: 'applied',
      kind: row.kind,
      build: buildResult,
    },
    200,
  );
}

/**
 * POST /api/admin/de-xuat/:id/dismiss
 * Bỏ qua đề xuất (không thay đổi dữ liệu, không kích hoạt build).
 */
export async function handleDismissAdminSuggestion(
  _request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const db = getDb(env);
  await ensureSchema(db);

  const row = await db
    .prepare(`SELECT id, status FROM suggestions WHERE id = ?`)
    .bind(id)
    .first<{ id: string; status: string }>();

  if (!row) {
    return jsonResponse({ error: 'Không tìm thấy đề xuất' }, 404);
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `UPDATE suggestions SET status = 'dismissed', reviewed_at = ? WHERE id = ?`,
    )
    .bind(nowIso, id)
    .run();

  return jsonResponse(
    {
      ok: true,
      id,
      status: 'dismissed',
    },
    200,
  );
}
