// Test bước E3 viết theo docs/to-co-nao-e3-dac-ta.md: kỳ vọng tính thẳng từ bảng toạ độ 32 điểm dừng trong đặc tả
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  STOPS,
  STOP_IMAGES,
  haversine,
  positionAt,
  regionAt,
  milestonesCrossed,
  CUMULATIVE_DISTANCES,
  TOTAL_ROUTE_KM,
  STRAIGHT_LINE_KM,
  NATIONAL_VIEWBOX,
  calculateZoomWindow,
  createAutoPlaySchedule,
  getAutoPlayStateAtTime,
} from './docVietNam';
import { decodeUrlState, encodeUrlState } from './math';

// Bảng 32 điểm dừng đặc tả E3: [tên, tỉnh, lat, lng, loại, wikiTitle]
const SPEC_32: [string, string, number, number, string, string][] = [
  ['Cột cờ Lũng Cú', 'Tuyên Quang', 23.364, 105.316, 'Lịch sử', 'Cột cờ Lũng Cú'],
  ['Đèo Mã Pì Lèng', 'Tuyên Quang', 23.239, 105.41, 'Núi', 'Mã Pì Lèng'],
  ['Ruộng bậc thang Hoàng Su Phì', 'Tuyên Quang', 22.7, 104.68, 'Núi', 'Hoàng Su Phì'],
  ['Sa Pa – Fansipan', 'Lào Cai', 22.336, 103.844, 'Núi', 'Phan Xi Păng'],
  ['Hồ Thác Bà', 'Lào Cai', 21.85, 105.0, 'Thiên nhiên', 'Hồ Thác Bà'],
  ['Đền Hùng', 'Phú Thọ', 21.367, 105.323, 'Lịch sử', 'Đền Hùng'],
  ['Hồ Hoàn Kiếm', 'Hà Nội', 21.028, 105.852, 'Lịch sử', 'Hồ Hoàn Kiếm'],
  ['Văn Miếu – Quốc Tử Giám', 'Hà Nội', 21.029, 105.836, 'Lịch sử', 'Văn Miếu – Quốc Tử Giám'],
  ['Vịnh Hạ Long', 'Quảng Ninh', 20.91, 107.184, 'Biển', 'Vịnh Hạ Long'],
  ['Tràng An', 'Ninh Bình', 20.253, 105.896, 'Thiên nhiên', 'Quần thể danh thắng Tràng An'],
  ['Thành nhà Hồ', 'Thanh Hóa', 20.077, 105.605, 'Lịch sử', 'Thành nhà Hồ'],
  ['Biển Sầm Sơn', 'Thanh Hóa', 19.734, 105.905, 'Biển', 'Sầm Sơn'],
  ['Làng Sen (quê Bác)', 'Nghệ An', 18.701, 105.535, 'Lịch sử', 'Kim Liên, Nam Đàn'],
  ['Biển Thiên Cầm', 'Hà Tĩnh', 18.243, 106.12, 'Biển', 'Thiên Cầm'],
  ['Phong Nha – Kẻ Bàng', 'Quảng Trị', 17.59, 106.283, 'Thiên nhiên', 'Vườn quốc gia Phong Nha – Kẻ Bàng'],
  ['Cầu Hiền Lương – sông Bến Hải', 'Quảng Trị', 17.003, 107.05, 'Lịch sử', 'Cầu Hiền Lương'],
  ['Đại Nội Huế', 'Huế', 16.469, 107.578, 'Lịch sử', 'Hoàng thành Huế'],
  ['Đèo Hải Vân', 'Đà Nẵng', 16.193, 108.13, 'Núi', 'Đèo Hải Vân'],
  ['Cầu Rồng – sông Hàn', 'Đà Nẵng', 16.061, 108.227, 'Thành phố', 'Cầu Rồng'],
  ['Phố cổ Hội An', 'Đà Nẵng', 15.88, 108.335, 'Lịch sử', 'Hội An'],
  ['Thánh địa Mỹ Sơn', 'Đà Nẵng', 15.764, 108.124, 'Lịch sử', 'Thánh địa Mỹ Sơn'],
  ['Đảo Lý Sơn', 'Quảng Ngãi', 15.38, 109.12, 'Biển', 'Lý Sơn'],
  ['Eo Gió – Quy Nhơn', 'Gia Lai', 13.88, 109.29, 'Biển', 'Quy Nhơn'],
  ['Gành Đá Đĩa', 'Đắk Lắk', 13.355, 109.296, 'Thiên nhiên', 'Gành Đá Đĩa'],
  ['Vịnh Nha Trang', 'Khánh Hòa', 12.238, 109.196, 'Biển', 'Vịnh Nha Trang'],
  ['Đà Lạt – hồ Xuân Hương', 'Lâm Đồng', 11.941, 108.441, 'Núi', 'Đà Lạt'],
  ['Đồi cát Mũi Né', 'Lâm Đồng', 10.933, 108.287, 'Thiên nhiên', 'Mũi Né'],
  ['Bến Nhà Rồng – TP.HCM', 'TP.HCM', 10.768, 106.707, 'Thành phố', 'Bến Nhà Rồng'],
  ['Địa đạo Củ Chi', 'TP.HCM', 11.142, 106.462, 'Lịch sử', 'Địa đạo Củ Chi'],
  ['Chợ nổi Cái Răng', 'Cần Thơ', 10.003, 105.746, 'Ẩm thực', 'Chợ nổi Cái Răng'],
  ['Rừng tràm Trà Sư', 'An Giang', 10.583, 105.058, 'Thiên nhiên', 'Rừng tràm Trà Sư'],
  ['Mũi Cà Mau', 'Cà Mau', 8.6, 104.72, 'Thiên nhiên', 'Mũi Cà Mau'],
];

// haversine độc lập, R = 6371
const hv = (a: number, b: number, c: number, d: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const expCum: number[] = [0];
for (let i = 1; i < SPEC_32.length; i++) {
  expCum.push(expCum[i - 1] + hv(SPEC_32[i - 1][2], SPEC_32[i - 1][3], SPEC_32[i][2], SPEC_32[i][3]));
}
const expTotal = expCum[expCum.length - 1];

describe('E1 — 32 điểm dừng theo đặc tả E3', () => {
  it('đúng 32 điểm, đúng thứ tự, tên, tỉnh, toạ độ, loại', () => {
    expect(STOPS).toHaveLength(32);
    SPEC_32.forEach(([name, prov, lat, lng, type, wikiTitle], i) => {
      expect(STOPS[i].name, `tên #${i + 1}`).toBe(name);
      expect(STOPS[i].province, `tỉnh #${i + 1}`).toBe(prov);
      expect(STOPS[i].lat, `lat #${i + 1}`).toBeCloseTo(lat, 3);
      expect(STOPS[i].lng, `lng #${i + 1}`).toBeCloseTo(lng, 3);
      expect(STOPS[i].type, `loại #${i + 1}`).toBe(type);
      expect(STOPS[i].wikiTitle, `wikiTitle #${i + 1}`).toBe(wikiTitle);
    });
  });

  it('mỗi điểm có mô tả và fact không rỗng, toạ độ km hữu hạn', () => {
    for (const s of STOPS) {
      expect(s.description.length).toBeGreaterThan(15);
      expect(s.fact.length).toBeGreaterThan(10);
      expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
    }
  });

  it('Lũng Cú ở phía Bắc (y nhỏ nhất) và Cà Mau ở phía Nam (y lớn nhất) trên bản đồ', () => {
    const ys = STOPS.map((s) => s.y);
    expect(ys[0]).toBe(Math.min(...ys));
    expect(ys[31]).toBe(Math.max(...ys));
  });
});

describe('E2 — haversine và km tích luỹ 32 điểm dừng', () => {
  it('haversine khớp công thức R = 6371', () => {
    expect(haversine(21.028, 105.852, 10.768, 106.707)).toBeCloseTo(hv(21.028, 105.852, 10.768, 106.707), 3);
    expect(haversine(10, 100, 10, 100)).toBe(0);
  });

  it('Hà Nội – TP.HCM ≈ 1.140 ± 20 km', () => {
    const d = haversine(21.028, 105.852, 10.768, 106.707);
    expect(Math.abs(d - 1140)).toBeLessThanOrEqual(20);
  });

  it('km tích luỹ trong dữ liệu khớp tính độc lập (±1 km) và tăng ngặt', () => {
    expect(CUMULATIVE_DISTANCES).toHaveLength(32);
    CUMULATIVE_DISTANCES.forEach((v, i) => {
      expect(Math.abs(v - expCum[i]), `cum[${i}]`).toBeLessThanOrEqual(1);
      if (i > 0) expect(v).toBeGreaterThan(CUMULATIVE_DISTANCES[i - 1]);
    });
    expect(Math.abs(TOTAL_ROUTE_KM - expTotal)).toBeLessThanOrEqual(1);
  });

  it('kmFromStart của điểm dừng khớp km tích luỹ (±1)', () => {
    STOPS.forEach((s, i) => expect(Math.abs(s.kmFromStart - expCum[i])).toBeLessThanOrEqual(1));
  });
});

describe('E3 — positionAt trên tuyến 32 điểm', () => {
  it('t=0 là Lũng Cú, km=0', () => {
    const p = positionAt(0);
    expect(p.km).toBe(0);
    expect(p.lat).toBeCloseTo(23.364, 3);
    expect(p.lng).toBeCloseTo(105.316, 3);
  });

  it('t=1 là Mũi Cà Mau, km ≈ tổng tuyến', () => {
    const p = positionAt(1);
    expect(p.lat).toBeCloseTo(8.6, 3);
    expect(p.lng).toBeCloseTo(104.72, 3);
    expect(Math.abs(p.km - expTotal)).toBeLessThanOrEqual(1);
  });

  it('t ngoài [0,1] bị kẹp', () => {
    expect(positionAt(-5).km).toBe(0);
    expect(positionAt(7).lat).toBeCloseTo(8.6, 3);
  });

  it('km đơn điệu không giảm khi t tăng', () => {
    let prevKm = -1;
    for (let i = 0; i <= 400; i++) {
      const p = positionAt(i / 400);
      expect(p.km).toBeGreaterThanOrEqual(prevKm);
      prevKm = p.km;
    }
  });

  it('tại t đúng km của một điểm dừng, vị trí trùng điểm đó', () => {
    for (const i of [0, 6, 16, 27, 31]) {
      const p = positionAt(expCum[i] / expTotal);
      expect(p.lat).toBeCloseTo(SPEC_32[i][2], 1);
      expect(p.lng).toBeCloseTo(SPEC_32[i][3], 1);
    }
  });

  it('segIndex nằm trong [0, 30] và không giảm', () => {
    let prev = 0;
    for (let i = 0; i <= 200; i++) {
      const s = positionAt(i / 200).segIndex;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(30);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe('E4 — regionAt theo đặc tả E3 (Bắc: 1–9, Bắc Trung Bộ: 10–17, Hải Vân: 18, Nam Trung Bộ: 19–27, Nam Bộ: 28–32)', () => {
  it('Bắc: 1–9', () => {
    for (let id = 1; id <= 9; id++) {
      expect(regionAt({ id }).id).toBe('mien-bac');
    }
  });

  it('Bắc Trung Bộ: 10–17', () => {
    for (let id = 10; id <= 17; id++) {
      expect(regionAt({ id }).id).toBe('bac-trung-bo');
    }
  });

  it('Hải Vân: 18', () => {
    expect(regionAt({ id: 18 }).id).toBe('hai-van');
  });

  it('Nam Trung Bộ: 19–27', () => {
    for (let id = 19; id <= 27; id++) {
      expect(regionAt({ id }).id).toBe('nam-trung-bo');
    }
  });

  it('Nam Bộ: 28–32', () => {
    for (let id = 28; id <= 32; id++) {
      expect(regionAt({ id }).id).toBe('nam-bo');
    }
  });

  it('5 vùng khác nhau, mỗi vùng có màu badge riêng', () => {
    const ids = new Set([1, 10, 18, 19, 28].map((id) => regionAt({ id }).id));
    expect(ids.size).toBe(5);
    const colors = new Set([1, 10, 18, 19, 28].map((id) => regionAt({ id }).badgeColor));
    expect(colors.size).toBe(5);
  });
});

describe('E5 — milestonesCrossed', () => {
  const kms = (a: number, b: number) => milestonesCrossed(a, b).map((m) => m.km);

  it('đúng 4 mốc 340/880/1070/1430 và lời so sánh có chữ "khoảng"', () => {
    const all = milestonesCrossed(0, 5000);
    expect(all.map((m) => m.km)).toEqual([340, 880, 1070, 1430]);
    all.forEach((m) => expect(m.comparison).toContain('khoảng'));
    expect(all[0].comparison).toContain('London');
    expect(all[0].comparison).toContain('Paris');
    expect(all[2].comparison).toContain('Bắc Kinh');
    expect(all[3].comparison).toContain('Rome');
  });

  it('bước nhỏ qua từng mốc chỉ bắn đúng 1 lần', () => {
    let count = 0;
    for (let km = 1; km <= 2806; km++) count += milestonesCrossed(km - 1, km).length;
    expect(count).toBe(4);
  });

  it('chạm đúng mốc (cur = mốc) thì tính, prev = mốc thì không bắn lại', () => {
    expect(kms(339, 340)).toEqual([340]);
    expect(kms(340, 341)).toEqual([]);
  });

  it('đi lùi không bắn gì', () => {
    expect(kms(900, 100)).toEqual([]);
    expect(kms(500, 500)).toEqual([]);
  });

  it('nhảy cóc nhiều mốc: đúng thứ tự tăng dần', () => {
    expect(kms(0, 1100)).toEqual([340, 880, 1070]);
    expect(kms(900, 2051)).toEqual([1070, 1430]);
  });
});

describe('E6 — đường thẳng Lũng Cú – Cà Mau', () => {
  it('trong 1.600–1.700 km, khớp tính độc lập', () => {
    const d = hv(23.364, 105.316, 8.6, 104.72);
    expect(d).toBeGreaterThanOrEqual(1600);
    expect(d).toBeLessThanOrEqual(1700);
    expect(Math.abs(STRAIGHT_LINE_KM - d)).toBeLessThanOrEqual(1);
  });

  it('đường thẳng ngắn hơn tuyến đi', () => {
    expect(STRAIGHT_LINE_KM).toBeLessThan(TOTAL_ROUTE_KM);
  });
});

describe('E7 — IntroModal đã bỏ, URL cũ vẫn chạy', () => {
  const dir = __dirname;
  it('IntroModal.svelte không còn, không file nào còn tham chiếu', () => {
    expect(fs.existsSync(path.join(dir, 'IntroModal.svelte'))).toBe(false);
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(svelte|ts)$/.test(f) || /test\.ts$/.test(f)) continue;
      const c = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(c, f).not.toContain('IntroModal');
      expect(c, f).not.toContain('tcn-intro-seen');
    }
  });

  it('?h= cũ vẫn decode đúng', () => {
    const d = decodeUrlState('?h=lam-dong:0:0:0,bel:120:-40:90', () => true);
    expect(d.shapes.map((s) => s.id)).toEqual(['lam-dong', 'bel']);
    expect(d.shapes[1].x).toBe(120);
    expect(d.shapes[1].y).toBe(-40);
    expect(d.shapes[1].rotation).toBe(90);
  });

  it('encode → decode khứ hồi, kèm z', () => {
    const q = encodeUrlState(
      [{ id: 'viet-nam', x: 10, y: 20, rotation: 45 } as any, { id: 'jpn', x: -5, y: 7, rotation: 0 } as any],
      1.5
    );
    const d = decodeUrlState('?' + q, () => true);
    expect(d.shapes.map((s) => s.id)).toEqual(['viet-nam', 'jpn']);
    expect(d.shapes[0].rotation).toBe(45);
  });

  it('ToCoNao.svelte vẫn xử lý ?hanh-trinh= và ?h= và cuộn xuống bảng', () => {
    const c = fs.readFileSync(path.join(dir, 'ToCoNao.svelte'), 'utf8');
    expect(c).toContain('parseHanhTrinhUrl');
    expect(c).toContain('decodeUrlState');
    expect(c).toContain('scrollIntoView');
  });
});

describe('E8 — calculateZoomWindow & chế độ Tự đi', () => {
  it('calculateZoomWindow tính đúng cửa sổ zoom: 0% và 100% = toàn quốc; giữa = ~450 km quanh điểm', () => {
    const startWin = calculateZoomWindow(0);
    expect(startWin).toEqual(NATIONAL_VIEWBOX);

    const endWin = calculateZoomWindow(1);
    expect(endWin).toEqual(NATIONAL_VIEWBOX);

    const midWin = calculateZoomWindow(0.5, { x: 100, y: 200 });
    expect(midWin.width).toBe(450);
    expect(midWin.x).toBe(100 - 225);
  });

  it('createAutoPlaySchedule và getAutoPlayStateAtTime hoạt động chính xác', () => {
    const schedule = createAutoPlaySchedule(STOPS, 60000, 1500);
    expect(schedule.stops.length).toBe(32);
    expect(schedule.travelDurationMs).toBe(60000);

    const s0 = getAutoPlayStateAtTime(0, schedule);
    expect(s0.progress).toBe(0);

    const sEnd = getAutoPlayStateAtTime(schedule.totalDurationMs + 10, schedule);
    expect(sEnd.progress).toBe(1);
    expect(sEnd.isFinished).toBe(true);
  });
});

describe('E9 — doc-vn-anh.json kiểm tra tính hợp lệ của toàn bộ ảnh', () => {
  it('mọi ảnh trong doc-vn-anh.json có tác giả, giấy phép, nguồn hợp lệ và file tồn tại trên đĩa', () => {
    const publicDir = path.resolve(__dirname, '../../../public/doc-vn');
    expect(fs.existsSync(publicDir)).toBe(true);

    const ALLOWED = /CC0|CC BY|CC BY-SA|Public domain|PD/i;

    for (let id = 1; id <= 32; id++) {
      const img = STOP_IMAGES[String(id)];
      expect(img, `Ảnh #${id}`).toBeDefined();
      expect(img.tacGia.length).toBeGreaterThan(2);
      expect(ALLOWED.test(img.giayPhep)).toBe(true);
      expect(img.nguon).toContain('wikimedia.org');

      const filePath = path.resolve(publicDir, `${id}.webp`);
      expect(fs.existsSync(filePath), `File ${filePath} phải tồn tại`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeLessThanOrEqual(180 * 1024);
    }
  });
});

describe('E10 — doc-vn-anh.json chặt chẽ hơn', () => {
  const publicDir = path.resolve(__dirname, '../../../public/doc-vn');
  const STRICT = /^(CC0|Public domain|CC BY(-SA)? \d\.\d)$/;

  it('đủ 32 khoá 1..32, không thừa, src khớp tên file', () => {
    expect(Object.keys(STOP_IMAGES).sort((a, b) => Number(a) - Number(b))).toEqual(
      Array.from({ length: 32 }, (_, i) => String(i + 1))
    );
    for (const [id, img] of Object.entries(STOP_IMAGES)) expect(img.src).toBe(`/doc-vn/${id}.webp`);
  });

  it('giấy phép khớp danh sách cho phép (CC0 / Public domain / CC BY[-SA] x.y)', () => {
    for (const [id, img] of Object.entries(STOP_IMAGES)) {
      expect(STRICT.test(img.giayPhep), `giấy phép #${id}: ${img.giayPhep}`).toBe(true);
    }
  });

  it('nguồn là trang File: của Commons, tác giả không chứa thẻ HTML, w/h hợp lệ', () => {
    for (const [id, img] of Object.entries(STOP_IMAGES)) {
      expect(img.nguon, `nguồn #${id}`).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(img.tacGia, `tác giả #${id}`).not.toMatch(/[<>]/);
      expect(img.w).toBeGreaterThan(0);
      expect(img.w).toBeLessThanOrEqual(960);
      expect(img.h).toBeGreaterThan(0);
    }
  });

  it('chỉ có 32 file ảnh trong public/doc-vn, tổng ≤ 4 MB', () => {
    const files = fs.readdirSync(publicDir);
    expect(files).toHaveLength(32);
    const total = files.reduce((n, f) => n + fs.statSync(path.join(publicDir, f)).size, 0);
    expect(total).toBeLessThanOrEqual(4 * 1024 * 1024);
  });
});

describe('E11 — cửa sổ zoom và lịch tự đi (bổ sung)', () => {
  it('zoom: ≥ 99% toàn quốc, 1% và 98% thu vào 450 km tâm tại điểm', () => {
    expect(calculateZoomWindow(0.99)).toEqual(NATIONAL_VIEWBOX);
    for (const t of [0.01, 0.5, 0.98]) {
      const w = calculateZoomWindow(t, { x: 10, y: -20 });
      expect(w.width).toBe(450);
      expect(w.x + w.width / 2).toBeCloseTo(10, 0);
      expect(w.y + w.height / 2).toBeCloseTo(-20, 0);
    }
  });

  it('lịch: tuyến 60 s, dừng 1,5 s mỗi điểm đến, mốc thời gian tăng đơn điệu', () => {
    const sch = createAutoPlaySchedule(STOPS, 60000, 1500);
    expect(sch.totalDurationMs).toBeCloseTo(60000 + 31 * 1500, 0);
    sch.stops.forEach((st, i) => {
      if (i === 0) return;
      expect(st.leaveMs - st.arriveMs).toBe(1500);
      expect(st.arriveMs).toBeGreaterThan(sch.stops[i - 1].leaveMs - 1e-6);
      expect(st.progress).toBeGreaterThan(sch.stops[i - 1].progress);
    });
    expect(sch.stops[31].progress).toBe(1);
  });

  it('tiến độ khi chạy không giảm; đang dừng giữ nguyên tiến độ của điểm; reduced-motion nhảy theo điểm', () => {
    const sch = createAutoPlaySchedule(STOPS, 60000, 1500);
    let prev = -1;
    for (let ms = 0; ms <= sch.totalDurationMs; ms += 250) {
      const st = getAutoPlayStateAtTime(ms, sch);
      expect(st.progress).toBeGreaterThanOrEqual(prev);
      prev = st.progress;
    }
    const a = sch.stops[5];
    const pause = getAutoPlayStateAtTime(a.arriveMs + 700, sch);
    expect(pause.isPaused).toBe(true);
    expect(pause.progress).toBe(a.progress);
    const rm = getAutoPlayStateAtTime((a.startTravelMs + a.arriveMs) / 2, sch, true);
    expect(rm.progress).toBe(sch.stops[4].progress);
  });
});
