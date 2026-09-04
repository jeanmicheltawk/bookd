const { query, getClient } = require('../config/db');

const FIELD_TYPES = ['text', 'number', 'dropdown', 'textarea'];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeOptions(options, fieldType) {
  if (fieldType !== 'dropdown') return [];
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => String(o).trim())
    .filter(Boolean)
    .slice(0, 50);
}

async function listCategories(req, res, next) {
  try {
    const searchableOnly = req.query.searchable === 'true';
    const result = await query(
      `SELECT c.id, c.slug, c.name, c.is_searchable, c.sort_order, c.created_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', f.id,
                    'field_key', f.field_key,
                    'label', f.label,
                    'field_type', f.field_type,
                    'options', f.options,
                    'is_required', f.is_required,
                    'sort_order', f.sort_order
                  )
                  ORDER BY f.sort_order, f.label
                ) FILTER (WHERE f.id IS NOT NULL),
                '[]'::json
              ) AS fields
       FROM categories c
       LEFT JOIN category_fields f ON f.category_id = c.id
       ${searchableOnly ? 'WHERE c.is_searchable = TRUE' : ''}
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, slug: rawSlug, is_searchable: isSearchable, sort_order: sortOrder } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const slug = slugify(rawSlug || name);
    if (!slug) return res.status(400).json({ error: 'Valid slug is required' });

    const result = await query(
      `INSERT INTO categories (slug, name, is_searchable, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, name, is_searchable, sort_order, created_at`,
      [slug, String(name).trim(), isSearchable !== false, Number(sortOrder) || 0]
    );
    res.status(201).json({ ...result.rows[0], fields: [] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category slug already exists' });
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug: rawSlug, is_searchable: isSearchable, sort_order: sortOrder } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Category name is required' });
      params.push(String(name).trim());
      updates.push(`name = $${params.length}`);
    }
    if (rawSlug !== undefined) {
      const slug = slugify(rawSlug);
      if (!slug) return res.status(400).json({ error: 'Valid slug is required' });
      params.push(slug);
      updates.push(`slug = $${params.length}`);
    }
    if (isSearchable !== undefined) {
      params.push(!!isSearchable);
      updates.push(`is_searchable = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      params.push(Number(sortOrder) || 0);
      updates.push(`sort_order = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const result = await query(
      `UPDATE categories SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, slug, name, is_searchable, sort_order, created_at`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category slug already exists' });
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const inUse = await query(
      `SELECT COUNT(*)::int AS total FROM profiles WHERE category_id = $1`,
      [id]
    );
    if (inUse.rows[0].total > 0) {
      return res.status(409).json({
        error: `Cannot delete: ${inUse.rows[0].total} profile(s) still use this category`,
      });
    }

    const result = await query(
      `DELETE FROM categories WHERE id = $1
       RETURNING id, slug, name`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json({ deleted: true, ...result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function createCategoryField(req, res, next) {
  try {
    const { id: categoryId } = req.params;
    const {
      label,
      field_key: rawKey,
      field_type: fieldType = 'text',
      options,
      is_required: isRequired = false,
      sort_order: sortOrder,
    } = req.body;

    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: 'Field label is required' });
    }
    if (!FIELD_TYPES.includes(fieldType)) {
      return res.status(400).json({ error: 'Invalid field type' });
    }

    const cat = await query('SELECT id FROM categories WHERE id = $1', [categoryId]);
    if (!cat.rows[0]) return res.status(404).json({ error: 'Category not found' });

    const fieldKey = slugify(rawKey || label).replace(/-/g, '_');
    if (!fieldKey) return res.status(400).json({ error: 'Valid field key is required' });

    const normalizedOptions = normalizeOptions(options, fieldType);
    if (fieldType === 'dropdown' && !normalizedOptions.length) {
      return res.status(400).json({ error: 'Dropdown fields need at least one option' });
    }

    let nextOrder;
    if (sortOrder === undefined || sortOrder === null || sortOrder === '') {
      const maxRes = await query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM category_fields WHERE category_id = $1`,
        [categoryId]
      );
      nextOrder = maxRes.rows[0].next;
    } else {
      nextOrder = Number(sortOrder);
      if (Number.isNaN(nextOrder)) nextOrder = 0;
    }

    const result = await query(
      `INSERT INTO category_fields
         (category_id, field_key, label, field_type, options, is_required, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id, category_id, field_key, label, field_type, options, is_required, sort_order, created_at`,
      [
        categoryId,
        fieldKey,
        String(label).trim(),
        fieldType,
        JSON.stringify(normalizedOptions),
        !!isRequired,
        nextOrder,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Field key already exists on this category' });
    next(err);
  }
}

async function updateCategoryField(req, res, next) {
  try {
    const { id: categoryId, fieldId } = req.params;
    const {
      label,
      field_key: rawKey,
      field_type: fieldType,
      options,
      is_required: isRequired,
      sort_order: sortOrder,
    } = req.body;

    const existing = await query(
      `SELECT * FROM category_fields WHERE id = $1 AND category_id = $2`,
      [fieldId, categoryId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Field not found' });

    const current = existing.rows[0];
    const nextType = fieldType || current.field_type;
    if (fieldType !== undefined && !FIELD_TYPES.includes(fieldType)) {
      return res.status(400).json({ error: 'Invalid field type' });
    }

    const updates = [];
    const params = [];

    if (label !== undefined) {
      if (!String(label).trim()) return res.status(400).json({ error: 'Field label is required' });
      params.push(String(label).trim());
      updates.push(`label = $${params.length}`);
    }
    if (rawKey !== undefined) {
      const fieldKey = slugify(rawKey).replace(/-/g, '_');
      if (!fieldKey) return res.status(400).json({ error: 'Valid field key is required' });
      params.push(fieldKey);
      updates.push(`field_key = $${params.length}`);
    }
    if (fieldType !== undefined) {
      params.push(fieldType);
      updates.push(`field_type = $${params.length}`);
    }
    if (options !== undefined || fieldType !== undefined) {
      const normalizedOptions = normalizeOptions(
        options !== undefined ? options : current.options,
        nextType
      );
      if (nextType === 'dropdown' && !normalizedOptions.length) {
        return res.status(400).json({ error: 'Dropdown fields need at least one option' });
      }
      params.push(JSON.stringify(normalizedOptions));
      updates.push(`options = $${params.length}::jsonb`);
    }
    if (isRequired !== undefined) {
      params.push(!!isRequired);
      updates.push(`is_required = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      const nextOrder = Number(sortOrder);
      params.push(Number.isNaN(nextOrder) ? 0 : nextOrder);
      updates.push(`sort_order = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(fieldId, categoryId);
    const result = await query(
      `UPDATE category_fields SET ${updates.join(', ')}
       WHERE id = $${params.length - 1} AND category_id = $${params.length}
       RETURNING id, category_id, field_key, label, field_type, options, is_required, sort_order, created_at`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Field key already exists on this category' });
    next(err);
  }
}

async function reorderCategoryFields(req, res, next) {
  const client = await getClient();
  try {
    const { id: categoryId } = req.params;
    const fieldIds = req.body.fieldIds || req.body.field_ids;
    if (!Array.isArray(fieldIds) || !fieldIds.length) {
      return res.status(400).json({ error: 'fieldIds array is required' });
    }
    const ids = fieldIds.map((id) => String(id || '').trim()).filter(Boolean);
    if (ids.length !== fieldIds.length || new Set(ids).size !== ids.length) {
      return res.status(400).json({ error: 'fieldIds must be unique non-empty strings' });
    }

    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id FROM category_fields WHERE category_id = $1`,
      [categoryId]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Category not found or has no fields' });
    }
    const existingIds = new Set(existing.rows.map((row) => row.id));
    if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'fieldIds must include every field for this category' });
    }

    for (let i = 0; i < ids.length; i += 1) {
      await client.query(
        `UPDATE category_fields SET sort_order = $1 WHERE id = $2 AND category_id = $3`,
        [i, ids[i], categoryId]
      );
    }
    await client.query('COMMIT');

    const result = await query(
      `SELECT id, category_id, field_key, label, field_type, options, is_required, sort_order, created_at
       FROM category_fields WHERE category_id = $1 ORDER BY sort_order, label`,
      [categoryId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    next(err);
  } finally {
    client.release();
  }
}

async function deleteCategoryField(req, res, next) {
  try {
    const { id: categoryId, fieldId } = req.params;
    const result = await query(
      `DELETE FROM category_fields WHERE id = $1 AND category_id = $2
       RETURNING id, field_key, label`,
      [fieldId, categoryId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Field not found' });
    res.json({ deleted: true, ...result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createCategoryField,
  updateCategoryField,
  reorderCategoryFields,
  deleteCategoryField,
};
