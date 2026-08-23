const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const file = process.argv[2];
if (!file || process.env.CONFIRM_RESTORE !== 'YES') {
  console.error('Restore is opt-in so the live database cannot be overwritten by accident.');
  console.error('Usage: CONFIRM_RESTORE=YES npm run db:restore -- backups/your-file.dump');
  process.exit(1);
}

const dumpPath = path.resolve(file);
if (!fs.existsSync(dumpPath)) {
  console.error(`Backup file not found: ${dumpPath}`);
  process.exit(1);
}

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '5432';
const database = process.env.DB_NAME || 'bookd_haus';
const user = process.env.DB_USER || 'bookd';
const password = process.env.DB_PASSWORD || 'bookd_secret';

const restoreBin = [
  'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
  'pg_restore',
].find((candidate) => candidate === 'pg_restore' || fs.existsSync(candidate));

if (!restoreBin) {
  console.error('pg_restore not found. Is PostgreSQL 17 installed?');
  process.exit(1);
}

const result = spawnSync(
  restoreBin,
  ['-h', host, '-p', String(port), '-U', user, '-d', database, '--no-owner', '--no-acl', dumpPath],
  {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'inherit',
    windowsHide: true,
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Restored ${dumpPath} into ${database}`);
