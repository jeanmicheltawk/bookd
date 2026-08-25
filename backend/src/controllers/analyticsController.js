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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    const settled = await Promise.allSettled([
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
      query(
        `SELECT
           COUNT(*) FILTER (
             WHERE u.role = 'member'
               AND COALESCE(u.approval_status, 'approved') = 'approved'
               AND u.is_active = TRUE
           )::int AS active,
           COUNT(*) FILTER (WHERE u.role = 'member')::int AS total,
           COUNT(*) FILTER (
             WHERE u.role = 'member' AND u.approval_status = 'pending'
           )::int AS pending,
           COUNT(*) FILTER (
             WHERE u.role = 'member'
               AND COALESCE(u.approval_status, 'approved') = 'approved'
               AND u.is_active = TRUE
               AND u.membership = 'premium'
               AND u.membership_ends_at IS NOT NULL
               AND u.membership_ends_at > NOW()
           )::int AS premium,
           (
             COALESCE((
               SELECT SUM(
                 CASE u2.membership
                   WHEN 'premium' THEN 14.99
                   WHEN 'basic' THEN 6.99
                   ELSE 0
                 END
               )
               FROM users u2
               WHERE u2.role = 'member'
                 AND COALESCE(u2.approval_status, 'approved') = 'approved'
                 AND u2.is_active = TRUE
                 AND u2.membership IN ('basic', 'premium')
                 AND u2.membership_ends_at IS NOT NULL
                 AND u2.membership_ends_at > NOW()
             ), 0)
             +
             COALESCE((
               SELECT SUM(
                 CASE sc.plan
                   WHEN 'premium' THEN 14.99
                   WHEN 'basic' THEN 6.99
                   ELSE 0
                 END
               )
               FROM subscription_cancellations sc
               WHERE sc.refund_done = FALSE
                 AND NOT EXISTS (
                   SELECT 1 FROM users live
                   WHERE live.id = sc.user_id
                     AND live.role = 'member'
                     AND COALESCE(live.approval_status, 'approved') = 'approved'
                     AND live.is_active = TRUE
                     AND live.membership IN ('basic', 'premium')
                     AND live.membership_ends_at IS NOT NULL
                     AND live.membership_ends_at > NOW()
                 )
             ), 0)
           )::float AS monthly_amount,
           (
             COUNT(*) FILTER (
               WHERE u.role = 'member'
                 AND COALESCE(u.approval_status, 'approved') = 'approved'
                 AND u.is_active = TRUE
                 AND u.membership IN ('basic', 'premium')
                 AND u.membership_ends_at IS NOT NULL
                 AND u.membership_ends_at > NOW()
             )
             +
             COALESCE((
               SELECT COUNT(*)
               FROM subscription_cancellations sc
               WHERE sc.refund_done = FALSE
                 AND NOT EXISTS (
                   SELECT 1 FROM users live
                   WHERE live.id = sc.user_id
                     AND live.role = 'member'
                     AND COALESCE(live.approval_status, 'approved') = 'approved'
                     AND live.is_active = TRUE
                     AND live.membership IN ('basic', 'premium')
                     AND live.membership_ends_at IS NOT NULL
                     AND live.membership_ends_at > NOW()
                 )
             ), 0)
           )::int AS active_memberships
         FROM profiles p
         JOIN users u ON u.id = p.user_id`
      ),
      query(
        `SELECT
           p.id,
           p.professional_name,
           p.full_name,
           p.profile_photo_url,
           p.custom_url,
           c.name AS category_name,
           COUNT(*)::int AS views
         FROM analytics_events ae
         JOIN profiles p ON (
           p.id = ae.profile_id
           OR ae.path = '/profile/' || p.id::text
           OR (p.custom_url IS NOT NULL AND ae.path = '/profile/' || p.custom_url)
         )
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ae.event_type = 'pageview'
           AND u.role = 'member'
           AND (
             ae.profile_id IS NOT NULL
             OR ae.path LIKE '/profile/%'
           )
         GROUP BY p.id, p.professional_name, p.full_name, p.profile_photo_url, p.custom_url, c.name
         ORDER BY views DESC
         LIMIT 20`
      ),
      query(
        `SELECT COUNT(*)::int AS pending
         FROM subscription_payments
         WHERE status IN ('pending', 'awaiting')`
      ),
    ]);

    settled.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`admin analytics query ${i} failed`, result.reason);
      }
    });

    const row = (index) =>
      settled[index].status === 'fulfilled' ? settled[index].value.rows : [];
    const first = (index) => row(index)[0] || {};
    const stats = first(4);

    res.json({
      visitors: {
        last_24h: first(0).last_24h || 0,
        last_7d: first(0).last_7d || 0,
        last_30d: first(0).last_30d || 0,
        unique_visitors_30d: first(0).unique_visitors_30d || 0,
      },
      contacts: {
        new_count: first(1).new_count || 0,
        total: first(1).total || 0,
      },
      popularPages: row(2),
      recentActivity: row(3),
      profiles: {
        active: Number(stats.active) || 0,
        total: Number(stats.total) || 0,
        pending: Number(stats.pending) || 0,
        premium: Number(stats.premium) || 0,
        monthlyAmount: Number(stats.monthly_amount) || 0,
        activeMemberships: Number(stats.active_memberships) || 0,
        pendingPayments: Number(first(6).pending) || 0,
      },
      topProfiles: row(5),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { trackPageview, getAdminDashboard };
