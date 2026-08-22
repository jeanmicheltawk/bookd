import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { CmsService } from '../../core/services/cms.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { CategoryService } from '../../core/services/category.service';
import { TestimonialService } from '../../core/services/testimonial.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { Announcement, Category, HeroSlide, Testimonial } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { ProfileCardComponent, ProfileCardData } from '../../shared/components/profile-card/profile-card.component';

const FALLBACK_SLIDES: HeroSlide[] = [
  { title: "BOOK AND GET BOOK'D", subtitle: 'The bold new home for creative talent & the brands who need them.' },
  { title: 'DISCOVER YOUR NEXT MUSE', subtitle: 'Models, talents, photographers, stylists — all in one neon-lit haus.' },
  { title: 'GET SEEN. GET BOOK\'D.', subtitle: 'Build a portfolio that pops and let opportunity find you.' },
];

const VALUES = [
  { icon: '01', title: 'BOLD BY DEFAULT', copy: 'We don\'t do beige. Every profile, every booking, every pixel is built to stand out.' },
  { icon: '02', title: 'REAL CONNECTIONS', copy: 'Direct messaging, transparent negotiation, zero gatekeeping between talent and brands.' },
  { icon: '03', title: 'BUILT TO GROW', copy: 'Performance scoring, spotlight features, and challenges that get you discovered faster.' },
  { icon: '04', title: 'SAFE & VERIFIED', copy: 'Verified badges, moderated announcements, and a team that actually reads your reports.' },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, AnimatedButtonComponent, ProfileCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private cms = inject(CmsService);
  private announcementService = inject(AnnouncementService);
  private categoryService = inject(CategoryService);
  private testimonialService = inject(TestimonialService);
  private analytics = inject(AnalyticsService);

  values = VALUES;

  slides = signal<HeroSlide[]>(FALLBACK_SLIDES);
  activeSlide = signal(0);
  private rotateHandle?: ReturnType<typeof setInterval>;

  spotlight = signal<ProfileCardData[]>([]);
  announcements = signal<Announcement[]>([]);
  categories = signal<Category[]>([]);
  testimonials = signal<Testimonial[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.analytics.trackPageview('/');

    this.cms.getHeroSlides()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        if (res.data?.length) this.slides.set(res.data);
        this.startRotation();
      });
    this.startRotation();

    this.cms.getSpotlight()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => this.spotlight.set(res.data as ProfileCardData[]));

    this.announcementService.list({ limit: 3 })
      .pipe(catchError(() => of({ data: [], pagination: { page: 1, limit: 3, total: 0, totalPages: 0 } })))
      .subscribe((res) => this.announcements.set(res.data));

    this.categoryService.list({ searchable: true })
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.categories.set(res.data);
        this.loading.set(false);
      });

    this.testimonialService.listPublished()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => this.testimonials.set(res.data));
  }

  ngOnDestroy(): void {
    if (this.rotateHandle) clearInterval(this.rotateHandle);
  }

  private startRotation(): void {
    if (this.rotateHandle) clearInterval(this.rotateHandle);
    this.rotateHandle = setInterval(() => {
      this.activeSlide.update((i) => (i + 1) % this.slides().length);
    }, 5500);
  }

  goToSlide(i: number): void {
    this.activeSlide.set(i);
    this.startRotation();
  }

  categoryIcon(slug: string): string {
    const map: Record<string, string> = {
      models: 'MD', talents: 'TL', photographers: 'PH', videographers: 'VD',
      directors: 'DR', 'creative-directors': 'CD', 'art-directors': 'AD',
      'makeup-artists': 'MU', 'hair-stylists': 'HS', 'makeup-hair': 'MH',
      stylists: 'ST', 'content-creators': 'CC', 'brand-client': 'BR',
    };
    return map[slug] || 'BK';
  }
}
