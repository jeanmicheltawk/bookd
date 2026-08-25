import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { CountryService } from '../../core/services/country.service';
import { CategoryService } from '../../core/services/category.service';
import { ApiService } from '../../core/services/api.service';
import { Category, CategoryField, Country } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';

@Component({
  selector: 'app-dashboard-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavComponent, AnimatedButtonComponent, LoadingScreenComponent, SelectComponent],
  templateUrl: './dashboard-settings.component.html',
  styleUrl: './dashboard-settings.component.scss',
})
export class DashboardSettingsComponent implements OnInit {
  auth = inject(AuthService);
  api = inject(ApiService);
  private profileService = inject(ProfileService);
  private countryService = inject(CountryService);
  private categoryService = inject(CategoryService);

  countries = signal<Country[]>([]);
  categories = signal<Category[]>([]);
  categorySlug = signal('');
  customFields = signal<Record<string, string>>({});
  loading = signal(true);
  saving = signal(false);
  uploadingPhoto = signal(false);
  saved = signal(false);
  error = signal('');

  form: any = {
    fullName: '',
    professionalName: '',
    bio: '',
    city: '',
    country: '',
    website: '',
    instagram: '',
    phone: '',
    whatsapp: '',
    gender: '',
    age: null as number | null,
    availability: 'available',
    isPublic: true,
    profilePhotoUrl: '',
    categorySlug: '',
  };

  categoryOptions = computed<SelectOption[]>(() =>
    selectOptions(
      this.categories()
        .filter((c) => c.slug !== 'brand-client')
        .map((c) => ({ value: c.slug, label: c.name })),
      'Choose your category',
    ),
  );

  countryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.countries().map((c) => ({ value: c.name, label: c.name })), 'Select country'),
  );

  availabilityOptions: SelectOption[] = [
    { value: 'available', label: 'Available Now' },
    { value: 'busy', label: 'Busy' },
    { value: 'booked', label: 'Booked' },
  ];

  selectedCategoryFields = computed<CategoryField[]>(() => {
    const slug = this.categorySlug();
    if (!slug) return [];
    const cat = this.categories().find((c) => c.slug === slug);
    return cat?.fields || [];
  });

  get isBrand(): boolean {
    return this.auth.user()?.role === 'brand' || this.form.categorySlug === 'brand-client';
  }

  ngOnInit(): void {
    this.countryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.countries.set(res.data);
    });
    this.categoryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.categories.set(res.data);
    });

    this.profileService
      .getMine()
      .pipe(catchError(() => of(null)))
      .subscribe((p) => {
        if (p) {
          this.form = {
            fullName: p.full_name || '',
            professionalName: p.professional_name || '',
            bio: p.bio || '',
            city: p.city || '',
            country: p.country || '',
            website: p.website || '',
            instagram: p.instagram || '',
            phone: p.phone || '',
            whatsapp: p.whatsapp || '',
            gender: p.gender || '',
            age: p.age ?? null,
            availability: p.availability || 'available',
            isPublic: p.is_public ?? true,
            profilePhotoUrl: p.profile_photo_url || '',
            categorySlug: p.category_slug || '',
          };
          this.categorySlug.set(p.category_slug || '');
          this.customFields.set({ ...(p.custom_fields || {}) });
        }
        this.loading.set(false);
      });
  }

  onCategoryChange(): void {
    this.categorySlug.set(this.form.categorySlug || '');
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

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose a JPEG, PNG, GIF, or WebP image.');
      input.value = '';
      return;
    }

    this.uploadingPhoto.set(true);
    this.error.set('');
    this.saved.set(false);

    this.profileService.uploadPhoto(file).subscribe({
      next: (media) => {
        this.form.profilePhotoUrl = media.profile_photo_url || media.url;
        this.auth.updateStoredUser({ profile_photo_url: this.form.profilePhotoUrl });
        this.uploadingPhoto.set(false);
        this.saved.set(true);
        input.value = '';
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        this.error.set(err?.error?.error || 'Could not upload photo. Try a smaller image.');
        input.value = '';
      },
    });
  }

  save(): void {
    this.saving.set(true);
    this.error.set('');
    this.saved.set(false);

    if (this.isBrand) {
      this.profileService
        .updateMine({
          full_name: this.form.fullName,
          professional_name: this.form.fullName,
          phone: this.form.phone,
          whatsapp: this.form.whatsapp,
          profile_photo_url: this.form.profilePhotoUrl,
          is_public: false,
        } as any)
        .subscribe({
          next: () => this.onSaved(),
          error: (err) => this.onSaveError(err),
        });
      return;
    }

    for (const field of this.selectedCategoryFields()) {
      const value = (this.customFields()[field.field_key] || '').trim();
      if (field.is_required && !value) {
        this.error.set(`${field.label} is required.`);
        this.saving.set(false);
        return;
      }
    }

    const ageValue = this.form.age;
    const ageNumber =
      ageValue === undefined || ageValue === null || String(ageValue).trim() === ''
        ? null
        : Number(ageValue);

    if (ageNumber != null && (Number.isNaN(ageNumber) || ageNumber < 16 || ageNumber > 100)) {
      this.error.set('Age must be between 16 and 100.');
      this.saving.set(false);
      return;
    }

    this.profileService
      .updateMine({
        full_name: this.form.fullName,
        professional_name: this.form.professionalName,
        bio: this.form.bio,
        city: this.form.city,
        country: this.form.country,
        website: this.form.website,
        instagram: this.form.instagram,
        phone: this.form.phone,
        whatsapp: this.form.whatsapp,
        gender: this.form.gender || null,
        age: ageNumber,
        availability: this.form.availability,
        is_public: this.auth.isPending() ? false : this.form.isPublic,
        profile_photo_url: this.form.profilePhotoUrl,
        categorySlug: this.form.categorySlug || undefined,
        custom_fields: this.selectedCategoryFields().length ? this.customFields() : {},
      } as any)
      .subscribe({
        next: () => this.onSaved(),
        error: (err) => this.onSaveError(err),
      });
  }

  private onSaved(): void {
    this.saving.set(false);
    this.saved.set(true);
    this.auth.updateStoredUser({
      full_name: this.form.fullName,
      professional_name: this.isBrand ? this.form.fullName : this.form.professionalName,
      profile_photo_url: this.form.profilePhotoUrl,
    });
  }

  private onSaveError(err: { error?: { error?: string } }): void {
    this.saving.set(false);
    this.error.set(err?.error?.error || 'Could not save changes.');
  }
}
