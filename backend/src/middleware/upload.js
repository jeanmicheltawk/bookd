const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const uploadRoot = path.resolve(process.cwd(), config.upload.dir);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(uploadRoot);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = (req.body.folder || req.query.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
    const dest = path.join(uploadRoot, folder);
    ensureDir(dest);
    req.uploadFolder = folder;
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|svg|mp4|webm|mov|pdf/;
  const ok = allowed.test(path.extname(file.originalname).toLowerCase().replace('.', '')) ||
    allowed.test(file.mimetype.split('/')[1] || '');
  if (ok) cb(null, true);
  else cb(new Error('Unsupported file type'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
});

module.exports = { upload, uploadRoot };
