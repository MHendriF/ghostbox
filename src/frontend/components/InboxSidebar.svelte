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
  }: Props = $props();

  let searchQuery = $state('');
  let category = $state<'all' | 'active' | 'empty'>('all');
  let confirmingClean = $state(false);
  let isCleaning = $state(false);
  let confirmTimeout: number | null = null;
  let isMobileExpanded = $state(false);

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

  async function triggerCleanEmpty() {
    if (emptyCount === 0 || isCleaning) return;
    if (!confirmingClean) {
      confirmingClean = true;
      if (confirmTimeout) clearTimeout(confirmTimeout);
      confirmTimeout = window.setTimeout(() => {
        confirmingClean = false;
      }, 3500);
      return;
    }
    if (confirmTimeout) clearTimeout(confirmTimeout);
    confirmingClean = false;
    if (!onCleanEmptyInboxes) return;
    isCleaning = true;
    try {
      await onCleanEmptyInboxes();
    } finally {
      isCleaning = false;
    }
  }

  function cancelConfirmClean(e: MouseEvent) {
    e.stopPropagation();
    if (confirmTimeout) clearTimeout(confirmTimeout);
    confirmingClean = false;
  }
</script>

<aside class="inbox-sidebar">
  <div class="sidebar-header">
    <div class="header-title-wrap">
      <span class="sidebar-title">Inboxes</span>
      <span class="count-badge">{displayTotal}</span>
    </div>

    {#if onCleanEmptyInboxes && emptyCount > 0}
      <div class="clean-wrap">
        <button
          type="button"
          class="clean-btn"
          class:confirming={confirmingClean}
          onclick={triggerCleanEmpty}
          disabled={isCleaning}
          title="Delete inboxes with zero messages"
        >
          {#if isCleaning}
            <span>Cleaning...</span>
          {:else if confirmingClean}
            <span>Confirm ({emptyCount})</span>
          {:else}
            <span>Clean Empty ({emptyCount})</span>
          {/if}
        </button>
        {#if confirmingClean}
          <button type="button" class="cancel-clean-btn" onclick={cancelConfirmClean} title="Cancel">✕</button>
        {/if}
      </div>
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

    <div class="inbox-list" role="listbox" aria-label="Available inboxes">
      {#if filteredInboxes.length === 0}
        <div class="empty-list">No inboxes found</div>
      {:else}
        {#each filteredInboxes as inb (inb.address)}
          <button
            type="button"
            class="inbox-item"
            class:active={inb.address === activeAddress}
            onclick={() => {
              onSelectInbox(inb.address);
              isMobileExpanded = false;
            }}
            role="option"
            aria-selected={inb.address === activeAddress}
          >
            <div class="item-left">
              <span class="active-indicator"></span>
              <span class="address-name" title={inb.address}>{inb.address}</span>
            </div>
            <span class="msg-count-pill" class:has-msgs={(inb.message_count ?? 0) > 0}>
              {inb.message_count ?? 0}
            </span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</aside>

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

  .clean-wrap {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .clean-btn {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 500;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-secondary);
    transition: all var(--transition);
  }

  .clean-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--red);
    color: var(--red);
  }

  .clean-btn.confirming {
    background: var(--red);
    color: #ffffff;
    border-color: var(--red);
  }

  .cancel-clean-btn {
    padding: 3px 6px;
    font-size: 10px;
    color: var(--text-muted);
    border-radius: var(--radius-xs);
  }

  .cancel-clean-btn:hover {
    color: var(--text-primary);
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

