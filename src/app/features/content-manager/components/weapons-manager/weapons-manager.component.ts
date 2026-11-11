import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttributeName,
  CombatSkillName,
  ResolvedCompendiumVisuals,
  WeaponModel,
  formatWeaponHookBadges,
  getHeavyWeaponBlockBase,
  isWeaponHeavy,
  isWeaponTwoHanded,
  resolveWeaponVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../../../shared/compendium-icon/icon-picker.component';
import { KeywordTextComponent } from '../../../../shared/keyword-text/keyword-text.component';
import { KeywordTextareaComponent } from '../../../../shared/keyword-text/keyword-textarea.component';

@Component({
  selector: 'app-weapons-manager',
  standalone: true,
  imports: [
    FormsModule,
    CompendiumIconComponent,
    IconPickerComponent,
    KeywordTextComponent,
    KeywordTextareaComponent,
  ],
  templateUrl: './weapons-manager.component.html',
})
export class WeaponsManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);

  readonly requestCreateKeyword = output<string>();
  readonly deleteWeapon = output<WeaponModel>();

  readonly weaponSearch = signal('');
  readonly weaponCategoryFilter = signal('All');
  readonly selectedWeaponId = signal<string | null>(null);

  readonly weaponFilterOptions: { id: string; label: string }[] = [
    { id: 'All', label: 'All Weapons' },
    { id: 'Two-Handed', label: 'Two-Handed' },
    { id: 'Guard', label: 'Guard (Can Block)' },
    { id: 'Heavy', label: 'Heavy' },
    { id: 'Martial', label: 'Martial' },
    { id: 'Light', label: 'Light' },
    { id: 'Ranged', label: 'Ranged' },
  ];

  readonly filteredWeapons = computed(() => {
    const q = this.weaponSearch().trim().toLowerCase();
    const filter = this.weaponCategoryFilter();
    return this.compendiumStore.weapons().filter((w) => {
      if (filter === 'Two-Handed' && !isWeaponTwoHanded(w)) return false;
      if (filter === 'Guard' && !isWeaponHeavy(w)) return false;
      if (
        filter !== 'All' &&
        filter !== 'Two-Handed' &&
        filter !== 'Guard' &&
        w.category.toLowerCase() !== filter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.trait_name.toLowerCase().includes(q) ||
        w.trait_description.toLowerCase().includes(q)
      );
    });
  });

  readonly selectedWeapon = computed(() => {
    const list = this.filteredWeapons();
    const id = this.selectedWeaponId();
    if (id) {
      const found = list.find((w) => w.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  readonly weaponModalOpen = signal(false);
  readonly editingWeaponId = signal<string | null>(null);
  weaponForm: {
    name: string;
    category: string;
    ap_cost: number;
    requires_aim: boolean;
    gov_attribute: AttributeName;
    gov_skill: CombatSkillName;
    base_damage: number;
    reach_tiles: number;
    thrown_range_tiles: number | null;
    trait_name: string;
    trait_description: string;
    two_handed: boolean;
    heavy: boolean;
    heavy_block_base: number;
    parry_roll_bonus: number;
    flawless_parry_bonus_sp_damage: number;
    ignore_armor_dr: number;
    defended_sp_damage: number;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    name: '',
    category: 'Martial',
    ap_cost: 1,
    requires_aim: false,
    gov_attribute: 'Brawn',
    gov_skill: 'Strike',
    base_damage: 4,
    reach_tiles: 1,
    thrown_range_tiles: null,
    trait_name: '',
    trait_description: '',
    two_handed: false,
    heavy: false,
    heavy_block_base: 2,
    parry_roll_bonus: 0,
    flawless_parry_bonus_sp_damage: 0,
    ignore_armor_dr: 0,
    defended_sp_damage: 0,
    icon: 'greatsword',
    icon_color: '#FF8C5A',
    icon_tint_custom: true,
  };

  clearSelectionIfDeleted(weaponId: string): void {
    if (this.selectedWeaponId() === weaponId) {
      this.selectedWeaponId.set(null);
    }
  }

  getWeaponVisuals(w: WeaponModel): ResolvedCompendiumVisuals {
    return resolveWeaponVisuals(w);
  }

  getWeaponBadges(w: WeaponModel): string[] {
    return formatWeaponHookBadges(w);
  }

  isTwoHanded(w: WeaponModel): boolean {
    return isWeaponTwoHanded(w);
  }

  isHeavy(w: WeaponModel): boolean {
    return isWeaponHeavy(w);
  }

  getHeavyBlockBase(w: WeaponModel): number {
    return getHeavyWeaponBlockBase(w);
  }

  openNewWeaponModal(): void {
    this.compendiumStore.clearMessages();
    this.editingWeaponId.set(null);
    this.weaponForm = {
      name: '',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: '',
      trait_description: '',
      two_handed: false,
      heavy: false,
      heavy_block_base: 2,
      parry_roll_bonus: 0,
      flawless_parry_bonus_sp_damage: 0,
      ignore_armor_dr: 0,
      defended_sp_damage: 0,
      icon: 'greatsword',
      icon_color: '#FF8C5A',
      icon_tint_custom: true,
    };
    this.weaponModalOpen.set(true);
  }

  openEditWeaponModal(w: WeaponModel): void {
    this.compendiumStore.clearMessages();
    this.editingWeaponId.set(w.id);
    const visuals = resolveWeaponVisuals(w);
    const hooks = w.rule_hooks ?? {};

    this.weaponForm = {
      name: w.name,
      category: w.category || 'Martial',
      ap_cost: w.ap_cost || 1,
      requires_aim: Boolean(w.requires_aim),
      gov_attribute: w.gov_attribute || 'Brawn',
      gov_skill: w.gov_skill || 'Strike',
      base_damage: w.base_damage ?? 4,
      reach_tiles: w.reach_tiles ?? 1,
      thrown_range_tiles: w.thrown_range_tiles ?? null,
      trait_name: w.trait_name || '',
      trait_description: w.trait_description || '',
      two_handed: isWeaponTwoHanded(w),
      heavy: isWeaponHeavy(w),
      heavy_block_base: getHeavyWeaponBlockBase(w) || 2,
      parry_roll_bonus: Number(hooks['parry_roll_bonus'] ?? 0),
      flawless_parry_bonus_sp_damage: Number(
        hooks['flawless_parry_bonus_sp_damage'] ?? 0
      ),
      ignore_armor_dr: Number(hooks['ignore_armor_dr'] ?? 0),
      defended_sp_damage: Number(hooks['defended_sp_damage'] ?? 0),
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };
    this.weaponModalOpen.set(true);
  }

  closeWeaponModal(): void {
    this.weaponModalOpen.set(false);
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeWeaponModal();
    }
  }

  async saveWeapon(): Promise<void> {
    const editId = this.editingWeaponId();
    const existing = editId
      ? this.compendiumStore.weapons().find((w) => w.id === editId)
      : null;

    const compiledHooks: Record<string, unknown> = {
      ...(existing?.rule_hooks ?? {}),
      two_handed: this.weaponForm.two_handed,
      guard: this.weaponForm.heavy,
      guard_block_base: this.weaponForm.heavy
        ? Math.max(1, Number(this.weaponForm.heavy_block_base) || 2)
        : undefined,
      heavy: this.weaponForm.heavy,
      heavy_block_base: this.weaponForm.heavy
        ? Math.max(1, Number(this.weaponForm.heavy_block_base) || 2)
        : undefined,
      parry_roll_bonus:
        Number(this.weaponForm.parry_roll_bonus) > 0
          ? Number(this.weaponForm.parry_roll_bonus)
          : undefined,
      flawless_parry_bonus_sp_damage:
        Number(this.weaponForm.flawless_parry_bonus_sp_damage) > 0
          ? Number(this.weaponForm.flawless_parry_bonus_sp_damage)
          : undefined,
      ignore_armor_dr:
        Number(this.weaponForm.ignore_armor_dr) > 0
          ? Number(this.weaponForm.ignore_armor_dr)
          : undefined,
      defended_sp_damage:
        Number(this.weaponForm.defended_sp_damage) > 0
          ? Number(this.weaponForm.defended_sp_damage)
          : undefined,
      __icon: this.weaponForm.icon,
      __icon_color: this.weaponForm.icon_color,
      __icon_tint_custom: this.weaponForm.icon_tint_custom,
    };

    const payload: Omit<WeaponModel, 'id' | 'slug'> = {
      name: this.weaponForm.name,
      category: this.weaponForm.category,
      ap_cost: Number(this.weaponForm.ap_cost) || 1,
      requires_aim: false,
      gov_attribute: this.weaponForm.gov_attribute,
      gov_skill: this.weaponForm.gov_skill,
      base_damage: Number(this.weaponForm.base_damage) || 3,
      reach_tiles: Number(this.weaponForm.reach_tiles) || 1,
      thrown_range_tiles:
        this.weaponForm.thrown_range_tiles &&
        Number(this.weaponForm.thrown_range_tiles) > 0
          ? Number(this.weaponForm.thrown_range_tiles)
          : null,
      trait_name: this.weaponForm.trait_name,
      trait_description: this.weaponForm.trait_description,
      rule_hooks: compiledHooks,
    };

    if (editId) {
      const ok = await this.compendiumStore.updateWeapon(editId, payload);
      if (ok) {
        this.selectedWeaponId.set(editId);
        this.closeWeaponModal();
      }
    } else {
      const created = await this.compendiumStore.createWeapon(payload);
      if (created) {
        this.selectedWeaponId.set(created.id);
        this.closeWeaponModal();
      }
    }
  }
}
