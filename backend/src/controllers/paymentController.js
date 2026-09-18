const { query } = require('../config/db');
const {
  mapPayment,
  withUpgradeInstructions,
  loadOpenPayment,
  loadPaymentByReference,
  latestConfirmedPayment,
  ensureOpenPayment,
  applyPaymentDecision,
  createCheckout,
  startUpgradeCheckout,
  closeOpenPayments,
  reconcilePaymentWithWhish,
  isUpgradePurpose,
} = require('../utils/payment');
const { isPaidPlan, isComplimentary, isPaymentDue, planLabel } = require('../utils/subscription');

async function loadMember(userId) {
  const result = await query(
    `SELECT u.id, u.email, u.role, u.membership, u.approval_status, u.is_complimentary,
            u.membership_started_at, u.membership_trial_ends_at, u.membership_ends_at,
            p.full_name, p.professional_name, p.phone
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

function paidMemberOrError(user, res) {
  if (!user || user.role !== 'member' || !isPaidPlan(user.membership) || isComplimentary(user)) {
    res.status(400).json({ error: 'Only Starter and Premium members can pay by card.' });
    return false;
  }
  return true;
}

async function loadVisiblePayment(user) {
  const open = await loadOpenPayment(user.id);
  if (open) return open;
  if (isPaymentDue(user)) return ensureOpenPayment(user);
  return latestConfirmedPayment(user.id);
}

async function jsonInstructions(res, user, payment) {
  res.json(await withUpgradeInstructions(user, payment));
}

async function getMyWhishPayment(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!paidMemberOrError(user, res)) return;

    let payment = await loadVisiblePayment(user);
    if (payment && payment.status !== 'confirmed') {
      try {
        payment = await reconcilePaymentWithWhish(payment);
      } catch (err) {
        console.error('[whish] status check failed:', err.message);
      }
    }
    const fresh = await loadMember(req.user.id);
    await jsonInstructions(res, fresh, payment);
  } catch (err) {
    if (err.code === '23505') {
      const payment = await loadOpenPayment(req.user.id);
      const user = await loadMember(req.user.id);
      return jsonInstructions(res, user, payment);
    }
    next(err);
  }
}

async function startWhishCheckout(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!paidMemberOrError(user, res)) return;

    if (user.approval_status !== 'approved') {
      const confirmed = await latestConfirmedPayment(user.id);
      if (confirmed) {
        return res.status(409).json({
          error: 'Your payment is already confirmed. Your trial starts when an admin approves your profile.',
          ...await withUpgradeInstructions(user, confirmed),
        });
      }
    } else if (!isPaymentDue(user)) {
      const confirmed = await latestConfirmedPayment(user.id);
      const until = user.membership_ends_at
        ? new Date(user.membership_ends_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        : 'the end of this period';
      return res.status(409).json({
        error: `Your ${planLabel(user.membership)} is already paid until ${until}. You can pay again 5 days before that date.`,
        ...await withUpgradeInstructions(user, confirmed),
      });
    }

    const open = await loadOpenPayment(user.id);
    if (open && isUpgradePurpose(open.purpose)) {
      return res.status(409).json({
        error: 'Finish your Premium upgrade first, or cancel it.',
        ...await withUpgradeInstructions(user, open),
      });
    }

    const payment = await createCheckout(user);
    if (!payment?.collect_url) {
      return res.status(502).json({ error: 'The payment page did not load. Try again.' });
    }
    res.json({
      ...await withUpgradeInstructions(user, payment),
      collect_url: payment.collect_url,
    });
  } catch (err) {
    next(err);
  }
}

async function syncMyWhishPayment(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!paidMemberOrError(user, res)) return;

    const payment = await loadOpenPayment(user.id) || await latestConfirmedPayment(user.id);
    if (!payment) {
      if (!isPaymentDue(user)) return jsonInstructions(res, user, null);
      return jsonInstructions(res, user, await ensureOpenPayment(user));
    }
    const synced = await reconcilePaymentWithWhish(payment);
    const fresh = await loadMember(req.user.id);
    res.json(await withUpgradeInstructions(fresh, synced));
  } catch (err) {
    next(err);
  }
}

async function startPremiumUpgrade(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!paidMemberOrError(user, res)) return;

    const payment = await startUpgradeCheckout(user);
    if (!payment?.collect_url) {
      return res.status(502).json({ error: 'The payment page did not load. Try again.' });
    }
    const fresh = await loadMember(req.user.id);
    res.json({
      ...await withUpgradeInstructions(fresh, payment),
      collect_url: payment.collect_url,
    });
  } catch (err) {
    next(err);
  }
}

async function cancelPremiumUpgrade(req, res, next) {
  try {
    const user = await loadMember(req.user.id);
    if (!paidMemberOrError(user, res)) return;

    const open = await loadOpenPayment(user.id);
    if (!open || !isUpgradePurpose(open.purpose)) {
      return res.status(400).json({ error: 'No Premium upgrade in progress.' });
    }
    await closeOpenPayments(user.id, query, 'Closed: member cancelled Premium upgrade');
    await jsonInstructions(res, user, await loadVisiblePayment(user));
  } catch (err) {
    next(err);
  }
}

async function handleWhishCallback(req, res, next, kind) {
  try {
    const externalId = String(req.query.externalId || req.query.ref || '').trim();
    if (!externalId) {
      return res.status(200).json({ ok: true, ignored: true });
    }
    const payment = await loadPaymentByReference(externalId);
    if (payment) {
      try {
        await reconcilePaymentWithWhish(payment);
      } catch (err) {
        console.error(`[whish] ${kind} callback reconcile failed:`, externalId, err.message);
      }
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function whishSuccessCallback(req, res, next) {
  return handleWhishCallback(req, res, next, 'success');
}

async function whishFailureCallback(req, res, next) {
  return handleWhishCallback(req, res, next, 'failure');
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
  try {
    const existing = await query(`SELECT * FROM subscription_payments WHERE id = $1`, [id]);
    const paymentRow = existing.rows[0];
    if (!paymentRow) return res.status(404).json({ error: 'Payment not found' });

    const result = await applyPaymentDecision(paymentRow, nextStatus, {
      reviewedBy: req.user.id,
      reviewNote,
    });
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json(result.payment);
  } catch (err) {
    next(err);
  }
}

async function confirmPayment(req, res, next) {
  return reviewPayment(req, res, next, 'confirmed');
}

async function rejectPayment(req, res, next) {
  return reviewPayment(req, res, next, 'rejected');
}

async function syncAdminPayment(req, res, next) {
  try {
    const existing = await query(`SELECT * FROM subscription_payments WHERE id = $1`, [req.params.id]);
    const paymentRow = existing.rows[0];
    if (!paymentRow) return res.status(404).json({ error: 'Payment not found' });
    const synced = await reconcilePaymentWithWhish(paymentRow);
    res.json(mapPayment(synced));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyWhishPayment,
  startWhishCheckout,
  startPremiumUpgrade,
  cancelPremiumUpgrade,
  syncMyWhishPayment,
  whishSuccessCallback,
  whishFailureCallback,
  listPayments,
  confirmPayment,
  rejectPayment,
  syncAdminPayment,
};
