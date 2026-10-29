<script lang="ts">
  import type { PlacedShape, EntityMeta, Viewport } from './types';
  import { SHAPE_PALETTE } from './types';
  import Shape from './Shape.svelte';
  import { screenToKm, scaleBar, fitView } from './math';

  interface Props {
    shapes: PlacedShape[];
    metaMap: Map<string, EntityMeta>;
    loadedShapes: Map<string, string>;
    selectedId: string | null;
    viewport: Viewport;
    ghostShape?: PlacedShape | null;
    isLocked?: boolean;
    onViewportChange: (vp: Viewport) => void;
    onSelectShape: (id: string) => void;
    onDeselect: () => void;
    onMoveShape: (id: string, x: number, y: number) => void;
    onRotateShape: (id: string, deg: number) => void;
    onDeleteShape: (id: string) => void;
    onCenterWithPrev: (id: string) => void;
    onFitView: () => void;
  }

  let {
    shapes,
    metaMap,
    loadedShapes,
    selectedId,
    viewport,
    ghostShape = null,
    isLocked = false,
    onViewportChange,
    onSelectShape,
    onDeselect,
    onMoveShape,
    onRotateShape,
    onDeleteShape,
    onCenterWithPrev,
    onFitView,
  }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  let width = $state(800);
  let height = $state(600);

  let isDraggingAny = $state(false);
  let isPanning = $state(false);
  let isPinchZooming = $state(false);

  // Background pointer tracking
  const bgPointers = new Map<number, { clientX: number; clientY: number }>();
  let panStartScreen = { x: 0, y: 0 };
  let panStartViewport = { cx: 0, cy: 0 };

  // Pinch zoom tracking
  let initialPinchDist = 0;
  let initialPinchScale = 1;
  let initialPinchMidKm = { x: 0, y: 0 };

  // Thước tỉ lệ thích ứng
  const scaleBarInfo = $derived(scaleBar(viewport.scale));

  // Giới hạn zoom: 0.03x đến 30x so với mức vừa khung
  const fitReference = $derived(
    fitView(shapes, width || 800, height || 600, 0.12, (id) => metaMap.get(id)?.bbox)
  );
  const minScale = $derived(Math.max((fitReference.scale || 1) * 0.03, 0.0005));
  const maxScale = $derived(Math.min((fitReference.scale || 1) * 30, 100));

  function clampScale(s: number): number {
    return Math.min(Math.max(s, minScale), maxScale);
  }

  export function getContainerRect(): DOMRect | undefined {
    return containerEl?.getBoundingClientRect();
  }

  // Pan & pinch-zoom trên nền
  function handleBgPointerDown(e: PointerEvent) {
    if (isLocked) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Bấm vào nền -> bỏ chọn hình đang active
    onDeselect();

    bgPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (bgPointers.size === 1) {
      isPanning = true;
      panStartScreen = { x: e.clientX, y: e.clientY };
      panStartViewport = { cx: viewport.cx, cy: viewport.cy };
      try {
        svgEl?.setPointerCapture(e.pointerId);
      } catch {}
    } else if (bgPointers.size === 2) {
      isPanning = false;
      isPinchZooming = true;
      const [p1, p2] = Array.from(bgPointers.values());
      initialPinchDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      initialPinchScale = viewport.scale;

      const midScreen = {
        x: (p1.clientX + p2.clientX) / 2 - (containerEl?.getBoundingClientRect().left || 0),
        y: (p1.clientY + p2.clientY) / 2 - (containerEl?.getBoundingClientRect().top || 0),
      };
      initialPinchMidKm = screenToKm(midScreen, viewport, width, height);
    }
  }

  function handleBgPointerMove(e: PointerEvent) {
    if (bgPointers.has(e.pointerId)) {
      bgPointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    if (isPinchZooming && bgPointers.size >= 2) {
      e.preventDefault();
      const [p1, p2] = Array.from(bgPointers.values());
      const currentDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      if (initialPinchDist > 0) {
        const factor = currentDist / initialPinchDist;
        const targetScale = clampScale(initialPinchScale * factor);

        const currentMidScreen = {
          x: (p1.clientX + p2.clientX) / 2 - (containerEl?.getBoundingClientRect().left || 0),
          y: (p1.clientY + p2.clientY) / 2 - (containerEl?.getBoundingClientRect().top || 0),
        };

        const newCx = initialPinchMidKm.x - (currentMidScreen.x - width / 2) / targetScale;
        const newCy = initialPinchMidKm.y - (currentMidScreen.y - height / 2) / targetScale;

        onViewportChange({ cx: newCx, cy: newCy, scale: targetScale });
      }
      return;
    }

    if (isPanning && bgPointers.size === 1) {
      e.preventDefault();
      const dxScreen = e.clientX - panStartScreen.x;
      const dyScreen = e.clientY - panStartScreen.y;
      const newCx = panStartViewport.cx - dxScreen / viewport.scale;
      const newCy = panStartViewport.cy - dyScreen / viewport.scale;
      onViewportChange({ cx: newCx, cy: newCy, scale: viewport.scale });
    }
  }

  function handleBgPointerUp(e: PointerEvent) {
    bgPointers.delete(e.pointerId);

    if (bgPointers.size < 2 && isPinchZooming) {
      isPinchZooming = false;
    }

    if (bgPointers.size === 0 && isPanning) {
      isPanning = false;
      try {
        svgEl?.releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  // Zoom bằng lăn chuột quanh con trỏ
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (isLocked) return;
    const rect = containerEl?.getBoundingClientRect();
    if (!rect) return;

    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const ptKm = screenToKm({ x: sx, y: sy }, viewport, width, height);

    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const targetScale = clampScale(viewport.scale * zoomFactor);

    const newCx = ptKm.x - (sx - width / 2) / targetScale;
    const newCy = ptKm.y - (sy - height / 2) / targetScale;

    onViewportChange({ cx: newCx, cy: newCy, scale: targetScale });
  }

  // Nút điều khiển zoom
  function zoomByFactor(factor: number) {
    if (isLocked) return;
    const targetScale = clampScale(viewport.scale * factor);
    onViewportChange({
      cx: viewport.cx,
      cy: viewport.cy,
      scale: targetScale,
    });
  }

  function handleDragStart() {
    isDraggingAny = true;
  }

  function handleDragEnd() {
    isDraggingAny = false;
  }
</script>

<div
  class="board-container"
  bind:this={containerEl}
  bind:clientWidth={width}
  bind:clientHeight={height}
>
  <svg
    class="board-svg"
    bind:this={svgEl}
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    onwheel={handleWheel}
    onpointerdown={handleBgPointerDown}
    onpointermove={handleBgPointerMove}
    onpointerup={handleBgPointerUp}
    onpointercancel={handleBgPointerUp}
  >
    <defs>
      <!-- Đổ bóng cho hình đang chọn -->
      <filter id="active-shape-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.25" />
      </filter>

      <!-- Lưới điểm toạ độ nhẹ tạo cảm giác không gian -->
      <pattern id="board-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="1" fill="#d6cfc4" opacity="0.45" />
      </pattern>
    </defs>

    <!-- Nền kéo thả -->
    <rect
      class="board-bg"
      width={width}
      height={height}
      fill="url(#board-grid)"
      style="cursor: {isPanning ? 'grabbing' : 'default'};"
    />

    <!-- Khung nhìn Camera: dịch tâm (cx, cy) và phóng to theo tỉ lệ scale -->
    <g
      class="board-camera"
      transform="translate({width / 2}, {height / 2}) scale({viewport.scale}) translate({-viewport.cx}, {-viewport.cy})"
      style={isLocked ? 'pointer-events: none;' : ''}
    >
      <!-- Hình mốc mờ từ chặng trước (nếu có trong chế độ hành trình) -->
      {#if ghostShape}
        {@const ghostD = loadedShapes.get(ghostShape.id) || ''}
        {#if ghostD}
          <g
            class="ghost-shape-marker"
            transform="translate({ghostShape.x}, {ghostShape.y}) rotate({ghostShape.rotation ?? ghostShape.goc ?? 0})"
            opacity="0.25"
            style="pointer-events: none;"
            aria-hidden="true"
          >
            <path
              d={ghostD}
              fill="#94a3b8"
              stroke="#64748b"
              stroke-width="1.5"
              stroke-dasharray="4 4"
              vector-effect="non-scaling-stroke"
              fill-rule="evenodd"
            />
          </g>
        {/if}
      {/if}

      {#each shapes as shape, index (shape.id)}
        {@const meta = metaMap.get(shape.id)}
        {@const svgD = loadedShapes.get(shape.id) || ''}
        {@const color = SHAPE_PALETTE[index % SHAPE_PALETTE.length]}
        {@const isSelected = selectedId === shape.id}

        {#if svgD}
          <Shape
            {shape}
            {meta}
            {svgD}
            {color}
            {isSelected}
            {isDraggingAny}
            scale={viewport.scale}
            {viewport}
            getContainerRect={() => containerEl?.getBoundingClientRect()}
            containerWidth={width}
            containerHeight={height}
            onSelect={() => onSelectShape(shape.id)}
            onMove={(x, y) => onMoveShape(shape.id, x, y)}
            onRotate={(deg) => onRotateShape(shape.id, deg)}
            onDelete={() => onDeleteShape(shape.id)}
            onCenterWithPrev={() => onCenterWithPrev(shape.id)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        {/if}
      {/each}
    </g>
  </svg>

  <!-- Thước tỉ lệ thích ứng (Adaptive Scale Bar) -->
  <div class="scale-bar-card" aria-hidden="true">
    <span class="scale-bar-label">{scaleBarInfo.label}</span>
    <div class="scale-bar-line-wrap" style="width: {scaleBarInfo.px}px;">
      <div class="scale-bar-tick left"></div>
      <div class="scale-bar-line"></div>
      <div class="scale-bar-tick right"></div>
    </div>
  </div>

  <!-- Bộ nút điều khiển zoom (+ / − / vừa khung) -->
  <div class="zoom-controls" role="toolbar" aria-label="Điều khiển thu phóng">
    <button
      type="button"
      class="zoom-btn"
      title="Phóng to"
      aria-label="Phóng to"
      onclick={() => zoomByFactor(1.25)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <button
      type="button"
      class="zoom-btn"
      title="Thu nhỏ"
      aria-label="Thu nhỏ"
      onclick={() => zoomByFactor(1 / 1.25)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <button
      type="button"
      class="zoom-btn fit-btn"
      title="Vừa khung nhìn"
      aria-label="Cân lại khung vừa các hình"
      onclick={onFitView}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
      </svg>
    </button>
  </div>
</div>

<style>
  .board-container {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 420px;
    background: #faf8f5;
    border-radius: var(--radius, 1rem);
    border: 1px solid var(--color-border, #e6e1d9);
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .board-svg {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .board-bg {
    touch-action: none;
  }

  /* Thước tỉ lệ */
  .scale-bar-card {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.35rem 0.65rem 0.45rem;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid #e2ddd3;
    border-radius: 0.5rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    pointer-events: none;
    font-size: 0.75rem;
    font-weight: 600;
    color: #4b453e;
  }

  .scale-bar-line-wrap {
    position: relative;
    height: 6px;
    display: flex;
    align-items: center;
  }

  .scale-bar-line {
    width: 100%;
    height: 2px;
    background: #4b453e;
  }

  .scale-bar-tick {
    position: absolute;
    width: 2px;
    height: 6px;
    background: #4b453e;
  }

  .scale-bar-tick.left {
    left: 0;
  }

  .scale-bar-tick.right {
    right: 0;
  }

  /* Nút thu phóng */
  .zoom-controls {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    color: #1f1d1a;
    border: 1px solid #e2ddd3;
    border-radius: 0.5rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .zoom-btn:hover {
    background: #ffffff;
    border-color: #cfc7ba;
  }

  .zoom-btn:active {
    transform: scale(0.95);
  }

  .zoom-btn:focus-visible {
    outline: 2px solid var(--color-text, #1f1d1a);
    outline-offset: 2px;
  }
</style>
