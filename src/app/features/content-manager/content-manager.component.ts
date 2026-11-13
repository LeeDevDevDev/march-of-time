import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import {
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
  getNodeParentIds,
  isCombatArtUpgradeNode,
  isStandalonePerkNode,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { CollectionsManagerComponent } from '../collections/collections-manager.component';
import { CollectionsStore } from '../collections/collections.store';
import { KeywordsManagerComponent } from './components/keywords-manager/keywords-manager.component';
import { PerkNodeModalComponent } from './components/perk-node-modal/perk-node-modal.component';
import { SkillTreesManagerComponent } from './components/skill-trees-manager/skill-trees-manager.component';
import { StandaloneArtsManagerComponent } from './components/standalone-arts-manager/standalone-arts-manager.component';
import { WeaponsManagerComponent } from './components/weapons-manager/weapons-manager.component';

export type ContentStudioTab =
  | 'trees'
  | 'standalone'
  | 'weapons'
  | 'keywords'
  | 'collections';

export function parseContentManagerUrl(rawUrl: string): {
  tab: ContentStudioTab;
  treeId: string | null;
} {
  const cleanPath = (rawUrl ?? '').split('?')[0].split('#')[0];
  const segments = cleanPath
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

  const cmIdx = segments.indexOf('content-manager');
  const subSegments = cmIdx >= 0 ? segments.slice(cmIdx + 1) : segments;
  const first = subSegments[0] ?? 'trees';

  if (
    first === 'standalone' ||
    first === 'weapons' ||
    first === 'keywords' ||
    first === 'collections'
  ) {
    return { tab: first, treeId: null };
  }

  return {
    tab: 'trees',
    treeId: first === 'trees' ? (subSegments[1] ?? null) : null,
  };
}

@Component({
  selector: 'app-content-manager-route-slot',
  standalone: true,
  template: '',
})
export class ContentManagerRouteSlotComponent {}

type PendingDeleteState =
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
    };

@Component({
  selector: 'app-content-manager',
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    SkillTreesManagerComponent,
    StandaloneArtsManagerComponent,
    WeaponsManagerComponent,
    KeywordsManagerComponent,
    CollectionsManagerComponent,
    PerkNodeModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './content-manager.component.html',
})
export class ContentManagerComponent implements OnInit {
  readonly compendiumStore = inject(CompendiumStore);
  readonly collectionsStore = inject(CollectionsStore);
  private readonly router = inject(Router);

  @ViewChild(StandaloneArtsManagerComponent)
  standaloneManager?: StandaloneArtsManagerComponent;

  @ViewChild(SkillTreesManagerComponent)
  treesManager?: SkillTreesManagerComponent;

  readonly studioTab = signal<ContentStudioTab>('trees');
  readonly activeTreeId = signal<string | null>(null);
  readonly pendingDelete = signal<PendingDeleteState | null>(null);

  constructor() {
    void this.compendiumStore.ensureLoaded();
    this.syncStateFromUrl(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.syncStateFromUrl(event.urlAfterRedirects || event.url);
      });
  }

  ngOnInit(): void {
    this.compendiumStore.clearMessages();
    this.syncStateFromUrl(this.router.url);
  }

  private syncStateFromUrl(url: string): void {
    const parsed = parseContentManagerUrl(url);
    this.studioTab.set(parsed.tab);
    this.activeTreeId.set(parsed.treeId);
    if (parsed.tab === 'collections') {
      void this.collectionsStore.loadCollections();
    }
  }

  onActiveTreeIdChange(nextTreeId: string | null): void {
    if (!nextTreeId) {
      this.activeTreeId.set(null);
      void this.router.navigate(['/content-manager', 'trees']);
      return;
    }
    const matched = this.compendiumStore
      .skillTrees()
      .find((t) => t.id === nextTreeId || t.slug === nextTreeId);
    const routeSegment = matched?.slug || nextTreeId;
    this.activeTreeId.set(routeSegment);
    void this.router.navigate(['/content-manager', 'trees', routeSegment]);
  }

  onStandaloneNodeSaved(nodeId: string): void {
    this.standaloneManager?.selectNode(nodeId);
  }

  onTreeNodeSaved(nodeId: string): void {
    setTimeout(() => {
      this.treesManager?.selectCanvasNode(nodeId);
    }, 0);
  }

  async onNodeMovedToTree(event: {
    treeId: string;
    nodeId: string;
  }): Promise<void> {
    const matched = this.compendiumStore
      .skillTrees()
      .find((t) => t.id === event.treeId || t.slug === event.treeId);
    const routeSegment = matched?.slug || event.treeId;
    await this.router.navigate(['/content-manager', 'trees', routeSegment]);
    setTimeout(() => {
      this.treesManager?.selectCanvasNode(event.nodeId);
    }, 0);
  }

  confirmDeleteTree(tree: SkillTreeModel): void {
    this.compendiumStore.clearMessages();
    const nodes = this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === tree.id);
    const combatArtsCount = nodes.filter(
      (p) => p.node_type === 'combat_art'
    ).length;
    const passivesCount = nodes.filter(
      (p) => p.node_type === 'passive_upgrade'
    ).length;
    const totalNodes = nodes.length;

    this.pendingDelete.set({
      kind: 'tree',
      target: tree,
      title: 'Delete Skill Tree',
      itemName: tree.name,
      badge: `${totalNodes} ${totalNodes === 1 ? 'Node' : 'Nodes'}`,
      message: `Are you sure you want to delete the "${tree.name}" skill tree from the compendium?`,
      warningNote:
        totalNodes > 0
          ? `Warning: Deleting this tree will also remove its ${combatArtsCount} Combat Art(s) and ${passivesCount} Passive Upgrade(s).`
          : '',
      confirmLabel: 'Delete Skill Tree',
    });
  }

  confirmDeleteNode(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    const isStandalone = isStandalonePerkNode(node);
    const treeNodes = this.compendiumStore
      .perkNodes()
      .filter((n) => n.tree_id === node.tree_id);
    const incomingCount = isStandalone
      ? 0
      : getNodeParentIds(node, treeNodes).length;
    const dependentChildren = isStandalone
      ? []
      : treeNodes.filter((n) => getNodeParentIds(n, treeNodes).includes(node.id));

    this.pendingDelete.set({
      kind: 'node',
      target: node,
      title: isStandalone
        ? 'Delete Standalone Ability'
        : 'Delete Skill Tree Node',
      itemName: node.name,
      badge: isStandalone
        ? `Standalone · ${node.node_type === 'combat_art' ? 'Combat Art' : isCombatArtUpgradeNode(node) ? 'Combat Art Upgrade' : 'Passive'}`
        : `${incomingCount === 0 ? 'Starting Node' : 'Connected Node'} · ${node.node_type === 'combat_art' ? 'Combat Art' : isCombatArtUpgradeNode(node) ? 'Combat Art Upgrade' : 'Passive'}`,
      message: isStandalone
        ? `Are you sure you want to delete the standalone ability "${node.name}" from the compendium?`
        : `Are you sure you want to delete "${node.name}" from this skill tree?`,
      warningNote:
        dependentChildren.length > 0
          ? `This node connects into ${dependentChildren.length} downstream node(s) (${dependentChildren.map((c) => c.name).join(', ')}). Deleting it disconnects its routes (downstream nodes keep any other connected routes or become Starting Nodes). Use "Remove from Tree" in the Inspector if you want to keep this ability in Standalone Arts instead.`
          : isStandalone
            ? 'Existing characters who already have this ability keep their unlocked perk safely intact.'
            : 'Use "Remove from Tree" in the Inspector if you only want to detach this ability from the tree without deleting it.',
      confirmLabel: isStandalone ? 'Delete Standalone Ability' : 'Delete Node',
    });
  }

  confirmDeleteWeapon(w: WeaponModel): void {
    this.compendiumStore.clearMessages();
    this.pendingDelete.set({
      kind: 'weapon',
      target: w,
      title: 'Delete Weapon from Armory',
      itemName: w.name,
      badge: `${w.category} · ${w.ap_cost} AP`,
      message: `Are you sure you want to remove "${w.name}" from the active Weapons & Armory compendium?`,
      warningNote:
        'Existing characters who already have this weapon equipped will keep their stats safely intact.',
      confirmLabel: 'Delete Weapon',
    });
  }

  confirmDeleteKeyword(kw: KeywordDefinition): void {
    this.compendiumStore.clearMessages();
    this.pendingDelete.set({
      kind: 'keyword',
      target: kw,
      title: 'Delete Keyword',
      itemName: kw.term,
      badge: kw.category,
      message: `Are you sure you want to remove "${kw.term}" from the Keywords Glossary compendium?`,
      warningNote: `Any [${kw.term}] tags inside Skill Tree nodes, Weapon traits, or chained keywords will remain as text but will no longer display a hover rule tooltip.`,
      confirmLabel: 'Delete Keyword',
    });
  }

  cancelConfirmDelete(): void {
    if (!this.compendiumStore.isLoading()) {
      this.pendingDelete.set(null);
    }
  }

  async executeConfirmDelete(): Promise<void> {
    const pending = this.pendingDelete();
    if (!pending) return;

    if (pending.kind === 'tree') {
      const ok = await this.compendiumStore.deleteSkillTree(pending.target.id);
      const currentParam = this.activeTreeId();
      if (
        ok &&
        (currentParam === pending.target.id ||
          currentParam === pending.target.slug)
      ) {
        this.activeTreeId.set(null);
        void this.router.navigate(['/content-manager', 'trees']);
      }
    } else if (pending.kind === 'node') {
      await this.compendiumStore.deletePerkNode(pending.target.id);
    } else if (pending.kind === 'weapon') {
      await this.compendiumStore.deleteWeapon(pending.target.id);
    } else if (pending.kind === 'keyword') {
      await this.compendiumStore.deleteKeyword(pending.target);
    }

    this.pendingDelete.set(null);
  }
}
