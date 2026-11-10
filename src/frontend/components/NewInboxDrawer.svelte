<script lang="ts">
  interface Props {
    open: boolean;
    mailDomains: string[];
    mailDomain: string;
    onCreate: (localPart: string, domain: string) => Promise<void>;
    onCancel: () => void;
  }

  let { open, mailDomains, mailDomain, onCreate, onCancel }: Props = $props();

  let localPart = $state('');
  let selectedDomain = $state('');
  let submitting = $state(false);

  $effect(() => {
    if (!selectedDomain || (mailDomains.length > 0 && !mailDomains.includes(selectedDomain))) {
      selectedDomain = mailDomain || (mailDomains.length > 0 ? mailDomains[0] : '');
    }
  });

  async function handleCreate() {
    submitting = true;
    try {
      let raw = localPart.trim();
      let targetDomain = selectedDomain || mailDomain || (mailDomains.length > 0 ? mailDomains[0] : '');

      if (raw.includes('@')) {
        const parts = raw.split('@');
        raw = parts[0].trim();
        const typedDomain = parts.slice(1).join('@').trim().toLowerCase();
        if (typedDomain && mailDomains.includes(typedDomain)) {
          targetDomain = typedDomain;
          selectedDomain = typedDomain;
        }
      }

      await onCreate(raw, targetDomain);
      localPart = '';
    } finally {
      submitting = false;
    }
  }
</script>

{#if open}
  <div class="drawer-box">
    <div class="drawer-header">
      <div class="drawer-title-wrap">
        <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Create Custom Inbox</span>
      </div>
      <button type="button" class="close-icon-btn" onclick={onCancel} title="Close drawer">✕</button>
    </div>

    <div class="drawer-inner">
      <div class="input-wrap">
        <input
          type="text"
          bind:value={localPart}
          placeholder="username (leave empty for random)"
          autocomplete="off"
          disabled={submitting}
          onkeydown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <span class="at-separator">@</span>
        {#if mailDomains.length > 1}
          <select bind:value={selectedDomain} disabled={submitting} aria-label="Select domain">
            {#each mailDomains as d (d)}
              <option value={d}>{d}</option>
            {/each}
          </select>
        {:else}
          <span class="single-domain">{selectedDomain || mailDomain || 'domain'}</span>
        {/if}
      </div>

      <div class="drawer-actions">
        <button type="button" class="btn btn-primary" onclick={handleCreate} disabled={submitting}>
          <span>{submitting ? 'Creating...' : 'Create Inbox'}</span>
        </button>
        <button type="button" class="btn btn-secondary" onclick={onCancel} disabled={submitting}>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-box {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 12px 16px;
    margin-bottom: 14px;
    animation: slideIn 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .drawer-title-wrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .close-icon-btn {
    font-size: 11px;
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: var(--radius-xs);
  }

  .close-icon-btn:hover {
    color: var(--text-primary);
  }

  .drawer-inner {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .input-wrap {
    display: inline-flex;
    align-items: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    flex: 1;
    min-width: 240px;
    padding: 2px 8px;
  }

  .input-wrap input {
    flex: 1;
    min-width: 140px;
    padding: 6px 4px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 12.5px;
  }

  .input-wrap input:focus {
    outline: none;
  }

  .at-separator {
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 0 4px;
  }

  .single-domain {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text-secondary);
    padding-right: 6px;
  }

  .input-wrap select {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: 12.5px;
    padding: 6px 12px 6px 4px;
    cursor: pointer;
  }

  .drawer-actions {
    display: inline-flex;
    gap: 6px;
  }

  @media (max-width: 640px) {
    .drawer-inner {
      flex-direction: column;
      align-items: stretch;
    }

    .drawer-actions {
      display: flex;
    }

    .drawer-actions .btn {
      flex: 1;
    }
  }
</style>
