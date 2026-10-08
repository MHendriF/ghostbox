import PostalMime from 'postal-mime';
import type { D1Database } from '@cloudflare/workers-types';
import { createInbox, inboxExists, insertMessage } from './db/queries';
import { sendTelegramNotification } from './utils/telegram';

export interface EmailHandlerEnv {
  DB: D1Database;
  MAIL_DOMAIN: string;
  MAX_EMAIL_SIZE_BYTES?: string;
  MAX_BODY_SIZE_BYTES?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_THREAD_ID?: string;
}

const DEFAULT_MAX_RAW_SIZE = 1024 * 1024; // 1 MB default
const MAX_SUBJECT_LEN = 998; // RFC 5322 limit
const DEFAULT_MAX_BODY_LEN = 500 * 1024; // 500 KB default limit for D1 rows

/**
 * Handles inbound email via Cloudflare Email Worker.
 * Called for every email received at any @<MAIL_DOMAIN> address.
 */
export async function handleEmail(
  message: ForwardableEmailMessage,
  env: EmailHandlerEnv
): Promise<void> {
  const to = message.to.toLowerCase().trim();
  const from = message.from.toLowerCase().trim();

  // 1. Recipient domain verification
  const toParts = to.split('@');
  const recipientDomain = toParts[1] || '';
  const allowedDomains = env.MAIL_DOMAIN.split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedDomains.includes(recipientDomain)) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'email_dropped_domain_mismatch',
        to,
        from,
        recipientDomain,
        allowedDomains,
      })
    );
    return;
  }

  // 2. Configurable size limit check
  const maxRawSize = env.MAX_EMAIL_SIZE_BYTES
    ? parseInt(env.MAX_EMAIL_SIZE_BYTES, 10) || DEFAULT_MAX_RAW_SIZE
    : DEFAULT_MAX_RAW_SIZE;

  if (message.rawSize && message.rawSize > maxRawSize) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'email_dropped_oversized',
        to,
        from,
        rawSize: message.rawSize,
        maxSize: maxRawSize,
      })
    );
    return;
  }

  try {
    // 3. Read raw email stream
    const rawStream = message.raw;
    const parser = new PostalMime();
    const parsed = await parser.parse(rawStream);

    const maxBodyLen = env.MAX_BODY_SIZE_BYTES
      ? parseInt(env.MAX_BODY_SIZE_BYTES, 10) || DEFAULT_MAX_BODY_LEN
      : DEFAULT_MAX_BODY_LEN;

    const rawSubject = parsed.subject || '(no subject)';
    const subject = rawSubject.slice(0, MAX_SUBJECT_LEN);

    const rawHtml = parsed.html?.trim();
    const rawText = parsed.text?.trim();
    // Prioritize HTML for full visual fidelity and nested reply structures; fallback to plain text
    const rawBody = rawHtml || rawText || '';
    const body = rawBody.slice(0, maxBodyLen);

    const messageId = parsed.messageId ? String(parsed.messageId).trim() : null;

    const db = env.DB;

    // Auto-create inbox if doesn't exist
    if (!(await inboxExists(db, to))) {
      await createInbox(db, to);
    }

    // Store the message with deduplication by message_id
    const id = `msg_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await insertMessage(db, {
      id,
      message_id: messageId,
      inbox_address: to,
      from_address: from,
      subject,
      body,
    });

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'email_stored',
        id,
        messageId,
        to,
        from,
      })
    );

    // 4. Send Telegram webhook alert if configured (100% Free)
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      try {
        await sendTelegramNotification(
          env.TELEGRAM_BOT_TOKEN,
          env.TELEGRAM_CHAT_ID,
          {
            to,
            from,
            subject,
            // Prefer clean plain text for Telegram notification preview, falling back to body
            body: rawText || body,
            messageId,
          },
          env.TELEGRAM_THREAD_ID
        );
      } catch (tgErr: any) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            event: 'telegram_dispatch_error',
            error: tgErr?.message || String(tgErr),
          })
        );
      }
    }
  } catch (err: any) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'email_processing_failed',
        to,
        from,
        error: err?.message || String(err),
        stack: err?.stack,
        timestamp: new Date().toISOString(),
      })
    );
    // Do not throw — avoid bouncing email, structured log recorded
  }
}
