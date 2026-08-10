import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService, RegisterPayload } from '../../core/services/auth.service';
import { CategoryService } from '../../core/services/category.service';
import { CountryService } from '../../core/services/country.service';
import { Category, CategoryField, Country, Membership } from '../../core/models';
import {
  ContactFieldErrors,
  EMAIL_FORMAT_PATTERN,
  PHONE_CHAR_PATTERN,
  emailErrorWhileTyping,
  getContactFieldErrors,
  hasContactFieldErrors,
  phoneErrorWhileTyping,
} from '../../core/utils/contact-validation';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

interface MembershipOption {
  value: Membership;
  label: string;
  description: string;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private categoryService = inject(CategoryService);
  private countryService = inject(CountryService);

  categories = signal<Category[]>([]);
  countries = signal<Country[]>([]);
  submitted = signal(false);
  customFields = signal<Record<string, string>>({});
  role = signal<'member' | 'brand'>('member');
  categorySlug = signal('');

  membershipOptions: MembershipOption[] = [
    { value: 'basic', label: 'Normal', description: '$7.99 / month' },
    { value: 'premium', label: 'Premium', description: '$14.99 / month' },
  ];

  form: RegisterPayload = {
    fullName: '',
    professionalName: '',
    email: '',
    password: '',
    categorySlug: '',
    role: 'member',
    membership: 'basic',
    country: '',
    city: '',
    bio: '',
    instagram: '',
    phone: '',
    whatsapp: '',
    website: '',
    gender: '',
    age: undefined,
  };

  loading = signal(false);
  error = signal('');
  fieldErrors = signal<ContactFieldErrors>({});
  emailPattern = EMAIL_FORMAT_PATTERN;
  phonePattern = PHONE_CHAR_PATTERN;

  selectedCategoryFields = computed<CategoryField[]>(() => {
    if (this.role() !== 'member') return [];
    const slug = this.categorySlug();
    if (!slug) return [];
    const cat = this.categories().find((c) => c.slug === slug);
    return cat?.fields || [];
  });

  ngOnInit(): void {
    this.categoryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.categories.set(res.data);
    });
    this.countryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.countries.set(res.data);
    });

    const plan = (this.route.snapshot.queryParamMap.get('plan') || '').toLowerCase();
    if (plan === 'premium' || plan === 'basic') {
      this.form.membership = plan as Membership;
    } else if (plan === 'free' || plan === 'normal') {
      this.form.membership = 'basic';
    }
    if (plan === 'brand') {
      this.onRoleChange('brand');
      this.form.membership = 'basic';
    }
  }

  onRoleChange(role: 'member' | 'brand'): void {
    this.role.set(role);
    this.form.role = role;
    if (role === 'brand') {
      this.form.categorySlug = 'brand-client';
      this.categorySlug.set('brand-client');
      this.customFields.set({});
    } else {
      if (this.form.categorySlug === 'brand-client') {
        this.form.categorySlug = '';
      }
      this.categorySlug.set(this.form.categorySlug || '');
      this.onCategoryChange();
    }
  }

  onCategoryChange(): void {
    this.categorySlug.set(this.form.categorySlug || '');
    const next: Record<string, string> = {};
    for (const field of this.selectedCategoryFields()) {
      next[field.field_key] = this.customFields()[field.field_key] || '';
    }
    this.customFields.set(next);
  }

  setCustomField(key: string, value: string): void {
    this.customFields.update((current) => ({ ...current, [key]: value }));
  }

  onEmailChange(value: string): void {
    this.form.email = value;
    this.fieldErrors.update((current) => ({
      ...current,
      email: emailErrorWhileTyping(value),
    }));
  }

  onPhoneChange(value: string): void {
    this.form.phone = value;
    this.fieldErrors.update((current) => ({
      ...current,
      phone: phoneErrorWhileTyping(value),
    }));
  }

  onWhatsappChange(value: string): void {
    this.form.whatsapp = value;
    this.fieldErrors.update((current) => ({
      ...current,
      whatsapp: phoneErrorWhileTyping(value),
    }));
  }

  private validateCustomFields(): string | null {
    for (const field of this.selectedCategoryFields()) {
      const value = (this.customFields()[field.field_key] || '').trim();
      if (field.is_required && !value) {
        return `${field.label} is required`;
      }
    }
    return null;
  }

  submit(ngForm: NgForm): void {
    const contactErrors = getContactFieldErrors(this.form.email, this.form.phone, this.form.whatsapp);
    this.fieldErrors.set(contactErrors);

    if (hasContactFieldErrors(contactErrors)) {
      this.error.set('');
      return;
    }

    if (ngForm.invalid) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    if (this.role() === 'member' && !this.form.categorySlug) {
      this.error.set('Please choose a category.');
      return;
    }

    const customError = this.validateCustomFields();
    if (customError) {
      this.error.set(customError);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.fieldErrors.set({});

    const ageValue = this.form.age;
    const ageNumber =
      ageValue === undefined || ageValue === null || String(ageValue).trim() === ''
        ? undefined
        : Number(ageValue);

    const payload: RegisterPayload = {
      ...this.form,
      role: this.role(),
      professionalName: this.form.professionalName || this.form.fullName,
      categorySlug: this.form.categorySlug || undefined,
      age: ageNumber != null && !Number.isNaN(ageNumber) ? ageNumber : undefined,
      customFields: this.selectedCategoryFields().length ? this.customFields() : undefined,
    };

    this.auth.register(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Could not submit your application. Try again.');
      },
    });
  }
}
