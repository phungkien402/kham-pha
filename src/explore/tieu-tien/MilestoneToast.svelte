<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Milestone } from './types';

  interface Props {
    milestones: Milestone[];
    onDismiss: (id: string) => void;
  }

  let { milestones, onDismiss }: Props = $props();

  // Chỉ hiển thị đúng 1 toast tại một thời điểm (lấy mốc mới nhất)
  const currentMilestone = $derived(
    milestones.length > 0 ? milestones[milestones.length - 1] : null
  );

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  // Tự ẩn sau 5 giây
  $effect(() => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    if (currentMilestone) {
      const id = currentMilestone.id;
      dismissTimer = setTimeout(() => {
        onDismiss(id);
      }, 5000);
    }
  });

  onDestroy(() => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
    }
  });
</script>

{#if currentMilestone}
  <aside class="toast-stack" aria-label="Thông báo cột mốc chi tiêu">
    <div class="toast-card" role="alert" aria-live="polite">
      <div class="toast-icon">🎯</div>
      <div class="toast-content">
        <div class="toast-badge">{currentMilestone.nhan}</div>
        <h4 class="toast-title">{currentMilestone.tieuDe}</h4>
        <p class="toast-desc">{currentMilestone.noiDung}</p>
      </div>
      <button
        type="button"
        class="close-btn"
        onclick={() => onDismiss(currentMilestone.id)}
        title="Đóng thông báo"
        aria-label="Đóng thông báo"
      >
        ✕
      </button>
    </div>
  </aside>
{/if}

<style>
  .toast-stack {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    right: auto;
    z-index: 1000;
    max-width: 360px;
    width: calc(100vw - 3rem);
    pointer-events: none; /* Không chặn tương tác ở vùng nền */
  }

  .toast-card {
    pointer-events: auto; /* Cho phép bấm nút đóng và tương tác thẻ */
    background: #ffffff;
    border: 1px solid #10b981;
    border-left: 4px solid #059669;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    padding: 0.85rem 1rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .toast-icon {
    font-size: 1.35rem;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-badge {
    display: inline-block;
    background: #ecfdf5;
    color: #065f46;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    margin-bottom: 0.25rem;
  }

  .toast-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-text, #1f1d1a);
    margin: 0 0 0.2rem 0;
    line-height: 1.3;
  }

  .toast-desc {
    font-size: 0.775rem;
    color: var(--color-text-muted, #6b665f);
    margin: 0;
    line-height: 1.45;
  }

  .close-btn {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--color-text-muted, #6b665f);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    line-height: 1;
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: #f3efe8;
    color: var(--color-text, #1f1d1a);
  }

  @media (max-width: 1024px) {
    .toast-stack {
      bottom: calc(45svh + 1rem);
      left: 1rem;
      right: auto;
      max-width: calc(100vw - 2rem);
      width: auto;
    }
  }
</style>
