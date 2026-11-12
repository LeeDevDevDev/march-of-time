import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  formatRuleHookBadges,
  formatWeaponRequirementLabel,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  isCombatArtUpgradeNode,
  resolveNodeVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { KeywordTextComponent } from '../../../../shared/keyword-text/keyword-text.component';
import { CharacterStore } from '../../../characters/store/character.store';

@Component({
  selector: 'app-standalone-arts-manager',
  standalone: true,
  imports: [FormsModule, RouterLink, CompendiumIconComponent, KeywordTextComponent],
  templateUrl: './standalone-arts-manager.component.html',
})
export class StandaloneArtsManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);
  readonly characterStore = inject(CharacterStore);
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;
  readonly isCombatArtUpgradeNode = isCombatArtUpgradeNode;

  readonly createStandaloneNode = output<void>();
  readonly editStandaloneNode = output<PerkNodeModel>();
  readonly deleteStandaloneNode = output<PerkNodeModel>();
  readonly nodeMovedToTree = output<{ treeId: string; nodeId: string }>();

  readonly standaloneSearch = signal('');
  readonly standaloneTypeFilter = signal('All');
  readonly selectedStandaloneId = signal<string | null>(null);
  readonly characterSearch = signal('');
  readonly targetTreeId = signal('');

  readonly assignableCharacters = computed(() => {
    const dir = this.characterStore.adminDirectory();
    const own = this.characterStore.characters();
    const byId = new Map(dir.map((c) => [c.id, c]));
    for (const c of own) {
      if (!byId.has(c.id)) byId.set(c.id, c);
    }
    const q = this.characterSearch().trim().toLowerCase();
    return Array.from(byId.values())
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor() {
    void this.characterStore.ensureAdminDirectoryLoaded();
  }

  readonly standaloneFilterOptions: { id: string; label: string }[] = [
    { id: 'All', label: 'All Standalone' },
    { id: 'combat_art', label: 'Combat Arts' },
    { id: 'combat_art_upgrade', label: 'Art Upgrades' },
    { id: 'passive_upgrade', label: 'Passives' },
    { id: 'Crushing', label: 'Crushing' },
    { id: 'Sweeping', label: 'Sweeping' },
    { id: 'Piercing', label: 'Piercing' },
  ];

  readonly filteredStandaloneNodes = computed(() => {
    const q = this.standaloneSearch().trim().toLowerCase();
    const filter = this.standaloneTypeFilter();
    return this.compendiumStore
      .standaloneNodes()
      .filter((node) => {
        if (filter === 'combat_art' && node.node_type !== 'combat_art') {
          return false;
        }
        if (filter === 'combat_art_upgrade' && !isCombatArtUpgradeNode(node)) {
          return false;
        }
        if (
          filter === 'passive_upgrade' &&
          (node.node_type !== 'passive_upgrade' || isCombatArtUpgradeNode(node))
        ) {
          return false;
        }
        if (
          (filter === 'Crushing' ||
            filter === 'Sweeping' ||
            filter === 'Piercing') &&
          node.combat_tag !== filter
        ) {
          return false;
        }
        if (!q) return true;
        return (
          node.name.toLowerCase().includes(q) ||
          node.description.toLowerCase().includes(q) ||
          (node.combat_tag ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly selectedStandaloneNode = computed(() => {
    const list = this.filteredStandaloneNodes();
    const id = this.selectedStandaloneId();
    if (id) {
      const found = list.find((n) => n.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  selectNode(nodeId: string | null): void {
    this.selectedStandaloneId.set(nodeId);
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getNodeHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  getNodeWeaponReqLabel(node: PerkNodeModel): string | null {
    if (node.node_type !== 'combat_art') return null;
    return formatWeaponRequirementLabel(
      node.rule_hooks?.__weapon_req,
      this.compendiumStore.weapons()
    );
  }

  async toggleGrantToCharacter(characterId: string, node: PerkNodeModel): Promise<void> {
    await this.characterStore.toggleAdminGrantedPerk(characterId, node);
  }

  async moveStandaloneNodeToTree(
    node: PerkNodeModel,
    openTreeAfter = false
  ): Promise<void> {
    const treeId = this.targetTreeId();
    if (!treeId) return;
    const ok = await this.compendiumStore.moveOrReparentPerkNode(
      node.id,
      treeId,
      null
    );
    if (ok) {
      this.targetTreeId.set('');
      if (openTreeAfter) {
        this.nodeMovedToTree.emit({ treeId, nodeId: node.id });
      }
    }
  }
}
