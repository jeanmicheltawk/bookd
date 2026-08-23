const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('../config');
const { query } = require('../config/db');

const LOGO_CID = 'bookdhaus-logo';
const logoPath = path.join(__dirname, '../assets/logo-email.png');
const logoExists = fs.existsSync(logoPath);

function createTransport() {
  if (!config.mail.user || !config.mail.pass) {
    console.warn('[mail] SMTP is not configured. Emails will be skipped.');
    return null;
  }
  return nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.port === 465,
    requireTLS: config.mail.port === 587,
    auth: {
      user: config.mail.user,
      pass: config.mail.pass,
    },
  });
}

const transport = createTransport();

function mailErrorHint(err) {
  const message = err?.message || String(err);
  if (/SmtpClientAuthentication is disabled/i.test(message)) {
    return `${message}\n[mail] SMTP AUTH is still off for the GoDaddy Microsoft 365 tenant. In productivity.godaddy.com: Admin → Advanced → sign in to Exchange. Settings → Mail flow → turn OFF "Turn off SMTP AUTH protocol for your organization". Also open info@bookdhaus.com → Account information → Advanced Settings → SMTP Authentication ON.`;
  }
  if (/Username and Password not accepted|BadCredentials/i.test(message)) {
    return `${message}\n[mail] Login was rejected. Check SMTP_USER / SMTP_PASS, or use an app password.`;
  }
  return message;
}

if (transport) {
  transport.verify().then(() => {
    console.log(`[mail] SMTP ready (${config.mail.host}) as ${config.mail.user}`);
  }).catch((err) => {
    console.error('[mail] SMTP login failed:', mailErrorHint(err));
  });
}

function logoHtml() {
  const src = logoExists ? `cid:${LOGO_CID}` : `${config.appUrl}/assets/logo-full-ink.svg`;
  return `<img src="${src}" alt="BOOK'D" width="168" style="display:block;width:168px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

function wrapHtml(title, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 24px 48px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 0 32px;">
              ${logoHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding:0;font-size:15px;line-height:1.65;color:#222222;">
              <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:400;color:#111111;">${escapeHtml(title)}</h1>
              ${inner}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(text) {
  return `<p style="margin:0 0 12px;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function cta(href, label) {
  return `<p style="margin:24px 0 0;"><a href="${escapeHtml(href)}" style="color:#111111;text-decoration:underline;">${escapeHtml(label)}</a></p>`;
}

function logoAttachment() {
  if (!logoExists) return [];
  return [{
    filename: 'logo.png',
    path: logoPath,
    cid: LOGO_CID,
    contentDisposition: 'inline',
    contentType: 'image/png',
  }];
}

function dashboardUrl(path) {
  const base = config.appUrl.replace(/\/$/, '');
  const suffix = path?.startsWith('/') ? path : `/${path || 'dashboard'}`;
  return `${base}${suffix}`;
}

async function sendEmail({ to, subject, text, html }) {
  if (!transport || !to) return false;
  if (String(to).toLowerCase().endsWith('@bookd.demo')) return false;
  try {
    await transport.sendMail({
      from: `"BOOK'D HAUS" <${config.mail.from}>`,
      to,
      subject,
      text,
      html: html || wrapHtml(subject, paragraph(text)),
      attachments: logoAttachment(),
    });
    return true;
  } catch (err) {
    console.error('[mail] failed:', mailErrorHint(err));
    return false;
  }
}

async function emailAdmin(subject, text, extraHtml = '') {
  return sendEmail({
    to: config.mail.notifyTo,
    subject,
    text,
    html: wrapHtml(subject, paragraph(text) + extraHtml),
  });
}

async function emailUser(userId, subject, text, path) {
  const result = await query(
    `SELECT email FROM users WHERE id = $1 AND is_active = TRUE`,
    [userId]
  );
  const email = result.rows[0]?.email;
  if (!email) return false;
  const url = dashboardUrl(path || '/dashboard');
  return sendEmail({
    to: email,
    subject,
    text: `${text}\n\nOpen: ${url}`,
    html: wrapHtml(subject, paragraph(text) + cta(url, 'Open dashboard')),
  });
}

module.exports = {
  sendEmail,
  emailAdmin,
  emailUser,
  wrapHtml,
  paragraph,
  cta,
  dashboardUrl,
  escapeHtml,
};
