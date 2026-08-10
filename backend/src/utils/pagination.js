function parsePageLimit(query, defaults = {}) {
  const pageDefault = defaults.page ?? 1;
  const limitDefault = defaults.limit ?? 20;
  const maxLimit = defaults.maxLimit ?? 100;

  const page = Math.max(1, parseInt(query.page, 10) || pageDefault);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || limitDefault));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

module.exports = { parsePageLimit, paginationMeta };
