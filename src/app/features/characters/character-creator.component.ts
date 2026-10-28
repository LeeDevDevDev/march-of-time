import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ResolvedCompendiumVisuals,
  getTreeArchetypeIcon,
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
  private readonly router = inject(Router);
  readonly Number = Number;

  readonly step = signal<CreatorStep>(1);

  readonly name = signal<string>('');
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
    if (!this.name().trim()) {
      this.step.set(1);
      return;
    }

    const wep1 = this.weaponSlot1Id() ?? this.characterStore.weapons()[0]?.id ?? null;
    const wep2 = this.weaponSlot2Id() ?? this.characterStore.weapons()[1]?.id ?? null;

    const created = await this.characterStore.createCharacter({
      name: this.name().trim(),
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
