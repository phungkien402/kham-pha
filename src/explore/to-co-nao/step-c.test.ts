// Test cho bước C: Thanh dưới (Footer), Kèo kinh điển, Ngẫu nhiên, URL, xuất ảnh PNG, thẻ + OG
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SHAPE_PALETTE } from './types';
import { PRESET_MATCHES, pickRandomMatch } from './math';
import { meta } from './dataLoader';
import { exportComparisonImage } from './exportImage';

const ROOT = path.resolve(__dirname, '../../..');
const dir = path.resolve(__dirname);
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

describe('Bước C: Thanh dưới (Footer.svelte)', () => {
  it('Footer.svelte có đủ các thành phần theo đặc tả', () => {
    const code = read('Footer.svelte');

    // 1. Câu so sánh lớn
    expect(code).toContain('comparison-banner');
    expect(code).toContain('comparison-title');
    expect(code).toContain('comparison-sub');

    // 2. Kèo kinh điển và ngẫu nhiên
    expect(code).toContain('PRESET_MATCHES');
    expect(code).toContain('Kèo kinh điển');
    expect(code).toContain('Ngẫu nhiên');
    expect(code).toContain('onRandomMatch');
    expect(code).toContain('onSelectPreset');

    // 3. Các nút tác vụ: Chồng tâm, Đặt cạnh nhau, Chia sẻ link, Tải ảnh
    expect(code).toContain('Chồng tâm');
    expect(code).toContain('Đặt cạnh nhau');
    expect(code).toContain('Chia sẻ link');
    expect(code).toContain('Tải ảnh');
    expect(code).toContain('onOverlayCenters');
    expect(code).toContain('onSideBySide');
    expect(code).toContain('onShareLink');
    expect(code).toContain('onExportImage');

    // 4. Danh sách hình: chấm màu, tên, km², dài × rộng, nút xoá
    expect(code).toContain('chip-dot');
    expect(code).toContain('chip-name');
    expect(code).toContain('chip-area');
    expect(code).toContain('chip-dim'); // Dài × rộng theo trục chính (km)
    expect(code).toContain('chip-remove-btn');
    expect(code).toContain('onDeleteShape');
    expect(code).toContain('onSelectShape');
  });

  it('ToCoNao.svelte tích hợp Footer và quản lý state bước C', () => {
    const code = read('ToCoNao.svelte');
    expect(code).toContain('Footer');
    expect(code).toContain('handleSelectPreset');
    expect(code).toContain('handleRandomMatch');
    expect(code).toContain('handleShareLink');
    expect(code).toContain('handleExportImage');
    expect(code).toContain('exportComparisonImage');

    // URL replaceState debounce 300ms
    expect(code).toContain('replaceState');
    expect(code).toContain('decodeUrlState');
    expect(code).toContain('encodeUrlState');
    expect(code).toContain('300');

    // Tôn trọng prefers-reduced-motion
    expect(code).toContain('prefers-reduced-motion');
  });
});

describe('Bước C: Xuất ảnh (exportImage.ts)', () => {
  it('hàm exportComparisonImage xuất khẩu hợp lệ và an toàn với môi trường phi trình duyệt', async () => {
    expect(typeof exportComparisonImage).toBe('function');
    // Khi chạy trong Node không có window/document, hàm trả về false an toàn không throw lỗi
    const result = await exportComparisonImage({
      shapes: [],
      metaMap: new Map(),
      loadedShapes: new Map(),
      comparisonText: 'Lâm Đồng ≈ 0,8 lần Bỉ',
    });
    expect(result).toBe(false);
  });

  it('mã nguồn exportImage.ts tuân thủ quy chuẩn canvas 1200×630 nền kem', () => {
    const code = read('exportImage.ts');
    expect(code).toContain('1200');
    expect(code).toContain('630');
    expect(code).toContain('#faf8f5'); // Nền kem
    expect(code).toContain('to-co-nao.png');
    expect(code).toContain('document.fonts.ready');
    expect(code).toContain('canShare'); // Web Share API
    expect(code).toContain('download'); // Fallback download
  });
});

describe('Bước C: Độ tương phản bảng màu 6 hình ≥ 3:1 với nền kem', () => {
  function getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const a = [r, g, b].map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function getContrast(hex1: string, hex2: string): number {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const max = Math.max(l1, l2);
    const min = Math.min(l1, l2);
    return (max + 0.05) / (min + 0.05);
  }

  const bgCream = '#faf8f5';

  it('cả 6 màu có viền và stroke tương phản ≥ 3:1 với nền kem', () => {
    expect(SHAPE_PALETTE).toHaveLength(6);
    SHAPE_PALETTE.forEach((color, i) => {
      const strokeContrast = getContrast(color.stroke, bgCream);
      const borderContrast = getContrast(color.border, bgCream);
      expect(strokeContrast).toBeGreaterThanOrEqual(3.0);
      expect(borderContrast).toBeGreaterThanOrEqual(3.0);
    });
  });
});

describe('Bước C: Thẻ trang chủ và ảnh OG riêng cho /to-co-nao', () => {
  const ogPath = path.join(ROOT, 'public/og/to-co-nao.png');
  const cardPath = path.join(ROOT, 'public/cards/to-co-nao.webp');

  it('ảnh public/og/to-co-nao.png tồn tại và có kích thước đúng 1200×630', async () => {
    expect(fs.existsSync(ogPath)).toBe(true);
    const meta = await sharp(ogPath).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
    expect(meta.format).toBe('png');
  });

  it('ảnh public/cards/to-co-nao.webp tồn tại và có kích thước 500×320', async () => {
    expect(fs.existsSync(cardPath)).toBe(true);
    const meta = await sharp(cardPath).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(320);
    expect(meta.format).toBe('webp');
  });

  it('trang src/pages/to-co-nao/index.astro cấu hình ogImage="/og/to-co-nao.png"', () => {
    const astroCode = fs.readFileSync(path.join(ROOT, 'src/pages/to-co-nao/index.astro'), 'utf8');
    expect(astroCode).toContain('ogImage="/og/to-co-nao.png"');
  });
});
