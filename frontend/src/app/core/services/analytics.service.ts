import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { AdminAnalytics } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private api = inject(ApiService);

  /** Fire-and-forget pageview tracking; failures are swallowed intentionally. */
  trackPageview(path: string, profileId?: string, metadata?: Record<string, unknown>): void {
    this.api.post('/analytics/track', { path, profileId, metadata })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  getAdminDashboard(): Observable<AdminAnalytics> {
    return this.api.get<AdminAnalytics>('/admin/analytics');
  }
}
