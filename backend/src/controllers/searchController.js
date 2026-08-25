const { query } = require('../config/db');
const { expireOverdueSubscriptions } = require('../utils/subscription');

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
      page = 1,
      limit = 24,
    } = req.query;

    const membership = req.user?.membership || 'visitor';
    const isVisitor = !req.user;
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

    // Free / visitor limited filters
    if (isVisitor || membership === 'free') {
      // already applied only basic filters
    }

    const sql = `
      SELECT p.id, p.full_name, p.professional_name, p.country, p.city, p.profile_photo_url,
             p.availability, p.custom_url, u.membership, u.is_verified,
             c.slug AS category_slug, c.name AS category_name
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')}
    `;
    const result = await query(sql, params);
    const premium = shuffle(result.rows.filter((r) => r.membership === 'premium'));
    const rest = shuffle(result.rows.filter((r) => r.membership !== 'premium'));
    let ordered = [...premium, ...rest];

    if (isVisitor) {
      ordered = ordered.slice(0, 8).map((r) => ({
        ...r,
        full_name: r.professional_name || r.full_name,
        bio: undefined,
      }));
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const start = (pageNum - 1) * lim;
    const data = ordered.slice(start, start + lim);

    await query(
      `INSERT INTO analytics_events (event_type, path, user_id, metadata)
       VALUES ('search', '/api/search', $1, $2::jsonb)`,
      [req.user?.id || null, JSON.stringify({ q, category, results: ordered.length })]
    );

    res.json({
      data,
      pagination: { page: pageNum, limit: lim, total: ordered.length, totalPages: Math.ceil(ordered.length / lim) },
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
