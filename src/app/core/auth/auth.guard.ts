import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * Requires an active Supabase Auth session AND a completed @handle.
 * - Unauthenticated -> /auth
 * - First-time Google sign-in without a @handle -> /onboarding
 */
export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await authStore.waitForInit();

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }

  if (authStore.needsOnboarding()) {
    return router.createUrlTree(['/onboarding']);
  }

  return true;
};

/**
 * Guard for /onboarding:
 * - Unauthenticated -> /auth
 * - Already has a @handle -> /dashboard
 */
export const onboardingGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await authStore.waitForInit();

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }

  if (!authStore.needsOnboarding()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

/**
 * Redirects already-authenticated users away from /auth.
 */
export const guestGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await authStore.waitForInit();

  if (authStore.isAuthenticated()) {
    return authStore.needsOnboarding()
      ? router.createUrlTree(['/onboarding'])
      : router.createUrlTree(['/dashboard']);
  }
  return true;
};
