UPDATE profiles
SET custom_url = CONCAT_WS(
  '-',
  COALESCE(
    NULLIF(
      left(
        trim(both '-' from regexp_replace(lower(coalesce(full_name, 'creative')), '[^a-z0-9]+', '-', 'g')),
        80
      ),
      ''
    ),
    'creative'
  ),
  left(replace(id::text, '-', ''), 8)
);
