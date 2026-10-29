// scripts/generate-tieu-tien-og.mjs
// Tạo ảnh OG (1200x630 png) và ảnh card trang chủ (500x320 webp) cho /tieu-tien ("1 ngày làm PNV")

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 1. Tạo ảnh OG 1200x630
const ogSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .badge { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 15px; font-weight: 700; fill: #059669; letter-spacing: 0.08em; }
      .title { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 48px; font-weight: 800; fill: #1f1d1a; letter-spacing: -0.02em; }
      .sub { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 24px; font-weight: 600; fill: #059669; }
      .desc { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 18px; font-weight: 500; fill: #6b665f; }
      .box-title { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 16px; font-weight: 700; fill: #1f1d1a; }
      .box-price { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 14px; font-weight: 600; fill: #059669; }
      .foot { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 15px; font-weight: 500; fill: #8c827a; }
    </style>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.06" />
    </filter>
  </defs>

  <!-- Nền kem #faf8f5 -->
  <rect width="1200" height="630" fill="#faf8f5" />

  <!-- Tấm thẻ chính -->
  <rect x="30" y="30" width="1140" height="570" rx="20" fill="#ffffff" stroke="#e6e1d9" stroke-width="2" filter="url(#shadow)" />

  <!-- Badge góc trên -->
  <rect x="470" y="58" width="260" height="34" rx="17" fill="#ecfdf5" />
  <text x="600" y="80" text-anchor="middle" class="badge">1 NGÀY LÀM PNV · 35,2 TỶ USD</text>

  <!-- Tiêu đề chính -->
  <text x="600" y="140" text-anchor="middle" class="title">Bạn có 35,2 tỷ USD — tiêu thế nào?</text>
  <text x="600" y="180" text-anchor="middle" class="desc">Mô phỏng phân bổ theo ước tính tài sản ròng Forbes 10/10/2026 (903.232 tỷ đồng)</text>

  <!-- Minh hoạ các món so sánh quy mô ở giữa -->
  <!-- Món 1: Trà đá -->
  <g transform="translate(100, 230)">
    <rect width="215" height="190" rx="14" fill="#faf8f5" stroke="#e6e1d9" stroke-width="1.5" />
    <text x="107" y="70" font-size="44" text-anchor="middle">🧊</text>
    <text x="107" y="115" class="box-title" text-anchor="middle">Trà đá vỉa hè</text>
    <text x="107" y="145" class="box-price" text-anchor="middle">4.000 đ</text>
  </g>

  <!-- Món 2: Ô tô điện VF 3 -->
  <g transform="translate(350, 230)">
    <rect width="215" height="190" rx="14" fill="#faf8f5" stroke="#e6e1d9" stroke-width="1.5" />
    <text x="107" y="70" font-size="44" text-anchor="middle">🚗</text>
    <text x="107" y="115" class="box-title" text-anchor="middle">VinFast VF 3 Plus</text>
    <text x="107" y="145" class="box-price" text-anchor="middle">281,2 triệu đ</text>
  </g>

  <!-- Món 3: Metro Bến Thành -->
  <g transform="translate(600, 230)">
    <rect width="215" height="190" rx="14" fill="#faf8f5" stroke="#e6e1d9" stroke-width="1.5" />
    <text x="107" y="70" font-size="44" text-anchor="middle">🚇</text>
    <text x="107" y="115" class="box-title" text-anchor="middle">Metro Bến Thành</text>
    <text x="107" y="145" class="box-price" text-anchor="middle">43,7 nghìn tỷ đ</text>
  </g>

  <!-- Món 4: Đường sắt tốc độ cao -->
  <g transform="translate(850, 230)">
    <rect width="215" height="190" rx="14" fill="#fffbeb" stroke="#f59e0b" stroke-dasharray="5 5" stroke-width="1.5" />
    <text x="107" y="70" font-size="44" text-anchor="middle">🚄</text>
    <text x="107" y="115" class="box-title" text-anchor="middle" fill="#92400e">Đường sắt TĐC</text>
    <text x="107" y="145" class="box-price" text-anchor="middle" fill="#b45309">1.713 nghìn tỷ đ</text>
    <text x="107" y="170" font-size="11" font-family="'Be Vietnam Pro', sans-serif" font-weight="700" text-anchor="middle" fill="#d97706">⚠️ Không đủ ngân sách</text>
  </g>

  <!-- Chân trang & Thông tin -->
  <line x1="70" y1="475" x2="1130" y2="475" stroke="#f0ebe4" stroke-width="1.5" />

  <text x="70" y="525" class="foot">Trò chơi minh hoạ độc lập · Tỷ giá Vietcombank 25.660 đ/USD</text>
  <text x="1130" y="525" text-anchor="end" class="foot" fill="#059669" font-weight="700">kham-pha.phungkien4002.workers.dev/tieu-tien</text>
</svg>
`;

// 2. Tạo ảnh card trang chủ 500x320
const cardSvg = `
<svg width="500" height="320" viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <style>
      .card-title { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 28px; font-weight: 800; fill: #ffffff; }
      .card-sub { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 15px; font-weight: 500; fill: rgba(255, 255, 255, 0.9); }
      .card-badge { font-family: 'Be Vietnam Pro', system-ui, sans-serif; font-size: 11px; font-weight: 700; fill: #047857; letter-spacing: 0.05em; }
    </style>
  </defs>

  <!-- Nền gradient xanh ngọc lục bảo #059669 -->
  <rect width="500" height="320" rx="16" fill="url(#bgGrad)" />

  <!-- Hoạ tiết trang trí mờ -->
  <circle cx="430" cy="80" r="90" fill="rgba(255, 255, 255, 0.06)" />
  <circle cx="390" cy="240" r="120" fill="rgba(255, 255, 255, 0.04)" />
  <text x="380" y="220" font-size="100" opacity="0.2">💰</text>

  <!-- Badge MỚI -->
  <rect x="36" y="36" width="56" height="24" rx="12" fill="#ffffff" />
  <text x="64" y="52" text-anchor="middle" class="card-badge">MỚI</text>

  <!-- Nội dung text -->
  <text x="36" y="105" class="card-title">1 ngày làm PNV</text>
  <text x="36" y="136" class="card-sub">Bạn có 35,2 tỷ USD — tiêu thế nào?</text>
  <text x="36" y="158" class="card-sub">Mô phỏng phân bổ theo ước tính Forbes</text>

  <!-- Nút kêu gọi hành động -->
  <rect x="36" y="245" width="160" height="36" rx="18" fill="rgba(255, 255, 255, 0.2)" stroke="rgba(255, 255, 255, 0.4)" stroke-width="1" />
  <text x="116" y="268" text-anchor="middle" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="13" font-weight="600" fill="#ffffff">Khám phá ngay →</text>
</svg>
`;

async function main() {
  const ogDir = path.join(ROOT, 'public/og');
  const cardsDir = path.join(ROOT, 'public/cards');

  if (!fs.existsSync(ogDir)) fs.mkdirSync(ogDir, { recursive: true });
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ogPath = path.join(ogDir, 'tieu-tien.png');
  await sharp(Buffer.from(ogSvg)).png().toFile(ogPath);
  console.log('Đã tạo ảnh OG:', ogPath);

  const cardPath = path.join(cardsDir, 'tieu-tien.webp');
  await sharp(Buffer.from(cardSvg)).webp({ quality: 90 }).toFile(cardPath);
  console.log('Đã tạo ảnh thẻ trang chủ:', cardPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
