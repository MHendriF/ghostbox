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
    if (!selectedDomain && mailDomain) {
      selectedDomain = mailDomain;
    }
  });

  async function handleCreate() {
    submitting = true;
    try {
      await onCreate(localPart.trim(), selectedDomain);
      localPart = '';
    } finally {
      submitting = false;
    }
  }
</script>

{#if open}
  <section class="new-box">
    <div class="new-box-inner">
      <input
        type="text"
        bind:value={localPart}
        placeholder={`username or leave empty for random @${selectedDomain || mailDomain}`}
        autocomplete="off"
        disabled={submitting}
        onkeydown={(e) => e.key === 'Enter' && handleCreate()}
      />
      {#if mailDomains.length > 1}
        <select bind:value={selectedDomain} disabled={submitting} aria-label="Select domain">
          {#each mailDomains as d (d)}
            <option value={d}>@{d}</option>
          {/each}
        </select>
      {/if}
      <button class="btn btn-primary" onclick={handleCreate} disabled={submitting}>
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{submitting ? 'Creating...' : 'Create'}</span>
      </button>
      <button class="btn btn-secondary" onclick={onCancel} disabled={submitting}>
        <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>Cancel</span>
      </button>
    </div>
  </section>
{/if}

<style>
  .new-box {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    margin-bottom: 24px;
    animation: slideDown 220ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .new-box-inner {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  input {
    flex: 1;
    min-width: 220px;
    padding: 10px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    transition: border-color var(--transition);
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  select {
    padding: 10px 30px 10px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 10px center;
    background-repeat: no-repeat;
    background-size: 16px;
  }
</style>
