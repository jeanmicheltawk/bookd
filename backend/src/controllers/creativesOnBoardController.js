const { query } = require('../config/db');

const PROFILE_SELECT = `cob.id AS board_id, cob.sort_order, cob.created_at AS boarded_at,
              p.id, p.full_name, p.professional_name, p.country, p.city, p.profile_photo_url,
              p.availability, p.custom_url, u.membership, u.is_verified,
              c.slug AS category_slug, c.name AS category_name`;

const PROFILE_FROM = `FROM creatives_on_board cob
       JOIN profiles p ON p.id = cob.profile_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id`;

async function listPublic(_req, res, next) {
  try {
    const result = await query(
      `SELECT ${PROFILE_SELECT}
       ${PROFILE_FROM}
       WHERE p.is_public = TRUE
         AND u.is_active = TRUE
         AND u.role = 'member'
         AND u.approval_status = 'approved'
       ORDER BY cob.sort_order ASC, cob.created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listCandidates(req, res, next) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const params = [];
    const where = [
      `u.role = 'member'`,
      `u.approval_status = 'approved'`,
      `u.is_active = TRUE`,
      `NOT EXISTS (SELECT 1 FROM creatives_on_board cob WHERE cob.profile_id = p.id)`,
    ];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.full_name ILIKE $${params.length} OR p.professional_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const result = await query(
      `SELECT p.id, p.full_name, p.professional_name, p.country, p.city, p.profile_photo_url,
              p.availability, p.custom_url, u.membership, u.is_verified,
              c.slug AS category_slug, c.name AS category_name
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY LOWER(COALESCE(p.professional_name, p.full_name, u.email))`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listAdmin(_req, res, next) {
  try {
    const result = await query(
      `SELECT ${PROFILE_SELECT}
       ${PROFILE_FROM}
       ORDER BY cob.sort_order ASC, cob.created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function addToBoard(req, res, next) {
  try {
    const profileId = req.body.profileId || req.body.profile_id;
    if (!profileId) return res.status(400).json({ error: 'profileId required' });

    const profile = await query(
      `SELECT p.id
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1
         AND u.is_active = TRUE
         AND u.role = 'member'
         AND u.approval_status = 'approved'`,
      [profileId]
    );
    if (!profile.rows[0]) {
      return res.status(404).json({ error: 'Approved creative profile not found' });
    }

    const result = await query(
      `INSERT INTO creatives_on_board (profile_id, sort_order, created_by)
       VALUES (
         $1,
         (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM creatives_on_board),
         $2
       )
       ON CONFLICT (profile_id) DO NOTHING
       RETURNING *`,
      [profileId, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(409).json({ error: 'That creative is already on board' });
    }

    const row = await query(
      `SELECT ${PROFILE_SELECT} ${PROFILE_FROM} WHERE cob.id = $1`,
      [result.rows[0].id]
    );
    res.status(201).json(row.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function moveOnBoard(req, res, next) {
  try {
    const { direction } = req.body;
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be up or down' });
    }

    const current = await query(
      'SELECT id, sort_order FROM creatives_on_board WHERE id = $1',
      [req.params.id]
    );
    if (!current.rows[0]) return res.status(404).json({ error: 'Not found' });

    const neighborSql = direction === 'up'
      ? 'SELECT id, sort_order FROM creatives_on_board WHERE sort_order < $1 ORDER BY sort_order DESC LIMIT 1'
      : 'SELECT id, sort_order FROM creatives_on_board WHERE sort_order > $1 ORDER BY sort_order ASC LIMIT 1';
    const neighbor = await query(neighborSql, [current.rows[0].sort_order]);
    if (!neighbor.rows[0]) return res.json({ success: true });

    await query('UPDATE creatives_on_board SET sort_order = $1 WHERE id = $2', [
      neighbor.rows[0].sort_order,
      current.rows[0].id,
    ]);
    await query('UPDATE creatives_on_board SET sort_order = $1 WHERE id = $2', [
      current.rows[0].sort_order,
      neighbor.rows[0].id,
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function removeFromBoard(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM creatives_on_board WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublic,
  listAdmin,
  listCandidates,
  addToBoard,
  moveOnBoard,
  removeFromBoard,
};
