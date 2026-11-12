import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import {
  DEFAULT_STANDALONE_PERK_NODES,
  PerkNodeModel,
  WeaponModel,
  buildSkillTreeHierarchy,
  computePerkNodeTier,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  getDescendantNodeIds,
  normalizePerkNodesTiers,
} from './core/compendium/compendium.model';
import { computeDerivedStats } from './features/characters/models/character.model';

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

    const shieldBash = DEFAULT_STANDALONE_PERK_NODES.find(
      (node) => node.slug === 'shield-bash'
    );
    expect(shieldBash?.combat_tag).toBe('Crushing');
    expect(shieldBash?.rule_hooks.disallow_defense).toEqual(['Parry']);
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
      id: 'node-helm-splitter',
      tree_id: 'tree-breaker',
      slug: 'helm-splitter',
      name: 'Helm Splitter',
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: 'Crushing',
      description: 'Overhead Crushing blow.',
      rule_hooks: { disallow_defense: ['Parry'] },
    };

    const standalonePassive = DEFAULT_STANDALONE_PERK_NODES.find(
      (n) => n.slug === 'veterans-resolve'
    )!;

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
      [treeNode, ...DEFAULT_STANDALONE_PERK_NODES]
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
});
