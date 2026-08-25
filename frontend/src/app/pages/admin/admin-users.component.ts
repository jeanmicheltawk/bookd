import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ApprovalStatus, Category, CategoryField, Country, SubscriptionInfo } from '../../core/models';
import { AdminUser, AdminUserService } from '../../core/services/admin-user.service';
import { CategoryService } from '../../core/services/category.service';
import { CountryService } from '../../core/services/country.service';
import { ApiService } from '../../core/services/api.service';
import {
  ContactFieldErrors,
  EMAIL_FORMAT_PATTERN,
  PHONE_CHAR_PATTERN,
  emailErrorWhileTyping,
  getContactFieldErrors,
  hasContactFieldErrors,
  phoneErrorWhileTyping,
} from '../../core/utils/contact-validation';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';
import { subscriptionStatusLabel, membershipLabel, isComplimentaryMember } from '../../core/utils/subscription';

interface EditForm {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  professional_name: string;
  categorySlug: string;
  membership: string;
  country: string;
  city: string;
  instagram: string;
  phone: string;
  whatsapp: string;
  website: string;
  gender: string;
  age: number | null;
  bio: string;
  custom_fields: Record<string, string>;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingScreenComponent, SelectComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private usersApi = inject(AdminUserService);
  private categoryService = inject(CategoryService);
  private countryService = inject(CountryService);
  api = inject(ApiService);

  users = signal<AdminUser[]>([]);
  categories = signal<Category[]>([]);
  countries = signal<Country[]>([]);
  loading = signal(true);
  search = '';
  verifiedOnly = false;
  activeStatus = signal<ApprovalStatus | 'all'>('all');
  savingId = signal<string | null>(null);

  editingUser = signal<AdminUser | null>(null);
  creating = signal(false);
  editSaving = signal(false);
  editError = signal('');
  listError = signal('');
  listNotice = signal('');
  fieldErrors = signal<ContactFieldErrors>({});
  editCategorySlug = signal('');
  editForm: EditForm = this.emptyEditForm();

  statuses: Array<ApprovalStatus | 'all'> = ['pending', 'approved', 'rejected', 'all'];
  emailPattern = EMAIL_FORMAT_PATTERN;
  phonePattern = PHONE_CHAR_PATTERN;

  membershipOptions: SelectOption[] = [
    { value: 'basic', label: 'Starter plan ($6.99)' },
    { value: 'premium', label: 'Premium plan ($14.99)' },
    { value: 'free', label: 'Complimentary (no payment)' },
  ];

  createPlanOptions: SelectOption[] = [
    { value: 'basic', label: 'Starter plan' },
    { value: 'premium', label: 'Premium plan' },
  ];

  categoryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.categories().map((c) => ({ value: c.slug, label: c.name })), 'No category'),
  );

  countryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.countries().map((c) => ({ value: c.name, label: c.name })), 'Select country'),
  );

  fieldSelectOptions(field: CategoryField): SelectOption[] {
    return selectOptions(field.options || [], `Select ${field.label}`);
  }

  get selectedCategoryFields(): CategoryField[] {
    const slug = this.editCategorySlug();
    if (!slug) return [];
    const cat = this.categories().find((c) => c.slug === slug);
    return cat?.fields || [];
  }

  ngOnInit(): void {
    this.categoryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.categories.set(res.data);
    });
    this.countryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.countries.set(res.data);
    });
    this.load();
  }

  filterByStatus(status: ApprovalStatus | 'all'): void {
    this.activeStatus.set(status);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.listError.set('');
    this.listNotice.set('');
    const status = this.activeStatus();
    this.usersApi
      .list({
        q: this.search || undefined,
        verified: this.verifiedOnly || undefined,
        approval_status: status === 'all' ? undefined : status,
        role: 'member',
        limit: 60,
      })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 60, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.users.set(res.data);
        this.loading.set(false);
      });
  }

  openCreate(): void {
    this.editError.set('');
    this.fieldErrors.set({});
    this.editingUser.set(null);
    this.creating.set(true);
    this.editCategorySlug.set('');
    this.editForm = this.emptyEditForm();
    this.editForm.membership = '';
  }

  openEdit(user: AdminUser): void {
    this.creating.set(false);
    this.editError.set('');
    this.fieldErrors.set({});
    this.editingUser.set(user);
    this.editCategorySlug.set(user.category_slug || '');
    this.editForm = {
      email: user.email || '',
      password: '',
      confirmPassword: '',
      full_name: user.full_name || '',
      professional_name: user.professional_name || '',
      categorySlug: user.category_slug || '',
      membership: user.membership || 'basic',
      country: user.country || '',
      city: user.city || '',
      instagram: user.instagram || '',
      phone: user.phone || '',
      whatsapp: user.whatsapp || '',
      website: user.website || '',
      gender: user.gender || '',
      age: user.age ?? null,
      bio: user.bio || '',
      custom_fields: { ...(user.custom_fields || {}) },
    };
  }

  closeEdit(): void {
    this.editingUser.set(null);
    this.creating.set(false);
    this.editCategorySlug.set('');
    this.editError.set('');
    this.fieldErrors.set({});
    this.editSaving.set(false);
  }

  onEmailChange(value: string): void {
    this.editForm.email = value;
    this.fieldErrors.update((current) => ({
      ...current,
      email: emailErrorWhileTyping(value),
    }));
  }

  onPhoneChange(value: string): void {
    this.editForm.phone = value;
    this.fieldErrors.update((current) => ({
      ...current,
      phone: phoneErrorWhileTyping(value),
    }));
  }

  onWhatsappChange(value: string): void {
    this.editForm.whatsapp = value;
    this.fieldErrors.update((current) => ({
      ...current,
      whatsapp: phoneErrorWhileTyping(value),
    }));
  }

  onEditCategoryChange(): void {
    this.editCategorySlug.set(this.editForm.categorySlug || '');
    const next: Record<string, string> = {};
    for (const field of this.selectedCategoryFields) {
      next[field.field_key] = this.editForm.custom_fields[field.field_key] || '';
    }
    this.editForm.custom_fields = next;
  }

  setCustomField(key: string, value: string): void {
    this.editForm.custom_fields = { ...this.editForm.custom_fields, [key]: value };
  }

  saveEdit(): void {
    if (this.creating()) {
      this.saveCreate();
      return;
    }

    const user = this.editingUser();
    if (!user) return;

    if (!this.editForm.full_name.trim()) {
      this.editError.set('Full name is required.');
      return;
    }

    const contactErrors = getContactFieldErrors(
      this.editForm.email,
      this.editForm.phone,
      this.editForm.whatsapp,
    );
    this.fieldErrors.set(contactErrors);
    if (hasContactFieldErrors(contactErrors)) {
      this.editError.set('');
      return;
    }

    for (const field of this.selectedCategoryFields) {
      const value = (this.editForm.custom_fields[field.field_key] || '').trim();
      if (field.is_required && !value) {
        this.editError.set(`${field.label} is required.`);
        return;
      }
    }

    const ageValue = this.editForm.age;
    const ageNumber =
      ageValue === undefined || ageValue === null || String(ageValue).trim() === ''
        ? null
        : Number(ageValue);

    if (ageNumber != null && (Number.isNaN(ageNumber) || ageNumber < 16 || ageNumber > 100)) {
      this.editError.set('Age must be between 16 and 100.');
      return;
    }

    this.editSaving.set(true);
    this.editError.set('');
    this.fieldErrors.set({});

    this.usersApi
      .update(user.id, {
        email: this.editForm.email.trim(),
        full_name: this.editForm.full_name.trim(),
        professional_name: this.editForm.professional_name.trim() || this.editForm.full_name.trim(),
        categorySlug: this.editForm.categorySlug || null,
        membership: this.editForm.membership,
        country: this.editForm.country || null,
        city: this.editForm.city || null,
        instagram: this.editForm.instagram || null,
        phone: this.editForm.phone || null,
        whatsapp: this.editForm.whatsapp || null,
        website: this.editForm.website || null,
        gender: this.editForm.gender || null,
        age: ageNumber,
        bio: this.editForm.bio || null,
        custom_fields: this.editForm.custom_fields,
      })
      .subscribe({
        next: (updated) => {
          this.editSaving.set(false);
          this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
          this.closeEdit();
        },
        error: (err) => {
          this.editSaving.set(false);
          this.editError.set(err?.error?.error || 'Could not save changes.');
        },
      });
  }

  private saveCreate(): void {
    if (!this.editForm.full_name.trim()) {
      this.editError.set('Full name is required.');
      return;
    }
    if (!this.editForm.password || this.editForm.password.length < 6) {
      this.editError.set('Password must be at least 6 characters.');
      return;
    }
    if (this.editForm.password !== this.editForm.confirmPassword) {
      this.editError.set('Passwords do not match.');
      return;
    }
    if (this.editForm.membership !== 'basic' && this.editForm.membership !== 'premium') {
      this.editError.set('Choose Starter or Premium plan.');
      return;
    }

    const contactErrors = getContactFieldErrors(
      this.editForm.email,
      this.editForm.phone,
      this.editForm.whatsapp,
    );
    this.fieldErrors.set(contactErrors);
    if (hasContactFieldErrors(contactErrors)) {
      this.editError.set('');
      return;
    }

    for (const field of this.selectedCategoryFields) {
      const value = (this.editForm.custom_fields[field.field_key] || '').trim();
      if (field.is_required && !value) {
        this.editError.set(`${field.label} is required.`);
        return;
      }
    }

    const ageValue = this.editForm.age;
    const ageNumber =
      ageValue === undefined || ageValue === null || String(ageValue).trim() === ''
        ? null
        : Number(ageValue);

    if (ageNumber != null && (Number.isNaN(ageNumber) || ageNumber < 16 || ageNumber > 100)) {
      this.editError.set('Age must be between 16 and 100.');
      return;
    }

    this.editSaving.set(true);
    this.editError.set('');
    this.fieldErrors.set({});
    this.listError.set('');
    this.listNotice.set('');

    this.usersApi
      .createComplimentary({
        email: this.editForm.email.trim(),
        password: this.editForm.password,
        full_name: this.editForm.full_name.trim(),
        professional_name: this.editForm.professional_name.trim() || this.editForm.full_name.trim(),
        membership: this.editForm.membership as 'basic' | 'premium',
        categorySlug: this.editForm.categorySlug || null,
        country: this.editForm.country || null,
        city: this.editForm.city || null,
        instagram: this.editForm.instagram || null,
        phone: this.editForm.phone || null,
        whatsapp: this.editForm.whatsapp || null,
        website: this.editForm.website || null,
        gender: this.editForm.gender || null,
        age: ageNumber,
        bio: this.editForm.bio || null,
        custom_fields: this.editForm.custom_fields,
      })
      .subscribe({
        next: (created) => {
          this.editSaving.set(false);
          this.users.update((list) => [created, ...list.filter((u) => u.id !== created.id)]);
          this.listNotice.set(
            `${created.professional_name || created.full_name} is live on ${this.planName(created.membership)} with no payment. Share the login email and password.`,
          );
          this.closeEdit();
        },
        error: (err) => {
          this.editSaving.set(false);
          this.editError.set(err?.error?.error || 'Could not create the free profile.');
        },
      });
  }

  canApprove(user: AdminUser): boolean {
    if (user.role !== 'member') return true;
    if (this.isComplimentary(user)) return true;
    if (user.membership !== 'basic' && user.membership !== 'premium') return true;
    return !!user.payment_confirmed;
  }

  isComplimentary(user: AdminUser): boolean {
    return isComplimentaryMember(user);
  }

  planName(membership?: string | null): string {
    return membershipLabel(membership);
  }

  showSubscriptionActions(user: AdminUser): boolean {
    const status = user.subscription?.status;
    return !!status && status !== 'none' && status !== 'complimentary';
  }

  setApproval(user: AdminUser, approval_status: ApprovalStatus): void {
    if (approval_status === 'approved' && !this.canApprove(user)) {
      this.listError.set("Confirm this member's Whish payment before approving their profile.");
      return;
    }
    this.savingId.set(user.id);
    this.listError.set('');
    this.usersApi.update(user.id, { approval_status }).subscribe({
      next: (updated) => {
        this.savingId.set(null);
        if (this.activeStatus() === 'all') {
          this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
        } else {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
        }
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not update approval.');
      },
    });
  }

  toggleVerified(user: AdminUser): void {
    this.savingId.set(user.id);
    this.usersApi.update(user.id, { is_verified: !user.is_verified }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  setMembership(user: AdminUser, membership: string): void {
    this.savingId.set(user.id);
    this.usersApi.update(user.id, { membership }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  subStatus(sub?: SubscriptionInfo): string {
    return subscriptionStatusLabel(sub?.status);
  }

  remindSubscription(user: AdminUser): void {
    this.savingId.set(user.id);
    this.listError.set('');
    this.listNotice.set('');
    this.usersApi.remindSubscription(user.id).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        this.savingId.set(null);
        this.listNotice.set(`Reminder sent to ${updated.professional_name || updated.full_name || updated.email}.`);
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not send reminder.');
      },
    });
  }

  endSubscription(user: AdminUser): void {
    const label = user.professional_name || user.full_name || user.email;
    if (!confirm(`End ${label}'s 7-day free trial? Their profile will be taken off the public directory.`)) return;

    this.savingId.set(user.id);
    this.listError.set('');
    this.listNotice.set('');
    this.usersApi.endSubscription(user.id).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        this.savingId.set(null);
        this.listNotice.set(`${label}'s free trial ended.`);
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not end subscription.');
      },
    });
  }

  toggleActive(user: AdminUser): void {
    this.savingId.set(user.id);
    this.usersApi.update(user.id, { is_active: !user.is_active }).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  deleteUser(user: AdminUser): void {
    if (user.role === 'admin') return;
    const label = user.professional_name || user.full_name || user.email;
    if (!confirm(`Delete ${label} and all related data? This cannot be undone.`)) return;

    this.savingId.set(user.id);
    this.listError.set('');
    this.usersApi.delete(user.id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        if (this.editingUser()?.id === user.id) this.closeEdit();
        this.savingId.set(null);
      },
      error: (err) => {
        this.savingId.set(null);
        this.listError.set(err?.error?.error || 'Could not delete user.');
      },
    });
  }

  private emptyEditForm(): EditForm {
    return {
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      professional_name: '',
      categorySlug: '',
      membership: 'basic',
      country: '',
      city: '',
      instagram: '',
      phone: '',
      whatsapp: '',
      website: '',
      gender: '',
      age: null,
      bio: '',
      custom_fields: {},
    };
  }
}
