import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ART_UPGRADE_HOOK_KEYS,
  ActiveCombatTag,
  CombatArtUpgradeTargetMode,
  CombatArtWeaponRequirement,
  CombatTag,
  EditableRuleHookKey,
  PerkNodeModel,
  PerkNodeUiKind,
  PerkRuleHooks,
  PerkUnlockMode,
  RULE_HOOK_DEFINITIONS,
  ResolvedCompendiumVisuals,
  RuleHookDefinition,
  RuleHookRow,
  SkillGraphPoint,
  WEAPON_CATEGORY_OPTIONS,
  WeaponHandednessOption,
  WeaponModel,
  artUpgradeToHookRows,
  compareSiblingPerkNodes,
  compileArtUpgradeSpec,
  computePerkNodeTier,
  formatArtUpgradeBadges,
  formatRuleHookBadges,
  formatWeaponRequirementLabel,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  getDescendantNodeIds,
  getNodeParentIds,
  getNodeUiKind,
  getNodeUnlockMode,
  hasSavedCanvasPosition,
  hooksObjectToRows,
  isStandalonePerkNode,
  normalizeWeaponRequirement,
  resolveNodeVisuals,
  rowsToHooksObject,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../../../shared/compendium-icon/icon-picker.component';
import { KeywordTextareaComponent } from '../../../../shared/keyword-text/keyword-textarea.component';

@Component({
  selector: 'app-perk-node-modal',
  standalone: true,
  imports: [
    FormsModule,
    KeywordTextareaComponent,
    IconPickerComponent,
    CompendiumIconComponent,
  ],
  templateUrl: './perk-node-modal.component.html',
})
export class PerkNodeModalComponent {
  readonly compendiumStore = inject(CompendiumStore);
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;

  readonly requestCreateKeyword = output<string>();
  readonly standaloneNodeSaved = output<string>();
  readonly treeNodeSaved = output<string>();

  readonly ruleHookDefinitions = RULE_HOOK_DEFINITIONS;
  readonly sheetStatHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Sheet Stat Bonus'
  );
  readonly combatEffectHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Combat Art Effect'
  );
  readonly artUpgradeHookDefs: RuleHookDefinition[] = ART_UPGRADE_HOOK_KEYS.map(
    (k) => RULE_HOOK_DEFINITIONS.find((d) => d.key === k)!
  ).filter(Boolean);

  readonly upgradeableTags: ActiveCombatTag[] = [
    'Crushing',
    'Piercing',
    'Sweeping',
  ];

  readonly isOpen = signal(false);
  readonly editingNodeId = signal<string | null>(null);
  readonly uiNodeKind = signal<PerkNodeUiKind>('combat_art');
  readonly treeIdSignal = signal<string | null>(null);
  readonly combatTagSignal = signal<CombatTag>('Crushing');

  readonly upgradeTargetMode =
    signal<CombatArtUpgradeTargetMode>('specific_arts');
  readonly upgradeTargetArtIds = signal<string[]>([]);
  readonly upgradeCombatTags = signal<ActiveCombatTag[]>([]);
  readonly upgradeApDelta = signal<number>(0);
  readonly upgradeCooldownDelta = signal<number>(0);

  readonly reqCategories = signal<string[]>([]);
  readonly reqHandedness = signal<WeaponHandednessOption | null>(null);
  readonly reqGuardWeapon = signal<boolean>(false);
  readonly reqThrown = signal<boolean>(false);
  readonly reqShield = signal<boolean>(false);
  readonly reqWeaponIds = signal<string[]>([]);
  readonly addSpecificWeaponId = signal<string>('');

  readonly hookRows = signal<RuleHookRow[]>([]);
  readonly selectedParentIds = signal<string[]>([]);
  readonly unlockMode = signal<PerkUnlockMode>('any');
  readonly addParentPickerId = signal<string>('');

  private originalTreeId: string | null = null;
  private preservedCanvasPos: SkillGraphPoint | null = null;
  private preservedSortOrder: number | undefined = undefined;

  nodeForm: {
    tree_id: string | null;
    name: string;
    node_type: 'combat_art' | 'passive_upgrade';
    perk_cost: number;
    ap_cost: number;
    cooldown_rounds: number;
    combat_tag: CombatTag;
    description: string;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    tree_id: '',
    name: '',
    node_type: 'combat_art',
    perk_cost: 1,
    ap_cost: 2,
    cooldown_rounds: 3,
    combat_tag: 'Crushing',
    description: '',
    icon: 'greatsword',
    icon_color: '#FF8C5A',
    icon_tint_custom: true,
  };

  readonly availableTreeCombatArts = computed<PerkNodeModel[]>(() => {
    const treeId = this.treeIdSignal();
    if (!treeId) return [];
    const editId = this.editingNodeId();
    return this.compendiumStore
      .perkNodes()
      .filter(
        (p) =>
          p.tree_id === treeId &&
          p.node_type === 'combat_art' &&
          p.id !== editId
      )
      .sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b));
  });

  readonly isUpgradeConfigValid = computed(() => {
    if (this.uiNodeKind() !== 'combat_art_upgrade') return true;
    if (!this.treeIdSignal()) return true;
    if (this.upgradeTargetMode() === 'player_choice_tree') return true;
    return this.upgradeTargetArtIds().length > 0;
  });

  readonly activeRuleHookPool = computed<RuleHookDefinition[]>(() =>
    this.uiNodeKind() === 'combat_art_upgrade'
      ? this.artUpgradeHookDefs
      : this.ruleHookDefinitions
  );

  readonly availableWeaponCategories = computed<string[]>(() => {
    const base: string[] = [...WEAPON_CATEGORY_OPTIONS];
    const lowerSeen = new Set(base.map((c) => c.toLowerCase()));
    for (const w of this.compendiumStore.weapons()) {
      const cat = (w.category ?? '').trim();
      if (cat && !lowerSeen.has(cat.toLowerCase())) {
        lowerSeen.add(cat.toLowerCase());
        base.push(cat);
      }
    }
    return base;
  });

  readonly selectedReqWeapons = computed<WeaponModel[]>(() => {
    const byId = new Map(
      this.compendiumStore.weapons().map((w) => [w.id, w])
    );
    return this.reqWeaponIds()
      .map((id) => byId.get(id))
      .filter((w): w is WeaponModel => w !== undefined);
  });

  readonly availableSpecificWeapons = computed<WeaponModel[]>(() => {
    const selected = new Set(this.reqWeaponIds());
    return this.compendiumStore
      .weapons()
      .filter((w) => !selected.has(w.id));
  });

  readonly currentWeaponRequirement = computed<
    CombatArtWeaponRequirement | undefined
  >(() => {
    const weaponsById = new Map(
      this.compendiumStore.weapons().map((w) => [w.id, w.name])
    );
    const ids = this.reqWeaponIds();
    const names = ids
      .map((id) => weaponsById.get(id))
      .filter((n): n is string => Boolean(n));

    return normalizeWeaponRequirement({
      categories: this.reqCategories(),
      handedness: this.reqHandedness() ?? undefined,
      requires_guard_weapon: this.reqGuardWeapon(),
      requires_thrown: this.reqThrown(),
      requires_shield: this.reqShield(),
      weapon_ids: ids,
      weapon_names: names,
    });
  });

  readonly currentWeaponRequirementLabel = computed<string | null>(() =>
    formatWeaponRequirementLabel(
      this.currentWeaponRequirement(),
      this.compendiumStore.weapons()
    )
  );

  readonly liveCompiledBadges = computed(() => {
    const kind = this.uiNodeKind();
    if (kind === 'combat_art_upgrade') {
      const spec = compileArtUpgradeSpec({
        targetMode: this.treeIdSignal()
          ? this.upgradeTargetMode()
          : 'player_choice_tree',
        targetArtIds: this.upgradeTargetArtIds(),
        addCombatTags: this.upgradeCombatTags(),
        apCostDelta: this.upgradeApDelta(),
        cooldownDelta: this.upgradeCooldownDelta(),
        hookRows: this.hookRows(),
      });
      return formatArtUpgradeBadges(spec);
    }

    const compiled = rowsToHooksObject(
      this.hookRows(),
      kind === 'combat_art' ? 'combat_art' : 'passive_upgrade',
      this.combatTagSignal()
    );
    const badges = formatRuleHookBadges(compiled);
    if (kind === 'combat_art') {
      const reqLabel = this.currentWeaponRequirementLabel();
      if (reqLabel) {
        return [reqLabel, ...badges];
      }
    }
    return badges;
  });

  private resetWeaponReqSignals(
    req?: CombatArtWeaponRequirement | null
  ): void {
    const norm = normalizeWeaponRequirement(req);
    this.reqCategories.set([...(norm?.categories ?? [])]);
    this.reqHandedness.set(norm?.handedness ?? null);
    this.reqGuardWeapon.set(Boolean(norm?.requires_guard_weapon));
    this.reqThrown.set(Boolean(norm?.requires_thrown));
    this.reqShield.set(Boolean(norm?.requires_shield));
    this.reqWeaponIds.set([...(norm?.weapon_ids ?? [])]);
    this.addSpecificWeaponId.set('');
  }

  clearWeaponReq(): void {
    this.resetWeaponReqSignals(null);
  }

  toggleReqCategory(cat: string): void {
    this.reqCategories.update((curr) =>
      curr.includes(cat) ? curr.filter((c) => c !== cat) : [...curr, cat]
    );
  }

  toggleReqHandedness(mode: WeaponHandednessOption): void {
    this.reqHandedness.update((curr) => (curr === mode ? null : mode));
  }

  addReqSpecificWeapon(): void {
    const id = this.addSpecificWeaponId();
    if (!id) return;
    this.addSpecificWeaponId.set('');
    this.reqWeaponIds.update((curr) =>
      curr.includes(id) ? curr : [...curr, id]
    );
  }

  removeReqSpecificWeapon(id: string): void {
    this.reqWeaponIds.update((curr) => curr.filter((x) => x !== id));
  }

  private resetUpgradeSignals(defaultTreeId: string | null, defaultArtIds: string[] = []): void {
    const hasTreeArts = defaultTreeId
      ? this.compendiumStore
          .perkNodes()
          .some((p) => p.tree_id === defaultTreeId && p.node_type === 'combat_art')
      : false;
    this.upgradeTargetMode.set(
      defaultTreeId && hasTreeArts ? 'specific_arts' : 'player_choice_tree'
    );
    this.upgradeTargetArtIds.set(defaultArtIds);
    this.upgradeCombatTags.set([]);
    this.upgradeApDelta.set(0);
    this.upgradeCooldownDelta.set(0);
  }

  openNewNodeModal(defaultTreeId: string | null): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    this.originalTreeId = defaultTreeId;
    this.preservedCanvasPos = null;
    this.preservedSortOrder = undefined;
    this.selectedParentIds.set([]);
    this.unlockMode.set('any');
    this.addParentPickerId.set('');
    this.uiNodeKind.set('combat_art');
    this.treeIdSignal.set(defaultTreeId);
    this.combatTagSignal.set('Crushing');
    this.resetUpgradeSignals(defaultTreeId);
    this.resetWeaponReqSignals(null);
    this.nodeForm = {
      tree_id: defaultTreeId,
      name: '',
      node_type: 'combat_art',
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: 'Crushing',
      description: '',
      icon: 'greatsword',
      icon_color: '#FF8C5A',
      icon_tint_custom: true,
    };
    this.hookRows.set([]);
    this.isOpen.set(true);
  }

  openNewStandaloneNodeModal(): void {
    this.openNewNodeModal(null);
  }

  openBranchChildModal(parentNode: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    const parentVis = resolveNodeVisuals(parentNode);
    const parentKind = getNodeUiKind(parentNode);
    this.originalTreeId = parentNode.tree_id;
    this.preservedCanvasPos = null;
    this.preservedSortOrder = undefined;
    this.selectedParentIds.set([parentNode.id]);
    this.unlockMode.set('any');
    this.addParentPickerId.set('');
    const initialKind: PerkNodeUiKind =
      parentKind === 'combat_art_upgrade' ? 'passive_upgrade' : parentKind;
    this.uiNodeKind.set(initialKind);
    this.treeIdSignal.set(parentNode.tree_id);
    const tag = parentNode.combat_tag ?? 'Crushing';
    this.combatTagSignal.set(tag);
    this.resetUpgradeSignals(
      parentNode.tree_id,
      parentNode.node_type === 'combat_art' ? [parentNode.id] : []
    );
    this.resetWeaponReqSignals(null);
    this.nodeForm = {
      tree_id: parentNode.tree_id,
      name: '',
      node_type: initialKind === 'combat_art' ? 'combat_art' : 'passive_upgrade',
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: tag,
      description: '',
      icon: parentVis.icon,
      icon_color: parentVis.color,
      icon_tint_custom: parentVis.tintCustom,
    };
    this.hookRows.set([]);
    this.isOpen.set(true);
  }

  openEditNodeModal(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(node.id);
    const visuals = resolveNodeVisuals(node);
    const resolvedTreeId = isStandalonePerkNode(node) ? null : node.tree_id;
    const kind = getNodeUiKind(node);

    this.originalTreeId = resolvedTreeId;
    this.preservedCanvasPos = hasSavedCanvasPosition(node)
      ? {
          x: node.rule_hooks.__canvas_x!,
          y: node.rule_hooks.__canvas_y!,
        }
      : null;
    this.preservedSortOrder = node.rule_hooks?.__sort_order;

    const treeNodes = resolvedTreeId
      ? this.compendiumStore
          .perkNodes()
          .filter((p) => p.tree_id === resolvedTreeId)
      : [];
    this.selectedParentIds.set(
      resolvedTreeId ? getNodeParentIds(node, treeNodes) : []
    );
    this.unlockMode.set(getNodeUnlockMode(node));
    this.addParentPickerId.set('');

    this.uiNodeKind.set(kind);
    this.treeIdSignal.set(resolvedTreeId);
    const tag = node.combat_tag ?? 'None';
    this.combatTagSignal.set(tag);

    if (kind === 'combat_art_upgrade' && node.rule_hooks?.__art_upgrade) {
      const spec = node.rule_hooks.__art_upgrade;
      const validTreeCombatArtIds = new Set(
        treeNodes
          .filter((n) => n.node_type === 'combat_art' && n.id !== node.id)
          .map((n) => n.id)
      );
      const filteredTargets = resolvedTreeId
        ? (spec.target_art_ids ?? []).filter((id) => validTreeCombatArtIds.has(id))
        : [];
      this.upgradeTargetMode.set(
        resolvedTreeId ? spec.target_mode : 'player_choice_tree'
      );
      this.upgradeTargetArtIds.set(filteredTargets);
      this.upgradeCombatTags.set([...(spec.add_combat_tags ?? [])]);
      this.upgradeApDelta.set(Number(spec.ap_cost_delta ?? 0));
      this.upgradeCooldownDelta.set(Number(spec.cooldown_delta ?? 0));
      this.resetWeaponReqSignals(null);
      this.hookRows.set(artUpgradeToHookRows(spec));
    } else {
      this.resetUpgradeSignals(resolvedTreeId);
      this.resetWeaponReqSignals(
        kind === 'combat_art' ? node.rule_hooks?.__weapon_req : null
      );
      this.hookRows.set(hooksObjectToRows(node.rule_hooks));
    }

    this.nodeForm = {
      tree_id: resolvedTreeId,
      name: node.name,
      node_type: node.node_type,
      perk_cost: node.perk_cost ?? 1,
      ap_cost: node.ap_cost ?? 1,
      cooldown_rounds: node.cooldown_rounds ?? 2,
      combat_tag: tag,
      description: node.description,
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };
    this.isOpen.set(true);
  }

  closeModal(): void {
    this.isOpen.set(false);
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  onUiNodeKindChange(nextKind: PerkNodeUiKind): void {
    this.uiNodeKind.set(nextKind);
    this.nodeForm.node_type =
      nextKind === 'combat_art' ? 'combat_art' : 'passive_upgrade';

    const standardDefaults = ['#FF8C5A', '#F59E0B', '#38B29A'];
    if (
      !this.editingNodeId() &&
      standardDefaults.includes(this.nodeForm.icon_color)
    ) {
      this.nodeForm.icon_color =
        nextKind === 'combat_art'
          ? '#FF8C5A'
          : nextKind === 'combat_art_upgrade'
            ? '#F59E0B'
            : '#38B29A';
    }

    if (nextKind === 'combat_art_upgrade') {
      const allowedSet = new Set<EditableRuleHookKey>(ART_UPGRADE_HOOK_KEYS);
      this.hookRows.update((rows) =>
        rows.filter((r) => allowedSet.has(r.key))
      );

      if (!this.treeIdSignal()) {
        this.upgradeTargetMode.set('player_choice_tree');
      } else if (this.availableTreeCombatArts().length === 0) {
        this.upgradeTargetMode.set('player_choice_tree');
      } else if (
        this.upgradeTargetMode() === 'specific_arts' &&
        this.upgradeTargetArtIds().length === 0
      ) {
        const parentArts = this.selectedParentNodes().filter(
          (p) => p.node_type === 'combat_art'
        );
        if (parentArts.length > 0) {
          this.upgradeTargetArtIds.set([parentArts[0].id]);
        }
      }
    }
  }

  onCombatTagChange(nextTag: CombatTag): void {
    this.nodeForm.combat_tag = nextTag;
    this.combatTagSignal.set(nextTag);
  }

  onTreeSelectionChange(newTreeId: string | null): void {
    this.nodeForm.tree_id = newTreeId;
    this.treeIdSignal.set(newTreeId);
    this.addParentPickerId.set('');
    if (!newTreeId) {
      this.selectedParentIds.set([]);
      this.upgradeTargetArtIds.set([]);
      this.upgradeTargetMode.set('player_choice_tree');
      return;
    }
    const treeNodes = this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === newTreeId);
    const validTreeNodeIds = new Set(treeNodes.map((p) => p.id));
    const validTreeArtIds = new Set(
      treeNodes.filter((p) => p.node_type === 'combat_art').map((p) => p.id)
    );
    this.selectedParentIds.update((ids) =>
      ids.filter((id) => validTreeNodeIds.has(id))
    );
    this.upgradeTargetArtIds.update((ids) =>
      ids.filter((id) => validTreeArtIds.has(id))
    );
    if (validTreeArtIds.size === 0) {
      this.upgradeTargetMode.set('player_choice_tree');
    }
  }

  toggleUpgradeTargetArt(artId: string): void {
    this.upgradeTargetArtIds.update((curr) =>
      curr.includes(artId)
        ? curr.filter((id) => id !== artId)
        : [...curr, artId]
    );
  }

  toggleUpgradeCombatTag(tag: ActiveCombatTag): void {
    this.upgradeCombatTags.update((curr) =>
      curr.includes(tag) ? curr.filter((t) => t !== tag) : [...curr, tag]
    );
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getUpgradeHookLabel(def: RuleHookDefinition): string {
    if (def.key === 'bonus_flat_damage') {
      return 'Bonus Flat Damage on Upgraded Art';
    }
    if (def.key === 'bonus_attack_mod') {
      return 'Bonus Attack Roll on Upgraded Art';
    }
    return def.label;
  }

  selectedParentNodes(): PerkNodeModel[] {
    const treeId = this.nodeForm.tree_id;
    if (!treeId) return [];
    const byId = new Map(
      this.compendiumStore
        .perkNodes()
        .filter((p) => p.tree_id === treeId)
        .map((p) => [p.id, p])
    );
    return this.selectedParentIds()
      .map((id) => byId.get(id))
      .filter((n): n is PerkNodeModel => n !== undefined);
  }

  availableParentNodes(): PerkNodeModel[] {
    const treeId = this.nodeForm.tree_id;
    if (!treeId) return [];
    const editingId = this.editingNodeId();
    const allNodes = this.compendiumStore.perkNodes();
    const descendants = editingId
      ? getDescendantNodeIds(editingId, allNodes)
      : new Set<string>();
    const alreadySelected = new Set(this.selectedParentIds());

    return allNodes
      .filter(
        (p) =>
          p.tree_id === treeId &&
          p.id !== editingId &&
          !descendants.has(p.id) &&
          !alreadySelected.has(p.id)
      )
      .sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b));
  }

  addSelectedParentFromPicker(): void {
    const id = this.addParentPickerId();
    if (!id) return;
    this.addParentPickerId.set('');
    this.selectedParentIds.update((curr) =>
      curr.includes(id) ? curr : [...curr, id]
    );
  }

  removeSelectedParent(parentId: string): void {
    this.selectedParentIds.update((curr) =>
      curr.filter((id) => id !== parentId)
    );
  }

  clearAllParents(): void {
    this.selectedParentIds.set([]);
  }

  getComputedFormTier(): number {
    if (!this.nodeForm.tree_id) return 1;
    return computePerkNodeTier(
      this.nodeForm.tree_id,
      this.selectedParentIds(),
      this.compendiumStore.perkNodes()
    );
  }

  getHookDef(key: EditableRuleHookKey): RuleHookDefinition | undefined {
    return RULE_HOOK_DEFINITIONS.find((d) => d.key === key);
  }

  addRuleHookRow(): void {
    const pool = this.activeRuleHookPool();
    const usedKeys = new Set(this.hookRows().map((r) => r.key));
    const nextDef = pool.find((d) => !usedKeys.has(d.key)) ?? pool[0];
    if (!nextDef) return;

    this.hookRows.update((rows) => [
      ...rows,
      {
        key: nextDef.key,
        numValue:
          typeof nextDef.defaultValue === 'number' ? nextDef.defaultValue : 1,
        statusValue:
          typeof nextDef.defaultValue === 'string'
            ? nextDef.defaultValue
            : 'Sundered',
      },
    ]);
  }

  removeRuleHookRow(index: number): void {
    this.hookRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateRowKey(index: number, newKey: EditableRuleHookKey): void {
    const def = this.getHookDef(newKey);
    this.hookRows.update((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              key: newKey,
              numValue:
                typeof def?.defaultValue === 'number' ? def.defaultValue : 1,
              statusValue:
                typeof def?.defaultValue === 'string'
                  ? def.defaultValue
                  : 'Sundered',
            }
          : row
      )
    );
  }

  updateRowNum(index: number, value: number): void {
    this.hookRows.update((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, numValue: Number(value) } : row
      )
    );
  }

  updateRowStatus(index: number, statusValue: RuleHookRow['statusValue']): void {
    this.hookRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, statusValue } : row))
    );
  }

  async saveNode(): Promise<void> {
    if (!this.isUpgradeConfigValid()) return;

    const kind = this.uiNodeKind();
    const isStandalone = !this.nodeForm.tree_id;
    const dbNodeType: 'combat_art' | 'passive_upgrade' =
      kind === 'combat_art' ? 'combat_art' : 'passive_upgrade';

    let compiledHooks: PerkRuleHooks;
    if (kind === 'combat_art_upgrade') {
      const effectiveMode: CombatArtUpgradeTargetMode = isStandalone
        ? 'player_choice_tree'
        : this.upgradeTargetMode();
      compiledHooks = {
        __art_upgrade: compileArtUpgradeSpec({
          targetMode: effectiveMode,
          targetArtIds: isStandalone ? [] : this.upgradeTargetArtIds(),
          addCombatTags: this.upgradeCombatTags(),
          apCostDelta: this.upgradeApDelta(),
          cooldownDelta: this.upgradeCooldownDelta(),
          hookRows: this.hookRows(),
        }),
      };
    } else {
      compiledHooks = rowsToHooksObject(
        this.hookRows(),
        dbNodeType,
        this.nodeForm.combat_tag
      );
      if (kind === 'combat_art') {
        const weaponReq = this.currentWeaponRequirement();
        if (weaponReq) {
          compiledHooks.__weapon_req = weaponReq;
        }
      }
    }

    const parentIds = isStandalone ? [] : [...this.selectedParentIds()];
    const editId = this.editingNodeId();
    const stayedInSameTree =
      Boolean(editId) && (this.nodeForm.tree_id || null) === this.originalTreeId;

    if (!isStandalone) {
      if (parentIds.length > 0) {
        compiledHooks.__parent_ids = parentIds;
      }
      if (parentIds.length >= 2 && this.unlockMode() === 'all') {
        compiledHooks.__unlock_mode = 'all';
      }
      if (stayedInSameTree && this.preservedCanvasPos) {
        compiledHooks.__canvas_x = this.preservedCanvasPos.x;
        compiledHooks.__canvas_y = this.preservedCanvasPos.y;
      }
      if (stayedInSameTree && typeof this.preservedSortOrder === 'number') {
        compiledHooks.__sort_order = this.preservedSortOrder;
      }
    }

    const payload = {
      tree_id: this.nodeForm.tree_id || null,
      name: this.nodeForm.name,
      node_type: dbNodeType,
      tier: isStandalone ? 1 : this.getComputedFormTier(),
      perk_cost: Number(this.nodeForm.perk_cost) || 1,
      ap_cost:
        dbNodeType === 'combat_art' ? Number(this.nodeForm.ap_cost) : null,
      cooldown_rounds:
        dbNodeType === 'combat_art'
          ? Number(this.nodeForm.cooldown_rounds)
          : null,
      combat_tag:
        dbNodeType === 'combat_art' ? this.nodeForm.combat_tag : 'None',
      description: this.nodeForm.description,
      rule_hooks: compiledHooks,
      parent_node_id: isStandalone ? null : (parentIds[0] ?? null),
      icon: this.nodeForm.icon,
      icon_color: this.nodeForm.icon_color,
      icon_tint_custom: this.nodeForm.icon_tint_custom,
    };

    if (editId) {
      const ok = await this.compendiumStore.updatePerkNode(editId, payload);
      if (ok) {
        if (isStandalone) {
          this.standaloneNodeSaved.emit(editId);
        } else {
          this.treeNodeSaved.emit(editId);
        }
        this.closeModal();
      }
    } else {
      const created = await this.compendiumStore.createPerkNode(payload);
      if (created) {
        if (isStandalone) {
          this.standaloneNodeSaved.emit(created.id);
        } else {
          this.treeNodeSaved.emit(created.id);
        }
        this.closeModal();
      }
    }
  }
}
