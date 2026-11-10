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

const COMMON_OTP_WORDS = new Set([
  'will', 'your', 'with', 'from', 'this', 'that', 'into', 'have',
  'only', 'once', 'must', 'does', 'just', 'more', 'than', 'also',
  'over', 'sent', 'been', 'here', 'when', 'then', 'code', 'team',
  'help', 'user', 'view', 'open', 'link', 'mail', 'free', 'date',
  'name', 'send', 'text', 'card', 'post', 'time', 'year', 'days',
]);

export function extractOtp(subject = '', body = ''): string | null {
  const cleanSubj = (subject || '').trim();
  const cleanBody = (body || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ');
  const combined = `${cleanSubj} ${cleanBody}`.replace(/\s+/g, ' ');

  // 1. Google Verification format: G-123456
  const googleMatch = combined.match(/\bG-(\d{6})\b/i);
  if (googleMatch) {
    return googleMatch[1];
  }

  // 2. Subject explicit check: only if subject has clear verification intent
  const subjHasAuthIntent =
    /(?:otp|code|pin|kode|verifik|confirm|konfirm|login|masuk|2fa|mfa|security)/i.test(cleanSubj);
  if (subjHasAuthIntent) {
    const subjLeadingCode = cleanSubj.match(/\b(\d{4,8})\b/);
    if (subjLeadingCode) {
      return subjLeadingCode[1];
    }
  }

  // 3. Strict Labeled Code pattern (e.g. "OTP: AFS5HU", "verification code: 962180", "Kode Verifikasi: 123456")
  const labeledRegex =
    /(?:verification\s+code|confirmation\s+code|security\s+code|login\s+code|auth(?:entication)?\s+code|one-time\s+(?:password|passcode|code)|kode\s+(?:verifikasi|keamanan|konfirmasi|masuk|otp)|otp|pin|passcode)[\s:=#\-]+([a-z0-9]{4,8})\b/i;
  const matchLabeled = combined.match(labeledRegex);
  if (matchLabeled && matchLabeled[1]) {
    const candidate = matchLabeled[1].trim();
    const isPureAlpha = /^[a-zA-Z]+$/.test(candidate);
    if (!isPureAlpha || !COMMON_OTP_WORDS.has(candidate.toLowerCase())) {
      if (/\d/.test(candidate) || candidate === candidate.toUpperCase()) {
        return candidate;
      }
    }
  }

  // 4. Inverted pattern: "123456 is your verification / confirmation / login code"
  const invertedRegex =
    /\b([a-z0-9]{4,8})\b\s+(?:is\s+your|adalah\s+kode)\s+(?:[a-z0-9\s-]{0,25})?(?:verification|confirmation|login|security|otp|code|kode|verifikasi)/i;
  const matchInverted = combined.match(invertedRegex);
  if (matchInverted && matchInverted[1]) {
    const candidate = matchInverted[1].trim();
    if (!COMMON_OTP_WORDS.has(candidate.toLowerCase())) {
      if (/\d/.test(candidate) || candidate === candidate.toUpperCase()) {
        return candidate;
      }
    }
  }

  // 5. Contextual Proximity Check:
  // ONLY look for standalone codes if the email actually has explicit auth intent
  const bodyHasAuthIntent =
    /(?:verification\s+code|confirmation\s+code|one-time\s+password|kode\s+verifikasi|enter\s+the\s+following\s+code|use\s+this\s+code|security\s+code)/i.test(
      combined
    );
  if (subjHasAuthIntent || bodyHasAuthIntent) {
    const proximityRegex = /(?:code|kode|otp|verification|verifikasi|pin)[\s\S]{1,60}?\b(\d{4,8})\b/gi;
    let proxMatch: RegExpExecArray | null;
    while ((proxMatch = proximityRegex.exec(combined)) !== null) {
      const code = proxMatch[1];
      const val = parseInt(code, 10);
      if (val >= 1970 && val <= 2099) continue;

      const matchedSnippet = proxMatch[0];
      if (
        /(?:total|price|order|invoice|phone|tel|rp|idr|\$|€|usd|users|port)\s*[:#]?\s*\d/i.test(
          matchedSnippet
        )
      ) {
        continue;
      }
      return code;
    }
  }

  return null;
}

export function formatTelegramMessage(params: TelegramNotificationParams): string {
  const safeTo = escapeHtml(params.to).slice(0, 100);
  const safeFrom = escapeHtml(params.from).slice(0, 100);
  const safeSubject = escapeHtml(params.subject || '(No subject)').slice(0, 200);

  const otp = extractOtp(params.subject, params.body);
  const otpSection = otp
    ? `\n🔑 <b>OTP Code:</b> <code>${escapeHtml(otp)}</code>\n`
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
    `📬 <b>GhostBox — Incoming Message</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>From:</b> ${safeFrom}\n` +
    `📥 <b>To:</b> ${safeTo}\n` +
    `📌 <b>Subject:</b> ${safeSubject}\n` +
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

