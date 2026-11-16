import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CompendiumItemModel,
  ITEM_SUBCATEGORY_OPTIONS,
  ResolvedCompendiumVisuals,
  resolveCompendiumItemVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../../../shared/compendium-icon/icon-picker.component';
import { KeywordTextComponent } from '../../../../shared/keyword-text/keyword-text.component';
import { KeywordTextareaComponent } from '../../../../shared/keyword-text/keyword-textarea.component';

@Component({
  selector: 'app-items-manager',
  standalone: true,
  imports: [
    FormsModule,
    CompendiumIconComponent,
    IconPickerComponent,
    KeywordTextComponent,
    KeywordTextareaComponent,
  ],
  templateUrl: './items-manager.component.html',
})
export class ItemsManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);

  readonly requestCreateKeyword = output<string>();
  readonly deleteItem = output<CompendiumItemModel>();

  readonly subcategoryOptions = ITEM_SUBCATEGORY_OPTIONS;
  readonly itemSearch = signal('');
  readonly itemFilter = signal<string>('All');
  readonly selectedItemId = signal<string | null>(null);

  readonly filterOptions: { id: string; label: string }[] = [
    { id: 'All', label: 'All Items' },
    { id: 'Ammunition', label: 'Ammunition' },
    { id: 'Camping & Survival', label: 'Camping & Survival' },
    { id: 'Consumable', label: 'Consumables' },
    { id: 'Tool & Kit', label: 'Tools & Kits' },
    { id: 'Adventuring Gear', label: 'Adventuring Gear' },
    { id: 'Quest & Loot', label: 'Quest & Loot' },
  ];

  readonly filteredItems = computed(() => {
    const q = this.itemSearch().trim().toLowerCase();
    const filter = this.itemFilter();
    return this.compendiumStore.items().filter((item) => {
      if (
        filter !== 'All' &&
        (item.subcategory ?? '').toLowerCase() !== filter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.subcategory ?? '').toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q)
      );
    });
  });

  readonly selectedItem = computed(() => {
    const list = this.filteredItems();
    const id = this.selectedItemId();
    if (id) {
      const found = list.find((i) => i.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  readonly itemModalOpen = signal(false);
  readonly editingItemId = signal<string | null>(null);

  itemForm: {
    name: string;
    subcategory: string;
    default_quantity: number;
    stackable: boolean;
    description: string;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    name: '',
    subcategory: 'Adventuring Gear',
    default_quantity: 1,
    stackable: true,
    description: '',
    icon: 'pack',
    icon_color: '#38B29A',
    icon_tint_custom: true,
  };

  clearSelectionIfDeleted(itemId: string): void {
    if (this.selectedItemId() === itemId) {
      this.selectedItemId.set(null);
    }
  }

  getItemVisuals(item: CompendiumItemModel): ResolvedCompendiumVisuals {
    return resolveCompendiumItemVisuals(item);
  }

  openNewItemModal(): void {
    this.compendiumStore.clearMessages();
    this.editingItemId.set(null);
    const activeFilter = this.itemFilter();
    const defaultSub =
      activeFilter !== 'All' ? activeFilter : 'Adventuring Gear';
    this.itemForm = {
      name: '',
      subcategory: defaultSub,
      default_quantity: defaultSub === 'Ammunition' ? 20 : 1,
      stackable: true,
      description: '',
      icon:
        defaultSub === 'Ammunition'
          ? 'quiver'
          : defaultSub === 'Camping & Survival'
            ? 'camp-tent'
            : defaultSub === 'Consumable'
              ? 'crimson-drop'
              : 'pack',
      icon_color: '#38B29A',
      icon_tint_custom: true,
    };
    this.itemModalOpen.set(true);
  }

  openEditItemModal(item: CompendiumItemModel): void {
    this.compendiumStore.clearMessages();
    this.editingItemId.set(item.id);
    const visuals = resolveCompendiumItemVisuals(item);
    this.itemForm = {
      name: item.name,
      subcategory: item.subcategory || 'Adventuring Gear',
      default_quantity: Math.max(1, item.default_quantity ?? 1),
      stackable: item.stackable !== false,
      description: item.description || '',
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };
    this.itemModalOpen.set(true);
  }

  closeItemModal(): void {
    this.itemModalOpen.set(false);
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeItemModal();
    }
  }

  async saveItem(): Promise<void> {
    const editId = this.editingItemId();
    const existing = editId
      ? this.compendiumStore.items().find((i) => i.id === editId)
      : null;

    const compiledHooks: Record<string, unknown> = {
      ...(existing?.rule_hooks ?? {}),
      __icon: this.itemForm.icon,
      __icon_color: this.itemForm.icon_color,
      __icon_tint_custom: this.itemForm.icon_tint_custom,
    };

    const payload: Omit<CompendiumItemModel, 'id' | 'slug'> = {
      name: this.itemForm.name,
      subcategory: this.itemForm.subcategory || 'Adventuring Gear',
      default_quantity: Math.max(
        1,
        Math.round(Number(this.itemForm.default_quantity) || 1)
      ),
      stackable: Boolean(this.itemForm.stackable),
      description: this.itemForm.description,
      rule_hooks: compiledHooks,
    };

    if (editId) {
      const ok = await this.compendiumStore.updateCompendiumItem(editId, payload);
      if (ok) {
        this.selectedItemId.set(editId);
        this.closeItemModal();
      }
      return;
    }

    const created = await this.compendiumStore.createCompendiumItem(payload);
    if (created) {
      this.selectedItemId.set(created.id);
      this.closeItemModal();
    }
  }
}
