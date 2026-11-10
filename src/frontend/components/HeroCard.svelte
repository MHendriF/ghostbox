<script lang="ts">
  import type { Inbox } from '../types';

  interface Props {
    inboxes?: Inbox[];
    activeAddress: string;
    isRefreshing?: boolean;
    onSelectInbox?: (addr: string) => void;
    onQuickRandom?: () => void;
    onToggleDrawer?: () => void;
    onRefresh: () => void;
    onDeleteInbox: () => void;
    onShowToast: (msg: string) => void;
  }

  let {
    inboxes = [],
    activeAddress,
    isRefreshing = false,
    onSelectInbox,
    onQuickRandom,
    onToggleDrawer,
    onRefresh,
    onDeleteInbox,
    onShowToast,
  }: Props = $props();

  let copied = $state(false);
  let confirmingDelete = $state(false);
  let deleteTimeout: number | null = null;
  let spinning = $state(false);

  async function handleCopy() {
    if (!activeAddress) return;
    try {
      await navigator.clipboard.writeText(activeAddress);
      copied = true;
      onShowToast('Address copied to clipboard');
      setTimeout(() => {
        copied = false;
      }, 1600);
    } catch {
      onShowToast('Failed to copy address');
    }
  }

  function handleRefreshClick() {
    spinning = true;
    onShowToast('Refreshing inbox...');
    onRefresh();
    setTimeout(() => {
      spinning = false;
    }, 800);
  }

  function triggerDelete() {
    if (!confirmingDelete) {
      confirmingDelete = true;
      if (deleteTimeout) clearTimeout(deleteTimeout);
      deleteTimeout = window.setTimeout(() => {
        confirmingDelete = false;
      }, 4000);
      return;
    }
    if (deleteTimeout) clearTimeout(deleteTimeout);
    confirmingDelete = false;
    onDeleteInbox();
  }

  function cancelDelete() {
    if (deleteTimeout) clearTimeout(deleteTimeout);
    confirmingDelete = false;
  }

  $effect(() => {
    // Reset confirming delete if active address changes
    if (activeAddress) {
      confirmingDelete = false;
    }
  });
</script>

<div class="command-bar">
  <div class="address-section">
    <div class="address-meta-row">
      <span class="section-label">Active Inbox</span>
      {#if inboxes.length > 1 && onSelectInbox}
        <div class="quick-switch-wrap">
          <label for="quickInboxSelect" class="switch-label">Switch:</label>
          <select
            id="quickInboxSelect"
            class="quick-switch-select"
            value={activeAddress}
            onchange={(e) => onSelectInbox?.((e.target as HTMLSelectElement).value)}
            aria-label="Quick switch active inbox"
          >
            {#each inboxes as inb (inb.address)}
              <option value={inb.address}>
                {inb.address} ({inb.message_count ?? 0} {inb.message_count === 1 ? 'msg' : 'msgs'})
              </option>
            {/each}
          </select>
        </div>
      {/if}
    </div>

    <div class="address-box">
      <span class="mono-address" title={activeAddress}>{activeAddress || 'No inbox selected'}</span>
      <button
        type="button"
        class="copy-chip-btn"
        class:is-copied={copied}
        onclick={handleCopy}
        title="Copy address to clipboard (c)"
      >
        {#if copied}
          <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Copied!</span>
        {:else}
          <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
          <kbd>c</kbd>
        {/if}
      </button>
    </div>
  </div>

  <div class="actions-section">
    {#if onToggleDrawer}
      <button type="button" class="btn btn-secondary action-btn" onclick={onToggleDrawer} title="Create custom inbox (n)">
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>+ Custom</span>
      </button>
    {/if}

    {#if onQuickRandom}
      <button type="button" class="btn btn-secondary action-btn" onclick={onQuickRandom} title="Generate random inbox">
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
    {/if}

    <button
      type="button"
      class="btn btn-secondary action-btn"
      class:is-spinning={spinning || isRefreshing}
      onclick={handleRefreshClick}
      title="Fetch incoming emails now (r)"
    >
      <svg class="ui-icon-xs refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      <span>Refresh</span>
    </button>

    {#if confirmingDelete}
      <div class="delete-confirm-group">
        <button type="button" class="btn btn-danger-solid" onclick={triggerDelete} title="Permanently delete this inbox">
          <span>Confirm Delete?</span>
        </button>
        <button type="button" class="btn btn-secondary cancel-btn" onclick={cancelDelete} title="Cancel">
          ✕
        </button>
      </div>
    {:else}
      <button type="button" class="btn btn-danger-ghost delete-btn" onclick={triggerDelete} title="Delete active inbox">
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        <span>Delete</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .command-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: 14px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .address-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .address-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .quick-switch-wrap {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .switch-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .quick-switch-select {
    padding: 2px 6px;
    font-size: 11px;
    font-family: var(--font-mono);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-secondary);
    cursor: pointer;
    max-width: 180px;
    text-overflow: ellipsis;
  }

  .quick-switch-select:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .address-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    min-width: 0;
  }

  .mono-address {
    font-family: var(--font-mono);
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;
  }

  .copy-chip-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    background: var(--bg-root);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition);
    flex-shrink: 0;
  }

  .copy-chip-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .copy-chip-btn.is-copied {
    background: rgba(16, 185, 129, 0.15);
    border-color: var(--green);
    color: var(--green-soft);
  }

  .copy-chip-btn kbd {
    font-family: var(--font-mono);
    font-size: 9.5px;
    padding: 0 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-muted);
  }

  .actions-section {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .action-btn {
    font-size: 12px;
    padding: 7px 11px;
  }

  .is-spinning .refresh-icon {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .delete-confirm-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .btn-danger-solid {
    background: var(--red);
    color: #ffffff;
    border: 1px solid var(--red);
    font-size: 12px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
  }

  .cancel-btn {
    padding: 6px 8px;
    font-size: 11px;
  }

  @media (max-width: 640px) {
    .command-bar {
      flex-direction: column;
      align-items: stretch;
      padding: 10px;
    }

    .actions-section {
      width: 100%;
    }

    .actions-section .btn {
      flex: 1;
      justify-content: center;
      padding: 7px 6px;
      font-size: 11.5px;
    }
  }
</style>
