import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  sheetTheme: ThemeMode;
  vttTheme: ThemeMode;
}

const SHEET_THEME_KEY = 'mot_sheet_theme';
const VTT_THEME_KEY = 'mot_vtt_theme';

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly supabase = inject(SupabaseService).client;

  readonly #state = signal<ThemeState>({
    sheetTheme: this.readSavedTheme(SHEET_THEME_KEY, 'light'),
    vttTheme: this.readSavedTheme(VTT_THEME_KEY, 'dark'),
  });

  readonly sheetTheme = computed(() => this.#state().sheetTheme);
  readonly vttTheme = computed(() => this.#state().vttTheme);

  private readSavedTheme(key: string, fallback: ThemeMode): ThemeMode {
    const val = localStorage.getItem(key);
    return val === 'light' || val === 'dark' ? val : fallback;
  }

  hydrateFromProfileIfUnset(sheetTheme?: ThemeMode | null, vttTheme?: ThemeMode | null): void {
    const hasLocalSheet = localStorage.getItem(SHEET_THEME_KEY);
    const hasLocalVtt = localStorage.getItem(VTT_THEME_KEY);

    const nextSheet =
      hasLocalSheet === 'light' || hasLocalSheet === 'dark'
        ? hasLocalSheet
        : sheetTheme === 'light' || sheetTheme === 'dark'
          ? sheetTheme
          : this.#state().sheetTheme;

    const nextVtt =
      hasLocalVtt === 'light' || hasLocalVtt === 'dark'
        ? hasLocalVtt
        : vttTheme === 'light' || vttTheme === 'dark'
          ? vttTheme
          : this.#state().vttTheme;

    this.#state.set({ sheetTheme: nextSheet, vttTheme: nextVtt });
    localStorage.setItem(SHEET_THEME_KEY, nextSheet);
    localStorage.setItem(VTT_THEME_KEY, nextVtt);
  }

  toggleSheetTheme(userId?: string | null): void {
    const next: ThemeMode = this.#state().sheetTheme === 'light' ? 'dark' : 'light';
    this.#state.update((s) => ({ ...s, sheetTheme: next }));
    localStorage.setItem(SHEET_THEME_KEY, next);

    if (userId) {
      void this.supabase
        .from('profiles')
        .update({ sheet_theme: next, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }
  }

  toggleVttTheme(userId?: string | null): void {
    const next: ThemeMode = this.#state().vttTheme === 'dark' ? 'light' : 'dark';
    this.setVttTheme(next, userId);
  }

  setVttTheme(next: ThemeMode, userId?: string | null): void {
    if (this.#state().vttTheme === next) {
      localStorage.setItem(VTT_THEME_KEY, next);
      return;
    }
    this.#state.update((s) => ({ ...s, vttTheme: next }));
    localStorage.setItem(VTT_THEME_KEY, next);

    if (userId) {
      void this.supabase
        .from('profiles')
        .update({ vtt_theme: next, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }
  }
}
