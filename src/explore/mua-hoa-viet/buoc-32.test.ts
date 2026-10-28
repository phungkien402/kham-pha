// Test bước 32 (Bản đồ "đang nở" theo ảnh trong tuần) theo spec docs/buoc-28-32-mua-hoa.md mục 32.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateWeeklyPhotos,
  clearWeeklyPhotosCache,
  countRecentPhotos,
  countWeeklyPhotos,
  fetchWeeklyPhotos,
  formatWeeklyPhotoLabel,
  isPhotoInPast7Days,
  isPhotoInPastDays,
  parsePhotoTimestamp,
  tallyWeeklyPhotos,
} from './weeklyPhotos';
import * as fromPublicPhotos from './publicPhotos';

describe('xuất khẩu tương thích bước 32', () => {
  it('publicPhotos re-export đủ các hàm thuần và hàm fetch của bước 32', () => {
    expect(fromPublicPhotos.countWeeklyPhotos).toBe(countWeeklyPhotos);
    expect(fromPublicPhotos.tallyWeeklyPhotos).toBe(tallyWeeklyPhotos);
    expect(fromPublicPhotos.countRecentPhotos).toBe(countRecentPhotos);
    expect(fromPublicPhotos.isPhotoInPast7Days).toBe(isPhotoInPast7Days);
    expect(fromPublicPhotos.isPhotoInPastDays).toBe(isPhotoInPastDays);
    expect(fromPublicPhotos.formatWeeklyPhotoLabel).toBe(formatWeeklyPhotoLabel);
    expect(fromPublicPhotos.fetchWeeklyPhotos).toBe(fetchWeeklyPhotos);
    expect(fromPublicPhotos.clearWeeklyPhotosCache).toBe(clearWeeklyPhotosCache);
  });
});

describe('parsePhotoTimestamp', () => {
  it('phân tích đúng định dạng ISO, YYYY-MM-DD, DD/MM/YYYY', () => {
    const iso = '2026-10-28T10:00:00.000Z';
    expect(parsePhotoTimestamp(iso)).toBe(new Date(iso).getTime());

    const ymd = '2026-10-28';
    expect(parsePhotoTimestamp(ymd)).toBe(Date.UTC(2026, 9, 28));

    const dmy = '28/10/2026';
    expect(parsePhotoTimestamp(dmy)).toBe(Date.UTC(2026, 9, 28));

    const dmyDash = '28-10-2026';
    expect(parsePhotoTimestamp(dmyDash)).toBe(Date.UTC(2026, 9, 28));
  });

  it('nhận Date instance hoặc số timestamp', () => {
    const d = new Date(Date.UTC(2026, 9, 25));
    expect(parsePhotoTimestamp(d)).toBe(d.getTime());
    expect(parsePhotoTimestamp(1700000000000)).toBe(1700000000000);
  });

  it('chuỗi không hợp lệ hoặc rỗng trả về undefined', () => {
    expect(parsePhotoTimestamp(null)).toBeUndefined();
    expect(parsePhotoTimestamp(undefined)).toBeUndefined();
    expect(parsePhotoTimestamp('')).toBeUndefined();
    expect(parsePhotoTimestamp('   ')).toBeUndefined();
    expect(parsePhotoTimestamp('không phải ngày')).toBeUndefined();
    expect(parsePhotoTimestamp('31/02/2026')).toBeUndefined();
  });
});

describe('isPhotoInPast7Days / isPhotoInPastDays', () => {
  // Giả lập mốc thời gian kiểm thử: 28/10/2026 12:00:00 UTC
  const fixedNow = new Date('2026-10-28T12:00:00Z');

  it('ảnh có created_at trong 7 ngày gần nhất -> true', () => {
    // 2 ngày trước
    const p1 = {
      status: 'approved',
      created_at: '2026-10-26T10:00:00Z',
    };
    expect(isPhotoInPast7Days(p1, fixedNow)).toBe(true);

    // Đúng 7 ngày trước
    const p2 = {
      status: 'approved',
      created_at: '2026-10-21T12:00:00Z',
    };
    expect(isPhotoInPast7Days(p2, fixedNow)).toBe(true);
  });

  it('ảnh có taken_on trong 7 ngày gần nhất -> true', () => {
    // taken_on cách 3 ngày, created_at cũ hơn 7 ngày
    const p = {
      status: 'approved',
      taken_on: '2026-10-25',
      created_at: '2026-10-10T00:00:00Z',
    };
    expect(isPhotoInPast7Days(p, fixedNow)).toBe(true);
  });

  it('ảnh có created_at gần nhưng taken_on cũ hơn -> true', () => {
    const p = {
      status: 'approved',
      taken_on: '2025-10-25',
      created_at: '2026-10-27T08:00:00Z',
    };
    expect(isPhotoInPast7Days(p, fixedNow)).toBe(true);
  });

  it('cả created_at và taken_on đều cũ hơn 7 ngày -> false', () => {
    const p = {
      status: 'approved',
      taken_on: '2026-10-18',
      created_at: '2026-10-19T00:00:00Z',
    };
    expect(isPhotoInPast7Days(p, fixedNow)).toBe(false);
  });

  it('ảnh chưa approved (pending hoặc rejected) không bao giờ tính -> false', () => {
    const pending = {
      status: 'pending',
      created_at: '2026-10-28T10:00:00Z',
    };
    const rejected = {
      status: 'rejected',
      created_at: '2026-10-28T10:00:00Z',
    };
    expect(isPhotoInPast7Days(pending, fixedNow)).toBe(false);
    expect(isPhotoInPast7Days(rejected, fixedNow)).toBe(false);
  });

  it('không truyền status (dữ liệu đã lọc sẵn approved) vẫn tính hợp lệ -> true', () => {
    const p = {
      created_at: '2026-10-27T00:00:00Z',
    };
    expect(isPhotoInPast7Days(p, fixedNow)).toBe(true);
  });

  it('hỗ trợ camelCase: createdAt và takenOn', () => {
    const p1 = { status: 'approved', createdAt: '2026-10-27T00:00:00Z' };
    const p2 = { status: 'approved', takenOn: '25/10/2026' };
    expect(isPhotoInPast7Days(p1, fixedNow)).toBe(true);
    expect(isPhotoInPast7Days(p2, fixedNow)).toBe(true);
  });

  it('dữ liệu rỗng hoặc không hợp lệ -> false', () => {
    expect(isPhotoInPast7Days(null, fixedNow)).toBe(false);
    expect(isPhotoInPast7Days(undefined, fixedNow)).toBe(false);
    expect(isPhotoInPast7Days({}, fixedNow)).toBe(false);
    expect(isPhotoInPast7Days({ status: 'approved' }, fixedNow)).toBe(false);
  });

  it('hỗ trợ tuỳ chỉnh tham số days', () => {
    // Cách 5 ngày: nếu window là 3 ngày -> false, nếu window là 7 ngày -> true
    const p = { status: 'approved', created_at: '2026-10-23T12:00:00Z' };
    expect(isPhotoInPastDays(p, fixedNow, 3)).toBe(false);
    expect(isPhotoInPastDays(p, fixedNow, 7)).toBe(true);
  });
});

describe('countWeeklyPhotos / tallyWeeklyPhotos', () => {
  const fixedNow = new Date('2026-10-28T12:00:00Z');

  it('đếm đúng số lượng ảnh trong tuần theo từng địa điểm và từng loài hoa', () => {
    const photos = [
      // Ba Vì, dã quỳ, approved, 2 ngày trước
      {
        id: '1',
        flower: 'da-quy',
        place: 'ba-vi',
        status: 'approved',
        created_at: '2026-10-26T10:00:00Z',
      },
      // Ba Vì, dã quỳ, approved, 1 ngày trước
      {
        id: '2',
        flower: 'da-quy',
        place: 'ba-vi',
        status: 'approved',
        taken_on: '2026-10-27',
        created_at: '2026-10-27T05:00:00Z',
      },
      // Đà Lạt, dã quỳ, approved, 3 ngày trước
      {
        id: '3',
        flower: 'da-quy',
        place: 'da-lat',
        status: 'approved',
        created_at: '2026-10-25T14:00:00Z',
      },
      // Hà Giang, tam giác mạch, approved, 4 ngày trước
      {
        id: '4',
        flower: 'tam-giac-mach',
        place: 'ha-giang',
        status: 'approved',
        created_at: '2026-10-24T09:00:00Z',
      },
      // Không có place (chỉ có loài dã quỳ)
      {
        id: '5',
        flower: 'da-quy',
        place: null,
        status: 'approved',
        created_at: '2026-10-28T01:00:00Z',
      },
      // Ảnh cũ hơn 7 ngày (10 ngày trước) -> không đếm
      {
        id: '6',
        flower: 'da-quy',
        place: 'ba-vi',
        status: 'approved',
        created_at: '2026-10-15T00:00:00Z',
      },
      // Ảnh pending -> không đếm
      {
        id: '7',
        flower: 'da-quy',
        place: 'ba-vi',
        status: 'pending',
        created_at: '2026-10-28T00:00:00Z',
      },
      // Ảnh rejected -> không đếm
      {
        id: '8',
        flower: 'hoa-ban',
        place: 'moc-chau',
        status: 'rejected',
        created_at: '2026-10-28T00:00:00Z',
      },
    ];

    const result = countWeeklyPhotos(photos, fixedNow);

    expect(result.flowers).toEqual({
      'da-quy': 4, // id 1, 2, 3, 5
      'tam-giac-mach': 1, // id 4
    });

    expect(result.places).toEqual({
      'ba-vi': 2, // id 1, 2
      'da-lat': 1, // id 3
      'ha-giang': 1, // id 4
    });

    // Các bí danh hoạt động y hệt
    expect(tallyWeeklyPhotos(photos, fixedNow)).toEqual(result);
    expect(countRecentPhotos(photos, fixedNow)).toEqual(result);
    expect(calculateWeeklyPhotos(photos, fixedNow)).toEqual(result);
  });

  it('mảng rỗng hoặc dữ liệu rỗng trả về { places: {}, flowers: {} }', () => {
    expect(countWeeklyPhotos([])).toEqual({ places: {}, flowers: {} });
    expect(countWeeklyPhotos(null)).toEqual({ places: {}, flowers: {} });
    expect(countWeeklyPhotos(undefined)).toEqual({ places: {}, flowers: {} });
  });
});

describe('formatWeeklyPhotoLabel', () => {
  it('định dạng "n ảnh tuần này"', () => {
    expect(formatWeeklyPhotoLabel(1)).toBe('1 ảnh tuần này');
    expect(formatWeeklyPhotoLabel(5)).toBe('5 ảnh tuần này');
    expect(formatWeeklyPhotoLabel(12)).toBe('12 ảnh tuần này');
  });

  it('0 hoặc số âm trả về chuỗi rỗng', () => {
    expect(formatWeeklyPhotoLabel(0)).toBe('');
    expect(formatWeeklyPhotoLabel(-3)).toBe('');
  });
});

describe('fetchWeeklyPhotos', () => {
  beforeEach(() => {
    clearWeeklyPhotosCache();
  });

  afterEach(() => {
    clearWeeklyPhotosCache();
    vi.restoreAllMocks();
  });

  it('gọi GET /api/anh/tuan và trả về kết quả đúng', async () => {
    const mockData = {
      places: { 'ba-vi': 3, 'da-lat': 1 },
      flowers: { 'da-quy': 4 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const res = await fetchWeeklyPhotos(mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledWith('/api/anh/tuan');
    expect(res).toEqual(mockData);
  });

  it('dùng chung một Promise (chỉ gọi mạng đúng 1 lần khi gọi nhiều lần)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ places: { 'ba-vi': 2 }, flowers: { 'da-quy': 2 } }),
    });

    const [r1, r2, r3] = await Promise.all([
      fetchWeeklyPhotos(mockFetch as unknown as typeof fetch),
      fetchWeeklyPhotos(mockFetch as unknown as typeof fetch),
      fetchWeeklyPhotos(mockFetch as unknown as typeof fetch),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({ places: { 'ba-vi': 2 }, flowers: { 'da-quy': 2 } });
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
  });

  it('clearWeeklyPhotosCache cho phép gọi lại ở lần tiếp theo', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ places: { 'ba-vi': 1 }, flowers: {} }),
    });

    await fetchWeeklyPhotos(mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    clearWeeklyPhotosCache();

    await fetchWeeklyPhotos(mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('lỗi mạng hoặc HTTP error trả về { places: {}, flowers: {} } mà không ném exception', async () => {
    const failFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const res = await fetchWeeklyPhotos(failFetch as unknown as typeof fetch);
    expect(res).toEqual({ places: {}, flowers: {} });

    clearWeeklyPhotosCache();

    const httpErrFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const res2 = await fetchWeeklyPhotos(httpErrFetch as unknown as typeof fetch);
    expect(res2).toEqual({ places: {}, flowers: {} });
  });
});
