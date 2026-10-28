import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  COMPENDIUM_COLOR_PRESETS,
  COMPENDIUM_ICON_PRESETS,
  isCustomIconUrl,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { CompendiumIconComponent } from './compendium-icon.component';

@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [FormsModule, CompendiumIconComponent],
  templateUrl: './icon-picker.component.html',
})
export class IconPickerComponent {
  private readonly compendiumStore = inject(CompendiumStore);

  readonly presets = COMPENDIUM_ICON_PRESETS;
  readonly colorPresets = COMPENDIUM_COLOR_PRESETS;

  readonly label = input<string>('Icon & Color Style');
  readonly icon = input<string>('greatsword');
  readonly color = input<string>('#FF8C5A');
  readonly tintCustom = input<boolean>(true);
  readonly shape = input<'square' | 'circle'>('square');

  readonly iconChange = output<string>();
  readonly colorChange = output<string>();
  readonly tintCustomChange = output<boolean>();

  readonly activeTab = signal<'premade' | 'upload'>('premade');
  readonly isUploading = signal(false);
  readonly uploadStatus = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);

  readonly isCustomUpload = computed(() => isCustomIconUrl(this.icon()));

  selectPreset(presetId: string): void {
    this.uploadError.set(null);
    this.uploadStatus.set(null);
    this.iconChange.emit(presetId);
  }

  selectColor(hex: string): void {
    if (!hex) return;
    this.colorChange.emit(hex);
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;

    this.uploadError.set(null);
    this.uploadStatus.set(null);

    if (file.size > 2 * 1024 * 1024) {
      this.uploadError.set('Please choose an icon file smaller than 2 MB.');
      return;
    }

    // If SVG, read fallback Data URL and upload original SVG to Supabase Storage bucket
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = (reader.result as string) || '';
        await this.uploadAndEmit(file, dataUrl);
      };
      reader.onerror = () => {
        this.uploadError.set('Could not read the SVG file.');
      };
      reader.readAsDataURL(file);
      return;
    }

    // For PNG / WebP / JPEG, resize cleanly onto a 128x128 canvas and upload to Supabase Storage
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const maxDim = 128;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          await this.uploadAndEmit(file, (reader.result as string) || '');
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/png');

        // Convert the 128x128 canvas to a compact PNG File for Supabase Storage
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        );
        const uploadFile = blob
          ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', {
              type: 'image/png',
            })
          : file;

        await this.uploadAndEmit(uploadFile, compressedDataUrl);
      };
      img.onerror = () => {
        this.uploadError.set('Could not decode the selected image file.');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  private async uploadAndEmit(file: File, fallbackDataUrl: string): Promise<void> {
    this.isUploading.set(true);
    try {
      const result = await this.compendiumStore.uploadCompendiumIcon(
        file,
        fallbackDataUrl
      );
      this.iconChange.emit(result.url);
      this.uploadStatus.set(
        result.storedInBucket
          ? 'Uploaded to Supabase Storage (compendium-icons).'
          : 'Loaded icon (run 0007_tree_and_node_icons.sql to enable Supabase Storage CDN).'
      );
    } finally {
      this.isUploading.set(false);
    }
  }
}
