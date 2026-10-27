<script lang="ts">
  import { onMount } from 'svelte';
  import type { ResponsiveImage } from './images';
  import { statusOn, type SeasonFlower } from './season';
  import { STATUS_SHORT, sortByStatus } from './detail';

  interface Item extends SeasonFlower {
    slug: string;
    name: string;
    color: string;
    regionLabel: string;
    photo?: ResponsiveImage;
  }
  let { items }: { items: Item[] } = $props();

  let now = $state(new Date());
  onMount(() => {
    now = new Date();
  });
  let sorted = $derived(sortByStatus(items, now));
</script>

<ul>
  {#each sorted as f (f.slug)}
    <li>
      <a href="/mua-hoa-viet/{f.slug}/">
        <span class="thumb" style:background="color-mix(in srgb, {f.color} 72%, white)">
          {#if f.photo}<img src={f.photo.src} srcset={f.photo.srcset} sizes="64px" alt="" loading="lazy" width="64" height="64" />{/if}
        </span>
        <span class="text">
          <strong>{f.name}</strong>
          <small>{f.regionLabel}</small>
          <em>{STATUS_SHORT[statusOn(f, now)]}</em>
        </span>
      </a>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  }
  a {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2);
    background: #fff;
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    text-decoration: none;
  }
  a:hover {
    border-color: #b9b2a5;
  }
  a:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .thumb {
    width: 64px;
    height: 64px;
    border-radius: 10px;
    overflow: hidden;
    flex: none;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  small {
    color: var(--color-text-muted);
  }
  em {
    font-style: normal;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #4a453e;
  }
</style>
