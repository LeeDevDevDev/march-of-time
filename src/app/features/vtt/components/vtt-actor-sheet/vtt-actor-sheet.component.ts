import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';
import { UserAssetModel } from '../../../../core/assets/user-assets.model';
import {
  ActiveCombatTag,
  COMPENDIUM_ICON_PRESETS,
  ResolvedCompendiumVisuals,
  formatArtUpgradeBadges,
  formatWeaponHookBadges,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  pruneUnreachableUnlockedPerks,
  resolveNodeVisuals,
  resolveTreeVisuals,
  resolveWeaponVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { AssetBrowserModalComponent } from '../../../../shared/asset-browser/asset-browser-modal.component';
import { ColorPickerComponent } from '../../../../shared/color-picker/color-picker.component';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import {
  allocateFloatingWindowId,
  clampFloatingWindowCoords,
  computeFloatingWindowZIndex,
  focusFloatingWindow,
  releaseFloatingWindow,
} from '../../../../shared/floating-window-stack';
import { SkillTreeCanvasComponent } from '../../../../shared/skill-tree-canvas/skill-tree-canvas.component';
import { TokenAvatarComponent } from '../../../../shared/token-avatar/token-avatar.component';
import {
  TokenizerAssetPickerRequest,
  TokenizerEditorComponent,
  TokenizerVisualsPayload,
} from '../../../../shared/token-avatar/tokenizer-editor.component';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  ActorInventoryItem,
  ArmorTier,
  AttributeName,
  COMBAT_SKILL_LIST,
  CharacterModel,
  CombatSkillName,
  DerivedCharacterStats,
  FIELD_SKILL_LIST,
  FieldSkillName,
  PerkNodeModel,
  ResolvedCombatArt,
  SHIELD_TIERS,
  ShieldTier,
  SkillTreeModel,
  UPGRADE_SLOT_PREFIX,
  WeaponModel,
  formatRuleHookBadges,
  formatWeaponRequirementLabel,
  getUpgradeSlotKey,
  isCombatArtUpgradeNode,
  isStandalonePerkNode,
  isWeaponTwoHanded,
  normalizeInventoryItems,
} from '../../../characters/models/character.model';
import { CharacterStore } from '../../../characters/store/character.store';
import {
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  TokenAppearanceConfig,
  VttFaction,
  VttNpcStats,
  VttRosterActorModel,
  VttTokenModel,
  hasCustomTokenAppearance,
  resolveActorDarkvisionFeet,
  resolveEntityPortraitUrl,
  resolveEntityTokenAppearance,
  resolveEntityTokenImageUrl,
} from '../../models/vtt.model';
import { VttStore } from '../../store/vtt.store';

export type VttPcSheetTab = 'character' | 'loadout' | 'perks' | 'token';
export type VttNpcSheetTab = 'statblock' | 'inventory' | 'token';

function generateInventoryItemId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

@Component({
  selector: 'app-vtt-actor-sheet',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    AssetBrowserModalComponent,
    ColorPickerComponent,
    CompendiumIconComponent,
    SkillTreeCanvasComponent,
    TokenAvatarComponent,
    TokenizerEditorComponent,
  ],
  templateUrl: './vtt-actor-sheet.component.html',
})
export class VttActorSheetComponent {
  readonly vttStore = inject(VttStore);
  readonly authStore = inject(AuthStore);
  readonly characterStore = inject(CharacterStore);
  readonly compendiumStore = inject(CompendiumStore);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers: ArmorTier[] = ['None', 'Light', 'Medium', 'Heavy'];
  readonly shieldTiers: ShieldTier[] = ['None', 'Buckler', 'Heater', 'Tower'];
  readonly armorMeta = ARMOR_TIERS;
  readonly shieldMeta = SHIELD_TIERS;
  readonly iconPresets = COMPENDIUM_ICON_PRESETS;
  readonly maxSkillRank = 4;
  readonly combatTagOptions: (ActiveCombatTag | 'None')[] = [
    'None',
    'Crushing',
    'Sweeping',
    'Piercing',
  ];
  readonly tokenColorPresets: string[] = [
    '#38B29A',
    '#EF4444',
    '#F59E0B',
    '#38BDF8',
    '#A855F7',
    '#EC4899',
    '#C4491A',
    '#94A3B8',
  ];

  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;
  readonly isCombatArtUpgradeNode = isCombatArtUpgradeNode;

  readonly pcTab = signal<VttPcSheetTab>('character');
  readonly npcTab = signal<VttNpcSheetTab>('statblock');
  readonly perkPickerOpen = signal(false);
  readonly perkPickerTab = signal<string>('');
  readonly minimized = signal(false);
  readonly activeAssetPickerRequest = signal<TokenizerAssetPickerRequest | null>(
    null
  );
  readonly brokenPortraitUrl = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly windowId = allocateFloatingWindowId();

  readonly windowX = signal(88);
  readonly windowY = signal(64);
  readonly isDraggingWindow = signal(false);
  readonly zIndex = computed(() => computeFloatingWindowZIndex(this.windowId));

  private dragPointerOffsetX = 0;
  private dragPointerOffsetY = 0;
  private lastTargetKey = '';

  readonly isOpen = computed(() => {
    if (!this.vttStore.openSheetTarget()) return false;
    return Boolean(
      this.vttStore.openSheetCharacter() ||
        this.vttStore.openSheetRosterActor() ||
        this.vttStore.openSheetToken()
    );
  });

  readonly sheetMode = computed<'character' | 'npc'>(() => {
    if (this.vttStore.openSheetCharacter()) return 'character';
    const actor = this.vttStore.openSheetRosterActor();
    if (actor) {
      return actor.actor_kind === 'npc' ? 'npc' : 'character';
    }
    const tok = this.vttStore.openSheetToken();
    if (tok?.character_id) return 'character';
    return 'npc';
  });

  readonly canEdit = computed(() => this.vttStore.canEditOpenSheet());

  readonly resolvedVisuals = computed<{
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  }>(() => {
    const char = this.vttStore.openSheetCharacter();
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    if (char) {
      return {
        portraitUrl: resolveEntityPortraitUrl(char, actor, tok),
        tokenImageUrl: resolveEntityTokenImageUrl(char, actor, tok),
        tokenAppearance: resolveEntityTokenAppearance(char, actor, tok),
      };
    }
    return {
      portraitUrl: resolveEntityPortraitUrl(tok, actor),
      tokenImageUrl: resolveEntityTokenImageUrl(tok, actor),
      tokenAppearance: resolveEntityTokenAppearance(tok, actor),
    };
  });

  readonly displayPortraitUrl = computed<string | null>(() => {
    const url = this.resolvedVisuals().portraitUrl;
    if (!url || this.brokenPortraitUrl() === url) return null;
    return url;
  });

  readonly hasCustomToken = computed<boolean>(() => {
    const vis = this.resolvedVisuals();
    return (
      Boolean(vis.tokenImageUrl) ||
      hasCustomTokenAppearance(vis.tokenAppearance)
    );
  });

  readonly canGrantStandalone = computed(
    () => this.vttStore.isGm() || this.authStore.isAdmin()
  );

  readonly effectivePickerTab = computed(() => {
    const tab = this.perkPickerTab();
    if (tab === '__standalone__' && this.canGrantStandalone()) {
      return '__standalone__';
    }
    const trees = this.compendiumStore.skillTrees();
    if (tab && trees.some((t) => t.id === tab)) return tab;
    return (
      trees[0]?.id ?? (this.canGrantStandalone() ? '__standalone__' : '')
    );
  });

  readonly activePickerTree = computed<SkillTreeModel | null>(() => {
    const tab = this.effectivePickerTab();
    if (!tab || tab === '__standalone__') return null;
    return this.compendiumStore.skillTrees().find((t) => t.id === tab) ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      releaseFloatingWindow(this.windowId);
    });

    effect(() => {
      const t = this.vttStore.openSheetTarget();
      const key = t
        ? `${t.rosterActorId ?? ''}|${t.characterId ?? ''}|${t.tokenId ?? ''}`
        : '';
      if (key && key !== this.lastTargetKey) {
        this.minimized.set(false);
        this.perkPickerOpen.set(false);
        this.activeAssetPickerRequest.set(null);
        untracked(() => {
          focusFloatingWindow(this.windowId);
        });
      } else if (!key && this.lastTargetKey) {
        this.activeAssetPickerRequest.set(null);
        untracked(() => {
          releaseFloatingWindow(this.windowId);
        });
      }
      this.lastTargetKey = key;
    });
  }

  openTokenizerTab(): void {
    this.minimized.set(false);
    if (this.sheetMode() === 'character') {
      this.pcTab.set('token');
    } else {
      this.npcTab.set('token');
    }
  }

  openTokenizerAssetPicker(req: TokenizerAssetPickerRequest): void {
    if (!this.canEdit()) return;
    this.activeAssetPickerRequest.set(req);
  }

  closeTokenizerAssetPicker(): void {
    this.activeAssetPickerRequest.set(null);
  }

  onTokenizerAssetSelected(asset: UserAssetModel): void {
    const req = this.activeAssetPickerRequest();
    this.activeAssetPickerRequest.set(null);
    if (req && asset?.public_url) {
      req.apply(asset.public_url);
    }
  }

  async onTokenizerVisualsChange(
    payload: TokenizerVisualsPayload
  ): Promise<void> {
    if (!this.canEdit()) return;
    const char = this.vttStore.openSheetCharacter();
    if (this.sheetMode() === 'character' && char) {
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
        ...c,
        portrait_url: payload.portrait_url,
        token_image_url: payload.token_image_url,
        token_appearance: payload.token_appearance,
      }));
      return;
    }
    await this.patchSheetActorOrToken({
      portrait_url: payload.portrait_url,
      token_image_url: payload.token_image_url,
      token_appearance: payload.token_appearance,
    });
  }

  focusWindow(): void {
    focusFloatingWindow(this.windowId);
  }

  onHeaderPointerDown(event: PointerEvent): void {
    this.focusWindow();
    if (event.button !== 0) return;
    const el = event.target as HTMLElement | null;
    if (el?.closest('button, input, select, textarea, a, label, kbd')) {
      return;
    }
    event.preventDefault();
    this.isDraggingWindow.set(true);
    this.dragPointerOffsetX = event.clientX - this.windowX();
    this.dragPointerOffsetY = event.clientY - this.windowY();
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isDraggingWindow()) return;
    const clamped = clampFloatingWindowCoords(
      event.clientX - this.dragPointerOffsetX,
      event.clientY - this.dragPointerOffsetY
    );
    this.windowX.set(clamped.x);
    this.windowY.set(clamped.y);
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    if (this.isDraggingWindow()) {
      this.isDraggingWindow.set(false);
    }
  }

  @HostListener('window:pointercancel')
  onWindowPointerCancel(): void {
    if (this.isDraggingWindow()) {
      this.isDraggingWindow.set(false);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const clamped = clampFloatingWindowCoords(this.windowX(), this.windowY());
    if (clamped.x !== this.windowX()) {
      this.windowX.set(clamped.x);
    }
    if (clamped.y !== this.windowY()) {
      this.windowY.set(clamped.y);
    }
  }

  closeSheet(): void {
    this.vttStore.closeActorSheet();
  }

  toggleMinimize(): void {
    this.minimized.update((v) => !v);
  }

  getDisplayIcon(): string {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    const stats = this.vttStore.openSheetDerived();
    if (actor?.icon) return actor.icon;
    if (tok?.icon) return tok.icon;
    if (stats?.activeWeapon) {
      return resolveWeaponVisuals(stats.activeWeapon).icon;
    }
    return this.sheetMode() === 'npc' ? 'battleaxe' : 'greatsword';
  }

  getDisplayColor(): string {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    if (actor?.color) return actor.color;
    if (tok?.color) return tok.color;
    return this.sheetMode() === 'npc' ? '#EF4444' : '#38B29A';
  }

  getDisplayFaction(): VttFaction {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    return actor?.faction ?? tok?.faction ?? 'ally';
  }

  getVisionFeet(): number {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    return (
      actor?.vision_feet ?? tok?.vision_feet ?? DEFAULT_VTT_DIM_VISION_FEET
    );
  }

  getDarkvisionFeet(): number {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    if (actor) {
      return resolveActorDarkvisionFeet(actor.darkvision_feet, actor.npc_stats);
    }
    if (tok) {
      return resolveActorDarkvisionFeet(tok.darkvision_feet, tok.npc_stats);
    }
    return DEFAULT_VTT_DARKVISION_FEET;
  }

  focusTokenFromSheet(): void {
    const tok = this.vttStore.openSheetToken();
    if (tok) {
      this.vttStore.selectedTokenId.set(tok.id);
    }
  }

  async initializeFullCharacterSheet(): Promise<void> {
    const actor = this.vttStore.openSheetRosterActor();
    if (!actor) return;
    await this.vttStore.initializeLinkedCharacterForActor(actor.id);
  }

  async saveCharacterName(char: CharacterModel, rawName: string): Promise<void> {
    if (!this.canEdit()) return;
    const trimmed = rawName.trim();
    if (!trimmed || trimmed === char.name) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      name: trimmed,
    }));
  }

  getAssignedPlayerId(): string {
    const actor = this.vttStore.openSheetRosterActor();
    if (actor) {
      return this.vttStore.getActorAssignedUserId(actor) ?? '';
    }
    const tok = this.vttStore.openSheetToken();
    if (tok) {
      return this.vttStore.getTokenAssignedUserId(tok) ?? '';
    }
    return '';
  }

  async changeAssignedPlayer(userId: string): Promise<void> {
    const normalized = userId.trim() || null;
    const actor = this.vttStore.openSheetRosterActor();
    if (actor) {
      await this.vttStore.assignRosterActorToPlayer(actor.id, normalized);
      return;
    }
    const tok = this.vttStore.openSheetToken();
    if (tok) {
      await this.vttStore.assignTokenToPlayer(tok.id, normalized);
    }
  }

  async adjustCharacterVital(
    char: CharacterModel,
    stats: DerivedCharacterStats,
    field: 'current_hp' | 'current_sp' | 'current_ap',
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const max =
      field === 'current_hp'
        ? stats.maxHp
        : field === 'current_sp'
          ? stats.maxSp
          : 8;
    const nextVal = Math.max(0, Math.min(max, (char[field] ?? 0) + delta));
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      [field]: nextVal,
    }));
  }

  async adjustAttribute(
    char: CharacterModel,
    stats: DerivedCharacterStats,
    attr: AttributeName,
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const curr = char.attributes[attr] ?? 0;
    if (delta > 0 && (curr >= 5 || stats.attributeSpent >= stats.attributeBudget)) {
      return;
    }
    if (delta < 0 && curr <= 0) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      attributes: {
        ...c.attributes,
        [attr]: Math.max(0, Math.min(5, (c.attributes[attr] ?? 0) + delta)),
      },
    }));
  }

  async adjustCombatSkill(
    char: CharacterModel,
    stats: DerivedCharacterStats,
    skill: CombatSkillName,
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const curr = char.combat_skills[skill] ?? 0;
    if (
      delta > 0 &&
      (curr >= this.maxSkillRank || stats.combatSkillSpent >= stats.combatSkillBudget)
    ) {
      return;
    }
    if (delta < 0 && curr <= 0) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      combat_skills: {
        ...c.combat_skills,
        [skill]: Math.max(
          0,
          Math.min(this.maxSkillRank, (c.combat_skills[skill] ?? 0) + delta)
        ),
      },
    }));
  }

  async adjustFieldSkill(
    char: CharacterModel,
    stats: DerivedCharacterStats,
    skill: FieldSkillName,
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const curr = char.field_skills[skill] ?? 0;
    if (
      delta > 0 &&
      (curr >= this.maxSkillRank || stats.fieldSkillSpent >= stats.fieldSkillBudget)
    ) {
      return;
    }
    if (delta < 0 && curr <= 0) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      field_skills: {
        ...c.field_skills,
        [skill]: Math.max(
          0,
          Math.min(this.maxSkillRank, (c.field_skills[skill] ?? 0) + delta)
        ),
      },
    }));
  }

  async changeEquippedArmor(
    char: CharacterModel,
    armor: ArmorTier
  ): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      equipped_armor: armor,
    }));
  }

  async changeEquippedShield(
    char: CharacterModel,
    shield: ShieldTier
  ): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      equipped_shield: shield,
    }));
  }

  async changeWeaponSlot(
    char: CharacterModel,
    slot: 1 | 2,
    weaponIdRaw: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    const weaponId = weaponIdRaw ? weaponIdRaw : null;
    const chosenWeapon = weaponId
      ? this.compendiumStore.allWeapons().find((w) => w.id === weaponId) ?? null
      : null;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const nextSlot1 = slot === 1 ? weaponId : c.weapon_slot_1_id;
      const nextSlot2 = slot === 2 ? weaponId : c.weapon_slot_2_id;
      const activeId =
        c.active_weapon_slot === 1 ? nextSlot1 : nextSlot2;
      const activeWep =
        activeId === weaponId
          ? chosenWeapon
          : activeId
            ? this.compendiumStore.allWeapons().find((w) => w.id === activeId) ??
              null
            : null;
      const clearShield = isWeaponTwoHanded(activeWep);
      return {
        ...c,
        weapon_slot_1_id: nextSlot1,
        weapon_slot_2_id: nextSlot2,
        equipped_shield: clearShield ? 'None' : c.equipped_shield,
      };
    });
  }

  async setActiveWeaponSlot(
    char: CharacterModel,
    slot: 1 | 2
  ): Promise<void> {
    if (!this.canEdit() || char.active_weapon_slot === slot) return;
    const tok = this.vttStore.openSheetToken();
    if (tok && this.vttStore.activeScene()?.combat_active) {
      await this.vttStore.switchCharacterWeaponSlotInVtt(tok);
      return;
    }
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      active_weapon_slot: slot,
    }));
  }

  isTwoHanded(w: WeaponModel | null | undefined): boolean {
    return isWeaponTwoHanded(w);
  }

  getWeaponHookBadges(weapon: WeaponModel | null | undefined): string[] {
    return formatWeaponHookBadges(weapon);
  }

  getCharacterInventory(char: CharacterModel): ActorInventoryItem[] {
    const direct = normalizeInventoryItems(char.inventory);
    if (direct.length > 0) return direct;
    const actor = this.vttStore.openSheetRosterActor();
    return normalizeInventoryItems(actor?.npc_stats?.__inventory);
  }

  async addCharacterInventoryItem(char: CharacterModel): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getCharacterInventory(char);
    const next: ActorInventoryItem = {
      id: generateInventoryItemId(),
      name: 'New Item',
      quantity: 1,
      description: '',
    };
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      inventory: [...items, next],
    }));
  }

  async updateCharacterInventoryField(
    char: CharacterModel,
    itemId: string,
    field: 'name' | 'description',
    value: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getCharacterInventory(char);
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      inventory: items.map((it) =>
        it.id === itemId ? { ...it, [field]: value } : it
      ),
    }));
  }

  async adjustCharacterInventoryQty(
    char: CharacterModel,
    itemId: string,
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getCharacterInventory(char);
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      inventory: items.map((it) =>
        it.id === itemId
          ? { ...it, quantity: Math.max(0, it.quantity + delta) }
          : it
      ),
    }));
  }

  async removeCharacterInventoryItem(
    char: CharacterModel,
    itemId: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getCharacterInventory(char);
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      inventory: items.filter((it) => it.id !== itemId),
    }));
  }

  async saveCharacterNotes(
    char: CharacterModel,
    notes: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    if ((char.notes ?? '') === notes) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      notes,
    }));
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  getHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  getArtUpgradeBadges(node: PerkNodeModel): string[] {
    return formatArtUpgradeBadges(node.rule_hooks?.__art_upgrade);
  }

  getPerkOriginLabel(node: PerkNodeModel): string {
    if (isStandalonePerkNode(node)) return 'GRANTED';
    return (
      this.compendiumStore
        .skillTrees()
        .find((t) => t.id === node.tree_id)?.name ?? 'Skill Tree'
    );
  }

  countUnlockedInTree(char: CharacterModel, treeId: string): number {
    const unlocked = new Set(char.unlocked_perk_ids);
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId && unlocked.has(p.id)).length;
  }

  countUnlockedStandalone(char: CharacterModel): number {
    const unlocked = new Set(char.unlocked_perk_ids);
    return this.compendiumStore
      .standaloneNodes()
      .filter((p) => unlocked.has(p.id)).length;
  }

  async setArtUpgradeSlot(
    char: CharacterModel,
    upgradeNodeId: string,
    targetArtId: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const nextCd = { ...(c.active_cooldowns ?? {}) };
      const slotKey = getUpgradeSlotKey(upgradeNodeId);
      if (targetArtId) {
        nextCd[slotKey] = targetArtId;
      } else {
        delete nextCd[slotKey];
      }
      return {
        ...c,
        active_cooldowns: nextCd,
      };
    });
  }

  async toggleCharacterPerk(
    char: CharacterModel,
    node: PerkNodeModel
  ): Promise<void> {
    if (!this.canEdit()) return;
    if (isStandalonePerkNode(node)) {
      if (!this.canGrantStandalone()) return;
      const has = char.unlocked_perk_ids.includes(node.id);
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
        const nextCd = { ...(c.active_cooldowns ?? {}) };
        if (has) {
          delete nextCd[node.id];
          delete nextCd[getUpgradeSlotKey(node.id)];
          for (const [k, val] of Object.entries(nextCd)) {
            if (k.startsWith(UPGRADE_SLOT_PREFIX) && val === node.id) {
              delete nextCd[k];
            }
          }
        }
        return {
          ...c,
          unlocked_perk_ids: has
            ? c.unlocked_perk_ids.filter((id) => id !== node.id)
            : [...c.unlocked_perk_ids, node.id],
          active_cooldowns: nextCd,
        };
      });
      return;
    }

    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const has = c.unlocked_perk_ids.includes(node.id);
      if (has) {
        const allNodes = this.compendiumStore.allPerkNodes();
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

  async rollSheetCheck(
    speakerName: string,
    label: string,
    modifier: number,
    detail?: string
  ): Promise<void> {
    const vis = this.resolvedVisuals();
    await this.vttStore.rollActorSheetCheck({
      speakerName,
      speakerColor: this.getDisplayColor(),
      speakerIcon: this.getDisplayIcon(),
      speakerFaction: this.getDisplayFaction(),
      speakerPortraitUrl: vis.portraitUrl,
      speakerTokenImageUrl: vis.tokenImageUrl,
      speakerTokenAppearance: vis.tokenAppearance,
      label,
      modifier,
      detail,
    });
  }

  targetWeaponOnMap(stats?: DerivedCharacterStats | null): void {
    const tok = this.vttStore.openSheetToken();
    if (!tok) return;
    this.vttStore.selectedTokenId.set(tok.id);
    if (stats) {
      this.vttStore.beginWeaponTargetSelection(tok, stats.activeWeapon, stats);
    } else {
      this.vttStore.beginWeaponTargetSelection(tok);
    }
  }

  targetCombatArtOnMap(
    art: ResolvedCombatArt,
    stats: DerivedCharacterStats
  ): void {
    const tok = this.vttStore.openSheetToken();
    if (!tok) return;
    this.vttStore.selectedTokenId.set(tok.id);
    this.vttStore.beginCombatArtTargetSelection(tok, art, stats);
  }

  formatWeaponReq(req: ResolvedCombatArt['weaponRequirement']): string {
    return (
      formatWeaponRequirementLabel(req, this.compendiumStore.allWeapons()) ??
      'matching weapon'
    );
  }

  getNpcName(): string {
    return (
      this.vttStore.openSheetRosterActor()?.name ??
      this.vttStore.openSheetToken()?.name ??
      'NPC'
    );
  }

  getNpcMaxVital(field: 'max_hp' | 'max_sp' | 'max_ap'): number {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    if (actor) return actor[field];
    if (tok) return tok[field];
    return field === 'max_hp' ? 8 : 4;
  }

  getNpcArmorOrMove(
    field: 'armor_dr' | 'shield_block' | 'move_feet' | 'size'
  ): number {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    if (actor) return actor[field];
    if (tok) return tok[field];
    return field === 'move_feet' ? 20 : field === 'size' ? 1 : 0;
  }

  getNpcStats(): VttNpcStats {
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    return actor?.npc_stats ?? tok?.npc_stats ?? {};
  }

  getNpcInventory(): ActorInventoryItem[] {
    return normalizeInventoryItems(this.getNpcStats().__inventory);
  }

  getNpcNotes(): string {
    return this.vttStore.openSheetRosterActor()?.notes ?? '';
  }

  async patchSheetActorOrToken(
    patch: Partial<VttRosterActorModel>
  ): Promise<void> {
    if (!this.canEdit()) return;
    const actor = this.vttStore.openSheetRosterActor();
    const tok = this.vttStore.openSheetToken();
    await this.vttStore.updateNpcFromVttSheet(
      actor?.id ?? null,
      tok?.id ?? null,
      patch
    );
  }

  async adjustTokenCurrentVital(
    tok: VttTokenModel,
    field: 'current_hp' | 'current_sp' | 'current_ap',
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const maxField =
      field === 'current_hp'
        ? tok.max_hp
        : field === 'current_sp'
          ? tok.max_sp
          : tok.max_ap;
    const nextVal = Math.max(0, Math.min(maxField, tok[field] + delta));
    await this.vttStore.patchToken(tok.id, { [field]: nextVal });
  }

  async patchNpcStatsField(patch: Partial<VttNpcStats>): Promise<void> {
    if (!this.canEdit()) return;
    const curr = this.getNpcStats();
    await this.patchSheetActorOrToken({
      npc_stats: {
        ...curr,
        ...patch,
      },
    });
  }

  async applyCompendiumWeaponToNpc(weaponId: string): Promise<void> {
    if (!this.canEdit() || !weaponId) return;
    const wep = this.compendiumStore
      .allWeapons()
      .find((w) => w.id === weaponId);
    if (!wep) return;
    const reachFeet = Math.max(5, Math.round((wep.reach_tiles ?? 1) * 5));
    await this.patchNpcStatsField({
      weapon_name: wep.name,
      attack_ap: wep.ap_cost ?? 1,
      flat_damage: wep.base_damage ?? 3,
      reach_feet: reachFeet,
    });
  }

  async addNpcInventoryItem(): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getNpcInventory();
    const next: ActorInventoryItem = {
      id: generateInventoryItemId(),
      name: 'New Item',
      quantity: 1,
      description: '',
    };
    await this.patchNpcStatsField({
      __inventory: [...items, next],
    });
  }

  async updateNpcInventoryField(
    itemId: string,
    field: 'name' | 'description',
    value: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getNpcInventory();
    await this.patchNpcStatsField({
      __inventory: items.map((it) =>
        it.id === itemId ? { ...it, [field]: value } : it
      ),
    });
  }

  async adjustNpcInventoryQty(itemId: string, delta: number): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getNpcInventory();
    await this.patchNpcStatsField({
      __inventory: items.map((it) =>
        it.id === itemId
          ? { ...it, quantity: Math.max(0, it.quantity + delta) }
          : it
      ),
    });
  }

  async removeNpcInventoryItem(itemId: string): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getNpcInventory();
    await this.patchNpcStatsField({
      __inventory: items.filter((it) => it.id !== itemId),
    });
  }

  async updateVisionFeet(raw: number): Promise<void> {
    if (!this.canEdit()) return;
    const val = Math.max(0, Math.round(Number(raw) || 0));
    await this.patchSheetActorOrToken({ vision_feet: val });
  }

  async updateDarkvisionFeet(raw: number): Promise<void> {
    if (!this.canEdit()) return;
    const val = Math.max(0, Math.round(Number(raw) || 0));
    await this.patchSheetActorOrToken({ darkvision_feet: val });
  }
}
