<script lang="ts">
  let count = $state(0);
</script>

<button type="button" onclick={() => count++}>
  Đã bấm {count} lần
</button>

<style>
  button {
    min-height: 3rem;
    padding: 0 var(--space-6);
    border: 0;
    border-radius: 999px;
    background: #a8d8c9;
    color: #1f1d1a;
    font-weight: 700;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 3px;
  }
</style>
