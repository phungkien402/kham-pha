<script lang="ts">
  import {
    FLOWER_COLOR_PALETTE,
    PROVINCES_BY_REGION,
    REGION_LABELS,
    getRegionForProvince,
    type RegionCode,
  } from '../provinces';

  export interface FlowerFormPlaceOption {
    slug: string;
    name: string;
    province: string;
  }

  export interface SeasonDraft {
    startMonth: number;
    startDay: string;
    peakMonth: string;
    peakDay: string;
    endMonth: number;
    endDay: string;
    note: string;
  }

  export interface InlinePlaceDraft {
    name: string;
    province: string;
    region: RegionCode;
    maps_url: string;
    best: string;
  }

  export interface FlowerInitialData {
    slug?: string;
    name?: string;
    scientificName?: string;
    aka?: string;
    color?: string;
    regionLabel?: string;
    regions?: RegionCode[];
    seasons?: Array<{
      start: { month: number; day?: number };
      peak?: { month: number; day?: number };
      end: { month: number; day?: number };
      note?: string;
    }>;
    places?: Array<{ slug: string; best?: string }>;
    summary?: string;
    facts?: Array<{ value: string; label: string }>;
    identify?: string[];
    confusedWith?: { name: string; ours: string; theirs: string };
    didYouKnow?: Array<{ title: string; text: string }>;
    dayMoments?: Array<{
      label: string;
      color: string;
      headline: string;
      scene: string;
      tip: string;
    }>;
    quote?: { text: string; author: string; place: string; year: number };
    tips?: string[];
    submitter?: string | null;
  }

  let {
    mode = 'public',
    places = [],
    turnstileSiteKey = '',
    initialData = undefined,
    submitLabel = undefined,
    endpoint = undefined,
    method = 'POST',
    onSuccess = undefined,
    onCancel = undefined,
  }: {
    mode?: 'public' | 'admin';
    places?: FlowerFormPlaceOption[];
    turnstileSiteKey?: string;
    initialData?: FlowerInitialData;
    submitLabel?: string;
    endpoint?: string;
    method?: 'POST' | 'PUT';
    onSuccess?: (result: Record<string, unknown>) => void;
    onCancel?: () => void;
  } = $props();

  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  // svelte-ignore state_referenced_locally
  let name = $state(initialData?.name ?? '');
  // svelte-ignore state_referenced_locally
  let scientificName = $state(initialData?.scientificName ?? '');
  // svelte-ignore state_referenced_locally
  let aka = $state(initialData?.aka ?? '');
  // svelte-ignore state_referenced_locally
  let useAutoColor = $state(!initialData?.color);
  // svelte-ignore state_referenced_locally
  let color = $state(initialData?.color || FLOWER_COLOR_PALETTE[0]);
  // svelte-ignore state_referenced_locally
  let regionLabel = $state(initialData?.regionLabel ?? '');
  // svelte-ignore state_referenced_locally
  let regions = $state<RegionCode[]>(
    initialData?.regions && initialData.regions.length > 0
      ? [...initialData.regions]
      : ['bac'],
  );

  // svelte-ignore state_referenced_locally
  let seasons = $state<SeasonDraft[]>(
    initialData?.seasons && initialData.seasons.length > 0
      ? initialData.seasons.map((s) => ({
          startMonth: s.start.month,
          startDay: s.start.day ? String(s.start.day) : '',
          peakMonth: s.peak?.month ? String(s.peak.month) : '',
          peakDay: s.peak?.day ? String(s.peak.day) : '',
          endMonth: s.end.month,
          endDay: s.end.day ? String(s.end.day) : '',
          note: s.note ?? '',
        }))
      : [
          {
            startMonth: 10,
            startDay: '',
            peakMonth: '',
            peakDay: '',
            endMonth: 11,
            endDay: '',
            note: '',
          },
        ],
  );

  // svelte-ignore state_referenced_locally
  let selectedPlaceSlugs = $state<string[]>(
    initialData?.places ? initialData.places.map((p) => p.slug) : [],
  );
  // svelte-ignore state_referenced_locally
  let placeBestMap = $state<Record<string, string>>(
    Object.fromEntries((initialData?.places ?? []).map((p) => [p.slug, p.best ?? ''])),
  );
  let newPlaces = $state<InlinePlaceDraft[]>([]);

  // Trường không bắt buộc
  // svelte-ignore state_referenced_locally
  let summary = $state(initialData?.summary ?? '');
  // svelte-ignore state_referenced_locally
  let identifyText = $state((initialData?.identify ?? []).join('\n'));
  // svelte-ignore state_referenced_locally
  let tipsText = $state((initialData?.tips ?? []).join('\n'));
  // svelte-ignore state_referenced_locally
  let facts = $state<Array<{ value: string; label: string }>>(
    initialData?.facts ? initialData.facts.map((f) => ({ ...f })) : [],
  );
  // svelte-ignore state_referenced_locally
  let confusedName = $state(initialData?.confusedWith?.name ?? '');
  // svelte-ignore state_referenced_locally
  let confusedOurs = $state(initialData?.confusedWith?.ours ?? '');
  // svelte-ignore state_referenced_locally
  let confusedTheirs = $state(initialData?.confusedWith?.theirs ?? '');
  // svelte-ignore state_referenced_locally
  let didYouKnow = $state<Array<{ title: string; text: string }>>(
    initialData?.didYouKnow ? initialData.didYouKnow.map((d) => ({ ...d })) : [],
  );
  // svelte-ignore state_referenced_locally
  let dayMoments = $state<
    Array<{ label: string; color: string; headline: string; scene: string; tip: string }>
  >(initialData?.dayMoments ? initialData.dayMoments.map((m) => ({ ...m })) : []);
  // svelte-ignore state_referenced_locally
  let quoteText = $state(initialData?.quote?.text ?? '');
  // svelte-ignore state_referenced_locally
  let quoteAuthor = $state(initialData?.quote?.author ?? '');
  // svelte-ignore state_referenced_locally
  let quotePlace = $state(initialData?.quote?.place ?? '');
  // svelte-ignore state_referenced_locally
  let quoteYear = $state(
    initialData?.quote?.year ? String(initialData.quote.year) : String(new Date().getFullYear()),
  );
  // svelte-ignore state_referenced_locally
  let submitter = $state(initialData?.submitter ?? '');

  let formEl: HTMLFormElement | undefined = $state();
  let submitting = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  function toggleRegion(r: RegionCode) {
    if (regions.includes(r)) {
      regions = regions.filter((x) => x !== r);
    } else {
      regions = [...regions, r];
    }
  }

  function togglePlaceSlug(slug: string) {
    if (selectedPlaceSlugs.includes(slug)) {
      selectedPlaceSlugs = selectedPlaceSlugs.filter((x) => x !== slug);
    } else {
      selectedPlaceSlugs = [...selectedPlaceSlugs, slug];
    }
  }

  function addSeason() {
    seasons = [
      ...seasons,
      {
        startMonth: 1,
        startDay: '',
        peakMonth: '',
        peakDay: '',
        endMonth: 2,
        endDay: '',
        note: '',
      },
    ];
  }

  function removeSeason(index: number) {
    if (seasons.length <= 1) return;
    seasons = seasons.filter((_, i) => i !== index);
  }

  function addInlinePlace() {
    newPlaces = [
      ...newPlaces,
      {
        name: '',
        province: 'Lâm Đồng',
        region: 'trung',
        maps_url: '',
        best: '',
      },
    ];
  }

  function removeInlinePlace(index: number) {
    newPlaces = newPlaces.filter((_, i) => i !== index);
  }

  function onInlineProvinceChange(index: number, province: string) {
    const inferred = getRegionForProvince(province);
    newPlaces[index].province = province;
    if (inferred) {
      newPlaces[index].region = inferred;
    }
  }

  function addFact() {
    facts = [...facts, { value: '', label: '' }];
  }

  function removeFact(index: number) {
    facts = facts.filter((_, i) => i !== index);
  }

  function addDidYouKnow() {
    didYouKnow = [...didYouKnow, { title: '', text: '' }];
  }

  function removeDidYouKnow(index: number) {
    didYouKnow = didYouKnow.filter((_, i) => i !== index);
  }

  function addDayMoment() {
    dayMoments = [
      ...dayMoments,
      {
        label: 'Sáng',
        color: '#F7DC7A',
        headline: '',
        scene: '',
        tip: '',
      },
    ];
  }

  function removeDayMoment(index: number) {
    dayMoments = dayMoments.filter((_, i) => i !== index);
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

  export function buildPayload(): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
    if (!name.trim()) {
      return { ok: false, error: 'Vui lòng nhập tên tiếng Việt của loài hoa.' };
    }
    if (seasons.length === 0) {
      return { ok: false, error: 'Cần ít nhất 1 đợt nở.' };
    }
    if (regions.length === 0) {
      return { ok: false, error: 'Vui lòng chọn ít nhất 1 vùng (Bắc / Trung / Nam).' };
    }

    const validNewPlaces = newPlaces.filter((np) => np.name.trim());
    for (const np of validNewPlaces) {
      if (!np.province.trim()) {
        return { ok: false, error: `Vui lòng chọn tỉnh/thành cho địa điểm "${np.name}".` };
      }
    }

    if (selectedPlaceSlugs.length === 0 && validNewPlaces.length === 0) {
      return {
        ok: false,
        error: 'Vui lòng chọn ít nhất 1 địa điểm có sẵn hoặc tạo địa điểm mới.',
      };
    }

    const formattedSeasons = seasons.map((s) => {
      const start: { month: number; day?: number } = { month: Number(s.startMonth) };
      if (s.startDay.trim()) start.day = Number(s.startDay);

      const end: { month: number; day?: number } = { month: Number(s.endMonth) };
      if (s.endDay.trim()) end.day = Number(s.endDay);

      const out: Record<string, unknown> = { start, end };
      if (s.peakMonth.trim()) {
        const peak: { month: number; day?: number } = { month: Number(s.peakMonth) };
        if (s.peakDay.trim()) peak.day = Number(s.peakDay);
        out.peak = peak;
      }
      if (s.note.trim()) {
        out.note = s.note.trim();
      }
      return out;
    });

    const payload: Record<string, unknown> = {
      name: name.trim(),
      seasons: formattedSeasons,
      regions,
      places: selectedPlaceSlugs.map((slug) => ({
        slug,
        ...(placeBestMap[slug]?.trim() ? { best: placeBestMap[slug].trim() } : {}),
      })),
      new_places: validNewPlaces.map((np) => ({
        name: np.name.trim(),
        province: np.province.trim(),
        region: np.region,
        ...(np.maps_url.trim() ? { maps_url: np.maps_url.trim() } : {}),
        ...(np.best.trim() ? { best: np.best.trim() } : {}),
      })),
    };

    if (scientificName.trim()) payload.scientificName = scientificName.trim();
    if (aka.trim()) payload.aka = aka.trim();
    if (!useAutoColor && color.trim()) payload.color = color.trim();
    if (regionLabel.trim()) payload.regionLabel = regionLabel.trim();
    if (summary.trim()) payload.summary = summary.trim();

    const cleanIdentify = identifyText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleanIdentify.length > 0) payload.identify = cleanIdentify;

    const cleanTips = tipsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleanTips.length > 0) payload.tips = cleanTips;

    const cleanFacts = facts.filter((f) => f.value.trim() && f.label.trim());
    if (cleanFacts.length > 0) payload.facts = cleanFacts;

    if (confusedName.trim() && confusedOurs.trim() && confusedTheirs.trim()) {
      payload.confusedWith = {
        name: confusedName.trim(),
        ours: confusedOurs.trim(),
        theirs: confusedTheirs.trim(),
      };
    }

    const cleanDyk = didYouKnow.filter((d) => d.title.trim() && d.text.trim());
    if (cleanDyk.length > 0) payload.didYouKnow = cleanDyk;

    const cleanMoments = dayMoments.filter(
      (m) => m.label.trim() && m.headline.trim() && m.scene.trim(),
    );
    if (cleanMoments.length > 0) payload.dayMoments = cleanMoments;

    if (quoteText.trim() && quoteAuthor.trim() && quotePlace.trim()) {
      payload.quote = {
        text: quoteText.trim(),
        author: quoteAuthor.trim(),
        place: quotePlace.trim(),
        year: Number(quoteYear) || new Date().getFullYear(),
      };
    }

    if (submitter.trim()) payload.submitter = submitter.trim();

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
      endpoint ?? (mode === 'admin' ? '/api/admin/flowers' : '/api/them-hoa');

    try {
      const res = await fetch(targetUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Không lưu được loài hoa (${res.status})`);
      }

      successMessage =
        data.message ||
        (mode === 'public'
          ? 'Cảm ơn! Loài hoa sẽ hiện sau khi được duyệt.'
          : 'Đã lưu loài hoa thành công.');

      if (mode === 'public') {
        name = '';
        scientificName = '';
        aka = '';
        summary = '';
        identifyText = '';
        tipsText = '';
        newPlaces = [];
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

<form bind:this={formEl} onsubmit={handleSubmit} class="flower-form">
  <fieldset class="group">
    <legend>Thông tin bắt buộc</legend>

    <div class="field">
      <label for="flower-name-input">Tên loài hoa (tiếng Việt) *</label>
      <input
        id="flower-name-input"
        type="text"
        name="name"
        required
        placeholder="Ví dụ: Hoa ban trắng"
        bind:value={name}
      />
    </div>

    <div class="field">
      <span class="label-text">Vùng có hoa nở *</span>
      <div class="checkbox-row">
        {#each ['bac', 'trung', 'nam'] as const as r}
          <label class="chip-check">
            <input
              type="checkbox"
              name="regions"
              value={r}
              checked={regions.includes(r)}
              onchange={() => toggleRegion(r)}
            />
            <span>{REGION_LABELS[r]}</span>
          </label>
        {/each}
      </div>
    </div>

    <div class="seasons-block">
      <div class="block-head">
        <span class="label-text">Các đợt nở trong năm *</span>
        <button type="button" class="btn secondary small" onclick={addSeason}>
          + Thêm đợt nở
        </button>
      </div>

      {#each seasons as s, idx}
        <div class="season-card">
          <div class="season-card-head">
            <strong>Đợt {idx + 1}</strong>
            {#if seasons.length > 1}
              <button
                type="button"
                class="btn danger small"
                onclick={() => removeSeason(idx)}
              >
                Xoá đợt
              </button>
            {/if}
          </div>

          <div class="row-3">
            <div class="field">
              <label for="start-month-{idx}">Bắt đầu (tháng / ngày) *</label>
              <div class="month-day-row">
                <select id="start-month-{idx}" bind:value={s.startMonth} required>
                  {#each MONTHS as m}
                    <option value={m}>Tháng {m}</option>
                  {/each}
                </select>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ngày (1-31)"
                  bind:value={s.startDay}
                />
              </div>
            </div>

            <div class="field">
              <label for="peak-month-{idx}">Đỉnh mùa (tuỳ chọn)</label>
              <div class="month-day-row">
                <select id="peak-month-{idx}" bind:value={s.peakMonth}>
                  <option value="">Tự tính giữa đợt</option>
                  {#each MONTHS as m}
                    <option value={String(m)}>Tháng {m}</option>
                  {/each}
                </select>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ngày"
                  bind:value={s.peakDay}
                />
              </div>
            </div>

            <div class="field">
              <label for="end-month-{idx}">Kết thúc (tháng / ngày) *</label>
              <div class="month-day-row">
                <select id="end-month-{idx}" bind:value={s.endMonth} required>
                  {#each MONTHS as m}
                    <option value={m}>Tháng {m}</option>
                  {/each}
                </select>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ngày (1-31)"
                  bind:value={s.endDay}
                />
              </div>
            </div>
          </div>

          <div class="field">
            <label for="season-note-{idx}">Ghi chú đợt (tuỳ chọn)</label>
            <input
              id="season-note-{idx}"
              type="text"
              placeholder="Ví dụ: Đợt Tết, Đợt tháng 10…"
              bind:value={s.note}
            />
          </div>
        </div>
      {/each}
    </div>

    <div class="places-block">
      <div class="block-head">
        <span class="label-text">Địa điểm ngắm hoa * (chọn có sẵn hoặc tạo mới)</span>
        <button type="button" class="btn secondary small" onclick={addInlinePlace}>
          + Tạo địa điểm mới ngay trong form
        </button>
      </div>

      {#if places.length > 0}
        <div class="existing-places-grid">
          {#each places as p (p.slug)}
            {@const checked = selectedPlaceSlugs.includes(p.slug)}
            <div class="place-choice" class:selected={checked}>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={checked}
                  onchange={() => togglePlaceSlug(p.slug)}
                />
                <span><strong>{p.name}</strong> ({p.province})</span>
              </label>
              {#if checked}
                <input
                  type="text"
                  class="best-input"
                  placeholder="Thời điểm đẹp (vd: T10 – T11)"
                  bind:value={placeBestMap[p.slug]}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if newPlaces.length > 0}
        <div class="new-places-list">
          {#each newPlaces as np, idx}
            <div class="subcard">
              <div class="season-card-head">
                <strong>Địa điểm mới #{idx + 1}</strong>
                <button
                  type="button"
                  class="btn danger small"
                  onclick={() => removeInlinePlace(idx)}
                >
                  Xoá
                </button>
              </div>
              <div class="row-2">
                <div class="field">
                  <label for="np-name-{idx}">Tên địa điểm *</label>
                  <input
                    id="np-name-{idx}"
                    type="text"
                    required
                    placeholder="Ví dụ: Đồi chè Cầu Đất"
                    bind:value={np.name}
                  />
                </div>
                <div class="field">
                  <label for="np-prov-{idx}">Tỉnh / thành (34 tỉnh mới) *</label>
                  <select
                    id="np-prov-{idx}"
                    value={np.province}
                    onchange={(e) =>
                      onInlineProvinceChange(idx, (e.currentTarget as HTMLSelectElement).value)}
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
              </div>
              <div class="row-2">
                <div class="field">
                  <label for="np-region-{idx}">Vùng *</label>
                  <select id="np-region-{idx}" bind:value={np.region}>
                    <option value="bac">Miền Bắc</option>
                    <option value="trung">Miền Trung</option>
                    <option value="nam">Miền Nam</option>
                  </select>
                </div>
                <div class="field">
                  <label for="np-best-{idx}">Thời điểm đẹp (tuỳ chọn)</label>
                  <input
                    id="np-best-{idx}"
                    type="text"
                    placeholder="Ví dụ: Cuối T10 – T11"
                    bind:value={np.best}
                  />
                </div>
              </div>
              <div class="field">
                <label for="np-maps-{idx}">Link Google Maps (tuỳ chọn, khuyến khích)</label>
                <input
                  id="np-maps-{idx}"
                  type="url"
                  placeholder="https://maps.app.goo.gl/... hoặc https://www.google.com/maps/..."
                  bind:value={np.maps_url}
                />
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </fieldset>

  <details class="optional-section" open={mode === 'admin'}>
    <summary>Các thông tin chi tiết khác (không bắt buộc — có thể bổ sung sau)</summary>

    <div class="optional-grid">
      <div class="row-2">
        <div class="field">
          <label for="flower-sci-input">Tên khoa học</label>
          <input
            id="flower-sci-input"
            type="text"
            placeholder="Ví dụ: Bauhinia variegata"
            bind:value={scientificName}
          />
        </div>
        <div class="field">
          <label for="flower-aka-input">Tên gọi khác</label>
          <input
            id="flower-aka-input"
            type="text"
            placeholder="Ví dụ: Hướng dương dại, quỳ núi"
            bind:value={aka}
          />
        </div>
      </div>

      <div class="row-2">
        <div class="field">
          <label for="flower-region-label">Nhãn vùng hiển thị ngắn</label>
          <input
            id="flower-region-label"
            type="text"
            placeholder="Bỏ trống sẽ tự lấy theo địa điểm đã chọn"
            bind:value={regionLabel}
          />
        </div>
        <div class="field">
          <span class="label-text">Màu đại diện trên bánh xe</span>
          <div class="color-row">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={useAutoColor} />
              <span>Chọn tự động từ bảng màu</span>
            </label>
            {#if !useAutoColor}
              <input type="color" bind:value={color} aria-label="Chọn màu" />
              <input
                type="text"
                class="hex-input"
                placeholder="#D45B7A"
                bind:value={color}
              />
            {/if}
          </div>
        </div>
      </div>

      <div class="field">
        <label for="flower-summary">Tóm tắt / Về loài hoa này</label>
        <textarea
          id="flower-summary"
          rows="3"
          placeholder="Đoạn giới thiệu ngắn 2–3 câu về loài hoa và mùa nở…"
          bind:value={summary}
        ></textarea>
      </div>

      <div class="row-2">
        <div class="field">
          <label for="flower-identify">Cách nhận ra (mỗi dòng 1 đặc điểm)</label>
          <textarea
            id="flower-identify"
            rows="3"
            placeholder="Hoa vàng cam to bằng lòng bàn tay&#10;Thân cao, lá xẻ thuỳ"
            bind:value={identifyText}
          ></textarea>
        </div>
        <div class="field">
          <label for="flower-tips">Mẹo đi và chụp (mỗi dòng 1 mẹo)</label>
          <textarea
            id="flower-tips"
            rows="3"
            placeholder="Đi sáng sớm hoặc chiều muộn&#10;Mang áo khoác mỏng"
            bind:value={tipsText}
          ></textarea>
        </div>
      </div>

      <div class="subcard">
        <span class="label-text">Dễ nhầm với loài khác (tuỳ chọn)</span>
        <div class="row-3">
          <div class="field">
            <label for="cw-name">Tên loài dễ nhầm</label>
            <input id="cw-name" type="text" placeholder="Hướng dương" bind:value={confusedName} />
          </div>
          <div class="field">
            <label for="cw-ours">Đặc điểm loài này</label>
            <input id="cw-ours" type="text" placeholder="Nhiều bông cỡ bàn tay…" bind:value={confusedOurs} />
          </div>
          <div class="field">
            <label for="cw-theirs">Đặc điểm loài kia</label>
            <input id="cw-theirs" type="text" placeholder="Một bông rất lớn…" bind:value={confusedTheirs} />
          </div>
        </div>
      </div>

      <div class="subcard">
        <div class="block-head">
          <span class="label-text">Ô số liệu nhanh (facts)</span>
          <button type="button" class="btn secondary small" onclick={addFact}>
            + Thêm ô số liệu
          </button>
        </div>
        {#each facts as fItem, idx}
          <div class="row-2 item-row">
            <input type="text" placeholder="Giá trị (vd: ~1,5 – 3 m)" bind:value={fItem.value} />
            <div class="flex-gap">
              <input type="text" placeholder="Nhãn (vd: Chiều cao cây)" bind:value={fItem.label} />
              <button type="button" class="btn danger small" onclick={() => removeFact(idx)}>Xoá</button>
            </div>
          </div>
        {/each}
      </div>

      <div class="subcard">
        <div class="block-head">
          <span class="label-text">Bạn có biết? (chuyện thú vị)</span>
          <button type="button" class="btn secondary small" onclick={addDidYouKnow}>
            + Thêm mục
          </button>
        </div>
        {#each didYouKnow as dyk, idx}
          <div class="row-2 item-row">
            <input type="text" placeholder="Tiêu đề ngắn" bind:value={dyk.title} />
            <div class="flex-gap">
              <input type="text" placeholder="Nội dung giải thích" bind:value={dyk.text} />
              <button type="button" class="btn danger small" onclick={() => removeDidYouKnow(idx)}>
                Xoá
              </button>
            </div>
          </div>
        {/each}
      </div>

      <div class="subcard">
        <div class="block-head">
          <span class="label-text">Khoảnh khắc trong ngày (Bình minh / Sáng / Trưa / Chiều)</span>
          <button type="button" class="btn secondary small" onclick={addDayMoment}>
            + Thêm khoảnh khắc
          </button>
        </div>
        {#each dayMoments as dm, idx}
          <div class="season-card">
            <div class="season-card-head">
              <strong>Khoảnh khắc #{idx + 1}</strong>
              <button type="button" class="btn danger small" onclick={() => removeDayMoment(idx)}>
                Xoá
              </button>
            </div>
            <div class="row-3">
              <input type="text" placeholder="Nhãn (vd: Bình minh)" bind:value={dm.label} />
              <input type="text" placeholder="Màu nền (#F6C9A0)" bind:value={dm.color} />
              <input type="text" placeholder="Tiêu đề ngắn" bind:value={dm.headline} />
            </div>
            <div class="row-2">
              <input type="text" placeholder="Khung cảnh" bind:value={dm.scene} />
              <input type="text" placeholder="Mẹo nhỏ" bind:value={dm.tip} />
            </div>
          </div>
        {/each}
      </div>

      <div class="subcard">
        <span class="label-text">Câu trích dẫn / Cảm nhận (tuỳ chọn)</span>
        <div class="field">
          <input type="text" placeholder="Nội dung câu trích dẫn…" bind:value={quoteText} />
        </div>
        <div class="row-3">
          <input type="text" placeholder="Tác giả" bind:value={quoteAuthor} />
          <input type="text" placeholder="Nơi ghi" bind:value={quotePlace} />
          <input type="number" placeholder="Năm" bind:value={quoteYear} />
        </div>
      </div>

      <div class="field">
        <label for="flower-submitter">Tên người đóng góp (tuỳ chọn)</label>
        <input
          id="flower-submitter"
          type="text"
          name="submitter"
          placeholder="Tên hoặc bút danh của bạn"
          bind:value={submitter}
        />
      </div>
    </div>
  </details>

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
        : submitLabel ?? (mode === 'admin' ? 'Lưu & Duyệt ngay' : 'Gửi loài hoa mới')}
    </button>
    {#if onCancel}
      <button type="button" class="btn secondary" onclick={onCancel}>
        Huỷ
      </button>
    {/if}
  </div>
</form>

<style>
  .flower-form {
    display: grid;
    gap: var(--space-4);
  }
  .group {
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    padding: var(--space-4);
    display: grid;
    gap: var(--space-4);
    margin: 0;
  }
  legend {
    font-weight: 700;
    padding: 0 var(--space-2);
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  label,
  .label-text {
    font-size: 0.875rem;
    font-weight: 600;
  }
  input[type='text'],
  input[type='url'],
  input[type='number'],
  select,
  textarea {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid #cfc9be;
    border-radius: 10px;
    font: inherit;
    background: #faf8f5;
    color: var(--color-text);
  }
  .row-2 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: 1fr 1fr;
  }
  .row-3 {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(3, 1fr);
  }
  .month-day-row {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: var(--space-2);
  }
  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chip-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0.45rem 0.85rem;
    border: 1px solid #cfc9be;
    border-radius: 999px;
    background: #faf8f5;
    font-weight: 600;
    cursor: pointer;
  }
  .block-head,
  .season-card-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }
  .seasons-block,
  .places-block {
    display: grid;
    gap: var(--space-3);
  }
  .season-card,
  .subcard {
    background: #faf8f5;
    border: 1px solid #e7e2d9;
    border-radius: 12px;
    padding: var(--space-3);
    display: grid;
    gap: var(--space-3);
  }
  .existing-places-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-2);
    max-height: 260px;
    overflow-y: auto;
    padding: var(--space-2);
    border: 1px solid #e7e2d9;
    border-radius: 12px;
    background: #faf8f5;
  }
  .place-choice {
    padding: var(--space-2);
    border-radius: 8px;
    border: 1px solid transparent;
    display: grid;
    gap: 6px;
  }
  .place-choice.selected {
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
  .optional-section {
    border: 1px solid #e7e2d9;
    border-radius: 14px;
    padding: var(--space-3) var(--space-4);
    background: #fff;
  }
  .optional-section summary {
    font-weight: 700;
    cursor: pointer;
    padding: var(--space-1) 0;
  }
  .optional-grid {
    margin-top: var(--space-4);
    display: grid;
    gap: var(--space-4);
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .hex-input {
    width: 110px !important;
  }
  .flex-gap {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .item-row {
    align-items: center;
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
  @media (max-width: 720px) {
    .row-2,
    .row-3 {
      grid-template-columns: 1fr;
    }
  }
</style>
