/** @type {HTMLSelectElement} */
const inboxSelect = /** @type {*} */ (document.getElementById('inboxSelect'));
const copyBtn = document.getElementById('copyBtn');
const refreshBtn = document.getElementById('refreshBtn');
const newBtn = document.getElementById('newBtn');
const deleteBtn = document.getElementById('deleteBtn');
const newBox = document.getElementById('newBox');
const cancelNewBtn = document.getElementById('cancelNewBtn');
const createCustomBtn = document.getElementById('createCustomBtn');
const quickRandomBtn = document.getElementById('quickRandomBtn');
const lockBtn = document.getElementById('lockBtn');
const authModal = document.getElementById('authModal');
/** @type {HTMLFormElement} */
const authForm = /** @type {*} */ (document.getElementById('authForm'));
/** @type {HTMLInputElement} */
const usernameInput = /** @type {*} */ (document.getElementById('usernameInput'));
/** @type {HTMLInputElement} */
const passcodeInput = /** @type {*} */ (document.getElementById('passcodeInput'));
const authError = document.getElementById('authError');
/** @type {HTMLInputElement} */
const localPartInput = /** @type {*} */ (document.getElementById('localPartInput'));
/** @type {HTMLSelectElement} */
const domainSelect = /** @type {*} */ (document.getElementById('domainSelect'));
const currentInbox = document.getElementById('currentInbox');
const messageCount = document.getElementById('messageCount');
const messageList = document.getElementById('messageList');
const appTitle = document.getElementById('appTitle');
const appSubtitle = document.getElementById('appSubtitle');
const countdownText = document.getElementById('countdownText');

let appConfig = {
  appName: 'GhostBox',
  mailDomain: 'example.com',
  webHost: 'ghostbox.example.com',
  authRequired: false,
  usernameRequired: false,
};

const SESSION_KEY = 'ghostbox_session_id';
let sessionId = localStorage.getItem(SESSION_KEY) || localStorage.getItem('tempik_session_id') || '';

const USERNAME_KEY = 'ghostbox_auth_user';
const PASSCODE_KEY = 'ghostbox_auth_passcode';
let authUsername = localStorage.getItem(USERNAME_KEY) || '';
let authPasscode = localStorage.getItem(PASSCODE_KEY) || '';

let previousMessageCount = 0;
let unreadCount = 0;
let openMessageIds = new Set();

function showAuthModal(errMsg = '') {
  if (!authModal) return;
  authModal.classList.remove('hidden');

  if (usernameInput) {
    usernameInput.value = authUsername || '';
    if (appConfig.usernameRequired === false) {
      usernameInput.style.display = 'none';
      usernameInput.removeAttribute('required');
    } else {
      usernameInput.style.display = '';
      usernameInput.setAttribute('required', 'true');
    }
  }

  if (authError) {
    if (errMsg) {
      authError.textContent = errMsg;
      authError.classList.remove('hidden');
    } else {
      authError.classList.add('hidden');
    }
  }

  if (passcodeInput) {
    passcodeInput.value = '';
    if (!authUsername && usernameInput && appConfig.usernameRequired !== false) {
      usernameInput.focus();
    } else {
      passcodeInput.focus();
    }
  }
}

function hideAuthModal() {
  if (authModal) authModal.classList.add('hidden');
  if (authError) authError.classList.add('hidden');
}

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }
  if (authUsername) {
    headers['x-auth-username'] = authUsername;
  }
  if (authPasscode) {
    headers['x-auth-passcode'] = authPasscode;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && appConfig.authRequired) {
      localStorage.removeItem(USERNAME_KEY);
      localStorage.removeItem(PASSCODE_KEY);
      authUsername = '';
      authPasscode = '';
      showAuthModal('Sesi berakhir atau kredensial salah. Silakan masukkan kembali.');
    }
    let errMsg = '';
    try {
      const errObj = await res.json();
      errMsg = errObj.error || JSON.stringify(errObj);
    } catch {
      errMsg = await res.text();
    }
    throw new Error(errMsg || `HTTP ${res.status}`);
  }
  return res.json();
}

function parseDate(raw) {
  if (!raw) return new Date();
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatRelativeTime(raw) {
  if (!raw) return '';
  const d = parseDate(raw);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 45) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}h lalu`;
  return d.toLocaleDateString();
}

function formatTimestamp(raw) {
  if (!raw) return '';
  const d = parseDate(raw);
  return d.toLocaleString();
}

function isHtmlContent(content) {
  return /<[a-z][\s\S]*>/i.test(content);
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ');
}

function extractOtp(subject = '', body = '') {
  const text = `${subject} ${stripHtml(body)}`.replace(/\s+/g, ' ');

  // Match labeled code/otp e.g. "code: 123456", "kode verifikasi adalah 8921"
  const labeledRegex = /(?:code|otp|verification|pin|kode|verifikasi|token)[\s:=#\-]+([a-z0-9]{4,8})\b/i;
  const matchLabeled = text.match(labeledRegex);
  if (matchLabeled && matchLabeled[1]) {
    return matchLabeled[1];
  }

  // Match standalone 6-digit or 4-digit numeric code surrounded by boundary
  const standaloneRegex = /\b(\d{6}|\d{4})\b/;
  const matchStandalone = text.match(standaloneRegex);
  if (matchStandalone && matchStandalone[1]) {
    return matchStandalone[1];
  }

  return null;
}

function showToast(text) {
  const tc = document.getElementById('toastContainer');
  if (!tc) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  tc.appendChild(el);
  setTimeout(() => {
    el.classList.add('fadeout');
    setTimeout(() => el.remove(), 200);
  }, 2400);
}

async function loadConfig() {
  appConfig = await fetchJson('/api/config', { headers: {} });
  document.title = appConfig.appName;
  if (appTitle) appTitle.textContent = appConfig.appName;
  if (appSubtitle) appSubtitle.textContent = `Disposable inbox for ${appConfig.mailDomain}`;
  if (localPartInput) {
    localPartInput.placeholder = `username atau kosongkan untuk acak @${appConfig.mailDomain}`;
  }

  // Populate domain selector
  const domains = appConfig.mailDomains || [appConfig.mailDomain];
  if (domainSelect) {
    domainSelect.innerHTML = '';
    domains.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `@${d}`;
      domainSelect.appendChild(opt);
    });
    if (domains.length <= 1) domainSelect.style.display = 'none';
  }
}

async function ensureSession() {
  const payload = await fetchJson('/api/session');
  sessionId = payload.sessionId;
  localStorage.setItem(SESSION_KEY, sessionId);
}

async function deleteSingleMessage(address, messageId) {
  try {
    await fetchJson(
      `/api/inboxes/${encodeURIComponent(address)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'DELETE',
      }
    );
    showToast('🗑 Pesan dihapus');
    openMessageIds.delete(messageId);
    await loadMessages();
  } catch (err) {
    console.error(err);
    showToast(`⚠️ Gagal menghapus: ${err.message}`);
  }
}

async function createRandomInbox() {
  const domain = domainSelect ? domainSelect.value : undefined;
  try {
    const inbox = await fetchJson('/api/inboxes', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
    if (localPartInput) localPartInput.value = '';
    if (newBox) newBox.classList.add('hidden');
    await loadInboxes(inbox.address);
    showToast(`✓ Inbox siap: ${inbox.address}`);
  } catch (err) {
    showToast(`⚠️ ${err.message}`);
  }
}

async function loadInboxes(selectedAddress) {
  const inboxes = await fetchJson('/api/inboxes');
  inboxSelect.innerHTML = '';

  if (!inboxes.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Belum ada inbox';
    inboxSelect.appendChild(opt);
    currentInbox.textContent = 'No inbox selected';

    messageList.replaceChildren();
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '📬';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Belum ada inbox aktif';

    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Buat alamat email sekali pakai sekarang untuk mulai menerima email.';

    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-primary';
    createBtn.textContent = '⚡ Buat Alamat Acak Sekarang';
    createBtn.addEventListener('click', () => createRandomInbox());

    emptyState.append(icon, title, sub, createBtn);
    messageList.append(emptyState);

    messageCount.textContent = '0 messages';
    previousMessageCount = 0;
    return;
  }

  inboxes.forEach((inbox) => {
    const opt = document.createElement('option');
    opt.value = inbox.address;
    opt.textContent = inbox.address;
    inboxSelect.appendChild(opt);
  });

  inboxSelect.value =
    selectedAddress && inboxes.some((x) => x.address === selectedAddress)
      ? selectedAddress
      : inboxes[0].address;

  await loadMessages();
}

async function loadMessages(isSilent = false) {
  const address = inboxSelect.value;
  if (!address) return;
  currentInbox.textContent = address;

  let messages = [];
  try {
    messages = await fetchJson(`/api/inboxes/${encodeURIComponent(address)}/messages`);
  } catch (err) {
    if (!isSilent) {
      showToast(`⚠️ Gagal memuat pesan: ${err.message}`);
    }
    return;
  }

  // Background tab notification check
  if (messages.length > previousMessageCount && document.hidden) {
    unreadCount += messages.length - previousMessageCount;
    document.title = `(${unreadCount}) ✉️ Pesan Baru - ${appConfig.appName}`;
  }
  previousMessageCount = messages.length;

  messageCount.textContent = `${messages.length} messages`;
  messageList.replaceChildren();

  if (!messages.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '✉️';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Menunggu email masuk...';

    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = `Kirim email ke ${address}. Email akan muncul secara otomatis dalam hitungan detik.`;

    emptyState.append(icon, title, sub);
    messageList.append(emptyState);
    return;
  }

  // Open first message by default if none are explicitly selected
  if (openMessageIds.size === 0 && messages.length > 0) {
    openMessageIds.add(messages[0].id);
  }

  for (const msg of messages) {
    const card = document.createElement('div');
    card.className = `message-card ${openMessageIds.has(msg.id) ? 'open' : ''}`;

    // Header Row
    const header = document.createElement('div');
    header.className = 'message-card-header';

    // Sender Initial Avatar
    const avatar = document.createElement('div');
    avatar.className = 'sender-avatar';
    const initialChar = (msg.from_address || '?').trim().charAt(0).toUpperCase();
    avatar.textContent = initialChar;

    // Header Information
    const info = document.createElement('div');
    info.className = 'message-header-info';

    const topRow = document.createElement('div');
    topRow.className = 'message-header-top';

    const fromEl = document.createElement('div');
    fromEl.className = 'message-from';
    fromEl.textContent = msg.from_address || 'Unknown sender';

    const timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = formatRelativeTime(msg.received_at);
    timeEl.title = formatTimestamp(msg.received_at);

    topRow.append(fromEl, timeEl);

    const subjectRow = document.createElement('div');
    subjectRow.className = 'message-subject-row';

    const subjEl = document.createElement('div');
    subjEl.className = 'message-subject';
    subjEl.textContent = msg.subject || '(Tanpa subjek)';

    subjectRow.append(subjEl);

    // OTP auto-detection
    const detectedOtp = extractOtp(msg.subject, msg.body);
    if (detectedOtp) {
      const otpPill = document.createElement('button');
      otpPill.className = 'otp-pill';
      otpPill.title = 'Salin kode verifikasi';
      otpPill.textContent = `🔑 ${detectedOtp}`;
      otpPill.addEventListener('click', async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(detectedOtp);
        otpPill.textContent = `✓ ${detectedOtp}`;
        otpPill.classList.add('copied');
        showToast(`📋 Kode disalin: ${detectedOtp}`);
        setTimeout(() => {
          otpPill.textContent = `🔑 ${detectedOtp}`;
          otpPill.classList.remove('copied');
        }, 1800);
      });
      subjectRow.append(otpPill);
    }

    info.append(topRow, subjectRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'message-header-actions';

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn delete-icon';
    delBtn.title = 'Hapus pesan';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSingleMessage(address, msg.id);
    });

    const chevron = document.createElement('span');
    chevron.className = 'icon-btn expand-chevron';
    chevron.textContent = '▼';

    actions.append(delBtn, chevron);

    header.append(avatar, info, actions);

    // Accordion Toggle Behavior
    header.addEventListener('click', () => {
      if (card.classList.contains('open')) {
        card.classList.remove('open');
        openMessageIds.delete(msg.id);
      } else {
        card.classList.add('open');
        openMessageIds.add(msg.id);
      }
    });

    // Body content (Collapsible)
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'message-card-body';

    if (msg.body) {
      if (isHtmlContent(msg.body)) {
        const iframe = document.createElement('iframe');
        iframe.className = 'message-iframe';
        // Isolated sandbox: allow popups but NO allow-scripts and NO allow-same-origin
        iframe.setAttribute('sandbox', 'allow-popups');
        iframe.srcdoc = msg.body;
        bodyContainer.append(iframe);
      } else {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'message-text-content';
        bodyEl.textContent = msg.body;
        bodyContainer.append(bodyEl);
      }
    } else {
      const emptyBody = document.createElement('div');
      emptyBody.className = 'message-text-content';
      emptyBody.textContent = '(Pesan kosong tanpa teks)';
      bodyContainer.append(emptyBody);
    }

    card.append(header, bodyContainer);
    messageList.append(card);
  }
}

// Copy button with feedback animation
copyBtn.addEventListener('click', async () => {
  if (!inboxSelect.value) return;
  await navigator.clipboard.writeText(inboxSelect.value);
  const originalText = copyBtn.querySelector('.copy-label')
    ? copyBtn.querySelector('.copy-label').textContent
    : 'Copy Address';

  copyBtn.classList.add('copied');
  if (copyBtn.querySelector('.copy-label')) {
    copyBtn.querySelector('.copy-label').textContent = 'Copied!';
  }
  showToast('📋 Alamat email disalin ke clipboard');

  setTimeout(() => {
    copyBtn.classList.remove('copied');
    if (copyBtn.querySelector('.copy-label')) {
      copyBtn.querySelector('.copy-label').textContent = originalText;
    }
  }, 1800);
});

refreshBtn.addEventListener('click', () => {
  resetCountdown();
  loadMessages();
});

newBtn.addEventListener('click', () => {
  newBox.classList.toggle('hidden');
  if (!newBox.classList.contains('hidden')) {
    localPartInput.focus();
  }
});

if (cancelNewBtn) {
  cancelNewBtn.addEventListener('click', () => newBox.classList.add('hidden'));
}

inboxSelect.addEventListener('change', () => {
  openMessageIds.clear();
  loadMessages();
});

if (quickRandomBtn) {
  quickRandomBtn.addEventListener('click', () => createRandomInbox());
}

deleteBtn.addEventListener('click', async () => {
  if (!inboxSelect.value) return;
  if (!confirm(`Hapus inbox ${inboxSelect.value}? Seluruh pesan di dalamnya akan terhapus permanen.`)) return;
  const target = inboxSelect.value;
  try {
    await fetchJson(`/api/inboxes/${encodeURIComponent(target)}`, { method: 'DELETE' });
    showToast(`🗑 Inbox ${target} dihapus`);
    await loadInboxes();
  } catch (err) {
    showToast(`⚠️ ${err.message}`);
  }
});

createCustomBtn.addEventListener('click', async () => {
  const localPart = localPartInput.value.trim();
  const domain = domainSelect.value;
  try {
    const inbox = await fetchJson('/api/inboxes', {
      method: 'POST',
      body: JSON.stringify({ localPart, domain }),
    });
    localPartInput.value = '';
    newBox.classList.add('hidden');
    await loadInboxes(inbox.address);
    showToast(`✓ Inbox dibuat: ${inbox.address}`);
  } catch (err) {
    showToast(`⚠️ ${err.message}`);
  }
});

// Credentials Modal Form submission
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const candidateUser = (usernameInput ? usernameInput.value : '').trim();
    const candidatePass = (passcodeInput ? passcodeInput.value : '').trim();
    if (!candidatePass && !candidateUser) return;

    try {
      const res = await fetch('/api/verify-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: candidateUser, passcode: candidatePass }),
      });

      if (!res.ok) {
        if (authError) {
          authError.textContent = 'Username atau password salah, silakan coba lagi.';
          authError.classList.remove('hidden');
        }
        return;
      }

      authUsername = candidateUser;
      authPasscode = candidatePass;
      if (authUsername) localStorage.setItem(USERNAME_KEY, authUsername);
      if (authPasscode) localStorage.setItem(PASSCODE_KEY, authPasscode);
      hideAuthModal();
      showToast('🔓 Akses terbuka');

      // Boot session and inboxes after successful verification
      await ensureSession();
      await loadInboxes();
      startAutoRefresh();
    } catch (err) {
      if (authError) {
        authError.textContent = `Error: ${err.message}`;
        authError.classList.remove('hidden');
      }
    }
  });
}

// Lock Button action
if (lockBtn) {
  lockBtn.addEventListener('click', () => {
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(PASSCODE_KEY);
    authUsername = '';
    authPasscode = '';
    if (inboxSelect) inboxSelect.innerHTML = '';
    if (currentInbox) currentInbox.textContent = 'Akses Terkunci';
    if (messageCount) messageCount.textContent = '0 messages';
    if (messageList) messageList.replaceChildren();
    showAuthModal();
    showToast('🔒 Sesi telah dikunci');
  });
}

// Reset unread badge on window focus/visibility
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    unreadCount = 0;
    document.title = appConfig.appName;
  }
});

// Periodic auto-refresh with live countdown visual
let countdownInterval = null;
let secondsRemaining = 15;
let refreshIntervalSeconds = 15;

function resetCountdown() {
  secondsRemaining = refreshIntervalSeconds;
  if (countdownText) countdownText.textContent = `${secondsRemaining}s`;
}

function startAutoRefresh() {
  const intervalMs = Number(appConfig.autoRefreshIntervalMs) || 15000;
  refreshIntervalSeconds = Math.max(5, Math.floor(intervalMs / 1000));
  resetCountdown();

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    secondsRemaining--;
    if (countdownText) countdownText.textContent = `${secondsRemaining}s`;

    if (secondsRemaining <= 0) {
      resetCountdown();
      if (
        document.visibilityState === 'visible' &&
        inboxSelect.value &&
        (!appConfig.authRequired || authPasscode)
      ) {
        loadMessages(true);
      }
    }
  }, 1000);
}

// App Initialization
async function initApp() {
  try {
    await loadConfig();
    if (appConfig.authRequired) {
      if (lockBtn) lockBtn.classList.remove('hidden');
      if (!authPasscode || (appConfig.usernameRequired && !authUsername)) {
        showAuthModal();
        return;
      }
    }
    await ensureSession();
    await loadInboxes();
    startAutoRefresh();
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('401')) {
      showAuthModal('Silakan masukkan username dan password master.');
      return;
    }
    messageList.replaceChildren();
    const errState = document.createElement('div');
    errState.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '⚠️';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Gagal terhubung ke server';

    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = err.message;

    errState.append(icon, title, sub);
    messageList.append(errState);
  }
}

initApp();
