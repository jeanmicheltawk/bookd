import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardSummary, DashboardNotification, SubscriptionInfo } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  getMine(): Observable<DashboardSummary> {
    return this.api.get('/dashboard/me');
  }

  listNotifications(): Observable<{ data: DashboardNotification[] }> {
    return this.api.get('/dashboard/notifications');
  }

  markNotificationsRead(): Observable<{ success: boolean }> {
    return this.api.post('/dashboard/notifications/read');
  }

  endSubscription(): Observable<SubscriptionInfo> {
    return this.api.post('/dashboard/subscription/end');
  }
}
