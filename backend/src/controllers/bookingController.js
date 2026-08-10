const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');

async function createBooking(req, res, next) {
  try {
    const {
      creativeId, projectType, projectDate, location, description,
      moodboardUrls, budget,
    } = req.body;
    if (!creativeId) return res.status(400).json({ error: 'creativeId required' });
    if (creativeId === req.user.id) return res.status(400).json({ error: 'Cannot book yourself' });

    const creative = await query(
      `SELECT id, is_active, approval_status FROM users WHERE id = $1`,
      [creativeId]
    );
    if (!creative.rows[0]?.is_active || creative.rows[0].approval_status !== 'approved') {
      return res.status(404).json({ error: 'Creative not found' });
    }

    const result = await query(
      `INSERT INTO bookings (
         client_id, creative_id, project_type, project_date, location,
         description, moodboard_urls, budget, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        req.user.id,
        creativeId,
        projectType || null,
        projectDate || null,
        location || null,
        description || null,
        moodboardUrls || null,
        budget ?? null,
      ]
    );

    const booking = result.rows[0];
    const conv = await query(
      `INSERT INTO conversations (booking_id) VALUES ($1) RETURNING id`,
      [booking.id]
    );
    await query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [conv.rows[0].id, req.user.id, creativeId]
    );

    res.status(201).json({ ...booking, conversationId: conv.rows[0].id });
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 20 });
    const { role, status } = req.query;
    const params = [req.user.id];
    let roleClause = '(b.client_id = $1 OR b.creative_id = $1)';

    if (role === 'client') {
      roleClause = 'b.client_id = $1';
    } else if (role === 'creative') {
      roleClause = 'b.creative_id = $1';
    }

    const where = [roleClause];
    if (status) {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM bookings b ${whereSql}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT b.*,
              cp.full_name AS client_name, cp.professional_name AS client_professional_name,
              crp.full_name AS creative_name, crp.professional_name AS creative_professional_name,
              cp.profile_photo_url AS client_photo, crp.profile_photo_url AS creative_photo
       FROM bookings b
       JOIN profiles cp ON cp.user_id = b.client_id
       JOIN profiles crp ON crp.user_id = b.creative_id
       ${whereSql}
       ORDER BY b.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function getBooking(req, res, next) {
  try {
    const result = await query(
      `SELECT b.*,
              cp.full_name AS client_name, crp.full_name AS creative_name
       FROM bookings b
       JOIN profiles cp ON cp.user_id = b.client_id
       JOIN profiles crp ON crp.user_id = b.creative_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    const booking = result.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.client_id !== req.user.id && booking.creative_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(booking);
  } catch (err) {
    next(err);
  }
}

async function acceptBooking(req, res, next) {
  return updateBookingStatusInternal(req, res, next, 'accepted', ['creative']);
}

async function declineBooking(req, res, next) {
  return updateBookingStatusInternal(req, res, next, 'cancelled', ['creative', 'client']);
}

async function negotiateBooking(req, res, next) {
  try {
    const booking = await getBookingForAction(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.creative_id !== req.user.id && booking.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { quotedPrice, message } = req.body;
    const updates = [`status = 'negotiating'`, 'updated_at = NOW()'];
    const params = [];
    if (quotedPrice !== undefined) {
      params.push(quotedPrice);
      updates.push(`quoted_price = $${params.length}`);
    }
    params.push(req.params.id);

    const result = await query(
      `UPDATE bookings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (message) {
      const conv = await query('SELECT id FROM conversations WHERE booking_id = $1', [req.params.id]);
      if (conv.rows[0]) {
        await query(
          `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)`,
          [conv.rows[0].id, req.user.id, message]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateBookingStatus(req, res, next) {
  try {
    const { status, quotedPrice } = req.body;
    const allowed = ['pending', 'accepted', 'negotiating', 'in_progress', 'completed', 'cancelled', 'reviewed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const booking = await getBookingForAction(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isParticipant = booking.client_id === req.user.id || booking.creative_id === req.user.id;
    if (!isParticipant && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = [`status = $1`, 'updated_at = NOW()'];
    const params = [status];
    if (quotedPrice !== undefined) {
      params.push(quotedPrice);
      updates.push(`quoted_price = $${params.length}`);
    }
    params.push(req.params.id);

    const result = await query(
      `UPDATE bookings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getBookingForAction(id) {
  const result = await query('SELECT * FROM bookings WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateBookingStatusInternal(req, res, next, status, allowedRoles) {
  try {
    const booking = await getBookingForAction(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const roleOk =
      (allowedRoles.includes('creative') && booking.creative_id === req.user.id) ||
      (allowedRoles.includes('client') && booking.client_id === req.user.id) ||
      req.user.role === 'admin';
    if (!roleOk) return res.status(403).json({ error: 'Forbidden' });

    const result = await query(
      `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBooking,
  listMine,
  getBooking,
  acceptBooking,
  declineBooking,
  negotiateBooking,
  updateBookingStatus,
};
