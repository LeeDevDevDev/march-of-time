import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../auth/auth.store';
import { NotificationStore } from '../notifications/notification.store';
import {
  ArmorModel,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ARMORS,
  DEFAULT_COMPENDIUM_ITEMS,
  DEFAULT_KEYWORDS,
  KeywordDefinition,
  PerkNodeModel,
  PerkUnlockMode,
  SkillTreeModel,
  WeaponModel,
  canConnectPerkRoute,
  compareSiblingPerkNodes,
  computeAutoGraphPositions,
  computePerkNodeTier,
  getDescendantNodeIds,
  getNodeParentIds,
  getNodeUnlockMode,
  hasSavedCanvasPosition,
  isCompendiumItemActive,
  isStandalonePerkNode,
  normalizePerkNodesTiers,
  snapToCanvasGrid,
  suggestNewNodeCanvasPosition,
} from './compendium.model';
import { CompendiumService, slugifyText } from './compendium.service';

interface CompendiumState {
  weapons: WeaponModel[];
  armors: ArmorModel[];
  items: CompendiumItemModel[];
  skillTrees: SkillTreeModel[];
  perkNodes: PerkNodeModel[];
  keywords: KeywordDefinition[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  statusMessage: string | null;
}

@Injectable({ providedIn: 'root' })
export class CompendiumStore {
  private readonly compendiumService = inject(CompendiumService);
  private readonly authStore = inject(AuthStore);
  private readonly notifications = inject(NotificationStore);

  private loadPromise: Promise<void> | null = null;
  private lastUserId: string | null = null;
  private lastIsAdmin = false;

  readonly #state = signal<CompendiumState>({
    weapons: [],
    armors: DEFAULT_COMPENDIUM_ARMORS,
    items: DEFAULT_COMPENDIUM_ITEMS,
    skillTrees: [],
    perkNodes: [],
    keywords: DEFAULT_KEYWORDS,
    isLoading: false,
    hasLoaded: false,
    error: null,
    statusMessage: null,
  });

  readonly weapons = computed(() =>
    this.#state().weapons.filter((w) => isCompendiumItemActive(w))
  );
  readonly armors = computed(() =>
    this.#state().armors.filter((a) => isCompendiumItemActive(a))
  );
  readonly items = computed(() =>
    this.#state().items.filter((i) => isCompendiumItemActive(i))
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

  readonly allWeapons = computed(() => this.#state().weapons);
  readonly allArmors = computed(() => this.#state().armors);
  readonly allItems = computed(() => this.#state().items);
  readonly allSkillTrees = computed(() => this.#state().skillTrees);
  readonly allPerkNodes = computed(() => this.#state().perkNodes);
  readonly allStandaloneNodes = computed(() =>
    this.#state().perkNodes.filter((p) => isStandalonePerkNode(p))
  );
  readonly allKeywords = computed(() => this.#state().keywords);

  readonly isHydrating = computed(
    () => this.#state().isLoading && !this.#state().hasLoaded
  );
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);
  readonly statusMessage = computed(() => this.#state().statusMessage);

  constructor() {
    effect(() => {
      const userId =
        typeof this.authStore.user === 'function'
          ? (this.authStore.user()?.id ?? null)
          : null;
      const isAdmin =
        typeof this.authStore.isAdmin === 'function'
          ? this.authStore.isAdmin()
          : false;

      if (this.lastUserId !== null && userId !== this.lastUserId) {
        this.loadPromise = null;
        this.#state.set({
          weapons: [],
          armors: DEFAULT_COMPENDIUM_ARMORS,
          items: DEFAULT_COMPENDIUM_ITEMS,
          skillTrees: [],
          perkNodes: [],
          keywords: DEFAULT_KEYWORDS,
          isLoading: false,
          hasLoaded: false,
          error: null,
          statusMessage: null,
        });
      } else if (this.#state().hasLoaded && isAdmin && !this.lastIsAdmin) {
        this.lastIsAdmin = isAdmin;
        void this.loadCompendium();
        return;
      }

      this.lastUserId = userId;
      this.lastIsAdmin = isAdmin;
    });
  }

  clearMessages(): void {
    this.#state.update((s) => ({ ...s, error: null, statusMessage: null }));
  }

  ensureLoaded(): Promise<void> {
    if (this.#state().hasLoaded) {
      return Promise.resolve();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }
    return this.loadCompendium();
  }

  loadCompendium(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
    const includeInactive =
      typeof this.authStore.isAdmin === 'function'
        ? this.authStore.isAdmin()
        : false;
    const task = (async () => {
      try {
        const result =
          await this.compendiumService.fetchFullCompendium(includeInactive);
        this.#state.update((s) => ({
          ...s,
          weapons: result.weapons ?? [],
          armors:
            result.armors && result.armors.length > 0
              ? result.armors
              : DEFAULT_COMPENDIUM_ARMORS,
          items:
            result.items && result.items.length > 0
              ? result.items
              : DEFAULT_COMPENDIUM_ITEMS,
          skillTrees: result.skillTrees ?? [],
          perkNodes: result.perkNodes ?? [],
          keywords: result.keywords ?? DEFAULT_KEYWORDS,
          hasLoaded: true,
          isLoading: false,
        }));
      } catch {
        this.#state.update((s) => ({
          ...s,
          hasLoaded: true,
          isLoading: false,
        }));
      } finally {
        this.loadPromise = null;
      }
    })();
    this.loadPromise = task;
    return task;
  }

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
      'Keyword Created',
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
      'Keyword Updated',
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
        'Keyword is active again across all tooltips.'
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
      'Keyword Deleted',
      `Removed "${kw.term}" from the active glossary.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setKeywordActive(kw, true);
        },
      }
    );
  }

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

  private computeNextSiblingSortOrder(
    treeId: string | null,
    parentNodeId: string | null,
    excludeNodeId?: string
  ): number {
    if (!treeId) return 10;
    const activeNodes = this.perkNodes().filter((p) => p.tree_id === treeId);
    const activeIds = new Set(activeNodes.map((p) => p.id));
    const effectiveParent =
      parentNodeId && activeIds.has(parentNodeId) ? parentNodeId : null;

    const siblings = activeNodes
      .filter((p) => {
        if (excludeNodeId && p.id === excludeNodeId) return false;
        const pParent =
          p.parent_node_id && activeIds.has(p.parent_node_id)
            ? p.parent_node_id
            : null;
        return pParent === effectiveParent;
      })
      .sort(compareSiblingPerkNodes);

    if (siblings.length === 0) return 10;
    const maxOrder = siblings.reduce((max, s, idx) => {
      const val =
        typeof s.rule_hooks?.__sort_order === 'number'
          ? s.rule_hooks.__sort_order
          : (idx + 1) * 10;
      return Math.max(max, val);
    }, 0);
    return maxOrder + 10;
  }

  private async cascadeChangedPlacements(
    previousNodes: PerkNodeModel[],
    nextNodes: PerkNodeModel[],
    skipNodeId?: string
  ): Promise<void> {
    const prevById = new Map(previousNodes.map((n) => [n.id, n]));
    const tasks: Promise<unknown>[] = [];

    for (const node of nextNodes) {
      if (skipNodeId && node.id === skipNodeId) continue;
      const prev = prevById.get(node.id);
      if (!prev) continue;
      const prevParent = prev.parent_node_id ?? null;
      const nextParent = node.parent_node_id ?? null;
      const prevOrder = prev.rule_hooks?.__sort_order;
      const nextOrder = node.rule_hooks?.__sort_order;
      const prevParentsJson = JSON.stringify(
        prev.rule_hooks?.__parent_ids ?? (prevParent ? [prevParent] : [])
      );
      const nextParentsJson = JSON.stringify(
        node.rule_hooks?.__parent_ids ?? (nextParent ? [nextParent] : [])
      );
      const prevUnlockMode = prev.rule_hooks?.__unlock_mode ?? 'any';
      const nextUnlockMode = node.rule_hooks?.__unlock_mode ?? 'any';
      const prevX = prev.rule_hooks?.__canvas_x;
      const nextX = node.rule_hooks?.__canvas_x;
      const prevY = prev.rule_hooks?.__canvas_y;
      const nextY = node.rule_hooks?.__canvas_y;

      if (
        prev.tree_id !== node.tree_id ||
        prevParent !== nextParent ||
        prev.tier !== node.tier ||
        prevOrder !== nextOrder ||
        prevParentsJson !== nextParentsJson ||
        prevUnlockMode !== nextUnlockMode ||
        prevX !== nextX ||
        prevY !== nextY
      ) {
        tasks.push(
          this.compendiumService.updatePerkNodePlacement(node.id, {
            tree_id: node.tree_id,
            parent_node_id: nextParent,
            tier: node.tier,
            rule_hooks: {
              ...(node.rule_hooks ?? {}),
              __tier: node.tier,
              __is_standalone: !node.tree_id,
            },
          })
        );
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
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
    const rawParents = isStandalone
      ? []
      : Array.isArray(draft.rule_hooks?.__parent_ids)
        ? draft.rule_hooks.__parent_ids.filter(Boolean)
        : draft.parent_node_id
          ? [draft.parent_node_id]
          : [];
    const parentIds = Array.from(new Set(rawParents));
    const primaryParentId = parentIds[0] ?? null;

    const existingTreeNodes = isStandalone
      ? []
      : this.perkNodes().filter((p) => p.tree_id === draft.tree_id);

    const suggestedPos = isStandalone
      ? null
      : typeof draft.rule_hooks?.__canvas_x === 'number' &&
          typeof draft.rule_hooks?.__canvas_y === 'number'
        ? {
            x: snapToCanvasGrid(draft.rule_hooks.__canvas_x),
            y: snapToCanvasGrid(draft.rule_hooks.__canvas_y),
          }
        : suggestNewNodeCanvasPosition(existingTreeNodes, primaryParentId);

    const computedTier = isStandalone
      ? 1
      : computePerkNodeTier(
          draft.tree_id,
          parentIds,
          this.#state().perkNodes
        );
    const sortOrder =
      typeof draft.rule_hooks?.__sort_order === 'number'
        ? draft.rule_hooks.__sort_order
        : this.computeNextSiblingSortOrder(
            draft.tree_id || null,
            primaryParentId
          );

    const enrichedHooks: PerkNodeModel['rule_hooks'] = {
      ...(draft.rule_hooks ?? {}),
      __icon: draft.icon ?? undefined,
      __icon_color: draft.icon_color ?? undefined,
      __icon_tint_custom: draft.icon_tint_custom ?? true,
      __is_active: true,
      __is_standalone: isStandalone,
      __sort_order: isStandalone ? undefined : sortOrder,
      __tier: computedTier,
      __parent_ids: isStandalone ? [] : parentIds,
      __unlock_mode: isStandalone
        ? undefined
        : draft.rule_hooks?.__unlock_mode ?? 'any',
      __canvas_x: suggestedPos?.x,
      __canvas_y: suggestedPos?.y,
    };

    const { data, error } = await this.compendiumService.insertPerkNode(
      {
        tree_id: draft.tree_id || null,
        slug,
        name: trimmedName,
        node_type: draft.node_type,
        tier: computedTier,
        perk_cost: draft.perk_cost,
        ap_cost: draft.node_type === 'combat_art' ? draft.ap_cost : null,
        cooldown_rounds:
          draft.node_type === 'combat_art' ? draft.cooldown_rounds : null,
        combat_tag: draft.node_type === 'combat_art' ? draft.combat_tag : 'None',
        description: draft.description.trim(),
        rule_hooks: enrichedHooks,
        parent_node_id: primaryParentId,
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

    const normalizedList = normalizePerkNodesTiers([
      ...this.#state().perkNodes,
      data,
    ]).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

    this.#state.update((s) => ({
      ...s,
      perkNodes: normalizedList,
      isLoading: false,
      statusMessage: isStandalone
        ? `Created Standalone Ability "${data.name}".`
        : `Added "${data.name}" to the Skill Tree.`,
    }));

    this.notifications.success(
      isStandalone ? 'Standalone Ability Created' : 'Skill Tree Node Created',
      isStandalone
        ? `"${data.name}" is now available in the Standalone Combat Arts roster.`
        : `Added "${data.name}" to the Skill Tree.`
    );
    return data;
  }

  async updatePerkNode(
    nodeId: string,
    draft: Omit<PerkNodeModel, 'id' | 'slug'>
  ): Promise<boolean> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return false;

    const previousNodes = this.#state().perkNodes;
    const existing = previousNodes.find((p) => p.id === nodeId);
    const targetTreeId = draft.tree_id || null;
    const isStandalone = !targetTreeId;
    const oldTreeId =
      existing && !isStandalonePerkNode(existing) ? existing.tree_id : null;
    const isLeavingOldTree = Boolean(oldTreeId && oldTreeId !== targetTreeId);

    const targetTreeNodes = targetTreeId
      ? previousNodes.filter(
          (p) => p.tree_id === targetTreeId && isCompendiumItemActive(p)
        )
      : [];
    const descendants =
      targetTreeId && oldTreeId === targetTreeId
        ? getDescendantNodeIds(nodeId, targetTreeNodes)
        : new Set<string>();

    let candidateParents: string[] = [];
    if (!isStandalone) {
      if (Array.isArray(draft.rule_hooks?.__parent_ids)) {
        candidateParents = draft.rule_hooks.__parent_ids;
      } else if (oldTreeId === targetTreeId && existing) {
        const existingParents = getNodeParentIds(existing, targetTreeNodes);
        if (
          draft.parent_node_id === null &&
          existingParents.length <= 1
        ) {
          candidateParents = [];
        } else if (
          draft.parent_node_id &&
          !existingParents.includes(draft.parent_node_id)
        ) {
          candidateParents = [draft.parent_node_id];
        } else {
          candidateParents = existingParents;
        }
      } else if (draft.parent_node_id) {
        candidateParents = [draft.parent_node_id];
      }
    }

    const validTargetIds = new Set(targetTreeNodes.map((p) => p.id));
    const parentIds = Array.from(new Set(candidateParents)).filter(
      (pid) =>
        pid !== nodeId && validTargetIds.has(pid) && !descendants.has(pid)
    );
    const primaryParentId = parentIds[0] ?? null;

    const sameTree = Boolean(existing && oldTreeId === targetTreeId);
    const canvasPos = isStandalone
      ? null
      : sameTree && existing && hasSavedCanvasPosition(existing)
        ? {
            x: existing.rule_hooks.__canvas_x!,
            y: existing.rule_hooks.__canvas_y!,
          }
        : suggestNewNodeCanvasPosition(
            targetTreeNodes.filter((p) => p.id !== nodeId),
            primaryParentId
          );

    const sortOrder = isStandalone
      ? undefined
      : sameTree && typeof existing?.rule_hooks?.__sort_order === 'number'
        ? existing.rule_hooks.__sort_order
        : this.computeNextSiblingSortOrder(targetTreeId, primaryParentId, nodeId);

    const computedTier = isStandalone
      ? 1
      : computePerkNodeTier(targetTreeId, parentIds, previousNodes);

    const preservedUnlockMode: PerkUnlockMode | undefined = isStandalone
      ? undefined
      : draft.rule_hooks?.__unlock_mode ??
        (existing ? getNodeUnlockMode(existing) : 'any');

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const enrichedHooks: PerkNodeModel['rule_hooks'] = {
      ...(draft.rule_hooks ?? {}),
      __icon: draft.icon ?? undefined,
      __icon_color: draft.icon_color ?? undefined,
      __icon_tint_custom: draft.icon_tint_custom ?? true,
      __is_active: existing?.is_active ?? true,
      __is_standalone: isStandalone,
      __sort_order: sortOrder,
      __tier: computedTier,
      __parent_ids: isStandalone ? [] : parentIds,
      __unlock_mode: preservedUnlockMode,
      __canvas_x: canvasPos?.x,
      __canvas_y: canvasPos?.y,
    };

    const { data, error } = await this.compendiumService.updatePerkNodeRecord(
      nodeId,
      {
        tree_id: targetTreeId,
        name: trimmedName,
        node_type: draft.node_type,
        tier: computedTier,
        perk_cost: draft.perk_cost,
        ap_cost: draft.node_type === 'combat_art' ? draft.ap_cost : null,
        cooldown_rounds:
          draft.node_type === 'combat_art' ? draft.cooldown_rounds : null,
        combat_tag: draft.node_type === 'combat_art' ? draft.combat_tag : 'None',
        description: draft.description.trim(),
        rule_hooks: enrichedHooks,
        parent_node_id: primaryParentId,
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

    const intermediateNodes = previousNodes.map((p) => {
      if (p.id === nodeId) return data;
      if (isLeavingOldTree && p.tree_id === oldTreeId) {
        const pParents = getNodeParentIds(p, previousNodes);
        if (pParents.includes(nodeId)) {
          const nextParents = pParents.filter((id) => id !== nodeId);
          return {
            ...p,
            parent_node_id: nextParents[0] ?? null,
            rule_hooks: {
              ...(p.rule_hooks ?? {}),
              __parent_ids: nextParents,
            },
          };
        }
      }
      return p;
    });

    const normalizedNodes = normalizePerkNodesTiers(intermediateNodes).map(
      (n) => ({
        ...n,
        rule_hooks: {
          ...(n.rule_hooks ?? {}),
          __tier: n.tier,
        },
      })
    );

    await this.cascadeChangedPlacements(previousNodes, normalizedNodes, nodeId);

    this.#state.update((s) => ({
      ...s,
      perkNodes: normalizedNodes.sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
      ),
      isLoading: false,
      statusMessage: `Updated "${data.name}".`,
    }));

    this.notifications.success(
      isStandalone ? 'Standalone Ability Updated' : 'Skill Tree Node Updated',
      `Saved changes to "${data.name}".`
    );
    return true;
  }

  async moveOrReparentPerkNode(
    nodeId: string,
    targetTreeId: string | null,
    newParentNodeId: string | null = null
  ): Promise<boolean> {
    const previousNodes = this.#state().perkNodes;
    const existing = previousNodes.find((p) => p.id === nodeId);
    if (!existing) return false;

    const cleanTargetTreeId = targetTreeId || null;
    const cleanParentId = cleanTargetTreeId ? newParentNodeId || null : null;
    const oldTreeId = isStandalonePerkNode(existing) ? null : existing.tree_id;

    if (cleanTargetTreeId && cleanParentId) {
      if (cleanParentId === nodeId) {
        this.notifications.warning(
          'Invalid Placement',
          'A node cannot be connected under itself.'
        );
        return false;
      }
      const descendants = getDescendantNodeIds(nodeId, previousNodes);
      if (oldTreeId === cleanTargetTreeId && descendants.has(cleanParentId)) {
        this.notifications.warning(
          'Invalid Route Loop',
          `"${existing.name}" cannot be connected under one of its own downstream nodes.`
        );
        return false;
      }
      const parentExists = previousNodes.some(
        (p) => p.id === cleanParentId && p.tree_id === cleanTargetTreeId
      );
      if (!parentExists) {
        this.notifications.warning(
          'Invalid Prerequisite Node',
          'Selected node was not found in the target Skill Tree.'
        );
        return false;
      }
    }

    const existingParents =
      oldTreeId === cleanTargetTreeId
        ? getNodeParentIds(existing, previousNodes)
        : [];
    const targetParents = cleanParentId ? [cleanParentId] : [];
    if (
      oldTreeId === cleanTargetTreeId &&
      existingParents.length === targetParents.length &&
      existingParents.every((id, idx) => id === targetParents[idx])
    ) {
      return true;
    }

    const isLeavingOldTree = Boolean(
      oldTreeId && oldTreeId !== cleanTargetTreeId
    );
    const targetTreeNodes = cleanTargetTreeId
      ? previousNodes.filter(
          (p) =>
            p.tree_id === cleanTargetTreeId &&
            p.id !== nodeId &&
            isCompendiumItemActive(p)
        )
      : [];

    const canvasPos = !cleanTargetTreeId
      ? null
      : oldTreeId === cleanTargetTreeId && hasSavedCanvasPosition(existing)
        ? {
            x: existing.rule_hooks.__canvas_x!,
            y: existing.rule_hooks.__canvas_y!,
          }
        : suggestNewNodeCanvasPosition(targetTreeNodes, cleanParentId);

    const nextSortOrder = cleanTargetTreeId
      ? this.computeNextSiblingSortOrder(
          cleanTargetTreeId,
          cleanParentId,
          nodeId
        )
      : undefined;

    const movedDraft: PerkNodeModel[] = previousNodes.map((p): PerkNodeModel => {
      if (p.id === nodeId) {
        return {
          ...p,
          tree_id: cleanTargetTreeId,
          parent_node_id: cleanParentId,
          rule_hooks: {
            ...(p.rule_hooks ?? {}),
            __is_standalone: !cleanTargetTreeId,
            __sort_order: nextSortOrder,
            __parent_ids: cleanTargetTreeId ? targetParents : [],
            __unlock_mode: cleanTargetTreeId ? 'any' : undefined,
            __canvas_x: canvasPos?.x,
            __canvas_y: canvasPos?.y,
          },
        };
      }
      if (isLeavingOldTree && p.tree_id === oldTreeId) {
        const pParents = getNodeParentIds(p, previousNodes);
        if (pParents.includes(nodeId)) {
          const nextParents = pParents.filter((id) => id !== nodeId);
          return {
            ...p,
            parent_node_id: nextParents[0] ?? null,
            rule_hooks: {
              ...(p.rule_hooks ?? {}),
              __parent_ids: nextParents,
            },
          };
        }
      }
      return p;
    });

    const normalizedNodes = normalizePerkNodesTiers(movedDraft).map((n) => ({
      ...n,
      rule_hooks: {
        ...(n.rule_hooks ?? {}),
        __tier: n.tier,
      },
    }));

    const updatedTarget = normalizedNodes.find((n) => n.id === nodeId)!;

    this.#state.update((s) => ({
      ...s,
      perkNodes: normalizedNodes.sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
      ),
      error: null,
    }));

    const { error } = await this.compendiumService.updatePerkNodePlacement(
      nodeId,
      {
        tree_id: updatedTarget.tree_id,
        parent_node_id: updatedTarget.parent_node_id ?? null,
        tier: updatedTarget.tier,
        rule_hooks: updatedTarget.rule_hooks,
      }
    );

    if (error) {
      this.#state.update((s) => ({
        ...s,
        perkNodes: previousNodes,
        error,
      }));
      this.notifications.error('Unable to Move Node', error);
      return false;
    }

    await this.cascadeChangedPlacements(previousNodes, normalizedNodes, nodeId);

    if (!cleanTargetTreeId) {
      this.notifications.info(
        'Removed from Skill Tree',
        `"${existing.name}" is now in Standalone Arts and can be placed into another tree anytime.`
      );
    } else if (oldTreeId !== cleanTargetTreeId) {
      const targetTreeName =
        this.#state().skillTrees.find((t) => t.id === cleanTargetTreeId)
          ?.name ?? 'Skill Tree';
      this.notifications.success(
        `Added to ${targetTreeName}`,
        `"${existing.name}" has been placed onto the canvas.`
      );
    } else {
      const parentName = cleanParentId
        ? normalizedNodes.find((n) => n.id === cleanParentId)?.name
        : null;
      this.notifications.success(
        'Route Updated',
        parentName
          ? `"${existing.name}" now connects from "${parentName}".`
          : `"${existing.name}" is now a Starting Node.`
      );
    }

    return true;
  }

  async connectPerkRoute(
    sourceNodeId: string,
    targetNodeId: string
  ): Promise<boolean> {
    const previousNodes = this.#state().perkNodes;
    const source = previousNodes.find((p) => p.id === sourceNodeId);
    const target = previousNodes.find((p) => p.id === targetNodeId);
    if (!source || !target || !target.tree_id || source.tree_id !== target.tree_id) {
      return false;
    }

    const treeNodes = previousNodes.filter(
      (p) => p.tree_id === target.tree_id && isCompendiumItemActive(p)
    );
    const check = canConnectPerkRoute(sourceNodeId, targetNodeId, treeNodes);
    if (!check.allowed) {
      if (check.reason === 'cycle') {
        this.notifications.warning(
          'Invalid Route Loop',
          `Connecting "${source.name}" to "${target.name}" would create a circular prerequisite loop.`
        );
      }
      return check.reason === 'duplicate';
    }

    const currentParents = getNodeParentIds(target, treeNodes);
    const nextParents = [...currentParents, sourceNodeId];

    const draftNodes = previousNodes.map((p) =>
      p.id === targetNodeId
        ? {
            ...p,
            parent_node_id: nextParents[0] ?? null,
            rule_hooks: {
              ...(p.rule_hooks ?? {}),
              __parent_ids: nextParents,
              __unlock_mode: p.rule_hooks?.__unlock_mode ?? 'any',
            },
          }
        : p
    );

    const normalizedNodes = normalizePerkNodesTiers(draftNodes).map((n) => ({
      ...n,
      rule_hooks: {
        ...(n.rule_hooks ?? {}),
        __tier: n.tier,
      },
    }));

    const updatedTarget = normalizedNodes.find((n) => n.id === targetNodeId)!;

    this.#state.update((s) => ({
      ...s,
      perkNodes: normalizedNodes.sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
      ),
      error: null,
    }));

    const { error } = await this.compendiumService.updatePerkNodePlacement(
      targetNodeId,
      {
        tree_id: updatedTarget.tree_id,
        parent_node_id: updatedTarget.parent_node_id ?? null,
        tier: updatedTarget.tier,
        rule_hooks: updatedTarget.rule_hooks,
      }
    );

    if (error) {
      this.#state.update((s) => ({
        ...s,
        perkNodes: previousNodes,
        error,
      }));
      this.notifications.error('Unable to Connect Route', error);
      return false;
    }

    await this.cascadeChangedPlacements(
      previousNodes,
      normalizedNodes,
      targetNodeId
    );

    this.notifications.success(
      'Route Connected',
      `"${source.name}" now routes into "${target.name}".`
    );
    return true;
  }

  async disconnectPerkRoute(
    sourceNodeId: string,
    targetNodeId: string
  ): Promise<boolean> {
    const previousNodes = this.#state().perkNodes;
    const source = previousNodes.find((p) => p.id === sourceNodeId);
    const target = previousNodes.find((p) => p.id === targetNodeId);
    if (!target || !target.tree_id) return false;

    const treeNodes = previousNodes.filter(
      (p) => p.tree_id === target.tree_id && isCompendiumItemActive(p)
    );
    const currentParents = getNodeParentIds(target, treeNodes);
    if (!currentParents.includes(sourceNodeId)) return true;

    const nextParents = currentParents.filter((id) => id !== sourceNodeId);

    const draftNodes = previousNodes.map((p) =>
      p.id === targetNodeId
        ? {
            ...p,
            parent_node_id: nextParents[0] ?? null,
            rule_hooks: {
              ...(p.rule_hooks ?? {}),
              __parent_ids: nextParents,
              __unlock_mode:
                nextParents.length < 2
                  ? 'any'
                  : p.rule_hooks?.__unlock_mode ?? 'any',
            },
          }
        : p
    );

    const normalizedNodes = normalizePerkNodesTiers(draftNodes).map((n) => ({
      ...n,
      rule_hooks: {
        ...(n.rule_hooks ?? {}),
        __tier: n.tier,
      },
    }));

    const updatedTarget = normalizedNodes.find((n) => n.id === targetNodeId)!;

    this.#state.update((s) => ({
      ...s,
      perkNodes: normalizedNodes.sort(
        (a, b) => a.tier - b.tier || a.name.localeCompare(b.name)
      ),
      error: null,
    }));

    const { error } = await this.compendiumService.updatePerkNodePlacement(
      targetNodeId,
      {
        tree_id: updatedTarget.tree_id,
        parent_node_id: updatedTarget.parent_node_id ?? null,
        tier: updatedTarget.tier,
        rule_hooks: updatedTarget.rule_hooks,
      }
    );

    if (error) {
      this.#state.update((s) => ({
        ...s,
        perkNodes: previousNodes,
        error,
      }));
      this.notifications.error('Unable to Disconnect Route', error);
      return false;
    }

    await this.cascadeChangedPlacements(
      previousNodes,
      normalizedNodes,
      targetNodeId
    );

    this.notifications.info(
      'Route Disconnected',
      source
        ? `Removed route from "${source.name}" to "${target.name}".`
        : `Removed route to "${target.name}".`,
      source
        ? {
            label: 'Undo',
            callback: () => {
              void this.connectPerkRoute(sourceNodeId, targetNodeId);
            },
          }
        : undefined
    );
    return true;
  }

  async setNodeUnlockMode(
    nodeId: string,
    mode: PerkUnlockMode
  ): Promise<boolean> {
    const previousNodes = this.#state().perkNodes;
    const existing = previousNodes.find((p) => p.id === nodeId);
    if (!existing || !existing.tree_id) return false;
    if (getNodeUnlockMode(existing) === mode) return true;

    const updatedHooks: PerkNodeModel['rule_hooks'] = {
      ...(existing.rule_hooks ?? {}),
      __unlock_mode: mode,
    };

    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes.map((p) =>
        p.id === nodeId ? { ...p, rule_hooks: updatedHooks } : p
      ),
    }));

    const { error } = await this.compendiumService.updatePerkNodePlacement(
      nodeId,
      {
        tree_id: existing.tree_id,
        parent_node_id: existing.parent_node_id ?? null,
        tier: existing.tier,
        rule_hooks: updatedHooks,
      }
    );

    if (error) {
      this.#state.update((s) => ({ ...s, perkNodes: previousNodes, error }));
      this.notifications.error('Unable to Update Unlock Rule', error);
      return false;
    }
    return true;
  }

  async updateNodeCanvasPosition(
    nodeId: string,
    x: number,
    y: number
  ): Promise<boolean> {
    const previousNodes = this.#state().perkNodes;
    const existing = previousNodes.find((p) => p.id === nodeId);
    if (!existing || !existing.tree_id) return false;

    const snappedX = snapToCanvasGrid(x);
    const snappedY = snapToCanvasGrid(y);
    if (
      existing.rule_hooks?.__canvas_x === snappedX &&
      existing.rule_hooks?.__canvas_y === snappedY
    ) {
      return true;
    }

    const updatedHooks: PerkNodeModel['rule_hooks'] = {
      ...(existing.rule_hooks ?? {}),
      __canvas_x: snappedX,
      __canvas_y: snappedY,
    };

    this.#state.update((s) => ({
      ...s,
      perkNodes: s.perkNodes.map((p) =>
        p.id === nodeId ? { ...p, rule_hooks: updatedHooks } : p
      ),
    }));

    const { error } = await this.compendiumService.updatePerkNodePlacement(
      nodeId,
      {
        tree_id: existing.tree_id,
        parent_node_id: existing.parent_node_id ?? null,
        tier: existing.tier,
        rule_hooks: updatedHooks,
      }
    );

    if (error) {
      this.#state.update((s) => ({ ...s, perkNodes: previousNodes, error }));
      this.notifications.error('Unable to Save Node Position', error);
      return false;
    }
    return true;
  }

  async autoArrangeSkillTree(treeId: string): Promise<void> {
    const previousNodes = this.#state().perkNodes;
    const treeNodes = previousNodes.filter(
      (p) => p.tree_id === treeId && isCompendiumItemActive(p)
    );
    if (treeNodes.length === 0) return;

    const autoPositions = computeAutoGraphPositions(treeNodes);
    const nextNodes = previousNodes.map((p) => {
      const pt = autoPositions.get(p.id);
      if (!pt) return p;
      return {
        ...p,
        rule_hooks: {
          ...(p.rule_hooks ?? {}),
          __canvas_x: pt.x,
          __canvas_y: pt.y,
        },
      };
    });

    this.#state.update((s) => ({
      ...s,
      perkNodes: nextNodes,
    }));

    await this.cascadeChangedPlacements(previousNodes, nextNodes);
    this.notifications.info(
      'Canvas Auto-Arranged',
      'Aligned all skill nodes into balanced rows and columns.'
    );
  }

  async reorderSiblingPerkNode(
    nodeId: string,
    direction: 'left' | 'right'
  ): Promise<boolean> {
    const previousNodes = this.#state().perkNodes;
    const target = previousNodes.find((p) => p.id === nodeId);
    if (!target || !target.tree_id) return false;

    const treeNodes = this.perkNodes().filter(
      (p) => p.tree_id === target.tree_id
    );
    const activeIds = new Set(treeNodes.map((p) => p.id));
    const effectiveParent =
      target.parent_node_id && activeIds.has(target.parent_node_id)
        ? target.parent_node_id
        : null;

    const siblings = treeNodes
      .filter((p) => {
        const pParent =
          p.parent_node_id && activeIds.has(p.parent_node_id)
            ? p.parent_node_id
            : null;
        return pParent === effectiveParent;
      })
      .sort(compareSiblingPerkNodes);

    const idx = siblings.findIndex((s) => s.id === nodeId);
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) {
      return false;
    }

    const reordered = [...siblings];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];

    const orderMap = new Map<string, number>();
    reordered.forEach((s, i) => {
      orderMap.set(s.id, (i + 1) * 10);
    });

    const nextNodes = previousNodes.map((p) => {
      const assigned = orderMap.get(p.id);
      if (assigned === undefined) return p;
      return {
        ...p,
        rule_hooks: {
          ...(p.rule_hooks ?? {}),
          __sort_order: assigned,
        },
      };
    });

    this.#state.update((s) => ({
      ...s,
      perkNodes: nextNodes,
    }));

    await this.cascadeChangedPlacements(previousNodes, nextNodes);
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

    const previousNodes = this.#state().perkNodes;
    const promotedDraft = previousNodes.map((p) => {
      if (p.id === nodeId) {
        return { ...p, is_active: false, rule_hooks: nextHooks };
      }
      if (
        existing?.tree_id &&
        p.tree_id === existing.tree_id &&
        isCompendiumItemActive(p)
      ) {
        const pParents = getNodeParentIds(p, previousNodes);
        if (pParents.includes(nodeId)) {
          const nextParents = pParents.filter((id) => id !== nodeId);
          return {
            ...p,
            parent_node_id: nextParents[0] ?? null,
            rule_hooks: {
              ...(p.rule_hooks ?? {}),
              __parent_ids: nextParents,
              __unlock_mode:
                nextParents.length < 2
                  ? 'any'
                  : p.rule_hooks?.__unlock_mode ?? 'any',
            },
          };
        }
      }
      return p;
    });

    const normalizedNodes = normalizePerkNodesTiers(promotedDraft).map((n) =>
      n.id === nodeId
        ? n
        : {
            ...n,
            rule_hooks: {
              ...(n.rule_hooks ?? {}),
              __tier: n.tier,
            },
          }
    );

    await this.cascadeChangedPlacements(previousNodes, normalizedNodes, nodeId);

    this.#state.update((s) => ({
      ...s,
      perkNodes: normalizedNodes,
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

  async uploadCompendiumIcon(
    file: File,
    fallbackDataUrl: string
  ): Promise<{ url: string; storedInBucket: boolean }> {
    return this.compendiumService.uploadCompendiumIconFile(
      file,
      fallbackDataUrl
    );
  }

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

  async createArmor(
    draft: Omit<ArmorModel, 'id' | 'slug'> & { slug?: string }
  ): Promise<ArmorModel | null> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return null;

    const baseSlug = slugifyText(draft.slug || trimmedName) || 'armor';
    const existingSlugs = new Set(this.#state().armors.map((a) => a.slug));
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
      weight_class: draft.weight_class || 'Light',
      armor_sp: Math.max(0, Math.round(Number(draft.armor_sp) || 0)),
      armor_dr: Math.max(0, Math.round(Number(draft.armor_dr) || 0)),
      allows_dodge: Boolean(draft.allows_dodge),
      speed_penalty_tiles: Math.max(
        0,
        Math.round(Number(draft.speed_penalty_tiles) || 0)
      ),
      description: draft.description.trim() || 'Protective armor harness.',
      rule_hooks: draft.rule_hooks ?? {},
      is_official: true,
      created_by: this.authStore.user()?.id ?? null,
    };

    const { data, error } = await this.compendiumService.insertArmor(payload);

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Unable to Forge Armor', error);
      return null;
    }

    this.#state.update((s) => ({
      ...s,
      armors: [...s.armors, data].sort((a, b) => a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Forged armor "${data.name}".`,
    }));

    this.notifications.success(
      'Armor Forged',
      `"${data.name}" (+${data.armor_sp} SP · +${data.armor_dr} DR) added to Compendium.`
    );

    return data;
  }

  async updateArmor(
    armorId: string,
    draft: Omit<ArmorModel, 'id' | 'slug'>
  ): Promise<boolean> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return false;

    const existing = this.#state().armors.find((a) => a.id === armorId);
    if (!existing) return false;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const nextPatch: Omit<ArmorModel, 'id' | 'slug'> = {
      name: trimmedName,
      weight_class: draft.weight_class || 'Light',
      armor_sp: Math.max(0, Math.round(Number(draft.armor_sp) || 0)),
      armor_dr: Math.max(0, Math.round(Number(draft.armor_dr) || 0)),
      allows_dodge: Boolean(draft.allows_dodge),
      speed_penalty_tiles: Math.max(
        0,
        Math.round(Number(draft.speed_penalty_tiles) || 0)
      ),
      description: draft.description.trim() || 'Protective armor harness.',
      rule_hooks: {
        ...(draft.rule_hooks ?? {}),
        __is_active: existing.is_active ?? true,
      },
    };

    void this.compendiumService.updateArmorRecord(armorId, nextPatch);

    const updated: ArmorModel = {
      ...existing,
      ...nextPatch,
      is_active: existing.is_active ?? true,
    };

    this.#state.update((s) => ({
      ...s,
      armors: s.armors
        .map((a) => (a.id === armorId ? updated : a))
        .sort((a, b) => a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Updated armor "${updated.name}".`,
    }));

    this.notifications.success(
      'Armor Updated',
      `Saved changes to "${updated.name}".`
    );

    return true;
  }

  async setArmorActive(armorId: string, isActive: boolean): Promise<boolean> {
    const existing = this.#state().armors.find((a) => a.id === armorId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      __is_active: isActive,
    };

    void this.compendiumService.updateArmorActiveStatus(
      armorId,
      nextHooks,
      isActive
    );

    this.#state.update((s) => ({
      ...s,
      armors: s.armors.map((a) =>
        a.id === armorId
          ? { ...a, is_active: isActive, rule_hooks: nextHooks }
          : a
      ),
      statusMessage: isActive
        ? `Restored "${existing.name}" to active Armors.`
        : `Archived "${existing.name}".`,
    }));

    return true;
  }

  async deleteArmor(armorId: string): Promise<boolean> {
    const existing = this.#state().armors.find((a) => a.id === armorId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      __is_active: false,
    };

    void this.compendiumService.deleteArmorRecord(
      armorId,
      existing.slug,
      nextHooks
    );

    this.#state.update((s) => ({
      ...s,
      armors: s.armors.map((a) =>
        a.id === armorId
          ? { ...a, is_active: false, rule_hooks: nextHooks }
          : a
      ),
      statusMessage: `Deleted "${existing.name}" from Armors.`,
    }));

    this.notifications.info(
      'Armor Deleted',
      `Removed "${existing.name}" from active Armors.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setArmorActive(armorId, true);
        },
      }
    );

    return true;
  }

  async createCompendiumItem(
    draft: Omit<CompendiumItemModel, 'id' | 'slug'> & { slug?: string }
  ): Promise<CompendiumItemModel | null> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return null;

    const baseSlug = slugifyText(draft.slug || trimmedName) || 'item';
    const existingSlugs = new Set(this.#state().items.map((i) => i.slug));
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
      subcategory: draft.subcategory.trim() || 'Adventuring Gear',
      default_quantity: Math.max(
        1,
        Math.round(Number(draft.default_quantity) || 1)
      ),
      stackable: draft.stackable !== false,
      description: draft.description.trim() || 'Adventuring gear.',
      rule_hooks: draft.rule_hooks ?? {},
      is_official: true,
      created_by: this.authStore.user()?.id ?? null,
    };

    const { data, error } =
      await this.compendiumService.insertCompendiumItem(payload);

    if (error || !data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error,
      }));
      if (error) this.notifications.error('Unable to Create Item', error);
      return null;
    }

    this.#state.update((s) => ({
      ...s,
      items: [...s.items, data].sort((a, b) => a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Created item "${data.name}".`,
    }));

    this.notifications.success(
      'Item Created',
      `"${data.name}" (${data.subcategory}) added to Compendium.`
    );

    return data;
  }

  async updateCompendiumItem(
    itemId: string,
    draft: Omit<CompendiumItemModel, 'id' | 'slug'>
  ): Promise<boolean> {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return false;

    const existing = this.#state().items.find((i) => i.id === itemId);
    if (!existing) return false;

    this.#state.update((s) => ({
      ...s,
      isLoading: true,
      error: null,
      statusMessage: null,
    }));

    const nextPatch: Omit<CompendiumItemModel, 'id' | 'slug'> = {
      name: trimmedName,
      subcategory: draft.subcategory.trim() || 'Adventuring Gear',
      default_quantity: Math.max(
        1,
        Math.round(Number(draft.default_quantity) || 1)
      ),
      stackable: draft.stackable !== false,
      description: draft.description.trim() || 'Adventuring gear.',
      rule_hooks: {
        ...(draft.rule_hooks ?? {}),
        __is_active: existing.is_active ?? true,
      },
    };

    void this.compendiumService.updateCompendiumItemRecord(itemId, nextPatch);

    const updated: CompendiumItemModel = {
      ...existing,
      ...nextPatch,
      is_active: existing.is_active ?? true,
    };

    this.#state.update((s) => ({
      ...s,
      items: s.items
        .map((i) => (i.id === itemId ? updated : i))
        .sort((a, b) => a.name.localeCompare(b.name)),
      isLoading: false,
      statusMessage: `Updated item "${updated.name}".`,
    }));

    this.notifications.success(
      'Item Updated',
      `Saved changes to "${updated.name}".`
    );

    return true;
  }

  async setCompendiumItemActive(
    itemId: string,
    isActive: boolean
  ): Promise<boolean> {
    const existing = this.#state().items.find((i) => i.id === itemId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      __is_active: isActive,
    };

    void this.compendiumService.updateCompendiumItemActiveStatus(
      itemId,
      nextHooks,
      isActive
    );

    this.#state.update((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.id === itemId
          ? { ...i, is_active: isActive, rule_hooks: nextHooks }
          : i
      ),
      statusMessage: isActive
        ? `Restored "${existing.name}" to active Items.`
        : `Archived "${existing.name}".`,
    }));

    return true;
  }

  async deleteCompendiumItem(itemId: string): Promise<boolean> {
    const existing = this.#state().items.find((i) => i.id === itemId);
    if (!existing) return false;

    const nextHooks: Record<string, unknown> = {
      ...(existing.rule_hooks ?? {}),
      __is_active: false,
    };

    void this.compendiumService.deleteCompendiumItemRecord(
      itemId,
      existing.slug,
      nextHooks
    );

    this.#state.update((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.id === itemId
          ? { ...i, is_active: false, rule_hooks: nextHooks }
          : i
      ),
      statusMessage: `Deleted "${existing.name}" from Items.`,
    }));

    this.notifications.info(
      'Item Deleted',
      `Removed "${existing.name}" from active Items.`,
      {
        label: 'Undo Delete',
        callback: () => {
          void this.setCompendiumItemActive(itemId, true);
        },
      }
    );

    return true;
  }
}
