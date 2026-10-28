<script lang="ts">
  interface Props {
    /**
     * Biến thể bố cục:
     * - 'card': Ô cuối lưới Đang nở (#1)
     * - 'row': Thiệp ngang dưới danh sách điểm ngắm (#2)
     * - 'overlay': Thiệp nổi đè lên khung màu Carousel khi chưa có ảnh (#3)
     * - 'tile': Ô tỉ lệ 4/3 cuối lưới ApprovedPhotos (#4)
     * - 'thanks': Hộp thông báo cảm ơn sau khi gửi form thành công (#6, render <div> thay vì <a>)
     */
    variant: 'card' | 'row' | 'overlay' | 'tile' | 'thanks';
    /** Đường dẫn đích (dùng cho 'card' | 'row' | 'overlay' | 'tile'). */
    href?: string;
    /** Loại biểu tượng trên con tem. */
    stamp?: 'flower' | 'pin' | 'camera' | 'none';
    /** Màu loài hoa (#RRGGBB) khi ở trang loài; để trống ở trang chính để dùng tem vàng. */
    color?: string;
    /** Chữ trong dấu bưu điện tròn (vd: "THÁNG 10\n2026" hoặc "ĐÃ GỬI\n28·10"). */
    postmark?: string;
    /** Dòng mở đầu nhỏ nghiêng phía trên tiêu đề. */
    kicker?: string;
    /** Câu tiêu đề chính in đậm. */
    title: string;
    /** Câu mô tả phụ. */
    body?: string;
    /** Nhãn nút / liên kết hành động. */
    cta?: string;
  }

  let {
    variant,
    href = '#',
    stamp = variant === 'thanks' ? 'none' : 'flower',
    color = '',
    postmark = '',
    kicker = '',
    title,
    body = '',
    cta = '',
  }: Props = $props();

  type Rgb = [number, number, number];

  function parseHex(hex: string): Rgb | null {
    const clean = hex.trim().replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }

  function toHex([r, g, b]: Rgb): string {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    return (
      '#' +
      [clamp(r), clamp(g), clamp(b)]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  function mixRgb(a: Rgb, b: Rgb, weightA: number): Rgb {
    const w = Math.max(0, Math.min(1, weightA));
    return [
      a[0] * w + b[0] * (1 - w),
      a[1] * w + b[1] * (1 - w),
      a[2] * w + b[2] * (1 - w),
    ];
  }

  function relLuminance([r, g, b]: Rgb): number {
    const chan = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  }

  function contrastRatio(a: Rgb, b: Rgb): number {
    const l1 = relLuminance(a);
    const l2 = relLuminance(b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  const stampPalette = $derived.by(() => {
    const rgb = color ? parseHex(color) : null;
    if (!rgb) {
      // Trang chính & mặc định: tem vàng như mockup, icon đảm bảo tương phản >= 3:1
      return {
        bg: '#f3e7c4',
        border: '#c9b98a',
        icon: '#705614',
      };
    }

    const paper: Rgb = [253, 250, 243]; // #fdfaf3
    const neutralBorder: Rgb = [217, 209, 197];
    // Nền tem = màu loài pha nhạt ~25%
    const bgRgb = mixRgb(rgb, paper, 0.25);
    const borderRgb = mixRgb(rgb, neutralBorder, 0.48);

    // Icon = màu loài đậm, đảm bảo tương phản với nền tem >= 3:1 (mục tiêu >= 3.2:1)
    let iconRgb: Rgb = [rgb[0] * 0.85, rgb[1] * 0.85, rgb[2] * 0.85];
    let step = 0;
    while (contrastRatio(bgRgb, iconRgb) < 3.2 && step < 20) {
      iconRgb = [iconRgb[0] * 0.88, iconRgb[1] * 0.88, iconRgb[2] * 0.88];
      step++;
    }

    return {
      bg: toHex(bgRgb),
      border: toHex(borderRgb),
      icon: toHex(iconRgb),
    };
  });

  // Kicker dùng màu #842d56 (hồng tím) cho tem máy ảnh / trang loài, #705614 (vàng nâu) cho tem vàng
  const kickerColor = $derived(
    stamp === 'camera' || variant === 'overlay' || Boolean(color) ? '#842d56' : '#705614',
  );

  const postmarkLines = $derived(
    postmark
      ? postmark
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
</script>

{#snippet stampBox()}
  {#if stamp !== 'none'}
    <div
      class="pc-stamp"
      style:background={stampPalette.bg}
      style:border-color={stampPalette.border}
      style:color={stampPalette.icon}
      aria-hidden="true"
    >
      {#if stamp === 'flower'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <circle cx="12" cy="12" r="2.4"></circle>
          <path
            d="M12 9.6c0-3 1.6-5 0-6.6-1.6 1.6 0 3.6 0 6.6zM12 14.4c0 3-1.6 5 0 6.6 1.6-1.6 0-3.6 0-6.6zM9.6 12c-3 0-5-1.6-6.6 0 1.6 1.6 3.6 0 6.6 0zM14.4 12c3 0 5 1.6 6.6 0-1.6-1.6-3.6 0-6.6 0z"
          ></path>
        </svg>
      {:else if stamp === 'pin'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"></path>
          <circle cx="12" cy="9.5" r="2.5"></circle>
        </svg>
      {:else if stamp === 'camera'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="3" y="7" width="18" height="13" rx="2"></rect>
          <circle cx="12" cy="13.5" r="3.5"></circle>
          <path d="M8 7l1.5-3h5L16 7"></path>
        </svg>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet postmarkBadge()}
  {#if postmarkLines.length > 0}
    <div class="pc-postmark" aria-hidden="true">
      {#each postmarkLines as line, idx}
        {#if idx > 0}<br />{/if}{line}
      {/each}
    </div>
  {/if}
{/snippet}

{#if variant === 'thanks'}
  <div class="pc pc-thanks" role="status">
    {@render postmarkBadge()}
    {#if kicker}
      <p class="pc-kicker" style:color={kickerColor}>{kicker}</p>
    {/if}
    <p class="pc-title">{title}</p>
    {#if body}
      <p class="pc-body">{body}</p>
    {/if}
  </div>
{:else if variant === 'row'}
  <a class="pc pc-row" {href}>
    {@render stampBox()}
    <div class="pc-row-content">
      <p class="pc-title">{title}</p>
      {#if body}
        <p class="pc-body">{body}</p>
      {/if}
    </div>
    {#if cta}
      <span class="pc-pill">
        {cta}
        <span class="pc-arrow" aria-hidden="true">→</span>
      </span>
    {/if}
  </a>
{:else if variant === 'tile'}
  <a class="pc pc-tile" {href}>
    {@render stampBox()}
    <p class="pc-title">{title}</p>
    {#if body}
      <p class="pc-body">{body}</p>
    {/if}
    {#if cta}
      <span class="pc-link">
        {cta}
        <span class="pc-arrow" aria-hidden="true">→</span>
      </span>
    {/if}
  </a>
{:else}
  <a class="pc pc-{variant}" {href}>
    {@render stampBox()}
    {@render postmarkBadge()}
    <div class="pc-top">
      {#if kicker}
        <p class="pc-kicker" style:color={kickerColor}>{kicker}</p>
      {/if}
      <p class="pc-title">{title}</p>
      {#if body}
        <p class="pc-body">{body}</p>
      {/if}
    </div>
    {#if cta}
      <span class="pc-pill">
        {cta}
        <span class="pc-arrow" aria-hidden="true">→</span>
      </span>
    {/if}
  </a>
{/if}

<style>
  .pc {
    position: relative;
    box-sizing: border-box;
    background: #fdfaf3;
    border: 1.5px dashed #b9b2a5;
    border-radius: 16px;
    color: #1f1d1a;
    text-decoration: none;
  }

  a.pc:focus-visible {
    outline: 3px solid var(--color-text, #1f1d1a);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: no-preference) {
    a.pc {
      transition:
        transform 0.2s ease,
        border-color 0.2s ease;
    }
    a.pc:hover {
      transform: rotate(-1deg);
      border-color: #8a8378;
    }
    a.pc.pc-overlay:hover {
      transform: rotate(-0.5deg);
    }
  }

  .pc-stamp {
    border: 2px dotted #c9b98a;
    border-radius: 4px;
    background: #f3e7c4;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex: none;
  }

  .pc-postmark {
    position: absolute;
    border: 1.5px solid rgba(138, 131, 120, 0.45);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(110, 104, 96, 0.78);
    text-align: center;
    line-height: 1.2;
    pointer-events: none;
    user-select: none;
  }

  .pc-kicker {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    font-style: italic;
    line-height: 1.35;
  }

  .pc-title {
    margin: 0;
    font-weight: 700;
    color: #1f1d1a;
    line-height: 1.3;
  }

  .pc-body {
    margin: 0;
    color: #6b665f;
    line-height: 1.48;
  }

  .pc-pill {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 16px;
    border-radius: 999px;
    background: #1f1d1a;
    color: #fff;
    font-weight: 600;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .pc-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 0.875rem;
    color: #1f1d1a;
    text-decoration: underline;
  }

  /* 1. Variant: card (Ô cuối lưới Đang nở) */
  .pc-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 14px;
    height: 100%;
    padding: 20px;
    overflow: hidden;
  }
  .pc-card .pc-stamp {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 54px;
    height: 64px;
  }
  .pc-card .pc-stamp svg {
    width: 28px;
    height: 28px;
  }
  .pc-card .pc-postmark {
    top: 56px;
    right: 52px;
    width: 64px;
    height: 64px;
    transform: rotate(-14deg);
  }
  .pc-card .pc-top {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pc-card .pc-kicker,
  .pc-card .pc-title {
    padding-right: 104px;
  }
  .pc-card .pc-title {
    font-size: 1.0625rem;
  }
  .pc-card .pc-body {
    font-size: 0.875rem;
  }

  /* 2. Variant: row (Dưới danh sách điểm ngắm) */
  .pc-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 18px;
    padding: 18px 20px;
    margin-top: var(--space-3, 12px);
  }
  .pc-row .pc-stamp {
    width: 46px;
    height: 54px;
  }
  .pc-row .pc-stamp svg {
    width: 24px;
    height: 24px;
  }
  .pc-row-content {
    flex: 1 1 180px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pc-row .pc-title {
    font-size: 1rem;
  }
  .pc-row .pc-body {
    font-size: 0.875rem;
  }
  .pc-row .pc-pill {
    align-self: center;
    flex: none;
  }

  /* 3. Variant: overlay (Đè lên khung màu đầu trang loài chưa có ảnh) */
  .pc-overlay {
    width: min(calc(100% - 24px), 340px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(31, 29, 26, 0.18);
    transform: rotate(-1.5deg);
    z-index: 1;
  }
  .pc-overlay .pc-stamp {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 44px;
    height: 52px;
    transform: rotate(4deg);
  }
  .pc-overlay .pc-stamp svg {
    width: 22px;
    height: 22px;
  }
  .pc-overlay .pc-top {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pc-overlay .pc-kicker,
  .pc-overlay .pc-title {
    padding-right: 54px;
  }
  .pc-overlay .pc-title {
    font-size: 1.125rem;
  }
  .pc-overlay .pc-body {
    font-size: 0.875rem;
  }

  /* 4. Variant: tile (Ô cuối lưới mục Ảnh trang loài) */
  .pc-tile {
    width: 100%;
    aspect-ratio: 4 / 3;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: 16px;
    border-radius: 14px;
    overflow: hidden;
  }
  .pc-tile .pc-stamp {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 32px;
    height: 38px;
    border-radius: 3px;
  }
  .pc-tile .pc-stamp svg {
    width: 16px;
    height: 16px;
  }
  .pc-tile .pc-title {
    font-size: 1rem;
    padding-right: 38px;
  }
  .pc-tile .pc-body {
    font-size: 0.8125rem;
    line-height: 1.42;
  }

  /* 6. Variant: thanks (Sau khi gửi form) */
  .pc-thanks {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 24px;
    overflow: hidden;
  }
  .pc-thanks .pc-postmark {
    top: 16px;
    right: 18px;
    width: 70px;
    height: 70px;
    transform: rotate(-12deg);
    font-size: 0.625rem;
  }
  .pc-thanks .pc-kicker,
  .pc-thanks .pc-title,
  .pc-thanks .pc-body {
    padding-right: 84px;
  }
  .pc-thanks .pc-title {
    font-size: 1.1875rem;
  }
  .pc-thanks .pc-body {
    font-size: 0.9375rem;
    color: #4d4943;
  }

  /* Đáp ứng màn hình nhỏ / Mobile 375px */
  @media (max-width: 639px) {
    .pc-card {
      padding: 14px 16px;
      gap: 10px;
    }
    .pc-card .pc-postmark {
      display: none;
    }
    .pc-card .pc-stamp {
      top: 12px;
      right: 12px;
      width: 40px;
      height: 48px;
    }
    .pc-card .pc-stamp svg {
      width: 20px;
      height: 20px;
    }
    .pc-card .pc-top {
      gap: 4px;
    }
    .pc-card .pc-kicker,
    .pc-card .pc-title {
      padding-right: 48px;
    }
    .pc-card .pc-title {
      font-size: 1rem;
    }
    .pc-card .pc-body {
      font-size: 0.8125rem;
      line-height: 1.4;
    }
    .pc-card .pc-pill {
      min-height: 36px;
      padding: 0 14px;
      font-size: 0.8125rem;
    }

    .pc-row {
      padding: 14px 16px;
      gap: 10px 12px;
      align-items: flex-start;
    }
    .pc-row .pc-stamp {
      width: 40px;
      height: 48px;
    }
    .pc-row .pc-stamp svg {
      width: 20px;
      height: 20px;
    }
    .pc-row-content {
      flex: 1 1 calc(100% - 56px);
    }
    .pc-row .pc-title {
      font-size: 0.9375rem;
    }
    .pc-row .pc-body {
      font-size: 0.8125rem;
    }
    .pc-row .pc-pill {
      margin-left: 52px;
      min-height: 36px;
      padding: 0 14px;
      font-size: 0.8125rem;
    }

    .pc-overlay {
      width: min(calc(100% - 24px), 320px);
      padding: 14px 16px;
      gap: 8px;
      transform: rotate(-1deg);
    }
    .pc-overlay .pc-kicker {
      display: none;
    }
    .pc-overlay .pc-stamp {
      top: 10px;
      right: 10px;
      width: 38px;
      height: 44px;
    }
    .pc-overlay .pc-stamp svg {
      width: 18px;
      height: 18px;
    }
    .pc-overlay .pc-title {
      font-size: 0.9375rem;
      padding-right: 46px;
    }
    .pc-overlay .pc-body {
      font-size: 0.8125rem;
      line-height: 1.38;
    }
    .pc-overlay .pc-pill {
      min-height: 36px;
      padding: 0 14px;
      font-size: 0.8125rem;
    }

    .pc-tile {
      padding: 12px;
      gap: 6px;
    }
    .pc-tile .pc-stamp {
      top: 8px;
      right: 8px;
      width: 26px;
      height: 32px;
    }
    .pc-tile .pc-stamp svg {
      width: 14px;
      height: 14px;
    }
    .pc-tile .pc-title {
      font-size: 0.875rem;
      line-height: 1.25;
      padding-right: 30px;
    }
    .pc-tile .pc-body {
      display: none;
    }
    .pc-tile .pc-link {
      font-size: 0.8125rem;
    }

    .pc-thanks {
      padding: 16px;
    }
    .pc-thanks .pc-postmark {
      top: 12px;
      right: 12px;
      width: 58px;
      height: 58px;
      font-size: 0.5625rem;
    }
    .pc-thanks .pc-kicker,
    .pc-thanks .pc-title,
    .pc-thanks .pc-body {
      padding-right: 66px;
    }
    .pc-thanks .pc-title {
      font-size: 1.0625rem;
    }
  }
</style>
