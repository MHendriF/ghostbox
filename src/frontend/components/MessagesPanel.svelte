<script lang="ts">
  import type { Message } from '../types';
  import { extractActionLink, extractOtp, isToday, parseDate } from '../utils';
  import MessageCard from './MessageCard.svelte';

  interface Props {
    messages: Message[];
    activeInboxAddress: string;
    countdownSeconds: number;
    forwardEmail?: string | null;
    onDeleteMessage: (id: string) => void;
    onDownloadEml: (msg: Message) => void;
    onShowToast: (text: string) => void;
  }

  let {
    messages,
    activeInboxAddress,
    countdownSeconds,
    forwardEmail = null,
    onDeleteMessage,
    onDownloadEml,
    onShowToast,
  }: Props = $props();

  let searchQuery = $state('');
  let activeFilter = $state<'all' | 'today' | 'otp' | 'action'>('all');
  let sortOrder = $state<'newest' | 'oldest'>('newest');
  let openMessageIds = $state<string[]>([]);
  let lastAutoOpenedInbox = $state<string>('');

  let todayCount = $derived(
    messages.filter((m) => isToday(m.received_at)).length
  );
  let otpCount = $derived(
    messages.filter((m) => !!extractOtp(m.subject, m.body)).length
  );
  let actionCount = $derived(
    messages.filter((m) => !!extractActionLink(m.subject, m.body)).length
  );

  // Auto-open first message once per inbox load / switch
  $effect(() => {
    if (activeInboxAddress && activeInboxAddress !== lastAutoOpenedInbox && messages.length > 0) {
      lastAutoOpenedInbox = activeInboxAddress;
      openMessageIds = [messages[0].id];
    } else if (!activeInboxAddress) {
      lastAutoOpenedInbox = '';
    }
  });

  let filteredMessages = $derived.by(() => {
    let result = messages;
    if (activeFilter === 'today') {
      result = result.filter((msg) => isToday(msg.received_at));
    } else if (activeFilter === 'otp') {
      result = result.filter((msg) => !!extractOtp(msg.subject, msg.body));
    } else if (activeFilter === 'action') {
      result = result.filter((msg) => !!extractActionLink(msg.subject, msg.body));
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((msg) => {
        const subj = (msg.subject || '').toLowerCase();
        const from = (msg.from_address || '').toLowerCase();
        const body = (msg.body || '').toLowerCase();
        return subj.includes(q) || from.includes(q) || body.includes(q);
      });
    }

    return [...result].sort((a, b) => {
      const timeA = parseDate(a.received_at).getTime();
      const timeB = parseDate(b.received_at).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  });

  function toggleOpen(id: string) {
    if (openMessageIds.includes(id)) {
      openMessageIds = openMessageIds.filter((item) => item !== id);
    } else {
      openMessageIds = [...openMessageIds, id];
    }
  }

  function resetSearch() {
    searchQuery = '';
    activeFilter = 'all';
  }
</script>

<section class="messages-panel">
  <div class="panel-header">
    <div class="header-left">
      <h2 class="panel-title">Incoming Messages</h2>
      <span class="count-pill">
        {#if searchQuery || activeFilter !== 'all'}
          {filteredMessages.length} / {messages.length}
        {:else}
          {messages.length}
        {/if}
      </span>
    </div>

    <div class="header-right">
      <div class="refresh-indicator" title="Auto-refresh countdown">
        <span class="pulse-dot"></span>
        <span class="countdown-text">{countdownSeconds}s</span>
      </div>

      <button
        type="button"
        class="sort-toggle-btn"
        onclick={() => (sortOrder = sortOrder === 'newest' ? 'oldest' : 'newest')}
        title={sortOrder === 'newest' ? 'Click to sort oldest first' : 'Click to sort newest first'}
      >
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {#if sortOrder === 'newest'}
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          {:else}
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          {/if}
        </svg>
        <span>{sortOrder === 'newest' ? 'Newest' : 'Oldest'}</span>
      </button>
    </div>
  </div>

  <div class="panel-toolbar">
    <div class="search-wrap">
      <svg class="ui-icon-xs search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Filter subject, sender, or content... (/)"
        autocomplete="off"
      />
      {#if searchQuery}
        <button type="button" class="clear-search-btn" onclick={() => (searchQuery = '')} title="Clear search">
          ✕
        </button>
      {/if}
    </div>

    <div class="filter-tabs">
      <button
        type="button"
        class="filter-tab-btn"
        class:active={activeFilter === 'all'}
        onclick={() => (activeFilter = 'all')}
      >
        <span>All</span>
        <span class="tab-badge">{messages.length}</span>
      </button>

      <button
        type="button"
        class="filter-tab-btn"
        class:active={activeFilter === 'today'}
        onclick={() => (activeFilter = 'today')}
        title="Messages received today"
      >
        <span>Today</span>
        {#if todayCount > 0}
          <span class="tab-badge highlight">{todayCount}</span>
        {/if}
      </button>

      <button
        type="button"
        class="filter-tab-btn"
        class:active={activeFilter === 'otp'}
        onclick={() => (activeFilter = 'otp')}
      >
        <span>OTP / Codes</span>
        {#if otpCount > 0}
          <span class="tab-badge emerald">{otpCount}</span>
        {/if}
      </button>

      <button
        type="button"
        class="filter-tab-btn"
        class:active={activeFilter === 'action'}
        onclick={() => (activeFilter = 'action')}
      >
        <span>Actions</span>
        {#if actionCount > 0}
          <span class="tab-badge amber">{actionCount}</span>
        {/if}
      </button>
    </div>
  </div>

  <div class="message-list">
    {#if messages.length === 0}
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <svg class="empty-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <div class="empty-title">Waiting for incoming emails...</div>
        <div class="empty-desc">
          Send an email to <code>{activeInboxAddress || 'active address'}</code>. Messages will appear automatically.
        </div>
      </div>
    {:else if filteredMessages.length === 0}
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <svg class="empty-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div class="empty-title">No matching messages found</div>
        <div class="empty-desc">Try clearing or adjusting your search keyword.</div>
        <button type="button" class="btn btn-secondary" onclick={resetSearch}>Clear Filter</button>
      </div>
    {:else}
      {#each filteredMessages as msg (msg.id)}
        <MessageCard
          {msg}
          isOpen={openMessageIds.includes(msg.id)}
          {forwardEmail}
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
  .messages-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(24, 24, 27, 0.4);
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .count-pill {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .refresh-indicator {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    padding: 2px 7px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
  }

  .pulse-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
  }

  .sort-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 11.5px;
    transition: all var(--transition);
  }

  .sort-toggle-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .panel-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    gap: 10px;
    border-bottom: 1px solid var(--border-subtle);
    background: rgba(18, 18, 20, 0.6);
    flex-wrap: wrap;
  }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
  }

  .search-icon {
    position: absolute;
    left: 8px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-wrap input {
    width: 100%;
    padding: 5px 24px 5px 26px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
    transition: border-color var(--transition);
  }

  .search-wrap input:focus {
    outline: none;
    border-color: var(--border-hover);
  }

  .clear-search-btn {
    position: absolute;
    right: 6px;
    font-size: 11px;
    color: var(--text-muted);
    padding: 2px 4px;
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .filter-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 11.5px;
    font-weight: 500;
    transition: all var(--transition);
  }

  .filter-tab-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .filter-tab-btn.active {
    background: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }

  .tab-badge {
    font-family: var(--font-mono);
    font-size: 10.5px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--bg-root);
    color: var(--text-muted);
  }

  .tab-badge.highlight {
    background: rgba(244, 244, 245, 0.15);
    color: var(--text-primary);
  }

  .tab-badge.emerald {
    background: rgba(16, 185, 129, 0.15);
    color: var(--green-soft);
  }

  .tab-badge.amber {
    background: rgba(245, 158, 11, 0.15);
    color: var(--amber-soft);
  }

  .message-list {
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    padding: 48px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 8px;
  }

  .empty-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .empty-svg {
    width: 22px;
    height: 22px;
  }

  .empty-title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .empty-desc {
    font-size: 12px;
    color: var(--text-muted);
    max-width: 340px;
    line-height: 1.5;
  }

  .empty-desc code {
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  @media (max-width: 640px) {
    .panel-header {
      padding: 10px 12px;
    }

    .panel-toolbar {
      padding: 8px 10px;
    }

    .filter-tabs {
      width: 100%;
    }

    .filter-tab-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>
