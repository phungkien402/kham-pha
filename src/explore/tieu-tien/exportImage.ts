// src/explore/tieu-tien/exportImage.ts
// Xuất ảnh hoá đơn mua sắm thành ảnh PNG 1200×630 nền kem chuẩn chia sẻ

import type { VatPham, GioHang, ThongKeNhom } from './types';
import { formatVietnameseCurrency, formatVietnameseNumber } from './logic';

export interface ExportReceiptOptions {
  cart: GioHang;
  items: VatPham[];
  totalBudget: number;
  totalSpent: number;
  balance: number;
  breakdown: ThongKeNhom[];
}

export async function exportReceiptImage(options: ExportReceiptOptions): Promise<boolean> {
  const { cart, items, totalBudget, totalSpent, balance, breakdown } = options;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Đợi font Be Vietnam Pro nạp đầy đủ
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 1. Nền kem #faf8f5
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Tấm thẻ hoá đơn màu trắng bóng mờ
    const rx = 80;
    const ry = 40;
    const rw = 1040;
    const rh = 550;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 16);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#e6e1d9';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, 16);
    ctx.stroke();

    // 3. Header hoá đơn
    ctx.fillStyle = '#059669';
    ctx.font = '700 13px "Be Vietnam Pro", sans-serif';
    ctx.letterSpacing = '0.08em';
    ctx.fillText('HOÁ ĐƠN MÔ PHỎNG CHI TIÊU', rx + 40, ry + 42);

    ctx.fillStyle = '#1f1d1a';
    ctx.font = '800 28px "Be Vietnam Pro", sans-serif';
    ctx.fillText('1 ngày làm PNV (35,2 tỷ USD)', rx + 40, ry + 78);

    ctx.fillStyle = '#6b665f';
    ctx.font = '500 13px "Be Vietnam Pro", sans-serif';
    ctx.fillText('Ước tính Forbes ngày 10/10/2026 · Tỷ giá Vietcombank 25.660 đ/USD', rx + 40, ry + 102);

    // Đường gạch ngang đứt khúc
    ctx.strokeStyle = '#d6d0c7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(rx + 40, ry + 120);
    ctx.lineTo(rx + rw - 40, ry + 120);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Bố cục 2 cột: Cột trái (Danh sách món đã mua), Cột phải (Cơ cấu & Tổng kết)
    const colLeftW = 540;
    const colRightX = rx + colLeftW + 80;

    // Danh sách món đã mua
    const itemMap = new Map(items.map((it) => [it.id, it]));
    const boughtItems = Object.entries(cart)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => {
        const item = itemMap.get(id)!;
        return {
          item,
          count,
          total: count * (item ? item.gia : 0),
        };
      })
      .sort((a, b) => b.total - a.total);

    ctx.fillStyle = '#8c827a';
    ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText('CÁC MÓN ĐÃ CHI NHIỀU NHẤT', rx + 40, ry + 150);

    let startY = ry + 180;
    const maxShow = 6;
    const showItems = boughtItems.slice(0, maxShow);

    if (showItems.length === 0) {
      ctx.fillStyle = '#6b665f';
      ctx.font = 'italic 15px "Be Vietnam Pro", sans-serif';
      ctx.fillText('(Chưa chọn món nào)', rx + 40, startY + 20);
    } else {
      showItems.forEach(({ item, count, total }) => {
        ctx.fillStyle = '#1f1d1a';
        ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
        const nameText = `${item.emoji} ${item.ten}`;
        // Giới hạn độ dài tên
        const truncatedName = nameText.length > 28 ? nameText.slice(0, 27) + '…' : nameText;
        ctx.fillText(truncatedName, rx + 40, startY);

        ctx.fillStyle = '#6b665f';
        ctx.font = '500 13px "Be Vietnam Pro", sans-serif';
        const qtyText = `x${formatVietnameseNumber(count)} ${item.donVi}`;
        ctx.fillText(qtyText, rx + 320, startY);

        ctx.fillStyle = '#1f1d1a';
        ctx.font = '700 14px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(formatVietnameseCurrency(total, true), rx + colLeftW, startY);
        ctx.textAlign = 'left';

        startY += 34;
      });

      if (boughtItems.length > maxShow) {
        ctx.fillStyle = '#8c827a';
        ctx.font = 'italic 13px "Be Vietnam Pro", sans-serif';
        ctx.fillText(`...và ${boughtItems.length - maxShow} danh mục khác`, rx + 40, startY + 4);
      }
    }

    // 5. Cột phải: Cơ cấu chi theo nhóm & Tổng kết tài chính
    ctx.fillStyle = '#8c827a';
    ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText('CƠ CẤU THEO NHÓM', colRightX, ry + 150);

    let rightY = ry + 180;
    breakdown.forEach((group) => {
      ctx.fillStyle = '#1f1d1a';
      ctx.font = '600 14px "Be Vietnam Pro", sans-serif';
      ctx.fillText(group.tenNhom, colRightX, rightY);

      ctx.fillStyle = '#059669';
      ctx.font = '700 14px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${group.tyLe}%`, rx + rw - 40, rightY);
      ctx.textAlign = 'left';

      // Thanh phần trăm nhỏ
      const barW = rx + rw - 40 - colRightX;
      ctx.fillStyle = '#f3efe8';
      ctx.beginPath();
      ctx.roundRect(colRightX, rightY + 8, barW, 6, 3);
      ctx.fill();

      if (group.tyLe > 0) {
        const fillW = Math.max(6, (barW * group.tyLe) / 100);
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(colRightX, rightY + 8, fillW, 6, 3);
        ctx.fill();
      }

      rightY += 38;
    });

    // Đường gạch ngang ở cột phải
    ctx.strokeStyle = '#e6e1d9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(colRightX, rightY + 10);
    ctx.lineTo(rx + rw - 40, rightY + 10);
    ctx.stroke();

    rightY += 35;
    ctx.fillStyle = '#6b665f';
    ctx.font = '500 14px "Be Vietnam Pro", sans-serif';
    ctx.fillText('Tổng đã chi:', colRightX, rightY);
    ctx.fillStyle = '#dc2626';
    ctx.font = '800 18px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatVietnameseCurrency(totalSpent, true), rx + rw - 40, rightY);
    ctx.textAlign = 'left';

    rightY += 30;
    ctx.fillStyle = '#6b665f';
    ctx.font = '500 14px "Be Vietnam Pro", sans-serif';
    ctx.fillText('Số dư còn lại:', colRightX, rightY);
    ctx.fillStyle = '#059669';
    ctx.font = '800 18px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatVietnameseCurrency(balance, true), rx + rw - 40, rightY);
    ctx.textAlign = 'left';

    // 6. Chân hoá đơn: Dòng miễn trừ & watermark
    const footY = ry + rh - 42;
    ctx.strokeStyle = '#f0ebe4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx + 40, footY);
    ctx.lineTo(rx + rw - 40, footY);
    ctx.stroke();

    ctx.fillStyle = '#8c827a';
    ctx.font = '400 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText(
      'Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới.',
      rx + 40,
      footY + 24
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#059669';
    ctx.font = '600 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText('kham-pha.phungkien4002.workers.dev/tieu-tien', rx + rw - 40, footY + 24);
    ctx.textAlign = 'left';

    // 7. Chuyển canvas thành blob và chia sẻ / tải xuống
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) return false;

    const fileName = 'tieu-tien-pnv-hoa-don.png';
    const file = new File([blob], fileName, { type: 'image/png' });

    if (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] }) &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title: 'Hoá đơn 1 ngày làm PNV',
          text: `Tôi vừa tiêu ${formatVietnameseCurrency(totalSpent, true)} trong ngân sách 35,2 tỷ USD!`,
          files: [file],
        });
        return true;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return true;
      }
    }

    // Tải xuống file nếu không thể dùng Web Share API
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Lỗi xuất ảnh hoá đơn:', err);
    return false;
  }
}
