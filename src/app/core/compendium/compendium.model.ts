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
      'Costs 1 AP Reaction before the attack roll (2d10 + Agility + Dodge) and shifts you 5 ft. Winning by +5 or more triggers a Flawless Dodge, refunding the 1 AP spent. Disabled by Heavy Armor or a Heavy/Tower Shield.',
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

export type PerkNodeUiKind =
  | 'combat_art'
  | 'combat_art_upgrade'
  | 'passive_upgrade';

export type CombatArtUpgradeTargetMode = 'specific_arts' | 'player_choice_tree';

export type ActiveCombatTag = Exclude<CombatTag, 'None'>;

export interface CombatArtUpgradeSpec {
  target_mode: CombatArtUpgradeTargetMode;
  target_art_ids?: string[];
  add_combat_tags?: ActiveCombatTag[];
  ap_cost_delta?: number;
  cooldown_delta?: number;
  bonus_attack_mod?: number;
  bonus_flat_damage?: number;
  bonus_sp_damage?: number;
  ignore_armor_dr?: number;
  push_tiles?: number;
  self_shift_tiles?: number;
  inflict_statuses?: Exclude<CombatStatusEffect, 'None'>[];
}

export const WEAPON_CATEGORY_OPTIONS = [
  'Light',
  'Martial',
  'Heavy',
  'Ranged',
] as const;

export type WeaponCategoryOption = (typeof WEAPON_CATEGORY_OPTIONS)[number];

export type WeaponHandednessOption = 'one_handed' | 'two_handed';

export interface CombatArtWeaponRequirement {
  categories?: string[];
  handedness?: WeaponHandednessOption;
  requires_guard_weapon?: boolean;
  requires_thrown?: boolean;
  requires_shield?: boolean;
  weapon_ids?: string[];
  weapon_names?: string[];
}

export interface WeaponRequirementEvaluation {
  hasRequirement: boolean;
  satisfied: boolean;
  label: string | null;
  unmetReason: string | null;
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

  __art_upgrade?: CombatArtUpgradeSpec;
  __weapon_req?: CombatArtWeaponRequirement;
  __icon?: string;
  __icon_color?: string;
  __icon_tint_custom?: boolean;
  __is_active?: boolean;
  __is_standalone?: boolean;
  __sort_order?: number;
  __tier?: number;
  __parent_ids?: string[];
  __unlock_mode?: PerkUnlockMode;
  __canvas_x?: number;
  __canvas_y?: number;
}

export type PerkUnlockMode = 'any' | 'all';

export type EditableRuleHookKey = Exclude<
  keyof PerkRuleHooks,
  | 'disallow_defense'
  | '__art_upgrade'
  | '__weapon_req'
  | '__icon'
  | '__icon_color'
  | '__icon_tint_custom'
  | '__is_active'
  | '__is_standalone'
  | '__sort_order'
  | '__tier'
  | '__parent_ids'
  | '__unlock_mode'
  | '__canvas_x'
  | '__canvas_y'
>;

export interface RuleHookDefinition {
  key: EditableRuleHookKey;
  label: string;
  category: 'Sheet Stat Bonus' | 'Combat Art Effect';
  valueType: 'number' | 'status';
  defaultValue: number | CombatStatusEffect;
  unitScale?: number;
  step?: number;
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
    label: 'Push Target (ft)',
    category: 'Combat Art Effect',
    valueType: 'number',
    defaultValue: 5,
    unitScale: 5,
    step: 5,
  },
  {
    key: 'self_shift_tiles',
    label: 'Shift Self Before/After Strike (ft)',
    category: 'Combat Art Effect',
    valueType: 'number',
    defaultValue: 5,
    unitScale: 5,
    step: 5,
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
    label: 'Bonus Movement (ft per 1 AP)',
    category: 'Sheet Stat Bonus',
    valueType: 'number',
    defaultValue: 5,
    unitScale: 5,
    step: 5,
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

export function getHeavyWeaponBlockBase(weapon: WeaponModel | null | undefined): number {
  if (!weapon || !isWeaponHeavy(weapon)) return 0;
  const raw = Number(
    weapon.rule_hooks?.['guard_block_base'] ??
      weapon.rule_hooks?.['heavy_block_base'] ??
      2
  );
  return Number.isNaN(raw) || raw <= 0 ? 2 : raw;
}

export function getWeaponPropertyTags(weapon: WeaponModel | null | undefined): WeaponPropertyTag[] {
  if (!weapon) return [];
  const tags: WeaponPropertyTag[] = [];
  if (isWeaponTwoHanded(weapon)) tags.push('Two-Handed');
  if (isWeaponHeavy(weapon)) tags.push('Guard');
  return tags;
}

export const ARMOR_WEIGHT_OPTIONS = ['Light', 'Medium', 'Heavy'] as const;
export type ArmorWeightClass = (typeof ARMOR_WEIGHT_OPTIONS)[number];

export interface ArmorModel {
  id: string;
  slug: string;
  name: string;
  weight_class: ArmorWeightClass;
  armor_sp: number;
  armor_dr: number;
  allows_dodge: boolean;
  speed_penalty_tiles: number;
  description: string;
  rule_hooks: Record<string, unknown>;
  is_active?: boolean;
}

export const DEFAULT_COMPENDIUM_ARMORS: ArmorModel[] = [
  {
    id: 'armor-padded-gambeson',
    slug: 'padded-gambeson',
    name: 'Padded Gambeson',
    weight_class: 'Light',
    armor_sp: 2,
    armor_dr: 1,
    allows_dodge: true,
    speed_penalty_tiles: 0,
    description:
      'Quilted linen and boiled leather harness that cushions glancing blows while keeping full [Dodge] footwork.',
    rule_hooks: { __icon: 'breastplate', __icon_color: '#38B29A' },
    is_active: true,
  },
  {
    id: 'armor-studded-brigandine',
    slug: 'studded-brigandine',
    name: 'Studded Brigandine',
    weight_class: 'Light',
    armor_sp: 4,
    armor_dr: 2,
    allows_dodge: true,
    speed_penalty_tiles: 0,
    description:
      'Riveted steel lames beneath supple suede. Grants bolstered [SP] poise and [Armor DR] without restricting [Dodge].',
    rule_hooks: { __icon: 'breastplate', __icon_color: '#38BDF8' },
    is_active: true,
  },
  {
    id: 'armor-scale-hauberk',
    slug: 'scale-hauberk',
    name: 'Scale Hauberk',
    weight_class: 'Medium',
    armor_sp: 2,
    armor_dr: 2,
    allows_dodge: true,
    speed_penalty_tiles: 0,
    description:
      'Overlapping bronze and iron scales engineered to turn blade edges while preserving [Dodge] mobility.',
    rule_hooks: { __icon: 'breastplate', __icon_color: '#F59E0B' },
    is_active: true,
  },
  {
    id: 'armor-rivet-coat-of-plates',
    slug: 'rivet-coat-of-plates',
    name: 'Rivet Coat of Plates',
    weight_class: 'Medium',
    armor_sp: 2,
    armor_dr: 4,
    allows_dodge: true,
    speed_penalty_tiles: 0,
    description:
      'Reinforced cuirass plates over chain gussets for heavy [Armor DR] mitigation that still permits [Dodge].',
    rule_hooks: { __icon: 'iron-helm', __icon_color: '#FF8C5A' },
    is_active: true,
  },
  {
    id: 'armor-vanguard-half-plate',
    slug: 'vanguard-half-plate',
    name: 'Vanguard Half-Plate',
    weight_class: 'Heavy',
    armor_sp: 3,
    armor_dr: 3,
    allows_dodge: false,
    speed_penalty_tiles: 0,
    description:
      'Articulated breastplate, pauldrons, and greaves built for frontline clashes. Trades off [Dodge] for stout [SP] and [Armor DR].',
    rule_hooks: { __icon: 'iron-helm', __icon_color: '#F26464' },
    is_active: true,
  },
  {
    id: 'armor-fortress-full-plate',
    slug: 'fortress-full-plate',
    name: 'Fortress Full Plate',
    weight_class: 'Heavy',
    armor_sp: 6,
    armor_dr: 6,
    allows_dodge: false,
    speed_penalty_tiles: 0,
    description:
      'Masterwork interlocking steel harness. Massive [SP] and [Armor DR] protection; disables [Dodge].',
    rule_hooks: { __icon: 'iron-helm', __icon_color: '#A78BFA' },
    is_active: true,
  },
];

export const ITEM_SUBCATEGORY_OPTIONS = [
  'Ammunition',
  'Camping & Survival',
  'Consumable',
  'Tool & Kit',
  'Adventuring Gear',
  'Quest & Loot',
] as const;

export type ItemSubcategoryOption = (typeof ITEM_SUBCATEGORY_OPTIONS)[number];

export interface CompendiumItemModel {
  id: string;
  slug: string;
  name: string;
  subcategory: string;
  default_quantity: number;
  stackable: boolean;
  description: string;
  rule_hooks: Record<string, unknown>;
  is_active?: boolean;
}

export const DEFAULT_COMPENDIUM_ITEMS: CompendiumItemModel[] = [
  {
    id: 'item-bodkin-arrows',
    slug: 'bodkin-arrows',
    name: 'Bodkin Arrows',
    subcategory: 'Ammunition',
    default_quantity: 20,
    stackable: true,
    description:
      'Quiver of hardened iron-point shafts fletched for bows and ranged volleys.',
    rule_hooks: { __icon: 'quiver', __icon_color: '#FF8C5A' },
    is_active: true,
  },
  {
    id: 'item-stone-and-flint',
    slug: 'stone-and-flint',
    name: 'Stone & Flint',
    subcategory: 'Camping & Survival',
    default_quantity: 1,
    stackable: true,
    description:
      'High-carbon striker stone and sharp flint shard for sparking campfires, lanterns, and pitch torches.',
    rule_hooks: { __icon: 'sunfire', __icon_color: '#F59E0B' },
    is_active: true,
  },
  {
    id: 'item-canvas-field-tent',
    slug: 'canvas-field-tent',
    name: 'Canvas Field Tent',
    subcategory: 'Camping & Survival',
    default_quantity: 1,
    stackable: true,
    description:
      'Waxed two-person canvas shelter with stakes and guy-lines for camp rest in harsh weather.',
    rule_hooks: { __icon: 'camp-tent', __icon_color: '#38B29A' },
    is_active: true,
  },
  {
    id: 'item-trail-rations',
    slug: 'trail-rations',
    name: 'Trail Rations',
    subcategory: 'Camping & Survival',
    default_quantity: 3,
    stackable: true,
    description:
      'Wrapped smoked meat, hardtack, and dried fruit sustaining one march day per ration.',
    rule_hooks: { __icon: 'pack', __icon_color: '#F59E0B' },
    is_active: true,
  },
  {
    id: 'item-pitch-torch',
    slug: 'pitch-torch',
    name: 'Pitch Torch',
    subcategory: 'Camping & Survival',
    default_quantity: 2,
    stackable: true,
    description:
      'Resin-soaked timber brand that burns steadily to illuminate caverns and night camps.',
    rule_hooks: { __icon: 'sunfire', __icon_color: '#FF8C5A' },
    is_active: true,
  },
  {
    id: 'item-hempen-rope-50ft',
    slug: 'hempen-rope-50ft',
    name: 'Hempen Rope (50 ft)',
    subcategory: 'Adventuring Gear',
    default_quantity: 1,
    stackable: true,
    description:
      'Coiled 50-foot braided rope for scaling cliffs, rigging pulleys, or securing prisoners.',
    rule_hooks: { __icon: 'pack', __icon_color: '#EBF5F3' },
    is_active: true,
  },
  {
    id: 'item-field-bandages',
    slug: 'field-bandages',
    name: 'Field Bandages',
    subcategory: 'Consumable',
    default_quantity: 2,
    stackable: true,
    description:
      'Clean linen rolls and herbal poultice used to staunch [Bleeding] and dress wounds.',
    rule_hooks: { __icon: 'crimson-drop', __icon_color: '#F26464' },
    is_active: true,
  },
  {
    id: 'item-thieves-picks-and-tools',
    slug: 'thieves-picks-and-tools',
    name: "Thieves' Picks & Tools",
    subcategory: 'Tool & Kit',
    default_quantity: 1,
    stackable: true,
    description:
      'Roll of tension wrenches, fine hooks, and files for Tinkering checks on locks and traps.',
    rule_hooks: { __icon: 'tactical-eye', __icon_color: '#38BDF8' },
    is_active: true,
  },
];

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

export function isStandalonePerkNode(
  node: PerkNodeModel | null | undefined
): boolean {
  if (!node) return false;
  return !node.tree_id || node.rule_hooks?.__is_standalone === true;
}

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
  category: 'Weapon' | 'Defense' | 'Element' | 'Mastery' | 'Gear';
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
  {
    id: 'breastplate',
    label: 'Cuirass Breastplate',
    category: 'Defense',
    paths: [
      'M8 3L4 6v4l2 2v8h12v-8l2-2V6l-4-3c-1.2 1.4-2.5 2-4 2s-2.8-.6-4-2z',
      'M12 5v15',
      'M7 13h10',
    ],
  },
  {
    id: 'quiver',
    label: 'Arrow Quiver',
    category: 'Gear',
    paths: [
      'M5 19l5-10 5 2-5 10-5-2z',
      'M13 4l-2 5',
      'M17 5l-3 5',
      'M19 8l-4 4',
    ],
  },
  {
    id: 'camp-tent',
    label: 'Field Tent',
    category: 'Gear',
    paths: [
      'M3 20L12 4l9 16H3z',
      'M12 4v16',
      'M9 20l3-6 3 6',
    ],
  },
  {
    id: 'pack',
    label: 'Traveler Pack',
    category: 'Gear',
    paths: [
      'M6 8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z',
      'M9 4V2h6v2',
      'M6 12h12',
      'M10 12v3h4v-3',
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

  const defaultColor =
    node.node_type === 'combat_art'
      ? '#FF8C5A'
      : isCombatArtUpgradeNode(node)
        ? '#F59E0B'
        : '#38B29A';

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

export function resolveArmorVisuals(armor: ArmorModel): ResolvedCompendiumVisuals {
  const key = `${armor.slug} ${armor.name} ${armor.weight_class}`.toLowerCase();
  let defaultIcon = armor.weight_class === 'Heavy' ? 'iron-helm' : 'breastplate';
  let defaultColor =
    armor.weight_class === 'Heavy'
      ? '#F26464'
      : armor.weight_class === 'Medium'
        ? '#F59E0B'
        : '#38B29A';

  if (key.includes('plate') || key.includes('helm') || key.includes('fortress')) {
    defaultIcon = 'iron-helm';
  }

  const hooks = armor.rule_hooks ?? {};
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

export function resolveCompendiumItemVisuals(
  item: CompendiumItemModel
): ResolvedCompendiumVisuals {
  const key = `${item.slug} ${item.name} ${item.subcategory}`.toLowerCase();
  let defaultIcon = 'pack';
  let defaultColor = '#38B29A';

  if (key.includes('arrow') || key.includes('bolt') || key.includes('ammo') || key.includes('quiver')) {
    defaultIcon = 'quiver';
    defaultColor = '#FF8C5A';
  } else if (key.includes('tent') || key.includes('camp')) {
    defaultIcon = 'camp-tent';
    defaultColor = '#38B29A';
  } else if (key.includes('flint') || key.includes('torch') || key.includes('fire') || key.includes('lantern')) {
    defaultIcon = 'sunfire';
    defaultColor = '#F59E0B';
  } else if (key.includes('bandage') || key.includes('salve') || key.includes('potion') || key.includes('consumable')) {
    defaultIcon = 'crimson-drop';
    defaultColor = '#F26464';
  } else if (key.includes('pick') || key.includes('tool') || key.includes('kit')) {
    defaultIcon = 'tactical-eye';
    defaultColor = '#38BDF8';
  }

  const hooks = item.rule_hooks ?? {};
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

export function formatWeaponHookBadges(weapon: WeaponModel | null | undefined): string[] {
  if (!weapon) return [];
  const badges: string[] = [];
  const hooks = weapon.rule_hooks ?? {};

  if (weapon.thrown_range_tiles && weapon.thrown_range_tiles > 0) {
    badges.push(`Thrown (${Math.round(weapon.thrown_range_tiles * 5)} ft)`);
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

export interface SkillGraphPoint {
  x: number;
  y: number;
}

export interface SkillGraphRouteEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export const SKILL_CANVAS_GRID_SIZE = 20;
export const SKILL_CANVAS_COL_GAP = 220;
export const SKILL_CANVAS_ROW_GAP = 200;

export function snapToCanvasGrid(value: number): number {
  return Math.round(value / SKILL_CANVAS_GRID_SIZE) * SKILL_CANVAS_GRID_SIZE;
}

export function getNodeUnlockMode(node: PerkNodeModel): PerkUnlockMode {
  return node.rule_hooks?.__unlock_mode === 'all' ? 'all' : 'any';
}

export function getNodeParentIds(
  node: PerkNodeModel,
  validTreeNodes?: PerkNodeModel[]
): string[] {
  if (isStandalonePerkNode(node)) return [];

  const rawList: string[] = [];
  const hookParents = node.rule_hooks?.__parent_ids;
  if (Array.isArray(hookParents)) {
    for (const id of hookParents) {
      if (typeof id === 'string' && id.trim().length > 0) {
        rawList.push(id.trim());
      }
    }
  } else if (
    typeof node.parent_node_id === 'string' &&
    node.parent_node_id.trim().length > 0
  ) {
    rawList.push(node.parent_node_id.trim());
  }

  if (
    hookParents === undefined &&
    typeof node.parent_node_id === 'string' &&
    node.parent_node_id.trim().length > 0 &&
    !rawList.includes(node.parent_node_id.trim())
  ) {
    rawList.unshift(node.parent_node_id.trim());
  }

  let validIds: Set<string> | null = null;
  if (validTreeNodes) {
    validIds = new Set(
      validTreeNodes
        .filter(
          (candidate) =>
            candidate.tree_id === node.tree_id &&
            isCompendiumItemActive(candidate)
        )
        .map((candidate) => candidate.id)
    );
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const id of rawList) {
    if (id === node.id || seen.has(id)) continue;
    if (validIds && !validIds.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  return deduped;
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
    const parents = getNodeParentIds(n, allNodes);
    for (const pid of parents) {
      const list = childrenByParent.get(pid) ?? [];
      list.push(n.id);
      childrenByParent.set(pid, list);
    }
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

export function canConnectPerkRoute(
  sourceId: string,
  targetId: string,
  treeNodes: PerkNodeModel[]
): { allowed: boolean; reason?: 'self' | 'duplicate' | 'cycle' } {
  if (!sourceId || !targetId || sourceId === targetId) {
    return { allowed: false, reason: 'self' };
  }
  const source = treeNodes.find((n) => n.id === sourceId);
  const target = treeNodes.find((n) => n.id === targetId);
  if (!source || !target || source.tree_id !== target.tree_id) {
    return { allowed: false, reason: 'self' };
  }
  const existingParents = getNodeParentIds(target, treeNodes);
  if (existingParents.includes(sourceId)) {
    return { allowed: false, reason: 'duplicate' };
  }
  const targetDescendants = getDescendantNodeIds(targetId, treeNodes);
  if (targetDescendants.has(sourceId)) {
    return { allowed: false, reason: 'cycle' };
  }
  return { allowed: true };
}

export function isPerkNodeReachableForUnlock(
  node: PerkNodeModel,
  unlockedIds: Iterable<string>,
  treeNodes: PerkNodeModel[]
): boolean {
  const parents = getNodeParentIds(node, treeNodes);
  if (parents.length === 0) return true;
  const unlockedSet =
    unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds);
  if (getNodeUnlockMode(node) === 'all') {
    return parents.every((pid) => unlockedSet.has(pid));
  }
  return parents.some((pid) => unlockedSet.has(pid));
}

export function pruneUnreachableUnlockedPerks(
  unlockedIds: string[],
  allNodes: PerkNodeModel[]
): string[] {
  const candidateSet = new Set(unlockedIds);
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const activeByTree = new Map<string, PerkNodeModel[]>();

  for (const n of allNodes) {
    if (!n.tree_id || !isCompendiumItemActive(n)) continue;
    const list = activeByTree.get(n.tree_id) ?? [];
    list.push(n);
    activeByTree.set(n.tree_id, list);
  }

  const reachable = new Set<string>();

  for (const id of candidateSet) {
    const node = nodeById.get(id);
    if (!node || isStandalonePerkNode(node) || !isCompendiumItemActive(node)) {
      reachable.add(id);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of candidateSet) {
      if (reachable.has(id)) continue;
      const node = nodeById.get(id);
      if (!node || !node.tree_id) continue;
      const treeNodes = activeByTree.get(node.tree_id) ?? [];
      if (isPerkNodeReachableForUnlock(node, reachable, treeNodes)) {
        reachable.add(id);
        changed = true;
      }
    }
  }

  return unlockedIds.filter((id) => reachable.has(id));
}

export function computePerkNodeTier(
  treeId: string | null | undefined,
  parentNodeIdOrIds: string | string[] | null | undefined,
  allNodes: PerkNodeModel[]
): number {
  if (!treeId || !parentNodeIdOrIds) return 1;
  const parentIds = Array.isArray(parentNodeIdOrIds)
    ? parentNodeIdOrIds.filter(Boolean)
    : [parentNodeIdOrIds];
  if (parentIds.length === 0) return 1;

  const treeNodes = allNodes.filter(
    (n) => n.tree_id === treeId && isCompendiumItemActive(n)
  );
  const treeById = new Map<string, PerkNodeModel>(
    treeNodes.map((n) => [n.id, n])
  );
  const memo = new Map<string, number>();

  const depthOf = (id: string, visiting: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    const node = treeById.get(id);
    if (!node || visiting.has(id)) return 0;

    const nextVisiting = new Set(visiting);
    nextVisiting.add(id);

    const parents = getNodeParentIds(node, treeNodes);
    let maxParentDepth = 0;
    for (const pid of parents) {
      maxParentDepth = Math.max(maxParentDepth, depthOf(pid, nextVisiting));
    }
    const result = 1 + maxParentDepth;
    memo.set(id, result);
    return result;
  };

  let maxDepth = 0;
  for (const pid of parentIds) {
    maxDepth = Math.max(maxDepth, depthOf(pid, new Set<string>()));
  }

  return Math.max(1, 1 + maxDepth);
}

export function normalizePerkNodesTiers(allNodes: PerkNodeModel[]): PerkNodeModel[] {
  return allNodes.map((node) => {
    if (isStandalonePerkNode(node)) {
      return node.tier === 1 ? node : { ...node, tier: 1 };
    }
    const parents = getNodeParentIds(node, allNodes);
    const computedTier = computePerkNodeTier(node.tree_id, parents, allNodes);
    const primaryParent = parents[0] ?? null;
    if (
      node.tier === computedTier &&
      (node.parent_node_id ?? null) === primaryParent
    ) {
      return node;
    }
    return {
      ...node,
      tier: computedTier,
      parent_node_id: primaryParent,
    };
  });
}

export function hasSavedCanvasPosition(node: PerkNodeModel): boolean {
  const x = node.rule_hooks?.__canvas_x;
  const y = node.rule_hooks?.__canvas_y;
  return (
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y)
  );
}

export function computeAutoGraphPositions(
  treeNodes: PerkNodeModel[]
): Map<string, SkillGraphPoint> {
  const normalized = normalizePerkNodesTiers(treeNodes);
  const byLayer = new Map<number, PerkNodeModel[]>();
  let maxLayer = 1;

  for (const node of normalized) {
    const layer = Math.max(1, node.tier || 1);
    maxLayer = Math.max(maxLayer, layer);
    const list = byLayer.get(layer) ?? [];
    list.push(node);
    byLayer.set(layer, list);
  }

  const positions = new Map<string, SkillGraphPoint>();

  for (let layer = 1; layer <= maxLayer; layer++) {
    const row = byLayer.get(layer);
    if (!row || row.length === 0) continue;

    row.sort((a, b) => {
      const aParents = getNodeParentIds(a, normalized)
        .map((pid) => positions.get(pid)?.x)
        .filter((val): val is number => val !== undefined);
      const bParents = getNodeParentIds(b, normalized)
        .map((pid) => positions.get(pid)?.x)
        .filter((val): val is number => val !== undefined);

      if (aParents.length > 0 && bParents.length > 0) {
        const avgA = aParents.reduce((s, v) => s + v, 0) / aParents.length;
        const avgB = bParents.reduce((s, v) => s + v, 0) / bParents.length;
        if (Math.abs(avgA - avgB) > 1) {
          return avgA - avgB;
        }
      }
      return compareSiblingPerkNodes(a, b);
    });

    const y = (layer - 1) * SKILL_CANVAS_ROW_GAP;
    const count = row.length;
    row.forEach((node, idx) => {
      const x = snapToCanvasGrid((idx - (count - 1) / 2) * SKILL_CANVAS_COL_GAP);
      positions.set(node.id, { x, y });
    });
  }

  return positions;
}

export function resolveSkillGraphLayout(
  treeNodes: PerkNodeModel[]
): Map<string, SkillGraphPoint> {
  const autoMap = computeAutoGraphPositions(treeNodes);
  const resolved = new Map<string, SkillGraphPoint>();
  const occupied: SkillGraphPoint[] = [];

  for (const node of treeNodes) {
    if (hasSavedCanvasPosition(node)) {
      const pt = {
        x: snapToCanvasGrid(node.rule_hooks.__canvas_x!),
        y: snapToCanvasGrid(node.rule_hooks.__canvas_y!),
      };
      resolved.set(node.id, pt);
      occupied.push(pt);
    }
  }

  for (const node of treeNodes) {
    if (resolved.has(node.id)) continue;
    const fallback = autoMap.get(node.id) ?? { x: 0, y: 0 };
    let candidateX = fallback.x;
    const candidateY = fallback.y;
    let step = 1;
    while (
      occupied.some(
        (p) =>
          Math.abs(p.x - candidateX) < 120 && Math.abs(p.y - candidateY) < 120
      )
    ) {
      const offset = Math.ceil(step / 2) * SKILL_CANVAS_COL_GAP;
      candidateX =
        fallback.x + (step % 2 === 1 ? offset : -offset);
      step++;
    }
    const finalPt = { x: snapToCanvasGrid(candidateX), y: snapToCanvasGrid(candidateY) };
    resolved.set(node.id, finalPt);
    occupied.push(finalPt);
  }

  return resolved;
}

export function suggestNewNodeCanvasPosition(
  treeNodes: PerkNodeModel[],
  parentNodeId: string | null
): SkillGraphPoint {
  if (treeNodes.length === 0) {
    return { x: 0, y: 0 };
  }

  const layout = resolveSkillGraphLayout(treeNodes);
  const allPoints = Array.from(layout.values());
  const isOccupied = (x: number, y: number) =>
    allPoints.some((p) => Math.abs(p.x - x) < 130 && Math.abs(p.y - y) < 120);

  if (!parentNodeId || !layout.has(parentNodeId)) {
    const startingPoints = treeNodes
      .filter((n) => getNodeParentIds(n, treeNodes).length === 0)
      .map((n) => layout.get(n.id))
      .filter((p): p is SkillGraphPoint => p !== undefined);

    if (startingPoints.length === 0) {
      const minY = Math.min(...allPoints.map((p) => p.y));
      const maxX = Math.max(...allPoints.map((p) => p.x));
      return {
        x: snapToCanvasGrid(maxX + SKILL_CANVAS_COL_GAP),
        y: snapToCanvasGrid(minY),
      };
    }

    const baseY = snapToCanvasGrid(
      Math.min(...startingPoints.map((p) => p.y))
    );
    let candidateX = snapToCanvasGrid(
      Math.max(...startingPoints.map((p) => p.x)) + SKILL_CANVAS_COL_GAP
    );
    while (isOccupied(candidateX, baseY)) {
      candidateX += SKILL_CANVAS_COL_GAP;
    }
    return { x: candidateX, y: baseY };
  }

  const parentPt = layout.get(parentNodeId)!;
  const targetY = snapToCanvasGrid(parentPt.y + SKILL_CANVAS_ROW_GAP);
  let candidateX = snapToCanvasGrid(parentPt.x);
  let step = 1;
  while (isOccupied(candidateX, targetY)) {
    const offset = Math.ceil(step / 2) * SKILL_CANVAS_COL_GAP;
    candidateX = snapToCanvasGrid(
      parentPt.x + (step % 2 === 1 ? offset : -offset)
    );
    step++;
  }
  return { x: candidateX, y: targetY };
}

export function buildSkillTreeHierarchy(
  treeId: string,
  allNodes: PerkNodeModel[]
): SkillTreeBranchNode[] {
  const treeNodes = allNodes.filter((n) => n.tree_id === treeId);
  const childrenMap = new Map<string, PerkNodeModel[]>();
  const roots: PerkNodeModel[] = [];

  for (const n of treeNodes) {
    const parents = getNodeParentIds(n, treeNodes);
    const primaryParent = parents[0] ?? null;
    if (primaryParent) {
      const list = childrenMap.get(primaryParent) ?? [];
      list.push(n);
      childrenMap.set(primaryParent, list);
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
        const scale = def.unitScale ?? 1;
        rows.push({
          key: def.key,
          numValue: Math.round(num * scale),
          statusValue: 'Sundered',
        });
      }
    }
  }

  return rows;
}

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
        const scale = def.unitScale ?? 1;
        (result as Record<string, number>)[def.key] = num / scale;
      }
    }
  }

  return result;
}

export function isCombatArtUpgradeNode(
  node: Pick<PerkNodeModel, 'node_type' | 'rule_hooks'> | null | undefined
): boolean {
  return Boolean(
    node &&
      node.node_type === 'passive_upgrade' &&
      node.rule_hooks?.__art_upgrade
  );
}

export function getNodeUiKind(
  node: Pick<PerkNodeModel, 'node_type' | 'rule_hooks'> | null | undefined
): PerkNodeUiKind {
  if (!node) return 'combat_art';
  if (node.node_type === 'combat_art') return 'combat_art';
  if (isCombatArtUpgradeNode(node)) return 'combat_art_upgrade';
  return 'passive_upgrade';
}

export const ART_UPGRADE_HOOK_KEYS: EditableRuleHookKey[] = [
  'bonus_flat_damage',
  'bonus_attack_mod',
  'bonus_sp_damage',
  'ignore_armor_dr',
  'push_tiles',
  'self_shift_tiles',
  'inflict_status',
];

export function artUpgradeToHookRows(
  spec: CombatArtUpgradeSpec | undefined | null
): RuleHookRow[] {
  if (!spec) return [];
  const rows: RuleHookRow[] = [];

  const numericMap: [EditableRuleHookKey, number | undefined][] = [
    ['bonus_flat_damage', spec.bonus_flat_damage],
    ['bonus_attack_mod', spec.bonus_attack_mod],
    ['bonus_sp_damage', spec.bonus_sp_damage],
    ['ignore_armor_dr', spec.ignore_armor_dr],
    ['push_tiles', spec.push_tiles],
    ['self_shift_tiles', spec.self_shift_tiles],
  ];

  for (const [key, rawVal] of numericMap) {
    if (rawVal === undefined || rawVal === null) continue;
    const num = Number(rawVal);
    if (!Number.isNaN(num) && num !== 0) {
      const def = RULE_HOOK_DEFINITIONS.find((d) => d.key === key);
      const scale = def?.unitScale ?? 1;
      rows.push({
        key,
        numValue: Math.round(num * scale),
        statusValue: 'Sundered',
      });
    }
  }

  for (const st of spec.inflict_statuses ?? []) {
    if (st) {
      rows.push({
        key: 'inflict_status',
        numValue: 1,
        statusValue: st,
      });
    }
  }

  return rows;
}

export function compileArtUpgradeSpec(input: {
  targetMode: CombatArtUpgradeTargetMode;
  targetArtIds: string[];
  addCombatTags: ActiveCombatTag[];
  apCostDelta: number;
  cooldownDelta: number;
  hookRows: RuleHookRow[];
}): CombatArtUpgradeSpec {
  const uniqueTags = Array.from(new Set(input.addCombatTags));
  const uniqueTargetIds = Array.from(new Set(input.targetArtIds.filter(Boolean)));
  const spec: CombatArtUpgradeSpec = {
    target_mode: input.targetMode,
  };

  if (input.targetMode === 'specific_arts' && uniqueTargetIds.length > 0) {
    spec.target_art_ids = uniqueTargetIds;
  }
  if (uniqueTags.length > 0) {
    spec.add_combat_tags = uniqueTags;
  }
  const apDelta = Number(input.apCostDelta) || 0;
  if (apDelta !== 0) {
    spec.ap_cost_delta = apDelta;
  }
  const cdDelta = Number(input.cooldownDelta) || 0;
  if (cdDelta !== 0) {
    spec.cooldown_delta = cdDelta;
  }

  const statuses: Exclude<CombatStatusEffect, 'None'>[] = [];
  for (const row of input.hookRows) {
    const def = RULE_HOOK_DEFINITIONS.find((d) => d.key === row.key);
    if (!def) continue;
    if (def.valueType === 'status') {
      if (row.statusValue && row.statusValue !== 'None' && !statuses.includes(row.statusValue)) {
        statuses.push(row.statusValue);
      }
      continue;
    }
    const num = Number(row.numValue);
    if (Number.isNaN(num) || num === 0) continue;
    const scaled = num / (def.unitScale ?? 1);
    if (row.key === 'bonus_flat_damage') {
      spec.bonus_flat_damage = (spec.bonus_flat_damage ?? 0) + scaled;
    } else if (row.key === 'bonus_attack_mod') {
      spec.bonus_attack_mod = (spec.bonus_attack_mod ?? 0) + scaled;
    } else if (row.key === 'bonus_sp_damage') {
      spec.bonus_sp_damage = (spec.bonus_sp_damage ?? 0) + scaled;
    } else if (row.key === 'ignore_armor_dr') {
      spec.ignore_armor_dr = (spec.ignore_armor_dr ?? 0) + scaled;
    } else if (row.key === 'push_tiles') {
      spec.push_tiles = (spec.push_tiles ?? 0) + scaled;
    } else if (row.key === 'self_shift_tiles') {
      spec.self_shift_tiles = (spec.self_shift_tiles ?? 0) + scaled;
    }
  }

  if (statuses.length > 0) {
    spec.inflict_statuses = statuses;
  }

  return spec;
}

export function formatArtUpgradeBadges(
  spec: CombatArtUpgradeSpec | undefined | null
): string[] {
  if (!spec) return [];
  const badges: string[] = [];

  for (const tag of spec.add_combat_tags ?? []) {
    badges.push(`Grants ${tag} (${getCombatTagCounterLabel(tag)})`);
  }
  if (spec.ap_cost_delta) {
    badges.push(
      `${spec.ap_cost_delta > 0 ? '+' : ''}${spec.ap_cost_delta} AP Cost`
    );
  }
  if (spec.cooldown_delta) {
    badges.push(
      `${spec.cooldown_delta > 0 ? '+' : ''}${spec.cooldown_delta} Rnd Cooldown`
    );
  }
  if (spec.bonus_attack_mod) {
    badges.push(
      `${spec.bonus_attack_mod > 0 ? '+' : ''}${spec.bonus_attack_mod} Art Attack Roll`
    );
  }
  if (spec.bonus_flat_damage) {
    badges.push(
      `${spec.bonus_flat_damage > 0 ? '+' : ''}${spec.bonus_flat_damage} Art Flat DMG`
    );
  }
  if (spec.bonus_sp_damage) {
    badges.push(`+${spec.bonus_sp_damage} SP DMG`);
  }
  if (spec.ignore_armor_dr) {
    badges.push(`Pierces ${spec.ignore_armor_dr} Armor DR`);
  }
  if (spec.push_tiles) {
    badges.push(`Push ${Math.round(spec.push_tiles * 5)} ft`);
  }
  if (spec.self_shift_tiles) {
    badges.push(`Shift ${Math.round(spec.self_shift_tiles * 5)} ft`);
  }
  for (const st of spec.inflict_statuses ?? []) {
    if (st) {
      badges.push(`Inflicts ${st}`);
    }
  }

  return badges;
}

export function formatRuleHookBadges(hooks: PerkRuleHooks | undefined | null): string[] {
  if (!hooks) return [];
  const badges: string[] = [...formatArtUpgradeBadges(hooks.__art_upgrade)];

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
    badges.push(`Push ${Math.round(hooks.push_tiles * 5)} ft`);
  }
  if (hooks.self_shift_tiles) {
    badges.push(`Shift ${Math.round(hooks.self_shift_tiles * 5)} ft`);
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
    const moveDeltaFeet = Math.round(hooks.bonus_move_tiles * 5);
    badges.push(`${moveDeltaFeet > 0 ? '+' : ''}${moveDeltaFeet} ft Move`);
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

function formatOrList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

export function normalizeWeaponRequirement(
  req: CombatArtWeaponRequirement | undefined | null
): CombatArtWeaponRequirement | undefined {
  if (!req) return undefined;

  const categories = Array.from(
    new Set((req.categories ?? []).map((c) => c.trim()).filter(Boolean))
  );
  const handedness =
    req.handedness === 'one_handed' || req.handedness === 'two_handed'
      ? req.handedness
      : undefined;
  const requiresGuard = Boolean(req.requires_guard_weapon);
  const requiresThrown = Boolean(req.requires_thrown);
  const requiresShield = Boolean(req.requires_shield);
  const weaponIds = Array.from(
    new Set((req.weapon_ids ?? []).map((id) => id.trim()).filter(Boolean))
  );
  const weaponNames = Array.from(
    new Set((req.weapon_names ?? []).map((n) => n.trim()).filter(Boolean))
  );

  if (
    categories.length === 0 &&
    !handedness &&
    !requiresGuard &&
    !requiresThrown &&
    !requiresShield &&
    weaponIds.length === 0
  ) {
    return undefined;
  }

  const normalized: CombatArtWeaponRequirement = {};
  if (categories.length > 0) normalized.categories = categories;
  if (handedness) normalized.handedness = handedness;
  if (requiresGuard) normalized.requires_guard_weapon = true;
  if (requiresThrown) normalized.requires_thrown = true;
  if (requiresShield) normalized.requires_shield = true;
  if (weaponIds.length > 0) {
    normalized.weapon_ids = weaponIds;
    if (weaponNames.length > 0) {
      normalized.weapon_names = weaponNames;
    }
  }

  return normalized;
}

export function hasWeaponRequirement(
  req: CombatArtWeaponRequirement | undefined | null
): boolean {
  return Boolean(normalizeWeaponRequirement(req));
}

export function formatWeaponRequirementLabel(
  req: CombatArtWeaponRequirement | undefined | null,
  weapons?: Pick<WeaponModel, 'id' | 'name'>[]
): string | null {
  const norm = normalizeWeaponRequirement(req);
  if (!norm) return null;

  let specificPart = '';
  if (norm.weapon_ids?.length) {
    let resolvedNames: string[] = [];
    if (weapons?.length) {
      const byId = new Map(weapons.map((w) => [w.id, w.name]));
      resolvedNames = norm.weapon_ids
        .map((id) => byId.get(id))
        .filter((n): n is string => Boolean(n));
    }
    if (resolvedNames.length === 0 && norm.weapon_names?.length) {
      resolvedNames = norm.weapon_names;
    }
    specificPart =
      resolvedNames.length > 0
        ? formatOrList(resolvedNames)
        : 'Specific Weapon';
  }

  const modifiers: string[] = [];
  if (norm.handedness === 'one_handed') modifiers.push('One-Handed');
  if (norm.handedness === 'two_handed') modifiers.push('Two-Handed');
  if (norm.requires_guard_weapon) modifiers.push('Guard');
  if (norm.requires_thrown) modifiers.push('Thrown');
  if (norm.categories?.length) {
    modifiers.push(formatOrList(norm.categories));
  }

  let weaponPart = '';
  if (specificPart && modifiers.length > 0) {
    weaponPart = `${modifiers.join(' ')} Weapon (${specificPart})`;
  } else if (specificPart) {
    weaponPart = specificPart;
  } else if (modifiers.length > 0) {
    weaponPart = `${modifiers.join(' ')} Weapon`;
  }

  if (weaponPart && norm.requires_shield) {
    return `Requires ${weaponPart} + Equipped Shield`;
  }
  if (weaponPart) {
    return `Requires ${weaponPart}`;
  }
  if (norm.requires_shield) {
    return 'Requires Equipped Shield';
  }
  return null;
}

export function evaluateWeaponRequirement(
  req: CombatArtWeaponRequirement | undefined | null,
  activeWeapon: WeaponModel | null | undefined,
  equippedShield: string | null | undefined = 'None',
  weapons?: Pick<WeaponModel, 'id' | 'name'>[]
): WeaponRequirementEvaluation {
  const norm = normalizeWeaponRequirement(req);
  if (!norm) {
    return {
      hasRequirement: false,
      satisfied: true,
      label: null,
      unmetReason: null,
    };
  }

  const label = formatWeaponRequirementLabel(norm, weapons);
  const needsWeapon = Boolean(
    norm.categories?.length ||
      norm.handedness ||
      norm.requires_guard_weapon ||
      norm.requires_thrown ||
      norm.weapon_ids?.length
  );

  let weaponOk = true;
  if (needsWeapon) {
    if (!activeWeapon) {
      weaponOk = false;
    } else {
      if (norm.weapon_ids?.length && !norm.weapon_ids.includes(activeWeapon.id)) {
        weaponOk = false;
      }
      if (
        norm.categories?.length &&
        !norm.categories.some(
          (c) => c.toLowerCase() === (activeWeapon.category ?? '').toLowerCase()
        )
      ) {
        weaponOk = false;
      }
      if (norm.handedness === 'one_handed' && isWeaponTwoHanded(activeWeapon)) {
        weaponOk = false;
      }
      if (norm.handedness === 'two_handed' && !isWeaponTwoHanded(activeWeapon)) {
        weaponOk = false;
      }
      if (norm.requires_guard_weapon && !isWeaponHeavy(activeWeapon)) {
        weaponOk = false;
      }
      if (
        norm.requires_thrown &&
        !(Number(activeWeapon.thrown_range_tiles ?? 0) > 0)
      ) {
        weaponOk = false;
      }
    }
  }

  let shieldOk = true;
  let shieldReason = '';
  if (norm.requires_shield) {
    const hasShield = Boolean(equippedShield && equippedShield !== 'None');
    const stowed = isWeaponTwoHanded(activeWeapon);
    if (!hasShield) {
      shieldOk = false;
      shieldReason = 'No Shield equipped';
    } else if (stowed) {
      shieldOk = false;
      shieldReason = `Shield stowed while wielding ${activeWeapon?.name ?? 'Two-Handed weapon'}`;
    }
  }

  const satisfied = weaponOk && shieldOk;
  let unmetReason: string | null = null;

  if (!satisfied) {
    if (!weaponOk && !activeWeapon) {
      unmetReason = `${label} (Currently Unarmed)`;
    } else if (!shieldOk && shieldReason) {
      unmetReason = `${label} (${shieldReason})`;
    } else if (activeWeapon) {
      unmetReason = `${label} (Active: ${activeWeapon.name} · ${activeWeapon.category})`;
    } else {
      unmetReason = label;
    }
  }

  return {
    hasRequirement: true,
    satisfied,
    label,
    unmetReason,
  };
}
