const fs = require('fs');
const path = require('path');
const { uploadRoot } = require('./upload');
const { getMediaFile } = require('../utils/mediaStore');

const FOLDER_RE = /^[a-zA-Z0-9_-]+$/;
const FILE_RE = /^[a-zA-Z0-9._-]+$/;

function setUploadHeaders(res, mimeType) {
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if ((mimeType || '').toLowerCase() === 'application/pdf') {
    res.setHeader('Content-Disposition', 'inline');
  }
}

async function servePersistedUpload(req, res, next) {
  try {
    const rel = (req.path || '').replace(/^\/+/, '');
    const parts = rel.split('/');
    if (parts.length !== 2) return next();

    const [folder, filename] = parts;
    if (!FOLDER_RE.test(folder) || !FILE_RE.test(filename)) return next();

    const row = await getMediaFile(folder, filename);
    if (!row?.file_data) return next();

    const diskPath = path.join(uploadRoot, folder, filename);
    try {
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      fs.writeFileSync(diskPath, row.file_data);
    } catch {
      // Ephemeral or read-only disk — still serve from Postgres.
    }

    setUploadHeaders(res, row.mime_type);
    return res.end(row.file_data);
  } catch (err) {
    next(err);
  }
}

module.exports = { servePersistedUpload, setUploadHeaders };
