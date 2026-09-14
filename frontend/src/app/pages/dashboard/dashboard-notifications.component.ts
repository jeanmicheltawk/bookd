import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { DashboardService } from '../../core/services/dashboard.service';
import { AlertService } from '../../core/services/alert.service';
import { DashboardNotification } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardNavComponent, LoadingScreenComponent],
  templateUrl: './dashboard-notifications.component.html',
  styleUrl: './dashboard-notifications.component.scss',
})
export class DashboardNotificationsComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private alerts = inject(AlertService);

  notifications = signal<DashboardNotification[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.dashboardService
      .listNotifications()
      .pipe(catchError(() => of({ data: [] as DashboardNotification[] })))
      .subscribe((res) => {
        this.notifications.set(res.data);
        this.loading.set(false);
        if (res.data.some((n) => !n.is_read)) this.markOpenedRead();
      });
  }

  private markOpenedRead(): void {
    this.dashboardService
      .markNotificationsRead()
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.alerts.refresh());
  }
}
