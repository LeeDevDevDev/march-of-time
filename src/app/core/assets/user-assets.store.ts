import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DirectoryTreeResult,
  buildDirectoryTree,
  canNestFolderInside,
} from '../../features/vtt/engine/directory-tree.engine';
import { VttFolderModel } from '../../features/vtt/models/vtt.model';
import { AuthStore } from '../auth/auth.store';
import { NotificationStore } from '../notifications/notification.store';
import {
  USER_ASSETS_BUCKET,
  UserAssetBreadcrumb,
  UserAssetFolderModel,
  UserAssetModel,
  UserAssetPreferencesModel,
  UserAssetPurpose,
  buildUserFolderBreadcrumbs,
  buildUserFolderDisplayTrail,
  buildUserStorageFolderPrefix,
  extractAssetDisplayNameFromUrl,
  slugifyAssetSegment,
} from './user-assets.model';
import { UserAssetsService } from './user-assets.service';

@Injectable({ providedIn: 'root' })
export class UserAssetsStore {
  private readonly authStore = inject(AuthStore);
  private readonly assetsService = inject(UserAssetsService);
  private readonly notifications = inject(NotificationStore);

  readonly folders = signal<UserAssetFolderModel[]>([]);
  readonly assets = signal<UserAssetModel[]>([]);
  readonly preferences = signal<UserAssetPreferencesModel>({
    owner_id: '',
    maps_folder_id: null,
    characters_folder_id: null,
  });
  readonly isLoading = signal(false);
  readonly isUploading = signal(false);

  private loadedOwnerId: string | null = null;
  private loadPromise: Promise<void> | null = null;

  readonly userRootLabel = computed<string>(() => {
    const handle = this.authStore.handle?.();
    if (handle) return `@${handle}`;
    const user = this.authStore.user?.();
    if (user?.id) return `user-${user.id.slice(0, 8)}`;
    return 'My Assets';
  });

  readonly userStorageRoot = computed<string>(() => {
    const uid = this.authStore.user?.()?.id;
    return uid ? `${USER_ASSETS_BUCKET}/${uid}` : USER_ASSETS_BUCKET;
  });

  readonly projectedFolders = computed<VttFolderModel[]>(() => {
    const ownerId = this.authStore.user()?.id ?? '';
    return this.folders().map((f) => ({
      id: f.id,
      campaign_id: ownerId,
      scope: 'maps',
      name: f.name,
      color: f.color,
      parent_folder_id: f.parent_folder_id,
      sort_order: f.sort_order,
      created_at: f.created_at,
    }));
  });

  readonly directoryTree = computed<DirectoryTreeResult<UserAssetModel>>(() =>
    buildDirectoryTree(this.projectedFolders(), this.assets(), {
      scope: 'maps',
      getItemFolderId: (a) => a.folder_id,
      getItemName: (a) => a.name,
      getItemSortOrder: () => 0,
    })
  );

  readonly effectiveMapsFolderId = computed<string | null>(() => {
    const all = this.folders();
    const prefId = this.preferences().maps_folder_id;
    if (prefId && all.some((f) => f.id === prefId)) {
      return prefId;
    }
    const fallback = all.find(
      (f) => !f.parent_folder_id && f.slug === 'maps'
    );
    return fallback?.id ?? null;
  });

  readonly effectiveCharactersFolderId = computed<string | null>(() => {
    const all = this.folders();
    const prefId = this.preferences().characters_folder_id;
    if (prefId && all.some((f) => f.id === prefId)) {
      return prefId;
    }
    const fallback = all.find(
      (f) => !f.parent_folder_id && f.slug === 'characters'
    );
    return fallback?.id ?? null;
  });

  async ensureLoaded(force = false): Promise<void> {
    await this.authStore.waitForInit?.();
    const ownerId = this.authStore.user?.()?.id ?? null;
    if (!ownerId) {
      this.loadedOwnerId = null;
      this.folders.set([]);
      this.assets.set([]);
      this.preferences.set({
        owner_id: '',
        maps_folder_id: null,
        characters_folder_id: null,
      });
      return;
    }

    if (!force && this.loadedOwnerId === ownerId) {
      return;
    }

    if (!force && this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.performLoad(ownerId);
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async performLoad(ownerId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      if (typeof this.assetsService.fetchAssetsBundle === 'function') {
        const bundleRes = await this.assetsService.fetchAssetsBundle(ownerId);
        if (!bundleRes.fallback) {
          this.folders.set(bundleRes.folders);
          this.assets.set(bundleRes.assets);
          this.preferences.set(bundleRes.preferences);
          this.loadedOwnerId = ownerId;
          return;
        }
      }

      const [foldersRes, assetsRes, prefs] = await Promise.all([
        this.assetsService.fetchFolders(ownerId),
        this.assetsService.fetchAssets(ownerId),
        this.assetsService.fetchPreferences(ownerId),
      ]);

      let nextFolders = foldersRes.folders;
      let nextPrefs = prefs;

      if (
        nextFolders.length === 0 &&
        !this.assetsService.hasBootstrappedStarterFolders(ownerId)
      ) {
        this.assetsService.markStarterFoldersBootstrapped(ownerId);
        const [mapsRes, charsRes] = await Promise.all([
          this.assetsService.createFolder({
            owner_id: ownerId,
            parent_folder_id: null,
            name: 'Maps',
            slug: 'maps',
            color: '#C4491A',
            sort_order: 0,
          }),
          this.assetsService.createFolder({
            owner_id: ownerId,
            parent_folder_id: null,
            name: 'Characters',
            slug: 'characters',
            color: '#38B29A',
            sort_order: 1,
          }),
        ]);

        const created: UserAssetFolderModel[] = [];
        if (mapsRes.folder) created.push(mapsRes.folder);
        if (charsRes.folder) created.push(charsRes.folder);
        nextFolders = created;

        nextPrefs = {
          owner_id: ownerId,
          maps_folder_id: mapsRes.folder?.id ?? null,
          characters_folder_id: charsRes.folder?.id ?? null,
        };
        await this.assetsService.savePreferences(nextPrefs);
      } else if (nextFolders.length > 0) {
        this.assetsService.markStarterFoldersBootstrapped(ownerId);
      }

      this.folders.set(nextFolders);
      this.assets.set(assetsRes.assets);
      this.preferences.set(nextPrefs);
      this.loadedOwnerId = ownerId;
    } finally {
      this.isLoading.set(false);
    }
  }

  resolveTargetFolderId(
    purpose: UserAssetPurpose,
    explicitFolderId?: string | null
  ): string | null {
    if (explicitFolderId !== undefined) {
      return explicitFolderId;
    }
    if (purpose === 'maps') {
      return this.effectiveMapsFolderId();
    }
    if (purpose === 'characters') {
      return this.effectiveCharactersFolderId();
    }
    return null;
  }

  canNestFolder(
    folderId: string | null,
    candidateParentId: string | null
  ): boolean {
    return canNestFolderInside(
      folderId,
      candidateParentId,
      this.projectedFolders(),
      'maps'
    );
  }

  getBreadcrumbs(folderId: string | null): UserAssetBreadcrumb[] {
    return buildUserFolderBreadcrumbs(
      this.userRootLabel(),
      folderId,
      this.folders()
    );
  }

  getFolderTrailLabel(folderId: string | null): string {
    return buildUserFolderDisplayTrail(
      this.userRootLabel(),
      folderId,
      this.folders()
    );
  }

  getSupabaseFolderPath(folderId: string | null): string {
    const uid = this.authStore.user()?.id ?? 'user';
    const prefix = buildUserStorageFolderPrefix(uid, folderId, this.folders());
    return `${USER_ASSETS_BUCKET}/${prefix}/`;
  }

  findAssetByUrl(url: string | null | undefined): UserAssetModel | null {
    const trimmed = (url ?? '').trim();
    if (!trimmed) return null;
    const exact = this.assets().find((a) => a.public_url.trim() === trimmed);
    if (exact) return exact;
    const withoutQuery = trimmed.split('?')[0];
    return (
      this.assets().find(
        (a) => a.public_url.trim().split('?')[0] === withoutQuery
      ) ?? null
    );
  }

  async setDefaultFolder(
    purpose: 'maps' | 'characters',
    folderId: string | null
  ): Promise<void> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    if (!ownerId) return;

    const validId =
      folderId && this.folders().some((f) => f.id === folderId)
        ? folderId
        : null;

    const current = this.preferences();
    const nextPrefs: UserAssetPreferencesModel = {
      owner_id: ownerId,
      maps_folder_id:
        purpose === 'maps' ? validId : current.maps_folder_id,
      characters_folder_id:
        purpose === 'characters' ? validId : current.characters_folder_id,
    };

    this.preferences.set(nextPrefs);
    const err = await this.assetsService.savePreferences(nextPrefs);
    if (err) {
      this.notifications.error('Folder Setting Error', err);
      return;
    }

    const label = this.getFolderTrailLabel(validId);
    this.notifications.success(
      purpose === 'maps'
        ? 'Maps Upload Folder Set'
        : 'Characters Upload Folder Set',
      `New ${purpose === 'maps' ? 'map' : 'character & token'} uploads will go to ${label}.`
    );
  }

  async createFolder(
    name: string,
    parentFolderId: string | null = null,
    color: string | null = '#C4491A'
  ): Promise<UserAssetFolderModel | null> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const cleanName = name.trim();
    if (!ownerId || !cleanName) return null;

    const safeParent = this.canNestFolder(null, parentFolderId)
      ? parentFolderId
      : null;
    const siblings = this.folders().filter(
      (f) => (f.parent_folder_id ?? null) === safeParent
    );
    const baseSlug = slugifyAssetSegment(cleanName);
    let slug = baseSlug;
    let suffix = 2;
    while (siblings.some((s) => s.slug === slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const res = await this.assetsService.createFolder({
      owner_id: ownerId,
      parent_folder_id: safeParent,
      name: cleanName,
      slug,
      color: color || '#C4491A',
      sort_order: siblings.length,
    });

    if (res.error || !res.folder) {
      this.notifications.error(
        'Unable to Create Folder',
        res.error ?? 'Unknown error.'
      );
      return null;
    }

    this.folders.update((curr) => [...curr, res.folder!]);
    return res.folder;
  }

  async updateFolder(
    folderId: string,
    patch: {
      name?: string;
      parent_folder_id?: string | null;
      color?: string | null;
    }
  ): Promise<boolean> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const existing = this.folders().find((f) => f.id === folderId);
    if (!ownerId || !existing) return false;

    const nextPatch: Partial<UserAssetFolderModel> = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return false;
      nextPatch.name = trimmed;
      nextPatch.slug = slugifyAssetSegment(trimmed);
    }
    if (patch.color !== undefined) {
      nextPatch.color = patch.color;
    }
    if (patch.parent_folder_id !== undefined) {
      if (!this.canNestFolder(folderId, patch.parent_folder_id)) {
        this.notifications.error(
          'Invalid Folder Nesting',
          'Folders support up to 3 levels of depth.'
        );
        return false;
      }
      nextPatch.parent_folder_id = patch.parent_folder_id;
    }

    this.folders.update((curr) =>
      curr.map((f) => (f.id === folderId ? { ...f, ...nextPatch } : f))
    );

    const err = await this.assetsService.updateFolder(
      ownerId,
      folderId,
      nextPatch
    );
    if (err) {
      this.notifications.error('Folder Update Error', err);
      return false;
    }
    return true;
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const target = this.folders().find((f) => f.id === folderId);
    if (!ownerId || !target) return;

    const fallbackParent = target.parent_folder_id ?? null;

    this.folders.update((curr) =>
      curr
        .filter((f) => f.id !== folderId)
        .map((f) =>
          f.parent_folder_id === folderId
            ? { ...f, parent_folder_id: fallbackParent }
            : f
        )
    );
    this.assets.update((curr) =>
      curr.map((a) =>
        a.folder_id === folderId ? { ...a, folder_id: fallbackParent } : a
      )
    );

    const prefs = this.preferences();
    if (
      prefs.maps_folder_id === folderId ||
      prefs.characters_folder_id === folderId
    ) {
      const updatedPrefs: UserAssetPreferencesModel = {
        owner_id: ownerId,
        maps_folder_id:
          prefs.maps_folder_id === folderId
            ? fallbackParent
            : prefs.maps_folder_id,
        characters_folder_id:
          prefs.characters_folder_id === folderId
            ? fallbackParent
            : prefs.characters_folder_id,
      };
      this.preferences.set(updatedPrefs);
      await this.assetsService.savePreferences(updatedPrefs);
    }

    const err = await this.assetsService.deleteFolder(ownerId, folderId);
    if (err) {
      this.notifications.error('Folder Delete Error', err);
    }
  }

  async uploadAssetFile(
    file: File,
    options?: {
      folderId?: string | null;
      purpose?: UserAssetPurpose;
      silent?: boolean;
    }
  ): Promise<UserAssetModel | null> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    if (!ownerId) return null;

    if (file.size > 15 * 1024 * 1024) {
      if (!options?.silent) {
        this.notifications.error(
          'File Too Large',
          'Maximum image size is 15 MB.'
        );
      }
      return null;
    }

    const targetFolderId = this.resolveTargetFolderId(
      options?.purpose ?? 'general',
      options?.folderId
    );
    const storagePrefix = buildUserStorageFolderPrefix(
      ownerId,
      targetFolderId,
      this.folders()
    );

    this.isUploading.set(true);
    try {
      const [uploadRes, dims] = await Promise.all([
        this.assetsService.uploadFileToStorage(storagePrefix, file),
        this.assetsService.probeFileImageDimensions(file),
      ]);

      if (uploadRes.error || !uploadRes.url) {
        if (!options?.silent) {
          this.notifications.error(
            'Asset Upload Failed',
            uploadRes.error ?? 'Unable to upload image.'
          );
        }
        return null;
      }

      const displayName = file.name.trim() || 'Image';
      const createdRes = await this.assetsService.createAssetRecord({
        owner_id: ownerId,
        folder_id: targetFolderId,
        name: displayName,
        storage_bucket: uploadRes.bucket,
        storage_path: uploadRes.storagePath,
        public_url: uploadRes.url,
        mime_type: file.type || null,
        size_bytes: file.size || 0,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });

      if (createdRes.error || !createdRes.asset) {
        if (!options?.silent) {
          this.notifications.error(
            'Asset Save Failed',
            createdRes.error ?? 'Unable to catalog uploaded image.'
          );
        }
        return null;
      }

      this.assets.update((curr) => [
        createdRes.asset!,
        ...curr.filter((a) => a.id !== createdRes.asset!.id),
      ]);

      if (!options?.silent) {
        const trail = this.getFolderTrailLabel(targetFolderId);
        this.notifications.success(
          'Saved to Asset Library',
          `${displayName} stored in ${trail}.`
        );
      }
      return createdRes.asset;
    } finally {
      this.isUploading.set(false);
    }
  }

  async registerAssetFromUrl(
    url: string,
    options?: {
      name?: string;
      folderId?: string | null;
      purpose?: UserAssetPurpose;
      width?: number | null;
      height?: number | null;
      silent?: boolean;
    }
  ): Promise<UserAssetModel | null> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const trimmedUrl = url.trim();
    if (!ownerId || !trimmedUrl) return null;

    const existing = this.findAssetByUrl(trimmedUrl);
    if (existing) {
      if (!options?.silent) {
        this.notifications.info(
          'Already in Library',
          `${existing.name} is saved in ${this.getFolderTrailLabel(existing.folder_id)}.`
        );
      }
      return existing;
    }

    const targetFolderId = this.resolveTargetFolderId(
      options?.purpose ?? 'general',
      options?.folderId
    );
    const probed =
      options?.width && options?.height
        ? { width: options.width, height: options.height }
        : await this.assetsService.probeUrlImageDimensions(trimmedUrl);

    const displayName =
      options?.name?.trim() || extractAssetDisplayNameFromUrl(trimmedUrl);
    const storagePrefix = buildUserStorageFolderPrefix(
      ownerId,
      targetFolderId,
      this.folders()
    );

    const createdRes = await this.assetsService.createAssetRecord({
      owner_id: ownerId,
      folder_id: targetFolderId,
      name: displayName,
      storage_bucket: 'external',
      storage_path: `${storagePrefix}/${displayName}`,
      public_url: trimmedUrl,
      mime_type: null,
      size_bytes: 0,
      width: probed?.width ?? null,
      height: probed?.height ?? null,
    });

    if (createdRes.error || !createdRes.asset) {
      if (!options?.silent) {
        this.notifications.error(
          'Unable to Save Image',
          createdRes.error ?? 'Unknown error.'
        );
      }
      return null;
    }

    this.assets.update((curr) => [createdRes.asset!, ...curr]);
    if (!options?.silent) {
      this.notifications.success(
        'Saved to Asset Library',
        `${displayName} cataloged in ${this.getFolderTrailLabel(targetFolderId)}.`
      );
    }
    return createdRes.asset;
  }

  async moveAssetToFolder(
    assetId: string,
    folderId: string | null
  ): Promise<boolean> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const existing = this.assets().find((a) => a.id === assetId);
    if (!ownerId || !existing) return false;
    if ((existing.folder_id ?? null) === (folderId ?? null)) return true;

    this.assets.update((curr) =>
      curr.map((a) =>
        a.id === assetId ? { ...a, folder_id: folderId ?? null } : a
      )
    );

    const err = await this.assetsService.updateAssetRecord(ownerId, assetId, {
      folder_id: folderId ?? null,
    });
    if (err) {
      this.notifications.error('Move Failed', err);
      return false;
    }
    return true;
  }

  async renameAsset(assetId: string, name: string): Promise<boolean> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const cleanName = name.trim();
    if (!ownerId || !cleanName) return false;

    this.assets.update((curr) =>
      curr.map((a) => (a.id === assetId ? { ...a, name: cleanName } : a))
    );

    const err = await this.assetsService.updateAssetRecord(ownerId, assetId, {
      name: cleanName,
    });
    if (err) {
      this.notifications.error('Rename Failed', err);
      return false;
    }
    return true;
  }

  async deleteAsset(assetId: string): Promise<boolean> {
    await this.ensureLoaded();
    const ownerId = this.authStore.user()?.id;
    const existing = this.assets().find((a) => a.id === assetId);
    if (!ownerId || !existing) return false;

    const sharedStorageCount = this.assets().filter(
      (a) =>
        a.id !== assetId &&
        a.storage_bucket === existing.storage_bucket &&
        a.storage_path === existing.storage_path
    ).length;

    this.assets.update((curr) => curr.filter((a) => a.id !== assetId));

    const err = await this.assetsService.deleteAssetRecord(
      ownerId,
      existing,
      sharedStorageCount === 0
    );
    if (err) {
      this.notifications.error('Delete Failed', err);
      return false;
    }
    return true;
  }
}
