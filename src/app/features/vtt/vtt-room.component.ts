import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  UserAssetModel,
  UserAssetPurpose,
  extractAssetDisplayNameFromUrl,
  formatAssetByteSize,
} from '../../core/assets/user-assets.model';
import { UserAssetsStore } from '../../core/assets/user-assets.store';
import { AuthStore } from '../../core/auth/auth.store';
import {
  ActiveCombatTag,
  ArmorModel,
  COMPENDIUM_ICON_PRESETS,
  CombatStatusEffect,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ARMORS,
  DEFAULT_COMPENDIUM_ITEMS,
  ITEM_SUBCATEGORY_OPTIONS,
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  WeaponModel,
  formatWeaponHookBadges,
  formatWeaponRequirementLabel,
  getCombatTagBadgeClass,
  getWeaponPropertyTags,
  isCompendiumItemActive,
  isStandalonePerkNode,
  resolveArmorVisuals,
  resolveCompendiumItemVisuals,
  resolveNodeVisuals,
  resolveWeaponVisuals,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { NotificationStore } from '../../core/notifications/notification.store';
import {
  DEFAULT_VTT_HOTKEYS,
  DICE_BODY_COLOR_SWATCHES,
  DICE_LABEL_COLOR_SWATCHES,
  VTT_DICE_MATERIAL_OPTIONS,
  VTT_DICE_PRESETS,
  VTT_HOTKEY_META,
  VttDiceMaterial,
  VttGeneralPreferences,
  VttHotkeyAction,
  VttHotkeyBindingMeta,
  VttSettingsStore,
  formatHotkeyBadge,
  isEditableKeyboardTarget,
  matchesHotkey,
  normalizeKeyComboFromEvent,
} from '../../core/settings/vtt-settings.store';
import { ThemeMode, ThemeStore } from '../../core/theme/theme.store';
import { AssetBrowserModalComponent } from '../../shared/asset-browser/asset-browser-modal.component';
import { ColorPickerComponent } from '../../shared/color-picker/color-picker.component';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { TokenAvatarComponent } from '../../shared/token-avatar/token-avatar.component';
import {
  CharacterModel,
  ResolvedCombatArt,
  formatRuleHookBadges,
} from '../characters/models/character.model';
import { CharacterStore } from '../characters/store/character.store';
import { CollectionsStore } from '../collections/collections.store';
import { VttActionHudComponent } from './components/vtt-action-hud/vtt-action-hud.component';
import { VttActorSheetComponent } from './components/vtt-actor-sheet/vtt-actor-sheet.component';
import { VttCanvasComponent } from './components/vtt-canvas/vtt-canvas.component';
import { VttCombatCarouselComponent } from './components/vtt-combat-carousel/vtt-combat-carousel.component';
import { VttCombatTrackerWindowComponent } from './components/vtt-combat-tracker-window/vtt-combat-tracker-window.component';
import { VttDiceOverlayComponent } from './components/vtt-dice-overlay/vtt-dice-overlay.component';
import { VttFloatingWindowComponent } from './components/vtt-floating-window/vtt-floating-window.component';
import { VttTokenizerWindowComponent } from './components/vtt-tokenizer-window/vtt-tokenizer-window.component';
import {
  VTT_CHAT_COMMANDS,
  VttChatCommandConfig,
  findMatchingSlashCommands,
  getAllCommandTriggers,
  getPrimaryCommandTrigger,
  resolveSlashCommand,
} from './config/vtt-commands.config';
import {
  DicePoolCounts,
  POLYHEDRAL_DIE_TYPES,
  PolyhedralDieType,
  RolledDieChip,
  VttQuickRollMode,
  applyDieClickToChatInput,
  applyModifierToChatInput,
  applyRollModeToChatInput,
  extractDicePoolFromChatInput,
  extractLogRollChips,
  extractModifierFromChatInput,
  extractRollModeFromChatInput,
  getTotalDiceInPool,
} from './engine/dice-roller.engine';
import {
  DirectoryFolderNode,
  DirectoryFolderOption,
  FOLDER_COLOR_SWATCHES,
  MAP_BG_COLOR_SWATCHES,
  buildDirectoryTree,
  canNestFolderInside,
} from './engine/directory-tree.engine';
import { computeSceneCanvasLayout } from './engine/hex-grid.engine';
import {
  DEFAULT_VTT_BG_COLOR,
  DEFAULT_VTT_DARKNESS_LEVEL,
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  DEFAULT_VTT_GRID_OPACITY,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_SCENE_HEIGHT_PX,
  DEFAULT_VTT_SCENE_PADDING,
  DEFAULT_VTT_SCENE_WIDTH_PX,
  CollectionActorModel,
  TokenAppearanceConfig,
  VTT_ACTOR_COLOR_SWATCHES,
  VTT_COMPENDIUM_DRAG_MIME,
  VTT_NPC_PRESETS,
  VTT_SCENE_LIGHTING_PRESETS,
  VttActorKind,
  VttCompendiumDragPayload,
  VttDefenseChoice,
  VttDirectoryScope,
  VttFaction,
  VttFolderModel,
  VttGridMode,
  VttLogEntry,
  VttNpcPreset,
  VttRosterActorModel,
  VttRosterDragPayload,
  VttSceneLightingPreset,
  VttSceneModel,
  VttTokenModel,
  VttToolMode,
  VttWallKind,
  computeEffectiveActorSightFeet,
  findMatchingSceneLightingPreset,
  hasCustomTokenAppearance,
  hasRosterActorExternalSource,
  normalizeTokenAppearance,
  normalizeTokenRotation,
  resolveActorDarkvisionFeet,
  resolveEntityPortraitUrl,
  resolveEntityTokenAppearance,
  resolveEntityTokenImageUrl,
  resolveRosterActorSourceCharacterId,
} from './models/vtt.model';
import {
  VttSpeakerMode,
  VttStore,
  VttWhisperTargetOption,
} from './store/vtt.store';

export type VttSidebarTab =
  | 'log'
  | 'actors'
  | 'maps'
  | 'compendium'
  | 'settings';
export type VttCompendiumPackKind = 'weapons' | 'armors' | 'items' | 'skills';
export type VttSettingsModalKind = 'general' | 'dice' | 'controls' | 'invites';
export type EditSceneModalTab = 'general' | 'grid' | 'visibility';
export type VttRosterImportTab =
  | 'my-characters'
  | 'collections'
  | 'party'
  | 'presets';

export interface DirectoryContextMenuState {
  kind: 'map' | 'folder' | 'roster-actor';
  targetId: string;
  screenX: number;
  screenY: number;
}

export interface RosterActorModalState {
  folder_id: string | null;
  actor_kind: VttActorKind;
  name: string;
  saveToCollections: boolean;
}

export interface CreateBlankMapModalState {
  folder_id: string | null;
  name: string;
  activateForParty: boolean;
}

export interface DirectoryFolderModalState {
  mode: 'create' | 'edit';
  scope: VttDirectoryScope;
  folderId: string | null;
  name: string;
  parent_folder_id: string | null;
  color: string;
}

export interface EditingMapDraft {
  sceneId: string;
  name: string;
  folder_id: string | null;
  map_image_url: string;
  background_color: string;
  grid_mode: VttGridMode;
  scene_width: number;
  scene_height: number;
  padding: number;
  grid_size_px: number;
  grid_offset_x: number;
  grid_offset_y: number;
  grid_opacity: number;
  token_vision: boolean;
  fog_enabled: boolean;
  global_illumination: boolean;
  darkness_level: number;
  isUploadingImage: boolean;
  imageNaturalWidth: number | null;
  imageNaturalHeight: number | null;
}

@Component({
  selector: 'app-vtt-room',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    NgTemplateOutlet,
    AssetBrowserModalComponent,
    ColorPickerComponent,
    CompendiumIconComponent,
    TokenAvatarComponent,
    VttActionHudComponent,
    VttActorSheetComponent,
    VttCanvasComponent,
    VttCombatCarouselComponent,
    VttCombatTrackerWindowComponent,
    VttDiceOverlayComponent,
    VttFloatingWindowComponent,
    VttTokenizerWindowComponent,
  ],
  templateUrl: './vtt-room.component.html',
})
export class VttRoomComponent {
  readonly vttStore = inject(VttStore);
  readonly authStore = inject(AuthStore);
  readonly themeStore = inject(ThemeStore);
  readonly settingsStore = inject(VttSettingsStore);
  readonly characterStore = inject(CharacterStore);
  readonly collectionsStore = inject(CollectionsStore);
  readonly compendiumStore = inject(CompendiumStore);
  readonly userAssetsStore = inject(UserAssetsStore);
  private readonly notifications = inject(NotificationStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly canvasComp = viewChild<VttCanvasComponent>('vttCanvas');
  readonly logScrollEl = viewChild<ElementRef<HTMLDivElement>>('logScroll');
  readonly chatComposerEl =
    viewChild<ElementRef<HTMLTextAreaElement>>('chatComposerInput');
  readonly compendiumWeaponsWindowRef =
    viewChild<VttFloatingWindowComponent>('compendiumWeaponsWin');
  readonly compendiumArmorsWindowRef =
    viewChild<VttFloatingWindowComponent>('compendiumArmorsWin');
  readonly compendiumItemsWindowRef =
    viewChild<VttFloatingWindowComponent>('compendiumItemsWin');
  readonly compendiumSkillsWindowRef =
    viewChild<VttFloatingWindowComponent>('compendiumSkillsWin');

  readonly npcPresets = VTT_NPC_PRESETS;
  readonly sceneLightingPresets = VTT_SCENE_LIGHTING_PRESETS;
  readonly folderSwatches = FOLDER_COLOR_SWATCHES;
  readonly mapBgSwatches = MAP_BG_COLOR_SWATCHES;
  readonly actorColorSwatches = VTT_ACTOR_COLOR_SWATCHES;
  readonly iconPresets = COMPENDIUM_ICON_PRESETS;
  readonly itemSubcategories = ITEM_SUBCATEGORY_OPTIONS;
  readonly defaultSceneWidthPx = DEFAULT_VTT_SCENE_WIDTH_PX;
  readonly defaultSceneHeightPx = DEFAULT_VTT_SCENE_HEIGHT_PX;
  readonly defaultGridSizePx = DEFAULT_VTT_GRID_SIZE_PX;
  readonly defaultScenePadding = DEFAULT_VTT_SCENE_PADDING;
  readonly defaultGridOpacity = DEFAULT_VTT_GRID_OPACITY;
  readonly defaultDarknessLevel = DEFAULT_VTT_DARKNESS_LEVEL;
  readonly statusOptions: Exclude<CombatStatusEffect, 'None'>[] = [
    'Sundered',
    'Staggered',
    'Bleeding',
    'Pinned',
  ];

  readonly sidebarOpen = signal(true);
  readonly sidebarTab = signal<VttSidebarTab>('log');
  readonly dockCollapsed = signal(false);
  readonly migrationBannerDismissed = signal(false);
  readonly showCustomNpcForm = signal(false);
  readonly copiedInvite = signal(false);
  readonly copiedInviteLink = signal(false);
  readonly inGameMenuOpen = signal(false);

  readonly mapSearchQuery = signal('');
  readonly rosterSearchQuery = signal('');
  readonly compendiumWeaponsWindowOpen = signal(false);
  readonly compendiumArmorsWindowOpen = signal(false);
  readonly compendiumItemsWindowOpen = signal(false);
  readonly compendiumSkillsWindowOpen = signal(false);
  readonly compendiumWeaponsSearch = signal('');
  readonly compendiumWeaponSubfilter = signal<
    'all' | 'Light' | 'Martial' | 'Heavy' | 'Ranged'
  >('all');
  readonly expandedCompendiumWeaponId = signal<string | null>(null);
  readonly compendiumArmorsSearch = signal('');
  readonly compendiumArmorSubfilter = signal<
    'all' | 'Light' | 'Medium' | 'Heavy'
  >('all');
  readonly expandedCompendiumArmorId = signal<string | null>(null);
  readonly compendiumItemsSearch = signal('');
  readonly compendiumItemSubfilter = signal<string>('all');
  readonly expandedCompendiumItemId = signal<string | null>(null);
  readonly compendiumSkillsSearch = signal('');
  readonly compendiumSkillSubfilter = signal<
    'all' | 'combat_art' | 'passive_upgrade'
  >('all');
  readonly expandedCompendiumSkillId = signal<string | null>(null);
  readonly getCombatTagBadge = getCombatTagBadgeClass;

  readonly compendiumWeapons = computed<WeaponModel[]>(() => {
    if (typeof this.compendiumStore.weapons === 'function') {
      return this.compendiumStore.weapons();
    }
    if (typeof this.compendiumStore.allWeapons === 'function') {
      return this.compendiumStore
        .allWeapons()
        .filter((w) => isCompendiumItemActive(w));
    }
    return [];
  });

  readonly compendiumArmors = computed<ArmorModel[]>(() => {
    if (typeof this.compendiumStore.armors === 'function') {
      return this.compendiumStore.armors();
    }
    if (typeof this.compendiumStore.allArmors === 'function') {
      return this.compendiumStore
        .allArmors()
        .filter((a) => isCompendiumItemActive(a));
    }
    return DEFAULT_COMPENDIUM_ARMORS;
  });

  readonly compendiumItems = computed<CompendiumItemModel[]>(() => {
    if (typeof this.compendiumStore.items === 'function') {
      return this.compendiumStore.items();
    }
    if (typeof this.compendiumStore.allItems === 'function') {
      return this.compendiumStore
        .allItems()
        .filter((i) => isCompendiumItemActive(i));
    }
    return DEFAULT_COMPENDIUM_ITEMS;
  });

  readonly compendiumStandaloneNodes = computed<PerkNodeModel[]>(() => {
    if (typeof this.compendiumStore.standaloneNodes === 'function') {
      return this.compendiumStore.standaloneNodes();
    }
    if (typeof this.compendiumStore.allPerkNodes === 'function') {
      return this.compendiumStore
        .allPerkNodes()
        .filter((p) => isStandalonePerkNode(p) && isCompendiumItemActive(p));
    }
    return [];
  });

  readonly isCompendiumLoading = computed<boolean>(() => {
    if (typeof this.compendiumStore.isLoading === 'function') {
      return this.compendiumStore.isLoading();
    }
    return false;
  });

  readonly totalCompendiumCount = computed<number>(
    () =>
      this.compendiumWeapons().length +
      this.compendiumArmors().length +
      this.compendiumItems().length +
      this.compendiumStandaloneNodes().length
  );

  readonly filteredCompendiumWeapons = computed<WeaponModel[]>(() => {
    const sub = this.compendiumWeaponSubfilter();
    const q = this.compendiumWeaponsSearch().trim().toLowerCase();
    return this.compendiumWeapons().filter((w) => {
      if (sub !== 'all' && w.category !== sub) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.gov_attribute.toLowerCase().includes(q) ||
        w.gov_skill.toLowerCase().includes(q) ||
        (w.trait_name ?? '').toLowerCase().includes(q) ||
        (w.trait_description ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly filteredCompendiumArmors = computed<ArmorModel[]>(() => {
    const sub = this.compendiumArmorSubfilter();
    const q = this.compendiumArmorsSearch().trim().toLowerCase();
    return this.compendiumArmors().filter((a) => {
      if (sub !== 'all' && a.weight_class !== sub) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.weight_class.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly filteredCompendiumItems = computed<CompendiumItemModel[]>(() => {
    const sub = this.compendiumItemSubfilter();
    const q = this.compendiumItemsSearch().trim().toLowerCase();
    return this.compendiumItems().filter((it) => {
      if (sub !== 'all' && it.subcategory !== sub) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.subcategory.toLowerCase().includes(q) ||
        (it.description ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly filteredCompendiumStandaloneNodes = computed<PerkNodeModel[]>(() => {
    const sub = this.compendiumSkillSubfilter();
    const q = this.compendiumSkillsSearch().trim().toLowerCase();
    return this.compendiumStandaloneNodes().filter((node) => {
      if (sub !== 'all' && node.node_type !== sub) return false;
      if (!q) return true;
      return (
        node.name.toLowerCase().includes(q) ||
        (node.description ?? '').toLowerCase().includes(q) ||
        (node.combat_tag ?? '').toLowerCase().includes(q) ||
        (node.node_type === 'combat_art' ? 'combat art' : 'passive').includes(q)
      );
    });
  });
  readonly collapsedFolderIds = signal<Record<string, boolean>>({});
  readonly draggingMapId = signal<string | null>(null);
  readonly draggingRosterActorId = signal<string | null>(null);
  readonly draggingFolderId = signal<string | null>(null);
  readonly dragOverTarget = signal<string | null>(null);
  readonly showActiveSceneTokens = signal(true);

  readonly directoryContextMenu = signal<DirectoryContextMenuState | null>(null);
  readonly createMapModal = signal<CreateBlankMapModalState | null>(null);
  readonly folderModal = signal<DirectoryFolderModalState | null>(null);
  readonly editingMapDraft = signal<EditingMapDraft | null>(null);
  readonly editMapTab = signal<EditSceneModalTab>('general');
  readonly rosterActorModal = signal<RosterActorModalState | null>(null);
  readonly rosterImportModalOpen = signal(false);
  readonly rosterImportTab = signal<VttRosterImportTab>('my-characters');
  readonly rosterImportFolderId = signal<string | null>(null);
  readonly rosterImportSearch = signal('');
  readonly rosterImportUrlInput = signal('');
  readonly isImportingCharacterUrl = signal(false);
  readonly activeSettingsModal = signal<VttSettingsModalKind | null>(null);
  readonly assetBrowserModal = signal<{
    mode: 'picker' | 'manage';
    purpose: UserAssetPurpose;
    initialFolderId?: string | null;
    currentUrl: string | null;
    openRoutingOnInit: boolean;
  } | null>(null);
  readonly recordingHotkeyAction = signal<VttHotkeyAction | null>(null);
  readonly confirmClearLogs = signal(false);
  readonly formatBadge = formatHotkeyBadge;
  readonly extractAssetName = extractAssetDisplayNameFromUrl;
  readonly formatAssetBytes = formatAssetByteSize;

  readonly editingMapMatchedAsset = computed<UserAssetModel | null>(() => {
    const draft = this.editingMapDraft();
    if (!draft?.map_image_url) return null;
    return this.userAssetsStore.findAssetByUrl(draft.map_image_url);
  });

  readonly campaignInviteLink = computed<string>(() => {
    const code = this.vttStore.campaign()?.invite_code;
    if (!code) return '';
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : '';
    return `${origin}/dashboard?invite=${encodeURIComponent(code)}`;
  });

  readonly visibleHotkeyBindings = computed<VttHotkeyBindingMeta[]>(() =>
    VTT_HOTKEY_META.filter((m) => !m.gmOnly || this.vttStore.isGm())
  );

  readonly polyhedralDiceTypes = POLYHEDRAL_DIE_TYPES;
  readonly chatCommandsRegistry = VTT_CHAT_COMMANDS;
  readonly dicePresets = VTT_DICE_PRESETS;
  readonly diceMaterialOptions = VTT_DICE_MATERIAL_OPTIONS;
  readonly diceBodySwatches = DICE_BODY_COLOR_SWATCHES;
  readonly diceLabelSwatches = DICE_LABEL_COLOR_SWATCHES;
  readonly chatInput = signal<string>('');
  readonly slashSuggestionsDismissed = signal<boolean>(false);

  readonly dicePool = computed<DicePoolCounts>(() =>
    extractDicePoolFromChatInput(this.chatInput(), this.chatCommandsRegistry)
  );
  readonly customPoolTotalCount = computed<number>(() =>
    getTotalDiceInPool(this.dicePool())
  );
  readonly activeRollMode = computed<VttQuickRollMode>(() =>
    extractRollModeFromChatInput(this.chatInput(), this.chatCommandsRegistry)
  );
  readonly activeRollModifier = computed<number>(() =>
    extractModifierFromChatInput(this.chatInput(), this.chatCommandsRegistry)
  );
  readonly activeSlashCommand = computed(() =>
    resolveSlashCommand(this.chatInput(), this.chatCommandsRegistry)
  );
  readonly isRollComposerActive = computed<boolean>(() => {
    const act = this.activeSlashCommand()?.config.action;
    return act === 'roll' || act === 'gm_roll';
  });
  readonly composerSubmitLabel = computed<string>(() => {
    const act = this.activeSlashCommand()?.config.action;
    if (act === 'roll') return 'Roll';
    if (act === 'gm_roll') return 'GM Roll';
    if (act === 'whisper') return 'Whisper';
    if (act === 'ooc') return 'OOC';
    if (act === 'emote') return 'Emote';
    return 'Send';
  });
  readonly slashCommandSuggestions = computed<VttChatCommandConfig[]>(() => {
    if (this.slashSuggestionsDismissed()) return [];
    const raw = this.chatInput().trimStart();
    if (!raw.startsWith('/') || /\s/.test(raw)) {
      return [];
    }
    return findMatchingSlashCommands(
      raw,
      this.vttStore.isGm(),
      this.chatCommandsRegistry
    );
  });
  readonly whisperTargetSuggestions = computed<VttWhisperTargetOption[]>(() => {
    if (this.slashSuggestionsDismissed()) return [];
    const raw = this.chatInput().trimStart();
    const resolved = resolveSlashCommand(raw, this.chatCommandsRegistry);
    if (!resolved || resolved.config.action !== 'whisper') {
      return [];
    }
    const spaceIdx = raw.search(/\s/);
    if (spaceIdx === -1) {
      return [];
    }
    const afterCmd = raw.slice(spaceIdx + 1);
    if (afterCmd.includes(' ')) {
      return [];
    }
    const q = afterCmd.trim().toLowerCase().replace(/^@/, '');
    const allTargets = this.vttStore.whisperTargets();
    if (!q) {
      return allTargets;
    }
    return allTargets.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.insertToken.toLowerCase().replace(/^@/, '').includes(q)
    );
  });

  get chatText(): string {
    return this.chatInput();
  }
  set chatText(val: string) {
    this.chatInput.set(val ?? '');
  }

  manualAttackTotalInput: number | null = null;
  manualDefenseTotalInput: number | null = null;

  overrideHitLanded = true;
  overrideSpDmg = 0;
  overrideHpDmg = 0;
  overrideCounterSp = 0;
  overrideDefAp = 0;
  private syncedResolutionKey: string | null = null;

  customNpcName = 'Bandit Cutthroat';
  customNpcFaction: VttFaction = 'enemy';
  customNpcHp = 8;
  customNpcSp = 4;
  customNpcDr = 1;
  customNpcBlock = 0;
  customNpcMoveFeet = 20;
  customNpcAttackMod = 3;
  customNpcDamage = 4;
  customNpcReachFeet = 5;
  customNpcTag: ActiveCombatTag | 'None' = 'None';

  readonly formatWeaponReq = formatWeaponRequirementLabel;
  readonly tagBadgeClass = getCombatTagBadgeClass;

  readonly mapDirectoryTree = computed(() =>
    buildDirectoryTree(this.vttStore.folders(), this.vttStore.scenes(), {
      scope: 'maps',
      getItemFolderId: (s) => s.folder_id,
      getItemName: (s) => s.name,
      getItemSortOrder: (s) => s.sort_order ?? 0,
      searchQuery: this.mapSearchQuery(),
    })
  );

  readonly visibleCampaignRosterActors = computed<VttRosterActorModel[]>(() => {
    const all = this.vttStore.rosterActors();
    if (this.vttStore.isGm()) return all;
    return all.filter((a) => this.vttStore.canDeployRosterActor(a));
  });

  readonly rosterDirectoryTree = computed(() => {
    const raw = buildDirectoryTree(
      this.vttStore.folders(),
      this.visibleCampaignRosterActors(),
      {
        scope: 'characters',
        getItemFolderId: (a) => a.folder_id,
        getItemName: (a) => a.name,
        getItemSortOrder: (a) => a.sort_order ?? 0,
        searchQuery: this.rosterSearchQuery(),
      }
    );
    if (this.vttStore.isGm()) {
      return raw;
    }
    const pruneEmpty = (
      nodes: DirectoryFolderNode<VttRosterActorModel>[]
    ): DirectoryFolderNode<VttRosterActorModel>[] =>
      nodes
        .filter((n) => n.totalItemCount > 0)
        .map((n) => ({
          ...n,
          subfolders: pruneEmpty(n.subfolders),
        }));
    return {
      ...raw,
      folders: pruneEmpty(raw.folders),
    };
  });

  readonly contextMenuMap = computed<VttSceneModel | null>(() => {
    const menu = this.directoryContextMenu();
    if (!menu || menu.kind !== 'map') return null;
    return this.vttStore.scenes().find((s) => s.id === menu.targetId) ?? null;
  });

  readonly contextMenuFolder = computed<VttFolderModel | null>(() => {
    const menu = this.directoryContextMenu();
    if (!menu || menu.kind !== 'folder') return null;
    return this.vttStore.folders().find((f) => f.id === menu.targetId) ?? null;
  });

  readonly contextMenuRosterActor = computed<VttRosterActorModel | null>(() => {
    const menu = this.directoryContextMenu();
    if (!menu || menu.kind !== 'roster-actor') return null;
    return (
      this.vttStore.rosterActors().find((a) => a.id === menu.targetId) ?? null
    );
  });

  readonly validParentFolderOptions = computed<DirectoryFolderOption[]>(() => {
    const fm = this.folderModal();
    if (!fm) return [];
    const tree = buildDirectoryTree(this.vttStore.folders(), [], {
      scope: fm.scope,
      getItemFolderId: () => null,
      getItemName: () => '',
    });
    return tree.flatFolderOptions.filter((opt) =>
      canNestFolderInside(
        fm.folderId,
        opt.id,
        this.vttStore.folders(),
        fm.scope
      )
    );
  });

  readonly deployableCharacters = computed<CharacterModel[]>(() => {
    const uid = this.authStore.user()?.id;
    const all = this.vttStore.allCharacters();
    if (this.vttStore.isGm()) {
      return all;
    }
    return all.filter((c) => c.owner_id === uid);
  });

  readonly unimportedDeployableCharacters = computed<CharacterModel[]>(() => {
    const importedIds = new Set(
      this.vttStore
        .rosterActors()
        .map((a) => resolveRosterActorSourceCharacterId(a))
        .filter((id): id is string => Boolean(id))
    );
    const uid = this.authStore.user()?.id;
    const pool = new Map<string, CharacterModel>();
    for (const c of this.deployableCharacters()) {
      pool.set(c.id, c);
    }
    if (uid) {
      for (const c of this.characterStore.characters()) {
        if (c.owner_id === uid) {
          pool.set(c.id, c);
        }
      }
    }
    return Array.from(pool.values()).filter((c) => !importedIds.has(c.id));
  });

  readonly filteredImportMyCharacters = computed<CharacterModel[]>(() => {
    const q = this.rosterImportSearch().trim().toLowerCase();
    const uid = this.authStore.user()?.id;
    const pool = new Map<string, CharacterModel>();
    for (const c of this.characterStore.characters()) {
      pool.set(c.id, c);
    }
    if (uid) {
      for (const c of this.vttStore.allCharacters()) {
        if (c.owner_id === uid) {
          pool.set(c.id, c);
        }
      }
    }
    const list = Array.from(pool.values());
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  });

  readonly filteredImportCollectionActors = computed<CollectionActorModel[]>(
    () => {
      const q = this.rosterImportSearch().trim().toLowerCase();
      const list = this.collectionsStore.actors();
      if (!q) return list;
      return list.filter((a) => a.name.toLowerCase().includes(q));
    }
  );

  readonly filteredImportPartyCharacters = computed<CharacterModel[]>(() => {
    const q = this.rosterImportSearch().trim().toLowerCase();
    const list = this.vttStore.allCharacters();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  });

  readonly filteredImportPresets = computed<VttNpcPreset[]>(() => {
    const q = this.rosterImportSearch().trim().toLowerCase();
    if (!q) return this.npcPresets;
    return this.npcPresets.filter((p) => p.name.toLowerCase().includes(q));
  });

  readonly visibleRosterTokens = computed<VttTokenModel[]>(() => {
    const all = this.vttStore.sceneTokens();
    if (this.vttStore.isGm()) return all;
    return all.filter((t) => !t.is_hidden || this.vttStore.canControlToken(t));
  });

  readonly canRespondToClash = computed<boolean>(() => {
    if (this.vttStore.isGm()) return true;
    const def = this.vttStore.pendingClashDefender();
    return this.vttStore.canControlToken(def);
  });

  readonly canCancelPreRollClash = computed<boolean>(() => {
    if (this.vttStore.isGm()) return true;
    const clash = this.vttStore.pendingClash();
    if (!clash) return false;
    const attacker = this.vttStore
      .sceneTokens()
      .find((t) => t.id === clash.attackerTokenId);
    const defender = this.vttStore.pendingClashDefender();
    return (
      this.vttStore.canControlToken(attacker) ||
      this.vttStore.canControlToken(defender)
    );
  });

  readonly editDraftLayout = computed(() => {
    const draft = this.editingMapDraft();
    if (!draft) return null;
    return computeSceneCanvasLayout({
      sceneWidthPx: Number(draft.scene_width) || DEFAULT_VTT_SCENE_WIDTH_PX,
      sceneHeightPx: Number(draft.scene_height) || DEFAULT_VTT_SCENE_HEIGHT_PX,
      naturalImageWidth: draft.imageNaturalWidth,
      naturalImageHeight: draft.imageNaturalHeight,
      gridSizePx: Number(draft.grid_size_px) || DEFAULT_VTT_GRID_SIZE_PX,
      padding:
        draft.padding !== undefined && draft.padding !== null
          ? Number(draft.padding)
          : DEFAULT_VTT_SCENE_PADDING,
      offsetX: Number(draft.grid_offset_x) || 0,
      offsetY: Number(draft.grid_offset_y) || 0,
    });
  });

  private lastTrackerSceneId: string | null = null;
  private lastTrackerPhase1Open = false;
  private lastTrackerCombatActive = false;
  private lastTrackerEnrolledCount = 0;

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const campaignId = params.get('campaignId');
      if (campaignId) {
        void this.vttStore.enterCampaignRoom(campaignId);
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.vttStore.leaveRoom();
    });

    effect(() => {
      const sc = this.vttStore.activeScene();
      const phase1Open = this.vttStore.isCombatInitiationOpen();
      const count = this.vttStore.enrolledCombatTokens().length;
      if (!sc) {
        this.lastTrackerSceneId = null;
        this.lastTrackerPhase1Open = false;
        this.lastTrackerCombatActive = false;
        this.lastTrackerEnrolledCount = 0;
        return;
      }
      if (this.lastTrackerSceneId !== sc.id) {
        this.lastTrackerSceneId = sc.id;
        this.lastTrackerPhase1Open = phase1Open;
        this.lastTrackerCombatActive = sc.combat_active;
        this.lastTrackerEnrolledCount = count;
        if (phase1Open) {
          this.vttStore.combatTrackerDrawerOpen.set(true);
        }
        return;
      }
      const prevPhase1Open = this.lastTrackerPhase1Open;
      const prevCombatActive = this.lastTrackerCombatActive;
      const prevCount = this.lastTrackerEnrolledCount;
      this.lastTrackerPhase1Open = phase1Open;
      this.lastTrackerCombatActive = sc.combat_active;
      this.lastTrackerEnrolledCount = count;

      if (!prevCombatActive && sc.combat_active) {
        this.vttStore.combatTrackerDrawerOpen.set(false);
        return;
      }
      if (!prevPhase1Open && phase1Open) {
        this.vttStore.combatTrackerDrawerOpen.set(true);
        return;
      }
      if (prevPhase1Open && !phase1Open && !sc.combat_active) {
        this.vttStore.combatTrackerDrawerOpen.set(false);
        return;
      }
      if (phase1Open && count > prevCount && count > 0) {
        this.vttStore.combatTrackerDrawerOpen.set(true);
      }
    });

    effect(() => {
      const tab = this.sidebarTab();
      if (tab === 'actors') {
        void this.characterStore.ensureUserCharactersLoaded();
      } else if (tab === 'settings') {
        void this.userAssetsStore.ensureLoaded();
      }
    });

    effect(() => {
      const clash = this.vttStore.pendingClash();
      const res = clash?.resolution;
      if (!clash || !res) {
        this.syncedResolutionKey = null;
        return;
      }
      const key = `${clash.id}-${clash.selectedReaction}-${res.summary}`;
      if (this.syncedResolutionKey !== key) {
        this.syncedResolutionKey = key;
        this.overrideHitLanded = res.hitLanded;
        this.overrideSpDmg = res.spDamageToDefender;
        this.overrideHpDmg = res.hpDamageToDefender;
        this.overrideCounterSp = res.counterSpToAttacker;
        this.overrideDefAp = res.defenderApSpent;
      }
    });

    effect(() => {
      this.vttStore.visibleLogs();
      queueMicrotask(() => {
        const el = this.logScrollEl()?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  @HostListener('window:pointerdown')
  onWindowPointerDown(): void {
    if (this.directoryContextMenu()) {
      this.directoryContextMenu.set(null);
    }
  }

  openInGameMenu(): void {
    this.closeDirectoryContextMenu();
    this.closeSettingsModal();
    this.inGameMenuOpen.set(true);
  }

  closeInGameMenu(): void {
    this.inGameMenuOpen.set(false);
  }

  openSettingsModal(kind: VttSettingsModalKind): void {
    this.inGameMenuOpen.set(false);
    this.closeDirectoryContextMenu();
    this.recordingHotkeyAction.set(null);
    this.activeSettingsModal.set(kind);
  }

  closeSettingsModal(): void {
    this.recordingHotkeyAction.set(null);
    this.activeSettingsModal.set(null);
  }

  resetGeneralPreferences(): void {
    this.settingsStore.resetPreferences();
    this.notifications.info(
      'Settings Reset',
      'Restored default movement, audio, and interface settings.'
    );
  }

  formatTokenMoveSpeedLabel(speed: number): string {
    if (speed <= 0) return 'Instant';
    const tilesPerSec = Number((speed / 5).toFixed(1));
    return `${speed} ft/s · ${tilesPerSec} tiles/s`;
  }

  returnToMainMenu(): void {
    this.inGameMenuOpen.set(false);
    void this.router.navigate(['/dashboard']);
  }

  reloadApplication(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  openContentManager(): void {
    if (!this.authStore.isAdmin()) return;
    this.inGameMenuOpen.set(false);
    void this.router.navigate(['/content-manager']);
  }

  openCollections(): void {
    this.inGameMenuOpen.set(false);
    this.rosterImportModalOpen.set(false);
    if (this.authStore.isAdmin()) {
      void this.router.navigate(['/content-manager/collections']);
    } else {
      void this.router.navigate(['/collections']);
    }
  }

  openSettingsTab(): void {
    this.inGameMenuOpen.set(false);
    this.closeDirectoryContextMenu();
    this.recordingHotkeyAction.set(null);
    this.sidebarOpen.set(true);
    this.sidebarTab.set('settings');
  }

  setVttThemeMode(mode: ThemeMode): void {
    this.themeStore.setVttTheme(mode, this.authStore.user()?.id);
  }

  updatePreference<K extends keyof VttGeneralPreferences>(
    key: K,
    value: VttGeneralPreferences[K]
  ): void {
    this.settingsStore.updatePreferences({ [key]: value });
  }

  testAudioCue(): void {
    this.settingsStore.playUiCue('ping');
  }

  startRecordingHotkey(action: VttHotkeyAction): void {
    this.recordingHotkeyAction.set(
      this.recordingHotkeyAction() === action ? null : action
    );
  }

  isDefaultHotkey(action: VttHotkeyAction): boolean {
    return this.settingsStore.hotkeys()[action] === DEFAULT_VTT_HOTKEYS[action];
  }

  resetSingleHotkey(action: VttHotkeyAction): void {
    this.recordingHotkeyAction.set(null);
    this.settingsStore.resetHotkey(action);
  }

  resetAllHotkeys(): void {
    this.recordingHotkeyAction.set(null);
    this.settingsStore.resetAllHotkeys();
    this.notifications.info(
      'Hotkeys Reset',
      'Restored default VTT keyboard shortcuts.'
    );
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeyDown(event: KeyboardEvent): void {
    const recording = this.recordingHotkeyAction();
    if (recording) {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape' || event.key === 'Escape') {
        this.recordingHotkeyAction.set(null);
        return;
      }
      const combo = normalizeKeyComboFromEvent(event);
      if (!combo) return;

      const res = this.settingsStore.setHotkey(recording, combo);
      if (!res.applied) {
        this.notifications.error(
          'Reserved Key',
          res.reason ?? 'Cannot bind that shortcut.'
        );
        return;
      }
      this.recordingHotkeyAction.set(null);
      if (res.swappedWith) {
        const swappedMeta = VTT_HOTKEY_META.find(
          (m) => m.action === res.swappedWith
        );
        this.notifications.info(
          'Shortcut Swapped',
          `Swapped binding with ${swappedMeta?.label ?? res.swappedWith}.`
        );
      }
      return;
    }

    if (event.code === 'Escape' || event.key === 'Escape') {
      if (event.repeat) return;
      event.preventDefault();

      if (this.inGameMenuOpen()) {
        this.inGameMenuOpen.set(false);
        return;
      }
      if (
        this.slashCommandSuggestions().length > 0 ||
        this.whisperTargetSuggestions().length > 0
      ) {
        this.slashSuggestionsDismissed.set(true);
        return;
      }
      if (this.directoryContextMenu()) {
        this.directoryContextMenu.set(null);
        return;
      }
      if (this.activeSettingsModal()) {
        this.closeSettingsModal();
        return;
      }
      if (this.createMapModal()) {
        this.createMapModal.set(null);
        return;
      }
      if (this.folderModal()) {
        this.folderModal.set(null);
        return;
      }
      if (this.assetBrowserModal()) {
        this.assetBrowserModal.set(null);
        return;
      }
      if (this.editingMapDraft()) {
        this.editingMapDraft.set(null);
        return;
      }
      if (this.rosterActorModal()) {
        this.rosterActorModal.set(null);
        return;
      }
      if (this.rosterImportModalOpen()) {
        this.rosterImportModalOpen.set(false);
        return;
      }
      if (this.canvasComp()?.dismissTransientEscapeState()) {
        return;
      }
      if (this.compendiumSkillsWindowOpen()) {
        this.compendiumSkillsWindowOpen.set(false);
        return;
      }
      if (this.compendiumItemsWindowOpen()) {
        this.compendiumItemsWindowOpen.set(false);
        return;
      }
      if (this.compendiumArmorsWindowOpen()) {
        this.compendiumArmorsWindowOpen.set(false);
        return;
      }
      if (this.compendiumWeaponsWindowOpen()) {
        this.compendiumWeaponsWindowOpen.set(false);
        return;
      }
      if (this.vttStore.openTokenizerTarget()) {
        this.vttStore.closeTokenizerStudio();
        return;
      }
      if (this.vttStore.closeTopmostActorSheet()) {
        return;
      }
      if (this.vttStore.pendingTargetAction()) {
        this.vttStore.cancelTargetSelection();
        return;
      }

      if (
        typeof HTMLElement !== 'undefined' &&
        event.target instanceof HTMLElement
      ) {
        event.target.blur?.();
      }
      this.inGameMenuOpen.set(true);
      return;
    }

    if (isEditableKeyboardTarget(event.target)) return;

    if (
      this.inGameMenuOpen() ||
      this.activeSettingsModal() === 'controls' ||
      this.assetBrowserModal() !== null
    ) {
      return;
    }

    const bindings = this.settingsStore.hotkeys();

    if (matchesHotkey(event, bindings.undo)) {
      event.preventDefault();
      if (this.canvasComp()?.hasActiveChainedOrDragMove()) {
        this.canvasComp()?.cancelActiveMovementOrDraft();
        return;
      }
      if (this.vttStore.canUndo()) {
        void this.vttStore.undoLastAction();
      }
      return;
    }

    if (event.repeat) return;

    if (matchesHotkey(event, bindings.delete_tokens)) {
      const insideFloatingWindow =
        typeof Element !== 'undefined' &&
        event.target instanceof Element &&
        Boolean(event.target.closest('[data-vtt-floating-window="true"]'));
      if (
        insideFloatingWindow ||
        this.canvasComp()?.hasActiveChainedOrDragMove() ||
        (this.vttStore.activeTool() === 'light' &&
          this.vttStore.selectedLightId() !== null)
      ) {
        return;
      }
      const controllable = this.vttStore.controllableSelectedTokens();
      if (controllable.length > 0) {
        event.preventDefault();
        this.canvasComp()?.tokenContextMenu.set(null);
        void this.vttStore.removeTokensBatch(controllable.map((t) => t.id));
      }
      return;
    }

    if (matchesHotkey(event, bindings.tool_select)) {
      event.preventDefault();
      this.selectTool('select');
      return;
    }
    if (matchesHotkey(event, bindings.tool_ruler)) {
      event.preventDefault();
      this.selectTool('ruler');
      return;
    }
    if (matchesHotkey(event, bindings.tool_pan)) {
      event.preventDefault();
      this.selectTool('pan');
      return;
    }
    if (this.vttStore.isGm() && matchesHotkey(event, bindings.tool_wall)) {
      event.preventDefault();
      this.selectTool('wall');
      return;
    }
    if (this.vttStore.isGm() && matchesHotkey(event, bindings.tool_light)) {
      event.preventDefault();
      this.selectTool('light');
      return;
    }
    if (this.vttStore.isGm() && matchesHotkey(event, bindings.tool_fog)) {
      event.preventDefault();
      this.selectTool('fog');
      return;
    }
    if (matchesHotkey(event, bindings.fit_scene)) {
      event.preventDefault();
      this.canvasComp()?.fitMapToViewport();
    }
  }

  selectTool(mode: VttToolMode): void {
    this.vttStore.activeTool.set(mode);
  }

  selectWallKind(kind: VttWallKind): void {
    this.vttStore.activeWallKind.set(kind);
  }

  copyInviteCode(): void {
    const code = this.vttStore.campaign()?.invite_code;
    if (!code) return;
    void navigator.clipboard?.writeText(code);
    this.copiedInvite.set(true);
    setTimeout(() => this.copiedInvite.set(false), 1800);
  }

  copyInviteLink(): void {
    const link = this.campaignInviteLink();
    if (!link) return;
    void navigator.clipboard?.writeText(link);
    this.copiedInviteLink.set(true);
    setTimeout(() => this.copiedInviteLink.set(false), 1800);
  }

  openMapsDirectory(): void {
    this.sidebarOpen.set(true);
    this.sidebarTab.set('maps');
  }

  viewMap(sceneId: string): void {
    if (!sceneId) return;
    void this.vttStore.selectOrActivateScene(sceneId, false);
  }

  activateMapForParty(sceneId: string): void {
    if (!sceneId || !this.vttStore.isGm()) return;
    this.directoryContextMenu.set(null);
    void this.vttStore.selectOrActivateScene(sceneId, true);
  }

  isFolderCollapsed(
    folderId: string,
    scope: VttDirectoryScope = 'maps'
  ): boolean {
    if (scope === 'maps' && this.mapSearchQuery().trim().length > 0) {
      return false;
    }
    if (scope === 'characters' && this.rosterSearchQuery().trim().length > 0) {
      return false;
    }
    return Boolean(this.collapsedFolderIds()[folderId]);
  }

  toggleFolderCollapsed(folderId: string): void {
    this.collapsedFolderIds.update((curr) => ({
      ...curr,
      [folderId]: !curr[folderId],
    }));
  }

  private expandFolder(folderId: string | null | undefined): void {
    if (!folderId) return;
    this.collapsedFolderIds.update((curr) => ({
      ...curr,
      [folderId]: false,
    }));
  }

  canFolderHaveSubfolder(
    folderId: string,
    scope: VttDirectoryScope = 'maps'
  ): boolean {
    return canNestFolderInside(null, folderId, this.vttStore.folders(), scope);
  }

  onMapDragStart(event: DragEvent, mapId: string): void {
    if (!this.vttStore.isGm()) return;
    event.stopPropagation();
    this.draggingMapId.set(mapId);
    this.draggingRosterActorId.set(null);
    this.draggingFolderId.set(null);
    this.vttStore.draggingRosterPayload.set(null);
    event.dataTransfer?.setData('text/plain', mapId);
  }

  onRosterActorDragStart(event: DragEvent, actor: VttRosterActorModel): void {
    if (!this.vttStore.canDeployRosterActor(actor) && !this.vttStore.isGm()) {
      return;
    }
    event.stopPropagation();
    this.draggingRosterActorId.set(actor.id);
    this.draggingMapId.set(null);
    this.draggingFolderId.set(null);

    const visuals = this.vttStore.resolveRosterActorVisuals(actor);
    const payload: VttRosterDragPayload = {
      kind: 'roster-actor',
      actorId: actor.id,
      characterId: actor.character_id ?? undefined,
      name: actor.name,
      icon: actor.icon,
      color: actor.color,
      faction: actor.faction,
      isUnique: actor.is_unique || Boolean(actor.character_id),
      portraitUrl: visuals.portraitUrl,
      tokenImageUrl: visuals.tokenImageUrl,
      tokenAppearance: visuals.tokenAppearance,
    };
    this.vttStore.draggingRosterPayload.set(payload);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
      const serialized = JSON.stringify(payload);
      event.dataTransfer.setData('application/x-mot-roster', serialized);
      event.dataTransfer.setData('text/plain', serialized);
    }
  }

  onCharacterDragStart(event: DragEvent, character: CharacterModel): void {
    event.stopPropagation();
    this.draggingRosterActorId.set(null);
    this.draggingMapId.set(null);
    this.draggingFolderId.set(null);

    const payload: VttRosterDragPayload = {
      kind: 'character',
      characterId: character.id,
      name: character.name,
      icon: 'greatsword',
      color: '#38B29A',
      faction: 'ally',
      isUnique: true,
      portraitUrl: resolveEntityPortraitUrl(character),
      tokenImageUrl: resolveEntityTokenImageUrl(character),
      tokenAppearance: resolveEntityTokenAppearance(character),
    };
    this.vttStore.draggingRosterPayload.set(payload);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
      const serialized = JSON.stringify(payload);
      event.dataTransfer.setData('application/x-mot-roster', serialized);
      event.dataTransfer.setData('text/plain', serialized);
    }
  }

  onFolderDragStart(event: DragEvent, folderId: string): void {
    if (!this.vttStore.isGm()) return;
    event.stopPropagation();
    this.draggingFolderId.set(folderId);
    this.draggingMapId.set(null);
    this.draggingRosterActorId.set(null);
    this.vttStore.draggingRosterPayload.set(null);
    event.dataTransfer?.setData('text/plain', folderId);
  }

  onDirectoryDragEnd(): void {
    this.draggingMapId.set(null);
    this.draggingRosterActorId.set(null);
    this.draggingFolderId.set(null);
    this.dragOverTarget.set(null);
    this.vttStore.draggingRosterPayload.set(null);
    this.vttStore.draggingCompendiumPayload.set(null);
  }

  canAcceptDropOnFolder(targetFolderId: string): boolean {
    if (!this.vttStore.isGm()) return false;
    const targetFolder = this.vttStore
      .folders()
      .find((f) => f.id === targetFolderId);
    if (!targetFolder) return false;

    if (targetFolder.scope === 'maps') {
      if (this.draggingMapId()) return true;
      const fId = this.draggingFolderId();
      if (fId) {
        const draggedFolder = this.vttStore
          .folders()
          .find((f) => f.id === fId);
        if (draggedFolder?.scope !== 'maps') return false;
        return canNestFolderInside(
          fId,
          targetFolderId,
          this.vttStore.folders(),
          'maps'
        );
      }
      return false;
    }

    if (targetFolder.scope === 'characters') {
      if (this.draggingRosterActorId()) return true;
      const fId = this.draggingFolderId();
      if (fId) {
        const draggedFolder = this.vttStore
          .folders()
          .find((f) => f.id === fId);
        if (draggedFolder?.scope !== 'characters') return false;
        return canNestFolderInside(
          fId,
          targetFolderId,
          this.vttStore.folders(),
          'characters'
        );
      }
      return false;
    }

    return false;
  }

  onFolderDragOver(event: DragEvent, targetFolderId: string): void {
    if (!this.canAcceptDropOnFolder(targetFolderId)) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragOverTarget.set(`folder:${targetFolderId}`);
  }

  async onFolderDrop(event: DragEvent, targetFolderId: string): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const targetFolder = this.vttStore
      .folders()
      .find((f) => f.id === targetFolderId);
    const mapId = this.draggingMapId();
    const actorId = this.draggingRosterActorId();
    const folderId = this.draggingFolderId();
    this.onDirectoryDragEnd();

    if (!targetFolder) return;

    if (mapId && targetFolder.scope === 'maps') {
      this.expandFolder(targetFolderId);
      await this.vttStore.moveSceneToFolder(mapId, targetFolderId);
    } else if (actorId && targetFolder.scope === 'characters') {
      this.expandFolder(targetFolderId);
      await this.vttStore.moveRosterActorToFolder(actorId, targetFolderId);
    } else if (folderId) {
      const draggedFolder = this.vttStore
        .folders()
        .find((f) => f.id === folderId);
      if (draggedFolder?.scope === targetFolder.scope) {
        this.expandFolder(targetFolderId);
        await this.vttStore.updateDirectoryFolder(folderId, {
          parent_folder_id: targetFolderId,
        });
      }
    }
  }

  onRootDragOver(event: DragEvent): void {
    const fId = this.draggingFolderId();
    const isMapsFolder = Boolean(
      fId &&
        this.vttStore.folders().find((f) => f.id === fId)?.scope === 'maps'
    );
    if (!this.draggingMapId() && !isMapsFolder) return;
    event.preventDefault();
    this.dragOverTarget.set('root');
  }

  async onRootDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const mapId = this.draggingMapId();
    const folderId = this.draggingFolderId();
    this.onDirectoryDragEnd();

    if (mapId) {
      await this.vttStore.moveSceneToFolder(mapId, null);
    } else if (folderId) {
      const draggedFolder = this.vttStore
        .folders()
        .find((f) => f.id === folderId);
      if (draggedFolder?.scope === 'maps') {
        await this.vttStore.updateDirectoryFolder(folderId, {
          parent_folder_id: null,
        });
      }
    }
  }

  onRosterRootDragOver(event: DragEvent): void {
    if (!this.vttStore.isGm()) return;
    const fId = this.draggingFolderId();
    const isRosterFolder = Boolean(
      fId &&
        this.vttStore.folders().find((f) => f.id === fId)?.scope ===
          'characters'
    );
    if (!this.draggingRosterActorId() && !isRosterFolder) return;
    event.preventDefault();
    this.dragOverTarget.set('roster-root');
  }

  async onRosterRootDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    if (!this.vttStore.isGm()) return;
    const actorId = this.draggingRosterActorId();
    const folderId = this.draggingFolderId();
    this.onDirectoryDragEnd();

    if (actorId) {
      await this.vttStore.moveRosterActorToFolder(actorId, null);
    } else if (folderId) {
      const draggedFolder = this.vttStore
        .folders()
        .find((f) => f.id === folderId);
      if (draggedFolder?.scope === 'characters') {
        await this.vttStore.updateDirectoryFolder(folderId, {
          parent_folder_id: null,
        });
      }
    }
  }

  openMapContextMenu(event: MouseEvent, mapId: string): void {
    if (!this.vttStore.isGm()) return;
    event.preventDefault();
    event.stopPropagation();
    const screenX = Math.max(8, Math.min(window.innerWidth - 220, event.clientX));
    const screenY = Math.max(8, Math.min(window.innerHeight - 260, event.clientY));
    this.directoryContextMenu.set({
      kind: 'map',
      targetId: mapId,
      screenX,
      screenY,
    });
  }

  openFolderContextMenu(event: MouseEvent, folderId: string): void {
    if (!this.vttStore.isGm()) return;
    event.preventDefault();
    event.stopPropagation();
    const screenX = Math.max(8, Math.min(window.innerWidth - 220, event.clientX));
    const screenY = Math.max(8, Math.min(window.innerHeight - 240, event.clientY));
    this.directoryContextMenu.set({
      kind: 'folder',
      targetId: folderId,
      screenX,
      screenY,
    });
  }

  openRosterActorContextMenu(event: MouseEvent, actorId: string): void {
    const actor = this.vttStore.rosterActors().find((a) => a.id === actorId);
    if (
      !actor ||
      (!this.vttStore.canManageRosterActor(actor) &&
        !this.vttStore.canDeployRosterActor(actor))
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const screenX = Math.max(8, Math.min(window.innerWidth - 236, event.clientX));
    const screenY = Math.max(8, Math.min(window.innerHeight - 380, event.clientY));
    this.directoryContextMenu.set({
      kind: 'roster-actor',
      targetId: actorId,
      screenX,
      screenY,
    });
  }

  closeDirectoryContextMenu(): void {
    this.directoryContextMenu.set(null);
  }

  editMapFromMenu(
    sceneId: string,
    initialTab: EditSceneModalTab = 'general'
  ): void {
    this.closeDirectoryContextMenu();
    this.openEditMapModal(sceneId, initialTab);
  }

  viewMapFromMenu(sceneId: string): void {
    this.closeDirectoryContextMenu();
    this.viewMap(sceneId);
  }

  duplicateMapFromMenu(sceneId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.duplicateScene(sceneId);
  }

  moveMapToRootFromMenu(sceneId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.moveSceneToFolder(sceneId, null);
  }

  deleteMapFromMenu(sceneId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.deleteSceneById(sceneId);
  }

  createMapInFolderFromMenu(folderId: string): void {
    this.closeDirectoryContextMenu();
    this.expandFolder(folderId);
    this.openCreateMapModal(folderId);
  }

  createRosterActorInFolderFromMenu(folderId: string): void {
    this.closeDirectoryContextMenu();
    this.expandFolder(folderId);
    this.openCreateRosterActorModal(folderId);
  }

  importRosterInFolderFromMenu(folderId: string): void {
    this.closeDirectoryContextMenu();
    this.expandFolder(folderId);
    this.openRosterImportModal(folderId);
  }

  createSubfolderFromMenu(parentFolderId: string): void {
    this.closeDirectoryContextMenu();
    const parentFolder = this.vttStore
      .folders()
      .find((f) => f.id === parentFolderId);
    this.expandFolder(parentFolderId);
    this.openCreateFolderModal(parentFolder?.scope ?? 'maps', parentFolderId);
  }

  editFolderFromMenu(folderId: string): void {
    this.closeDirectoryContextMenu();
    this.openEditFolderModal(folderId);
  }

  moveFolderToRootFromMenu(folderId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.updateDirectoryFolder(folderId, {
      parent_folder_id: null,
    });
  }

  deleteFolderFromMenu(folderId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.deleteDirectoryFolder(folderId);
  }

  editRosterActorFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    this.vttStore.openActorSheet(actorId);
  }

  editRosterActorTokenFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    this.vttStore.openTokenizerForActor(actorId);
  }

  assignRosterActorFromMenu(actorId: string, userId: string | null): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.assignRosterActorToPlayer(actorId, userId);
  }

  duplicateRosterActorFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.duplicateRosterActor(actorId);
  }

  saveRosterActorToCollectionsFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.saveRosterActorToCollections(actorId);
  }

  moveRosterActorToRootFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.moveRosterActorToFolder(actorId, null);
  }

  deleteRosterActorFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.deleteRosterActor(actorId);
  }

  getDeployedTokensForRosterActor(actor: VttRosterActorModel): VttTokenModel[] {
    return this.vttStore.sceneTokens().filter(
      (t) =>
        (actor.character_id && t.character_id === actor.character_id) ||
        t.npc_stats?.__roster_actor_id === actor.id
    );
  }

  openCreateRosterActorModal(
    folderId: string | null = null,
    defaultKind?: VttActorKind
  ): void {
    if (!this.vttStore.isGm()) return;
    this.closeDirectoryContextMenu();
    const kind: VttActorKind = defaultKind ?? 'character';
    this.rosterActorModal.set({
      folder_id: folderId,
      actor_kind: kind,
      name: '',
      saveToCollections: false,
    });
  }

  openEditRosterActorModal(actorId: string): void {
    this.closeDirectoryContextMenu();
    this.vttStore.openActorSheet(actorId);
  }

  setRosterActorModalKind(kind: VttActorKind): void {
    const cur = this.rosterActorModal();
    if (!cur || !this.vttStore.isGm()) return;
    this.rosterActorModal.set({
      ...cur,
      actor_kind: kind,
    });
  }

  updateRosterActorModalField<K extends keyof RosterActorModalState>(
    key: K,
    value: RosterActorModalState[K]
  ): void {
    const cur = this.rosterActorModal();
    if (!cur) return;
    this.rosterActorModal.set({ ...cur, [key]: value });
  }

  async submitRosterActorModal(): Promise<void> {
    const modal = this.rosterActorModal();
    if (!modal || !this.vttStore.isGm()) return;
    this.rosterActorModal.set(null);

    if (modal.folder_id) {
      this.expandFolder(modal.folder_id);
    }

    await this.vttStore.createVttActorQuick({
      name: modal.name,
      actor_kind: modal.actor_kind,
      folder_id: modal.folder_id || null,
      saveToCollections: Boolean(modal.saveToCollections),
    });
  }

  openRosterImportModal(folderId: string | null = null): void {
    if (!this.vttStore.isGm()) return;
    this.closeDirectoryContextMenu();
    this.rosterImportFolderId.set(folderId);
    this.rosterImportSearch.set('');
    this.rosterImportUrlInput.set('');
    this.rosterImportTab.set(
      this.collectionsStore.actors().length > 0
        ? 'collections'
        : 'my-characters'
    );
    this.rosterImportModalOpen.set(true);
    void this.characterStore.ensureUserCharactersLoaded();
    void this.collectionsStore.loadCollections();
  }

  closeRosterImportModal(): void {
    this.rosterImportModalOpen.set(false);
  }

  isCharacterInRoster(characterId: string): boolean {
    return this.vttStore
      .rosterActors()
      .some((a) => resolveRosterActorSourceCharacterId(a) === characterId);
  }

  canReimportRosterActor(
    actor: VttRosterActorModel | null | undefined
  ): boolean {
    return Boolean(
      actor &&
        hasRosterActorExternalSource(actor) &&
        this.vttStore.canManageRosterActor(actor)
    );
  }

  reimportRosterActorFromMenu(actorId: string): void {
    this.closeDirectoryContextMenu();
    void this.vttStore.reimportRosterActorFromSource(actorId);
  }

  async reimportCharacterIntoRoster(characterId: string): Promise<void> {
    const existing = this.vttStore
      .rosterActors()
      .find((a) => resolveRosterActorSourceCharacterId(a) === characterId);
    if (!existing) return;
    await this.vttStore.reimportRosterActorFromSource(existing.id);
  }

  async reimportCollectionActorIntoRoster(
    collectionActorId: string
  ): Promise<void> {
    const matches = this.vttStore
      .rosterActors()
      .filter((a) => a.collection_actor_id === collectionActorId);
    for (const actor of matches) {
      await this.vttStore.reimportRosterActorFromSource(actor.id);
    }
  }

  async importAndOpenCharacterInRoster(
    character: CharacterModel
  ): Promise<void> {
    const actor = await this.vttStore.importCharacterToRoster(character, null);
    if (actor) {
      this.vttStore.openActorSheet(actor.id);
    }
  }

  async submitRosterImportUrl(): Promise<void> {
    const raw = this.rosterImportUrlInput().trim();
    if (!raw || this.isImportingCharacterUrl()) return;
    const folderId = this.vttStore.isGm() ? this.rosterImportFolderId() : null;
    if (folderId) {
      this.expandFolder(folderId);
    }
    this.isImportingCharacterUrl.set(true);
    try {
      const actor = await this.vttStore.importCharacterByUrlOrId(raw, folderId);
      if (actor) {
        this.rosterImportUrlInput.set('');
        this.vttStore.openActorSheet(actor.id);
      }
    } finally {
      this.isImportingCharacterUrl.set(false);
    }
  }

  isCollectionActorInRoster(collectionActorId: string): boolean {
    return this.vttStore
      .rosterActors()
      .some((a) => a.collection_actor_id === collectionActorId);
  }

  async importCharacterIntoRoster(character: CharacterModel): Promise<void> {
    const folderId = this.vttStore.isGm() ? this.rosterImportFolderId() : null;
    if (folderId) {
      this.expandFolder(folderId);
    }
    await this.vttStore.importCharacterToRoster(character, folderId);
  }

  async importCollectionActorIntoRoster(
    colActor: CollectionActorModel
  ): Promise<void> {
    const folderId = this.vttStore.isGm() ? this.rosterImportFolderId() : null;
    if (folderId) {
      this.expandFolder(folderId);
    }
    await this.vttStore.importCollectionActorToRoster(colActor, folderId);
  }

  async importPresetIntoRoster(preset: VttNpcPreset): Promise<void> {
    const folderId = this.vttStore.isGm() ? this.rosterImportFolderId() : null;
    if (folderId) {
      this.expandFolder(folderId);
    }
    await this.vttStore.importNpcPresetToRoster(preset, folderId);
  }

  openCreateMapModal(folderId: string | null = null): void {
    if (!this.vttStore.isGm()) return;
    this.closeDirectoryContextMenu();
    this.createMapModal.set({
      folder_id: folderId,
      name: '',
      activateForParty: this.vttStore.scenes().length === 0,
    });
  }

  updateCreateMapModalField<K extends keyof CreateBlankMapModalState>(
    key: K,
    value: CreateBlankMapModalState[K]
  ): void {
    const cur = this.createMapModal();
    if (!cur) return;
    this.createMapModal.set({ ...cur, [key]: value });
  }

  async submitCreateBlankMap(): Promise<void> {
    const cm = this.createMapModal();
    if (!cm) return;
    this.createMapModal.set(null);
    if (cm.folder_id) {
      this.expandFolder(cm.folder_id);
    }
    await this.vttStore.createBlankMap({
      name: cm.name.trim() || 'Untitled Scene',
      folder_id: cm.folder_id,
      activateForParty: cm.activateForParty,
    });
  }

  openCreateFolderModal(
    scope: VttDirectoryScope = 'maps',
    parentFolderId: string | null = null
  ): void {
    if (!this.vttStore.isGm()) return;
    this.closeDirectoryContextMenu();
    this.folderModal.set({
      mode: 'create',
      scope,
      folderId: null,
      name: '',
      parent_folder_id: parentFolderId,
      color: FOLDER_COLOR_SWATCHES[0],
    });
  }

  openEditFolderModal(folderId: string): void {
    if (!this.vttStore.isGm()) return;
    const target = this.vttStore.folders().find((f) => f.id === folderId);
    if (!target) return;
    this.closeDirectoryContextMenu();
    this.folderModal.set({
      mode: 'edit',
      scope: target.scope,
      folderId: target.id,
      name: target.name,
      parent_folder_id: target.parent_folder_id,
      color: target.color || FOLDER_COLOR_SWATCHES[0],
    });
  }

  updateFolderModalField<K extends keyof DirectoryFolderModalState>(
    key: K,
    value: DirectoryFolderModalState[K]
  ): void {
    const cur = this.folderModal();
    if (!cur) return;
    this.folderModal.set({ ...cur, [key]: value });
  }

  async submitFolderModal(): Promise<void> {
    const fm = this.folderModal();
    if (!fm) return;
    this.folderModal.set(null);

    if (fm.mode === 'create') {
      if (fm.parent_folder_id) {
        this.expandFolder(fm.parent_folder_id);
      }
      await this.vttStore.createDirectoryFolder({
        scope: fm.scope,
        name: fm.name.trim() || 'New Folder',
        parent_folder_id: fm.parent_folder_id,
        color: fm.color,
      });
    } else if (fm.folderId) {
      if (fm.parent_folder_id) {
        this.expandFolder(fm.parent_folder_id);
      }
      await this.vttStore.updateDirectoryFolder(fm.folderId, {
        name: fm.name.trim() || 'Folder',
        parent_folder_id: fm.parent_folder_id,
        color: fm.color,
      });
    }
  }

  openEditMapModal(
    sceneId: string,
    initialTab: EditSceneModalTab = 'general'
  ): void {
    if (!this.vttStore.isGm()) return;
    const sc = this.vttStore.scenes().find((s) => s.id === sceneId);
    if (!sc) return;
    this.closeDirectoryContextMenu();
    this.editMapTab.set(initialTab);
    void this.userAssetsStore.ensureLoaded();

    const activeNat =
      this.vttStore.activeScene()?.id === sc.id
        ? this.canvasComp()?.mapNaturalSize() ??
          this.vttStore.activeSceneNaturalSize() ??
          null
        : null;

    const resolvedSceneW =
      sc.scene_width && sc.scene_width > 0
        ? sc.scene_width
        : activeNat?.width ?? DEFAULT_VTT_SCENE_WIDTH_PX;
    const resolvedSceneH =
      sc.scene_height && sc.scene_height > 0
        ? sc.scene_height
        : activeNat?.height ?? DEFAULT_VTT_SCENE_HEIGHT_PX;

    this.editingMapDraft.set({
      sceneId: sc.id,
      name: sc.name,
      folder_id: sc.folder_id ?? null,
      map_image_url: sc.map_image_url ?? '',
      background_color: sc.background_color || DEFAULT_VTT_BG_COLOR,
      grid_mode: sc.grid_mode === 'gridless' ? 'gridless' : 'square',
      scene_width: resolvedSceneW,
      scene_height: resolvedSceneH,
      padding: sc.padding ?? DEFAULT_VTT_SCENE_PADDING,
      grid_size_px: sc.grid_size_px ?? DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: sc.grid_offset_x ?? 0,
      grid_offset_y: sc.grid_offset_y ?? 0,
      grid_opacity: sc.grid_opacity ?? DEFAULT_VTT_GRID_OPACITY,
      token_vision: sc.token_vision ?? true,
      fog_enabled: sc.fog_enabled,
      global_illumination: sc.global_illumination,
      darkness_level: sc.darkness_level ?? DEFAULT_VTT_DARKNESS_LEVEL,
      isUploadingImage: false,
      imageNaturalWidth: activeNat?.width ?? null,
      imageNaturalHeight: activeNat?.height ?? null,
    });

    if (sc.map_image_url && !activeNat) {
      this.probeDraftImageDimensions(
        sc.map_image_url,
        !(sc.scene_width && sc.scene_height)
      );
    }
  }

  updateEditMapField<K extends keyof EditingMapDraft>(
    key: K,
    value: EditingMapDraft[K]
  ): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({ ...cur, [key]: value });
  }

  onEditMapUrlChange(url: string): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    const trimmed = url.trim();
    this.editingMapDraft.set({
      ...cur,
      map_image_url: url,
      imageNaturalWidth: trimmed ? cur.imageNaturalWidth : null,
      imageNaturalHeight: trimmed ? cur.imageNaturalHeight : null,
    });
    if (trimmed) {
      this.probeDraftImageDimensions(trimmed, true);
    }
  }

  private probeDraftImageDimensions(
    url: string,
    adoptSceneDimensions = false
  ): void {
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cur = this.editingMapDraft();
      if (cur && cur.map_image_url.trim() === url.trim()) {
        const natW = img.naturalWidth || null;
        const natH = img.naturalHeight || null;
        this.editingMapDraft.set({
          ...cur,
          imageNaturalWidth: natW,
          imageNaturalHeight: natH,
          scene_width:
            adoptSceneDimensions && natW ? natW : cur.scene_width,
          scene_height:
            adoptSceneDimensions && natH ? natH : cur.scene_height,
        });
      }
    };
    img.src = url;
  }

  async onEditMapFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const cur = this.editingMapDraft();
    if (!file || !cur) return;

    this.editingMapDraft.set({ ...cur, isUploadingImage: true });
    const uploadedUrl = await this.vttStore.uploadMapFile(file);
    const afterUpload = this.editingMapDraft();
    if (!afterUpload) return;

    if (!uploadedUrl) {
      this.editingMapDraft.set({ ...afterUpload, isUploadingImage: false });
      return;
    }

    const matched = this.userAssetsStore.findAssetByUrl(uploadedUrl);
    const knownW = matched?.width && matched.width > 0 ? matched.width : null;
    const knownH =
      matched?.height && matched.height > 0 ? matched.height : null;

    this.editingMapDraft.set({
      ...afterUpload,
      map_image_url: uploadedUrl,
      isUploadingImage: false,
      imageNaturalWidth: knownW ?? afterUpload.imageNaturalWidth,
      imageNaturalHeight: knownH ?? afterUpload.imageNaturalHeight,
      scene_width: knownW ?? afterUpload.scene_width,
      scene_height: knownH ?? afterUpload.scene_height,
    });
    if (!knownW || !knownH) {
      this.probeDraftImageDimensions(uploadedUrl, true);
    }
  }

  openSceneAssetPicker(
    initialFolderId?: string | null,
    openRoutingOnInit = false
  ): void {
    const cur = this.editingMapDraft();
    this.assetBrowserModal.set({
      mode: 'picker',
      purpose: 'maps',
      initialFolderId,
      currentUrl: cur?.map_image_url ?? null,
      openRoutingOnInit,
    });
  }

  openAssetLibraryManager(openRoutingOnInit = false): void {
    this.inGameMenuOpen.set(false);
    this.closeDirectoryContextMenu();
    this.assetBrowserModal.set({
      mode: 'manage',
      purpose: 'maps',
      initialFolderId: undefined,
      currentUrl: null,
      openRoutingOnInit,
    });
  }

  closeAssetBrowserModal(): void {
    this.assetBrowserModal.set(null);
  }

  onAssetBrowserSelected(asset: UserAssetModel): void {
    const cur = this.editingMapDraft();
    if (!cur) return;

    const knownW = asset.width && asset.width > 0 ? asset.width : null;
    const knownH = asset.height && asset.height > 0 ? asset.height : null;

    this.editingMapDraft.set({
      ...cur,
      map_image_url: asset.public_url,
      imageNaturalWidth: knownW,
      imageNaturalHeight: knownH,
      scene_width: knownW ?? cur.scene_width,
      scene_height: knownH ?? cur.scene_height,
    });

    if (!knownW || !knownH) {
      this.probeDraftImageDimensions(asset.public_url, true);
    }
  }

  async saveCurrentSceneImageToLibrary(): Promise<void> {
    const cur = this.editingMapDraft();
    if (!cur || !cur.map_image_url.trim()) return;
    await this.userAssetsStore.registerAssetFromUrl(cur.map_image_url, {
      name: cur.name.trim() || undefined,
      purpose: 'maps',
      width: cur.imageNaturalWidth,
      height: cur.imageNaturalHeight,
    });
  }

  clearEditMapBackground(): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({
      ...cur,
      map_image_url: '',
      imageNaturalWidth: null,
      imageNaturalHeight: null,
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
    });
  }

  resetEditMapDefaultGrid(): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({
      ...cur,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: 0,
      grid_offset_y: 0,
    });
  }

  resetEditMapPadding(): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({
      ...cur,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });
  }

  resetEditMapGridOpacity(): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({
      ...cur,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
    });
  }

  resetEditMapDarknessLevel(): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({
      ...cur,
      darkness_level: DEFAULT_VTT_DARKNESS_LEVEL,
    });
  }

  applyEditMapLightingPreset(preset: VttSceneLightingPreset): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    this.editingMapDraft.set({
      ...cur,
      global_illumination: preset.global_illumination,
      darkness_level: preset.darkness_level,
    });
  }

  isEditMapLightingPresetActive(
    draft: EditingMapDraft,
    preset: VttSceneLightingPreset
  ): boolean {
    return (
      findMatchingSceneLightingPreset(
        draft.global_illumination,
        draft.darkness_level
      ) === preset.id
    );
  }

  getEditMapAmbientPercent(draft: EditingMapDraft): number {
    if (draft.global_illumination) return 100;
    return computeEffectiveActorSightFeet(
      DEFAULT_VTT_DIM_VISION_FEET,
      DEFAULT_VTT_DARKVISION_FEET,
      draft.darkness_level
    ).ambientPercent;
  }

  getEditMapStandardSightPreview(draft: EditingMapDraft): string {
    if (draft.global_illumination) {
      return 'Unlimited unobstructed Line of Sight (Bright Daylight)';
    }
    const sight = computeEffectiveActorSightFeet(
      DEFAULT_VTT_DIM_VISION_FEET,
      DEFAULT_VTT_DARKVISION_FEET,
      draft.darkness_level
    );
    if (sight.ambientPercent === 0) {
      return `${sight.effectiveSightFeet} ft (Pitch Black — relies on ${DEFAULT_VTT_DARKVISION_FEET} ft Darkvision + Light Sources)`;
    }
    if (sight.effectiveSightFeet <= DEFAULT_VTT_DARKVISION_FEET) {
      return `${sight.effectiveSightFeet} ft (${sight.ambientPercent}% Ambient · floored by ${DEFAULT_VTT_DARKVISION_FEET} ft Darkvision)`;
    }
    return `${sight.effectiveSightFeet} ft (${sight.ambientPercent}% of ${DEFAULT_VTT_DIM_VISION_FEET} ft Dim Vision · ${DEFAULT_VTT_DARKVISION_FEET} ft Darkvision floor)`;
  }

  getTokenEffectiveSightLabel(tok: VttTokenModel): string {
    const sc = this.vttStore.activeScene();
    const dimFeet = Math.max(0, tok.vision_feet ?? DEFAULT_VTT_DIM_VISION_FEET);
    const darkFeet = resolveActorDarkvisionFeet(
      tok.darkvision_feet,
      tok.npc_stats
    );
    if (!sc || sc.global_illumination) {
      return `Daylight LoS (Dim ${dimFeet}ft · Dark ${darkFeet}ft)`;
    }
    const carriedFeet = Math.max(
      0,
      tok.light_dim_feet ?? 0,
      tok.light_bright_feet ?? 0
    );
    const sight = computeEffectiveActorSightFeet(
      dimFeet,
      darkFeet,
      sc.darkness_level
    );
    const totalSight = Math.max(sight.effectiveSightFeet, carriedFeet);
    return `${totalSight}ft (Dim ${dimFeet}ft · Dark ${darkFeet}ft)`;
  }

  matchEditMapToImage(): void {
    const cur = this.editingMapDraft();
    if (!cur) return;
    const natW =
      cur.imageNaturalWidth ??
      (this.vttStore.activeScene()?.id === cur.sceneId
        ? this.canvasComp()?.mapNaturalSize()?.width ?? null
        : null);
    const natH =
      cur.imageNaturalHeight ??
      (this.vttStore.activeScene()?.id === cur.sceneId
        ? this.canvasComp()?.mapNaturalSize()?.height ?? null
        : null);
    if (!natW || !natH) return;

    this.editingMapDraft.set({
      ...cur,
      scene_width: natW,
      scene_height: natH,
      grid_offset_x: 0,
      grid_offset_y: 0,
    });
  }

  async saveEditMapModal(): Promise<void> {
    const draft = this.editingMapDraft();
    if (!draft || !this.vttStore.isGm()) return;
    this.editingMapDraft.set(null);

    if (draft.folder_id) {
      this.expandFolder(draft.folder_id);
    }

    const nextSceneWidth = Math.max(
      200,
      Math.min(
        20000,
        Math.round(
          Number(draft.scene_width) ||
            draft.imageNaturalWidth ||
            DEFAULT_VTT_SCENE_WIDTH_PX
        )
      )
    );
    const nextSceneHeight = Math.max(
      200,
      Math.min(
        20000,
        Math.round(
          Number(draft.scene_height) ||
            draft.imageNaturalHeight ||
            DEFAULT_VTT_SCENE_HEIGHT_PX
        )
      )
    );
    const nextSizePx = Math.max(
      20,
      Math.min(
        400,
        Math.round(Number(draft.grid_size_px) || DEFAULT_VTT_GRID_SIZE_PX)
      )
    );
    const rawPad = Number(draft.padding);
    const nextPadding = Number.isFinite(rawPad)
      ? Math.max(0, Math.min(1, Number(rawPad.toFixed(2))))
      : DEFAULT_VTT_SCENE_PADDING;
    const nextOffX = Math.round(Number(draft.grid_offset_x) || 0);
    const nextOffY = Math.round(Number(draft.grid_offset_y) || 0);
    const rawOpacity = Number(draft.grid_opacity);
    const nextOpacity = Number.isFinite(rawOpacity)
      ? Math.max(0, Math.min(0.95, Number(rawOpacity.toFixed(2))))
      : DEFAULT_VTT_GRID_OPACITY;
    const rawDarkness = Number(draft.darkness_level);
    const nextDarkness = Number.isFinite(rawDarkness)
      ? Math.max(0, Math.min(1, Number(rawDarkness.toFixed(2))))
      : DEFAULT_VTT_DARKNESS_LEVEL;

    const nextLayout = computeSceneCanvasLayout({
      sceneWidthPx: nextSceneWidth,
      sceneHeightPx: nextSceneHeight,
      gridSizePx: nextSizePx,
      padding: nextPadding,
      offsetX: nextOffX,
      offsetY: nextOffY,
    });

    await this.vttStore.patchScene(draft.sceneId, {
      name: draft.name.trim() || 'Untitled Scene',
      folder_id: draft.folder_id || null,
      map_image_url: draft.map_image_url.trim() || null,
      background_color: draft.background_color || DEFAULT_VTT_BG_COLOR,
      grid_mode: draft.grid_mode,
      scene_width: nextSceneWidth,
      scene_height: nextSceneHeight,
      padding: nextPadding,
      grid_width: nextLayout.gridCols,
      grid_height: nextLayout.gridRows,
      grid_size_px: nextSizePx,
      grid_offset_x: nextOffX,
      grid_offset_y: nextOffY,
      grid_opacity: nextOpacity,
      token_vision: draft.token_vision,
      fog_enabled: draft.fog_enabled,
      global_illumination: draft.global_illumination,
      darkness_level: nextDarkness,
    });

    if (this.vttStore.activeScene()?.id === draft.sceneId) {
      queueMicrotask(() => {
        this.vttStore.syncExploredFogFromObservers();
        this.canvasComp()?.fitMapToViewport();
      });
    }
  }

  async deleteMapFromEditModal(): Promise<void> {
    const draft = this.editingMapDraft();
    if (!draft || !this.vttStore.isGm()) return;
    this.editingMapDraft.set(null);
    await this.vttStore.deleteSceneById(draft.sceneId);
  }

  toggleSceneBoolean(
    field: 'token_vision' | 'fog_enabled' | 'global_illumination'
  ): void {
    void this.vttStore.toggleSceneBooleanField(field);
  }

  isCharacterDeployed(characterId: string): VttTokenModel | undefined {
    return this.vttStore.sceneTokens().find((t) => {
      if (t.character_id === characterId) return true;
      if (t.npc_stats?.__source_character_id === characterId) return true;
      const linked = this.vttStore.resolveRosterActorForToken(t);
      return resolveRosterActorSourceCharacterId(linked) === characterId;
    });
  }

  async submitCustomNpc(): Promise<void> {
    const preset: VttNpcPreset = {
      id: `custom-${Date.now()}`,
      name: this.customNpcName.trim() || 'Custom Combatant',
      faction: this.customNpcFaction,
      icon: this.customNpcFaction === 'ally' ? 'bastion-shield' : 'battleaxe',
      color:
        this.customNpcFaction === 'ally'
          ? '#38B29A'
          : this.customNpcFaction === 'neutral'
            ? '#F59E0B'
            : '#EF4444',
      max_hp: Math.max(1, Number(this.customNpcHp) || 6),
      max_sp: Math.max(0, Number(this.customNpcSp) || 4),
      max_ap: 4,
      armor_dr: Math.max(0, Number(this.customNpcDr) || 0),
      shield_block: Math.max(0, Number(this.customNpcBlock) || 0),
      move_feet: Math.max(5, Number(this.customNpcMoveFeet) || 20),
      vision_feet: DEFAULT_VTT_DIM_VISION_FEET,
      darkvision_feet: DEFAULT_VTT_DARKVISION_FEET,
      npc_stats: {
        weapon_name: 'Signature Strike',
        attack_ap: 1,
        attack_mod: Number(this.customNpcAttackMod) || 3,
        flat_damage: Math.max(1, Number(this.customNpcDamage) || 4),
        reach_feet: Math.max(5, Number(this.customNpcReachFeet) || 5),
        combat_tag: this.customNpcTag,
        parry_mod: 2,
        dodge_mod: 2,
        can_dodge: true,
      },
    };
    await this.vttStore.spawnNpcPreset(preset, preset.name);
    this.showCustomNpcForm.set(false);
  }

  adjustTokenStat(
    tok: VttTokenModel,
    stat: 'current_hp' | 'current_sp' | 'current_ap',
    delta: number
  ): void {
    if (!this.vttStore.canControlToken(tok)) return;
    const maxVal =
      stat === 'current_hp'
        ? tok.max_hp
        : stat === 'current_sp'
          ? tok.max_sp
          : tok.max_ap;
    const prev = tok[stat];
    const next = Math.max(0, Math.min(maxVal, prev + delta));
    if (next === prev) return;
    const statLabel =
      stat === 'current_hp' ? 'HP' : stat === 'current_sp' ? 'SP' : 'AP';
    void this.vttStore
      .recordablePatchToken(
        tok.id,
        { [stat]: next },
        `Adjust ${tok.name} ${statLabel}`
      )
      .then(() => {
        if (stat === 'current_ap') {
          void this.vttStore.logManualApAdjustment(tok, prev, next);
        }
      });
  }

  onManualAttackInputChange(val: string | number | null): void {
    if (val === '' || val === null || val === undefined) {
      this.manualAttackTotalInput = null;
      this.vttStore.manualRollOverride.set(null);
      return;
    }
    const num = Number(val);
    if (!Number.isNaN(num)) {
      this.manualAttackTotalInput = num;
      this.vttStore.manualRollOverride.set(num);
    }
  }

  triggerArtFromDock(tok: VttTokenModel, art: ResolvedCombatArt): void {
    const stats = this.vttStore.selectedTokenDerived();
    if (!stats) return;
    const char = this.vttStore.selectedTokenCharacter();
    const cd = this.vttStore.getPerkCooldown(char, art.baseNode.id);
    if (cd > 0 || tok.current_ap < art.apCost || !art.meetsWeaponRequirement) {
      return;
    }
    this.vttStore.beginCombatArtTargetSelection(tok, art, stats);
  }

  chooseClashReaction(choice: VttDefenseChoice): void {
    void this.vttStore.declareClashReaction(choice, this.manualDefenseTotalInput);
    this.manualDefenseTotalInput = null;
  }

  rechooseClashReaction(): void {
    if (!this.vttStore.isGm()) return;
    const sc = this.vttStore.activeScene();
    const clash = this.vttStore.pendingClash();
    if (!sc || !clash) return;
    void this.vttStore.patchScene(sc.id, {
      pending_clash: {
        ...clash,
        attackRoll: null,
        selectedReaction: undefined,
        resolution: undefined,
      },
    });
  }

  confirmApplyClashOutcome(): void {
    if (!this.vttStore.isGm()) return;
    void this.vttStore.applyPendingClashOutcome({
      hitLanded: this.overrideHitLanded,
      spDamageToDefender: Math.max(0, Number(this.overrideSpDmg) || 0),
      hpDamageToDefender: Math.max(0, Number(this.overrideHpDmg) || 0),
      counterSpToAttacker: Math.max(0, Number(this.overrideCounterSp) || 0),
      defenderApSpent: Math.max(0, Number(this.overrideDefAp) || 0),
    });
  }

  incrementDieInPool(die: PolyhedralDieType): void {
    this.slashSuggestionsDismissed.set(false);
    this.chatInput.update((curr) =>
      applyDieClickToChatInput(curr, die, 1, this.chatCommandsRegistry)
    );
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  decrementDieInPool(event: MouseEvent, die: PolyhedralDieType): void {
    event.preventDefault();
    event.stopPropagation();
    this.slashSuggestionsDismissed.set(false);
    this.chatInput.update((curr) =>
      applyDieClickToChatInput(curr, die, -1, this.chatCommandsRegistry)
    );
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  clearDicePool(): void {
    this.chatInput.set('');
    this.slashSuggestionsDismissed.set(false);
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  setComposerRollMode(mode: VttQuickRollMode): void {
    const targetMode: VttQuickRollMode =
      mode !== 'normal' && this.activeRollMode() === mode ? 'normal' : mode;
    this.slashSuggestionsDismissed.set(false);
    this.chatInput.update((curr) =>
      applyRollModeToChatInput(curr, targetMode, this.chatCommandsRegistry)
    );
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  stepComposerModifier(delta: number): void {
    const next = Math.max(
      -999,
      Math.min(999, this.activeRollModifier() + Math.trunc(delta))
    );
    this.slashSuggestionsDismissed.set(false);
    this.chatInput.update((curr) =>
      applyModifierToChatInput(curr, next, this.chatCommandsRegistry)
    );
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  onComposerModifierInput(val: string | number | null): void {
    if (val === '-') {
      return;
    }
    if (val === '' || val === null || val === undefined) {
      this.slashSuggestionsDismissed.set(false);
      this.chatInput.update((curr) =>
        applyModifierToChatInput(curr, 0, this.chatCommandsRegistry)
      );
      queueMicrotask(() => this.resizeComposerTextarea());
      return;
    }
    const parsed = Number(val);
    if (!Number.isFinite(parsed)) {
      return;
    }
    this.slashSuggestionsDismissed.set(false);
    this.chatInput.update((curr) =>
      applyModifierToChatInput(
        curr,
        Math.trunc(parsed),
        this.chatCommandsRegistry
      )
    );
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  setGmSpeakerMode(mode: VttSpeakerMode): void {
    this.vttStore.setGmSpeakerMode(mode);
  }

  toggleOocComposer(): void {
    this.slashSuggestionsDismissed.set(false);
    const curr = this.chatInput();
    const resolved = resolveSlashCommand(curr, this.chatCommandsRegistry);
    let nextVal = '';
    if (resolved?.config.action === 'ooc') {
      nextVal = resolved.rest;
    } else {
      const oocTrigger = getPrimaryCommandTrigger(
        'ooc',
        this.chatCommandsRegistry
      );
      const body = resolved ? resolved.rest : curr.trimStart();
      nextVal = body ? `${oocTrigger} ${body}` : `${oocTrigger} `;
    }
    this.chatInput.set(nextVal);
    queueMicrotask(() => {
      const el = this.chatComposerEl()?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange?.(nextVal.length, nextVal.length);
      }
      this.resizeComposerTextarea();
    });
  }

  onChatInputChange(val: string): void {
    this.slashSuggestionsDismissed.set(false);
    this.chatInput.set(val ?? '');
    queueMicrotask(() => this.resizeComposerTextarea());
  }

  openSlashCommandsMenu(): void {
    this.slashSuggestionsDismissed.set(false);
    if (!this.chatInput().trim()) {
      this.chatInput.set('/');
    }
    queueMicrotask(() => {
      const el = this.chatComposerEl()?.nativeElement;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange?.(len, len);
      }
      this.resizeComposerTextarea();
    });
  }

  applySlashCommandSuggestion(cmd: VttChatCommandConfig): void {
    this.slashSuggestionsDismissed.set(false);
    const nextVal = cmd.usage ? `${cmd.primary} ` : cmd.primary;
    this.chatInput.set(nextVal);
    queueMicrotask(() => {
      const el = this.chatComposerEl()?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange?.(nextVal.length, nextVal.length);
      }
      this.resizeComposerTextarea();
    });
  }

  applyWhisperTargetSuggestion(target: VttWhisperTargetOption): void {
    this.slashSuggestionsDismissed.set(false);
    const resolved = resolveSlashCommand(
      this.chatInput(),
      this.chatCommandsRegistry
    );
    const trigger = resolved?.matchedTrigger || '/w';
    const nextVal = `${trigger} ${target.insertToken} `;
    this.chatInput.set(nextVal);
    queueMicrotask(() => {
      const el = this.chatComposerEl()?.nativeElement;
      if (el) {
        el.focus();
        el.setSelectionRange?.(nextVal.length, nextVal.length);
      }
      this.resizeComposerTextarea();
    });
  }

  onChatComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      const cmds = this.slashCommandSuggestions();
      if (cmds.length > 0) {
        event.preventDefault();
        this.applySlashCommandSuggestion(cmds[0]);
        return;
      }
      const targets = this.whisperTargetSuggestions();
      if (targets.length > 0) {
        event.preventDefault();
        this.applyWhisperTargetSuggestion(targets[0]);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendChatMessage();
    }
  }

  private resizeComposerTextarea(): void {
    const el = this.chatComposerEl()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
    const clamped = Math.min(84, Math.max(32, el.scrollHeight));
    el.style.height = `${clamped}px`;
  }

  formatCommandAliasesLabel(cmd: VttChatCommandConfig): string {
    return getAllCommandTriggers(cmd)
      .filter((a) => a !== cmd.primary.toLowerCase())
      .join(', ');
  }

  isWhisperLog(entry: VttLogEntry): boolean {
    return entry.payload?.['visibility'] === 'whisper';
  }

  isGmRollLog(entry: VttLogEntry): boolean {
    return entry.payload?.['visibility'] === 'gm_roll';
  }

  isEmoteLog(entry: VttLogEntry): boolean {
    return Boolean(entry.payload?.['emote']);
  }

  isOocLog(entry: VttLogEntry): boolean {
    return Boolean(entry.payload?.['ooc']);
  }

  isGmUserLog(entry: VttLogEntry): boolean {
    return entry.payload?.['speaker_mode'] === 'gm_user' && !this.isOocLog(entry);
  }

  getLogSpeakerColor(entry: VttLogEntry): string | null {
    const raw = entry.payload?.['speaker_color'];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }

  getLogPrivacyBadge(entry: VttLogEntry): string | null {
    const vis = entry.payload?.['visibility'];
    if (vis === 'whisper') {
      if (entry.sender_name === 'Command Reference') {
        return 'Only visible to you';
      }
      const myId = this.authStore.user()?.id;
      const recipLabel = String(entry.payload?.['recipient_label'] ?? 'Player');
      if (myId && entry.sender_id === myId) {
        return `Whisper → ${recipLabel}`;
      }
      return 'Private Whisper';
    }
    if (vis === 'gm_roll') {
      return 'GM Roll';
    }
    return null;
  }

  getLogRollChips(entry: VttLogEntry): RolledDieChip[] {
    if (entry.kind !== 'roll' && entry.kind !== 'clash') return [];
    return extractLogRollChips(entry.payload);
  }

  selectDicePreset(presetId: string): void {
    this.settingsStore.applyDicePreset(presetId);
  }

  resetDicePreferences(): void {
    this.settingsStore.updatePreferences({ enable3dDice: true });
    this.settingsStore.applyDicePreset('sunfire-copper');
    this.notifications.info(
      'Dice Appearance Reset',
      'Restored default Sunfire Copper 3D dice.'
    );
  }

  selectDiceMaterial(material: VttDiceMaterial): void {
    this.settingsStore.updateDiceAppearance({ material });
  }

  updateDiceBodyColor(hex: string): void {
    this.settingsStore.updateDiceAppearance({ bodyColor: hex });
  }

  updateDiceLabelColor(hex: string): void {
    this.settingsStore.updateDiceAppearance({ labelColor: hex });
  }

  test3dDiceRoll(): void {
    this.vttStore.previewTestDiceRoll();
  }

  getActiveDiceMaterialLabel(): string {
    const mat = this.settingsStore.preferences().diceAppearance.material;
    return (
      this.diceMaterialOptions.find((m) => m.id === mat)?.label ?? 'Custom'
    );
  }

  async sendChatMessage(): Promise<void> {
    const raw = this.chatInput().trim();
    if (!raw) return;
    const outcome = await this.vttStore.executeChatOrCommand(
      raw,
      this.chatCommandsRegistry
    );
    if (outcome.cleared) {
      this.chatInput.set('');
      this.slashSuggestionsDismissed.set(false);
      queueMicrotask(() => this.resizeComposerTextarea());
    }
  }

  deleteLogEntry(logId: string): void {
    void this.vttStore.deleteLogEntry(logId);
  }

  requestClearAllLogs(): void {
    this.confirmClearLogs.set(true);
  }

  cancelClearAllLogs(): void {
    this.confirmClearLogs.set(false);
  }

  getCreateMapModalSubtitle(): string {
    return `Creates a blank ${this.defaultSceneWidthPx}\u00D7${this.defaultSceneHeightPx} px scene with a ${this.defaultGridSizePx} px Square Grid (5 ft per tile) and ${this.defaultScenePadding} off-scene padding.`;
  }

  getSettingsModalTitle(mode: VttSettingsModalKind): string {
    if (mode === 'general') return 'General Settings';
    if (mode === 'dice') return '3D Dice & Appearance';
    if (mode === 'controls') return 'Controls & Hotkeys';
    return 'Invitation Links';
  }

  getSettingsModalSubtitle(mode: VttSettingsModalKind): string {
    if (mode === 'general') {
      return 'Configure interface theme, token travel speed, audio volume, and table rules.';
    }
    if (mode === 'dice') {
      return 'Customize 3D physics throws, surface textures, body colors, and number ink.';
    }
    if (mode === 'controls') {
      return 'Click any shortcut badge to press a new key or key combination.';
    }
    return 'Share this link or invite code so players can join the campaign.';
  }

  getSettingsModalWidthClass(mode: VttSettingsModalKind): string {
    if (mode === 'dice') return 'w-[min(94vw,576px)]';
    if (mode === 'invites') return 'w-[min(94vw,448px)]';
    return 'w-[min(94vw,512px)]';
  }

  getSettingsModalEstimatedWidth(mode: VttSettingsModalKind): number {
    if (mode === 'dice') return 576;
    if (mode === 'invites') return 448;
    return 512;
  }

  readonly multiSelectedTokens = computed<VttTokenModel[]>(() => {
    const list = this.vttStore.controllableSelectedTokens();
    return list.length > 1 ? list : [];
  });

  readonly hudSelectedTokens = computed<readonly VttTokenModel[]>(() => {
    const multi = this.multiSelectedTokens();
    if (multi.length > 1) return multi;
    const single = this.vttStore.selectedToken();
    if (single && (this.vttStore.isGm() || this.vttStore.canControlToken(single))) {
      return [single];
    }
    return [];
  });

  readonly multiSelectedAllHidden = computed<boolean>(() => {
    const list = this.multiSelectedTokens();
    return list.length > 0 && list.every((t) => t.is_hidden);
  });

  readonly multiSelectedAnyRotated = computed<boolean>(() =>
    this.multiSelectedTokens().some(
      (t) => normalizeTokenRotation(t.npc_stats?.__rotation) !== 0
    )
  );

  onSceneTokenRowClick(event: MouseEvent, tok: VttTokenModel): void {
    if (
      event.shiftKey &&
      (this.vttStore.isGm() || this.vttStore.canControlToken(tok))
    ) {
      if (this.vttStore.isTokenSelected(tok.id)) {
        this.vttStore.toggleTokenInSelection(tok.id);
      } else {
        const priorIds = this.vttStore
          .controllableSelectedTokens()
          .map((t) => t.id);
        this.vttStore.setSelectedTokens([...priorIds, tok.id]);
      }
      return;
    }
    this.vttStore.selectSingleToken(tok.id);
  }

  onSceneTokenRowDoubleClick(tok: VttTokenModel): void {
    if (this.vttStore.isGm() || this.vttStore.canControlToken(tok)) {
      this.vttStore.openTokenSheet(tok.id);
    }
  }

  toggleMultiSelectedHidden(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.toggleTokensHiddenBatch(ids);
    }
  }

  flipMultiSelectedHorizontal(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.flipTokensHorizontal(ids);
    }
  }

  flipMultiSelectedVertical(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.flipTokensVertical(ids);
    }
  }

  rotateMultiSelectedBy(deltaDeg: number): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.rotateTokensByDelta(ids, deltaDeg);
    }
  }

  resetMultiSelectedRotation(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.setTokensRotation(ids, 0);
    }
  }

  bringMultiSelectedToFront(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.bringTokensToFront(ids);
    }
  }

  sendMultiSelectedToBack(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.sendTokensToBack(ids);
    }
  }

  removeMultiSelectedTokens(): void {
    const ids = this.multiSelectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      this.canvasComp()?.tokenContextMenu.set(null);
      void this.vttStore.removeTokensBatch(ids);
    }
  }

  readonly brokenPortraitUrls = signal<Record<string, boolean>>({});

  markPortraitBroken(url: string | null | undefined): void {
    if (!url) return;
    this.brokenPortraitUrls.update((curr) =>
      curr[url] ? curr : { ...curr, [url]: true }
    );
  }

  isPortraitBroken(url: string | null | undefined): boolean {
    if (!url) return true;
    return Boolean(this.brokenPortraitUrls()[url]);
  }

  hasCustomTokenArt(
    tokenImageUrl: string | null | undefined,
    appearance: TokenAppearanceConfig | null | undefined
  ): boolean {
    return Boolean(tokenImageUrl) || hasCustomTokenAppearance(appearance);
  }

  getCharacterVisuals(ch: CharacterModel): {
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  } {
    return {
      portraitUrl: resolveEntityPortraitUrl(ch),
      tokenImageUrl: resolveEntityTokenImageUrl(ch),
      tokenAppearance: resolveEntityTokenAppearance(ch),
    };
  }

  getCollectionActorVisuals(colActor: CollectionActorModel): {
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  } {
    return {
      portraitUrl: resolveEntityPortraitUrl(colActor),
      tokenImageUrl: resolveEntityTokenImageUrl(colActor),
      tokenAppearance: resolveEntityTokenAppearance(colActor),
    };
  }

  getSpeakerComposerAppearance(speaker: {
    portraitUrl?: string | null;
    tokenImageUrl?: string | null;
    tokenAppearance?: TokenAppearanceConfig | null;
  }): {
    displayImageUrl: string | null;
    appearance: TokenAppearanceConfig;
  } {
    const appearance = normalizeTokenAppearance(speaker.tokenAppearance);
    if (speaker.tokenImageUrl) {
      return {
        displayImageUrl: speaker.tokenImageUrl,
        appearance,
      };
    }
    if (speaker.portraitUrl) {
      return {
        displayImageUrl: speaker.portraitUrl,
        appearance: {
          ...appearance,
          scale: 1,
          offset_x: 0,
          offset_y: 0,
        },
      };
    }
    return {
      displayImageUrl: null,
      appearance,
    };
  }

  async executeClearAllLogs(): Promise<void> {
    this.confirmClearLogs.set(false);
    await this.vttStore.clearAllLogs();
  }

  openCompendiumTab(): void {
    this.sidebarTab.set('compendium');
    if (typeof this.compendiumStore.ensureLoaded === 'function') {
      void this.compendiumStore.ensureLoaded();
    }
  }

  openCompendiumWindow(pack: VttCompendiumPackKind): void {
    if (!this.vttStore.isGm()) return;
    if (typeof this.compendiumStore.ensureLoaded === 'function') {
      void this.compendiumStore.ensureLoaded();
    }
    if (pack === 'weapons') {
      if (this.compendiumWeaponsWindowOpen()) {
        const win = this.compendiumWeaponsWindowRef();
        win?.minimized.set(false);
        win?.focusWindow();
        return;
      }
      this.compendiumWeaponsWindowOpen.set(true);
      return;
    }
    if (pack === 'armors') {
      if (this.compendiumArmorsWindowOpen()) {
        const win = this.compendiumArmorsWindowRef();
        win?.minimized.set(false);
        win?.focusWindow();
        return;
      }
      this.compendiumArmorsWindowOpen.set(true);
      return;
    }
    if (pack === 'items') {
      if (this.compendiumItemsWindowOpen()) {
        const win = this.compendiumItemsWindowRef();
        win?.minimized.set(false);
        win?.focusWindow();
        return;
      }
      this.compendiumItemsWindowOpen.set(true);
      return;
    }
    if (this.compendiumSkillsWindowOpen()) {
      const win = this.compendiumSkillsWindowRef();
      win?.minimized.set(false);
      win?.focusWindow();
      return;
    }
    this.compendiumSkillsWindowOpen.set(true);
  }

  closeCompendiumWindow(pack: VttCompendiumPackKind): void {
    if (pack === 'weapons') {
      this.compendiumWeaponsWindowOpen.set(false);
    } else if (pack === 'armors') {
      this.compendiumArmorsWindowOpen.set(false);
    } else if (pack === 'items') {
      this.compendiumItemsWindowOpen.set(false);
    } else {
      this.compendiumSkillsWindowOpen.set(false);
    }
  }

  toggleCompendiumWeaponExpanded(weaponId: string): void {
    this.expandedCompendiumWeaponId.update((curr) =>
      curr === weaponId ? null : weaponId
    );
  }

  toggleCompendiumArmorExpanded(armorId: string): void {
    this.expandedCompendiumArmorId.update((curr) =>
      curr === armorId ? null : armorId
    );
  }

  toggleCompendiumItemExpanded(itemId: string): void {
    this.expandedCompendiumItemId.update((curr) =>
      curr === itemId ? null : itemId
    );
  }

  toggleCompendiumSkillExpanded(skillId: string): void {
    this.expandedCompendiumSkillId.update((curr) =>
      curr === skillId ? null : skillId
    );
  }

  getCompendiumWeaponVisuals(wep: WeaponModel): ResolvedCompendiumVisuals {
    return resolveWeaponVisuals(wep);
  }

  getCompendiumArmorVisuals(armor: ArmorModel): ResolvedCompendiumVisuals {
    return resolveArmorVisuals(armor);
  }

  getCompendiumItemVisuals(
    item: CompendiumItemModel
  ): ResolvedCompendiumVisuals {
    return resolveCompendiumItemVisuals(item);
  }

  getCompendiumNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getCompendiumWeaponTags(wep: WeaponModel): string[] {
    return [...getWeaponPropertyTags(wep), ...formatWeaponHookBadges(wep)];
  }

  getCompendiumNodeHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  onCompendiumWeaponDragStart(event: DragEvent, wep: WeaponModel): void {
    if (!this.vttStore.isGm()) return;
    event.stopPropagation();
    this.vttStore.draggingRosterPayload.set(null);
    const payload: VttCompendiumDragPayload = {
      kind: 'compendium-weapon',
      itemId: wep.id,
      name: wep.name,
    };
    this.vttStore.draggingCompendiumPayload.set(payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        VTT_COMPENDIUM_DRAG_MIME,
        JSON.stringify(payload)
      );
      event.dataTransfer.setData('text/plain', wep.name);
    }
  }

  onCompendiumArmorDragStart(event: DragEvent, armor: ArmorModel): void {
    if (!this.vttStore.isGm()) return;
    event.stopPropagation();
    this.vttStore.draggingRosterPayload.set(null);
    const payload: VttCompendiumDragPayload = {
      kind: 'compendium-armor',
      itemId: armor.id,
      name: armor.name,
    };
    this.vttStore.draggingCompendiumPayload.set(payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        VTT_COMPENDIUM_DRAG_MIME,
        JSON.stringify(payload)
      );
      event.dataTransfer.setData('text/plain', armor.name);
    }
  }

  onCompendiumItemDragStart(
    event: DragEvent,
    item: CompendiumItemModel
  ): void {
    if (!this.vttStore.isGm()) return;
    event.stopPropagation();
    this.vttStore.draggingRosterPayload.set(null);
    const payload: VttCompendiumDragPayload = {
      kind: 'compendium-item',
      itemId: item.id,
      name: item.name,
    };
    this.vttStore.draggingCompendiumPayload.set(payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        VTT_COMPENDIUM_DRAG_MIME,
        JSON.stringify(payload)
      );
      event.dataTransfer.setData('text/plain', item.name);
    }
  }

  onCompendiumStandaloneDragStart(event: DragEvent, node: PerkNodeModel): void {
    if (!this.vttStore.isGm()) return;
    event.stopPropagation();
    this.vttStore.draggingRosterPayload.set(null);
    const payload: VttCompendiumDragPayload = {
      kind: 'compendium-standalone',
      itemId: node.id,
      name: node.name,
    };
    this.vttStore.draggingCompendiumPayload.set(payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        VTT_COMPENDIUM_DRAG_MIME,
        JSON.stringify(payload)
      );
      event.dataTransfer.setData('text/plain', node.name);
    }
  }

  onCompendiumDragEnd(): void {
    this.vttStore.draggingCompendiumPayload.set(null);
  }
}
