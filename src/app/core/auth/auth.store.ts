import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { ThemeStore } from '../theme/theme.store';
import {
  UserProfile,
  buildAppAbsoluteUrl,
  sanitizeHandle,
} from './auth.model';
import { AuthService } from './auth.service';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly themeStore = inject(ThemeStore);
  private readonly router = inject(Router);

  private readonly initPromise: Promise<void>;

  readonly #state = signal<AuthState>({
    user: null,
    profile: null,
    isInitialized: false,
    isLoading: false,
    error: null,
    statusMessage: null,
  });

  readonly user = computed(() => this.#state().user);
  readonly profile = computed(() => this.#state().profile);
  readonly isInitialized = computed(() => this.#state().isInitialized);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);
  readonly statusMessage = computed(() => this.#state().statusMessage);

  readonly isAuthenticated = computed(() => Boolean(this.#state().user));

  readonly displayName = computed(() => {
    const prof = this.#state().profile;
    if (prof?.display_name) return prof.display_name;
    const usr = this.#state().user;
    if (usr?.user_metadata?.['full_name']) return String(usr.user_metadata['full_name']);
    if (usr?.email) return usr.email.split('@')[0];
    return 'Adventurer';
  });

  readonly handle = computed<string | null>(() => {
    const profHandle = this.#state().profile?.handle;
    if (profHandle) return profHandle;
    const metaHandle = this.#state().user?.user_metadata?.['handle'];
    if (typeof metaHandle === 'string' && metaHandle.trim().length >= 3) {
      return metaHandle.trim().toLowerCase();
    }
    return null;
  });

  readonly isAdmin = computed<boolean>(() => {
    return this.#state().profile?.is_admin === true;
  });

  readonly needsOnboarding = computed(
    () => this.isAuthenticated() && !this.handle()
  );

  constructor() {
    this.initPromise = this.initAuthListener();
  }

  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async initAuthListener(): Promise<void> {
    this.#state.update((s) => ({ ...s, isLoading: true }));
    try {
      const sessionUser = await this.authService.getSessionUser();

      if (sessionUser) {
        const profile = await this.loadAndHydrateProfile(sessionUser.id);
        this.#state.update((s) => ({
          ...s,
          user: sessionUser,
          profile,
          isInitialized: true,
          isLoading: false,
        }));
      } else {
        this.#state.update((s) => ({
          ...s,
          user: null,
          profile: null,
          isInitialized: true,
          isLoading: false,
        }));
      }

      this.authService.onAuthStateChange(async (event, session) => {
        const usr = session?.user ?? null;

        if (!usr) {
          this.#state.update((s) => ({
            ...s,
            user: null,
            profile: null,
          }));
          return;
        }

        const currentUserId = this.#state().user?.id;
        if (
          currentUserId === usr.id &&
          this.#state().profile &&
          (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
        ) {
          this.#state.update((s) => ({ ...s, user: usr }));
          return;
        }

        const profile = await this.loadAndHydrateProfile(usr.id);
        this.#state.update((s) => ({
          ...s,
          user: usr,
          profile,
        }));
      });
    } catch {
      this.#state.update((s) => ({ ...s, isInitialized: true, isLoading: false }));
    }
  }

  private async loadAndHydrateProfile(userId: string): Promise<UserProfile | null> {
    const profile = await this.authService.fetchProfile(userId);
    if (profile) {
      this.themeStore.hydrateFromProfileIfUnset(
        profile.sheet_theme,
        profile.vtt_theme
      );
    }
    return profile;
  }

  clearMessages(): void {
    this.#state.update((s) => ({ ...s, error: null, statusMessage: null }));
  }

  async isHandleTaken(cleanHandle: string, excludeUserId?: string): Promise<boolean> {
    return this.authService.isHandleTaken(cleanHandle, excludeUserId);
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName: string,
    rawHandle: string
  ): Promise<boolean> {
    const cleanHandle = sanitizeHandle(rawHandle);
    if (cleanHandle.length < 3) {
      this.#state.update((s) => ({
        ...s,
        error:
          'Handle must be at least 3 characters (lowercase letters, numbers, or underscores).',
      }));
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));
    try {
      const taken = await this.isHandleTaken(cleanHandle);
      if (taken) {
        this.#state.update((s) => ({
          ...s,
          error: `The handle @${cleanHandle} is already taken. Please choose another.`,
        }));
        return false;
      }

      const res = await this.authService.signUpWithEmail({
        email,
        password,
        displayName,
        cleanHandle,
      });

      if (res.error) {
        this.#state.update((s) => ({ ...s, error: res.error }));
        return false;
      }

      if (res.hasSession && res.user) {
        const profile = await this.loadAndHydrateProfile(res.user.id);
        this.#state.update((s) => ({ ...s, user: res.user, profile }));
        await this.router.navigate(['/dashboard']);
      } else {
        this.#state.update((s) => ({
          ...s,
          statusMessage:
            'Account created! Check your email for the confirmation link, or disable "Confirm email" in Supabase Auth -> Providers -> Email to sign in immediately.',
        }));
      }
      return true;
    } finally {
      this.#state.update((s) => ({ ...s, isLoading: false }));
    }
  }

  async signInWithEmail(email: string, password: string): Promise<boolean> {
    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));
    try {
      const res = await this.authService.signInWithPassword(email, password);
      if (res.error) {
        this.#state.update((s) => ({ ...s, error: res.error }));
        return false;
      }
      if (res.user) {
        const profile = await this.loadAndHydrateProfile(res.user.id);
        this.#state.update((s) => ({ ...s, user: res.user, profile }));
      }
      if (this.needsOnboarding()) {
        await this.router.navigate(['/onboarding']);
      } else {
        await this.router.navigate(['/dashboard']);
      }
      return true;
    } finally {
      this.#state.update((s) => ({ ...s, isLoading: false }));
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.#state.update((s) => ({ ...s, error: null }));
    const err = await this.authService.signInWithGoogle(
      buildAppAbsoluteUrl('')
    );
    if (err) {
      this.#state.update((s) => ({ ...s, error: err }));
    }
  }

  async saveProfileAndHandle(displayName: string, rawHandle: string): Promise<boolean> {
    const user = this.#state().user;
    if (!user) return false;

    const cleanName = displayName.trim();
    const cleanHandle = sanitizeHandle(rawHandle);

    if (!cleanName) {
      this.#state.update((s) => ({ ...s, error: 'Display Name is required.' }));
      return false;
    }

    if (cleanHandle.length < 3) {
      this.#state.update((s) => ({
        ...s,
        error:
          'Handle must be between 3 and 24 characters (letters, numbers, or underscores).',
      }));
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));
    try {
      const taken = await this.isHandleTaken(cleanHandle, user.id);
      if (taken) {
        this.#state.update((s) => ({
          ...s,
          error: `The handle @${cleanHandle} is already taken. Please pick another.`,
        }));
        return false;
      }

      const res = await this.authService.updateUserProfileAndHandle(
        user.id,
        cleanName,
        cleanHandle
      );

      if (res.error) {
        this.#state.update((s) => ({ ...s, error: res.error }));
        return false;
      }

      const refreshedProfile = await this.loadAndHydrateProfile(user.id);
      this.#state.update((s) => ({
        ...s,
        user: res.user ?? s.user,
        profile: refreshedProfile
          ? { ...refreshedProfile, display_name: cleanName, handle: cleanHandle }
          : {
              id: user.id,
              display_name: cleanName,
              handle: cleanHandle,
              sheet_theme: this.themeStore.sheetTheme(),
              vtt_theme: this.themeStore.vttTheme(),
            },
        statusMessage: 'Profile saved.',
      }));

      return true;
    } finally {
      this.#state.update((s) => ({ ...s, isLoading: false }));
    }
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    this.#state.update((s) => ({
      ...s,
      user: null,
      profile: null,
    }));
    await this.router.navigate(['/auth']);
  }
}
