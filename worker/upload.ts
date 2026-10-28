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
