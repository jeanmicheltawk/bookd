import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Testimonial } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TestimonialService {
  private api = inject(ApiService);

  listPublished(): Observable<{ data: Testimonial[] }> {
    return this.api.get('/testimonials');
  }

  listAllAdmin(): Observable<{ data: Testimonial[] }> {
    return this.api.get('/admin/testimonials');
  }

  create(payload: Partial<Testimonial>): Observable<Testimonial> {
    return this.api.post('/admin/testimonials', payload);
  }

  update(id: string, payload: Partial<Testimonial>): Observable<Testimonial> {
    return this.api.patch(`/admin/testimonials/${id}`, payload);
  }

  delete(id: string): Observable<{ success: boolean; id: string }> {
    return this.api.delete(`/admin/testimonials/${id}`);
  }
}
