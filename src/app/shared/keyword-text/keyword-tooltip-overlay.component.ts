import {
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { KeywordTooltipService } from './keyword-tooltip.service';

@Component({
  selector: 'app-keyword-tooltip-overlay',
  standalone: true,
  template: `
    @if (tooltipService.state(); as active) {
      <div
        #tooltipCard
        role="tooltip"
        (mouseenter)="tooltipService.onTooltipMouseEnter()"
        (mouseleave)="tooltipService.onTooltipMouseLeave()"
        class="mot-float mot-scroll-gutter pointer-events-auto fixed z-[9999] overflow-y-auto overscroll-contain space-y-1.5 rounded-xl border border-[#C4491A] bg-[#0D1615] p-3 text-[#EBF5F3]"
        [style.left.px]="active.position.left"
        [style.width.px]="active.position.width"
        [style.top.px]="active.position.top"
        [style.bottom.px]="active.position.bottom"
        [style.max-height.px]="active.position.maxHeight"
      >
        <div class="rounded-lg border border-[#243B37] bg-[#122220] p-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="font-display text-xs font-bold text-[#FF8C5A]">
              {{ active.keyword.term }}
            </span>
            <span
              class="rounded border border-[#243B37] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-xs font-semibold text-[#8AB0AB]"
            >
              {{ active.keyword.category }}
            </span>
          </div>
          <p class="mt-1 text-xs leading-relaxed text-[#EBF5F3]">
            @for (subSeg of tooltipService.tokenizedSummary(); track $index) {
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

        @if (tooltipService.chainedKeywords().length > 0) {
          <div class="space-y-1.5 border-l-2 border-[#C4491A]/70 pl-2.5 pt-0.5">
            <p class="font-mono-num text-xs font-semibold text-[#8AB0AB] tabular-nums">
              Referenced Rules ({{ tooltipService.chainedKeywords().length }})
            </p>
            @for (chainedKw of tooltipService.chainedKeywords(); track chainedKw.term) {
              <div
                class="rounded-lg border border-[#243B37] bg-[#122220]/90 p-2 text-[#EBF5F3]"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-display text-xs font-bold text-[#FF8C5A]">
                    ↳ {{ chainedKw.term }}
                  </span>
                  <span
                    class="rounded border border-[#243B37] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-xs text-[#8AB0AB]"
                  >
                    {{ chainedKw.category }}
                  </span>
                </div>
                <p class="mt-1 text-xs leading-relaxed text-[#C6DCD9]">
                  {{ stripBrackets(chainedKw.summary) }}
                </p>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class KeywordTooltipOverlayComponent {
  readonly tooltipService = inject(KeywordTooltipService);
  readonly tooltipCard = viewChild<ElementRef<HTMLElement>>('tooltipCard');

  constructor() {
    effect(() => {
      const active = this.tooltipService.state();
      const el = this.tooltipCard()?.nativeElement ?? null;
      this.tooltipService.registerTooltipElement(el);
      if (active && el) {
        queueMicrotask(() => {
          if (el.isConnected) {
            this.tooltipService.updateMeasuredHeight(el.scrollHeight);
          }
        });
      }
    });
  }

  stripBrackets(raw: string): string {
    return (raw ?? '').replace(/\[([^\]]+)\]/g, '$1');
  }
}
