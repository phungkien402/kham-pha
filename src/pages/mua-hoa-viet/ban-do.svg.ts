import type { APIRoute } from 'astro';
import { bordersPath, HEIGHT, labels, outlinePath, WIDTH } from '../../explore/mua-hoa-viet/map/projection';

// Bản đồ nền vẽ lúc build; các điểm ngắm là nút HTML chồng lên, nên client không cần d3.
export const GET: APIRoute = () => {
  const text = labels
    .map(
      (l) =>
        `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" font-size="19" font-style="italic" fill="#6b655b" font-family="'Be Vietnam Pro',Segoe UI,Arial,sans-serif">${l.text}</text>`,
    )
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#e6eef0"/>` +
    `<path d="${outlinePath}" fill="#faf8f5" stroke="#8d8678" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="${bordersPath}" fill="none" stroke="#cfc8ba" stroke-width="0.6" stroke-linejoin="round"/>` +
    text +
    `</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
