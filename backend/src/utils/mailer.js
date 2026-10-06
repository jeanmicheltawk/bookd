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
  const src = logoExists ? `cid:${LOGO_CID}` : `${config.emailAppUrl || config.appUrl}/assets/logo.svg`;
  return `<img src="${src}" alt="BOOK'D" width="220" style="display:block;width:220px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

function wrapHtml(title, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@800&family=Manrope:wght@500;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ff4d00;color:#ffffff;" bgcolor="#ff4d00">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ff4d00" style="background:#ff4d00;">
    <tr>
      <td align="center" style="padding:40px 20px 48px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 0 22px;border-bottom:1px solid #ffffff;">
              ${logoHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;font-family:'Manrope',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#ffffff;">
              <p style="margin:0 0 12px;font-family:'Archivo Narrow','Arial Narrow',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c6ff00;">BOOK'D HAUS</p>
              <h1 style="margin:0 0 18px;font-family:'League Spartan','Arial Narrow',Arial,sans-serif;font-size:32px;line-height:0.92;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;color:#ffffff;">${escapeHtml(title)}</h1>
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
  return `<p style="margin:0 0 14px;font-family:'Manrope',Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;font-weight:500;color:#ffffff;">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function cta(href, label) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;">
    <tr>
      <td bgcolor="#c6ff00" style="background:#c6ff00;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;font-family:'Manrope',Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;color:#09000f;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
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
  const base = (config.emailAppUrl || config.appUrl).replace(/\/$/, '');
  const suffix = path?.startsWith('/') ? path : `/${path || 'dashboard'}`;
  return `${base}${suffix}`;
}

async function sendEmail({ to, subject, text, html }) {
  if (!transport || !to) return false;
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

async function emailUser(userId, subject, text, path, ctaLabel) {
  const result = await query(
    `SELECT email FROM users WHERE id = $1 AND is_active = TRUE`,
    [userId]
  );
  const email = result.rows[0]?.email;
  if (!email) return false;
  const url = dashboardUrl(path || '/dashboard');
  const label = ctaLabel || 'Open dashboard';
  return sendEmail({
    to: email,
    subject,
    text: `${text}\n\nOpen: ${url}`,
    html: wrapHtml(subject, paragraph(text) + cta(url, label)),
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
