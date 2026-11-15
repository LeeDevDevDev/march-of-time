import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import {
  CharacterModel,
  PerkNodeModel,
  UPGRADE_SLOT_PREFIX,
  computeDerivedStats,
  getUpgradeSlotKey,
  normalizeInventoryItems,
  normalizeTokenAppearance,
  sanitizeOptionalImageUrl,
} from '../models/character.model';
import {
  CharacterService,
  normalizeCharacterRecord,
} from '../services/character.service';

interface CharacterState {
  characters: CharacterModel[];
  externalCharacters: CharacterModel[];
  adminDirectory: CharacterModel[];
  isLoading: boolean;
  isLoadingExternal: boolean;
  isLoadingDirectory: boolean;
  hasLoaded: boolean;
  hasLoadedDirectory: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly characterService = inject(CharacterService);
  private readonly authStore = inject(AuthStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly notifications = inject(NotificationStore);

  private userCharactersPromise: Promise<void> | null = null;
  private directoryPromise: Promise<void> | null = null;
  private readonly pendingCharacterLoads = new Map<string, Promise<void>>();
  private lastUserId: string | null = null;

  readonly #state = signal<CharacterState>({
    characters: [],
    externalCharacters: [],
    adminDirectory: [],
    isLoading: false,
    isLoadingExternal: false,
    isLoadingDirectory: false,
    hasLoaded: false,
    hasLoadedDirectory: false,
    error: null,
  });

  readonly characters = computed(() => this.#state().characters);
  readonly adminDirectory = computed(() => this.#state().adminDirectory);
  readonly isHydrating = computed(
    () => this.#state().isLoading && !this.#state().hasLoaded
  );
  readonly isLoadingDirectory = computed(
    () => this.#state().isLoadingDirectory
  );
  readonly isLoading = computed(
    () =>
      this.#state().isLoading ||
      this.#state().isLoadingExternal ||
      this.compendiumStore.isLoading()
  );
  readonly error = computed(() => this.#state().error);
  readonly defaultCharacterName = computed(() => {
    const username =
      this.authStore.displayName() ||
      this.authStore.handle() ||
      'Adventurer';
    return `${username}'s Character`;
  });

  readonly weapons = this.compendiumStore.weapons;
  readonly skillTrees = this.compendiumStore.skillTrees;
  readonly perkNodes = this.compendiumStore.perkNodes;
  readonly standaloneNodes = this.compendiumStore.standaloneNodes;
  readonly allWeapons = this.compendiumStore.allWeapons;
  readonly allSkillTrees = this.compendiumStore.allSkillTrees;
  readonly allPerkNodes = this.compendiumStore.allPerkNodes;
  readonly allStandaloneNodes = this.compendiumStore.allStandaloneNodes;

  constructor() {
    effect(() => {
      const userId = this.authStore.user()?.id ?? null;
      if (this.lastUserId !== null && userId !== this.lastUserId) {
        this.userCharactersPromise = null;
        this.directoryPromise = null;
        this.pendingCharacterLoads.clear();
        this.#state.set({
          characters: [],
          externalCharacters: [],
          adminDirectory: [],
          isLoading: false,
          isLoadingExternal: false,
          isLoadingDirectory: false,
          hasLoaded: false,
          hasLoadedDirectory: false,
          error: null,
        });
      }
      this.lastUserId = userId;
    });
  }

  ensureCompendiumLoaded(): Promise<void> {
    return this.compendiumStore.ensureLoaded();
  }

  ensureUserCharactersLoaded(): Promise<void> {
    if (this.#state().hasLoaded) {
      return Promise.resolve();
    }
    if (this.userCharactersPromise) {
      return this.userCharactersPromise;
    }

    const immediateUser = this.authStore.user();
    if (immediateUser) {
      return this.loadCharactersForUser(immediateUser.id);
    }

    if (this.authStore.isLoading()) {
      this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
      const waitTask = (async () => {
        try {
          await this.authStore.waitForInit();
          const resolvedUser = this.authStore.user();
          if (resolvedUser) {
            await this.fetchCharactersForUserInternal(resolvedUser.id);
          } else {
            this.#state.update((s) => ({ ...s, isLoading: false }));
          }
        } finally {
          this.userCharactersPromise = null;
        }
      })();
      this.userCharactersPromise = waitTask;
      return waitTask;
    }

    return Promise.resolve();
  }

  async ensureLoaded(): Promise<void> {
    await Promise.all([
      this.ensureUserCharactersLoaded(),
      this.compendiumStore.ensureLoaded(),
    ]);
  }

  loadCharactersForUser(userId: string): Promise<void> {
    if (this.userCharactersPromise) {
      return this.userCharactersPromise;
    }
    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
    const task = (async () => {
      try {
        await this.fetchCharactersForUserInternal(userId);
      } finally {
        this.userCharactersPromise = null;
      }
    })();
    this.userCharactersPromise = task;
    return task;
  }

  private async fetchCharactersForUserInternal(userId: string): Promise<void> {
    try {
      const { data, error } =
        await this.characterService.fetchCharactersByOwner(userId);

      if (error) {
        this.#state.update((s) => ({
          ...s,
          hasLoaded: true,
          isLoading: false,
          error,
        }));
        return;
      }

      this.#state.update((s) => ({
        ...s,
        characters: data,
        hasLoaded: true,
        isLoading: false,
      }));
    } catch {
      this.#state.update((s) => ({
        ...s,
        hasLoaded: true,
        isLoading: false,
      }));
    }
  }

  getCharacterById(id: string): CharacterModel | undefined {
    const state = this.#state();
    return (
      state.characters.find((c) => c.id === id) ??
      state.externalCharacters.find((c) => c.id === id) ??
      state.adminDirectory.find((c) => c.id === id)
    );
  }

  ensureCharacterLoaded(characterId: string): Promise<void> {
    if (!characterId || this.getCharacterById(characterId)) {
      return Promise.resolve();
    }
    const existingPromise = this.pendingCharacterLoads.get(characterId);
    if (existingPromise) {
      return existingPromise;
    }

    this.#state.update((s) => ({ ...s, isLoadingExternal: true }));
    const task = (async () => {
      try {
        const { data } =
          await this.characterService.fetchCharacterById(characterId);
        if (!data) return;
        this.#state.update((s) => ({
          ...s,
          externalCharacters: [
            ...s.externalCharacters.filter((c) => c.id !== data.id),
            data,
          ],
        }));
      } finally {
        this.pendingCharacterLoads.delete(characterId);
        this.#state.update((s) => ({
          ...s,
          isLoadingExternal: this.pendingCharacterLoads.size > 0,
        }));
      }
    })();

    this.pendingCharacterLoads.set(characterId, task);
    return task;
  }

  ensureAdminDirectoryLoaded(): Promise<void> {
    if (this.#state().hasLoadedDirectory) {
      return Promise.resolve();
    }
    if (this.directoryPromise) {
      return this.directoryPromise;
    }
    return this.loadAdminCharacterDirectory();
  }

  loadAdminCharacterDirectory(): Promise<void> {
    if (this.directoryPromise) {
      return this.directoryPromise;
    }
    if (!this.authStore.isAdmin() && !this.authStore.isLoading()) {
      return Promise.resolve();
    }
    this.#state.update((s) => ({ ...s, isLoadingDirectory: true }));
    const task = (async () => {
      try {
        if (this.authStore.isLoading()) {
          await this.authStore.waitForInit();
        }
        if (!this.authStore.isAdmin()) {
          return;
        }
        const { data } = await this.characterService.fetchAllCharacters();
        this.#state.update((s) => ({
          ...s,
          adminDirectory: data,
          hasLoadedDirectory: true,
        }));
      } finally {
        this.directoryPromise = null;
        this.#state.update((s) => ({ ...s, isLoadingDirectory: false }));
      }
    })();
    this.directoryPromise = task;
    return task;
  }

  upsertRealtimeCharacter(incoming: CharacterModel): void {
    const normalized = normalizeCharacterRecord(incoming);
    const currentUserId = this.authStore.user()?.id ?? null;
    this.#state.update((s) => {
      const isOwned = currentUserId !== null && normalized.owner_id === currentUserId;
      const hasInOwned = s.characters.some((c) => c.id === normalized.id);
      const nextCharacters = isOwned
        ? hasInOwned
          ? s.characters.map((c) => (c.id === normalized.id ? normalized : c))
          : s.hasLoaded
            ? [normalized, ...s.characters]
            : s.characters
        : s.characters.filter((c) => c.id !== normalized.id);

      const hasInExternal = s.externalCharacters.some(
        (c) => c.id === normalized.id
      );
      const nextExternal = !isOwned
        ? hasInExternal
          ? s.externalCharacters.map((c) =>
              c.id === normalized.id ? normalized : c
            )
          : [...s.externalCharacters, normalized]
        : hasInExternal
          ? s.externalCharacters.map((c) =>
              c.id === normalized.id ? normalized : c
            )
          : s.externalCharacters;

      const nextAdmin = s.adminDirectory.some((c) => c.id === normalized.id)
        ? s.adminDirectory.map((c) =>
            c.id === normalized.id ? normalized : c
          )
        : s.adminDirectory;

      return {
        ...s,
        characters: nextCharacters,
        externalCharacters: nextExternal,
        adminDirectory: nextAdmin,
      };
    });
  }

  async toggleAdminGrantedPerk(
    characterId: string,
    node: PerkNodeModel,
    allowGmOverride = false
  ): Promise<void> {
    if (!this.authStore.isAdmin() && !allowGmOverride) return;
    const target = this.getCharacterById(characterId);
    if (!target) return;
    const has = target.unlocked_perk_ids.includes(node.id);
    await this.updateCharacter(characterId, (c) => {
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      if (has) {
        delete nextCooldowns[node.id];
        delete nextCooldowns[getUpgradeSlotKey(node.id)];
        for (const [k, val] of Object.entries(nextCooldowns)) {
          if (k.startsWith(UPGRADE_SLOT_PREFIX) && val === node.id) {
            delete nextCooldowns[k];
          }
        }
      }
      return {
        ...c,
        unlocked_perk_ids: has
          ? c.unlocked_perk_ids.filter((id) => id !== node.id)
          : [...c.unlocked_perk_ids, node.id],
        active_cooldowns: nextCooldowns,
      };
    });
    this.notifications.success(
      has ? 'Standalone Ability Revoked' : 'Standalone Ability Granted',
      has
        ? `Removed "${node.name}" from ${target.name}.`
        : `Granted "${node.name}" to ${target.name}.`
    );
  }

  async createCharacter(
    draft: Omit<
      CharacterModel,
      'id' | 'owner_id' | 'current_hp' | 'current_sp' | 'current_ap' | 'active_cooldowns'
    >,
    options?: { silent?: boolean }
  ): Promise<CharacterModel | null> {
    const user = this.authStore.user();
    if (!user) return null;

    const derived = computeDerivedStats(
      draft,
      this.compendiumStore.weapons(),
      this.compendiumStore.perkNodes()
    );

    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const resolvedName =
        draft.name.trim() || this.defaultCharacterName();
      const { data, error } = await this.characterService.insertCharacter({
        owner_id: user.id,
        name: resolvedName,
        level: draft.level,
        attributes: draft.attributes,
        combat_skills: draft.combat_skills,
        field_skills: draft.field_skills,
        equipped_armor: draft.equipped_armor,
        equipped_shield: draft.equipped_shield,
        weapon_slot_1_id: draft.weapon_slot_1_id,
        weapon_slot_2_id: draft.weapon_slot_2_id,
        active_weapon_slot: draft.active_weapon_slot,
        unlocked_perk_ids: draft.unlocked_perk_ids,
        current_hp: derived.maxHp,
        current_sp: derived.maxSp,
        current_ap: 4,
        active_cooldowns: {},
        inventory: normalizeInventoryItems(draft.inventory),
        notes: draft.notes ?? '',
        portrait_url: sanitizeOptionalImageUrl(draft.portrait_url),
        token_image_url: sanitizeOptionalImageUrl(draft.token_image_url),
        token_appearance: normalizeTokenAppearance(draft.token_appearance),
      });

      if (error || !data) {
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error,
        }));
        return null;
      }

      this.#state.update((s) => ({
        ...s,
        characters: s.hasLoaded ? [data, ...s.characters] : s.characters,
        externalCharacters: s.hasLoaded
          ? s.externalCharacters
          : [data, ...s.externalCharacters.filter((c) => c.id !== data.id)],
        adminDirectory: s.hasLoadedDirectory
          ? [data, ...s.adminDirectory.filter((c) => c.id !== data.id)]
          : s.adminDirectory,
        isLoading: false,
      }));
      if (!options?.silent) {
        this.notifications.success(
          'Character Created',
          `${data.name} (Level ${data.level}) is ready for the table.`
        );
      }
      return data;
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
      return null;
    }
  }

  async updateCharacter(
    characterId: string,
    mutator: (char: CharacterModel) => CharacterModel
  ): Promise<void> {
    const current = this.getCharacterById(characterId);
    if (!current) return;

    const updated = mutator(current);
    const derived = computeDerivedStats(
      updated,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes()
    );

    const clamped: CharacterModel = {
      ...updated,
      current_hp: Math.min(updated.current_hp, derived.maxHp),
      current_sp: Math.min(updated.current_sp, derived.maxSp),
      inventory: normalizeInventoryItems(updated.inventory),
      notes: updated.notes ?? current.notes ?? '',
      portrait_url:
        updated.portrait_url !== undefined
          ? sanitizeOptionalImageUrl(updated.portrait_url)
          : sanitizeOptionalImageUrl(current.portrait_url),
      token_image_url:
        updated.token_image_url !== undefined
          ? sanitizeOptionalImageUrl(updated.token_image_url)
          : sanitizeOptionalImageUrl(current.token_image_url),
      token_appearance:
        updated.token_appearance !== undefined
          ? normalizeTokenAppearance(updated.token_appearance)
          : normalizeTokenAppearance(current.token_appearance),
    };

    this.#state.update((s) => ({
      ...s,
      characters: s.characters.map((c) => (c.id === characterId ? clamped : c)),
      externalCharacters: s.externalCharacters.map((c) =>
        c.id === characterId ? clamped : c
      ),
      adminDirectory: s.adminDirectory.map((c) =>
        c.id === characterId ? clamped : c
      ),
    }));

    const err = await this.characterService.updateCharacterRecord(
      characterId,
      clamped
    );
    if (err) {
      this.notifications.error('Unable to Update Character', err);
    }
  }

  async saveBuilderChanges(
    characterId: string,
    draft: Omit<
      CharacterModel,
      'id' | 'owner_id' | 'current_hp' | 'current_sp' | 'current_ap' | 'active_cooldowns'
    >
  ): Promise<CharacterModel | null> {
    const current = this.getCharacterById(characterId);
    if (!current) return null;

    const oldDerived = computeDerivedStats(
      current,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes()
    );
    const nextDerived = computeDerivedStats(
      draft,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes()
    );

    const hpDelta = Math.max(0, nextDerived.maxHp - oldDerived.maxHp);
    const spDelta = Math.max(0, nextDerived.maxSp - oldDerived.maxSp);

    const updated: CharacterModel = {
      ...current,
      name: draft.name.trim() || this.defaultCharacterName(),
      level: draft.level,
      attributes: draft.attributes,
      combat_skills: draft.combat_skills,
      field_skills: draft.field_skills,
      equipped_armor: draft.equipped_armor,
      equipped_shield: draft.equipped_shield,
      weapon_slot_1_id: draft.weapon_slot_1_id,
      weapon_slot_2_id: draft.weapon_slot_2_id,
      unlocked_perk_ids: draft.unlocked_perk_ids,
      current_hp: Math.min(nextDerived.maxHp, current.current_hp + hpDelta),
      current_sp: Math.min(nextDerived.maxSp, current.current_sp + spDelta),
      inventory:
        draft.inventory !== undefined
          ? normalizeInventoryItems(draft.inventory)
          : normalizeInventoryItems(current.inventory),
      notes: draft.notes !== undefined ? draft.notes : (current.notes ?? ''),
      portrait_url:
        draft.portrait_url !== undefined
          ? sanitizeOptionalImageUrl(draft.portrait_url)
          : sanitizeOptionalImageUrl(current.portrait_url),
      token_image_url:
        draft.token_image_url !== undefined
          ? sanitizeOptionalImageUrl(draft.token_image_url)
          : sanitizeOptionalImageUrl(current.token_image_url),
      token_appearance:
        draft.token_appearance !== undefined
          ? normalizeTokenAppearance(draft.token_appearance)
          : normalizeTokenAppearance(current.token_appearance),
    };

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      characters: s.characters.map((c) => (c.id === characterId ? updated : c)),
      externalCharacters: s.externalCharacters.map((c) =>
        c.id === characterId ? updated : c
      ),
      adminDirectory: s.adminDirectory.map((c) =>
        c.id === characterId ? updated : c
      ),
    }));

    try {
      await this.characterService.updateCharacterRecord(characterId, updated);
      this.#state.update((s) => ({ ...s, isLoading: false }));
      this.notifications.success(
        'Character Updated',
        `Saved changes to ${updated.name} (Level ${updated.level}).`
      );
      return updated;
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
      return null;
    }
  }

  async deleteCharacter(characterId: string): Promise<void> {
    const existing = this.getCharacterById(characterId);
    const err = await this.characterService.deleteCharacterRecord(characterId);

    if (!err) {
      this.#state.update((s) => ({
        ...s,
        characters: s.characters.filter((c) => c.id !== characterId),
        externalCharacters: s.externalCharacters.filter(
          (c) => c.id !== characterId
        ),
        adminDirectory: s.adminDirectory.filter((c) => c.id !== characterId),
      }));
      this.notifications.info(
        'Character Deleted',
        `Removed "${existing?.name ?? 'Character'}" from your roster.`
      );
    } else {
      this.notifications.error('Unable to Delete Character', err);
    }
  }
}
