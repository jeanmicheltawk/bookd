import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { PricingService } from '../../core/services/pricing.service';
import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import { PriceEstimate, Category } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';

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
  imports: [CommonModule, FormsModule, AnimatedButtonComponent, SelectComponent],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  private pricingService = inject(PricingService);
  private categoryService = inject(CategoryService);
  auth = inject(AuthService);

  plans = PLANS;
  categories = signal<Category[]>([]);

  estimatorForm = {
    categorySlug: '',
    durationDays: 1,
    complexity: 'standard' as const,
    usage: 'social' as const,
    teamSize: 1,
    location: 'local' as const,
  };

  categoryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.categories().map((c) => ({ value: c.slug, label: c.name })), 'General / Default'),
  );

  complexityOptions: SelectOption[] = [
    { value: 'simple', label: 'Simple' },
    { value: 'standard', label: 'Standard' },
    { value: 'complex', label: 'Complex' },
    { value: 'premium', label: 'Premium' },
  ];

  usageOptions: SelectOption[] = [
    { value: 'social', label: 'Social' },
    { value: 'web', label: 'Web' },
    { value: 'print', label: 'Print' },
    { value: 'campaign', label: 'Campaign' },
    { value: 'broadcast', label: 'Broadcast' },
  ];

  locationOptions: SelectOption[] = [
    { value: 'local', label: 'Local' },
    { value: 'travel', label: 'Travel Required' },
    { value: 'international', label: 'International' },
  ];

  estimate = signal<PriceEstimate | null>(null);
  estimating = signal(false);

  constructor() {
    this.categoryService.list({ searchable: true }).pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.categories.set(res.data));
  }

  runEstimate(): void {
    this.estimating.set(true);
    this.pricingService.estimate(this.estimatorForm)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.estimate.set(res);
        this.estimating.set(false);
      });
  }

  canPayNow(): boolean {
    const user = this.auth.user();
    return !!user && user.role === 'member' && user.approval_status === 'approved';
  }

  planCta(plan: Plan): string {
    return this.canPayNow() ? `Pay ${plan.name} with Whish` : plan.cta;
  }
}
