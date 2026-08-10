import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Announcement, AnnouncementApplication, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private api = inject(ApiService);

  list(params?: QueryParams): Observable<Paginated<Announcement>> {
    return this.api.get('/announcements', params);
  }

  get(id: string): Observable<Announcement> {
    return this.api.get(`/announcements/${id}`);
  }

  listMine(): Observable<{ data: Announcement[] }> {
    return this.api.get('/announcements/mine');
  }

  create(payload: Partial<Announcement> & { announcementType: string; title: string }): Observable<Announcement> {
    return this.api.post('/announcements', payload);
  }

  apply(id: string, message?: string): Observable<AnnouncementApplication> {
    return this.api.post(`/announcements/${id}/apply`, { message });
  }

  listApplications(id: string): Observable<{ data: AnnouncementApplication[] }> {
    return this.api.get(`/announcements/${id}/applications`);
  }

  listAllAdmin(params?: QueryParams): Observable<Paginated<Announcement>> {
    return this.api.get('/admin/announcements', params);
  }

  moderate(id: string, status: Announcement['status']): Observable<Announcement> {
    return this.api.patch(`/admin/announcements/${id}`, { status });
  }
}
