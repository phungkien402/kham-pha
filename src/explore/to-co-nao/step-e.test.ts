import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { geoContains } from 'd3-geo';
import {
  haversine,
  calculateCumulativeDistances,
  positionAt,
  nearestStop,
  regionAt,
  milestonesCrossed,
  STOPS,
  STOP_IMAGES,
  TOTAL_ROUTE_KM,
  STRAIGHT_LINE_KM,
  MILESTONES,
  NATIONAL_VIEWBOX,
  getJourneyProvinces,
  calculateZoomWindow,
  createAutoPlaySchedule,
  getAutoPlayStateAtTime,
  selectStopWithHysteresis,
  calculateTravelEstimates,
  formatGuessComparison,
  PROVINCES,
  VN_PATH,
} from './docVietNam';

describe('Bước E3: Tuyến hành trình 32 điểm dừng dọc Việt Nam (docVietNam.ts)', () => {
  it('danh sách đúng 32 điểm dừng có đủ toạ độ, tỉnh thành, mô tả, fact và loại', () => {
    expect(STOPS).toHaveLength(32);
    expect(STOPS[0].name).toBe('Cột cờ Lũng Cú');
    expect(STOPS[0].province).toBe('Tuyên Quang');
    expect(STOPS[31].name).toBe('Mũi Cà Mau');
    expect(STOPS[31].province).toBe('Cà Mau');

    for (let i = 0; i < STOPS.length; i++) {
      const stop = STOPS[i];
      expect(stop.id).toBe(i + 1);
      expect(typeof stop.lat).toBe('number');
      expect(typeof stop.lng).toBe('number');
      expect(typeof stop.x).toBe('number');
      expect(typeof stop.y).toBe('number');
      expect(Number.isFinite(stop.x)).toBe(true);
      expect(Number.isFinite(stop.y)).toBe(true);
      expect(stop.description.length).toBeGreaterThan(15);
      expect(stop.fact.length).toBeGreaterThan(10);
      expect(stop.type.length).toBeGreaterThan(2);
      expect(stop.wikiTitle.length).toBeGreaterThan(2);
    }
  });

  it('haversine tính đúng khoảng cách Hà Nội – TP.HCM ≈ 1.140 km ± 20 km', () => {
    const hanoi = STOPS.find((s) => s.province === 'Hà Nội' && s.name === 'Hồ Hoàn Kiếm')!;
    const tphcm = STOPS.find((s) => s.province === 'TP.HCM' && s.name === 'Bến Nhà Rồng – TP.HCM')!;
    expect(hanoi).toBeDefined();
    expect(tphcm).toBeDefined();

    const d = haversine(hanoi.lat, hanoi.lng, tphcm.lat, tphcm.lng);
    expect(d).toBeGreaterThanOrEqual(1120);
    expect(d).toBeLessThanOrEqual(1160);
  });

  it('đường thẳng Lũng Cú – Cà Mau nằm trong khoảng 1.600 – 1.700 km', () => {
    const lungCu = STOPS[0];
    const caMau = STOPS[31];
    expect(lungCu.name).toBe('Cột cờ Lũng Cú');
    expect(caMau.name).toBe('Mũi Cà Mau');

    const d = haversine(lungCu.lat, lungCu.lng, caMau.lat, caMau.lng);
    expect(d).toBeGreaterThanOrEqual(1600);
    expect(d).toBeLessThanOrEqual(1700);
    expect(STRAIGHT_LINE_KM).toBeGreaterThanOrEqual(1600);
    expect(STRAIGHT_LINE_KM).toBeLessThanOrEqual(1700);
    expect(STRAIGHT_LINE_KM).toBeLessThan(TOTAL_ROUTE_KM);
  });

  it('tổng khoảng cách dọc tuyến tăng đơn điệu qua từng chặng (32 điểm dừng)', () => {
    const cum = calculateCumulativeDistances(STOPS);
    expect(cum).toHaveLength(32);
    expect(cum[0]).toBe(0);

    for (let i = 1; i < cum.length; i++) {
      expect(cum[i]).toBeGreaterThan(cum[i - 1]);
    }

    expect(cum[cum.length - 1]).toBeCloseTo(TOTAL_ROUTE_KM, 1);
    expect(TOTAL_ROUTE_KM).toBeGreaterThan(2500);
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
    expect(end.segIndex).toBe(30);

    // Điểm giữa 50%
    const mid = positionAt(0.5);
    expect(mid.km).toBeGreaterThan(0);
    expect(mid.km).toBeLessThan(TOTAL_ROUTE_KM);
    expect(mid.segIndex).toBeGreaterThanOrEqual(0);
    expect(mid.segIndex).toBeLessThan(STOPS.length - 1);
  });

  it('nearestStop tìm chính xác điểm dừng gần nhất theo km và toạ độ', () => {
    // Theo km
    expect(nearestStop(0).name).toBe('Cột cờ Lũng Cú');
    expect(nearestStop(TOTAL_ROUTE_KM).name).toBe('Mũi Cà Mau');

    // Theo toạ độ lat, lng
    const nearHoanKiem = nearestStop(21.028, 105.852);
    expect(nearHoanKiem.name).toBe('Hồ Hoàn Kiếm');

    const nearHue = nearestStop(16.469, 107.578);
    expect(nearHue.name).toBe('Đại Nội Huế');

    const nearCaMau = nearestStop(8.6, 104.72);
    expect(nearCaMau.name).toBe('Mũi Cà Mau');
  });

  it('regionAt xác định đúng 5 vùng khí hậu/địa hình theo quy tắc 32 điểm dừng', () => {
    // Điểm 1–9: Miền núi phía Bắc -> ĐBSH
    for (let id = 1; id <= 9; id++) {
      const r = regionAt({ id });
      expect(r.id).toBe('mien-bac');
      expect(r.description).toContain('Miền núi phía Bắc');
    }

    // Điểm 10–17: Bắc Trung Bộ
    for (let id = 10; id <= 17; id++) {
      const r = regionAt({ id });
      expect(r.id).toBe('bac-trung-bo');
      expect(r.description).toContain('Bắc Trung Bộ');
    }

    // Điểm 18: Hải Vân
    const rHaiVan = regionAt({ id: 18 });
    expect(rHaiVan.id).toBe('hai-van');
    expect(rHaiVan.description).toContain('Hải Vân');

    // Điểm 19–27: Nam Trung Bộ
    for (let id = 19; id <= 27; id++) {
      const r = regionAt({ id });
      expect(r.id).toBe('nam-trung-bo');
      expect(r.description).toContain('Nam Trung Bộ');
    }

    // Điểm 28–32: Nam Bộ
    for (let id = 28; id <= 32; id++) {
      const r = regionAt({ id });
      expect(r.id).toBe('nam-bo');
      expect(r.description).toContain('Nam Bộ');
    }
  });

  it('milestonesCrossed trả về các mốc vượt qua đúng thứ tự và không lặp', () => {
    expect(milestonesCrossed(0, 300)).toEqual([]);

    const cross1 = milestonesCrossed(0, 400);
    expect(cross1).toHaveLength(1);
    expect(cross1[0].km).toBe(340);
    expect(cross1[0].comparison).toBe('khoảng bằng London → Paris');

    const crossMulti = milestonesCrossed(300, 1100);
    expect(crossMulti.map((m) => m.km)).toEqual([340, 880, 1070]);

    const crossAll = milestonesCrossed(0, 3000);
    expect(crossAll.map((m) => m.km)).toEqual([340, 880, 1070, 1430]);
  });

  it('getJourneyProvinces xác định tỉnh đang ở và danh sách tỉnh đã đi qua', () => {
    const atStart = getJourneyProvinces(0);
    expect(atStart.currentProvince).toBe('Tuyên Quang');
    expect(atStart.passedProvinces).toEqual(['Tuyên Quang']);

    const atEnd = getJourneyProvinces(30, true);
    expect(atEnd.currentProvince).toBe('Cà Mau');
    expect(atEnd.passedProvinces).toContain('Tuyên Quang');
    expect(atEnd.passedProvinces).toContain('Hà Nội');
    expect(atEnd.passedProvinces).toContain('Huế');
    expect(atEnd.passedProvinces).toContain('TP.HCM');
    expect(atEnd.passedProvinces).toContain('Cà Mau');
  });

  it('calculateZoomWindow tính đúng cửa sổ zoom: 0% và 100% là toàn quốc; giữa là ~450 km', () => {
    // 0% và >= 99%: toàn quốc
    const win0 = calculateZoomWindow(0);
    expect(win0.width).toBe(NATIONAL_VIEWBOX.width);
    expect(win0.height).toBe(NATIONAL_VIEWBOX.height);

    const win100 = calculateZoomWindow(1);
    expect(win100.width).toBe(NATIONAL_VIEWBOX.width);
    expect(win100.height).toBe(NATIONAL_VIEWBOX.height);

    const win99 = calculateZoomWindow(0.995);
    expect(win99.width).toBe(NATIONAL_VIEWBOX.width);

    // Ở giữa (progress = 0.5): cửa sổ rộng ~450 km quanh điểm
    const testPoint = { x: 100, y: 250 };
    const winMid = calculateZoomWindow(0.5, testPoint);
    expect(winMid.width).toBe(450);
    expect(Math.abs(winMid.x + winMid.width / 2 - testPoint.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(winMid.y + winMid.height / 2 - testPoint.y)).toBeLessThanOrEqual(1);
  });

  it('chế độ tự đi (hàm thuần lập lịch dừng createAutoPlaySchedule và getAutoPlayStateAtTime)', () => {
    const schedule = createAutoPlaySchedule(STOPS, 60000, 1500);
    expect(schedule.stops).toHaveLength(32);
    expect(schedule.travelDurationMs).toBe(60000);
    expect(schedule.pauseMs).toBe(1500);
    expect(schedule.totalDurationMs).toBeGreaterThan(60000);

    // Tại thời điểm 0ms
    const state0 = getAutoPlayStateAtTime(0, schedule);
    expect(state0.progress).toBe(0);
    expect(state0.currentStopIndex).toBe(0);

    // Tại thời điểm kết thúc
    const stateEnd = getAutoPlayStateAtTime(schedule.totalDurationMs + 100, schedule);
    expect(stateEnd.progress).toBe(1);
    expect(stateEnd.isFinished).toBe(true);

    // Kiểm tra trạng thái dừng (pause) tại điểm dừng thứ 2
    const stop2 = schedule.stops[1];
    const pauseTime = (stop2.arriveMs + stop2.leaveMs) / 2;
    const statePause = getAutoPlayStateAtTime(pauseTime, schedule);
    expect(statePause.isPaused).toBe(true);
    expect(statePause.currentStopIndex).toBe(1);

    // Reduced motion: nhảy từng điểm
    const travelTime = (stop2.startTravelMs + stop2.arriveMs) / 2;
    const stateReduced = getAutoPlayStateAtTime(travelTime, schedule, true);
    expect(stateReduced.currentStopIndex).toBe(0);
  });

  it('doc-vn-anh.json: mọi ảnh có tacGia, giayPhep, nguon, giấy phép hợp lệ và file tồn tại trên đĩa', () => {
    const publicDir = path.resolve(__dirname, '../../../public/doc-vn');
    expect(fs.existsSync(publicDir)).toBe(true);

    const keys = Object.keys(STOP_IMAGES);
    expect(keys.length).toBe(32);

    const ALLOWED_LICENSE_REGEX = /CC0|CC BY|CC BY-SA|Public domain|PD/i;

    for (let id = 1; id <= 32; id++) {
      const img = STOP_IMAGES[String(id)];
      expect(img, `Ảnh cho điểm #${id}`).toBeDefined();
      expect(img.src).toBe(`/doc-vn/${id}.webp`);
      expect(img.w).toBeGreaterThan(200);
      expect(img.h).toBeGreaterThan(200);
      expect(img.tacGia.length, `Tác giả #${id}`).toBeGreaterThan(2);
      expect(img.giayPhep.length, `Giấy phép #${id}`).toBeGreaterThan(2);
      expect(img.nguon, `Nguồn #${id}`).toContain('commons.wikimedia.org');
      expect(ALLOWED_LICENSE_REGEX.test(img.giayPhep), `Giấy phép ${img.giayPhep} điểm #${id}`).toBe(true);

      const filePath = path.resolve(publicDir, `${id}.webp`);
      expect(fs.existsSync(filePath), `File ${filePath} phải tồn tại`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size, `Kích thước file #${id}`).toBeLessThanOrEqual(180 * 1024);
    }
  });
});

describe('Bước E3: Component DocVietNam.svelte và tích hợp ToCoNao.svelte', () => {
  it('DocVietNam.svelte có đủ các phần tử thiết kế theo đặc tả E3', async () => {
    const code = fs.readFileSync(path.resolve(__dirname, 'DocVietNam.svelte'), 'utf8');

    // Câu hỏi lớn
    expect(code).toContain('Bạn nghĩ Việt Nam dài đến mức nào?');

    // Thẻ địa danh hero card
    expect(code).toContain('hero-card');
    expect(code).toContain('ken-burns');
    expect(code).toContain('hero-attribution');
    expect(code).toContain('hero-fact-row');

    // Nút tự đi
    expect(code).toContain('toggleAutoPlay');
    expect(code).toContain('Tự đi');

    // Mini-map và zoom
    expect(code).toContain('mini-map');
    expect(code).toContain('mini-view-indicator');
    expect(code).toContain('vn-main-svg');

    // Slider dọc desktop & slider mobile
    expect(code).toContain('desktop-slider');
    expect(code).toContain('mobile-slider');
    expect(code).toContain('writing-mode: vertical-lr');

    // Bố cục 2 cột desktop (≥ 1024px)
    expect(code).toContain('minmax(360px, 42%) 1fr');

    // Mobile padding-bottom và sticky đáy
    expect(code).toContain('padding-bottom: 74px');
    expect(code).toContain('position: sticky');

    // prefers-reduced-motion
    expect(code).toContain('prefers-reduced-motion');
  });

  it('ToCoNao.svelte tích hợp DocVietNam và giữ nguyên các tính năng so sánh', async () => {
    const code = fs.readFileSync(path.resolve(__dirname, 'ToCoNao.svelte'), 'utf8');

    expect(code).toContain('DocVietNam');
    expect(code).toContain('handleCompareWithOtherFromDocVn');
    expect(code).not.toContain('IntroModal');
    expect(code).not.toContain('tcn-intro-seen');
  });
});

describe('Bước E4: Tinh chỉnh dữ liệu 32 điểm dừng & các hàm thuần E4', () => {
  it('dữ liệu 32 điểm dừng: đủ 4 trường hook, moTa, fact, changKe không rỗng; moTa ≤ 2 câu; description khớp moTa', () => {
    expect(STOPS).toHaveLength(32);

    for (let i = 0; i < STOPS.length; i++) {
      const stop = STOPS[i];
      expect(stop.id).toBe(i + 1);
      expect(typeof stop.hook).toBe('string');
      expect(stop.hook.trim().length).toBeGreaterThan(10);

      expect(typeof stop.moTa).toBe('string');
      expect(stop.moTa.trim().length).toBeGreaterThan(15);

      // moTa đúng ≤ 2 câu (tách câu theo dấu chấm/chấm than/chấm hỏi)
      const sentences = stop.moTa.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, `Điểm #${stop.id} (${stop.name}) moTa có ${sentences.length} câu`).toBeLessThanOrEqual(2);

      // Alias description để tương thích ngược 100%
      expect(stop.description).toBe(stop.moTa);

      expect(typeof stop.fact).toBe('string');
      expect(stop.fact.trim().length).toBeGreaterThan(10);

      expect(typeof stop.changKe).toBe('string');
      expect(stop.changKe.trim().length).toBeGreaterThan(10);
    }
  });

  it('PROVINCES có đúng 34 tỉnh sáp nhập và VN_PATH là đường biên toàn quốc hợp lệ', () => {
    const provKeys = Object.keys(PROVINCES);
    expect(provKeys).toHaveLength(34);

    for (const key of provKeys) {
      const p = PROVINCES[key];
      expect(p.name.length).toBeGreaterThan(1);
      expect(p.d.startsWith('M')).toBe(true);
      expect(Number.isFinite(p.labelX)).toBe(true);
      expect(Number.isFinite(p.labelY)).toBe(true);
    }

    expect(VN_PATH.startsWith('M')).toBe(true);
    expect(VN_PATH.length).toBeGreaterThan(500);
  });

  it('selectStopWithHysteresis: vùng đệm trễ 15% qua trung điểm giúp kéo mượt không giật thẻ', () => {
    const p0 = STOPS[0];
    const p1 = STOPS[1];
    const segLen = p1.kmFromStart - p0.kmFromStart;
    const midKm = p0.kmFromStart + 0.5 * segLen;

    // Tiến: chỉ chuyển từ p0 sang p1 khi vượt quá 15% độ dài đoạn kể từ trung điểm (tức 65%)
    const forwardThreshold = p0.kmFromStart + 0.65 * segLen;
    expect(selectStopWithHysteresis(midKm, 0).id).toBe(p0.id);
    expect(selectStopWithHysteresis(forwardThreshold - 0.05, 0).id).toBe(p0.id);
    expect(selectStopWithHysteresis(forwardThreshold + 0.05, 0).id).toBe(p1.id);

    // Lùi: chỉ chuyển từ p1 về p0 khi lùi quá 15% độ dài đoạn kể từ trung điểm (tức 35%)
    const backwardThreshold = p0.kmFromStart + 0.35 * segLen;
    expect(selectStopWithHysteresis(midKm, 1).id).toBe(p1.id);
    expect(selectStopWithHysteresis(backwardThreshold + 0.05, 1).id).toBe(p1.id);
    expect(selectStopWithHysteresis(backwardThreshold - 0.05, 1).id).toBe(p0.id);

    // Kẹp biên tại 2 đầu
    expect(selectStopWithHysteresis(-10, 0).id).toBe(p0.id);
    expect(selectStopWithHysteresis(TOTAL_ROUTE_KM + 100, 31).id).toBe(STOPS[31].id);

    // Khi previousStopIndex = -1 (chưa khởi tạo)
    expect(selectStopWithHysteresis(0, -1).id).toBe(p0.id);
    expect(selectStopWithHysteresis(TOTAL_ROUTE_KM, -1).id).toBe(STOPS[31].id);
  });

  it('formatGuessComparison: xử lý đầy đủ các trường hợp 1.650 / 1.000 / 2.500 / null', () => {
    const straight = Math.round(STRAIGHT_LINE_KM);

    // 1.650 km: đoán rất chuẩn
    const res1650 = formatGuessComparison(1650);
    expect(res1650.hasGuess).toBe(true);
    expect(res1650.guessKm).toBe(1650);
    expect(res1650.straightKm).toBe(straight);
    expect(res1650.assessment).toBe('đoán rất chuẩn');
    expect(res1650.fullText).toContain('đoán rất chuẩn');

    // 1.000 km: thực tế xa hơn bạn nghĩ khá nhiều
    const res1000 = formatGuessComparison(1000);
    expect(res1000.hasGuess).toBe(true);
    expect(res1000.assessment).toBe('thực tế xa hơn bạn nghĩ khá nhiều');
    expect(res1000.fullText).toContain('thực tế xa hơn bạn nghĩ khá nhiều');

    // 2.500 km: gần với chiều dài đường bộ
    const res2500 = formatGuessComparison(2500);
    expect(res2500.hasGuess).toBe(true);
    expect(res2500.assessment).toBe('gần với chiều dài đường bộ dọc hành trình hơn là đường chim bay');

    // null / bỏ qua
    const resNull = formatGuessComparison(null);
    expect(resNull.hasGuess).toBe(false);
    expect(resNull.guessKm).toBeNull();
    expect(resNull.fullText).toContain(`Thực tế khoảng`);
  });

  it('calculateTravelEstimates: tính chuẩn thời gian theo km dọc tuyến (xe máy 40 km/h, tàu 60 km/h, máy bay 800 km/h)', () => {
    const est = calculateTravelEstimates(TOTAL_ROUTE_KM);
    expect(est.motorbikeHours).toBe(Math.round(TOTAL_ROUTE_KM / 40));
    expect(est.trainHours).toBe(Math.round(TOTAL_ROUTE_KM / 60));
    expect(est.planeHours).toBe(Number((TOTAL_ROUTE_KM / 800).toFixed(1)));
    expect(est.note).toBe('ước tính, chưa tính nghỉ');
    expect(est.motorbikeText).toContain('giờ');
    expect(est.trainText).toContain('giờ');
    expect(est.planeText).toContain('giờ');
  });

  it('point-in-polygon: 32 điểm dừng nằm đúng hoặc sát tỉnh kỳ vọng; Lý Sơn thuộc Quảng Ngãi và cách đất liền > 15 km; Mỹ Sơn thuộc Đà Nẵng', () => {
    const provPath = path.resolve(__dirname, '../../../raw-data/Provinces.geojson');
    if (!fs.existsSync(provPath)) return;

    const provincesRaw = JSON.parse(fs.readFileSync(provPath, 'utf8'));

    const provGroups: Record<string, any[]> = {};
    for (const f of provincesRaw.features) {
      let name = f.properties.TinhThanh || f.properties.name || '';
      if (name === 'TP. Hồ Chí Minh' || name === 'TP Hồ Chí Minh' || name === 'Hồ Chí Minh') {
        name = 'TP.HCM';
      }
      if (!provGroups[name]) provGroups[name] = [];
      provGroups[name].push(f);
    }

    // 1. Kiểm tra Mỹ Sơn nằm trong Đà Nẵng
    const mySon = STOPS.find((s) => s.name === 'Thánh địa Mỹ Sơn')!;
    expect(mySon.province).toBe('Đà Nẵng');
    const daNangFeats = provGroups['Đà Nẵng'] || [];
    const mySonInside = daNangFeats.some((f) => geoContains(f, [mySon.lng, mySon.lat]));
    expect(mySonInside, 'Mỹ Sơn phải nằm trong polygon Đà Nẵng (Quảng Nam sáp nhập)').toBe(true);

    // 2. Kiểm tra Lý Sơn thuộc Quảng Ngãi và nằm ngoài đất liền > 15 km
    const lySon = STOPS.find((s) => s.name === 'Đảo Lý Sơn')!;
    expect(lySon.province).toBe('Quảng Ngãi');
    const qnFeats = provGroups['Quảng Ngãi'] || [];
    const lySonInProv = qnFeats.some((f) => geoContains(f, [lySon.lng, lySon.lat]));
    expect(lySonInProv, 'Lý Sơn phải nằm trong polygon Quảng Ngãi').toBe(true);

    // Tìm polygon đất liền của Quảng Ngãi (polygon có số điểm lớn nhất)
    let mainlandRing: [number, number][] = [];
    let maxPoints = 0;
    for (const f of qnFeats) {
      const geom = f.geometry;
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      for (const poly of polys) {
        const ring = poly[0];
        if (ring.length > maxPoints) {
          maxPoints = ring.length;
          mainlandRing = ring;
        }
      }
    }
    // Lý Sơn nằm ngoài đất liền
    const lySonInMainland = geoContains({ type: 'Polygon', coordinates: [mainlandRing] } as any, [lySon.lng, lySon.lat]);
    expect(lySonInMainland, 'Lý Sơn không được nằm trong polygon đất liền').toBe(false);

    // Khoảng cách từ Lý Sơn tới bờ đất liền Quảng Ngãi > 15 km
    let minCoastDist = Infinity;
    for (const [lng, lat] of mainlandRing) {
      const d = haversine(lySon.lat, lySon.lng, lat, lng);
      if (d < minCoastDist) minCoastDist = d;
    }
    expect(minCoastDist, 'Khoảng cách từ Lý Sơn tới đất liền phải > 15 km').toBeGreaterThan(15);

    // 3. Toàn bộ 32 điểm: hoặc nằm trong polygon, hoặc nằm trong dung sai bờ biển ≤ 3 km
    for (const stop of STOPS) {
      const feats = provGroups[stop.province] || [];
      const inside = feats.some((f) => geoContains(f, [stop.lng, stop.lat]));
      if (!inside) {
        // Tính khoảng cách tới đỉnh gần nhất của tỉnh
        let minD = Infinity;
        for (const f of feats) {
          const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
          for (const poly of polys) {
            for (const ring of poly) {
              for (const [lng, lat] of ring) {
                const d = haversine(stop.lat, stop.lng, lat, lng);
                if (d < minD) minD = d;
              }
            }
          }
        }
        expect(minD, `Điểm #${stop.id} ${stop.name} (${stop.province}) cách ranh tỉnh ≤ 3 km`).toBeLessThanOrEqual(3.0);
      }
    }
  });

  it('manifest ảnh scripts/doc-vn-anh-manifest.json và contact sheet docs/doc-vn-anh-contact.jpg', () => {
    const manifestPath = path.resolve(__dirname, '../../../scripts/doc-vn-anh-manifest.json');
    expect(fs.existsSync(manifestPath), 'Manifest ảnh phải tồn tại').toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest).toHaveLength(32);

    for (let i = 0; i < 32; i++) {
      const item = manifest[i];
      expect(item.id).toBe(i + 1);
      expect(typeof item.commonsFile).toBe('string');
      expect(item.commonsFile.length).toBeGreaterThan(3);
      expect(typeof item.cropPosition).toBe('string');
      expect(item.cropPosition.length).toBeGreaterThan(2);

      // Trong doc-vn-anh.json cũng phải có cropPosition
      const imgMeta = STOP_IMAGES[String(item.id)];
      expect(imgMeta).toBeDefined();
      expect(imgMeta.cropPosition).toBe(item.cropPosition);
    }

    // Contact sheet
    const contactPath = path.resolve(__dirname, '../../../docs/doc-vn-anh-contact.jpg');
    expect(fs.existsSync(contactPath), 'Contact sheet phải tồn tại').toBe(true);
    const contactStat = fs.statSync(contactPath);
    expect(contactStat.size, 'Kích thước contact sheet').toBeGreaterThan(50 * 1024);
  });

  it('DocVietNam.svelte tuân thủ đặc tả E4: quiz 3 nút, haptic vibrate, không confetti, bố cục ảnh clamp', () => {
    const code = fs.readFileSync(path.resolve(__dirname, 'DocVietNam.svelte'), 'utf8');

    // 3 nút đoán đường chim bay
    expect(code).toContain('2.500');
    expect(code).toContain('1.000');
    expect(code).toContain('1.650');
    expect(code).toContain('localStorage');

    // Hysteresis & đồng bộ "Đang ở <tỉnh>"
    expect(code).toContain('selectStopWithHysteresis');
    expect(code).toContain('currentNearest.province');
    expect(code).toContain('Đang ở');

    // Haptic pulse navigator.vibrate(10)
    expect(code).toContain('navigator.vibrate(10)');

    // Không dùng confetti
    expect(code).not.toContain('confetti');
    expect(code).not.toContain('canvas-confetti');

    // CSS clamp cho hero image desktop
    expect(code).toContain('clamp(22rem, 40svh, 34rem)');

    // Hiển thị PROVINCES & VN_PATH
    expect(code).toContain('PROVINCES');
    expect(code).toContain('VN_PATH');

    // Cấu trúc hero card: hook nằm trên ảnh
    const hookIdx = code.indexOf('hero-hook');
    const imgIdx = code.indexOf('hero-img');
    const factIdx = code.indexOf('hero-fact-row');
    const changKeIdx = code.indexOf('hero-next-hint');
    expect(hookIdx).toBeGreaterThan(-1);
    expect(imgIdx).toBeGreaterThan(hookIdx);
    expect(factIdx).toBeGreaterThan(imgIdx);
    expect(changKeIdx).toBeGreaterThan(factIdx);
  });
});
