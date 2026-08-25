import { Injectable, inject } from '@angular/core';
import { WhishPaymentInstructions } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private api = inject(ApiService);

  getWhish() {
    return this.api.get<WhishPaymentInstructions>('/payments/whish');
  }

  submitWhish(payload: { sender_whish_number: string; note?: string }) {
    return this.api.post<WhishPaymentInstructions>('/payments/whish', payload);
  }
}
