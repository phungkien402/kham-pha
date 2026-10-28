// Kiểm chủ quyền Biển Đông trên dữ liệu ĐÃ SINH: chiếu ngược toạ độ km (LAEA tâm = centroid thực thể) về kinh/vĩ độ.
// Cần raw-data/*.geojson để biết tâm chiếu; không có thì bỏ qua.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { geoAzimuthalEqualArea } from 'd3-geo';
// @ts-ignore - file .mjs thuần JS
import { centroid, R } from '../../../scripts/size-data-lib.mjs';

const root = path.resolve(__dirname, '../../..');
const dataDir = path.join(__dirname, 'data');
const provFile = path.join(root, 'raw-data/Provinces.geojson');
const neFile = path.join(root, 'raw-data/ne_50m_admin_0_countries.geojson');
const haveRaw = fs.existsSync(provFile) && fs.existsSync(neFile);
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));

type Sub = { lng: number; lat: number; areaKm2: number };

/** Tách path "M..Z M..Z" thành các mảnh; mỗi mảnh trả về tâm (lng,lat) và diện tích phẳng km². */
function pieces(d: string, center: [number, number]): Sub[] {
  const inv = geoAzimuthalEqualArea().rotate([-center[0], -center[1]]).scale(R).translate([0, 0]).invert!;
  return d
    .split('M')
    .filter(Boolean)
    .map((seg) => {
      const pts = seg
        .replace('Z', '')
        .trim()
        .split('L')
        .map((p) => p.trim().split(/\s+/).map(Number) as [number, number]);
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        a += x1 * y2 - x2 * y1;
      }
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const [lng, lat] = inv([mx, my])!;
      return { lng, lat, areaKm2: Math.abs(a) / 2 };
    });
}

describe.skipIf(!haveRaw)('chủ quyền Biển Đông trong dữ liệu đã sinh', () => {
  const prov = JSON.parse(fs.readFileSync(provFile, 'utf8'));
  const vnCenter = centroid({
    type: 'MultiPolygon',
    coordinates: prov.features.flatMap((f: any) =>
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    ),
  }) as [number, number];
  const vnPieces = pieces(read('default.json')['viet-nam'], vnCenter);

  it('Việt Nam có mảnh ở Hoàng Sa (≈ lng 111–113, lat 15.7–17.2)', () => {
    const hs = vnPieces.filter((p) => p.lng >= 111 && p.lng <= 113 && p.lat >= 15.7 && p.lat <= 17.2);
    expect(hs.length).toBeGreaterThan(0);
  });
  it('Việt Nam có mảnh ở Trường Sa (≈ lng 111.5–117.5, lat 7–11.5)', () => {
    const ts = vnPieces.filter((p) => p.lng >= 111.5 && p.lng <= 117.5 && p.lat >= 7 && p.lat <= 11.5);
    expect(ts.length).toBeGreaterThan(0);
  });

  it('không entity nào ngoài Việt Nam có mảnh nhỏ (< 2.000 km²) trong lng 109–119, lat 6–18', () => {
    const ne = JSON.parse(fs.readFileSync(neFile, 'utf8'));
    const meta: any[] = read('meta.json');
    const chunks: Record<string, any> = {
      ...read('nuoc-pho-bien.json'),
      ...read('nuoc-khac.json'),
    };
    const bad: string[] = [];
    let checked = 0;
    for (const m of meta.filter((x) => x.type === 'nuoc')) {
      const d = chunks[m.id];
      if (!d) continue;
      const f = ne.features.find((x: any) => String(x.properties.ADM0_A3 ?? x.properties.ISO_A3).toLowerCase() === m.id);
      if (!f) continue;
      checked++;
      for (const p of pieces(d, centroid(f) as [number, number])) {
        if (p.lng >= 109 && p.lng <= 119 && p.lat >= 6 && p.lat <= 18 && p.areaKm2 < 2000) {
          bad.push(`${m.id} (${p.lng.toFixed(2)}, ${p.lat.toFixed(2)}) ${Math.round(p.areaKm2)} km²`);
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
    expect(bad).toEqual([]);
  });
});
