import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import {
  ResolvedCompendiumVisuals,
  formatArtUpgradeBadges,
  formatWeaponHookBadges,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  pruneUnreachableUnlockedPerks,
  resolveNodeVisuals,
  resolveTreeVisuals,
  resolveWeaponVisuals,
} from '../../core/compendium/compendium.model';
import { NotificationStore } from '../../core/notifications/notification.store';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { KeywordTextComponent } from '../../shared/keyword-text/keyword-text.component';
import { SkillTreeCanvasComponent } from '../../shared/skill-tree-canvas/skill-tree-canvas.component';
import { TokenAvatarComponent } from '../../shared/token-avatar/token-avatar.component';
import {
  TokenizerEditorComponent,
  TokenizerVisualsPayload,
} from '../../shared/token-avatar/tokenizer-editor.component';
import {
  ARMOR_TIERS,
  ARMOR_WEIGHT_OPTIONS,
  ATTRIBUTE_LIST,
  ActorInventoryItem,
  ArmorModel,
  ArmorTier,
  ArmorWeightClass,
  AttributeName,
  COMBAT_SKILL_LIST,
  CharacterModel,
  CharacterWeaponFormulaSummary,
  CombatSkillName,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ARMORS,
  DEFAULT_COMPENDIUM_ITEMS,
  DerivedCharacterStats,
  FIELD_SKILL_LIST,
  ITEM_SUBCATEGORY_OPTIONS,
  InventoryFilterTab,
  InventoryItemCategory,
  PerkNodeModel,
  ResolvedCombatArt,
  SHIELD_TIERS,
  ShieldTier,
  SkillTreeModel,
  UPGRADE_SLOT_PREFIX,
  WeaponModel,
  buildArmorInventoryEntry,
  buildCompendiumGearInventoryEntry,
  buildWeaponInventoryEntry,
  computeCharacterWeaponFormula,
  computeDerivedStats,
  formatRuleHookBadges,
  formatWeaponRequirementLabel,
  getHeavyWeaponBlockBase,
  getInventoryItemCategory,
  getUpgradeSlotKey,
  hasCustomTokenAppearance,
  isCombatArtUpgradeNode,
  isStandalonePerkNode,
  isWeaponHeavy,
  isWeaponTwoHanded,
  mergeInventoryEntry,
  normalizeInventoryItems,
  resolveArmorVisuals,
  resolveCompendiumItemVisuals,
} from './models/character.model';
import { CharacterStore } from './store/character.store';

export type CharacterSheetViewTab =
  | 'actions'
  | 'character'
  | 'loadout'
  | 'perks'
  | 'all';

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
    FormsModule,
    RouterLink,
    CompendiumIconComponent,
    KeywordTextComponent,
    SkillTreeCanvasComponent,
    TokenAvatarComponent,
    TokenizerEditorComponent,
  ],
  templateUrl: './character-detail.component.html',
})
export class CharacterDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationStore);
  readonly authStore = inject(AuthStore);
  readonly characterStore = inject(CharacterStore);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers = ARMOR_TIERS;
  readonly armorWeightOptions = ARMOR_WEIGHT_OPTIONS;
  readonly shieldTiers = SHIELD_TIERS;
  readonly shieldTierKeys: ShieldTier[] = ['None', 'Buckler', 'Heater', 'Tower'];
  readonly itemSubcategoryOptions = ITEM_SUBCATEGORY_OPTIONS;
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;
  readonly isCombatArtUpgradeNode = isCombatArtUpgradeNode;

  readonly perkPickerOpen = signal(false);
  readonly perkPickerTab = signal<string>('');
  readonly tokenizerModalOpen = signal(false);
  readonly brokenPortraitUrl = signal<string | null>(null);
  readonly lastRoll = signal<SheetRollResult | null>(null);
  readonly sheetTab = signal<CharacterSheetViewTab>('actions');
  readonly inventoryTab = signal<InventoryFilterTab>('all');

  readonly characterId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  readonly character = computed(() =>
    this.characterStore.getCharacterById(this.characterId())
  );

  private resolveArmorsList(): ArmorModel[] {
    return typeof this.characterStore.allArmors === 'function'
      ? this.characterStore.allArmors()
      : DEFAULT_COMPENDIUM_ARMORS;
  }

  readonly derived = computed(() => {
    const char = this.character();
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.characterStore.allWeapons(),
      this.characterStore.allPerkNodes(),
      this.resolveArmorsList()
    );
  });

  readonly effectivePickerTab = computed(() => {
    const tab = this.perkPickerTab();
    if (tab === '__standalone__' && this.authStore.isAdmin()) {
      return '__standalone__';
    }
    const trees = this.characterStore.skillTrees();
    if (tab && trees.some((t) => t.id === tab)) return tab;
    return trees[0]?.id ?? (this.authStore.isAdmin() ? '__standalone__' : '');
  });

  readonly activePickerTree = computed<SkillTreeModel | null>(() => {
    const tab = this.effectivePickerTab();
    if (!tab || tab === '__standalone__') return null;
    return this.characterStore.skillTrees().find((t) => t.id === tab) ?? null;
  });

  constructor() {
    void this.characterStore.ensureCompendiumLoaded();
    const initialId = this.characterId();
    if (initialId) {
      void this.characterStore.ensureCharacterLoaded(initialId);
    }
    effect(() => {
      const id = this.characterId();
      if (id) {
        void this.characterStore.ensureCharacterLoaded(id);
      }
    });
    effect(() => {
      const invTab = this.inventoryTab();
      if (invTab !== 'all') {
        untracked(() => {
          const currentTab = this.sheetTab();
          if (currentTab !== 'loadout' && currentTab !== 'all') {
            this.sheetTab.set('loadout');
          }
        });
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tokenizerModalOpen()) {
      this.tokenizerModalOpen.set(false);
      return;
    }
    if (this.perkPickerOpen()) {
      this.perkPickerOpen.set(false);
    }
  }

  hasCustomToken(char: CharacterModel): boolean {
    return (
      Boolean(char.token_image_url) ||
      hasCustomTokenAppearance(char.token_appearance)
    );
  }

  async onCharacterVisualsChange(
    char: CharacterModel,
    payload: TokenizerVisualsPayload
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      portrait_url: payload.portrait_url,
      token_image_url: payload.token_image_url,
      token_appearance: payload.token_appearance,
    }));
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
      const nextCooldowns: Record<string, number | string> = {};
      for (const [key, val] of Object.entries(c.active_cooldowns ?? {})) {
        if (key === '__shield_raised') continue;
        if (key.startsWith(UPGRADE_SLOT_PREFIX)) {
          nextCooldowns[key] = val;
          continue;
        }
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
      '1 AP spent · Shifts 5 ft · Flawless (+5) refunds 1 AP'
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

  async useUnarmedAttack(
    id: string,
    stats: DerivedCharacterStats
  ): Promise<void> {
    const char = this.character();
    if (!char || char.current_ap < 1) return;
    await this.setAp(id, char.current_ap - 1);
    this.roll2d10(
      'Unarmed Strike',
      stats.attackRollMod,
      `1 AP spent · ${stats.flatWeaponDamage} Flat DMG`
    );
  }

  async useTacticalAction(
    id: string,
    actionLabel: string,
    detailText: string,
    apCost = 1
  ): Promise<void> {
    const char = this.character();
    if (!char || char.current_ap < apCost) return;
    await this.setAp(id, char.current_ap - apCost);
    this.notifications.info(
      `${actionLabel} (${apCost} AP)`,
      detailText
    );
  }

  formatRollFormulaFromMod(mod: number): string {
    return mod >= 0 ? `2d10 + ${mod}` : `2d10 − ${Math.abs(mod)}`;
  }

  getWeaponReachOrRangeLabel(w: WeaponModel | null | undefined): string {
    if (!w) return 'Reach 5 ft';
    const reachFt = Math.max(5, Math.round((w.reach_tiles ?? 1) * 5));
    const thrownFt =
      w.thrown_range_tiles && w.thrown_range_tiles > 0
        ? Math.round(w.thrown_range_tiles * 5)
        : 0;
    if (
      (w.category ?? '').toLowerCase() === 'ranged' ||
      w.gov_skill === 'Shoot'
    ) {
      return `Range ${Math.max(reachFt, thrownFt)} ft`;
    }
    if (thrownFt > reachFt) {
      return `Reach ${reachFt} ft · Thrown ${thrownFt} ft`;
    }
    return `Reach ${reachFt} ft`;
  }

  getPerkCooldown(
    char: Pick<CharacterModel, 'active_cooldowns'>,
    perkId: string
  ): number {
    return Math.max(0, Number(char.active_cooldowns?.[perkId] ?? 0));
  }

  async useCombatArt(
    id: string,
    art: ResolvedCombatArt,
    stats: DerivedCharacterStats
  ): Promise<void> {
    const char = this.character();
    const perkId = art.baseNode.id;
    const apCost = art.apCost;
    if (
      !char ||
      !art.meetsWeaponRequirement ||
      char.current_ap < apCost ||
      this.getPerkCooldown(char, perkId) > 0
    ) {
      return;
    }

    await this.characterStore.updateCharacter(id, (c) => {
      if (c.current_ap < apCost) return c;
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      if (art.cooldownRounds > 0) {
        nextCooldowns[perkId] = art.cooldownRounds;
      }
      return {
        ...c,
        current_ap: Math.max(0, c.current_ap - apCost),
        active_cooldowns: nextCooldowns,
      };
    });

    const detailParts = [`${apCost} AP spent`];
    if (art.appliedUpgrades.length > 0) {
      detailParts.push(
        `Upgraded (${art.appliedUpgrades.map((u) => u.name).join(', ')})`
      );
    }
    if (art.bonusFlatDamage !== 0) {
      detailParts.push(
        `${stats.flatWeaponDamage + art.bonusFlatDamage} Total Flat DMG`
      );
    }
    if (art.effectBadges.length > 0) {
      detailParts.push(art.effectBadges.join(' · '));
    }

    if (
      art.combatTags.length > 0 ||
      art.bonusAttackMod !== 0 ||
      art.bonusFlatDamage !== 0
    ) {
      this.roll2d10(
        art.baseNode.name,
        stats.attackRollMod + art.bonusAttackMod,
        detailParts.join(' · ')
      );
    } else {
      this.notifications.success(
        `Activated ${art.baseNode.name}`,
        detailParts.join(' · ')
      );
    }
  }

  async setArtUpgradeSlot(
    characterId: string,
    upgradeNodeId: string,
    targetArtId: string
  ): Promise<void> {
    await this.characterStore.updateCharacter(characterId, (c) => {
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      const slotKey = getUpgradeSlotKey(upgradeNodeId);
      if (targetArtId) {
        nextCooldowns[slotKey] = targetArtId;
      } else {
        delete nextCooldowns[slotKey];
      }
      return {
        ...c,
        active_cooldowns: nextCooldowns,
      };
    });
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

  isShieldRaised(char: {
    active_cooldowns?: Record<string, number | string>;
  }): boolean {
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
        this.characterStore.allPerkNodes(),
        this.resolveArmorsList()
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
      (sum, p) =>
        p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)
          ? sum + Number(p.rule_hooks?.bonus_attack_mod ?? 0)
          : sum,
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
      (sum, p) =>
        p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)
          ? sum + Number(p.rule_hooks?.bonus_flat_damage ?? 0)
          : sum,
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

  getArtUpgradeBadges(node: PerkNodeModel): string[] {
    return formatArtUpgradeBadges(node.rule_hooks?.__art_upgrade);
  }

  getNodeWeaponReqLabel(node: PerkNodeModel): string | null {
    if (node.node_type !== 'combat_art') return null;
    return formatWeaponRequirementLabel(
      node.rule_hooks?.__weapon_req,
      this.characterStore.allWeapons()
    );
  }

  isStandalone(node: PerkNodeModel): boolean {
    return isStandalonePerkNode(node);
  }

  getPerkOriginLabel(node: PerkNodeModel): string {
    if (isStandalonePerkNode(node)) return 'GRANTED';
    return (
      this.characterStore
        .skillTrees()
        .find((t) => t.id === node.tree_id)?.name ?? 'Skill Tree'
    );
  }

  async toggleCharacterPerk(characterId: string, node: PerkNodeModel): Promise<void> {
    if (isStandalonePerkNode(node)) {
      if (!this.authStore.isAdmin()) return;
      await this.characterStore.toggleAdminGrantedPerk(characterId, node);
      return;
    }

    await this.characterStore.updateCharacter(characterId, (c) => {
      const has = c.unlocked_perk_ids.includes(node.id);
      if (has) {
        const allNodes = this.characterStore.allPerkNodes();
        const nextUnlocked = pruneUnreachableUnlockedPerks(
          c.unlocked_perk_ids.filter((id) => id !== node.id),
          allNodes
        );
        const keptSet = new Set(nextUnlocked);
        const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
        for (const oldId of c.unlocked_perk_ids) {
          if (!keptSet.has(oldId)) {
            delete nextCooldowns[oldId];
            delete nextCooldowns[getUpgradeSlotKey(oldId)];
          }
        }
        for (const [k, val] of Object.entries(nextCooldowns)) {
          if (
            k.startsWith(UPGRADE_SLOT_PREFIX) &&
            typeof val === 'string' &&
            !keptSet.has(val)
          ) {
            delete nextCooldowns[k];
          }
        }
        return {
          ...c,
          unlocked_perk_ids: nextUnlocked,
          active_cooldowns: nextCooldowns,
        };
      }
      return {
        ...c,
        unlocked_perk_ids: [...c.unlocked_perk_ids, node.id],
      };
    });
  }

  canEditCharacter(char: CharacterModel): boolean {
    const uid = this.authStore.user()?.id ?? null;
    return (uid !== null && char.owner_id === uid) || this.authStore.isAdmin();
  }

  getActiveCompendiumArmors(): ArmorModel[] {
    return typeof this.characterStore.armors === 'function'
      ? this.characterStore.armors()
      : DEFAULT_COMPENDIUM_ARMORS;
  }

  getActiveCompendiumItems(): CompendiumItemModel[] {
    return typeof this.characterStore.items === 'function'
      ? this.characterStore.items()
      : DEFAULT_COMPENDIUM_ITEMS;
  }

  getWeaponFormula(
    char: CharacterModel,
    target: WeaponModel | ActorInventoryItem,
    stats: DerivedCharacterStats
  ): CharacterWeaponFormulaSummary {
    return computeCharacterWeaponFormula(
      char,
      target,
      stats.unlockedPerks,
      this.characterStore.allWeapons()
    );
  }

  getInventoryItems(char: CharacterModel): ActorInventoryItem[] {
    return normalizeInventoryItems(char.inventory);
  }

  getInventoryWeapons(char: CharacterModel): ActorInventoryItem[] {
    return this.getInventoryItems(char).filter(
      (it) => getInventoryItemCategory(it) === 'weapon'
    );
  }

  getInventoryArmors(char: CharacterModel): ActorInventoryItem[] {
    return this.getInventoryItems(char)
      .filter((it) => getInventoryItemCategory(it) === 'armor')
      .sort((a, b) => Number(Boolean(b.equipped)) - Number(Boolean(a.equipped)));
  }

  getInventoryGearItems(char: CharacterModel): ActorInventoryItem[] {
    return this.getInventoryItems(char).filter(
      (it) => getInventoryItemCategory(it) === 'item'
    );
  }

  hasStandardTierArmorEquipped(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): boolean {
    return char.equipped_armor !== 'None' && !stats.equippedInventoryArmorId;
  }

  getWeaponsCategoryCount(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): number {
    return (
      (stats.weaponSlot1 ? 1 : 0) +
      (stats.weaponSlot2 ? 1 : 0) +
      this.getInventoryWeapons(char).length
    );
  }

  getArmorsCategoryCount(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): number {
    return (
      (this.hasStandardTierArmorEquipped(char, stats) ? 1 : 0) +
      this.getInventoryArmors(char).length
    );
  }

  getItemsCategoryCount(char: CharacterModel): number {
    return this.getInventoryGearItems(char).length;
  }

  getTotalCategorizedCount(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): number {
    return (
      this.getWeaponsCategoryCount(char, stats) +
      this.getArmorsCategoryCount(char, stats) +
      this.getItemsCategoryCount(char)
    );
  }

  getArmorItemSp(item: ActorInventoryItem): number {
    if (typeof item.armor_sp === 'number') return item.armor_sp;
    const match = item.compendium_id
      ? this.resolveArmorsList().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return match.armor_sp;
    const w = item.armor_weight ?? 'Light';
    return ARMOR_TIERS[w].armorSp;
  }

  getArmorItemDr(item: ActorInventoryItem): number {
    if (typeof item.armor_dr === 'number') return item.armor_dr;
    const match = item.compendium_id
      ? this.resolveArmorsList().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return match.armor_dr;
    const w = item.armor_weight ?? 'Light';
    return ARMOR_TIERS[w].hpDr;
  }

  getArmorItemAllowsDodge(item: ActorInventoryItem): boolean {
    if (typeof item.allows_dodge === 'boolean') return item.allows_dodge;
    const match = item.compendium_id
      ? this.resolveArmorsList().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return match.allows_dodge;
    const w = item.armor_weight ?? 'Light';
    return ARMOR_TIERS[w].allowsDodge;
  }

  getArmorItemVisuals(item: ActorInventoryItem): ResolvedCompendiumVisuals {
    const match = item.compendium_id
      ? this.resolveArmorsList().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return resolveArmorVisuals(match);
    const w = item.armor_weight ?? 'Light';
    return {
      icon: w === 'Heavy' ? 'iron-helm' : 'breastplate',
      color: w === 'Heavy' ? '#F26464' : w === 'Medium' ? '#F59E0B' : '#38B29A',
      tintCustom: true,
      isCustomUpload: false,
    };
  }

  getInventoryWeaponVisuals(
    item: ActorInventoryItem
  ): ResolvedCompendiumVisuals {
    const match = item.compendium_id
      ? this.characterStore.allWeapons().find((w) => w.id === item.compendium_id)
      : null;
    if (match) return resolveWeaponVisuals(match);
    return {
      icon: item.gov_skill === 'Shoot' ? 'bow' : 'greatsword',
      color: '#FF8C5A',
      tintCustom: true,
      isCustomUpload: false,
    };
  }

  getGearItemVisuals(item: ActorInventoryItem): ResolvedCompendiumVisuals {
    const match = item.compendium_id
      ? this.getActiveCompendiumItems().find((i) => i.id === item.compendium_id)
      : null;
    if (match) return resolveCompendiumItemVisuals(match);
    return {
      icon: 'pack',
      color: '#38B29A',
      tintCustom: true,
      isCustomUpload: false,
    };
  }

  getLoadoutArmorSelectValue(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): string {
    if (char.equipped_armor === 'None') return 'None';
    if (stats.equippedInventoryArmorId) {
      return `inv:${stats.equippedInventoryArmorId}`;
    }
    return `tier:${char.equipped_armor}`;
  }

  async selectLoadoutArmorChoice(
    char: CharacterModel,
    choice: string
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    if (!choice || choice === 'None') {
      await this.unequipCharacterArmor(char);
      return;
    }
    if (choice.startsWith('tier:')) {
      const tier = choice.slice(5) as ArmorTier;
      await this.characterStore.updateCharacter(char.id, (c) => {
        const oldStats = computeDerivedStats(
          c,
          this.characterStore.allWeapons(),
          this.characterStore.allPerkNodes(),
          this.resolveArmorsList()
        );
        const nextInv = normalizeInventoryItems(c.inventory).map((it) =>
          getInventoryItemCategory(it) === 'armor'
            ? { ...it, equipped: false }
            : it
        );
        const draft = { ...c, equipped_armor: tier, inventory: nextInv };
        const nextStats = computeDerivedStats(
          draft,
          this.characterStore.allWeapons(),
          this.characterStore.allPerkNodes(),
          this.resolveArmorsList()
        );
        const spGain = Math.max(0, nextStats.maxSp - oldStats.maxSp);
        return {
          ...draft,
          current_sp: Math.min(nextStats.maxSp, c.current_sp + spGain),
        };
      });
      return;
    }
    if (choice.startsWith('inv:')) {
      await this.equipInventoryArmor(char, choice.slice(4));
      return;
    }
    if (choice.startsWith('comp:')) {
      const compId = choice.slice(5);
      const armor = this.getActiveCompendiumArmors().find(
        (a) => a.id === compId
      );
      if (!armor) return;
      await this.characterStore.updateCharacter(char.id, (c) => {
        const oldStats = computeDerivedStats(
          c,
          this.characterStore.allWeapons(),
          this.characterStore.allPerkNodes(),
          this.resolveArmorsList()
        );
        const list = normalizeInventoryItems(c.inventory);
        const existingIdx = list.findIndex(
          (it) =>
            getInventoryItemCategory(it) === 'armor' &&
            it.compendium_id === armor.id
        );
        const nextInv =
          existingIdx >= 0
            ? list.map((it, idx) =>
                getInventoryItemCategory(it) === 'armor'
                  ? { ...it, equipped: idx === existingIdx }
                  : it
              )
            : [
                ...list.map((it) =>
                  getInventoryItemCategory(it) === 'armor'
                    ? { ...it, equipped: false }
                    : it
                ),
                buildArmorInventoryEntry(armor, true),
              ];
        const draft: CharacterModel = {
          ...c,
          equipped_armor: armor.weight_class,
          inventory: nextInv,
        };
        const nextStats = computeDerivedStats(
          draft,
          this.characterStore.allWeapons(),
          this.characterStore.allPerkNodes(),
          this.resolveArmorsList()
        );
        const spGain = Math.max(0, nextStats.maxSp - oldStats.maxSp);
        return {
          ...draft,
          current_sp: Math.min(nextStats.maxSp, c.current_sp + spGain),
        };
      });
    }
  }

  async changeCharacterShield(
    char: CharacterModel,
    shield: ShieldTier
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      equipped_shield: shield,
    }));
  }

  async addFromCompendiumPicker(
    char: CharacterModel,
    encoded: string
  ): Promise<void> {
    if (!this.canEditCharacter(char) || !encoded) return;
    const colonIdx = encoded.indexOf(':');
    if (colonIdx < 0) return;
    const kind = encoded.slice(0, colonIdx);
    const id = encoded.slice(colonIdx + 1);

    if (kind === 'weapon') {
      const wep = this.characterStore.weapons().find((w) => w.id === id);
      if (!wep) return;
      const entry = buildWeaponInventoryEntry(wep, 1);
      await this.characterStore.updateCharacter(char.id, (c) => ({
        ...c,
        inventory: mergeInventoryEntry(c.inventory ?? [], entry, false),
      }));
      return;
    }

    if (kind === 'armor') {
      const armor = this.getActiveCompendiumArmors().find((a) => a.id === id);
      if (!armor) return;
      const entry = buildArmorInventoryEntry(armor, false);
      await this.characterStore.updateCharacter(char.id, (c) => ({
        ...c,
        inventory: mergeInventoryEntry(c.inventory ?? [], entry, false),
      }));
      return;
    }

    if (kind === 'item') {
      const compItem = this.getActiveCompendiumItems().find((i) => i.id === id);
      if (!compItem) return;
      const entry = buildCompendiumGearInventoryEntry(compItem);
      await this.characterStore.updateCharacter(char.id, (c) => ({
        ...c,
        inventory: mergeInventoryEntry(
          c.inventory ?? [],
          entry,
          compItem.stackable !== false
        ),
      }));
    }
  }

  async addCustomInventoryEntry(
    char: CharacterModel,
    category: InventoryItemCategory
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    const newId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let newItem: ActorInventoryItem;
    if (category === 'weapon') {
      newItem = {
        id: newId,
        category: 'weapon',
        subcategory: 'Martial',
        name: 'Custom Weapon',
        quantity: 1,
        description: '',
        gov_attribute: 'Brawn',
        gov_skill: 'Strike',
        ap_cost: 1,
        attack_bonus: 0,
        base_damage: 4,
        reach_feet: 5,
        two_handed: false,
      };
    } else if (category === 'armor') {
      newItem = {
        id: newId,
        category: 'armor',
        subcategory: 'Light',
        name: 'Custom Armor',
        quantity: 1,
        description: '',
        equipped: false,
        armor_weight: 'Light',
        armor_sp: 2,
        armor_dr: 1,
        allows_dodge: true,
      };
    } else {
      newItem = {
        id: newId,
        category: 'item',
        subcategory: 'Adventuring Gear',
        name: 'New Item',
        quantity: 1,
        description: '',
      };
    }

    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      inventory: [...normalizeInventoryItems(c.inventory), newItem],
    }));
  }

  async addInventoryItem(char: CharacterModel): Promise<void> {
    const tab = this.inventoryTab();
    const category: InventoryItemCategory = tab === 'all' ? 'item' : tab;
    await this.addCustomInventoryEntry(char, category);
  }

  async stowSlotWeaponToInventory(
    char: CharacterModel,
    slot: 1 | 2
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    const slotWeaponId =
      slot === 1 ? char.weapon_slot_1_id : char.weapon_slot_2_id;
    if (!slotWeaponId) return;
    const wep = this.characterStore
      .allWeapons()
      .find((w) => w.id === slotWeaponId);
    if (!wep) return;

    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      weapon_slot_1_id: slot === 1 ? null : c.weapon_slot_1_id,
      weapon_slot_2_id: slot === 2 ? null : c.weapon_slot_2_id,
      inventory: [
        ...normalizeInventoryItems(c.inventory),
        buildWeaponInventoryEntry(wep, 1),
      ],
    }));
  }

  async equipInventoryWeaponToSlot(
    char: CharacterModel,
    item: ActorInventoryItem,
    slot: 1 | 2
  ): Promise<void> {
    if (!this.canEditCharacter(char) || !item.compendium_id) return;
    const wep = this.characterStore
      .allWeapons()
      .find((w) => w.id === item.compendium_id);
    if (!wep) return;

    await this.characterStore.updateCharacter(char.id, (c) => {
      const prevSlotId =
        slot === 1 ? c.weapon_slot_1_id : c.weapon_slot_2_id;
      const prevWep = prevSlotId
        ? (this.characterStore.allWeapons().find((w) => w.id === prevSlotId) ??
          null)
        : null;

      let nextInv = normalizeInventoryItems(c.inventory)
        .map((it) =>
          it.id === item.id ? { ...it, quantity: it.quantity - 1 } : it
        )
        .filter((it) => it.id !== item.id || it.quantity > 0);

      if (prevWep) {
        nextInv = [...nextInv, buildWeaponInventoryEntry(prevWep, 1)];
      }

      const nextSlot1 = slot === 1 ? wep.id : c.weapon_slot_1_id;
      const nextSlot2 = slot === 2 ? wep.id : c.weapon_slot_2_id;
      const activeId =
        c.active_weapon_slot === 1 ? nextSlot1 : nextSlot2;
      const activeWep = activeId
        ? (this.characterStore.allWeapons().find((w) => w.id === activeId) ??
          null)
        : null;

      return {
        ...c,
        weapon_slot_1_id: nextSlot1,
        weapon_slot_2_id: nextSlot2,
        equipped_shield: isWeaponTwoHanded(activeWep)
          ? 'None'
          : c.equipped_shield,
        inventory: nextInv,
      };
    });
  }

  async equipInventoryArmor(
    char: CharacterModel,
    itemId: string
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => {
      const list = normalizeInventoryItems(c.inventory);
      const target = list.find(
        (it) => it.id === itemId && getInventoryItemCategory(it) === 'armor'
      );
      if (!target) return c;

      const oldStats = computeDerivedStats(
        c,
        this.characterStore.allWeapons(),
        this.characterStore.allPerkNodes(),
        this.resolveArmorsList()
      );
      const weight: ArmorWeightClass = target.armor_weight ?? 'Light';
      const nextInv = list.map((it) =>
        getInventoryItemCategory(it) === 'armor'
          ? { ...it, equipped: it.id === itemId }
          : it
      );
      const draft: CharacterModel = {
        ...c,
        equipped_armor: weight,
        inventory: nextInv,
      };
      const nextStats = computeDerivedStats(
        draft,
        this.characterStore.allWeapons(),
        this.characterStore.allPerkNodes(),
        this.resolveArmorsList()
      );
      const spGain = Math.max(0, nextStats.maxSp - oldStats.maxSp);
      return {
        ...draft,
        current_sp: Math.min(nextStats.maxSp, c.current_sp + spGain),
      };
    });
  }

  async unequipCharacterArmor(char: CharacterModel): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      equipped_armor: 'None',
      inventory: normalizeInventoryItems(c.inventory).map((it) =>
        getInventoryItemCategory(it) === 'armor'
          ? { ...it, equipped: false }
          : it
      ),
    }));
  }

  async patchInventoryItem(
    char: CharacterModel,
    itemId: string,
    patch: Partial<ActorInventoryItem>
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => {
      const nextInv = normalizeInventoryItems(c.inventory).map((it) =>
        it.id === itemId ? { ...it, ...patch } : it
      );
      const updatedTarget = nextInv.find((it) => it.id === itemId);
      const syncArmorTier =
        updatedTarget?.equipped &&
        getInventoryItemCategory(updatedTarget) === 'armor' &&
        updatedTarget.armor_weight
          ? updatedTarget.armor_weight
          : c.equipped_armor;
      return {
        ...c,
        equipped_armor: syncArmorTier,
        inventory: nextInv,
      };
    });
  }

  async updateInventoryItemField(
    char: CharacterModel,
    itemId: string,
    field: 'name' | 'description',
    value: string
  ): Promise<void> {
    await this.patchInventoryItem(char, itemId, { [field]: value });
  }

  async adjustInventoryItemQuantity(
    char: CharacterModel,
    itemId: string,
    delta: number
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      inventory: normalizeInventoryItems(c.inventory).map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      ),
    }));
  }

  async removeInventoryItem(
    char: CharacterModel,
    itemId: string
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      inventory: normalizeInventoryItems(c.inventory).filter(
        (item) => item.id !== itemId
      ),
    }));
  }

  async saveCharacterNotes(
    char: CharacterModel,
    notes: string
  ): Promise<void> {
    if (!this.canEditCharacter(char)) return;
    if ((char.notes ?? '') === notes) return;
    await this.characterStore.updateCharacter(char.id, (c) => ({
      ...c,
      notes,
    }));
  }
}
