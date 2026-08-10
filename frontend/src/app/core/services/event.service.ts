import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EventItem, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class EventService {
  private api = inject(ApiService);

  list(params?: QueryParams): Observable<Paginated<EventItem>> {
    return this.api.get('/events', params);
  }

  get(idOrSlug: string): Observable<EventItem> {
    return this.api.get(`/events/${idOrSlug}`);
  }

  listAllAdmin(): Observable<{ data: EventItem[] }> {
    return this.api.get('/admin/events');
  }

  create(payload: Partial<EventItem>): Observable<EventItem> {
    return this.api.post('/admin/events', payload);
  }

  update(id: string, payload: Partial<EventItem>): Observable<EventItem> {
    return this.api.patch(`/admin/events/${id}`, payload);
  }

  delete(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/admin/events/${id}`);
  }
}
