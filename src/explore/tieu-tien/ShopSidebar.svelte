<!-- src/explore/tieu-tien/ShopSidebar.svelte -->
<!-- Thanh Mua sắm cuộn dọc bên phải (hoặc ở dưới trên mobile) theo chuẩn neal.fun -->

<script lang="ts">
  import type { VatPham, GioHang, NhomVatPham } from './types';
  import {
    formatVietnameseCurrency,
    formatVietnameseNumber,
    canBuy,
    getHoldStep,
    UNBUYABLE_ITEM_ID,
  } from './logic';
  import { soundManager, triggerHaptic } from './audio';

  interface Props {
    items: VatPham[];
    cart: GioHang;
    balance: number;
    totalBudget: number;
    highlightedId?: string | null;
    onBuy: (item: VatPham, count: number) => void;
    onSell: (item: VatPham, count: number) => void;
  }

  let {
    items,
    cart,
    balance,
    totalBudget,
    highlightedId = null,
    onBuy,
    onSell,
  }: Props = $props();

  let selectedCategory = $state<'all' | NhomVatPham>('all');
  let openInfoId = $state<string | null>(null);

  // Lưu trữ bội số mua của từng vật phẩm (mặc định 1)
  let itemMultipliers = $state<Record<string, number>>({});

  // Hold-to-buy/sell timers
  let holdTimeout: ReturnType<typeof setTimeout> | undefined;
  let holdInterval: ReturnType<typeof setInterval> | undefined;
  let holdStartTime = 0;

  const filteredItems = $derived(
    selectedCategory === 'all'
      ? items
      : items.filter((it) => it.nhom === selectedCategory)
  );

  function getMultiplier(id: string): number {
    return itemMultipliers[id] || 1;
  }

  function setMultiplier(id: string, mult: number) {
    itemMultipliers = { ...itemMultipliers, [id]: mult };
  }

  function handleBuyClick(item: VatPham) {
    const mult = getMultiplier(item.id);
    if (!canBuy(item, balance, 1, totalBudget)) return;
    soundManager.playBuy();
    triggerHaptic(12);
    onBuy(item, mult);
  }

  function handleSellClick(item: VatPham) {
    const mult = getMultiplier(item.id);
    const currentCount = cart[item.id] || 0;
    if (currentCount <= 0) return;
    soundManager.playSell();
    triggerHaptic(8);
    onSell(item, mult);
  }

  function startHold(item: VatPham, action: 'buy' | 'sell') {
    const mult = getMultiplier(item.id);
    if (action === 'buy' && !canBuy(item, balance, 1, totalBudget)) return;
    if (action === 'sell' && (cart[item.id] || 0) <= 0) return;

    if (action === 'buy') {
      handleBuyClick(item);
    } else {
      handleSellClick(item);
    }

    holdStartTime = Date.now();
    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => {
        const elapsed = Date.now() - holdStartTime;
        const step = getHoldStep(elapsed) * mult;

        if (action === 'buy') {
          if (!canBuy(item, balance, 1, totalBudget)) {
            stopHold();
            return;
          }
          soundManager.playBuy();
          triggerHaptic(6);
          onBuy(item, step);
        } else {
          if ((cart[item.id] || 0) <= 0) {
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
    if (holdTimeout) clearTimeout(holdTimeout);
    if (holdInterval) clearInterval(holdInterval);
    holdTimeout = undefined;
    holdInterval = undefined;
  }

  function handleQuantityInput(item: VatPham, e: Event) {
    const input = e.target as HTMLInputElement;
    const val = parseInt(input.value, 10);
    const current = cart[item.id] || 0;
    if (isNaN(val) || val < 0) {
      input.value = current.toString();
      return;
    }
    const diff = val - current;
    if (diff > 0) {
      onBuy(item, diff);
    } else if (diff < 0) {
      onSell(item, Math.abs(diff));
    }
  }

  function toggleInfo(id: string) {
    openInfoId = openInfoId === id ? null : id;
  }
</script>

<div class="shop-sidebar">
  <div class="shop-header">
    <div class="shop-title-row">
      <h2 class="shop-title">🛒 Mua sắm</h2>
      <span class="shop-subtitle">{items.length} hạng mục</span>
    </div>

    <!-- Thanh lọc danh mục -->
    <nav class="category-filters" aria-label="Bộ lọc danh mục mua sắm">
      <button
        type="button"
        class="filter-pill {selectedCategory === 'all' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'all')}
      >
        Tất cả ({items.length})
      </button>
      <button
        type="button"
        class="filter-pill {selectedCategory === 'doi-thuong' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'doi-thuong')}
      >
        🍜 Đời thường
      </button>
      <button
        type="button"
        class="filter-pill {selectedCategory === 'xe-nha' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'xe-nha')}
      >
        🚗 Xe & nhà
      </button>
      <button
        type="button"
        class="filter-pill {selectedCategory === 'cong-dong' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'cong-dong')}
      >
        🏥 Cộng đồng
      </button>
      <button
        type="button"
        class="filter-pill {selectedCategory === 'ha-tang' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'ha-tang')}
      >
        🌉 Hạ tầng
      </button>
    </nav>
  </div>

  <!-- Danh sách cuộn các thẻ vật phẩm -->
  <div class="items-scroll-list" role="feed" aria-label="Danh mục vật phẩm mua sắm">
    {#each filteredItems as item (item.id)}
      {@const isUnbuyable = item.id === UNBUYABLE_ITEM_ID || item.gia > totalBudget}
      {@const count = cart[item.id] || 0}
      {@const mult = getMultiplier(item.id)}
      {@const affordable = canBuy(item, balance, mult, totalBudget)}
      {@const isInfoOpen = openInfoId === item.id}
      {@const isHighlighted = highlightedId === item.id}

      <div
        id="shop-item-{item.id}"
        class="shop-card {isUnbuyable ? 'unbuyable-card' : ''} {count > 0 ? 'in-cart' : ''} {isHighlighted ? 'highlighted' : ''}"
      >
        <div class="card-main">
          <!-- Ảnh đại diện isometric 2.5D nhỏ cho vật phẩm -->
          <div
            class="thumb-box"
            title={item.ten}
            style="background-image: url('/tieu-tien/sprites/{item.id}-icon.webp'); background-size: 88% 88%; background-repeat: no-repeat; background-position: center;"
            aria-label={item.ten}
          ></div>

          <div class="item-info">
            <div class="item-title-line">
              <h3 class="item-name">{item.ten}</h3>
              <button
                type="button"
                class="info-btn {isInfoOpen ? 'active' : ''}"
                onclick={() => toggleInfo(item.id)}
                title="Xem chi tiết & nguồn gốc"
                aria-label="Xem chi tiết {item.ten}"
              >
                ⓘ
              </button>
            </div>

            <div class="item-price-line">
              <span class="price-text">
                {item.giaKhoang ? 'Khoảng ' : ''}{formatVietnameseCurrency(item.gia, true)}
              </span>
              <span class="price-unit">/ {item.donVi}</span>
            </div>
          </div>
        </div>

        {#if isInfoOpen}
          <div class="info-dropdown">
            <p class="info-scope"><strong>Quy mô:</strong> {item.phamVi}</p>
            <p class="info-source">
              <strong>Nguồn:</strong>
              <a href={item.nguon} target="_blank" rel="noopener noreferrer">
                Xem bài báo gốc ↗
              </a>
              ({item.ngayNguon})
            </p>
          </div>
        {/if}

        {#if isUnbuyable}
          <div class="unbuyable-alert">
            <span>⚠️ Dự án 1,713 triệu tỷ đ — lớn hơn tổng tài sản cả trò chơi (35,2 tỷ USD)</span>
          </div>
        {:else}
          <!-- Bội số & Thao tác Mua / Bán -->
          <div class="card-actions">
            <!-- Nút chọn số lượng nhân: ×1 ×10 ×100 ×1.000 -->
            <div class="multiplier-group" aria-label="Chọn hệ số mua bán">
              {#each [1, 10, 100, 1000] as m}
                <button
                  type="button"
                  class="mult-btn {mult === m ? 'active' : ''}"
                  onclick={() => setMultiplier(item.id, m)}
                >
                  {m === 1000 ? '×1.000' : `×${m}`}
                </button>
              {/each}
            </div>

            <div class="action-buttons-row">
              <button
                type="button"
                class="act-btn sell-btn"
                disabled={count <= 0}
                onpointerdown={() => startHold(item, 'sell')}
                onpointerup={stopHold}
                onpointerleave={stopHold}
                onpointercancel={stopHold}
                aria-label="Bán {mult} {item.ten}"
                title="Bấm hoặc giữ để bán nhanh"
              >
                − Bán {mult > 1 ? `(${mult})` : ''}
              </button>

              <div class="qty-box" title="Số lượng đã mua">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={count}
                  onchange={(e) => handleQuantityInput(item, e)}
                  class="qty-input"
                  aria-label="Số lượng hiện có"
                />
              </div>

              <button
                type="button"
                class="act-btn buy-btn"
                disabled={!affordable}
                onpointerdown={() => startHold(item, 'buy')}
                onpointerup={stopHold}
                onpointerleave={stopHold}
                onpointercancel={stopHold}
                aria-label="Mua {mult} {item.ten}"
                title={affordable ? 'Bấm hoặc giữ để mua nhanh' : 'Không đủ số dư'}
              >
                + Mua {mult > 1 ? `(${mult})` : ''}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .shop-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: var(--radius, 1rem);
    overflow: hidden;
  }

  .shop-header {
    padding: 1rem 1.15rem 0.75rem;
    border-bottom: 1px solid #f0ebe4;
    background: #ffffff;
    flex-shrink: 0;
  }

  .shop-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.65rem;
  }

  .shop-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #1f1d1a;
    margin: 0;
  }

  .shop-subtitle {
    font-size: 0.75rem;
    font-weight: 600;
    color: #78716c;
  }

  .category-filters {
    display: flex;
    gap: 0.35rem;
    overflow-x: auto;
    padding-bottom: 0.35rem;
    -webkit-overflow-scrolling: touch;
  }

  .category-filters::-webkit-scrollbar {
    height: 3px;
  }

  .category-filters::-webkit-scrollbar-thumb {
    background: #e6e1d9;
    border-radius: 2px;
  }

  .filter-pill {
    flex-shrink: 0;
    padding: 0.35rem 0.65rem;
    background: #f7f5f0;
    border: 1px solid #e6e1d9;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #78716c;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-pill:hover {
    background: #ece8df;
    color: #1f1d1a;
  }

  .filter-pill.active {
    background: #059669;
    color: #ffffff;
    border-color: #059669;
  }

  .items-scroll-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    -webkit-overflow-scrolling: touch;
  }

  .items-scroll-list::-webkit-scrollbar {
    width: 6px;
  }

  .items-scroll-list::-webkit-scrollbar-thumb {
    background: #e6e1d9;
    border-radius: 3px;
  }

  .shop-card {
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.75rem;
    padding: 0.75rem;
    transition: all 0.15s ease;
  }

  .shop-card:hover {
    border-color: #d1c9bd;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .shop-card.in-cart {
    border-color: #10b981;
    background: #fbfdfc;
  }

  .shop-card.highlighted {
    border-color: #059669;
    box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.2);
  }

  .unbuyable-card {
    background: #faf8f5;
    border-style: dashed;
    border-color: #d97706;
  }

  .card-main {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
  }

  .thumb-box {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    background: #f3efe8;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-title-line {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.25rem;
  }

  .item-name {
    font-size: 0.85rem;
    font-weight: 700;
    color: #1f1d1a;
    line-height: 1.3;
    margin: 0;
  }

  .info-btn {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e6e1d9;
    background: transparent;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 700;
    color: #78716c;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .info-btn:hover,
  .info-btn.active {
    background: #059669;
    color: #ffffff;
    border-color: #059669;
  }

  .item-price-line {
    margin-top: 0.15rem;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  .price-text {
    font-size: 0.9rem;
    font-weight: 800;
    color: #059669;
  }

  .price-unit {
    font-size: 0.7rem;
    color: #78716c;
  }

  .info-dropdown {
    margin-top: 0.5rem;
    padding: 0.5rem 0.65rem;
    background: #f8fafc;
    border-radius: 0.35rem;
    font-size: 0.725rem;
    line-height: 1.4;
    color: #475569;
  }

  .info-dropdown p {
    margin: 0 0 0.25rem;
  }

  .info-dropdown a {
    color: #059669;
    text-decoration: underline;
  }

  .unbuyable-alert {
    margin-top: 0.5rem;
    padding: 0.4rem 0.6rem;
    background: #fffbeb;
    border-radius: 0.35rem;
    font-size: 0.7rem;
    color: #b45309;
    line-height: 1.35;
  }

  .card-actions {
    margin-top: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .multiplier-group {
    display: flex;
    gap: 0.25rem;
  }

  .mult-btn {
    flex: 1;
    padding: 0.2rem 0;
    background: #f7f5f0;
    border: 1px solid #e6e1d9;
    border-radius: 0.35rem;
    font-size: 0.675rem;
    font-weight: 700;
    color: #78716c;
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .mult-btn:hover {
    background: #ece8df;
    color: #1f1d1a;
  }

  .mult-btn.active {
    background: #1f2937;
    color: #ffffff;
    border-color: #1f2937;
  }

  .action-buttons-row {
    display: flex;
    align-items: stretch;
    height: 38px;
    background: #f3efe8;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .act-btn {
    border: none;
    font-size: 0.775rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.65rem;
    transition: all 0.1s ease;
    touch-action: manipulation;
  }

  .sell-btn {
    flex: 1;
    background: #f3efe8;
    color: #78716c;
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
    flex: 1.15;
    background: #059669;
    color: #ffffff;
  }

  .buy-btn:not(:disabled):hover {
    background: #047857;
  }

  .buy-btn:disabled {
    background: #cbd5e1;
    color: #64748b;
    cursor: not-allowed;
  }

  .qty-box {
    width: 48px;
    background: #ffffff;
    border-left: 1px solid #e6e1d9;
    border-right: 1px solid #e6e1d9;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qty-input {
    width: 100%;
    height: 100%;
    text-align: center;
    border: none;
    outline: none;
    font-size: 0.85rem;
    font-weight: 800;
    color: #1f1d1a;
    background: transparent;
    -moz-appearance: textfield;
  }

  .qty-input::-webkit-outer-spin-button,
  .qty-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
