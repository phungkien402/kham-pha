<script lang="ts">
  interface Props {
    title: string;
    text?: string;
  }

  let { title, text = '' }: Props = $props();
  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flash() {
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 2000);
  }

  async function share() {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        // Người dùng đóng hộp thoại chia sẻ thì thôi, không sao chép thay.
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash();
    } catch {
      window.prompt('Sao chép liên kết này:', url);
    }
  }
</script>

<button type="button" class="share" onclick={share}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
  <span>{copied ? 'Đã sao chép' : 'Chia sẻ'}</span>
  <span class="sr" role="status">{copied ? 'Đã sao chép liên kết' : ''}</span>
</button>

<style>
  .share {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: #fff;
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .share:hover {
    border-color: var(--color-text);
  }
  .share:focus-visible {
    outline: 3px solid var(--color-text);
    outline-offset: 2px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
