-- Run in pgAdmin while connected to the `postgres` database.
-- Safe to run more than once. Never drops a user or database.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bookd') THEN
    CREATE ROLE bookd LOGIN PASSWORD 'bookd_secret';
  END IF;
END
$$;

-- Next, if bookd_haus is not already in the Databases list:
--   CREATE DATABASE bookd_haus OWNER bookd;
-- Then:

GRANT ALL PRIVILEGES ON DATABASE bookd_haus TO bookd;
