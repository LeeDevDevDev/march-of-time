import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import {
  CharacterModel,
  computeDerivedStats,
} from '../models/character.model';
import { CharacterService } from '../services/character.service';

interface CharacterState {
  characters: CharacterModel[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly characterService = inject(CharacterService);
  private readonly authStore = inject(AuthStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly notifications = inject(NotificationStore);

  // Private encapsulated Signal State — manages ONLY the user's characters
  readonly #state = signal<CharacterState>({
    characters: [],
    isLoading: false,
    error: null,
  });

  // Public Readonly Selectors
  readonly characters = computed(() => this.#state().characters);
  readonly isLoading = computed(
    () => this.#state().isLoading || this.compendiumStore.isLoading()
  );
  readonly error = computed(() => this.#state().error);

  // Read-only Compendium selectors delegated from CompendiumStore
  // Active items for building new characters:
  readonly weapons = this.compendiumStore.weapons;
  readonly skillTrees = this.compendiumStore.skillTrees;
  readonly perkNodes = this.compendiumStore.perkNodes;
  // All items (including archived) so existing characters never lose equipped stats:
  readonly allWeapons = this.compendiumStore.allWeapons;
  readonly allSkillTrees = this.compendiumStore.allSkillTrees;
  readonly allPerkNodes = this.compendiumStore.allPerkNodes;

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user) {
        void this.loadCharactersForUser(user.id);
      } else {
        this.#state.update((s) => ({
          ...s,
          characters: [],
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
    return this.#state().characters.find((c) => c.id === id);
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
      const { data, error } = await this.characterService.insertCharacter({
        owner_id: user.id,
        name: draft.name.trim() || 'Unnamed Warden',
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
    }));

    await this.characterService.updateCharacterRecord(characterId, clamped);
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
