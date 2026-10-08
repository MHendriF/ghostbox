import type { Message } from './types';

export function parseDate(raw?: string): Date {
  if (!raw) return new Date();
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatRelativeTime(raw?: string): string {
  if (!raw) return '';
  const d = parseDate(raw);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export function formatTimestamp(raw?: string): string {
  if (!raw) return '';
  const d = parseDate(raw);
  return d.toLocaleString();
}

/**
 * Accurately detects true HTML markup in email bodies.
 * Avoids false positives on email addresses like `<user@example.com>` or `<john>`.
 */
export function isHtmlContent(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const htmlTagRegex = /<\/?(?:!doctype|html|head|body|table|thead|tbody|tfoot|tr|td|th|div|p|span|style|br|hr|a|img|ul|ol|li|h[1-6]|blockquote|pre|code|section|header|footer|font|center|b|i|u|strong|em)\b/i;
  return htmlTagRegex.test(content);
}

export function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ');
}

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts URLs in plain text into clickable safe anchor tags.
 * Safely handles query strings with `&` and prevents XSS by escaping HTML entities.
 */
export function linkifyText(text: string): string {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+)/gi;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    }
    const rawUrl = match[1];
    let cleanUrl = rawUrl;
    let trailingPunct = '';
    while (/[.,;:!?)\]]$/.test(cleanUrl)) {
      trailingPunct = cleanUrl.slice(-1) + trailingPunct;
      cleanUrl = cleanUrl.slice(0, -1);
    }
    const safeHref = escapeHtml(cleanUrl);
    parts.push(
      `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="email-inline-link">${safeHref}</a>${escapeHtml(trailingPunct)}`
    );
    lastIndex = match.index + rawUrl.length;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.slice(lastIndex)));
  }

  return parts.join('');
}

export interface EmailQuoteItem {
  depth: number;
  text: string;
}

export interface ParsedEmailThread {
  mainText: string;
  hasQuotes: boolean;
  attribution?: string;
  quoteItems: EmailQuoteItem[];
  rawQuotedText: string;
}

/**
 * Parses plain-text email bodies to separate fresh reply content
 * from nested quote chains (`>`, `>>`, `On ... wrote:`, `Pada ... menulis:`).
 */
export function parseEmailThread(body: string): ParsedEmailThread {
  if (!body) {
    return {
      mainText: '',
      hasQuotes: false,
      quoteItems: [],
      rawQuotedText: '',
    };
  }

  const lines = body.split(/\r?\n/);
  const mainLines: string[] = [];
  const quoteLines: string[] = [];
  let foundQuoteStart = false;
  let attribution = '';

  const attributionRegex = /^(?:On\s.+?wrote:|Pada\s.+?menulis:|---+ ?(?:Original Message|Pesan Asli) ?---+|_{10,}|From:\s.+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!foundQuoteStart) {
      if (trimmed.startsWith('>')) {
        foundQuoteStart = true;
        quoteLines.push(line);
        continue;
      }

      if (attributionRegex.test(trimmed)) {
        let nextHasQuote = false;
        for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed.startsWith('>') || attributionRegex.test(nextTrimmed)) {
            nextHasQuote = true;
            break;
          }
        }
        if (nextHasQuote || trimmed.endsWith(':')) {
          foundQuoteStart = true;
          attribution = trimmed;
          quoteLines.push(line);
          continue;
        }
      }

      mainLines.push(line);
    } else {
      quoteLines.push(line);
    }
  }

  const hasQuotes = foundQuoteStart && quoteLines.length > 0;
  const quoteItems: EmailQuoteItem[] = [];

  if (hasQuotes) {
    for (const qLine of quoteLines) {
      const matchDepth = qLine.match(/^([>\s]+)/);
      if (matchDepth) {
        const depth = (matchDepth[1].match(/>/g) || []).length;
        const text = qLine.replace(/^[>\s]+/, '');
        quoteItems.push({ depth: Math.max(depth, 1), text });
      } else {
        quoteItems.push({ depth: 1, text: qLine });
      }
    }
  }

  const mainText = mainLines.join('\n').trim();
  const rawQuotedText = quoteLines.join('\n').trim();

  // If message only contains quotes, keep it in mainText to avoid rendering a blank box
  if (!mainText && rawQuotedText) {
    return {
      mainText: rawQuotedText,
      hasQuotes: false,
      quoteItems: [],
      rawQuotedText: '',
    };
  }

  return {
    mainText,
    hasQuotes,
    attribution,
    quoteItems,
    rawQuotedText,
  };
}

/**
 * Prepares raw HTML email content for sandboxed iframe rendering:
 * - Injects `<base target="_blank">` so links open in external tabs
 * - Injects clean typography and responsive styling
 * - Styles nested quote elements (Gmail, Outlook, Apple Mail)
 */
export function prepareEmailHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  // 1. Strip script tags
  let cleaned = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Strip inline javascript event handlers
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  const injectedStyles = `
<base target="_blank">
<style>
  html, body {
    margin: 0 !important;
    padding: 16px !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.6 !important;
    color: #1e293b !important;
    background-color: #ffffff !important;
    overflow-wrap: break-word !important;
    word-break: break-word !important;
  }
  a {
    color: #3b82f6 !important;
    text-decoration: underline !important;
  }
  img {
    max-width: 100% !important;
    height: auto !important;
  }
  table {
    max-width: 100% !important;
  }
  .gmail_quote, .gmail_extra, blockquote, #divRplyFwdMsg, [class*="quote"] {
    border-left: 2px solid #94a3b8 !important;
    padding-left: 12px !important;
    margin: 12px 0 12px 4px !important;
    color: #475569 !important;
    background: #f8fafc !important;
    border-radius: 0 4px 4px 0 !important;
  }
</style>
`;

  if (/<head\b[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<head\b[^>]*>/i, `$&${injectedStyles}`);
  } else if (/<html\b[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/<html\b[^>]*>/i, `$&<head>${injectedStyles}</head>`);
  } else {
    cleaned = `<head>${injectedStyles}</head>${cleaned}`;
  }

  return cleaned;
}

export function extractOtp(subject = '', body = ''): string | null {
  const text = `${subject} ${stripHtml(body)}`.replace(/\s+/g, ' ');

  // Match labeled code/otp
  const labeledRegex = /(?:code|otp|verification|pin|kode|verifikasi|token)[\s:=#\-]+([a-z0-9]{4,8})\b/i;
  const matchLabeled = text.match(labeledRegex);
  if (matchLabeled && matchLabeled[1]) {
    return matchLabeled[1];
  }

  // Match standalone 6-8 digit numeric code
  const standalone6to8 = /\b(\d{6,8})\b/;
  const match6to8 = text.match(standalone6to8);
  if (match6to8 && match6to8[1]) {
    return match6to8[1];
  }

  // Match standalone 4-5 digit numeric code (filtering out common years 1970-2099)
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

export function downloadEml(msg: Message, currentInboxAddress = ''): void {
  const d = parseDate(msg.received_at);
  const dateStr = isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
  const isHtml = isHtmlContent(msg.body || '');
  const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';

  const cleanFrom = (msg.from_address || 'unknown').replace(/[\r\n]+/g, ' ').trim();
  const cleanTo = (msg.inbox_address || currentInboxAddress).replace(/[\r\n]+/g, ' ').trim();
  const cleanSubject = (msg.subject || '(No Subject)').replace(/[\r\n]+/g, ' ').trim();

  const lines = [
    `From: ${cleanFrom}`,
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    `Date: ${dateStr}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}`,
    `Content-Transfer-Encoding: 8bit`,
    `X-Mailer: GhostBox Disposable Mail`,
    '',
    msg.body || '',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const cleanSubj = (msg.subject || 'message')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 30);
  a.href = url;
  a.download = `${cleanSubj}_${msg.id}.eml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg, #4f46e5, #6366f1)', border: '#818cf8', text: '#ffffff' }, // Indigo
  { bg: 'linear-gradient(135deg, #0d9488, #14b8a6)', border: '#2dd4bf', text: '#ffffff' }, // Teal
  { bg: 'linear-gradient(135deg, #d97706, #f59e0b)', border: '#fbbf24', text: '#ffffff' }, // Amber
  { bg: 'linear-gradient(135deg, #e11d48, #f43f5e)', border: '#fb7185', text: '#ffffff' }, // Rose
  { bg: 'linear-gradient(135deg, #0284c7, #38bdf8)', border: '#7dd3fc', text: '#ffffff' }, // Sky
  { bg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', border: '#a78bfa', text: '#ffffff' }, // Violet
  { bg: 'linear-gradient(135deg, #059669, #10b981)', border: '#34d399', text: '#ffffff' }, // Emerald
  { bg: 'linear-gradient(135deg, #c026d3, #d946ef)', border: '#e879f9', text: '#ffffff' }, // Fuchsia
];

/**
 * Generates a deterministic high-contrast gradient palette based on sender identifier.
 */
export function getAvatarStyle(sender = ''): { background: string; borderColor: string; color: string } {
  const norm = (sender || '?').toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash << 5) - hash + norm.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  const p = AVATAR_PALETTES[index];
  return {
    background: p.bg,
    borderColor: p.border,
    color: p.text,
  };
}

/**
 * Plays a gentle, pleasant synthetic chime using Web Audio API when new emails arrive.
 * Zero external audio files or network latency.
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880, now + 0.12); // A5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch {
    // Audio context may be suspended or blocked by user gesture policy
  }
}
