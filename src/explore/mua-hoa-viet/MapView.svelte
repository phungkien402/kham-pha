<script lang="ts">
  import type { MapSpot } from './types';

  interface Props {
    spots: MapSpot[];
    /** Trang chi tiết loài: không cần link sang chính loài đang xem. */
    currentSlug?: string;
    ratio: number;
    src: string;
    label: string;
  }

  let { spots, currentSlug, ratio, src, label }: Props = $props();

  let selectedSlug = $state<string | null>(null);
  const selected = $derived(spots.find((s) => s.slug === selectedSlug));
  const dotBg = (s: MapSpot) =>
    s.flowers.length === 1
      ? s.flowers[0].color
      : `conic-gradient(${s.flowers.map((f, i, a) => `${f.color} ${(i / a.length) * 100}% ${((i + 1) / a.length) * 100}%`).join(',')})`;

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') selectedSlug = null;
  }
</script>

<div class="frame" style:aspect-ratio={ratio} {onkeydown} role="group" aria-label="Bản đồ điểm ngắm hoa">
  <img {src} alt={label} width="600" height={Math.round(600 / ratio)} decoding="async" />
  {#each spots as s (s.slug)}
    <button
      type="button"
      class="hit"
      style:left="{s.x}%"
      style:top="{s.y}%"
      aria-label="{s.name}, {s.province}: {s.flowers.map((f) => f.name).join(', ')}"
      aria-expanded={s.slug === selectedSlug}
      onclick={() => (selectedSlug = s.slug === selectedSlug ? null : s.slug)}
    >
      <span class="dot" class:on={s.slug === selectedSlug} style:background={dotBg(s)}></span>
    </button>
  {/each}

  {#if selected}
    <div class="pop" role="region" aria-label="Chi tiết điểm ngắm {selected.name}">
      <button type="button" class="close" aria-label="Đóng" onclick={() => (selectedSlug = null)}>×</button>
      <strong>{selected.name}</strong>
      <span class="prov">{selected.province}</span>
      <ul>
        {#each selected.flowers as f (f.slug)}
          <li>
            <span class="sw" style:background={f.color}></span>
            <span>
              {#if f.slug === currentSlug}<strong>{f.name}</strong>{:else}<a href="/mua-hoa-viet/{f.slug}/">{f.name}</a>{/if}
              · <small>{f.best}</small>
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    width: 100%;
    max-width: 420px;
    margin-inline: auto;
    border: 1px solid #e7e2d9;
    border-radius: 20px;
    overflow: hidden;
    background: #e6eef0;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .hit {
    position: absolute;
    width: 36px;
    height: 36px;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgb(31 29 26 / 45%);
    transition: transform 0.15s;
  }
  .dot.on {
    transform: scale(1.35);
  }
  .hit:focus-visible {
    outline: 3px solid var(--color-text);
    border-radius: 50%;
  }
  .pop {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    padding: var(--space-3) var(--space-4);
    padding-right: 44px;
    background: #fff;
    border: 1px solid #b9b2a5;
    border-radius: 14px;
    box-shadow: 0 4px 16px rgb(31 29 26 / 18%);
    font-size: 0.875rem;
  }
  .prov {
    margin-left: var(--space-2);
    color: var(--color-text-muted);
  }
  .pop ul {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }
  .pop li {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .sw {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
  }
  .close {
    position: absolute;
    top: 0;
    right: 0;
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--color-text);
  }
  .close:focus-visible {
    outline: 3px solid var(--color-text);
    border-radius: 12px;
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      transition: none;
    }
  }
</style>
