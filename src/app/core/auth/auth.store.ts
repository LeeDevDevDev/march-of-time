import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { ThemeStore } from '../theme/theme.store';
import { UserProfile, sanitizeHandle } from './auth.model';

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
  private readonly supabase = inject(SupabaseService).client;
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
      const { data } = await this.supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;

      if (sessionUser) {
        const profile = await this.fetchProfile(sessionUser.id);
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

      this.supabase.auth.onAuthStateChange(async (event, session) => {
        const usr = session?.user ?? null;

        if (!usr) {
          this.#state.update((s) => ({
            ...s,
            user: null,
            profile: null,
          }));
          return;
        }

        // When tabbing back into the browser, Supabase emits TOKEN_REFRESHED or SIGNED_IN
        // for the already-active user. Keep current state & theme intact without re-hydrating.
        const currentUserId = this.#state().user?.id;
        if (
          currentUserId === usr.id &&
          this.#state().profile &&
          (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
        ) {
          this.#state.update((s) => ({ ...s, user: usr }));
          return;
        }

        const profile = await this.fetchProfile(usr.id);
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

  private async fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      const typed = data as UserProfile;
      this.themeStore.hydrateFromProfileIfUnset(typed.sheet_theme, typed.vtt_theme);
      return typed;
    }
    return null;
  }

  clearMessages(): void {
    this.#state.update((s) => ({ ...s, error: null, statusMessage: null }));
  }

  async isHandleTaken(cleanHandle: string, excludeUserId?: string): Promise<boolean> {
    let query = this.supabase
      .from('profiles')
      .select('id')
      .eq('handle', cleanHandle);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return false;
    }
    return Boolean(data);
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
        error: 'Handle must be at least 3 characters (lowercase letters, numbers, or underscores).',
      }));
      return false;
    }

    this.#state.update((s) => ({ ...s, isLoading: true, error: null, statusMessage: null }));
    try {
      const taken = await this.isHandleTaken(cleanHandle);
      if (taken) {
        this.#state.update((s) => ({
          ...s,
          error: `The handle @${cleanHandle} is already taken. Please choose another.`,
        }));
        return false;
      }

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName || email.split('@')[0],
            handle: cleanHandle,
          },
        },
      });

      if (error) {
        this.#state.update((s) => ({ ...s, error: error.message }));
        return false;
      }

      if (data.session && data.user) {
        await this.supabase
          .from('profiles')
          .update({
            display_name: displayName || email.split('@')[0],
            handle: cleanHandle,
          })
          .eq('id', data.user.id);

        const profile = await this.fetchProfile(data.user.id);
        this.#state.update((s) => ({ ...s, user: data.user, profile }));
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
    this.#state.update((s) => ({ ...s, isLoading: true, error: null, statusMessage: null }));
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
      if (error) {
        this.#state.update((s) => ({ ...s, error: error.message }));
        return false;
      }
      if (data.user) {
        const profile = await this.fetchProfile(data.user.id);
        this.#state.update((s) => ({ ...s, user: data.user, profile }));
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
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      this.#state.update((s) => ({ ...s, error: error.message }));
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
        error: 'Handle must be between 3 and 24 characters (letters, numbers, or underscores).',
      }));
      return false;
    }

    this.#state.update((s) => ({ ...s, isLoading: true, error: null, statusMessage: null }));
    try {
      const taken = await this.isHandleTaken(cleanHandle, user.id);
      if (taken) {
        this.#state.update((s) => ({
          ...s,
          error: `The handle @${cleanHandle} is already taken. Please pick another.`,
        }));
        return false;
      }

      const { data: authUpdated, error: authErr } = await this.supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          handle: cleanHandle,
        },
      });

      if (authErr) {
        this.#state.update((s) => ({ ...s, error: authErr.message }));
        return false;
      }

      const { error: profErr } = await this.supabase
        .from('profiles')
        .update({
          display_name: cleanName,
          handle: cleanHandle,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profErr) {
        await this.supabase
          .from('profiles')
          .update({
            display_name: cleanName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

      const refreshedProfile = await this.fetchProfile(user.id);
      this.#state.update((s) => ({
        ...s,
        user: authUpdated.user ?? s.user,
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
    await this.supabase.auth.signOut();
    this.#state.update((s) => ({
      ...s,
      user: null,
      profile: null,
    }));
    await this.router.navigate(['/auth']);
  }
}
