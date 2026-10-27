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
const KEEP = process.argv[2] ?? '1.5%';
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
// Khung zoom từng vùng: hộp bao các tỉnh của vùng, chỉ phần đất liền và đảo gần bờ (bỏ Hoàng Sa, Trường Sa, bãi Tư Chính ở xa bờ: đa giác nằm hẳn phía đông kinh độ 109,6).
const REGIONS = {
  bac: ['Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Tuyên Quang', 'Lào Cai', 'Thái Nguyên', 'Phú Thọ', 'Bắc Ninh', 'Hưng Yên', 'Ninh Bình', 'Cao Bằng', 'Lạng Sơn', 'Lai Châu', 'Điện Biên', 'Sơn La'],
  trung: ['Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Trị', 'Huế', 'Đà Nẵng', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Đắk Lắk', 'Lâm Đồng'],
  nam: ['TP. Hồ Chí Minh', 'Đồng Nai', 'Tây Ninh', 'Cần Thơ', 'Vĩnh Long', 'Đồng Tháp', 'Cà Mau', 'An Giang'],
};
const raw = JSON.parse(input.toString());
// Lỗi dữ liệu nguồn: tỉnh Đồng Tháp (đồng bằng, vĩ độ < 15) bị ghi nhầm tên là "Lạng Sơn".
const nameOf = (f) => {
  const name = f.properties.TinhThanh;
  return name === 'Lạng Sơn' && f.geometry.coordinates[0][0][0][1] < 15 ? 'Đồng Tháp' : name;
};
const regions = {};
const seen = new Set();
for (const [key, names] of Object.entries(REGIONS)) {
  let w = 999, s = 999, e = -999, n = -999;
  for (const f of raw.features) {
    const name = nameOf(f);
    if (!names.includes(name)) continue;
    seen.add(name);
    for (const poly of f.geometry.coordinates) {
      if (Math.min(...poly[0].map((q) => q[0])) > 109.6) continue;
      for (const [x, y] of poly[0]) {
        w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
      }
    }
  }
  regions[key] = [w, s, e, n].map((v) => +v.toFixed(2));
}
const missing = Object.values(REGIONS).flat().filter((nm) => !seen.has(nm));
if (missing.length || seen.size !== raw.features.length) console.warn('Tên tỉnh không khớp:', missing, 'số tỉnh nguồn', raw.features.length);
const data = { outline: outlineGeom, borders: merge(borders, 'MultiLineString'), regions };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(data));
const count = (g) => JSON.stringify(g.coordinates).split('],[').length;
console.log(`Ghi ${OUT}: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB, outline ${count(data.outline)} điểm, borders ${count(data.borders)} điểm`);
