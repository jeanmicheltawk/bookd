const crypto = require('crypto');
const { query } = require('../config/db');

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

async function trackPageview(req, res, next) {
  try {
    const { path: pagePath, profileId, metadata } = req.body;
    if (!pagePath) return res.status(400).json({ error: 'path required' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'] || null;

    await query(
      `INSERT INTO analytics_events (event_type, path, user_id, profile_id, metadata, ip_hash, user_agent)
       VALUES ('pageview', $1, $2, $3, $4::jsonb, $5, $6)`,
      [
        pagePath,
        req.user?.id || null,
        profileId || null,
        JSON.stringify(metadata || {}),
        hashIp(ip),
        userAgent,
      ]
    );

    if (profileId) {
      await query(
        `UPDATE profiles SET performance_score = performance_score + 0.1, updated_at = NOW()
         WHERE id = $1`,
        [profileId]
      );
    }

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getAdminDashboard(_req, res, next) {
  try {
    const [visitors, contacts, popularPages, recentActivity] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
           COUNT(DISTINCT ip_hash) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS unique_visitors_30d
         FROM analytics_events WHERE event_type = 'pageview'`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
           COUNT(*)::int AS total
         FROM contact_messages`
      ),
      query(
        `SELECT path, COUNT(*)::int AS views
         FROM analytics_events
         WHERE event_type = 'pageview' AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY path ORDER BY views DESC LIMIT 10`
      ),
      query(
        `SELECT ae.id, ae.event_type, ae.path, ae.metadata, ae.created_at,
                u.email AS user_email, p.full_name AS profile_name
         FROM analytics_events ae
         LEFT JOIN users u ON u.id = ae.user_id
         LEFT JOIN profiles p ON p.id = ae.profile_id
         ORDER BY ae.created_at DESC LIMIT 25`
      ),
    ]);

    res.json({
      visitors: visitors.rows[0],
      contacts: contacts.rows[0],
      popularPages: popularPages.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { trackPageview, getAdminDashboard };
