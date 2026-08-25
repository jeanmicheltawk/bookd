import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, Membership, User, WhishPaymentInstructions } from '../models';
import { ApiService } from './api.service';

const ACCESS_TOKEN_KEY = 'bkd_access_token';
const REFRESH_TOKEN_KEY = 'bkd_refresh_token';
const USER_KEY = 'bkd_user';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  professionalName?: string;
  categorySlug?: string;
  role?: 'member' | 'brand';
  membership?: Membership;
  country?: string;
  city?: string;
  bio?: string;
  instagram?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  gender?: string;
  age?: number;
  customFields?: Record<string, string>;
}

export interface RegisterResponse {
  message: string;
  user: Pick<User, 'id' | 'email' | 'role' | 'membership'> & { approval_status: string };
  accessToken?: string;
  refreshToken?: string;
  payment?: WhishPaymentInstructions | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  private readonly userSignal = signal<User | null>(this.readUserFromStorage());

  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.userSignal());
  readonly isAdmin = computed(() => this.userSignal()?.role === 'admin');
  readonly isBrand = computed(() => this.userSignal()?.role === 'brand');
  readonly isPending = computed(() => {
    const user = this.userSignal();
    return !!user && user.role !== 'admin' && user.role !== 'brand' && user.approval_status === 'pending';
  });

  private readUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', payload).pipe(
      tap((res) => this.setSession(res)),
    );
  }

  register(payload: RegisterPayload): Observable<RegisterResponse> {
    return this.api.post<RegisterResponse>('/auth/register', payload).pipe(
      tap((res) => {
        if (res.accessToken && res.refreshToken) {
          this.setSession({
            user: res.user as User,
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          });
        }
      }),
    );
  }

  refresh(): Observable<{ accessToken: string; refreshToken: string }> {
    return this.api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      refreshToken: this.refreshToken,
    }).pipe(
      tap((res) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
      }),
    );
  }

  me(): Observable<User> {
    return this.api.get<User>('/auth/me').pipe(
      tap((user) => {
        this.userSignal.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
    );
  }

  setSession(res: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.userSignal.set(res.user);
  }

  updateStoredUser(patch: Partial<User>): void {
    const merged = { ...this.userSignal(), ...patch } as User;
    this.userSignal.set(merged);
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
  }

  logout(redirect = true): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
    if (redirect) this.router.navigate(['/auth/login']);
  }
}
