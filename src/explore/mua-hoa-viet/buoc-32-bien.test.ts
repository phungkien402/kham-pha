// Ca biên bước 32: mùa vắt qua năm, ngày 29/2, giá trị rác, dữ liệu rỗng (spec docs/buoc-28-32-mua-hoa.md mục 32).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWeeklyPhotosCache,
  countWeeklyPhotos,
  fetchWeeklyPhotos,
  isPhotoInPast7Days,
  parsePhotoTimestamp,
} from './weeklyPhotos';

describe('vắt qua năm (T12 → T1)', () => {
  const now = new Date('2027-01-03T12:00:00Z');

  it('ảnh cuối tháng 12 năm trước còn trong 7 ngày', () => {
    expect(isPhotoInPast7Days({ status: 'approved', created_at: '2026-12-28T12:00:00Z' }, now)).toBe(true);
    expect(isPhotoInPast7Days({ status: 'approved', taken_on: '2026-12-31' }, now)).toBe(true);
  });

  it('ảnh quá 7 ngày qua ranh giới năm bị loại', () => {
    expect(isPhotoInPast7Days({ status: 'approved', created_at: '2026-12-26T11:00:00Z' }, now)).toBe(false);
  });

  it('đếm gộp ảnh của hai năm khác nhau', () => {
    const photos = [
      { flower: 'dao', place: 'moc-chau', status: 'approved', created_at: '2026-12-30T00:00:00Z' },
      { flower: 'dao', place: 'moc-chau', status: 'approved', created_at: '2027-01-02T00:00:00Z' },
    ];
    expect(countWeeklyPhotos(photos, now)).toEqual({ places: { 'moc-chau': 2 }, flowers: { dao: 2 } });
  });
});

describe('ngày 29/2', () => {
  it('năm nhuận có 29/2, năm thường thì không', () => {
    expect(parsePhotoTimestamp('2028-02-29')).toBe(Date.UTC(2028, 1, 29));
    expect(parsePhotoTimestamp('29/02/2028')).toBe(Date.UTC(2028, 1, 29));
    expect(parsePhotoTimestamp('2027-02-29')).toBeUndefined();
    expect(parsePhotoTimestamp('29/02/2027')).toBeUndefined();
    expect(parsePhotoTimestamp('2100-02-29')).toBeUndefined();
  });

  it('ảnh chụp 29/2 vẫn tính trong tuần khi hôm nay là 3/3 năm nhuận', () => {
    const now = new Date('2028-03-03T12:00:00Z');
    expect(isPhotoInPast7Days({ status: 'approved', taken_on: '2028-02-29' }, now)).toBe(true);
  });

  it('taken_on 29/2 năm thường không hợp lệ nên không tính', () => {
    const now = new Date('2027-03-02T12:00:00Z');
    expect(isPhotoInPast7Days({ status: 'approved', taken_on: '2027-02-29' }, now)).toBe(false);
  });
});

describe('giá trị rác', () => {
  const now = new Date('2026-10-28T12:00:00Z');

  it('countWeeklyPhotos bỏ qua phần tử rác trong mảng, không ném lỗi', () => {
    const photos: any[] = [
      null,
      undefined,
      42,
      'abc',
      [],
      { status: 'approved', created_at: 'abc', flower: 'x', place: 'y' },
      { status: 'approved', created_at: NaN, flower: 'x' },
      { status: 'approved', created_at: '2026-10-27T00:00:00Z', flower: 123, place: {} },
      { status: 'approved', created_at: '2026-10-27T00:00:00Z', flower: '   ', place: '' },
      { status: 'approved', created_at: '2026-10-27T00:00:00Z', flower: 'hop', place: 'p1' },
    ];
    expect(countWeeklyPhotos(photos, now)).toEqual({ places: { p1: 1 }, flowers: { hop: 1 } });
  });

  it('không phải mảng -> rỗng', () => {
    expect(countWeeklyPhotos({} as any, now)).toEqual({ places: {}, flowers: {} });
    expect(countWeeklyPhotos('x' as any, now)).toEqual({ places: {}, flowers: {} });
  });

  it('now không hợp lệ -> không ảnh nào được tính', () => {
    const p = { status: 'approved', created_at: '2026-10-27T00:00:00Z' };
    expect(isPhotoInPast7Days(p, 'không phải ngày')).toBe(false);
    expect(isPhotoInPast7Days(p, NaN)).toBe(false);
    expect(isPhotoInPast7Days(p, new Date(NaN))).toBe(false);
  });

  it('ảnh có ngày ở tương lai xa không được tính', () => {
    expect(isPhotoInPast7Days({ status: 'approved', created_at: '2026-11-15T00:00:00Z' }, now)).toBe(false);
  });

  it('days = 0 hoặc âm không làm hỏng', () => {
    const p = { status: 'approved', created_at: '2026-10-27T00:00:00Z' };
    expect(() => countWeeklyPhotos([p], now, -5)).not.toThrow();
    expect(countWeeklyPhotos([p], now, 0)).toEqual({ places: {}, flowers: {} });
  });

  it('created_at dạng SQLite "YYYY-MM-DD HH:MM:SS" vẫn đọc được', () => {
    expect(isPhotoInPast7Days({ status: 'approved', created_at: '2026-10-27 08:30:00' }, now)).toBe(true);
  });

  it('parsePhotoTimestamp từ chối kiểu lạ', () => {
    expect(parsePhotoTimestamp({} as any)).toBeUndefined();
    expect(parsePhotoTimestamp([] as any)).toBeUndefined();
    expect(parsePhotoTimestamp(true as any)).toBeUndefined();
    expect(parsePhotoTimestamp(NaN)).toBeUndefined();
    expect(parsePhotoTimestamp(new Date('x'))).toBeUndefined();
    expect(parsePhotoTimestamp('2026-13-01')).toBeUndefined();
    expect(parsePhotoTimestamp('2026-00-10')).toBeUndefined();
  });
});

describe('fetchWeeklyPhotos với dữ liệu rác', () => {
  beforeEach(() => clearWeeklyPhotosCache());
  afterEach(() => {
    clearWeeklyPhotosCache();
    vi.restoreAllMocks();
  });

  const ok = (body: unknown, type = 'application/json') =>
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': type }),
      json: async () => body,
    }) as unknown as typeof fetch;

  it('chỉ giữ số dương hợp lệ, bỏ giá trị rác', async () => {
    const res = await fetchWeeklyPhotos(
      ok({ places: { a: 'x', b: -1, c: '3', d: 0, e: 2 }, flowers: { f: null, g: 5 } }),
    );
    expect(res.places).toEqual({ c: 3, e: 2 });
    expect(res.flowers).toEqual({ g: 5 });
  });

  it('thiếu places/flowers hoặc sai kiểu -> rỗng', async () => {
    expect(await fetchWeeklyPhotos(ok({}))).toEqual({ places: {}, flowers: {} });
    clearWeeklyPhotosCache();
    expect(await fetchWeeklyPhotos(ok({ places: 'x', flowers: 5 }))).toEqual({ places: {}, flowers: {} });
    clearWeeklyPhotosCache();
    expect(await fetchWeeklyPhotos(ok(null))).toEqual({ places: {}, flowers: {} });
  });

  it('content-type không phải JSON -> rỗng', async () => {
    expect(await fetchWeeklyPhotos(ok({ places: { a: 1 }, flowers: {} }, 'text/html'))).toEqual({
      places: {},
      flowers: {},
    });
  });

  it('JSON hỏng (json() ném lỗi) -> rỗng, không ném', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        throw new SyntaxError('bad');
      },
    }) as unknown as typeof fetch;
    expect(await fetchWeeklyPhotos(f)).toEqual({ places: {}, flowers: {} });
  });
});
