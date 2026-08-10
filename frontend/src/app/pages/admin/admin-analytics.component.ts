import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { AnalyticsService } from '../../core/services/analytics.service';
import { AdminAnalytics } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, LoadingScreenComponent],
  templateUrl: './admin-analytics.component.html',
  styleUrl: './admin-analytics.component.scss',
})
export class AdminAnalyticsComponent implements OnInit {
  private analytics = inject(AnalyticsService);

  data = signal<AdminAnalytics | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.analytics.getAdminDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.data.set(res);
        this.loading.set(false);
      });
  }

  maxViews(): number {
    return Math.max(1, ...(this.data()?.popularPages.map((p) => p.views) || [1]));
  }

  eventTypeCounts(): Array<{ type: string; count: number }> {
    const activity = this.data()?.recentActivity || [];
    const map = new Map<string, number>();
    for (const a of activity) map.set(a.event_type, (map.get(a.event_type) || 0) + 1);
    return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
  }
}
