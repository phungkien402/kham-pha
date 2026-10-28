import { clearJwksCache, normalizeTeamDomain, verifyAccessJwt } from './auth';
import {
  deleteAdminPhoto,
  handleDeleteAdminPhoto,
  handleGetAdminPhotos,
  handleGetPhotoFile,
  handleGetPublicPhotos,
  handleHideAdminPhoto,
  hideAdminPhoto,
  listAdminPhotos,
  listApprovedPhotos,
} from './photos';
import {
  ensureSchema,
  getBucket,
  getDb,
  jsonResponse,
  type Env,
  type ExecutionContext,
  type PhotoItem,
  type PhotoRow,
} from './types';
import {
  detectImageFormat,
  handleAdminUpload,
  isValidFlowerSlug,
  isValidImageMagicBytes,
  MAX_UPLOAD_BYTES,
  parseImageDimensions,
  VALID_FLOWER_SLUGS,
} from './upload';

export {
  clearJwksCache,
  deleteAdminPhoto,
  detectImageFormat,
  ensureSchema,
  getBucket,
  getDb,
  handleAdminUpload,
  handleDeleteAdminPhoto,
  handleGetAdminPhotos,
  handleGetPhotoFile,
  handleGetPublicPhotos,
  handleHideAdminPhoto,
  hideAdminPhoto,
  isValidFlowerSlug,
  isValidImageMagicBytes,
  jsonResponse,
  listAdminPhotos,
  listApprovedPhotos,
  MAX_UPLOAD_BYTES,
  normalizeTeamDomain,
  parseImageDimensions,
  VALID_FLOWER_SLUGS,
  verifyAccessJwt,
  type Env,
  type ExecutionContext,
  type PhotoItem,
  type PhotoRow,
};

export default {
  async fetch(request: Request, env: Env = {}, _ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    // 1. Bảo vệ trang /admin* bằng Cloudflare Access JWT
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const authorized = await verifyAccessJwt(request, env);
      if (!authorized) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      return new Response('<!doctype html><html lang="vi"><title>Admin</title></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // 2. Bảo vệ toàn bộ /api/admin/* bằng Cloudflare Access JWT
    if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
      const authorized = await verifyAccessJwt(request, env);
      if (!authorized) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }

      if (pathname === '/api/admin/upload' && method === 'POST') {
        return handleAdminUpload(request, env);
      }

      if (pathname === '/api/admin/photos' && method === 'GET') {
        return handleGetAdminPhotos(request, env);
      }

      const hideMatch = pathname.match(/^\/api\/admin\/photos\/([^/]+)\/hide$/);
      if (hideMatch && method === 'POST') {
        return handleHideAdminPhoto(request, env, decodeURIComponent(hideMatch[1]));
      }

      const deleteMatch = pathname.match(/^\/api\/admin\/photos\/([^/]+)$/);
      if (deleteMatch && method === 'DELETE') {
        return handleDeleteAdminPhoto(request, env, decodeURIComponent(deleteMatch[1]));
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // 3. API công khai lấy danh sách ảnh approved theo loài
    if (pathname === '/api/anh' && method === 'GET') {
      return handleGetPublicPhotos(request, env);
    }

    // 4. API công khai phục vụ file ảnh approved (.webp và -600.webp)
    const fileMatch = pathname.match(/^\/api\/anh\/([a-zA-Z0-9_-]+?)(-600)?\.webp$/);
    if (fileMatch && method === 'GET') {
      const id = fileMatch[1];
      const is600 = Boolean(fileMatch[2]);
      return handleGetPhotoFile(request, env, id, is600);
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
