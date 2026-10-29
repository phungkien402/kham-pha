import {
  clearJwksCache,
  constantTimeCompare,
  normalizeTeamDomain,
  verifyAccessJwt,
  verifyBotToken,
} from './auth';
import {
  handleHvnTraLoi,
  handleHvnThongKe,
} from './hvn';
import {
  checkAndRecordBotRateLimit,
  handleApplyAdminSuggestion,
  handleBotGetSummary,
  handleBotSubmitSuggestions,
  handleDismissAdminSuggestion,
  handleGetAdminSuggestions,
} from './suggestions';
import {
  clearRemoteDataCache,
  isCloudflareBuildEnv,
  isSkipRemoteDataEnabled,
  loadCombinedData,
  mergeBySlug,
  mergeFlowers,
  mergePlaces,
  mergeRemoteData,
} from '../src/explore/mua-hoa-viet/remoteData';
import {
  BASE_FLOWER_COLORS,
  BUILD_DEBOUNCE_MS,
  FLOWER_COLOR_PALETTE,
  MAX_PUBLIC_FLOWER_SUBMISSIONS_PER_DAY,
  MAX_PUBLIC_PLACE_SUBMISSIONS_PER_DAY,
  PROVINCES_34,
  PROVINCE_TO_REGION,
  REGION_LABELS,
  VALID_PLACE_SLUGS,
  computeDefaultPeak,
  extractMapsCoords,
  generateUniqueFlowerSlug,
  generateUniquePlaceSlug,
  getBuildStatus,
  getRegionForProvince,
  handleAdminTriggerBuild,
  handleApproveAdminFlower,
  handleApproveAdminPlace,
  handleCreateAdminFlower,
  handleCreateAdminPlace,
  handleDeleteAdminFlower,
  handleDeleteAdminPlace,
  handleGetAdminBuildStatus,
  handleGetAdminFlowers,
  handleGetAdminPlaces,
  handleGetPublicData,
  handlePublicSubmitFlower,
  handlePublicSubmitPlace,
  handleRejectAdminFlower,
  handleRejectAdminPlace,
  handleUpdateAdminFlower,
  handleUpdateAdminPlace,
  hasBuildTriggerConfig,
  isKnownFlowerSlug,
  isValidGoogleMapsUrl,
  parseCoordsFromMapsUrl,
  pickFlowerColor,
  resolveMapsUrlAndExtractCoords,
  slugifyVietnamese,
  triggerBuildIfNeeded,
  triggerCloudflareBuild,
  type BuildTriggerResult,
  type ExtraRow,
  type FlowerExtraData,
  type FlowerSeason,
  type MonthDay,
  type PlaceExtraData,
  type RegionCode,
} from './extra';
import {
  approveAdminPhoto,
  deleteAdminPhoto,
  getWeeklyPhotosCount,
  handleApproveAdminPhoto,
  handleDeleteAdminPhoto,
  handleGetAdminPhotoFile,
  handleGetAdminPhotos,
  handleGetPhotoCovers,
  handleGetPhotoFile,
  handleGetPublicPhotos,
  handleGetWeeklyPhotos,
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
  countWeeklyPhotos,
  isPhotoInPast7Days,
  isPhotoInPastDays,
  type WeeklyPhotoCounts,
} from '../src/explore/mua-hoa-viet/weeklyPhotos';
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
  BASE_FLOWER_COLORS,
  BUILD_DEBOUNCE_MS,
  checkAndRecordBotRateLimit,
  clearJwksCache,
  clearRemoteDataCache,
  computeDefaultPeak,
  constantTimeCompare,
  countWeeklyPhotos,
  deleteAdminPhoto,
  detectImageFormat,
  ensureSchema,
  extractMapsCoords,
  FLOWER_COLOR_PALETTE,
  generateUniqueFlowerSlug,
  generateUniquePlaceSlug,
  getBucket,
  getBuildStatus,
  getClientIp,
  getDb,
  getRegionForProvince,
  getWeeklyPhotosCount,
  handleAdminTriggerBuild,
  handleAdminUpload,
  handleApplyAdminSuggestion,
  handleApproveAdminFlower,
  handleApproveAdminPhoto,
  handleApproveAdminPlace,
  handleBotGetSummary,
  handleBotSubmitSuggestions,
  handleCreateAdminFlower,
  handleCreateAdminPlace,
  handleDeleteAdminFlower,
  handleDeleteAdminPhoto,
  handleDeleteAdminPlace,
  handleDismissAdminSuggestion,
  handleGetAdminBuildStatus,
  handleGetAdminFlowers,
  handleGetAdminPhotoFile,
  handleGetAdminPhotos,
  handleGetAdminPlaces,
  handleGetAdminSuggestions,
  handleGetPhotoCovers,
  handleGetPhotoFile,
  handleGetPublicData,
  handleGetPublicPhotos,
  handleGetWeeklyPhotos,
  handleHvnTraLoi,
  handleHvnThongKe,
  handleHideAdminPhoto,
  handlePublicSubmit,
  handlePublicSubmitFlower,
  handlePublicSubmitPlace,
  handleRejectAdminFlower,
  handleRejectAdminPhoto,
  handleRejectAdminPlace,
  handleUpdateAdminFlower,
  handleUpdateAdminPlace,
  hasBuildTriggerConfig,
  hashIp,
  hideAdminPhoto,
  isCloudflareBuildEnv,
  isKnownFlowerSlug,
  isPhotoInPast7Days,
  isPhotoInPastDays,
  isSkipRemoteDataEnabled,
  isValidFlowerSlug,
  isValidGoogleMapsUrl,
  isValidImageMagicBytes,
  jsonResponse,
  listAdminPhotos,
  listApprovedCovers,
  listApprovedPhotos,
  loadCombinedData,
  MAX_PUBLIC_FILES,
  MAX_PUBLIC_FLOWER_SUBMISSIONS_PER_DAY,
  MAX_PUBLIC_PLACE_SUBMISSIONS_PER_DAY,
  MAX_PUBLIC_SUBMISSIONS_PER_DAY,
  MAX_UPLOAD_BYTES,
  mergeBySlug,
  mergeFlowers,
  mergePlaces,
  mergeRemoteData,
  normalizeTeamDomain,
  parseCoordsFromMapsUrl,
  parseImageDimensions,
  pickFlowerColor,
  PROVINCES_34,
  PROVINCE_TO_REGION,
  REGION_LABELS,
  rejectAdminPhoto,
  resolveMapsUrlAndExtractCoords,
  slugifyVietnamese,
  triggerBuildIfNeeded,
  triggerCloudflareBuild,
  TURNSTILE_DUMMY_PASS_SECRET,
  TURNSTILE_VERIFY_URL,
  VALID_FLOWER_SLUGS,
  VALID_PLACE_SLUGS,
  verifyAccessJwt,
  verifyBotToken,
  verifyTurnstileToken,
  type ApprovePhotoUpdates,
  type BuildTriggerResult,
  type CoverItem,
  type Env,
  type ExecutionContext,
  type ExtraRow,
  type FlowerExtraData,
  type FlowerSeason,
  type MonthDay,
  type PhotoItem,
  type PhotoRow,
  type PlaceExtraData,
  type RegionCode,
  type WeeklyPhotoCounts,
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

      // --- Quản trị loài hoa bổ sung (flowers_extra) ---
      if (
        (pathname === '/api/admin/flowers' ||
          pathname === '/api/admin/flowers/' ||
          pathname === '/api/admin/loai-hoa' ||
          pathname === '/api/admin/loai-hoa/') &&
        method === 'GET'
      ) {
        return handleGetAdminFlowers(request, env);
      }

      if (
        (pathname === '/api/admin/flowers' ||
          pathname === '/api/admin/flowers/' ||
          pathname === '/api/admin/loai-hoa' ||
          pathname === '/api/admin/loai-hoa/' ||
          pathname === '/api/admin/them-hoa') &&
        method === 'POST'
      ) {
        return handleCreateAdminFlower(request, env);
      }

      const approveFlowerMatch = pathname.match(
        /^\/api\/admin\/(?:flowers|loai-hoa)\/([^/]+)\/approve$/,
      );
      if (approveFlowerMatch && method === 'POST') {
        return handleApproveAdminFlower(
          request,
          env,
          decodeURIComponent(approveFlowerMatch[1]),
        );
      }

      const rejectFlowerMatch = pathname.match(
        /^\/api\/admin\/(?:flowers|loai-hoa)\/([^/]+)\/reject$/,
      );
      if (rejectFlowerMatch && method === 'POST') {
        return handleRejectAdminFlower(
          request,
          env,
          decodeURIComponent(rejectFlowerMatch[1]),
        );
      }

      const singleFlowerMatch = pathname.match(/^\/api\/admin\/(?:flowers|loai-hoa)\/([^/]+)$/);
      if (singleFlowerMatch) {
        const flowerSlug = decodeURIComponent(singleFlowerMatch[1]);
        if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
          return handleUpdateAdminFlower(request, env, flowerSlug);
        }
        if (method === 'DELETE') {
          return handleDeleteAdminFlower(request, env, flowerSlug);
        }
      }

      // --- Quản trị địa điểm bổ sung (places_extra) ---
      if (
        (pathname === '/api/admin/places' ||
          pathname === '/api/admin/places/' ||
          pathname === '/api/admin/dia-diem' ||
          pathname === '/api/admin/dia-diem/') &&
        method === 'GET'
      ) {
        return handleGetAdminPlaces(request, env);
      }

      if (
        (pathname === '/api/admin/places' ||
          pathname === '/api/admin/places/' ||
          pathname === '/api/admin/dia-diem' ||
          pathname === '/api/admin/dia-diem/' ||
          pathname === '/api/admin/them-dia-diem') &&
        method === 'POST'
      ) {
        return handleCreateAdminPlace(request, env);
      }

      const approvePlaceMatch = pathname.match(
        /^\/api\/admin\/(?:places|dia-diem)\/([^/]+)\/approve$/,
      );
      if (approvePlaceMatch && method === 'POST') {
        return handleApproveAdminPlace(
          request,
          env,
          decodeURIComponent(approvePlaceMatch[1]),
        );
      }

      const rejectPlaceMatch = pathname.match(
        /^\/api\/admin\/(?:places|dia-diem)\/([^/]+)\/reject$/,
      );
      if (rejectPlaceMatch && method === 'POST') {
        return handleRejectAdminPlace(
          request,
          env,
          decodeURIComponent(rejectPlaceMatch[1]),
        );
      }

      const singlePlaceMatch = pathname.match(/^\/api\/admin\/(?:places|dia-diem)\/([^/]+)$/);
      if (singlePlaceMatch) {
        const placeSlug = decodeURIComponent(singlePlaceMatch[1]);
        if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
          return handleUpdateAdminPlace(request, env, placeSlug);
        }
        if (method === 'DELETE') {
          return handleDeleteAdminPlace(request, env, placeSlug);
        }
      }

      // --- Kích hoạt build lại web ---
      if (
        (pathname === '/api/admin/build-status' || pathname === '/api/admin/build') &&
        method === 'GET'
      ) {
        return handleGetAdminBuildStatus(request, env);
      }

      if (
        (pathname === '/api/admin/build' ||
          pathname === '/api/admin/rebuild' ||
          pathname === '/api/admin/trigger-build') &&
        method === 'POST'
      ) {
        return handleAdminTriggerBuild(request, env);
      }

      // --- Quản trị đề xuất tự động (bước 33) ---
      if (
        (pathname === '/api/admin/de-xuat' || pathname === '/api/admin/de-xuat/') &&
        method === 'GET'
      ) {
        return handleGetAdminSuggestions(request, env);
      }

      const applySuggestionMatch = pathname.match(
        /^\/api\/admin\/de-xuat\/([^/]+)\/apply\/?$/,
      );
      if (applySuggestionMatch && method === 'POST') {
        return handleApplyAdminSuggestion(
          request,
          env,
          decodeURIComponent(applySuggestionMatch[1]),
        );
      }

      const dismissSuggestionMatch = pathname.match(
        /^\/api\/admin\/de-xuat\/([^/]+)\/dismiss\/?$/,
      );
      if (dismissSuggestionMatch && method === 'POST') {
        return handleDismissAdminSuggestion(
          request,
          env,
          decodeURIComponent(dismissSuggestionMatch[1]),
        );
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // 2b. API bot thu thập tự động (bước 33: KHÔNG qua Cloudflare Access, có Bearer + rate limit)
    if (pathname === '/api/bot' || pathname.startsWith('/api/bot/')) {
      const auth = await verifyBotToken(request, env);
      if (!auth.ok) {
        return jsonResponse({ error: auth.error }, auth.status ?? 401);
      }

      const rate = await checkAndRecordBotRateLimit(env);
      if (!rate.allowed) {
        return jsonResponse(
          { error: 'Quá giới hạn 10 request/giờ cho bot' },
          429,
        );
      }

      if (
        (pathname === '/api/bot/de-xuat' || pathname === '/api/bot/de-xuat/') &&
        method === 'POST'
      ) {
        return handleBotSubmitSuggestions(request, env);
      }

      if (
        (pathname === '/api/bot/tom-tat' || pathname === '/api/bot/tom-tat/') &&
        method === 'GET'
      ) {
        return handleBotGetSummary(request, env);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // 3. API công khai lấy dữ liệu loài hoa & địa điểm đã duyệt cho build kết hợp
    if ((pathname === '/api/du-lieu' || pathname === '/api/du-lieu/') && method === 'GET') {
      return handleGetPublicData(request, env);
    }

    // 4. API công khai khách gửi loài hoa mới
    if (
      (pathname === '/api/them-hoa' ||
        pathname === '/api/them-hoa/' ||
        pathname === '/api/flowers' ||
        pathname === '/api/loai-hoa') &&
      method === 'POST'
    ) {
      return handlePublicSubmitFlower(request, env);
    }

    // 5. API công khai khách gửi địa điểm mới
    if (
      (pathname === '/api/them-dia-diem' ||
        pathname === '/api/them-dia-diem/' ||
        pathname === '/api/places' ||
        pathname === '/api/dia-diem') &&
      method === 'POST'
    ) {
      return handlePublicSubmitPlace(request, env);
    }

    // 6. API công khai nhận ảnh người ngoài gửi
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

    // 5b. API công khai đếm ảnh trong 7 ngày gần nhất theo địa điểm và loài hoa (bước 32)
    if ((pathname === '/api/anh/tuan' || pathname === '/api/anh/tuan/') && method === 'GET') {
      return handleGetWeeklyPhotos(request, env);
    }

    // 6. API công khai phục vụ file ảnh approved (.webp và -600.webp)
    const fileMatch = pathname.match(/^\/api\/anh\/([a-zA-Z0-9_-]+?)(-600)?\.webp$/);
    if (fileMatch && method === 'GET') {
      const id = fileMatch[1];
      const is600 = Boolean(fileMatch[2]);
      return handleGetPhotoFile(request, env, id, is600);
    }

    // 7. API thống kê lượt chọn câu hỏi Hiểu Việt Nam
    if (
      (pathname === '/api/hvn/tra-loi' || pathname === '/api/hvn/tra-loi/') &&
      method === 'POST'
    ) {
      return handleHvnTraLoi(request, env);
    }

    if (
      (pathname === '/api/hvn/thong-ke' || pathname === '/api/hvn/thong-ke/') &&
      method === 'GET'
    ) {
      return handleHvnThongKe(request, env);
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
