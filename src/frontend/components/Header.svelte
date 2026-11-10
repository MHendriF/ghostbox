<script lang="ts">
  interface Props {
    appName?: string;
    mailDomain?: string;
    countdown?: number;
    authRequired?: boolean;
    forwardEmail?: string | null;
    onLock?: () => void;
  }

  let {
    appName = 'GhostBox',
    mailDomain = '',
    countdown = 15,
    authRequired = false,
    forwardEmail = null,
    onLock,
  }: Props = $props();
</script>

<header class="topbar">
  <div class="topbar-left">
    <div class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" class="brand-svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <div class="brand-titles">
        <span class="brand-name">{appName}</span>
        {#if mailDomain}
          <span class="brand-domain">@{mailDomain}</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="topbar-center">
    <div class="status-chip" title="Live inbound mail poller">
      <span class="live-dot"></span>
      <span class="status-label">Live</span>
      <span class="status-countdown">{countdown}s</span>
    </div>
    {#if forwardEmail}
      <div class="forward-chip" title="Global forwarding active: Inbound messages are routed to {forwardEmail}">
        <svg class="ui-icon-xs forward-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 10 20 15 15 20" />
          <path d="M4 4v7a4 4 0 0 0 4 4h12" />
        </svg>
        <span class="forward-label">Fwd:</span>
        <span class="forward-email">{forwardEmail}</span>
      </div>
    {/if}
  </div>

  <div class="topbar-right">
    {#if authRequired && onLock}
      <button type="button" class="lock-btn" onclick={onLock} title="Lock current session">
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>Lock</span>
      </button>
    {/if}
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 16px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: 16px;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }

  .brand-mark {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
  }

  .brand-svg {
    width: 15px;
    height: 15px;
    stroke: var(--text-primary);
  }

  .brand-titles {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
  }

  .brand-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .brand-domain {
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .topbar-center {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .forward-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: 999px;
    font-size: 11px;
    color: var(--green-soft);
    font-weight: 500;
    max-width: 260px;
  }

  .forward-label {
    font-weight: 600;
    opacity: 0.85;
  }

  .forward-email {
    font-family: var(--font-mono);
    font-size: 10.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .forward-svg {
    flex-shrink: 0;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: 999px;
    font-size: 11px;
    color: var(--green-soft);
    font-weight: 500;
  }

  .status-label {
    font-weight: 600;
  }

  .status-countdown {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .lock-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 500;
    transition: all var(--transition);
  }

  .lock-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--red);
    color: var(--red);
  }
</style>
