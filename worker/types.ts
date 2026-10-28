export interface D1Meta {
  changes?: number;
  last_row_id?: number;
  duration?: number;
  rows_read?: number;
  rows_written?: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: D1Meta;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec?(query: string): Promise<unknown>;
  batch?<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata | Headers;
  customMetadata?: Record<string, string>;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions,
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  head?(key: string): Promise<R2Object | null>;
}

export interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export interface JwkKey extends JsonWebKey {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

export interface JwksResponse {
  keys: JwkKey[];
}

export interface Env {
  ASSETS?: Fetcher;
  DB?: D1Database;
  D1?: D1Database;
  BUCKET?: R2Bucket;
  R2?: R2Bucket;
  PHOTOS?: R2Bucket;
  ACCESS_TEAM?: string;
  ACCESS_AUD?: string;
  DEV_BYPASS_AUTH?: string;
  ACCESS_JWKS?: JwksResponse | string;
  JWKS_FETCH?: typeof fetch;
}

export type PhotoStatus = 'pending' | 'approved' | 'rejected';
export type PhotoSource = 'admin' | 'public';

export interface PhotoRow {
  id: string;
  flower: string;
  place: string | null;
  status: PhotoStatus;
  author: string;
  author_link: string | null;
  license: string;
  caption: string | null;
  taken_on: string | null;
  width: number | null;
  height: number | null;
  source: PhotoSource;
  created_at: string;
  reviewed_at: string | null;
  ip_hash?: string | null;
}

export interface PhotoItem {
  id: string;
  flower: string;
  place: string | null;
  status: PhotoStatus;
  author: string;
  author_link: string | null;
  license: string;
  caption: string | null;
  taken_on: string | null;
  width: number;
  height: number;
  source: PhotoSource;
  created_at: string;
  reviewed_at: string | null;
  src: string;
  src600: string;
}

export function getDb(env: Env): D1Database {
  const db = env.DB ?? env.D1;
  if (!db) {
    throw new Error('Missing D1 database binding (DB)');
  }
  return db;
}

export function getBucket(env: Env): R2Bucket {
  const bucket = env.BUCKET ?? env.R2 ?? env.PHOTOS;
  if (!bucket) {
    throw new Error('Missing R2 bucket binding (BUCKET)');
  }
  return bucket;
}

const initializedDbs = new WeakSet<object>();

export async function ensureSchema(db: D1Database): Promise<void> {
  if (!db || typeof db.prepare !== 'function' || initializedDbs.has(db)) return;
  initializedDbs.add(db);
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS photos (
          id TEXT PRIMARY KEY,
          flower TEXT NOT NULL,
          place TEXT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
          author TEXT NOT NULL,
          author_link TEXT NULL,
          license TEXT NOT NULL,
          caption TEXT NULL,
          taken_on TEXT NULL,
          width INT,
          height INT,
          source TEXT NOT NULL CHECK (source IN ('admin', 'public')),
          created_at TEXT NOT NULL,
          reviewed_at TEXT NULL,
          ip_hash TEXT NULL
        )`,
      )
      .run();
  } catch {
    // Bỏ qua nếu mock D1 trong unit test không hỗ trợ DDL
  }
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}
