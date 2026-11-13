import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import {
  PerkNodeModel,
  WeaponModel,
  resolveWeaponVisuals,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { NotificationStore } from '../../core/notifications/notification.store';
import {
  CharacterModel,
  computeDerivedStats,
} from '../characters/models/character.model';
import { CharacterStore } from '../characters/store/character.store';
import {
  canNestFolderInside,
  collectDescendantFolderIds,
} from '../vtt/engine/directory-tree.engine';
import {
  CollectionActorModel,
  CollectionFolderModel,
  VttActorKind,
  VttFaction,
  VttFolderModel,
  VttNpcPreset,
  VttNpcStats,
} from '../vtt/models/vtt.model';
import { CollectionsService } from './collections.service';

export interface ActorTemplateDraft {
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
}

export function buildActorTemplateFromCharacter(
  character: CharacterModel,
  weapons: WeaponModel[],
  perkNodes: PerkNodeModel[],
  folderId: string | null = null
): ActorTemplateDraft {
  const stats = computeDerivedStats(character, weapons, perkNodes);
  const wepVis = stats.activeWeapon
    ? resolveWeaponVisuals(stats.activeWeapon)
    : { icon: 'greatsword', color: '#38B29A' };
  const reachFeet = stats.activeWeapon
    ? Math.max(5, Math.round((stats.activeWeapon.reach_tiles ?? 1) * 5))
    : 5;

  return {
    folder_id: folderId,
    source_character_id: character.id,
    actor_kind: 'character',
    is_unique: true,
    name: character.name,
    faction: 'ally',
    size: 1,
    icon: wepVis.icon,
    color: '#38B29A',
    max_hp: stats.maxHp,
    max_sp: stats.maxSp,
    max_ap: 4,
    armor_dr: stats.armorDr,
    shield_block: stats.shieldBlockTotal,
    move_feet: stats.moveFeet,
    vision_feet: 60,
    light_bright_feet: 0,
    light_dim_feet: 0,
    light_color: '#F59E0B',
    npc_stats: {
      weapon_name: stats.activeWeapon?.name ?? 'Unarmed',
      attack_ap: 1,
      attack_mod: stats.attackRollMod,
      flat_damage: stats.flatWeaponDamage,
      reach_feet: reachFeet,
      combat_tag: 'None',
      parry_mod: stats.parryMod,
      dodge_mod: stats.dodgeMod,
      can_dodge: stats.canDodge,
      enables_martial_parry: stats.enablesMartialParry,
    },
    notes: `Level ${character.level} · ${character.equipped_armor} Armor`,
  };
}

export function buildActorTemplateFromNpcPreset(
  preset: VttNpcPreset,
  folderId: string | null = null
): ActorTemplateDraft {
  return {
    folder_id: folderId,
    source_character_id: null,
    actor_kind: 'npc',
    is_unique: false,
    name: preset.name,
    faction: preset.faction,
    size: 1,
    icon: preset.icon,
    color: preset.color,
    max_hp: preset.max_hp,
    max_sp: preset.max_sp,
    max_ap: preset.max_ap,
    armor_dr: preset.armor_dr,
    shield_block: preset.shield_block,
    move_feet: preset.move_feet,
    vision_feet: preset.vision_feet,
    light_bright_feet: 0,
    light_dim_feet: 0,
    light_color: '#F59E0B',
    npc_stats: { ...preset.npc_stats },
    notes: '',
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionsStore {
  private readonly authStore = inject(AuthStore);
  private readonly collectionsService = inject(CollectionsService);
  private readonly characterStore = inject(CharacterStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly notifications = inject(NotificationStore);

  readonly folders = signal<CollectionFolderModel[]>([]);
  readonly actors = signal<CollectionActorModel[]>([]);
  readonly myCharacters = this.characterStore.characters;
  readonly isLoading = signal<boolean>(false);
  readonly loadedOwnerId = signal<string | null>(null);

  readonly foldersAsDirectoryFolders = computed<VttFolderModel[]>(() =>
    this.folders().map((f) => ({
      id: f.id,
      campaign_id: 'collections',
      scope: 'characters',
      parent_folder_id: f.parent_folder_id,
      name: f.name,
      color: f.color,
      sort_order: f.sort_order,
      created_at: f.created_at,
    }))
  );

  async ensureMyCharactersLoaded(): Promise<void> {
    await this.characterStore.ensureUserCharactersLoaded();
  }

  async loadCollections(force = false): Promise<void> {
    const userId = this.authStore.user()?.id ?? null;
    if (!userId) {
      this.folders.set([]);
      this.actors.set([]);
      this.loadedOwnerId.set(null);
      return;
    }

    if (!force && this.loadedOwnerId() === userId && !this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    try {
      await this.compendiumStore.ensureLoaded();

      if (
        typeof this.collectionsService.fetchCollectionsBundle === 'function'
      ) {
        const bundleRes =
          await this.collectionsService.fetchCollectionsBundle(userId);
        if (!bundleRes.fallback) {
          this.folders.set(bundleRes.folders);
          this.actors.set(bundleRes.actors);
          this.loadedOwnerId.set(userId);
          return;
        }
      }

      const [foldersRes, actorsRes] = await Promise.all([
        this.collectionsService.fetchFolders(userId),
        this.collectionsService.fetchActors(userId),
      ]);

      this.folders.set(foldersRes.folders);
      this.actors.set(actorsRes.actors);
      this.loadedOwnerId.set(userId);
    } finally {
      this.isLoading.set(false);
    }
  }

  async createFolder(
    name: string,
    color: string | null = null,
    parentFolderId: string | null = null
  ): Promise<CollectionFolderModel | null> {
    const userId = this.authStore.user()?.id;
    if (!userId) return null;

    const trimmed = name.trim() || 'New Folder';
    const validParent =
      parentFolderId &&
      canNestFolderInside(
        null,
        parentFolderId,
        this.foldersAsDirectoryFolders(),
        'characters'
      )
        ? parentFolderId
        : null;

    const res = await this.collectionsService.createFolder({
      owner_id: userId,
      parent_folder_id: validParent,
      name: trimmed,
      color,
      sort_order: this.folders().length,
    });

    if (res.error || !res.folder) {
      this.notifications.error(
        'Unable to Create Folder',
        res.error ?? 'Unknown error.'
      );
      return null;
    }

    this.folders.update((curr) =>
      curr.some((f) => f.id === res.folder!.id) ? curr : [...curr, res.folder!]
    );
    return res.folder;
  }

  async updateFolder(
    folderId: string,
    patch: {
      name?: string;
      color?: string | null;
      parent_folder_id?: string | null;
    }
  ): Promise<boolean> {
    const userId = this.authStore.user()?.id;
    const existing = this.folders().find((f) => f.id === folderId);
    if (!userId || !existing) return false;

    const cleanPatch: Partial<CollectionFolderModel> = {};
    if (patch.name !== undefined) {
      cleanPatch.name = patch.name.trim() || existing.name;
    }
    if (patch.color !== undefined) {
      cleanPatch.color = patch.color;
    }
    if (patch.parent_folder_id !== undefined) {
      const candidate = patch.parent_folder_id || null;
      if (
        !canNestFolderInside(
          folderId,
          candidate,
          this.foldersAsDirectoryFolders(),
          'characters'
        )
      ) {
        this.notifications.error(
          'Invalid Folder Nesting',
          'Folders can be nested up to 3 levels deep and cannot be placed inside themselves.'
        );
        return false;
      }
      cleanPatch.parent_folder_id = candidate;
    }

    this.folders.update((curr) =>
      curr.map((f) => (f.id === folderId ? { ...f, ...cleanPatch } : f))
    );
    const res = await this.collectionsService.updateFolder(
      folderId,
      userId,
      cleanPatch
    );
    if (res.error) {
      this.notifications.error('Unable to Update Folder', res.error);
      return false;
    }
    return true;
  }

  async deleteFolder(folderId: string): Promise<void> {
    const userId = this.authStore.user()?.id;
    const existing = this.folders().find((f) => f.id === folderId);
    if (!userId || !existing) return;

    const descendants = collectDescendantFolderIds(
      folderId,
      this.foldersAsDirectoryFolders()
    );
    const removedIds = new Set<string>([folderId, ...descendants]);

    const affectedActors = this.actors().filter(
      (a) => a.folder_id && removedIds.has(a.folder_id)
    );

    this.folders.update((curr) => curr.filter((f) => !removedIds.has(f.id)));
    this.actors.update((curr) =>
      curr.map((a) =>
        a.folder_id && removedIds.has(a.folder_id)
          ? { ...a, folder_id: null }
          : a
      )
    );

    await Promise.all([
      ...Array.from(removedIds).map((fid) =>
        this.collectionsService.deleteFolder(fid, userId)
      ),
      ...affectedActors.map((actor) =>
        this.collectionsService.updateActor(actor.id, userId, {
          folder_id: null,
        })
      ),
    ]);
  }

  async createActorFromScratch(
    draft: ActorTemplateDraft,
    silent = false
  ): Promise<CollectionActorModel | null> {
    const userId = this.authStore.user()?.id;
    if (!userId) return null;

    const res = await this.collectionsService.createActor({
      owner_id: userId,
      folder_id: draft.folder_id || null,
      source_character_id: draft.source_character_id || null,
      actor_kind: draft.actor_kind,
      is_unique: draft.is_unique,
      name: draft.name.trim() || 'Unnamed Actor',
      faction: draft.faction,
      size: Math.max(1, Math.round(draft.size || 1)),
      icon: draft.icon || 'greatsword',
      color: draft.color || '#38B29A',
      max_hp: Math.max(1, Math.round(draft.max_hp || 10)),
      max_sp: Math.max(0, Math.round(draft.max_sp ?? 5)),
      max_ap: Math.max(1, Math.round(draft.max_ap || 4)),
      armor_dr: Math.max(0, Math.round(draft.armor_dr ?? 0)),
      shield_block: Math.max(0, Math.round(draft.shield_block ?? 0)),
      move_feet: Math.max(0, Math.round(draft.move_feet ?? 20)),
      vision_feet: Math.max(0, Math.round(draft.vision_feet ?? 60)),
      light_bright_feet: Math.max(0, Math.round(draft.light_bright_feet ?? 0)),
      light_dim_feet: Math.max(0, Math.round(draft.light_dim_feet ?? 0)),
      light_color: draft.light_color || '#F59E0B',
      npc_stats: { ...draft.npc_stats },
      notes: draft.notes ?? '',
      sort_order: this.actors().length,
    });

    if (res.error || !res.actor) {
      if (!silent) {
        this.notifications.error(
          'Unable to Save Actor',
          res.error ?? 'Unknown error.'
        );
      }
      return null;
    }

    this.actors.update((curr) =>
      curr.some((a) => a.id === res.actor!.id) ? curr : [...curr, res.actor!]
    );
    if (!silent) {
      this.notifications.success(
        'Saved to Collections',
        `${res.actor.name} added to your collection.`
      );
    }
    return res.actor;
  }

  async importCharacterToCollection(
    character: CharacterModel,
    folderId: string | null = null
  ): Promise<CollectionActorModel | null> {
    await this.compendiumStore.ensureLoaded();
    const draft = buildActorTemplateFromCharacter(
      character,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      folderId
    );
    return this.createActorFromScratch(draft);
  }

  async importNpcPresetToCollection(
    preset: VttNpcPreset,
    folderId: string | null = null
  ): Promise<CollectionActorModel | null> {
    const draft = buildActorTemplateFromNpcPreset(preset, folderId);
    return this.createActorFromScratch(draft);
  }

  async updateActor(
    actorId: string,
    patch: Partial<CollectionActorModel>
  ): Promise<boolean> {
    const userId = this.authStore.user()?.id;
    const existing = this.actors().find((a) => a.id === actorId);
    if (!userId || !existing) return false;

    this.actors.update((curr) =>
      curr.map((a) => (a.id === actorId ? { ...a, ...patch } : a))
    );

    const res = await this.collectionsService.updateActor(
      actorId,
      userId,
      patch
    );
    if (res.error) {
      this.notifications.error('Unable to Update Actor', res.error);
      return false;
    }
    return true;
  }

  async duplicateActor(actorId: string): Promise<CollectionActorModel | null> {
    const existing = this.actors().find((a) => a.id === actorId);
    if (!existing) return null;

    return this.createActorFromScratch({
      folder_id: existing.folder_id,
      source_character_id: existing.source_character_id,
      actor_kind: existing.actor_kind,
      is_unique: existing.is_unique,
      name: `${existing.name} (Copy)`,
      faction: existing.faction,
      size: existing.size,
      icon: existing.icon,
      color: existing.color,
      max_hp: existing.max_hp,
      max_sp: existing.max_sp,
      max_ap: existing.max_ap,
      armor_dr: existing.armor_dr,
      shield_block: existing.shield_block,
      move_feet: existing.move_feet,
      vision_feet: existing.vision_feet,
      light_bright_feet: existing.light_bright_feet,
      light_dim_feet: existing.light_dim_feet,
      light_color: existing.light_color,
      npc_stats: { ...existing.npc_stats },
      notes: existing.notes,
    });
  }

  async moveActorToFolder(
    actorId: string,
    folderId: string | null
  ): Promise<void> {
    await this.updateActor(actorId, { folder_id: folderId });
  }

  async deleteActor(actorId: string): Promise<void> {
    const userId = this.authStore.user()?.id;
    const existing = this.actors().find((a) => a.id === actorId);
    if (!userId || !existing) return;

    this.actors.update((curr) => curr.filter((a) => a.id !== actorId));
    const res = await this.collectionsService.deleteActor(actorId, userId);
    if (res.error) {
      this.notifications.error('Unable to Delete Actor', res.error);
    }
  }
}
