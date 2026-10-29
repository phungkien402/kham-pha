<script lang="ts">
  import { onMount } from 'svelte';
  import type { PlacedShape, EntityMeta } from './types';
  import { SHAPE_PALETTE } from './types';
  import { PRESET_MATCHES, type PresetMatch, formatNumberVi } from './math';
  import { funFact, surprisingPairs, type SurprisingPair } from './funFacts';
  import { isReducedMotionPreferred } from './viewportAnimation';

  interface Props {
    shapes: PlacedShape[];
    metaMap: Map<string, EntityMeta>;
    allMeta?: EntityMeta[];
    selectedId: string | null;
    previousSelectedId: string | null;
    activeEntity?: EntityMeta;
    prevEntity?: EntityMeta;
    comparisonText: string;
    isExporting?: boolean;
    shareToastMessage?: string | null;
    onSelectShape: (id: string) => void;
    onDeleteShape: (id: string) => void;
    onOverlayCenters: () => void;
    onSideBySide: () => void;
    onRandomMatch: () => void;
    onSelectPreset: (preset: PresetMatch) => void;
    onShareLink: () => void;
    onExportImage: () => void;
    onStartTour?: () => void;
    onSelectSurprisingPair?: (pair: SurprisingPair) => void;
  }

  let {
    shapes,
    metaMap,
    allMeta = [],
    selectedId,
    previousSelectedId,
    activeEntity,
    prevEntity,
    comparisonText,
    isExporting = false,
    shareToastMessage = null,
    onSelectShape,
    onDeleteShape,
    onOverlayCenters,
    onSideBySide,
    onRandomMatch,
    onSelectPreset,
    onShareLink,
    onExportImage,
    onStartTour,
    onSelectSurprisingPair,
  }: Props = $props();

  // Kiểm tra xem bàn hiện tại có trùng với một kèo kinh điển không
  function isPresetActive(preset: PresetMatch): boolean {
    if (shapes.length !== 2) return false;
    const ids = shapes.map((s) => s.id);
    return preset.shapes.every((id) => ids.includes(id));
  }

  // --- D4: Dải "Bạn có biết?" đổi cặp mỗi 6s ---
  const surpriseList = $derived(allMeta.length > 0 ? surprisingPairs(allMeta) : []);
  let tickerIndex = $state(0);
  let isTickerPaused = $state(false);

  const currentPair = $derived(
    surpriseList.length > 0 ? surpriseList[tickerIndex % surpriseList.length] : null
  );

  const currentPairMetaA = $derived(currentPair ? metaMap.get(currentPair.a) : undefined);
  const currentPairMetaB = $derived(currentPair ? metaMap.get(currentPair.b) : undefined);

  onMount(() => {
    const interval = setInterval(() => {
      if (!isTickerPaused && !isReducedMotionPreferred() && surpriseList.length > 0) {
        tickerIndex = (tickerIndex + 1) % surpriseList.length;
      }
    }, 6000);

    return () => clearInterval(interval);
  });

  function handlePairClick() {
    if (currentPair && onSelectSurprisingPair) {
      onSelectSurprisingPair(currentPair);
    }
  }

  // --- D3: Popover Fun Fact cho từng chip hình ---
  let activePopoverId = $state<string | null>(null);

  function togglePopover(id: string) {
    activePopoverId = activePopoverId === id ? null : id;
  }

  function handleWindowClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.shape-chip')) {
      activePopoverId = null;
    }
  }

  function handleWindowKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && activePopoverId) {
      activePopoverId = null;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeyDown} />

<footer class="to-co-nao-footer">
  <!-- D4: Dải "Bạn có biết?" đổi cặp mỗi 6s -->
  {#if currentPair && currentPairMetaA && currentPairMetaB}
    <div
      class="did-you-know-bar"
      role="region"
      aria-label="So sánh bất ngờ"
      onmouseenter={() => (isTickerPaused = true)}
      onmouseleave={() => (isTickerPaused = false)}
      onfocusin={() => (isTickerPaused = true)}
      onfocusout={() => (isTickerPaused = false)}
    >
      <span class="did-you-know-tag">Bạn có biết?</span>
      <button
        type="button"
        class="did-you-know-btn"
        onclick={handlePairClick}
        title="Đặt cặp {currentPairMetaA.name} và {currentPairMetaB.name} chồng tâm lên bàn"
      >
        <span>{currentPairMetaA.name} ≈ {currentPairMetaB.name} →</span>
      </button>
    </div>
  {/if}

  <!-- 1. Banner câu so sánh diện tích lớn -->
  {#if comparisonText}
    <div class="comparison-banner">
      <h2 class="comparison-title">{comparisonText}</h2>
      {#if activeEntity && prevEntity}
        <p class="comparison-sub">
          <strong>{activeEntity.name}</strong> ({formatNumberVi(activeEntity.area)} km²)
          so với
          <strong>{prevEntity.name}</strong> ({formatNumberVi(prevEntity.area)} km²)
        </p>
      {/if}
    </div>
  {/if}

  <!-- 2. Hàng chip "Kèo kinh điển" và nút Ngẫu nhiên + Hành trình -->
  <section class="presets-section" aria-label="Kèo so sánh kinh điển">
    <div class="presets-header">
      <span class="presets-label">Kèo kinh điển:</span>
    </div>
    <div class="presets-list">
      {#each PRESET_MATCHES as preset (preset.title)}
        {@const active = isPresetActive(preset)}
        <button
          type="button"
          class="preset-chip"
          class:active={active}
          onclick={() => onSelectPreset(preset)}
          title="So sánh {preset.title}"
        >
          {preset.title}
        </button>
      {/each}

      <button
        type="button"
        class="preset-chip random-btn"
        onclick={onRandomMatch}
        title="Chọn ngẫu nhiên 1 tỉnh và 1 nước có diện tích gần bằng nhau"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 8h.01"></path>
          <path d="M8 8h.01"></path>
          <path d="M8 16h.01"></path>
          <path d="M16 16h.01"></path>
          <path d="M12 12h.01"></path>
        </svg>
        <span>Ngẫu nhiên</span>
      </button>

      {#if onStartTour}
        <button
          type="button"
          class="preset-chip tour-btn"
          onclick={onStartTour}
          title="Bắt đầu hành trình khám phá 10 chặng thú vị"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <span>Hành trình</span>
        </button>
      {/if}
    </div>
  </section>

  <!-- 3. Thanh tác vụ chính: Chồng tâm, Đặt cạnh, Chia sẻ, Tải ảnh -->
  <div class="actions-bar">
    <div class="align-buttons">
      <button
        type="button"
        class="action-btn"
        disabled={shapes.length < 2}
        onclick={onOverlayCenters}
        title="Chồng tâm 2 hình đang chọn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>Chồng tâm</span>
      </button>

      <button
        type="button"
        class="action-btn"
        disabled={shapes.length < 2}
        onclick={onSideBySide}
        title="Đặt 2 hình cạnh nhau"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="8" height="14" rx="2"></rect>
          <rect x="14" y="5" width="8" height="14" rx="2"></rect>
        </svg>
        <span>Đặt cạnh nhau</span>
      </button>
    </div>

    <div class="share-buttons">
      <button
        type="button"
        class="action-btn share-btn"
        onclick={onShareLink}
        title="Sao chép liên kết bàn so sánh hiện tại"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span>Chia sẻ link</span>
      </button>

      <button
        type="button"
        class="action-btn export-btn"
        disabled={isExporting}
        onclick={onExportImage}
        title="Xuất ảnh so sánh 1200×630 dạng PNG"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <span>{isExporting ? 'Đang tạo...' : 'Tải ảnh'}</span>
      </button>
    </div>
  </div>

  <!-- Thông báo sao chép (Toast) -->
  {#if shareToastMessage}
    <div class="toast-alert" role="status" aria-live="polite">
      {shareToastMessage}
    </div>
  {/if}

  <!-- 4. Danh sách các hình trên bàn: Chấm màu, tên, diện tích, dài × rộng, nút xoá -->
  <section class="shapes-list-section" aria-label="Danh sách các hình đang có trên bàn">
    <div class="shapes-list-header">
      <span class="shapes-count-label">Các hình trên bàn ({shapes.length}/6):</span>
    </div>

    <div class="chips-list">
      {#each shapes as s, index (s.id)}
        {@const m = metaMap.get(s.id)}
        {@const color = SHAPE_PALETTE[index % SHAPE_PALETTE.length]}
        {@const isSelected = selectedId === s.id}

        <div
          class="shape-chip"
          class:selected={isSelected}
          style="--chip-border: {color.border};"
        >
          <button
            type="button"
            class="chip-select-btn"
            onclick={() => onSelectShape(s.id)}
            title="Chọn {m?.name || s.id}"
            aria-pressed={isSelected}
          >
            <span class="chip-dot" style="background: {color.stroke};"></span>
            <span class="chip-name">{m?.name || s.id}</span>
            <span class="chip-area">{formatNumberVi(m?.area || 0)} km²</span>
            {#if m?.len && m?.wid}
              <span class="chip-dim" title="Kích thước bao theo trục chính: dài × rộng">
                ({formatNumberVi(m.len)} × {formatNumberVi(m.wid)} km)
              </span>
            {/if}
          </button>

          <!-- Nút ⓘ mở Fun fact popover -->
          {#if m}
            <button
              type="button"
              class="chip-info-btn"
              class:active={activePopoverId === s.id}
              title="Thông tin thú vị về {m.name}"
              aria-label="Thông tin thú vị về {m.name}"
              aria-expanded={activePopoverId === s.id}
              onclick={(e) => {
                e.stopPropagation();
                togglePopover(s.id);
              }}
            >
              ⓘ
            </button>

            {#if activePopoverId === s.id}
              <div class="chip-popover" role="tooltip">
                <span class="popover-badge">Bạn có biết?</span>
                <p class="popover-text">{funFact(m, allMeta)}</p>
              </div>
            {/if}
          {/if}

          {#if shapes.length > 1}
            <button
              type="button"
              class="chip-remove-btn"
              title="Xoá {m?.name || s.id} khỏi bàn"
              aria-label="Xoá {m?.name || s.id} khỏi bàn"
              onclick={() => onDeleteShape(s.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</footer>

<style>
  .to-co-nao-footer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  /* 1. Banner so sánh diện tích */
  .comparison-banner {
    text-align: center;
    padding: 0.75rem 1rem;
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
    line-height: 1.3;
  }

  .comparison-sub {
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b665f);
    margin-top: 0.35rem;
    margin-bottom: 0;
  }

  /* 2. Kèo kinh điển */
  .presets-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .presets-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
  }

  .presets-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }

  .preset-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, #1f1d1a);
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 9999px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }

  .preset-chip:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  .preset-chip.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
    font-weight: 600;
  }

  .random-btn {
    color: #4338ca;
    background: #f5f3ff;
    border-color: #ddd6fe;
    font-weight: 600;
  }

  .random-btn:hover {
    background: #ede9fe;
    border-color: #c4b5fd;
  }

  .tour-btn {
    color: #1e40af;
    background: #eff6ff;
    border-color: #bfdbfe;
    font-weight: 700;
  }

  .tour-btn:hover {
    background: #dbeafe;
    border-color: #93c5fd;
  }

  /* D4: Dải "Bạn có biết?" */
  .did-you-know-bar {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    align-self: center;
    padding: 0.35rem 0.75rem;
    background: #fefce8;
    border: 1px solid #fef08a;
    border-radius: 9999px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    font-size: 0.8125rem;
    max-width: 100%;
    overflow: hidden;
  }

  .did-you-know-tag {
    font-weight: 700;
    color: #854d0e;
    background: #fef08a;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .did-you-know-btn {
    background: transparent;
    border: none;
    padding: 0;
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    color: #713f12;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.15s ease;
  }

  .did-you-know-btn:hover {
    color: #1d4ed8;
    text-decoration: underline;
  }

  /* 3. Thanh tác vụ */
  .actions-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .align-buttons,
  .share-buttons {
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

  .share-btn:hover:not(:disabled) {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
  }

  .export-btn {
    background: #f8fafc;
    color: #0f172a;
  }

  .export-btn:hover:not(:disabled) {
    background: #e2e8f0;
    border-color: #94a3b8;
  }

  /* Thông báo Toast */
  .toast-alert {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #065f46;
    background: #d1fae5;
    border: 1px solid #a7f3d0;
    border-radius: 0.5rem;
    text-align: center;
    animation: fadeIn 0.2s ease;
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

  /* 4. Danh sách các hình */
  .shapes-list-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .shapes-count-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
  }

  .chips-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .shape-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    background: #ffffff;
    border: 1.5px solid var(--color-border, #e6e1d9);
    border-radius: 9999px;
    padding: 0.25rem 0.5rem 0.25rem 0.75rem;
    font-size: 0.8125rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .shape-chip.selected {
    border-color: var(--chip-border, #2563eb);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
  }

  .chip-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    margin-left: 0.35rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #f1f5f9;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .chip-info-btn:hover,
  .chip-info-btn.active {
    background: #2563eb;
    color: #ffffff;
  }

  /* Popover fun fact nổi lên từ chip */
  .chip-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 280px;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.75rem;
    padding: 0.6rem 0.85rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
    z-index: 60;
    animation: fadeIn 0.15s ease;
    pointer-events: auto;
  }

  .chip-popover::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: #ffffff transparent transparent transparent;
  }

  .popover-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #1e40af;
    background: #eff6ff;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
    margin-bottom: 0.3rem;
  }

  .popover-text {
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--color-text, #1f1d1a);
    margin: 0;
  }

  .chip-select-btn {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .chip-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chip-name {
    font-weight: 600;
    color: var(--color-text, #1f1d1a);
  }

  .chip-area {
    color: var(--color-text-muted, #6b665f);
  }

  .chip-dim {
    font-size: 0.75rem;
    color: #8c827a;
  }

  .chip-remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    margin-left: 0.4rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .chip-remove-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }
</style>
