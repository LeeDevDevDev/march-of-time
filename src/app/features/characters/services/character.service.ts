import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import {
  CharacterModel,
  DEFAULT_TOKEN_APPEARANCE,
  TokenAppearanceConfig,
  hasCustomTokenAppearance,
  normalizeInventoryItems,
  normalizeTokenAppearance,
  sanitizeOptionalImageUrl,
} from '../models/character.model';

const CHARACTER_LEGACY_VISUALS_KEY = '__visuals_json';

interface LegacyCharacterVisualsBlob {
  portrait_url?: string | null;
  token_image_url?: string | null;
  token_appearance?: TokenAppearanceConfig;
}

function isMissingCharacterColumnError(
  code?: string,
  message?: string
): boolean {
  if (code === 'PGRST204' || code === '42703') {
    return true;
  }
  const msg = (message ?? '').toLowerCase();
  return (
    (msg.includes('inventory') ||
      msg.includes('notes') ||
      msg.includes('portrait_url') ||
      msg.includes('token_image_url') ||
      msg.includes('token_appearance')) &&
    (msg.includes('column') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

function extractCleanCooldownsAndLegacyVisuals(rawCooldowns: unknown): {
  cleanCooldowns: Record<string, number | string>;
  legacyVisuals: LegacyCharacterVisualsBlob | null;
} {
  if (
    !rawCooldowns ||
    typeof rawCooldowns !== 'object' ||
    Array.isArray(rawCooldowns)
  ) {
    return { cleanCooldowns: {}, legacyVisuals: null };
  }
  const source = rawCooldowns as Record<string, unknown>;
  const cleanCooldowns: Record<string, number | string> = {};
  let legacyVisuals: LegacyCharacterVisualsBlob | null = null;

  for (const [key, val] of Object.entries(source)) {
    if (key === CHARACTER_LEGACY_VISUALS_KEY) {
      if (typeof val === 'string' && val.trim().length > 0) {
        try {
          const parsed = JSON.parse(val) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            legacyVisuals = parsed as LegacyCharacterVisualsBlob;
          }
        } catch {
          legacyVisuals = null;
        }
      }
      continue;
    }
    if (typeof val === 'number' || typeof val === 'string') {
      cleanCooldowns[key] = val;
    }
  }

  return { cleanCooldowns, legacyVisuals };
}

function buildFallbackCooldownsWithVisuals(
  cleanCooldowns: Record<string, number | string>,
  portraitUrl: string | null,
  tokenImageUrl: string | null,
  tokenAppearance: TokenAppearanceConfig
): Record<string, number | string> {
  const next = { ...cleanCooldowns };
  delete next[CHARACTER_LEGACY_VISUALS_KEY];
  if (
    portraitUrl ||
    tokenImageUrl ||
    hasCustomTokenAppearance(tokenAppearance)
  ) {
    next[CHARACTER_LEGACY_VISUALS_KEY] = JSON.stringify({
      portrait_url: portraitUrl,
      token_image_url: tokenImageUrl,
      token_appearance: tokenAppearance,
    });
  }
  return next;
}

export function normalizeCharacterRecord(
  row: CharacterModel | Record<string, unknown>
): CharacterModel {
  const base = row as CharacterModel & Record<string, unknown>;
  const { cleanCooldowns, legacyVisuals } =
    extractCleanCooldownsAndLegacyVisuals(base.active_cooldowns);

  const portraitUrl =
    sanitizeOptionalImageUrl(base['portrait_url']) ??
    sanitizeOptionalImageUrl(legacyVisuals?.portrait_url);
  const tokenImageUrl =
    sanitizeOptionalImageUrl(base['token_image_url']) ??
    sanitizeOptionalImageUrl(legacyVisuals?.token_image_url);

  const rawAppearance =
    base['token_appearance'] &&
    typeof base['token_appearance'] === 'object' &&
    !Array.isArray(base['token_appearance']) &&
    Object.keys(base['token_appearance'] as unknown as Record<string, unknown>)
      .length > 0
      ? base['token_appearance']
      : (legacyVisuals?.token_appearance ?? DEFAULT_TOKEN_APPEARANCE);

  return {
    ...base,
    unlocked_perk_ids: Array.isArray(base.unlocked_perk_ids)
      ? base.unlocked_perk_ids
      : [],
    active_cooldowns: cleanCooldowns,
    inventory: normalizeInventoryItems(base['inventory']),
    notes: typeof base['notes'] === 'string' ? base['notes'] : '',
    portrait_url: portraitUrl,
    token_image_url: tokenImageUrl,
    token_appearance: normalizeTokenAppearance(rawAppearance),
  };
}

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
    return {
      data: ((data as CharacterModel[]) ?? []).map(normalizeCharacterRecord),
      error: null,
    };
  }

  async fetchAllCharacters(): Promise<{
    data: CharacterModel[];
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('characters')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }
    return {
      data: ((data as CharacterModel[]) ?? []).map(normalizeCharacterRecord),
      error: null,
    };
  }

  async fetchCharacterById(
    characterId: string
  ): Promise<{ data: CharacterModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    return {
      data: data ? normalizeCharacterRecord(data as CharacterModel) : null,
      error: null,
    };
  }

  async insertCharacter(
    payload: Omit<CharacterModel, 'id'>
  ): Promise<{ data: CharacterModel | null; error: string | null }> {
    const normalizedInventory = normalizeInventoryItems(payload.inventory);
    const normalizedNotes =
      typeof payload.notes === 'string' ? payload.notes : '';
    const normalizedPortrait = sanitizeOptionalImageUrl(payload.portrait_url);
    const normalizedTokenImg = sanitizeOptionalImageUrl(
      payload.token_image_url
    );
    const normalizedAppearance = normalizeTokenAppearance(
      payload.token_appearance
    );
    const { cleanCooldowns } = extractCleanCooldownsAndLegacyVisuals(
      payload.active_cooldowns
    );

    const fullPayload = {
      ...payload,
      active_cooldowns: cleanCooldowns,
      inventory: normalizedInventory,
      notes: normalizedNotes,
      portrait_url: normalizedPortrait,
      token_image_url: normalizedTokenImg,
      token_appearance: normalizedAppearance,
    };

    const { data, error } = await this.supabase
      .from('characters')
      .insert(fullPayload)
      .select('*')
      .single();

    if (error && isMissingCharacterColumnError(error.code, error.message)) {
      const fallbackCooldowns = buildFallbackCooldownsWithVisuals(
        cleanCooldowns,
        normalizedPortrait,
        normalizedTokenImg,
        normalizedAppearance
      );
      const pre0017Payload: Record<string, unknown> = {
        ...payload,
        active_cooldowns: fallbackCooldowns,
        inventory: normalizedInventory,
        notes: normalizedNotes,
      };
      delete pre0017Payload['portrait_url'];
      delete pre0017Payload['token_image_url'];
      delete pre0017Payload['token_appearance'];

      const pre0017Retry = await this.supabase
        .from('characters')
        .insert(pre0017Payload)
        .select('*')
        .single();

      if (!pre0017Retry.error && pre0017Retry.data) {
        return {
          data: normalizeCharacterRecord({
            ...(pre0017Retry.data as CharacterModel),
            portrait_url: normalizedPortrait,
            token_image_url: normalizedTokenImg,
            token_appearance: normalizedAppearance,
          }),
          error: null,
        };
      }

      if (
        pre0017Retry.error &&
        isMissingCharacterColumnError(
          pre0017Retry.error.code,
          pre0017Retry.error.message
        )
      ) {
        const legacyPayload: Record<string, unknown> = { ...pre0017Payload };
        delete legacyPayload['inventory'];
        delete legacyPayload['notes'];
        const retry = await this.supabase
          .from('characters')
          .insert(legacyPayload)
          .select('*')
          .single();
        if (retry.error || !retry.data) {
          return {
            data: null,
            error: retry.error?.message ?? 'Could not create character.',
          };
        }
        return {
          data: normalizeCharacterRecord({
            ...(retry.data as CharacterModel),
            inventory: normalizedInventory,
            notes: normalizedNotes,
            portrait_url: normalizedPortrait,
            token_image_url: normalizedTokenImg,
            token_appearance: normalizedAppearance,
          }),
          error: null,
        };
      }

      return {
        data: null,
        error: pre0017Retry.error?.message ?? 'Could not create character.',
      };
    }

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Could not create character.',
      };
    }
    return { data: normalizeCharacterRecord(data as CharacterModel), error: null };
  }

  async updateCharacterRecord(
    characterId: string,
    clamped: CharacterModel
  ): Promise<string | null> {
    const { cleanCooldowns } = extractCleanCooldownsAndLegacyVisuals(
      clamped.active_cooldowns
    );
    const normalizedPortrait = sanitizeOptionalImageUrl(clamped.portrait_url);
    const normalizedTokenImg = sanitizeOptionalImageUrl(
      clamped.token_image_url
    );
    const normalizedAppearance = normalizeTokenAppearance(
      clamped.token_appearance
    );

    const basePatch = {
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
      active_cooldowns: cleanCooldowns,
      updated_at: new Date().toISOString(),
    };

    const with0016Patch = {
      ...basePatch,
      inventory: normalizeInventoryItems(clamped.inventory),
      notes: typeof clamped.notes === 'string' ? clamped.notes : '',
    };

    const fullPatch = {
      ...with0016Patch,
      portrait_url: normalizedPortrait,
      token_image_url: normalizedTokenImg,
      token_appearance: normalizedAppearance,
    };

    const { error } = await this.supabase
      .from('characters')
      .update(fullPatch)
      .eq('id', characterId);

    if (error && isMissingCharacterColumnError(error.code, error.message)) {
      const fallbackCooldowns = buildFallbackCooldownsWithVisuals(
        cleanCooldowns,
        normalizedPortrait,
        normalizedTokenImg,
        normalizedAppearance
      );
      const pre0017Patch = {
        ...with0016Patch,
        active_cooldowns: fallbackCooldowns,
      };
      const pre0017Retry = await this.supabase
        .from('characters')
        .update(pre0017Patch)
        .eq('id', characterId);

      if (!pre0017Retry.error) {
        return null;
      }

      if (
        isMissingCharacterColumnError(
          pre0017Retry.error.code,
          pre0017Retry.error.message
        )
      ) {
        const legacyRetry = await this.supabase
          .from('characters')
          .update({
            ...basePatch,
            active_cooldowns: fallbackCooldowns,
          })
          .eq('id', characterId);
        return legacyRetry.error?.message ?? null;
      }

      return pre0017Retry.error.message;
    }

    return error?.message ?? null;
  }

  async deleteCharacterRecord(characterId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('characters')
      .delete()
      .eq('id', characterId);
    return error?.message ?? null;
  }
}
