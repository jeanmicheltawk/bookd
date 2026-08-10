import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ContactMessage, Paginated } from '../models';
import { ApiService, QueryParams } from './api.service';

export interface ContactPayload {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private api = inject(ApiService);

  send(payload: ContactPayload): Observable<ContactMessage> {
    return this.api.post('/contact', payload);
  }

  list(params?: QueryParams): Observable<Paginated<ContactMessage>> {
    return this.api.get('/contact', params);
  }

  updateStatus(id: string, status: ContactMessage['status'], adminNotes?: string): Observable<ContactMessage> {
    return this.api.patch(`/contact/${id}`, { status, adminNotes });
  }

  delete(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/contact/${id}`);
  }

  exportCsv(): Observable<Blob> {
    return this.api.getBlob('/contact/export/csv');
  }
}
