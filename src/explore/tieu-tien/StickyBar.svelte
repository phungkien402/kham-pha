<script lang="ts">
  import { onMount } from 'svelte';
  import { soundManager } from './audio';
  import {
    formatVietnameseNumber,
    formatVietnameseCurrency,
    calculateTimeRemaining,
  } from './logic';

  interface Props {
    balance: number;
    totalBudget: number;
    deltaAmount: number | null; // > 0 là hoàn lại/bán, < 0 là mua
    onScrollToReceipt: () => void;
  }

  let { balance, totalBudget, deltaAmount, onScrollToReceipt }: Props = $props();

  let isMuted = $state(true);
  let displayBalance = $state(balance);
  let badgeVisible = $state(false);
  let badgeDelta = $state<number | null>(null);
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;

  // Cập nhật âm thanh ban đầu
  onMount(() => {
    isMuted = soundManager.muted;
  });

  function toggleAudio() {
    isMuted = soundManager.toggleMute();
  }

  // Smooth lerp animation cho displayBalance
  $effect(() => {
    const target = balance;
    let animId: number;

    const animate = () => {
      const diff = target - displayBalance;
      if (Math.abs(diff) < 10) {
        displayBalance = target;
      } else {
        displayBalance += diff * 0.2;
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  });

  // Hiệu ứng nổi badge khi có biến động tiền
  $effect(() => {
    if (deltaAmount !== null && deltaAmount !== 0) {
      badgeDelta = deltaAmount;
      badgeVisible = true;
      if (badgeTimer) clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => {
        badgeVisible = false;
      }, 1500);
    }
  });

  const percentRemaining = $derived(
    totalBudget > 0 ? Math.max(0, Math.min(100, (balance / totalBudget) * 100)) : 0
  );
  const timeRemaining = $derived(calculateTimeRemaining(balance, 100_000_000));
</script>

<div class="sticky-bar">
  <div class="bar-container">
    <div class="balance-col">
      <div class="balance-label">
        <span>SỐ DƯ MÔ PHỎNG</span>
        <span class="pct-badge">{percentRemaining.toFixed(1)}%</span>
      </div>

      <div class="balance-value-row">
        <span class="balance-num desktop-only">{formatVietnameseNumber(displayBalance)} đ</span>
        <span class="balance-num mobile-only">{formatVietnameseCurrency(displayBalance, true)}</span>

        {#if badgeVisible && badgeDelta !== null}
          <span class="delta-badge {badgeDelta > 0 ? 'delta-plus' : 'delta-minus'}">
            {badgeDelta > 0 ? '+' : ''}{formatVietnameseCurrency(badgeDelta, true)}
          </span>
        {/if}
      </div>

      <!-- Thanh tiến trình ngân sách -->
      <div class="progress-track" title="Tỷ lệ ngân sách còn lại">
        <div class="progress-fill" style="width: {percentRemaining}%;"></div>
      </div>
    </div>

    <div class="speed-col">
      <div class="speed-title">
        <span class="clock-icon">⏱️</span>
        <span>Nếu tiêu 100 triệu/giây:</span>
      </div>
      <div class="speed-time">
        Còn <strong>{timeRemaining.formattedText}</strong>
      </div>
    </div>

    <div class="actions-col">
      <button
        type="button"
        class="icon-btn audio-btn"
        onclick={toggleAudio}
        title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
      >
        <span>{isMuted ? '🔇' : '🔊'}</span>
      </button>

      <button
        type="button"
        class="receipt-jump-btn"
        onclick={onScrollToReceipt}
        title="Xem hoá đơn cuộn giấy"
      >
        <span>🧾 Hoá đơn</span>
      </button>
    </div>
  </div>
</div>

<style>
  .sticky-bar {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(250, 248, 245, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-border, #e6e1d9);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    transition: background 0.2s ease;
  }

  .bar-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0.65rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .balance-col {
    flex: 1;
    min-width: 0;
  }

  .balance-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #6b665f);
  }

  .pct-badge {
    background: #e6f4ea;
    color: #137333;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
  }

  .balance-value-row {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  .balance-num {
    font-size: 1.35rem;
    font-weight: 800;
    color: #059669;
    letter-spacing: -0.02em;
    line-height: 1.25;
    white-space: nowrap;
  }

  .desktop-only {
    display: inline;
  }

  .mobile-only {
    display: none;
  }

  .delta-badge {
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 6px;
    animation: deltaFloat 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    white-space: nowrap;
  }

  .delta-minus {
    background: #fde8e8;
    color: #c81e1e;
  }

  .delta-plus {
    background: #def7ec;
    color: #03543f;
  }

  @keyframes deltaFloat {
    0% {
      opacity: 0;
      transform: translateY(6px);
    }
    20% {
      opacity: 1;
      transform: translateY(0);
    }
    80% {
      opacity: 1;
      transform: translateY(-4px);
    }
    100% {
      opacity: 0;
      transform: translateY(-10px);
    }
  }

  .progress-track {
    width: 100%;
    max-width: 320px;
    height: 4px;
    background: #e6e1d9;
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.25rem;
  }

  .progress-fill {
    height: 100%;
    background: #10b981;
    border-radius: 2px;
    transition: width 0.2s ease-out;
  }

  .speed-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.25rem 0.85rem;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.5rem;
    font-size: 0.8rem;
  }

  .speed-title {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted, #6b665f);
    font-size: 0.72rem;
  }

  .speed-time {
    color: var(--color-text, #1f1d1a);
    font-size: 0.85rem;
  }

  .actions-col {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: 1px solid var(--color-border, #e6e1d9);
    background: #ffffff;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.1rem;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: #f3efe8;
    transform: scale(1.05);
  }

  .receipt-jump-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.85rem;
    background: #059669;
    color: #ffffff;
    border: none;
    border-radius: 999px;
    font-size: 0.825rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .receipt-jump-btn:hover {
    background: #047857;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none;
    }
    .mobile-only {
      display: inline;
    }
    .speed-col {
      display: none;
    }
    .bar-container {
      padding: 0.5rem 0.75rem;
    }
    .balance-num {
      font-size: 1.15rem;
    }
  }
</style>
