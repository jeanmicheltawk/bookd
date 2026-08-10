require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config(); // fallback for process cwd

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'bookd_haus',
    user: process.env.DB_USER || 'bookd',
    password: process.env.DB_PASSWORD || 'bookd_secret',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@bookd.com',
    password: process.env.ADMIN_PASSWORD || 'bookdadmin',
  },
};
