import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  onboardingGuard,
} from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'onboarding',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./features/auth/onboarding.component').then(
        (m) => m.OnboardingComponent
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'characters',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/characters/characters-list.component').then(
        (m) => m.CharactersListComponent
      ),
  },
  {
    path: 'characters/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/characters/character-creator.component').then(
        (m) => m.CharacterCreatorComponent
      ),
  },
  {
    path: 'characters/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/characters/character-detail.component').then(
        (m) => m.CharacterDetailComponent
      ),
  },
  {
    path: 'content-manager',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/content-manager/content-manager.component').then(
        (m) => m.ContentManagerComponent
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
