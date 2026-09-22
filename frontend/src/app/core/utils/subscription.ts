import { Membership, SubscriptionInfo, SubscriptionStatus } from '../models';

function asMembership(value?: string | null): Membership | null {
  if (value === 'premium' || value === 'basic' || value === 'free' || value === 'visitor') {
    return value;
  }
  return null;
}

/** Plan the member currently has access to. Pending/expired subscriptions are treated as free. */
export function membershipFromSubscription(subscription?: SubscriptionInfo | null): Membership | null {
  if (!subscription) return null;
  if (subscription.status === 'none' || subscription.status === 'expired') return 'free';
  return asMembership(subscription.plan);
}

export function effectiveMembership(user?: {
  membership?: Membership | string;
  effective_membership?: Membership | string;
  subscription?: SubscriptionInfo | null;
} | null): Membership {
  const fromSub = membershipFromSubscription(user?.subscription);
  if (fromSub) return fromSub;
  return asMembership(user?.effective_membership) || asMembership(user?.membership) || 'free';
}

export function membershipLabel(membership?: string | null): string {
  if (membership === 'premium') return 'Premium plan';
  if (membership === 'basic') return 'Starter plan';
  if (membership === 'free') return 'Complimentary';
  return membership || 'plan';
}

export function isComplimentaryMember(user?: { is_complimentary?: boolean; membership?: string | null } | null): boolean {
  return !!user?.is_complimentary || user?.membership === 'free';
}

export function subscriptionStatusLabel(status?: SubscriptionStatus | string | null): string {
  switch (status) {
    case 'trial':
      return 'Free trial';
    case 'active':
      return 'Active';
    case 'ending_soon':
      return 'Ending soon';
    case 'expired':
      return 'Ended';
    case 'complimentary':
      return 'Complimentary';
    default:
      return 'No plan';
  }
}

export const RENEWAL_WINDOW_DAYS = 5;

export function daysUntilResubscribe(daysRemaining?: number | null): number | null {
  if (daysRemaining == null) return null;
  return Math.max(0, daysRemaining - RENEWAL_WINDOW_DAYS);
}

export function postTrialPlanCopy(sub: SubscriptionInfo): string {
  const end = formatSubDate(sub.ends_at);
  if (sub.status === 'expired') {
    return `Your plan ended ${end}. You can resubscribe now.`;
  }

  const left =
    sub.days_remaining == null
      ? ''
      : sub.days_remaining === 1
        ? ' (1 day left)'
        : ` (${sub.days_remaining} days left)`;
  const untilRenew = daysUntilResubscribe(sub.days_remaining);
  if (untilRenew == null || untilRenew <= 0 || sub.status === 'ending_soon' || sub.payment_due) {
    return `Plan ends ${end}${left}. You can resubscribe now.`;
  }
  if (untilRenew === 1) {
    return `Plan ends ${end}${left}. You can resubscribe tomorrow.`;
  }
  return `Plan ends ${end}${left}. You can resubscribe in ${untilRenew} days.`;
}

export function subscriptionReminderText(sub: SubscriptionInfo): string {
  const end = formatSubDate(sub.ends_at);
  if (sub.status === 'expired') {
    return `Your ${sub.plan_label} has ended. Renew to keep your public profile.`;
  }
  if (sub.status === 'trial') {
    return `Your 7-day free trial ends ${formatSubDate(sub.trial_ends_at)}. Full period (1 month + 7 days) ends ${end}.`;
  }
  if (sub.status === 'ending_soon') {
    const days = sub.days_remaining === 1 ? '1 day' : `${sub.days_remaining} days`;
    return `Your ${sub.plan_label} ends in ${days} (${end}). You can resubscribe now.`;
  }
  return postTrialPlanCopy(sub);
}

export function formatSubDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
