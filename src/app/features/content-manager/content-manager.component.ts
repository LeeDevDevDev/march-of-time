import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CombatTag,
  EditableRuleHookKey,
  PerkNodeModel,
  PerkRuleHooks,
  RULE_HOOK_DEFINITIONS,
  RuleHookDefinition,
  RuleHookRow,
  SkillTreeModel,
  formatRuleHookBadges,
  hooksObjectToRows,
  rowsToHooksObject,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';

@Component({
  selector: 'app-content-manager',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <!-- Top Admin Header Banner -->
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
              Create and rebalance Skill Trees, Combat Arts, Passive Upgrades, and composable Rule Hooks that automatically drive Character Creation and Sheet math.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              (click)="openNewTreeModal()"
              class="rounded-lg border border-[#243B37] bg-[#0D1615] px-4 py-2.5 text-xs font-semibold text-[#EBF5F3] transition-colors hover:border-[#C4491A]"
            >
              + New Skill Tree
            </button>
            <button
              type="button"
              (click)="openNewNodeModal()"
              class="btn-copper rounded-lg px-4 py-2.5 text-xs font-semibold"
            >
              + New Combat Art / Perk
            </button>
          </div>
        </div>
      </section>

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

      <!-- Skill Tree Filter Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="selectedTreeId.set('ALL')"
            class="rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors"
            [class.border-[#C4491A]]="selectedTreeId() === 'ALL'"
            [class.bg-[#C4491A]]="selectedTreeId() === 'ALL'"
            [class.text-white]="selectedTreeId() === 'ALL'"
            [class.border-[var(--mot-border)]]="selectedTreeId() !== 'ALL'"
            [class.bg-[var(--mot-surface)]]="selectedTreeId() !== 'ALL'"
            [class.text-[var(--mot-text)]]="selectedTreeId() !== 'ALL'"
          >
            All Skill Trees ({{ compendiumStore.skillTrees().length }})
          </button>

          @for (tree of compendiumStore.skillTrees(); track tree.id) {
            <button
              type="button"
              (click)="selectedTreeId.set(tree.id)"
              class="rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors"
              [class.border-[#C4491A]]="selectedTreeId() === tree.id"
              [class.bg-[#C4491A]]="selectedTreeId() === tree.id"
              [class.text-white]="selectedTreeId() === tree.id"
              [class.border-[var(--mot-border)]]="selectedTreeId() !== tree.id"
              [class.bg-[var(--mot-surface)]]="selectedTreeId() !== tree.id"
              [class.text-[var(--mot-text)]]="selectedTreeId() !== tree.id"
            >
              {{ tree.name }} ({{ getPerksForTree(tree.id).length }})
            </button>
          }
        </div>

        <span class="font-mono-num text-xs text-[var(--mot-muted)]">
          Total Nodes: {{ compendiumStore.perkNodes().length }}
        </span>
      </div>

      <!-- Skill Trees & Their Tiered Nodes -->
      <div class="space-y-6">
        @for (tree of visibleTrees(); track tree.id) {
          <section
            class="overflow-hidden rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)]"
          >
            <!-- Tree Header -->
            <div
              class="flex flex-col justify-between gap-3 border-b border-[var(--mot-border)] bg-[var(--mot-well)] px-6 py-4 sm:flex-row sm:items-center"
            >
              <div>
                <div class="flex flex-wrap items-center gap-2.5">
                  <h2 class="font-display text-xl font-bold text-[var(--mot-text)]">
                    {{ tree.name }}
                  </h2>
                  <span
                    class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-mono-num text-xs text-[var(--mot-muted)]"
                  >
                    {{ getPerksForTree(tree.id).length }}
                    {{ getPerksForTree(tree.id).length === 1 ? 'Node' : 'Nodes' }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-[var(--mot-muted)]">
                  {{ tree.description }}
                </p>
              </div>

              <div class="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  (click)="openNewNodeModal(tree.id)"
                  class="btn-copper rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  + Add Node to Tree
                </button>
                <button
                  type="button"
                  (click)="openEditTreeModal(tree)"
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--mot-text)] hover:border-[#C4491A]"
                >
                  Edit Tree
                </button>
                <button
                  type="button"
                  (click)="confirmDeleteTree(tree)"
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--mot-hp-text)] hover:border-[var(--mot-hp)]"
                >
                  Delete
                </button>
              </div>
            </div>

            <!-- Nodes inside this Tree -->
            <div class="p-6">
              @if (getPerksForTree(tree.id).length === 0) {
                <div
                  class="rounded-xl border border-dashed border-[var(--mot-border)] bg-[var(--mot-well)] p-8 text-center"
                >
                  <p class="font-display text-sm font-bold text-[var(--mot-text)]">
                    No Combat Arts or Passive Nodes in {{ tree.name }} yet
                  </p>
                  <p class="mt-1 text-xs text-[var(--mot-muted)]">
                    Add your first Tier 1 Combat Art or Passive Upgrade to make it selectable during Character Creation.
                  </p>
                  <button
                    type="button"
                    (click)="openNewNodeModal(tree.id)"
                    class="btn-copper mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
                  >
                    + Create First Node
                  </button>
                </div>
              } @else {
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  @for (node of getPerksForTree(tree.id); track node.id) {
                    <article
                      class="flex flex-col justify-between rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 transition-colors hover:border-[#C4491A]"
                    >
                      <div>
                        <!-- Top Badges: Tier, Type, Cost, AP, Cooldown, Combat Tag -->
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="flex flex-wrap items-center gap-1.5 font-mono-num text-xs">
                            <span
                              class="rounded bg-[#122220] px-2 py-0.5 font-bold text-[#FF8C5A]"
                            >
                              Tier {{ node.tier }}
                            </span>
                            <span
                              class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-semibold text-[var(--mot-text)]"
                            >
                              {{ node.node_type === 'combat_art' ? 'Combat Art' : 'Passive' }}
                            </span>
                            <span
                              class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 text-[var(--mot-muted)]"
                            >
                              {{ node.perk_cost }} {{ node.perk_cost === 1 ? 'Perk' : 'Perks' }}
                            </span>
                          </div>

                          @if (node.node_type === 'combat_art') {
                            <div class="flex flex-wrap items-center gap-1.5 font-mono-num text-xs">
                              @if (node.combat_tag && node.combat_tag !== 'None') {
                                <span
                                  class="rounded border border-[#C4491A] bg-[var(--mot-surface)] px-2 py-0.5 font-bold text-[var(--mot-accent-text)]"
                                >
                                  [{{ node.combat_tag }}]
                                </span>
                              }
                              @if (node.ap_cost !== null) {
                                <span
                                  class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-bold text-[var(--mot-text)]"
                                >
                                  {{ node.ap_cost }} AP
                                </span>
                              }
                              @if (node.cooldown_rounds) {
                                <span
                                  class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 text-[var(--mot-muted)]"
                                >
                                  {{ node.cooldown_rounds }}R CD
                                </span>
                              }
                            </div>
                          }
                        </div>

                        <!-- Node Title & Prerequisite -->
                        <h3 class="mt-2.5 font-display text-base font-bold text-[var(--mot-text)]">
                          {{ node.name }}
                        </h3>

                        @if (getParentNodeName(node.parent_node_id); as parentName) {
                          <div class="mt-0.5 font-mono-num text-xs font-semibold text-[var(--mot-accent-text)]">
                            Requires: {{ parentName }}
                          </div>
                        }

                        <p class="mt-1.5 text-xs leading-relaxed text-[var(--mot-muted)]">
                          {{ node.description }}
                        </p>

                        <!-- Structured Rule Hook Badges -->
                        @if (getHookBadges(node.rule_hooks).length > 0) {
                          <div class="mt-3 flex flex-wrap gap-1.5">
                            @for (badge of getHookBadges(node.rule_hooks); track badge) {
                              <span
                                class="rounded-md border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-mono-num text-xs font-bold text-[var(--mot-sp-text)]"
                              >
                                {{ badge }}
                              </span>
                            }
                          </div>
                        }
                      </div>

                      <!-- Edit / Delete Controls -->
                      <div
                        class="mt-4 flex items-center justify-end gap-2 border-t border-[var(--mot-border)] pt-3"
                      >
                        <button
                          type="button"
                          (click)="openEditNodeModal(node)"
                          class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-1 text-xs font-semibold text-[var(--mot-text)] hover:border-[#C4491A]"
                        >
                          Edit Node
                        </button>
                        <button
                          type="button"
                          (click)="confirmDeleteNode(node)"
                          class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-1 text-xs font-semibold text-[var(--mot-hp-text)] hover:border-[var(--mot-hp)]"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  }
                </div>
              }
            </div>
          </section>
        }
      </div>

      <!-- =================================================================== -->
      <!-- MODAL 1: CREATE / EDIT SKILL TREE                                   -->
      <!-- =================================================================== -->
      @if (treeModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          (click)="closeTreeModal()"
        >
          <div
            class="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] text-[var(--mot-text)]"
            (click)="$event.stopPropagation()"
          >
            <div
              class="flex items-center justify-between border-b border-[#243B37] bg-[#122220] px-6 py-4 text-white"
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
                  {{ editingNodeId() ? 'Edit Skill Tree Node' : 'Create Combat Art / Perk Node' }}
                </h2>
                <p class="text-xs text-[#8AB0AB]">
                  Configure action costs, tags, and composable rule hooks for automatic sheet math.
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
                    Prerequisite Parent Node (Optional)
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

                <div class="sm:col-span-2">
                  <label for="nodeDesc" class="block text-xs font-bold text-[var(--mot-text)]">
                    Rules Description
                  </label>
                  <textarea
                    id="nodeDesc"
                    name="nodeDesc"
                    rows="2"
                    required
                    [(ngModel)]="nodeForm.description"
                    placeholder="Clear tactical summary shown in Character Creation and on the Character Sheet..."
                    class="mot-input mt-1.5 px-3.5 py-2 text-sm"
                  ></textarea>
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

              <!-- Section 3: Composable Rule Hook Builder (Foundry VTT / D&D Beyond Style) -->
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
                    <strong class="text-[var(--mot-text)]">+ Add Rule Hook</strong> to attach automatic bonuses (e.g. +2 Max SP, +2 SP DMG, Push 1 Tile).
                  </div>
                } @else {
                  <div class="space-y-2.5">
                    @for (row of hookRows(); track $index; let idx = $index) {
                      <div
                        class="flex flex-col gap-2 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] p-3 sm:flex-row sm:items-center"
                      >
                        <!-- Hook Type Selector -->
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

                        <!-- Hook Value Input (Number or Status Select) -->
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

                        <!-- Remove Hook Button -->
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

                <!-- Live Compiled Badges Preview -->
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
    </div>
  `,
})
export class ContentManagerComponent implements OnInit {
  readonly compendiumStore = inject(CompendiumStore);

  readonly ruleHookDefinitions = RULE_HOOK_DEFINITIONS;
  readonly sheetStatHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Sheet Stat Bonus'
  );
  readonly combatEffectHookDefs = RULE_HOOK_DEFINITIONS.filter(
    (d) => d.category === 'Combat Art Effect'
  );

  readonly selectedTreeId = signal<string>('ALL');

  readonly visibleTrees = computed(() => {
    const all = this.compendiumStore.skillTrees();
    const sel = this.selectedTreeId();
    if (sel === 'ALL') return all;
    return all.filter((t) => t.id === sel);
  });

  // Tree Modal State
  readonly treeModalOpen = signal(false);
  readonly editingTreeId = signal<string | null>(null);
  treeFormName = '';
  treeFormDescription = '';

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

  getPerksForTree(treeId: string): PerkNodeModel[] {
    return this.compendiumStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  getParentNodeName(parentId: string | null | undefined): string | null {
    if (!parentId) return null;
    return this.compendiumStore.perkNodes().find((p) => p.id === parentId)?.name ?? null;
  }

  getHookBadges(hooks: PerkRuleHooks | undefined | null): string[] {
    return formatRuleHookBadges(hooks);
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

  // Composable Rule Hook Row Actions
  addRuleHookRow(): void {
    const usedKeys = new Set(this.hookRows().map((r) => r.key));
    const nextDef =
      RULE_HOOK_DEFINITIONS.find((d) => !usedKeys.has(d.key)) ?? RULE_HOOK_DEFINITIONS[0];

    this.hookRows.update((rows) => [
      ...rows,
      {
        key: nextDef.key,
        numValue: typeof nextDef.defaultValue === 'number' ? nextDef.defaultValue : 1,
        statusValue:
          typeof nextDef.defaultValue === 'string' ? nextDef.defaultValue : 'Sundered',
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
              numValue: typeof def?.defaultValue === 'number' ? def.defaultValue : 1,
              statusValue:
                typeof def?.defaultValue === 'string' ? def.defaultValue : 'Sundered',
            }
          : row
      )
    );
  }

  updateRowNum(index: number, value: number): void {
    this.hookRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, numValue: Number(value) } : row))
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
    this.treeModalOpen.set(true);
  }

  openEditTreeModal(tree: SkillTreeModel): void {
    this.compendiumStore.clearMessages();
    this.editingTreeId.set(tree.id);
    this.treeFormName = tree.name;
    this.treeFormDescription = tree.description;
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
      });
      if (ok) this.closeTreeModal();
    } else {
      const created = await this.compendiumStore.createSkillTree({
        name: this.treeFormName,
        description: this.treeFormDescription,
      });
      if (created) this.closeTreeModal();
    }
  }

  async confirmDeleteTree(tree: SkillTreeModel): Promise<void> {
    await this.compendiumStore.deleteSkillTree(tree.id);
    if (this.selectedTreeId() === tree.id) {
      this.selectedTreeId.set('ALL');
    }
  }

  // Node Modal Actions
  openNewNodeModal(defaultTreeId?: string): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
    const firstTreeId =
      defaultTreeId ??
      (this.selectedTreeId() !== 'ALL'
        ? this.selectedTreeId()
        : this.compendiumStore.skillTrees()[0]?.id ?? '');

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
    };
    this.hookRows.set([]);
    this.nodeModalOpen.set(true);
  }

  openEditNodeModal(node: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(node.id);

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
    };

    this.hookRows.set(hooksObjectToRows(node.rule_hooks));
    this.nodeModalOpen.set(true);
  }

  closeNodeModal(): void {
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
