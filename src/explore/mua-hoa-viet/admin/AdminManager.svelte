<script lang="ts">
  import { onMount } from 'svelte';
  import { compressPhotoFile } from '../compressImage';
  import FlowerForm, { type FlowerInitialData } from '../forms/FlowerForm.svelte';
  import PlaceForm, { type PlaceInitialData } from '../forms/PlaceForm.svelte';

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
    maps_url?: string | null;
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
    reviewed_at?: string | null;
    src: string;
    src600: string;
  }

  interface AdminFlowerItem extends FlowerInitialData {
    slug: string;
    name: string;
    status: 'pending' | 'approved' | 'rejected';
    source: 'admin' | 'public';
    submitter: string | null;
    created_at: string;
    reviewed_at: string | null;
    data: FlowerInitialData & { slug: string; name: string };
  }

  interface AdminPlaceItem extends PlaceInitialData {
    slug: string;
    name: string;
    province: string;
    region: 'bac' | 'trung' | 'nam';
    status: 'pending' | 'approved' | 'rejected';
    source: 'admin' | 'public';
    submitter: string | null;
    created_at: string;
    reviewed_at: string | null;
    data: PlaceInitialData & { slug: string; name: string; province: string };
  }

  let {
    flowers,
    places,
  }: {
    flowers: FlowerOption[];
    places: PlaceOption[];
  } = $props();

  let mainSection = $state<'photos' | 'flowers' | 'places'>('photos');

  // --- Trạng thái Build tự động ---
  let buildConfigured = $state<boolean | null>(null);
  let lastBuildAt = $state<string | null>(null);
  let buildWarning = $state('');
  let buildMsg = $state('');
  let triggeringBuild = $state(false);

  // --- State Ảnh ---
  let flower = $state('da-quy');
  let place = $state('');
  let photoMapsUrl = $state('');
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

  let activeTab = $state<'pending' | 'published'>('pending');
  let filterFlower = $state('');
  let photos = $state<AdminPhoto[]>([]);
  let loadingPhotos = $state(false);
  let listError = $state('');
  let busyId = $state<string | null>(null);

  let editDrafts = $state<
    Record<string, { flower: string; caption: string; maps_url: string }>
  >({});

  // --- State Loài hoa bổ sung (D1) ---
  let extraFlowers = $state<AdminFlowerItem[]>([]);
  let loadingFlowers = $state(false);
  let flowerError = $state('');
  let showAddFlower = $state(false);
  let editingFlowerSlug = $state<string | null>(null);
  let busyFlowerSlug = $state<string | null>(null);

  // --- State Địa điểm bổ sung (D1) ---
  let extraPlaces = $state<AdminPlaceItem[]>([]);
  let loadingPlaces = $state(false);
  let placeError = $state('');
  let showAddPlace = $state(false);
  let editingPlaceSlug = $state<string | null>(null);
  let busyPlaceSlug = $state<string | null>(null);

  // Gộp danh sách loài/địa điểm gốc với các mục đã duyệt trong D1
  const allFlowers = $derived.by(() => {
    const map = new Map<string, FlowerOption>();
    for (const f of flowers) map.set(f.slug, f);
    for (const ef of extraFlowers) {
      if (ef.status === 'approved' && !map.has(ef.slug)) {
        map.set(ef.slug, { slug: ef.slug, name: ef.name });
      }
    }
    return Array.from(map.values());
  });

  const allPlaces = $derived.by(() => {
    const map = new Map<string, PlaceOption>();
    for (const p of places) map.set(p.slug, p);
    for (const ep of extraPlaces) {
      if (ep.status === 'approved' && !map.has(ep.slug)) {
        map.set(ep.slug, {
          slug: ep.slug,
          name: ep.name,
          province: ep.province,
          flowers: (ep.data.flowers ?? []).map((f) => f.slug),
        });
      }
    }
    return Array.from(map.values());
  });

  const flowerMap = $derived(new Map(allFlowers.map((f) => [f.slug, f.name])));
  const placeMap = $derived(
    new Map(allPlaces.map((p) => [p.slug, `${p.name} (${p.province})`])),
  );

  const matchingPlaces = $derived(
    allPlaces.filter((p) => p.flowers.includes(flower)),
  );
  const otherPlaces = $derived(
    allPlaces.filter((p) => !p.flowers.includes(flower)),
  );

  const pendingPhotos = $derived(
    photos.filter(
      (p) => p.status === 'pending' && (!filterFlower || p.flower === filterFlower),
    ),
  );
  const totalPendingCount = $derived(
    photos.filter((p) => p.status === 'pending').length,
  );
  const publishedPhotos = $derived(
    photos.filter(
      (p) => p.status !== 'pending' && (!filterFlower || p.flower === filterFlower),
    ),
  );

  const pendingFlowers = $derived(
    extraFlowers.filter((f) => f.status === 'pending'),
  );
  const reviewedFlowers = $derived(
    extraFlowers.filter((f) => f.status !== 'pending'),
  );

  const pendingPlaces = $derived(
    extraPlaces.filter((p) => p.status === 'pending'),
  );
  const reviewedPlaces = $derived(
    extraPlaces.filter((p) => p.status !== 'pending'),
  );

  function syncDrafts(list: AdminPhoto[]) {
    const next = { ...editDrafts };
    for (const p of list) {
      if (!next[p.id]) {
        next[p.id] = {
          flower: p.flower,
          caption: p.caption ?? '',
          maps_url: p.maps_url ?? '',
        };
      }
    }
    editDrafts = next;
  }

  function applyBuildStatus(bs: {
    configured?: boolean;
    lastTriggeredAt?: string | null;
    warning?: string;
  } | null | undefined) {
    if (!bs) return;
    if (typeof bs.configured === 'boolean') {
      buildConfigured = bs.configured;
    }
    if (bs.lastTriggeredAt !== undefined) {
      lastBuildAt = bs.lastTriggeredAt;
    }
    buildWarning = bs.configured === false ? (bs.warning || 'Chưa cấu hình build tự động') : '';
  }

  async function handleTriggerBuildNow() {
    triggeringBuild = true;
    buildMsg = '';
    try {
      const res = await fetch('/api/admin/build', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      applyBuildStatus(data);
      if (data.configured === false) {
        buildWarning = data.warning || 'Chưa cấu hình build tự động';
      } else if (data.triggered) {
        buildMsg = 'Đã gửi lệnh build lại web (mất khoảng 1–2 phút).';
      } else {
        buildMsg = data.error || 'Đã gửi yêu cầu build.';
      }
    } catch (err) {
      buildMsg = err instanceof Error ? err.message : 'Lỗi gọi API build';
    } finally {
      triggeringBuild = false;
    }
  }

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    selectedFiles = input.files ? Array.from(input.files) : [];
    uploadError = '';
    uploadSuccess = '';
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

        const { full, fileMain, file600 } = await compressPhotoFile(rawFile, 0.8);

        const form = new FormData();
        form.append('file', fileMain);
        form.append('file600', file600);
        form.append('flower', flower);
        if (place.trim()) form.append('place', place.trim());
        if (photoMapsUrl.trim()) form.append('maps_url', photoMapsUrl.trim());
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
      photoMapsUrl = '';
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
      const res = await fetch('/api/admin/photos');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không tải được danh sách ảnh (${res.status})`);
      }
      const data = await res.json();
      const loaded: AdminPhoto[] = Array.isArray(data) ? data : (data.photos ?? []);
      photos = loaded;
      syncDrafts(loaded);
    } catch (err) {
      listError = err instanceof Error ? err.message : 'Lỗi kết nối API';
    } finally {
      loadingPhotos = false;
    }
  }

  async function fetchExtraFlowers() {
    loadingFlowers = true;
    flowerError = '';
    try {
      const res = await fetch('/api/admin/flowers');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không tải được danh sách loài hoa (${res.status})`);
      }
      const data = await res.json();
      extraFlowers = data.flowers ?? [];
      applyBuildStatus(data.buildStatus);
    } catch (err) {
      flowerError = err instanceof Error ? err.message : 'Lỗi tải danh sách loài hoa';
    } finally {
      loadingFlowers = false;
    }
  }

  async function fetchExtraPlaces() {
    loadingPlaces = true;
    placeError = '';
    try {
      const res = await fetch('/api/admin/places');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không tải được danh sách địa điểm (${res.status})`);
      }
      const data = await res.json();
      extraPlaces = data.places ?? [];
      applyBuildStatus(data.buildStatus);
    } catch (err) {
      placeError = err instanceof Error ? err.message : 'Lỗi tải danh sách địa điểm';
    } finally {
      loadingPlaces = false;
    }
  }

  async function handleApprove(photo: AdminPhoto) {
    busyId = photo.id;
    listError = '';
    const draft = editDrafts[photo.id] ?? {
      flower: photo.flower,
      caption: photo.caption ?? '',
      maps_url: photo.maps_url ?? '',
    };
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flower: draft.flower,
          caption: draft.caption.trim() || null,
          maps_url: draft.maps_url.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không thể duyệt ảnh (${res.status})`);
      }
      const updated = await res.json().catch(() => null);
      photos = photos.map((p) =>
        p.id === photo.id
          ? {
              ...p,
              status: 'approved',
              flower: draft.flower,
              caption: draft.caption.trim() || null,
              maps_url: draft.maps_url.trim() || null,
              reviewed_at: updated?.reviewed_at ?? new Date().toISOString(),
              src: `/api/anh/${p.id}.webp`,
              src600: `/api/anh/${p.id}-600.webp`,
            }
          : p,
      );
    } catch (err) {
      listError = err instanceof Error ? err.message : 'Lỗi khi duyệt ảnh';
    } finally {
      busyId = null;
    }
  }

  async function handleReject(photo: AdminPhoto) {
    busyId = photo.id;
    listError = '';
    try {
      const res = await fetch(`/api/admin/photos/${encodeURIComponent(photo.id)}/reject`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Không thể từ chối ảnh (${res.status})`);
      }
      photos = photos.map((p) =>
        p.id === photo.id
          ? { ...p, status: 'rejected', reviewed_at: new Date().toISOString() }
          : p,
      );
    } catch (err) {
      listError = err instanceof Error ? err.message : 'Lỗi khi từ chối ảnh';
    } finally {
      busyId = null;
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

  async function handleQuickApproveFlower(slug: string) {
    busyFlowerSlug = slug;
    flowerError = '';
    try {
      const res = await fetch(`/api/admin/flowers/${encodeURIComponent(slug)}/approve`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không thể duyệt loài hoa (${res.status})`);
      }
      applyBuildStatus(data.build);
      await Promise.all([fetchExtraFlowers(), fetchExtraPlaces()]);
    } catch (err) {
      flowerError = err instanceof Error ? err.message : 'Lỗi khi duyệt loài hoa';
    } finally {
      busyFlowerSlug = null;
    }
  }

  async function handleRejectFlower(slug: string) {
    busyFlowerSlug = slug;
    flowerError = '';
    try {
      const res = await fetch(`/api/admin/flowers/${encodeURIComponent(slug)}/reject`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không thể từ chối loài hoa (${res.status})`);
      }
      await fetchExtraFlowers();
    } catch (err) {
      flowerError = err instanceof Error ? err.message : 'Lỗi khi từ chối loài hoa';
    } finally {
      busyFlowerSlug = null;
    }
  }

  async function handleQuickApprovePlace(slug: string) {
    busyPlaceSlug = slug;
    placeError = '';
    try {
      const res = await fetch(`/api/admin/places/${encodeURIComponent(slug)}/approve`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không thể duyệt địa điểm (${res.status})`);
      }
      applyBuildStatus(data.build);
      await fetchExtraPlaces();
    } catch (err) {
      placeError = err instanceof Error ? err.message : 'Lỗi khi duyệt địa điểm';
    } finally {
      busyPlaceSlug = null;
    }
  }

  async function handleRejectPlace(slug: string) {
    busyPlaceSlug = slug;
    placeError = '';
    try {
      const res = await fetch(`/api/admin/places/${encodeURIComponent(slug)}/reject`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không thể từ chối địa điểm (${res.status})`);
      }
      await fetchExtraPlaces();
    } catch (err) {
      placeError = err instanceof Error ? err.message : 'Lỗi khi từ chối địa điểm';
    } finally {
      busyPlaceSlug = null;
    }
  }

  onMount(() => {
    fetchPhotos();
    fetchExtraFlowers();
    fetchExtraPlaces();
  });
</script>

<div class="top-admin-bar">
  <div class="main-tabs" role="tablist" aria-label="Chuyên mục quản trị">
    <button
      type="button"
      role="tab"
      aria-selected={mainSection === 'photos'}
      class="main-tab-btn"
      class:active={mainSection === 'photos'}
      onclick={() => (mainSection = 'photos')}
    >
      Ảnh ({totalPendingCount} chờ duyệt)
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={mainSection === 'flowers'}
      class="main-tab-btn"
      class:active={mainSection === 'flowers'}
      onclick={() => (mainSection = 'flowers')}
    >
      Loài hoa ({pendingFlowers.length})
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={mainSection === 'places'}
      class="main-tab-btn"
      class:active={mainSection === 'places'}
      onclick={() => (mainSection = 'places')}
    >
      Địa điểm ({pendingPlaces.length})
    </button>
  </div>

  <div class="build-box">
    {#if buildConfigured === false || buildWarning}
      <span class="build-warning" role="status">
        ⚠️ {buildWarning || 'Chưa cấu hình build tự động'}
      </span>
    {/if}
    <button
      type="button"
      class="btn secondary small"
      disabled={triggeringBuild}
      onclick={handleTriggerBuildNow}
    >
      {triggeringBuild ? 'Đang gọi build…' : 'Build lại web ngay'}
    </button>
  </div>
</div>

{#if buildMsg}
  <p class="status info build-msg" role="status">{buildMsg}</p>
{/if}

{#if mainSection === 'photos'}
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
            {#each allFlowers as f}
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
          <label for="admin-photo-maps-url">Link Google Maps chỗ chụp (tuỳ chọn)</label>
          <input
            id="admin-photo-maps-url"
            type="url"
            placeholder="https://maps.app.goo.gl/... hoặc https://www.google.com/maps/..."
            bind:value={photoMapsUrl}
          />
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
        <div class="tabs" role="tablist" aria-label="Phân loại danh sách ảnh">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending'}
            class="tab-btn"
            class:active={activeTab === 'pending'}
            onclick={() => (activeTab = 'pending')}
          >
            Chờ duyệt ({totalPendingCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'published'}
            class="tab-btn"
            class:active={activeTab === 'published'}
            onclick={() => (activeTab = 'published')}
          >
            Đã đăng ({publishedPhotos.length})
          </button>
        </div>

        <div class="filter-bar">
          <label for="filter-flower">Lọc loài:</label>
          <select id="filter-flower" bind:value={filterFlower}>
            <option value="">Tất cả loài</option>
            {#each allFlowers as f}
              <option value={f.slug}>{f.name}</option>
            {/each}
          </select>
          <button
            type="button"
            class="btn secondary"
            onclick={() => fetchPhotos()}
            disabled={loadingPhotos}
          >
            Làm mới
          </button>
        </div>
      </div>

      <h2 id="list-heading" class="sr-only">
        {activeTab === 'pending'
          ? `Chờ duyệt (${pendingPhotos.length})`
          : `Danh sách ảnh đã đăng (${publishedPhotos.length})`}
      </h2>

      {#if listError}
        <p class="status error" role="alert">{listError}</p>
      {/if}

      {#if loadingPhotos}
        <p class="muted">Đang tải danh sách ảnh…</p>
      {:else if activeTab === 'pending'}
        {#if pendingPhotos.length === 0}
          <p class="muted">Không có ảnh nào đang chờ duyệt.</p>
        {:else}
          <ul class="photo-list">
            {#each pendingPhotos as p (p.id)}
              {@const adminFullUrl = `/api/admin/anh/${p.id}.webp`}
              {@const adminThumbUrl = `/api/admin/anh/${p.id}-600.webp`}
              <li class="photo-item pending-item">
                <div class="thumb">
                  <a href={adminFullUrl} target="_blank" rel="noopener" title="Xem ảnh gốc cỡ lớn">
                    <img
                      src={adminThumbUrl}
                      alt={p.caption || `Ảnh chờ duyệt ${flowerMap.get(p.flower) ?? p.flower}`}
                      loading="lazy"
                      width="160"
                      height="120"
                    />
                  </a>
                  <a href={adminFullUrl} target="_blank" rel="noopener" class="view-full-link">
                    Xem ảnh to ↗
                  </a>
                </div>
                <div class="meta">
                  <div class="meta-top">
                    <strong>{flowerMap.get(p.flower) ?? p.flower}</strong>
                    <span class="badge status-pending">Chờ duyệt</span>
                  </div>

                  <p class="details">
                    <span>
                      Người gửi:
                      {#if p.author_link}
                        <a href={p.author_link} target="_blank" rel="noopener">
                          <strong>{p.author}</strong>
                        </a>
                      {:else}
                        <strong>{p.author}</strong>
                      {/if}
                      ({p.license})
                    </span>
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

                  {#if editDrafts[p.id]}
                    <div class="inline-edit">
                      <div class="field">
                        <label for="edit-flower-{p.id}">Loài hoa</label>
                        <select
                          id="edit-flower-{p.id}"
                          bind:value={editDrafts[p.id].flower}
                          disabled={busyId === p.id}
                        >
                          {#each allFlowers as f}
                            <option value={f.slug}>{f.name} ({f.slug})</option>
                          {/each}
                        </select>
                      </div>
                      <div class="field">
                        <label for="edit-caption-{p.id}">Chú thích</label>
                        <input
                          id="edit-caption-{p.id}"
                          type="text"
                          placeholder="Thêm hoặc sửa chú thích ảnh…"
                          bind:value={editDrafts[p.id].caption}
                          disabled={busyId === p.id}
                        />
                      </div>
                    </div>
                  {/if}

                  <div class="actions">
                    <button
                      type="button"
                      class="btn approve small"
                      disabled={busyId === p.id}
                      onclick={() => handleApprove(p)}
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      class="btn danger small"
                      disabled={busyId === p.id}
                      onclick={() => handleReject(p)}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if publishedPhotos.length === 0}
        <p class="muted">Chưa có ảnh nào trong mục này.</p>
      {:else}
        <ul class="photo-list">
          {#each publishedPhotos as p (p.id)}
            <li class="photo-item" class:is-hidden={p.status === 'rejected'}>
              <div class="thumb">
                {#if p.status === 'approved'}
                  <a href={`/api/admin/anh/${p.id}.webp`} target="_blank" rel="noopener">
                    <img
                      src={p.src600}
                      alt={p.caption || `Ảnh ${flowerMap.get(p.flower) ?? p.flower}`}
                      loading="lazy"
                      width="160"
                      height="120"
                    />
                  </a>
                {:else}
                  <div class="thumb-placeholder">
                    {p.status === 'rejected' ? 'Đã ẩn / Từ chối' : 'Chờ duyệt'}
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
                  {#if p.maps_url}
                    <span>
                      · <a href={p.maps_url} target="_blank" rel="noopener noreferrer">Chỗ chụp trên Maps ↗</a>
                    </span>
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
{:else if mainSection === 'flowers'}
  <section class="card" aria-labelledby="flowers-admin-heading">
    <div class="list-header">
      <h2 id="flowers-admin-heading">Quản trị loài hoa bổ sung (D1)</h2>
      <div class="filter-bar">
        <button
          type="button"
          class="btn primary small"
          onclick={() => {
            showAddFlower = !showAddFlower;
            editingFlowerSlug = null;
          }}
        >
          {showAddFlower ? 'Đóng form thêm' : '+ Thêm loài'}
        </button>
        <button
          type="button"
          class="btn secondary small"
          onclick={() => fetchExtraFlowers()}
          disabled={loadingFlowers}
        >
          Làm mới
        </button>
      </div>
    </div>

    {#if flowerError}
      <p class="status error" role="alert">{flowerError}</p>
    {/if}

    {#if showAddFlower}
      <div class="subform-box">
        <h3>Thêm loài hoa mới (Admin — duyệt ngay)</h3>
        <FlowerForm
          mode="admin"
          places={allPlaces}
          endpoint="/api/admin/flowers"
          submitLabel="Thêm & Duyệt ngay"
          onSuccess={(res) => {
            showAddFlower = false;
            applyBuildStatus(res.build as Record<string, unknown>);
            fetchExtraFlowers();
            fetchExtraPlaces();
          }}
          onCancel={() => (showAddFlower = false)}
        />
      </div>
    {/if}

    <h3>Chờ duyệt ({pendingFlowers.length})</h3>
    {#if loadingFlowers}
      <p class="muted">Đang tải danh sách loài hoa…</p>
    {:else if pendingFlowers.length === 0}
      <p class="muted">Không có loài hoa nào đang chờ duyệt.</p>
    {:else}
      <ul class="extra-list">
        {#each pendingFlowers as item (item.slug)}
          <li class="extra-item">
            <div class="extra-top">
              <div>
                <strong>{item.name}</strong>
                <code>({item.slug})</code>
                <span class="badge status-pending">Chờ duyệt</span>
                {#if item.submitter}
                  <small class="muted">· Người gửi: {item.submitter}</small>
                {/if}
              </div>
              <div class="actions">
                <button
                  type="button"
                  class="btn secondary small"
                  onclick={() =>
                    (editingFlowerSlug = editingFlowerSlug === item.slug ? null : item.slug)}
                >
                  {editingFlowerSlug === item.slug ? 'Thu gọn' : 'Xem / Sửa mọi trường'}
                </button>
                <button
                  type="button"
                  class="btn approve small"
                  disabled={busyFlowerSlug === item.slug}
                  onclick={() => handleQuickApproveFlower(item.slug)}
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  class="btn danger small"
                  disabled={busyFlowerSlug === item.slug}
                  onclick={() => handleRejectFlower(item.slug)}
                >
                  Từ chối
                </button>
              </div>
            </div>

            {#if editingFlowerSlug === item.slug}
              <div class="subform-box">
                <FlowerForm
                  mode="admin"
                  places={allPlaces}
                  initialData={item.data}
                  endpoint={`/api/admin/flowers/${encodeURIComponent(item.slug)}/approve`}
                  submitLabel="Lưu chỉnh sửa & Duyệt"
                  onSuccess={(res) => {
                    editingFlowerSlug = null;
                    applyBuildStatus(res.build as Record<string, unknown>);
                    fetchExtraFlowers();
                    fetchExtraPlaces();
                  }}
                  onCancel={() => (editingFlowerSlug = null)}
                />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h3 class="mt-6">Loài hoa đã xử lý từ D1 ({reviewedFlowers.length})</h3>
    <p class="hint">
      Các loài gốc trong <code>flowers.json</code> không sửa tại đây; chỉ sửa các loài đã lưu trong D1.
    </p>
    {#if reviewedFlowers.length === 0}
      <p class="muted">Chưa có loài hoa nào đã duyệt từ D1.</p>
    {:else}
      <ul class="extra-list">
        {#each reviewedFlowers as item (item.slug)}
          <li class="extra-item">
            <div class="extra-top">
              <div>
                <strong>{item.name}</strong>
                <code>({item.slug})</code>
                <span class="badge status-{item.status}">
                  {item.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
                </span>
              </div>
              <div class="actions">
                <button
                  type="button"
                  class="btn secondary small"
                  onclick={() =>
                    (editingFlowerSlug = editingFlowerSlug === item.slug ? null : item.slug)}
                >
                  {editingFlowerSlug === item.slug ? 'Đóng' : 'Sửa'}
                </button>
                {#if item.status !== 'approved'}
                  <button
                    type="button"
                    class="btn approve small"
                    disabled={busyFlowerSlug === item.slug}
                    onclick={() => handleQuickApproveFlower(item.slug)}
                  >
                    Duyệt lại
                  </button>
                {/if}
                {#if item.status === 'approved'}
                  <button
                    type="button"
                    class="btn danger small"
                    disabled={busyFlowerSlug === item.slug}
                    onclick={() => handleRejectFlower(item.slug)}
                  >
                    Ẩn / Từ chối
                  </button>
                {/if}
              </div>
            </div>

            {#if editingFlowerSlug === item.slug}
              <div class="subform-box">
                <FlowerForm
                  mode="admin"
                  places={allPlaces}
                  initialData={item.data}
                  endpoint={`/api/admin/flowers/${encodeURIComponent(item.slug)}`}
                  method="PUT"
                  submitLabel="Cập nhật loài hoa"
                  onSuccess={(res) => {
                    editingFlowerSlug = null;
                    applyBuildStatus(res.build as Record<string, unknown>);
                    fetchExtraFlowers();
                  }}
                  onCancel={() => (editingFlowerSlug = null)}
                />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{:else if mainSection === 'places'}
  <section class="card" aria-labelledby="places-admin-heading">
    <div class="list-header">
      <h2 id="places-admin-heading">Quản trị địa điểm ngắm hoa bổ sung (D1)</h2>
      <div class="filter-bar">
        <button
          type="button"
          class="btn primary small"
          onclick={() => {
            showAddPlace = !showAddPlace;
            editingPlaceSlug = null;
          }}
        >
          {showAddPlace ? 'Đóng form thêm' : '+ Thêm địa điểm'}
        </button>
        <button
          type="button"
          class="btn secondary small"
          onclick={() => fetchExtraPlaces()}
          disabled={loadingPlaces}
        >
          Làm mới
        </button>
      </div>
    </div>

    {#if placeError}
      <p class="status error" role="alert">{placeError}</p>
    {/if}

    {#if showAddPlace}
      <div class="subform-box">
        <h3>Thêm địa điểm mới (Admin — duyệt ngay)</h3>
        <PlaceForm
          mode="admin"
          flowers={allFlowers}
          endpoint="/api/admin/places"
          submitLabel="Thêm & Duyệt ngay"
          onSuccess={(res) => {
            showAddPlace = false;
            applyBuildStatus(res.build as Record<string, unknown>);
            fetchExtraPlaces();
          }}
          onCancel={() => (showAddPlace = false)}
        />
      </div>
    {/if}

    <h3>Chờ duyệt ({pendingPlaces.length})</h3>
    {#if loadingPlaces}
      <p class="muted">Đang tải danh sách địa điểm…</p>
    {:else if pendingPlaces.length === 0}
      <p class="muted">Không có địa điểm nào đang chờ duyệt.</p>
    {:else}
      <ul class="extra-list">
        {#each pendingPlaces as item (item.slug)}
          <li class="extra-item">
            <div class="extra-top">
              <div>
                <strong>{item.name}</strong>, {item.province}
                <code>({item.slug})</code>
                <span class="badge status-pending">Chờ duyệt</span>
                {#if item.data.lat != null && item.data.lng != null}
                  <small class="muted">· Toạ độ: {item.data.lat}, {item.data.lng}</small>
                {:else}
                  <small class="muted">· Chưa có toạ độ (có thể nhập tay khi duyệt)</small>
                {/if}
                {#if item.data.maps_url}
                  · <a href={item.data.maps_url} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
                {/if}
              </div>
              <div class="actions">
                <button
                  type="button"
                  class="btn secondary small"
                  onclick={() =>
                    (editingPlaceSlug = editingPlaceSlug === item.slug ? null : item.slug)}
                >
                  {editingPlaceSlug === item.slug ? 'Thu gọn' : 'Xem / Sửa / Nhập toạ độ'}
                </button>
                <button
                  type="button"
                  class="btn approve small"
                  disabled={busyPlaceSlug === item.slug}
                  onclick={() => handleQuickApprovePlace(item.slug)}
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  class="btn danger small"
                  disabled={busyPlaceSlug === item.slug}
                  onclick={() => handleRejectPlace(item.slug)}
                >
                  Từ chối
                </button>
              </div>
            </div>

            {#if editingPlaceSlug === item.slug}
              <div class="subform-box">
                <PlaceForm
                  mode="admin"
                  flowers={allFlowers}
                  initialData={item.data}
                  endpoint={`/api/admin/places/${encodeURIComponent(item.slug)}/approve`}
                  submitLabel="Lưu chỉnh sửa & Duyệt"
                  onSuccess={(res) => {
                    editingPlaceSlug = null;
                    applyBuildStatus(res.build as Record<string, unknown>);
                    fetchExtraPlaces();
                  }}
                  onCancel={() => (editingPlaceSlug = null)}
                />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <h3 class="mt-6">Địa điểm đã xử lý từ D1 ({reviewedPlaces.length})</h3>
    {#if reviewedPlaces.length === 0}
      <p class="muted">Chưa có địa điểm nào đã duyệt từ D1.</p>
    {:else}
      <ul class="extra-list">
        {#each reviewedPlaces as item (item.slug)}
          <li class="extra-item">
            <div class="extra-top">
              <div>
                <strong>{item.name}</strong>, {item.province}
                <code>({item.slug})</code>
                <span class="badge status-{item.status}">
                  {item.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
                </span>
                {#if item.data.maps_url}
                  · <a href={item.data.maps_url} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
                {/if}
              </div>
              <div class="actions">
                <button
                  type="button"
                  class="btn secondary small"
                  onclick={() =>
                    (editingPlaceSlug = editingPlaceSlug === item.slug ? null : item.slug)}
                >
                  {editingPlaceSlug === item.slug ? 'Đóng' : 'Sửa'}
                </button>
                {#if item.status !== 'approved'}
                  <button
                    type="button"
                    class="btn approve small"
                    disabled={busyPlaceSlug === item.slug}
                    onclick={() => handleQuickApprovePlace(item.slug)}
                  >
                    Duyệt lại
                  </button>
                {/if}
                {#if item.status === 'approved'}
                  <button
                    type="button"
                    class="btn danger small"
                    disabled={busyPlaceSlug === item.slug}
                    onclick={() => handleRejectPlace(item.slug)}
                  >
                    Ẩn / Từ chối
                  </button>
                {/if}
              </div>
            </div>

            {#if editingPlaceSlug === item.slug}
              <div class="subform-box">
                <PlaceForm
                  mode="admin"
                  flowers={allFlowers}
                  initialData={item.data}
                  endpoint={`/api/admin/places/${encodeURIComponent(item.slug)}`}
                  method="PUT"
                  submitLabel="Cập nhật địa điểm"
                  onSuccess={(res) => {
                    editingPlaceSlug = null;
                    applyBuildStatus(res.build as Record<string, unknown>);
                    fetchExtraPlaces();
                  }}
                  onCancel={() => (editingPlaceSlug = null)}
                />
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

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
  .top-admin-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .main-tabs {
    display: inline-flex;
    flex-wrap: wrap;
    background: #efeae1;
    padding: 4px;
    border-radius: 12px;
    gap: 4px;
  }
  .main-tab-btn {
    border: 0;
    background: transparent;
    color: #4a453e;
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
  }
  .main-tab-btn.active {
    background: #fff;
    color: var(--color-text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
  .build-box {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .build-warning {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #8a5300;
    background: #fff8e1;
    border: 1px solid #ffe082;
    padding: 0.35rem 0.7rem;
    border-radius: 8px;
  }
  .build-msg {
    margin-bottom: var(--space-4);
  }
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
  h3 {
    font-size: 1.0625rem;
    margin-bottom: var(--space-3);
  }
  .mt-6 {
    margin-top: var(--space-6);
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
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.6rem 1.1rem;
    border-radius: 10px;
    border: 1px solid transparent;
    font-weight: 600;
    cursor: pointer;
    font: inherit;
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn.primary {
    background: var(--color-text);
    color: #faf8f5;
  }
  .btn.approve {
    background: #1b5e20;
    color: #fff;
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
  .tabs {
    display: inline-flex;
    background: #efeae1;
    padding: 4px;
    border-radius: 12px;
    gap: 4px;
  }
  .tab-btn {
    border: 0;
    background: transparent;
    color: #4a453e;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
  }
  .tab-btn.active {
    background: #fff;
    color: var(--color-text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
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
  .photo-list,
  .extra-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  .photo-item {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: var(--space-4);
    padding: var(--space-3);
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    background: #faf8f5;
  }
  .pending-item {
    background: #fffdf7;
    border-color: #e6d7a8;
  }
  .photo-item.is-hidden {
    opacity: 0.65;
  }
  .thumb {
    display: grid;
    gap: 4px;
  }
  .thumb img {
    width: 160px;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
    display: block;
    background: #e9e4da;
  }
  .view-full-link {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-align: center;
  }
  .thumb-placeholder {
    width: 160px;
    height: 120px;
    border-radius: 10px;
    background: #e9e4da;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--space-2);
  }
  .meta {
    display: grid;
    gap: var(--space-2);
    align-content: start;
  }
  .meta-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .status-approved {
    background: #e8f5e9;
    color: #1e5e2a;
  }
  .status-pending {
    background: #fff8e1;
    color: #8a5300;
  }
  .status-rejected {
    background: #fbe9e7;
    color: #9c2318;
  }
  .caption {
    font-size: 0.9375rem;
    margin: 0;
  }
  .details {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
  }
  .inline-edit {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: var(--space-3);
    padding: var(--space-2) 0;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .extra-item {
    padding: var(--space-4);
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    background: #faf8f5;
    display: grid;
    gap: var(--space-3);
  }
  .extra-top {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }
  .subform-box {
    margin-top: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-4);
    border: 1px solid #d8d1c5;
    border-radius: 14px;
    background: #fff;
  }
  @media (min-width: 960px) {
    .admin-grid {
      grid-template-columns: 380px 1fr;
    }
  }
  @media (max-width: 600px) {
    .photo-item {
      grid-template-columns: 1fr;
    }
    .row-2,
    .inline-edit {
      grid-template-columns: 1fr;
    }
  }
</style>
