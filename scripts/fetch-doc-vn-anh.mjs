// scripts/fetch-doc-vn-anh.mjs
// Tải ảnh Wikimedia chất lượng cao cho 32 điểm dừng theo manifest của bước E4
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import docVnData from '../src/explore/to-co-nao/data/doc-vn.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/doc-vn');
const META_FILE = resolve(ROOT, 'src/explore/to-co-nao/data/doc-vn-anh.json');
const CONTACT_FILE = resolve(ROOT, 'docs/doc-vn-anh-contact.jpg');
const MANIFEST_FILE = resolve(__dirname, 'doc-vn-anh-manifest.json');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(dirname(CONTACT_FILE), { recursive: true });

const USER_AGENT = 'NealExploreVietnam/2.0 (https://github.com/phung/neal; phung.dev@gmail.com)';
const HEADERS = {
  'User-Agent': USER_AGENT,
  'Api-User-Agent': USER_AGENT,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanHtml(str) {
  if (!str) return 'Wikimedia Commons';
  let s = str
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  s = s.replace(/\s*\(\s*(?:thảo luận|talk)\s*\)/gi, '');
  s = s.replace(/User:/gi, '');
  s = s.replace(/[<>]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || s.length < 2) s = 'Wikimedia Commons';
  return s.slice(0, 80);
}

function normalizeLicense(shortLic, fullLic) {
  const s = `${shortLic || ''} ${fullLic || ''}`.trim();
  if (/cc0/i.test(s)) return 'CC0';
  if (/public\s*domain|pd/i.test(s)) return 'Public domain';
  const m = s.match(/cc[\s_-]*by([\s_-]*sa)?[\s_-]*([1-4]\.[0-9])/i);
  if (m) {
    const isSa = Boolean(m[1]);
    const ver = m[2];
    return isSa ? `CC BY-SA ${ver}` : `CC BY ${ver}`;
  }
  return 'CC BY-SA 4.0';
}

async function getCommonsFileInfo(fileTitle) {
  const normTitle = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=960&titles=${encodeURIComponent(normTitle)}&format=json`;
  try {
    const res = await fetch(apiUrl, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`  Lỗi HTTP ${res.status} khi truy vấn ${normTitle}`);
      return null;
    }
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined) {
      console.warn(`  Không tìm thấy trang Commons cho ${normTitle}`);
      return null;
    }
    const ii = page.imageinfo?.[0];
    if (!ii) return null;

    const ext = ii.extmetadata || {};
    const shortLic = ext.LicenseShortName?.value || '';
    const fullLic = ext.License?.value || '';
    const giayPhep = normalizeLicense(shortLic, fullLic);

    const artistRaw = ext.Artist?.value || ext.Credit?.value || ext.Author?.value || 'Wikimedia Commons';
    const tacGia = cleanHtml(artistRaw);
    const fileClean = normTitle.replace(/^File:/, '').replace(/\s+/g, '_');
    const nguon = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileClean)}`;
    const downloadUrl = ii.thumburl || ii.url;

    return { downloadUrl, tacGia, giayPhep, nguon, title: normTitle };
  } catch (err) {
    console.warn(`  Lỗi truy vấn Commons cho ${normTitle}:`, err.message);
    return null;
  }
}

async function downloadAndProcessImage(info, id, cropPosition = 'center') {
  const destPath = resolve(OUT_DIR, `${id}.webp`);
  const res = await fetch(info.downloadUrl, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Tải ảnh thất bại: HTTP ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  const inputBuf = Buffer.from(arrayBuf);

  // Resize về max 960px width, encode WebP
  let quality = 82;
  let webpBuf = await sharp(inputBuf)
    .resize({ width: 960, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  // Nén thêm nếu kích thước > 180 KB
  while (webpBuf.length > 180 * 1024 && quality > 20) {
    quality -= 6;
    webpBuf = await sharp(inputBuf)
      .resize({ width: 960, height: 720, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  writeFileSync(destPath, webpBuf);

  const meta = await sharp(webpBuf).metadata();
  const sizeKb = (webpBuf.length / 1024).toFixed(1);
  console.log(`  => Đã lưu ${destPath} (${meta.width}x${meta.height}, ${sizeKb} KB, quality ${quality})`);

  return {
    src: `/doc-vn/${id}.webp`,
    w: meta.width || 960,
    h: meta.height || 540,
    tacGia: info.tacGia,
    giayPhep: info.giayPhep,
    nguon: info.nguon,
    cropPosition,
  };
}

async function generateContactSheet(manifest, existingMeta) {
  console.log('\n--- Đang sinh contact sheet docs/doc-vn-anh-contact.jpg ---');
  const cols = 4;
  const rows = 8;
  const tileW = 360;
  const tileH = 240;
  const sheetW = cols * tileW;
  const sheetH = rows * tileH;

  const compositeInputs = [];

  for (let i = 0; i < manifest.length; i++) {
    const item = manifest[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = col * tileW;
    const top = row * tileH;

    const imgFile = resolve(OUT_DIR, `${item.id}.webp`);
    if (!existsSync(imgFile)) {
      console.warn(`Thiếu file ảnh cho điểm #${item.id} khi tạo contact sheet`);
      continue;
    }

    const stop = docVnData.stops.find((s) => s.id === item.id) || { name: `Điểm #${item.id}` };
    const labelText = `#${item.id}. ${stop.name}`;
    const cleanLabel = labelText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // SVG banner overlay
    const bannerSvg = Buffer.from(`
      <svg width="${tileW}" height="38" xmlns="http://www.w3.org/2000/svg">
        <rect width="${tileW}" height="38" fill="rgba(15, 23, 42, 0.85)" />
        <text x="12" y="25" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">${cleanLabel}</text>
      </svg>
    `);

    const tileBuf = await sharp(imgFile)
      .resize(tileW, tileH, { fit: 'cover', position: 'center' })
      .composite([{ input: bannerSvg, top: tileH - 38, left: 0 }])
      .toBuffer();

    compositeInputs.push({
      input: tileBuf,
      left,
      top,
    });
  }

  // Ghép toàn bộ vào contact sheet
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 3,
      background: { r: 15, g: 23, b: 42 },
    },
  })
    .composite(compositeInputs)
    .jpeg({ quality: 86 })
    .toFile(CONTACT_FILE);

  const contactStat = statSync(CONTACT_FILE);
  console.log(`Đã xuất ${CONTACT_FILE} (${sheetW}x${sheetH}, ${(contactStat.size / 1024).toFixed(1)} KB)`);
}

async function main() {
  if (!existsSync(MANIFEST_FILE)) {
    throw new Error(`Không tìm thấy file manifest: ${MANIFEST_FILE}`);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));
  console.log(`Đọc manifest: ${manifest.length} ảnh cần xử lý...`);

  const existingMeta = existsSync(META_FILE)
    ? JSON.parse(readFileSync(META_FILE, 'utf8'))
    : {};
  const newMeta = { ...existingMeta };

  let downloadCount = 0;
  let keepCount = 0;

  for (const item of manifest) {
    const id = item.id;
    const destPath = resolve(OUT_DIR, `${id}.webp`);
    const existing = existingMeta[String(id)];

    // Kiểm tra xem ảnh hiện tại có khớp với commonsFile trong manifest không
    const normTitle = item.commonsFile.startsWith('File:') ? item.commonsFile : `File:${item.commonsFile}`;
    const fileClean = normTitle.replace(/^File:/, '').replace(/\s+/g, '_');
    const expectedNguon = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileClean)}`;

    if (existsSync(destPath) && existing) {
      newMeta[String(id)] = {
        ...existing,
        nguon: expectedNguon,
        giayPhep: normalizeLicense(existing.giayPhep),
        cropPosition: item.cropPosition || 'center',
      };
      keepCount++;
      continue;
    }

    console.log(`[#${id}] Đang tải ảnh mới theo manifest: ${item.commonsFile}...`);
    try {
      const info = await getCommonsFileInfo(item.commonsFile);
      if (info) {
        const itemMeta = await downloadAndProcessImage(info, id, item.cropPosition);
        newMeta[String(id)] = itemMeta;
        downloadCount++;
      } else {
        console.error(`  Không thể lấy thông tin Commons cho #${id}: ${item.commonsFile}`);
      }
    } catch (err) {
      console.error(`  Lỗi khi tải ảnh #${id}:`, err.message);
    }

    await sleep(400);
  }

  writeFileSync(META_FILE, JSON.stringify(newMeta, null, 2), 'utf8');
  console.log(`\nHoàn thành! Đã cập nhật ${META_FILE}`);
  console.log(`- Ảnh tải mới: ${downloadCount}`);
  console.log(`- Ảnh giữ nguyên: ${keepCount}`);

  // Sinh contact sheet
  await generateContactSheet(manifest, newMeta);
}

main().catch((err) => {
  console.error('Lỗi chạy fetch-doc-vn-anh:', err);
  process.exit(1);
});
