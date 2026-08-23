import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { PortfolioItem, Profile } from '../../core/models';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { PortfolioLightboxComponent } from '../../shared/components/portfolio-lightbox/portfolio-lightbox.component';

@Component({
  selector: 'app-profile-public',
  standalone: true,
  imports: [CommonModule, RouterLink, AnimatedButtonComponent, LoadingScreenComponent, PortfolioLightboxComponent],
  templateUrl: './profile-public.component.html',
  styleUrl: './profile-public.component.scss',
})
export class ProfilePublicComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private analytics = inject(AnalyticsService);
  auth = inject(AuthService);
  api = inject(ApiService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  notFound = signal(false);
  lightboxIndex = signal<number | null>(null);

  ngOnInit(): void {
    const idOrSlug = this.route.snapshot.paramMap.get('id')!;
    this.profileService.getPublic(idOrSlug)
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        if (!res) {
          this.notFound.set(true);
        } else {
          this.profile.set(res);
          this.analytics.trackPageview(`/profile/${idOrSlug}`, res.id);
        }
        this.loading.set(false);
      });
  }

  photo(url?: string): string {
    return this.api.assetUrl(url);
  }

  portfolioItems(): PortfolioItem[] {
    return this.profile()?.portfolio || [];
  }

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
  }

  phoneHref(phone: string): string {
    return `tel:${String(phone).replace(/[^\d+]/g, '')}`;
  }

  whatsappHref(whatsapp: string): string {
    const digits = String(whatsapp).replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  }

  instagramHref(handle: string): string {
    const value = String(handle).trim();
    if (/^https?:\/\//i.test(value)) return value;
    const slug = value.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
    return `https://instagram.com/${slug}`;
  }

  instagramHandle(handle: string): string {
    const value = String(handle).trim();
    if (/^https?:\/\//i.test(value)) {
      const slug = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
      return slug ? `@${slug}` : value;
    }
    return value.startsWith('@') ? value : `@${value}`;
  }

  bookNow(): void {
    const p = this.profile();
    if (!p) return;
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/auth/signup'], {
        queryParams: { role: 'brand', redirect: `/book/${p.id}` },
      });
      return;
    }
    this.router.navigate(['/book', p.id]);
  }

  messageNow(): void {
    const p = this.profile();
    if (!p) return;
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    this.router.navigate(['/dashboard/messages'], { queryParams: { with: p.user_id || p.id } });
  }
}
