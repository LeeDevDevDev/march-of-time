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
  template: `
    <div class="relative">
      <!-- Primary Text with Hoverable Special Words (Brackets Stripped) -->
      <p class="text-xs leading-relaxed text-[var(--mot-text)]">
        @for (seg of segments(); track $index) {
          @if (seg.keyword; as kw) {
            <span
              tabindex="0"
              (mouseenter)="hoveredKeyword.set(kw)"
              (mouseleave)="hoveredKeyword.set(null)"
              (focus)="hoveredKeyword.set(kw)"
              (blur)="hoveredKeyword.set(null)"
              class="inline cursor-help rounded px-1 py-0.5 font-bold text-[var(--mot-accent-text)] underline decoration-dotted underline-offset-4 transition-colors hover:bg-[#122220] hover:text-[#FF8C5A]"
              [class.bg-[#122220]]="hoveredKeyword()?.term === kw.term"
              [class.text-[#FF8C5A]]="hoveredKeyword()?.term === kw.term"
            >{{ seg.text }}</span>
          } @else {
            <span>{{ seg.text }}</span>
          }
        }
      </p>

      @if (showHintWhenIdle() && hasAnyKeywords()) {
        <p class="mt-2.5 border-t border-[var(--mot-border)] pt-2 text-[11px] text-[var(--mot-muted)]">
          Hover any <span class="font-bold text-[var(--mot-accent-text)] underline decoration-dotted">underlined word</span> above to inspect its rule &amp; chained keywords.
        </p>
      }

      <!-- Floating Slay-the-Spire Chained Keyword Overlay (Zero Layout Shift + pointer-events-none) -->
      @if (hoveredKeyword(); as rootKw) {
        <div
          class="pointer-events-none absolute left-0 z-50 w-full min-w-[260px] max-w-md space-y-1.5 rounded-xl border border-[#C4491A] bg-[#0D1615] p-3 text-[#EBF5F3] shadow-2xl"
          [class.bottom-full]="placement() === 'top'"
          [class.mb-2]="placement() === 'top'"
          [class.top-full]="placement() !== 'top'"
          [class.mt-2]="placement() !== 'top'"
        >
          <!-- Primary Hovered Keyword Card -->
          <div class="rounded-lg border border-[#243B37] bg-[#122220] p-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-display text-xs font-bold text-[#FF8C5A]">
                {{ rootKw.term }}
              </span>
              <span
                class="rounded border border-[#243B37] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-[10px] font-semibold text-[#8AB0AB]"
              >
                {{ rootKw.category }}
              </span>
            </div>
            <p class="mt-1 text-xs leading-relaxed text-[#EBF5F3]">
              @for (subSeg of tokenizeSummary(rootKw); track $index) {
                @if (subSeg.keyword) {
                  <span class="font-bold text-[#FF8C5A] underline decoration-dotted underline-offset-2">
                    {{ subSeg.text }}
                  </span>
                } @else {
                  <span>{{ subSeg.text }}</span>
                }
              }
            </p>
          </div>

          <!-- Automatically Chained Keywords Referenced Inside the Primary Keyword -->
          @if (chainedKeywords().length > 0) {
            <div class="space-y-1.5 border-l-2 border-[#C4491A]/70 pl-2.5 pt-0.5">
              <p class="font-mono-num text-[10px] font-bold uppercase tracking-wider text-[#8AB0AB]">
                Chained Keywords ({{ chainedKeywords().length }})
              </p>
              @for (chainedKw of chainedKeywords(); track chainedKw.term) {
                <div
                  class="rounded-lg border border-[#243B37] bg-[#122220]/90 p-2 text-[#EBF5F3]"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-display text-xs font-bold text-[#FF8C5A]">
                      ↳ {{ chainedKw.term }}
                    </span>
                    <span
                      class="rounded border border-[#243B37] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-[10px] text-[#8AB0AB]"
                    >
                      {{ chainedKw.category }}
                    </span>
                  </div>
                  <p class="mt-1 text-[11px] leading-relaxed text-[#C6DCD9]">
                    {{ stripBrackets(chainedKw.summary) }}
                  </p>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
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
