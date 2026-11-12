import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DescriptionSegment,
  KeywordDefinition,
  buildKeywordLookupMap,
  resolveChainedKeywords,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';

export type KeywordTooltipPlacement = 'auto' | 'top' | 'bottom';

export interface KeywordTooltipPosition {
  left: number;
  width: number;
  top: number | null;
  bottom: number | null;
  maxHeight: number;
  resolvedPlacement: 'top' | 'bottom';
}

export interface ActiveKeywordTooltipState {
  keyword: KeywordDefinition;
  anchor: HTMLElement;
  position: KeywordTooltipPosition;
  preferredPlacement: KeywordTooltipPlacement;
  requiredHeight: number;
}

export function computeKeywordTooltipPosition(
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
  viewportWidth: number,
  viewportHeight: number,
  preferredPlacement: KeywordTooltipPlacement = 'auto',
  requiredHeight = 240
): KeywordTooltipPosition {
  const viewportMargin = 12;
  const anchorGap = 8;
  const maxWidth = 420;

  const width = Math.max(
    200,
    Math.min(maxWidth, viewportWidth - viewportMargin * 2)
  );
  const maxLeft = Math.max(
    viewportMargin,
    viewportWidth - width - viewportMargin
  );
  const left = Math.round(
    Math.min(Math.max(viewportMargin, anchorRect.left), maxLeft)
  );

  const spaceBelow =
    viewportHeight - anchorRect.bottom - viewportMargin - anchorGap;
  const spaceAbove = anchorRect.top - viewportMargin - anchorGap;

  let placeAbove: boolean;
  if (preferredPlacement === 'top') {
    placeAbove = spaceAbove >= requiredHeight || spaceAbove >= spaceBelow;
  } else if (spaceBelow >= requiredHeight) {
    placeAbove = false;
  } else if (spaceAbove >= requiredHeight) {
    placeAbove = true;
  } else {
    placeAbove = spaceAbove > spaceBelow;
  }

  if (placeAbove) {
    return {
      left,
      width,
      top: null,
      bottom: Math.round(viewportHeight - anchorRect.top + anchorGap),
      maxHeight: Math.max(120, Math.floor(spaceAbove)),
      resolvedPlacement: 'top',
    };
  }

  return {
    left,
    width,
    top: Math.round(anchorRect.bottom + anchorGap),
    bottom: null,
    maxHeight: Math.max(120, Math.floor(spaceBelow)),
    resolvedPlacement: 'bottom',
  };
}

@Injectable({ providedIn: 'root' })
export class KeywordTooltipService {
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly activeState = signal<ActiveKeywordTooltipState | null>(null);

  private isAnchorHovered = false;
  private isTooltipHovered = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipEl: HTMLElement | null = null;

  readonly state = this.activeState.asReadonly();
  readonly activeKeyword = computed(() => this.activeState()?.keyword ?? null);
  readonly activeAnchor = computed(() => this.activeState()?.anchor ?? null);

  readonly chainedKeywords = computed<KeywordDefinition[]>(() =>
    resolveChainedKeywords(this.activeKeyword(), this.compendiumStore.keywords())
  );

  readonly tokenizedSummary = computed<DescriptionSegment[]>(() => {
    const kw = this.activeKeyword();
    if (!kw) return [];
    const others = this.compendiumStore
      .keywords()
      .filter(
        (item) =>
          item.term.trim().toLowerCase() !== kw.term.trim().toLowerCase()
      );
    return tokenizeTextWithKeywords(kw.summary, others);
  });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'scroll',
        (event: Event) => {
          const current = this.activeState();
          if (!current) return;

          if (
            this.tooltipEl &&
            event.target instanceof Node &&
            (event.target === this.tooltipEl ||
              this.tooltipEl.contains(event.target))
          ) {
            return;
          }

          if (this.isTooltipHovered) {
            return;
          }

          if (
            current.anchor.isConnected &&
            typeof document !== 'undefined' &&
            document.activeElement === current.anchor
          ) {
            const rect = current.anchor.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
              this.hideImmediately();
              return;
            }
            this.activeState.set({
              ...current,
              position: computeKeywordTooltipPosition(
                rect,
                window.innerWidth,
                window.innerHeight,
                current.preferredPlacement,
                current.requiredHeight
              ),
            });
            return;
          }

          this.hideImmediately();
        },
        { capture: true, passive: true }
      );

      window.addEventListener(
        'wheel',
        (event: WheelEvent) => {
          if (
            !this.isAnchorHovered ||
            !this.tooltipEl ||
            !this.activeState()
          ) {
            return;
          }
          const el = this.tooltipEl;
          if (el.scrollHeight <= el.clientHeight + 2) {
            return;
          }
          const canScrollDown =
            event.deltaY > 0 &&
            el.scrollTop + el.clientHeight < el.scrollHeight - 1;
          const canScrollUp = event.deltaY < 0 && el.scrollTop > 0;
          if (canScrollDown || canScrollUp) {
            event.preventDefault();
            el.scrollTop += event.deltaY;
          }
        },
        { passive: false }
      );

      window.addEventListener(
        'resize',
        () => {
          if (this.activeState()) {
            this.hideImmediately();
          }
        },
        { passive: true }
      );
    }
  }

  registerTooltipElement(el: HTMLElement | null): void {
    this.tooltipEl = el;
  }

  updateMeasuredHeight(measuredHeight: number): void {
    const current = this.activeState();
    if (!current || !current.anchor.isConnected || measuredHeight <= 0) return;
    if (Math.abs(measuredHeight - current.requiredHeight) < 8) return;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const rect = current.anchor.getBoundingClientRect();
    const nextPosition = computeKeywordTooltipPosition(
      rect,
      vw,
      vh,
      current.preferredPlacement,
      measuredHeight
    );

    if (nextPosition.resolvedPlacement !== current.position.resolvedPlacement) {
      this.activeState.set({
        ...current,
        requiredHeight: measuredHeight,
        position: nextPosition,
      });
    }
  }

  show(
    keyword: KeywordDefinition,
    anchor: HTMLElement | EventTarget | null,
    preferredPlacement: KeywordTooltipPlacement = 'auto'
  ): void {
    if (!(anchor instanceof HTMLElement)) return;
    this.clearHideTimer();
    this.isAnchorHovered = true;
    this.isTooltipHovered = false;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const rect = anchor.getBoundingClientRect();
    const requiredHeight = this.estimateTooltipHeight(keyword);

    this.activeState.set({
      keyword,
      anchor,
      preferredPlacement,
      requiredHeight,
      position: computeKeywordTooltipPosition(
        rect,
        vw,
        vh,
        preferredPlacement,
        requiredHeight
      ),
    });
  }

  showByTerm(
    term: string,
    anchor: HTMLElement | EventTarget | null,
    preferredPlacement: KeywordTooltipPlacement = 'auto'
  ): void {
    if (!term) return;
    const map = buildKeywordLookupMap(this.compendiumStore.keywords());
    const found = map.get(term.trim().toLowerCase());
    if (found) {
      this.show(found, anchor, preferredPlacement);
    }
  }

  hide(anchor?: HTMLElement | EventTarget | null): void {
    const current = this.activeState();
    if (!current) return;
    if (anchor instanceof HTMLElement && current.anchor !== anchor) {
      return;
    }
    this.isAnchorHovered = false;
    this.scheduleHide(150);
  }

  onTooltipMouseEnter(): void {
    this.clearHideTimer();
    this.isTooltipHovered = true;
  }

  onTooltipMouseLeave(): void {
    this.isTooltipHovered = false;
    this.scheduleHide(120);
  }

  hideImmediately(): void {
    this.clearHideTimer();
    this.isAnchorHovered = false;
    this.isTooltipHovered = false;
    this.activeState.set(null);
  }

  hideIfContainedIn(container: HTMLElement | null | undefined): void {
    const current = this.activeState();
    if (!current || !container) return;
    if (container === current.anchor || container.contains(current.anchor)) {
      this.hideImmediately();
    }
  }

  private estimateTooltipHeight(keyword: KeywordDefinition): number {
    const chained = resolveChainedKeywords(
      keyword,
      this.compendiumStore.keywords()
    );
    const baseLines = Math.max(2, Math.ceil((keyword.summary?.length ?? 60) / 52));
    const baseHeight = 66 + baseLines * 18;
    if (chained.length === 0) {
      return baseHeight + 24;
    }
    const chainedHeight = chained.reduce((sum, item) => {
      const lines = Math.max(1, Math.ceil((item.summary?.length ?? 50) / 52));
      return sum + 48 + lines * 17;
    }, 28);
    return baseHeight + chainedHeight + 28;
  }

  private scheduleHide(delayMs: number): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.isAnchorHovered && !this.isTooltipHovered) {
        this.activeState.set(null);
      }
    }, delayMs);
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
