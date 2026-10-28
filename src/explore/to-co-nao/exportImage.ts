// src/explore/to-co-nao/exportImage.ts
// Hàm xuất ảnh chụp bàn so sánh diện tích (canvas 1200×630 nền kem, PNG)

import type { PlacedShape, EntityMeta } from './types';
import { SHAPE_PALETTE } from './types';
import { fitView, formatNumberVi } from './math';

export interface ExportImageOptions {
  shapes: PlacedShape[];
  metaMap: Map<string, EntityMeta>;
  loadedShapes: Map<string, string>;
  comparisonText: string;
  entityA?: EntityMeta;
  entityB?: EntityMeta;
}

/**
 * Xuất ảnh snapshot bàn so sánh diện tích thành ảnh PNG 1200×630 nền kem:
 * - Tiêu đề câu so sánh và số liệu diện tích
 * - Các hình vẽ theo tỉ lệ phẳng bảo toàn diện tích (LAEA)
 * - Tự động mở menu chia sẻ file trên điện thoại (Web Share API) hoặc tải file to-co-nao.png trên máy tính
 */
export async function exportComparisonImage(options: ExportImageOptions): Promise<boolean> {
  const { shapes, metaMap, loadedShapes, comparisonText, entityA, entityB } = options;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Chờ font chữ được nạp đầy đủ
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 1. Nền kem #faf8f5 và khung viền nhẹ
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, 1200, 630);

    ctx.strokeStyle = '#e6e1d9';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, 1160, 590);

    // 2. Tiêu đề câu so sánh
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1f1d1a';
    ctx.font = '700 36px "Be Vietnam Pro", system-ui, -apple-system, sans-serif';
    const mainTitle = comparisonText || 'Việt Nam to cỡ nào?';
    ctx.fillText(mainTitle, 600, 65);

    // Dòng phụ: diện tích 2 thực thể
    if (entityA && entityB) {
      ctx.fillStyle = '#6b665f';
      ctx.font = '500 18px "Be Vietnam Pro", system-ui, -apple-system, sans-serif';
      const sub = `${entityA.name} (${formatNumberVi(entityA.area)} km²) so với ${entityB.name} (${formatNumberVi(entityB.area)} km²)`;
      ctx.fillText(sub, 600, 108);
    }

    // 3. Vùng vẽ các hình (khung giữa: 1040 × 370 px quanh tâm 600, 325)
    if (shapes.length > 0) {
      const areaW = 1040;
      const areaH = 370;
      const vp = fitView(shapes, areaW, areaH, 0.08, (id) => metaMap.get(id)?.bbox);

      const mapCenterX = 600;
      const mapCenterY = 325;

      shapes.forEach((shape, idx) => {
        const pathStr = loadedShapes.get(shape.id);
        if (!pathStr) return;

        const color = SHAPE_PALETTE[idx % SHAPE_PALETTE.length];
        const screenX = mapCenterX + (shape.x - vp.cx) * vp.scale;
        const screenY = mapCenterY + (shape.y - vp.cy) * vp.scale;
        const rot = shape.rotation ?? shape.goc ?? 0;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.scale(vp.scale, vp.scale);

        if (typeof Path2D !== 'undefined') {
          const path = new Path2D(pathStr);

          // Nền mờ 35%
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = color.fill;
          ctx.fill(path, 'evenodd');

          // Viền rõ nét
          ctx.globalAlpha = 1;
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 2 / vp.scale;
          ctx.lineJoin = 'round';
          ctx.stroke(path);
        }

        ctx.restore();
      });

      // Chú thích chấm màu và tên các hình
      const legendY = 535;
      const items = shapes.map((s, i) => ({
        name: metaMap.get(s.id)?.name || s.id,
        color: SHAPE_PALETTE[i % SHAPE_PALETTE.length].stroke,
      }));

      ctx.font = '600 15px "Be Vietnam Pro", system-ui, -apple-system, sans-serif';
      let totalLegendWidth = 0;
      const itemWidths = items.map((it) => {
        const w = ctx.measureText(it.name).width + 24;
        totalLegendWidth += w + 20;
        return w;
      });
      totalLegendWidth -= 20;

      let curX = 600 - totalLegendWidth / 2;
      items.forEach((it, i) => {
        // Chấm màu tròn
        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.arc(curX + 6, legendY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Tên thực thể
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.name, curX + 16, legendY);

        curX += itemWidths[i] + 20;
      });
    }

    // 4. Chân trang ghi nguồn và liên kết
    ctx.textBaseline = 'bottom';
    ctx.font = '500 14px "Be Vietnam Pro", system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#9ca3af';

    ctx.textAlign = 'left';
    ctx.fillText('Việt Nam to cỡ nào? · Phép chiếu Lambert Azimuthal Equal-Area', 40, 592);

    ctx.textAlign = 'right';
    ctx.fillText('kham-pha.phungkien4002.workers.dev/to-co-nao', 1160, 592);

    // 5. Tạo file blob PNG
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });

    if (!blob) return false;

    const fileName = 'to-co-nao.png';
    const file = new File([blob], fileName, { type: 'image/png' });

    // Web Share API nếu hỗ trợ chia sẻ tệp
    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          title: 'Việt Nam to cỡ nào?',
          text: comparisonText,
          files: [file],
        });
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') return true;
      }
    }

    // Dự phòng: tải ảnh trực tiếp
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    return true;
  } catch (err) {
    console.error('Lỗi khi xuất ảnh:', err);
    return false;
  }
}
