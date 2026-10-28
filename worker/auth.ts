import type { Env, JwkKey, JwksResponse } from './types';

export interface VerifyAccessOptions {
  fetcher?: typeof fetch;
  jwks?: JwksResponse;
  now?: number;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtPayload {
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  email?: string;
  sub?: string;
  [key: string]: unknown;
}

const jwksCache = new Map<string, { expiresAt: number; jwks: JwksResponse }>();
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

export function clearJwksCache(): void {
  jwksCache.clear();
}

export function normalizeTeamDomain(team: string): string {
  let clean = team.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!clean) return '';
  if (!clean.includes('.')) {
    clean = `${clean}.cloudflareaccess.com`;
  }
  return clean.toLowerCase();
}

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64UrlJson<T>(b64url: string): T {
  const bytes = base64UrlToUint8Array(b64url);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

async function getJwks(
  teamDomain: string,
  env: Env,
  options?: VerifyAccessOptions,
): Promise<JwksResponse | null> {
  if (options?.jwks) {
    return options.jwks;
  }
  if (env.ACCESS_JWKS) {
    if (typeof env.ACCESS_JWKS === 'string') {
      return JSON.parse(env.ACCESS_JWKS) as JwksResponse;
    }
    return env.ACCESS_JWKS;
  }
  if (!teamDomain) return null;

  const customFetcher = options?.fetcher ?? env.JWKS_FETCH;
  if (!customFetcher) {
    const cached = jwksCache.get(teamDomain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.jwks;
    }
  }

  const fetcher = customFetcher ?? fetch;
  const certsUrl = `https://${teamDomain}/cdn-cgi/access/certs`;
  const res = await fetcher(certsUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as JwksResponse;
  if (!data || !Array.isArray(data.keys)) return null;

  if (!customFetcher) {
    jwksCache.set(teamDomain, {
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
      jwks: data,
    });
  }
  return data;
}

function extractToken(requestOrToken: Request | string | null | undefined): string | null {
  if (!requestOrToken) return null;
  if (typeof requestOrToken === 'string') {
    const t = requestOrToken.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof (requestOrToken as Request).headers?.get === 'function') {
    const headerVal =
      requestOrToken.headers.get('Cf-Access-Jwt-Assertion') ??
      requestOrToken.headers.get('cf-access-jwt-assertion');
    const t = headerVal?.trim();
    return t && t.length > 0 ? t : null;
  }
  return null;
}

/**
 * Kiểm tra Cloudflare Access JWT từ header `Cf-Access-Jwt-Assertion` hoặc chuỗi token.
 * Trả về `true` nếu hợp lệ (hoặc khi bật `DEV_BYPASS_AUTH=1`), `false` nếu thiếu hoặc không hợp lệ.
 */
export async function verifyAccessJwt(
  requestOrToken: Request | string | null | undefined,
  env: Env = {},
  options?: VerifyAccessOptions,
): Promise<boolean> {
  try {
    if (env?.DEV_BYPASS_AUTH === '1' || env?.DEV_BYPASS_AUTH === 'true') {
      return true;
    }

    const token = extractToken(requestOrToken);
    if (!token) return false;

    const aud = env?.ACCESS_AUD?.trim();
    if (!aud) return false;

    const teamDomain = env?.ACCESS_TEAM ? normalizeTeamDomain(env.ACCESS_TEAM) : '';
    if (!teamDomain && !options?.jwks && !env?.ACCESS_JWKS) {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeBase64UrlJson<JwtHeader>(headerB64);
    const payload = decodeBase64UrlJson<JwtPayload>(payloadB64);

    if (!header || header.alg !== 'RS256') {
      return false;
    }

    // Kiểm tra audience (aud)
    const tokenAud = payload.aud;
    const audMatches = Array.isArray(tokenAud)
      ? tokenAud.includes(aud)
      : tokenAud === aud;
    if (!audMatches) {
      return false;
    }

    // Kiểm tra thời hạn (exp, nbf)
    const now = options?.now ?? Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) {
      return false;
    }
    if (typeof payload.nbf === 'number' && payload.nbf > now) {
      return false;
    }

    // Kiểm tra issuer (iss) nếu có cả teamDomain và payload.iss
    if (teamDomain && typeof payload.iss === 'string' && payload.iss.length > 0) {
      const normalizedIss = payload.iss.replace(/\/+$/, '').toLowerCase();
      if (normalizedIss !== `https://${teamDomain}`) {
        return false;
      }
    }

    const jwks = await getJwks(teamDomain, env, options);
    if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      return false;
    }

    const candidates: JwkKey[] = jwks.keys.filter((k) => {
      if (k.kty !== 'RSA' || !k.n || !k.e) return false;
      if (header.kid && k.kid && k.kid !== header.kid) return false;
      return true;
    });

    if (candidates.length === 0) {
      return false;
    }

    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlToUint8Array(signatureB64);

    for (const jwk of candidates) {
      try {
        const cryptoKey = await crypto.subtle.importKey(
          'jwk',
          {
            kty: 'RSA',
            n: jwk.n,
            e: jwk.e,
            alg: 'RS256',
            ext: true,
          },
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
          },
          false,
          ['verify'],
        );

        const valid = await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          cryptoKey,
          signatureBytes as BufferSource,
          signedData,
        );
        if (valid) {
          return true;
        }
      } catch {
        // Thử key tiếp theo nếu key hiện tại lỗi
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * So sánh 2 chuỗi theo thời gian hằng (constant-time) qua SHA-256 digest để tránh timing attack.
 */
export async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const viewA = new Uint8Array(digestA);
  const viewB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}

/**
 * Xác thực Authorization: Bearer <BOT_TOKEN> cho các route bot (/api/bot/*).
 * - Chưa đặt secret BOT_TOKEN → 503
 * - Thiếu/sai Bearer token → 401
 */
export async function verifyBotToken(
  request: Request,
  env: Env = {},
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const configuredToken = env.BOT_TOKEN;
  if (!configuredToken || typeof configuredToken !== 'string' || !configuredToken.trim()) {
    return { ok: false, status: 503, error: 'Chưa đặt secret BOT_TOKEN' };
  }

  const authHeader =
    request.headers.get('Authorization') ??
    request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Thiếu hoặc sai định dạng Authorization Bearer' };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Bearer token rỗng' };
  }

  const valid = await constantTimeCompare(token, configuredToken.trim());
  if (!valid) {
    return { ok: false, status: 401, error: 'Bearer token không đúng' };
  }

  return { ok: true };
}
