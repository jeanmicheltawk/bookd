const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const appDb = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'bookd_haus',
  user: process.env.DB_USER || 'bookd',
  password: process.env.DB_PASSWORD || 'bookd_secret',
};

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function canConnect(config) {
  const client = new Client(config);
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

async function ensure() {
  if (await canConnect(appDb)) {
    console.log(`PostgreSQL ready: ${appDb.user}@${appDb.host}:${appDb.port}/${appDb.database}`);
    return;
  }

  const superUser = process.env.POSTGRES_SUPERUSER || 'postgres';
  const superPass = process.env.POSTGRES_SUPERUSER_PASSWORD || '';
  if (!superPass) {
    console.error('The bookd_haus database is not on this laptop yet.');
    console.error('Put your PostgreSQL password in backend/.env as POSTGRES_SUPERUSER_PASSWORD');
    console.error('(the same password you use in pgAdmin for the postgres user),');
    console.error('or open pgAdmin and run backend/scripts/create-local-db.sql on the postgres database.');
    process.exit(1);
  }

  const admin = new Client({
    host: appDb.host,
    port: appDb.port,
    database: 'postgres',
    user: superUser,
    password: superPass,
  });

  try {
    await admin.connect();
  } catch (err) {
    console.error('Could not sign in as the PostgreSQL superuser.');
    console.error(err.message);
    console.error('Check POSTGRES_SUPERUSER_PASSWORD in backend/.env.');
    process.exit(1);
  }

  try {
    const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appDb.user]);
    if (!role.rowCount) {
      await admin.query(
        `CREATE ROLE ${quoteIdent(appDb.user)} LOGIN PASSWORD ${quoteLiteral(appDb.password)}`
      );
      console.log(`Created role ${appDb.user}`);
    } else {
      await admin.query(
        `ALTER ROLE ${quoteIdent(appDb.user)} WITH LOGIN PASSWORD ${quoteLiteral(appDb.password)}`
      );
      console.log(`Updated login for existing role ${appDb.user}`);
    }

    const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [appDb.database]);
    if (!db.rowCount) {
      await admin.query(
        `CREATE DATABASE ${quoteIdent(appDb.database)} OWNER ${quoteIdent(appDb.user)}`
      );
      console.log(`Created database ${appDb.database}`);
    } else {
      console.log(`Database ${appDb.database} already exists — leaving it untouched`);
    }

    await admin.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(appDb.database)} TO ${quoteIdent(appDb.user)}`
    );
  } finally {
    await admin.end();
  }

  if (!(await canConnect(appDb))) {
    console.error('Database exists but the bookd user still cannot connect.');
    process.exit(1);
  }

  console.log(`PostgreSQL ready: ${appDb.user}@${appDb.host}:${appDb.port}/${appDb.database}`);
}

ensure().catch((err) => {
  console.error(err);
  process.exit(1);
});
