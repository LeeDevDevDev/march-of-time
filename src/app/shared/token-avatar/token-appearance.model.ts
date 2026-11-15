export type TokenShape = 'circle';

export type TokenFramePresetId =
  | 'simple'
  | 'double'
  | 'ornate'
  | 'iron'
  | 'boss'
  | 'none'
  | 'custom_png';

export interface TokenAppearanceConfig {
  shape: TokenShape;
  frame: TokenFramePresetId;
  frame_color: string | null;
  custom_frame_url: string | null;
  scale: number;
  offset_x: number;
  offset_y: number;
}

export interface TokenFramePresetMeta {
  id: TokenFramePresetId;
  label: string;
  shortLabel: string;
  description: string;
}

export const TOKEN_FRAME_PRESETS: TokenFramePresetMeta[] = [
  {
    id: 'simple',
    label: 'Simple Ring',
    shortLabel: 'Simple',
    description: 'Clean tactical band tinted to faction or custom color.',
  },
  {
    id: 'double',
    label: 'Double Ring',
    shortLabel: 'Double',
    description: 'Dual inlaid metallic bands with recessed inner channel.',
  },
  {
    id: 'ornate',
    label: 'Ornate Filigree',
    shortLabel: 'Ornate',
    description: 'Gilded compass diamonds with beaded inner filigree.',
  },
  {
    id: 'iron',
    label: 'Forged Iron',
    shortLabel: 'Iron',
    description: 'Heavy riveted iron band with eight forged bolts.',
  },
  {
    id: 'boss',
    label: 'Warlord Crest',
    shortLabel: 'Boss',
    description: 'Crowned cardinal points and armored inner ward ring.',
  },
  {
    id: 'none',
    label: 'Borderless',
    shortLabel: 'None',
    description: 'Unframed circular token for pre-bordered art.',
  },
  {
    id: 'custom_png',
    label: 'Custom PNG Frame',
    shortLabel: 'Custom PNG',
    description: 'Overlay a transparent PNG frame from your Asset Library.',
  },
];

export const TOKEN_RING_COLOR_SWATCHES: string[] = [
  '#38B29A',
  '#F59E0B',
  '#EAB308',
  '#C4491A',
  '#EF4444',
  '#CBD5E1',
  '#38BDF8',
  '#A855F7',
];

export const DEFAULT_TOKEN_APPEARANCE: TokenAppearanceConfig = {
  shape: 'circle',
  frame: 'simple',
  frame_color: null,
  custom_frame_url: null,
  scale: 1,
  offset_x: 0,
  offset_y: 0,
};

const VALID_FRAME_IDS = new Set<TokenFramePresetId>([
  'simple',
  'double',
  'ornate',
  'iron',
  'boss',
  'none',
  'custom_png',
]);

export function sanitizeOptionalImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function clampTokenScale(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 1;
  return Math.round(Math.max(0.5, Math.min(3, num)) * 100) / 100;
}

export function clampTokenOffset(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return Math.round(Math.max(-100, Math.min(100, num)) * 10) / 10;
}

function sanitizeOptionalFrameHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`.toUpperCase();
  }
  return null;
}

export function normalizeTokenAppearance(raw: unknown): TokenAppearanceConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_TOKEN_APPEARANCE };
  }
  const obj = raw as Record<string, unknown>;
  const rawFrame = obj['frame'];
  const frame: TokenFramePresetId =
    typeof rawFrame === 'string' &&
    VALID_FRAME_IDS.has(rawFrame as TokenFramePresetId)
      ? (rawFrame as TokenFramePresetId)
      : 'simple';

  return {
    shape: 'circle',
    frame,
    frame_color: sanitizeOptionalFrameHex(obj['frame_color']),
    custom_frame_url: sanitizeOptionalImageUrl(obj['custom_frame_url']),
    scale: clampTokenScale(obj['scale']),
    offset_x: clampTokenOffset(obj['offset_x']),
    offset_y: clampTokenOffset(obj['offset_y']),
  };
}

export function hasCustomTokenAppearance(
  raw: TokenAppearanceConfig | null | undefined
): boolean {
  if (!raw) return false;
  return (
    raw.frame !== 'simple' ||
    Boolean(raw.frame_color) ||
    Boolean(raw.custom_frame_url) ||
    Math.abs(raw.scale - 1) > 0.001 ||
    Math.abs(raw.offset_x) > 0.05 ||
    Math.abs(raw.offset_y) > 0.05
  );
}

export function resolveTokenRingColor(
  appearance: TokenAppearanceConfig | null | undefined,
  actorColor: string | null | undefined,
  faction: 'ally' | 'enemy' | 'neutral' = 'ally'
): string {
  if (appearance?.frame_color) {
    return appearance.frame_color;
  }
  if (actorColor && actorColor.trim().length > 0) {
    return actorColor.trim();
  }
  if (faction === 'enemy') return '#F43F5E';
  if (faction === 'neutral') return '#F59E0B';
  return '#38B29A';
}

export function buildTokenImagePanZoomTransform(
  appearance: TokenAppearanceConfig | null | undefined
): string {
  if (!appearance) return 'none';
  const tx = clampTokenOffset(appearance.offset_x);
  const ty = clampTokenOffset(appearance.offset_y);
  const s = clampTokenScale(appearance.scale);
  if (Math.abs(tx) < 0.05 && Math.abs(ty) < 0.05 && Math.abs(s - 1) < 0.005) {
    return 'none';
  }
  return `translate(${tx}%, ${ty}%) scale(${s})`;
}
