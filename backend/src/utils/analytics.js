const { query } = require('../config/db');

/**
 * Best-effort analytics insert. Never throws.
 * Resolves user_id / profile_id via subquery so stale JWTs or bad IDs
 * cannot violate foreign keys and spam the database with ERROR logs.
 */
async function trackEvent({
  eventType,
  path = null,
  userId = null,
  profileId = null,
  metadata = {},
  ipHash = null,
  userAgent = null,
}) {
  try {
    await query(
      `INSERT INTO analytics_events (event_type, path, user_id, profile_id, metadata, ip_hash, user_agent)
       VALUES (
         $1,
         $2,
         (SELECT id FROM users WHERE id = $3),
         (SELECT id FROM profiles WHERE id = $4),
         $5::jsonb,
         $6,
         $7
       )`,
      [
        eventType,
        path,
        userId || null,
        profileId || null,
        JSON.stringify(metadata || {}),
        ipHash,
        userAgent,
      ]
    );
  } catch (err) {
    console.warn('analytics trackEvent failed:', err.message);
  }
}

module.exports = { trackEvent };
