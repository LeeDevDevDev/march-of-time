import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  computeDerivedStats,
  getUpgradeSlotKey,
} from './features/characters/models/character.model';
import { CharacterService } from './features/characters/services/character.service';
import {
  ContentManagerComponent,
  ContentManagerRouteSlotComponent,
  parseContentManagerUrl,
} from './features/content-manager/content-manager.component';
import { CampaignService } from './features/dashboard/services/campaign.service';
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
});
