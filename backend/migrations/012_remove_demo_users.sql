-- Remove seeded demo accounts (maya@, leo@, sofia@, etc.).
DELETE FROM users WHERE email ILIKE '%@bookd.demo';
