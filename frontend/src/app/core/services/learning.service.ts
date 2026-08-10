import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LearningArticle, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class LearningService {
  private api = inject(ApiService);

  list(params?: QueryParams): Observable<Paginated<LearningArticle>> {
    return this.api.get('/learn', params);
  }

  get(idOrSlug: string): Observable<LearningArticle> {
    return this.api.get(`/learn/${idOrSlug}`);
  }

  listAllAdmin(): Observable<{ data: LearningArticle[] }> {
    return this.api.get('/admin/learn');
  }

  create(payload: Partial<LearningArticle>): Observable<LearningArticle> {
    return this.api.post('/admin/learn', payload);
  }

  update(id: string, payload: Partial<LearningArticle>): Observable<LearningArticle> {
    return this.api.patch(`/admin/learn/${id}`, payload);
  }

  delete(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/admin/learn/${id}`);
  }
}
