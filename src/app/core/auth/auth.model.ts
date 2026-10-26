import { ThemeMode } from '../theme/theme.store';

export interface UserProfile {
  id: string;
  display_name: string;
  handle?: string | null;
  avatar_url?: string | null;
  sheet_theme: ThemeMode;
  vtt_theme: ThemeMode;
}

export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}
