import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import {
  PerkNodeModel,
  WeaponModel,
  artUpgradeToHookRows,
  buildSkillTreeHierarchy,
  canConnectPerkRoute,
  compileArtUpgradeSpec,
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
  resolveSkillGraphLayout,
  rowsToHooksObject,
  suggestNewNodeCanvasPosition,
} from './core/compendium/compendium.model';
import { CompendiumService } from './core/compendium/compendium.service';
import { CompendiumStore } from './core/compendium/compendium.store';
import { NotificationStore } from './core/notifications/notification.store';
import {
  DEFAULT_VTT_HOTKEYS,
  DEFAULT_VTT_PREFERENCES,
  VttSettingsStore,
  formatHotkeyBadge,
  matchesHotkey,
  normalizeKeyComboFromEvent,
} from './core/settings/vtt-settings.store';
import { ThemeStore } from './core/theme/theme.store';
import { AuthStore } from './core/auth/auth.store';
import {
  CharacterModel,
  computeDerivedStats,
  getUpgradeSlotKey,
} from './features/characters/models/character.model';
import { CharacterService } from './features/characters/services/character.service';
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
import {
  getLegalDefenderReactions,
  resolveClashReaction,
  roll2d10Check,
} from './features/vtt/engine/clash.engine';
import {
  buildDirectoryTree,
  canNestFolderInside,
  collectDescendantFolderIds,
} from './features/vtt/engine/directory-tree.engine';
import {
  HexGridGeometry,
  clampWorldPointToBounds,
  computeSceneCanvasLayout,
  feetToWorldPixels,
  findHexPath,
  getHexDistanceFeet,
  getHexStepPixels,
  getHexWorldBounds,
  getTokenDistanceFeet,
  getTokenWorldCenter,
  hexToWorldCenter,
  isWorldSegmentBlockedByWalls,
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
  DEFAULT_VTT_GRID_HEIGHT,
  DEFAULT_VTT_GRID_OPACITY,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_GRID_WIDTH,
  DEFAULT_VTT_SCENE_HEIGHT_PX,
  DEFAULT_VTT_SCENE_PADDING,
  DEFAULT_VTT_SCENE_WIDTH_PX,
  VttFolderModel,
  VttPendingClash,
  VttRosterActorModel,
  VttSceneModel,
  VttTokenModel,
  VttWallSegment,
} from './features/vtt/models/vtt.model';
import { VttService } from './features/vtt/services/vtt.service';
import { VttStore } from './features/vtt/store/vtt.store';
import { VttRoomComponent } from './features/vtt/vtt-room.component';
import {
  KeywordTooltipService,
  computeKeywordTooltipPosition,
} from './shared/keyword-text/keyword-tooltip.service';

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
    expect(settings.badges().tool_select).toBe('V');
    expect(settings.badges().tool_ruler).toBe('R');
    expect(settings.badges().undo).toBe('Ctrl+Z');

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
});
