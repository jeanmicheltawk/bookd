const { query, getClient } = require('../config/db');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

async function listCountries(_req, res, next) {
  try {
    const result = await query(
      `SELECT id, slug, name, sort_order, created_at
       FROM countries
       ORDER BY sort_order, name`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createCountry(req, res, next) {
  try {
    const { name, slug: rawSlug, sort_order: sortOrder } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Country name is required' });
    }
    const slug = slugify(rawSlug || name);
    if (!slug) return res.status(400).json({ error: 'Valid slug is required' });

    const result = await query(
      `INSERT INTO countries (slug, name, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, slug, name, sort_order, created_at`,
      [slug, String(name).trim(), Number(sortOrder) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Country already exists' });
    next(err);
  }
}

async function updateCountry(req, res, next) {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { name, slug: rawSlug, sort_order: sortOrder } = req.body;
    const updates = [];
    const params = [];
    let nextName = null;

    if (name !== undefined) {
      nextName = String(name).trim();
      if (!nextName) return res.status(400).json({ error: 'Country name is required' });
      if (nextName.length > 128) {
        return res.status(400).json({ error: 'Country name must be 128 characters or less' });
      }
      params.push(nextName);
      updates.push(`name = $${params.length}`);
    }
    if (rawSlug !== undefined) {
      const slug = slugify(rawSlug);
      if (!slug) return res.status(400).json({ error: 'Valid slug is required' });
      params.push(slug);
      updates.push(`slug = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      params.push(Number(sortOrder) || 0);
      updates.push(`sort_order = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    await client.query('BEGIN');
    const existing = await client.query('SELECT id, name, slug FROM countries WHERE id = $1', [id]);
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Country not found' });
    }

    const previousName = existing.rows[0].name;
    if (
      nextName &&
      rawSlug === undefined &&
      existing.rows[0].slug === slugify(previousName)
    ) {
      const slug = slugify(nextName);
      if (slug && slug !== existing.rows[0].slug) {
        params.push(slug);
        updates.push(`slug = $${params.length}`);
      }
    }

    params.push(id);
    const result = await client.query(
      `UPDATE countries SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, slug, name, sort_order, created_at`,
      params
    );

    if (nextName && nextName !== previousName) {
      await client.query(
        `UPDATE profiles SET country = $1, updated_at = NOW() WHERE country ILIKE $2`,
        [nextName, previousName]
      );
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Country already exists' });
    next(err);
  } finally {
    client.release();
  }
}

async function deleteCountry(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await query('SELECT id, name FROM countries WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Country not found' });

    const inUse = await query(
      `SELECT COUNT(*)::int AS total FROM profiles WHERE country ILIKE $1`,
      [existing.rows[0].name]
    );
    if (inUse.rows[0].total > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${inUse.rows[0].total} profile(s) still use this country`,
      });
    }

    const result = await query(
      `DELETE FROM countries WHERE id = $1
       RETURNING id, slug, name`,
      [id]
    );
    res.json({ deleted: true, ...result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCountries,
  createCountry,
  updateCountry,
  deleteCountry,
};
