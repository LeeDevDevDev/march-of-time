import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  DescriptionSegment,
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeBranchNode,
  SkillTreeModel,
  buildKeywordLookupMap,
  buildSkillTreeHierarchy,
  formatRuleHookBadges,
  resolveChainedKeywords,
  tokenizeTextWithKeywords,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';

@Component({
  selector: 'app-skill-tree-canvas',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-[#243B37] bg-[#0D1615] text-[#EBF5F3] lg:h-[75vh] lg:min-h-[680px] lg:flex-row"
    >
      <!-- ================================================================= -->
      <!-- LEFT / MAIN: EXPANSIVE DRAGGABLE 2D SKILL TREE CANVAS (flex-1)    -->
      <!-- ================================================================= -->
      <div
        class="relative h-[580px] flex-1 select-none overflow-hidden border-b border-[#243B37] lg:h-full lg:border-b-0 lg:border-r"
        [class.cursor-grab]="!isDragging()"
        [class.cursor-grabbing]="isDragging()"
        style="background-image: radial-gradient(#243B37 1.25px, transparent 1.25px); background-size: 26px 26px;"
        (pointerdown)="onCanvasPointerDown($event)"
        (pointermove)="onCanvasPointerMove($event)"
        (pointerup)="onCanvasPointerUp()"
        (pointercancel)="onCanvasPointerUp()"
        (mouseleave)="onCanvasPointerUp()"
        (wheel)="onCanvasWheel($event)"
      >
        <!-- Top-Left Canvas HUD: Tree Title & Pan Hint -->
        <div
          class="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-xl border border-[#243B37] bg-[#122220]/90 px-3.5 py-2 backdrop-blur-sm"
        >
          <div class="flex items-center gap-2">
            <span class="font-display text-sm font-bold text-white">
              {{ tree.name }}
            </span>
            <span
              class="rounded bg-[#0D1615] px-2 py-0.5 font-mono-num text-[11px] font-bold text-[#FF8C5A]"
            >
              {{ treeNodes().length }} {{ treeNodes().length === 1 ? 'Node' : 'Nodes' }}
            </span>
          </div>
          <span class="text-[11px] text-[#8AB0AB]">
            Drag background to pan · Scroll to zoom · Click any node icon to inspect
          </span>
        </div>

        <!-- Top-Right Canvas HUD: Zoom & Recenter Controls -->
        <div
          class="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-xl border border-[#243B37] bg-[#122220]/95 p-1 backdrop-blur-sm"
          (pointerdown)="$event.stopPropagation()"
        >
          <button
            type="button"
            (click)="adjustZoom(-0.15)"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-[#EBF5F3] hover:bg-[#0D1615] hover:text-[#FF8C5A]"
            title="Zoom Out"
          >
            −
          </button>
          <span class="px-1.5 font-mono-num text-xs font-bold text-[#8AB0AB] tabular-nums">
            {{ Math.round(zoom() * 100) }}%
          </span>
          <button
            type="button"
            (click)="adjustZoom(0.15)"
            class="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-[#EBF5F3] hover:bg-[#0D1615] hover:text-[#FF8C5A]"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            (click)="resetCamera()"
            class="ml-1 rounded-lg border border-[#243B37] bg-[#0D1615] px-2.5 py-1 text-xs font-semibold text-[#EBF5F3] hover:border-[#C4491A]"
          >
            Recenter
          </button>
        </div>

        <!-- Bottom-Left Legend Pill -->
        <div
          class="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-[#243B37] bg-[#122220]/90 px-3.5 py-2 text-xs text-[#8AB0AB] backdrop-blur-sm"
        >
          <span class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded bg-[#C4491A]"></span>
            <strong class="text-white">Combat Art</strong>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-full border border-[#38B29A] bg-[#0D1615]"></span>
            <strong class="text-white">Passive</strong>
          </span>
        </div>

        <!-- Empty State inside Canvas -->
        @if (branches().length === 0) {
          <div class="flex h-full items-center justify-center p-6">
            <div
              class="max-w-sm rounded-2xl border border-dashed border-[#243B37] bg-[#122220]/95 p-6 text-center"
              (pointerdown)="$event.stopPropagation()"
            >
              <h3 class="font-display text-base font-bold text-white">
                No Nodes in {{ tree.name }} Yet
              </h3>
              <p class="mt-1 text-xs text-[#8AB0AB]">
                Place your first Tier 1 Combat Art or Passive Upgrade to start building this tree.
              </p>
              @if (mode === 'admin') {
                <button
                  type="button"
                  (click)="addRootNode.emit()"
                  class="btn-copper mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
                >
                  + Add Tier 1 Root Node
                </button>
              }
            </div>
          </div>
        } @else {
          <!-- Pannable & Zoomable Transform Layer -->
          <div
            class="flex h-full w-full items-start justify-center pt-28 transition-transform duration-75 ease-out"
            [style.transform]="
              'translate3d(' + panX() + 'px, ' + panY() + 'px, 0) scale(' + zoom() + ')'
            "
            style="transform-origin: center top;"
          >
            <div class="flex items-start gap-16">
              @for (rootBranch of branches(); track rootBranch.node.id) {
                <ng-container
                  *ngTemplateOutlet="medallionBranchTpl; context: { $implicit: rootBranch }"
                ></ng-container>
              }
            </div>
          </div>
        }

        <!-- Recursive Icon-Medallion Tree Template -->
        <ng-template #medallionBranchTpl let-branch>
          <div class="flex flex-col items-center">
            <!-- Icon Medallion Button + Name Label -->
            <button
              type="button"
              (click)="onNodeClick($event, branch.node)"
              class="group relative flex w-40 flex-col items-center text-center focus:outline-none"
            >
              <!-- Medallion Shape: Square-Chamfered for Combat Art, Circular for Passive -->
              <div
                class="relative flex items-center justify-center transition-all duration-150"
                [class]="getMedallionClasses(branch.node)"
              >
                <!-- Tier Badge (Top-Left Corner) -->
                <span
                  class="absolute -left-2 -top-2 rounded border border-[#243B37] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#8AB0AB]"
                >
                  T{{ branch.node.tier }}
                </span>

                <!-- Unlocked Checkmark or AP Pill (Top-Right Corner) -->
                @if (mode === 'character' && isUnlocked(branch.node.id)) {
                  <span
                    class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#C4491A] text-[10px] font-bold text-white"
                  >
                    ✓
                  </span>
                } @else if (branch.node.node_type === 'combat_art') {
                  <span
                    class="absolute -right-2.5 -top-2 rounded border border-[#C4491A] bg-[#0D1615] px-1.5 py-0.5 font-mono-num text-[10px] font-bold text-[#FF8C5A]"
                  >
                    {{ branch.node.ap_cost ?? 1 }}AP
                  </span>
                }

                <!-- Inner SVG Icon based on Node Type & Tag -->
                @if (branch.node.node_type === 'combat_art') {
                  @switch (branch.node.combat_tag) {
                    @case ('Crushing') {
                      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                        <path d="M14.5 3.5L20.5 9.5L17 13L11 7L14.5 3.5Z" />
                        <path d="M12.5 8.5L4 17L7 20L15.5 11.5" />
                      </svg>
                    }
                    @case ('Piercing') {
                      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                        <path d="M19 3L9 13L11 15L21 5L19 3Z" />
                        <path d="M5 19L10 14" />
                        <path d="M3 21L5 19" />
                      </svg>
                    }
                    @case ('Sweeping') {
                      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                    }
                    @default {
                      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    }
                  }
                } @else {
                  <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                  </svg>
                }
              </div>

              <!-- Node Name Label Underneath -->
              <span
                class="mt-2.5 line-clamp-2 px-1 font-display text-xs font-bold leading-snug transition-colors"
                [class.text-[#FF8C5A]]="selectedNode()?.id === branch.node.id"
                [class.text-white]="selectedNode()?.id !== branch.node.id"
              >
                {{ branch.node.name }}
              </span>
            </button>

            <!-- Connected Branch Lines to Child Medallions -->
            @if (branch.children.length > 0) {
              <div
                class="h-10 w-0.5 transition-colors"
                [class.bg-[#C4491A]]="mode === 'admin' || isUnlocked(branch.node.id)"
                [class.bg-[#243B37]]="mode === 'character' && !isUnlocked(branch.node.id)"
              ></div>

              @if (branch.children.length === 1) {
                <ng-container
                  *ngTemplateOutlet="medallionBranchTpl; context: { $implicit: branch.children[0] }"
                ></ng-container>
              } @else {
                <div class="relative flex items-start gap-10 pt-5">
                  <div
                    class="absolute left-1/2 top-0 h-0.5 -translate-x-1/2"
                    [class.bg-[#C4491A]]="mode === 'admin' || isUnlocked(branch.node.id)"
                    [class.bg-[#243B37]]="mode === 'character' && !isUnlocked(branch.node.id)"
                    style="width: calc(100% - 10rem);"
                  ></div>

                  @for (childBranch of branch.children; track childBranch.node.id) {
                    <div class="relative flex flex-col items-center">
                      <div
                        class="-mt-5 h-5 w-0.5"
                        [class.bg-[#C4491A]]="mode === 'admin' || isUnlocked(branch.node.id)"
                        [class.bg-[#243B37]]="mode === 'character' && !isUnlocked(branch.node.id)"
                      ></div>
                      <ng-container
                        *ngTemplateOutlet="medallionBranchTpl; context: { $implicit: childBranch }"
                      ></ng-container>
                    </div>
                  }
                </div>
              }
            }
          </div>
        </ng-template>
      </div>

      <!-- ================================================================= -->
      <!-- RIGHT SIDE: NODE INSPECTOR & KEYWORD CODEX PANEL (Fixed Width)    -->
      <!-- ================================================================= -->
      <aside
        class="flex w-full shrink-0 flex-col justify-between overflow-y-auto bg-[#122220] p-6 lg:w-[370px] xl:w-[400px]"
      >
        @if (selectedNode(); as node) {
          <div class="space-y-5">
            <!-- Selected Node Header -->
            <div class="flex items-start justify-between gap-3 border-b border-[#243B37] pb-4">
              <div>
                <div class="flex flex-wrap items-center gap-2 font-mono-num text-xs">
                  <span class="rounded bg-[#0D1615] px-2 py-0.5 font-bold text-[#FF8C5A]">
                    Tier {{ node.tier }}
                  </span>
                  <span class="text-[#8AB0AB]">
                    {{ node.node_type === 'combat_art' ? 'Combat Art' : 'Passive Upgrade' }}
                  </span>
                </div>

                <h2 class="mt-1.5 font-display text-xl font-bold text-white">
                  {{ node.name }}
                </h2>

                @if (parentNodeName(node.parent_node_id); as reqName) {
                  <p class="mt-0.5 font-mono-num text-xs font-semibold text-[#8AB0AB]">
                    Prerequisite: <strong class="text-white">{{ reqName }}</strong>
                  </p>
                }
              </div>

              <span
                class="shrink-0 rounded-lg border border-[#243B37] bg-[#0D1615] px-2.5 py-1 font-mono-num text-xs font-bold text-white tabular-nums"
              >
                {{ node.perk_cost }} {{ node.perk_cost === 1 ? 'Perk' : 'Perks' }}
              </span>
            </div>

            <!-- Action Economy & Hoverable Combat Tag Pills (No [] Brackets!) -->
            @if (node.node_type === 'combat_art') {
              <div class="flex flex-wrap items-center gap-2 font-mono-num text-xs">
                <span
                  class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3 py-1 font-bold text-white"
                >
                  {{ node.ap_cost ?? 1 }} AP Cost
                </span>

                @if (node.cooldown_rounds) {
                  <span
                    class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3 py-1 text-[#8AB0AB]"
                  >
                    {{ node.cooldown_rounds }}-Round Cooldown
                  </span>
                }

                @if (node.combat_tag && node.combat_tag !== 'None') {
                  <button
                    type="button"
                    (mouseenter)="setHoveredKeywordByName(node.combat_tag)"
                    (mouseleave)="hoveredKeyword.set(null)"
                    (focus)="setHoveredKeywordByName(node.combat_tag)"
                    (blur)="hoveredKeyword.set(null)"
                    class="cursor-help rounded-lg border border-[#C4491A] bg-[#0D1615] px-3 py-1 font-bold text-[#FF8C5A] transition-colors hover:bg-[#C4491A] hover:text-white"
                  >
                    {{ node.combat_tag }}
                  </button>
                }
              </div>
            }

            <!-- Rich Description with Hoverable Keyword Spans (No [] Brackets) -->
            <div class="rounded-xl border border-[#243B37] bg-[#0D1615] p-4">
              <div class="text-xs font-bold text-[#8AB0AB]">Description</div>
              <p class="mt-1.5 text-sm leading-relaxed text-[#EBF5F3]">
                @for (seg of descriptionSegments(); track $index) {
                  @if (seg.keyword; as kw) {
                    <span
                      tabindex="0"
                      (mouseenter)="hoveredKeyword.set(kw)"
                      (mouseleave)="hoveredKeyword.set(null)"
                      (focus)="hoveredKeyword.set(kw)"
                      (blur)="hoveredKeyword.set(null)"
                      class="cursor-help border-b border-dotted border-[#FF8C5A] font-semibold text-[#FF8C5A] transition-colors hover:text-white"
                    >{{ seg.text }}</span>
                  } @else {
                    <span>{{ seg.text }}</span>
                  }
                }
              </p>

              <!-- Compiled Rule Hook Badges -->
              @if (nodeHookBadges().length > 0) {
                <div class="mt-3.5 flex flex-wrap gap-1.5 border-t border-[#243B37] pt-3">
                  @for (badge of nodeHookBadges(); track badge) {
                    <span
                      class="rounded border border-[#243B37] bg-[#122220] px-2.5 py-0.5 font-mono-num text-xs font-bold text-[#38B29A]"
                    >
                      {{ badge }}
                    </span>
                  }
                </div>
              }

              <!-- Slay the Spire-Style Chained Keyword Explanation (Appears at bottom when hovering a word) -->
              @if (hoveredKeyword(); as kw) {
                <div class="mt-3.5 space-y-2 border-t border-[#243B37] pt-3">
                  <!-- Primary Hovered Keyword Card -->
                  <div
                    class="rounded-lg border border-[#C4491A] bg-[#122220] p-3 transition-all"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-display text-xs font-bold text-[#FF8C5A]">
                        {{ kw.term }}
                      </span>
                      <span class="font-mono-num text-[11px] text-[#8AB0AB]">
                        {{ kw.category }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs leading-relaxed text-[#EBF5F3]">
                      @for (subSeg of tokenizeKeywordSummary(kw); track $index) {
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

                  <!-- Chained Keywords Referenced Inside the Hovered Keyword -->
                  @if (chainedHoveredKeywords().length > 0) {
                    <div class="space-y-1.5 border-l-2 border-[#C4491A]/60 pl-2.5">
                      <p class="font-mono-num text-[10px] font-bold uppercase tracking-wider text-[#8AB0AB]">
                        Chained Keywords ({{ chainedHoveredKeywords().length }})
                      </p>
                      @for (chainedKw of chainedHoveredKeywords(); track chainedKw.term) {
                        <div class="rounded-lg border border-[#243B37] bg-[#122220]/80 p-2.5">
                          <div class="flex items-center justify-between gap-2">
                            <span class="font-display text-xs font-bold text-[#FF8C5A]">
                              ↳ {{ chainedKw.term }}
                            </span>
                            <span class="font-mono-num text-[10px] text-[#8AB0AB]">
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
              } @else {
                <div class="mt-3 border-t border-[#243B37]/60 pt-2.5 text-[11px] text-[#8AB0AB]">
                  Hover over any underlined keyword above to view its rule &amp; chained keywords.
                </div>
              }
            </div>
          </div>

          <!-- Inspector Footer Controls (Admin vs Character Creation Mode) -->
          <div class="mt-6 border-t border-[#243B37] pt-4">
            @if (mode === 'admin') {
              <div class="space-y-2.5">
                <button
                  type="button"
                  (click)="branchChildNode.emit(node)"
                  class="btn-copper w-full rounded-xl px-4 py-2.5 text-xs font-semibold"
                >
                  + Branch Tier {{ node.tier + 1 }} Child from "{{ node.name }}"
                </button>

                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="editNode.emit(node)"
                    class="rounded-xl border border-[#243B37] bg-[#0D1615] px-3 py-2 text-xs font-semibold text-[#EBF5F3] hover:border-[#C4491A]"
                  >
                    Edit Node
                  </button>
                  <button
                    type="button"
                    (click)="deleteNode.emit(node)"
                    class="rounded-xl border border-[#243B37] bg-[#0D1615] px-3 py-2 text-xs font-semibold text-[#F26464] hover:border-[#F26464]"
                  >
                    Delete Node
                  </button>
                </div>
              </div>
            } @else {
              <div class="space-y-2">
                @if (!isParentUnlocked(node) && parentNodeName(node.parent_node_id); as reqName) {
                  <p class="text-center font-mono-num text-xs font-semibold text-[#FF8C5A]">
                    Unlock "{{ reqName }}" first to reach this node.
                  </p>
                }
                <button
                  type="button"
                  (click)="toggleUnlock.emit(node)"
                  [disabled]="!canToggleCharacterNode(node)"
                  [class]="
                    isUnlocked(node.id)
                      ? 'btn-copper w-full rounded-xl px-4 py-2.5 text-xs font-semibold'
                      : 'w-full rounded-xl border border-[#C4491A] bg-[#0D1615] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#C4491A] disabled:opacity-40'
                  "
                >
                  {{ isUnlocked(node.id) ? 'Unlocked (Click to Refund)' : 'Unlock Node (' + node.perk_cost + ' Perk)' }}
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="flex h-full flex-col items-center justify-center text-center">
            <p class="font-display text-sm font-bold text-white">
              Select a Skill Node
            </p>
            <p class="mt-1 text-xs text-[#8AB0AB]">
              Click any icon on the Skill Tree canvas to inspect its description, keywords, and rules.
            </p>
          </div>
        }
      </aside>
    </div>
  `,
})
export class SkillTreeCanvasComponent implements OnChanges {
  readonly Math = Math;
  private readonly compendiumStore = inject(CompendiumStore);

  @Input({ required: true }) tree!: SkillTreeModel;
  @Input({ required: true }) allNodes: PerkNodeModel[] = [];
  @Input() mode: 'admin' | 'character' = 'admin';
  @Input() unlockedIds: string[] = [];
  @Input() perkSpent = 0;
  @Input() perkBudget = 1;

  @Output() addRootNode = new EventEmitter<void>();
  @Output() branchChildNode = new EventEmitter<PerkNodeModel>();
  @Output() editNode = new EventEmitter<PerkNodeModel>();
  @Output() deleteNode = new EventEmitter<PerkNodeModel>();
  @Output() toggleUnlock = new EventEmitter<PerkNodeModel>();

  private readonly nodesSignal = signal<PerkNodeModel[]>([]);
  private readonly treeIdSignal = signal<string>('');

  readonly selectedNodeId = signal<string | null>(null);
  readonly hoveredKeyword = signal<KeywordDefinition | null>(null);

  // 2D Panning & Zoom State
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly zoom = signal(1);
  readonly isDragging = signal(false);

  private dragStartX = 0;
  private dragStartY = 0;
  private initialPanX = 0;
  private initialPanY = 0;
  private movedDistance = 0;

  readonly treeNodes = computed(() =>
    this.nodesSignal()
      .filter((n) => n.tree_id === this.treeIdSignal())
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
  );

  readonly branches = computed<SkillTreeBranchNode[]>(() =>
    buildSkillTreeHierarchy(this.treeIdSignal(), this.nodesSignal())
  );

  readonly selectedNode = computed<PerkNodeModel | null>(() => {
    const list = this.treeNodes();
    const id = this.selectedNodeId();
    if (id) {
      const found = list.find((n) => n.id === id);
      if (found) return found;
    }
    return list[0] ?? null;
  });

  readonly descriptionSegments = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return tokenizeTextWithKeywords(node.description, this.compendiumStore.keywords());
  });

  readonly chainedHoveredKeywords = computed<KeywordDefinition[]>(() =>
    resolveChainedKeywords(this.hoveredKeyword(), this.compendiumStore.keywords())
  );

  readonly nodeHookBadges = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return formatRuleHookBadges(node.rule_hooks);
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tree'] && this.tree) {
      const prevTreeId = this.treeIdSignal();
      this.treeIdSignal.set(this.tree.id);
      if (prevTreeId !== this.tree.id) {
        this.resetCamera();
        this.hoveredKeyword.set(null);
      }
    }
    if (changes['allNodes']) {
      this.nodesSignal.set(this.allNodes ?? []);
    }
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.isDragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.initialPanX = this.panX();
    this.initialPanY = this.panY();
    this.movedDistance = 0;
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.movedDistance = Math.hypot(dx, dy);
    this.panX.set(this.initialPanX + dx);
    this.panY.set(this.initialPanY + dy);
  }

  onCanvasPointerUp(): void {
    if (this.isDragging()) {
      this.isDragging.set(false);
    }
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    this.adjustZoom(delta);
  }

  adjustZoom(delta: number): void {
    this.zoom.update((z) => Math.max(0.5, Math.min(1.6, Number((z + delta).toFixed(2)))));
  }

  resetCamera(): void {
    this.panX.set(0);
    this.panY.set(0);
    this.zoom.set(1);
  }

  onNodeClick(event: MouseEvent, node: PerkNodeModel): void {
    event.stopPropagation();
    if (this.movedDistance > 6) return;
    this.selectedNodeId.set(node.id);
    this.hoveredKeyword.set(null);
  }

  setHoveredKeywordByName(term: string): void {
    const map = buildKeywordLookupMap(this.compendiumStore.keywords());
    const def = map.get(term.toLowerCase());
    if (def) {
      this.hoveredKeyword.set(def);
    }
  }

  tokenizeKeywordSummary(kw: KeywordDefinition): DescriptionSegment[] {
    const others = this.compendiumStore
      .keywords()
      .filter((item) => item.term.trim().toLowerCase() !== kw.term.trim().toLowerCase());
    return tokenizeTextWithKeywords(kw.summary, others);
  }

  stripBrackets(raw: string): string {
    return (raw ?? '').replace(/\[([^\]]+)\]/g, '$1');
  }

  getMedallionClasses(node: PerkNodeModel): string {
    const isSelected = this.selectedNode()?.id === node.id;
    const unlocked = this.isUnlocked(node.id);

    if (node.node_type === 'combat_art') {
      const base = 'h-16 w-16 rounded-2xl border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#FF8C5A] bg-[#C4491A] text-white ring-4 ring-[#C4491A]/35 scale-105'
        );
      }
      if (this.mode === 'character' && unlocked) {
        return base + 'border-[#C4491A] bg-[#C4491A]/25 text-[#FF8C5A]';
      }
      return (
        base +
        'border-[#C4491A]/70 bg-[#122220] text-[#FF8C5A] group-hover:border-[#FF8C5A] group-hover:scale-105'
      );
    } else {
      const base = 'h-15 w-15 rounded-full border-2 ';
      if (isSelected) {
        return (
          base +
          'border-[#38B29A] bg-[#1D5B4E] text-white ring-4 ring-[#38B29A]/35 scale-105'
        );
      }
      if (this.mode === 'character' && unlocked) {
        return base + 'border-[#38B29A] bg-[#1D5B4E]/35 text-[#38B29A]';
      }
      return (
        base +
        'border-[#2A6F62] bg-[#122220] text-[#38B29A] group-hover:border-[#38B29A] group-hover:scale-105'
      );
    }
  }

  parentNodeName(parentId: string | null | undefined): string | null {
    if (!parentId) return null;
    return this.nodesSignal().find((n) => n.id === parentId)?.name ?? null;
  }

  isUnlocked(nodeId: string): boolean {
    return this.unlockedIds.includes(nodeId);
  }

  isParentUnlocked(node: PerkNodeModel): boolean {
    if (!node.parent_node_id) return true;
    return this.unlockedIds.includes(node.parent_node_id);
  }

  canToggleCharacterNode(node: PerkNodeModel): boolean {
    if (this.isUnlocked(node.id)) return true;
    if (!this.isParentUnlocked(node)) return false;
    return this.perkSpent + (node.perk_cost ?? 1) <= this.perkBudget;
  }
}
