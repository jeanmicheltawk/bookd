import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';

@Component({
  selector: 'app-dashboard-notifications',
  standalone: true,
  imports: [CommonModule, DashboardNavComponent, LoadingScreenComponent],
  templateUrl: './dashboard-notifications.component.html',
  styleUrl: './dashboard-notifications.component.scss',
})
export class DashboardNotificationsComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  unreadCount = signal(0);
  loading = signal(true);

  ngOnInit(): void {
    this.dashboardService.getMine()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.unreadCount.set(res?.notifications.unread || 0);
        this.loading.set(false);
      });
  }
}
