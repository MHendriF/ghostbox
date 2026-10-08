import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getInbox,
  createInbox,
  inboxExists,
  getInboxOwner,
  getSessionInboxes,
  getMessages,
  deleteMessage,
  deleteInbox,
  ensureSession,
  linkInboxToSession,
  isInboxInSession,
} from '../db/queries';
import { generateUniqueAddress } from '../utils/random-address';

export interface ApiEnv {
  DB: D1Database;
  APP_NAME: string;
  MAIL_DOMAIN: string;
  WEB_HOST: string;
  AUTH_USERNAME?: string;
  AUTH_PASSCODE?: string;
  MAX_INBOXES_PER_SESSION?: string;
  AUTO_REFRESH_INTERVAL_MS?: string;
  DEFAULT_MESSAGES_LIMIT?: string;
  MAX_MESSAGES_LIMIT?: string;
}

type Variables = {
  sessionId: string;
};

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

function getDomains(env: ApiEnv): string[] {
  return env.MAIL_DOMAIN.split(',').map((d) => d.trim()).filter(Boolean);
}

function defaultDomain(env: ApiEnv): string {
  return getDomains(env)[0] || 'example.com';
}

function extractSessionId(c: any): string | null {
  return (c.req.header('x-session-id') || '').trim() || null;
}

const api = new Hono<{ Bindings: ApiEnv; Variables: Variables }>();

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

export function timingSafeEqual(a: string, b: string): boolean {
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

// ---- Global Security & CORS Headers Middleware ----
api.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests"
  );
});

// ---- Master Username & Passcode Authentication Middleware ----
const requireAuthMiddleware: MiddlewareHandler<{ Bindings: ApiEnv; Variables: Variables }> = async (
  c,
  next
) => {
  const expectedPasscode = (c.env.AUTH_PASSCODE || '').trim();
  const expectedUsername = (c.env.AUTH_USERNAME || '').trim();

  // Public mode if neither username nor passcode is set
  if (!expectedPasscode && !expectedUsername) {
    return next();
  }

  const providedPasscode = (c.req.header('x-auth-passcode') || '').trim();
  const providedUsername = (c.req.header('x-auth-username') || '').trim();

  const isUserValid = !expectedUsername || timingSafeEqual(providedUsername, expectedUsername);
  const isPassValid = !expectedPasscode || timingSafeEqual(providedPasscode, expectedPasscode);

  if (!isUserValid || !isPassValid) {
    return c.json({ error: 'Unauthorized: Invalid username or password' }, 401);
  }

  return next();
};

// ---- Session Authentication Middleware for protected routes ----
const requireSessionMiddleware: MiddlewareHandler<{ Bindings: ApiEnv; Variables: Variables }> = async (
  c,
  next
) => {
  const sid = extractSessionId(c);
  if (!sid) {
    return c.json({ error: 'Missing x-session-id' }, 400);
  }
  if (!isValidUuid(sid)) {
    return c.json({ error: 'Invalid x-session-id format: Must be UUID v4' }, 400);
  }
  c.set('sessionId', sid);
  return next();
};

// Protect sensitive endpoints with authentication middleware
api.use('/session', requireAuthMiddleware);
api.use('/inboxes', requireAuthMiddleware);
api.use('/inboxes/*', requireAuthMiddleware);

// Protect inbox routes with session middleware
api.use('/inboxes', requireSessionMiddleware);
api.use('/inboxes/*', requireSessionMiddleware);

// ---- POST /api/verify-passcode ----
api.post('/verify-passcode', async (c) => {
  const expectedPasscode = (c.env.AUTH_PASSCODE || '').trim();
  const expectedUsername = (c.env.AUTH_USERNAME || '').trim();

  if (!expectedPasscode && !expectedUsername) {
    return c.json({ valid: true, authRequired: false });
  }

  let body: { username?: string; passcode?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const providedUsername = (body.username || '').trim();
  const providedPasscode = (body.passcode || '').trim();

  const isUserValid = !expectedUsername || timingSafeEqual(providedUsername, expectedUsername);
  const isPassValid = !expectedPasscode || timingSafeEqual(providedPasscode, expectedPasscode);

  if (!isUserValid || !isPassValid) {
    return c.json({ error: 'Invalid username or passcode' }, 401);
  }

  return c.json({ valid: true, authRequired: true });
});

// ---- GET /api/config ----
api.get('/config', (c) => {
  const domains = getDomains(c.env);
  const maxInboxes = parseInt(c.env.MAX_INBOXES_PER_SESSION || '10', 10);
  const refreshIntervalMs = parseInt(c.env.AUTO_REFRESH_INTERVAL_MS || '15000', 10);
  const authRequired = Boolean((c.env.AUTH_PASSCODE || '').trim() || (c.env.AUTH_USERNAME || '').trim());
  const usernameRequired = Boolean((c.env.AUTH_USERNAME || '').trim());
  return c.json({
    appName: c.env.APP_NAME || 'GhostBox',
    mailDomain: domains[0] || 'example.com',
    mailDomains: domains,
    webHost: c.env.WEB_HOST || 'ghostbox.example.com',
    maxInboxesPerSession: maxInboxes,
    autoRefreshIntervalMs: refreshIntervalMs,
    authRequired,
    usernameRequired,
  });
});

// ---- GET /api/session ----
api.get('/session', async (c) => {
  let sid = extractSessionId(c);
  if (!sid || !isValidUuid(sid)) {
    sid = crypto.randomUUID();
  }
  await ensureSession(c.env.DB, sid);
  return c.json({ sessionId: sid });
});

// ---- GET /api/inboxes ----
api.get('/inboxes', async (c) => {
  const sid = c.get('sessionId');
  const inboxes = await getSessionInboxes(c.env.DB, sid);
  return c.json(inboxes);
});

// ---- POST /api/inboxes ----
api.post('/inboxes', async (c) => {
  const sid = c.get('sessionId');

  const body = await c.req.json().catch(() => ({}));
  const domains = getDomains(c.env);
  const requestedDomain: string = (body.domain || '').trim().toLowerCase();
  const domain = requestedDomain && domains.includes(requestedDomain)
    ? requestedDomain
    : defaultDomain(c.env);

  // Validate: reject unknown domains
  if (requestedDomain && !domains.includes(requestedDomain)) {
    return c.json({ error: `Invalid domain: ${requestedDomain}. Allowed: ${domains.join(', ')}` }, 400);
  }

  const requested: string = (body.localPart || '').trim().toLowerCase();

  // Validate localPart charset and length
  if (requested) {
    if (RESERVED_LOCAL_PARTS.has(requested)) {
      return c.json({ error: `Reserved localPart '${requested}' is not allowed` }, 400);
    }
    if (!LOCAL_PART_REGEX.test(requested)) {
      return c.json(
        {
          error:
            'Invalid localPart. Must be 1-32 alphanumeric characters, dots, underscores, or hyphens, starting and ending with alphanumeric.',
        },
        400
      );
    }
  }

  let address: string;
  if (requested) {
    address = `${requested}@${domain}`;

    // Anti-Hijacking: check if address already exists
    if (await inboxExists(c.env.DB, address)) {
      const alreadyInThisSession = await isInboxInSession(c.env.DB, sid, address);
      if (alreadyInThisSession) {
        const existingInbox = await getInbox(c.env.DB, address);
        return c.json(existingInbox!, 200);
      }

      // Check ownership
      const ownerSession = await getInboxOwner(c.env.DB, address);
      if (ownerSession && ownerSession !== sid) {
        return c.json({ error: 'Address already registered by another session' }, 409);
      }
    }
  } else {
    address = await generateUniqueAddress(
      (addr) => inboxExists(c.env.DB, addr),
      domain
    );
  }

  // Quota enforcement: cap maximum active inboxes per session (configurable via env)
  const maxInboxes = parseInt(c.env.MAX_INBOXES_PER_SESSION || '10', 10);
  const currentInboxes = await getSessionInboxes(c.env.DB, sid);
  if (currentInboxes.length >= maxInboxes) {
    return c.json(
      {
        error: `Session inbox limit reached (maximum ${maxInboxes} inboxes per session). Delete an inbox to create a new one.`,
      },
      429
    );
  }

  // Ensure inbox record exists with current session as owner
  await createInbox(c.env.DB, address, sid);

  // Link to session
  await linkInboxToSession(c.env.DB, sid, address);

  const inbox = await getInbox(c.env.DB, address);
  return c.json(inbox!, 201);
});

// ---- DELETE /api/inboxes/:address ----
api.delete('/inboxes/:address', async (c) => {
  const sid = c.get('sessionId');
  const address = decodeURIComponent(c.req.param('address'));

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return c.json({ error: 'Inbox not in this session' }, 403);
  }

  await deleteInbox(c.env.DB, sid, address);
  return c.json({ ok: true });
});

// ---- GET /api/inboxes/:address/messages ----
api.get('/inboxes/:address/messages', async (c) => {
  const sid = c.get('sessionId');
  const address = decodeURIComponent(c.req.param('address'));

  // Must have inbox in session to read messages
  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return c.json({ error: 'Inbox not in this session' }, 403);
  }

  const defaultLimit = parseInt(c.env.DEFAULT_MESSAGES_LIMIT || '50', 10);
  const maxLimit = parseInt(c.env.MAX_MESSAGES_LIMIT || '100', 10);
  const limitParam = c.req.query('limit');
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || defaultLimit, 1), maxLimit)
    : defaultLimit;
  const cursor = c.req.query('cursor');

  const messages = await getMessages(c.env.DB, address, limit, cursor);
  return c.json(messages);
});

// ---- DELETE /api/inboxes/:address/messages/:id ----
api.delete('/inboxes/:address/messages/:id', async (c) => {
  const sid = c.get('sessionId');
  const address = decodeURIComponent(c.req.param('address'));
  const messageId = c.req.param('id');

  if (!(await isInboxInSession(c.env.DB, sid, address))) {
    return c.json({ error: 'Inbox not in this session' }, 403);
  }

  const deleted = await deleteMessage(c.env.DB, messageId, address);
  if (!deleted) {
    return c.json({ error: 'Message not found' }, 404);
  }

  return c.json({ ok: true });
});

export default api;
