<!-- src/explore/tieu-tien/Stage3D.svelte -->
<!-- Sân khấu 3D phong cách isometric hiển thị cụm các vật phẩm đã mua -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { VatPham, GioHang } from './types';
  import {
    getDisplayCount,
    calculateGridLayout,
    calculateClusterPositions,
    calculateCameraFit,
    formatClusterLabel,
    isWebGLAvailable,
    type ClusterLayoutItem,
    type ClusterBounds,
  } from './stage3d';
  import {
    ITEM_3D_CONFIG,
    createProceduralMesh,
    createMetroTrainGroup,
    createBulletTrainGroup,
  } from './models3d';
  import { formatVietnameseCurrency } from './logic';

  interface Props {
    cart: GioHang;
    items: VatPham[];
    onSelectCard?: (itemId: string) => void;
  }

  let { cart, items, onSelectCard }: Props = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);

  // Trạng thái nhãn 2D overlay chiếu từ 3D
  interface ScreenLabel {
    id: string;
    text: string;
    badge: string;
    x: number;
    y: number;
    visible: boolean;
  }
  let screenLabels = $state<ScreenLabel[]>([]);

  // Biến Three.js
  let THREE: typeof import('three') | null = null;
  let GLTFLoaderClass: any = null;
  let renderer: import('three').WebGLRenderer | null = null;
  let scene: import('three').Scene | null = null;
  let camera: import('three').OrthographicCamera | null = null;

  // Cache tải mô hình GLB (raw GLTF scene)
  const glbCache = new Map<string, import('three').Group>();

  // Nhóm gốc chứa tất cả các cụm 3D
  let stageGroup: import('three').Group | null = null;

  // Quản lý Animation & Tween
  let animationFrameId: number | null = null;
  let isAnimating = false;
  let currentBounds: ClusterBounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };

  // Mục tiêu camera điều khiển bằng tween
  let currentTarget = { x: 0, y: 0, z: 0 };
  let desiredTarget = { x: 0, y: 0, z: 0 };
  let currentFrustumSize = 25;
  let desiredFrustumSize = 25;
  let currentZoom = 1.0;
  let desiredZoom = 1.0;

  // Lịch sử thời điểm mua của từng instance để tạo hiệu ứng rơi (drop tween)
  const dropStartTime = new Map<string, number>();

  // Trạng thái kéo chuột / cảm ứng
  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };

  // Báo cáo WebGL có khả dụng không
  let webGlSupported = $state(true);

  // Ánh xạ id vật phẩm sang đối tượng VatPham
  const itemMap = $derived(new Map(items.map((it) => [it.id, it])));

  // Danh sách các vật phẩm đang có trong giỏ (count > 0)
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

  onMount(async () => {
    webGlSupported = isWebGLAvailable();
    if (!webGlSupported) return;

    try {
      THREE = await import('three');
      const gltfMod = await import('three/examples/jsm/loaders/GLTFLoader.js');
      GLTFLoaderClass = gltfMod.GLTFLoader;
      initThreeScene();
    } catch (err) {
      console.error('Không thể khởi tạo Three.js:', err);
      webGlSupported = false;
    }
  });

  onDestroy(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    if (scene) {
      scene.clear();
      scene = null;
    }
  });

  function initThreeScene() {
    if (!THREE || !canvasEl || !containerEl) return;

    const width = containerEl.clientWidth || 800;
    const height = containerEl.clientHeight || 500;
    const aspect = width / height;

    // 1. Tạo Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfaf8f5);

    // 2. Camera Orthographic góc nhìn Isometric
    const halfH = currentFrustumSize / 2;
    const halfW = halfH * aspect;
    camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -500, 500);
    updateCameraPosition();

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // 4. Ánh sáng mềm ấm
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdcd8cf, 0.95);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbf0, 1.25);
    dirLight.position.set(40, 80, 40);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.35);
    fillLight.position.set(-40, 30, -40);
    scene.add(fillLight);

    // 5. Nhóm sân khấu chính
    stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // 6. Theo dõi resize container
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerEl);

    // 7. Theo dõi ẩn/hiện tab để tạm dừng render tiết kiệm pin
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Xây dựng lại sân khấu theo giỏ hàng hiện tại
    rebuildStage();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else {
      triggerRender();
    }
  }

  function handleResize() {
    if (!renderer || !camera || !containerEl) return;
    const width = containerEl.clientWidth || 800;
    const height = containerEl.clientHeight || 500;
    const aspect = width / height;

    const halfH = currentFrustumSize / 2;
    const halfW = halfH * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    updateLabels();
    triggerRender();
  }

  function updateCameraPosition() {
    if (!camera) return;
    // Hướng nhìn Isometric chuẩn: góc phương vị 45 độ, nâng 35.26 độ
    const dist = 60;
    camera.position.set(
      currentTarget.x + dist,
      currentTarget.y + dist * 1.2,
      currentTarget.z + dist
    );
    camera.lookAt(currentTarget.x, currentTarget.y, currentTarget.z);
    camera.zoom = currentZoom;
    camera.updateProjectionMatrix();
  }

  /**
   * Kích hoạt vòng lặp render on-demand
   */
  function triggerRender() {
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }
  }

  function renderLoop(time: number) {
    animationFrameId = null;
    if (!renderer || !scene || !camera) return;

    let needsNextFrame = false;

    // 1. Tween camera target & zoom
    const damping = 0.15;
    const diffX = desiredTarget.x - currentTarget.x;
    const diffY = desiredTarget.y - currentTarget.y;
    const diffZ = desiredTarget.z - currentTarget.z;
    const diffF = desiredFrustumSize - currentFrustumSize;
    const diffZom = desiredZoom - currentZoom;

    if (
      Math.abs(diffX) > 0.01 ||
      Math.abs(diffY) > 0.01 ||
      Math.abs(diffZ) > 0.01 ||
      Math.abs(diffF) > 0.05 ||
      Math.abs(diffZom) > 0.005
    ) {
      currentTarget.x += diffX * damping;
      currentTarget.y += diffY * damping;
      currentTarget.z += diffZ * damping;
      currentFrustumSize += diffF * damping;
      currentZoom += diffZom * damping;

      if (containerEl) {
        const aspect = (containerEl.clientWidth || 800) / (containerEl.clientHeight || 500);
        const halfH = currentFrustumSize / 2;
        const halfW = halfH * aspect;
        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
      }
      updateCameraPosition();
      needsNextFrame = true;
    }

    // 2. Tween rơi vào vị trí cho các bản thể mới mua
    if (stageGroup) {
      const now = performance.now();
      const dropDuration = 380; // ms

      stageGroup.traverse((child) => {
        if (child.userData && child.userData.isDropping) {
          const startTime = child.userData.dropStart || now;
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / dropDuration);

          // Ease out bounce
          const bounce = 1 - Math.pow(1 - t, 3);
          const dropHeight = child.userData.dropHeight || 4.5;
          const currentY = dropHeight * (1 - bounce);

          child.position.y = child.userData.baseY + currentY;
          child.scale.setScalar(Math.min(1, 0.4 + 0.6 * bounce));

          if (t < 1) {
            needsNextFrame = true;
          } else {
            child.userData.isDropping = false;
            child.position.y = child.userData.baseY;
            child.scale.setScalar(1);
          }
        }
      });
    }

    // 3. Render khung hình
    renderer.render(scene, camera);
    updateLabels();

    if (needsNextFrame) {
      animationFrameId = requestAnimationFrame(renderLoop);
    }
  }

  /**
   * Cập nhật vị trí các nhãn HTML 2D chiếu từ toạ độ 3D
   */
  function updateLabels() {
    if (!camera || !containerEl) return;
    const w = containerEl.clientWidth || 800;
    const h = containerEl.clientHeight || 500;

    const newLabels: ScreenLabel[] = [];

    for (const cluster of currentClusters) {
      const item = itemMap.get(cluster.id);
      if (!item) continue;
      const count = cart[cluster.id] || 0;
      if (count <= 0) continue;

      const disp = getDisplayCount(count, 400);

      // Điểm mép chân phía trước của cụm chiếu lên màn hình:
      // cluster.screenBottom đã được calculateClusterPositions tính chính xác (u, vBase - labelGap)
      const bottomPos = cluster.screenBottom || cluster.center;

      if (!THREE) continue;
      const p3d = new THREE.Vector3(bottomPos.x, 0, bottomPos.z);
      p3d.project(camera);

      // Điểm nằm trước màn hình (trong frustum)
      const visible = p3d.z >= -1 && p3d.z <= 1;
      const screenX = ((p3d.x + 1) / 2) * w;
      const screenY = ((-p3d.y + 1) / 2) * h;

      newLabels.push({
        id: cluster.id,
        text: formatClusterLabel(count, item),
        badge: disp.label,
        x: screenX,
        y: screenY,
        visible,
      });
    }

    screenLabels = newLabels;
  }

  // Danh sách các cụm hiện tại đã bố trí
  let currentClusters: ClusterLayoutItem[] = [];

  /**
   * Tải model GLB từ file hoặc lấy từ cache
   */
  async function loadGlbModel(url: string): Promise<import('three').Group | null> {
    if (glbCache.has(url)) {
      return glbCache.get(url)!.clone(true);
    }
    if (!GLTFLoaderClass) return null;

    return new Promise((resolve) => {
      const loader = new GLTFLoaderClass();
      loader.load(
        url,
        (gltf: any) => {
          const model = gltf.scene as import('three').Group;
          // Tối ưu vật liệu & đổ bóng phẳng
          model.traverse((child: any) => {
            if (child.isMesh && child.material) {
              child.material.roughness = Math.max(child.material.roughness ?? 0.4, 0.35);
            }
          });
          glbCache.set(url, model);
          resolve(model.clone(true));
        },
        undefined,
        (err: any) => {
          console.warn('Lỗi khi tải GLB:', url, err);
          resolve(null);
        }
      );
    });
  }

  /**
   * Dựng lại toàn bộ sân khấu khi giỏ hàng thay đổi
   */
  async function rebuildStage() {
    if (!THREE || !stageGroup || !scene) return;

    // Xoá sân khấu cũ
    while (stageGroup.children.length > 0) {
      const obj = stageGroup.children[0];
      stageGroup.remove(obj);
    }

    if (activeCartItems.length === 0) {
      // Giỏ rỗng
      currentClusters = [];
      screenLabels = [];
      currentBounds = { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };
      desiredTarget = { x: 0, y: 0, z: 0 };
      desiredFrustumSize = 14;
      desiredZoom = 1.0;
      triggerRender();
      return;
    }

    // 1. Tính toán kích thước từng cụm
    const clusterSizes = activeCartItems.map(({ id, count }) => {
      const cfg = ITEM_3D_CONFIG[id] || { spacing: 2.0, scale: 1.0 };
      if (cfg.isLargeInfrastructure) {
        // Công trình lớn theo quy mô chuẩn
        return { id, width: cfg.spacing, depth: cfg.spacing * 0.75 };
      }
      const disp = getDisplayCount(count, 400);
      const grid = calculateGridLayout(disp.displayCount, cfg.spacing);
      return { id, width: grid.width, depth: grid.depth };
    });

    // 2. Tính toán vị trí không chồng lấn cho các cụm (xếp ngang hàng, wrap phía sau)
    // Hàng rộng theo tỉ lệ khung: tổng bề ngang các cụm chia số hàng sao cho khối tổng gần tỉ lệ khung
    const spans = clusterSizes.map((c) => (c.width + c.depth) / Math.SQRT2);
    const totalSpan = spans.reduce((a, b) => a + b, 0) + 6 * Math.max(0, spans.length - 1);
    const maxSpan = Math.max(0, ...spans);
    const aspect = containerEl ? Math.max(0.5, containerEl.clientWidth / Math.max(1, containerEl.clientHeight)) : 1.4;
    const rows = Math.max(1, Math.round(Math.sqrt(totalSpan / (aspect * Math.max(1, maxSpan * 0.6)))));
    const placement = calculateClusterPositions(clusterSizes, {
      baseGap: 4.0,
      rowGap: 6.0,
      maxRowWidth: Math.max(maxSpan + 1, totalSpan / rows + 1),
      maxClustersPerRow: 8,
      minLabelDist: 9.0,
    });
    currentClusters = placement.clusters;
    currentBounds = placement.totalBounds;

    // 3. Tạo mô hình cho từng cụm
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (const cluster of placement.clusters) {
      const count = cart[cluster.id] || 0;
      if (count <= 0) continue;

      const cfg = ITEM_3D_CONFIG[cluster.id] || { spacing: 2.0, scale: 1.0 };
      const clusterGroup = new THREE.Group();
      clusterGroup.position.set(cluster.center.x, 0, cluster.center.z);

      // Mặt nền mờ bóng nhẹ cho từng cụm
      const shadowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(cluster.width + 1.2, cluster.depth + 1.2),
        new THREE.MeshBasicMaterial({ color: 0xe6e1d9, transparent: true, opacity: 0.6 })
      );
      shadowPlane.rotateX(-Math.PI / 2);
      shadowPlane.position.y = 0.01;
      clusterGroup.add(shadowPlane);

      // Công trình lớn chỉ dựng 1 mô hình tâm cụm
      if (cfg.isLargeInfrastructure) {
        let model: import('three').Object3D | null = null;
        if (cfg.modelUrl) {
          const baseGlb = await loadGlbModel(cfg.modelUrl);
          if (baseGlb) {
            if (cluster.id === 'metro-1') {
              model = createMetroTrainGroup(baseGlb, THREE);
            } else if (cluster.id === 'dstdc') {
              model = createBulletTrainGroup(baseGlb, THREE);
            } else {
              model = baseGlb;
            }
          }
        }
        if (!model) {
          model = createProceduralMesh(cluster.id, THREE);
        }
        if (model) {
          model.scale.setScalar(cfg.scale);
          model.position.set(0, 0, 0);

          if (!prefersReducedMotion) {
            model.userData = {
              isDropping: true,
              dropStart: performance.now(),
              dropHeight: 4.0,
              baseY: 0,
            };
          }
          clusterGroup.add(model);
        }
      } else {
        // Vật phẩm số lượng nhiều: dựng các bản thể xếp lưới
        const disp = getDisplayCount(count, 400);
        const grid = calculateGridLayout(disp.displayCount, cfg.spacing);

        let baseModel: import('three').Object3D | null = null;
        if (cfg.modelUrl) {
          baseModel = await loadGlbModel(cfg.modelUrl);
        }
        if (!baseModel) {
          baseModel = createProceduralMesh(cluster.id, THREE);
        }

        if (baseModel) {
          // Tạo các clone bản thể
          for (let i = 0; i < grid.positions.length; i++) {
            const pos = grid.positions[i];
            const instance = baseModel.clone(true);
            instance.scale.setScalar(cfg.scale);
            instance.position.set(pos.x, 0, pos.z);

            // Hiệu ứng rơi cho các bản thể mới mua
            if (!prefersReducedMotion && i >= grid.positions.length - 10) {
              instance.userData = {
                isDropping: true,
                dropStart: performance.now() + (i % 8) * 20,
                dropHeight: 3.5,
                baseY: 0,
              };
            }

            clusterGroup.add(instance);
          }
        }
      }

      stageGroup.add(clusterGroup);
    }

    // 4. Fit camera tự động bao quát các cụm
    if (containerEl) {
      const fit = calculateCameraFit(
        currentBounds,
        containerEl.clientWidth || 800,
        containerEl.clientHeight || 500,
        1.2,
        activeCartItems.length
      );
      desiredTarget = fit.target;
      desiredFrustumSize = fit.frustumSize;
      desiredZoom = fit.zoom;
    }

    triggerRender();
  }

  // Khi cart thay đổi từ component cha
  $effect(() => {
    // Kích hoạt khi activeCartItems thay đổi
    const _ = activeCartItems;
    if (THREE && stageGroup) {
      rebuildStage();
    }
  });

  // Nút "Căn giữa" (Fit All)
  export function recenter() {
    if (!containerEl) return;
    const fit = calculateCameraFit(
      currentBounds,
      containerEl.clientWidth || 800,
      containerEl.clientHeight || 500,
      1.2,
      activeCartItems.length
    );
    desiredTarget = fit.target;
    desiredFrustumSize = fit.frustumSize;
    desiredZoom = fit.zoom;
    triggerRender();
  }

  // Nút Zoom +
  export function zoomIn() {
    desiredZoom = Math.min(desiredZoom * 1.25, 3.0);
    triggerRender();
  }

  // Nút Zoom -
  export function zoomOut() {
    desiredZoom = Math.max(desiredZoom / 1.25, 0.4);
    triggerRender();
  }

  // Xử lý kéo thả chuột / cảm ứng để pan camera
  function handlePointerDown(e: PointerEvent) {
    isDragging = true;
    lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging || !containerEl) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };

    // Hệ số tỷ lệ theo kích thước frustum
    const factor = (currentFrustumSize / (containerEl.clientHeight || 500)) * (1 / currentZoom);

    // Kéo ngang dx: di chuyển theo trục u
    // Kéo dọc dy: di chuyển theo trục v
    const du = -dx * factor;
    const dv = (dy * factor) / 0.647;

    const panX = (du - dv) / Math.SQRT2;
    const panZ = (-du - dv) / Math.SQRT2;

    desiredTarget.x += panX;
    desiredTarget.z += panZ;
    currentTarget.x += panX;
    currentTarget.z += panZ;

    updateCameraPosition();
    updateLabels();
    triggerRender();
  }

  function handlePointerUp(e: PointerEvent) {
    isDragging = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) {
      desiredZoom = Math.min(desiredZoom * 1.1, 3.0);
    } else {
      desiredZoom = Math.max(desiredZoom / 1.1, 0.4);
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
  aria-label="Sân khấu 3D isometric mô phỏng các vật phẩm đã chi tiêu"
>
  {#if !webGlSupported}
    <!-- Thông báo nếu trình duyệt không có WebGL -->
    <div class="no-webgl-notice">
      <p>💡 Thiết bị hoặc trình duyệt không bật WebGL. Sân khấu tự động hiển thị giao diện 2D trực quan.</p>
    </div>
  {:else}
    <canvas bind:this={canvasEl} class="stage-canvas"></canvas>

    <!-- Các nhãn 2D ghim chân mỗi cụm 3D -->
    <div class="labels-layer" aria-hidden="true">
      {#each screenLabels as label (label.id)}
        {#if label.visible}
          <div
            class="cluster-label"
            style="transform: translate(-50%, 6px) translate({label.x}px, {label.y}px);"
            onclick={() => onSelectCard?.(label.id)}
          >
            <span class="label-name">{label.text}</span>
            {#if label.badge}
              <span class="label-badge">{label.badge}</span>
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    <!-- Hướng dẫn điều khiển mờ góc dưới (chỉ hiện khi có vật phẩm) -->
    {#if activeCartItems.length > 0}
      <div class="controls-overlay">
        <div class="zoom-controls">
          <button
            type="button"
            class="overlay-btn"
            onclick={zoomIn}
            title="Phóng to sân khấu (+)"
            aria-label="Phóng to sân khấu"
          >
            +
          </button>
          <button
            type="button"
            class="overlay-btn"
            onclick={zoomOut}
            title="Thu nhỏ sân khấu (−)"
            aria-label="Thu nhỏ sân khấu"
          >
            −
          </button>
        </div>

        <div class="pan-hint">
          <span>🖱️ Kéo để xoay / dịch nhẹ · Cuộn để phóng to</span>
        </div>
      </div>
    {/if}

    {#if activeCartItems.length === 0}
      <div class="empty-stage-prompt">
        <div class="empty-icon">🏗️</div>
        <div class="empty-title">Sân khấu 3D đang chờ kiến thiết</div>
        <p class="empty-sub">
          Chọn vật phẩm ở thanh Mua sắm <span class="dir-desktop">bên phải</span><span class="dir-mobile">bên dưới</span> để xem các mô hình 3D xuất hiện trực tiếp tại đây!
        </p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .stage-container {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 480px;
    background: #faf8f5;
    border-radius: var(--radius, 1rem);
    border: 1px solid var(--color-border, #e6e1d9);
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

  .cluster-label {
    position: absolute;
    top: 0;
    left: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(8px);
    border: 1px solid #e2ded4;
    border-radius: 999px;
    padding: 0.3rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #1f1d1a;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    pointer-events: auto;
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.05s ease, background 0.15s ease;
  }

  .cluster-label:hover {
    background: #ffffff;
    border-color: #059669;
    color: #059669;
  }

  .label-name {
    line-height: 1.2;
  }

  .label-badge {
    background: #059669;
    color: #ffffff;
    border-radius: 999px;
    padding: 0.05rem 0.35rem;
    font-size: 0.675rem;
    font-weight: 800;
  }

  .controls-overlay {
    position: absolute;
    bottom: 0.85rem;
    left: 0.85rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
    pointer-events: none;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    pointer-events: auto;
  }

  .overlay-btn {
    height: 34px;
    min-width: 34px;
    padding: 0 0.6rem;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(6px);
    border: 1px solid #e2ded4;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    color: #1f1d1a;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    transition: all 0.15s ease;
  }

  .overlay-btn:hover {
    background: #ffffff;
    border-color: #059669;
    color: #059669;
  }

  .recenter-btn {
    font-size: 0.775rem;
    font-weight: 600;
  }

  .pan-hint {
    font-size: 0.725rem;
    font-weight: 500;
    color: #78716c;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(4px);
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    border: 1px solid #f0ebe4;
  }

  .empty-stage-prompt {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    max-width: 320px;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(8px);
    border: 1px dashed #d6d0c4;
    border-radius: 1rem;
    pointer-events: none;
  }

  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .empty-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1f1d1a;
    margin-bottom: 0.35rem;
  }

  .empty-sub {
    font-size: 0.8rem;
    color: #78716c;
    line-height: 1.4;
    margin: 0;
  }

  .no-webgl-notice {
    padding: 2rem;
    text-align: center;
    color: #78716c;
    font-size: 0.875rem;
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
  }

  @media (max-width: 768px) {
    .stage-container {
      min-height: 48svh;
      border-radius: 0.75rem;
    }

    .pan-hint {
      display: none;
    }

    .cluster-label {
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
    }
  }
</style>
