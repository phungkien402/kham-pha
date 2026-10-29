<script lang="ts">
  import type { Milestone } from './types';

  interface Props {
    milestones: Milestone[];
    onDismiss: (id: string) => void;
  }

  let { milestones, onDismiss }: Props = $props();
</script>

{#if milestones.length > 0}
  <aside class="toast-stack" aria-label="Thông báo các cột mốc chi tiêu">
    {#each milestones as milestone (milestone.id)}
      <div class="toast-card" role="alert" aria-live="polite">
        <div class="toast-icon">🎯</div>
        <div class="toast-content">
          <div class="toast-badge">{milestone.nhan}</div>
          <h4 class="toast-title">{milestone.tieuDe}</h4>
          <p class="toast-desc">{milestone.noiDung}</p>
        </div>
        <button
          type="button"
          class="close-btn"
          onclick={() => onDismiss(milestone.id)}
          title="Đóng thông báo"
          aria-label="Đóng thông báo"
        >
          ✕
        </button>
      </div>
    {/each}
  </aside>
{/if}

<style>
  .toast-stack {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 380px;
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

  @media (max-width: 640px) {
    .toast-stack {
      bottom: 1rem;
      right: 1rem;
      left: 1rem;
      width: auto;
      max-width: none;
    }
  }
</style>
