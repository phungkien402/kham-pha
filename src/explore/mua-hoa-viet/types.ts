import type { SeasonFlower } from './season';
import type { ResponsiveImage } from './images';

export type Region = 'bac' | 'trung' | 'nam';

/** Phần dữ liệu loài hoa mà trang chính cần (truyền vào island Svelte). */
export interface FlowerLite extends SeasonFlower {
  slug: string;
  name: string;
  color: string;
  regions: Region[];
  regionLabel: string;
  photo?: ResponsiveImage;
  photoAlt?: string;
}

export interface PlaceLite {
  slug: string;
  name: string;
  province: string;
  region: Region;
  flowers: { slug: string; best: string }[];
}
