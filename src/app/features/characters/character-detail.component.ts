import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ResolvedCompendiumVisuals,
  formatWeaponHookBadges,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  resolveNodeVisuals,
  resolveTreeVisuals,
  resolveWeaponVisuals,
} from '../../core/compendium/compendium.model';
import { NotificationStore } from '../../core/notifications/notification.store';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { KeywordTextComponent } from '../../shared/keyword-text/keyword-text.component';
import { SkillTreeCanvasComponent } from '../../shared/skill-tree-canvas/skill-tree-canvas.component';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  COMBAT_SKILL_LIST,
  CharacterModel,
  DerivedCharacterStats,
  FIELD_SKILL_LIST,
  PerkNodeModel,
  SHIELD_TIERS,
  SkillTreeModel,
  WeaponModel,
  computeDerivedStats,
  formatRuleHookBadges,
  getHeavyWeaponBlockBase,
  isStandalonePerkNode,
  isWeaponHeavy,
  isWeaponTwoHanded,
} from './models/character.model';
import { CharacterStore } from './store/character.store';

export interface SheetRollResult {
  label: string;
  d1: number;
  d2: number;
  modifier: number;
  total: number;
  detail?: string;
}

@Component({
  selector: 'app-character-detail',
  standalone: true,
  imports: [
    RouterLink,
    CompendiumIconComponent,
    KeywordTextComponent,
    SkillTreeCanvasComponent,
  ],
  templateUrl: './character-detail.component.html',
})
export class CharacterDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationStore);
  readonly characterStore = inject(CharacterStore);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers = ARMOR_TIERS;
  readonly shieldTiers = SHIELD_TIERS;
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;

  readonly perkPickerOpen = signal(false);
  readonly perkPickerTab = signal<string>('');
  readonly lastRoll = signal<SheetRollResult | null>(null);

  readonly characterId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  readonly character = computed(() =>
    this.characterStore.getCharacterById(this.characterId())
  );

  readonly derived = computed(() => {
    const char = this.character();
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.characterStore.allWeapons(),
      this.characterStore.allPerkNodes()
    );
  });

  readonly effectivePickerTab = computed(() => {
    const tab = this.perkPickerTab();
    if (tab === '__standalone__') return '__standalone__';
    const trees = this.characterStore.skillTrees();
    if (tab && trees.some((t) => t.id === tab)) return tab;
    return trees[0]?.id ?? '__standalone__';
  });

  readonly activePickerTree = computed<SkillTreeModel | null>(() => {
    const tab = this.effectivePickerTab();
    if (tab === '__standalone__') return null;
    return this.characterStore.skillTrees().find((t) => t.id === tab) ?? null;
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.perkPickerOpen()) {
      this.perkPickerOpen.set(false);
    }
  }

  openPerkPicker(): void {
    if (!this.perkPickerTab() && this.characterStore.skillTrees().length > 0) {
      this.perkPickerTab.set(this.characterStore.skillTrees()[0].id);
    }
    this.perkPickerOpen.set(true);
  }

  roll2d10(label: string, modifier: number, detail?: string): SheetRollResult {
    const d1 = Math.floor(Math.random() * 10) + 1;
    const d2 = Math.floor(Math.random() * 10) + 1;
    const total = d1 + d2 + modifier;
    const result: SheetRollResult = {
      label,
      d1,
      d2,
      modifier,
      total,
      detail,
    };
    this.lastRoll.set(result);
    const sign = modifier >= 0 ? `+ ${modifier}` : `− ${Math.abs(modifier)}`;
    this.notifications.info(
      `${label}: ${total}`,
      `2d10 [${d1}, ${d2}] ${sign} = ${total}${detail ? ' · ' + detail : ''}`
    );
    return result;
  }

  async adjustHp(id: string, delta: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_hp: Math.max(0, c.current_hp + delta),
    }));
  }

  async adjustSp(id: string, delta: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_sp: Math.max(0, c.current_sp + delta),
    }));
  }

  async setAp(id: string, ap: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_ap: Math.max(0, Math.min(4, ap)),
    }));
  }

  async resetRoundAp(id: string): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => {
      const nextCooldowns: Record<string, number> = {};
      for (const [key, val] of Object.entries(c.active_cooldowns ?? {})) {
        if (key === '__shield_raised') continue;
        const remaining = Number(val) - 1;
        if (remaining > 0) {
          nextCooldowns[key] = remaining;
        }
      }
      return {
        ...c,
        current_ap: 4,
        active_cooldowns: nextCooldowns,
      };
    });
  }

  async useStanceRecovery(
    id: string,
    recoveryAmount: number,
    maxSp: number
  ): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => {
      if (c.current_ap < 1) return c;
      return {
        ...c,
        current_ap: Math.max(0, c.current_ap - 1),
        current_sp: Math.min(maxSp, c.current_sp + recoveryAmount),
      };
    });
  }

  async useParryReaction(id: string, stats: DerivedCharacterStats): Promise<void> {
    const char = this.character();
    if (!char || char.current_ap < 1) return;
    await this.setAp(id, char.current_ap - 1);
    this.roll2d10(
      'Parry Reaction',
      stats.parryMod,
      `1 AP spent · Flawless (+5) deals ${stats.flawlessParryCounterSp} SP`
    );
  }

  async useDodgeReaction(id: string, stats: DerivedCharacterStats): Promise<void> {
    const char = this.character();
    if (!char || !stats.canDodge || char.current_ap < 1) return;
    await this.setAp(id, char.current_ap - 1);
    this.roll2d10(
      'Dodge Reaction',
      stats.dodgeMod,
      '1 AP spent · Shifts 1 Tile · Flawless (+5) refunds 1 AP'
    );
  }

  async useWeaponAttack(
    id: string,
    weapon: WeaponModel,
    stats: DerivedCharacterStats
  ): Promise<void> {
    const char = this.character();
    if (!char || char.current_ap < weapon.ap_cost) return;
    const mod = this.getWeaponAttackMod(char, weapon, stats);
    const dmg = this.getWeaponFlatDamage(char, weapon, stats);
    await this.setAp(id, char.current_ap - weapon.ap_cost);
    this.roll2d10(
      `${weapon.name} Attack`,
      mod,
      `${weapon.ap_cost} AP spent · ${dmg} Flat DMG`
    );
  }

  getPerkCooldown(
    char: Pick<CharacterModel, 'active_cooldowns'>,
    perkId: string
  ): number {
    return Math.max(0, Number(char.active_cooldowns?.[perkId] ?? 0));
  }

  async useCombatArt(
    id: string,
    perk: PerkNodeModel,
    stats: DerivedCharacterStats
  ): Promise<void> {
    const char = this.character();
    const apCost = perk.ap_cost ?? 1;
    if (!char || char.current_ap < apCost || this.getPerkCooldown(char, perk.id) > 0) {
      return;
    }

    await this.characterStore.updateCharacter(id, (c) => {
      if (c.current_ap < apCost) return c;
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      if ((perk.cooldown_rounds ?? 0) > 0) {
        nextCooldowns[perk.id] = perk.cooldown_rounds!;
      }
      return {
        ...c,
        current_ap: Math.max(0, c.current_ap - apCost),
        active_cooldowns: nextCooldowns,
      };
    });

    const badges = formatRuleHookBadges(perk.rule_hooks);
    const counter = getCombatTagCounterLabel(perk.combat_tag);
    const detailParts = [`${apCost} AP spent`];
    if (counter) detailParts.push(counter);
    if (badges.length > 0) detailParts.push(badges.join(' · '));

    if (perk.combat_tag && perk.combat_tag !== 'None') {
      this.roll2d10(perk.name, stats.attackRollMod, detailParts.join(' · '));
    } else {
      this.notifications.success(
        `Activated ${perk.name}`,
        detailParts.join(' · ')
      );
    }
  }

  async clearPerkCooldown(id: string, perkId: string): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => {
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      delete nextCooldowns[perkId];
      return {
        ...c,
        active_cooldowns: nextCooldowns,
      };
    });
  }

  isShieldRaised(char: { active_cooldowns?: Record<string, number> }): boolean {
    return Boolean(char.active_cooldowns?.['__shield_raised']);
  }

  async toggleRaiseShield(id: string): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => {
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      const currentlyRaised = Boolean(nextCooldowns['__shield_raised']);
      if (currentlyRaised) {
        delete nextCooldowns['__shield_raised'];
        return {
          ...c,
          active_cooldowns: nextCooldowns,
        };
      }
      if (c.current_ap < 1) return c;
      nextCooldowns['__shield_raised'] = 1;
      return {
        ...c,
        current_ap: Math.max(0, c.current_ap - 1),
        active_cooldowns: nextCooldowns,
      };
    });
  }

  async switchWeapon(id: string): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => {
      if (c.current_ap < 1) return c;
      const nextSlot: 1 | 2 = c.active_weapon_slot === 1 ? 2 : 1;
      const nextChar = { ...c, active_weapon_slot: nextSlot };
      const nextStats = computeDerivedStats(
        nextChar,
        this.characterStore.allWeapons(),
        this.characterStore.allPerkNodes()
      );
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      if (!nextStats.usesRaiseShield) {
        delete nextCooldowns['__shield_raised'];
      }
      return {
        ...nextChar,
        current_ap: Math.max(0, c.current_ap - 1),
        active_cooldowns: nextCooldowns,
      };
    });
  }

  getWeaponAttackMod(
    char: CharacterModel,
    weapon: WeaponModel,
    stats: DerivedCharacterStats
  ): number {
    const perkBonus = stats.unlockedPerks.reduce(
      (sum, p) => sum + Number(p.rule_hooks?.bonus_attack_mod ?? 0),
      0
    );
    return (
      (char.attributes[weapon.gov_attribute] ?? 0) +
      (char.combat_skills[weapon.gov_skill] ?? 0) +
      perkBonus
    );
  }

  getWeaponFlatDamage(
    char: CharacterModel,
    weapon: WeaponModel,
    stats: DerivedCharacterStats
  ): number {
    const perkBonus = stats.unlockedPerks.reduce(
      (sum, p) => sum + Number(p.rule_hooks?.bonus_flat_damage ?? 0),
      0
    );
    return weapon.base_damage + (char.attributes[weapon.gov_attribute] ?? 0) + perkBonus;
  }

  getWeaponVisuals(weapon: WeaponModel): ResolvedCompendiumVisuals {
    return resolveWeaponVisuals(weapon);
  }

  getWeaponHookBadges(weapon: WeaponModel | null | undefined): string[] {
    return formatWeaponHookBadges(weapon);
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  countUnlockedInTree(char: CharacterModel, treeId: string): number {
    const unlocked = new Set(char.unlocked_perk_ids);
    return this.characterStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId && unlocked.has(p.id)).length;
  }

  countUnlockedStandalone(char: CharacterModel): number {
    const unlocked = new Set(char.unlocked_perk_ids);
    return this.characterStore
      .standaloneNodes()
      .filter((p) => unlocked.has(p.id)).length;
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

  getHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  isStandalone(node: PerkNodeModel): boolean {
    return isStandalonePerkNode(node);
  }

  async toggleCharacterPerk(characterId: string, node: PerkNodeModel): Promise<void> {
    await this.characterStore.updateCharacter(characterId, (c) => {
      const has = c.unlocked_perk_ids.includes(node.id);
      if (has) {
        const allNodes = this.characterStore.allPerkNodes();
        const toRemove = new Set<string>([node.id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const p of allNodes) {
            if (p.parent_node_id && toRemove.has(p.parent_node_id) && !toRemove.has(p.id)) {
              toRemove.add(p.id);
              changed = true;
            }
          }
        }
        const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
        for (const removedId of toRemove) {
          delete nextCooldowns[removedId];
        }
        return {
          ...c,
          unlocked_perk_ids: c.unlocked_perk_ids.filter((id) => !toRemove.has(id)),
          active_cooldowns: nextCooldowns,
        };
      }
      return {
        ...c,
        unlocked_perk_ids: [...c.unlocked_perk_ids, node.id],
      };
    });
  }
}
