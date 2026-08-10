import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardSummary } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardNavComponent, LoadingScreenComponent, AnimatedButtonComponent],
  templateUrl: './dashboard-overview.component.html',
  styleUrl: './dashboard-overview.component.scss',
})
export class DashboardOverviewComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  auth = inject(AuthService);

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.dashboardService.getMine()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.summary.set(res);
        this.loading.set(false);
      });
  }
}
