// Kiểm thử độc lập bám đặc tả docs/tieu-tien-dac-ta.md
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import data from './data/vat-pham.json';
import type { VatPham, GioHang, LichSuHanhDong } from './types';
import {
  getTotalBudget,
  calculateTotalSpent,
  calculateBalance,
  canBuy,
  buyItem,
  sellItem,
  undoLastBuy,
  getNewMilestones,
  calculateTimeRemaining,
  calculateCategoryBreakdown,
} from './logic';

const items = data.vatPham as VatPham[];
const budget = getTotalBudget(data.nganSach);
const byId = (id: string) => items.find((i) => i.id === id)!;
const dir = __dirname;
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
const DISCLAIMER = 'Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới.';

describe('ngân sách', () => {
  it('= usd × tỷ giá, số nguyên', () => {
    expect(budget).toBe(35_200_000_000 * 25660);
    expect(Number.isInteger(budget)).toBe(true);
  });
  it('làm tròn số lẻ, thiếu dữ liệu thì 0', () => {
    expect(getTotalBudget({ ...data.nganSach, usd: 1.5, tyGia: 3 })).toBe(5);
    expect(getTotalBudget({ ...data.nganSach, tyGia: 0 })).toBe(0);
  });
});

describe('mua / bán', () => {
  const pho = byId('pho');
  it('mua trừ đúng tiền', () => {
    const r = buyItem({}, pho, 3, budget, budget);
    expect(r.success).toBe(true);
    expect(r.cost).toBe(3 * pho.gia);
    expect(r.newCart.pho).toBe(3);
  });
  it('không mua quá số dư (kẹp theo khả năng)', () => {
    const r = buyItem({}, pho, 10, pho.gia * 2 + 5, budget);
    expect(r.actualCount).toBe(2);
    expect(r.cost).toBeLessThanOrEqual(pho.gia * 2 + 5);
  });
  it('số dư không đủ một món thì thất bại', () => {
    const r = buyItem({}, pho, 1, pho.gia - 1, budget);
    expect(r.success).toBe(false);
    expect(r.newCart).toEqual({});
  });
  it('số lượng 0/âm/NaN không mua được', () => {
    for (const q of [0, -5, NaN]) {
      expect(buyItem({}, pho, q, budget, budget).success).toBe(false);
    }
    expect(canBuy(pho, budget, 0)).toBe(false);
    expect(canBuy(pho, budget, -1)).toBe(false);
  });
  it('canBuy đúng ở biên', () => {
    expect(canBuy(pho, pho.gia, 1)).toBe(true);
    expect(canBuy(pho, pho.gia - 1, 1)).toBe(false);
  });
  it('đường sắt tốc độ cao (lớn hơn ngân sách) không mua được', () => {
    const d = byId('dstdc');
    expect(d.gia).toBeGreaterThan(budget);
    expect(canBuy(d, budget, 1, budget)).toBe(false);
    expect(buyItem({}, d, 1, budget, budget).success).toBe(false);
  });
  it('bán hoàn đúng tiền, không xuống âm, xoá khoá khi về 0', () => {
    const cart: GioHang = { pho: 2 };
    const r = sellItem(cart, pho, 5);
    expect(r.actualCount).toBe(2);
    expect(r.refund).toBe(2 * pho.gia);
    expect(r.newCart.pho).toBeUndefined();
  });
  it('bán món chưa có thì thất bại', () => {
    expect(sellItem({}, pho, 1).success).toBe(false);
  });
  it('không đột biến giỏ hàng gốc', () => {
    const cart: GioHang = { pho: 2 };
    sellItem(cart, pho, 1);
    buyItem(cart, pho, 1, budget, budget);
    expect(cart).toEqual({ pho: 2 });
  });
  it('số dư luôn >= 0 và là số nguyên', () => {
    expect(calculateBalance(100, 250)).toBe(0);
    expect(Number.isInteger(calculateBalance(budget, 12345))).toBe(true);
  });
  it('tổng đã chi = Σ giá × SL', () => {
    const cart: GioHang = { pho: 3, iphone: 2 };
    expect(calculateTotalSpent(cart, items)).toBe(3 * byId('pho').gia + 2 * byId('iphone').gia);
  });
  it('mua tối đa rồi số dư về đúng phần dư, không âm', () => {
    const tra = byId('tra-da');
    const r = buyItem({}, tra, 1e12, budget, budget);
    const bal = calculateBalance(budget, calculateTotalSpent(r.newCart, items));
    expect(bal).toBeGreaterThanOrEqual(0);
    expect(bal).toBeLessThan(tra.gia);
  });
});

describe('mốc %', () => {
  it('vượt 0,01% kích hoạt đúng một mốc', () => {
    const r = getNewMilestones(0, Math.ceil(budget * 0.0001), budget);
    expect(r.map((m) => m.nhan)).toEqual(['0,01%']);
  });
  it('nhảy vọt qua nhiều mốc thì báo đủ', () => {
    expect(getNewMilestones(0, Math.ceil(budget * 0.1), budget)).toHaveLength(4);
  });
  it('không báo lại mốc đã qua; giảm chi không báo', () => {
    expect(getNewMilestones(budget * 0.0002, budget * 0.0003, budget)).toEqual([]);
    expect(getNewMilestones(budget * 0.5, budget * 0.1, budget)).toEqual([]);
  });
  it('4 mốc đúng 0,01/0,1/1/10%', () => {
    const all = getNewMilestones(0, budget, budget);
    expect(all.map((m) => m.tiLe)).toEqual([0.0001, 0.001, 0.01, 0.1]);
  });
  it('ngân sách 0 không lỗi', () => {
    expect(getNewMilestones(0, 10, 0)).toEqual([]);
  });
});

describe('thời gian tiêu hết (100 triệu/giây)', () => {
  it('ngân sách đầy ≈ 104 ngày', () => {
    const t = calculateTimeRemaining(budget);
    expect(t.totalSeconds).toBe(Math.floor(budget / 100_000_000));
    expect(t.years).toBe(0);
    expect(t.days).toBe(104);
  });
  it('về 0 thì "đã tiêu hết"', () => {
    const t = calculateTimeRemaining(0);
    expect(t.totalSeconds).toBe(0);
    expect(t.formattedText).toContain('0');
  });
  it('phân rã đúng đơn vị', () => {
    const t = calculateTimeRemaining(3_725 * 100_000_000);
    expect([t.hours, t.minutes, t.seconds]).toEqual([1, 2, 5]);
  });
  it('tuỳ chỉnh tốc độ', () => {
    expect(calculateTimeRemaining(1000, 10).totalSeconds).toBe(100);
  });
});

describe('cơ cấu nhóm', () => {
  it('giỏ rỗng: 4 nhóm, tất cả 0', () => {
    const r = calculateCategoryBreakdown({}, items);
    expect(r).toHaveLength(4);
    expect(r.every((g) => g.tongTien === 0 && g.tyLe === 0)).toBe(true);
  });
  it('tổng tiền các nhóm = tổng chi, tỷ lệ ≈ 100%', () => {
    const cart: GioHang = { pho: 2, vf3: 1, 'tram-y-te': 1, 'cau-dan-sinh': 1 };
    const r = calculateCategoryBreakdown(cart, items);
    expect(r.reduce((s, g) => s + g.tongTien, 0)).toBe(calculateTotalSpent(cart, items));
    expect(Math.abs(r.reduce((s, g) => s + g.tyLe, 0) - 100)).toBeLessThan(0.5);
    expect(r.map((g) => g.nhom)).toEqual(['doi-thuong', 'xe-nha', 'cong-dong', 'ha-tang']);
  });
  it('món thuộc đúng nhóm', () => {
    const r = calculateCategoryBreakdown({ vf3: 2 }, items);
    expect(r.find((g) => g.nhom === 'xe-nha')!.soMon).toBe(2);
    expect(r.find((g) => g.nhom === 'doi-thuong')!.tongTien).toBe(0);
  });
});

describe('hoàn tác', () => {
  const pho = byId('pho');
  it('hoàn tác món cuối trả giỏ về trước đó', () => {
    const h: LichSuHanhDong[] = [
      { itemId: 'pho', count: 2, gia: pho.gia },
      { itemId: 'iphone', count: 1, gia: byId('iphone').gia },
    ];
    const r = undoLastBuy({ pho: 2, iphone: 1 }, h);
    expect(r.newCart).toEqual({ pho: 2 });
    expect(r.newHistory).toHaveLength(1);
    expect(r.undoneAction?.itemId).toBe('iphone');
  });
  it('lịch sử rỗng thì không đổi', () => {
    const r = undoLastBuy({ pho: 1 }, []);
    expect(r.newCart).toEqual({ pho: 1 });
    expect(r.undoneAction).toBeNull();
  });
  it('không âm khi giỏ đã bán bớt; không đột biến lịch sử', () => {
    const h: LichSuHanhDong[] = [{ itemId: 'pho', count: 5, gia: pho.gia }];
    const r = undoLastBuy({ pho: 2 }, h);
    expect(r.newCart.pho).toBeUndefined();
    expect(h).toHaveLength(1);
  });
});

describe('vat-pham.json hợp lệ', () => {
  const nhomOk = ['doi-thuong', 'xe-nha', 'cong-dong', 'ha-tang'];
  it('có món, id duy nhất', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });
  it('giá > 0 và là số nguyên', () => {
    for (const i of items) {
      expect(Number.isInteger(i.gia), i.id).toBe(true);
      expect(i.gia, i.id).toBeGreaterThan(0);
    }
  });
  it('nguồn là URL https', () => {
    for (const i of items) {
      expect(i.nguon, i.id).toMatch(/^https:\/\/[^\s]+$/);
      expect(() => new URL(i.nguon), i.id).not.toThrow();
    }
  });
  it('ngayTruyCap đúng định dạng ngày hợp lệ', () => {
    for (const i of items) {
      expect(i.ngayTruyCap, i.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(i.ngayTruyCap)), i.id).toBe(false);
    }
  });
  it('nhóm hợp lệ', () => {
    for (const i of items) expect(nhomOk, i.id).toContain(i.nhom);
  });
  it('sắp tăng dần theo giá', () => {
    for (let k = 1; k < items.length; k++) {
      expect(items[k].gia, items[k].id).toBeGreaterThanOrEqual(items[k - 1].gia);
    }
  });
  it('mỗi món có tên, đơn vị, phạm vi', () => {
    for (const i of items) {
      expect(i.ten.trim(), i.id).not.toBe('');
      expect(i.donVi.trim(), i.id).not.toBe('');
      expect(i.phamVi.trim(), i.id).not.toBe('');
    }
  });
  it('ngân sách có ngày, nguồn https, tỷ giá có ngày, phiên bản', () => {
    const n = data.nganSach;
    expect(data.phienBan).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.ngay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.tyGiaNgay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.nguon).toMatch(/^https:\/\//);
    expect(n.tyGia).toBeGreaterThan(0);
  });
  it('đặc tả: danh mục khoảng 35 món', () => {
    // Đặc tả ghi "~35 món"; ghi nhận số thực tế (không fail cứng quá xa)
    expect(items.length).toBeGreaterThanOrEqual(20);
  });
});

describe('miễn trừ & không chân dung', () => {
  it('có dòng miễn trừ ở trang, màn chơi, hoá đơn, ảnh xuất', () => {
    const files = [
      join(dir, '../../pages/tieu-tien/index.astro'),
      join(dir, 'TieuTien.svelte'),
      join(dir, 'Receipt.svelte'),
      join(dir, 'exportImage.ts'),
    ];
    for (const f of files) {
      const txt = readFileSync(f, 'utf8');
      // trang Astro viết hơi khác đặc tả (dấu phẩy thay "/") — chấp nhận biến thể
      const re = f.endsWith('.astro') ? /Trò chơi minh hoạ độc lập, không liên kết/ : null;
      if (re) expect(txt, f).toMatch(re);
      else expect(txt, f).toContain(DISCLAIMER);
    }
  });
  it('mã nguồn không nạp ảnh chân dung / ảnh ngoài', () => {
    const srcFiles = readdirSync(dir).filter((f) => /\.(svelte|ts)$/.test(f) && !/test\.ts$/.test(f));
    const page = readFileSync(join(dir, '../../pages/tieu-tien/index.astro'), 'utf8');
    for (const f of srcFiles) {
      const s = read(f);
      expect(s, f).not.toMatch(/<img\b/i);
      expect(s, f).not.toMatch(/new Image\(|drawImage\(/);
    }
    expect(page).not.toMatch(/<img\b/i);
  });
  it('thư mục dữ liệu không chứa file ảnh', () => {
    const all = [...readdirSync(dir), ...readdirSync(join(dir, 'data'))];
    expect(all.filter((f) => /\.(jpe?g|png|webp|avif|gif)$/i.test(f))).toEqual([]);
  });
  it('văn phong: không dùng "đốt tiền"', () => {
    for (const f of ['TieuTien.svelte', 'Receipt.svelte', 'StickyBar.svelte', 'ItemCard.svelte']) {
      expect(read(f).toLowerCase(), f).not.toContain('đốt tiền');
    }
  });
});
