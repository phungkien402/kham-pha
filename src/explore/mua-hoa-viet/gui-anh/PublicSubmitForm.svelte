<script lang="ts">
  import { onMount } from 'svelte';
  import { compressPhotoFile } from '../compressImage';
  import Postcard from '../Postcard.svelte';
  import { vnParts } from '../season';

  interface FlowerOption {
    slug: string;
    name: string;
  }

  interface PlaceOption {
    slug: string;
    name: string;
    province: string;
    flowers: string[];
  }

  let {
    flowers,
    places,
    turnstileSiteKey,
  }: {
    flowers: FlowerOption[];
    places: PlaceOption[];
    turnstileSiteKey: string;
  } = $props();

  let flower = $state('da-quy');
  let place = $state('');
  let mapsUrl = $state('');
  let caption = $state('');
  let takenOn = $state('');
  let author = $state('');
  let authorLink = $state('');
  let consent = $state(false);
  let selectedFiles = $state<File[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();
  let formEl: HTMLFormElement | undefined = $state();

  let submitting = $state(false);
  let progressText = $state('');
  let errorMessage = $state('');
  let successMessage = $state('');

  const matchingPlaces = $derived(
    places.filter((p) => p.flowers.includes(flower)),
  );
  const otherPlaces = $derived(
    places.filter((p) => !p.flowers.includes(flower)),
  );
  const sentPostmark = $derived.by(() => {
    const now = vnParts(new Date());
    return `ĐÃ GỬI\n${now.day}·${now.month}`;
  });

  onMount(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hoaParam = params.get('hoa')?.trim();
      if (hoaParam && flowers.some((f) => f.slug === hoaParam)) {
        flower = hoaParam;
      }
    } catch {
      // Bỏ qua nếu không đọc được query string
    }
  });

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    errorMessage = '';
    successMessage = '';
    if (files.length > 3) {
      errorMessage = 'Chỉ được chọn tối đa 3 ảnh mỗi lần gửi.';
      selectedFiles = files.slice(0, 3);
      return;
    }
    selectedFiles = files;
  }

  function resetTurnstile() {
    const win = window as unknown as { turnstile?: { reset?: () => void } };
    if (win.turnstile && typeof win.turnstile.reset === 'function') {
      try {
        win.turnstile.reset();
      } catch {
        // Bỏ qua nếu widget chưa khởi tạo
      }
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMessage = '';
    successMessage = '';

    if (selectedFiles.length === 0) {
      errorMessage = 'Vui lòng chọn từ 1 đến 3 ảnh để gửi.';
      return;
    }
    if (selectedFiles.length > 3) {
      errorMessage = 'Chỉ được chọn tối đa 3 ảnh mỗi lần gửi.';
      return;
    }
    if (!author.trim()) {
      errorMessage = 'Vui lòng nhập tên hiển thị của bạn.';
      return;
    }
    if (!consent) {
      errorMessage = 'Vui lòng đồng ý cho đăng ảnh theo giấy phép CC BY-SA 4.0.';
      return;
    }

    const domForm = formEl ? new FormData(formEl) : null;
    const turnstileToken =
      (domForm?.get('cf-turnstile-response') as string | null)?.trim() ?? '';

    if (!turnstileToken) {
      errorMessage = 'Vui lòng hoàn thành bước xác thực chống spam (Cloudflare Turnstile).';
      return;
    }

    submitting = true;

    try {
      const payload = new FormData();
      payload.append('flower', flower);
      if (place.trim()) payload.append('place', place.trim());
      if (mapsUrl.trim()) payload.append('maps_url', mapsUrl.trim());
      if (caption.trim()) payload.append('caption', caption.trim());
      if (takenOn.trim()) payload.append('taken_on', takenOn.trim());
      payload.append('author', author.trim());
      if (authorLink.trim()) payload.append('author_link', authorLink.trim());
      payload.append('consent', '1');
      payload.append('cf-turnstile-response', turnstileToken);

      for (let i = 0; i < selectedFiles.length; i++) {
        const rawFile = selectedFiles[i];
        progressText = `Đang nén ảnh ${i + 1}/${selectedFiles.length}: ${rawFile.name}…`;
        const { full, fileMain, file600 } = await compressPhotoFile(rawFile, 0.8);
        payload.append('file', fileMain);
        payload.append('file600', file600);
        payload.append('width', String(full.width));
        payload.append('height', String(full.height));
      }

      progressText = 'Đang gửi ảnh lên hệ thống…';
      const res = await fetch('/api/gui-anh', {
        method: 'POST',
        body: payload,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không gửi được ảnh (${res.status})`);
      }

      successMessage = 'Cảm ơn! Ảnh sẽ hiện sau khi được duyệt.';
      selectedFiles = [];
      caption = '';
      mapsUrl = '';
      if (fileInput) fileInput.value = '';
      resetTurnstile();
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi ảnh. Vui lòng thử lại.';
      resetTurnstile();
    } finally {
      submitting = false;
      progressText = '';
    }
  }
</script>

<section class="submit-card" aria-labelledby="submit-heading">
  <h2 id="submit-heading" class="sr-only">Biểu mẫu gửi ảnh</h2>
  <p class="privacy-note">
    Ảnh được nén trực tiếp trên trình duyệt của bạn sang định dạng WebP (cạnh dài ≤ 2000px và bản thu nhỏ 600px) và <strong>tự động xoá toàn bộ dữ liệu EXIF/GPS</strong> trước khi gửi đi. Chúng tôi không thu thập email hay số điện thoại.
  </p>

  <form bind:this={formEl} onsubmit={handleSubmit} class="submit-form">
    <div class="field">
      <label for="public-flower-select">Loài hoa *</label>
      <select id="public-flower-select" name="flower" bind:value={flower} required>
        {#each flowers as f}
          <option value={f.slug}>{f.name}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="public-place-select">Điểm ngắm / nơi chụp (tuỳ chọn)</label>
      <select id="public-place-select" name="place" bind:value={place}>
        <option value="">— Không chọn —</option>
        {#if matchingPlaces.length > 0}
          <optgroup label="Điểm ngắm của loài này">
            {#each matchingPlaces as p}
              <option value={p.slug}>{p.name}, {p.province}</option>
            {/each}
          </optgroup>
        {/if}
        {#if otherPlaces.length > 0}
          <optgroup label="Điểm ngắm khác">
            {#each otherPlaces as p}
              <option value={p.slug}>{p.name}, {p.province}</option>
            {/each}
          </optgroup>
        {/if}
      </select>
    </div>

    <div class="field">
      <label for="public-maps-url-input">Link Google Maps chỗ chụp (tuỳ chọn)</label>
      <input
        id="public-maps-url-input"
        type="url"
        name="maps_url"
        placeholder="https://maps.app.goo.gl/... hoặc https://www.google.com/maps/..."
        bind:value={mapsUrl}
      />
    </div>

    <div class="field">
      <label for="public-photo-files">Chọn ảnh (1–3 ảnh) *</label>
      <input
        id="public-photo-files"
        type="file"
        accept="image/*"
        multiple
        required
        bind:this={fileInput}
        onchange={onFileChange}
      />
      <small class="field-hint">
        Tối đa 3 ảnh mỗi lần gửi. Dung lượng sau nén ≤ 3 MB/ảnh.
        {#if selectedFiles.length > 0}
          <strong>(Đã chọn {selectedFiles.length} ảnh)</strong>
        {/if}
      </small>
    </div>

    <div class="field">
      <label for="public-caption-input">Chú thích ngắn (tuỳ chọn)</label>
      <input
        id="public-caption-input"
        type="text"
        name="caption"
        placeholder="Ví dụ: Đồi dã quỳ nở rộ sáng sớm ở Cầu Đất"
        bind:value={caption}
      />
    </div>

    <div class="row-2">
      <div class="field">
        <label for="public-author-input">Tên hiển thị *</label>
        <input
          id="public-author-input"
          type="text"
          name="author"
          required
          placeholder="Tên hoặc bút danh ghi dưới ảnh"
          bind:value={author}
        />
      </div>

      <div class="field">
        <label for="public-taken-on-input">Ngày chụp (tuỳ chọn)</label>
        <input
          id="public-taken-on-input"
          type="date"
          name="taken_on"
          bind:value={takenOn}
        />
      </div>
    </div>

    <div class="field">
      <label for="public-link-input">Link cá nhân / trang ảnh (tuỳ chọn)</label>
      <input
        id="public-link-input"
        type="url"
        name="author_link"
        placeholder="https://..."
        bind:value={authorLink}
      />
    </div>

    <div class="consent-box">
      <label class="checkbox-label">
        <input
          type="checkbox"
          name="consent"
          value="1"
          required
          bind:checked={consent}
        />
        <span>
          Ảnh do tôi chụp, tôi đồng ý cho đăng theo giấy phép
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.vi"
            target="_blank"
            rel="noopener"
          >
            CC BY-SA 4.0
          </a>
          kèm tên tôi *
        </span>
      </label>
    </div>

    <div class="turnstile-wrap">
      <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
    </div>

    {#if progressText}
      <p class="status info" role="status">{progressText}</p>
    {/if}
    {#if errorMessage}
      <p class="status error" role="alert">{errorMessage}</p>
    {/if}
    {#if successMessage}
      <Postcard
        variant="thanks"
        postmark={sentPostmark}
        kicker="Cảm ơn bạn!"
        title="Bưu thiếp đã lên đường ✉"
        body={successMessage}
      />
    {/if}

    <button type="submit" class="btn primary" disabled={submitting}>
      {submitting ? 'Đang nén & gửi…' : 'Gửi ảnh'}
    </button>
  </form>
</section>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .submit-card {
    background: #fff;
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: var(--space-6);
  }
  .privacy-note {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    line-height: 1.55;
  }
  .submit-form {
    display: grid;
    gap: var(--space-4);
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .row-2 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: 1fr 1fr;
  }
  label {
    font-size: 0.875rem;
    font-weight: 600;
  }
  input[type='text'],
  input[type='url'],
  input[type='date'],
  select {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid #cfc9be;
    border-radius: 10px;
    font: inherit;
    background: #faf8f5;
    color: var(--color-text);
  }
  input[type='file'] {
    font: inherit;
    font-size: 0.875rem;
  }
  .field-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .consent-box {
    padding: var(--space-3);
    background: #faf8f5;
    border: 1px solid #e7e2d9;
    border-radius: 12px;
  }
  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: 400;
    font-size: 0.9375rem;
    line-height: 1.45;
    cursor: pointer;
  }
  .checkbox-label input[type='checkbox'] {
    margin-top: 0.25rem;
    width: 18px;
    height: 18px;
    flex: none;
  }
  .checkbox-label a {
    color: inherit;
    font-weight: 600;
  }
  .turnstile-wrap {
    min-height: 65px;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.7rem 1.25rem;
    border-radius: 10px;
    border: 1px solid transparent;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn.primary {
    background: var(--color-text);
    color: #faf8f5;
  }
  .status {
    padding: var(--space-3);
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 600;
  }
  .status.info {
    background: #eef4fb;
    color: #1c4a7e;
  }
  .status.error {
    background: #fbe9e7;
    color: #9c2318;
  }
  .status.success {
    background: #e8f5e9;
    color: #1e5e2a;
  }
  @media (max-width: 600px) {
    .row-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
