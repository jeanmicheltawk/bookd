import { Injectable, inject } from '@angular/core';
import { ApprovalStatus } from '../models';
import { ApiService, QueryParams } from './api.service';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  membership: string;
  is_verified: boolean;
  is_active: boolean;
  approval_status: ApprovalStatus;
  approval_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  last_login_at?: string | null;
  profile_id?: string;
  full_name?: string;
  professional_name?: string;
  country?: string;
  city?: string;
  bio?: string;
  instagram?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  gender?: string;
  age?: number | null;
  profile_photo_url?: string;
  is_public?: boolean;
  availability?: string;
  category_slug?: string;
  category_name?: string;
  custom_fields?: Record<string, string>;
}

export type AdminUserUpdatePayload = Partial<{
  role: string;
  membership: string;
  is_verified: boolean;
  is_active: boolean;
  approval_status: ApprovalStatus;
  approval_note: string | null;
  email: string;
  full_name: string;
  professional_name: string;
  country: string | null;
  city: string | null;
  bio: string | null;
  instagram: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  gender: string | null;
  age: number | null;
  categorySlug: string | null;
  custom_fields: Record<string, string>;
  availability: string | null;
}>;

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private api = inject(ApiService);

  list(params?: QueryParams) {
    return this.api.get<{ data: AdminUser[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/admin/users',
      params,
    );
  }

  get(id: string) {
    return this.api.get<AdminUser>(`/admin/users/${id}`);
  }

  update(id: string, payload: AdminUserUpdatePayload) {
    return this.api.patch<AdminUser>(`/admin/users/${id}`, payload);
  }

  delete(id: string) {
    return this.api.delete<{ deleted: boolean; id: string; email: string }>(`/admin/users/${id}`);
  }

  listClients(params?: QueryParams) {
    return this.list({ ...params, role: 'brand' });
  }

  exportClientsExcel() {
    return this.api.getBlob('/admin/clients/export');
  }
}
