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
        errorMessage = 'Invalid credentials. Please verify your passcode.';
      } else {
        passcode = '';
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Authentication failed.';
    } finally {
      loading = false;
    }
  }
</script>

{#if open}
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-icon">
          <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 class="modal-title">{appName} Access</h2>
        <p class="modal-subtitle">Authentication required to inspect inboxes</p>
      </div>

      <form onsubmit={handleSubmit} class="modal-form">
        {#if usernameRequired}
          <div class="field-group">
            <label for="authUsernameInput" class="field-label">Username</label>
            <input
              id="authUsernameInput"
              type="text"
              bind:value={username}
              placeholder="Username"
              autocomplete="username"
              required
              disabled={loading}
              class="form-input"
            />
          </div>
        {/if}

        <div class="field-group">
          <label for="authPasscodeInput" class="field-label">Master Passcode</label>
          <div class="password-wrapper">
            <input
              bind:this={passwordInputEl}
              id="authPasscodeInput"
              type={showPassword ? 'text' : 'password'}
              bind:value={passcode}
              placeholder="Enter passcode"
              autocomplete="current-password"
              required
              disabled={loading}
              class="form-input"
            />
            <button
              type="button"
              class="toggle-password-btn"
              onmousedown={(e) => e.preventDefault()}
              onclick={handleTogglePassword}
              aria-controls="authPasscodeInput"
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
              disabled={loading}
              tabindex="-1"
            >
              {#if showPassword}
                <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              {:else}
                <svg class="ui-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              {/if}
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary submit-btn" disabled={loading}>
          <span>{loading ? 'Verifying...' : 'Unlock Workspace'}</span>
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
    background: rgba(9, 9, 11, 0.85);
    backdrop-filter: blur(8px);
    z-index: 100000;
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

  .modal-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    max-width: 360px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    animation: scaleIn 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }

  .modal-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .modal-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    margin-bottom: 10px;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .modal-subtitle {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .field-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .form-input {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    transition: border-color var(--transition);
  }

  .form-input:focus {
    outline: none;
    border-color: var(--border-hover);
  }

  .password-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-wrapper input {
    padding-right: 32px;
    font-family: var(--font-mono);
  }

  .toggle-password-btn {
    position: absolute;
    right: 8px;
    color: var(--text-muted);
    padding: 4px;
  }

  .toggle-password-btn:hover {
    color: var(--text-primary);
  }

  .submit-btn {
    width: 100%;
    padding: 9px;
    margin-top: 4px;
  }

  .modal-error {
    margin-top: 12px;
    padding: 8px 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: var(--radius-xs);
    color: var(--red);
    font-size: 12px;
    text-align: center;
  }
</style>
