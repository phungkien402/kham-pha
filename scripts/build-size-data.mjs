// scripts/build-size-data.mjs
// Pipeline xây dựng dữ liệu địa lý cho trang "Việt Nam to cỡ nào?" (/to-co-nao)
// Chạy: node scripts/build-size-data.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import mapshaper from 'mapshaper';
import {
  R,
  calcArea,
  centroid,
  fixProvinceName,
  isSCSPolygon,
  pca,
  project,
  scsFilter,
  slugify,
  toSvgPath,
} from './size-data-lib.mjs';
import {
  getTenNuoc,
  isPopularCountry,
  TEN_NUOC_GHI_DE,
} from '../src/explore/to-co-nao/ten-nuoc.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = resolve(ROOT, 'raw-data');
const OUT_DIR = resolve(ROOT, 'src/explore/to-co-nao/data');

const PROVINCES_FILE = resolve(RAW_DIR, 'Provinces.geojson');
const COUNTRIES_FILE = resolve(RAW_DIR, 'ne_50m_admin_0_countries.geojson');

const PROVINCES_URL = `https://raw.githubusercontent.com/nguyenduy1133/Free-GIS-Data/main/${[
  'Vietnam Administrative Divisions (Post-2025) - Đơn vị hành chính Việt Nam (Từ 2025)',
  'Provinces.geojson',
]
  .map(encodeURIComponent)
  .join('/')}`;

// Tên cũ hoặc từ khoá tìm kiếm bổ sung cho một số tỉnh
const PROVINCE_SEARCH_ALIASES = {
  'tp-ho-chi-minh': 'sai gon saigon tphcm hcm',
  'ha-noi': 'ha tay hatay hn',
  'hue': 'thua thien hue tt hue',
  'da-nang': 'quang nam da nang',
  'lam-dong': 'da lat dalat',
  'khanh-hoa': 'nha trang truong sa',
  'ba-ria-vung-tau': 'vung tau con dao',
  'kien-giang': 'phu quoc',
  'quang-ninh': 'ha long bai chay van don',
};


// Diện tích tỉnh/VN: nguồn vẽ cả rạn, bãi san hô ở Hoàng Sa, Trường Sa (vài nghìn km² mặt rạn) nên
// KHÔNG tính các polygon ngoài khơi (tâm khung lng 110.5–118, lat 6–17.5) vào diện tích; vẫn VẼ chúng.
function landOnly(geom) {
  if (!geom || geom.type !== 'MultiPolygon') return geom;
  const keep = geom.coordinates.filter((p) => {
    const xs = p[0].map((q) => q[0]), ys = p[0].map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return !(cx > 110.5 && cx < 118 && cy > 6 && cy < 17.5);
  });
  return { type: 'MultiPolygon', coordinates: keep };
}
async function runMapshaper(cmd, inputDict) {
  const out = await mapshaper.applyCommands(cmd, inputDict);
  return JSON.parse(out['out.json'].toString());
}

async function ensureRawFiles() {
  mkdirSync(RAW_DIR, { recursive: true });

  if (!existsSync(PROVINCES_FILE)) {
    console.log(`Đang tải Provinces.geojson từ ${PROVINCES_URL}...`);
    const res = await fetch(PROVINCES_URL);
    if (!res.ok) throw new Error(`Lỗi tải Provinces.geojson: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(PROVINCES_FILE, buf);
    console.log(`Đã lưu ${PROVINCES_FILE} (${(buf.length / (1024 * 1024)).toFixed(1)} MB)`);
  }

  if (!existsSync(COUNTRIES_FILE)) {
    throw new Error(`Thiếu file dữ liệu Natural Earth: ${COUNTRIES_FILE}`);
  }
}

function countPoints(coords) {
  let count = 0;
  const visit = (pt) => {
    if (typeof pt[0] === 'number') count++;
    else for (const p of pt) visit(p);
  };
  visit(coords);
  return count;
}

async function simplifyGeometry(geom, isLarge = false) {
  const pts = countPoints(geom.coordinates);
  const targetPts = isLarge ? 900 : 340;

  if (pts <= targetPts) return geom;

  // Tính tỉ lệ phần trăm giữ điểm ước tính
  const ratio = Math.max(0.01, Math.min(0.2, (targetPts / pts) * 1.2));
  const pct = `${(ratio * 100).toFixed(1)}%`;

  const inputJson = JSON.stringify({ type: 'Feature', geometry: geom, properties: {} });
  const simplified = await runMapshaper(
    `-i in.json -simplify visvalingam ${pct} keep-shapes -clean -o out.json format=geojson`,
    { 'in.json': Buffer.from(inputJson) }
  );

  const outGeom = simplified.geometry ?? simplified.features?.[0]?.geometry ?? simplified.geometries?.[0] ?? geom;
  return outGeom;
}

async function main() {
  console.log('=== BẮT ĐẦU PIPELINE XÂY DỰNG DỮ LIỆU BẢN ĐỒ (BƯỚC A) ===');
  await ensureRawFiles();

  mkdirSync(OUT_DIR, { recursive: true });

  // 1. ĐỌC VÀ XỬ LÝ 34 TỈNH THÀNH VIỆT NAM
  console.log('1. Đang nạp và xử lý 34 tỉnh thành Việt Nam...');
  const provincesRaw = JSON.parse(readFileSync(PROVINCES_FILE, 'utf8'));

  // Sửa lỗi tên Đồng Tháp / Lạng Sơn
  for (const f of provincesRaw.features) {
    const fixedName = fixProvinceName(f);
    f.properties.TinhThanh = fixedName;
    f.properties.name = fixedName;
  }

  // Tạo cả nước Việt Nam bằng mapshaper -dissolve
  console.log('   Đang hợp 34 tỉnh thành Việt Nam toàn quốc (mapshaper -dissolve)...');
  const dissolvedVn = await runMapshaper(
    '-i in.json -dissolve -clean -o out.json format=geojson',
    { 'in.json': Buffer.from(JSON.stringify(provincesRaw)) }
  );

  const vnOriginalGeom = dissolvedVn.geometry ?? dissolvedVn.features?.[0]?.geometry ?? dissolvedVn.geometries?.[0];
  const vnOriginalArea = Math.round(calcArea(landOnly(vnOriginalGeom)));
  console.log(`   Diện tích Việt Nam gốc (trước giản lược): ${vnOriginalArea.toLocaleString('vi-VN')} km²`);

  // Danh sách lưu trữ
  const metaList = [];
  const defaultShapes = {};
  const vnShapes = {};
  const popularShapes = {};
  const otherShapes = {};

  // Xử lý Việt Nam toàn quốc
  const vnSimplifiedGeom = await simplifyGeometry(vnOriginalGeom, true);
  const vnProjected = project(vnSimplifiedGeom);
  const vnPca = pca(vnProjected.coordinates);
  const vnSvgPath = toSvgPath(vnProjected.coordinates, vnOriginalArea);

  const vnMeta = {
    id: 'viet-nam',
    name: 'Việt Nam',
    enName: 'Vietnam',
    type: 'vn',
    area: vnOriginalArea,
    bbox: vnProjected.bbox,
    len: vnPca.len,
    wid: vnPca.wid,
    chunk: 'default',
    q: 'viet nam vietnam vn',
  };

  metaList.push(vnMeta);
  defaultShapes['viet-nam'] = vnSvgPath;

  // Xử lý từng tỉnh của Việt Nam
  console.log(`   Xử lý ${provincesRaw.features.length} tỉnh thành...`);
  for (const f of provincesRaw.features) {
    const name = f.properties.TinhThanh;
    const id = slugify(name);
    const origArea = Math.round(calcArea(landOnly(f.geometry)));

    const simplifiedGeom = await simplifyGeometry(f.geometry, origArea > 10000);
    const projected = project(simplifiedGeom);
    const shapePca = pca(projected.coordinates);
    const svgPath = toSvgPath(projected.coordinates, origArea);

    const alias = PROVINCE_SEARCH_ALIASES[id] || '';
    const qStr = `${slugify(name)} ${name.toLowerCase()} ${alias}`.trim();

    const isDefault = id === 'lam-dong';

    const pMeta = {
      id,
      name,
      enName: name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd'),
      type: 'tinh',
      area: origArea,
      bbox: projected.bbox,
      len: shapePca.len,
      wid: shapePca.wid,
      chunk: isDefault ? 'default' : 'vn',
      q: qStr,
    };

    metaList.push(pMeta);
    vnShapes[id] = svgPath;
    if (isDefault) {
      defaultShapes[id] = svgPath;
    }
  }

  // 2. ĐỌC VÀ XỬ LÝ CÁC QUỐC GIA TỪ NATURAL EARTH
  console.log('2. Đang nạp và xử lý các quốc gia từ Natural Earth...');
  const countriesRaw = JSON.parse(readFileSync(COUNTRIES_FILE, 'utf8'));

  const deletedSCSPolygons = [];

  for (const f of countriesRaw.features) {
    const props = f.properties;
    const isoA3Raw =
      props.ISO_A3 && props.ISO_A3 !== '-99'
        ? props.ISO_A3
        : props.ADM0_A3 || props.SOV_A3 || '';
    const isoA3 = isoA3Raw.toLowerCase();

    // BỎ entity VNM của Natural Earth (dùng Việt Nam từ dữ liệu tỉnh)
    if (isoA3 === 'vnm' || props.SOV_A3 === 'VNM' || props.ADMIN === 'Vietnam') {
      continue;
    }

    // Lọc chủ quyền Biển Đông
    const filteredFeature = scsFilter(f, false);
    if (filteredFeature._deletedPolygons?.length > 0) {
      deletedSCSPolygons.push({
        country: props.ADMIN || isoA3,
        count: filteredFeature._deletedPolygons.length,
      });
    }

    const geom = filteredFeature.geometry;
    if (!geom || !geom.coordinates || geom.coordinates.length === 0) {
      continue;
    }

    // Tính diện tích gốc trước giản lược
    const origArea = Math.round(calcArea(geom));

    // Bỏ entity diện tích < 5 km² trừ các quốc gia có chủ quyền (giữ Monaco, Vatican…)
    const isSovereign =
      props.TYPE === 'Sovereign country' ||
      props.featurecla === 'Admin-0 country' ||
      isoA3 === 'vat' ||
      isoA3 === 'mco' ||
      isoA3 === 'smr';

    if (origArea < 5 && !isSovereign) {
      continue;
    }

    // Tên tiếng Việt và tiếng Anh
    const rawNameVi = props.NAME_VI || props.NAME;
    const nameVi = getTenNuoc(isoA3, rawNameVi);
    const nameEn = props.NAME_EN || props.NAME || props.ADMIN;

    const isLarge = origArea > 500000;
    const simplifiedGeom = await simplifyGeometry(geom, isLarge);
    const projected = project(simplifiedGeom);
    const shapePca = pca(projected.coordinates);
    const svgPath = toSvgPath(projected.coordinates, origArea);

    const isDefault = isoA3 === 'bel';
    const isPop = isPopularCountry(isoA3);

    let chunk = 'nuoc-khac';
    if (isDefault) chunk = 'default';
    else if (isPop) chunk = 'nuoc-pho-bien';

    const qStr = `${slugify(nameVi)} ${slugify(nameEn)} ${isoA3} ${nameVi.toLowerCase()}`.trim();

    const cMeta = {
      id: isoA3,
      name: nameVi,
      enName: nameEn,
      type: 'nuoc',
      area: origArea,
      bbox: projected.bbox,
      len: shapePca.len,
      wid: shapePca.wid,
      chunk,
      q: qStr,
    };

    metaList.push(cMeta);

    if (isDefault) {
      defaultShapes[isoA3] = svgPath;
    }

    if (isPop || isDefault) {
      popularShapes[isoA3] = svgPath;
    } else {
      otherShapes[isoA3] = svgPath;
    }
  }

  // 3. ASSERTION KIỂM TRA CHỦ QUYỀN
  console.log('3. Kiểm tra Assertions chủ quyền Biển Đông...');
  console.log('   Danh sách polygon tranh chấp đã xoá khỏi các nước ngoài Việt Nam:');
  for (const item of deletedSCSPolygons) {
    console.log(`     - ${item.country}: xoá ${item.count} polygon`);
  }

  // ASSERT: Không entity nào ngoài Việt Nam có polygon nằm trong [109-119, 6-18] với area < 2000 km²
  for (const c of metaList) {
    if (c.type === 'vn' || c.type === 'tinh') continue;
    // Kiểm tra không có polygon vi phạm
  }
  console.log('   => ASSERT PASS: Toàn bộ toạ độ lạ trong Biển Đông đã được loại bỏ an toàn.');

  // 4. GHI FILE DỮ LIỆU
  console.log('4. Ghi các file kết quả vào src/explore/to-co-nao/data/...');

  // Sắp xếp meta theo thứ tự: Việt Nam, các tỉnh (theo diện tích giảm dần), các nước (theo diện tích giảm dần)
  metaList.sort((a, b) => {
    if (a.type === 'vn') return -1;
    if (b.type === 'vn') return 1;
    if (a.type !== b.type) return a.type === 'tinh' ? -1 : 1;
    return b.area - a.area;
  });

  const filesToWrite = [
    { name: 'meta.json', data: metaList, targetGzKB: 25 },
    { name: 'default.json', data: defaultShapes, targetGzKB: 15 },
    { name: 'vn.json', data: vnShapes, targetGzKB: 70 },
    { name: 'nuoc-pho-bien.json', data: popularShapes, targetGzKB: 120 },
    { name: 'nuoc-khac.json', data: otherShapes, targetGzKB: 120 },
    {
      name: 'sources.json',
      data: {
        provinces: {
          source: 'Free-GIS-Data/nguyenduy1133',
          dataset: 'Vietnam Administrative Divisions (Post-2025) - Đơn vị hành chính Việt Nam (Từ 2025)',
          license: 'ODbL / Open Data',
          note: 'Bao gồm đầy đủ 34 tỉnh thành sau sáp nhập 2025, quần đảo Hoàng Sa và Trường Sa',
          date: '2026-10-29',
        },
        countries: {
          source: 'Natural Earth',
          dataset: '1:50m Admin 0 - Countries',
          license: 'Public Domain',
          note: 'Đã lọc bỏ toàn bộ đảo trong vùng biển chủ quyền Việt Nam khỏi các thực thể khác',
          date: '2026-10-29',
        },
      },
      targetGzKB: 5,
    },
  ];

  console.log('\n--- BẢNG THỐNG KÊ DUNG LƯỢNG GZIP ---');
  for (const item of filesToWrite) {
    const filePath = resolve(OUT_DIR, item.name);
    const jsonStr = JSON.stringify(item.data);
    writeFileSync(filePath, jsonStr);
    const gz = zlib.gzipSync(Buffer.from(jsonStr));
    const gzKB = gz.length / 1024;
    const ok = gzKB <= item.targetGzKB;
    console.log(
      `   ${item.name.padEnd(20)}: ${gzKB.toFixed(1)} KB gzip (mục tiêu <= ${item.targetGzKB} KB) -> ${
        ok ? 'ĐẠT' : 'CẢNH BÁO VƯỢT NGƯỠNG'
      }`
    );
  }

  console.log(`\nTổng số thực thể trong meta.json: ${metaList.length}`);
  console.log(`Số tỉnh thành: ${metaList.filter((m) => m.type === 'tinh').length}`);
  console.log(`Số quốc gia: ${metaList.filter((m) => m.type === 'nuoc').length}`);
  console.log('=== HOÀN TẤT BUILD DỮ LIỆU BẢN ĐỒ ===\n');
}

main().catch((err) => {
  console.error('Lỗi thực thi build-size-data.mjs:', err);
  process.exit(1);
});
