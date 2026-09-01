import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SearchService } from '../../core/services/search.service';
import { CategoryService } from '../../core/services/category.service';
import { CountryService } from '../../core/services/country.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { Category, Country, SearchResult } from '../../core/models';
import { ProfileCardComponent } from '../../shared/components/profile-card/profile-card.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';
import { toGenderValue } from '../../core/utils/gender';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, FormsModule, ProfileCardComponent, LoadingScreenComponent, SelectComponent],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss',
})
export class DiscoverComponent implements OnInit {
  private searchService = inject(SearchService);
  private categoryService = inject(CategoryService);
  private countryService = inject(CountryService);
  private analytics = inject(AnalyticsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  categories = signal<Category[]>([]);
  countries = signal<Country[]>([]);
  results = signal<SearchResult[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);

  filters = {
    category: '',
    country: '',
    availability: '',
    verified: false,
    gender: '',
  };

  categoryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.categories().map((c) => ({ value: c.slug, label: c.name })), 'All Categories'),
  );

  countryOptions = computed<SelectOption[]>(() =>
    selectOptions(this.countries().map((c) => ({ value: c.name, label: c.name })), 'All Countries'),
  );

  availabilityOptions: SelectOption[] = [
    { value: '', label: 'Any Availability' },
    { value: 'available', label: 'Available Now' },
    { value: 'busy', label: 'Busy' },
    { value: 'booked', label: 'Booked' },
  ];

  genderOptions: SelectOption[] = [
    { value: '', label: 'Any Gender' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
  ];

  get isModelsOrTalents(): boolean {
    return ['models', 'talents'].includes(this.filters.category);
  }

  ngOnInit(): void {
    this.categoryService.list({ searchable: true }).pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.categories.set(res.data));
    this.countryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.countries.set(res.data));

    this.route.queryParamMap.subscribe((params) => {
      this.filters.category = params.get('category') || '';
      this.filters.country = params.get('country') || '';
      this.filters.availability = params.get('availability') || '';
      this.filters.verified = params.get('verified') === 'true';
      this.filters.gender = toGenderValue(params.get('gender'));
      this.page.set(Number(params.get('page')) || 1);
      this.runSearch();
    });
  }

  applyFilters(): void {
    this.page.set(1);
    this.syncUrl();
  }

  clearFilters(): void {
    this.filters = { category: '', country: '', availability: '', verified: false, gender: '' };
    this.applyFilters();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.syncUrl();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.filters.category || null,
        country: this.filters.country || null,
        availability: this.filters.availability || null,
        verified: this.filters.verified ? 'true' : null,
        gender: this.isModelsOrTalents && this.filters.gender ? this.filters.gender : null,
        page: this.page() > 1 ? this.page() : null,
        q: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private runSearch(): void {
    this.loading.set(true);
    this.analytics.trackPageview('/discover', undefined, {
      category: this.filters.category,
      country: this.filters.country,
    });

    this.searchService
      .search({
        category: this.filters.category,
        country: this.filters.country,
        availability: this.filters.availability,
        verified: this.filters.verified || undefined,
        gender: this.isModelsOrTalents ? this.filters.gender : undefined,
        page: this.page(),
        limit: 24,
      })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        this.results.set(res.data);
        this.total.set(res.pagination.total);
        this.totalPages.set(res.pagination.totalPages || 1);
        this.loading.set(false);
      });
  }
}
