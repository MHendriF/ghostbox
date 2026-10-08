/**
 * GhostBox - Telegram Webhook Notification Utility
 * Formats incoming email alerts with prominent OTP highlighting
 * and sends via Telegram Bot API (100% Free).
 */

export interface TelegramNotificationParams {
  to: string;
  from: string;
  subject: string;
  body: string;
  messageId?: string | null;
}

export const TELEGRAM_TOKEN_REGEX = /^\d+:[A-Za-z0-9_-]+$/;

export function isValidTelegramToken(token: string): boolean {
  if (typeof token !== 'string') return false;
  return TELEGRAM_TOKEN_REGEX.test(token.trim());
}

export function isValidTelegramChatId(chatId: string): boolean {
  if (typeof chatId !== 'string') return false;
  const trimmed = chatId.trim();
  return /^-?\d{5,20}$/.test(trimmed) || /^@[a-zA-Z0-9_]{4,32}$/.test(trimmed);
}

export function escapeHtml(text: string): string {
  return (text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function extractOtp(subject = '', body = ''): string | null {
  const cleanBody = (body || '').replace(/<[^>]*>/g, ' ');
  const text = `${subject || ''} ${cleanBody}`.replace(/\s+/g, ' ');

  const labeledRegex = /(?:code|otp|verification|pin|kode|verifikasi|token)[\s:=#\-]+([a-z0-9]{4,8})\b/i;
  const matchLabeled = text.match(labeledRegex);
  if (matchLabeled && matchLabeled[1]) {
    return matchLabeled[1];
  }

  // Standalone 6-8 digit numeric code
  const standalone6to8 = /\b(\d{6,8})\b/;
  const match6to8 = text.match(standalone6to8);
  if (match6to8 && match6to8[1]) {
    return match6to8[1];
  }

  // Standalone 4-5 digit numeric code (filtering out common years 1970-2099)
  const standalone4to5 = /\b(\d{4,5})\b/g;
  let match4to5;
  while ((match4to5 = standalone4to5.exec(text)) !== null) {
    const val = parseInt(match4to5[1], 10);
    if (val >= 1970 && val <= 2099) {
      continue;
    }
    return match4to5[1];
  }

  return null;
}

export function formatTelegramMessage(params: TelegramNotificationParams): string {
  const safeTo = escapeHtml(params.to).slice(0, 100);
  const safeFrom = escapeHtml(params.from).slice(0, 100);
  const safeSubject = escapeHtml(params.subject || '(Tanpa subjek)').slice(0, 200);

  const otp = extractOtp(params.subject, params.body);
  const otpSection = otp
    ? `\n🔑 <b>Kode OTP:</b> <code>${escapeHtml(otp)}</code>\n`
    : '';

  const cleanPreview = (params.body || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  const safePreview = cleanPreview
    ? `\n📝 <i>${escapeHtml(cleanPreview)}${cleanPreview.length >= 300 ? '...' : ''}</i>`
    : '';

  const formatted =
    `📬 <b>GhostBox — Pesan Masuk</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Dari:</b> ${safeFrom}\n` +
    `📥 <b>Kepada:</b> ${safeTo}\n` +
    `📌 <b>Subjek:</b> ${safeSubject}\n` +
    otpSection +
    safePreview;

  // Strict clamp to 4000 characters (Telegram API limit is 4096)
  return formatted.length > 4000 ? formatted.slice(0, 3996) + '...' : formatted;
}

export function buildTelegramPayload(
  chatId: string,
  text: string,
  threadId?: string | number
): Record<string, any> {
  const payload: Record<string, any> = {
    chat_id: (chatId || '').trim(),
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (threadId !== undefined && threadId !== null && String(threadId).trim() !== '') {
    const tid = parseInt(String(threadId).trim(), 10);
    if (!isNaN(tid) && tid > 0) {
      payload.message_thread_id = tid;
    }
  }

  return payload;
}

export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  params: TelegramNotificationParams,
  threadId?: string | number
): Promise<boolean> {
  const token = (botToken || '').trim();
  const chat = (chatId || '').trim();
  if (!token || !chat) return false;

  if (!isValidTelegramToken(token)) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'telegram_invalid_token_format',
      })
    );
    return false;
  }

  const text = formatTelegramMessage(params);
  const payload = buildTelegramPayload(chat, text, threadId);

  try {
    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'telegram_notification_failed',
          status: res.status,
          error: errText,
        })
      );
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'telegram_network_error',
        error: err?.message || String(err),
      })
    );
    return false;
  }
}

