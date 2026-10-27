import { geoMercator, geoPath } from 'd3-geo';
import data from './vietnam.json';

// Khung bản đồ tính từ chính dữ liệu (đất liền + Hoàng Sa + Trường Sa) rồi chừa lề,
// để không đảo nào bị cắt mép. Lề nam rộng hơn để chứa nhãn "Quần đảo Trường Sa" bên dưới.
const allPoints = (data.outline as { coordinates: number[][][][] }).coordinates.flatMap((poly) => poly[0]);
const EXTENT = {
  west: Math.min(...allPoints.map((p) => p[0])) - 0.35,
  east: Math.max(...allPoints.map((p) => p[0])) + 0.45,
  south: Math.min(...allPoints.map((p) => p[1])) - 0.9,
  north: Math.max(...allPoints.map((p) => p[1])) + 0.3,
};
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
// Hoàng Sa: nhãn bên phải quần đảo (phía biển trống), không đặt bên dưới vì sẽ lấn về bờ miền Trung.
// Trường Sa: nhãn căn giữa bên dưới quần đảo.
const [hsRight, hsTop] = at(hs.e, hs.n);
const [, hsBottom] = at(hs.e, hs.s);
const [tsCx, tsBottom] = at((ts.w + ts.e) / 2, ts.s);
export const labels: { text: string; x: number; y: number; anchor: 'start' | 'middle' }[] = [
  { text: 'Quần đảo Hoàng Sa', x: num(hsRight + 12), y: num((hsTop + hsBottom) / 2 + 6), anchor: 'start' },
  { text: 'Quần đảo Trường Sa', x: num(tsCx), y: num(tsBottom + 26), anchor: 'middle' },
];
export const islandBoxes = { hs, ts };
