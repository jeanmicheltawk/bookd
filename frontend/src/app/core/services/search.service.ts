import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Paginated, SearchResult } from '../models';
import { ApiService, QueryParams } from './api.service';

export interface SearchFilters extends QueryParams {
  q?: string;
  category?: string;
  country?: string;
  availability?: string;
  verified?: boolean;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private api = inject(ApiService);

  search(filters: SearchFilters): Observable<Paginated<SearchResult>> {
    return this.api.get('/search', filters);
  }
}
