import { Injectable, inject } from '@angular/core';
import { WhishPaymentInstructions } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private api = inject(ApiService);

  getWhish() {
    return this.api.get<WhishPaymentInstructions>('/payments/whish');
  }

  checkout() {
    return this.api.post<WhishPaymentInstructions>('/payments/whish/checkout', {});
  }

  sync() {
    return this.api.post<WhishPaymentInstructions>('/payments/whish/sync', {});
  }
}
