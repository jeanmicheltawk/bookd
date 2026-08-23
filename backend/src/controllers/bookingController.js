const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');
const { notify, displayName } = require('../utils/notify');
const { emailAdmin } = require('../utils/mailer');

let bookingDetailColumnsReady = false;

async function ensureBookingDetailColumns() {
  if (bookingDetailColumnsReady) return;
  await query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS project_time TIME');
  await query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,2)');
  bookingDetailColumnsReady = true;
}

async function createBooking(req, res, next) {
  try {
    await ensureBookingDetailColumns();

    const {
      creativeId, projectType, projectDate, projectTime, durationHours, location, description,
      moodboardUrls, budget,
    } = req.body;
    if (!creativeId) return res.status(400).json({ error: 'creativeId required' });
    if (!String(projectDate || '').trim()) return res.status(400).json({ error: 'Date is required' });
    const dateValue = String(projectDate).trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chosen = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(chosen.getTime()) || chosen < today) {
      return res.status(400).json({ error: 'Date must be today or later' });
    }
    if (!String(projectTime || '').trim()) return res.status(400).json({ error: 'Time is required' });
    const hours = Number(durationHours);
    if (!hours || hours <= 0) return res.status(400).json({ error: 'Hours are required' });
    if (!String(location || '').trim()) return res.status(400).json({ error: 'Location is required' });
    if (!String(description || '').trim()) return res.status(400).json({ error: 'Details are required' });

    const creative = await query(
      `SELECT u.id, u.is_active, u.approval_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id::text = $1 OR p.id::text = $1
       LIMIT 1`,
      [creativeId]
    );
    const creativeUser = creative.rows[0];
    if (!creativeUser?.is_active || creativeUser.approval_status !== 'approved') {
      return res.status(404).json({ error: 'Creative not found' });
    }
    if (creativeUser.id === req.user.id) return res.status(400).json({ error: 'Cannot book yourself' });

    const result = await query(
      `INSERT INTO bookings (
         client_id, creative_id, project_type, project_date, project_time, duration_hours,
         location, description, moodboard_urls, budget, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [
        req.user.id,
        creativeUser.id,
        projectType || 'Booking request',
        String(projectDate).trim(),
        String(projectTime).trim(),
        hours,
        String(location).trim(),
        String(description).trim(),
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
      [conv.rows[0].id, req.user.id, creativeUser.id]
    );

    const clientName = await displayName(req.user.id);
    await notify(
      creativeUser.id,
      'New booking request',
      `${clientName} sent a booking request for ${String(projectDate).trim()} at ${String(projectTime).trim()}.`,
      '/dashboard/bookings'
    );
    void emailAdmin(
      'New booking request',
      [
        `${clientName} booked a creator.`,
        `Date: ${String(projectDate).trim()} at ${String(projectTime).trim()}`,
        `Location: ${String(location).trim()}`,
        budget != null && budget !== '' ? `Budget: ${budget}` : null,
        `Details: ${String(description).trim()}`,
      ].filter(Boolean).join('\n')
    );

    res.status(201).json({ ...booking, conversationId: conv.rows[0].id });
  } catch (err) {
    next(err);
  }
}

async function listMine(req, res, next) {
  try {
    await ensureBookingDetailColumns();
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

    const otherId = booking.creative_id === req.user.id ? booking.client_id : booking.creative_id;
    const actorName = await displayName(req.user.id);
    await notify(
      otherId,
      'Booking update',
      `${actorName} sent a booking update.`,
      '/dashboard/bookings'
    );

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

    const otherId = booking.creative_id === req.user.id ? booking.client_id : booking.creative_id;
    if (otherId && req.user.role !== 'admin') {
      const actorName = await displayName(req.user.id);
      await notify(
        otherId,
        'Booking update',
        `${actorName} updated a booking to ${status.replace('_', ' ')}.`,
        '/dashboard/bookings'
      );
    }

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

    const actorName = await displayName(req.user.id);
    if (status === 'accepted' && booking.client_id !== req.user.id) {
      await notify(
        booking.client_id,
        'Booking approved',
        `${actorName} approved your booking request.`,
        '/dashboard/bookings'
      );
    } else if (status === 'cancelled') {
      const recipient = booking.creative_id === req.user.id ? booking.client_id : booking.creative_id;
      const copy = booking.creative_id === req.user.id
        ? `${actorName} declined your booking request.`
        : `${actorName} cancelled a booking request.`;
      await notify(recipient, booking.creative_id === req.user.id ? 'Booking declined' : 'Booking cancelled', copy, '/dashboard/bookings');
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listAllAdmin(req, res, next) {
  try {
    await ensureBookingDetailColumns();
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 50, maxLimit: 100 });
    const { status, q } = req.query;
    const params = [];
    const where = ['1=1'];

    if (status === 'pending') {
      where.push(`b.status = 'pending'`);
    } else if (status === 'booked') {
      where.push(`b.status IN ('accepted', 'negotiating', 'in_progress')`);
    } else if (status === 'done') {
      where.push(`b.status IN ('completed', 'reviewed')`);
    } else if (status === 'declined') {
      where.push(`b.status = 'cancelled'`);
    }

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(
        COALESCE(cp.full_name, '') ILIKE $${i}
        OR COALESCE(crp.full_name, '') ILIKE $${i}
        OR COALESCE(cp.professional_name, '') ILIKE $${i}
        OR COALESCE(crp.professional_name, '') ILIKE $${i}
        OR cu.email ILIKE $${i}
        OR cru.email ILIKE $${i}
        OR COALESCE(b.location, '') ILIKE $${i}
      )`);
    }

    const joins = `
      FROM bookings b
      JOIN users cu ON cu.id = b.client_id
      JOIN users cru ON cru.id = b.creative_id
      LEFT JOIN profiles cp ON cp.user_id = b.client_id
      LEFT JOIN profiles crp ON crp.user_id = b.creative_id
    `;

    const searchWhere = q
      ? `WHERE (
           COALESCE(cp.full_name, '') ILIKE $1
           OR COALESCE(crp.full_name, '') ILIKE $1
           OR COALESCE(cp.professional_name, '') ILIKE $1
           OR COALESCE(crp.professional_name, '') ILIKE $1
           OR cu.email ILIKE $1
           OR cru.email ILIKE $1
           OR COALESCE(b.location, '') ILIKE $1
         )`
      : '';
    const searchParams = q ? [`%${q}%`] : [];

    const countsRes = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE b.status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE b.status IN ('accepted', 'negotiating', 'in_progress'))::int AS booked,
         COUNT(*) FILTER (WHERE b.status IN ('completed', 'reviewed'))::int AS done,
         COUNT(*) FILTER (WHERE b.status = 'cancelled')::int AS declined
       ${joins}
       ${searchWhere}`,
      searchParams
    );

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countFiltered = await query(`SELECT COUNT(*)::int AS total ${joins} ${whereSql}`, params);
    const total = countFiltered.rows[0].total;

    const listParams = [...params, limit, offset];
    const result = await query(
      `SELECT b.*,
              cp.full_name AS client_name, cp.professional_name AS client_professional_name,
              crp.full_name AS creative_name, crp.professional_name AS creative_professional_name,
              cp.phone AS client_phone, crp.phone AS creative_phone,
              cu.email AS client_email, cru.email AS creative_email
       ${joins}
       ${whereSql}
       ORDER BY b.updated_at DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json({
      data: result.rows,
      pagination: paginationMeta(page, limit, total),
      counts: countsRes.rows[0],
    });
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
  listAllAdmin,
};
