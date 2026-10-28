<script lang="ts">
  import type { PlacedShape, EntityMeta, ShapeColor, Viewport } from './types';
  import { screenToKm, formatNumberVi } from './math';

  interface Props {
    shape: PlacedShape;
    meta?: EntityMeta;
    svgD: string;
    color: ShapeColor;
    isSelected: boolean;
    isDraggingAny: boolean;
    scale: number;
    viewport: Viewport;
    getContainerRect?: () => DOMRect | undefined;
    containerWidth: number;
    containerHeight: number;
    onSelect: () => void;
    onMove: (x: number, y: number) => void;
    onRotate: (deg: number) => void;
    onDelete: () => void;
    onCenterWithPrev: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
  }

  let {
    shape,
    meta,
    svgD,
    color,
    isSelected,
    isDraggingAny,
    scale,
    viewport,
    getContainerRect,
    containerWidth,
    containerHeight,
    onSelect,
    onMove,
    onRotate,
    onDelete,
    onCenterWithPrev,
    onDragStart,
    onDragEnd,
  }: Props = $props();

  let isDragging = $state(false);
  let isHandleRotating = $state(false);
  let isPinchRotating = $state(false);

  // Multi-touch tracking trên hình
  const activePointers = new Map<number, { clientX: number; clientY: number }>();
  let initialTouchAngle = 0;
  let initialShapeRot = 0;

  // Drag start state
  let dragStartScreen = { x: 0, y: 0 };
  let dragStartKm = { x: 0, y: 0 };

  // Bounding box cục bộ
  const bbox = $derived(shape.bbox || meta?.bbox || [-50, -50, 50, 50]);
  const minX = $derived(bbox[0]);
  const minY = $derived(bbox[1]);
  const maxX = $derived(bbox[2]);
  const maxY = $derived(bbox[3]);
  const centerX = $derived((minX + maxX) / 2);
  const centerY = $derived((minY + maxY) / 2);
  const widthKm = $derived(Math.max(maxX - minX, 1));
  const heightKm = $derived(Math.max(maxY - minY, 1));

  // Kích thước trên màn hình (px) để kiểm tra hào quang < 12px
  const dimOnScreen = $derived(Math.max(widthKm, heightKm) * scale);
  const isTiny = $derived(dimOnScreen < 12);

  // Vị trí tay nắm xoay: đặt cao hơn mép trên hình 28px trên màn hình
  const handleOffsetKm = $derived(28 / Math.max(scale, 1e-4));
  const handleStemY = $derived(minY - handleOffsetKm);
  const handleRadiusKm = $derived(6 / Math.max(scale, 1e-4));
  const handleHitRadiusKm = $derived(16 / Math.max(scale, 1e-4));

  // Bán kính hào quang khi hình quá nhỏ (< 12px trên màn hình)
  const haloRadiusKm = $derived(16 / Math.max(scale, 1e-4));
  const haloDotRadiusKm = $derived(4 / Math.max(scale, 1e-4));

  const rotation = $derived(shape.rotation ?? shape.goc ?? 0);

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    onSelect();

    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Nếu có 2 ngón cùng chạm vào hình -> chuyển sang chế độ xoay chụm 2 ngón
    if (activePointers.size === 2) {
      isDragging = false;
      isPinchRotating = true;
      const pts = Array.from(activePointers.values());
      initialTouchAngle = Math.atan2(pts[1].clientY - pts[0].clientY, pts[1].clientX - pts[0].clientX) * (180 / Math.PI);
      initialShapeRot = rotation;
      onDragStart?.();
      return;
    }

    if (activePointers.size === 1) {
      isDragging = true;
      dragStartScreen = { x: e.clientX, y: e.clientY };
      dragStartKm = { x: shape.x, y: shape.y };
      onDragStart?.();
      try {
        (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
      } catch {}
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // Xoay bằng 2 ngón
    if (isPinchRotating && activePointers.size >= 2) {
      e.stopPropagation();
      e.preventDefault();
      const pts = Array.from(activePointers.values());
      const currentAngle = Math.atan2(pts[1].clientY - pts[0].clientY, pts[1].clientX - pts[0].clientX) * (180 / Math.PI);
      const deltaAngle = currentAngle - initialTouchAngle;
      const newRot = Math.round((initialShapeRot + deltaAngle + 360) % 360);
      onRotate(newRot);
      return;
    }

    // Kéo di chuyển hình
    if (isDragging && activePointers.size === 1) {
      e.stopPropagation();
      const dxScreen = e.clientX - dragStartScreen.x;
      const dyScreen = e.clientY - dragStartScreen.y;
      const dxKm = dxScreen / scale;
      const dyKm = dyScreen / scale;
      onMove(Math.round(dragStartKm.x + dxKm), Math.round(dragStartKm.y + dyKm));
    }
  }

  function handlePointerUp(e: PointerEvent) {
    activePointers.delete(e.pointerId);

    if (activePointers.size < 2 && isPinchRotating) {
      isPinchRotating = false;
      onDragEnd?.();
    }

    if (activePointers.size === 0 && isDragging) {
      isDragging = false;
      onDragEnd?.();
      try {
        (e.currentTarget as SVGElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  // Tay nắm xoay (desktop)
  function handleRotatePointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.preventDefault();
    isHandleRotating = true;
    onDragStart?.();
    try {
      (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    } catch {}
  }

  function handleRotatePointerMove(e: PointerEvent) {
    if (!isHandleRotating) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = getContainerRect?.() || { left: 0, top: 0, width: containerWidth, height: containerHeight };
    const ptScreen = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const ptKm = screenToKm(ptScreen, viewport, containerWidth, containerHeight);

    const rad = Math.atan2(ptKm.y - shape.y, ptKm.x - shape.x);
    const deg = rad * (180 / Math.PI);
    // Tay nắm đặt ở đỉnh (-90 độ), nên cộng thêm 90 độ để có góc xoay thực tế
    const newRot = Math.round((deg + 90 + 360) % 360);
    onRotate(newRot);
  }

  function handleRotatePointerUp(e: PointerEvent) {
    if (isHandleRotating) {
      isHandleRotating = false;
      onDragEnd?.();
      try {
        (e.currentTarget as SVGElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
        onMove(shape.x - (e.shiftKey ? 50 : 10), shape.y);
        e.preventDefault();
        break;
      case 'ArrowRight':
        onMove(shape.x + (e.shiftKey ? 50 : 10), shape.y);
        e.preventDefault();
        break;
      case 'ArrowUp':
        onMove(shape.x, shape.y - (e.shiftKey ? 50 : 10));
        e.preventDefault();
        break;
      case 'ArrowDown':
        onMove(shape.x, shape.y + (e.shiftKey ? 50 : 10));
        e.preventDefault();
        break;
      case '[':
        onRotate((rotation - 15 + 360) % 360);
        e.preventDefault();
        break;
      case ']':
        onRotate((rotation + 15) % 360);
        e.preventDefault();
        break;
      case 'Delete':
      case 'Backspace':
        onDelete();
        e.preventDefault();
        break;
      case 'c':
      case 'C':
        onCenterWithPrev();
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        onSelect();
        e.preventDefault();
        break;
    }
  }
</script>

<g
  class="shape-group"
  class:selected={isSelected}
  class:dragging={isDragging || isHandleRotating}
  transform="translate({shape.x}, {shape.y}) rotate({rotation})"
  tabindex="0"
  role="button"
  aria-label="{meta?.name || shape.id}, diện tích {formatNumberVi(meta?.area || 0)} km²"
  style={isDraggingAny && !isDragging && !isHandleRotating ? 'pointer-events: none;' : ''}
  onfocus={onSelect}
  onkeydown={handleKeyDown}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  <!-- Vòng hào quang khi kích thước trên màn hình < 12px -->
  {#if isTiny}
    <g class="halo-indicator" transform="translate({centerX}, {centerY})">
      <circle
        r={haloRadiusKm}
        fill={color.fill}
        fill-opacity="0.28"
        stroke={color.stroke}
        stroke-width="2"
        stroke-dasharray="3 3"
        vector-effect="non-scaling-stroke"
      />
      <circle r={haloDotRadiusKm} fill={color.border} />
    </g>
  {/if}

  <!-- Đường bao đa giác SVG của hình (đơn vị km, fill-rule="evenodd") -->
  <path
    class="shape-path"
    d={svgD}
    fill={color.fill}
    fill-opacity="0.35"
    stroke={isSelected ? color.border : color.stroke}
    stroke-width={isSelected ? '2.5' : '1.5'}
    vector-effect="non-scaling-stroke"
    fill-rule="evenodd"
    filter={isSelected ? 'url(#active-shape-shadow)' : undefined}
  />

  <!-- Tay nắm xoay phía trên hình (hiển thị khi hình đang được chọn) -->
  {#if isSelected}
    <g class="rotate-handle-group">
      <!-- Đường nối từ mép trên hình tới tay nắm -->
      <line
        x1={centerX}
        y1={minY}
        x2={centerX}
        y2={handleStemY}
        stroke={color.border}
        stroke-width="1.5"
        stroke-dasharray="2 2"
        vector-effect="non-scaling-stroke"
      />
      <!-- Chấm tròn hiển thị tay nắm xoay -->
      <circle
        class="rotate-handle"
        cx={centerX}
        cy={handleStemY}
        r={handleRadiusKm}
        fill="#ffffff"
        stroke={color.border}
        stroke-width="2.5"
        vector-effect="non-scaling-stroke"
      />
      <!-- Vùng bấm tay nắm lớn hơn để dễ kéo trên chuột và cảm ứng -->
      <circle
        class="rotate-handle-hit"
        cx={centerX}
        cy={handleStemY}
        r={handleHitRadiusKm}
        fill="transparent"
        style="cursor: grab;"
        aria-label="Xoay hình"
        onpointerdown={handleRotatePointerDown}
        onpointermove={handleRotatePointerMove}
        onpointerup={handleRotatePointerUp}
        onpointercancel={handleRotatePointerUp}
      />
    </g>
  {/if}
</g>

<style>
  .shape-group {
    cursor: grab;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }

  .shape-group:focus-visible {
    filter: drop-shadow(0 0 6px rgba(37, 99, 235, 0.6));
  }

  .shape-group.dragging {
    cursor: grabbing;
  }

  .shape-path {
    transition: fill-opacity 0.15s ease, stroke 0.15s ease;
  }

  .shape-group:hover .shape-path {
    fill-opacity: 0.45;
  }

  .shape-group.selected .shape-path {
    fill-opacity: 0.5;
  }

  .rotate-handle-hit:hover + .rotate-handle,
  .rotate-handle:hover {
    fill: #f3f4f6;
  }

  .rotate-handle-group {
    touch-action: none;
  }
</style>
