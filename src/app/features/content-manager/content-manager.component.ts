import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CombatTag,
  EditableRuleHookKey,
  KeywordDefinition,
  PerkNodeModel,
  RULE_HOOK_DEFINITIONS,
  ResolvedCompendiumVisuals,
  RuleHookDefinition,
  RuleHookRow,
  SkillTreeModel,
  formatRuleHookBadges,
  getTreeArchetypeIcon,
  hooksObjectToRows,
  resolveNodeVisuals,
  resolveTreeVisuals,
  rowsToHooksObject,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { IconPickerComponent } from '../../shared/compendium-icon/icon-picker.component';
import { KeywordTextComponent } from '../../shared/keyword-text/keyword-text.component';
import { KeywordTextareaComponent } from '../../shared/keyword-text/keyword-textarea.component';
import { SkillTreeCanvasComponent } from '../../shared/skill-tree-canvas/skill-tree-canvas.component';

@Component({
  selector: 'app-content-manager',
  standalone: true,
  imports: [
    FormsModule,
    SkillTreeCanvasComponent,
    KeywordTextareaComponent,
    KeywordTextComponent,
    CompendiumIconComponent,
    IconPickerComponent,
  ],
  template: `
    <div
      class="mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 transition-all"
      [class.max-w-6xl]="!activeTree()"
      [class.max-w-[1600px]]="!!activeTree()"
    >
      <!-- Feedback Banners -->
      @if (compendiumStore.error()) {
        <div
          class="rounded-xl border border-[var(--mot-hp)] bg-[var(--mot-hp-bg)] px-4 py-3 text-xs font-semibold text-[var(--mot-hp-text)]"
        >
          {{ compendiumStore.error() }}
        </div>
      }

      @if (compendiumStore.statusMessage()) {
        <div
          class="rounded-xl border border-[#C4491A] bg-[var(--mot-surface)] px-4 py-3 text-xs font-semibold text-[var(--mot-text)]"
        >
          {{ compendiumStore.statusMessage() }}
        </div>
      }

      <!-- ================================================================= -->
      <!-- VIEW 1: TOP ADMIN STUDIO (Skill Trees Gallery OR Keywords Tab)    -->
      <!-- ================================================================= -->
      @if (!activeTree()) {
        <section
          class="overflow-hidden rounded-2xl border border-[#243B37] bg-[#122220] p-6 sm:p-8 text-[#EBF5F3]"
        >
          <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div class="flex flex-wrap items-center gap-2.5">
                <h1 class="font-display text-2xl font-bold text-white sm:text-3xl">
                  Content Manager
                </h1>
                <span
                  class="rounded-md border border-[#C4491A] bg-[#0D1615] px-2.5 py-0.5 font-mono-num text-xs font-bold text-[#FF8C5A]"
                >
                  Admin Studio
                </span>
              </div>
              <p class="mt-1.5 max-w-2xl text-sm text-[#8AB0AB]">
                Manage interactive martial Skill Trees, Combat Arts, and the Special Words dictionary used for <code>[</code> autocomplete and hover tooltips.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <!-- Studio Section Switcher -->
              <div class="flex items-center rounded-xl border border-[#243B37] bg-[#0D1615] p-1">
                <button
                  type="button"
                  (click)="studioTab.set('trees')"
                  class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors"
                  [class.bg-[#C4491A]]="studioTab() === 'trees'"
                  [class.text-white]="studioTab() === 'trees'"
                  [class.text-[#8AB0AB]]="studioTab() !== 'trees'"
                >
                  Skill Trees ({{ compendiumStore.skillTrees().length }})
                </button>
                <button
                  type="button"
                  (click)="studioTab.set('keywords')"
                  class="rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors"
                  [class.bg-[#C4491A]]="studioTab() === 'keywords'"
                  [class.text-white]="studioTab() === 'keywords'"
                  [class.text-[#8AB0AB]]="studioTab() !== 'keywords'"
                >
                  Special Words ({{ compendiumStore.keywords().length }})
                </button>
              </div>

              @if (studioTab() === 'trees') {
                <button
                  type="button"
                  (click)="openNewTreeModal()"
                  class="btn-copper rounded-lg px-4 py-2.5 text-xs font-semibold"
                >
                  + New Skill Tree
                </button>
              } @else {
                <button
                  type="button"
                  (click)="openNewKeywordModal()"
                  class="btn-copper rounded-lg px-4 py-2.5 text-xs font-semibold"
                >
                  + New Special Word
                </button>
              }
            </div>
          </div>
        </section>

        <!-- TAB A: SKILL TREE CARDS GALLERY -->
        @if (studioTab() === 'trees') {
          <section class="grid grid-cols-1 gap-5 md:grid-cols-3">
            @for (tree of compendiumStore.skillTrees(); track tree.id) {
              <article
                class="group flex flex-col justify-between rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-6 transition-all hover:border-[#C4491A]"
              >
                <div>
                  <div class="flex items-start justify-between gap-3">
                    <div
                      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 bg-[#122220] transition-transform group-hover:scale-105"
                      [style.border-color]="getTreeVisuals(tree).color"
                    >
                      <app-compendium-icon
                        [icon]="getTreeVisuals(tree).icon"
                        [color]="getTreeVisuals(tree).color"
                        [tintCustom]="getTreeVisuals(tree).tintCustom"
                        sizeClass="h-6 w-6"
                      />
                    </div>

                    <span
                      class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1 font-mono-num text-xs font-bold text-[var(--mot-text)] tabular-nums"
                    >
                      {{ getPerksForTree(tree.id).length }}
                      {{ getPerksForTree(tree.id).length === 1 ? 'Node' : 'Nodes' }}
                    </span>
                  </div>

                  <h2 class="mt-4 font-display text-xl font-bold text-[var(--mot-text)]">
                    {{ tree.name }}
                  </h2>
                  <p class="mt-1.5 text-xs leading-relaxed text-[var(--mot-muted)]">
                    {{ tree.description }}
                  </p>

                  <div class="mt-4 flex flex-wrap items-center gap-2 font-mono-num text-xs">
                    <span
                      class="rounded-md border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1 font-semibold text-[var(--mot-accent-text)]"
                    >
                      {{ countNodeType(tree.id, 'combat_art') }} Combat Arts
                    </span>
                    <span
                      class="rounded-md border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1 font-semibold text-[var(--mot-sp-text)]"
                    >
                      {{ countNodeType(tree.id, 'passive_upgrade') }} Passives
                    </span>
                  </div>
                </div>

                <div class="mt-6 flex items-center justify-between gap-2 border-t border-[var(--mot-border)] pt-4">
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      (click)="openEditTreeModal(tree)"
                      class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1.5 text-xs font-semibold text-[var(--mot-text)] hover:border-[#C4491A]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      (click)="confirmDeleteTree(tree)"
                      class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1.5 text-xs font-semibold text-[var(--mot-hp-text)] hover:border-[var(--mot-hp)]"
                    >
                      Delete
                    </button>
                  </div>

                  <button
                    type="button"
                    (click)="openSkillTreeView(tree.id)"
                    class="btn-copper rounded-lg px-4 py-2 text-xs font-semibold"
                  >
                    View Skill Tree →
                  </button>
                </div>
              </article>
            }
          </section>
        }

        <!-- TAB B: SPECIAL WORDS & GLOSSARY MANAGER -->
        @if (studioTab() === 'keywords') {
          <section
            class="rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)]"
          >
            <div
              class="flex flex-col justify-between gap-3 rounded-t-2xl border-b border-[var(--mot-border)] bg-[var(--mot-well)] px-6 py-4 sm:flex-row sm:items-center"
            >
              <div>
                <h2 class="font-display text-lg font-bold text-[var(--mot-text)]">
                  Special Words &amp; Hover Definitions
                </h2>
                <p class="text-xs text-[var(--mot-muted)]">
                  Any word listed here appears in the <code>[</code> autocomplete menu when writing descriptions and automatically shows its rule tooltip when hovered.
                </p>
              </div>

              <div class="w-full sm:w-64">
                <input
                  type="text"
                  [ngModel]="keywordSearch()"
                  (ngModelChange)="keywordSearch.set($event)"
                  placeholder="Search special words..."
                  class="mot-input px-3 py-1.5 text-xs font-semibold"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              @for (kw of filteredKeywords(); track kw.term) {
                <article
                  class="flex flex-col justify-between rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 transition-colors hover:border-[#C4491A]"
                >
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <span
                        class="font-display text-base font-bold text-[var(--mot-accent-text)] underline decoration-dotted underline-offset-4"
                      >
                        {{ kw.term }}
                      </span>
                      <span
                        class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-mono-num text-[11px] font-semibold text-[var(--mot-muted)]"
                      >
                        {{ kw.category }}
                      </span>
                    </div>
                    <div class="mt-2">
                      <app-keyword-text
                        [text]="kw.summary"
                        [excludeTerm]="kw.term"
                        [showHintWhenIdle]="false"
                      />
                    </div>
                  </div>

                  <div class="mt-4 flex items-center justify-end gap-2 border-t border-[var(--mot-border)] pt-3">
                    <button
                      type="button"
                      (click)="openEditKeywordModal(kw)"
                      class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-1 text-xs font-semibold text-[var(--mot-text)] hover:border-[#C4491A]"
                    >
                      Edit Word
                    </button>
                    <button
                      type="button"
                      (click)="deleteKeyword(kw)"
                      class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-1 text-xs font-semibold text-[var(--mot-hp-text)] hover:border-[var(--mot-hp)]"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      }

      <!-- ================================================================= -->
      <!-- VIEW 2: EXPANSIVE DRAGGABLE ICON SKILL TREE + INSPECTOR           -->
      <!-- ================================================================= -->
      @if (activeTree(); as tree) {
        <section
          class="overflow-hidden rounded-2xl border border-[#243B37] bg-[#122220] px-6 py-4 text-[#EBF5F3]"
        >
          <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div class="flex items-center gap-4">
              <button
                type="button"
                (click)="closeSkillTreeView()"
                class="flex h-9 items-center gap-1.5 rounded-xl border border-[#243B37] bg-[#0D1615] px-3.5 text-xs font-bold text-[#EBF5F3] transition-colors hover:border-[#C4491A]"
              >
                ← All Trees
              </button>

              <div>
                <h1 class="font-display text-lg font-bold text-white sm:text-xl">
                  {{ tree.name }}
                </h1>
                <p class="text-xs text-[#8AB0AB]">
                  {{ tree.description }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                (click)="openNewKeywordModal()"
                class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3 py-2 text-xs font-semibold text-[#FF8C5A] hover:border-[#C4491A]"
              >
                + New Special Word
              </button>
              <button
                type="button"
                (click)="openEditTreeModal(tree)"
                class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3 py-2 text-xs font-semibold text-[#EBF5F3] hover:border-[#C4491A]"
              >
                Edit Tree Info
              </button>
              <button
                type="button"
                (click)="openNewNodeModal(tree.id)"
                class="btn-copper rounded-lg px-4 py-2 text-xs font-semibold"
              >
                + Add Tier 1 Root Node
              </button>
            </div>
          </div>
        </section>

        <!-- Full-Width Pannable Icon Tree Canvas + Right-Side Inspector -->
        <app-skill-tree-canvas
          [tree]="tree"
          [allNodes]="compendiumStore.perkNodes()"
          mode="admin"
          (addRootNode)="openNewNodeModal(tree.id)"
          (branchChildNode)="openBranchChildModal($event)"
          (editNode)="openEditNodeModal($event)"
          (deleteNode)="confirmDeleteNode($event)"
        />
      }

      <!-- =================================================================== -->
      <!-- MODAL 1: CREATE / EDIT SKILL TREE                                   -->
      <!-- =================================================================== -->
      @if (treeModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          (click)="closeTreeModal()"
        >
          <div
            class="my-8 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] text-[var(--mot-text)]"
            (click)="$event.stopPropagation()"
          >
            <div
              class="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-[#243B37] bg-[#122220] px-6 py-4 text-white"
            >
              <h2 class="font-display text-lg font-bold">
                {{ editingTreeId() ? 'Edit Skill Tree' : 'Create Skill Tree' }}
              </h2>
              <button
                type="button"
                (click)="closeTreeModal()"
                class="text-xs font-bold text-[#8AB0AB] hover:text-white"
              >
                Close
              </button>
            </div>

            <form (ngSubmit)="saveTree()" class="p-6 space-y-4">
              <div>
                <label for="treeName" class="block text-xs font-bold text-[var(--mot-text)]">
                  Skill Tree Name
                </label>
                <input
                  id="treeName"
                  type="text"
                  name="treeName"
                  required
                  [(ngModel)]="treeFormName"
                  placeholder="e.g. Path of the Sentinel"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
                />
              </div>

              <div>
                <label for="treeDesc" class="block text-xs font-bold text-[var(--mot-text)]">
                  Martial Philosophy &amp; Combat Focus
                </label>
                <textarea
                  id="treeDesc"
                  name="treeDesc"
                  rows="3"
                  required
                  [(ngModel)]="treeFormDescription"
                  placeholder="Describe what kind of Combat Arts and Passive Upgrades belong to this path..."
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm"
                ></textarea>
              </div>

              <app-icon-picker
                label="Skill Tree Crest &amp; Color"
                shape="square"
                [icon]="treeFormIcon"
                (iconChange)="treeFormIcon = $event"
                [color]="treeFormColor"
                (colorChange)="treeFormColor = $event"
                [tintCustom]="treeFormTintCustom"
                (tintCustomChange)="treeFormTintCustom = $event"
              />

              <div class="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  (click)="closeTreeModal()"
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-4 py-2 text-xs font-semibold text-[var(--mot-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="compendiumStore.isLoading()"
                  class="btn-copper rounded-lg px-5 py-2 text-xs font-semibold"
                >
                  {{ editingTreeId() ? 'Save Tree Changes' : 'Create Skill Tree' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- =================================================================== -->
      <!-- MODAL 2: CREATE / EDIT COMBAT ART OR PASSIVE PERK NODE              -->
      <!-- (Includes [ Triggered Special Word Search & Autocomplete!)          -->
      <!-- =================================================================== -->
      @if (nodeModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
          (click)="closeNodeModal()"
        >
          <div
            class="my-8 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] text-[var(--mot-text)]"
            (click)="$event.stopPropagation()"
          >
            <div
              class="sticky top-0 z-10 flex items-center justify-between border-b border-[#243B37] bg-[#122220] px-6 py-4 text-white"
            >
              <div>
                <h2 class="font-display text-lg font-bold">
                  {{ editingNodeId() ? 'Edit Skill Tree Node' : 'Create Skill Tree Node' }}
                </h2>
                <p class="text-xs text-[#8AB0AB]">
                  Type <code class="rounded bg-[#0D1615] px-1.5 py-0.5 text-[#FF8C5A]">[</code> in the description to search and insert special words.
                </p>
              </div>
              <button
                type="button"
                (click)="closeNodeModal()"
                class="text-xs font-bold text-[#8AB0AB] hover:text-white"
              >
                Close
              </button>
            </div>

            <form (ngSubmit)="saveNode()" class="p-6 space-y-6">
              <!-- Section 1: Core Identity & Placement -->
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="sm:col-span-2">
                  <label for="nodeName" class="block text-xs font-bold text-[var(--mot-text)]">
                    Node Name
                  </label>
                  <input
                    id="nodeName"
                    type="text"
                    name="nodeName"
                    required
                    [(ngModel)]="nodeForm.name"
                    placeholder="e.g. Sundering Ram or Ironblood Conditioning"
                    class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
                  />
                </div>

                <div>
                  <label for="nodeTree" class="block text-xs font-bold text-[var(--mot-text)]">
                    Skill Tree
                  </label>
                  <select
                    id="nodeTree"
                    name="nodeTree"
                    [(ngModel)]="nodeForm.tree_id"
                    class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-semibold"
                  >
                    @for (t of compendiumStore.skillTrees(); track t.id) {
                      <option [value]="t.id">{{ t.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label for="nodeType" class="block text-xs font-bold text-[var(--mot-text)]">
                    Node Type
                  </label>
                  <select
                    id="nodeType"
                    name="nodeType"
                    [(ngModel)]="nodeForm.node_type"
                    class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-semibold"
                  >
                    <option value="combat_art">Combat Art (Active Ability)</option>
                    <option value="passive_upgrade">Passive Upgrade (Permanent Stat/Rule)</option>
                  </select>
                </div>

                <div>
                  <label for="nodeTier" class="block text-xs font-bold text-[var(--mot-text)]">
                    Tree Tier (1–5)
                  </label>
                  <input
                    id="nodeTier"
                    type="number"
                    name="nodeTier"
                    min="1"
                    max="5"
                    [(ngModel)]="nodeForm.tier"
                    class="mot-input mt-1.5 px-3.5 py-2 font-mono-num text-sm font-bold"
                  />
                </div>

                <div>
                  <label for="nodePerkCost" class="block text-xs font-bold text-[var(--mot-text)]">
                    Perk Point Cost
                  </label>
                  <input
                    id="nodePerkCost"
                    type="number"
                    name="nodePerkCost"
                    min="1"
                    max="5"
                    [(ngModel)]="nodeForm.perk_cost"
                    class="mot-input mt-1.5 px-3.5 py-2 font-mono-num text-sm font-bold"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label for="nodeParent" class="block text-xs font-bold text-[var(--mot-text)]">
                    Connected Parent Node (Prerequisite)
                  </label>
                  <select
                    id="nodeParent"
                    name="nodeParent"
                    [(ngModel)]="nodeForm.parent_node_id"
                    class="mot-input mt-1.5 px-3.5 py-2 text-sm"
                  >
                    <option [ngValue]="null">None (Root / Tier 1 Node)</option>
                    @for (candidate of availableParentNodes(); track candidate.id) {
                      <option [ngValue]="candidate.id">
                        Tier {{ candidate.tier }} — {{ candidate.name }}
                      </option>
                    }
                  </select>
                </div>

                <!-- Rules Description with [ Special Word Autocomplete -->
                <div class="sm:col-span-2">
                  <app-keyword-textarea
                    inputId="nodeDesc"
                    label="Rules Description"
                    [value]="nodeForm.description"
                    (valueChange)="nodeForm.description = $event"
                    (requestCreateKeyword)="openNewKeywordModal($event)"
                    placeholder="Type [ to search special words (e.g. [Crushing], [Parry], [Sundered])..."
                  />
                </div>

                <!-- Node Medallion Icon & Color Picker -->
                <div class="sm:col-span-2">
                  <app-icon-picker
                    label="Node Medallion Icon &amp; Color"
                    [shape]="nodeForm.node_type === 'combat_art' ? 'square' : 'circle'"
                    [icon]="nodeForm.icon"
                    (iconChange)="nodeForm.icon = $event"
                    [color]="nodeForm.icon_color"
                    (colorChange)="nodeForm.icon_color = $event"
                    [tintCustom]="nodeForm.icon_tint_custom"
                    (tintCustomChange)="nodeForm.icon_tint_custom = $event"
                  />
                </div>
              </div>

              <!-- Section 2: Active Combat Art Parameters (Only if Combat Art) -->
              @if (nodeForm.node_type === 'combat_art') {
                <div
                  class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 space-y-3"
                >
                  <div>
                    <h3 class="font-display text-sm font-bold text-[var(--mot-text)]">
                      Combat Art Action Economy &amp; Defense Triangle Tag
                    </h3>
                    <p class="text-xs text-[var(--mot-muted)]">
                      Combat Tags automatically restrict one of the target's three active defenses.
                    </p>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label class="block text-xs font-bold text-[var(--mot-text)]">
                        AP Cost (1–4)
                      </label>
                      <input
                        type="number"
                        name="apCost"
                        min="0"
                        max="4"
                        [(ngModel)]="nodeForm.ap_cost"
                        class="mot-input mt-1 px-3 py-2 font-mono-num text-sm font-bold"
                      />
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-[var(--mot-text)]">
                        Cooldown (Rounds)
                      </label>
                      <input
                        type="number"
                        name="cooldownRounds"
                        min="0"
                        max="6"
                        [(ngModel)]="nodeForm.cooldown_rounds"
                        class="mot-input mt-1 px-3 py-2 font-mono-num text-sm font-bold"
                      />
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-[var(--mot-text)]">
                        Combat Tag
                      </label>
                      <select
                        name="combatTag"
                        [(ngModel)]="nodeForm.combat_tag"
                        class="mot-input mt-1 px-3 py-2 text-sm font-bold"
                      >
                        <option value="None">None</option>
                        <option value="Crushing">Crushing (No Parry)</option>
                        <option value="Piercing">Piercing (No Block)</option>
                        <option value="Sweeping">Sweeping (No Dodge)</option>
                      </select>
                    </div>
                  </div>
                </div>
              }

              <!-- Section 3: Composable Rule Hook Builder -->
              <div
                class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 space-y-4"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 class="font-display text-sm font-bold text-[var(--mot-text)]">
                      Composable Rule Hooks (Automated Sheet &amp; Combat Effects)
                    </h3>
                    <p class="text-xs text-[var(--mot-muted)]">
                      Attach only the mechanical modifiers this node uses.
                    </p>
                  </div>

                  <button
                    type="button"
                    (click)="addRuleHookRow()"
                    [disabled]="hookRows().length >= ruleHookDefinitions.length"
                    class="rounded-lg border border-[#C4491A] bg-[var(--mot-surface)] px-3 py-1.5 text-xs font-bold text-[var(--mot-accent-text)] transition-colors hover:bg-[#C4491A] hover:text-white disabled:opacity-40"
                  >
                    + Add Rule Hook
                  </button>
                </div>

                @if (hookRows().length === 0) {
                  <div
                    class="rounded-lg border border-dashed border-[var(--mot-border)] bg-[var(--mot-surface)] px-4 py-4 text-center text-xs text-[var(--mot-muted)]"
                  >
                    No custom stat or on-hit modifiers attached yet. Click
                    <strong class="text-[var(--mot-text)]">+ Add Rule Hook</strong> to attach automatic bonuses.
                  </div>
                } @else {
                  <div class="space-y-2.5">
                    @for (row of hookRows(); track $index; let idx = $index) {
                      <div
                        class="flex flex-col gap-2 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] p-3 sm:flex-row sm:items-center"
                      >
                        <div class="flex-1">
                          <select
                            [name]="'hookKey_' + idx"
                            [ngModel]="row.key"
                            (ngModelChange)="updateRowKey(idx, $event)"
                            class="mot-input px-3 py-1.5 text-xs font-bold"
                          >
                            <optgroup label="Sheet Stat Bonuses (Passive Math)">
                              @for (def of sheetStatHookDefs; track def.key) {
                                <option [value]="def.key">{{ def.label }}</option>
                              }
                            </optgroup>
                            <optgroup label="Combat Art Effects (On-Hit / Tactical)">
                              @for (def of combatEffectHookDefs; track def.key) {
                                <option [value]="def.key">{{ def.label }}</option>
                              }
                            </optgroup>
                          </select>
                        </div>

                        <div class="w-full sm:w-40">
                          @if (getHookDef(row.key)?.valueType === 'status') {
                            <select
                              [name]="'hookStatus_' + idx"
                              [ngModel]="row.statusValue"
                              (ngModelChange)="updateRowStatus(idx, $event)"
                              class="mot-input px-3 py-1.5 text-xs font-bold"
                            >
                              <option value="Sundered">Sundered</option>
                              <option value="Staggered">Staggered</option>
                              <option value="Bleeding">Bleeding</option>
                              <option value="Pinned">Pinned</option>
                            </select>
                          } @else {
                            <input
                              type="number"
                              [name]="'hookNum_' + idx"
                              [ngModel]="row.numValue"
                              (ngModelChange)="updateRowNum(idx, $event)"
                              class="mot-input px-3 py-1.5 font-mono-num text-xs font-bold"
                            />
                          }
                        </div>

                        <button
                          type="button"
                          (click)="removeRuleHookRow(idx)"
                          class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1.5 text-xs font-bold text-[var(--mot-hp-text)] hover:border-[var(--mot-hp)]"
                        >
                          Remove
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (liveCompiledBadges().length > 0) {
                  <div class="flex flex-wrap items-center gap-1.5 border-t border-[var(--mot-border)] pt-3">
                    <span class="text-xs font-semibold text-[var(--mot-muted)]">
                      Sheet Preview:
                    </span>
                    @for (badge of liveCompiledBadges(); track badge) {
                      <span
                        class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-mono-num text-xs font-bold text-[var(--mot-sp-text)]"
                      >
                        {{ badge }}
                      </span>
                    }
                  </div>
                }
              </div>

              <div class="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  (click)="closeNodeModal()"
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-4 py-2 text-xs font-semibold text-[var(--mot-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="compendiumStore.isLoading()"
                  class="btn-copper rounded-lg px-5 py-2 text-xs font-semibold"
                >
                  {{ editingNodeId() ? 'Save Node Changes' : 'Create Node' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- =================================================================== -->
      <!-- MODAL 3: CREATE / EDIT SPECIAL WORD (KEYWORD GLOSSARY)              -->
      <!-- =================================================================== -->
      @if (keywordModalOpen()) {
        <div
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          (click)="closeKeywordModal()"
        >
          <div
            class="w-full max-w-lg rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] text-[var(--mot-text)]"
            (click)="$event.stopPropagation()"
          >
            <div
              class="flex items-center justify-between rounded-t-2xl border-b border-[#243B37] bg-[#122220] px-6 py-4 text-white"
            >
              <div>
                <h2 class="font-display text-lg font-bold">
                  {{ editingKeywordId() ? 'Edit Special Word' : 'Create Special Word' }}
                </h2>
                <p class="text-xs text-[#8AB0AB]">
                  Available in the <code>[</code> autocomplete menu and highlighted automatically in descriptions.
                </p>
              </div>
              <button
                type="button"
                (click)="closeKeywordModal()"
                class="text-xs font-bold text-[#8AB0AB] hover:text-white"
              >
                Close
              </button>
            </div>

            <form (ngSubmit)="saveKeyword()" class="p-6 space-y-4">
              <div>
                <label class="block text-xs font-bold text-[var(--mot-text)]">
                  Special Word / Term
                </label>
                <input
                  type="text"
                  name="kwTerm"
                  required
                  [(ngModel)]="keywordFormTerm"
                  placeholder="e.g. Overcharge, Exposed, or Riposte"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-bold"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-[var(--mot-text)]">
                  Category
                </label>
                <select
                  name="kwCategory"
                  [(ngModel)]="keywordFormCategory"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-semibold"
                >
                  <option value="Defense Triangle Tag">Defense Triangle Tag</option>
                  <option value="Active Defense">Active Defense</option>
                  <option value="Combat Status">Combat Status</option>
                  <option value="Core Mechanic">Core Mechanic</option>
                  <option value="Custom Rule">Custom Rule</option>
                </select>
              </div>

              <div>
                <app-keyword-textarea
                  inputId="kwSummary"
                  label="Hover Rule Explanation (Chain Other Keywords with [ )"
                  [value]="keywordFormSummary"
                  (valueChange)="keywordFormSummary = $event"
                  [excludeTerm]="keywordFormTerm"
                  [showNewWordButton]="false"
                  placeholder="Type [ to chain related keywords inside this explanation (e.g. The defender must declare [Parry] or [Shield Block])..."
                />

                @if (keywordFormSummary.trim()) {
                  <div
                    class="mt-3 rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-3"
                  >
                    <p class="mb-1.5 font-mono-num text-[11px] font-bold text-[var(--mot-muted)]">
                      Live Chained Preview (Hover underlined words below to test):
                    </p>
                    <app-keyword-text
                      [text]="keywordFormSummary"
                      [excludeTerm]="keywordFormTerm"
                      [showHintWhenIdle]="false"
                      placement="top"
                    />
                  </div>
                }
              </div>

              <div class="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  (click)="closeKeywordModal()"
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-4 py-2 text-xs font-semibold text-[var(--mot-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn-copper rounded-lg px-5 py-2 text-xs font-semibold"
                >
                  {{ editingKeywordId() ? 'Save Word Changes' : 'Create Special Word' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class ContentManagerComponent implements OnInit {
  readonly compendiumStore = inject(CompendiumStore);

  @ViewChild('descTextarea') descTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly ruleHookDefinitions = RULE_HOOK_DEFINITIONS;
  readonly sheetStatHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Sheet Stat Bonus'
  );
  readonly combatEffectHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Combat Art Effect'
  );

  // Studio Tab: 'trees' vs 'keywords'
  readonly studioTab = signal<'trees' | 'keywords'>('trees');
  readonly keywordSearch = signal<string>('');

  readonly filteredKeywords = computed(() => {
    const q = this.keywordSearch().trim().toLowerCase();
    const all = this.compendiumStore.keywords();
    if (!q) return all;
    return all.filter(
      (kw) =>
        kw.term.toLowerCase().includes(q) ||
        kw.category.toLowerCase().includes(q) ||
        kw.summary.toLowerCase().includes(q)
    );
  });

  // Active Skill Tree Studio View
  readonly activeTreeId = signal<string | null>(null);

  readonly activeTree = computed(() => {
    const id = this.activeTreeId();
    if (!id) return null;
    return this.compendiumStore.skillTrees().find((t) => t.id === id) ?? null;
  });

  // `[` Bracket Autocomplete State in Description Textarea
  readonly bracketMenuOpen = signal(false);
  readonly bracketQuery = signal('');
  readonly bracketStartIndex = signal<number>(-1);
  readonly bracketSelectedIndex = signal<number>(0);

  readonly matchingBracketKeywords = computed(() => {
    const q = this.bracketQuery().trim().toLowerCase();
    const all = this.compendiumStore.keywords();
    if (!q) return all;
    return all.filter((kw) => kw.term.toLowerCase().includes(q));
  });

  // Tree Modal State
  readonly treeModalOpen = signal(false);
  readonly editingTreeId = signal<string | null>(null);
  treeFormName = '';
  treeFormDescription = '';
  treeFormIcon = 'greatsword';
  treeFormColor = '#FF8C5A';
  treeFormTintCustom = true;

  // Keyword Modal State
  readonly keywordModalOpen = signal(false);
  readonly editingKeywordId = signal<string | null>(null);
  keywordFormTerm = '';
  keywordFormCategory = 'Combat Status';
  keywordFormSummary = '';

  // Node Modal State
  readonly nodeModalOpen = signal(false);
  readonly editingNodeId = signal<string | null>(null);
  readonly hookRows = signal<RuleHookRow[]>([]);

  nodeForm: {
    tree_id: string;
    name: string;
    node_type: 'combat_art' | 'passive_upgrade';
    tier: number;
    perk_cost: number;
    ap_cost: number;
    cooldown_rounds: number;
    combat_tag: CombatTag;
    description: string;
    parent_node_id: string | null;
    icon: string;
    icon_color: string;
    icon_tint_custom: boolean;
  } = {
    tree_id: '',
    name: '',
    node_type: 'combat_art',
    tier: 1,
    perk_cost: 1,
    ap_cost: 2,
    cooldown_rounds: 3,
    combat_tag: 'Crushing',
    description: '',
    parent_node_id: null,
    icon: 'greatsword',
    icon_color: '#FF8C5A',
    icon_tint_custom: true,
  };

  readonly liveCompiledBadges = computed(() => {
    const compiled = rowsToHooksObject(
      this.hookRows(),
      this.nodeForm.node_type,
      this.nodeForm.combat_tag
    );
    return formatRuleHookBadges(compiled);
  });

  ngOnInit(): void {
    this.compendiumStore.clearMessages();
  }

  openSkillTreeView(treeId: string): void {
    this.compendiumStore.clearMessages();
    this.activeTreeId.set(treeId);
  }

  closeSkillTreeView(): void {
    this.compendiumStore.clearMessages();
    this.activeTreeId.set(null);
  }

  getArchetypeIcon(tree: SkillTreeModel) {
    return getTreeArchetypeIcon(tree);
  }

  getTreeVisuals(tree: SkillTreeModel): ResolvedCompendiumVisuals {
    return resolveTreeVisuals(tree);
  }

  getPerksForTree(treeId: string): PerkNodeModel[] {
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  countNodeType(treeId: string, type: 'combat_art' | 'passive_upgrade'): number {
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId && p.node_type === type).length;
  }

  getHookDef(key: EditableRuleHookKey): RuleHookDefinition | undefined {
    return RULE_HOOK_DEFINITIONS.find((d) => d.key === key);
  }

  availableParentNodes(): PerkNodeModel[] {
    const editingId = this.editingNodeId();
    return this.compendiumStore
      .perkNodes()
      .filter(
        (p) =>
          p.tree_id === this.nodeForm.tree_id &&
          p.id !== editingId &&
          p.tier < this.nodeForm.tier
      );
  }

  // ===========================================================================
  // `[` BRACKET KEYWORD AUTOCOMPLETE LOGIC
  // ===========================================================================
  onDescriptionChange(value: string, textarea: HTMLTextAreaElement): void {
    this.nodeForm.description = value;
    this.evaluateBracketAutocomplete(textarea);
  }

  onDescriptionCursorActivity(
    textarea: HTMLTextAreaElement,
    event?: KeyboardEvent
  ): void {
    if (
      event &&
      (event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === 'Escape')
    ) {
      return;
    }
    this.evaluateBracketAutocomplete(textarea);
  }

  private evaluateBracketAutocomplete(textarea: HTMLTextAreaElement): void {
    const cursor = textarea.selectionStart ?? this.nodeForm.description.length;
    const textBeforeCursor = this.nodeForm.description.slice(0, cursor);
    const lastOpenBracket = textBeforeCursor.lastIndexOf('[');
    const lastCloseBracket = textBeforeCursor.lastIndexOf(']');

    if (lastOpenBracket !== -1 && lastOpenBracket > lastCloseBracket) {
      const query = textBeforeCursor.slice(lastOpenBracket + 1);
      // Only keep autocomplete open if query doesn't contain newlines
      if (!query.includes('\n')) {
        this.bracketStartIndex.set(lastOpenBracket);
        this.bracketQuery.set(query);
        this.bracketSelectedIndex.set(0);
        this.bracketMenuOpen.set(true);
        return;
      }
    }

    this.bracketMenuOpen.set(false);
  }

  onDescriptionKeydown(
    event: KeyboardEvent,
    textarea: HTMLTextAreaElement
  ): void {
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
        this.bracketSelectedIndex.update(
          (i) => (i - 1 + matches.length) % matches.length
        );
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

  insertKeywordFromMenu(
    kw: KeywordDefinition,
    textarea: HTMLTextAreaElement
  ): void {
    const start = this.bracketStartIndex();
    const cursor = textarea.selectionStart ?? this.nodeForm.description.length;
    if (start < 0) return;

    const before = this.nodeForm.description.slice(0, start);
    const after = this.nodeForm.description.slice(cursor);
    const inserted = `[${kw.term}]`;

    this.nodeForm.description = `${before}${inserted}${after}`;
    this.bracketMenuOpen.set(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  appendKeywordChip(kw: KeywordDefinition, textarea: HTMLTextAreaElement): void {
    const cursor = textarea.selectionStart ?? this.nodeForm.description.length;
    const before = this.nodeForm.description.slice(0, cursor);
    const after = this.nodeForm.description.slice(cursor);
    const needsSpace = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    const inserted = `${needsSpace}[${kw.term}] `;

    this.nodeForm.description = `${before}${inserted}${after}`;
    this.bracketMenuOpen.set(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  // ===========================================================================
  // SPECIAL WORD / KEYWORD MODAL ACTIONS
  // ===========================================================================
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

  async deleteKeyword(kw: KeywordDefinition): Promise<void> {
    await this.compendiumStore.deleteKeyword(kw);
  }

  // ===========================================================================
  // COMPOSABLE RULE HOOK ROW ACTIONS
  // ===========================================================================
  addRuleHookRow(): void {
    const usedKeys = new Set(this.hookRows().map((r) => r.key));
    const nextDef =
      RULE_HOOK_DEFINITIONS.find((d) => !usedKeys.has(d.key)) ??
      RULE_HOOK_DEFINITIONS[0];

    this.hookRows.update((rows) => [
      ...rows,
      {
        key: nextDef.key,
        numValue:
          typeof nextDef.defaultValue === 'number' ? nextDef.defaultValue : 1,
        statusValue:
          typeof nextDef.defaultValue === 'string'
            ? nextDef.defaultValue
            : 'Sundered',
      },
    ]);
  }

  removeRuleHookRow(index: number): void {
    this.hookRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateRowKey(index: number, newKey: EditableRuleHookKey): void {
    const def = this.getHookDef(newKey);
    this.hookRows.update((rows) =>
      rows.map((row, i) =>
        i === index
          ? {
              key: newKey,
              numValue:
                typeof def?.defaultValue === 'number' ? def.defaultValue : 1,
              statusValue:
                typeof def?.defaultValue === 'string'
                  ? def.defaultValue
                  : 'Sundered',
            }
          : row
      )
    );
  }

  updateRowNum(index: number, value: number): void {
    this.hookRows.update((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, numValue: Number(value) } : row
      )
    );
  }

  updateRowStatus(index: number, statusValue: RuleHookRow['statusValue']): void {
    this.hookRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, statusValue } : row))
    );
  }

  // Tree Modal Actions
  openNewTreeModal(): void {
    this.compendiumStore.clearMessages();
    this.editingTreeId.set(null);
    this.treeFormName = '';
    this.treeFormDescription = '';
    this.treeFormIcon = 'greatsword';
    this.treeFormColor = '#FF8C5A';
    this.treeFormTintCustom = true;
    this.treeModalOpen.set(true);
  }

  openEditTreeModal(tree: SkillTreeModel): void {
    this.compendiumStore.clearMessages();
    this.editingTreeId.set(tree.id);
    this.treeFormName = tree.name;
    this.treeFormDescription = tree.description;
    const visuals = resolveTreeVisuals(tree);
    this.treeFormIcon = visuals.icon;
    this.treeFormColor = visuals.color;
    this.treeFormTintCustom = visuals.tintCustom;
    this.treeModalOpen.set(true);
  }

  closeTreeModal(): void {
    this.treeModalOpen.set(false);
  }

  async saveTree(): Promise<void> {
    const editId = this.editingTreeId();
    if (editId) {
      const ok = await this.compendiumStore.updateSkillTree(editId, {
        name: this.treeFormName,
        description: this.treeFormDescription,
        icon: this.treeFormIcon,
        icon_color: this.treeFormColor,
        icon_tint_custom: this.treeFormTintCustom,
      });
      if (ok) this.closeTreeModal();
    } else {
      const created = await this.compendiumStore.createSkillTree({
        name: this.treeFormName,
        description: this.treeFormDescription,
        icon: this.treeFormIcon,
        icon_color: this.treeFormColor,
        icon_tint_custom: this.treeFormTintCustom,
      });
      if (created) this.closeTreeModal();
    }
  }

  async confirmDeleteTree(tree: SkillTreeModel): Promise<void> {
    await this.compendiumStore.deleteSkillTree(tree.id);
    if (this.activeTreeId() === tree.id) {
      this.activeTreeId.set(null);
    }
  }

  // Node Modal Actions
  openNewNodeModal(defaultTreeId?: string): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    this.bracketMenuOpen.set(false);
    const firstTreeId =
      defaultTreeId ??
      this.activeTreeId() ??
      this.compendiumStore.skillTrees()[0]?.id ??
      '';

    this.nodeForm = {
      tree_id: firstTreeId,
      name: '',
      node_type: 'combat_art',
      tier: 1,
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: 'Crushing',
      description: '',
      parent_node_id: null,
      icon: 'greatsword',
      icon_color: '#FF8C5A',
      icon_tint_custom: true,
    };
    this.hookRows.set([]);
    this.nodeModalOpen.set(true);
  }

  openBranchChildModal(parentNode: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    this.bracketMenuOpen.set(false);

    const parentVis = resolveNodeVisuals(parentNode);
    this.nodeForm = {
      tree_id: parentNode.tree_id,
      name: '',
      node_type: parentNode.node_type,
      tier: Math.min(5, parentNode.tier + 1),
      perk_cost: 1,
      ap_cost: 2,
      cooldown_rounds: 3,
      combat_tag: parentNode.combat_tag ?? 'Crushing',
      description: '',
      parent_node_id: parentNode.id,
      icon: parentVis.icon,
      icon_color: parentVis.color,
      icon_tint_custom: parentVis.tintCustom,
    };
    this.hookRows.set([]);
    this.nodeModalOpen.set(true);
  }

  openEditNodeModal(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(node.id);
    this.bracketMenuOpen.set(false);

    const visuals = resolveNodeVisuals(node);
    this.nodeForm = {
      tree_id: node.tree_id,
      name: node.name,
      node_type: node.node_type,
      tier: node.tier,
      perk_cost: node.perk_cost ?? 1,
      ap_cost: node.ap_cost ?? 1,
      cooldown_rounds: node.cooldown_rounds ?? 2,
      combat_tag: node.combat_tag ?? 'None',
      description: node.description,
      parent_node_id: node.parent_node_id ?? null,
      icon: visuals.icon,
      icon_color: visuals.color,
      icon_tint_custom: visuals.tintCustom,
    };

    this.hookRows.set(hooksObjectToRows(node.rule_hooks));
    this.nodeModalOpen.set(true);
  }

  closeNodeModal(): void {
    this.bracketMenuOpen.set(false);
    this.nodeModalOpen.set(false);
  }

  async saveNode(): Promise<void> {
    const compiledHooks = rowsToHooksObject(
      this.hookRows(),
      this.nodeForm.node_type,
      this.nodeForm.combat_tag
    );

    const payload = {
      tree_id: this.nodeForm.tree_id,
      name: this.nodeForm.name,
      node_type: this.nodeForm.node_type,
      tier: Number(this.nodeForm.tier) || 1,
      perk_cost: Number(this.nodeForm.perk_cost) || 1,
      ap_cost:
        this.nodeForm.node_type === 'combat_art' ? Number(this.nodeForm.ap_cost) : null,
      cooldown_rounds:
        this.nodeForm.node_type === 'combat_art'
          ? Number(this.nodeForm.cooldown_rounds)
          : null,
      combat_tag:
        this.nodeForm.node_type === 'combat_art' ? this.nodeForm.combat_tag : 'None',
      description: this.nodeForm.description,
      rule_hooks: compiledHooks,
      parent_node_id: this.nodeForm.parent_node_id || null,
      icon: this.nodeForm.icon,
      icon_color: this.nodeForm.icon_color,
      icon_tint_custom: this.nodeForm.icon_tint_custom,
    };

    const editId = this.editingNodeId();
    if (editId) {
      const ok = await this.compendiumStore.updatePerkNode(editId, payload);
      if (ok) this.closeNodeModal();
    } else {
      const created = await this.compendiumStore.createPerkNode(payload);
      if (created) this.closeNodeModal();
    }
  }

  async confirmDeleteNode(node: PerkNodeModel): Promise<void> {
    await this.compendiumStore.deletePerkNode(node.id);
  }
}
