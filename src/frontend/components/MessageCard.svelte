<script lang="ts">
  import type { Message } from '../types';
  import {
    buildForwardMailto,
    extractActionLink,
    extractOtp,
    formatForwardText,
    formatRelativeTime,
    formatTimestamp,
    getAvatarStyle,
    getSenderDetails,
    isHtmlContent,
    linkifyText,
    parseEmailThread,
    prepareEmailHtml,
  } from '../utils';

  interface Props {
    msg: Message;
    isOpen: boolean;
    forwardEmail?: string | null;
    onToggle: () => void;
    onDelete: () => void;
    onDownloadEml: () => void;
    onShowToast: (text: string) => void;
  }

  let {
    msg,
    isOpen,
    forwardEmail = null,
    onToggle,
    onDelete,
    onDownloadEml,
    onShowToast,
  }: Props = $props();

  let bodyCopied = $state(false);
  let otpCopied = $state(false);
  let forwardOpen = $state(false);
  let forwardTarget = $state('');
  let showQuotes = $state(false);
  let viewMode = $state<'rendered' | 'raw'>('rendered');
  let htmlTheme = $state<'light' | 'dark'>('light');
  let iframeHeight = $state('320px');

  let detectedOtp = $derived(extractOtp(msg.subject, msg.body));
  let actionLink = $derived(extractActionLink(msg.subject, msg.body));
  let senderDetails = $derived(getSenderDetails(msg.from_address));

  let initial = $derived(
    (senderDetails.displayName || msg.from_address || '?').trim().charAt(0).toUpperCase()
  );
  let avatarStyle = $derived(getAvatarStyle(msg.from_address));
  let relativeTime = $derived(formatRelativeTime(msg.received_at));
  let fullTime = $derived(formatTimestamp(msg.received_at));
  let hasHtml = $derived(isHtmlContent(msg.body || ''));
  let preparedHtml = $derived(
    hasHtml ? prepareEmailHtml(msg.body || '', htmlTheme === 'dark') : ''
  );
  let thread = $derived(!hasHtml ? parseEmailThread(msg.body || '') : null);
  let mainTextHtml = $derived(thread ? linkifyText(thread.mainText) : '');

  async function handleCopyBody() {
    if (!msg.body) return;
    try {
      await navigator.clipboard.writeText(msg.body);
      bodyCopied = true;
      onShowToast('Message content copied');
      setTimeout(() => {
        bodyCopied = false;
      }, 1600);
    } catch {
      onShowToast('Failed to copy message content');
    }
  }

  async function handleCopyOtp() {
    if (!detectedOtp) return;
    try {
      await navigator.clipboard.writeText(detectedOtp);
      otpCopied = true;
      onShowToast(`Verification code copied: ${detectedOtp}`);
      setTimeout(() => {
        otpCopied = false;
      }, 1800);
    } catch {
      onShowToast('Failed to copy verification code');
    }
  }

  function handleIframeLoad(e: Event) {
    const iframe = e.currentTarget as HTMLIFrameElement;
    try {
      if (iframe && iframe.contentDocument && iframe.contentDocument.documentElement) {
        const scrollHeight =
          iframe.contentDocument.documentElement.scrollHeight ||
          iframe.contentDocument.body.scrollHeight;
        if (scrollHeight > 50) {
          iframeHeight = `${Math.min(Math.max(scrollHeight + 28, 150), 2500)}px`;
        }
      }
    } catch {
      iframeHeight = '480px';
    }
  }

  $effect(() => {
    if (!forwardTarget && forwardEmail) {
      forwardTarget = forwardEmail;
    }
  });

  async function handleQuickForward(e?: MouseEvent) {
    if (e) e.stopPropagation();
    const target = (forwardTarget || forwardEmail || '').trim();
    const mailto = buildForwardMailto(msg, target);
    const forwardText = formatForwardText(msg);

    try {
      await navigator.clipboard.writeText(forwardText);
      onShowToast(
        target
          ? `Forward draft opened & copied for ${target}`
          : 'Forward draft opened & content copied'
      );
    } catch {
      onShowToast(target ? `Forward draft opened for ${target}` : 'Forward draft opened');
    }

    window.open(mailto, '_blank');
  }

  function handleToggleForwardBar(e?: MouseEvent) {
    if (e) e.stopPropagation();
    if (!isOpen) {
      onToggle();
    }
    forwardOpen = !forwardOpen;
  }

  async function handleCopyForwardText() {
    const text = formatForwardText(msg);
    try {
      await navigator.clipboard.writeText(text);
      onShowToast('Forward text copied to clipboard');
    } catch {
      onShowToast('Failed to copy forward text');
    }
  }

  let showDeleteModal = $state(false);

  function openDeleteModal(e?: MouseEvent) {
    if (e) e.stopPropagation();
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
  }

  function confirmDelete() {
    showDeleteModal = false;
    onDelete();
  }

  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeDeleteModal();
    }
  }
</script>

<div class="message-card" class:open={isOpen}>
  <div class="message-card-header">
    <!-- Left Trigger Area (Clickable to Expand / Collapse without nesting other buttons) -->
    <button
      type="button"
      class="message-summary-trigger"
      onclick={onToggle}
      aria-expanded={isOpen}
      title="Click to view message content"
    >
      <div
        class="sender-avatar"
        style="background: {avatarStyle.background}; border-color: {avatarStyle.borderColor}; color: {avatarStyle.color};"
      >
        {initial}
      </div>

      <div class="message-header-info">
        <div class="message-header-top">
          <span class="message-from" title={msg.from_address || 'Unknown sender'}>
            {senderDetails.displayName}
          </span>
          {#if senderDetails.domain}
            <span class="sender-domain-badge">@{senderDetails.domain}</span>
          {/if}
        </div>

        <div class="message-subject-wrap">
          <span class="message-subject">{msg.subject || '(No subject)'}</span>
        </div>
      </div>

      <span class="message-time" title={fullTime}>{relativeTime}</span>

      <span class="expand-chevron" aria-hidden="true">
        <svg class="ui-icon-xs chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>

    <!-- Sibling Action Cluster: separate interactive controls to prevent invalid HTML nesting -->
    <div class="message-actions-cluster">
      {#if detectedOtp}
        <button
          type="button"
          class="otp-pill"
          class:copied={otpCopied}
          onclick={handleCopyOtp}
          title="Click to copy verification code"
        >
          {#if otpCopied}
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{detectedOtp}</span>
          {:else}
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="15" r="4" />
              <line x1="10.85" y1="12.15" x2="19" y2="4" />
              <line x1="18" y1="5" x2="20" y2="7" />
              <line x1="15" y1="8" x2="17" y2="10" />
            </svg>
            <span>OTP: {detectedOtp}</span>
          {/if}
        </button>
      {/if}

      {#if actionLink}
        <a
          href={actionLink.url}
          target="_blank"
          rel="noopener noreferrer"
          class="quick-action-pill"
          title="Open verification link in new tab"
        >
          <span>{actionLink.label}</span>
          <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      {/if}

      <div class="icon-tools">
        <button
          type="button"
          class="icon-btn forward-icon"
          onclick={handleQuickForward}
          title={forwardEmail ? `Forward email to ${forwardEmail} (mailto:)` : 'Forward email (mailto:)'}
        >
          <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 10 20 15 15 20" />
            <path d="M4 4v7a4 4 0 0 0 4 4h12" />
          </svg>
        </button>
        <button type="button" class="icon-btn download-icon" onclick={onDownloadEml} title="Download message (.EML)">
          <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button type="button" class="icon-btn delete-icon" onclick={openDeleteModal} title="Delete message">
          <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  {#if isOpen}
    <div class="message-card-body">
      {#if actionLink}
        <div class="quick-action-banner">
          <div class="action-meta">
            <div class="action-icon-badge">
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>
            <div class="action-info">
              <span class="action-title">Action Detected</span>
              <span class="action-desc">Confirmation or login link ready to open</span>
            </div>
          </div>
          <a
            href={actionLink.url}
            target="_blank"
            rel="noopener noreferrer"
            class="action-cta-btn"
          >
            <span>{actionLink.label}</span>
            <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </div>
      {/if}

      {#if msg.body}
        <div class="message-body-toolbar">
          <div class="toolbar-left">
            <span class="format-badge" class:is-html={hasHtml}>
              {hasHtml ? 'HTML Email' : 'Plain Text'}
            </span>
            {#if hasHtml}
              <button
                type="button"
                class="toolbar-toggle-btn"
                onclick={() => (viewMode = viewMode === 'rendered' ? 'raw' : 'rendered')}
                title="Toggle rendered HTML and raw source"
              >
                {viewMode === 'rendered' ? 'View Raw' : 'View Rendered'}
              </button>
              {#if viewMode === 'rendered'}
                <button
                  type="button"
                  class="toolbar-toggle-btn theme-switch"
                  onclick={() => (htmlTheme = htmlTheme === 'light' ? 'dark' : 'light')}
                  title="Toggle Light or Dark email preview canvas"
                >
                  <span class="theme-dot" class:is-dark={htmlTheme === 'dark'}></span>
                  <span>{htmlTheme === 'light' ? 'Light Theme' : 'Dark Theme'}</span>
                </button>
              {/if}
            {/if}
          </div>

          <div class="toolbar-right">
            <button
              type="button"
              class="toolbar-btn"
              class:active={forwardOpen}
              onclick={handleToggleForwardBar}
              title="Manual forward options"
            >
              <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 10 20 15 15 20" />
                <path d="M4 4v7a4 4 0 0 0 4 4h12" />
              </svg>
              <span>{forwardOpen ? 'Forwarding' : 'Forward'}</span>
            </button>
            <button type="button" class="toolbar-btn" onclick={handleCopyBody} title="Copy message body">
              <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{bodyCopied ? 'Copied' : 'Copy Body'}</span>
            </button>
          </div>
        </div>

        {#if forwardOpen}
          <div class="forward-panel">
            <div class="forward-panel-row">
              <label for={`forward-target-${msg.id}`} class="forward-panel-label">To:</label>
              <input
                id={`forward-target-${msg.id}`}
                type="email"
                class="forward-target-input"
                placeholder="recipient@example.com"
                bind:value={forwardTarget}
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickForward();
                  }
                }}
              />
              <button
                type="button"
                class="btn-forward-send"
                onclick={() => handleQuickForward()}
                title="Launch mail client with prefilled draft"
              >
                <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>Open Mail Draft</span>
              </button>
              <button
                type="button"
                class="btn-forward-copy"
                onclick={handleCopyForwardText}
                title="Copy formatted forwarded email body to clipboard"
              >
                Copy Draft
              </button>
              <button
                type="button"
                class="btn-forward-close"
                onclick={() => (forwardOpen = false)}
                title="Close forward bar"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        {/if}

        {#if viewMode === 'raw'}
          <div class="message-raw-box">{msg.body}</div>
        {:else if hasHtml}
          <div class="iframe-canvas-wrap" class:dark-canvas={htmlTheme === 'dark'}>
            <iframe
              class="message-iframe"
              sandbox="allow-same-origin allow-popups"
              srcdoc={preparedHtml}
              onload={handleIframeLoad}
              style="height: {iframeHeight};"
              title="Email content preview"
            ></iframe>
          </div>
        {:else}
          <div class="message-text-content">
            {#if mainTextHtml}
              <div class="primary-text-body">{@html mainTextHtml}</div>
            {:else}
              <div class="primary-text-body">(Message without main text)</div>
            {/if}

            {#if thread && thread.hasQuotes}
              <div class="email-quotes-wrapper">
                <button
                  type="button"
                  class="quote-toggle-btn"
                  onclick={() => (showQuotes = !showQuotes)}
                  title="Toggle quoted reply history"
                >
                  <span class="quote-dots">···</span>
                  <span class="quote-toggle-label">
                    {showQuotes
                      ? 'Hide quoted history'
                      : `Show quoted history (${thread.quoteItems.length} lines)`}
                  </span>
                </button>

                {#if showQuotes}
                  <div class="email-quotes-box">
                    {#if thread.attribution}
                      <div class="quote-attribution">{thread.attribution}</div>
                    {/if}
                    <div class="quote-items-tree">
                      {#each thread.quoteItems as item}
                        <div class="quote-item depth-{Math.min(item.depth, 4)}">
                          {@html linkifyText(item.text || ' ')}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      {:else}
        <div class="message-text-content empty-msg">(Empty message)</div>
      {/if}
    </div>
  {/if}
</div>

{#if showDeleteModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="modal-overlay"
    onclick={closeDeleteModal}
    onkeydown={handleModalKeydown}
    role="presentation"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-card delete-modal"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-msg-title"
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

      <h3 id="delete-msg-title" class="delete-modal-title">Delete Email?</h3>
      <p class="delete-modal-desc">
        Are you sure you want to permanently delete this email from <strong class="delete-sender">{senderDetails.displayName}</strong>?
        {#if msg.subject}
          <span class="delete-subject-badge">"{msg.subject}"</span>
        {/if}
      </p>

      <div class="delete-modal-actions">
        <button type="button" class="btn btn-secondary cancel-modal-btn" onclick={closeDeleteModal}>
          Cancel
        </button>
        <button type="button" class="btn btn-danger-solid confirm-modal-btn" onclick={confirmDelete}>
          <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete Permanently</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .message-card {
    border-bottom: 1px solid var(--border-subtle);
    background: transparent;
    transition: background-color var(--transition);
  }

  .message-card:last-child {
    border-bottom: none;
  }

  .message-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    transition: background-color var(--transition);
  }

  .message-card-header:hover {
    background: var(--bg-hover);
  }

  /* Summary trigger button: handles card expand / collapse */
  .message-summary-trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    background: transparent;
    border: none;
    padding: 6px 4px;
    cursor: pointer;
    text-align: left;
    min-width: 0;
    flex: 1;
    color: inherit;
  }

  .sender-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    flex-shrink: 0;
    border: 1px solid transparent;
  }

  .message-header-info {
    flex: 1;
    min-width: 0;
  }

  .message-header-top {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 2px;
  }

  .message-from {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sender-domain-badge {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .message-subject-wrap {
    display: flex;
    align-items: center;
  }

  .message-subject {
    font-size: 12.5px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-time {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    margin-left: 8px;
    margin-right: 4px;
  }

  .expand-chevron {
    color: var(--text-muted);
    transition: transform var(--transition);
    display: flex;
    align-items: center;
  }

  .message-card.open .expand-chevron {
    transform: rotate(180deg);
  }

  /* Separate Actions Cluster */
  .message-actions-cluster {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .otp-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: var(--radius-xs);
    font-size: 11px;
    font-weight: 700;
    color: var(--green-soft);
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all var(--transition);
  }

  .otp-pill:hover {
    background: rgba(16, 185, 129, 0.22);
    border-color: var(--green);
  }

  .otp-pill.copied {
    background: var(--green);
    color: #ffffff;
  }

  .quick-action-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: var(--radius-xs);
    font-size: 11px;
    font-weight: 600;
    color: var(--amber-soft);
    text-decoration: none;
    transition: all var(--transition);
  }

  .quick-action-pill:hover {
    background: rgba(245, 158, 11, 0.22);
    border-color: var(--amber);
  }

  .icon-tools {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: all var(--transition);
  }

  .icon-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-primary);
  }

  .icon-btn.delete-icon:hover {
    background: rgba(239, 68, 68, 0.15);
    color: var(--red);
  }

  .icon-btn.forward-icon:hover {
    background: rgba(16, 185, 129, 0.15);
    color: var(--signal-emerald);
  }

  /* Full-width Message Reader Canvas */
  .message-card-body {
    padding: 12px 16px 16px;
    background: var(--bg-root);
    border-top: 1px solid var(--border-subtle);
  }

  .quick-action-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: var(--radius-sm);
    margin-bottom: 12px;
    gap: 10px;
  }

  .action-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .action-icon-badge {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs);
    background: rgba(245, 158, 11, 0.15);
    color: var(--amber-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-info {
    display: flex;
    flex-direction: column;
  }

  .action-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .action-desc {
    font-size: 11px;
    color: var(--text-muted);
  }

  .action-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--amber);
    color: #09090b;
    border-radius: var(--radius-xs);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all var(--transition);
  }

  .action-cta-btn:hover {
    background: var(--amber-soft);
  }

  .message-body-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .format-badge {
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-secondary);
  }

  .toolbar-toggle-btn,
  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    font-size: 11px;
    color: var(--text-secondary);
    transition: all var(--transition);
  }

  .toolbar-toggle-btn:hover,
  .toolbar-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .toolbar-btn.active {
    background: #27272a;
    border-color: #3f3f46;
    color: #ffffff;
  }

  .forward-panel {
    background: #18181b;
    border: 1px solid var(--border-hover);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    margin-bottom: 12px;
  }

  .forward-panel-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .forward-panel-label {
    font-size: 11.5px;
    color: var(--text-muted);
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .forward-target-input {
    flex: 1;
    min-width: 200px;
    height: 28px;
    padding: 0 8px;
    background: var(--bg-root);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font-mono);
    outline: none;
    transition: border-color var(--transition);
  }

  .forward-target-input:focus {
    border-color: var(--signal-emerald);
  }

  .btn-forward-send {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--radius-xs);
    background: var(--signal-emerald);
    color: #000000;
    font-size: 11.5px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity var(--transition);
  }

  .btn-forward-send:hover {
    opacity: 0.9;
  }

  .btn-forward-copy {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--radius-xs);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-forward-copy:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .btn-forward-close {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-xs);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .btn-forward-close:hover {
    color: var(--text-primary);
  }

  .theme-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e4e4e7;
  }

  .theme-dot.is-dark {
    background: #27272a;
    border: 1px solid #71717a;
  }

  .message-raw-box {
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
    line-height: 1.6;
    padding: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    max-height: 500px;
    overflow-y: auto;
  }

  .iframe-canvas-wrap {
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
    background: #ffffff;
  }

  .iframe-canvas-wrap.dark-canvas {
    background: #111114;
  }

  .message-iframe {
    width: 100%;
    border: none;
    display: block;
  }

  .message-text-content {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    padding: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .primary-text-body {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .email-quotes-wrapper {
    margin-top: 10px;
  }

  .quote-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    font-size: 11px;
    color: var(--text-muted);
  }

  .quote-toggle-btn:hover {
    color: var(--text-primary);
  }

  .quote-attribution {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 8px;
    margin-bottom: 4px;
    font-style: italic;
  }

  .quote-item {
    padding-left: 8px;
    border-left: 2px solid var(--border-hover);
    margin: 3px 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .quote-item.depth-2 {
    border-left-color: var(--text-muted);
    margin-left: 8px;
  }

  .quote-item.depth-3 {
    border-left-color: var(--text-secondary);
    margin-left: 16px;
  }

  .empty-msg {
    font-style: italic;
    color: var(--text-muted);
  }

  /* Delete Confirmation Modal */
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

  .delete-sender {
    color: var(--text-primary);
    font-weight: 600;
  }

  .delete-subject-badge {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--bg-elevated);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--border);
    word-break: break-all;
    display: block;
    margin-top: 6px;
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

  .confirm-modal-btn:hover {
    background: #dc2626;
  }

  @media (max-width: 640px) {
    .message-card-header {
      flex-direction: column;
      align-items: stretch;
      padding: 8px 10px;
      gap: 6px;
    }

    .message-summary-trigger {
      width: 100%;
    }

    .message-actions-cluster {
      justify-content: flex-end;
      padding-left: 44px;
    }

    .message-card-body {
      padding: 10px 12px 14px;
    }
  }
</style>
