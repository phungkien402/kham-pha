<script lang="ts">
  import { onMount } from 'svelte';
  import Wheel from './Wheel.svelte';
  import { inSeason, isBloomingIn, showEndingTag, vnParts } from './season';
  import { monthRangeLabel } from './detail';
  import MapView from './MapView.svelte';
  import MapCredit from './MapCredit.svelte';
  import RegionSeg from './RegionSeg.svelte';
  import Postcard from './Postcard.svelte';
  import { nearestBlooming } from './nearest';
  import { downloadFlowerIcs } from './ics';
  import {
    POSTER_SIZE_LIST,
    downloadPosterPng,
    posterFilename,
    posterTitle,
    type PosterSizeKey,
  } from './poster';
  import {
    PROVINCES_BY_REGION,
    PROVINCE_COORDS,
    REGION_LABELS,
    getProvinceCoords,
  } from './provinces';
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

  const PROVINCE_STORAGE_KEY = 'mua-hoa-viet:province';
  let selectedProvince = $state('');
  let userGeoCoords = $state<{ lat: number; lng: number } | null>(null);
  let locating = $state(false);
  let geoFallbackPrompt = $state(false);
  let provinceSelectEl: HTMLSelectElement | undefined = $state();

  let posterOpen = $state(false);
  let posterSize = $state<PosterSizeKey>('doc');
  let posterRegion = $state<Filter>('all');
  let downloadingPoster = $state(false);

  function togglePosterPicker() {
    if (!posterOpen) {
      posterRegion = region;
    }
    posterOpen = !posterOpen;
  }

  async function handleDownloadPoster() {
    if (downloadingPoster) return;
    downloadingPoster = true;
    try {
      await downloadPosterPng(resolvedFlowers, posterRegion, today.year, posterSize);
    } finally {
      downloadingPoster = false;
    }
  }

  onMount(() => {
    today = vnParts(new Date());
    month = today.month;
    try {
      const savedProvince = localStorage.getItem(PROVINCE_STORAGE_KEY);
      if (savedProvince && PROVINCE_COORDS[savedProvince]) {
        selectedProvince = savedProvince;
      }
    } catch {
      // Bỏ qua khi localStorage bị chặn
    }
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

  const activeCoords = $derived.by(() => {
    if (userGeoCoords) {
      return { ...userGeoCoords, label: 'vị trí thiết bị của bạn' };
    }
    if (selectedProvince) {
      const coords = getProvinceCoords(selectedProvince);
      if (coords) {
        return { ...coords, label: `trung tâm hành chính (tỉnh lỵ) ${selectedProvince}` };
      }
    }
    return null;
  });

  const todayNoon = $derived(new Date(Date.UTC(today.year, today.month - 1, today.day, 5)));
  const nearestSpots = $derived(
    activeCoords
      ? nearestBlooming(places, resolvedFlowers, activeCoords.lat, activeCoords.lng, todayNoon, 3)
      : [],
  );

  function onProvinceSelectChange(e: Event) {
    const val = (e.currentTarget as HTMLSelectElement).value;
    selectedProvince = val;
    userGeoCoords = null;
    geoFallbackPrompt = false;
    try {
      if (val) {
        localStorage.setItem(PROVINCE_STORAGE_KEY, val);
      } else {
        localStorage.removeItem(PROVINCE_STORAGE_KEY);
      }
    } catch {
      // Bỏ qua khi localStorage bị chặn
    }
  }

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      geoFallbackPrompt = true;
      provinceSelectEl?.focus();
      return;
    }
    locating = true;
    geoFallbackPrompt = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locating = false;
        userGeoCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      },
      () => {
        // Từ chối quyền vị trí hoặc lỗi định vị -> nhắc chọn tỉnh nhẹ nhàng, không báo lỗi đỏ
        locating = false;
        geoFallbackPrompt = true;
        provinceSelectEl?.focus();
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
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
    <div class="poster-wrap">
      <button
        type="button"
        class="poster-trigger"
        aria-expanded={posterOpen}
        aria-controls="poster-picker-box"
        onclick={togglePosterPicker}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Tải lịch hoa cả năm
      </button>

      {#if posterOpen}
        <div
          id="poster-picker-box"
          class="poster-dialog"
          role="region"
          aria-label="Tùy chọn tải poster lịch hoa 12 tháng"
        >
          <div class="poster-dialog-head">
            <strong>{posterTitle(today.year)}</strong>
            <button
              type="button"
              class="poster-close"
              aria-label="Đóng hộp chọn poster"
              onclick={() => (posterOpen = false)}
            >
              Đóng
            </button>
          </div>

          <div class="poster-field">
            <span class="poster-label">Chọn khổ ảnh</span>
            <div class="poster-sizes" role="group" aria-label="Chọn khổ poster">
              {#each POSTER_SIZE_LIST as s (s.key)}
                <button
                  type="button"
                  class="poster-size-btn"
                  aria-pressed={posterSize === s.key}
                  onclick={() => (posterSize = s.key)}
                >
                  <span class="size-name">{s.label}</span>
                  <small class="size-dim">({s.description})</small>
                </button>
              {/each}
            </div>
          </div>

          <div class="poster-field">
            <span class="poster-label">Chọn miền</span>
            <RegionSeg bind:region={posterRegion} label="Chọn miền cho poster" />
          </div>

          <div class="poster-actions">
            <button
              type="button"
              class="poster-download-btn"
              disabled={downloadingPoster}
              onclick={handleDownloadPoster}
            >
              {downloadingPoster
                ? 'Đang xuất PNG…'
                : `Tải PNG (${posterFilename(posterRegion, posterSize)})`}
            </button>
          </div>
        </div>
      {/if}
    </div>
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
  {#if !blooming.length}
    <p class="empty">Chưa có loài nào trong dữ liệu nở ở tháng {month}{region === 'all' ? '' : ' tại miền này'}.</p>
  {/if}
  <ul class="cards" class:empty-cards={!blooming.length}>
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
    <li>
      <Postcard
        variant="card"
        stamp="flower"
        postmark={`THÁNG ${month}\n${today.year}`}
        kicker="Gửi cuốn sổ hoa,"
        title="Còn bông nào đang nở mà cuốn sổ chưa biết?"
        body="Mỗi vùng một mùa hoa. Quê bạn có hoa đang nở mà ở đây chưa có thì kể mọi người nghe nhé."
        cta="Kể về một loài hoa"
        href={`/them-hoa?thang=${month}${region !== 'all' ? `&mien=${region}` : ''}`}
      />
    </li>
  </ul>
</section>

<section class="block where-today" aria-labelledby="hom-nay-di-dau">
  <div class="where-today-box">
    <div class="where-today-head">
      <div class="where-today-intro">
        <h2 id="hom-nay-di-dau">Hôm nay đi đâu?</h2>
        <p class="where-today-sub">
          Tìm tối đa 3 điểm ngắm gần bạn nhất có hoa đang nở hôm nay. Vị trí chỉ tính trên trình duyệt, không gửi lên máy chủ.
        </p>
      </div>
      <div class="where-today-controls">
        <button
          type="button"
          class="geo-btn"
          onclick={useMyLocation}
          disabled={locating}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path>
            <circle cx="12" cy="12" r="7"></circle>
          </svg>
          {locating ? 'Đang lấy vị trí…' : 'Dùng vị trí của tôi'}
        </button>
        <div class="prov-select-wrap">
          <label class="sr-only" for="where-province-select">Chọn tỉnh hoặc thành phố</label>
          <select
            id="where-province-select"
            bind:this={provinceSelectEl}
            value={selectedProvince}
            onchange={onProvinceSelectChange}
            aria-label="Chọn tỉnh hoặc thành phố"
          >
            <option value="">Chọn tỉnh / thành phố (34 tỉnh)…</option>
            {#each ['bac', 'trung', 'nam'] as const as r}
              <optgroup label={REGION_LABELS[r]}>
                {#each PROVINCES_BY_REGION[r] as prov}
                  <option value={prov}>{prov}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if geoFallbackPrompt}
      <p class="where-today-hint" role="status">
        Chưa lấy được vị trí thiết bị — bạn chọn tỉnh hoặc thành phố ở ô bên trên để xem điểm ngắm gần nhất nhé.
      </p>
    {/if}

    {#if activeCoords}
      {#if nearestSpots.length > 0}
        <ul class="nearest-list" aria-label="Điểm ngắm hoa gần nhất hôm nay">
          {#each nearestSpots as item (item.slug)}
            <li class="nearest-item">
              <div class="nearest-row-top">
                <span class="nearest-place-name">
                  <strong>{item.name}</strong>, <span class="nearest-prov">{item.province}</span>
                </span>
                <span class="nearest-meta">
                  <span class="nearest-dist">{item.distanceLabel}</span>
                  {#if item.maps_url}
                    <a
                      class="maps-link"
                      href={item.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >Mở Google Maps</a>
                  {/if}
                </span>
              </div>
              <ul class="nearest-flowers" aria-label="Các loài đang nở tại {item.name}">
                {#each item.flowers as f (f.slug)}
                  <li>
                    <span class="dot" style:background={f.color}></span>
                    <a href="/mua-hoa-viet/{f.slug}/">{f.name}</a>
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ul>
        <p class="where-today-source">
          Khoảng cách đường chim bay (Haversine) tính từ {activeCoords.label}. Nguồn toạ độ tỉnh: trung tâm hành chính 34 tỉnh/thành sau sáp nhập 2025 (Cục Đo đạc, Bản đồ và Thông tin địa lý VN / OpenStreetMap).
        </p>
      {:else}
        <p class="empty where-today-empty">
          Hôm nay chưa có điểm ngắm hoa nào đang nở trong dữ liệu. Nếu bạn biết một nơi đang vào mùa, ghim lại cho mọi người cùng ghé nhé!
        </p>
        <Postcard
          variant="row"
          stamp="pin"
          title="Biết một chỗ ngắm hoa đẹp ít người tìm tới?"
          body="Ghim lại cho người đi sau. Chỉ cần một link Google Maps."
          cta="Ghim lên bản đồ"
          href={`/them-dia-diem${region !== 'all' ? `?mien=${region}` : ''}`}
        />
      {/if}
    {/if}
  </div>
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
          <button
            type="button"
            class="soon-bell"
            aria-label="Nhắc mùa {f.name} (.ics)"
            title="Nhắc tôi mùa {f.name} (.ics)"
            onclick={() => downloadFlowerIcs(f, todayNoon)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </button>
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
      <Postcard
        variant="row"
        stamp="pin"
        title="Biết một chỗ ngắm hoa đẹp ít người tìm tới?"
        body="Ghim lại cho người đi sau. Chỉ cần một link Google Maps."
        cta="Ghim lên bản đồ"
        href={`/them-dia-diem${region !== 'all' ? `?mien=${region}` : ''}`}
      />
    </div>
  </div>
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

  .poster-wrap {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid #efeae1;
    display: grid;
    gap: var(--space-3);
  }
  .poster-trigger {
    justify-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px solid #d5cfc4;
    border-radius: 999px;
    background: #faf8f5;
    color: var(--color-text);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .poster-trigger:hover {
    border-color: var(--color-text);
    background: #f3eee5;
  }
  .poster-dialog {
    background: #faf8f5;
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    padding: var(--space-3);
    display: grid;
    gap: var(--space-3);
  }
  .poster-dialog-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: 0.9375rem;
  }
  .poster-close {
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .poster-close:hover {
    color: var(--color-text);
    background: #efeae1;
  }
  .poster-field {
    display: grid;
    gap: 6px;
  }
  .poster-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .poster-sizes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .poster-size-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 48px;
    padding: 6px 4px;
    border: 1px solid #d5cfc4;
    border-radius: 10px;
    background: #fff;
    color: var(--color-text);
    font: inherit;
    cursor: pointer;
    text-align: center;
  }
  .poster-size-btn[aria-pressed='true'] {
    background: var(--color-text);
    border-color: var(--color-text);
    color: #faf8f5;
  }
  .size-name {
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .size-dim {
    font-size: 0.6875rem;
    opacity: 0.8;
  }
  .poster-actions {
    display: flex;
  }
  .poster-download-btn {
    width: 100%;
    min-height: 42px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-text);
    border-radius: 999px;
    background: var(--color-text);
    color: #faf8f5;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }
  .poster-download-btn:disabled {
    opacity: 0.7;
    cursor: wait;
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
  .cards.empty-cards {
    margin-top: var(--space-3);
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
  .soon li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px dashed #b9b2a5;
    border-radius: 14px;
  }
  .soon a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1 1 auto;
    min-width: 0;
    padding: var(--space-1) 0;
    text-decoration: none;
  }
  .soon-bell {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid #d5cfc4;
    background: #fff;
    color: var(--color-text);
    display: inline-grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }
  .soon-bell:hover {
    border-color: var(--color-text);
    background: #f5f1e8;
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

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .where-today-box {
    background: #fff;
    border: 1px solid #e7e2d9;
    border-radius: 18px;
    padding: var(--space-4);
    display: grid;
    gap: var(--space-3);
  }
  .where-today-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .where-today-intro {
    flex: 1 1 240px;
    min-width: 0;
  }
  .where-today-intro h2 {
    margin-bottom: var(--space-1);
  }
  .where-today-sub {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    line-height: 1.45;
  }
  .where-today-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 280px;
    min-width: 0;
  }
  .geo-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 44px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text);
    border-radius: 999px;
    background: var(--color-text);
    color: #faf8f5;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .geo-btn:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .prov-select-wrap {
    flex: 1 1 200px;
    min-width: 0;
  }
  .prov-select-wrap select {
    width: 100%;
    min-height: 44px;
    padding: 0 var(--space-3);
    border: 1px solid #cfc9be;
    border-radius: 999px;
    background: #faf8f5;
    color: var(--color-text);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-sizing: border-box;
  }
  .prov-select-wrap select:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .where-today-hint {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: 12px;
    background: #f5f1e8;
    color: #4a453e;
    font-size: 0.875rem;
  }
  .nearest-list {
    display: grid;
    gap: var(--space-2);
    border-top: 1px solid #ece7de;
    padding-top: var(--space-3);
  }
  .nearest-item {
    display: grid;
    gap: 6px;
    padding: var(--space-3);
    border-radius: 14px;
    background: #faf8f5;
    border: 1px solid #ece7de;
  }
  .nearest-row-top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .nearest-place-name {
    font-size: 0.9375rem;
    min-width: 0;
  }
  .nearest-prov {
    color: var(--color-text-muted);
  }
  .nearest-meta {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .nearest-dist {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    background: #efeae1;
    color: #3a3630;
    font-size: 0.8125rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .nearest-flowers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    font-size: 0.875rem;
  }
  .nearest-flowers li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .nearest-flowers a {
    color: var(--color-text);
    font-weight: 600;
    text-decoration: underline;
  }
  .where-today-source {
    margin: 0;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }
  .where-today-empty {
    margin: 0;
    padding-top: var(--space-2);
    border-top: 1px solid #ece7de;
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
