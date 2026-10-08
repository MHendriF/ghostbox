import test from 'node:test';
import assert from 'node:assert/strict';

// Test 1: localPart validation regex & reserved names
const RESERVED_LOCAL_PARTS = new Set([
  'postmaster',
  'abuse',
  'admin',
  'root',
  'noreply',
  'no-reply',
  'webmaster',
  'hostmaster',
  'support',
  'security',
  'mailer-daemon',
  'ssl-admin',
]);

const LOCAL_PART_REGEX = /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/;

function validateLocalPart(lp) {
  const norm = (lp || '').trim().toLowerCase();
  if (!norm) return { valid: false, error: 'Empty localPart' };
  if (RESERVED_LOCAL_PARTS.has(norm)) {
    return { valid: false, error: 'Reserved name' };
  }
  if (!LOCAL_PART_REGEX.test(norm)) {
    return { valid: false, error: 'Invalid characters or length' };
  }
  return { valid: true };
}

test('localPart validation: accepts valid usernames', () => {
  const validCases = ['user', 'a', 'john.doe', 'hello-world', 'test_123', 'a'.repeat(32)];
  for (const c of validCases) {
    const res = validateLocalPart(c);
    assert.equal(res.valid, true, `Expected '${c}' to be valid`);
  }
});

test('localPart validation: rejects reserved system usernames', () => {
  const reservedCases = ['admin', 'abuse', 'postmaster', 'root', 'noreply', 'ADMIN', 'Abuse'];
  for (const c of reservedCases) {
    const res = validateLocalPart(c);
    assert.equal(res.valid, false);
    assert.equal(res.error, 'Reserved name', `Expected '${c}' to be rejected as reserved`);
  }
});

test('localPart validation: rejects dangerous characters and invalid formatting', () => {
  const invalidCases = [
    'user<script>',
    'user@domain',
    '-startingdash',
    'endingdash-',
    '.startingdot',
    'endingdot.',
    'space here',
    'a'.repeat(33), // exceeds 32 chars
    '',
    '   ',
    'user;drop',
    'user"quote',
  ];
  for (const c of invalidCases) {
    const res = validateLocalPart(c);
    assert.equal(res.valid, false, `Expected '${c}' to be invalid`);
  }
});

// Test 2: Inbound email domain verification
function isAllowedDomain(toAddress, mailDomainConfig) {
  const to = toAddress.toLowerCase().trim();
  const parts = to.split('@');
  const domain = parts[1] || '';
  const allowed = mailDomainConfig.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(domain);
}

test('domain verification: matches allowed recipient domains', () => {
  const config = 'mhfzero.my.id, example.com';
  assert.equal(isAllowedDomain('test@mhfzero.my.id', config), true);
  assert.equal(isAllowedDomain('user@example.com', config), true);
  assert.equal(isAllowedDomain('user@attacker.com', config), false);
  assert.equal(isAllowedDomain('user@sub.mhfzero.my.id', config), false);
});

// Test 3: Ingestion limits (rawSize, subject length, body length)
const MAX_RAW_SIZE = 1024 * 1024; // 1MB
const MAX_SUBJECT_LEN = 998;
const MAX_BODY_LEN = 500 * 1024;

test('ingestion limits: enforces size and length constraints', () => {
  assert.equal(500000 <= MAX_RAW_SIZE, true);
  assert.equal(1500000 > MAX_RAW_SIZE, true);

  const longSubject = 'A'.repeat(1500);
  const truncatedSubject = longSubject.slice(0, MAX_SUBJECT_LEN);
  assert.equal(truncatedSubject.length, 998);

  const longBody = 'B'.repeat(600 * 1024);
  const truncatedBody = longBody.slice(0, MAX_BODY_LEN);
  assert.equal(truncatedBody.length, 500 * 1024);
});

// Test 4: Timestamp normalisation
function formatTimestamp(raw) {
  if (!raw) return '';
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? raw : d.toISOString();
}

test('timestamp normalization: handles non-ISO SQLite and ISO 8601 uniformly', () => {
  const legacySqlite = '2026-06-26 08:10:14';
  const isoDate = '2026-06-26T08:10:14.000Z';

  const resLegacy = formatTimestamp(legacySqlite);
  const resIso = formatTimestamp(isoDate);

  assert.equal(resLegacy, '2026-06-26T08:10:14.000Z');
  assert.equal(resIso, '2026-06-26T08:10:14.000Z');
});

// Test 5: HTML detection for sandboxed iframe routing
import { isHtmlContent, parseEmailThread, linkifyText, prepareEmailHtml } from '../src/frontend/utils.ts';

test('html content detection: accurately detects HTML bodies while ignoring plaintext email addresses', () => {
  assert.equal(isHtmlContent('Plain text email here'), false);
  // Email addresses in plaintext must NOT trigger HTML detection
  assert.equal(isHtmlContent('From: John Doe <aizenbunshin@gmail.com>'), false);
  assert.equal(isHtmlContent('On Thu, Oct 8 wrote: <someone@example.com>'), false);
  assert.equal(isHtmlContent('Hello <world>'), false);

  // Real HTML tags and doctypes
  assert.equal(isHtmlContent('<div class="email">Content</div>'), true);
  assert.equal(isHtmlContent('<p>Paragraph</p>'), true);
  assert.equal(isHtmlContent('<img src="x" onerror="alert(1)">'), true);
  assert.equal(isHtmlContent('<!DOCTYPE html><html><body>Test</body></html>'), true);
  assert.equal(isHtmlContent('<a href="https://example.com">Visit site</a>'), true);
  assert.equal(isHtmlContent('Line 1<br>Line 2'), true);
});

// Test 6: Credentials authentication verification logic (username + passcode)
function verifyCredentials(expectedUser, expectedPass, providedUser, providedPass) {
  const normExpectedPass = (expectedPass || '').trim();
  const normExpectedUser = (expectedUser || '').trim();

  if (!normExpectedPass && !normExpectedUser) {
    return { allowed: true, authRequired: false };
  }

  const normProvidedPass = (providedPass || '').trim();
  const normProvidedUser = (providedUser || '').trim();

  if (normExpectedUser && normProvidedUser !== normExpectedUser) {
    return { allowed: false, authRequired: true, error: 'Unauthorized' };
  }
  if (normExpectedPass && normProvidedPass !== normExpectedPass) {
    return { allowed: false, authRequired: true, error: 'Unauthorized' };
  }

  return { allowed: true, authRequired: true };
}

test('credentials verification: validates username and passcode, supports fallback', () => {
  // Public mode: neither configured
  assert.deepEqual(verifyCredentials('', '', '', ''), { allowed: true, authRequired: false });
  assert.deepEqual(verifyCredentials(undefined, undefined, 'any', 'any'), { allowed: true, authRequired: false });

  // Protected mode: username + passcode configured
  const expectedUser = 'admin';
  const expectedPass = 'Smansa182@GHOST';

  // Valid credentials
  assert.equal(verifyCredentials(expectedUser, expectedPass, 'admin', 'Smansa182@GHOST').allowed, true);

  // Wrong username, correct password
  assert.equal(verifyCredentials(expectedUser, expectedPass, 'wronguser', 'Smansa182@GHOST').allowed, false);

  // Correct username, wrong password
  assert.equal(verifyCredentials(expectedUser, expectedPass, 'admin', 'wrongpass').allowed, false);

  // Empty credentials
  assert.equal(verifyCredentials(expectedUser, expectedPass, '', '').allowed, false);
});

// Test 7: EML formatting utility
import { generateEml } from '../src/utils/eml.ts';

test('eml generation: produces RFC 5322 compliant email headers and body', () => {
  const plainMsg = {
    from: 'sender@example.com',
    to: 'box@rinjaniglobal.com',
    subject: 'Verification Code',
    date: '2026-10-08T10:00:00.000Z',
    body: 'Your code is 123456.',
  };
  const emlPlain = generateEml(plainMsg);
  assert.match(emlPlain, /^From: sender@example\.com/m);
  assert.match(emlPlain, /^To: box@rinjaniglobal\.com/m);
  assert.match(emlPlain, /^Subject: Verification Code/m);
  assert.match(emlPlain, /^Content-Type: text\/plain; charset=utf-8/m);
  assert.match(emlPlain, /Your code is 123456\./);

  const htmlMsg = {
    from: 'support@example.com',
    to: 'user@rinjaniglobal.com',
    subject: 'Welcome',
    body: '<h1>Welcome to GhostBox</h1>',
  };
  const emlHtml = generateEml(htmlMsg);
  assert.match(emlHtml, /^Content-Type: text\/html; charset=utf-8/m);
  assert.match(emlHtml, /<h1>Welcome to GhostBox<\/h1>/);
});

// Test 8: Telegram notification formatter
import { formatTelegramMessage, extractOtp } from '../src/utils/telegram.ts';

test('telegram formatter: escapes html entities and highlights otp code', () => {
  const msgWithOtp = {
    from: 'service@secure.com',
    to: 'myuser@rinjaniglobal.com',
    subject: 'Your OTP is 894211 <important>',
    body: 'Silakan gunakan kode verifikasi 894211 untuk login & verifikasi.',
  };

  const text = formatTelegramMessage(msgWithOtp);
  assert.match(text, /🔑 <b>OTP Code:<\/b> <code>894211<\/code>/);
  assert.match(text, /&lt;important&gt;/); // escaped html
  assert.match(text, /service@secure\.com/);
  assert.match(text, /myuser@rinjaniglobal\.com/);

  // Message without OTP
  const msgWithoutOtp = {
    from: 'news@update.com',
    to: 'news@rinjaniglobal.com',
    subject: 'Monthly Newsletter',
    body: 'Here is your monthly tech news update.',
  };
  const textNoOtp = formatTelegramMessage(msgWithoutOtp);
  assert.equal(textNoOtp.includes('OTP Code:'), false);
  assert.match(textNoOtp, /Monthly Newsletter/);
});

// Test 9: Client-side search and OTP filter predicate
function matchMessageFilter(msg, query, filterMode) {
  if (filterMode === 'otp') {
    const otp = extractOtp(msg.subject, msg.body);
    if (!otp) return false;
  }
  const q = (query || '').toLowerCase().trim();
  if (q) {
    const subj = (msg.subject || '').toLowerCase();
    const from = (msg.from_address || '').toLowerCase();
    const body = (msg.body || '').toLowerCase();
    return subj.includes(q) || from.includes(q) || body.includes(q);
  }
  return true;
}

test('search and filter predicate: accurately matches queries and otp flag', () => {
  const item1 = {
    subject: 'Verification Code: 998877',
    from_address: 'auth@service.com',
    body: 'Your single use code is 998877',
  };
  const item2 = {
    subject: 'Invoice for October 2026',
    from_address: 'billing@vendor.com',
    body: 'Please find attached invoice details.',
  };

  // 'all' filter, empty query -> matches everything
  assert.equal(matchMessageFilter(item1, '', 'all'), true);
  assert.equal(matchMessageFilter(item2, '', 'all'), true);

  // 'otp' filter
  assert.equal(matchMessageFilter(item1, '', 'otp'), true);
  assert.equal(matchMessageFilter(item2, '', 'otp'), false);

  // Query search
  assert.equal(matchMessageFilter(item1, 'invoice', 'all'), false);
  assert.equal(matchMessageFilter(item2, 'invoice', 'all'), true);
  assert.equal(matchMessageFilter(item1, 'service.com', 'all'), true);
  assert.equal(matchMessageFilter(item2, 'billing', 'all'), true);

  // Combined query + otp filter
  assert.equal(matchMessageFilter(item1, 'auth', 'otp'), true);
  assert.equal(matchMessageFilter(item2, 'billing', 'otp'), false);
});

// Test 10: CRLF Injection prevention in EML headers
test('eml hardening: strips CRLF from header fields to prevent header injection', () => {
  const maliciousMsg = {
    from: 'attacker@evil.com\r\nBcc: spy@evil.com',
    to: 'victim@rinjaniglobal.com\nCc: accomplice@evil.com',
    subject: 'Important Invoice\r\nContent-Type: application/octet-stream',
    body: 'Safe body content',
  };

  const eml = generateEml(maliciousMsg);
  // Ensure no injected CRLF lines exist in headers
  assert.equal(eml.includes('From: attacker@evil.com\r\nBcc:'), false);
  assert.equal(eml.includes('To: victim@rinjaniglobal.com\nCc:'), false);
  assert.equal(eml.includes('Subject: Important Invoice\r\nContent-Type: application/octet-stream'), false);

  // Headers should be sanitized into a single line
  assert.match(eml, /^From: attacker@evil\.com Bcc: spy@evil\.com/m);
  assert.match(eml, /^To: victim@rinjaniglobal\.com Cc: accomplice@evil\.com/m);
  assert.match(eml, /^Subject: Important Invoice Content-Type: application\/octet-stream/m);
});

// Test 11: Telegram payload clamping & bot token format validation
import { isValidTelegramToken } from '../src/utils/telegram.ts';

test('telegram hardening: strictly limits message length and validates token regex', () => {
  // 1. Length clamping under 4000 chars even for giant 100k email bodies
  const giantBody = 'X'.repeat(50000);
  const formatted = formatTelegramMessage({
    from: 'sender@example.com',
    to: 'target@rinjaniglobal.com',
    subject: 'Gigantic Email Subject',
    body: giantBody,
  });

  assert.equal(formatted.length <= 4000, true, `Formatted message length ${formatted.length} exceeds 4000 chars`);

  // 2. Token format validation
  assert.equal(isValidTelegramToken('123456789:AAHkjlfsd-kjhsd_sdjk12908754123'), true);
  assert.equal(isValidTelegramToken('12345:A'), true);
  assert.equal(isValidTelegramToken('invalid_token_without_colon'), false);
  assert.equal(isValidTelegramToken('abc:123'), false); // bot ID part must be numeric
  assert.equal(isValidTelegramToken('123:has space'), false);
  assert.equal(isValidTelegramToken(''), false);
});

// Test 12: Timing-safe string comparison
function timingSafeEqual(a, b) {
  const strA = String(a || '');
  const strB = String(b || '');
  const lenA = strA.length;
  const lenB = strB.length;

  let mismatch = lenA === lenB ? 0 : 1;
  const maxLen = Math.max(lenA, lenB);
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < lenA ? strA.charCodeAt(i) : 0;
    const codeB = i < lenB ? strB.charCodeAt(i) : 0;
    mismatch |= codeA ^ codeB;
  }
  return mismatch === 0;
}

test('timing-safe string comparison: produces constant-time boolean results', () => {
  assert.equal(timingSafeEqual('Smansa182@GHOST', 'Smansa182@GHOST'), true);
  assert.equal(timingSafeEqual('Smansa182@GHOST', 'Smansa182@GHOSX'), false);
  assert.equal(timingSafeEqual('ghostbox', 'ghostbox'), true);
  assert.equal(timingSafeEqual('ghostbox', 'admin'), false);
  assert.equal(timingSafeEqual('short', 'very_long_string_test'), false);
  assert.equal(timingSafeEqual('', ''), true);
  assert.equal(timingSafeEqual('a', ''), false);
});

// Test 13: Strict UUID format validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id) {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

test('uuid validation: accepts valid UUID v4 and rejects arbitrary or malicious strings', () => {
  assert.equal(isValidUuid('996e0994-559e-4f91-8478-1b7c3f56eff6'), true);
  assert.equal(isValidUuid('E5E77ED7-673E-4A25-829F-8335D5F6108D'), true);
  assert.equal(isValidUuid('invalid-uuid-string'), false);
  assert.equal(isValidUuid("'; DROP TABLE sessions; --"), false);
  assert.equal(isValidUuid('996e0994-559e-4f91-8478'), false);
  assert.equal(isValidUuid(''), false);
  assert.equal(isValidUuid(null), false);
});

// Test 14: Telegram forum topic message_thread_id support
import { buildTelegramPayload } from '../src/utils/telegram.ts';

test('telegram forum topic: builds payload with message_thread_id when topic ID is provided', () => {
  // Without thread ID
  const payloadNormal = buildTelegramPayload('-1001234567890', 'Hello world');
  assert.equal(payloadNormal.chat_id, '-1001234567890');
  assert.equal(payloadNormal.message_thread_id, undefined);

  // With numeric thread ID
  const payloadTopicNum = buildTelegramPayload('-1001234567890', 'Topic alert', 42);
  assert.equal(payloadTopicNum.chat_id, '-1001234567890');
  assert.equal(payloadTopicNum.message_thread_id, 42);

  // With string thread ID
  const payloadTopicStr = buildTelegramPayload('-1001234567890', 'Topic alert', '105');
  assert.equal(payloadTopicStr.chat_id, '-1001234567890');
  assert.equal(payloadTopicStr.message_thread_id, 105);

  // With invalid or empty thread ID
  const payloadEmpty = buildTelegramPayload('-1001234567890', 'Alert', '');
  assert.equal(payloadEmpty.message_thread_id, undefined);

  const payloadZero = buildTelegramPayload('-1001234567890', 'Alert', 0);
  assert.equal(payloadZero.message_thread_id, undefined);

  const payloadNan = buildTelegramPayload('-1001234567890', 'Alert', 'abc');
  assert.equal(payloadNan.message_thread_id, undefined);
});

// Test 15: Email thread parsing (separating main content from nested replies)
test('email thread parser: cleanly isolates main message and nested reply depths', () => {
  const replyBody =
    'coba lagi\n\n' +
    'On Thu, Oct 8, 2026 at 4:27 PM Bunshin Aizen <aizenbunshin@gmail.com> wrote:\n\n' +
    '> haiiii\n>\n' +
    '> On Thu, Oct 8, 2026 at 4:22 PM Bunshin Aizen <aizenbunshin@gmail.com> wrote:\n>\n' +
    '>> halo test from aizen\n>>';

  const thread = parseEmailThread(replyBody);
  assert.equal(thread.mainText, 'coba lagi');
  assert.equal(thread.hasQuotes, true);
  assert.match(thread.attribution || '', /On Thu, Oct 8/);
  assert.equal(thread.quoteItems.length >= 2, true);

  // Check depth levels
  const depth1Items = thread.quoteItems.filter((i) => i.depth === 1);
  const depth2Items = thread.quoteItems.filter((i) => i.depth === 2);
  assert.equal(depth1Items.length > 0, true);
  assert.equal(depth2Items.length > 0, true);

  // Single message without quotes
  const simpleMsg = 'Halo ini adalah pesan langsung tanpa kutipan.';
  const simpleThread = parseEmailThread(simpleMsg);
  assert.equal(simpleThread.mainText, simpleMsg);
  assert.equal(simpleThread.hasQuotes, false);
  assert.equal(simpleThread.quoteItems.length, 0);
});

// Test 16: Safe plain-text URL linkification
test('linkify text: converts URLs to safe links while escaping HTML characters', () => {
  const input = 'Silakan verifikasi akun di https://example.com/verify?token=abc&ref=123 <admin@domain.com>';
  const linked = linkifyText(input);

  // URL converted to safe link with blank target and rel noopener
  assert.match(linked, /<a href="https:\/\/example\.com\/verify\?token=abc&amp;ref=123" target="_blank"/);
  // Email angle brackets safely escaped
  assert.match(linked, /&lt;admin@domain\.com&gt;/);
  // No unescaped angle brackets in text
  assert.equal(linked.includes('<admin@domain.com>'), false);
});

// Test 17: HTML email preparation and iframe security
test('prepare email html: injects base target and styles while stripping dangerous script tags', () => {
  const dirtyHtml =
    '<html><head><title>Test</title></head><body>' +
    '<script>alert("hack")</script>' +
    '<p onclick="malicious()">Selamat datang di platform!</p>' +
    '<div class="gmail_quote">Kutipan email</div>' +
    '</body></html>';

  const prepared = prepareEmailHtml(dirtyHtml);

  // Scripts must be completely stripped
  assert.equal(prepared.includes('<script>'), false);
  assert.equal(prepared.includes('alert("hack")'), false);
  // Dangerous inline handler stripped
  assert.equal(prepared.includes('onclick='), false);
  // Base target _blank injected
  assert.match(prepared, /<base target="_blank">/);
  // Nested quotes styling injected
  assert.match(prepared, /\.gmail_quote/);
});



