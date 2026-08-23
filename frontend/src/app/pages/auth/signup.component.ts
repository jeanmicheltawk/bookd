import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';

interface MembershipOption {
  value: Membership;
  label: string;
  description: string;
}

interface ClientFormModel {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  whatsapp: string;
}

interface TalentFormModel {
  fullName: string;
  professionalName: string;
  email: string;
  password: string;
  categorySlug: string;
  membership: Membership;
  country: string;
  city: string;
  bio: string;
  instagram: string;
  phone: string;
  whatsapp: string;
  website: string;
  gender: string;
  age: number | undefined;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AnimatedButtonComponent, SelectComponent],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private categoryService = inject(CategoryService);
  private countryService = inject(CountryService);

  categories = signal<Category[]>([]);
  countries = signal<Country[]>([]);
  submitted = signal(false);
  customFields = signal<Record<string, string>>({});
  role = signal<'member' | 'brand'>(this.initialRole());
  categorySlug = signal('');

  membershipOptions: MembershipOption[] = [
    { value: 'basic', label: 'Starter plan', description: '$6.99 / month' },
    { value: 'premium', label: 'Premium plan', description: '$14.99 / month' },
  ];

  talent: TalentFormModel = {
    fullName: '',
    professionalName: '',
    email: '',
    password: '',
    categorySlug: '',
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

  client: ClientFormModel = {
    fullName: '',
    email: '',
    password: '',
    phone: '',
    whatsapp: '',
  };

  talentConfirm = '';
  clientConfirm = '';
  loading = signal(false);
  error = signal('');
  fieldErrors = signal<ContactFieldErrors>({});
  passwordError = signal('');
  emailPattern = EMAIL_FORMAT_PATTERN;
  phonePattern = PHONE_CHAR_PATTERN;

  categoryOptions = computed<SelectOption[]>(() =>
    this.categories()
      .filter((c) => c.slug !== 'brand-client')
      .map((c) => ({ value: c.slug, label: c.name })),
  );

  countryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.countries().map((c) => ({ value: c.name, label: c.name })), 'Select country'),
  );

  membershipSelectOptions: SelectOption[] = this.membershipOptions.map((opt) => ({
    value: opt.value,
    label: `${opt.label} — ${opt.description}`,
  }));

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
      this.talent.membership = plan as Membership;
    } else if (plan === 'free' || plan === 'normal') {
      this.talent.membership = 'basic';
    }
  }

  private initialRole(): 'member' | 'brand' {
    const params = this.route.snapshot.queryParamMap;
    return params.get('role') === 'brand' || params.get('plan') === 'brand' ? 'brand' : 'member';
  }

  onRoleChange(role: 'member' | 'brand'): void {
    this.role.set(role);
    this.error.set('');
    this.fieldErrors.set({});
    this.passwordError.set('');
    if (role === 'member') {
      this.categorySlug.set(this.talent.categorySlug || '');
      this.onCategoryChange();
    }
  }

  onCategoryChange(): void {
    this.categorySlug.set(this.talent.categorySlug || '');
    const next: Record<string, string> = {};
    for (const field of this.selectedCategoryFields()) {
      next[field.field_key] = this.customFields()[field.field_key] || '';
    }
    this.customFields.set(next);
  }

  fieldSelectOptions(field: CategoryField): SelectOption[] {
    return selectOptions(field.options || [], `Select ${field.label}`);
  }

  setCustomField(key: string, value: string): void {
    this.customFields.update((current) => ({ ...current, [key]: value }));
  }

  onTalentPasswordChange(value: string): void {
    this.talent.password = value;
    this.syncPasswordError(this.talent.password, this.talentConfirm);
  }

  onTalentConfirmChange(value: string): void {
    this.talentConfirm = value;
    this.syncPasswordError(this.talent.password, this.talentConfirm);
  }

  onClientPasswordChange(value: string): void {
    this.client.password = value;
    this.syncPasswordError(this.client.password, this.clientConfirm);
  }

  onClientConfirmChange(value: string): void {
    this.clientConfirm = value;
    this.syncPasswordError(this.client.password, this.clientConfirm);
  }

  private syncPasswordError(password: string, confirm: string): void {
    if (!confirm) {
      this.passwordError.set('');
      return;
    }
    this.passwordError.set(password === confirm ? '' : 'Passwords do not match.');
  }

  onTalentEmailChange(value: string): void {
    this.talent.email = value;
    this.setEmailError(value);
  }

  onClientEmailChange(value: string): void {
    this.client.email = value;
    this.setEmailError(value);
  }

  onTalentPhoneChange(value: string): void {
    this.talent.phone = value;
    this.fieldErrors.update((current) => ({ ...current, phone: phoneErrorWhileTyping(value) }));
  }

  onTalentWhatsappChange(value: string): void {
    this.talent.whatsapp = value;
    this.fieldErrors.update((current) => ({ ...current, whatsapp: phoneErrorWhileTyping(value) }));
  }

  onClientPhoneChange(value: string): void {
    this.client.phone = value;
    this.fieldErrors.update((current) => ({ ...current, phone: phoneErrorWhileTyping(value) }));
  }

  onClientWhatsappChange(value: string): void {
    this.client.whatsapp = value;
    this.fieldErrors.update((current) => ({ ...current, whatsapp: phoneErrorWhileTyping(value) }));
  }

  private setEmailError(value: string): void {
    this.fieldErrors.update((current) => ({
      ...current,
      email: emailErrorWhileTyping(value),
    }));
  }

  private validateCustomFields(): string | null {
    for (const field of this.selectedCategoryFields()) {
      const value = (this.customFields()[field.field_key] || '').trim();
      if (!value) {
        return `${field.label} is required.`;
      }
    }
    return null;
  }

  submitClient(ngForm: NgForm): void {
    const contactErrors = getContactFieldErrors(this.client.email, this.client.phone, this.client.whatsapp);
    this.fieldErrors.set(contactErrors);
    if (hasContactFieldErrors(contactErrors)) {
      this.error.set('');
      return;
    }

    this.syncPasswordError(this.client.password, this.clientConfirm);
    if (!this.clientConfirm || this.client.password !== this.clientConfirm) {
      this.passwordError.set('Passwords do not match.');
      this.error.set('');
      return;
    }

    if (!this.client.fullName.trim() || this.client.fullName.trim().length < 2) {
      this.error.set('Please enter your full name.');
      return;
    }
    if (!this.client.password || this.client.password.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }
    if (!this.client.phone.trim() || !this.client.whatsapp.trim()) {
      this.error.set('Phone and WhatsApp are required.');
      return;
    }
    if (ngForm.invalid) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    this.register({
      fullName: this.client.fullName.trim(),
      professionalName: this.client.fullName.trim(),
      email: this.client.email.trim(),
      password: this.client.password,
      role: 'brand',
      membership: 'free',
      categorySlug: 'brand-client',
      phone: this.client.phone.trim(),
      whatsapp: this.client.whatsapp.trim(),
    });
  }

  submitTalent(ngForm: NgForm): void {
    const contactErrors = getContactFieldErrors(this.talent.email, this.talent.phone, this.talent.whatsapp);
    this.fieldErrors.set(contactErrors);
    if (hasContactFieldErrors(contactErrors)) {
      this.error.set('');
      return;
    }

    this.syncPasswordError(this.talent.password, this.talentConfirm);
    if (!this.talentConfirm || this.talent.password !== this.talentConfirm) {
      this.passwordError.set('Passwords do not match.');
      this.error.set('');
      return;
    }

    if (!this.talent.fullName.trim() || this.talent.fullName.trim().length < 2) {
      this.error.set('Please enter your full name.');
      return;
    }
    if (!this.talent.professionalName.trim() || this.talent.professionalName.trim().length < 2) {
      this.error.set('Please enter your professional name.');
      return;
    }
    if (!this.talent.password || this.talent.password.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }
    if (!this.talent.categorySlug) {
      this.error.set('Please choose a category.');
      return;
    }
    if (!this.talent.country.trim()) {
      this.error.set('Please select a country.');
      return;
    }
    if (!this.talent.city.trim()) {
      this.error.set('Please enter your city.');
      return;
    }
    if (!this.talent.instagram.trim()) {
      this.error.set('Please enter your Instagram handle.');
      return;
    }
    if (!this.talent.phone.trim() || !this.talent.whatsapp.trim()) {
      this.error.set('Phone and WhatsApp are required.');
      return;
    }
    if (!this.talent.gender.trim()) {
      this.error.set('Please enter your gender.');
      return;
    }
    if (!this.talent.bio.trim()) {
      this.error.set('Please write a short bio.');
      return;
    }

    if (ngForm.invalid) {
      this.error.set('Please fill in all required fields.');
      return;
    }

    const customError = this.validateCustomFields();
    if (customError) {
      this.error.set(customError);
      return;
    }

    const ageValue = this.talent.age;
    const ageNumber =
      ageValue === undefined || ageValue === null || String(ageValue).trim() === ''
        ? undefined
        : Number(ageValue);

    this.register({
      ...this.talent,
      role: 'member',
      professionalName: this.talent.professionalName || this.talent.fullName,
      categorySlug: this.talent.categorySlug,
      membership: this.talent.membership,
      age: ageNumber != null && !Number.isNaN(ageNumber) ? ageNumber : undefined,
      customFields: this.selectedCategoryFields().length ? this.customFields() : undefined,
    });
  }

  private register(payload: RegisterPayload): void {
    this.loading.set(true);
    this.error.set('');
    this.fieldErrors.set({});

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.accessToken) {
          const redirect = this.route.snapshot.queryParamMap.get('redirect');
          this.router.navigateByUrl(redirect || '/dashboard');
          return;
        }
        this.submitted.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Could not submit your application. Try again.');
      },
    });
  }
}
