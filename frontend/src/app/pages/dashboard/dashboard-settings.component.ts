import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { CountryService } from '../../core/services/country.service';
import { CategoryService, sortCategoryFields } from '../../core/services/category.service';
import { ApiService } from '../../core/services/api.service';
import { Category, CategoryField, Country } from '../../core/models';
import { CreatorSetupService } from '../../core/services/creator-setup.service';
import { DashboardNavComponent } from './dashboard-nav.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { ImageCropperComponent } from '../../shared/components/image-cropper/image-cropper.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';
import { toGenderValue } from '../../core/utils/gender';

@Component({
  selector: 'app-dashboard-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavComponent, AnimatedButtonComponent, LoadingScreenComponent, ImageCropperComponent, SelectComponent],
  templateUrl: './dashboard-settings.component.html',
  styleUrl: './dashboard-settings.component.scss',
})
export class DashboardSettingsComponent implements OnInit {
  auth = inject(AuthService);
  setup = inject(CreatorSetupService);
  api = inject(ApiService);
  private profileService = inject(ProfileService);
  private countryService = inject(CountryService);
  private categoryService = inject(CategoryService);

  countries = signal<Country[]>([]);
  categories = signal<Category[]>([]);
  categorySlugs = signal<string[]>([]);
  customFields = signal<Record<string, string>>({});
  loading = signal(true);
  saving = signal(false);
  uploadingPhoto = signal(false);
  pendingPhoto = signal<File | null>(null);
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
    showNumbersPublic: false,
    gender: '',
    age: null as number | null,
    availability: 'available',
    studioAccess: false,
    isPublic: true,
    profilePhotoUrl: '',
    categorySlugs: [] as string[],
  };

  talentCategoryOptions = computed(() =>
    this.categories()
      .filter((c) => c.slug !== 'brand-client')
      .map((c) => ({ value: c.slug, label: c.name })),
  );

  countryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.countries().map((c) => ({ value: c.name, label: c.name })), 'Select country'),
  );

  availabilityOptions: SelectOption[] = [
    { value: 'available', label: 'Available Now' },
    { value: 'busy', label: 'Busy' },
    { value: 'booked', label: 'Booked' },
  ];

  genderOptions: SelectOption[] = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ];

  selectedCategoryFields = computed<CategoryField[]>(() => {
    const slugs = this.categorySlugs();
    if (!slugs.length) return [];
    const byKey = new Map<string, CategoryField>();
    for (const slug of slugs) {
      const cat = this.categories().find((c) => c.slug === slug);
      for (const field of sortCategoryFields(cat?.fields)) {
        if (!byKey.has(field.field_key)) byKey.set(field.field_key, field);
      }
    }
    return [...byKey.values()];
  });

  get isBrand(): boolean {
    return (
      this.auth.user()?.role === 'brand' ||
      this.form.categorySlugs?.includes('brand-client')
    );
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
            showNumbersPublic: !!p.show_numbers_public,
            gender: toGenderValue(p.gender),
            age: p.age ?? null,
            availability: p.availability || 'available',
            studioAccess: !!p.studio_access,
            isPublic: p.is_public ?? true,
            profilePhotoUrl: p.profile_photo_url || '',
            categorySlugs:
              p.category_slugs?.length
                ? [...p.category_slugs]
                : p.category_slug
                  ? [p.category_slug]
                  : [],
          };
          this.categorySlugs.set([...(this.form.categorySlugs || [])]);
          this.customFields.set({ ...(p.custom_fields || {}) });
        }
        this.loading.set(false);
      });
  }

  isCategorySelected(slug: string): boolean {
    return (this.form.categorySlugs || []).includes(slug);
  }

  toggleCategory(slug: string, checked: boolean): void {
    const current = new Set(this.form.categorySlugs || []);
    if (checked) current.add(slug);
    else current.delete(slug);
    this.form.categorySlugs = [...current];
    this.onCategoryChange();
  }

  onCategoryChange(): void {
    this.categorySlugs.set([...(this.form.categorySlugs || [])]);
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
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    this.error.set('');
    this.saved.set(false);
    this.pendingPhoto.set(file);
  }

  closePhotoCropper(): void {
    this.pendingPhoto.set(null);
  }

  onPhotoCropped(file: File): void {
    this.pendingPhoto.set(null);
    this.uploadingPhoto.set(true);
    this.error.set('');
    this.saved.set(false);

    this.profileService.uploadPhoto(file).subscribe({
      next: (media) => {
        this.form.profilePhotoUrl = media.profile_photo_url || media.url;
        this.auth.updateStoredUser({ profile_photo_url: this.form.profilePhotoUrl });
        this.uploadingPhoto.set(false);
        this.saved.set(true);
      },
      error: (err) => {
        this.uploadingPhoto.set(false);
        this.error.set(err?.error?.error || 'Could not upload photo. Try a smaller image.');
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

    if (!this.form.categorySlugs?.length) {
      this.error.set('Please choose at least one category.');
      this.saving.set(false);
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
        show_numbers_public: !!this.form.showNumbersPublic,
        gender: this.form.gender || null,
        age: ageNumber,
        availability: this.form.availability,
        studio_access: !!this.form.studioAccess,
        is_public: this.auth.isPending() ? false : this.form.isPublic,
        profile_photo_url: this.form.profilePhotoUrl,
        categorySlugs: this.form.categorySlugs,
        categorySlug: this.form.categorySlugs[0],
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
