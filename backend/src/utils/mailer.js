const nodemailer = require('nodemailer');
const config = require('../config');
const { query } = require('../config/db');

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

function wrapHtml(title, inner) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#FF4D00;color:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;border:1px solid #ffffff;padding:28px;">
    <p style="letter-spacing:0.16em;font-size:12px;margin:0 0 12px;">BOOK'D HAUS</p>
    <h1 style="margin:0 0 16px;font-size:22px;text-transform:uppercase;">${escapeHtml(title)}</h1>
    <div style="font-size:15px;line-height:1.55;">${inner}</div>
  </div>
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
  return `<p style="margin:20px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 18px;background:#C6FF00;color:#09000F;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(label)}</a></p>`;
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
