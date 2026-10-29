// src/explore/tieu-tien/step-tt.test.ts
// Kiểm thử các hàm thuần của trò chơi "1 ngày làm PNV" (/tieu-tien)

import { describe, it, expect } from 'vitest';
import vatPhamData from './data/vat-pham.json';
import type { VatPham, NganSachConfig, GioHang, LichSuHanhDong } from './types';
import {
  getTotalBudget,
  calculateTotalSpent,
  calculateBalance,
  canBuy,
  buyItem,
  sellItem,
  undoLastBuy,
  getHoldStep,
  getNewMilestones,
  calculateTimeRemaining,
  calculateCategoryBreakdown,
  formatVietnameseNumber,
  formatVietnameseDecimal,
  formatVietnameseCurrency,
  UNBUYABLE_ITEM_ID,
} from './logic';

const items = vatPhamData.vatPham as VatPham[];
const config = vatPhamData.nganSach as NganSachConfig;

describe('1. Ngân sách & Dữ liệu gốc', () => {
  it('tính đúng tổng ngân sách từ USD và tỷ giá', () => {
    const total = getTotalBudget(config);
    // 35.200.000.000 * 25.660 = 903.232.000.000.000
    expect(total).toBe(903232000000000);
  });

  it('dữ liệu gồm đủ 20 món và món cuối là Đường sắt tốc độ cao', () => {
    expect(items.length).toBe(20);
    const last = items[items.length - 1];
    expect(last.id).toBe('dstdc');
    expect(last.ten).toContain('Đường sắt tốc độ cao');
    expect(last.gia).toBeGreaterThan(getTotalBudget(config));
  });
});

describe('2. Mua / Bán (không âm, số nguyên)', () => {
  const traDa = items.find((it) => it.id === 'tra-da')!; // 4.000 đ
  const vf3 = items.find((it) => it.id === 'vf3')!; // 281.200.000 đ
  const dstdc = items.find((it) => it.id === 'dstdc')!; // 1.713 triệu tỷ

  it('không thể mua món vượt quá ngân sách hoặc dstdc', () => {
    const budget = getTotalBudget(config);
    expect(canBuy(dstdc, budget, 1, budget)).toBe(false);

    const res = buyItem({}, dstdc, 1, budget, budget);
    expect(res.success).toBe(false);
    expect(res.actualCount).toBe(0);
    expect(res.cost).toBe(0);
  });

  it('mua số lượng hợp lệ trong phạm vi số dư', () => {
    const cart: GioHang = {};
    const balance = 100000; // 100k
    const res = buyItem(cart, traDa, 5, balance); // 5 * 4k = 20k
    expect(res.success).toBe(true);
    expect(res.actualCount).toBe(5);
    expect(res.cost).toBe(20000);
    expect(res.newCart['tra-da']).toBe(5);

    const remaining = calculateBalance(balance, res.cost);
    expect(remaining).toBe(80000);
  });

  it('tự động kẹp số lượng mua (clamp) theo số dư, không bao giờ âm', () => {
    const cart: GioHang = {};
    const balance = 10000; // chỉ đủ mua 2 cốc trà đá (8.000 đ)
    const res = buyItem(cart, traDa, 10, balance);
    expect(res.success).toBe(true);
    expect(res.actualCount).toBe(2);
    expect(res.cost).toBe(8000);
    expect(res.newCart['tra-da']).toBe(2);

    const remaining = calculateBalance(balance, res.cost);
    expect(remaining).toBe(2000);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('từ chối mua với số lượng <= 0 hoặc không phải số nguyên', () => {
    const res0 = buyItem({}, traDa, 0, 100000);
    expect(res0.success).toBe(false);

    const resNeg = buyItem({}, traDa, -2, 100000);
    expect(resNeg.success).toBe(false);

    // canBuy cũng từ chối số thập phân/âm
    expect(canBuy(traDa, 100000, -1)).toBe(false);
    expect(canBuy(traDa, 100000, 1.5)).toBe(false);
  });

  it('bán món hàng đã mua, không thể bán âm hoặc bán quá số lượng có', () => {
    const cart: GioHang = { 'tra-da': 10 };
    const res = sellItem(cart, traDa, 3);
    expect(res.success).toBe(true);
    expect(res.actualCount).toBe(3);
    expect(res.refund).toBe(12000);
    expect(res.newCart['tra-da']).toBe(7);

    // Bán quá số lượng hiện có -> chỉ bán tối đa số đang có
    const resOver = sellItem(res.newCart, traDa, 20);
    expect(resOver.success).toBe(true);
    expect(resOver.actualCount).toBe(7);
    expect(resOver.refund).toBe(28000);
    expect(resOver.newCart['tra-da']).toBeUndefined();
  });

  it('từ chối bán khi giỏ không có món hoặc số lượng <= 0', () => {
    const resEmpty = sellItem({}, traDa, 1);
    expect(resEmpty.success).toBe(false);
    expect(resEmpty.actualCount).toBe(0);

    const resZero = sellItem({ 'tra-da': 5 }, traDa, 0);
    expect(resZero.success).toBe(false);
  });
});

describe('3. Hoàn tác món cuối (Undo last buy)', () => {
  const traDa = items.find((it) => it.id === 'tra-da')!;
  const vf3 = items.find((it) => it.id === 'vf3')!;

  it('hoàn tác hành động mua gần nhất đúng số lượng và giỏ hàng', () => {
    let cart: GioHang = {};
    let history: LichSuHanhDong[] = [];

    // Mua 5 trà đá
    const b1 = buyItem(cart, traDa, 5, 1000000);
    cart = b1.newCart;
    history.push({ itemId: 'tra-da', count: 5, gia: traDa.gia });

    // Mua 1 VF3
    const b2 = buyItem(cart, vf3, 1, 1000000000);
    cart = b2.newCart;
    history.push({ itemId: 'vf3', count: 1, gia: vf3.gia });

    expect(cart['tra-da']).toBe(5);
    expect(cart['vf3']).toBe(1);

    // Hoàn tác món cuối (VF3)
    const undo1 = undoLastBuy(cart, history);
    expect(undo1.undoneAction?.itemId).toBe('vf3');
    expect(undo1.undoneAction?.count).toBe(1);
    expect(undo1.newCart['vf3']).toBeUndefined();
    expect(undo1.newCart['tra-da']).toBe(5);
    expect(undo1.newHistory.length).toBe(1);

    // Hoàn tác tiếp trà đá
    const undo2 = undoLastBuy(undo1.newCart, undo1.newHistory);
    expect(undo2.undoneAction?.itemId).toBe('tra-da');
    expect(undo2.undoneAction?.count).toBe(5);
    expect(undo2.newCart['tra-da']).toBeUndefined();
    expect(undo2.newHistory.length).toBe(0);
  });

  it('hoàn tác khi lịch sử rỗng trả về an toàn', () => {
    const res = undoLastBuy({ 'tra-da': 2 }, []);
    expect(res.undoneAction).toBeNull();
    expect(res.newCart['tra-da']).toBe(2);
    expect(res.newHistory).toEqual([]);
  });
});

describe('4. Giữ nút tăng tốc (Hold-to-buy)', () => {
  it('tăng tốc theo các mốc thời gian giữ nút', () => {
    expect(getHoldStep(0)).toBe(1);
    expect(getHoldStep(500)).toBe(1);
    expect(getHoldStep(999)).toBe(1);
    expect(getHoldStep(1000)).toBe(10);
    expect(getHoldStep(1500)).toBe(10);
    expect(getHoldStep(2000)).toBe(100);
    expect(getHoldStep(3500)).toBe(100);
    expect(getHoldStep(4000)).toBe(1000);
    expect(getHoldStep(6000)).toBe(1000);
  });
});

describe('5. Mốc % (0,01% / 0,1% / 1% / 10%)', () => {
  const budget = getTotalBudget(config); // 903.232.000.000.000

  it('phát hiện đúng các mốc khi tổng chi vượt ngưỡng', () => {
    // 0 -> 0.005% : chưa tới mốc 0.01%
    const m0 = getNewMilestones(0, budget * 0.00005, budget);
    expect(m0.length).toBe(0);

    // Vượt mốc 0.01% (0.0001)
    const m1 = getNewMilestones(0, budget * 0.00015, budget);
    expect(m1.length).toBe(1);
    expect(m1[0].nhan).toBe('0,01%');

    // Tiếp tục tiêu và vượt qua mốc 0.1% (0.001)
    const m2 = getNewMilestones(budget * 0.00015, budget * 0.0012, budget);
    expect(m2.length).toBe(1);
    expect(m2[0].nhan).toBe('0,1%');

    // Tiêu một khoản lớn vượt luôn cả 1% và 10%
    const m3 = getNewMilestones(budget * 0.0012, budget * 0.15, budget);
    expect(m3.length).toBe(2);
    expect(m3.map((m) => m.nhan)).toEqual(['1%', '10%']);
  });

  it('không kích hoạt lại mốc đã vượt qua từ trước', () => {
    const m = getNewMilestones(budget * 0.02, budget * 0.03, budget);
    expect(m.length).toBe(0);
  });
});

describe('6. Thời gian tiêu hết ở 100 triệu / giây', () => {
  it('tính đúng số năm, ngày, giờ, phút, giây cho tổng ngân sách', () => {
    const budget = 903232000000000;
    const res = calculateTimeRemaining(budget, 100000000);
    // 903.232.000.000.000 / 100.000.000 = 9.032.320 giây
    expect(res.totalSeconds).toBe(9032320);
    // 9.032.320 / 86400 = 104,54 ngày (< 1 năm 365 ngày)
    expect(res.years).toBe(0);
    expect(res.days).toBe(104);
    expect(res.hours).toBe(12);
    expect(res.minutes).toBe(58);
    expect(res.seconds).toBe(40);
    expect(res.formattedText).toBe('104 ngày 12 giờ');
  });

  it('định dạng năm và ngày nếu số dư đủ lớn hơn 1 năm', () => {
    // 1 năm = 31.536.000 giây. Tại 100tr/s -> 3.153.600.000.000.000 đ
    // Giả sử có 4 năm:
    const largeBudget = 100000000 * 31536000 * 3 + 100000000 * 86400 * 15;
    const res = calculateTimeRemaining(largeBudget, 100000000);
    expect(res.years).toBe(3);
    expect(res.days).toBe(15);
    expect(res.formattedText).toBe('3 năm 15 ngày');
  });

  it('xử lý khi số dư về 0', () => {
    const res = calculateTimeRemaining(0, 100000000);
    expect(res.totalSeconds).toBe(0);
    expect(res.formattedText).toContain('0 giây');
  });
});

describe('7. Cơ cấu chi theo nhóm', () => {
  it('phân tích chính xác tổng tiền và tỷ lệ phần trăm theo 4 nhóm', () => {
    const traDa = items.find((it) => it.id === 'tra-da')!; // doi-thuong: 4.000
    const vf3 = items.find((it) => it.id === 'vf3')!; // xe-nha: 281.200.000
    const tramYTe = items.find((it) => it.id === 'tram-y-te')!; // cong-dong: 2.027.000.000
    const cau = items.find((it) => it.id === 'cau-dan-sinh')!; // ha-tang: 4.700.000.000

    const cart: GioHang = {
      'tra-da': 1000, // 4 triệu (doi-thuong)
      'vf3': 1, // 281,2 triệu (xe-nha)
      'tram-y-te': 1, // 2,027 tỷ (cong-dong)
      'cau-dan-sinh': 1, // 4,7 tỷ (ha-tang)
    };

    const breakdown = calculateCategoryBreakdown(cart, items);
    expect(breakdown.length).toBe(4);

    const doiThuong = breakdown.find((b) => b.nhom === 'doi-thuong')!;
    const xeNha = breakdown.find((b) => b.nhom === 'xe-nha')!;
    const congDong = breakdown.find((b) => b.nhom === 'cong-dong')!;
    const haTang = breakdown.find((b) => b.nhom === 'ha-tang')!;

    expect(doiThuong.tongTien).toBe(4000000);
    expect(xeNha.tongTien).toBe(281200000);
    expect(congDong.tongTien).toBe(2027000000);
    expect(haTang.tongTien).toBe(4700000000);

    const totalSpent = calculateTotalSpent(cart, items);
    expect(totalSpent).toBe(4000000 + 281200000 + 2027000000 + 4700000000);

    // Tổng tỷ lệ cộng lại xấp xỉ 100%
    const sumTyLe = breakdown.reduce((acc, b) => acc + b.tyLe, 0);
    expect(Math.round(sumTyLe)).toBe(100);
  });

  it('trả về 0% khi giỏ hàng rỗng', () => {
    const breakdown = calculateCategoryBreakdown({}, items);
    for (const b of breakdown) {
      expect(b.tongTien).toBe(0);
      expect(b.tyLe).toBe(0);
      expect(b.soMon).toBe(0);
    }
  });
});

describe('8. Định dạng số Việt (rút gọn "nghìn tỷ")', () => {
  it('định dạng số nguyên với dấu chấm hàng nghìn', () => {
    expect(formatVietnameseNumber(903232000000000)).toBe('903.232.000.000.000');
    expect(formatVietnameseNumber(5000)).toBe('5.000');
    expect(formatVietnameseNumber(0)).toBe('0');
  });

  it('định dạng số thập phân với dấu phẩy và dấu chấm', () => {
    expect(formatVietnameseDecimal(903.232)).toBe('903,232');
    expect(formatVietnameseDecimal(12.5)).toBe('12,5');
    expect(formatVietnameseDecimal(1000)).toBe('1.000');
  });

  it('định dạng đầy đủ có đuôi "đ"', () => {
    expect(formatVietnameseCurrency(4000)).toBe('4.000 đ');
    expect(formatVietnameseCurrency(281200000)).toBe('281.200.000 đ');
  });

  it('định dạng rút gọn các cấp: nghìn tỷ, tỷ, triệu, nghìn', () => {
    // >= 1.000.000.000.000 (10^12): nghìn tỷ
    expect(formatVietnameseCurrency(903232000000000, true)).toBe('903,232 nghìn tỷ đ');
    expect(formatVietnameseCurrency(1713000000000000, true)).toBe('1.713 nghìn tỷ đ');
    expect(formatVietnameseCurrency(1000000000000, true)).toBe('1 nghìn tỷ đ');

    // >= 10^9: tỷ
    expect(formatVietnameseCurrency(43700000000000, true)).toBe('43,7 nghìn tỷ đ'); // 43.700 tỷ = 43,7 nghìn tỷ
    expect(formatVietnameseCurrency(1900000000000, true)).toBe('1,9 nghìn tỷ đ');
    expect(formatVietnameseCurrency(853100000, false)).toBe('853.100.000 đ');

    // 2 tỷ đ:
    expect(formatVietnameseCurrency(2027000000, true)).toBe('2,03 tỷ đ');

    // >= 10^6: triệu
    expect(formatVietnameseCurrency(37990000, true)).toBe('37,99 triệu đ');

    // >= 100k: nghìn
    expect(formatVietnameseCurrency(105000, true)).toBe('105 nghìn đ');

    // < 100k: hiện số nguyên
    expect(formatVietnameseCurrency(4000, true)).toBe('4.000 đ');
  });
});
