<script lang="ts">
  import { onMount } from 'svelte';
  import type { PlacedShape, Viewport, EntityMeta } from './types';
  import Board from './Board.svelte';
  import SearchBox from './SearchBox.svelte';
  import Footer from './Footer.svelte';
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

  // Câu so sánh diện tích giữa 2 hình
  const comparisonText = $derived(
    activeEntity && prevEntity ? formatComparison(activeEntity, prevEntity) : ''
  );

  onMount(async () => {
    // Tải trước dữ liệu 34 tỉnh VN trong thời gian rảnh
    prefetchVn();

    // 1. Kiểm tra xem URL có chứa tham số ?h= không để dựng lại bàn
    if (typeof window !== 'undefined' && window.location.search) {
      const decoded = decodeUrlState(window.location.search, (id) => metaMap.has(id));
      if (decoded.shapes && decoded.shapes.length > 0) {
        const initialShapes = decoded.shapes.slice(0, 6);
        // Đảm bảo dữ liệu các shape đã nạp đủ
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

    // Nếu không có param URL, cân khung nhìn ban đầu vừa 2 hình mặc định
    setTimeout(() => {
      handleFitView();
      isInitialized = true;
    }, 60);
  });

  // Tự động đồng bộ trạng thái bàn lên URL (?h=id:x:y:goc,...&z=...) sau debounce 300ms
  $effect(() => {
    const currentShapes = shapes;
    const currentVp = viewport;

    if (!isInitialized || typeof window === 'undefined') return;

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

  // Thêm một hình mới vào bàn
  async function handleAddShape(id: string) {
    if (shapes.length >= 6) return;

    // Đảm bảo dữ liệu path SVG đã được nạp
    if (!loadedShapes.has(id)) {
      await getShape(id);
      shapesDataVersion++;
    }

    // Đặt hình mới gần tâm viewport
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

    // Tự động cân khung khi thêm hình
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

  // Chọn kèo ngẫu nhiên (1 tỉnh × 1 nước có diện tích chênh lệch ≤ 3 lần)
  async function handleRandomMatch() {
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
  <!-- Thanh tìm kiếm trên cùng -->
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
    </div>
  </header>

  <!-- Vùng thông báo ẩn cho trình đọc màn hình a11y -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {comparisonText}
  </div>

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
      onViewportChange={(vp) => (viewport = vp)}
      onSelectShape={handleSelectShape}
      onDeselect={handleDeselect}
      onMoveShape={handleMoveShape}
      onRotateShape={handleRotateShape}
      onDeleteShape={handleDeleteShape}
      onCenterWithPrev={handleCenterWithPrev}
      onFitView={handleFitView}
    />
  </div>

  <!-- Thanh dưới: Câu so sánh, Kèo kinh điển, Tác vụ và Danh sách hình chi tiết -->
  <Footer
    {shapes}
    {metaMap}
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
  />
</div>

<style>
  .to-co-nao-app {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    width: 100%;
    max-width: 1100px;
    margin-inline: auto;
    overflow-x: hidden;
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

  /* Khung bàn SVG */
  .board-frame {
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

  /* Tôn trọng prefers-reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    :global(.board-camera) {
      transition: none !important;
    }
    .action-btn,
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
