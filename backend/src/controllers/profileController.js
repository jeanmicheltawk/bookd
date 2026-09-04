const path = require('path');
const { query } = require('../config/db');
const { insertUploadedMedia } = require('../utils/mediaStore');
const { assertPortfolioCapacity } = require('../utils/portfolioLimit');
const { expireOverdueSubscriptions } = require('../utils/subscription');

function portfolioMediaType(file) {
  const mime = (file?.mimetype || '').toLowerCase();
  const ext = path.extname(file?.originalname || '').toLowerCase();
  if (mime.startsWith('video')) return 'video';
  if (mime === 'application/pdf' || mime === 'application/x-pdf' || ext === '.pdf') return 'pdf';
  return 'image';
}

const PUBLIC_PROFILE_FIELDS = `
  p.id, p.full_name, p.professional_name, p.age, p.country, p.city, p.gender,
  p.instagram, p.email_public, p.bio, p.languages, p.years_experience, p.website,
  p.profile_photo_url, p.cover_photo_url, p.equipment_owned, p.studio_access,
  p.brands_worked_with, p.social_links, p.booking_preferences, p.preferred_contact,
  p.phone, p.whatsapp, p.availability, p.custom_url, p.is_public, p.performance_score,
  p.custom_fields, p.created_at, p.updated_at,
  c.slug AS category_slug, c.name AS category_name,
  u.id AS user_id, u.is_verified, u.membership
`;

async function resolveProfileId(idOrSlug) {
  const byId = await query(`SELECT id FROM profiles WHERE id::text = $1 OR custom_url = $1`, [idOrSlug]);
  return byId.rows[0]?.id || null;
}

async function getPublicProfile(req, res, next) {
  try {
    await expireOverdueSubscriptions();
    const profileId = await resolveProfileId(req.params.idOrSlug);
    if (!profileId) return res.status(404).json({ error: 'Profile not found' });

    const result = await query(
      `SELECT ${PUBLIC_PROFILE_FIELDS}
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1
         AND p.is_public = TRUE
         AND u.is_active = TRUE
         AND u.role = 'member'
         AND u.approval_status = 'approved'`,
      [profileId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' });

    const portfolio = await query(
      `SELECT id, media_type, url, thumbnail_url, title, sort_order, view_count, created_at
       FROM portfolio_items WHERE profile_id = $1 ORDER BY sort_order, created_at DESC`,
      [profileId]
    );

    await query(
      `INSERT INTO analytics_events (event_type, path, user_id, profile_id, metadata)
       VALUES ('profile_view', $1, $2, $3, '{}'::jsonb)`,
      [`/profiles/${req.params.idOrSlug}`, req.user?.id || null, profileId]
    );

    res.json({ ...result.rows[0], portfolio: portfolio.rows });
  } catch (err) {
    next(err);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const result = await query(
      `SELECT ${PUBLIC_PROFILE_FIELDS}, u.email, u.role, u.approval_status
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.user_id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const allowed = [
      'category_id', 'full_name', 'professional_name', 'age', 'country', 'city', 'gender',
      'instagram', 'email_public', 'bio', 'languages', 'years_experience', 'website',
      'profile_photo_url', 'cover_photo_url', 'equipment_owned', 'studio_access',
      'brands_worked_with', 'social_links', 'booking_preferences', 'preferred_contact',
      'phone', 'whatsapp', 'availability', 'custom_url', 'privacy_settings', 'is_public',
      'custom_fields',
    ];

    const updates = [];
    const params = [];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        if (['social_links', 'booking_preferences', 'privacy_settings', 'custom_fields'].includes(f)) {
          params.push(JSON.stringify(req.body[f]));
          updates.push(`${f} = $${params.length}::jsonb`);
        } else if (f === 'languages' || f === 'brands_worked_with') {
          params.push(req.body[f]);
          updates.push(`${f} = $${params.length}`);
        } else {
          params.push(req.body[f]);
          updates.push(`${f} = $${params.length}`);
        }
      }
    }

    if (req.body.categorySlug) {
      const cat = await query('SELECT id FROM categories WHERE slug = $1', [req.body.categorySlug]);
      if (!cat.rows[0]) return res.status(400).json({ error: 'Invalid category' });
      params.push(cat.rows[0].id);
      updates.push(`category_id = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    if (req.body.is_public === true) {
      const statusRes = await query(
        `SELECT approval_status, role FROM users WHERE id = $1`,
        [req.user.id]
      );
      if (statusRes.rows[0]?.role === 'brand') {
        return res.status(403).json({
          error: 'Client accounts are not listed as public talent profiles.',
        });
      }
      if (statusRes.rows[0]?.approval_status !== 'approved') {
        return res.status(403).json({
          error: 'Your profile can only be made public after admin approval.',
        });
      }
    }

    params.push(profile.id);
    const result = await query(
      `UPDATE profiles SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'custom_url already taken' });
    next(err);
  }
}

async function uploadProfilePhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    const profile = profileRes.rows[0];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const folder = req.uploadFolder || 'avatars';
    const { url } = await insertUploadedMedia({
      file: req.file,
      folder,
      altText: 'Profile photo',
      uploadedBy: req.user.id,
    });

    const updated = await query(
      `UPDATE profiles SET profile_photo_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING profile_photo_url`,
      [url, profile.id]
    );

    res.status(201).json({
      url,
      profile_photo_url: updated.rows[0].profile_photo_url,
    });
  } catch (err) {
    next(err);
  }
}

async function listPortfolio(req, res, next) {
  try {
    const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    if (!profileRes.rows[0]) return res.status(404).json({ error: 'Profile not found' });

    const result = await query(
      `SELECT * FROM portfolio_items WHERE profile_id = $1 ORDER BY sort_order, created_at DESC`,
      [profileRes.rows[0].id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function addPortfolioItem(req, res, next) {
  try {
    const { mediaType, url, thumbnailUrl, title, sortOrder } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    const capacity = await assertPortfolioCapacity(req.user.id);
    if (capacity.error) {
      return res.status(capacity.error.status).json({ error: capacity.error.message });
    }

    const result = await query(
      `INSERT INTO portfolio_items (profile_id, media_type, url, thumbnail_url, title, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        capacity.profile.id,
        mediaType || 'image',
        url,
        thumbnailUrl || null,
        title || null,
        sortOrder ?? 0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updatePortfolioItem(req, res, next) {
  try {
    const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    if (!profileRes.rows[0]) return res.status(404).json({ error: 'Profile not found' });

    const fields = ['media_type', 'url', 'thumbnail_url', 'title', 'sort_order'];
    const updates = [];
    const params = [];
    const bodyMap = {
      media_type: req.body.mediaType,
      url: req.body.url,
      thumbnail_url: req.body.thumbnailUrl,
      title: req.body.title,
      sort_order: req.body.sortOrder,
    };
    for (const f of fields) {
      if (bodyMap[f] !== undefined) {
        params.push(bodyMap[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.params.id, profileRes.rows[0].id);
    const result = await query(
      `UPDATE portfolio_items SET ${updates.join(', ')}
       WHERE id = $${params.length - 1} AND profile_id = $${params.length}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Portfolio item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deletePortfolioItem(req, res, next) {
  try {
    const profileRes = await query('SELECT id FROM profiles WHERE user_id = $1', [req.user.id]);
    if (!profileRes.rows[0]) return res.status(404).json({ error: 'Profile not found' });

    const result = await query(
      'DELETE FROM portfolio_items WHERE id = $1 AND profile_id = $2 RETURNING id',
      [req.params.id, profileRes.rows[0].id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Portfolio item not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

async function uploadPortfolioMedia(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const capacity = await assertPortfolioCapacity(req.user.id, req.file);
    if (capacity.error) {
      return res.status(capacity.error.status).json({ error: capacity.error.message });
    }

    const folder = req.uploadFolder || 'portfolio';
    const mediaType = portfolioMediaType(req.file);
    const title = (req.body.title || '').trim() || req.file.originalname || null;
    const { url } = await insertUploadedMedia({
      file: req.file,
      folder,
      altText: title,
      uploadedBy: req.user.id,
    });

    const result = await query(
      `INSERT INTO portfolio_items (profile_id, media_type, url, thumbnail_url, title, sort_order)
       VALUES ($1, $2, $3, NULL, $4, 0)
       RETURNING *`,
       [capacity.profile.id, mediaType, url, title]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicProfile,
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  listPortfolio,
  addPortfolioItem,
  uploadPortfolioMedia,
  updatePortfolioItem,
  deletePortfolioItem,
};
