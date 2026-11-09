import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ResolvedCompendiumVisuals,
  getTreeArchetypeIcon,
  resolveNodeVisuals,
  resolveTreeVisuals,
} from '../../core/compendium/compendium.model';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { SkillTreeCanvasComponent } from '../../shared/skill-tree-canvas/skill-tree-canvas.component';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  ArmorTier,
  AttributeName,
  COMBAT_SKILL_LIST,
  CombatSkillName,
  FIELD_SKILL_LIST,
  FieldSkillName,
  PerkNodeModel,
  SHIELD_TIERS,
  ShieldTier,
  SkillTreeModel,
  WeaponModel,
  computeDerivedStats,
  getHeavyWeaponBlockBase,
  getWeaponPropertyTags,
  isWeaponHeavy,
  isWeaponTwoHanded,
} from './models/character.model';
import { CharacterStore } from './store/character.store';

type CreatorStep = 1 | 2 | 3 | 4 | 5;

@Component({
  selector: 'app-character-creator',
  standalone: true,
  imports: [FormsModule, RouterLink, SkillTreeCanvasComponent, CompendiumIconComponent],
  templateUrl: './character-creator.component.html',
})
export class CharacterCreatorComponent {
  readonly characterStore = inject(CharacterStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly Number = Number;

  readonly editingCharacterId = signal<string | null>(
    this.route.snapshot.paramMap.get('id')
  );
  readonly isEditMode = computed(() => !!this.editingCharacterId());
  private hasHydratedEditState = false;

  readonly step = signal<CreatorStep>(1);

  readonly name = signal<string>('');
  readonly characterInitials = computed(() => {
    const source =
      this.name().trim() || this.characterStore.defaultCharacterName();
    const parts = source.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  });
  readonly level = signal<number>(1);
  readonly attributes = signal<Record<AttributeName, number>>({
    Brawn: 0,
    Agility: 0,
    Technique: 0,
    Iron: 0,
    Cunning: 0,
  });
  readonly combatSkills = signal<Record<CombatSkillName, number>>({
    Strike: 0,
    Shoot: 0,
    Parry: 0,
    Dodge: 0,
    Block: 0,
  });
  readonly fieldSkills = signal<Record<FieldSkillName, number>>({
    Athletics: 0,
    Menace: 0,
    Stealth: 0,
    Tinkering: 0,
    Medicine: 0,
    Survival: 0,
    Resolve: 0,
    Perception: 0,
    Sway: 0,
    Lore: 0,
  });
  readonly equippedArmor = signal<ArmorTier>('Medium');
  readonly equippedShield = signal<ShieldTier>('Heater');
  readonly weaponSlot1Id = signal<string | null>(null);
  readonly weaponSlot2Id = signal<string | null>(null);
  readonly unlockedPerkIds = signal<string[]>([]);
  readonly activeCreatorTreeId = signal<string | null>(null);

  readonly activeCreatorTree = computed(() => {
    const id = this.activeCreatorTreeId();
    if (!id) return null;
    return this.characterStore.skillTrees().find((t) => t.id === id) ?? null;
  });

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers = ARMOR_TIERS;
  readonly shieldTiers = SHIELD_TIERS;
  readonly armorKeys: ArmorTier[] = ['None', 'Light', 'Medium', 'Heavy'];
  readonly shieldKeys: ShieldTier[] = ['None', 'Buckler', 'Heater', 'Tower'];

  readonly liveDerived = computed(() =>
    computeDerivedStats(
      {
        level: this.level(),
        attributes: this.attributes(),
        combat_skills: this.combatSkills(),
        field_skills: this.fieldSkills(),
        equipped_armor: this.equippedArmor(),
        equipped_shield: this.equippedShield(),
        weapon_slot_1_id:
          this.weaponSlot1Id() ?? this.characterStore.weapons()[0]?.id ?? null,
        weapon_slot_2_id:
          this.weaponSlot2Id() ?? this.characterStore.weapons()[1]?.id ?? null,
        active_weapon_slot: 1,
        unlocked_perk_ids: this.unlockedPerkIds(),
      },
      this.characterStore.weapons(),
      this.characterStore.perkNodes()
    )
  );

  readonly stepLabels: { step: CreatorStep; title: string; badge: () => string }[] = [
    { step: 1, title: 'Identity', badge: () => `Lv.${this.level()}` },
    {
      step: 2,
      title: 'Attributes',
      badge: () =>
        `${this.liveDerived().attributeSpent}/${this.liveDerived().attributeBudget}`,
    },
    {
      step: 3,
      title: 'Skills',
      badge: () =>
        `${this.liveDerived().combatSkillSpent}/${this.liveDerived().combatSkillBudget}`,
    },
    { step: 4, title: 'Loadout', badge: () => '2 Weps' },
    {
      step: 5,
      title: 'Combat Arts',
      badge: () => `${this.liveDerived().perkSpent}/${this.liveDerived().perkBudget}`,
    },
  ];

  constructor() {
    const stepParam = Number(this.route.snapshot.queryParamMap.get('step'));
    if (stepParam >= 1 && stepParam <= 5) {
      this.step.set(stepParam as CreatorStep);
    }

    effect(() => {
      const editId = this.editingCharacterId();
      if (!editId || this.hasHydratedEditState) return;
      const existing = this.characterStore.getCharacterById(editId);
      if (!existing) return;

      this.hasHydratedEditState = true;
      this.name.set(existing.name);
      this.level.set(existing.level);
      this.attributes.set({
        Brawn: existing.attributes?.Brawn ?? 0,
        Agility: existing.attributes?.Agility ?? 0,
        Technique: existing.attributes?.Technique ?? 0,
        Iron: existing.attributes?.Iron ?? 0,
        Cunning: existing.attributes?.Cunning ?? 0,
      });
      this.combatSkills.set({
        Strike: existing.combat_skills?.Strike ?? 0,
        Shoot: existing.combat_skills?.Shoot ?? 0,
        Parry: existing.combat_skills?.Parry ?? 0,
        Dodge: existing.combat_skills?.Dodge ?? 0,
        Block: existing.combat_skills?.Block ?? 0,
      });
      this.fieldSkills.set({
        Athletics: existing.field_skills?.Athletics ?? 0,
        Menace: existing.field_skills?.Menace ?? 0,
        Stealth: existing.field_skills?.Stealth ?? 0,
        Tinkering: existing.field_skills?.Tinkering ?? 0,
        Medicine: existing.field_skills?.Medicine ?? 0,
        Survival: existing.field_skills?.Survival ?? 0,
        Resolve: existing.field_skills?.Resolve ?? 0,
        Perception: existing.field_skills?.Perception ?? 0,
        Sway: existing.field_skills?.Sway ?? 0,
        Lore: existing.field_skills?.Lore ?? 0,
      });
      this.equippedArmor.set(existing.equipped_armor ?? 'Medium');
      this.equippedShield.set(existing.equipped_shield ?? 'Heater');
      this.weaponSlot1Id.set(existing.weapon_slot_1_id ?? null);
      this.weaponSlot2Id.set(existing.weapon_slot_2_id ?? null);
      this.unlockedPerkIds.set([...(existing.unlocked_perk_ids ?? [])]);
    });
  }

  prevStep(): void {
    const cur = this.step();
    if (cur > 1) this.step.set((cur - 1) as CreatorStep);
  }

  nextStep(): void {
    const cur = this.step();
    if (cur < 5) this.step.set((cur + 1) as CreatorStep);
  }

  adjustAttribute(attr: AttributeName, delta: number): void {
    this.attributes.update((curr) => ({
      ...curr,
      [attr]: Math.max(0, Math.min(5, (curr[attr] ?? 0) + delta)),
    }));
  }

  adjustCombatSkill(skill: CombatSkillName, delta: number): void {
    this.combatSkills.update((curr) => ({
      ...curr,
      [skill]: Math.max(0, Math.min(4, (curr[skill] ?? 0) + delta)),
    }));
  }

  adjustFieldSkill(skill: FieldSkillName, delta: number): void {
    this.fieldSkills.update((curr) => ({
      ...curr,
      [skill]: Math.max(0, Math.min(4, (curr[skill] ?? 0) + delta)),
    }));
  }

  getWeaponMod(w: WeaponModel): number {
    return (this.attributes()[w.gov_attribute] ?? 0) + (this.combatSkills()[w.gov_skill] ?? 0);
  }

  getWeaponDamage(w: WeaponModel): number {
    return w.base_damage + (this.attributes()[w.gov_attribute] ?? 0);
  }

  isTwoHanded(w: WeaponModel | null | undefined): boolean {
    return isWeaponTwoHanded(w);
  }

  isHeavy(w: WeaponModel | null | undefined): boolean {
    return isWeaponHeavy(w);
  }

  getHeavyBlockBase(w: WeaponModel | null | undefined): number {
    return getHeavyWeaponBlockBase(w);
  }

  getWeaponOptionSuffix(w: WeaponModel): string {
    const tags = getWeaponPropertyTags(w);
    return tags.length > 0 ? ` · [${tags.join(', ')}]` : '';
  }

  getNodesForTree(treeId: string): PerkNodeModel[] {
    return this.characterStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  getArchetypeIcon(tree: SkillTreeModel) {
    return getTreeArchetypeIcon(tree);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  countSelectedInTree(treeId: string): number {
    const selected = new Set(this.unlockedPerkIds());
    return this.characterStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId && selected.has(p.id)).length;
  }

  togglePerk(node: PerkNodeModel): void {
    const perkId = node.id;
    this.unlockedPerkIds.update((ids) => {
      if (ids.includes(perkId)) {
        // Also remove any child nodes that depend on this node
        const dependentIds = new Set(
          this.characterStore
            .perkNodes()
            .filter((p) => p.parent_node_id === perkId)
            .map((p) => p.id)
        );
        return ids.filter((id) => id !== perkId && !dependentIds.has(id));
      }
      return [...ids, perkId];
    });
  }

  async finishCreateCharacter(): Promise<void> {
    const resolvedName =
      this.name().trim() || this.characterStore.defaultCharacterName();
    this.name.set(resolvedName);

    const wep1 = this.weaponSlot1Id() ?? this.characterStore.weapons()[0]?.id ?? null;
    const wep2 = this.weaponSlot2Id() ?? this.characterStore.weapons()[1]?.id ?? null;
    const editId = this.editingCharacterId();

    if (editId) {
      const updated = await this.characterStore.saveBuilderChanges(editId, {
        name: resolvedName,
        level: this.level(),
        attributes: this.attributes(),
        combat_skills: this.combatSkills(),
        field_skills: this.fieldSkills(),
        equipped_armor: this.equippedArmor(),
        equipped_shield: this.equippedShield(),
        weapon_slot_1_id: wep1,
        weapon_slot_2_id: wep2,
        active_weapon_slot: 1,
        unlocked_perk_ids: this.unlockedPerkIds(),
      });

      if (updated) {
        await this.router.navigate(['/characters', updated.id]);
      }
      return;
    }

    const created = await this.characterStore.createCharacter({
      name: resolvedName,
      level: this.level(),
      attributes: this.attributes(),
      combat_skills: this.combatSkills(),
      field_skills: this.fieldSkills(),
      equipped_armor: this.equippedArmor(),
      equipped_shield: this.equippedShield(),
      weapon_slot_1_id: wep1,
      weapon_slot_2_id: wep2,
      active_weapon_slot: 1,
      unlocked_perk_ids: this.unlockedPerkIds(),
    });

    if (created) {
      await this.router.navigate(['/characters', created.id]);
    }
  }
}
