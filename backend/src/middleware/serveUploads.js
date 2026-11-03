const fs = require('fs');
const path = require('path');
const { uploadRoot } = require('./upload');
const { query } = require('../config/db');
const { sendMedia } = require('../utils/mediaOptimizer');

const FOLDER_RE = /^[a-zA-Z0-9_-]+$/;
const FILE_RE = /^[a-zA-Z0-9._-]+$/;

const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
};

function setUploadHeaders(res, mimeType) {
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if ((mimeType || '').toLowerCase() === 'application/pdf') {
    res.setHeader('Content-Disposition', 'inline');
  }
}

/**
 * Serves /uploads/:folder/:filename from Postgres (or local disk in dev),
 * resized/cached via mediaOptimizer. Use ?w=480 for smaller images.
 */
async function servePersistedUpload(req, res, next) {
  try {
    const rel = (req.path || '').replace(/^\/+/, '');
    const parts = rel.split('/');
    if (parts.length !== 2) return next();

    const [folder, filename] = parts;
    if (!FOLDER_RE.test(folder) || !FILE_RE.test(filename)) return next();

    const diskPath = path.join(uploadRoot, folder, filename);
    const extMime = EXT_MIME[path.extname(filename).toLowerCase()];

    const found = await sendMedia(req, res, {
      key: `bookd:${folder}/${filename}`,
      getMeta: async () => {
        const r = await query(
          `SELECT mime_type FROM media
           WHERE folder = $1 AND filename = $2 AND file_data IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [folder, filename]
        );
        if (r.rows[0]) return { mime: r.rows[0].mime_type || extMime };
        if (fs.existsSync(diskPath)) return { mime: extMime || 'application/octet-stream' };
        return null;
      },
      getData: async () => {
        const r = await query(
          `SELECT file_data FROM media
           WHERE folder = $1 AND filename = $2 AND file_data IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [folder, filename]
        );
        if (r.rows[0]?.file_data) return r.rows[0].file_data;
        if (fs.existsSync(diskPath)) return fs.readFileSync(diskPath);
        return null;
      },
      setHeaders: (response, meta, { contentType }) => {
        if (contentType === 'application/pdf') response.setHeader('Content-Disposition', 'inline');
      },
    });

    if (!found) return next();
  } catch (err) {
    next(err);
  }
}

module.exports = { servePersistedUpload, setUploadHeaders };
