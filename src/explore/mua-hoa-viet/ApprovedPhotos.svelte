<script lang="ts">
  import { onMount } from 'svelte';

  interface PublicPhoto {
    id: string;
    flower: string;
    place?: string | null;
    author: string;
    author_link?: string | null;
    license: string;
    caption?: string | null;
    taken_on?: string | null;
    width?: number;
    height?: number;
    src?: string;
    src600?: string;
  }

  let {
    flowerSlug,
    flowerName,
    color,
    placesMap = {},
  }: {
    flowerSlug: string;
    flowerName: string;
    color: string;
    placesMap?: Record<string, string>;
  } = $props();

  let photos = $state<PublicPhoto[]>([]);

  onMount(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/anh?flower=${encodeURIComponent(flowerSlug)}`);
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) return;
        const data = await res.json();
        const list: PublicPhoto[] = Array.isArray(data) ? data : (data?.photos ?? []);
        if (!cancelled && list.length > 0) {
          photos = list;
        }
      } catch {
        // Bỏ qua lỗi mạng khi chạy bản tĩnh không có Worker
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  });
</script>

{#if photos.length > 0}
  <section class="approved-block" aria-labelledby="approved-photos-heading">
    <h2 id="approved-photos-heading">Ảnh thực tế ({photos.length})</h2>
    <ul class="approved-grid">
      {#each photos as p (p.id)}
        {@const srcFull = p.src || `/api/anh/${p.id}.webp`}
        {@const srcThumb = p.src600 || `/api/anh/${p.id}-600.webp`}
        <li>
          <a
            href={srcFull}
            target="_blank"
            rel="noopener"
            class="ph"
            style:background="color-mix(in srgb, {color} 72%, white)"
          >
            <img
              src={srcThumb}
              srcset="{srcThumb} 600w, {srcFull} 1200w"
              sizes="(min-width: 1024px) 280px, 50vw"
              alt={p.caption || `Ảnh ${flowerName} — ${p.author}`}
              width={p.width || 800}
              height={p.height || 600}
              loading="lazy"
              decoding="async"
            />
          </a>
          {#if p.caption}
            <p class="caption">{p.caption}</p>
          {/if}
          <small class="credit">
            Ảnh:
            {#if p.author_link}
              <a href={p.author_link} target="_blank" rel="noopener">{p.author}</a>
            {:else}
              <span>{p.author}</span>
            {/if}
            {#if p.license}
              <span> · {p.license}</span>
            {/if}
            {#if p.place}
              <span> · {placesMap[p.place] ?? p.place}</span>
            {/if}
            {#if p.taken_on}
              <span> · {p.taken_on}</span>
            {/if}
          </small>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .approved-block {
    margin-top: var(--space-8);
  }
  h2 {
    font-size: 1.25rem;
    margin-bottom: var(--space-3);
  }
  .approved-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .ph {
    display: block;
    aspect-ratio: 4 / 3;
    border-radius: 14px;
    overflow: hidden;
  }
  .ph img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .caption {
    margin-top: var(--space-1);
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
  @media (min-width: 1024px) {
    .approved-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
