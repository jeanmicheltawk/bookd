const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');
const { notify, displayName } = require('../utils/notify');
const { emailAdmin } = require('../utils/mailer');

async function listApproved(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 20 });
    const { category, type, location } = req.query;
    const params = [];
    const where = [`a.status = 'approved'`];

    if (category) {
      params.push(category);
      where.push(`c.slug = $${params.length}`);
    }
    if (type) {
      params.push(`%${type}%`);
      where.push(`a.announcement_type ILIKE $${params.length}`);
    }
    if (location) {
      params.push(`%${location}%`);
      where.push(`a.location ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM announcements a
       LEFT JOIN categories c ON c.id = a.required_category_id ${whereSql}`,
      params
    );
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT a.id, a.title, a.announcement_type, a.description, a.budget, a.is_paid,
              a.location, a.deadline, a.people_needed, a.moodboard_urls, a.status, a.created_at,
              c.slug AS required_category_slug, c.name AS required_category_name,
              p.full_name AS author_name, p.professional_name AS author_professional_name,
              p.profile_photo_url AS author_photo
       FROM announcements a
       LEFT JOIN categories c ON c.id = a.required_category_id
       JOIN profiles p ON p.user_id = a.author_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function getAnnouncement(req, res, next) {
  try {
    const result = await query(
      `SELECT a.*, c.slug AS required_category_slug, c.name AS required_category_name,
              p.full_name AS author_name, p.professional_name AS author_professional_name,
              p.profile_photo_url AS author_photo
       FROM announcements a
       LEFT JOIN categories c ON c.id = a.required_category_id
       JOIN profiles p ON p.user_id = a.author_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: 'Announcement not found' });
    if (item.status !== 'approved' && item.author_id !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function createAnnouncement(req, res, next) {
  try {
    const {
      title, announcementType, description, budget, isPaid, location,
      deadline, requiredCategoryId, requiredCategorySlug, peopleNeeded, moodboardUrls,
    } = req.body;
    if (!title?.trim() || !announcementType?.trim()) {
      return res.status(400).json({ error: 'title and announcementType required' });
    }

    let categoryId = requiredCategoryId || null;
    if (requiredCategorySlug) {
      const cat = await query('SELECT id FROM categories WHERE slug = $1', [requiredCategorySlug]);
      categoryId = cat.rows[0]?.id || null;
    }

    const result = await query(
      `INSERT INTO announcements (
         author_id, title, announcement_type, description, budget, is_paid, location,
         deadline, required_category_id, people_needed, moodboard_urls, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING *`,
      [
        req.user.id,
        title.trim(),
        announcementType.trim(),
        description || null,
        budget ?? null,
        isPaid !== false,
        location || null,
        deadline || null,
        categoryId,
        peopleNeeded ?? 1,
        moodboardUrls || null,
      ]
    );
    void emailAdmin(
      'New announcement submitted',
      `"${title.trim()}" was submitted and is waiting for review.`
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function applyToAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const ann = await query(
      `SELECT id, status, author_id FROM announcements WHERE id = $1`,
      [id]
    );
    if (!ann.rows[0] || ann.rows[0].status !== 'approved') {
      return res.status(404).json({ error: 'Announcement not available' });
    }
    if (ann.rows[0].author_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot apply to your own announcement' });
    }

    const result = await query(
      `INSERT INTO announcement_applications (announcement_id, applicant_id, message)
       VALUES ($1, $2, $3)
       ON CONFLICT (announcement_id, applicant_id) DO UPDATE SET message = EXCLUDED.message
       RETURNING *`,
      [id, req.user.id, message || null]
    );
    const applicantName = await displayName(req.user.id);
    await notify(
      ann.rows[0].author_id,
      'New announcement application',
      `${applicantName} applied to your announcement.`,
      '/dashboard'
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listAllAdmin(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 25 });
    const { status } = req.query;
    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM announcements a ${whereSql}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT a.*, p.full_name AS author_name, c.name AS required_category_name
       FROM announcements a
       JOIN profiles p ON p.user_id = a.author_id
       LEFT JOIN categories c ON c.id = a.required_category_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function moderateAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['pending', 'approved', 'rejected', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const result = await query(
      `UPDATE announcements SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Announcement not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listMyAnnouncements(req, res, next) {
  try {
    const result = await query(
      `SELECT * FROM announcements WHERE author_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listApplications(req, res, next) {
  try {
    const ann = await query('SELECT author_id FROM announcements WHERE id = $1', [req.params.id]);
    if (!ann.rows[0]) return res.status(404).json({ error: 'Announcement not found' });
    if (ann.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await query(
      `SELECT aa.*, p.full_name, p.professional_name, p.profile_photo_url, c.name AS category_name
       FROM announcement_applications aa
       JOIN profiles p ON p.user_id = aa.applicant_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE aa.announcement_id = $1
       ORDER BY aa.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listApproved,
  getAnnouncement,
  createAnnouncement,
  applyToAnnouncement,
  listAllAdmin,
  moderateAnnouncement,
  listMyAnnouncements,
  listApplications,
};
