<script lang="ts">
  import { onMount } from 'svelte';
  import defaultData from './data/default.json';
  import {
    STOPS,
    TOTAL_ROUTE_KM,
    STRAIGHT_LINE_KM,
    MILESTONES,
    positionAt,
    nearestStop,
    regionAt,
    milestonesCrossed,
    getJourneyProvinces,
    type JourneyPosition,
    type Milestone,
  } from './docVietNam';
  import { formatNumberVi } from './math';

  interface Props {
    onCompareWithOther: () => void;
  }

  let { onCompareWithOther }: Props = $props();

  // Hình bản đồ Việt Nam mặc định
  const vnSvgD: string = (defaultData as Record<string, string>)['viet-nam'] || '';

  // Bounding box và viewBox cho bản đồ Việt Nam gồm cả Hoàng Sa và Trường Sa
  // Mainland x: -442..320, Islands x: ..1242, y: -768..997
  const MAP_VIEWBOX = '-460 -800 1740 1840';

  // Tiến độ hành trình: 0 (Lũng Cú) -> 1 (Mũi Cà Mau)
  let progress = $state(0);

  // Vị trí hiện tại tính theo km
  const currentPos: JourneyPosition = $derived(positionAt(progress));

  // Điểm dừng gần nhất
  const currentNearest = $derived(nearestStop(currentPos.km));

  // Vùng khí hậu / địa hình
  const currentRegion = $derived(regionAt(currentPos.segIndex));

  // Thông tin tỉnh hiện tại và các tỉnh đã đi qua
  const provinceInfo = $derived(getJourneyProvinces(currentPos.segIndex));

  // Mốc so sánh vừa vượt qua gần nhất
  let latestMilestone = $state<Milestone | null>(null);
  let showMilestoneToast = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let prevKm = 0;
  // Mỗi mốc chỉ bắn 1 lần mỗi lượt; xoá khi "Đi lại từ đầu"
  const firedKm = new Set<number>();

  // Số km hiển thị đếm mượt
  let displayKm = $state(0);
  let animFrameId: number | null = null;
  let prefersReduced = false;

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

  // Kiểm tra cuối hành trình (>= 99%)
  const isFinished = $derived(progress >= 0.99);

  // Aria valuetext cho thanh trượt
  const ariaValueText = $derived(
    `Đã đi ${formatNumberVi(displayKm)} km, đang ở ${provinceInfo.currentProvince}`
  );

  // Theo dõi tiến độ để cập nhật mốc so sánh và đếm mượt
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
      if (animFrameId) cancelAnimationFrame(animFrameId);
      const updateCounter = () => {
        const diff = curKm - displayKm;
        if (Math.abs(diff) < 1) {
          displayKm = Math.round(curKm);
        } else {
          displayKm += diff * 0.25;
          animFrameId = requestAnimationFrame(updateCounter);
        }
      };
      animFrameId = requestAnimationFrame(updateCounter);
    }
  });

  function handleResetJourney() {
    progress = 0;
    firedKm.clear();
    prevKm = 0;
    latestMilestone = null;
    showMilestoneToast = false;
    displayKm = 0;
  }

  function handleRangeInput(e: Event) {
    const target = e.target as HTMLInputElement;
    progress = parseFloat(target.value);
  }

  function handleMapWheel(e: WheelEvent) {
    e.preventDefault();
    const step = 0.02;
    if (e.deltaY > 0) {
      progress = Math.min(1, progress + step);
    } else {
      progress = Math.max(0, progress - step);
    }
  }

  // Điều khiển bàn phím: mũi tên bước nhỏ, PageUp/PageDown nhảy điểm dừng
  function handleKeyDown(e: KeyboardEvent) {
    // Chỉ kích hoạt khi người dùng đang tập trung trong section DocVietNam
    const active = document.activeElement;
    const isDocFocused = active?.closest('.doc-viet-nam');
    if (!isDocFocused && active !== document.body) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      progress = Math.min(1, progress + 0.01);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      progress = Math.max(0, progress - 0.01);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      jumpToNextStop();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      jumpToPrevStop();
    } else if (e.key === 'Home') {
      e.preventDefault();
      progress = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      progress = 1;
    }
  }

  function jumpToNextStop() {
    const curKm = currentPos.km;
    const next = STOPS.find((s) => s.kmFromStart > curKm + 5);
    if (next) {
      progress = Math.min(1, next.kmFromStart / TOTAL_ROUTE_KM);
    } else {
      progress = 1;
    }
  }

  function jumpToPrevStop() {
    const curKm = currentPos.km;
    const prev = [...STOPS].reverse().find((s) => s.kmFromStart < curKm - 5);
    if (prev) {
      progress = Math.max(0, prev.kmFromStart / TOTAL_ROUTE_KM);
    } else {
      progress = 0;
    }
  }

  // Hỗ trợ chạm kéo trên bản đồ mobile
  let touchStartY = 0;
  let touchStartProg = 0;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartProg = progress;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 1) {
      const deltaY = e.touches[0].clientY - touchStartY;
      const progressDelta = deltaY / 400; // 400px vuốt ~ toàn bộ tuyến
      progress = Math.max(0, Math.min(1, touchStartProg + progressDelta));
    }
  }

  onMount(() => {
    prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<section
  class="doc-viet-nam"
  style="background: {currentRegion.bgGradient};"
  aria-label="Khám phá chiều dài Việt Nam từ Bắc vào Nam"
>
  <!-- Tiêu đề câu hỏi chính -->
  <header class="doc-header">
    <div class="header-badge">Trải nghiệm dọc Bắc → Nam</div>
    <h1 class="doc-title">Bạn nghĩ Việt Nam dài đến mức nào?</h1>
    <p class="doc-hint">
      Kéo thanh trượt để đi từ cực Bắc xuống cực Nam
      <span class="keyboard-hint">(hoặc dùng phím ↑↓, PageUp / PageDown)</span>
    </p>
  </header>

  <!-- Khu vực hiển thị trung tâm: Card thông tin + Bản đồ SVG + Thanh trượt dọc -->
  <div class="doc-body">
    <!-- Cột trái: Bảng thông tin cập nhật theo vị trí -->
    <div class="doc-card" aria-live="polite">
      <!-- 1. Số km đã đi (lớn, đếm mượt) -->
      <div class="km-stat">
        <span class="km-label">Đã đi khoảng</span>
        <div class="km-number-row">
          <span class="km-value">{formatNumberVi(Math.round(displayKm))}</span>
          <span class="km-unit">km</span>
        </div>
        <div class="km-progress-bar">
          <div class="km-progress-fill" style="width: {(progress * 100).toFixed(1)}%;"></div>
        </div>
      </div>

      <!-- 2. Đang ở tỉnh nào + chips tỉnh đã đi qua -->
      <div class="province-section">
        <div class="current-province">
          <span class="current-prov-tag">Vị trí hiện tại:</span>
          <span class="current-prov-name">{provinceInfo.currentProvince}</span>
        </div>
        <div class="passed-chips-row">
          <span class="chips-label">Đã qua ({provinceInfo.passedProvinces.length} tỉnh/thành):</span>
          <div class="chips-list">
            {#each provinceInfo.passedProvinces as prov}
              <span class="province-chip" class:is-current={prov === provinceInfo.currentProvince}>
                {prov}
              </span>
            {/each}
          </div>
        </div>
      </div>

      <!-- 3. Vùng khí hậu / địa hình -->
      <div class="region-section">
        <div class="region-header">
          <span
            class="region-badge"
            style="color: {currentRegion.badgeColor}; background: {currentRegion.badgeBg}; border-color: {currentRegion.badgeColor}33;"
          >
            {currentRegion.name}
          </span>
        </div>
        <p class="region-desc">{currentRegion.description}</p>
      </div>

      <!-- 4. Địa danh nổi bật tại điểm dừng gần nhất -->
      <div class="landmark-section">
        <div class="landmark-header">
          <span class="landmark-icon" aria-hidden="true">📍</span>
          <strong class="landmark-name">{currentNearest.name}</strong>
          <span class="landmark-prov">({currentNearest.province})</span>
        </div>
        <p class="landmark-desc">{currentNearest.description}</p>
      </div>

      <!-- 5. So sánh khoảng cách khi vượt mốc (toast/dòng nổi bật) -->
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

    <!-- Cột giữa: Bản đồ Việt Nam SVG và tuyến hành trình -->
    <div
      class="map-container"
      onwheel={handleMapWheel}
      ontouchstart={handleTouchStart}
      ontouchmove={handleTouchMove}
      role="region"
      aria-label="Bản đồ tuyến hành trình Việt Nam"
    >
      <svg
        class="vn-svg"
        viewBox={MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="travelerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#2563eb" stop-opacity="0" />
          </radialGradient>
          <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.18" />
          </filter>
        </defs>

        <!-- Hình bản đồ Việt Nam (đầy đủ đất liền, Hoàng Sa, Trường Sa) -->
        <path
          d={vnSvgD}
          class="vn-land"
        />

        <!-- Nhãn biển đảo chủ quyền -->
        <text x="500" y="-120" class="sea-label">BIỂN ĐÔNG</text>
        <text x="610" y="0" class="island-label">QĐ. Hoàng Sa</text>
        <text x="860" y="720" class="island-label">QĐ. Trường Sa</text>

        <!-- Toàn bộ tuyến hành trình (nền mờ) -->
        <polyline
          points={allStopPoints}
          class="route-bg"
        />

        <!-- Phần tuyến đã đi (tô đậm màu xanh dương) -->
        <polyline
          points={traversedPoints}
          class="route-active"
        />

        <!-- Đường thẳng Lũng Cú – Cà Mau (đứt nét) khi hoàn thành (>= 99%) -->
        {#if isFinished}
          <line
            x1={STOPS[0].x}
            y1={STOPS[0].y}
            x2={STOPS[14].x}
            y2={STOPS[14].y}
            class="straight-line"
          />
          <text
            x={(STOPS[0].x + STOPS[14].x) / 2 - 80}
            y={(STOPS[0].y + STOPS[14].y) / 2}
            class="straight-label"
          >
            Đường thẳng: ~{formatNumberVi(Math.round(STRAIGHT_LINE_KM))} km
          </text>
        {/if}

        <!-- 15 điểm dừng trên bản đồ -->
        {#each STOPS as stop, idx}
          {@const isPassed = stop.kmFromStart <= currentPos.km}
          {@const isCurrent = stop.id === currentNearest.id}
          <g class="stop-node" transform="translate({stop.x}, {stop.y})">
            <circle
              r={isCurrent ? 9 : isPassed ? 6.5 : 5}
              class="stop-dot"
              class:passed={isPassed}
              class:current={isCurrent}
            />
            {#if isCurrent || idx === 0 || idx === 14}
              <text
                x={stop.x > 100 ? -12 : 14}
                y="4"
                text-anchor={stop.x > 100 ? 'end' : 'start'}
                class="stop-text"
                class:active-stop-text={isCurrent}
              >
                {stop.name}
              </text>
            {/if}
          </g>
        {/each}

        <!-- Chấm "người đi" di động trên tuyến -->
        <g class="traveler-marker" transform="translate({currentPos.x}, {currentPos.y})">
          <circle r="22" fill="url(#travelerGlow)" class="traveler-pulse" />
          <circle r="8.5" class="traveler-center" />
          <circle r="3.5" fill="#ffffff" />
        </g>
      </svg>
    </div>

    <!-- Cột phải: Thanh trượt dọc trên desktop -->
    <div class="slider-wrapper desktop-only">
      <span class="slider-end-label top-label">
        <span class="point-badge">Bắc</span>
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
        />
      </div>

      <span class="slider-end-label bottom-label">
        <span class="point-badge south">Nam</span>
        Cà Mau
      </span>
    </div>
  </div>

  <!-- Thanh trượt ngang ở đáy màn hình trên mobile (≤ 640px) -->
  <div class="mobile-slider-bar mobile-only">
    <div class="mobile-slider-labels">
      <span class="mobile-slider-label">📍 Lũng Cú (0 km)</span>
      <span class="mobile-slider-current">
        Đang ở {provinceInfo.currentProvince} ({formatNumberVi(Math.round(displayKm))} km)
      </span>
      <span class="mobile-slider-label">Mũi Cà Mau 📍</span>
    </div>
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
  </div>

  <!-- Màn tổng kết khi đi hết hành trình (>= 99%) -->
  {#if isFinished}
    <div class="summary-overlay">
      <div class="summary-card" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <div class="summary-icon" aria-hidden="true">🎉</div>
        <h2 id="summary-title" class="summary-title">
          Bạn vừa đi khoảng {formatNumberVi(Math.round(TOTAL_ROUTE_KM))} km đường chim bay dọc tuyến!
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
</section>

<style>
  .doc-viet-nam {
    position: relative;
    width: 100%;
    min-height: 100svh;
    max-height: 100svh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 1rem 1.5rem;
    transition: background 0.8s ease;
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
    margin-bottom: 0.35rem;
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

  .doc-body {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    position: relative;
  }

  /* Cột trái: Bảng thông tin */
  .doc-card {
    width: 340px;
    max-width: 360px;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1.25rem;
    padding: 1.25rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    box-sizing: border-box;
    z-index: 10;
  }

  .km-stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .km-label {
    font-size: 0.75rem;
    font-weight: 600;
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
    font-weight: 700;
    color: #3b82f6;
  }

  .km-progress-bar {
    width: 100%;
    height: 6px;
    background: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
    margin-top: 0.25rem;
  }

  .km-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
    border-radius: 9999px;
    transition: width 0.1s linear;
  }

  .province-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .current-province {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  .current-prov-tag {
    font-size: 0.8125rem;
    color: var(--color-text-muted, #6b665f);
  }

  .current-prov-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #0f172a;
  }

  .passed-chips-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .chips-label {
    font-size: 0.71875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
  }

  .chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    max-height: 4.5rem;
    overflow-y: auto;
    padding-right: 0.2rem;
  }

  .province-chip {
    padding: 0.15rem 0.45rem;
    background: #f1f5f9;
    color: #475569;
    border-radius: 0.35rem;
    font-size: 0.6875rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .province-chip.is-current {
    background: #dbeafe;
    color: #1e40af;
    font-weight: 700;
  }

  .region-section {
    padding: 0.6rem 0.75rem;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .region-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 0.4rem;
    font-size: 0.75rem;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .region-desc {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--color-text, #1f1d1a);
  }

  .landmark-section {
    padding: 0.6rem 0.75rem;
    background: #f8fafc;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .landmark-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.875rem;
  }

  .landmark-name {
    color: #0f172a;
    font-weight: 700;
  }

  .landmark-prov {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b665f);
  }

  .landmark-desc {
    margin: 0;
    font-size: 0.78125rem;
    line-height: 1.35;
    color: #475569;
  }

  .milestone-callout {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: #fefce8;
    border: 1px solid #fde047;
    border-radius: 0.75rem;
    font-size: 0.8125rem;
    color: #854d0e;
    box-shadow: 0 2px 8px rgba(234, 179, 8, 0.15);
  }

  .milestone-callout.highlight-anim {
    animation: pulseHighlight 0.6s ease-in-out;
  }

  .milestone-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .milestone-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    line-height: 1.3;
  }

  /* Cột giữa: Bản đồ SVG */
  .map-container {
    flex: 1;
    height: 100%;
    max-height: calc(100svh - 130px);
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    cursor: ns-resize;
  }

  .vn-svg {
    width: 100%;
    height: 100%;
    max-width: 680px;
    filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.08));
  }

  .vn-land {
    fill: #fdfbf7;
    stroke: #cbd5e1;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .sea-label {
    font-size: 26px;
    font-weight: 800;
    fill: #94a3b8;
    letter-spacing: 6px;
    opacity: 0.45;
  }

  .island-label {
    font-size: 20px;
    font-weight: 600;
    fill: #64748b;
    opacity: 0.75;
  }

  .route-bg {
    fill: none;
    stroke: #94a3b8;
    stroke-width: 3.5;
    stroke-dasharray: 6 6;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.45;
  }

  .route-active {
    fill: none;
    stroke: #2563eb;
    stroke-width: 5.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .straight-line {
    stroke: #dc2626;
    stroke-width: 3.5;
    stroke-dasharray: 8 8;
    stroke-linecap: round;
    animation: dashAnim 1.2s linear infinite;
  }

  .straight-label {
    font-size: 24px;
    font-weight: 800;
    fill: #b91c1c;
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 6px;
  }

  .stop-dot {
    fill: #ffffff;
    stroke: #94a3b8;
    stroke-width: 2.5;
    transition: r 0.15s ease, fill 0.15s ease;
  }

  .stop-dot.passed {
    fill: #2563eb;
    stroke: #ffffff;
    stroke-width: 2.5;
  }

  .stop-dot.current {
    fill: #f59e0b;
    stroke: #ffffff;
    stroke-width: 3;
    r: 9;
  }

  .stop-text {
    font-size: 19px;
    font-weight: 600;
    fill: #475569;
    paint-order: stroke;
    stroke: #ffffff;
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .stop-text.active-stop-text {
    font-weight: 800;
    fill: #1e3a8a;
    font-size: 22px;
  }

  .traveler-pulse {
    animation: pulseTraveler 1.8s ease-out infinite;
  }

  .traveler-center {
    fill: #2563eb;
    stroke: #ffffff;
    stroke-width: 3;
    filter: drop-shadow(0 2px 6px rgba(37, 99, 235, 0.4));
  }

  /* Cột phải: Thanh trượt dọc trên desktop */
  .slider-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    height: 75%;
    max-height: 440px;
    width: 68px;
    padding: 0.5rem 0;
    box-sizing: border-box;
    z-index: 10;
  }

  .slider-end-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text, #1f1d1a);
  }

  .point-badge {
    padding: 0.1rem 0.4rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 9999px;
    font-size: 0.6875rem;
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
    position: relative;
  }

  /* Slider xoay 90 độ: Đỉnh = 0 (Lũng Cú), Đáy = 1 (Cà Mau) */
  .desktop-slider {
    width: 280px;
    transform: rotate(90deg);
    transform-origin: center;
    accent-color: #2563eb;
    cursor: pointer;
  }

  /* Thanh trượt mobile ở đáy */
  .mobile-slider-bar {
    display: none;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem 0.75rem 0.75rem;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid var(--color-border, #e6e1d9);
    position: sticky;
    bottom: 0;
    z-index: 30;
  }

  .mobile-slider-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.71875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
  }

  .mobile-slider-current {
    font-weight: 800;
    color: #1d4ed8;
  }

  .mobile-slider {
    width: 100%;
    accent-color: #2563eb;
    cursor: pointer;
  }

  /* Màn tổng kết */
  .summary-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    z-index: 50;
    animation: fadeIn 0.25s ease-out;
  }

  .summary-card {
    width: 100%;
    max-width: 480px;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1.5rem;
    padding: 2rem 1.75rem 1.75rem;
    text-align: center;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    box-sizing: border-box;
  }

  .summary-icon {
    font-size: 2.75rem;
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
    padding: 0.8rem 1.25rem;
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
    box-shadow: 0 2px 10px rgba(37, 99, 235, 0.25);
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

  /* Responsive Mobile (≤ 640px) */
  @media (max-width: 640px) {
    .doc-viet-nam {
      padding: 0.5rem 0.75rem;
      max-height: none;
      min-height: 100svh;
      height: 100svh;
    }

    .doc-title {
      font-size: 1.2rem;
    }

    .doc-hint {
      font-size: 0.75rem;
    }

    .keyboard-hint {
      display: none;
    }

    .doc-body {
      flex-direction: column;
      gap: 0.5rem;
      overflow-y: auto;
    }

    .desktop-only {
      display: none !important;
    }

    .mobile-only {
      display: flex !important;
    }

    .doc-card {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem;
      gap: 0.5rem;
      border-radius: 0.85rem;
    }

    .km-value {
      font-size: 1.75rem;
    }

    .chips-list {
      max-height: 2.5rem;
    }

    .map-container {
      max-height: 48vh;
      width: 100%;
    }
  }

  @keyframes pulseTraveler {
    0% {
      transform: scale(0.85);
      opacity: 0.9;
    }
    50% {
      transform: scale(1.4);
      opacity: 0.3;
    }
    100% {
      transform: scale(0.85);
      opacity: 0.9;
    }
  }

  @keyframes pulseHighlight {
    0% {
      transform: scale(0.97);
    }
    50% {
      transform: scale(1.03);
    }
    100% {
      transform: scale(1);
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

  @keyframes dashAnim {
    to {
      stroke-dashoffset: -16;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .traveler-pulse {
      animation: none !important;
    }
    .straight-line {
      animation: none !important;
    }
    .summary-overlay {
      animation: none !important;
    }
    .milestone-callout.highlight-anim {
      animation: none !important;
    }
  }
</style>
