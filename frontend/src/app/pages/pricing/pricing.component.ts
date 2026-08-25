import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

interface Plan {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  planKey: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Starter plan',
    price: '$6.99',
    period: '/ month',
    tagline: 'Get discovered and start getting BOOK\'D.',
    features: [
      '7-day free trial (1 month + 7 days)',
      'Public profile & portfolio',
      'Up to 4 portfolio images',
      'Direct messaging',
      'Search visibility',
      'Apply to join the directory',
    ],
    cta: 'Apply Starter Plan',
    planKey: 'basic',
  },
  {
    name: 'Premium plan',
    price: '$14.99',
    period: '/ month',
    tagline: 'Priority placement and more visibility.',
    features: [
      '7-day free trial (1 month + 7 days)',
      'Everything in Starter plan',
      'Up to 15 portfolio images',
      'Priority spotlight placement',
      'Enhanced search visibility',
      'Verified badge eligibility',
    ],
    cta: 'Apply Premium Plan',
    planKey: 'premium',
    highlighted: true,
  },
  // FUTURE: Brand / agency plan
  // {
  //   name: 'BRAND',
  //   price: 'Custom',
  //   period: 'contact us',
  //   tagline: 'For agencies & brands booking at scale.',
  //   features: [
  //     'Post unlimited announcements',
  //     'Bulk booking management',
  //     'Dedicated account support',
  //     'Custom integrations',
  //   ],
  //   cta: 'Apply as Brand',
  //   planKey: 'brand',
  // },
];

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [AnimatedButtonComponent],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  auth = inject(AuthService);

  plans = PLANS;

  canPayNow(): boolean {
    const user = this.auth.user();
    return !!user && user.role === 'member' && user.approval_status === 'approved';
  }

  planCta(plan: Plan): string {
    return this.canPayNow() ? `Pay ${plan.name} with Whish` : plan.cta;
  }
}
