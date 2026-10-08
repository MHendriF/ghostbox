/** @type {HTMLSelectElement} */
const inboxSelect = /** @type {*} */ (document.getElementById('inboxSelect'));
const copyBtn = document.getElementById('copyBtn');
const refreshBtn = document.getElementById('refreshBtn');
const newBtn = document.getElementById('newBtn');
const deleteBtn = document.getElementById('deleteBtn');
const newBox = document.getElementById('newBox');
const createCustomBtn = document.getElementById('createCustomBtn');
const createRandomBtn = document.getElementById('createRandomBtn');
/** @type {HTMLInputElement} */
const localPartInput = /** @type {*} */ (document.getElementById('localPartInput'));
/** @type {HTMLSelectElement} */
const domainSelect = /** @type {*} */ (document.getElementById('domainSelect'));
const currentInbox = document.getElementById('currentInbox');
const messageCount = document.getElementById('messageCount');
const messageList = document.getElementById('messageList');
const appTitle = document.getElementById('appTitle');
const appSubtitle = document.getElementById('appSubtitle');

let appConfig = {
  appName: 'GhostBox',
  mailDomain: 'example.com',
  webHost: 'ghostbox.example.com',
};

const SESSION_KEY = 'ghostbox_session_id';
let sessionId = localStorage.getItem(SESSION_KEY) || localStorage.getItem('tempik_session_id') || '';

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (sessionId) {
    headers['x-session-id'] = sessionId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
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

function formatTimestamp(raw) {
  if (!raw) return '';
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? raw : d.toLocaleString();
}

function isHtmlContent(content) {
  return /<[a-z][\s\S]*>/i.test(content);
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
  }, 2200);
}

async function loadConfig() {
  appConfig = await fetchJson('/api/config', { headers: {} });
  document.title = appConfig.appName;
  appTitle.textContent = appConfig.appName;
  appSubtitle.textContent = `Disposable inbox for ${appConfig.mailDomain}`;
  localPartInput.placeholder = `username atau kosongkan untuk random @${appConfig.mailDomain}`;

  // Populate domain selector
  const domains = appConfig.mailDomains || [appConfig.mailDomain];
  domainSelect.innerHTML = '';
  domains.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `@${d}`;
    domainSelect.appendChild(opt);
  });
  if (domains.length <= 1) domainSelect.style.display = 'none';
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
    showToast('🗑 Message deleted');
    await loadMessages();
  } catch (err) {
    console.error(err);
    showToast(`⚠️ Failed to delete: ${err.message}`);
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
    title.textContent = 'No inboxes yet';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Click New to create a disposable email address.';
    emptyState.append(icon, title, sub);
    messageList.append(emptyState);

    messageCount.textContent = '0 messages';
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
      showToast(`⚠️ Error loading messages: ${err.message}`);
    }
    return;
  }

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
    title.textContent = 'Inbox empty';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = 'Emails sent to this address will appear here.';
    emptyState.append(icon, title, sub);
    messageList.append(emptyState);
    return;
  }

  for (const msg of messages) {
    const item = document.createElement('div');
    item.className = 'message-item';

    const headerRow = document.createElement('div');
    headerRow.className = 'message-header-row';

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = `From: ${msg.from_address} • ${formatTimestamp(msg.received_at)}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-msg-btn';
    delBtn.title = 'Delete message';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSingleMessage(address, msg.id);
    });

    headerRow.append(meta, delBtn);

    const subj = document.createElement('strong');
    subj.textContent = msg.subject || '(no subject)';

    item.append(headerRow, subj);

    if (msg.body) {
      if (isHtmlContent(msg.body)) {
        const iframe = document.createElement('iframe');
        iframe.className = 'message-iframe';
        // Isolated sandbox: allow popups but NO allow-scripts and NO allow-same-origin
        iframe.setAttribute('sandbox', 'allow-popups');
        iframe.srcdoc = msg.body;
        item.append(iframe);
      } else {
        const bodyEl = document.createElement('p');
        bodyEl.className = 'message-body';
        bodyEl.textContent = msg.body;
        item.append(bodyEl);
      }
    }

    messageList.append(item);
  }
}

copyBtn.addEventListener('click', async () => {
  if (!inboxSelect.value) return;
  await navigator.clipboard.writeText(inboxSelect.value);
  showToast('📋 Copied to clipboard');
});

refreshBtn.addEventListener('click', () => loadMessages());
newBtn.addEventListener('click', () => newBox.classList.toggle('hidden'));
inboxSelect.addEventListener('change', () => loadMessages());

deleteBtn.addEventListener('click', async () => {
  if (!inboxSelect.value) return;
  if (!confirm(`Delete inbox ${inboxSelect.value}?`)) return;
  const target = inboxSelect.value;
  try {
    await fetchJson(`/api/inboxes/${encodeURIComponent(target)}`, { method: 'DELETE' });
    showToast(`🗑 Deleted inbox ${target}`);
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
    showToast(`✓ Inbox created: ${inbox.address}`);
  } catch (err) {
    showToast(`⚠️ ${err.message}`);
  }
});

createRandomBtn.addEventListener('click', async () => {
  const domain = domainSelect.value;
  try {
    const inbox = await fetchJson('/api/inboxes', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
    localPartInput.value = '';
    newBox.classList.add('hidden');
    await loadInboxes(inbox.address);
    showToast(`✓ Inbox created: ${inbox.address}`);
  } catch (err) {
    showToast(`⚠️ ${err.message}`);
  }
});

// Periodic auto-refresh when page is active (interval from server config)
let refreshTimer = null;
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = Number(appConfig.autoRefreshIntervalMs) || 15000;
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && inboxSelect.value) {
      loadMessages(true);
    }
  }, interval);
}

Promise.all([loadConfig(), ensureSession()])
  .then(() => loadInboxes())
  .then(() => startAutoRefresh())
  .catch((err) => {
    console.error(err);
    messageList.replaceChildren();
    const errState = document.createElement('div');
    errState.className = 'empty-state';
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '⚠️';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Connection error';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = err.message;
    errState.append(icon, title, sub);
    messageList.append(errState);
  });
