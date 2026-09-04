import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Category, CategoryField, CategoryFieldType } from '../models';
import { ApiService, QueryParams } from './api.service';

export interface CategoryPayload {
  name: string;
  slug?: string;
  is_searchable?: boolean;
  sort_order?: number;
}

export interface CategoryFieldPayload {
  label: string;
  field_key?: string;
  field_type?: CategoryFieldType;
  options?: string[];
  is_required?: boolean;
  sort_order?: number;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private api = inject(ApiService);

  list(params?: QueryParams): Observable<{ data: Category[] }> {
    return this.api.get('/categories', params);
  }

  create(payload: CategoryPayload): Observable<Category> {
    return this.api.post('/admin/categories', payload);
  }

  update(id: string, payload: Partial<CategoryPayload>): Observable<Category> {
    return this.api.patch(`/admin/categories/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean; id: string; slug: string; name: string }> {
    return this.api.delete(`/admin/categories/${id}`);
  }

  createField(categoryId: string, payload: CategoryFieldPayload): Observable<CategoryField> {
    return this.api.post(`/admin/categories/${categoryId}/fields`, payload);
  }

  updateField(
    categoryId: string,
    fieldId: string,
    payload: Partial<CategoryFieldPayload>,
  ): Observable<CategoryField> {
    return this.api.patch(`/admin/categories/${categoryId}/fields/${fieldId}`, payload);
  }

  deleteField(categoryId: string, fieldId: string): Observable<{ deleted: boolean; id: string }> {
    return this.api.delete(`/admin/categories/${categoryId}/fields/${fieldId}`);
  }

  reorderFields(categoryId: string, fieldIds: string[]): Observable<{ data: CategoryField[] }> {
    return this.api.put(`/admin/categories/${categoryId}/fields/reorder`, { fieldIds });
  }
}

export function sortCategoryFields(fields?: CategoryField[] | null): CategoryField[] {
  return [...(fields || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label),
  );
}
