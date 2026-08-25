import { Injectable, inject } from '@angular/core';
import { SubscriptionPayment } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminPaymentService {
  private api = inject(ApiService);

  list(params?: QueryParams) {
    return this.api.get<{
      data: SubscriptionPayment[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/admin/payments', params);
  }

  confirm(id: string, review_note?: string) {
    return this.api.post<SubscriptionPayment>(`/admin/payments/${id}/confirm`, { review_note });
  }

  reject(id: string, review_note?: string) {
    return this.api.post<SubscriptionPayment>(`/admin/payments/${id}/reject`, { review_note });
  }
}
