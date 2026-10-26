import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ARMOR_TIERS,
  ATTRIBUTE_LIST,
  COMBAT_SKILL_LIST,
  FIELD_SKILL_LIST,
  PerkNodeModel,
  SHIELD_TIERS,
  computeDerivedStats,
  formatRuleHookBadges,
} from './models/character.model';
import { CharacterStore } from './store/character.store';

@Component({
  selector: 'app-character-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      @if (character(); as char) {
        @if (derived(); as stats) {
          <!-- Top Character Sheet Banner -->
          <section
            class="overflow-hidden rounded-2xl border border-[#243B37] bg-[#122220] p-6 text-[#EBF5F3]"
          >
            <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div class="flex items-center gap-4">
                <div
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#243B37] bg-[#C4491A] font-display text-xl font-bold text-white"
                >
                  {{ char.name.slice(0, 2).toUpperCase() }}
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2.5">
                    <h1 class="font-display text-2xl font-bold text-white sm:text-3xl">
                      {{ char.name }}
                    </h1>
                    <span
                      class="rounded-md border border-[#243B37] bg-[#0D1615] px-2.5 py-0.5 font-mono-num text-xs font-bold text-[#FF8C5A]"
                    >
                      Level {{ char.level }}
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-[#8AB0AB]">
                    {{ armorTiers[char.equipped_armor].label }} ·
                    {{ shieldTiers[char.equipped_shield].label }} ·
                    Move {{ stats.moveTiles }} Tiles ({{ stats.moveFeet }} ft) per 1 AP
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2.5">
                <a
                  routerLink="/characters"
                  class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3.5 py-2 text-xs font-semibold text-[#EBF5F3] no-underline hover:border-[#C4491A]"
                >
                  All Characters
                </a>
                <button
                  type="button"
                  (click)="resetRoundAp(char.id)"
                  class="btn-copper rounded-lg px-3.5 py-2 text-xs font-semibold"
                >
                  New Round (Restore 4 AP)
                </button>
              </div>
            </div>
          </section>

          <!-- Vitals & Unified 4 AP Pool -->
          <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <!-- Stamina / Poise (SP) -->
            <div
              class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[var(--mot-sp-text)]">
                  Stamina &amp; Poise (SP)
                </span>
                <span class="font-mono-num text-lg font-bold text-[var(--mot-text)]">
                  {{ char.current_sp }} / {{ stats.maxSp }}
                </span>
              </div>
              <div
                class="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--mot-well)]"
              >
                <div
                  class="h-full bg-[var(--mot-sp)] transition-all"
                  [style.width.%]="(char.current_sp / stats.maxSp) * 100"
                ></div>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2">
                <span class="text-xs text-[var(--mot-muted)]">
                  10 + (Iron×2) + (MAX(Parry,Dodge)×2)
                </span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    (click)="adjustSp(char.id, -1)"
                    class="h-7 w-7 rounded border border-[var(--mot-border)] bg-[var(--mot-well)] font-mono-num text-xs font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    (click)="adjustSp(char.id, 1)"
                    class="h-7 w-7 rounded border border-[var(--mot-border)] bg-[var(--mot-well)] font-mono-num text-xs font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>

            <!-- Health / Meat & Blood (HP) -->
            <div
              class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[var(--mot-hp-text)]">
                  Health (HP · Armor DR {{ stats.armorDr }})
                </span>
                <span class="font-mono-num text-lg font-bold text-[var(--mot-text)]">
                  {{ char.current_hp }} / {{ stats.maxHp }}
                </span>
              </div>
              <div
                class="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--mot-well)]"
              >
                <div
                  class="h-full bg-[var(--mot-hp)] transition-all"
                  [style.width.%]="(char.current_hp / stats.maxHp) * 100"
                ></div>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2">
                <span class="text-xs text-[var(--mot-muted)]">
                  5 + (Iron×2) · Overflow at 0 SP
                </span>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    (click)="adjustHp(char.id, -1)"
                    class="h-7 w-7 rounded border border-[var(--mot-border)] bg-[var(--mot-well)] font-mono-num text-xs font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    (click)="adjustHp(char.id, 1)"
                    class="h-7 w-7 rounded border border-[var(--mot-border)] bg-[var(--mot-well)] font-mono-num text-xs font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>

            <!-- Unified 4 AP Round Pool -->
            <div
              class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-[var(--mot-accent-text)]">
                  Unified Action Points (AP)
                </span>
                <span class="font-mono-num text-lg font-bold text-[var(--mot-text)]">
                  {{ char.current_ap }} / 4 AP
                </span>
              </div>
              <div class="mt-3 flex items-center gap-2">
                @for (pip of [1, 2, 3, 4]; track pip) {
                  <button
                    type="button"
                    (click)="setAp(char.id, pip === char.current_ap ? pip - 1 : pip)"
                    class="h-7 flex-1 rounded-lg border transition-colors"
                    [class.border-[#C4491A]]="pip <= char.current_ap"
                    [class.bg-[#C4491A]]="pip <= char.current_ap"
                    [class.border-[var(--mot-border)]]="pip > char.current_ap"
                    [class.bg-[var(--mot-well)]]="pip > char.current_ap"
                    [attr.aria-label]="'Set AP to ' + pip"
                  ></button>
                }
              </div>
              <p class="mt-2.5 text-xs text-[var(--mot-muted)]">
                Shared across attacks, movement, and active defenses (Parry, Dodge, Block = 1 AP).
              </p>
            </div>
          </section>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <!-- Left Column: Attributes, Combat Skills & Active Defenses (5 cols) -->
            <div class="space-y-6 lg:col-span-5">
              <!-- Core Attributes -->
              <section
                class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
              >
                <h2 class="font-display text-base font-bold text-[var(--mot-text)]">
                  Core Attributes
                </h2>
                <div class="mt-3 grid grid-cols-5 gap-2">
                  @for (attr of attributeList; track attr.name) {
                    <div
                      class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] p-2.5 text-center"
                    >
                      <div class="text-xs font-semibold text-[var(--mot-muted)]">
                        {{ attr.name }}
                      </div>
                      <div class="mt-1 font-mono-num text-lg font-bold text-[var(--mot-text)]">
                        +{{ char.attributes[attr.name] }}
                      </div>
                    </div>
                  }
                </div>
              </section>

              <!-- Combat Skills & Reaction Rolls -->
              <section
                class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5 space-y-4"
              >
                <h2 class="font-display text-base font-bold text-[var(--mot-text)]">
                  Combat Skills &amp; Active Defenses (1 AP)
                </h2>

                <div class="grid grid-cols-2 gap-2.5">
                  @for (skill of combatSkillList; track skill.name) {
                    <div
                      class="flex items-center justify-between rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3 py-2"
                    >
                      <span class="text-xs font-bold text-[var(--mot-text)]">
                        {{ skill.name }}
                      </span>
                      <span class="font-mono-num text-sm font-bold text-[var(--mot-accent-text)]">
                        Rank +{{ char.combat_skills[skill.name] }}
                      </span>
                    </div>
                  }
                </div>

                <div class="space-y-2 border-t border-[var(--mot-border)] pt-3">
                  <div
                    class="flex items-center justify-between rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span class="font-bold text-[var(--mot-text)]">Parry Reaction</span>
                      <span class="block text-[var(--mot-muted)]">
                        Flawless (≥ +5) deals {{ stats.flawlessParryCounterSp }} SP counter
                      </span>
                    </div>
                    <span class="font-mono-num text-sm font-bold text-[var(--mot-text)]">
                      2d10 + {{ stats.parryMod }}
                    </span>
                  </div>

                  <div
                    class="flex items-center justify-between rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span class="font-bold text-[var(--mot-text)]">Dodge Reaction</span>
                      <span class="block text-[var(--mot-muted)]">
                        Shifts 1 tile · Flawless (≥ +5) refunds 1 AP
                      </span>
                    </div>
                    <span class="font-mono-num text-sm font-bold text-[var(--mot-text)]">
                      2d10 + {{ stats.dodgeMod }}
                    </span>
                  </div>

                  <div
                    class="flex items-center justify-between rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span class="font-bold text-[var(--mot-text)]">Shield Block</span>
                      <span class="block text-[var(--mot-muted)]">
                        @if (stats.shieldBlockTotal > 0) {
                          Reduces SP damage by {{ stats.shieldBlockTotal }} (Shield + Iron)
                        } @else {
                          Requires an equipped shield
                        }
                      </span>
                    </div>
                    <span class="font-mono-num text-sm font-bold text-[var(--mot-text)]">
                      2d10 + {{ stats.blockMod }}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <!-- Right Column: 2-Weapon Loadout, Combat Arts & Field Skills (7 cols) -->
            <div class="space-y-6 lg:col-span-7">
              <!-- 2-Weapon Loadout -->
              <section
                class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="font-display text-base font-bold text-[var(--mot-text)]">
                      Equipped 2-Weapon Loadout
                    </h2>
                    <p class="text-xs text-[var(--mot-muted)]">
                      Switching active weapon during combat costs 1 AP.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="switchWeapon(char.id)"
                    class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3 py-1.5 font-mono-num text-xs font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
                  >
                    1 AP: Switch Active Slot
                  </button>
                </div>

                <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <!-- Slot 1 -->
                  <div
                    class="rounded-xl border p-4 transition-colors"
                    [class.border-[#C4491A]]="char.active_weapon_slot === 1"
                    [class.bg-[var(--mot-well)]]="char.active_weapon_slot === 1"
                    [class.border-[var(--mot-border)]]="char.active_weapon_slot !== 1"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-[var(--mot-muted)]">
                        Primary Slot 1
                      </span>
                      @if (char.active_weapon_slot === 1) {
                        <span
                          class="rounded bg-[#C4491A] px-2 py-0.5 text-xs font-bold text-white"
                        >
                          Active
                        </span>
                      }
                    </div>
                    @if (stats.weaponSlot1; as w1) {
                      <div class="mt-1.5 font-display text-base font-bold text-[var(--mot-text)]">
                        {{ w1.name }}
                      </div>
                      <div class="mt-1 font-mono-num text-xs font-semibold text-[var(--mot-accent-text)]">
                        {{ w1.ap_cost }} AP · 2d10 + {{ char.attributes[w1.gov_attribute] + char.combat_skills[w1.gov_skill] }} ·
                        {{ w1.base_damage + char.attributes[w1.gov_attribute] }} Flat DMG
                      </div>
                      <p class="mt-1.5 text-xs text-[var(--mot-muted)]">
                        <strong class="text-[var(--mot-text)]">{{ w1.trait_name }}:</strong>
                        {{ w1.trait_description }}
                      </p>
                    } @else {
                      <p class="mt-2 text-xs text-[var(--mot-muted)]">Unarmed</p>
                    }
                  </div>

                  <!-- Slot 2 -->
                  <div
                    class="rounded-xl border p-4 transition-colors"
                    [class.border-[#C4491A]]="char.active_weapon_slot === 2"
                    [class.bg-[var(--mot-well)]]="char.active_weapon_slot === 2"
                    [class.border-[var(--mot-border)]]="char.active_weapon_slot !== 2"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-[var(--mot-muted)]">
                        Secondary Slot 2
                      </span>
                      @if (char.active_weapon_slot === 2) {
                        <span
                          class="rounded bg-[#C4491A] px-2 py-0.5 text-xs font-bold text-white"
                        >
                          Active
                        </span>
                      }
                    </div>
                    @if (stats.weaponSlot2; as w2) {
                      <div class="mt-1.5 font-display text-base font-bold text-[var(--mot-text)]">
                        {{ w2.name }}
                      </div>
                      <div class="mt-1 font-mono-num text-xs font-semibold text-[var(--mot-accent-text)]">
                        {{ w2.ap_cost }} AP · 2d10 + {{ char.attributes[w2.gov_attribute] + char.combat_skills[w2.gov_skill] }} ·
                        {{ w2.base_damage + char.attributes[w2.gov_attribute] }} Flat DMG
                      </div>
                      <p class="mt-1.5 text-xs text-[var(--mot-muted)]">
                        <strong class="text-[var(--mot-text)]">{{ w2.trait_name }}:</strong>
                        {{ w2.trait_description }}
                      </p>
                    } @else {
                      <p class="mt-2 text-xs text-[var(--mot-muted)]">Unarmed</p>
                    }
                  </div>
                </div>
              </section>

              <!-- Unlocked Skill Tree Combat Arts -->
              <section
                class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 class="font-display text-base font-bold text-[var(--mot-text)]">
                      Unlocked Combat Arts &amp; Perks
                    </h2>
                    <p class="font-mono-num text-xs text-[var(--mot-muted)]">
                      Perk Budget: {{ stats.perkSpent }} / {{ stats.perkBudget }} Spent
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="perkPickerOpen.set(!perkPickerOpen())"
                    class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3 py-1.5 text-xs font-bold text-[var(--mot-text)] hover:border-[#C4491A]"
                  >
                    {{ perkPickerOpen() ? 'Done Managing Perks' : 'Manage Perks' }}
                  </button>
                </div>

                @if (perkPickerOpen()) {
                  <div
                    class="mt-4 space-y-4 rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-4"
                  >
                    @for (tree of characterStore.skillTrees(); track tree.id) {
                      <div>
                        <h3 class="font-display text-sm font-bold text-[var(--mot-text)]">
                          {{ tree.name }}
                        </h3>
                        <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          @for (node of getNodesForTree(tree.id); track node.id) {
                            <div
                              class="flex items-start justify-between gap-2 rounded-lg border p-3 text-xs"
                              [class.border-[#C4491A]]="char.unlocked_perk_ids.includes(node.id)"
                              [class.bg-[var(--mot-surface)]]="true"
                              [class.border-[var(--mot-border)]]="!char.unlocked_perk_ids.includes(node.id)"
                            >
                              <div>
                                <div class="font-bold text-[var(--mot-text)]">
                                  T{{ node.tier }} · {{ node.name }}
                                </div>
                                <p class="mt-0.5 text-[var(--mot-muted)]">
                                  {{ node.description }}
                                </p>
                              </div>
                              <button
                                type="button"
                                (click)="toggleCharacterPerk(char.id, node)"
                                [disabled]="
                                  !char.unlocked_perk_ids.includes(node.id) &&
                                  stats.perkSpent + (node.perk_cost ?? 1) > stats.perkBudget
                                "
                                class="shrink-0 rounded px-2.5 py-1 font-semibold disabled:opacity-40"
                                [class.btn-copper]="char.unlocked_perk_ids.includes(node.id)"
                                [class.border]="!char.unlocked_perk_ids.includes(node.id)"
                                [class.border-[var(--mot-border)]]="!char.unlocked_perk_ids.includes(node.id)"
                                [class.bg-[var(--mot-well)]]="!char.unlocked_perk_ids.includes(node.id)"
                              >
                                {{ char.unlocked_perk_ids.includes(node.id) ? 'Unlocked' : 'Unlock' }}
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }

                @if (stats.unlockedPerks.length === 0) {
                  <p class="mt-3 text-xs text-[var(--mot-muted)]">
                    No skill tree combat arts unlocked yet. Click <strong>Manage Perks</strong> above to spend your Perk Points.
                  </p>
                } @else {
                  <div class="mt-3 space-y-2.5">
                    @for (perk of stats.unlockedPerks; track perk.id) {
                      <div
                        class="rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] p-3.5"
                      >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="flex items-center gap-2">
                            <span
                              class="rounded bg-[#122220] px-1.5 py-0.5 font-mono-num text-xs font-bold text-[#FF8C5A]"
                            >
                              T{{ perk.tier }}
                            </span>
                            <span class="font-display text-sm font-bold text-[var(--mot-text)]">
                              {{ perk.name }}
                            </span>
                          </div>
                          <div class="flex items-center gap-1.5 font-mono-num text-xs">
                            @if (perk.node_type === 'passive_upgrade') {
                              <span
                                class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-bold text-[var(--mot-sp-text)]"
                              >
                                Passive
                              </span>
                            }
                            @if (perk.combat_tag && perk.combat_tag !== 'None') {
                              <span
                                class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-bold text-[var(--mot-accent-text)]"
                              >
                                [{{ perk.combat_tag }}]
                              </span>
                            }
                            @if (perk.ap_cost) {
                              <span
                                class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-bold text-[var(--mot-text)]"
                              >
                                {{ perk.ap_cost }} AP
                              </span>
                            }
                            @if (perk.cooldown_rounds) {
                              <span
                                class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-bold text-[var(--mot-muted)]"
                              >
                                {{ perk.cooldown_rounds }}-Round CD
                              </span>
                            }
                          </div>
                        </div>
                        <p class="mt-1 text-xs text-[var(--mot-muted)]">
                          {{ perk.description }}
                        </p>

                        @if (getHookBadges(perk).length > 0) {
                          <div class="mt-2 flex flex-wrap gap-1.5">
                            @for (badge of getHookBadges(perk); track badge) {
                              <span
                                class="rounded border border-[var(--mot-border)] bg-[var(--mot-surface)] px-2 py-0.5 font-mono-num text-xs font-bold text-[var(--mot-sp-text)]"
                              >
                                {{ badge }}
                              </span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </section>

              <!-- 10 Field Skills -->
              <section
                class="rounded-xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-5"
              >
                <div class="flex items-center justify-between">
                  <h2 class="font-display text-base font-bold text-[var(--mot-text)]">
                    10 Field Skills
                  </h2>
                  <span class="font-mono-num text-xs text-[var(--mot-muted)]">
                    2d10 + MAX(Attr A, Attr B) + Rank
                  </span>
                </div>

                <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  @for (fs of fieldSkillList; track fs.name) {
                    @if (stats.fieldSkillTotals[fs.name]; as totalInfo) {
                      <div
                        class="flex items-center justify-between rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3 py-2"
                      >
                        <div>
                          <div class="text-xs font-bold text-[var(--mot-text)]">
                            {{ fs.name }}
                          </div>
                          <div class="text-xs text-[var(--mot-muted)]">
                            {{ totalInfo.govAttr }} (+{{ totalInfo.govVal }}) + Rank {{ totalInfo.rank }}
                          </div>
                        </div>
                        <span class="font-mono-num text-sm font-bold text-[var(--mot-text)]">
                          +{{ totalInfo.total }}
                        </span>
                      </div>
                    }
                  }
                </div>
              </section>
            </div>
          </div>
        }
      } @else {
        <div
          class="rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)] p-8 text-center"
        >
          <h1 class="font-display text-lg font-bold text-[var(--mot-text)]">
            Character Not Found
          </h1>
          <p class="mt-1 text-xs text-[var(--mot-muted)]">
            This character may have been deleted or belongs to another account.
          </p>
          <a
            routerLink="/characters"
            class="btn-copper mt-4 inline-flex rounded-lg px-4 py-2 text-xs font-semibold no-underline"
          >
            Back to Characters
          </a>
        </div>
      }
    </div>
  `,
})
export class CharacterDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly characterStore = inject(CharacterStore);

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly armorTiers = ARMOR_TIERS;
  readonly shieldTiers = SHIELD_TIERS;

  readonly perkPickerOpen = signal(false);

  readonly characterId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  readonly character = computed(() =>
    this.characterStore.getCharacterById(this.characterId())
  );

  readonly derived = computed(() => {
    const char = this.character();
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.characterStore.weapons(),
      this.characterStore.perkNodes()
    );
  });

  async adjustHp(id: string, delta: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_hp: Math.max(0, c.current_hp + delta),
    }));
  }

  async adjustSp(id: string, delta: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_sp: Math.max(0, c.current_sp + delta),
    }));
  }

  async setAp(id: string, ap: number): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_ap: Math.max(0, Math.min(4, ap)),
    }));
  }

  async resetRoundAp(id: string): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      current_ap: 4,
    }));
  }

  async switchWeapon(id: string): Promise<void> {
    await this.characterStore.updateCharacter(id, (c) => ({
      ...c,
      active_weapon_slot: c.active_weapon_slot === 1 ? 2 : 1,
      current_ap: Math.max(0, c.current_ap - 1),
    }));
  }

  getNodesForTree(treeId: string): PerkNodeModel[] {
    return this.characterStore
      .perkNodes()
      .filter((p) => p.tree_id === treeId)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }

  getHookBadges(node: PerkNodeModel): string[] {
    return formatRuleHookBadges(node.rule_hooks);
  }

  async toggleCharacterPerk(characterId: string, node: PerkNodeModel): Promise<void> {
    await this.characterStore.updateCharacter(characterId, (c) => {
      const has = c.unlocked_perk_ids.includes(node.id);
      const nextIds = has
        ? c.unlocked_perk_ids.filter((id) => id !== node.id)
        : [...c.unlocked_perk_ids, node.id];
      return {
        ...c,
        unlocked_perk_ids: nextIds,
      };
    });
  }
}
