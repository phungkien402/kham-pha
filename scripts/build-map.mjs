// Dựng src/explore/mua-hoa-viet/map/vietnam.json từ ranh giới 34 tỉnh (sau sáp nhập 2025).
// Nguồn: repo nguyenduy1133/Free-GIS-Data, file Provinces.geojson (có Hoàng Sa, Trường Sa).
// Chạy: node scripts/build-map.mjs  (cần mạng; file kết quả đã commit nên build thường không cần chạy lại)
import mapshaper from 'mapshaper';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = 'Vietnam Administrative Divisions (Post-2025) - Đơn vị hành chính Việt Nam (Từ 2025)';
const URL = `https://raw.githubusercontent.com/nguyenduy1133/Free-GIS-Data/main/${[DIR, 'Provinces.geojson']
  .map(encodeURIComponent)
  .join('/')}`;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/explore/mua-hoa-viet/map/vietnam.json');

// Giản lược giữ lại bao nhiêu phần điểm; keep-shapes để các đảo nhỏ ở hai quần đảo không biến mất.
const KEEP = process.argv[2] ?? '4%';
const PRECISION = 0.01; // độ; ~1 km, đủ cho bản đồ cỡ điện thoại

const res = await fetch(URL);
if (!res.ok) throw new Error(`Tải ranh giới lỗi ${res.status}: ${URL}`);
const input = Buffer.from(await res.arrayBuffer());

const run = async (cmd) => {
  const out = await mapshaper.applyCommands(cmd, { 'in.json': input });
  return JSON.parse(out['out.json'].toString());
};

const base = `-i in.json -simplify ${KEEP} keep-shapes -clean`;
const outline = await run(`${base} -dissolve -o out.json precision=${PRECISION} format=geojson`);
const borders = await run(`${base} -innerlines -o out.json precision=${PRECISION} format=geojson`);

// Gộp mọi hình học của kết quả thành một MultiPolygon / MultiLineString duy nhất.
const merge = (g, type) => {
  const geoms = g.features ? g.features.map((f) => f.geometry) : g.geometries ?? [g];
  const coordinates = geoms.flatMap((x) => (x.type === type ? x.coordinates : [x.coordinates]));
  return { type, coordinates };
};
const outlineGeom = merge(outline, 'MultiPolygon');
// d3-geo tính đa giác trên mặt cầu nên cần chiều quay vòng ngược với GeoJSON thường, nếu không phần "trong" thành cả địa cầu.
outlineGeom.coordinates = outlineGeom.coordinates.map((poly) => poly.map((ring) => ring.reverse()));
const data = { outline: outlineGeom, borders: merge(borders, 'MultiLineString') };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data));
const count = (g) => JSON.stringify(g.coordinates).split('],[').length;
console.log(`Ghi ${OUT}: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB, outline ${count(data.outline)} điểm, borders ${count(data.borders)} điểm`);
