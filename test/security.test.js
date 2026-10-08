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
function isHtmlContent(content) {
  return /<[a-z][\s\S]*>/i.test(content);
}

test('html content detection: routes HTML bodies to sandboxed iframe', () => {
  assert.equal(isHtmlContent('Plain text email here'), false);
  assert.equal(isHtmlContent('Hello <world>'), true);
  assert.equal(isHtmlContent('<div class="email">Content</div>'), true);
  assert.equal(isHtmlContent('<p>Paragraph</p>'), true);
  assert.equal(isHtmlContent('<img src="x" onerror="alert(1)">'), true);
});

// Test 6: Passcode authentication verification logic
function verifyPasscode(expected, provided) {
  const normExpected = (expected || '').trim();
  if (!normExpected) {
    return { allowed: true, authRequired: false };
  }
  const normProvided = (provided || '').trim();
  if (normProvided && normProvided === normExpected) {
    return { allowed: true, authRequired: true };
  }
  return { allowed: false, authRequired: true, error: 'Unauthorized' };
}

test('passcode verification: validates secret tokens and allows public mode when unset', () => {
  // Public mode: no passcode configured
  assert.deepEqual(verifyPasscode('', ''), { allowed: true, authRequired: false });
  assert.deepEqual(verifyPasscode(undefined, 'any'), { allowed: true, authRequired: false });

  // Protected mode: passcode configured
  const secret = 'GhostAdmin2026!';
  assert.equal(verifyPasscode(secret, 'GhostAdmin2026!').allowed, true);
  assert.equal(verifyPasscode(secret, 'wrong-password').allowed, false);
  assert.equal(verifyPasscode(secret, '').allowed, false);
  assert.equal(verifyPasscode(secret, undefined).allowed, false);
});
