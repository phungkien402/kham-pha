<script lang="ts">
  interface Moment {
    label: string;
    color: string;
    headline: string;
    scene: string;
    tip: string;
  }
  interface Props {
    flowerName: string;
    moments: Moment[];
  }

  let { flowerName, moments }: Props = $props();
  let active = $state(moments.length > 1 ? 1 : 0);
  const moment = $derived(moments[active]);
</script>

<div class="stage" style:background={moment.color}>
  <p class="label">{moment.label}</p>
  <p class="headline">{moment.headline}</p>
  <p class="scene">{moment.scene}</p>
</div>

<div class="tabs" role="group" aria-label="Chọn thời điểm trong ngày">
  {#each moments as m, i}
    <button type="button" aria-pressed={i === active} onclick={() => (active = i)}>{m.label}</button>
  {/each}
</div>

<div class="tip" aria-live="polite">
  <p class="tip-title">Mẹo lúc này</p>
  <p>{moment.tip}</p>
</div>
<p class="note">Màu nền chỉ minh hoạ thời điểm trong ngày, chưa phải ảnh thật của {flowerName}.</p>

<style>
  .stage {
    min-height: 200px;
    padding: var(--space-6) var(--space-4);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--space-1);
    color: #1f1d1a;
    transition: background-color 0.4s ease;
  }
  .label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .headline {
    font-size: 1.375rem;
    font-weight: 700;
    line-height: 1.25;
  }
  .scene {
    max-width: 36rem;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: var(--space-3);
    padding: 4px;
    background: #efeae1;
    border-radius: 14px;
  }
  .tabs button {
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    font-weight: 600;
    font-size: 0.875rem;
    color: #4a453e;
    cursor: pointer;
  }
  .tabs button[aria-pressed='true'] {
    background: #fff;
    color: var(--color-text);
  }
  button:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .tip {
    margin-top: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: #fff;
    border: 1px solid #e7e2d9;
    border-radius: 14px;
  }
  .tip-title {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .note {
    margin-top: var(--space-2);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
