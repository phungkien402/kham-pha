<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, untrack } from 'svelte';
  import RegionSeg from './RegionSeg.svelte';
  import { fetchWeeklyPhotos } from './publicPhotos';
  import type { Filter, MapSpot } from './types';

  type View = number[];

  interface Props {
    spots: MapSpot[];
    /** Trang chi tiết loài: không cần link sang chính loài đang xem. */
    currentSlug?: string;
    ratio: number;
    /** Khung nhìn từng vùng, theo phần trăm khung bản đồ đầy đủ: [x, y, rộng, cao]. */
    views: Record<Filter, View>;
    /** Kích thước SVG đầy đủ [rộng, cao], để đổi phần trăm sang viewBox. */
    size: [number, number];
    region?: Filter;
    weeklyPlaces?: Record<string, number>;
    /** Bản đồ nền (SVG vẽ lúc build, truyền qua slot). */
    children?: Snippet;
  }

  let {
    spots,
    currentSlug,
    ratio,
    views,
    size,
    region = $bindable('all'),
    weeklyPlaces = $bindable({}),
    children,
  }: Props = $props();

  let internalWeeklyPlaces = $state<Record<string, number>>({});
  const activeWeeklyPlaces = $derived(
    weeklyPlaces && Object.keys(weeklyPlaces).length > 0 ? weeklyPlaces : internalWeeklyPlaces,
  );

  onMount(() => {
    if (!weeklyPlaces || Object.keys(weeklyPlaces).length === 0) {
      let cancelled = false;
      fetchWeeklyPhotos().then((res) => {
        if (!cancelled && res?.places && Object.keys(res.places).length > 0) {
          internalWeeklyPlaces = res.places;
        }
      });
      return () => {
        cancelled = true;
      };
    }
  });

  const clusterWeeklyCount = (c: Cluster) =>
    c.spots.reduce((sum, s) => sum + (activeWeeklyPlaces[s.slug] || 0), 0);

  // Các điểm gần nhau hơn MIN_GAP (px, tính trên khung ~300px SAU khi zoom) được GỘP thành một nút đặt ở vị trí
  // trung bình — không đẩy lệch chấm, vì đẩy lệch làm sai vị trí địa lý (vd Hồ Tây bị đẩy sang tận Thái Bình).
  const REF_W = 300;
  const MIN_GAP = 28;
  type Cluster = { key: string; spots: MapSpot[]; x: number; y: number };

  const target = $derived(views[region]);

  // Gộp theo khung nhìn ĐÍCH (không theo khung đang chạy chuyển động) để nút không nhảy giữa chừng.
  const clusters = $derived.by(() => {
    const [vx, vy, vw, vh] = target;
    const inView = (s: MapSpot) => s.x >= vx - 3 && s.x <= vx + vw + 3 && s.y >= vy - 3 && s.y <= vy + vh + 3;
    const toPx = (s: MapSpot) => ({ x: ((s.x - vx) / vw) * REF_W, y: ((s.y - vy) / vh) * (REF_W / ratio) });
    const groups: { spots: MapSpot[]; px: { x: number; y: number }[] }[] = [];
    for (const s of spots.filter(inView)) {
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
        x: g.spots.reduce((a, s) => a + s.x, 0) / g.spots.length,
        y: g.spots.reduce((a, s) => a + s.y, 0) / g.spots.length,
      }),
    );
  });

  // Khung nhìn đang hiển thị (chạy chuyển động từ khung cũ sang khung đích).
  let cur = $state<View>(untrack(() => [...views[region]]));
  let wrap: HTMLElement | undefined = $state();
  let raf = 0;

  $effect(() => {
    const to = target;
    const from = untrack(() => [...cur]);
    cancelAnimationFrame(raf);
    let reduce = false;
    try {
      reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    if (reduce || from.every((v, i) => v === to[i])) {
      cur = [...to];
      return;
    }
    const t0 = performance.now();
    const DURATION = 400;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      cur = from.map((v, i) => v + (to[i] - v) * e);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  // SVG nền nằm trong slot (HTML tĩnh), nên đổi viewBox bằng DOM thay vì template.
  $effect(() => {
    const svg = wrap?.querySelector('svg');
    if (!svg) return;
    const [px, py, pw, ph] = cur;
    const [aw, ah] = size;
    svg.setAttribute('viewBox', `${(px / 100) * aw} ${(py / 100) * ah} ${(pw / 100) * aw} ${(ph / 100) * ah}`);
    svg.dataset.region = region;
  });

  const place = (c: Cluster) => ({
    left: ((c.x - cur[0]) / cur[2]) * 100,
    top: ((c.y - cur[1]) / cur[3]) * 100,
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

<div class="seg-wrap"><RegionSeg bind:region label="Chọn vùng bản đồ" /></div>

<div class="frame" style:aspect-ratio={ratio} {onkeydown} role="group" aria-label="Bản đồ điểm ngắm hoa">
  <div class="base" bind:this={wrap}>{@render children?.()}</div>
  {#each clusters as c (c.key)}
    <button
      type="button"
      class="hit"
      style:left="{place(c).left}%"
      style:top="{place(c).top}%"
      aria-label={labelOf(c)}
      aria-expanded={c.key === selectedKey}
      onclick={() => (selectedKey = c.key === selectedKey ? null : c.key)}
    >
      <span
        class="dot"
        class:on={c.key === selectedKey}
        class:has-weekly={clusterWeeklyCount(c) > 0}
        style:background={dotBg(c)}
      >
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
          {#if (activeWeeklyPlaces[s.slug] || 0) > 0}
            <span class="weekly-tag">{(activeWeeklyPlaces[s.slug])} ảnh tuần này</span>
          {/if}
          {#if s.maps_url}
            {' · '}<a class="maps-link" href={s.maps_url} target="_blank" rel="noopener noreferrer">Mở Google Maps</a>
          {/if}
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
  .seg-wrap {
    max-width: 420px;
    margin: 0 auto var(--space-3);
  }
  .base {
    position: absolute;
    inset: 0;
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
  .maps-link {
    font-size: 0.8125rem;
    color: var(--color-text);
    text-decoration: underline;
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
  .weekly-tag {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 1.2;
    padding: 2px 6px;
    border-radius: 999px;
    background: #e8f5e9;
    color: #1b5e20;
    border: 1px solid #c8e6c9;
    margin-left: var(--space-2);
    vertical-align: middle;
  }
  .dot.has-weekly::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid #2e7d32;
    box-shadow: 0 0 6px rgba(46, 125, 50, 0.5);
    animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    pointer-events: none;
  }
  @keyframes pulse-ring {
    0%, 100% {
      transform: scale(1);
      opacity: 0.85;
      box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.4);
    }
    50% {
      transform: scale(1.35);
      opacity: 0.25;
      box-shadow: 0 0 8px 2px rgba(46, 125, 50, 0.6);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      transition: none;
    }
    .dot.has-weekly::after {
      animation: none;
      opacity: 0.8;
      transform: scale(1.15);
    }
  }
</style>
