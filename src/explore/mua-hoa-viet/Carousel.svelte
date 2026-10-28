<script lang="ts">
  import { onMount } from 'svelte';
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
    if (!track) return;
    index = Math.round(track.scrollLeft / track.clientWidth);
    reach = Math.max(reach, index + 1);
  }
</script>

<div class="wrap">
  <div class="track" bind:this={track} onscroll={onScroll} tabindex="0" role="region" aria-label="Ảnh, vuốt ngang để xem thêm">
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
        <figcaption>{formatCarouselCaption(p)}</figcaption>
      </figure>
    {/each}
  </div>
  {#if displayPhotos.length > 1}
    <div class="dots" aria-hidden="true">
      {#each displayPhotos as _, i}<span class:on={i === index}></span>{/each}
    </div>
  {/if}
</div>

<style>
  .track {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    border-radius: 20px;
    scrollbar-width: none;
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
