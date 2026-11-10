<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ApiClient } from './api';
  import type { AppConfig, Inbox, Message, ToastItem } from './types';
  import { downloadEml, playNotificationChime } from './utils';

  import Header from './components/Header.svelte';
  import InboxSidebar from './components/InboxSidebar.svelte';
  import HeroCard from './components/HeroCard.svelte';
  import NewInboxDrawer from './components/NewInboxDrawer.svelte';
  import MessagesPanel from './components/MessagesPanel.svelte';
  import AuthModal from './components/AuthModal.svelte';
  import Toast from './components/Toast.svelte';

  // Core State (Svelte 5 Runes)
  let config = $state<AppConfig>({
    appName: 'GhostBox',
    mailDomain: '',
    webHost: '',
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
  let totalInboxesCount = $state<number | null>(null);
  let emptyInboxesCount = $state<number | null>(null);

  let knownMessageIds = $state<Set<string>>(new Set());
  let isInitialLoad = $state<boolean>(true);
  let tickerTimer: number | null = null;

  const api = new ApiClient({
    onUnauthorized: () => {
      authModalOpen = true;
      showToast('Session expired or invalid credentials. Please log in again.');
    },
  });

  async function loadInboxStats() {
    try {
      const stats = await api.getInboxStats();
      totalInboxesCount = stats.totalInboxes;
      emptyInboxesCount = stats.emptyInboxes;
    } catch (err) {
      console.warn('Failed to load inbox stats:', err);
    }
  }

  function showToast(text: string) {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    toasts = [...toasts, { id, text }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 2400);
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
      loadInboxStats();
      const list = await api.getInboxes();
      inboxes = list;
      if (preferredAddress && list.some((i) => i.address === preferredAddress)) {
        activeAddress = preferredAddress;
      } else if (list.length > 0) {
        if (!activeAddress || !list.some((i) => i.address === activeAddress)) {
          activeAddress = list[0].address;
        }
      } else {
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
      loadInboxStats();
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
      loadInboxStats();
      showToast(`Inbox created: ${inbox.address}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to create custom inbox');
    }
  }

  async function handleDeleteInbox() {
    if (!activeAddress) return;
    const target = activeAddress;
    try {
      await api.deleteInbox(target);
      showToast(`Inbox ${target} deleted`);
      const targetLower = target.toLowerCase();
      inboxes = inboxes.filter((i) => i.address.toLowerCase() !== targetLower);
      messages = [];
      knownMessageIds = new Set();
      loadInboxStats();
      if (inboxes.length > 0) {
        activeAddress = inboxes[0].address;
        isInitialLoad = true;
        await loadMessages(activeAddress);
      } else {
        await handleQuickRandom(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete inbox');
    }
  }

  async function handleCleanEmptyInboxes() {
    try {
      const res = await api.cleanEmptyInboxes();
      if (res.deletedInboxes === 0) {
        showToast('No empty inboxes to clean');
      } else {
        showToast(`Cleaned ${res.deletedInboxes} empty inboxes`);
        await loadInboxes();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to clean empty inboxes');
    }
  }

  async function handleBatchDeleteInboxes(addresses: string[]) {
    if (!addresses || addresses.length === 0) return;
    try {
      const res = await api.deleteInboxesBatch(addresses);
      showToast(`Deleted ${res.count} inboxes`);

      const deletedSet = new Set(addresses.map((a) => a.toLowerCase()));
      inboxes = inboxes.filter((i) => !deletedSet.has(i.address.toLowerCase()));
      loadInboxStats();

      // If activeAddress was among deleted, switch to first remaining or generate new
      if (activeAddress && deletedSet.has(activeAddress.toLowerCase())) {
        if (inboxes.length > 0) {
          activeAddress = inboxes[0].address;
          isInitialLoad = true;
          knownMessageIds = new Set();
          await loadMessages(activeAddress);
        } else {
          await handleQuickRandom(false);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete selected inboxes');
    }
  }

  async function handleDeleteSingleMessage(messageId: string) {
    if (!activeAddress) return;
    try {
      await api.deleteMessage(activeAddress, messageId);
      messages = messages.filter((m) => m.id !== messageId);
      knownMessageIds.delete(messageId);

      // Decrement message_count on active inbox in local inboxes array
      const targetAddr = activeAddress.toLowerCase();
      inboxes = inboxes.map((inb) => {
        if (inb.address.toLowerCase() === targetAddr) {
          const currentCount = inb.message_count ?? 1;
          return {
            ...inb,
            message_count: Math.max(0, currentCount - 1),
          };
        }
        return inb;
      });
      loadInboxStats();

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
          showToast('Email address copied');
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

<div class="app-layout">
  <Header
    appName={config.appName}
    mailDomain={config.mailDomain}
    {countdown}
    authRequired={!!config.authRequired}
    forwardEmail={config.forwardEmail}
    onLock={handleLockSession}
  />

  <main class="workspace-grid">
    <div class="sidebar-column">
      <InboxSidebar
        {inboxes}
        {activeAddress}
        {totalInboxesCount}
        {emptyInboxesCount}
        onSelectInbox={handleSelectInbox}
        onQuickRandom={() => handleQuickRandom(true)}
        onToggleDrawer={() => (showNewDrawer = !showNewDrawer)}
        onCleanEmptyInboxes={handleCleanEmptyInboxes}
        onBatchDeleteInboxes={handleBatchDeleteInboxes}
      />
    </div>

    <div class="workspace-main">
      <HeroCard
        {inboxes}
        {activeAddress}
        isRefreshing={isFetchingMessages}
        onSelectInbox={handleSelectInbox}
        onQuickRandom={() => handleQuickRandom(true)}
        onToggleDrawer={() => (showNewDrawer = !showNewDrawer)}
        onRefresh={() => {
          resetCountdown();
          loadMessages();
        }}
        onDeleteInbox={handleDeleteInbox}
        onShowToast={showToast}
      />

      <NewInboxDrawer
        open={showNewDrawer}
        mailDomains={config.mailDomains || (config.mailDomain ? [config.mailDomain] : [])}
        mailDomain={config.mailDomain}
        onCreate={handleCreateCustom}
        onCancel={() => (showNewDrawer = false)}
      />

      <MessagesPanel
        {messages}
        activeInboxAddress={activeAddress}
        countdownSeconds={countdown}
        forwardEmail={config.forwardEmail}
        onDeleteMessage={handleDeleteSingleMessage}
        onDownloadEml={handleDownloadEml}
        onShowToast={showToast}
      />
    </div>
  </main>

  <footer class="app-footer">
    <div class="keyboard-hints" aria-label="Keyboard Shortcuts">
      <span class="hint-item"><kbd>/</kbd> search</span>
      <span class="hint-item"><kbd>r</kbd> refresh</span>
      <span class="hint-item"><kbd>n</kbd> new inbox</span>
      <span class="hint-item"><kbd>c</kbd> copy address</span>
      <span class="hint-item"><kbd>esc</kbd> close</span>
    </div>

    <div class="footer-meta">
      <a href="https://github.com/MHendriF" target="_blank" rel="noopener">
        Developed by <span>MHendriF</span>
      </a>
    </div>
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
  .app-layout {
    max-width: 1240px;
    margin: 0 auto;
    padding: 16px 16px 40px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .workspace-grid {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    flex: 1;
  }

  .sidebar-column {
    position: sticky;
    top: 16px;
  }

  .workspace-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .app-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 8px 12px;
    margin-top: auto;
    gap: 12px;
    flex-wrap: wrap;
  }

  .keyboard-hints {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: var(--text-muted);
    user-select: none;
    flex-wrap: wrap;
  }

  .hint-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .hint-item kbd {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    padding: 1px 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-secondary);
  }

  .footer-meta {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .footer-meta a {
    color: var(--text-muted);
    text-decoration: none;
    transition: color var(--transition);
  }

  .footer-meta a span {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .footer-meta a:hover {
    color: var(--text-primary);
  }

  @media (max-width: 860px) {
    .workspace-grid {
      grid-template-columns: 1fr;
    }

    .sidebar-column {
      position: static;
    }

    .app-footer {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }

  @media (max-width: 640px) {
    .app-layout {
      padding: 10px 10px 30px;
    }

    .keyboard-hints {
      display: none;
    }
  }
</style>
