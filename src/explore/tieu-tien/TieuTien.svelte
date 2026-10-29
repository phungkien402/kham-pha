<script lang="ts">
  import { onMount } from 'svelte';
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
    calculateCategoryBreakdown,
    formatVietnameseCurrency,
    formatVietnameseNumber,
  } from './logic';
  import { getNewMilestonesGrouped, isWebGLAvailable } from './stage3d';
  import { soundManager } from './audio';

  import Stage3D from './Stage3D.svelte';
  import ShopSidebar from './ShopSidebar.svelte';
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
  let highlightedShopItemId = $state<string | null>(null);
  let shareToast = $state<string | null>(null);
  let viewMode = $state<'3d' | '2d'>('3d');

  // Tham chiếu đến Sân khấu 3D
  let stage3dRef = $state<any>(null);

  // Tính toán phái sinh
  const totalSpent = $derived(calculateTotalSpent(cart, items));
  const balance = $derived(calculateBalance(totalBudget, totalSpent));
  const breakdown = $derived(calculateCategoryBreakdown(cart, items));
  const spentRatio = $derived(totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0);
  const spentRatioFormatted = $derived(
    spentRatio >= 1 ? spentRatio.toFixed(1).replace('.0', '') : spentRatio.toFixed(3).replace(/\.?0+$/, '')
  );

  onMount(() => {
    // Nếu thiết bị không hỗ trợ WebGL thì chuyển về 2D
    if (!isWebGLAvailable()) {
      viewMode = '2d';
    }
  });

  function handleBuy(item: VatPham, count: number) {
    const prevSpent = totalSpent;
    const res = buyItem(cart, item, count, balance, totalBudget);

    if (res.success && res.actualCount > 0) {
      cart = res.newCart;
      history = [...history, { itemId: item.id, count: res.actualCount, gia: item.gia }];
      deltaAmount = -res.cost;

      // Gộp thẻ mốc %: chỉ hiện thẻ của mốc cao nhất
      const nextSpent = prevSpent + res.cost;
      const newMs = getNewMilestonesGrouped(prevSpent, nextSpent, totalBudget);
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
    stage3dRef?.recenter?.();
  }

  function dismissMilestone(id: string) {
    activeMilestones = activeMilestones.filter((m) => m.id !== id);
  }

  function handleRecenter() {
    stage3dRef?.recenter?.();
  }

  function handleShare() {
    const shareText = `Tôi đã tiêu ${formatVietnameseCurrency(totalSpent, true)} trên ngân sách ${formatVietnameseCurrency(totalBudget, true)} tại trò chơi "1 ngày làm PNV"!`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: '1 ngày làm PNV — Sân khấu 3D',
        text: shareText,
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      showShareNotice('Đã sao chép thông điệp chia sẻ vào bộ nhớ tạm!');
    }
  }

  function showShareNotice(msg: string) {
    shareToast = msg;
    setTimeout(() => {
      shareToast = null;
    }, 2800);
  }

  function scrollToReceipt() {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('hoa-don');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function handleSelectFrom3D(itemId: string) {
    highlightedShopItemId = itemId;
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`shop-item-${itemId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    setTimeout(() => {
      if (highlightedShopItemId === itemId) {
        highlightedShopItemId = null;
      }
    }, 2000);
  }
</script>

<div class="tieu-tien-page">
  <!-- THANH SỐ DƯ & ĐIỀU KHIỂN CHÍNH (Đỉnh trang kiểu neal.fun) -->
  <header class="stage-top-bar" aria-label="Bảng tổng quan số dư và thanh điều khiển">
    <div class="top-bar-inner">
      <!-- Cụm số dư lớn ở giữa -->
      <div class="balance-display-block">
        <div class="balance-label">SỐ DƯ CÒN LẠI</div>
        <div class="balance-amount" aria-live="polite">
          {formatVietnameseCurrency(balance, true)}
        </div>
        <div class="spent-progress-info">
          <span>Bạn đã tiêu <strong>{formatVietnameseCurrency(totalSpent, true)}</strong></span>
          <span class="ratio-badge">{spentRatioFormatted}% ngân sách</span>
        </div>

        <!-- Thanh đo % đã tiêu -->
        <div class="progress-bar-bg" aria-hidden="true">
          <div class="progress-bar-fill" style="width: {Math.min(100, spentRatio)}%;"></div>
        </div>
      </div>

      <!-- Cụm nút công cụ: Căn giữa, Chia sẻ, Hoá đơn, Chuyển 3D/2D -->
      <div class="top-actions-cluster">
        {#if viewMode === '3d'}
          <button
            type="button"
            class="top-btn recenter-action"
            onclick={handleRecenter}
            title="Căn giữa góc nhìn sân khấu 3D"
          >
            🎯 Căn giữa
          </button>
        {/if}

        <button
          type="button"
          class="top-btn share-action"
          onclick={handleShare}
          title="Chia sẻ kết quả"
        >
          🔗 Chia sẻ
        </button>

        <button
          type="button"
          class="top-btn receipt-action"
          onclick={scrollToReceipt}
          title="Xem hoá đơn cuộn giấy"
        >
          🧾 Hoá đơn
        </button>

        <!-- Chuyển đổi linh hoạt giữa Sân khấu 3D và Lưới 2D -->
        <button
          type="button"
          class="top-btn toggle-view-btn"
          onclick={() => (viewMode = viewMode === '3d' ? '2d' : '3d')}
          title="Chuyển chế độ xem"
        >
          {viewMode === '3d' ? '📐 Xem thẻ 2D' : '🌐 Xem 3D'}
        </button>
      </div>
    </div>
  </header>

  <!-- KHÔNG GIAN CHƠI CHÍNH (Bố cục 2 cột Desktop / 2 hàng Mobile) -->
  <main class="game-main-layout">
    {#if viewMode === '3d'}
      <!-- CỘT GIỮA: SÂN KHẤU 3D ISOMETRIC -->
      <section class="stage-column" aria-label="Sân khấu 3D mô phỏng quy mô tài sản">
        <Stage3D
          bind:this={stage3dRef}
          {cart}
          {items}
          onSelectCard={handleSelectFrom3D}
        />
      </section>

      <!-- CỘT PHẢI: THANH MUA SẮM CUỘN DỌC -->
      <aside class="sidebar-column" aria-label="Thanh danh mục mua sắm vật phẩm">
        <ShopSidebar
          {items}
          {cart}
          {balance}
          {totalBudget}
          highlightedId={highlightedShopItemId}
          onBuy={handleBuy}
          onSell={handleSell}
        />
      </aside>
    {:else}
      <!-- CHẾ ĐỘ DỰ PHÒNG THẺ 2D TRUYỀN THỐNG -->
      <section class="fallback-2d-container" aria-label="Giao diện thẻ 2D">
        <div class="products-grid">
          {#each items as item (item.id)}
            <ItemCard
              {item}
              quantity={cart[item.id] || 0}
              {balance}
              {totalBudget}
              onBuy={handleBuy}
              onSell={handleSell}
            />
          {/each}
        </div>
      </section>
    {/if}
  </main>

  <!-- KHUNG THÔNG TIN SNAPSHOT & TUYÊN BỐ MIỄN TRỪ PHÁP LÝ -->
  <footer class="game-footer-info">
    <div class="footer-container">
      <div class="snapshot-details-card">
        <div class="snap-header">
          <strong>KHÁM PHÁ QUY MÔ TÀI CHÍNH</strong> — 1 ngày làm PNV
        </div>
        <div class="snap-metrics">
          <div class="metric">
            <span class="m-label">Ngân sách snapshot:</span>
            <span class="m-val">35,2 tỷ USD (Forbes 10/10/2026)</span>
          </div>
          <div class="metric">
            <span class="m-label">Tỷ giá Vietcombank:</span>
            <span class="m-val">25.660 VND/USD (29/10/2026)</span>
          </div>
          <div class="metric">
            <span class="m-label">Tổng quy đổi:</span>
            <span class="m-val highlight">{formatVietnameseNumber(totalBudget)} đ</span>
          </div>
        </div>
        <div class="disclaimer-text">
          ⚖️ <strong>Tuyên bố miễn trừ:</strong> Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới. Dữ liệu là con số ước tính công khai trên báo chí, không phản ánh dòng tiền mặt hay tài khoản cá nhân thực tế.
        </div>
      </div>

      <!-- HOÁ ĐƠN CUỘN GIẤY Ở CUỐI TRANG -->
      <div id="hoa-don" class="receipt-section">
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
    </div>
  </footer>

  <!-- THÔNG BÁO TOAST MỐC % (ĐÃ GỘP MỐC CAO NHẤT) -->
  <MilestoneToast
    milestones={activeMilestones}
    onDismiss={dismissMilestone}
  />

  <!-- TOAST BÁO SAO CHÉP CHIA SẺ -->
  {#if shareToast}
    <div class="share-toast-bubble" role="status">
      <span>{shareToast}</span>
    </div>
  {/if}
</div>

<style>
  .tieu-tien-page {
    min-height: 100vh;
    background: var(--color-bg, #faf8f5);
    display: flex;
    flex-direction: column;
  }

  /* THANH ĐỈNH ĐIỀU KHIỂN & SỐ DƯ KIỂU NEAL.FUN */
  .stage-top-bar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-border, #e6e1d9);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    padding: 0.85rem 1.25rem;
  }

  .top-bar-inner {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .balance-display-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 600px;
    margin: 0 auto;
  }

  .balance-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin-bottom: 0.15rem;
  }

  .balance-amount {
    font-size: 2.15rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #059669;
    line-height: 1.1;
  }

  .spent-progress-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #4b5563;
    margin-top: 0.25rem;
  }

  .ratio-badge {
    background: #ecfdf5;
    color: #059669;
    font-weight: 700;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.725rem;
  }

  .progress-bar-bg {
    width: 100%;
    height: 5px;
    background: #f0ebe4;
    border-radius: 999px;
    margin-top: 0.45rem;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 999px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .top-actions-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .top-btn {
    padding: 0.45rem 0.85rem;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .top-btn:hover {
    background: #f9fafb;
    border-color: #059669;
    color: #059669;
  }

  .recenter-action {
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
  }

  .recenter-action:hover {
    background: #d1fae5;
  }

  /* KHÔNG GIAN BỐ CỤC CHÍNH (SÂN KHẤU + THANH MUA SẮM) */
  .game-main-layout {
    flex: 1;
    max-width: 1440px;
    width: 100%;
    margin: 0 auto;
    padding: 1.25rem;
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 1.25rem;
    min-height: calc(100vh - 120px);
  }

  .stage-column {
    display: flex;
    flex-direction: column;
    min-height: 560px;
  }

  .sidebar-column {
    height: calc(100vh - 140px);
    position: sticky;
    top: 96px;
  }

  .fallback-2d-container {
    grid-column: 1 / -1;
    width: 100%;
  }

  .products-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.15rem;
  }

  /* PHẦN DƯỚI: SNAPSHOT & HOÁ ĐƠN */
  .game-footer-info {
    background: #ffffff;
    border-top: 1px solid var(--color-border, #e6e1d9);
    margin-top: 2rem;
    padding: 2.5rem 1.25rem 4rem;
  }

  .footer-container {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .snapshot-details-card {
    background: #faf8f5;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: var(--radius, 1rem);
    padding: 1.25rem 1.5rem;
  }

  .snap-header {
    font-size: 0.85rem;
    font-weight: 800;
    color: #1f1d1a;
    margin-bottom: 0.75rem;
    letter-spacing: 0.02em;
  }

  .snap-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid #e6e1d9;
    font-size: 0.825rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .m-label {
    font-size: 0.725rem;
    font-weight: 600;
    color: #6b7280;
  }

  .m-val {
    font-weight: 700;
    color: #1f1d1a;
  }

  .m-val.highlight {
    color: #059669;
  }

  .disclaimer-text {
    margin-top: 0.85rem;
    font-size: 0.775rem;
    line-height: 1.5;
    color: #6b7280;
  }

  .receipt-section {
    width: 100%;
  }

  .share-toast-bubble {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: #111827;
    color: #ffffff;
    padding: 0.65rem 1.25rem;
    border-radius: 999px;
    font-size: 0.825rem;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    z-index: 100;
    animation: popUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes popUp {
    from {
      opacity: 0;
      transform: translate(-50%, 10px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  /* RESPONSIVE TRÊN MOBILE & TABLET */
  @media (max-width: 1024px) {
    .game-main-layout {
      grid-template-columns: 1fr;
      padding: 0.75rem;
      gap: 1rem;
    }

    .stage-column {
      min-height: 48svh;
      height: 48svh;
    }

    .sidebar-column {
      height: 52svh;
      position: static;
    }

    .products-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .stage-top-bar {
      padding: 0.65rem 0.75rem;
    }

    .top-bar-inner {
      flex-direction: column;
      gap: 0.5rem;
    }

    .balance-amount {
      font-size: 1.65rem;
    }

    .top-actions-cluster {
      width: 100%;
      justify-content: center;
      gap: 0.35rem;
    }

    .top-btn {
      padding: 0.35rem 0.6rem;
      font-size: 0.725rem;
    }

    .products-grid {
      grid-template-columns: 1fr;
    }

    .snap-metrics {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
