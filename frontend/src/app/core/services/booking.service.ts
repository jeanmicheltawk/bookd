import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

export interface CreateBookingPayload {
  creativeId: string;
  projectType?: string;
  projectDate?: string;
  location?: string;
  description?: string;
  moodboardUrls?: string[];
  budget?: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private api = inject(ApiService);

  create(payload: CreateBookingPayload): Observable<Booking> {
    return this.api.post('/bookings', payload);
  }

  listMine(params?: QueryParams): Observable<Paginated<Booking>> {
    return this.api.get('/bookings/mine', params);
  }

  get(id: string): Observable<Booking> {
    return this.api.get(`/bookings/${id}`);
  }

  accept(id: string): Observable<Booking> {
    return this.api.post(`/bookings/${id}/accept`);
  }

  decline(id: string): Observable<Booking> {
    return this.api.post(`/bookings/${id}/decline`);
  }

  negotiate(id: string, payload: { quotedPrice?: number; message?: string }): Observable<Booking> {
    return this.api.post(`/bookings/${id}/negotiate`, payload);
  }

  updateStatus(id: string, status: string, quotedPrice?: number): Observable<Booking> {
    return this.api.patch(`/bookings/${id}/status`, { status, quotedPrice });
  }
}
