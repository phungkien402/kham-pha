<script lang="ts">
  import { onMount } from 'svelte';

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

  interface AdminPhoto {
    id: string;
    flower: string;
    place: string | null;
    status: 'pending' | 'approved' | 'rejected';
    author: string;
    author_link: string | null;
    license: string;
    caption: string | null;
    taken_on: string | null;
    width: number;
    height: number;
    source: 'admin' | 'public';
    created_at: string;
    src: string;
    src600: string;
  }

  let {
    flowers,
    places,
  }: {
    flowers: FlowerOption[];
    places: PlaceOption[];
  } = $props();

  let flower = $state('da-quy');
  let place = $state('');
  let caption = $state('');
  let takenOn = $state('');
  let author = $state('Phùng Kiên');
  let license = $state('CC BY-SA 4.0');
  let selectedFiles = $state<File[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();

  let uploading = $state(false);
  let uploadProgress = $state('');
  let uploadError = $state('');
  let uploadSuccess = $state('');

  let filterFlower = $state('');
  let photos = $state<AdminPhoto[]>([]);
  let loadingPhotos = $state(false);
  let listError = $state('');
  let busyId = $state<string | null>(null);

  const flowerMap = $derived(new Map(flowers.map((f) => [f.slug, f.name])));
  const placeMap = $derived(
    new Map(places.map((p) => [p.slug, `${p.name} (${p.province})`])),
  );

  // Ưu tiên hiện các điểm ngắm của loài đang chọn lên đầu danh sách
  const matchingPlaces = $derived(
    places.filter((p) => p.flowers.includes(flower)),
  );
  const otherPlaces = $derived(
    places.filter((p) => !p.flowers.includes(flower)),
  );

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    selectedFiles = input.files ? Array.from(input.files) : [];
    uploadError = '';
    uploadSuccess = '';
  }

  function loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Không đọc được ảnh: ${file.name}`));
      };
      img.src = url;
    });
  }

  /**
   * Vẽ lại ảnh qua <canvas> để vừa thu nhỏ về cạnh dài ≤ maxEdge,
   * vừa xuất sang WebP và xoá toàn bộ EXIF/GPS.
   */
  async function compressToWebp(
    img: HTMLImageElement,
    maxEdge: number,
    quality = 0.8,
  ): Promise<{ blob: Blob; width: number; height: number }> {
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const longest = Math.max(srcW, srcH, 1);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ Canvas 2D');
    }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Không thể nén ảnh sang WebP'));
        },
        'image/webp',
        quality,
      );
    });

    return { blob, width, height };
  }

  async function handleUploadSubmit(e: SubmitEvent) {
    e.preventDefault();
    uploadError = '';
    uploadSuccess = '';

    if (selectedFiles.length === 0) {
      uploadError = 'Vui lòng chọn ít nhất một ảnh để tải lên.';
      return;
    }

    uploading = true;
    let uploadedCount = 0;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const rawFile = selectedFiles[i];
        uploadProgress = `Đang nén và tải ảnh ${i + 1}/${selectedFiles.length}: ${rawFile.name}…`;

        const img = await loadImageElement(rawFile);
        const full = await compressToWebp(img, 2000, 0.8);
        const thumb = await compressToWebp(img, 600, 0.8);

        const baseName = rawFile.name.replace(/\.[^.]+$/, '') || 'photo';
        const form = new FormData();
        form.append('file', new File([full.blob], `${baseName}.webp`, { type: 'image/webp' }));
        form.append('file600', new File([thumb.blob], `${baseName}-600.webp`, { type: 'image/webp' }));
        form.append('flower', flower);
        if (place.trim()) form.append('place', place.trim());
        if (caption.trim()) form.append('caption', caption.trim());
        if (takenOn.trim()) form.append('taken_on', takenOn.trim());
        form.append('author', author.trim() || 'Phùng Kiên');
        form.append('license', license.trim() || 'CC BY-SA 4.0');
        form.append('width', String(full.width));
        form.append('height', String(full.height));

        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: form,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Lỗi tải lên (${res.status})`);
        }
        uploadedCount++;
      }

      uploadSuccess = `Đã đăng thành công ${uploadedCount} ảnh.`;
      selectedFiles = [];
      caption = '';
      if (fileInput) fileInput.value = '';
      await fetchPhotos();
    } catch (err) {
      uploadError = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải ảnh lên.';
    } finally {
      uploading = false;
      uploadProgress = '';
    }
  }

  async function fetchPhotos() {
    loadingPhotos = true;
    listError = '';
    try {
      const qs = filterFlower ? `?flower=${encodeURIComponent(filterFlower)}` : '';
      const res = await fetch(`/api/admin/photos${qs}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không tải được danh sách ảnh (${res.status})`);
      }
      const data = await res.json();
      photos = Array.isArray(data) ? data : (data.photos ?? []);
    } catch (err) {
      listError = err instanceof Error ? err.message : 'Lỗi kết nối API';
    } finally {
      loadingPhotos = false;
    }
  }

  async function handleHide(photo: AdminPhoto) {
    busyId = photo.id;
    listError = '';
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}/hide`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không thể ẩn ảnh (${res.status})`);
      }
      photos = photos.map((p) => (p.id === photo.id ? { ...p, status: 'rejected' } : p));
    } catch (err) {
      listError = err instanceof Error ? err.message : 'Lỗi khi ẩn ảnh';
    } finally {
      busyId = null;
    }
  }

  async function handleDelete(photo: AdminPhoto) {
    if (!window.confirm(`Xoá hẳn ảnh này (${photo.caption || photo.id}) khỏi D1 và R2?`)) {
      return;
    }
    busyId = photo.id;
    listError = '';
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không thể xoá ảnh (${res.status})`);
      }
      photos = photos.filter((p) => p.id !== photo.id);
    } catch (err) {
      listError = err instanceof Error ? err.message : 'Lỗi khi xoá ảnh';
    } finally {
      busyId = null;
    }
  }

  onMount(() => {
    fetchPhotos();
  });
</script>

<div class="admin-grid">
  <section class="card" aria-labelledby="upload-heading">
    <h2 id="upload-heading">Đăng ảnh mới</h2>
    <p class="hint">
      Ảnh được vẽ lại và nén ngay trên trình duyệt sang WebP (bản chính cạnh dài ≤ 2000px và bản lưới ≤ 600px, tự xoá EXIF/GPS).
    </p>

    <form onsubmit={handleUploadSubmit} class="upload-form">
      <div class="field">
        <label for="flower-select">Loài hoa *</label>
        <select id="flower-select" bind:value={flower} required>
          {#each flowers as f}
            <option value={f.slug}>{f.name} ({f.slug})</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="place-select">Điểm ngắm (tuỳ chọn)</label>
        <select id="place-select" bind:value={place}>
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
        <label for="photo-files">Chọn ảnh (có thể chọn nhiều ảnh) *</label>
        <input
          id="photo-files"
          type="file"
          accept="image/*"
          multiple
          required
          bind:this={fileInput}
          onchange={onFileChange}
        />
        {#if selectedFiles.length > 0}
          <small>Đã chọn {selectedFiles.length} file</small>
        {/if}
      </div>

      <div class="field">
        <label for="caption-input">Chú thích (tuỳ chọn)</label>
        <input
          id="caption-input"
          type="text"
          placeholder="Ví dụ: Sườn đồi dã quỳ sáng sớm ở Đà Lạt"
          bind:value={caption}
        />
      </div>

      <div class="row-2">
        <div class="field">
          <label for="taken-on-input">Ngày chụp (tuỳ chọn)</label>
          <input id="taken-on-input" type="date" bind:value={takenOn} />
        </div>
        <div class="field">
          <label for="author-input">Tác giả *</label>
          <input id="author-input" type="text" required bind:value={author} />
        </div>
      </div>

      <div class="field">
        <label for="license-input">Giấy phép *</label>
        <input id="license-input" type="text" required bind:value={license} />
      </div>

      {#if uploadProgress}
        <p class="status info" role="status">{uploadProgress}</p>
      {/if}
      {#if uploadError}
        <p class="status error" role="alert">{uploadError}</p>
      {/if}
      {#if uploadSuccess}
        <p class="status success" role="status">{uploadSuccess}</p>
      {/if}

      <button type="submit" class="btn primary" disabled={uploading}>
        {uploading ? 'Đang xử lý…' : 'Nén & Đăng ảnh'}
      </button>
    </form>
  </section>

  <section class="card" aria-labelledby="list-heading">
    <div class="list-header">
      <h2 id="list-heading">Danh sách ảnh đã đăng ({photos.length})</h2>
      <div class="filter-bar">
        <label for="filter-flower">Lọc loài:</label>
        <select
          id="filter-flower"
          bind:value={filterFlower}
          onchange={() => fetchPhotos()}
        >
          <option value="">Tất cả loài</option>
          {#each flowers as f}
            <option value={f.slug}>{f.name}</option>
          {/each}
        </select>
        <button type="button" class="btn secondary" onclick={() => fetchPhotos()} disabled={loadingPhotos}>
          Làm mới
        </button>
      </div>
    </div>

    {#if listError}
      <p class="status error" role="alert">{listError}</p>
    {/if}

    {#if loadingPhotos}
      <p class="muted">Đang tải danh sách ảnh…</p>
    {:else if photos.length === 0}
      <p class="muted">Chưa có ảnh nào trong mục này.</p>
    {:else}
      <ul class="photo-list">
        {#each photos as p (p.id)}
          <li class="photo-item" class:is-hidden={p.status === 'rejected'}>
            <div class="thumb">
              {#if p.status === 'approved'}
                <img
                  src={p.src600}
                  alt={p.caption || `Ảnh ${flowerMap.get(p.flower) ?? p.flower}`}
                  loading="lazy"
                  width="160"
                  height="120"
                />
              {:else}
                <div class="thumb-placeholder">
                  {p.status === 'rejected' ? 'Đã ẩn' : 'Chờ duyệt'}
                </div>
              {/if}
            </div>
            <div class="meta">
              <div class="meta-top">
                <strong>{flowerMap.get(p.flower) ?? p.flower}</strong>
                <span class="badge status-{p.status}">
                  {p.status === 'approved'
                    ? 'Đang hiện'
                    : p.status === 'rejected'
                      ? 'Đã ẩn'
                      : 'Chờ duyệt'}
                </span>
              </div>
              {#if p.caption}
                <p class="caption">{p.caption}</p>
              {/if}
              <p class="details">
                <span>Tác giả: <strong>{p.author}</strong> ({p.license})</span>
                {#if p.place}
                  <span> · Điểm: {placeMap.get(p.place) ?? p.place}</span>
                {/if}
                {#if p.taken_on}
                  <span> · Chụp: {p.taken_on}</span>
                {/if}
                {#if p.width && p.height}
                  <span> · {p.width}×{p.height}px</span>
                {/if}
              </p>
              <div class="actions">
                {#if p.status !== 'rejected'}
                  <button
                    type="button"
                    class="btn secondary small"
                    disabled={busyId === p.id}
                    onclick={() => handleHide(p)}
                  >
                    Ẩn ảnh
                  </button>
                {/if}
                <button
                  type="button"
                  class="btn danger small"
                  disabled={busyId === p.id}
                  onclick={() => handleDelete(p)}
                >
                  Xoá hẳn
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .admin-grid {
    display: grid;
    gap: var(--space-6);
    align-items: start;
  }
  .card {
    background: #fff;
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: var(--space-6);
  }
  h2 {
    font-size: 1.25rem;
    margin-bottom: var(--space-2);
  }
  .hint {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
  }
  .upload-form {
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
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.6rem 1.1rem;
    border-radius: 10px;
    border: 1px solid transparent;
    font-weight: 600;
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
  .btn.secondary {
    background: #efeae1;
    color: var(--color-text);
    border-color: #d8d1c5;
  }
  .btn.danger {
    background: #fbe9e7;
    color: #9c2318;
    border-color: #f1b8b3;
  }
  .btn.small {
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
  }
  .status {
    padding: var(--space-3);
    border-radius: 10px;
    font-size: 0.875rem;
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
  .list-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .filter-bar select {
    width: auto;
  }
  .muted {
    color: var(--color-text-muted);
    font-size: 0.9375rem;
  }
  .photo-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  .photo-item {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: var(--space-4);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: #faf8f5;
  }
  .photo-item.is-hidden {
    background: #f3f0eb;
  }
  .thumb {
    aspect-ratio: 4 / 3;
    border-radius: 8px;
    overflow: hidden;
    background: #e6e1d9;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #4a453e;
  }
  .meta {
    display: grid;
    gap: var(--space-1);
    align-content: start;
  }
  .meta-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .badge {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge.status-approved {
    background: #e2f2e5;
    color: #1b5e20;
  }
  .badge.status-rejected {
    background: #ece7df;
    color: #4a453e;
  }
  .badge.status-pending {
    background: #fff3cd;
    color: #664d03;
  }
  .caption {
    font-size: 0.9375rem;
  }
  .details {
    font-size: 0.8125rem;
    color: #4a453e;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  @media (min-width: 1024px) {
    .admin-grid {
      grid-template-columns: 420px 1fr;
    }
  }
</style>
