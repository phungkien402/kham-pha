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

  // Các điểm gần nhau hơn MIN_GAP (px, tính trên khung ~300px) được GỘP thành một nút đặt ở vị trí
  // trung bình — không đẩy lệch chấm, vì đẩy lệch làm sai vị trí địa lý (vd Hồ Tây bị đẩy sang tận Thái Bình).
  const REF_W = 300;
  const MIN_GAP = 28;
  type Cluster = { key: string; spots: MapSpot[]; x: number; y: number };
  const clusters = $derived.by(() => {
    const toPx = (s: MapSpot) => ({ x: (s.x / 100) * REF_W, y: (s.y / 100) * (REF_W / ratio) });
    const groups: { spots: MapSpot[]; px: { x: number; y: number }[] }[] = [];
    for (const s of spots) {
      const p = toPx(s);
      const g = groups.find((g) => {
        const cx = g.px.reduce((a, q) => a + q.x, 0) / g.px.length;
        const cy = g.px.reduce((a, q) => a + q.y, 0) / g.px.length;
        return Math.hypot(p.x - cx, p.y - cy) < MIN_GAP;
      });
      if (g) {
        g.spots.push(s);
        g.px.push(p);
      } else groups.push({ spots: [s], px: [p] });
    }
    return groups.map(
      (g): Cluster => ({
        key: g.spots.map((s) => s.slug).join('+'),
        spots: g.spots,
        x: (g.spots.reduce((a, s) => a + s.x, 0) / g.spots.length),
        y: (g.spots.reduce((a, s) => a + s.y, 0) / g.spots.length),
      }),
    );
  });

  let selectedKey = $state<string | null>(null);
  const selected = $derived(clusters.find((c) => c.key === selectedKey));

  const colorsOf = (c: Cluster) => [...new Set(c.spots.flatMap((s) => s.flowers.map((f) => f.color)))];
  const dotBg = (c: Cluster) => {
    const cs = colorsOf(c);
    return cs.length === 1
      ? cs[0]
      : `conic-gradient(${cs.map((col, i, a) => `${col} ${(i / a.length) * 100}% ${((i + 1) / a.length) * 100}%`).join(',')})`;
  };
  const labelOf = (c: Cluster) =>
    c.spots.map((s) => `${s.name}, ${s.province}: ${s.flowers.map((f) => f.name).join(', ')}`).join('; ');

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') selectedKey = null;
  }
</script>

<div class="frame" style:aspect-ratio={ratio} {onkeydown} role="group" aria-label="Bản đồ điểm ngắm hoa">
  <img {src} alt={label} width="600" height={Math.round(600 / ratio)} decoding="async" />
  {#each clusters as c (c.key)}
    <button
      type="button"
      class="hit"
      style:left="{c.x}%"
      style:top="{c.y}%"
      aria-label={labelOf(c)}
      aria-expanded={c.key === selectedKey}
      onclick={() => (selectedKey = c.key === selectedKey ? null : c.key)}
    >
      <span class="dot" class:on={c.key === selectedKey} style:background={dotBg(c)}>
        {#if c.spots.length > 1}<span class="count" aria-hidden="true">{c.spots.length}</span>{/if}
      </span>
    </button>
  {/each}

  {#if selected}
    <div class="pop" role="region" aria-label="Chi tiết điểm ngắm {selected.spots.map((s) => s.name).join(', ')}">
      <button type="button" class="close" aria-label="Đóng" onclick={() => (selectedKey = null)}>×</button>
      {#each selected.spots as s (s.slug)}
        <div class="place">
          <strong>{s.name}</strong>
          <span class="prov">{s.province}</span>
          <ul>
            {#each s.flowers as f (f.slug)}
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
      {/each}
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
  .dot {
    position: relative;
  }
  .count {
    position: absolute;
    top: -9px;
    right: -11px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    border-radius: 8px;
    background: #1f1d1a;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 15px;
    text-align: center;
  }
  .place + .place {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid #ece7de;
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
