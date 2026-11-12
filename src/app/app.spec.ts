import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import {
  PerkNodeModel,
  WeaponModel,
  buildSkillTreeHierarchy,
  computePerkNodeTier,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  getDescendantNodeIds,
  normalizePerkNodesTiers,
  rowsToHooksObject,
} from './core/compendium/compendium.model';
import { CompendiumService } from './core/compendium/compendium.service';
import { CompendiumStore } from './core/compendium/compendium.store';
import { computeDerivedStats } from './features/characters/models/character.model';
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
});
