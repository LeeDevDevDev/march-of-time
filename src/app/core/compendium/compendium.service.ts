import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DEFAULT_KEYWORDS,
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
} from './compendium.model';

const LOCAL_KEYWORDS_STORAGE_KEY = 'mot.compendium.keywords';
const LOCAL_TREE_VISUALS_KEY = 'mot.compendium.tree_visuals';
const LOCAL_WEAPON_HOOKS_KEY = 'mot.compendium.weapon_hooks';
const LOCAL_WEAPON_OVERRIDES_KEY = 'mot.compendium.weapon_overrides';
const LOCAL_DELETED_WEAPONS_KEY = 'mot.compendium.deleted_weapon_ids';
const LOCAL_ACTIVE_OVERRIDES_KEY = 'mot.compendium.active_overrides';

export interface StoredVisualOverride {
  icon?: string | null;
  icon_color?: string | null;
  icon_tint_custom?: boolean | null;
}

export function slugifyText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

@Injectable({ providedIn: 'root' })
export class CompendiumService {
  private readonly supabase = inject(SupabaseService).client;

  // ===========================================================================
  // LOCAL PERSISTENCE & FALLBACK HELPERS
  // ===========================================================================

  loadFallbackKeywords(): KeywordDefinition[] {
    try {
      const saved = localStorage.getItem(LOCAL_KEYWORDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as KeywordDefinition[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_KEYWORDS;
  }

  saveFallbackKeywords(list: KeywordDefinition[]): void {
    try {
      localStorage.setItem(LOCAL_KEYWORDS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore storage errors
    }
  }

  loadActiveOverrides(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(LOCAL_ACTIVE_OVERRIDES_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, boolean>;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  }

  saveActiveOverride(itemKey: string, isActive: boolean): void {
    try {
      const current = this.loadActiveOverrides();
      current[itemKey] = isActive;
      localStorage.setItem(LOCAL_ACTIVE_OVERRIDES_KEY, JSON.stringify(current));
    } catch {
      // ignore storage errors
    }
  }

  loadTreeVisualOverrides(): Record<string, StoredVisualOverride> {
    try {
      const raw = localStorage.getItem(LOCAL_TREE_VISUALS_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, StoredVisualOverride>;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  }

  saveTreeVisualOverride(treeId: string, visual: StoredVisualOverride): void {
    try {
      const current = this.loadTreeVisualOverrides();
      current[treeId] = visual;
      localStorage.setItem(LOCAL_TREE_VISUALS_KEY, JSON.stringify(current));
    } catch {
      // ignore storage errors
    }
  }

  loadWeaponHookOverrides(): Record<string, Record<string, unknown>> {
    try {
      const raw = localStorage.getItem(LOCAL_WEAPON_HOOKS_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, Record<string, unknown>>;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  }

  saveWeaponHookOverride(weaponId: string, hooks: Record<string, unknown>): void {
    try {
      const current = this.loadWeaponHookOverrides();
      current[weaponId] = hooks;
      localStorage.setItem(LOCAL_WEAPON_HOOKS_KEY, JSON.stringify(current));
    } catch {
      // ignore storage errors
    }
  }

  loadWeaponOverrides(): Record<string, Partial<WeaponModel>> {
    try {
      const raw = localStorage.getItem(LOCAL_WEAPON_OVERRIDES_KEY);
      if (raw) {
        return JSON.parse(raw) as Record<string, Partial<WeaponModel>>;
      }
    } catch {
      // ignore storage errors
    }
    return {};
  }

  saveWeaponOverride(weaponId: string, patch: Partial<WeaponModel>): void {
    try {
      const current = this.loadWeaponOverrides();
      current[weaponId] = { ...(current[weaponId] ?? {}), ...patch };
      localStorage.setItem(LOCAL_WEAPON_OVERRIDES_KEY, JSON.stringify(current));
    } catch {
      // ignore storage errors
    }
  }

  loadDeletedWeaponIds(): string[] {
    try {
      const raw = localStorage.getItem(LOCAL_DELETED_WEAPONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  }

  markWeaponDeletedLocal(weaponId: string): void {
    try {
      const current = new Set(this.loadDeletedWeaponIds());
      current.add(weaponId);
      localStorage.setItem(
        LOCAL_DELETED_WEAPONS_KEY,
        JSON.stringify(Array.from(current))
      );
    } catch {
      // ignore storage errors
    }
  }

  // ===========================================================================
  // SUPABASE COMPENDIUM FETCH
  // ===========================================================================

  async fetchFullCompendium(): Promise<{
    weapons: WeaponModel[];
    skillTrees: SkillTreeModel[];
    perkNodes: PerkNodeModel[];
    keywords: KeywordDefinition[];
  }> {
    const [wepsRes, treesRes, perksRes, kwRes] = await Promise.all([
      this.supabase.from('weapons').select('*').order('name'),
      this.supabase.from('skill_trees').select('*').order('name'),
      this.supabase
        .from('perk_nodes')
        .select('*')
        .order('tier', { ascending: true })
        .order('name', { ascending: true }),
      this.supabase.from('compendium_keywords').select('*').order('term'),
    ]);

    const activeOverrides = this.loadActiveOverrides();

    const rawKeywords =
      !kwRes.error && kwRes.data && kwRes.data.length > 0
        ? (kwRes.data as KeywordDefinition[])
        : this.loadFallbackKeywords();

    const dbKeywords = rawKeywords.map((kw) => {
      const key = `kw:${kw.term.toLowerCase()}`;
      const isActive =
        typeof activeOverrides[key] === 'boolean'
          ? activeOverrides[key]
          : kw.is_active !== false;
      return {
        ...kw,
        is_active: isActive,
      };
    });

    this.saveFallbackKeywords(dbKeywords);

    const treeVisuals = this.loadTreeVisualOverrides();
    const mergedTrees = ((treesRes.data as SkillTreeModel[]) ?? []).map((t) => {
      const localVis = treeVisuals[t.id];
      const key = `tree:${t.id}`;
      const isActive =
        typeof activeOverrides[key] === 'boolean'
          ? activeOverrides[key]
          : t.is_active !== false;
      return {
        ...t,
        icon: t.icon ?? localVis?.icon ?? null,
        icon_color: t.icon_color ?? localVis?.icon_color ?? null,
        icon_tint_custom:
          t.icon_tint_custom ?? localVis?.icon_tint_custom ?? true,
        is_active: isActive,
      };
    });

    const mergedPerks = ((perksRes.data as PerkNodeModel[]) ?? []).map((p) => {
      const key = `node:${p.id}`;
      const isActive =
        typeof activeOverrides[key] === 'boolean'
          ? activeOverrides[key]
          : p.is_active !== false && p.rule_hooks?.__is_active !== false;
      return {
        ...p,
        is_active: isActive,
      };
    });

    const weaponHooks = this.loadWeaponHookOverrides();
    const weaponPatches = this.loadWeaponOverrides();
    const deletedWeaponIds = new Set(this.loadDeletedWeaponIds());

    const mergedWeapons = ((wepsRes.data as WeaponModel[]) ?? [])
      .filter((w) => !deletedWeaponIds.has(w.id))
      .map((w) => {
        const localPatch = weaponPatches[w.id] ?? {};
        const localHooks = weaponHooks[w.id] ?? {};
        const combinedHooks = {
          ...(w.rule_hooks ?? {}),
          ...(localPatch.rule_hooks ?? {}),
          ...localHooks,
        };
        const key = `wep:${w.id}`;
        const isActive =
          typeof activeOverrides[key] === 'boolean'
            ? activeOverrides[key]
            : w.is_active !== false && combinedHooks['__is_active'] !== false;
        return {
          ...w,
          ...localPatch,
          is_active: isActive,
          rule_hooks: combinedHooks,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      weapons: mergedWeapons,
      skillTrees: mergedTrees,
      perkNodes: mergedPerks,
      keywords: dbKeywords,
    };
  }

  // ===========================================================================
  // KEYWORDS API
  // ===========================================================================

  async insertKeyword(input: {
    term: string;
    category: string;
    summary: string;
  }): Promise<KeywordDefinition> {
    const { data, error } = await this.supabase
      .from('compendium_keywords')
      .insert(input)
      .select('*')
      .single();

    if (!error && data) {
      return { ...(data as KeywordDefinition), is_active: true };
    }
    return {
      id: `kw-${slugifyText(input.term)}-${Date.now()}`,
      ...input,
      is_active: true,
    };
  }

  async updateKeywordRecord(
    idOrTerm: string,
    input: { term: string; category: string; summary: string }
  ): Promise<void> {
    if (idOrTerm && !idOrTerm.startsWith('kw-')) {
      await this.supabase
        .from('compendium_keywords')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idOrTerm);
    } else {
      await this.supabase
        .from('compendium_keywords')
        .upsert(input, { onConflict: 'term' });
    }
  }

  async updateKeywordActiveStatus(
    kw: KeywordDefinition,
    isActive: boolean
  ): Promise<void> {
    this.saveActiveOverride(`kw:${kw.term.toLowerCase()}`, isActive);
    if (kw.id && !kw.id.startsWith('kw-')) {
      await this.supabase
        .from('compendium_keywords')
        .update({ is_active: isActive })
        .eq('id', kw.id);
    } else {
      await this.supabase
        .from('compendium_keywords')
        .update({ is_active: isActive })
        .eq('term', kw.term);
    }
  }

  async deleteKeywordRecord(kw: KeywordDefinition): Promise<void> {
    if (kw.id && !kw.id.startsWith('kw-')) {
      await this.supabase.from('compendium_keywords').delete().eq('id', kw.id);
    } else {
      await this.supabase
        .from('compendium_keywords')
        .delete()
        .eq('term', kw.term);
    }
  }

  // ===========================================================================
  // SKILL TREES & PERK NODES API
  // ===========================================================================

  async insertSkillTree(input: {
    name: string;
    slug: string;
    description: string;
    icon?: string | null;
    icon_color?: string | null;
    icon_tint_custom?: boolean | null;
  }): Promise<{ data: SkillTreeModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('skill_trees')
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description,
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error:
          error?.message ??
          'Unable to create skill tree. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      };
    }

    const baseCreated = data as SkillTreeModel;
    const created: SkillTreeModel = {
      ...baseCreated,
      is_active: true,
      icon: input.icon ?? baseCreated.icon ?? 'greatsword',
      icon_color: input.icon_color ?? baseCreated.icon_color ?? '#FF8C5A',
      icon_tint_custom:
        input.icon_tint_custom ?? baseCreated.icon_tint_custom ?? true,
    };

    this.saveTreeVisualOverride(created.id, {
      icon: created.icon,
      icon_color: created.icon_color,
      icon_tint_custom: created.icon_tint_custom,
    });

    void this.supabase
      .from('skill_trees')
      .update({
        icon: created.icon,
        icon_color: created.icon_color,
        icon_tint_custom: created.icon_tint_custom,
      })
      .eq('id', created.id);

    return { data: created, error: null };
  }

  async updateSkillTreeRecord(
    treeId: string,
    input: {
      name: string;
      description: string;
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
      is_active?: boolean;
    }
  ): Promise<{ data: SkillTreeModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('skill_trees')
      .update({
        name: input.name,
        description: input.description,
      })
      .eq('id', treeId)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error:
          error?.message ??
          'Unable to update skill tree. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      };
    }

    const baseUpdated = data as SkillTreeModel;
    const updated: SkillTreeModel = {
      ...baseUpdated,
      is_active: input.is_active ?? baseUpdated.is_active ?? true,
      icon: input.icon ?? baseUpdated.icon ?? null,
      icon_color: input.icon_color ?? baseUpdated.icon_color ?? null,
      icon_tint_custom:
        input.icon_tint_custom ?? baseUpdated.icon_tint_custom ?? true,
    };

    this.saveTreeVisualOverride(treeId, {
      icon: updated.icon,
      icon_color: updated.icon_color,
      icon_tint_custom: updated.icon_tint_custom,
    });

    void this.supabase
      .from('skill_trees')
      .update({
        icon: updated.icon,
        icon_color: updated.icon_color,
        icon_tint_custom: updated.icon_tint_custom,
      })
      .eq('id', treeId);

    return { data: updated, error: null };
  }

  async updateSkillTreeActiveStatus(
    treeId: string,
    isActive: boolean
  ): Promise<void> {
    this.saveActiveOverride(`tree:${treeId}`, isActive);
    await this.supabase
      .from('skill_trees')
      .update({ is_active: isActive })
      .eq('id', treeId);
  }

  async deleteSkillTreeRecord(treeId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('skill_trees')
      .delete()
      .eq('id', treeId);
    return error?.message ?? null;
  }

  async insertPerkNode(
    payload: Record<string, unknown>,
    visuals: {
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
    }
  ): Promise<{ data: PerkNodeModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('perk_nodes')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error:
          error?.message ??
          'Unable to create node. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      };
    }

    const created = { ...(data as PerkNodeModel), is_active: true };

    void this.supabase
      .from('perk_nodes')
      .update({
        icon: visuals.icon ?? null,
        icon_color: visuals.icon_color ?? null,
        icon_tint_custom: visuals.icon_tint_custom ?? true,
      })
      .eq('id', created.id);

    return { data: created, error: null };
  }

  async updatePerkNodeRecord(
    nodeId: string,
    payload: Record<string, unknown>,
    visuals: {
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
      is_active?: boolean;
    }
  ): Promise<{ data: PerkNodeModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('perk_nodes')
      .update(payload)
      .eq('id', nodeId)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error:
          error?.message ??
          'Unable to update node. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      };
    }

    void this.supabase
      .from('perk_nodes')
      .update({
        icon: visuals.icon ?? null,
        icon_color: visuals.icon_color ?? null,
        icon_tint_custom: visuals.icon_tint_custom ?? true,
      })
      .eq('id', nodeId);

    const updated: PerkNodeModel = {
      ...(data as PerkNodeModel),
      is_active: visuals.is_active ?? true,
      icon: visuals.icon ?? null,
      icon_color: visuals.icon_color ?? null,
      icon_tint_custom: visuals.icon_tint_custom ?? true,
    };

    return { data: updated, error: null };
  }

  async updatePerkNodeActiveStatus(
    nodeId: string,
    nextHooks: PerkNodeModel['rule_hooks'],
    isActive: boolean
  ): Promise<void> {
    this.saveActiveOverride(`node:${nodeId}`, isActive);
    void this.supabase
      .from('perk_nodes')
      .update({ rule_hooks: nextHooks })
      .eq('id', nodeId);
    void this.supabase
      .from('perk_nodes')
      .update({ is_active: isActive })
      .eq('id', nodeId);
  }

  async deletePerkNodeRecord(nodeId: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('perk_nodes')
      .delete()
      .eq('id', nodeId);
    return error?.message ?? null;
  }

  // ===========================================================================
  // SUPABASE STORAGE: CUSTOM ICONS
  // ===========================================================================

  async uploadCompendiumIconFile(
    file: File,
    fallbackDataUrl: string
  ): Promise<{ url: string; storedInBucket: boolean }> {
    const ext = (file.name.split('.').pop() || 'png')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const baseName =
      slugifyText(file.name.replace(/\.[^.]+$/, '')) || 'icon';
    const filePath = `icons/${Date.now()}-${baseName}.${ext}`;

    const { error } = await this.supabase.storage
      .from('compendium-icons')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || undefined,
      });

    if (!error) {
      const { data } = this.supabase.storage
        .from('compendium-icons')
        .getPublicUrl(filePath);
      if (data?.publicUrl) {
        return { url: data.publicUrl, storedInBucket: true };
      }
    }

    return { url: fallbackDataUrl, storedInBucket: false };
  }

  // ===========================================================================
  // WEAPONS & ARMORY API
  // ===========================================================================

  async insertWeapon(
    payload: Record<string, unknown>
  ): Promise<{ data: WeaponModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('weapons')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to forge weapon.',
      };
    }

    return {
      data: { ...(data as WeaponModel), is_active: true },
      error: null,
    };
  }

  async updateWeaponRecord(
    weaponId: string,
    patch: Omit<WeaponModel, 'id' | 'slug'>
  ): Promise<void> {
    this.saveWeaponOverride(weaponId, patch);
    this.saveWeaponHookOverride(weaponId, patch.rule_hooks);
    await this.supabase.from('weapons').update(patch).eq('id', weaponId);
  }

  async updateWeaponActiveStatus(
    weaponId: string,
    nextHooks: Record<string, unknown>,
    isActive: boolean
  ): Promise<void> {
    this.saveActiveOverride(`wep:${weaponId}`, isActive);
    this.saveWeaponHookOverride(weaponId, nextHooks);
    void this.supabase
      .from('weapons')
      .update({ rule_hooks: nextHooks })
      .eq('id', weaponId);
    void this.supabase
      .from('weapons')
      .update({ is_active: isActive })
      .eq('id', weaponId);
  }

  async deleteWeaponRecord(weaponId: string): Promise<void> {
    this.markWeaponDeletedLocal(weaponId);
    await this.supabase.from('weapons').delete().eq('id', weaponId);
  }

  async updateWeaponHooksRecord(
    weaponId: string,
    nextHooks: Record<string, unknown>
  ): Promise<void> {
    this.saveWeaponHookOverride(weaponId, nextHooks);
    await this.supabase
      .from('weapons')
      .update({ rule_hooks: nextHooks })
      .eq('id', weaponId);
  }
}
