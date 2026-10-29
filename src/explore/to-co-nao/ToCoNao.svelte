<script lang="ts">
  import { onMount } from 'svelte';
  import type { PlacedShape, Viewport, EntityMeta } from './types';
  import Board from './Board.svelte';
  import SearchBox from './SearchBox.svelte';
  import Footer from './Footer.svelte';
  import TourCard from './TourCard.svelte';
  import IntroModal from './IntroModal.svelte';
  import { meta, metaMap, loadedShapes, getShape, prefetchVn } from './dataLoader';
  import {
    fitView,
    formatComparison,
    PRESET_MATCHES,
    type PresetMatch,
    pickRandomMatch,
    encodeUrlState,
    decodeUrlState,
  } from './math';
  import {
    TOUR_STEPS,
    getTourComparison,
    parseHanhTrinhUrl,
    prefetchTourData,
    type TourStep,
  } from './tourData';
  import { animateViewport } from './viewportAnimation';
  import { funFact, surprisingPairs, type SurprisingPair } from './funFacts';
  import { exportComparisonImage } from './exportImage';

  // Khởi tạo 2 hình mặc định: Lâm Đồng và Bỉ
  let shapes = $state<PlacedShape[]>([
    { id: 'lam-dong', x: -110, y: 0, rotation: 0 },
    { id: 'bel', x: 110, y: 0, rotation: 0 },
  ]);

  let selectedId = $state<string | null>('lam-dong');
  let previousSelectedId = $state<string | null>('bel');

  let viewport = $state<Viewport>({
    cx: 0,
    cy: 0,
    scale: 0.8,
  });

  let boardWidth = $state(800);
  let boardHeight = $state(520);

  // Biến ép Svelte cập nhật khi có shape path mới được nạp bất đồng bộ
  let shapesDataVersion = $state(0);

  // Trạng thái xuất ảnh và toast chia sẻ
  let isExporting = $state(false);
  let shareToastMessage = $state<string | null>(null);
  let shareToastTimer: ReturnType<typeof setTimeout> | null = null;

  // D3: Toast Fun fact 4s khi thêm hình từ tìm kiếm
  let funFactToastMessage = $state<string | null>(null);
  let funFactToastTimer: ReturnType<typeof setTimeout> | null = null;

  // D1: Màn mở đầu
  let showIntro = $state(false);

  // D2: Chế độ Hành trình
  let isTour = $state(false);
  let currentTourStep = $state(1); // 1..10
  let ghostShape = $state<PlacedShape | null>(null);
  let isTweening = $state(false);
  let cancelAnimation: (() => void) | null = null;

  // Cờ đã khởi tạo xong từ URL
  let isInitialized = false;
  let urlDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Lấy shape đang chọn và shape chọn trước đó (hoặc 2 shape đầu tiên)
  const activeShape = $derived(
    shapes.find((s) => s.id === selectedId) || shapes[0] || null
  );

  const prevShape = $derived(
    (previousSelectedId && shapes.find((s) => s.id === previousSelectedId && s.id !== activeShape?.id)) ||
    shapes.find((s) => s.id !== activeShape?.id) ||
    null
  );

  const activeEntity = $derived(activeShape ? metaMap.get(activeShape.id) : undefined);
  const prevEntity = $derived(prevShape ? metaMap.get(prevShape.id) : undefined);

  // Câu so sánh diện tích giữa 2 hình trong chế độ tự do
  const comparisonText = $derived(
    activeEntity && prevEntity ? formatComparison(activeEntity, prevEntity) : ''
  );

  // Câu so sánh 3 tầng cho chặng hành trình hiện tại
  const currentTourComparison = $derived(
    isTour ? getTourComparison(TOUR_STEPS[currentTourStep - 1], metaMap) : null
  );

  // Đặt 2 hình cạnh nhau và cân khung
  async function setupStepShapes(id1: string, id2: string) {
    await Promise.all([getShape(id1), getShape(id2)]);
    shapesDataVersion++;

    const m1 = metaMap.get(id1);
    const m2 = metaMap.get(id2);
    const bbox1 = m1?.bbox || [-50, -50, 50, 50];
    const bbox2 = m2?.bbox || [-50, -50, 50, 50];

    const wid1 = Math.max(bbox1[2] - bbox1[0], 10);
    const wid2 = Math.max(bbox2[2] - bbox2[0], 10);
    const offset1 = (bbox1[0] + bbox1[2]) / 2;
    const offset2 = (bbox2[0] + bbox2[2]) / 2;
    const gap = 30;
    const totalDist = (wid1 + wid2) / 2 + gap;

    shapes = [
      { id: id1, x: Math.round(-totalDist / 2 - offset1), y: 0, rotation: 0, goc: 0 },
      { id: id2, x: Math.round(totalDist / 2 - offset2), y: 0, rotation: 0, goc: 0 },
    ];

    selectedId = id1;
    previousSelectedId = id2;

    const w = boardWidth || 800;
    const h = boardHeight || 520;
    viewport = fitView(shapes, w, h, 0.12, (id) => metaMap.get(id)?.bbox);
  }

  // Thiết lập chặng hành trình cụ thể với mốc mờ và tween khung nhìn
  async function setupTourStep(stepNum: number) {
    const safeStep = Math.min(Math.max(stepNum, 1), 10);
    currentTourStep = safeStep;
    isTour = true;
    showIntro = false;

    // Prefetch toàn bộ chunk tour trong nền
    prefetchTourData();

    const step = TOUR_STEPS[safeStep - 1];
    const id1 = step.smallId;
    const id2 = step.largeId;

    // Nạp dữ liệu hình của chặng
    await Promise.all([getShape(id1), getShape(id2)]);

    // Xác định hình mốc mờ từ chặng trước (nếu có)
    if (safeStep > 1) {
      const prevStep = TOUR_STEPS[safeStep - 2];
      const prevLargeId = prevStep.largeId;
      if (prevLargeId !== id1 && prevLargeId !== id2) {
        await getShape(prevLargeId);
        const prevM = metaMap.get(prevLargeId);
        const prevBbox = prevM?.bbox || [-50, -50, 50, 50];
        const prevOffset = (prevBbox[0] + prevBbox[2]) / 2;
        ghostShape = {
          id: prevLargeId,
          x: Math.round(-200 - prevOffset),
          y: 0,
          rotation: 0,
          goc: 0,
        };
      } else {
        ghostShape = null;
      }
    } else {
      ghostShape = null;
    }

    shapesDataVersion++;

    const m1 = metaMap.get(id1);
    const m2 = metaMap.get(id2);
    const bbox1 = m1?.bbox || [-50, -50, 50, 50];
    const bbox2 = m2?.bbox || [-50, -50, 50, 50];

    const wid1 = Math.max(bbox1[2] - bbox1[0], 10);
    const wid2 = Math.max(bbox2[2] - bbox2[0], 10);
    const offset1 = (bbox1[0] + bbox1[2]) / 2;
    const offset2 = (bbox2[0] + bbox2[2]) / 2;
    const gap = 30;
    const totalDist = (wid1 + wid2) / 2 + gap;

    shapes = [
      { id: id1, x: Math.round(-totalDist / 2 - offset1), y: 0, rotation: 0, goc: 0 },
      { id: id2, x: Math.round(totalDist / 2 - offset2), y: 0, rotation: 0, goc: 0 },
    ];

    selectedId = id1;
    previousSelectedId = id2;

    // Tính target viewport để tween mượt mà
    const w = boardWidth || 800;
    const h = boardHeight || 520;
    const targetVp = fitView(shapes, w, h, 0.14, (id) => metaMap.get(id)?.bbox);

    if (cancelAnimation) cancelAnimation();
    isTweening = true;
    cancelAnimation = animateViewport(viewport, targetVp, {
      duration: 600,
      onUpdate: (vp) => {
        viewport = vp;
      },
      onComplete: () => {
        isTweening = false;
        cancelAnimation = null;
      },
    });

    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}?hanh-trinh=${safeStep}`);
    }
  }

  function handleTourPrev() {
    if (currentTourStep > 1) {
      setupTourStep(currentTourStep - 1);
    }
  }

  function handleTourNext() {
    if (currentTourStep < 10) {
      setupTourStep(currentTourStep + 1);
    } else {
      // Chặng 10 bấm nút "Tự so sánh" -> thoát về tự do với 2 hình chặng 10
      handleExitTour();
    }
  }

  function handleExitTour() {
    isTour = false;
    ghostShape = null;
    if (cancelAnimation) cancelAnimation();
    isTweening = false;

    if (typeof window !== 'undefined') {
      const qs = encodeUrlState(shapes, viewport);
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }

  function handleStartTour(step = 1) {
    showIntro = false;
    setupTourStep(step);
  }

  function handleExploreFromIntro() {
    showIntro = false;
    setupStepShapes('lam-dong', 'bel');
  }

  onMount(async () => {
    // Tải trước dữ liệu 34 tỉnh VN trong thời gian rảnh
    prefetchVn();

    if (typeof window !== 'undefined' && window.location.search) {
      // 1. Kiểm tra URL có ?hanh-trinh=N không
      const tourStep = parseHanhTrinhUrl(window.location.search);
      if (tourStep !== null) {
        showIntro = false;
        await setupTourStep(tourStep);
        isInitialized = true;
        return;
      }

      // 2. Kiểm tra URL có ?h= không
      const decoded = decodeUrlState(window.location.search, (id) => metaMap.has(id));
      if (decoded.shapes && decoded.shapes.length > 0) {
        showIntro = false;
        const initialShapes = decoded.shapes.slice(0, 6);
        await Promise.all(initialShapes.map((s) => getShape(s.id)));
        shapesDataVersion++;

        shapes = initialShapes;
        selectedId = initialShapes[0].id;
        previousSelectedId = initialShapes[1]?.id ?? null;

        if (decoded.scale && decoded.cx !== undefined && decoded.cy !== undefined) {
          viewport = { cx: decoded.cx, cy: decoded.cy, scale: decoded.scale };
        } else {
          setTimeout(() => handleFitView(), 60);
        }

        isInitialized = true;
        return;
      }
    }

    // 3. Không có ?h= và không có ?hanh-trinh= -> kiểm tra localStorage tcn-intro-seen
    let seen = false;
    try {
      seen = Boolean(localStorage.getItem('tcn-intro-seen'));
    } catch {
      seen = false;
    }

    if (!seen) {
      showIntro = true;
      // D1: Bảng phía sau render sẵn chặng 1 (sgp + tp-ho-chi-minh)
      await setupStepShapes('sgp', 'tp-ho-chi-minh');
      isInitialized = true;
    } else {
      showIntro = false;
      await setupStepShapes('lam-dong', 'bel');
      isInitialized = true;
    }
  });

  // Tự động đồng bộ trạng thái bàn lên URL (?h=...) khi ở chế độ tự do
  $effect(() => {
    const currentShapes = shapes;
    const currentVp = viewport;

    // Không ghi đè URL ?h= khi đang trong tour hoặc đang hiện intro
    if (isTour || showIntro || !isInitialized || typeof window === 'undefined') return;

    if (urlDebounceTimer) clearTimeout(urlDebounceTimer);
    urlDebounceTimer = setTimeout(() => {
      const qs = encodeUrlState(currentShapes, currentVp);
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      const curSearch = window.location.search;
      if (curSearch !== (qs ? `?${qs}` : '')) {
        window.history.replaceState(null, '', newUrl);
      }
    }, 300);
  });

  function handleSelectShape(id: string) {
    if (selectedId !== id) {
      previousSelectedId = selectedId;
      selectedId = id;
    }
  }

  function handleDeselect() {
    selectedId = null;
  }

  function handleMoveShape(id: string, x: number, y: number) {
    shapes = shapes.map((s) => (s.id === id ? { ...s, x, y } : s));
  }

  function handleRotateShape(id: string, deg: number) {
    shapes = shapes.map((s) => (s.id === id ? { ...s, rotation: deg, goc: deg } : s));
  }

  function handleDeleteShape(id: string) {
    shapes = shapes.filter((s) => s.id !== id);
    if (selectedId === id) {
      selectedId = shapes[0]?.id || null;
      previousSelectedId = shapes[1]?.id || null;
    } else if (previousSelectedId === id) {
      previousSelectedId = shapes.find((s) => s.id !== selectedId)?.id || null;
    }
  }

  function handleCenterWithPrev(id: string) {
    const target = shapes.find((s) => s.id === id);
    if (!target) return;

    const ref = (previousSelectedId && shapes.find((s) => s.id === previousSelectedId && s.id !== id)) ||
                shapes.find((s) => s.id !== id);
    if (!ref) return;

    handleMoveShape(id, ref.x, ref.y);
  }

  // Nút "Chồng tâm" (Overlay centers)
  function handleOverlayCenters() {
    if (!activeShape || !prevShape) return;
    handleMoveShape(activeShape.id, prevShape.x, prevShape.y);
  }

  // Nút "Đặt cạnh nhau" (Side by side)
  function handleSideBySide() {
    if (!activeShape || !prevShape) return;
    const metaA = metaMap.get(activeShape.id);
    const metaB = metaMap.get(prevShape.id);
    const bboxA = activeShape.bbox || metaA?.bbox || [-50, -50, 50, 50];
    const bboxB = prevShape.bbox || metaB?.bbox || [-50, -50, 50, 50];

    const widA = Math.max(bboxA[2] - bboxA[0], 10);
    const widB = Math.max(bboxB[2] - bboxB[0], 10);
    const centerOffsetA = (bboxA[0] + bboxA[2]) / 2;
    const centerOffsetB = (bboxB[0] + bboxB[2]) / 2;

    const gap = 30; // 30 km khoảng cách an toàn
    const totalDist = (widA + widB) / 2 + gap;

    shapes = shapes.map((s) => {
      if (s.id === activeShape.id) {
        return { ...s, x: Math.round(-totalDist / 2 - centerOffsetA), y: 0 };
      }
      if (s.id === prevShape.id) {
        return { ...s, x: Math.round(totalDist / 2 - centerOffsetB), y: 0 };
      }
      return s;
    });

    handleFitView();
  }

  // Tự cân khung bao trọn tất cả các hình
  function handleFitView() {
    if (shapes.length === 0) return;
    const w = boardWidth || 800;
    const h = boardHeight || 520;
    const newVp = fitView(shapes, w, h, 0.12, (id) => metaMap.get(id)?.bbox);
    viewport = newVp;
  }

  // Hiện toast Fun fact 4s
  function showFunFactToast(msg: string) {
    funFactToastMessage = msg;
    if (funFactToastTimer) clearTimeout(funFactToastTimer);
    funFactToastTimer = setTimeout(() => {
      funFactToastMessage = null;
    }, 4000);
  }

  // Thêm một hình mới vào bàn (D3: hiện toast Fun fact 4s)
  async function handleAddShape(id: string) {
    if (shapes.length >= 6) return;

    if (!loadedShapes.has(id)) {
      await getShape(id);
      shapesDataVersion++;
    }

    const entity = metaMap.get(id);
    if (entity) {
      showFunFactToast(funFact(entity, meta));
    }

    const offset = (Math.random() - 0.5) * 60;
    const newShape: PlacedShape = {
      id,
      x: Math.round(viewport.cx + offset),
      y: Math.round(viewport.cy + offset),
      rotation: 0,
      goc: 0,
    };

    shapes = [...shapes, newShape];
    previousSelectedId = selectedId;
    selectedId = id;

    setTimeout(() => {
      handleFitView();
    }, 40);
  }

  // Chọn kèo kinh điển
  async function handleSelectPreset(preset: PresetMatch) {
    const id1 = preset.shapes[0];
    const id2 = preset.shapes[1];

    await Promise.all([getShape(id1), getShape(id2)]);
    shapesDataVersion++;

    const m1 = metaMap.get(id1);
    const m2 = metaMap.get(id2);
    const bbox1 = m1?.bbox || [-50, -50, 50, 50];
    const bbox2 = m2?.bbox || [-50, -50, 50, 50];

    const wid1 = Math.max(bbox1[2] - bbox1[0], 10);
    const wid2 = Math.max(bbox2[2] - bbox2[0], 10);
    const offset1 = (bbox1[0] + bbox1[2]) / 2;
    const offset2 = (bbox2[0] + bbox2[2]) / 2;
    const gap = 30;
    const totalDist = (wid1 + wid2) / 2 + gap;

    shapes = [
      { id: id1, x: Math.round(-totalDist / 2 - offset1), y: 0, rotation: 0, goc: 0 },
      { id: id2, x: Math.round(totalDist / 2 - offset2), y: 0, rotation: 0, goc: 0 },
    ];

    selectedId = id1;
    previousSelectedId = id2;

    setTimeout(() => {
      handleFitView();
    }, 40);
  }

  // D4: Đặt cặp so sánh bất ngờ lên bàn (Chồng tâm)
  async function handleSelectSurprisingPair(pair: SurprisingPair) {
    await Promise.all([getShape(pair.a), getShape(pair.b)]);
    shapesDataVersion++;

    shapes = [
      { id: pair.a, x: 0, y: 0, rotation: 0, goc: 0 },
      { id: pair.b, x: 0, y: 0, rotation: 0, goc: 0 },
    ];

    selectedId = pair.a;
    previousSelectedId = pair.b;

    setTimeout(() => {
      handleFitView();
    }, 40);
  }

  // D4: Nút "Ngẫu nhiên" (50% lấy từ surprisingPairs, 50% như cũ)
  async function handleRandomMatch() {
    const surprises = surprisingPairs(meta);
    if (Math.random() < 0.5 && surprises.length > 0) {
      const idx = Math.floor(Math.random() * surprises.length);
      await handleSelectSurprisingPair(surprises[idx]);
      return;
    }

    const match = pickRandomMatch(meta);
    if (!match) return;

    const id1 = match.province.id;
    const id2 = match.country.id;

    await Promise.all([getShape(id1), getShape(id2)]);
    shapesDataVersion++;

    const m1 = metaMap.get(id1);
    const m2 = metaMap.get(id2);
    const bbox1 = m1?.bbox || [-50, -50, 50, 50];
    const bbox2 = m2?.bbox || [-50, -50, 50, 50];

    const wid1 = Math.max(bbox1[2] - bbox1[0], 10);
    const wid2 = Math.max(bbox2[2] - bbox2[0], 10);
    const offset1 = (bbox1[0] + bbox1[2]) / 2;
    const offset2 = (bbox2[0] + bbox2[2]) / 2;
    const gap = 30;
    const totalDist = (wid1 + wid2) / 2 + gap;

    shapes = [
      { id: id1, x: Math.round(-totalDist / 2 - offset1), y: 0, rotation: 0, goc: 0 },
      { id: id2, x: Math.round(totalDist / 2 - offset2), y: 0, rotation: 0, goc: 0 },
    ];

    selectedId = id1;
    previousSelectedId = id2;

    setTimeout(() => {
      handleFitView();
    }, 40);
  }

  // Sao chép link chia sẻ
  function showToast(msg: string) {
    shareToastMessage = msg;
    if (shareToastTimer) clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToastMessage = null;
    }, 2800);
  }

  async function handleShareLink() {
    if (typeof window === 'undefined') return;
    const qs = encodeUrlState(shapes, viewport);
    const shareUrl = qs
      ? `${window.location.origin}${window.location.pathname}?${qs}`
      : window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Việt Nam to cỡ nào?',
          text: comparisonText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Đã sao chép liên kết vào bộ nhớ tạm!');
    } catch {
      showToast('Đã tạo link trên thanh địa chỉ, bạn có thể sao chép URL!');
    }
  }

  // Xuất ảnh so sánh 1200×630 PNG
  async function handleExportImage() {
    if (isExporting) return;
    isExporting = true;
    try {
      await exportComparisonImage({
        shapes,
        metaMap,
        loadedShapes,
        comparisonText,
        entityA: activeEntity,
        entityB: prevEntity,
      });
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="to-co-nao-app">
  <!-- Thanh tìm kiếm & phím tắt trên cùng (khi không trong tour) -->
  {#if !isTour}
    <header class="app-topbar">
      <SearchBox
        shapesCount={shapes.length}
        maxShapes={6}
        onAdd={handleAddShape}
      />

      <div class="top-shortcuts">
        <button
          type="button"
          class="action-btn"
          disabled={shapes.length < 2}
          onclick={handleOverlayCenters}
          title="Chồng tâm 2 hình đang so sánh"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Chồng tâm</span>
        </button>

        <button
          type="button"
          class="action-btn"
          disabled={shapes.length < 2}
          onclick={handleSideBySide}
          title="Đặt 2 hình cạnh nhau"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="5" width="8" height="14" rx="2"></rect>
            <rect x="14" y="5" width="8" height="14" rx="2"></rect>
          </svg>
          <span>Đặt cạnh</span>
        </button>

        <button
          type="button"
          class="action-btn tour-top-btn"
          onclick={() => handleStartTour(1)}
          title="Khám phá hành trình 10 chặng"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Hành trình</span>
        </button>
      </div>
    </header>
  {/if}

  <!-- Vùng thông báo ẩn cho trình đọc màn hình a11y -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {isTour ? currentTourComparison?.headline : comparisonText}
  </div>

  <!-- Toast Fun fact 4s khi thêm hình qua tìm kiếm (D3) -->
  {#if funFactToastMessage}
    <div class="funfact-toast-banner" role="status" aria-live="polite">
      <span class="toast-badge">💡 Fun fact</span>
      <span class="toast-text">{funFactToastMessage}</span>
    </div>
  {/if}

  <!-- Bàn kéo thả tương tác SVG -->
  <div class="board-frame" bind:clientWidth={boardWidth} bind:clientHeight={boardHeight}>
    <!-- shapesDataVersion ép Svelte nhận biết khi có dữ liệu path mới được nạp -->
    <span class="sr-only" aria-hidden="true">{shapesDataVersion}</span>

    <Board
      {shapes}
      {metaMap}
      {loadedShapes}
      {selectedId}
      {viewport}
      ghostShape={isTour ? ghostShape : null}
      isLocked={isTweening}
      onViewportChange={(vp) => (viewport = vp)}
      onSelectShape={handleSelectShape}
      onDeselect={handleDeselect}
      onMoveShape={handleMoveShape}
      onRotateShape={handleRotateShape}
      onDeleteShape={handleDeleteShape}
      onCenterWithPrev={handleCenterWithPrev}
      onFitView={handleFitView}
    />

    <!-- D1: Màn mở đầu phủ nhẹ phía trên (không che kín) -->
    {#if showIntro}
      <IntroModal
        onStartTour={() => handleStartTour(1)}
        onExplore={handleExploreFromIntro}
      />
    {/if}
  </div>

  <!-- Thanh dưới: Hoặc là TourCard (chế độ Hành trình), hoặc là Footer (tự do) -->
  {#if isTour}
    <TourCard
      stepIndex={currentTourStep}
      totalSteps={10}
      comparison={currentTourComparison}
      onPrev={handleTourPrev}
      onNext={handleTourNext}
      onExit={handleExitTour}
    />
  {:else}
    <Footer
      {shapes}
      {metaMap}
      allMeta={meta}
      {selectedId}
      {previousSelectedId}
      {activeEntity}
      {prevEntity}
      {comparisonText}
      {isExporting}
      {shareToastMessage}
      onSelectShape={handleSelectShape}
      onDeleteShape={handleDeleteShape}
      onOverlayCenters={handleOverlayCenters}
      onSideBySide={handleSideBySide}
      onRandomMatch={handleRandomMatch}
      onSelectPreset={handleSelectPreset}
      onShareLink={handleShareLink}
      onExportImage={handleExportImage}
      onStartTour={() => handleStartTour(1)}
      onSelectSurprisingPair={handleSelectSurprisingPair}
    />
  {/if}
</div>

<style>
  .to-co-nao-app {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    width: 100%;
    max-width: 1100px;
    margin-inline: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  /* Thanh tìm kiếm & phím tắt nhanh trên cùng */
  .app-topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .top-shortcuts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text, #1f1d1a);
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .action-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #cbd5e1;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tour-top-btn {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
  }

  .tour-top-btn:hover:not(:disabled) {
    background: #dbeafe;
    border-color: #93c5fd;
  }

  /* Toast Fun fact 4s */
  .funfact-toast-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 0.75rem;
    color: #166534;
    font-size: 0.8125rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    animation: fadeIn 0.2s ease-out;
  }

  .toast-badge {
    font-weight: 700;
    background: #dcfce7;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .toast-text {
    flex: 1;
    line-height: 1.4;
  }

  /* Khung bàn SVG */
  .board-frame {
    position: relative;
    width: 100%;
    height: clamp(380px, 58vh, 660px);
    border-radius: var(--radius, 1rem);
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .board-frame {
      height: 56vh;
      min-height: 360px;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Tôn trọng prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    :global(.board-camera) {
      transition: none !important;
    }
    .action-btn,
    .funfact-toast-banner,
    :global(.preset-chip),
    :global(.shape-chip) {
      transition: none !important;
    }
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
    border-width: 0;
  }
</style>
