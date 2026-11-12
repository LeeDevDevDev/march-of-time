import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import {
  CharacterModel,
  PerkNodeModel,
  computeDerivedStats,
} from '../models/character.model';
import { CharacterService } from '../services/character.service';

interface CharacterState {
  characters: CharacterModel[];
  externalCharacters: CharacterModel[];
  adminDirectory: CharacterModel[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly characterService = inject(CharacterService);
  private readonly authStore = inject(AuthStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly notifications = inject(NotificationStore);

  readonly #state = signal<CharacterState>({
    characters: [],
    externalCharacters: [],
    adminDirectory: [],
    isLoading: false,
    error: null,
  });

  readonly characters = computed(() => this.#state().characters);
  readonly adminDirectory = computed(() => this.#state().adminDirectory);
  readonly isLoading = computed(
    () => this.#state().isLoading || this.compendiumStore.isLoading()
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
      const user = this.authStore.user();
      if (user) {
        void this.loadCharactersForUser(user.id);
      } else {
        this.#state.update((s) => ({
          ...s,
          characters: [],
          externalCharacters: [],
          adminDirectory: [],
          error: null,
        }));
      }
    });
  }

  async loadCharactersForUser(userId: string): Promise<void> {
    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const { data, error } =
        await this.characterService.fetchCharactersByOwner(userId);

      if (error) {
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error,
        }));
        return;
      }

      this.#state.update((s) => ({
        ...s,
        characters: data,
        isLoading: false,
      }));
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
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

  async ensureCharacterLoaded(characterId: string): Promise<void> {
    if (!characterId || this.getCharacterById(characterId)) return;
    const { data } = await this.characterService.fetchCharacterById(characterId);
    if (!data) return;
    this.#state.update((s) => ({
      ...s,
      externalCharacters: [
        ...s.externalCharacters.filter((c) => c.id !== data.id),
        data,
      ],
    }));
  }

  async loadAdminCharacterDirectory(): Promise<void> {
    if (!this.authStore.isAdmin()) return;
    const { data } = await this.characterService.fetchAllCharacters();
    this.#state.update((s) => ({
      ...s,
      adminDirectory: data,
    }));
  }

  async toggleAdminGrantedPerk(
    characterId: string,
    node: PerkNodeModel
  ): Promise<void> {
    if (!this.authStore.isAdmin()) return;
    const target = this.getCharacterById(characterId);
    if (!target) return;
    const has = target.unlocked_perk_ids.includes(node.id);
    await this.updateCharacter(characterId, (c) => {
      const nextCooldowns = { ...(c.active_cooldowns ?? {}) };
      if (has) {
        delete nextCooldowns[node.id];
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
    >
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
        characters: [data, ...s.characters],
        adminDirectory: s.adminDirectory.length > 0 ? [data, ...s.adminDirectory] : s.adminDirectory,
        isLoading: false,
      }));
      this.notifications.success(
        'Character Created',
        `${data.name} (Level ${data.level}) is ready for the table.`
      );
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
    };

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      characters: s.characters.map((c) => (c.id === characterId ? updated : c)),
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
