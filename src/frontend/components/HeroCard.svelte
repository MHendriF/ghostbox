<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Inbox } from '../types';

  interface Props {
    inboxes: Inbox[];
    activeAddress: string;
    authRequired: boolean;
    onSelectInbox: (addr: string) => void;
    onQuickRandom: () => void;
    onToggleDrawer: () => void;
    onRefresh: () => void;
    onDeleteInbox: () => void;
    onLock: () => void;
    onShowToast: (msg: string) => void;
  }

  let {
    inboxes,
    activeAddress,
    authRequired,
    onSelectInbox,
    onQuickRandom,
    onToggleDrawer,
    onRefresh,
    onDeleteInbox,
    onLock,
    onShowToast,
  }: Props = $props();

  let copied = $state(false);
  let isSelectOpen = $state(false);
  let searchQuery = $state('');
  let searchInputEl: HTMLInputElement | null = $state(null);
  let comboboxWrapper: HTMLDivElement | null = $state(null);

  let filteredInboxes = $derived(
    inboxes.filter((inb) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return inb.address.toLowerCase().includes(q);
    })
  );

  function toggleDropdown() {
    isSelectOpen = !isSelectOpen;
    if (isSelectOpen) {
      searchQuery = '';
      setTimeout(() => {
        searchInputEl?.focus();
      }, 50);
    }
  }

  function handleSelect(address: string) {
    onSelectInbox(address);
    isSelectOpen = false;
    searchQuery = '';
  }

  function handleClickOutside(e: MouseEvent) {
    if (isSelectOpen && comboboxWrapper && !comboboxWrapper.contains(e.target as Node)) {
      isSelectOpen = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isSelectOpen) {
      isSelectOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
  });

  async function handleCopy() {
    if (!activeAddress) return;
    try {
      await navigator.clipboard.writeText(activeAddress);
      copied = true;
      onShowToast('Email address copied to clipboard');
      setTimeout(() => {
        copied = false;
      }, 1800);
    } catch {
      onShowToast('Failed to copy to clipboard');
    }
  }
</script>

<section class="hero-card">
  <div class="hero-top">
    <div class="hero-top-left">
      <div class="hero-badge">
        <span class="live-dot"></span>
        <span>Live Polling</span>
      </div>
      {#if authRequired}
        <button class="lock-btn" onclick={onLock} title="Lock session / Logout">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Lock</span>
        </button>
      {/if}
    </div>
    <div class="inbox-switch-wrapper" bind:this={comboboxWrapper}>
      <span class="switch-label">Switch Inbox:</span>
      <div class="combobox-container">
        <button
          type="button"
          class="combobox-trigger"
          class:open={isSelectOpen}
          onclick={toggleDropdown}
          aria-haspopup="listbox"
          aria-expanded={isSelectOpen}
          aria-label="Switch active inbox"
        >
          <span class="trigger-text">{activeAddress || 'Select an inbox...'}</span>
          <svg class="ui-icon chevron-icon" class:rotate={isSelectOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {#if isSelectOpen}
          <div class="combobox-dropdown" role="listbox">
            <div class="combobox-search-box">
              <svg class="combobox-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                bind:this={searchInputEl}
                type="text"
                class="combobox-search-input"
                placeholder="Search inbox..."
                bind:value={searchQuery}
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => {
                  if (e.key === 'Escape') {
                    isSelectOpen = false;
                  } else if (e.key === 'Enter' && filteredInboxes.length > 0) {
                    handleSelect(filteredInboxes[0].address);
                  }
                }}
              />
              {#if searchQuery}
                <button
                  type="button"
                  class="search-clear-btn"
                  onclick={() => (searchQuery = '')}
                  title="Clear search"
                >
                  ✕
                </button>
              {/if}
            </div>

            <div class="combobox-meta">
              <span>{filteredInboxes.length} of {inboxes.length} inboxes</span>
            </div>

            <div class="combobox-list">
              {#if filteredInboxes.length === 0}
                <div class="combobox-empty">
                  No inbox matching "{searchQuery}"
                </div>
              {:else}
                {#each filteredInboxes as inb (inb.address)}
                  <button
                    type="button"
                    class="combobox-item"
                    class:active={inb.address === activeAddress}
                    onclick={() => handleSelect(inb.address)}
                  >
                    <span class="item-text">{inb.address}</span>
                    {#if inb.address === activeAddress}
                      <svg class="ui-icon item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    {/if}
                  </button>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="hero-address-box">
    <div class="address-display">
      <span class="address-label">Active Disposable Address</span>
      <div class="address-text-wrap">
        <span class="address-text">{activeAddress || 'No inbox selected'}</span>
      </div>
    </div>
    <button class="hero-copy-btn" class:copied onclick={handleCopy} title="Copy email address to clipboard (c)">
      <span class="copy-icon">
        {#if copied}
          <svg class="ui-icon check-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        {:else}
          <svg class="ui-icon copy-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        {/if}
      </span>
      <span class="copy-label">{copied ? 'Copied!' : 'Copy Address'}</span>
    </button>
  </div>

  <div class="hero-actions">
    <button class="btn btn-primary" onclick={onQuickRandom}>
      <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <circle cx="15.5" cy="8.5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="8.5" cy="15.5" r="1.5" />
        <circle cx="15.5" cy="15.5" r="1.5" />
      </svg>
      <span>Quick Random</span>
    </button>
    <button class="btn btn-secondary" onclick={onToggleDrawer}>
      <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span>Custom Inbox</span>
    </button>
    <button class="btn btn-secondary" onclick={onRefresh}>
      <svg class="ui-icon refresh-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      <span>Refresh</span>
    </button>
    <button class="btn btn-danger-ghost" onclick={onDeleteInbox}>
      <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      <span>Delete</span>
    </button>
  </div>
</section>

<style>
  .hero-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(8px);
    position: relative;
    z-index: 20;
  }

  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .hero-top-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--green-soft);
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    animation: pulseDot 2s infinite ease-in-out;
  }

  @keyframes pulseDot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.35); opacity: 0.6; }
  }

  .lock-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    transition: all var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .lock-btn:hover {
    background: rgba(244, 63, 94, 0.15);
    border-color: var(--red);
    color: var(--red);
  }

  .inbox-switch-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-muted);
    position: relative;
  }

  .switch-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .combobox-container {
    position: relative;
    width: 260px;
    max-width: 100%;
  }

  .combobox-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 12px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
  }

  .combobox-trigger:hover,
  .combobox-trigger.open {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }

  .combobox-trigger.open {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-glow);
  }

  .trigger-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .chevron-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--text-muted);
    transition: transform var(--transition);
  }

  .chevron-icon.rotate {
    transform: rotate(180deg);
    color: var(--accent);
  }

  .combobox-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 320px;
    max-width: 90vw;
    background: var(--bg-surface);
    border: 1px solid var(--border-hover);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    overflow: hidden;
    backdrop-filter: blur(16px);
    animation: dropdownFadeIn 150ms ease-out;
  }

  @keyframes dropdownFadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .combobox-search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
    transition: border-color var(--transition), background-color var(--transition);
  }

  .combobox-search-box:focus-within {
    border-bottom-color: var(--border-focus);
    background: rgba(255, 255, 255, 0.03);
  }

  .combobox-search-ico {
    width: 15px;
    height: 15px;
    color: var(--text-muted);
    flex-shrink: 0;
    position: static !important;
    display: block;
    pointer-events: none;
    transition: color var(--transition);
  }

  .combobox-search-box:focus-within .combobox-search-ico {
    color: var(--accent-soft);
  }

  .combobox-search-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
    outline: none;
    padding: 2px 0;
    line-height: 1.4;
  }

  .combobox-search-input::placeholder {
    color: var(--text-muted);
  }

  .search-clear-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: all var(--transition);
  }

  .search-clear-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.15);
    border-color: var(--border-hover);
  }

  .combobox-meta {
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border);
  }

  .combobox-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
  }

  .combobox-list::-webkit-scrollbar {
    width: 5px;
  }

  .combobox-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .combobox-list::-webkit-scrollbar-thumb {
    background: var(--border-hover);
    border-radius: 999px;
  }

  .combobox-empty {
    padding: 16px 12px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }

  .combobox-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition);
    text-align: left;
  }

  .combobox-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .combobox-item.active {
    background: rgba(99, 102, 241, 0.12);
    color: var(--accent-soft);
    font-weight: 600;
  }

  .item-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .item-check {
    width: 14px;
    height: 14px;
    color: var(--accent);
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .inbox-switch-wrapper {
      width: 100%;
      justify-content: space-between;
    }

    .combobox-container {
      flex: 1;
      width: auto;
    }

    .combobox-dropdown {
      right: 0;
      left: 0;
      width: 100%;
      max-width: 100%;
    }
  }

  .hero-address-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    margin-bottom: 20px;
    transition: border-color var(--transition);
  }

  .hero-address-box:hover {
    border-color: var(--border-hover);
  }

  .address-display {
    min-width: 0;
    flex: 1;
  }

  .address-label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .address-text-wrap {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .address-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.3px;
    word-break: break-all;
  }

  .hero-copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: var(--accent);
    color: #ffffff;
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 10px var(--accent-glow);
    transition: all var(--transition);
    flex-shrink: 0;
  }

  .hero-copy-btn:hover {
    background: var(--accent-soft);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px var(--accent-glow);
  }

  .hero-copy-btn.copied {
    background: var(--green);
    box-shadow: 0 2px 10px var(--green-glow);
  }

  .hero-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn-danger-ghost {
    margin-left: auto;
  }
</style>
