<script lang="ts">
  import { onMount } from 'svelte';
  import Postcard from './Postcard.svelte';
  import {
    fetchPublicPhotos,
    mergeGridPhotos,
    type GridPhotoInput,
    type PublicPhoto,
  } from './publicPhotos';

  let {
    flowerSlug,
    flowerName,
    color,
    initialPhotos = [],
    placesMap = {},
  }: {
    flowerSlug: string;
    flowerName: string;
    color: string;
    initialPhotos?: GridPhotoInput[];
    placesMap?: Record<string, string>;
  } = $props();

  let apiPhotos = $state<PublicPhoto[]>([]);
  let activeIndex = $state<number | null>(null);

  const displayPhotos = $derived(
    mergeGridPhotos(initialPhotos, apiPhotos, color, flowerName),
  );
  const activeItem = $derived(
    activeIndex !== null ? (displayPhotos[activeIndex] ?? null) : null,
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

  function openLightbox(index: number) {
    if (index < 0 || index >= displayPhotos.length) return;
    activeIndex = index;
  }

  function closeLightbox() {
    activeIndex = null;
  }

  function prevPhoto() {
    if (activeIndex === null || activeIndex <= 0) return;
    activeIndex = activeIndex - 1;
  }

  function nextPhoto() {
    if (activeIndex === null || activeIndex >= displayPhotos.length - 1) return;
    activeIndex = activeIndex + 1;
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (activeIndex === null) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevPhoto();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextPhoto();
    }
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeLightbox();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if displayPhotos.length > 0}
  <section class="block" aria-labelledby="flower-photos-heading">
    <div class="photos-head">
      <h2 id="flower-photos-heading">Ảnh</h2>
      <span class="photos-count">{displayPhotos.length} tấm · từ người xem</span>
    </div>
    <ul class="grid-photos">
      {#each displayPhotos as item, i (item.id)}
        <li>
          <button
            type="button"
            class="ph"
            style:background="color-mix(in srgb, {item.color} 72%, white)"
            aria-label="Xem ảnh lớn: {item.alt}"
            onclick={() => openLightbox(i)}
          >
            <img
              src={item.thumbSrc}
              srcset={item.thumbSrcset}
              sizes={item.thumbSrcset ? '(min-width: 1024px) 280px, 50vw' : undefined}
              alt={item.alt}
              width={item.width}
              height={item.height}
              loading="lazy"
              decoding="async"
            />
          </button>
          {#if item.caption}
            <p class="caption">{item.caption}</p>
          {/if}
          <small class="credit">
            Ảnh:
            {#if item.authorLink}
              <a href={item.authorLink} target="_blank" rel="noopener noreferrer">{item.author}</a>
            {:else}
              <span>{item.author}</span>
            {/if}{#if item.license}
              <span>{' · '}{item.license}</span>
            {/if}{#if item.place}
              <span>{' · '}{placesMap[item.place] ?? item.place}</span>
            {/if}{#if item.takenOn}
              <span>{' · '}{item.takenOn}</span>
            {/if}{#if item.mapsUrl}
              <span>{' · '}<a href={item.mapsUrl} target="_blank" rel="noopener noreferrer">Chỗ chụp trên Google Maps</a></span>
            {/if}
          </small>
        </li>
      {/each}
      {#if displayPhotos.length < 6 && flowerSlug}
        <li class="tile-item">
          <Postcard
            variant="tile"
            stamp="camera"
            {color}
            title="Mùa này bạn có ghé không?"
            body="Mỗi tấm ảnh giữ lại một mùa hoa, kèm tên người chụp."
            cta="Gửi bưu thiếp ảnh"
            href={`/gui-anh?hoa=${flowerSlug}`}
          />
        </li>
      {/if}
    </ul>
  </section>
{/if}

{#if activeItem !== null && activeIndex !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="lightbox"
    role="dialog"
    aria-modal="true"
    aria-label="Xem ảnh lớn"
    tabindex="-1"
    onclick={onBackdropClick}
  >
    <button
      type="button"
      class="lightbox-close"
      aria-label="Đóng"
      onclick={closeLightbox}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M18 6L6 18M6 6l12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    {#if displayPhotos.length > 1}
      <button
        type="button"
        class="nav prev"
        aria-label="Ảnh trước"
        disabled={activeIndex <= 0}
        onclick={prevPhoto}
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
        disabled={activeIndex >= displayPhotos.length - 1}
        onclick={nextPhoto}
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

    <figure class="lightbox-figure">
      <img
        src={activeItem.fullSrc}
        srcset={activeItem.fullSrcset}
        sizes={activeItem.fullSrcset ? '92vw' : undefined}
        alt={activeItem.alt}
        width={activeItem.width}
        height={activeItem.height}
      />
      <figcaption class="lightbox-caption">
        {#if activeItem.caption}
          <span>{activeItem.caption} · </span>
        {/if}
        Ảnh:
        {#if activeItem.authorLink}
          <a href={activeItem.authorLink} target="_blank" rel="noopener noreferrer">{activeItem.author}</a>
        {:else}
          <span>{activeItem.author}</span>
        {/if}{#if activeItem.license}
          <span>{' · '}{activeItem.license}</span>
        {/if}{#if activeItem.mapsUrl}
          <span>{' · '}<a href={activeItem.mapsUrl} target="_blank" rel="noopener noreferrer">Chỗ chụp trên Google Maps</a></span>
        {/if}
      </figcaption>
    </figure>
  </div>
{/if}

<style>
  .block {
    margin-top: var(--space-8);
  }
  .photos-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  h2 {
    font-size: 1.25rem;
    margin: 0;
  }
  .photos-count {
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
  .grid-photos {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .ph {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    aspect-ratio: 4 / 3;
    border-radius: 14px;
    overflow: hidden;
    cursor: zoom-in;
  }
  .ph:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .ph img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .caption {
    margin: var(--space-1) 0 0;
    font-size: 0.875rem;
    color: var(--color-text);
  }
  .credit {
    display: block;
    margin-top: 2px;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .credit a {
    color: inherit;
    text-decoration: underline;
  }

  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgb(20 18 16 / 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1rem 1.5rem;
  }
  .lightbox-figure {
    margin: 0;
    max-width: min(92vw, 1080px);
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .lightbox-figure img {
    max-width: 100%;
    max-height: calc(84vh - 2.5rem);
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 12px;
  }
  .lightbox-caption {
    padding: 4px 12px;
    border-radius: 999px;
    background: rgb(31 29 26 / 0.78);
    color: #fff;
    font-size: 0.8125rem;
    text-align: center;
  }
  .lightbox-caption a {
    color: #fff;
    text-decoration: underline;
  }

  .nav,
  .lightbox-close {
    position: absolute;
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
  .nav {
    top: 50%;
    transform: translateY(-50%);
  }
  .prev {
    left: 12px;
  }
  .next {
    right: 12px;
  }
  .lightbox-close {
    top: 12px;
    right: 12px;
  }
  .nav:hover:not(:disabled),
  .lightbox-close:hover {
    background: rgb(255 255 255 / 0.96);
  }
  .nav:focus-visible,
  .lightbox-close:focus-visible {
    outline: 3px solid #fff;
    outline-offset: 2px;
  }
  .nav:disabled {
    opacity: 0;
    pointer-events: none;
    cursor: default;
  }
</style>
