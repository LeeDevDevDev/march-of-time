import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ARMOR_WEIGHT_OPTIONS,
  ArmorModel,
  ArmorWeightClass,
  ResolvedCompendiumVisuals,
  resolveArmorVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../../../shared/compendium-icon/icon-picker.component';
import { KeywordTextComponent } from '../../../../shared/keyword-text/keyword-text.component';
import { KeywordTextareaComponent } from '../../../../shared/keyword-text/keyword-textarea.component';

@Component({
  selector: 'app-armors-manager',
  standalone: true,
  imports: [
    FormsModule,
    CompendiumIconComponent,
    IconPickerComponent,
    KeywordTextComponent,
    KeywordTextareaComponent,
  ],
  templateUrl: './armors-manager.component.html',
})
export class ArmorsManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);

  readonly requestCreateKeyword = output<string>();
  readonly deleteArmor = output<ArmorModel>();

  readonly weightOptions = ARMOR_WEIGHT_OPTIONS;
  readonly armorSearch = signal('');
  readonly armorFilter = signal<'All' | ArmorWeightClass | 'Dodge'>('All');
  readonly selectedArmorId = signal<string | null>(null);

  readonly filterOptions: {
    id: 'All' | ArmorWeightClass | 'Dodge';
    label: string;
  }[] = [
    { id: 'All', label: 'All Armors' },
    { id: 'Light', label: 'Light' },
    { id: 'Medium', label: 'Medium' },
    { id: 'Heavy', label: 'Heavy' },
    { id: 'Dodge', label: 'Allows Dodge' },
  ];

  readonly filteredArmors = computed(() => {
    const q = this.armorSearch().trim().toLowerCase();
    const filter = this.armorFilter();
    return this.compendiumStore.armors().filter((a) => {
      if (filter === 'Dodge' && !a.allows_dodge) return false;
      if (
        filter !== 'All' &&
        filter !== 'Dodge' &&
        a.weight_class !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.weight_class.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly selectedArmor = computed(() => {
    const list = this.filteredArmors();
    const id = this.selectedArmorId();
    if (id) {
      const found = list.find((a) => a.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  readonly armorModalOpen = signal(false);
  readonly editingArmorId = signal<string | null>(null);

  armorForm: {
    name: string;
    weight_class: ArmorWeightClass;
    armor_sp: number;
    armor_dr: number;
    allows_dodge: boolean;
    speed_penalty_feet: number;
    description: string;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    name: '',
    weight_class: 'Light',
    armor_sp: 2,
    armor_dr: 1,
    allows_dodge: true,
    speed_penalty_feet: 0,
    description: '',
    icon: 'breastplate',
    icon_color: '#38B29A',
    icon_tint_custom: true,
  };

  clearSelectionIfDeleted(armorId: string): void {
    if (this.selectedArmorId() === armorId) {
      this.selectedArmorId.set(null);
    }
  }

  getArmorVisuals(a: ArmorModel): ResolvedCompendiumVisuals {
    return resolveArmorVisuals(a);
  }

  onWeightClassChange(weight: ArmorWeightClass): void {
    this.armorForm.weight_class = weight;
    if (weight === 'Heavy') {
      this.armorForm.allows_dodge = false;
    } else {
      this.armorForm.allows_dodge = true;
    }
  }

  openNewArmorModal(): void {
    this.compendiumStore.clearMessages();
    this.editingArmorId.set(null);
    this.armorForm = {
      name: '',
      weight_class: 'Light',
      armor_sp: 2,
      armor_dr: 1,
      allows_dodge: true,
      speed_penalty_feet: 0,
      description: '',
      icon: 'breastplate',
      icon_color: '#38B29A',
      icon_tint_custom: true,
    };
    this.armorModalOpen.set(true);
  }

  openEditArmorModal(armor: ArmorModel): void {
    this.compendiumStore.clearMessages();
    this.editingArmorId.set(armor.id);
    const visuals = resolveArmorVisuals(armor);
    this.armorForm = {
      name: armor.name,
      weight_class: armor.weight_class || 'Light',
      armor_sp: armor.armor_sp ?? 0,
      armor_dr: armor.armor_dr ?? 0,
      allows_dodge: Boolean(armor.allows_dodge),
      speed_penalty_feet: Math.max(
        0,
        Math.round((armor.speed_penalty_tiles || 0) * 5)
      ),
      description: armor.description || '',
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };
    this.armorModalOpen.set(true);
  }

  closeArmorModal(): void {
    this.armorModalOpen.set(false);
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeArmorModal();
    }
  }

  async saveArmor(): Promise<void> {
    const editId = this.editingArmorId();
    const existing = editId
      ? this.compendiumStore.armors().find((a) => a.id === editId)
      : null;

    const compiledHooks: Record<string, unknown> = {
      ...(existing?.rule_hooks ?? {}),
      __icon: this.armorForm.icon,
      __icon_color: this.armorForm.icon_color,
      __icon_tint_custom: this.armorForm.icon_tint_custom,
    };

    const payload: Omit<ArmorModel, 'id' | 'slug'> = {
      name: this.armorForm.name,
      weight_class: this.armorForm.weight_class,
      armor_sp: Math.max(0, Math.round(Number(this.armorForm.armor_sp) || 0)),
      armor_dr: Math.max(0, Math.round(Number(this.armorForm.armor_dr) || 0)),
      allows_dodge: Boolean(this.armorForm.allows_dodge),
      speed_penalty_tiles: Math.max(
        0,
        Math.round((Number(this.armorForm.speed_penalty_feet) || 0) / 5)
      ),
      description: this.armorForm.description,
      rule_hooks: compiledHooks,
    };

    if (editId) {
      const ok = await this.compendiumStore.updateArmor(editId, payload);
      if (ok) {
        this.selectedArmorId.set(editId);
        this.closeArmorModal();
      }
      return;
    }

    const created = await this.compendiumStore.createArmor(payload);
    if (created) {
      this.selectedArmorId.set(created.id);
      this.closeArmorModal();
    }
  }
}
