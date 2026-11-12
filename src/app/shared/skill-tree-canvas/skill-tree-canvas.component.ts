import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  KeywordDefinition,
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  SkillTreeBranchNode,
  SkillTreeModel,
  buildSkillTreeHierarchy,
  compareSiblingPerkNodes,
  formatRuleHookBadges,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  getDescendantNodeIds,
  normalizePerkNodesTiers,
  resolveNodeVisuals,
  resolveTreeVisuals,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../compendium-icon/compendium-icon.component';
import { KeywordTooltipService } from '../keyword-text/keyword-tooltip.service';

@Component({
  selector: 'app-skill-tree-canvas',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, CompendiumIconComponent],
  templateUrl: './skill-tree-canvas.component.html',
})
export class SkillTreeCanvasComponent implements OnChanges {
  readonly Math = Math;
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;
  readonly compendiumStore = inject(CompendiumStore);
  readonly keywordTooltip = inject(KeywordTooltipService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true }) tree!: SkillTreeModel;
  @Input({ required: true }) allNodes: PerkNodeModel[] = [];
  @Input() mode: 'admin' | 'character' = 'admin';
  @Input() unlockedIds: string[] = [];
  @Input() perkSpent = 0;
  @Input() perkBudget = 1;

  @Output() addRootNode = new EventEmitter<void>();
  @Output() branchChildNode = new EventEmitter<PerkNodeModel>();
  @Output() attachExistingNode = new EventEmitter<PerkNodeModel | null>();
  @Output() editNode = new EventEmitter<PerkNodeModel>();
  @Output() deleteNode = new EventEmitter<PerkNodeModel>();
  @Output() toggleUnlock = new EventEmitter<PerkNodeModel>();

  private readonly nodesSignal = signal<PerkNodeModel[]>([]);
  private readonly treeIdSignal = signal<string>('');

  readonly selectedNodeId = signal<string | null>(null);
  readonly targetMoveTreeId = signal<string>('');

  readonly draggedNodeId = signal<string | null>(null);
  readonly dragOverTargetId = signal<string | null>(null);

  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly zoom = signal(1);
  readonly isDragging = signal(false);

  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;
  private movedDistance = 0;

  readonly treeNodes = computed(() =>
    normalizePerkNodesTiers(
      this.nodesSignal().filter((n) => n.tree_id === this.treeIdSignal())
    ).sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b))
  );

  readonly branches = computed<SkillTreeBranchNode[]>(() =>
    buildSkillTreeHierarchy(this.treeIdSignal(), this.nodesSignal())
  );

  readonly otherSkillTrees = computed(() =>
    this.compendiumStore
      .skillTrees()
      .filter((t) => t.id !== this.treeIdSignal())
  );

  readonly hasAttachableAbilities = computed(() =>
    this.compendiumStore
      .perkNodes()
      .some((p) => p.tree_id !== this.treeIdSignal())
  );

  readonly selectedNode = computed<PerkNodeModel | null>(() => {
    const list = this.treeNodes();
    const id = this.selectedNodeId();
    if (id) {
      const found = list.find((n) => n.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  readonly draggedNode = computed<PerkNodeModel | null>(() => {
    const id = this.draggedNodeId();
    if (!id) return null;
    return this.treeNodes().find((n) => n.id === id) ?? null;
  });

  readonly descriptionSegments = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return tokenizeTextWithKeywords(
      node.description,
      this.compendiumStore.keywords()
    );
  });

  readonly hasDescriptionKeywords = computed(() =>
    this.descriptionSegments().some((seg) => seg.keyword !== null)
  );

  readonly nodeHookBadges = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return formatRuleHookBadges(node.rule_hooks);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tree'] && this.tree) {
      const prevTreeId = this.treeIdSignal();
      this.treeIdSignal.set(this.tree.id);
      if (prevTreeId !== this.tree.id) {
        this.resetCamera();
        this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
        this.targetMoveTreeId.set('');
      }
    }
    if (changes['allNodes']) {
      this.nodesSignal.set(this.allNodes ?? []);
    }
  }

  selectNodeById(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isDragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.initialPanX = this.panX();
    this.initialPanY = this.panY();
    this.movedDistance = 0;
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.movedDistance = Math.hypot(dx, dy);
    this.panX.set(this.initialPanX + dx);
    this.panY.set(this.initialPanY + dy);
  }

  onCanvasPointerUp(): void {
    if (this.isDragging()) {
      this.isDragging.set(false);
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    this.adjustZoom(delta);
  }

  adjustZoom(delta: number): void {
    this.zoom.update((z) =>
      Math.max(0.5, Math.min(1.6, Number((z + delta).toFixed(2))))
    );
  }

  resetCamera(): void {
    this.panX.set(0);
    this.panY.set(0);
    this.zoom.set(1);
  }

  onNodeClick(event: MouseEvent, node: PerkNodeModel): void {
    event.stopPropagation();
    if (this.movedDistance > 6) return;
    this.selectedNodeId.set(node.id);
    this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
  }

  onAddChildFromNode(event: MouseEvent, parentNode: PerkNodeModel): void {
    event.stopPropagation();
    this.selectedNodeId.set(parentNode.id);
    this.branchChildNode.emit(parentNode);
  }

  siblingContext(node: PerkNodeModel): {
    index: number;
    count: number;
    canMoveLeft: boolean;
    canMoveRight: boolean;
  } {
    const list = this.treeNodes();
    const ids = new Set(list.map((n) => n.id));
    const effectiveParent =
      node.parent_node_id && ids.has(node.parent_node_id)
        ? node.parent_node_id
        : null;

    const siblings = list
      .filter((n) => {
        const nParent =
          n.parent_node_id && ids.has(n.parent_node_id)
            ? n.parent_node_id
            : null;
        return nParent === effectiveParent;
      })
      .sort(compareSiblingPerkNodes);

    const index = siblings.findIndex((s) => s.id === node.id);
    return {
      index,
      count: siblings.length,
      canMoveLeft: index > 0,
      canMoveRight: index >= 0 && index < siblings.length - 1,
    };
  }

  moveSibling(
    event: Event,
    node: PerkNodeModel,
    direction: 'left' | 'right'
  ): void {
    event.stopPropagation();
    void this.compendiumStore.reorderSiblingPerkNode(node.id, direction);
  }

  availableInspectorParents(node: PerkNodeModel): PerkNodeModel[] {
    const list = this.treeNodes();
    const descendants = getDescendantNodeIds(node.id, list);
    return list.filter((p) => p.id !== node.id && !descendants.has(p.id));
  }

  effectiveParentId(node: PerkNodeModel): string {
    const list = this.treeNodes();
    if (
      node.parent_node_id &&
      list.some((p) => p.id === node.parent_node_id)
    ) {
      return node.parent_node_id;
    }
    return '';
  }

  onChangeParentInInspector(node: PerkNodeModel, newParentId: string): void {
    void this.compendiumStore.moveOrReparentPerkNode(
      node.id,
      this.tree.id,
      newParentId || null
    );
  }

  onRemoveFromTree(node: PerkNodeModel): void {
    void this.compendiumStore.moveOrReparentPerkNode(node.id, null, null);
  }

  async onMoveToAnotherTree(node: PerkNodeModel): Promise<void> {
    const targetId = this.targetMoveTreeId();
    if (!targetId) return;
    const ok = await this.compendiumStore.moveOrReparentPerkNode(
      node.id,
      targetId,
      null
    );
    if (ok) {
      this.targetMoveTreeId.set('');
    }
  }

  canDropDraggedOn(candidateParentId: string | null): boolean {
    const dragged = this.draggedNode();
    if (!dragged) return false;
    const currentParent = this.effectiveParentId(dragged) || null;
    if (candidateParentId === null) {
      return currentParent !== null;
    }
    if (candidateParentId === dragged.id || candidateParentId === currentParent) {
      return false;
    }
    const descendants = getDescendantNodeIds(dragged.id, this.treeNodes());
    return !descendants.has(candidateParentId);
  }

  onNodeDragStart(event: DragEvent, node: PerkNodeModel): void {
    if (this.mode !== 'admin') return;
    this.draggedNodeId.set(node.id);
    this.dragOverTargetId.set(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', node.id);
    }
  }

  onNodeDragOver(event: DragEvent, targetNode: PerkNodeModel): void {
    if (this.mode !== 'admin' || !this.canDropDraggedOn(targetNode.id)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverTargetId.set(targetNode.id);
  }

  onNodeDragLeave(event: DragEvent, targetNode: PerkNodeModel): void {
    event.stopPropagation();
    if (this.dragOverTargetId() === targetNode.id) {
      this.dragOverTargetId.set(null);
    }
  }

  onNodeDropOnTarget(event: DragEvent, targetNode: PerkNodeModel): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = this.draggedNodeId();
    const allowed = this.canDropDraggedOn(targetNode.id);
    this.draggedNodeId.set(null);
    this.dragOverTargetId.set(null);
    if (!draggedId || !allowed) return;
    this.selectedNodeId.set(draggedId);
    void this.compendiumStore.moveOrReparentPerkNode(
      draggedId,
      this.tree.id,
      targetNode.id
    );
  }

  onRootZoneDragOver(event: DragEvent): void {
    if (this.mode !== 'admin' || !this.canDropDraggedOn(null)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverTargetId.set('__ROOT__');
  }

  onRootZoneDragLeave(): void {
    if (this.dragOverTargetId() === '__ROOT__') {
      this.dragOverTargetId.set(null);
    }
  }

  onRootZoneDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = this.draggedNodeId();
    const allowed = this.canDropDraggedOn(null);
    this.draggedNodeId.set(null);
    this.dragOverTargetId.set(null);
    if (!draggedId || !allowed) return;
    this.selectedNodeId.set(draggedId);
    void this.compendiumStore.moveOrReparentPerkNode(
      draggedId,
      this.tree.id,
      null
    );
  }

  onNodeDragEnd(): void {
    this.draggedNodeId.set(null);
    this.dragOverTargetId.set(null);
  }

  showKeywordTooltip(kw: KeywordDefinition, target: EventTarget | null): void {
    this.keywordTooltip.show(kw, target);
  }

  showKeywordTooltipByTerm(term: string, target: EventTarget | null): void {
    this.keywordTooltip.showByTerm(term, target);
  }

  hideKeywordTooltip(target?: EventTarget | null): void {
    this.keywordTooltip.hide(target);
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  getMedallionClasses(node: PerkNodeModel): string {
    const isSelected = this.selectedNode()?.id === node.id;
    const unlocked = this.isUnlocked(node.id);
    const isDropHovered = this.dragOverTargetId() === node.id;
    const isInvalidDrop =
      !!this.draggedNodeId() &&
      this.draggedNodeId() !== node.id &&
      !this.canDropDraggedOn(node.id);

    const dropRing = isDropHovered
      ? ' ring-4 ring-[#38B29A]/70 scale-110'
      : isInvalidDrop
        ? ' opacity-40'
        : '';

    if (node.node_type === 'combat_art') {
      const base = 'h-16 w-16 rounded-2xl border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#FF8C5A] bg-[#C4491A] text-white ring-4 ring-[#C4491A]/35 scale-105' +
          dropRing
        );
      }
      if (this.mode === 'character' && unlocked) {
        return base + 'border-[#C4491A] bg-[#C4491A]/25 text-[#FF8C5A]' + dropRing;
      }
      return (
        base +
        'border-[#C4491A]/70 bg-[#122220] text-[#FF8C5A] group-hover:border-[#FF8C5A] group-hover:scale-105' +
        dropRing
      );
    } else {
      const base = 'h-15 w-15 rounded-full border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#38B29A] bg-[#1D5B4E] text-white ring-4 ring-[#38B29A]/35 scale-105' +
          dropRing
        );
      }
      if (this.mode === 'character' && unlocked) {
        return base + 'border-[#38B29A] bg-[#1D5B4E]/35 text-[#38B29A]' + dropRing;
      }
      return (
        base +
        'border-[#2A6F62] bg-[#122220] text-[#38B29A] group-hover:border-[#38B29A] group-hover:scale-105' +
        dropRing
      );
    }
  }

  parentNodeName(parentId: string | null | undefined): string | null {
    if (!parentId) return null;
    return this.treeNodes().find((n) => n.id === parentId)?.name ?? null;
  }

  isUnlocked(nodeId: string): boolean {
    return this.unlockedIds.includes(nodeId);
  }

  isParentUnlocked(node: PerkNodeModel): boolean {
    if (!node.parent_node_id) return true;
    const parentInTree = this.treeNodes().some(
      (n) => n.id === node.parent_node_id
    );
    if (!parentInTree) return true;
    return this.unlockedIds.includes(node.parent_node_id);
  }

  canToggleCharacterNode(node: PerkNodeModel): boolean {
    if (this.isUnlocked(node.id)) return true;
    if (!this.isParentUnlocked(node)) return false;
    return this.perkSpent + (node.perk_cost ?? 1) <= this.perkBudget;
  }
}
