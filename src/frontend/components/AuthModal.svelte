<script lang="ts">
  interface Props {
    open: boolean;
    usernameRequired: boolean;
    initialUsername?: string;
    onSubmit: (user: string, pass: string) => Promise<boolean>;
  }

  let { open, usernameRequired, initialUsername = '', onSubmit }: Props = $props();

  let username = $state('');
  let passcode = $state('');
  let loading = $state(false);
  let errorMessage = $state('');

  $effect(() => {
    if (initialUsername) {
      username = initialUsername;
    }
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!passcode && !username) return;
    loading = true;
    errorMessage = '';
    try {
      const ok = await onSubmit(username.trim(), passcode.trim());
      if (!ok) {
        errorMessage = 'Username atau password salah, silakan coba lagi.';
      } else {
        passcode = '';
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Gagal memverifikasi kredensial.';
    } finally {
      loading = false;
    }
  }
</script>

{#if open}
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="modal-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2>GhostBox Protected</h2>
      <p>Masukkan master passcode untuk mengakses inbox sekali pakai Anda.</p>
      <form onsubmit={handleSubmit}>
        {#if usernameRequired}
          <input
            type="text"
            bind:value={username}
            placeholder="Username"
            autocomplete="username"
            required
            disabled={loading}
          />
        {/if}
        <input
          type="password"
          bind:value={passcode}
          placeholder="Master Password"
          autocomplete="current-password"
          required
          disabled={loading}
        />
        <button type="submit" class="btn btn-primary" disabled={loading}>
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
          <span>{loading ? 'Verifying...' : 'Unlock Access'}</span>
        </button>
      </form>
      {#if errorMessage}
        <div class="modal-error">{errorMessage}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(9, 9, 11, 0.88);
    backdrop-filter: blur(16px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeInModal 220ms ease-out;
  }

  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-hover);
    border-radius: var(--radius-xl);
    padding: 32px 28px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: var(--shadow-lg);
    animation: scaleInModal 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes scaleInModal {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }

  .modal-icon {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.25);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-soft);
    margin-bottom: 16px;
    box-shadow: 0 6px 24px rgba(99, 102, 241, 0.25);
  }

  .modal-card h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 8px;
    letter-spacing: -0.3px;
  }

  .modal-card p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 22px;
  }

  .modal-card form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-card input {
    padding: 12px 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    text-align: center;
    letter-spacing: 2px;
    transition: border-color var(--transition);
  }

  .modal-card input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .modal-error {
    margin-top: 14px;
    font-size: 13px;
    color: var(--red);
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.25);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
  }
</style>
