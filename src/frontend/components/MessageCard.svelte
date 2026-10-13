<script lang="ts">
  import type { Message } from '../types';
  import {
    extractActionLink,
    extractOtp,
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
    onToggle: () => void;
    onDelete: () => void;
    onDownloadEml: () => void;
    onShowToast: (text: string) => void;
  }

  let { msg, isOpen, onToggle, onDelete, onDownloadEml, onShowToast }: Props = $props();

  let bodyCopied = $state(false);
  let otpCopied = $state(false);
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

  async function handleCopyBody(e: MouseEvent) {
    e.stopPropagation();
    if (!msg.body) return;
    try {
      await navigator.clipboard.writeText(msg.body);
      bodyCopied = true;
      onShowToast('Message content copied');
      setTimeout(() => {
        bodyCopied = false;
      }, 1800);
    } catch {
      onShowToast('Failed to copy message content');
    }
  }

  async function handleCopyOtp(e: MouseEvent) {
    e.stopPropagation();
    if (!detectedOtp) return;
    try {
      await navigator.clipboard.writeText(detectedOtp);
      otpCopied = true;
      onShowToast(`Verification code copied: ${detectedOtp}`);
      setTimeout(() => {
        otpCopied = false;
      }, 2000);
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

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    onDelete();
  }

  function handleDownload(e: MouseEvent) {
    e.stopPropagation();
    onDownloadEml();
  }
</script>

<div class="message-card" class:open={isOpen}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="message-card-header" onclick={onToggle}>
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
      <div class="message-subject-row">
        <span class="message-subject">{msg.subject || '(No subject)'}</span>
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
      </div>
    </div>

    <div class="message-header-right">
      <div class="message-time" title={fullTime}>{relativeTime}</div>

      <div class="message-header-actions">
        <button class="icon-btn download-icon" onclick={handleDownload} title="Download message (.EML)">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button class="icon-btn delete-icon" onclick={handleDelete} title="Delete message">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <span class="icon-btn expand-chevron">
          <svg class="ui-icon chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
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
                class="toolbar-toggle-btn"
                onclick={() => (viewMode = viewMode === 'rendered' ? 'raw' : 'rendered')}
                title="Toggle between rendered HTML and raw source"
              >
                {viewMode === 'rendered' ? 'View Raw' : 'View Rendered'}
              </button>
              {#if viewMode === 'rendered'}
                <button
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
            <button class="toolbar-btn" onclick={handleCopyBody} title="Copy message body">
              <svg class="ui-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{bodyCopied ? 'Copied' : 'Copy Body'}</span>
            </button>
          </div>
        </div>

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

<style>
  .message-card {
    border-bottom: 1px solid var(--border);
    transition: background-color var(--transition);
  }

  .message-card:last-child {
    border-bottom: none;
  }

  .message-card-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    cursor: pointer;
    user-select: none;
    transition: background-color var(--transition);
  }

  .message-card-header:hover {
    background: var(--bg-hover);
  }

  .sender-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
    border: 1.5px solid var(--border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    transition: transform var(--transition);
  }

  .message-card-header:hover .sender-avatar {
    transform: scale(1.05);
  }

  .message-header-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .message-header-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .message-from {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sender-domain-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    font-weight: 500;
    white-space: nowrap;
  }

  .message-subject-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .message-subject {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  /* OTP Pill in Header */
  .otp-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 700;
    color: #c7d2fe;
    font-family: var(--font-mono, monospace);
    cursor: pointer;
    transition: all var(--transition);
    flex-shrink: 0;
    line-height: 1.2;
  }

  .otp-pill:hover {
    background: rgba(99, 102, 241, 0.28);
    border-color: var(--accent);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .otp-pill.copied {
    background: rgba(16, 185, 129, 0.2);
    border-color: var(--green);
    color: var(--green-soft, #6ee7b7);
  }

  .message-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .message-time {
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text-tertiary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .message-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all var(--transition);
  }

  .icon-btn .ui-icon {
    width: 16px;
    height: 16px;
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .icon-btn.delete-icon:hover {
    background: rgba(244, 63, 94, 0.15);
    color: var(--red);
  }

  .expand-chevron {
    transition: transform var(--transition);
  }

  .message-card.open .expand-chevron {
    transform: rotate(180deg);
  }

  .message-card-body {
    padding: 0 20px 20px 72px;
    background: rgba(0, 0, 0, 0.18);
    animation: fadeIn 200ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Quick Action Banner */
  .quick-action-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    margin: 10px 0 6px 0;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(168, 85, 247, 0.1));
    border: 1px solid rgba(99, 102, 241, 0.32);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  .action-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .action-icon-badge {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  }

  .action-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .action-title {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .action-desc {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: var(--accent);
    color: #ffffff;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all var(--transition);
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
  }

  .action-cta-btn:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
  }

  /* Body Toolbar */
  .message-body-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    gap: 12px;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .format-badge {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: var(--radius-full);
    background: var(--bg-active);
    color: var(--text-tertiary);
    border: 1px solid var(--border);
    font-weight: 500;
  }

  .format-badge.is-html {
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .toolbar-toggle-btn,
  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: 11.5px;
    padding: 3px 8px;
    cursor: pointer;
    transition: all var(--transition);
  }

  .toolbar-toggle-btn:hover,
  .toolbar-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-focus);
  }

  .theme-switch {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .theme-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f59e0b;
    display: inline-block;
  }

  .theme-dot.is-dark {
    background: #6366f1;
  }

  .ui-icon-sm {
    width: 13px;
    height: 13px;
  }

  .ui-icon-xs {
    width: 12px;
    height: 12px;
  }

  /* Iframe rendering */
  .iframe-canvas-wrap {
    width: 100%;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
    background: #ffffff;
    box-shadow: var(--shadow-sm);
    transition: all var(--transition);
  }

  .iframe-canvas-wrap.dark-canvas {
    background: #0f141c;
    border-color: rgba(99, 102, 241, 0.3);
  }

  .message-iframe {
    width: 100%;
    min-height: 140px;
    border: none;
    display: block;
    background: transparent;
    transition: height 150ms ease-in-out;
  }

  /* Raw Box */
  .message-raw-box {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.6;
    padding: 14px;
    background: var(--bg-root);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    max-height: 500px;
    overflow-y: auto;
  }

  /* Text Content */
  .message-text-content {
    font-size: 13.5px;
    color: var(--text-primary);
    line-height: 1.7;
    padding: 14px 18px;
    background: var(--bg-root);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .message-text-content.empty-msg {
    color: var(--text-tertiary);
    font-style: italic;
  }

  .primary-text-body {
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(.email-inline-link) {
    color: var(--accent);
    text-decoration: underline;
    word-break: break-all;
    transition: opacity var(--transition);
  }

  :global(.email-inline-link:hover) {
    opacity: 0.8;
  }

  /* Quoted thread hierarchy */
  .email-quotes-wrapper {
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px dashed var(--border);
  }

  .quote-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-active);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    padding: 3px 12px;
    font-size: 11.5px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition);
  }

  .quote-toggle-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-focus);
  }

  .quote-dots {
    letter-spacing: 2px;
    font-weight: 700;
    color: var(--accent);
  }

  .email-quotes-box {
    margin-top: 10px;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: var(--radius-sm);
    border-left: 2px solid var(--accent);
    animation: fadeIn 150ms ease-out;
  }

  .quote-attribution {
    font-size: 12px;
    font-style: italic;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }

  .quote-items-tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .quote-item {
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .quote-item.depth-1 {
    padding-left: 4px;
  }

  .quote-item.depth-2 {
    padding-left: 12px;
    border-left: 2px solid rgba(255, 255, 255, 0.12);
  }

  .quote-item.depth-3 {
    padding-left: 20px;
    border-left: 2px solid rgba(99, 102, 241, 0.25);
  }

  .quote-item.depth-4 {
    padding-left: 28px;
    border-left: 2px solid rgba(99, 102, 241, 0.4);
  }

  @media (max-width: 640px) {
    .message-card-body {
      padding: 0 12px 16px 12px;
    }

    .message-header-right {
      gap: 6px;
    }

    .message-time {
      font-size: 11px;
    }
  }
</style>
