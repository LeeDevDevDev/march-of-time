import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeywordDefinition } from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { KeywordTextComponent } from '../../../../shared/keyword-text/keyword-text.component';
import { KeywordTextareaComponent } from '../../../../shared/keyword-text/keyword-textarea.component';

@Component({
  selector: 'app-keywords-manager',
  standalone: true,
  imports: [FormsModule, KeywordTextComponent, KeywordTextareaComponent],
  templateUrl: './keywords-manager.component.html',
})
export class KeywordsManagerComponent {
  readonly compendiumStore = inject(CompendiumStore);

  readonly showCatalog = input<boolean>(true);
  readonly deleteKeyword = output<KeywordDefinition>();

  readonly keywordSearch = signal('');

  readonly filteredKeywords = computed(() => {
    const q = this.keywordSearch().trim().toLowerCase();
    const list = this.compendiumStore.keywords();
    if (!q) return list;
    return list.filter(
      (kw) =>
        kw.term.toLowerCase().includes(q) ||
        kw.category.toLowerCase().includes(q) ||
        kw.summary.toLowerCase().includes(q)
    );
  });

  readonly keywordModalOpen = signal(false);
  readonly editingKeywordId = signal<string | null>(null);
  keywordFormTerm = '';
  keywordFormCategory = 'Combat Status';
  keywordFormSummary = '';

  openNewKeywordModal(prefillTerm = ''): void {
    this.editingKeywordId.set(null);
    this.keywordFormTerm = prefillTerm.trim();
    this.keywordFormCategory = 'Combat Status';
    this.keywordFormSummary = '';
    this.keywordModalOpen.set(true);
  }

  openEditKeywordModal(kw: KeywordDefinition): void {
    this.editingKeywordId.set(kw.id ?? kw.term);
    this.keywordFormTerm = kw.term;
    this.keywordFormCategory = kw.category;
    this.keywordFormSummary = kw.summary;
    this.keywordModalOpen.set(true);
  }

  closeKeywordModal(): void {
    this.keywordModalOpen.set(false);
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeKeywordModal();
    }
  }

  async saveKeyword(): Promise<void> {
    const editId = this.editingKeywordId();
    if (editId) {
      const ok = await this.compendiumStore.updateKeyword(editId, {
        term: this.keywordFormTerm,
        category: this.keywordFormCategory,
        summary: this.keywordFormSummary,
      });
      if (ok) this.closeKeywordModal();
    } else {
      const created = await this.compendiumStore.createKeyword({
        term: this.keywordFormTerm,
        category: this.keywordFormCategory,
        summary: this.keywordFormSummary,
      });
      if (created) {
        this.closeKeywordModal();
      }
    }
  }
}
