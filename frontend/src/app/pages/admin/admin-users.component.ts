import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ApprovalStatus, Category, CategoryField, Country } from '../../core/models';
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

interface EditForm {
  email: string;
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
  editSaving = signal(false);
  editError = signal('');
  listError = signal('');
  fieldErrors = signal<ContactFieldErrors>({});
  editCategorySlug = signal('');
  editForm: EditForm = this.emptyEditForm();

  statuses: Array<ApprovalStatus | 'all'> = ['pending', 'approved', 'rejected', 'all'];
  emailPattern = EMAIL_FORMAT_PATTERN;
  phonePattern = PHONE_CHAR_PATTERN;

  membershipOptions: SelectOption[] = [
    { value: 'basic', label: 'Normal ($7.99)' },
    { value: 'premium', label: 'Premium ($14.99)' },
    { value: 'free', label: 'Legacy free' },
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

  openEdit(user: AdminUser): void {
    this.editError.set('');
    this.fieldErrors.set({});
    this.editingUser.set(user);
    this.editCategorySlug.set(user.category_slug || '');
    this.editForm = {
      email: user.email || '',
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

  setApproval(user: AdminUser, approval_status: ApprovalStatus): void {
    this.savingId.set(user.id);
    this.usersApi.update(user.id, { approval_status }).subscribe({
      next: (updated) => {
        this.savingId.set(null);
        if (this.activeStatus() === 'all') {
          this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, ...updated } : u)));
        } else {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
        }
      },
      error: () => this.savingId.set(null),
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
