import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Country } from '../models';
import { ApiService } from './api.service';

export interface CountryPayload {
  name: string;
  slug?: string;
  sort_order?: number;
}

@Injectable({ providedIn: 'root' })
export class CountryService {
  private api = inject(ApiService);

  list(): Observable<{ data: Country[] }> {
    return this.api.get('/countries');
  }

  create(payload: CountryPayload): Observable<Country> {
    return this.api.post('/admin/countries', payload);
  }

  update(id: string, payload: Partial<CountryPayload>): Observable<Country> {
    return this.api.patch(`/admin/countries/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean; id: string; slug: string; name: string }> {
    return this.api.delete(`/admin/countries/${id}`);
  }
}
