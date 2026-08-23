const fs = require('fs');
const { query } = require('../config/db');

const STARTER_PORTFOLIO_LIMIT = 4;
const PREMIUM_PORTFOLIO_LIMIT = 15;

function portfolioLimitFor(membership) {
  return membership === 'premium' ? PREMIUM_PORTFOLIO_LIMIT : STARTER_PORTFOLIO_LIMIT;
}

function limitMessage(membership, limit) {
  if (membership === 'premium') {
    return `Premium plan allows up to ${limit} portfolio images.`;
  }
  return `Starter plan allows ${limit} portfolio images. Upgrade to Premium plan for ${PREMIUM_PORTFOLIO_LIMIT}.`;
}

async function assertPortfolioCapacity(userId, extraFile) {
  const userRes = await query('SELECT membership FROM users WHERE id = $1', [userId]);
  const membership = userRes.rows[0]?.membership || 'basic';
  const limit = portfolioLimitFor(membership);

  const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
  const profile = profileRes.rows[0];
  if (!profile) {
    return { error: { status: 404, message: 'Profile not found' } };
  }

  const countRes = await query(
    'SELECT COUNT(*)::int AS total FROM portfolio_items WHERE profile_id = $1',
    [profile.id]
  );
  const total = countRes.rows[0].total;
  if (total >= limit) {
    if (extraFile?.path && fs.existsSync(extraFile.path)) fs.unlinkSync(extraFile.path);
    return { error: { status: 403, message: limitMessage(membership, limit) } };
  }

  return { profile, membership, limit, total };
}

module.exports = {
  STARTER_PORTFOLIO_LIMIT,
  PREMIUM_PORTFOLIO_LIMIT,
  portfolioLimitFor,
  assertPortfolioCapacity,
};
