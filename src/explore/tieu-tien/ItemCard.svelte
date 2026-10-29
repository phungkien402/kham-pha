<script lang="ts">
  import type { VatPham } from './types';
  import {
    formatVietnameseCurrency,
    formatVietnameseNumber,
    canBuy,
    getHoldStep,
    UNBUYABLE_ITEM_ID,
  } from './logic';
  import { soundManager, triggerHaptic } from './audio';

  interface Props {
    item: VatPham;
    quantity: number;
    balance: number;
    totalBudget: number;
    onBuy: (item: VatPham, count: number) => void;
    onSell: (item: VatPham, count: number) => void;
  }

  let { item, quantity, balance, totalBudget, onBuy, onSell }: Props = $props();

  let showInfo = $state(false);
  let isHolding = $state(false);

  // Hold timer state
  let holdTimeout: ReturnType<typeof setTimeout> | undefined;
  let holdInterval: ReturnType<typeof setInterval> | undefined;
  let holdStartTime = 0;

  const isSpecialUnbuyable = $derived(item.id === UNBUYABLE_ITEM_ID || item.gia > totalBudget);
  const affordable = $derived(canBuy(item, balance, 1, totalBudget));
  const missingAmount = $derived(
    isSpecialUnbuyable ? Math.max(0, item.gia - balance) : 0
  );

  function handleSingleBuy() {
    if (!affordable || isSpecialUnbuyable) return;
    soundManager.playBuy();
    triggerHaptic(12);
    onBuy(item, 1);
  }

  function handleSingleSell() {
    if (quantity <= 0) return;
    soundManager.playSell();
    triggerHaptic(8);
    onSell(item, 1);
  }

  function startHold(action: 'buy' | 'sell') {
    if (action === 'buy' && (!affordable || isSpecialUnbuyable)) return;
    if (action === 'sell' && quantity <= 0) return;

    // Kích hoạt ngay nhấp đầu tiên
    if (action === 'buy') {
      handleSingleBuy();
    } else {
      handleSingleSell();
    }

    holdStartTime = Date.now();
    isHolding = true;

    // Giữ 250ms bắt đầu tăng tốc tự động
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => {
        const elapsed = Date.now() - holdStartTime;
        const step = getHoldStep(elapsed);

        if (action === 'buy') {
          if (!canBuy(item, balance, 1, totalBudget)) {
            stopHold();
            return;
          }
          soundManager.playBuy();
          triggerHaptic(6);
          onBuy(item, step);
        } else {
          if (quantity <= 0) {
            stopHold();
            return;
          }
          soundManager.playSell();
          triggerHaptic(6);
          onSell(item, step);
        }
      }, 100);
    }, 250);
  }

  function stopHold() {
    isHolding = false;
    if (holdTimeout) clearTimeout(holdTimeout);
    if (holdInterval) clearInterval(holdInterval);
    holdTimeout = undefined;
    holdInterval = undefined;
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = parseInt(target.value, 10);
    if (isNaN(val) || val < 0) {
      target.value = quantity.toString();
      return;
    }
    const diff = val - quantity;
    if (diff > 0) {
      onBuy(item, diff);
    } else if (diff < 0) {
      onSell(item, Math.abs(diff));
    }
  }
</script>

<div class="item-card {isSpecialUnbuyable ? 'unbuyable-card' : ''} {quantity > 0 ? 'in-cart' : ''}">
  <div class="card-header">
    <div class="emoji-box" title={item.ten}>
      <span class="emoji">{item.emoji}</span>
    </div>

    <div class="header-content">
      <div class="title-row">
        <h3 class="item-title">{item.ten}</h3>
        <button
          type="button"
          class="info-toggle-btn {showInfo ? 'active' : ''}"
          onclick={() => (showInfo = !showInfo)}
          title="Xem nguồn và chi tiết dữ liệu"
          aria-label="Xem chi tiết nguồn dữ liệu"
        >
          ⓘ
        </button>
      </div>

      <div class="price-row">
        <span class="price-val">
          {item.giaKhoang ? 'Khoảng ' : ''}{formatVietnameseCurrency(item.gia, true)}
        </span>
        <span class="price-unit">/ {item.donVi}</span>
      </div>
    </div>
  </div>

  {#if showInfo}
    <div class="info-details" role="region" aria-label="Thông tin chi tiết và nguồn kiểm chứng">
      <div class="info-item">
        <strong>Phạm vi & quy mô:</strong>
        <span>{item.phamVi}</span>
      </div>
      <div class="info-item">
        <strong>Nguồn công khai:</strong>
        <a href={item.nguon} target="_blank" rel="noopener noreferrer" class="source-link">
          Xem bài viết gốc ↗
        </a>
      </div>
      <div class="info-meta">
        <span>Ngày công bố: {item.ngayNguon}</span>
        <span>·</span>
        <span>Kiểm chứng: {item.ngayTruyCap}</span>
      </div>
    </div>
  {/if}

  {#if isSpecialUnbuyable}
    <div class="unbuyable-banner">
      <div class="missing-badge">
        ⚠️ Không đủ — còn thiếu <strong>{formatVietnameseCurrency(missingAmount, true)}</strong>
      </div>
      <p class="curiosity-text">
        Siêu dự án quy mô quốc gia 67 tỷ USD vượt cả toàn bộ tài sản của tỷ phú giàu nhất Việt Nam!
      </p>
    </div>
  {/if}

  <div class="card-footer">
    {#if isSpecialUnbuyable}
      <button type="button" class="ctrl-btn buy-btn unbuyable-btn" disabled>
        Không thể mua
      </button>
    {:else}
      <div class="controls-row">
        <button
          type="button"
          class="ctrl-btn sell-btn"
          disabled={quantity <= 0}
          onpointerdown={() => startHold('sell')}
          onpointerup={stopHold}
          onpointerleave={stopHold}
          onpointercancel={stopHold}
          aria-label="Bán bớt {item.ten}"
          title="Bấm hoặc giữ để bán nhanh"
        >
          − Bán
        </button>

        <div class="quantity-input-box">
          <input
            type="number"
            min="0"
            step="1"
            value={quantity}
            onchange={handleInputChange}
            aria-label="Số lượng {item.ten}"
            class="quantity-input"
          />
        </div>

        <button
          type="button"
          class="ctrl-btn buy-btn"
          disabled={!affordable}
          onpointerdown={() => startHold('buy')}
          onpointerup={stopHold}
          onpointerleave={stopHold}
          onpointercancel={stopHold}
          aria-label="Mua thêm {item.ten}"
          title={affordable ? 'Bấm hoặc giữ để mua nhanh' : 'Không đủ số dư'}
        >
          + Mua
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .item-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: var(--radius, 1rem);
    padding: 1.15rem;
    position: relative;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .item-card:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.05);
    border-color: #d1c9bd;
  }

  .item-card.in-cart {
    border-color: #10b981;
    background: #fcfdfd;
  }

  .unbuyable-card {
    background: #faf9f6;
    border-style: dashed;
    border-color: #d97706;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    margin-bottom: 0.85rem;
  }

  .emoji-box {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    background: #f3efe8;
    border-radius: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.85rem;
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.35rem;
  }

  .item-title {
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--color-text, #1f1d1a);
    word-break: break-word;
  }

  .info-toggle-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-border, #e6e1d9);
    background: transparent;
    border-radius: 50%;
    color: var(--color-text-muted, #6b665f);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .info-toggle-btn:hover,
  .info-toggle-btn.active {
    background: #059669;
    color: #ffffff;
    border-color: #059669;
  }

  .price-row {
    margin-top: 0.25rem;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .price-val {
    font-size: 1.05rem;
    font-weight: 800;
    color: #059669;
  }

  .price-unit {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b665f);
  }

  .info-details {
    background: #faf8f5;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.5rem;
    padding: 0.65rem 0.8rem;
    margin-bottom: 0.85rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: #4b453e;
    animation: fadeIn 0.15s ease;
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

  .info-item {
    margin-bottom: 0.25rem;
  }

  .source-link {
    color: #059669;
    text-decoration: underline;
    font-weight: 600;
  }

  .info-meta {
    margin-top: 0.35rem;
    font-size: 0.7rem;
    color: var(--color-text-muted, #6b665f);
    display: flex;
    gap: 0.35rem;
  }

  .unbuyable-banner {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 0.5rem;
    padding: 0.65rem 0.75rem;
    margin-bottom: 0.85rem;
  }

  .missing-badge {
    font-size: 0.8rem;
    color: #b45309;
    margin-bottom: 0.25rem;
  }

  .curiosity-text {
    font-size: 0.75rem;
    color: #78350f;
    line-height: 1.4;
  }

  .card-footer {
    margin-top: auto;
    padding-top: 0.5rem;
  }

  .controls-row {
    display: flex;
    align-items: stretch;
    height: 48px; /* Thumb zone min height 48px */
    border-radius: 0.75rem;
    overflow: hidden;
    background: #f3efe8;
    user-select: none;
    -webkit-user-select: none;
  }

  .ctrl-btn {
    border: none;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.1s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 1rem;
    min-height: 48px;
    touch-action: manipulation;
  }

  .sell-btn {
    background: #f3efe8;
    color: #78716c;
    flex: 1;
  }

  .sell-btn:not(:disabled):hover {
    background: #e7e2d9;
    color: #dc2626;
  }

  .sell-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .buy-btn {
    background: #059669;
    color: #ffffff;
    flex: 1;
  }

  .buy-btn:not(:disabled):hover {
    background: #047857;
  }

  .buy-btn:disabled {
    background: #cbd5e1;
    color: #64748b;
    cursor: not-allowed;
  }

  .unbuyable-btn {
    width: 100%;
    background: #f1f5f9;
    color: #94a3b8;
    cursor: not-allowed;
    border-radius: 0.75rem;
  }

  .quantity-input-box {
    width: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    border-left: 1px solid var(--color-border, #e6e1d9);
    border-right: 1px solid var(--color-border, #e6e1d9);
  }

  .quantity-input {
    width: 100%;
    height: 100%;
    text-align: center;
    border: none;
    outline: none;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-text, #1f1d1a);
    background: transparent;
    -moz-appearance: textfield;
  }

  .quantity-input::-webkit-outer-spin-button,
  .quantity-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
