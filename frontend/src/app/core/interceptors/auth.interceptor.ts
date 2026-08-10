import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const ACCESS_TOKEN_KEY = 'bkd_access_token';

/**
 * Attaches the bearer token to every request and force-logs-out on 401s
 * (except for the auth endpoints themselves, to avoid redirect loops).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = /\/auth\/(login|register|refresh)/.test(req.url);
      if (error.status === 401 && !isAuthEndpoint) {
        const auth = inject(AuthService);
        auth.logout(false);
        router.navigate(['/auth/login'], { queryParams: { redirect: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
