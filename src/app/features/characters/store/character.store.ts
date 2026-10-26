import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import {
  CharacterModel,
  computeDerivedStats,
} from '../models/character.model';

interface CharacterState {
  characters: CharacterModel[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  private readonly supabase = inject(SupabaseService).client;
  private readonly authStore = inject(AuthStore);
  private readonly compendiumStore = inject(CompendiumStore);

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
  readonly weapons = this.compendiumStore.weapons;
  readonly skillTrees = this.compendiumStore.skillTrees;
  readonly perkNodes = this.compendiumStore.perkNodes;

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
      const { data, error } = await this.supabase
        .from('characters')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      this.#state.update((s) => ({
        ...s,
        characters: (data as CharacterModel[]) ?? [],
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
      const { data, error } = await this.supabase
        .from('characters')
        .insert({
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
        })
        .select('*')
        .single();

      if (error || !data) {
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error: error?.message ?? 'Could not create character.',
        }));
        return null;
      }

      const created = data as CharacterModel;
      this.#state.update((s) => ({
        ...s,
        characters: [created, ...s.characters],
        isLoading: false,
      }));
      return created;
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
      this.compendiumStore.weapons(),
      this.compendiumStore.perkNodes()
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

    await this.supabase
      .from('characters')
      .update({
        name: clamped.name,
        level: clamped.level,
        attributes: clamped.attributes,
        combat_skills: clamped.combat_skills,
        field_skills: clamped.field_skills,
        equipped_armor: clamped.equipped_armor,
        equipped_shield: clamped.equipped_shield,
        weapon_slot_1_id: clamped.weapon_slot_1_id,
        weapon_slot_2_id: clamped.weapon_slot_2_id,
        active_weapon_slot: clamped.active_weapon_slot,
        unlocked_perk_ids: clamped.unlocked_perk_ids,
        current_hp: clamped.current_hp,
        current_sp: clamped.current_sp,
        current_ap: clamped.current_ap,
        active_cooldowns: clamped.active_cooldowns,
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId);
  }

  async deleteCharacter(characterId: string): Promise<void> {
    const { error } = await this.supabase
      .from('characters')
      .delete()
      .eq('id', characterId);

    if (!error) {
      this.#state.update((s) => ({
        ...s,
        characters: s.characters.filter((c) => c.id !== characterId),
      }));
    }
  }
}
