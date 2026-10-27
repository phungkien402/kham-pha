// Ảnh hoa: file gốc nằm trong ./images, dữ liệu chỉ ghi tên file. Astro sinh nhiều cỡ lúc build.
import { getImage } from 'astro:assets';

const files = import.meta.glob<{ default: ImageMetadata }>('./images/*.{webp,jpg,jpeg,png}', { eager: true });

export interface ResponsiveImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

function find(name: string): ImageMetadata {
  const mod = files[`./images/${name}`];
  if (!mod) throw new Error(`Không tìm thấy ảnh ${name} trong src/explore/mua-hoa-viet/images/`);
  return mod.default;
}

/** Ảnh WebP nhiều cỡ (giữ tỉ lệ gốc); `width`/`height` là của cỡ nhỏ nhất, dùng để giữ chỗ. */
export async function responsive(name: string, widths: number[]): Promise<ResponsiveImage> {
  const meta = find(name);
  const img = await getImage({ src: meta, widths, format: 'webp', quality: 70 });
  const srcset = img.srcSet.attribute;
  return {
    // src dự phòng lấy cỡ nhỏ nhất (img.src là ảnh gốc, nặng)
    src: srcset.split(',')[0].trim().split(' ')[0],
    srcset,
    width: widths[0],
    height: Math.round((widths[0] * meta.height) / meta.width),
  };
}

/** Ảnh JPG 1200×630 cắt giữa cho og:image (Facebook/Zalo đọc JPG ổn định hơn WebP). */
export async function ogImage(name: string): Promise<string> {
  const img = await getImage({ src: find(name), width: 1200, height: 630, fit: 'cover', position: 'center', format: 'jpg' });
  return img.src;
}

export const SIZES = {
  hero: [600, 900, 1200],
  card: [176, 360, 520],
  grid: [320, 640],
  mini: [128, 192],
};
