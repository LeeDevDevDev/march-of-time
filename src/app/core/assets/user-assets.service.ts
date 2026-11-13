import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  USER_ASSETS_BUCKET,
  UserAssetFolderModel,
  UserAssetModel,
  UserAssetPreferencesModel,
  slugifyAssetSegment,
} from './user-assets.model';

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
  return `mot-user-asset-folders-v1-${ownerId}`;
}

function getLocalAssetsKey(ownerId: string): string {
  return `mot-user-assets-v1-${ownerId}`;
}

function getLocalPrefsKey(ownerId: string): string {
  return `mot-user-asset-prefs-v1-${ownerId}`;
}

function getBootstrapKey(ownerId: string): string {
  return `mot-user-assets-bootstrapped-v1-${ownerId}`;
}

function readLocalFolders(ownerId: string): UserAssetFolderModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalFoldersKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserAssetFolderModel[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFolders(
  ownerId: string,
  folders: UserAssetFolderModel[]
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalFoldersKey(ownerId), JSON.stringify(folders));
  } catch {
    return;
  }
}

function readLocalAssets(ownerId: string): UserAssetModel[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalAssetsKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserAssetModel[]) : [];
  } catch {
    return [];
  }
}

function writeLocalAssets(ownerId: string, assets: UserAssetModel[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalAssetsKey(ownerId), JSON.stringify(assets));
  } catch {
    return;
  }
}

function readLocalPrefs(ownerId: string): UserAssetPreferencesModel | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getLocalPrefsKey(ownerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserAssetPreferencesModel>;
    return {
      owner_id: ownerId,
      maps_folder_id: parsed.maps_folder_id ?? null,
      characters_folder_id: parsed.characters_folder_id ?? null,
    };
  } catch {
    return null;
  }
}

function writeLocalPrefs(prefs: UserAssetPreferencesModel): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      getLocalPrefsKey(prefs.owner_id),
      JSON.stringify(prefs)
    );
  } catch {
    return;
  }
}

function parseFolderRow(raw: Record<string, unknown>): UserAssetFolderModel {
  const name = String(raw['name'] ?? 'Folder');
  return {
    id: String(raw['id'] ?? ''),
    owner_id: String(raw['owner_id'] ?? ''),
    parent_folder_id: raw['parent_folder_id']
      ? String(raw['parent_folder_id'])
      : null,
    name,
    slug: raw['slug'] ? String(raw['slug']) : slugifyAssetSegment(name),
    color: raw['color'] ? String(raw['color']) : null,
    sort_order: Number(raw['sort_order'] ?? 0),
    created_at: raw['created_at'] ? String(raw['created_at']) : undefined,
  };
}

function parseAssetRow(raw: Record<string, unknown>): UserAssetModel {
  return {
    id: String(raw['id'] ?? ''),
    owner_id: String(raw['owner_id'] ?? ''),
    folder_id: raw['folder_id'] ? String(raw['folder_id']) : null,
    name: String(raw['name'] ?? 'Image'),
    storage_bucket: raw['storage_bucket']
      ? String(raw['storage_bucket'])
      : USER_ASSETS_BUCKET,
    storage_path: String(raw['storage_path'] ?? ''),
    public_url: String(raw['public_url'] ?? ''),
    mime_type: raw['mime_type'] ? String(raw['mime_type']) : null,
    size_bytes: Math.max(0, Number(raw['size_bytes'] ?? 0)),
    width:
      raw['width'] !== null && raw['width'] !== undefined
        ? Number(raw['width'])
        : null,
    height:
      raw['height'] !== null && raw['height'] !== undefined
        ? Number(raw['height'])
        : null,
    created_at: raw['created_at']
      ? String(raw['created_at'])
      : new Date().toISOString(),
    folder_name:
      raw['folder_name'] !== undefined && raw['folder_name'] !== null
        ? String(raw['folder_name'])
        : undefined,
    folder_slug:
      raw['folder_slug'] !== undefined && raw['folder_slug'] !== null
        ? String(raw['folder_slug'])
        : undefined,
    folder_color:
      raw['folder_color'] !== undefined && raw['folder_color'] !== null
        ? String(raw['folder_color'])
        : undefined,
  };
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  if (typeof FileReader === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

@Injectable({ providedIn: 'root' })
export class UserAssetsService {
  private readonly supabase = inject(SupabaseService).client;

  hasBootstrappedStarterFolders(ownerId: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(getBootstrapKey(ownerId)) === '1';
  }

  markStarterFoldersBootstrapped(ownerId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(getBootstrapKey(ownerId), '1');
    } catch {
      return;
    }
  }

  async fetchAssetsBundle(ownerId: string): Promise<{
    folders: UserAssetFolderModel[];
    assets: UserAssetModel[];
    preferences: UserAssetPreferencesModel;
    fallback: boolean;
    error: string | null;
  }> {
    const { data, error } = await this.supabase.rpc('get_user_assets_bundle');

    if (!error && data && typeof data === 'object') {
      const raw = data as {
        folders?: Record<string, unknown>[];
        assets?: Record<string, unknown>[];
        preferences?: Record<string, unknown>;
      };

      const remoteFolders = (
        Array.isArray(raw.folders) ? raw.folders : []
      ).map(parseFolderRow);
      const localOnlyFolders = readLocalFolders(ownerId).filter(
        (lf) => !remoteFolders.some((rf) => rf.id === lf.id)
      );
      const mergedFolders = [...remoteFolders, ...localOnlyFolders];
      writeLocalFolders(ownerId, mergedFolders);

      const remoteAssets = (Array.isArray(raw.assets) ? raw.assets : []).map(
        parseAssetRow
      );
      const localOnlyAssets = readLocalAssets(ownerId).filter(
        (la) => !remoteAssets.some((ra) => ra.id === la.id)
      );
      const mergedAssets = [...remoteAssets, ...localOnlyAssets];
      writeLocalAssets(ownerId, mergedAssets);

      const rawPrefs = raw.preferences ?? {};
      const preferences: UserAssetPreferencesModel = {
        owner_id: ownerId,
        maps_folder_id: rawPrefs['maps_folder_id']
          ? String(rawPrefs['maps_folder_id'])
          : null,
        characters_folder_id: rawPrefs['characters_folder_id']
          ? String(rawPrefs['characters_folder_id'])
          : null,
      };
      writeLocalPrefs(preferences);
      this.markStarterFoldersBootstrapped(ownerId);

      return {
        folders: mergedFolders,
        assets: mergedAssets,
        preferences,
        fallback: false,
        error: null,
      };
    }

    if (error && isMissingTableOrColumnError(error.code, error.message)) {
      return {
        folders: [],
        assets: [],
        preferences: {
          owner_id: ownerId,
          maps_folder_id: null,
          characters_folder_id: null,
        },
        fallback: true,
        error: null,
      };
    }

    return {
      folders: readLocalFolders(ownerId),
      assets: readLocalAssets(ownerId),
      preferences: readLocalPrefs(ownerId) ?? {
        owner_id: ownerId,
        maps_folder_id: null,
        characters_folder_id: null,
      },
      fallback: false,
      error: error?.message ?? null,
    };
  }

  async fetchFolders(ownerId: string): Promise<{
    folders: UserAssetFolderModel[];
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('user_asset_folders')
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

    const remote = (data ?? []).map((r) =>
      parseFolderRow(r as Record<string, unknown>)
    );
    const localOnly = readLocalFolders(ownerId).filter(
      (lf) => !remote.some((rf) => rf.id === lf.id)
    );
    const merged = [...remote, ...localOnly];
    writeLocalFolders(ownerId, merged);
    return { folders: merged, error: null };
  }

  async createFolder(
    input: Omit<UserAssetFolderModel, 'id' | 'created_at'>
  ): Promise<{ folder: UserAssetFolderModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('user_asset_folders')
      .insert({
        owner_id: input.owner_id,
        parent_folder_id: input.parent_folder_id,
        name: input.name,
        slug: input.slug,
        color: input.color,
        sort_order: input.sort_order,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        const localFolder: UserAssetFolderModel = {
          id: crypto.randomUUID(),
          owner_id: input.owner_id,
          parent_folder_id: input.parent_folder_id,
          name: input.name,
          slug: input.slug,
          color: input.color,
          sort_order: input.sort_order,
          created_at: new Date().toISOString(),
        };
        const next = [...readLocalFolders(input.owner_id), localFolder];
        writeLocalFolders(input.owner_id, next);
        return { folder: localFolder, error: null };
      }
      return { folder: null, error: error.message };
    }

    const created = parseFolderRow(data as Record<string, unknown>);
    const next = [
      ...readLocalFolders(input.owner_id).filter((f) => f.id !== created.id),
      created,
    ];
    writeLocalFolders(input.owner_id, next);
    return { folder: created, error: null };
  }

  async updateFolder(
    ownerId: string,
    folderId: string,
    patch: Partial<UserAssetFolderModel>
  ): Promise<string | null> {
    const nextLocal = readLocalFolders(ownerId).map((f) =>
      f.id === folderId ? { ...f, ...patch } : f
    );
    writeLocalFolders(ownerId, nextLocal);

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch['name'] = patch.name;
    if (patch.slug !== undefined) dbPatch['slug'] = patch.slug;
    if (patch.color !== undefined) dbPatch['color'] = patch.color;
    if (patch.parent_folder_id !== undefined) {
      dbPatch['parent_folder_id'] = patch.parent_folder_id;
    }
    if (patch.sort_order !== undefined) dbPatch['sort_order'] = patch.sort_order;
    if (Object.keys(dbPatch).length === 0) return null;

    const { error } = await this.supabase
      .from('user_asset_folders')
      .update(dbPatch)
      .eq('id', folderId)
      .eq('owner_id', ownerId);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return error.message;
    }
    return null;
  }

  async deleteFolder(ownerId: string, folderId: string): Promise<string | null> {
    const currentFolders = readLocalFolders(ownerId);
    const target = currentFolders.find((f) => f.id === folderId);
    const fallbackParent = target?.parent_folder_id ?? null;

    const updatedFolders = currentFolders
      .filter((f) => f.id !== folderId)
      .map((f) =>
        f.parent_folder_id === folderId
          ? { ...f, parent_folder_id: fallbackParent }
          : f
      );
    writeLocalFolders(ownerId, updatedFolders);

    const updatedAssets = readLocalAssets(ownerId).map((a) =>
      a.folder_id === folderId ? { ...a, folder_id: fallbackParent } : a
    );
    writeLocalAssets(ownerId, updatedAssets);

    const { error } = await this.supabase
      .from('user_asset_folders')
      .delete()
      .eq('id', folderId)
      .eq('owner_id', ownerId);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return error.message;
    }
    return null;
  }

  async fetchAssets(ownerId: string): Promise<{
    assets: UserAssetModel[];
    error: string | null;
  }> {
    let { data, error } = await this.supabase
      .from('v_user_assets_with_folders')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error && isMissingTableOrColumnError(error.code, error.message)) {
      const baseRes = await this.supabase
        .from('user_assets')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });
      data = baseRes.data;
      error = baseRes.error;
    }

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        return { assets: readLocalAssets(ownerId), error: null };
      }
      return { assets: readLocalAssets(ownerId), error: error.message };
    }

    const remote = (data ?? []).map((r) =>
      parseAssetRow(r as Record<string, unknown>)
    );
    const localOnly = readLocalAssets(ownerId).filter(
      (la) => !remote.some((ra) => ra.id === la.id)
    );
    const merged = [...remote, ...localOnly];
    writeLocalAssets(ownerId, merged);
    return { assets: merged, error: null };
  }

  async fetchPreferences(ownerId: string): Promise<UserAssetPreferencesModel> {
    const localFallback = readLocalPrefs(ownerId) ?? {
      owner_id: ownerId,
      maps_folder_id: null,
      characters_folder_id: null,
    };

    const { data, error } = await this.supabase
      .from('user_asset_preferences')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error || !data) {
      return localFallback;
    }

    const raw = data as Record<string, unknown>;
    const prefs: UserAssetPreferencesModel = {
      owner_id: ownerId,
      maps_folder_id: raw['maps_folder_id']
        ? String(raw['maps_folder_id'])
        : null,
      characters_folder_id: raw['characters_folder_id']
        ? String(raw['characters_folder_id'])
        : null,
    };
    writeLocalPrefs(prefs);
    return prefs;
  }

  async savePreferences(
    prefs: UserAssetPreferencesModel
  ): Promise<string | null> {
    writeLocalPrefs(prefs);

    const { error } = await this.supabase.from('user_asset_preferences').upsert(
      {
        owner_id: prefs.owner_id,
        maps_folder_id: prefs.maps_folder_id,
        characters_folder_id: prefs.characters_folder_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    );

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return error.message;
    }
    return null;
  }

  async uploadFileToStorage(
    storagePrefix: string,
    file: File
  ): Promise<{
    url: string | null;
    bucket: string;
    storagePath: string;
    error: string | null;
  }> {
    const ext = (file.name.split('.').pop() || 'png')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const safeBase = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 44);
    const fileName = `${Date.now()}-${safeBase || 'asset'}.${ext || 'png'}`;
    const primaryPath = `${storagePrefix}/${fileName}`;

    try {
      const storageApi = this.supabase?.storage;
      if (storageApi && typeof storageApi.from === 'function') {
        const primaryBucket = storageApi.from(USER_ASSETS_BUCKET);
        if (primaryBucket && typeof primaryBucket.upload === 'function') {
          const { error: primaryErr } = await primaryBucket.upload(
            primaryPath,
            file,
            {
              cacheControl: '3600',
              upsert: true,
            }
          );

          if (!primaryErr) {
            const { data } = primaryBucket.getPublicUrl(primaryPath);
            return {
              url: data.publicUrl,
              bucket: USER_ASSETS_BUCKET,
              storagePath: primaryPath,
              error: null,
            };
          }

          const fallbackPath = `users/${primaryPath}`;
          const fallbackBucket = storageApi.from('vtt-maps');
          const { error: fallbackErr } = await fallbackBucket.upload(
            fallbackPath,
            file,
            {
              cacheControl: '3600',
              upsert: true,
            }
          );

          if (!fallbackErr) {
            const { data } = fallbackBucket.getPublicUrl(fallbackPath);
            return {
              url: data.publicUrl,
              bucket: 'vtt-maps',
              storagePath: fallbackPath,
              error: null,
            };
          }
        }
      }
    } catch {
      void 0;
    }

    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl) {
      return {
        url: dataUrl,
        bucket: 'local',
        storagePath: primaryPath,
        error: null,
      };
    }

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return {
        url: URL.createObjectURL(file),
        bucket: 'local',
        storagePath: primaryPath,
        error: null,
      };
    }

    return {
      url: null,
      bucket: USER_ASSETS_BUCKET,
      storagePath: primaryPath,
      error: 'Unable to upload image file.',
    };
  }

  async createAssetRecord(
    input: Omit<UserAssetModel, 'id' | 'created_at'>
  ): Promise<{ asset: UserAssetModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('user_assets')
      .insert({
        owner_id: input.owner_id,
        folder_id: input.folder_id,
        name: input.name,
        storage_bucket: input.storage_bucket,
        storage_path: input.storage_path,
        public_url: input.public_url,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        width: input.width,
        height: input.height,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingTableOrColumnError(error.code, error.message)) {
        const localAsset: UserAssetModel = {
          id: crypto.randomUUID(),
          owner_id: input.owner_id,
          folder_id: input.folder_id,
          name: input.name,
          storage_bucket: input.storage_bucket,
          storage_path: input.storage_path,
          public_url: input.public_url,
          mime_type: input.mime_type,
          size_bytes: input.size_bytes,
          width: input.width,
          height: input.height,
          created_at: new Date().toISOString(),
        };
        const next = [localAsset, ...readLocalAssets(input.owner_id)];
        writeLocalAssets(input.owner_id, next);
        return { asset: localAsset, error: null };
      }
      return { asset: null, error: error.message };
    }

    const created = parseAssetRow(data as Record<string, unknown>);
    const next = [
      created,
      ...readLocalAssets(input.owner_id).filter((a) => a.id !== created.id),
    ];
    writeLocalAssets(input.owner_id, next);
    return { asset: created, error: null };
  }

  async updateAssetRecord(
    ownerId: string,
    assetId: string,
    patch: Partial<Pick<UserAssetModel, 'name' | 'folder_id' | 'width' | 'height'>>
  ): Promise<string | null> {
    const nextLocal = readLocalAssets(ownerId).map((a) =>
      a.id === assetId ? { ...a, ...patch } : a
    );
    writeLocalAssets(ownerId, nextLocal);

    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch['name'] = patch.name;
    if (patch.folder_id !== undefined) dbPatch['folder_id'] = patch.folder_id;
    if (patch.width !== undefined) dbPatch['width'] = patch.width;
    if (patch.height !== undefined) dbPatch['height'] = patch.height;
    if (Object.keys(dbPatch).length === 0) return null;

    const { error } = await this.supabase
      .from('user_assets')
      .update(dbPatch)
      .eq('id', assetId)
      .eq('owner_id', ownerId);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return error.message;
    }
    return null;
  }

  async deleteAssetRecord(
    ownerId: string,
    asset: UserAssetModel,
    removeFromStorage: boolean
  ): Promise<string | null> {
    const nextLocal = readLocalAssets(ownerId).filter((a) => a.id !== asset.id);
    writeLocalAssets(ownerId, nextLocal);

    if (
      removeFromStorage &&
      asset.storage_bucket &&
      asset.storage_bucket !== 'local' &&
      asset.storage_bucket !== 'external' &&
      asset.storage_path
    ) {
      try {
        await this.supabase.storage
          .from(asset.storage_bucket)
          .remove([asset.storage_path]);
      } catch {
        void 0;
      }
    }

    const { error } = await this.supabase
      .from('user_assets')
      .delete()
      .eq('id', asset.id)
      .eq('owner_id', ownerId);

    if (error && !isMissingTableOrColumnError(error.code, error.message)) {
      return error.message;
    }
    return null;
  }

  probeFileImageDimensions(
    file: File
  ): Promise<{ width: number; height: number } | null> {
    if (
      typeof Image === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(
          img.naturalWidth > 0 && img.naturalHeight > 0
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : null
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  }

  probeUrlImageDimensions(
    url: string
  ): Promise<{ width: number; height: number } | null> {
    if (typeof Image === 'undefined' || !url.trim()) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        resolve(
          img.naturalWidth > 0 && img.naturalHeight > 0
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : null
        );
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}
