// Test bước 27 (bưu thiếp đóng góp): HTML đã build, màu tem, query params, điều kiện hiện thiệp.
// Logic nằm trong *.svelte (không export) nên trích đoạn mã từ source rồi chạy bằng Function.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import flowers from './data/flowers.json';
import { PROVINCES_BY_REGION } from './provinces';

const ROOT = join(__dirname, '..', '..', '..');
const DIST = join(ROOT, 'dist');
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
const hasDist = existsSync(join(DIST, 'mua-hoa-viet', 'index.html'));
const d = hasDist ? describe : describe.skip;

d('HTML đã build (dist/)', () => {
  const main = hasDist ? readFileSync(join(DIST, 'mua-hoa-viet', 'index.html'), 'utf8') : '';
  const daQuy = hasDist ? readFileSync(join(DIST, 'mua-hoa-viet', 'da-quy', 'index.html'), 'utf8') : '';

  it.each([
    ['trang chính', () => main],
    ['trang da-quy', () => daQuy],
  ])('%s không còn contribute-links / submit-photo-cta', (_n, get) => {
    expect(get()).not.toContain('contribute-links');
    expect(get()).not.toContain('submit-photo-cta');
  });

  it('không tải font Caveat / Google Fonts trong HTML, CSS, JS đã build', () => {
    const files: string[] = [
      join(DIST, 'mua-hoa-viet', 'index.html'),
      join(DIST, 'mua-hoa-viet', 'da-quy', 'index.html'),
    ];
    const astro = join(DIST, '_astro');
    if (existsSync(astro)) {
      for (const f of readdirSync(astro)) if (/\.(css|js)$/.test(f)) files.push(join(astro, f));
    }
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toContain('Caveat');
      expect(t, f).not.toContain('fonts.googleapis.com');
    }
  });

  it('trang loài có link /them-dia-diem?hoa=da-quy', () => {
    expect(daQuy).toMatch(/href="\/them-dia-diem\?hoa=da-quy"/);
  });

  it('mỗi trang loài đã build link tới /them-dia-diem?hoa=<slug của nó>', () => {
    for (const f of flowers as { slug: string }[]) {
      const p = join(DIST, 'mua-hoa-viet', f.slug, 'index.html');
      if (!existsSync(p)) continue;
      expect(readFileSync(p, 'utf8'), f.slug).toContain(`/them-dia-diem?hoa=${f.slug}`);
    }
  });

  it('trang chính có link /them-hoa (có thể kèm ?thang=)', () => {
    expect(main).toMatch(/href="\/them-hoa(\?thang=\d+[^"]*)?"/);
  });
});

// ---- Màu tem (Postcard.svelte) ----
type Rgb = [number, number, number];
function loadStamp() {
  const src = read('Postcard.svelte');
  const script = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
  const helpers = script.slice(script.indexOf('type Rgb'), script.indexOf('const stampPalette'));
  const derived = script.match(/const stampPalette = \$derived\.by\(\(\) => \{([\s\S]*?)\n  \}\);/)![1];
  const ts = `function __w(){${helpers}\nfunction stampPalette(color: string) {${derived}\n}\nreturn { stampPalette, contrastRatio, parseHex };}`;
  const js = transformSync(ts, { loader: 'ts' }).code;
  return new Function(`${js}; return __w();`)() as {
    stampPalette: (c: string) => { bg: string; border: string; icon: string };
    contrastRatio: (a: Rgb, b: Rgb) => number;
    parseHex: (h: string) => Rgb | null;
  };
}

describe('màu tem Postcard', () => {
  const { stampPalette: palette, contrastRatio, parseHex } = loadStamp();
  const list = flowers as { slug: string; color: string }[];
  const ratio = (c: string) => {
    const p = palette(c);
    return contrastRatio(parseHex(p.bg)!, parseHex(p.icon)!);
  };

  it('flowers.json có đủ 13 loài/màu', () => {
    expect(list).toHaveLength(13);
  });

  it.each(list.map((f) => [f.slug, f.color]))('icon trên nền tem của %s (%s) tương phản >= 3:1', (_s, color) => {
    expect(ratio(color)).toBeGreaterThanOrEqual(3);
  });

  it('không có màu → tem vàng mặc định, icon tương phản >= 3:1', () => {
    expect(ratio('')).toBeGreaterThanOrEqual(3);
  });

  it('màu rác không crash, rơi về tem vàng', () => {
    expect(palette('<script>')).toEqual(palette(''));
  });
});

// ---- Query params của form ----
// Vì các form gán lại biến (regions = [...]) nên cần cách lấy giá trị cuối: bọc trong hàm trả về state.
function runForm(file: string, init: Record<string, unknown>, search: string) {
  const src = read(file);
  const m = src.match(/const params = new URLSearchParams\(window\.location\.search\);\n([\s\S]*?)\n    \} catch/);
  expect(m, `không tìm thấy khối đọc query trong ${file}`).toBeTruthy();
  const names = Object.keys(init);
  const body = `let { ${names.join(', ')} } = init;\nconst params = new URLSearchParams(window.location.search);\n${m![1]}\nreturn { ${names.join(', ')} };`;
  const js = transformSync(`function __f(init, window, URLSearchParams){${body}}`, { loader: 'ts' }).code;
  const fn = new Function(`${js}; return __f;`)();
  return fn(structuredClone(init), { location: { search } }, URLSearchParams) as Record<string, any>;
}

describe('query params FlowerForm (?thang, ?mien)', () => {
  const mk = () => ({ seasons: [{ startMonth: 1, endMonth: 1 }], regions: [] as string[] });
  const F = 'forms/FlowerForm.svelte';

  it('?thang=10 điền tháng bắt đầu & kết thúc', () => {
    expect(runForm(F, mk(), '?thang=10').seasons).toEqual([{ startMonth: 10, endMonth: 10 }]);
  });
  it('?mien=bac điền vùng', () => {
    expect(runForm(F, mk(), '?mien=bac').regions).toEqual(['bac']);
  });
  it.each(['?thang=99', '?thang=0', '?thang=abc', '?thang=1.5', '?thang=-3'])('%s bị bỏ qua', (q) => {
    expect(runForm(F, mk(), q).seasons).toEqual([{ startMonth: 1, endMonth: 1 }]);
  });
  it.each(['?mien=<script>', '?mien=xyz', '?mien=BAC'])('%s bị bỏ qua', (q) => {
    expect(runForm(F, mk(), q).regions).toEqual([]);
  });
});

describe('query params PlaceForm (?hoa, ?mien)', () => {
  const mk = () => ({
    flowers: [{ slug: 'da-quy' }, { slug: 'sen' }],
    selectedFlowerSlugs: [] as string[],
    region: 'nam',
    province: PROVINCES_BY_REGION.nam[0],
    PROVINCES_BY_REGION,
  });
  const P = 'forms/PlaceForm.svelte';

  it('?hoa=da-quy chọn sẵn loài', () => {
    expect(runForm(P, mk(), '?hoa=da-quy').selectedFlowerSlugs).toEqual(['da-quy']);
  });
  it('?hoa=<script> / slug không tồn tại bị bỏ qua', () => {
    expect(runForm(P, mk(), '?hoa=<script>').selectedFlowerSlugs).toEqual([]);
    expect(runForm(P, mk(), '?hoa=khong-co').selectedFlowerSlugs).toEqual([]);
  });
  it('?mien=bac điền vùng và đổi tỉnh sang tỉnh thuộc vùng', () => {
    const s = runForm(P, mk(), '?mien=bac');
    expect(s.region).toBe('bac');
    expect(PROVINCES_BY_REGION.bac).toContain(s.province);
  });
  it('?mien=rác bị bỏ qua', () => {
    const base = mk();
    const s = runForm(P, mk(), '?mien=<script>');
    expect(s.region).toBe(base.region);
    expect(s.province).toBe(base.province);
  });
});

// ---- Điều kiện hiện thiệp #3 (overlay) / #4 (ô cuối lưới): kiểm tra biểu thức trong source ----
describe('điều kiện hiện thiệp', () => {
  const approved = read('ApprovedPhotos.svelte');
  const carousel = read('Carousel.svelte');

  it('#4 ô cuối lưới chỉ khi < 6 ảnh và có flowerSlug', () => {
    expect(approved).toMatch(/\{#if displayPhotos\.length < 6 && flowerSlug\}/);
    expect(approved).toMatch(/variant="tile"/);
  });
  it('#3 overlay chỉ khi ô đầu và chưa có ảnh thật', () => {
    expect(carousel).toMatch(/hasRealPhoto = \$derived\(\s*displayPhotos\.some\(\(p\) => Boolean\(p\.img\?\.src\)\)/);
    expect(carousel).toMatch(/i === 0 && !hasRealPhoto && flowerSlug/);
  });
});
