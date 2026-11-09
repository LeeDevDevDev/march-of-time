import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { NotificationStore } from '../notifications/notification.store';
import {
  DEFAULT_KEYWORDS,
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
  isCompendiumItemActive,
  isStandalonePerkNode,
} from './compendium.model';
import { CompendiumService, slugifyText } from './compendium.service';

interface CompendiumState {
  weapons: WeaponModel[];
  skillTrees: SkillTreeModel[];
  perkNodes: PerkNodeModel[];
  keywords: KeywordDefinition[];
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
}

@Injectable({ providedIn: 'root' })
export class CompendiumStore {
  private readonly compendiumService = inject(CompendiumService);
  private readonly authStore = inject(AuthStore);
  private readonly notifications = inject(NotificationStore);

  // Private encapsulated Signal State for the March of Time Rules Compendium
  readonly #state = signal<CompendiumState>({
    weapons: [],
    skillTrees: [],
    perkNodes: [],
    keywords: DEFAULT_KEYWORDS,
    isLoading: false,
    error: null,
    statusMessage: null,
  });

  // Public Readonly Selectors (Active items for character builders & live gameplay)
  readonly weapons = computed(() =>
    this.#state().weapons.filter((w) => isCompendiumItemActive(w))
  );
  readonly skillTrees = computed(() =>
    this.#state().skillTrees.filter((t) => isCompendiumItemActive(t))
  );
  readonly perkNodes = computed(() =>
    this.#state().perkNodes.filter((p) => isCompendiumItemActive(p))
  );
  readonly standaloneNodes = computed(() =>
    this.#state().perkNodes.filter(
      (p) => isCompendiumItemActive(p) && isStandalonePerkNode(p)
    )
  );
  readonly keywords = computed(() =>
    this.#state().keywords.filter((k) => isCompendiumItemActive(k))
  );

  // Full Compendium Selectors (Active + Archived — for Content Forge & existing character sheets)
  readonly allWeapons = computed(() => this.#state().weapons);
  readonly allSkillTrees = computed(() => this.#state().skillTrees);
  readonly allPerkNodes = computed(() => this.#state().perkNodes);
  readonly allStandaloneNodes = computed(() =>
    this.#state().perkNodes.filter((p) => isStandalonePerkNode(p))
  );
  readonly allKeywords = computed(() => this.#state().keywords);

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
      const result = await this.compendiumService.fetchFullCompendium();
      this.#state.update((s) => ({
        ...s,
        weapons: result.weapons,
        skillTrees: result.skillTrees,
        perkNodes: result.perkNodes,
        keywords: result.keywords,
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

    const created = await this.compendiumService.insertKeyword({
      term,
      category,
      summary,
    });

    const filteredExisting = this.#state().keywords.filter(
      (kw) => kw.term.toLowerCase() !== created.term.toLowerCase()
    );
    const nextKeywords = [...filteredExisting, created].sort((a, b) =>
      a.term.localeCompare(b.term)
    );

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      isLoading: false,
      statusMessage: `Saved keyword "${created.term}".`,
    }));

    this.notifications.success(
      'Special Word Created',
      `"${created.term}" is now available in the [ autocomplete glossary.`
    );

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

    await this.compendiumService.updateKeywordRecord(idOrTerm, {
      term,
      category,
      summary,
    });

    const nextKeywords = this.#state()
      .keywords.map((kw) =>
        kw.id === idOrTerm || kw.term.toLowerCase() === idOrTerm.toLowerCase()
          ? { ...kw, term, category, summary }
          : kw
      )
      .sort((a, b) => a.term.localeCompare(b.term));

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      isLoading: false,
      statusMessage: `Updated keyword "${term}".`,
    }));

    this.notifications.success(
      'Special Word Updated',
      `Saved changes to "${term}".`
    );
    return true;
  }

  async setKeywordActive(kw: KeywordDefinition, isActive: boolean): Promise<void> {
    await this.compendiumService.updateKeywordActiveStatus(kw, isActive);

    const nextKeywords = this.#state().keywords.map((item) =>
      item.term.toLowerCase() === kw.term.toLowerCase()
        ? { ...item, is_active: isActive }
        : item
    );

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      statusMessage: isActive
        ? `Restored keyword "${kw.term}".`
        : `Archived keyword "${kw.term}".`,
    }));

    if (!isActive) {
      this.notifications.warning(
        `Archived "${kw.term}"`,
        'Marked as inactive and hidden from active glossary lookups.',
        {
          label: 'Undo Archive',
          callback: () => this.setKeywordActive(kw, true),
        }
      );
    } else {
      this.notifications.success(
        `Restored "${kw.term}"`,
        'Special word is active again across all tooltips.'
      );
    }
  }

  async deleteKeyword(kw: KeywordDefinition): Promise<void> {
    await this.compendiumService.deleteKeywordRecord(kw);

    const nextKeywords = this.#state().keywords.map((item) =>
      item.term.toLowerCase() === kw.term.toLowerCase()
        ? { ...item, is_active: false }
        : item
    );

    this.#state.update((s) => ({
      ...s,
      keywords: nextKeywords,
      statusMessage: `Deleted keyword "${kw.term}".`,
    }));

    this.notifications.info(
      'Special Word Deleted',
      `Removed "${kw.term}" from the active glossary.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setKeywordActive(kw, true);
        },
      }
    );
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

    const { data, error } = await this.compendiumService.insertSkillTree({
      name: trimmedName,
      slug,
      description: input.description.trim() || 'Custom martial path.',
      icon: input.icon,
      icon_color: input.icon_color,
      icon_tint_custom: input.icon_tint_custom,
    });

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Unable to Create Skill Tree', error);
      return null;
    }

    this.#state.update((s) => ({
      ...s,
      skillTrees: [...s.skillTrees, data],
      isLoading: false,
      statusMessage: `Created Skill Tree "${data.name}".`,
    }));

    this.notifications.success(
      'Skill Tree Created',
      `"${data.name}" has been added to the Compendium.`
    );
    return data;
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

    const existing = this.#state().skillTrees.find((t) => t.id === treeId);

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const { data, error } = await this.compendiumService.updateSkillTreeRecord(
      treeId,
      {
        name: trimmedName,
        description: input.description.trim(),
        icon: input.icon,
        icon_color: input.icon_color,
        icon_tint_custom: input.icon_tint_custom,
        is_active: existing?.is_active ?? true,
      }
    );

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Skill Tree Update Failed', error);
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      skillTrees: s.skillTrees.map((t) => (t.id === treeId ? data : t)),
      isLoading: false,
      statusMessage: `Updated Skill Tree "${data.name}".`,
    }));

    this.notifications.success(
      'Skill Tree Updated',
      `Saved changes to "${data.name}".`
    );
    return true;
  }

  async setSkillTreeActive(treeId: string, isActive: boolean): Promise<boolean> {
    const existing = this.#state().skillTrees.find((t) => t.id === treeId);
    if (!existing) return false;

    void this.compendiumService.updateSkillTreeActiveStatus(treeId, isActive);

    this.#state.update((s) => ({
      ...s,
      skillTrees: s.skillTrees.map((t) =>
        t.id === treeId ? { ...t, is_active: isActive } : t
      ),
      statusMessage: isActive
        ? `Restored Skill Tree "${existing.name}".`
        : `Archived Skill Tree "${existing.name}".`,
    }));

    if (!isActive) {
      this.notifications.warning(
        `Archived "${existing.name}"`,
        'Hidden from new character builds. Existing characters keep their unlocked perks.',
        {
          label: 'Undo Archive',
          callback: () => {
            void this.setSkillTreeActive(treeId, true);
          },
        }
      );
    } else {
      this.notifications.success(
        `Restored "${existing.name}"`,
        'Skill tree is active again for all characters.'
      );
    }
    return true;
  }

  async deleteSkillTree(treeId: string): Promise<boolean> {
    const existing = this.#state().skillTrees.find((t) => t.id === treeId);
    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const err = await this.compendiumService.deleteSkillTreeRecord(
      treeId,
      existing?.slug
    );

    if (err) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: err,
      }));
      this.notifications.error('Unable to Delete Skill Tree', err);
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      skillTrees: s.skillTrees.map((t) =>
        t.id === treeId ? { ...t, is_active: false } : t
      ),
      perkNodes: s.perkNodes.map((p) =>
        p.tree_id === treeId
          ? {
              ...p,
              is_active: false,
              rule_hooks: { ...(p.rule_hooks ?? {}), __is_active: false },
            }
          : p
      ),
      isLoading: false,
      statusMessage: `Deleted Skill Tree "${existing?.name ?? 'Skill Tree'}".`,
    }));

    this.notifications.info(
      'Skill Tree Deleted',
      `Removed "${existing?.name ?? 'Skill Tree'}" from the active compendium. Existing characters keep their unlocked perks.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setSkillTreeActive(treeId, true);
        },
      }
    );
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

    const isStandalone = !draft.tree_id;
    const enrichedHooks = {
      ...(draft.rule_hooks ?? {}),
      __icon: draft.icon ?? undefined,
      __icon_color: draft.icon_color ?? undefined,
      __icon_tint_custom: draft.icon_tint_custom ?? true,
      __is_active: true,
      __is_standalone: isStandalone,
    };

    const { data, error } = await this.compendiumService.insertPerkNode(
      {
        tree_id: draft.tree_id || null,
        slug,
        name: trimmedName,
        node_type: draft.node_type,
        tier: isStandalone ? 1 : draft.tier,
        perk_cost: draft.perk_cost,
        ap_cost: draft.node_type === 'combat_art' ? draft.ap_cost : null,
        cooldown_rounds:
          draft.node_type === 'combat_art' ? draft.cooldown_rounds : null,
        combat_tag: draft.node_type === 'combat_art' ? draft.combat_tag : 'None',
        description: draft.description.trim(),
        rule_hooks: enrichedHooks,
        parent_node_id: isStandalone ? null : draft.parent_node_id || null,
        is_official: true,
        created_by: this.authStore.user()?.id ?? null,
      },
      {
        icon: draft.icon,
        icon_color: draft.icon_color,
        icon_tint_custom: draft.icon_tint_custom,
      }
    );

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Unable to Create Node', error);
      return null;
    }

    this.#state.update((s) => ({
      ...s,
      perkNodes: [...s.perkNodes, data].sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
      ),
      isLoading: false,
      statusMessage: isStandalone
        ? `Created Standalone Ability "${data.name}".`
        : `Added "${data.name}" to the Skill Tree.`,
    }));

    this.notifications.success(
      isStandalone ? 'Standalone Ability Created' : 'Skill Tree Node Created',
      isStandalone
        ? `"${data.name}" is now available in the Standalone Combat Arts roster.`
        : `Added Tier ${data.tier} "${data.name}" to the Skill Tree.`
    );
    return data;
  }

  async updatePerkNode(
    nodeId: string,
    draft: Omit<PerkNodeModel, 'id' | 'slug'>
  ): Promise<boolean> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return false;

    const existing = this.#state().perkNodes.find((p) => p.id === nodeId);
    const isStandalone = !draft.tree_id;

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
      __is_active: existing?.is_active ?? true,
      __is_standalone: isStandalone,
    };

    const { data, error } = await this.compendiumService.updatePerkNodeRecord(
      nodeId,
      {
        tree_id: draft.tree_id || null,
        name: trimmedName,
        node_type: draft.node_type,
        tier: isStandalone ? 1 : draft.tier,
        perk_cost: draft.perk_cost,
        ap_cost: draft.node_type === 'combat_art' ? draft.ap_cost : null,
        cooldown_rounds:
          draft.node_type === 'combat_art' ? draft.cooldown_rounds : null,
        combat_tag: draft.node_type === 'combat_art' ? draft.combat_tag : 'None',
        description: draft.description.trim(),
        rule_hooks: enrichedHooks,
        parent_node_id: isStandalone ? null : draft.parent_node_id || null,
      },
      {
        icon: draft.icon,
        icon_color: draft.icon_color,
        icon_tint_custom: draft.icon_tint_custom,
        is_active: existing?.is_active ?? true,
      }
    );

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Node Update Failed', error);
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes
        .map((p) => (p.id === nodeId ? data : p))
        .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Updated "${data.name}".`,
    }));

    this.notifications.success(
      isStandalone ? 'Standalone Ability Updated' : 'Skill Tree Node Updated',
      `Saved changes to "${data.name}".`
    );
    return true;
  }

  async setPerkNodeActive(nodeId: string, isActive: boolean): Promise<boolean> {
    const existing = this.#state().perkNodes.find((p) => p.id === nodeId);
    if (!existing) return false;

    const nextHooks = {
      ...(existing.rule_hooks ?? {}),
      __is_active: isActive,
    };

    void this.compendiumService.updatePerkNodeActiveStatus(
      nodeId,
      nextHooks,
      isActive
    );

    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes.map((p) =>
        p.id === nodeId
          ? { ...p, is_active: isActive, rule_hooks: nextHooks }
          : p
      ),
      statusMessage: isActive
        ? `Restored node "${existing.name}".`
        : `Archived node "${existing.name}".`,
    }));

    if (!isActive) {
      this.notifications.warning(
        `Archived Node "${existing.name}"`,
        'Marked as inactive on the tree. Existing characters keep this perk.',
        {
          label: 'Undo Archive',
          callback: () => {
            void this.setPerkNodeActive(nodeId, true);
          },
        }
      );
    } else {
      this.notifications.success(
        `Restored Node "${existing.name}"`,
        'Node is active again on the Skill Tree.'
      );
    }

    return true;
  }

  async deletePerkNode(nodeId: string): Promise<boolean> {
    const existing = this.#state().perkNodes.find((p) => p.id === nodeId);
    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const nextHooks: PerkNodeModel['rule_hooks'] = {
      ...(existing?.rule_hooks ?? {}),
      __is_active: false,
    };

    const err = await this.compendiumService.deletePerkNodeRecord(
      nodeId,
      existing?.slug,
      nextHooks
    );

    if (err) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: err,
      }));
      this.notifications.error('Unable to Delete Node', err);
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes.map((p) =>
        p.id === nodeId
          ? { ...p, is_active: false, rule_hooks: nextHooks }
          : p
      ),
      isLoading: false,
      statusMessage: `Deleted "${existing?.name ?? 'Ability'}".`,
    }));

    this.notifications.info(
      isStandalonePerkNode(existing)
        ? 'Standalone Ability Deleted'
        : 'Skill Tree Node Deleted',
      `Removed "${existing?.name ?? 'Ability'}" from the active compendium. Existing characters keep this perk.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setPerkNodeActive(nodeId, true);
        },
      }
    );
    return true;
  }

  // ===========================================================================
  // SUPABASE STORAGE UPLOAD FOR CUSTOM SKILL TREE & NODE ICONS
  // ===========================================================================

  async uploadCompendiumIcon(
    file: File,
    fallbackDataUrl: string
  ): Promise<{ url: string; storedInBucket: boolean }> {
    return this.compendiumService.uploadCompendiumIconFile(
      file,
      fallbackDataUrl
    );
  }

  // ===========================================================================
  // ADMIN CONTENT MANAGER CRUD: WEAPONS & ARMORY FORGE
  // ===========================================================================

  async createWeapon(
    draft: Omit<WeaponModel, 'id' | 'slug'> & { slug?: string }
  ): Promise<WeaponModel | null> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return null;

    const baseSlug = slugifyText(draft.slug || trimmedName) || 'weapon';
    const existingSlugs = new Set(this.#state().weapons.map((w) => w.slug));
    const slug = existingSlugs.has(baseSlug)
      ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`
      : baseSlug;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const payload = {
      slug,
      name: trimmedName,
      category: draft.category.trim() || 'Martial',
      ap_cost: Math.max(1, Math.min(4, Number(draft.ap_cost) || 1)),
      requires_aim: Boolean(draft.requires_aim),
      gov_attribute: draft.gov_attribute,
      gov_skill: draft.gov_skill,
      base_damage: Number(draft.base_damage) || 3,
      reach_tiles: Math.max(1, Number(draft.reach_tiles) || 1),
      thrown_range_tiles:
        draft.thrown_range_tiles && Number(draft.thrown_range_tiles) > 0
          ? Number(draft.thrown_range_tiles)
          : null,
      trait_name: draft.trait_name.trim() || 'Standard Balance',
      trait_description:
        draft.trait_description.trim() || 'Reliable martial weapon.',
      rule_hooks: draft.rule_hooks ?? {},
      is_official: true,
      created_by: this.authStore.user()?.id ?? null,
    };

    const { data, error } = await this.compendiumService.insertWeapon(payload);

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Unable to Forge Weapon', error);
      return null;
    }

    this.#state.update((s) => ({
      ...s,
      weapons: [...s.weapons, data].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      isLoading: false,
      statusMessage: `Forged weapon "${data.name}".`,
    }));

    this.notifications.success(
      'Weapon Forged',
      `"${data.name}" (${data.category}) added to the Armory.`
    );

    return data;
  }

  async updateWeapon(
    weaponId: string,
    draft: Omit<WeaponModel, 'id' | 'slug'>
  ): Promise<boolean> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return false;

    const existing = this.#state().weapons.find((w) => w.id === weaponId);
    if (!existing) return false;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const nextPatch: Omit<WeaponModel, 'id' | 'slug'> = {
      name: trimmedName,
      category: draft.category.trim() || 'Martial',
      ap_cost: Math.max(1, Math.min(4, Number(draft.ap_cost) || 1)),
      requires_aim: Boolean(draft.requires_aim),
      gov_attribute: draft.gov_attribute,
      gov_skill: draft.gov_skill,
      base_damage: Number(draft.base_damage) || 3,
      reach_tiles: Math.max(1, Number(draft.reach_tiles) || 1),
      thrown_range_tiles:
        draft.thrown_range_tiles && Number(draft.thrown_range_tiles) > 0
          ? Number(draft.thrown_range_tiles)
          : null,
      trait_name: draft.trait_name.trim() || 'Standard Balance',
      trait_description:
        draft.trait_description.trim() || 'Reliable martial weapon.',
      rule_hooks: {
        ...(draft.rule_hooks ?? {}),
        __is_active: existing.is_active ?? true,
      },
    };

    void this.compendiumService.updateWeaponRecord(weaponId, nextPatch);

    const updated: WeaponModel = {
      ...existing,
      ...nextPatch,
      is_active: existing.is_active ?? true,
    };

    this.#state.update((s) => ({
      ...s,
      weapons: s.weapons
        .map((w) => (w.id === weaponId ? updated : w))
        .sort((a, b) => a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Updated weapon "${updated.name}".`,
    }));

    this.notifications.success(
      'Weapon Updated',
      `Saved changes to "${updated.name}".`
    );

    return true;
  }

  async setWeaponActive(weaponId: string, isActive: boolean): Promise<boolean> {
    const existing = this.#state().weapons.find((w) => w.id === weaponId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      __is_active: isActive,
    };

    void this.compendiumService.updateWeaponActiveStatus(
      weaponId,
      nextHooks,
      isActive
    );

    this.#state.update((s) => ({
      ...s,
      weapons: s.weapons.map((w) =>
        w.id === weaponId
          ? { ...w, is_active: isActive, rule_hooks: nextHooks }
          : w
      ),
      statusMessage: isActive
        ? `Restored "${existing.name}" to the active Armory.`
        : `Archived "${existing.name}" in the Armory.`,
    }));

    if (!isActive) {
      this.notifications.warning(
        `Archived "${existing.name}"`,
        'Hidden from new character builds. Existing characters keep this weapon equipped.',
        {
          label: 'Undo Archive',
          callback: () => {
            void this.setWeaponActive(weaponId, true);
          },
        }
      );
    } else {
      this.notifications.success(
        `Restored "${existing.name}"`,
        'Weapon is active again in the Armory.'
      );
    }

    return true;
  }

  async deleteWeapon(weaponId: string): Promise<boolean> {
    const existing = this.#state().weapons.find((w) => w.id === weaponId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      __is_active: false,
    };

    void this.compendiumService.deleteWeaponRecord(
      weaponId,
      existing.slug,
      nextHooks
    );

    this.#state.update((s) => ({
      ...s,
      weapons: s.weapons.map((w) =>
        w.id === weaponId
          ? { ...w, is_active: false, rule_hooks: nextHooks }
          : w
      ),
      statusMessage: `Deleted "${existing.name}" from the Armory.`,
    }));

    this.notifications.info(
      'Weapon Deleted',
      `Removed "${existing.name}" from the active Armory. Existing characters keep this weapon equipped.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setWeaponActive(weaponId, true);
        },
      }
    );

    return true;
  }

  async updateWeaponTags(
    weaponId: string,
    input: {
      two_handed: boolean;
      heavy: boolean;
      heavy_block_base?: number;
    }
  ): Promise<boolean> {
    const existing = this.#state().weapons.find((w) => w.id === weaponId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      two_handed: input.two_handed,
      heavy: input.heavy,
      heavy_block_base: input.heavy ? (input.heavy_block_base ?? 2) : undefined,
    };

    void this.compendiumService.updateWeaponHooksRecord(weaponId, nextHooks);

    this.#state.update((s) => ({
      ...s,
      weapons: s.weapons.map((w) =>
        w.id === weaponId ? { ...w, rule_hooks: nextHooks } : w
      ),
      statusMessage: `Updated tags on "${existing.name}".`,
    }));

    this.notifications.info(
      `Updated "${existing.name}" Tags`,
      `Two-Handed: ${input.two_handed ? 'On' : 'Off'} · Heavy Block: ${input.heavy ? 'On' : 'Off'}`
    );

    return true;
  }
}
