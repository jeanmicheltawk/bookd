const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { insertUploadedMedia } = require('../utils/mediaStore');
const { uploadRoot } = require('../middleware/upload');

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
  return fallback;
}

function unlinkNewsImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('/uploads/news/')) return;
  const filePath = path.join(uploadRoot, imageUrl.replace(/^\/uploads\//, ''));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function saveNewsImage(req, title) {
  if (!req.file) return null;
  const folder = req.uploadFolder || 'news';
  const { url } = await insertUploadedMedia({
    file: req.file,
    folder,
    altText: title || 'News image',
    uploadedBy: req.user.id,
  });
  return url;
}

async function listPublished(req, res, next) {
  try {
    const result = await query(
      `SELECT id, title, body, image_url, created_at, updated_at
       FROM news
       WHERE is_published = TRUE
       ORDER BY sort_order ASC, created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getNews(req, res, next) {
  try {
    const result = await query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: 'News not found' });
    if (!item.is_published && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'News not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function listAllAdmin(_req, res, next) {
  try {
    const result = await query('SELECT * FROM news ORDER BY sort_order ASC, created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createNews(req, res, next) {
  try {
    const { title, body, sortOrder } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    if (!req.file) return res.status(400).json({ error: 'An image is required.' });

    const imageUrl = await saveNewsImage(req, title.trim());
    const result = await query(
      `INSERT INTO news (title, body, image_url, is_published, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        body?.trim() || null,
        imageUrl,
        parseBool(req.body.isPublished, true),
        Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        req.user.id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateNews(req, res, next) {
  try {
    const existing = await query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    const current = existing.rows[0];
    if (!current) return res.status(404).json({ error: 'News not found' });

    const fields = ['title', 'body', 'image_url', 'is_published', 'sort_order'];
    const nextTitle = req.body.title !== undefined ? String(req.body.title).trim() : current.title;
    const bodyMap = {
      title: req.body.title !== undefined ? nextTitle : undefined,
      body: req.body.body,
      is_published: req.body.isPublished !== undefined ? parseBool(req.body.isPublished, current.is_published) : undefined,
      sort_order: req.body.sortOrder,
    };

    if (req.file) {
      bodyMap.image_url = await saveNewsImage(req, nextTitle);
      unlinkNewsImage(current.image_url);
    } else if (parseBool(req.body.removeImage, false)) {
      return res.status(400).json({ error: 'An image is required.' });
    }

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
      `UPDATE news SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteNews(req, res, next) {
  try {
    const result = await query('DELETE FROM news WHERE id = $1 RETURNING id, image_url', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'News not found' });
    unlinkNewsImage(result.rows[0].image_url);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPublished,
  getNews,
  listAllAdmin,
  createNews,
  updateNews,
  deleteNews,
};
