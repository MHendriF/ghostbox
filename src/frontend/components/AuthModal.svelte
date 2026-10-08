<script lang="ts">
  interface Props {
    open: boolean;
    usernameRequired: boolean;
    initialUsername?: string;
    appName?: string;
    onSubmit: (user: string, pass: string) => Promise<boolean>;
  }

  let { open, usernameRequired, initialUsername = '', appName = 'GhostBox', onSubmit }: Props = $props();

  let username = $state('');
  let passcode = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let errorMessage = $state('');
  let passwordInputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (initialUsername) {
      username = initialUsername;
    }
  });

  function handleTogglePassword(e: MouseEvent) {
    e.preventDefault();
    const input = passwordInputEl;
    const start = input?.selectionStart;
    const end = input?.selectionEnd;
    showPassword = !showPassword;

    if (input) {
      requestAnimationFrame(() => {
        input.focus();
        if (start !== null && end !== null && start !== undefined && end !== undefined) {
          input.setSelectionRange(start, end);
        }
      });
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!passcode && !username) return;
    loading = true;
    errorMessage = '';
    try {
      const ok = await onSubmit(username.trim(), passcode.trim());
      if (!ok) {
        errorMessage = 'Invalid username or passcode. Please try again.';
      } else {
        passcode = '';
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Failed to verify credentials.';
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
      <h2>{appName} Protected</h2>
      <p>Enter credentials to access your disposable inboxes.</p>
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
        <div class="password-wrapper">
          <input
            bind:this={passwordInputEl}
            id="authPasscodeInput"
            type={showPassword ? 'text' : 'password'}
            class:revealed={showPassword}
            bind:value={passcode}
            placeholder="Master Password"
            autocomplete="current-password"
            required
            disabled={loading}
          />
          <button
            type="button"
            class="toggle-password-btn"
            onmousedown={(e) => e.preventDefault()}
            onclick={handleTogglePassword}
            aria-controls="authPasscodeInput"
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            disabled={loading}
            tabindex="-1"
          >
            {#if showPassword}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            {:else}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            {/if}
          </button>
        </div>
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

  /* Disable native Windows / Edge password reveal and clear buttons */
  .modal-card input::-ms-reveal,
  .modal-card input::-ms-clear {
    display: none;
    width: 0;
    height: 0;
  }

  .password-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .password-wrapper input {
    width: 100%;
    padding-left: 44px;
    padding-right: 44px;
  }

  .password-wrapper input.revealed {
    letter-spacing: normal;
  }

  .toggle-password-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: color var(--transition);
    z-index: 2;
  }

  .toggle-password-btn:hover:not(:disabled) {
    color: var(--text-primary);
  }

  .toggle-password-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
