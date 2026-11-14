import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { VttSettingsStore } from '../../../../core/settings/vtt-settings.store';
import { VttDiceThrowPayload } from '../../engine/dice-roller.engine';
import type { Dice3dStage } from '../../engine/dice-3d.engine';
import { VttStore } from '../../store/vtt.store';

@Component({
  selector: 'app-vtt-dice-overlay',
  host: {
    class: 'pointer-events-none fixed inset-0 z-[60] overflow-hidden select-none',
    '(window:resize)': 'onWindowResize()',
  },
  template: `
    <canvas
      #diceCanvas
      class="pointer-events-none block h-full w-full transition-opacity duration-150"
      [style.opacity]="canvasOpacity()"
    ></canvas>

    @if (activeBanner(); as banner) {
      <div
        class="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 transition-opacity duration-200"
        [style.opacity]="canvasOpacity()"
      >
        <div
          class="flex items-center gap-2.5 rounded-full border border-[#243B37] bg-[#0D1615]/92 px-4 py-1.5 text-xs text-[#EBF5F3] shadow-2xl backdrop-blur-xs"
        >
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full border border-white/25"
            [style.backgroundColor]="banner.appearance.bodyColor"
          ></span>
          <span class="font-bold text-white">{{ banner.senderName }}</span>
          <span class="text-[#8AB0AB]">&middot;</span>
          <span class="font-mono-num text-[#8AB0AB]">{{ banner.formula || banner.label }}</span>
          @if (showBannerTotal()) {
            <span class="rounded-md bg-[#C4491A] px-2 py-0.5 font-mono-num text-xs font-bold text-white">
              {{ banner.total }}
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class VttDiceOverlayComponent implements AfterViewInit, OnDestroy {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly vttStore = inject(VttStore);
  private readonly settingsStore = inject(VttSettingsStore);

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('diceCanvas');

  readonly canvasOpacity = signal<number>(0);
  readonly activeBanner = signal<VttDiceThrowPayload | null>(null);
  readonly showBannerTotal = signal<boolean>(false);

  private stage: Dice3dStage | null = null;
  private stageLoading: Promise<Dice3dStage | null> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastPlayedThrowId: string | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      const enabled = this.settingsStore.preferences().enable3dDice;
      const incoming = this.vttStore.latestDiceThrow();

      if (!enabled) {
        this.clearCurrentPresentation();
        return;
      }

      if (!incoming || incoming.id === this.lastPlayedThrowId) {
        return;
      }

      this.lastPlayedThrowId = incoming.id;
      void this.launchThrow(incoming);
    });
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.syncCanvasSize();
      });
      this.resizeObserver.observe(this.hostEl.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.stage?.dispose();
    this.stage = null;
  }

  onWindowResize(): void {
    this.syncCanvasSize();
  }

  private isWebGlSupportedEnvironment(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }
    if (
      typeof navigator !== 'undefined' &&
      /jsdom/i.test(navigator.userAgent || '')
    ) {
      return false;
    }
    try {
      const probe = document.createElement('canvas');
      const ctx =
        probe.getContext('webgl2') ||
        probe.getContext('webgl') ||
        probe.getContext('experimental-webgl');
      return Boolean(ctx);
    } catch {
      return false;
    }
  }

  private async ensureStage(): Promise<Dice3dStage | null> {
    if (this.stage) return this.stage;
    if (this.stageLoading) return this.stageLoading;
    if (this.destroyed || !this.isWebGlSupportedEnvironment()) {
      return null;
    }

    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return null;

    this.stageLoading = import('../../engine/dice-3d.engine')
      .then((mod) => {
        if (this.destroyed) return null;
        const created = new mod.Dice3dStage(canvas, {
          onImpactSound: (intensity, material) => {
            this.settingsStore.playDiceImpactCue(intensity, material);
          },
          onFadeChange: (opacity) => {
            this.canvasOpacity.set(opacity);
          },
          onThrowComplete: () => {
            this.canvasOpacity.set(0);
            this.activeBanner.set(null);
            this.showBannerTotal.set(false);
          },
        });
        this.stage = created;
        this.syncCanvasSize();
        return created;
      })
      .catch(() => null);

    return this.stageLoading;
  }

  private syncCanvasSize(): void {
    if (!this.stage) return;
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const w =
      rect.width > 0
        ? rect.width
        : typeof window !== 'undefined'
          ? window.innerWidth
          : 1280;
    const h =
      rect.height > 0
        ? rect.height
        : typeof window !== 'undefined'
          ? window.innerHeight
          : 720;
    this.stage.resize(w, h);
  }

  private async launchThrow(payload: VttDiceThrowPayload): Promise<void> {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }

    const stage = await this.ensureStage();
    if (!stage || this.destroyed) return;

    this.syncCanvasSize();
    this.activeBanner.set(payload);
    this.showBannerTotal.set(false);
    this.canvasOpacity.set(1);

    stage.playThrow(payload);

    this.revealTimer = setTimeout(() => {
      this.showBannerTotal.set(true);
    }, 950);
  }

  private clearCurrentPresentation(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    this.stage?.clear();
    this.canvasOpacity.set(0);
    this.activeBanner.set(null);
    this.showBannerTotal.set(false);
  }
}
