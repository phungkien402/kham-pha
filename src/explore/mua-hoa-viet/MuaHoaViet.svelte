<script lang="ts">
  import { onMount } from 'svelte';
  import Wheel from './Wheel.svelte';
  import { inSeason, isBloomingIn, showEndingTag, vnParts } from './season';
  import { monthRangeLabel } from './detail';
  import MapView from './MapView.svelte';
  import MapCredit from './MapCredit.svelte';
  import RegionSeg from './RegionSeg.svelte';
  import { applyCoversToFlowers, fetchCovers, type CoversMap } from './publicPhotos';
  import type { Snippet } from 'svelte';
  import type { Filter, FlowerLite, MapSpot, PlaceLite } from './types';

  interface Props {
    flowers: FlowerLite[];
    places: PlaceLite[];
    mapRatio: number;
    /** Khung nhìn từng vùng của bản đồ, theo phần trăm khung đầy đủ. */
    mapViews: Record<Filter, number[]>;
    /** Kích thước SVG bản đồ [rộng, cao]. */
    mapSize: [number, number];
    /** Bản đồ nền SVG (vẽ lúc build). */
    children?: Snippet;
  }

  let { flowers, places, mapRatio, mapViews, mapSize, children }: Props = $props();

  const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  // HTML build sẵn theo ngày build; onMount tính lại theo ngày thật ở giờ Việt Nam (spec mục 4).
  let today = $state(vnParts(new Date()));
  let month = $state(today.month);
  let region = $state<Filter>('all');
  let monthRow: HTMLElement | undefined = $state();
  let covers = $state<CoversMap>({});

  onMount(() => {
    today = vnParts(new Date());
    month = today.month;
    // Đưa nút tháng đang chọn vào giữa hàng cuộn ngang (không cuộn cả trang).
    const btn = monthRow?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (monthRow && btn) {
      monthRow.scrollLeft = btn.offsetLeft - (monthRow.clientWidth - btn.offsetWidth) / 2;
    }

    let cancelled = false;
    fetchCovers().then((map) => {
      if (!cancelled && Object.keys(map).length > 0) {
        covers = map;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  const dateLabel = $derived.by(() => {
    const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
    return `${WEEKDAYS[weekday]}, ${today.day} tháng ${today.month}`;
  });

  const nextMonth = $derived((month % 12) + 1);
  const resolvedFlowers = $derived(applyCoversToFlowers(flowers, covers));
  const visible = $derived(resolvedFlowers.filter((f) => region === 'all' || f.regions.includes(region)));
  const blooming = $derived(visible.filter((f) => isBloomingIn(f, month, today)));
  const upcoming = $derived(visible.filter((f) => f.seasons.some((s) => s.start.month === nextMonth)));
  const bloomingSlugs = $derived(new Set(blooming.map((f) => f.slug)));
  const isThisMonth = $derived(month === today.month);

  const flowerBySlug = $derived(new Map(resolvedFlowers.map((f) => [f.slug, f])));
  const spots = $derived(
    places
      .filter((p) => region === 'all' || p.region === region)
      .map((p) => {
        const directSlugs = new Set(p.flowers.map((pf) => pf.slug));
        const reverseFlowers = resolvedFlowers.filter(
          (f) => !directSlugs.has(f.slug) && f.places?.some((fp) => fp.slug === p.slug),
        );
        const allFlowersForPlace = [
          ...p.flowers.map((pf) => flowerBySlug.get(pf.slug)),
          ...reverseFlowers,
        ];
        return {
          ...p,
          now: allFlowersForPlace.filter((f): f is FlowerLite => !!f && bloomingSlugs.has(f.slug)),
        };
      })
      .filter((p) => p.now.length > 0),
  );

  const mapSpots = $derived<MapSpot[]>(
    spots.flatMap((p) =>
      p.x == null || p.y == null
        ? []
        : [
            {
              slug: p.slug,
              name: p.name,
              province: p.province,
              x: p.x,
              y: p.y,
              maps_url: p.maps_url,
              flowers: p.now.map((f) => ({
                slug: f.slug,
                name: f.name,
                color: f.color,
                best:
                  p.flowers.find((pf) => pf.slug === f.slug)?.best ??
                  f.places?.find((fp) => fp.slug === p.slug)?.best ??
                  '',
              })),
            },
          ],
    ),
  );

  const placeholder = (color: string) => `color-mix(in srgb, ${color} 72%, white)`;
</script>

<div class="top">
  <div class="hero">
    <p class="date">{dateLabel}</p>
    {#if isThisMonth}
      <h1>{blooming.length} loài hoa đang nở</h1>
      <p class="intro">Hôm nay hoa gì đang nở? Kéo kim trên bánh xe hoặc chọn tháng để xem mùa hoa cả năm.</p>
    {:else}
      <h1>Đang xem tháng {month}</h1>
      <p class="intro">{blooming.length} loài hoa nở trong tháng {month}.</p>
    {/if}
  </div>

  <div class="wheel-card">
    <Wheel flowers={resolvedFlowers} bind:month {today} activeSlugs={bloomingSlugs} />
  </div>

  <ul class="legend" aria-label="Các loài đang nở">
    {#each blooming as f (f.slug)}
      <li><span class="dot" style:background={f.color}></span>{f.name}</li>
    {/each}
  </ul>

  <div class="months" bind:this={monthRow} role="group" aria-label="Chọn tháng">
    {#each MONTHS as m}
      <button type="button" aria-pressed={m === month} onclick={() => (month = m)}>Tháng {m}</button>
    {/each}
  </div>

  <div class="filter"><RegionSeg bind:region label="Lọc theo miền" /></div>
</div>

<section class="block" aria-labelledby="dang-no">
  <h2 id="dang-no">Đang nở</h2>
  {#if blooming.length}
    <ul class="cards">
      {#each blooming as f (f.slug)}
        <li>
          <a class="card" href="/mua-hoa-viet/{f.slug}/">
            <div class="thumb" style:background={placeholder(f.color)}>
              {#if f.photo}<img
                  src={f.photo.src}
                  srcset={f.photo.srcset}
                  sizes="(min-width: 1024px) 360px, 88px"
                  alt={f.photoAlt ?? f.name}
                  loading="lazy"
                  width="88"
                  height="88"
                />{/if}
            </div>
            <div class="body">
              <div class="name-row">
                <h3>{f.name}</h3>
                {#if showEndingTag(f, month, today)}<span class="tag">Sắp tàn</span>{/if}
              </div>
              <p class="where">{f.regionLabel}</p>
              <div class="strip" aria-hidden="true">
                {#each MONTHS as m}
                  <span
                    class:on={inSeason(f, m)}
                    class:cur={m === month}
                    style:background={inSeason(f, m) ? f.color : undefined}
                  ></span>
                {/each}
              </div>
              <p class="when">Mùa nở: {monthRangeLabel(f)}</p>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">Chưa có loài nào trong dữ liệu nở ở tháng {month}{region === 'all' ? '' : ' tại miền này'}.</p>
  {/if}
</section>

<section class="block" aria-labelledby="sap-no">
  <h2 id="sap-no">Sắp nở tháng {nextMonth}</h2>
  {#if upcoming.length}
    <ul class="soon">
      {#each upcoming as f (f.slug)}
        <li>
          <a href="/mua-hoa-viet/{f.slug}/">
            <span class="ring" style:border-color={f.color}></span>
            <span><strong>{f.name}</strong> · {f.regionLabel}</span>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">Chưa có loài nào bắt đầu nở vào tháng {nextMonth}.</p>
  {/if}
</section>

<section class="block" aria-labelledby="ngam">
  <h2 id="ngam">Ngắm ở đâu</h2>
  <div class="where-wrap">
    <div class="map">
      <MapView spots={mapSpots} ratio={mapRatio} views={mapViews} size={mapSize} bind:region>
        {@render children?.()}
      </MapView>
      <MapCredit />
    </div>
    <div class="spots">
      {#if spots.length}
        <ul>
          {#each spots as p (p.slug)}
            <li>
              <span class="dots">
                {#each p.now as f (f.slug)}<span class="dot" style:background={f.color}></span>{/each}
              </span>
              <span>
                <strong>{p.name}</strong>, {p.province}
                {#if p.maps_url}
                  {' · '}<a class="maps-link" href={p.maps_url} target="_blank" rel="noopener noreferrer">Mở Google Maps</a>
                {/if}
                <br /><small>{p.now.map((f) => f.name).join(', ')}</small>
              </span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">Chưa có điểm ngắm cho tháng {month}{region === 'all' ? '' : ' ở miền này'}.</p>
      {/if}
    </div>
  </div>

  <p class="contribute-links">
    Biết thêm mùa hoa hay chỗ ngắm đẹp?
    <a href="/them-hoa">Thêm loài hoa</a>
    <span aria-hidden="true">·</span>
    <a href="/them-dia-diem">Thêm điểm ngắm</a>
    <span aria-hidden="true">·</span>
    <a href="/gui-anh">Gửi ảnh</a>
  </p>
</section>

<style>
  .top {
    display: grid;
    gap: var(--space-4);
    grid-template-areas: 'hero' 'wheel' 'legend' 'months' 'filter';
  }
  .hero {
    grid-area: hero;
  }
  .date {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    font-weight: 600;
  }
  h1 {
    margin-top: var(--space-1);
    font-size: 2.25rem;
    line-height: 1.15;
  }
  .intro {
    margin-top: var(--space-2);
    color: #4a453e;
    max-width: 34rem;
  }

  .wheel-card {
    grid-area: wheel;
    background: #fff;
    border: 1px solid #e7e2d9;
    border-radius: 20px;
    padding: var(--space-4);
    max-width: 480px;
    width: 100%;
    justify-self: center;
  }

  .legend {
    grid-area: legend;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    font-size: 0.875rem;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
    display: inline-block;
  }

  .months {
    grid-area: months;
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-1);
    scrollbar-width: thin;
  }
  .months button {
    flex: none;
    min-height: 44px;
    padding: 0 var(--space-4);
    border: 1px solid #e7e2d9;
    border-radius: 999px;
    background: #fff;
    color: var(--color-text);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .months button[aria-pressed='true'] {
    background: var(--color-text);
    border-color: var(--color-text);
    color: #faf8f5;
  }

  .filter {
    grid-area: filter;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }

  .block {
    margin-top: var(--space-8);
  }
  h2 {
    font-size: 1.25rem;
    margin-bottom: var(--space-3);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .empty {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }

  .cards {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  }
  .card {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: var(--space-3);
    height: 100%;
    padding: var(--space-3);
    background: #fff;
    border: 1px solid #e7e2d9;
    border-radius: 16px;
    text-decoration: none;
  }
  .card:hover {
    border-color: #b9b2a5;
  }
  .thumb {
    width: 88px;
    height: 88px;
    border-radius: 12px;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .body {
    min-width: 0;
  }
  .name-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  h3 {
    font-size: 1.0625rem;
  }
  .tag {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 999px;
    background: #efeae1;
    color: #4a453e;
  }
  .where {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .strip {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 2px;
    margin-top: var(--space-2);
  }
  .strip span {
    height: 8px;
    border-radius: 2px;
    background: #efeae1;
    box-sizing: border-box;
  }
  .strip span.cur {
    outline: 2px solid var(--color-text);
    outline-offset: 0;
  }
  .when {
    margin-top: var(--space-1);
    font-size: 0.75rem;
    color: #4a453e;
  }

  .soon {
    display: grid;
    gap: var(--space-2);
  }
  .soon a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px dashed #b9b2a5;
    border-radius: 14px;
    text-decoration: none;
  }
  .ring {
    width: 14px;
    height: 14px;
    border: 3px solid;
    border-radius: 50%;
    flex: none;
  }

  .where-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }
  .map {
    flex: 999 1 360px;
    min-width: 0;
  }
  .spots {
    flex: 1 1 280px;
  }
  .spots li {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid #e7e2d9;
  }
  .spots small {
    color: var(--color-text-muted);
  }
  .dots {
    display: flex;
    gap: 3px;
    padding-top: 7px;
  }
  .maps-link {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    text-decoration: underline;
  }
  .contribute-links {
    margin-top: var(--space-6);
    font-size: 0.875rem;
    color: var(--color-text-muted);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .contribute-links a {
    color: var(--color-text);
    font-weight: 600;
    text-decoration: underline;
  }

  @media (min-width: 1024px) {
    .top {
      grid-template-columns: 1fr 480px;
      grid-template-rows: auto auto auto 1fr;
      grid-template-areas: 'hero wheel' 'months wheel' 'filter wheel' 'legend wheel';
      column-gap: var(--space-12);
      align-items: start;
    }
    .wheel-card {
      justify-self: stretch;
    }
    h1 {
      font-size: 3.5rem;
    }
    .months {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      overflow: visible;
    }
    .months button {
      padding: 0;
      border-radius: 12px;
    }
    .card {
      grid-template-columns: 1fr;
    }
    .thumb {
      width: 100%;
      height: 180px;
    }
  }
</style>
