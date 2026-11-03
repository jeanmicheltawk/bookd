/**
 * mediaOptimizer — cut outbound bandwidth for media stored in Postgres.
 *
 * - Images (jpeg/png/webp) are resized + re-encoded on first request and
 *   cached on local disk. `?w=480` picks a width; no `?w` caps at 1600px.
 *   `?original=1` or `?download=1` returns the untouched original.
 * - WebP is served to browsers that accept it (all modern ones).
 * - Everything (videos, PDFs, variants) goes out via res.sendFile, which
 *   gives proper Range (206) support, ETag and 304 Not Modified. Before this,
 *   every <video> request re-downloaded the whole file.
 * - Postgres is only read on a cache miss, so repeat requests are cheap.
 */
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let sharp = null;
try {
  // eslint-disable-next-line global-require
  sharp = require('sharp');
  sharp.concurrency(1); // keep memory low on 512 MB instances
  sharp.cache(false);
} catch {
  console.warn('[media] sharp not installed — serving originals without resizing');
}

const CACHE_DIR = process.env.MEDIA_CACHE_DIR || path.join(os.tmpdir(), 'media-cache');
const CACHE_MAX_BYTES = parseInt(process.env.MEDIA_CACHE_MAX_MB || '1024', 10) * 1024 * 1024;
const WIDTHS = [96, 160, 320, 480, 640, 960, 1280, 1600];
const DEFAULT_MAX_WIDTH = 1600;
const RESIZABLE = new Set(['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp']);
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

fs.mkdirSync(CACHE_DIR, { recursive: true });

const metaCache = new Map(); // key -> { mime, filename } (small strings only)
const inflight = new Map(); // cache file path -> Promise<string>

// One sharp job at a time so a burst of requests can't OOM the instance.
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function hashName(...parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

function pickWidth(raw) {
  const n = parseInt(raw, 10);
  if (!n || n <= 0) return DEFAULT_MAX_WIDTH;
  return WIDTHS.find((w) => w >= n) || DEFAULT_MAX_WIDTH;
}

function pickFormat(req, mime) {
  const accept = String(req.headers.accept || '');
  if (accept.includes('image/webp')) return 'webp';
  return mime === 'image/png' ? 'png' : 'jpeg';
}

function isTruthyFlag(v) {
  return v != null && v !== '0' && v !== 'false';
}

async function writeAtomic(file, buffer) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, buffer);
  await fsp.rename(tmp, file);
}

function once(file, build) {
  if (fs.existsSync(file)) return Promise.resolve(file);
  if (inflight.has(file)) return inflight.get(file);
  const p = build()
    .then(() => file)
    .finally(() => inflight.delete(file));
  inflight.set(file, p);
  return p;
}

function originalFile(key, getData) {
  const file = path.join(CACHE_DIR, `o_${hashName(key)}`);
  return once(file, async () => {
    const data = await getData();
    if (!data) throw Object.assign(new Error('Media data missing'), { status: 404 });
    await writeAtomic(file, data);
  });
}

function variantFile(key, getData, width, format) {
  const file = path.join(CACHE_DIR, `v_${hashName(key, width, format)}.${format}`);
  return once(file, () =>
    enqueue(async () => {
      if (fs.existsSync(file)) return;
      const data = await getData();
      if (!data) throw Object.assign(new Error('Media data missing'), { status: 404 });
      let img = sharp(data, { failOn: 'none' })
        .rotate()
        .resize({ width, withoutEnlargement: true });
      if (format === 'webp') img = img.webp({ quality: 78 });
      else if (format === 'png') img = img.png({ compressionLevel: 9, palette: true });
      else img = img.jpeg({ quality: 80, mozjpeg: true });
      await writeAtomic(file, await img.toBuffer());
    })
  );
}

/**
 * @param {object} opts
 * @param {string} opts.key        stable unique id for this file (changes when the file changes)
 * @param {() => Promise<{mime: string, filename?: string} | null>} opts.getMeta  cheap lookup, no bytes
 * @param {() => Promise<Buffer | null>} opts.getData  full bytes, only called on cache miss
 * @param {(res, meta, info) => void} [opts.setHeaders]  extra headers (e.g. Content-Disposition)
 * @returns {Promise<boolean>} false if the media does not exist
 */
async function sendMedia(req, res, { key, getMeta, getData, setHeaders }) {
  let meta = metaCache.get(key);
  if (!meta) {
    meta = await getMeta();
    if (!meta) return false;
    metaCache.set(key, meta);
  }

  // Memoise the bytes for this request so a miss only reads Postgres once.
  let dataPromise = null;
  const loadData = () => {
    if (!dataPromise) dataPromise = getData();
    return dataPromise;
  };

  const mime = String(meta.mime || 'application/octet-stream').toLowerCase();
  const wantsOriginal = isTruthyFlag(req.query.original) || isTruthyFlag(req.query.download);
  const canResize = sharp && RESIZABLE.has(mime) && !wantsOriginal;

  let file;
  let contentType = mime;
  if (canResize) {
    const format = pickFormat(req, mime);
    const width = pickWidth(req.query.w);
    try {
      file = await variantFile(key, loadData, width, format);
      contentType = `image/${format}`;
      res.setHeader('Vary', 'Accept');
    } catch (err) {
      if (err.status === 404) return false;
      console.warn(`[media] resize failed for ${key}: ${err.message} — serving original`);
      file = null;
    }
  }
  if (!file) {
    try {
      file = await originalFile(key, loadData);
    } catch (err) {
      if (err.status === 404) return false;
      throw err;
    }
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (setHeaders) setHeaders(res, meta, { wantsOriginal, contentType });

  await new Promise((resolve, reject) => {
    res.sendFile(file, { maxAge: ONE_YEAR, immutable: true, lastModified: true }, (err) => {
      if (err && !res.headersSent) reject(err);
      else resolve();
    });
  });
  return true;
}

/** Keep the disk cache under MEDIA_CACHE_MAX_MB by deleting least-recently-used files. */
async function pruneCache() {
  try {
    const names = await fsp.readdir(CACHE_DIR);
    const files = [];
    let total = 0;
    for (const name of names) {
      if (name.endsWith('.tmp')) continue;
      const full = path.join(CACHE_DIR, name);
      const st = await fsp.stat(full).catch(() => null);
      if (!st) continue;
      files.push({ full, size: st.size, used: st.atimeMs || st.mtimeMs });
      total += st.size;
    }
    if (total <= CACHE_MAX_BYTES) return;
    files.sort((a, b) => a.used - b.used);
    for (const f of files) {
      if (total <= CACHE_MAX_BYTES * 0.8) break;
      await fsp.unlink(f.full).catch(() => undefined);
      total -= f.size;
    }
  } catch (err) {
    console.warn('[media] cache prune failed:', err.message);
  }
}
setInterval(pruneCache, 30 * 60 * 1000).unref();

module.exports = { sendMedia, pruneCache, CACHE_DIR };
