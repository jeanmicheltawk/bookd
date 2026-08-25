const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { uploadRoot } = require('./middleware/upload');
const { expireOverdueSubscriptions } = require('./utils/subscription');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(compression());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'production' ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/uploads', express.static(uploadRoot));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bookd-haus-api', env: config.env });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

const SUBSCRIPTION_JOB_MS = 60 * 60 * 1000;

function startSubscriptionJobs() {
  const tick = () => {
    expireOverdueSubscriptions().catch((err) => {
      console.error('[subscription] job failed:', err.message);
    });
  };
  tick();
  setInterval(tick, SUBSCRIPTION_JOB_MS);
}

if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`BOOK'D HAUS API listening on port ${config.port} (${config.env})`);
    console.log(`Uploads served from ${path.resolve(uploadRoot)}`);
    console.log('Subscription payment reminders: email talent 5 days before expiry');
    startSubscriptionJobs();
  });
}

module.exports = app;
