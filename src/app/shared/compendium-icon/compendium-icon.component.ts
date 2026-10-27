import { Component, computed, input } from '@angular/core';
import {
  COMPENDIUM_ICON_PRESETS,
  CompendiumIconPreset,
  isCustomIconUrl,
} from '../../core/compendium/compendium.model';

@Component({
  selector: 'app-compendium-icon',
  standalone: true,
  template: `
    @if (isCustomUpload()) {
      @if (tintCustom()) {
        <span
          class="inline-block shrink-0 transition-colors"
          [class]="sizeClass()"
          [style.background-color]="color()"
          [style.-webkit-mask-image]="maskUrl()"
          [style.mask-image]="maskUrl()"
          style="-webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center;"
        ></span>
      } @else {
        <img
          [src]="icon()"
          alt=""
          class="inline-block shrink-0 object-contain"
          [class]="sizeClass()"
        />
      }
    } @else {
      <svg
        [class]="sizeClass()"
        [style.color]="color()"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        @for (d of activePreset().paths; track d) {
          <path [attr.d]="d" />
        }
      </svg>
    }
  `,
})
export class CompendiumIconComponent {
  readonly icon = input<string | null | undefined>('greatsword');
  readonly color = input<string>('currentColor');
  readonly tintCustom = input<boolean>(true);
  readonly sizeClass = input<string>('h-6 w-6');

  readonly isCustomUpload = computed(() => isCustomIconUrl(this.icon()));

  readonly maskUrl = computed(() => {
    const raw = this.icon()?.trim() ?? '';
    return `url("${raw}")`;
  });

  readonly activePreset = computed<CompendiumIconPreset>(() => {
    const id = (this.icon() ?? 'greatsword').trim().toLowerCase();
    return (
      COMPENDIUM_ICON_PRESETS.find((p) => p.id === id) ?? COMPENDIUM_ICON_PRESETS[0]
    );
  });
}
