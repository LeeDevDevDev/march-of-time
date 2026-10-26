import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import {
  CombatTag,
  EditableRuleHookKey,
  PerkNodeModel,
  PerkRuleHooks,
  RULE_HOOK_DEFINITIONS,
  RuleHookDefinition,
  RuleHookRow,
  SkillTreeBranchNode,
  SkillTreeModel,
  buildSkillTreeHierarchy,
  formatRuleHookBadges,
  getTreeArchetypeIcon,
  hooksObjectToRows,
  rowsToHooksObject,
} from '../../core/compendium/compendium.model';
import { CompendiumStore } from '../../core/compendium/compendium.store';

@Component({
  selector: 'app-content-manager',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
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
      <!-- VIEW 1: SKILL TREE GALLERY CARDS (When no tree is opened)         -->
      <!-- ================================================================= -->
      @if (!activeTree()) {
        <!-- Top Admin Header Banner -->
        <section
          class="overflow-hidden rounded-2xl border border-[#243B37] bg-[#122220] p-6 sm:p-8 text-[#EBF5F3]"
        >
          <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div class="flex flex-wrap items-center gap-2.5">
                <h1 class="font-display text-2xl font-bold text-white sm:text-3xl">
                  Content Manager — Skill Trees
                </h1>
                <span
                  class="rounded-md border border-[#C4491A] bg-[#0D1615] px-2.5 py-0.5 font-mono-num text-xs font-bold text-[#FF8C5A]"
                >
                  Admin Studio
                </span>
              </div>
              <p class="mt-1.5 max-w-2xl text-sm text-[#8AB0AB]">
                Select a martial Skill Tree below to open its interactive branching tree, or create a new path.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                (click)="openNewTreeModal()"
                class="btn-copper rounded-lg px-4 py-2.5 text-xs font-semibold"
              >
                + New Skill Tree
              </button>
            </div>
          </div>
        </section>

        <!-- Skill Tree Cards Grid -->
        <section class="grid grid-cols-1 gap-5 md:grid-cols-3">
          @for (tree of compendiumStore.skillTrees(); track tree.id) {
            <article
              class="group flex flex-col justify-between rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-6 transition-all hover:border-[#C4491A]"
            >
              <div>
                <!-- Icon Emblem & Node Count Pill -->
                <div class="flex items-start justify-between gap-3">
                  <div
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#243B37] bg-[#122220] text-[#FF8C5A] transition-colors group-hover:border-[#C4491A] group-hover:bg-[#C4491A] group-hover:text-white"
                  >
                    @switch (getArchetypeIcon(tree)) {
                      @case ('breaker') {
                        <!-- Warhammer / Shatter Crest -->
                        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                          <path d="M14.5 3.5L20.5 9.5L17 13L11 7L14.5 3.5Z" />
                          <path d="M12.5 8.5L4 17L7 20L15.5 11.5" />
                          <path d="M3 21L5.5 18.5" />
                        </svg>
                      }
                      @case ('veil') {
                        <!-- Twin Daggers / Veil Crest -->
                        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                          <path d="M19 3L9 13L11 15L21 5L19 3Z" />
                          <path d="M7 11L13 17" />
                          <path d="M5 19L9 15" />
                          <path d="M3 14L10 7" />
                        </svg>
                      }
                      @case ('gale') {
                        <!-- Crescent Gale / Wind Swirl Crest -->
                        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                          <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
                          <path d="M12.59 19.41A2 2 0 1 0 14 16H2" />
                          <path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2" />
                        </svg>
                      }
                      @default {
                        <!-- Sentinel Shield Crest -->
                        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      }
                    }
                  </div>

                  <span
                    class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1 font-mono-num text-xs font-bold text-[var(--mot-text)] tabular-nums"
                  >
                    {{ getPerksForTree(tree.id).length }}
                    {{ getPerksForTree(tree.id).length === 1 ? 'Node' : 'Nodes' }}
                  </span>
                </div>

                <!-- Tree Name & Description -->
                <h2 class="mt-4 font-display text-xl font-bold text-[var(--mot-text)]">
                  {{ tree.name }}
                </h2>
                <p class="mt-1.5 text-xs leading-relaxed text-[var(--mot-muted)]">
                  {{ tree.description }}
                </p>

                <!-- Breakdown Pills (Combat Arts vs Passives) -->
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

              <!-- Card Footer Actions -->
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

      <!-- ================================================================= -->
      <!-- VIEW 2: INTERACTIVE VISUAL SKILL TREE CANVAS                      -->
      <!-- ================================================================= -->
      @if (activeTree(); as tree) {
        <!-- Tree Studio Header -->
        <section
          class="overflow-hidden rounded-2xl border border-[#243B37] bg-[#122220] p-6 text-[#EBF5F3]"
        >
          <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div class="flex items-start gap-4">
              <button
                type="button"
                (click)="closeSkillTreeView()"
                class="mt-0.5 flex h-10 items-center gap-1.5 rounded-xl border border-[#243B37] bg-[#0D1615] px-3.5 text-xs font-bold text-[#EBF5F3] transition-colors hover:border-[#C4491A]"
              >
                ← All Trees
              </button>

              <div>
                <div class="flex flex-wrap items-center gap-2.5">
                  <h1 class="font-display text-2xl font-bold text-white">
                    {{ tree.name }}
                  </h1>
                  <span
                    class="rounded-md border border-[#243B37] bg-[#0D1615] px-2.5 py-0.5 font-mono-num text-xs font-bold text-[#FF8C5A]"
                  >
                    {{ getPerksForTree(tree.id).length }} Nodes
                  </span>
                </div>
                <p class="mt-1 text-xs text-[#8AB0AB]">
                  {{ tree.description }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                (click)="openEditTreeModal(tree)"
                class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3.5 py-2 text-xs font-semibold text-[#EBF5F3] hover:border-[#C4491A]"
              >
                Edit Tree Info
              </button>
              <button
                type="button"
                (click)="openNewNodeModal(tree.id)"
                class="btn-copper rounded-lg px-4 py-2 text-xs font-semibold"
              >
                + Add Root Node (Tier 1)
              </button>
            </div>
          </div>
        </section>

        <!-- Visual Branching Skill Tree Canvas -->
        <section
          class="overflow-x-auto rounded-2xl border border-[#243B37] bg-[#0D1615] p-6 sm:p-10 text-[#EBF5F3]"
          style="background-image: radial-gradient(#243B37 1px, transparent 1px); background-size: 24px 24px;"
        >
          @if (activeTreeBranches().length === 0) {
            <div
              class="mx-auto max-w-md rounded-2xl border border-dashed border-[#243B37] bg-[#122220]/90 p-8 text-center"
            >
              <h2 class="font-display text-lg font-bold text-white">
                This Skill Tree Is Empty
              </h2>
              <p class="mt-1 text-xs text-[#8AB0AB]">
                Start by placing a Tier 1 root Combat Art or Passive Upgrade, then branch child nodes directly off it.
              </p>
              <button
                type="button"
                (click)="openNewNodeModal(tree.id)"
                class="btn-copper mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
              >
                + Place First Tier 1 Node
              </button>
            </div>
          } @else {
            <!-- Legend Bar -->
            <div
              class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#243B37] pb-4 text-xs text-[#8AB0AB]"
            >
              <div class="flex flex-wrap items-center gap-4">
                <span class="flex items-center gap-2">
                  <span class="h-3 w-3 rounded-sm bg-[#C4491A]"></span>
                  <strong class="text-white">Combat Art</strong> (Active AP &amp; Cooldown)
                </span>
                <span class="flex items-center gap-2">
                  <span class="h-3 w-3 rounded-full bg-[#38B29A]"></span>
                  <strong class="text-white">Passive Upgrade</strong> (Permanent Stat Bonus)
                </span>
              </div>
              <span class="font-mono-num">
                Click <strong>+ Branch</strong> on any node to grow a connected child node below it.
              </span>
            </div>

            <!-- Root Columns (Each Root Node & Its Connected Descendants) -->
            <div class="flex min-w-max items-start justify-center gap-10 pb-4">
              @for (rootBranch of activeTreeBranches(); track rootBranch.node.id) {
                <ng-container
                  *ngTemplateOutlet="branchTemplate; context: { $implicit: rootBranch }"
                ></ng-container>
              }
            </div>
          }
        </section>
      }

      <!-- ================================================================= -->
      <!-- RECURSIVE VISUAL TREE BRANCH TEMPLATE                             -->
      <!-- ================================================================= -->
      <ng-template #branchTemplate let-branch>
        <div class="flex flex-col items-center">
          <!-- The Skill Node Card -->
          <div
            class="relative w-72 rounded-2xl border bg-[#122220] p-4 text-left transition-all"
            [class.border-[#C4491A]]="branch.node.node_type === 'combat_art'"
            [class.border-[#2A6F62]]="branch.node.node_type === 'passive_upgrade'"
          >
            <!-- Top Row: Node Medallion + Tier + Cost -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <!-- Medallion Icon -->
                @if (branch.node.node_type === 'combat_art') {
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C4491A] text-white"
                    title="Active Combat Art"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </span>
                } @else {
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#38B29A] bg-[#0D1615] text-[#38B29A]"
                    title="Passive Upgrade"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                }

                <div>
                  <span class="block font-mono-num text-[11px] font-bold text-[#8AB0AB]">
                    Tier {{ branch.node.tier }} ·
                    {{ branch.node.node_type === 'combat_art' ? 'Combat Art' : 'Passive' }}
                  </span>
                  <h3 class="font-display text-base font-bold leading-tight text-white">
                    {{ branch.node.name }}
                  </h3>
                </div>
              </div>

              <span
                class="rounded-md border border-[#243B37] bg-[#0D1615] px-2 py-0.5 font-mono-num text-xs font-bold text-[#EBF5F3]"
              >
                {{ branch.node.perk_cost }} {{ branch.node.perk_cost === 1 ? 'Pt' : 'Pts' }}
              </span>
            </div>

            <!-- Action Economy & Combat Tag Bar (For Combat Arts) -->
            @if (branch.node.node_type === 'combat_art') {
              <div class="mt-3 flex flex-wrap items-center gap-1.5 font-mono-num text-xs">
                @if (branch.node.combat_tag && branch.node.combat_tag !== 'None') {
                  <span
                    class="rounded border border-[#C4491A] bg-[#0D1615] px-2 py-0.5 font-bold text-[#FF8C5A]"
                  >
                    [{{ branch.node.combat_tag }}]
                  </span>
                }
                <span
                  class="rounded border border-[#243B37] bg-[#0D1615] px-2 py-0.5 font-bold text-white"
                >
                  {{ branch.node.ap_cost ?? 1 }} AP
                </span>
                @if (branch.node.cooldown_rounds) {
                  <span
                    class="rounded border border-[#243B37] bg-[#0D1615] px-2 py-0.5 text-[#8AB0AB]"
                  >
                    {{ branch.node.cooldown_rounds }}R CD
                  </span>
                }
              </div>
            }

            <!-- Node Description -->
            <p class="mt-2.5 text-xs leading-relaxed text-[#8AB0AB]">
              {{ branch.node.description }}
            </p>

            <!-- Compiled Rule Hook Badges -->
            @if (getHookBadges(branch.node.rule_hooks).length > 0) {
              <div class="mt-3 flex flex-wrap gap-1.5">
                @for (badge of getHookBadges(branch.node.rule_hooks); track badge) {
                  <span
                    class="rounded border border-[#243B37] bg-[#0D1615] px-2 py-0.5 font-mono-num text-xs font-bold text-[#38B29A]"
                  >
                    {{ badge }}
                  </span>
                }
              </div>
            }

            <!-- Node Action Bar: Branch Child, Edit, Delete -->
            <div
              class="mt-4 flex items-center justify-between gap-1.5 border-t border-[#243B37] pt-3"
            >
              <button
                type="button"
                (click)="openBranchChildModal(branch.node)"
                class="rounded-lg border border-[#C4491A] bg-[#0D1615] px-2.5 py-1 font-mono-num text-xs font-bold text-[#FF8C5A] transition-colors hover:bg-[#C4491A] hover:text-white"
              >
                + Branch Tier {{ branch.node.tier + 1 }}
              </button>

              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="openEditNodeModal(branch.node)"
                  class="rounded-lg border border-[#243B37] bg-[#0D1615] px-2.5 py-1 text-xs font-semibold text-[#EBF5F3] hover:border-[#C4491A]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  (click)="confirmDeleteNode(branch.node)"
                  class="rounded-lg border border-[#243B37] bg-[#0D1615] px-2.5 py-1 text-xs font-semibold text-[#F26464] hover:border-[#F26464]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          <!-- Visual Tree Connector Lines to Children -->
          @if (branch.children.length > 0) {
            <!-- Vertical Stem Down from Parent -->
            <div class="h-7 w-0.5 bg-[#C4491A]"></div>

            @if (branch.children.length === 1) {
              <!-- Single Child: Direct Vertical Line -->
              <ng-container
                *ngTemplateOutlet="branchTemplate; context: { $implicit: branch.children[0] }"
              ></ng-container>
            } @else {
              <!-- Multiple Children: Horizontal Crossbar + Vertical Drops -->
              <div class="relative flex items-start gap-8 pt-4">
                <!-- Horizontal Bar across children -->
                <div
                  class=" absolute left-1/2 top-0 h-0.5 -translate-x-1/2 bg-[#C4491A]"
                  style="width: calc(100% - 18rem);"
                ></div>

                @for (childBranch of branch.children; track childBranch.node.id) {
                  <div class="relative flex flex-col items-center">
                    <!-- Short Vertical Drop from Crossbar to Child -->
                    <div class="-mt-4 h-4 w-0.5 bg-[#C4491A]"></div>
                    <ng-container
                      *ngTemplateOutlet="branchTemplate; context: { $implicit: childBranch }"
                    ></ng-container>
                  </div>
                }
              </div>
            }
          }
        </div>
      </ng-template>

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
                  {{ editingNodeId() ? 'Edit Skill Tree Node' : 'Create Skill Tree Node' }}
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

  // Null = Gallery of Skill Tree Cards; String = Viewing that Skill Tree's visual branching diagram
  readonly activeTreeId = signal<string | null>(null);

  readonly activeTree = computed(() => {
    const id = this.activeTreeId();
    if (!id) return null;
    return this.compendiumStore.skillTrees().find((t) => t.id === id) ?? null;
  });

  readonly activeTreeBranches = computed<SkillTreeBranchNode[]>(() => {
    const tree = this.activeTree();
    if (!tree) return [];
    return buildSkillTreeHierarchy(tree.id, this.compendiumStore.perkNodes());
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
    if (this.activeTreeId() === tree.id) {
      this.activeTreeId.set(null);
    }
  }

  // Node Modal Actions
  openNewNodeModal(defaultTreeId?: string): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);
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
    };
    this.hookRows.set([]);
    this.nodeModalOpen.set(true);
  }

  /**
   * Opens the Create Node Modal pre-linked as a child branch below `parentNode`.
   */
  openBranchChildModal(parentNode: PerkNodeModel): void {
    this.compendiumStore.clearMessages();
    this.editingNodeId.set(null);

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
