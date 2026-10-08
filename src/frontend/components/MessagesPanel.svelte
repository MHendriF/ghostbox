<script lang="ts">
  import type { Message } from '../types';
  import { extractOtp } from '../utils';
  import MessageCard from './MessageCard.svelte';

  interface Props {
    messages: Message[];
    activeInboxAddress: string;
    countdownSeconds: number;
    onDeleteMessage: (id: string) => void;
    onDownloadEml: (msg: Message) => void;
    onShowToast: (text: string) => void;
  }

  let {
    messages,
    activeInboxAddress,
    countdownSeconds,
    onDeleteMessage,
    onDownloadEml,
    onShowToast,
  }: Props = $props();

  let searchQuery = $state('');
  let activeFilter = $state<'all' | 'otp'>('all');
  let openMessageIds = $state<string[]>([]);

  // Auto-open first message when messages list changes
  $effect(() => {
    if (messages.length > 0 && openMessageIds.length === 0) {
      openMessageIds = [messages[0].id];
    }
  });

  let filteredMessages = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    return messages.filter((msg) => {
      if (activeFilter === 'otp') {
        const otp = extractOtp(msg.subject, msg.body);
        if (!otp) return false;
      }
      if (q) {
        const subj = (msg.subject || '').toLowerCase();
        const from = (msg.from_address || '').toLowerCase();
        const body = (msg.body || '').toLowerCase();
        return subj.includes(q) || from.includes(q) || body.includes(q);
      }
      return true;
    });
  });

  function toggleOpen(id: string) {
    if (openMessageIds.includes(id)) {
      openMessageIds = openMessageIds.filter((item) => item !== id);
    } else {
      openMessageIds = [...openMessageIds, id];
    }
  }

  function resetFilters() {
    searchQuery = '';
    activeFilter = 'all';
  }
</script>

<section class="panel">
  <div class="panel-head">
    <div class="panel-title-wrap">
      <h2>Incoming Messages</h2>
      <span class="badge">
        {#if searchQuery || activeFilter !== 'all'}
          {filteredMessages.length} of {messages.length} messages
        {:else}
          {messages.length} messages
        {/if}
      </span>
    </div>
    <div class="refresh-indicator" title="Auto-refresh countdown">
      <span class="spinner-dot"></span>
      <span class="countdown-text">{countdownSeconds}s</span>
    </div>
  </div>

  <div class="panel-toolbar">
    <div class="search-wrap">
      <span class="search-icon">
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search subject, sender, or content..."
        autocomplete="off"
      />
      {#if searchQuery}
        <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')} title="Clear search">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      {/if}
    </div>

    <div class="filter-tabs">
      <button
        type="button"
        class="filter-tab"
        class:active={activeFilter === 'all'}
        onclick={() => (activeFilter = 'all')}
      >
        All
      </button>
      <button
        type="button"
        class="filter-tab"
        class:active={activeFilter === 'otp'}
        onclick={() => (activeFilter = 'otp')}
      >
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4" />
          <line x1="10.85" y1="12.15" x2="19" y2="4" />
          <line x1="18" y1="5" x2="20" y2="7" />
          <line x1="15" y1="8" x2="17" y2="10" />
        </svg>
        <span>OTP Only</span>
      </button>
    </div>
  </div>

  <div class="message-list">
    {#if messages.length === 0}
      <div class="empty-state">
        <div class="icon empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div class="title">Waiting for incoming emails...</div>
        <div class="sub">
          Send an email to {activeInboxAddress || 'the active address'}. Messages will appear automatically within seconds.
        </div>
      </div>
    {:else if filteredMessages.length === 0}
      <div class="empty-state">
        <div class="icon empty-state-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div class="title">No matching messages found</div>
        <div class="sub">Try adjusting your search query or reset the OTP filter.</div>
        <button class="btn btn-secondary" onclick={resetFilters}>Reset Filters</button>
      </div>
    {:else}
      {#each filteredMessages as msg (msg.id)}
        <MessageCard
          {msg}
          isOpen={openMessageIds.includes(msg.id)}
          onToggle={() => toggleOpen(msg.id)}
          onDelete={() => onDeleteMessage(msg.id)}
          onDownloadEml={() => onDownloadEml(msg)}
          {onShowToast}
        />
      {/each}
    {/if}
  </div>
</section>

<style>
  .panel {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .panel-head {
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(24, 24, 31, 0.4);
  }

  .panel-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .panel-title-wrap h2 {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .refresh-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }

  .spinner-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--border-hover);
    border-top-color: var(--accent);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .panel-toolbar {
    padding: 12px 24px;
    background: rgba(18, 18, 24, 0.6);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    pointer-events: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .search-wrap input {
    width: 100%;
    padding: 8px 34px 8px 34px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    transition: all var(--transition);
  }

  .search-wrap input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  .clear-search-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all var(--transition);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .clear-search-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .filter-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-tab {
    padding: 6px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .filter-tab:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  .filter-tab.active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(129, 140, 248, 0.15));
    border-color: var(--accent);
    color: #c7d2fe;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
  }

  .message-list {
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 20px;
    text-align: center;
  }

  .empty-state .icon {
    width: 58px;
    height: 58px;
    border-radius: 16px;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-soft);
    margin-bottom: 16px;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  }

  .empty-state .title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 6px;
    color: var(--text-primary);
  }

  .empty-state .sub {
    font-size: 13px;
    color: var(--text-muted);
    max-width: 320px;
    line-height: 1.6;
    margin-bottom: 20px;
  }
</style>
