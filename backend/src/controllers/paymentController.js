const { query, getClient } = require('../config/db');
const { notify } = require('../utils/notify');
const { emailAdmin, dashboardUrl, cta } = require('../utils/mailer');
const {
  isPaidPlan,
  isComplimentary,
  planLabel,
  extendPaidPeriod,
  startPaidPeriod,
  clearPaidPeriod,
} = require('../utils/subscription');
const {
  WHISH_RECIPIENT,
  mapPayment,
  instructionsFor,
  loadOpenPayment,
  ensureOpenPayment,
  latestConfirmedPayment,
  markPaymentsApplied,
} = require('../utils/payment');

function normalizeWhishNumber(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!/^[0-9+() ]+$/.test(trimmed)) return null;
  return trimmed.replace(/\s+/g, ' ');
}

async function loadMember(userId) {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.membership, u.approval_status, u.is_complimentary,
            p.full_name, p.professional_name, p.phone
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getMyWhishPayment(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!user || user.role !== 'member' || !isPaidPlan(user.membership) || isComplimentary(user)) {
      return res.status(400).json({ error: 'Only Starter and Premium members can pay with Whish.' });
    }

    const payment = await ensureOpenPayment(user);
    res.json({
      ...instructionsFor(user, payment),
      suggested_whish_number: user.phone || '',
    });
  } catch (err) {
    if (err.code === '23505') {
      const payment = await loadOpenPayment(req.user.id);
      const user = await loadMember(req.user.id);
      return res.json({
        ...instructionsFor(user, payment),
        suggested_whish_number: user?.phone || '',
      });
    }
    next(err);
  }
}

async function submitMyWhishPayment(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!user || user.role !== 'member' || !isPaidPlan(user.membership) || isComplimentary(user)) {
      return res.status(400).json({ error: 'Only Starter and Premium members can pay with Whish.' });
    }

    const sender = normalizeWhishNumber(req.body?.sender_whish_number);
    if (sender == null) {
      return res.status(400).json({ error: 'Whish number may only contain numbers, +, (, ), and spaces.' });
    }
    if (!sender) {
      return res.status(400).json({ error: 'Enter the Whish number you sent from.' });
    }

    const note = String(req.body?.note || '').trim().slice(0, 280) || null;

    if (user.approval_status !== 'approved') {
      const confirmed = await latestConfirmedPayment(user.id);
      if (confirmed) {
        return res.status(409).json({
          error: 'Your payment is already confirmed. Your trial starts when an admin approves your profile.',
          ...instructionsFor(user, confirmed),
        });
      }
    }

    let payment = await loadOpenPayment(user.id);

    if (payment?.status === 'pending') {
      return res.status(409).json({
        error: 'Your payment is already waiting for confirmation.',
        ...instructionsFor(user, payment),
      });
    }

    if (!payment) {
      payment = await ensureOpenPayment(user);
    }

    const updated = await query(
      `UPDATE subscription_payments
       SET sender_whish_number = $1,
           note = $2,
           status = 'pending',
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 AND status = 'awaiting'
       RETURNING *`,
      [sender, note, payment.id]
    );

    const submitted = updated.rows[0];
    if (!submitted) {
      const latest = await loadOpenPayment(user.id);
      return res.status(409).json({
        error: 'Your payment is already waiting for confirmation.',
        ...instructionsFor(user, latest),
      });
    }

    const name = user.professional_name || user.full_name || user.email;
    void emailAdmin(
      'Whish payment submitted',
      [
        `${name} says they sent a Whish to Whish payment.`,
        `Email: ${user.email}`,
        `Plan: ${planLabel(user.membership)} — $${Number(submitted.amount).toFixed(2)} USD`,
        `Send from: ${submitted.sender_whish_number}`,
        `Send to: ${WHISH_RECIPIENT.display}`,
        `Reference: ${submitted.reference}`,
        submitted.note ? `Note: ${submitted.note}` : null,
        'Open Whish and confirm the transfer, then mark it confirmed in admin.',
      ].filter(Boolean).join('\n'),
      cta(dashboardUrl('/admin/payments'), 'Open Whish payments')
    );

    res.json(instructionsFor(user, submitted));
  } catch (err) {
    next(err);
  }
}

async function listPayments(req, res, next) {
  try {
    const { parsePageLimit, paginationMeta } = require('../utils/pagination');
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 50, maxLimit: 100 });
    const { status } = req.query;
    const params = [];
    const where = ['1=1'];

    if (status === 'open' || !status) {
      where.push(`sp.status IN ('awaiting', 'pending')`);
    } else if (status && ['pending', 'confirmed', 'rejected', 'awaiting'].includes(status)) {
      params.push(status);
      where.push(`sp.status = $${params.length}`);
    } else if (status === 'all') {
      /* no status filter */
    } else {
      where.push(`sp.status IN ('awaiting', 'pending')`);
    }

    const whereSql = where.join(' AND ');
    const list = await query(
      `SELECT sp.*, u.email, p.full_name, p.professional_name, p.phone
       FROM subscription_payments sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE ${whereSql}
       ORDER BY COALESCE(sp.submitted_at, sp.created_at) DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const count = await query(
      `SELECT COUNT(*)::int AS total FROM subscription_payments sp WHERE ${whereSql}`,
      params
    );

    res.json({
      data: list.rows.map(mapPayment),
      pagination: paginationMeta(page, limit, count.rows[0].total),
    });
  } catch (err) {
    next(err);
  }
}

async function reviewPayment(req, res, next, nextStatus) {
  const { id } = req.params;
  const reviewNote = String(req.body?.review_note || '').trim().slice(0, 280) || null;
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT * FROM subscription_payments WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const paymentRow = existing.rows[0];
    if (!paymentRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }
    if (paymentRow.status !== 'pending' && paymentRow.status !== 'awaiting') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This payment was already reviewed.' });
    }

    const member = await client.query(
      `SELECT u.email, u.membership, u.approval_status, u.membership_ends_at,
              p.full_name, p.professional_name
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [paymentRow.user_id]
    );
    const row = { ...paymentRow, ...member.rows[0] };

    const updated = await client.query(
      `UPDATE subscription_payments
       SET status = $1,
           reviewed_at = NOW(),
           reviewed_by = $2,
           review_note = $3,
           period_applied = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [nextStatus, req.user.id, reviewNote, nextStatus === 'confirmed' && row.approval_status === 'approved', id]
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
    } else {
      void notify(
        row.user_id,
        'Payment not found',
        `We could not match your Whish payment for ${plan}. Check the amount, number, and reference, then submit again from the pay page.`,
        '/dashboard/pay'
      );
    }

    res.json(payment);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    next(err);
  } finally {
    client.release();
  }
}

async function confirmPayment(req, res, next) {
  return reviewPayment(req, res, next, 'confirmed');
}

async function rejectPayment(req, res, next) {
  return reviewPayment(req, res, next, 'rejected');
}

module.exports = {
  getMyWhishPayment,
  submitMyWhishPayment,
  listPayments,
  confirmPayment,
  rejectPayment,
};
