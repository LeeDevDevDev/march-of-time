import { Component, computed, inject, input, signal } from '@angular/core';
import {
  DescriptionSegment,
  KeywordDefinition,
  resolveChainedKeywords,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';

@Component({
  selector: 'app-keyword-text',
  standalone: true,
  templateUrl: './keyword-text.component.html',
})
export class KeywordTextComponent {
  readonly compendiumStore = inject(CompendiumStore);

  readonly text = input.required<string>();
  readonly excludeTerm = input<string>('');
  readonly showHintWhenIdle = input<boolean>(true);
  readonly placement = input<'top' | 'bottom'>('bottom');

  readonly hoveredKeyword = signal<KeywordDefinition | null>(null);

  readonly activeKeywordsList = computed(() => {
    const excluded = this.excludeTerm().trim().toLowerCase();
    const all = this.compendiumStore.keywords();
    if (!excluded) return all;
    return all.filter((kw) => kw.term.trim().toLowerCase() !== excluded);
  });

  readonly segments = computed<DescriptionSegment[]>(() =>
    tokenizeTextWithKeywords(this.text(), this.activeKeywordsList())
  );

  readonly hasAnyKeywords = computed(() =>
    this.segments().some((s) => s.keyword !== null)
  );

  readonly chainedKeywords = computed<KeywordDefinition[]>(() =>
    resolveChainedKeywords(this.hoveredKeyword(), this.compendiumStore.keywords())
  );

  tokenizeSummary(kw: KeywordDefinition): DescriptionSegment[] {
    const others = this.compendiumStore
      .keywords()
      .filter((item) => item.term.trim().toLowerCase() !== kw.term.trim().toLowerCase());
    return tokenizeTextWithKeywords(kw.summary, others);
  }

  stripBrackets(raw: string): string {
    return (raw ?? '').replace(/\[([^\]]+)\]/g, '$1');
  }
}
