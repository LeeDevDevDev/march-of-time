import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import {
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
  isStandalonePerkNode,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { KeywordsManagerComponent } from './components/keywords-manager/keywords-manager.component';
import { PerkNodeModalComponent } from './components/perk-node-modal/perk-node-modal.component';
import { SkillTreesManagerComponent } from './components/skill-trees-manager/skill-trees-manager.component';
import { StandaloneArtsManagerComponent } from './components/standalone-arts-manager/standalone-arts-manager.component';
import { WeaponsManagerComponent } from './components/weapons-manager/weapons-manager.component';

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
    SkillTreesManagerComponent,
    StandaloneArtsManagerComponent,
    WeaponsManagerComponent,
    KeywordsManagerComponent,
    PerkNodeModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './content-manager.component.html',
})
export class ContentManagerComponent implements OnInit {
  readonly compendiumStore = inject(CompendiumStore);

  @ViewChild(StandaloneArtsManagerComponent)
  standaloneManager?: StandaloneArtsManagerComponent;

  readonly studioTab = signal<'trees' | 'standalone' | 'weapons' | 'keywords'>(
    'trees'
  );
  readonly activeTreeId = signal<string | null>(null);
  readonly pendingDelete = signal<PendingDeleteState | null>(null);

  ngOnInit(): void {
    this.compendiumStore.clearMessages();
  }

  onStandaloneNodeSaved(nodeId: string): void {
    this.standaloneManager?.selectNode(nodeId);
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
    const dependentChildren = this.compendiumStore
      .perkNodes()
      .filter((n) => n.parent_node_id === node.id);

    this.pendingDelete.set({
      kind: 'node',
      target: node,
      title: isStandalone
        ? 'Delete Standalone Ability'
        : 'Delete Skill Tree Node',
      itemName: node.name,
      badge: isStandalone
        ? `Standalone · ${node.node_type === 'combat_art' ? 'Combat Art' : 'Passive'}`
        : `Tier ${node.tier} · ${node.node_type === 'combat_art' ? 'Combat Art' : 'Passive'}`,
      message: isStandalone
        ? `Are you sure you want to delete the standalone ability "${node.name}" from the compendium?`
        : `Are you sure you want to delete "${node.name}" from this skill tree?`,
      warningNote:
        dependentChildren.length > 0
          ? `This node is a prerequisite for ${dependentChildren.length} child node(s) (${dependentChildren.map((c) => c.name).join(', ')}). Deleting it will unlink their parent connection.`
          : 'Characters or NPC tokens who unlocked this ability will no longer receive its Combat Art or passive stat hooks.',
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
      title: 'Delete Special Word',
      itemName: kw.term,
      badge: kw.category,
      message: `Are you sure you want to remove "${kw.term}" from the Special Words & Glossary compendium?`,
      warningNote: `Any [${kw.term}] tags inside Skill Tree nodes, Weapon traits, or chained keywords will remain as text but will no longer display a hover rule tooltip.`,
      confirmLabel: 'Delete Special Word',
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
      if (ok && this.activeTreeId() === pending.target.id) {
        this.activeTreeId.set(null);
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
