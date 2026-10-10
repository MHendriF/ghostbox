import type { D1Database } from '@cloudflare/workers-types';

export interface Inbox {
  address: string;
  created_at: string;
  owner_session_id?: string | null;
}

export interface Message {
  id: string;
  message_id?: string | null;
  inbox_address: string;
  from_address: string;
  subject: string;
  body: string;
  received_at: string;
}

export interface Session {
  id: string;
  created_at: string;
}

// ---- Inboxes ----

export async function getInbox(db: D1Database, address: string): Promise<Inbox | null> {
  return db.prepare('SELECT * FROM inboxes WHERE address = ?').bind(address).first<Inbox>();
}

export async function createInbox(
  db: D1Database,
  address: string,
  ownerSessionId?: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO inboxes (address, created_at, owner_session_id)
         VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)`
      )
      .bind(address, ownerSessionId || null)
      .run();
  } catch {
    // Fallback for legacy schema if column owner_session_id doesn't exist yet
    await db.prepare('INSERT OR IGNORE INTO inboxes (address) VALUES (?)').bind(address).run();
  }
}

export async function inboxExists(db: D1Database, address: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM inboxes WHERE address = ? LIMIT 1').bind(address).first();
  return !!row;
}

export async function getInboxOwner(db: D1Database, address: string): Promise<string | null> {
  const linkRow = await db
    .prepare('SELECT session_id FROM session_inboxes WHERE inbox_address = ? LIMIT 1')
    .bind(address)
    .first<{ session_id: string }>();
  if (linkRow?.session_id) return linkRow.session_id;

  try {
    const inboxRow = await db
      .prepare('SELECT owner_session_id FROM inboxes WHERE address = ? LIMIT 1')
      .bind(address)
      .first<{ owner_session_id: string | null }>();
    if (inboxRow?.owner_session_id) return inboxRow.owner_session_id;
  } catch {
    // Ignore column missing in legacy DB
  }
  return null;
}

export async function getAllInboxes(db: D1Database, limit = 100): Promise<Inbox[]> {
  return db
    .prepare(
      `SELECT * FROM inboxes
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Inbox>()
    .then((r) => r.results);
}

export async function getSessionInboxes(db: D1Database, sessionId: string): Promise<Inbox[]> {
  return db
    .prepare(
      `SELECT i.* FROM inboxes i
       INNER JOIN session_inboxes si ON si.inbox_address = i.address
       WHERE si.session_id = ?
       ORDER BY i.created_at DESC`
    )
    .bind(sessionId)
    .all<Inbox>()
    .then((r) => r.results);
}

export async function deleteInbox(
  db: D1Database,
  address: string,
  sessionId?: string
): Promise<void> {
  if (sessionId) {
    await unlinkInboxFromSession(db, sessionId, address).catch(() => {});
  }
  await db.prepare('DELETE FROM messages WHERE inbox_address = ?').bind(address).run();
  await db.prepare('DELETE FROM inboxes WHERE address = ?').bind(address).run();
}

// ---- Messages ----

export async function getMessages(
  db: D1Database,
  inboxAddress: string,
  limit = 50,
  cursor?: string
): Promise<Message[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  if (cursor) {
    return db
      .prepare(
        'SELECT * FROM messages WHERE inbox_address = ? AND received_at < ? ORDER BY received_at DESC LIMIT ?'
      )
      .bind(inboxAddress, cursor, safeLimit)
      .all<Message>()
      .then((r) => r.results);
  }

  return db
    .prepare(
      'SELECT * FROM messages WHERE inbox_address = ? ORDER BY received_at DESC LIMIT ?'
    )
    .bind(inboxAddress, safeLimit)
    .all<Message>()
    .then((r) => r.results);
}

export async function insertMessage(
  db: D1Database,
  msg: {
    id: string;
    message_id?: string | null;
    inbox_address: string;
    from_address: string;
    subject: string;
    body: string;
  }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO messages (id, message_id, inbox_address, from_address, subject, body, received_at)
         VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
      )
      .bind(
        msg.id,
        msg.message_id || null,
        msg.inbox_address,
        msg.from_address,
        msg.subject,
        msg.body
      )
      .run();
  } catch (err: any) {
    if (String(err?.message || '').includes('no such column: message_id')) {
      await db
        .prepare(
          `INSERT INTO messages (id, inbox_address, from_address, subject, body, received_at)
           VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`
        )
        .bind(msg.id, msg.inbox_address, msg.from_address, msg.subject, msg.body)
        .run();
    } else {
      throw err;
    }
  }
}

export async function deleteMessage(
  db: D1Database,
  messageId: string,
  inboxAddress: string
): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM messages WHERE id = ? AND inbox_address = ?')
    .bind(messageId, inboxAddress)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function cleanupExpiredMessages(
  db: D1Database,
  hours = 24
): Promise<number> {
  const res = await db
    .prepare(
      "DELETE FROM messages WHERE julianday(received_at) < julianday('now', '-' || ? || ' hours')"
    )
    .bind(hours)
    .run();
  return res.meta?.changes ?? 0;
}

export async function cleanupOrphanInboxes(
  db: D1Database,
  hours = 24
): Promise<number> {
  const res = await db
    .prepare(
      `DELETE FROM inboxes
       WHERE address NOT IN (SELECT inbox_address FROM session_inboxes)
         AND address NOT IN (SELECT inbox_address FROM messages)
         AND julianday(created_at) < julianday('now', '-' || ? || ' hours')`
    )
    .bind(hours)
    .run();
  return res.meta?.changes ?? 0;
}

// ---- Sessions ----

export async function ensureSession(db: D1Database, sessionId: string): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
    .bind(sessionId)
    .run();
}

export async function sessionExists(db: D1Database, sessionId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM sessions WHERE id = ? LIMIT 1').bind(sessionId).first();
  return !!row;
}

// ---- Session-Inbox links ----

export async function linkInboxToSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<void> {
  await db
    .prepare(
      'INSERT OR IGNORE INTO session_inboxes (session_id, inbox_address) VALUES (?, ?)'
    )
    .bind(sessionId, address)
    .run();
}

export async function unlinkInboxFromSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<void> {
  await db
    .prepare('DELETE FROM session_inboxes WHERE session_id = ? AND inbox_address = ?')
    .bind(sessionId, address)
    .run();
}

export async function isInboxInSession(
  db: D1Database,
  sessionId: string,
  address: string
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM session_inboxes WHERE session_id = ? AND inbox_address = ? LIMIT 1')
    .bind(sessionId, address)
    .first();
  return !!row;
}
