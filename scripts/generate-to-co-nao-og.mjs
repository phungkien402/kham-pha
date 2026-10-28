// scripts/generate-to-co-nao-og.mjs
// Tạo ảnh OG (1200x630 png) và ảnh card trang chủ (500x320 webp) cho /to-co-nao

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const defaultShapes = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/explore/to-co-nao/data/default.json'), 'utf8')
);

const lamDongD = defaultShapes['lam-dong'];
const belD = defaultShapes['bel'];

// 1. Tạo ảnh OG 1200x630
const ogSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 46px; font-weight: 800; fill: #1f1d1a; }
      .badge { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 15px; font-weight: 700; fill: #2563eb; letter-spacing: 0.08em; }
      .sub { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 22px; font-weight: 500; fill: #524d46; }
      .legend { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 18px; font-weight: 600; }
      .foot { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 16px; font-weight: 500; fill: #8c827a; }
    </style>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.08" />
    </filter>
  </defs>

  <!-- Nền kem #faf8f5 -->
  <rect width="1200" height="630" fill="#faf8f5" />
  
  <!-- Viền trang trí -->
  <rect x="24" y="24" width="1152" height="582" rx="20" fill="#ffffff" stroke="#e6e1d9" stroke-width="2" filter="url(#shadow)" />

  <!-- Badge góc trên -->
  <rect x="500" y="52" width="200" height="32" rx="16" fill="#eff6ff" />
  <text x="600" y="73" text-anchor="middle" class="badge">VIỆT NAM TO CỠ NÀO?</text>

  <!-- Tiêu đề câu so sánh kinh điển -->
  <text x="600" y="132" text-anchor="middle" class="title">Lâm Đồng ≈ 0,8 lần Bỉ</text>
  <text x="600" y="172" text-anchor="middle" class="sub">Lâm Đồng (24.334 km²) so với Bỉ (30.632 km²)</text>

  <!-- Bản đồ so sánh 2 hình ở giữa khung -->
  <!-- Khung bản đồ: x=100, y=200, w=1000, h=320. Scale ~0.8 px/km -->
  <g transform="translate(430, 360) scale(0.95)">
    <!-- Lâm Đồng (#2563eb) -->
    <path d="${lamDongD}" fill="#2563eb" fill-opacity="0.38" stroke="#1d4ed8" stroke-width="3" fill-rule="evenodd" />
  </g>

  <g transform="translate(770, 360) scale(0.95)">
    <!-- Bỉ (#dc2626) -->
    <path d="${belD}" fill="#dc2626" fill-opacity="0.38" stroke="#b91c1c" stroke-width="3" fill-rule="evenodd" />
  </g>

  <!-- Chú thích 2 bên -->
  <circle cx="410" cy="515" r="7" fill="#1d4ed8" />
  <text x="425" y="522" class="legend" fill="#1e40af">Lâm Đồng (24.334 km²)</text>

  <circle cx="750" cy="515" r="7" fill="#b91c1c" />
  <text x="765" y="522" class="legend" fill="#991b1b">Bỉ (30.632 km²)</text>

  <!-- Chân trang -->
  <line x1="60" y1="545" x2="1140" y2="545" stroke="#f0ebe4" stroke-width="1.5" />
  <text x="60" y="578" class="foot">Phép chiếu Lambert Azimuthal Equal-Area bảo toàn diện tích</text>
  <text x="1140" y="578" text-anchor="end" class="foot">kham-pha.phungkien4002.workers.dev/to-co-nao</text>
</svg>
`;

// 2. Tạo ảnh card trang chủ 500x320
const cardSvg = `
<svg width="500" height="320" viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <style>
      .card-title { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 28px; font-weight: 800; fill: #ffffff; }
      .card-sub { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 15px; font-weight: 500; fill: rgba(255, 255, 255, 0.9); }
      .card-badge { font-family: 'Be Vietnam Pro', 'Segoe UI', system-ui, sans-serif; font-size: 11px; font-weight: 700; fill: #1d4ed8; letter-spacing: 0.05em; }
    </style>
  </defs>

  <!-- Nền gradient xanh dương theo màu #3B82F6 của trang -->
  <rect width="500" height="320" rx="16" fill="url(#bgGrad)" />

  <!-- Họa tiết trang trí dạng vector hình bản đồ nền mờ -->
  <g transform="translate(360, 160) scale(0.35)" opacity="0.25">
    <path d="${defaultShapes['viet-nam'] || ''}" fill="#ffffff" fill-rule="evenodd" />
  </g>
  <g transform="translate(140, 210) scale(0.55)" opacity="0.3">
    <path d="${lamDongD}" fill="#ffffff" fill-rule="evenodd" />
  </g>
  <g transform="translate(250, 210) scale(0.55)" opacity="0.3">
    <path d="${belD}" fill="#ffffff" fill-rule="evenodd" />
  </g>

  <!-- Badge MỚI -->
  <rect x="36" y="36" width="56" height="24" rx="12" fill="#ffffff" />
  <text x="64" y="52" text-anchor="middle" class="card-badge">MỚI</text>

  <!-- Nội dung text -->
  <text x="36" y="105" class="card-title">Việt Nam to cỡ nào?</text>
  <text x="36" y="135" class="card-sub">So sánh diện tích thực tế của Việt Nam</text>
  <text x="36" y="157" class="card-sub">và các tỉnh với các quốc gia trên thế giới</text>

  <rect x="36" y="245" width="160" height="36" rx="18" fill="rgba(255, 255, 255, 0.2)" stroke="rgba(255, 255, 255, 0.4)" stroke-width="1" />
  <text x="116" y="268" text-anchor="middle" font-family="'Be Vietnam Pro', system-ui, sans-serif" font-size="13" font-weight="600" fill="#ffffff">Khám phá ngay →</text>
</svg>
`;

async function main() {
  const ogDir = path.join(ROOT, 'public/og');
  const cardsDir = path.join(ROOT, 'public/cards');

  if (!fs.existsSync(ogDir)) fs.mkdirSync(ogDir, { recursive: true });
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  const ogPath = path.join(ogDir, 'to-co-nao.png');
  await sharp(Buffer.from(ogSvg)).png().toFile(ogPath);
  console.log('Đã tạo ảnh OG:', ogPath);

  const cardPath = path.join(cardsDir, 'to-co-nao.webp');
  await sharp(Buffer.from(cardSvg)).webp({ quality: 90 }).toFile(cardPath);
  console.log('Đã tạo ảnh thẻ trang chủ:', cardPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
