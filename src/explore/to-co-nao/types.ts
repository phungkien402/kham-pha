// src/explore/to-co-nao/types.ts
// Định nghĩa kiểu dữ liệu cho trang khám phá "Việt Nam to cỡ nào?" (/to-co-nao)

export type EntityType = 'tinh' | 'nuoc' | 'vn';
export type ChunkType = 'default' | 'vn' | 'nuoc-pho-bien' | 'nuoc-khac';

export interface EntityMeta {
  id: string; // "lam-dong", "bel", "viet-nam"
  name: string; // "Lâm Đồng", "Bỉ", "Việt Nam"
  enName: string; // "Lam Dong", "Belgium", "Vietnam"
  type: EntityType;
  area: number; // Diện tích km² làm tròn số nguyên
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY] toạ độ km cục bộ
  len: number; // Chiều dài theo trục chính (km)
  wid: number; // Chiều rộng theo trục chính (km)
  chunk: ChunkType;
  q: string; // Chuỗi tìm kiếm không dấu: tên VI + EN + tên cũ nếu có
}

export interface PlacedShape {
  id: string;
  x: number; // km
  y: number; // km
  rotation?: number; // độ xoay
  goc?: number;
  bbox?: [number, number, number, number];
}

export interface Viewport {
  cx: number; // km
  cy: number; // km
  scale: number; // px / km
}

export type ShapeChunk = Record<string, string>;

export interface ShapeColor {
  fill: string;
  stroke: string;
  border: string;
}

export const SHAPE_PALETTE: ShapeColor[] = [
  { fill: '#2563eb', stroke: '#1d4ed8', border: '#1e40af' }, // Blue
  { fill: '#dc2626', stroke: '#b91c1c', border: '#991b1b' }, // Crimson / Coral
  { fill: '#059669', stroke: '#047857', border: '#065f46' }, // Emerald / Forest Green
  { fill: '#d97706', stroke: '#b45309', border: '#92400e' }, // Amber / Gold
  { fill: '#7c3aed', stroke: '#6d28d9', border: '#5b21b6' }, // Purple / Violet
  { fill: '#0891b2', stroke: '#0e7490', border: '#155e75' }, // Cyan / Teal
];
