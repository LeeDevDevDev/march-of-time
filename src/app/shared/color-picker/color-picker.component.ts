import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

function clampUnit(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isValidHexColor(raw: string): boolean {
  const trimmed = (raw ?? '').trim();
  return /^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed);
}

export function normalizeHexColor(raw: string, fallback = '#C4491A'): string {
  const trimmed = (raw ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[0];
    const g = trimmed[1];
    const b = trimmed[2];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`.toUpperCase();
  }
  return fallback.toUpperCase();
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(clampUnit(n, 0, 255))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = normalizeHexColor(hex).slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  const v = max;
  const s = max === 0 ? 0 : d / max;

  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / d + 2) * 60;
    } else {
      h = ((r - g) / d + 4) * 60;
    }
  }

  return {
    h: ((h % 360) + 360) % 360,
    s: clampUnit(s, 0, 1),
    v: clampUnit(v, 0, 1),
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampUnit(s, 0, 1);
  const val = clampUnit(v, 0, 1);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) {
    r1 = c;
    g1 = x;
  } else if (hue < 120) {
    r1 = x;
    g1 = c;
  } else if (hue < 180) {
    g1 = c;
    b1 = x;
  } else if (hue < 240) {
    g1 = x;
    b1 = c;
  } else if (hue < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './color-picker.component.html',
})
export class ColorPickerComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly svAreaRef = viewChild<ElementRef<HTMLDivElement>>('svArea');
  readonly hueAreaRef = viewChild<ElementRef<HTMLDivElement>>('hueArea');

  readonly color = input<string>('#C4491A');
  readonly presets = input<string[]>([]);
  readonly mode = input<'inline' | 'popover'>('inline');
  readonly surfaceTheme = input<'adaptive' | 'dark'>('adaptive');
  readonly popoverAlign = input<'left' | 'right'>('left');

  readonly colorChange = output<string>();

  readonly hue = signal<number>(17);
  readonly sat = signal<number>(0.87);
  readonly val = signal<number>(0.77);
  readonly hexDraft = signal<string>('#C4491A');
  readonly isEditingHex = signal<boolean>(false);
  readonly popoverOpen = signal<boolean>(false);
  readonly draggingSv = signal<boolean>(false);
  readonly draggingHue = signal<boolean>(false);

  readonly normalizedColor = computed<string>(() =>
    normalizeHexColor(this.color())
  );

  readonly pureHueHex = computed<string>(() => hsvToHex(this.hue(), 1, 1));
  readonly svThumbLeftPct = computed<number>(() => this.sat() * 100);
  readonly svThumbTopPct = computed<number>(() => (1 - this.val()) * 100);
  readonly hueThumbLeftPct = computed<number>(() => (this.hue() / 360) * 100);

  constructor() {
    effect(() => {
      const incoming = normalizeHexColor(this.color());
      const currentFromHsv = hsvToHex(this.hue(), this.sat(), this.val());
      if (incoming !== currentFromHsv) {
        const parsed = hexToHsv(incoming);
        if (parsed.s > 0.002) {
          this.hue.set(parsed.h);
        }
        this.sat.set(parsed.s);
        this.val.set(parsed.v);
      }
      if (!this.isEditingHex()) {
        this.hexDraft.set(incoming);
      }
    });
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.popoverOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.hostEl.nativeElement.contains(target)) {
      this.popoverOpen.set(false);
    }
  }

  togglePopover(): void {
    this.popoverOpen.update((open) => !open);
  }

  closePopover(): void {
    this.popoverOpen.set(false);
  }

  isPresetSelected(swatch: string): boolean {
    return normalizeHexColor(swatch) === this.normalizedColor();
  }

  selectPreset(swatch: string): void {
    const hex = normalizeHexColor(swatch);
    const parsed = hexToHsv(hex);
    if (parsed.s > 0.002) {
      this.hue.set(parsed.h);
    }
    this.sat.set(parsed.s);
    this.val.set(parsed.v);
    this.hexDraft.set(hex);
    this.colorChange.emit(hex);
  }

  onSvPointerDown(event: PointerEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
    this.draggingSv.set(true);
    this.applySvFromPointer(event);
  }

  onSvPointerMove(event: PointerEvent): void {
    if (!this.draggingSv()) return;
    event.preventDefault();
    this.applySvFromPointer(event);
  }

  onSvPointerUp(event: PointerEvent): void {
    if (!this.draggingSv()) return;
    const target = event.currentTarget as HTMLElement | null;
    target?.releasePointerCapture?.(event.pointerId);
    this.draggingSv.set(false);
  }

  private applySvFromPointer(event: PointerEvent): void {
    const el = this.svAreaRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clampUnit(
      (event.clientX - rect.left) / Math.max(1, rect.width),
      0,
      1
    );
    const v = clampUnit(
      1 - (event.clientY - rect.top) / Math.max(1, rect.height),
      0,
      1
    );
    this.sat.set(s);
    this.val.set(v);
    const hex = hsvToHex(this.hue(), s, v);
    this.hexDraft.set(hex);
    this.colorChange.emit(hex);
  }

  onHuePointerDown(event: PointerEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
    this.draggingHue.set(true);
    this.applyHueFromPointer(event);
  }

  onHuePointerMove(event: PointerEvent): void {
    if (!this.draggingHue()) return;
    event.preventDefault();
    this.applyHueFromPointer(event);
  }

  onHuePointerUp(event: PointerEvent): void {
    if (!this.draggingHue()) return;
    const target = event.currentTarget as HTMLElement | null;
    target?.releasePointerCapture?.(event.pointerId);
    this.draggingHue.set(false);
  }

  private applyHueFromPointer(event: PointerEvent): void {
    const el = this.hueAreaRef()?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = clampUnit(
      (event.clientX - rect.left) / Math.max(1, rect.width),
      0,
      1
    );
    const nextHue = ratio * 359.99;
    this.hue.set(nextHue);
    if (this.sat() < 0.02 && this.val() > 0.98) {
      this.sat.set(0.75);
    } else if (this.val() < 0.02) {
      this.val.set(0.75);
      if (this.sat() < 0.02) {
        this.sat.set(0.75);
      }
    }
    const hex = hsvToHex(nextHue, this.sat(), this.val());
    this.hexDraft.set(hex);
    this.colorChange.emit(hex);
  }

  onHueKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? 15 : 5;
    const delta = event.key === 'ArrowRight' ? step : -step;
    const nextHue = (((this.hue() + delta) % 360) + 360) % 360;
    this.hue.set(nextHue);
    const hex = hsvToHex(nextHue, this.sat(), this.val());
    this.hexDraft.set(hex);
    this.colorChange.emit(hex);
  }

  onHexFocus(): void {
    this.isEditingHex.set(true);
  }

  onHexInput(raw: string): void {
    this.hexDraft.set(raw);
    const trimmed = (raw ?? '').trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
      const hex = normalizeHexColor(trimmed);
      const parsed = hexToHsv(hex);
      if (parsed.s > 0.002) {
        this.hue.set(parsed.h);
      }
      this.sat.set(parsed.s);
      this.val.set(parsed.v);
      this.colorChange.emit(hex);
    }
  }

  commitHexDraft(): void {
    this.isEditingHex.set(false);
    const raw = this.hexDraft();
    if (isValidHexColor(raw)) {
      const hex = normalizeHexColor(raw, this.normalizedColor());
      const parsed = hexToHsv(hex);
      if (parsed.s > 0.002) {
        this.hue.set(parsed.h);
      }
      this.sat.set(parsed.s);
      this.val.set(parsed.v);
      this.hexDraft.set(hex);
      this.colorChange.emit(hex);
    } else {
      this.hexDraft.set(this.normalizedColor());
    }
  }

  onNativeColorChange(raw: string): void {
    if (!isValidHexColor(raw)) return;
    this.selectPreset(raw);
  }
}
