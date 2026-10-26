export type AttributeName = 'Brawn' | 'Agility' | 'Technique' | 'Iron' | 'Cunning';
export type CombatSkillName = 'Strike' | 'Shoot' | 'Parry' | 'Dodge';
export type CombatTag = 'Crushing' | 'Sweeping' | 'Piercing' | 'None';
export type CombatStatusEffect = 'None' | 'Sundered' | 'Staggered' | 'Bleeding' | 'Pinned';

export interface PerkRuleHooks {
  // Automatic Character Sheet Stat Bonuses
  bonus_max_hp?: number;
  bonus_max_sp?: number;
  bonus_armor_dr?: number;
  bonus_move_tiles?: number;
  bonus_attack_mod?: number;
  bonus_flat_damage?: number;
  bonus_parry_mod?: number;
  bonus_dodge_mod?: number;
  bonus_block_mod?: number;

  // Active Combat Art Execution Hooks
  disallow_defense?: ('Parry' | 'Dodge' | 'Block')[];
  bonus_sp_damage?: number;
  ignore_armor_dr?: number;
  push_tiles?: number;
  self_shift_tiles?: number;
  inflict_status?: CombatStatusEffect;
}

export type EditableRuleHookKey = Exclude<keyof PerkRuleHooks, 'disallow_defense'>;

export interface RuleHookDefinition {
  key: EditableRuleHookKey;
  label: string;
  category: 'Sheet Stat Bonus' | 'Combat Art Effect';
  valueType: 'number' | 'status';
  defaultValue: number | CombatStatusEffect;
}

export interface RuleHookRow {
  key: EditableRuleHookKey;
  numValue: number;
  statusValue: CombatStatusEffect;
}

/**
 * Industry-standard Composable Rule Hook Registry (Foundry VTT / D&D Beyond style).
 * Adding a new mechanical hook to March of Time only requires adding an entry here.
 */
export const RULE_HOOK_DEFINITIONS: RuleHookDefinition[] = [
  // Combat Art On-Hit / Execution Effects
  {
    key: 'bonus_sp_damage',
    label: 'Bonus SP Damage on Hit',
    category: 'Combat Art Effect',
    valueType: 'number',
    defaultValue: 2,
  },
  {
    key: 'ignore_armor_dr',
    label: 'Pierce Target Armor DR',
    category: 'Combat Art Effect',
    valueType: 'number',
    defaultValue: 2,
  },
  {
    key: 'push_tiles',
    label: 'Push Target (Tiles)',
    category: 'Combat Art Effect',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'self_shift_tiles',
    label: 'Shift Self Before/After Strike (Tiles)',
    category: 'Combat Art Effect',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'inflict_status',
    label: 'Inflict Combat Status',
    category: 'Combat Art Effect',
    valueType: 'status',
    defaultValue: 'Sundered',
  },

  // Automatic Sheet Stat Modifiers
  {
    key: 'bonus_max_sp',
    label: 'Bonus Max SP (Stamina & Poise)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 2,
  },
  {
    key: 'bonus_max_hp',
    label: 'Bonus Max HP (Health)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 2,
  },
  {
    key: 'bonus_armor_dr',
    label: 'Bonus Armor DR',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'bonus_move_tiles',
    label: 'Bonus Movement (Tiles per 1 AP)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'bonus_attack_mod',
    label: 'Bonus Attack Roll Modifier',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'bonus_flat_damage',
    label: 'Bonus Flat Weapon Damage',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'bonus_parry_mod',
    label: 'Bonus Parry Reaction Roll',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'bonus_dodge_mod',
    label: 'Bonus Dodge Reaction Roll',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
  {
    key: 'bonus_block_mod',
    label: 'Bonus Shield Block Roll & Reduction',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
];

export interface WeaponModel {
  id: string;
  slug: string;
  name: string;
  category: string;
  ap_cost: number;
  requires_aim: boolean;
  gov_attribute: AttributeName;
  gov_skill: CombatSkillName;
  base_damage: number;
  reach_tiles: number;
  thrown_range_tiles: number | null;
  trait_name: string;
  trait_description: string;
  rule_hooks: Record<string, unknown>;
}

export interface SkillTreeModel {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface PerkNodeModel {
  id: string;
  tree_id: string;
  slug: string;
  name: string;
  node_type: 'combat_art' | 'passive_upgrade';
  tier: number;
  perk_cost: number;
  ap_cost: number | null;
  cooldown_rounds: number | null;
  combat_tag: CombatTag | null;
  description: string;
  rule_hooks: PerkRuleHooks;
  parent_node_id?: string | null;
}

export interface SkillTreeBranchNode {
  node: PerkNodeModel;
  children: SkillTreeBranchNode[];
}

/**
 * Builds a hierarchical forest of root nodes and their recursive child branches
 * for rendering a connected visual Skill Tree.
 */
export function buildSkillTreeHierarchy(
  treeId: string,
  allNodes: PerkNodeModel[]
): SkillTreeBranchNode[] {
  const treeNodes = allNodes
    .filter((n) => n.tree_id === treeId)
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const nodeIds = new Set(treeNodes.map((n) => n.id));
  const childrenMap = new Map<string, PerkNodeModel[]>();

  const roots: PerkNodeModel[] = [];

  for (const n of treeNodes) {
    if (n.parent_node_id && nodeIds.has(n.parent_node_id)) {
      const list = childrenMap.get(n.parent_node_id) ?? [];
      list.push(n);
      childrenMap.set(n.parent_node_id, list);
    } else {
      roots.push(n);
    }
  }

  const buildBranch = (current: PerkNodeModel, visited = new Set<string>()): SkillTreeBranchNode => {
    visited.add(current.id);
    const directChildren = (childrenMap.get(current.id) ?? []).filter(
      (c) => !visited.has(c.id)
    );
    return {
      node: current,
      children: directChildren.map((child) => buildBranch(child, new Set(visited))),
    };
  };

  return roots.map((r) => buildBranch(r));
}

/**
 * Determines an emblem archetype ('breaker' | 'veil' | 'gale' | 'sentinel') from a tree's slug or name.
 */
export function getTreeArchetypeIcon(
  tree: Pick<SkillTreeModel, 'slug' | 'name'>
): 'breaker' | 'veil' | 'gale' | 'sentinel' {
  const key = `${tree.slug} ${tree.name}`.toLowerCase();
  if (key.includes('juggernaut') || key.includes('breaker') || key.includes('brawn')) {
    return 'breaker';
  }
  if (key.includes('phantom') || key.includes('veil') || key.includes('shadow')) {
    return 'veil';
  }
  if (key.includes('tempest') || key.includes('gale') || key.includes('wind')) {
    return 'gale';
  }
  return 'sentinel';
}

/**
 * Converts a stored JSONB `PerkRuleHooks` object into composable UI rows for the Admin editor.
 */
export function hooksObjectToRows(hooks: PerkRuleHooks | undefined | null): RuleHookRow[] {
  if (!hooks) return [];
  const rows: RuleHookRow[] = [];

  for (const def of RULE_HOOK_DEFINITIONS) {
    const rawVal = hooks[def.key];
    if (rawVal === undefined || rawVal === null) continue;

    if (def.valueType === 'status') {
      if (rawVal !== 'None') {
        rows.push({
          key: def.key,
          numValue: 1,
          statusValue: rawVal as CombatStatusEffect,
        });
      }
    } else {
      const num = Number(rawVal);
      if (num !== 0) {
        rows.push({
          key: def.key,
          numValue: num,
          statusValue: 'Sundered',
        });
      }
    }
  }

  return rows;
}

/**
 * Compiles composable UI rows + Combat Tag into a clean `PerkRuleHooks` JSONB payload.
 */
export function rowsToHooksObject(
  rows: RuleHookRow[],
  nodeType: 'combat_art' | 'passive_upgrade',
  combatTag: CombatTag
): PerkRuleHooks {
  const result: PerkRuleHooks = {};

  if (nodeType === 'combat_art') {
    if (combatTag === 'Crushing') {
      result.disallow_defense = ['Parry'];
    } else if (combatTag === 'Piercing') {
      result.disallow_defense = ['Block'];
    } else if (combatTag === 'Sweeping') {
      result.disallow_defense = ['Dodge'];
    }
  }

  for (const row of rows) {
    const def = RULE_HOOK_DEFINITIONS.find((d) => d.key === row.key);
    if (!def) continue;

    if (def.valueType === 'status') {
      if (row.statusValue && row.statusValue !== 'None') {
        result.inflict_status = row.statusValue;
      }
    } else {
      const num = Number(row.numValue);
      if (!Number.isNaN(num) && num !== 0) {
        (result as Record<string, number>)[def.key] = num;
      }
    }
  }

  return result;
}

/**
 * Formats human-readable mechanical badges from a PerkNode's structured `rule_hooks`.
 */
export function formatRuleHookBadges(hooks: PerkRuleHooks | undefined | null): string[] {
  if (!hooks) return [];
  const badges: string[] = [];

  if (hooks.disallow_defense?.length) {
    badges.push(`No ${hooks.disallow_defense.join('/')}`);
  }
  if (hooks.bonus_sp_damage) {
    badges.push(`+${hooks.bonus_sp_damage} SP DMG`);
  }
  if (hooks.ignore_armor_dr) {
    badges.push(`Pierces ${hooks.ignore_armor_dr} Armor DR`);
  }
  if (hooks.push_tiles) {
    badges.push(`Push ${hooks.push_tiles} ${hooks.push_tiles === 1 ? 'Tile' : 'Tiles'}`);
  }
  if (hooks.self_shift_tiles) {
    badges.push(`Shift ${hooks.self_shift_tiles} ${hooks.self_shift_tiles === 1 ? 'Tile' : 'Tiles'}`);
  }
  if (hooks.inflict_status && hooks.inflict_status !== 'None') {
    badges.push(`Inflicts ${hooks.inflict_status}`);
  }

  // Passive sheet modifiers
  if (hooks.bonus_max_sp) {
    badges.push(`+${hooks.bonus_max_sp} Max SP`);
  }
  if (hooks.bonus_max_hp) {
    badges.push(`+${hooks.bonus_max_hp} Max HP`);
  }
  if (hooks.bonus_armor_dr) {
    badges.push(`+${hooks.bonus_armor_dr} Armor DR`);
  }
  if (hooks.bonus_move_tiles) {
    badges.push(`+${hooks.bonus_move_tiles} Move Tile`);
  }
  if (hooks.bonus_attack_mod) {
    badges.push(`+${hooks.bonus_attack_mod} Attack Roll`);
  }
  if (hooks.bonus_flat_damage) {
    badges.push(`+${hooks.bonus_flat_damage} Flat DMG`);
  }
  if (hooks.bonus_parry_mod) {
    badges.push(`+${hooks.bonus_parry_mod} Parry Roll`);
  }
  if (hooks.bonus_dodge_mod) {
    badges.push(`+${hooks.bonus_dodge_mod} Dodge Roll`);
  }
  if (hooks.bonus_block_mod) {
    badges.push(`+${hooks.bonus_block_mod} Block`);
  }

  return badges;
}
