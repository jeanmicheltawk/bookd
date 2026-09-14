import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NewsItem } from '../models';
import { ApiService } from './api.service';

export interface NewsPayload {
  title: string;
  body?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
  removeImage?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private api = inject(ApiService);

  list(): Observable<{ data: NewsItem[] }> {
    return this.api.get('/news');
  }

  get(id: string): Observable<NewsItem> {
    return this.api.get(`/news/${id}`);
  }

  listAllAdmin(): Observable<{ data: NewsItem[] }> {
    return this.api.get('/admin/news');
  }

  create(payload: NewsPayload, file?: File | null): Observable<NewsItem> {
    return this.api.postForm('/admin/news', this.toForm(payload, file));
  }

  update(id: string, payload: Partial<NewsPayload>, file?: File | null): Observable<NewsItem> {
    return this.api.patchForm(`/admin/news/${id}`, this.toForm(payload, file));
  }

  delete(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/admin/news/${id}`);
  }

  private toForm(payload: Partial<NewsPayload>, file?: File | null): FormData {
    const form = new FormData();
    if (payload.title !== undefined) form.append('title', payload.title);
    if (payload.body !== undefined) form.append('body', payload.body ?? '');
    if (payload.isPublished !== undefined) form.append('isPublished', String(payload.isPublished));
    if (payload.sortOrder !== undefined) form.append('sortOrder', String(payload.sortOrder));
    if (payload.removeImage) form.append('removeImage', 'true');
    if (file) form.append('file', file);
    return form;
  }
}
