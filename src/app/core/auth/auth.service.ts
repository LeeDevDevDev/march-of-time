import { Injectable, inject } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { UserProfile } from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService).client;

  async getSessionUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>
  ): void {
    this.supabase.auth.onAuthStateChange((event, session) => {
      void callback(event, session);
    });
  }

  async fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    return (data as UserProfile) ?? null;
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

  async signUpWithEmail(input: {
    email: string;
    password: string;
    displayName: string;
    cleanHandle: string;
  }): Promise<{
    user: User | null;
    hasSession: boolean;
    error: string | null;
  }> {
    const { data, error } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.displayName || input.email.split('@')[0],
          handle: input.cleanHandle,
        },
      },
    });

    if (error) {
      return { user: null, hasSession: false, error: error.message };
    }

    if (data.session && data.user) {
      await this.supabase
        .from('profiles')
        .update({
          display_name: input.displayName || input.email.split('@')[0],
          handle: input.cleanHandle,
        })
        .eq('id', data.user.id);
    }

    return {
      user: data.user ?? null,
      hasSession: Boolean(data.session && data.user),
      error: null,
    };
  }

  async signInWithPassword(
    email: string,
    password: string
  ): Promise<{ user: User | null; error: string | null }> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { user: null, error: error.message };
    }
    return { user: data.user ?? null, error: null };
  }

  async signInWithGoogle(redirectToUrl: string): Promise<string | null> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectToUrl,
      },
    });
    return error?.message ?? null;
  }

  async updateUserProfileAndHandle(
    userId: string,
    cleanName: string,
    cleanHandle: string
  ): Promise<{ user: User | null; error: string | null }> {
    const { data: authUpdated, error: authErr } =
      await this.supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          handle: cleanHandle,
        },
      });

    if (authErr) {
      return { user: null, error: authErr.message };
    }

    const { error: profErr } = await this.supabase
      .from('profiles')
      .update({
        display_name: cleanName,
        handle: cleanHandle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profErr) {
      await this.supabase
        .from('profiles')
        .update({
          display_name: cleanName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return { user: authUpdated.user ?? null, error: null };
  }

  async updateAdminAccess(userId: string, nextAdmin: boolean): Promise<void> {
    await this.supabase.auth.updateUser({
      data: { is_admin: nextAdmin },
    });

    await this.supabase
      .from('profiles')
      .update({ is_admin: nextAdmin, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }
}
