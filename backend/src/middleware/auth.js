const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../config/db');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), config.jwt.secret);
    } catch {
      req.user = null;
    }
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function requireMembership(...levels) {
  return (req, res, next) => {
    if (!req.user || !levels.includes(req.user.membership)) {
      return res.status(403).json({ error: 'Membership upgrade required' });
    }
    next();
  };
}

function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role === 'admin' || req.user.role === 'brand') {
    return next();
  }

  query('SELECT role, approval_status FROM users WHERE id = $1', [req.user.id])
    .then((result) => {
      const row = result.rows[0];
      if (!row) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (row.role === 'admin' || row.role === 'brand' || row.approval_status === 'approved') {
        return next();
      }
      return res.status(403).json({
        error: 'Your application is still under review. You can update your profile while you wait.',
      });
    })
    .catch(next);
}

module.exports = { authenticate, optionalAuth, requireRole, requireMembership, requireApproved };
