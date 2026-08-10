import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PortfolioItem, Profile } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private api = inject(ApiService);

  getPublic(idOrSlug: string): Observable<Profile> {
    return this.api.get<Profile>(`/profiles/${idOrSlug}`);
  }

  getMine(): Observable<Profile> {
    return this.api.get<Profile>('/profiles/me');
  }

  updateMine(payload: Partial<Profile> & { categorySlug?: string }): Observable<Profile> {
    return this.api.patch<Profile>('/profiles/me', payload);
  }

  listMyPortfolio(): Observable<{ data: PortfolioItem[] }> {
    return this.api.get('/profiles/me/portfolio');
  }

  addPortfolioItem(payload: Partial<PortfolioItem> & { url: string; mediaType?: string }): Observable<PortfolioItem> {
    return this.api.post('/profiles/me/portfolio', payload);
  }

  updatePortfolioItem(id: string, payload: Partial<PortfolioItem>): Observable<PortfolioItem> {
    return this.api.patch(`/profiles/me/portfolio/${id}`, payload);
  }

  deletePortfolioItem(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/profiles/me/portfolio/${id}`);
  }
}
