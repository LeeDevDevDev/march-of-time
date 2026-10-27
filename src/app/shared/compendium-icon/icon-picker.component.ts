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
  template: `
    <div
      class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 space-y-4"
    >
      <!-- Top Bar: Live Preview Medallion + Mode Switcher -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3.5">
          <!-- Live Medallion Preview -->
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center border-2 bg-[#122220] transition-all"
            [class.rounded-2xl]="shape() === 'square'"
            [class.rounded-full]="shape() === 'circle'"
            [style.border-color]="color()"
          >
            <app-compendium-icon
              [icon]="icon()"
              [color]="color()"
              [tintCustom]="tintCustom()"
              sizeClass="h-7 w-7"
            />
          </div>

          <div>
            <h3 class="font-display text-sm font-bold text-[var(--mot-text)]">
              {{ label() }}
            </h3>
            <p class="text-xs text-[var(--mot-muted)]">
              Choose a premade vector crest, upload your own SVG/PNG, and customize its color.
            </p>
          </div>
        </div>

        <!-- Premade vs Upload Tab Switcher -->
        <div class="flex items-center rounded-lg border border-[#243B37] bg-[#0D1615] p-1">
          <button
            type="button"
            (click)="activeTab.set('premade')"
            class="rounded-md px-3 py-1 text-xs font-bold transition-colors"
            [class.bg-[#C4491A]]="activeTab() === 'premade'"
            [class.text-white]="activeTab() === 'premade'"
            [class.text-[#8AB0AB]]="activeTab() !== 'premade'"
          >
            Premade Icons ({{ presets.length }})
          </button>
          <button
            type="button"
            (click)="activeTab.set('upload')"
            class="rounded-md px-3 py-1 text-xs font-bold transition-colors"
            [class.bg-[#C4491A]]="activeTab() === 'upload'"
            [class.text-white]="activeTab() === 'upload'"
            [class.text-[#8AB0AB]]="activeTab() !== 'upload'"
          >
            Upload Custom
          </button>
        </div>
      </div>

      <!-- TAB 1: PREMADE RPG VECTOR ICONS -->
      @if (activeTab() === 'premade') {
        <div class="grid grid-cols-4 gap-2 sm:grid-cols-8">
          @for (preset of presets; track preset.id) {
            <button
              type="button"
              (click)="selectPreset(preset.id)"
              [title]="preset.label"
              class="group flex flex-col items-center justify-center gap-1 rounded-xl border p-2 transition-all"
              [class.border-[#C4491A]]="icon() === preset.id"
              [class.bg-[#122220]]="icon() === preset.id"
              [class.border-[var(--mot-border)]]="icon() !== preset.id"
              [class.bg-[var(--mot-surface)]]="icon() !== preset.id"
              [class.hover:border-[#C4491A]]="icon() !== preset.id"
            >
              <app-compendium-icon
                [icon]="preset.id"
                [color]="icon() === preset.id ? color() : 'var(--mot-text)'"
                sizeClass="h-5 w-5"
              />
              <span
                class="w-full truncate text-center font-mono-num text-[10px]"
                [class.text-white]="icon() === preset.id"
                [class.font-bold]="icon() === preset.id"
                [class.text-[var(--mot-muted)]]="icon() !== preset.id"
              >
                {{ preset.label }}
              </span>
            </button>
          }
        </div>
      }

      <!-- TAB 2: UPLOAD CUSTOM SVG / PNG / WEBP ICON -->
      @if (activeTab() === 'upload') {
        <div
          class="rounded-xl border border-dashed border-[var(--mot-border)] bg-[var(--mot-surface)] p-4 space-y-3"
        >
          <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p class="text-xs font-bold text-[var(--mot-text)]">
                Upload Custom SVG, PNG, or WebP Icon
              </p>
              <p class="mt-0.5 text-[11px] text-[var(--mot-muted)]">
                Transparent SVGs or PNG silhouettes can automatically change color using the palette below.
              </p>
            </div>

            <label
              class="btn-copper inline-flex cursor-pointer items-center justify-center rounded-lg px-3.5 py-2 text-xs font-semibold"
              [class.opacity-60]="isUploading()"
            >
              <span>{{ isUploading() ? 'Uploading to Storage...' : 'Choose Icon File...' }}</span>
              <input
                type="file"
                accept=".svg,image/svg+xml,image/png,image/webp,image/jpeg"
                class="hidden"
                [disabled]="isUploading()"
                (change)="onFileSelected($event)"
              />
            </label>
          </div>

          @if (uploadStatus()) {
            <p class="font-mono-num text-[11px] font-semibold text-[var(--mot-sp-text)]">
              {{ uploadStatus() }}
            </p>
          }

          @if (uploadError()) {
            <p class="text-xs font-semibold text-[var(--mot-hp-text)]">
              {{ uploadError() }}
            </p>
          }

          @if (isCustomUpload()) {
            <div
              class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3 py-2"
            >
              <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--mot-text)]">
                <input
                  type="checkbox"
                  [ngModel]="tintCustom()"
                  (ngModelChange)="tintCustomChange.emit($event)"
                  class="h-4 w-4 accent-[#C4491A]"
                />
                <span>Tint uploaded icon with selected Accent Color</span>
              </label>

              <button
                type="button"
                (click)="selectPreset('greatsword')"
                class="text-xs font-bold text-[var(--mot-hp-text)] hover:underline"
              >
                Reset to Premade
              </button>
            </div>
          }
        </div>
      }

      <!-- COLOR PALETTE & CUSTOM HEX PICKER -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mot-border)] pt-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-bold text-[var(--mot-text)]">
            Icon &amp; Medallion Color:
          </span>

          @for (swatch of colorPresets; track swatch.hex) {
            <button
              type="button"
              (click)="selectColor(swatch.hex)"
              [title]="swatch.label + ' (' + swatch.hex + ')'"
              class="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              [style.background-color]="swatch.hex"
              [class.border-white]="color().toLowerCase() === swatch.hex.toLowerCase()"
              [class.ring-2]="color().toLowerCase() === swatch.hex.toLowerCase()"
              [class.ring-[#C4491A]]="color().toLowerCase() === swatch.hex.toLowerCase()"
              [class.border-transparent]="color().toLowerCase() !== swatch.hex.toLowerCase()"
            ></button>
          }
        </div>

        <!-- Custom Color Input + Hex Readout -->
        <div class="flex items-center gap-2">
          <label
            class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2.5 py-1 text-xs font-mono-num font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
          >
            <input
              type="color"
              [ngModel]="color()"
              (ngModelChange)="selectColor($event)"
              class="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
            />
            <span>{{ color().toUpperCase() }}</span>
          </label>
        </div>
      </div>
    </div>
  `,
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
