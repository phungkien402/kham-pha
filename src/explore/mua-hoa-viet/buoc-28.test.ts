// Test bước 28 ("Hôm nay đi đâu?") theo spec docs/buoc-28-32-mua-hoa.md mục 28.
import { describe, expect, it } from 'vitest';
import { formatDistanceKm, haversineKm, nearestBlooming } from './nearest';
import * as seasonMod from './season';
import { PROVINCES_34, PROVINCE_COORDS, getProvinceCoords } from './provinces';

// 12:00 trưa giờ VN
const vn = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 5));

// Hoa mùa vắt qua năm: 15/11 → 15/01, đỉnh 15/12
const tet = {
  slug: 'hoa-tet',
  name: 'Hoa Tết',
  color: '#ff0000',
  seasons: [{ start: { month: 11, day: 15 }, peak: { month: 12, day: 15 }, end: { month: 1, day: 15 } }],
};
// Hoa mùa xuân: tháng 3–4
const xuan = {
  slug: 'hoa-xuan',
  name: 'Hoa Xuân',
  color: '#00ff00',
  seasons: [{ start: { month: 3 }, end: { month: 4 } }],
};
const places = [
  { slug: 'xa', name: 'Điểm xa', province: 'Cà Mau', lat: 9.18, lng: 105.15, flowers: ['hoa-tet'] },
  { slug: 'gan', name: 'Điểm gần', province: 'Hà Nội', lat: 21.03, lng: 105.85, flowers: [{ slug: 'hoa-tet' }] },
  { slug: 'giua', name: 'Điểm giữa', province: 'Huế', lat: 16.46, lng: 107.59, flowers: ['hoa-tet'] },
  { slug: 'xuan', name: 'Điểm xuân', province: 'Hà Nội', lat: 21.04, lng: 105.86, flowers: ['hoa-xuan'] },
  { slug: 'trong', name: 'Điểm trống', province: 'Hà Nội', lat: 21.05, lng: 105.87, flowers: [] },
];
const HN = PROVINCE_COORDS['Hà Nội'];

describe('haversineKm / formatDistanceKm', () => {
  it('cùng điểm = 0, đối xứng', () => {
    expect(haversineKm(21, 105, 21, 105)).toBe(0);
    expect(haversineKm(21.03, 105.85, 10.78, 106.7)).toBeCloseTo(haversineKm(10.78, 106.7, 21.03, 105.85), 6);
  });
  it('Hà Nội – TP.HCM khoảng 1.1xx km', () => {
    const d = haversineKm(HN.lat, HN.lng, 10.7769, 106.7009);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1200);
  });
  it('1 độ vĩ tuyến ≈ 111 km', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });
  it('hai điểm đối cực không trả NaN', () => {
    const d = haversineKm(0, 0, 0, 180);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(Math.PI * 6371, 0);
  });
  it('formatDistanceKm làm tròn "~120 km"', () => {
    expect(formatDistanceKm(120.4)).toBe('~120 km');
    expect(formatDistanceKm(119.6)).toBe('~120 km');
    expect(formatDistanceKm(0)).toBe('~0 km');
  });
});

describe('nearestBlooming', () => {
  const today = vn(2026, 12, 20);

  it('sắp theo khoảng cách tăng dần, chỉ điểm có hoa đang nở', () => {
    const r = nearestBlooming(places, [tet, xuan], HN.lat, HN.lng, today);
    expect(r.map((x) => x.slug)).toEqual(['gan', 'giua', 'xa']);
    expect(r[0].distanceKm).toBeLessThan(r[1].distanceKm);
    expect(r[1].distanceKm).toBeLessThan(r[2].distanceKm);
  });
  it('mặc định tối đa 3, n tuỳ chỉnh', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      slug: `p${i}`, name: `P${i}`, province: 'X', lat: 21 + i * 0.1, lng: 105, flowers: ['hoa-tet'],
    }));
    expect(nearestBlooming(many, [tet], 21, 105, today)).toHaveLength(3);
    expect(nearestBlooming(many, [tet], 21, 105, today, 5)).toHaveLength(5);
    expect(nearestBlooming(many, [tet], 21, 105, today, 1)).toHaveLength(1);
  });
  it('trường kết quả: tên, tỉnh, nhãn "~N km", maps_url, loài kèm màu', () => {
    const p = [{ ...places[1], maps_url: 'https://maps.google.com/?q=1' }];
    const [r] = nearestBlooming(p, [tet], HN.lat, HN.lng, today);
    expect(r.name).toBe('Điểm gần');
    expect(r.province).toBe('Hà Nội');
    expect(r.maps_url).toBe('https://maps.google.com/?q=1');
    expect(r.distanceLabel).toMatch(/^~\d+ km$/);
    expect(r.distanceLabel).toBe(formatDistanceKm(r.rawDistanceKm));
    expect(r.flowers[0]).toMatchObject({ slug: 'hoa-tet', color: '#ff0000', status: 'dinh-mua' });
  });
  it('mùa vắt qua năm: T12 và T1 đều nở, T6 thì không', () => {
    const f = (d: Date) => nearestBlooming(places, [tet], HN.lat, HN.lng, d).length;
    expect(f(vn(2026, 12, 31))).toBe(3);
    expect(f(vn(2027, 1, 10))).toBe(3);
    expect(f(vn(2027, 6, 15))).toBe(0);
  });
  it('trạng thái sắp tàn / sắp nở: sắp tàn tính, sắp nở thì không', () => {
    // 5/1: còn 10 ngày tới 15/1 → sắp tàn
    const tan = nearestBlooming(places, [tet], HN.lat, HN.lng, vn(2027, 1, 5));
    expect(tan[0].flowers[0].status).toBe('sap-tan');
    // 5/11: 10 ngày nữa mới nở → sap-no, không được tính
    expect(nearestBlooming(places, [tet], HN.lat, HN.lng, vn(2026, 11, 5))).toEqual([]);
  });
  it('ngày 29/2 năm nhuận: hoa nở hết tháng 2 vẫn tính; không crash', () => {
    const f = { slug: 'hoa-t2', name: 'T2', seasons: [{ start: { month: 2 }, end: { month: 2 } }] };
    const p = [{ slug: 'a', name: 'A', province: 'X', lat: 21, lng: 105, flowers: ['hoa-t2'] }];
    expect(nearestBlooming(p, [f], 21, 105, vn(2028, 2, 29))).toHaveLength(1);
    expect(nearestBlooming(p, [f], 21, 105, vn(2027, 2, 28))).toHaveLength(1);
    expect(nearestBlooming(p, [f], 21, 105, vn(2028, 3, 1))).toEqual([]);
  });
  it('ngày không tồn tại 29/2/2027 (chuỗi) → mảng rỗng, không ném lỗi', () => {
    expect(nearestBlooming(places, [tet], HN.lat, HN.lng, '2027-02-29')).toEqual([]);
  });
  it('date dạng {year,month,day} và chuỗi ISO cho cùng kết quả với Date', () => {
    const a = nearestBlooming(places, [tet], HN.lat, HN.lng, today).map((x) => x.slug);
    const b = nearestBlooming(places, [tet], HN.lat, HN.lng, { year: 2026, month: 12, day: 20 }).map((x) => x.slug);
    const c = nearestBlooming(places, [tet], HN.lat, HN.lng, '2026-12-20T05:00:00Z').map((x) => x.slug);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
  it('liên kết chiều ngược: flower.places chứa slug điểm', () => {
    const f = { ...tet, places: [{ slug: 'trong' }, 'xa'] };
    const r = nearestBlooming([places[4], places[0]], [f], HN.lat, HN.lng, today);
    expect(r.map((x) => x.slug)).toEqual(['trong', 'xa']);
  });
  it('không trùng loài khi liên kết cả hai chiều', () => {
    const f = { ...tet, places: ['gan'] };
    const [r] = nearestBlooming([places[1]], [f], HN.lat, HN.lng, today);
    expect(r.flowers).toHaveLength(1);
  });
  it('nhận dữ liệu thô `season` thay cho `seasons`', () => {
    const raw = { slug: 'hoa-tet', name: 'Hoa Tết', season: tet.seasons[0] };
    expect(nearestBlooming(places, [raw], HN.lat, HN.lng, today).length).toBe(3);
  });
  it('hai điểm cùng khoảng cách giữ thứ tự ban đầu (ổn định)', () => {
    const a = { slug: 'a', name: 'A', province: 'X', lat: 20, lng: 105, flowers: ['hoa-tet'] };
    const b = { ...a, slug: 'b', name: 'B' };
    expect(nearestBlooming([a, b], [tet], 21, 105, today).map((x) => x.slug)).toEqual(['a', 'b']);
  });

  describe('dữ liệu rỗng / rác', () => {
    it('places rỗng, flowers rỗng', () => {
      expect(nearestBlooming([], [tet], 21, 105, today)).toEqual([]);
      expect(nearestBlooming(places, [], 21, 105, today)).toEqual([]);
    });
    it('không có hoa nào đang nở', () => {
      expect(nearestBlooming(places, [xuan], 21, 105, today)).toEqual([]);
    });
    it('hoa không có mùa, hoa null, điểm thiếu toạ độ / toạ độ NaN bị bỏ qua', () => {
      const junk = [
        { slug: 'x', name: 'x', province: 'x', flowers: ['hoa-tet'] },
        { slug: 'y', name: 'y', province: 'y', lat: NaN, lng: 105, flowers: ['hoa-tet'] },
        { slug: 'z', name: 'z', province: 'z', lat: null, lng: null, flowers: ['hoa-tet'] },
        null as any,
        places[1],
      ];
      const fl = [null as any, { slug: 'khong-mua' } as any, { slug: 5 } as any, tet];
      const r = nearestBlooming(junk as any, fl, 21, 105, today);
      expect(r.map((x) => x.slug)).toEqual(['gan']);
    });
    it('vị trí rác (NaN, Infinity, ngoài phạm vi, chuỗi) → rỗng', () => {
      for (const [la, ln] of [[NaN, 105], [21, Infinity], [91, 105], [21, 181], ['21' as any, 105]]) {
        expect(nearestBlooming(places, [tet], la as number, ln as number, today)).toEqual([]);
      }
    });
    it('n = 0, âm, NaN → rỗng', () => {
      for (const n of [0, -1, NaN]) expect(nearestBlooming(places, [tet], 21, 105, today, n)).toEqual([]);
    });
    it('places / flowers không phải mảng → rỗng', () => {
      expect(nearestBlooming(null as any, [tet], 21, 105, today)).toEqual([]);
      expect(nearestBlooming(places, undefined as any, 21, 105, today)).toEqual([]);
    });
    it('date rác → rỗng, không ném lỗi', () => {
      expect(nearestBlooming(places, [tet], 21, 105, new Date('abc'))).toEqual([]);
      expect(nearestBlooming(places, [tet], 21, 105, {} as any)).toEqual([]);
    });
    it('điểm tại đúng vị trí người dùng → ~0 km', () => {
      const [r] = nearestBlooming([places[1]], [tet], 21.03, 105.85, today);
      expect(r.distanceKm).toBe(0);
      expect(r.distanceLabel).toBe('~0 km');
    });
  });

  it('season.ts re-export các hàm', () => {
    expect((seasonMod as any).nearestBlooming).toBe(nearestBlooming);
    expect((seasonMod as any).haversineKm).toBe(haversineKm);
    expect((seasonMod as any).formatDistanceKm).toBe(formatDistanceKm);
  });
});

describe('toạ độ 34 tỉnh', () => {
  it('đủ 34 tỉnh, mỗi tỉnh có toạ độ trong lãnh thổ Việt Nam', () => {
    expect(PROVINCES_34).toHaveLength(34);
    expect(Object.keys(PROVINCE_COORDS)).toHaveLength(34);
    for (const p of PROVINCES_34) {
      expect(p.lat, p.name).toBeGreaterThan(8);
      expect(p.lat, p.name).toBeLessThan(24);
      expect(p.lng, p.name).toBeGreaterThan(102);
      expect(p.lng, p.name).toBeLessThan(110);
    }
  });
  it('getProvinceCoords: tên đúng, có khoảng trắng thừa, rác', () => {
    expect(getProvinceCoords('Hà Nội')).toEqual(HN);
    expect(getProvinceCoords('  Hà Nội ')).toEqual(HN);
    expect(getProvinceCoords('')).toBeUndefined();
    expect(getProvinceCoords(null)).toBeUndefined();
    expect(getProvinceCoords(undefined)).toBeUndefined();
    expect(getProvinceCoords('Atlantis')).toBeUndefined();
  });
  it('tỉnh Bắc gần Hà Nội hơn tỉnh Nam (kiểm tra thứ tự dùng toạ độ tỉnh)', () => {
    const r = nearestBlooming(places, [tet], HN.lat, HN.lng, vn(2026, 12, 20));
    expect(r[0].province).toBe('Hà Nội');
    expect(r[r.length - 1].province).toBe('Cà Mau');
  });
});
