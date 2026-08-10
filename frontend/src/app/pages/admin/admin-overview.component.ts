import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AnalyticsService } from '../../core/services/analytics.service';
import { AdminAnalytics } from '../../core/models';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingScreenComponent],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
})
export class AdminOverviewComponent implements OnInit {
  private analytics = inject(AnalyticsService);

  data = signal<AdminAnalytics | null>(null);
  loading = signal(true);

  quickLinks = [
    // FUTURE: { label: 'Edit Content', path: '/admin/content', icon: '✎' },
    { label: 'Update Theme', path: '/admin/theme', icon: '◐' },
    { label: 'Review Contacts', path: '/admin/contacts', icon: '✉' },
    { label: 'Manage Categories', path: '/admin/categories', icon: '☰' },
    { label: 'Manage Countries', path: '/admin/countries', icon: '◎' },
    { label: 'Review Applications', path: '/admin/users', icon: '⌘' },
    // FUTURE: { label: 'Moderate Announcements', path: '/admin/announcements', icon: '📣' },
  ];

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
}
