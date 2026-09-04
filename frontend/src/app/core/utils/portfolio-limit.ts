import { Membership } from '../models';

export const STARTER_PORTFOLIO_LIMIT = 4;
export const PREMIUM_PORTFOLIO_LIMIT = 15;

export function portfolioLimitFor(membership?: Membership | string | null): number {
  return membership === 'premium' ? PREMIUM_PORTFOLIO_LIMIT : STARTER_PORTFOLIO_LIMIT;
}

export function isPortfolioPdf(item: { media_type?: string; url?: string | null }): boolean {
  if (item.media_type === 'pdf') return true;
  return /\.pdf(\?|#|$)/i.test(item.url || '');
}
