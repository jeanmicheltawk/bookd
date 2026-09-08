import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';

import { DashboardAlerts, SubscriptionInfo } from '../models';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { membershipFromSubscription } from '../utils/subscription';

const EMPTY: DashboardAlerts = { unreadMessages: 0, newBookings: 0, bookingUpdates: 0, subscription: null };

@Injectable({ providedIn: 'root' })
export class AlertService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly alerts = signal<DashboardAlerts>(EMPTY);

  refresh(): void {
    if (!this.auth.isAuthenticated() || this.auth.isPending()) {
      this.alerts.set(EMPTY);
      return;
    }
    this.api
      .get<DashboardAlerts>('/dashboard/alerts')
      .pipe(catchError(() => of(EMPTY)))
      .subscribe((res) => this.apply(res));
  }

  apply(alerts?: DashboardAlerts | null): void {
    if (!alerts) return;
    this.alerts.set(alerts);
    this.syncUser(alerts.subscription);
  }

  private syncUser(subscription?: SubscriptionInfo | null): void {
    if (!subscription) return;
    this.auth.updateStoredUser({
      subscription,
      effective_membership: membershipFromSubscription(subscription) ?? 'free',
    });
  }

  markBookingNoticesRead(): void {
    if (!this.auth.isAuthenticated()) return;
    this.api
      .post('/dashboard/notifications/read', { link: '/dashboard/bookings' })
      .pipe(
        tap(() => this.refresh()),
        catchError(() => of(null)),
      )
      .subscribe();
  }
}
