<script lang="ts">
  import type { Filter } from './types';

  interface Props {
    region: Filter;
    label: string;
  }

  let { region = $bindable(), label }: Props = $props();

  const OPTIONS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Cả nước' },
    { value: 'bac', label: 'Bắc' },
    { value: 'trung', label: 'Trung' },
    { value: 'nam', label: 'Nam' },
  ];
</script>

<div class="seg" role="group" aria-label={label}>
  {#each OPTIONS as opt}
    <button type="button" aria-pressed={region === opt.value} onclick={() => (region = opt.value)}>
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 4px;
    background: #efeae1;
    border-radius: 14px;
    max-width: 28rem;
  }
  button {
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    color: #4a453e;
  }
  button[aria-pressed='true'] {
    background: #fff;
    color: var(--color-text);
  }
  button:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
</style>
