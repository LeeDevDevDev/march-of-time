import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { CharacterModel } from '../../characters/models/character.model';
import { GameCardModel } from '../../dashboard/models/campaign.model';
import { offsetToAxial } from '../engine/hex-grid.engine';
import {
  DEFAULT_VTT_BG_COLOR,
  DEFAULT_VTT_GRID_HEIGHT,
  DEFAULT_VTT_GRID_OPACITY,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_GRID_WIDTH,
  DEFAULT_VTT_SCENE_PADDING,
  VttActorKind,
  VttDirectoryScope,
  VttExploredFog,
  VttFaction,
  VttFolderModel,
  VttGridMode,
  VttLightSource,
  VttLogEntry,
  VttLogKind,
  VttNpcStats,
  VttPendingClash,
  VttRosterActorModel,
  VttSceneMetaFallback,
  VttSceneModel,
  VttTokenModel,
  VttWallSegment,
} from '../models/vtt.model';

export interface VttPingBroadcast {
  x: number;
  y: number;
  senderName: string;
  color: string;
  createdAt: number;
}

function parseOptionalCoord(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function normalizeSceneRow(row: Record<string, unknown>): VttSceneModel {
  const gridWidth = Math.max(
    4,
    Number(row['grid_width'] ?? DEFAULT_VTT_GRID_WIDTH)
  );
  const gridHeight = Math.max(
    4,
    Number(row['grid_height'] ?? DEFAULT_VTT_GRID_HEIGHT)
  );
  const rawFog: VttExploredFog =
    row['explored_fog'] && typeof row['explored_fog'] === 'object'
      ? (row['explored_fog'] as VttExploredFog)
      : {};
  const meta: VttSceneMetaFallback = rawFog.__scene_meta ?? {};

  const rawGridMode = row['grid_mode'] ?? meta.grid_mode;
  const gridMode: VttGridMode =
    rawGridMode === 'gridless' ? 'gridless' : 'square';

  const rawFolderId =
    row['folder_id'] !== undefined ? row['folder_id'] : meta.folder_id;
  const folderId =
    typeof rawFolderId === 'string' && rawFolderId.trim().length > 0
      ? rawFolderId
      : null;

  const rawBg = row['background_color'] ?? meta.background_color;
  const backgroundColor =
    typeof rawBg === 'string' && rawBg.trim().length > 0
      ? rawBg
      : DEFAULT_VTT_BG_COLOR;

  const colSceneWidth = parseOptionalCoord(row['scene_width']);
  const sceneWidth =
    colSceneWidth !== null && colSceneWidth > 0
      ? Math.round(colSceneWidth)
      : parseOptionalCoord(meta.scene_width);

  const colSceneHeight = parseOptionalCoord(row['scene_height']);
  const sceneHeight =
    colSceneHeight !== null && colSceneHeight > 0
      ? Math.round(colSceneHeight)
      : parseOptionalCoord(meta.scene_height);

  const rawPadding =
    row['padding'] !== undefined && row['padding'] !== null
      ? Number(row['padding'])
      : meta.padding !== undefined && meta.padding !== null
        ? Number(meta.padding)
        : DEFAULT_VTT_SCENE_PADDING;
  const padding = Number.isFinite(rawPadding)
    ? Math.max(0, Math.min(1, Number(rawPadding.toFixed(2))))
    : DEFAULT_VTT_SCENE_PADDING;

  const sortOrder = Number(row['sort_order'] ?? meta.sort_order ?? 0) || 0;

  return {
    id: String(row['id'] ?? ''),
    campaign_id: (row['campaign_id'] as string | null) ?? null,
    gm_id: String(row['gm_id'] ?? ''),
    folder_id: folderId,
    name: String(row['name'] ?? 'Untitled Scene'),
    is_active_scene:
      typeof row['is_active_scene'] === 'boolean'
        ? row['is_active_scene']
        : true,
    map_image_url: (row['map_image_url'] as string | null) ?? null,
    background_color: backgroundColor,
    grid_mode: gridMode,
    scene_width: sceneWidth,
    scene_height: sceneHeight,
    padding,
    grid_width: gridWidth,
    grid_height: gridHeight,
    grid_size_px: Math.max(
      20,
      Number(row['grid_size_px'] ?? DEFAULT_VTT_GRID_SIZE_PX)
    ),
    grid_offset_x: Number(row['grid_offset_x'] ?? 0),
    grid_offset_y: Number(row['grid_offset_y'] ?? 0),
    grid_opacity:
      row['grid_opacity'] !== null && row['grid_opacity'] !== undefined
        ? Number(row['grid_opacity'])
        : DEFAULT_VTT_GRID_OPACITY,
    sort_order: sortOrder,
    round_number: Math.max(1, Number(row['round_number'] ?? 1)),
    combat_active: Boolean(row['combat_active'] ?? false),
    active_turn_token_id:
      (row['active_turn_token_id'] as string | null) ?? null,
    initiative_order: Array.isArray(row['initiative_order'])
      ? (row['initiative_order'] as string[])
      : [],
    fog_enabled:
      typeof row['fog_enabled'] === 'boolean' ? row['fog_enabled'] : true,
    global_illumination: Boolean(row['global_illumination'] ?? false),
    darkness_level: Number(row['darkness_level'] ?? 0.85),
    walls: Array.isArray(row['walls'])
      ? (row['walls'] as VttWallSegment[])
      : [],
    lights: Array.isArray(row['lights'])
      ? (row['lights'] as VttLightSource[])
      : [],
    explored_fog: rawFog,
    pending_clash:
      row['pending_clash'] && typeof row['pending_clash'] === 'object'
        ? (row['pending_clash'] as VttPendingClash)
        : null,
    created_at: row['created_at'] as string | undefined,
    updated_at: row['updated_at'] as string | undefined,
  };
}

function normalizeTokenRow(row: Record<string, unknown>): VttTokenModel {
  const x = Number(row['x'] ?? 1);
  const y = Number(row['y'] ?? 1);
  const axial = offsetToAxial(x, y);
  const npcStats: VttNpcStats =
    row['npc_stats'] && typeof row['npc_stats'] === 'object'
      ? (row['npc_stats'] as VttNpcStats)
      : {};
  const colWorldX = parseOptionalCoord(row['world_x']);
  const colWorldY = parseOptionalCoord(row['world_y']);
  const worldX =
    colWorldX !== null ? colWorldX : parseOptionalCoord(npcStats.__world_x);
  const worldY =
    colWorldY !== null ? colWorldY : parseOptionalCoord(npcStats.__world_y);

  return {
    id: String(row['id'] ?? ''),
    encounter_id: String(row['encounter_id'] ?? ''),
    character_id: (row['character_id'] as string | null) ?? null,
    owner_id: (row['owner_id'] as string | null) ?? null,
    name: String(row['name'] ?? 'Combatant'),
    faction:
      row['faction'] === 'enemy' || row['faction'] === 'neutral'
        ? row['faction']
        : 'ally',
    x,
    y,
    q: typeof row['q'] === 'number' ? row['q'] : axial.q,
    r: typeof row['r'] === 'number' ? row['r'] : axial.r,
    world_x: worldX,
    world_y: worldY,
    size: Math.max(1, Number(row['size'] ?? 1)),
    icon: (row['icon'] as string | null) ?? null,
    color: (row['color'] as string | null) ?? null,
    current_hp: Number(row['current_hp'] ?? 5),
    max_hp: Math.max(1, Number(row['max_hp'] ?? 5)),
    current_sp: Number(row['current_sp'] ?? 4),
    max_sp: Math.max(0, Number(row['max_sp'] ?? 4)),
    current_ap: Number(row['current_ap'] ?? 4),
    max_ap: Math.max(1, Number(row['max_ap'] ?? 4)),
    armor_dr: Number(row['armor_dr'] ?? 0),
    shield_block: Number(row['shield_block'] ?? 0),
    move_feet: Math.max(5, Number(row['move_feet'] ?? 20)),
    vision_feet: Math.max(0, Number(row['vision_feet'] ?? 60)),
    light_bright_feet: Math.max(0, Number(row['light_bright_feet'] ?? 0)),
    light_dim_feet: Math.max(0, Number(row['light_dim_feet'] ?? 0)),
    light_color: String(row['light_color'] ?? '#FF9B42'),
    shield_raised: Boolean(row['shield_raised'] ?? false),
    is_hidden: Boolean(row['is_hidden'] ?? false),
    statuses: Array.isArray(row['statuses'])
      ? (row['statuses'] as VttTokenModel['statuses'])
      : [],
    npc_stats: npcStats,
  };
}

function normalizeFolderRow(row: Record<string, unknown>): VttFolderModel {
  const rawScope = row['scope'];
  const scope: VttDirectoryScope =
    rawScope === 'characters' || rawScope === 'npcs' || rawScope === 'items'
      ? rawScope
      : 'maps';
  return {
    id: String(row['id'] ?? ''),
    campaign_id: String(row['campaign_id'] ?? ''),
    scope,
    parent_folder_id: (row['parent_folder_id'] as string | null) ?? null,
    name: String(row['name'] ?? 'Folder'),
    color: (row['color'] as string | null) ?? null,
    sort_order: Number(row['sort_order'] ?? 0) || 0,
    created_at: row['created_at'] as string | undefined,
  };
}

function normalizeLogRow(row: Record<string, unknown>): VttLogEntry {
  return {
    id: String(row['id'] ?? ''),
    campaign_id: String(row['campaign_id'] ?? ''),
    encounter_id: (row['encounter_id'] as string | null) ?? null,
    sender_id: (row['sender_id'] as string | null) ?? null,
    sender_name: String(row['sender_name'] ?? 'System'),
    kind: (row['kind'] as VttLogKind) ?? 'roll',
    title: String(row['title'] ?? ''),
    detail: (row['detail'] as string | null) ?? null,
    payload:
      row['payload'] && typeof row['payload'] === 'object'
        ? (row['payload'] as Record<string, unknown>)
        : {},
    created_at: String(row['created_at'] ?? new Date().toISOString()),
  };
}

function isMissingColumnOrTableError(code?: string, message?: string): boolean {
  if (!code && !message) return false;
  if (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    code === 'PGRST205'
  ) {
    return true;
  }
  const msg = (message ?? '').toLowerCase();
  return (
    msg.includes('column') ||
    msg.includes('schema cache') ||
    msg.includes('vtt_logs') ||
    msg.includes('vtt_folders')
  );
}

function isGridModeCheckConstraintError(
  code?: string,
  message?: string
): boolean {
  if (!code && !message) return false;
  if (code === '23514') return true;
  const msg = (message ?? '').toLowerCase();
  return (
    msg.includes('grid_mode_check') ||
    (msg.includes('violates check constraint') && msg.includes('grid_mode'))
  );
}

function folderStorageKey(campaignId: string): string {
  return `mot-vtt-folders-${campaignId}`;
}

function readLocalFolders(campaignId: string): VttFolderModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(folderStorageKey(campaignId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => normalizeFolderRow(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

function writeLocalFolders(campaignId: string, list: VttFolderModel[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(folderStorageKey(campaignId), JSON.stringify(list));
  } catch {
    return;
  }
}

function normalizeRosterActorRow(
  row: Record<string, unknown>
): VttRosterActorModel {
  const rawKind = String(row['actor_kind'] ?? 'character');
  const actorKind: VttActorKind = rawKind === 'npc' ? 'npc' : 'character';
  const rawFaction = String(row['faction'] ?? 'ally');
  const faction: VttFaction =
    rawFaction === 'enemy' || rawFaction === 'neutral' ? rawFaction : 'ally';

  const rawStats = row['npc_stats'];
  const npcStats: VttNpcStats =
    rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats)
      ? { ...(rawStats as VttNpcStats) }
      : {};

  return {
    id: String(row['id'] ?? ''),
    campaign_id: String(row['campaign_id'] ?? ''),
    folder_id:
      typeof row['folder_id'] === 'string' && row['folder_id'].trim().length > 0
        ? row['folder_id']
        : null,
    character_id:
      typeof row['character_id'] === 'string' &&
      row['character_id'].trim().length > 0
        ? row['character_id']
        : null,
    collection_actor_id:
      typeof row['collection_actor_id'] === 'string' &&
      row['collection_actor_id'].trim().length > 0
        ? row['collection_actor_id']
        : null,
    owner_id:
      typeof row['owner_id'] === 'string' && row['owner_id'].trim().length > 0
        ? row['owner_id']
        : null,
    actor_kind: actorKind,
    is_unique:
      typeof row['is_unique'] === 'boolean'
        ? row['is_unique']
        : actorKind === 'character',
    name: String(row['name'] ?? 'Unnamed Actor'),
    faction,
    size: Math.max(1, Number(row['size'] ?? 1)),
    icon: row['icon'] ? String(row['icon']) : null,
    color: row['color'] ? String(row['color']) : null,
    max_hp: Math.max(1, Number(row['max_hp'] ?? 10)),
    max_sp: Math.max(0, Number(row['max_sp'] ?? 5)),
    max_ap: Math.max(1, Number(row['max_ap'] ?? 4)),
    armor_dr: Math.max(0, Number(row['armor_dr'] ?? 0)),
    shield_block: Math.max(0, Number(row['shield_block'] ?? 0)),
    move_feet: Math.max(0, Number(row['move_feet'] ?? 20)),
    vision_feet: Math.max(0, Number(row['vision_feet'] ?? 60)),
    light_bright_feet: Math.max(0, Number(row['light_bright_feet'] ?? 0)),
    light_dim_feet: Math.max(0, Number(row['light_dim_feet'] ?? 0)),
    light_color: row['light_color'] ? String(row['light_color']) : '#F59E0B',
    npc_stats: npcStats,
    notes: row['notes'] ? String(row['notes']) : '',
    sort_order: Number(row['sort_order'] ?? 0),
    created_at: row['created_at'] ? String(row['created_at']) : undefined,
    updated_at: row['updated_at'] ? String(row['updated_at']) : undefined,
  };
}

function rosterStorageKey(campaignId: string): string {
  return `mot-vtt-roster-${campaignId}`;
}

function readLocalRosterActors(campaignId: string): VttRosterActorModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(rosterStorageKey(campaignId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) =>
      normalizeRosterActorRow(r as Record<string, unknown>)
    );
  } catch {
    return [];
  }
}

function writeLocalRosterActors(
  campaignId: string,
  list: VttRosterActorModel[]
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(rosterStorageKey(campaignId), JSON.stringify(list));
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class VttService {
  private readonly supabase = inject(SupabaseService).client;

  readonly parseSceneRow = normalizeSceneRow;
  readonly parseTokenRow = normalizeTokenRow;
  readonly parseFolderRow = normalizeFolderRow;
  readonly parseRosterActorRow = normalizeRosterActorRow;
  readonly parseLogRow = normalizeLogRow;

  async fetchCampaignById(campaignId: string): Promise<{
    data: GameCardModel | null;
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Campaign not found.',
      };
    }
    return { data: data as GameCardModel, error: null };
  }

  async fetchAllVisibleCharacters(): Promise<CharacterModel[]> {
    const { data } = await this.supabase
      .from('characters')
      .select('*')
      .order('name', { ascending: true });
    return ((data as CharacterModel[]) ?? []).map((c) => ({
      ...c,
      unlocked_perk_ids: c.unlocked_perk_ids ?? [],
      active_cooldowns: c.active_cooldowns ?? {},
    }));
  }

  async fetchCampaignFolders(campaignId: string): Promise<VttFolderModel[]> {
    const { data, error } = await this.supabase
      .from('vtt_folders')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        return readLocalFolders(campaignId);
      }
      return [];
    }

    const rows = (data as Record<string, unknown>[] | null) ?? [];
    return rows.map(normalizeFolderRow);
  }

  async createFolder(
    input: Omit<VttFolderModel, 'id' | 'created_at'>
  ): Promise<{ folder: VttFolderModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('vtt_folders')
      .insert({
        campaign_id: input.campaign_id,
        scope: input.scope,
        parent_folder_id: input.parent_folder_id,
        name: input.name,
        color: input.color,
        sort_order: input.sort_order,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        const localFolder: VttFolderModel = {
          id: `local-folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          campaign_id: input.campaign_id,
          scope: input.scope,
          parent_folder_id: input.parent_folder_id,
          name: input.name,
          color: input.color,
          sort_order: input.sort_order,
          created_at: new Date().toISOString(),
        };
        const existing = readLocalFolders(input.campaign_id);
        writeLocalFolders(input.campaign_id, [...existing, localFolder]);
        return { folder: localFolder, error: null };
      }
      return { folder: null, error: error.message };
    }

    return {
      folder: normalizeFolderRow(data as Record<string, unknown>),
      error: null,
    };
  }

  async updateFolder(
    campaignId: string,
    folderId: string,
    patch: Partial<VttFolderModel>
  ): Promise<string | null> {
    if (folderId.startsWith('local-folder-')) {
      const existing = readLocalFolders(campaignId);
      writeLocalFolders(
        campaignId,
        existing.map((f) => (f.id === folderId ? { ...f, ...patch } : f))
      );
      return null;
    }

    const payload: Record<string, unknown> = { ...patch };
    delete payload['id'];
    delete payload['created_at'];

    const { error } = await this.supabase
      .from('vtt_folders')
      .update(payload)
      .eq('id', folderId);

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        const existing = readLocalFolders(campaignId);
        writeLocalFolders(
          campaignId,
          existing.map((f) => (f.id === folderId ? { ...f, ...patch } : f))
        );
        return null;
      }
      return error.message;
    }
    return null;
  }

  async deleteFolder(campaignId: string, folderId: string): Promise<string | null> {
    if (folderId.startsWith('local-folder-')) {
      const existing = readLocalFolders(campaignId);
      writeLocalFolders(
        campaignId,
        existing.filter((f) => f.id !== folderId)
      );
      return null;
    }

    const { error } = await this.supabase
      .from('vtt_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        const existing = readLocalFolders(campaignId);
        writeLocalFolders(
          campaignId,
          existing.filter((f) => f.id !== folderId)
        );
        return null;
      }
      return error.message;
    }
    return null;
  }

  async fetchCampaignRosterActors(
    campaignId: string
  ): Promise<VttRosterActorModel[]> {
    const { data, error } = await this.supabase
      .from('vtt_roster_actors')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        return readLocalRosterActors(campaignId);
      }
      return readLocalRosterActors(campaignId);
    }

    const rows = (data as Record<string, unknown>[] | null) ?? [];
    const parsed = rows.map(normalizeRosterActorRow);
    writeLocalRosterActors(campaignId, parsed);
    return parsed;
  }

  async createRosterActor(
    input: Omit<VttRosterActorModel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ actor: VttRosterActorModel | null; error: string | null }> {
    const safeFolderId =
      input.folder_id && !input.folder_id.startsWith('local-folder-')
        ? input.folder_id
        : null;

    const { data, error } = await this.supabase
      .from('vtt_roster_actors')
      .insert({
        campaign_id: input.campaign_id,
        folder_id: safeFolderId,
        character_id: input.character_id,
        collection_actor_id: input.collection_actor_id,
        owner_id: input.owner_id,
        actor_kind: input.actor_kind,
        is_unique: input.is_unique,
        name: input.name,
        faction: input.faction,
        size: input.size,
        icon: input.icon,
        color: input.color,
        max_hp: input.max_hp,
        max_sp: input.max_sp,
        max_ap: input.max_ap,
        armor_dr: input.armor_dr,
        shield_block: input.shield_block,
        move_feet: input.move_feet,
        vision_feet: input.vision_feet,
        light_bright_feet: input.light_bright_feet,
        light_dim_feet: input.light_dim_feet,
        light_color: input.light_color,
        npc_stats: input.npc_stats,
        notes: input.notes,
        sort_order: input.sort_order,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        const now = new Date().toISOString();
        const localActor: VttRosterActorModel = {
          ...input,
          id: `local-roster-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          created_at: now,
          updated_at: now,
        };
        const existing = readLocalRosterActors(input.campaign_id);
        writeLocalRosterActors(input.campaign_id, [...existing, localActor]);
        return { actor: localActor, error: null };
      }
      return { actor: null, error: error.message };
    }

    const created = normalizeRosterActorRow(data as Record<string, unknown>);
    const existing = readLocalRosterActors(input.campaign_id);
    writeLocalRosterActors(input.campaign_id, [...existing, created]);
    return { actor: created, error: null };
  }

  async updateRosterActor(
    campaignId: string,
    actorId: string,
    patch: Partial<VttRosterActorModel>
  ): Promise<string | null> {
    if (actorId.startsWith('local-roster-')) {
      const existing = readLocalRosterActors(campaignId);
      writeLocalRosterActors(
        campaignId,
        existing.map((a) => (a.id === actorId ? { ...a, ...patch } : a))
      );
      return null;
    }

    const payload: Record<string, unknown> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };
    delete payload['id'];
    delete payload['created_at'];
    if (
      typeof payload['folder_id'] === 'string' &&
      payload['folder_id'].startsWith('local-folder-')
    ) {
      payload['folder_id'] = null;
    }

    const { error } = await this.supabase
      .from('vtt_roster_actors')
      .update(payload)
      .eq('id', actorId);

    const existing = readLocalRosterActors(campaignId);
    writeLocalRosterActors(
      campaignId,
      existing.map((a) => (a.id === actorId ? { ...a, ...patch } : a))
    );

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        return null;
      }
      return error.message;
    }
    return null;
  }

  async deleteRosterActor(
    campaignId: string,
    actorId: string
  ): Promise<string | null> {
    if (actorId.startsWith('local-roster-')) {
      const existing = readLocalRosterActors(campaignId);
      writeLocalRosterActors(
        campaignId,
        existing.filter((a) => a.id !== actorId)
      );
      return null;
    }

    const { error } = await this.supabase
      .from('vtt_roster_actors')
      .delete()
      .eq('id', actorId);

    const existing = readLocalRosterActors(campaignId);
    writeLocalRosterActors(
      campaignId,
      existing.filter((a) => a.id !== actorId)
    );

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        return null;
      }
      return error.message;
    }
    return null;
  }

  async fetchCampaignScenes(
    campaignId: string,
    gmId: string
  ): Promise<{
    scenes: VttSceneModel[];
    needsMigration: boolean;
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('vtt_encounters')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        const fallback = await this.supabase
          .from('vtt_encounters')
          .select('*')
          .eq('gm_id', gmId)
          .order('created_at', { ascending: true });
        const rows = (fallback.data as Record<string, unknown>[] | null) ?? [];
        return {
          scenes: rows.map((r) => ({
            ...normalizeSceneRow(r),
            campaign_id: campaignId,
          })),
          needsMigration: true,
          error: null,
        };
      }
      return { scenes: [], needsMigration: false, error: error.message };
    }

    const rows = (data as Record<string, unknown>[] | null) ?? [];
    return {
      scenes: rows.map(normalizeSceneRow),
      needsMigration: false,
      error: null,
    };
  }

  async createScene(input: {
    campaign_id: string;
    gm_id: string;
    name: string;
    is_active_scene: boolean;
    folder_id?: string | null;
    grid_mode?: VttGridMode;
    scene_width?: number | null;
    scene_height?: number | null;
    padding?: number;
    grid_width?: number;
    grid_height?: number;
    grid_size_px?: number;
    grid_offset_x?: number;
    grid_offset_y?: number;
    grid_opacity?: number;
    background_color?: string;
    map_image_url?: string | null;
    fog_enabled?: boolean;
    global_illumination?: boolean;
    darkness_level?: number;
    walls?: VttWallSegment[];
    lights?: VttLightSource[];
    sort_order?: number;
  }): Promise<{
    scene: VttSceneModel | null;
    needsMigration: boolean;
    error: string | null;
  }> {
    const gridMode: VttGridMode =
      input.grid_mode === 'gridless' ? 'gridless' : 'square';
    const backgroundColor = input.background_color ?? DEFAULT_VTT_BG_COLOR;
    const sceneWidth = input.scene_width ?? null;
    const sceneHeight = input.scene_height ?? null;
    const padding =
      input.padding !== undefined ? input.padding : DEFAULT_VTT_SCENE_PADDING;
    const rawFolderId = input.folder_id ?? null;
    const dbFolderId =
      rawFolderId && !rawFolderId.startsWith('local-folder-')
        ? rawFolderId
        : null;
    const sortOrder = input.sort_order ?? 0;

    const exploredFogWithMeta: VttExploredFog = {
      cells: [],
      revealed_all: false,
      __scene_meta: {
        folder_id: rawFolderId,
        grid_mode: gridMode,
        background_color: backgroundColor,
        scene_width: sceneWidth,
        scene_height: sceneHeight,
        padding,
        sort_order: sortOrder,
      },
    };

    const tier2Payload = {
      campaign_id: input.campaign_id,
      gm_id: input.gm_id,
      name: input.name,
      is_active_scene: input.is_active_scene,
      map_image_url: input.map_image_url ?? null,
      grid_width: input.grid_width ?? DEFAULT_VTT_GRID_WIDTH,
      grid_height: input.grid_height ?? DEFAULT_VTT_GRID_HEIGHT,
      grid_size_px: input.grid_size_px ?? DEFAULT_VTT_GRID_SIZE_PX,
      grid_offset_x: input.grid_offset_x ?? 0,
      grid_offset_y: input.grid_offset_y ?? 0,
      grid_opacity: input.grid_opacity ?? DEFAULT_VTT_GRID_OPACITY,
      fog_enabled: input.fog_enabled ?? true,
      global_illumination: input.global_illumination ?? false,
      darkness_level: input.darkness_level ?? 0.85,
      walls: input.walls ?? [],
      lights: input.lights ?? [],
      explored_fog: exploredFogWithMeta,
      round_number: 1,
    };

    const fullPayload = {
      ...tier2Payload,
      folder_id: dbFolderId,
      grid_mode: gridMode,
      background_color: backgroundColor,
      scene_width: sceneWidth,
      scene_height: sceneHeight,
      padding,
      sort_order: sortOrder,
    };

    let { data, error } = await this.supabase
      .from('vtt_encounters')
      .insert(fullPayload)
      .select('*')
      .single();

    if (
      error &&
      gridMode === 'square' &&
      isGridModeCheckConstraintError(error.code, error.message)
    ) {
      const retry = await this.supabase
        .from('vtt_encounters')
        .insert({
          ...fullPayload,
          grid_mode: 'hex',
        })
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      const parsed = normalizeSceneRow(data as Record<string, unknown>);
      return {
        scene: {
          ...parsed,
          folder_id: rawFolderId ?? parsed.folder_id,
        },
        needsMigration: false,
        error: null,
      };
    }

    if (error && isMissingColumnOrTableError(error.code, error.message)) {
      const tier2 = await this.supabase
        .from('vtt_encounters')
        .insert(tier2Payload)
        .select('*')
        .single();

      if (!tier2.error && tier2.data) {
        return {
          scene: normalizeSceneRow(tier2.data as Record<string, unknown>),
          needsMigration: false,
          error: null,
        };
      }

      if (
        tier2.error &&
        isMissingColumnOrTableError(tier2.error.code, tier2.error.message)
      ) {
        const legacy = await this.supabase
          .from('vtt_encounters')
          .insert({
            gm_id: input.gm_id,
            name: input.name,
            grid_width: input.grid_width ?? DEFAULT_VTT_GRID_WIDTH,
            grid_height: input.grid_height ?? DEFAULT_VTT_GRID_HEIGHT,
            round_number: 1,
          })
          .select('*')
          .single();

        if (legacy.error || !legacy.data) {
          return {
            scene: null,
            needsMigration: true,
            error: legacy.error?.message ?? 'Unable to create map.',
          };
        }

        const parsedLegacy = normalizeSceneRow(
          legacy.data as Record<string, unknown>
        );
        return {
          scene: {
            ...parsedLegacy,
            campaign_id: input.campaign_id,
            folder_id: rawFolderId,
            grid_mode: gridMode,
            background_color: backgroundColor,
            scene_width: sceneWidth,
            scene_height: sceneHeight,
            padding,
            sort_order: sortOrder,
          },
          needsMigration: true,
          error: null,
        };
      }

      return {
        scene: null,
        needsMigration: false,
        error: tier2.error?.message ?? 'Unable to create map.',
      };
    }

    return {
      scene: null,
      needsMigration: false,
      error: error?.message ?? 'Unable to create map.',
    };
  }

  async updateScene(
    sceneId: string,
    patch: Partial<VttSceneModel>,
    legacyFallback = false,
    existingScene?: VttSceneModel | null
  ): Promise<{ error: string | null; needsMigration: boolean }> {
    const payload: Record<string, unknown> = { ...patch };
    delete payload['id'];
    delete payload['created_at'];

    const touchesMeta =
      patch.folder_id !== undefined ||
      patch.grid_mode !== undefined ||
      patch.background_color !== undefined ||
      patch.scene_width !== undefined ||
      patch.scene_height !== undefined ||
      patch.padding !== undefined ||
      patch.sort_order !== undefined ||
      patch.explored_fog !== undefined;

    if (touchesMeta && existingScene) {
      const baseFog = patch.explored_fog ?? existingScene.explored_fog ?? {};
      const prevMeta = baseFog.__scene_meta ?? {};
      payload['explored_fog'] = {
        ...baseFog,
        __scene_meta: {
          folder_id:
            patch.folder_id !== undefined
              ? patch.folder_id
              : existingScene.folder_id ?? prevMeta.folder_id ?? null,
          grid_mode:
            patch.grid_mode !== undefined
              ? patch.grid_mode
              : existingScene.grid_mode ?? prevMeta.grid_mode ?? 'square',
          background_color:
            patch.background_color !== undefined
              ? patch.background_color
              : existingScene.background_color ??
                prevMeta.background_color ??
                DEFAULT_VTT_BG_COLOR,
          scene_width:
            patch.scene_width !== undefined
              ? patch.scene_width
              : existingScene.scene_width ?? prevMeta.scene_width ?? null,
          scene_height:
            patch.scene_height !== undefined
              ? patch.scene_height
              : existingScene.scene_height ?? prevMeta.scene_height ?? null,
          padding:
            patch.padding !== undefined
              ? patch.padding
              : existingScene.padding ??
                prevMeta.padding ??
                DEFAULT_VTT_SCENE_PADDING,
          sort_order:
            patch.sort_order !== undefined
              ? patch.sort_order
              : existingScene.sort_order ?? prevMeta.sort_order ?? 0,
        },
      };
    }

    if (
      typeof payload['folder_id'] === 'string' &&
      String(payload['folder_id']).startsWith('local-folder-')
    ) {
      payload['folder_id'] = null;
    }

    if (!legacyFallback) {
      payload['updated_at'] = new Date().toISOString();
      let { error } = await this.supabase
        .from('vtt_encounters')
        .update(payload)
        .eq('id', sceneId);

      if (
        error &&
        payload['grid_mode'] === 'square' &&
        isGridModeCheckConstraintError(error.code, error.message)
      ) {
        const retry = await this.supabase
          .from('vtt_encounters')
          .update({
            ...payload,
            grid_mode: 'hex',
          })
          .eq('id', sceneId);
        error = retry.error;
      }

      if (!error) {
        return { error: null, needsMigration: false };
      }
      if (!isMissingColumnOrTableError(error.code, error.message)) {
        return { error: error.message, needsMigration: false };
      }

      const tier2Payload: Record<string, unknown> = { ...payload };
      delete tier2Payload['folder_id'];
      delete tier2Payload['grid_mode'];
      delete tier2Payload['background_color'];
      delete tier2Payload['scene_width'];
      delete tier2Payload['scene_height'];
      delete tier2Payload['padding'];
      delete tier2Payload['sort_order'];

      if (Object.keys(tier2Payload).length > 1) {
        const tier2 = await this.supabase
          .from('vtt_encounters')
          .update(tier2Payload)
          .eq('id', sceneId);
        if (!tier2.error) {
          return { error: null, needsMigration: false };
        }
        if (
          !isMissingColumnOrTableError(tier2.error.code, tier2.error.message)
        ) {
          return { error: tier2.error.message, needsMigration: false };
        }
      }
    }

    const legacyPayload: Record<string, unknown> = {};
    if (patch.name !== undefined) legacyPayload['name'] = patch.name;
    if (patch.grid_width !== undefined)
      legacyPayload['grid_width'] = patch.grid_width;
    if (patch.grid_height !== undefined)
      legacyPayload['grid_height'] = patch.grid_height;
    if (patch.round_number !== undefined)
      legacyPayload['round_number'] = patch.round_number;
    if (patch.pending_clash !== undefined)
      legacyPayload['pending_clash'] = patch.pending_clash;

    if (Object.keys(legacyPayload).length > 0) {
      const { error } = await this.supabase
        .from('vtt_encounters')
        .update(legacyPayload)
        .eq('id', sceneId);
      return { error: error?.message ?? null, needsMigration: true };
    }

    return { error: null, needsMigration: true };
  }

  async deleteScene(sceneId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('vtt_encounters')
      .delete()
      .eq('id', sceneId);
    return error?.message ?? null;
  }

  async fetchSceneTokens(encounterId: string): Promise<VttTokenModel[]> {
    const { data } = await this.supabase
      .from('vtt_tokens')
      .select('*')
      .eq('encounter_id', encounterId);
    const rows = (data as Record<string, unknown>[] | null) ?? [];
    return rows.map(normalizeTokenRow);
  }

  async insertToken(
    input: Omit<VttTokenModel, 'id'> & { id?: string }
  ): Promise<{ token: VttTokenModel | null; error: string | null }> {
    const npcStatsWithWorld: VttNpcStats = {
      ...(input.npc_stats ?? {}),
      __world_x: input.world_x ?? null,
      __world_y: input.world_y ?? null,
    };

    const fullPayload: Record<string, unknown> = {
      ...input,
      npc_stats: npcStatsWithWorld,
    };
    if (!input.id) {
      delete fullPayload['id'];
    }

    const { data, error } = await this.supabase
      .from('vtt_tokens')
      .insert(fullPayload)
      .select('*')
      .single();

    if (!error && data) {
      return {
        token: normalizeTokenRow(data as Record<string, unknown>),
        error: null,
      };
    }

    if (error && isMissingColumnOrTableError(error.code, error.message)) {
      const tier2Payload: Record<string, unknown> = { ...fullPayload };
      delete tier2Payload['world_x'];
      delete tier2Payload['world_y'];

      const tier2 = await this.supabase
        .from('vtt_tokens')
        .insert(tier2Payload)
        .select('*')
        .single();

      if (!tier2.error && tier2.data) {
        return {
          token: normalizeTokenRow(tier2.data as Record<string, unknown>),
          error: null,
        };
      }

      if (
        tier2.error &&
        isMissingColumnOrTableError(tier2.error.code, tier2.error.message)
      ) {
        const legacy = await this.supabase
          .from('vtt_tokens')
          .insert({
            encounter_id: input.encounter_id,
            character_id: input.character_id,
            name: input.name,
            faction: input.faction,
            x: input.x,
            y: input.y,
            current_hp: input.current_hp,
            max_hp: input.max_hp,
            current_sp: input.current_sp,
            max_sp: input.max_sp,
            current_ap: input.current_ap,
            armor_dr: input.armor_dr,
            shield_block: input.shield_block,
          })
          .select('*')
          .single();

        if (legacy.error || !legacy.data) {
          return {
            token: null,
            error: legacy.error?.message ?? 'Unable to spawn token.',
          };
        }
        return {
          token: {
            ...normalizeTokenRow(legacy.data as Record<string, unknown>),
            owner_id: input.owner_id,
            world_x: input.world_x ?? null,
            world_y: input.world_y ?? null,
            icon: input.icon,
            color: input.color,
            move_feet: input.move_feet,
            vision_feet: input.vision_feet,
            npc_stats: npcStatsWithWorld,
          },
          error: null,
        };
      }

      return {
        token: null,
        error: tier2.error?.message ?? 'Unable to spawn token.',
      };
    }

    return {
      token: null,
      error: error?.message ?? 'Unable to spawn token.',
    };
  }

  async updateToken(
    tokenId: string,
    patch: Partial<VttTokenModel>,
    legacyFallback = false,
    existingToken?: VttTokenModel | null
  ): Promise<string | null> {
    const payload: Record<string, unknown> = { ...patch };
    delete payload['id'];

    if (
      (patch.world_x !== undefined || patch.world_y !== undefined) &&
      existingToken
    ) {
      const baseStats = patch.npc_stats ?? existingToken.npc_stats ?? {};
      payload['npc_stats'] = {
        ...baseStats,
        __world_x:
          patch.world_x !== undefined
            ? patch.world_x
            : existingToken.world_x ?? null,
        __world_y:
          patch.world_y !== undefined
            ? patch.world_y
            : existingToken.world_y ?? null,
      };
    }

    if (!legacyFallback) {
      const { error } = await this.supabase
        .from('vtt_tokens')
        .update(payload)
        .eq('id', tokenId);
      if (!error) return null;
      if (!isMissingColumnOrTableError(error.code, error.message)) {
        return error.message;
      }

      const tier2Payload: Record<string, unknown> = { ...payload };
      delete tier2Payload['world_x'];
      delete tier2Payload['world_y'];

      if (Object.keys(tier2Payload).length > 0) {
        const tier2 = await this.supabase
          .from('vtt_tokens')
          .update(tier2Payload)
          .eq('id', tokenId);
        if (!tier2.error) return null;
        if (
          !isMissingColumnOrTableError(tier2.error.code, tier2.error.message)
        ) {
          return tier2.error.message;
        }
      }
    }

    const legacyPayload: Record<string, unknown> = {};
    const legacyKeys: (keyof VttTokenModel)[] = [
      'name',
      'faction',
      'x',
      'y',
      'current_hp',
      'max_hp',
      'current_sp',
      'max_sp',
      'current_ap',
      'armor_dr',
      'shield_block',
    ];
    for (const k of legacyKeys) {
      if (patch[k] !== undefined) {
        legacyPayload[k] = patch[k];
      }
    }
    if (Object.keys(legacyPayload).length > 0) {
      const { error } = await this.supabase
        .from('vtt_tokens')
        .update(legacyPayload)
        .eq('id', tokenId);
      return error?.message ?? null;
    }
    return null;
  }

  async deleteToken(tokenId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('vtt_tokens')
      .delete()
      .eq('id', tokenId);
    return error?.message ?? null;
  }

  async fetchCampaignLogs(
    campaignId: string,
    limit = 60
  ): Promise<VttLogEntry[]> {
    const { data, error } = await this.supabase
      .from('vtt_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return (data as Record<string, unknown>[])
      .map(normalizeLogRow)
      .reverse();
  }

  async insertLog(input: {
    campaign_id: string;
    encounter_id: string | null;
    sender_id: string | null;
    sender_name: string;
    kind: VttLogKind;
    title: string;
    detail?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<VttLogEntry | null> {
    const { data, error } = await this.supabase
      .from('vtt_logs')
      .insert({
        campaign_id: input.campaign_id,
        encounter_id: input.encounter_id,
        sender_id: input.sender_id,
        sender_name: input.sender_name,
        kind: input.kind,
        title: input.title,
        detail: input.detail ?? null,
        payload: input.payload ?? {},
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        campaign_id: input.campaign_id,
        encounter_id: input.encounter_id,
        sender_id: input.sender_id,
        sender_name: input.sender_name,
        kind: input.kind,
        title: input.title,
        detail: input.detail ?? null,
        payload: input.payload ?? {},
        created_at: new Date().toISOString(),
      };
    }

    return normalizeLogRow(data as Record<string, unknown>);
  }

  async clearCampaignLogs(campaignId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('vtt_logs')
      .delete()
      .eq('campaign_id', campaignId);
    return error?.message ?? null;
  }

  async uploadMapImage(
    campaignId: string,
    file: File
  ): Promise<{ url: string | null; error: string | null }> {
    const ext = (file.name.split('.').pop() || 'png')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 36);
    const path = `${campaignId}/${Date.now()}-${safeBase || 'battlemap'}.${ext || 'png'}`;

    const { error: uploadError } = await this.supabase.storage
      .from('vtt-maps')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      return {
        url: null,
        error: `${uploadError.message} (Ensure 0004_vtt.sql has been run in Supabase SQL Editor, or paste an external image URL.)`,
      };
    }

    const { data } = this.supabase.storage.from('vtt-maps').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }

  subscribeToCampaignRealtime(
    campaignId: string,
    handlers: {
      onEncounterUpsert: (scene: VttSceneModel) => void;
      onEncounterDelete: (sceneId: string) => void;
      onFolderUpsert: (folder: VttFolderModel) => void;
      onFolderDelete: (folderId: string) => void;
      onRosterActorUpsert?: (actor: VttRosterActorModel) => void;
      onRosterActorDelete?: (actorId: string) => void;
      onTokenUpsert: (token: VttTokenModel) => void;
      onTokenDelete: (tokenId: string) => void;
      onLogInsert: (entry: VttLogEntry) => void;
      onPing: (ping: VttPingBroadcast) => void;
    }
  ): RealtimeChannel {
    const channel = this.supabase
      .channel(`vtt-room-${campaignId}`, {
        config: { broadcast: { self: true } },
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vtt_encounters' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = String(
              (payload.old as Record<string, unknown>)?.['id'] ?? ''
            );
            if (oldId) handlers.onEncounterDelete(oldId);
            return;
          }
          const parsed = normalizeSceneRow(
            payload.new as Record<string, unknown>
          );
          if (!parsed.campaign_id || parsed.campaign_id === campaignId) {
            handlers.onEncounterUpsert(parsed);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vtt_folders' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = String(
              (payload.old as Record<string, unknown>)?.['id'] ?? ''
            );
            if (oldId) handlers.onFolderDelete(oldId);
            return;
          }
          const parsed = normalizeFolderRow(
            payload.new as Record<string, unknown>
          );
          if (parsed.campaign_id === campaignId) {
            handlers.onFolderUpsert(parsed);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vtt_roster_actors' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = String(
              (payload.old as Record<string, unknown>)?.['id'] ?? ''
            );
            if (oldId) handlers.onRosterActorDelete?.(oldId);
            return;
          }
          const parsed = normalizeRosterActorRow(
            payload.new as Record<string, unknown>
          );
          if (parsed.campaign_id === campaignId) {
            handlers.onRosterActorUpsert?.(parsed);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vtt_tokens' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = String(
              (payload.old as Record<string, unknown>)?.['id'] ?? ''
            );
            if (oldId) handlers.onTokenDelete(oldId);
            return;
          }
          const parsed = normalizeTokenRow(
            payload.new as Record<string, unknown>
          );
          handlers.onTokenUpsert(parsed);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vtt_logs',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          handlers.onLogInsert(
            normalizeLogRow(payload.new as Record<string, unknown>)
          );
        }
      )
      .on('broadcast', { event: 'map_ping' }, (msg) => {
        if (msg['payload']) {
          handlers.onPing(msg['payload'] as VttPingBroadcast);
        }
      })
      .subscribe();

    return channel;
  }

  async sendMapPing(
    channel: RealtimeChannel | null,
    ping: VttPingBroadcast
  ): Promise<void> {
    if (!channel) return;
    await channel.send({
      type: 'broadcast',
      event: 'map_ping',
      payload: ping,
    });
  }

  unsubscribeChannel(channel: RealtimeChannel | null): void {
    if (!channel) return;
    void this.supabase.removeChannel(channel);
  }
}
