import type { SeasonFlower } from './season';
import type { ResponsiveImage } from './images';

export type Region = 'bac' | 'trung' | 'nam';
/** Bộ lọc miền / vùng bản đồ: một vùng hoặc cả nước. */
export type Filter = 'all' | Region;

/** Phần dữ liệu loài hoa mà trang chính cần (truyền vào island Svelte). */
export interface FlowerLite extends SeasonFlower {
  slug: string;
  name: string;
  color: string;
  regions: Region[];
  regionLabel: string;
  photo?: ResponsiveImage;
  photoAlt?: string;
  places?: { slug: string; best: string }[];
}

export interface PlaceLite {
  slug: string;
  name: string;
  province: string;
  region: Region;
  flowers: { slug: string; best: string }[];
  /** Vị trí trên bản đồ (phần trăm); bỏ qua nếu điểm chưa có toạ độ. */
  x?: number;
  y?: number;
  maps_url?: string;
}

/** Một điểm ngắm trên bản đồ; x, y là phần trăm theo khung bản đồ. */
export interface MapSpot {
  slug: string;
  name: string;
  province: string;
  x: number;
  y: number;
  maps_url?: string;
  flowers: { slug: string; name: string; color: string; best: string }[];
}
