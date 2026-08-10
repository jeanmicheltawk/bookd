import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PriceEstimate } from '../models';
import { ApiService } from './api.service';

export interface EstimatePayload {
  categorySlug?: string;
  durationHours?: number;
  durationDays?: number;
  complexity?: 'simple' | 'standard' | 'complex' | 'premium';
  usage?: 'social' | 'web' | 'print' | 'campaign' | 'broadcast';
  teamSize?: number;
  location?: 'local' | 'travel' | 'international';
  deliverables?: string[];
}

@Injectable({ providedIn: 'root' })
export class PricingService {
  private api = inject(ApiService);

  estimate(payload: EstimatePayload): Observable<PriceEstimate> {
    return this.api.post('/pricing/estimate', payload);
  }
}
