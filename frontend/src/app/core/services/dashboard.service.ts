import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardSummary } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  getMine(): Observable<DashboardSummary> {
    return this.api.get('/dashboard/me');
  }
}
