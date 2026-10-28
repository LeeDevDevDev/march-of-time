import { Component, computed, input } from '@angular/core';
import {
  COMPENDIUM_ICON_PRESETS,
  CompendiumIconPreset,
  isCustomIconUrl,
} from '../../core/compendium/compendium.model';

@Component({
  selector: 'app-compendium-icon',
  standalone: true,
  templateUrl: './compendium-icon.component.html',
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
