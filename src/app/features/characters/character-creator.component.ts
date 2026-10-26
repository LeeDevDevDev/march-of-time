import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  ArmorTier,
  AttributeName,
  COMBAT_SKILL_LIST,
  CombatSkillName,
  CombatTag,
  FIELD_SKILL_LIST,
  FieldSkillName,
  PerkNodeModel,
  SHIELD_TIERS,
  ShieldTier,
  WeaponModel,
  computeDerivedStats,
  formatRuleHookBadges,
} from './models/character.model';
import { CharacterStore } from './store/character.store';

type CreatorStep = 1 | 2 | 3 | 4 | 5;

@Component({
  selector: 'app-character-creator',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <!-- Top Builder Header & Step Progress -->
      <section
        class="overflow-hidden rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)]"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-4 border-b border-[#243B37] bg-[#122220] px-6 py-5 text-[#EBF5F3]"
        >
          <div>
            <h1 class="font-display text-xl sm:text-2xl font-bold text-white">
              Character Creation
            </h1>
            <p class="mt-0.5 text-xs text-[#8AB0AB] tabular-nums">
              {{ name() || 'Unnamed Warden' }} · Level {{ level() }} · HP
              {{ liveDerived().maxHp }} · SP {{ liveDerived().maxSp }} · Move
              {{ liveDerived().moveTiles }} Tiles ({{ liveDerived().moveFeet }} ft)
            </p>
          </div>

          <a
            routerLink="/characters"
            class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3 py-1.5 text-xs font-semibold text-[#EBF5F3] no-underline hover:border-[#C4491A]"
          >
            Cancel
          </a>
        </div>

        <!-- 5-Step Progress Bar -->
        <div
          class="grid grid-cols-2 gap-2 border-b border-[var(--mot-border)] bg-[var(--mot-well)] p-3 sm:grid-cols-5"
        >
          @for (s of stepLabels; track s.step) {
            <button
              type="button"
              (click)="step.set(s.step)"
              [class]="
                step() === s.step
                  ? 'btn-copper flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold tabular-nums'
                  : 'flex items-center justify-between rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-3 py-2 text-left text-xs font-semibold text-[var(--mot-muted)] hover:text-[var(--mot-text)] tabular-nums'
              "
            >
              <span>{{ s.step }}. {{ s.title }}</span>
              @if (s.badge()) {
                <span class="font-mono-num text-xs font-bold">{{ s.badge() }}</span>
              }
            </button>
          }
        </div>

        <!-- STEP 1: IDENTITY & STARTING LEVEL -->
        @if (step() === 1) {
          <div class="p-6 sm:p-8 space-y-6">
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-12">
              <div class="sm:col-span-8">
                <label for="charName" class="block text-xs font-bold text-[var(--mot-text)]">
                  Character Name
                </label>
                <input
                  id="charName"
                  type="text"
                  [ngModel]="name()"
                  (ngModelChange)="name.set($event)"
                  placeholder="Enter character name..."
                  class="mot-input mt-1.5 px-4 py-2.5 text-base font-semibold"
                />
              </div>

              <div class="sm:col-span-4">
                <label for="charLevel" class="block text-xs font-bold text-[var(--mot-text)]">
                  Starting Level (1–10)
                </label>
                <select
                  id="charLevel"
                  [ngModel]="level()"
                  (ngModelChange)="level.set(Number($event))"
                  class="mot-input mt-1.5 px-3.5 py-2.5 font-mono-num text-sm font-bold tabular-nums"
                >
                  @for (lv of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; track lv) {
                    <option [ngValue]="lv">Level {{ lv }}</option>
                  }
                </select>
              </div>
            </div>

            <!-- Point Budgets Preview -->
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
              <div class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4">
                <div class="text-xs font-semibold text-[var(--mot-muted)]">Attribute Budget</div>
                <div class="mt-1 font-mono-num text-lg font-bold text-[var(--mot-accent-text)]">
                  {{ liveDerived().attributeBudget }} Points
                </div>
                <div class="mt-0.5 text-xs text-[var(--mot-muted)]">5 + INT((Lv−1)/2)</div>
              </div>

              <div class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4">
                <div class="text-xs font-semibold text-[var(--mot-muted)]">Combat Skill Budget</div>
                <div class="mt-1 font-mono-num text-lg font-bold text-[var(--mot-accent-text)]">
                  {{ liveDerived().combatSkillBudget }} Points
                </div>
                <div class="mt-0.5 text-xs text-[var(--mot-muted)]">2 + INT(Lv/2)</div>
              </div>

              <div class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4">
                <div class="text-xs font-semibold text-[var(--mot-muted)]">Field Skill Budget</div>
                <div class="mt-1 font-mono-num text-lg font-bold text-[var(--mot-accent-text)]">
                  {{ liveDerived().fieldSkillBudget }} Points
                </div>
                <div class="mt-0.5 text-xs text-[var(--mot-muted)]">4 + INT(Lv/2)</div>
              </div>

              <div class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4">
                <div class="text-xs font-semibold text-[var(--mot-muted)]">Skill Tree Perks</div>
                <div class="mt-1 font-mono-num text-lg font-bold text-[var(--mot-accent-text)]">
                  {{ liveDerived().perkBudget }} Perks
                </div>
                <div class="mt-0.5 text-xs text-[var(--mot-muted)]">1 Perk per Level</div>
              </div>
            </div>
          </div>
        }

        <!-- STEP 2: 5 CORE ATTRIBUTES -->
        @if (step() === 2) {
          <div class="p-6 sm:p-8 space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-display text-lg font-bold text-[var(--mot-text)]">
                  Allocate Core Attributes
                </h2>
                <p class="text-xs text-[var(--mot-muted)]">
                  Governing attributes add directly to Attack Rolls, Flat Weapon Damage, Defenses, and Vitals.
                </p>
              </div>
              <span
                class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-1.5 font-mono-num text-sm font-bold text-[var(--mot-accent-text)] tabular-nums"
              >
                Spent: {{ liveDerived().attributeSpent }} / {{ liveDerived().attributeBudget }} pts
              </span>
            </div>

            <div class="space-y-3">
              @for (attr of attributeList; track attr.name) {
                <div
                  class="flex items-center justify-between gap-4 rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4"
                >
                  <div>
                    <div class="text-sm font-bold text-[var(--mot-text)]">{{ attr.name }}</div>
                    <p class="mt-0.5 text-xs text-[var(--mot-muted)]">{{ attr.summary }}</p>
                  </div>

                  <div class="flex shrink-0 items-center gap-2.5 tabular-nums">
                    <button
                      type="button"
                      (click)="adjustAttribute(attr.name, -1)"
                      [disabled]="attributes()[attr.name] <= 0"
                      class="h-8 w-8 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] font-mono-num text-sm font-bold text-[var(--mot-text)] disabled:opacity-40"
                    >
                      −
                    </button>
                    <span
                      class="w-8 text-center font-mono-num text-base font-bold text-[var(--mot-accent-text)]"
                    >
                      +{{ attributes()[attr.name] }}
                    </span>
                    <button
                      type="button"
                      (click)="adjustAttribute(attr.name, 1)"
                      [disabled]="
                        liveDerived().attributeSpent >= liveDerived().attributeBudget ||
                        attributes()[attr.name] >= 5
                      "
                      class="h-8 w-8 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] font-mono-num text-sm font-bold text-[var(--mot-text)] disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- STEP 3: COMBAT SKILLS (4) & FIELD SKILLS (10) -->
        @if (step() === 3) {
          <div class="p-6 sm:p-8 space-y-8">
            <!-- 4 Combat Skills -->
            <div class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="font-display text-lg font-bold text-[var(--mot-text)]">
                    Combat Skills (4)
                  </h2>
                  <p class="text-xs text-[var(--mot-muted)]">
                    Added to contested 2d10 Attack and Defense rolls. Higher of Parry or Dodge also increases Max SP.
                  </p>
                </div>
                <span
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-1.5 font-mono-num text-sm font-bold text-[var(--mot-accent-text)] tabular-nums"
                >
                  Spent: {{ liveDerived().combatSkillSpent }} /
                  {{ liveDerived().combatSkillBudget }} pts
                </span>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                @for (skill of combatSkillList; track skill.name) {
                  <div
                    class="flex items-center justify-between gap-3 rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4"
                  >
                    <div>
                      <div class="text-sm font-bold text-[var(--mot-text)]">{{ skill.name }}</div>
                      <p class="mt-0.5 text-xs text-[var(--mot-muted)]">{{ skill.summary }}</p>
                    </div>

                    <div class="flex shrink-0 items-center gap-2 tabular-nums">
                      <button
                        type="button"
                        (click)="adjustCombatSkill(skill.name, -1)"
                        [disabled]="combatSkills()[skill.name] <= 0"
                        class="h-8 w-8 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] font-mono-num text-sm font-bold text-[var(--mot-text)] disabled:opacity-40"
                      >
                        −
                      </button>
                      <span
                        class="w-7 text-center font-mono-num text-base font-bold text-[var(--mot-accent-text)]"
                      >
                        +{{ combatSkills()[skill.name] }}
                      </span>
                      <button
                        type="button"
                        (click)="adjustCombatSkill(skill.name, 1)"
                        [disabled]="
                          liveDerived().combatSkillSpent >= liveDerived().combatSkillBudget ||
                          combatSkills()[skill.name] >= 4
                        "
                        class="h-8 w-8 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] font-mono-num text-sm font-bold text-[var(--mot-text)] disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- 10 Field Skills -->
            <div class="space-y-4 border-t border-[var(--mot-border)] pt-6">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 class="font-display text-lg font-bold text-[var(--mot-text)]">
                    Field Skills (10)
                  </h2>
                  <p class="text-xs text-[var(--mot-muted)]">
                    Uses the higher of two governing attributes: 2d10 + MAX(Attr A, Attr B) + Rank.
                  </p>
                </div>
                <span
                  class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-1.5 font-mono-num text-sm font-bold text-[var(--mot-accent-text)] tabular-nums"
                >
                  Spent: {{ liveDerived().fieldSkillSpent }} /
                  {{ liveDerived().fieldSkillBudget }} pts
                </span>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                @for (fs of fieldSkillList; track fs.name) {
                  @if (liveDerived().fieldSkillTotals[fs.name]; as calc) {
                    <div
                      class="flex items-center justify-between gap-3 rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-3.5"
                    >
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-bold text-[var(--mot-text)]">
                            {{ fs.name }}
                          </span>
                          <span class="font-mono-num text-xs text-[var(--mot-muted)] tabular-nums">
                            ({{ calc.govAttr }} +{{ calc.govVal }})
                          </span>
                        </div>
                        <p class="mt-0.5 text-xs text-[var(--mot-muted)]">{{ fs.summary }}</p>
                      </div>

                      <div class="flex shrink-0 items-center gap-2 tabular-nums">
                        <span class="font-mono-num text-xs font-bold text-[var(--mot-accent-text)]">
                          2d10+{{ calc.total }}
                        </span>
                        <button
                          type="button"
                          (click)="adjustFieldSkill(fs.name, -1)"
                          [disabled]="fieldSkills()[fs.name] <= 0"
                          class="h-7 w-7 rounded-md border border-[var(--mot-border)] bg-[var(--mot-surface)] font-mono-num text-sm font-bold text-[var(--mot-text)] disabled:opacity-40"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          (click)="adjustFieldSkill(fs.name, 1)"
                          [disabled]="
                            liveDerived().fieldSkillSpent >= liveDerived().fieldSkillBudget ||
                            fieldSkills()[fs.name] >= 4
                          "
                          class="h-7 w-7 rounded-md border border-[var(--mot-border)] bg-[var(--mot-surface)] font-mono-num text-sm font-bold text-[var(--mot-text)] disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        }

        <!-- STEP 4: ARMOR, SHIELD & 2-WEAPON LOADOUT -->
        @if (step() === 4) {
          <div class="p-6 sm:p-8 space-y-6">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-bold text-[var(--mot-text)]">
                  Equipped Armor (Mitigates Direct Hit HP Damage)
                </label>
                <select
                  [ngModel]="equippedArmor()"
                  (ngModelChange)="equippedArmor.set($event)"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-semibold"
                >
                  @for (tier of armorKeys; track tier) {
                    <option [value]="tier">
                      {{ armorTiers[tier].label }} — {{ armorTiers[tier].description }}
                    </option>
                  }
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-[var(--mot-text)]">
                  Equipped Shield (Enables 1 AP Shield Block)
                </label>
                <select
                  [ngModel]="equippedShield()"
                  (ngModelChange)="equippedShield.set($event)"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-semibold"
                >
                  @for (tier of shieldKeys; track tier) {
                    <option [value]="tier">
                      {{ shieldTiers[tier].label }} — {{ shieldTiers[tier].description }}
                    </option>
                  }
                </select>
              </div>
            </div>

            <div class="border-t border-[var(--mot-border)] pt-6 space-y-4">
              <div>
                <h2 class="font-display text-lg font-bold text-[var(--mot-text)]">
                  Select 2-Weapon Loadout
                </h2>
                <p class="text-xs text-[var(--mot-muted)]">
                  Each character equips two weapons (Slot 1 &amp; Slot 2). Switching active weapons during combat costs 1 AP.
                </p>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <!-- Slot 1 -->
                <div class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 space-y-3">
                  <label class="block text-xs font-bold text-[var(--mot-accent-text)]">
                    Weapon Slot 1 (Primary)
                  </label>
                  <select
                    [ngModel]="weaponSlot1Id()"
                    (ngModelChange)="weaponSlot1Id.set($event)"
                    class="mot-input bg-[var(--mot-surface)] px-3 py-2 text-sm font-bold"
                  >
                    <option [ngValue]="null">— Select Weapon —</option>
                    @for (w of characterStore.weapons(); track w.id) {
                      <option [ngValue]="w.id">
                        {{ w.name }} ({{ w.ap_cost }} AP · Base {{ w.base_damage }} +
                        {{ w.gov_attribute }})
                      </option>
                    }
                  </select>

                  @if (liveDerived().weaponSlot1; as w1) {
                    <div class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] p-3 text-xs space-y-1 tabular-nums">
                      <div class="flex items-center justify-between font-mono-num font-bold text-[var(--mot-text)]">
                        <span>Roll: 2d10 + {{ getWeaponMod(w1) }}</span>
                        <span class="text-[var(--mot-accent-text)]">
                          Flat DMG: {{ getWeaponDamage(w1) }}
                        </span>
                      </div>
                      <p class="text-[var(--mot-muted)]">
                        <strong>{{ w1.trait_name }}:</strong> {{ w1.trait_description }}
                      </p>
                    </div>
                  }
                </div>

                <!-- Slot 2 -->
                <div class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 space-y-3">
                  <label class="block text-xs font-bold text-[var(--mot-accent-text)]">
                    Weapon Slot 2 (Secondary)
                  </label>
                  <select
                    [ngModel]="weaponSlot2Id()"
                    (ngModelChange)="weaponSlot2Id.set($event)"
                    class="mot-input bg-[var(--mot-surface)] px-3 py-2 text-sm font-bold"
                  >
                    <option [ngValue]="null">— Select Weapon —</option>
                    @for (w of characterStore.weapons(); track w.id) {
                      <option [ngValue]="w.id">
                        {{ w.name }} ({{ w.ap_cost }} AP · Base {{ w.base_damage }} +
                        {{ w.gov_attribute }})
                      </option>
                    }
                  </select>

                  @if (liveDerived().weaponSlot2; as w2) {
                    <div class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] p-3 text-xs space-y-1 tabular-nums">
                      <div class="flex items-center justify-between font-mono-num font-bold text-[var(--mot-text)]">
                        <span>Roll: 2d10 + {{ getWeaponMod(w2) }}</span>
                        <span class="text-[var(--mot-accent-text)]">
                          Flat DMG: {{ getWeaponDamage(w2) }}
                        </span>
                      </div>
                      <p class="text-[var(--mot-muted)]">
                        <strong>{{ w2.trait_name }}:</strong> {{ w2.trait_description }}
                      </p>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- STEP 5: SKILL TREE PERKS & COMBAT ARTS -->
        @if (step() === 5) {
          <div class="p-6 sm:p-8 space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="font-display text-lg font-bold text-[var(--mot-text)]">
                  Choose Skill Tree Perks &amp; Combat Arts
                </h2>
                <p class="text-xs text-[var(--mot-muted)]">
                  Combat Arts carry cooldowns and Defense Triangle tags ([Crushing] no Parry, [Sweeping] no Dodge, [Piercing] no Block).
                </p>
              </div>
              <span
                class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-1.5 font-mono-num text-sm font-bold text-[var(--mot-accent-text)] tabular-nums"
              >
                Selected: {{ liveDerived().perkSpent }} / {{ liveDerived().perkBudget }} Perks
              </span>
            </div>

            <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
              @for (tree of characterStore.skillTrees(); track tree.id) {
                <div
                  class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4 space-y-3"
                >
                  <div>
                    <h3 class="font-display text-base font-bold text-[var(--mot-text)]">
                      {{ tree.name }}
                    </h3>
                    <p class="mt-0.5 text-xs text-[var(--mot-muted)]">{{ tree.description }}</p>
                  </div>

                  <div class="space-y-2.5">
                    @for (node of getNodesForTree(tree.id); track node.id) {
                      <div
                        class="rounded-xl border p-3.5 transition-colors"
                        [class]="
                          isPerkSelected(node.id)
                            ? 'border-[#C4491A] bg-[var(--mot-surface)]'
                            : 'border-[var(--mot-border)] bg-[var(--mot-surface-raised)]'
                        "
                      >
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <div class="flex flex-wrap items-center gap-1.5">
                              <span
                                class="rounded bg-[#122220] px-1.5 py-0.5 font-mono-num text-xs font-bold text-[#FF8C5A]"
                              >
                                T{{ node.tier }}
                              </span>
                              <span class="text-sm font-bold text-[var(--mot-text)]">
                                {{ node.name }}
                              </span>
                            </div>

                            <div class="mt-1 font-mono-num text-xs text-[var(--mot-muted)] tabular-nums">
                              @if (node.node_type === 'combat_art') {
                                {{ node.ap_cost ?? 1 }} AP · CD {{ node.cooldown_rounds ?? 2 }} Rnds
                                @if (node.combat_tag && node.combat_tag !== 'None') {
                                  · [{{ node.combat_tag }}]
                                }
                              } @else {
                                Passive Upgrade · {{ node.perk_cost }}
                                {{ node.perk_cost === 1 ? 'Perk' : 'Perks' }}
                              }
                            </div>

                            @if (getParentNodeName(node.parent_node_id); as parentName) {
                              <div
                                class="mt-0.5 font-mono-num text-xs font-semibold"
                                [class.text-[var(--mot-accent-text)]]="!isParentUnlocked(node)"
                                [class.text-[var(--mot-sp-text)]]="isParentUnlocked(node)"
                              >
                                Requires: {{ parentName }}
                              </div>
                            }
                          </div>

                          <button
                            type="button"
                            (click)="togglePerk(node)"
                            [disabled]="!canTogglePerk(node)"
                            [class]="
                              isPerkSelected(node.id)
                                ? 'btn-copper rounded-lg px-2.5 py-1 text-xs font-semibold'
                                : 'rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-2.5 py-1 text-xs font-semibold text-[var(--mot-text)] hover:border-[#C4491A] disabled:opacity-40'
                            "
                          >
                            {{ isPerkSelected(node.id) ? 'Selected' : 'Select' }}
                          </button>
                        </div>

                        <p class="mt-2 text-xs text-[var(--mot-muted)]">
                          {{ node.description }}
                        </p>

                        @if (getHookBadges(node).length > 0) {
                          <div class="mt-2.5 flex flex-wrap gap-1.5">
                            @for (badge of getHookBadges(node); track badge) {
                              <span
                                class="rounded border border-[var(--mot-border)] bg-[var(--mot-well)] px-2 py-0.5 font-mono-num text-xs font-bold text-[var(--mot-sp-text)]"
                              >
                                {{ badge }}
                              </span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Bottom Wizard Navigation Footer -->
        <div
          class="flex items-center justify-between border-t border-[var(--mot-border)] bg-[var(--mot-well)] px-6 py-4"
        >
          <button
            type="button"
            (click)="prevStep()"
            [disabled]="step() === 1"
            class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-surface)] px-4 py-2 text-xs font-semibold text-[var(--mot-text)] disabled:opacity-40"
          >
            ← Previous Step
          </button>

          @if (step() < 5) {
            <button
              type="button"
              (click)="nextStep()"
              class="btn-copper rounded-lg px-5 py-2 text-xs font-semibold"
            >
              Next Step →
            </button>
          } @else {
            <button
              type="button"
              (click)="finishCreateCharacter()"
              [disabled]="characterStore.isLoading() || !name().trim()"
              class="btn-copper rounded-lg px-6 py-2.5 text-sm font-semibold"
            >
              @if (characterStore.isLoading()) {
                Creating Character...
              } @else {
                Create Character
              }
            </button>
          }
        </div>
      </section>
    </div>
  `,
})
export class CharacterCreatorComponent {
  readonly characterStore = inject(CharacterStore);
  private readonly router = inject(Router);
  readonly Number = Number;

  readonly step = signal<CreatorStep>(1);

  readonly name = signal<string>('');
  readonly level = signal<number>(1);
  readonly attributes = signal<Record<AttributeName, number>>({
    Brawn: 0,
    Agility: 0,
    Technique: 0,
    Iron: 0,
    Cunning: 0,
  });
  readonly combatSkills = signal<Record<CombatSkillName, number>>({
    Strike: 0,
    Shoot: 0,
    Parry: 0,
    Dodge: 0,
  });
  readonly fieldSkills = signal<Record<FieldSkillName, number>>({
    Athletics: 0,
    Menace: 0,
    Stealth: 0,
    Tinkering: 0,
    Medicine: 0,
    Survival: 0,
    Resolve: 0,
    Perception: 0,
    Sway: 0,
    Lore: 0,
  });
  readonly equippedArmor = signal<ArmorTier>('Medium');
  readonly equippedShield = signal<ShieldTier>('Heater');
  readonly weaponSlot1Id = signal<string | null>(null);
  readonly weaponSlot2Id = signal<string | null>(null);
  readonly unlockedPerkIds = signal<string[]>([]);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers = ARMOR_TIERS;
  readonly shieldTiers = SHIELD_TIERS;
  readonly armorKeys: ArmorTier[] = ['None', 'Light', 'Medium', 'Heavy'];
  readonly shieldKeys: ShieldTier[] = ['None', 'Buckler', 'Heater', 'Tower'];

  readonly liveDerived = computed(() =>
    computeDerivedStats(
      {
        level: this.level(),
        attributes: this.attributes(),
        combat_skills: this.combatSkills(),
        field_skills: this.fieldSkills(),
        equipped_armor: this.equippedArmor(),
        equipped_shield: this.equippedShield(),
        weapon_slot_1_id:
          this.weaponSlot1Id() ?? this.characterStore.weapons()[0]?.id ?? null,
        weapon_slot_2_id:
          this.weaponSlot2Id() ?? this.characterStore.weapons()[1]?.id ?? null,
        active_weapon_slot: 1,
        unlocked_perk_ids: this.unlockedPerkIds(),
      },
      this.characterStore.weapons(),
      this.characterStore.perkNodes()
    )
  );

  readonly stepLabels: { step: CreatorStep; title: string; badge: () => string }[] = [
    { step: 1, title: 'Identity', badge: () => `Lv.${this.level()}` },
    {
      step: 2,
      title: 'Attributes',
      badge: () =>
        `${this.liveDerived().attributeSpent}/${this.liveDerived().attributeBudget}`,
    },
    {
      step: 3,
      title: 'Skills',
      badge: () =>
        `${this.liveDerived().combatSkillSpent}/${this.liveDerived().combatSkillBudget}`,
    },
    { step: 4, title: 'Loadout', badge: () => '2 Weps' },
    {
      step: 5,
      title: 'Combat Arts',
      badge: () => `${this.liveDerived().perkSpent}/${this.liveDerived().perkBudget}`,
    },
  ];

  prevStep(): void {
    const cur = this.step();
    if (cur > 1) this.step.set((cur - 1) as CreatorStep);
  }

  nextStep(): void {
    const cur = this.step();
    if (cur < 5) this.step.set((cur + 1) as CreatorStep);
  }

  adjustAttribute(attr: AttributeName, delta: number): void {
    this.attributes.update((curr) => ({
      ...curr,
      [attr]: Math.max(0, Math.min(5, (curr[attr] ?? 0) + delta)),
    }));
  }

  adjustCombatSkill(skill: CombatSkillName, delta: number): void {
    this.combatSkills.update((curr) => ({
      ...curr,
      [skill]: Math.max(0, Math.min(4, (curr[skill] ?? 0) + delta)),
    }));
  }

  adjustFieldSkill(skill: FieldSkillName, delta: number): void {
    this.fieldSkills.update((curr) => ({
      ...curr,
      [skill]: Math.max(0, Math.min(4, (curr[skill] ?? 0) + delta)),
    }));
  }

  getWeaponMod(w: WeaponModel): number {
    return (this.attributes()[w.gov_attribute] ?? 0) + (this.combatSkills()[w.gov_skill] ?? 0);
  }

  getWeaponDamage(w: WeaponModel): number {
    return w.base_damage + (this.attributes()[w.gov_attribute] ?? 0);
  }

  getNodesForTree(treeId: string): PerkNodeModel[] {
    return this.characterStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  getParentNodeName(parentId: string | null | undefined): string | null {
    if (!parentId) return null;
    return this.characterStore.perkNodes().find((p) => p.id === parentId)?.name ?? null;
  }

  isParentUnlocked(node: PerkNodeModel): boolean {
    if (!node.parent_node_id) return true;
    return this.unlockedPerkIds().includes(node.parent_node_id);
  }

  canTogglePerk(node: PerkNodeModel): boolean {
    if (this.isPerkSelected(node.id)) return true;
    if (!this.isParentUnlocked(node)) return false;
    const cost = node.perk_cost ?? 1;
    return this.liveDerived().perkSpent + cost <= this.liveDerived().perkBudget;
  }

  getHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  isPerkSelected(perkId: string): boolean {
    return this.unlockedPerkIds().includes(perkId);
  }

  togglePerk(node: PerkNodeModel): void {
    const perkId = node.id;
    this.unlockedPerkIds.update((ids) => {
      if (ids.includes(perkId)) {
        // Also remove any child nodes that depend on this node
        const dependentIds = new Set(
          this.characterStore
            .perkNodes()
            .filter((p) => p.parent_node_id === perkId)
            .map((p) => p.id)
        );
        return ids.filter((id) => id !== perkId && !dependentIds.has(id));
      }
      return [...ids, perkId];
    });
  }

  async finishCreateCharacter(): Promise<void> {
    if (!this.name().trim()) {
      this.step.set(1);
      return;
    }

    const wep1 = this.weaponSlot1Id() ?? this.characterStore.weapons()[0]?.id ?? null;
    const wep2 = this.weaponSlot2Id() ?? this.characterStore.weapons()[1]?.id ?? null;

    const created = await this.characterStore.createCharacter({
      name: this.name().trim(),
      level: this.level(),
      attributes: this.attributes(),
      combat_skills: this.combatSkills(),
      field_skills: this.fieldSkills(),
      equipped_armor: this.equippedArmor(),
      equipped_shield: this.equippedShield(),
      weapon_slot_1_id: wep1,
      weapon_slot_2_id: wep2,
      active_weapon_slot: 1,
      unlocked_perk_ids: this.unlockedPerkIds(),
    });

    if (created) {
      await this.router.navigate(['/characters', created.id]);
    }
  }
}
