<script lang="ts">
  import type { TourComparisonResult } from './tourData';

  interface Props {
    stepIndex: number; // 1 đến 10
    totalSteps?: number; // 10
    comparison: TourComparisonResult | null;
    onPrev: () => void;
    onNext: () => void;
    onExit: () => void;
  }

  let {
    stepIndex,
    totalSteps = 10,
    comparison,
    onPrev,
    onNext,
    onExit,
  }: Props = $props();

  const isFirst = $derived(stepIndex <= 1);
  const isLast = $derived(stepIndex >= totalSteps);

  // Xử lý vuốt ngang trên card cho mobile
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Chỉ nhận vuốt ngang nếu khoảng cách đủ lớn và góc nghiêng nhỏ hơn góc dọc
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          // Vuốt sang trái -> chuyển sang chặng tiếp
          onNext();
        } else {
          // Vuốt sang phải -> quay lại chặng trước
          if (!isFirst) onPrev();
        }
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      if (!isFirst) {
        e.preventDefault();
        onPrev();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onExit();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Card đáy cố định (TourCard) -->
<div
  class="tour-card"
  role="region"
  aria-label="Thẻ thuyết minh hành trình so sánh diện tích"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
>
  <!-- Hàng trên: Thanh tiến độ + Nút Thoát -->
  <div class="tour-top-row">
    <div class="progress-wrap">
      <div class="progress-track" aria-hidden="true">
        <div
          class="progress-fill"
          style="width: {(stepIndex / totalSteps) * 100}%;"
        ></div>
      </div>
      <span class="progress-text">{stepIndex}/{totalSteps}</span>
    </div>

    <button
      type="button"
      class="exit-btn"
      onclick={onExit}
      title="Thoát hành trình (phím Esc)"
      aria-label="Thoát hành trình"
    >
      <span>Thoát</span>
      <span class="exit-x" aria-hidden="true">×</span>
    </button>
  </div>

  <!-- Thân card: Nhịp chữ 3 tầng + Cụm nút điều hướng -->
  <div class="tour-body-row">
    <div class="tour-content">
      {#if comparison}
        <!-- Tầng 1: Số so sánh lớn -->
        <div class="tier-headline">
          {comparison.headline}
        </div>

        <!-- Tầng 2: Tên & Diện tích -->
        <div class="tier-sub">
          {comparison.sub}
        </div>

        <!-- Tầng 3: Câu twist -->
        <div class="tier-cau">
          {comparison.cau}
        </div>
      {/if}
    </div>

    <!-- Cụm nút điều hướng: Trước / Tiếp hoặc Tự so sánh -->
    <div class="tour-nav-btns">
      <button
        type="button"
        class="nav-btn prev-btn"
        disabled={isFirst}
        onclick={onPrev}
        title="Chặng trước (phím ←)"
        aria-label="Chặng trước"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>

      {#if isLast}
        <button
          type="button"
          class="nav-btn finish-btn"
          onclick={onNext}
          title="Thoát hành trình và tự so sánh tự do"
        >
          <span>Tự so sánh</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      {:else}
        <button
          type="button"
          class="nav-btn next-btn"
          onclick={onNext}
          title="Chặng tiếp theo (phím →)"
          aria-label="Chặng tiếp theo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .tour-card {
    position: relative;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: var(--radius, 1rem);
    padding: 0.65rem 1rem 0.75rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    box-sizing: border-box;
    user-select: none;
    -webkit-user-select: none;
    touch-action: pan-y;
  }

  /* 1. Hàng trên: Thanh tiến độ & Thoát */
  .tour-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .progress-track {
    flex: 1;
    height: 4px;
    background: #e5e7eb;
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: #2563eb;
    border-radius: 9999px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .progress-text {
    font-size: 0.75rem;
    font-weight: 700;
    color: #4b5563;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .exit-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    background: transparent;
    border: none;
    padding: 0.15rem 0.4rem;
    border-radius: 0.375rem;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .exit-btn:hover {
    color: #111827;
    background: #f3f4f6;
  }

  .exit-x {
    font-size: 1rem;
    line-height: 1;
  }

  /* 2. Thân card: Nội dung & Nút bấm */
  .tour-body-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .tour-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  /* Tầng 1: Headline lớn */
  .tier-headline {
    font-size: 1.25rem;
    font-weight: 800;
    line-height: 1.15;
    color: #1e3a8a;
    letter-spacing: -0.01em;
  }

  /* Tầng 2: Diện tích */
  .tier-sub {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Tầng 3: Twist */
  .tier-cau {
    font-size: 0.8125rem;
    color: #1f2937;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Cụm nút điều hướng */
  .tour-nav-btns {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    height: 2.25rem;
    min-width: 2.25rem;
    padding: 0 0.65rem;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 700;
    border-radius: 9999px;
    border: 1px solid var(--color-border, #e6e1d9);
    background: #ffffff;
    color: #1f2937;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }

  .nav-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .next-btn {
    background: #2563eb;
    border-color: #1d4ed8;
    color: #ffffff;
  }

  .next-btn:hover:not(:disabled) {
    background: #1d4ed8;
    border-color: #1e40af;
  }

  .finish-btn {
    background: #059669;
    border-color: #047857;
    color: #ffffff;
    padding-inline: 0.85rem;
  }

  .finish-btn:hover {
    background: #047857;
    border-color: #065f46;
  }

  /* Quy chuẩn mobile 375px: full-width ở đáy, cao ≤ 150px, không tràn ngang */
  @media (max-width: 640px) {
    .tour-card {
      width: 100%;
      max-width: 100%;
      border-radius: 1rem 1rem 0 0;
      padding: 0.5rem 0.75rem 0.6rem;
      overflow-x: hidden;
    }

    .tier-sub {
      white-space: normal;
    }

    .tier-headline {
      font-size: 1.125rem;
    }

    .tier-cau {
      font-size: 0.8125rem;
      -webkit-line-clamp: 3;
    }

    .nav-btn {
      height: 2rem;
      min-width: 2rem;
      padding: 0 0.5rem;
      font-size: 0.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill,
    .nav-btn {
      transition: none !important;
    }
  }
</style>
