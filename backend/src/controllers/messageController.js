const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');

async function userInConversation(conversationId, userId) {
  const result = await query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return result.rows.length > 0;
}

async function listConversations(req, res, next) {
  try {
    const result = await query(
      `SELECT c.id, c.booking_id, c.created_at,
              b.status AS booking_status, b.project_type,
              b.project_date AS booking_date,
              b.project_time AS booking_time,
              b.location AS booking_location,
              b.duration_hours AS booking_hours,
              (
                SELECT COUNT(*)::int FROM messages m
                WHERE m.conversation_id = c.id AND m.read_at IS NULL AND m.sender_id != $1
              ) AS unread_count,
              (
                SELECT body FROM messages m
                WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
              ) AS last_message,
              (
                SELECT created_at FROM messages m
                WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
              ) AS last_message_at
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
       LEFT JOIN bookings b ON b.id = c.booking_id
       ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC`,
      [req.user.id]
    );

    const enriched = [];
    for (const conv of result.rows) {
      const participants = await query(
        `SELECT u.id, p.full_name, p.professional_name, p.profile_photo_url
         FROM conversation_participants cp
         JOIN users u ON u.id = cp.user_id
         JOIN profiles p ON p.user_id = u.id
         WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
        [conv.id, req.user.id]
      );
      enriched.push({ ...conv, participants: participants.rows });
    }

    res.json({ data: enriched });
  } catch (err) {
    next(err);
  }
}

async function getOrCreateConversation(req, res, next) {
  try {
    const { participantId: rawParticipantId, bookingId } = req.body;
    if (!rawParticipantId) return res.status(400).json({ error: 'participantId required' });

    const userMatch = await query(`SELECT id FROM users WHERE id::text = $1`, [rawParticipantId]);
    let participantId = userMatch.rows[0]?.id;
    if (!participantId) {
      const profileMatch = await query(`SELECT user_id FROM profiles WHERE id::text = $1`, [rawParticipantId]);
      participantId = profileMatch.rows[0]?.user_id;
    }
    if (!participantId) return res.status(404).json({ error: 'Participant not found' });
    if (participantId === req.user.id) return res.status(400).json({ error: 'Invalid participant' });

    if (bookingId) {
      const existing = await query(
        `SELECT id FROM conversations WHERE booking_id = $1`,
        [bookingId]
      );
      if (existing.rows[0]) return res.json(existing.rows[0]);
    }

    const shared = await query(
      `SELECT cp1.conversation_id
       FROM conversation_participants cp1
       JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
       WHERE cp1.user_id = $1 AND cp2.user_id = $2
       LIMIT 1`,
      [req.user.id, participantId]
    );
    if (shared.rows[0]) return res.json({ id: shared.rows[0].conversation_id });

    const conv = await query(
      `INSERT INTO conversations (booking_id) VALUES ($1) RETURNING *`,
      [bookingId || null]
    );
    await query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [conv.rows[0].id, req.user.id, participantId]
    );
    res.status(201).json(conv.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const { id } = req.params;
    if (!(await userInConversation(id, req.user.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { page, limit, offset } = parsePageLimit(req.query, { limit: 50, maxLimit: 100 });
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM messages WHERE conversation_id = $1`,
      [id]
    );
    const total = countRes.rows[0].total;

    const result = await query(
      `SELECT m.*, p.full_name AS sender_name, p.profile_photo_url AS sender_photo
       FROM messages m
       JOIN profiles p ON p.user_id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body required' });
    if (!(await userInConversation(id, req.user.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, req.user.id, body.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    if (!(await userInConversation(id, req.user.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await query(
      `UPDATE messages SET read_at = NOW()
       WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function saveMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const { saved } = req.body;

    const msg = await query(
      `SELECT m.* FROM messages m
       JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
       WHERE m.id = $1 AND cp.user_id = $2`,
      [messageId, req.user.id]
    );
    if (!msg.rows[0]) return res.status(404).json({ error: 'Message not found' });

    const result = await query(
      `UPDATE messages SET is_saved = $1 WHERE id = $2 RETURNING *`,
      [saved !== false, messageId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function reportMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const { reason } = req.body;

    const msg = await query(
      `SELECT m.* FROM messages m
       JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
       WHERE m.id = $1 AND cp.user_id = $2`,
      [messageId, req.user.id]
    );
    if (!msg.rows[0]) return res.status(404).json({ error: 'Message not found' });

    await query(
      `INSERT INTO analytics_events (event_type, path, user_id, metadata)
       VALUES ('message_report', '/api/messages/report', $1, $2::jsonb)`,
      [req.user.id, JSON.stringify({ messageId, reason: reason || null, senderId: msg.rows[0].sender_id })]
    );

    res.json({ success: true, message: 'Report submitted' });
  } catch (err) {
    next(err);
  }
}

async function listSavedMessages(req, res, next) {
  try {
    const result = await query(
      `SELECT m.*, c.id AS conversation_id, p.full_name AS sender_name
       FROM messages m
       JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
       JOIN conversations c ON c.id = m.conversation_id
       JOIN profiles p ON p.user_id = m.sender_id
       WHERE m.is_saved = TRUE
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConversations,
  getOrCreateConversation,
  listMessages,
  sendMessage,
  markRead,
  saveMessage,
  reportMessage,
  listSavedMessages,
};
