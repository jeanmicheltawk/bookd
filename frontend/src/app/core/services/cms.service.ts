import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HeroSlide, Page, Section } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CmsService {
  private api = inject(ApiService);

  getAllSettings(): Observable<{ settings: Record<string, any> }> {
    return this.api.get('/cms/settings');
  }

  getSetting(key: string): Observable<{ key: string; value: any; updated_at: string }> {
    return this.api.get(`/cms/settings/${key}`);
  }

  updateSetting(key: string, value: any): Observable<{ key: string; value: any; updated_at: string }> {
    return this.api.put(`/cms/settings/${key}`, { value });
  }

  getPage(slug: string): Observable<Page> {
    return this.api.get<Page>(`/cms/pages/${slug}`);
  }

  updatePage(slug: string, payload: Partial<Page>): Observable<Page> {
    return this.api.put<Page>(`/cms/pages/${slug}`, payload);
  }

  getPageSections(slug: string): Observable<{ data: Section[] }> {
    return this.api.get(`/cms/pages/${slug}/sections`);
  }

  updateSection(id: string, payload: Partial<Section>): Observable<Section> {
    return this.api.put<Section>(`/cms/sections/${id}`, payload);
  }

  getHeroSlides(): Observable<{ data: HeroSlide[] }> {
    return this.api.get('/hero-slides');
  }

  getSpotlight(): Observable<{ data: any[] }> {
    return this.api.get('/spotlight');
  }
}
