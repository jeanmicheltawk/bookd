const { query } = require('../config/db');

async function getAllSettings(_req, res, next) {
  try {
    const result = await query('SELECT key, value, updated_at FROM website_settings ORDER BY key');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

async function getSettingByKey(req, res, next) {
  try {
    const { key } = req.params;
    const result = await query('SELECT key, value, updated_at FROM website_settings WHERE key = $1', [key]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Setting not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateSettingByKey(req, res, next) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value required' });

    const result = await query(
      `INSERT INTO website_settings (key, value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, JSON.stringify(value)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getTheme(_req, res, next) {
  try {
    const result = await query(
      `SELECT id, name, is_active, primary_color, secondary_color, accent_color,
              background_color, text_color, button_color, button_text_color,
              gradient_from, gradient_to, verified_badge_color, updated_at
       FROM theme_settings WHERE is_active = TRUE LIMIT 1`
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No active theme' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateTheme(req, res, next) {
  try {
    const fields = [
      'name', 'primary_color', 'secondary_color', 'accent_color',
      'background_color', 'text_color', 'button_color', 'button_text_color',
      'gradient_from', 'gradient_to', 'verified_badge_color',
    ];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.body.id || null);
    const whereClause = req.body.id ? `id = $${params.length}` : 'is_active = TRUE';

    const result = await query(
      `UPDATE theme_settings SET ${updates.join(', ')}, updated_at = NOW()
       WHERE ${whereClause}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Theme not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getPageBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const page = await query(
      `SELECT id, slug, title, meta_title, meta_description, og_image, is_published, created_at, updated_at
       FROM pages WHERE slug = $1`,
      [slug]
    );
    if (!page.rows[0]) return res.status(404).json({ error: 'Page not found' });
    if (!page.rows[0].is_published && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'Page not found' });
    }

    const sections = await query(
      `SELECT id, key, title, subtitle, content, media_url, cta_label, cta_url, sort_order, is_visible, updated_at
       FROM sections WHERE page_id = $1
       ${req.user?.role === 'admin' ? '' : 'AND is_visible = TRUE'}
       ORDER BY sort_order, key`,
      [page.rows[0].id]
    );

    res.json({ ...page.rows[0], sections: sections.rows });
  } catch (err) {
    next(err);
  }
}

async function updatePageBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const fields = ['title', 'meta_title', 'meta_description', 'og_image', 'is_published'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(slug);
    const result = await query(
      `UPDATE pages SET ${updates.join(', ')}, updated_at = NOW()
       WHERE slug = $${params.length}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Page not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getPageSections(req, res, next) {
  try {
    const { slug } = req.params;
    const page = await query('SELECT id FROM pages WHERE slug = $1', [slug]);
    if (!page.rows[0]) return res.status(404).json({ error: 'Page not found' });

    const sections = await query(
      `SELECT id, key, title, subtitle, content, media_url, cta_label, cta_url, sort_order, is_visible, updated_at
       FROM sections WHERE page_id = $1
       ${req.user?.role === 'admin' ? '' : 'AND is_visible = TRUE'}
       ORDER BY sort_order, key`,
      [page.rows[0].id]
    );
    res.json({ data: sections.rows });
  } catch (err) {
    next(err);
  }
}

async function updateSection(req, res, next) {
  try {
    const { id } = req.params;
    const fields = ['title', 'subtitle', 'content', 'media_url', 'cta_label', 'cta_url', 'sort_order', 'is_visible'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'content') {
          params.push(JSON.stringify(req.body[f]));
          updates.push(`${f} = $${params.length}::jsonb`);
        } else {
          params.push(req.body[f]);
          updates.push(`${f} = $${params.length}`);
        }
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const result = await query(
      `UPDATE sections SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Section not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllSettings,
  getSettingByKey,
  updateSettingByKey,
  getTheme,
  updateTheme,
  getPageBySlug,
  updatePageBySlug,
  getPageSections,
  updateSection,
};
