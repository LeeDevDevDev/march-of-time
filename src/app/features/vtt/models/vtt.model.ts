import {
  ActiveCombatTag,
  CombatStatusEffect,
} from '../../../core/compendium/compendium.model';
import {
  ActorInventoryItem,
  DEFAULT_TOKEN_APPEARANCE,
  TokenAppearanceConfig,
  TokenFramePresetId,
  TokenShape,
  buildTokenImagePanZoomTransform,
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
  __portrait_url?: string | null;
  __token_image_url?: string | null;
  __token_appearance?: TokenAppearanceConfig;
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

export type VttDefenseChoice = 'parry' | 'dodge' | 'take_hit';

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
  attackRoll: VttDiceRoll;
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
