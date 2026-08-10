import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

function toHttpParams(params?: QueryParams): HttpParams {
  let httpParams = new HttpParams();
  if (!params) return httpParams;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}

/**
 * Thin HttpClient wrapper centralizing the API base URL so feature services
 * never hardcode `environment.apiUrl` themselves.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(`${this.base}${path}`, { params: toHttpParams(params) });
  }

  getBlob(path: string, params?: QueryParams): Observable<Blob> {
    return this.http.get(`${this.base}${path}`, { params: toHttpParams(params), responseType: 'blob' });
  }

  post<T>(path: string, body: unknown = {}, params?: QueryParams): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body, { params: toHttpParams(params) });
  }

  put<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`);
  }

  /** For multipart/form-data uploads (media library, avatars, etc). */
  postForm<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, formData);
  }

  putForm<T>(path: string, formData: FormData): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, formData);
  }

  /** Absolute URL builder for uploaded assets served outside /api (e.g. /uploads/...). */
  assetUrl(path?: string | null): string {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const origin = this.base.replace(/\/api\/?$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  }
}
