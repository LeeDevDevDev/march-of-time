import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  DescriptionSegment,
  KeywordDefinition,
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  SkillTreeBranchNode,
  SkillTreeModel,
  buildKeywordLookupMap,
  buildSkillTreeHierarchy,
  formatRuleHookBadges,
  resolveChainedKeywords,
  resolveNodeVisuals,
  resolveTreeVisuals,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../compendium-icon/compendium-icon.component';

@Component({
  selector: 'app-skill-tree-canvas',
  standalone: true,
  imports: [NgTemplateOutlet, CompendiumIconComponent],
  templateUrl: './skill-tree-canvas.component.html',
})
export class SkillTreeCanvasComponent implements OnChanges {
  readonly Math = Math;
  private readonly compendiumStore = inject(CompendiumStore);

  @Input({ required: true }) tree!: SkillTreeModel;
  @Input({ required: true }) allNodes: PerkNodeModel[] = [];
  @Input() mode: 'admin' | 'character' = 'admin';
  @Input() unlockedIds: string[] = [];
  @Input() perkSpent = 0;
  @Input() perkBudget = 1;

  @Output() addRootNode = new EventEmitter<void>();
  @Output() branchChildNode = new EventEmitter<PerkNodeModel>();
  @Output() editNode = new EventEmitter<PerkNodeModel>();
  @Output() toggleArchiveNode = new EventEmitter<PerkNodeModel>();
  @Output() deleteNode = new EventEmitter<PerkNodeModel>();
  @Output() toggleUnlock = new EventEmitter<PerkNodeModel>();

  private readonly nodesSignal = signal<PerkNodeModel[]>([]);
  private readonly treeIdSignal = signal<string>('');

  readonly selectedNodeId = signal<string | null>(null);
  readonly hoveredKeyword = signal<KeywordDefinition | null>(null);

  // 2D Panning & Zoom State
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
    this.nodesSignal()
      .filter((n) => n.tree_id === this.treeIdSignal())
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
  );

  readonly branches = computed<SkillTreeBranchNode[]>(() =>
    buildSkillTreeHierarchy(this.treeIdSignal(), this.nodesSignal())
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

  readonly descriptionSegments = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return tokenizeTextWithKeywords(node.description, this.compendiumStore.keywords());
  });

  readonly chainedHoveredKeywords = computed<KeywordDefinition[]>(() =>
    resolveChainedKeywords(this.hoveredKeyword(), this.compendiumStore.keywords())
  );

  readonly nodeHookBadges = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return formatRuleHookBadges(node.rule_hooks);
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tree'] && this.tree) {
      const prevTreeId = this.treeIdSignal();
      this.treeIdSignal.set(this.tree.id);
      if (prevTreeId !== this.tree.id) {
        this.resetCamera();
        this.hoveredKeyword.set(null);
      }
    }
    if (changes['allNodes']) {
      this.nodesSignal.set(this.allNodes ?? []);
    }
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
    this.zoom.update((z) => Math.max(0.5, Math.min(1.6, Number((z + delta).toFixed(2)))));
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
    this.hoveredKeyword.set(null);
  }

  setHoveredKeywordByName(term: string): void {
    const map = buildKeywordLookupMap(this.compendiumStore.keywords());
    const def = map.get(term.toLowerCase());
    if (def) {
      this.hoveredKeyword.set(def);
    }
  }

  tokenizeKeywordSummary(kw: KeywordDefinition): DescriptionSegment[] {
    const others = this.compendiumStore
      .keywords()
      .filter((item) => item.term.trim().toLowerCase() !== kw.term.trim().toLowerCase());
    return tokenizeTextWithKeywords(kw.summary, others);
  }

  stripBrackets(raw: string): string {
    return (raw ?? '').replace(/\[([^\]]+)\]/g, '$1');
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

    if (node.node_type === 'combat_art') {
      const base = 'h-16 w-16 rounded-2xl border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#FF8C5A] bg-[#C4491A] text-white ring-4 ring-[#C4491A]/35 scale-105'
        );
      }
      if (this.mode === 'character' && unlocked) {
        return base + 'border-[#C4491A] bg-[#C4491A]/25 text-[#FF8C5A]';
      }
      return (
        base +
        'border-[#C4491A]/70 bg-[#122220] text-[#FF8C5A] group-hover:border-[#FF8C5A] group-hover:scale-105'
      );
    } else {
      const base = 'h-15 w-15 rounded-full border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#38B29A] bg-[#1D5B4E] text-white ring-4 ring-[#38B29A]/35 scale-105'
        );
      }
      if (this.mode === 'character' && unlocked) {
        return base + 'border-[#38B29A] bg-[#1D5B4E]/35 text-[#38B29A]';
      }
      return (
        base +
        'border-[#2A6F62] bg-[#122220] text-[#38B29A] group-hover:border-[#38B29A] group-hover:scale-105'
      );
    }
  }

  parentNodeName(parentId: string | null | undefined): string | null {
    if (!parentId) return null;
    return this.nodesSignal().find((n) => n.id === parentId)?.name ?? null;
  }

  isUnlocked(nodeId: string): boolean {
    return this.unlockedIds.includes(nodeId);
  }

  isParentUnlocked(node: PerkNodeModel): boolean {
    if (!node.parent_node_id) return true;
    return this.unlockedIds.includes(node.parent_node_id);
  }

  canToggleCharacterNode(node: PerkNodeModel): boolean {
    if (this.isUnlocked(node.id)) return true;
    if (!this.isParentUnlocked(node)) return false;
    return this.perkSpent + (node.perk_cost ?? 1) <= this.perkBudget;
  }
}
