<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ApiClient } from './api';
  import type { AppConfig, Inbox, Message, ToastItem } from './types';
  import { downloadEml, playNotificationChime } from './utils';

  import Header from './components/Header.svelte';
  import HeroCard from './components/HeroCard.svelte';
  import NewInboxDrawer from './components/NewInboxDrawer.svelte';
  import MessagesPanel from './components/MessagesPanel.svelte';
  import AuthModal from './components/AuthModal.svelte';
  import Toast from './components/Toast.svelte';

  // Core State (Svelte 5 Runes)
  let config = $state<AppConfig>({
    appName: 'GhostBox',
    mailDomain: 'rinjaniglobal.com',
    webHost: 'ghostbox.rinjaniglobal.com',
    authRequired: false,
    usernameRequired: false,
    autoRefreshMs: 15000,
  });

  let inboxes = $state<Inbox[]>([]);
  let activeAddress = $state<string>('');
  let messages = $state<Message[]>([]);
  let toasts = $state<ToastItem[]>([]);
  let showNewDrawer = $state<boolean>(false);
  let authModalOpen = $state<boolean>(false);
  let countdown = $state<number>(15);
  let isFetchingMessages = $state<boolean>(false);

  let knownMessageIds = $state<Set<string>>(new Set());
  let isInitialLoad = $state<boolean>(true);
  let tickerTimer: number | null = null;

  const api = new ApiClient({
    onUnauthorized: () => {
      authModalOpen = true;
      showToast('Session expired or invalid credentials. Please log in again.');
    },
  });

  function showToast(text: string) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    toasts = [...toasts, { id, text }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2600);
  }

  function resetCountdown() {
    const intervalSec = Math.floor((config.autoRefreshMs || 15000) / 1000);
    countdown = intervalSec > 0 ? intervalSec : 15;
  }

  async function loadMessages(address = activeAddress) {
    if (!address || isFetchingMessages) return;
    isFetchingMessages = true;
    try {
      const incoming = await api.getMessages(address);
      if (!isInitialLoad) {
        const newArrivals = incoming.filter((m) => !knownMessageIds.has(m.id));
        if (newArrivals.length > 0) {
          playNotificationChime();
          const firstSubj = newArrivals[0].subject || 'No subject';
          showToast(`New email: ${firstSubj}`);
        }
      }
      messages = incoming;
      knownMessageIds = new Set(incoming.map((m) => m.id));
      isInitialLoad = false;
    } catch (err: any) {
      console.warn('Failed to load messages:', err);
    } finally {
      isFetchingMessages = false;
    }
  }

  async function loadInboxes(preferredAddress?: string) {
    try {
      const list = await api.getInboxes();
      inboxes = list;
      if (preferredAddress && list.some((i) => i.address === preferredAddress)) {
        activeAddress = preferredAddress;
      } else if (list.length > 0) {
        if (!activeAddress || !list.some((i) => i.address === activeAddress)) {
          activeAddress = list[0].address;
        }
      } else {
        // No inbox exists -> create quick random
        await handleQuickRandom(false);
      }
      if (activeAddress) {
        await loadMessages(activeAddress);
      }
    } catch (err: any) {
      console.warn('Failed to load inboxes:', err);
    }
  }

  async function handleQuickRandom(notify = true) {
    try {
      const inbox = await api.createInbox();
      inboxes = [inbox, ...inboxes.filter((i) => i.address !== inbox.address)];
      activeAddress = inbox.address;
      messages = [];
      knownMessageIds = new Set();
      isInitialLoad = true;
      resetCountdown();
      if (notify) showToast(`Inbox ready: ${inbox.address}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create random inbox');
    }
  }

  async function handleCreateCustom(localPart: string, domain: string) {
    try {
      const inbox = await api.createInbox(localPart, domain);
      inboxes = [inbox, ...inboxes.filter((i) => i.address !== inbox.address)];
      activeAddress = inbox.address;
      messages = [];
      knownMessageIds = new Set();
      isInitialLoad = true;
      showNewDrawer = false;
      resetCountdown();
      showToast(`Inbox created: ${inbox.address}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create custom inbox');
    }
  }

  async function handleDeleteInbox() {
    if (!activeAddress) return;
    const target = activeAddress;
    if (!confirm(`Delete inbox ${target}? All messages in this inbox will be permanently deleted.`)) {
      return;
    }
    try {
      await api.deleteInbox(target);
      showToast(`Inbox ${target} deleted`);
      inboxes = inboxes.filter((i) => i.address !== target);
      if (inboxes.length > 0) {
        activeAddress = inboxes[0].address;
        isInitialLoad = true;
        knownMessageIds = new Set();
        await loadMessages(activeAddress);
      } else {
        await handleQuickRandom(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete inbox');
    }
  }

  async function handleDeleteSingleMessage(messageId: string) {
    if (!activeAddress) return;
    try {
      await api.deleteMessage(activeAddress, messageId);
      messages = messages.filter((m) => m.id !== messageId);
      knownMessageIds.delete(messageId);
      showToast('Message deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete message');
    }
  }

  function handleDownloadEml(msg: Message) {
    try {
      downloadEml(msg, activeAddress);
      showToast('.eml file downloaded');
    } catch {
      showToast('Failed to download .eml file');
    }
  }

  function handleLockSession() {
    api.clearAuth();
    inboxes = [];
    activeAddress = '';
    messages = [];
    knownMessageIds = new Set();
    isInitialLoad = true;
    authModalOpen = true;
    showToast('Session locked');
  }

  async function handleVerifyAuth(user: string, pass: string): Promise<boolean> {
    const ok = await api.verifyPasscode(user, pass);
    if (ok) {
      api.setAuth(user, pass);
      authModalOpen = false;
      showToast('Access granted');
      await api.ensureSession();
      await loadInboxes();
      startTicker();
    }
    return ok;
  }

  function handleSelectInbox(address: string) {
    activeAddress = address;
    isInitialLoad = true;
    knownMessageIds = new Set();
    resetCountdown();
    loadMessages(address);
  }

  function startTicker() {
    if (tickerTimer) clearInterval(tickerTimer);
    resetCountdown();
    tickerTimer = window.setInterval(() => {
      if (countdown > 1) {
        countdown -= 1;
      } else {
        resetCountdown();
        loadMessages();
      }
    }, 1000);
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const isEditing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    if (e.key === 'Escape') {
      if (showNewDrawer) {
        showNewDrawer = false;
        return;
      }
      return;
    }

    if (isEditing || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    if (e.key === '/') {
      const searchInput = document.querySelector<HTMLInputElement>('.search-wrap input');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetCountdown();
      loadMessages();
      showToast('Refreshing inbox...');
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      showNewDrawer = !showNewDrawer;
    } else if (e.key === 'c' || e.key === 'C') {
      if (activeAddress) {
        e.preventDefault();
        navigator.clipboard.writeText(activeAddress).then(() => {
          showToast('Email address copied to clipboard');
        }).catch(() => {
          showToast('Failed to copy email address');
        });
      }
    }
  }

  onMount(async () => {
    window.addEventListener('keydown', handleGlobalKeydown);
    try {
      const cfg = await api.getConfig();
      config = cfg;
      document.title = cfg.appName;

      if (cfg.authRequired && (!api.authPasscode || (cfg.usernameRequired && !api.authUsername))) {
        authModalOpen = true;
        return;
      }

      await api.ensureSession();
      await loadInboxes();
      startTicker();
    } catch (err) {
      console.error('Initialization error:', err);
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    if (tickerTimer) clearInterval(tickerTimer);
  });
</script>

<div class="app">
  <Header appName={config.appName} appSubtitle={`Disposable inbox for ${config.mailDomain}`} />

  <HeroCard
    {inboxes}
    {activeAddress}
    authRequired={!!config.authRequired}
    onSelectInbox={handleSelectInbox}
    onQuickRandom={() => handleQuickRandom(true)}
    onToggleDrawer={() => (showNewDrawer = !showNewDrawer)}
    onRefresh={() => {
      resetCountdown();
      loadMessages();
    }}
    onDeleteInbox={handleDeleteInbox}
    onLock={handleLockSession}
    onShowToast={showToast}
  />

  <NewInboxDrawer
    open={showNewDrawer}
    mailDomains={config.mailDomains || [config.mailDomain]}
    mailDomain={config.mailDomain}
    onCreate={handleCreateCustom}
    onCancel={() => (showNewDrawer = false)}
  />

  <MessagesPanel
    {messages}
    activeInboxAddress={activeAddress}
    countdownSeconds={countdown}
    onDeleteMessage={handleDeleteSingleMessage}
    onDownloadEml={handleDownloadEml}
    onShowToast={showToast}
  />

  <div class="keyboard-hints" aria-label="Keyboard Shortcuts">
    <span class="hint-item"><kbd>/</kbd> search</span>
    <span class="hint-item"><kbd>r</kbd> refresh</span>
    <span class="hint-item"><kbd>n</kbd> new inbox</span>
    <span class="hint-item"><kbd>c</kbd> copy address</span>
    <span class="hint-item"><kbd>esc</kbd> close</span>
  </div>

  <footer>
    <a href="https://github.com/MHendriF" target="_blank" rel="noopener">
      Developed by <span>MHendriF</span>
    </a>
  </footer>
</div>

<AuthModal
  open={authModalOpen}
  appName={config.appName}
  usernameRequired={!!config.usernameRequired}
  initialUsername={api.authUsername}
  onSubmit={handleVerifyAuth}
/>

<Toast {toasts} />

<style>
  .app {
    max-width: 1024px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  .keyboard-hints {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 24px;
    padding: 8px 16px;
    font-size: 11.5px;
    color: var(--text-tertiary);
    flex-wrap: wrap;
    user-select: none;
  }

  .hint-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .hint-item kbd {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent-soft);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  }

  footer {
    text-align: center;
    padding: 24px 0 20px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
  }

  footer a {
    color: var(--text-muted);
    text-decoration: none;
    transition: color var(--transition);
  }

  footer a span {
    color: var(--accent-soft);
    font-weight: 600;
  }

  footer a:hover {
    color: var(--text-secondary);
  }

  @media (max-width: 640px) {
    .keyboard-hints {
      display: none;
    }
  }
</style>
