import { Component, computed, input, signal } from '@angular/core';
import { CompendiumIconComponent } from '../compendium-icon/compendium-icon.component';
import {
  TokenAppearanceConfig,
  TokenFramePresetId,
  buildTokenImagePanZoomTransform,
  normalizeTokenAppearance,
  resolveTokenRingColor,
  sanitizeOptionalImageUrl,
} from './token-appearance.model';

@Component({
  selector: 'app-token-avatar',
  standalone: true,
  imports: [CompendiumIconComponent],
  templateUrl: './token-avatar.component.html',
  host: {
    class: 'inline-block shrink-0 select-none',
    '[class.h-full]': 'sizePx() === null',
    '[class.w-full]': 'sizePx() === null',
    '[style.width.px]': 'sizePx()',
    '[style.height.px]': 'sizePx()',
  },
})
export class TokenAvatarComponent {
  readonly tokenImageUrl = input<string | null | undefined>(null);
  readonly appearance = input<TokenAppearanceConfig | null | undefined>(null);
  readonly icon = input<string | null | undefined>('user');
  readonly color = input<string | null | undefined>(null);
  readonly faction = input<'ally' | 'enemy' | 'neutral'>('ally');
  readonly sizePx = input<number | null>(null);
  readonly iconSizeClass = input<string>('h-1/2 w-1/2');
  readonly artTransform = input<string>('none');
  readonly isHidden = input<boolean>(false);
  readonly grayscale = input<boolean>(false);

  readonly failedImageUrl = signal<string | null>(null);
  readonly failedCustomFrameUrl = signal<string | null>(null);

  readonly cleanImageUrl = computed<string | null>(() => {
    const clean = sanitizeOptionalImageUrl(this.tokenImageUrl());
    if (!clean) return null;
    if (this.failedImageUrl() === clean) return null;
    return clean;
  });

  readonly normalizedAppearance = computed<TokenAppearanceConfig>(() =>
    normalizeTokenAppearance(this.appearance())
  );

  readonly ringColor = computed<string>(() =>
    resolveTokenRingColor(
      this.normalizedAppearance(),
      this.color(),
      this.faction()
    )
  );

  readonly emblemColor = computed<string>(() => {
    const raw = this.color()?.trim();
    return raw && raw.length > 0 ? raw : this.ringColor();
  });

  readonly panZoomTransform = computed<string>(() =>
    buildTokenImagePanZoomTransform(this.normalizedAppearance())
  );

  readonly customFrameUrl = computed<string | null>(() => {
    const clean = this.normalizedAppearance().custom_frame_url;
    if (!clean) return null;
    if (this.failedCustomFrameUrl() === clean) return null;
    return clean;
  });

  readonly effectiveFrame = computed<TokenFramePresetId>(() => {
    const app = this.normalizedAppearance();
    if (app.frame === 'custom_png' && !this.customFrameUrl()) {
      return 'simple';
    }
    return app.frame;
  });

  onTokenImageError(): void {
    const current = sanitizeOptionalImageUrl(this.tokenImageUrl());
    if (current) {
      this.failedImageUrl.set(current);
    }
  }

  onCustomFrameError(): void {
    const current = this.normalizedAppearance().custom_frame_url;
    if (current) {
      this.failedCustomFrameUrl.set(current);
    }
  }
}
