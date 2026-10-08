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

  if (diffSec < 45) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}j lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}h lalu`;
  return d.toLocaleDateString();
}

export function formatTimestamp(raw?: string): string {
  if (!raw) return '';
  const d = parseDate(raw);
  return d.toLocaleString();
}

export function isHtmlContent(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content || '');
}

export function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ');
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
  const cleanSubj = (msg.subject || 'pesan')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 30);
  a.href = url;
  a.download = `${cleanSubj}_${msg.id}.eml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
