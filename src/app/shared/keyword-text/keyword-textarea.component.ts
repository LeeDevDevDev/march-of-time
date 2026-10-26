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
  template: `
    <div class="relative">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label [for]="inputId()" class="block text-xs font-bold text-[var(--mot-text)]">
          {{ label() }}
        </label>
        <div class="flex items-center gap-2">
          <span class="font-mono-num text-[11px] text-[var(--mot-muted)]">
            Tip: Type <strong>[</strong> to chain &amp; insert special words
          </span>
          @if (showNewWordButton()) {
            <button
              type="button"
              (click)="requestCreateKeyword.emit('')"
              class="text-xs font-bold text-[var(--mot-accent-text)] hover:underline"
            >
              + New Word
            </button>
          }
        </div>
      </div>

      <textarea
        #textareaEl
        [id]="inputId()"
        [rows]="rows()"
        [required]="required()"
        [ngModel]="value()"
        (ngModelChange)="onTextChange($event, textareaEl)"
        (keyup)="onCursorActivity(textareaEl, $event)"
        (click)="onCursorActivity(textareaEl)"
        (keydown)="onKeydown($event, textareaEl)"
        [placeholder]="placeholder()"
        class="mot-input mt-1.5 px-3.5 py-2.5 text-sm"
      ></textarea>

      <!-- [ Triggered Special Word Search & Autocomplete Popover -->
      @if (bracketMenuOpen()) {
        <div
          class="mt-1.5 overflow-hidden rounded-xl border border-[#C4491A] bg-[#122220] text-[#EBF5F3]"
        >
          <div
            class="flex items-center justify-between border-b border-[#243B37] bg-[#0D1615] px-3 py-1.5 text-[11px] text-[#8AB0AB]"
          >
            <span>
              Matching Special Words
              @if (bracketQuery()) {
                for <strong class="text-[#FF8C5A]">"{{ bracketQuery() }}"</strong>
              }
            </span>
            <span class="font-mono-num">↑↓ Navigate · Enter Insert · Esc Close</span>
          </div>

          @if (matchingBracketKeywords().length === 0) {
            <div class="flex items-center justify-between px-3.5 py-2.5 text-xs text-[#8AB0AB]">
              <span>No special word matches "{{ bracketQuery() }}".</span>
              @if (showNewWordButton()) {
                <button
                  type="button"
                  (click)="onRequestCreateFromMenu()"
                  class="btn-copper rounded px-2.5 py-1 text-xs font-semibold"
                >
                  + Create "{{ bracketQuery() }}"
                </button>
              }
            </div>
          } @else {
            <div class="max-h-48 overflow-y-auto divide-y divide-[#243B37]/60">
              @for (kw of matchingBracketKeywords(); track kw.term; let i = $index) {
                <button
                  type="button"
                  (click)="insertKeywordFromMenu(kw, textareaEl)"
                  class="flex w-full items-start justify-between gap-3 px-3.5 py-2 text-left text-xs transition-colors"
                  [class.bg-[#C4491A]]="i === bracketSelectedIndex()"
                  [class.text-white]="i === bracketSelectedIndex()"
                  [class.hover:bg-[#0D1615]]="i !== bracketSelectedIndex()"
                >
                  <div>
                    <span class="font-display font-bold">
                      {{ kw.term }}
                    </span>
                    <p
                      class="mt-0.5 line-clamp-1 text-[11px]"
                      [class.text-white]="i === bracketSelectedIndex()"
                      [class.text-[#8AB0AB]]="i !== bracketSelectedIndex()"
                    >
                      {{ kw.summary }}
                    </p>
                  </div>
                  <span
                    class="shrink-0 rounded border border-[#243B37] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-[10px] text-[#FF8C5A]"
                  >
                    {{ kw.category }}
                  </span>
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Quick-Insert Special Word Chips -->
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] font-semibold text-[var(--mot-muted)]">
          Quick Insert:
        </span>
        @for (kw of quickInsertKeywords(); track kw.term) {
          <button
            type="button"
            (click)="appendKeywordChip(kw, textareaEl)"
            class="rounded border border-[var(--mot-border)] bg-[var(--mot-well)] px-2 py-0.5 font-mono-num text-[11px] font-semibold text-[var(--mot-text)] hover:border-[#C4491A]"
          >
            [{{ kw.term }}]
          </button>
        }
      </div>
    </div>
  `,
})
export class KeywordTextareaComponent {
  readonly compendiumStore = inject(CompendiumStore);

  @ViewChild('textareaEl') textareaEl?: ElementRef<HTMLTextAreaElement>;

  readonly inputId = input<string>('motKeywordTextarea');
  readonly label = input<string>('Rules Description');
  readonly value = input<string>('');
  readonly placeholder = input<string>(
    'Type [ to search special words (e.g. [Crushing], [Parry], [Sundered])...'
  );
  readonly rows = input<number>(3);
  readonly required = input<boolean>(true);
  readonly excludeTerm = input<string>('');
  readonly showNewWordButton = input<boolean>(true);

  readonly valueChange = output<string>();
  readonly requestCreateKeyword = output<string>();

  readonly bracketMenuOpen = signal(false);
  readonly bracketQuery = signal('');
  readonly bracketStartIndex = signal<number>(-1);
  readonly bracketSelectedIndex = signal<number>(0);

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
