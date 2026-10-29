// src/explore/tieu-tien/logic.ts
// Các hàm thuần tính toán cho trò chơi "1 ngày làm PNV" (/tieu-tien)

import type {
  VatPham,
  NganSachConfig,
  GioHang,
  LichSuHanhDong,
  ThongKeNhom,
  Milestone,
  ThoiGianTieuHet,
  NhomVatPham,
} from './types';

export const UNBUYABLE_ITEM_ID = 'dstdc';

export const NHOM_NAMES: Record<NhomVatPham, string> = {
  'doi-thuong': 'Đời thường',
  'xe-nha': 'Xe & nhà',
  'cong-dong': 'Cộng đồng',
  'ha-tang': 'Hạ tầng',
};

export const MILESTONES: Milestone[] = [
  {
    id: 'm-001',
    tiLe: 0.0001, // 0.01%
    nhan: '0,01%',
    tieuDe: 'Đã tiêu 0,01% ngân sách',
    noiDung: 'Tương đương kinh phí xây mới hoặc nâng cấp khoảng 45 trạm y tế xã trên cả nước!',
  },
  {
    id: 'm-01',
    tiLe: 0.001, // 0.1%
    nhan: '0,1%',
    tieuDe: 'Đã tiêu 0,1% ngân sách',
    noiDung: 'Bằng một nửa kinh phí xây bệnh viện lớn cửa ngõ Tây Bắc TP.HCM (gần 1.900 tỷ đồng)!',
  },
  {
    id: 'm-1',
    tiLe: 0.01, // 1%
    nhan: '1%',
    tieuDe: 'Đã tiêu 1% ngân sách',
    noiDung: 'Đạt khoảng 9.032 tỷ đồng — đủ xây gần 2.000 cây cầu dân sinh miền núi cho bà con vùng khó khăn!',
  },
  {
    id: 'm-10',
    tiLe: 0.1, // 10%
    nhan: '10%',
    tieuDe: 'Đã tiêu 10% ngân sách',
    noiDung: 'Gấp hơn 2 lần tổng mức đầu tư của toàn bộ tuyến Metro số 1 Bến Thành – Suối Tiên (43.700 tỷ đồng)!',
  },
];

/**
 * Tính tổng ngân sách bằng VND từ snapshot USD và tỷ giá
 */
export function getTotalBudget(config: NganSachConfig): number {
  if (!config || !config.usd || !config.tyGia) return 0;
  return Math.round(config.usd * config.tyGia);
}

/**
 * Tính tổng số tiền đã tiêu từ giỏ hàng
 */
export function calculateTotalSpent(cart: GioHang, items: VatPham[]): number {
  if (!cart || !items || items.length === 0) return 0;
  const itemMap = new Map(items.map((it) => [it.id, it.gia]));
  let total = 0;
  for (const [id, count] of Object.entries(cart)) {
    if (count > 0) {
      const price = itemMap.get(id) || 0;
      total += Math.round(count) * price;
    }
  }
  return Math.max(0, Math.round(total));
}

/**
 * Tính số dư còn lại (không bao giờ âm)
 */
export function calculateBalance(totalBudget: number, totalSpent: number): number {
  return Math.max(0, Math.round(totalBudget) - Math.round(totalSpent));
}

/**
 * Kiểm tra xem có thể mua món hàng hay không
 */
export function canBuy(
  item: VatPham,
  balance: number,
  quantity = 1,
  totalBudget?: number
): boolean {
  if (!item || quantity <= 0 || !Number.isInteger(quantity)) return false;
  // Món đặc biệt không thể mua
  if (item.id === UNBUYABLE_ITEM_ID) return false;
  if (totalBudget !== undefined && item.gia > totalBudget) return false;
  const totalCost = item.gia * quantity;
  return balance >= totalCost;
}

/**
 * Mua vật phẩm (không để số dư âm, số lượng nguyên dương)
 */
export function buyItem(
  cart: GioHang,
  item: VatPham,
  quantity: number,
  balance: number,
  totalBudget?: number
): {
  newCart: GioHang;
  actualCount: number;
  cost: number;
  success: boolean;
} {
  const countInt = Math.floor(quantity);
  if (!item || countInt <= 0 || !Number.isFinite(countInt)) {
    return { newCart: { ...cart }, actualCount: 0, cost: 0, success: false };
  }

  if (item.id === UNBUYABLE_ITEM_ID || (totalBudget !== undefined && item.gia > totalBudget)) {
    return { newCart: { ...cart }, actualCount: 0, cost: 0, success: false };
  }

  const maxAffordable = Math.floor(balance / item.gia);
  const actualCount = Math.min(countInt, maxAffordable);

  if (actualCount <= 0) {
    return { newCart: { ...cart }, actualCount: 0, cost: 0, success: false };
  }

  const cost = actualCount * item.gia;
  const currentCount = cart[item.id] || 0;
  const newCart: GioHang = {
    ...cart,
    [item.id]: currentCount + actualCount,
  };

  return {
    newCart,
    actualCount,
    cost,
    success: true,
  };
}

/**
 * Bán vật phẩm (không âm, số lượng nguyên dương)
 */
export function sellItem(
  cart: GioHang,
  item: VatPham,
  quantity: number
): {
  newCart: GioHang;
  actualCount: number;
  refund: number;
  success: boolean;
} {
  const countInt = Math.floor(quantity);
  if (!item || countInt <= 0 || !Number.isFinite(countInt)) {
    return { newCart: { ...cart }, actualCount: 0, refund: 0, success: false };
  }

  const currentCount = cart[item.id] || 0;
  if (currentCount <= 0) {
    return { newCart: { ...cart }, actualCount: 0, refund: 0, success: false };
  }

  const actualCount = Math.min(countInt, currentCount);
  const refund = actualCount * item.gia;
  const nextCount = currentCount - actualCount;

  const newCart: GioHang = { ...cart };
  if (nextCount > 0) {
    newCart[item.id] = nextCount;
  } else {
    delete newCart[item.id];
  }

  return {
    newCart,
    actualCount,
    refund,
    success: true,
  };
}

/**
 * Hoàn tác hành động mua gần nhất
 */
export function undoLastBuy(
  cart: GioHang,
  history: LichSuHanhDong[]
): {
  newCart: GioHang;
  newHistory: LichSuHanhDong[];
  undoneAction: LichSuHanhDong | null;
} {
  if (!history || history.length === 0) {
    return { newCart: { ...cart }, newHistory: [], undoneAction: null };
  }

  const newHistory = [...history];
  const lastAction = newHistory.pop()!;
  const currentCount = cart[lastAction.itemId] || 0;
  const nextCount = Math.max(0, currentCount - lastAction.count);

  const newCart: GioHang = { ...cart };
  if (nextCount > 0) {
    newCart[lastAction.itemId] = nextCount;
  } else {
    delete newCart[lastAction.itemId];
  }

  return {
    newCart,
    newHistory,
    undoneAction: lastAction,
  };
}

/**
 * Bước nhảy khi giữ nút bấm theo thời gian (Hold-to-buy/sell)
 * Giữ < 1s: +1
 * 1s - 2s: +10
 * 2s - 4s: +100
 * >= 4s: +1000
 */
export function getHoldStep(elapsedMs: number): number {
  if (elapsedMs < 1000) return 1;
  if (elapsedMs < 2000) return 10;
  if (elapsedMs < 4000) return 100;
  return 1000;
}

/**
 * Kiểm tra các mốc % mới mở khi tổng chi tăng từ prevSpent lên newSpent
 */
export function getNewMilestones(
  prevSpent: number,
  newSpent: number,
  totalBudget: number
): Milestone[] {
  if (totalBudget <= 0 || newSpent <= prevSpent) return [];
  const prevRatio = prevSpent / totalBudget;
  const newRatio = newSpent / totalBudget;

  return MILESTONES.filter(
    (milestone) => prevRatio < milestone.tiLe && newRatio >= milestone.tiLe
  );
}

/**
 * Tính thời gian tiêu hết ngân sách nếu tiêu theo tốc độ cố định
 * Mặc định 100 triệu VND/giây (100_000_000)
 */
export function calculateTimeRemaining(
  balance: number,
  ratePerSecond = 100_000_000
): ThoiGianTieuHet {
  if (balance <= 0 || ratePerSecond <= 0) {
    return {
      totalSeconds: 0,
      years: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedText: '0 giây (đã tiêu hết)',
    };
  }

  const totalSeconds = Math.floor(balance / ratePerSecond);
  const SEC_PER_MINUTE = 60;
  const SEC_PER_HOUR = 3600;
  const SEC_PER_DAY = 86400;
  const SEC_PER_YEAR = 365 * SEC_PER_DAY;

  let remaining = totalSeconds;
  const years = Math.floor(remaining / SEC_PER_YEAR);
  remaining %= SEC_PER_YEAR;

  const days = Math.floor(remaining / SEC_PER_DAY);
  remaining %= SEC_PER_DAY;

  const hours = Math.floor(remaining / SEC_PER_HOUR);
  remaining %= SEC_PER_HOUR;

  const minutes = Math.floor(remaining / SEC_PER_MINUTE);
  const seconds = remaining % SEC_PER_MINUTE;

  let formattedText = '';
  if (years > 0) {
    formattedText = `${formatVietnameseNumber(years)} năm ${days} ngày`;
  } else if (days > 0) {
    formattedText = `${days} ngày ${hours} giờ`;
  } else if (hours > 0) {
    formattedText = `${hours} giờ ${minutes} phút`;
  } else if (minutes > 0) {
    formattedText = `${minutes} phút ${seconds} giây`;
  } else {
    formattedText = `${seconds} giây`;
  }

  return {
    totalSeconds,
    years,
    days,
    hours,
    minutes,
    seconds,
    formattedText,
  };
}

/**
 * Phân tích cơ cấu chi tiêu theo 4 nhóm
 */
export function calculateCategoryBreakdown(
  cart: GioHang,
  items: VatPham[]
): ThongKeNhom[] {
  const groups: NhomVatPham[] = ['doi-thuong', 'xe-nha', 'cong-dong', 'ha-tang'];
  const itemMap = new Map(items.map((it) => [it.id, it]));

  const totals: Record<NhomVatPham, { tongTien: number; soMon: number }> = {
    'doi-thuong': { tongTien: 0, soMon: 0 },
    'xe-nha': { tongTien: 0, soMon: 0 },
    'cong-dong': { tongTien: 0, soMon: 0 },
    'ha-tang': { tongTien: 0, soMon: 0 },
  };

  let grandTotal = 0;
  for (const [id, count] of Object.entries(cart)) {
    if (count > 0) {
      const item = itemMap.get(id);
      if (item) {
        const cost = Math.round(count) * item.gia;
        totals[item.nhom].tongTien += cost;
        totals[item.nhom].soMon += count;
        grandTotal += cost;
      }
    }
  }

  return groups.map((nhom) => {
    const { tongTien, soMon } = totals[nhom];
    const tyLe = grandTotal > 0 ? Math.round((tongTien / grandTotal) * 1000) / 10 : 0;
    return {
      nhom,
      tenNhom: NHOM_NAMES[nhom],
      tongTien,
      tyLe,
      soMon,
    };
  });
}

/**
 * Định dạng số nguyên tiếng Việt với dấu chấm ngăn cách hàng nghìn
 * Ví dụ: 903232000000000 -> "903.232.000.000.000"
 */
export function formatVietnameseNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const isNegative = n < 0;
  const abs = Math.abs(Math.round(n)).toString();
  const formatted = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Định dạng số thập phân tiếng Việt với dấu phẩy ngăn cách phần thập phân
 * và dấu chấm ngăn cách hàng nghìn.
 * Ví dụ: 903.232 -> "903,232" hoặc 12.5 -> "12,5"
 */
export function formatVietnameseDecimal(val: number, maxDecimals = 3): string {
  if (!Number.isFinite(val)) return '0';
  const isNegative = val < 0;
  const abs = Math.abs(val);

  const rounded = Number(abs.toFixed(maxDecimals));
  const [intPart, decPart] = rounded.toString().split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!decPart) {
    return isNegative ? `-${formattedInt}` : formattedInt;
  }
  return isNegative ? `-${formattedInt},${decPart}` : `${formattedInt},${decPart}`;
}

/**
 * Định dạng tiền tệ tiếng Việt:
 * - Đầy đủ: "903.232.000.000.000 đ"
 * - Rút gọn (compact):
 *   >= 1.000.000.000.000 (10^12): "903.232 nghìn tỷ đ" hoặc "X nghìn tỷ đ"
 *   >= 1.000.000.000 (10^9): "1.900 tỷ đ"
 *   >= 1.000.000 (10^6): "37,99 triệu đ"
 *   >= 1.000 (10^3): "105 nghìn đ"
 *   < 1.000: "4.000 đ"
 */
export function formatVietnameseCurrency(
  amount: number,
  compact = false
): string {
  if (!Number.isFinite(amount)) return '0 đ';
  const rounded = Math.round(amount);

  if (!compact) {
    return `${formatVietnameseNumber(rounded)} đ`;
  }

  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000) {
    // nghìn tỷ (10^12)
    const val = abs / 1_000_000_000_000;
    // Làm tròn tối đa 3 chữ số thập phân cho nghìn tỷ
    const formatted = formatVietnameseDecimal(val, 3);
    return `${sign}${formatted} nghìn tỷ đ`;
  }

  if (abs >= 1_000_000_000) {
    // tỷ (10^9)
    const val = abs / 1_000_000_000;
    const formatted = formatVietnameseDecimal(val, 2);
    return `${sign}${formatted} tỷ đ`;
  }

  if (abs >= 1_000_000) {
    // triệu (10^6)
    const val = abs / 1_000_000;
    const formatted = formatVietnameseDecimal(val, 2);
    return `${sign}${formatted} triệu đ`;
  }

  if (abs >= 100_000) {
    // nghìn (10^3) nếu từ 100 nghìn trở lên
    const val = abs / 1_000;
    const formatted = formatVietnameseDecimal(val, 0);
    return `${sign}${formatted} nghìn đ`;
  }

  return `${sign}${formatVietnameseNumber(abs)} đ`;
}
