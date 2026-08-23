const { query } = require('../config/db');
const { emailUser } = require('./mailer');

async function notify(userId, title, body, link) {
  if (!userId) return;
  await query(
    `INSERT INTO notifications (user_id, title, body, link)
     VALUES ($1, $2, $3, $4)`,
    [userId, title, body || null, link || null]
  );
  await emailUser(userId, title, body || title, link || '/dashboard');
}

async function displayName(userId) {
  const result = await query(
    `SELECT professional_name, full_name FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.professional_name || result.rows[0]?.full_name || 'Someone';
}

module.exports = { notify, displayName };
