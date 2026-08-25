const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');
const { planLabel } = require('../utils/subscription');

function mapCancellation(row) {
  return {
    ...row,
    plan_label: planLabel(row.plan),
  };
}

async function listCancellations(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 50, maxLimit: 100 });
    const { refund } = req.query;
    const params = [];
    const where = ['1=1'];

    if (refund === 'done') {
      where.push('sc.refund_done = TRUE');
    } else if (refund === 'pending') {
      where.push('sc.refund_done = FALSE');
    }

    const whereSql = where.join(' AND ');
    const list = await query(
      `SELECT sc.id, sc.user_id, sc.email, sc.full_name, sc.professional_name, sc.plan,
              sc.cancelled_at, sc.cancelled_by, sc.refund_done, sc.refund_updated_at
       FROM subscription_cancellations sc
       WHERE ${whereSql}
       ORDER BY sc.cancelled_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const count = await query(
      `SELECT COUNT(*)::int AS total FROM subscription_cancellations sc WHERE ${whereSql}`,
      params
    );

    res.json({
      data: list.rows.map(mapCancellation),
      pagination: paginationMeta(page, limit, count.rows[0].total),
    });
  } catch (err) {
    next(err);
  }
}

async function updateCancellationRefund(req, res, next) {
  try {
    const { id } = req.params;
    if (typeof req.body?.refund_done !== 'boolean') {
      return res.status(400).json({ error: 'refund_done must be true or false' });
    }

    const result = await query(
      `UPDATE subscription_cancellations
       SET refund_done = $1, refund_updated_at = NOW()
       WHERE id = $2
       RETURNING id, user_id, email, full_name, professional_name, plan,
                 cancelled_at, cancelled_by, refund_done, refund_updated_at`,
      [req.body.refund_done, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Cancellation not found' });
    res.json(mapCancellation(result.rows[0]));
  } catch (err) {
    next(err);
  }
}

module.exports = { listCancellations, updateCancellationRefund };
