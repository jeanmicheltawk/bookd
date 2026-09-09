const config = require('../config');

const BASE_URLS = {
  sandbox: 'https://partner.api.sbx.whish.money/itel-service/api',
  production: 'https://api.whish.money/itel-service/api',
};

const SANDBOX_TEST = {
  phone: '96170123456',
  otp: '111111',
};

function isConfigured() {
  return Boolean(config.whish.channel && config.whish.secret && config.whish.websiteUrl);
}

function isSandbox() {
  return config.whish.env !== 'production';
}

function baseUrl() {
  return BASE_URLS[isSandbox() ? 'sandbox' : 'production'];
}

function isPublicHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host.endsWith('.local') || host.endsWith('.internal')) return false;
    return true;
  } catch {
    return false;
  }
}

function requirePublicUrl(value, label) {
  if (!isPublicHttpUrl(value)) {
    const err = new Error(
      `${label} must be a public http(s) URL. Whish rejects localhost. Set APP_URL and API_PUBLIC_URL to public HTTPS URLs (a tunnel is fine while testing).`
    );
    err.status = 400;
    throw err;
  }
}

function headers() {
  if (!isConfigured()) {
    const err = new Error('Whish Pay is not configured. Set WHISH_CHANNEL, WHISH_SECRET, and WHISH_WEBSITE_URL.');
    err.status = 503;
    throw err;
  }
  return {
    channel: config.whish.channel,
    secret: config.whish.secret,
    websiteUrl: config.whish.websiteUrl,
    'User-Agent': config.whish.userAgent,
    'Content-Type': 'application/json',
  };
}

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function publicApiUrl() {
  return (config.apiPublicUrl || '').replace(/\/$/, '');
}

function publicAppUrl() {
  return (config.appUrl || '').replace(/\/$/, '');
}

function callbackUrls(externalId) {
  const api = publicApiUrl();
  const app = publicAppUrl();
  requirePublicUrl(api, 'API_PUBLIC_URL');
  requirePublicUrl(app, 'APP_URL');
  const ref = encodeURIComponent(externalId);
  return {
    successCallbackUrl: `${api}/api/payments/whish/callback/success?externalId=${ref}`,
    failureCallbackUrl: `${api}/api/payments/whish/callback/failure?externalId=${ref}`,
    successRedirectUrl: `${app}/dashboard/pay?whish=success&ref=${ref}`,
    failureRedirectUrl: `${app}/dashboard/pay?whish=failed&ref=${ref}`,
  };
}

async function whishFetch(path, { method = 'GET', body } = {}) {
  const url = `${baseUrl()}${path}`;
  const init = { method, headers: headers() };
  if (body != null) init.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    const wrapped = new Error('Could not reach Whish Pay. Try again in a moment.');
    wrapped.status = 502;
    wrapped.cause = err;
    throw wrapped;
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (response.status === 403) {
    const err = new Error(
      'Whish rejected the request (403). Callback and redirect URLs cannot be localhost, and websiteUrl must match the value they issued.'
    );
    err.status = 502;
    throw err;
  }

  if (!payload || typeof payload !== 'object') {
    const err = new Error(`Whish Pay returned an unexpected response (${response.status}).`);
    err.status = 502;
    throw err;
  }

  if (payload.status === true) {
    return payload;
  }

  if (payload.code === '500' || payload.code === 500) {
    const err = new Error('Whish Pay is still processing this request. Check the payment status in a moment.');
    err.status = 409;
    err.code = '500';
    throw err;
  }

  const dialog = payload.dialog?.message || payload.dialog?.title;
  const err = new Error(dialog || `Whish Pay error (${payload.code || response.status}).`);
  err.status = 400;
  err.code = payload.code;
  throw err;
}

async function createPayment({ amount, currency = 'USD', invoice, externalId }) {
  const urls = callbackUrls(externalId);
  return whishFetch('/payment/whish', {
    method: 'POST',
    body: {
      amount: formatAmount(amount),
      currency,
      invoice: invoice || `BOOK'D HAUS ${externalId}`,
      externalId: String(externalId),
      ...urls,
    },
  });
}

async function getPaymentStatus({ currency = 'USD', externalId }) {
  return whishFetch('/payment/collect/status', {
    method: 'POST',
    body: {
      currency,
      externalId: String(externalId),
    },
  });
}

module.exports = {
  SANDBOX_TEST,
  isConfigured,
  isSandbox,
  formatAmount,
  createPayment,
  getPaymentStatus,
};
