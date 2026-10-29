<!-- src/explore/tieu-tien/TieuTien.svelte -->
<!-- Trò chơi "1 ngày làm PNV" — Sân khấu toàn màn hình 2.5D Sprite Isometric phong cách neal.fun -->

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
  import { getNewMilestonesGrouped } from './stage3d';
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
  let showReceiptModal = $state(false);

  // Trạng thái Mobile Bottom Sheet (mặc định 'half' ~45svh, 'expanded' ~82svh, 'collapsed' ~64px)
  let sheetState = $state<'half' | 'expanded' | 'collapsed'>('half');

  // Tham chiếu đến Sân khấu
  let stageRef = $state<any>(null);

  // Tính toán phái sinh
  const totalSpent = $derived(calculateTotalSpent(cart, items));
  const balance = $derived(calculateBalance(totalBudget, totalSpent));
  const breakdown = $derived(calculateCategoryBreakdown(cart, items));
  const spentRatio = $derived(totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0);
  const spentRatioFormatted = $derived(
    spentRatio >= 1 ? spentRatio.toFixed(1).replace('.0', '') : spentRatio.toFixed(3).replace(/\.?0+$/, '')
  );

  function handleBuy(item: VatPham, count: number) {
    const prevSpent = totalSpent;
    const res = buyItem(cart, item, count, balance, totalBudget);

    if (res.success && res.actualCount > 0) {
      cart = res.newCart;
      history = [...history, { itemId: item.id, count: res.actualCount, gia: item.gia }];
      deltaAmount = -res.cost;

      // Kích hoạt animation rơi nhẹ vào chỗ
      stageRef?.notifyItemBought?.(item.id);

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
    stageRef?.recenter?.();
  }

  function dismissMilestone(id: string) {
    activeMilestones = activeMilestones.filter((m) => m.id !== id);
  }

  function handleRecenter() {
    stageRef?.recenter?.();
  }

  function handleShare() {
    const shareText = `Tôi đã tiêu ${formatVietnameseCurrency(totalSpent, true)} trên ngân sách ${formatVietnameseCurrency(totalBudget, true)} tại trò chơi "1 ngày làm PNV"!`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: '1 ngày làm PNV — Sân khấu Sprite Isometric',
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

  function handleOpenReceipt() {
    if (viewMode === '3d') {
      showReceiptModal = true;
    } else {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('hoa-don-2d');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function handleCloseReceipt() {
    showReceiptModal = false;
  }

  function handleSelectFromStage(itemId: string) {
    highlightedShopItemId = itemId;
    // Trên mobile, mở panel lên nếu đang collapsed
    if (sheetState === 'collapsed') {
      sheetState = 'half';
    }
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
    }, 2200);
  }

  function toggleSheetState() {
    if (sheetState === 'half') {
      sheetState = 'expanded';
    } else if (sheetState === 'expanded') {
      sheetState = 'collapsed';
    } else {
      sheetState = 'half';
    }
  }
</script>

<div class="tieu-tien-app {viewMode === '3d' ? 'mode-fullscreen-3d' : 'mode-cards-2d'}">
  {#if viewMode === '3d'}
    <!-- ========================================== -->
    <!-- CHẾ ĐỘ 1: TOÀN MÀN HÌNH 2.5D SPRITE NEAL.FUN -->
    <!-- ========================================== -->
    <div class="stage-viewport-area">
      <!-- SÂN KHẤU 2.5D SPRITE ISOMETRIC -->
      <Stage3D
        bind:this={stageRef}
        {cart}
        {items}
        onSelectCard={handleSelectFromStage}
      />

      <!-- NÚT TRANG CHỦ GÓC TRÊN TRÁI -->
      <a href="/" class="floating-btn home-corner-btn" title="Quay về Trang chủ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>Trang chủ</span>
      </a>

      <!-- OVERLAY TRUNG TÂM TRÊN: SỐ DƯ & BẠN ĐÃ TIÊU -->
      <div class="top-overlay-center" role="region" aria-label="Bảng số dư nổi">
        <div class="balance-pill-card">
          <div class="balance-sub-label">SỐ DƯ CÒN LẠI</div>
          <div class="balance-big-val" aria-live="polite">
            {formatVietnameseCurrency(balance, true)}
          </div>
          <div class="spent-info-row">
            <span>Bạn đã tiêu <strong>{formatVietnameseCurrency(totalSpent, true)}</strong></span>
            <span class="ratio-chip">{spentRatioFormatted}%</span>
          </div>

          <!-- Thanh tiến trình % -->
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" style="width: {Math.min(100, spentRatio)}%;"></div>
          </div>
        </div>
      </div>

      <!-- CỤM NÚT CÔNG CỤ NỔI GÓC TRÊN PHẢI SÂN KHẤU -->
      <div class="top-overlay-right" role="toolbar" aria-label="Thanh công cụ sân khấu">
        <button
          type="button"
          class="floating-btn action-btn recenter-btn"
          onclick={handleRecenter}
          title="Căn giữa toàn bộ mô hình (Fit)"
        >
          🎯 Căn giữa
        </button>

        <button
          type="button"
          class="floating-btn action-btn"
          onclick={handleShare}
          title="Chia sẻ kết quả"
        >
          🔗 Chia sẻ
        </button>

        <button
          type="button"
          class="floating-btn action-btn receipt-btn"
          onclick={handleOpenReceipt}
          title="Xem hoá đơn cuộn giấy"
        >
          🧾 Hoá đơn
        </button>

        <button
          type="button"
          class="floating-btn action-btn view-toggle-btn"
          onclick={() => (viewMode = '2d')}
          title="Chuyển sang chế độ xem thẻ 2D"
        >
          📐 <span class="desktop-only-txt">Xem thẻ </span>2D
        </button>
      </div>
    </div>

    <!-- THANH MUA SẮM PANEL CỐ ĐỊNH BÊN PHẢI (DESKTOP) / BOTTOM SHEET (MOBILE) -->
    <aside
      class="shop-panel-wrapper sheet-{sheetState}"
      aria-label="Bảng điều khiển danh mục mua sắm"
    >
      <!-- Grab handle chỉ hiện trên mobile -->
      <button
        type="button"
        class="sheet-grab-handle-bar"
        onclick={toggleSheetState}
        aria-label="Kéo lên/xuống thanh mua sắm"
      >
        <span class="sheet-grab-pill"></span>
      </button>

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

    <!-- MODAL HOÁ ĐƠN NỔI (KHI Ở CHẾ ĐỘ 3D) -->
    {#if showReceiptModal}
      <div class="modal-backdrop" onclick={handleCloseReceipt} role="presentation">
        <div
          class="receipt-modal-window"
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Hoá đơn chi tiết"
        >
          <div class="modal-header">
            <h2 class="modal-title">🧾 Hoá đơn chi tiêu</h2>
            <button
              type="button"
              class="modal-close-btn"
              onclick={handleCloseReceipt}
              aria-label="Đóng hoá đơn"
            >
              ✕
            </button>
          </div>

          <div class="modal-body-scroll">
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

            <div class="disclaimer-in-modal">
              ⚖️ <strong>Tuyên bố miễn trừ:</strong> Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới. Dữ liệu là con số ước tính công khai trên báo chí, không phản ánh dòng tiền mặt hay tài khoản cá nhân thực tế.
            </div>
          </div>
        </div>
      </div>
    {/if}

  {:else}
    <!-- ========================================== -->
    <!-- CHẾ ĐỘ 2: XEM THẺ 2D TRUYỀN THỐNG GIỮ NGUYÊN -->
    <!-- ========================================== -->
    <header class="header-2d-bar">
      <div class="header-2d-inner">
        <a href="/" class="floating-btn home-btn">
          ← Trang chủ
        </a>

        <div class="balance-2d-block">
          <div class="bal-label">SỐ DƯ CÒN LẠI</div>
          <div class="bal-val">{formatVietnameseCurrency(balance, true)}</div>
        </div>

        <div class="actions-2d-group">
          <button
            type="button"
            class="floating-btn view-toggle-btn"
            onclick={() => (viewMode = '3d')}
            title="Quay lại sân khấu 3D"
          >
            🌐 Xem 3D
          </button>
          <button
            type="button"
            class="floating-btn"
            onclick={handleShare}
          >
            🔗 Chia sẻ
          </button>
        </div>
      </div>
    </header>

    <main class="content-2d-container">
      <div class="products-grid-2d">
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

      <!-- HOÁ ĐƠN DƯỚI LƯỚI THẺ 2D -->
      <div id="hoa-don-2d" class="receipt-section-2d">
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

      <!-- FOOTER THÔNG TIN & MIỄN TRỪ PHÁP LÝ -->
      <footer class="footer-2d-notes">
        <div class="disclaimer-text-2d">
          ⚖️ <strong>Tuyên bố miễn trừ:</strong> Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới. Dữ liệu là con số ước tính công khai trên báo chí, không phản ánh dòng tiền mặt hay tài khoản cá nhân thực tế.
        </div>
        <p class="source-item-2d">
          <strong>Ngân sách mô phỏng:</strong> Ước tính tài sản ròng 35,2 tỷ USD theo Forbes ghi nhận ngày 10/10/2026. Tỷ giá quy đổi 25.660 VND/USD (Vietcombank 29/10/2026).
        </p>
      </footer>
    </main>
  {/if}

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
  /* GỐC CẢ ỨNG DỤNG */
  .tieu-tien-app {
    width: 100vw;
    min-height: 100svh;
    background: #faf8f5;
    overflow-x: hidden;
    position: relative;
    box-sizing: border-box;
    font-family: inherit;
  }

  /* --- BỐ CỤC TOÀN MÀN HÌNH 3D (CHẾ ĐỘ CHÍNH) --- */
  .mode-fullscreen-3d {
    width: 100vw;
    height: 100svh;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  /* Sân khấu chiếm toàn bộ không gian bên trái panel mua sắm */
  .stage-viewport-area {
    position: absolute;
    top: 0;
    left: 0;
    right: 380px;
    bottom: 0;
    height: 100svh;
    overflow: hidden;
    background: #faf8f5;
  }

  /* NÚT GÓC TRÊN TRÁI: QUAY LẠI TRANG CHỦ */
  .home-corner-btn {
    position: absolute;
    top: 0.85rem;
    left: 1rem;
    z-index: 25;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #374151;
  }

  /* OVERLAY SỐ DƯ & BẠN ĐÃ TIÊU NỔI Ở GIỮA TRÊN */
  .top-overlay-center {
    position: absolute;
    top: 0.85rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 25;
    pointer-events: none;
    width: auto;
    min-width: 260px;
    max-width: 380px;
  }

  .balance-pill-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(226, 222, 212, 0.95);
    border-radius: 1.15rem;
    padding: 0.5rem 1.15rem 0.65rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    pointer-events: auto;
  }

  .balance-sub-label {
    font-size: 0.625rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin-bottom: 0.1rem;
  }

  .balance-big-val {
    font-size: 1.65rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #059669;
    line-height: 1.15;
  }

  .spent-info-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.75rem;
    color: #4b5563;
    margin-top: 0.15rem;
  }

  .ratio-chip {
    background: #ecfdf5;
    color: #059669;
    font-weight: 800;
    padding: 0.08rem 0.4rem;
    border-radius: 999px;
    font-size: 0.675rem;
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: #f0ebe4;
    border-radius: 999px;
    margin-top: 0.35rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 999px;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* CỤM NÚT NỔI GÓC TRÊN PHẢI SÂN KHẤU */
  .top-overlay-right {
    position: absolute;
    top: 0.85rem;
    right: 1rem;
    z-index: 25;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .floating-btn {
    padding: 0.4rem 0.75rem;
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(8px);
    border: 1px solid #e2ded4;
    border-radius: 0.6rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #374151;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: all 0.15s ease;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .floating-btn:hover {
    background: #ffffff;
    border-color: #059669;
    color: #059669;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  .recenter-btn {
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
  }

  .recenter-btn:hover {
    background: #d1fae5;
  }

  .receipt-btn {
    font-weight: 800;
  }

  /* THANH MUA SẮM PANEL CỐ ĐỊNH BÊN PHẢI */
  .shop-panel-wrapper {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 380px;
    height: 100svh;
    background: #ffffff;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.06);
    z-index: 30;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sheet-grab-handle-bar {
    display: none;
    width: 100%;
    padding: 0.5rem 0 0.35rem;
    background: #ffffff;
    border: none;
    cursor: pointer;
    align-items: center;
    justify-content: center;
  }

  .sheet-grab-pill {
    width: 38px;
    height: 4px;
    background: #d1d5db;
    border-radius: 999px;
  }

  /* MODAL HOÁ ĐƠN NỔI */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(17, 24, 39, 0.45);
    backdrop-filter: blur(4px);
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    animation: fadeIn 0.15s ease;
  }

  .receipt-modal-window {
    background: #ffffff;
    border-radius: 1.25rem;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 620px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: popModal 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f0ebe4;
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #1f1d1a;
    margin: 0;
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #f3efe8;
    border: none;
    font-size: 1rem;
    font-weight: 700;
    color: #6b7280;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .modal-close-btn:hover {
    background: #e5e0d6;
    color: #111827;
  }

  .modal-body-scroll {
    overflow-y: auto;
    padding: 1.25rem 1.5rem 2rem;
  }

  .disclaimer-in-modal {
    margin-top: 1.5rem;
    padding: 0.85rem 1rem;
    background: #faf8f5;
    border: 1px solid #e6e1d9;
    border-radius: 0.75rem;
    font-size: 0.75rem;
    line-height: 1.5;
    color: #6b7280;
  }

  /* --- CHẾ ĐỘ 2: THẺ 2D TRUYỀN THỐNG --- */
  .mode-cards-2d {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header-2d-bar {
    position: sticky;
    top: 0;
    z-index: 40;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid #e6e1d9;
    padding: 0.85rem 1.5rem;
  }

  .header-2d-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .balance-2d-block {
    text-align: center;
  }

  .bal-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6b7280;
  }

  .bal-val {
    font-size: 1.85rem;
    font-weight: 900;
    color: #059669;
  }

  .actions-2d-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .content-2d-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  .products-grid-2d {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
  }

  .receipt-section-2d {
    margin-top: 2.5rem;
    display: flex;
    justify-content: center;
  }

  .footer-2d-notes {
    margin-top: 3rem;
    padding: 1.5rem;
    background: #ffffff;
    border: 1px solid #e6e1d9;
    border-radius: 1rem;
    font-size: 0.8rem;
    line-height: 1.6;
    color: #6b7280;
  }

  .disclaimer-text-2d {
    margin-bottom: 0.5rem;
    color: #1f1d1a;
  }

  .source-item-2d {
    margin: 0.25rem 0 0;
  }

  /* TOAST THÔNG BÁO SAO CHÉP */
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
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
    z-index: 100;
    animation: popUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes popModal {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes popUp {
    from { opacity: 0; transform: translate(-50%, 10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  @media (max-width: 1200px) {
    .desktop-only-txt {
      display: none;
    }
  }

  /* RESPONSIVE MOBILE & TABLET */
  @media (max-width: 1024px) {
    .stage-viewport-area {
      right: 0;
      height: 100svh;
    }

    .shop-panel-wrapper {
      left: 0;
      right: 0;
      width: 100%;
      top: auto;
      border-radius: 1.5rem 1.5rem 0 0;
      box-shadow: 0 -6px 25px rgba(0, 0, 0, 0.12);
      transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 40;
    }

    .shop-panel-wrapper.sheet-half {
      height: 45svh;
      bottom: 0;
    }

    .shop-panel-wrapper.sheet-expanded {
      height: 82svh;
      bottom: 0;
    }

    .shop-panel-wrapper.sheet-collapsed {
      height: 52px;
      bottom: 0;
    }

    .sheet-grab-handle-bar {
      display: flex;
    }

    .top-overlay-center {
      top: 0.5rem;
      max-width: 360px;
    }

    .balance-big-val {
      font-size: 1.45rem;
    }

    .top-overlay-right {
      top: 0.65rem;
      right: 0.65rem;
      gap: 0.35rem;
    }

    .floating-btn {
      padding: 0.35rem 0.55rem;
      font-size: 0.7rem;
    }

    .home-corner-btn {
      top: 0.65rem;
      left: 0.65rem;
      padding: 0.35rem 0.55rem;
    }

    .products-grid-2d {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 640px) {
    .home-corner-btn span {
      display: none;
    }

    .recenter-btn {
      display: none;
    }

    .top-overlay-center {
      width: 70%;
    }

    .balance-pill-card {
      padding: 0.45rem 0.75rem;
    }

    .balance-big-val {
      font-size: 1.25rem;
    }

    .products-grid-2d {
      grid-template-columns: 1fr;
    }
  }
</style>
