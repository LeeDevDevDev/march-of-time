import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttributeName,
  CombatSkillName,
  CombatTag,
  EditableRuleHookKey,
  KeywordDefinition,
  PerkNodeModel,
  RULE_HOOK_DEFINITIONS,
  ResolvedCompendiumVisuals,
  RuleHookDefinition,
  RuleHookRow,
  SkillTreeModel,
  WeaponModel,
  formatRuleHookBadges,
  formatWeaponHookBadges,
  getHeavyWeaponBlockBase,
  getTreeArchetypeIcon,
  hooksObjectToRows,
  isCompendiumItemActive,
  isWeaponHeavy,
  isWeaponTwoHanded,
  resolveNodeVisuals,
  resolveTreeVisuals,
  resolveWeaponVisuals,
  rowsToHooksObject,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../shared/compendium-icon/icon-picker.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { KeywordTextComponent } from '../../shared/keyword-text/keyword-text.component';
import { KeywordTextareaComponent } from '../../shared/keyword-text/keyword-textarea.component';
import { SkillTreeCanvasComponent } from '../../shared/skill-tree-canvas/skill-tree-canvas.component';

@Component({
  selector: 'app-content-manager',
  standalone: true,
  imports: [
    FormsModule,
    SkillTreeCanvasComponent,
    KeywordTextareaComponent,
    KeywordTextComponent,
    CompendiumIconComponent,
    IconPickerComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './content-manager.component.html',
})
export class ContentManagerComponent implements OnInit {
  readonly compendiumStore = inject(CompendiumStore);

  @ViewChild('descTextarea') descTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly ruleHookDefinitions = RULE_HOOK_DEFINITIONS;
  readonly sheetStatHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Sheet Stat Bonus'
  );
  readonly combatEffectHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Combat Art Effect'
  );

  // Studio Tab: 'trees' vs 'weapons' vs 'keywords'
  readonly studioTab = signal<'trees' | 'weapons' | 'keywords'>('trees');
  readonly treeSearch = signal<string>('');
  readonly keywordSearch = signal<string>('');
  readonly weaponSearch = signal<string>('');
  readonly weaponCategoryFilter = signal<string>('All');
  readonly selectedWeaponId = signal<string | null>(null);

  // Active vs Archived Status Filters for each pillar
  readonly treeStatusFilter = signal<'active' | 'archived'>('active');
  readonly weaponStatusFilter = signal<'active' | 'archived'>('active');
  readonly keywordStatusFilter = signal<'active' | 'archived'>('active');

  readonly archivedTreesCount = computed(
    () =>
      this.compendiumStore
        .allSkillTrees()
        .filter((t) => !isCompendiumItemActive(t)).length
  );
  readonly archivedWeaponsCount = computed(
    () =>
      this.compendiumStore
        .allWeapons()
        .filter((w) => !isCompendiumItemActive(w)).length
  );
  readonly archivedKeywordsCount = computed(
    () =>
      this.compendiumStore
        .allKeywords()
        .filter((k) => !isCompendiumItemActive(k)).length
  );

  readonly filteredTrees = computed(() => {
    const q = this.treeSearch().trim().toLowerCase();
    const showActive = this.treeStatusFilter() === 'active';
    const list = this.compendiumStore
      .allSkillTrees()
      .filter((t) => isCompendiumItemActive(t) === showActive);
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  });

  readonly weaponFilterOptions: { id: string; label: string }[] = [
    { id: 'All', label: 'All Weapons' },
    { id: 'Two-Handed', label: 'Two-Handed' },
    { id: 'Heavy-Block', label: 'Heavy (Can Block)' },
    { id: 'Heavy', label: 'Heavy Class' },
    { id: 'Martial', label: 'Martial' },
    { id: 'Light', label: 'Light' },
    { id: 'Ranged', label: 'Ranged' },
  ];

  readonly filteredWeapons = computed(() => {
    const q = this.weaponSearch().trim().toLowerCase();
    const filter = this.weaponCategoryFilter();
    const showActive = this.weaponStatusFilter() === 'active';
    return this.compendiumStore.allWeapons().filter((w) => {
      if (isCompendiumItemActive(w) !== showActive) return false;
      if (filter === 'Two-Handed' && !isWeaponTwoHanded(w)) return false;
      if (filter === 'Heavy-Block' && !isWeaponHeavy(w)) return false;
      if (
        filter !== 'All' &&
        filter !== 'Two-Handed' &&
        filter !== 'Heavy-Block' &&
        w.category.toLowerCase() !== filter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.trait_name.toLowerCase().includes(q) ||
        w.trait_description.toLowerCase().includes(q)
      );
    });
  });

  readonly selectedWeapon = computed(() => {
    const list = this.filteredWeapons();
    const id = this.selectedWeaponId();
    if (id) {
      const found = list.find((w) => w.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  // Weapon Modal State
  readonly weaponModalOpen = signal(false);
  readonly editingWeaponId = signal<string | null>(null);
  weaponForm: {
    name: string;
    category: string;
    ap_cost: number;
    requires_aim: boolean;
    gov_attribute: AttributeName;
    gov_skill: CombatSkillName;
    base_damage: number;
    reach_tiles: number;
    thrown_range_tiles: number | null;
    trait_name: string;
    trait_description: string;
    two_handed: boolean;
    heavy: boolean;
    heavy_block_base: number;
    parry_roll_bonus: number;
    flawless_parry_bonus_sp_damage: number;
    ignore_armor_dr: number;
    defended_sp_damage: number;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    name: '',
    category: 'Martial',
    ap_cost: 1,
    requires_aim: false,
    gov_attribute: 'Brawn',
    gov_skill: 'Strike',
    base_damage: 4,
    reach_tiles: 1,
    thrown_range_tiles: null,
    trait_name: '',
    trait_description: '',
    two_handed: false,
    heavy: false,
    heavy_block_base: 2,
    parry_roll_bonus: 0,
    flawless_parry_bonus_sp_damage: 0,
    ignore_armor_dr: 0,
    defended_sp_damage: 0,
    icon: 'greatsword',
    icon_color: '#FF8C5A',
    icon_tint_custom: true,
  };

  readonly filteredKeywords = computed(() => {
    const q = this.keywordSearch().trim().toLowerCase();
    const showActive = this.keywordStatusFilter() === 'active';
    const list = this.compendiumStore
      .allKeywords()
      .filter((kw) => isCompendiumItemActive(kw) === showActive);
    if (!q) return list;
    return list.filter(
      (kw) =>
        kw.term.toLowerCase().includes(q) ||
        kw.category.toLowerCase().includes(q) ||
        kw.summary.toLowerCase().includes(q)
    );
  });

  // Active Skill Tree Studio View
  readonly activeTreeId = signal<string | null>(null);

  readonly activeTree = computed(() => {
    const id = this.activeTreeId();
    if (!id) return null;
    return this.compendiumStore.allSkillTrees().find((t) => t.id === id) ?? null;
  });

  // `[` Bracket Autocomplete State in Description Textarea
  readonly bracketMenuOpen = signal(false);
  readonly bracketQuery = signal('');
  readonly bracketStartIndex = signal<number>(-1);
  readonly bracketSelectedIndex = signal<number>(0);

  readonly matchingBracketKeywords = computed(() => {
    const q = this.bracketQuery().trim().toLowerCase();
    const all = this.compendiumStore.keywords();
    if (!q) return all;
    return all.filter((kw) => kw.term.toLowerCase().includes(q));
  });

  // Tree Modal State
  readonly treeModalOpen = signal(false);
  readonly editingTreeId = signal<string | null>(null);
  treeFormName = '';
  treeFormDescription = '';
  treeFormIcon = 'greatsword';
  treeFormColor = '#FF8C5A';
  treeFormTintCustom = true;

  // Keyword Modal State
  readonly keywordModalOpen = signal(false);
  readonly editingKeywordId = signal<string | null>(null);
  keywordFormTerm = '';
  keywordFormCategory = 'Combat Status';
  keywordFormSummary = '';

  // Destructive Confirmation Modal State
  readonly pendingDelete = signal<
    | {
        kind: 'tree';
        target: SkillTreeModel;
        title: string;
        itemName: string;
        badge: string;
        message: string;
        warningNote: string;
        confirmLabel: string;
      }
    | {
        kind: 'node';
        target: PerkNodeModel;
        title: string;
        itemName: string;
        badge: string;
        message: string;
        warningNote: string;
        confirmLabel: string;
      }
    | {
        kind: 'weapon';
        target: WeaponModel;
        title: string;
        itemName: string;
        badge: string;
        message: string;
        warningNote: string;
        confirmLabel: string;
      }
    | {
        kind: 'keyword';
        target: KeywordDefinition;
        title: string;
        itemName: string;
        badge: string;
        message: string;
        warningNote: string;
        confirmLabel: string;
      }
    | null
  >(null);

  // Node Modal State
  readonly nodeModalOpen = signal(false);
  readonly editingNodeId = signal<string | null>(null);
  readonly hookRows = signal<RuleHookRow[]>([]);

  nodeForm: {
    tree_id: string;
    name: string;
    node_type: 'combat_art' | 'passive_upgrade';
    tier: number;
    perk_cost: number;
    ap_cost: number;
    cooldown_rounds: number;
    combat_tag: CombatTag;
    description: string;
    parent_node_id: string | null;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    tree_id: '',
    name: '',
    node_type: 'combat_art',
    tier: 1,
    perk_cost: 1,
    ap_cost: 2,
    cooldown_rounds: 3,
    combat_tag: 'Crushing',
    description: '',
    parent_node_id: null,
    icon: 'greatsword',
    icon_color: '#FF8C5A',
    icon_tint_custom: true,
  };

  readonly liveCompiledBadges = computed(() => {
    const compiled = rowsToHooksObject(
      this.hookRows(),
      this.nodeForm.node_type,
      this.nodeForm.combat_tag
    );
    return formatRuleHookBadges(compiled);
  });

  ngOnInit(): void {
    this.compendiumStore.clearMessages();
  }

  openSkillTreeView(treeId: string): void {
    this.compendiumStore.clearMessages();
    this.activeTreeId.set(treeId);
  }

  closeSkillTreeView(): void {
    this.compendiumStore.clearMessages();
    this.activeTreeId.set(null);
  }

  getArchetypeIcon(tree: SkillTreeModel) {
    return getTreeArchetypeIcon(tree);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  getPerksForTree(treeId: string): PerkNodeModel[] {
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  countNodeType(treeId: string, type: 'combat_art' | 'passive_upgrade'): number {
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId && p.node_type === type).length;
  }

  getHookDef(key: EditableRuleHookKey): RuleHookDefinition | undefined {
    return RULE_HOOK_DEFINITIONS.find((d) => d.key === key);
  }

  availableParentNodes(): PerkNodeModel[] {
    const editingId = this.editingNodeId();
    return this.compendiumStore
      .perkNodes()
      .filter(
        (p) =>
          p.tree_id === this.nodeForm.tree_id &&
          p.id !== editingId &&
          p.tier < this.nodeForm.tier
      );
  }

  // ===========================================================================
  // `[` BRACKET KEYWORD AUTOCOMPLETE LOGIC
  // ===========================================================================
  onDescriptionChange(value: string, textarea: HTMLTextAreaElement): void {
    this.nodeForm.description = value;
    this.evaluateBracketAutocomplete(textarea);
  }

  onDescriptionCursorActivity(
    textarea: HTMLTextAreaElement,
    event?: KeyboardEvent
  ): void {
    if (
      event &&
      (event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === 'Escape')
    ) {
      return;
    }
    this.evaluateBracketAutocomplete(textarea);
  }

  private evaluateBracketAutocomplete(textarea: HTMLTextAreaElement): void {
    const cursor = textarea.selectionStart ?? this.nodeForm.description.length;
    const textBeforeCursor = this.nodeForm.description.slice(0, cursor);
    const lastOpenBracket = textBeforeCursor.lastIndexOf('[');
    const lastCloseBracket = textBeforeCursor.lastIndexOf(']');

    if (lastOpenBracket !== -1 && lastOpenBracket > lastCloseBracket) {
      const query = textBeforeCursor.slice(lastOpenBracket + 1);
      // Only keep autocomplete open if query doesn't contain newlines
      if (!query.includes('\n')) {
        this.bracketStartIndex.set(lastOpenBracket);
        this.bracketQuery.set(query);
        this.bracketSelectedIndex.set(0);
        this.bracketMenuOpen.set(true);
        return;
      }
    }

    this.bracketMenuOpen.set(false);
  }

  onDescriptionKeydown(
    event: KeyboardEvent,
    textarea: HTMLTextAreaElement
  ): void {
    if (!this.bracketMenuOpen()) return;
    const matches = this.matchingBracketKeywords();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (matches.length > 0) {
        this.bracketSelectedIndex.update((i) => (i + 1) % matches.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (matches.length > 0) {
        this.bracketSelectedIndex.update(
          (i) => (i - 1 + matches.length) % matches.length
        );
      }
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      if (matches.length > 0) {
        event.preventDefault();
        const chosen = matches[this.bracketSelectedIndex()] ?? matches[0];
        this.insertKeywordFromMenu(chosen, textarea);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.bracketMenuOpen.set(false);
    }
  }

  insertKeywordFromMenu(
    kw: KeywordDefinition,
    textarea: HTMLTextAreaElement
  ): void {
    const start = this.bracketStartIndex();
    const cursor = textarea.selectionStart ?? this.nodeForm.description.length;
    if (start < 0) return;

    const before = this.nodeForm.description.slice(0, start);
    const after = this.nodeForm.description.slice(cursor);
    const inserted = `[${kw.term}]`;

    this.nodeForm.description = `${before}${inserted}${after}`;
    this.bracketMenuOpen.set(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  appendKeywordChip(kw: KeywordDefinition, textarea: HTMLTextAreaElement): void {
    const cursor = textarea.selectionStart ?? this.nodeForm.description.length;
    const before = this.nodeForm.description.slice(0, cursor);
    const after = this.nodeForm.description.slice(cursor);
    const needsSpace = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    const inserted = `${needsSpace}[${kw.term}] `;

    this.nodeForm.description = `${before}${inserted}${after}`;
    this.bracketMenuOpen.set(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  // ===========================================================================
  // SPECIAL WORD / KEYWORD MODAL ACTIONS
  // ===========================================================================
  openNewKeywordModal(prefillTerm = ''): void {
    this.editingKeywordId.set(null);
    this.keywordFormTerm = prefillTerm.trim();
    this.keywordFormCategory = 'Combat Status';
    this.keywordFormSummary = '';
    this.keywordModalOpen.set(true);
  }

  openEditKeywordModal(kw: KeywordDefinition): void {
    this.editingKeywordId.set(kw.id ?? kw.term);
    this.keywordFormTerm = kw.term;
    this.keywordFormCategory = kw.category;
    this.keywordFormSummary = kw.summary;
    this.keywordModalOpen.set(true);
  }

  closeKeywordModal(): void {
    this.keywordModalOpen.set(false);
  }

  async saveKeyword(): Promise<void> {
    const editId = this.editingKeywordId();
    if (editId) {
      const ok = await this.compendiumStore.updateKeyword(editId, {
        term: this.keywordFormTerm,
        category: this.keywordFormCategory,
        summary: this.keywordFormSummary,
      });
      if (ok) this.closeKeywordModal();
    } else {
      const created = await this.compendiumStore.createKeyword({
        term: this.keywordFormTerm,
        category: this.keywordFormCategory,
        summary: this.keywordFormSummary,
      });
      if (created) {
        this.closeKeywordModal();
      }
    }
  }

  deleteKeyword(kw: KeywordDefinition): void {
    this.compendiumStore.clearMessages();
    this.pendingDelete.set({
      kind: 'keyword',
      target: kw,
      title: 'Delete Special Word',
      itemName: kw.term,
      badge: kw.category,
      message: `Are you sure you want to remove "${kw.term}" from the Special Words & Glossary compendium?`,
      warningNote: `Any [${kw.term}] tags inside Skill Tree nodes, Weapon traits, or chained keywords will remain as text but will no longer display a hover rule tooltip.`,
      confirmLabel: 'Delete Special Word',
    });
  }

  // ===========================================================================
  // COMPOSABLE RULE HOOK ROW ACTIONS
  // ===========================================================================
  addRuleHookRow(): void {
    const usedKeys = new Set(this.hookRows().map((r) => r.key));
    const nextDef =
      RULE_HOOK_DEFINITIONS.find((d) => !usedKeys.has(d.key)) ??
      RULE_HOOK_DEFINITIONS[0];

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

  // Tree Modal Actions
  openNewTreeModal(): void {
    this.compendiumStore.clearMessages();
    this.editingTreeId.set(null);
    this.treeFormName = '';
    this.treeFormDescription = '';
    this.treeFormIcon = 'greatsword';
    this.treeFormColor = '#FF8C5A';
    this.treeFormTintCustom = true;
    this.treeModalOpen.set(true);
  }

  openEditTreeModal(tree: SkillTreeModel): void {
    this.compendiumStore.clearMessages();
    this.editingTreeId.set(tree.id);
    this.treeFormName = tree.name;
    this.treeFormDescription = tree.description;
    const visuals = resolveTreeVisuals(tree);
    this.treeFormIcon = visuals.icon;
    this.treeFormColor = visuals.color;
    this.treeFormTintCustom = visuals.tintCustom;
    this.treeModalOpen.set(true);
  }

  closeTreeModal(): void {
    this.treeModalOpen.set(false);
  }

  async saveTree(): Promise<void> {
    const editId = this.editingTreeId();
    if (editId) {
      const ok = await this.compendiumStore.updateSkillTree(editId, {
        name: this.treeFormName,
        description: this.treeFormDescription,
        icon: this.treeFormIcon,
        icon_color: this.treeFormColor,
        icon_tint_custom: this.treeFormTintCustom,
      });
      if (ok) this.closeTreeModal();
    } else {
      const created = await this.compendiumStore.createSkillTree({
        name: this.treeFormName,
        description: this.treeFormDescription,
        icon: this.treeFormIcon,
        icon_color: this.treeFormColor,
        icon_tint_custom: this.treeFormTintCustom,
      });
      if (created) this.closeTreeModal();
    }
  }

  confirmDeleteTree(tree: SkillTreeModel): void {
    this.compendiumStore.clearMessages();
    const combatArtsCount = this.countNodeType(tree.id, 'combat_art');
    const passivesCount = this.countNodeType(tree.id, 'passive_upgrade');
    const totalNodes = combatArtsCount + passivesCount;

    this.pendingDelete.set({
      kind: 'tree',
      target: tree,
      title: 'Delete Skill Tree',
      itemName: tree.name,
      badge: `${totalNodes} ${totalNodes === 1 ? 'Node' : 'Nodes'}`,
      message: `Are you sure you want to permanently delete the "${tree.name}" skill tree from the compendium?`,
      warningNote:
        totalNodes > 0
          ? `Warning: Deleting this tree will also permanently remove its ${combatArtsCount} Combat Art(s) and ${passivesCount} Passive Upgrade(s).`
          : '',
      confirmLabel: 'Delete Skill Tree',
    });
  }

  // Node Modal Actions
  openNewNodeModal(defaultTreeId?: string): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    this.bracketMenuOpen.set(false);
    const firstTreeId =
      defaultTreeId ??
      this.activeTreeId() ??
      this.compendiumStore.skillTrees()[0]?.id ??
      '';

    this.nodeForm = {
      tree_id: firstTreeId,
      name: '',
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: 'Crushing',
      description: '',
      parent_node_id: null,
      icon: 'greatsword',
      icon_color: '#FF8C5A',
      icon_tint_custom: true,
    };
    this.hookRows.set([]);
    this.nodeModalOpen.set(true);
  }

  openBranchChildModal(parentNode: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    this.bracketMenuOpen.set(false);

    const parentVis = resolveNodeVisuals(parentNode);
    this.nodeForm = {
      tree_id: parentNode.tree_id,
      name: '',
      node_type: parentNode.node_type,
      tier: Math.min(5, parentNode.tier + 1),
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: parentNode.combat_tag ?? 'Crushing',
      description: '',
      parent_node_id: parentNode.id,
      icon: parentVis.icon,
      icon_color: parentVis.color,
      icon_tint_custom: parentVis.tintCustom,
    };
    this.hookRows.set([]);
    this.nodeModalOpen.set(true);
  }

  openEditNodeModal(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(node.id);
    this.bracketMenuOpen.set(false);

    const visuals = resolveNodeVisuals(node);
    this.nodeForm = {
      tree_id: node.tree_id,
      name: node.name,
      node_type: node.node_type,
      tier: node.tier,
      perk_cost: node.perk_cost ?? 1,
      ap_cost: node.ap_cost ?? 1,
      cooldown_rounds: node.cooldown_rounds ?? 2,
      combat_tag: node.combat_tag ?? 'None',
      description: node.description,
      parent_node_id: node.parent_node_id ?? null,
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };

    this.hookRows.set(hooksObjectToRows(node.rule_hooks));
    this.nodeModalOpen.set(true);
  }

  closeNodeModal(): void {
    this.bracketMenuOpen.set(false);
    this.nodeModalOpen.set(false);
  }

  async saveNode(): Promise<void> {
    const compiledHooks = rowsToHooksObject(
      this.hookRows(),
      this.nodeForm.node_type,
      this.nodeForm.combat_tag
    );

    const payload = {
      tree_id: this.nodeForm.tree_id,
      name: this.nodeForm.name,
      node_type: this.nodeForm.node_type,
      tier: Number(this.nodeForm.tier) || 1,
      perk_cost: Number(this.nodeForm.perk_cost) || 1,
      ap_cost:
        this.nodeForm.node_type === 'combat_art' ? Number(this.nodeForm.ap_cost) : null,
      cooldown_rounds:
        this.nodeForm.node_type === 'combat_art'
          ? Number(this.nodeForm.cooldown_rounds)
          : null,
      combat_tag:
        this.nodeForm.node_type === 'combat_art' ? this.nodeForm.combat_tag : 'None',
      description: this.nodeForm.description,
      rule_hooks: compiledHooks,
      parent_node_id: this.nodeForm.parent_node_id || null,
      icon: this.nodeForm.icon,
      icon_color: this.nodeForm.icon_color,
      icon_tint_custom: this.nodeForm.icon_tint_custom,
    };

    const editId = this.editingNodeId();
    if (editId) {
      const ok = await this.compendiumStore.updatePerkNode(editId, payload);
      if (ok) this.closeNodeModal();
    } else {
      const created = await this.compendiumStore.createPerkNode(payload);
      if (created) this.closeNodeModal();
    }
  }

  confirmDeleteNode(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    const dependentChildren = this.compendiumStore
      .perkNodes()
      .filter((n) => n.parent_node_id === node.id);

    this.pendingDelete.set({
      kind: 'node',
      target: node,
      title: 'Delete Skill Tree Node',
      itemName: node.name,
      badge: `Tier ${node.tier} · ${node.node_type === 'combat_art' ? 'Combat Art' : 'Passive'}`,
      message: `Are you sure you want to delete "${node.name}" from this skill tree?`,
      warningNote:
        dependentChildren.length > 0
          ? `This node is a prerequisite for ${dependentChildren.length} child node(s) (${dependentChildren.map((c) => c.name).join(', ')}). Deleting it will unlink their parent connection.`
          : 'Characters who unlocked this node will no longer receive its Combat Art or passive stat hooks.',
      confirmLabel: 'Delete Node',
    });
  }

  // Weapon Forge, Inspector & Property Tag Actions (Two-Handed & Heavy)
  getWeaponVisuals(w: WeaponModel): ResolvedCompendiumVisuals {
    return resolveWeaponVisuals(w);
  }

  getWeaponBadges(w: WeaponModel): string[] {
    return formatWeaponHookBadges(w);
  }

  isTwoHanded(w: WeaponModel): boolean {
    return isWeaponTwoHanded(w);
  }

  isHeavy(w: WeaponModel): boolean {
    return isWeaponHeavy(w);
  }

  getHeavyBlockBase(w: WeaponModel): number {
    return getHeavyWeaponBlockBase(w);
  }

  async toggleWeaponTwoHanded(w: WeaponModel): Promise<void> {
    const nextTwoHanded = !isWeaponTwoHanded(w);
    const currentHeavy = isWeaponHeavy(w);
    await this.compendiumStore.updateWeaponTags(w.id, {
      two_handed: nextTwoHanded,
      heavy: currentHeavy,
      heavy_block_base: getHeavyWeaponBlockBase(w) || 2,
    });
  }

  async toggleWeaponHeavy(w: WeaponModel): Promise<void> {
    const currentTwoHanded = isWeaponTwoHanded(w);
    const nextHeavy = !isWeaponHeavy(w);
    await this.compendiumStore.updateWeaponTags(w.id, {
      two_handed: currentTwoHanded,
      heavy: nextHeavy,
      heavy_block_base: 2,
    });
  }

  openNewWeaponModal(): void {
    this.compendiumStore.clearMessages();
    this.editingWeaponId.set(null);
    this.weaponForm = {
      name: '',
      category: 'Martial',
      ap_cost: 1,
      requires_aim: false,
      gov_attribute: 'Brawn',
      gov_skill: 'Strike',
      base_damage: 4,
      reach_tiles: 1,
      thrown_range_tiles: null,
      trait_name: '',
      trait_description: '',
      two_handed: false,
      heavy: false,
      heavy_block_base: 2,
      parry_roll_bonus: 0,
      flawless_parry_bonus_sp_damage: 0,
      ignore_armor_dr: 0,
      defended_sp_damage: 0,
      icon: 'greatsword',
      icon_color: '#FF8C5A',
      icon_tint_custom: true,
    };
    this.weaponModalOpen.set(true);
  }

  openEditWeaponModal(w: WeaponModel): void {
    this.compendiumStore.clearMessages();
    this.editingWeaponId.set(w.id);
    const visuals = resolveWeaponVisuals(w);
    const hooks = w.rule_hooks ?? {};

    this.weaponForm = {
      name: w.name,
      category: w.category || 'Martial',
      ap_cost: w.ap_cost || 1,
      requires_aim: Boolean(w.requires_aim),
      gov_attribute: w.gov_attribute || 'Brawn',
      gov_skill: w.gov_skill || 'Strike',
      base_damage: w.base_damage ?? 4,
      reach_tiles: w.reach_tiles ?? 1,
      thrown_range_tiles: w.thrown_range_tiles ?? null,
      trait_name: w.trait_name || '',
      trait_description: w.trait_description || '',
      two_handed: isWeaponTwoHanded(w),
      heavy: isWeaponHeavy(w),
      heavy_block_base: getHeavyWeaponBlockBase(w) || 2,
      parry_roll_bonus: Number(hooks['parry_roll_bonus'] ?? 0),
      flawless_parry_bonus_sp_damage: Number(
        hooks['flawless_parry_bonus_sp_damage'] ?? 0
      ),
      ignore_armor_dr: Number(hooks['ignore_armor_dr'] ?? 0),
      defended_sp_damage: Number(hooks['defended_sp_damage'] ?? 0),
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };
    this.weaponModalOpen.set(true);
  }

  closeWeaponModal(): void {
    this.weaponModalOpen.set(false);
  }

  async saveWeapon(): Promise<void> {
    const editId = this.editingWeaponId();
    const existing = editId
      ? this.compendiumStore.weapons().find((w) => w.id === editId)
      : null;

    const compiledHooks: Record<string, unknown> = {
      ...(existing?.rule_hooks ?? {}),
      two_handed: this.weaponForm.two_handed,
      heavy: this.weaponForm.heavy,
      heavy_block_base: this.weaponForm.heavy
        ? Math.max(1, Number(this.weaponForm.heavy_block_base) || 2)
        : undefined,
      parry_roll_bonus:
        Number(this.weaponForm.parry_roll_bonus) > 0
          ? Number(this.weaponForm.parry_roll_bonus)
          : undefined,
      flawless_parry_bonus_sp_damage:
        Number(this.weaponForm.flawless_parry_bonus_sp_damage) > 0
          ? Number(this.weaponForm.flawless_parry_bonus_sp_damage)
          : undefined,
      ignore_armor_dr:
        Number(this.weaponForm.ignore_armor_dr) > 0
          ? Number(this.weaponForm.ignore_armor_dr)
          : undefined,
      defended_sp_damage:
        Number(this.weaponForm.defended_sp_damage) > 0
          ? Number(this.weaponForm.defended_sp_damage)
          : undefined,
      __icon: this.weaponForm.icon,
      __icon_color: this.weaponForm.icon_color,
      __icon_tint_custom: this.weaponForm.icon_tint_custom,
    };

    const payload: Omit<WeaponModel, 'id' | 'slug'> = {
      name: this.weaponForm.name,
      category: this.weaponForm.category,
      ap_cost: Number(this.weaponForm.ap_cost) || 1,
      requires_aim: Boolean(this.weaponForm.requires_aim),
      gov_attribute: this.weaponForm.gov_attribute,
      gov_skill: this.weaponForm.gov_skill,
      base_damage: Number(this.weaponForm.base_damage) || 3,
      reach_tiles: Number(this.weaponForm.reach_tiles) || 1,
      thrown_range_tiles:
        this.weaponForm.thrown_range_tiles &&
        Number(this.weaponForm.thrown_range_tiles) > 0
          ? Number(this.weaponForm.thrown_range_tiles)
          : null,
      trait_name: this.weaponForm.trait_name,
      trait_description: this.weaponForm.trait_description,
      rule_hooks: compiledHooks,
    };

    if (editId) {
      const ok = await this.compendiumStore.updateWeapon(editId, payload);
      if (ok) {
        this.selectedWeaponId.set(editId);
        this.closeWeaponModal();
      }
    } else {
      const created = await this.compendiumStore.createWeapon(payload);
      if (created) {
        this.studioTab.set('weapons');
        this.selectedWeaponId.set(created.id);
        this.closeWeaponModal();
      }
    }
  }

  confirmDeleteWeapon(w: WeaponModel): void {
    this.compendiumStore.clearMessages();
    this.pendingDelete.set({
      kind: 'weapon',
      target: w,
      title: 'Delete Weapon from Armory',
      itemName: w.name,
      badge: `${w.category} · ${w.ap_cost} AP`,
      message: `Are you sure you want to permanently remove "${w.name}" from the Weapons & Armory compendium?`,
      warningNote:
        'Any character currently equipping this weapon in Slot 1 or Slot 2 will fall back to Unarmed until they select a replacement.',
      confirmLabel: 'Delete Weapon',
    });
  }

  isItemActive(
    item:
      | {
          is_active?: boolean | null;
          rule_hooks?: unknown;
        }
      | null
      | undefined
  ): boolean {
    return isCompendiumItemActive(item);
  }

  isPendingTargetActive(): boolean {
    const pending = this.pendingDelete();
    if (!pending) return false;
    return isCompendiumItemActive(pending.target);
  }

  async toggleTreeActive(tree: SkillTreeModel): Promise<void> {
    const nextActive = !isCompendiumItemActive(tree);
    await this.compendiumStore.setSkillTreeActive(tree.id, nextActive);
  }

  async toggleNodeActive(node: PerkNodeModel): Promise<void> {
    const nextActive = !isCompendiumItemActive(node);
    await this.compendiumStore.setPerkNodeActive(node.id, nextActive);
  }

  async toggleWeaponActive(w: WeaponModel): Promise<void> {
    const nextActive = !isCompendiumItemActive(w);
    await this.compendiumStore.setWeaponActive(w.id, nextActive);
  }

  async toggleKeywordActive(kw: KeywordDefinition): Promise<void> {
    const nextActive = !isCompendiumItemActive(kw);
    await this.compendiumStore.setKeywordActive(kw, nextActive);
  }

  cancelConfirmDelete(): void {
    if (!this.compendiumStore.isLoading()) {
      this.pendingDelete.set(null);
    }
  }

  async executeArchiveInstead(): Promise<void> {
    const pending = this.pendingDelete();
    if (!pending) return;

    if (pending.kind === 'tree') {
      await this.compendiumStore.setSkillTreeActive(pending.target.id, false);
    } else if (pending.kind === 'node') {
      await this.compendiumStore.setPerkNodeActive(pending.target.id, false);
    } else if (pending.kind === 'weapon') {
      await this.compendiumStore.setWeaponActive(pending.target.id, false);
    } else if (pending.kind === 'keyword') {
      await this.compendiumStore.setKeywordActive(pending.target, false);
    }

    this.pendingDelete.set(null);
  }

  async executeConfirmDelete(): Promise<void> {
    const pending = this.pendingDelete();
    if (!pending) return;

    if (pending.kind === 'tree') {
      const ok = await this.compendiumStore.deleteSkillTree(pending.target.id);
      if (ok && this.activeTreeId() === pending.target.id) {
        this.activeTreeId.set(null);
      }
    } else if (pending.kind === 'node') {
      await this.compendiumStore.deletePerkNode(pending.target.id);
    } else if (pending.kind === 'weapon') {
      const ok = await this.compendiumStore.deleteWeapon(pending.target.id);
      if (ok && this.selectedWeaponId() === pending.target.id) {
        this.selectedWeaponId.set(null);
      }
    } else if (pending.kind === 'keyword') {
      await this.compendiumStore.deleteKeyword(pending.target);
    }

    this.pendingDelete.set(null);
  }
}
