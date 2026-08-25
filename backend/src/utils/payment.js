const crypto = require('crypto');
const { query } = require('../config/db');
const { isPaidPlan, planLabel } = require('./subscription');

const PLAN_AMOUNTS = {
  basic: 6.99,
  premium: 14.99,
};

const WHISH_RECIPIENT = {
  display: '+961 3 177 655',
  copy: '+961 3 177 655',
  digits: '+9613177655',
};

function generateReference() {
  return `BKD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function planAmount(membership) {
  return PLAN_AMOUNTS[membership] || PLAN_AMOUNTS.basic;
}

function mapPayment(row) {
  if (!row) return null;
  return {
    ...row,
    amount: Number(row.amount),
    plan_label: planLabel(row.plan),
  };
}

function instructionsFor(user, payment) {
  return {
    method: 'whish_p2p',
    recipient: WHISH_RECIPIENT,
    amount: planAmount(user.membership),
    currency: 'USD',
    plan: user.membership,
    plan_label: planLabel(user.membership),
    payment: mapPayment(payment),
  };
}

async function loadOpenPayment(userId) {
  const result = await query(
    `SELECT *
     FROM subscription_payments
     WHERE user_id = $1 AND status IN ('awaiting', 'pending')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function latestConfirmedPayment(userId) {
  const result = await query(
    `SELECT *
     FROM subscription_payments
     WHERE user_id = $1 AND status = 'confirmed'
     ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function hasConfirmedPayment(userId) {
  const result = await query(
    `SELECT 1 FROM subscription_payments WHERE user_id = $1 AND status = 'confirmed' LIMIT 1`,
    [userId]
  );
  return !!result.rows[0];
}

async function markPaymentsApplied(userId, exec = query) {
  await exec(
    `UPDATE subscription_payments
     SET period_applied = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND status = 'confirmed' AND period_applied = FALSE`,
    [userId]
  );
}

async function ensureOpenPayment(user) {
  if (!user?.id || !isPaidPlan(user.membership)) return null;

  const confirmed = await latestConfirmedPayment(user.id);
  if (confirmed && user.approval_status !== 'approved') {
    return confirmed;
  }

  const existing = await loadOpenPayment(user.id);
  if (existing) return existing;

  const created = await query(
    `INSERT INTO subscription_payments
       (user_id, plan, amount, currency, method, recipient_number, reference, status)
     VALUES ($1, $2, $3, 'USD', 'whish_p2p', $4, $5, 'awaiting')
     RETURNING *`,
    [user.id, user.membership, planAmount(user.membership), WHISH_RECIPIENT.display, generateReference()]
  );
  return created.rows[0];
}

function paymentEmailLines(user, payment) {
  const amount = Number(payment?.amount || planAmount(user.membership)).toFixed(2);
  const reference = payment?.reference;
  return [
    'Pay with Whish to Whish:',
    `1. Open the Whish app and choose Whish to Whish.`,
    `2. Send $${amount} USD (${planLabel(user.membership)}) to ${WHISH_RECIPIENT.display}.`,
    reference
      ? `3. Put this exact reference in the transfer note: ${reference}`
      : '3. After you log in, your Pay page will show a unique reference to put in the transfer note.',
    '4. Open Pay in your dashboard, enter the Whish number you sent from, and tap I sent the payment.',
  ];
}

module.exports = {
  PLAN_AMOUNTS,
  WHISH_RECIPIENT,
  generateReference,
  planAmount,
  mapPayment,
  instructionsFor,
  loadOpenPayment,
  latestConfirmedPayment,
  hasConfirmedPayment,
  markPaymentsApplied,
  ensureOpenPayment,
  paymentEmailLines,
};
