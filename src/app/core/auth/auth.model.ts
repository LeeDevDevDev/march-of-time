import { ThemeMode } from '../theme/theme.store';

export interface UserProfile {
  id: string;
  display_name: string;
  handle?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean;
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

export function buildAppAbsoluteUrl(relativePath = ''): string {
  const cleanRel = relativePath.replace(/^\/+/, '');
  if (typeof window === 'undefined') {
    return `/${cleanRel}`;
  }
  const origin = window.location?.origin ?? '';
  const rawBase =
    typeof document !== 'undefined'
      ? (document.querySelector('base')?.getAttribute('href') ?? '/')
      : '/';
  if (rawBase.startsWith('http://') || rawBase.startsWith('https://')) {
    const normalizedAbsBase = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    return `${normalizedAbsBase}${cleanRel}`;
  }
  const withLeading = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const normalizedBase = withLeading.endsWith('/')
    ? withLeading
    : `${withLeading}/`;
  return `${origin}${normalizedBase}${cleanRel}`;
}
