<script lang="ts">
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

  async function handleCopy() {
    if (!activeAddress) return;
    try {
      await navigator.clipboard.writeText(activeAddress);
      copied = true;
      onShowToast('Alamat email disalin ke clipboard');
      setTimeout(() => {
        copied = false;
      }, 1800);
    } catch {
      onShowToast('Gagal menyalin ke clipboard');
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
        <button class="lock-btn" onclick={onLock} title="Kunci sesi / Logout">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Lock</span>
        </button>
      {/if}
    </div>
    <div class="inbox-switch-wrapper">
      <label for="inboxSelect">Switch Inbox:</label>
      <select
        id="inboxSelect"
        value={activeAddress}
        onchange={(e) => onSelectInbox((e.target as HTMLSelectElement).value)}
        aria-label="Switch active inbox"
      >
        {#each inboxes as inb (inb.address)}
          <option value={inb.address}>{inb.address}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="hero-address-box">
    <div class="address-display">
      <span class="address-label">Active Disposable Address</span>
      <div class="address-text-wrap">
        <span class="address-text">{activeAddress || 'No inbox selected'}</span>
      </div>
    </div>
    <button class="hero-copy-btn" class:copied onclick={handleCopy} title="Copy email address to clipboard">
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
  }

  .inbox-switch-wrapper select {
    padding: 6px 28px 6px 12px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 16px;
    transition: border-color var(--transition);
  }

  .inbox-switch-wrapper select:hover {
    border-color: var(--border-hover);
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
