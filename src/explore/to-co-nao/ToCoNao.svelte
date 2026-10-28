<script lang="ts">
  import { onMount } from 'svelte';
  import type { PlacedShape, Viewport, EntityMeta } from './types';
  import { SHAPE_PALETTE } from './types';
  import Board from './Board.svelte';
  import SearchBox from './SearchBox.svelte';
  import { metaMap, loadedShapes, getShape, prefetchVn } from './dataLoader';
  import { fitView, formatComparison, formatNumberVi } from './math';

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

  // Map reactive cho các shape đã nạp
  let shapesDataVersion = $state(0);

  // Lấy shape đang chọn và shape chọn trước đó (hoặc 2 shape đầu tiên)
  const activeShape = $derived(
    shapes.find((s) => s.id === selectedId) || shapes[0] || null
  );

  const prevShape = $derived(
    (previousSelectedId && shapes.find((s) => s.id === previousSelectedId && s.id !== activeShape?.id)) ||
    shapes.find((s) => s.id !== activeShape?.id) ||
    null
  );

  const entityA = $derived(activeShape ? metaMap.get(activeShape.id) : undefined);
  const entityB = $derived(prevShape ? metaMap.get(prevShape.id) : undefined);

  // Câu so sánh diện tích giữa 2 hình
  const comparisonText = $derived(
    entityA && entityB ? formatComparison(entityA, entityB) : ''
  );

  onMount(() => {
    // Tải trước dữ liệu 34 tỉnh VN trong thời gian rảnh rỗi
    prefetchVn();

    // Cân khung nhìn ban đầu vừa 2 hình mặc định
    setTimeout(() => {
      handleFitView();
    }, 50);
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
    }, 30);
  }
</script>

<div class="to-co-nao-app">
  <!-- Thanh điều khiển trên cùng: Tìm kiếm và các nút căn chỉnh nhanh -->
  <header class="app-topbar">
    <SearchBox
      shapesCount={shapes.length}
      maxShapes={6}
      onAdd={handleAddShape}
    />

    <div class="quick-actions">
      <button
        type="button"
        class="action-btn"
        disabled={shapes.length < 2}
        onclick={handleOverlayCenters}
        title="Chồng tâm 2 hình đang so sánh"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="8" height="14" rx="2"></rect>
          <rect x="14" y="5" width="8" height="14" rx="2"></rect>
        </svg>
        <span>Đặt cạnh nhau</span>
      </button>
    </div>
  </header>

  <!-- Banner câu so sánh diện tích -->
  {#if comparisonText}
    <div class="comparison-banner">
      <h2 class="comparison-title">{comparisonText}</h2>
      {#if entityA && entityB}
        <p class="comparison-sub">
          <strong>{entityA.name}</strong> ({formatNumberVi(entityA.area)} km²)
          so với
          <strong>{entityB.name}</strong> ({formatNumberVi(entityB.area)} km²)
        </p>
      {/if}
    </div>
  {/if}

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

  <!-- Danh sách các hình đang có trên bàn (chips) -->
  <footer class="app-chips-bar">
    <div class="chips-list">
      {#each shapes as s, index (s.id)}
        {@const m = metaMap.get(s.id)}
        {@const color = SHAPE_PALETTE[index % SHAPE_PALETTE.length]}
        {@const isSelected = selectedId === s.id}

        <div
          class="shape-chip"
          class:selected={isSelected}
          style="--chip-color: {color.border};"
        >
          <button
            type="button"
            class="chip-select-btn"
            onclick={() => handleSelectShape(s.id)}
            title="Chọn {m?.name || s.id}"
          >
            <span class="chip-dot" style="background: {color.stroke};"></span>
            <span class="chip-name">{m?.name || s.id}</span>
            <span class="chip-area">{formatNumberVi(m?.area || 0)} km²</span>
          </button>

          {#if shapes.length > 1}
            <button
              type="button"
              class="chip-remove-btn"
              title="Xoá khỏi bàn"
              aria-label="Xoá {m?.name || s.id} khỏi bàn"
              onclick={() => handleDeleteShape(s.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </footer>
</div>

<style>
  .to-co-nao-app {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    margin-inline: auto;
  }

  /* Thanh tìm kiếm & hành động */
  .app-topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .quick-actions {
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

  /* Banner so sánh diện tích */
  .comparison-banner {
    text-align: center;
    padding: 0.5rem 1rem;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: var(--radius, 1rem);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
  }

  .comparison-title {
    font-size: clamp(1.25rem, 3.5vw, 1.75rem);
    font-weight: 700;
    color: var(--color-text, #1f1d1a);
    margin: 0;
  }

  .comparison-sub {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b665f);
    margin-top: 0.25rem;
  }

  /* Khung bàn SVG */
  .board-frame {
    width: 100%;
    height: clamp(380px, 60vh, 660px);
    border-radius: var(--radius, 1rem);
    overflow: hidden;
  }

  /* Danh sách chip các hình */
  .app-chips-bar {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .chips-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .shape-chip {
    display: inline-flex;
    align-items: center;
    background: #ffffff;
    border: 1.5px solid var(--color-border, #e6e1d9);
    border-radius: 9999px;
    padding: 0.2rem 0.5rem 0.2rem 0.65rem;
    font-size: 0.8125rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .shape-chip.selected {
    border-color: var(--chip-color, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .chip-select-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
  }

  .chip-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .chip-name {
    font-weight: 600;
  }

  .chip-area {
    color: var(--color-text-muted, #6b665f);
  }

  .chip-remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    margin-left: 0.35rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .chip-remove-btn:hover {
    background: #fee2e2;
    color: #dc2626;
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
