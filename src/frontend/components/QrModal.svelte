<script lang="ts">
  interface Props {
    open: boolean;
    address: string;
    onClose: () => void;
    onShowToast: (msg: string) => void;
  }

  let { open, address, onClose, onShowToast }: Props = $props();

  let copied = $state(false);

  let qrUrl = $derived(
    address
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=svg&data=${encodeURIComponent(address)}`
      : ''
  );

  async function handleCopy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      copied = true;
      onShowToast('Email address copied to clipboard');
      setTimeout(() => {
        copied = false;
      }, 1800);
    } catch {
      onShowToast('Failed to copy address');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={onClose}>
    <div class="modal-card" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-title-group">
          <h3>Inbox QR Code</h3>
          <p>Scan to send an email or transfer this inbox to your mobile device.</p>
        </div>
        <button class="close-btn" onclick={onClose} title="Close QR modal">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div class="qr-preview-box">
        {#if qrUrl}
          <img
            src={qrUrl}
            alt={`QR code for ${address}`}
            width="220"
            height="220"
            loading="lazy"
            class="qr-image"
          />
        {:else}
          <div class="qr-placeholder">No address selected</div>
        {/if}
      </div>

      <div class="address-chip">
        <span class="chip-text">{address}</span>
      </div>

      <div class="modal-actions">
        <button class="btn btn-primary" onclick={handleCopy}>
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            {#if copied}
              <polyline points="20 6 9 17 4 12" />
            {:else}
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            {/if}
          </svg>
          <span>{copied ? 'Copied to Clipboard' : 'Copy Address'}</span>
        </button>
        <button class="btn btn-secondary" onclick={onClose}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(9, 9, 11, 0.85);
    backdrop-filter: blur(14px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeInModal 180ms ease-out;
  }

  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-hover);
    border-radius: var(--radius-xl);
    padding: 28px 24px;
    max-width: 380px;
    width: 100%;
    text-align: center;
    box-shadow: var(--shadow-lg);
    animation: scaleInModal 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes scaleInModal {
    from { opacity: 0; transform: scale(0.94); }
    to { opacity: 1; transform: scale(1); }
  }

  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
    text-align: left;
  }

  .modal-title-group h3 {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
    letter-spacing: -0.3px;
  }

  .modal-title-group p {
    font-size: 12.5px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition);
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .qr-preview-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    padding: 16px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    margin: 0 auto 18px;
    width: 240px;
    height: 240px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  }

  .qr-image {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  .qr-placeholder {
    color: #64748b;
    font-size: 13px;
  }

  .address-chip {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    padding: 8px 14px;
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    overflow: hidden;
  }

  .chip-text {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--accent-soft);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .modal-actions .btn {
    flex: 1;
  }
</style>
