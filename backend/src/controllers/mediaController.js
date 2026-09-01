const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { uploadRoot } = require('../middleware/upload');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');
const {
  MEDIA_PUBLIC_COLUMNS,
  mediaUrl,
  insertUploadedMedia,
  replaceUploadedMedia,
} = require('../utils/mediaStore');

async function listMedia(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 24, maxLimit: 100 });
    const { folder, q } = req.query;
    const params = [];
    const where = [];

    if (folder) {
      params.push(folder);
      where.push(`folder = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(original_name ILIKE $${params.length} OR alt_text ILIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM media ${whereSql}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT ${MEDIA_PUBLIC_COLUMNS}
       FROM media ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function listFolders(_req, res, next) {
  try {
    const result = await query(
      `SELECT folder, COUNT(*)::int AS count
       FROM media GROUP BY folder ORDER BY folder`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function uploadMedia(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const folder = req.uploadFolder || 'general';
    const { altText } = req.body;
    const { row } = await insertUploadedMedia({
      file: req.file,
      folder,
      altText,
      uploadedBy: req.user?.id || null,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
}

async function deleteMedia(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT ${MEDIA_PUBLIC_COLUMNS} FROM media WHERE id = $1`,
      [id]
    );
    const item = result.rows[0];
    if (!item) return res.status(404).json({ error: 'Media not found' });

    const filePath = path.join(uploadRoot, item.folder, item.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await query('DELETE FROM media WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (err) {
    next(err);
  }
}

async function replaceMedia(req, res, next) {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const existing = await query(
      `SELECT ${MEDIA_PUBLIC_COLUMNS} FROM media WHERE id = $1`,
      [id]
    );
    const item = existing.rows[0];
    if (!item) return res.status(404).json({ error: 'Media not found' });

    const oldPath = path.join(uploadRoot, item.folder, item.filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    const folder = req.uploadFolder || item.folder;
    const { altText } = req.body;
    const { row } = await replaceUploadedMedia({
      id,
      file: req.file,
      folder,
      altText,
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
}

async function getMediaById(req, res, next) {
  try {
    const result = await query(
      `SELECT ${MEDIA_PUBLIC_COLUMNS} FROM media WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Media not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMedia,
  listFolders,
  uploadMedia,
  deleteMedia,
  replaceMedia,
  getMediaById,
  mediaUrl,
};
