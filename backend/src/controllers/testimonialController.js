const { query } = require('../config/db');

async function listPublished(_req, res, next) {
  try {
    const result = await query(
      `SELECT id, author_name, author_role, author_photo, content, rating, sort_order, created_at
       FROM testimonials WHERE is_published = TRUE ORDER BY sort_order, created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listAllAdmin(_req, res, next) {
  try {
    const result = await query('SELECT * FROM testimonials ORDER BY sort_order, created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createTestimonial(req, res, next) {
  try {
    const { authorName, authorRole, authorPhoto, content, rating, isPublished, sortOrder } = req.body;
    if (!authorName?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'authorName and content required' });
    }

    const result = await query(
      `INSERT INTO testimonials (author_name, author_role, author_photo, content, rating, is_published, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        authorName.trim(),
        authorRole || null,
        authorPhoto || null,
        content.trim(),
        rating ?? null,
        isPublished !== false,
        sortOrder ?? 0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateTestimonial(req, res, next) {
  try {
    const fields = ['author_name', 'author_role', 'author_photo', 'content', 'rating', 'is_published', 'sort_order'];
    const bodyMap = {
      author_name: req.body.authorName,
      author_role: req.body.authorRole,
      author_photo: req.body.authorPhoto,
      content: req.body.content,
      rating: req.body.rating,
      is_published: req.body.isPublished,
      sort_order: req.body.sortOrder,
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
      `UPDATE testimonials SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Testimonial not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteTestimonial(req, res, next) {
  try {
    const result = await query('DELETE FROM testimonials WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Testimonial not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublished,
  listAllAdmin,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
};
