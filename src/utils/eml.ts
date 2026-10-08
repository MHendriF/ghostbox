/**
 * GhostBox - EML Formatter Utility
 * Formats message data into standard RFC 5322 / RFC 822 MIME format.
 */

export interface EmlParams {
  id?: string;
  from: string;
  to: string;
  subject: string;
  date?: string | Date;
  body: string;
}

export function generateEml(params: EmlParams): string {
  const d = params.date ? new Date(params.date) : new Date();
  const dateStr = isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
  const isHtml = /<[a-z][\s\S]*>/i.test(params.body || '');
  const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';

  const cleanFrom = (params.from || '').replace(/[\r\n]+/g, ' ').trim();
  const cleanTo = (params.to || '').replace(/[\r\n]+/g, ' ').trim();
  const cleanSubject = (params.subject || '(No Subject)').replace(/[\r\n]+/g, ' ').trim();

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
    params.body || '',
  ];

  return lines.join('\r\n');
}
