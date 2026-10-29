<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onStartTour: () => void;
    onExplore: () => void;
  }

  let { onStartTour, onExplore }: Props = $props();

  let primaryBtnEl: HTMLButtonElement | undefined = $state();

  function markIntroSeen() {
    try {
      localStorage.setItem('tcn-intro-seen', '1');
    } catch {
      // Bọc try/catch an toàn nếu storage bị chặn
    }
  }

  function handleStart() {
    markIntroSeen();
    onStartTour();
  }

  function handleExplore() {
    markIntroSeen();
    onExplore();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleExplore();
    }
  }

  onMount(() => {
    primaryBtnEl?.focus();
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Lớp phủ mờ nhẹ và màn mở đầu (không che kín) -->
<div class="intro-backdrop" onclick={(e) => { if (e.target === e.currentTarget) handleExplore(); }}>
  <div
    class="intro-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="intro-modal-title"
  >
    <div class="intro-icon" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="12 8 8 12 12 16 12 8"></polygon>
        <line x1="12" y1="8" x2="16" y2="12"></line>
        <line x1="16" y1="12" x2="12" y2="16"></line>
      </svg>
    </div>

    <h2 id="intro-modal-title" class="intro-title">
      Việt Nam thật ra to cỡ nào?
    </h2>

    <p class="intro-subtitle">
      Ví dụ: TP.HCM rộng gấp 9 lần Singapore. Còn nhiều điều bất ngờ hơn thế.
    </p>

    <div class="intro-actions">
      <button
        bind:this={primaryBtnEl}
        type="button"
        class="intro-primary-btn"
        onclick={handleStart}
      >
        <span class="btn-main-text">Bắt đầu hành trình →</span>
        <span class="btn-sub-text">10 chặng · ~2 phút</span>
      </button>

      <button
        type="button"
        class="intro-secondary-btn"
        onclick={handleExplore}
      >
        Tự khám phá
      </button>
    </div>
  </div>
</div>

<style>
  .intro-backdrop {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    background: rgba(250, 248, 245, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 50;
    animation: fadeIn 0.25s ease-out;
  }

  .intro-card {
    position: relative;
    width: 100%;
    max-width: 440px;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 1.25rem;
    padding: 1.75rem 1.5rem 1.5rem;
    text-align: center;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    box-sizing: border-box;
  }

  .intro-icon {
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    background: #eff6ff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
  }

  .intro-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text, #1f1d1a);
    margin: 0;
    line-height: 1.25;
  }

  .intro-subtitle {
    font-size: 0.9375rem;
    color: var(--color-text-muted, #6b665f);
    margin: 0;
    line-height: 1.45;
  }

  .intro-actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .intro-primary-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.25rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 0.75rem;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
    transition: background 0.15s ease, transform 0.1s ease;
  }

  .intro-primary-btn:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
  }

  .intro-primary-btn:active {
    transform: translateY(0);
  }

  .btn-main-text {
    font-size: 1rem;
    font-weight: 700;
  }

  .btn-sub-text {
    font-size: 0.75rem;
    opacity: 0.85;
    margin-top: 0.15rem;
  }

  .intro-secondary-btn {
    padding: 0.55rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.75rem;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .intro-secondary-btn:hover {
    background: #f9fafb;
    color: var(--color-text, #1f1d1a);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .intro-backdrop {
      animation: none !important;
    }
    .intro-primary-btn {
      transition: none !important;
    }
  }
</style>
