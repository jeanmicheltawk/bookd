const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const config = require('../config');
const { query } = require('../config/db');

const ALLOWED_MEMBERSHIPS = ['free', 'basic', 'premium'];

function signTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    membership: user.membership,
  };
  const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  const refreshToken = jwt.sign({ id: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error(errors.array().map((e) => e.msg).join(', '));
    err.status = 400;
    throw err;
  }
}

const registerValidators = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  body('fullName').trim().notEmpty().withMessage('Full name required'),
  body('categorySlug').optional({ nullable: true }).isString(),
  body('membership').optional().isIn(ALLOWED_MEMBERSHIPS).withMessage('Invalid membership program'),
  body('professionalName').optional().isString(),
  body('country').optional().isString(),
  body('city').optional().isString(),
  body('bio').optional().isString(),
  body('instagram').optional().isString(),
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^[0-9+()]+$/)
    .withMessage('Phone may only contain numbers, +, (, and )'),
  body('whatsapp')
    .optional({ values: 'falsy' })
    .matches(/^[0-9+()]+$/)
    .withMessage('WhatsApp may only contain numbers, +, (, and )'),
  body('website').optional().isString(),
  body('gender').optional().isString(),
  body('age').optional({ values: 'falsy' }).isInt({ min: 16, max: 100 }).withMessage('Age must be 16–100'),
  body('customFields').optional({ nullable: true }).isObject(),
];

const loginValidators = [
  body('email').isEmail(),
  body('password').notEmpty(),
];

async function register(req, res, next) {
  try {
    validate(req);
    const {
      email,
      password,
      fullName,
      professionalName,
      categorySlug,
      role,
      membership: requestedMembership,
      country,
      city,
      bio,
      instagram,
      phone,
      whatsapp,
      website,
      gender,
      age,
      customFields,
    } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    let categoryId = null;
    let userRole = role === 'brand' ? 'brand' : 'member';
    let categoryFields = [];
    if (categorySlug) {
      const cat = await query('SELECT id, slug FROM categories WHERE slug = $1', [categorySlug]);
      if (!cat.rows[0]) return res.status(400).json({ error: 'Invalid category' });
      categoryId = cat.rows[0].id;
      if (cat.rows[0].slug === 'brand-client') userRole = 'brand';

      const fieldsRes = await query(
        `SELECT field_key, label, field_type, options, is_required
         FROM category_fields WHERE category_id = $1 ORDER BY sort_order, label`,
        [categoryId]
      );
      categoryFields = fieldsRes.rows;
    }

    const membership = userRole === 'brand'
      ? 'free'
      : (ALLOWED_MEMBERSHIPS.includes(requestedMembership) ? requestedMembership : 'basic');
    const approvalStatus = userRole === 'brand' ? 'approved' : 'pending';

    if (userRole === 'brand') {
      if (!categoryId) {
        const brandCat = await query(`SELECT id FROM categories WHERE slug = 'brand-client' LIMIT 1`);
        categoryId = brandCat.rows[0]?.id || null;
      }
      categoryFields = [];
    }

    const incomingCustom = customFields && typeof customFields === 'object' ? customFields : {};
    const normalizedCustom = {};
    for (const field of categoryFields) {
      const raw = incomingCustom[field.field_key];
      const value = raw == null ? '' : String(raw).trim();
      if (field.is_required && !value) {
        return res.status(400).json({ error: `${field.label} is required` });
      }
      if (!value) continue;
      if (field.field_type === 'dropdown') {
        const opts = Array.isArray(field.options) ? field.options.map(String) : [];
        if (opts.length && !opts.includes(value)) {
          return res.status(400).json({ error: `Invalid value for ${field.label}` });
        }
      }
      if (field.field_type === 'number' && Number.isNaN(Number(value))) {
        return res.status(400).json({ error: `${field.label} must be a number` });
      }
      normalizedCustom[field.field_key] = value;
    }

    const hash = await bcrypt.hash(password, 12);
    const userRes = await query(
      `INSERT INTO users (email, password_hash, role, membership, approval_status, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, email, role, membership, is_verified, approval_status`,
      [email.toLowerCase(), hash, userRole, membership, approvalStatus]
    );
    const user = userRes.rows[0];

    await query(
      `INSERT INTO profiles (
         user_id, category_id, full_name, professional_name, is_public,
         country, city, bio, instagram, phone, whatsapp, website, gender, age, custom_fields
       )
       VALUES ($1, $2, $3, $4, FALSE, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
      [
        user.id,
        categoryId,
        fullName,
        professionalName || fullName,
        country || null,
        city || null,
        bio || null,
        instagram || null,
        phone || null,
        whatsapp || null,
        website || null,
        gender || null,
        age != null && age !== '' ? Number(age) : null,
        JSON.stringify(normalizedCustom),
      ]
    );

    const payloadUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      membership: user.membership,
      approval_status: user.approval_status,
    };

    if (userRole === 'brand') {
      const tokens = signTokens(user);
      return res.status(201).json({
        message: 'Client account created.',
        user: payloadUser,
        ...tokens,
      });
    }

    res.status(201).json({
      message: 'Application submitted. An admin will review it before your profile goes live.',
      user: payloadUser,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    validate(req);
    const { email, password } = req.body;
    const result = await query(
      `SELECT id, email, password_hash, role, membership, is_verified, is_active, approval_status
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.role !== 'admin') {
      if (user.approval_status === 'pending') {
        return res.status(403).json({
          error: 'Your application is pending admin approval. You will be able to log in once approved.',
        });
      }
      if (user.approval_status === 'rejected') {
        return res.status(403).json({
          error: 'Your application was not approved. Contact support if you think this is a mistake.',
        });
      }
      if (user.approval_status !== 'approved') {
        return res.status(403).json({ error: 'Account is not approved for login.' });
      }
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    delete user.password_hash;
    delete user.is_active;
    const tokens = signTokens(user);
    res.json({ user, ...tokens });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.role, u.membership, u.is_verified, u.approval_status, u.created_at,
              p.id AS profile_id, p.full_name, p.professional_name, p.profile_photo_url,
              p.custom_url, c.slug AS category_slug, c.name AS category_name
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const result = await query(
      `SELECT id, email, role, membership, is_verified, is_active, approval_status
       FROM users WHERE id = $1`,
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid refresh token' });
    if (user.role !== 'admin' && user.approval_status !== 'approved') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    delete user.is_active;
    delete user.approval_status;
    res.json(signTokens(user));
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

module.exports = {
  register,
  login,
  me,
  refresh,
  registerValidators,
  loginValidators,
};
