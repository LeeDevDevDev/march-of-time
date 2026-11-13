import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { CharacterModel } from '../../characters/models/character.model';
import { GameCardModel } from '../../dashboard/models/campaign.model';
import { offsetToAxial } from '../engine/hex-grid.engine';
import {
  VttExploredFog,
  VttLightSource,
  VttLogEntry,
  VttLogKind,
  VttNpcStats,
  VttPendingClash,
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

function normalizeSceneRow(row: Record<string, unknown>): VttSceneModel {
  const gridWidth = Math.max(4, Number(row['grid_width'] ?? 16));
  const gridHeight = Math.max(4, Number(row['grid_height'] ?? 11));
  return {
    id: String(row['id'] ?? ''),
    campaign_id: (row['campaign_id'] as string | null) ?? null,
    gm_id: String(row['gm_id'] ?? ''),
    name: String(row['name'] ?? 'Tactical Skirmish'),
    is_active_scene:
      typeof row['is_active_scene'] === 'boolean'
        ? row['is_active_scene']
        : true,
    map_image_url: (row['map_image_url'] as string | null) ?? null,
    grid_width: gridWidth,
    grid_height: gridHeight,
    grid_size_px: Math.max(28, Number(row['grid_size_px'] ?? 64)),
    grid_offset_x: Number(row['grid_offset_x'] ?? 0),
    grid_offset_y: Number(row['grid_offset_y'] ?? 0),
    grid_opacity: Number(row['grid_opacity'] ?? 0.35),
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
    explored_fog:
      row['explored_fog'] && typeof row['explored_fog'] === 'object'
        ? (row['explored_fog'] as VttExploredFog)
        : {},
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
    npc_stats:
      row['npc_stats'] && typeof row['npc_stats'] === 'object'
        ? (row['npc_stats'] as VttNpcStats)
        : {},
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
    msg.includes('vtt_logs')
  );
}

@Injectable({ providedIn: 'root' })
export class VttService {
  private readonly supabase = inject(SupabaseService).client;

  readonly parseSceneRow = normalizeSceneRow;
  readonly parseTokenRow = normalizeTokenRow;
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
    grid_width?: number;
    grid_height?: number;
    map_image_url?: string | null;
  }): Promise<{
    scene: VttSceneModel | null;
    needsMigration: boolean;
    error: string | null;
  }> {
    const fullPayload = {
      campaign_id: input.campaign_id,
      gm_id: input.gm_id,
      name: input.name,
      is_active_scene: input.is_active_scene,
      map_image_url: input.map_image_url ?? null,
      grid_width: input.grid_width ?? 16,
      grid_height: input.grid_height ?? 11,
      grid_size_px: 64,
      fog_enabled: true,
      global_illumination: false,
      darkness_level: 0.85,
      round_number: 1,
    };

    const { data, error } = await this.supabase
      .from('vtt_encounters')
      .insert(fullPayload)
      .select('*')
      .single();

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
        const legacy = await this.supabase
          .from('vtt_encounters')
          .insert({
            gm_id: input.gm_id,
            name: input.name,
            grid_width: input.grid_width ?? 16,
            grid_height: input.grid_height ?? 11,
            round_number: 1,
          })
          .select('*')
          .single();

        if (legacy.error || !legacy.data) {
          return {
            scene: null,
            needsMigration: true,
            error: legacy.error?.message ?? 'Unable to create scene.',
          };
        }
        return {
          scene: {
            ...normalizeSceneRow(legacy.data as Record<string, unknown>),
            campaign_id: input.campaign_id,
          },
          needsMigration: true,
          error: null,
        };
      }
      return { scene: null, needsMigration: false, error: error.message };
    }

    return {
      scene: normalizeSceneRow(data as Record<string, unknown>),
      needsMigration: false,
      error: null,
    };
  }

  async updateScene(
    sceneId: string,
    patch: Partial<VttSceneModel>,
    legacyFallback = false
  ): Promise<{ error: string | null; needsMigration: boolean }> {
    const payload: Record<string, unknown> = { ...patch };
    delete payload['id'];
    delete payload['created_at'];

    if (!legacyFallback) {
      payload['updated_at'] = new Date().toISOString();
      const { error } = await this.supabase
        .from('vtt_encounters')
        .update(payload)
        .eq('id', sceneId);

      if (!error) {
        return { error: null, needsMigration: false };
      }
      if (!isMissingColumnOrTableError(error.code, error.message)) {
        return { error: error.message, needsMigration: false };
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
    input: Omit<VttTokenModel, 'id'>
  ): Promise<{ token: VttTokenModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('vtt_tokens')
      .insert(input)
      .select('*')
      .single();

    if (error) {
      if (isMissingColumnOrTableError(error.code, error.message)) {
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
            icon: input.icon,
            color: input.color,
            move_feet: input.move_feet,
            vision_feet: input.vision_feet,
            npc_stats: input.npc_stats,
          },
          error: null,
        };
      }
      return { token: null, error: error.message };
    }

    return {
      token: normalizeTokenRow(data as Record<string, unknown>),
      error: null,
    };
  }

  async updateToken(
    tokenId: string,
    patch: Partial<VttTokenModel>,
    legacyFallback = false
  ): Promise<string | null> {
    const payload: Record<string, unknown> = { ...patch };
    delete payload['id'];

    if (!legacyFallback) {
      const { error } = await this.supabase
        .from('vtt_tokens')
        .update(payload)
        .eq('id', tokenId);
      if (!error) return null;
      if (!isMissingColumnOrTableError(error.code, error.message)) {
        return error.message;
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
