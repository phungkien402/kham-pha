<script lang="ts">
  import type { VatPham, GioHang, ThongKeNhom } from './types';
  import {
    formatVietnameseCurrency,
    formatVietnameseNumber,
  } from './logic';
  import { exportReceiptImage } from './exportImage';

  interface Props {
    cart: GioHang;
    items: VatPham[];
    totalBudget: number;
    totalSpent: number;
    balance: number;
    breakdown: ThongKeNhom[];
    canUndo: boolean;
    onUndo: () => void;
    onReset: () => void;
  }

  let {
    cart,
    items,
    totalBudget,
    totalSpent,
    balance,
    breakdown,
    canUndo,
    onUndo,
    onReset,
  }: Props = $props();

  let isExporting = $state(false);

  const itemMap = $derived(new Map(items.map((it) => [it.id, it])));
  const boughtItems = $derived(
    Object.entries(cart)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => {
        const item = itemMap.get(id)!;
        return {
          item,
          count,
          total: count * (item ? item.gia : 0),
        };
      })
      .sort((a, b) => b.total - a.total)
  );

  const isCompleted = $derived(balance === 0 || (balance < 4000 && boughtItems.length > 0));

  async function handleExport() {
    isExporting = true;
    try {
      await exportReceiptImage({
        cart,
        items,
        totalBudget,
        totalSpent,
        balance,
        breakdown,
      });
    } finally {
      isExporting = false;
    }
  }
</script>

<section id="hoa-don" class="receipt-section">
  <div class="receipt-paper">
    <!-- Mép răng cưa trên -->
    <div class="sawtooth-top"></div>

    <div class="receipt-inner">
      <div class="receipt-header">
        <span class="receipt-tag">BẢN TỔNG KẾT MÔ PHỎNG</span>
        <h2 class="receipt-title">HOÁ ĐƠN CHI TIÊU</h2>
        <p class="receipt-meta">1 NGÀY LÀM PNV · 35,2 TỶ USD</p>
        <div class="receipt-divider-dash"></div>
      </div>

      {#if isCompleted}
        <div class="soft-ending-card">
          <div class="ending-badge">🎉 BẠN ĐÃ TIÊU HẾT TOÀN BỘ NGÂN SÁCH</div>
          <p class="ending-text">
            Số dư đã về 0. Bạn đã trải nghiệm phân bổ 35,2 tỷ USD theo nhiều quy mô khác nhau từ đồ dùng hàng ngày tới các đại công trình!
          </p>
        </div>
      {/if}

      <!-- Danh sách món đã mua -->
      <div class="receipt-items-table">
        <div class="table-header">
          <span class="col-name">Món</span>
          <span class="col-qty">SL</span>
          <span class="col-price">Thành tiền</span>
        </div>

        {#if boughtItems.length === 0}
          <div class="empty-cart-note">
            Bạn chưa chọn món nào. Hãy bấm <strong>+ Mua</strong> ở trên để bắt đầu!
          </div>
        {:else}
          <div class="table-body">
            {#each boughtItems as entry (entry.item.id)}
              <div class="table-row">
                <div class="col-name">
                  <span class="item-emoji">{entry.item.emoji}</span>
                  <span class="item-name">{entry.item.ten}</span>
                </div>
                <div class="col-qty">
                  x{formatVietnameseNumber(entry.count)}
                </div>
                <div class="col-price">
                  {formatVietnameseCurrency(entry.total, true)}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="receipt-divider-dash"></div>

      <!-- Tổng kết tài chính -->
      <div class="financial-summary">
        <div class="summary-line">
          <span>Tổng ngân sách ban đầu:</span>
          <strong>{formatVietnameseCurrency(totalBudget, true)}</strong>
        </div>
        <div class="summary-line highlight-spent">
          <span>Tổng số tiền đã chi:</span>
          <strong class="spent-text">−{formatVietnameseCurrency(totalSpent, true)}</strong>
        </div>
        <div class="summary-line highlight-balance">
          <span>Số dư còn lại:</span>
          <strong class="balance-text">{formatVietnameseCurrency(balance, true)}</strong>
        </div>
      </div>

      <div class="receipt-divider-dash"></div>

      <!-- Cơ cấu chi tiêu theo 4 nhóm -->
      <div class="breakdown-box">
        <h3 class="breakdown-title">Cơ cấu phân bổ theo nhóm</h3>
        <div class="breakdown-list">
          {#each breakdown as group (group.nhom)}
            <div class="breakdown-row">
              <div class="breakdown-info">
                <span class="group-name">{group.tenNhom}</span>
                <span class="group-pct">{group.tyLe}%</span>
              </div>
              <div class="breakdown-bar-track">
                <div class="breakdown-bar-fill" style="width: {group.tyLe}%;"></div>
              </div>
              <div class="group-amount">
                {formatVietnameseCurrency(group.tongTien, true)}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="receipt-divider-dash"></div>

      <!-- Dòng miễn trừ bắt buộc -->
      <div class="receipt-disclaimer">
        <p>
          ⚖️ <strong>Tuyên bố miễn trừ:</strong> Trò chơi minh hoạ độc lập, không liên kết/tài trợ/đại diện cho cá nhân hay doanh nghiệp được nhắc tới.
        </p>
      </div>

      <!-- Cụm nút hành động -->
      <div class="receipt-actions">
        {#if canUndo}
          <button
            type="button"
            class="action-btn undo-btn"
            onclick={onUndo}
            title="Hoàn tác món cuối cùng vừa mua"
          >
            ↩ Hoàn tác món cuối
          </button>
        {/if}

        <button
          type="button"
          class="action-btn export-btn"
          onclick={handleExport}
          disabled={isExporting || boughtItems.length === 0}
          title="Tải ảnh hoá đơn 1200×630 PNG hoặc chia sẻ"
        >
          {isExporting ? 'Đang tạo ảnh…' : '📷 Tải hoá đơn (PNG) / Chia sẻ'}
        </button>

        <button
          type="button"
          class="action-btn reset-btn"
          onclick={onReset}
          title="Xoá hết và chơi lại từ đầu"
        >
          🔄 Chơi lại từ đầu
        </button>
      </div>
    </div>

    <!-- Mép răng cưa dưới -->
    <div class="sawtooth-bottom"></div>
  </div>
</section>

<style>
  .receipt-section {
    margin-top: 3.5rem;
    display: flex;
    justify-content: center;
    padding-bottom: 2rem;
  }

  .receipt-paper {
    position: relative;
    max-width: 600px;
    width: 100%;
    background: #ffffff;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.05));
  }

  /* Răng cưa SVG sắc nét */
  .sawtooth-top,
  .sawtooth-bottom {
    width: 100%;
    height: 12px;
    background-size: 16px 12px;
    background-repeat: repeat-x;
  }

  .sawtooth-top {
    background-image: radial-gradient(circle at 8px -4px, transparent 8px, #ffffff 9px);
  }

  .sawtooth-bottom {
    background-image: radial-gradient(circle at 8px 16px, transparent 8px, #ffffff 9px);
  }

  .receipt-inner {
    padding: 2rem 2rem 1.5rem;
  }

  .receipt-header {
    text-align: center;
    margin-bottom: 1.25rem;
  }

  .receipt-tag {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #059669;
    background: #ecfdf5;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.35rem;
  }

  .receipt-title {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--color-text, #1f1d1a);
    margin: 0;
  }

  .receipt-meta {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted, #6b665f);
    margin: 0.25rem 0 0;
  }

  .receipt-divider-dash {
    margin: 1.25rem 0;
    border-top: 2px dashed #d6d0c7;
  }

  .soft-ending-card {
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 0.75rem;
    padding: 1rem;
    text-align: center;
    margin-bottom: 1.25rem;
  }

  .ending-badge {
    font-size: 0.85rem;
    font-weight: 800;
    color: #065f46;
    margin-bottom: 0.35rem;
  }

  .ending-text {
    font-size: 0.8rem;
    color: #047857;
    line-height: 1.5;
    margin: 0;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-muted, #6b665f);
    border-bottom: 1px solid #e6e1d9;
    padding-bottom: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .table-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.85rem;
    padding: 0.35rem 0;
  }

  .col-name {
    flex: 2;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .item-emoji {
    flex-shrink: 0;
  }

  .item-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-qty {
    flex: 0.8;
    text-align: center;
    color: var(--color-text-muted, #6b665f);
    font-size: 0.8rem;
  }

  .col-price {
    flex: 1.4;
    text-align: right;
    font-weight: 700;
    color: var(--color-text, #1f1d1a);
  }

  .empty-cart-note {
    text-align: center;
    padding: 1.5rem 0;
    font-size: 0.85rem;
    color: var(--color-text-muted, #6b665f);
  }

  .financial-summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .summary-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .spent-text {
    color: #dc2626;
    font-size: 1.05rem;
  }

  .balance-text {
    color: #059669;
    font-size: 1.15rem;
  }

  .breakdown-box {
    margin-top: 0.5rem;
  }

  .breakdown-title {
    font-size: 0.85rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    color: var(--color-text, #1f1d1a);
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .breakdown-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.2rem;
  }

  .group-pct {
    color: #059669;
  }

  .breakdown-bar-track {
    width: 100%;
    height: 6px;
    background: #f3efe8;
    border-radius: 3px;
    overflow: hidden;
  }

  .breakdown-bar-fill {
    height: 100%;
    background: #10b981;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .group-amount {
    font-size: 0.75rem;
    color: var(--color-text-muted, #6b665f);
    text-align: right;
    margin-top: 0.15rem;
  }

  .receipt-disclaimer {
    background: #faf8f5;
    border: 1px solid #e6e1d9;
    border-radius: 0.5rem;
    padding: 0.65rem 0.85rem;
    font-size: 0.75rem;
    line-height: 1.45;
    color: #524d46;
  }

  .receipt-actions {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-top: 1.5rem;
  }

  .action-btn {
    width: 100%;
    padding: 0.85rem 1rem;
    border-radius: 0.75rem;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
  }

  .undo-btn {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }

  .undo-btn:hover {
    background: #fde68a;
  }

  .export-btn {
    background: #059669;
    color: #ffffff;
  }

  .export-btn:not(:disabled):hover {
    background: #047857;
    transform: translateY(-1px);
  }

  .export-btn:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }

  .reset-btn {
    background: transparent;
    border: 1px solid #e6e1d9;
    color: var(--color-text-muted, #6b665f);
  }

  .reset-btn:hover {
    background: #f3efe8;
    color: var(--color-text, #1f1d1a);
  }

  @media (max-width: 640px) {
    .receipt-inner {
      padding: 1.5rem 1rem 1rem;
    }
  }
</style>
