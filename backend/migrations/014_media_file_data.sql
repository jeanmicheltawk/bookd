-- Persist upload bytes in Postgres so files survive hosts with ephemeral disks (Render).
ALTER TABLE media ADD COLUMN IF NOT EXISTS file_data BYTEA;

CREATE INDEX IF NOT EXISTS media_folder_filename_idx ON media (folder, filename);
