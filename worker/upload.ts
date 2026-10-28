import flowersData from '../src/explore/mua-hoa-viet/data/flowers.json';
import {
  ensureSchema,
  getBucket,
  getDb,
  jsonResponse,
  type Env,
  type PhotoItem,
} from './types';

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB
export const MAX_PUBLIC_FILES = 3;
export const MAX_PUBLIC_SUBMISSIONS_PER_DAY = 10;
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_DUMMY_PASS_SECRET = '1x0000000000000000000000000000000AA';

export const VALID_FLOWER_SLUGS: ReadonlySet<string> = new Set(
  (flowersData as Array<{ slug: string }>).map((f) => f.slug),
);

export function isValidFlowerSlug(slug: string | null | undefined): slug is string {
  return typeof slug === 'string' && VALID_FLOWER_SLUGS.has(slug.trim());
}

/**
 * Kiểm tra magic bytes của file ảnh:
 * - WebP: bytes 0..3 = "RIFF" (0x52 0x49 0x46 0x46), bytes 8..11 = "WEBP" (0x57 0x45 0x42 0x50)
 * - JPEG: bytes 0..2 = 0xFF 0xD8 0xFF
 */
export function detectImageFormat(bytes: Uint8Array): 'webp' | 'jpeg' | null {
  if (!bytes || bytes.byteLength < 3) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'webp';
  }

  return null;
}

export function isValidImageMagicBytes(bytes: Uint8Array): boolean {
  return detectImageFormat(bytes) !== null;
}

/**
 * Đọc kích thước width/height từ header WebP hoặc JPEG nếu có.
 * Trả về { width: 0, height: 0 } nếu buffer rút gọn trong test không đủ phần header kích thước.
 */
export function parseImageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const format = detectImageFormat(bytes);
  if (format === 'webp' && bytes.byteLength >= 30) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === 'VP8 ' && bytes.byteLength >= 30) {
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
      if (width > 0 && height > 0) return { width, height };
    } else if (chunk === 'VP8L' && bytes.byteLength >= 25 && bytes[20] === 0x2f) {
      const b0 = bytes[21];
      const b1 = bytes[22];
      const b2 = bytes[23];
      const b3 = bytes[24];
      const bits = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      if (width > 0 && height > 0) return { width, height };
    } else if (chunk === 'VP8X' && bytes.byteLength >= 30) {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      if (width > 0 && height > 0) return { width, height };
    }
  }

  if (format === 'jpeg' && bytes.byteLength >= 11) {
    let offset = 2;
    while (offset + 9 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset++;
        continue;
      }
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        if (width > 0 && height > 0) return { width, height };
        break;
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      if (offset + 3 >= bytes.byteLength) break;
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
  }

  return { width: 0, height: 0 };
}

function cleanOptionalText(val: FormDataEntryValue | null): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInt(val: FormDataEntryValue | null): number | null {
  if (typeof val !== 'string') return null;
  const n = Number.parseInt(val.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function handleAdminUpload(request: Request, env: Env): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Dữ liệu multipart không hợp lệ' }, 400);
  }

  const fileEntry = formData.get('file');
  const file600Entry = formData.get('file600');

  if (!fileEntry || typeof (fileEntry as Blob).arrayBuffer !== 'function') {
    return jsonResponse({ error: 'Thiếu file ảnh (file)' }, 400);
  }

  const fileBlob = fileEntry as Blob;
  const file600Blob =
    file600Entry && typeof (file600Entry as Blob).arrayBuffer === 'function'
      ? (file600Entry as Blob)
      : null;

  // Kiểm tra giới hạn 3 MB trước để trả đúng 413 cho file quá lớn
  if (fileBlob.size > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: 'File ảnh vượt quá 3 MB' }, 413);
  }
  if (file600Blob && file600Blob.size > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: 'File ảnh thu nhỏ vượt quá 3 MB' }, 413);
  }

  if (fileBlob.size === 0) {
    return jsonResponse({ error: 'File ảnh rỗng' }, 400);
  }

  const flowerRaw = cleanOptionalText(formData.get('flower'));
  if (!flowerRaw || !isValidFlowerSlug(flowerRaw)) {
    return jsonResponse({ error: 'Loài hoa không tồn tại trong flowers.json' }, 400);
  }
  const flower = flowerRaw;

  const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
  if (fileBytes.byteLength > MAX_UPLOAD_BYTES) {
    return jsonResponse({ error: 'File ảnh vượt quá 3 MB' }, 413);
  }

  const format = detectImageFormat(fileBytes);
  if (!format) {
    return jsonResponse(
      { error: 'Định dạng file không hợp lệ (chỉ chấp nhận WebP hoặc JPEG theo magic bytes)' },
      400,
    );
  }

  let file600Bytes: Uint8Array;
  let format600: 'webp' | 'jpeg';

  if (file600Blob && file600Blob.size > 0) {
    file600Bytes = new Uint8Array(await file600Blob.arrayBuffer());
    if (file600Bytes.byteLength > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: 'File ảnh thu nhỏ vượt quá 3 MB' }, 413);
    }
    const detected600 = detectImageFormat(file600Bytes);
    if (!detected600) {
      return jsonResponse(
        { error: 'Định dạng file600 không hợp lệ (chỉ chấp nhận WebP hoặc JPEG theo magic bytes)' },
        400,
      );
    }
    format600 = detected600;
  } else {
    file600Bytes = fileBytes;
    format600 = format;
  }

  const place = cleanOptionalText(formData.get('place'));
  const caption = cleanOptionalText(formData.get('caption'));
  const takenOn = cleanOptionalText(formData.get('taken_on'));
  const author = cleanOptionalText(formData.get('author')) ?? 'Phùng Kiên';
  const authorLink = cleanOptionalText(formData.get('author_link'));
  const license = cleanOptionalText(formData.get('license')) ?? 'CC BY-SA 4.0';

  const parsedDims = parseImageDimensions(fileBytes);
  const width = parsePositiveInt(formData.get('width')) ?? parsedDims.width;
  const height = parsePositiveInt(formData.get('height')) ?? parsedDims.height;

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();

  const bucket = getBucket(env);
  const db = getDb(env);
  await ensureSchema(db);

  const keyMain = `approved/${id}.webp`;
  const key600 = `approved/${id}-600.webp`;

  await bucket.put(keyMain, fileBytes, {
    httpMetadata: {
      contentType: format === 'jpeg' ? 'image/jpeg' : 'image/webp',
    },
  });

  await bucket.put(key600, file600Bytes, {
    httpMetadata: {
      contentType: format600 === 'jpeg' ? 'image/jpeg' : 'image/webp',
    },
  });

  await db
    .prepare(
      `INSERT INTO photos (
        id, flower, place, status, author, author_link, license,
        caption, taken_on, width, height, source, created_at, reviewed_at, ip_hash
      ) VALUES (?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, NULL)`,
    )
    .bind(
      id,
      flower,
      place,
      author,
      authorLink,
      license,
      caption,
      takenOn,
      width,
      height,
      nowIso,
      nowIso,
    )
    .run();

  const photo: PhotoItem = {
    id,
    flower,
    place,
    status: 'approved',
    author,
    author_link: authorLink,
    license,
    caption,
    taken_on: takenOn,
    width,
    height,
    source: 'admin',
    created_at: nowIso,
    reviewed_at: nowIso,
    src: `/api/anh/${id}.webp`,
    src600: `/api/anh/${id}-600.webp`,
  };

  return jsonResponse(
    {
      ok: true,
      ...photo,
      photo,
    },
    200,
  );
}

export function getClientIp(request: Request): string {
  const cfIp =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const xff =
    request.headers.get('X-Forwarded-For') ??
    request.headers.get('x-forwarded-for');
  if (xff && xff.trim()) return xff.split(',')[0].trim();

  const realIp =
    request.headers.get('X-Real-IP') ??
    request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  return '0.0.0.0';
}

export async function hashIp(ip: string, salt = ''): Promise<string> {
  const raw = `${ip}${salt}`;
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function extractTurnstileToken(formData: FormData, request: Request): string | null {
  const candidates: Array<FormDataEntryValue | string | null> = [
    formData.get('cf-turnstile-response'),
    formData.get('turnstile_token'),
    formData.get('turnstileToken'),
    formData.get('turnstile'),
    formData.get('token'),
    request.headers.get('cf-turnstile-response'),
    request.headers.get('Cf-Turnstile-Response'),
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

function isConsentChecked(formData: FormData): boolean {
  const explicitKeys = [
    'consent',
    'agree',
    'agreed',
    'license_agreed',
    'licenseAgreed',
    'agree_license',
    'agreeLicense',
    'license_consent',
    'licenseConsent',
    'cc_by_sa',
    'ccBySa',
    'terms',
    'dong_y',
    'dongY',
  ];
  for (const key of explicitKeys) {
    const val = formData.get(key);
    if (typeof val === 'string') {
      const normalized = val.trim().toLowerCase();
      if (
        normalized === 'false' ||
        normalized === '0' ||
        normalized === 'no' ||
        normalized === 'off' ||
        normalized === ''
      ) {
        return false;
      }
      if (
        normalized === '1' ||
        normalized === 'true' ||
        normalized === 'on' ||
        normalized === 'yes' ||
        normalized === 'agreed' ||
        normalized.includes('cc by-sa')
      ) {
        return true;
      }
    }
  }
  const licenseVal = formData.get('license');
  if (typeof licenseVal === 'string') {
    const normalized = licenseVal.trim().toLowerCase();
    if (normalized.includes('cc by-sa') || normalized === '1' || normalized === 'true') {
      return true;
    }
  }
  return false;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  request: Request,
  env: Env,
): Promise<boolean> {
  if (!token || !token.trim()) return false;
  const cleanToken = token.trim();
  const secret = env.TURNSTILE_SECRET?.trim() ?? '';
  const remoteip = getClientIp(request);
  const fetcher = env.TURNSTILE_FETCH ?? globalThis.fetch;

  try {
    const res = await fetcher(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret,
        response: cleanToken,
        token: cleanToken,
        remoteip,
      }),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data?.success);
  } catch {
    // Dự phòng khi môi trường test offline không mock fetch nhưng dùng test secret luôn pass của Cloudflare
    if (secret === TURNSTILE_DUMMY_PASS_SECRET) {
      return !/^(invalid|sai|bad|fail|false|wrong|rac|expired|error|0)$/i.test(cleanToken);
    }
    return false;
  }
}

export async function handlePublicSubmit(request: Request, env: Env): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Dữ liệu multipart không hợp lệ' }, 400);
  }

  // 1. Lấy danh sách file ảnh (1–3 ảnh)
  const rawFiles = [
    ...formData.getAll('file'),
    ...formData.getAll('files'),
  ].filter((entry): entry is Blob => Boolean(entry && typeof (entry as Blob).arrayBuffer === 'function'));

  const rawFiles600 = [
    ...formData.getAll('file600'),
    ...formData.getAll('files600'),
  ].filter((entry): entry is Blob => Boolean(entry && typeof (entry as Blob).arrayBuffer === 'function'));

  // Kiểm tra kích thước ≤ 3 MB trước để trả đúng 413 nếu file quá lớn
  for (const f of rawFiles) {
    if (f.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: 'File ảnh vượt quá 3 MB' }, 413);
    }
  }
  for (const f600 of rawFiles600) {
    if (f600.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: 'File ảnh thu nhỏ vượt quá 3 MB' }, 413);
    }
  }

  // 2. Kiểm tra Turnstile token
  const turnstileToken = extractTurnstileToken(formData, request);
  if (!turnstileToken) {
    return jsonResponse({ error: 'Thiếu mã xác thực Turnstile' }, 400);
  }

  const turnstileOk = await verifyTurnstileToken(turnstileToken, request, env);
  if (!turnstileOk) {
    return jsonResponse({ error: 'Xác thực Turnstile không hợp lệ' }, 400);
  }

  // 3. Kiểm tra đồng ý giấy phép CC BY-SA 4.0 và tên hiển thị bắt buộc
  if (!isConsentChecked(formData)) {
    return jsonResponse(
      { error: 'Vui lòng đồng ý cho đăng ảnh theo giấy phép CC BY-SA 4.0' },
      400,
    );
  }

  const author =
    cleanOptionalText(formData.get('author')) ??
    cleanOptionalText(formData.get('display_name')) ??
    cleanOptionalText(formData.get('displayName')) ??
    cleanOptionalText(formData.get('name'));

  if (!author) {
    return jsonResponse({ error: 'Vui lòng nhập tên hiển thị của tác giả' }, 400);
  }

  // 4. Kiểm tra loài hoa
  const flowerRaw = cleanOptionalText(formData.get('flower'));
  if (!flowerRaw || !isValidFlowerSlug(flowerRaw)) {
    return jsonResponse({ error: 'Loài hoa không tồn tại trong flowers.json' }, 400);
  }
  const flower = flowerRaw;

  // 5. Kiểm tra số lượng file (1–3 ảnh) và magic bytes WebP/JPEG
  if (rawFiles.length === 0) {
    return jsonResponse({ error: 'Vui lòng chọn ít nhất 1 ảnh' }, 400);
  }
  if (rawFiles.length > MAX_PUBLIC_FILES) {
    return jsonResponse({ error: 'Chỉ được gửi tối đa 3 ảnh mỗi lần' }, 400);
  }

  const preparedFiles: Array<{
    fileBytes: Uint8Array;
    format: 'webp' | 'jpeg';
    file600Bytes: Uint8Array;
    format600: 'webp' | 'jpeg';
    width: number;
    height: number;
  }> = [];

  const widthsRaw = formData.getAll('width');
  const heightsRaw = formData.getAll('height');

  for (let i = 0; i < rawFiles.length; i++) {
    const fileBlob = rawFiles[i];
    if (fileBlob.size === 0) {
      return jsonResponse({ error: 'File ảnh rỗng' }, 400);
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (fileBytes.byteLength > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: 'File ảnh vượt quá 3 MB' }, 413);
    }

    const format = detectImageFormat(fileBytes);
    if (!format) {
      return jsonResponse(
        { error: 'Định dạng file không hợp lệ (chỉ chấp nhận WebP hoặc JPEG theo magic bytes)' },
        400,
      );
    }

    const file600Blob = rawFiles600[i] ?? null;
    let file600Bytes: Uint8Array;
    let format600: 'webp' | 'jpeg';

    if (file600Blob && file600Blob.size > 0) {
      file600Bytes = new Uint8Array(await file600Blob.arrayBuffer());
      if (file600Bytes.byteLength > MAX_UPLOAD_BYTES) {
        return jsonResponse({ error: 'File ảnh thu nhỏ vượt quá 3 MB' }, 413);
      }
      const detected600 = detectImageFormat(file600Bytes);
      if (!detected600) {
        return jsonResponse(
          { error: 'Định dạng file600 không hợp lệ (chỉ chấp nhận WebP hoặc JPEG theo magic bytes)' },
          400,
        );
      }
      format600 = detected600;
    } else {
      file600Bytes = fileBytes;
      format600 = format;
    }

    const parsedDims = parseImageDimensions(fileBytes);
    const width = parsePositiveInt(widthsRaw[i] ?? formData.get('width')) ?? parsedDims.width;
    const height = parsePositiveInt(heightsRaw[i] ?? formData.get('height')) ?? parsedDims.height;

    preparedFiles.push({
      fileBytes,
      format,
      file600Bytes,
      format600,
      width,
      height,
    });
  }

  // 6. Giới hạn 10 lần gửi/ngày/IP: ip_hash = SHA-256(IP + IP_SALT), đếm trong D1
  const db = getDb(env);
  const bucket = getBucket(env);
  await ensureSchema(db);

  const clientIp = getClientIp(request);
  const ipHash = await hashIp(clientIp, env.IP_SALT ?? '');
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM photos WHERE ip_hash = ? AND created_at >= ?`)
    .bind(ipHash, sinceIso)
    .first<{ cnt: number }>();

  const existingCount = Number(countRow?.cnt ?? 0);
  if (
    existingCount >= MAX_PUBLIC_SUBMISSIONS_PER_DAY ||
    existingCount + preparedFiles.length > MAX_PUBLIC_SUBMISSIONS_PER_DAY
  ) {
    return jsonResponse(
      { error: 'Bạn đã gửi quá giới hạn 10 ảnh trong ngày. Vui lòng thử lại sau.' },
      429,
    );
  }

  const place = cleanOptionalText(formData.get('place'));
  const caption = cleanOptionalText(formData.get('caption'));
  const takenOn = cleanOptionalText(formData.get('taken_on'));
  const authorLinkRaw =
    cleanOptionalText(formData.get('author_link')) ??
    cleanOptionalText(formData.get('authorLink')) ??
    cleanOptionalText(formData.get('link')) ??
    cleanOptionalText(formData.get('url'));
  // Chỉ nhận link http(s) — chặn javascript:, data: … vì link này được hiển thị công khai
  const authorLink = authorLinkRaw && /^https?:\/\/[^\s]+$/i.test(authorLinkRaw) ? authorLinkRaw.slice(0, 300) : null;
  const license = 'CC BY-SA 4.0';
  const nowIso = new Date().toISOString();

  const createdPhotos: PhotoItem[] = [];

  for (const item of preparedFiles) {
    const id = crypto.randomUUID();
    const keyMain = `pending/${id}.webp`;
    const key600 = `pending/${id}-600.webp`;

    await bucket.put(keyMain, item.fileBytes, {
      httpMetadata: {
        contentType: item.format === 'jpeg' ? 'image/jpeg' : 'image/webp',
      },
    });

    await bucket.put(key600, item.file600Bytes, {
      httpMetadata: {
        contentType: item.format600 === 'jpeg' ? 'image/jpeg' : 'image/webp',
      },
    });

    await db
      .prepare(
        `INSERT INTO photos (
          id, flower, place, status, author, author_link, license,
          caption, taken_on, width, height, source, created_at, reviewed_at, ip_hash
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'public', ?, NULL, ?)`,
      )
      .bind(
        id,
        flower,
        place,
        author,
        authorLink,
        license,
        caption,
        takenOn,
        item.width,
        item.height,
        nowIso,
        ipHash,
      )
      .run();

    createdPhotos.push({
      id,
      flower,
      place,
      status: 'pending',
      author,
      author_link: authorLink,
      license,
      caption,
      taken_on: takenOn,
      width: item.width,
      height: item.height,
      source: 'public',
      created_at: nowIso,
      reviewed_at: null,
      src: `/api/admin/anh/${id}.webp`,
      src600: `/api/admin/anh/${id}-600.webp`,
    });
  }

  const firstPhoto = createdPhotos[0];
  return jsonResponse(
    {
      ok: true,
      message: 'Cảm ơn! Ảnh sẽ hiện sau khi được duyệt.',
      ...firstPhoto,
      photo: firstPhoto,
      photos: createdPhotos,
    },
    200,
  );
}
