<script lang="ts">
  import type { EntityMeta } from './types';
  import { searchEntities } from './dataLoader';
  import { formatNumberVi } from './math';

  interface Props {
    shapesCount: number;
    maxShapes?: number;
    onAdd: (id: string) => void;
  }

  let { shapesCount, maxShapes = 6, onAdd }: Props = $props();

  let query = $state('');
  let isOpen = $state(false);
  let focusedIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();

  const isFull = $derived(shapesCount >= maxShapes);
  const results = $derived(isOpen && query.trim() ? searchEntities(query, 10) : []);

  function handleInput() {
    isOpen = true;
    focusedIndex = -1;
  }

  function handleFocus() {
    if (query.trim()) {
      isOpen = true;
    }
  }

  function handleBlur(e: FocusEvent) {
    // Tránh đóng dropdown trước khi click vào option được kích hoạt
    const related = e.relatedTarget as HTMLElement | null;
    if (related && related.closest('.searchbox-dropdown')) {
      return;
    }
    setTimeout(() => {
      isOpen = false;
    }, 150);
  }

  function selectItem(item: EntityMeta) {
    if (isFull) return;
    onAdd(item.id);
    query = '';
    isOpen = false;
    focusedIndex = -1;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && query.trim()) {
        isOpen = true;
        focusedIndex = 0;
      } else if (results.length > 0) {
        focusedIndex = (focusedIndex + 1) % results.length;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        focusedIndex = (focusedIndex - 1 + results.length) % results.length;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        const target = focusedIndex >= 0 ? results[focusedIndex] : results[0];
        if (target) {
          selectItem(target);
        }
      }
    } else if (e.key === 'Escape') {
      isOpen = false;
      focusedIndex = -1;
    }
  }

  function clearQuery() {
    query = '';
    isOpen = false;
    focusedIndex = -1;
    inputEl?.focus();
  }
</script>

<div class="searchbox-wrap">
  <div
    class="searchbox-field"
    role="combobox"
    aria-expanded={isOpen && results.length > 0}
    aria-haspopup="listbox"
    aria-controls="searchbox-listbox"
    aria-owns="searchbox-listbox"
  >
    <!-- Icon kính lúp -->
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>

    <input
      bind:this={inputEl}
      type="text"
      class="searchbox-input"
      placeholder={isFull ? `Đã đủ tối đa ${maxShapes} hình trên bàn` : "Thêm tỉnh hoặc quốc gia để so sánh..."}
      disabled={isFull}
      bind:value={query}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeyDown}
      aria-autocomplete="list"
      aria-activedescendant={focusedIndex >= 0 ? `searchbox-opt-${focusedIndex}` : undefined}
      autocomplete="off"
      spellcheck="false"
    />

    {#if query}
      <button
        type="button"
        class="clear-btn"
        title="Xoá tìm kiếm"
        aria-label="Xoá tìm kiếm"
        onclick={clearQuery}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    {/if}
  </div>

  {#if isOpen && query.trim()}
    <div class="searchbox-dropdown" id="searchbox-listbox" role="listbox">
      {#if results.length > 0}
        {#each results as item, index (item.id)}
          <button
            type="button"
            class="searchbox-option"
            class:focused={focusedIndex === index}
            role="option"
            id={`searchbox-opt-${index}`}
            aria-selected={focusedIndex === index}
            tabindex="-1"
            onclick={() => selectItem(item)}
          >
            <span class="option-main">
              <span class="option-name">{item.name}</span>
              <span class="option-badge" class:tinh={item.type === 'tinh'} class:nuoc={item.type === 'nuoc'}>
                {item.type === 'vn' ? 'Việt Nam' : item.type === 'tinh' ? 'Tỉnh' : 'Quốc gia'}
              </span>
            </span>
            <span class="option-area">{formatNumberVi(item.area)} km²</span>
          </button>
        {/each}
      {:else}
        <div class="searchbox-empty">Không tìm thấy địa danh phù hợp</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .searchbox-wrap {
    position: relative;
    width: 100%;
    max-width: 480px;
  }

  .searchbox-field {
    position: relative;
    display: flex;
    align-items: center;
    background: #ffffff;
    border: 1.5px solid var(--color-border, #e6e1d9);
    border-radius: 9999px;
    padding: 0.35rem 0.85rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .searchbox-field:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }

  .search-icon {
    flex-shrink: 0;
    color: var(--color-text-muted, #6b665f);
    margin-right: 0.5rem;
  }

  .searchbox-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.9375rem;
    color: var(--color-text, #1f1d1a);
  }

  .searchbox-input::placeholder {
    color: var(--color-text-muted, #8c857b);
  }

  .searchbox-input:disabled {
    cursor: not-allowed;
    color: #9ca3af;
  }

  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #e5e7eb;
    color: #4b5563;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: #d1d5db;
    color: #111827;
  }

  /* Dropdown danh sách gợi ý */
  .searchbox-dropdown {
    position: absolute;
    top: calc(100% + 0.375rem);
    left: 0;
    right: 0;
    max-height: 280px;
    overflow-y: auto;
    background: #ffffff;
    border: 1px solid var(--color-border, #e6e1d9);
    border-radius: 0.75rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 0.375rem;
    z-index: 50;
  }

  .searchbox-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    border-radius: 0.5rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .searchbox-option:hover,
  .searchbox-option.focused {
    background: #f3f4f6;
  }

  .option-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .option-name {
    font-weight: 600;
    color: var(--color-text, #1f1d1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .option-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 9999px;
    background: #e0e7ff;
    color: #3730a3;
  }

  .option-badge.tinh {
    background: #fef3c7;
    color: #92400e;
  }

  .option-badge.nuoc {
    background: #e0f2fe;
    color: #0369a1;
  }

  .option-area {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-muted, #6b665f);
    flex-shrink: 0;
    margin-left: 0.5rem;
  }

  .searchbox-empty {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted, #6b665f);
    text-align: center;
  }
</style>
