import { describe, it, expect } from 'vitest';
import {
  haversine,
  calculateCumulativeDistances,
  positionAt,
  nearestStop,
  regionAt,
  milestonesCrossed,
  STOPS,
  TOTAL_ROUTE_KM,
  STRAIGHT_LINE_KM,
  MILESTONES,
  getJourneyProvinces,
} from './docVietNam';

describe('Bước E: Tính toán địa lý và tuyến hành trình dọc Việt Nam (docVietNam.ts)', () => {
  it('haversine tính đúng khoảng cách Hà Nội – TP.HCM ≈ 1.140 km ± 20 km', () => {
    const hanoi = STOPS.find((s) => s.name === 'Hà Nội')!;
    const tphcm = STOPS.find((s) => s.name === 'TP. Hồ Chí Minh')!;
    expect(hanoi).toBeDefined();
    expect(tphcm).toBeDefined();

    const d = haversine(hanoi.lat, hanoi.lng, tphcm.lat, tphcm.lng);
    expect(d).toBeGreaterThanOrEqual(1120);
    expect(d).toBeLessThanOrEqual(1160);
  });

  it('đường thẳng Lũng Cú – Cà Mau nằm trong khoảng 1.600 – 1.700 km', () => {
    const lungCu = STOPS[0];
    const caMau = STOPS[STOPS.length - 1];
    expect(lungCu.name).toBe('Cột cờ Lũng Cú');
    expect(caMau.name).toBe('Mũi Cà Mau');

    const d = haversine(lungCu.lat, lungCu.lng, caMau.lat, caMau.lng);
    expect(d).toBeGreaterThanOrEqual(1600);
    expect(d).toBeLessThanOrEqual(1700);
    expect(STRAIGHT_LINE_KM).toBeGreaterThanOrEqual(1600);
    expect(STRAIGHT_LINE_KM).toBeLessThanOrEqual(1700);
  });

  it('tổng khoảng cách dọc tuyến tăng đơn điệu qua từng chặng', () => {
    const cum = calculateCumulativeDistances(STOPS);
    expect(cum).toHaveLength(15);
    expect(cum[0]).toBe(0);

    for (let i = 1; i < cum.length; i++) {
      expect(cum[i]).toBeGreaterThan(cum[i - 1]);
    }

    expect(cum[cum.length - 1]).toBeCloseTo(TOTAL_ROUTE_KM, 1);
    expect(TOTAL_ROUTE_KM).toBeGreaterThan(2000);
  });

  it('positionAt(0) trả về đúng điểm Lũng Cú, positionAt(1) trả về Mũi Cà Mau', () => {
    const start = positionAt(0);
    expect(start.km).toBe(0);
    expect(start.lat).toBeCloseTo(STOPS[0].lat, 3);
    expect(start.lng).toBeCloseTo(STOPS[0].lng, 3);
    expect(start.x).toBeCloseTo(STOPS[0].x, 1);
    expect(start.y).toBeCloseTo(STOPS[0].y, 1);

    const end = positionAt(1);
    const lastStop = STOPS[STOPS.length - 1];
    expect(end.km).toBe(Math.round(TOTAL_ROUTE_KM));
    expect(end.lat).toBeCloseTo(lastStop.lat, 3);
    expect(end.lng).toBeCloseTo(lastStop.lng, 3);
    expect(end.x).toBeCloseTo(lastStop.x, 1);
    expect(end.y).toBeCloseTo(lastStop.y, 1);

    // Kiểm tra điểm giữa hành trình 50%
    const mid = positionAt(0.5);
    expect(mid.km).toBeGreaterThan(0);
    expect(mid.km).toBeLessThan(TOTAL_ROUTE_KM);
    expect(mid.segIndex).toBeGreaterThanOrEqual(0);
    expect(mid.segIndex).toBeLessThan(STOPS.length - 1);
  });

  it('nearestStop tìm chính xác điểm dừng gần nhất theo km và toạ độ', () => {
    // Theo km
    expect(nearestStop(0).name).toBe('Cột cờ Lũng Cú');
    expect(nearestStop(265).name).toBe('Hà Nội');
    expect(nearestStop(TOTAL_ROUTE_KM).name).toBe('Mũi Cà Mau');

    // Theo toạ độ lat, lng
    const nearHanoi = nearestStop(21.02, 105.85);
    expect(nearHanoi.name).toBe('Hà Nội');

    const nearHue = nearestStop(16.46, 107.59);
    expect(nearHue.name).toBe('Huế');

    const nearCaMau = nearestStop(8.60, 104.72);
    expect(nearCaMau.name).toBe('Mũi Cà Mau');
  });

  it('regionAt xác định đúng 5 vùng khí hậu/địa hình theo từng đoạn', () => {
    // Đoạn 0: Điểm 1-2
    const r1 = regionAt(0);
    expect(r1.description).toContain('Miền núi phía Bắc → đồng bằng sông Hồng');
    expect(r1.description).toContain('khí hậu có mùa đông lạnh');

    // Đoạn 3: Nghệ An (Điểm 3-7)
    const r2 = regionAt(3);
    expect(r2.description).toContain('Bắc Trung Bộ');
    expect(r2.description).toContain('dải đất hẹp kẹp giữa Trường Sơn và biển');

    // Đoạn 7: Hải Vân (Điểm 8)
    const r3 = regionAt(7);
    expect(r3.description).toBe('Ranh giới khí hậu Hải Vân');

    // Đoạn 9: Nha Trang (Điểm 9-12)
    const r4 = regionAt(9);
    expect(r4.description).toContain('Duyên hải Nam Trung Bộ');
    expect(r4.description).toContain('nắng nhiều, bãi biển dài');

    // Đoạn 13: Cần Thơ / Cà Mau (Điểm 13-15)
    const r5 = regionAt(13);
    expect(r5.description).toContain('Nam Bộ');
    expect(r5.description).toContain('nóng quanh năm, hai mùa mưa – khô');
  });

  it('milestonesCrossed trả về các mốc vượt qua đúng thứ tự và không lặp', () => {
    // Từ 0 đến 300 km: chưa qua mốc 340 km nào
    expect(milestonesCrossed(0, 300)).toEqual([]);

    // Vượt qua mốc 340 km (0 -> 400 km)
    const cross1 = milestonesCrossed(0, 400);
    expect(cross1).toHaveLength(1);
    expect(cross1[0].km).toBe(340);
    expect(cross1[0].comparison).toBe('khoảng bằng London → Paris');

    // Từ 400 -> 500 km: không vượt mốc mới nào
    expect(milestonesCrossed(400, 500)).toEqual([]);

    // Vượt qua từ 300 -> 1100 km: vượt qua 340, 880, 1070 đúng thứ tự
    const crossMulti = milestonesCrossed(300, 1100);
    expect(crossMulti.map((m) => m.km)).toEqual([340, 880, 1070]);

    // Lùi lại: không kích hoạt
    expect(milestonesCrossed(800, 200)).toEqual([]);

    // Vượt mốc cuối 1430 km
    const crossAll = milestonesCrossed(0, 2000);
    expect(crossAll.map((m) => m.km)).toEqual([340, 880, 1070, 1430]);
  });

  it('danh sách 15 điểm dừng có đủ toạ độ, tỉnh thành và không bịa đặt số liệu', () => {
    expect(STOPS).toHaveLength(15);
    expect(STOPS[0].province).toBe('Tuyên Quang');
    expect(STOPS[1].province).toBe('Hà Nội');
    expect(STOPS[6].province).toBe('Huế');
    expect(STOPS[7].province).toBe('Đà Nẵng');
    expect(STOPS[12].province).toBe('TP.HCM');
    expect(STOPS[14].province).toBe('Cà Mau');

    // Kiểm tra toạ độ x, y phẳng km đã được tính
    for (const stop of STOPS) {
      expect(typeof stop.x).toBe('number');
      expect(typeof stop.y).toBe('number');
      expect(Number.isFinite(stop.x)).toBe(true);
      expect(Number.isFinite(stop.y)).toBe(true);
    }
  });

  it('getJourneyProvinces xác định tỉnh đang ở và danh sách tỉnh đã đi qua', () => {
    const atStart = getJourneyProvinces(0);
    expect(atStart.currentProvince).toBe('Tuyên Quang');
    expect(atStart.passedProvinces).toEqual(['Tuyên Quang']);

    const atHanoi = getJourneyProvinces(1);
    expect(atHanoi.currentProvince).toBe('Hà Nội');
    expect(atHanoi.passedProvinces).toEqual(['Tuyên Quang', 'Hà Nội']);

    const atEnd = getJourneyProvinces(14);
    expect(atEnd.currentProvince).toBe('Cà Mau');
    expect(atEnd.passedProvinces).toContain('Tuyên Quang');
    expect(atEnd.passedProvinces).toContain('Hà Nội');
    expect(atEnd.passedProvinces).toContain('Huế');
    expect(atEnd.passedProvinces).toContain('TP.HCM');
    expect(atEnd.passedProvinces).toContain('Cà Mau');
  });
});

describe('Bước E: Component DocVietNam.svelte và tích hợp ToCoNao.svelte', () => {
  it('DocVietNam.svelte có đủ câu hỏi, thanh trượt aria, mốc so sánh, bản đồ và màn tổng kết', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const code = fs.readFileSync(path.resolve(__dirname, 'DocVietNam.svelte'), 'utf8');

    // Câu hỏi lớn và gợi ý
    expect(code).toContain('Bạn nghĩ Việt Nam dài đến mức nào?');
    expect(code).toContain('Kéo thanh trượt để đi từ cực Bắc xuống cực Nam');

    // Input range và a11y
    expect(code).toContain('type="range"');
    expect(code).toContain('aria-label="Hành trình dọc Việt Nam"');
    expect(code).toContain('aria-valuetext');

    // Hỗ trợ cuộn chuột, bàn phím và chạm
    expect(code).toContain('onwheel');
    expect(code).toContain('ArrowDown');
    expect(code).toContain('PageDown');
    expect(code).toContain('ontouchstart');

    // Màn tổng kết
    expect(code).toContain('đường chim bay dọc tuyến');
    expect(code).toContain('50 km');
    expect(code).toContain('So sánh Việt Nam với nước khác ↓');
    expect(code).toContain('Đi lại từ đầu');

    // Đường thẳng Lũng Cú - Cà Mau
    expect(code).toContain('straight-line');

    // prefers-reduced-motion
    expect(code).toContain('prefers-reduced-motion');
  });

  it('ToCoNao.svelte tích hợp DocVietNam và đã loại bỏ IntroModal cùng tcn-intro-seen', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const code = fs.readFileSync(path.resolve(__dirname, 'ToCoNao.svelte'), 'utf8');

    expect(code).toContain('DocVietNam');
    expect(code).toContain('handleCompareWithOtherFromDocVn');
    expect(code).toContain('viet-nam');
    expect(code).toContain('jpn');

    // Đã bỏ hoàn toàn IntroModal và logic tcn-intro-seen
    expect(code).not.toContain('IntroModal');
    expect(code).not.toContain('tcn-intro-seen');
    expect(fs.existsSync(path.resolve(__dirname, 'IntroModal.svelte'))).toBe(false);
  });
});
