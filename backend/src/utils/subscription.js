const { query } = require('../config/db');
const { notify } = require('./notify');
const { emailAdmin, dashboardUrl, cta } = require('./mailer');

const PAID_MEMBERSHIPS = ['basic', 'premium'];
const TRIAL_DAYS = 7;
const PAYMENT_REMINDER_DAYS = 5;
const PERIOD_SQL = `NOW() + INTERVAL '1 month 7 days'`;
const TRIAL_SQL = `NOW() + INTERVAL '7 days'`;

function isPaidPlan(membership) {
  return PAID_MEMBERSHIPS.includes(membership);
}

function isComplimentaryPlan(membership) {
  return membership === 'free';
}

function isComplimentary(user) {
  if (!user) return false;
  return user.is_complimentary === true || user.is_complimentary === 't' || isComplimentaryPlan(user.membership);
}

function planLabel(membership) {
  if (membership === 'premium') return 'Premium plan';
  if (membership === 'basic') return 'Starter plan';
  if (membership === 'free') return 'Complimentary';
  return membership || 'plan';
}

function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function daysFromNow(value) {
  const time = toTime(value);
  if (time == null) return null;
  return Math.ceil((time - Date.now()) / (24 * 60 * 60 * 1000));
}

function isPaidActive(user) {
  if (user?.role && user.role !== 'member') return false;
  if (user.approval_status && user.approval_status !== 'approved') return false;
  if (isComplimentary(user)) {
    return isPaidPlan(user.membership) || isComplimentaryPlan(user.membership);
  }
  if (!isPaidPlan(user?.membership)) return false;
  const ends = toTime(user.membership_ends_at);
  if (ends == null) return false;
  return ends > Date.now();
}

function effectiveMembership(user) {
  return isPaidActive(user) ? user.membership : 'free';
}

function subscriptionStatus(user) {
  if (user?.role && user.role !== 'member') return 'none';
  if (isComplimentary(user)) {
    if (user.approval_status && user.approval_status !== 'approved') return 'none';
    return 'complimentary';
  }
  if (!isPaidPlan(user?.membership)) return 'none';
  const ends = toTime(user.membership_ends_at);
  if (ends == null) return 'none';
  if (ends <= Date.now()) return 'expired';
  const trialEnds = toTime(user.membership_trial_ends_at);
  if (trialEnds != null && trialEnds > Date.now()) return 'trial';
  const daysLeft = daysFromNow(user.membership_ends_at);
  if (daysLeft != null && daysLeft <= PAYMENT_REMINDER_DAYS) return 'ending_soon';
  return 'active';
}

function withSubscription(user) {
  if (!user) return user;
  if (user.approval_status && user.approval_status !== 'approved') {
    return {
      ...user,
      effective_membership: 'free',
      subscription: {
        plan: user.membership,
        plan_label: planLabel(user.membership),
        status: 'none',
        started_at: null,
        trial_ends_at: null,
        ends_at: null,
        days_remaining: null,
        in_trial: false,
        can_end: false,
        needs_reminder: false,
      },
    };
  }
  const status = subscriptionStatus(user);
  const daysRemaining = daysFromNow(user.membership_ends_at);
  return {
    ...user,
    effective_membership: effectiveMembership(user),
    subscription: {
      plan: user.membership,
      plan_label: planLabel(user.membership),
      status,
      started_at: user.membership_started_at || null,
      trial_ends_at: user.membership_trial_ends_at || null,
      ends_at: user.membership_ends_at || null,
      days_remaining: daysRemaining,
      in_trial: status === 'trial',
      can_end: status === 'trial',
      needs_reminder: status === 'trial' || status === 'ending_soon',
    },
  };
}

function formatEndDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function paymentReminderBody(user) {
  const endDate = formatEndDate(user.membership_ends_at);
  const days = daysFromNow(user.membership_ends_at);
  const when =
    days == null ? `on ${endDate}`
    : days <= 0 ? `today (${endDate})`
    : days === 1 ? `tomorrow (${endDate})`
    : `in ${days} days (${endDate})`;
  return `Your ${planLabel(user.membership)} ends ${when}. Pay with Whish to Whish to +961 3 177 655. Open Pay in your dashboard for the exact amount and your unique reference to put in the transfer note.`;
}

async function startPaidPeriod(userId, exec = query) {
  const result = await exec(
    `UPDATE users SET
       membership_started_at = NOW(),
       membership_trial_ends_at = ${TRIAL_SQL},
       membership_ends_at = ${PERIOD_SQL},
       membership_reminder_sent_at = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING membership_started_at, membership_trial_ends_at, membership_ends_at`,
    [userId]
  );
  return result.rows[0] || null;
}

async function clearPaidPeriod(userId, exec = query) {
  await exec(
    `UPDATE users SET
       membership_started_at = NULL,
       membership_trial_ends_at = NULL,
       membership_ends_at = NULL,
       membership_reminder_sent_at = NULL,
       updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

async function hidePublicProfile(userId) {
  await query(
    `UPDATE profiles SET is_public = FALSE, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
}

async function sendDuePaymentReminders() {
  const result = await query(
    `UPDATE users
     SET membership_reminder_sent_at = NOW(), updated_at = NOW()
     WHERE role = 'member'
       AND membership IN ('basic', 'premium')
       AND COALESCE(is_complimentary, FALSE) = FALSE
       AND is_active = TRUE
       AND COALESCE(approval_status, 'approved') = 'approved'
       AND membership_ends_at IS NOT NULL
       AND membership_ends_at > NOW()
       AND membership_ends_at <= NOW() + INTERVAL '${PAYMENT_REMINDER_DAYS} days'
       AND (
         membership_reminder_sent_at IS NULL
         OR (membership_started_at IS NOT NULL AND membership_reminder_sent_at < membership_started_at)
       )
     RETURNING id, membership, membership_ends_at`
  );

  for (const row of result.rows) {
    void notify(
      row.id,
      'Time to pay your subscription',
      paymentReminderBody(row),
      '/dashboard/pay'
    );
  }

  return result.rows;
}

async function expireOverdueSubscriptions() {
  await sendDuePaymentReminders();
  const result = await query(
    `UPDATE profiles p
     SET is_public = FALSE, updated_at = NOW()
     FROM users u
     WHERE p.user_id = u.id
       AND u.role = 'member'
       AND u.membership IN ('basic', 'premium')
       AND COALESCE(u.is_complimentary, FALSE) = FALSE
       AND u.membership_ends_at IS NOT NULL
       AND u.membership_ends_at <= NOW()
       AND p.is_public = TRUE
     RETURNING u.id AS user_id, u.membership`
  );

  for (const row of result.rows) {
    void notify(
      row.user_id,
      'Subscription ended',
      `Your ${planLabel(row.membership)} period has ended (1 month + 7-day trial). Your profile is no longer public. Choose a plan to continue.`,
      '/dashboard/pay'
    );
  }

  return result.rows;
}

const RENEWAL_SQL = `NOW() + INTERVAL '1 month'`;

async function extendPaidPeriod(userId, exec = query) {
  const existing = await exec(
    `SELECT id, role, membership, membership_ends_at, approval_status
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = existing.rows[0];
  if (!user || user.role !== 'member' || !isPaidPlan(user.membership)) {
    const err = new Error('This account has no paid plan to renew');
    err.status = 400;
    throw err;
  }

  const ends = toTime(user.membership_ends_at);
  const stillActive = ends != null && ends > Date.now();
  const result = await exec(
    stillActive
      ? `UPDATE users SET
           membership_ends_at = membership_ends_at + INTERVAL '1 month',
           membership_reminder_sent_at = NULL,
           updated_at = NOW()
         WHERE id = $1
         RETURNING membership_started_at, membership_trial_ends_at, membership_ends_at`
      : `UPDATE users SET
           membership_started_at = NOW(),
           membership_trial_ends_at = NOW(),
           membership_ends_at = ${RENEWAL_SQL},
           membership_reminder_sent_at = NULL,
           updated_at = NOW()
         WHERE id = $1
         RETURNING membership_started_at, membership_trial_ends_at, membership_ends_at`,
    [userId]
  );

  if (user.approval_status === 'approved') {
    await exec(`UPDATE profiles SET is_public = TRUE, updated_at = NOW() WHERE user_id = $1`, [userId]);
  }

  return result.rows[0] || null;
}

async function endSubscription(userId, { notifyUser = true, endedBy = 'admin' } = {}) {
  const existing = await query(
    `SELECT u.id, u.email, u.role, u.membership, u.membership_ends_at, u.membership_trial_ends_at, u.membership_started_at,
            p.full_name, p.professional_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const user = existing.rows[0];
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (user.role !== 'member' || subscriptionStatus(user) !== 'trial') {
    const err = new Error('You can only end a subscription during the 7-day free trial.');
    err.status = 400;
    throw err;
  }

  await query(
    `UPDATE users SET
       membership_ends_at = NOW(),
       membership_trial_ends_at = CASE
         WHEN membership_trial_ends_at IS NULL THEN NOW()
         ELSE LEAST(membership_trial_ends_at, NOW())
       END,
       updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  await hidePublicProfile(userId);

  const name = user.professional_name || user.full_name || user.email;
  const plan = planLabel(user.membership);
  const cancelledAt = new Date().toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const cancelledBy = endedBy === 'self' ? 'self' : 'admin';

  await query(
    `INSERT INTO subscription_cancellations
       (user_id, email, full_name, professional_name, plan, cancelled_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.id, user.email, user.full_name || null, user.professional_name || null, user.membership, cancelledBy]
  );

  void emailAdmin(
    'Subscription cancelled',
    [
      `${name} cancelled their ${plan} during the 7-day free trial.`,
      `Email: ${user.email}`,
      `Plan: ${plan}`,
      `Cancelled: ${cancelledAt}`,
      `Cancelled by: ${cancelledBy === 'self' ? 'member' : 'admin'}`,
    ].join('\n'),
    cta(dashboardUrl('/admin/cancellations'), 'Open cancelled subscriptions')
  );

  if (notifyUser) {
    const body =
      endedBy === 'self'
        ? `You ended your ${plan} 7-day free trial. Your profile is no longer public.`
        : `Your ${plan} 7-day free trial was ended. Your profile is no longer public. Contact us if you want to renew.`;
    void notify(userId, 'Subscription ended', body, '/dashboard/pay');
  }

  const updated = await query(
    `SELECT id, membership, membership_started_at, membership_trial_ends_at, membership_ends_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return withSubscription(updated.rows[0]);
}

async function remindSubscription(userId) {
  const result = await query(
    `SELECT id, role, membership, membership_ends_at, membership_trial_ends_at, membership_started_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = result.rows[0];
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (user.role !== 'member' || !isPaidPlan(user.membership) || !user.membership_ends_at) {
    const err = new Error('This account has no subscription to remind');
    err.status = 400;
    throw err;
  }

  const status = subscriptionStatus(user);
  const endDate = new Date(user.membership_ends_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const trialDate = user.membership_trial_ends_at
    ? new Date(user.membership_trial_ends_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  let body;
  if (status === 'expired') {
    body = `Your ${planLabel(user.membership)} ended on ${endDate}. Pay with Whish to Whish to +961 3 177 655. Open Pay in your dashboard for the amount and your unique reference.`;
  } else if (status === 'trial') {
    body = `Your 7-day free trial for ${planLabel(user.membership)} ends on ${trialDate}. The full period (1 month + 7 days) ends on ${endDate}.`;
  } else {
    body = paymentReminderBody(user);
  }

  await notify(userId, 'Subscription reminder', body, '/dashboard/pay');
  return withSubscription(user);
}

async function loadUserSubscription(userId) {
  const result = await query(
    `SELECT id, role, membership, approval_status, is_complimentary, membership_started_at, membership_trial_ends_at, membership_ends_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ? withSubscription(result.rows[0]) : null;
}

module.exports = {
  PAID_MEMBERSHIPS,
  TRIAL_DAYS,
  PAYMENT_REMINDER_DAYS,
  PERIOD_SQL,
  TRIAL_SQL,
  isPaidPlan,
  isComplimentaryPlan,
  isComplimentary,
  isPaidActive,
  planLabel,
  effectiveMembership,
  subscriptionStatus,
  withSubscription,
  startPaidPeriod,
  extendPaidPeriod,
  clearPaidPeriod,
  sendDuePaymentReminders,
  expireOverdueSubscriptions,
  endSubscription,
  remindSubscription,
  loadUserSubscription,
};
