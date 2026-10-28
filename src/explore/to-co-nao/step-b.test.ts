// Test cho bước B: Board, Shape, SearchBox, ToCoNao, trang Astro và pages.json
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../..');
const dir = path.resolve(__dirname);
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

describe('Bước B: các component và file theo đặc tả', () => {
  it('Shape.svelte có đủ các yêu cầu đặc tả', () => {
    const code = read('Shape.svelte');
    expect(code).toContain('fill-rule="evenodd"');
    expect(code).toContain('vector-effect="non-scaling-stroke"');
    expect(code).toContain('halo-indicator'); // Vòng hào quang khi < 12px
    expect(code).toContain('rotate-handle'); // Tay nắm xoay
    expect(code).toContain('pointer-events: none'); // Tắt hit test cho hình khác khi kéo
    // Phím tắt bàn phím
    expect(code).toContain('ArrowLeft');
    expect(code).toContain('ArrowRight');
    expect(code).toContain('ArrowUp');
    expect(code).toContain('ArrowDown');
    expect(code).toContain('[');
    expect(code).toContain(']');
    expect(code).toContain('Delete');
    expect(code).toContain('onCenterWithPrev');
  });

  it('Board.svelte có đủ các yêu cầu đặc tả', () => {
    const code = read('Board.svelte');
    expect(code).toContain('touch-action: none');
    expect(code).toContain('scaleBar'); // Thước tỉ lệ
    expect(code).toContain('zoomByFactor'); // Nút zoom + / -
    expect(code).toContain('onFitView'); // Nút vừa khung
    expect(code).toContain('board-camera'); // Transform dịch & scale
  });

  it('SearchBox.svelte có đủ các yêu cầu đặc tả', () => {
    const code = read('SearchBox.svelte');
    expect(code).toContain('role="combobox"');
    expect(code).toContain('role="listbox"');
    expect(code).toContain('searchEntities');
    expect(code).toContain('formatNumberVi'); // Hiện diện tích trong gợi ý
    expect(code).toContain('maxShapes'); // Giới hạn số lượng hình
  });

  it('ToCoNao.svelte khởi tạo 2 hình mặc định và các chức năng chính', () => {
    const code = read('ToCoNao.svelte');
    expect(code).toContain('lam-dong');
    expect(code).toContain('bel');
    expect(code).toContain('aria-live'); // Vùng đọc a11y
    expect(code).toContain('Chồng tâm');
    expect(code).toContain('Đặt cạnh nhau');
    expect(code).toContain('handleFitView');
    expect(code).toContain('prefetchVn');
  });

  it('src/pages/to-co-nao/index.astro dùng ExploreLayout và ghi nguồn', () => {
    const code = fs.readFileSync(path.join(ROOT, 'src/pages/to-co-nao/index.astro'), 'utf8');
    expect(code).toContain('ExploreLayout');
    expect(code).toContain('ToCoNao');
    expect(code).toContain('client:load');
    expect(code).toContain('Free-GIS-Data');
    expect(code).toContain('Natural Earth');
    expect(code).toContain('Hoàng Sa');
    expect(code).toContain('Trường Sa');
  });

  it('src/data/pages.json đăng ký to-co-nao trạng thái live', () => {
    const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages.json'), 'utf8'));
    const toCoNao = pages.find((p: any) => p.slug === 'to-co-nao');
    expect(toCoNao).toBeDefined();
    expect(toCoNao.title).toBe('Việt Nam to cỡ nào?');
    expect(toCoNao.status).toBe('live');
  });

  it('dist/to-co-nao/index.html đã build thành công', () => {
    const distPath = path.join(ROOT, 'dist/to-co-nao/index.html');
    expect(fs.existsSync(distPath)).toBe(true);
    const html = fs.readFileSync(distPath, 'utf8');
    expect(html).toContain('Việt Nam to cỡ nào?');
    expect(html).toContain('Free-GIS-Data');
    expect(html).toContain('Natural Earth');
  });
});
