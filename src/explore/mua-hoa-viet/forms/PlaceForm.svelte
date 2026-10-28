<script lang="ts">
  import {
    PROVINCES_BY_REGION,
    REGION_LABELS,
    getRegionForProvince,
    type RegionCode,
  } from '../provinces';

  export interface PlaceFormFlowerOption {
    slug: string;
    name: string;
  }

  export interface PlaceInitialData {
    slug?: string;
    name?: string;
    province?: string;
    region?: RegionCode;
    maps_url?: string;
    lat?: number | null;
    lng?: number | null;
    flowers?: Array<{ slug: string; best?: unknown }>;
    submitter?: string | null;
  }

  let {
    mode = 'public',
    flowers = [],
    turnstileSiteKey = '',
    initialData = undefined,
    submitLabel = undefined,
    endpoint = undefined,
    method = 'POST',
    onSuccess = undefined,
    onCancel = undefined,
  }: {
    mode?: 'public' | 'admin';
    flowers?: PlaceFormFlowerOption[];
    turnstileSiteKey?: string;
    initialData?: PlaceInitialData;
    submitLabel?: string;
    endpoint?: string;
    method?: 'POST' | 'PUT';
    onSuccess?: (result: Record<string, unknown>) => void;
    onCancel?: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(initialData?.name ?? '');
  // svelte-ignore state_referenced_locally
  let province = $state(initialData?.province ?? 'Lâm Đồng');
  // svelte-ignore state_referenced_locally
  let region = $state<RegionCode>(
    initialData?.region ?? getRegionForProvince(initialData?.province ?? 'Lâm Đồng') ?? 'trung',
  );
  // svelte-ignore state_referenced_locally
  let mapsUrl = $state(initialData?.maps_url ?? '');
  // svelte-ignore state_referenced_locally
  let latStr = $state(
    initialData?.lat !== undefined && initialData?.lat !== null ? String(initialData.lat) : '',
  );
  // svelte-ignore state_referenced_locally
  let lngStr = $state(
    initialData?.lng !== undefined && initialData?.lng !== null ? String(initialData.lng) : '',
  );
  // svelte-ignore state_referenced_locally
  let selectedFlowerSlugs = $state<string[]>(
    initialData?.flowers ? initialData.flowers.map((f) => f.slug) : [],
  );
  // svelte-ignore state_referenced_locally
  let flowerBestMap = $state<Record<string, string>>(
    Object.fromEntries(
      (initialData?.flowers ?? []).map((f) => [
        f.slug,
        typeof f.best === 'string' ? f.best : '',
      ]),
    ),
  );
  // svelte-ignore state_referenced_locally
  let submitter = $state(initialData?.submitter ?? '');

  let formEl: HTMLFormElement | undefined = $state();
  let submitting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  function onProvinceChange(e: Event) {
    const val = (e.currentTarget as HTMLSelectElement).value;
    province = val;
    const inferred = getRegionForProvince(val);
    if (inferred) {
      region = inferred;
    }
  }

  function toggleFlower(slug: string) {
    if (selectedFlowerSlugs.includes(slug)) {
      selectedFlowerSlugs = selectedFlowerSlugs.filter((x) => x !== slug);
    } else {
      selectedFlowerSlugs = [...selectedFlowerSlugs, slug];
    }
  }

  function resetTurnstile() {
    if (typeof window === 'undefined') return;
    const win = window as unknown as { turnstile?: { reset?: () => void } };
    if (win.turnstile && typeof win.turnstile.reset === 'function') {
      try {
        win.turnstile.reset();
      } catch {
        // Bỏ qua
      }
    }
  }

  export function buildPayload():
    | { ok: true; payload: Record<string, unknown> }
    | { ok: false; error: string } {
    if (!name.trim()) {
      return { ok: false, error: 'Vui lòng nhập tên địa điểm.' };
    }
    if (!province.trim()) {
      return { ok: false, error: 'Vui lòng chọn tỉnh / thành phố.' };
    }
    if (!region) {
      return { ok: false, error: 'Vui lòng chọn vùng.' };
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      province: province.trim(),
      region,
      maps_url: mapsUrl.trim() || undefined,
      flowers: selectedFlowerSlugs.map((slug) => ({
        slug,
        best: flowerBestMap[slug]?.trim() || 'Theo mùa',
      })),
    };

    if (mode === 'admin') {
      if (latStr.trim() && lngStr.trim()) {
        const parsedLat = Number(latStr.trim());
        const parsedLng = Number(lngStr.trim());
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
          return { ok: false, error: 'Toạ độ vĩ độ / kinh độ không hợp lệ.' };
        }
        payload.lat = parsedLat;
        payload.lng = parsedLng;
      } else if (initialData && !latStr.trim() && !lngStr.trim() && !mapsUrl.trim()) {
        payload.lat = null;
        payload.lng = null;
      }
    }

    if (submitter.trim()) {
      payload.submitter = submitter.trim();
    }

    return { ok: true, payload };
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    errorMessage = '';
    successMessage = '';

    const built = buildPayload();
    if (!built.ok) {
      errorMessage = built.error;
      return;
    }

    const payload = { ...built.payload };

    if (mode === 'public') {
      const domForm = formEl ? new FormData(formEl) : null;
      const turnstileToken =
        (domForm?.get('cf-turnstile-response') as string | null)?.trim() ?? '';
      if (!turnstileToken) {
        errorMessage = 'Vui lòng hoàn thành xác thực chống spam (Cloudflare Turnstile).';
        return;
      }
      payload['cf-turnstile-response'] = turnstileToken;
    }

    submitting = true;
    const targetUrl =
      endpoint ?? (mode === 'admin' ? '/api/admin/places' : '/api/them-dia-diem');

    try {
      const res = await fetch(targetUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không lưu được địa điểm (${res.status})`);
      }

      successMessage =
        data.message ||
        (mode === 'public'
          ? 'Cảm ơn! Địa điểm sẽ hiện sau khi được duyệt.'
          : 'Đã lưu địa điểm thành công.');

      if (mode === 'public') {
        name = '';
        mapsUrl = '';
        selectedFlowerSlugs = [];
        resetTurnstile();
      }

      onSuccess?.(data);
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      if (mode === 'public') resetTurnstile();
    } finally {
      submitting = false;
    }
  }
</script>

<form bind:this={formEl} onsubmit={handleSubmit} class="place-form">
  <div class="field">
    <label for="place-name-input">Tên địa điểm ngắm hoa *</label>
    <input
      id="place-name-input"
      type="text"
      name="name"
      required
      placeholder="Ví dụ: Đồi chè Cầu Đất, Đèo Hải Vân…"
      bind:value={name}
    />
  </div>

  <div class="row-2">
    <div class="field">
      <label for="place-province-select">Tỉnh / thành phố (34 tỉnh mới) *</label>
      <select
        id="place-province-select"
        name="province"
        value={province}
        onchange={onProvinceChange}
        required
      >
        {#each ['bac', 'trung', 'nam'] as const as r}
          <optgroup label={REGION_LABELS[r]}>
            {#each PROVINCES_BY_REGION[r] as prov}
              <option value={prov}>{prov}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="place-region-select">Vùng *</label>
      <select id="place-region-select" name="region" bind:value={region} required>
        <option value="bac">Miền Bắc</option>
        <option value="trung">Miền Trung</option>
        <option value="nam">Miền Nam</option>
      </select>
    </div>
  </div>

  <div class="field">
    <label for="place-maps-url">Link Google Maps check-in (tuỳ chọn nhưng khuyến khích)</label>
    <input
      id="place-maps-url"
      type="url"
      name="maps_url"
      placeholder="https://maps.app.goo.gl/... hoặc https://www.google.com/maps/place/..."
      bind:value={mapsUrl}
    />
    <small class="field-hint">
      Dán link từ Google Maps (`google.com/maps`, `maps.google.*`, `maps.app.goo.gl`, `goo.gl/maps`). Hệ thống sẽ tự lấy toạ độ để chấm lên bản đồ.
    </small>
  </div>

  {#if mode === 'admin'}
    <div class="row-2">
      <div class="field">
        <label for="place-lat-input">Vĩ độ (lat — nhập tay nếu link không có toạ độ)</label>
        <input
          id="place-lat-input"
          type="number"
          step="any"
          placeholder="Ví dụ: 11.94"
          bind:value={latStr}
        />
      </div>
      <div class="field">
        <label for="place-lng-input">Kinh độ (lng — nhập tay nếu link không có toạ độ)</label>
        <input
          id="place-lng-input"
          type="number"
          step="any"
          placeholder="Ví dụ: 108.458"
          bind:value={lngStr}
        />
      </div>
    </div>
  {/if}

  {#if flowers.length > 0}
    <div class="field">
      <span class="label-text">Loài hoa nở ở địa điểm này</span>
      <div class="flowers-grid">
        {#each flowers as f (f.slug)}
          {@const checked = selectedFlowerSlugs.includes(f.slug)}
          <div class="flower-choice" class:selected={checked}>
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked={checked}
                onchange={() => toggleFlower(f.slug)}
              />
              <span><strong>{f.name}</strong></span>
            </label>
            {#if checked}
              <input
                type="text"
                class="best-input"
                placeholder="Thời điểm đẹp (vd: T10 – T11)"
                bind:value={flowerBestMap[f.slug]}
              />
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="field">
    <label for="place-submitter">Tên người đóng góp (tuỳ chọn)</label>
    <input
      id="place-submitter"
      type="text"
      name="submitter"
      placeholder="Tên hoặc bút danh của bạn"
      bind:value={submitter}
    />
  </div>

  {#if mode === 'public'}
    <div class="turnstile-wrap">
      <div class="cf-turnstile" data-sitekey={turnstileSiteKey}></div>
    </div>
  {/if}

  {#if errorMessage}
    <p class="status error" role="alert">{errorMessage}</p>
  {/if}
  {#if successMessage}
    <p class="status success" role="status">{successMessage}</p>
  {/if}

  <div class="form-actions">
    <button type="submit" class="btn primary" disabled={submitting}>
      {submitting
        ? 'Đang gửi…'
        : submitLabel ?? (mode === 'admin' ? 'Lưu & Duyệt ngay' : 'Gửi điểm ngắm mới')}
    </button>
    {#if onCancel}
      <button type="button" class="btn secondary" onclick={onCancel}>
        Huỷ
      </button>
    {/if}
  </div>
</form>

<style>
  .place-form {
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
  label,
  .label-text {
    font-size: 0.875rem;
    font-weight: 600;
  }
  input[type='text'],
  input[type='url'],
  input[type='number'],
  select {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid #cfc9be;
    border-radius: 10px;
    font: inherit;
    background: #faf8f5;
    color: var(--color-text);
  }
  .field-hint {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .flowers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-2);
    max-height: 260px;
    overflow-y: auto;
    padding: var(--space-2);
    border: 1px solid #e7e2d9;
    border-radius: 12px;
    background: #faf8f5;
  }
  .flower-choice {
    padding: var(--space-2);
    border-radius: 8px;
    border: 1px solid transparent;
    display: grid;
    gap: 6px;
  }
  .flower-choice.selected {
    background: #fff;
    border-color: #cfc9be;
  }
  .best-input {
    font-size: 0.8125rem;
    padding: 0.35rem 0.55rem !important;
  }
  .checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    cursor: pointer;
  }
  .turnstile-wrap {
    min-height: 65px;
  }
  .form-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.65rem 1.2rem;
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
  .btn.secondary {
    background: #efeae1;
    color: var(--color-text);
    border-color: #d8d1c5;
  }
  .status {
    padding: var(--space-3);
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0;
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
