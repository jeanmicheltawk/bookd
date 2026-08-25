import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AnalyticsService } from '../../core/services/analytics.service';
import { ApiService } from '../../core/services/api.service';
import { AdminAnalytics } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

const EMPTY_PROFILES = {
  active: 0,
  total: 0,
  pending: 0,
  premium: 0,
  monthlyAmount: 0,
  activeMemberships: 0,
  pendingPayments: 0,
};

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingScreenComponent],
  templateUrl: './admin-analytics.component.html',
  styleUrl: './admin-analytics.component.scss',
})
export class AdminAnalyticsComponent implements OnInit {
  private analytics = inject(AnalyticsService);
  api = inject(ApiService);

  data = signal<AdminAnalytics | null>(null);
  loading = signal(true);

  profiles = computed(() => this.data()?.profiles ?? EMPTY_PROFILES);
  topProfiles = computed(() => this.data()?.topProfiles ?? []);

  ngOnInit(): void {
    this.analytics.getAdminDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.data.set(res);
        this.loading.set(false);
      });
  }

  maxViews(): number {
    return Math.max(1, ...this.topProfiles().map((p) => p.views), 1);
  }

  profileName(p: AdminAnalytics['topProfiles'][number]): string {
    return p.professional_name || p.full_name || 'Untitled profile';
  }

  profileLink(p: AdminAnalytics['topProfiles'][number]): string {
    return p.custom_url || p.id;
  }
}
