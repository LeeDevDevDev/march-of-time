import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  CollectionActorModel,
  CollectionFolderModel,
  DEFAULT_VTT_DIM_VISION_FEET,
  VttActorKind,
  VttFaction,
  VttNpcStats,
  resolveActorDarkvisionFeet,
} from '../vtt/models/vtt.model';

function isMissingTableOrColumnError(code?: string, message?: string): boolean {
  const c = (code ?? '').toUpperCase();
  const m = (message ?? '').toLowerCase();
  return (
    c === '42703' ||
    c === '42883' ||
    c === '42P01' ||
    c === 'PGRST202' ||
    c === 'PGRST204' ||
    c === 'PGRST205' ||
    m.includes('schema cache') ||
    m.includes('could not find the function') ||
    (m.includes('column') && m.includes('does not exist')) ||
    (m.includes('function') && m.includes('does not exist')) ||
    (m.includes('relation') && m.includes('does not exist')) ||
    m.includes('could not find the table')
  );
}

function getLocalFoldersKey(ownerId: string): string {
  return `mot-col-folders-${ownerId}`;
}

function getLocalActorsKey(ownerId: string): string {
  return `mot-col-actors-${ownerId}`;
}

function readLocalFolders(ownerId: string): CollectionFolderModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalFoldersKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CollectionFolderModel[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFolders(
  ownerId: string,
  folders: CollectionFolderModel[]
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalFoldersKey(ownerId), JSON.stringify(folders));
  } catch {
    return;
  }
}

function readLocalActors(ownerId: string): CollectionActorModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalActorsKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CollectionActorModel[]) : [];
  } catch {
    return [];
  }
}

function writeLocalActors(
  ownerId: string,
  actors: CollectionActorModel[]
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalActorsKey(ownerId), JSON.stringify(actors));
  } catch {
    return;
  }
}

export function parseCollectionFolderRow(
  raw: Record<string, unknown>
): CollectionFolderModel {
  return {
    id: String(raw['id'] ?? ''),
    owner_id: String(raw['owner_id'] ?? ''),
    parent_folder_id: raw['parent_folder_id']
      ? String(raw['parent_folder_id'])
      : null,
    name: String(raw['name'] ?? 'Folder'),
    color: raw['color'] ? String(raw['color']) : null,
    sort_order: Number(raw['sort_order'] ?? 0),
    created_at: raw['created_at'] ? String(raw['created_at']) : undefined,
  };
}

export function parseCollectionActorRow(
  raw: Record<string, unknown>
): CollectionActorModel {
  const rawKind = String(raw['actor_kind'] ?? 'character');
  const actorKind: VttActorKind = rawKind === 'npc' ? 'npc' : 'character';
  const rawFaction = String(raw['faction'] ?? 'ally');
  const faction: VttFaction =
    rawFaction === 'enemy' || rawFaction === 'neutral' ? rawFaction : 'ally';

  const rawStats = raw['npc_stats'];
  const npcStats: VttNpcStats =
    rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats)
      ? { ...(rawStats as VttNpcStats) }
      : {};

  return {
    id: String(raw['id'] ?? ''),
    owner_id: String(raw['owner_id'] ?? ''),
    folder_id: raw['folder_id'] ? String(raw['folder_id']) : null,
    source_character_id: raw['source_character_id']
      ? String(raw['source_character_id'])
      : null,
    actor_kind: actorKind,
    is_unique:
      typeof raw['is_unique'] === 'boolean'
        ? raw['is_unique']
        : actorKind === 'character',
    name: String(raw['name'] ?? 'Unnamed Actor'),
    faction,
    size: Math.max(1, Number(raw['size'] ?? 1)),
    icon: raw['icon'] ? String(raw['icon']) : null,
    color: raw['color'] ? String(raw['color']) : null,
    max_hp: Math.max(1, Number(raw['max_hp'] ?? 10)),
    max_sp: Math.max(0, Number(raw['max_sp'] ?? 5)),
    max_ap: Math.max(1, Number(raw['max_ap'] ?? 4)),
    armor_dr: Math.max(0, Number(raw['armor_dr'] ?? 0)),
    shield_block: Math.max(0, Number(raw['shield_block'] ?? 0)),
    move_feet: Math.max(0, Number(raw['move_feet'] ?? 20)),
    vision_feet: Math.max(
      0,
      Number(raw['vision_feet'] ?? DEFAULT_VTT_DIM_VISION_FEET)
    ),
    darkvision_feet: resolveActorDarkvisionFeet(
      raw['darkvision_feet'] !== null && raw['darkvision_feet'] !== undefined
        ? Number(raw['darkvision_feet'])
        : undefined,
      npcStats
    ),
    light_bright_feet: Math.max(0, Number(raw['light_bright_feet'] ?? 0)),
    light_dim_feet: Math.max(0, Number(raw['light_dim_feet'] ?? 0)),
    light_color: raw['light_color'] ? String(raw['light_color']) : '#F59E0B',
    npc_stats: npcStats,
    notes: raw['notes'] ? String(raw['notes']) : '',
    sort_order: Number(raw['sort_order'] ?? 0),
    created_at: raw['created_at'] ? String(raw['created_at']) : undefined,
    updated_at: raw['updated_at'] ? String(raw['updated_at']) : undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly supabase = inject(SupabaseService).client;

  async fetchCollectionsBundle(ownerId: string): Promise<{
    folders: CollectionFolderModel[];
    actors: CollectionActorModel[];
    fallback: boolean;
    error: string | null;
  }> {
    const { data, error } = await this.supabase.rpc('get_collections_bundle');

    if (!error && data && typeof data === 'object') {
      const raw = data as {
        folders?: Record<string, unknown>[];
        actors?: Record<string, unknown>[];
      };
      const folders = (Array.isArray(raw.folders) ? raw.folders : []).map(
        parseCollectionFolderRow
      );
      const actors = (Array.isArray(raw.actors) ? raw.actors : []).map(
        parseCollectionActorRow
      );
      writeLocalFolders(ownerId, folders);
      writeLocalActors(ownerId, actors);
      return { folders, actors, fallback: false, error: null };
    }

    if (error && isMissingTableOrColumnError(error.code, error.message)) {
      return { folders: [], actors: [], fallback: true, error: null };
    }

    return {
      folders: readLocalFolders(ownerId),
      actors: readLocalActors(ownerId),
      fallback: false,
      error: error?.message ?? null,
    };
  }

  async fetchFolders(ownerId: string): Promise<{
    folders: CollectionFolderModel[];
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('collection_folders')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        return { folders: readLocalFolders(ownerId), error: null };
      }
      return { folders: readLocalFolders(ownerId), error: error.message };
    }

    const parsed = ((data as Record<string, unknown>[]) ?? []).map(
      parseCollectionFolderRow
    );
    writeLocalFolders(ownerId, parsed);
    return { folders: parsed, error: null };
  }

  async createFolder(
    payload: Omit<CollectionFolderModel, 'id' | 'created_at'>
  ): Promise<{ folder: CollectionFolderModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('collection_folders')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        const fallback: CollectionFolderModel = {
          ...payload,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        };
        const next = [...readLocalFolders(payload.owner_id), fallback];
        writeLocalFolders(payload.owner_id, next);
        return { folder: fallback, error: null };
      }
      return { folder: null, error: error.message };
    }

    const created = parseCollectionFolderRow(data as Record<string, unknown>);
    const next = [...readLocalFolders(payload.owner_id), created];
    writeLocalFolders(payload.owner_id, next);
    return { folder: created, error: null };
  }

  async updateFolder(
    folderId: string,
    ownerId: string,
    patch: Partial<CollectionFolderModel>
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('collection_folders')
      .update(patch)
      .eq('id', folderId);

    const local = readLocalFolders(ownerId).map((f) =>
      f.id === folderId ? { ...f, ...patch } : f
    );
    writeLocalFolders(ownerId, local);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return { error: error.message };
    }
    return { error: null };
  }

  async deleteFolder(
    folderId: string,
    ownerId: string
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('collection_folders')
      .delete()
      .eq('id', folderId);

    const local = readLocalFolders(ownerId).filter((f) => f.id !== folderId);
    writeLocalFolders(ownerId, local);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return { error: error.message };
    }
    return { error: null };
  }

  async fetchActors(ownerId: string): Promise<{
    actors: CollectionActorModel[];
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('collection_actors')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        return { actors: readLocalActors(ownerId), error: null };
      }
      return { actors: readLocalActors(ownerId), error: error.message };
    }

    const parsed = ((data as Record<string, unknown>[]) ?? []).map(
      parseCollectionActorRow
    );
    writeLocalActors(ownerId, parsed);
    return { actors: parsed, error: null };
  }

  async createActor(
    payload: Omit<CollectionActorModel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ actor: CollectionActorModel | null; error: string | null }> {
    const resolvedDarkvision = resolveActorDarkvisionFeet(
      payload.darkvision_feet,
      payload.npc_stats
    );
    const enrichedPayload = {
      ...payload,
      darkvision_feet: resolvedDarkvision,
      npc_stats: {
        ...(payload.npc_stats ?? {}),
        __darkvision_feet: resolvedDarkvision,
      },
    };

    let { data, error } = await this.supabase
      .from('collection_actors')
      .insert(enrichedPayload)
      .select('*')
      .single();

    if (error && isMissingTableOrColumnError(error.code, error.message)) {
      const legacyPayload: Record<string, unknown> = { ...enrichedPayload };
      delete legacyPayload['darkvision_feet'];
      const retry = await this.supabase
        .from('collection_actors')
        .insert(legacyPayload)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        const now = new Date().toISOString();
        const fallback: CollectionActorModel = {
          ...enrichedPayload,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        };
        const next = [...readLocalActors(payload.owner_id), fallback];
        writeLocalActors(payload.owner_id, next);
        return { actor: fallback, error: null };
      }
      return { actor: null, error: error.message };
    }

    const created = parseCollectionActorRow(data as Record<string, unknown>);
    const next = [...readLocalActors(payload.owner_id), created];
    writeLocalActors(payload.owner_id, next);
    return { actor: created, error: null };
  }

  async updateActor(
    actorId: string,
    ownerId: string,
    patch: Partial<CollectionActorModel>
  ): Promise<{ error: string | null }> {
    const payload: Record<string, unknown> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };
    if (patch.darkvision_feet !== undefined && patch.npc_stats) {
      payload['npc_stats'] = {
        ...patch.npc_stats,
        __darkvision_feet: patch.darkvision_feet,
      };
    }

    let { error } = await this.supabase
      .from('collection_actors')
      .update(payload)
      .eq('id', actorId);

    if (
      error &&
      payload['darkvision_feet'] !== undefined &&
      isMissingTableOrColumnError(error.code, error.message)
    ) {
      const retryPayload: Record<string, unknown> = { ...payload };
      delete retryPayload['darkvision_feet'];
      const retry = await this.supabase
        .from('collection_actors')
        .update(retryPayload)
        .eq('id', actorId);
      error = retry.error;
    }

    const local = readLocalActors(ownerId).map((a) =>
      a.id === actorId ? { ...a, ...patch, updated_at: String(payload['updated_at']) } : a
    );
    writeLocalActors(ownerId, local);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return { error: error.message };
    }
    return { error: null };
  }

  async deleteActor(
    actorId: string,
    ownerId: string
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('collection_actors')
      .delete()
      .eq('id', actorId);

    const local = readLocalActors(ownerId).filter((a) => a.id !== actorId);
    writeLocalActors(ownerId, local);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return { error: error.message };
    }
    return { error: null };
  }
}
