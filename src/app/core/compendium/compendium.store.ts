import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DEFAULT_KEYWORDS,
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
} from './compendium.model';

interface CompendiumState {
  weapons: WeaponModel[];
  skillTrees: SkillTreeModel[];
  perkNodes: PerkNodeModel[];
  keywords: KeywordDefinition[];
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
}

const LOCAL_KEYWORDS_STORAGE_KEY = 'mot.compendium.keywords';
const LOCAL_TREE_VISUALS_KEY = 'mot.compendium.tree_visuals';

interface StoredVisualOverride {
  icon?: string | null;
  icon_color?: string | null;
  icon_tint_custom?: boolean | null;
}

function loadTreeVisualOverrides(): Record<string, StoredVisualOverride> {
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

function saveTreeVisualOverride(treeId: string, visual: StoredVisualOverride): void {
  try {
    const current = loadTreeVisualOverrides();
    current[treeId] = visual;
    localStorage.setItem(LOCAL_TREE_VISUALS_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

function loadFallbackKeywords(): KeywordDefinition[] {
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

function saveFallbackKeywords(list: KeywordDefinition[]): void {
  try {
    localStorage.setItem(LOCAL_KEYWORDS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function slugifyText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

@Injectable({ providedIn: 'root' })
export class CompendiumStore {
  private readonly supabase = inject(SupabaseService).client;
  private readonly authStore = inject(AuthStore);

  // Private encapsulated Signal State for the March of Time Rules Compendium
  readonly #state = signal<CompendiumState>({
    weapons: [],
    skillTrees: [],
    perkNodes: [],
    keywords: loadFallbackKeywords(),
    isLoading: false,
    error: null,
    statusMessage: null,
  });

  // Public Readonly Selectors
  readonly weapons = computed(() => this.#state().weapons);
  readonly skillTrees = computed(() => this.#state().skillTrees);
  readonly perkNodes = computed(() => this.#state().perkNodes);
  readonly keywords = computed(() => this.#state().keywords);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);
  readonly statusMessage = computed(() => this.#state().statusMessage);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user) {
        void this.loadCompendium();
      } else {
        this.#state.update((s) => ({
          ...s,
          weapons: [],
          skillTrees: [],
          perkNodes: [],
          error: null,
          statusMessage: null,
        }));
      }
    });
  }

  clearMessages(): void {
    this.#state.update((s) => ({ ...s, error: null, statusMessage: null }));
  }

  async loadCompendium(): Promise<void> {
    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
    try {
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

      const dbKeywords =
        !kwRes.error && kwRes.data && kwRes.data.length > 0
          ? (kwRes.data as KeywordDefinition[])
          : loadFallbackKeywords();

      saveFallbackKeywords(dbKeywords);

      const treeVisuals = loadTreeVisualOverrides();
      const mergedTrees = ((treesRes.data as SkillTreeModel[]) ?? []).map((t) => {
        const localVis = treeVisuals[t.id];
        return {
          ...t,
          icon: t.icon ?? localVis?.icon ?? null,
          icon_color: t.icon_color ?? localVis?.icon_color ?? null,
          icon_tint_custom: t.icon_tint_custom ?? localVis?.icon_tint_custom ?? true,
        };
      });

      this.#state.update((s) => ({
        ...s,
        weapons: (wepsRes.data as WeaponModel[]) ?? [],
        skillTrees: mergedTrees,
        perkNodes: (perksRes.data as PerkNodeModel[]) ?? [],
        keywords: dbKeywords,
        isLoading: false,
      }));
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
    }
  }

  // ===========================================================================
  // ADMIN CONTENT MANAGER CRUD: SPECIAL KEYWORDS & GLOSSARY
  // ===========================================================================

  async createKeyword(input: {
    term: string;
    category: string;
    summary: string;
  }): Promise<KeywordDefinition | null> {
    const term = input.term.trim();
    const category = input.category.trim() || 'Core Mechanic';
    const summary = input.summary.trim();
    if (!term || !summary) return null;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const { data, error } = await this.supabase
      .from('compendium_keywords')
      .insert({ term, category, summary })
      .select('*')
      .single();

    const created: KeywordDefinition =
      !error && data
        ? (data as KeywordDefinition)
        : {
            id: `kw-${slugifyText(term)}-${Date.now()}`,
            term,
            category,
            summary,
          };

    const nextKeywords = [...this.#state().keywords, created].sort((a, b) =>
      a.term.localeCompare(b.term)
    );
    saveFallbackKeywords(nextKeywords);

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      isLoading: false,
      statusMessage: `Saved keyword "${created.term}".`,
    }));

    return created;
  }

  async updateKeyword(
    idOrTerm: string,
    input: { term: string; category: string; summary: string }
  ): Promise<boolean> {
    const term = input.term.trim();
    const category = input.category.trim() || 'Core Mechanic';
    const summary = input.summary.trim();
    if (!term || !summary) return false;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    // Try updating in Supabase by id if UUID, or by term
    if (idOrTerm && !idOrTerm.startsWith('kw-')) {
      await this.supabase
        .from('compendium_keywords')
        .update({
          term,
          category,
          summary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idOrTerm);
    } else {
      await this.supabase
        .from('compendium_keywords')
        .upsert({ term, category, summary }, { onConflict: 'term' });
    }

    const nextKeywords = this.#state()
      .keywords.map((kw) =>
        kw.id === idOrTerm || kw.term.toLowerCase() === idOrTerm.toLowerCase()
          ? { ...kw, term, category, summary }
          : kw
      )
      .sort((a, b) => a.term.localeCompare(b.term));

    saveFallbackKeywords(nextKeywords);

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      isLoading: false,
      statusMessage: `Updated keyword "${term}".`,
    }));
    return true;
  }

  async deleteKeyword(kw: KeywordDefinition): Promise<void> {
    if (kw.id && !kw.id.startsWith('kw-')) {
      await this.supabase.from('compendium_keywords').delete().eq('id', kw.id);
    } else {
      await this.supabase
        .from('compendium_keywords')
        .delete()
        .eq('term', kw.term);
    }

    const nextKeywords = this.#state().keywords.filter(
      (item) => item.term.toLowerCase() !== kw.term.toLowerCase()
    );
    saveFallbackKeywords(nextKeywords);

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      statusMessage: `Deleted keyword "${kw.term}".`,
    }));
  }

  // ===========================================================================
  // ADMIN CONTENT MANAGER CRUD: SKILL TREES & COMBAT ARTS / PASSIVE PERKS
  // ===========================================================================

  async createSkillTree(input: {
    name: string;
    slug?: string;
    description: string;
    icon?: string | null;
    icon_color?: string | null;
    icon_tint_custom?: boolean | null;
  }): Promise<SkillTreeModel | null> {
    const trimmedName = input.name.trim();
    if (!trimmedName) return null;
    const slug = slugifyText(input.slug || trimmedName) || `tree-${Date.now()}`;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const { data, error } = await this.supabase
      .from('skill_trees')
      .insert({
        name: trimmedName,
        slug,
        description: input.description.trim() || 'Custom martial path.',
      })
      .select('*')
      .single();

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          error?.message ??
          'Unable to create skill tree. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      }));
      return null;
    }

    const baseCreated = data as SkillTreeModel;
    const created: SkillTreeModel = {
      ...baseCreated,
      icon: input.icon ?? baseCreated.icon ?? 'greatsword',
      icon_color: input.icon_color ?? baseCreated.icon_color ?? '#FF8C5A',
      icon_tint_custom: input.icon_tint_custom ?? baseCreated.icon_tint_custom ?? true,
    };

    saveTreeVisualOverride(created.id, {
      icon: created.icon,
      icon_color: created.icon_color,
      icon_tint_custom: created.icon_tint_custom,
    });

    // Best-effort save to columns if 0007_tree_and_node_icons.sql has been applied
    void this.supabase
      .from('skill_trees')
      .update({
        icon: created.icon,
        icon_color: created.icon_color,
        icon_tint_custom: created.icon_tint_custom,
      })
      .eq('id', created.id);

    this.#state.update((s) => ({
      ...s,
      skillTrees: [...s.skillTrees, created],
      isLoading: false,
      statusMessage: `Created Skill Tree "${created.name}".`,
    }));
    return created;
  }

  async updateSkillTree(
    treeId: string,
    input: {
      name: string;
      description: string;
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
    }
  ): Promise<boolean> {
    const trimmedName = input.name.trim();
    if (!trimmedName) return false;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const { data, error } = await this.supabase
      .from('skill_trees')
      .update({
        name: trimmedName,
        description: input.description.trim(),
      })
      .eq('id', treeId)
      .select('*')
      .single();

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          error?.message ??
          'Unable to update skill tree. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      }));
      return false;
    }

    const baseUpdated = data as SkillTreeModel;
    const updated: SkillTreeModel = {
      ...baseUpdated,
      icon: input.icon ?? baseUpdated.icon ?? null,
      icon_color: input.icon_color ?? baseUpdated.icon_color ?? null,
      icon_tint_custom: input.icon_tint_custom ?? baseUpdated.icon_tint_custom ?? true,
    };

    saveTreeVisualOverride(treeId, {
      icon: updated.icon,
      icon_color: updated.icon_color,
      icon_tint_custom: updated.icon_tint_custom,
    });

    // Best-effort save to columns if 0007_tree_and_node_icons.sql has been applied
    void this.supabase
      .from('skill_trees')
      .update({
        icon: updated.icon,
        icon_color: updated.icon_color,
        icon_tint_custom: updated.icon_tint_custom,
      })
      .eq('id', treeId);

    this.#state.update((s) => ({
      ...s,
      skillTrees: s.skillTrees.map((t) => (t.id === treeId ? updated : t)),
      isLoading: false,
      statusMessage: `Updated Skill Tree "${updated.name}".`,
    }));
    return true;
  }

  async deleteSkillTree(treeId: string): Promise<boolean> {
    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const { error } = await this.supabase
      .from('skill_trees')
      .delete()
      .eq('id', treeId);

    if (error) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: error.message,
      }));
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      skillTrees: s.skillTrees.filter((t) => t.id !== treeId),
      perkNodes: s.perkNodes.filter((p) => p.tree_id !== treeId),
      isLoading: false,
      statusMessage: 'Skill Tree deleted.',
    }));
    return true;
  }

  async createPerkNode(
    draft: Omit<PerkNodeModel, 'id' | 'slug'> & { slug?: string }
  ): Promise<PerkNodeModel | null> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return null;

    const baseSlug = slugifyText(draft.slug || trimmedName) || 'combat-art';
    const existingSlugs = new Set(this.#state().perkNodes.map((p) => p.slug));
    const slug = existingSlugs.has(baseSlug)
      ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`
      : baseSlug;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const enrichedHooks = {
      ...(draft.rule_hooks ?? {}),
      __icon: draft.icon ?? undefined,
      __icon_color: draft.icon_color ?? undefined,
      __icon_tint_custom: draft.icon_tint_custom ?? true,
    };

    const { data, error } = await this.supabase
      .from('perk_nodes')
      .insert({
        tree_id: draft.tree_id,
        slug,
        name: trimmedName,
        node_type: draft.node_type,
        tier: draft.tier,
        perk_cost: draft.perk_cost,
        ap_cost: draft.node_type === 'combat_art' ? draft.ap_cost : null,
        cooldown_rounds:
          draft.node_type === 'combat_art' ? draft.cooldown_rounds : null,
        combat_tag: draft.node_type === 'combat_art' ? draft.combat_tag : 'None',
        description: draft.description.trim(),
        rule_hooks: enrichedHooks,
        parent_node_id: draft.parent_node_id || null,
        is_official: true,
        created_by: this.authStore.user()?.id ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          error?.message ??
          'Unable to create node. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      }));
      return null;
    }

    const created = data as PerkNodeModel;

    // Best-effort save to top-level columns if 0007_tree_and_node_icons.sql has been applied
    void this.supabase
      .from('perk_nodes')
      .update({
        icon: draft.icon ?? null,
        icon_color: draft.icon_color ?? null,
        icon_tint_custom: draft.icon_tint_custom ?? true,
      })
      .eq('id', created.id);

    this.#state.update((s) => ({
      ...s,
      perkNodes: [...s.perkNodes, created].sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
      ),
      isLoading: false,
      statusMessage: `Added "${created.name}" to the Skill Tree.`,
    }));
    return created;
  }

  async updatePerkNode(
    nodeId: string,
    draft: Omit<PerkNodeModel, 'id' | 'slug'>
  ): Promise<boolean> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return false;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const enrichedHooks = {
      ...(draft.rule_hooks ?? {}),
      __icon: draft.icon ?? undefined,
      __icon_color: draft.icon_color ?? undefined,
      __icon_tint_custom: draft.icon_tint_custom ?? true,
    };

    const { data, error } = await this.supabase
      .from('perk_nodes')
      .update({
        tree_id: draft.tree_id,
        name: trimmedName,
        node_type: draft.node_type,
        tier: draft.tier,
        perk_cost: draft.perk_cost,
        ap_cost: draft.node_type === 'combat_art' ? draft.ap_cost : null,
        cooldown_rounds:
          draft.node_type === 'combat_art' ? draft.cooldown_rounds : null,
        combat_tag: draft.node_type === 'combat_art' ? draft.combat_tag : 'None',
        description: draft.description.trim(),
        rule_hooks: enrichedHooks,
        parent_node_id: draft.parent_node_id || null,
      })
      .eq('id', nodeId)
      .select('*')
      .single();

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          error?.message ??
          'Unable to update node. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      }));
      return false;
    }

    // Best-effort save to top-level columns if 0007_tree_and_node_icons.sql has been applied
    void this.supabase
      .from('perk_nodes')
      .update({
        icon: draft.icon ?? null,
        icon_color: draft.icon_color ?? null,
        icon_tint_custom: draft.icon_tint_custom ?? true,
      })
      .eq('id', nodeId);

    const updated: PerkNodeModel = {
      ...(data as PerkNodeModel),
      icon: draft.icon ?? null,
      icon_color: draft.icon_color ?? null,
      icon_tint_custom: draft.icon_tint_custom ?? true,
    };
    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes
        .map((p) => (p.id === nodeId ? updated : p))
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Updated "${updated.name}".`,
    }));
    return true;
  }

  async deletePerkNode(nodeId: string): Promise<boolean> {
    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const { error } = await this.supabase
      .from('perk_nodes')
      .delete()
      .eq('id', nodeId);

    if (error) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          error.message ||
          'Unable to delete node. Please run 0005_admin_skill_trees_rls_and_seed.sql in your Supabase SQL Editor.',
      }));
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes.filter((p) => p.id !== nodeId),
      isLoading: false,
      statusMessage: 'Node deleted from Skill Tree.',
    }));
    return true;
  }

  // ===========================================================================
  // SUPABASE STORAGE UPLOAD FOR CUSTOM SKILL TREE & NODE ICONS
  // ===========================================================================
  async uploadCompendiumIcon(
    file: File,
    fallbackDataUrl: string
  ): Promise<{ url: string; storedInBucket: boolean }> {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const baseName = slugifyText(file.name.replace(/\.[^.]+$/, '')) || 'icon';
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

    // Automatic fallback to compressed 128x128 Data URL if 0007_tree_and_node_icons.sql hasn't been run yet
    return { url: fallbackDataUrl, storedInBucket: false };
  }
}
