import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  formatRuleHookBadges,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  resolveNodeVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { KeywordTextComponent } from '../../../../shared/keyword-text/keyword-text.component';

@Component({
  selector: 'app-standalone-arts-manager',
  standalone: true,
  imports: [FormsModule, CompendiumIconComponent, KeywordTextComponent],
  templateUrl: './standalone-arts-manager.component.html',
})
export class StandaloneArtsManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;

  readonly createStandaloneNode = output<void>();
  readonly editStandaloneNode = output<PerkNodeModel>();
  readonly deleteStandaloneNode = output<PerkNodeModel>();

  readonly standaloneSearch = signal('');
  readonly standaloneTypeFilter = signal('All');
  readonly selectedStandaloneId = signal<string | null>(null);

  readonly standaloneFilterOptions: { id: string; label: string }[] = [
    { id: 'All', label: 'All Standalone' },
    { id: 'combat_art', label: 'Combat Arts' },
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
        if (
          filter === 'passive_upgrade' &&
          node.node_type !== 'passive_upgrade'
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
}
