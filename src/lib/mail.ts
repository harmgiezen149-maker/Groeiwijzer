import 'server-only';
import { Resend } from 'resend';

export const mailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

export function appUrl(path = '/'): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000');
  return new URL(path, base).toString();
}

export interface MailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Verstuurt een mail via Resend. Zonder sleutel gebeurt er niets kwaadaardigs:
 * de app meldt dat en toont bijvoorbeeld de uitnodigingslink zelf.
 */
export async function sendMail(input: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  if (!mailEnabled) {
    console.info(`[bloeiwijzer] mail niet verstuurd (geen Resend-sleutel): ${input.subject}`);
    return { sent: false, reason: 'Geen mailsleutel ingesteld' };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    console.error('[bloeiwijzer] mail mislukt', error);
    return { sent: false, reason: error.message };
  }
  return { sent: true };
}

/** Sobere opmaak, zelfde toon als de app: kort en actief. */
export function mailLayout(title: string, body: string): string {
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#fffbf2;color:#23372b;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3dac6;border-radius:14px;padding:24px;">
    <h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin:24px 0 0;font-size:12px;color:#8b978f;">Bloeiwijzer</p>
  </div>
</body></html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#d6246e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:14px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
