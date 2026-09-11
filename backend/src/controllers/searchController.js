const { query } = require('../config/db');
const { expireOverdueSubscriptions } = require('../utils/subscription');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function searchProfiles(req, res, next) {
  try {
    await expireOverdueSubscriptions();
    const {
      q = '',
      category,
      country,
      availability,
      verified,
      gender,
      ageMin,
      ageMax,
    } = req.query;

    const params = [];
    const where = [
      'p.is_public = TRUE',
      'c.is_searchable = TRUE',
      'u.is_active = TRUE',
      `u.role = 'member'`,
      `u.approval_status = 'approved'`,
    ];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.full_name ILIKE $${params.length} OR p.professional_name ILIKE $${params.length} OR p.bio ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      where.push(`c.slug = $${params.length}`);
    }
    if (country) {
      params.push(country);
      where.push(`p.country ILIKE $${params.length}`);
    }
    if (availability) {
      params.push(availability);
      where.push(`p.availability = $${params.length}`);
    }
    if (verified === 'true') where.push('u.is_verified = TRUE');

    const modelCats = ['models', 'talents'];
    if (gender && (!category || modelCats.includes(category))) {
      params.push(gender);
      where.push(`p.gender ILIKE $${params.length}`);
    }
    if (ageMin && (!category || modelCats.includes(category))) {
      params.push(Number(ageMin));
      where.push(`p.age >= $${params.length}`);
    }
    if (ageMax && (!category || modelCats.includes(category))) {
      params.push(Number(ageMax));
      where.push(`p.age <= $${params.length}`);
    }

    const fromWhere = `
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')}
    `;
    const countRes = await query(`SELECT COUNT(*)::int AS total ${fromWhere}`, params);
    const total = countRes.rows[0]?.total || 0;
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 20, maxLimit: 50 });

    const listParams = [...params, limit, offset];
    const result = await query(
      `SELECT p.id, p.full_name, p.professional_name, p.country, p.city, p.profile_photo_url,
              p.availability, p.custom_url, u.membership, u.is_verified,
              c.slug AS category_slug, c.name AS category_name
       ${fromWhere}
       ORDER BY CASE WHEN u.membership = 'premium' THEN 0 ELSE 1 END,
                md5(p.id::text || to_char(CURRENT_DATE, 'YYYY-MM-DD')),
                p.id
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    if (page === 1) {
      await query(
        `INSERT INTO analytics_events (event_type, path, user_id, metadata)
         VALUES ('search', '/api/search', $1, $2::jsonb)`,
        [req.user?.id || null, JSON.stringify({ q, category, results: total })]
      );
    }

    res.json({
      data: result.rows,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    next(err);
  }
}

async function getSpotlight(req, res, next) {
  try {
    await expireOverdueSubscriptions();
    const result = await query(
      `SELECT p.id, p.professional_name, p.full_name, p.profile_photo_url, p.country,
              u.is_verified, u.membership, c.name AS category_name, c.slug AS category_slug,
              CASE
                WHEN u.is_verified THEN 'Verified Members'
                WHEN u.created_at > NOW() - INTERVAL '30 days' THEN 'New Members'
                WHEN u.membership = 'premium' THEN 'Featured Artists'
                ELSE 'Rising Creatives'
              END AS spotlight_label
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_public = TRUE
         AND c.is_searchable = TRUE
         AND u.is_active = TRUE
         AND u.role = 'member'
         AND u.approval_status = 'approved'
       ORDER BY RANDOM()
       LIMIT 16`
    );
    res.json({ data: shuffle(result.rows) });
  } catch (err) {
    next(err);
  }
}

async function getHeroSlides(_req, res, next) {
  try {
    const section = await query(
      `SELECT s.content FROM sections s
       JOIN pages p ON p.id = s.page_id
       WHERE p.slug = 'home' AND s.key = 'hero'`
    );
    const slides = section.rows[0]?.content?.slides || [];
    res.json({ data: shuffle(slides) });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchProfiles, getSpotlight, getHeroSlides, shuffle };
