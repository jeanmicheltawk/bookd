const crypto = require('crypto');
const { query, getClient } = require('../config/db');
const { isPaidPlan, planLabel, isComplimentary, isPaymentDue, extendPaidPeriod, startPaidPeriod, clearPaidPeriod, applyPremiumUpgrade, daysRemainingExact } = require('./subscription');
const { notify } = require('./notify');
const { emailAdmin, dashboardUrl, cta } = require('./mailer');
const whishPay = require('./whishPay');

const PLAN_AMOUNTS = {
  basic: 6.99,
  premium: 14.99,
};

const UPGRADE_TOPUP_AMOUNT = 8;
const UPGRADE_WINDOW_DAYS = 7;
const UPGRADE_PURPOSES = ['upgrade_topup', 'upgrade_full'];

function generateReference() {
  return `BKD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function planAmount(membership) {
  return PLAN_AMOUNTS[membership] || PLAN_AMOUNTS.basic;
}

function isUpgradePurpose(purpose) {
  return UPGRADE_PURPOSES.includes(purpose);
}

function upgradeQuote(user, { hasPaid } = {}) {
  if (!user || user.role !== 'member' || user.membership !== 'basic' || isComplimentary(user)) {
    return null;
  }
  if (user.approval_status && user.approval_status !== 'approved' && user.approval_status !== 'pending') {
    return null;
  }

  let purpose = 'upgrade_full';
  let amount = PLAN_AMOUNTS.premium;
  const days = daysRemainingExact(user.membership_ends_at);

  if (user.approval_status === 'pending') {
    if (hasPaid) {
      purpose = 'upgrade_topup';
      amount = UPGRADE_TOPUP_AMOUNT;
    }
  } else if (days != null && days > 0 && days < UPGRADE_WINDOW_DAYS) {
    purpose = 'upgrade_topup';
    amount = UPGRADE_TOPUP_AMOUNT;
  }

  const isTopup = purpose === 'upgrade_topup';
  const now = new Date();
  const currentEnd = user.membership_ends_at ? new Date(user.membership_ends_at) : null;
  let nextPaidUntil = null;
  if (user.approval_status === 'approved') {
    if (isTopup && currentEnd) {
      nextPaidUntil = currentEnd;
    } else {
      const oneMonth = new Date(now);
      oneMonth.setMonth(oneMonth.getMonth() + 1);
      nextPaidUntil = currentEnd && currentEnd > oneMonth ? currentEnd : oneMonth;
    }
  }
  const cutoff = currentEnd
    ? new Date(currentEnd.getTime() - UPGRADE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const renewalOpens = nextPaidUntil
    ? new Date(nextPaidUntil.getTime() - 5 * 24 * 60 * 60 * 1000)
    : null;

  return {
    available: true,
    kind: isTopup ? 'topup' : 'full',
    purpose,
    amount,
    currency: 'USD',
    plan: 'premium',
    plan_label: 'Premium plan',
    days_remaining: days == null ? null : Math.max(0, Math.ceil(days)),
    paid_until: user.membership_ends_at || null,
    next_paid_until: nextPaidUntil ? nextPaidUntil.toISOString() : null,
    renewal_opens_at: renewalOpens ? renewalOpens.toISOString() : null,
    upgrade_cutoff_at: cutoff ? cutoff.toISOString() : null,
    summary: isTopup
      ? 'Pay $8.00 to complete Premium for this period. Your paid-until date stays the same. Next renewal is $14.99.'
      : 'Pay $14.99 for a full Premium month. Premium starts as soon as Whish confirms.',
  };
}

function mapPayment(row) {
  if (!row) return null;
  const purpose = row.purpose || 'renewal';
  const label = isUpgradePurpose(purpose)
    ? `${planLabel(row.plan)} upgrade`
    : planLabel(row.plan);
  return {
    ...row,
    amount: Number(row.amount),
    purpose,
    plan_label: label,
  };
}

function instructionsFor(user, payment, extra = {}) {
  return {
    method: 'whish_pay',
    amount: planAmount(user.membership),
    currency: 'USD',
    plan: user.membership,
    plan_label: planLabel(user.membership),
    payment: mapPayment(payment),
    collect_url: payment?.collect_url || null,
    sandbox: whishPay.isSandbox(),
    sandbox_test: whishPay.isSandbox() ? whishPay.SANDBOX_TEST : null,
    configured: whishPay.isConfigured(),
    payment_due: isPaymentDue(user),
    paid_until: user.membership_ends_at || null,
    started_at: user.membership_started_at || null,
    trial_ends_at: user.membership_trial_ends_at || null,
    upgrade: extra.upgrade || null,
  };
}

async function withUpgradeInstructions(user, payment) {
  if (!user) return instructionsFor(user, payment);
  const hasPaid = await hasConfirmedPayment(user.id);
  const quote = upgradeQuote(user, { hasPaid });
  if (!quote) return instructionsFor(user, payment, { upgrade: null });

  const openIsUpgrade = payment && isUpgradePurpose(payment.purpose);
  return instructionsFor(user, payment, {
    upgrade: {
      ...quote,
      payment: openIsUpgrade ? mapPayment(payment) : null,
    },
  });
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

async function loadPaymentByReference(reference) {
  if (!reference) return null;
  const result = await query(
    `SELECT * FROM subscription_payments WHERE reference = $1 LIMIT 1`,
    [reference]
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

async function closeOpenPayments(userId, exec = query, note = 'Closed: complimentary profile — payment not required') {
  await exec(
    `UPDATE subscription_payments
     SET status = 'rejected',
         review_note = COALESCE(review_note, $2),
         reviewed_at = COALESCE(reviewed_at, NOW()),
         updated_at = NOW()
     WHERE user_id = $1 AND status IN ('awaiting', 'pending')`,
    [userId, note]
  );
}

async function closePrematurePayments(userId, exec = query) {
  await exec(
    `UPDATE subscription_payments
     SET status = 'rejected',
         review_note = COALESCE(review_note, 'Closed: next payment is not due yet'),
         reviewed_at = COALESCE(reviewed_at, NOW()),
         updated_at = NOW()
     WHERE user_id = $1 AND status = 'awaiting' AND collect_url IS NULL
       AND COALESCE(purpose, 'renewal') = 'renewal'`,
    [userId]
  );
}

async function ensureOpenPayment(user) {
  if (!user?.id || !isPaidPlan(user.membership) || isComplimentary(user)) return null;

  const existing = await loadOpenPayment(user.id);
  if (existing) return existing;

  const confirmed = await latestConfirmedPayment(user.id);
  if (confirmed && user.approval_status !== 'approved') {
    return confirmed;
  }

  if (!isPaymentDue(user)) {
    return confirmed || null;
  }

  const created = await query(
    `INSERT INTO subscription_payments
       (user_id, plan, amount, currency, method, recipient_number, reference, status, purpose)
     VALUES ($1, $2, $3, 'USD', 'whish_pay', 'whish_pay', $4, 'awaiting', 'renewal')
     RETURNING *`,
    [user.id, user.membership, planAmount(user.membership), generateReference()]
  );
  return created.rows[0];
}

function paymentEmailLines(user, payment) {
  const amount = Number(payment?.amount || planAmount(user.membership)).toFixed(2);
  return [
    `Pay $${amount} USD for ${planLabel(user.membership)} with Whish Pay.`,
    'Log in, open Pay in your dashboard, and tap Pay with Whish.',
    'Whish opens a hosted page where you confirm the payment from your Whish balance.',
  ];
}

async function loadMemberForPayment(userId, exec = query) {
  const member = await exec(
    `SELECT u.id, u.email, u.membership, u.approval_status, u.membership_ends_at,
            p.full_name, p.professional_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return member.rows[0] || null;
}

async function applyPaymentDecision(paymentRow, nextStatus, {
  reviewedBy = null,
  reviewNote = null,
  payerPhone = null,
  collectStatus = null,
} = {}) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT * FROM subscription_payments WHERE id = $1 FOR UPDATE`,
      [paymentRow.id]
    );
    const current = locked.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return { error: 'Payment not found', status: 404 };
    }
    if (current.status === 'confirmed' && nextStatus === 'confirmed') {
      await client.query('COMMIT');
      const member = await loadMemberForPayment(current.user_id);
      return { payment: { ...member, ...current }, already: true };
    }
    if (current.status !== 'pending' && current.status !== 'awaiting') {
      await client.query('ROLLBACK');
      return { error: 'This payment was already reviewed.', status: 409 };
    }

    const member = await loadMemberForPayment(current.user_id, client.query.bind(client));
    const row = { ...current, ...member };
    const purpose = current.purpose || 'renewal';
    const upgrade = isUpgradePurpose(purpose);
    const periodApplied = nextStatus === 'confirmed' && row.approval_status === 'approved';

    const updated = await client.query(
      `UPDATE subscription_payments
       SET status = $1,
           reviewed_at = NOW(),
           reviewed_by = $2,
           review_note = $3,
           period_applied = $4,
           sender_whish_number = COALESCE($5, sender_whish_number),
           payer_phone = COALESCE($5, payer_phone),
           collect_status = COALESCE($6, collect_status),
           submitted_at = COALESCE(submitted_at, NOW()),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [nextStatus, reviewedBy, reviewNote, periodApplied, payerPhone, collectStatus, current.id]
    );

    const exec = client.query.bind(client);
    if (nextStatus === 'confirmed' && upgrade) {
      await applyPremiumUpgrade(row.user_id, purpose, exec);
      if (row.approval_status === 'approved') {
        await markPaymentsApplied(row.user_id, exec);
      }
    } else if (nextStatus === 'confirmed' && row.approval_status === 'approved') {
      if (row.membership_ends_at) {
        await extendPaidPeriod(row.user_id, exec);
      } else {
        await startPaidPeriod(row.user_id, exec);
      }
      await markPaymentsApplied(row.user_id, exec);
    } else if (nextStatus === 'confirmed' && row.approval_status !== 'approved') {
      await clearPaidPeriod(row.user_id, exec);
    }

    await client.query('COMMIT');
    const payment = mapPayment({ ...row, ...updated.rows[0] });

    const plan = isUpgradePurpose(purpose) ? 'Premium plan upgrade' : planLabel(row.plan);
    if (nextStatus === 'confirmed') {
      const body = upgrade
        ? row.approval_status === 'approved'
          ? 'Your Premium upgrade is confirmed. You are now on the Premium plan.'
          : 'Your Premium upgrade is confirmed. Premium starts when an admin approves your profile.'
        : row.approval_status === 'approved'
          ? `Your Whish payment for ${plan} was confirmed. Your subscription has been extended by 1 month.`
          : `Your Whish payment for ${plan} was confirmed. Your 7-day free trial starts when an admin approves your profile.`;
      void notify(row.user_id, upgrade ? 'Premium upgrade confirmed' : 'Payment confirmed', body, '/dashboard');
    } else if (nextStatus === 'rejected') {
      void notify(
        row.user_id,
        'Payment not completed',
        `Your Whish payment for ${plan} did not go through. Open Pay and try again.`,
        '/dashboard/pay'
      );
    }

    return { payment };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

async function storeCollectUrl(paymentId, collectUrl) {
  const updated = await query(
    `UPDATE subscription_payments
     SET collect_url = $1,
         method = 'whish_pay',
         recipient_number = 'whish_pay',
         status = CASE WHEN status = 'awaiting' THEN 'pending' ELSE status END,
         submitted_at = COALESCE(submitted_at, NOW()),
         collect_status = COALESCE(collect_status, 'pending'),
         updated_at = NOW()
     WHERE id = $2 AND status IN ('awaiting', 'pending')
     RETURNING *`,
    [collectUrl, paymentId]
  );
  return updated.rows[0] || null;
}

async function createWhishCheckout(payment) {
  if (!payment) {
    const err = new Error('Only Starter and Premium members can pay with Whish.');
    err.status = 400;
    throw err;
  }
  if (payment.status === 'confirmed') return payment;

  if (payment.collect_url && payment.status === 'pending') {
    const synced = await reconcilePaymentWithWhish(payment);
    if (synced?.status === 'confirmed' || synced?.collect_url) return synced;
  }

  const invoice = isUpgradePurpose(payment.purpose)
    ? `BOOK'D HAUS Premium upgrade`
    : `BOOK'D HAUS ${planLabel(payment.plan)}`;
  const created = await whishPay.createPayment({
    amount: Number(payment.amount),
    currency: payment.currency || 'USD',
    invoice,
    externalId: payment.reference,
  });
  const collectUrl = created?.data?.collectUrl;
  if (!collectUrl) {
    const err = new Error('Whish Pay did not return a payment page. Try again.');
    err.status = 502;
    throw err;
  }

  const stored = await storeCollectUrl(payment.id, collectUrl);
  return stored || { ...payment, collect_url: collectUrl, status: 'pending' };
}

async function createCheckout(user) {
  return createWhishCheckout(await ensureOpenPayment(user));
}

async function startUpgradeCheckout(user) {
  const hasPaid = await hasConfirmedPayment(user.id);
  const quote = upgradeQuote(user, { hasPaid });
  if (!quote) {
    const err = new Error('Only Starter plan members can upgrade to Premium.');
    err.status = 400;
    throw err;
  }

  let payment = await loadOpenPayment(user.id);
  const matches = payment
    && payment.purpose === quote.purpose
    && Number(payment.amount) === Number(quote.amount);

  if (payment && !matches) {
    await closeOpenPayments(user.id, query, 'Closed: replaced by Premium upgrade');
    payment = null;
  }

  if (!payment) {
    const created = await query(
      `INSERT INTO subscription_payments
         (user_id, plan, amount, currency, method, recipient_number, reference, status, purpose, note)
       VALUES ($1, 'premium', $2, 'USD', 'whish_pay', 'whish_pay', $3, 'awaiting', $4, $5)
       RETURNING *`,
      [user.id, quote.amount, generateReference(), quote.purpose, quote.summary]
    );
    payment = created.rows[0];
  }

  return createWhishCheckout(payment);
}

async function reconcilePaymentWithWhish(payment) {
  if (!payment?.reference || payment.status === 'confirmed' || payment.status === 'rejected') {
    return payment;
  }
  if (!whishPay.isConfigured()) return payment;
  if (!payment.collect_url && payment.status === 'awaiting') return payment;

  let result;
  try {
    result = await whishPay.getPaymentStatus({
      currency: payment.currency || 'USD',
      externalId: payment.reference,
    });
  } catch (err) {
    if (err.code === 'external_id.not_exists') return payment;
    throw err;
  }

  const collectStatus = result?.data?.collectStatus || null;
  const payerPhone = result?.data?.payerPhoneNumber || null;

  if (collectStatus) {
    await query(
      `UPDATE subscription_payments
       SET collect_status = $1,
           payer_phone = COALESCE($2, payer_phone),
           sender_whish_number = COALESCE($2, sender_whish_number),
           updated_at = NOW()
       WHERE id = $3 AND status IN ('awaiting', 'pending')`,
      [collectStatus, payerPhone, payment.id]
    );
  }

  if (collectStatus === 'success') {
    const applied = await applyPaymentDecision(payment, 'confirmed', {
      reviewNote: 'Confirmed by Whish Pay',
      payerPhone,
      collectStatus,
    });
    if (applied.payment && !applied.already) {
      const name = applied.payment.professional_name || applied.payment.full_name || applied.payment.email;
      void emailAdmin(
        'Whish Pay confirmed',
        [
          `${name} paid with Whish Pay.`,
          `Email: ${applied.payment.email}`,
          `Plan: ${planLabel(applied.payment.plan)} — $${Number(applied.payment.amount).toFixed(2)} USD`,
          `Reference: ${applied.payment.reference}`,
          payerPhone ? `Payer: ${payerPhone}` : null,
        ].filter(Boolean).join('\n'),
        cta(dashboardUrl('/admin/payments'), 'Open Whish payments')
      );
    }
    return applied.payment || payment;
  }

  if (collectStatus === 'failed') {
    const applied = await applyPaymentDecision(payment, 'rejected', {
      reviewNote: 'Whish payment link expired without being paid',
      payerPhone,
      collectStatus,
    });
    return applied.payment || payment;
  }

  if (collectStatus === 'refunded') {
    const applied = await applyPaymentDecision(payment, 'rejected', {
      reviewNote: 'Whish payment was refunded',
      payerPhone,
      collectStatus,
    });
    return applied.payment || payment;
  }

  return {
    ...payment,
    collect_status: collectStatus || payment.collect_status,
    payer_phone: payerPhone || payment.payer_phone,
  };
}

async function reconcileOpenPayments() {
  if (!whishPay.isConfigured()) return 0;
  const open = await query(
    `SELECT * FROM subscription_payments
     WHERE status IN ('awaiting', 'pending')
       AND collect_url IS NOT NULL
     ORDER BY updated_at ASC
     LIMIT 40`
  );
  let synced = 0;
  for (const row of open.rows) {
    try {
      await reconcilePaymentWithWhish(row);
      synced += 1;
    } catch (err) {
      console.error('[whish] reconcile failed:', row.reference, err.message);
    }
  }
  return synced;
}

module.exports = {
  PLAN_AMOUNTS,
  UPGRADE_TOPUP_AMOUNT,
  generateReference,
  planAmount,
  isUpgradePurpose,
  upgradeQuote,
  mapPayment,
  instructionsFor,
  withUpgradeInstructions,
  loadOpenPayment,
  loadPaymentByReference,
  latestConfirmedPayment,
  hasConfirmedPayment,
  markPaymentsApplied,
  closeOpenPayments,
  closePrematurePayments,
  ensureOpenPayment,
  paymentEmailLines,
  applyPaymentDecision,
  createCheckout,
  startUpgradeCheckout,
  reconcilePaymentWithWhish,
  reconcileOpenPayments,
};
