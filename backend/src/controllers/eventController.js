const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 240);
}

async function listEvents(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 20 });
    const { type } = req.query;
    const params = [];
    const where = [`is_published = TRUE`];

    if (type) {
      params.push(type);
      where.push(`event_type = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM events ${whereSql}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT id, title, slug, description, event_type, cover_image, starts_at, ends_at, prize, created_at
       FROM events ${whereSql}
       ORDER BY starts_at DESC NULLS LAST, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function getEvent(req, res, next) {
  try {
    const { idOrSlug } = req.params;
    const result = await query(
      `SELECT * FROM events WHERE id::text = $1 OR slug = $1`,
      [idOrSlug]
    );
    const event = result.rows[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.is_published && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
}

async function createEvent(req, res, next) {
  try {
    const { title, slug, description, eventType, coverImage, startsAt, endsAt, prize, isPublished } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });

    const result = await query(
      `INSERT INTO events (title, slug, description, event_type, cover_image, starts_at, ends_at, prize, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        title.trim(),
        slug || slugify(title),
        description || null,
        eventType || 'challenge',
        coverImage || null,
        startsAt || null,
        endsAt || null,
        prize || null,
        isPublished !== false,
        req.user.id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    next(err);
  }
}

async function updateEvent(req, res, next) {
  try {
    const fields = ['title', 'slug', 'description', 'event_type', 'cover_image', 'starts_at', 'ends_at', 'prize', 'is_published'];
    const bodyMap = {
      title: req.body.title,
      slug: req.body.slug,
      description: req.body.description,
      event_type: req.body.eventType,
      cover_image: req.body.coverImage,
      starts_at: req.body.startsAt,
      ends_at: req.body.endsAt,
      prize: req.body.prize,
      is_published: req.body.isPublished,
    };

    const updates = [];
    const params = [];
    for (const f of fields) {
      if (bodyMap[f] !== undefined) {
        params.push(bodyMap[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE events SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    next(err);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const result = await query('DELETE FROM events WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

async function listAllEventsAdmin(req, res, next) {
  try {
    const result = await query('SELECT * FROM events ORDER BY created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listAllEventsAdmin,
};
