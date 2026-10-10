import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const stepperGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.showStepper()) return true;

  const whish = route.queryParamMap.get('whish');
  const ref = route.queryParamMap.get('ref');
  return router.createUrlTree(['/dashboard'], {
    queryParams: whish ? { whish, ...(ref ? { ref } : {}) } : {},
  });
};
