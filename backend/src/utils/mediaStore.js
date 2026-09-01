const fs = require('fs');
const { query } = require('../config/db');

const MEDIA_PUBLIC_COLUMNS =
  'id, filename, original_name, mime_type, size_bytes, url, folder, alt_text, uploaded_by, created_at';

function mediaUrl(folder, filename) {
  return `/uploads/${folder}/${filename}`;
}

function readUploadBuffer(file) {
  if (file.buffer) return file.buffer;
  return fs.readFileSync(file.path);
}

async function insertUploadedMedia({ file, folder, altText, uploadedBy }) {
  const url = mediaUrl(folder, file.filename);
  const fileData = readUploadBuffer(file);
  const result = await query(
    `INSERT INTO media (filename, original_name, mime_type, size_bytes, url, folder, alt_text, uploaded_by, file_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${MEDIA_PUBLIC_COLUMNS}`,
    [
      file.filename,
      file.originalname,
      file.mimetype,
      file.size,
      url,
      folder,
      altText || null,
      uploadedBy || null,
      fileData,
    ]
  );
  return { url, row: result.rows[0] };
}

async function replaceUploadedMedia({ id, file, folder, altText }) {
  const url = mediaUrl(folder, file.filename);
  const fileData = readUploadBuffer(file);
  const result = await query(
    `UPDATE media SET
       filename = $1, original_name = $2, mime_type = $3, size_bytes = $4,
       url = $5, folder = $6, alt_text = COALESCE($7, alt_text), file_data = $8
     WHERE id = $9
     RETURNING ${MEDIA_PUBLIC_COLUMNS}`,
    [
      file.filename,
      file.originalname,
      file.mimetype,
      file.size,
      url,
      folder,
      altText ?? null,
      fileData,
      id,
    ]
  );
  return { url, row: result.rows[0] };
}

async function getMediaFile(folder, filename) {
  const result = await query(
    `SELECT mime_type, file_data
     FROM media
     WHERE folder = $1 AND filename = $2 AND file_data IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [folder, filename]
  );
  return result.rows[0] || null;
}

module.exports = {
  MEDIA_PUBLIC_COLUMNS,
  mediaUrl,
  insertUploadedMedia,
  replaceUploadedMedia,
  getMediaFile,
};
