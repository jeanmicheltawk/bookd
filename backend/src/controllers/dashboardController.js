const { query } = require('../config/db');

async function loadAlerts(userId) {
  const [messages, incoming, updates] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS unread
       FROM messages m
       JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
       WHERE m.sender_id != $1 AND m.read_at IS NULL`,
      [userId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM bookings
       WHERE creative_id = $1 AND status = 'pending'`,
      [userId]
    ),
    query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE AND link = '/dashboard/bookings'`,
      [userId]
    ),
  ]);

  return {
    unreadMessages: messages.rows[0].unread,
    newBookings: incoming.rows[0].count,
    bookingUpdates: updates.rows[0].count,
  };
}

async function getAlerts(req, res, next) {
  try {
    res.json(await loadAlerts(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function markNotificationsRead(req, res, next) {
  try {
    const link = req.body?.link;
    if (link) {
      await query(
        `UPDATE notifications SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE AND link = $2`,
        [req.user.id, link]
      );
    } else {
      await query(
        `UPDATE notifications SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE`,
        [req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getMyDashboard(req, res, next) {
  try {
    const userId = req.user.id;

    const profileRes = await query(
      `SELECT p.id, p.full_name, p.professional_name, p.profile_photo_url, p.is_public, p.performance_score
       FROM profiles p WHERE p.user_id = $1`,
      [userId]
    );
    const profile = profileRes.rows[0];

    const [bookings, messages, analytics, notifications, alerts] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status IN ('accepted', 'negotiating', 'in_progress'))::int AS active,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*)::int AS total
         FROM bookings WHERE client_id = $1 OR creative_id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS unread
         FROM messages m
         JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
         WHERE m.sender_id != $1 AND m.read_at IS NULL`,
        [userId]
      ),
      profile
        ? query(
            `SELECT
               COUNT(*) FILTER (WHERE event_type = 'profile_view' AND created_at >= NOW() - INTERVAL '7 days')::int AS views_7d,
               COUNT(*) FILTER (WHERE event_type = 'profile_view' AND created_at >= NOW() - INTERVAL '30 days')::int AS views_30d
             FROM analytics_events WHERE profile_id = $1`,
            [profile.id]
          )
        : Promise.resolve({ rows: [{ views_7d: 0, views_30d: 0 }] }),
      query(
        `SELECT COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread
         FROM notifications WHERE user_id = $1`,
        [userId]
      ),
      loadAlerts(userId),
    ]);

    const recentBookings = await query(
      `SELECT b.id, b.project_type, b.project_date, b.status, b.created_at,
              CASE WHEN b.client_id = $1 THEN crp.professional_name ELSE cp.professional_name END AS counterpart_name
       FROM bookings b
       JOIN profiles cp ON cp.user_id = b.client_id
       JOIN profiles crp ON crp.user_id = b.creative_id
       WHERE b.client_id = $1 OR b.creative_id = $1
       ORDER BY b.updated_at DESC LIMIT 5`,
      [userId]
    );

    res.json({
      profile,
      bookings: bookings.rows[0],
      messages: messages.rows[0],
      analytics: analytics.rows[0],
      notifications: notifications.rows[0],
      alerts,
      recentBookings: recentBookings.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyDashboard, getAlerts, markNotificationsRead };
