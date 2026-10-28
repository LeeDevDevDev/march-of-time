import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  COMBAT_SKILL_LIST,
  FIELD_SKILL_LIST,
  PerkNodeModel,
  SHIELD_TIERS,
  WeaponModel,
  computeDerivedStats,
  formatRuleHookBadges,
  getHeavyWeaponBlockBase,
  isWeaponHeavy,
  isWeaponTwoHanded,
} from './models/character.model';
import { CharacterStore } from './store/character.store';

@Component({
  selector: 'app-character-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './character-detail.component.html',
})
export class CharacterDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly characterStore = inject(CharacterStore);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers = ARMOR_TIERS;
  readonly shieldTiers = SHIELD_TIERS;

  readonly perkPickerOpen = signal(false);

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
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      delete nextCooldowns['__shield_raised'];
      return {
        ...c,
        current_ap: 4,
        active_cooldowns: nextCooldowns,
      };
    });
  }

  async useStanceRecovery(id: string, recoveryAmount: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => {
      if (c.current_ap < 1) return c;
      return {
        ...c,
        current_ap: Math.max(0, c.current_ap - 1),
        current_sp: c.current_sp + recoveryAmount,
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
      const nextSlot: 1 | 2 = c.active_weapon_slot === 1 ? 2 : 1;
      const nextChar = { ...c, active_weapon_slot: nextSlot };
      const nextStats = computeDerivedStats(
        nextChar,
        this.characterStore.weapons(),
        this.characterStore.perkNodes()
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

  isTwoHanded(w: WeaponModel | null | undefined): boolean {
    return isWeaponTwoHanded(w);
  }

  isHeavy(w: WeaponModel | null | undefined): boolean {
    return isWeaponHeavy(w);
  }

  getHeavyBlockBase(w: WeaponModel | null | undefined): number {
    return getHeavyWeaponBlockBase(w);
  }

  getNodesForTree(treeId: string): PerkNodeModel[] {
    return this.characterStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  getHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  async toggleCharacterPerk(characterId: string, node: PerkNodeModel): Promise<void> {
    await this.characterStore.updateCharacter(characterId, (c) => {
      const has = c.unlocked_perk_ids.includes(node.id);
      const nextIds = has
        ? c.unlocked_perk_ids.filter((id) => id !== node.id)
        : [...c.unlocked_perk_ids, node.id];
      return {
        ...c,
        unlocked_perk_ids: nextIds,
      };
    });
  }
}
