<script lang="ts">
  import type { FlowerLite } from './types';
  import { CX, CY, R_INNER, R_OUTER, R_LABEL, pt, arcPath, sectorPath, needleAngle } from './wheel';

  interface Props {
    flowers: FlowerLite[];
    month: number;
    today: { year: number; month: number; day: number };
    activeSlugs: Set<string>;
  }

  let { flowers, month, today, activeSlugs }: Props = $props();

  // Sắp theo tháng bắt đầu; mỗi loài một vòng đồng tâm.
  const rings = $derived(
    [...flowers]
      .sort((a, b) => a.season.start.month - b.season.start.month)
      .map((flower, i) => ({ flower, r: 58 + i * 7 })),
  );
  const angle = $derived(needleAngle(month, today));
  const tip = $derived(pt(R_OUTER, angle));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const labelPos = (m: number) => pt(R_LABEL, (m - 1) * 30 - 90 + 15);
</script>

<svg
  viewBox="-10 -10 340 340"
  role="img"
  aria-label="Bánh xe 12 tháng: mỗi vòng cung là mùa nở của một loài hoa. Đang xem tháng {month}."
>
  <path d={sectorPath(month)} fill="#f3eee5" />
  {#each rings as { flower, r } (flower.slug)}
    <circle cx={CX} cy={CY} {r} fill="none" stroke="#f1ece3" stroke-width="5.5" />
    <path
      d={arcPath(r, flower.season.start.month, flower.season.end.month)}
      fill="none"
      stroke={flower.color}
      stroke-width="5.5"
      stroke-linecap="round"
      opacity={activeSlugs.has(flower.slug) ? 1 : 0.28}
    >
      <title>{flower.name}</title>
    </path>
  {/each}

  {#each months as m}
    {@const [lx, ly] = labelPos(m)}
    <text
      x={lx}
      y={ly}
      text-anchor="middle"
      dominant-baseline="central"
      font-size="10"
      font-weight={m === month ? 700 : 400}
      fill={m === month ? '#1f1d1a' : '#6b655c'}>T{m}</text
    >
  {/each}

  <line x1={CX} y1={CY} x2={tip[0]} y2={tip[1]} stroke="#1f1d1a" stroke-width="2" stroke-linecap="round" />
  <circle cx={tip[0]} cy={tip[1]} r="6" fill="#1f1d1a" />
  <circle cx={CX} cy={CY} r="44" fill="#fff" />
  <text x={CX} y={CY - 12} text-anchor="middle" font-size="10" fill="#6b655c">Tháng</text>
  <text x={CX} y={CY + 14} text-anchor="middle" font-size="32" font-weight="700" fill="#1f1d1a">{month}</text>
</svg>

<style>
  svg {
    width: 100%;
    height: auto;
  }
</style>
