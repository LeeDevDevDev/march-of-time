import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  KeywordDefinition,
  PerkNodeModel,
  PerkUnlockMode,
  ResolvedCompendiumVisuals,
  SkillGraphPoint,
  SkillTreeModel,
  canConnectPerkRoute,
  compareSiblingPerkNodes,
  formatRuleHookBadges,
  formatWeaponRequirementLabel,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  getNodeParentIds,
  getNodeUnlockMode,
  isCombatArtUpgradeNode,
  isPerkNodeReachableForUnlock,
  normalizePerkNodesTiers,
  resolveNodeVisuals,
  resolveSkillGraphLayout,
  resolveTreeVisuals,
  snapToCanvasGrid,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../compendium-icon/compendium-icon.component';
import { KeywordTooltipService } from '../keyword-text/keyword-tooltip.service';

export interface PositionedSkillNode {
  node: PerkNodeModel;
  x: number;
  y: number;
  isStartingNode: boolean;
  unlockMode: PerkUnlockMode;
  incomingCount: number;
}

export interface RenderedRouteCurve {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  path: string;
  midX: number;
  midY: number;
  isSourceUnlocked: boolean;
  isTargetUnlocked: boolean;
  isHighlighted: boolean;
}

function buildCubicRouteGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { path: string; midX: number; midY: number } {
  const verticalSpan = y2 - y1;
  const horizontalSpan = Math.abs(x2 - x1);

  let cp1y: number;
  let cp2y: number;

  if (verticalSpan > 24) {
    const pull = Math.max(48, Math.min(180, verticalSpan * 0.48 + horizontalSpan * 0.08));
    cp1y = y1 + pull;
    cp2y = y2 - pull;
  } else {
    const lift = Math.max(68, horizontalSpan * 0.34 + Math.max(0, y1 - y2) * 0.42);
    cp1y = y1 + lift;
    cp2y = y2 - lift;
  }

  const cp1x = x1;
  const cp2x = x2;

  const midX = 0.125 * x1 + 0.375 * cp1x + 0.375 * cp2x + 0.125 * x2;
  const midY = 0.125 * y1 + 0.375 * cp1y + 0.375 * cp2y + 0.125 * y2;

  return {
    path: `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`,
    midX: Math.round(midX),
    midY: Math.round(midY),
  };
}

@Component({
  selector: 'app-skill-tree-canvas',
  standalone: true,
  imports: [FormsModule, CompendiumIconComponent],
  templateUrl: './skill-tree-canvas.component.html',
})
export class SkillTreeCanvasComponent implements OnChanges, AfterViewInit {
  readonly Math = Math;
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;
  readonly isCombatArtUpgradeNode = isCombatArtUpgradeNode;
  readonly compendiumStore = inject(CompendiumStore);
  readonly keywordTooltip = inject(KeywordTooltipService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('canvasViewport')
  canvasViewportRef?: ElementRef<HTMLDivElement>;

  readonly markerPrefix = `mot-route-${Math.random().toString(36).slice(2, 8)}`;

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
  private readonly unlockedIdsSignal = signal<string[]>([]);
  private hasInitialCentered = false;

  readonly selectedNodeId = signal<string | null>(null);
  readonly hoveredRouteId = signal<string | null>(null);
  readonly selectedRouteId = signal<string | null>(null);
  readonly targetMoveTreeId = signal<string>('');
  readonly inspectorAddParentId = signal<string>('');
  readonly inspectorAddChildId = signal<string>('');

  readonly panX = signal(420);
  readonly panY = signal(88);
  readonly zoom = signal(1);
  readonly isPanning = signal(false);

  readonly movingNodeId = signal<string | null>(null);
  readonly liveNodePosition = signal<SkillGraphPoint | null>(null);

  readonly connectingFromNodeId = signal<string | null>(null);
  readonly wireCursorWorld = signal<SkillGraphPoint | null>(null);
  readonly hoveredConnectTargetId = signal<string | null>(null);

  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private initialPanX = 0;
  private initialPanY = 0;
  private initialNodeX = 0;
  private initialNodeY = 0;
  private pointerMovedDistance = 0;

  readonly treeNodes = computed(() =>
    normalizePerkNodesTiers(
      this.nodesSignal().filter((n) => n.tree_id === this.treeIdSignal())
    ).sort((a, b) => a.tier - b.tier || compareSiblingPerkNodes(a, b))
  );

  readonly baseLayoutMap = computed(() =>
    resolveSkillGraphLayout(this.treeNodes())
  );

  readonly positionedNodes = computed<PositionedSkillNode[]>(() => {
    const list = this.treeNodes();
    const layout = this.baseLayoutMap();
    const activeMoveId = this.movingNodeId();
    const activeMovePt = this.liveNodePosition();

    return list.map((node) => {
      const basePt = layout.get(node.id) ?? { x: 0, y: 0 };
      const pt =
        activeMoveId === node.id && activeMovePt ? activeMovePt : basePt;
      const parents = getNodeParentIds(node, list);
      return {
        node,
        x: pt.x,
        y: pt.y,
        isStartingNode: parents.length === 0,
        unlockMode: getNodeUnlockMode(node),
        incomingCount: parents.length,
      };
    });
  });

  readonly positionedById = computed(() => {
    const map = new Map<string, PositionedSkillNode>();
    for (const item of this.positionedNodes()) {
      map.set(item.node.id, item);
    }
    return map;
  });

  readonly routeCurves = computed<RenderedRouteCurve[]>(() => {
    const list = this.treeNodes();
    const byId = this.positionedById();
    const unlockedSet = new Set(this.unlockedIdsSignal());
    const selNodeId = this.selectedNode()?.id ?? null;
    const hovRoute = this.hoveredRouteId();
    const selRoute = this.selectedRouteId();
    const outPortOffsetY = this.mode === 'admin' ? 130 : 108;

    const curves: RenderedRouteCurve[] = [];
    for (const targetNode of list) {
      const targetPos = byId.get(targetNode.id);
      if (!targetPos) continue;
      const parents = getNodeParentIds(targetNode, list);
      for (const sourceId of parents) {
        const sourcePos = byId.get(sourceId);
        if (!sourcePos) continue;
        const routeId = `${sourceId}->${targetNode.id}`;
        const x1 = sourcePos.x;
        const y1 = sourcePos.y + outPortOffsetY;
        const x2 = targetPos.x;
        const y2 = targetPos.y - 4;
        const geom = buildCubicRouteGeometry(x1, y1, x2, y2);
        const isHighlighted =
          hovRoute === routeId ||
          selRoute === routeId ||
          (this.mode === 'admin' &&
            (selNodeId === sourceId || selNodeId === targetNode.id));

        curves.push({
          id: routeId,
          sourceId,
          targetId: targetNode.id,
          sourceName: sourcePos.node.name,
          targetName: targetPos.node.name,
          path: geom.path,
          midX: geom.midX,
          midY: geom.midY,
          isSourceUnlocked: unlockedSet.has(sourceId),
          isTargetUnlocked: unlockedSet.has(targetNode.id),
          isHighlighted,
        });
      }
    }
    return curves;
  });

  readonly liveConnectionPreview = computed<{
    path: string;
    isValidTarget: boolean;
    isCycleBlocked: boolean;
    targetName: string | null;
  } | null>(() => {
    const sourceId = this.connectingFromNodeId();
    const cursor = this.wireCursorWorld();
    if (!sourceId || !cursor) return null;

    const byId = this.positionedById();
    const sourcePos = byId.get(sourceId);
    if (!sourcePos) return null;

    const x1 = sourcePos.x;
    const y1 = sourcePos.y + 130;

    const hoveredId = this.hoveredConnectTargetId();
    const targetPos = hoveredId ? byId.get(hoveredId) : undefined;

    if (targetPos && hoveredId && hoveredId !== sourceId) {
      const check = canConnectPerkRoute(sourceId, hoveredId, this.treeNodes());
      const x2 = targetPos.x;
      const y2 = targetPos.y - 4;
      const geom = buildCubicRouteGeometry(x1, y1, x2, y2);
      return {
        path: geom.path,
        isValidTarget: check.allowed,
        isCycleBlocked: check.reason === 'cycle',
        targetName: targetPos.node.name,
      };
    }

    const geom = buildCubicRouteGeometry(x1, y1, cursor.x, cursor.y);
    return {
      path: geom.path,
      isValidTarget: false,
      isCycleBlocked: false,
      targetName: null,
    };
  });

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

  readonly selectedNodeIncoming = computed<PerkNodeModel[]>(() => {
    const node = this.selectedNode();
    if (!node) return [];
    const list = this.treeNodes();
    const byId = new Map(list.map((n) => [n.id, n]));
    return getNodeParentIds(node, list)
      .map((id) => byId.get(id))
      .filter((n): n is PerkNodeModel => n !== undefined);
  });

  readonly selectedNodeOutgoing = computed<PerkNodeModel[]>(() => {
    const node = this.selectedNode();
    if (!node) return [];
    const list = this.treeNodes();
    return list.filter((candidate) =>
      getNodeParentIds(candidate, list).includes(node.id)
    );
  });

  readonly availableIncomingCandidates = computed<PerkNodeModel[]>(() => {
    const node = this.selectedNode();
    if (!node) return [];
    const list = this.treeNodes();
    return list.filter(
      (candidate) =>
        canConnectPerkRoute(candidate.id, node.id, list).allowed
    );
  });

  readonly availableOutgoingCandidates = computed<PerkNodeModel[]>(() => {
    const node = this.selectedNode();
    if (!node) return [];
    const list = this.treeNodes();
    return list.filter(
      (candidate) =>
        canConnectPerkRoute(node.id, candidate.id, list).allowed
    );
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

  readonly selectedNodeWeaponReqLabel = computed<string | null>(() => {
    const node = this.selectedNode();
    if (!node || node.node_type !== 'combat_art') return null;
    return formatWeaponRequirementLabel(
      node.rule_hooks?.__weapon_req,
      this.compendiumStore.weapons()
    );
  });

  readonly selectedNodeUpgradeTargets = computed<PerkNodeModel[]>(() => {
    const node = this.selectedNode();
    if (!node || !isCombatArtUpgradeNode(node)) return [];
    const spec = node.rule_hooks?.__art_upgrade;
    if (!spec || spec.target_mode !== 'specific_arts') return [];
    const byId = new Map(this.treeNodes().map((n) => [n.id, n]));
    return (spec.target_art_ids ?? [])
      .map((id) => byId.get(id))
      .filter((n): n is PerkNodeModel => n !== undefined);
  });

  readonly selectedNodePinnedUpgrades = computed<PerkNodeModel[]>(() => {
    const node = this.selectedNode();
    if (!node || node.node_type !== 'combat_art') return [];
    return this.treeNodes().filter(
      (cand) =>
        isCombatArtUpgradeNode(cand) &&
        cand.rule_hooks?.__art_upgrade?.target_mode === 'specific_arts' &&
        (cand.rule_hooks.__art_upgrade.target_art_ids ?? []).includes(node.id)
    );
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (!this.hasInitialCentered) {
        this.resetCamera();
        this.hasInitialCentered = true;
      }
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['unlockedIds']) {
      this.unlockedIdsSignal.set(this.unlockedIds ?? []);
    }
    if (changes['allNodes']) {
      const prevCount = this.treeNodes().length;
      this.nodesSignal.set(this.allNodes ?? []);
      if (prevCount === 0 && this.treeNodes().length > 0) {
        setTimeout(() => this.resetCamera(), 0);
      }
    }
    if (changes['tree'] && this.tree) {
      const prevTreeId = this.treeIdSignal();
      this.treeIdSignal.set(this.tree.id);
      if (prevTreeId !== this.tree.id) {
        this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
        this.targetMoveTreeId.set('');
        this.selectedRouteId.set(null);
        this.hoveredRouteId.set(null);
        setTimeout(() => this.resetCamera(), 0);
      }
    }
  }

  selectNodeById(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    this.selectedRouteId.set(null);
  }

  private clientToWorld(clientX: number, clientY: number): SkillGraphPoint {
    const rect = this.canvasViewportRef?.nativeElement.getBoundingClientRect();
    const offsetX = rect ? clientX - rect.left : clientX;
    const offsetY = rect ? clientY - rect.top : clientY;
    const z = this.zoom() || 1;
    return {
      x: (offsetX - this.panX()) / z,
      y: (offsetY - this.panY()) / z,
    };
  }

  private findTargetNodeAtWorld(
    worldPt: SkillGraphPoint,
    excludeNodeId: string
  ): string | null {
    let closestId: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const item of this.positionedNodes()) {
      if (item.node.id === excludeNodeId) continue;
      const centerX = item.x;
      const centerY = item.y + 42;
      const dx = Math.abs(worldPt.x - centerX);
      const dy = Math.abs(worldPt.y - centerY);
      if (dx <= 76 && dy <= 66) {
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          closestId = item.node.id;
        }
      }
    }
    return closestId;
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.selectedRouteId.set(null);
    this.isPanning.set(true);
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.initialPanX = this.panX();
    this.initialPanY = this.panY();
    this.pointerMovedDistance = 0;
  }

  onNodePointerDown(event: PointerEvent, item: PositionedSkillNode): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.selectedRouteId.set(null);

    if (this.mode !== 'admin') {
      this.selectedNodeId.set(item.node.id);
      this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
      return;
    }

    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.initialNodeX = item.x;
    this.initialNodeY = item.y;
    this.pointerMovedDistance = 0;
    this.movingNodeId.set(item.node.id);
    this.liveNodePosition.set({ x: item.x, y: item.y });
  }

  onRoutePointPointerDown(event: PointerEvent, sourceNode: PerkNodeModel): void {
    if (event.button !== 0 || this.mode !== 'admin') return;
    event.stopPropagation();
    event.preventDefault();
    this.selectedNodeId.set(sourceNode.id);
    this.selectedRouteId.set(null);
    this.connectingFromNodeId.set(sourceNode.id);
    this.hoveredConnectTargetId.set(null);
    this.wireCursorWorld.set(this.clientToWorld(event.clientX, event.clientY));
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (this.connectingFromNodeId()) {
      const sourceId = this.connectingFromNodeId()!;
      const worldPt = this.clientToWorld(event.clientX, event.clientY);
      this.wireCursorWorld.set(worldPt);
      const hitNodeId = this.findTargetNodeAtWorld(worldPt, sourceId);
      this.hoveredConnectTargetId.set(hitNodeId);
      return;
    }

    if (this.movingNodeId()) {
      const dx = event.clientX - this.dragStartClientX;
      const dy = event.clientY - this.dragStartClientY;
      this.pointerMovedDistance = Math.hypot(dx, dy);
      if (this.pointerMovedDistance > 5) {
        const z = this.zoom() || 1;
        this.liveNodePosition.set({
          x: snapToCanvasGrid(this.initialNodeX + dx / z),
          y: snapToCanvasGrid(this.initialNodeY + dy / z),
        });
      }
      return;
    }

    if (this.isPanning()) {
      const dx = event.clientX - this.dragStartClientX;
      const dy = event.clientY - this.dragStartClientY;
      this.pointerMovedDistance = Math.hypot(dx, dy);
      this.panX.set(this.initialPanX + dx);
      this.panY.set(this.initialPanY + dy);
    }
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    if (this.connectingFromNodeId()) {
      const sourceId = this.connectingFromNodeId()!;
      const targetId = this.hoveredConnectTargetId();
      this.connectingFromNodeId.set(null);
      this.wireCursorWorld.set(null);
      this.hoveredConnectTargetId.set(null);

      if (targetId && targetId !== sourceId) {
        void this.compendiumStore.connectPerkRoute(sourceId, targetId);
      }
      return;
    }

    if (this.movingNodeId()) {
      const nodeId = this.movingNodeId()!;
      const finalPos = this.liveNodePosition();
      const moved = this.pointerMovedDistance > 5;
      this.movingNodeId.set(null);
      this.liveNodePosition.set(null);

      this.selectedNodeId.set(nodeId);
      this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);

      if (moved && finalPos) {
        void this.compendiumStore.updateNodeCanvasPosition(
          nodeId,
          finalPos.x,
          finalPos.y
        );
      }
      return;
    }

    if (this.isPanning()) {
      this.isPanning.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeCancelWire(): void {
    if (this.connectingFromNodeId()) {
      this.connectingFromNodeId.set(null);
      this.wireCursorWorld.set(null);
      this.hoveredConnectTargetId.set(null);
    }
    this.selectedRouteId.set(null);
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    this.adjustZoom(delta);
  }

  adjustZoom(delta: number): void {
    const viewport = this.canvasViewportRef?.nativeElement;
    const prevZoom = this.zoom();
    const nextZoom = Math.max(
      0.5,
      Math.min(1.6, Number((prevZoom + delta).toFixed(2)))
    );
    if (nextZoom === prevZoom) return;

    if (viewport) {
      const cx = viewport.clientWidth / 2;
      const cy = viewport.clientHeight / 2;
      const worldCenterX = (cx - this.panX()) / prevZoom;
      const worldCenterY = (cy - this.panY()) / prevZoom;
      this.zoom.set(nextZoom);
      this.panX.set(Math.round(cx - worldCenterX * nextZoom));
      this.panY.set(Math.round(cy - worldCenterY * nextZoom));
    } else {
      this.zoom.set(nextZoom);
    }
  }

  resetCamera(): void {
    this.zoom.set(1);
    const viewportWidth =
      this.canvasViewportRef?.nativeElement.clientWidth || 820;
    const items = this.positionedNodes();
    if (items.length === 0) {
      this.panX.set(Math.round(viewportWidth / 2));
      this.panY.set(100);
      return;
    }

    const xs = items.map((i) => i.x);
    const ys = items.map((i) => i.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const minY = Math.min(...ys);

    this.panX.set(Math.round(viewportWidth / 2 - centerX));
    this.panY.set(Math.round(92 - minY));
  }

  autoArrangeGraph(): void {
    if (!this.tree?.id) return;
    void this.compendiumStore.autoArrangeSkillTree(this.tree.id).then(() => {
      this.resetCamera();
    });
  }

  onAddChildFromNode(event: MouseEvent, parentNode: PerkNodeModel): void {
    event.stopPropagation();
    this.selectedNodeId.set(parentNode.id);
    this.branchChildNode.emit(parentNode);
  }

  onRouteLineClick(event: MouseEvent, route: RenderedRouteCurve): void {
    if (this.mode !== 'admin') return;
    event.stopPropagation();
    this.selectedRouteId.update((curr) =>
      curr === route.id ? null : route.id
    );
  }

  onDisconnectRoute(
    event: Event,
    sourceId: string,
    targetId: string
  ): void {
    event.stopPropagation();
    this.selectedRouteId.set(null);
    this.hoveredRouteId.set(null);
    void this.compendiumStore.disconnectPerkRoute(sourceId, targetId);
  }

  onInspectorAddIncoming(node: PerkNodeModel): void {
    const sourceId = this.inspectorAddParentId();
    if (!sourceId) return;
    this.inspectorAddParentId.set('');
    void this.compendiumStore.connectPerkRoute(sourceId, node.id);
  }

  onInspectorAddOutgoing(node: PerkNodeModel): void {
    const targetId = this.inspectorAddChildId();
    if (!targetId) return;
    this.inspectorAddChildId.set('');
    void this.compendiumStore.connectPerkRoute(node.id, targetId);
  }

  onSetUnlockMode(node: PerkNodeModel, mode: PerkUnlockMode): void {
    void this.compendiumStore.setNodeUnlockMode(node.id, mode);
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

  connectTargetState(
    candidateId: string
  ): 'none' | 'valid' | 'hovered-valid' | 'blocked' {
    const sourceId = this.connectingFromNodeId();
    if (!sourceId || sourceId === candidateId) return 'none';
    const check = canConnectPerkRoute(sourceId, candidateId, this.treeNodes());
    if (!check.allowed) {
      return 'blocked';
    }
    return this.hoveredConnectTargetId() === candidateId
      ? 'hovered-valid'
      : 'valid';
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
    const reachable = this.isPrerequisiteSatisfied(node);
    const targetState = this.connectTargetState(node.id);

    const connectRing =
      targetState === 'hovered-valid'
        ? ' ring-4 ring-[#38B29A] scale-110'
        : targetState === 'valid'
          ? ' ring-2 ring-[#38B29A]/55'
          : targetState === 'blocked'
            ? ' opacity-35'
            : '';

    const characterLockedDim =
      this.mode === 'character' && !unlocked && !reachable
        ? ' opacity-55'
        : '';

    if (node.node_type === 'combat_art') {
      const base = 'h-16 w-16 rounded-2xl border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#FF8C5A] bg-[#C4491A] text-white ring-4 ring-[#C4491A]/35 scale-105' +
          connectRing
        );
      }
      if (this.mode === 'character' && unlocked) {
        return (
          base +
          'border-[#C4491A] bg-[#C4491A]/25 text-[#FF8C5A]' +
          connectRing
        );
      }
      return (
        base +
        'border-[#C4491A]/70 bg-[#122220] text-[#FF8C5A] group-hover:border-[#FF8C5A] group-hover:scale-105' +
        connectRing +
        characterLockedDim
      );
    }

    if (isCombatArtUpgradeNode(node)) {
      const base = 'h-16 w-16 rounded-xl border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#FBBF24] bg-[#B45309] text-white ring-4 ring-[#F59E0B]/35 scale-105' +
          connectRing
        );
      }
      if (this.mode === 'character' && unlocked) {
        return (
          base +
          'border-[#F59E0B] bg-[#F59E0B]/20 text-[#FBBF24]' +
          connectRing
        );
      }
      return (
        base +
        'border-[#F59E0B]/70 bg-[#122220] text-[#F59E0B] group-hover:border-[#FBBF24] group-hover:scale-105' +
        connectRing +
        characterLockedDim
      );
    }

    const base = 'h-16 w-16 rounded-full border-2 ';
    if (isSelected) {
      return (
        base +
        'border-[#38B29A] bg-[#1D5B4E] text-white ring-4 ring-[#38B29A]/35 scale-105' +
        connectRing
      );
    }
    if (this.mode === 'character' && unlocked) {
      return (
        base +
        'border-[#38B29A] bg-[#1D5B4E]/35 text-[#38B29A]' +
        connectRing
      );
    }
    return (
      base +
      'border-[#2A6F62] bg-[#122220] text-[#38B29A] group-hover:border-[#38B29A] group-hover:scale-105' +
      connectRing +
      characterLockedDim
    );
  }

  isUnlocked(nodeId: string): boolean {
    return this.unlockedIdsSignal().includes(nodeId);
  }

  isPrerequisiteSatisfied(node: PerkNodeModel): boolean {
    return isPerkNodeReachableForUnlock(
      node,
      this.unlockedIdsSignal(),
      this.treeNodes()
    );
  }

  canToggleCharacterNode(node: PerkNodeModel): boolean {
    if (this.isUnlocked(node.id)) return true;
    if (!this.isPrerequisiteSatisfied(node)) return false;
    return this.perkSpent + (node.perk_cost ?? 1) <= this.perkBudget;
  }

  routeStrokeColor(route: RenderedRouteCurve): string {
    if (this.mode === 'character') {
      if (route.isSourceUnlocked && route.isTargetUnlocked) return '#FF8C5A';
      if (route.isSourceUnlocked) return '#C4491A';
      return '#284540';
    }
    return route.isHighlighted ? '#FF8C5A' : '#C4491A';
  }

  routeMarkerUrl(route: RenderedRouteCurve): string {
    if (this.mode === 'character') {
      if (route.isSourceUnlocked) {
        return `url(#${this.markerPrefix}-active)`;
      }
      return `url(#${this.markerPrefix}-muted)`;
    }
    return route.isHighlighted
      ? `url(#${this.markerPrefix}-active)`
      : `url(#${this.markerPrefix}-default)`;
  }
}
