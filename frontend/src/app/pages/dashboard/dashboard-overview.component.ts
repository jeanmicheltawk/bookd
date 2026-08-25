import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { DashboardService } from '../../core/services/dashboard.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardSummary, SubscriptionInfo, WhishPaymentInstructions } from '../../core/models';
import { DashboardNavComponent } from './dashboard-nav.component';
import { LoadingScreenComponent } from '../../shared/components/loading-screen/loading-screen.component';
import { AnimatedButtonComponent } from '../../shared/components/animated-button/animated-button.component';
import { WhishPayInstructionsComponent } from '../../shared/components/whish-pay-instructions/whish-pay-instructions.component';
import { formatSubDate, subscriptionStatusLabel } from '../../core/utils/subscription';

@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardNavComponent, LoadingScreenComponent, AnimatedButtonComponent, WhishPayInstructionsComponent],
  templateUrl: './dashboard-overview.component.html',
  styleUrl: './dashboard-overview.component.scss',
})
export class DashboardOverviewComponent implements OnInit {
  private dashboardService = inject(DashboardService);
  private alerts = inject(AlertService);
  auth = inject(AuthService);

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);
  ending = signal(false);
  endError = signal('');
  subscription = computed(() => this.summary()?.subscription || this.alerts.alerts().subscription || null);
  payment = computed<WhishPaymentInstructions | null>(() => this.summary()?.payment || null);

  ngOnInit(): void {
    if (this.auth.isPending()) {
      this.auth.me().pipe(catchError(() => of(null))).subscribe(() => {
        if (!this.auth.isPending()) this.loadSummary();
      });
    }
    this.loadSummary();
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.dashboardService.getMine()
      .pipe(catchError(() => of(null)))
      .subscribe((res) => {
        this.summary.set(res);
        this.alerts.apply(res?.alerts);
        this.loading.set(false);
      });
  }

  pendingPlanLabel(): string {
    return this.auth.user()?.membership === 'premium' ? 'Premium' : 'Starter';
  }

  statusLabel(sub: SubscriptionInfo): string {
    return subscriptionStatusLabel(sub.status);
  }

  formatDate(value: string | null): string {
    return formatSubDate(value);
  }

  endTrial(): void {
    if (this.ending()) return;
    if (!confirm('End your 7-day free trial? Your profile will no longer be public.')) return;

    this.ending.set(true);
    this.endError.set('');
    this.dashboardService.endSubscription().subscribe({
      next: (sub) => {
        this.ending.set(false);
        this.summary.update((current) => current ? { ...current, subscription: sub } : current);
        this.alerts.apply({
          unreadMessages: this.alerts.alerts().unreadMessages,
          newBookings: this.alerts.alerts().newBookings,
          bookingUpdates: this.alerts.alerts().bookingUpdates,
          subscription: sub,
        });
        this.auth.updateStoredUser({
          subscription: sub,
          effective_membership: 'free',
          membership_ends_at: sub.ends_at,
          membership_trial_ends_at: sub.trial_ends_at,
        });
      },
      error: (err) => {
        this.ending.set(false);
        this.endError.set(err?.error?.error || 'Could not end your trial.');
      },
    });
  }
}
