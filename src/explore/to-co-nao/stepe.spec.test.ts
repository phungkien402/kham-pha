// Test bước E viết độc lập theo docs/to-co-nao-e-dac-ta.md: kỳ vọng tính thẳng từ bảng toạ độ trong đặc tả
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  STOPS,
  haversine,
  positionAt,
  regionAt,
  milestonesCrossed,
  CUMULATIVE_DISTANCES,
  TOTAL_ROUTE_KM,
  STRAIGHT_LINE_KM,
} from './docVietNam';
import { decodeUrlState, encodeUrlState } from './math';

// Bảng đặc tả: [tên, tỉnh, lat, lng]
const SPEC: [string, string, number, number][] = [
  ['Cột cờ Lũng Cú', 'Tuyên Quang', 23.364, 105.316],
  ['Hà Nội', 'Hà Nội', 21.028, 105.854],
  ['Tràng An', 'Ninh Bình', 20.253, 105.896],
  ['Thanh Hoá', 'Thanh Hóa', 19.807, 105.776],
  ['Vinh', 'Nghệ An', 18.673, 105.692],
  ['Phong Nha – Kẻ Bàng', 'Quảng Trị', 17.59, 106.283],
  ['Huế', 'Huế', 16.463, 107.59],
  ['Đèo Hải Vân', 'Đà Nẵng', 16.193, 108.13],
  ['Hội An', 'Đà Nẵng', 15.88, 108.335],
  ['Quy Nhơn', 'Gia Lai', 13.782, 109.219],
  ['Nha Trang', 'Khánh Hòa', 12.238, 109.196],
  ['Phan Thiết – Mũi Né', 'Lâm Đồng', 10.933, 108.102],
  ['TP. Hồ Chí Minh', 'TP.HCM', 10.776, 106.7],
  ['Cần Thơ', 'Cần Thơ', 10.034, 105.788],
  ['Mũi Cà Mau', 'Cà Mau', 8.6, 104.72],
];

// haversine tự viết, R = 6371
const hv = (a: number, b: number, c: number, d: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const expCum: number[] = [0];
for (let i = 1; i < SPEC.length; i++) {
  expCum.push(expCum[i - 1] + hv(SPEC[i - 1][2], SPEC[i - 1][3], SPEC[i][2], SPEC[i][3]));
}
const expTotal = expCum[expCum.length - 1];

describe('E1 — 15 điểm dừng', () => {
  it('đúng 15 điểm, đúng thứ tự, tên, tỉnh, toạ độ', () => {
    expect(STOPS).toHaveLength(15);
    SPEC.forEach(([name, prov, lat, lng], i) => {
      expect(STOPS[i].name, `tên #${i + 1}`).toBe(name);
      expect(STOPS[i].province, `tỉnh #${i + 1}`).toBe(prov);
      expect(STOPS[i].lat, `lat #${i + 1}`).toBeCloseTo(lat, 3);
      expect(STOPS[i].lng, `lng #${i + 1}`).toBeCloseTo(lng, 3);
    });
  });

  it('mỗi điểm có mô tả không rỗng và toạ độ km hữu hạn', () => {
    for (const s of STOPS) {
      expect(s.description.length).toBeGreaterThan(5);
      expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
    }
  });

  it('Lũng Cú ở phía Bắc (y nhỏ nhất) và Cà Mau ở phía Nam (y lớn nhất) trên bản đồ', () => {
    const ys = STOPS.map((s) => s.y);
    expect(ys[0]).toBe(Math.min(...ys));
    expect(ys[14]).toBe(Math.max(...ys));
  });
});

describe('E2 — haversine và km tích luỹ', () => {
  it('haversine khớp công thức R = 6371', () => {
    expect(haversine(21.028, 105.854, 10.776, 106.7)).toBeCloseTo(hv(21.028, 105.854, 10.776, 106.7), 3);
    expect(haversine(10, 100, 10, 100)).toBe(0);
  });

  it('Hà Nội – TP.HCM ≈ 1.140 ± 20 km', () => {
    const d = haversine(21.028, 105.854, 10.776, 106.7);
    expect(Math.abs(d - 1140)).toBeLessThanOrEqual(20);
  });

  it('km tích luỹ trong dữ liệu khớp tính độc lập (±1 km) và tăng ngặt', () => {
    expect(CUMULATIVE_DISTANCES).toHaveLength(15);
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

describe('E3 — positionAt', () => {
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

  it('km đơn điệu không giảm khi t tăng, lat không tăng (đi từ Bắc xuống Nam)', () => {
    let prevKm = -1;
    let prevLat = Infinity;
    for (let i = 0; i <= 400; i++) {
      const p = positionAt(i / 400);
      expect(p.km).toBeGreaterThanOrEqual(prevKm);
      expect(p.lat).toBeLessThanOrEqual(prevLat + 1e-9);
      prevKm = p.km;
      prevLat = p.lat;
    }
  });

  it('tại t đúng km của một điểm dừng, vị trí trùng điểm đó', () => {
    for (const i of [1, 5, 8, 12]) {
      const p = positionAt(expCum[i] / expTotal);
      expect(p.lat).toBeCloseTo(SPEC[i][2], 1);
      expect(p.lng).toBeCloseTo(SPEC[i][3], 1);
    }
  });

  it('segIndex nằm trong [0, 13] và không giảm', () => {
    let prev = 0;
    for (let i = 0; i <= 200; i++) {
      const s = positionAt(i / 200).segIndex;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(13);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe('E4 — regionAt theo đoạn', () => {
  const desc = (n: number) => regionAt(n).description;

  it('đoạn Lũng Cú → Hà Nội: miền núi phía Bắc → ĐBSH', () => {
    expect(desc(0)).toContain('Miền núi phía Bắc');
  });

  it('đoạn giữa Bắc Trung Bộ (Tràng An … Phong Nha) là Bắc Trung Bộ', () => {
    for (const s of [1, 2, 3, 4]) expect(desc(s), `seg ${s}`).toContain('Bắc Trung Bộ');
  });

  it('Hải Vân là ranh giới khí hậu', () => {
    expect(desc(7)).toContain('Hải Vân');
  });

  it('đoạn Quy Nhơn → Nha Trang là duyên hải Nam Trung Bộ', () => {
    expect(desc(9)).toContain('Nam Trung Bộ');
  });

  it('đoạn TP.HCM → Cần Thơ → Cà Mau là Nam Bộ', () => {
    expect(desc(12)).toContain('Nam Bộ');
    expect(desc(13)).toContain('Nam Bộ');
  });

  it('5 vùng khác nhau, mỗi vùng có màu badge riêng', () => {
    const ids = new Set([0, 3, 7, 9, 13].map((s) => regionAt(s).id));
    expect(ids.size).toBe(5);
    const colors = new Set([0, 3, 7, 9, 13].map((s) => regionAt(s).badgeColor));
    expect(colors.size).toBe(5);
  });

  it('theo điểm dừng (stopIndex): Huế (#7) thuộc Bắc Trung Bộ, Phan Thiết (#12) thuộc Nam Trung Bộ', () => {
    expect(regionAt({ stopIndex: 6 }).description).toContain('Bắc Trung Bộ');
    expect(regionAt({ stopIndex: 11 }).description).toContain('Nam Trung Bộ');
  });

  it('theo đoạn: Hải Vân → Hội An không bị gộp vào Nam Trung Bộ sớm / Hội An (#9) thuộc Nam Trung Bộ', () => {
    expect(regionAt({ stopIndex: 8 }).description).toContain('Nam Trung Bộ');
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
    for (let km = 1; km <= 2051; km++) count += milestonesCrossed(km - 1, km).length;
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

  it('đi tới rồi lùi rồi tới: mỗi lần vượt hàm thuần vẫn bắn (component phải tự chặn lặp trong lượt)', () => {
    // hàm thuần không nhớ trạng thái; kiểm tra component có cơ chế nhớ mốc đã bắn trong lượt
    const code = fs.readFileSync(path.resolve(__dirname, 'DocVietNam.svelte'), 'utf8');
    const hasMemory = /Set<|firedMilestones|shownMilestones|seenMilestones|maxKm|highestKm|maxReached/.test(code);
    expect(hasMemory, 'DocVietNam.svelte không nhớ mốc đã bắn → lùi rồi tiến sẽ bắn lại').toBe(true);
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
    const page = path.resolve(dir, '../../pages/to-co-nao/index.astro');
    if (fs.existsSync(page)) expect(fs.readFileSync(page, 'utf8')).not.toContain('IntroModal');
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

  it('?h= có id lạ / số rác bị bỏ qua, không ném lỗi', () => {
    const d = decodeUrlState('?h=zzz:1:2:3,viet-nam:a:b:c,jpn:1:2:3', (id) => id === 'jpn');
    expect(d.shapes.map((s) => s.id)).toEqual(['jpn']);
  });

  it('ToCoNao.svelte vẫn xử lý ?hanh-trinh= và ?h= và cuộn xuống bảng', () => {
    const c = fs.readFileSync(path.join(dir, 'ToCoNao.svelte'), 'utf8');
    expect(c).toContain('parseHanhTrinhUrl');
    expect(c).toContain('decodeUrlState');
    expect(c).toContain('scrollIntoView');
  });
});
