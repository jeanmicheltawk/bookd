import { Membership, SubscriptionInfo, SubscriptionStatus } from '../models';

export function effectiveMembership(user?: { membership?: Membership | string; effective_membership?: Membership | string } | null): Membership {
  return (user?.effective_membership || user?.membership || 'free') as Membership;
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
    return `Your ${sub.plan_label} ends in ${days} (${end}).`;
  }
  return `Your ${sub.plan_label} is active until ${end}.`;
}

export function formatSubDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
