<script lang="ts">
  import vatPhamData from './data/vat-pham.json';
  import type {
    VatPham,
    NganSachConfig,
    GioHang,
    LichSuHanhDong,
    Milestone,
    NhomVatPham,
  } from './types';
  import {
    getTotalBudget,
    calculateTotalSpent,
    calculateBalance,
    buyItem,
    sellItem,
    undoLastBuy,
    getNewMilestones,
    calculateCategoryBreakdown,
    formatVietnameseCurrency,
    formatVietnameseNumber,
  } from './logic';
  import { soundManager } from './audio';

  import StickyBar from './StickyBar.svelte';
  import ItemCard from './ItemCard.svelte';
  import MilestoneToast from './MilestoneToast.svelte';
  import Receipt from './Receipt.svelte';

  const items: VatPham[] = vatPhamData.vatPham as VatPham[];
  const config: NganSachConfig = vatPhamData.nganSach as NganSachConfig;
  const totalBudget = getTotalBudget(config);

  // Trạng thái chơi game
  let cart = $state<GioHang>({});
  let history = $state<LichSuHanhDong[]>([]);
  let activeMilestones = $state<Milestone[]>([]);
  let deltaAmount = $state<number | null>(null);
  let selectedCategory = $state<'all' | NhomVatPham>('all');

  // Tính toán phái sinh
  const totalSpent = $derived(calculateTotalSpent(cart, items));
  const balance = $derived(calculateBalance(totalBudget, totalSpent));
  const breakdown = $derived(calculateCategoryBreakdown(cart, items));

  const filteredItems = $derived(
    selectedCategory === 'all'
      ? items
      : items.filter((it) => it.nhom === selectedCategory)
  );

  function handleBuy(item: VatPham, count: number) {
    const prevSpent = totalSpent;
    const res = buyItem(cart, item, count, balance, totalBudget);

    if (res.success && res.actualCount > 0) {
      cart = res.newCart;
      history = [...history, { itemId: item.id, count: res.actualCount, gia: item.gia }];
      deltaAmount = -res.cost;

      // Kiểm tra mốc % mới
      const nextSpent = prevSpent + res.cost;
      const newMs = getNewMilestones(prevSpent, nextSpent, totalBudget);
      if (newMs.length > 0) {
        soundManager.playMilestone();
        activeMilestones = [...activeMilestones, ...newMs];
      }
    }
  }

  function handleSell(item: VatPham, count: number) {
    const res = sellItem(cart, item, count);
    if (res.success && res.actualCount > 0) {
      cart = res.newCart;
      deltaAmount = res.refund;
    }
  }

  function handleUndo() {
    if (history.length === 0) return;
    const res = undoLastBuy(cart, history);
    if (res.undoneAction) {
      cart = res.newCart;
      history = res.newHistory;
      deltaAmount = res.undoneAction.count * res.undoneAction.gia;
      soundManager.playSell();
    }
  }

  function handleReset() {
    cart = {};
    history = [];
    deltaAmount = null;
    activeMilestones = [];
  }

  function dismissMilestone(id: string) {
    activeMilestones = activeMilestones.filter((m) => m.id !== id);
  }

  function scrollToReceipt() {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('hoa-don');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }
</script>

<div class="tieu-tien-page">
  <!-- Thanh điều khiển Sticky Bar ghim đỉnh màn hình -->
  <StickyBar
    {balance}
    {totalBudget}
    {deltaAmount}
    onScrollToReceipt={scrollToReceipt}
  />

  <div class="game-container">
    <!-- Hero giới thiệu -->
    <header class="game-hero">
      <div class="title-badge">KHÁM PHÁ QUY MÔ TÀI CHÍNH</div>
      <h1 class="main-title">1 ngày làm PNV</h1>
      <p class="tagline">Bạn có 35,2 tỷ USD — tiêu thế nào?</p>
      <p class="subtitle">
        Mô phỏng theo ước tính tài sản ròng của tỷ phú Phạm Nhật Vượng do Forbes công bố ngày 10/10/2026
      </p>

      <!-- Khung thông tin snapshot cố định & Miễn trừ -->
      <div class="snapshot-card">
        <div class="snapshot-row">
          <div class="snap-item">
            <span class="snap-label">Ngân sách snapshot:</span>
            <span class="snap-val">35,2 tỷ USD (Forbes 10/10/2026)</span>
          </div>
          <div class="snap-item">
            <span class="snap-label">Tỷ giá Vietcombank:</span>
            <span class="snap-val">25.660 VND/USD (29/10/2026)</span>
          </div>
          <div class="snap-item">
            <span class="snap-label">Tổng ngân sách:</span>
            <span class="snap-val highlight">{formatVietnameseNumber(totalBudget)} đ</span>
          </div>
        </div>
        <div class="disclaimer-text">
          ⚖️ <strong>Tuyên bố miễn trừ:</strong> Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới. Dữ liệu tài sản ròng là con số ước tính công khai trên báo chí, không phản ánh tiền mặt hay tài khoản thực tế.
        </div>
      </div>
    </header>

    <!-- Bộ lọc danh mục -->
    <nav class="category-tabs" aria-label="Lọc vật phẩm theo nhóm">
      <button
        type="button"
        class="tab-btn {selectedCategory === 'all' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'all')}
      >
        Tất cả ({items.length})
      </button>
      <button
        type="button"
        class="tab-btn {selectedCategory === 'doi-thuong' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'doi-thuong')}
      >
        🍜 Đời thường ({items.filter((i) => i.nhom === 'doi-thuong').length})
      </button>
      <button
        type="button"
        class="tab-btn {selectedCategory === 'xe-nha' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'xe-nha')}
      >
        🚗 Xe & nhà ({items.filter((i) => i.nhom === 'xe-nha').length})
      </button>
      <button
        type="button"
        class="tab-btn {selectedCategory === 'cong-dong' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'cong-dong')}
      >
        🏥 Cộng đồng ({items.filter((i) => i.nhom === 'cong-dong').length})
      </button>
      <button
        type="button"
        class="tab-btn {selectedCategory === 'ha-tang' ? 'active' : ''}"
        onclick={() => (selectedCategory = 'ha-tang')}
      >
        🌉 Hạ tầng ({items.filter((i) => i.nhom === 'ha-tang').length})
      </button>
    </nav>

    <!-- Lưới thẻ vật phẩm (3-4 cột desktop, 1 cột mobile) -->
    <section class="products-grid" aria-label="Danh sách vật phẩm mô phỏng">
      {#each filteredItems as item (item.id)}
        <ItemCard
          {item}
          quantity={cart[item.id] || 0}
          {balance}
          {totalBudget}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      {/each}
    </section>

    <!-- Hoá đơn cuộn giấy ở cuối trang -->
    <Receipt
      {cart}
      {items}
      {totalBudget}
      {totalSpent}
      {balance}
      {breakdown}
      canUndo={history.length > 0}
      onUndo={handleUndo}
      onReset={handleReset}
    />
  </div>

  <!-- Thông báo Toast khi đạt mốc % -->
  <MilestoneToast
    milestones={activeMilestones}
    onDismiss={dismissMilestone}
  />
</div>

<style>
  .tieu-tien-page {
    min-height: 100vh;
    background: var(--color-bg, #faf8f5);
  }

  .game-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .game-hero {
    text-align: center;
    max-width: 820px;
    margin: 0 auto 2rem;
  }

  .title-badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #059669;
    background: #ecfdf5;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    margin-bottom: 0.5rem;
  }

  .main-title {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--color-text, #1f1d1a);
    margin: 0 0 0.4rem;
    line-height: 1.2;
  }

  .tagline {
    font-size: 1.25rem;
    font-weight: 700;
    color: #059669;
    margin: 0 0 0.5rem;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--color-text-muted, #6b665f);
    line-height: 1.5;
    margin: 0 0 1.25rem;
  }

  .snapshot-card {
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: var(--radius, 1rem);
    padding: 1rem 1.25rem;
    text-align: left;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
  }

  .snapshot-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid #f0ebe4;
    font-size: 0.825rem;
  }

  .snap-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .snap-label {
    font-size: 0.725rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
  }

  .snap-val {
    font-weight: 600;
    color: var(--color-text, #1f1d1a);
  }

  .snap-val.highlight {
    color: #059669;
    font-weight: 700;
  }

  .disclaimer-text {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: var(--color-text-muted, #6b665f);
  }

  .category-tabs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.75rem;
    margin-bottom: 1.5rem;
    -webkit-overflow-scrolling: touch;
  }

  .category-tabs::-webkit-scrollbar {
    height: 4px;
  }

  .category-tabs::-webkit-scrollbar-thumb {
    background: #e6e1d9;
    border-radius: 2px;
  }

  .tab-btn {
    flex-shrink: 0;
    padding: 0.5rem 0.9rem;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 999px;
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    background: #f3efe8;
    color: var(--color-text, #1f1d1a);
  }

  .tab-btn.active {
    background: #059669;
    color: #ffffff;
    border-color: #059669;
  }

  /* Lưới 3-4 cột desktop, 1 cột mobile */
  .products-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.15rem;
  }

  @media (max-width: 1100px) {
    .products-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 768px) {
    .products-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .main-title {
      font-size: 1.85rem;
    }

    .tagline {
      font-size: 1.05rem;
    }

    .snapshot-row {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
