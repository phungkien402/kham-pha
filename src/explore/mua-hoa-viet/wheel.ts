// Hình học của bánh xe 12 tháng (spec mục 3). Viewbox -10 -10 340 340, tâm (160, 160).

export const CX = 160;
export const CY = 160;
export const R_INNER = 50;
export const R_OUTER = 146;
export const R_LABEL = 156;

const rad = (deg: number) => (deg * Math.PI) / 180;

export function pt(r: number, deg: number): [number, number] {
  return [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))];
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Vòng cung từ đầu tháng `s` đến cuối tháng `e` (1–12), chừa 2° mỗi đầu; e < s là mùa vắt năm. */
export function arcPath(r: number, s: number, e: number): string {
  const a0 = (s - 1) * 30 - 90 + 2;
  let a1 = e * 30 - 90 - 2;
  if (e < s) a1 += 360;
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)}`;
}

/** Hình quạt nền của một tháng, từ R_INNER đến R_OUTER. */
export function sectorPath(month: number): string {
  const a0 = (month - 1) * 30 - 90;
  const a1 = month * 30 - 90;
  const [ox0, oy0] = pt(R_OUTER, a0);
  const [ox1, oy1] = pt(R_OUTER, a1);
  const [ix0, iy0] = pt(R_INNER, a0);
  const [ix1, iy1] = pt(R_INNER, a1);
  return `M ${f(ox0)} ${f(oy0)} A ${R_OUTER} ${R_OUTER} 0 0 1 ${f(ox1)} ${f(oy1)} L ${f(ix1)} ${f(iy1)} A ${R_INNER} ${R_INNER} 0 0 0 ${f(ix0)} ${f(iy0)} Z`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Góc kim: tháng hiện tại → đúng ngày hôm nay, tháng khác → giữa tháng. */
export function needleAngle(
  month: number,
  today: { year: number; month: number; day: number },
): number {
  const frac = month === today.month ? today.day / daysInMonth(today.year, today.month) : 0.5;
  return (month - 1 + frac) * 30 - 90;
}

/** Tháng (1–12) ứng với một góc (độ, 0° = hướng đông, tính theo chiều kim đồng hồ). */
export function monthFromAngle(deg: number): number {
  const fromTop = (((deg + 90) % 360) + 360) % 360;
  return Math.floor(fromTop / 30) + 1;
}
