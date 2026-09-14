import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreativesOnBoardItem, SearchResult } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CreativesOnBoardService {
  private api = inject(ApiService);

  list(): Observable<{ data: CreativesOnBoardItem[] }> {
    return this.api.get('/creatives-on-board');
  }

  listAdmin(): Observable<{ data: CreativesOnBoardItem[] }> {
    return this.api.get('/admin/creatives-on-board');
  }

  listCandidates(q?: string): Observable<{ data: SearchResult[] }> {
    return this.api.get('/admin/creatives-on-board/candidates', q ? { q } : undefined);
  }

  add(profileId: string): Observable<CreativesOnBoardItem> {
    return this.api.post('/admin/creatives-on-board', { profileId });
  }

  move(id: string, direction: 'up' | 'down'): Observable<{ success: boolean }> {
    return this.api.patch(`/admin/creatives-on-board/${id}`, { direction });
  }

  remove(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/admin/creatives-on-board/${id}`);
  }
}
