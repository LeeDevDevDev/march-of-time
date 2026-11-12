import {
  Component,
  ViewChild,
  computed,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  SkillTreeModel,
  compareSiblingPerkNodes,
  getCombatTagBadgeClass,
  isStandalonePerkNode,
  normalizePerkNodesTiers,
  resolveNodeVisuals,
  resolveTreeVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../../../shared/compendium-icon/icon-picker.component';
import { SkillTreeCanvasComponent } from '../../../../shared/skill-tree-canvas/skill-tree-canvas.component';

@Component({
  selector: 'app-skill-trees-manager',
  standalone: true,
  imports: [
    FormsModule,
    CompendiumIconComponent,
    IconPickerComponent,
    SkillTreeCanvasComponent,
  ],
  templateUrl: './skill-trees-manager.component.html',
})
export class SkillTreesManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;

  @ViewChild(SkillTreeCanvasComponent)
  treeCanvas?: SkillTreeCanvasComponent;

  readonly activeTreeId = model<string | null>(null);

  readonly createRootNode = output<string>();
  readonly branchChildNode = output<PerkNodeModel>();
  readonly editNode = output<PerkNodeModel>();
  readonly deleteNode = output<PerkNodeModel>();
  readonly deleteTree = output<SkillTreeModel>();
  readonly createKeyword = output<void>();

  readonly treeSearch = signal('');

  readonly filteredTrees = computed(() => {
    const q = this.treeSearch().trim().toLowerCase();
    const list = this.compendiumStore.skillTrees();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  });

  readonly activeTree = computed(() => {
    const id = this.activeTreeId();
    if (!id) return null;
    return (
      this.compendiumStore
        .skillTrees()
        .find((t) => t.id === id || t.slug === id) ?? null
    );
  });

  readonly activeTreeNodes = computed(() => {
    const tree = this.activeTree();
    if (!tree) return [];
    return normalizePerkNodesTiers(
      this.compendiumStore.perkNodes().filter((p) => p.tree_id === tree.id)
    ).sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b));
  });

  readonly treeModalOpen = signal(false);
  readonly editingTreeId = signal<string | null>(null);
  treeFormName = '';
  treeFormDescription = '';
  treeFormIcon = 'greatsword';
  treeFormColor = '#FF8C5A';
  treeFormTintCustom = true;

  readonly attachModalOpen = signal(false);
  readonly attachParentId = signal<string>('');
  readonly attachSourceTab = signal<'standalone' | 'other_trees'>('standalone');
  readonly attachSearch = signal('');

  readonly standaloneAttachCandidates = computed(() => {
    const q = this.attachSearch().trim().toLowerCase();
    return this.compendiumStore
      .standaloneNodes()
      .filter(
        (n) =>
          !q ||
          n.name.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly otherTreeAttachCandidates = computed(() => {
    const currentTreeId = this.activeTree()?.id ?? this.activeTreeId();
    const q = this.attachSearch().trim().toLowerCase();
    return this.compendiumStore
      .perkNodes()
      .filter(
        (n) =>
          !isStandalonePerkNode(n) &&
          n.tree_id !== currentTreeId &&
          (!q ||
            n.name.toLowerCase().includes(q) ||
            n.description.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly visibleAttachCandidates = computed(() =>
    this.attachSourceTab() === 'standalone'
      ? this.standaloneAttachCandidates()
      : this.otherTreeAttachCandidates()
  );

  selectCanvasNode(nodeId: string): void {
    this.treeCanvas?.selectNodeById(nodeId);
  }

  openSkillTreeView(treeId: string): void {
    this.compendiumStore.clearMessages();
    this.activeTreeId.set(treeId);
  }

  closeSkillTreeView(): void {
    this.compendiumStore.clearMessages();
    this.activeTreeId.set(null);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  treeNameById(treeId: string | null | undefined): string {
    if (!treeId) return 'Standalone';
    return (
      this.compendiumStore.skillTrees().find((t) => t.id === treeId)?.name ??
      'Other Tree'
    );
  }

  getPerksForTree(treeId: string): PerkNodeModel[] {
    return normalizePerkNodesTiers(
      this.compendiumStore.perkNodes().filter((p) => p.tree_id === treeId)
    ).sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b));
  }

  getMaxTierForTree(treeId: string): number {
    const perks = this.getPerksForTree(treeId);
    if (perks.length === 0) return 0;
    return perks.reduce((max, p) => Math.max(max, p.tier), 1);
  }

  countNodeType(
    treeId: string,
    type: 'combat_art' | 'passive_upgrade'
  ): number {
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId && p.node_type === type).length;
  }

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

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeTreeModal();
    }
  }

  openAttachModal(defaultParent: PerkNodeModel | null = null): void {
    this.compendiumStore.clearMessages();
    this.attachParentId.set(defaultParent?.id ?? '');
    this.attachSearch.set('');
    if (
      this.standaloneAttachCandidates().length === 0 &&
      this.otherTreeAttachCandidates().length > 0
    ) {
      this.attachSourceTab.set('other_trees');
    } else {
      this.attachSourceTab.set('standalone');
    }
    this.attachModalOpen.set(true);
  }

  closeAttachModal(): void {
    this.attachModalOpen.set(false);
  }

  onAttachBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeAttachModal();
    }
  }

  async attachNodeToActiveTree(candidate: PerkNodeModel): Promise<void> {
    const treeId = this.activeTree()?.id ?? this.activeTreeId();
    if (!treeId) return;
    const ok = await this.compendiumStore.moveOrReparentPerkNode(
      candidate.id,
      treeId,
      this.attachParentId() || null
    );
    if (ok) {
      this.closeAttachModal();
      this.selectCanvasNode(candidate.id);
    }
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
      if (created) {
        this.closeTreeModal();
        this.activeTreeId.set(created.id);
      }
    }
  }
}
