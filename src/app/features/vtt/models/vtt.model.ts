import {
  ActiveCombatTag,
  AttributeName,
  CombatSkillName,
  CombatStatusEffect,
  PerkNodeModel,
  WeaponModel,
  getHeavyWeaponBlockBase,
  isCombatArtUpgradeNode,
} from '../../../core/compendium/compendium.model';
import {
  ActorInventoryItem,
  CharacterModel,
  CharacterWeaponFormulaSummary,
  DEFAULT_TOKEN_APPEARANCE,
  FIELD_SKILL_LIST,
  FieldSkillName,
  TokenAppearanceConfig,
  TokenFramePresetId,
  TokenShape,
  buildTokenImagePanZoomTransform,
  computeCharacterWeaponFormula,
  getInventoryItemCategory,
  hasCustomTokenAppearance,
  normalizeInventoryItems,
  normalizeTokenAppearance,
  resolveTokenRingColor,
  sanitizeOptionalImageUrl,
} from '../../characters/models/character.model';

export {
  type ActorInventoryItem,
  DEFAULT_TOKEN_APPEARANCE,
  type TokenAppearanceConfig,
  type TokenFramePresetId,
  type TokenShape,
  buildTokenImagePanZoomTransform,
  hasCustomTokenAppearance,
  normalizeInventoryItems,
  normalizeTokenAppearance,
  resolveTokenRingColor,
  sanitizeOptionalImageUrl,
};

export type VttFaction = 'ally' | 'enemy' | 'neutral';

export type VttGridMode = 'square' | 'hex' | 'gridless';

export type VttDirectoryScope = 'maps' | 'characters' | 'npcs' | 'items';

export const DEFAULT_VTT_GRID_WIDTH = 16;
export const DEFAULT_VTT_GRID_HEIGHT = 11;
export const DEFAULT_VTT_GRID_SIZE_PX = 100;
export const DEFAULT_VTT_SCENE_WIDTH_PX = 1600;
export const DEFAULT_VTT_SCENE_HEIGHT_PX = 1100;
export const DEFAULT_VTT_SCENE_PADDING = 0.2;
export const DEFAULT_VTT_GRID_OPACITY = 0.2;
export const DEFAULT_VTT_BG_COLOR = '#0E1917';
export const DEFAULT_VTT_DARKNESS_LEVEL = 0;
export const DEFAULT_VTT_DIM_VISION_FEET = 60;
export const DEFAULT_VTT_DARKVISION_FEET = 10;

export type VttSceneLightingPresetId =
  | 'daylight'
  | 'clear-night'
  | 'woods-dusk'
  | 'heavy-storm'
  | 'pitch-black';

export interface VttSceneLightingPreset {
  id: VttSceneLightingPresetId;
  label: string;
  subtitle: string;
  global_illumination: boolean;
  darkness_level: number;
  ambient_percent: number;
}

export const VTT_SCENE_LIGHTING_PRESETS: VttSceneLightingPreset[] = [
  {
    id: 'daylight',
    label: 'Daylight',
    subtitle: 'Bright · Full LoS',
    global_illumination: true,
    darkness_level: 0,
    ambient_percent: 100,
  },
  {
    id: 'clear-night',
    label: 'Clear Night',
    subtitle: '100% Ambient',
    global_illumination: false,
    darkness_level: 0,
    ambient_percent: 100,
  },
  {
    id: 'woods-dusk',
    label: 'Woods / Dusk',
    subtitle: '50% Ambient',
    global_illumination: false,
    darkness_level: 0.5,
    ambient_percent: 50,
  },
  {
    id: 'heavy-storm',
    label: 'Deep Woods / Storm',
    subtitle: '25% Ambient',
    global_illumination: false,
    darkness_level: 0.75,
    ambient_percent: 25,
  },
  {
    id: 'pitch-black',
    label: 'Pitch Black',
    subtitle: '0% Ambient · Cave',
    global_illumination: false,
    darkness_level: 1,
    ambient_percent: 0,
  },
];

export function resolveActorDarkvisionFeet(
  darkvisionFeet: number | null | undefined,
  npcStats?: VttNpcStats | null
): number {
  if (typeof darkvisionFeet === 'number' && Number.isFinite(darkvisionFeet)) {
    return Math.max(0, Math.round(darkvisionFeet));
  }
  if (
    npcStats &&
    typeof npcStats.__darkvision_feet === 'number' &&
    Number.isFinite(npcStats.__darkvision_feet)
  ) {
    return Math.max(0, Math.round(npcStats.__darkvision_feet));
  }
  return DEFAULT_VTT_DARKVISION_FEET;
}

export function computeEffectiveActorSightFeet(
  dimVisionFeet: number,
  darkvisionFeet: number,
  darknessLevel = 0
): {
  ambientFactor: number;
  ambientPercent: number;
  scaledDimFeet: number;
  darkvisionFeet: number;
  effectiveSightFeet: number;
} {
  const clampedDarkness = Number.isFinite(darknessLevel)
    ? Math.max(0, Math.min(1, darknessLevel))
    : 0;
  const ambientFactor = Math.max(0, Math.min(1, 1 - clampedDarkness));
  const ambientPercent = Math.round(ambientFactor * 100);
  const cleanDim = Math.max(0, Number.isFinite(dimVisionFeet) ? dimVisionFeet : 0);
  const cleanDark = Math.max(
    0,
    Number.isFinite(darkvisionFeet) ? darkvisionFeet : 0
  );
  const scaledDimFeet = Math.round(cleanDim * ambientFactor * 100) / 100;
  const effectiveSightFeet = Math.max(cleanDark, scaledDimFeet);
  return {
    ambientFactor,
    ambientPercent,
    scaledDimFeet,
    darkvisionFeet: cleanDark,
    effectiveSightFeet,
  };
}

export function findMatchingSceneLightingPreset(
  globalIllumination: boolean,
  darknessLevel: number
): VttSceneLightingPresetId | null {
  if (globalIllumination) {
    return 'daylight';
  }
  const clamped = Number.isFinite(darknessLevel)
    ? Math.max(0, Math.min(1, darknessLevel))
    : 0;
  for (const preset of VTT_SCENE_LIGHTING_PRESETS) {
    if (preset.global_illumination) continue;
    if (Math.abs(preset.darkness_level - clamped) < 0.015) {
      return preset.id;
    }
  }
  return null;
}

export interface VttFolderModel {
  id: string;
  campaign_id: string;
  scope: VttDirectoryScope;
  parent_folder_id: string | null;
  name: string;
  color: string | null;
  sort_order: number;
  created_at?: string;
}

export type VttToolMode =
  | 'select'
  | 'pan'
  | 'ruler'
  | 'wall'
  | 'light'
  | 'fog';

export type VttWallKind = 'wall' | 'door' | 'window';

export interface VttPoint {
  x: number;
  y: number;
}

export interface HexCoord {
  col: number;
  row: number;
}

export interface AxialCoord {
  q: number;
  r: number;
}

export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export interface VttWallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: VttWallKind;
  open?: boolean;
}

export interface VttLightSource {
  id: string;
  x: number;
  y: number;
  bright_feet: number;
  dim_feet: number;
  color: string;
  label?: string;
  enabled?: boolean;
}

export interface VttSceneMetaFallback {
  folder_id?: string | null;
  grid_mode?: VttGridMode;
  background_color?: string;
  scene_width?: number | null;
  scene_height?: number | null;
  padding?: number;
  sort_order?: number;
  token_vision?: boolean;
}

export interface VttExploredFog {
  cells?: string[];
  revealed_all?: boolean;
  __scene_meta?: VttSceneMetaFallback;
}

export interface VttNpcStats {
  attack_mod?: number;
  flat_damage?: number;
  attack_ap?: number;
  reach_feet?: number;
  weapon_name?: string;
  combat_tag?: ActiveCombatTag | 'None';
  parry_mod?: number;
  dodge_mod?: number;
  can_dodge?: boolean;
  enables_martial_parry?: boolean;
  attributes?: Partial<Record<AttributeName, number>>;
  combat_skills?: Partial<Record<CombatSkillName, number>>;
  field_skills?: Partial<Record<FieldSkillName, number>>;
  __world_x?: number | null;
  __world_y?: number | null;
  __unsnapped?: boolean;
  __roster_actor_id?: string | null;
  __darkvision_feet?: number;
  __inventory?: ActorInventoryItem[];
  __assigned_user_id?: string | null;
  __flip_x?: boolean;
  __flip_y?: boolean;
  __z_index?: number;
  __rotation?: number;
  __initiative?: number;
  __initiative_mod?: number;
  __in_combat?: boolean;
  __portrait_url?: string | null;
  __token_image_url?: string | null;
  __token_appearance?: TokenAppearanceConfig;
  __token_name?: string | null;
  __custom_token_name?: boolean;
  __standalone_perk_ids?: string[];
  __source_character_id?: string | null;
  __source_preset_id?: string | null;
  __character_sheet?: CharacterModel | null;
}

export function resolveActorTokenDisplayName(
  actor: { name: string; npc_stats?: VttNpcStats | null } | null | undefined,
  fallbackName?: string | null
): string {
  const custom = actor?.npc_stats?.__token_name?.trim();
  if (custom) return custom;
  const actorName = actor?.name?.trim();
  if (actorName) return actorName;
  return fallbackName?.trim() || 'Actor';
}

export const VTT_INITIATION_PHASE_SENTINEL = '__phase1_open__';

export function normalizeNpcAttributes(
  raw?: Partial<Record<AttributeName, number>> | null
): Record<AttributeName, number> {
  return {
    Brawn: Number(raw?.Brawn ?? 0),
    Agility: Number(raw?.Agility ?? 0),
    Technique: Number(raw?.Technique ?? 0),
    Iron: Number(raw?.Iron ?? 0),
    Cunning: Number(raw?.Cunning ?? 0),
  };
}

export function normalizeNpcCombatSkills(
  raw?: Partial<Record<CombatSkillName, number>> | null
): Record<CombatSkillName, number> {
  return {
    Strike: Number(raw?.Strike ?? 0),
    Shoot: Number(raw?.Shoot ?? 0),
    Parry: Number(raw?.Parry ?? 0),
    Dodge: Number(raw?.Dodge ?? 0),
    Block: Number(raw?.Block ?? 0),
  };
}

export function normalizeNpcFieldSkills(
  raw?: Partial<Record<FieldSkillName, number>> | null
): Record<FieldSkillName, number> {
  return {
    Athletics: Number(raw?.Athletics ?? 0),
    Menace: Number(raw?.Menace ?? 0),
    Stealth: Number(raw?.Stealth ?? 0),
    Tinkering: Number(raw?.Tinkering ?? 0),
    Medicine: Number(raw?.Medicine ?? 0),
    Survival: Number(raw?.Survival ?? 0),
    Resolve: Number(raw?.Resolve ?? 0),
    Perception: Number(raw?.Perception ?? 0),
    Sway: Number(raw?.Sway ?? 0),
    Lore: Number(raw?.Lore ?? 0),
  };
}

export function computeNpcFieldSkillTotals(
  stats: VttNpcStats | null | undefined
): Record<
  FieldSkillName,
  { total: number; govAttr: AttributeName; govVal: number; rank: number }
> {
  const attrs = normalizeNpcAttributes(stats?.attributes);
  const ranks = normalizeNpcFieldSkills(stats?.field_skills);
  const totals = {} as Record<
    FieldSkillName,
    { total: number; govAttr: AttributeName; govVal: number; rank: number }
  >;
  for (const fs of FIELD_SKILL_LIST) {
    const valA = attrs[fs.attrA] ?? 0;
    const valB = attrs[fs.attrB] ?? 0;
    const govAttr = valA >= valB ? fs.attrA : fs.attrB;
    const govVal = Math.max(valA, valB);
    const rank = ranks[fs.name] ?? 0;
    totals[fs.name] = {
      total: govVal + rank,
      govAttr,
      govVal,
      rank,
    };
  }
  return totals;
}

export interface ResolvedNpcWeaponStats {
  weaponName: string;
  attackAp: number;
  attackMod: number;
  flatDamage: number;
  reachFeet: number;
  compendiumWeapon: WeaponModel | null;
  inventoryWeapon: ActorInventoryItem | null;
  formula: CharacterWeaponFormulaSummary | null;
}

export function computeNpcWeaponFormula(
  npcStats: VttNpcStats | null | undefined,
  target: WeaponModel | ActorInventoryItem,
  standaloneNodes: PerkNodeModel[] = [],
  allWeapons: WeaponModel[] = []
): CharacterWeaponFormulaSummary {
  return computeCharacterWeaponFormula(
    {
      attributes: normalizeNpcAttributes(npcStats?.attributes),
      combat_skills: normalizeNpcCombatSkills(npcStats?.combat_skills),
    },
    target,
    standaloneNodes,
    allWeapons
  );
}

export function resolveEffectiveNpcWeaponStats(
  npcStats: VttNpcStats | null | undefined,
  standaloneNodes: PerkNodeModel[] = [],
  allWeapons: WeaponModel[] = [],
  defaults: {
    weaponName?: string;
    attackMod?: number;
    flatDamage?: number;
  } = {}
): ResolvedNpcWeaponStats {
  const stats = npcStats ?? {};
  const invWeapons = normalizeInventoryItems(stats.__inventory).filter(
    (it) => getInventoryItemCategory(it) === 'weapon'
  );
  const rawName = (stats.weapon_name ?? '').trim();
  const activeLower = rawName.toLowerCase();

  let inventoryWeapon: ActorInventoryItem | null = null;
  if (invWeapons.some((it) => it.equipped)) {
    inventoryWeapon = invWeapons.find((it) => it.equipped) ?? null;
  } else if (activeLower && activeLower !== 'unarmed') {
    inventoryWeapon =
      invWeapons.find(
        (it) => (it.name ?? '').trim().toLowerCase() === activeLower
      ) ?? null;
  }

  const compendiumWeapon = inventoryWeapon?.compendium_id
    ? (allWeapons.find((w) => w.id === inventoryWeapon.compendium_id) ?? null)
    : activeLower && activeLower !== 'unarmed'
      ? (allWeapons.find(
          (w) => w.name.trim().toLowerCase() === activeLower
        ) ?? null)
      : null;

  const target = inventoryWeapon ?? compendiumWeapon;
  if (target) {
    const formula = computeNpcWeaponFormula(
      stats,
      target,
      standaloneNodes,
      allWeapons
    );
    const reachFeet = compendiumWeapon
      ? Math.max(
          (compendiumWeapon.reach_tiles ?? 1) * 5,
          (compendiumWeapon.thrown_range_tiles ?? 0) * 5,
          5
        )
      : formula.reachFeet;
    return {
      weaponName:
        compendiumWeapon?.name ||
        inventoryWeapon?.name ||
        rawName ||
        defaults.weaponName ||
        'Unarmed',
      attackAp: formula.apCost,
      attackMod: formula.attackMod,
      flatDamage: formula.flatDamage,
      reachFeet,
      compendiumWeapon,
      inventoryWeapon,
      formula,
    };
  }

  return {
    weaponName: rawName || defaults.weaponName || 'Unarmed',
    attackAp: Math.max(1, Number(stats.attack_ap ?? 1)),
    attackMod: Number(stats.attack_mod ?? defaults.attackMod ?? 2),
    flatDamage: Number(stats.flat_damage ?? defaults.flatDamage ?? 3),
    reachFeet: Math.max(5, Number(stats.reach_feet ?? 5)),
    compendiumWeapon: null,
    inventoryWeapon: null,
    formula: null,
  };
}

export function resolveEffectiveNpcDefenseMods(
  npcStats: VttNpcStats | null | undefined,
  standaloneNodes: PerkNodeModel[] = [],
  allWeapons: WeaponModel[] = [],
  defaults: { parryMod?: number; dodgeMod?: number } = {}
): {
  parryMod: number;
  dodgeMod: number;
  enablesMartialParry: boolean;
  heavyWeaponBlockBase: number;
  blockSkillBonus: number;
} {
  const stats = npcStats ?? {};
  const effWep = resolveEffectiveNpcWeaponStats(
    stats,
    standaloneNodes,
    allWeapons
  );
  const enablesMartialParry = Boolean(
    stats.enables_martial_parry ||
      effWep.compendiumWeapon?.rule_hooks?.['enables_martial_parry']
  );
  const heavyWeaponBlockBase = getHeavyWeaponBlockBase(effWep.compendiumWeapon);
  if (stats.attributes || stats.combat_skills) {
    const attrs = normalizeNpcAttributes(stats.attributes);
    const skills = normalizeNpcCombatSkills(stats.combat_skills);
    const rapierBonus = Number(
      effWep.compendiumWeapon?.rule_hooks?.['parry_roll_bonus'] ?? 0
    );
    let perkParry = 0;
    let perkDodge = 0;
    let perkBlock = 0;
    for (const p of standaloneNodes) {
      if (p.node_type === 'passive_upgrade' && !isCombatArtUpgradeNode(p)) {
        perkParry += Number(p.rule_hooks?.bonus_parry_mod ?? 0);
        perkDodge += Number(p.rule_hooks?.bonus_dodge_mod ?? 0);
        perkBlock += Number(p.rule_hooks?.bonus_block_mod ?? 0);
      }
    }
    return {
      parryMod:
        (attrs.Technique ?? 0) + (skills.Parry ?? 0) + rapierBonus + perkParry,
      dodgeMod: (attrs.Agility ?? 0) + (skills.Dodge ?? 0) + perkDodge,
      enablesMartialParry,
      heavyWeaponBlockBase,
      blockSkillBonus: (skills.Block ?? 0) + perkBlock,
    };
  }
  return {
    parryMod: Number(stats.parry_mod ?? defaults.parryMod ?? 1),
    dodgeMod: Number(stats.dodge_mod ?? defaults.dodgeMod ?? 1),
    enablesMartialParry,
    heavyWeaponBlockBase,
    blockSkillBonus: 0,
  };
}

export interface VisualBearingEntity {
  portrait_url?: string | null;
  token_image_url?: string | null;
  token_appearance?: TokenAppearanceConfig | null;
  npc_stats?: VttNpcStats | null;
}

export function resolveEntityPortraitUrl(
  entity: VisualBearingEntity | null | undefined,
  fallbackA?: VisualBearingEntity | null,
  fallbackB?: VisualBearingEntity | null
): string | null {
  return (
    sanitizeOptionalImageUrl(entity?.portrait_url) ??
    sanitizeOptionalImageUrl(entity?.npc_stats?.__portrait_url) ??
    sanitizeOptionalImageUrl(fallbackA?.portrait_url) ??
    sanitizeOptionalImageUrl(fallbackA?.npc_stats?.__portrait_url) ??
    sanitizeOptionalImageUrl(fallbackB?.portrait_url) ??
    sanitizeOptionalImageUrl(fallbackB?.npc_stats?.__portrait_url)
  );
}

export function resolveEntityTokenImageUrl(
  entity: VisualBearingEntity | null | undefined,
  fallbackA?: VisualBearingEntity | null,
  fallbackB?: VisualBearingEntity | null
): string | null {
  return (
    sanitizeOptionalImageUrl(entity?.token_image_url) ??
    sanitizeOptionalImageUrl(entity?.npc_stats?.__token_image_url) ??
    sanitizeOptionalImageUrl(fallbackA?.token_image_url) ??
    sanitizeOptionalImageUrl(fallbackA?.npc_stats?.__token_image_url) ??
    sanitizeOptionalImageUrl(fallbackB?.token_image_url) ??
    sanitizeOptionalImageUrl(fallbackB?.npc_stats?.__token_image_url)
  );
}

export function resolveEntityTokenAppearance(
  entity: VisualBearingEntity | null | undefined,
  fallbackA?: VisualBearingEntity | null,
  fallbackB?: VisualBearingEntity | null
): TokenAppearanceConfig {
  const candidates: (TokenAppearanceConfig | null | undefined)[] = [
    entity?.token_appearance,
    entity?.npc_stats?.__token_appearance,
    fallbackA?.token_appearance,
    fallbackA?.npc_stats?.__token_appearance,
    fallbackB?.token_appearance,
    fallbackB?.npc_stats?.__token_appearance,
  ];
  for (const cand of candidates) {
    if (cand && typeof cand === 'object') {
      const normalized = normalizeTokenAppearance(cand);
      if (hasCustomTokenAppearance(normalized)) {
        return normalized;
      }
    }
  }
  for (const cand of candidates) {
    if (cand && typeof cand === 'object') {
      return normalizeTokenAppearance(cand);
    }
  }
  return { ...DEFAULT_TOKEN_APPEARANCE };
}

export function enrichNpcStatsWithVisuals(
  npcStats: VttNpcStats | null | undefined,
  portraitUrl: string | null | undefined,
  tokenImageUrl: string | null | undefined,
  tokenAppearance: TokenAppearanceConfig | null | undefined
): VttNpcStats {
  return {
    ...(npcStats ?? {}),
    __portrait_url: sanitizeOptionalImageUrl(portraitUrl),
    __token_image_url: sanitizeOptionalImageUrl(tokenImageUrl),
    __token_appearance: normalizeTokenAppearance(tokenAppearance),
  };
}

export function normalizeTokenRotation(
  raw: number | null | undefined
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  const rounded = Math.round(raw);
  return ((rounded % 360) + 360) % 360;
}

export type VttDefenseChoice = 'parry' | 'dodge' | 'block' | 'take_hit';

export interface VttDiceRoll {
  d1: number;
  d2: number;
  d3?: number;
  mode?: 'normal' | 'advantage' | 'disadvantage' | 'manual';
  modifier: number;
  total: number;
}

export interface VttClashResolution {
  reaction: VttDefenseChoice;
  defenseRoll: VttDiceRoll | null;
  hitLanded: boolean;
  flawlessDefense: boolean;
  defenderApSpent: number;
  spDamageToDefender: number;
  hpDamageToDefender: number;
  counterSpToAttacker: number;
  shieldMitigated: number;
  armorMitigated: number;
  defenderGuardRaised?: boolean;
  defenderGuardBroken?: boolean;
  inflictedStatuses: Exclude<CombatStatusEffect, 'None'>[];
  pushFeet: number;
  shiftDefenderFeet: number;
  shiftAttackerFeet: number;
  summary: string;
}

export interface VttPendingClash {
  id: string;
  attackerTokenId: string;
  attackerName: string;
  defenderTokenId: string;
  defenderName: string;
  actionName: string;
  actionKind: 'weapon' | 'combat_art';
  perkId?: string | null;
  apSpent: number;
  cooldownRounds: number;
  distanceFeet: number;
  reachFeet: number;
  combatTags: ActiveCombatTag[];
  disallowedDefenses: ('Parry' | 'Dodge' | 'Block')[];
  attackMod?: number;
  attackRollMode?: 'normal' | 'advantage' | 'disadvantage';
  manualAttackTotal?: number | null;
  attackRoll?: VttDiceRoll | null;
  rawFlatDamage: number;
  bonusSpDamage: number;
  ignoreArmorDr: number;
  defendedSpChip: number;
  pushFeet: number;
  selfShiftFeet: number;
  inflictStatuses: Exclude<CombatStatusEffect, 'None'>[];
  selectedReaction?: VttDefenseChoice;
  resolution?: VttClashResolution;
  createdAt: string;
}

export interface VttSceneModel {
  id: string;
  campaign_id: string | null;
  gm_id: string;
  folder_id: string | null;
  name: string;
  is_active_scene: boolean;
  map_image_url: string | null;
  background_color: string;
  grid_mode: VttGridMode;
  scene_width: number | null;
  scene_height: number | null;
  padding: number;
  grid_width: number;
  grid_height: number;
  grid_size_px: number;
  grid_offset_x: number;
  grid_offset_y: number;
  grid_opacity: number;
  sort_order: number;
  round_number: number;
  combat_active: boolean;
  active_turn_token_id: string | null;
  initiative_order: string[];
  token_vision: boolean;
  fog_enabled: boolean;
  global_illumination: boolean;
  darkness_level: number;
  walls: VttWallSegment[];
  lights: VttLightSource[];
  explored_fog: VttExploredFog;
  pending_clash: VttPendingClash | null;
  token_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface VttTokenModel {
  id: string;
  encounter_id: string;
  character_id: string | null;
  owner_id: string | null;
  name: string;
  faction: VttFaction;
  x: number;
  y: number;
  q: number;
  r: number;
  world_x?: number | null;
  world_y?: number | null;
  size: number;
  icon: string | null;
  color: string | null;
  current_hp: number;
  max_hp: number;
  current_sp: number;
  max_sp: number;
  current_ap: number;
  max_ap: number;
  armor_dr: number;
  shield_block: number;
  move_feet: number;
  vision_feet: number;
  darkvision_feet?: number;
  light_bright_feet: number;
  light_dim_feet: number;
  light_color: string;
  shield_raised: boolean;
  is_hidden: boolean;
  statuses: Exclude<CombatStatusEffect, 'None'>[];
  npc_stats: VttNpcStats;
  portrait_url?: string | null;
  token_image_url?: string | null;
  token_appearance?: TokenAppearanceConfig;
}

export type VttLogKind =
  | 'roll'
  | 'clash'
  | 'damage'
  | 'round'
  | 'chat'
  | 'system';

export interface VttLogEntry {
  id: string;
  campaign_id: string;
  encounter_id: string | null;
  sender_id: string | null;
  sender_name: string;
  kind: VttLogKind;
  title: string;
  detail: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface VttParticipant {
  user_id: string;
  display_name: string;
  handle: string | null;
  role: 'gm' | 'player';
}

export interface VttNpcPreset {
  id: string;
  name: string;
  faction: VttFaction;
  icon: string;
  color: string;
  max_hp: number;
  max_sp: number;
  max_ap: number;
  armor_dr: number;
  shield_block: number;
  move_feet: number;
  vision_feet: number;
  darkvision_feet?: number;
  npc_stats: VttNpcStats;
}

export const VTT_NPC_PRESETS: VttNpcPreset[] = [
  {
    id: 'ashen-raider',
    name: 'Ashen Raider',
    faction: 'enemy',
    icon: 'battleaxe',
    color: '#EF4444',
    max_hp: 7,
    max_sp: 4,
    max_ap: 4,
    armor_dr: 1,
    shield_block: 0,
    move_feet: 20,
    vision_feet: 60,
    darkvision_feet: 10,
    npc_stats: {
      weapon_name: 'Jagged Cleaver',
      attack_ap: 1,
      attack_mod: 3,
      flat_damage: 4,
      reach_feet: 5,
      combat_tag: 'None',
      parry_mod: 2,
      dodge_mod: 2,
      can_dodge: true,
      attributes: { Brawn: 2, Agility: 1, Technique: 1, Iron: 1, Cunning: 0 },
      combat_skills: { Strike: 1, Shoot: 0, Parry: 1, Dodge: 1, Block: 0 },
      field_skills: { Athletics: 1, Menace: 1, Survival: 1, Perception: 1 },
    },
  },
  {
    id: 'iron-shieldbearer',
    name: 'Iron Shieldbearer',
    faction: 'enemy',
    icon: 'bastion-shield',
    color: '#DC2626',
    max_hp: 9,
    max_sp: 6,
    max_ap: 4,
    armor_dr: 2,
    shield_block: 4,
    move_feet: 20,
    vision_feet: 60,
    darkvision_feet: 10,
    npc_stats: {
      weapon_name: 'Broad Spear',
      attack_ap: 1,
      attack_mod: 3,
      flat_damage: 4,
      reach_feet: 10,
      combat_tag: 'Piercing',
      parry_mod: 3,
      dodge_mod: 1,
      can_dodge: true,
      attributes: { Brawn: 1, Agility: 0, Technique: 2, Iron: 2, Cunning: 1 },
      combat_skills: { Strike: 1, Shoot: 0, Parry: 1, Dodge: 1, Block: 2 },
      field_skills: { Athletics: 1, Resolve: 2, Perception: 1 },
    },
  },
  {
    id: 'crossbow-marksman',
    name: 'Arbalest Marksman',
    faction: 'enemy',
    icon: 'bow',
    color: '#F97316',
    max_hp: 6,
    max_sp: 3,
    max_ap: 4,
    armor_dr: 1,
    shield_block: 0,
    move_feet: 20,
    vision_feet: 80,
    darkvision_feet: 10,
    npc_stats: {
      weapon_name: 'Siege Arbalest',
      attack_ap: 2,
      attack_mod: 4,
      flat_damage: 5,
      reach_feet: 60,
      combat_tag: 'Piercing',
      parry_mod: 1,
      dodge_mod: 3,
      can_dodge: true,
      attributes: { Brawn: 0, Agility: 2, Technique: 2, Iron: 1, Cunning: 2 },
      combat_skills: { Strike: 0, Shoot: 2, Parry: 0, Dodge: 1, Block: 0 },
      field_skills: { Stealth: 1, Tinkering: 1, Perception: 2 },
    },
  },
  {
    id: 'veil-stalker',
    name: 'Veil Stalker',
    faction: 'enemy',
    icon: 'twin-daggers',
    color: '#A855F7',
    max_hp: 6,
    max_sp: 4,
    max_ap: 4,
    armor_dr: 1,
    shield_block: 0,
    move_feet: 25,
    vision_feet: 60,
    darkvision_feet: 30,
    npc_stats: {
      weapon_name: 'Curved Stilettos',
      attack_ap: 1,
      attack_mod: 4,
      flat_damage: 4,
      reach_feet: 5,
      combat_tag: 'Sweeping',
      parry_mod: 3,
      dodge_mod: 4,
      can_dodge: true,
      enables_martial_parry: true,
      attributes: { Brawn: 0, Agility: 3, Technique: 2, Iron: 1, Cunning: 2 },
      combat_skills: { Strike: 1, Shoot: 0, Parry: 1, Dodge: 1, Block: 0 },
      field_skills: { Athletics: 1, Stealth: 3, Perception: 2 },
    },
  },
  {
    id: 'oathbreaker-juggernaut',
    name: 'Oathbreaker Juggernaut',
    faction: 'enemy',
    icon: 'warhammer',
    color: '#B91C1C',
    max_hp: 14,
    max_sp: 9,
    max_ap: 4,
    armor_dr: 3,
    shield_block: 3,
    move_feet: 20,
    vision_feet: 60,
    darkvision_feet: 15,
    npc_stats: {
      weapon_name: 'Colossal Maul',
      attack_ap: 2,
      attack_mod: 5,
      flat_damage: 7,
      reach_feet: 5,
      combat_tag: 'Crushing',
      parry_mod: 3,
      dodge_mod: 0,
      can_dodge: false,
      attributes: { Brawn: 3, Agility: 0, Technique: 2, Iron: 3, Cunning: 1 },
      combat_skills: { Strike: 2, Shoot: 0, Parry: 1, Dodge: 0, Block: 2 },
      field_skills: { Athletics: 2, Menace: 3, Resolve: 2 },
    },
  },
];

export type VttActorKind = 'character' | 'npc';

export interface VttRosterActorModel {
  id: string;
  campaign_id: string;
  folder_id: string | null;
  character_id: string | null;
  collection_actor_id: string | null;
  owner_id: string | null;
  actor_kind: VttActorKind;
  is_unique: boolean;
  name: string;
  faction: VttFaction;
  size: number;
  icon: string | null;
  color: string | null;
  max_hp: number;
  max_sp: number;
  max_ap: number;
  armor_dr: number;
  shield_block: number;
  move_feet: number;
  vision_feet: number;
  darkvision_feet?: number;
  light_bright_feet: number;
  light_dim_feet: number;
  light_color: string;
  npc_stats: VttNpcStats;
  portrait_url?: string | null;
  token_image_url?: string | null;
  token_appearance?: TokenAppearanceConfig;
  notes: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionFolderModel {
  id: string;
  owner_id: string;
  parent_folder_id: string | null;
  name: string;
  color: string | null;
  sort_order: number;
  created_at?: string;
}

export interface CollectionActorModel {
  id: string;
  owner_id: string;
  folder_id: string | null;
  source_character_id: string | null;
  actor_kind: VttActorKind;
  is_unique: boolean;
  name: string;
  faction: VttFaction;
  size: number;
  icon: string | null;
  color: string | null;
  max_hp: number;
  max_sp: number;
  max_ap: number;
  armor_dr: number;
  shield_block: number;
  move_feet: number;
  vision_feet: number;
  darkvision_feet?: number;
  light_bright_feet: number;
  light_dim_feet: number;
  light_color: string;
  npc_stats: VttNpcStats;
  portrait_url?: string | null;
  token_image_url?: string | null;
  token_appearance?: TokenAppearanceConfig;
  notes: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface VttRosterDragPayload {
  kind: 'roster-actor' | 'character';
  actorId?: string;
  characterId?: string;
  name: string;
  icon: string | null;
  color: string | null;
  faction: VttFaction;
  isUnique: boolean;
  portraitUrl?: string | null;
  tokenImageUrl?: string | null;
  tokenAppearance?: TokenAppearanceConfig;
}

export const VTT_COMPENDIUM_DRAG_MIME = 'application/x-mot-compendium';

export interface VttCompendiumDragPayload {
  kind:
    | 'compendium-weapon'
    | 'compendium-armor'
    | 'compendium-item'
    | 'compendium-standalone';
  itemId: string;
  name: string;
}

export const VTT_ACTOR_COLOR_SWATCHES: string[] = [
  '#38B29A',
  '#C4491A',
  '#EF4444',
  '#D97706',
  '#0284C7',
  '#8B5CF6',
  '#E11D48',
  '#64748B',
];

export function makeDetachedVttCharacterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `vtt-char-${crypto.randomUUID()}`;
  }
  return `vtt-char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneDetachedVttCharacterSheet(
  source: CharacterModel,
  sheetIdOverride?: string
): CharacterModel {
  const nextId =
    sheetIdOverride && sheetIdOverride.trim().length > 0
      ? sheetIdOverride.trim()
      : makeDetachedVttCharacterId();
  return {
    ...source,
    id: nextId,
    attributes: {
      Brawn: Number(source.attributes?.Brawn ?? 0),
      Agility: Number(source.attributes?.Agility ?? 0),
      Technique: Number(source.attributes?.Technique ?? 0),
      Iron: Number(source.attributes?.Iron ?? 0),
      Cunning: Number(source.attributes?.Cunning ?? 0),
    },
    combat_skills: {
      Strike: Number(source.combat_skills?.Strike ?? 0),
      Shoot: Number(source.combat_skills?.Shoot ?? 0),
      Parry: Number(source.combat_skills?.Parry ?? 0),
      Dodge: Number(source.combat_skills?.Dodge ?? 0),
      Block: Number(source.combat_skills?.Block ?? 0),
    },
    field_skills: {
      Athletics: Number(source.field_skills?.Athletics ?? 0),
      Menace: Number(source.field_skills?.Menace ?? 0),
      Stealth: Number(source.field_skills?.Stealth ?? 0),
      Tinkering: Number(source.field_skills?.Tinkering ?? 0),
      Medicine: Number(source.field_skills?.Medicine ?? 0),
      Survival: Number(source.field_skills?.Survival ?? 0),
      Resolve: Number(source.field_skills?.Resolve ?? 0),
      Perception: Number(source.field_skills?.Perception ?? 0),
      Sway: Number(source.field_skills?.Sway ?? 0),
      Lore: Number(source.field_skills?.Lore ?? 0),
    },
    unlocked_perk_ids: Array.isArray(source.unlocked_perk_ids)
      ? [...source.unlocked_perk_ids]
      : [],
    active_cooldowns: { ...(source.active_cooldowns ?? {}) },
    inventory: normalizeInventoryItems(source.inventory).map((item) => ({
      ...item,
    })),
    notes: typeof source.notes === 'string' ? source.notes : '',
    portrait_url: sanitizeOptionalImageUrl(source.portrait_url),
    token_image_url: sanitizeOptionalImageUrl(source.token_image_url),
    token_appearance: normalizeTokenAppearance(source.token_appearance),
  };
}

export function resolveRosterActorSourceCharacterId(
  actor:
    | Pick<VttRosterActorModel, 'character_id' | 'npc_stats'>
    | null
    | undefined
): string | null {
  if (!actor) return null;
  const fromMeta = actor.npc_stats?.__source_character_id;
  if (typeof fromMeta === 'string' && fromMeta.trim().length > 0) {
    return fromMeta.trim();
  }
  if (typeof actor.character_id === 'string' && actor.character_id.trim().length > 0) {
    return actor.character_id.trim();
  }
  return null;
}

export function parseCharacterIdFromUrlOrInput(
  rawInput: string | null | undefined
): string | null {
  if (typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const routeMatch = trimmed.match(
    /(?:^|\/)characters\/([^/\s?#]+)(?:\/edit)?\/?(?:[?#].*)?$/i
  );
  if (routeMatch && routeMatch[1]) {
    const candidate = decodeURIComponent(routeMatch[1]).trim();
    if (!candidate || candidate.toLowerCase() === 'new') {
      return null;
    }
    return candidate;
  }

  if (
    !trimmed.includes('/') &&
    !trimmed.includes(':') &&
    !/\s/.test(trimmed) &&
    trimmed.toLowerCase() !== 'new'
  ) {
    return trimmed;
  }

  return null;
}

export function cloneDetachedNpcStats(
  stats: VttNpcStats | null | undefined
): VttNpcStats {
  if (!stats || typeof stats !== 'object') return {};
  const next: VttNpcStats = { ...stats };
  if (stats.attributes && typeof stats.attributes === 'object') {
    next.attributes = { ...stats.attributes };
  }
  if (stats.combat_skills && typeof stats.combat_skills === 'object') {
    next.combat_skills = { ...stats.combat_skills };
  }
  if (stats.field_skills && typeof stats.field_skills === 'object') {
    next.field_skills = { ...stats.field_skills };
  }
  if (stats.__inventory !== undefined) {
    next.__inventory = normalizeInventoryItems(stats.__inventory).map((it) => ({
      ...it,
    }));
  }
  if (Array.isArray(stats.__standalone_perk_ids)) {
    next.__standalone_perk_ids = [...stats.__standalone_perk_ids];
  }
  if (stats.__token_appearance && typeof stats.__token_appearance === 'object') {
    next.__token_appearance = normalizeTokenAppearance(stats.__token_appearance);
  }
  if (
    stats.__character_sheet &&
    typeof stats.__character_sheet === 'object' &&
    !Array.isArray(stats.__character_sheet)
  ) {
    next.__character_sheet = cloneDetachedVttCharacterSheet(
      stats.__character_sheet
    );
  }
  return next;
}

export function hasRosterActorExternalSource(
  actor:
    | Pick<VttRosterActorModel, 'character_id' | 'collection_actor_id' | 'npc_stats'>
    | null
    | undefined
): boolean {
  if (!actor) return false;
  if (resolveRosterActorSourceCharacterId(actor)) return true;
  if (
    typeof actor.collection_actor_id === 'string' &&
    actor.collection_actor_id.trim().length > 0
  ) {
    return true;
  }
  const presetId = actor.npc_stats?.__source_preset_id;
  return typeof presetId === 'string' && presetId.trim().length > 0;
}

export function parseCollectionActorIdFromUrlOrInput(
  rawInput: string | null | undefined
): string | null {
  if (typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const queryMatch = trimmed.match(
    /(?:^|\/)collections\/?(?:\?|.*?[?&])(?:actor|actorId|id)=([^&\s#]+)/i
  );
  if (queryMatch && queryMatch[1]) {
    const candidate = decodeURIComponent(queryMatch[1]).trim();
    return candidate || null;
  }

  const pathMatch = trimmed.match(
    /(?:^|\/)collections\/([^/\s?#]+)(?:\/edit)?\/?(?:[?#].*)?$/i
  );
  if (pathMatch && pathMatch[1]) {
    const candidate = decodeURIComponent(pathMatch[1]).trim();
    if (!candidate || candidate.toLowerCase() === 'new') {
      return null;
    }
    return candidate;
  }

  return null;
}
