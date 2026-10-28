import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { CharacterModel } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly supabase = inject(SupabaseService).client;

  async fetchCharactersByOwner(
    userId: string
  ): Promise<{ data: CharacterModel[]; error: string | null }> {
    const { data, error } = await this.supabase
      .from('characters')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }
    return { data: (data as CharacterModel[]) ?? [], error: null };
  }

  async insertCharacter(
    payload: Omit<CharacterModel, 'id'>
  ): Promise<{ data: CharacterModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('characters')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Could not create character.',
      };
    }
    return { data: data as CharacterModel, error: null };
  }

  async updateCharacterRecord(
    characterId: string,
    clamped: CharacterModel
  ): Promise<void> {
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

  async deleteCharacterRecord(characterId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('characters')
      .delete()
      .eq('id', characterId);
    return error?.message ?? null;
  }
}
