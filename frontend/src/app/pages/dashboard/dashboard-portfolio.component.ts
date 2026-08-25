import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService } from '../../core/services/profile.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PortfolioItem } from '../../core/models';
import { portfolioLimitFor, PREMIUM_PORTFOLIO_LIMIT } from '../../core/utils/portfolio-limit';
import { effectiveMembership } from '../../core/utils/subscription';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { PortfolioLightboxComponent } from '../../shared/components/portfolio-lightbox/portfolio-lightbox.component';

@Component({
  selector: 'app-dashboard-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DashboardNavComponent, LoadingScreenComponent, PortfolioLightboxComponent],
  templateUrl: './dashboard-portfolio.component.html',
  styleUrl: './dashboard-portfolio.component.scss',
})
export class DashboardPortfolioComponent implements OnInit {
  private profileService = inject(ProfileService);
  api = inject(ApiService);
  auth = inject(AuthService);

  items = signal<PortfolioItem[]>([]);
  loading = signal(true);
  uploading = signal(false);
  uploadError = signal('');
  lightboxIndex = signal<number | null>(null);
  newTitle = '';

  limit = computed(() => portfolioLimitFor(effectiveMembership(this.auth.user())));
  atLimit = computed(() => this.items().length >= this.limit());
  isPremium = computed(() => effectiveMembership(this.auth.user()) === 'premium');
  premiumLimit = PREMIUM_PORTFOLIO_LIMIT;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.profileService.listMyPortfolio()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        this.items.set(res.data);
        this.loading.set(false);
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.atLimit()) {
      this.uploadError.set(this.limitError());
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.uploadError.set('');

    this.profileService.uploadPortfolio(file, this.newTitle).subscribe({
      next: (item) => {
        this.items.update((list) => [item, ...list]);
        this.newTitle = '';
        this.uploading.set(false);
        input.value = '';
      },
      error: (err) => {
        this.uploading.set(false);
        input.value = '';
        this.uploadError.set(err?.error?.error || 'Could not upload. Try an image or video under 25MB.');
      },
    });
  }

  limitError(): string {
    if (this.isPremium()) {
      return `Premium plan allows up to ${this.limit()} portfolio images.`;
    }
    return `Starter plan allows ${this.limit()} portfolio images. Upgrade to Premium plan for ${PREMIUM_PORTFOLIO_LIMIT}.`;
  }

  openLightbox(index: number): void {
    this.lightboxIndex.set(index);
  }

  remove(item: PortfolioItem): void {
    this.profileService.deletePortfolioItem(item.id).subscribe(() => {
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.lightboxIndex.set(null);
    });
  }
}
