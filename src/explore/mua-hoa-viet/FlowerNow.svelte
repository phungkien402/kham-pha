<script lang="ts">
  import { onMount } from 'svelte';
  import { inSeason, vnParts } from './season';
  import type { Season } from './season';
  import { countdown, monthRangeLabel, peakMonths, statusHeadline, statusSubline } from './detail';
  import { downloadFlowerIcs } from './ics';

  interface Props {
    slug?: string;
    name?: string;
    regionLabel?: string;
    color: string;
    seasons: Season[];
    facts?: { value: string; label: string }[];
  }

  let { slug = 'hoa', name = 'Hoa', regionLabel, color, seasons, facts = [] }: Props = $props();
  const flower = $derived({ slug, name, regionLabel, seasons });

  // HTML build theo ngày build; onMount tính lại theo ngày thật (spec mục 4).
  let now = $state(new Date());
  onMount(() => {
    now = new Date();
  });

  const month = $derived(vnParts(now).month);
  const headline = $derived(statusHeadline(flower, now));
  const count = $derived(countdown(flower, now));
  const peaks = $derived(peakMonths(flower));
  const light = $derived(`color-mix(in srgb, ${color} 40%, white)`);
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
</script>

<div class="status" style:background="color-mix(in srgb, {color} 12%, white)">
  <span class="dot" style:background={color} style:box-shadow="0 0 0 5px color-mix(in srgb, {color} 25%, transparent)"></span>
  <div class="status-body">
    <p class="head">{headline}</p>
    <p class="sub">{statusSubline(flower)}</p>
  </div>
  <button
    type="button"
    class="remind-btn"
    title="Tải lịch nhắc mùa {name} (.ics)"
    onclick={() => downloadFlowerIcs(flower, now)}
  >
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
    <span>Nhắc tôi mùa sau</span>
  </button>
</div>

<ul class="stats">
  <li class="dark">
    <strong>{count.value}</strong>
    <span>{count.label}</span>
  </li>
  {#each facts.slice(0, 2) as fact}
    <li>
      <strong>{fact.value}</strong>
      <span>{fact.label}</span>
    </li>
  {/each}
</ul>

<section aria-labelledby="mua-no-nam">
  <h2 id="mua-no-nam">Mùa nở trong năm</h2>
  <ol class="months" aria-label="Mùa nở: {monthRangeLabel(flower)}">
    {#each MONTHS as m}
      <li>
        <span
          class="cell"
          class:cur={m === month}
          style:background={peaks.includes(m) && inSeason(flower, m) ? color : inSeason(flower, m) ? light : undefined}
        ></span>
        <span class="num" class:strong={m === month}>{m}</span>
      </li>
    {/each}
  </ol>
  <ul class="key">
    <li><span class="sw" style:background={color}></span>Đỉnh mùa</li>
    <li><span class="sw" style:background={light}></span>Đang nở</li>
    <li><span class="sw ring"></span>Tháng này</li>
  </ul>
</section>

<style>
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-4);
    border-radius: 16px;
    margin-top: var(--space-4);
  }
  .status-body {
    flex: 1 1 180px;
    min-width: 0;
  }
  .remind-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 var(--space-3);
    border: 1px solid #cfc9be;
    border-radius: 999px;
    background: #fff;
    color: var(--color-text);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex: none;
    align-self: center;
  }
  .remind-btn:hover {
    border-color: var(--color-text);
    background: #faf8f5;
  }
  .remind-btn:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex: none;
    margin-top: 6px;
  }
  .head {
    font-weight: 700;
  }
  .sub {
    font-size: 0.875rem;
    color: #4a453e;
  }
  .stats {
    list-style: none;
    margin: var(--space-3) 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
  .stats li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3);
    background: #fff;
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    min-width: 0;
  }
  .stats li.dark {
    background: var(--color-text);
    border-color: var(--color-text);
    color: #faf8f5;
  }
  .stats strong {
    font-size: 1rem;
    line-height: 1.25;
  }
  .stats span {
    font-size: 0.75rem;
    opacity: 0.8;
  }
  section {
    margin-top: var(--space-6);
  }
  h2 {
    font-size: 1.125rem;
    margin-bottom: var(--space-3);
  }
  .months {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 3px;
  }
  .months li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .cell {
    width: 100%;
    height: 30px;
    border-radius: 6px;
    background: #efeae1;
    box-sizing: border-box;
  }
  .cell.cur {
    outline: 2px solid var(--color-text);
    outline-offset: 1px;
  }
  .num {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  .num.strong {
    color: var(--color-text);
    font-weight: 700;
  }
  .key {
    list-style: none;
    margin: var(--space-3) 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    font-size: 0.8125rem;
    color: #4a453e;
  }
  .key li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sw {
    width: 14px;
    height: 14px;
    border-radius: 4px;
  }
  .sw.ring {
    outline: 2px solid var(--color-text);
    outline-offset: -2px;
    background: #efeae1;
  }
</style>
