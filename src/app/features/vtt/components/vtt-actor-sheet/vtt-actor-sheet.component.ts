import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/auth/auth.store';
import {
  ARMOR_WEIGHT_OPTIONS,
  ActiveCombatTag,
  ArmorModel,
  ArmorWeightClass,
  COMPENDIUM_ICON_PRESETS,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ARMORS,
  DEFAULT_COMPENDIUM_ITEMS,
  ITEM_SUBCATEGORY_OPTIONS,
  ResolvedCompendiumVisuals,
  formatArtUpgradeBadges,
  formatWeaponHookBadges,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  isCompendiumItemActive,
  pruneUnreachableUnlockedPerks,
  resolveArmorVisuals,
  resolveCompendiumItemVisuals,
  resolveNodeVisuals,
  resolveTreeVisuals,
  resolveWeaponVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../../core/notifications/notification.store';
import { VttSettingsStore } from '../../../../core/settings/vtt-settings.store';
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
import { TOKEN_FRAME_PRESETS } from '../../../../shared/token-avatar/token-appearance.model';
import { TokenAvatarComponent } from '../../../../shared/token-avatar/token-avatar.component';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  ActorInventoryItem,
  ArmorTier,
  AttributeName,
  COMBAT_SKILL_LIST,
  CharacterModel,
  CharacterWeaponFormulaSummary,
  CombatSkillName,
  DerivedCharacterStats,
  FIELD_SKILL_LIST,
  FieldSkillName,
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
  isCombatArtUpgradeNode,
  isStandalonePerkNode,
  isWeaponHeavy,
  isWeaponTwoHanded,
  mergeInventoryEntry,
  normalizeInventoryItems,
} from '../../../characters/models/character.model';
import { CharacterStore } from '../../../characters/store/character.store';
import {
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  ResolvedNpcWeaponStats,
  TokenAppearanceConfig,
  VTT_COMPENDIUM_DRAG_MIME,
  VttCompendiumDragPayload,
  VttFaction,
  VttNpcStats,
  VttRosterActorModel,
  VttTokenModel,
  computeNpcFieldSkillTotals,
  computeNpcWeaponFormula,
  hasCustomTokenAppearance,
  hasRosterActorExternalSource,
  normalizeNpcAttributes,
  normalizeNpcCombatSkills,
  normalizeNpcFieldSkills,
  resolveActorDarkvisionFeet,
  resolveActorTokenDisplayName,
  resolveEffectiveNpcWeaponStats,
  resolveEntityPortraitUrl,
  resolveEntityTokenAppearance,
  resolveEntityTokenImageUrl,
  resolveRosterActorSourceCharacterId,
} from '../../models/vtt.model';
import { VttOpenSheetTarget, VttStore } from '../../store/vtt.store';

export type VttPcSheetTab =
  | 'actions'
  | 'character'
  | 'loadout'
  | 'perks'
  | 'token';
export type VttNpcSheetTab =
  | 'actions'
  | 'skills'
  | 'inventory'
  | 'token';
export type VttSheetDropZone = 'sheet' | 'slot-1' | 'slot-2' | 'inventory';

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
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    ColorPickerComponent,
    CompendiumIconComponent,
    SkillTreeCanvasComponent,
    TokenAvatarComponent,
  ],
  templateUrl: './vtt-actor-sheet.component.html',
})
export class VttActorSheetComponent {
  readonly vttStore = inject(VttStore);
  readonly settingsStore = inject(VttSettingsStore);
  readonly authStore = inject(AuthStore);
  readonly characterStore = inject(CharacterStore);
  readonly compendiumStore = inject(CompendiumStore);
  private readonly notifications = inject(NotificationStore);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers: ArmorTier[] = ['None', 'Light', 'Medium', 'Heavy'];
  readonly armorWeights: readonly ArmorWeightClass[] = ARMOR_WEIGHT_OPTIONS;
  readonly shieldTiers: ShieldTier[] = ['None', 'Buckler', 'Heater', 'Tower'];
  readonly armorMeta = ARMOR_TIERS;
  readonly shieldMeta = SHIELD_TIERS;
  readonly iconPresets = COMPENDIUM_ICON_PRESETS;
  readonly itemSubcategories = ITEM_SUBCATEGORY_OPTIONS;
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
  readonly isStandaloneNode = isStandalonePerkNode;

  readonly targetInput = input<VttOpenSheetTarget | null>(null, {
    alias: 'target',
  });
  readonly sheetKeyInput = input<string | null>(null, { alias: 'sheetKey' });
  readonly focusTickInput = input<number>(0, { alias: 'focusTick' });
  readonly windowIndexInput = input<number>(0, { alias: 'windowIndex' });
  readonly windowIdInput = input<number | null>(null, { alias: 'windowId' });

  readonly pcTab = signal<VttPcSheetTab>('actions');
  readonly npcTab = signal<VttNpcSheetTab>('actions');
  readonly pcInventoryTab = signal<InventoryFilterTab>('all');
  readonly npcInventoryTab = signal<InventoryFilterTab>('all');
  readonly perkPickerOpen = signal(false);
  readonly perkPickerTab = signal<string>('');
  readonly minimized = signal(false);
  readonly brokenPortraitUrl = signal<string | null>(null);
  readonly activeDropZone = signal<VttSheetDropZone | null>(null);
  readonly isReimporting = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly fallbackWindowId = allocateFloatingWindowId();
  readonly activeWindowId = computed(
    () => this.windowIdInput() ?? this.fallbackWindowId
  );

  readonly windowX = signal(88);
  readonly windowY = signal(64);
  readonly isDraggingWindow = signal(false);
  readonly zIndex = computed(() =>
    computeFloatingWindowZIndex(this.activeWindowId())
  );

  private dragPointerOffsetX = 0;
  private dragPointerOffsetY = 0;
  private lastTargetKey = '';
  private lastHandledFocusTick = 0;
  private hasInitializedPosition = false;

  readonly effectiveTarget = computed<VttOpenSheetTarget | null>(
    () => this.targetInput() ?? this.vttStore.openSheetTarget()
  );

  readonly sheetRosterActor = computed<VttRosterActorModel | null>(() =>
    this.vttStore.resolveTargetRosterActor(this.effectiveTarget())
  );

  readonly sheetToken = computed<VttTokenModel | null>(() =>
    this.vttStore.resolveTargetToken(this.effectiveTarget())
  );

  readonly sheetCharacter = computed<CharacterModel | null>(() =>
    this.vttStore.resolveTargetCharacter(this.effectiveTarget())
  );

  readonly sheetDerived = computed<DerivedCharacterStats | null>(() =>
    this.vttStore.computeDerivedForCharacter(this.sheetCharacter())
  );

  readonly isOpen = computed(() => {
    if (!this.effectiveTarget()) return false;
    return Boolean(
      this.sheetCharacter() || this.sheetRosterActor() || this.sheetToken()
    );
  });

  readonly sheetMode = computed<'character' | 'npc'>(() => {
    if (this.sheetCharacter()) return 'character';
    const actor = this.sheetRosterActor();
    if (actor) {
      return actor.actor_kind === 'npc' ? 'npc' : 'character';
    }
    const tok = this.sheetToken();
    if (this.vttStore.resolveCharacterForToken(tok)) return 'character';
    return 'npc';
  });

  readonly sourceCharacterId = computed<string | null>(() => {
    const fromActor = resolveRosterActorSourceCharacterId(
      this.sheetRosterActor()
    );
    if (fromActor) return fromActor;
    const fromTok = this.sheetToken()?.npc_stats?.__source_character_id;
    return typeof fromTok === 'string' && fromTok.trim().length > 0
      ? fromTok.trim()
      : null;
  });

  readonly canEdit = computed(() =>
    this.vttStore.canEditTarget(this.effectiveTarget())
  );

  readonly canReimportFromSource = computed<boolean>(() =>
    Boolean(
      this.canEdit() && hasRosterActorExternalSource(this.sheetRosterActor())
    )
  );

  readonly resolvedVisuals = computed<{
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  }>(() => {
    const char = this.sheetCharacter();
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
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
    const trees = this.getSkillTrees();
    if (tab && trees.some((t) => t.id === tab)) return tab;
    return (
      trees[0]?.id ?? (this.canGrantStandalone() ? '__standalone__' : '')
    );
  });

  readonly activePickerTree = computed<SkillTreeModel | null>(() => {
    const tab = this.effectivePickerTab();
    if (!tab || tab === '__standalone__') return null;
    return this.getSkillTrees().find((t) => t.id === tab) ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      releaseFloatingWindow(this.activeWindowId());
    });

    effect(() => {
      const t = this.effectiveTarget();
      const key =
        this.sheetKeyInput() ||
        (t
          ? `${t.rosterActorId ?? ''}|${t.characterId ?? ''}|${t.tokenId ?? ''}`
          : '');
      if (key && key !== this.lastTargetKey) {
        this.minimized.set(false);
        this.perkPickerOpen.set(false);
        this.activeDropZone.set(null);
        untracked(() => {
          if (!this.hasInitializedPosition) {
            this.hasInitializedPosition = true;
            const idx = Math.max(0, this.windowIndexInput());
            const vw =
              typeof window !== 'undefined' ? window.innerWidth : 1280;
            let initX = 72 + (idx % 6) * 44;
            let initY = 60 + (idx % 6) * 30;
            if (idx === 1 && vw >= 1480) {
              initX = 772;
              initY = 60;
            }
            const clamped = clampFloatingWindowCoords(initX, initY);
            this.windowX.set(clamped.x);
            this.windowY.set(clamped.y);
          }
          if (this.windowIdInput() === null) {
            focusFloatingWindow(this.fallbackWindowId);
          }
        });
      } else if (!key && this.lastTargetKey) {
        this.activeDropZone.set(null);
        if (this.windowIdInput() === null) {
          untracked(() => {
            releaseFloatingWindow(this.fallbackWindowId);
          });
        }
      }
      this.lastTargetKey = key;
    });

    effect(() => {
      const tick = this.focusTickInput();
      if (tick > 0 && tick !== this.lastHandledFocusTick) {
        const wasInitial = this.lastHandledFocusTick === 0;
        this.lastHandledFocusTick = tick;
        if (!wasInitial) {
          untracked(() => {
            this.minimized.set(false);
            focusFloatingWindow(this.activeWindowId());
          });
        }
      }
    });
  }

  readonly activeFrameLabel = computed<string>(() => {
    const frameId = this.resolvedVisuals().tokenAppearance.frame;
    return (
      TOKEN_FRAME_PRESETS.find((p) => p.id === frameId)?.label ?? 'Simple Ring'
    );
  });

  openTokenizerWindow(): void {
    if (!this.canEdit()) return;
    const target = this.effectiveTarget();
    if (!target) return;
    this.vttStore.openTokenizerStudio(target);
  }

  focusWindow(): void {
    focusFloatingWindow(this.activeWindowId());
    const key = this.sheetKeyInput();
    if (key) {
      this.vttStore.focusOpenSheetWindow(key);
      const match = this.vttStore
        .openSheetWindows()
        .find((e) => e.key === key);
      if (match) {
        this.lastHandledFocusTick = match.focusTick;
      }
    }
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
    const key = this.sheetKeyInput();
    if (key) {
      this.vttStore.closeSheetWindow(key);
      return;
    }
    this.vttStore.closeActorSheet();
  }

  toggleMinimize(): void {
    this.minimized.update((v) => !v);
  }

  getDisplayIcon(): string {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    const stats = this.sheetDerived();
    if (actor?.icon) return actor.icon;
    if (tok?.icon) return tok.icon;
    if (stats?.activeWeapon) {
      return resolveWeaponVisuals(stats.activeWeapon).icon;
    }
    return this.sheetMode() === 'npc' ? 'battleaxe' : 'greatsword';
  }

  getDisplayColor(): string {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    if (actor?.color) return actor.color;
    if (tok?.color) return tok.color;
    return this.sheetMode() === 'npc' ? '#EF4444' : '#38B29A';
  }

  getDisplayFaction(): VttFaction {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    return actor?.faction ?? tok?.faction ?? 'ally';
  }

  getVisionFeet(): number {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    return (
      actor?.vision_feet ?? tok?.vision_feet ?? DEFAULT_VTT_DIM_VISION_FEET
    );
  }

  getDarkvisionFeet(): number {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    if (actor) {
      return resolveActorDarkvisionFeet(actor.darkvision_feet, actor.npc_stats);
    }
    if (tok) {
      return resolveActorDarkvisionFeet(tok.darkvision_feet, tok.npc_stats);
    }
    return DEFAULT_VTT_DARKVISION_FEET;
  }

  focusTokenFromSheet(): void {
    const tok = this.sheetToken();
    if (tok) {
      this.vttStore.selectedTokenId.set(tok.id);
    }
  }

  async initializeFullCharacterSheet(): Promise<void> {
    const actor = this.sheetRosterActor();
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
    const actor = this.sheetRosterActor();
    if (actor) {
      return this.vttStore.getActorAssignedUserId(actor) ?? '';
    }
    const tok = this.sheetToken();
    if (tok) {
      return this.vttStore.getTokenAssignedUserId(tok) ?? '';
    }
    return '';
  }

  async changeAssignedPlayer(userId: string): Promise<void> {
    const normalized = userId.trim() || null;
    const actor = this.sheetRosterActor();
    if (actor) {
      await this.vttStore.assignRosterActorToPlayer(actor.id, normalized);
      return;
    }
    const tok = this.sheetToken();
    if (tok) {
      await this.vttStore.assignTokenToPlayer(tok.id, normalized);
    }
  }

  async reimportFromOriginalSheet(): Promise<void> {
    if (!this.canReimportFromSource() || this.isReimporting()) return;
    const actor = this.sheetRosterActor();
    if (!actor) return;
    this.isReimporting.set(true);
    try {
      await this.vttStore.reimportRosterActorFromSource(actor.id);
    } finally {
      this.isReimporting.set(false);
    }
  }

  async adjustCharacterVital(
    char: CharacterModel,
    stats: DerivedCharacterStats,
    field: 'current_hp' | 'current_sp' | 'current_ap',
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    if (field === 'current_sp' && delta < 0) {
      const unclampedSp = (char.current_sp ?? 0) + delta;
      if (
        unclampedSp < 0 &&
        this.settingsStore.preferences().overflowSpDamageToHp
      ) {
        const overflow = Math.abs(unclampedSp);
        await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
          ...c,
          current_sp: 0,
          current_hp: Math.max(0, (c.current_hp ?? 0) - overflow),
        }));
        return;
      }
    }
    const prevVal = char[field] ?? 0;
    const max =
      field === 'current_hp'
        ? stats.maxHp
        : field === 'current_sp'
          ? stats.maxSp
          : 8;
    const nextVal = Math.max(0, Math.min(max, prevVal + delta));
    if (nextVal === prevVal) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      [field]: nextVal,
    }));
    if (field === 'current_ap') {
      const tok = this.sheetToken();
      if (tok) {
        await this.vttStore.logManualApAdjustment(
          tok,
          prevVal,
          nextVal,
          tok.max_ap
        );
      }
    }
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
    await this.selectLoadoutArmorChoice(
      char,
      armor === 'None' ? 'None' : `tier:${armor}`
    );
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
    if (!this.canEdit()) return;
    const armorsList = this.getAllCompendiumArmors();
    const weaponsList = this.getAllCompendiumWeapons();
    const perksList = this.getAllCompendiumPerkNodes();

    if (!choice || choice === 'None') {
      await this.unequipCharacterArmor(char);
      return;
    }

    if (choice.startsWith('tier:')) {
      const tier = choice.slice(5) as ArmorTier;
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
        const oldStats = computeDerivedStats(
          c,
          weaponsList,
          perksList,
          armorsList
        );
        const nextInv = normalizeInventoryItems(c.inventory).map((it) =>
          getInventoryItemCategory(it) === 'armor'
            ? { ...it, equipped: false }
            : it
        );
        const draft: CharacterModel = {
          ...c,
          equipped_armor: tier,
          inventory: nextInv,
        };
        const nextStats = computeDerivedStats(
          draft,
          weaponsList,
          perksList,
          armorsList
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
      await this.equipCharacterInventoryArmor(char, choice.slice(4));
      return;
    }

    if (choice.startsWith('comp:')) {
      const compId = choice.slice(5);
      const armor = this.getActiveCompendiumArmors().find(
        (a) => a.id === compId
      );
      if (!armor) return;
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
        const oldStats = computeDerivedStats(
          c,
          weaponsList,
          perksList,
          armorsList
        );
        const list = this.getCharacterInventory(c);
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
          weaponsList,
          perksList,
          armorsList
        );
        const spGain = Math.max(0, nextStats.maxSp - oldStats.maxSp);
        return {
          ...draft,
          current_sp: Math.min(nextStats.maxSp, c.current_sp + spGain),
        };
      });
    }
  }

  async equipCharacterInventoryArmor(
    char: CharacterModel,
    itemId: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    const armorsList = this.getAllCompendiumArmors();
    const weaponsList = this.getAllCompendiumWeapons();
    const perksList = this.getAllCompendiumPerkNodes();
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const list = this.getCharacterInventory(c);
      const target = list.find(
        (it) => it.id === itemId && getInventoryItemCategory(it) === 'armor'
      );
      if (!target) return c;
      const oldStats = computeDerivedStats(
        c,
        weaponsList,
        perksList,
        armorsList
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
        weaponsList,
        perksList,
        armorsList
      );
      const spGain = Math.max(0, nextStats.maxSp - oldStats.maxSp);
      return {
        ...draft,
        current_sp: Math.min(nextStats.maxSp, c.current_sp + spGain),
      };
    });
  }

  async unequipCharacterArmor(char: CharacterModel): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      equipped_armor: 'None',
      inventory: this.getCharacterInventory(c).map((it) =>
        getInventoryItemCategory(it) === 'armor'
          ? { ...it, equipped: false }
          : it
      ),
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
      ? this.getAllCompendiumWeapons().find((w) => w.id === weaponId) ?? null
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
            ? this.getAllCompendiumWeapons().find((w) => w.id === activeId) ??
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
    const tok = this.sheetToken();
    if (tok && this.vttStore.activeScene()?.combat_active) {
      await this.vttStore.switchCharacterWeaponSlotInVtt(tok);
      return;
    }
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      active_weapon_slot: slot,
    }));
  }

  async stowCharacterSlotWeapon(
    char: CharacterModel,
    slot: 1 | 2
  ): Promise<void> {
    if (!this.canEdit()) return;
    const slotWeaponId =
      slot === 1 ? char.weapon_slot_1_id : char.weapon_slot_2_id;
    if (!slotWeaponId) return;
    const wep = this.getAllCompendiumWeapons().find(
      (w) => w.id === slotWeaponId
    );
    if (!wep) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      weapon_slot_1_id: slot === 1 ? null : c.weapon_slot_1_id,
      weapon_slot_2_id: slot === 2 ? null : c.weapon_slot_2_id,
      inventory: [
        ...this.getCharacterInventory(c),
        buildWeaponInventoryEntry(wep, 1),
      ],
    }));
  }

  async equipCharacterInventoryWeapon(
    char: CharacterModel,
    item: ActorInventoryItem,
    slot: 1 | 2
  ): Promise<void> {
    if (!this.canEdit() || !item.compendium_id) return;
    const wep = this.getAllCompendiumWeapons().find(
      (w) => w.id === item.compendium_id
    );
    if (!wep) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const prevSlotId =
        slot === 1 ? c.weapon_slot_1_id : c.weapon_slot_2_id;
      const prevWep = prevSlotId
        ? (this.getAllCompendiumWeapons().find((w) => w.id === prevSlotId) ??
          null)
        : null;
      let nextInv = this.getCharacterInventory(c)
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
        ? (this.getAllCompendiumWeapons().find((w) => w.id === activeId) ??
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

  isTwoHanded(w: WeaponModel | null | undefined): boolean {
    return isWeaponTwoHanded(w);
  }

  isHeavy(w: WeaponModel | null | undefined): boolean {
    return isWeaponHeavy(w);
  }

  getHeavyBlockBase(w: WeaponModel | null | undefined): number {
    return getHeavyWeaponBlockBase(w);
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

  formatRollFormulaFromMod(mod: number): string {
    return mod >= 0 ? `2d10 + ${mod}` : `2d10 − ${Math.abs(mod)}`;
  }

  getWeaponHookBadges(weapon: WeaponModel | null | undefined): string[] {
    return formatWeaponHookBadges(weapon);
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
      this.getAllCompendiumWeapons()
    );
  }

  getCharacterInventory(char: CharacterModel): ActorInventoryItem[] {
    const direct = normalizeInventoryItems(char.inventory);
    if (direct.length > 0) return direct;
    const actor = this.sheetRosterActor();
    return normalizeInventoryItems(actor?.npc_stats?.__inventory);
  }

  getPcInventoryWeapons(char: CharacterModel): ActorInventoryItem[] {
    return this.getCharacterInventory(char).filter(
      (it) => getInventoryItemCategory(it) === 'weapon'
    );
  }

  getPcInventoryArmors(char: CharacterModel): ActorInventoryItem[] {
    return this.getCharacterInventory(char)
      .filter((it) => getInventoryItemCategory(it) === 'armor')
      .sort((a, b) => Number(Boolean(b.equipped)) - Number(Boolean(a.equipped)));
  }

  getPcInventoryGearItems(char: CharacterModel): ActorInventoryItem[] {
    return this.getCharacterInventory(char).filter(
      (it) => getInventoryItemCategory(it) === 'item'
    );
  }

  hasStandardTierArmorEquipped(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): boolean {
    return char.equipped_armor !== 'None' && !stats.equippedInventoryArmorId;
  }

  getPcWeaponsCount(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): number {
    return (
      (stats.weaponSlot1 ? 1 : 0) +
      (stats.weaponSlot2 ? 1 : 0) +
      this.getPcInventoryWeapons(char).length
    );
  }

  getPcArmorsCount(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): number {
    return (
      (this.hasStandardTierArmorEquipped(char, stats) ? 1 : 0) +
      this.getPcInventoryArmors(char).length
    );
  }

  getPcItemsCount(char: CharacterModel): number {
    return this.getPcInventoryGearItems(char).length;
  }

  getPcTotalCategorizedCount(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): number {
    return (
      this.getPcWeaponsCount(char, stats) +
      this.getPcArmorsCount(char, stats) +
      this.getPcItemsCount(char)
    );
  }

  async addCharacterFromCompendiumPicker(
    char: CharacterModel,
    encoded: string
  ): Promise<void> {
    if (!this.canEdit() || !encoded) return;
    const colonIdx = encoded.indexOf(':');
    if (colonIdx < 0) return;
    const kind = encoded.slice(0, colonIdx);
    const id = encoded.slice(colonIdx + 1);

    if (kind === 'weapon') {
      const wep = this.getAllCompendiumWeapons().find((w) => w.id === id);
      if (!wep) return;
      const entry = buildWeaponInventoryEntry(wep, 1);
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
        ...c,
        inventory: mergeInventoryEntry(this.getCharacterInventory(c), entry, false),
      }));
      return;
    }

    if (kind === 'armor') {
      const armor = this.getActiveCompendiumArmors().find((a) => a.id === id);
      if (!armor) return;
      const entry = buildArmorInventoryEntry(armor, false);
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
        ...c,
        inventory: mergeInventoryEntry(this.getCharacterInventory(c), entry, false),
      }));
      return;
    }

    if (kind === 'item') {
      const compItem = this.getActiveCompendiumItems().find((i) => i.id === id);
      if (!compItem) return;
      const entry = buildCompendiumGearInventoryEntry(compItem);
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
        ...c,
        inventory: mergeInventoryEntry(
          this.getCharacterInventory(c),
          entry,
          compItem.stackable !== false
        ),
      }));
    }
  }

  private buildBlankCustomInventoryEntry(
    category: InventoryItemCategory
  ): ActorInventoryItem {
    const newId = generateInventoryItemId();
    if (category === 'weapon') {
      return {
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
    }
    if (category === 'armor') {
      return {
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
    }
    return {
      id: newId,
      category: 'item',
      subcategory: 'Adventuring Gear',
      name: 'New Item',
      quantity: 1,
      description: '',
    };
  }

  async addCustomCharacterInventoryEntry(
    char: CharacterModel,
    category: InventoryItemCategory
  ): Promise<void> {
    if (!this.canEdit()) return;
    const next = this.buildBlankCustomInventoryEntry(category);
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      inventory: [...this.getCharacterInventory(c), next],
    }));
  }

  async addCharacterInventoryItem(char: CharacterModel): Promise<void> {
    const tab = this.pcInventoryTab();
    await this.addCustomCharacterInventoryEntry(
      char,
      tab === 'all' ? 'item' : tab
    );
  }

  async patchCharacterInventoryItem(
    char: CharacterModel,
    itemId: string,
    patch: Partial<ActorInventoryItem>
  ): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const nextInv = this.getCharacterInventory(c).map((it) =>
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

  async updateCharacterInventoryField(
    char: CharacterModel,
    itemId: string,
    field: 'name' | 'description',
    value: string
  ): Promise<void> {
    await this.patchCharacterInventoryItem(char, itemId, { [field]: value });
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
      this.getSkillTrees().find((t) => t.id === node.tree_id)?.name ??
      'Skill Tree'
    );
  }

  countUnlockedInTree(char: CharacterModel, treeId: string): number {
    const unlocked = new Set(char.unlocked_perk_ids);
    return this.getPerkNodes().filter(
      (p) => p.tree_id === treeId && unlocked.has(p.id)
    ).length;
  }

  countUnlockedStandalone(char: CharacterModel): number {
    const unlocked = new Set(char.unlocked_perk_ids);
    return this.getStandaloneOptions().filter((p) => unlocked.has(p.id)).length;
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

  getPublicSpeakerName(fallback?: string): string {
    const tok = this.sheetToken();
    if (tok?.name?.trim()) return tok.name.trim();
    const actor = this.sheetRosterActor();
    if (actor) {
      return resolveActorTokenDisplayName(actor, fallback);
    }
    return fallback?.trim() || this.sheetCharacter()?.name || this.getNpcName();
  }

  async rollSheetCheck(
    speakerName: string,
    label: string,
    modifier: number,
    detail?: string
  ): Promise<void> {
    const vis = this.resolvedVisuals();
    await this.vttStore.rollActorSheetCheck({
      speakerName: this.getPublicSpeakerName(speakerName),
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
    const tok = this.sheetToken();
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
    const tok = this.sheetToken();
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

  getCharacterCurrentAp(char: CharacterModel): number {
    return this.sheetToken()?.current_ap ?? char.current_ap ?? 4;
  }

  getCharacterCurrentSp(char: CharacterModel): number {
    return this.sheetToken()?.current_sp ?? char.current_sp ?? 0;
  }

  isCharacterGuardRaised(char: CharacterModel): boolean {
    const tok = this.sheetToken();
    return tok
      ? Boolean(tok.shield_raised)
      : Boolean(char.active_cooldowns?.['__shield_raised']);
  }

  getCharacterArtCooldown(char: CharacterModel, perkId: string): number {
    const tok = this.sheetToken();
    if (
      tok &&
      typeof this.vttStore.isTokenInActiveCombat === 'function' &&
      !this.vttStore.isTokenInActiveCombat(tok)
    ) {
      return 0;
    }
    return Math.max(0, Number(char.active_cooldowns?.[perkId] ?? 0));
  }

  async clearCharacterArtCooldown(
    char: CharacterModel,
    perkId: string
  ): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const nextCd = { ...(c.active_cooldowns ?? {}) };
      delete nextCd[perkId];
      return {
        ...c,
        active_cooldowns: nextCd,
      };
    });
  }

  async switchCharacterWeaponFromActions(char: CharacterModel): Promise<void> {
    if (!this.canEdit()) return;
    const tok = this.sheetToken();
    if (tok && typeof this.vttStore.switchCharacterWeaponSlotInVtt === 'function') {
      if (tok.current_ap < 1) return;
      await this.vttStore.switchCharacterWeaponSlotInVtt(tok);
      return;
    }
    const currAp = this.getCharacterCurrentAp(char);
    if (currAp < 1) return;
    const nextSlot: 1 | 2 = char.active_weapon_slot === 1 ? 2 : 1;
    let nextWeaponName = 'Unarmed';
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
      const draft: CharacterModel = {
        ...c,
        active_weapon_slot: nextSlot,
        current_ap: Math.max(0, currAp - 1),
      };
      const nextStats = computeDerivedStats(
        draft,
        this.getAllCompendiumWeapons(),
        this.getAllCompendiumPerkNodes(),
        this.getAllCompendiumArmors()
      );
      nextWeaponName = nextStats.activeWeapon?.name ?? 'Unarmed';
      const nextCd = { ...(c.active_cooldowns ?? {}) };
      if (!nextStats.usesRaiseShield) {
        delete nextCd['__shield_raised'];
      }
      return {
        ...draft,
        active_cooldowns: nextCd,
      };
    });
    if (typeof this.vttStore.postLog === 'function') {
      const pubName = this.getPublicSpeakerName();
      await this.vttStore.postLog({
        kind: 'system',
        title: `Switched to ${nextWeaponName}`,
        detail: null,
        senderNameOverride: pubName,
      });
    }
  }

  async triggerCharacterReaction(
    char: CharacterModel,
    stats: DerivedCharacterStats,
    kind: 'parry' | 'dodge'
  ): Promise<void> {
    if (!this.canEdit()) return;
    if (kind === 'dodge' && !stats.canDodge) return;
    const currAp = this.getCharacterCurrentAp(char);
    if (currAp < 1) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      current_ap: Math.max(0, currAp - 1),
    }));
    const pubName = this.getPublicSpeakerName();
    if (kind === 'parry') {
      await this.rollSheetCheck(pubName, 'Parry Reaction', stats.parryMod);
    } else {
      await this.rollSheetCheck(pubName, 'Dodge Reaction', stats.dodgeMod);
    }
  }

  async toggleCharacterRaiseGuard(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): Promise<void> {
    if (!this.canEdit() || !stats.usesRaiseShield) return;
    const currentlyRaised = this.isCharacterGuardRaised(char);
    const pubName = this.getPublicSpeakerName();
    if (currentlyRaised) {
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => {
        const nextCd = { ...(c.active_cooldowns ?? {}) };
        delete nextCd['__shield_raised'];
        return {
          ...c,
          active_cooldowns: nextCd,
        };
      });
      if (typeof this.vttStore.postLog === 'function') {
        await this.vttStore.postLog({
          kind: 'system',
          title: 'Guard Lowered',
          detail: null,
          senderNameOverride: pubName,
        });
      }
      return;
    }

    const currAp = this.getCharacterCurrentAp(char);
    const currSp = this.getCharacterCurrentSp(char);
    if (currAp < 1 || (stats.maxSp > 0 && currSp <= 0)) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      current_ap: Math.max(0, currAp - 1),
      active_cooldowns: {
        ...(c.active_cooldowns ?? {}),
        __shield_raised: 1,
      },
    }));
    if (typeof this.vttStore.postLog === 'function') {
      await this.vttStore.postLog({
        kind: 'system',
        title: 'Guard Raised',
        detail: `Block −${stats.shieldBlockTotal} DMG`,
        senderNameOverride: pubName,
      });
    }
  }

  async useCharacterStanceRecovery(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): Promise<void> {
    if (!this.canEdit()) return;
    const currAp = this.getCharacterCurrentAp(char);
    const currSp = this.getCharacterCurrentSp(char);
    if (currAp < 1 || currSp >= stats.maxSp) return;
    const nextSp = Math.min(stats.maxSp, currSp + stats.stanceRecoverySp);
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      current_ap: Math.max(0, currAp - 1),
      current_sp: nextSp,
    }));
    if (typeof this.vttStore.postLog === 'function') {
      const pubName = this.getPublicSpeakerName();
      await this.vttStore.postLog({
        kind: 'system',
        title: 'Stance Recovery',
        detail: `+${nextSp - currSp} SP (${nextSp}/${stats.maxSp} SP)`,
        senderNameOverride: pubName,
      });
    }
  }

  async spendCharacterTacticalAction(
    char: CharacterModel,
    actionLabel: string,
    _detailText?: string,
    apCost = 1
  ): Promise<void> {
    if (!this.canEdit()) return;
    const currAp = this.getCharacterCurrentAp(char);
    if (currAp < apCost) return;
    await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
      ...c,
      current_ap: Math.max(0, currAp - apCost),
    }));
    if (typeof this.vttStore.postLog === 'function') {
      const pubName = this.getPublicSpeakerName();
      await this.vttStore.postLog({
        kind: 'system',
        title: `${pubName} used ${actionLabel} (${apCost} AP)`,
        detail: null,
        senderNameOverride: pubName,
      });
    }
  }

  getNpcCurrentAp(): number {
    return this.sheetToken()?.current_ap ?? this.getNpcMaxVital('max_ap');
  }

  getNpcCurrentSp(): number {
    return this.sheetToken()?.current_sp ?? this.getNpcMaxVital('max_sp');
  }

  getNpcMoveTiles(): number {
    return Math.max(1, Math.round(this.getNpcArmorOrMove('move_feet') / 5));
  }

  isNpcGuardRaised(): boolean {
    const tok = this.sheetToken();
    if (tok) return Boolean(tok.shield_raised);
    const stats = this.getNpcStats() as Record<string, unknown>;
    return Boolean(stats['__shield_raised']);
  }

  getNpcStandaloneCombatArts(): PerkNodeModel[] {
    return this.getNpcStandaloneNodes().filter(
      (n) => n.node_type === 'combat_art'
    );
  }

  async triggerNpcReaction(kind: 'parry' | 'dodge'): Promise<void> {
    if (!this.canEdit()) return;
    const npcStats = this.getNpcStats();
    if (kind === 'dodge' && npcStats.can_dodge === false) return;
    const tok = this.sheetToken();
    if (tok) {
      if (tok.current_ap < 1) return;
      await this.vttStore.patchToken(tok.id, {
        current_ap: Math.max(0, tok.current_ap - 1),
      });
    }
    const name = this.getPublicSpeakerName();
    if (kind === 'parry') {
      const mod = this.getNpcParryMod();
      await this.rollSheetCheck(name, 'Parry Reaction', mod);
    } else {
      const mod = this.getNpcDodgeMod();
      await this.rollSheetCheck(name, 'Dodge Reaction', mod);
    }
  }

  async toggleNpcRaiseGuard(): Promise<void> {
    if (!this.canEdit() || this.getNpcArmorOrMove('shield_block') <= 0) return;
    const tok = this.sheetToken();
    if (tok && typeof this.vttStore.toggleTokenRaiseShield === 'function') {
      await this.vttStore.toggleTokenRaiseShield(tok);
      return;
    }
    const raised = this.isNpcGuardRaised();
    const currStats = this.getNpcStats() as Record<string, unknown>;
    await this.patchSheetActorOrToken({
      npc_stats: {
        ...this.getNpcStats(),
        __shield_raised: !raised,
      } as VttNpcStats,
    });
    if (typeof this.vttStore.postLog === 'function') {
      const pubName = this.getPublicSpeakerName();
      const blockVal = this.getNpcArmorOrMove('shield_block');
      await this.vttStore.postLog({
        kind: 'system',
        title: raised ? 'Guard Lowered' : 'Guard Raised',
        detail: raised ? null : `Block −${blockVal} DMG`,
        senderNameOverride: pubName,
      });
    }
    void currStats;
  }

  async useNpcStanceRecovery(): Promise<void> {
    if (!this.canEdit()) return;
    const tok = this.sheetToken();
    if (tok && typeof this.vttStore.performStanceRecovery === 'function') {
      await this.vttStore.performStanceRecovery(tok);
      return;
    }
    if (typeof this.vttStore.postLog === 'function') {
      const pubName = this.getPublicSpeakerName();
      await this.vttStore.postLog({
        kind: 'system',
        title: 'Stance Recovery',
        detail: '+3 SP',
        senderNameOverride: pubName,
      });
    }
  }

  async spendNpcTacticalAction(
    actionLabel: string,
    _detailText?: string,
    apCost = 1
  ): Promise<void> {
    if (!this.canEdit()) return;
    const tok = this.sheetToken();
    if (tok) {
      if (tok.current_ap < apCost) return;
      await this.vttStore.patchToken(tok.id, {
        current_ap: Math.max(0, tok.current_ap - apCost),
      });
    }
    if (typeof this.vttStore.postLog === 'function') {
      const pubName = this.getPublicSpeakerName();
      await this.vttStore.postLog({
        kind: 'system',
        title: `${pubName} used ${actionLabel} (${apCost} AP)`,
        detail: null,
        senderNameOverride: pubName,
      });
    }
  }

  getNpcName(): string {
    return (
      this.sheetRosterActor()?.name ??
      this.sheetToken()?.name ??
      'NPC'
    );
  }

  getNpcMaxVital(field: 'max_hp' | 'max_sp' | 'max_ap'): number {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    if (actor) return actor[field];
    if (tok) return tok[field];
    return field === 'max_hp' ? 8 : 4;
  }

  getNpcArmorOrMove(
    field: 'armor_dr' | 'shield_block' | 'move_feet' | 'size'
  ): number {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    if (actor) return actor[field];
    if (tok) return tok[field];
    return field === 'move_feet' ? 20 : field === 'size' ? 1 : 0;
  }

  getNpcStats(): VttNpcStats {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    return actor?.npc_stats ?? tok?.npc_stats ?? {};
  }

  getNpcAttributes(): Record<AttributeName, number> {
    return normalizeNpcAttributes(this.getNpcStats().attributes);
  }

  getNpcCombatSkills(): Record<CombatSkillName, number> {
    return normalizeNpcCombatSkills(this.getNpcStats().combat_skills);
  }

  getNpcFieldSkills(): Record<FieldSkillName, number> {
    return normalizeNpcFieldSkills(this.getNpcStats().field_skills);
  }

  getNpcFieldSkillTotals() {
    return computeNpcFieldSkillTotals(this.getNpcStats());
  }

  getNpcParryMod(): number {
    const stats = this.getNpcStats();
    const attrs = normalizeNpcAttributes(stats.attributes);
    const skills = normalizeNpcCombatSkills(stats.combat_skills);
    const eff = this.getEffectiveNpcWeaponStats();
    const rapierBonus = Number(
      eff.compendiumWeapon?.rule_hooks?.['parry_roll_bonus'] ?? 0
    );
    let perkParry = 0;
    for (const p of this.getNpcStandaloneNodes()) {
      if (p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)) {
        perkParry += Number(p.rule_hooks?.bonus_parry_mod ?? 0);
      }
    }
    if (stats.attributes || stats.combat_skills) {
      return (attrs.Technique ?? 0) + (skills.Parry ?? 0) + rapierBonus + perkParry;
    }
    return Number(stats.parry_mod ?? 1);
  }

  getNpcDodgeMod(): number {
    const stats = this.getNpcStats();
    const attrs = normalizeNpcAttributes(stats.attributes);
    const skills = normalizeNpcCombatSkills(stats.combat_skills);
    let perkDodge = 0;
    for (const p of this.getNpcStandaloneNodes()) {
      if (p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)) {
        perkDodge += Number(p.rule_hooks?.bonus_dodge_mod ?? 0);
      }
    }
    if (stats.attributes || stats.combat_skills) {
      return (attrs.Agility ?? 0) + (skills.Dodge ?? 0) + perkDodge;
    }
    return Number(stats.dodge_mod ?? 1);
  }

  hasNpcMartialParry(): boolean {
    const stats = this.getNpcStats();
    const eff = this.getEffectiveNpcWeaponStats();
    return Boolean(
      stats.enables_martial_parry ||
        eff.compendiumWeapon?.rule_hooks?.['enables_martial_parry']
    );
  }

  private syncActiveNpcWeaponToStats(draftStats: VttNpcStats): VttNpcStats {
    const attrs = normalizeNpcAttributes(draftStats.attributes);
    const skills = normalizeNpcCombatSkills(draftStats.combat_skills);
    const nodes = this.getNpcStandaloneNodes();
    const eff = resolveEffectiveNpcWeaponStats(
      draftStats,
      nodes,
      this.getAllCompendiumWeapons(),
      { weaponName: 'Unarmed', attackMod: 2, flatDamage: 3 }
    );
    const rapierBonus = Number(
      eff.compendiumWeapon?.rule_hooks?.['parry_roll_bonus'] ?? 0
    );
    let perkParry = 0;
    let perkDodge = 0;
    let perkAtk = 0;
    let perkDmg = 0;
    for (const p of nodes) {
      if (p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)) {
        perkParry += Number(p.rule_hooks?.bonus_parry_mod ?? 0);
        perkDodge += Number(p.rule_hooks?.bonus_dodge_mod ?? 0);
        perkAtk += Number(p.rule_hooks?.bonus_attack_mod ?? 0);
        perkDmg += Number(p.rule_hooks?.bonus_flat_damage ?? 0);
      }
    }
    const nextParryMod =
      (attrs.Technique ?? 0) + (skills.Parry ?? 0) + rapierBonus + perkParry;
    const nextDodgeMod = (attrs.Agility ?? 0) + (skills.Dodge ?? 0) + perkDodge;

    if (eff.formula) {
      return {
        ...draftStats,
        weapon_name: eff.weaponName,
        attack_ap: eff.attackAp,
        attack_mod: eff.attackMod,
        flat_damage: eff.flatDamage,
        reach_feet: eff.reachFeet,
        parry_mod: nextParryMod,
        dodge_mod: nextDodgeMod,
      };
    }

    const isUnarmed =
      (draftStats.weapon_name ?? 'Unarmed').trim().toLowerCase() === 'unarmed';
    return {
      ...draftStats,
      ...(isUnarmed
        ? {
            attack_mod: (attrs.Brawn ?? 0) + (skills.Strike ?? 0) + perkAtk,
            flat_damage: 2 + (attrs.Brawn ?? 0) + perkDmg,
          }
        : {}),
      parry_mod: nextParryMod,
      dodge_mod: nextDodgeMod,
    };
  }

  private computeNpcUnarmedWeaponPatch(
    stats: VttNpcStats
  ): Pick<
    VttNpcStats,
    'weapon_name' | 'attack_ap' | 'attack_mod' | 'flat_damage' | 'reach_feet'
  > {
    const attrs = normalizeNpcAttributes(stats.attributes);
    const skills = normalizeNpcCombatSkills(stats.combat_skills);
    let perkAtk = 0;
    let perkDmg = 0;
    for (const p of this.getNpcStandaloneNodes()) {
      if (p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)) {
        perkAtk += Number(p.rule_hooks?.bonus_attack_mod ?? 0);
        perkDmg += Number(p.rule_hooks?.bonus_flat_damage ?? 0);
      }
    }
    return {
      weapon_name: 'Unarmed',
      attack_ap: 1,
      attack_mod: (attrs.Brawn ?? 0) + (skills.Strike ?? 0) + perkAtk,
      flat_damage: 2 + (attrs.Brawn ?? 0) + perkDmg,
      reach_feet: 5,
    };
  }

  async adjustNpcAttribute(attr: AttributeName, delta: number): Promise<void> {
    if (!this.canEdit()) return;
    const currStats = this.getNpcStats();
    const curr = this.getNpcAttributes();
    const nextVal = Math.max(-2, Math.min(8, (curr[attr] ?? 0) + delta));
    const nextDraft = this.syncActiveNpcWeaponToStats({
      ...currStats,
      attributes: {
        ...curr,
        [attr]: nextVal,
      },
    });
    await this.patchNpcStatsField(nextDraft);
  }

  async adjustNpcCombatSkill(
    skill: CombatSkillName,
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const currStats = this.getNpcStats();
    const curr = this.getNpcCombatSkills();
    const nextVal = Math.max(0, Math.min(6, (curr[skill] ?? 0) + delta));
    const nextDraft = this.syncActiveNpcWeaponToStats({
      ...currStats,
      combat_skills: {
        ...curr,
        [skill]: nextVal,
      },
    });
    await this.patchNpcStatsField(nextDraft);
  }

  async adjustNpcFieldSkill(
    skill: FieldSkillName,
    delta: number
  ): Promise<void> {
    if (!this.canEdit()) return;
    const curr = this.getNpcFieldSkills();
    const nextVal = Math.max(0, Math.min(6, (curr[skill] ?? 0) + delta));
    await this.patchNpcStatsField({
      field_skills: {
        ...curr,
        [skill]: nextVal,
      },
    });
  }

  getNpcInventory(): ActorInventoryItem[] {
    return normalizeInventoryItems(this.getNpcStats().__inventory);
  }

  isNpcWeaponEquipped(item: ActorInventoryItem): boolean {
    if (getInventoryItemCategory(item) !== 'weapon') return false;
    const allWeapons = this.getNpcInventory().filter(
      (it) => getInventoryItemCategory(it) === 'weapon'
    );
    if (allWeapons.some((it) => it.equipped)) {
      return Boolean(item.equipped);
    }
    const activeName = (this.getNpcStats().weapon_name ?? '')
      .trim()
      .toLowerCase();
    const itemName = (item.name ?? '').trim().toLowerCase();
    return Boolean(
      activeName && activeName !== 'unarmed' && activeName === itemName
    );
  }

  getNpcInventoryWeapons(): ActorInventoryItem[] {
    return this.getNpcInventory()
      .filter((it) => getInventoryItemCategory(it) === 'weapon')
      .sort(
        (a, b) =>
          Number(this.isNpcWeaponEquipped(b)) -
          Number(this.isNpcWeaponEquipped(a))
      );
  }

  getNpcInventoryArmors(): ActorInventoryItem[] {
    return this.getNpcInventory()
      .filter((it) => getInventoryItemCategory(it) === 'armor')
      .sort((a, b) => Number(Boolean(b.equipped)) - Number(Boolean(a.equipped)));
  }

  getEquippedNpcArmor(): ActorInventoryItem | null {
    return this.getNpcInventoryArmors().find((it) => it.equipped) ?? null;
  }

  getNpcInventoryGearItems(): ActorInventoryItem[] {
    return this.getNpcInventory().filter(
      (it) => getInventoryItemCategory(it) === 'item'
    );
  }

  getNpcWeaponFormula(
    target: ActorInventoryItem | WeaponModel
  ): CharacterWeaponFormulaSummary {
    return computeNpcWeaponFormula(
      this.getNpcStats(),
      target,
      this.getNpcStandaloneNodes(),
      this.getAllCompendiumWeapons()
    );
  }

  getEffectiveNpcWeaponStats(): ResolvedNpcWeaponStats {
    return resolveEffectiveNpcWeaponStats(
      this.getNpcStats(),
      this.getNpcStandaloneNodes(),
      this.getAllCompendiumWeapons(),
      { weaponName: 'Unarmed', attackMod: 2, flatDamage: 3 }
    );
  }

  getNpcWeaponMod(item: ActorInventoryItem): number {
    return this.getNpcWeaponFormula(item).attackMod;
  }

  getNpcWeaponRollFormula(item: ActorInventoryItem): string {
    return this.getNpcWeaponFormula(item).rollFormula;
  }

  getNpcWeaponDamage(item: ActorInventoryItem): number {
    return this.getNpcWeaponFormula(item).flatDamage;
  }

  getArmorItemSp(item: ActorInventoryItem): number {
    if (typeof item.armor_sp === 'number') return item.armor_sp;
    const match = item.compendium_id
      ? this.getAllCompendiumArmors().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return match.armor_sp;
    const w = item.armor_weight ?? 'Light';
    return ARMOR_TIERS[w].armorSp;
  }

  getArmorItemDr(item: ActorInventoryItem): number {
    if (typeof item.armor_dr === 'number') return item.armor_dr;
    const match = item.compendium_id
      ? this.getAllCompendiumArmors().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return match.armor_dr;
    const w = item.armor_weight ?? 'Light';
    return ARMOR_TIERS[w].hpDr;
  }

  getArmorItemAllowsDodge(item: ActorInventoryItem): boolean {
    if (typeof item.allows_dodge === 'boolean') return item.allows_dodge;
    const match = item.compendium_id
      ? this.getAllCompendiumArmors().find((a) => a.id === item.compendium_id)
      : null;
    if (match) return match.allows_dodge;
    const w = item.armor_weight ?? 'Light';
    return ARMOR_TIERS[w].allowsDodge;
  }

  getArmorItemVisuals(item: ActorInventoryItem): ResolvedCompendiumVisuals {
    const match = item.compendium_id
      ? this.getAllCompendiumArmors().find((a) => a.id === item.compendium_id)
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
      ? this.getAllCompendiumWeapons().find((w) => w.id === item.compendium_id)
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
      color: '#38BDF8',
      tintCustom: true,
      isCustomUpload: false,
    };
  }

  getWeaponVisuals(wep: WeaponModel): ResolvedCompendiumVisuals {
    return resolveWeaponVisuals(wep);
  }

  getNpcNotes(): string {
    return this.sheetRosterActor()?.notes ?? '';
  }

  async patchSheetActorOrToken(
    patch: Partial<VttRosterActorModel>
  ): Promise<void> {
    if (!this.canEdit()) return;
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
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
    if (field === 'current_sp' && delta < 0) {
      const unclampedSp = tok.current_sp + delta;
      if (
        unclampedSp < 0 &&
        this.settingsStore.preferences().overflowSpDamageToHp
      ) {
        const overflow = Math.abs(unclampedSp);
        await this.vttStore.patchToken(tok.id, {
          current_sp: 0,
          current_hp: Math.max(0, tok.current_hp - overflow),
        });
        return;
      }
    }
    const prevVal = tok[field];
    const maxField =
      field === 'current_hp'
        ? tok.max_hp
        : field === 'current_sp'
          ? tok.max_sp
          : tok.max_ap;
    const nextVal = Math.max(0, Math.min(maxField, prevVal + delta));
    if (nextVal === prevVal) return;
    await this.vttStore.patchToken(tok.id, { [field]: nextVal });
    if (field === 'current_ap') {
      await this.vttStore.logManualApAdjustment(tok, prevVal, nextVal);
    }
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
    const wep = this.getAllCompendiumWeapons().find((w) => w.id === weaponId);
    if (!wep) return;
    const f = this.getNpcWeaponFormula(wep);
    const reachFeet = Math.max(
      (wep.reach_tiles ?? 1) * 5,
      (wep.thrown_range_tiles ?? 0) * 5,
      5
    );
    const currInv = this.getNpcInventory();
    const matchIdx = currInv.findIndex(
      (it) =>
        getInventoryItemCategory(it) === 'weapon' &&
        it.compendium_id === weaponId
    );
    const nextInv =
      matchIdx >= 0
        ? currInv.map((it, idx) =>
            getInventoryItemCategory(it) === 'weapon'
              ? { ...it, equipped: idx === matchIdx }
              : it
          )
        : [
            ...currInv.map((it) =>
              getInventoryItemCategory(it) === 'weapon'
                ? { ...it, equipped: false }
                : it
            ),
            { ...buildWeaponInventoryEntry(wep, 1), equipped: true },
          ];
    await this.patchNpcStatsField({
      weapon_name: wep.name,
      attack_ap: f.apCost,
      attack_mod: f.attackMod,
      flat_damage: f.flatDamage,
      reach_feet: reachFeet,
      __inventory: nextInv,
    });
  }

  async equipNpcInventoryWeapon(item: ActorInventoryItem): Promise<void> {
    if (!this.canEdit()) return;
    const compWep = item.compendium_id
      ? this.getAllCompendiumWeapons().find((w) => w.id === item.compendium_id)
      : null;
    const f = this.getNpcWeaponFormula(item);
    const weaponName = compWep?.name || item.name || 'Strike';
    const reachFeet = compWep
      ? Math.max(
          (compWep.reach_tiles ?? 1) * 5,
          (compWep.thrown_range_tiles ?? 0) * 5,
          5
        )
      : f.reachFeet;
    const nextInv = this.getNpcInventory().map((it) =>
      getInventoryItemCategory(it) === 'weapon'
        ? { ...it, equipped: it.id === item.id }
        : it
    );
    await this.patchNpcStatsField({
      weapon_name: weaponName,
      attack_ap: f.apCost,
      attack_mod: f.attackMod,
      flat_damage: f.flatDamage,
      reach_feet: reachFeet,
      __inventory: nextInv,
    });
    this.notifications.success(
      'Weapon Equipped',
      `${this.getNpcName()} equipped ${weaponName} (${f.rollFormula} · ${f.flatDamage} DMG · ${reachFeet} ft).`
    );
  }

  async unequipNpcInventoryWeapon(): Promise<void> {
    if (!this.canEdit()) return;
    const nextInv = this.getNpcInventory().map((it) =>
      getInventoryItemCategory(it) === 'weapon'
        ? { ...it, equipped: false }
        : it
    );
    await this.patchNpcStatsField({
      ...this.computeNpcUnarmedWeaponPatch(this.getNpcStats()),
      __inventory: nextInv,
    });
  }

  async armNpcFromInventoryWeapon(item: ActorInventoryItem): Promise<void> {
    await this.equipNpcInventoryWeapon(item);
  }

  async equipNpcInventoryArmor(itemId: string): Promise<void> {
    if (!this.canEdit()) return;
    const items = this.getNpcInventory();
    const target = items.find(
      (it) => it.id === itemId && getInventoryItemCategory(it) === 'armor'
    );
    if (!target) return;
    const nextInv = items.map((it) =>
      getInventoryItemCategory(it) === 'armor'
        ? { ...it, equipped: it.id === itemId }
        : it
    );
    const currStats = this.getNpcStats();
    await this.patchSheetActorOrToken({
      armor_dr: this.getArmorItemDr(target),
      npc_stats: {
        ...currStats,
        __inventory: nextInv,
      },
    });
  }

  async unequipNpcInventoryArmor(): Promise<void> {
    if (!this.canEdit()) return;
    const nextInv = this.getNpcInventory().map((it) =>
      getInventoryItemCategory(it) === 'armor'
        ? { ...it, equipped: false }
        : it
    );
    const currStats = this.getNpcStats();
    await this.patchSheetActorOrToken({
      armor_dr: 0,
      npc_stats: {
        ...currStats,
        __inventory: nextInv,
      },
    });
  }

  async addNpcFromCompendiumPicker(encoded: string): Promise<void> {
    if (!this.canEdit() || !encoded) return;
    const colonIdx = encoded.indexOf(':');
    if (colonIdx < 0) return;
    const kind = encoded.slice(0, colonIdx);
    const id = encoded.slice(colonIdx + 1);

    if (kind === 'weapon') {
      const wep = this.getAllCompendiumWeapons().find((w) => w.id === id);
      if (!wep) return;
      const entry = buildWeaponInventoryEntry(wep, 1);
      await this.patchNpcStatsField({
        __inventory: mergeInventoryEntry(this.getNpcInventory(), entry, false),
      });
      return;
    }

    if (kind === 'armor') {
      const armor = this.getActiveCompendiumArmors().find((a) => a.id === id);
      if (!armor) return;
      const entry = buildArmorInventoryEntry(armor, false);
      await this.patchNpcStatsField({
        __inventory: mergeInventoryEntry(this.getNpcInventory(), entry, false),
      });
      return;
    }

    if (kind === 'item') {
      const compItem = this.getActiveCompendiumItems().find((i) => i.id === id);
      if (!compItem) return;
      const entry = buildCompendiumGearInventoryEntry(compItem);
      await this.patchNpcStatsField({
        __inventory: mergeInventoryEntry(
          this.getNpcInventory(),
          entry,
          compItem.stackable !== false
        ),
      });
    }
  }

  async addCustomNpcInventoryEntry(
    category: InventoryItemCategory
  ): Promise<void> {
    if (!this.canEdit()) return;
    const next = this.buildBlankCustomInventoryEntry(category);
    await this.patchNpcStatsField({
      __inventory: [...this.getNpcInventory(), next],
    });
  }

  async addNpcInventoryItem(): Promise<void> {
    const tab = this.npcInventoryTab();
    await this.addCustomNpcInventoryEntry(tab === 'all' ? 'item' : tab);
  }

  async patchNpcInventoryItem(
    itemId: string,
    patch: Partial<ActorInventoryItem>
  ): Promise<void> {
    if (!this.canEdit()) return;
    const prevTarget = this.getNpcInventory().find((it) => it.id === itemId);
    const wasWepEquipped = prevTarget
      ? this.isNpcWeaponEquipped(prevTarget)
      : false;
    const nextInv = this.getNpcInventory().map((it) =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    const updatedTarget = nextInv.find((it) => it.id === itemId);
    const currStats = this.getNpcStats();
    if (
      updatedTarget?.equipped &&
      getInventoryItemCategory(updatedTarget) === 'armor'
    ) {
      await this.patchSheetActorOrToken({
        armor_dr: this.getArmorItemDr(updatedTarget),
        npc_stats: {
          ...currStats,
          __inventory: nextInv,
        },
      });
      return;
    }
    if (
      updatedTarget &&
      wasWepEquipped &&
      getInventoryItemCategory(updatedTarget) === 'weapon'
    ) {
      const f = computeNpcWeaponFormula(
        currStats,
        updatedTarget,
        this.getNpcStandaloneNodes(),
        this.getAllCompendiumWeapons()
      );
      await this.patchNpcStatsField({
        weapon_name: updatedTarget.name || 'Strike',
        attack_ap: f.apCost,
        attack_mod: f.attackMod,
        flat_damage: f.flatDamage,
        reach_feet: f.reachFeet,
        __inventory: nextInv,
      });
      return;
    }
    await this.patchNpcStatsField({
      __inventory: nextInv,
    });
  }

  async updateNpcInventoryField(
    itemId: string,
    field: 'name' | 'description',
    value: string
  ): Promise<void> {
    await this.patchNpcInventoryItem(itemId, { [field]: value });
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
    const removed = items.find((it) => it.id === itemId);
    const nextInv = items.filter((it) => it.id !== itemId);
    if (
      removed &&
      getInventoryItemCategory(removed) === 'weapon' &&
      this.isNpcWeaponEquipped(removed)
    ) {
      await this.patchNpcStatsField({
        ...this.computeNpcUnarmedWeaponPatch(this.getNpcStats()),
        __inventory: nextInv,
      });
      return;
    }
    if (
      removed?.equipped &&
      getInventoryItemCategory(removed) === 'armor'
    ) {
      const currStats = this.getNpcStats();
      await this.patchSheetActorOrToken({
        armor_dr: 0,
        npc_stats: {
          ...currStats,
          __inventory: nextInv,
        },
      });
      return;
    }
    await this.patchNpcStatsField({
      __inventory: nextInv,
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

  getAllCompendiumWeapons(): WeaponModel[] {
    if (typeof this.compendiumStore.allWeapons === 'function') {
      return this.compendiumStore.allWeapons();
    }
    if (typeof this.compendiumStore.weapons === 'function') {
      return this.compendiumStore.weapons();
    }
    return [];
  }

  getAllCompendiumArmors(): ArmorModel[] {
    if (typeof this.compendiumStore.allArmors === 'function') {
      return this.compendiumStore.allArmors();
    }
    if (typeof this.compendiumStore.armors === 'function') {
      return this.compendiumStore.armors();
    }
    return DEFAULT_COMPENDIUM_ARMORS;
  }

  getActiveCompendiumArmors(): ArmorModel[] {
    if (typeof this.compendiumStore.armors === 'function') {
      return this.compendiumStore.armors();
    }
    if (typeof this.compendiumStore.allArmors === 'function') {
      return this.compendiumStore
        .allArmors()
        .filter((a) => isCompendiumItemActive(a));
    }
    return DEFAULT_COMPENDIUM_ARMORS;
  }

  getActiveCompendiumItems(): CompendiumItemModel[] {
    if (typeof this.compendiumStore.items === 'function') {
      return this.compendiumStore.items();
    }
    if (typeof this.compendiumStore.allItems === 'function') {
      return this.compendiumStore
        .allItems()
        .filter((i) => isCompendiumItemActive(i));
    }
    return DEFAULT_COMPENDIUM_ITEMS;
  }

  getAllCompendiumPerkNodes(): PerkNodeModel[] {
    if (typeof this.compendiumStore.allPerkNodes === 'function') {
      return this.compendiumStore.allPerkNodes();
    }
    return [];
  }

  getSkillTrees(): SkillTreeModel[] {
    if (typeof this.compendiumStore.skillTrees === 'function') {
      return this.compendiumStore.skillTrees();
    }
    if (typeof this.compendiumStore.allSkillTrees === 'function') {
      return this.compendiumStore.allSkillTrees();
    }
    return [];
  }

  getPerkNodes(): PerkNodeModel[] {
    if (typeof this.compendiumStore.perkNodes === 'function') {
      return this.compendiumStore.perkNodes();
    }
    return this.getAllCompendiumPerkNodes().filter(
      (p) => !isStandalonePerkNode(p)
    );
  }

  getStandaloneOptions(): PerkNodeModel[] {
    if (typeof this.compendiumStore.standaloneNodes === 'function') {
      return this.compendiumStore.standaloneNodes();
    }
    return this.getAllCompendiumPerkNodes().filter((p) =>
      isStandalonePerkNode(p)
    );
  }

  getNpcStandaloneIds(): string[] {
    const raw = this.getNpcStats().__standalone_perk_ids;
    if (!Array.isArray(raw)) return [];
    return raw.filter((id): id is string => typeof id === 'string');
  }

  getNpcStandaloneNodes(): PerkNodeModel[] {
    const actor = this.sheetRosterActor();
    const tok = this.sheetToken();
    return this.vttStore.getNpcStandaloneNodes(actor ?? tok);
  }

  getNodeBonusAttack(node: PerkNodeModel): number {
    return Number(node.rule_hooks?.bonus_attack_mod ?? 0);
  }

  getNodeBonusDamage(node: PerkNodeModel): number {
    return Number(node.rule_hooks?.bonus_flat_damage ?? 0);
  }

  async grantNpcStandaloneSkill(nodeId: string): Promise<void> {
    if (!this.canEdit() || !this.canGrantStandalone() || !nodeId) return;
    const node = this.getAllCompendiumPerkNodes().find((p) => p.id === nodeId);
    if (!node || !isStandalonePerkNode(node)) return;
    const currIds = this.getNpcStandaloneIds();
    if (currIds.includes(node.id)) {
      this.notifications.info(
        'Already Granted',
        `${this.getNpcName()} already has ${node.name}.`
      );
      return;
    }
    await this.patchNpcStatsField({
      __standalone_perk_ids: [...currIds, node.id],
    });
    this.notifications.success(
      'Standalone Skill Added',
      `${node.name} added to ${this.getNpcName()}.`
    );
  }

  async removeNpcStandaloneSkill(nodeId: string): Promise<void> {
    if (!this.canEdit() || !nodeId) return;
    const currIds = this.getNpcStandaloneIds();
    if (!currIds.includes(nodeId)) return;
    await this.patchNpcStatsField({
      __standalone_perk_ids: currIds.filter((id) => id !== nodeId),
    });
  }

  targetNpcStandaloneArtOnMap(node: PerkNodeModel): void {
    const tok = this.sheetToken();
    if (!tok) return;
    this.vttStore.selectedTokenId.set(tok.id);
    this.vttStore.beginNpcStandaloneArtTargetSelection(tok, node);
  }

  private extractCompendiumDragPayload(
    event: DragEvent
  ): VttCompendiumDragPayload | null {
    const storePayload = this.vttStore.draggingCompendiumPayload();
    if (storePayload) return storePayload;
    const raw = event.dataTransfer?.getData(VTT_COMPENDIUM_DRAG_MIME);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<VttCompendiumDragPayload>;
      if (
        (parsed.kind === 'compendium-weapon' ||
          parsed.kind === 'compendium-armor' ||
          parsed.kind === 'compendium-item' ||
          parsed.kind === 'compendium-standalone') &&
        typeof parsed.itemId === 'string' &&
        parsed.itemId.length > 0
      ) {
        return {
          kind: parsed.kind,
          itemId: parsed.itemId,
          name: typeof parsed.name === 'string' ? parsed.name : 'Item',
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  canAcceptCompendiumDrop(event: DragEvent): boolean {
    if (!this.canEdit()) return false;
    const storePayload = this.vttStore.draggingCompendiumPayload();
    if (storePayload) {
      if (
        storePayload.kind === 'compendium-standalone' &&
        !this.canGrantStandalone()
      ) {
        return false;
      }
      return true;
    }
    const types = Array.from(event.dataTransfer?.types ?? []);
    return types.includes(VTT_COMPENDIUM_DRAG_MIME);
  }

  getCompendiumDropHint(): string {
    const payload = this.vttStore.draggingCompendiumPayload();
    const zone = this.activeDropZone();
    const targetName = this.sheetCharacter()?.name || this.getNpcName();
    if (payload?.kind === 'compendium-standalone') {
      return `Drop to grant "${payload.name}" to ${targetName}`;
    }
    if (payload?.kind === 'compendium-armor') {
      if (zone === 'inventory') {
        return `Drop to carry "${payload.name}" in ${targetName}'s inventory`;
      }
      return `Drop to equip "${payload.name}" on ${targetName}`;
    }
    if (payload?.kind === 'compendium-item') {
      return `Drop to add "${payload.name}" to ${targetName}'s inventory`;
    }
    if (payload?.kind === 'compendium-weapon') {
      if (zone === 'inventory') {
        return `Drop to add "${payload.name}" to ${targetName}'s inventory`;
      }
      if (zone === 'slot-1') {
        return `Drop to equip "${payload.name}" in Weapon Slot 1`;
      }
      if (zone === 'slot-2') {
        return `Drop to equip "${payload.name}" in Weapon Slot 2`;
      }
      return `Drop to equip "${payload.name}" on ${targetName}`;
    }
    return `Drop Compendium item onto ${targetName}`;
  }

  onSheetDragOver(
    event: DragEvent,
    zone: VttSheetDropZone = 'sheet'
  ): void {
    if (!this.canAcceptCompendiumDrop(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.activeDropZone.set(zone);
  }

  onSheetDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (current && related && current.contains(related)) {
      return;
    }
    this.activeDropZone.set(null);
  }

  private async ensureCharacterForSheetDrop(): Promise<CharacterModel | null> {
    const existing = this.sheetCharacter();
    if (existing) return existing;
    const actor = this.sheetRosterActor();
    if (!actor) return null;
    return this.vttStore.initializeLinkedCharacterForActor(actor.id);
  }

  async onSheetDrop(
    event: DragEvent,
    zone: VttSheetDropZone = 'sheet'
  ): Promise<void> {
    const payload = this.extractCompendiumDragPayload(event);
    this.activeDropZone.set(null);
    if (!payload || !this.canEdit()) return;

    event.preventDefault();
    event.stopPropagation();
    this.focusWindow();
    this.vttStore.draggingCompendiumPayload.set(null);
    if (this.minimized()) {
      this.minimized.set(false);
    }

    if (payload.kind === 'compendium-weapon') {
      const wep = this.getAllCompendiumWeapons().find(
        (w) => w.id === payload.itemId
      );
      if (!wep) return;

      if (this.sheetMode() === 'character') {
        const char = await this.ensureCharacterForSheetDrop();
        if (!char) return;

        if (zone === 'inventory') {
          const nextItem = buildWeaponInventoryEntry(wep, 1);
          await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
            ...c,
            inventory: mergeInventoryEntry(
              this.getCharacterInventory(c),
              nextItem,
              false
            ),
          }));
          this.pcTab.set('loadout');
          this.notifications.success(
            'Added to Inventory',
            `${wep.name} added to ${char.name}'s inventory.`
          );
          return;
        }

        const targetSlot: 1 | 2 =
          zone === 'slot-1'
            ? 1
            : zone === 'slot-2'
              ? 2
              : !char.weapon_slot_1_id
                ? 1
                : !char.weapon_slot_2_id
                  ? 2
                  : char.active_weapon_slot;
        await this.changeWeaponSlot(char, targetSlot, wep.id);
        this.pcTab.set('loadout');
        this.notifications.success(
          'Weapon Equipped',
          `${wep.name} equipped in Slot ${targetSlot} on ${char.name}.`
        );
        return;
      }

      if (zone === 'inventory') {
        const nextItem = buildWeaponInventoryEntry(wep, 1);
        await this.patchNpcStatsField({
          __inventory: mergeInventoryEntry(this.getNpcInventory(), nextItem, false),
        });
        this.npcTab.set('inventory');
        this.notifications.success(
          'Added to NPC Inventory',
          `${wep.name} added to ${this.getNpcName()}'s inventory.`
        );
        return;
      }

      await this.applyCompendiumWeaponToNpc(wep.id);
      const armedFormula = this.getNpcWeaponFormula(wep);
      this.npcTab.set('inventory');
      this.notifications.success(
        'NPC Weapon Equipped',
        `${this.getNpcName()} armed with ${wep.name} (${armedFormula.rollFormula} · ${armedFormula.flatDamage} DMG).`
      );
      return;
    }

    if (payload.kind === 'compendium-armor') {
      const armor = this.getAllCompendiumArmors().find(
        (a) => a.id === payload.itemId
      );
      if (!armor) return;

      if (this.sheetMode() === 'character') {
        const char = await this.ensureCharacterForSheetDrop();
        if (!char) return;

        if (zone === 'inventory') {
          const entry = buildArmorInventoryEntry(armor, false);
          await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
            ...c,
            inventory: mergeInventoryEntry(
              this.getCharacterInventory(c),
              entry,
              false
            ),
          }));
          this.pcTab.set('loadout');
          this.notifications.success(
            'Added to Inventory',
            `${armor.name} (+${armor.armor_sp} SP, +${armor.armor_dr} DR) added to ${char.name}'s inventory.`
          );
          return;
        }

        await this.selectLoadoutArmorChoice(char, `comp:${armor.id}`);
        this.pcTab.set('loadout');
        this.notifications.success(
          'Armor Equipped',
          `${armor.name} (+${armor.armor_sp} SP, +${armor.armor_dr} DR) equipped on ${char.name}.`
        );
        return;
      }

      if (zone === 'inventory') {
        const entry = buildArmorInventoryEntry(armor, false);
        await this.patchNpcStatsField({
          __inventory: mergeInventoryEntry(this.getNpcInventory(), entry, false),
        });
        this.npcTab.set('inventory');
        this.notifications.success(
          'Added to NPC Inventory',
          `${armor.name} added to ${this.getNpcName()}'s inventory.`
        );
        return;
      }

      const list = this.getNpcInventory();
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
      const currStats = this.getNpcStats();
      await this.patchSheetActorOrToken({
        armor_dr: armor.armor_dr,
        npc_stats: {
          ...currStats,
          __inventory: nextInv,
        },
      });
      this.npcTab.set('inventory');
      this.notifications.success(
        'NPC Armor Equipped',
        `${this.getNpcName()} equipped ${armor.name} (+${armor.armor_sp} SP, +${armor.armor_dr} DR).`
      );
      return;
    }

    if (payload.kind === 'compendium-item') {
      const compItem = this.getActiveCompendiumItems().find(
        (i) => i.id === payload.itemId
      );
      if (!compItem) return;
      const entry = buildCompendiumGearInventoryEntry(compItem);
      const canStack = compItem.stackable !== false;

      if (this.sheetMode() === 'character') {
        const char = await this.ensureCharacterForSheetDrop();
        if (!char) return;
        await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
          ...c,
          inventory: mergeInventoryEntry(
            this.getCharacterInventory(c),
            entry,
            canStack
          ),
        }));
        this.pcTab.set('loadout');
        this.notifications.success(
          'Item Added',
          `${compItem.name} (×${compItem.default_quantity}) added to ${char.name}'s inventory.`
        );
        return;
      }

      await this.patchNpcStatsField({
        __inventory: mergeInventoryEntry(this.getNpcInventory(), entry, canStack),
      });
      this.npcTab.set('inventory');
      this.notifications.success(
        'NPC Item Added',
        `${compItem.name} (×${compItem.default_quantity}) added to ${this.getNpcName()}'s inventory.`
      );
      return;
    }

    if (payload.kind === 'compendium-standalone') {
      if (!this.canGrantStandalone()) return;
      const node = this.getAllCompendiumPerkNodes().find(
        (p) => p.id === payload.itemId
      );
      if (!node || !isStandalonePerkNode(node)) return;

      if (this.sheetMode() === 'character') {
        const char = await this.ensureCharacterForSheetDrop();
        if (!char) return;
        if (char.unlocked_perk_ids.includes(node.id)) {
          this.pcTab.set('perks');
          this.notifications.info(
            'Already Granted',
            `${char.name} already has ${node.name}.`
          );
          return;
        }
        await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
          ...c,
          unlocked_perk_ids: c.unlocked_perk_ids.includes(node.id)
            ? c.unlocked_perk_ids
            : [...c.unlocked_perk_ids, node.id],
        }));
        this.pcTab.set('perks');
        this.notifications.success(
          'Standalone Skill Granted',
          `${node.name} granted to ${char.name}.`
        );
        return;
      }

      await this.grantNpcStandaloneSkill(node.id);
      this.npcTab.set('skills');
    }
  }
}
