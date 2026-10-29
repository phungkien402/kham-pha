// scripts/generate-hieu-viet-nam-og.mjs
// Tạo ảnh OG (1200x630 png) và ảnh card trang chủ (500x320 webp) cho /hieu-viet-nam

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const docVnData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/explore/to-co-nao/data/doc-vn.json'), 'utf8')
);

const vnPath = docVnData.vnPath || '';
const provinces = docVnData.provinces || {};

// Tạo các đường path tỉnh thành cho SVG
let provincesSvgPaths = '';
const highlightedSlugs = ['ha-noi', 'hue', 'da-nang', 'tp-ho-chi-minh', 'ca-mau', 'dak-lak'];

for (const [slug, item] of Object.entries(provinces)) {
  const isHighlighted = highlightedSlugs.includes(slug);
  const fill = isHighlighted ? '#e11d48' : '#e2d9cc';
  const opacity = isHighlighted ? '0.85' : '0.4';
  const stroke = isHighlighted ? '#be123c' : '#ffffff';
  provincesSvgPaths += `<path d="${item.d}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="1.5" />\n`;
}

// 1. Ảnh OG 1200x630
const ogSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .og-title { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 44px; font-weight: 800; fill: #1f1d1a; }
      .og-badge { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 14px; font-weight: 700; fill: #be123c; letter-spacing: 0.08em; }
      .og-sub { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 21px; font-weight: 500; fill: #524d46; }
      .og-tag { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 16px; font-weight: 600; fill: #1f1d1a; }
      .og-foot { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 15px; font-weight: 500; fill: #8c827a; }
    </style>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.06" />
    </filter>
  </defs>

  <!-- Nền kem ấm áp -->
  <rect width="1200" height="630" fill="#faf8f5" />

  <!-- Khung viền thanh lịch -->
  <rect x="24" y="24" width="1152" height="582" rx="24" fill="#ffffff" stroke="#e8e2d8" stroke-width="2" filter="url(#cardShadow)" />

  <!-- Cột trái: Văn bản giới thiệu -->
  <g transform="translate(64, 70)">
    <!-- Badge thể loại -->
    <rect x="0" y="0" width="260" height="34" rx="17" fill="#ffe4e6" />
    <text x="130" y="22" text-anchor="middle" class="og-badge">HOW VIETNAMESE ARE YOU?</text>

    <!-- Tiêu đề lớn -->
    <text x="0" y="80" class="og-title">Bạn hiểu Việt Nam</text>
    <text x="0" y="132" class="og-title">đến đâu?</text>

    <!-- Phụ đề -->
    <text x="0" y="180" class="og-sub">Một chuyến khám phá văn hoá 5 vùng miền,</text>
    <text x="0" y="210" class="og-sub">từ ẩm thực, phong tục đến địa danh &amp; phương ngữ</text>

    <!-- 5 thẻ vùng miền -->
    <g transform="translate(0, 260)">
      <!-- Bắc -->
      <rect x="0" y="0" width="92" height="38" rx="10" fill="#fef3c7" stroke="#fde68a" />
      <text x="46" y="24" text-anchor="middle" class="og-tag" fill="#92400e">🎋 Bắc</text>

      <!-- Trung -->
      <rect x="104" y="0" width="92" height="38" rx="10" fill="#ffedd5" stroke="#fed7aa" />
      <text x="150" y="24" text-anchor="middle" class="og-tag" fill="#9a3412">🏮 Trung</text>

      <!-- Tây Nguyên -->
      <rect x="208" y="0" width="128" height="38" rx="10" fill="#ecfdf5" stroke="#a7f3d0" />
      <text x="272" y="24" text-anchor="middle" class="og-tag" fill="#065f46">🦅 Tây Nguyên</text>

      <!-- Nam -->
      <rect x="348" y="0" width="92" height="38" rx="10" fill="#e0f2fe" stroke="#bae6fd" />
      <text x="394" y="24" text-anchor="middle" class="og-tag" fill="#075985">🛶 Nam</text>

      <!-- Biển đảo -->
      <rect x="452" y="0" width="116" height="38" rx="10" fill="#f0fdf4" stroke="#bbf7d0" />
      <text x="510" y="24" text-anchor="middle" class="og-tag" fill="#166534">🌊 Biển đảo</text>
    </g>

    <!-- Điểm nhấn: 12 câu khám phá -->
    <g transform="translate(0, 335)">
      <circle cx="16" cy="16" r="16" fill="#f43f5e" />
      <text x="16" y="21" text-anchor="middle" font-family="'Be Vietnam Pro', sans-serif" font-size="16" font-weight="800" fill="#ffffff">✓</text>
      <text x="44" y="22" font-family="'Be Vietnam Pro', sans-serif" font-size="18" font-weight="600" fill="#374151">12 câu trắc nghiệm văn hoá chọn lọc · Không áp lực thi cử</text>
    </g>

    <g transform="translate(0, 385)">
      <circle cx="16" cy="16" r="16" fill="#f43f5e" />
      <text x="16" y="21" text-anchor="middle" font-family="'Be Vietnam Pro', sans-serif" font-size="16" font-weight="800" fill="#ffffff">✓</text>
      <text x="44" y="22" font-family="'Be Vietnam Pro', sans-serif" font-size="18" font-weight="600" fill="#374151">Bản đồ 34 tỉnh sáng đèn theo từng chặng đường bạn ghé qua</text>
    </g>
  </g>

  <!-- Cột phải: Bản đồ Việt Nam 34 tỉnh -->
  <!-- Khung toạ độ: translateX(850), translateY(300), scale(0.24) -->
  <g transform="translate(870, 275) scale(0.25)">
    ${provincesSvgPaths}
    <!-- Tên biển đảo -->
    <text x="520" y="-100" font-family="'Be Vietnam Pro', sans-serif" font-size="70" font-weight="700" fill="#0369a1" text-anchor="middle">BIỂN ĐÔNG</text>
    <text x="610" y="20" font-family="'Be Vietnam Pro', sans-serif" font-size="60" font-weight="600" fill="#0284c7">QĐ. Hoàng Sa</text>
    <text x="860" y="740" font-family="'Be Vietnam Pro', sans-serif" font-size="60" font-weight="600" fill="#0284c7">QĐ. Trường Sa</text>
  </g>

  <!-- Đường gạch chân trang -->
  <line x1="64" y1="540" x2="1136" y2="540" stroke="#f0ebe4" stroke-width="1.5" />
  <text x="64" y="575" class="og-foot">Một chuyến khám phá văn hoá, không phải thước đo quốc tịch · Neal</text>
  <text x="1136" y="575" text-anchor="end" class="og-foot">kham-pha.phungkien4002.workers.dev/hieu-viet-nam</text>
</svg>
`;

// 2. Ảnh card trang chủ 500x320
const cardSvg = `
<svg width="500" height="320" viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e11d48" />
      <stop offset="60%" stop-color="#be123c" />
      <stop offset="100%" stop-color="#881337" />
    </linearGradient>
    <style>
      .card-title { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 27px; font-weight: 800; fill: #ffffff; }
      .card-sub { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 14.5px; font-weight: 500; fill: rgba(255, 255, 255, 0.92); }
      .card-badge { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 11px; font-weight: 700; fill: #be123c; letter-spacing: 0.06em; }
    </style>
  </defs>

  <!-- Nền gradient ấm sắc son đỏ văn hóa -->
  <rect width="500" height="320" rx="18" fill="url(#cardBg)" />

  <!-- Bản đồ Việt Nam mờ ở góc phải làm nền hoạ tiết -->
  <g transform="translate(370, 155) scale(0.12)" opacity="0.28">
    <path d="${vnPath}" fill="#ffffff" fill-rule="evenodd" />
    <text x="520" y="-80" font-family="'Be Vietnam Pro', sans-serif" font-size="120" font-weight="700" fill="#ffffff" text-anchor="middle">BIỂN ĐÔNG</text>
  </g>

  <!-- Họa tiết chấm bi trang trí nhẹ nhàng -->
  <g opacity="0.1" fill="#ffffff">
    <circle cx="450" cy="40" r="3" />
    <circle cx="470" cy="40" r="3" />
    <circle cx="450" cy="60" r="3" />
    <circle cx="470" cy="60" r="3" />
  </g>

  <!-- Badge MỚI -->
  <rect x="36" y="36" width="56" height="24" rx="12" fill="#ffffff" />
  <text x="64" y="52" text-anchor="middle" class="card-badge">MỚI</text>

  <!-- Tiêu đề -->
  <text x="36" y="105" class="card-title">Bạn hiểu Việt Nam</text>
  <text x="36" y="138" class="card-title">đến đâu?</text>

  <!-- Phụ đề -->
  <text x="36" y="176" class="card-sub">Khám phá văn hoá, ẩm thực, phương ngữ</text>
  <text x="36" y="198" class="card-sub">&amp; địa danh 5 miền qua 12 câu đố vui</text>

  <!-- Nút tương tác -->
  <rect x="36" y="246" width="168" height="38" rx="19" fill="rgba(255, 255, 255, 0.22)" stroke="rgba(255, 255, 255, 0.45)" stroke-width="1.2" />
  <text x="120" y="270" text-anchor="middle" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="13" font-weight="600" fill="#ffffff">Bắt đầu khám phá →</text>
</svg>
`;

async function main() {
  const ogDir = path.join(ROOT, 'public/og');
  const cardsDir = path.join(ROOT, 'public/cards');

  if (!fs.existsSync(ogDir)) fs.mkdirSync(ogDir, { recursive: true });
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ogPath = path.join(ogDir, 'hieu-viet-nam.png');
  await sharp(Buffer.from(ogSvg)).png().toFile(ogPath);
  console.log('✓ Đã tạo ảnh OG:', ogPath);

  const cardPath = path.join(cardsDir, 'hieu-viet-nam.webp');
  await sharp(Buffer.from(cardSvg)).webp({ quality: 90 }).toFile(cardPath);
  console.log('✓ Đã tạo ảnh card:', cardPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
