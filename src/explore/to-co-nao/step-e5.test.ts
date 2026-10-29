import { describe, it, expect } from 'vitest';
import {
  STOPS,
  TOTAL_ROUTE_KM,
  snapToNearestStopKm,
  snapStopKm,
  getDisplayedStop,
  selectStopWithHysteresis,
  isNearEastCoast,
  isLabelPlacedRight,
  estimateLabelBBox,
  checkBBoxCollision,
  computeVisibleStopLabels,
  type StopPoint,
} from './docVietNam';

describe('Nhiệm vụ E5: Sửa lỗi lệch vị trí trên bản đồ DocVietNam', () => {
  describe('1. Hàm snap (km → km điểm dừng gần nhất)', () => {
    it('snap tại đúng toạ độ điểm dừng trả về chính km đó', () => {
      for (const stop of STOPS) {
        const snapped = snapToNearestStopKm(stop.kmFromStart);
        expect(snapped).toBe(stop.kmFromStart);
      }
    });

    it('snap giữa 2 điểm dừng: hút về điểm gần nhất theo khoảng cách km', () => {
      // Đoạn từ Lý Sơn (stop 22) đến Eo Gió (stop 23)
      const lySon = STOPS[21]; // id 22
      const eoGio = STOPS[22]; // id 23
      expect(lySon.name).toBe('Đảo Lý Sơn');
      expect(eoGio.name).toBe('Eo Gió – Quy Nhơn');

      const segLen = eoGio.kmFromStart - lySon.kmFromStart;
      expect(segLen).toBeGreaterThan(100);

      // Điểm gần Lý Sơn hơn (30% đoạn) -> hút về Lý Sơn
      const nearLySonKm = lySon.kmFromStart + segLen * 0.3;
      expect(snapToNearestStopKm(nearLySonKm)).toBe(lySon.kmFromStart);

      // Điểm gần Eo Gió hơn (70% đoạn) -> hút về Eo Gió
      const nearEoGioKm = lySon.kmFromStart + segLen * 0.7;
      expect(snapToNearestStopKm(nearEoGioKm)).toBe(eoGio.kmFromStart);
    });

    it('snap xử lý đúng ở hai đầu mút và biên', () => {
      // Nhỏ hơn 0 -> hút về Lũng Cú (0 km)
      expect(snapToNearestStopKm(-50)).toBe(0);
      expect(snapToNearestStopKm(0)).toBe(0);

      // Lớn hơn tổng chiều dài -> hút về Cà Mau
      const lastStopKm = STOPS[STOPS.length - 1].kmFromStart;
      expect(snapToNearestStopKm(TOTAL_ROUTE_KM + 100)).toBe(lastStopKm);
      expect(snapToNearestStopKm(lastStopKm)).toBe(lastStopKm);
    });

    it('alias snapStopKm hoạt động đồng nhất với snapToNearestStopKm', () => {
      expect(snapStopKm(500)).toBe(snapToNearestStopKm(500));
      expect(snapStopKm(1500)).toBe(snapToNearestStopKm(1500));
    });

    it('hoạt động chính xác với danh sách điểm dừng tuỳ biến', () => {
      const mockStops: StopPoint[] = [
        { id: 1, name: 'A', province: 'Tỉnh A', lat: 20, lng: 105, type: 'Núi', wikiTitle: '', hook: '', moTa: '', description: 'Mô tả A', fact: 'Fact A', changKe: '', x: 0, y: 0, kmFromStart: 0 },
        { id: 2, name: 'B', province: 'Tỉnh B', lat: 18, lng: 106, type: 'Biển', wikiTitle: '', hook: '', moTa: '', description: 'Mô tả B', fact: 'Fact B', changKe: '', x: 50, y: 50, kmFromStart: 100 },
        { id: 3, name: 'C', province: 'Tỉnh C', lat: 16, lng: 107, type: 'Lịch sử', wikiTitle: '', hook: '', moTa: '', description: 'Mô tả C', fact: 'Fact C', changKe: '', x: 100, y: 100, kmFromStart: 300 },
      ];

      expect(snapToNearestStopKm(40, mockStops)).toBe(0);
      expect(snapToNearestStopKm(60, mockStops)).toBe(100);
      expect(snapToNearestStopKm(250, mockStops)).toBe(300);
    });
  });

  describe('2. Điểm hiển thị khi kéo = nearest (bỏ hysteresis gây lệch)', () => {
    it('getDisplayedStop luôn trả về điểm dừng gần nhất theo km', () => {
      for (const stop of STOPS) {
        expect(getDisplayedStop(stop.kmFromStart).id).toBe(stop.id);
      }
    });

    it('không có độ trễ (hysteresis) giữa Lý Sơn và Eo Gió: đổi điểm ngay tại trung điểm', () => {
      const lySon = STOPS[21];
      const eoGio = STOPS[22];
      const midKm = (lySon.kmFromStart + eoGio.kmFromStart) / 2;

      // Kéo tiến (Nam tiến): trước trung điểm là Lý Sơn, vượt qua trung điểm là Eo Gió
      const justBeforeMid = midKm - 0.5;
      const justAfterMid = midKm + 0.5;

      expect(getDisplayedStop(justBeforeMid).id).toBe(lySon.id);
      expect(getDisplayedStop(justBeforeMid).province).toBe('Quảng Ngãi');

      expect(getDisplayedStop(justAfterMid).id).toBe(eoGio.id);
      expect(getDisplayedStop(justAfterMid).province).toBe('Gia Lai');

      // Kéo lùi (Bắc tiến): từ Eo Gió lùi về qua trung điểm đổi ngay sang Lý Sơn, không bị giữ lại ở Eo Gió
      const backwardFromEoGio = selectStopWithHysteresis(justBeforeMid, 22, STOPS, 0);
      expect(backwardFromEoGio.id).toBe(lySon.id);
      expect(backwardFromEoGio.province).toBe('Quảng Ngãi');
    });

    it('đồng bộ 100% giữa điểm trên thẻ và tỉnh: "Đang ở" = tỉnh của điểm hiển thị', () => {
      // Kiểm tra 50 mốc km ngẫu nhiên dọc toàn tuyến
      for (let km = 0; km <= TOTAL_ROUTE_KM; km += TOTAL_ROUTE_KM / 50) {
        const displayed = getDisplayedStop(km);
        const hysteresisZero = selectStopWithHysteresis(km, 0, STOPS, 0);
        expect(displayed.id).toBe(hysteresisZero.id);
        expect(displayed.province).toBe(hysteresisZero.province);
      }
    });
  });

  describe('3. Chọn nhãn không va chạm và đặt phía biển cho bờ đông', () => {
    it('isNearEastCoast nhận diện đúng các điểm ven biển phía Đông', () => {
      // Các điểm biển và duyên hải
      const haLong = STOPS.find((s) => s.name === 'Vịnh Hạ Long')!;
      const samSon = STOPS.find((s) => s.name === 'Biển Sầm Sơn')!;
      const thienCam = STOPS.find((s) => s.name === 'Biển Thiên Cầm')!;
      const hue = STOPS.find((s) => s.name === 'Đại Nội Huế')!;
      const lySon = STOPS.find((s) => s.name === 'Đảo Lý Sơn')!;
      const eoGio = STOPS.find((s) => s.name === 'Eo Gió – Quy Nhơn')!;
      const nhaTrang = STOPS.find((s) => s.name === 'Vịnh Nha Trang')!;
      const muiNe = STOPS.find((s) => s.name === 'Đồi cát Mũi Né')!;

      expect(isNearEastCoast(haLong)).toBe(true);
      expect(isNearEastCoast(samSon)).toBe(true);
      expect(isNearEastCoast(thienCam)).toBe(true);
      expect(isNearEastCoast(hue)).toBe(true);
      expect(isNearEastCoast(lySon)).toBe(true);
      expect(isNearEastCoast(eoGio)).toBe(true);
      expect(isNearEastCoast(nhaTrang)).toBe(true);
      expect(isNearEastCoast(muiNe)).toBe(true);

      // Các điểm nội địa / miền núi phía Tây không phải bờ đông
      const lungCu = STOPS.find((s) => s.name === 'Cột cờ Lũng Cú')!;
      const sapa = STOPS.find((s) => s.name === 'Sa Pa – Fansipan')!;
      const langSen = STOPS.find((s) => s.name === 'Làng Sen (quê Bác)')!;

      expect(isNearEastCoast(lungCu)).toBe(false);
      expect(isNearEastCoast(sapa)).toBe(false);
      expect(isNearEastCoast(langSen)).toBe(false);
    });

    it('isLabelPlacedRight đặt nhãn phía biển (bên phải) cho các điểm gần bờ đông', () => {
      const lySon = STOPS.find((s) => s.name === 'Đảo Lý Sơn')!;
      const eoGio = STOPS.find((s) => s.name === 'Eo Gió – Quy Nhơn')!;
      const nhaTrang = STOPS.find((s) => s.name === 'Vịnh Nha Trang')!;

      expect(isLabelPlacedRight(lySon)).toBe(true);
      expect(isLabelPlacedRight(eoGio)).toBe(true);
      expect(isLabelPlacedRight(nhaTrang)).toBe(true);

      const bboxLySon = estimateLabelBBox(lySon);
      expect(bboxLySon.isRight).toBe(true);
      expect(bboxLySon.bbox.xMin).toBeGreaterThan(lySon.x);
    });

    it('computeVisibleStopLabels: luôn có điểm hiện tại và 2 điểm kề', () => {
      // Test ở đầu (điểm 1)
      const labelsAt1 = computeVisibleStopLabels(1);
      expect(labelsAt1.has(1)).toBe(true);
      expect(labelsAt1.has(2)).toBe(true);

      // Test ở giữa (điểm 18: Đèo Hải Vân)
      const labelsAt18 = computeVisibleStopLabels(18);
      expect(labelsAt18.has(18)).toBe(true);
      expect(labelsAt18.has(17)).toBe(true);
      expect(labelsAt18.has(19)).toBe(true);

      // Test ở cuối (điểm 32: Mũi Cà Mau)
      const labelsAt32 = computeVisibleStopLabels(32);
      expect(labelsAt32.has(32)).toBe(true);
      expect(labelsAt32.has(31)).toBe(true);
    });

    it('computeVisibleStopLabels: loại bỏ va chạm giữa các điểm rất sát nhau', () => {
      // Hồ Hoàn Kiếm (#7) và Văn Miếu (#8) cách nhau chỉ ~1.7 đơn vị toạ độ trên bản đồ
      // Khi đang xem ở điểm xa (ví dụ #1 Lũng Cú hoặc #32 Cà Mau), chỉ 1 trong 2 điểm được hiện nhãn
      const labelsAt1 = computeVisibleStopLabels(1);
      const hasHanoi7 = labelsAt1.has(7);
      const hasVanMieu8 = labelsAt1.has(8);
      expect(hasHanoi7 && hasVanMieu8, 'Hồ Hoàn Kiếm và Văn Miếu không được cùng hiện nhãn khi đang ở xa vì sẽ đè lên nhau').toBe(false);

      // Ngược lại, khi đang ở chính điểm #7 (Hồ Hoàn Kiếm), cả #7 và #8 (điểm kề) đều được hiện đầy đủ
      const labelsAt7 = computeVisibleStopLabels(7);
      expect(labelsAt7.has(7)).toBe(true);
      expect(labelsAt7.has(6)).toBe(true);
      expect(labelsAt7.has(8)).toBe(true);
    });

    it('tất cả các nhãn khác (ngoài 3 điểm kề) không va chạm bbox với nhau', () => {
      for (const curId of [1, 7, 18, 23, 32]) {
        const visibleIds = computeVisibleStopLabels(curId);
        const curIdx = STOPS.findIndex((s) => s.id === curId);
        const mandatoryIds = new Set([
          curId,
          ...(curIdx > 0 ? [STOPS[curIdx - 1].id] : []),
          ...(curIdx < STOPS.length - 1 ? [STOPS[curIdx + 1].id] : []),
        ]);

        const otherStops = STOPS.filter((s) => visibleIds.has(s.id) && !mandatoryIds.has(s.id));
        const otherBoxes = otherStops.map((s) => estimateLabelBBox(s).bbox);

        // Kiểm tra không có va chạm giữa các nhãn không bắt buộc
        for (let i = 0; i < otherBoxes.length; i++) {
          for (let j = i + 1; j < otherBoxes.length; j++) {
            const collides = checkBBoxCollision(otherBoxes[i], otherBoxes[j], 2);
            expect(collides, `Nhãn #${otherStops[i].id} và #${otherStops[j].id} không được đè lên nhau`).toBe(false);
          }
        }
      }
    });
  });
});
