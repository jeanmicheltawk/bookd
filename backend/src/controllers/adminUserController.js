const { query } = require('../config/db');
const { parsePageLimit } = require('../utils/pagination');

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

const USER_SELECT = `
  u.id, u.email, u.role, u.membership, u.is_verified, u.is_active,
  u.approval_status, u.approval_note, u.reviewed_at, u.created_at, u.last_login_at,
  p.id AS profile_id, p.full_name, p.professional_name, p.country, p.city,
  p.bio, p.instagram, p.phone, p.whatsapp, p.website, p.gender, p.age,
  p.profile_photo_url, p.is_public, p.custom_fields, p.availability,
  c.slug AS category_slug, c.name AS category_name
`;

async function fetchAdminUser(userId) {
  const result = await query(
    `SELECT ${USER_SELECT}
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function listUsers(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query);
    const { q, role, membership, verified, approval_status: approvalStatus } = req.query;
    const params = [];
    const where = ['1=1'];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(u.email ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR p.professional_name ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      where.push(`u.role = $${params.length}`);
    }
    if (membership) {
      params.push(membership);
      where.push(`u.membership = $${params.length}`);
    }
    if (verified === 'true') where.push('u.is_verified = TRUE');
    if (verified === 'false') where.push('u.is_verified = FALSE');
    if (approvalStatus && APPROVAL_STATUSES.includes(approvalStatus)) {
      params.push(approvalStatus);
      where.push(`u.approval_status = $${params.length}`);
    }

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE ${where.join(' AND ')}`,
      params
    );

    params.push(limit, offset);
    const result = await query(
      `SELECT ${USER_SELECT}
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where.join(' AND ')}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: countRes.rows[0].total,
        totalPages: Math.ceil(countRes.rows[0].total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await fetchAdminUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const {
      role,
      membership,
      is_verified: isVerified,
      is_active: isActive,
      approval_status: approvalStatus,
      approval_note: approvalNote,
      email,
      full_name: fullName,
      professional_name: professionalName,
      country,
      city,
      bio,
      instagram,
      phone,
      whatsapp,
      website,
      gender,
      age,
      categorySlug,
      custom_fields: customFields,
      availability,
    } = req.body;

    const existing = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'User not found' });

    const userUpdates = [];
    const userParams = [];

    if (role !== undefined) {
      userParams.push(role);
      userUpdates.push(`role = $${userParams.length}`);
    }
    if (membership !== undefined) {
      userParams.push(membership);
      userUpdates.push(`membership = $${userParams.length}`);
    }
    if (isVerified !== undefined) {
      userParams.push(!!isVerified);
      userUpdates.push(`is_verified = $${userParams.length}`);
    }
    if (isActive !== undefined) {
      userParams.push(!!isActive);
      userUpdates.push(`is_active = $${userParams.length}`);
    }
    if (email !== undefined) {
      const nextEmail = String(email || '').trim().toLowerCase();
      if (!nextEmail || !nextEmail.includes('@') || !nextEmail.includes('.') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return res.status(400).json({ error: 'Valid email is required (must include @ and .)' });
      }
      userParams.push(nextEmail);
      userUpdates.push(`email = $${userParams.length}`);
    }
    if (approvalStatus !== undefined) {
      if (!APPROVAL_STATUSES.includes(approvalStatus)) {
        return res.status(400).json({ error: 'Invalid approval_status' });
      }
      userParams.push(approvalStatus);
      userUpdates.push(`approval_status = $${userParams.length}`);
      userUpdates.push('reviewed_at = NOW()');
      if (approvalNote !== undefined) {
        userParams.push(approvalNote || null);
        userUpdates.push(`approval_note = $${userParams.length}`);
      }
    } else if (approvalNote !== undefined) {
      userParams.push(approvalNote || null);
      userUpdates.push(`approval_note = $${userParams.length}`);
    }

    const profileTouched =
      fullName !== undefined ||
      professionalName !== undefined ||
      country !== undefined ||
      city !== undefined ||
      bio !== undefined ||
      instagram !== undefined ||
      phone !== undefined ||
      whatsapp !== undefined ||
      website !== undefined ||
      gender !== undefined ||
      age !== undefined ||
      categorySlug !== undefined ||
      customFields !== undefined ||
      availability !== undefined ||
      approvalStatus !== undefined;

    if (!userUpdates.length && !profileTouched) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (userUpdates.length) {
      userParams.push(id);
      try {
        await query(
          `UPDATE users SET ${userUpdates.join(', ')}, updated_at = NOW()
           WHERE id = $${userParams.length}`,
          userParams
        );
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
        throw err;
      }
    }

    if (approvalStatus === 'approved') {
      await query(
        `UPDATE profiles SET is_public = TRUE, updated_at = NOW() WHERE user_id = $1`,
        [id]
      );
    } else if (approvalStatus === 'rejected' || approvalStatus === 'pending') {
      await query(
        `UPDATE profiles SET is_public = FALSE, updated_at = NOW() WHERE user_id = $1`,
        [id]
      );
    }

    const profileUpdates = [];
    const profileParams = [];

    if (fullName !== undefined) {
      if (!String(fullName || '').trim()) return res.status(400).json({ error: 'Full name is required' });
      profileParams.push(String(fullName).trim());
      profileUpdates.push(`full_name = $${profileParams.length}`);
    }
    if (professionalName !== undefined) {
      profileParams.push(String(professionalName || '').trim() || null);
      profileUpdates.push(`professional_name = $${profileParams.length}`);
    }
    if (country !== undefined) {
      profileParams.push(country ? String(country).trim() : null);
      profileUpdates.push(`country = $${profileParams.length}`);
    }
    if (city !== undefined) {
      profileParams.push(city ? String(city).trim() : null);
      profileUpdates.push(`city = $${profileParams.length}`);
    }
    if (bio !== undefined) {
      profileParams.push(bio ? String(bio).trim() : null);
      profileUpdates.push(`bio = $${profileParams.length}`);
    }
    if (instagram !== undefined) {
      profileParams.push(instagram ? String(instagram).trim() : null);
      profileUpdates.push(`instagram = $${profileParams.length}`);
    }
    if (phone !== undefined) {
      const nextPhone = phone ? String(phone).trim() : '';
      if (nextPhone && !/^[0-9+()]+$/.test(nextPhone)) {
        return res.status(400).json({ error: 'Phone may only contain numbers, +, (, and )' });
      }
      profileParams.push(nextPhone || null);
      profileUpdates.push(`phone = $${profileParams.length}`);
    }
    if (whatsapp !== undefined) {
      const nextWhatsapp = whatsapp ? String(whatsapp).trim() : '';
      if (nextWhatsapp && !/^[0-9+()]+$/.test(nextWhatsapp)) {
        return res.status(400).json({ error: 'WhatsApp may only contain numbers, +, (, and )' });
      }
      profileParams.push(nextWhatsapp || null);
      profileUpdates.push(`whatsapp = $${profileParams.length}`);
    }
    if (website !== undefined) {
      profileParams.push(website ? String(website).trim() : null);
      profileUpdates.push(`website = $${profileParams.length}`);
    }
    if (gender !== undefined) {
      profileParams.push(gender ? String(gender).trim() : null);
      profileUpdates.push(`gender = $${profileParams.length}`);
    }
    if (age !== undefined) {
      if (age === null || age === '') {
        profileParams.push(null);
      } else {
        const ageNum = Number(age);
        if (Number.isNaN(ageNum) || ageNum < 16 || ageNum > 100) {
          return res.status(400).json({ error: 'Age must be 16–100' });
        }
        profileParams.push(ageNum);
      }
      profileUpdates.push(`age = $${profileParams.length}`);
    }
    if (availability !== undefined) {
      profileParams.push(availability || null);
      profileUpdates.push(`availability = $${profileParams.length}`);
    }
    if (categorySlug !== undefined) {
      if (!categorySlug) {
        profileParams.push(null);
        profileUpdates.push(`category_id = $${profileParams.length}`);
      } else {
        const cat = await query('SELECT id FROM categories WHERE slug = $1', [categorySlug]);
        if (!cat.rows[0]) return res.status(400).json({ error: 'Invalid category' });
        profileParams.push(cat.rows[0].id);
        profileUpdates.push(`category_id = $${profileParams.length}`);
      }
    }
    if (customFields !== undefined) {
      const normalized =
        customFields && typeof customFields === 'object' && !Array.isArray(customFields)
          ? customFields
          : {};
      profileParams.push(JSON.stringify(normalized));
      profileUpdates.push(`custom_fields = $${profileParams.length}::jsonb`);
    }

    if (profileUpdates.length) {
      profileParams.push(id);
      const profileRes = await query(
        `UPDATE profiles SET ${profileUpdates.join(', ')}, updated_at = NOW()
         WHERE user_id = $${profileParams.length}
         RETURNING id`,
        profileParams
      );
      if (!profileRes.rows[0]) {
        return res.status(404).json({ error: 'Profile not found for this user' });
      }
    }

    const updated = await fetchAdminUser(id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, updateUser };
