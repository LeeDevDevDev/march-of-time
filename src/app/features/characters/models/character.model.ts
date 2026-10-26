import {
  AttributeName,
  CombatSkillName,
  CombatStatusEffect,
  CombatTag,
  PerkNodeModel,
  PerkRuleHooks,
  SkillTreeModel,
  WeaponModel,
  formatRuleHookBadges,
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
  formatRuleHookBadges,
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
  { name: 'Iron', summary: 'Max HP (+2/pt), Max SP (+2/pt), Shield Block reinforcement, and grit.' },
  { name: 'Cunning', summary: 'Tactical awareness, Feints, lore, perception, and field craft.' },
];

export const COMBAT_SKILL_LIST: {
  name: CombatSkillName;
  govHint: string;
  summary: string;
}[] = [
  { name: 'Strike', govHint: 'Weapon Attr', summary: 'Added to melee attack rolls (2d10 + Attr + Strike).' },
  { name: 'Shoot', govHint: 'Weapon Attr', summary: 'Added to ranged attack rolls (2d10 + Attr + Shoot).' },
  { name: 'Parry', govHint: 'Technique', summary: 'Deflects attacks (2d10 + Technique + Parry); raises Max SP if >= Dodge.' },
  { name: 'Dodge', govHint: 'Agility', summary: 'Evades attacks & shifts 1 tile (2d10 + Agility + Dodge); raises Max SP if >= Parry.' },
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

export const ARMOR_TIERS: Record<
  ArmorTier,
  { label: string; hpDr: number; speedPenaltyTiles: number; description: string }
> = {
  None: { label: 'Unarmored', hpDr: 0, speedPenaltyTiles: 0, description: '0 HP DR · Full 4-tile mobility' },
  Light: { label: 'Light Armor', hpDr: 1, speedPenaltyTiles: 0, description: '1 HP DR · Full 4-tile mobility' },
  Medium: { label: 'Medium Armor', hpDr: 2, speedPenaltyTiles: 0, description: '2 HP DR · Full 4-tile mobility' },
  Heavy: { label: 'Heavy Armor', hpDr: 4, speedPenaltyTiles: 1, description: '4 HP DR · -1 Tile per Move AP' },
};

export const SHIELD_TIERS: Record<
  ShieldTier,
  { label: string; blockValue: number; speedPenaltyTiles: number; description: string }
> = {
  None: { label: 'No Shield', blockValue: 0, speedPenaltyTiles: 0, description: 'Cannot declare Shield Block' },
  Buckler: { label: 'Buckler', blockValue: 2, speedPenaltyTiles: 0, description: 'Block Reduction: 2 + Iron' },
  Heater: { label: 'Heater Shield', blockValue: 4, speedPenaltyTiles: 0, description: 'Block Reduction: 4 + Iron' },
  Tower: { label: 'Tower Shield', blockValue: 6, speedPenaltyTiles: 1, description: 'Block Reduction: 6 + Iron · -1 Tile Move' },
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
  armorDr: number;
  shieldBlockTotal: number;
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

  const unlockedPerks = perkNodes.filter((p) => char.unlocked_perk_ids.includes(p.id));

  // Aggregate structured passive rule_hooks from unlocked perks
  let perkBonusHp = 0;
  let perkBonusSp = 0;
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
    perkBonusArmorDr += Number(h.bonus_armor_dr ?? 0);
    perkBonusMoveTiles += Number(h.bonus_move_tiles ?? 0);
    perkBonusAttackMod += Number(h.bonus_attack_mod ?? 0);
    perkBonusFlatDmg += Number(h.bonus_flat_damage ?? 0);
    perkBonusParryMod += Number(h.bonus_parry_mod ?? 0);
    perkBonusDodgeMod += Number(h.bonus_dodge_mod ?? 0);
    perkBonusBlockMod += Number(h.bonus_block_mod ?? 0);
  }

  // Formulas from mot-playtest.xlsx + Passive Perk Rule Hooks:
  // Max HP = 5 + (Iron * 2) + Perk Bonuses
  // Max SP = 10 + (Iron * 2) + (MAX(Parry, Dodge) * 2) + Perk Bonuses
  const maxHp = 5 + iron * 2 + perkBonusHp;
  const maxSp = 10 + iron * 2 + Math.max(parry, dodge) * 2 + perkBonusSp;

  const armorSpec = ARMOR_TIERS[char.equipped_armor] ?? ARMOR_TIERS.None;
  const shieldSpec = SHIELD_TIERS[char.equipped_shield] ?? SHIELD_TIERS.None;

  const moveTiles = Math.max(
    1,
    4 - armorSpec.speedPenaltyTiles - shieldSpec.speedPenaltyTiles + perkBonusMoveTiles
  );
  const moveFeet = moveTiles * 5;

  const weaponSlot1 = weapons.find((w) => w.id === char.weapon_slot_1_id) ?? null;
  const weaponSlot2 = weapons.find((w) => w.id === char.weapon_slot_2_id) ?? null;
  const activeWeapon = char.active_weapon_slot === 1 ? weaponSlot1 : weaponSlot2;

  const govAttrVal = activeWeapon ? (char.attributes[activeWeapon.gov_attribute] ?? 0) : brawn;
  const govSkillVal = activeWeapon ? (char.combat_skills[activeWeapon.gov_skill] ?? strike) : strike;

  const attackRollMod = govAttrVal + govSkillVal + perkBonusAttackMod;
  const flatWeaponDamage = (activeWeapon ? activeWeapon.base_damage : 2) + govAttrVal + perkBonusFlatDmg;

  const rapierBonus = Number(activeWeapon?.rule_hooks?.['parry_roll_bonus'] ?? 0);
  const parryMod = technique + parry + rapierBonus + perkBonusParryMod;
  const dodgeMod = agility + dodge + perkBonusDodgeMod;
  const blockMod = iron + parry + perkBonusBlockMod;

  const versatileBonus = Number(
    activeWeapon?.rule_hooks?.['flawless_parry_bonus_sp_damage'] ?? 0
  );
  const flawlessParryCounterSp = 2 + parryMod + versatileBonus;

  const level = Math.max(1, char.level);
  const attributeBudget = 5 + Math.floor((level - 1) / 2);
  const attributeSpent = Object.values(char.attributes).reduce((a, b) => a + b, 0);

  const combatSkillBudget = 2 + Math.floor(level / 2);
  const combatSkillSpent = Object.values(char.combat_skills).reduce((a, b) => a + b, 0);

  const fieldSkillBudget = 4 + Math.floor(level / 2);
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
    armorDr: armorSpec.hpDr + perkBonusArmorDr,
    shieldBlockTotal:
      shieldSpec.blockValue > 0 ? shieldSpec.blockValue + iron + perkBonusBlockMod : 0,
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
