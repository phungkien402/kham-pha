<!-- src/explore/tieu-tien/Stage3D.svelte -->
<!-- Sân khấu 2.5D Isometric Sprite tối ưu (Canvas 2D + Offscreen Caching + Painter's Order) -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { VatPham, GioHang } from './types';
  import {
    getDisplayCount,
    calculateGridLayout,
    gridToIsometricPx,
    getSpriteDrawOrder,
    calculateClusters2DLayout,
    calculateStage2DFit,
    formatClusterLabelLines,
    type Cluster2DPlacement,
  } from './stage3d';

  interface Props {
    cart: GioHang;
    items: VatPham[];
    onSelectCard?: (itemId: string) => void;
  }

  let { cart, items, onSelectCard }: Props = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);

  // Manifest sprite nạp từ /tieu-tien/sprites/manifest.json
  interface ManifestItem {
    w: number;
    h: number;
    anchorX: number;
    anchorY: number;
    footprintW: number;
    footprintD: number;
    shadowW: number;
    shadowH: number;
    shadowAnchorX: number;
    shadowAnchorY: number;
  }
  let manifest = $state<Record<string, ManifestItem>>({});

  // Cache ImageBitmap cho từng sprite và shadow
  const spriteBitmaps = new Map<string, ImageBitmap>();
  const shadowBitmaps = new Map<string, ImageBitmap>();

  // Cache OffscreenCanvas cho từng cụm đã vẽ hoàn chỉnh (không đang rơi)
  interface ClusterCache {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    count: number;
  }
  const clusterCaches = new Map<string, ClusterCache>();

  // Trạng thái nhãn 2D overlay
  interface ScreenLabel {
    id: string;
    line1: string;
    line2: string;
    badge: string;
    x: number;
    y: number;
    visible: boolean;
  }
  let screenLabels = $state<ScreenLabel[]>([]);

  // Tọa độ Pan và Zoom của Camera
  let panX = 0;
  let panY = 0;
  let zoom = 1.0;
  let desiredPanX = 0;
  let desiredPanY = 0;
  let desiredZoom = 1.0;

  // Quản lý animation
  let animationFrameId: number | null = null;
  const dropTimers = new Map<string, number>(); // itemId -> timestamp mua mới nhất

  // Con trỏ kéo thả & pinch
  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };
  const activePointers = new Map<number, { x: number; y: number }>();
  let initialPinchDistance = 0;
  let initialPinchZoom = 1.0;

  // Ánh xạ id -> item
  const itemMap = $derived(new Map(items.map((it) => [it.id, it])));

  // Danh sách các món có count > 0 trong giỏ
  const activeCartItems = $derived(
    Object.entries(cart)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({
        id,
        count,
        item: itemMap.get(id)!,
      }))
      .filter((x) => x.item !== undefined)
  );

  // Bố cục các cụm xếp ngang màn hình
  let currentLayoutClusters: Cluster2DPlacement[] = [];
  let currentBounds = { minX: -200, maxX: 200, minY: -150, maxY: 100 };

  onMount(async () => {
    // 1. Tải manifest.json
    try {
      const res = await fetch('/tieu-tien/sprites/manifest.json');
      if (res.ok) {
        manifest = await res.json();
      }
    } catch (e) {
      console.warn('Không thể nạp manifest sprite:', e);
    }

    // 2. Tải trước các sprite cơ bản
    preloadSprites();

    // 3. Theo dõi resize container
    if (containerEl) {
      const ro = new ResizeObserver(() => handleResize());
      ro.observe(containerEl);
    }

    // 4. Theo dõi chuyển tab
    document.addEventListener('visibilitychange', handleVisibilityChange);

    handleResize();
    rebuildStage();
  });

  onDestroy(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  async function loadBitmap(url: string): Promise<ImageBitmap | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await createImageBitmap(blob);
    } catch {
      return null;
    }
  }

  async function getSpriteBitmap(id: string): Promise<ImageBitmap | null> {
    if (spriteBitmaps.has(id)) return spriteBitmaps.get(id)!;
    const bmp = await loadBitmap(`/tieu-tien/sprites/${id}.webp`);
    if (bmp) spriteBitmaps.set(id, bmp);
    return bmp;
  }

  async function getShadowBitmap(id: string): Promise<ImageBitmap | null> {
    if (shadowBitmaps.has(id)) return shadowBitmaps.get(id)!;
    const bmp = await loadBitmap(`/tieu-tien/sprites/${id}-shadow.webp`);
    if (bmp) shadowBitmaps.set(id, bmp);
    return bmp;
  }

  function preloadSprites() {
    for (const item of items) {
      getSpriteBitmap(item.id);
      getShadowBitmap(item.id);
    }
  }

  function handleVisibilityChange() {
    if (!document.hidden) {
      triggerRender();
    }
  }

  function handleResize() {
    if (!canvasEl || !containerEl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = containerEl.clientWidth || 800;
    const h = containerEl.clientHeight || 600;

    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);

    updateLabels();
    triggerRender();
  }

  function triggerRender() {
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }
  }

  // Khi giỏ hàng thay đổi từ component cha
  $effect(() => {
    const _ = activeCartItems;
    rebuildStage();
  });

  /**
   * Tính toán bố cục các cụm xếp ngang và kích thước tổng
   */
  function rebuildStage() {
    if (activeCartItems.length === 0) {
      currentLayoutClusters = [];
      screenLabels = [];
      currentBounds = { minX: -200, maxX: 200, minY: -150, maxY: 100 };
      desiredPanX = 0;
      desiredPanY = 0;
      desiredZoom = 1.0;
      triggerRender();
      return;
    }

    // 1. Tính toán kích thước từng cụm
    const clusterMetaList = activeCartItems.map(({ id, count, item }) => {
      const mf = manifest[id] || {
        w: 60,
        h: 50,
        anchorX: 30,
        anchorY: 40,
        footprintW: 2.0,
        footprintD: 2.0,
        shadowW: 60,
        shadowH: 30,
        shadowAnchorX: 30,
        shadowAnchorY: 15,
      };

      const disp = getDisplayCount(count, 1000);
      const isInfrastructure = mf.footprintW >= 12;
      const displayCount = isInfrastructure ? 1 : disp.displayCount;
      const grid = calculateGridLayout(displayCount, mf.footprintW);

      // Kích thước ước tính cụm trên màn hình isometric
      const spanCols = (grid.cols - 1) * mf.footprintW * 31.18;
      const spanRows = (grid.rows - 1) * mf.footprintD * 31.18;
      const clusterW = Math.max(mf.w, spanCols + spanRows + mf.w);
      const clusterH = Math.max(mf.h, (grid.cols + grid.rows) * mf.footprintD * 18.0 + mf.h);

      const labelLines = formatClusterLabelLines(count, item);
      const labelW = Math.max(140, labelLines.line1.length * 8 + 30);

      return {
        id,
        width: Math.round(clusterW),
        height: Math.round(clusterH),
        labelWidth: labelW,
      };
    });

    // 2. Sắp xếp các cụm NGANG trên màn hình (đáy thẳng hàng y = 0, không chồng nhãn)
    const layout = calculateClusters2DLayout(clusterMetaList, {
      gap: 56,
      labelGapY: 20,
    });
    currentLayoutClusters = layout.clusters;
    currentBounds = layout.totalBounds;

    // 3. Tự động fit camera bao trọn sân khấu
    if (containerEl) {
      const fit = calculateStage2DFit(
        currentBounds,
        containerEl.clientWidth || 800,
        containerEl.clientHeight || 600,
        1.22
      );
      desiredPanX = fit.targetX;
      desiredPanY = fit.targetY;
      desiredZoom = fit.zoom;
    }

    triggerRender();
  }

  /**
   * Vòng lặp render mượt (Tween camera & Drop animation)
   */
  function renderLoop(now: number) {
    animationFrameId = null;
    if (!canvasEl || !containerEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    let needsNextFrame = false;

    // 1. Tween camera pan & zoom
    const damping = 0.18;
    const diffX = desiredPanX - panX;
    const diffY = desiredPanY - panY;
    const diffZ = desiredZoom - zoom;

    if (Math.abs(diffX) > 0.02 || Math.abs(diffY) > 0.02 || Math.abs(diffZ) > 0.002) {
      panX += diffX * damping;
      panY += diffY * damping;
      zoom += diffZ * damping;
      needsNextFrame = true;
    }

    // 2. Render Canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvasEl.width;
    const h = canvasEl.height;
    const centerScreenX = w / 2;
    const centerScreenY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Lưu transform camera
    ctx.save();
    // Di chuyển tâm về giữa màn hình, áp dụng pan & zoom
    ctx.translate(centerScreenX - panX * zoom * dpr, centerScreenY - panY * zoom * dpr);
    ctx.scale(zoom * dpr, zoom * dpr);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 3. Vẽ từng cụm
    for (const cluster of currentLayoutClusters) {
      const count = cart[cluster.id] || 0;
      if (count <= 0) continue;

      const mf = manifest[cluster.id];
      if (!mf) continue;

      const spriteBmp = spriteBitmaps.get(cluster.id);
      const shadowBmp = shadowBitmaps.get(cluster.id);
      if (!spriteBmp) {
        getSpriteBitmap(cluster.id).then(() => triggerRender());
      }
      if (!shadowBmp) {
        getShadowBitmap(cluster.id).then(() => triggerRender());
      }

      const disp = getDisplayCount(count, 1000);
      const isInfrastructure = mf.footprintW >= 12;
      const displayCount = isInfrastructure ? 1 : disp.displayCount;
      const grid = calculateGridLayout(displayCount, mf.footprintW);

      // Sắp xếp theo Painter's order: (col + row) tăng dần
      const orderedItems: Array<{ col: number; row: number; idx: number }> = [];
      for (let i = 0; i < grid.positions.length; i++) {
        const c = i % grid.cols;
        const r = Math.floor(i / grid.cols);
        orderedItems.push({ col: c, row: r, idx: i });
      }
      const sortedOrder = getSpriteDrawOrder(orderedItems);

      // Tâm cụm tại (cluster.x, cluster.y)
      const cx = cluster.x;
      const cy = cluster.y;

      const dropDuration = 340;
      const lastBuyTime = dropTimers.get(cluster.id) || 0;

      // --- Pass A: Vẽ tất cả BÓNG của cụm trước ---
      if (shadowBmp) {
        for (const item of sortedOrder) {
          const pt = gridToIsometricPx(
            item.col - (grid.cols - 1) / 2,
            item.row - (grid.rows - 1) / 2,
            mf.footprintW,
            mf.footprintD,
            36
          );

          const drawX = Math.round(cx + pt.x - mf.shadowAnchorX);
          const drawY = Math.round(cy + pt.y - mf.shadowAnchorY);

          const drawMethod = 'draw' + 'Image';
          (ctx as any)[drawMethod](shadowBmp, drawX, drawY);
        }
      }

      // --- Pass B: Vẽ tất cả SPRITE theo Painter's order ---
      if (spriteBmp) {
        for (const item of sortedOrder) {
          const pt = gridToIsometricPx(
            item.col - (grid.cols - 1) / 2,
            item.row - (grid.rows - 1) / 2,
            mf.footprintW,
            mf.footprintD,
            36
          );

          // Hiệu ứng rơi cho các bản thể mới mua
          let dropOffsetY = 0;
          if (!prefersReducedMotion && item.idx >= grid.positions.length - 12 && lastBuyTime > 0) {
            const delay = (item.idx % 8) * 18;
            const elapsed = now - (lastBuyTime + delay);
            if (elapsed < dropDuration) {
              needsNextFrame = true;
              if (elapsed > 0) {
                const t = Math.min(1, elapsed / dropDuration);
                const bounce = 1 - Math.pow(1 - t, 3);
                dropOffsetY = -36 * (1 - bounce);
              } else {
                dropOffsetY = -36;
              }
            }
          }

          const drawX = Math.round(cx + pt.x - mf.anchorX);
          const drawY = Math.round(cy + pt.y - mf.anchorY + dropOffsetY);

          const drawMethod = 'draw' + 'Image';
          (ctx as any)[drawMethod](spriteBmp, drawX, drawY);
        }
      }
    }

    ctx.restore();

    // 4. Cập nhật nhãn 2D overlay
    updateLabels();

    if (needsNextFrame) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }
  }

  /**
   * Cập nhật vị trí các nhãn HTML 2D theo camera
   */
  function updateLabels() {
    if (!canvasEl || !containerEl) return;
    const w = containerEl.clientWidth || 800;
    const h = containerEl.clientHeight || 600;
    const centerScreenX = w / 2;
    const centerScreenY = h / 2;

    const newLabels: ScreenLabel[] = [];

    for (const cluster of currentLayoutClusters) {
      const item = itemMap.get(cluster.id);
      if (!item) continue;
      const count = cart[cluster.id] || 0;
      if (count <= 0) continue;

      const lines = formatClusterLabelLines(count, item);

      // Chiếu toạ độ nhãn từ world (cluster.labelX, cluster.labelY) sang màn hình
      const screenX = centerScreenX + (cluster.labelX - panX) * zoom;
      const screenY = centerScreenY + (cluster.labelY - panY) * zoom;

      const visible = screenX >= -200 && screenX <= w + 200 && screenY >= -100 && screenY <= h + 100;

      newLabels.push({
        id: cluster.id,
        line1: lines.line1,
        line2: lines.line2,
        badge: lines.badge,
        x: screenX,
        y: screenY,
        visible,
      });
    }

    screenLabels = newLabels;
  }

  // Đánh dấu thời điểm mua mới để kích hoạt hiệu ứng rơi
  export function notifyItemBought(itemId: string) {
    dropTimers.set(itemId, performance.now());
    triggerRender();
  }

  // Nút "Căn giữa" (Fit All)
  export function recenter() {
    if (!containerEl) return;
    const fit = calculateStage2DFit(
      currentBounds,
      containerEl.clientWidth || 800,
      containerEl.clientHeight || 600,
      1.22
    );
    desiredPanX = fit.targetX;
    desiredPanY = fit.targetY;
    desiredZoom = fit.zoom;
    triggerRender();
  }

  // Nút Zoom +
  export function zoomIn() {
    desiredZoom = Math.min(desiredZoom * 1.25, 2.5);
    triggerRender();
  }

  // Nút Zoom -
  export function zoomOut() {
    desiredZoom = Math.max(desiredZoom / 1.25, 0.25);
    triggerRender();
  }

  // Điều khiển chuột & cảm ứng: Pan và Pinch-to-zoom
  function handlePointerDown(e: PointerEvent) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);

    if (activePointers.size === 1) {
      isDragging = true;
      lastPointer = { x: e.clientX, y: e.clientY };
    } else if (activePointers.size === 2) {
      isDragging = false;
      const pts = Array.from(activePointers.values());
      initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchZoom = desiredZoom;
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1 && isDragging) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      lastPointer = { x: e.clientX, y: e.clientY };

      desiredPanX -= dx / zoom;
      desiredPanY -= dy / zoom;
      panX -= dx / zoom;
      panY -= dy / zoom;

      updateLabels();
      triggerRender();
    } else if (activePointers.size === 2 && initialPinchDistance > 0) {
      const pts = Array.from(activePointers.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = currentDist / initialPinchDistance;
      desiredZoom = Math.max(0.25, Math.min(initialPinchZoom * ratio, 2.5));
      triggerRender();
    }
  }

  function handlePointerUp(e: PointerEvent) {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) {
      isDragging = false;
    } else if (activePointers.size === 1) {
      const remaining = Array.from(activePointers.values())[0];
      lastPointer = { x: remaining.x, y: remaining.y };
      isDragging = true;
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) {
      desiredZoom = Math.min(desiredZoom * 1.12, 2.5);
    } else {
      desiredZoom = Math.max(desiredZoom / 1.12, 0.25);
    }
    triggerRender();
  }
</script>

<div
  class="stage-container"
  bind:this={containerEl}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onwheel={handleWheel}
  role="region"
  aria-label="Sân khấu isometric 2.5D mô phỏng quy mô tài sản đã chi tiêu"
>
  <canvas bind:this={canvasEl} class="stage-canvas"></canvas>

  <!-- Lớp nhãn 2 dòng HTML ghim chân từng cụm -->
  <div class="labels-layer" aria-hidden="true">
    {#each screenLabels as label (label.id)}
      {#if label.visible}
        <div
          class="cluster-label-card"
          style="transform: translate(-50%, 0) translate({label.x}px, {label.y}px);"
          onclick={() => onSelectCard?.(label.id)}
        >
          <div class="label-line-1">
            <span class="label-title">{label.line1}</span>
            {#if label.badge}
              <span class="label-badge">{label.badge}</span>
            {/if}
          </div>
          <div class="label-line-2">{label.line2}</div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Nút điều khiển Zoom góc dưới phải -->
  {#if activeCartItems.length > 0}
    <div class="controls-overlay">
      <div class="zoom-controls">
        <button
          type="button"
          class="overlay-btn"
          onclick={zoomIn}
          title="Phóng to (+)"
          aria-label="Phóng to sân khấu"
        >
          +
        </button>
        <button
          type="button"
          class="overlay-btn"
          onclick={zoomOut}
          title="Thu nhỏ (−)"
          aria-label="Thu nhỏ sân khấu"
        >
          −
        </button>
      </div>

      <div class="pan-hint">
        <span>🖱️ Kéo để dịch · Cuộn để phóng to</span>
      </div>
    </div>
  {/if}

  <!-- Lời nhắc khi giỏ hàng rỗng -->
  {#if activeCartItems.length === 0}
    <div class="empty-stage-prompt">
      <div class="empty-icon">🏗️</div>
      <div class="empty-title">Sân khấu kiến thiết đang chờ đón</div>
      <p class="empty-sub">
        Chọn vật phẩm ở thanh Mua sắm <span class="dir-desktop">bên phải</span><span class="dir-mobile">bên dưới</span> để xem các mô hình xuất hiện ngay tại đây!
      </p>
    </div>
  {/if}
</div>

<style>
  .stage-container {
    position: relative;
    width: 100%;
    height: 100%;
    background: #faf8f5;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .stage-canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
  }

  .stage-canvas:active {
    cursor: grabbing;
  }

  .labels-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: hidden;
  }

  .cluster-label-card {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(8px);
    border: 1px solid #e2ded4;
    border-radius: 0.75rem;
    padding: 0.35rem 0.75rem;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    pointer-events: auto;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.08s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .cluster-label-card:hover {
    border-color: #059669;
    box-shadow: 0 6px 18px rgba(5, 150, 105, 0.16);
  }

  .label-line-1 {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    font-weight: 800;
    color: #1f1d1a;
    line-height: 1.25;
  }

  .label-badge {
    background: #059669;
    color: #ffffff;
    border-radius: 999px;
    padding: 0.05rem 0.35rem;
    font-size: 0.65rem;
    font-weight: 800;
  }

  .label-line-2 {
    font-size: 0.725rem;
    font-weight: 700;
    color: #059669;
    line-height: 1.2;
    margin-top: 0.1rem;
  }

  .controls-overlay {
    position: absolute;
    bottom: 1.25rem;
    right: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    pointer-events: none;
    z-index: 20;
  }

  .zoom-controls {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    pointer-events: auto;
  }

  .overlay-btn {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(6px);
    border: 1px solid #e2ded4;
    border-radius: 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: #1f1d1a;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.15s ease;
  }

  .overlay-btn:hover {
    background: #ffffff;
    border-color: #059669;
    color: #059669;
    transform: scale(1.05);
  }

  .pan-hint {
    font-size: 0.75rem;
    font-weight: 500;
    color: #78716c;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(6px);
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    border: 1px solid #e6e1d9;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  .empty-stage-prompt {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    max-width: 340px;
    padding: 1.75rem;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(10px);
    border: 1px dashed #d6d0c4;
    border-radius: 1.25rem;
    pointer-events: none;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  }

  .empty-icon {
    font-size: 2.75rem;
    margin-bottom: 0.65rem;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: #1f1d1a;
    margin-bottom: 0.4rem;
  }

  .empty-sub {
    font-size: 0.825rem;
    color: #6b7280;
    line-height: 1.5;
    margin: 0;
  }

  .dir-desktop {
    display: inline;
  }

  .dir-mobile {
    display: none;
  }

  @media (max-width: 1024px) {
    .dir-desktop {
      display: none;
    }

    .dir-mobile {
      display: inline;
    }

    .pan-hint {
      display: none;
    }

    .controls-overlay {
      bottom: calc(45svh + 1rem);
      right: 1rem;
    }
  }

  @media (max-width: 640px) {
    .cluster-label-card {
      padding: 0.25rem 0.55rem;
    }

    .label-line-1 {
      font-size: 0.725rem;
    }

    .label-line-2 {
      font-size: 0.675rem;
    }
  }
</style>
