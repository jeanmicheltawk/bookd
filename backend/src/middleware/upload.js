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

function fileFilterFor(allowed) {
  return (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mimePart = (file.mimetype.split('/')[1] || '').toLowerCase();
    const ok = allowed.test(ext) || allowed.test(mimePart);
    if (ok) cb(null, true);
    else cb(Object.assign(new Error('Unsupported file type'), { status: 400 }));
  };
}

const fileFilter = fileFilterFor(/jpeg|jpg|png|gif|webp|svg|mp4|webm|mov|pdf/);
const imageFileFilter = fileFilterFor(/jpeg|jpg|png|gif|webp/);

const limits = { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 };

const upload = multer({ storage, fileFilter, limits });
const imageUpload = multer({ storage, fileFilter: imageFileFilter, limits });

function forceUploadFolder(folder) {
  return (req, _res, next) => {
    req.query.folder = folder;
    next();
  };
}

module.exports = { upload, imageUpload, forceUploadFolder, uploadRoot };
