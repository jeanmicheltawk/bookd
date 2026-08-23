const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '5432';
const database = process.env.DB_NAME || 'bookd_haus';
const user = process.env.DB_USER || 'bookd';
const password = process.env.DB_PASSWORD || 'bookd_secret';

const dumpBin = [
  'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
  'pg_dump',
].find((candidate) => candidate === 'pg_dump' || fs.existsSync(candidate));

if (!dumpBin) {
  console.error('pg_dump not found. Is PostgreSQL 17 installed?');
  process.exit(1);
}

const backupDir = path.join(__dirname, '..', '..', 'backups');
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(backupDir, `bookd_haus_${stamp}.dump`);

const result = spawnSync(
  dumpBin,
  ['-h', host, '-p', String(port), '-U', user, '-d', database, '-F', 'c', '-f', file],
  {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'inherit',
    windowsHide: true,
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Backup saved: ${file}`);
