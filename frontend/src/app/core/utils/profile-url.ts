export type ProfileLinkSource = {
  id?: string | null;
  profile_id?: string | null;
  full_name?: string | null;
  professional_name?: string | null;
  custom_url?: string | null;
};

export function slugifyProfileName(name?: string | null): string {
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

export function shortProfileId(id?: string | null): string {
  return String(id || '').replace(/-/g, '').slice(0, 8).toLowerCase();
}

export function profileRouterLink(source?: ProfileLinkSource | null): string[] | null {
  if (!source) return null;

  const id = source.id || source.profile_id || null;
  const name = source.full_name || source.professional_name;

  if (id) {
    return ['/profile', slugifyProfileName(name), shortProfileId(id)];
  }

  const custom = String(source.custom_url || '').trim();
  if (!custom) return null;

  const match = custom.match(/^(.*)-([a-f0-9]{8})$/i);
  if (match) {
    return ['/profile', match[1] || 'creative', match[2].toLowerCase()];
  }

  return ['/profile', custom];
}

export function profilePublicPath(source?: ProfileLinkSource | null): string | null {
  const commands = profileRouterLink(source);
  return commands ? commands.join('/') : null;
}
