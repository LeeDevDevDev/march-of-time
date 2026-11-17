import { Injectable, computed, signal } from '@angular/core';

export type VttHotkeyAction =
  | 'tool_select'
  | 'tool_ruler'
  | 'tool_pan'
  | 'tool_wall'
  | 'tool_light'
  | 'tool_fog'
  | 'fit_scene'
  | 'undo'
  | 'delete_tokens';

export type VttHotkeyMap = Record<VttHotkeyAction, string>;

export interface VttHotkeyBindingMeta {
  action: VttHotkeyAction;
  label: string;
  description: string;
  defaultCombo: string;
  gmOnly: boolean;
}

export type VttDiceMaterial =
  | 'resin'
  | 'metal'
  | 'marble'
  | 'wood'
  | 'gemstone'
  | 'matte';

export interface VttDiceAppearance {
  presetId: string;
  material: VttDiceMaterial;
  bodyColor: string;
  labelColor: string;
}

export interface VttDicePreset {
  id: string;
  label: string;
  material: VttDiceMaterial;
  bodyColor: string;
  labelColor: string;
}

export interface VttDiceMaterialOption {
  id: VttDiceMaterial;
  label: string;
  description: string;
}

export const VTT_DICE_MATERIAL_OPTIONS: VttDiceMaterialOption[] = [
  {
    id: 'metal',
    label: 'Brushed Metal',
    description: 'High metallic luster with fine brushed grain',
  },
  {
    id: 'resin',
    label: 'Smooth Resin',
    description: 'Glossy polished tabletop acrylic',
  },
  {
    id: 'marble',
    label: 'Marble Stone',
    description: 'Polished mineral stone with natural veining',
  },
  {
    id: 'gemstone',
    label: 'Gemstone',
    description: 'Deep crystalline luster with clearcoat sheen',
  },
  {
    id: 'wood',
    label: 'Wood Grain',
    description: 'Carved timber grain with warm satin finish',
  },
  {
    id: 'matte',
    label: 'Matte Bone',
    description: 'Low-glare carved bone finish',
  },
];

export const VTT_DICE_PRESETS: VttDicePreset[] = [
  {
    id: 'sunfire-copper',
    label: 'Sunfire Copper',
    material: 'metal',
    bodyColor: '#C4491A',
    labelColor: '#FFFBEB',
  },
  {
    id: 'obsidian-gold',
    label: 'Obsidian & Gold',
    material: 'marble',
    bodyColor: '#162220',
    labelColor: '#FBBF24',
  },
  {
    id: 'imperial-jade',
    label: 'Imperial Jade',
    material: 'gemstone',
    bodyColor: '#0F766E',
    labelColor: '#ECFDF5',
  },
  {
    id: 'carrara-marble',
    label: 'Marble & Ink',
    material: 'marble',
    bodyColor: '#EDE8DF',
    labelColor: '#1E293B',
  },
  {
    id: 'brushed-steel',
    label: 'Brushed Steel',
    material: 'metal',
    bodyColor: '#475569',
    labelColor: '#F8FAFC',
  },
  {
    id: 'crimson-gem',
    label: 'Crimson Gem',
    material: 'gemstone',
    bodyColor: '#9F1239',
    labelColor: '#FDE68A',
  },
  {
    id: 'tavern-oak',
    label: 'Tavern Oak',
    material: 'wood',
    bodyColor: '#78350F',
    labelColor: '#FEF3C7',
  },
  {
    id: 'carved-bone',
    label: 'Carved Bone',
    material: 'matte',
    bodyColor: '#D6CFC2',
    labelColor: '#292524',
  },
];

export const DEFAULT_DICE_APPEARANCE: VttDiceAppearance = {
  presetId: VTT_DICE_PRESETS[0].id,
  material: VTT_DICE_PRESETS[0].material,
  bodyColor: VTT_DICE_PRESETS[0].bodyColor,
  labelColor: VTT_DICE_PRESETS[0].labelColor,
};

export const DICE_BODY_COLOR_SWATCHES: string[] = [
  '#C4491A',
  '#162220',
  '#0F766E',
  '#EDE8DF',
  '#475569',
  '#9F1239',
  '#6D28D9',
  '#1D4ED8',
];

export const DICE_LABEL_COLOR_SWATCHES: string[] = [
  '#FFFBEB',
  '#FBBF24',
  '#F8FAFC',
  '#ECFDF5',
  '#7DD3FC',
  '#FDA4AF',
  '#1E293B',
  '#09100F',
];

const VALID_DICE_MATERIALS = new Set<VttDiceMaterial>([
  'resin',
  'metal',
  'marble',
  'wood',
  'gemstone',
  'matte',
]);

export function sanitizeDiceHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[0]}${trimmed[0]}${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`.toUpperCase();
  }
  return fallback;
}

export function sanitizeDiceAppearance(
  raw: unknown,
  fallback: VttDiceAppearance = DEFAULT_DICE_APPEARANCE
): VttDiceAppearance {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }
  const obj = raw as Partial<Record<keyof VttDiceAppearance, unknown>>;
  const material =
    typeof obj.material === 'string' &&
    VALID_DICE_MATERIALS.has(obj.material as VttDiceMaterial)
      ? (obj.material as VttDiceMaterial)
      : fallback.material;
  const bodyColor = sanitizeDiceHexColor(obj.bodyColor, fallback.bodyColor);
  const labelColor = sanitizeDiceHexColor(obj.labelColor, fallback.labelColor);
  const matchingPreset = VTT_DICE_PRESETS.find(
    (p) =>
      p.material === material &&
      p.bodyColor.toUpperCase() === bodyColor &&
      p.labelColor.toUpperCase() === labelColor
  );
  const presetId =
    matchingPreset?.id ??
    (typeof obj.presetId === 'string' && obj.presetId.trim()
      ? obj.presetId.trim()
      : 'custom');

  return {
    presetId,
    material,
    bodyColor,
    labelColor,
  };
}

export interface VttGeneralPreferences {
  masterVolume: number;
  muteAudio: boolean;
  diceSounds: boolean;
  pingAndTurnSounds: boolean;
  showHotkeyBadges: boolean;
  tokenMoveSpeed: number;
  overflowSpDamageToHp: boolean;
  enable3dDice: boolean;
  diceAppearance: VttDiceAppearance;
}

export const DEFAULT_VTT_PREFERENCES: VttGeneralPreferences = {
  masterVolume: 70,
  muteAudio: false,
  diceSounds: true,
  pingAndTurnSounds: true,
  showHotkeyBadges: true,
  tokenMoveSpeed: 30,
  overflowSpDamageToHp: true,
  enable3dDice: true,
  diceAppearance: { ...DEFAULT_DICE_APPEARANCE },
};

export const DEFAULT_VTT_HOTKEYS: VttHotkeyMap = {
  tool_select: 'v',
  tool_ruler: 'r',
  tool_pan: 'h',
  tool_wall: 'w',
  tool_light: 'l',
  tool_fog: 'f',
  fit_scene: 'c',
  undo: 'ctrl+z',
  delete_tokens: 'delete',
};

export const VTT_HOTKEY_META: VttHotkeyBindingMeta[] = [
  {
    action: 'tool_select',
    label: 'Select & Move Tool',
    description: 'Select tokens and drag to move (hold Ctrl to chain moves).',
    defaultCombo: DEFAULT_VTT_HOTKEYS.tool_select,
    gmOnly: false,
  },
  {
    action: 'tool_ruler',
    label: 'Measure Distance Tool',
    description: 'Measure tactical path or continuous distance in feet.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.tool_ruler,
    gmOnly: false,
  },
  {
    action: 'tool_pan',
    label: 'Pan Camera Tool',
    description: 'Drag the canvas to pan (holding Space also pans anytime).',
    defaultCombo: DEFAULT_VTT_HOTKEYS.tool_pan,
    gmOnly: false,
  },
  {
    action: 'fit_scene',
    label: 'Center / Fit Scene',
    description: 'Recenter and fit the active scene inside the viewport.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.fit_scene,
    gmOnly: false,
  },
  {
    action: 'undo',
    label: 'Undo Recent Event',
    description: 'Undo your most recent token move, wall, light, or fog change.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.undo,
    gmOnly: false,
  },
  {
    action: 'delete_tokens',
    label: 'Remove Selected Tokens',
    description: 'Remove your currently selected token or tokens from the scene.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.delete_tokens,
    gmOnly: false,
  },
  {
    action: 'tool_wall',
    label: 'Walls & Doors Tool',
    description: 'Draw dynamic line-of-sight walls, doors, and windows.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.tool_wall,
    gmOnly: true,
  },
  {
    action: 'tool_light',
    label: 'Dynamic Lights Tool',
    description: 'Place, move, and configure light sources in feet.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.tool_light,
    gmOnly: true,
  },
  {
    action: 'tool_fog',
    label: 'Visibility & Fog Tool',
    description: 'Open Token Vision, Fog Exploration, and Global Illumination controls.',
    defaultCombo: DEFAULT_VTT_HOTKEYS.tool_fog,
    gmOnly: true,
  },
];

const VTT_HOTKEYS_STORAGE_KEY = 'mot_vtt_hotkeys_v1';
const VTT_PREFERENCES_STORAGE_KEY = 'mot_vtt_preferences_v1';

const MODIFIER_ONLY_KEYS = new Set([
  'control',
  'shift',
  'alt',
  'meta',
  'os',
  'capslock',
]);

export const RESERVED_VTT_COMBOS = new Set(['escape', 'space']);

export function resolveBaseKeyFromKeyboardEvent(
  event: Pick<KeyboardEvent, 'key' | 'code'>
): string | null {
  const code = event.code || '';
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  if (code === 'Space' || event.key === ' ') {
    return 'space';
  }
  if (code === 'Delete') {
    return 'delete';
  }

  const rawKey = (event.key || '').trim().toLowerCase();
  if (!rawKey || MODIFIER_ONLY_KEYS.has(rawKey)) {
    return null;
  }
  if (rawKey === 'del') {
    return 'delete';
  }
  return rawKey;
}

export function normalizeKeyComboFromEvent(
  event: Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
  >
): string | null {
  const baseKey = resolveBaseKeyFromKeyboardEvent(event);
  if (!baseKey) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(baseKey);
  return parts.join('+');
}

export function sanitizeHotkeyCombo(raw: string): string {
  const cleaned = (raw || '').trim().toLowerCase();
  if (!cleaned) return '';
  const tokens = cleaned
    .split('+')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return '';

  const hasCtrl = tokens.includes('ctrl') || tokens.includes('cmd') || tokens.includes('meta');
  const hasAlt = tokens.includes('alt');
  const hasShift = tokens.includes('shift');
  const nonMods = tokens.filter(
    (t) => t !== 'ctrl' && t !== 'cmd' && t !== 'meta' && t !== 'alt' && t !== 'shift'
  );
  const baseKey = nonMods[nonMods.length - 1];
  if (!baseKey || MODIFIER_ONLY_KEYS.has(baseKey)) return '';

  const parts: string[] = [];
  if (hasCtrl) parts.push('ctrl');
  if (hasAlt) parts.push('alt');
  if (hasShift) parts.push('shift');
  parts.push(baseKey);
  return parts.join('+');
}

export function matchesHotkey(
  event: Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
  >,
  combo: string
): boolean {
  const target = sanitizeHotkeyCombo(combo);
  if (!target) return false;
  const pressed = normalizeKeyComboFromEvent(event);
  return pressed === target;
}

export function formatHotkeyBadge(combo: string): string {
  const clean = sanitizeHotkeyCombo(combo);
  if (!clean) return 'Unbound';
  return clean
    .split('+')
    .map((part) => {
      if (part === 'ctrl') return 'Ctrl';
      if (part === 'alt') return 'Alt';
      if (part === 'shift') return 'Shift';
      if (part === 'space') return 'Space';
      if (part === 'escape') return 'Esc';
      if (part === 'backspace') return 'Backspace';
      if (part === 'delete') return 'Del';
      if (part.startsWith('arrow')) {
        return 'Arrow ' + part.slice(5, 6).toUpperCase() + part.slice(6);
      }
      return part.length === 1
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return target.isContentEditable;
}

@Injectable({ providedIn: 'root' })
export class VttSettingsStore {
  readonly bindingMetaList = VTT_HOTKEY_META;

  readonly hotkeys = signal<VttHotkeyMap>(this.readSavedHotkeys());
  readonly preferences = signal<VttGeneralPreferences>(
    this.readSavedPreferences()
  );

  private audioCtx: AudioContext | null = null;

  readonly badges = computed<Record<VttHotkeyAction, string>>(() => {
    const map = this.hotkeys();
    return {
      tool_select: formatHotkeyBadge(map.tool_select),
      tool_ruler: formatHotkeyBadge(map.tool_ruler),
      tool_pan: formatHotkeyBadge(map.tool_pan),
      tool_wall: formatHotkeyBadge(map.tool_wall),
      tool_light: formatHotkeyBadge(map.tool_light),
      tool_fog: formatHotkeyBadge(map.tool_fog),
      fit_scene: formatHotkeyBadge(map.fit_scene),
      undo: formatHotkeyBadge(map.undo),
      delete_tokens: formatHotkeyBadge(map.delete_tokens),
    };
  });

  private readSavedHotkeys(): VttHotkeyMap {
    const fallback: VttHotkeyMap = { ...DEFAULT_VTT_HOTKEYS };
    if (typeof localStorage === 'undefined') {
      return fallback;
    }

    try {
      const raw = localStorage.getItem(VTT_HOTKEYS_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<Record<VttHotkeyAction, unknown>>;
      if (!parsed || typeof parsed !== 'object') return fallback;

      const merged: VttHotkeyMap = { ...fallback };
      for (const meta of VTT_HOTKEY_META) {
        const val = parsed[meta.action];
        if (typeof val === 'string') {
          const sanitized = sanitizeHotkeyCombo(val);
          if (sanitized && !RESERVED_VTT_COMBOS.has(sanitized)) {
            merged[meta.action] = sanitized;
          }
        }
      }
      return merged;
    } catch {
      return fallback;
    }
  }

  private persistHotkeys(next: VttHotkeyMap): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(VTT_HOTKEYS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  }

  setHotkey(
    action: VttHotkeyAction,
    rawCombo: string
  ): { applied: boolean; swappedWith: VttHotkeyAction | null; reason?: string } {
    const combo = sanitizeHotkeyCombo(rawCombo);
    if (!combo) {
      return { applied: false, swappedWith: null, reason: 'Invalid key.' };
    }
    if (RESERVED_VTT_COMBOS.has(combo)) {
      return {
        applied: false,
        swappedWith: null,
        reason: `${formatHotkeyBadge(combo)} is reserved for canvas navigation.`,
      };
    }

    const current = this.hotkeys();
    const prevBinding = current[action];
    if (prevBinding === combo) {
      return { applied: true, swappedWith: null };
    }

    const next: VttHotkeyMap = { ...current, [action]: combo };
    let swappedWith: VttHotkeyAction | null = null;

    for (const meta of VTT_HOTKEY_META) {
      if (meta.action !== action && current[meta.action] === combo) {
        next[meta.action] = prevBinding;
        swappedWith = meta.action;
        break;
      }
    }

    this.hotkeys.set(next);
    this.persistHotkeys(next);
    return { applied: true, swappedWith };
  }

  resetHotkey(action: VttHotkeyAction): void {
    this.setHotkey(action, DEFAULT_VTT_HOTKEYS[action]);
  }

  resetAllHotkeys(): void {
    const defaults: VttHotkeyMap = { ...DEFAULT_VTT_HOTKEYS };
    this.hotkeys.set(defaults);
    this.persistHotkeys(defaults);
  }

  private readSavedPreferences(): VttGeneralPreferences {
    const fallback: VttGeneralPreferences = { ...DEFAULT_VTT_PREFERENCES };
    if (typeof localStorage === 'undefined') {
      return fallback;
    }

    try {
      const raw = localStorage.getItem(VTT_PREFERENCES_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<Record<keyof VttGeneralPreferences, unknown>>;
      if (!parsed || typeof parsed !== 'object') return fallback;

      const rawVol =
        parsed.masterVolume !== undefined && parsed.masterVolume !== null
          ? Number(parsed.masterVolume)
          : Number.NaN;
      const rawSpeed =
        parsed.tokenMoveSpeed !== undefined &&
        parsed.tokenMoveSpeed !== null &&
        parsed.tokenMoveSpeed !== ''
          ? Number(parsed.tokenMoveSpeed)
          : Number.NaN;
      return {
        masterVolume: Number.isFinite(rawVol)
          ? Math.max(0, Math.min(100, Math.round(rawVol)))
          : fallback.masterVolume,
        muteAudio:
          typeof parsed.muteAudio === 'boolean'
            ? parsed.muteAudio
            : fallback.muteAudio,
        diceSounds:
          typeof parsed.diceSounds === 'boolean'
            ? parsed.diceSounds
            : fallback.diceSounds,
        pingAndTurnSounds:
          typeof parsed.pingAndTurnSounds === 'boolean'
            ? parsed.pingAndTurnSounds
            : fallback.pingAndTurnSounds,
        showHotkeyBadges:
          typeof parsed.showHotkeyBadges === 'boolean'
            ? parsed.showHotkeyBadges
            : fallback.showHotkeyBadges,
        tokenMoveSpeed: Number.isFinite(rawSpeed)
          ? Math.max(0, Math.min(120, Math.round(rawSpeed)))
          : fallback.tokenMoveSpeed,
        overflowSpDamageToHp:
          typeof parsed.overflowSpDamageToHp === 'boolean'
            ? parsed.overflowSpDamageToHp
            : fallback.overflowSpDamageToHp,
        enable3dDice:
          typeof parsed.enable3dDice === 'boolean'
            ? parsed.enable3dDice
            : fallback.enable3dDice,
        diceAppearance: sanitizeDiceAppearance(
          parsed.diceAppearance,
          fallback.diceAppearance
        ),
      };
    } catch {
      return fallback;
    }
  }

  private persistPreferences(next: VttGeneralPreferences): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(VTT_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  }

  updatePreferences(patch: Partial<VttGeneralPreferences>): void {
    const cur = this.preferences();
    const rawVol =
      patch.masterVolume !== undefined && patch.masterVolume !== null
        ? Number(patch.masterVolume)
        : cur.masterVolume;
    const rawSpeed =
      patch.tokenMoveSpeed !== undefined && patch.tokenMoveSpeed !== null
        ? Number(patch.tokenMoveSpeed)
        : cur.tokenMoveSpeed;
    const next: VttGeneralPreferences = {
      masterVolume: Number.isFinite(rawVol)
        ? Math.max(0, Math.min(100, Math.round(rawVol)))
        : cur.masterVolume,
      muteAudio:
        typeof patch.muteAudio === 'boolean' ? patch.muteAudio : cur.muteAudio,
      diceSounds:
        typeof patch.diceSounds === 'boolean' ? patch.diceSounds : cur.diceSounds,
      pingAndTurnSounds:
        typeof patch.pingAndTurnSounds === 'boolean'
          ? patch.pingAndTurnSounds
          : cur.pingAndTurnSounds,
      showHotkeyBadges:
        typeof patch.showHotkeyBadges === 'boolean'
          ? patch.showHotkeyBadges
          : cur.showHotkeyBadges,
      tokenMoveSpeed: Number.isFinite(rawSpeed)
        ? Math.max(0, Math.min(120, Math.round(rawSpeed)))
        : cur.tokenMoveSpeed,
      overflowSpDamageToHp:
        typeof patch.overflowSpDamageToHp === 'boolean'
          ? patch.overflowSpDamageToHp
          : cur.overflowSpDamageToHp,
      enable3dDice:
        typeof patch.enable3dDice === 'boolean'
          ? patch.enable3dDice
          : cur.enable3dDice,
      diceAppearance:
        patch.diceAppearance !== undefined
          ? sanitizeDiceAppearance(patch.diceAppearance, cur.diceAppearance)
          : cur.diceAppearance,
    };
    this.preferences.set(next);
    this.persistPreferences(next);
  }

  updateDiceAppearance(patch: Partial<VttDiceAppearance>): void {
    const cur = this.preferences().diceAppearance;
    const next = sanitizeDiceAppearance(
      {
        ...cur,
        ...patch,
        presetId: patch.presetId ?? 'custom',
      },
      cur
    );
    this.updatePreferences({ diceAppearance: next });
  }

  applyDicePreset(presetId: string): void {
    const found = VTT_DICE_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    this.updatePreferences({
      diceAppearance: {
        presetId: found.id,
        material: found.material,
        bodyColor: found.bodyColor,
        labelColor: found.labelColor,
      },
    });
  }

  resetPreferences(): void {
    const defaults: VttGeneralPreferences = {
      ...DEFAULT_VTT_PREFERENCES,
      diceAppearance: { ...DEFAULT_DICE_APPEARANCE },
    };
    this.preferences.set(defaults);
    this.persistPreferences(defaults);
  }

  playDiceImpactCue(
    intensity = 0.6,
    material: VttDiceMaterial = this.preferences().diceAppearance.material
  ): void {
    const prefs = this.preferences();
    if (prefs.muteAudio || prefs.masterVolume <= 0 || !prefs.diceSounds) return;
    if (typeof window === 'undefined') return;
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }

      const clamped = Math.max(0.08, Math.min(1, intensity));
      const now = ctx.currentTime;
      const gainScale = (prefs.masterVolume / 100) * 0.1 * clamped;
      const jitter = 0.92 + Math.random() * 0.16;

      if (material === 'metal' || material === 'gemstone') {
        this.scheduleTone(ctx, 1180 * jitter, now, 0.042, gainScale, 'triangle');
        this.scheduleTone(
          ctx,
          2120 * jitter,
          now + 0.004,
          0.032,
          gainScale * 0.55,
          'sine'
        );
      } else if (material === 'wood' || material === 'matte') {
        this.scheduleTone(ctx, 290 * jitter, now, 0.035, gainScale * 1.1, 'triangle');
        this.scheduleTone(
          ctx,
          520 * jitter,
          now + 0.005,
          0.024,
          gainScale * 0.5,
          'sine'
        );
      } else {
        this.scheduleTone(ctx, 540 * jitter, now, 0.036, gainScale, 'triangle');
        this.scheduleTone(
          ctx,
          960 * jitter,
          now + 0.004,
          0.026,
          gainScale * 0.55,
          'sine'
        );
      }
    } catch {
      return;
    }
  }

  playUiCue(cue: 'dice' | 'ping' | 'turn'): void {
    const prefs = this.preferences();
    if (prefs.muteAudio || prefs.masterVolume <= 0) return;
    if (cue === 'dice' && !prefs.diceSounds) return;
    if ((cue === 'ping' || cue === 'turn') && !prefs.pingAndTurnSounds) return;

    if (typeof window === 'undefined') return;
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextCtor();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }

      const now = ctx.currentTime;
      const gainScale = (prefs.masterVolume / 100) * 0.14;

      if (cue === 'dice') {
        this.scheduleTone(ctx, 420, now, 0.055, gainScale, 'triangle');
        this.scheduleTone(ctx, 630, now + 0.05, 0.075, gainScale, 'triangle');
      } else if (cue === 'ping') {
        this.scheduleTone(ctx, 784, now, 0.16, gainScale, 'sine');
        this.scheduleTone(ctx, 1046.5, now + 0.06, 0.18, gainScale * 0.8, 'sine');
      } else {
        this.scheduleTone(ctx, 523.25, now, 0.12, gainScale, 'sine');
        this.scheduleTone(ctx, 659.25, now + 0.08, 0.16, gainScale, 'sine');
      }
    } catch {
      return;
    }
  }

  private scheduleTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, peakGain),
      startTime + 0.012
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}
