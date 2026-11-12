import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
} from '@angular/core';
import {
  DescriptionSegment,
  KeywordDefinition,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import {
  KeywordTooltipPlacement,
  KeywordTooltipService,
} from './keyword-tooltip.service';

@Component({
  selector: 'app-keyword-text',
  standalone: true,
  templateUrl: './keyword-text.component.html',
})
export class KeywordTextComponent {
  readonly compendiumStore = inject(CompendiumStore);
  readonly keywordTooltip = inject(KeywordTooltipService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly text = input.required<string>();
  readonly excludeTerm = input<string>('');
  readonly showHintWhenIdle = input<boolean>(true);
  readonly placement = input<KeywordTooltipPlacement>('auto');
  readonly tone = input<'adaptive' | 'dark'>('adaptive');

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

  constructor() {
    void this.compendiumStore.ensureLoaded();
    inject(DestroyRef).onDestroy(() => {
      this.keywordTooltip.hideIfContainedIn(this.hostRef.nativeElement);
    });
  }

  showKeyword(kw: KeywordDefinition, target: EventTarget | null): void {
    this.keywordTooltip.show(kw, target, this.placement());
  }

  hideKeyword(target: EventTarget | null): void {
    this.keywordTooltip.hide(target);
  }
}
