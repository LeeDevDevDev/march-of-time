import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { UserAssetModel } from '../../core/assets/user-assets.model';
import { UserAssetsStore } from '../../core/assets/user-assets.store';
import { AssetBrowserModalComponent } from '../asset-browser/asset-browser-modal.component';
import { ColorPickerComponent } from '../color-picker/color-picker.component';
import {
  TOKEN_FRAME_PRESETS,
  TOKEN_RING_COLOR_SWATCHES,
  TokenAppearanceConfig,
  TokenFramePresetId,
  clampTokenOffset,
  clampTokenScale,
  normalizeTokenAppearance,
  resolveTokenRingColor,
  sanitizeOptionalImageUrl,
} from './token-appearance.model';
import { TokenAvatarComponent } from './token-avatar.component';

export type TokenizerAssetSlot = 'portrait' | 'token' | 'frame';

export interface TokenizerVisualsPayload {
  portrait_url: string | null;
  token_image_url: string | null;
  token_appearance: TokenAppearanceConfig;
}

export interface TokenizerAssetPickerRequest {
  slot: TokenizerAssetSlot;
  currentUrl: string | null;
  apply: (url: string) => void;
}

@Component({
  selector: 'app-tokenizer-editor',
  standalone: true,
  imports: [
    TokenAvatarComponent,
    ColorPickerComponent,
    AssetBrowserModalComponent,
  ],
  templateUrl: './tokenizer-editor.component.html',
})
export class TokenizerEditorComponent {
  readonly userAssetsStore = inject(UserAssetsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly stageRef = viewChild<ElementRef<HTMLDivElement>>('tokenStage');

  readonly portraitUrl = input<string | null | undefined>(null);
  readonly tokenImageUrl = input<string | null | undefined>(null);
  readonly tokenAppearance = input<TokenAppearanceConfig | null | undefined>(
    null
  );
  readonly fallbackIcon = input<string | null | undefined>('user');
  readonly fallbackColor = input<string | null | undefined>('#38B29A');
  readonly faction = input<'ally' | 'enemy' | 'neutral'>('ally');
  readonly actorName = input<string>('Actor');
  readonly editable = input<boolean>(true);
  readonly externalAssetPicker = input<boolean>(false);
  readonly floatingAssetPicker = input<boolean>(false);

  readonly visualsChange = output<TokenizerVisualsPayload>();
  readonly requestAssetPicker = output<TokenizerAssetPickerRequest>();

  readonly framePresets = TOKEN_FRAME_PRESETS;
  readonly ringColorSwatches = TOKEN_RING_COLOR_SWATCHES;

  readonly draftAppearance = signal<TokenAppearanceConfig | null>(null);
  readonly isPanning = signal<boolean>(false);
  readonly uploadingSlot = signal<TokenizerAssetSlot | null>(null);
  readonly internalPickerSlot = signal<TokenizerAssetSlot | null>(null);
  readonly portraitLoadErrorUrl = signal<string | null>(null);

  private panStartClientX = 0;
  private panStartClientY = 0;
  private panStartOffsetX = 0;
  private panStartOffsetY = 0;
  private wheelCommitTimer: ReturnType<typeof setTimeout> | null = null;

  readonly cleanPortraitUrl = computed<string | null>(() =>
    sanitizeOptionalImageUrl(this.portraitUrl())
  );

  readonly displayPortraitUrl = computed<string | null>(() => {
    const url = this.cleanPortraitUrl();
    if (!url) return null;
    if (this.portraitLoadErrorUrl() === url) return null;
    return url;
  });

  readonly cleanTokenImageUrl = computed<string | null>(() =>
    sanitizeOptionalImageUrl(this.tokenImageUrl())
  );

  readonly committedAppearance = computed<TokenAppearanceConfig>(() =>
    normalizeTokenAppearance(this.tokenAppearance())
  );

  readonly liveAppearance = computed<TokenAppearanceConfig>(
    () => this.draftAppearance() ?? this.committedAppearance()
  );

  readonly effectiveRingColor = computed<string>(() =>
    resolveTokenRingColor(
      this.liveAppearance(),
      this.fallbackColor(),
      this.faction()
    )
  );

  readonly hasCropAdjustment = computed<boolean>(() => {
    const app = this.liveAppearance();
    return (
      Math.abs(app.scale - 1) > 0.005 ||
      Math.abs(app.offset_x) > 0.05 ||
      Math.abs(app.offset_y) > 0.05
    );
  });

  readonly activeFrameMeta = computed(
    () =>
      this.framePresets.find((p) => p.id === this.liveAppearance().frame) ??
      this.framePresets[0]
  );

  readonly internalPickerCurrentUrl = computed<string | null>(() => {
    const slot = this.internalPickerSlot();
    if (slot === 'portrait') return this.cleanPortraitUrl();
    if (slot === 'token') return this.cleanTokenImageUrl();
    if (slot === 'frame') return this.liveAppearance().custom_frame_url;
    return null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.wheelCommitTimer !== null) {
        clearTimeout(this.wheelCommitTimer);
        this.wheelCommitTimer = null;
      }
    });
  }

  actorInitial(): string {
    const trimmed = (this.actorName() || 'A').trim();
    return (trimmed[0] ?? 'A').toUpperCase();
  }

  onPortraitImageError(): void {
    const current = this.cleanPortraitUrl();
    if (current) {
      this.portraitLoadErrorUrl.set(current);
    }
  }

  openAssetPickerForSlot(slot: TokenizerAssetSlot): void {
    if (!this.editable()) return;
    const currentUrl =
      slot === 'portrait'
        ? this.cleanPortraitUrl()
        : slot === 'token'
          ? this.cleanTokenImageUrl()
          : this.liveAppearance().custom_frame_url;

    if (this.externalAssetPicker()) {
      this.requestAssetPicker.emit({
        slot,
        currentUrl,
        apply: (url: string) => this.applyUrlToSlot(slot, url),
      });
      return;
    }

    this.internalPickerSlot.set(slot);
  }

  closeInternalAssetPicker(): void {
    this.internalPickerSlot.set(null);
  }

  onInternalAssetSelected(asset: UserAssetModel): void {
    const slot = this.internalPickerSlot();
    this.internalPickerSlot.set(null);
    if (!slot) return;
    this.applyUrlToSlot(slot, asset.public_url);
  }

  async onQuickUploadFile(
    slot: TokenizerAssetSlot,
    event: Event
  ): Promise<void> {
    if (!this.editable()) return;
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0] ?? null;
    inputEl.value = '';
    if (!file) return;

    this.uploadingSlot.set(slot);
    try {
      await this.userAssetsStore.ensureLoaded();
      const targetFolder =
        this.userAssetsStore.resolveTargetFolderId('characters');
      const uploaded = await this.userAssetsStore.uploadAssetFile(file, {
        folderId: targetFolder,
        purpose: 'characters',
      });
      if (uploaded) {
        this.applyUrlToSlot(slot, uploaded.public_url);
      }
    } finally {
      if (this.uploadingSlot() === slot) {
        this.uploadingSlot.set(null);
      }
    }
  }

  applyUrlToSlot(slot: TokenizerAssetSlot, rawUrl: string | null): void {
    if (!this.editable()) return;
    const clean = sanitizeOptionalImageUrl(rawUrl);
    if (slot === 'portrait') {
      this.portraitLoadErrorUrl.set(null);
      this.emitVisuals({
        portrait_url: clean,
        token_image_url: this.cleanTokenImageUrl(),
        token_appearance: this.committedAppearance(),
      });
      return;
    }

    if (slot === 'token') {
      const base = this.committedAppearance();
      this.draftAppearance.set(null);
      this.emitVisuals({
        portrait_url: this.cleanPortraitUrl(),
        token_image_url: clean,
        token_appearance: clean
          ? base
          : { ...base, scale: 1, offset_x: 0, offset_y: 0 },
      });
      return;
    }

    const base = this.committedAppearance();
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: this.cleanPortraitUrl(),
      token_image_url: this.cleanTokenImageUrl(),
      token_appearance: {
        ...base,
        frame: clean ? 'custom_png' : base.frame === 'custom_png' ? 'simple' : base.frame,
        custom_frame_url: clean,
      },
    });
  }

  stampTokenFromPortrait(): void {
    if (!this.editable()) return;
    const portrait = this.cleanPortraitUrl();
    if (!portrait) return;
    const base = this.committedAppearance();
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: portrait,
      token_image_url: portrait,
      token_appearance: {
        ...base,
        scale: 1,
        offset_x: 0,
        offset_y: 0,
      },
    });
  }

  selectFramePreset(frame: TokenFramePresetId): void {
    if (!this.editable()) return;
    const base = this.liveAppearance();
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: this.cleanPortraitUrl(),
      token_image_url: this.cleanTokenImageUrl(),
      token_appearance: {
        ...base,
        frame,
      },
    });
  }

  onFrameColorChange(hex: string): void {
    if (!this.editable()) return;
    const base = this.liveAppearance();
    const next = normalizeTokenAppearance({
      ...base,
      frame_color: hex,
    });
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: this.cleanPortraitUrl(),
      token_image_url: this.cleanTokenImageUrl(),
      token_appearance: next,
    });
  }

  clearCustomFrameColor(): void {
    if (!this.editable()) return;
    const base = this.liveAppearance();
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: this.cleanPortraitUrl(),
      token_image_url: this.cleanTokenImageUrl(),
      token_appearance: {
        ...base,
        frame_color: null,
      },
    });
  }

  resetTokenCrop(): void {
    if (!this.editable()) return;
    const base = this.liveAppearance();
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: this.cleanPortraitUrl(),
      token_image_url: this.cleanTokenImageUrl(),
      token_appearance: {
        ...base,
        scale: 1,
        offset_x: 0,
        offset_y: 0,
      },
    });
  }

  onScaleSliderInput(rawValue: string): void {
    if (!this.editable() || !this.cleanTokenImageUrl()) return;
    const scale = clampTokenScale(rawValue);
    const base = this.liveAppearance();
    this.draftAppearance.set({
      ...base,
      scale,
    });
  }

  onScaleSliderCommit(rawValue: string): void {
    if (!this.editable() || !this.cleanTokenImageUrl()) return;
    const scale = clampTokenScale(rawValue);
    const base = this.liveAppearance();
    const next: TokenAppearanceConfig = {
      ...base,
      scale,
    };
    this.draftAppearance.set(null);
    this.emitVisuals({
      portrait_url: this.cleanPortraitUrl(),
      token_image_url: this.cleanTokenImageUrl(),
      token_appearance: next,
    });
  }

  onStagePointerDown(event: PointerEvent): void {
    if (!this.editable() || !this.cleanTokenImageUrl() || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget as HTMLElement | null;
    el?.setPointerCapture?.(event.pointerId);
    const current = this.liveAppearance();
    this.panStartClientX = event.clientX;
    this.panStartClientY = event.clientY;
    this.panStartOffsetX = current.offset_x;
    this.panStartOffsetY = current.offset_y;
    this.isPanning.set(true);
    this.draftAppearance.set({ ...current });
  }

  onStagePointerMove(event: PointerEvent): void {
    if (!this.isPanning()) return;
    event.preventDefault();
    event.stopPropagation();
    const stageEl = this.stageRef()?.nativeElement;
    const diameter = Math.max(64, stageEl?.getBoundingClientRect().width ?? 144);
    const dxPct = ((event.clientX - this.panStartClientX) / diameter) * 100;
    const dyPct = ((event.clientY - this.panStartClientY) / diameter) * 100;
    const base = this.liveAppearance();
    this.draftAppearance.set({
      ...base,
      offset_x: clampTokenOffset(this.panStartOffsetX + dxPct),
      offset_y: clampTokenOffset(this.panStartOffsetY + dyPct),
    });
  }

  onStagePointerUp(event: PointerEvent): void {
    if (!this.isPanning()) return;
    event.stopPropagation();
    const el = event.currentTarget as HTMLElement | null;
    el?.releasePointerCapture?.(event.pointerId);
    this.isPanning.set(false);
    const pending = this.draftAppearance();
    this.draftAppearance.set(null);
    if (pending) {
      this.emitVisuals({
        portrait_url: this.cleanPortraitUrl(),
        token_image_url: this.cleanTokenImageUrl(),
        token_appearance: pending,
      });
    }
  }

  onStageWheel(event: WheelEvent): void {
    if (!this.editable() || !this.cleanTokenImageUrl()) return;
    event.preventDefault();
    event.stopPropagation();
    const current = this.liveAppearance();
    const step = event.deltaY < 0 ? 0.08 : -0.08;
    const next: TokenAppearanceConfig = {
      ...current,
      scale: clampTokenScale(current.scale + step),
    };
    this.draftAppearance.set(next);

    if (this.wheelCommitTimer !== null) {
      clearTimeout(this.wheelCommitTimer);
    }
    this.wheelCommitTimer = setTimeout(() => {
      this.wheelCommitTimer = null;
      const settled = this.draftAppearance();
      this.draftAppearance.set(null);
      if (settled) {
        this.emitVisuals({
          portrait_url: this.cleanPortraitUrl(),
          token_image_url: this.cleanTokenImageUrl(),
          token_appearance: settled,
        });
      }
    }, 180);
  }

  private emitVisuals(payload: TokenizerVisualsPayload): void {
    this.visualsChange.emit({
      portrait_url: sanitizeOptionalImageUrl(payload.portrait_url),
      token_image_url: sanitizeOptionalImageUrl(payload.token_image_url),
      token_appearance: normalizeTokenAppearance(payload.token_appearance),
    });
  }
}
