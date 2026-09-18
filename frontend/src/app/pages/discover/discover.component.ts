import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SearchService } from '../../core/services/search.service';
import { CategoryService } from '../../core/services/category.service';
import { CountryService } from '../../core/services/country.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { CreativesOnBoardService } from '../../core/services/creatives-on-board.service';
import { Category, Country, SearchResult, Announcement, CreativesOnBoardItem } from '../../core/models';
import { ProfileCardComponent } from '../../shared/components/profile-card/profile-card.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { SelectComponent, SelectOption, selectOptions } from '../../shared/components/select/select.component';
import { NewsTickerComponent } from '../../shared/components/news-ticker/news-ticker.component';
import { toGenderValue } from '../../core/utils/gender';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProfileCardComponent, LoadingScreenComponent, SelectComponent, NewsTickerComponent],
  templateUrl: './discover.component.html',
  styleUrl: './discover.component.scss',
})
export class DiscoverComponent implements OnInit, AfterViewInit, OnDestroy {
  private searchService = inject(SearchService);
  private categoryService = inject(CategoryService);
  private countryService = inject(CountryService);
  private analytics = inject(AnalyticsService);
  private announcementService = inject(AnnouncementService);
  private onBoardService = inject(CreativesOnBoardService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('loadMoreSentinel') loadMoreSentinel?: ElementRef<HTMLElement>;
  @ViewChild('onBoardScroller') onBoardScroller?: ElementRef<HTMLElement>;
  @ViewChild('announcementScroller') announcementScroller?: ElementRef<HTMLElement>;

  categories = signal<Category[]>([]);
  countries = signal<Country[]>([]);
  results = signal<SearchResult[]>([]);
  announcements = signal<Announcement[]>([]);
  onBoard = signal<CreativesOnBoardItem[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  total = signal(0);
  page = signal(1);
  showFeatured = signal(true);

  hasMore = computed(() => this.results().length < this.total());

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

  private observer?: IntersectionObserver;
  private searchSeq = 0;
  private shuffleSeed = '';

  get isModelsOrTalents(): boolean {
    return ['models', 'talents'].includes(this.filters.category);
  }

  ngOnInit(): void {
    this.categoryService.list({ searchable: true }).pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.categories.set(res.data));
    this.countryService.list().pipe(catchError(() => of({ data: [] }))).subscribe((res) => this.countries.set(res.data));
    this.announcementService.list({ limit: 12 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } })))
      .subscribe((res) => this.announcements.set(res.data));
    this.onBoardService.list()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => this.onBoard.set(res.data));

    this.route.queryParamMap.subscribe((params) => {
      this.filters.category = params.get('category') || '';
      this.filters.country = params.get('country') || '';
      this.filters.availability = params.get('availability') || '';
      this.filters.verified = params.get('verified') === 'true';
      this.filters.gender = toGenderValue(params.get('gender'));
      this.page.set(1);
      const featured = this.isFeaturedView(params.get('view'));
      this.showFeatured.set(featured);
      if (featured) {
        this.results.set([]);
        this.total.set(0);
        this.loading.set(false);
        this.loadingMore.set(false);
        return;
      }
      this.runSearch(false);
      setTimeout(() => this.observeSentinel());
    });
  }

  ngAfterViewInit(): void {
    this.observeSentinel();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  applyFilters(): void {
    this.syncUrl();
  }

  scrollOnBoard(direction: number): void {
    this.onBoardScroller?.nativeElement.scrollBy({ left: direction * 234, behavior: 'smooth' });
  }

  scrollAnnouncements(direction: number): void {
    this.announcementScroller?.nativeElement.scrollBy({ left: direction * 320, behavior: 'smooth' });
  }

  private observeSentinel(): void {
    this.observer?.disconnect();
    const el = this.loadMoreSentinel?.nativeElement;
    if (!el) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.loadNextPage();
      },
      { root: null, rootMargin: '800px 0px', threshold: 0 },
    );
    this.observer.observe(el);
  }

  private isFeaturedView(view?: string | null): boolean {
    const path = this.router.url.split('?')[0];
    if (path === '/search') return false;
    if (view === 'all') return false;
    return !this.filters.category
      && !this.filters.country
      && !this.filters.availability
      && !this.filters.verified
      && !this.filters.gender;
  }

  clearFilters(): void {
    this.filters = { category: '', country: '', availability: '', verified: false, gender: '' };
    this.applyFilters();
  }

  private createShuffleSeed(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  private loadNextPage(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore()) return;
    this.page.update((p) => p + 1);
    this.runSearch(true);
  }

  private loadNextIfVisible(): void {
    const el = this.loadMoreSentinel?.nativeElement;
    if (!el || this.loading() || this.loadingMore() || !this.hasMore()) return;
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 800) this.loadNextPage();
  }

  private syncUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: this.filters.category ? null : 'all',
        category: this.filters.category || null,
        country: this.filters.country || null,
        availability: this.filters.availability || null,
        verified: this.filters.verified ? 'true' : null,
        gender: this.isModelsOrTalents && this.filters.gender ? this.filters.gender : null,
        page: null,
        q: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  private runSearch(append: boolean): void {
    const seq = ++this.searchSeq;
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.shuffleSeed = this.createShuffleSeed();
      this.loading.set(true);
      this.results.set([]);
      this.analytics.trackPageview('/discover', undefined, {
        category: this.filters.category,
        country: this.filters.country,
      });
    }

    this.searchService
      .search({
        category: this.filters.category,
        country: this.filters.country,
        availability: this.filters.availability,
        verified: this.filters.verified || undefined,
        gender: this.isModelsOrTalents ? this.filters.gender : undefined,
        page: this.page(),
        limit: PAGE_SIZE,
        seed: this.shuffleSeed,
      })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 } })))
      .subscribe((res) => {
        if (seq !== this.searchSeq) return;
        this.results.update((list) => (append ? [...list, ...res.data] : res.data));
        this.total.set(res.pagination.total);
        this.loading.set(false);
        this.loadingMore.set(false);
        setTimeout(() => this.loadNextIfVisible());
      });
  }
}
