const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 240);
}

async function listArticles(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 20 });
    const { category } = req.query;
    const params = [];
    const where = [`is_published = TRUE`];

    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM learning_articles ${whereSql}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT id, title, slug, category, cover_image, video_url, created_at, updated_at
       FROM learning_articles ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function getArticle(req, res, next) {
  try {
    const { idOrSlug } = req.params;
    const result = await query(
      `SELECT * FROM learning_articles WHERE id::text = $1 OR slug = $1`,
      [idOrSlug]
    );
    const article = result.rows[0];
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (!article.is_published && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (err) {
    next(err);
  }
}

async function createArticle(req, res, next) {
  try {
    const { title, slug, category, content, coverImage, videoUrl, isPublished } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });

    const result = await query(
      `INSERT INTO learning_articles (title, slug, category, content, cover_image, video_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        title.trim(),
        slug || slugify(title),
        category || null,
        content || null,
        coverImage || null,
        videoUrl || null,
        isPublished !== false,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    next(err);
  }
}

async function updateArticle(req, res, next) {
  try {
    const fields = ['title', 'slug', 'category', 'content', 'cover_image', 'video_url', 'is_published'];
    const bodyMap = {
      title: req.body.title,
      slug: req.body.slug,
      category: req.body.category,
      content: req.body.content,
      cover_image: req.body.coverImage,
      video_url: req.body.videoUrl,
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
      `UPDATE learning_articles SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    next(err);
  }
}

async function deleteArticle(req, res, next) {
  try {
    const result = await query('DELETE FROM learning_articles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Article not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

async function listAllArticlesAdmin(req, res, next) {
  try {
    const result = await query('SELECT * FROM learning_articles ORDER BY created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  listAllArticlesAdmin,
};
