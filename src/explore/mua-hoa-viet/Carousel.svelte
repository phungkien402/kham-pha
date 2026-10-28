<script lang="ts">
  import { onMount } from 'svelte';
  import Postcard from './Postcard.svelte';
  import {
    fetchPublicPhotos,
    formatCarouselCaption,
    mergeCarouselPhotos,
    type CarouselPhoto,
    type PublicPhoto,
  } from './publicPhotos';

  let {
    photos,
    flowerSlug = '',
    flowerName = '',
    color = '',
  }: {
    photos: CarouselPhoto[];
    flowerSlug?: string;
    flowerName?: string;
    color?: string;
  } = $props();

  let apiPhotos = $state<PublicPhoto[]>([]);
  let track: HTMLElement | undefined = $state();
  let index = $state(0);
  // Chỉ ảnh đầu có src từ HTML build sẵn; slide sau chỉ nạp khi người xem vuốt tới sát nó.
  let reach = $state(0);

  const displayPhotos = $derived(
    mergeCarouselPhotos(photos, apiPhotos, color, flowerName),
  );
  const hasRealPhoto = $derived(
    displayPhotos.some((p) => Boolean(p.img?.src)),
  );

  onMount(() => {
    if (!flowerSlug) return;
    let cancelled = false;

    fetchPublicPhotos(flowerSlug).then((list) => {
      if (!cancelled && list.length > 0) {
        apiPhotos = list;
      }
    });

    return () => {
      cancelled = true;
    };
  });

  function onScroll() {
    if (!track || track.clientWidth <= 0) return;
    const total = displayPhotos.length;
    const raw = Math.round(track.scrollLeft / track.clientWidth);
    index = total > 0 ? Math.max(0, Math.min(total - 1, raw)) : 0;
    reach = Math.max(reach, index + 1);
  }

  function goTo(target: number) {
    const total = displayPhotos.length;
    if (total < 2) return;
    const next = Math.max(0, Math.min(total - 1, target));
    if (next === index) return;
    index = next;
    reach = Math.max(reach, next + 1);
    if (!track) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const left = next * track.clientWidth;
    if (typeof track.scrollTo === 'function') {
      track.scrollTo({ left, behavior: reducedMotion ? 'auto' : 'smooth' });
    } else {
      track.scrollLeft = left;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || displayPhotos.length < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(index + 1);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap" onkeydown={onKeydown}>
  <div class="stage">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="track"
      bind:this={track}
      onscroll={onScroll}
      onkeydown={onKeydown}
      tabindex="0"
      role="region"
      aria-label="Ảnh, vuốt ngang để xem thêm"
    >
      {#each displayPhotos as p, i}
        <figure style:background="color-mix(in srgb, {p.color} 72%, white)">
          {#if p.img && i <= reach}
            <img
              src={p.img.src}
              srcset={p.img.srcset}
              sizes="(min-width: 1024px) 560px, 100vw"
              width={p.img.width}
              height={p.img.height}
              alt={p.alt}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchpriority={i === 0 ? 'high' : undefined}
            />
          {/if}
          {#if i === 0 && !hasRealPhoto && flowerSlug}
            <div class="overlay-wrap">
              <Postcard
                variant="overlay"
                stamp="camera"
                color={p.color || color}
                kicker="Chưa ai gửi về…"
                title={`${flowerName || p.alt} mùa này chưa có tấm ảnh nào.`}
                body="Tấm đầu tiên sẽ mang tên bạn."
                cta="Gửi tấm đầu tiên"
                href={`/gui-anh?hoa=${flowerSlug}`}
              />
            </div>
          {:else}
            <figcaption>{formatCarouselCaption(p)}</figcaption>
          {/if}
        </figure>
      {/each}
    </div>
    {#if displayPhotos.length > 1}
      <button
        type="button"
        class="nav prev"
        aria-label="Ảnh trước"
        disabled={index <= 0}
        onclick={() => goTo(index - 1)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M15 18l-6-6 6-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="nav next"
        aria-label="Ảnh sau"
        disabled={index >= displayPhotos.length - 1}
        onclick={() => goTo(index + 1)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M9 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
  </div>
  {#if displayPhotos.length > 1}
    <div class="dots" aria-hidden="true">
      {#each displayPhotos as _, i}<span class:on={i === index}></span>{/each}
    </div>
  {/if}
</div>

<style>
  .stage {
    position: relative;
  }
  .track {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    border-radius: 20px;
    scrollbar-width: none;
  }
  .track::-webkit-scrollbar {
    display: none;
  }
  figure {
    flex: 0 0 100%;
    margin: 0;
    position: relative;
    aspect-ratio: 4 / 3;
    scroll-snap-align: start;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  figcaption {
    position: absolute;
    left: 10px;
    bottom: 10px;
    padding: 2px 10px;
    border-radius: 999px;
    background: rgb(31 29 26 / 0.7);
    color: #fff;
    font-size: 0.75rem;
  }
  .overlay-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
  }
  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid rgb(31 29 26 / 0.12);
    background: rgb(255 255 255 / 0.85);
    backdrop-filter: blur(4px);
    color: var(--color-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
    transition: opacity 0.15s ease, background-color 0.15s ease;
  }
  .prev {
    left: 10px;
  }
  .next {
    right: 10px;
  }
  .nav:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.96);
  }
  .nav:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .nav:disabled {
    opacity: 0;
    pointer-events: none;
    cursor: default;
  }
  @media (pointer: coarse) {
    .nav {
      display: none;
    }
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: var(--space-2);
  }
  .dots span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #d4cec2;
  }
  .dots span.on {
    background: var(--color-text);
  }
  .track:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
</style>
