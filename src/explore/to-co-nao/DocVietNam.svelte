<script lang="ts">
  import { onMount } from 'svelte';
  import defaultData from './data/default.json';
  import { loadChunk } from './dataLoader';
  import {
    STOPS,
    STOP_IMAGES,
    TOTAL_ROUTE_KM,
    STRAIGHT_LINE_KM,
    MILESTONES,
    NATIONAL_VIEWBOX,
    PROVINCE_CENTERS,
    PROVINCE_NAME_TO_SLUG,
    positionAt,
    nearestStop,
    regionAt,
    milestonesCrossed,
    getJourneyProvinces,
    calculateZoomWindow,
    createAutoPlaySchedule,
    getAutoPlayStateAtTime,
    type JourneyPosition,
    type Milestone,
    type StopPoint,
    type StopImage,
  } from './docVietNam';
  import { formatNumberVi } from './math';

  interface Props {
    onCompareWithOther: () => void;
  }

  let { onCompareWithOther }: Props = $props();

  // Hình bản đồ Việt Nam mặc định (toàn vẹn lãnh thổ gồm đất liền, Hoàng Sa, Trường Sa)
  const vnSvgD: string = (defaultData as Record<string, string>)['viet-nam'] || '';

  // Dữ liệu hình ranh giới tỉnh thành nạp động
  let vnShapes = $state<Record<string, string>>({});

  // Tiến độ hành trình: 0 (Lũng Cú) -> 1 (Mũi Cà Mau)
  let progress = $state(0);

  // Vị trí hiện tại tính theo km
  const currentPos: JourneyPosition = $derived(positionAt(progress));

  // Kiểm tra cuối hành trình (>= 99%)
  const isFinished = $derived(progress >= 0.99);

  // Điểm dừng gần nhất
  const currentNearest: StopPoint = $derived(nearestStop(currentPos.km));

  // Ảnh hiện tại và ảnh kế tiếp
  const currentImage: StopImage | undefined = $derived(STOP_IMAGES[String(currentNearest.id)]);
  const nextStopIndex = $derived(Math.min(STOPS.length - 1, currentNearest.id));
  const nextStop: StopPoint = $derived(STOPS[nextStopIndex]);
  const nextImage: StopImage | undefined = $derived(STOP_IMAGES[String(nextStop.id)]);

  // Vùng khí hậu / địa hình
  const currentRegion = $derived(regionAt({ stopIndex: currentNearest.id - 1 }));

  // Thông tin tỉnh hiện tại và các tỉnh đã đi qua (khi kết thúc là Cà Mau)
  const provinceInfo = $derived(getJourneyProvinces(currentPos.segIndex, isFinished));
  const currentProvinceSlug = $derived(PROVINCE_NAME_TO_SLUG[provinceInfo.currentProvince] || '');

  // Mốc so sánh vừa vượt qua gần nhất
  let latestMilestone = $state<Milestone | null>(null);
  let showMilestoneToast = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let prevKm = 0;
  const firedKm = new Set<number>();

  // Số km hiển thị đếm mượt
  let displayKm = $state(0);
  let prefersReduced = $state(false);

  // Toạ độ các điểm trên tuyến cho SVG
  const allStopPoints = STOPS.map((s) => `${s.x},${s.y}`).join(' ');

  // Đường đã đi (polyline)
  const traversedPoints = $derived.by(() => {
    const pts: string[] = [];
    for (let i = 0; i <= currentPos.segIndex; i++) {
      pts.push(`${STOPS[i].x},${STOPS[i].y}`);
    }
    pts.push(`${currentPos.x},${currentPos.y}`);
    return pts.join(' ');
  });

  // Aria valuetext cho thanh trượt
  const ariaValueText = $derived(
    `Đã đi ${formatNumberVi(displayKm)} km, đang ở ${provinceInfo.currentProvince}`
  );

  // Cấu hình style và biểu tượng theo loại địa danh
  const CATEGORY_META: Record<string, { icon: string; bg: string; color: string; border: string }> = {
    'Lịch sử': { icon: '🏛️', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
    'Núi': { icon: '⛰️', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
    'Thiên nhiên': { icon: '🌿', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
    'Biển': { icon: '🌊', bg: '#ecfeff', color: '#155e75', border: '#a5f3fc' },
    'Thành phố': { icon: '🏙️', bg: '#eef2ff', color: '#3730a3', border: '#c7d2fe' },
    'Ẩm thực': { icon: '🍜', bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  };

  const currentCategoryMeta = $derived(
    CATEGORY_META[currentNearest.type] || {
      icon: '📍',
      bg: '#f1f5f9',
      color: '#334155',
      border: '#cbd5e1',
    }
  );

  // Cửa sổ zoom lerp mỗi frame
  let vbX = $state(NATIONAL_VIEWBOX.x);
  let vbY = $state(NATIONAL_VIEWBOX.y);
  let vbW = $state(NATIONAL_VIEWBOX.width);
  let vbH = $state(NATIONAL_VIEWBOX.height);

  // Chuỗi viewBox được nội suy
  const currentViewBox = $derived(`${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`);
  const isZoomed = $derived(progress > 0.01 && progress < 0.985);

  // Chế độ "▶ Tự đi"
  let isAutoPlaying = $state(false);
  const autoPlaySchedule = createAutoPlaySchedule(STOPS, 60000, 1500);
  let autoPlayElapsedMs = 0;
  let lastFrameTime = 0;
  let autoPlayRafId: number | null = null;

  // Tham chiếu DOM danh sách chip đã qua để tự cuộn
  let chipsContainer = $state<HTMLDivElement | null>(null);

  // Bắn confetti khi hoàn thành
  let showConfetti = $state(false);
  let hasShownConfetti = false;

  // Cập nhật mốc so sánh và đếm số km mượt
  $effect(() => {
    const curKm = currentPos.km;

    // Kiểm tra các mốc đã vượt qua
    const crossed = milestonesCrossed(prevKm, curKm).filter((m) => !firedKm.has(m.km));
    if (crossed.length > 0) {
      for (const m of crossed) firedKm.add(m.km);
      latestMilestone = crossed[crossed.length - 1];
      showMilestoneToast = true;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        showMilestoneToast = false;
      }, 5000);
    }
    prevKm = curKm;

    // Đếm mượt km
    if (prefersReduced) {
      displayKm = Math.round(curKm);
    } else {
      const diff = curKm - displayKm;
      if (Math.abs(diff) < 1) {
        displayKm = Math.round(curKm);
      } else {
        displayKm = Math.round(displayKm + diff * 0.28);
      }
    }

    // Hiệu ứng confetti khi đi đến cuối
    if (isFinished && !hasShownConfetti) {
      hasShownConfetti = true;
      showConfetti = true;
      setTimeout(() => {
        showConfetti = false;
      }, 4500);
    }
  });

  // Tự động cuộn danh sách chip "Đã qua" đến chip mới nhất
  $effect(() => {
    if (provinceInfo.currentProvince && chipsContainer) {
      chipsContainer.scrollTo({
        left: chipsContainer.scrollWidth,
        behavior: prefersReduced ? 'instant' : 'smooth',
      });
    }
  });

  // Vòng lặp animation mượt cho viewBox zoom và auto-play
  onMount(() => {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Nạp lười ranh giới 34 tỉnh thành từ chunk vn
    loadChunk('vn').then((data) => {
      if (data) vnShapes = data as Record<string, string>;
    });

    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(now - lastTime, 100);
      lastTime = now;

      // 1. Cập nhật vị trí zoom (lerp damping)
      const targetWindow = calculateZoomWindow(progress, currentPos);
      if (prefersReduced) {
        vbX = targetWindow.x;
        vbY = targetWindow.y;
        vbW = targetWindow.width;
        vbH = targetWindow.height;
      } else {
        const lerpFactor = 0.085;
        vbX += (targetWindow.x - vbX) * lerpFactor;
        vbY += (targetWindow.y - vbY) * lerpFactor;
        vbW += (targetWindow.width - vbW) * lerpFactor;
        vbH += (targetWindow.height - vbH) * lerpFactor;
      }

      // 2. Cập nhật chế độ tự đi nếu đang bật
      if (isAutoPlaying) {
        autoPlayElapsedMs += dt;
        const state = getAutoPlayStateAtTime(autoPlayElapsedMs, autoPlaySchedule, prefersReduced);
        progress = state.progress;
        if (state.isFinished) {
          isAutoPlaying = false;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (toastTimer) clearTimeout(toastTimer);
    };
  });

  function toggleAutoPlay() {
    if (isAutoPlaying) {
      isAutoPlaying = false;
    } else {
      if (progress >= 0.999) {
        progress = 0;
      }
      // Tính lại mốc elapsedMs gần nhất với tiến độ hiện tại
      const totalDur = autoPlaySchedule.totalDurationMs;
      autoPlayElapsedMs = Math.max(0, Math.min(totalDur, progress * totalDur));
      isAutoPlaying = true;
    }
  }

  function handleResetJourney() {
    isAutoPlaying = false;
    progress = 0;
    firedKm.clear();
    prevKm = 0;
    latestMilestone = null;
    showMilestoneToast = false;
    displayKm = 0;
    hasShownConfetti = false;
    showConfetti = false;
  }

  function handleRangeInput(e: Event) {
    isAutoPlaying = false;
    const target = e.target as HTMLInputElement;
    progress = parseFloat(target.value);
  }

  function handleMapWheel(e: WheelEvent) {
    isAutoPlaying = false;
    e.preventDefault();
    const step = 0.015;
    if (e.deltaY > 0) {
      progress = Math.min(1, progress + step);
    } else {
      progress = Math.max(0, progress - step);
    }
  }

  function jumpToStop(stop: StopPoint) {
    isAutoPlaying = false;
    const targetProgress = Math.min(1, Math.max(0, stop.kmFromStart / TOTAL_ROUTE_KM));
    if (prefersReduced) {
      progress = targetProgress;
    } else {
      // Tween mượt đến điểm dừng
      const startProg = progress;
      const startTime = performance.now();
      const dur = 400;
      const stepTween = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / dur);
        // Easing cubic out
        const ease = 1 - Math.pow(1 - t, 3);
        progress = startProg + (targetProgress - startProg) * ease;
        if (t < 1) {
          requestAnimationFrame(stepTween);
        }
      };
      requestAnimationFrame(stepTween);
    }
  }

  function jumpToNextStop() {
    isAutoPlaying = false;
    const curKm = currentPos.km;
    const next = STOPS.find((s) => s.kmFromStart > curKm + 5);
    if (next) {
      jumpToStop(next);
    } else {
      progress = 1;
    }
  }

  function jumpToPrevStop() {
    isAutoPlaying = false;
    const curKm = currentPos.km;
    const prev = [...STOPS].reverse().find((s) => s.kmFromStart < curKm - 5);
    if (prev) {
      jumpToStop(prev);
    } else {
      progress = 0;
    }
  }

  // Điều khiển bàn phím
  function handleKeyDown(e: KeyboardEvent) {
    const active = document.activeElement;
    const isDocFocused = active?.closest('.doc-viet-nam');
    if (!isDocFocused && active !== document.body) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      isAutoPlaying = false;
      progress = Math.min(1, progress + 0.008);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      isAutoPlaying = false;
      progress = Math.max(0, progress - 0.008);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      jumpToNextStop();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      jumpToPrevStop();
    } else if (e.key === 'Home') {
      e.preventDefault();
      isAutoPlaying = false;
      progress = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      isAutoPlaying = false;
      progress = 1;
    } else if (e.key === ' ') {
      // Spacebar toggles autoplay
      if (active === document.body || active?.classList.contains('desktop-slider')) {
        e.preventDefault();
        toggleAutoPlay();
      }
    }
  }

  // Hỗ trợ chạm kéo trên bản đồ mobile
  let touchStartY = 0;
  let touchStartProg = 0;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      isAutoPlaying = false;
      touchStartY = e.touches[0].clientY;
      touchStartProg = progress;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 1) {
      const deltaY = e.touches[0].clientY - touchStartY;
      const progressDelta = deltaY / 420;
      progress = Math.max(0, Math.min(1, touchStartProg + progressDelta));
    }
  }

  // Kiểm tra tỉnh có gần vị trí hiện tại để hiện nhãn nhỏ khi zoom
  function isProvinceNearby(px: number, py: number): boolean {
    const dx = px - currentPos.x;
    const dy = py - currentPos.y;
    return dx * dx + dy * dy < 280 * 280;
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Link preload ảnh của điểm kế tiếp -->
{#if nextImage}
  <link rel="prefetch" href={nextImage.src} as="image" />
{/if}

<section
  class="doc-viet-nam"
  style="background: {currentRegion.bgGradient};"
  aria-label="Khám phá chiều dài Việt Nam từ Bắc vào Nam"
>
  <!-- Header tiêu đề gọn gàng phong cách neal.fun -->
  <header class="doc-header">
    <div class="header-badge">Hành trình dọc chiều dài đất nước</div>
    <h1 class="doc-title">Bạn nghĩ Việt Nam dài đến mức nào?</h1>
    <p class="doc-hint">
      Kéo thanh trượt hoặc bấm <strong>▶ Tự đi</strong> để du hành từ cực Bắc xuống cực Nam
      <span class="keyboard-hint">(phím ↑↓, PageUp / PageDown)</span>
    </p>
  </header>

  <!-- Lưới 2 cột chính: TRÁI ~42% câu chuyện, PHẢI ~58% bản đồ zoom -->
  <div class="doc-body">
    <!-- CỘT TRÁI: Câu chuyện & Thẻ địa danh nhân vật chính -->
    <div class="doc-story-col" aria-live="polite">
      <!-- 1. Dòng km lớn đếm mượt + thanh tiến độ + "Đang ở: <tỉnh>" -->
      <div class="stats-card">
        <div class="km-header-row">
          <div class="km-stat">
            <span class="km-label">Đã đi khoảng</span>
            <div class="km-number-row">
              <span class="km-value">{formatNumberVi(Math.round(displayKm))}</span>
              <span class="km-unit">km</span>
              <span class="km-total">/ ~{formatNumberVi(Math.round(TOTAL_ROUTE_KM))} km</span>
            </div>
          </div>
          <div class="current-province-box">
            <span class="prov-tag">Đang ở</span>
            {#key provinceInfo.currentProvince}
              <strong class="prov-name slide-fade">{provinceInfo.currentProvince}</strong>
            {/key}
          </div>
        </div>

        <div class="km-progress-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div class="km-progress-fill" style="width: {(progress * 100).toFixed(1)}%;"></div>
        </div>
      </div>

      <!-- 2. THẺ ĐỊA DANH (LỚN, NHÂN VẬT CHÍNH) -->
      <article class="hero-card">
        <!-- Ảnh 16:9 với hiệu ứng crossfade & ken-burns -->
        {#key currentNearest.id}
          <div class="hero-image-container">
            {#if currentImage}
              <img
                src={currentImage.src}
                alt={currentNearest.name}
                width={currentImage.w}
                height={currentImage.h}
                class="hero-img ken-burns"
                loading="lazy"
                decoding="async"
              />
            {:else}
              <div
                class="hero-img-fallback"
                style="background: {currentCategoryMeta.bg}; border: 1px solid {currentCategoryMeta.border};"
              >
                <span class="fallback-icon" aria-hidden="true">{currentCategoryMeta.icon}</span>
                <span class="fallback-title">{currentNearest.name}</span>
              </div>
            {/if}

            <div class="hero-index-pill">
              #{currentNearest.id} / 32
            </div>
          </div>
        {/key}

        <!-- Ghi công ảnh nhỏ gọn -->
        {#if currentImage}
          <div class="hero-attribution">
            <span class="attr-author" title={currentImage.tacGia}>Ảnh: {currentImage.tacGia}</span>
            <span class="attr-sep">·</span>
            <span class="attr-license">{currentImage.giayPhep}</span>
            <span class="attr-sep">·</span>
            <a href={currentImage.nguon} target="_blank" rel="noopener noreferrer" class="attr-link">
              Wikimedia ↗
            </a>
          </div>
        {/if}

        <!-- Thông tin chi tiết địa danh -->
        <div class="hero-info">
          <div class="hero-title-row">
            <h2 class="hero-name">{currentNearest.name}</h2>
            <div class="hero-chips">
              <span class="chip chip-province">
                📍 {currentNearest.province}
              </span>
              <span
                class="chip chip-category pop-anim"
                style="color: {currentCategoryMeta.color}; background: {currentCategoryMeta.bg}; border-color: {currentCategoryMeta.border};"
              >
                <span class="chip-icon" aria-hidden="true">{currentCategoryMeta.icon}</span>
                {currentNearest.type}
              </span>
            </div>
          </div>

          <!-- Đoạn mô tả 2-3 câu -->
          <p class="hero-desc">{currentNearest.description}</p>

          <!-- Dòng "Bạn có biết?" -->
          <div class="hero-fact-row">
            <span class="fact-tag" aria-hidden="true">💡 Bạn có biết?</span>
            <p class="fact-text">{currentNearest.fact}</p>
          </div>
        </div>
      </article>

      <!-- 3. Badge vùng khí hậu + Mốc so sánh khoảng cách -->
      <div class="context-row">
        <!-- Vùng khí hậu -->
        <div class="region-box">
          <div class="region-pill-row">
            <span
              class="region-badge flip-anim"
              style="color: {currentRegion.badgeColor}; background: {currentRegion.badgeBg}; border-color: {currentRegion.badgeColor}33;"
            >
              {currentRegion.name}
            </span>
          </div>
          <p class="region-text">{currentRegion.description}</p>
        </div>

        <!-- Toast / Callout mốc so sánh khoảng cách -->
        {#if latestMilestone}
          <div class="milestone-callout" class:highlight-anim={showMilestoneToast}>
            <span class="milestone-icon" aria-hidden="true">🎯</span>
            <div class="milestone-text">
              <strong>Mốc {formatNumberVi(latestMilestone.km)} km:</strong>
              <span>{latestMilestone.comparison}</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- 4. Chip "Đã qua" 1 dòng cuộn ngang tự động -->
      <div class="passed-provinces-section">
        <div class="passed-header">
          <span class="passed-title">
            Tỉnh thành đã đi qua ({provinceInfo.passedProvinces.length} / 34 tỉnh):
          </span>
        </div>
        <div class="chips-scroll-row" bind:this={chipsContainer}>
          {#each provinceInfo.passedProvinces as prov}
            <span
              class="province-chip"
              class:is-current={prov === provinceInfo.currentProvince}
            >
              {prov}
            </span>
          {/each}
        </div>
      </div>
    </div>

    <!-- CỘT PHẢI: Bản đồ zoom theo vị trí + Mini-map + Thanh trượt dọc -->
    <div class="doc-map-col">
      <!-- Nút điều khiển "▶ Tự đi" nổi bật -->
      <div class="map-controls-bar">
        <button
          type="button"
          class="autoplay-btn"
          class:is-active={isAutoPlaying}
          onclick={toggleAutoPlay}
          aria-label={isAutoPlaying ? 'Tạm dừng hành trình tự động' : 'Tự động chạy hành trình'}
        >
          <span class="autoplay-icon" aria-hidden="true">
            {isAutoPlaying ? '⏸' : '▶'}
          </span>
          <span class="autoplay-text">
            {isAutoPlaying ? 'Tạm dừng' : 'Tự đi (~60s)'}
          </span>
        </button>

        {#if isZoomed}
          <button
            type="button"
            class="zoom-reset-btn"
            onclick={() => { progress = 0; }}
            title="Xem toàn cảnh Việt Nam"
          >
            🔍 Toàn cảnh
          </button>
        {/if}
      </div>

      <!-- Bản đồ SVG chính với viewBox nội suy mượt -->
      <div
        class="map-viewport"
        onwheel={handleMapWheel}
        ontouchstart={handleTouchStart}
        ontouchmove={handleTouchMove}
        role="region"
        aria-label="Bản đồ tương tác tuyến hành trình Việt Nam"
      >
        <svg
          class="vn-main-svg"
          viewBox={currentViewBox}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <!-- Hoa văn sóng biển nhẹ nhàng -->
            <pattern id="seaPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 0 20 Q 10 16 20 20 T 40 20"
                fill="none"
                stroke="#0284c7"
                stroke-width="0.75"
                opacity="0.12"
              />
            </pattern>

            <!-- Gradient người đi -->
            <radialGradient id="travelerHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#2563eb" stop-opacity="0.75" />
              <stop offset="60%" stop-color="#3b82f6" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- Nền biển nhẹ -->
          <rect
            x="-600"
            y="-1000"
            width="2200"
            height="2200"
            fill="url(#seaPattern)"
          />

          <!-- Hình bóng Việt Nam toàn quốc (nền chung) -->
          <path
            d={vnSvgD}
            class="vn-land-base"
          />

          <!-- Ranh giới 34 tỉnh thành từ vn.json hiển thị mờ, tô nhẹ tỉnh đang ở khi zoom -->
          <g class="provinces-layer">
            {#each Object.entries(PROVINCE_CENTERS) as [slug, info]}
              {@const shapeD = (vnShapes as Record<string, string>)[slug]}
              {@const isCurrentProv = currentProvinceSlug === slug}
              {#if shapeD}
                <g transform="translate({info.x}, {info.y})">
                  <path
                    d={shapeD}
                    class="province-boundary"
                    class:is-active-province={isCurrentProv}
                  />
                  <!-- Hiện tên các tỉnh lân cận khi zoom vào -->
                  {#if isZoomed && isProvinceNearby(info.x, info.y)}
                    <text
                      x="0"
                      y="4"
                      text-anchor="middle"
                      class="province-label"
                      class:is-active-label={isCurrentProv}
                    >
                      {info.name}
                    </text>
                  {/if}
                </g>
              {/if}
            {/each}
          </g>

          <!-- Nhãn biển đảo chủ quyền Việt Nam -->
          <text x="500" y="-120" class="sea-sovereignty-label">BIỂN ĐÔNG</text>
          <text x="610" y="0" class="island-sovereignty-label">QĐ. Hoàng Sa</text>
          <text x="860" y="720" class="island-sovereignty-label">QĐ. Trường Sa</text>

          <!-- Tuyến hành trình đứt nét nền -->
          <polyline
            points={allStopPoints}
            class="route-line-bg"
          />

          <!-- Tuyến hành trình đã đi vẽ đậm hiệu ứng sinh động -->
          <polyline
            points={traversedPoints}
            class="route-line-traversed"
          />

          <!-- Đường thẳng Lũng Cú – Cà Mau (đứt nét) khi hoàn thành (>= 99%) -->
          {#if isFinished}
            <line
              x1={STOPS[0].x}
              y1={STOPS[0].y}
              x2={STOPS[31].x}
              y2={STOPS[31].y}
              class="straight-flight-line"
            />
            <text
              x={(STOPS[0].x + STOPS[31].x) / 2 - 90}
              y={(STOPS[0].y + STOPS[31].y) / 2}
              class="straight-flight-label"
            >
              Đường thẳng: ~{formatNumberVi(Math.round(STRAIGHT_LINE_KM))} km
            </text>
          {/if}

          <!-- 32 điểm dừng trên bản đồ (có thể bấm để di chuyển tới) -->
          {#each STOPS as stop, idx}
            {@const isPassed = stop.kmFromStart <= currentPos.km}
            {@const isCurrent = stop.id === currentNearest.id}
            <g
              class="stop-marker-group"
              transform="translate({stop.x}, {stop.y})"
              onclick={() => jumpToStop(stop)}
              role="button"
              tabindex="0"
              aria-label="Điểm dừng #{stop.id}: {stop.name}"
            >
              <!-- Vòng pulse khi đang ở điểm này -->
              {#if isCurrent}
                <circle r="22" class="stop-pulse-ring" />
              {/if}

              <!-- Chấm điểm dừng -->
              <circle
                r={isCurrent ? 8.5 : isPassed ? 6 : 4.5}
                class="stop-circle"
                class:passed={isPassed}
                class:current={isCurrent}
              />

              <!-- Tên điểm dừng chính hoặc điểm đang xem -->
              {#if isCurrent || idx === 0 || idx === 31 || (isZoomed && Math.abs(stop.id - currentNearest.id) <= 2)}
                <text
                  x={stop.x > 100 ? -12 : 14}
                  y="4"
                  text-anchor={stop.x > 100 ? 'end' : 'start'}
                  class="stop-marker-text"
                  class:active-text={isCurrent}
                >
                  {stop.name}
                </text>
              {/if}
            </g>
          {/each}

          <!-- "Người đi": icon di chuyển dọc tuyến, xoay theo góc đường và nhún nhẹ -->
          <g
            class="traveler-group"
            transform="translate({currentPos.x}, {currentPos.y}) rotate({currentPos.angleDeg})"
          >
            <circle r="26" fill="url(#travelerHalo)" class="traveler-halo" />
            <g class="traveler-vehicle" class:moving={isAutoPlaying}>
              <!-- Thân xe máy / biểu tượng người đi thu nhỏ -->
              <circle r="8" class="traveler-body" />
              <!-- Mũi tên định hướng hành trình -->
              <polygon points="0,-12 6,-3 -6,-3" fill="#ffffff" />
              <circle r="3" fill="#ffffff" />
            </g>
          </g>
        </svg>

        <!-- Bản đồ mini toàn quốc thu nhỏ ở góc dưới -->
        <div class="mini-map-box" aria-hidden="true">
          <span class="mini-map-tag">Toàn cảnh</span>
          <svg
            class="mini-map-svg"
            viewBox="-460 -800 1740 1840"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Hình bóng Việt Nam -->
            <path d={vnSvgD} class="mini-vn-land" />
            <!-- Tuyến đường -->
            <polyline points={allStopPoints} class="mini-route" />
            <!-- Khung chữ nhật hiển thị vùng đang zoom -->
            <rect
              x={vbX}
              y={vbY}
              width={vbW}
              height={vbH}
              class="mini-view-indicator"
            />
            <!-- Chấm vị trí hiện tại -->
            <circle cx={currentPos.x} cy={currentPos.y} r="35" class="mini-traveler-dot" />
          </svg>
        </div>
      </div>

      <!-- Cột thanh trượt dọc bên phải (Desktop) -->
      <div class="slider-wrapper desktop-only">
        <span class="slider-end-label top-label">
          <span class="point-badge north">Bắc</span>
          Lũng Cú
        </span>

        <div class="slider-track-container">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            oninput={handleRangeInput}
            class="desktop-slider"
            aria-label="Hành trình dọc Việt Nam"
            aria-valuetext={ariaValueText}
            orient="vertical"
          />
        </div>

        <span class="slider-end-label bottom-label">
          <span class="point-badge south">Nam</span>
          Cà Mau
        </span>
      </div>
    </div>
  </div>

  <!-- Thanh trượt ngang dính đáy trên mobile (< 1024px) -->
  <div class="mobile-slider-bar mobile-only">
    <div class="mobile-controls-row">
      <button
        type="button"
        class="mobile-autoplay-btn"
        class:is-active={isAutoPlaying}
        onclick={toggleAutoPlay}
      >
        {isAutoPlaying ? '⏸ Tạm dừng' : '▶ Tự đi'}
      </button>

      <span class="mobile-slider-current">
        {provinceInfo.currentProvince} ({formatNumberVi(Math.round(displayKm))} km)
      </span>
    </div>

    <div class="mobile-slider-track-wrap">
      <span class="mobile-point-tag">Lũng Cú</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={progress}
        oninput={handleRangeInput}
        class="mobile-slider"
        aria-label="Hành trình dọc Việt Nam"
        aria-valuetext={ariaValueText}
      />
      <span class="mobile-point-tag">Cà Mau</span>
    </div>
  </div>

  <!-- Màn tổng kết khi hoàn thành (>= 99%) -->
  {#if isFinished}
    <div class="summary-overlay">
      <div class="summary-card" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <div class="summary-icon" aria-hidden="true">🎉</div>
        <h2 id="summary-title" class="summary-title">
          Bạn vừa đi khoảng {formatNumberVi(Math.round(TOTAL_ROUTE_KM))} km qua 32 danh thắng tuyệt đẹp của Việt Nam!
        </h2>
        <p class="summary-narrow-fact">
          Và Việt Nam chỗ hẹp nhất chỉ khoảng <strong>50 km</strong> (tại Quảng Bình / Quảng Trị, từ biển tới biên giới Lào).
        </p>
        <p class="summary-straight-fact">
          Khoảng cách đường thẳng Lũng Cú – Mũi Cà Mau: <strong>khoảng {formatNumberVi(Math.round(STRAIGHT_LINE_KM))} km</strong>.
        </p>

        <div class="summary-actions">
          <button
            type="button"
            class="summary-btn primary"
            onclick={onCompareWithOther}
          >
            So sánh Việt Nam với nước khác ↓
          </button>
          <button
            type="button"
            class="summary-btn secondary"
            onclick={handleResetJourney}
          >
            Đi lại từ đầu
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Confetti chúc mừng nhẹ nhàng khi về đích -->
  {#if showConfetti}
    <div class="confetti-container" aria-hidden="true">
      {#each Array(24) as _, i}
        <span class="confetti-piece" style="--i: {i};"></span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .doc-viet-nam {
    position: relative;
    width: 100%;
    max-width: 100vw;
    min-height: 100svh;
    overflow-x: clip;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 0.75rem 1.25rem 0.75rem;
    transition: background 0.6s ease;
    font-family: inherit;
    color: var(--color-text, #1f1d1a);
  }

  .doc-header {
    text-align: center;
    margin-bottom: 0.75rem;
    flex-shrink: 0;
  }

  .header-badge {
    display: inline-block;
    padding: 0.2rem 0.65rem;
    background: rgba(37, 99, 235, 0.08);
    color: #2563eb;
    border: 1px solid rgba(37, 99, 235, 0.2);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  .doc-title {
    font-size: 1.625rem;
    font-weight: 800;
    margin: 0;
    line-height: 1.25;
    color: var(--color-text, #1f1d1a);
  }

  .doc-hint {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b665f);
    margin: 0.25rem 0 0;
  }

  .keyboard-hint {
    opacity: 0.75;
    font-size: 0.8125rem;
  }

  /* Bố cục desktop (≥ 1024px): 2 cột TRÁI ~42%, PHẢI ~58% */
  .doc-body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(360px, 42%) 1fr;
    gap: 1.25rem;
    position: relative;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* Cột trái: Câu chuyện và thẻ địa danh */
  .doc-story-col {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    overflow-y: auto;
    padding-right: 0.5rem;
    max-height: calc(100svh - 110px);
    box-sizing: border-box;
  }

  /* 1. Thẻ số km */
  .stats-card {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1rem;
    padding: 0.85rem 1.1rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }

  .km-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 0.4rem;
  }

  .km-stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .km-label {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--color-text-muted, #6b665f);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .km-number-row {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .km-value {
    font-size: 2.25rem;
    font-weight: 900;
    color: #1e3a8a;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .km-unit {
    font-size: 1.125rem;
    font-weight: 800;
    color: #2563eb;
  }

  .km-total {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #94a3b8;
    margin-left: 0.25rem;
  }

  .current-province-box {
    text-align: right;
  }

  .prov-tag {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
    text-transform: uppercase;
  }

  .prov-name {
    display: block;
    font-size: 1.125rem;
    font-weight: 800;
    color: #0f172a;
  }

  .km-progress-bar {
    width: 100%;
    height: 7px;
    background: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
  }

  .km-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #2563eb, #1d4ed8);
    border-radius: 9999px;
    transition: width 0.15s ease-out;
  }

  /* 2. Thẻ địa danh chính */
  .hero-card {
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1.25rem;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .hero-card:hover {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.09);
  }

  .hero-image-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #0f172a;
  }

  .hero-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity 0.4s ease;
  }

  .ken-burns {
    animation: fadeInCross 0.4s ease-out forwards, kenBurnsSlow 10s ease-out forwards;
  }

  @keyframes fadeInCross {
    from {
      opacity: 0;
      transform: scale(1.05);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes kenBurnsSlow {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(1.08);
    }
  }

  .hero-img-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .fallback-icon {
    font-size: 3rem;
  }

  .fallback-title {
    font-size: 1rem;
    font-weight: 700;
  }

  .hero-index-pill {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    padding: 0.2rem 0.55rem;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: #ffffff;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .hero-attribution {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.85rem;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.6875rem;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .attr-author {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .attr-sep {
    opacity: 0.4;
  }

  .attr-link {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
  }

  .attr-link:hover {
    text-decoration: underline;
  }

  .hero-info {
    padding: 1rem 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .hero-title-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .hero-name {
    font-size: 1.375rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    line-height: 1.25;
  }

  .hero-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.71875rem;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .chip-province {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
  }

  .pop-anim {
    animation: chipPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes chipPop {
    0% {
      transform: scale(0.85);
      opacity: 0.5;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .hero-desc {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #334155;
    margin: 0;
  }

  .hero-fact-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.55rem 0.75rem;
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 0.65rem;
  }

  .fact-tag {
    font-size: 0.71875rem;
    font-weight: 800;
    color: #b45309;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .fact-text {
    font-size: 0.8125rem;
    line-height: 1.4;
    color: #78350f;
    margin: 0;
  }

  /* 3. Vùng khí hậu & Mốc so sánh */
  .context-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .region-box {
    padding: 0.65rem 0.85rem;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .region-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 0.45rem;
    font-size: 0.75rem;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .region-text {
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--color-text, #1f1d1a);
    margin: 0;
  }

  .milestone-callout {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.85rem;
    background: #fefce8;
    border: 1px solid #fde047;
    border-radius: 0.85rem;
    font-size: 0.8125rem;
    color: #854d0e;
    box-shadow: 0 4px 12px rgba(234, 179, 8, 0.15);
    animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .milestone-callout.highlight-anim {
    animation: toastBounce 0.5s ease-in-out;
  }

  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes toastBounce {
    0% { transform: scale(0.96); }
    50% { transform: scale(1.04); }
    100% { transform: scale(1); }
  }

  .milestone-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .milestone-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    line-height: 1.35;
  }

  /* 4. Danh sách chip đã qua */
  .passed-provinces-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .passed-title {
    font-size: 0.71875rem;
    font-weight: 700;
    color: var(--color-text-muted, #6b665f);
  }

  .chips-scroll-row {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 0.3rem;
    padding-bottom: 4px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }

  .province-chip {
    flex-shrink: 0;
    padding: 0.18rem 0.5rem;
    background: #f1f5f9;
    color: #475569;
    border-radius: 0.4rem;
    font-size: 0.6875rem;
    font-weight: 600;
    white-space: nowrap;
    transition: background 0.2s, color 0.2s;
  }

  .province-chip.is-current {
    background: #dbeafe;
    color: #1e40af;
    font-weight: 800;
    border: 1px solid #bfdbfe;
  }

  /* Cột phải: Bản đồ Zoom + Slider dọc */
  .doc-map-col {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    height: calc(100svh - 110px);
    min-height: 480px;
  }

  .map-controls-bar {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .autoplay-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 9999px;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 700;
    color: #1e3a8a;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .autoplay-btn:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    transform: translateY(-1px);
  }

  .autoplay-btn.is-active {
    background: #2563eb;
    color: #ffffff;
    border-color: #1d4ed8;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
  }

  .zoom-reset-btn {
    padding: 0.45rem 0.75rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #cbd5e1;
    border-radius: 9999px;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
    backdrop-filter: blur(4px);
  }

  .map-viewport {
    position: relative;
    flex: 1;
    height: 100%;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1.5rem;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    cursor: grab;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04);
  }

  .vn-main-svg {
    width: 100%;
    height: 100%;
    display: block;
    filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.06));
  }

  .vn-land-base {
    fill: #fdfbf7;
    stroke: #cbd5e1;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .province-boundary {
    fill: transparent;
    stroke: #94a3b8;
    stroke-width: 0.75;
    opacity: 0.4;
    transition: fill 0.3s ease, opacity 0.3s ease;
  }

  .province-boundary.is-active-province {
    fill: rgba(59, 130, 246, 0.12);
    stroke: #2563eb;
    stroke-width: 1.5;
    opacity: 0.9;
  }

  .province-label {
    font-size: 14px;
    font-weight: 600;
    fill: #64748b;
    opacity: 0.75;
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .province-label.is-active-label {
    font-size: 16px;
    font-weight: 800;
    fill: #1d4ed8;
    opacity: 1;
  }

  .sea-sovereignty-label {
    font-size: 26px;
    font-weight: 800;
    fill: #0284c7;
    letter-spacing: 6px;
    opacity: 0.35;
  }

  .island-sovereignty-label {
    font-size: 20px;
    font-weight: 700;
    fill: #475569;
    opacity: 0.65;
  }

  .route-line-bg {
    fill: none;
    stroke: #94a3b8;
    stroke-width: 3.5;
    stroke-dasharray: 6 6;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.5;
  }

  .route-line-traversed {
    fill: none;
    stroke: #2563eb;
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .straight-flight-line {
    stroke: #dc2626;
    stroke-width: 3.5;
    stroke-dasharray: 8 8;
    stroke-linecap: round;
    animation: dashLoop 1.2s linear infinite;
  }

  .straight-flight-label {
    font-size: 22px;
    font-weight: 800;
    fill: #b91c1c;
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 6px;
  }

  .stop-marker-group {
    cursor: pointer;
    outline: none;
  }

  .stop-circle {
    fill: #ffffff;
    stroke: #94a3b8;
    stroke-width: 2.5;
    transition: transform 0.15s ease, fill 0.15s ease;
  }

  .stop-circle.passed {
    fill: #2563eb;
    stroke: #ffffff;
    stroke-width: 2.5;
  }

  .stop-circle.current {
    fill: #f59e0b;
    stroke: #ffffff;
    stroke-width: 3;
    r: 9;
  }

  .stop-pulse-ring {
    fill: none;
    stroke: #f59e0b;
    stroke-width: 2.5;
    animation: pulseRing 1.5s ease-out infinite;
  }

  @keyframes pulseRing {
    0% {
      r: 8px;
      opacity: 0.9;
    }
    100% {
      r: 28px;
      opacity: 0;
    }
  }

  .stop-marker-text {
    font-size: 16px;
    font-weight: 600;
    fill: #334155;
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .stop-marker-text.active-text {
    font-size: 19px;
    font-weight: 800;
    fill: #1e3a8a;
  }

  .traveler-halo {
    animation: travelerHaloPulse 2s ease-out infinite;
  }

  @keyframes travelerHaloPulse {
    0% {
      transform: scale(0.9);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.3);
      opacity: 0.2;
    }
    100% {
      transform: scale(0.9);
      opacity: 0.8;
    }
  }

  .traveler-body {
    fill: #2563eb;
    stroke: #ffffff;
    stroke-width: 3;
    filter: drop-shadow(0 2px 6px rgba(37, 99, 235, 0.45));
  }

  .traveler-vehicle.moving {
    animation: travelerBob 0.35s ease-in-out infinite alternate;
  }

  @keyframes travelerBob {
    from {
      transform: translateY(-2px);
    }
    to {
      transform: translateY(2px);
    }
  }

  /* Bản đồ mini toàn quốc ở góc dưới */
  .mini-map-box {
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    width: 100px;
    height: 140px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.75rem;
    padding: 0.35rem;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    z-index: 15;
    pointer-events: none;
  }

  .mini-map-tag {
    font-size: 0.625rem;
    font-weight: 700;
    color: #64748b;
    text-align: center;
    margin-bottom: 2px;
  }

  .mini-map-svg {
    width: 100%;
    height: 100%;
  }

  .mini-vn-land {
    fill: #e2e8f0;
    stroke: #cbd5e1;
    stroke-width: 2;
  }

  .mini-route {
    fill: none;
    stroke: #94a3b8;
    stroke-width: 8;
  }

  .mini-view-indicator {
    fill: rgba(37, 99, 235, 0.15);
    stroke: #2563eb;
    stroke-width: 12;
    stroke-dasharray: 16 8;
  }

  .mini-traveler-dot {
    fill: #ef4444;
    stroke: #ffffff;
    stroke-width: 10;
  }

  /* Slider dọc Desktop */
  .slider-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    width: 68px;
    padding: 0.5rem 0;
    box-sizing: border-box;
    z-index: 10;
    flex-shrink: 0;
  }

  .slider-end-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.71875rem;
    font-weight: 700;
    color: var(--color-text, #1f1d1a);
    user-select: none;
    -webkit-user-select: none;
  }

  .point-badge {
    padding: 0.1rem 0.4rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 800;
  }

  .point-badge.south {
    background: #fee2e2;
    color: #991b1b;
  }

  .slider-track-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 260px;
    position: relative;
    box-sizing: border-box;
  }

  .desktop-slider {
    -webkit-appearance: none;
    appearance: none;
    writing-mode: vertical-lr;
    width: 32px;
    height: 100%;
    min-height: 260px;
    background: transparent;
    cursor: grab;
    margin: 0;
    accent-color: #2563eb;
  }

  .desktop-slider:active {
    cursor: grabbing;
  }

  .desktop-slider::-webkit-slider-runnable-track {
    width: 8px;
    height: 100%;
    background: #cbd5e1;
    border-radius: 9999px;
  }

  .desktop-slider::-moz-range-track {
    width: 8px;
    height: 100%;
    background: #cbd5e1;
    border-radius: 9999px;
  }

  .desktop-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #2563eb;
    border: 3px solid #ffffff;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
    margin-left: -10px;
    cursor: grab;
    transition: transform 0.15s ease;
  }

  .desktop-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .desktop-slider::-webkit-slider-thumb:active {
    transform: scale(1.2);
    cursor: grabbing;
  }

  .desktop-slider::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #2563eb;
    border: 3px solid #ffffff;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
    cursor: grab;
    transition: transform 0.15s ease;
  }

  /* Slider Mobile */
  .mobile-slider-bar {
    display: none;
  }

  /* Màn tổng kết */
  .summary-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    z-index: 50;
    animation: fadeIn 0.25s ease-out;
  }

  .summary-card {
    width: 100%;
    max-width: 500px;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1.5rem;
    padding: 2.25rem 2rem 2rem;
    text-align: center;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    box-sizing: border-box;
  }

  .summary-icon {
    font-size: 3rem;
    line-height: 1;
  }

  .summary-title {
    font-size: 1.375rem;
    font-weight: 800;
    color: var(--color-text, #1f1d1a);
    margin: 0;
    line-height: 1.35;
  }

  .summary-narrow-fact {
    font-size: 0.9375rem;
    color: #334155;
    margin: 0;
    line-height: 1.5;
  }

  .summary-straight-fact {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b665f);
    margin: 0;
    line-height: 1.45;
  }

  .summary-actions {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .summary-btn {
    padding: 0.85rem 1.25rem;
    border-radius: 0.75rem;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .summary-btn.primary {
    background: #2563eb;
    color: #ffffff;
    border: none;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
  }

  .summary-btn.primary:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
  }

  .summary-btn.secondary {
    background: transparent;
    border: 1px solid var(--color-border, #e6e1d9);
    color: var(--color-text-muted, #6b665f);
  }

  .summary-btn.secondary:hover {
    background: #f8fafc;
    color: var(--color-text, #1f1d1a);
  }

  /* Confetti burst */
  .confetti-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 60;
    overflow: hidden;
  }

  .confetti-piece {
    position: absolute;
    top: -20px;
    left: calc(var(--i) * 4.2%);
    width: 10px;
    height: 16px;
    background: hsl(calc(var(--i) * 28deg), 85%, 60%);
    opacity: 0.9;
    border-radius: 2px;
    animation: confettiFall 3.8s ease-in forwards;
    animation-delay: calc(var(--i) * 0.08s);
  }

  @keyframes confettiFall {
    0% {
      transform: translateY(0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(105vh) rotate(720deg);
      opacity: 0;
    }
  }

  .slide-fade {
    animation: slideFadeIn 0.3s ease-out;
  }

  @keyframes slideFadeIn {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes dashLoop {
    to {
      stroke-dashoffset: -16;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Responsive Mobile & Tablet (< 1024px) */
  @media (max-width: 1023px) {
    .doc-viet-nam {
      padding: 0.5rem 0.75rem 0;
      min-height: 100svh;
      height: auto;
      padding-bottom: 74px; /* padding-bottom bằng chiều cao thanh trượt để không bị che */
    }

    .doc-header {
      margin-bottom: 0.35rem;
    }

    .doc-title {
      font-size: 1.1875rem;
    }

    .doc-hint {
      font-size: 0.75rem;
    }

    .keyboard-hint {
      display: none;
    }

    .doc-body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      overflow: visible;
    }

    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex !important;
    }

    /* Bản đồ lên trên, thẻ xuống dưới */
    .doc-map-col {
      order: 1;
      height: 44svh;
      min-height: 240px;
      width: 100%;
    }

    .map-viewport {
      border-radius: 1rem;
    }

    .mini-map-box {
      width: 75px;
      height: 105px;
      padding: 0.2rem;
    }

    .doc-story-col {
      order: 2;
      width: 100%;
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }

    .hero-name {
      font-size: 1.1875rem;
    }

    /* Thanh trượt mobile dính đáy */
    .mobile-slider-bar {
      position: sticky;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      box-sizing: border-box;
      z-index: 40;
      padding: 0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom, 0px));
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-top: 1px solid var(--color-border, #e6e1d9);
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .mobile-controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .mobile-autoplay-btn {
      padding: 0.25rem 0.65rem;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 9999px;
      font-family: inherit;
      font-size: 0.75rem;
      font-weight: 700;
      color: #1d4ed8;
      cursor: pointer;
    }

    .mobile-autoplay-btn.is-active {
      background: #2563eb;
      color: #ffffff;
    }

    .mobile-slider-current {
      font-size: 0.75rem;
      font-weight: 800;
      color: #1d4ed8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mobile-slider-track-wrap {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
    }

    .mobile-point-tag {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
    }

    .mobile-slider {
      flex: 1;
      height: 28px;
      accent-color: #2563eb;
      cursor: pointer;
      touch-action: pan-y;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ken-burns {
      animation: none !important;
    }
    .pop-anim {
      animation: none !important;
    }
    .traveler-halo {
      animation: none !important;
    }
    .stop-pulse-ring {
      animation: none !important;
    }
    .traveler-vehicle.moving {
      animation: none !important;
    }
    .straight-flight-line {
      animation: none !important;
    }
    .confetti-container {
      display: none !important;
    }
  }
</style>
