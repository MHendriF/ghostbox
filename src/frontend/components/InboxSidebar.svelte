<script lang="ts">
  import type { Inbox } from '../types';
  import { parseDate } from '../utils';

  interface Props {
    inboxes: Inbox[];
    activeAddress: string;
    totalInboxesCount?: number | null;
    emptyInboxesCount?: number | null;
    onSelectInbox: (addr: string) => void;
    onQuickRandom: () => void;
    onToggleDrawer: () => void;
    onCleanEmptyInboxes?: () => void | Promise<void>;
    onBatchDeleteInboxes?: (addresses: string[]) => void | Promise<void>;
  }

  let {
    inboxes,
    activeAddress,
    totalInboxesCount = null,
    emptyInboxesCount = null,
    onSelectInbox,
    onQuickRandom,
    onToggleDrawer,
    onCleanEmptyInboxes,
    onBatchDeleteInboxes,
  }: Props = $props();

  let searchQuery = $state('');
  let category = $state<'all' | 'active' | 'empty'>('all');
  let isMobileExpanded = $state(false);

  // Multi-select state
  let isSelectMode = $state(false);
  let selectedAddresses = $state<string[]>([]);
  let selectedSet = $derived(new Set(selectedAddresses));
  let selectedCount = $derived(selectedAddresses.length);

  // Modal dialog states
  let showCleanModal = $state(false);
  let showBatchDeleteModal = $state(false);
  let isCleaning = $state(false);
  let isBatchDeleting = $state(false);

  let displayTotal = $derived(
    totalInboxesCount !== null && totalInboxesCount !== undefined
      ? totalInboxesCount
      : inboxes.length
  );

  let emptyCount = $derived(
    emptyInboxesCount !== null && emptyInboxesCount !== undefined
      ? emptyInboxesCount
      : inboxes.filter((i) => (i.message_count ?? 0) === 0).length
  );

  let filteredInboxes = $derived.by(() => {
    let list = inboxes;
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((i) => i.address.toLowerCase().includes(q));
    }
    if (category === 'active') {
      list = list.filter((i) => (i.message_count ?? 0) > 0);
    } else if (category === 'empty') {
      list = list.filter((i) => (i.message_count ?? 0) === 0);
    }
    return [...list].sort((a, b) => {
      return parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime();
    });
  });

  let inboxPage = $state(1);
  const inboxPageSize = 8;

  let totalInboxPages = $derived(
    Math.max(1, Math.ceil(filteredInboxes.length / inboxPageSize))
  );

  let paginatedInboxes = $derived(
    filteredInboxes.slice((inboxPage - 1) * inboxPageSize, inboxPage * inboxPageSize)
  );

  // Reset page to 1 when search or category changes, and clamp if out of bounds
  let lastFilterKey = $state('all:');
  $effect(() => {
    const currentKey = `${category}:${searchQuery}`;
    if (currentKey !== lastFilterKey) {
      lastFilterKey = currentKey;
      inboxPage = 1;
    } else if (inboxPage > totalInboxPages) {
      inboxPage = totalInboxPages;
    }
  });

  // Keep page aligned with activeAddress ONLY when activeAddress changes
  let lastSyncedAddress = $state('');
  $effect(() => {
    if (activeAddress && activeAddress !== lastSyncedAddress && filteredInboxes.length > 0) {
      lastSyncedAddress = activeAddress;
      const idx = filteredInboxes.findIndex((i) => i.address === activeAddress);
      if (idx !== -1) {
        inboxPage = Math.floor(idx / inboxPageSize) + 1;
      }
    } else if (!activeAddress) {
      lastSyncedAddress = '';
    }
  });

  let isAllPageSelected = $derived(
    paginatedInboxes.length > 0 &&
      paginatedInboxes.every((i) => selectedSet.has(i.address))
  );

  function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) {
      selectedAddresses = [];
    }
  }

  function toggleSelectInbox(addr: string) {
    if (selectedSet.has(addr)) {
      selectedAddresses = selectedAddresses.filter((a) => a !== addr);
    } else {
      selectedAddresses = [...selectedAddresses, addr];
    }
  }

  function toggleSelectAllPage() {
    if (isAllPageSelected) {
      const pageAddresses = new Set(paginatedInboxes.map((i) => i.address));
      selectedAddresses = selectedAddresses.filter((a) => !pageAddresses.has(a));
    } else {
      const set = new Set(selectedAddresses);
      for (const inb of paginatedInboxes) {
        set.add(inb.address);
      }
      selectedAddresses = Array.from(set);
    }
  }

  function selectAllFiltered() {
    selectedAddresses = filteredInboxes.map((i) => i.address);
  }

  function clearSelection() {
    selectedAddresses = [];
  }

  async function confirmCleanEmpty() {
    if (!onCleanEmptyInboxes || isCleaning) return;
    isCleaning = true;
    try {
      await onCleanEmptyInboxes();
      showCleanModal = false;
    } finally {
      isCleaning = false;
    }
  }

  async function confirmBatchDelete() {
    if (!onBatchDeleteInboxes || isBatchDeleting || selectedAddresses.length === 0) return;
    isBatchDeleting = true;
    try {
      await onBatchDeleteInboxes(selectedAddresses);
      selectedAddresses = [];
      showBatchDeleteModal = false;
      isSelectMode = false;
    } finally {
      isBatchDeleting = false;
    }
  }

  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (showCleanModal && !isCleaning) showCleanModal = false;
      if (showBatchDeleteModal && !isBatchDeleting) showBatchDeleteModal = false;
    }
  }
</script>

<aside class="inbox-sidebar">
  <div class="sidebar-header">
    <div class="header-title-wrap">
      <span class="sidebar-title">Inboxes</span>
      <span class="count-badge">{displayTotal}</span>
    </div>

    <div class="header-controls">
      {#if onBatchDeleteInboxes && filteredInboxes.length > 0}
        <button
          type="button"
          class="btn-select-mode"
          class:active={isSelectMode}
          onclick={toggleSelectMode}
          title={isSelectMode ? "Cancel selection" : "Select multiple inboxes"}
        >
          {isSelectMode ? "Done" : "Select"}
        </button>
      {/if}

      {#if onCleanEmptyInboxes && emptyCount > 0}
        <button
          type="button"
          class="clean-btn"
          onclick={() => (showCleanModal = true)}
          disabled={isCleaning}
          title="Delete inboxes with zero messages"
        >
          <span>Clean Empty ({emptyCount})</span>
        </button>
      {/if}

      <button
        type="button"
        class="mobile-toggle-btn"
        onclick={() => (isMobileExpanded = !isMobileExpanded)}
        aria-label="Toggle inboxes list"
      >
        <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points={isMobileExpanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </button>
    </div>
  </div>

  <div class="sidebar-body" class:mobile-open={isMobileExpanded}>
    <div class="action-grid">
      <button type="button" class="btn btn-secondary action-btn" onclick={onToggleDrawer} title="Create custom inbox alias">
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Custom</span>
      </button>

      <button type="button" class="btn btn-secondary action-btn" onclick={onQuickRandom} title="Generate random inbox immediately">
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <circle cx="15.5" cy="8.5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="8.5" cy="15.5" r="1.5" />
          <circle cx="15.5" cy="15.5" r="1.5" />
        </svg>
        <span>Random</span>
      </button>
    </div>

    <div class="search-box">
      <svg class="ui-icon-xs search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Search inboxes..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button type="button" class="clear-btn" onclick={() => (searchQuery = '')}>✕</button>
      {/if}
    </div>

    <div class="category-tabs">
      <button
        type="button"
        class="tab-chip"
        class:active={category === 'all'}
        onclick={() => (category = 'all')}
      >
        All
      </button>
      <button
        type="button"
        class="tab-chip"
        class:active={category === 'active'}
        onclick={() => (category = 'active')}
      >
        Active ({inboxes.length - emptyCount})
      </button>
      <button
        type="button"
        class="tab-chip"
        class:active={category === 'empty'}
        onclick={() => (category = 'empty')}
      >
        Empty ({emptyCount})
      </button>
    </div>

    {#if isSelectMode}
      <div class="selection-toolbar">
        <div class="selection-meta">
          <label class="select-checkbox-label">
            <input
              type="checkbox"
              checked={isAllPageSelected}
              onchange={toggleSelectAllPage}
              class="selection-checkbox"
            />
            <span>Page ({paginatedInboxes.length})</span>
          </label>
          {#if selectedCount > 0}
            <span class="selection-count-badge">{selectedCount} selected</span>
          {/if}
        </div>

        <div class="selection-actions">
          {#if selectedCount < filteredInboxes.length}
            <button
              type="button"
              class="selection-link-btn"
              onclick={selectAllFiltered}
              title="Select all filtered inboxes"
            >
              All ({filteredInboxes.length})
            </button>
          {/if}

          {#if selectedCount > 0}
            <button
              type="button"
              class="selection-link-btn"
              onclick={clearSelection}
              title="Clear selection"
            >
              Clear
            </button>

            <button
              type="button"
              class="btn-delete-batch"
              onclick={() => (showBatchDeleteModal = true)}
              title="Delete selected inboxes"
            >
              Delete ({selectedCount})
            </button>
          {/if}
        </div>
      </div>
    {/if}

    <div class="inbox-list" role="listbox" aria-label="Available inboxes">
      {#if filteredInboxes.length === 0}
        <div class="empty-list">No inboxes found</div>
      {:else}
        {#each paginatedInboxes as inb (inb.address)}
          <button
            type="button"
            class="inbox-item"
            class:active={!isSelectMode && inb.address === activeAddress}
            class:is-selected={isSelectMode && selectedSet.has(inb.address)}
            onclick={() => {
              if (isSelectMode) {
                toggleSelectInbox(inb.address);
              } else {
                onSelectInbox(inb.address);
                isMobileExpanded = false;
              }
            }}
            role="option"
            aria-selected={isSelectMode ? selectedSet.has(inb.address) : inb.address === activeAddress}
          >
            <div class="item-left">
              {#if isSelectMode}
                <input
                  type="checkbox"
                  checked={selectedSet.has(inb.address)}
                  class="selection-checkbox item-check"
                  tabindex="-1"
                  onclick={(e) => e.stopPropagation()}
                  onchange={() => toggleSelectInbox(inb.address)}
                />
              {:else}
                <span class="active-indicator"></span>
              {/if}
              <span class="address-name" title={inb.address}>{inb.address}</span>
            </div>
            <span class="msg-count-pill" class:has-msgs={(inb.message_count ?? 0) > 0}>
              {inb.message_count ?? 0}
            </span>
          </button>
        {/each}
      {/if}
    </div>

    {#if totalInboxPages > 1}
      <div class="sidebar-pagination">
        <button
          type="button"
          class="sidebar-page-btn"
          disabled={inboxPage === 1}
          onclick={() => (inboxPage = Math.max(1, inboxPage - 1))}
          title="Previous inboxes page"
          aria-label="Previous page"
        >
          ‹
        </button>
        <span class="sidebar-page-indicator">
          {inboxPage} / {totalInboxPages}
        </span>
        <button
          type="button"
          class="sidebar-page-btn"
          disabled={inboxPage === totalInboxPages}
          onclick={() => (inboxPage = Math.min(totalInboxPages, inboxPage + 1))}
          title="Next inboxes page"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    {/if}
  </div>
</aside>

{#if showCleanModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-overlay"
    onclick={() => !isCleaning && (showCleanModal = false)}
    onkeydown={handleModalKeydown}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-card delete-modal"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clean-dialog-title"
      tabindex="-1"
    >
      <div class="delete-modal-icon">
        <svg class="delete-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </div>

      <h3 id="clean-dialog-title" class="delete-modal-title">Clean Empty Inboxes?</h3>
      <p class="delete-modal-desc">
        Are you sure you want to permanently delete <span class="delete-address-badge">{emptyCount} empty inboxes</span>? Inboxes with zero messages will be removed immediately.
      </p>

      <div class="delete-modal-actions">
        <button
          type="button"
          class="btn btn-secondary cancel-modal-btn"
          onclick={() => (showCleanModal = false)}
          disabled={isCleaning}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-danger-solid confirm-modal-btn"
          onclick={confirmCleanEmpty}
          disabled={isCleaning}
        >
          {#if isCleaning}
            <span>Cleaning...</span>
          {:else}
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Clean {emptyCount} Inboxes</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showBatchDeleteModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-overlay"
    onclick={() => !isBatchDeleting && (showBatchDeleteModal = false)}
    onkeydown={handleModalKeydown}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-card delete-modal"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-dialog-title"
      tabindex="-1"
    >
      <div class="delete-modal-icon">
        <svg class="delete-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </div>

      <h3 id="batch-dialog-title" class="delete-modal-title">Delete {selectedCount} Inboxes?</h3>
      <p class="delete-modal-desc">
        Are you sure you want to permanently delete <span class="delete-address-badge">{selectedCount} selected inboxes</span> and all their messages? This action cannot be undone.
      </p>

      <div class="delete-modal-actions">
        <button
          type="button"
          class="btn btn-secondary cancel-modal-btn"
          onclick={() => (showBatchDeleteModal = false)}
          disabled={isBatchDeleting}
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-danger-solid confirm-modal-btn"
          onclick={confirmBatchDelete}
          disabled={isBatchDeleting}
        >
          {#if isBatchDeleting}
            <span>Deleting...</span>
          {:else}
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Delete Permanently</span>
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .inbox-sidebar {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border-subtle);
    background: rgba(24, 24, 27, 0.4);
  }

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sidebar-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .count-badge {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 1px 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-secondary);
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-select-mode {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 500;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-select-mode:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .btn-select-mode.active {
    background: rgba(59, 130, 246, 0.15);
    border-color: var(--accent);
    color: #93c5fd;
    font-weight: 600;
  }

  .clean-btn {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 500;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition);
  }

  .clean-btn:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--red);
    color: var(--red);
  }

  .clean-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mobile-toggle-btn {
    display: none;
    padding: 4px;
    color: var(--text-secondary);
  }

  .sidebar-body {
    display: flex;
    flex-direction: column;
    padding: 10px;
    gap: 10px;
  }

  .action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .action-btn {
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 500;
    justify-content: center;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 8px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 6px 24px 6px 26px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--border-hover);
  }

  .clear-btn {
    position: absolute;
    right: 6px;
    font-size: 11px;
    color: var(--text-muted);
    padding: 2px 4px;
  }

  .category-tabs {
    display: flex;
    gap: 4px;
  }

  .tab-chip {
    flex: 1;
    padding: 4px 6px;
    font-size: 11px;
    font-weight: 500;
    text-align: center;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--text-muted);
    border: 1px solid transparent;
    transition: all var(--transition);
  }

  .tab-chip:hover {
    color: var(--text-secondary);
  }

  .tab-chip.active {
    background: var(--bg-elevated);
    color: var(--text-primary);
    border-color: var(--border);
  }

  .inbox-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 480px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .empty-list {
    padding: 24px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  .inbox-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid transparent;
    transition: all var(--transition);
    text-align: left;
    width: 100%;
  }

  .inbox-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-subtle);
  }

  .inbox-item.active {
    background: var(--bg-elevated);
    border-color: var(--border);
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .active-indicator {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: transparent;
    flex-shrink: 0;
  }

  .inbox-item.active .active-indicator {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
  }

  .address-name {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .inbox-item.active .address-name {
    color: var(--text-primary);
    font-weight: 600;
  }

  .msg-count-pill {
    font-family: var(--font-mono);
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--bg-root);
    color: var(--text-dim);
    flex-shrink: 0;
  }

  .msg-count-pill.has-msgs {
    background: rgba(16, 185, 129, 0.12);
    color: var(--green-soft);
    font-weight: 600;
  }

  .sidebar-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-top: 1px solid var(--border-subtle);
    background: rgba(18, 18, 20, 0.6);
  }

  .sidebar-page-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-secondary);
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    transition: all var(--transition);
  }

  .sidebar-page-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .sidebar-page-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .sidebar-page-indicator {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
  }

  /* Selection Toolbar & Checkbox */
  .selection-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: rgba(30, 30, 35, 0.6);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: 11px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .selection-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .select-checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    color: var(--text-secondary);
    font-weight: 500;
    user-select: none;
  }

  .selection-checkbox {
    width: 14px;
    height: 14px;
    accent-color: var(--accent);
    cursor: pointer;
    border-radius: 3px;
  }

  .item-check {
    margin-right: 2px;
    flex-shrink: 0;
  }

  .selection-count-badge {
    background: rgba(59, 130, 246, 0.15);
    color: #93c5fd;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
  }

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .selection-link-btn {
    background: none;
    border: none;
    padding: 2px 5px;
    font-size: 11px;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-xs);
    transition: color var(--transition);
  }

  .selection-link-btn:hover {
    color: var(--text-primary);
  }

  .btn-delete-batch {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: var(--red);
    border-radius: var(--radius-xs);
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-delete-batch:hover:not(:disabled) {
    background: var(--red);
    color: #ffffff;
    border-color: var(--red);
  }

  .inbox-item.is-selected {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 120ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .delete-modal {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    max-width: 400px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    text-align: center;
    animation: scaleIn 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  .delete-modal-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.28);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--red);
    margin: 0 auto 12px;
  }

  .delete-icon-svg {
    width: 22px;
    height: 22px;
  }

  .delete-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  }

  .delete-modal-desc {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .delete-address-badge {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-elevated);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border);
    word-break: break-all;
    display: inline-block;
  }

  .delete-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .cancel-modal-btn {
    padding: 8px 14px;
  }

  .confirm-modal-btn {
    padding: 8px 14px;
    background: var(--red);
    color: #ffffff;
    border: 1px solid var(--red);
    font-weight: 600;
  }

  .confirm-modal-btn:hover:not(:disabled) {
    background: #dc2626;
  }

  @media (max-width: 860px) {
    .mobile-toggle-btn {
      display: inline-flex;
    }

    .sidebar-body {
      display: none;
    }

    .sidebar-body.mobile-open {
      display: flex;
    }
  }
</style>

