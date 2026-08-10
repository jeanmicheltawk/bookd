import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MediaItem, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private api = inject(ApiService);

  list(params?: QueryParams): Observable<Paginated<MediaItem>> {
    return this.api.get('/media', params);
  }

  listFolders(): Observable<{ data: Array<{ folder: string; count: number }> }> {
    return this.api.get('/media/folders');
  }

  get(id: string): Observable<MediaItem> {
    return this.api.get(`/media/${id}`);
  }

  upload(file: File, folder?: string, altText?: string): Observable<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    if (altText) formData.append('altText', altText);
    return this.api.postForm(folder ? `/media?folder=${encodeURIComponent(folder)}` : '/media', formData);
  }

  replace(id: string, file: File, altText?: string): Observable<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (altText) formData.append('altText', altText);
    return this.api.putForm(`/media/${id}`, formData);
  }

  delete(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/media/${id}`);
  }
}
