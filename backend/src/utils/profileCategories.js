/**
 * Normalize incoming category slug(s) from request body.
 * Accepts categorySlugs (array) and/or legacy categorySlug (string).
 */
function parseCategorySlugs(body = {}) {
  const fromArray = Array.isArray(body.categorySlugs)
    ? body.categorySlugs
    : typeof body.categorySlugs === 'string'
      ? [body.categorySlugs]
      : [];
  const fromSingle = body.categorySlug ? [body.categorySlug] : [];
  const seen = new Set();
  const slugs = [];
  for (const raw of [...fromArray, ...fromSingle]) {
    const slug = String(raw || '').trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

/**
 * Resolve slugs to category rows. Excludes brand-client by default for talent.
 */
async function resolveCategoriesBySlugs(queryFn, slugs, { allowBrand = false } = {}) {
  if (!slugs.length) return [];
  const result = await queryFn(
    `SELECT id, slug, name, is_searchable
     FROM categories
     WHERE slug = ANY($1::text[])
     ORDER BY sort_order, name`,
    [slugs]
  );
  const bySlug = new Map(result.rows.map((row) => [row.slug, row]));
  const ordered = [];
  for (const slug of slugs) {
    const row = bySlug.get(slug);
    if (!row) {
      const err = new Error(`Invalid category: ${slug}`);
      err.status = 400;
      throw err;
    }
    if (!allowBrand && row.slug === 'brand-client') {
      const err = new Error('Invalid category');
      err.status = 400;
      throw err;
    }
    ordered.push(row);
  }
  return ordered;
}

async function replaceProfileCategories(queryFn, profileId, categoryIds) {
  await queryFn('DELETE FROM profile_categories WHERE profile_id = $1', [profileId]);
  for (const categoryId of categoryIds) {
    await queryFn(
      `INSERT INTO profile_categories (profile_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [profileId, categoryId]
    );
  }
}

async function getCategoriesForProfiles(queryFn, profileIds) {
  const ids = (profileIds || []).map((id) => String(id)).filter(Boolean);
  if (!ids.length) return new Map();
  const result = await queryFn(
    `SELECT pc.profile_id::text AS profile_id, c.id, c.slug, c.name
     FROM profile_categories pc
     JOIN categories c ON c.id = pc.category_id
     WHERE pc.profile_id = ANY($1::uuid[])
     ORDER BY c.sort_order, c.name`,
    [ids]
  );
  const map = new Map();
  for (const row of result.rows) {
    const key = String(row.profile_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ id: row.id, slug: row.slug, name: row.name });
  }
  return map;
}

function attachCategories(profile, categories = []) {
  if (!profile) return profile;
  const list = categories.length
    ? categories
    : profile.category_slug
      ? [{ slug: profile.category_slug, name: profile.category_name }]
      : [];
  profile.categories = list.map((c) => ({ slug: c.slug, name: c.name }));
  profile.category_slugs = list.map((c) => c.slug);
  profile.category_names = list.map((c) => c.name);
  // Keep primary fields in sync with the first selected category.
  if (list[0]) {
    profile.category_slug = list[0].slug;
    profile.category_name = list[0].name;
  }
  return profile;
}

module.exports = {
  parseCategorySlugs,
  resolveCategoriesBySlugs,
  replaceProfileCategories,
  getCategoriesForProfiles,
  attachCategories,
};
