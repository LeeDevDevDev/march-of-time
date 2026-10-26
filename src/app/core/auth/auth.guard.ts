import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

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

export const adminGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await authStore.waitForInit();

  if (!authStore.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }

  if (!authStore.isAdmin()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

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
