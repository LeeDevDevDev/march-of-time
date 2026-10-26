import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { SupabaseService } from '../supabase/supabase.service';
import {
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
} from './compendium.model';

interface CompendiumState {
  weapons: WeaponModel[];
  skillTrees: SkillTreeModel[];
  perkNodes: PerkNodeModel[];
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
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
    isLoading: false,
    error: null,
    statusMessage: null,
  });

  // Public Readonly Selectors
  readonly weapons = computed(() => this.#state().weapons);
  readonly skillTrees = computed(() => this.#state().skillTrees);
  readonly perkNodes = computed(() => this.#state().perkNodes);
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
      const [wepsRes, treesRes, perksRes] = await Promise.all([
        this.supabase.from('weapons').select('*').order('name'),
        this.supabase.from('skill_trees').select('*').order('name'),
        this.supabase
          .from('perk_nodes')
          .select('*')
          .order('tier', { ascending: true })
          .order('name', { ascending: true }),
      ]);

      this.#state.update((s) => ({
        ...s,
        weapons: (wepsRes.data as WeaponModel[]) ?? [],
        skillTrees: (treesRes.data as SkillTreeModel[]) ?? [],
        perkNodes: (perksRes.data as PerkNodeModel[]) ?? [],
        isLoading: false,
      }));
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
    }
  }

  // ===========================================================================
  // ADMIN CONTENT MANAGER CRUD: SKILL TREES & COMBAT ARTS / PASSIVE PERKS
  // ===========================================================================

  async createSkillTree(input: {
    name: string;
    slug?: string;
    description: string;
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

    const created = data as SkillTreeModel;
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
    input: { name: string; description: string }
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

    const updated = data as SkillTreeModel;
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
        rule_hooks: draft.rule_hooks ?? {},
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
        rule_hooks: draft.rule_hooks ?? {},
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

    const updated = data as PerkNodeModel;
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
}
