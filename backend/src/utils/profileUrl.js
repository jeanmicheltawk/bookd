function slugifyProfileName(name) {
  const slug = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'creative';
}

function shortProfileId(id) {
  return String(id || '').replace(/-/g, '').slice(0, 8).toLowerCase();
}

function buildCustomUrl(name, id) {
  return `${slugifyProfileName(name)}-${shortProfileId(id)}`;
}

function profilePublicPath(name, id) {
  return `/profile/${slugifyProfileName(name)}/${shortProfileId(id)}`;
}

async function syncProfileCustomUrl(exec, profileId, fullName) {
  const customUrl = buildCustomUrl(fullName, profileId);
  await exec(
    `UPDATE profiles
     SET custom_url = $1, updated_at = NOW()
     WHERE id = $2 AND COALESCE(custom_url, '') <> $1`,
    [customUrl, profileId]
  );
  return customUrl;
}

module.exports = {
  slugifyProfileName,
  shortProfileId,
  buildCustomUrl,
  profilePublicPath,
  syncProfileCustomUrl,
};
