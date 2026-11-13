import {
  ActiveCombatTag,
  CombatStatusEffect,
} from '../../../core/compendium/compendium.model';

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
export const DEFAULT_VTT_DARKNESS_LEVEL = 0.85;

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
  light_bright_feet: number;
  light_dim_feet: number;
  light_color: string;
  shield_raised: boolean;
  is_hidden: boolean;
  statuses: Exclude<CombatStatusEffect, 'None'>[];
  npc_stats: VttNpcStats;
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
  light_bright_feet: number;
  light_dim_feet: number;
  light_color: string;
  npc_stats: VttNpcStats;
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
  light_bright_feet: number;
  light_dim_feet: number;
  light_color: string;
  npc_stats: VttNpcStats;
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
