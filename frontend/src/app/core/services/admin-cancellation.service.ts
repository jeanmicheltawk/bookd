import { Injectable, inject } from '@angular/core';
import { SubscriptionCancellation } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminCancellationService {
  private api = inject(ApiService);

  list(params?: QueryParams) {
    return this.api.get<{
      data: SubscriptionCancellation[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/subscription-cancellations', params);
  }

  setRefund(id: string, refund_done: boolean) {
    return this.api.patch<SubscriptionCancellation>(`/admin/subscription-cancellations/${id}`, { refund_done });
  }
}
