import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';

@Injectable({ providedIn: 'root' })
export class CreatorSetupService {
  private auth = inject(AuthService);
  private profiles = inject(ProfileService);

  readonly portfolioCount = signal<number | null>(null);

  readonly hasPhoto = computed(() => {
    const url = this.auth.user()?.profile_photo_url;
    return typeof url === 'string' && url.trim().length > 0;
  });

  readonly hasPortfolio = computed(() => (this.portfolioCount() ?? 0) > 0);
  readonly loaded = computed(() => this.portfolioCount() !== null);

  readonly isMissing = computed(() => {
    if (!this.auth.isPending() || this.auth.isBrand() || !this.loaded()) return false;
    return !this.hasPortfolio() || !this.hasPhoto();
  });

  readonly isReady = computed(() => {
    if (!this.auth.isPending() || this.auth.isBrand() || !this.loaded()) return false;
    return this.hasPortfolio() && this.hasPhoto();
  });

  refresh(): void {
    if (!this.auth.isAuthenticated() || !this.auth.isPending() || this.auth.isBrand()) return;

    this.profiles.getMine().pipe(catchError(() => of(null))).subscribe((profile) => {
      const url = profile?.profile_photo_url;
      if (typeof url === 'string' && url.trim()) {
        this.auth.updateStoredUser({ profile_photo_url: url });
      }
    });

    this.profiles.listMyPortfolio().pipe(catchError(() => of({ data: [] }))).subscribe((res) => {
      this.portfolioCount.set(res.data?.length || 0);
    });
  }

  setPortfolioCount(count: number): void {
    this.portfolioCount.set(count);
  }
}
