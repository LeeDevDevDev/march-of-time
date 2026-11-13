import { Injectable, computed, signal } from '@angular/core';

export type VttHotkeyAction =
  | 'tool_select'
  | 'tool_ruler'
  | 'tool_pan'
  | 'tool_wall'
  | 'tool_light'
  | 'tool_fog'
  | 'fit_scene'
  | 'undo';

export type VttHotkeyMap = Record<VttHotkeyAction, string>;

export interface VttHotkeyBindingMeta {
  action: VttHotkeyAction;
  label: string;
  description: string;
  defaultCombo: string;
  gmOnly: boolean;
}

export interface VttGeneralPreferences {
  masterVolume: number;
  muteAudio: boolean;
  diceSounds: boolean;
  pingAndTurnSounds: boolean;
  showHotkeyBadges: boolean;
}

export const DEFAULT_VTT_PREFERENCES: VttGeneralPreferences = {
  masterVolume: 70,
  muteAudio: false,
  diceSounds: true,
  pingAndTurnSounds: true,
  showHotkeyBadges: true,
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
    label: 'Fog of War Tool',
    description: 'Open Fog of War and Global Daylight controls.',
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

  const rawKey = (event.key || '').trim().toLowerCase();
  if (!rawKey || MODIFIER_ONLY_KEYS.has(rawKey)) {
    return null;
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

      const rawVol = Number(parsed.masterVolume);
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
      patch.masterVolume !== undefined ? Number(patch.masterVolume) : cur.masterVolume;
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
    };
    this.preferences.set(next);
    this.persistPreferences(next);
  }

  resetPreferences(): void {
    const defaults: VttGeneralPreferences = { ...DEFAULT_VTT_PREFERENCES };
    this.preferences.set(defaults);
    this.persistPreferences(defaults);
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
