<script lang="ts">
  import type { Message } from '../types';
  import { extractOtp, formatRelativeTime, formatTimestamp, isHtmlContent } from '../utils';

  interface Props {
    msg: Message;
    isOpen: boolean;
    onToggle: () => void;
    onDelete: () => void;
    onDownloadEml: () => void;
    onShowToast: (text: string) => void;
  }

  let { msg, isOpen, onToggle, onDelete, onDownloadEml, onShowToast }: Props = $props();

  let otpCopied = $state(false);

  let otp = $derived(extractOtp(msg.subject, msg.body));
  let initial = $derived((msg.from_address || '?').trim().charAt(0).toUpperCase());
  let relativeTime = $derived(formatRelativeTime(msg.received_at));
  let fullTime = $derived(formatTimestamp(msg.received_at));
  let hasHtml = $derived(isHtmlContent(msg.body || ''));

  async function handleCopyOtp(e: MouseEvent) {
    e.stopPropagation();
    if (!otp) return;
    try {
      await navigator.clipboard.writeText(otp);
      otpCopied = true;
      onShowToast(`Kode disalin: ${otp}`);
      setTimeout(() => {
        otpCopied = false;
      }, 1800);
    } catch {
      onShowToast('Gagal menyalin kode OTP');
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
    <div class="sender-avatar">{initial}</div>

    <div class="message-header-info">
      <div class="message-header-top">
        <div class="message-from">{msg.from_address || 'Unknown sender'}</div>
        <div class="message-time" title={fullTime}>{relativeTime}</div>
      </div>
      <div class="message-subject-row">
        <div class="message-subject">{msg.subject || '(Tanpa subjek)'}</div>
        {#if otp}
          <button class="otp-pill" class:copied={otpCopied} onclick={handleCopyOtp} title="Salin kode verifikasi">
            {#if otpCopied}
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            {:else}
              <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="8" cy="15" r="4" />
                <line x1="10.85" y1="12.15" x2="19" y2="4" />
                <line x1="18" y1="5" x2="20" y2="7" />
                <line x1="15" y1="8" x2="17" y2="10" />
              </svg>
            {/if}
            <span>{otp}</span>
          </button>
        {/if}
      </div>
    </div>

    <div class="message-header-actions">
      <button class="icon-btn download-icon" onclick={handleDownload} title="Unduh file pesan (.EML)">
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <button class="icon-btn delete-icon" onclick={handleDelete} title="Hapus pesan">
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

  {#if isOpen}
    <div class="message-card-body">
      {#if msg.body}
        {#if hasHtml}
          <iframe class="message-iframe" sandbox="allow-popups" srcdoc={msg.body} title="Email content preview"></iframe>
        {:else}
          <div class="message-text-content">{msg.body}</div>
        {/if}
      {:else}
        <div class="message-text-content">(Pesan kosong tanpa teks)</div>
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
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
  }

  .message-card-header:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .sender-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(6, 182, 212, 0.2));
    border: 1px solid rgba(99, 102, 241, 0.35);
    color: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  .message-header-info {
    flex: 1;
    min-width: 0;
  }

  .message-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }

  .message-from {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-time {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .message-subject-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .message-subject {
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .otp-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.35);
    border-radius: 999px;
    color: #a5b4fc;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition);
    flex-shrink: 0;
  }

  .otp-pill:hover {
    background: rgba(99, 102, 241, 0.3);
    border-color: var(--accent-soft);
    transform: scale(1.02);
  }

  .otp-pill.copied {
    background: rgba(16, 185, 129, 0.2);
    border-color: var(--green);
    color: var(--green-soft);
  }

  .message-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition);
    font-size: 13px;
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
    padding: 0 20px 20px 70px;
    background: rgba(0, 0, 0, 0.2);
    animation: fadeIn 200ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .message-iframe {
    width: 100%;
    min-height: 300px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: #ffffff;
    margin-top: 8px;
    box-shadow: var(--shadow-sm);
  }

  .message-text-content {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: pre-wrap;
    line-height: 1.7;
    padding: 12px 16px;
    background: var(--bg-root);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    margin-top: 8px;
  }
</style>
