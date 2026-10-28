import { clearJwksCache, normalizeTeamDomain, verifyAccessJwt } from './auth';
import {
  approveAdminPhoto,
  deleteAdminPhoto,
  handleApproveAdminPhoto,
  handleDeleteAdminPhoto,
  handleGetAdminPhotoFile,
  handleGetAdminPhotos,
  handleGetPhotoCovers,
  handleGetPhotoFile,
  handleGetPublicPhotos,
  handleHideAdminPhoto,
  handleRejectAdminPhoto,
  hideAdminPhoto,
  listAdminPhotos,
  listApprovedCovers,
  listApprovedPhotos,
  rejectAdminPhoto,
  type ApprovePhotoUpdates,
} from './photos';
import {
  ensureSchema,
  getBucket,
  getDb,
  jsonResponse,
  type CoverItem,
  type Env,
  type ExecutionContext,
  type PhotoItem,
  type PhotoRow,
} from './types';
import {
  detectImageFormat,
  getClientIp,
  handleAdminUpload,
  handlePublicSubmit,
  hashIp,
  isValidFlowerSlug,
  isValidImageMagicBytes,
  MAX_PUBLIC_FILES,
  MAX_PUBLIC_SUBMISSIONS_PER_DAY,
  MAX_UPLOAD_BYTES,
  parseImageDimensions,
  TURNSTILE_DUMMY_PASS_SECRET,
  TURNSTILE_VERIFY_URL,
  VALID_FLOWER_SLUGS,
  verifyTurnstileToken,
} from './upload';

export {
  approveAdminPhoto,
  clearJwksCache,
  deleteAdminPhoto,
  detectImageFormat,
  ensureSchema,
  getBucket,
  getClientIp,
  getDb,
  handleAdminUpload,
  handleApproveAdminPhoto,
  handleDeleteAdminPhoto,
  handleGetAdminPhotoFile,
  handleGetAdminPhotos,
  handleGetPhotoCovers,
  handleGetPhotoFile,
  handleGetPublicPhotos,
  handleHideAdminPhoto,
  handlePublicSubmit,
  handleRejectAdminPhoto,
  hashIp,
  hideAdminPhoto,
  isValidFlowerSlug,
  isValidImageMagicBytes,
  jsonResponse,
  listAdminPhotos,
  listApprovedCovers,
  listApprovedPhotos,
  MAX_PUBLIC_FILES,
  MAX_PUBLIC_SUBMISSIONS_PER_DAY,
  MAX_UPLOAD_BYTES,
  normalizeTeamDomain,
  parseImageDimensions,
  rejectAdminPhoto,
  TURNSTILE_DUMMY_PASS_SECRET,
  TURNSTILE_VERIFY_URL,
  VALID_FLOWER_SLUGS,
  verifyAccessJwt,
  verifyTurnstileToken,
  type ApprovePhotoUpdates,
  type CoverItem,
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

      const adminFileMatch = pathname.match(/^\/api\/admin\/anh\/([a-zA-Z0-9_-]+?)(-600)?\.webp$/);
      if (adminFileMatch && method === 'GET') {
        const id = adminFileMatch[1];
        const is600 = Boolean(adminFileMatch[2]);
        return handleGetAdminPhotoFile(request, env, id, is600);
      }

      const approveMatch = pathname.match(/^\/api\/admin\/photos\/([^/]+)\/approve$/);
      if (approveMatch && method === 'POST') {
        return handleApproveAdminPhoto(request, env, decodeURIComponent(approveMatch[1]));
      }

      const rejectMatch = pathname.match(/^\/api\/admin\/photos\/([^/]+)\/reject$/);
      if (rejectMatch && method === 'POST') {
        return handleRejectAdminPhoto(request, env, decodeURIComponent(rejectMatch[1]));
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

    // 3. API công khai nhận ảnh người ngoài gửi
    if ((pathname === '/api/gui-anh' || pathname === '/api/gui-anh/') && method === 'POST') {
      return handlePublicSubmit(request, env);
    }

    // 4. API công khai lấy danh sách ảnh approved theo loài
    if (pathname === '/api/anh' && method === 'GET') {
      return handleGetPublicPhotos(request, env);
    }

    // 5. API công khai lấy ảnh bìa (approved mới nhất) của từng loài
    if (pathname === '/api/anh/bia' && method === 'GET') {
      return handleGetPhotoCovers(request, env);
    }

    // 6. API công khai phục vụ file ảnh approved (.webp và -600.webp)
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
