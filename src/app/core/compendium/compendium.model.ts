export type AttributeName = 'Brawn' | 'Agility' | 'Technique' | 'Iron' | 'Cunning';
export type CombatSkillName = 'Strike' | 'Shoot' | 'Parry' | 'Dodge' | 'Block';
export type CombatTag = 'Crushing' | 'Sweeping' | 'Piercing' | 'None';
export type CombatStatusEffect = 'None' | 'Sundered' | 'Staggered' | 'Bleeding' | 'Pinned';

export function getCombatTagBadgeClass(tag: CombatTag | string | null | undefined): string {
  if (tag === 'Crushing') return 'badge-crushing';
  if (tag === 'Sweeping') return 'badge-sweeping';
  if (tag === 'Piercing') return 'badge-piercing';
  return '';
}

export function getCombatTagCounterLabel(tag: CombatTag | string | null | undefined): string {
  if (tag === 'Crushing') return 'Cannot Parry';
  if (tag === 'Sweeping') return 'Cannot Dodge';
  if (tag === 'Piercing') return 'Cannot Block';
  return '';
}

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
  is_active?: boolean;
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
      'Overwhelming momentum that cannot be Parried. The defender must declare [Dodge] or rely on [Raise Shield] ([Shield Block]), or take the full hit.',
  },
  {
    id: 'kw-piercing',
    term: 'Piercing',
    category: 'Defense Triangle Tag',
    summary:
      'Needle-point thrust that bypasses shields and ignores [Raise Shield] ([Shield Block]). The defender must declare [Parry] or [Dodge].',
  },
  {
    id: 'kw-sweeping',
    term: 'Sweeping',
    category: 'Defense Triangle Tag',
    summary:
      'Wide horizontal arc that covers adjacent escape lanes and cannot be Dodged. The defender must declare [Parry] or rely on [Raise Shield] ([Shield Block]).',
  },
  {
    id: 'kw-parry',
    term: 'Parry',
    category: 'Active Defense',
    summary:
      'Costs 1 AP Reaction before the attack roll (2d10 + Technique + Parry). Beats the attack to negate all damage; a Buckler enables Martial Parry to deal Flawless Counter (2 + Parry Mod [SP] damage) on +5 or more.',
  },
  {
    id: 'kw-dodge',
    term: 'Dodge',
    category: 'Active Defense',
    summary:
      'Costs 1 AP Reaction before the attack roll (2d10 + Agility + Dodge) and shifts you 1 Tile. Winning by +5 or more triggers a Flawless Dodge, refunding the 1 AP spent. Disabled by Heavy Armor or a Heavy/Tower Shield.',
  },
  {
    id: 'kw-raise-shield',
    term: 'Raise Shield',
    category: 'Active Defense',
    summary:
      '1 AP Action on your turn (Medium/Standard Shield, Heavy/Tower Shield, or [Guard] Weapon): Activates your [Shield Block] mitigation (Shield or Weapon [Guard] Base + Block Skill, no roll required) against all non-[Piercing] attacks until your next turn.',
  },
  {
    id: 'kw-shield-block',
    term: 'Shield Block',
    category: 'Active Defense',
    summary:
      'Active while [Raise Shield] / [Guard] (1 AP action) is up. Automatically mitigates incoming non-[Piercing] damage by Base + Block Skill (Standard Shield Base 3, Tower Shield Base 5, Weapon [Guard] Base 2; no roll required, remaining damage goes to [SP]).',
  },
  {
    id: 'kw-two-handed',
    term: 'Two-Handed',
    category: 'Core Mechanic',
    summary:
      'Requires both hands to wield. You cannot use an off-hand Shield while a Two-Handed weapon is active (any equipped shield is stowed).',
  },
  {
    id: 'kw-guard',
    term: 'Guard',
    category: 'Core Mechanic',
    summary:
      'Defensive weapon property: allows you to spend 1 AP on your turn to brace your weapon and Block incoming non-[Piercing] attacks using your Block Skill (Weapon Guard Base + Block Skill), even while [Two-Handed] without a shield.',
  },
  {
    id: 'kw-aim',
    term: 'Aim',
    category: 'Core Mechanic',
    summary:
      'Ranged weapons can fire anytime at Disadvantage. Spending 1 AP to Aim at your target first allows you to make a normal Shoot roll.',
  },
  {
    id: 'kw-stance-recovery',
    term: 'Stance Recovery',
    category: 'Core Mechanic',
    summary:
      '1 AP Action on your turn: Steady your breathing and posture to recover 2 + Iron [SP].',
  },
  {
    id: 'kw-sundered',
    term: 'Sundered',
    category: 'Combat Status',
    summary:
      'Armor plates and guard are compromised: target suffers -2 [Armor DR] and -2 to [Shield Block] mitigation until the end of their next turn.',
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
      'Stamina & Poise (2 + Iron + Armor SP). All attacks deplete SP first; once SP reaches 0, overflow damage strikes [HP]. Spend 1 AP on [Stance Recovery] to restore 2 + Iron SP.',
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
      'Flat damage reduction from equipped armor: Light (+1/+2/+3 DR, +2/+4/+6 [SP]), Medium (+2/+4/+6 DR, +1/+2/+4 [SP]), Heavy (+3/+6/+9 DR & [SP], disables [Dodge]).',
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
 * Returns distinct keywords referenced inside `rootKeyword.summary` in order of appearance,
 * with cycle protection against self or mutual references.
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
  bonus_max_hp?: number;
  bonus_max_sp?: number;
  bonus_stance_recovery?: number;
  bonus_armor_dr?: number;
  bonus_move_tiles?: number;
  bonus_attack_mod?: number;
  bonus_flat_damage?: number;
  bonus_parry_mod?: number;
  bonus_dodge_mod?: number;
  bonus_block_mod?: number;

  disallow_defense?: ('Parry' | 'Dodge' | 'Block')[];
  bonus_sp_damage?: number;
  ignore_armor_dr?: number;
  push_tiles?: number;
  self_shift_tiles?: number;
  inflict_status?: CombatStatusEffect;

  __icon?: string;
  __icon_color?: string;
  __icon_tint_custom?: boolean;
  __is_active?: boolean;
  __is_standalone?: boolean;
  __sort_order?: number;
  __tier?: number;
}

export type EditableRuleHookKey = Exclude<
  keyof PerkRuleHooks,
  | 'disallow_defense'
  | '__icon'
  | '__icon_color'
  | '__icon_tint_custom'
  | '__is_active'
  | '__is_standalone'
  | '__sort_order'
  | '__tier'
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

export const RULE_HOOK_DEFINITIONS: RuleHookDefinition[] = [
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
  {
    key: 'bonus_max_sp',
    label: 'Bonus Max SP (Base 2 + Iron + Armor SP)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 2,
  },
  {
    key: 'bonus_stance_recovery',
    label: 'Bonus Stance Recovery SP (Base 2 + Iron)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
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
    label: 'Bonus Shield Block Mitigation (Shield Base + Block)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 1,
  },
];

export type WeaponPropertyTag = 'Two-Handed' | 'Guard';

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
  is_active?: boolean;
}

/**
 * Determines whether a weapon has the `Two-Handed` tag.
 * Reads `weapon.rule_hooks['two_handed']` if explicitly set; otherwise defaults
 * based on category/slug (`Heavy` and `Ranged` weapons like Greatsword, Warhammer, Shortbow).
 */
export function isWeaponTwoHanded(weapon: WeaponModel | null | undefined): boolean {
  if (!weapon) return false;
  const hooks = weapon.rule_hooks ?? {};
  if (typeof hooks['two_handed'] === 'boolean') {
    return hooks['two_handed'];
  }
  const cat = (weapon.category ?? '').toLowerCase();
  const slug = (weapon.slug ?? '').toLowerCase();
  return (
    cat === 'heavy' ||
    cat === 'ranged' ||
    slug === 'greatsword' ||
    slug === 'warhammer' ||
    slug === 'shortbow'
  );
}

/**
 * Determines whether a weapon has the `Guard` property tag (can be braced to Block using `Block` Skill).
 * Reads `weapon.rule_hooks['guard']` or `weapon.rule_hooks['heavy']` if explicitly set; otherwise defaults to `true` for
 * `Heavy` category weapons (`greatsword`, `warhammer`).
 */
export function isWeaponHeavy(weapon: WeaponModel | null | undefined): boolean {
  if (!weapon) return false;
  const hooks = weapon.rule_hooks ?? {};
  if (typeof hooks['guard'] === 'boolean') {
    return hooks['guard'];
  }
  if (typeof hooks['heavy'] === 'boolean') {
    return hooks['heavy'];
  }
  const cat = (weapon.category ?? '').toLowerCase();
  const slug = (weapon.slug ?? '').toLowerCase();
  return cat === 'heavy' || slug === 'greatsword' || slug === 'warhammer';
}

/**
 * Base Block mitigation when bracing a `Guard` weapon to Block (`Raise Weapon Guard`, 1 AP).
 * Defaults to `2` (`2 + Block Skill`).
 */
export function getHeavyWeaponBlockBase(weapon: WeaponModel | null | undefined): number {
  if (!weapon || !isWeaponHeavy(weapon)) return 0;
  const raw = Number(
    weapon.rule_hooks?.['guard_block_base'] ??
      weapon.rule_hooks?.['heavy_block_base'] ??
      2
  );
  return Number.isNaN(raw) || raw <= 0 ? 2 : raw;
}

/**
 * Returns the list of weapon property tags (`['Two-Handed', 'Guard']`, etc.) for display on cards and selectors.
 */
export function getWeaponPropertyTags(weapon: WeaponModel | null | undefined): WeaponPropertyTag[] {
  if (!weapon) return [];
  const tags: WeaponPropertyTag[] = [];
  if (isWeaponTwoHanded(weapon)) tags.push('Two-Handed');
  if (isWeaponHeavy(weapon)) tags.push('Guard');
  return tags;
}

export interface SkillTreeModel {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string | null;
  icon_color?: string | null;
  icon_tint_custom?: boolean | null;
  is_active?: boolean;
}

export interface PerkNodeModel {
  id: string;
  tree_id: string | null;
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
  is_active?: boolean;
}

/**
 * Returns `true` when a `PerkNodeModel` is a Standalone ("Solo") Combat Art or Passive
 * that does not belong to any Martial Skill Tree (`tree_id === null` or `rule_hooks.__is_standalone === true`).
 */
export function isStandalonePerkNode(
  node: PerkNodeModel | null | undefined
): boolean {
  if (!node) return false;
  return !node.tree_id || node.rule_hooks?.__is_standalone === true;
}

/**
 * Returns `true` if a Compendium entry is active (`is_active !== false` and `rule_hooks.__is_active !== false`).
 * Archived (`is_active === false`) items are hidden from new character creation while remaining safe for existing characters.
 */
export function isCompendiumItemActive(
  item:
    | {
        is_active?: boolean | null;
        rule_hooks?: unknown;
      }
    | null
    | undefined
): boolean {
  if (!item) return false;
  if (item.is_active === false) return false;
  const hooks = item.rule_hooks as Record<string, unknown> | undefined;
  if (hooks && hooks['__is_active'] === false) return false;
  return true;
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

/**
 * Resolves the effective icon (`preset` ID or uploaded URL) and accent color for a Weapon.
 */
export function resolveWeaponVisuals(weapon: WeaponModel): ResolvedCompendiumVisuals {
  const key = `${weapon.slug} ${weapon.name} ${weapon.category}`.toLowerCase();

  let defaultIcon = 'greatsword';
  let defaultColor = '#FF8C5A';

  if (key.includes('hammer') || key.includes('mace') || key.includes('maul')) {
    defaultIcon = 'warhammer';
    defaultColor = '#F59E0B';
  } else if (key.includes('dagger') || key.includes('knife') || key.includes('stiletto')) {
    defaultIcon = 'twin-daggers';
    defaultColor = '#A78BFA';
  } else if (key.includes('rapier') || key.includes('duel') || key.includes('foil')) {
    defaultIcon = 'riposte';
    defaultColor = '#38BDF8';
  } else if (key.includes('spear') || key.includes('pike') || key.includes('halberd') || key.includes('lance')) {
    defaultIcon = 'spear';
    defaultColor = '#38B29A';
  } else if (key.includes('axe')) {
    defaultIcon = 'battleaxe';
    defaultColor = '#F26464';
  } else if (key.includes('bow') || key.includes('ranged') || key.includes('sling')) {
    defaultIcon = 'bow';
    defaultColor = '#38B29A';
  } else if (key.includes('longsword') || key.includes('martial')) {
    defaultIcon = 'greatsword';
    defaultColor = '#38BDF8';
  }

  const hooks = weapon.rule_hooks ?? {};
  const rawIcon = typeof hooks['__icon'] === 'string' ? hooks['__icon'].trim() : '';
  const rawColor = typeof hooks['__icon_color'] === 'string' ? hooks['__icon_color'].trim() : '';
  const rawTint = typeof hooks['__icon_tint_custom'] === 'boolean' ? hooks['__icon_tint_custom'] : true;

  const icon = rawIcon || defaultIcon;
  const color = rawColor || defaultColor;

  return {
    icon,
    color,
    tintCustom: rawTint,
    isCustomUpload: isCustomIconUrl(icon),
  };
}

/**
 * Formats mechanical rule hook badges for a Weapon card in the Armory / Inspector.
 */
export function formatWeaponHookBadges(weapon: WeaponModel | null | undefined): string[] {
  if (!weapon) return [];
  const badges: string[] = [];
  const hooks = weapon.rule_hooks ?? {};

  if (weapon.thrown_range_tiles && weapon.thrown_range_tiles > 0) {
    badges.push(`Thrown (${weapon.thrown_range_tiles} Tiles)`);
  }
  const parryBonus = Number(hooks['parry_roll_bonus'] ?? 0);
  if (parryBonus > 0) {
    badges.push(`+${parryBonus} Parry Roll`);
  }
  const flawlessParryBonus = Number(hooks['flawless_parry_bonus_sp_damage'] ?? 0);
  if (flawlessParryBonus > 0) {
    badges.push(`+${flawlessParryBonus} Flawless Parry SP`);
  }
  const ignoreDr = Number(hooks['ignore_armor_dr'] ?? 0);
  if (ignoreDr > 0) {
    badges.push(`Pierces ${ignoreDr} Armor DR`);
  }
  const chipSp = Number(hooks['defended_sp_damage'] ?? 0);
  if (chipSp > 0) {
    badges.push(`${chipSp} SP Chip on Defended Hit`);
  }

  return badges;
}

export interface SkillTreeBranchNode {
  node: PerkNodeModel;
  children: SkillTreeBranchNode[];
}

export function getPerkNodeSortOrder(node: PerkNodeModel): number {
  const raw = node.rule_hooks?.__sort_order;
  return typeof raw === 'number' && Number.isFinite(raw)
    ? raw
    : Number.MAX_SAFE_INTEGER;
}

export function compareSiblingPerkNodes(a: PerkNodeModel, b: PerkNodeModel): number {
  const orderA = getPerkNodeSortOrder(a);
  const orderB = getPerkNodeSortOrder(b);
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  return a.name.localeCompare(b.name);
}

export function getDescendantNodeIds(
  rootNodeId: string,
  allNodes: PerkNodeModel[]
): Set<string> {
  const descendants = new Set<string>();
  const childrenByParent = new Map<string, string[]>();

  for (const n of allNodes) {
    if (!n.parent_node_id) continue;
    const list = childrenByParent.get(n.parent_node_id) ?? [];
    list.push(n.id);
    childrenByParent.set(n.parent_node_id, list);
  }

  const stack = [...(childrenByParent.get(rootNodeId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === rootNodeId || descendants.has(id)) continue;
    descendants.add(id);
    const next = childrenByParent.get(id);
    if (next) stack.push(...next);
  }

  return descendants;
}

export function computePerkNodeTier(
  treeId: string | null | undefined,
  parentNodeId: string | null | undefined,
  allNodes: PerkNodeModel[]
): number {
  if (!treeId || !parentNodeId) return 1;

  const treeById = new Map<string, PerkNodeModel>();
  for (const n of allNodes) {
    if (n.tree_id === treeId) {
      treeById.set(n.id, n);
    }
  }

  let depth = 1;
  let cursorId: string | null | undefined = parentNodeId;
  const visited = new Set<string>();

  while (cursorId && !visited.has(cursorId)) {
    const parent = treeById.get(cursorId);
    if (!parent) break;
    visited.add(cursorId);
    depth += 1;
    cursorId = parent.parent_node_id;
  }

  return depth;
}

export function normalizePerkNodesTiers(allNodes: PerkNodeModel[]): PerkNodeModel[] {
  return allNodes.map((node) => {
    if (isStandalonePerkNode(node)) {
      return node.tier === 1 ? node : { ...node, tier: 1 };
    }
    const computedTier = computePerkNodeTier(
      node.tree_id,
      node.parent_node_id,
      allNodes
    );
    return node.tier === computedTier ? node : { ...node, tier: computedTier };
  });
}

/**
 * Builds a hierarchical forest of root nodes and their recursive child branches
 * for rendering a connected visual Skill Tree.
 */
export function buildSkillTreeHierarchy(
  treeId: string,
  allNodes: PerkNodeModel[]
): SkillTreeBranchNode[] {
  const treeNodes = allNodes.filter((n) => n.tree_id === treeId);
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

  roots.sort(compareSiblingPerkNodes);
  for (const list of childrenMap.values()) {
    list.sort(compareSiblingPerkNodes);
  }

  const buildBranch = (
    current: PerkNodeModel,
    depth: number,
    visited = new Set<string>()
  ): SkillTreeBranchNode => {
    visited.add(current.id);
    const directChildren = (childrenMap.get(current.id) ?? []).filter(
      (c) => !visited.has(c.id)
    );
    const effectiveNode =
      current.tier === depth ? current : { ...current, tier: depth };
    return {
      node: effectiveNode,
      children: directChildren.map((child) =>
        buildBranch(child, depth + 1, new Set(visited))
      ),
    };
  };

  return roots.map((r) => buildBranch(r, 1));
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
  if (hooks.bonus_max_sp) {
    badges.push(`+${hooks.bonus_max_sp} Max SP`);
  }
  if (hooks.bonus_stance_recovery) {
    badges.push(`+${hooks.bonus_stance_recovery} Stance Recovery SP`);
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
