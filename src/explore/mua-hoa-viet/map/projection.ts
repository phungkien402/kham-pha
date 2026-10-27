import { geoMercator, geoPath } from 'd3-geo';
import data from './vietnam.json';

// Khung bản đồ: dư phần Biển Đông ở phía đông và nam để hai quần đảo và nhãn không bị cắt mép.
const EXTENT = { west: 101.9, east: 117.2, south: 5.2, north: 23.8 };
export const WIDTH = 600;
const PAD = 8;

// MultiPoint (không dùng Polygon: đa giác cầu có chiều quay ngược sẽ thành "cả địa cầu trừ khung").
const frame = {
  type: 'MultiPoint' as const,
  coordinates: [
    [EXTENT.west, EXTENT.south],
    [EXTENT.east, EXTENT.north],
  ],
};

const projection = geoMercator().fitWidth(WIDTH - PAD * 2, frame).translate([0, 0]);
// fitWidth đặt translate theo mép; tính lại để khung bắt đầu từ (PAD, PAD).
const [x0, y0] = geoPath(projection).bounds(frame)[0];
projection.translate([projection.translate()[0] - x0 + PAD, projection.translate()[1] - y0 + PAD]);
const [, [x1, y1]] = geoPath(projection).bounds(frame);
export const HEIGHT = Math.ceil(y1 + PAD);

const path = geoPath(projection).digits(1);
const num = (n: number) => +n.toFixed(2);

export const outlinePath = path(data.outline as never) ?? '';
export const bordersPath = path(data.borders as never) ?? '';

/** Toạ độ điểm theo phần trăm khung bản đồ, để đặt nút HTML chồng lên ảnh SVG. */
export function toPercent(lat: number, lng: number): { x: number; y: number } {
  const [px, py] = projection([lng, lat]) ?? [0, 0];
  return { x: num((px / WIDTH) * 100), y: num((py / HEIGHT) * 100) };
}

// Hộp bao của từng quần đảo (đảo thuộc Đà Nẵng và Khánh Hòa nằm ngoài khơi): để đặt nhãn.
type Ring = number[][];
const polys = (data.outline as { coordinates: Ring[][] }).coordinates;
const islandBox = (test: (lng: number, lat: number) => boolean) => {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const p of polys) {
    const [lng, lat] = p[0][0];
    if (!test(lng, lat)) continue;
    for (const [x, y] of p[0]) {
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    }
  }
  return { w, e, s, n };
};
const hs = islandBox((lng, lat) => lng > 110.5 && lat > 15 && lat < 18);
const ts = islandBox((lng, lat) => lng > 110.5 && lat < 12.5);

const at = (lng: number, lat: number) => projection([lng, lat]) ?? [0, 0];
export const labels = [
  { text: 'Quần đảo Hoàng Sa', box: hs },
  { text: 'Quần đảo Trường Sa', box: ts },
].map(({ text, box }) => {
  const [cx, cy] = at((box.w + box.e) / 2, box.s);
  return { text, x: num(cx), y: num(cy + 14) };
});
export const islandBoxes = { hs, ts };
