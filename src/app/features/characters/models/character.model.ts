import {
  AttributeName,
  CombatSkillName,
  CombatStatusEffect,
  CombatTag,
  PerkNodeModel,
  PerkRuleHooks,
  SkillTreeModel,
  WeaponModel,
  WeaponPropertyTag,
  formatRuleHookBadges,
  getHeavyWeaponBlockBase,
  getWeaponPropertyTags,
  isStandalonePerkNode,
  isWeaponHeavy,
  isWeaponTwoHanded,
} from '../../../core/compendium/compendium.model';

export {
  type AttributeName,
  type CombatSkillName,
  type CombatStatusEffect,
  type CombatTag,
  type PerkNodeModel,
  type PerkRuleHooks,
  type SkillTreeModel,
  type WeaponModel,
  type WeaponPropertyTag,
  formatRuleHookBadges,
  getHeavyWeaponBlockBase,
  getWeaponPropertyTags,
  isStandalonePerkNode,
  isWeaponHeavy,
  isWeaponTwoHanded,
};

export type FieldSkillName =
  | 'Athletics'
  | 'Menace'
  | 'Stealth'
  | 'Tinkering'
  | 'Medicine'
  | 'Survival'
  | 'Resolve'
  | 'Perception'
  | 'Sway'
  | 'Lore';

export type ArmorTier = 'None' | 'Light' | 'Medium' | 'Heavy';
export type ShieldTier = 'None' | 'Buckler' | 'Heater' | 'Tower';

export const ATTRIBUTE_LIST: {
  name: AttributeName;
  summary: string;
}[] = [
  { name: 'Brawn', summary: 'Heavy weapon impact, grappling force, and raw physical power.' },
  { name: 'Agility', summary: 'Footwork, light blades, Dodge defense, and stealth.' },
  { name: 'Technique', summary: 'Martial precision, Parry timing, ranged aim, and craft.' },
  {
    name: 'Iron',
    summary: 'Max HP (+2/pt), Max SP (+1/pt), Stance Recovery (2 + Iron SP), and physical grit.',
  },
  { name: 'Cunning', summary: 'Tactical awareness, Feints, lore, perception, and field craft.' },
];

export const COMBAT_SKILL_LIST: {
  name: CombatSkillName;
  govHint: string;
  summary: string;
}[] = [
  {
    name: 'Strike',
    govHint: 'Weapon Attr',
    summary: 'Added to melee attack rolls (2d10 + Attr + Strike).',
  },
  {
    name: 'Shoot',
    govHint: 'Weapon Attr',
    summary: 'Added to ranged attack rolls (2d10 + Attr + Shoot).',
  },
  {
    name: 'Parry',
    govHint: 'Technique',
    summary:
      'Deflects attacks (2d10 + Technique + Parry); Buckler enables Martial Parry Flawless Counter.',
  },
  {
    name: 'Dodge',
    govHint: 'Agility',
    summary:
      'Evades attacks & shifts 1 tile (2d10 + Agility + Dodge); disabled by Heavy Armor or Tower Shield.',
  },
  {
    name: 'Block',
    govHint: 'Shield / Heavy Base',
    summary:
      'Added to Raise Shield or Heavy Weapon Block (1 AP): reduces non-Piercing damage by Base + Block.',
  },
];

export const FIELD_SKILL_LIST: {
  name: FieldSkillName;
  attrA: AttributeName;
  attrB: AttributeName;
  summary: string;
}[] = [
  { name: 'Athletics', attrA: 'Brawn', attrB: 'Agility', summary: 'Climbing, leaping, swimming, and sprinting.' },
  { name: 'Menace', attrA: 'Brawn', attrB: 'Iron', summary: 'Coercion, battlefield presence, and intimidation.' },
  { name: 'Stealth', attrA: 'Agility', attrB: 'Cunning', summary: 'Moving unseen, ambushes, and concealment.' },
  { name: 'Tinkering', attrA: 'Technique', attrB: 'Cunning', summary: 'Locks, mechanisms, traps, and siege gear.' },
  { name: 'Medicine', attrA: 'Technique', attrB: 'Cunning', summary: 'Stabilizing wounds, surgery, and poultices.' },
  { name: 'Survival', attrA: 'Iron', attrB: 'Cunning', summary: 'Tracking, foraging, and enduring harsh wilds.' },
  { name: 'Resolve', attrA: 'Iron', attrB: 'Cunning', summary: 'Mental fortitude, resisting panic, and focus.' },
  { name: 'Perception', attrA: 'Technique', attrB: 'Cunning', summary: 'Spotting hidden threats, scouting, and vigilance.' },
  { name: 'Sway', attrA: 'Technique', attrB: 'Cunning', summary: 'Diplomacy, parley, and persuasion.' },
  { name: 'Lore', attrA: 'Technique', attrB: 'Cunning', summary: 'History, tactics, alchemy, and ancient records.' },
];

export interface ArmorTierSpec {
  label: string;
  armorSp: number;
  hpDr: number;
  allowsDodge: boolean;
  speedPenaltyTiles: number;
  scalingTiers: { tier: 1 | 2 | 3; sp: number; dr: number }[];
  description: string;
}

export const ARMOR_TIERS: Record<ArmorTier, ArmorTierSpec> = {
  None: {
    label: 'Unarmored',
    armorSp: 0,
    hpDr: 0,
    allowsDodge: true,
    speedPenaltyTiles: 0,
    scalingTiers: [
      { tier: 1, sp: 0, dr: 0 },
      { tier: 2, sp: 0, dr: 0 },
      { tier: 3, sp: 0, dr: 0 },
    ],
    description: '+0 SP · +0 DR · Full Dodge & mobility',
  },
  Light: {
    label: 'Light Armor',
    armorSp: 2,
    hpDr: 1,
    allowsDodge: true,
    speedPenaltyTiles: 0,
    scalingTiers: [
      { tier: 1, sp: 2, dr: 1 },
      { tier: 2, sp: 4, dr: 2 },
      { tier: 3, sp: 6, dr: 3 },
    ],
    description: '+2 SP (scales +4, +6) · +1 DR (scales +2, +3) · Allows Dodge',
  },
  Medium: {
    label: 'Medium Armor',
    armorSp: 1,
    hpDr: 2,
    allowsDodge: true,
    speedPenaltyTiles: 0,
    scalingTiers: [
      { tier: 1, sp: 1, dr: 2 },
      { tier: 2, sp: 2, dr: 4 },
      { tier: 3, sp: 4, dr: 6 },
    ],
    description: '+1 SP (scales +2, +4) · +2 DR (scales +4, +6) · Allows Dodge',
  },
  Heavy: {
    label: 'Heavy Armor',
    armorSp: 3,
    hpDr: 3,
    allowsDodge: false,
    speedPenaltyTiles: 0,
    scalingTiers: [
      { tier: 1, sp: 3, dr: 3 },
      { tier: 2, sp: 6, dr: 6 },
      { tier: 3, sp: 9, dr: 9 },
    ],
    description: '+3 SP & +3 DR (scales +6/+6, +9/+9) · Trades off Dodge',
  },
};

export interface ShieldTierSpec {
  label: string;
  blockValue: number;
  usesRaiseShield: boolean;
  enablesMartialParry: boolean;
  allowsDodge: boolean;
  speedPenaltyTiles: number;
  description: string;
}

export const SHIELD_TIERS: Record<ShieldTier, ShieldTierSpec> = {
  None: {
    label: 'No Shield',
    blockValue: 0,
    usesRaiseShield: false,
    enablesMartialParry: false,
    allowsDodge: true,
    speedPenaltyTiles: 0,
    description: 'No Raise Shield or Buckler Martial Parry',
  },
  Buckler: {
    label: 'Buckler',
    blockValue: 0,
    usesRaiseShield: false,
    enablesMartialParry: true,
    allowsDodge: true,
    speedPenaltyTiles: 0,
    description:
      'No Raise Shield · Enables Martial Parry (2d10 + Technique + Parry, 1 AP reaction) for Flawless Counter SP DMG',
  },
  Heater: {
    label: 'Medium / Standard Shield',
    blockValue: 3,
    usesRaiseShield: true,
    enablesMartialParry: false,
    allowsDodge: true,
    speedPenaltyTiles: 0,
    description:
      'Raise Shield (1 AP action): Base 3 + Block Skill mitigation against all non-Piercing attacks for the round',
  },
  Tower: {
    label: 'Heavy / Tower Shield',
    blockValue: 5,
    usesRaiseShield: true,
    enablesMartialParry: false,
    allowsDodge: false,
    speedPenaltyTiles: 0,
    description:
      'Raise Shield (1 AP action): Base 5 + Block Skill mitigation (+2 over Standard) · Trades off Dodge',
  },
};

export interface CharacterModel {
  id: string;
  owner_id: string;
  name: string;
  level: number;
  attributes: Record<AttributeName, number>;
  combat_skills: Record<CombatSkillName, number>;
  field_skills: Record<FieldSkillName, number>;
  equipped_armor: ArmorTier;
  equipped_shield: ShieldTier;
  weapon_slot_1_id: string | null;
  weapon_slot_2_id: string | null;
  active_weapon_slot: 1 | 2;
  unlocked_perk_ids: string[];
  current_hp: number;
  current_sp: number;
  current_ap: number;
  active_cooldowns: Record<string, number>;
  created_at?: string;
}

export interface DerivedCharacterStats {
  maxHp: number;
  maxSp: number;
  armorSp: number;
  armorDr: number;
  stanceRecoverySp: number;
  shieldBlockTotal: number;
  usesRaiseShield: boolean;
  enablesMartialParry: boolean;
  canDodge: boolean;
  activeWeaponIsTwoHanded: boolean;
  activeWeaponIsHeavy: boolean;
  shieldDisabledByTwoHanded: boolean;
  canBlockWithHeavyWeapon: boolean;
  blockSourceType: 'shield' | 'heavy_weapon' | 'none';
  blockSourceLabel: string;
  blockBaseValue: number;
  moveTiles: number;
  moveFeet: number;
  attributeBudget: number;
  attributeSpent: number;
  combatSkillBudget: number;
  combatSkillSpent: number;
  fieldSkillBudget: number;
  fieldSkillSpent: number;
  perkBudget: number;
  perkSpent: number;
  weaponSlot1: WeaponModel | null;
  weaponSlot2: WeaponModel | null;
  activeWeapon: WeaponModel | null;
  attackRollMod: number;
  flatWeaponDamage: number;
  parryMod: number;
  dodgeMod: number;
  blockMod: number;
  flawlessParryCounterSp: number;
  unlockedPerks: PerkNodeModel[];
  fieldSkillTotals: Record<
    FieldSkillName,
    { total: number; govAttr: AttributeName; govVal: number; rank: number }
  >;
}

export function computeDerivedStats(
  char: Pick<
    CharacterModel,
    | 'level'
    | 'attributes'
    | 'combat_skills'
    | 'field_skills'
    | 'equipped_armor'
    | 'equipped_shield'
    | 'weapon_slot_1_id'
    | 'weapon_slot_2_id'
    | 'active_weapon_slot'
    | 'unlocked_perk_ids'
  >,
  weapons: WeaponModel[],
  perkNodes: PerkNodeModel[]
): DerivedCharacterStats {
  const brawn = char.attributes.Brawn ?? 0;
  const agility = char.attributes.Agility ?? 0;
  const technique = char.attributes.Technique ?? 0;
  const iron = char.attributes.Iron ?? 0;

  const strike = char.combat_skills.Strike ?? 0;
  const parry = char.combat_skills.Parry ?? 0;
  const dodge = char.combat_skills.Dodge ?? 0;
  const blockSkill = char.combat_skills.Block ?? 0;

  const unlockedPerks = perkNodes.filter((p) => char.unlocked_perk_ids.includes(p.id));

  let perkBonusHp = 0;
  let perkBonusSp = 0;
  let perkBonusStanceRecovery = 0;
  let perkBonusArmorDr = 0;
  let perkBonusMoveTiles = 0;
  let perkBonusAttackMod = 0;
  let perkBonusFlatDmg = 0;
  let perkBonusParryMod = 0;
  let perkBonusDodgeMod = 0;
  let perkBonusBlockMod = 0;

  for (const perk of unlockedPerks) {
    const h = perk.rule_hooks ?? {};
    perkBonusHp += Number(h.bonus_max_hp ?? 0);
    perkBonusSp += Number(h.bonus_max_sp ?? 0);
    perkBonusStanceRecovery += Number(h.bonus_stance_recovery ?? 0);
    perkBonusArmorDr += Number(h.bonus_armor_dr ?? 0);
    perkBonusMoveTiles += Number(h.bonus_move_tiles ?? 0);
    perkBonusAttackMod += Number(h.bonus_attack_mod ?? 0);
    perkBonusFlatDmg += Number(h.bonus_flat_damage ?? 0);
    perkBonusParryMod += Number(h.bonus_parry_mod ?? 0);
    perkBonusDodgeMod += Number(h.bonus_dodge_mod ?? 0);
    perkBonusBlockMod += Number(h.bonus_block_mod ?? 0);
  }

  const weaponSlot1 = weapons.find((w) => w.id === char.weapon_slot_1_id) ?? null;
  const weaponSlot2 = weapons.find((w) => w.id === char.weapon_slot_2_id) ?? null;
  const activeWeapon = char.active_weapon_slot === 1 ? weaponSlot1 : weaponSlot2;

  const activeWeaponIsTwoHanded = isWeaponTwoHanded(activeWeapon);
  const activeWeaponIsHeavy = isWeaponHeavy(activeWeapon);
  const shieldDisabledByTwoHanded = activeWeaponIsTwoHanded && char.equipped_shield !== 'None';

  const armorSpec = ARMOR_TIERS[char.equipped_armor] ?? ARMOR_TIERS.None;
  const effectiveShieldTier: ShieldTier = activeWeaponIsTwoHanded
    ? 'None'
    : char.equipped_shield;
  const shieldSpec = SHIELD_TIERS[effectiveShieldTier] ?? SHIELD_TIERS.None;

  const stanceRecoverySp = 2 + iron + perkBonusStanceRecovery;
  const armorSp = armorSpec.armorSp;
  const maxSp = 2 + iron + armorSp + perkBonusSp;
  const maxHp = 5 + iron * 2 + perkBonusHp;
  const armorDr = armorSpec.hpDr + perkBonusArmorDr;

  const canDodge = armorSpec.allowsDodge && shieldSpec.allowsDodge;
  const enablesMartialParry = shieldSpec.enablesMartialParry;

  const canBlockWithHeavyWeapon = activeWeaponIsHeavy;
  const heavyBlockBase = getHeavyWeaponBlockBase(activeWeapon);

  let blockSourceType: 'shield' | 'heavy_weapon' | 'none' = 'none';
  let blockBaseValue = 0;
  let blockSourceLabel = 'No Shield / Weapon Guard';

  if (shieldSpec.usesRaiseShield && (!activeWeaponIsHeavy || shieldSpec.blockValue >= heavyBlockBase)) {
    blockSourceType = 'shield';
    blockBaseValue = shieldSpec.blockValue;
    blockSourceLabel = shieldSpec.label;
  } else if (activeWeaponIsHeavy) {
    blockSourceType = 'heavy_weapon';
    blockBaseValue = heavyBlockBase;
    blockSourceLabel = activeWeapon ? `${activeWeapon.name} (Guard)` : 'Weapon Guard';
  }

  const usesRaiseShield = blockSourceType !== 'none';

  const moveTiles = Math.max(
    1,
    4 - armorSpec.speedPenaltyTiles - shieldSpec.speedPenaltyTiles + perkBonusMoveTiles
  );
  const moveFeet = moveTiles * 5;

  const govAttrVal = activeWeapon ? (char.attributes[activeWeapon.gov_attribute] ?? 0) : brawn;
  const govSkillVal = activeWeapon ? (char.combat_skills[activeWeapon.gov_skill] ?? strike) : strike;

  const attackRollMod = govAttrVal + govSkillVal + perkBonusAttackMod;
  const flatWeaponDamage = (activeWeapon ? activeWeapon.base_damage : 2) + govAttrVal + perkBonusFlatDmg;

  const rapierBonus = Number(activeWeapon?.rule_hooks?.['parry_roll_bonus'] ?? 0);
  const parryMod = technique + parry + rapierBonus + perkBonusParryMod;
  const dodgeMod = agility + dodge + perkBonusDodgeMod;

  const blockMod = blockSkill + perkBonusBlockMod;
  const shieldBlockTotal = usesRaiseShield
    ? blockBaseValue + blockSkill + perkBonusBlockMod
    : 0;

  const versatileBonus = Number(
    activeWeapon?.rule_hooks?.['flawless_parry_bonus_sp_damage'] ?? 0
  );
  const flawlessParryCounterSp = 2 + parryMod + versatileBonus;

  const level = Math.max(1, char.level);
  const evenLevels = Math.floor(level / 2);

  const attributeBudget = 5 + Math.floor((level - 1) / 2);
  const attributeSpent = Object.values(char.attributes).reduce((a, b) => a + b, 0);

  const combatSkillBudget = 2 + evenLevels * 2;
  const combatSkillSpent = Object.values(char.combat_skills).reduce((a, b) => a + b, 0);

  const fieldSkillBudget = 4 + evenLevels * 2;
  const fieldSkillSpent = Object.values(char.field_skills).reduce((a, b) => a + b, 0);

  const perkBudget = level;
  const perkSpent = unlockedPerks.reduce((sum, p) => sum + (p.perk_cost ?? 1), 0);

  const fieldSkillTotals = {} as Record<
    FieldSkillName,
    { total: number; govAttr: AttributeName; govVal: number; rank: number }
  >;

  for (const fs of FIELD_SKILL_LIST) {
    const valA = char.attributes[fs.attrA] ?? 0;
    const valB = char.attributes[fs.attrB] ?? 0;
    const govAttr = valA >= valB ? fs.attrA : fs.attrB;
    const govVal = Math.max(valA, valB);
    const rank = char.field_skills[fs.name] ?? 0;
    fieldSkillTotals[fs.name] = {
      total: govVal + rank,
      govAttr,
      govVal,
      rank,
    };
  }

  return {
    maxHp,
    maxSp,
    armorSp,
    armorDr,
    stanceRecoverySp,
    shieldBlockTotal,
    usesRaiseShield,
    enablesMartialParry,
    canDodge,
    activeWeaponIsTwoHanded,
    activeWeaponIsHeavy,
    shieldDisabledByTwoHanded,
    canBlockWithHeavyWeapon,
    blockSourceType,
    blockSourceLabel,
    blockBaseValue,
    moveTiles,
    moveFeet,
    attributeBudget,
    attributeSpent,
    combatSkillBudget,
    combatSkillSpent,
    fieldSkillBudget,
    fieldSkillSpent,
    perkBudget,
    perkSpent,
    weaponSlot1,
    weaponSlot2,
    activeWeapon,
    attackRollMod,
    flatWeaponDamage,
    parryMod,
    dodgeMod,
    blockMod,
    flawlessParryCounterSp,
    unlockedPerks,
    fieldSkillTotals,
  };
}
