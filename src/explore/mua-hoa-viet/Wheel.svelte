<script lang="ts">
  import { untrack } from 'svelte';
  import type { FlowerLite } from './types';
  import {
    CX,
    CY,
    R_INNER,
    R_OUTER,
    R_LABEL,
    pt,
    arcPath,
    sectorPath,
    needleAngle,
    monthFromAngle,
  } from './wheel';

  interface Props {
    flowers: FlowerLite[];
    month: number;
    today: { year: number; month: number; day: number };
    activeSlugs: Set<string>;
  }

  let { flowers, month = $bindable(), today, activeSlugs }: Props = $props();

  // Sắp theo tháng bắt đầu; mỗi loài một vòng đồng tâm.
  const rings = $derived(
    [...flowers]
      .sort((a, b) => a.season.start.month - b.season.start.month)
      .map((flower, i) => ({ flower, r: 58 + i * 7 })),
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const labelPos = (m: number) => pt(R_LABEL, (m - 1) * 30 - 90 + 15);
  const range = (f: FlowerLite) =>
    f.season.start.month === f.season.end.month
      ? `tháng ${f.season.start.month}`
      : `tháng ${f.season.start.month} – tháng ${f.season.end.month}`;

  // Góc kim hiển thị: cộng dồn theo đường ngắn nhất để chuyển động không quay vòng dài (T12 → T1).
  let shown = $state(needleAngle(month, today));
  let dragging = $state(false);
  const shortest = (from: number, to: number) => from + ((((to - from) % 360) + 540) % 360) - 180;
  $effect(() => {
    const target = needleAngle(month, today);
    if (!dragging) shown = shortest(untrack(() => shown), target);
  });

  let svg: SVGSVGElement | undefined = $state();

  function angleFromPointer(e: PointerEvent): number {
    const rect = svg!.getBoundingClientRect();
    const scale = rect.width / 340;
    const cx = rect.left + (CX + 10) * scale;
    const cy = rect.top + (CY + 10) * scale;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  }

  function startDrag(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    moveDrag(e);
  }
  function moveDrag(e: PointerEvent) {
    if (!dragging) return;
    const a = angleFromPointer(e);
    shown = shortest(shown, a);
    month = monthFromAngle(a);
  }
  function endDrag() {
    dragging = false;
  }

  function onKey(e: KeyboardEvent) {
    let next = month;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = (month % 12) + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = ((month + 10) % 12) + 1;
    else if (e.key === 'Home') next = 1;
    else if (e.key === 'End') next = 12;
    else return;
    e.preventDefault();
    month = next;
  }

  // Tooltip tên loài khi rê chuột / chạm vào vòng cung.
  let tip = $state<{ text: string; x: number; y: number } | null>(null);
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  function showTip(e: PointerEvent, f: FlowerLite) {
    const box = (e.currentTarget as Element).closest('.wheel')!.getBoundingClientRect();
    tip = { text: `${f.name} · ${range(f)}`, x: e.clientX - box.left, y: e.clientY - box.top };
    clearTimeout(tipTimer);
    if (e.pointerType !== 'mouse') tipTimer = setTimeout(() => (tip = null), 2200);
  }
  function hideTip(e: PointerEvent) {
    if (e.pointerType === 'mouse') tip = null;
  }
</script>

<div class="wheel">
<svg
  bind:this={svg}
  viewBox="-10 -10 340 340"
  role="group"
  aria-label="Bánh xe 12 tháng: mỗi vòng cung là mùa nở của một loài hoa. Kéo kim hoặc dùng phím mũi tên để đổi tháng."
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
      aria-hidden="true"
    />
    <path
      class="hit"
      d={arcPath(r, flower.season.start.month, flower.season.end.month)}
      fill="none"
      stroke="transparent"
      stroke-width="7"
      aria-hidden="true"
      onpointerenter={(e) => showTip(e, flower)}
      onpointerdown={(e) => showTip(e, flower)}
      onpointerleave={hideTip}
    />
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
      fill={m === month ? '#1f1d1a' : '#6b655c'}
      aria-hidden="true">T{m}</text
    >
  {/each}

  <circle cx={CX} cy={CY} r="44" fill="#fff" />
  <text x={CX} y={CY - 12} text-anchor="middle" font-size="10" fill="#6b655c" aria-hidden="true">Tháng</text>
  <text x={CX} y={CY + 14} text-anchor="middle" font-size="32" font-weight="700" fill="#1f1d1a" aria-hidden="true">{month}</text>

  <g
    class="needle"
    class:dragging
    style:transform="rotate({shown}deg)"
    role="slider"
    tabindex="0"
    aria-label="Chọn tháng"
    aria-orientation="horizontal"
    aria-valuemin="1"
    aria-valuemax="12"
    aria-valuenow={month}
    aria-valuetext="Tháng {month}"
    onkeydown={onKey}
    onpointerdown={startDrag}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    <line x1={CX} y1={CY} x2={CX + R_OUTER} y2={CY} stroke="#1f1d1a" stroke-width="2" stroke-linecap="round" />
    <circle cx={CX + R_OUTER} cy={CY} r="6" fill="#1f1d1a" />
    <circle class="grab" cx={CX + R_OUTER} cy={CY} r="18" fill="transparent" />
  </g>
</svg>
{#if tip}
  <div class="tip" style:left="{tip.x}px" style:top="{tip.y}px" role="status">{tip.text}</div>
{/if}
</div>

<style>
  .wheel {
    position: relative;
  }
  svg {
    width: 100%;
    height: auto;
  }
  .hit {
    pointer-events: stroke;
  }
  .needle {
    transform-origin: 160px 160px;
    transition: transform 0.2s ease-out;
    cursor: grab;
    touch-action: none;
  }
  .needle.dragging {
    transition: none;
    cursor: grabbing;
  }
  .needle:focus-visible {
    outline: none;
  }
  .needle:focus-visible circle:not(.grab) {
    stroke: #fff;
    stroke-width: 2;
    paint-order: stroke;
  }
  .needle:focus-visible .grab {
    stroke: #1f1d1a;
    stroke-width: 2;
    stroke-dasharray: 3 3;
  }
  .tip {
    position: absolute;
    transform: translate(-50%, calc(-100% - 12px));
    padding: 4px 10px;
    border-radius: 8px;
    background: #1f1d1a;
    color: #faf8f5;
    font-size: 0.8125rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
  }
</style>
