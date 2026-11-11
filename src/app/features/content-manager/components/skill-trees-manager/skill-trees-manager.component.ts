import {
  Component,
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
    return this.compendiumStore.skillTrees().find((t) => t.id === id) ?? null;
  });

  readonly treeModalOpen = signal(false);
  readonly editingTreeId = signal<string | null>(null);
  treeFormName = '';
  treeFormDescription = '';
  treeFormIcon = 'greatsword';
  treeFormColor = '#FF8C5A';
  treeFormTintCustom = true;

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
}
