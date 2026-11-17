import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import {
  UserAssetFolderModel,
  UserAssetModel,
  UserAssetPreferencesModel,
  buildUserStorageFolderPrefix,
} from './core/assets/user-assets.model';
import { UserAssetsService } from './core/assets/user-assets.service';
import { UserAssetsStore } from './core/assets/user-assets.store';
import { AuthService } from './core/auth/auth.service';
import {
  ArmorModel,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ARMORS,
  DEFAULT_COMPENDIUM_ITEMS,
  PerkNodeModel,
  WeaponModel,
  artUpgradeToHookRows,
  buildSkillTreeHierarchy,
  canConnectPerkRoute,
  compileArtUpgradeSpec,
  computeCombatArtReachFeet,
  computePerkNodeTier,
  evaluateWeaponRequirement,
  formatArtUpgradeBadges,
  formatRuleHookBadges,
  formatWeaponHookBadges,
  formatWeaponRequirementLabel,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  getDescendantNodeIds,
  getNodeParentIds,
  getNodeUiKind,
  hooksObjectToRows,
  isCombatArtUpgradeNode,
  isPerkNodeReachableForUnlock,
  normalizePerkNodesTiers,
  normalizeWeaponRequirement,
  pruneUnreachableUnlockedPerks,
  resolveCombatArtRangeMode,
  resolveSkillGraphLayout,
  rowsToHooksObject,
  suggestNewNodeCanvasPosition,
} from './core/compendium/compendium.model';
import { CompendiumService } from './core/compendium/compendium.service';
import { CompendiumStore } from './core/compendium/compendium.store';
import { NotificationStore } from './core/notifications/notification.store';
import {
  ColorPickerComponent,
  hexToHsv,
  hsvToHex,
  isValidHexColor,
  normalizeHexColor,
} from './shared/color-picker/color-picker.component';
import {
  DEFAULT_VTT_HOTKEYS,
  DEFAULT_VTT_PREFERENCES,
  VttSettingsStore,
  formatHotkeyBadge,
  matchesHotkey,
  normalizeKeyComboFromEvent,
} from './core/settings/vtt-settings.store';
import { ThemeStore } from './core/theme/theme.store';
import { SupabaseService } from './core/supabase/supabase.service';
import { AuthStore } from './core/auth/auth.store';
import { CharacterDetailComponent } from './features/characters/character-detail.component';
import {
  CharacterModel,
  buildArmorInventoryEntry,
  buildCompendiumGearInventoryEntry,
  buildWeaponInventoryEntry,
  computeCharacterWeaponFormula,
  computeDerivedStats,
  getInventoryItemCategory,
  getUpgradeSlotKey,
  mergeInventoryEntry,
} from './features/characters/models/character.model';
import { CharacterService } from './features/characters/services/character.service';
import { CharacterStore } from './features/characters/store/character.store';
import { CollectionsService } from './features/collections/collections.service';
import {
  CollectionsStore,
  buildActorTemplateFromCharacter,
} from './features/collections/collections.store';
import {
  ContentManagerComponent,
  ContentManagerRouteSlotComponent,
  parseContentManagerUrl,
} from './features/content-manager/content-manager.component';
import { CampaignService } from './features/dashboard/services/campaign.service';
import { CampaignStore } from './features/dashboard/store/campaign.store';
import * as THREE from 'three';
import {
  VTT_CHAT_COMMANDS,
  VttChatCommandConfig,
  findMatchingSlashCommands,
  resolveSlashCommand,
} from './features/vtt/config/vtt-commands.config';
import {
  getLegalDefenderReactions,
  resolveClashReaction,
  roll2d10Check,
} from './features/vtt/engine/clash.engine';
import {
  getPolyhedronTemplate,
  preSimulateDeterministicThrow,
} from './features/vtt/engine/dice-3d.engine';
import {
  adjustDiePoolCount,
  applyDieClickToChatInput,
  applyModifierToChatInput,
  applyRollModeToChatInput,
  buildPhysicalDiceFrom2d10Roll,
  createEmptyDicePool,
  extractDicePoolFromChatInput,
  extractLogRollChips,
  extractModifierFromChatInput,
  extractRollModeFromChatInput,
  formatDicePoolFormula,
  getTotalDiceInPool,
  parseAndRollDiceFormula,
  rollCustomDicePool,
  sanitizeIncomingDiceThrowPayload,
} from './features/vtt/engine/dice-roller.engine';
import {
  buildDirectoryTree,
  canNestFolderInside,
  collectDescendantFolderIds,
} from './features/vtt/engine/directory-tree.engine';
import {
  HexGridGeometry,
  clampWorldPointToBounds,
  computeSceneCanvasLayout,
  createTokenTravelAnimation,
  feetToWorldPixels,
  findHexPath,
  getHexDistanceFeet,
  getHexStepPixels,
  getHexWorldBounds,
  getTokenDistanceFeet,
  getTokenWorldCenter,
  hexToWorldCenter,
  isWorldSegmentBlockedByWalls,
  sampleTokenTravelAnimation,
  worldPointToHex,
} from './features/vtt/engine/hex-grid.engine';
import {
  buildLightPolygons,
  buildObserverVisions,
  collectNewlyExploredHexKeys,
  isWorldPointVisibleToObservers,
} from './features/vtt/engine/visibility.engine';
import {
  DEFAULT_VTT_BG_COLOR,
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  DEFAULT_VTT_GRID_HEIGHT,
  DEFAULT_VTT_GRID_OPACITY,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_GRID_WIDTH,
  DEFAULT_VTT_SCENE_HEIGHT_PX,
  DEFAULT_VTT_SCENE_PADDING,
  DEFAULT_VTT_SCENE_WIDTH_PX,
  CollectionActorModel,
  VTT_SCENE_LIGHTING_PRESETS,
  VttFolderModel,
  VttLogEntry,
  VttPendingClash,
  VttRosterActorModel,
  VttSceneModel,
  VttTokenModel,
  VttWallSegment,
  computeEffectiveActorSightFeet,
  findMatchingSceneLightingPreset,
  parseCharacterIdFromUrlOrInput,
  parseCollectionActorIdFromUrlOrInput,
  resolveActorDarkvisionFeet,
  resolveRosterActorSourceCharacterId,
} from './features/vtt/models/vtt.model';
import { VttActorSheetComponent } from './features/vtt/components/vtt-actor-sheet/vtt-actor-sheet.component';
import { VttCanvasComponent } from './features/vtt/components/vtt-canvas/vtt-canvas.component';
import { VttFloatingWindowComponent } from './features/vtt/components/vtt-floating-window/vtt-floating-window.component';
import { VttTokenizerWindowComponent } from './features/vtt/components/vtt-tokenizer-window/vtt-tokenizer-window.component';
import { VttService } from './features/vtt/services/vtt.service';
import { VttStore } from './features/vtt/store/vtt.store';
import { VttRoomComponent } from './features/vtt/vtt-room.component';
import { normalizeCharacterRecord } from './features/characters/services/character.service';
import { AssetBrowserModalComponent } from './shared/asset-browser/asset-browser-modal.component';
import {
  DEFAULT_TOKEN_APPEARANCE,
  buildTokenImagePanZoomTransform,
  clampTokenOffset,
  clampTokenScale,
  hasCustomTokenAppearance,
  normalizeTokenAppearance,
  resolveTokenRingColor,
} from './shared/token-avatar/token-appearance.model';
import { TokenAvatarComponent } from './shared/token-avatar/token-avatar.component';
import { TokenizerEditorComponent } from './shared/token-avatar/tokenizer-editor.component';
import {
  enrichNpcStatsWithVisuals,
  resolveEntityPortraitUrl,
  resolveEntityTokenAppearance,
  resolveEntityTokenImageUrl,
} from './features/vtt/models/vtt.model';
import {
  KeywordTooltipService,
  computeKeywordTooltipPosition,
} from './shared/keyword-text/keyword-tooltip.service';
import { SkillTreeCanvasComponent } from './shared/skill-tree-canvas/skill-tree-canvas.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the March of Time app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the March of Time header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('March of Time');
  });

  it('should map Defense Triangle combat tags to canonical rules and badge tokens', () => {
    expect(getCombatTagBadgeClass('Crushing')).toBe('badge-crushing');
    expect(getCombatTagCounterLabel('Crushing')).toBe('Cannot Parry');

    expect(getCombatTagBadgeClass('Sweeping')).toBe('badge-sweeping');
    expect(getCombatTagCounterLabel('Sweeping')).toBe('Cannot Dodge');

    expect(getCombatTagBadgeClass('Piercing')).toBe('badge-piercing');
    expect(getCombatTagCounterLabel('Piercing')).toBe('Cannot Block');

    const compiledCrushing = rowsToHooksObject([], 'combat_art', 'Crushing');
    expect(compiledCrushing.disallow_defense).toEqual(['Parry']);
    const compiledSweeping = rowsToHooksObject([], 'combat_art', 'Sweeping');
    expect(compiledSweeping.disallow_defense).toEqual(['Dodge']);
    const compiledPiercing = rowsToHooksObject([], 'combat_art', 'Piercing');
    expect(compiledPiercing.disallow_defense).toEqual(['Block']);
  });

  it('should not charge DM-granted standalone arts against a player skill tree perk budget', () => {
    const mockWeapon: WeaponModel = {
      id: 'w-longsword',
      slug: 'longsword',
      name: 'Longsword',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Technique',
      gov_skill: 'Strike',
      base_damage: 5,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: 'Versatile',
      trait_description: 'Inflicts +2 bonus SP damage on a Flawless Parry.',
      rule_hooks: { flawless_parry_bonus_sp_damage: 2 },
    };

    const treeNode: PerkNodeModel = {
      id: 'node-root-strike',
      tree_id: 'tree-custom',
      slug: 'root-strike',
      name: 'Opening Strike',
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: 'Crushing',
      description: 'Overhead Crushing blow.',
      rule_hooks: { disallow_defense: ['Parry'] },
    };

    const standalonePassive: PerkNodeModel = {
      id: 'solo-custom-boon',
      tree_id: null,
      slug: 'custom-boon',
      name: 'Custom Boon',
      node_type: 'passive_upgrade',
      tier: 1,
      perk_cost: 1,
      ap_cost: null,
      cooldown_rounds: null,
      combat_tag: 'None',
      description: 'Grants +2 Max SP.',
      rule_hooks: { bonus_max_sp: 2, __is_standalone: true },
    };

    const stats = computeDerivedStats(
      {
        level: 1,
        attributes: { Brawn: 2, Agility: 1, Technique: 1, Iron: 1, Cunning: 0 },
        combat_skills: { Strike: 1, Shoot: 0, Parry: 1, Dodge: 0, Block: 0 },
        field_skills: {
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
        },
        equipped_armor: 'Medium',
        equipped_shield: 'Heater',
        weapon_slot_1_id: mockWeapon.id,
        weapon_slot_2_id: null,
        active_weapon_slot: 1,
        unlocked_perk_ids: [treeNode.id, standalonePassive.id],
      },
      [mockWeapon],
      [treeNode, standalonePassive]
    );

    expect(stats.perkBudget).toBe(1);
    expect(stats.perkSpent).toBe(1);
    expect(stats.maxSp).toBe(6);
    expect(stats.unlockedPerks.map((p) => p.id)).toContain(standalonePassive.id);
  });

  it('should dynamically derive uncapped tree tiers beyond Tier 5 from parent chain', () => {
    const makeNode = (
      id: string,
      name: string,
      parentId: string | null,
      sortOrder?: number
    ): PerkNodeModel => ({
      id,
      tree_id: 'tree-sentinel',
      slug: id,
      name,
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 1,
      ap_cost: 1,
      cooldown_rounds: 2,
      combat_tag: 'None',
      description: name,
      rule_hooks:
        sortOrder !== undefined ? { __sort_order: sortOrder } : {},
      parent_node_id: parentId,
    });

    const chain: PerkNodeModel[] = [
      makeNode('n1', 'Root Stance', null, 20),
      makeNode('n2', 'Second Step', 'n1'),
      makeNode('n3', 'Third Step', 'n2'),
      makeNode('n4', 'Fourth Step', 'n3'),
      makeNode('n5', 'Fifth Step', 'n4'),
      makeNode('n6', 'Sixth Mastery', 'n5'),
      makeNode('n1-left', 'Vanguard Opening', null, 10),
    ];

    expect(computePerkNodeTier('tree-sentinel', 'n5', chain)).toBe(6);
    expect(computePerkNodeTier('tree-sentinel', 'n6', chain)).toBe(7);

    const normalized = normalizePerkNodesTiers(chain);
    expect(normalized.find((n) => n.id === 'n6')?.tier).toBe(6);

    const forest = buildSkillTreeHierarchy('tree-sentinel', chain);
    expect(forest.map((b) => b.node.id)).toEqual(['n1-left', 'n1']);

    let cursor = forest[1];
    for (let expectedTier = 1; expectedTier <= 6; expectedTier++) {
      expect(cursor.node.tier).toBe(expectedTier);
      if (expectedTier < 6) {
        cursor = cursor.children[0];
      }
    }

    const descendantsOfN2 = getDescendantNodeIds('n2', chain);
    expect(Array.from(descendantsOfN2).sort()).toEqual(['n3', 'n4', 'n5', 'n6']);
    expect(descendantsOfN2.has('n1')).toBe(false);
  });

  it('should auto-flip viewport-fixed keyword tooltips upward when space below cannot fit content', () => {
    const nearBottomRight = computeKeywordTooltipPosition(
      { top: 740, bottom: 760, left: 1100, right: 1180 },
      1280,
      800
    );
    expect(nearBottomRight.resolvedPlacement).toBe('top');
    expect(nearBottomRight.top).toBeNull();
    expect(nearBottomRight.bottom).toBe(68);
    expect(nearBottomRight.left).toBe(848);
    expect(nearBottomRight.width).toBe(420);

    const chainedMidLower = computeKeywordTooltipPosition(
      { top: 500, bottom: 520, left: 200, right: 280 },
      1280,
      800,
      'auto',
      380
    );
    expect(chainedMidLower.resolvedPlacement).toBe('top');
    expect(chainedMidLower.maxHeight).toBe(480);

    const nearTopLeft = computeKeywordTooltipPosition(
      { top: 80, bottom: 100, left: 4, right: 90 },
      1280,
      800
    );
    expect(nearTopLeft.resolvedPlacement).toBe('bottom');
    expect(nearTopLeft.top).toBe(108);
    expect(nearTopLeft.bottom).toBeNull();
    expect(nearTopLeft.left).toBe(12);
  });

  it('should keep keyword tooltip open when pointer moves from keyword into tooltip to scroll', async () => {
    const tooltipService = TestBed.inject(KeywordTooltipService);
    const anchor = document.createElement('span');
    document.body.appendChild(anchor);

    tooltipService.show(
      {
        term: 'Crushing',
        category: 'Defense Triangle Tag',
        summary: 'Cannot be Parried.',
      },
      anchor
    );
    expect(tooltipService.activeKeyword()?.term).toBe('Crushing');

    tooltipService.hide(anchor);
    tooltipService.onTooltipMouseEnter();

    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(tooltipService.activeKeyword()?.term).toBe('Crushing');

    tooltipService.hideImmediately();
    expect(tooltipService.activeKeyword()).toBeNull();
    anchor.remove();
  });

  it('should configure and navigate Content Manager child subroutes without errors', async () => {
    const cmRoute = routes.find((r) => r.path === 'content-manager');
    expect(cmRoute).toBeTruthy();
    const childPaths = (cmRoute?.children ?? []).map((c) => c.path);
    expect(childPaths).toContain('trees');
    expect(childPaths).toContain('trees/:treeId');
    expect(childPaths).toContain('standalone');
    expect(childPaths).toContain('weapons');
    expect(childPaths).toContain('keywords');

    expect(parseContentManagerUrl('/content-manager')).toEqual({
      tab: 'trees',
      treeId: null,
    });
    expect(parseContentManagerUrl('/content-manager/weapons')).toEqual({
      tab: 'weapons',
      treeId: null,
    });
    expect(parseContentManagerUrl('/content-manager/keywords')).toEqual({
      tab: 'keywords',
      treeId: null,
    });
    expect(parseContentManagerUrl('/content-manager/trees/iron-bastion')).toEqual({
      tab: 'trees',
      treeId: 'iron-bastion',
    });

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'content-manager',
            loadComponent: () =>
              import('./features/content-manager/content-manager.component').then(
                (m) => m.ContentManagerComponent
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'trees' },
              {
                path: 'trees',
                loadComponent: () =>
                  import('./features/content-manager/content-manager.component').then(
                    (m) => m.ContentManagerRouteSlotComponent
                  ),
              },
              {
                path: 'trees/:treeId',
                loadComponent: () =>
                  import('./features/content-manager/content-manager.component').then(
                    (m) => m.ContentManagerRouteSlotComponent
                  ),
              },
              {
                path: 'standalone',
                loadComponent: () =>
                  import('./features/content-manager/content-manager.component').then(
                    (m) => m.ContentManagerRouteSlotComponent
                  ),
              },
              {
                path: 'weapons',
                loadComponent: () =>
                  import('./features/content-manager/content-manager.component').then(
                    (m) => m.ContentManagerRouteSlotComponent
                  ),
              },
              {
                path: 'keywords',
                loadComponent: () =>
                  import('./features/content-manager/content-manager.component').then(
                    (m) => m.ContentManagerRouteSlotComponent
                  ),
              },
            ],
          },
        ]),
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create('/content-manager');
    const cmInstance = harness.routeDebugElement?.componentInstance as ContentManagerComponent;
    expect(cmInstance).toBeTruthy();
    expect(cmInstance.studioTab()).toBe('trees');
    expect(cmInstance.activeTreeId()).toBeNull();

    await harness.navigateByUrl('/content-manager/standalone');
    expect(cmInstance.studioTab()).toBe('standalone');

    await harness.navigateByUrl('/content-manager/weapons');
    expect(cmInstance.studioTab()).toBe('weapons');

    await harness.navigateByUrl('/content-manager/keywords');
    expect(cmInstance.studioTab()).toBe('keywords');

    await harness.navigateByUrl('/content-manager/trees/vanguard');
    expect(cmInstance.studioTab()).toBe('trees');
    expect(cmInstance.activeTreeId()).toBe('vanguard');
  });

  it('should render loading indicators and skeletons instead of empty states while Compendium is loading', async () => {
    let resolveFetch!: (value: {
      weapons: WeaponModel[];
      skillTrees: [];
      perkNodes: PerkNodeModel[];
      keywords: [];
    }) => void;

    const pendingCompendiumPromise = new Promise<{
      weapons: WeaponModel[];
      skillTrees: [];
      perkNodes: PerkNodeModel[];
      keywords: [];
    }>((res) => {
      resolveFetch = res;
    });

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        {
          provide: CompendiumService,
          useValue: {
            fetchFullCompendium: () => pendingCompendiumPromise,
          },
        },
        provideRouter([
          {
            path: 'content-manager',
            component: ContentManagerComponent,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'trees' },
              { path: 'trees', component: ContentManagerRouteSlotComponent },
              { path: 'trees/:treeId', component: ContentManagerRouteSlotComponent },
              { path: 'standalone', component: ContentManagerRouteSlotComponent },
              { path: 'weapons', component: ContentManagerRouteSlotComponent },
              { path: 'keywords', component: ContentManagerRouteSlotComponent },
            ],
          },
        ]),
      ],
    }).compileComponents();

    const store = TestBed.inject(CompendiumStore);
    const loadPromise = store.loadCompendium();

    const harness = await RouterTestingHarness.create('/content-manager/trees');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Loading Martial Skill Trees...'
    );
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'No Skill Trees Found'
    );

    await harness.navigateByUrl('/content-manager/standalone');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Loading Standalone Arts...'
    );
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'No Standalone Combat Arts or Passives Found'
    );

    await harness.navigateByUrl('/content-manager/weapons');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Loading Armory...'
    );
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'No matching weapons in the Armory'
    );

    await harness.navigateByUrl('/content-manager/keywords');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Loading Keywords Glossary...'
    );

    await harness.navigateByUrl('/content-manager/trees/vanguard');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Loading Skill Tree Canvas...'
    );
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'Skill Tree Not Found'
    );

    resolveFetch({ weapons: [], skillTrees: [], perkNodes: [], keywords: [] });
    await loadPromise;
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Skill Tree Not Found'
    );
  });

  it('should lazy-load store data strictly on demand per route and deduplicate via in-memory cache', async () => {
    let campaignCalls = 0;
    let compendiumCalls = 0;
    let userCharacterCalls = 0;
    let adminDirectoryCalls = 0;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            getSessionUser: async () => ({
              id: 'user-admin-1',
              email: 'dm@marchoftime.test',
              user_metadata: { handle: 'grand_dm', full_name: 'Grand DM' },
            }),
            fetchProfile: async () => ({
              id: 'user-admin-1',
              display_name: 'Grand DM',
              handle: 'grand_dm',
              is_admin: true,
              sheet_theme: 'light',
              vtt_theme: 'dark',
            }),
            onAuthStateChange: () => {},
          },
        },
        {
          provide: CampaignService,
          useValue: {
            fetchUserCampaigns: async () => {
              campaignCalls++;
              return {
                yourGames: [],
                joinedGames: [],
                needsMigration: false,
                error: null,
              };
            },
          },
        },
        {
          provide: CompendiumService,
          useValue: {
            fetchFullCompendium: async () => {
              compendiumCalls++;
              return {
                weapons: [],
                skillTrees: [],
                perkNodes: [],
                keywords: [],
              };
            },
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => {
              userCharacterCalls++;
              return { data: [], error: null };
            },
            fetchAllCharacters: async () => {
              adminDirectoryCalls++;
              return { data: [], error: null };
            },
            fetchCharacterById: async () => ({ data: null, error: null }),
          },
        },
      ],
    }).compileComponents();

    const appFixture = TestBed.createComponent(App);
    appFixture.detectChanges();

    const harness = await RouterTestingHarness.create('/dashboard');
    await appFixture.whenStable();
    expect(campaignCalls).toBe(1);
    expect(compendiumCalls).toBe(0);
    expect(userCharacterCalls).toBe(0);
    expect(adminDirectoryCalls).toBe(0);

    await harness.navigateByUrl('/profile');
    expect(campaignCalls).toBe(1);
    expect(compendiumCalls).toBe(0);
    expect(userCharacterCalls).toBe(0);
    expect(adminDirectoryCalls).toBe(0);

    await harness.navigateByUrl('/content-manager/trees');
    expect(compendiumCalls).toBe(1);
    expect(userCharacterCalls).toBe(0);
    expect(adminDirectoryCalls).toBe(0);

    await harness.navigateByUrl('/content-manager/weapons');
    await harness.navigateByUrl('/content-manager/keywords');
    expect(compendiumCalls).toBe(1);
    expect(adminDirectoryCalls).toBe(0);

    await harness.navigateByUrl('/content-manager/standalone');
    expect(compendiumCalls).toBe(1);
    expect(adminDirectoryCalls).toBe(1);
    expect(userCharacterCalls).toBe(0);

    await harness.navigateByUrl('/content-manager/weapons');
    await harness.navigateByUrl('/content-manager/standalone');
    expect(adminDirectoryCalls).toBe(1);

    await harness.navigateByUrl('/characters');
    expect(userCharacterCalls).toBe(1);
    expect(compendiumCalls).toBe(1);
  });

  it('should support multi-route skill graph connections across different depths, prevent cycles, and prune unreachable perks accurately', () => {
    const startA: PerkNodeModel = {
      id: 'start-a',
      tree_id: 'tree-vanguard',
      slug: 'start-a',
      name: 'Iron Stance',
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 1,
      ap_cost: 1,
      cooldown_rounds: 2,
      combat_tag: 'None',
      description: 'Starting node A.',
      rule_hooks: { __canvas_x: 0, __canvas_y: 0 },
      parent_node_id: null,
    };

    const midB: PerkNodeModel = {
      id: 'mid-b',
      tree_id: 'tree-vanguard',
      slug: 'mid-b',
      name: 'Bulwark Advance',
      node_type: 'combat_art',
      tier: 2,
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 2,
      combat_tag: 'Crushing',
      description: 'Connected from startA.',
      rule_hooks: { __parent_ids: ['start-a'] },
      parent_node_id: 'start-a',
    };

    const stepC: PerkNodeModel = {
      id: 'step-c',
      tree_id: 'tree-vanguard',
      slug: 'step-c',
      name: 'Shield Follow-Through',
      node_type: 'passive_upgrade',
      tier: 3,
      perk_cost: 1,
      ap_cost: null,
      cooldown_rounds: null,
      combat_tag: 'None',
      description: 'Connected from midB.',
      rule_hooks: { __parent_ids: ['mid-b'] },
      parent_node_id: 'mid-b',
    };

    const convergeD: PerkNodeModel = {
      id: 'converge-d',
      tree_id: 'tree-vanguard',
      slug: 'converge-d',
      name: 'Earthshaker Finisher',
      node_type: 'combat_art',
      tier: 4,
      perk_cost: 1,
      ap_cost: 3,
      cooldown_rounds: 4,
      combat_tag: 'Crushing',
      description: 'Reachable directly from startA OR through stepC.',
      rule_hooks: { __parent_ids: ['step-c', 'start-a'], __unlock_mode: 'any' },
      parent_node_id: 'step-c',
    };

    const graph = [startA, midB, stepC, convergeD];

    expect(getNodeParentIds(convergeD, graph)).toEqual(['step-c', 'start-a']);
    expect(canConnectPerkRoute('converge-d', 'start-a', graph)).toEqual({
      allowed: false,
      reason: 'cycle',
    });
    expect(canConnectPerkRoute('converge-d', 'mid-b', graph)).toEqual({
      allowed: false,
      reason: 'cycle',
    });
    expect(canConnectPerkRoute('start-a', 'converge-d', graph)).toEqual({
      allowed: false,
      reason: 'duplicate',
    });
    expect(canConnectPerkRoute('mid-b', 'converge-d', graph)).toEqual({
      allowed: true,
    });

    expect(isPerkNodeReachableForUnlock(convergeD, ['start-a'], graph)).toBe(true);
    expect(isPerkNodeReachableForUnlock(convergeD, [], graph)).toBe(false);

    const afterRefundingStepC = pruneUnreachableUnlockedPerks(
      ['start-a', 'mid-b', 'converge-d'],
      graph
    );
    expect(afterRefundingStepC).toEqual(['start-a', 'mid-b', 'converge-d']);

    const afterRefundingStartA = pruneUnreachableUnlockedPerks(
      ['mid-b', 'converge-d'],
      graph
    );
    expect(afterRefundingStartA).toEqual([]);

    const strictConvergeD: PerkNodeModel = {
      ...convergeD,
      rule_hooks: { __parent_ids: ['step-c', 'start-a'], __unlock_mode: 'all' },
    };
    const strictGraph = [startA, midB, stepC, strictConvergeD];
    expect(isPerkNodeReachableForUnlock(strictConvergeD, ['start-a'], strictGraph)).toBe(
      false
    );
    expect(
      isPerkNodeReachableForUnlock(
        strictConvergeD,
        ['start-a', 'mid-b', 'step-c'],
        strictGraph
      )
    ).toBe(true);
    expect(
      pruneUnreachableUnlockedPerks(
        ['start-a', 'mid-b', 'converge-d'],
        strictGraph
      )
    ).toEqual(['start-a', 'mid-b']);

    const layout = resolveSkillGraphLayout(graph);
    expect(layout.get('start-a')).toEqual({ x: 0, y: 0 });
    const nextBranchPt = suggestNewNodeCanvasPosition(graph, 'start-a');
    expect(nextBranchPt.y).toBeGreaterThan(0);
    expect(nextBranchPt.x).not.toBe(layout.get('mid-b')?.x);
  });

  it('should keep routine UI feedback strictly on ephemeral toasts without populating the notification inbox', () => {
    const store = TestBed.inject(NotificationStore);
    const toastId = store.info('Route Disconnected', 'Disconnected A from B.');
    expect(store.activeToasts().length).toBe(1);
    expect(store.history().length).toBe(0);
    expect(store.unreadCount()).toBe(0);

    store.dismissToast(toastId);
    expect(store.activeToasts().length).toBe(0);

    store.pushInboxNotification({
      tone: 'info',
      title: 'Campaign Invite',
      message: 'You were invited to join The Iron March.',
      alsoToast: false,
    });
    expect(store.history().length).toBe(1);
    expect(store.unreadCount()).toBe(1);
  });

  it('should author, compile, and display movement, push, shift, and weapon range rules in feet (5 ft per battlegrid space)', () => {
    const compiled = rowsToHooksObject(
      [
        { key: 'push_tiles', numValue: 10, statusValue: 'Sundered' },
        { key: 'self_shift_tiles', numValue: 5, statusValue: 'Sundered' },
        { key: 'bonus_move_tiles', numValue: 10, statusValue: 'Sundered' },
      ],
      'combat_art',
      'None'
    );

    expect(compiled.push_tiles).toBe(2);
    expect(compiled.self_shift_tiles).toBe(1);
    expect(compiled.bonus_move_tiles).toBe(2);

    const badges = formatRuleHookBadges(compiled);
    expect(badges).toContain('Push 10 ft');
    expect(badges).toContain('Shift 5 ft');
    expect(badges).toContain('+10 ft Move');

    const roundTripRows = hooksObjectToRows(compiled);
    expect(roundTripRows.find((r) => r.key === 'push_tiles')?.numValue).toBe(10);
    expect(roundTripRows.find((r) => r.key === 'self_shift_tiles')?.numValue).toBe(5);
    expect(roundTripRows.find((r) => r.key === 'bonus_move_tiles')?.numValue).toBe(10);

    const daggerBadges = formatWeaponHookBadges({
      id: 'w-dagger',
      slug: 'dagger',
      name: 'Dagger',
      category: 'Light',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Agility',
      gov_skill: 'Strike',
      base_damage: 2,
      reach_tiles: 1,
      thrown_range_tiles: 4,
      trait_name: 'Quick-Draw',
      trait_description: 'Can be thrown (20 ft).',
      rule_hooks: {},
    });
    expect(daggerBadges).toContain('Thrown (20 ft)');
  });

  it('should compile Combat Art Upgrades and resolve pinned deep-tree upgrades onto starting Combat Arts without inflating basic weapon strikes', () => {
    const spec = compileArtUpgradeSpec({
      targetMode: 'specific_arts',
      targetArtIds: ['art-opening'],
      addCombatTags: ['Piercing'],
      apCostDelta: 0,
      cooldownDelta: -1,
      hookRows: [
        { key: 'bonus_flat_damage', numValue: 3, statusValue: 'Sundered' },
        { key: 'push_tiles', numValue: 10, statusValue: 'Sundered' },
        { key: 'inflict_status', numValue: 1, statusValue: 'Bleeding' },
      ],
    });

    expect(spec.target_mode).toBe('specific_arts');
    expect(spec.target_art_ids).toEqual(['art-opening']);
    expect(spec.add_combat_tags).toEqual(['Piercing']);
    expect(spec.cooldown_delta).toBe(-1);
    expect(spec.bonus_flat_damage).toBe(3);
    expect(spec.push_tiles).toBe(2);
    expect(spec.inflict_statuses).toEqual(['Bleeding']);

    const roundTripRows = artUpgradeToHookRows(spec);
    expect(roundTripRows.find((r) => r.key === 'push_tiles')?.numValue).toBe(10);
    expect(roundTripRows.find((r) => r.key === 'inflict_status')?.statusValue).toBe('Bleeding');

    const upgradeBadges = formatArtUpgradeBadges(spec);
    expect(upgradeBadges).toContain('Grants Piercing (Cannot Block)');
    expect(upgradeBadges).toContain('-1 Rnd Cooldown');
    expect(upgradeBadges).toContain('+3 Art Flat DMG');
    expect(upgradeBadges).toContain('Push 10 ft');
    expect(upgradeBadges).toContain('Inflicts Bleeding');

    const mockWeapon: WeaponModel = {
      id: 'w-greatsword',
      slug: 'greatsword',
      name: 'Greatsword',
      category: 'Heavy',
      ap_cost: 2,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: 0,
      trait_name: 'Two-Handed',
      trait_description: 'Heavy impact.',
      rule_hooks: {},
    };

    const openingArt: PerkNodeModel = {
      id: 'art-opening',
      tree_id: 'tree-vanguard',
      slug: 'sundering-cleave',
      name: 'Sundering Cleave',
      tier: 1,
      parent_node_id: null,
      node_type: 'combat_art',
      ap_cost: 2,
      cooldown_rounds: 3,
      perk_cost: 1,
      combat_tag: 'Crushing',
      description: 'Heavy opening cleave.',
      rule_hooks: { disallow_defense: ['Parry'] },
    };

    const midPassive: PerkNodeModel = {
      id: 'pas-grit',
      tree_id: 'tree-vanguard',
      slug: 'iron-grit',
      name: 'Iron Grit',
      tier: 2,
      parent_node_id: 'art-opening',
      node_type: 'passive_upgrade',
      ap_cost: 0,
      cooldown_rounds: 0,
      perk_cost: 1,
      combat_tag: 'None',
      description: 'Endure punishment.',
      rule_hooks: { bonus_max_hp: 2 },
    };

    const deepUpgradeNode: PerkNodeModel = {
      id: 'upg-impaling-followthrough',
      tree_id: 'tree-vanguard',
      slug: 'impaling-followthrough',
      name: 'Impaling Followthrough',
      tier: 3,
      parent_node_id: 'pas-grit',
      node_type: 'passive_upgrade',
      ap_cost: 0,
      cooldown_rounds: 0,
      perk_cost: 1,
      combat_tag: 'None',
      description: 'Sundering Cleave drives through shields and bleeds targets.',
      rule_hooks: { __art_upgrade: spec },
    };

    expect(isCombatArtUpgradeNode(deepUpgradeNode)).toBe(true);
    expect(getNodeUiKind(deepUpgradeNode)).toBe('combat_art_upgrade');
    expect(getNodeUiKind(midPassive)).toBe('passive_upgrade');
    expect(getNodeUiKind(openingArt)).toBe('combat_art');

    const stats = computeDerivedStats(
      {
        level: 3,
        attributes: { Brawn: 2, Agility: 1, Technique: 1, Iron: 1, Cunning: 0 },
        combat_skills: { Strike: 2, Shoot: 0, Parry: 0, Dodge: 0, Block: 0 },
        field_skills: {
          Athletics: 1,
          Menace: 1,
          Stealth: 0,
          Tinkering: 0,
          Medicine: 0,
          Survival: 1,
          Resolve: 1,
          Perception: 0,
          Sway: 0,
          Lore: 0,
        },
        equipped_armor: 'Medium',
        equipped_shield: 'None',
        weapon_slot_1_id: 'w-greatsword',
        weapon_slot_2_id: null,
        active_weapon_slot: 1,
        unlocked_perk_ids: ['art-opening', 'pas-grit', 'upg-impaling-followthrough'],
        active_cooldowns: {},
      },
      [mockWeapon],
      [openingArt, midPassive, deepUpgradeNode]
    );

    expect(stats.resolvedCombatArts.length).toBe(1);
    const resolved = stats.resolvedCombatArts[0];
    expect(resolved.combatTags).toEqual(['Crushing', 'Piercing']);
    expect(resolved.disallowedDefenses).toEqual(['Parry', 'Block']);
    expect(resolved.apCost).toBe(2);
    expect(resolved.cooldownRounds).toBe(2);
    expect(resolved.baseCooldownRounds).toBe(3);
    expect(resolved.bonusFlatDamage).toBe(3);
    expect(resolved.appliedUpgrades.map((u) => u.id)).toEqual([
      'upg-impaling-followthrough',
    ]);
    expect(resolved.effectBadges).toContain('No Parry/Block');
    expect(resolved.effectBadges).toContain('+3 Flat DMG');
    expect(resolved.effectBadges).toContain('Push 10 ft');
    expect(resolved.effectBadges).toContain('Inflicts Bleeding');

    expect(stats.flatWeaponDamage).toBe(6);
    expect(stats.displayPassivePerks.map((p) => p.id)).toEqual(['pas-grit']);
  });

  it('should let player-choice Combat Art Upgrades auto-slot and switch between unlocked Combat Arts in the same tree', () => {
    const artAlpha: PerkNodeModel = {
      id: 'art-alpha',
      tree_id: 'tree-duelist',
      slug: 'lunging-thrust',
      name: 'Lunging Thrust',
      tier: 1,
      parent_node_id: null,
      node_type: 'combat_art',
      ap_cost: 2,
      cooldown_rounds: 2,
      perk_cost: 1,
      combat_tag: 'None',
      description: 'Quick thrust.',
      rule_hooks: {},
    };

    const artBeta: PerkNodeModel = {
      id: 'art-beta',
      tree_id: 'tree-duelist',
      slug: 'whirling-arc',
      name: 'Whirling Arc',
      tier: 1,
      parent_node_id: null,
      node_type: 'combat_art',
      ap_cost: 2,
      cooldown_rounds: 3,
      perk_cost: 1,
      combat_tag: 'Sweeping',
      description: 'Wide blade sweep.',
      rule_hooks: { disallow_defense: ['Dodge'] },
    };

    const choiceUpgrade: PerkNodeModel = {
      id: 'upg-masterwork-tempo',
      tree_id: 'tree-duelist',
      slug: 'masterwork-tempo',
      name: 'Masterwork Tempo',
      tier: 2,
      parent_node_id: 'art-alpha',
      node_type: 'passive_upgrade',
      ap_cost: 0,
      cooldown_rounds: 0,
      perk_cost: 1,
      combat_tag: 'None',
      description: 'Choose 1 Combat Art in this tree: -1 AP Cost and grants Piercing.',
      rule_hooks: {
        __art_upgrade: {
          target_mode: 'player_choice_tree',
          add_combat_tags: ['Piercing'],
          ap_cost_delta: -1,
        },
      },
    };

    const duelistNodes = [artAlpha, artBeta, choiceUpgrade];

    const baseChar = {
      level: 3,
      attributes: { Brawn: 0, Agility: 2, Technique: 2, Iron: 1, Cunning: 0 },
      combat_skills: { Strike: 2, Shoot: 0, Parry: 0, Dodge: 0, Block: 0 },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 1,
        Tinkering: 0,
        Medicine: 0,
        Survival: 0,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Light' as const,
      equipped_shield: 'Buckler' as const,
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1 as const,
      unlocked_perk_ids: ['art-alpha', 'art-beta', 'upg-masterwork-tempo'],
      active_cooldowns: {} as Record<string, number | string>,
    };

    const defaultStats = computeDerivedStats(baseChar, [], duelistNodes);
    expect(defaultStats.playerChoiceUpgradeSlots.length).toBe(1);
    expect(defaultStats.playerChoiceUpgradeSlots[0].selectedArtId).toBe('art-alpha');

    const alphaDefault = defaultStats.resolvedCombatArts.find(
      (a) => a.baseNode.id === 'art-alpha'
    )!;
    const betaDefault = defaultStats.resolvedCombatArts.find(
      (a) => a.baseNode.id === 'art-beta'
    )!;
    expect(alphaDefault.apCost).toBe(1);
    expect(alphaDefault.combatTags).toEqual(['Piercing']);
    expect(betaDefault.apCost).toBe(2);
    expect(betaDefault.combatTags).toEqual(['Sweeping']);

    const switchedStats = computeDerivedStats(
      {
        ...baseChar,
        active_cooldowns: {
          [getUpgradeSlotKey('upg-masterwork-tempo')]: 'art-beta',
        },
      },
      [],
      duelistNodes
    );
    expect(switchedStats.playerChoiceUpgradeSlots[0].selectedArtId).toBe('art-beta');

    const alphaSwitched = switchedStats.resolvedCombatArts.find(
      (a) => a.baseNode.id === 'art-alpha'
    )!;
    const betaSwitched = switchedStats.resolvedCombatArts.find(
      (a) => a.baseNode.id === 'art-beta'
    )!;
    expect(alphaSwitched.apCost).toBe(2);
    expect(alphaSwitched.combatTags).toEqual([]);
    expect(betaSwitched.apCost).toBe(1);
    expect(betaSwitched.combatTags).toEqual(['Sweeping', 'Piercing']);
    expect(betaSwitched.disallowedDefenses).toEqual(['Dodge', 'Block']);
  });

  it('should enforce Combat Art weapon prerequisites against the active weapon and detect when the alternate weapon slot satisfies them', () => {
    expect(normalizeWeaponRequirement({})).toBeUndefined();
    expect(formatWeaponRequirementLabel({ categories: ['Light'] })).toBe(
      'Requires Light Weapon'
    );
    expect(
      formatWeaponRequirementLabel({ categories: ['Light', 'Martial'] })
    ).toBe('Requires Light or Martial Weapon');
    expect(
      formatWeaponRequirementLabel({
        handedness: 'one_handed',
        requires_shield: true,
      })
    ).toBe('Requires One-Handed Weapon + Equipped Shield');

    const greatsword: WeaponModel = {
      id: 'w-greatsword',
      slug: 'greatsword',
      name: 'Greatsword',
      category: 'Heavy',
      ap_cost: 2,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: 0,
      trait_name: 'Two-Handed',
      trait_description: 'Heavy impact.',
      rule_hooks: { two_handed: true, heavy: true },
    };

    const dagger: WeaponModel = {
      id: 'w-dagger',
      slug: 'dagger',
      name: 'Dagger',
      category: 'Light',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Agility',
      gov_skill: 'Strike',
      base_damage: 2,
      reach_tiles: 1,
      thrown_range_tiles: 4,
      trait_name: 'Quick-Draw',
      trait_description: 'Can be thrown (20 ft).',
      rule_hooks: { two_handed: false },
    };

    const shieldBashEvalStowed = evaluateWeaponRequirement(
      { requires_shield: true },
      greatsword,
      'Heater',
      [greatsword, dagger]
    );
    expect(shieldBashEvalStowed.satisfied).toBe(false);
    expect(shieldBashEvalStowed.unmetReason).toContain('Shield stowed');

    const shieldBashEvalActive = evaluateWeaponRequirement(
      { requires_shield: true },
      dagger,
      'Heater',
      [greatsword, dagger]
    );
    expect(shieldBashEvalActive.satisfied).toBe(true);

    const viperFangArt: PerkNodeModel = {
      id: 'art-viper-fang',
      tree_id: 'tree-veil',
      slug: 'viper-fang',
      name: 'Viper Fang',
      tier: 1,
      parent_node_id: null,
      node_type: 'combat_art',
      ap_cost: 1,
      cooldown_rounds: 2,
      perk_cost: 1,
      combat_tag: 'Piercing',
      description: 'Rapid thrust into armor seams.',
      rule_hooks: {
        disallow_defense: ['Block'],
        __weapon_req: {
          categories: ['Light'],
        },
      },
    };

    const baseChar = {
      level: 2,
      attributes: { Brawn: 2, Agility: 2, Technique: 1, Iron: 0, Cunning: 0 },
      combat_skills: { Strike: 2, Shoot: 0, Parry: 1, Dodge: 1, Block: 0 },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 2,
        Tinkering: 0,
        Medicine: 0,
        Survival: 0,
        Resolve: 1,
        Perception: 2,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Light' as const,
      equipped_shield: 'None' as const,
      weapon_slot_1_id: 'w-greatsword',
      weapon_slot_2_id: 'w-dagger',
      active_weapon_slot: 1 as const,
      unlocked_perk_ids: ['art-viper-fang'],
      active_cooldowns: {},
    };

    const slot1Stats = computeDerivedStats(
      baseChar,
      [greatsword, dagger],
      [viperFangArt]
    );
    const artWhenHeavyActive = slot1Stats.resolvedCombatArts[0];
    expect(artWhenHeavyActive.weaponRequirementLabel).toBe(
      'Requires Light Weapon'
    );
    expect(artWhenHeavyActive.meetsWeaponRequirement).toBe(false);
    expect(artWhenHeavyActive.alternateSlotSatisfiesWeaponReq).toBe(true);
    expect(artWhenHeavyActive.alternateSlotWeaponName).toBe('Dagger');

    const slot2Stats = computeDerivedStats(
      { ...baseChar, active_weapon_slot: 2 },
      [greatsword, dagger],
      [viperFangArt]
    );
    const artWhenLightActive = slot2Stats.resolvedCombatArts[0];
    expect(artWhenLightActive.meetsWeaponRequirement).toBe(true);
    expect(artWhenLightActive.weaponRequirementUnmetReason).toBeNull();
    expect(artWhenLightActive.alternateSlotSatisfiesWeaponReq).toBe(false);
  });

  it('should round-trip square tile coordinates in feet and route 8-way A* movement around closed doors and walls', () => {
    const geom: HexGridGeometry = {
      gridWidth: 12,
      gridHeight: 10,
      gridSizePx: 64,
      offsetX: 16,
      offsetY: 20,
    };

    for (const sample of [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 4, row: 5 },
      { col: 7, row: 3 },
      { col: 11, row: 9 },
    ]) {
      const worldPt = hexToWorldCenter(sample, geom);
      expect(worldPt).toEqual({
        x: 16 + (sample.col + 0.5) * 64,
        y: 20 + (sample.row + 0.5) * 64,
      });
      const back = worldPointToHex(worldPt, geom);
      expect(back).toEqual(sample);
    }

    expect(getHexDistanceFeet({ col: 2, row: 2 }, { col: 2, row: 2 })).toBe(0);
    expect(getHexDistanceFeet({ col: 2, row: 2 }, { col: 2, row: 5 })).toBe(15);
    expect(getHexDistanceFeet({ col: 2, row: 2 }, { col: 5, row: 5 })).toBe(15);

    const straight = findHexPath({ col: 2, row: 3 }, { col: 5, row: 3 }, geom, []);
    expect(straight.reachable).toBe(true);
    expect(straight.feet).toBe(15);
    expect(straight.path).toEqual([
      { col: 2, row: 3 },
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 5, row: 3 },
    ]);

    const startCenter = hexToWorldCenter({ col: 2, row: 3 }, geom);
    const nextCenter = hexToWorldCenter({ col: 4, row: 3 }, geom);
    const midX = (startCenter.x + nextCenter.x) / 2;

    const closedDoor: VttWallSegment = {
      id: 'door-1',
      x1: midX,
      y1: startCenter.y - 96,
      x2: midX,
      y2: startCenter.y + 96,
      kind: 'door',
      open: false,
    };

    const detoured = findHexPath(
      { col: 2, row: 3 },
      { col: 4, row: 3 },
      geom,
      [closedDoor]
    );
    expect(detoured.reachable).toBe(true);
    expect(detoured.feet).toBeGreaterThan(10);

    const openedDoor: VttWallSegment = { ...closedDoor, open: true };
    const direct = findHexPath(
      { col: 2, row: 3 },
      { col: 4, row: 3 },
      geom,
      [openedDoor]
    );
    expect(direct.reachable).toBe(true);
    expect(direct.feet).toBe(10);
  });

  it('should compute raycasted VTT visibility across darkness, dynamic torches, windows, and doors', () => {
    const geom: HexGridGeometry = {
      gridWidth: 14,
      gridHeight: 8,
      gridSizePx: 64,
      offsetX: 0,
      offsetY: 0,
    };

    const observer: VttTokenModel = {
      id: 'tok-hero',
      encounter_id: 'enc-1',
      character_id: 'char-1',
      owner_id: 'user-1',
      name: 'Vanguard',
      faction: 'ally',
      x: 1,
      y: 3,
      q: 1,
      r: 3,
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      current_hp: 10,
      max_hp: 10,
      current_sp: 6,
      max_sp: 6,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 15,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    };

    const distantTargetPt = hexToWorldCenter({ col: 9, row: 3 }, geom);
    const darkVisions = buildObserverVisions([observer], [], geom, false, 1600);
    expect(
      isWorldPointVisibleToObservers(distantTargetPt, darkVisions, [], [], false)
    ).toBe(false);

    const distantTorch = {
      id: 'light-torch-1',
      x: distantTargetPt.x,
      y: distantTargetPt.y,
      bright_feet: 15,
      dim_feet: 30,
      color: '#FF9B42',
      enabled: true,
    };
    const openLights = buildLightPolygons([distantTorch], [observer], [], geom);
    expect(
      isWorldPointVisibleToObservers(
        distantTargetPt,
        darkVisions,
        openLights,
        [],
        false
      )
    ).toBe(true);

    const midPt = hexToWorldCenter({ col: 5, row: 3 }, geom);
    const closedDoor: VttWallSegment = {
      id: 'door-hall',
      x1: midPt.x,
      y1: midPt.y - 120,
      x2: midPt.x,
      y2: midPt.y + 120,
      kind: 'door',
      open: false,
    };
    const blockedVisions = buildObserverVisions(
      [observer],
      [closedDoor],
      geom,
      false,
      1600
    );
    const blockedLights = buildLightPolygons(
      [distantTorch],
      [observer],
      [closedDoor],
      geom
    );
    expect(
      isWorldPointVisibleToObservers(
        distantTargetPt,
        blockedVisions,
        blockedLights,
        [closedDoor],
        false
      )
    ).toBe(false);

    const windowSeg: VttWallSegment = { ...closedDoor, kind: 'window' };
    const windowVisions = buildObserverVisions(
      [observer],
      [windowSeg],
      geom,
      false,
      1600
    );
    expect(
      isWorldPointVisibleToObservers(
        distantTargetPt,
        windowVisions,
        openLights,
        [windowSeg],
        false
      )
    ).toBe(true);

    const explored = collectNewlyExploredHexKeys(
      new Set(),
      windowVisions,
      openLights,
      [windowSeg],
      geom,
      false
    );
    expect(explored).toContain('1,3');
    expect(explored).toContain('9,3');

    const outerHexPt = hexToWorldCenter({ col: 6, row: 3 }, geom);
    const shortRangeLights = buildLightPolygons(
      [{ ...distantTorch, bright_feet: 5, dim_feet: 10 }],
      [observer],
      [],
      geom
    );
    expect(
      isWorldPointVisibleToObservers(outerHexPt, darkVisions, shortRangeLights, [], false)
    ).toBe(false);

    const editedWideLights = buildLightPolygons(
      [{ ...distantTorch, bright_feet: 20, dim_feet: 40 }],
      [observer],
      [],
      geom
    );
    expect(
      isWorldPointVisibleToObservers(outerHexPt, darkVisions, editedWideLights, [], false)
    ).toBe(true);

    const toggledOffLights = buildLightPolygons(
      [{ ...distantTorch, bright_feet: 20, dim_feet: 40, enabled: false }],
      [observer],
      [],
      geom
    );
    expect(
      isWorldPointVisibleToObservers(outerHexPt, darkVisions, toggledOffLights, [], false)
    ).toBe(false);
  });

  it('should enforce Defense Triangle clash reactions, Flawless Parry Counter SP, Flawless Dodge AP refund, and SP-to-HP overflow math', () => {
    const baseClash: VttPendingClash = {
      id: 'clash-1',
      attackerTokenId: 'att-1',
      attackerName: 'Oathbreaker',
      defenderTokenId: 'def-1',
      defenderName: 'Duelist',
      actionName: 'Colossal Cleave',
      actionKind: 'combat_art',
      apSpent: 2,
      cooldownRounds: 2,
      distanceFeet: 5,
      reachFeet: 5,
      combatTags: ['Crushing', 'Piercing'],
      disallowedDefenses: ['Parry', 'Block'],
      attackRoll: roll2d10Check(4, 'normal', [6, 5]),
      rawFlatDamage: 8,
      bonusSpDamage: 0,
      ignoreArmorDr: 0,
      defendedSpChip: 0,
      pushFeet: 5,
      selfShiftFeet: 0,
      inflictStatuses: ['Staggered'],
      createdAt: '2026-11-12T00:00:00Z',
    };

    const defenderCaps = {
      currentSp: 3,
      currentHp: 10,
      currentAp: 2,
      armorDr: 2,
      shieldBlock: 4,
      shieldRaised: true,
      parryMod: 4,
      dodgeMod: 4,
      canDodge: true,
      enablesMartialParry: true,
      flawlessCounterSp: 6,
    };

    const legal = getLegalDefenderReactions(baseClash, defenderCaps);
    expect(legal.canParry).toBe(false);
    expect(legal.parryDisabledReason).toContain('Crushing');
    expect(legal.canDodge).toBe(true);
    expect(legal.blockActive).toBe(false);
    expect(legal.blockDisabledByPiercing).toBe(true);

    const directHit = resolveClashReaction(baseClash, 'take_hit', defenderCaps);
    expect(directHit.hitLanded).toBe(true);
    expect(directHit.shieldMitigated).toBe(0);
    expect(directHit.spDamageToDefender).toBe(3);
    expect(directHit.armorMitigated).toBe(2);
    expect(directHit.hpDamageToDefender).toBe(3);
    expect(directHit.inflictedStatuses).toEqual(['Staggered']);

    const flawlessDodge = resolveClashReaction(
      baseClash,
      'dodge',
      defenderCaps,
      roll2d10Check(4, 'normal', [9, 8])
    );
    expect(flawlessDodge.hitLanded).toBe(false);
    expect(flawlessDodge.flawlessDefense).toBe(true);
    expect(flawlessDodge.defenderApSpent).toBe(0);
    expect(flawlessDodge.shiftDefenderFeet).toBe(5);

    const parryableClash: VttPendingClash = {
      ...baseClash,
      combatTags: ['Sweeping'],
      disallowedDefenses: ['Dodge'],
    };
    const sweepLegal = getLegalDefenderReactions(parryableClash, defenderCaps);
    expect(sweepLegal.canParry).toBe(true);
    expect(sweepLegal.canDodge).toBe(false);

    const flawlessParry = resolveClashReaction(
      parryableClash,
      'parry',
      defenderCaps,
      roll2d10Check(4, 'normal', [9, 9])
    );
    expect(flawlessParry.hitLanded).toBe(false);
    expect(flawlessParry.flawlessDefense).toBe(true);
    expect(flawlessParry.defenderApSpent).toBe(1);
    expect(flawlessParry.counterSpToAttacker).toBe(6);
  });

  it('should build nested Foundry-style folder trees across directory scopes, enforce 3-level depth, recover orphans, and filter by search query', () => {
    expect(DEFAULT_VTT_GRID_WIDTH).toBe(16);
    expect(DEFAULT_VTT_GRID_HEIGHT).toBe(11);
    expect(DEFAULT_VTT_BG_COLOR).toBe('#0E1917');

    const folders: VttFolderModel[] = [
      {
        id: 'f-act1',
        campaign_id: 'camp-1',
        scope: 'maps',
        parent_folder_id: null,
        name: 'Act I: Iron Wastes',
        color: '#C4491A',
        sort_order: 0,
      },
      {
        id: 'f-crypt',
        campaign_id: 'camp-1',
        scope: 'maps',
        parent_folder_id: 'f-act1',
        name: 'Sunken Crypt',
        color: '#38B29A',
        sort_order: 0,
      },
      {
        id: 'f-sanctum',
        campaign_id: 'camp-1',
        scope: 'maps',
        parent_folder_id: 'f-crypt',
        name: 'Inner Sanctum',
        color: '#8B5CF6',
        sort_order: 0,
      },
      {
        id: 'f-npcs-only',
        campaign_id: 'camp-1',
        scope: 'npcs',
        parent_folder_id: null,
        name: 'Bosses',
        color: '#E11D48',
        sort_order: 0,
      },
    ];

    const maps = [
      { id: 'm-camp', name: 'Border Encampment', folder_id: 'f-act1', sort_order: 0 },
      { id: 'm-vault', name: 'Reliquary Vault', folder_id: 'f-sanctum', sort_order: 0 },
      { id: 'm-root', name: 'Blank Tavern Sketch', folder_id: null, sort_order: 0 },
      { id: 'm-orphan', name: 'Lost Ruins', folder_id: 'missing-folder', sort_order: 1 },
    ];

    const descendants = collectDescendantFolderIds('f-act1', folders);
    expect(Array.from(descendants).sort()).toEqual(['f-crypt', 'f-sanctum']);

    expect(canNestFolderInside(null, 'f-act1', folders, 'maps')).toBe(true);
    expect(canNestFolderInside(null, 'f-crypt', folders, 'maps')).toBe(true);
    expect(canNestFolderInside(null, 'f-sanctum', folders, 'maps')).toBe(false);
    expect(canNestFolderInside('f-act1', 'f-crypt', folders, 'maps')).toBe(false);
    expect(canNestFolderInside('f-act1', 'f-act1', folders, 'maps')).toBe(false);
    expect(canNestFolderInside(null, 'f-npcs-only', folders, 'maps')).toBe(false);

    const tree = buildDirectoryTree(folders, maps, {
      scope: 'maps',
      getItemFolderId: (m) => m.folder_id,
      getItemName: (m) => m.name,
      getItemSortOrder: (m) => m.sort_order,
    });

    expect(tree.folders.length).toBe(1);
    expect(tree.folders[0].folder.id).toBe('f-act1');
    expect(tree.folders[0].totalItemCount).toBe(2);
    expect(tree.folders[0].subfolders[0].folder.id).toBe('f-crypt');
    expect(tree.folders[0].subfolders[0].subfolders[0].folder.id).toBe('f-sanctum');
    expect(tree.folders[0].subfolders[0].subfolders[0].items.map((i) => i.id)).toEqual([
      'm-vault',
    ]);
    expect(tree.rootItems.map((i) => i.id)).toEqual(['m-root', 'm-orphan']);
    expect(tree.flatFolderOptions.map((o) => o.id)).toEqual([
      'f-act1',
      'f-crypt',
      'f-sanctum',
    ]);

    const searched = buildDirectoryTree(folders, maps, {
      scope: 'maps',
      getItemFolderId: (m) => m.folder_id,
      getItemName: (m) => m.name,
      searchQuery: 'reliquary',
    });
    expect(searched.rootItems.length).toBe(0);
    expect(searched.folders.length).toBe(1);
    expect(searched.folders[0].totalItemCount).toBe(1);
  });

  it('should compute continuous world-space distances in feet, wall ray collisions, and dynamic vision in Gridless map mode', () => {
    const geom: HexGridGeometry = {
      gridWidth: 16,
      gridHeight: 11,
      gridSizePx: 64,
      offsetX: 0,
      offsetY: 0,
    };

    const baseTok: VttTokenModel = {
      id: 'tok-a',
      encounter_id: 'sc-gridless',
      character_id: null,
      owner_id: 'u-1',
      name: 'Scout',
      faction: 'ally',
      icon: 'dagger',
      color: '#38B29A',
      x: 2,
      y: 2,
      q: 2,
      r: 1,
      world_x: 160,
      world_y: 200,
      size: 1,
      current_hp: 10,
      max_hp: 10,
      current_sp: 5,
      max_sp: 5,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 1,
      shield_block: 0,
      shield_raised: false,
      move_feet: 25,
      vision_feet: 60,
      light_bright_feet: 15,
      light_dim_feet: 30,
      light_color: '#FF9B42',
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    };

    const targetTok: VttTokenModel = {
      ...baseTok,
      id: 'tok-b',
      name: 'Raider',
      faction: 'enemy',
      x: 2,
      y: 2,
      world_x: 160 + geom.gridSizePx * 3,
      world_y: 200,
      light_bright_feet: 0,
      light_dim_feet: 0,
    };

    expect(getTokenWorldCenter(baseTok, geom, 'gridless')).toEqual({
      x: 160,
      y: 200,
    });
    expect(getTokenWorldCenter(baseTok, geom, 'square')).toEqual(
      hexToWorldCenter({ col: 2, row: 2 }, geom)
    );

    expect(getTokenDistanceFeet(baseTok, targetTok, geom, 'gridless')).toBe(15);
    expect(getTokenDistanceFeet(baseTok, targetTok, geom, 'square')).toBe(0);

    const worldBounds = getHexWorldBounds(geom);
    const clamped = clampWorldPointToBounds({ x: -50, y: 99999 }, worldBounds);
    expect(clamped.x).toBeGreaterThan(0);
    expect(clamped.y).toBeLessThan(worldBounds.height);

    const blockingWall: VttWallSegment = {
      id: 'w-block',
      x1: 240,
      y1: 120,
      x2: 240,
      y2: 280,
      kind: 'wall',
    };
    const openDoor: VttWallSegment = {
      ...blockingWall,
      id: 'w-open-door',
      kind: 'door',
      open: true,
    };

    expect(
      isWorldSegmentBlockedByWalls(
        { x: 160, y: 200 },
        { x: 352, y: 200 },
        [blockingWall]
      )
    ).toBe(true);
    expect(
      isWorldSegmentBlockedByWalls(
        { x: 160, y: 200 },
        { x: 352, y: 200 },
        [openDoor]
      )
    ).toBe(false);

    const gridlessVisions = buildObserverVisions(
      [baseTok],
      [blockingWall],
      geom,
      false,
      1600,
      'gridless'
    );
    const gridlessLights = buildLightPolygons(
      [],
      [baseTok],
      [blockingWall],
      geom,
      'gridless'
    );

    expect(
      isWorldPointVisibleToObservers(
        { x: 200, y: 200 },
        gridlessVisions,
        gridlessLights,
        [blockingWall],
        false
      )
    ).toBe(true);
    expect(
      isWorldPointVisibleToObservers(
        { x: 300, y: 200 },
        gridlessVisions,
        gridlessLights,
        [blockingWall],
        false
      )
    ).toBe(false);
  });

  it('should auto-calculate full grid coverage from a single pixel Grid Size (100 px default) and provide 0.2 usable scene padding and 0.2 default grid opacity without shifting square tile alignment', () => {
    expect(DEFAULT_VTT_GRID_SIZE_PX).toBe(100);
    expect(DEFAULT_VTT_SCENE_PADDING).toBe(0.2);
    expect(DEFAULT_VTT_GRID_OPACITY).toBe(0.2);
    expect(DEFAULT_VTT_SCENE_WIDTH_PX).toBe(1600);
    expect(DEFAULT_VTT_SCENE_HEIGHT_PX).toBe(1100);
    expect(getHexStepPixels(100)).toBeCloseTo(100, 6);
    expect(feetToWorldPixels(5, 100)).toBeCloseTo(100, 6);

    const large4kLayout = computeSceneCanvasLayout({
      sceneWidthPx: 3840,
      sceneHeightPx: 2160,
      gridSizePx: 100,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });

    expect(large4kLayout.innerWidth).toBe(3840);
    expect(large4kLayout.innerHeight).toBe(2160);
    expect(large4kLayout.sceneX).toBeGreaterThanOrEqual(768);
    expect(large4kLayout.sceneY).toBeGreaterThanOrEqual(432);
    expect(large4kLayout.totalWidth).toBe(
      large4kLayout.innerWidth + large4kLayout.sceneX * 2
    );
    expect(large4kLayout.totalHeight).toBe(
      large4kLayout.innerHeight + large4kLayout.sceneY * 2
    );

    const hexBounds = getHexWorldBounds(large4kLayout.geometry);
    expect(hexBounds.width).toBeGreaterThanOrEqual(large4kLayout.totalWidth);
    expect(hexBounds.height).toBeGreaterThanOrEqual(large4kLayout.totalHeight);

    const stagedPaddingHex = worldPointToHex(
      { x: 180, y: 180 },
      large4kLayout.geometry
    );
    expect(stagedPaddingHex.col).toBeGreaterThanOrEqual(0);
    expect(stagedPaddingHex.row).toBeGreaterThanOrEqual(0);
    const stagedCenter = hexToWorldCenter(stagedPaddingHex, large4kLayout.geometry);
    expect(stagedCenter.x).toBeLessThan(large4kLayout.sceneX);
    expect(stagedCenter.y).toBeLessThan(large4kLayout.sceneY);

    const noPad = computeSceneCanvasLayout({
      sceneWidthPx: 2400,
      sceneHeightPx: 1800,
      gridSizePx: 100,
      padding: 0,
    });
    const defaultPad = computeSceneCanvasLayout({
      sceneWidthPx: 2400,
      sceneHeightPx: 1800,
      gridSizePx: 100,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });
    const maxPad = computeSceneCanvasLayout({
      sceneWidthPx: 2400,
      sceneHeightPx: 1800,
      gridSizePx: 100,
      padding: 0.5,
    });

    const localSamplePt = { x: 420, y: 310 };
    const hex0 = worldPointToHex(
      { x: noPad.sceneX + localSamplePt.x, y: noPad.sceneY + localSamplePt.y },
      noPad.geometry
    );
    const center0 = hexToWorldCenter(hex0, noPad.geometry);
    const rel0 = { x: center0.x - noPad.sceneX, y: center0.y - noPad.sceneY };

    const hex20 = worldPointToHex(
      {
        x: defaultPad.sceneX + localSamplePt.x,
        y: defaultPad.sceneY + localSamplePt.y,
      },
      defaultPad.geometry
    );
    const center20 = hexToWorldCenter(hex20, defaultPad.geometry);
    const rel20 = {
      x: center20.x - defaultPad.sceneX,
      y: center20.y - defaultPad.sceneY,
    };

    const hex50 = worldPointToHex(
      { x: maxPad.sceneX + localSamplePt.x, y: maxPad.sceneY + localSamplePt.y },
      maxPad.geometry
    );
    const center50 = hexToWorldCenter(hex50, maxPad.geometry);
    const rel50 = { x: center50.x - maxPad.sceneX, y: center50.y - maxPad.sceneY };

    expect(rel20.x).toBeCloseTo(rel0.x, 5);
    expect(rel20.y).toBeCloseTo(rel0.y, 5);
    expect(rel50.x).toBeCloseTo(rel0.x, 5);
    expect(rel50.y).toBeCloseTo(rel0.y, 5);

    const legacyAutoImage = computeSceneCanvasLayout({
      sceneWidthPx: null,
      sceneHeightPx: null,
      naturalImageWidth: 5000,
      naturalImageHeight: 3500,
      gridSizePx: 100,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });
    expect(legacyAutoImage.innerWidth).toBe(5000);
    expect(legacyAutoImage.innerHeight).toBe(3500);
    expect(legacyAutoImage.gridCols).toBe(70);
    expect(legacyAutoImage.gridRows).toBe(49);
  });

  it('should default V to Select, R to Measure, and Ctrl+Z to Undo, allow customizable hotkey rebinding with conflict swapping, and persist bindings', () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mot_vtt_hotkeys_v1');
    }

    const settings = TestBed.inject(VttSettingsStore);
    settings.resetAllHotkeys();

    expect(DEFAULT_VTT_HOTKEYS.tool_select).toBe('v');
    expect(DEFAULT_VTT_HOTKEYS.tool_ruler).toBe('r');
    expect(DEFAULT_VTT_HOTKEYS.undo).toBe('ctrl+z');
    expect(DEFAULT_VTT_HOTKEYS.delete_tokens).toBe('delete');
    expect(settings.badges().tool_select).toBe('V');
    expect(settings.badges().tool_ruler).toBe('R');
    expect(settings.badges().undo).toBe('Ctrl+Z');
    expect(settings.badges().delete_tokens).toBe('Del');

    const delEvent = new KeyboardEvent('keydown', {
      key: 'Delete',
      code: 'Delete',
    });
    expect(normalizeKeyComboFromEvent(delEvent)).toBe('delete');
    expect(matchesHotkey(delEvent, settings.hotkeys().delete_tokens)).toBe(true);

    const ctrlZEvent = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
    });
    expect(normalizeKeyComboFromEvent(ctrlZEvent)).toBe('ctrl+z');
    expect(matchesHotkey(ctrlZEvent, settings.hotkeys().undo)).toBe(true);

    const cmdZEvent = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      metaKey: true,
    });
    expect(matchesHotkey(cmdZEvent, 'ctrl+z')).toBe(true);

    const vEvent = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV' });
    expect(matchesHotkey(vEvent, settings.hotkeys().tool_select)).toBe(true);
    expect(matchesHotkey(vEvent, settings.hotkeys().tool_ruler)).toBe(false);

    const swapRes = settings.setHotkey('tool_select', 'r');
    expect(swapRes.applied).toBe(true);
    expect(swapRes.swappedWith).toBe('tool_ruler');
    expect(settings.hotkeys().tool_select).toBe('r');
    expect(settings.hotkeys().tool_ruler).toBe('v');

    const customUndoRes = settings.setHotkey('undo', 'ctrl+shift+z');
    expect(customUndoRes.applied).toBe(true);
    expect(formatHotkeyBadge(settings.hotkeys().undo)).toBe('Ctrl+Shift+Z');

    const reservedRes = settings.setHotkey('tool_pan', 'space');
    expect(reservedRes.applied).toBe(false);

    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('mot_vtt_hotkeys_v1');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).tool_select).toBe('r');
    }

    settings.resetAllHotkeys();
    expect(settings.hotkeys().tool_select).toBe('v');
    expect(settings.hotkeys().tool_ruler).toBe('r');
    expect(settings.hotkeys().undo).toBe('ctrl+z');
  });

  it('should record and undo chained token movement, AP expenditure, walls, and dynamic lights via Ctrl+Z undoLastAction', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'gm-1', email: 'gm@example.com' }),
            isAdmin: () => false,
            displayName: () => 'Warden',
          },
        },
        {
          provide: VttService,
          useValue: {
            updateScene: async () => ({ error: null, needsMigration: false }),
            updateToken: async () => null,
            insertToken: async (payload: Partial<VttTokenModel>) => ({
              token: { ...(payload as VttTokenModel), id: payload.id ?? 'tok-restored' },
              error: null,
            }),
            deleteToken: async () => null,
          },
        },
        {
          provide: CharacterService,
          useValue: {
            updateCharacterRecord: async () => ({ error: null }),
          },
        },
      ],
    });

    const vttStore = TestBed.inject(VttStore);
    vttStore.campaign.set({
      id: 'camp-1',
      gm_id: 'gm-1',
      name: 'Undo Test Campaign',
      cover_image_url: null,
      invite_code: 'UNDO01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const initLayout = computeSceneCanvasLayout({
      sceneWidthPx: 1600,
      sceneHeightPx: 1100,
      gridSizePx: 100,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });

    const scene: VttSceneModel = {
      id: 'scene-undo-1',
      campaign_id: 'camp-1',
      gm_id: 'gm-1',
      folder_id: null,
      name: 'Bastion Courtyard',
      is_active_scene: true,
      sort_order: 0,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: 1600,
      scene_height: 1100,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: initLayout.gridCols,
      grid_height: initLayout.gridRows,
      grid_size_px: 100,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      token_vision: true,
      fog_enabled: true,
      global_illumination: true,
      darkness_level: 0.85,
      combat_active: true,
      round_number: 1,
      active_turn_token_id: '11111111-1111-4111-8111-111111111111',
      initiative_order: ['11111111-1111-4111-8111-111111111111'],
      walls: [],
      lights: [],
      explored_fog: { cells: ['4,4'], revealed_all: false },
      pending_clash: null,
    };

    const token: VttTokenModel = {
      id: '11111111-1111-4111-8111-111111111111',
      encounter_id: 'scene-undo-1',
      character_id: null,
      owner_id: 'gm-1',
      name: 'Vanguard Kael',
      faction: 'ally',
      x: 4,
      y: 4,
      q: 4,
      r: 2,
      world_x: null,
      world_y: null,
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      current_hp: 16,
      max_hp: 16,
      current_sp: 10,
      max_sp: 10,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 2,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    };

    vttStore.scenes.set([scene]);
    vttStore.activeSceneId.set(scene.id);
    vttStore.tokens.set([token]);
    vttStore.enforceApOnMove.set(true);

    expect(vttStore.canUndo()).toBe(false);

    await vttStore.moveTokenToHex(token.id, 8, 6, 30, false, [
      { col: 5, row: 4 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
    ]);

    const afterMove = vttStore.tokens()[0];
    expect(afterMove.x).toBe(8);
    expect(afterMove.y).toBe(6);
    expect(afterMove.current_ap).toBe(2);
    expect(vttStore.canUndo()).toBe(true);
    expect(vttStore.nextUndoLabel()).toContain('Chained Move Vanguard Kael (30 ft)');

    await vttStore.addWallSegment({ x: 300, y: 300 }, { x: 500, y: 300 }, 'wall');
    expect(vttStore.activeScene()?.walls.length).toBe(1);

    await vttStore.addLightSource({ x: 600, y: 450 }, { bright_feet: 20, dim_feet: 40 });
    expect(vttStore.activeScene()?.lights.length).toBe(1);

    await vttStore.undoLastAction();
    expect(vttStore.activeScene()?.lights.length).toBe(0);

    await vttStore.undoLastAction();
    expect(vttStore.activeScene()?.walls.length).toBe(0);

    await vttStore.undoLastAction();
    const restoredToken = vttStore.tokens()[0];
    expect(restoredToken.x).toBe(4);
    expect(restoredToken.y).toBe(4);
    expect(restoredToken.current_ap).toBe(4);
    expect(vttStore.activeScene()?.explored_fog.cells).toEqual(['4,4']);
    expect(vttStore.canUndo()).toBe(false);
  });

  it('should open the Escape In-Game Menu with Admin Content Manager gating, persist general/audio settings, and expose Invite Links and Light Theme in the streamlined Settings tab', async () => {
    let adminFlag = false;
    const capturedScenes: Partial<VttSceneModel>[] = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'gm-1', email: 'gm@example.com' }),
            isAdmin: () => adminFlag,
            displayName: () => 'Warden',
          },
        },
        {
          provide: VttService,
          useValue: {
            createScene: async (input: Partial<VttSceneModel>) => {
              capturedScenes.push(input);
              return {
                scene: {
                  ...(input as VttSceneModel),
                  id: 'scene-created-1',
                  padding: input.padding ?? DEFAULT_VTT_SCENE_PADDING,
                  grid_opacity: input.grid_opacity ?? DEFAULT_VTT_GRID_OPACITY,
                  round_number: 1,
                  combat_active: false,
                  active_turn_token_id: null,
                  initiative_order: [],
                  token_vision: input.token_vision ?? true,
                  fog_enabled: true,
                  global_illumination: false,
                  darkness_level: 0.85,
                  walls: [],
                  lights: [],
                  explored_fog: { cells: [], revealed_all: false },
                  pending_clash: null,
                },
                error: null,
                needsMigration: false,
              };
            },
            updateScene: async () => ({ error: null, needsMigration: false }),
            fetchSceneTokens: async () => [],
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mot_vtt_preferences_v1');
    }

    const settingsStore = TestBed.inject(VttSettingsStore);
    settingsStore.resetPreferences();
    expect(settingsStore.preferences()).toEqual(DEFAULT_VTT_PREFERENCES);

    settingsStore.updatePreferences({
      masterVolume: 45,
      muteAudio: true,
      diceSounds: false,
      showHotkeyBadges: false,
    });
    expect(settingsStore.preferences().masterVolume).toBe(45);
    expect(settingsStore.preferences().muteAudio).toBe(true);
    expect(settingsStore.preferences().diceSounds).toBe(false);
    expect(settingsStore.preferences().showHotkeyBadges).toBe(false);

    if (typeof localStorage !== 'undefined') {
      const savedPrefs = JSON.parse(
        localStorage.getItem('mot_vtt_preferences_v1') || '{}'
      );
      expect(savedPrefs.masterVolume).toBe(45);
      expect(savedPrefs.muteAudio).toBe(true);
    }

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-streamlined',
      gm_id: 'gm-1',
      name: 'Ironbastion Chronicle',
      cover_image_url: null,
      invite_code: 'JOIN77',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const createdScene = await vttStore.createBlankMap({
      name: 'Watchtower Roof',
      activateForParty: true,
    });
    expect(createdScene).toBeTruthy();
    expect(capturedScenes[0]?.padding).toBe(0.2);
    expect(capturedScenes[0]?.grid_opacity).toBe(0.2);

    const router = TestBed.inject(Router);
    const themeStore = TestBed.inject(ThemeStore);
    const navCalls: unknown[][] = [];
    router.navigate = (async (commands: unknown[]) => {
      navCalls.push(commands);
      return true;
    }) as typeof router.navigate;

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.inGameMenuOpen()).toBe(false);
    expect(comp.campaignInviteLink()).toContain('/dashboard?invite=JOIN77');

    comp.openCreateMapModal(null);
    expect(comp.createMapModal()).toBeTruthy();

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    expect(comp.createMapModal()).toBeNull();
    expect(comp.inGameMenuOpen()).toBe(false);

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    expect(comp.inGameMenuOpen()).toBe(true);
    fixture.detectChanges();

    const nonAdminMenuText =
      (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(nonAdminMenuText).toContain('Resume Game');
    expect(nonAdminMenuText).toContain('Reload Application');
    expect(nonAdminMenuText).toContain('Return to Main Menu');
    expect(nonAdminMenuText).not.toContain('Open Content Manager');

    comp.openContentManager();
    expect(navCalls.length).toBe(0);

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    expect(comp.inGameMenuOpen()).toBe(false);

    adminFlag = true;
    comp.openInGameMenu();
    fixture.detectChanges();
    const adminMenuText =
      (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(adminMenuText).toContain('Open Content Manager');

    comp.openContentManager();
    expect(navCalls[navCalls.length - 1]).toEqual(['/content-manager']);
    expect(comp.inGameMenuOpen()).toBe(false);

    comp.sidebarTab.set('settings');
    comp.setVttThemeMode('light');
    fixture.detectChanges();
    expect(themeStore.vttTheme()).toBe('light');

    const settingsTabText =
      (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(settingsTabText).toContain('General Settings');
    expect(settingsTabText).toContain('Controls & Hotkeys');
    expect(settingsTabText).toContain('Invitation Links');
    expect(settingsTabText).toContain('Light Theme');

    comp.openSettingsModal('general');
    fixture.detectChanges();
    expect(comp.activeSettingsModal()).toBe('general');
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
      'Audio & Sound Cues'
    );

    comp.openSettingsModal('controls');
    fixture.detectChanges();
    expect(comp.activeSettingsModal()).toBe('controls');
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
      'Customizable Keyboard Shortcuts'
    );

    comp.openSettingsModal('invites');
    fixture.detectChanges();
    expect(comp.activeSettingsModal()).toBe('invites');
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').toContain(
      'Shareable Invite Link'
    );

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    expect(comp.activeSettingsModal()).toBeNull();
    expect(comp.inGameMenuOpen()).toBe(false);

    comp.returnToMainMenu();
    expect(navCalls[navCalls.length - 1]).toEqual(['/dashboard']);
  });

  it('should parse /content-manager/collections and manage Collections folders, from-scratch actors, and imported characters', async () => {
    expect(parseContentManagerUrl('/content-manager/collections')).toEqual({
      tab: 'collections',
      treeId: null,
    });

    let folderCounter = 0;
    let actorCounter = 0;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'col-user-1', email: 'warden@example.com' }),
            isAdmin: () => true,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            ensureLoaded: async () => undefined,
            loadCompendium: async () => undefined,
            allWeapons: () => [],
            allPerkNodes: () => [],
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({ data: [], error: null }),
          },
        },
        {
          provide: CollectionsService,
          useValue: {
            fetchFolders: async () => ({ folders: [], error: null }),
            fetchActors: async () => ({ actors: [], error: null }),
            createFolder: async (input: Record<string, unknown>) => ({
              folder: {
                id: `col-folder-${++folderCounter}`,
                owner_id: String(input['owner_id']),
                parent_folder_id:
                  (input['parent_folder_id'] as string | null) ?? null,
                name: String(input['name']),
                color: (input['color'] as string | null) ?? null,
                sort_order: Number(input['sort_order'] ?? 0),
              },
              error: null,
            }),
            updateFolder: async () => ({ error: null }),
            deleteFolder: async () => ({ error: null }),
            createActor: async (input: Record<string, unknown>) => ({
              actor: {
                ...(input as object),
                id: `col-actor-${++actorCounter}`,
              },
              error: null,
            }),
            updateActor: async () => ({ error: null }),
            deleteActor: async () => ({ error: null }),
          },
        },
      ],
    });

    const colStore = TestBed.inject(CollectionsStore);
    const bossesFolder = await colStore.createFolder('Act II Bosses', '#C4491A');
    expect(bossesFolder).toBeTruthy();
    expect(colStore.folders().length).toBe(1);

    const scratchBoss = await colStore.createActorFromScratch({
      folder_id: bossesFolder!.id,
      source_character_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Warden Malakor',
      faction: 'enemy',
      size: 1,
      icon: 'battleaxe',
      color: '#EF4444',
      max_hp: 28,
      max_sp: 14,
      max_ap: 4,
      armor_dr: 3,
      shield_block: 2,
      move_feet: 25,
      vision_feet: 60,
      light_bright_feet: 15,
      light_dim_feet: 30,
      light_color: '#F59E0B',
      npc_stats: {
        weapon_name: 'Cinder Cleaver',
        attack_ap: 1,
        attack_mod: 6,
        flat_damage: 7,
        reach_feet: 10,
        combat_tag: 'Crushing',
      },
      notes: 'Commands the Iron Vault.',
    });
    expect(scratchBoss?.name).toBe('Warden Malakor');
    expect(scratchBoss?.folder_id).toBe(bossesFolder!.id);

    const heroChar: CharacterModel = {
      id: 'char-hero-1',
      owner_id: 'col-user-1',
      name: 'Seraphina Vale',
      level: 3,
      attributes: {
        Brawn: 1,
        Agility: 3,
        Technique: 2,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 2,
        Dodge: 2,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 2,
        Tinkering: 0,
        Medicine: 1,
        Survival: 1,
        Resolve: 1,
        Perception: 2,
        Sway: 1,
        Lore: 1,
      },
      equipped_armor: 'Light',
      equipped_shield: 'Buckler',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 14,
      current_sp: 9,
      current_ap: 4,
      active_cooldowns: {},
    };

    const template = buildActorTemplateFromCharacter(heroChar, [], [], bossesFolder!.id);
    expect(template.name).toBe('Seraphina Vale');
    expect(template.actor_kind).toBe('character');
    expect(template.is_unique).toBe(true);
    expect(template.source_character_id).toBe('char-hero-1');

    const imported = await colStore.importCharacterToCollection(
      heroChar,
      bossesFolder!.id
    );
    expect(imported?.name).toBe('Seraphina Vale');
    expect(colStore.actors().length).toBe(2);

    await colStore.deleteFolder(bossesFolder!.id);
    expect(colStore.folders().length).toBe(0);
    expect(colStore.actors().every((a) => a.folder_id === null)).toBe(true);
  });

  it('should support Campaign Roster folders, drag-drop deployment, Shift-unsnapped RP token movement on square grids, snap-back, and Ctrl+Z undo', async () => {
    let rosterSeq = 0;
    let tokenSeq = 0;
    let folderSeq = 0;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'gm-1', email: 'gm@example.com' }),
            isAdmin: () => false,
            displayName: () => 'Warden',
          },
        },
        {
          provide: VttService,
          useValue: {
            updateScene: async () => ({ error: null, needsMigration: false }),
            createFolder: async (input: Partial<VttFolderModel>) => ({
              folder: {
                id: `roster-folder-${++folderSeq}`,
                campaign_id: String(input.campaign_id ?? 'camp-1'),
                scope: input.scope ?? 'characters',
                parent_folder_id: input.parent_folder_id ?? null,
                name: String(input.name ?? 'Folder'),
                color: input.color ?? '#C4491A',
                sort_order: input.sort_order ?? 0,
              },
              error: null,
              needsMigration: false,
            }),
            updateFolder: async () => null,
            deleteFolder: async () => null,
            createRosterActor: async (input: Partial<VttRosterActorModel>) => ({
              actor: {
                ...(input as VttRosterActorModel),
                id: `roster-actor-${++rosterSeq}`,
              },
              error: null,
            }),
            updateRosterActor: async () => null,
            deleteRosterActor: async () => null,
            insertToken: async (payload: Partial<VttTokenModel>) => ({
              token: {
                ...(payload as VttTokenModel),
                id: payload.id ?? `tok-rp-${++tokenSeq}`,
              },
              error: null,
            }),
            updateToken: async () => null,
            deleteToken: async () => null,
            insertLog: async () => null,
          },
        },
        {
          provide: CharacterService,
          useValue: {
            updateCharacterRecord: async () => ({ error: null }),
          },
        },
      ],
    });

    const vttStore = TestBed.inject(VttStore);
    vttStore.campaign.set({
      id: 'camp-roster-1',
      gm_id: 'gm-1',
      name: 'Roster & Shift Drag Test',
      cover_image_url: null,
      invite_code: 'ROST01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const layout = computeSceneCanvasLayout({
      sceneWidthPx: 1600,
      sceneHeightPx: 1100,
      gridSizePx: 100,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });

    const squareScene: VttSceneModel = {
      id: 'scene-rp-square',
      campaign_id: 'camp-roster-1',
      gm_id: 'gm-1',
      folder_id: null,
      name: 'Tavern Hearth',
      is_active_scene: true,
      sort_order: 0,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: 1600,
      scene_height: 1100,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: layout.gridCols,
      grid_height: layout.gridRows,
      grid_size_px: 100,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      token_vision: true,
      fog_enabled: false,
      global_illumination: true,
      darkness_level: 0,
      combat_active: false,
      round_number: 1,
      active_turn_token_id: null,
      initiative_order: [],
      walls: [],
      lights: [],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
    };

    vttStore.scenes.set([squareScene]);
    vttStore.activeSceneId.set(squareScene.id);

    await vttStore.createDirectoryFolder({
      scope: 'characters',
      name: 'Tavern Patrons',
      color: '#38B29A',
    });
    const patronsFolder = vttStore.folders().find((f) => f.scope === 'characters');
    expect(patronsFolder).toBeTruthy();

    const patron = await vttStore.createRosterActorFromScratch({
      folder_id: patronsFolder!.id,
      source_character_id: null,
      actor_kind: 'character',
      is_unique: true,
      name: 'Innkeeper Bram',
      faction: 'neutral',
      size: 1,
      icon: 'chalice',
      color: '#F59E0B',
      max_hp: 12,
      max_sp: 6,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {
        weapon_name: 'Oak Cudgel',
        attack_ap: 1,
        attack_mod: 2,
        flat_damage: 3,
        reach_feet: 5,
        combat_tag: 'None',
      },
      notes: 'Tends the hearth.',
    });
    expect(patron).toBeTruthy();
    expect(patron!.folder_id).toBe(patronsFolder!.id);

    const tree = buildDirectoryTree(vttStore.folders(), vttStore.rosterActors(), {
      scope: 'characters',
      getItemFolderId: (a) => a.folder_id,
      getItemName: (a) => a.name,
    });
    expect(tree.folders.length).toBe(1);
    expect(tree.folders[0].items.length).toBe(1);
    expect(tree.folders[0].items[0].name).toBe('Innkeeper Bram');

    await vttStore.dropActorAtWorldPoint(
      {
        kind: 'roster-actor',
        actorId: patron!.id,
        name: patron!.name,
        icon: patron!.icon,
        color: patron!.color,
        faction: patron!.faction,
        isUnique: true,
      },
      { x: 523, y: 417 },
      true
    );

    expect(vttStore.sceneTokens().length).toBe(1);
    const rpToken = vttStore.sceneTokens()[0];
    expect(rpToken.world_x).toBe(523);
    expect(rpToken.world_y).toBe(417);
    expect(rpToken.npc_stats?.__unsnapped).toBe(true);

    const rpCenter = getTokenWorldCenter(rpToken, layout.geometry, 'square');
    expect(rpCenter).toEqual({ x: 523, y: 417 });

    await vttStore.moveTokenToHex(rpToken.id, 6, 5, 10, false);
    const snappedToken = vttStore.sceneTokens()[0];
    expect(snappedToken.x).toBe(6);
    expect(snappedToken.y).toBe(5);
    expect(snappedToken.world_x).toBeNull();
    expect(snappedToken.world_y).toBeNull();
    expect(snappedToken.npc_stats?.__unsnapped).toBe(false);
    expect(getTokenWorldCenter(snappedToken, layout.geometry, 'square')).toEqual(
      hexToWorldCenter({ col: 6, row: 5 }, layout.geometry)
    );

    await vttStore.moveTokenToWorldPoint(snappedToken.id, { x: 678, y: 534 }, 5, false);
    const shiftedToken = vttStore.sceneTokens()[0];
    expect(shiftedToken.world_x).toBe(678);
    expect(shiftedToken.world_y).toBe(534);
    expect(shiftedToken.npc_stats?.__unsnapped).toBe(true);
    expect(getTokenWorldCenter(shiftedToken, layout.geometry, 'square')).toEqual({
      x: 678,
      y: 534,
    });

    const otherToken: VttTokenModel = {
      ...snappedToken,
      id: 'tok-other-rp',
      x: 8,
      y: 5,
      world_x: 878,
      world_y: 534,
      npc_stats: { __unsnapped: true },
    };
    expect(
      getTokenDistanceFeet(shiftedToken, otherToken, layout.geometry, 'square')
    ).toBe(10);

    await vttStore.undoLastAction();
    const afterUndoShift = vttStore.sceneTokens()[0];
    expect(afterUndoShift.x).toBe(6);
    expect(afterUndoShift.y).toBe(5);
    expect(afterUndoShift.world_x).toBeNull();
    expect(afterUndoShift.npc_stats?.__unsnapped).toBe(false);

    await vttStore.undoLastAction();
    const afterUndoSnap = vttStore.sceneTokens()[0];
    expect(afterUndoSnap.world_x).toBe(523);
    expect(afterUndoSnap.world_y).toBe(417);
    expect(afterUndoSnap.npc_stats?.__unsnapped).toBe(true);

    await vttStore.deleteDirectoryFolder(patronsFolder!.id);
    expect(vttStore.folders().filter((f) => f.scope === 'characters').length).toBe(0);
    expect(vttStore.rosterActors()[0].folder_id).toBeNull();
  });

  it('should support full HSV spectrum, hex input, and arbitrary custom folder colors via ColorPickerComponent', async () => {
    expect(isValidHexColor('#4F9DA6')).toBe(true);
    expect(isValidHexColor('4f9da6')).toBe(true);
    expect(isValidHexColor('#3af')).toBe(true);
    expect(isValidHexColor('#ZZZZZZ')).toBe(false);

    expect(normalizeHexColor('#3af')).toBe('#33AAFF');
    expect(normalizeHexColor('ff6b4a')).toBe('#FF6B4A');

    const hsv = hexToHsv('#38B29A');
    expect(hsv.h).toBeGreaterThan(160);
    expect(hsv.h).toBeLessThan(175);
    expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe('#38B29A');

    await TestBed.configureTestingModule({
      imports: [ColorPickerComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ColorPickerComponent);
    const emitted: string[] = [];
    fixture.componentInstance.colorChange.subscribe((val) => emitted.push(val));
    fixture.componentRef.setInput('color', '#C4491A');
    fixture.componentRef.setInput('presets', ['#C4491A', '#38B29A']);
    fixture.componentRef.setInput('mode', 'inline');
    fixture.detectChanges();

    fixture.componentInstance.onHexFocus();
    fixture.componentInstance.onHexInput('#5B8DEE');
    fixture.componentInstance.commitHexDraft();
    fixture.detectChanges();

    expect(emitted[emitted.length - 1]).toBe('#5B8DEE');

    fixture.componentInstance.onHexFocus();
    fixture.componentInstance.onHexInput('#9c3');
    fixture.componentInstance.commitHexDraft();
    fixture.detectChanges();

    expect(emitted[emitted.length - 1]).toBe('#99CC33');
  });

  it('should provision per-user Supabase asset folders, route map vs character uploads to configured folders, and allow reusing scene images', async () => {
    let folderSeq = 0;
    let assetSeq = 0;
    const savedFolders: UserAssetFolderModel[] = [];
    const savedAssets: UserAssetModel[] = [];
    let savedPrefs: UserAssetPreferencesModel = {
      owner_id: 'user-warden-42',
      maps_folder_id: null,
      characters_folder_id: null,
    };
    const uploadedStoragePaths: string[] = [];

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mot-user-assets-bootstrapped-v1-user-warden-42');
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({ id: 'user-warden-42', email: 'warden@example.com' }),
            handle: () => 'warden',
            displayName: () => 'Warden',
            isAdmin: () => false,
          },
        },
        {
          provide: UserAssetsService,
          useValue: {
            hasBootstrappedStarterFolders: () => savedFolders.length > 0,
            markStarterFoldersBootstrapped: () => undefined,
            fetchFolders: async () => ({ folders: [...savedFolders], error: null }),
            fetchAssets: async () => ({ assets: [...savedAssets], error: null }),
            fetchPreferences: async () => ({ ...savedPrefs }),
            savePreferences: async (prefs: UserAssetPreferencesModel) => {
              savedPrefs = { ...prefs };
              return null;
            },
            createFolder: async (
              input: Omit<UserAssetFolderModel, 'id' | 'created_at'>
            ) => {
              const created: UserAssetFolderModel = {
                ...input,
                id: `uaf-${++folderSeq}`,
                created_at: new Date().toISOString(),
              };
              savedFolders.push(created);
              return { folder: created, error: null };
            },
            updateFolder: async (
              _ownerId: string,
              folderId: string,
              patch: Partial<UserAssetFolderModel>
            ) => {
              const idx = savedFolders.findIndex((f) => f.id === folderId);
              if (idx >= 0) {
                savedFolders[idx] = { ...savedFolders[idx], ...patch };
              }
              return null;
            },
            deleteFolder: async (_ownerId: string, folderId: string) => {
              const idx = savedFolders.findIndex((f) => f.id === folderId);
              if (idx >= 0) savedFolders.splice(idx, 1);
              return null;
            },
            uploadFileToStorage: async (storagePrefix: string, file: File) => {
              const storagePath = `${storagePrefix}/${file.name}`;
              uploadedStoragePaths.push(storagePath);
              return {
                url: `https://cdn.example.com/storage/v1/object/public/user-assets/${storagePath}`,
                bucket: 'user-assets',
                storagePath,
                error: null,
              };
            },
            probeFileImageDimensions: async () => ({
              width: 2400,
              height: 1600,
            }),
            probeUrlImageDimensions: async () => ({
              width: 1920,
              height: 1080,
            }),
            createAssetRecord: async (
              input: Omit<UserAssetModel, 'id' | 'created_at'>
            ) => {
              const created: UserAssetModel = {
                ...input,
                id: `ua-${++assetSeq}`,
                created_at: new Date().toISOString(),
              };
              savedAssets.unshift(created);
              return { asset: created, error: null };
            },
            updateAssetRecord: async (
              _ownerId: string,
              assetId: string,
              patch: Partial<UserAssetModel>
            ) => {
              const idx = savedAssets.findIndex((a) => a.id === assetId);
              if (idx >= 0) {
                savedAssets[idx] = { ...savedAssets[idx], ...patch };
              }
              return null;
            },
            deleteAssetRecord: async (_ownerId: string, asset: UserAssetModel) => {
              const idx = savedAssets.findIndex((a) => a.id === asset.id);
              if (idx >= 0) savedAssets.splice(idx, 1);
              return null;
            },
          },
        },
        {
          provide: VttService,
          useValue: {
            updateScene: async () => ({ error: null, needsMigration: false }),
          },
        },
      ],
    });

    const userAssetsStore = TestBed.inject(UserAssetsStore);
    const vttStore = TestBed.inject(VttStore);

    await userAssetsStore.ensureLoaded();
    expect(userAssetsStore.folders().length).toBe(2);
    const mapsRoot = userAssetsStore.folders().find((f) => f.slug === 'maps')!;
    const charsRoot = userAssetsStore
      .folders()
      .find((f) => f.slug === 'characters')!;
    expect(mapsRoot).toBeTruthy();
    expect(charsRoot).toBeTruthy();
    expect(userAssetsStore.effectiveMapsFolderId()).toBe(mapsRoot.id);
    expect(userAssetsStore.effectiveCharactersFolderId()).toBe(charsRoot.id);

    const dungeonsFolder = await userAssetsStore.createFolder(
      'Dungeons',
      mapsRoot.id,
      '#8B5CF6'
    );
    expect(dungeonsFolder).toBeTruthy();
    expect(
      buildUserStorageFolderPrefix(
        'user-warden-42',
        dungeonsFolder!.id,
        userAssetsStore.folders()
      )
    ).toBe('user-warden-42/maps/dungeons');

    await userAssetsStore.setDefaultFolder('maps', dungeonsFolder!.id);
    expect(userAssetsStore.effectiveMapsFolderId()).toBe(dungeonsFolder!.id);
    expect(
      userAssetsStore.getFolderTrailLabel(userAssetsStore.effectiveMapsFolderId())
    ).toBe('@warden / Maps / Dungeons');

    vttStore.campaign.set({
      id: 'camp-assets-1',
      gm_id: 'user-warden-42',
      name: 'Asset Reuse Test',
      cover_image_url: null,
      invite_code: 'ASSET1',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const mapFile = new File(['mock-png-bytes'], 'sunken-reliquary.png', {
      type: 'image/png',
    });
    const uploadedMapUrl = await vttStore.uploadMapFile(mapFile);
    expect(uploadedMapUrl).toBe(
      'https://cdn.example.com/storage/v1/object/public/user-assets/user-warden-42/maps/dungeons/sunken-reliquary.png'
    );
    expect(uploadedStoragePaths[0]).toBe(
      'user-warden-42/maps/dungeons/sunken-reliquary.png'
    );

    const locatedAsset = userAssetsStore.findAssetByUrl(uploadedMapUrl);
    expect(locatedAsset).toBeTruthy();
    expect(locatedAsset!.folder_id).toBe(dungeonsFolder!.id);
    expect(locatedAsset!.width).toBe(2400);
    expect(locatedAsset!.height).toBe(1600);

    const charFile = new File(['mock-portrait'], 'valen-token.webp', {
      type: 'image/webp',
    });
    const uploadedCharAsset = await userAssetsStore.uploadAssetFile(charFile, {
      purpose: 'characters',
    });
    expect(uploadedCharAsset).toBeTruthy();
    expect(uploadedCharAsset!.folder_id).toBe(charsRoot.id);
    expect(uploadedCharAsset!.storage_path).toBe(
      'user-warden-42/characters/valen-token.webp'
    );
  });

  it('should organize Scene Configuration into General, Grid, and Visibility tabs, default Token Vision on, restrict visibility to controlled tokens, illuminate full LoS with Global Illumination, and reveal the entire scene when Token Vision is disabled', async () => {
    const activeUserSig = signal({ id: 'gm-1', email: 'gm-1@example.com' });
    const capturedPatches: Partial<VttSceneModel>[] = [];
    const createdPayloads: Partial<VttSceneModel>[] = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent, VttCanvasComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: activeUserSig,
            handle: () => activeUserSig().id,
            displayName: () =>
              activeUserSig().id === 'gm-1' ? 'Warden' : 'Player One',
            isAdmin: () => false,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            effectiveMapsFolderId: () => null,
            effectiveCharactersFolderId: () => null,
            getFolderTrailLabel: () => '@gm-1 / Maps',
            assets: () => [],
            folders: () => [],
          },
        },
        {
          provide: VttService,
          useValue: {
            createScene: async (input: Partial<VttSceneModel>) => {
              createdPayloads.push(input);
              return {
                scene: {
                  id: 'scene-vis-1',
                  campaign_id: input.campaign_id ?? 'camp-vis-1',
                  gm_id: input.gm_id ?? 'gm-1',
                  folder_id: input.folder_id ?? null,
                  name: input.name ?? 'Sunken Sanctum',
                  is_active_scene: true,
                  map_image_url: null,
                  background_color: DEFAULT_VTT_BG_COLOR,
                  grid_mode: 'square',
                  scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
                  scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
                  padding: DEFAULT_VTT_SCENE_PADDING,
                  grid_width: input.grid_width ?? DEFAULT_VTT_GRID_WIDTH,
                  grid_height: input.grid_height ?? DEFAULT_VTT_GRID_HEIGHT,
                  grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
                  grid_offset_x: 0,
                  grid_offset_y: 0,
                  grid_opacity: DEFAULT_VTT_GRID_OPACITY,
                  sort_order: 0,
                  round_number: 1,
                  combat_active: false,
                  active_turn_token_id: null,
                  initiative_order: [],
                  token_vision: input.token_vision ?? true,
                  fog_enabled: input.fog_enabled ?? true,
                  global_illumination: input.global_illumination ?? false,
                  darkness_level: input.darkness_level ?? 0.85,
                  walls: [],
                  lights: [],
                  explored_fog: { cells: [], revealed_all: false },
                  pending_clash: null,
                },
                error: null,
                needsMigration: false,
              };
            },
            updateScene: async (_id: string, patch: Partial<VttSceneModel>) => {
              capturedPatches.push(patch);
              return { error: null, needsMigration: false };
            },
            fetchSceneTokens: async () => [],
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-vis-1',
      gm_id: 'gm-1',
      name: 'Sanctum Expedition',
      cover_image_url: null,
      invite_code: 'VIS101',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const created = await vttStore.createBlankMap({
      name: 'Sunken Sanctum',
      activateForParty: true,
    });
    expect(created).toBeTruthy();
    expect(createdPayloads[0]?.token_vision).toBe(true);
    expect(createdPayloads[0]?.global_illumination).toBe(false);
    expect(vttStore.activeScene()?.token_vision).toBe(true);
    expect(vttStore.activeScene()?.global_illumination).toBe(false);

    const roomFixture = TestBed.createComponent(VttRoomComponent);
    const roomComp = roomFixture.componentInstance;
    roomFixture.detectChanges();

    roomComp.openEditMapModal('scene-vis-1');
    roomFixture.detectChanges();
    expect(roomComp.editMapTab()).toBe('general');
    const generalText = (roomFixture.nativeElement as HTMLElement).textContent ?? '';
    expect(generalText).toContain('General');
    expect(generalText).toContain('Grid');
    expect(generalText).toContain('Visibility');
    expect(generalText).toContain('Scene Name');
    expect(generalText).toContain('Blank Scene / Backdrop Color');

    roomComp.editMapTab.set('grid');
    roomFixture.detectChanges();
    const gridText = (roomFixture.nativeElement as HTMLElement).textContent ?? '';
    expect(gridText).toContain('Grid Type & Scale');
    expect(gridText).toContain('Grid Size (Pixels)');
    expect(gridText).toContain('Scene Dimensions (px)');
    expect(gridText).toContain('Padding Percentage');

    roomComp.editMapTab.set('visibility');
    roomFixture.detectChanges();
    const visText = (roomFixture.nativeElement as HTMLElement).textContent ?? '';
    expect(visText).toContain('Token Vision');
    expect(visText).toContain(
      'Restricts visibility within the scene to the vision of controlled Tokens. If disabled, the entire scene is visible.'
    );
    expect(visText).toContain('Global Illumination');
    expect(visText).toContain(
      'The scene contains a global source of light that provides all areas of the Scene with a base level of illumination.'
    );
    expect(roomComp.editingMapDraft()?.token_vision).toBe(true);
    expect(roomComp.editingMapDraft()?.global_illumination).toBe(false);

    roomComp.updateEditMapField('global_illumination', true);
    roomComp.updateEditMapField('darkness_level', 0.65);
    await roomComp.saveEditMapModal();
    expect(vttStore.activeScene()?.global_illumination).toBe(true);
    expect(vttStore.activeScene()?.darkness_level).toBe(0.65);
    expect(capturedPatches[capturedPatches.length - 1]?.token_vision).toBe(true);
    expect(capturedPatches[capturedPatches.length - 1]?.global_illumination).toBe(
      true
    );

    await vttStore.patchScene('scene-vis-1', {
      token_vision: true,
      global_illumination: false,
      fog_enabled: true,
      explored_fog: { cells: [], revealed_all: false },
    });

    const geom = vttStore.gridGeometry();
    const wallBetween8And10 = hexToWorldCenter({ col: 9, row: 4 }, geom);
    const closedWall: VttWallSegment = {
      id: 'wall-crypt-divider',
      x1: wallBetween8And10.x,
      y1: wallBetween8And10.y - 300,
      x2: wallBetween8And10.x,
      y2: wallBetween8And10.y + 300,
      kind: 'wall',
    };
    const closedDoorFar: VttWallSegment = {
      id: 'door-crypt-far',
      x1: wallBetween8And10.x,
      y1: wallBetween8And10.y + 400,
      x2: wallBetween8And10.x,
      y2: wallBetween8And10.y + 500,
      kind: 'door',
      open: false,
    };
    await vttStore.patchScene('scene-vis-1', {
      walls: [closedWall, closedDoorFar],
    });

    const controlledHero: VttTokenModel = {
      id: 'tok-player-hero',
      encounter_id: 'scene-vis-1',
      character_id: null,
      owner_id: 'player-1',
      name: 'Vanguard Lyra',
      faction: 'ally',
      x: 2,
      y: 4,
      q: 2,
      r: 2,
      world_x: null,
      world_y: null,
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      current_hp: 16,
      max_hp: 16,
      current_sp: 10,
      max_sp: 10,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 15,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    };

    const closeEnemy: VttTokenModel = {
      ...controlledHero,
      id: 'tok-enemy-close',
      owner_id: null,
      name: 'Near Ghoul',
      faction: 'enemy',
      x: 4,
      y: 4,
    };

    const distantUnblockedEnemy: VttTokenModel = {
      ...controlledHero,
      id: 'tok-enemy-distant',
      owner_id: null,
      name: 'Distant Archer',
      faction: 'enemy',
      x: 7,
      y: 4,
    };

    const wallBlockedEnemy: VttTokenModel = {
      ...controlledHero,
      id: 'tok-enemy-behind-wall',
      owner_id: null,
      name: 'Vault Warden',
      faction: 'enemy',
      x: 11,
      y: 4,
    };

    const gmHiddenEnemy: VttTokenModel = {
      ...controlledHero,
      id: 'tok-enemy-gm-hidden',
      owner_id: null,
      name: 'Lurking Wraith',
      faction: 'enemy',
      x: 3,
      y: 4,
      is_hidden: true,
    };

    vttStore.tokens.set([
      closeEnemy,
      distantUnblockedEnemy,
      wallBlockedEnemy,
      gmHiddenEnemy,
    ]);

    const canvasFixture = TestBed.createComponent(VttCanvasComponent);
    const canvasComp = canvasFixture.componentInstance;

    activeUserSig.set({ id: 'player-1', email: 'player-1@example.com' });
    expect(vttStore.isGm()).toBe(false);
    expect(vttStore.observerTokens().length).toBe(0);
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([]);
    expect(canvasComp.visibleDoorHandles().length).toBe(0);

    vttStore.tokens.set([
      controlledHero,
      closeEnemy,
      distantUnblockedEnemy,
      wallBlockedEnemy,
      gmHiddenEnemy,
    ]);
    expect(vttStore.observerTokens().map((o) => o.id)).toEqual(['tok-player-hero']);
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([
      'tok-player-hero',
      'tok-enemy-close',
    ]);

    activeUserSig.set({ id: 'gm-1', email: 'gm-1@example.com' });
    await vttStore.toggleSceneBooleanField('global_illumination');
    expect(vttStore.activeScene()?.global_illumination).toBe(true);

    activeUserSig.set({ id: 'player-1', email: 'player-1@example.com' });
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([
      'tok-player-hero',
      'tok-enemy-close',
      'tok-enemy-distant',
    ]);
    expect(canvasComp.visibleDoorHandles().map((d) => d.wall.id)).toEqual([
      'door-crypt-far',
    ]);

    vttStore.tokens.set([
      closeEnemy,
      distantUnblockedEnemy,
      wallBlockedEnemy,
      gmHiddenEnemy,
    ]);
    expect(canvasComp.renderableTokens().length).toBe(0);

    activeUserSig.set({ id: 'gm-1', email: 'gm-1@example.com' });
    await vttStore.toggleSceneBooleanField('token_vision');
    expect(vttStore.activeScene()?.token_vision).toBe(false);

    activeUserSig.set({ id: 'player-1', email: 'player-1@example.com' });
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([
      'tok-enemy-close',
      'tok-enemy-distant',
      'tok-enemy-behind-wall',
    ]);
    expect(canvasComp.visibleDoorHandles().map((d) => d.wall.id)).toEqual([
      'door-crypt-far',
    ]);
  });

  it('should support configurable token travel speed (including 0 for instant), deploy tokens without entered-the-battlefield logs, and delete individual or all chat logs', async () => {
    const activeUserSig = signal({ id: 'gm-1', email: 'gm-1@example.com' });
    const insertedLogs: Omit<VttLogEntry, 'id' | 'created_at'>[] = [];
    const deletedLogIds: string[] = [];
    const clearedCampaignIds: string[] = [];
    let spawnSeq = 0;

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mot_vtt_preferences_v1');
    }

    expect(
      createTokenTravelAnimation(
        [
          { x: 0, y: 0 },
          { x: 280, y: 0 },
        ],
        0,
        70,
        1000
      )
    ).toBeNull();

    const lPathAnim = createTokenTravelAnimation(
      [
        { x: 0, y: 0 },
        { x: 280, y: 0 },
        { x: 280, y: 280 },
      ],
      30,
      70,
      1000
    );
    expect(lPathAnim).toBeTruthy();
    expect(lPathAnim!.totalLengthPx).toBe(560);
    expect(lPathAnim!.durationMs).toBeCloseTo((560 / 420) * 1000, 1);

    const midLeg1 = sampleTokenTravelAnimation(
      lPathAnim!,
      1000 + lPathAnim!.durationMs * 0.25
    );
    expect(midLeg1.done).toBe(false);
    expect(midLeg1.point.x).toBeCloseTo(140, 1);
    expect(midLeg1.point.y).toBeCloseTo(0, 1);

    const cornerSample = sampleTokenTravelAnimation(
      lPathAnim!,
      1000 + lPathAnim!.durationMs * 0.5
    );
    expect(cornerSample.done).toBe(false);
    expect(cornerSample.point.x).toBeCloseTo(280, 1);
    expect(cornerSample.point.y).toBeCloseTo(0, 1);

    const midLeg2 = sampleTokenTravelAnimation(
      lPathAnim!,
      1000 + lPathAnim!.durationMs * 0.75
    );
    expect(midLeg2.done).toBe(false);
    expect(midLeg2.point.x).toBeCloseTo(280, 1);
    expect(midLeg2.point.y).toBeCloseTo(140, 1);

    const endSample = sampleTokenTravelAnimation(
      lPathAnim!,
      1000 + lPathAnim!.durationMs
    );
    expect(endSample.done).toBe(true);
    expect(endSample.point).toEqual({ x: 280, y: 280 });

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent, VttCanvasComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: activeUserSig,
            handle: () => activeUserSig().id,
            displayName: () =>
              activeUserSig().id === 'gm-1' ? 'Warden' : 'Player One',
            isAdmin: () => false,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            effectiveMapsFolderId: () => null,
            effectiveCharactersFolderId: () => null,
            getFolderTrailLabel: () => '@gm-1 / Maps',
            assets: () => [],
            folders: () => [],
          },
        },
        {
          provide: VttService,
          useValue: {
            insertToken: async (input: Partial<VttTokenModel>) => {
              const created: VttTokenModel = {
                id: `tok-spawn-${++spawnSeq}`,
                encounter_id: input.encounter_id ?? 'scene-speed-1',
                character_id: input.character_id ?? null,
                owner_id: input.owner_id ?? null,
                name: input.name ?? 'Spawned Unit',
                faction: input.faction ?? 'ally',
                x: input.x ?? 2,
                y: input.y ?? 2,
                q: input.x ?? 2,
                r: input.y ?? 2,
                world_x: input.world_x ?? null,
                world_y: input.world_y ?? null,
                size: input.size ?? 1,
                icon: input.icon ?? 'shield',
                color: input.color ?? '#38B29A',
                current_hp: input.current_hp ?? 14,
                max_hp: input.max_hp ?? 14,
                current_sp: input.current_sp ?? 8,
                max_sp: input.max_sp ?? 8,
                current_ap: input.current_ap ?? 4,
                max_ap: input.max_ap ?? 4,
                armor_dr: input.armor_dr ?? 1,
                shield_block: input.shield_block ?? 0,
                move_feet: input.move_feet ?? 20,
                vision_feet: input.vision_feet ?? 60,
                light_bright_feet: input.light_bright_feet ?? 0,
                light_dim_feet: input.light_dim_feet ?? 0,
                light_color: input.light_color ?? '#FF9B42',
                shield_raised: false,
                is_hidden: false,
                statuses: [],
                npc_stats: input.npc_stats ?? {},
              };
              return { token: created, error: null, needsMigration: false };
            },
            updateScene: async () => ({ error: null, needsMigration: false }),
            insertLog: async (
              entry: Omit<VttLogEntry, 'id' | 'created_at'>
            ) => {
              insertedLogs.push(entry);
              return {
                ...entry,
                id: `log-${insertedLogs.length}`,
                created_at: new Date().toISOString(),
              };
            },
            deleteLog: async (logId: string) => {
              deletedLogIds.push(logId);
              return null;
            },
            clearCampaignLogs: async (campaignId: string) => {
              clearedCampaignIds.push(campaignId);
              return null;
            },
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const settingsStore = TestBed.inject(VttSettingsStore);
    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);

    expect(settingsStore.preferences().tokenMoveSpeed).toBe(30);
    settingsStore.updatePreferences({ tokenMoveSpeed: 0 });
    expect(settingsStore.preferences().tokenMoveSpeed).toBe(0);
    settingsStore.updatePreferences({ tokenMoveSpeed: 65 });
    expect(settingsStore.preferences().tokenMoveSpeed).toBe(65);
    settingsStore.updatePreferences({ tokenMoveSpeed: 999 });
    expect(settingsStore.preferences().tokenMoveSpeed).toBe(120);
    settingsStore.resetPreferences();
    expect(settingsStore.preferences().tokenMoveSpeed).toBe(30);

    vttStore.campaign.set({
      id: 'camp-speed-1',
      gm_id: 'gm-1',
      name: 'Silent Deployment Test',
      cover_image_url: null,
      invite_code: 'SPD101',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const baseScene: VttSceneModel = {
      id: 'scene-speed-1',
      campaign_id: 'camp-speed-1',
      gm_id: 'gm-1',
      folder_id: null,
      name: 'Courtyard',
      is_active_scene: true,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: DEFAULT_VTT_GRID_WIDTH,
      grid_height: DEFAULT_VTT_GRID_HEIGHT,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      sort_order: 0,
      round_number: 1,
      combat_active: false,
      active_turn_token_id: null,
      initiative_order: [],
      token_vision: true,
      fog_enabled: true,
      global_illumination: true,
      darkness_level: 0.85,
      walls: [],
      lights: [],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
    };
    vttStore.scenes.set([baseScene]);
    vttStore.activeSceneId.set('scene-speed-1');

    const sampleChar: CharacterModel = {
      id: 'char-silent-1',
      owner_id: 'player-1',
      name: 'Seraphina',
      level: 2,
      attributes: {
        Brawn: 2,
        Agility: 2,
        Technique: 2,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 1,
        Tinkering: 0,
        Medicine: 0,
        Survival: 0,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Light',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 14,
      current_sp: 8,
      current_ap: 4,
      active_cooldowns: {},
    };

    await vttStore.deployCharacterToken(sampleChar);
    expect(vttStore.tokens().length).toBe(1);
    expect(insertedLogs.length).toBe(0);
    expect(vttStore.logs().length).toBe(0);

    const rosterActor: VttRosterActorModel = {
      id: 'roster-silent-1',
      campaign_id: 'camp-speed-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: 'gm-1',
      actor_kind: 'npc',
      is_unique: false,
      name: 'Ash Hound',
      faction: 'enemy',
      size: 1,
      icon: 'skull',
      color: '#E11D48',
      max_hp: 10,
      max_sp: 4,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 25,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vttStore.rosterActors.set([rosterActor]);

    const deployedNpc = await vttStore.deployRosterActor('roster-silent-1');
    expect(deployedNpc).toBeTruthy();
    expect(vttStore.tokens().length).toBe(2);
    expect(insertedLogs.length).toBe(0);
    expect(vttStore.logs().length).toBe(0);

    activeUserSig.set({ id: 'player-1', email: 'player-1@example.com' });
    await vttStore.postLog({ kind: 'chat', title: 'Player One scouts ahead.' });
    activeUserSig.set({ id: 'gm-1', email: 'gm-1@example.com' });
    await vttStore.postLog({ kind: 'chat', title: 'Shadows stir in the hall.' });
    expect(vttStore.logs().map((l) => l.id)).toEqual(['log-1', 'log-2']);

    activeUserSig.set({ id: 'player-1', email: 'player-1@example.com' });
    expect(vttStore.canDeleteLog(vttStore.logs()[0])).toBe(true);
    expect(vttStore.canDeleteLog(vttStore.logs()[1])).toBe(false);

    await vttStore.deleteLogEntry('log-2');
    expect(vttStore.logs().map((l) => l.id)).toEqual(['log-1', 'log-2']);

    await vttStore.deleteLogEntry('log-1');
    expect(deletedLogIds).toEqual(['log-1']);
    expect(vttStore.logs().map((l) => l.id)).toEqual(['log-2']);

    activeUserSig.set({ id: 'gm-1', email: 'gm-1@example.com' });
    await vttStore.postLog({ kind: 'chat', title: 'Roll initiative!' });
    expect(vttStore.logs().length).toBe(2);

    const roomFixture = TestBed.createComponent(VttRoomComponent);
    const roomComp = roomFixture.componentInstance;
    roomFixture.detectChanges();

    roomComp.openSettingsModal('general');
    roomFixture.detectChanges();
    const generalModalText =
      (roomFixture.nativeElement as HTMLElement).textContent ?? '';
    expect(generalModalText).toContain('Token Movement');
    expect(generalModalText).toContain('Token Travel Speed');
    expect(generalModalText).toContain('Instant (0)');

    roomComp.closeSettingsModal();
    roomComp.sidebarTab.set('log');
    roomFixture.detectChanges();
    expect(
      (roomFixture.nativeElement as HTMLElement).textContent ?? ''
    ).toContain('Clear Log');

    roomComp.requestClearAllLogs();
    expect(roomComp.confirmClearLogs()).toBe(true);
    await roomComp.executeClearAllLogs();
    expect(roomComp.confirmClearLogs()).toBe(false);
    expect(clearedCampaignIds).toEqual(['camp-speed-1']);
    expect(vttStore.logs().length).toBe(0);
  });

  it('should use Supabase RPC bundles, atomic action RPCs, and security_invoker views across Auth, Compendium, Campaigns, VTT, Collections, and User Assets', async () => {
    const rpcCalls: { fn: string; args?: Record<string, unknown> }[] = [];
    const fromTables: string[] = [];
    let simulateCompendiumRpcMissing = false;
    let simulateCampaignBundleRpcMissing = false;
    let realtimeTokenUpsertHandler:
      | ((payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => void)
      | null = null;

    const makeQueryBuilder = (table: string) => {
      const resolveRows = (): { data: unknown; error: null } => {
        if (table === 'v_user_campaigns') {
          return {
            data: [
              {
                id: 'camp-view-gm',
                name: 'GM View Campaign',
                cover_image_url: null,
                gm_id: 'gm-user-1',
                invite_code: 'GMVIEW',
                last_played_at: null,
                created_at: '2026-01-01T00:00:00Z',
                membership_role: 'gm',
                member_count: 3,
                scene_count: 2,
              },
              {
                id: 'camp-view-player',
                name: 'Joined View Campaign',
                cover_image_url: null,
                gm_id: 'other-gm',
                invite_code: 'PLVIEW',
                last_played_at: null,
                created_at: '2026-01-02T00:00:00Z',
                membership_role: 'player',
                member_count: 4,
                scene_count: 5,
              },
            ],
            error: null,
          };
        }
        if (table === 'v_vtt_campaign_scenes') {
          return {
            data: [
              {
                id: 'scene-v-1',
                campaign_id: 'camp-rpc-1',
                gm_id: 'gm-user-1',
                name: 'Citadel Gate',
                is_active_scene: true,
                token_count: 4,
              },
            ],
            error: null,
          };
        }
        if (table === 'v_visible_vtt_tokens') {
          return {
            data: [
              {
                id: 'tok-vis-1',
                encounter_id: 'scene-rpc-2',
                name: 'Visible Scout',
                faction: 'ally',
                is_hidden: false,
                x: 2,
                y: 3,
              },
            ],
            error: null,
          };
        }
        if (table === 'v_user_assets_with_folders') {
          return {
            data: [
              {
                id: 'asset-view-1',
                owner_id: 'gm-user-1',
                folder_id: 'uaf-maps',
                name: 'keep.png',
                storage_bucket: 'user-assets',
                storage_path: 'gm-user-1/maps/keep.png',
                public_url: 'https://cdn.example.com/keep.png',
                size_bytes: 1024,
                created_at: '2026-01-01T00:00:00Z',
                folder_name: 'Maps',
                folder_slug: 'maps',
                folder_color: '#C4491A',
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null };
      };

      let isMutation = false;
      const builder: Record<string, unknown> = {
        select: () => {
          if (!isMutation) {
            fromTables.push(table);
          }
          return builder;
        },
        insert: () => {
          isMutation = true;
          return builder;
        },
        update: () => {
          isMutation = true;
          return builder;
        },
        upsert: () => {
          isMutation = true;
          return builder;
        },
        delete: () => {
          isMutation = true;
          return builder;
        },
        eq: () => builder,
        neq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        then: (
          onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null
        ) => Promise.resolve(resolveRows()).then(onfulfilled ?? undefined),
      };
      return builder;
    };

    const mockChannel = {
      on: (
        type: string,
        filter: Record<string, unknown>,
        cb: (payload: never) => void
      ) => {
        if (type === 'postgres_changes' && filter['table'] === 'vtt_tokens') {
          realtimeTokenUpsertHandler = cb as unknown as typeof realtimeTokenUpsertHandler;
        }
        return mockChannel;
      },
      subscribe: () => mockChannel,
    };

    const activeUserSig = signal<{ id: string; email: string }>({
      id: 'gm-user-1',
      email: 'gm@example.com',
    });
    const isAdminSig = signal<boolean>(false);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => activeUserSig(),
            isAdmin: () => isAdminSig(),
            handle: () => 'gm_warden',
            displayName: () => 'Warden',
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: (table: string) => makeQueryBuilder(table),
              rpc: async (fn: string, args?: Record<string, unknown>) => {
                rpcCalls.push({ fn, args });
                if (fn === 'is_handle_available') {
                  return {
                    data: args?.['p_handle'] !== 'taken_handle',
                    error: null,
                  };
                }
                if (fn === 'get_compendium_bundle') {
                  if (simulateCompendiumRpcMissing) {
                    return {
                      data: null,
                      error: {
                        code: 'PGRST202',
                        message: 'Could not find the function get_compendium_bundle',
                      },
                    };
                  }
                  return {
                    data: {
                      weapons: [],
                      skillTrees: [],
                      perkNodes: [],
                      keywords: [],
                    },
                    error: null,
                  };
                }
                if (fn === 'get_user_campaigns_bundle') {
                  if (simulateCampaignBundleRpcMissing) {
                    return {
                      data: null,
                      error: {
                        code: 'PGRST202',
                        message: 'Could not find the function get_user_campaigns_bundle',
                      },
                    };
                  }
                  return {
                    data: {
                      yourGames: [
                        {
                          id: 'camp-rpc-1',
                          name: 'The Iron March',
                          cover_image_url: null,
                          gm_id: 'gm-user-1',
                          invite_code: 'IRON01',
                          last_played_at: null,
                          created_at: '2026-01-01T00:00:00Z',
                          membership_role: 'gm',
                          member_count: 4,
                          scene_count: 2,
                        },
                      ],
                      joinedGames: [],
                    },
                    error: null,
                  };
                }
                if (fn === 'join_campaign_by_invite') {
                  if (args?.['p_invite_code'] === 'JOIN99') {
                    return {
                      data: {
                        id: 'camp-joined-99',
                        name: 'Shattered Crown',
                        cover_image_url: null,
                        gm_id: 'other-gm',
                        invite_code: 'JOIN99',
                        last_played_at: null,
                        created_at: '2026-01-03T00:00:00Z',
                      },
                      error: null,
                    };
                  }
                  return {
                    data: null,
                    error: {
                      code: 'P0002',
                      message: `No game found with invite code "${args?.['p_invite_code']}".`,
                    },
                  };
                }
                if (fn === 'get_vtt_room_bundle') {
                  return {
                    data: {
                      campaign: {
                        id: 'camp-rpc-1',
                        name: 'The Iron March',
                        cover_image_url: null,
                        gm_id: 'gm-user-1',
                        invite_code: 'IRON01',
                        last_played_at: null,
                        created_at: '2026-01-01T00:00:00Z',
                      },
                      activeSceneId: 'scene-rpc-1',
                      scenes: [
                        {
                          id: 'scene-rpc-1',
                          campaign_id: 'camp-rpc-1',
                          gm_id: 'gm-user-1',
                          name: 'Watchtower',
                          is_active_scene: true,
                          token_count: 1,
                        },
                        {
                          id: 'scene-rpc-2',
                          campaign_id: 'camp-rpc-1',
                          gm_id: 'gm-user-1',
                          name: 'Undercroft',
                          is_active_scene: false,
                          token_count: 1,
                        },
                      ],
                      folders: [
                        {
                          id: 'vtt-folder-1',
                          campaign_id: 'camp-rpc-1',
                          scope: 'maps',
                          parent_folder_id: null,
                          name: 'Act I',
                          color: '#C4491A',
                          sort_order: 0,
                        },
                      ],
                      rosterActors: [
                        {
                          id: 'ra-1',
                          campaign_id: 'camp-rpc-1',
                          actor_kind: 'npc',
                          name: 'Gate Captain',
                          faction: 'enemy',
                        },
                      ],
                      tokens: [
                        {
                          id: 'tok-bundle-1',
                          encounter_id: 'scene-rpc-1',
                          owner_id: 'player-2',
                          name: 'Vanguard',
                          faction: 'ally',
                          is_hidden: false,
                          x: 4,
                          y: 4,
                        },
                      ],
                      logs: [
                        {
                          id: 'log-bundle-1',
                          campaign_id: 'camp-rpc-1',
                          encounter_id: 'scene-rpc-1',
                          sender_id: 'gm-user-1',
                          sender_name: 'Warden',
                          kind: 'system',
                          title: 'Session opened.',
                          created_at: '2026-01-01T00:00:00Z',
                        },
                      ],
                      characters: [],
                    },
                    error: null,
                  };
                }
                if (fn === 'activate_vtt_scene') {
                  return { data: null, error: null };
                }
                if (fn === 'get_collections_bundle') {
                  return {
                    data: {
                      folders: [
                        {
                          id: 'col-f-1',
                          owner_id: 'gm-user-1',
                          parent_folder_id: null,
                          name: 'Bosses',
                          color: '#C4491A',
                          sort_order: 0,
                        },
                      ],
                      actors: [
                        {
                          id: 'col-a-1',
                          owner_id: 'gm-user-1',
                          folder_id: 'col-f-1',
                          actor_kind: 'npc',
                          name: 'Dread Knight',
                          faction: 'enemy',
                        },
                      ],
                    },
                    error: null,
                  };
                }
                if (fn === 'get_user_assets_bundle') {
                  return {
                    data: {
                      folders: [
                        {
                          id: 'uaf-maps',
                          owner_id: 'gm-user-1',
                          parent_folder_id: null,
                          name: 'Maps',
                          slug: 'maps',
                          color: '#C4491A',
                          sort_order: 0,
                        },
                        {
                          id: 'uaf-chars',
                          owner_id: 'gm-user-1',
                          parent_folder_id: null,
                          name: 'Characters',
                          slug: 'characters',
                          color: '#38B29A',
                          sort_order: 1,
                        },
                      ],
                      assets: [
                        {
                          id: 'ua-bundle-1',
                          owner_id: 'gm-user-1',
                          folder_id: 'uaf-maps',
                          name: 'citadel.webp',
                          storage_bucket: 'user-assets',
                          storage_path: 'gm-user-1/maps/citadel.webp',
                          public_url: 'https://cdn.example.com/citadel.webp',
                          size_bytes: 2048,
                          created_at: '2026-01-01T00:00:00Z',
                          folder_name: 'Maps',
                          folder_slug: 'maps',
                          folder_color: '#C4491A',
                        },
                      ],
                      preferences: {
                        owner_id: 'gm-user-1',
                        maps_folder_id: 'uaf-maps',
                        characters_folder_id: 'uaf-chars',
                      },
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
              channel: () => mockChannel,
              removeChannel: async () => 'ok',
            },
          },
        },
      ],
    });

    const authService = TestBed.inject(AuthService);
    expect(await authService.isHandleTaken('taken_handle')).toBe(true);
    expect(await authService.isHandleTaken('fresh_handle')).toBe(false);
    expect(rpcCalls.some((c) => c.fn === 'is_handle_available')).toBe(true);

    const compendiumService = TestBed.inject(CompendiumService);
    await compendiumService.fetchFullCompendium(false);
    expect(rpcCalls.some((c) => c.fn === 'get_compendium_bundle')).toBe(true);

    simulateCompendiumRpcMissing = true;
    fromTables.length = 0;
    await compendiumService.fetchFullCompendium(false);
    expect(fromTables).toEqual([
      'v_active_weapons',
      'v_active_armors',
      'v_active_items',
      'v_active_skill_trees',
      'v_active_perk_nodes',
      'v_active_keywords',
    ]);

    fromTables.length = 0;
    await compendiumService.fetchFullCompendium(true);
    expect(fromTables).toEqual([
      'weapons',
      'compendium_armors',
      'compendium_items',
      'skill_trees',
      'perk_nodes',
      'compendium_keywords',
    ]);
    simulateCompendiumRpcMissing = false;

    const campaignStore = TestBed.inject(CampaignStore);
    const campaignService = TestBed.inject(CampaignService);
    await campaignStore.loadGames('gm-user-1');
    expect(rpcCalls.some((c) => c.fn === 'get_user_campaigns_bundle')).toBe(true);
    expect(campaignStore.yourGames().length).toBe(1);
    expect(campaignStore.yourGames()[0].scene_count).toBe(2);

    simulateCampaignBundleRpcMissing = true;
    fromTables.length = 0;
    const fallbackCampRes = await campaignService.fetchUserCampaigns('gm-user-1');
    expect(fromTables).toContain('v_user_campaigns');
    expect(fallbackCampRes.yourGames.map((g) => g.id)).toEqual(['camp-view-gm']);
    expect(fallbackCampRes.joinedGames.map((g) => g.id)).toEqual([
      'camp-view-player',
    ]);
    simulateCampaignBundleRpcMissing = false;

    fromTables.length = 0;
    const joinedOk = await campaignStore.joinGameByCode('join99');
    expect(joinedOk).toBe(true);
    expect(
      rpcCalls.some(
        (c) =>
          c.fn === 'join_campaign_by_invite' && c.args?.['p_invite_code'] === 'JOIN99'
      )
    ).toBe(true);
    expect(fromTables).not.toContain('campaign_members');
    expect(campaignStore.joinedGames()[0]?.id).toBe('camp-joined-99');

    const collectionsStore = TestBed.inject(CollectionsStore);
    fromTables.length = 0;
    await collectionsStore.loadCollections(true);
    expect(rpcCalls.some((c) => c.fn === 'get_collections_bundle')).toBe(true);
    expect(fromTables).not.toContain('collection_folders');
    expect(collectionsStore.folders()[0]?.name).toBe('Bosses');
    expect(collectionsStore.actors()[0]?.name).toBe('Dread Knight');

    const userAssetsStore = TestBed.inject(UserAssetsStore);
    const userAssetsService = TestBed.inject(UserAssetsService);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mot-user-asset-folders-v1-gm-user-1');
      localStorage.removeItem('mot-user-assets-v1-gm-user-1');
    }
    fromTables.length = 0;
    await userAssetsStore.ensureLoaded(true);
    expect(rpcCalls.some((c) => c.fn === 'get_user_assets_bundle')).toBe(true);
    expect(fromTables).not.toContain('user_asset_folders');
    expect(userAssetsStore.folders().length).toBe(2);
    expect(userAssetsStore.assets()[0]?.folder_slug).toBe('maps');

    fromTables.length = 0;
    const viewAssets = await userAssetsService.fetchAssets('gm-user-1');
    expect(fromTables).toEqual(['v_user_assets_with_folders']);
    expect(viewAssets.assets[0]?.folder_name).toBe('Maps');

    const vttStore = TestBed.inject(VttStore);
    const vttService = TestBed.inject(VttService);
    fromTables.length = 0;
    await vttStore.enterCampaignRoom('camp-rpc-1');
    expect(
      rpcCalls.some(
        (c) =>
          c.fn === 'get_vtt_room_bundle' && c.args?.['p_campaign_id'] === 'camp-rpc-1'
      )
    ).toBe(true);
    expect(fromTables).not.toContain('vtt_encounters');
    expect(fromTables).not.toContain('vtt_tokens');
    expect(vttStore.scenes().length).toBe(2);
    expect(vttStore.scenes()[0]?.token_count).toBe(1);
    expect(vttStore.tokens()[0]?.name).toBe('Vanguard');
    expect(vttStore.logs()[0]?.title).toBe('Session opened.');

    fromTables.length = 0;
    await vttStore.selectOrActivateScene('scene-rpc-2', true);
    expect(fromTables).toEqual(['v_visible_vtt_tokens']);
    expect(
      rpcCalls.some(
        (c) =>
          c.fn === 'activate_vtt_scene' &&
          c.args?.['p_campaign_id'] === 'camp-rpc-1' &&
          c.args?.['p_scene_id'] === 'scene-rpc-2'
      )
    ).toBe(true);
    expect(
      vttStore.scenes().find((s) => s.id === 'scene-rpc-2')?.is_active_scene
    ).toBe(true);
    expect(
      vttStore.scenes().find((s) => s.id === 'scene-rpc-1')?.is_active_scene
    ).toBe(false);

    fromTables.length = 0;
    const directViewScenes = await vttService.fetchCampaignScenes(
      'camp-rpc-1',
      'gm-user-1'
    );
    expect(fromTables).toEqual(['v_vtt_campaign_scenes']);
    expect(directViewScenes.scenes[0]?.token_count).toBe(4);

    activeUserSig.set({ id: 'player-3', email: 'player3@example.com' });
    expect(vttStore.isGm()).toBe(false);
    expect(realtimeTokenUpsertHandler).toBeTruthy();
    realtimeTokenUpsertHandler!({
      eventType: 'UPDATE',
      new: {
        id: 'tok-vis-1',
        encounter_id: 'scene-rpc-2',
        owner_id: 'gm-user-1',
        name: 'Ambush Assassin',
        faction: 'enemy',
        is_hidden: true,
        x: 2,
        y: 3,
      },
      old: {},
    });
    expect(vttStore.tokens().some((t) => t.id === 'tok-vis-1')).toBe(false);
  });

  it('should pre-solve deterministic 3D physics throws across all polyhedral dice (d4, d6, d8, d10, d12, d20, d100) so every die settles flat on its exact target value while preserving convex hull symmetry', () => {
    const mixedSpecs = [
      { kind: 'd4' as const, targetValue: 4 },
      { kind: 'd6' as const, targetValue: 6 },
      { kind: 'd8' as const, targetValue: 8 },
      { kind: 'd10' as const, targetValue: 10 },
      { kind: 'd12' as const, targetValue: 12 },
      { kind: 'd20' as const, targetValue: 20 },
      { kind: 'd100' as const, targetValue: 70 },
      { kind: 'd10_units' as const, targetValue: 3 },
    ];

    const preSim = preSimulateDeterministicThrow(mixedSpecs, 8.5, 5.5, 424242);
    expect(preSim.initialStates.length).toBe(mixedSpecs.length);
    expect(preSim.finalStates.length).toBe(mixedSpecs.length);
    expect(preSim.settledStep).toBeGreaterThan(35);

    const worldUp = new THREE.Vector3(0, 1, 0);

    mixedSpecs.forEach((spec, idx) => {
      const tpl = getPolyhedronTemplate(spec.kind);
      const fin = preSim.finalStates[idx];
      const targetOutcome = tpl.outcomes.find(
        (o) => o.value === spec.targetValue
      );
      expect(targetOutcome).toBeTruthy();

      for (const v of tpl.vertices) {
        const rotated = v.clone().applyQuaternion(fin.symmetryQuat);
        let minDist = Infinity;
        for (const orig of tpl.vertices) {
          const d = rotated.distanceTo(orig);
          if (d < minDist) minDist = d;
        }
        expect(minDist).toBeLessThan(1e-3);
      }

      const visualFinalQuat = fin.quat.clone().multiply(fin.symmetryQuat);
      const worldOutcomeUp = targetOutcome!.upVector
        .clone()
        .applyQuaternion(visualFinalQuat)
        .normalize();

      expect(worldOutcomeUp.dot(worldUp)).toBeGreaterThan(0.9);
    });
  });

  it('should support multi-dice polyhedral pool left-click/right-click mixing, d100 tens+units dice, custom dice colors and surface textures, and 3D dice throw broadcasts in VTT Log', async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mot_vtt_preferences_v1');
    }

    let pool = createEmptyDicePool();
    pool = adjustDiePoolCount(pool, 'd10', 1);
    pool = adjustDiePoolCount(pool, 'd10', 1);
    pool = adjustDiePoolCount(pool, 'd10', 1);
    expect(pool.d10).toBe(3);
    expect(formatDicePoolFormula(pool, 0)).toBe('3d10');

    pool = adjustDiePoolCount(pool, 'd10', -1);
    expect(pool.d10).toBe(2);

    pool = adjustDiePoolCount(pool, 'd6', 1);
    pool = adjustDiePoolCount(pool, 'd100', 1);
    expect(getTotalDiceInPool(pool)).toBe(4);
    expect(formatDicePoolFormula(pool, 4)).toBe('1d6 + 2d10 + 1d100 + 4');

    const scriptedValues: Record<number, number[]> = {
      6: [5],
      10: [9, 4],
      100: [73],
    };
    const poolResult = rollCustomDicePool(pool, 4, (sides) => {
      const queue = scriptedValues[sides];
      return queue?.shift() ?? 1;
    });
    expect(poolResult.diceSubtotal).toBe(5 + 9 + 4 + 73);
    expect(poolResult.total).toBe(95);
    expect(poolResult.physicalDice).toEqual([
      { kind: 'd6', targetValue: 5 },
      { kind: 'd10', targetValue: 9 },
      { kind: 'd10', targetValue: 4 },
      { kind: 'd100', targetValue: 70 },
      { kind: 'd10_units', targetValue: 3 },
    ]);

    const advPhysical = buildPhysicalDiceFrom2d10Roll({
      d1: 9,
      d2: 2,
      d3: 7,
      mode: 'advantage',
      modifier: 3,
      total: 19,
    });
    expect(advPhysical.formula).toBe('3d10kh2 + 3');
    expect(advPhysical.physicalDice.map((d) => Boolean(d.dropped))).toEqual([
      false,
      true,
      false,
    ]);

    const sanitizedBroadcast = sanitizeIncomingDiceThrowPayload({
      id: 'throw-remote-1',
      senderId: 'player-2',
      senderName: 'Kael',
      label: 'Kael · Roll (3d10)',
      formula: '3d10',
      total: 21,
      dice: [
        { kind: 'd10', targetValue: 8 },
        { kind: 'd10', targetValue: 7 },
        { kind: 'd10', targetValue: 6 },
      ],
      appearance: {
        presetId: 'custom',
        material: 'gemstone',
        bodyColor: '#7c3aed',
        labelColor: '#fde68a',
      },
      seed: 999,
      createdAt: 1700000000000,
    });
    expect(sanitizedBroadcast).toBeTruthy();
    expect(sanitizedBroadcast!.appearance.material).toBe('gemstone');
    expect(sanitizedBroadcast!.appearance.bodyColor).toBe('#7C3AED');
    expect(sanitizedBroadcast!.appearance.labelColor).toBe('#FDE68A');

    const activeUserSig = signal({ id: 'gm-dice-1', email: 'gm@example.com' });
    const insertedLogs: VttLogEntry[] = [];
    const broadcastedThrows: unknown[] = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: activeUserSig,
            handle: () => 'warden',
            displayName: () => 'Warden',
            isAdmin: () => false,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            effectiveMapsFolderId: () => null,
            effectiveCharactersFolderId: () => null,
            getFolderTrailLabel: () => '@warden / Maps',
            assets: () => [],
            folders: () => [],
          },
        },
        {
          provide: VttService,
          useValue: {
            insertLog: async (
              entry: Omit<VttLogEntry, 'id' | 'created_at'>
            ) => {
              const saved: VttLogEntry = {
                ...entry,
                id: `dice-log-${insertedLogs.length + 1}`,
                created_at: new Date().toISOString(),
              };
              insertedLogs.push(saved);
              return saved;
            },
            sendDiceThrow: async (_ch: unknown, payload: unknown) => {
              broadcastedThrows.push(payload);
            },
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const settingsStore = TestBed.inject(VttSettingsStore);
    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-dice-1',
      gm_id: 'gm-dice-1',
      name: 'Dice Chamber',
      cover_image_url: null,
      invite_code: 'DICE20',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.openSettingsModal('dice');
    fixture.detectChanges();
    const modalText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(modalText).toContain('3D Dice & Appearance');
    expect(modalText).toContain('Starter Presets');
    expect(modalText).toContain('Surface Texture & Finish');
    expect(modalText).toContain('Body Color');
    expect(modalText).toContain('Number / Ink Color');

    comp.selectDicePreset('obsidian-gold');
    expect(settingsStore.preferences().diceAppearance.presetId).toBe(
      'obsidian-gold'
    );
    expect(settingsStore.preferences().diceAppearance.material).toBe('marble');

    comp.selectDiceMaterial('gemstone');
    comp.updateDiceBodyColor('#7c3aed');
    comp.updateDiceLabelColor('#fde68a');
    expect(settingsStore.preferences().diceAppearance).toEqual({
      presetId: 'custom',
      material: 'gemstone',
      bodyColor: '#7C3AED',
      labelColor: '#FDE68A',
    });
    comp.closeSettingsModal();
    fixture.detectChanges();

    const logTabText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(logTabText).not.toContain('2d10 Normal');

    comp.incrementDieInPool('d10');
    expect(comp.chatInput()).toBe('/r 1d10');
    comp.incrementDieInPool('d10');
    comp.incrementDieInPool('d10');
    expect(comp.chatInput()).toBe('/r 3d10');
    expect(comp.dicePool().d10).toBe(3);

    const fakeContextEvent = new MouseEvent('contextmenu', { cancelable: true });
    comp.decrementDieInPool(fakeContextEvent, 'd10');
    expect(fakeContextEvent.defaultPrevented).toBe(true);
    expect(comp.chatInput()).toBe('/r 2d10');
    expect(comp.dicePool().d10).toBe(2);

    comp.incrementDieInPool('d8');
    expect(comp.chatInput()).toBe('/r 2d10 + 1d8');
    comp.onChatInputChange(`${comp.chatInput()} + 2`);
    expect(comp.chatInput()).toBe('/r 2d10 + 1d8 + 2');
    expect(comp.dicePool().d10).toBe(2);
    expect(comp.dicePool().d8).toBe(1);
    expect(comp.composerSubmitLabel()).toBe('Roll');

    await comp.sendChatMessage();
    fixture.detectChanges();

    expect(comp.chatInput()).toBe('');
    expect(comp.customPoolTotalCount()).toBe(0);
    expect(comp.dicePool()).toEqual(createEmptyDicePool());

    const thrown = vttStore.latestDiceThrow();
    expect(thrown).toBeTruthy();
    expect(thrown!.formula).toBe('2d10 + 1d8 + 2');
    expect(thrown!.dice.map((d) => d.kind)).toEqual(['d10', 'd10', 'd8']);
    expect(thrown!.appearance).toEqual({
      presetId: 'custom',
      material: 'gemstone',
      bodyColor: '#7C3AED',
      labelColor: '#FDE68A',
    });

    expect(insertedLogs.length).toBe(1);
    const chips = extractLogRollChips(insertedLogs[0].payload);
    expect(chips.map((c) => c.dieType)).toEqual(['d10', 'd10', 'd8']);
    expect(comp.getLogRollChips(insertedLogs[0]).length).toBe(3);
  });

  it('should resolve configurable slash command shorthands from vtt-commands.config.ts and enforce privacy for /gmroll and /whisper', async () => {
    expect(resolveSlashCommand('/w gm Watch out')?.config.action).toBe('whisper');
    expect(resolveSlashCommand('/whisper gm Watch out')?.config.action).toBe(
      'whisper'
    );
    expect(resolveSlashCommand('/r 2d10')?.config.action).toBe('roll');
    expect(resolveSlashCommand('/roll 2d10')?.config.action).toBe('roll');
    expect(resolveSlashCommand('/gmr 1d20')?.config.action).toBe('gm_roll');
    expect(resolveSlashCommand('/gmroll 1d20')?.config.action).toBe('gm_roll');

    const customRegistry: VttChatCommandConfig[] = VTT_CHAT_COMMANDS.map((cmd) =>
      cmd.action === 'roll'
        ? { ...cmd, primary: '/dice', aliases: ['/roll', '/d'] }
        : cmd.action === 'whisper'
          ? { ...cmd, aliases: [...cmd.aliases, '/dm'] }
          : cmd
    );

    expect(applyDieClickToChatInput('', 'd10', 1, customRegistry)).toBe(
      '/dice 1d10'
    );
    expect(
      extractDicePoolFromChatInput('/d 2d6 + 1d12', customRegistry)
    ).toEqual({
      ...createEmptyDicePool(),
      d6: 2,
      d12: 1,
    });
    expect(
      resolveSlashCommand('/dm @kael Ambush!', customRegistry)?.config.action
    ).toBe('whisper');
    expect(
      findMatchingSlashCommands('/dm', false, customRegistry).map(
        (c) => c.action
      )
    ).toEqual(['whisper']);

    const khQueue = [3, 9, 7];
    const khOutcome = parseAndRollDiceFormula(
      '3d10kh2 + 4 # Athletics',
      () => khQueue.shift() ?? 1
    );
    expect(khOutcome.ok).toBe(true);
    if (khOutcome.ok) {
      expect(khOutcome.customLabel).toBe('Athletics');
      expect(khOutcome.result.diceSubtotal).toBe(16);
      expect(khOutcome.result.total).toBe(20);
      expect(khOutcome.result.chips.map((c) => Boolean(c.dropped))).toEqual([
        true,
        false,
        false,
      ]);
    }

    const activeUserSig = signal({
      id: 'player-1',
      email: 'lyra@example.com',
      name: 'Lyra',
      handle: 'lyra',
    });
    const insertedLogs: VttLogEntry[] = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({
              id: activeUserSig().id,
              email: activeUserSig().email,
            }),
            handle: () => activeUserSig().handle,
            displayName: () => activeUserSig().name,
            isAdmin: () => false,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            effectiveMapsFolderId: () => null,
            effectiveCharactersFolderId: () => null,
            getFolderTrailLabel: () => '@lyra / Maps',
            assets: () => [],
            folders: () => [],
          },
        },
        {
          provide: VttService,
          useValue: {
            insertLog: async (
              entry: Omit<VttLogEntry, 'id' | 'created_at'>
            ) => {
              const saved: VttLogEntry = {
                ...entry,
                id: `priv-log-${insertedLogs.length + 1}`,
                created_at: new Date().toISOString(),
              };
              insertedLogs.push(saved);
              return saved;
            },
            sendDiceThrow: async () => undefined,
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-priv-1',
      gm_id: 'gm-user-1',
      name: 'Whispering Vault',
      cover_image_url: null,
      invite_code: 'WHISP1',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.participants.set([
      {
        user_id: 'gm-user-1',
        display_name: 'Warden',
        handle: 'warden',
        role: 'gm',
      },
      {
        user_id: 'player-1',
        display_name: 'Lyra',
        handle: 'lyra',
        role: 'player',
      },
      {
        user_id: 'player-2',
        display_name: 'Kael',
        handle: 'kael',
        role: 'player',
      },
      {
        user_id: 'player-3',
        display_name: 'Bram',
        handle: 'bram',
        role: 'player',
      },
    ]);

    const wGm = await vttStore.executeChatOrCommand(
      '/w gm Checking the secret door'
    );
    expect(wGm.cleared).toBe(true);

    const wPlayer = await vttStore.executeChatOrCommand(
      '/whisper @kael Cover my left flank'
    );
    expect(wPlayer.cleared).toBe(true);

    const gmRollRes = await vttStore.executeChatOrCommand('/gmroll 2d10 + 3');
    expect(gmRollRes.cleared).toBe(true);
    const gmRollThrow = vttStore.latestDiceThrow();
    expect(gmRollThrow).toBeTruthy();
    expect(gmRollThrow!.recipientIds).toEqual(['gm-user-1']);

    expect(vttStore.visibleLogs().length).toBe(3);

    activeUserSig.set({
      id: 'gm-user-1',
      email: 'gm@example.com',
      name: 'Warden',
      handle: 'warden',
    });
    expect(vttStore.visibleLogs().map((l) => l.title)).toEqual([
      'Checking the secret door',
      insertedLogs[2].title,
    ]);
    expect(vttStore.isDiceThrowVisibleToCurrentUser(gmRollThrow!)).toBe(true);

    activeUserSig.set({
      id: 'player-2',
      email: 'kael@example.com',
      name: 'Kael',
      handle: 'kael',
    });
    expect(vttStore.visibleLogs().map((l) => l.title)).toEqual([
      'Cover my left flank',
    ]);
    expect(vttStore.isDiceThrowVisibleToCurrentUser(gmRollThrow!)).toBe(false);

    activeUserSig.set({
      id: 'player-3',
      email: 'bram@example.com',
      name: 'Bram',
      handle: 'bram',
    });
    expect(vttStore.visibleLogs().length).toBe(0);
    expect(vttStore.isDiceThrowVisibleToCurrentUser(gmRollThrow!)).toBe(false);
  });

  it('should sync Advantage/Disadvantage and Mod with /r formulas, support GM User vs Character speaker modes across tokens/actions/actors, support /ooc, and omit the top Entries header', async () => {
    expect(applyRollModeToChatInput('', 'advantage')).toBe('/r 3d10kh2');
    expect(applyRollModeToChatInput('', 'disadvantage')).toBe('/r 3d10kl2');
    expect(extractRollModeFromChatInput('/r 3d10kh2')).toBe('advantage');
    expect(extractRollModeFromChatInput('/r 3d10kl2')).toBe('disadvantage');
    expect(applyRollModeToChatInput('/r 3d10kh2', 'normal')).toBe('/r 2d10');
    expect(applyRollModeToChatInput('/gmr 1d20 + 4 # Save', 'advantage')).toBe(
      '/gmr 2d20kh1 + 4 # Save'
    );
    expect(
      applyRollModeToChatInput('/gmr 2d20kh1 + 4 # Save', 'disadvantage')
    ).toBe('/gmr 2d20kl1 + 4 # Save');

    const withBonusDie = applyDieClickToChatInput('/r 3d10kh2 + 3', 'd6', 1);
    expect(withBonusDie).toBe('/r 3d10kh2 + 1d6 + 3');
    expect(extractRollModeFromChatInput(withBonusDie)).toBe('advantage');
    expect(extractModifierFromChatInput(withBonusDie)).toBe(3);

    expect(applyModifierToChatInput('', 2)).toBe('/r 2d10 + 2');
    expect(applyModifierToChatInput('', -3)).toBe('/r 2d10 - 3');
    expect(applyModifierToChatInput('/r 3d10kh2 + 2', -1)).toBe(
      '/r 3d10kh2 - 1'
    );
    expect(applyModifierToChatInput('/r 3d10kh2 - 1', 0)).toBe('/r 3d10kh2');

    const activeUserSig = signal({
      id: 'gm-speaker-1',
      email: 'gm@example.com',
      name: 'Warden',
      handle: 'warden',
    });
    const insertedLogs: VttLogEntry[] = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({
              id: activeUserSig().id,
              email: activeUserSig().email,
            }),
            handle: () => activeUserSig().handle,
            displayName: () => activeUserSig().name,
            isAdmin: () => false,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            effectiveMapsFolderId: () => null,
            effectiveCharactersFolderId: () => null,
            getFolderTrailLabel: () => '@warden / Maps',
            assets: () => [],
            folders: () => [],
          },
        },
        {
          provide: VttService,
          useValue: {
            insertLog: async (
              entry: Omit<VttLogEntry, 'id' | 'created_at'>
            ) => {
              const saved: VttLogEntry = {
                ...entry,
                id: `chat-mod-log-${insertedLogs.length + 1}`,
                created_at: new Date().toISOString(),
              };
              insertedLogs.push(saved);
              return saved;
            },
            clearCampaignLogs: async () => null,
            sendDiceThrow: async () => undefined,
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-chat-1',
      gm_id: 'gm-speaker-1',
      name: 'Hall of Voices',
      cover_image_url: null,
      invite_code: 'VOICE1',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-chat-1',
        campaign_id: 'camp-chat-1',
        gm_id: 'gm-speaker-1',
        folder_id: null,
        sort_order: 0,
        name: 'Tavern',
        is_active_scene: true,
        map_image_url: null,
        background_color: '#0E1917',
        grid_mode: 'square',
        scene_width: 1200,
        scene_height: 800,
        padding: 0.25,
        grid_width: 24,
        grid_height: 16,
        grid_size_px: 64,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: 0.25,
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0.85,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: true },
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        pending_clash: null,
        created_at: new Date().toISOString(),
      },
    ]);
    vttStore.activeSceneId.set('scene-chat-1');

    const vanceToken: VttTokenModel = {
      id: 'tok-vance',
      encounter_id: 'scene-chat-1',
      character_id: null,
      owner_id: null,
      name: 'Captain Vance',
      faction: 'neutral',
      x: 2,
      y: 2,
      q: 2,
      r: 2,
      size: 1,
      icon: 'bastion-shield',
      color: '#F59E0B',
      current_hp: 12,
      max_hp: 12,
      current_sp: 6,
      max_sp: 6,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 2,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    };

    const oathbreakerToken: VttTokenModel = {
      ...vanceToken,
      id: 'tok-oath',
      name: 'Oathbreaker',
      faction: 'enemy',
      color: '#EF4444',
    };

    const playerHeroToken: VttTokenModel = {
      ...vanceToken,
      id: 'tok-vanguard',
      owner_id: 'player-ooc-1',
      name: 'Vanguard',
      faction: 'ally',
      color: '#38B29A',
    };

    vttStore.tokens.set([vanceToken, oathbreakerToken, playerHeroToken]);
    vttStore.rosterActors.set([
      {
        id: 'roster-innkeeper',
        campaign_id: 'camp-chat-1',
        folder_id: null,
        character_id: null,
        collection_actor_id: null,
        owner_id: 'gm-speaker-1',
        actor_kind: 'npc',
        is_unique: true,
        name: 'Tavern Keeper',
        faction: 'neutral',
        size: 1,
        icon: 'tankard',
        color: '#D97706',
        max_hp: 8,
        max_sp: 4,
        max_ap: 4,
        armor_dr: 0,
        shield_block: 0,
        move_feet: 20,
        vision_feet: 60,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#FF9B42',
        npc_stats: {},
        notes: '',
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    vttStore.selectedTokenId.set('tok-vance');

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.setComposerRollMode('advantage');
    expect(comp.chatInput()).toBe('/r 3d10kh2');
    expect(comp.activeRollMode()).toBe('advantage');

    comp.stepComposerModifier(4);
    expect(comp.chatInput()).toBe('/r 3d10kh2 + 4');
    expect(comp.activeRollModifier()).toBe(4);

    await comp.sendChatMessage();
    fixture.detectChanges();
    expect(comp.chatInput()).toBe('');
    expect(comp.activeRollMode()).toBe('normal');
    expect(comp.activeRollModifier()).toBe(0);
    expect(insertedLogs[0].sender_name).toBe('Warden');
    expect(insertedLogs[0].title).toContain('Dice Roll (3d10kh2 + 4)');

    const logPanelText = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(logPanelText).not.toContain('1 Entry');
    expect(logPanelText).not.toContain('Entries');
    expect(logPanelText).toContain('Clear Log');

    comp.onChatInputChange('Welcome to the session!');
    await comp.sendChatMessage();
    expect(insertedLogs[1].sender_name).toBe('Warden');
    expect(comp.isGmUserLog(insertedLogs[1])).toBe(true);

    comp.setGmSpeakerMode('character');
    comp.onChatInputChange('State your business at the gate.');
    await comp.sendChatMessage();
    expect(insertedLogs[2].sender_name).toBe('Captain Vance');
    expect(comp.isGmUserLog(insertedLogs[2])).toBe(false);

    vttStore.pendingTargetAction.set({
      attackerTokenId: 'tok-oath',
      kind: 'weapon',
      actionName: 'Blackiron Cleaver',
      apCost: 1,
      cooldownRounds: 0,
      perkId: null,
      reachFeet: 5,
      attackMod: 4,
      flatDamage: 6,
      combatTags: [],
      disallowedDefenses: [],
      bonusSpDamage: 0,
      ignoreArmorDr: 0,
      defendedSpChip: 0,
      pushFeet: 0,
      selfShiftFeet: 0,
      inflictStatuses: [],
    });
    expect(vttStore.activeCharacterSpeaker()?.name).toBe('Oathbreaker');
    comp.onChatInputChange('Kneel before the Ash Throne!');
    await comp.sendChatMessage();
    expect(insertedLogs[3].sender_name).toBe('Oathbreaker');

    vttStore.pendingTargetAction.set(null);
    vttStore.openActorSheet(vttStore.rosterActors()[0].id);
    expect(vttStore.activeCharacterSpeaker()?.name).toBe('Tavern Keeper');
    comp.onChatInputChange('Ale is two copper a mug.');
    await comp.sendChatMessage();
    expect(insertedLogs[4].sender_name).toBe('Tavern Keeper');

    activeUserSig.set({
      id: 'player-ooc-1',
      email: 'lyra@example.com',
      name: 'Lyra',
      handle: 'lyra',
    });
    vttStore.selectedTokenId.set('tok-vanguard');
    fixture.detectChanges();

    comp.onChatInputChange('Shields up!');
    await comp.sendChatMessage();
    expect(insertedLogs[5].sender_name).toBe('Vanguard');
    expect(comp.isOocLog(insertedLogs[5])).toBe(false);

    comp.onChatInputChange('/ooc Stepping away for water, back in 1 min');
    expect(comp.composerSubmitLabel()).toBe('OOC');
    await comp.sendChatMessage();
    expect(insertedLogs[6].sender_name).toBe('Lyra');
    expect(insertedLogs[6].title).toBe('Stepping away for water, back in 1 min');
    expect(comp.isOocLog(insertedLogs[6])).toBe(true);

    const shorthandOoc = await vttStore.executeChatOrCommand('/o Ready to roll!');
    expect(shorthandOoc.cleared).toBe(true);
    expect(insertedLogs[7].sender_name).toBe('Lyra');
    expect(comp.isOocLog(insertedLogs[7])).toBe(true);
  });

  it('scales Dim Vision with scene ambient lighting while preserving Darkvision floor and Bright Light burn-through', () => {
    expect(DEFAULT_VTT_DIM_VISION_FEET).toBe(60);
    expect(DEFAULT_VTT_DARKVISION_FEET).toBe(10);

    const geom: HexGridGeometry = {
      gridWidth: 30,
      gridHeight: 20,
      gridSizePx: 50,
      offsetX: 0,
      offsetY: 0,
    };

    const observer: VttTokenModel = {
      id: 'obs-human',
      encounter_id: 'sc-vision',
      character_id: null,
      owner_id: 'player-1',
      name: 'Watchman',
      faction: 'ally',
      x: 2,
      y: 5,
      q: 0,
      r: 0,
      world_x: null,
      world_y: null,
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      current_hp: 12,
      max_hp: 12,
      current_sp: 6,
      max_sp: 6,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 1,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    };

    const pt5ft = hexToWorldCenter({ col: 3, row: 5 }, geom);
    const pt10ft = hexToWorldCenter({ col: 4, row: 5 }, geom);
    const pt15ft = hexToWorldCenter({ col: 5, row: 5 }, geom);
    const pt20ft = hexToWorldCenter({ col: 6, row: 5 }, geom);
    const pt30ft = hexToWorldCenter({ col: 8, row: 5 }, geom);
    const pt35ft = hexToWorldCenter({ col: 9, row: 5 }, geom);
    const pt60ft = hexToWorldCenter({ col: 14, row: 5 }, geom);
    const pt80ft = hexToWorldCenter({ col: 18, row: 5 }, geom);

    const daylightVisions = buildObserverVisions(
      [observer],
      [],
      geom,
      true,
      2000,
      'square',
      0
    );
    expect(
      isWorldPointVisibleToObservers(pt80ft, daylightVisions, [], [], true)
    ).toBe(true);

    const clearNightVisions = buildObserverVisions(
      [observer],
      [],
      geom,
      false,
      2000,
      'square',
      0
    );
    expect(clearNightVisions[0].effectiveSightFeet).toBe(60);
    expect(
      isWorldPointVisibleToObservers(pt60ft, clearNightVisions, [], [], false)
    ).toBe(true);
    expect(
      isWorldPointVisibleToObservers(pt80ft, clearNightVisions, [], [], false)
    ).toBe(false);

    const distantCampfire = buildLightPolygons(
      [
        {
          id: 'campfire-1',
          x: pt80ft.x,
          y: pt80ft.y,
          bright_feet: 15,
          dim_feet: 30,
          color: '#FF9B42',
        },
      ],
      [observer],
      [],
      geom,
      'square'
    );
    expect(
      isWorldPointVisibleToObservers(
        pt80ft,
        clearNightVisions,
        distantCampfire,
        [],
        false
      )
    ).toBe(true);

    const woodsDuskVisions = buildObserverVisions(
      [observer],
      [],
      geom,
      false,
      2000,
      'square',
      0.5
    );
    expect(woodsDuskVisions[0].effectiveSightFeet).toBe(30);
    expect(
      isWorldPointVisibleToObservers(pt30ft, woodsDuskVisions, [], [], false)
    ).toBe(true);
    expect(
      isWorldPointVisibleToObservers(pt35ft, woodsDuskVisions, [], [], false)
    ).toBe(false);

    const stormVisions = buildObserverVisions(
      [observer],
      [],
      geom,
      false,
      2000,
      'square',
      0.75
    );
    expect(stormVisions[0].effectiveSightFeet).toBe(15);
    expect(
      isWorldPointVisibleToObservers(pt15ft, stormVisions, [], [], false)
    ).toBe(true);
    expect(
      isWorldPointVisibleToObservers(pt20ft, stormVisions, [], [], false)
    ).toBe(false);

    const pitchBlackVisions = buildObserverVisions(
      [observer],
      [],
      geom,
      false,
      2000,
      'square',
      1
    );
    expect(pitchBlackVisions[0].effectiveSightFeet).toBe(10);
    expect(
      isWorldPointVisibleToObservers(pt10ft, pitchBlackVisions, [], [], false)
    ).toBe(true);
    expect(
      isWorldPointVisibleToObservers(pt15ft, pitchBlackVisions, [], [], false)
    ).toBe(false);

    const blindObserver: VttTokenModel = {
      ...observer,
      darkvision_feet: 0,
    };
    const blindPitchVisions = buildObserverVisions(
      [blindObserver],
      [],
      geom,
      false,
      2000,
      'square',
      1
    );
    expect(blindPitchVisions[0].effectiveSightFeet).toBe(0);
    expect(
      isWorldPointVisibleToObservers(pt5ft, blindPitchVisions, [], [], false)
    ).toBe(false);

    const torchBearer: VttTokenModel = {
      ...blindObserver,
      light_bright_feet: 20,
      light_dim_feet: 40,
    };
    const torchVisions = buildObserverVisions(
      [torchBearer],
      [],
      geom,
      false,
      2000,
      'square',
      1
    );
    expect(torchVisions[0].effectiveSightFeet).toBe(40);
    expect(
      isWorldPointVisibleToObservers(pt35ft, torchVisions, [], [], false)
    ).toBe(true);
  });

  it('applies Environment Lighting presets in Scene Configuration and syncs Actor Dim Vision and Darkvision onto deployed tokens', async () => {
    const updatedActors: Partial<VttRosterActorModel>[] = [];
    const updatedTokens: { id: string; patch: Partial<VttTokenModel> }[] = [];

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({ id: 'gm-light-1', email: 'gm@example.com' }),
            displayName: () => 'Warden',
            handle: () => 'warden',
            isAdmin: () => false,
          },
        },
        {
          provide: VttService,
          useValue: {
            subscribeToCampaignRoom: () => () => undefined,
            unsubscribeChannel: () => undefined,
            updateRosterActor: async (
              _cid: string,
              _aid: string,
              patch: Partial<VttRosterActorModel>
            ) => {
              updatedActors.push(patch);
              return null;
            },
            updateToken: async (
              tokenId: string,
              patch: Partial<VttTokenModel>
            ) => {
              updatedTokens.push({ id: tokenId, patch });
              return null;
            },
            updateScene: async () => ({ error: null, needsMigration: false }),
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-light-1',
      name: 'Duskwood Watch',
      cover_image_url: null,
      gm_id: 'gm-light-1',
      invite_code: 'DUSK01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const scene: VttSceneModel = {
      id: 'scene-light-1',
      campaign_id: 'camp-light-1',
      gm_id: 'gm-light-1',
      folder_id: null,
      sort_order: 0,
      name: 'Whispering Pines',
      is_active_scene: true,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: DEFAULT_VTT_GRID_WIDTH,
      grid_height: DEFAULT_VTT_GRID_HEIGHT,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      round_number: 1,
      combat_active: false,
      active_turn_token_id: null,
      initiative_order: [],
      token_vision: true,
      fog_enabled: true,
      global_illumination: false,
      darkness_level: 0.5,
      walls: [],
      lights: [],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
      created_at: new Date().toISOString(),
    };
    vttStore.scenes.set([scene]);
    vttStore.activeSceneId.set('scene-light-1');

    const scoutActor: VttRosterActorModel = {
      id: 'actor-scout-1',
      campaign_id: 'camp-light-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: 'gm-light-1',
      actor_kind: 'character',
      is_unique: true,
      name: 'Pine Ranger',
      faction: 'ally',
      size: 1,
      icon: 'longbow',
      color: '#38B29A',
      max_hp: 14,
      max_sp: 8,
      max_ap: 4,
      armor_dr: 1,
      shield_block: 0,
      move_feet: 25,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: { __darkvision_feet: 10 },
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vttStore.rosterActors.set([scoutActor]);

    const scoutToken: VttTokenModel = {
      id: 'tok-scout-1',
      encounter_id: 'scene-light-1',
      character_id: null,
      owner_id: 'gm-light-1',
      name: 'Pine Ranger',
      faction: 'ally',
      x: 4,
      y: 4,
      q: 0,
      r: 0,
      world_x: null,
      world_y: null,
      size: 1,
      icon: 'longbow',
      color: '#38B29A',
      current_hp: 14,
      max_hp: 14,
      current_sp: 8,
      max_sp: 8,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 1,
      shield_block: 0,
      move_feet: 25,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: { __roster_actor_id: 'actor-scout-1', __darkvision_feet: 10 },
    };
    vttStore.tokens.set([scoutToken]);
    vttStore.selectedTokenId.set('tok-scout-1');

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp.getTokenEffectiveSightLabel(vttStore.tokens()[0])).toBe(
      '30ft (Dim 60ft · Dark 10ft)'
    );

    comp.openEditMapModal('scene-light-1', 'visibility');
    fixture.detectChanges();

    expect(
      findMatchingSceneLightingPreset(
        comp.editingMapDraft()!.global_illumination,
        comp.editingMapDraft()!.darkness_level
      )
    ).toBe('woods-dusk');
    expect(comp.getEditMapAmbientPercent(comp.editingMapDraft()!)).toBe(50);
    expect(comp.getEditMapStandardSightPreview(comp.editingMapDraft()!)).toContain(
      '30 ft'
    );

    const pitchPreset = VTT_SCENE_LIGHTING_PRESETS.find(
      (p) => p.id === 'pitch-black'
    )!;
    comp.applyEditMapLightingPreset(pitchPreset);
    expect(comp.editingMapDraft()!.global_illumination).toBe(false);
    expect(comp.editingMapDraft()!.darkness_level).toBe(1);
    expect(comp.getEditMapAmbientPercent(comp.editingMapDraft()!)).toBe(0);
    expect(comp.getEditMapStandardSightPreview(comp.editingMapDraft()!)).toContain(
      '10 ft'
    );

    const daylightPreset = VTT_SCENE_LIGHTING_PRESETS.find(
      (p) => p.id === 'daylight'
    )!;
    comp.applyEditMapLightingPreset(daylightPreset);
    expect(comp.editingMapDraft()!.global_illumination).toBe(true);
    expect(comp.editingMapDraft()!.darkness_level).toBe(0);
    expect(comp.getEditMapStandardSightPreview(comp.editingMapDraft()!)).toContain(
      'Unlimited'
    );

    comp.openEditRosterActorModal('actor-scout-1');
    expect(vttStore.openSheetRosterActor()?.id).toBe('actor-scout-1');
    expect(vttStore.openSheetRosterActor()?.vision_feet).toBe(60);
    expect(
      resolveActorDarkvisionFeet(
        vttStore.openSheetRosterActor()?.darkvision_feet,
        vttStore.openSheetRosterActor()?.npc_stats
      )
    ).toBe(10);

    await vttStore.updateNpcFromVttSheet('actor-scout-1', null, {
      vision_feet: 90,
      darkvision_feet: 25,
    });

    expect(updatedActors[0].vision_feet).toBe(90);
    expect(updatedActors[0].darkvision_feet).toBe(25);
    expect(updatedTokens[0].patch.vision_feet).toBe(90);
    expect(updatedTokens[0].patch.darkvision_feet).toBe(25);
    expect(vttStore.tokens()[0].vision_feet).toBe(90);
    expect(
      resolveActorDarkvisionFeet(
        vttStore.tokens()[0].darkvision_feet,
        vttStore.tokens()[0].npc_stats
      )
    ).toBe(25);
    expect(
      computeEffectiveActorSightFeet(90, 25, 0.5).effectiveSightFeet
    ).toBe(45);
    expect(comp.getTokenEffectiveSightLabel(vttStore.tokens()[0])).toBe(
      '45ft (Dim 90ft · Dark 25ft)'
    );
  });

  it('creates Player Characters and NPCs instantly in VTT without upfront weapon prompts and opens their floating sheet', async () => {
    let charCounter = 0;
    let actorCounter = 0;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({ id: 'gm-quick-1', email: 'gm@example.com' }),
            displayName: () => 'Warden',
            handle: () => 'warden',
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            ensureLoaded: async () => undefined,
            loadCompendium: async () => undefined,
            weapons: () => [],
            perkNodes: () => [],
            standaloneNodes: () => [],
            allWeapons: () => [],
            allPerkNodes: () => [],
            skillTrees: () => [],
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({ data: [], error: null }),
            insertCharacter: async (payload: Partial<CharacterModel>) => ({
              data: {
                ...(payload as CharacterModel),
                id: `quick-char-${++charCounter}`,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            subscribeToCampaignRoom: () => () => undefined,
            unsubscribeChannel: () => undefined,
            createRosterActor: async (input: Partial<VttRosterActorModel>) => ({
              actor: {
                ...(input as VttRosterActorModel),
                id: `quick-actor-${++actorCounter}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
            updateRosterActor: async () => null,
            updateToken: async () => null,
            updateScene: async () => ({ error: null, needsMigration: false }),
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-quick-1',
      name: 'Frontier Watch',
      cover_image_url: null,
      gm_id: 'gm-quick-1',
      invite_code: 'FRNT01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    comp.openCreateRosterActorModal(null);
    expect(comp.rosterActorModal()?.actor_kind).toBe('character');
    comp.updateRosterActorModalField('name', 'Kaelen Thorne');
    await comp.submitRosterActorModal();

    expect(vttStore.rosterActors().length).toBe(1);
    const createdPcActor = vttStore.rosterActors()[0];
    expect(createdPcActor.actor_kind).toBe('character');
    expect(createdPcActor.name).toBe('Kaelen Thorne');
    expect(createdPcActor.character_id).toBeNull();
    expect(createdPcActor.npc_stats.weapon_name).toBe('Unarmed');

    expect(vttStore.openSheetRosterActor()?.id).toBe(createdPcActor.id);
    expect(vttStore.openSheetCharacter()?.name).toBe('Kaelen Thorne');
    expect(vttStore.openSheetCharacter()?.equipped_armor).toBe('None');
    expect(vttStore.openSheetCharacter()?.inventory).toEqual([]);

    vttStore.closeActorSheet();
    expect(vttStore.openSheetTarget()).toBeNull();

    comp.openCreateRosterActorModal(null);
    comp.setRosterActorModalKind('npc');
    comp.updateRosterActorModalField('name', 'Tavern Keeper');
    await comp.submitRosterActorModal();

    expect(vttStore.rosterActors().length).toBe(2);
    const createdNpcActor = vttStore.rosterActors().find(
      (a) => a.name === 'Tavern Keeper'
    )!;
    expect(createdNpcActor.actor_kind).toBe('npc');
    expect(createdNpcActor.character_id).toBeNull();
    expect(vttStore.openSheetRosterActor()?.id).toBe(createdNpcActor.id);
    expect(vttStore.openSheetCharacter()).toBeNull();
  });

  it('allows Campaign GM to open a Player Character sheet in VTT, equip weapons/armor, gift inventory items, sync tokens, and roll checks', async () => {
    const updatedCharacterPayloads: Partial<CharacterModel>[] = [];
    const updatedRosterActors: {
      id: string;
      patch: Partial<VttRosterActorModel>;
    }[] = [];
    const updatedTokens: { id: string; patch: Partial<VttTokenModel> }[] = [];
    const postedLogs: Record<string, unknown>[] = [];

    const mockLongsword: WeaponModel = {
      id: 'wep-longsword-1',
      slug: 'iron-longsword',
      name: 'Iron Longsword',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 5,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: 'Balanced',
      trait_description: 'Reliable martial blade.',
      rule_hooks: {},
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({ id: 'gm-sheet-1', email: 'gm@example.com' }),
            displayName: () => 'Grand Warden',
            handle: () => 'warden',
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            ensureLoaded: async () => undefined,
            loadCompendium: async () => undefined,
            weapons: () => [mockLongsword],
            perkNodes: () => [],
            standaloneNodes: () => [],
            allWeapons: () => [mockLongsword],
            allPerkNodes: () => [],
            skillTrees: () => [],
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({ data: [], error: null }),
            updateCharacterRecord: async (
              _id: string,
              payload: Partial<CharacterModel>
            ) => {
              updatedCharacterPayloads.push(payload);
              return null;
            },
          },
        },
        {
          provide: VttService,
          useValue: {
            subscribeToCampaignRoom: () => () => undefined,
            unsubscribeChannel: () => undefined,
            updateRosterActor: async (
              _cid: string,
              aid: string,
              patch: Partial<VttRosterActorModel>
            ) => {
              updatedRosterActors.push({ id: aid, patch });
              return null;
            },
            updateToken: async (
              tid: string,
              patch: Partial<VttTokenModel>
            ) => {
              updatedTokens.push({ id: tid, patch });
              return null;
            },
            insertLog: async (entry: Record<string, unknown>) => {
              postedLogs.push(entry);
              return {
                id: `log-sheet-${postedLogs.length}`,
                campaign_id: 'camp-sheet-1',
                encounter_id: 'scene-sheet-1',
                sender_id: 'gm-sheet-1',
                sender_name: String(entry['sender_name'] ?? 'Grand Warden'),
                kind: String(entry['kind'] ?? 'roll') as 'roll',
                title: String(entry['title'] ?? ''),
                detail: (entry['detail'] as string | null) ?? null,
                payload: (entry['payload'] as Record<string, unknown>) ?? {},
                created_at: new Date().toISOString(),
              };
            },
            updateScene: async () => ({ error: null, needsMigration: false }),
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    const charStore = TestBed.inject(CharacterStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-sheet-1',
      name: 'Ashen Vale',
      cover_image_url: null,
      gm_id: 'gm-sheet-1',
      invite_code: 'ASHV01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const scene: VttSceneModel = {
      id: 'scene-sheet-1',
      campaign_id: 'camp-sheet-1',
      gm_id: 'gm-sheet-1',
      folder_id: null,
      sort_order: 0,
      name: 'Campfire Clearing',
      is_active_scene: true,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: DEFAULT_VTT_GRID_WIDTH,
      grid_height: DEFAULT_VTT_GRID_HEIGHT,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      round_number: 1,
      combat_active: false,
      active_turn_token_id: null,
      initiative_order: [],
      token_vision: true,
      fog_enabled: false,
      global_illumination: true,
      darkness_level: 0,
      walls: [],
      lights: [],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
      created_at: new Date().toISOString(),
    };
    vttStore.scenes.set([scene]);
    vttStore.activeSceneId.set('scene-sheet-1');

    const playerChar: CharacterModel = {
      id: 'char-player-1',
      owner_id: 'player-user-99',
      name: 'Lyra Vance',
      level: 1,
      attributes: {
        Brawn: 2,
        Agility: 1,
        Technique: 1,
        Iron: 1,
        Cunning: 0,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 0,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 0,
        Perception: 2,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'None',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 12,
      current_sp: 7,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
      created_at: new Date().toISOString(),
    };
    vttStore.allCharacters.set([playerChar]);
    charStore.upsertRealtimeCharacter(playerChar);

    const playerActor: VttRosterActorModel = {
      id: 'actor-player-1',
      campaign_id: 'camp-sheet-1',
      folder_id: null,
      character_id: 'char-player-1',
      collection_actor_id: null,
      owner_id: 'player-user-99',
      actor_kind: 'character',
      is_unique: true,
      name: 'Lyra Vance',
      faction: 'ally',
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      max_hp: 12,
      max_sp: 7,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: { weapon_name: 'Unarmed' },
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vttStore.rosterActors.set([playerActor]);

    const playerToken: VttTokenModel = {
      id: 'tok-player-1',
      encounter_id: 'scene-sheet-1',
      character_id: 'char-player-1',
      owner_id: 'player-user-99',
      name: 'Lyra Vance',
      faction: 'ally',
      x: 2,
      y: 2,
      q: 0,
      r: 0,
      world_x: null,
      world_y: null,
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      current_hp: 12,
      max_hp: 12,
      current_sp: 7,
      max_sp: 7,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: { __roster_actor_id: 'actor-player-1' },
    };
    vttStore.tokens.set([playerToken]);

    vttStore.openActorSheet('actor-player-1');
    expect(vttStore.canEditOpenSheet()).toBe(true);
    expect(vttStore.openSheetCharacter()?.name).toBe('Lyra Vance');

    await vttStore.updateCharacterFromVttSheet('char-player-1', (curr) => ({
      ...curr,
      equipped_armor: 'Medium',
      weapon_slot_1_id: 'wep-longsword-1',
      inventory: [
        {
          id: 'item-salve-1',
          name: 'Sunleaf Salve',
          quantity: 2,
          description: 'Restores 4 HP out of combat.',
        },
      ],
      notes: 'Carries the watchtower cipher.',
    }));

    expect(updatedCharacterPayloads.length).toBe(0);
    expect(vttStore.openSheetCharacter()?.equipped_armor).toBe('Medium');
    expect(vttStore.openSheetCharacter()?.inventory?.[0]?.name).toBe(
      'Sunleaf Salve'
    );
    expect(vttStore.openSheetCharacter()?.inventory?.[0]?.quantity).toBe(2);
    expect(vttStore.openSheetDerived()?.activeWeapon?.name).toBe(
      'Iron Longsword'
    );
    expect(vttStore.openSheetDerived()?.armorDr).toBe(2);

    const syncedActor = vttStore.rosterActors()[0];
    expect(syncedActor.armor_dr).toBe(2);
    expect(syncedActor.npc_stats.weapon_name).toBe('Iron Longsword');
    expect(syncedActor.npc_stats.__inventory?.[0]?.name).toBe('Sunleaf Salve');
    expect(syncedActor.notes).toBe('Carries the watchtower cipher.');

    const syncedToken = vttStore.tokens()[0];
    expect(syncedToken.armor_dr).toBe(2);
    expect(updatedTokens.length).toBeGreaterThan(0);

    await vttStore.rollActorSheetCheck({
      speakerName: 'Lyra Vance',
      speakerColor: '#38B29A',
      label: 'Perception Check',
      modifier: 2,
      detail: 'Cunning 0 + Perception 2',
    });

    expect(postedLogs.length).toBe(1);
    expect(vttStore.logs().length).toBe(1);
    expect(vttStore.logs()[0].title).toContain('Lyra Vance · Perception Check');
  });

  it('enforces explicit GM actor assignment, allows multiple tokens for Player Characters, gates HUD to owner/GM without Carried Light, keeps VTT sheet level read-only, and supports canvas token flip/stacking/visibility', async () => {
    const activeUserSig = signal<{
      id: string;
      email: string;
      name: string;
      handle: string;
    }>({
      id: 'gm-assign-1',
      email: 'gm@example.com',
      name: 'Grand Warden',
      handle: 'warden',
    });

    let actorSeq = 0;
    let tokenSeq = 0;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({
              id: activeUserSig().id,
              email: activeUserSig().email,
            }),
            displayName: () => activeUserSig().name,
            handle: () => activeUserSig().handle,
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            ensureLoaded: async () => undefined,
            loadCompendium: async () => undefined,
            weapons: () => [],
            perkNodes: () => [],
            standaloneNodes: () => [],
            allWeapons: () => [],
            allPerkNodes: () => [],
            skillTrees: () => [],
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({ data: [], error: null }),
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            subscribeToCampaignRoom: () => () => undefined,
            unsubscribeChannel: () => undefined,
            createRosterActor: async (input: Partial<VttRosterActorModel>) => ({
              actor: {
                ...(input as VttRosterActorModel),
                id: `assign-actor-${++actorSeq}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
            updateRosterActor: async () => null,
            insertToken: async (payload: Partial<VttTokenModel>) => ({
              token: {
                ...(payload as VttTokenModel),
                id: `assign-tok-${++tokenSeq}`,
              },
              error: null,
            }),
            updateToken: async () => null,
            deleteToken: async () => null,
            updateScene: async () => ({ error: null, needsMigration: false }),
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    const charStore = TestBed.inject(CharacterStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-assign-1',
      name: 'Irongate Keep',
      cover_image_url: null,
      gm_id: 'gm-assign-1',
      invite_code: 'IRON01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.participants.set([
      {
        user_id: 'gm-assign-1',
        handle: 'warden',
        display_name: 'Grand Warden',
        role: 'gm',
      },
      {
        user_id: 'player-1',
        handle: 'sera',
        display_name: 'Sera',
        role: 'player',
      },
      {
        user_id: 'player-2',
        handle: 'bren',
        display_name: 'Bren',
        role: 'player',
      },
    ]);

    const scene: VttSceneModel = {
      id: 'scene-assign-1',
      campaign_id: 'camp-assign-1',
      gm_id: 'gm-assign-1',
      folder_id: null,
      sort_order: 0,
      name: 'Courtyard',
      is_active_scene: true,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: DEFAULT_VTT_GRID_WIDTH,
      grid_height: DEFAULT_VTT_GRID_HEIGHT,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      round_number: 1,
      combat_active: false,
      active_turn_token_id: null,
      initiative_order: [],
      token_vision: true,
      fog_enabled: false,
      global_illumination: true,
      darkness_level: 0,
      walls: [],
      lights: [],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
      created_at: new Date().toISOString(),
    };
    vttStore.scenes.set([scene]);
    vttStore.activeSceneId.set('scene-assign-1');

    const seraCharacter: CharacterModel = {
      id: 'char-sera-1',
      owner_id: 'player-1',
      name: 'Sera Vane',
      level: 3,
      attributes: {
        Brawn: 2,
        Agility: 2,
        Technique: 1,
        Iron: 1,
        Cunning: 0,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 1,
        Tinkering: 0,
        Medicine: 0,
        Survival: 0,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Light',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 14,
      current_sp: 8,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
      created_at: new Date().toISOString(),
    };
    vttStore.allCharacters.set([seraCharacter]);
    charStore.upsertRealtimeCharacter(seraCharacter);

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(vttStore.assignablePlayers().map((p) => p.user_id)).toEqual([
      'player-1',
      'player-2',
    ]);

    const importedActor = await vttStore.importCharacterToRoster(
      seraCharacter,
      null
    );
    expect(importedActor).not.toBeNull();
    expect(importedActor!.owner_id).toBeNull();
    expect(vttStore.getActorAssignedUserId(importedActor!)).toBeNull();

    await vttStore.deployRosterActor(importedActor!.id, {
      worldPt: { x: 400, y: 400 },
      unsnapped: false,
    });
    await vttStore.deployRosterActor(importedActor!.id, {
      worldPt: { x: 500, y: 400 },
      unsnapped: false,
    });
    expect(vttStore.tokens().length).toBe(2);
    expect(
      comp.getDeployedTokensForRosterActor(vttStore.rosterActors()[0]).length
    ).toBe(2);

    const firstTokenId = vttStore.tokens()[0].id;
    const secondTokenId = vttStore.tokens()[1].id;
    expect(firstTokenId).not.toBe(secondTokenId);
    expect(vttStore.tokens()[0].owner_id).toBeNull();

    vttStore.openActorSheet(importedActor!.id);
    fixture.detectChanges();
    const sheetEl = (fixture.nativeElement as HTMLElement).querySelector(
      'section[aria-label="Actor Sheet"]'
    );
    expect(sheetEl).not.toBeNull();
    expect(sheetEl!.textContent).toContain('Lv');
    expect(sheetEl!.textContent).toContain('3');
    expect(sheetEl!.textContent).toContain('Full Page');
    const levelBadge = sheetEl!.querySelector(
      '[title="Level up in the Character Sheet (Full Page)"]'
    );
    expect(levelBadge).not.toBeNull();
    expect(levelBadge!.querySelectorAll('button').length).toBe(0);
    vttStore.closeActorSheet();

    activeUserSig.set({
      id: 'player-1',
      email: 'sera@example.com',
      name: 'Sera',
      handle: 'sera',
    });
    vttStore.selectedTokenId.set(firstTokenId);
    fixture.detectChanges();

    expect(comp.visibleCampaignRosterActors().length).toBe(0);
    expect(vttStore.canControlToken(vttStore.tokens()[0])).toBe(false);
    vttStore.openActorSheet(importedActor!.id);
    expect(vttStore.openSheetTarget()).toBeNull();
    vttStore.openTokenSheet(firstTokenId);
    expect(vttStore.openSheetTarget()).toBeNull();

    const unassignedHudText =
      (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(unassignedHudText).not.toContain('1 AP: Stance Recovery');

    activeUserSig.set({
      id: 'gm-assign-1',
      email: 'gm@example.com',
      name: 'Grand Warden',
      handle: 'warden',
    });
    await vttStore.assignRosterActorToPlayer(importedActor!.id, 'player-1');

    expect(
      vttStore.getActorAssignedUserId(vttStore.rosterActors()[0])
    ).toBe('player-1');
    expect(vttStore.tokens()[0].owner_id).toBe('player-1');
    expect(vttStore.tokens()[1].owner_id).toBe('player-1');

    activeUserSig.set({
      id: 'player-1',
      email: 'sera@example.com',
      name: 'Sera',
      handle: 'sera',
    });
    vttStore.selectedTokenId.set(firstTokenId);
    fixture.detectChanges();

    expect(comp.visibleCampaignRosterActors().length).toBe(1);
    expect(vttStore.canControlToken(vttStore.tokens()[0])).toBe(true);
    const assignedHudText =
      (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(assignedHudText).toContain('1 AP: Stance Recovery');
    expect(assignedHudText).not.toContain('Carried Light');
    expect(assignedHudText).not.toContain('Lantern 30ft');
    expect(assignedHudText).not.toContain('Torch 40ft');

    vttStore.openTokenSheet(firstTokenId);
    expect(vttStore.openSheetCharacter()?.name).toBe('Sera Vane');
    expect(
      resolveRosterActorSourceCharacterId(vttStore.openSheetRosterActor())
    ).toBe('char-sera-1');
    expect(vttStore.canEditOpenSheet()).toBe(true);
    vttStore.closeActorSheet();

    activeUserSig.set({
      id: 'player-2',
      email: 'bren@example.com',
      name: 'Bren',
      handle: 'bren',
    });
    vttStore.selectedTokenId.set(firstTokenId);
    fixture.detectChanges();

    expect(vttStore.selectedTokenId()).toBe(firstTokenId);
    expect(vttStore.canControlToken(vttStore.tokens()[0])).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent ?? '').not.toContain(
      '1 AP: Stance Recovery'
    );

    activeUserSig.set({
      id: 'gm-assign-1',
      email: 'gm@example.com',
      name: 'Grand Warden',
      handle: 'warden',
    });
    fixture.detectChanges();

    const canvasComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find((inst): inst is VttCanvasComponent => inst instanceof VttCanvasComponent)!;
    expect(canvasComp).toBeTruthy();

    await vttStore.toggleTokenFlipX(firstTokenId);
    fixture.detectChanges();
    const renderedFirstAfterFlipX = canvasComp
      .renderableTokens()
      .find((r) => r.token.id === firstTokenId)!;
    expect(renderedFirstAfterFlipX.flipX).toBe(true);
    expect(renderedFirstAfterFlipX.artTransform).toBe('scaleX(-1)');

    await vttStore.toggleTokenFlipY(firstTokenId);
    fixture.detectChanges();
    const renderedFirstAfterBoth = canvasComp
      .renderableTokens()
      .find((r) => r.token.id === firstTokenId)!;
    expect(renderedFirstAfterBoth.flipY).toBe(true);
    expect(renderedFirstAfterBoth.artTransform).toBe('scale(-1, -1)');

    await vttStore.bringTokenToFront(firstTokenId);
    fixture.detectChanges();
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([
      secondTokenId,
      firstTokenId,
    ]);

    await vttStore.sendTokenToBack(firstTokenId);
    fixture.detectChanges();
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([
      firstTokenId,
      secondTokenId,
    ]);

    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(canvasComp.renderableTokens().map((r) => r.token.id)).toEqual([
      secondTokenId,
      firstTokenId,
    ]);

    await vttStore.toggleTokenHidden(firstTokenId);
    expect(
      vttStore.tokens().find((t) => t.id === firstTokenId)?.is_hidden
    ).toBe(true);
  });

  it('should render VTT modals as draggable floating windows, prevent input drag-highlight dismissal, and stack focused windows to the front', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent, AssetBrowserModalComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => ({
              id: 'gm-win-1',
              email: 'gm@example.com',
            }),
            displayName: () => 'Grand Warden',
            handle: () => 'warden',
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            ensureLoaded: async () => undefined,
            loadCompendium: async () => undefined,
            weapons: () => [],
            perkNodes: () => [],
            standaloneNodes: () => [],
            allWeapons: () => [],
            allPerkNodes: () => [],
            skillTrees: () => [],
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({ data: [], error: null }),
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: UserAssetsService,
          useValue: {
            hasBootstrappedStarterFolders: () => true,
            markStarterFoldersBootstrapped: () => undefined,
            fetchAssetsBundle: async () => ({
              folders: [],
              assets: [],
              preferences: {
                owner_id: 'gm-win-1',
                maps_folder_id: null,
                characters_folder_id: null,
              },
              fallback: false,
              error: null,
              usedRpc: true,
            }),
            fetchFolders: async () => ({ folders: [], error: null }),
            fetchAssets: async () => ({ assets: [], error: null }),
            fetchPreferences: async () => ({
              owner_id: 'gm-win-1',
              maps_folder_id: null,
              characters_folder_id: null,
            }),
          },
        },
        {
          provide: VttService,
          useValue: {
            subscribeToCampaignRoom: () => () => undefined,
            unsubscribeChannel: () => undefined,
            updateScene: async () => ({ error: null, needsMigration: false }),
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-win-1',
      name: 'Emberwatch',
      cover_image_url: null,
      gm_id: 'gm-win-1',
      invite_code: 'EMBR01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const scene: VttSceneModel = {
      id: 'scene-win-1',
      campaign_id: 'camp-win-1',
      gm_id: 'gm-win-1',
      folder_id: null,
      sort_order: 0,
      name: 'Sunlit Citadel',
      is_active_scene: true,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: DEFAULT_VTT_GRID_WIDTH,
      grid_height: DEFAULT_VTT_GRID_HEIGHT,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      round_number: 1,
      combat_active: false,
      active_turn_token_id: null,
      initiative_order: [],
      token_vision: true,
      fog_enabled: false,
      global_illumination: true,
      darkness_level: 0,
      walls: [],
      lights: [
        {
          id: 'light-win-1',
          x: 280,
          y: 280,
          bright_feet: 20,
          dim_feet: 40,
          color: '#FF9B42',
          enabled: true,
        },
      ],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
      created_at: new Date().toISOString(),
    };
    vttStore.scenes.set([scene]);
    vttStore.activeSceneId.set('scene-win-1');

    const npcActor: VttRosterActorModel = {
      id: 'actor-win-1',
      campaign_id: 'camp-win-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'npc',
      is_unique: false,
      name: 'Citadel Sentry',
      faction: 'neutral',
      size: 1,
      icon: 'battleaxe',
      color: '#F59E0B',
      max_hp: 16,
      max_sp: 6,
      max_ap: 3,
      armor_dr: 2,
      shield_block: 1,
      move_feet: 20,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: { weapon_name: 'Halberd', reach_feet: 10 },
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vttStore.rosterActors.set([npcActor]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    const rootEl = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    vttStore.openActorSheet('actor-win-1');
    comp.openEditMapModal('scene-win-1', 'general');
    fixture.detectChanges();

    const actorSheetComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttActorSheetComponent =>
          inst instanceof VttActorSheetComponent
      )!;
    const sceneWindowComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttFloatingWindowComponent =>
          inst instanceof VttFloatingWindowComponent &&
          inst.windowTitle() === 'Scene Configuration'
      )!;
    expect(actorSheetComp).toBeTruthy();
    expect(sceneWindowComp).toBeTruthy();

    expect(sceneWindowComp.zIndex()).toBeGreaterThan(actorSheetComp.zIndex());

    const actorSheetEl = rootEl.querySelector(
      'section[aria-label="Actor Sheet"]'
    ) as HTMLElement;
    actorSheetEl.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0 })
    );
    fixture.detectChanges();
    expect(actorSheetComp.zIndex()).toBeGreaterThan(sceneWindowComp.zIndex());

    const sceneWindowEl = rootEl.querySelector(
      'section[aria-label="Scene Configuration"]'
    ) as HTMLElement;
    const sceneHeaderEl = sceneWindowEl.firstElementChild as HTMLElement;
    const startX = sceneWindowComp.windowX();
    const startY = sceneWindowComp.windowY();

    sceneHeaderEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: startX + 40,
        clientY: startY + 18,
      })
    );
    expect(sceneWindowComp.zIndex()).toBeGreaterThan(actorSheetComp.zIndex());

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: startX + 160,
        clientY: startY + 98,
      })
    );
    window.dispatchEvent(new PointerEvent('pointerup'));
    fixture.detectChanges();

    expect(sceneWindowComp.windowX()).toBe(startX + 120);
    expect(sceneWindowComp.windowY()).toBe(startY + 80);

    const movedX = sceneWindowComp.windowX();
    const movedY = sceneWindowComp.windowY();
    const sceneNameInput = sceneWindowEl.querySelector(
      'input[name="editMapName"]'
    ) as HTMLInputElement;
    expect(sceneNameInput).toBeTruthy();

    sceneNameInput.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: movedX + 50,
        clientY: movedY + 120,
      })
    );
    sceneNameInput.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: movedX + 50,
        clientY: movedY + 120,
      })
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 12,
        clientY: 12,
      })
    );
    rootEl.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 12,
        clientY: 12,
      })
    );
    rootEl.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        button: 0,
        clientX: 12,
        clientY: 12,
      })
    );
    rootEl.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        button: 0,
        clientX: 12,
        clientY: 12,
      })
    );
    fixture.detectChanges();

    expect(comp.editingMapDraft()).not.toBeNull();
    expect(sceneWindowComp.windowX()).toBe(movedX);
    expect(sceneWindowComp.windowY()).toBe(movedY);

    sceneWindowComp.toggleMinimize();
    fixture.detectChanges();
    expect(sceneWindowComp.minimized()).toBe(true);
    expect(sceneWindowEl.querySelector('input[name="editMapName"]')).toBeNull();

    sceneWindowComp.toggleMinimize();
    fixture.detectChanges();
    expect(sceneWindowComp.minimized()).toBe(false);
    expect(sceneWindowEl.querySelector('input[name="editMapName"]')).toBeTruthy();

    comp.openSceneAssetPicker();
    fixture.detectChanges();

    const assetBrowserComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is AssetBrowserModalComponent =>
          inst instanceof AssetBrowserModalComponent
      )!;
    expect(assetBrowserComp.floating()).toBe(true);
    expect(assetBrowserComp.zIndex()).toBeGreaterThan(sceneWindowComp.zIndex());

    const canvasComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttCanvasComponent => inst instanceof VttCanvasComponent
      )!;
    canvasComp.openEditLightModal('light-win-1');
    comp.openCreateMapModal(null);
    comp.openCreateFolderModal('maps', null);
    comp.openCreateRosterActorModal(null);
    comp.openRosterImportModal(null);
    comp.openSettingsModal('general');
    fixture.detectChanges();

    expect(
      rootEl.querySelector(
        'section[data-vtt-floating-window="true"][aria-label="General Settings"]'
      )
    ).toBeTruthy();

    comp.openInGameMenu();
    fixture.detectChanges();

    expect(
      rootEl.querySelector(
        'section[data-vtt-floating-window="true"][aria-label="In-Game Menu"]'
      )
    ).toBeTruthy();

    const floatingSections = rootEl.querySelectorAll(
      'section[data-vtt-floating-window="true"]'
    );
    expect(floatingSections.length).toBe(9);

    const backdropModals = Array.from(
      rootEl.querySelectorAll('div.fixed.inset-0')
    ).filter((el) => !el.classList.contains('pointer-events-none'));
    expect(backdropModals.length).toBe(0);

    const standaloneAssetFixture = TestBed.createComponent(
      AssetBrowserModalComponent
    );
    standaloneAssetFixture.componentRef.setInput('open', true);
    standaloneAssetFixture.componentRef.setInput('floating', false);
    standaloneAssetFixture.detectChanges();

    let standaloneClosedCount = 0;
    standaloneAssetFixture.componentInstance.closed.subscribe(() => {
      standaloneClosedCount++;
    });

    const standaloneRoot = standaloneAssetFixture.nativeElement as HTMLElement;
    const standaloneBackdrop = standaloneRoot.querySelector(
      'div.fixed.inset-0'
    ) as HTMLElement;
    expect(standaloneBackdrop).toBeTruthy();

    standaloneBackdrop.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0 })
    );
    expect(standaloneClosedCount).toBe(0);

    standaloneBackdrop.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0 })
    );
    expect(standaloneClosedCount).toBe(1);
  });

  it('should support marquee drag-select, shift+click multi-selection, group drag & batch actions, and shift+wheel rotation with coalesced undo', async () => {
    const activeUserSig = signal<{
      id: string;
      email: string;
    }>({
      id: 'gm-multi-1',
      email: 'gm@example.com',
    });

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            waitForInit: async () => undefined,
            user: () => activeUserSig(),
            displayName: () => 'Grand Warden',
            handle: () => 'warden',
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            ensureLoaded: async () => undefined,
            loadCompendium: async () => undefined,
            weapons: () => [],
            perkNodes: () => [],
            standaloneNodes: () => [],
            allWeapons: () => [],
            allPerkNodes: () => [],
            skillTrees: () => [],
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({ data: [], error: null }),
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: UserAssetsService,
          useValue: {
            hasBootstrappedStarterFolders: () => true,
            markStarterFoldersBootstrapped: () => undefined,
            fetchAssetsBundle: async () => ({
              folders: [],
              assets: [],
              preferences: {
                owner_id: 'gm-multi-1',
                maps_folder_id: null,
                characters_folder_id: null,
              },
              fallback: false,
              error: null,
              usedRpc: true,
            }),
            fetchFolders: async () => ({ folders: [], error: null }),
            fetchAssets: async () => ({ assets: [], error: null }),
            fetchPreferences: async () => ({
              owner_id: 'gm-multi-1',
              maps_folder_id: null,
              characters_folder_id: null,
            }),
          },
        },
        {
          provide: VttService,
          useValue: {
            subscribeToCampaignRoom: () => () => undefined,
            unsubscribeChannel: () => undefined,
            updateScene: async () => ({ error: null, needsMigration: false }),
            updateToken: async () => null,
            deleteToken: async () => null,
            insertToken: async (
              payload: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...payload,
                id: payload.id ?? `restored-${payload.name}`,
              } as VttTokenModel,
              error: null,
            }),
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.campaign.set({
      id: 'camp-multi-1',
      name: 'Shattered Reach',
      cover_image_url: null,
      gm_id: 'gm-multi-1',
      invite_code: 'MLTI01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });

    const scene: VttSceneModel = {
      id: 'scene-multi-1',
      campaign_id: 'camp-multi-1',
      gm_id: 'gm-multi-1',
      folder_id: null,
      sort_order: 0,
      name: 'Courtyard',
      is_active_scene: true,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: 1400,
      scene_height: 980,
      padding: 0,
      grid_width: 20,
      grid_height: 14,
      grid_size_px: 70,
      grid_offset_x: 0,
      grid_offset_y: 0,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      round_number: 1,
      combat_active: false,
      active_turn_token_id: null,
      initiative_order: [],
      token_vision: false,
      fog_enabled: false,
      global_illumination: true,
      darkness_level: 0,
      walls: [],
      lights: [],
      explored_fog: { cells: [], revealed_all: false },
      pending_clash: null,
      created_at: new Date().toISOString(),
    };
    vttStore.scenes.set([scene]);
    vttStore.activeSceneId.set('scene-multi-1');

    const makeTok = (
      id: string,
      name: string,
      col: number,
      row: number,
      ownerId: string | null,
      faction: 'ally' | 'enemy'
    ): VttTokenModel => ({
      id,
      encounter_id: 'scene-multi-1',
      character_id: null,
      owner_id: ownerId,
      name,
      faction,
      size: 1,
      icon: 'greatsword',
      color: faction === 'ally' ? '#38B29A' : '#F43F5E',
      x: col,
      y: row,
      q: col,
      r: row,
      world_x: null,
      world_y: null,
      current_hp: 20,
      max_hp: 20,
      current_sp: 10,
      max_sp: 10,
      current_ap: 4,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 0,
      shield_raised: false,
      move_feet: 20,
      vision_feet: 60,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      is_hidden: false,
      statuses: [],
      npc_stats: {},
    });

    vttStore.tokens.set([
      makeTok('tok-m1', 'Vanguard A', 2, 2, 'player-m1', 'ally'),
      makeTok('tok-m2', 'Vanguard B', 4, 2, 'player-m1', 'ally'),
      makeTok('tok-m3', 'Raider Captain', 12, 9, null, 'enemy'),
    ]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    const rootEl = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await Promise.resolve();

    const canvasComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find((inst): inst is VttCanvasComponent => inst instanceof VttCanvasComponent)!;
    expect(canvasComp).toBeTruthy();

    canvasComp.zoom.set(1);
    canvasComp.panX.set(0);
    canvasComp.panY.set(0);
    fixture.detectChanges();

    const vpEl = canvasComp.viewportRef().nativeElement;
    vi.spyOn(vpEl, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1400,
      bottom: 980,
      width: 1400,
      height: 980,
      toJSON: () => ({}),
    } as DOMRect);

    canvasComp.onViewportPointerDown(
      new PointerEvent('pointerdown', { button: 0, clientX: 80, clientY: 80 })
    );
    canvasComp.onWindowPointerMove(
      new PointerEvent('pointermove', {
        buttons: 1,
        clientX: 400,
        clientY: 260,
      })
    );
    fixture.detectChanges();

    expect(rootEl.querySelector('[data-vtt-marquee="true"]')).toBeTruthy();
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1', 'tok-m2']);

    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', { button: 0, clientX: 400, clientY: 260 })
    );
    fixture.detectChanges();

    expect(rootEl.querySelector('[data-vtt-marquee="true"]')).toBeNull();
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1', 'tok-m2']);
    expect(rootEl.querySelector('[data-vtt-multi-hud="true"]')).toBeTruthy();
    expect(rootEl.textContent ?? '').toContain('2 Tokens Selected');

    canvasComp.onViewportPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 760,
        clientY: 560,
        shiftKey: true,
      })
    );
    canvasComp.onWindowPointerMove(
      new PointerEvent('pointermove', {
        buttons: 1,
        clientX: 960,
        clientY: 740,
        shiftKey: true,
      })
    );
    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', {
        button: 0,
        clientX: 960,
        clientY: 740,
        shiftKey: true,
      })
    );
    fixture.detectChanges();
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1', 'tok-m2', 'tok-m3']);

    activeUserSig.set({ id: 'player-m1', email: 'player@example.com' });
    vttStore.clearTokenSelection();
    fixture.detectChanges();

    canvasComp.onViewportPointerDown(
      new PointerEvent('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    );
    canvasComp.onWindowPointerMove(
      new PointerEvent('pointermove', {
        buttons: 1,
        clientX: 1100,
        clientY: 850,
      })
    );
    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', { button: 0, clientX: 1100, clientY: 850 })
    );
    fixture.detectChanges();
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1', 'tok-m2']);

    activeUserSig.set({ id: 'gm-multi-1', email: 'gm@example.com' });
    vttStore.clearTokenSelection();
    fixture.detectChanges();

    const r1 = canvasComp.renderableTokens().find((r) => r.token.id === 'tok-m1')!;
    const r2 = canvasComp.renderableTokens().find((r) => r.token.id === 'tok-m2')!;

    canvasComp.onTokenPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: r1.center.x,
        clientY: r1.center.y,
      }),
      r1
    );
    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', {
        button: 0,
        clientX: r1.center.x,
        clientY: r1.center.y,
      })
    );
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1']);
    fixture.detectChanges();

    const m1SelBox = rootEl.querySelector(
      '[data-token-id="tok-m1"] [data-token-selection-box="true"]'
    ) as HTMLElement | null;
    expect(m1SelBox).toBeTruthy();
    expect(m1SelBox?.style.width).toBe(`${r1.tileSizePx}px`);
    expect(m1SelBox?.style.height).toBe(`${r1.tileSizePx}px`);
    expect(
      rootEl.querySelector(
        '[data-token-id="tok-m2"] [data-token-selection-box="true"]'
      )
    ).toBeNull();

    canvasComp.onTokenPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: r2.center.x,
        clientY: r2.center.y,
        shiftKey: true,
      }),
      r2
    );
    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', {
        button: 0,
        clientX: r2.center.x,
        clientY: r2.center.y,
        shiftKey: true,
      })
    );
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1', 'tok-m2']);
    fixture.detectChanges();
    expect(
      rootEl.querySelectorAll('[data-token-selection-box="true"]').length
    ).toBe(2);

    const r2Selected = canvasComp
      .renderableTokens()
      .find((r) => r.token.id === 'tok-m2')!;
    canvasComp.onTokenPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: r2Selected.center.x,
        clientY: r2Selected.center.y,
        shiftKey: true,
      }),
      r2Selected
    );
    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', {
        button: 0,
        clientX: r2Selected.center.x,
        clientY: r2Selected.center.y,
        shiftKey: true,
      })
    );
    expect(vttStore.selectedTokenIds()).toEqual(['tok-m1']);

    vttStore.setSelectedTokens(['tok-m1', 'tok-m2']);
    vttStore.undoStack.set([]);
    fixture.detectChanges();

    const zoomBeforeWheel = canvasComp.zoom();
    canvasComp.onWheel(
      new WheelEvent('wheel', {
        deltaY: 120,
        shiftKey: true,
        clientX: 300,
        clientY: 300,
      })
    );
    canvasComp.onWheel(
      new WheelEvent('wheel', {
        deltaY: 0,
        deltaX: 120,
        shiftKey: true,
        clientX: 300,
        clientY: 300,
      })
    );
    canvasComp.onWheel(
      new WheelEvent('wheel', {
        deltaY: -120,
        shiftKey: true,
        ctrlKey: true,
        clientX: 300,
        clientY: 300,
      })
    );
    await Promise.resolve();
    fixture.detectChanges();

    expect(canvasComp.zoom()).toBe(zoomBeforeWheel);
    const rotTok1 = canvasComp
      .renderableTokens()
      .find((r) => r.token.id === 'tok-m1')!;
    const rotTok2 = canvasComp
      .renderableTokens()
      .find((r) => r.token.id === 'tok-m2')!;
    expect(rotTok1.rotationDeg).toBe(25);
    expect(rotTok2.rotationDeg).toBe(25);
    expect(rotTok1.artTransform).toBe('rotate(25deg)');
    expect(vttStore.undoStack().length).toBe(1);

    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(
      canvasComp.renderableTokens().find((r) => r.token.id === 'tok-m1')!
        .rotationDeg
    ).toBe(0);
    expect(
      canvasComp.renderableTokens().find((r) => r.token.id === 'tok-m2')!
        .artTransform
    ).toBe('none');

    vttStore.clearTokenSelection();
    fixture.detectChanges();
    canvasComp.onWheel(
      new WheelEvent('wheel', {
        deltaY: -120,
        shiftKey: true,
        clientX: r1.center.x,
        clientY: r1.center.y,
      })
    );
    await Promise.resolve();
    fixture.detectChanges();
    expect(
      canvasComp.renderableTokens().find((r) => r.token.id === 'tok-m1')!
        .rotationDeg
    ).toBe(345);
    await vttStore.setTokensRotation(['tok-m1'], 0);
    fixture.detectChanges();

    vttStore.setSelectedTokens(['tok-m1', 'tok-m2']);
    fixture.detectChanges();

    comp.toggleMultiSelectedHidden();
    await Promise.resolve();
    fixture.detectChanges();
    expect(vttStore.tokens().find((t) => t.id === 'tok-m1')?.is_hidden).toBe(
      true
    );
    expect(vttStore.tokens().find((t) => t.id === 'tok-m2')?.is_hidden).toBe(
      true
    );
    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(vttStore.tokens().find((t) => t.id === 'tok-m1')?.is_hidden).toBe(
      false
    );
    expect(vttStore.tokens().find((t) => t.id === 'tok-m2')?.is_hidden).toBe(
      false
    );

    await vttStore.flipTokensHorizontal(['tok-m1', 'tok-m2']);
    await vttStore.rotateTokensByDelta(['tok-m1', 'tok-m2'], 90);
    fixture.detectChanges();
    expect(
      canvasComp.renderableTokens().find((r) => r.token.id === 'tok-m1')!
        .artTransform
    ).toBe('rotate(90deg) scaleX(-1)');

    await vttStore.sendTokensToBack(['tok-m3']);
    fixture.detectChanges();
    expect(canvasComp.renderableTokens()[0].token.id).toBe('tok-m3');
    await vttStore.bringTokensToFront(['tok-m3']);
    fixture.detectChanges();
    expect(canvasComp.renderableTokens()[2].token.id).toBe('tok-m3');

    vttStore.setSelectedTokens(['tok-m1', 'tok-m2']);
    fixture.detectChanges();
    const dragR1 = canvasComp
      .renderableTokens()
      .find((r) => r.token.id === 'tok-m1')!;
    canvasComp.onTokenPointerDown(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: dragR1.center.x,
        clientY: dragR1.center.y,
      }),
      dragR1
    );
    canvasComp.onWindowPointerMove(
      new PointerEvent('pointermove', {
        buttons: 1,
        clientX: dragR1.center.x + 140,
        clientY: dragR1.center.y + 70,
      })
    );
    canvasComp.onWindowPointerUp(
      new PointerEvent('pointerup', {
        button: 0,
        clientX: dragR1.center.x + 140,
        clientY: dragR1.center.y + 70,
      })
    );
    await Promise.resolve();
    fixture.detectChanges();

    expect(vttStore.tokens().find((t) => t.id === 'tok-m1')?.x).toBe(4);
    expect(vttStore.tokens().find((t) => t.id === 'tok-m1')?.y).toBe(3);
    expect(vttStore.tokens().find((t) => t.id === 'tok-m2')?.x).toBe(6);
    expect(vttStore.tokens().find((t) => t.id === 'tok-m2')?.y).toBe(3);

    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(vttStore.tokens().find((t) => t.id === 'tok-m1')?.x).toBe(2);
    expect(vttStore.tokens().find((t) => t.id === 'tok-m1')?.y).toBe(2);
    expect(vttStore.tokens().find((t) => t.id === 'tok-m2')?.x).toBe(4);
    expect(vttStore.tokens().find((t) => t.id === 'tok-m2')?.y).toBe(2);

    await vttStore.removeTokensBatch(['tok-m1', 'tok-m2']);
    fixture.detectChanges();
    expect(vttStore.tokens().map((t) => t.id)).toEqual(['tok-m3']);

    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(vttStore.tokens().length).toBe(3);

    const allyOne = vttStore.tokens().find((t) => t.name === 'Vanguard A')!;
    expect(allyOne).toBeTruthy();
    vttStore.selectSingleToken(allyOne.id);
    fixture.detectChanges();

    const inputTarget = document.createElement('input');
    const delInInputEvent = new KeyboardEvent('keydown', {
      key: 'Delete',
      code: 'Delete',
      cancelable: true,
    });
    Object.defineProperty(delInInputEvent, 'target', { value: inputTarget });
    comp.onGlobalKeyDown(delInInputEvent);
    await Promise.resolve();
    fixture.detectChanges();
    expect(vttStore.tokens().length).toBe(3);

    const singleDelEvent = new KeyboardEvent('keydown', {
      key: 'Delete',
      code: 'Delete',
      cancelable: true,
    });
    comp.onGlobalKeyDown(singleDelEvent);
    await Promise.resolve();
    fixture.detectChanges();
    expect(singleDelEvent.defaultPrevented).toBe(true);
    expect(vttStore.tokens().some((t) => t.name === 'Vanguard A')).toBe(false);
    expect(vttStore.selectedTokenIds()).toEqual([]);

    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(vttStore.tokens().length).toBe(3);

    const allyIds = vttStore
      .tokens()
      .filter((t) => t.faction === 'ally')
      .map((t) => t.id);
    expect(allyIds.length).toBe(2);
    vttStore.setSelectedTokens(allyIds);
    vttStore.undoStack.set([]);
    fixture.detectChanges();

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        code: 'Delete',
        cancelable: true,
      })
    );
    await Promise.resolve();
    fixture.detectChanges();
    expect(vttStore.tokens().map((t) => t.id)).toEqual(['tok-m3']);
    expect(vttStore.undoStack().length).toBe(1);

    await vttStore.undoLastAction();
    fixture.detectChanges();
    expect(vttStore.tokens().length).toBe(3);

    activeUserSig.set({ id: 'player-m1', email: 'player@example.com' });
    vttStore.selectSingleToken('tok-m3');
    fixture.detectChanges();

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        code: 'Delete',
        cancelable: true,
      })
    );
    await Promise.resolve();
    fixture.detectChanges();
    expect(vttStore.tokens().some((t) => t.id === 'tok-m3')).toBe(true);
  });

  it('should normalize token appearance, render vector and custom PNG frames in TokenAvatarComponent, and support interactive TokenizerEditorComponent pan, zoom, and Stamp from Portrait', async () => {
    expect(clampTokenScale(0.1)).toBe(0.5);
    expect(clampTokenScale(9.5)).toBe(3);
    expect(clampTokenScale(1.456)).toBe(1.46);
    expect(clampTokenOffset(-250)).toBe(-100);
    expect(clampTokenOffset(250)).toBe(100);

    const normalized = normalizeTokenAppearance({
      shape: 'circle',
      frame: 'ornate',
      frame_color: 'f59e0b',
      scale: 1.6,
      offset_x: 18.4,
      offset_y: -24.2,
    });
    expect(normalized).toEqual({
      shape: 'circle',
      frame: 'ornate',
      frame_color: '#F59E0B',
      custom_frame_url: null,
      scale: 1.6,
      offset_x: 18.4,
      offset_y: -24.2,
    });
    expect(hasCustomTokenAppearance(DEFAULT_TOKEN_APPEARANCE)).toBe(false);
    expect(hasCustomTokenAppearance(normalized)).toBe(true);
    expect(buildTokenImagePanZoomTransform(DEFAULT_TOKEN_APPEARANCE)).toBe(
      'none'
    );
    expect(buildTokenImagePanZoomTransform(normalized)).toBe(
      'translate(18.4%, -24.2%) scale(1.6)'
    );
    expect(resolveTokenRingColor(normalized, '#38B29A', 'ally')).toBe(
      '#F59E0B'
    );
    expect(
      resolveTokenRingColor(DEFAULT_TOKEN_APPEARANCE, null, 'enemy')
    ).toBe('#F43F5E');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TokenAvatarComponent, TokenizerEditorComponent],
      providers: [
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
            uploadAssetFile: async () => null,
          },
        },
      ],
    }).compileComponents();

    const avatarFixture = TestBed.createComponent(TokenAvatarComponent);
    avatarFixture.componentRef.setInput(
      'tokenImageUrl',
      'https://cdn.example.com/tokens/knight-face.webp'
    );
    avatarFixture.componentRef.setInput('appearance', normalized);
    avatarFixture.componentRef.setInput('artTransform', 'rotate(45deg) scaleX(-1)');
    avatarFixture.detectChanges();

    const avatarEl = avatarFixture.nativeElement as HTMLElement;
    const tokenImg = avatarEl.querySelector('img') as HTMLImageElement | null;
    expect(tokenImg).toBeTruthy();
    expect(tokenImg?.getAttribute('src')).toBe(
      'https://cdn.example.com/tokens/knight-face.webp'
    );
    expect(tokenImg?.style.transform).toContain('scale(1.6)');
    expect(avatarEl.querySelector('svg')).toBeTruthy();

    avatarFixture.componentRef.setInput('appearance', {
      ...DEFAULT_TOKEN_APPEARANCE,
      frame: 'none',
    });
    avatarFixture.detectChanges();
    expect(avatarEl.querySelector('svg')).toBeNull();

    avatarFixture.componentRef.setInput('appearance', {
      ...DEFAULT_TOKEN_APPEARANCE,
      frame: 'custom_png',
      custom_frame_url: 'https://cdn.example.com/frames/gold-ring.png',
    });
    avatarFixture.detectChanges();
    const allImgs = Array.from(avatarEl.querySelectorAll('img'));
    expect(allImgs.length).toBe(2);
    expect(allImgs[1].getAttribute('src')).toBe(
      'https://cdn.example.com/frames/gold-ring.png'
    );

    const editorFixture = TestBed.createComponent(TokenizerEditorComponent);
    const editorComp = editorFixture.componentInstance;
    let latestPortrait: string | null =
      'https://cdn.example.com/portraits/full-body.png';
    let latestTokenUrl: string | null = null;
    let latestAppearance = { ...DEFAULT_TOKEN_APPEARANCE };
    const requestedSlots: string[] = [];
    let applyCallback: ((url: string) => void) | null = null;

    editorFixture.componentRef.setInput('portraitUrl', latestPortrait);
    editorFixture.componentRef.setInput('tokenImageUrl', latestTokenUrl);
    editorFixture.componentRef.setInput('tokenAppearance', latestAppearance);
    editorFixture.componentRef.setInput('externalAssetPicker', true);

    editorComp.visualsChange.subscribe((v) => {
      latestPortrait = v.portrait_url;
      latestTokenUrl = v.token_image_url;
      latestAppearance = v.token_appearance;
      editorFixture.componentRef.setInput('portraitUrl', v.portrait_url);
      editorFixture.componentRef.setInput('tokenImageUrl', v.token_image_url);
      editorFixture.componentRef.setInput('tokenAppearance', v.token_appearance);
    });
    editorComp.requestAssetPicker.subscribe((req) => {
      requestedSlots.push(req.slot);
      applyCallback = req.apply;
    });
    editorFixture.detectChanges();

    editorComp.stampTokenFromPortrait();
    editorFixture.detectChanges();
    expect(latestPortrait).toBe(
      'https://cdn.example.com/portraits/full-body.png'
    );
    expect(latestTokenUrl).toBe(
      'https://cdn.example.com/portraits/full-body.png'
    );

    editorComp.onScaleSliderCommit('1.55');
    expect(latestAppearance.scale).toBe(1.55);

    editorComp.selectFramePreset('boss');
    expect(latestAppearance.frame).toBe('boss');

    editorComp.onFrameColorChange('#A855F7');
    expect(latestAppearance.frame_color).toBe('#A855F7');

    editorComp.clearCustomFrameColor();
    expect(latestAppearance.frame_color).toBeNull();

    editorComp.resetTokenCrop();
    expect(latestAppearance.scale).toBe(1);
    expect(latestAppearance.offset_x).toBe(0);
    expect(latestAppearance.offset_y).toBe(0);

    editorComp.openAssetPickerForSlot('portrait');
    editorComp.openAssetPickerForSlot('frame');
    editorComp.openAssetPickerForSlot('token');
    expect(requestedSlots).toEqual(['portrait', 'frame', 'token']);

    expect(applyCallback).toBeTruthy();
    applyCallback!('https://cdn.example.com/tokens/custom-mini.png');
    expect(latestTokenUrl).toBe(
      'https://cdn.example.com/tokens/custom-mini.png'
    );
    expect(latestPortrait).toBe(
      'https://cdn.example.com/portraits/full-body.png'
    );
  });

  it('should keep portrait_url and token_image_url separate across pre-migration fallbacks, VTT sheets, battlemap tokens, Collections templates, and Chat speaker avatars', async () => {
    const legacyCharRow = normalizeCharacterRecord({
      id: 'char-legacy-vis',
      owner_id: 'player-vis-1',
      name: 'Kaelen Vance',
      level: 2,
      attributes: {
        Brawn: 2,
        Agility: 2,
        Technique: 2,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 1,
        Tinkering: 0,
        Medicine: 0,
        Survival: 0,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Medium',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 15,
      current_sp: 9,
      current_ap: 4,
      active_cooldowns: {
        perk_lunge: 2,
        __visuals_json: JSON.stringify({
          portrait_url: 'https://cdn.example.com/kaelen-portrait.webp',
          token_image_url: 'https://cdn.example.com/kaelen-token.webp',
          token_appearance: {
            shape: 'circle',
            frame: 'iron',
            frame_color: '#38BDF8',
            scale: 1.35,
            offset_x: 6,
            offset_y: -12,
          },
        }),
      } as unknown as Record<string, number>,
    });

    expect(legacyCharRow.active_cooldowns).toEqual({ perk_lunge: 2 });
    expect(legacyCharRow.portrait_url).toBe(
      'https://cdn.example.com/kaelen-portrait.webp'
    );
    expect(legacyCharRow.token_image_url).toBe(
      'https://cdn.example.com/kaelen-token.webp'
    );
    expect(legacyCharRow.token_appearance?.frame).toBe('iron');
    expect(legacyCharRow.token_appearance?.scale).toBe(1.35);

    const colDraft = buildActorTemplateFromCharacter(legacyCharRow, [], []);
    expect(colDraft.portrait_url).toBe(
      'https://cdn.example.com/kaelen-portrait.webp'
    );
    expect(colDraft.token_image_url).toBe(
      'https://cdn.example.com/kaelen-token.webp'
    );
    expect(colDraft.token_appearance?.frame).toBe('iron');

    const enrichedStats = enrichNpcStatsWithVisuals(
      { attack_mod: 4 },
      'https://cdn.example.com/npc-sheet.png',
      null,
      {
        ...DEFAULT_TOKEN_APPEARANCE,
        frame: 'boss',
        frame_color: '#F43F5E',
      }
    );
    expect(resolveEntityPortraitUrl({ npc_stats: enrichedStats })).toBe(
      'https://cdn.example.com/npc-sheet.png'
    );
    expect(resolveEntityTokenImageUrl({ npc_stats: enrichedStats })).toBeNull();
    expect(resolveEntityTokenAppearance({ npc_stats: enrichedStats }).frame).toBe(
      'boss'
    );

    const activeUserSig = signal<{ id: string; email: string }>({
      id: 'gm-vis-1',
      email: 'gm@example.com',
    });
    const insertedLogs: Omit<VttLogEntry, 'id' | 'created_at'>[] = [];
    const updatedCharPatches: Partial<CharacterModel>[] = [];
    const updatedTokenPatches: { id: string; patch: Partial<VttTokenModel> }[] = [];
    const charStoreListSig = signal<CharacterModel[]>([legacyCharRow]);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => activeUserSig(),
            isAdmin: () => false,
            displayName: () => 'Warden',
            handle: () => 'warden',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal<WeaponModel[]>([]),
            allPerkNodes: signal<PerkNodeModel[]>([]),
            allSkillTrees: signal([]),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: charStoreListSig,
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              charStoreListSig().find((c) => c.id === id),
            upsertRealtimeCharacter: (ch: CharacterModel) =>
              charStoreListSig.update((curr) =>
                curr.some((c) => c.id === ch.id)
                  ? curr.map((c) => (c.id === ch.id ? ch : c))
                  : [...curr, ch]
              ),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            updateCharacterRecord: async (
              _id: string,
              patch: Partial<CharacterModel>
            ) => {
              updatedCharPatches.push(patch);
              return null;
            },
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateRosterActor: async () => ({
              error: null,
              needsMigration: false,
            }),
            updateToken: async (id: string, patch: Partial<VttTokenModel>) => {
              updatedTokenPatches.push({ id, patch });
              return null;
            },
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `spawned-vis-tok-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            insertLog: async (
              entry: Omit<VttLogEntry, 'id' | 'created_at'>
            ) => {
              insertedLogs.push(entry);
              return {
                ...entry,
                id: `vis-log-${insertedLogs.length}`,
                created_at: new Date().toISOString(),
              };
            },
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-vis-1',
      gm_id: 'gm-vis-1',
      name: 'Tokenizer Test Campaign',
      cover_image_url: null,
      invite_code: 'VIS101',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-vis-1',
        campaign_id: 'camp-vis-1',
        gm_id: 'gm-vis-1',
        folder_id: null,
        name: 'Great Hall',
        is_active_scene: true,
        map_image_url: null,
        background_color: DEFAULT_VTT_BG_COLOR,
        grid_mode: 'square',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-vis-1');
    vttStore.allCharacters.set([legacyCharRow]);

    const pcRoster: VttRosterActorModel = {
      id: 'roster-kaelen',
      campaign_id: 'camp-vis-1',
      folder_id: null,
      character_id: legacyCharRow.id,
      collection_actor_id: null,
      owner_id: 'player-vis-1',
      actor_kind: 'character',
      is_unique: true,
      name: 'Kaelen Vance',
      faction: 'ally',
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      portrait_url: legacyCharRow.portrait_url,
      token_image_url: legacyCharRow.token_image_url,
      token_appearance: legacyCharRow.token_appearance,
      max_hp: 15,
      max_sp: 9,
      max_ap: 4,
      armor_dr: 1,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const portraitOnlyNpc: VttRosterActorModel = {
      id: 'roster-envoy',
      campaign_id: 'camp-vis-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Gilded Envoy',
      faction: 'neutral',
      size: 1,
      icon: 'crown',
      color: '#F59E0B',
      portrait_url: 'https://cdn.example.com/envoy-sheet-portrait.png',
      token_image_url: null,
      token_appearance: {
        ...DEFAULT_TOKEN_APPEARANCE,
        frame: 'ornate',
      },
      max_hp: 12,
      max_sp: 6,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vttStore.rosterActors.set([pcRoster, portraitOnlyNpc]);

    const kaelenTok = await vttStore.deployRosterActor('roster-kaelen');
    const envoyTok = await vttStore.deployRosterActor('roster-envoy');
    expect(kaelenTok?.token_image_url).toBe(
      'https://cdn.example.com/kaelen-token.webp'
    );
    expect(envoyTok?.portrait_url).toBe(
      'https://cdn.example.com/envoy-sheet-portrait.png'
    );
    expect(envoyTok?.token_image_url).toBeNull();

    const roomFixture = TestBed.createComponent(VttRoomComponent);
    roomFixture.detectChanges();
    const canvasComp = roomFixture.componentInstance.canvasComp()!;

    const renderedKaelen = canvasComp
      .renderableTokens()
      .find((r) => r.token.name === 'Kaelen Vance')!;
    const renderedEnvoy = canvasComp
      .renderableTokens()
      .find((r) => r.token.name === 'Gilded Envoy')!;
    expect(renderedKaelen.tokenImageUrl).toBe(
      'https://cdn.example.com/kaelen-token.webp'
    );
    expect(renderedKaelen.tokenAppearance.frame).toBe('iron');
    expect(renderedEnvoy.tokenImageUrl).toBeNull();
    expect(renderedEnvoy.tokenAppearance.frame).toBe('ornate');

    await vttStore.updateCharacterFromVttSheet(legacyCharRow.id, (char) => ({
      ...char,
      portrait_url: 'https://cdn.example.com/kaelen-new-portrait.webp',
      token_image_url: 'https://cdn.example.com/kaelen-new-token.webp',
      token_appearance: {
        ...DEFAULT_TOKEN_APPEARANCE,
        frame: 'boss',
        frame_color: '#10B981',
        scale: 1.5,
        offset_x: -10,
        offset_y: 8,
      },
    }));
    roomFixture.detectChanges();

    expect(updatedCharPatches.length).toBe(0);
    const updatedKaelenActor = vttStore
      .rosterActors()
      .find((a) => a.id === 'roster-kaelen')!;
    expect(updatedKaelenActor.portrait_url).toBe(
      'https://cdn.example.com/kaelen-new-portrait.webp'
    );
    expect(updatedKaelenActor.token_image_url).toBe(
      'https://cdn.example.com/kaelen-new-token.webp'
    );
    expect(updatedTokenPatches.length).toBeGreaterThanOrEqual(1);
    const syncedKaelen = canvasComp
      .renderableTokens()
      .find((r) => r.token.name === 'Kaelen Vance')!;
    expect(syncedKaelen.tokenImageUrl).toBe(
      'https://cdn.example.com/kaelen-new-token.webp'
    );
    expect(syncedKaelen.tokenAppearance.frame).toBe('boss');
    expect(syncedKaelen.tokenAppearance.scale).toBe(1.5);

    vttStore.selectSingleToken(envoyTok!.id);
    vttStore.setGmSpeakerMode('character');
    await vttStore.executeChatOrCommand('We parley at dawn.', VTT_CHAT_COMMANDS);
    expect(insertedLogs.length).toBe(1);

    const envoyChatLog = vttStore.logs()[0];
    const envoySpeakerVis = vttStore.getLogSpeakerVisuals(envoyChatLog);
    expect(envoySpeakerVis?.displayImageUrl).toBe(
      'https://cdn.example.com/envoy-sheet-portrait.png'
    );
    expect(envoySpeakerVis?.appearance.frame).toBe('ornate');
    expect(envoySpeakerVis?.appearance.scale).toBe(1);

    vttStore.selectSingleToken(kaelenTok!.id);
    await vttStore.executeChatOrCommand('Steel answers first.', VTT_CHAT_COMMANDS);
    const kaelenChatLog = vttStore.logs()[vttStore.logs().length - 1];
    const kaelenSpeakerVis = vttStore.getLogSpeakerVisuals(kaelenChatLog);
    expect(kaelenSpeakerVis?.displayImageUrl).toBe(
      'https://cdn.example.com/kaelen-new-token.webp'
    );
    expect(kaelenSpeakerVis?.appearance.frame).toBe('boss');
    expect(kaelenSpeakerVis?.appearance.scale).toBe(1.5);
  });

  it('should omit Sheet and Select buttons from the Actors tab, open sheets on row click, and launch a separate Tokenizer Studio floating window from Edit Token', async () => {
    const activeUserSig = signal<{ id: string; email: string }>({
      id: 'gm-studio-1',
      email: 'gm@example.com',
    });
    const updatedRosterPatches: {
      id: string;
      patch: Partial<VttRosterActorModel>;
    }[] = [];
    const updatedTokenPatches: {
      id: string;
      patch: Partial<VttTokenModel>;
    }[] = [];

    const unimportedChar: CharacterModel = {
      id: 'char-avail-1',
      owner_id: 'gm-studio-1',
      name: 'Rowan Thorne',
      level: 2,
      attributes: {
        Brawn: 2,
        Agility: 2,
        Technique: 1,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 0,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Medium',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 16,
      current_sp: 8,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
      created_at: new Date().toISOString(),
    };
    const charStoreListSig = signal<CharacterModel[]>([unimportedChar]);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => activeUserSig(),
            isAdmin: () => false,
            displayName: () => 'Grand Warden',
            handle: () => 'warden',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal<WeaponModel[]>([]),
            allPerkNodes: signal<PerkNodeModel[]>([]),
            allSkillTrees: signal([]),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: charStoreListSig,
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              charStoreListSig().find((c) => c.id === id),
            upsertRealtimeCharacter: (ch: CharacterModel) =>
              charStoreListSig.update((curr) =>
                curr.some((c) => c.id === ch.id)
                  ? curr.map((c) => (c.id === ch.id ? ch : c))
                  : [...curr, ch]
              ),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateRosterActor: async (
              _cid: string,
              aid: string,
              patch: Partial<VttRosterActorModel>
            ) => {
              updatedRosterPatches.push({ id: aid, patch });
              return null;
            },
            updateToken: async (id: string, patch: Partial<VttTokenModel>) => {
              updatedTokenPatches.push({ id, patch });
              return null;
            },
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `studio-tok-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-studio-1',
      gm_id: 'gm-studio-1',
      name: 'Tokenizer Window Campaign',
      cover_image_url: null,
      invite_code: 'STDO01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-studio-1',
        campaign_id: 'camp-studio-1',
        gm_id: 'gm-studio-1',
        folder_id: null,
        name: 'Brazier Keep',
        is_active_scene: true,
        map_image_url: null,
        background_color: DEFAULT_VTT_BG_COLOR,
        grid_mode: 'square',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-studio-1');
    vttStore.allCharacters.set([unimportedChar]);

    const npcActor: VttRosterActorModel = {
      id: 'actor-studio-npc',
      campaign_id: 'camp-studio-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Ashblade Captain',
      faction: 'enemy',
      size: 1,
      icon: 'skull',
      color: '#F43F5E',
      portrait_url: 'https://cdn.example.com/ashblade-portrait.webp',
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
      max_hp: 24,
      max_sp: 10,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vttStore.rosterActors.set([npcActor]);
    await vttStore.deployRosterActor('actor-studio-npc');

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    const rootEl = fixture.nativeElement as HTMLElement;
    comp.sidebarOpen.set(true);
    comp.sidebarTab.set('actors');
    fixture.detectChanges();

    const sidebarEl = rootEl.querySelector('aside') as HTMLElement;
    expect(sidebarEl).toBeTruthy();

    const sidebarButtonLabels = Array.from(
      sidebarEl.querySelectorAll('button')
    ).map((btn) => (btn.textContent ?? '').trim());
    expect(sidebarButtonLabels).not.toContain('Sheet');
    expect(sidebarButtonLabels).not.toContain('Select');

    const actorRowEl = Array.from(
      sidebarEl.querySelectorAll('div[draggable="true"]')
    ).find((el) => (el.textContent ?? '').includes('Ashblade Captain')) as HTMLElement;
    expect(actorRowEl).toBeTruthy();

    actorRowEl.click();
    fixture.detectChanges();

    const sheetEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"]'
    ) as HTMLElement | null;
    expect(sheetEl).toBeTruthy();
    expect(sheetEl?.querySelector('app-tokenizer-editor')).toBeNull();
    expect(
      rootEl.querySelector(
        'section[data-vtt-floating-window="true"][aria-label="Tokenizer Studio"]'
      )
    ).toBeNull();

    const sheetComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttActorSheetComponent =>
          inst instanceof VttActorSheetComponent
      )!;
    sheetComp.npcTab.set('token');
    fixture.detectChanges();
    expect(sheetEl?.querySelector('app-tokenizer-editor')).toBeNull();

    const openStudioBtn = sheetEl?.querySelector(
      'button[data-open-tokenizer-studio="true"]'
    ) as HTMLButtonElement | null;
    expect(openStudioBtn).toBeTruthy();
    openStudioBtn!.click();
    fixture.detectChanges();

    const studioSectionEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Tokenizer Studio"]'
    ) as HTMLElement | null;
    expect(studioSectionEl).toBeTruthy();
    expect(studioSectionEl?.querySelector('app-tokenizer-editor')).toBeTruthy();

    const studioWindowComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttTokenizerWindowComponent =>
          inst instanceof VttTokenizerWindowComponent
      )!;
    expect(studioWindowComp).toBeTruthy();
    const studioFloatingWrapper = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttFloatingWindowComponent =>
          inst instanceof VttFloatingWindowComponent &&
          inst.ariaLabel() === 'Tokenizer Studio'
      )!;
    expect(studioFloatingWrapper.zIndex()).toBeGreaterThan(sheetComp.zIndex());

    await studioWindowComp.onVisualsChange({
      portrait_url: 'https://cdn.example.com/ashblade-portrait.webp',
      token_image_url: 'https://cdn.example.com/ashblade-token.webp',
      token_appearance: {
        ...DEFAULT_TOKEN_APPEARANCE,
        frame: 'boss',
        frame_color: '#EF4444',
        scale: 1.4,
        offset_x: 12,
        offset_y: -8,
      },
    });
    await Promise.resolve();
    fixture.detectChanges();

    expect(updatedRosterPatches.length).toBeGreaterThanOrEqual(1);
    expect(updatedTokenPatches.length).toBeGreaterThanOrEqual(1);
    expect(vttStore.rosterActors()[0].token_image_url).toBe(
      'https://cdn.example.com/ashblade-token.webp'
    );
    expect(vttStore.rosterActors()[0].token_appearance?.frame).toBe('boss');
    expect(vttStore.tokens()[0].token_image_url).toBe(
      'https://cdn.example.com/ashblade-token.webp'
    );
    expect(vttStore.tokens()[0].token_appearance?.scale).toBe(1.4);

    comp.onGlobalKeyDown(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        cancelable: true,
      })
    );
    fixture.detectChanges();
    expect(vttStore.openTokenizerTarget()).toBeNull();
    expect(vttStore.openSheetTarget()).not.toBeNull();
  });

  it('should declutter Edit Token buttons, enlarge header portrait, and drag Compendium weapons & standalone skills onto PC and NPC sheets', async () => {
    const activeUserSig = signal<{ id: string; email?: string } | null>({
      id: 'gm-comp-1',
      email: 'gm@marchoftime.test',
    });

    const testWeapon: WeaponModel = {
      id: 'wep-sunforged-halberd',
      slug: 'sunforged-halberd',
      name: 'Sunforged Halberd',
      category: 'Heavy',
      ap_cost: 2,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 6,
      reach_tiles: 2,
      thrown_range_tiles: null,
      trait_name: 'Sweep Reach',
      trait_description: 'Strikes foes from 10 ft.',
      rule_hooks: { two_handed: true, guard: true },
      is_active: true,
    };

    const testDagger: WeaponModel = {
      id: 'wep-whisper-dagger',
      slug: 'whisper-dagger',
      name: 'Whisper Dagger',
      category: 'Light',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Agility',
      gov_skill: 'Strike',
      base_damage: 3,
      reach_tiles: 1,
      thrown_range_tiles: 3,
      trait_name: 'Quickdraw',
      trait_description: 'Nimble offhand blade.',
      rule_hooks: {},
      is_active: true,
    };

    const standaloneArt: PerkNodeModel = {
      id: 'perk-ashen-whirl',
      tree_id: null,
      slug: 'ashen-whirl',
      name: 'Ashen Whirl',
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 0,
      ap_cost: 2,
      cooldown_rounds: 2,
      combat_tag: 'Sweeping',
      description: 'Spin in a cinder arc.',
      rule_hooks: {
        __is_standalone: true,
        bonus_attack_mod: 1,
        bonus_flat_damage: 2,
      },
      is_active: true,
    };

    const pcChar: CharacterModel = {
      id: 'char-comp-pc-1',
      owner_id: 'gm-comp-1',
      name: 'Seraphina',
      portrait_url: 'https://cdn.example.com/seraphina-portrait.webp',
      token_image_url: 'https://cdn.example.com/seraphina-token.webp',
      token_appearance: {
        ...DEFAULT_TOKEN_APPEARANCE,
        frame: 'boss',
      },
      level: 2,
      attributes: {
        Brawn: 2,
        Agility: 2,
        Technique: 1,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 0,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Medium',
      equipped_shield: 'Heater',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 16,
      current_sp: 8,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
      created_at: new Date().toISOString(),
    };
    const charStoreListSig = signal<CharacterModel[]>([pcChar]);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => activeUserSig(),
            isAdmin: () => false,
            displayName: () => 'Grand Warden',
            handle: () => 'warden',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal<WeaponModel[]>([testWeapon, testDagger]),
            weapons: signal<WeaponModel[]>([testWeapon, testDagger]),
            allPerkNodes: signal<PerkNodeModel[]>([standaloneArt]),
            perkNodes: signal<PerkNodeModel[]>([]),
            standaloneNodes: signal<PerkNodeModel[]>([standaloneArt]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: charStoreListSig,
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              charStoreListSig().find((c) => c.id === id),
            upsertRealtimeCharacter: (ch: CharacterModel) =>
              charStoreListSig.update((curr) =>
                curr.some((c) => c.id === ch.id)
                  ? curr.map((c) => (c.id === ch.id ? ch : c))
                  : [...curr, ch]
              ),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateRosterActor: async () => null,
            updateToken: async () => null,
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `comp-tok-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-comp-1',
      gm_id: 'gm-comp-1',
      name: 'Compendium Drag Campaign',
      cover_image_url: null,
      invite_code: 'COMP01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-comp-1',
        campaign_id: 'camp-comp-1',
        gm_id: 'gm-comp-1',
        folder_id: null,
        name: 'Armory Hall',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#0D1615',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-comp-1');
    vttStore.allCharacters.set([pcChar]);

    const pcRosterActor: VttRosterActorModel = {
      id: 'actor-comp-pc',
      campaign_id: 'camp-comp-1',
      folder_id: null,
      character_id: pcChar.id,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'character',
      is_unique: true,
      name: pcChar.name,
      faction: 'ally',
      size: 1,
      icon: 'greatsword',
      color: '#38B29A',
      portrait_url: pcChar.portrait_url,
      token_image_url: pcChar.token_image_url,
      token_appearance: pcChar.token_appearance,
      max_hp: 16,
      max_sp: 8,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 2,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const npcRosterActor: VttRosterActorModel = {
      id: 'actor-comp-npc',
      campaign_id: 'camp-comp-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Iron Sentinel',
      faction: 'enemy',
      size: 1,
      icon: 'skull',
      color: '#EF4444',
      portrait_url: 'https://cdn.example.com/sentinel-portrait.webp',
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
      max_hp: 22,
      max_sp: 8,
      max_ap: 4,
      armor_dr: 3,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vttStore.rosterActors.set([pcRosterActor, npcRosterActor]);
    await vttStore.deployRosterActor('actor-comp-npc');

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    const rootEl = fixture.nativeElement as HTMLElement;
    comp.sidebarOpen.set(true);
    fixture.detectChanges();

    const gmCompendiumTabBtn = rootEl.querySelector(
      'button[data-sidebar-tab="compendium"]'
    ) as HTMLButtonElement | null;
    expect(gmCompendiumTabBtn).toBeTruthy();

    activeUserSig.set({ id: 'player-non-gm', email: 'player@marchoftime.test' });
    fixture.detectChanges();
    expect(
      rootEl.querySelector('button[data-sidebar-tab="compendium"]')
    ).toBeNull();

    activeUserSig.set({ id: 'gm-comp-1', email: 'gm@marchoftime.test' });
    fixture.detectChanges();

    const compendiumBtn = rootEl.querySelector(
      'button[data-sidebar-tab="compendium"]'
    ) as HTMLButtonElement;
    compendiumBtn.click();
    fixture.detectChanges();

    expect(
      rootEl.querySelectorAll('div[data-compendium-drag-kind="weapon"]').length
    ).toBe(0);
    expect(
      rootEl.querySelectorAll('div[data-compendium-drag-kind="standalone"]').length
    ).toBe(0);

    const openWeaponsBtn = rootEl.querySelector(
      'button[data-open-compendium-pack="weapons"]'
    ) as HTMLButtonElement | null;
    const openSkillsBtn = rootEl.querySelector(
      'button[data-open-compendium-pack="skills"]'
    ) as HTMLButtonElement | null;
    expect(openWeaponsBtn).toBeTruthy();
    expect(openSkillsBtn).toBeTruthy();

    openWeaponsBtn!.click();
    fixture.detectChanges();

    const weaponsWinEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Compendium Weapons"]'
    ) as HTMLElement | null;
    expect(weaponsWinEl).toBeTruthy();
    expect(
      weaponsWinEl!.querySelectorAll('div[data-compendium-drag-kind="weapon"]').length
    ).toBe(2);

    comp.compendiumWeaponsSearch.set('Whisper');
    fixture.detectChanges();
    expect(
      weaponsWinEl!.querySelectorAll('div[data-compendium-drag-kind="weapon"]').length
    ).toBe(1);
    comp.compendiumWeaponsSearch.set('');
    fixture.detectChanges();

    openSkillsBtn!.click();
    fixture.detectChanges();

    const skillsWinEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Compendium Skills"]'
    ) as HTMLElement | null;
    expect(skillsWinEl).toBeTruthy();
    expect(
      skillsWinEl!.querySelectorAll('div[data-compendium-drag-kind="standalone"]').length
    ).toBe(1);

    comp.compendiumSkillsSearch.set('Nonexistent');
    fixture.detectChanges();
    expect(
      skillsWinEl!.querySelectorAll('div[data-compendium-drag-kind="standalone"]').length
    ).toBe(0);
    comp.compendiumSkillsSearch.set('');
    fixture.detectChanges();

    vttStore.openActorSheet('actor-comp-npc');
    fixture.detectChanges();

    const sheetEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"]'
    ) as HTMLElement;
    expect(sheetEl).toBeTruthy();

    const statblockEditTokenBtns = Array.from(
      sheetEl.querySelectorAll('button')
    ).filter((b) => (b.textContent ?? '').trim() === 'Edit Token');
    expect(statblockEditTokenBtns.length).toBe(0);

    const headerPortraitBtn = sheetEl.querySelector(
      'button[data-header-portrait-avatar="true"]'
    ) as HTMLButtonElement | null;
    expect(headerPortraitBtn).toBeTruthy();
    expect(headerPortraitBtn?.innerHTML).toContain('h-20 w-16');

    const sheetComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttActorSheetComponent =>
          inst instanceof VttActorSheetComponent
      )!;

    comp.onCompendiumWeaponDragStart(new Event('dragstart') as DragEvent, testWeapon);
    await sheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    fixture.detectChanges();

    const updatedNpc = vttStore
      .rosterActors()
      .find((a) => a.id === 'actor-comp-npc')!;
    expect(updatedNpc.npc_stats.weapon_name).toBe('Sunforged Halberd');
    expect(updatedNpc.npc_stats.flat_damage).toBe(6);
    expect(updatedNpc.npc_stats.attack_ap).toBe(2);
    expect(updatedNpc.npc_stats.reach_feet).toBe(10);
    expect(vttStore.tokens()[0].npc_stats.weapon_name).toBe('Sunforged Halberd');

    comp.onCompendiumStandaloneDragStart(
      new Event('dragstart') as DragEvent,
      standaloneArt
    );
    await sheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    fixture.detectChanges();

    const npcAfterGrant = vttStore
      .rosterActors()
      .find((a) => a.id === 'actor-comp-npc')!;
    expect(npcAfterGrant.npc_stats.__standalone_perk_ids).toEqual([
      'perk-ashen-whirl',
    ]);
    expect(
      vttStore.getNpcStandaloneCombatArts(vttStore.tokens()[0]).map((n) => n.name)
    ).toEqual(['Ashen Whirl']);

    vttStore.openActorSheet('actor-comp-pc');
    fixture.detectChanges();

    const pcSheetEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"][data-actor-id="actor-comp-pc"]'
    ) as HTMLElement;
    expect(pcSheetEl).toBeTruthy();

    const pcSheetComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttActorSheetComponent =>
          inst instanceof VttActorSheetComponent &&
          inst.sheetRosterActor()?.id === 'actor-comp-pc'
      )!;

    const pcCharacterTabEditBtns = Array.from(
      pcSheetEl.querySelectorAll('button')
    ).filter((b) => (b.textContent ?? '').trim() === 'Edit Token');
    expect(pcCharacterTabEditBtns.length).toBe(0);

    comp.onCompendiumWeaponDragStart(new Event('dragstart') as DragEvent, testWeapon);
    await pcSheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    fixture.detectChanges();

    let updatedPc = vttStore.openSheetCharacter()!;
    expect(updatedPc.weapon_slot_1_id).toBe('wep-sunforged-halberd');
    expect(updatedPc.equipped_shield).toBe('None');
    expect(pcSheetComp.pcTab()).toBe('loadout');

    comp.onCompendiumWeaponDragStart(new Event('dragstart') as DragEvent, testDagger);
    await pcSheetComp.onSheetDrop(new Event('drop') as DragEvent, 'inventory');
    fixture.detectChanges();

    updatedPc = vttStore.openSheetCharacter()!;
    expect(updatedPc.inventory?.length).toBe(1);
    expect(updatedPc.inventory?.[0].name).toBe('Whisper Dagger');

    comp.onCompendiumStandaloneDragStart(
      new Event('dragstart') as DragEvent,
      standaloneArt
    );
    await pcSheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    fixture.detectChanges();

    updatedPc = vttStore.openSheetCharacter()!;
    expect(updatedPc.unlocked_perk_ids).toContain('perk-ashen-whirl');
    expect(
      vttStore.allCharacters().find((c) => c.id === pcChar.id)?.weapon_slot_1_id
    ).toBeNull();
    expect(vttStore.openSheetDerived()?.perkSpent).toBe(0);
    expect(pcSheetComp.pcTab()).toBe('perks');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(comp.compendiumSkillsWindowOpen()).toBe(false);
    expect(comp.compendiumWeaponsWindowOpen()).toBe(true);
    expect(vttStore.openSheetTarget()).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(comp.compendiumWeaponsWindowOpen()).toBe(false);
    expect(vttStore.openSheetTarget()).toBeTruthy();
  });

  it('should parse Content Manager Armors and Items URLs, seed starter armors and non-weapon items, and create/update armors and items via CompendiumStore', async () => {
    expect(parseContentManagerUrl('/content-manager/armors')).toEqual({
      tab: 'armors',
      treeId: null,
    });
    expect(parseContentManagerUrl('/content-manager/items')).toEqual({
      tab: 'items',
      treeId: null,
    });

    expect(
      DEFAULT_COMPENDIUM_ARMORS.some(
        (a) => a.name === 'Fortress Full Plate' && a.armor_sp === 6 && a.armor_dr === 6
      )
    ).toBe(true);
    expect(
      DEFAULT_COMPENDIUM_ITEMS.some(
        (i) => i.name === 'Bodkin Arrows' && i.default_quantity === 20
      )
    ).toBe(true);
    expect(
      DEFAULT_COMPENDIUM_ITEMS.some((i) => i.name === 'Stone & Flint')
    ).toBe(true);
    expect(
      DEFAULT_COMPENDIUM_ITEMS.some((i) => i.name === 'Canvas Field Tent')
    ).toBe(true);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            getSessionUser: async () => ({
              id: 'user-admin-cm',
              email: 'admin@marchoftime.test',
              user_metadata: { handle: 'architect', full_name: 'Architect' },
            }),
            fetchProfile: async () => ({
              id: 'user-admin-cm',
              display_name: 'Architect',
              handle: 'architect',
              is_admin: true,
              sheet_theme: 'light',
              vtt_theme: 'dark',
            }),
            onAuthStateChange: () => {},
          },
        },
        {
          provide: CompendiumService,
          useValue: {
            fetchFullCompendium: async () => ({
              weapons: [],
              armors: DEFAULT_COMPENDIUM_ARMORS,
              items: DEFAULT_COMPENDIUM_ITEMS,
              skillTrees: [],
              perkNodes: [],
              keywords: [],
            }),
            insertArmor: async (payload: Omit<ArmorModel, 'id'>) => ({
              data: { id: 'armor-custom-lamellar', ...payload },
              error: null,
            }),
            updateArmorRecord: async (id: string, payload: Omit<ArmorModel, 'id'>) => ({
              data: { id, ...payload },
              error: null,
            }),
            insertCompendiumItem: async (
              payload: Omit<CompendiumItemModel, 'id'>
            ) => ({
              data: { id: 'item-grappling-hook', ...payload },
              error: null,
            }),
            updateCompendiumItemRecord: async (
              id: string,
              payload: Omit<CompendiumItemModel, 'id'>
            ) => ({
              data: { id, ...payload },
              error: null,
            }),
          },
        },
      ],
    }).compileComponents();

    const appFixture = TestBed.createComponent(App);
    appFixture.detectChanges();
    await appFixture.whenStable();

    const harness = await RouterTestingHarness.create('/content-manager/armors');
    await appFixture.whenStable();
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Padded Gambeson');
    expect(harness.routeNativeElement?.textContent).toContain('Fortress Full Plate');
    expect(harness.routeNativeElement?.textContent).toContain('+6 SP');
    expect(harness.routeNativeElement?.textContent).toContain('+6 DR');

    const compStore = TestBed.inject(CompendiumStore);
    const createdArmor = await compStore.createArmor({
      slug: 'bronze-lamellar',
      name: 'Bronze Lamellar',
      weight_class: 'Medium',
      armor_sp: 3,
      armor_dr: 3,
      allows_dodge: true,
      speed_penalty_tiles: 0,
      description: 'Laced bronze plates.',
      rule_hooks: { __icon: 'breastplate', __icon_color: '#F59E0B' },
    });
    expect(createdArmor?.name).toBe('Bronze Lamellar');
    expect(compStore.armors().some((a) => a.name === 'Bronze Lamellar')).toBe(true);

    await harness.navigateByUrl('/content-manager/items');
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Bodkin Arrows');
    expect(harness.routeNativeElement?.textContent).toContain('Stone & Flint');
    expect(harness.routeNativeElement?.textContent).toContain('Canvas Field Tent');

    const createdItem = await compStore.createCompendiumItem({
      slug: 'iron-grappling-hook',
      name: 'Iron Grappling Hook',
      subcategory: 'Adventuring Gear',
      default_quantity: 1,
      stackable: false,
      description: 'Three-pronged folding iron hook.',
      rule_hooks: { __icon: 'pack', __icon_color: '#38BDF8' },
    });
    expect(createdItem?.name).toBe('Iron Grappling Hook');
    expect(
      compStore.items().some((i) => i.name === 'Iron Grappling Hook')
    ).toBe(true);
  });

  it('should render categorized Weapons, Armors, and Items on the site Character Sheet with live weapon Roll and Damage formulas and armor SP and DR equipping', async () => {
    const longbow: WeaponModel = {
      id: 'wep-ash-longbow',
      slug: 'ash-longbow',
      name: 'Ash Longbow',
      category: 'Ranged',
      ap_cost: 1,
      requires_aim: true,
      gov_attribute: 'Agility',
      gov_skill: 'Shoot',
      base_damage: 5,
      reach_tiles: 12,
      thrown_range_tiles: null,
      trait_name: 'Draw Weight',
      trait_description: 'High-tension yew stave.',
      rule_hooks: { two_handed: true },
      is_active: true,
    };

    const armingSword: WeaponModel = {
      id: 'wep-arming-sword',
      slug: 'arming-sword',
      name: 'Arming Sword',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Technique',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: 'Balanced',
      trait_description: 'Nimble cruciform blade.',
      rule_hooks: {},
      is_active: true,
    };

    const baseHero: CharacterModel = {
      id: 'char-cat-sheet-1',
      owner_id: 'owner-cat-1',
      name: 'Sylva Thorn',
      level: 2,
      attributes: {
        Brawn: 1,
        Agility: 3,
        Technique: 2,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 1,
        Shoot: 2,
        Parry: 1,
        Dodge: 2,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 2,
        Tinkering: 0,
        Medicine: 0,
        Survival: 2,
        Resolve: 1,
        Perception: 2,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Light',
      equipped_shield: 'None',
      weapon_slot_1_id: 'wep-ash-longbow',
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 9,
      current_sp: 6,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
      created_at: new Date().toISOString(),
    };

    const formula = computeCharacterWeaponFormula(baseHero, longbow, [], [longbow]);
    expect(formula.rollFormula).toBe('2d10 + 5');
    expect(formula.damageFormula).toBe('8 DMG');
    expect(formula.rollBreakdown).toContain('Agility (+3)');
    expect(formula.rollBreakdown).toContain('Shoot (+2)');

    let storedHero = structuredClone(baseHero);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CharacterDetailComponent],
      providers: [
        provideRouter([
          { path: 'characters/:id', component: CharacterDetailComponent },
        ]),
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'owner-cat-1', email: 'sylva@marchoftime.test' }),
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumService,
          useValue: {
            fetchFullCompendium: async () => ({
              weapons: [longbow, armingSword],
              armors: DEFAULT_COMPENDIUM_ARMORS,
              items: DEFAULT_COMPENDIUM_ITEMS,
              skillTrees: [],
              perkNodes: [],
              keywords: [],
            }),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({
              data: [storedHero],
              error: null,
            }),
            fetchCharacterById: async () => ({
              data: storedHero,
              error: null,
            }),
            updateCharacterRecord: async (next: CharacterModel) => {
              storedHero = structuredClone(next);
              return null;
            },
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create(
      '/characters/char-cat-sheet-1'
    );
    const detailComp = harness.routeDebugElement!.componentInstance as CharacterDetailComponent;
    await harness.fixture.whenStable();
    harness.detectChanges();

    const sheetEl = harness.routeNativeElement as HTMLElement;
    expect(sheetEl.textContent).toContain('Ash Longbow');
    expect(sheetEl.textContent).toContain('2d10 + 5');
    expect(sheetEl.textContent).toContain('8 DMG');

    const arrows = DEFAULT_COMPENDIUM_ITEMS.find(
      (i) => i.id === 'item-bodkin-arrows'
    )!;
    const flint = DEFAULT_COMPENDIUM_ITEMS.find(
      (i) => i.id === 'item-stone-and-flint'
    )!;
    const fullPlate = DEFAULT_COMPENDIUM_ARMORS.find(
      (a) => a.id === 'armor-fortress-full-plate'
    )!;

    await detailComp.addFromCompendiumPicker(
      detailComp.character()!,
      `item:${arrows.id}`
    );
    await detailComp.addFromCompendiumPicker(
      detailComp.character()!,
      `item:${arrows.id}`
    );
    await detailComp.addFromCompendiumPicker(
      detailComp.character()!,
      `item:${flint.id}`
    );
    await detailComp.addFromCompendiumPicker(
      detailComp.character()!,
      `weapon:${armingSword.id}`
    );
    await detailComp.addFromCompendiumPicker(
      detailComp.character()!,
      `armor:${fullPlate.id}`
    );
    harness.detectChanges();

    const invAfterAdds = detailComp.character()!.inventory!;
    const arrowEntry = invAfterAdds.find(
      (it) => it.compendium_id === 'item-bodkin-arrows'
    )!;
    expect(arrowEntry.quantity).toBe(40);
    expect(getInventoryItemCategory(arrowEntry)).toBe('item');

    const plateEntry = invAfterAdds.find(
      (it) => it.compendium_id === 'armor-fortress-full-plate'
    )!;
    expect(getInventoryItemCategory(plateEntry)).toBe('armor');

    await detailComp.equipInventoryArmor(detailComp.character()!, plateEntry.id);
    harness.detectChanges();

    const statsAfterPlate = detailComp.derived()!;
    expect(detailComp.character()!.equipped_armor).toBe('Heavy');
    expect(statsAfterPlate.equippedArmorLabel).toBe('Fortress Full Plate');
    expect(statsAfterPlate.armorSp).toBe(6);
    expect(statsAfterPlate.armorDr).toBe(6);
    expect(statsAfterPlate.maxSp).toBe(10);
    expect(statsAfterPlate.canDodge).toBe(false);

    detailComp.inventoryTab.set('armor');
    harness.detectChanges();
    expect(sheetEl.textContent).toContain('Fortress Full Plate');
    expect(sheetEl.textContent).toContain('+6 SP');
    expect(sheetEl.textContent).toContain('+6 DR');

    detailComp.inventoryTab.set('item');
    harness.detectChanges();
    expect(sheetEl.textContent).toContain('Bodkin Arrows');
    expect(sheetEl.textContent).toContain('Stone & Flint');
  });

  it('should launch Compendium Armors and Items floating windows in VTT and support dragging Weapons, Armors, and Items onto Player Character and NPC sheets with categorized display', async () => {
    const activeUserSig = signal<{ id: string; email: string } | null>({
      id: 'gm-gear-1',
      email: 'gm@marchoftime.test',
    });

    const warbow: WeaponModel = {
      id: 'wep-ironwood-bow',
      slug: 'ironwood-bow',
      name: 'Ironwood Warbow',
      category: 'Ranged',
      ap_cost: 1,
      requires_aim: true,
      gov_attribute: 'Agility',
      gov_skill: 'Shoot',
      base_damage: 5,
      reach_tiles: 12,
      thrown_range_tiles: null,
      trait_name: 'Long Draw',
      trait_description: 'Pierces distant ranks.',
      rule_hooks: { two_handed: true },
      is_active: true,
    };

    const pcChar: CharacterModel = {
      id: 'char-vtt-gear-pc',
      owner_id: 'gm-gear-1',
      name: 'Rowan',
      level: 1,
      attributes: {
        Brawn: 2,
        Agility: 3,
        Technique: 1,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 1,
        Shoot: 2,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 1,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 1,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'None',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 9,
      current_sp: 4,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
      created_at: new Date().toISOString(),
    };
    const charStoreListSig = signal<CharacterModel[]>([pcChar]);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => activeUserSig(),
            isAdmin: () => true,
            displayName: () => 'Grand Warden',
            handle: () => 'warden',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal<WeaponModel[]>([warbow]),
            weapons: signal<WeaponModel[]>([warbow]),
            allArmors: signal<ArmorModel[]>(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal<ArmorModel[]>(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal<CompendiumItemModel[]>(DEFAULT_COMPENDIUM_ITEMS),
            items: signal<CompendiumItemModel[]>(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal<PerkNodeModel[]>([]),
            perkNodes: signal<PerkNodeModel[]>([]),
            standaloneNodes: signal<PerkNodeModel[]>([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: charStoreListSig,
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              charStoreListSig().find((c) => c.id === id),
            upsertRealtimeCharacter: (ch: CharacterModel) =>
              charStoreListSig.update((curr) =>
                curr.some((c) => c.id === ch.id)
                  ? curr.map((c) => (c.id === ch.id ? ch : c))
                  : [...curr, ch]
              ),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateRosterActor: async () => null,
            updateToken: async () => null,
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `gear-tok-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-gear-1',
      gm_id: 'gm-gear-1',
      name: 'Quartermaster Campaign',
      cover_image_url: null,
      invite_code: 'GEAR01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-gear-1',
        campaign_id: 'camp-gear-1',
        gm_id: 'gm-gear-1',
        folder_id: null,
        name: 'Campground',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#0D1615',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-gear-1');
    vttStore.allCharacters.set([pcChar]);

    const pcActor: VttRosterActorModel = {
      id: 'actor-gear-pc',
      campaign_id: 'camp-gear-1',
      folder_id: null,
      character_id: pcChar.id,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'character',
      is_unique: true,
      name: pcChar.name,
      faction: 'ally',
      size: 1,
      icon: 'bow',
      color: '#38B29A',
      portrait_url: null,
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
      max_hp: 9,
      max_sp: 4,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: {},
      notes: '',
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const npcActor: VttRosterActorModel = {
      id: 'actor-gear-npc',
      campaign_id: 'camp-gear-1',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Outpost Ranger',
      faction: 'neutral',
      size: 1,
      icon: 'bow',
      color: '#F59E0B',
      portrait_url: null,
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
      max_hp: 14,
      max_sp: 6,
      max_ap: 4,
      armor_dr: 1,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      npc_stats: { attack_mod: 3, flat_damage: 4 },
      notes: '',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vttStore.rosterActors.set([pcActor, npcActor]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    const rootEl = fixture.nativeElement as HTMLElement;
    comp.sidebarOpen.set(true);
    comp.sidebarTab.set('compendium');
    fixture.detectChanges();

    const openArmorsBtn = rootEl.querySelector(
      'button[data-open-compendium-pack="armors"]'
    ) as HTMLButtonElement | null;
    const openItemsBtn = rootEl.querySelector(
      'button[data-open-compendium-pack="items"]'
    ) as HTMLButtonElement | null;
    expect(openArmorsBtn).toBeTruthy();
    expect(openItemsBtn).toBeTruthy();

    openArmorsBtn!.click();
    openItemsBtn!.click();
    fixture.detectChanges();

    const armorsWinEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Compendium Armors"]'
    ) as HTMLElement | null;
    const itemsWinEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Compendium Items"]'
    ) as HTMLElement | null;
    expect(armorsWinEl).toBeTruthy();
    expect(itemsWinEl).toBeTruthy();
    expect(armorsWinEl!.textContent).toContain('+6 SP');
    expect(armorsWinEl!.textContent).toContain('+6 DR');
    expect(itemsWinEl!.textContent).toContain('Bodkin Arrows');
    expect(itemsWinEl!.textContent).toContain('Canvas Field Tent');

    vttStore.openActorSheet('actor-gear-pc');
    fixture.detectChanges();

    const sheetComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttActorSheetComponent =>
          inst instanceof VttActorSheetComponent
      )!;

    const brigandine = DEFAULT_COMPENDIUM_ARMORS.find(
      (a) => a.id === 'armor-studded-brigandine'
    )!;
    const arrows = DEFAULT_COMPENDIUM_ITEMS.find(
      (i) => i.id === 'item-bodkin-arrows'
    )!;
    const tent = DEFAULT_COMPENDIUM_ITEMS.find(
      (i) => i.id === 'item-canvas-field-tent'
    )!;

    comp.onCompendiumArmorDragStart(new Event('dragstart') as DragEvent, brigandine);
    await sheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    fixture.detectChanges();

    let updatedRowan = vttStore.openSheetCharacter()!;
    expect(updatedRowan.equipped_armor).toBe('Light');
    expect(vttStore.openSheetDerived()?.armorSp).toBe(4);
    expect(vttStore.openSheetDerived()?.armorDr).toBe(2);
    expect(vttStore.openSheetDerived()?.equippedArmorLabel).toBe(
      'Studded Brigandine'
    );

    comp.onCompendiumWeaponDragStart(new Event('dragstart') as DragEvent, warbow);
    await sheetComp.onSheetDrop(new Event('drop') as DragEvent, 'inventory');
    comp.onCompendiumItemDragStart(new Event('dragstart') as DragEvent, arrows);
    await sheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    comp.onCompendiumItemDragStart(new Event('dragstart') as DragEvent, arrows);
    await sheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    fixture.detectChanges();

    updatedRowan = vttStore.openSheetCharacter()!;
    expect(sheetComp.getPcWeaponsCount(updatedRowan, vttStore.openSheetDerived()!)).toBe(1);
    expect(sheetComp.getPcArmorsCount(updatedRowan, vttStore.openSheetDerived()!)).toBe(1);
    expect(sheetComp.getPcItemsCount(updatedRowan)).toBe(1);
    expect(
      updatedRowan.inventory?.find((it) => it.compendium_id === 'item-bodkin-arrows')
        ?.quantity
    ).toBe(40);

    const sheetEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"]'
    ) as HTMLElement;
    expect(sheetEl.textContent).toContain('2d10 + 5');
    expect(sheetEl.textContent).toContain('8 DMG');
    expect(sheetEl.textContent).toContain('+4 SP');
    expect(sheetEl.textContent).toContain('+2 DR');

    vttStore.openActorSheet('actor-gear-npc');
    fixture.detectChanges();

    const allOpenSheetEls = rootEl.querySelectorAll(
      'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"]'
    );
    expect(allOpenSheetEls.length).toBe(2);

    const npcSheetComp = fixture.debugElement.children
      .flatMap((d) => d.queryAll(() => true))
      .map((d) => d.componentInstance)
      .find(
        (inst): inst is VttActorSheetComponent =>
          inst instanceof VttActorSheetComponent &&
          inst.sheetRosterActor()?.id === 'actor-gear-npc'
      )!;
    expect(npcSheetComp).toBeTruthy();
    expect(
      npcSheetComp.windowX() !== sheetComp.windowX() ||
        npcSheetComp.windowY() !== sheetComp.windowY()
    ).toBe(true);

    const fullPlate = DEFAULT_COMPENDIUM_ARMORS.find(
      (a) => a.id === 'armor-fortress-full-plate'
    )!;
    comp.onCompendiumArmorDragStart(new Event('dragstart') as DragEvent, fullPlate);
    await npcSheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    comp.onCompendiumItemDragStart(new Event('dragstart') as DragEvent, tent);
    await npcSheetComp.onSheetDrop(new Event('drop') as DragEvent, 'sheet');
    comp.onCompendiumWeaponDragStart(new Event('dragstart') as DragEvent, warbow);
    await npcSheetComp.onSheetDrop(new Event('drop') as DragEvent, 'inventory');
    fixture.detectChanges();

    const npcSheetEl = rootEl.querySelector(
      'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"][data-actor-id="actor-gear-npc"]'
    ) as HTMLElement;
    expect(npcSheetEl).toBeTruthy();
    expect(npcSheetEl.textContent).not.toContain('Arm NPC');

    const equipWepBtn = npcSheetEl.querySelector(
      'button[data-npc-equip-weapon="true"]'
    ) as HTMLButtonElement | null;
    expect(equipWepBtn).toBeTruthy();
    expect(equipWepBtn?.textContent?.trim()).toBe('Equip');

    equipWepBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const updatedNpc = vttStore
      .rosterActors()
      .find((a) => a.id === 'actor-gear-npc')!;
    expect(updatedNpc.armor_dr).toBe(6);
    expect(updatedNpc.npc_stats.weapon_name).toBe('Ironwood Warbow');
    expect(updatedNpc.npc_stats.flat_damage).toBe(5);
    expect(updatedNpc.npc_stats.reach_feet).toBe(60);
    expect(npcSheetComp.getNpcInventoryArmors().length).toBe(1);
    expect(npcSheetComp.getNpcInventoryGearItems()[0]?.name).toBe('Canvas Field Tent');

    const activeLoadoutEl = npcSheetEl.querySelector(
      '[data-npc-active-loadout="true"]'
    ) as HTMLElement | null;
    expect(activeLoadoutEl).toBeTruthy();
    expect(activeLoadoutEl?.textContent).toContain('Ironwood Warbow');
    expect(activeLoadoutEl?.textContent).toContain('Fortress Full Plate');

    const unequipWepBtn = npcSheetEl.querySelector(
      'button[data-npc-unequip-weapon="true"]'
    ) as HTMLButtonElement | null;
    expect(unequipWepBtn).toBeTruthy();
    expect(npcSheetEl.textContent).toContain('EQUIPPED');

    unequipWepBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      vttStore.rosterActors().find((a) => a.id === 'actor-gear-npc')?.npc_stats
        .weapon_name
    ).toBe('Unarmed');

    npcSheetComp.closeSheet();
    fixture.detectChanges();
    expect(
      rootEl.querySelectorAll(
        'section[data-vtt-floating-window="true"][aria-label="Actor Sheet"]'
      ).length
    ).toBe(1);
    expect(vttStore.openSheetCharacter()?.name).toBe(pcChar.name);
    expect(
      vttStore.allCharacters().find((c) => c.id === pcChar.id)?.equipped_armor
    ).toBe('None');
  });

  it('imports detached VTT character copies without mutating the real Character Sheet, supports Re-import, and imports from pasted Character Sheet URLs', async () => {
    expect(
      parseCharacterIdFromUrlOrInput(
        'https://marchoftime.app/characters/char-vault-77'
      )
    ).toBe('char-vault-77');
    expect(
      parseCharacterIdFromUrlOrInput(
        'http://localhost:4200/characters/char-vault-77/edit?tab=gear#top'
      )
    ).toBe('char-vault-77');
    expect(
      parseCharacterIdFromUrlOrInput(
        'https://marchoftime.app/#/characters/char-hash-88'
      )
    ).toBe('char-hash-88');
    expect(parseCharacterIdFromUrlOrInput('/characters/new')).toBeNull();
    expect(
      parseCharacterIdFromUrlOrInput('https://marchoftime.app/dashboard')
    ).toBeNull();

    const vaultCharacters = new Map<string, CharacterModel>();
    const vaultChar1: CharacterModel = {
      id: 'char-vault-1',
      owner_id: 'gm-detach-1',
      name: 'Valen Rook',
      level: 2,
      attributes: {
        Brawn: 2,
        Agility: 1,
        Technique: 1,
        Iron: 1,
        Cunning: 0,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 0,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 0,
        Perception: 1,
        Sway: 0,
        Lore: 0,
      },
      current_hp: 11,
      current_sp: 6,
      current_ap: 4,
      equipped_armor: 'Light',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      active_cooldowns: {},
      inventory: [
        {
          id: 'inv-rope-1',
          name: 'Silk Climbing Rope',
          quantity: 1,
          description: '50 feet of braided silk rope.',
          category: 'item',
        },
      ],
      notes: 'Original Vault Bio',
      portrait_url: 'https://cdn.example.com/valen-portrait-v1.png',
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
    };
    const sharedUrlChar: CharacterModel = {
      id: 'char-shared-url-99',
      owner_id: 'other-player-42',
      name: 'Astrid Sol',
      level: 3,
      attributes: {
        Brawn: 1,
        Agility: 3,
        Technique: 2,
        Iron: 1,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 1,
        Shoot: 3,
        Parry: 0,
        Dodge: 2,
        Block: 0,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 2,
        Tinkering: 0,
        Medicine: 0,
        Survival: 2,
        Resolve: 0,
        Perception: 2,
        Sway: 0,
        Lore: 0,
      },
      current_hp: 11,
      current_sp: 6,
      current_ap: 4,
      equipped_armor: 'Light',
      equipped_shield: 'None',
      weapon_slot_1_id: 'wep-url-bow',
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      active_cooldowns: {},
      inventory: [
        {
          id: 'inv-quiver-1',
          name: 'Silvered Arrows',
          quantity: 20,
          description: 'Arrows tipped with cold silver.',
          category: 'item',
        },
      ],
      notes: 'Scout of the Sunspire',
      portrait_url: null,
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
    };
    vaultCharacters.set(vaultChar1.id, { ...vaultChar1 });
    vaultCharacters.set(sharedUrlChar.id, { ...sharedUrlChar });

    const collectionNpcTemplate: CollectionActorModel = {
      id: 'col-npc-chieftain-1',
      owner_id: 'gm-detach-1',
      folder_id: null,
      source_character_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Ashfang Chieftain',
      faction: 'enemy',
      size: 1,
      icon: 'battleaxe',
      color: '#EF4444',
      max_hp: 24,
      max_sp: 8,
      max_ap: 4,
      armor_dr: 3,
      shield_block: 0,
      move_feet: 20,
      vision_feet: 60,
      darkvision_feet: 20,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#F59E0B',
      portrait_url: null,
      token_image_url: null,
      token_appearance: { ...DEFAULT_TOKEN_APPEARANCE },
      npc_stats: {
        weapon_name: 'Jagged Cleaver',
        attack_ap: 1,
        attack_mod: 4,
        flat_damage: 6,
        reach_feet: 5,
        combat_tag: 'Crushing',
        parry_mod: 2,
        dodge_mod: 1,
        can_dodge: true,
        __inventory: [
          {
            id: 'npc-trophy-1',
            name: 'War Horn',
            quantity: 1,
            description: 'Carved bone horn.',
            category: 'item',
          },
        ],
      },
      notes: 'Original Collection NPC Notes',
      sort_order: 0,
    };
    const colActorsSig = signal<CollectionActorModel[]>([
      collectionNpcTemplate,
    ]);
    const charStoreListSig = signal<CharacterModel[]>([{ ...vaultChar1 }]);
    const realSheetUpdates: { id: string; patch: Partial<CharacterModel> }[] =
      [];
    let nextRosterSeq = 1;

    const urlBow: WeaponModel = {
      id: 'wep-url-bow',
      slug: 'sunspire-longbow',
      name: 'Sunspire Longbow',
      category: 'Ranged',
      ap_cost: 2,
      requires_aim: true,
      gov_attribute: 'Agility',
      gov_skill: 'Shoot',
      base_damage: 6,
      reach_tiles: 12,
      thrown_range_tiles: null,
      trait_name: 'Sunspire Draw',
      trait_description: 'Long-range recurve bow.',
      rule_hooks: { two_handed: true },
      is_active: true,
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'gm-detach-1', email: 'gm@example.com' }),
            isAdmin: () => true,
            displayName: () => 'GM Detach',
            handle: () => 'gmdetach',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal([urlBow]),
            weapons: signal([urlBow]),
            allArmors: signal(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal(DEFAULT_COMPENDIUM_ITEMS),
            items: signal(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal([]),
            perkNodes: signal([]),
            standaloneNodes: signal([]),
            allStandaloneNodes: signal([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: charStoreListSig,
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              charStoreListSig().find((c) => c.id === id),
            upsertRealtimeCharacter: (ch: CharacterModel) =>
              charStoreListSig.update((curr) =>
                curr.some((c) => c.id === ch.id)
                  ? curr.map((c) => (c.id === ch.id ? ch : c))
                  : [...curr, ch]
              ),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharacterById: async (id: string) => ({
              data: vaultCharacters.get(id) ?? null,
              error: vaultCharacters.has(id) ? null : 'Not found',
            }),
            updateCharacterRecord: async (
              id: string,
              patch: Partial<CharacterModel>
            ) => {
              realSheetUpdates.push({ id, patch });
              return null;
            },
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: colActorsSig,
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            createRosterActor: async (
              input: Omit<
                VttRosterActorModel,
                'id' | 'created_at' | 'updated_at'
              >
            ) => ({
              actor: {
                ...input,
                id: `roster-detached-${nextRosterSeq++}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as VttRosterActorModel,
              error: null,
            }),
            updateRosterActor: async () => null,
            updateToken: async () => null,
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `tok-detached-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            insertLog: async () => null,
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-detach-1',
      gm_id: 'gm-detach-1',
      name: 'Detached Sheets Campaign',
      cover_image_url: null,
      invite_code: 'DET001',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-detach-1',
        campaign_id: 'camp-detach-1',
        gm_id: 'gm-detach-1',
        folder_id: null,
        name: 'Watchtower Courtyard',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#0D1615',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-detach-1');
    vttStore.allCharacters.set([{ ...vaultChar1 }]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    const rootEl = fixture.nativeElement as HTMLElement;

    const importedValen = await vttStore.importCharacterToRoster(vaultChar1);
    expect(importedValen).toBeTruthy();
    expect(importedValen!.character_id).toBeNull();
    expect(resolveRosterActorSourceCharacterId(importedValen)).toBe(
      vaultChar1.id
    );
    expect(importedValen!.npc_stats.__character_sheet?.id).not.toBe(
      vaultChar1.id
    );

    const valenToken = await vttStore.deployRosterActor(importedValen!.id);
    expect(valenToken).toBeTruthy();
    expect(valenToken!.character_id).toBeNull();

    vttStore.openActorSheet(importedValen!.id);
    fixture.detectChanges();

    const vttSheetChar = vttStore.openSheetCharacter()!;
    expect(vttSheetChar.name).toBe('Valen Rook');
    expect(vttSheetChar.id).not.toBe(vaultChar1.id);

    await vttStore.updateCharacterFromVttSheet(vttSheetChar.id, (curr) => ({
      ...curr,
      name: 'Valen Rook (Battle-Scarred)',
      current_hp: 3,
      equipped_armor: 'Heavy',
      notes: 'Campaign-only scars and notes',
      inventory: [
        ...(curr.inventory ?? []),
        {
          id: 'inv-loot-1',
          name: 'Dungeon Key',
          quantity: 1,
          description: 'Iron key found in the crypt.',
          category: 'item',
        },
      ],
    }));
    await vttStore.patchToken(valenToken!.id, { current_hp: 2 });
    fixture.detectChanges();

    expect(realSheetUpdates.length).toBe(0);
    const untouchedStoreChar = charStoreListSig().find(
      (c) => c.id === vaultChar1.id
    )!;
    expect(untouchedStoreChar.name).toBe('Valen Rook');
    expect(untouchedStoreChar.current_hp).toBe(11);
    expect(untouchedStoreChar.equipped_armor).toBe('Light');
    expect(untouchedStoreChar.notes).toBe('Original Vault Bio');
    expect(untouchedStoreChar.inventory?.length).toBe(1);

    expect(vttStore.openSheetCharacter()?.name).toBe(
      'Valen Rook (Battle-Scarred)'
    );
    expect(vttStore.openSheetCharacter()?.current_hp).toBe(2);
    expect(vttStore.openSheetCharacter()?.equipped_armor).toBe('Heavy');
    expect(vttStore.openSheetCharacter()?.inventory?.length).toBe(2);

    vaultCharacters.set(vaultChar1.id, {
      ...vaultChar1,
      level: 4,
      equipped_armor: 'Medium',
      weapon_slot_1_id: 'wep-url-bow',
      notes: 'Updated on Real Site Sheet',
      inventory: [
        {
          id: 'inv-phoenix-1',
          name: 'Phoenix Draught',
          quantity: 3,
          description: 'Restorative alchemical elixir.',
          category: 'item',
        },
      ],
    });

    const reimportBtn = rootEl.querySelector(
      'button[data-reimport-character="true"]'
    ) as HTMLButtonElement | null;
    expect(reimportBtn).toBeTruthy();
    reimportBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.openSheetCharacter()?.name).toBe('Valen Rook');
    expect(vttStore.openSheetCharacter()?.level).toBe(4);
    expect(vttStore.openSheetCharacter()?.equipped_armor).toBe('Medium');
    expect(vttStore.openSheetCharacter()?.weapon_slot_1_id).toBe('wep-url-bow');
    expect(vttStore.openSheetCharacter()?.notes).toBe(
      'Updated on Real Site Sheet'
    );
    expect(vttStore.openSheetCharacter()?.inventory?.[0]?.name).toBe(
      'Phoenix Draught'
    );
    expect(vttStore.tokens()[0].name).toBe('Valen Rook');
    expect(realSheetUpdates.length).toBe(0);

    comp.openRosterImportModal(null);
    fixture.detectChanges();

    const urlInput = rootEl.querySelector(
      'input[data-import-character-url-input="true"]'
    ) as HTMLInputElement | null;
    const urlSubmit = rootEl.querySelector(
      'button[data-import-character-url-submit="true"]'
    ) as HTMLButtonElement | null;
    expect(urlInput).toBeTruthy();
    expect(urlSubmit).toBeTruthy();

    comp.rosterImportUrlInput.set(
      'https://marchoftime.app/characters/char-shared-url-99/edit'
    );
    fixture.detectChanges();

    await comp.submitRosterImportUrl();
    fixture.detectChanges();

    expect(comp.rosterImportUrlInput()).toBe('');
    const importedAstrid = vttStore
      .rosterActors()
      .find(
        (a) => resolveRosterActorSourceCharacterId(a) === 'char-shared-url-99'
      )!;
    expect(importedAstrid).toBeTruthy();
    expect(importedAstrid.character_id).toBeNull();
    expect(importedAstrid.name).toBe('Astrid Sol');
    expect(importedAstrid.npc_stats.weapon_name).toBe('Sunspire Longbow');
    expect(vttStore.openSheetCharacter()?.name).toBe('Astrid Sol');
    expect(
      vttStore.openSheetCharacter()?.inventory?.[0]?.name
    ).toBe('Silvered Arrows');
    expect((rootEl.textContent ?? '').toLowerCase()).not.toContain('vtt copy');

    expect(
      parseCollectionActorIdFromUrlOrInput(
        'https://marchoftime.app/collections?actor=col-npc-chieftain-1'
      )
    ).toBe('col-npc-chieftain-1');

    comp.rosterImportUrlInput.set(
      'https://marchoftime.app/collections?actor=col-npc-chieftain-1'
    );
    await comp.submitRosterImportUrl();
    fixture.detectChanges();

    const importedNpc = vttStore
      .rosterActors()
      .find((a) => a.collection_actor_id === 'col-npc-chieftain-1')!;
    expect(importedNpc).toBeTruthy();
    expect(importedNpc.actor_kind).toBe('npc');
    expect(importedNpc.name).toBe('Ashfang Chieftain');

    vttStore.closeActorSheet();
    vttStore.openActorSheet(importedNpc.id);
    fixture.detectChanges();

    await vttStore.updateNpcFromVttSheet(importedNpc.id, null, {
      name: 'Ashfang Chieftain (Wounded)',
      max_hp: 10,
      armor_dr: 1,
      npc_stats: {
        ...importedNpc.npc_stats,
        __inventory: [],
      },
      notes: 'Campaign-only NPC note',
    });
    fixture.detectChanges();

    expect(colActorsSig()[0].name).toBe('Ashfang Chieftain');
    expect(colActorsSig()[0].max_hp).toBe(24);
    expect(colActorsSig()[0].armor_dr).toBe(3);
    expect(colActorsSig()[0].npc_stats.__inventory?.length).toBe(1);
    expect(colActorsSig()[0].notes).toBe('Original Collection NPC Notes');

    colActorsSig.set([
      {
        ...collectionNpcTemplate,
        name: 'Ashfang Warlord',
        max_hp: 32,
        armor_dr: 5,
        notes: 'Upgraded in Collections Manager',
      },
    ]);

    const npcReimportBtn = rootEl.querySelector(
      'button[data-reimport-character="true"]'
    ) as HTMLButtonElement | null;
    expect(npcReimportBtn).toBeTruthy();
    npcReimportBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const reimportedNpc = vttStore
      .rosterActors()
      .find((a) => a.id === importedNpc.id)!;
    expect(reimportedNpc.name).toBe('Ashfang Warlord');
    expect(reimportedNpc.max_hp).toBe(32);
    expect(reimportedNpc.armor_dr).toBe(5);
    expect(reimportedNpc.notes).toBe('Upgraded in Collections Manager');
    expect(reimportedNpc.npc_stats.__inventory?.[0]?.name).toBe('War Horn');
  });

  it('should display the Actions tab on VTT Player Character and NPC sheets with Equipped Weapons, Defensive Actions, and Move / Other Actions', async () => {
    const vanguardBlade: WeaponModel = {
      id: 'wep-vanguard-blade',
      slug: 'vanguard-blade',
      name: 'Vanguard Arming Sword',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Technique',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: 'Balanced Edge',
      trait_description: 'Reliable steel blade.',
      rule_hooks: {},
      is_active: true,
    };

    const backupCrossbow: WeaponModel = {
      id: 'wep-backup-arbalest',
      slug: 'backup-arbalest',
      name: 'Ironwood Arbalest',
      category: 'Ranged',
      ap_cost: 2,
      requires_aim: true,
      gov_attribute: 'Agility',
      gov_skill: 'Shoot',
      base_damage: 6,
      reach_tiles: 12,
      thrown_range_tiles: null,
      trait_name: 'Heavy Draw',
      trait_description: 'High-impact bolt launcher.',
      rule_hooks: { two_handed: true },
      is_active: true,
    };

    const pcSource: CharacterModel = {
      id: 'char-actions-pc-1',
      owner_id: 'gm-actions-1',
      name: 'Kaelen Thorne',
      level: 3,
      attributes: {
        Brawn: 1,
        Agility: 2,
        Technique: 3,
        Iron: 2,
        Cunning: 0,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 1,
        Parry: 2,
        Dodge: 1,
        Block: 2,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 1,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 1,
        Perception: 2,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Medium',
      equipped_shield: 'Heater',
      weapon_slot_1_id: vanguardBlade.id,
      weapon_slot_2_id: backupCrossbow.id,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 9,
      current_sp: 5,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
    };

    let rosterSeq = 1;
    let logSeq = 1;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'gm-actions-1', email: 'gm@actions.test' }),
            isAdmin: () => true,
            displayName: () => 'GM Actions',
            handle: () => 'gmactions',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal([vanguardBlade, backupCrossbow]),
            weapons: signal([vanguardBlade, backupCrossbow]),
            allArmors: signal(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal(DEFAULT_COMPENDIUM_ITEMS),
            items: signal(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal([]),
            perkNodes: signal([]),
            standaloneNodes: signal([]),
            allStandaloneNodes: signal([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: signal([pcSource]),
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              id === pcSource.id ? pcSource : undefined,
            upsertRealtimeCharacter: () => undefined,
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharacterById: async (id: string) => ({
              data: id === pcSource.id ? pcSource : null,
              error: id === pcSource.id ? null : 'Not found',
            }),
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            createRosterActor: async (
              input: Omit<
                VttRosterActorModel,
                'id' | 'created_at' | 'updated_at'
              >
            ) => ({
              actor: {
                ...input,
                id: `roster-act-${rosterSeq++}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as VttRosterActorModel,
              error: null,
            }),
            updateRosterActor: async () => null,
            updateToken: async () => null,
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `tok-act-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            insertLog: async (entry: Record<string, unknown>) => ({
              ...entry,
              id: `log-act-${logSeq++}`,
              created_at: new Date().toISOString(),
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-actions-1',
      gm_id: 'gm-actions-1',
      name: 'Actions Tab Campaign',
      cover_image_url: null,
      invite_code: 'ACT101',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-actions-1',
        campaign_id: 'camp-actions-1',
        gm_id: 'gm-actions-1',
        folder_id: null,
        name: 'Rampart Walk',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#0D1615',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-actions-1');

    const fixture = TestBed.createComponent(VttRoomComponent);
    fixture.detectChanges();
    const rootEl = fixture.nativeElement as HTMLElement;

    const importedPc = await vttStore.importCharacterToRoster(pcSource);
    const deployedPcTok = await vttStore.deployRosterActor(importedPc!.id);
    vttStore.openTokenSheet(deployedPcTok!.id);
    fixture.detectChanges();

    const pcActionsPanel = rootEl.querySelector(
      '[data-vtt-actions-panel="pc"]'
    ) as HTMLElement | null;
    expect(pcActionsPanel).toBeTruthy();
    expect(pcActionsPanel!.textContent).toContain('Vanguard Arming Sword');
    expect(pcActionsPanel!.textContent).toContain('Ironwood Arbalest');
    expect(pcActionsPanel!.textContent).toContain('2d10 + 5');
    expect(pcActionsPanel!.textContent).toContain('7 DMG');
    expect(pcActionsPanel!.textContent).toContain('Defensive Actions');
    expect(pcActionsPanel!.textContent).toContain('Parry');
    expect(pcActionsPanel!.textContent).toContain('Dodge');
    expect(pcActionsPanel!.textContent).toContain('Raise Shield');
    expect(pcActionsPanel!.textContent).toContain('Other Actions');
    expect(pcActionsPanel!.textContent).toContain('Move');
    expect(pcActionsPanel!.textContent).toContain('Stance Recovery');
    expect(pcActionsPanel!.textContent).toContain('Aim');

    const moveBtn = pcActionsPanel!.querySelector(
      'button[data-vtt-action="move"]'
    ) as HTMLButtonElement | null;
    expect(moveBtn).toBeTruthy();
    moveBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.tokens()[0].current_ap).toBe(3);
    expect(vttStore.openSheetCharacter()!.current_ap).toBe(3);
    expect(
      vttStore.logs().some((l) => l.title.includes('Kaelen Thorne used Move'))
    ).toBe(true);

    const raiseGuardBtn = pcActionsPanel!.querySelector(
      'button[data-vtt-action="raise-guard"]'
    ) as HTMLButtonElement | null;
    expect(raiseGuardBtn).toBeTruthy();
    raiseGuardBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.tokens()[0].current_ap).toBe(2);
    expect(vttStore.tokens()[0].shield_raised).toBe(true);

    vttStore.closeActorSheet();
    const createdNpc = await vttStore.createVttActorQuick({
      name: 'Sentinel Halberdier',
      actor_kind: 'npc',
    });
    expect(createdNpc).toBeTruthy();
    fixture.detectChanges();

    const npcActionsPanel = rootEl.querySelector(
      '[data-vtt-actions-panel="npc"]'
    ) as HTMLElement | null;
    expect(npcActionsPanel).toBeTruthy();
    expect(npcActionsPanel!.textContent).toContain('Equipped Weapon & Attacks');
    expect(npcActionsPanel!.textContent).toContain('Defensive Actions');
    expect(npcActionsPanel!.textContent).toContain('Move');
    expect(npcActionsPanel!.textContent).toContain('20 ft');
  });

  it('should display the Actions tab and Sheet Navigation tabs on the Character Sheet (/characters/:id)', async () => {
    const greatsword: WeaponModel = {
      id: 'wep-iron-greatsword',
      slug: 'greatsword',
      name: 'Iron Greatsword',
      category: 'Heavy',
      ap_cost: 2,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 6,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: 'Cleaving Weight',
      trait_description: 'Two-handed guard blade.',
      rule_hooks: { two_handed: true, heavy_guard: true },
      is_active: true,
    };

    let storedChar: CharacterModel = {
      id: 'char-site-actions-1',
      owner_id: 'owner-site-act-1',
      name: 'Brynja Stone',
      level: 2,
      attributes: {
        Brawn: 3,
        Agility: 1,
        Technique: 2,
        Iron: 2,
        Cunning: 0,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 1,
        Dodge: 1,
        Block: 2,
      },
      field_skills: {
        Athletics: 2,
        Menace: 1,
        Stealth: 0,
        Tinkering: 0,
        Medicine: 0,
        Survival: 1,
        Resolve: 2,
        Perception: 0,
        Sway: 0,
        Lore: 0,
      },
      equipped_armor: 'Medium',
      equipped_shield: 'None',
      weapon_slot_1_id: greatsword.id,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      current_hp: 9,
      current_sp: 5,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [],
      notes: '',
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CharacterDetailComponent],
      providers: [
        provideRouter([
          { path: 'characters/:id', component: CharacterDetailComponent },
        ]),
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'owner-site-act-1', email: 'brynja@test.dev' }),
            isAdmin: () => false,
          },
        },
        {
          provide: CompendiumService,
          useValue: {
            fetchFullCompendium: async () => ({
              weapons: [greatsword],
              armors: DEFAULT_COMPENDIUM_ARMORS,
              items: DEFAULT_COMPENDIUM_ITEMS,
              skillTrees: [],
              perkNodes: [],
              keywords: [],
            }),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharactersByOwner: async () => ({
              data: [storedChar],
              error: null,
            }),
            fetchCharacterById: async () => ({
              data: storedChar,
              error: null,
            }),
            updateCharacterRecord: async (
              _id: string,
              patch: Partial<CharacterModel>
            ) => {
              storedChar = { ...storedChar, ...patch };
              return null;
            },
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create(
      '/characters/char-site-actions-1'
    );
    const detailComp = harness.routeDebugElement!
      .componentInstance as CharacterDetailComponent;
    await harness.fixture.whenStable();
    harness.detectChanges();

    const sheetEl = harness.routeNativeElement as HTMLElement;
    expect(detailComp.sheetTab()).toBe('actions');

    const actionsPanel = sheetEl.querySelector(
      '[data-char-actions-panel="true"]'
    ) as HTMLElement | null;
    expect(actionsPanel).toBeTruthy();
    expect(actionsPanel!.textContent).toContain('Iron Greatsword');
    expect(actionsPanel!.textContent).toContain('2d10 + 5');
    expect(actionsPanel!.textContent).toContain('9 DMG');
    expect(actionsPanel!.textContent).toContain('Parry Reaction');
    expect(actionsPanel!.textContent).toContain('Dodge Reaction');
    expect(actionsPanel!.textContent).toContain('Raise Weapon Guard');
    expect(actionsPanel!.textContent).toContain('Move');
    expect(actionsPanel!.textContent).toContain('Stance Recovery');
    expect(actionsPanel!.textContent).toContain('Aim');
    expect(actionsPanel!.textContent).toContain('Interact / Use Item');

    const siteMoveBtn = actionsPanel!.querySelector(
      'button[data-char-action="move"]'
    ) as HTMLButtonElement | null;
    expect(siteMoveBtn).toBeTruthy();
    siteMoveBtn!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(detailComp.character()!.current_ap).toBe(3);

    const charSkillsTabBtn = sheetEl.querySelector(
      'button[data-char-sheet-tab="character"]'
    ) as HTMLButtonElement | null;
    expect(charSkillsTabBtn).toBeTruthy();
    charSkillsTabBtn!.click();
    harness.detectChanges();
    expect(sheetEl.textContent).toContain('Core Attributes');
    expect(sheetEl.querySelector('[data-char-field-skills="true"]')).toBeNull();

    const fieldSkillsTabBtn = sheetEl.querySelector(
      'button[data-char-sheet-tab="field_skills"]'
    ) as HTMLButtonElement | null;
    expect(fieldSkillsTabBtn).toBeTruthy();
    fieldSkillsTabBtn!.click();
    harness.detectChanges();
    const charFieldSkillsSec = sheetEl.querySelector(
      '[data-char-field-skills="true"]'
    ) as HTMLElement | null;
    expect(charFieldSkillsSec).toBeTruthy();
    expect(charFieldSkillsSec!.textContent).toContain('Field Skills');
    expect(charFieldSkillsSec!.textContent).not.toContain('10 Field Skills');
  });

  it('should render the hybrid Argon Core Dock + Upward Flyout Action HUD when a controllable token is selected in VTT', async () => {
    const duelistRapier: WeaponModel = {
      id: 'wep-duelist-rapier',
      slug: 'duelist-rapier',
      name: 'Silverleaf Rapier',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Technique',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: 'Needle Point',
      trait_description: 'Swift dueling blade.',
      rule_hooks: {},
      is_active: true,
    };

    const throwingDagger: WeaponModel = {
      id: 'wep-throwing-dagger',
      slug: 'throwing-dagger',
      name: 'Whisper Dagger',
      category: 'Light',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Agility',
      gov_skill: 'Strike',
      base_damage: 3,
      reach_tiles: 1,
      thrown_range_tiles: 4,
      trait_name: 'Balanced',
      trait_description: 'Can be thrown up to 20 ft.',
      rule_hooks: {},
      is_active: true,
    };

    const lungeArt: PerkNodeModel = {
      id: 'perk-hud-lunge',
      tree_id: 'tree-duelist',
      slug: 'flashing-lunge',
      name: 'Flashing Lunge',
      tier: 1,
      parent_node_id: null,
      node_type: 'combat_art',
      ap_cost: 2,
      cooldown_rounds: 2,
      perk_cost: 1,
      combat_tag: 'Piercing',
      description: 'Lunging thrust that bypasses shield block.',
      rule_hooks: { disallow_defense: ['Block'] },
    };

    const hudCharacter: CharacterModel = {
      id: 'char-hud-hybrid-1',
      owner_id: 'gm-hud-1',
      name: 'Lyra Vance',
      level: 3,
      attributes: {
        Brawn: 1,
        Agility: 2,
        Technique: 3,
        Iron: 2,
        Cunning: 1,
      },
      combat_skills: {
        Strike: 2,
        Shoot: 0,
        Parry: 2,
        Dodge: 2,
        Block: 1,
      },
      field_skills: {
        Athletics: 1,
        Menace: 0,
        Stealth: 2,
        Tinkering: 0,
        Medicine: 1,
        Survival: 0,
        Resolve: 1,
        Perception: 3,
        Sway: 1,
        Lore: 0,
      },
      equipped_armor: 'Light',
      equipped_shield: 'Heater',
      weapon_slot_1_id: duelistRapier.id,
      weapon_slot_2_id: throwingDagger.id,
      active_weapon_slot: 1,
      unlocked_perk_ids: [lungeArt.id],
      current_hp: 9,
      current_sp: 6,
      current_ap: 4,
      active_cooldowns: {},
      inventory: [
        {
          id: 'inv-poultice-1',
          category: 'item',
          subcategory: 'Medical',
          name: 'Field Poultice',
          quantity: 2,
          description: 'Stabilizes wounds.',
        },
      ],
      notes: '',
    };

    let rosterSeq = 1;
    let logSeq = 1;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: () => ({ id: 'gm-hud-1', email: 'gm@hud.test' }),
            isAdmin: () => true,
            displayName: () => 'GM Hud',
            handle: () => 'gmhud',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal([duelistRapier, throwingDagger]),
            weapons: signal([duelistRapier, throwingDagger]),
            allArmors: signal(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal(DEFAULT_COMPENDIUM_ITEMS),
            items: signal(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal([lungeArt]),
            perkNodes: signal([lungeArt]),
            standaloneNodes: signal([]),
            allStandaloneNodes: signal([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: signal([hudCharacter]),
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: (id: string) =>
              id === hudCharacter.id ? hudCharacter : undefined,
            upsertRealtimeCharacter: () => undefined,
          },
        },
        {
          provide: CharacterService,
          useValue: {
            fetchCharacterById: async (id: string) => ({
              data: id === hudCharacter.id ? hudCharacter : null,
              error: id === hudCharacter.id ? null : 'Not found',
            }),
            updateCharacterRecord: async () => null,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: UserAssetsStore,
          useValue: {
            assets: signal([]),
            folders: signal([]),
            isLoading: signal(false),
            isUploading: signal(false),
            error: signal(null),
            ensureLoaded: async () => undefined,
            findAssetByUrl: () => null,
            resolveTargetFolderId: () => null,
          },
        },
        {
          provide: VttService,
          useValue: {
            createRosterActor: async (
              input: Omit<
                VttRosterActorModel,
                'id' | 'created_at' | 'updated_at'
              >
            ) => ({
              actor: {
                ...input,
                id: `roster-hud-${rosterSeq++}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as VttRosterActorModel,
              error: null,
            }),
            updateRosterActor: async () => null,
            updateToken: async () => null,
            updateScene: async () => ({ error: null, needsMigration: false }),
            insertToken: async (
              input: Omit<VttTokenModel, 'id'> & { id?: string }
            ) => ({
              token: {
                ...input,
                id: input.id ?? `tok-hud-${input.name}`,
              } as VttTokenModel,
              error: null,
              needsMigration: false,
            }),
            insertLog: async (entry: Record<string, unknown>) => ({
              ...entry,
              id: `log-hud-${logSeq++}`,
              created_at: new Date().toISOString(),
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-hud-1',
      gm_id: 'gm-hud-1',
      name: 'Hybrid HUD Campaign',
      cover_image_url: null,
      invite_code: 'HUD101',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-hud-1',
        campaign_id: 'camp-hud-1',
        gm_id: 'gm-hud-1',
        folder_id: null,
        name: 'Dueling Hall',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#0D1615',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        round_number: 1,
        combat_active: false,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-hud-1');

    const fixture = TestBed.createComponent(VttRoomComponent);
    fixture.detectChanges();
    const rootEl = fixture.nativeElement as HTMLElement;

    const importedLyra = await vttStore.importCharacterToRoster(hudCharacter);
    const lyraTok = await vttStore.deployRosterActor(importedLyra!.id);
    vttStore.selectedTokenId.set(lyraTok!.id);
    fixture.detectChanges();

    const hudEl = rootEl.querySelector(
      '[data-vtt-action-hud="true"]'
    ) as HTMLElement | null;
    expect(hudEl).toBeTruthy();
    expect(
      hudEl!.querySelector('[data-hud-argon-dock="true"]')
    ).toBeTruthy();
    expect(hudEl!.textContent).toContain('Silverleaf Rapier');
    expect(hudEl!.textContent).toContain('Whisper Dagger');
    expect(hudEl!.textContent).not.toContain('Flashing Lunge');
    expect(hudEl!.textContent).toContain('Combat Arts');
    expect(hudEl!.textContent).toContain('Guard');
    expect(hudEl!.textContent).toContain('Parry');
    expect(hudEl!.textContent).toContain('Dodge');
    expect(hudEl!.textContent).toContain('Move');
    expect(hudEl!.textContent).toContain('Aim');

    const preCombatPip = hudEl!.querySelector(
      'button[aria-label="Set AP to 2"]'
    ) as HTMLButtonElement | null;
    expect(preCombatPip).toBeTruthy();
    preCombatPip!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      vttStore.logs().some((l) => l.title.includes('AP Adjusted'))
    ).toBe(false);
    const restorePreCombatPip = hudEl!.querySelector(
      'button[aria-label="Set AP to 4"]'
    ) as HTMLButtonElement;
    restorePreCombatPip.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const artsTileBtn = hudEl!.querySelector(
      'button[data-hud-tile="combat-arts"]'
    ) as HTMLButtonElement | null;
    expect(artsTileBtn).toBeTruthy();
    artsTileBtn!.click();
    fixture.detectChanges();
    const artsFlyout = hudEl!.querySelector(
      '[data-hud-flyout="arts"]'
    ) as HTMLElement | null;
    expect(artsFlyout).toBeTruthy();
    expect(artsFlyout!.textContent).toContain('Flashing Lunge');
    artsTileBtn!.click();
    fixture.detectChanges();

    const hpBarBtn = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_hp"]'
    ) as HTMLButtonElement | null;
    expect(hpBarBtn).toBeTruthy();
    hpBarBtn!.click();
    fixture.detectChanges();

    const hpInput1 = hudEl!.querySelector(
      'input[data-hud-vital-input="current_hp"]'
    ) as HTMLInputElement | null;
    expect(hpInput1).toBeTruthy();
    hpInput1!.value = '5';
    hpInput1!.dispatchEvent(new Event('input'));
    hpInput1!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_hp).toBe(5);

    const hpBarBtn2 = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_hp"]'
    ) as HTMLButtonElement;
    hpBarBtn2.click();
    fixture.detectChanges();
    const hpInput2 = hudEl!.querySelector(
      'input[data-hud-vital-input="current_hp"]'
    ) as HTMLInputElement;
    hpInput2.value = '-3';
    hpInput2.dispatchEvent(new Event('input'));
    hpInput2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_hp).toBe(2);

    const hpBarBtn3 = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_hp"]'
    ) as HTMLButtonElement;
    hpBarBtn3.click();
    fixture.detectChanges();
    const hpInput3 = hudEl!.querySelector(
      'input[data-hud-vital-input="current_hp"]'
    ) as HTMLInputElement;
    hpInput3.value = '+4';
    hpInput3.dispatchEvent(new Event('input'));
    hpInput3.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_hp).toBe(6);

    const settingsStore = TestBed.inject(VttSettingsStore);
    settingsStore.resetPreferences();
    expect(settingsStore.preferences().overflowSpDamageToHp).toBe(true);

    const spSetBtn = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_sp"]'
    ) as HTMLButtonElement | null;
    expect(spSetBtn).toBeTruthy();
    spSetBtn!.click();
    fixture.detectChanges();
    const spSetInput = hudEl!.querySelector(
      'input[data-hud-vital-input="current_sp"]'
    ) as HTMLInputElement | null;
    expect(spSetInput).toBeTruthy();
    spSetInput!.value = '4';
    spSetInput!.dispatchEvent(new Event('input'));
    spSetInput!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_sp).toBe(4);
    expect(vttStore.tokens()[0].current_hp).toBe(6);

    const spOverflowBtn = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_sp"]'
    ) as HTMLButtonElement;
    spOverflowBtn.click();
    fixture.detectChanges();
    const spOverflowInput = hudEl!.querySelector(
      'input[data-hud-vital-input="current_sp"]'
    ) as HTMLInputElement;
    spOverflowInput.value = '-5';
    spOverflowInput.dispatchEvent(new Event('input'));
    spOverflowInput.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_sp).toBe(0);
    expect(vttStore.tokens()[0].current_hp).toBe(5);

    settingsStore.updatePreferences({ overflowSpDamageToHp: false });
    const spRefillBtn = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_sp"]'
    ) as HTMLButtonElement;
    spRefillBtn.click();
    fixture.detectChanges();
    const spRefillInput = hudEl!.querySelector(
      'input[data-hud-vital-input="current_sp"]'
    ) as HTMLInputElement;
    spRefillInput.value = '3';
    spRefillInput.dispatchEvent(new Event('input'));
    spRefillInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();

    const spNoOverflowBtn = hudEl!.querySelector(
      'button[data-hud-vital-bar="current_sp"]'
    ) as HTMLButtonElement;
    spNoOverflowBtn.click();
    fixture.detectChanges();
    const spNoOverflowInput = hudEl!.querySelector(
      'input[data-hud-vital-input="current_sp"]'
    ) as HTMLInputElement;
    spNoOverflowInput.value = '-5';
    spNoOverflowInput.dispatchEvent(new Event('input'));
    spNoOverflowInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' })
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_sp).toBe(0);
    expect(vttStore.tokens()[0].current_hp).toBe(5);
    settingsStore.resetPreferences();

    fixture.componentInstance.openSettingsModal('general');
    fixture.detectChanges();
    expect(
      rootEl.querySelector('input[data-vtt-pref-sp-overflow="true"]')
    ).toBeTruthy();
    fixture.componentInstance.closeSettingsModal();
    fixture.detectChanges();

    const swapBtn = hudEl!.querySelector(
      'button[data-hud-tile="swap-weapon"]'
    ) as HTMLButtonElement | null;
    expect(swapBtn).toBeTruthy();
    swapBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.selectedTokenCharacter()!.active_weapon_slot).toBe(2);
    expect(vttStore.tokens()[0].current_ap).toBe(3);

    expect(resolveCombatArtRangeMode(lungeArt)).toBe('melee_reach');
    expect(computeCombatArtReachFeet(lungeArt, throwingDagger)).toBe(5);
    expect(
      computeCombatArtReachFeet(
        { rule_hooks: { __range_mode: 'weapon_thrown' } },
        throwingDagger
      )
    ).toBe(20);
    expect(
      computeCombatArtReachFeet(
        {
          rule_hooks: {
            __range_mode: 'custom_feet',
            __custom_range_feet: 15,
          },
        },
        throwingDagger
      )
    ).toBe(15);

    const openArtsBtn = hudEl!.querySelector(
      'button[data-hud-flyout-btn="arts"]'
    ) as HTMLButtonElement | null;
    expect(openArtsBtn).toBeTruthy();
    openArtsBtn!.click();
    fixture.detectChanges();
    const lungeBtn = hudEl!.querySelector(
      'button[data-hud-art="perk-hud-lunge"]'
    ) as HTMLButtonElement | null;
    expect(lungeBtn).toBeTruthy();
    expect(lungeBtn!.textContent).toContain('Reach 5 ft');
    lungeBtn!.click();
    fixture.detectChanges();
    expect(vttStore.pendingTargetAction()?.reachFeet).toBe(5);
    vttStore.cancelTargetSelection();
    fixture.detectChanges();

    await vttStore.patchToken(vttStore.tokens()[0].id, { current_hp: 0 });
    fixture.detectChanges();
    const downBadgeEl = rootEl.querySelector(
      '[data-canvas-token-down="true"]'
    ) as HTMLElement | null;
    expect(downBadgeEl).toBeTruthy();
    expect(downBadgeEl!.textContent?.trim()).toBe('Down');
    expect(rootEl.textContent).not.toContain('KO');
    await vttStore.patchToken(vttStore.tokens()[0].id, { current_hp: 6 });
    fixture.detectChanges();

    const skillsFlyoutBtn = hudEl!.querySelector(
      'button[data-hud-flyout-btn="skills"]'
    ) as HTMLButtonElement | null;
    expect(skillsFlyoutBtn).toBeTruthy();
    skillsFlyoutBtn!.click();
    fixture.detectChanges();

    const skillsFlyout = hudEl!.querySelector(
      '[data-hud-flyout="skills"]'
    ) as HTMLElement | null;
    expect(skillsFlyout).toBeTruthy();
    expect(skillsFlyout!.textContent).toContain('Attributes');
    expect(skillsFlyout!.textContent).toContain('Combat Skills');
    expect(skillsFlyout!.textContent).toContain('Field Skills');
    expect(skillsFlyout!.textContent).not.toContain('5 Attributes');
    expect(skillsFlyout!.textContent).not.toContain('5 Combat Skills');
    expect(skillsFlyout!.textContent).not.toContain('10 Field Skills');
    expect(skillsFlyout!.textContent).not.toContain('R0');

    const perceptionBtn = skillsFlyout!.querySelector(
      'button[data-hud-skill-roll="Perception"]'
    ) as HTMLButtonElement | null;
    expect(perceptionBtn).toBeTruthy();
    perceptionBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      vttStore.logs().some((l) => l.title.includes('Perception Check'))
    ).toBe(true);

    const itemsFlyoutBtn = hudEl!.querySelector(
      'button[data-hud-flyout-btn="items"]'
    ) as HTMLButtonElement | null;
    itemsFlyoutBtn!.click();
    fixture.detectChanges();

    const itemsFlyout = hudEl!.querySelector(
      '[data-hud-flyout="items"]'
    ) as HTMLElement | null;
    expect(itemsFlyout).toBeTruthy();
    expect(itemsFlyout!.textContent).toContain('Field Poultice');
    const consumeBtn = Array.from(
      itemsFlyout!.querySelectorAll('button')
    ).find((b) => (b.textContent ?? '').trim() === 'Consume')!;
    consumeBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].current_ap).toBe(2);
    expect(
      vttStore.selectedTokenCharacter()!.inventory?.[0]?.quantity
    ).toBe(1);

    const statusesFlyoutBtn = hudEl!.querySelector(
      'button[data-hud-flyout-btn="statuses"]'
    ) as HTMLButtonElement | null;
    statusesFlyoutBtn!.click();
    fixture.detectChanges();
    const bleedingBtn = hudEl!.querySelector(
      'button[data-hud-status-toggle="Bleeding"]'
    ) as HTMLButtonElement | null;
    expect(bleedingBtn).toBeTruthy();
    bleedingBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.tokens()[0].statuses).toContain('Bleeding');

    await vttStore.startCombatEncounter();
    fixture.detectChanges();
    expect(
      hudEl!.querySelector('button[data-hud-end-turn="true"]')
    ).toBeTruthy();

    const combatPipBtn = hudEl!.querySelector(
      'button[aria-label="Set AP to 3"]'
    ) as HTMLButtonElement | null;
    expect(combatPipBtn).toBeTruthy();
    combatPipBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const apLog = vttStore
      .logs()
      .find((l) => l.title.includes('AP Adjusted (−1 AP)'));
    expect(apLog).toBeTruthy();
    expect(apLog!.detail).toBe('4/4 AP → 3/4 AP');

    const collapseBtn = hudEl!.querySelector(
      'button[data-hud-collapse-toggle="true"]'
    ) as HTMLButtonElement | null;
    collapseBtn!.click();
    fixture.detectChanges();
    expect(
      hudEl!.querySelector('[data-hud-compact-bar="true"]')
    ).toBeTruthy();

    collapseBtn!.click();
    const scoutNpc = await vttStore.createVttActorQuick({
      name: 'Borderland Scout',
      actor_kind: 'npc',
    });
    expect(scoutNpc).toBeTruthy();
    await vttStore.updateNpcFromVttSheet(scoutNpc!.id, null, {
      npc_stats: {
        ...scoutNpc!.npc_stats,
        attributes: {
          Brawn: 1,
          Agility: 2,
          Technique: 2,
          Iron: 1,
          Cunning: 3,
        },
        combat_skills: {
          Strike: 1,
          Shoot: 2,
          Parry: 1,
          Dodge: 2,
          Block: 0,
        },
        field_skills: {
          Athletics: 1,
          Menace: 0,
          Stealth: 2,
          Tinkering: 0,
          Medicine: 0,
          Survival: 2,
          Resolve: 1,
          Perception: 2,
          Sway: 0,
          Lore: 1,
        },
      },
    });
    fixture.detectChanges();

    const npcSkillsTabBtn = rootEl.querySelector(
      'button[data-vtt-npc-tab="skills"]'
    ) as HTMLButtonElement | null;
    expect(npcSkillsTabBtn).toBeTruthy();
    npcSkillsTabBtn!.click();
    fixture.detectChanges();
    const npcSkillsPanel = rootEl.querySelector(
      '[data-vtt-npc-skills="true"]'
    ) as HTMLElement | null;
    expect(npcSkillsPanel).toBeTruthy();
    expect(npcSkillsPanel!.textContent).toContain('Attributes');
    expect(npcSkillsPanel!.textContent).toContain('Combat Skills');
    expect(npcSkillsPanel!.textContent).toContain('Field Skills');
    expect(npcSkillsPanel!.textContent).not.toContain('5 Attributes');
    expect(npcSkillsPanel!.textContent).not.toContain('10 Field Skills');
    expect(npcSkillsPanel!.textContent).not.toContain('R0');
    expect(npcSkillsPanel!.textContent).toContain('Perception');
    expect(npcSkillsPanel!.textContent).toContain('2d10 + 5');

    const scoutTok = await vttStore.deployRosterActor(scoutNpc!.id);
    vttStore.selectedTokenId.set(scoutTok!.id);
    fixture.detectChanges();

    const npcHudEl = rootEl.querySelector(
      '[data-vtt-action-hud="true"]'
    ) as HTMLElement;
    const npcSkillsBtn = npcHudEl.querySelector(
      'button[data-hud-flyout-btn="skills"]'
    ) as HTMLButtonElement;
    npcSkillsBtn.click();
    fixture.detectChanges();
    const npcSkillsFlyout = npcHudEl.querySelector(
      '[data-hud-flyout="skills"]'
    ) as HTMLElement;
    expect(npcSkillsFlyout).toBeTruthy();
    expect(npcSkillsFlyout.textContent).toContain('Attributes');
    expect(npcSkillsFlyout.textContent).toContain('Field Skills');
    expect(npcSkillsFlyout.textContent).toContain('Perception');
    expect(npcSkillsFlyout.textContent).toContain('2d10+5');
    expect(npcSkillsFlyout.textContent).not.toContain('R0');
    expect(npcSkillsFlyout.textContent).not.toContain('Trained Check');

    vttStore.setSelectedTokens([lyraTok!.id, scoutTok!.id]);
    fixture.detectChanges();

    const multiHudEl = rootEl.querySelector(
      '[data-vtt-action-hud="true"][data-vtt-multi-hud="true"]'
    ) as HTMLElement | null;
    expect(multiHudEl).toBeTruthy();
    expect(multiHudEl!.textContent).toContain('2 Tokens Selected');
    expect(multiHudEl!.textContent).toContain('Roll Initiative');
    expect(multiHudEl!.textContent).toContain('Parry');
    expect(multiHudEl!.textContent).toContain('Dodge');
    expect(multiHudEl!.textContent).toContain('Move');
    expect(multiHudEl!.textContent).toContain('Aim');
    expect(multiHudEl!.textContent).toContain('Interact');

    const rollInitBtn = multiHudEl!.querySelector(
      'button[data-hud-tile="roll-initiative"]'
    ) as HTMLButtonElement | null;
    expect(rollInitBtn).toBeTruthy();
    rollInitBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const updatedLyraTok = vttStore
      .tokens()
      .find((t) => t.id === lyraTok!.id)!;
    const updatedScoutTok = vttStore
      .tokens()
      .find((t) => t.id === scoutTok!.id)!;
    expect(typeof updatedLyraTok.npc_stats?.__initiative).toBe('number');
    expect(updatedLyraTok.npc_stats?.__initiative_mod).toBe(1);
    expect(typeof updatedScoutTok.npc_stats?.__initiative).toBe('number');
    expect(updatedScoutTok.npc_stats?.__initiative_mod).toBe(3);
    const lyraInitLog = vttStore
      .logs()
      .find((l) => l.title.includes(`${updatedLyraTok.name} · Initiative`));
    expect(lyraInitLog).toBeTruthy();
    expect(lyraInitLog?.detail).toBe('Cunning +1');
    expect(
      vttStore
        .logs()
        .some((l) => l.title.includes(`${updatedScoutTok.name} · Initiative`))
    ).toBe(true);
    expect(vttStore.activeScene()!.initiative_order.length).toBe(2);

    const groupSkillsBtn = multiHudEl!.querySelector(
      'button[data-hud-flyout-btn="skills"]'
    ) as HTMLButtonElement;
    groupSkillsBtn.click();
    fixture.detectChanges();
    const groupStealthBtn = multiHudEl!.querySelector(
      'button[data-hud-skill-roll="Stealth"]'
    ) as HTMLButtonElement;
    expect(groupStealthBtn).toBeTruthy();
    groupStealthBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      vttStore
        .logs()
        .filter((l) => l.title.includes('Stealth Check')).length
    ).toBeGreaterThanOrEqual(2);

    const lyraHpBefore = vttStore.tokens().find((t) => t.id === lyraTok!.id)!
      .current_hp;
    const scoutHpBefore = vttStore.tokens().find((t) => t.id === scoutTok!.id)!
      .current_hp;
    const groupHpBtn = multiHudEl!.querySelector(
      'button[data-hud-vital-bar="current_hp"]'
    ) as HTMLButtonElement;
    groupHpBtn.click();
    fixture.detectChanges();
    const groupHpInput = multiHudEl!.querySelector(
      'input[data-hud-vital-input="current_hp"]'
    ) as HTMLInputElement;
    groupHpInput.value = '-2';
    groupHpInput.dispatchEvent(new Event('input'));
    groupHpInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      vttStore.tokens().find((t) => t.id === lyraTok!.id)!.current_hp
    ).toBe(Math.max(0, lyraHpBefore - 2));
    expect(
      vttStore.tokens().find((t) => t.id === scoutTok!.id)!.current_hp
    ).toBe(Math.max(0, scoutHpBefore - 2));
  });

  it('should lock in both attacker and defender Clash actions before rolling and restrict Apply Outcome to GM', async () => {
    const activeUserSig = signal<{ id: string; email: string }>({
      id: 'player-atk',
      email: 'atk@test.com',
    });
    let logSeq = 1;

    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: activeUserSig,
            isAdmin: () => activeUserSig().id === 'gm-clash-1',
            displayName: () => activeUserSig().id,
            handle: () => activeUserSig().id,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal([]),
            weapons: signal([]),
            allArmors: signal(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal(DEFAULT_COMPENDIUM_ITEMS),
            items: signal(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal([]),
            perkNodes: signal([]),
            standaloneNodes: signal([]),
            allStandaloneNodes: signal([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: signal([]),
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: () => undefined,
            upsertRealtimeCharacter: () => undefined,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateToken: async () => null,
            updateScene: async () => ({ error: null, needsMigration: false }),
            insertLog: async (entry: Record<string, unknown>) => ({
              ...entry,
              id: `log-clash-${logSeq++}`,
              created_at: new Date().toISOString(),
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-clash-sim',
      gm_id: 'gm-clash-1',
      name: 'Simultaneous Clash Campaign',
      cover_image_url: null,
      invite_code: 'CLSH01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-clash-sim',
        campaign_id: 'camp-clash-sim',
        gm_id: 'gm-clash-1',
        folder_id: null,
        name: 'Arena',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#09100F',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        combat_active: true,
        round_number: 1,
        active_turn_token_id: 'tok-atk',
        initiative_order: ['tok-atk', 'tok-def'],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-clash-sim');
    vttStore.tokens.set([
      {
        id: 'tok-atk',
        encounter_id: 'scene-clash-sim',
        character_id: null,
        owner_id: 'player-atk',
        name: 'Vanguard Kael',
        faction: 'ally',
        x: 2,
        y: 2,
        q: 2,
        r: 2,
        size: 1,
        icon: 'greatsword',
        color: '#38B29A',
        current_hp: 10,
        max_hp: 10,
        current_sp: 4,
        max_sp: 4,
        current_ap: 4,
        max_ap: 4,
        armor_dr: 1,
        shield_block: 0,
        move_feet: 20,
        vision_feet: 30,
        darkvision_feet: 0,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#F59E0B',
        shield_raised: false,
        is_hidden: false,
        statuses: [],
        npc_stats: {
          weapon_name: 'Iron Greatsword',
          attack_ap: 1,
          attack_mod: 4,
          flat_damage: 6,
          reach_feet: 5,
          parry_mod: 2,
          dodge_mod: 1,
          can_dodge: true,
        },
      },
      {
        id: 'tok-def',
        encounter_id: 'scene-clash-sim',
        character_id: null,
        owner_id: 'player-def',
        name: 'Rival Duelist',
        faction: 'enemy',
        x: 3,
        y: 2,
        q: 3,
        r: 2,
        size: 1,
        icon: 'rapier',
        color: '#EF4444',
        current_hp: 10,
        max_hp: 10,
        current_sp: 2,
        max_sp: 4,
        current_ap: 4,
        max_ap: 4,
        armor_dr: 1,
        shield_block: 0,
        move_feet: 20,
        vision_feet: 30,
        darkvision_feet: 0,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#F59E0B',
        shield_raised: false,
        is_hidden: false,
        statuses: [],
        npc_stats: {
          weapon_name: 'Steel Saber',
          attack_ap: 1,
          attack_mod: 3,
          flat_damage: 4,
          reach_feet: 5,
          parry_mod: 2,
          dodge_mod: 2,
          can_dodge: true,
        },
      },
    ]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    fixture.detectChanges();
    const rootEl = fixture.nativeElement as HTMLElement;

    vttStore.manualRollOverride.set(18);
    vttStore.beginWeaponTargetSelection(vttStore.tokens()[0]);
    await vttStore.launchClashAgainstTarget('tok-def');
    fixture.detectChanges();

    expect(vttStore.pendingClash()).toBeTruthy();
    expect(vttStore.pendingClash()!.attackRoll).toBeNull();
    expect(rootEl.querySelector('[data-clash-pending-roll="true"]')).toBeTruthy();
    expect(rootEl.querySelector('[data-clash-attack-roll="true"]')).toBeNull();
    expect(rootEl.querySelector('[data-clash-reaction="parry"]')).toBeNull();

    activeUserSig.set({ id: 'player-def', email: 'def@test.com' });
    fixture.detectChanges();

    const parryReactionBtn = rootEl.querySelector(
      'button[data-clash-reaction="parry"]'
    ) as HTMLButtonElement | null;
    expect(parryReactionBtn).toBeTruthy();
    await vttStore.declareClashReaction('parry', 12);
    fixture.detectChanges();

    expect(vttStore.pendingClash()!.attackRoll?.total).toBe(18);
    expect(vttStore.pendingClash()!.resolution?.defenseRoll?.total).toBe(12);
    expect(rootEl.querySelector('[data-clash-attack-roll="true"]')).toBeTruthy();
    expect(rootEl.querySelector('[data-clash-defense-roll="true"]')).toBeTruthy();
    expect(rootEl.querySelector('[data-clash-apply-outcome="true"]')).toBeNull();
    expect(rootEl.querySelector('[data-clash-awaiting-gm="true"]')).toBeTruthy();

    await vttStore.applyPendingClashOutcome();
    expect(vttStore.pendingClash()).toBeTruthy();
    expect(vttStore.tokens()[1].current_hp).toBe(10);

    activeUserSig.set({ id: 'gm-clash-1', email: 'gm@test.com' });
    fixture.detectChanges();

    const applyOutcomeBtn = rootEl.querySelector(
      'button[data-clash-apply-outcome="true"]'
    ) as HTMLButtonElement | null;
    expect(applyOutcomeBtn).toBeTruthy();
    expect(
      rootEl.querySelector('button[data-clash-dismiss-manual="true"]')
    ).toBeTruthy();

    applyOutcomeBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.pendingClash()).toBeNull();
    expect(vttStore.tokens()[1].current_sp).toBe(0);
    expect(vttStore.tokens()[1].current_hp).toBe(7);
    expect(vttStore.tokens()[1].current_ap).toBe(3);
  });

  it('should enroll anyone who rolls Initiative into the Combat Carousel lobby, start Round 1 with only enrolled combatants, allow mid-combat Initiative joins, and support GM tracker edits', async () => {
    localStorage.removeItem('mot.vtt.combat_tracker_window.v1');
    const activeUserSig = signal<{ id: string; email: string }>({
      id: 'player-a',
      email: 'playera@test.com',
    });
    let logSeq = 1;

    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: activeUserSig,
            isAdmin: () => activeUserSig().id === 'gm-init-1',
            displayName: () => activeUserSig().id,
            handle: () => activeUserSig().id,
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal([]),
            weapons: signal([]),
            allArmors: signal(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal(DEFAULT_COMPENDIUM_ITEMS),
            items: signal(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal([]),
            perkNodes: signal([]),
            standaloneNodes: signal([]),
            allStandaloneNodes: signal([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: signal([]),
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: () => undefined,
            upsertRealtimeCharacter: () => undefined,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateToken: async () => null,
            updateScene: async () => ({ error: null, needsMigration: false }),
            insertLog: async (entry: Record<string, unknown>) => ({
              ...entry,
              id: `log-init-${logSeq++}`,
              created_at: new Date().toISOString(),
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-init-carousel',
      gm_id: 'gm-init-1',
      name: 'Initiative Carousel Campaign',
      cover_image_url: null,
      invite_code: 'INIT01',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-init-1',
        campaign_id: 'camp-init-carousel',
        gm_id: 'gm-init-1',
        folder_id: null,
        name: 'Watchtower Courtyard',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#09100F',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        combat_active: false,
        round_number: 1,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-init-1');
    vttStore.tokens.set([
      {
        id: 'tok-hero',
        encounter_id: 'scene-init-1',
        character_id: null,
        owner_id: 'player-a',
        name: 'Sera Swift',
        faction: 'ally',
        x: 2,
        y: 2,
        q: 2,
        r: 2,
        size: 1,
        icon: 'bow',
        color: '#38B29A',
        current_hp: 10,
        max_hp: 10,
        current_sp: 4,
        max_sp: 4,
        current_ap: 2,
        max_ap: 4,
        armor_dr: 1,
        shield_block: 0,
        move_feet: 25,
        vision_feet: 30,
        darkvision_feet: 0,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#F59E0B',
        shield_raised: false,
        is_hidden: false,
        statuses: [],
        npc_stats: {
          attributes: {
            Brawn: 1,
            Agility: 4,
            Technique: 2,
            Iron: 1,
            Cunning: 2,
          },
        },
      },
      {
        id: 'tok-bandit',
        encounter_id: 'scene-init-1',
        character_id: null,
        owner_id: null,
        name: 'Ash Raider',
        faction: 'enemy',
        x: 4,
        y: 2,
        q: 4,
        r: 2,
        size: 1,
        icon: 'greatsword',
        color: '#EF4444',
        current_hp: 12,
        max_hp: 12,
        current_sp: 4,
        max_sp: 4,
        current_ap: 4,
        max_ap: 4,
        armor_dr: 1,
        shield_block: 0,
        move_feet: 20,
        vision_feet: 30,
        darkvision_feet: 0,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#F59E0B',
        shield_raised: false,
        is_hidden: false,
        statuses: [],
        npc_stats: {
          attributes: {
            Brawn: 2,
            Agility: 1,
            Technique: 1,
            Iron: 2,
            Cunning: 3,
          },
        },
      },
      {
        id: 'tok-bystander',
        encounter_id: 'scene-init-1',
        character_id: null,
        owner_id: 'player-b',
        name: 'Late Ranger',
        faction: 'ally',
        x: 6,
        y: 3,
        q: 6,
        r: 3,
        size: 1,
        icon: 'spear',
        color: '#38BDF8',
        current_hp: 10,
        max_hp: 10,
        current_sp: 4,
        max_sp: 4,
        current_ap: 4,
        max_ap: 4,
        armor_dr: 1,
        shield_block: 0,
        move_feet: 20,
        vision_feet: 30,
        darkvision_feet: 0,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#F59E0B',
        shield_raised: false,
        is_hidden: false,
        statuses: [],
        npc_stats: {
          attributes: {
            Brawn: 1,
            Agility: 2,
            Technique: 2,
            Iron: 1,
            Cunning: 4,
          },
        },
      },
    ]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    fixture.detectChanges();
    const rootEl = fixture.nativeElement as HTMLElement;

    const topHeaderEl = rootEl.querySelector('header') as HTMLElement | null;
    expect(topHeaderEl).toBeTruthy();
    expect(topHeaderEl!.textContent).not.toContain('Start Combat');
    expect(topHeaderEl!.textContent).not.toContain('Begin Combat');
    expect(topHeaderEl!.textContent).not.toContain('Combat Tracker');
    expect(
      rootEl.querySelector('button[data-tool-combat-tracker="true"]')
    ).toBeTruthy();
    expect(
      rootEl.querySelector('[data-vtt-combat-carousel="true"]')
    ).toBeNull();
    expect(
      rootEl.querySelector('[data-vtt-combat-tracker-window="true"]')
    ).toBeNull();

    vttStore.manualRollOverride.set(14);
    await vttStore.rollInitiativeForTokens(['tok-hero']);
    fixture.detectChanges();

    expect(vttStore.isCombatInitiationOpen()).toBe(false);
    expect(vttStore.enrolledCombatTokens()).toEqual([]);
    expect(
      vttStore.tokens().find((t) => t.id === 'tok-hero')?.npc_stats
        ?.__in_combat
    ).toBeUndefined();
    expect(
      rootEl.querySelector('[data-vtt-combat-tracker-window="true"]')
    ).toBeNull();
    expect(
      vttStore.logs().some((l) => l.title.includes('Sera Swift · Initiative'))
    ).toBe(true);

    const railTrackerBtn = rootEl.querySelector(
      'button[data-tool-combat-tracker="true"]'
    ) as HTMLButtonElement | null;
    railTrackerBtn!.click();
    fixture.detectChanges();
    expect(
      rootEl.querySelector('[data-tracker-locked-notice="true"]')
    ).toBeTruthy();
    expect(
      rootEl.querySelector('button[data-tracker-roll-mine="true"]')
    ).toBeNull();
    railTrackerBtn!.click();
    fixture.detectChanges();

    activeUserSig.set({ id: 'gm-init-1', email: 'gm@test.com' });
    railTrackerBtn!.click();
    fixture.detectChanges();

    const initiateBtn = rootEl.querySelector(
      'button[data-tracker-initiate-combat="true"]'
    ) as HTMLButtonElement | null;
    expect(initiateBtn).toBeTruthy();
    initiateBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(vttStore.isCombatInitiationOpen()).toBe(true);

    activeUserSig.set({ id: 'player-a', email: 'playera@test.com' });
    fixture.detectChanges();

    const rollMineBtn = rootEl.querySelector(
      'button[data-tracker-roll-mine="true"]'
    ) as HTMLButtonElement | null;
    expect(rollMineBtn).toBeTruthy();
    rollMineBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      rootEl.querySelector('[data-vtt-combat-carousel="true"]')
    ).toBeNull();

    const trackerBodyEl = rootEl.querySelector(
      '[data-vtt-combat-tracker-window="true"]'
    ) as HTMLElement | null;
    expect(trackerBodyEl).toBeTruthy();
    const trackerWinSection = trackerBodyEl!.closest(
      'section[data-vtt-floating-window="true"]'
    ) as HTMLElement | null;
    expect(trackerWinSection).toBeTruthy();
    expect(trackerWinSection!.className).toContain('316px');

    const trackerHeaderEl = trackerWinSection!.querySelector(
      '[data-vtt-floating-header="true"]'
    ) as HTMLElement | null;
    expect(trackerHeaderEl).toBeTruthy();
    trackerHeaderEl!.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        clientX: 160,
        clientY: 80,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 290,
        clientY: 130,
        bubbles: true,
      })
    );
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    fixture.detectChanges();
    expect(vttStore.combatTrackerPosition()).toBeTruthy();
    const draggedX = vttStore.combatTrackerPosition()!.x;
    const draggedY = vttStore.combatTrackerPosition()!.y;
    expect(draggedX).toBeGreaterThan(200);
    expect(
      JSON.parse(localStorage.getItem('mot.vtt.combat_tracker_window.v1')!)
    ).toEqual({
      x: draggedX,
      y: draggedY,
      minimized: false,
    });

    expect(
      vttStore.tokens().find((t) => t.id === 'tok-hero')?.npc_stats
        ?.__initiative_mod
    ).toBe(2);

    activeUserSig.set({ id: 'gm-init-1', email: 'gm@test.com' });
    fixture.detectChanges();

    vttStore.manualRollOverride.set(19);
    const rollNpcsBtn = rootEl.querySelector(
      'button[data-tracker-roll-npcs="true"]'
    ) as HTMLButtonElement | null;
    expect(rollNpcsBtn).toBeTruthy();
    rollNpcsBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      rootEl.querySelector('[data-vtt-combat-carousel="true"]')
    ).toBeNull();
    const phase1Rows = Array.from(
      rootEl.querySelectorAll('[data-tracker-row]')
    ).map((el) => el.getAttribute('data-tracker-row'));
    expect(phase1Rows).toEqual(['tok-bandit', 'tok-hero']);

    const beginBtn = rootEl.querySelector(
      'button[data-tracker-begin-combat="true"]'
    ) as HTMLButtonElement | null;
    expect(beginBtn).toBeTruthy();
    beginBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.activeScene()!.combat_active).toBe(true);
    expect(vttStore.activeScene()!.initiative_order).toEqual([
      'tok-bandit',
      'tok-hero',
    ]);
    expect(vttStore.activeScene()!.active_turn_token_id).toBe('tok-bandit');
    expect(
      vttStore.tokens().find((t) => t.id === 'tok-hero')?.current_ap
    ).toBe(4);
    expect(
      rootEl.querySelector('[data-vtt-combat-tracker-window="true"]')
    ).toBeNull();

    const carouselEl = rootEl.querySelector(
      '[data-vtt-combat-carousel="true"]'
    ) as HTMLElement | null;
    expect(carouselEl).toBeTruthy();
    const phase2Cards = Array.from(
      rootEl.querySelectorAll('[data-carousel-card]')
    ).map((el) => el.getAttribute('data-carousel-card'));
    expect(phase2Cards).toEqual(['tok-bandit', 'tok-hero']);

    activeUserSig.set({ id: 'player-b', email: 'playerb@test.com' });
    fixture.detectChanges();

    vttStore.manualRollOverride.set(16);
    const joinBtn = rootEl.querySelector(
      'button[data-carousel-join-combat="true"]'
    ) as HTMLButtonElement | null;
    expect(joinBtn).toBeTruthy();
    joinBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const joinedCards = Array.from(
      rootEl.querySelectorAll('[data-carousel-card]')
    ).map((el) => el.getAttribute('data-carousel-card'));
    expect(joinedCards).toEqual(['tok-bandit', 'tok-bystander', 'tok-hero']);
    expect(vttStore.activeScene()!.active_turn_token_id).toBe('tok-bandit');

    activeUserSig.set({ id: 'gm-init-1', email: 'gm@test.com' });
    fixture.detectChanges();

    const drawerToggle = rootEl.querySelector(
      'button[data-carousel-drawer-toggle="true"]'
    ) as HTMLButtonElement | null;
    expect(drawerToggle).toBeTruthy();
    drawerToggle!.click();
    fixture.detectChanges();

    const drawerEl = rootEl.querySelector(
      '[data-vtt-combat-drawer="true"]'
    ) as HTMLElement | null;
    expect(drawerEl).toBeTruthy();
    const reopenedWin = drawerEl!.closest(
      'section[data-vtt-floating-window="true"]'
    ) as HTMLElement | null;
    expect(reopenedWin).toBeTruthy();
    expect(reopenedWin!.style.left).toBe(`${draggedX}px`);
    expect(reopenedWin!.style.top).toBe(`${draggedY}px`);

    expect(drawerEl!.querySelector('[data-tracker-hide]')).toBeNull();

    const heroScoreInput = drawerEl!.querySelector(
      'input[data-tracker-init-input="tok-hero"]'
    ) as HTMLInputElement | null;
    expect(heroScoreInput).toBeTruthy();
    expect(heroScoreInput!.type).toBe('text');
    heroScoreInput!.value = '25';
    heroScoreInput!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const stepUpBtn = drawerEl!.querySelector(
      'button[data-tracker-init-step-up="tok-hero"]'
    ) as HTMLButtonElement | null;
    expect(stepUpBtn).toBeTruthy();
    stepUpBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      vttStore.tokens().find((t) => t.id === 'tok-hero')?.npc_stats
        ?.__initiative
    ).toBe(26);

    expect(vttStore.activeScene()!.initiative_order).toEqual([
      'tok-hero',
      'tok-bandit',
      'tok-bystander',
    ]);

    const removeBystanderBtn = drawerEl!.querySelector(
      'button[data-tracker-remove="tok-bystander"]'
    ) as HTMLButtonElement | null;
    expect(removeBystanderBtn).toBeTruthy();
    removeBystanderBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.activeScene()!.initiative_order).toEqual([
      'tok-hero',
      'tok-bandit',
    ]);
    expect(
      drawerEl!.querySelector('[data-tracker-unrolled-row="tok-bystander"]')
    ).toBeTruthy();

    const endBtn = rootEl.querySelector(
      'button[data-carousel-end-combat="true"]'
    ) as HTMLButtonElement | null;
    expect(endBtn).toBeTruthy();
    endBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.activeScene()!.combat_active).toBe(false);
    expect(vttStore.activeScene()!.initiative_order).toEqual([]);
    expect(
      rootEl.querySelector('[data-vtt-combat-carousel="true"]')
    ).toBeNull();
    expect(
      rootEl.querySelector('[data-vtt-combat-tracker-window="true"]')
    ).toBeNull();
  });

  it('should open Edit Node modal on double-click and show node context menu on right-click in Content Manager skill trees', async () => {
    const vanguardTree = {
      id: 'tree-vanguard',
      slug: 'vanguard',
      name: 'Vanguard',
      description: 'Frontline martial path.',
      icon: 'greatsword',
      icon_color: '#FF8C5A',
      icon_tint_custom: true,
      is_active: true,
    };

    const cleaveNode: PerkNodeModel = {
      id: 'node-cleave',
      tree_id: 'tree-vanguard',
      slug: 'cleave',
      parent_node_id: null,
      tier: 1,
      name: 'Cleave',
      node_type: 'combat_art',
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 2,
      combat_tag: 'Sweeping',
      description: 'Wide horizontal slash.',
      rule_hooks: { __canvas_x: 200, __canvas_y: 120 },
      is_active: true,
    };

    const sunderNode: PerkNodeModel = {
      id: 'node-sunder',
      tree_id: 'tree-vanguard',
      slug: 'sunder',
      parent_node_id: 'node-cleave',
      tier: 2,
      name: 'Sunder',
      node_type: 'combat_art',
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: 'Crushing',
      description: 'Heavy armor-cracking strike.',
      rule_hooks: {
        __parent_ids: ['node-cleave'],
        __canvas_x: 200,
        __canvas_y: 300,
      },
      is_active: true,
    };

    const soloDashNode: PerkNodeModel = {
      id: 'node-solo-dash',
      tree_id: null,
      slug: 'quickstep',
      parent_node_id: null,
      tier: 1,
      name: 'Quickstep',
      node_type: 'combat_art',
      perk_cost: 1,
      ap_cost: 1,
      cooldown_rounds: 2,
      combat_tag: 'None',
      description: 'Rapid footwork.',
      rule_hooks: { __is_standalone: true },
      is_active: true,
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        {
          provide: CompendiumService,
          useValue: {
            fetchFullCompendium: async () => ({
              weapons: [],
              armors: [],
              items: [],
              skillTrees: [vanguardTree],
              perkNodes: [cleaveNode, sunderNode, soloDashNode],
              keywords: [],
            }),
          },
        },
        provideRouter([
          {
            path: 'content-manager',
            component: ContentManagerComponent,
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'trees' },
              { path: 'trees', component: ContentManagerRouteSlotComponent },
              {
                path: 'trees/:treeId',
                component: ContentManagerRouteSlotComponent,
              },
              {
                path: 'standalone',
                component: ContentManagerRouteSlotComponent,
              },
              { path: 'weapons', component: ContentManagerRouteSlotComponent },
              { path: 'keywords', component: ContentManagerRouteSlotComponent },
            ],
          },
        ]),
      ],
    }).compileComponents();

    const store = TestBed.inject(CompendiumStore);
    await store.loadCompendium();

    const harness = await RouterTestingHarness.create(
      '/content-manager/trees/vanguard'
    );
    await harness.fixture.whenStable();
    harness.detectChanges();

    const cmEl = harness.routeNativeElement as HTMLElement;
    const cmComp = harness.routeDebugElement
      ?.componentInstance as ContentManagerComponent;

    const cleaveEl = cmEl.querySelector(
      '[data-skill-tree-node="node-cleave"]'
    ) as HTMLElement | null;
    const sunderEl = cmEl.querySelector(
      '[data-skill-tree-node="node-sunder"]'
    ) as HTMLElement | null;
    expect(cleaveEl).toBeTruthy();
    expect(sunderEl).toBeTruthy();

    cleaveEl!.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true })
    );
    await harness.fixture.whenStable();
    harness.detectChanges();

    const editHeading = Array.from(cmEl.querySelectorAll('h2')).find((h) =>
      h.textContent?.includes('Edit Skill Tree Node')
    );
    expect(editHeading).toBeTruthy();
    const nodeNameInput = cmEl.querySelector(
      'input#nodeName'
    ) as HTMLInputElement | null;
    expect(nodeNameInput).toBeTruthy();
    expect(nodeNameInput!.value).toBe('Cleave');

    const closeModalBtn = Array.from(cmEl.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Close'
    ) as HTMLButtonElement | undefined;
    expect(closeModalBtn).toBeTruthy();
    closeModalBtn!.click();
    harness.detectChanges();

    const ctxEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 280,
      clientY: 240,
    });
    sunderEl!.dispatchEvent(ctxEvent);
    harness.detectChanges();

    expect(ctxEvent.defaultPrevented).toBe(true);
    const ctxMenu = cmEl.querySelector(
      '[data-skill-node-context-menu="true"]'
    ) as HTMLElement | null;
    expect(ctxMenu).toBeTruthy();
    expect(ctxMenu!.textContent).toContain('Sunder');
    expect(
      ctxMenu!.querySelector('button[data-node-ctx-action="edit"]')
    ).toBeTruthy();
    expect(
      ctxMenu!.querySelector('button[data-node-ctx-action="branch"]')
    ).toBeTruthy();
    expect(
      ctxMenu!.querySelector('button[data-node-ctx-action="attach"]')
    ).toBeTruthy();
    expect(
      ctxMenu!.querySelector('button[data-node-ctx-action="make-starting"]')
    ).toBeTruthy();
    expect(
      ctxMenu!.querySelector('button[data-node-ctx-action="remove-from-tree"]')
    ).toBeTruthy();
    expect(
      ctxMenu!.querySelector('button[data-node-ctx-action="delete"]')
    ).toBeTruthy();

    const branchBtn = ctxMenu!.querySelector(
      'button[data-node-ctx-action="branch"]'
    ) as HTMLButtonElement;
    branchBtn.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(
      cmEl.querySelector('[data-skill-node-context-menu="true"]')
    ).toBeNull();
    const createHeading = Array.from(cmEl.querySelectorAll('h2')).find((h) =>
      h.textContent?.includes('Create Skill Tree Node')
    );
    expect(createHeading).toBeTruthy();

    const closeCreateBtn = Array.from(cmEl.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Close'
    ) as HTMLButtonElement | undefined;
    closeCreateBtn!.click();
    harness.detectChanges();

    cleaveEl!.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 220,
        clientY: 180,
      })
    );
    harness.detectChanges();
    const cleaveMenu = cmEl.querySelector(
      '[data-skill-node-context-menu="true"]'
    ) as HTMLElement | null;
    expect(cleaveMenu).toBeTruthy();
    expect(
      cleaveMenu!.querySelector('button[data-node-ctx-action="make-starting"]')
    ).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(
      cmEl.querySelector('[data-skill-node-context-menu="true"]')
    ).toBeNull();

    cleaveEl!.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 220,
        clientY: 180,
      })
    );
    harness.detectChanges();
    expect(
      cmEl.querySelector('[data-skill-node-context-menu="true"]')
    ).toBeTruthy();

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true })
    );
    harness.detectChanges();
    expect(
      cmEl.querySelector('[data-skill-node-context-menu="true"]')
    ).toBeNull();

    cleaveEl!.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 220,
        clientY: 180,
      })
    );
    harness.detectChanges();
    const deleteMenuBtn = cmEl.querySelector(
      'button[data-node-ctx-action="delete"]'
    ) as HTMLButtonElement | null;
    expect(deleteMenuBtn).toBeTruthy();
    deleteMenuBtn!.click();
    harness.detectChanges();
    expect(
      cmEl.querySelector('[data-skill-node-context-menu="true"]')
    ).toBeNull();
    expect(cmComp.pendingDelete()?.target.id).toBe('node-cleave');

    const charFixture = TestBed.createComponent(SkillTreeCanvasComponent);
    charFixture.componentRef.setInput('tree', vanguardTree);
    charFixture.componentRef.setInput('allNodes', [cleaveNode, sunderNode]);
    charFixture.componentRef.setInput('mode', 'character');
    let emittedEditCount = 0;
    charFixture.componentInstance.editNode.subscribe(() => {
      emittedEditCount += 1;
    });
    charFixture.detectChanges();

    const charNodeEl = charFixture.nativeElement.querySelector(
      '[data-skill-tree-node="node-cleave"]'
    ) as HTMLElement | null;
    expect(charNodeEl).toBeTruthy();
    const charCtxEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    });
    charNodeEl!.dispatchEvent(charCtxEvent);
    charNodeEl!.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true })
    );
    charFixture.detectChanges();
    expect(charCtxEvent.defaultPrevented).toBe(false);
    expect(emittedEditCount).toBe(0);
    expect(
      charFixture.nativeElement.querySelector(
        '[data-skill-node-context-menu="true"]'
      )
    ).toBeNull();
  });

  it('should render token image on drag landing silhouettes and allow editing Token Display Name for battlemap and log speech', async () => {
    const activeUserSig = signal<{ id: string; email: string }>({
      id: 'gm-tok-1',
      email: 'gm@test.com',
    });
    let logSeq = 1;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [VttRoomComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            user: activeUserSig,
            isAdmin: () => true,
            displayName: () => 'Game Master',
            handle: () => 'gm',
          },
        },
        {
          provide: CompendiumStore,
          useValue: {
            allWeapons: signal([]),
            weapons: signal([]),
            allArmors: signal(DEFAULT_COMPENDIUM_ARMORS),
            armors: signal(DEFAULT_COMPENDIUM_ARMORS),
            allItems: signal(DEFAULT_COMPENDIUM_ITEMS),
            items: signal(DEFAULT_COMPENDIUM_ITEMS),
            allPerkNodes: signal([]),
            perkNodes: signal([]),
            standaloneNodes: signal([]),
            allStandaloneNodes: signal([]),
            allSkillTrees: signal([]),
            skillTrees: signal([]),
            isLoading: signal(false),
            ensureLoaded: async () => undefined,
          },
        },
        {
          provide: CharacterStore,
          useValue: {
            characters: signal([]),
            ensureUserCharactersLoaded: async () => undefined,
            getCharacterById: () => undefined,
            upsertRealtimeCharacter: () => undefined,
          },
        },
        {
          provide: CollectionsStore,
          useValue: {
            folders: signal([]),
            actors: signal([]),
            isLoading: signal(false),
            loadCollections: async () => undefined,
          },
        },
        {
          provide: VttService,
          useValue: {
            updateToken: async () => null,
            updateRosterActor: async () => null,
            updateScene: async () => ({ error: null, needsMigration: false }),
            insertLog: async (entry: Record<string, unknown>) => ({
              ...entry,
              id: `log-tok-${logSeq++}`,
              created_at: new Date().toISOString(),
            }),
            unsubscribeChannel: () => undefined,
          },
        },
      ],
    }).compileComponents();

    const vttStore = TestBed.inject(VttStore);
    const settingsStore = TestBed.inject(VttSettingsStore);
    settingsStore.updatePreferences({ tokenMoveSpeed: 300 });

    vttStore.isLoading.set(false);
    vttStore.error.set(null);
    vttStore.campaign.set({
      id: 'camp-tok-ui',
      gm_id: 'gm-tok-1',
      name: 'Token UI Campaign',
      cover_image_url: null,
      invite_code: 'TOK001',
      last_played_at: null,
      created_at: new Date().toISOString(),
    });
    vttStore.scenes.set([
      {
        id: 'scene-tok-1',
        campaign_id: 'camp-tok-ui',
        gm_id: 'gm-tok-1',
        folder_id: null,
        name: 'Grand Ballroom',
        is_active_scene: true,
        map_image_url: null,
        grid_mode: 'square',
        background_color: '#09100F',
        scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
        scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
        padding: DEFAULT_VTT_SCENE_PADDING,
        grid_width: DEFAULT_VTT_GRID_WIDTH,
        grid_height: DEFAULT_VTT_GRID_HEIGHT,
        grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
        grid_offset_x: 0,
        grid_offset_y: 0,
        grid_opacity: DEFAULT_VTT_GRID_OPACITY,
        sort_order: 0,
        combat_active: false,
        round_number: 1,
        active_turn_token_id: null,
        initiative_order: [],
        token_vision: false,
        fog_enabled: false,
        global_illumination: true,
        darkness_level: 0,
        walls: [],
        lights: [],
        explored_fog: { cells: [], revealed_all: false },
        pending_clash: null,
      },
    ]);
    vttStore.activeSceneId.set('scene-tok-1');

    const vaneActor: VttRosterActorModel = {
      id: 'actor-vane',
      campaign_id: 'camp-tok-ui',
      folder_id: null,
      character_id: null,
      collection_actor_id: null,
      owner_id: null,
      actor_kind: 'npc',
      is_unique: true,
      name: 'Lord Vane',
      faction: 'enemy',
      size: 1,
      icon: 'greatsword',
      color: '#F43F5E',
      max_hp: 24,
      max_sp: 8,
      max_ap: 4,
      armor_dr: 2,
      shield_block: 0,
      move_feet: 25,
      vision_feet: 30,
      darkvision_feet: 10,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      portrait_url: 'https://cdn.example.com/vane-portrait.png',
      token_image_url: 'https://cdn.example.com/vane-token.png',
      token_appearance: {
        shape: 'circle',
        frame: 'ornate',
        frame_color: '#F43F5E',
        custom_frame_url: null,
        scale: 1.25,
        offset_x: 0,
        offset_y: 0,
      },
      npc_stats: {
        attributes: {
          Brawn: 2,
          Agility: 3,
          Technique: 4,
          Iron: 2,
          Cunning: 4,
        },
      },
      notes: '',
      sort_order: 0,
    };
    vttStore.rosterActors.set([vaneActor]);
    vttStore.tokens.set([
      {
        id: 'tok-vane',
        encounter_id: 'scene-tok-1',
        character_id: null,
        owner_id: null,
        name: 'Lord Vane',
        faction: 'enemy',
        x: 2,
        y: 2,
        q: 2,
        r: 2,
        size: 1,
        icon: 'greatsword',
        color: '#F43F5E',
        current_hp: 24,
        max_hp: 24,
        current_sp: 8,
        max_sp: 8,
        current_ap: 4,
        max_ap: 4,
        armor_dr: 2,
        shield_block: 0,
        move_feet: 25,
        vision_feet: 30,
        darkvision_feet: 10,
        light_bright_feet: 0,
        light_dim_feet: 0,
        light_color: '#FF9B42',
        shield_raised: false,
        is_hidden: false,
        statuses: [],
        portrait_url: 'https://cdn.example.com/vane-portrait.png',
        token_image_url: 'https://cdn.example.com/vane-token.png',
        token_appearance: {
          shape: 'circle',
          frame: 'ornate',
          frame_color: '#F43F5E',
          custom_frame_url: null,
          scale: 1.25,
          offset_x: 0,
          offset_y: 0,
        },
        npc_stats: {
          __roster_actor_id: 'actor-vane',
        },
      },
    ]);

    const fixture = TestBed.createComponent(VttRoomComponent);
    fixture.detectChanges();
    const rootEl = fixture.nativeElement as HTMLElement;

    const canvasDebug = fixture.debugElement.children
      .flatMap((d) => [d, ...d.children])
      .find((d) => d.componentInstance instanceof VttCanvasComponent);
    const canvasEl = rootEl.querySelector('app-vtt-canvas') as HTMLElement;
    expect(canvasEl).toBeTruthy();

    const tokEl = rootEl.querySelector(
      '[data-token-id="tok-vane"]'
    ) as HTMLElement | null;
    expect(tokEl).toBeTruthy();
    expect(rootEl.querySelector('[data-token-drag-ghost="tok-vane"]')).toBeNull();

    tokEl!.dispatchEvent(
      new PointerEvent('pointerdown', {
        button: 0,
        buttons: 1,
        clientX: 618,
        clientY: 618,
        bubbles: true,
      })
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        button: 0,
        buttons: 1,
        clientX: 820,
        clientY: 618,
        bubbles: true,
      })
    );
    fixture.detectChanges();

    const dragGhostEl = rootEl.querySelector(
      '[data-token-drag-ghost="tok-vane"]'
    ) as HTMLElement | null;
    expect(dragGhostEl).toBeTruthy();
    const ghostImgEl = dragGhostEl!.querySelector(
      'img[data-token-image="true"]'
    ) as HTMLImageElement | null;
    expect(ghostImgEl).toBeTruthy();
    expect(ghostImgEl!.getAttribute('src')).toBe(
      'https://cdn.example.com/vane-token.png'
    );
    expect(
      dragGhostEl!.querySelector('[data-token-frame="ornate"]')
    ).toBeTruthy();

    window.dispatchEvent(
      new PointerEvent('pointerup', {
        button: 0,
        buttons: 0,
        clientX: 820,
        clientY: 618,
        bubbles: true,
      })
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rootEl.querySelector('[data-token-drag-ghost="tok-vane"]')).toBeNull();
    void canvasDebug;

    vttStore.openTokenizerForToken('tok-vane');
    fixture.detectChanges();

    const displayNameInput = rootEl.querySelector(
      'input[data-tokenizer-display-name="true"]'
    ) as HTMLInputElement | null;
    expect(displayNameInput).toBeTruthy();
    expect(displayNameInput!.value).toBe('Lord Vane');

    displayNameInput!.value = 'Hooded Stranger';
    displayNameInput!.dispatchEvent(new Event('input'));
    displayNameInput!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.tokens().find((t) => t.id === 'tok-vane')?.name).toBe(
      'Hooded Stranger'
    );
    expect(
      vttStore.rosterActors().find((a) => a.id === 'actor-vane')?.name
    ).toBe('Lord Vane');
    expect(
      rootEl.querySelector('button[data-tokenizer-reset-name="true"]')
    ).toBeTruthy();
    expect(
      rootEl.querySelector('[data-token-id="tok-vane"]')?.textContent
    ).toContain('Hooded Stranger');

    await vttStore.updateRosterActor('actor-vane', { max_hp: 28 });
    fixture.detectChanges();
    expect(vttStore.tokens().find((t) => t.id === 'tok-vane')?.name).toBe(
      'Hooded Stranger'
    );

    vttStore.selectedTokenId.set('tok-vane');
    vttStore.setGmSpeakerMode('character');
    fixture.detectChanges();
    expect(vttStore.effectivePublicSpeaker().name).toBe('Hooded Stranger');

    await vttStore.executeChatOrCommand('Step out into the torchlight.');
    await fixture.whenStable();
    fixture.detectChanges();
    const tokenSpokenLog = vttStore
      .logs()
      .find((l) => l.title === 'Step out into the torchlight.');
    expect(tokenSpokenLog).toBeTruthy();
    expect(tokenSpokenLog!.sender_name).toBe('Hooded Stranger');

    vttStore.selectRosterActorForSpeech('actor-vane');
    fixture.detectChanges();
    expect(vttStore.effectivePublicSpeaker().name).toBe('Hooded Stranger');

    await vttStore.executeChatOrCommand('You do not know who I am.');
    await fixture.whenStable();
    fixture.detectChanges();
    const actorSpokenLog = vttStore
      .logs()
      .find((l) => l.title === 'You do not know who I am.');
    expect(actorSpokenLog).toBeTruthy();
    expect(actorSpokenLog!.sender_name).toBe('Hooded Stranger');

    const resetNameBtn = rootEl.querySelector(
      'button[data-tokenizer-reset-name="true"]'
    ) as HTMLButtonElement | null;
    expect(resetNameBtn).toBeTruthy();
    resetNameBtn!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(vttStore.tokens().find((t) => t.id === 'tok-vane')?.name).toBe(
      'Lord Vane'
    );
    expect(vttStore.effectivePublicSpeaker().name).toBe('Lord Vane');
  });
});
