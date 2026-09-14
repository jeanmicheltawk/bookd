const crypto = require('crypto');
const { query, getClient } = require('../config/db');
const { isPaidPlan, planLabel, isComplimentary, isPaymentDue, extendPaidPeriod, startPaidPeriod, clearPaidPeriod } = require('./subscription');
const { notify } = require('./notify');
const { emailAdmin, dashboardUrl, cta } = require('./mailer');
const whishPay = require('./whishPay');

const PLAN_AMOUNTS = {
  basic: 6.99,
  premium: 14.99,
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

async function closeOpenPayments(userId, exec = query) {
  await exec(
    `UPDATE subscription_payments
     SET status = 'rejected',
         review_note = COALESCE(review_note, 'Closed: complimentary profile — payment not required'),
         reviewed_at = COALESCE(reviewed_at, NOW()),
         updated_at = NOW()
     WHERE user_id = $1 AND status IN ('awaiting', 'pending')`,
    [userId]
  );
}

async function closePrematurePayments(userId, exec = query) {
  await exec(
    `UPDATE subscription_payments
     SET status = 'rejected',
         review_note = COALESCE(review_note, 'Closed: next payment is not due yet'),
         reviewed_at = COALESCE(reviewed_at, NOW()),
         updated_at = NOW()
     WHERE user_id = $1 AND status = 'awaiting' AND collect_url IS NULL`,
    [userId]
  );
}

async function ensureOpenPayment(user) {
  if (!user?.id || !isPaidPlan(user.membership) || isComplimentary(user)) return null;

  const confirmed = await latestConfirmedPayment(user.id);
  if (confirmed && user.approval_status !== 'approved') {
    return confirmed;
  }

  if (!isPaymentDue(user)) {
    return confirmed || null;
  }

  const existing = await loadOpenPayment(user.id);
  if (existing) return existing;

  const created = await query(
    `INSERT INTO subscription_payments
       (user_id, plan, amount, currency, method, recipient_number, reference, status)
     VALUES ($1, $2, $3, 'USD', 'whish_pay', 'whish_pay', $4, 'awaiting')
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
    if (nextStatus === 'confirmed' && row.approval_status === 'approved') {
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

    const plan = planLabel(row.plan);
    if (nextStatus === 'confirmed') {
      const body = row.approval_status === 'approved'
        ? `Your Whish payment for ${plan} was confirmed. Your subscription has been extended by 1 month.`
        : `Your Whish payment for ${plan} was confirmed. Your 7-day free trial starts when an admin approves your profile.`;
      void notify(row.user_id, 'Payment confirmed', body, '/dashboard');
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

async function createCheckout(user) {
  const payment = await ensureOpenPayment(user);
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

  const created = await whishPay.createPayment({
    amount: payment.amount,
    currency: payment.currency || 'USD',
    invoice: `BOOK'D HAUS ${planLabel(payment.plan)}`,
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
  generateReference,
  planAmount,
  mapPayment,
  instructionsFor,
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
  reconcilePaymentWithWhish,
  reconcileOpenPayments,
};
