import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
   output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeywordDefinition } from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';

@Component({
  selector: 'app-keyword-textarea',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './keyword-textarea.component.html',
})
export class KeywordTextareaComponent {
  readonly compendiumStore = inject(CompendiumStore);

  @ViewChild('textareaEl') textareaEl?: ElementRef<HTMLTextAreaElement>;

  readonly inputId = input<string>('motKeywordTextarea');
  readonly label = input<string>('Rules Description');
  readonly value = input<string>('');
  readonly placeholder = input<string>('Description');
  readonly rows = input<number>(3);
  readonly required = input<boolean>(true);
  readonly excludeTerm = input<string>('');
  readonly showNewKeywordButton = input<boolean>(true);

  readonly valueChange = output<string>();
  readonly requestCreateKeyword = output<string>();

  readonly bracketMenuOpen = signal(false);
  readonly bracketQuery = signal('');
  readonly bracketStartIndex = signal<number>(-1);
  readonly bracketSelectedIndex = signal<number>(0);

  constructor() {
    void this.compendiumStore.ensureLoaded();
  }

  readonly availableKeywords = computed(() => {
    const excluded = this.excludeTerm().trim().toLowerCase();
    return this.compendiumStore
      .keywords()
      .filter((kw) => !excluded || kw.term.trim().toLowerCase() !== excluded);
  });

  readonly quickInsertKeywords = computed(() => this.availableKeywords().slice(0, 8));

  readonly matchingBracketKeywords = computed(() => {
    const q = this.bracketQuery().trim().toLowerCase();
    const all = this.availableKeywords();
    if (!q) return all;
    return all.filter(
      (kw) =>
        kw.term.toLowerCase().includes(q) ||
        kw.category.toLowerCase().includes(q) ||
        kw.summary.toLowerCase().includes(q)
    );
  });

  onTextChange(newVal: string, textarea: HTMLTextAreaElement): void {
    this.valueChange.emit(newVal);
    this.detectBracketTrigger(newVal, textarea.selectionStart ?? newVal.length);
  }

  onCursorActivity(textarea: HTMLTextAreaElement, event?: KeyboardEvent): void {
    if (
      event &&
      (event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === 'Escape')
    ) {
      return;
    }
    const text = textarea.value ?? '';
    this.detectBracketTrigger(text, textarea.selectionStart ?? text.length);
  }

  onKeydown(event: KeyboardEvent, textarea: HTMLTextAreaElement): void {
    if (!this.bracketMenuOpen()) return;

    const matches = this.matchingBracketKeywords();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (matches.length > 0) {
        this.bracketSelectedIndex.update((i) => (i + 1) % matches.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (matches.length > 0) {
        this.bracketSelectedIndex.update((i) => (i - 1 + matches.length) % matches.length);
      }
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      if (matches.length > 0) {
        event.preventDefault();
        const chosen = matches[this.bracketSelectedIndex()] ?? matches[0];
        this.insertKeywordFromMenu(chosen, textarea);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.bracketMenuOpen.set(false);
    }
  }

  private detectBracketTrigger(text: string, cursorPos: number): void {
    const beforeCursor = text.slice(0, cursorPos);
    const lastOpen = beforeCursor.lastIndexOf('[');
    const lastClose = beforeCursor.lastIndexOf(']');

    if (lastOpen !== -1 && lastOpen > lastClose) {
      const query = beforeCursor.slice(lastOpen + 1);
      if (!query.includes('\n') && query.length <= 28) {
        this.bracketStartIndex.set(lastOpen);
        this.bracketQuery.set(query);
        this.bracketSelectedIndex.set(0);
        this.bracketMenuOpen.set(true);
        return;
      }
    }

    this.bracketMenuOpen.set(false);
  }

  insertKeywordFromMenu(kw: KeywordDefinition, textarea: HTMLTextAreaElement): void {
    const text = this.value() || '';
    const startIdx = this.bracketStartIndex();
    const cursorPos = textarea.selectionStart ?? text.length;

    if (startIdx === -1) {
      this.appendKeywordChip(kw, textarea);
      return;
    }

    const before = text.slice(0, startIdx);
    const after = text.slice(cursorPos);
    const inserted = `[${kw.term}]`;
    const nextValue = `${before}${inserted}${after}`;

    this.valueChange.emit(nextValue);
    this.bracketMenuOpen.set(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  appendKeywordChip(kw: KeywordDefinition, textarea: HTMLTextAreaElement): void {
    const current = this.value() || '';
    const cursorPos = textarea.selectionStart ?? current.length;
    const before = current.slice(0, cursorPos);
    const after = current.slice(cursorPos);
    const needsSpace = before.length > 0 && !before.endsWith(' ');
    const inserted = `${needsSpace ? ' ' : ''}[${kw.term}]`;
    const nextValue = `${before}${inserted}${after}`;

    this.valueChange.emit(nextValue);
    this.bracketMenuOpen.set(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  onRequestCreateFromMenu(): void {
    const q = this.bracketQuery();
    this.bracketMenuOpen.set(false);
    this.requestCreateKeyword.emit(q);
  }
}
