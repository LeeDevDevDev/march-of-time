import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CombatTag,
  EditableRuleHookKey,
  PerkNodeModel,
  RULE_HOOK_DEFINITIONS,
  RuleHookDefinition,
  RuleHookRow,
  compareSiblingPerkNodes,
  computePerkNodeTier,
  formatRuleHookBadges,
  getDescendantNodeIds,
  hooksObjectToRows,
  isStandalonePerkNode,
  resolveNodeVisuals,
  rowsToHooksObject,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { IconPickerComponent } from '../../../../shared/compendium-icon/icon-picker.component';
import { KeywordTextareaComponent } from '../../../../shared/keyword-text/keyword-textarea.component';

@Component({
  selector: 'app-perk-node-modal',
  standalone: true,
  imports: [FormsModule, KeywordTextareaComponent, IconPickerComponent],
  templateUrl: './perk-node-modal.component.html',
})
export class PerkNodeModalComponent {
  readonly compendiumStore = inject(CompendiumStore);

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

  readonly isOpen = signal(false);
  readonly editingNodeId = signal<string | null>(null);
  readonly hookRows = signal<RuleHookRow[]>([]);

  nodeForm: {
    tree_id: string | null;
    name: string;
    node_type: 'combat_art' | 'passive_upgrade';
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

  openNewNodeModal(defaultTreeId: string | null): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    this.nodeForm = {
      tree_id: defaultTreeId,
      name: '',
      node_type: 'combat_art',
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
    this.isOpen.set(true);
  }

  openNewStandaloneNodeModal(): void {
    this.openNewNodeModal(null);
  }

  openBranchChildModal(parentNode: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    const parentVis = resolveNodeVisuals(parentNode);
    this.nodeForm = {
      tree_id: parentNode.tree_id,
      name: '',
      node_type: parentNode.node_type,
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
    this.isOpen.set(true);
  }

  openEditNodeModal(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(node.id);
    const visuals = resolveNodeVisuals(node);
    this.nodeForm = {
      tree_id: isStandalonePerkNode(node) ? null : node.tree_id,
      name: node.name,
      node_type: node.node_type,
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

  onTreeSelectionChange(newTreeId: string | null): void {
    this.nodeForm.tree_id = newTreeId;
    if (!newTreeId) {
      this.nodeForm.parent_node_id = null;
      return;
    }
    if (this.nodeForm.parent_node_id) {
      const stillInTree = this.compendiumStore
        .perkNodes()
        .some(
          (p) =>
            p.id === this.nodeForm.parent_node_id && p.tree_id === newTreeId
        );
      if (!stillInTree) {
        this.nodeForm.parent_node_id = null;
      }
    }
  }

  availableParentNodes(): PerkNodeModel[] {
    const treeId = this.nodeForm.tree_id;
    if (!treeId) return [];
    const editingId = this.editingNodeId();
    const allNodes = this.compendiumStore.perkNodes();
    const descendants = editingId
      ? getDescendantNodeIds(editingId, allNodes)
      : new Set<string>();

    return allNodes
      .filter(
        (p) =>
          p.tree_id === treeId &&
          p.id !== editingId &&
          !descendants.has(p.id)
      )
      .sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b));
  }

  getComputedFormTier(): number {
    if (!this.nodeForm.tree_id) return 1;
    return computePerkNodeTier(
      this.nodeForm.tree_id,
      this.nodeForm.parent_node_id,
      this.compendiumStore.perkNodes()
    );
  }

  getSelectedParentName(): string | null {
    if (!this.nodeForm.tree_id || !this.nodeForm.parent_node_id) return null;
    return (
      this.compendiumStore
        .perkNodes()
        .find((p) => p.id === this.nodeForm.parent_node_id)?.name ?? null
    );
  }

  getHookDef(key: EditableRuleHookKey): RuleHookDefinition | undefined {
    return RULE_HOOK_DEFINITIONS.find((d) => d.key === key);
  }

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

  async saveNode(): Promise<void> {
    const compiledHooks = rowsToHooksObject(
      this.hookRows(),
      this.nodeForm.node_type,
      this.nodeForm.combat_tag
    );

    const isStandalone = !this.nodeForm.tree_id;
    const payload = {
      tree_id: this.nodeForm.tree_id || null,
      name: this.nodeForm.name,
      node_type: this.nodeForm.node_type,
      tier: isStandalone ? 1 : this.getComputedFormTier(),
      perk_cost: Number(this.nodeForm.perk_cost) || 1,
      ap_cost:
        this.nodeForm.node_type === 'combat_art'
          ? Number(this.nodeForm.ap_cost)
          : null,
      cooldown_rounds:
        this.nodeForm.node_type === 'combat_art'
          ? Number(this.nodeForm.cooldown_rounds)
          : null,
      combat_tag:
        this.nodeForm.node_type === 'combat_art'
          ? this.nodeForm.combat_tag
          : 'None',
      description: this.nodeForm.description,
      rule_hooks: compiledHooks,
      parent_node_id: isStandalone ? null : this.nodeForm.parent_node_id || null,
      icon: this.nodeForm.icon,
      icon_color: this.nodeForm.icon_color,
      icon_tint_custom: this.nodeForm.icon_tint_custom,
    };

    const editId = this.editingNodeId();
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
