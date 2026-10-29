// scripts/fetch-doc-vn-anh.mjs
// Tải ảnh Wikimedia chất lượng cao cho 32 điểm dừng của bước E3
import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import docVnData from '../src/explore/to-co-nao/data/doc-vn.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/doc-vn');
const META_FILE = resolve(ROOT, 'src/explore/to-co-nao/data/doc-vn-anh.json');

mkdirSync(OUT_DIR, { recursive: true });

const USER_AGENT = 'NealFunExploreVietnam/1.0 (https://github.com/phung/neal; phung.dev@gmail.com)';
const HEADERS = {
  'User-Agent': USER_AGENT,
  'Api-User-Agent': USER_AGENT,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Các từ khoá tối ưu cho những địa danh dễ bị nhầm hoặc có ảnh đại diện đẹp hơn trên Commons
const SEARCH_OVERRIDES = {
  3: 'Ruộng bậc thang Hoàng Su Phì',
  5: 'Thác Bà Lake',
  6: 'Đền Hùng, đền Thượng',
  8: 'Khuê Văn Các',
  27: 'Đồi cát Mũi Né',
};

function isImageAcceptable(filename) {
  const f = filename.toLowerCase();
  if (f.endsWith('.svg')) return false;
  if (f.includes('location_map') || f.includes('locator') || f.includes('bản_đồ') || f.includes('ban_do')) {
    return false;
  }
  return true;
}
function cleanHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function isLicenseAllowed(shortName, fullLicense) {
  const s = `${shortName || ''} ${fullLicense || ''}`.toLowerCase();
  if (
    s.includes('public domain') ||
    s.includes('pd') ||
    s.includes('cc0') ||
    s.includes('cc-zero') ||
    s.includes('no restrictions')
  ) {
    return true;
  }
  if (s.includes('cc by') || s.includes('cc-by') || s.includes('attribution')) {
    if (!s.includes('-nc') && !s.includes('-nd') && !s.includes('noncommercial') && !s.includes('noderivatives')) {
      return true;
    }
  }
  return false;
}

function extractFileTitleFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const pathname = u.pathname;
    // Format /wikipedia/commons/thumb/x/xx/Filename.jpg/...
    const thumbMatch = pathname.match(/\/commons\/thumb\/[^/]+\/[^/]+\/([^/]+)/);
    if (thumbMatch) {
      return decodeURIComponent(thumbMatch[1]);
    }
    // Format /wikipedia/commons/x/xx/Filename.jpg
    const origMatch = pathname.match(/\/commons\/[^/]+\/[^/]+\/([^/]+)/);
    if (origMatch) {
      return decodeURIComponent(origMatch[1]);
    }
  } catch {
    // ignore
  }
  return null;
}

async function getCommonsFileInfo(fileTitle) {
  const normTitle = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=960&titles=${encodeURIComponent(normTitle)}&format=json`;
  try {
    const res = await fetch(apiUrl, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    if (!page || page.missing !== undefined) return null;
    const ii = page.imageinfo?.[0];
    if (!ii) return null;

    const ext = ii.extmetadata || {};
    const shortLic = ext.LicenseShortName?.value || '';
    const fullLic = ext.License?.value || '';

    if (!isLicenseAllowed(shortLic, fullLic)) {
      return null;
    }

    const artistRaw = ext.Artist?.value || ext.Credit?.value || ext.Author?.value || 'Wikimedia Commons';
    const tacGia = cleanHtml(artistRaw).slice(0, 80) || 'Wikimedia Commons';
    const giayPhep = shortLic || fullLic || 'CC BY-SA';
    const nguon = ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(normTitle)}`;
    const downloadUrl = ii.thumburl || ii.url;

    return { downloadUrl, tacGia, giayPhep, nguon, title: normTitle };
  } catch (err) {
    console.warn(`  Lỗi truy vấn Commons cho ${normTitle}:`, err.message);
    return null;
  }
}

async function searchCommonsFiles(query) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=960&format=json`;
  try {
    const res = await fetch(apiUrl, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    const results = [];
    for (const page of pages) {
      if (!isImageAcceptable(page.title)) continue;
      const ii = page.imageinfo?.[0];
      if (!ii) continue;
      const ext = ii.extmetadata || {};
      const shortLic = ext.LicenseShortName?.value || '';
      const fullLic = ext.License?.value || '';
      if (isLicenseAllowed(shortLic, fullLic)) {
        const artistRaw = ext.Artist?.value || ext.Credit?.value || ext.Author?.value || 'Wikimedia Commons';
        results.push({
          downloadUrl: ii.thumburl || ii.url,
          tacGia: cleanHtml(artistRaw).slice(0, 80) || 'Wikimedia Commons',
          giayPhep: shortLic || fullLic || 'CC BY-SA',
          nguon: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          title: page.title,
        });
      }
    }
    return results;
  } catch (err) {
    console.warn(`  Lỗi tìm kiếm Commons cho ${query}:`, err.message);
    return [];
  }
}

async function findImageForStop(stop) {
  console.log(`[#${stop.id}] Đang tìm ảnh cho: ${stop.name} (${stop.wikiTitle})...`);

  // Ưu tiên từ khoá tối ưu nếu có
  if (SEARCH_OVERRIDES[stop.id]) {
    const searchRes = await searchCommonsFiles(SEARCH_OVERRIDES[stop.id]);
    if (searchRes.length > 0) {
      console.log(`  ✓ Tìm thấy từ override search ("${SEARCH_OVERRIDES[stop.id]}"): ${searchRes[0].title} (${searchRes[0].giayPhep})`);
      return searchRes[0];
    }
  }

  // 1. Thử Wikipedia tiếng Việt
  try {
    const viUrl = `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(stop.wikiTitle)}`;
    const res = await fetch(viUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      const imgUrl = data.originalimage?.source || data.thumbnail?.source;
      if (imgUrl) {
        const fileTitle = extractFileTitleFromUrl(imgUrl);
        if (fileTitle && isImageAcceptable(fileTitle)) {
          const info = await getCommonsFileInfo(fileTitle);
          if (info) {
            console.log(`  ✓ Tìm thấy từ vi.wikipedia: ${info.title} (${info.giayPhep})`);
            return info;
          }
        }
      }
    }
  } catch (e) {
    console.warn(`  vi.wikipedia error:`, e.message);
  }

  await sleep(150);

  // 2. Thử Wikipedia tiếng Anh nếu tên có bản tiếng Anh
  try {
    const enUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(stop.wikiTitle)}`;
    const res = await fetch(enUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      const imgUrl = data.originalimage?.source || data.thumbnail?.source;
      if (imgUrl) {
        const fileTitle = extractFileTitleFromUrl(imgUrl);
        if (fileTitle && isImageAcceptable(fileTitle)) {
          const info = await getCommonsFileInfo(fileTitle);
          if (info) {
            console.log(`  ✓ Tìm thấy từ en.wikipedia: ${info.title} (${info.giayPhep})`);
            return info;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }

  await sleep(150);

  // 3. Tìm kiếm trực tiếp trên Wikimedia Commons theo wikiTitle
  const searchResults1 = await searchCommonsFiles(stop.wikiTitle);
  if (searchResults1.length > 0) {
    console.log(`  ✓ Tìm thấy từ Commons search ("${stop.wikiTitle}"): ${searchResults1[0].title} (${searchResults1[0].giayPhep})`);
    return searchResults1[0];
  }

  await sleep(150);

  // 4. Tìm kiếm với tên điểm dừng
  const searchResults2 = await searchCommonsFiles(stop.name);
  if (searchResults2.length > 0) {
    console.log(`  ✓ Tìm thấy từ Commons search ("${stop.name}"): ${searchResults2[0].title} (${searchResults2[0].giayPhep})`);
    return searchResults2[0];
  }

  console.warn(`  ✗ Không tìm thấy ảnh hợp lệ cho điểm ${stop.id}: ${stop.name}`);
  return null;
}

async function downloadAndProcessImage(info, id) {
  const destPath = resolve(OUT_DIR, `${id}.webp`);
  const res = await fetch(info.downloadUrl, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Tải ảnh thất bại: HTTP ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  const inputBuf = Buffer.from(arrayBuf);

  // Resize về 960px width, encode WebP
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
  };
}

async function main() {
  const stops = docVnData.stops;
  console.log(`Bắt đầu tải ảnh Wikimedia cho ${stops.length} điểm dừng...`);

  const existingMeta = existsSync(META_FILE)
    ? JSON.parse(readFileSync(META_FILE, 'utf8'))
    : {};
  const newMeta = { ...existingMeta };

  let successCount = 0;
  let failCount = 0;

  for (const stop of stops) {
    try {
      const destFile = resolve(OUT_DIR, `${stop.id}.webp`);
      // Nếu đã có ảnh và metadata đầy đủ thì có thể giữ hoặc tải lại
      const info = await findImageForStop(stop);
      if (info) {
        const itemMeta = await downloadAndProcessImage(info, stop.id);
        newMeta[stop.id] = itemMeta;
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`  Lỗi xử lý điểm ${stop.id}:`, err.message);
      failCount++;
    }
    await sleep(250);
  }

  writeFileSync(META_FILE, JSON.stringify(newMeta, null, 2), 'utf8');
  console.log(`\nHoàn thành! Đã ghi ${META_FILE}`);
  console.log(`- Thành công: ${successCount}/${stops.length}`);
  console.log(`- Thiếu ảnh: ${failCount}`);

  // Tính tổng dung lượng thư mục public/doc-vn
  let totalBytes = 0;
  const files = readdirSync(OUT_DIR);
  for (const f of files) {
    const s = statSync(resolve(OUT_DIR, f));
    totalBytes += s.size;
  }
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`- Tổng dung lượng ảnh: ${totalMb} MB (giới hạn <= 4 MB)`);
}

main().catch((err) => {
  console.error('Lỗi chạy script:', err);
  process.exit(1);
});
