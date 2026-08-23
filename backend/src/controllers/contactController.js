const { query } = require('../config/db');
const { parsePageLimit, paginationMeta } = require('../utils/pagination');
const { emailAdmin } = require('../utils/mailer');

async function createContact(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'name, email, and message are required' });
    }

    const result = await query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, subject, status, created_at`,
      [name.trim(), email.trim().toLowerCase(), subject?.trim() || null, message.trim()]
    );
    void emailAdmin(
      'New Contact Us message',
      [
        `${name.trim()} sent a message from the Contact page.`,
        `Email: ${email.trim().toLowerCase()}`,
        subject?.trim() ? `Subject: ${subject.trim()}` : null,
        '',
        message.trim(),
      ].filter((line) => line !== null).join('\n')
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function listContacts(req, res, next) {
  try {
    const { page, limit, offset } = parsePageLimit(req.query, { limit: 25 });
    const { status } = req.query;
    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM contact_messages ${whereSql}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(
      `SELECT id, name, email, subject, message, status, admin_notes, created_at, updated_at
       FROM contact_messages ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
}

async function updateContactStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const allowed = ['new', 'read', 'replied', 'archived'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const updates = [];
    const params = [];
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (adminNotes !== undefined) {
      params.push(adminNotes);
      updates.push(`admin_notes = $${params.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(id);
    const result = await query(
      `UPDATE contact_messages SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact message not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function deleteContact(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM contact_messages WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact message not found' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
}

async function exportContactsCsv(_req, res, next) {
  try {
    const result = await query(
      `SELECT name, email, subject, message, status, admin_notes, created_at, updated_at
       FROM contact_messages ORDER BY created_at DESC`
    );

    const header = ['name', 'email', 'subject', 'message', 'status', 'admin_notes', 'created_at', 'updated_at'];
    const escape = (val) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const lines = [header.join(',')];
    for (const row of result.rows) {
      lines.push(header.map((h) => escape(row[h])).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contact_messages.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createContact,
  listContacts,
  updateContactStatus,
  deleteContact,
  exportContactsCsv,
};
