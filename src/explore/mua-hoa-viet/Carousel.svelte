<script lang="ts">
  import type { ResponsiveImage } from './images';
  interface Photo {
    img?: ResponsiveImage;
    alt: string;
    author: string;
    color: string;
  }
  let { photos }: { photos: Photo[] } = $props();
  let track: HTMLElement | undefined = $state();
  let index = $state(0);

  function onScroll() {
    if (track) index = Math.round(track.scrollLeft / track.clientWidth);
  }
</script>

<div class="wrap">
  <div class="track" bind:this={track} onscroll={onScroll} tabindex="0" role="region" aria-label="Ảnh, vuốt ngang để xem thêm">
    {#each photos as p, i}
      <figure style:background="color-mix(in srgb, {p.color} 72%, white)">
        {#if p.img}
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
        <figcaption>{p.author === 'Chưa có' ? 'Ảnh giữ chỗ' : `Ảnh: ${p.author}`}</figcaption>
      </figure>
    {/each}
  </div>
  {#if photos.length > 1}
    <div class="dots" aria-hidden="true">
      {#each photos as _, i}<span class:on={i === index}></span>{/each}
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
