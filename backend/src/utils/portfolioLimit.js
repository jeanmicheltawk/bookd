const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { effectiveMembership } = require('./subscription');

const STARTER_FILE_LIMIT = 10;
const STARTER_LINK_LIMIT = 10;
const PREMIUM_FILE_LIMIT = 35;
const PREMIUM_LINK_LIMIT = 15;

function portfolioCapsFor(membership) {
  if (membership === 'premium') {
    return { files: PREMIUM_FILE_LIMIT, links: PREMIUM_LINK_LIMIT, allowPdf: true };
  }
  return { files: STARTER_FILE_LIMIT, links: STARTER_LINK_LIMIT, allowPdf: false };
}

function unlinkExtra(extraFile) {
  if (extraFile?.path && fs.existsSync(extraFile.path)) fs.unlinkSync(extraFile.path);
}

function isPdfFile(file) {
  if (!file) return false;
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname || '').toLowerCase();
  return mime === 'application/pdf' || mime === 'application/x-pdf' || ext === '.pdf';
}

function fileLimitMessage(membership, caps) {
  if (membership === 'premium') {
    return `Premium plan allows up to ${caps.files} portfolio images/PDFs.`;
  }
  return `Starter plan allows ${caps.files} portfolio images. Upgrade to Premium plan for ${PREMIUM_FILE_LIMIT} images/PDFs.`;
}

function linkLimitMessage(membership, caps) {
  if (membership === 'premium') {
    return `Premium plan allows up to ${caps.links} video links.`;
  }
  return `Starter plan allows ${caps.links} video links. Upgrade to Premium plan for ${PREMIUM_LINK_LIMIT}.`;
}

async function assertPortfolioCapacity(userId, { extraFile, kind } = {}) {
  const userRes = await query(
    `SELECT role, membership, approval_status, is_complimentary, membership_ends_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const membership = effectiveMembership(userRes.rows[0] || {});
  const caps = portfolioCapsFor(membership);
  const itemKind = kind === 'video' ? 'video' : 'file';

  const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
  const profile = profileRes.rows[0];
  if (!profile) {
    unlinkExtra(extraFile);
    return { error: { status: 404, message: 'Profile not found' } };
  }

  if (itemKind === 'file' && !caps.allowPdf && isPdfFile(extraFile)) {
    unlinkExtra(extraFile);
    return {
      error: {
        status: 403,
        message: 'Starter plan allows images only. Upgrade to Premium plan to upload PDFs.',
      },
    };
  }

  const countRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE media_type = 'video')::int AS links,
       COUNT(*) FILTER (WHERE media_type <> 'video')::int AS files
     FROM portfolio_items WHERE profile_id = $1`,
    [profile.id]
  );
  const files = countRes.rows[0].files;
  const links = countRes.rows[0].links;

  if (itemKind === 'video') {
    if (links >= caps.links) {
      unlinkExtra(extraFile);
      return { error: { status: 403, message: linkLimitMessage(membership, caps) } };
    }
  } else if (files >= caps.files) {
    unlinkExtra(extraFile);
    return { error: { status: 403, message: fileLimitMessage(membership, caps) } };
  }

  return { profile, membership, caps, files, links };
}

module.exports = {
  STARTER_FILE_LIMIT,
  STARTER_LINK_LIMIT,
  PREMIUM_FILE_LIMIT,
  PREMIUM_LINK_LIMIT,
  portfolioCapsFor,
  assertPortfolioCapacity,
};
