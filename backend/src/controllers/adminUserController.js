const { query, getClient } = require('../config/db');
const { parsePageLimit } = require('../utils/pagination');
const { emailUser } = require('../utils/mailer');
const {
  isPaidPlan,
  withSubscription,
  startPaidPeriod,
  clearPaidPeriod,
  expireOverdueSubscriptions,
  endSubscription,
  remindSubscription,
} = require('../utils/subscription');
const { hasConfirmedPayment, markPaymentsApplied } = require('../utils/payment');

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

const USER_SELECT = `
  u.id, u.email, u.role, u.membership, u.is_verified, u.is_active,
  u.approval_status, u.approval_note, u.reviewed_at, u.created_at, u.last_login_at,
  u.membership_started_at, u.membership_trial_ends_at, u.membership_ends_at,
  EXISTS (
    SELECT 1 FROM subscription_payments spc
    WHERE spc.user_id = u.id AND spc.status = 'confirmed'
  ) AS payment_confirmed,
  (
    SELECT sp.status FROM subscription_payments sp
    WHERE sp.user_id = u.id
    ORDER BY CASE sp.status
      WHEN 'confirmed' THEN 0 WHEN 'pending' THEN 1 WHEN 'awaiting' THEN 2 ELSE 3
    END, sp.created_at DESC
    LIMIT 1
  ) AS payment_status,
  (
    SELECT sp.reference FROM subscription_payments sp
    WHERE sp.user_id = u.id
    ORDER BY CASE sp.status
      WHEN 'confirmed' THEN 0 WHEN 'pending' THEN 1 WHEN 'awaiting' THEN 2 ELSE 3
    END, sp.created_at DESC
    LIMIT 1
  ) AS payment_reference,
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
    await expireOverdueSubscriptions();
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
    } else {
      where.push(`u.role = 'member'`);
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
      data: result.rows.map(withSubscription),
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
    res.json(withSubscription(user));
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

    const existing = await query(
      'SELECT id, role, email, approval_status, membership FROM users WHERE id = $1',
      [id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'User not found' });

    if (
      approvalStatus === 'approved'
      && existing.rows[0].approval_status !== 'approved'
      && existing.rows[0].role === 'member'
    ) {
      const nextPlan = membership !== undefined ? membership : existing.rows[0].membership;
      if (isPaidPlan(nextPlan) && !(await hasConfirmedPayment(id))) {
        return res.status(400).json({
          error: 'Confirm this member\'s Whish payment before approving their profile.',
        });
      }
    }

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

    const nextMembership = membership !== undefined ? membership : existing.rows[0].membership;
    const becameApproved = approvalStatus === 'approved' && existing.rows[0].approval_status !== 'approved';
    const paidPlanChanged = membership !== undefined && membership !== existing.rows[0].membership;
    const willBeApproved =
      approvalStatus === 'approved'
      || (approvalStatus === undefined && existing.rows[0].approval_status === 'approved');

    if (existing.rows[0].role === 'member' && isPaidPlan(nextMembership) && (becameApproved || (paidPlanChanged && willBeApproved))) {
      await startPaidPeriod(id);
      if (becameApproved) {
        await markPaymentsApplied(id);
      }
      if (willBeApproved) {
        await query(`UPDATE profiles SET is_public = TRUE, updated_at = NOW() WHERE user_id = $1`, [id]);
      }
    } else if (existing.rows[0].role === 'member' && membership !== undefined && !isPaidPlan(membership)) {
      await clearPaidPeriod(id);
      await query(`UPDATE profiles SET is_public = FALSE, updated_at = NOW() WHERE user_id = $1`, [id]);
    }

    if (approvalStatus === 'approved') {
      await query(
        `UPDATE profiles SET is_public = TRUE, updated_at = NOW()
         WHERE user_id = $1
           AND EXISTS (SELECT 1 FROM users WHERE id = $1 AND role = 'member')`,
        [id]
      );
      if (existing.rows[0].approval_status !== 'approved' && existing.rows[0].role === 'member') {
        void emailUser(
          id,
          'Your profile is live',
          'Your BOOK\'D HAUS application was approved. Your 7-day free trial has started — the full period is 1 month + 7 days from today. Your profile is now public.',
          '/dashboard'
        );
      }
    } else if (approvalStatus === 'rejected' || approvalStatus === 'pending') {
      await query(
        `UPDATE profiles SET is_public = FALSE, updated_at = NOW() WHERE user_id = $1`,
        [id]
      );
      if (approvalStatus === 'rejected' && existing.rows[0].approval_status !== 'rejected') {
        void emailUser(
          id,
          'Application update',
          'Your BOOK\'D HAUS application was not approved. You can contact us if you have questions.',
          '/contact'
        );
      }
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
    res.json(withSubscription(updated));
  } catch (err) {
    next(err);
  }
}

async function remindUserSubscription(req, res, next) {
  try {
    await remindSubscription(req.params.id);
    const user = await fetchAdminUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(withSubscription(user));
  } catch (err) {
    next(err);
  }
}

async function endUserSubscription(req, res, next) {
  try {
    await endSubscription(req.params.id, { notifyUser: true, endedBy: 'admin' });
    const user = await fetchAdminUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(withSubscription(user));
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  let client;
  try {
    client = await getClient();
    const existing = await client.query('SELECT id, role, email FROM users WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (existing.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'Admin accounts cannot be deleted' });
    }

    await client.query('BEGIN');

    const conversations = await client.query(
      `SELECT conversation_id FROM conversation_participants WHERE user_id = $1`,
      [id]
    );
    const conversationIds = conversations.rows.map((row) => row.conversation_id);

    await client.query(`DELETE FROM analytics_events WHERE user_id = $1`, [id]);
    await client.query(`DELETE FROM users WHERE id = $1`, [id]);

    if (conversationIds.length) {
      await client.query(
        `DELETE FROM conversations c
         WHERE c.id = ANY($1::uuid[])
           AND NOT EXISTS (
             SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id
           )`,
        [conversationIds]
      );
    }

    await client.query('COMMIT');
    res.json({ deleted: true, id, email: existing.rows[0].email });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore rollback errors */
      }
    }
    next(err);
  } finally {
    client?.release();
  }
}

function excelEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function exportClientsExcel(_req, res, next) {
  try {
    const result = await query(
      `SELECT
         p.full_name,
         p.professional_name,
         u.email,
         p.phone,
         p.whatsapp,
         u.membership,
         u.approval_status,
         u.is_active,
         u.created_at,
         u.last_login_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.role = 'brand'
       ORDER BY u.created_at DESC`
    );

    const headers = [
      'Name',
      'Professional Name',
      'Email',
      'Phone',
      'WhatsApp',
      'Membership',
      'Status',
      'Active',
      'Created',
      'Last Login',
    ];
    const keys = [
      'full_name',
      'professional_name',
      'email',
      'phone',
      'whatsapp',
      'membership',
      'approval_status',
      'is_active',
      'created_at',
      'last_login_at',
    ];

    const headerCells = headers
      .map((h) => `<Cell><Data ss:Type="String">${excelEscape(h)}</Data></Cell>`)
      .join('');
    const rowsXml = result.rows.map((row) => {
      const cells = keys.map((key) => {
        let value = row[key];
        if (key === 'is_active') value = value ? 'Yes' : 'No';
        if (value instanceof Date) value = value.toISOString();
        return `<Cell><Data ss:Type="String">${excelEscape(value)}</Data></Cell>`;
      }).join('');
      return `<Row>${cells}</Row>`;
    }).join('');

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Clients"><Table>
<Row>${headerCells}</Row>
${rowsXml}
</Table></Worksheet>
</Workbook>`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookd-clients.xls"');
    res.send(xml);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  exportClientsExcel,
  remindUserSubscription,
  endUserSubscription,
};
