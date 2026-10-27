export type AttributeName = 'Brawn' | 'Agility' | 'Technique' | 'Iron' | 'Cunning';
export type CombatSkillName = 'Strike' | 'Shoot' | 'Parry' | 'Dodge';
export type CombatTag = 'Crushing' | 'Sweeping' | 'Piercing' | 'None';
export type CombatStatusEffect = 'None' | 'Sundered' | 'Staggered' | 'Bleeding' | 'Pinned';

export type KeywordCategory =
  | 'Defense Triangle Tag'
  | 'Active Defense'
  | 'Combat Status'
  | 'Core Mechanic'
  | 'Custom Rule';

export interface KeywordDefinition {
  id?: string;
  term: string;
  category: KeywordCategory | string;
  summary: string;
}

/**
 * Default starter March of Time Keywords (used as seed/fallback alongside `public.compendium_keywords`).
 */
export const DEFAULT_KEYWORDS: KeywordDefinition[] = [
  {
    id: 'kw-crushing',
    term: 'Crushing',
    category: 'Defense Triangle Tag',
    summary:
      'Overwhelming momentum that cannot be Parried. The defender must declare [Dodge] or [Shield Block], or take the full hit.',
  },
  {
    id: 'kw-piercing',
    term: 'Piercing',
    category: 'Defense Triangle Tag',
    summary:
      'Needle-point thrust that bypasses shields and cannot be Blocked. The defender must declare [Parry] or [Dodge].',
  },
  {
    id: 'kw-sweeping',
    term: 'Sweeping',
    category: 'Defense Triangle Tag',
    summary:
      'Wide horizontal arc that covers adjacent escape lanes and cannot be Dodged. The defender must declare [Parry] or [Shield Block].',
  },
  {
    id: 'kw-parry',
    term: 'Parry',
    category: 'Active Defense',
    summary:
      'Costs 1 AP before the attack roll (2d10 + Technique + Parry). Beats the attack to negate all damage; winning by +5 or more triggers a Flawless Counter (2 + Parry Mod [SP] damage).',
  },
  {
    id: 'kw-dodge',
    term: 'Dodge',
    category: 'Active Defense',
    summary:
      'Costs 1 AP before the attack roll (2d10 + Agility + Dodge) and shifts you 1 Tile. Winning by +5 or more triggers a Flawless Dodge, refunding the 1 AP spent.',
  },
  {
    id: 'kw-shield-block',
    term: 'Shield Block',
    category: 'Active Defense',
    summary:
      'Costs 1 AP with an equipped shield (2d10 + Iron + [Parry]). Even if the attack hits, reduces incoming [SP] damage by Shield Value + Iron.',
  },
  {
    id: 'kw-sundered',
    term: 'Sundered',
    category: 'Combat Status',
    summary:
      'Armor plates and guard are compromised: target suffers -2 [Armor DR] and -2 to [Shield Block] rolls until the end of their next turn.',
  },
  {
    id: 'kw-staggered',
    term: 'Staggered',
    category: 'Combat Status',
    summary:
      'Rattled posture: target starts their next round with -1 AP (3 AP instead of 4 AP) and cannot trigger Flawless reactions.',
  },
  {
    id: 'kw-bleeding',
    term: 'Bleeding',
    category: 'Combat Status',
    summary:
      'Lacerated vital vessels: target loses 1 [HP] directly (bypassing [SP] and [Armor DR]) at the end of each turn until bandaged or stabilized.',
  },
  {
    id: 'kw-pinned',
    term: 'Pinned',
    category: 'Combat Status',
    summary:
      'Locked in place: target cannot spend AP to Move or declare [Dodge] reactions until they spend 1 AP to break free.',
  },
  {
    id: 'kw-sp',
    term: 'SP',
    category: 'Core Mechanic',
    summary:
      'Stamina & Poise (10 + Iron×2 + MAX([Parry],[Dodge])×2). All attacks deplete SP first; once SP reaches 0, overflow damage strikes [HP].',
  },
  {
    id: 'kw-hp',
    term: 'HP',
    category: 'Core Mechanic',
    summary:
      'Physical Health (5 + Iron×2). Protected by [Armor DR] once your [SP] is broken.',
  },
  {
    id: 'kw-armor-dr',
    term: 'Armor DR',
    category: 'Core Mechanic',
    summary:
      'Flat reduction applied to incoming [HP] damage when your [SP] is at 0 (Light 1, Medium 2, Heavy 4).',
  },
];

export interface DescriptionSegment {
  text: string;
  keyword: KeywordDefinition | null;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a case-insensitive keyword map from the active `keywordsList`, including common verb inflections.
 */
export function buildKeywordLookupMap(
  keywordsList: KeywordDefinition[] = DEFAULT_KEYWORDS
): Map<string, KeywordDefinition> {
  const map = new Map<string, KeywordDefinition>();
  for (const kw of keywordsList) {
    const lower = kw.term.trim().toLowerCase();
    if (!lower) continue;
    map.set(lower, kw);

    // Helpful verb/inflection aliases
    if (lower === 'parry') map.set('parried', kw);
    if (lower === 'dodge') map.set('dodged', kw);
    if (lower === 'shield block') {
      map.set('block', kw);
      map.set('blocked', kw);
      map.set('shield blocked', kw);
    }
  }
  return map;
}

/**
 * Strips `[` and `]` around `[Special Word]` tags and splits text into plain text + hoverable Keyword segments
 * using the live `keywordsList` from `CompendiumStore`.
 */
export function tokenizeTextWithKeywords(
  rawText: string,
  keywordsList: KeywordDefinition[] = DEFAULT_KEYWORDS
): DescriptionSegment[] {
  if (!rawText) return [];
  const lookup = buildKeywordLookupMap(keywordsList);
  const cleaned = rawText.replace(/\[([^\]]+)\]/g, '$1');

  const allKeys = Array.from(lookup.keys()).sort((a, b) => b.length - a.length);
  if (allKeys.length === 0) {
    return [{ text: cleaned, keyword: null }];
  }

  const pattern = new RegExp(`\\b(${allKeys.map(escapeRegExp).join('|')})\\b`, 'gi');
  const segments: DescriptionSegment[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: cleaned.slice(lastIndex, match.index),
        keyword: null,
      });
    }
    const matchedWord = match[0];
    const def = lookup.get(matchedWord.toLowerCase()) ?? null;
    segments.push({
      text: matchedWord,
      keyword: def,
    });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    segments.push({
      text: cleaned.slice(lastIndex),
      keyword: null,
    });
  }

  return segments;
}

/**
 * Slay the Spire-style Chained Keyword Resolver:
 * Given a hovered root Keyword (e.g. `Sweeping`), returns all distinct Keywords referenced
 * inside `rootKeyword.summary` (e.g. `Dodge`, `Parry`, `Shield Block`) in order of appearance,
 * with cycle protection so self-references or mutual references never loop.
 */
export function resolveChainedKeywords(
  rootKeyword: KeywordDefinition | null,
  keywordsList: KeywordDefinition[] = DEFAULT_KEYWORDS
): KeywordDefinition[] {
  if (!rootKeyword) return [];

  const seenTerms = new Set<string>([rootKeyword.term.trim().toLowerCase()]);
  const chained: KeywordDefinition[] = [];

  const segments = tokenizeTextWithKeywords(rootKeyword.summary, keywordsList);
  for (const seg of segments) {
    if (!seg.keyword) continue;
    const key = seg.keyword.term.trim().toLowerCase();
    if (!seenTerms.has(key)) {
      seenTerms.add(key);
      chained.push(seg.keyword);
    }
  }

  return chained;
}

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

  // Embedded Visual Metadata (persists automatically inside JSONB rule_hooks)
  __icon?: string;
  __icon_color?: string;
  __icon_tint_custom?: boolean;
}

export type EditableRuleHookKey = Exclude<
  keyof PerkRuleHooks,
  'disallow_defense' | '__icon' | '__icon_color' | '__icon_tint_custom'
>;

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
  icon?: string | null;
  icon_color?: string | null;
  icon_tint_custom?: boolean | null;
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
  icon?: string | null;
  icon_color?: string | null;
  icon_tint_custom?: boolean | null;
}

export interface CompendiumIconPreset {
  id: string;
  label: string;
  category: 'Weapon' | 'Defense' | 'Element' | 'Mastery';
  paths: string[];
}

export const COMPENDIUM_ICON_PRESETS: CompendiumIconPreset[] = [
  {
    id: 'greatsword',
    label: 'Greatsword',
    category: 'Weapon',
    paths: [
      'M14.5 3.5L20.5 9.5L17 13L11 7L14.5 3.5Z',
      'M12.5 8.5L4 17L7 20L15.5 11.5',
      'M3 21L5.5 18.5',
    ],
  },
  {
    id: 'twin-daggers',
    label: 'Twin Daggers',
    category: 'Weapon',
    paths: [
      'M19 3L9 13L11 15L21 5L19 3Z',
      'M7 11L13 17',
      'M5 19L9 15',
      'M3 14L10 7',
    ],
  },
  {
    id: 'warhammer',
    label: 'Warhammer',
    category: 'Weapon',
    paths: [
      'M15 4L20 9L16 13L11 8L15 4Z',
      'M13.5 10.5L4 20',
      'M12 3L9 6',
      'M21 12L18 15',
    ],
  },
  {
    id: 'spear',
    label: 'Piercing Spear',
    category: 'Weapon',
    paths: [
      'M21 3L13 6L18 11L21 3Z',
      'M15.5 8.5L3 21',
      'M11 9L15 13',
    ],
  },
  {
    id: 'battleaxe',
    label: 'Battleaxe',
    category: 'Weapon',
    paths: [
      'M14 4C18 4 21 7 21 11C18 11 15 10 13 8',
      'M10 14C8 12 7 9 7 6C11 6 14 9 14 13',
      'M3 21L17 7',
    ],
  },
  {
    id: 'bow',
    label: 'Recurve Bow',
    category: 'Weapon',
    paths: [
      'M5 4C14 4 20 10 20 19',
      'M5 4L20 19',
      'M16 4L20 4L20 8',
      'M7 17L20 4',
    ],
  },
  {
    id: 'bastion-shield',
    label: 'Bastion Shield',
    category: 'Defense',
    paths: [
      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
      'M12 7v10',
      'M8 11h8',
    ],
  },
  {
    id: 'riposte',
    label: 'Crossed Blades',
    category: 'Defense',
    paths: [
      'M4 20L19 5',
      'M15 4H20V9',
      'M20 20L5 5',
      'M9 4H4V9',
    ],
  },
  {
    id: 'iron-helm',
    label: 'Iron War Helm',
    category: 'Defense',
    paths: [
      'M5 13a7 7 0 1 1 14 0v6H5v-6z',
      'M12 3v10',
      'M8 15h3',
      'M13 15h3',
    ],
  },
  {
    id: 'gale-wind',
    label: 'Gale Wind',
    category: 'Element',
    paths: [
      'M9.59 4.59A2 2 0 1 1 11 8H2',
      'M12.59 19.41A2 2 0 1 0 14 16H2',
      'M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2',
    ],
  },
  {
    id: 'lightning',
    label: 'Reflex Bolt',
    category: 'Element',
    paths: ['M13 2L3 14h8l-1 8 10-12h-8l1-8z'],
  },
  {
    id: 'sunfire',
    label: 'Sunfire Flame',
    category: 'Element',
    paths: [
      'M12 2c1.5 3.5 4 5.5 4 9a6 6 0 1 1-12 0c0-2.5 1.5-5 3-6.5 0 2 1.5 3 2.5 3C9.5 5 11 3.5 12 2z',
    ],
  },
  {
    id: 'sunder-skull',
    label: 'Sunder Impact',
    category: 'Mastery',
    paths: [
      'M12 3a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 5.5V19h8v-3.5c1.5-1 3-3 3-5.5a7 7 0 0 0-7-7z',
      'M9 11h.01',
      'M15 11h.01',
      'M10 19v2',
      'M14 19v2',
    ],
  },
  {
    id: 'crimson-drop',
    label: 'Crimson Vitality',
    category: 'Mastery',
    paths: ['M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z'],
  },
  {
    id: 'tactical-eye',
    label: 'Precision Eye',
    category: 'Mastery',
    paths: [
      'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z',
      'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    ],
  },
  {
    id: 'grand-crest',
    label: 'Grandmaster Crest',
    category: 'Mastery',
    paths: [
      'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    ],
  },
];

export interface CompendiumColorPreset {
  hex: string;
  label: string;
}

export const COMPENDIUM_COLOR_PRESETS: CompendiumColorPreset[] = [
  { hex: '#FF8C5A', label: 'Sunfire Copper' },
  { hex: '#38B29A', label: 'Jade Poise' },
  { hex: '#F26464', label: 'Crimson Vitality' },
  { hex: '#F59E0B', label: 'Gilded Amber' },
  { hex: '#38BDF8', label: 'Glacier Steel' },
  { hex: '#A78BFA', label: 'Amethyst Veil' },
  { hex: '#EC4899', label: 'Duelist Rose' },
  { hex: '#EBF5F3', label: 'Bone Ivory' },
];

export interface ResolvedCompendiumVisuals {
  icon: string;
  color: string;
  tintCustom: boolean;
  isCustomUpload: boolean;
}

export function isCustomIconUrl(icon: string | null | undefined): boolean {
  if (!icon) return false;
  const trimmed = icon.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  );
}

/**
 * Resolves the effective icon (`preset` ID or uploaded URL) and accent color for a Skill Tree.
 */
export function resolveTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
  let defaultIcon = 'bastion-shield';
  let defaultColor = '#FF8C5A';

  const key = `${tree.slug} ${tree.name}`.toLowerCase();
  if (key.includes('juggernaut') || key.includes('breaker') || key.includes('brawn')) {
    defaultIcon = 'greatsword';
    defaultColor = '#FF8C5A';
  } else if (key.includes('phantom') || key.includes('veil') || key.includes('shadow')) {
    defaultIcon = 'twin-daggers';
    defaultColor = '#A78BFA';
  } else if (key.includes('tempest') || key.includes('gale') || key.includes('wind')) {
    defaultIcon = 'gale-wind';
    defaultColor = '#38B29A';
  }

  const icon = tree.icon?.trim() || defaultIcon;
  const color = tree.icon_color?.trim() || defaultColor;
  const tintCustom = tree.icon_tint_custom ?? true;

  return {
    icon,
    color,
    tintCustom,
    isCustomUpload: isCustomIconUrl(icon),
  };
}

/**
 * Resolves the effective icon (`preset` ID or uploaded URL) and accent color for a Perk Node.
 */
export function resolveNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
  const nKey = `${node.slug} ${node.name}`.toLowerCase();

  let defaultIcon = node.node_type === 'combat_art' ? 'greatsword' : 'bastion-shield';
  if (nKey.includes('ram') || nKey.includes('hammer') || nKey.includes('crush')) {
    defaultIcon = 'warhammer';
  } else if (nKey.includes('earthshaker') || nKey.includes('sunder') || nKey.includes('skull')) {
    defaultIcon = 'sunder-skull';
  } else if (nKey.includes('whirlwind') || nKey.includes('sweep') || nKey.includes('axe')) {
    defaultIcon = 'battleaxe';
  } else if (nKey.includes('heartseeker') || nKey.includes('thrust') || nKey.includes('pierc')) {
    defaultIcon = 'spear';
  } else if (nKey.includes('shadow') || nKey.includes('dagger') || nKey.includes('lunge')) {
    defaultIcon = 'twin-daggers';
  } else if (nKey.includes('gale') || nKey.includes('stride') || nKey.includes('wind')) {
    defaultIcon = 'gale-wind';
  } else if (nKey.includes('cyclone') || nKey.includes('riposte') || nKey.includes('parry')) {
    defaultIcon = 'riposte';
  } else if (nKey.includes('flicker') || nKey.includes('reflex') || nKey.includes('bolt')) {
    defaultIcon = 'lightning';
  } else if (nKey.includes('precision') || nKey.includes('lethal') || nKey.includes('eye')) {
    defaultIcon = 'tactical-eye';
  } else if (nKey.includes('titan') || nKey.includes('helm') || nKey.includes('iron')) {
    defaultIcon = 'iron-helm';
  } else if (nKey.includes('rhythm') || nKey.includes('flame') || nKey.includes('sunfire')) {
    defaultIcon = 'sunfire';
  } else if (nKey.includes('blood') || nKey.includes('bleed') || nKey.includes('conditioning')) {
    defaultIcon = 'crimson-drop';
  }

  const defaultColor = node.node_type === 'combat_art' ? '#FF8C5A' : '#38B29A';

  const icon =
    node.icon?.trim() ||
    node.rule_hooks?.__icon?.trim() ||
    defaultIcon;
  const color =
    node.icon_color?.trim() ||
    node.rule_hooks?.__icon_color?.trim() ||
    defaultColor;
  const tintCustom =
    node.icon_tint_custom ??
    node.rule_hooks?.__icon_tint_custom ??
    true;

  return {
    icon,
    color,
    tintCustom,
    isCustomUpload: isCustomIconUrl(icon),
  };
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
