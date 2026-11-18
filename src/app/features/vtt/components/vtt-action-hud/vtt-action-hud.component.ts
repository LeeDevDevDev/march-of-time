import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import {
  CombatStatusEffect,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ITEMS,
  PerkNodeModel,
  ResolvedCompendiumVisuals,
  WeaponModel,
  getCombatTagBadgeClass,
  getCombatTagCounterLabel,
  isCompendiumItemActive,
  resolveCompendiumItemVisuals,
  resolveNodeVisuals,
  resolveWeaponVisuals,
} from '../../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../../core/compendium/compendium.store';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import { hasCustomTokenAppearance } from '../../../../shared/token-avatar/token-appearance.model';
import { TokenAvatarComponent } from '../../../../shared/token-avatar/token-avatar.component';
import {
  ATTRIBUTE_LIST,
  ActorInventoryItem,
  AttributeName,
  COMBAT_SKILL_LIST,
  CharacterModel,
  CombatSkillName,
  DerivedCharacterStats,
  FIELD_SKILL_LIST,
  FieldSkillName,
  ResolvedCombatArt,
  formatWeaponRequirementLabel,
  getInventoryItemCategory,
  isWeaponTwoHanded,
  normalizeInventoryItems,
} from '../../../characters/models/character.model';
import {
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  ResolvedNpcWeaponStats,
  VttNpcStats,
  VttTokenModel,
  computeEffectiveActorSightFeet,
  computeNpcFieldSkillTotals,
  computeNpcWeaponFormula,
  normalizeNpcAttributes,
  normalizeNpcCombatSkills,
  normalizeTokenRotation,
  resolveActorDarkvisionFeet,
  resolveEffectiveNpcDefenseMods,
  resolveEffectiveNpcWeaponStats,
} from '../../models/vtt.model';
import { VttSettingsStore } from '../../../../core/settings/vtt-settings.store';
import { VttStore } from '../../store/vtt.store';

export type VttHudFlyoutTab =
  | 'arts'
  | 'skills'
  | 'items'
  | 'statuses'
  | 'utility';

export type VttHudEditableVital = 'current_hp' | 'current_sp';

export function resolveHudVitalInputValue(
  raw: string,
  currentValue: number,
  maxValue: number
): number | null {
  const normalized = raw.trim().replace(/[−–—]/g, '-');
  if (!normalized) return null;
  const relativeMatch = normalized.match(/^([+-])\s*(\d+)$/);
  if (relativeMatch) {
    const sign = relativeMatch[1] === '-' ? -1 : 1;
    const amount = Number.parseInt(relativeMatch[2], 10);
    if (!Number.isFinite(amount)) return null;
    return Math.max(0, Math.min(maxValue, currentValue + sign * amount));
  }
  if (/^\d+$/.test(normalized)) {
    const exact = Number.parseInt(normalized, 10);
    if (!Number.isFinite(exact)) return null;
    return Math.max(0, Math.min(maxValue, exact));
  }
  return null;
}

export function resolveHudSpVitalPatch(
  raw: string,
  currentSp: number,
  maxSp: number,
  currentHp: number,
  maxHp: number,
  overflowToHp: boolean
): { current_sp: number; current_hp?: number } | null {
  const normalized = raw.trim().replace(/[−–—]/g, '-');
  if (!normalized) return null;
  const relativeMatch = normalized.match(/^([+-])\s*(\d+)$/);
  if (relativeMatch) {
    const sign = relativeMatch[1] === '-' ? -1 : 1;
    const amount = Number.parseInt(relativeMatch[2], 10);
    if (!Number.isFinite(amount)) return null;
    const unclampedSp = currentSp + sign * amount;
    if (unclampedSp < 0) {
      const overflow = Math.abs(unclampedSp);
      if (overflowToHp) {
        return {
          current_sp: 0,
          current_hp: Math.max(0, Math.min(maxHp, currentHp - overflow)),
        };
      }
      return { current_sp: 0 };
    }
    return { current_sp: Math.max(0, Math.min(maxSp, unclampedSp)) };
  }
  if (/^\d+$/.test(normalized)) {
    const exact = Number.parseInt(normalized, 10);
    if (!Number.isFinite(exact)) return null;
    return { current_sp: Math.max(0, Math.min(maxSp, exact)) };
  }
  return null;
}

export interface VttHudHoverPreview {
  title: string;
  apLabel: string;
  subtitle: string;
  description?: string;
  tags?: string[];
}

export interface VttHudStatusOption {
  id: Exclude<CombatStatusEffect, 'None'>;
  summary: string;
}

@Component({
  selector: 'app-vtt-action-hud',
  standalone: true,
  imports: [CompendiumIconComponent, TokenAvatarComponent],
  templateUrl: './vtt-action-hud.component.html',
})
export class VttActionHudComponent {
  readonly vttStore = inject(VttStore);
  readonly settingsStore = inject(VttSettingsStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  readonly token = input.required<VttTokenModel>();
  readonly tokens = input<readonly VttTokenModel[]>([]);
  readonly collapsed = model<boolean>(false);

  readonly activeFlyout = signal<VttHudFlyoutTab | null>(null);
  readonly hoveredTile = signal<VttHudHoverPreview | null>(null);
  readonly brokenPortraitUrl = signal<string | null>(null);
  readonly editingVital = signal<VttHudEditableVital | null>(null);
  readonly vitalInputDraft = signal<string>('');

  readonly attributeList = ATTRIBUTE_LIST;
  readonly combatSkillList = COMBAT_SKILL_LIST;
  readonly fieldSkillList = FIELD_SKILL_LIST;
  readonly getCombatTagBadgeClass = getCombatTagBadgeClass;
  readonly getCombatTagCounterLabel = getCombatTagCounterLabel;

  readonly statusCatalog: readonly VttHudStatusOption[] = [
    {
      id: 'Sundered',
      summary: '-2 Armor DR & -2 Shield Block until next turn',
    },
    {
      id: 'Staggered',
      summary: '-1 AP next round & cannot trigger Flawless reactions',
    },
    {
      id: 'Bleeding',
      summary: 'Loses 1 HP directly at the end of each turn',
    },
    {
      id: 'Pinned',
      summary: 'Cannot Move or Dodge; spend 1 AP to break free',
    },
  ];

  private lastSelectionSig = '';

  readonly selectedTokens = computed<readonly VttTokenModel[]>(() => {
    const list = this.tokens();
    return list.length > 0 ? list : [this.token()];
  });

  readonly isMultiSelect = computed<boolean>(
    () => this.selectedTokens().length > 1
  );

  readonly controllableGroup = computed<readonly VttTokenModel[]>(() =>
    this.selectedTokens().filter(
      (t) => this.vttStore.isGm() || this.vttStore.canControlToken(t)
    )
  );

  readonly canControlAny = computed<boolean>(
    () => this.controllableGroup().length > 0
  );

  readonly singleInitiativeInfo = computed(() =>
    this.vttStore.resolveTokenInitiativeInfo(this.token())
  );

  readonly char = computed<CharacterModel | null>(() =>
    this.vttStore.resolveCharacterForToken(this.token())
  );

  readonly stats = computed<DerivedCharacterStats | null>(() =>
    this.vttStore.computeDerivedForCharacter(this.char())
  );

  readonly linkedActor = computed(() =>
    this.vttStore.resolveRosterActorForToken(this.token())
  );

  readonly canControl = computed(() =>
    this.vttStore.canControlToken(this.token())
  );

  readonly visuals = computed(() =>
    this.vttStore.resolveTokenVisuals(this.token())
  );

  readonly displayPortraitUrl = computed<string | null>(() => {
    const url = this.visuals().portraitUrl;
    if (!url || this.brokenPortraitUrl() === url) return null;
    return url;
  });

  readonly hasCustomTokenArt = computed<boolean>(() => {
    const vis = this.visuals();
    return (
      Boolean(vis.tokenImageUrl) ||
      hasCustomTokenAppearance(vis.tokenAppearance)
    );
  });

  readonly isActiveTurn = computed<boolean>(() => {
    const sc = this.vttStore.activeScene();
    return Boolean(
      sc?.combat_active && sc.active_turn_token_id === this.token().id
    );
  });

  readonly canEndTurn = computed<boolean>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc?.combat_active || sc.active_turn_token_id !== this.token().id) {
      return false;
    }
    return this.vttStore.isGm() || this.canControl();
  });

  readonly apPips = computed<number[]>(() => {
    const count = Math.max(1, Math.min(8, this.token().max_ap || 4));
    return Array.from({ length: count }, (_, idx) => idx + 1);
  });

  readonly hpPercent = computed<number>(() => {
    const tok = this.token();
    if (tok.max_hp <= 0) return 0;
    return Math.max(0, Math.min(100, (tok.current_hp / tok.max_hp) * 100));
  });

  readonly spPercent = computed<number>(() => {
    const tok = this.token();
    if (tok.max_sp <= 0) return 0;
    return Math.max(0, Math.min(100, (tok.current_sp / tok.max_sp) * 100));
  });

  readonly moveTiles = computed<number>(() =>
    Math.max(1, Math.round((this.token().move_feet || 20) / 5))
  );

  readonly stanceRecoveryAmount = computed<number>(
    () => this.stats()?.stanceRecoverySp ?? 3
  );

  readonly parryMod = computed<number>(() => {
    const st = this.stats();
    if (st) return st.parryMod;
    return Number(this.token().npc_stats?.parry_mod ?? 1);
  });

  readonly dodgeMod = computed<number>(() => {
    const st = this.stats();
    if (st) return st.dodgeMod;
    return Number(this.token().npc_stats?.dodge_mod ?? 1);
  });

  readonly canDodge = computed<boolean>(() => {
    const st = this.stats();
    if (st) return st.canDodge;
    return this.token().npc_stats?.can_dodge !== false;
  });

  readonly npcCombatArts = computed<PerkNodeModel[]>(() => {
    if (this.stats()) return [];
    return this.vttStore.getNpcStandaloneCombatArts(this.token());
  });

  readonly artsFilterQuery = signal<string>('');

  readonly totalCombatArtsCount = computed<number>(() => {
    const st = this.stats();
    if (st) return st.resolvedCombatArts.length;
    return this.npcCombatArts().length;
  });

  readonly filteredPcCombatArts = computed<ResolvedCombatArt[]>(() => {
    const st = this.stats();
    if (!st) return [];
    const q = this.artsFilterQuery().trim().toLowerCase();
    if (!q) return st.resolvedCombatArts;
    return st.resolvedCombatArts.filter(
      (art) =>
        art.baseNode.name.toLowerCase().includes(q) ||
        art.baseNode.description.toLowerCase().includes(q) ||
        art.combatTags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  readonly filteredNpcCombatArts = computed<PerkNodeModel[]>(() => {
    const list = this.npcCombatArts();
    const q = this.artsFilterQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (node) =>
        node.name.toLowerCase().includes(q) ||
        node.description.toLowerCase().includes(q)
    );
  });

  readonly resolvedAttributes = computed<Record<AttributeName, number>>(() => {
    const ch = this.char();
    if (ch) return ch.attributes;
    const actor = this.linkedActor();
    return normalizeNpcAttributes(
      this.token().npc_stats?.attributes ?? actor?.npc_stats?.attributes
    );
  });

  readonly resolvedCombatSkills = computed<Record<CombatSkillName, number>>(
    () => {
      const ch = this.char();
      if (ch) return ch.combat_skills;
      const actor = this.linkedActor();
      return normalizeNpcCombatSkills(
        this.token().npc_stats?.combat_skills ?? actor?.npc_stats?.combat_skills
      );
    }
  );

  readonly resolvedFieldSkillTotals = computed(() => {
    const st = this.stats();
    if (st) return st.fieldSkillTotals;
    const actor = this.linkedActor();
    return computeNpcFieldSkillTotals({
      ...(actor?.npc_stats ?? {}),
      ...(this.token().npc_stats ?? {}),
    });
  });

  readonly inventoryItems = computed<ActorInventoryItem[]>(() => {
    const c = this.char();
    if (c) {
      const direct = normalizeInventoryItems(c.inventory);
      if (direct.length > 0) return direct;
    }
    const actor = this.linkedActor();
    const fromActor = normalizeInventoryItems(actor?.npc_stats?.__inventory);
    if (fromActor.length > 0) return fromActor;
    return normalizeInventoryItems(this.token().npc_stats?.__inventory);
  });

  readonly gearItems = computed<ActorInventoryItem[]>(() =>
    this.inventoryItems().filter(
      (it) => getInventoryItemCategory(it) === 'item' && it.quantity > 0
    )
  );

  readonly carriedWeapons = computed<ActorInventoryItem[]>(() =>
    this.inventoryItems().filter(
      (it) => getInventoryItemCategory(it) === 'weapon' && it.quantity > 0
    )
  );

  readonly totalFlyoutItemsCount = computed<number>(
    () => this.gearItems().length + this.carriedWeapons().length
  );

  readonly activeStatusCount = computed<number>(() => {
    if (!this.isMultiSelect()) {
      return this.token().statuses.length + (this.token().shield_raised ? 1 : 0);
    }
    const set = new Set<string>();
    for (const t of this.selectedTokens()) {
      for (const s of t.statuses) set.add(s);
    }
    return set.size;
  });

  readonly groupCurrentHp = computed<number>(() =>
    this.selectedTokens().reduce((sum, t) => sum + t.current_hp, 0)
  );

  readonly groupMaxHp = computed<number>(() =>
    this.selectedTokens().reduce((sum, t) => sum + t.max_hp, 0)
  );

  readonly groupHpPercent = computed<number>(() => {
    const max = this.groupMaxHp();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (this.groupCurrentHp() / max) * 100));
  });

  readonly groupCurrentSp = computed<number>(() =>
    this.selectedTokens().reduce((sum, t) => sum + t.current_sp, 0)
  );

  readonly groupMaxSp = computed<number>(() =>
    this.selectedTokens().reduce((sum, t) => sum + t.max_sp, 0)
  );

  readonly groupSpPercent = computed<number>(() => {
    const max = this.groupMaxSp();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (this.groupCurrentSp() / max) * 100));
  });

  readonly groupCurrentAp = computed<number>(() =>
    this.selectedTokens().reduce((sum, t) => sum + t.current_ap, 0)
  );

  readonly groupMaxAp = computed<number>(() =>
    this.selectedTokens().reduce((sum, t) => sum + t.max_ap, 0)
  );

  readonly groupMinMoveFeet = computed<number>(() => {
    const list = this.selectedTokens();
    if (list.length === 0) return 20;
    return Math.min(...list.map((t) => t.move_feet || 20));
  });

  readonly groupMinMoveTiles = computed<number>(() =>
    Math.max(1, Math.round(this.groupMinMoveFeet() / 5))
  );

  readonly groupRolledInitiativeCount = computed<number>(
    () =>
      this.selectedTokens().filter(
        (t) => typeof t.npc_stats?.__initiative === 'number'
      ).length
  );

  readonly groupAllCanRaiseGuard = computed<boolean>(() => {
    const list = this.controllableGroup();
    return list.length > 0 && list.every((t) => t.shield_block > 0);
  });

  readonly groupAllGuardRaised = computed<boolean>(() => {
    const list = this.controllableGroup();
    return list.length > 0 && list.every((t) => t.shield_raised);
  });

  readonly groupMinShieldBlock = computed<number>(() => {
    const list = this.controllableGroup().filter((t) => t.shield_block > 0);
    if (list.length === 0) return 0;
    return Math.min(...list.map((t) => t.shield_block));
  });

  readonly groupAnyCanDodge = computed<boolean>(() =>
    this.controllableGroup().some((t) => this.canTokenDodge(t))
  );

  readonly groupAnyHasAp = computed<boolean>(() =>
    this.controllableGroup().some((t) => t.current_ap >= 1)
  );

  readonly groupAnyMissingSp = computed<boolean>(() =>
    this.controllableGroup().some(
      (t) => t.current_ap >= 1 && t.current_sp < t.max_sp
    )
  );

  readonly groupAllHidden = computed<boolean>(() => {
    const list = this.selectedTokens();
    return list.length > 0 && list.every((t) => t.is_hidden);
  });

  readonly groupAnyRotated = computed<boolean>(() =>
    this.selectedTokens().some(
      (t) => normalizeTokenRotation(t.npc_stats?.__rotation) !== 0
    )
  );

  constructor() {
    effect(() => {
      const sig = this.selectedTokens()
        .map((t) => t.id)
        .join(',');
      if (sig !== this.lastSelectionSig) {
        this.lastSelectionSig = sig;
        untracked(() => {
          this.activeFlyout.set(null);
          this.hoveredTile.set(null);
          this.editingVital.set(null);
          this.artsFilterQuery.set('');
        });
      }
    });
  }

  onArtsFilterInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.artsFilterQuery.set(target?.value ?? '');
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.activeFlyout() === null) return;
    const el = this.hostRef.nativeElement;
    const target = event.target as Node | null;
    if (el && target && !el.contains(target)) {
      this.activeFlyout.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.editingVital() !== null) {
      this.editingVital.set(null);
      return;
    }
    if (this.activeFlyout() !== null) {
      this.activeFlyout.set(null);
    }
  }

  toggleFlyout(tab: VttHudFlyoutTab): void {
    this.hoveredTile.set(null);
    this.activeFlyout.update((curr) => (curr === tab ? null : tab));
  }

  toggleCollapse(): void {
    this.editingVital.set(null);
    this.collapsed.update((v) => !v);
    this.hoveredTile.set(null);
  }

  openSheet(): void {
    this.activeFlyout.set(null);
    this.vttStore.openTokenSheet(this.token().id);
  }

  openTokenizer(): void {
    const tok = this.token();
    const actor = this.linkedActor();
    const ch = this.char();
    this.activeFlyout.set(null);
    this.vttStore.openTokenizerStudio({
      rosterActorId: actor?.id ?? null,
      characterId: ch?.id ?? tok.character_id ?? null,
      tokenId: tok.id,
    });
  }

  setHover(preview: VttHudHoverPreview | null): void {
    this.hoveredTile.set(preview);
  }

  formatSignedMod(mod: number): string {
    return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
  }

  formatFormula(mod: number): string {
    return mod >= 0 ? `2d10 + ${mod}` : `2d10 − ${Math.abs(mod)}`;
  }

  getWeaponVisuals(w: WeaponModel | null | undefined): ResolvedCompendiumVisuals {
    if (!w) {
      return {
        icon: 'fist',
        color: '#FDBA74',
        tintCustom: true,
        isCustomUpload: false,
      };
    }
    return resolveWeaponVisuals(w);
  }

  getNodeVisuals(node: PerkNodeModel): ResolvedCompendiumVisuals {
    return resolveNodeVisuals(node);
  }

  getSecondarySlotNumber(char: CharacterModel): 1 | 2 {
    return char.active_weapon_slot === 1 ? 2 : 1;
  }

  getSecondarySlotWeapon(
    char: CharacterModel,
    stats: DerivedCharacterStats
  ): WeaponModel | null {
    return char.active_weapon_slot === 1
      ? stats.weaponSlot2
      : stats.weaponSlot1;
  }

  getArtCooldown(art: ResolvedCombatArt): number {
    if (
      typeof this.vttStore.isTokenInActiveCombat === 'function' &&
      !this.vttStore.isTokenInActiveCombat(this.token())
    ) {
      return 0;
    }
    return this.vttStore.getPerkCooldown(this.char(), art.baseNode.id);
  }

  formatWeaponReq(req: ResolvedCombatArt['weaponRequirement']): string {
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    return formatWeaponRequirementLabel(req, allWeapons) ?? 'matching weapon';
  }

  getWeaponReachFeet(w: WeaponModel | null | undefined): number {
    if (!w) return 5;
    return Math.max(
      (w.reach_tiles ?? 1) * 5,
      (w.thrown_range_tiles ?? 0) * 5,
      5
    );
  }

  getEffectiveSightLabel(): string {
    const tok = this.token();
    const sc = this.vttStore.activeScene();
    const dimFeet = Math.max(
      0,
      tok.vision_feet ?? DEFAULT_VTT_DIM_VISION_FEET
    );
    const darkFeet = resolveActorDarkvisionFeet(
      tok.darkvision_feet,
      tok.npc_stats
    );
    if (!sc || sc.global_illumination) {
      return `Daylight LoS (Dim ${dimFeet}ft · Dark ${darkFeet}ft)`;
    }
    const carriedFeet = Math.max(
      0,
      tok.light_dim_feet ?? 0,
      tok.light_bright_feet ?? 0
    );
    const sight = computeEffectiveActorSightFeet(
      dimFeet,
      darkFeet,
      sc.darkness_level
    );
    const totalSight = Math.max(sight.effectiveSightFeet, carriedFeet);
    return `${totalSight}ft (Dim ${dimFeet}ft · Dark ${darkFeet}ft)`;
  }

  getGearVisuals(item: ActorInventoryItem): ResolvedCompendiumVisuals {
    const itemsList = this.getActiveCompendiumItems();
    const match = item.compendium_id
      ? itemsList.find((i) => i.id === item.compendium_id)
      : null;
    if (match) return resolveCompendiumItemVisuals(match);
    return {
      icon: 'pack',
      color: '#38BDF8',
      tintCustom: true,
      isCustomUpload: false,
    };
  }

  getCarriedWeaponVisuals(item: ActorInventoryItem): ResolvedCompendiumVisuals {
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    const match = item.compendium_id
      ? allWeapons.find((w) => w.id === item.compendium_id)
      : null;
    if (match) return resolveWeaponVisuals(match);
    return {
      icon: item.gov_skill === 'Shoot' ? 'bow' : 'greatsword',
      color: '#FF8C5A',
      tintCustom: true,
      isCustomUpload: false,
    };
  }

  private getActiveCompendiumItems(): CompendiumItemModel[] {
    if (typeof this.compendiumStore.items === 'function') {
      return this.compendiumStore.items();
    }
    if (typeof this.compendiumStore.allItems === 'function') {
      return this.compendiumStore
        .allItems()
        .filter((i) => isCompendiumItemActive(i));
    }
    return DEFAULT_COMPENDIUM_ITEMS;
  }

  getTokenAttributes(tok: VttTokenModel): Record<AttributeName, number> {
    const ch = this.vttStore.resolveCharacterForToken(tok);
    if (ch) return ch.attributes;
    const actor = this.vttStore.resolveRosterActorForToken(tok);
    return normalizeNpcAttributes(
      tok.npc_stats?.attributes ?? actor?.npc_stats?.attributes
    );
  }

  getTokenCombatSkills(tok: VttTokenModel): Record<CombatSkillName, number> {
    const ch = this.vttStore.resolveCharacterForToken(tok);
    if (ch) return ch.combat_skills;
    const actor = this.vttStore.resolveRosterActorForToken(tok);
    return normalizeNpcCombatSkills(
      tok.npc_stats?.combat_skills ?? actor?.npc_stats?.combat_skills
    );
  }

  getTokenFieldSkillTotals(tok: VttTokenModel) {
    const ch = this.vttStore.resolveCharacterForToken(tok);
    const st = this.vttStore.computeDerivedForCharacter(ch);
    if (st) return st.fieldSkillTotals;
    const actor = this.vttStore.resolveRosterActorForToken(tok);
    return computeNpcFieldSkillTotals({
      ...(actor?.npc_stats ?? {}),
      ...(tok.npc_stats ?? {}),
    });
  }

  getTokenParryMod(tok: VttTokenModel): number {
    const ch = this.vttStore.resolveCharacterForToken(tok);
    const st = this.vttStore.computeDerivedForCharacter(ch);
    if (st) return st.parryMod;
    if (typeof this.vttStore.resolveTokenNpcDefenseMods === 'function') {
      return this.vttStore.resolveTokenNpcDefenseMods(tok).parryMod;
    }
    const actor = this.vttStore.resolveRosterActorForToken?.(tok);
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    return resolveEffectiveNpcDefenseMods(
      { ...(actor?.npc_stats ?? {}), ...(tok.npc_stats ?? {}) },
      this.vttStore.getNpcStandaloneNodes?.(tok) ?? [],
      allWeapons
    ).parryMod;
  }

  getTokenDodgeMod(tok: VttTokenModel): number {
    const ch = this.vttStore.resolveCharacterForToken(tok);
    const st = this.vttStore.computeDerivedForCharacter(ch);
    if (st) return st.dodgeMod;
    if (typeof this.vttStore.resolveTokenNpcDefenseMods === 'function') {
      return this.vttStore.resolveTokenNpcDefenseMods(tok).dodgeMod;
    }
    const actor = this.vttStore.resolveRosterActorForToken?.(tok);
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    return resolveEffectiveNpcDefenseMods(
      { ...(actor?.npc_stats ?? {}), ...(tok.npc_stats ?? {}) },
      this.vttStore.getNpcStandaloneNodes?.(tok) ?? [],
      allWeapons
    ).dodgeMod;
  }

  canTokenDodge(tok: VttTokenModel): boolean {
    const ch = this.vttStore.resolveCharacterForToken(tok);
    const st = this.vttStore.computeDerivedForCharacter(ch);
    if (st) return st.canDodge;
    return tok.npc_stats?.can_dodge !== false;
  }

  private formatModSpan(values: readonly number[], prefix = ''): string {
    if (values.length === 0) return `${prefix}+0`;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return `${prefix}${this.formatSignedMod(min)}`;
    }
    return `${prefix}${this.formatSignedMod(min)}..${this.formatSignedMod(max)}`;
  }

  getGroupAttributeModLabel(attr: AttributeName): string {
    return this.formatModSpan(
      this.selectedTokens().map((t) => this.getTokenAttributes(t)[attr] ?? 0)
    );
  }

  getGroupCombatSkillRankLabel(skill: CombatSkillName): string {
    const vals = this.selectedTokens().map(
      (t) => this.getTokenCombatSkills(t)[skill] ?? 0
    );
    if (vals.length === 0) return '+0';
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return min === max ? `+${min}` : `+${min}..+${max}`;
  }

  getGroupFieldSkillFormulaLabel(skill: FieldSkillName): string {
    const vals = this.selectedTokens().map(
      (t) => this.getTokenFieldSkillTotals(t)[skill]?.total ?? 0
    );
    if (vals.length === 0) return '2d10+0';
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return `2d10${this.formatSignedMod(min)}`;
    return `2d10 ${this.formatSignedMod(min)}..${this.formatSignedMod(max)}`;
  }

  getGroupParryLabel(): string {
    return this.formatModSpan(
      this.selectedTokens().map((t) => this.getTokenParryMod(t))
    );
  }

  getGroupDodgeLabel(): string {
    const eligible = this.selectedTokens().filter((t) => this.canTokenDodge(t));
    if (eligible.length === 0) return 'Off';
    return this.formatModSpan(eligible.map((t) => this.getTokenDodgeMod(t)));
  }

  getGroupStatusCount(status: Exclude<CombatStatusEffect, 'None'>): number {
    return this.selectedTokens().filter((t) => t.statuses.includes(status))
      .length;
  }

  isHudStatusActive(status: Exclude<CombatStatusEffect, 'None'>): boolean {
    if (!this.isMultiSelect()) {
      return this.token().statuses.includes(status);
    }
    const list = this.selectedTokens();
    return list.length > 0 && list.every((t) => t.statuses.includes(status));
  }

  async toggleHudStatus(
    status: Exclude<CombatStatusEffect, 'None'>
  ): Promise<void> {
    if (!this.isMultiSelect()) {
      if (!this.canControl()) return;
      await this.vttStore.toggleTokenStatus(this.token(), status);
      return;
    }
    const targets = this.controllableGroup();
    if (targets.length === 0) return;
    const allHave = targets.every((t) => t.statuses.includes(status));
    const entries = targets.map((t) => ({
      tokenId: t.id,
      patch: {
        statuses: allHave
          ? t.statuses.filter((s) => s !== status)
          : t.statuses.includes(status)
            ? t.statuses
            : [...t.statuses, status],
      },
    }));
    await this.vttStore.recordablePatchTokensBatch(
      entries,
      `${allHave ? 'Clear' : 'Apply'} ${status} (${targets.length} Tokens)`
    );
  }

  focusSingleToken(tokenId: string, event?: Event): void {
    event?.stopPropagation();
    this.vttStore.setSelectedTokens([tokenId]);
  }

  clearSelection(): void {
    this.activeFlyout.set(null);
    this.vttStore.clearTokenSelection();
  }

  toggleGroupHidden(): void {
    const ids = this.selectedTokens().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.toggleTokensHiddenBatch(ids);
    }
  }

  flipGroupHorizontal(): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.flipTokensHorizontal(ids);
    }
  }

  flipGroupVertical(): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.flipTokensVertical(ids);
    }
  }

  rotateGroupBy(deltaDeg: number): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.rotateTokensByDelta(ids, deltaDeg);
    }
  }

  resetGroupRotation(): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.setTokensRotation(ids, 0);
    }
  }

  bringGroupToFront(): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.bringTokensToFront(ids);
    }
  }

  sendGroupToBack(): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      void this.vttStore.sendTokensToBack(ids);
    }
  }

  removeGroupTokens(): void {
    const ids = this.controllableGroup().map((t) => t.id);
    if (ids.length > 0) {
      this.activeFlyout.set(null);
      void this.vttStore.removeTokensBatch(ids);
    }
  }

  async refillGroupAp(): Promise<void> {
    const targets = this.controllableGroup().filter(
      (t) => t.current_ap < t.max_ap
    );
    if (targets.length === 0) return;
    const snapshots = targets.map((t) => ({
      tok: t,
      prevAp: t.current_ap,
      nextAp: t.max_ap,
    }));
    await this.vttStore.recordablePatchTokensBatch(
      targets.map((t) => ({
        tokenId: t.id,
        patch: { current_ap: t.max_ap },
      })),
      `Refresh AP (${targets.length} Tokens)`
    );
    for (const snap of snapshots) {
      await this.vttStore.logManualApAdjustment(
        snap.tok,
        snap.prevAp,
        snap.nextAp
      );
    }
  }

  async rollInitiative(): Promise<void> {
    const targets = this.isMultiSelect()
      ? this.controllableGroup()
      : this.canControl() || this.vttStore.isGm()
        ? [this.token()]
        : [];
    if (targets.length === 0) return;
    await this.vttStore.rollInitiativeForTokens(targets.map((t) => t.id));
  }

  startVitalEdit(stat: VttHudEditableVital, event?: Event): void {
    event?.stopPropagation();
    const allowed = this.isMultiSelect()
      ? this.canControlAny()
      : this.canControl();
    if (!allowed) return;
    if (this.editingVital() === stat) return;
    this.editingVital.set(stat);
    if (this.isMultiSelect()) {
      this.vitalInputDraft.set('');
    } else {
      const tok = this.token();
      this.vitalInputDraft.set(String(tok[stat]));
    }
    setTimeout(() => {
      const inputEl = this.hostRef.nativeElement.querySelector(
        `input[data-hud-vital-input="${stat}"]`
      ) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }, 0);
  }

  onVitalDraftInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.vitalInputDraft.set(target?.value ?? '');
  }

  onVitalInputKeyDown(
    event: KeyboardEvent,
    stat: VttHudEditableVital
  ): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitVitalEdit(stat);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelVitalEdit();
    }
  }

  cancelVitalEdit(): void {
    this.editingVital.set(null);
  }

  commitVitalEdit(stat: VttHudEditableVital): void {
    if (this.editingVital() !== stat) return;
    const raw = this.vitalInputDraft();
    this.editingVital.set(null);

    if (this.isMultiSelect()) {
      const targets = this.controllableGroup();
      if (targets.length === 0) return;
      const overflowToHp = this.settingsStore.preferences().overflowSpDamageToHp;
      const entries: { tokenId: string; patch: Partial<VttTokenModel> }[] = [];

      for (const t of targets) {
        if (stat === 'current_sp') {
          const spPatch = resolveHudSpVitalPatch(
            raw,
            t.current_sp,
            t.max_sp,
            t.current_hp,
            t.max_hp,
            overflowToHp
          );
          if (!spPatch) continue;
          const patch: Partial<VttTokenModel> = {};
          if (spPatch.current_sp !== t.current_sp) {
            patch.current_sp = spPatch.current_sp;
          }
          if (
            spPatch.current_hp !== undefined &&
            spPatch.current_hp !== t.current_hp
          ) {
            patch.current_hp = spPatch.current_hp;
          }
          if (Object.keys(patch).length > 0) {
            entries.push({ tokenId: t.id, patch });
          }
        } else {
          const nextHp = resolveHudVitalInputValue(raw, t.current_hp, t.max_hp);
          if (nextHp !== null && nextHp !== t.current_hp) {
            entries.push({ tokenId: t.id, patch: { current_hp: nextHp } });
          }
        }
      }

      if (entries.length === 0) return;
      const statLabel = stat === 'current_hp' ? 'HP' : 'SP';
      void this.vttStore.recordablePatchTokensBatch(
        entries,
        `Group ${statLabel} (${raw.trim()})`
      );
      return;
    }

    if (!this.canControl()) return;
    const tok = this.token();
    if (stat === 'current_sp') {
      const spPatch = resolveHudSpVitalPatch(
        raw,
        tok.current_sp,
        tok.max_sp,
        tok.current_hp,
        tok.max_hp,
        this.settingsStore.preferences().overflowSpDamageToHp
      );
      if (!spPatch) return;
      const tokenPatch: Partial<VttTokenModel> = {};
      if (spPatch.current_sp !== tok.current_sp) {
        tokenPatch.current_sp = spPatch.current_sp;
      }
      if (
        spPatch.current_hp !== undefined &&
        spPatch.current_hp !== tok.current_hp
      ) {
        tokenPatch.current_hp = spPatch.current_hp;
      }
      if (Object.keys(tokenPatch).length === 0) return;
      const spDiff = spPatch.current_sp - tok.current_sp;
      const spDiffLabel = spDiff >= 0 ? `+${spDiff}` : `${spDiff}`;
      const label =
        tokenPatch.current_hp !== undefined
          ? `${tok.name} SP (${spDiffLabel}) & HP (${tokenPatch.current_hp - tok.current_hp})`
          : `${tok.name} SP (${spDiffLabel})`;
      void this.vttStore.recordablePatchToken(tok.id, tokenPatch, label);
      return;
    }

    const next = resolveHudVitalInputValue(raw, tok.current_hp, tok.max_hp);
    if (next === null || next === tok.current_hp) return;
    const diff = next - tok.current_hp;
    const diffLabel = diff >= 0 ? `+${diff}` : `${diff}`;
    void this.vttStore.recordablePatchToken(
      tok.id,
      { current_hp: next },
      `${tok.name} HP (${diffLabel})`
    );
  }

  adjustVital(
    stat: 'current_hp' | 'current_sp' | 'current_ap',
    delta: number
  ): void {
    if (this.isMultiSelect()) {
      const targets = this.controllableGroup();
      if (targets.length === 0) return;
      const statLabel =
        stat === 'current_hp' ? 'HP' : stat === 'current_sp' ? 'SP' : 'AP';
      const apSnapshots =
        stat === 'current_ap'
          ? targets.map((t) => ({
              tok: t,
              prevAp: t.current_ap,
              nextAp: Math.max(0, Math.min(t.max_ap, t.current_ap + delta)),
            }))
          : [];
      void this.vttStore
        .recordablePatchTokensBatch(
          targets.map((t) => {
            const maxVal =
              stat === 'current_hp'
                ? t.max_hp
                : stat === 'current_sp'
                  ? t.max_sp
                  : t.max_ap;
            return {
              tokenId: t.id,
              patch: {
                [stat]: Math.max(0, Math.min(maxVal, t[stat] + delta)),
              },
            };
          }),
          `Group ${statLabel} (${delta >= 0 ? '+' : ''}${delta})`
        )
        .then(async () => {
          for (const snap of apSnapshots) {
            if (snap.prevAp !== snap.nextAp) {
              await this.vttStore.logManualApAdjustment(
                snap.tok,
                snap.prevAp,
                snap.nextAp
              );
            }
          }
        });
      return;
    }

    const tok = this.token();
    if (!this.canControl()) return;
    const maxVal =
      stat === 'current_hp'
        ? tok.max_hp
        : stat === 'current_sp'
          ? tok.max_sp
          : tok.max_ap;
    const prev = tok[stat];
    const next = Math.max(0, Math.min(maxVal, prev + delta));
    if (next === prev) return;
    const statLabel =
      stat === 'current_hp' ? 'HP' : stat === 'current_sp' ? 'SP' : 'AP';
    void this.vttStore
      .recordablePatchToken(
        tok.id,
        { [stat]: next },
        `Adjust ${tok.name} ${statLabel}`
      )
      .then(() => {
        if (stat === 'current_ap') {
          void this.vttStore.logManualApAdjustment(tok, prev, next);
        }
      });
  }

  setApFromPip(pip: number): void {
    const tok = this.token();
    if (!this.canControl()) return;
    const prevAp = tok.current_ap;
    const next = Math.max(
      0,
      Math.min(tok.max_ap, pip === prevAp ? Math.max(0, pip - 1) : pip)
    );
    if (next === prevAp) return;
    void this.vttStore
      .recordablePatchToken(
        tok.id,
        { current_ap: next },
        `Set ${tok.name} AP`
      )
      .then(() => {
        void this.vttStore.logManualApAdjustment(tok, prevAp, next);
      });
  }

  readonly npcWeaponStats = computed<ResolvedNpcWeaponStats>(() => {
    const tok = this.token();
    if (typeof this.vttStore.resolveTokenNpcWeaponStats === 'function') {
      return this.vttStore.resolveTokenNpcWeaponStats(tok);
    }
    const actor = this.linkedActor();
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    const merged: VttNpcStats = {
      ...(actor?.npc_stats ?? {}),
      ...(tok.npc_stats ?? {}),
      __inventory:
        tok.npc_stats?.__inventory !== undefined
          ? tok.npc_stats.__inventory
          : actor?.npc_stats?.__inventory,
    };
    const standaloneNodes =
      typeof this.vttStore.getNpcStandaloneNodes === 'function'
        ? this.vttStore.getNpcStandaloneNodes(tok)
        : [];
    return resolveEffectiveNpcWeaponStats(
      merged,
      standaloneNodes,
      allWeapons,
      { weaponName: 'Melee Strike', attackMod: 3, flatDamage: 4 }
    );
  });

  triggerActiveWeapon(): void {
    const tok = this.token();
    if (!this.canControl()) return;
    const st = this.stats();
    if (st) {
      const apCost = st.activeWeapon?.ap_cost ?? 1;
      if (tok.current_ap < apCost) return;
      this.vttStore.beginWeaponTargetSelection(tok, st.activeWeapon, st);
      return;
    }
    const npcWep = this.npcWeaponStats();
    if (tok.current_ap < npcWep.attackAp) return;
    this.vttStore.beginWeaponTargetSelection(tok);
  }

  async rollActiveWeaponCheck(event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    const st = this.stats();
    if (st) {
      const wepName = st.activeWeapon?.name || 'Unarmed';
      await this.rollHudCheck(
        `${wepName} Attack`,
        st.attackRollMod,
        `${st.flatWeaponDamage} DMG`
      );
      return;
    }
    const npcWep = this.npcWeaponStats();
    await this.rollHudCheck(
      `${npcWep.weaponName} Attack`,
      npcWep.attackMod,
      `${npcWep.flatDamage} DMG`
    );
  }

  getNpcCarriedWeaponSummary(item: ActorInventoryItem): string {
    const tok = this.token();
    const actor = this.linkedActor();
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    const merged: VttNpcStats = {
      ...(actor?.npc_stats ?? {}),
      ...(tok.npc_stats ?? {}),
    };
    const f = computeNpcWeaponFormula(merged, item, [], allWeapons);
    return `${this.formatSignedMod(f.attackMod)} · ${f.flatDamage} DMG`;
  }

  isNpcCarriedWeaponEquipped(item: ActorInventoryItem): boolean {
    const eff = this.npcWeaponStats();
    if (eff.inventoryWeapon) {
      return eff.inventoryWeapon.id === item.id;
    }
    return Boolean(item.equipped);
  }

  async equipNpcCarriedWeapon(item: ActorInventoryItem): Promise<void> {
    if (!this.canControl() || this.char()) return;
    const tok = this.token();
    const actor = this.linkedActor();
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    const baseStats: VttNpcStats = {
      ...(actor?.npc_stats ?? {}),
      ...(tok.npc_stats ?? {}),
    };
    const compWep = item.compendium_id
      ? (allWeapons.find((w) => w.id === item.compendium_id) ?? null)
      : null;
    const standaloneNodes =
      typeof this.vttStore.getNpcStandaloneNodes === 'function'
        ? this.vttStore.getNpcStandaloneNodes(tok)
        : [];
    const f = computeNpcWeaponFormula(baseStats, item, standaloneNodes, allWeapons);
    const reachFeet = compWep
      ? Math.max(
          (compWep.reach_tiles ?? 1) * 5,
          (compWep.thrown_range_tiles ?? 0) * 5,
          5
        )
      : f.reachFeet;
    const nextInv = this.inventoryItems().map((it) =>
      getInventoryItemCategory(it) === 'weapon'
        ? { ...it, equipped: it.id === item.id }
        : it
    );
    await this.vttStore.updateNpcFromVttSheet(actor?.id ?? null, tok.id, {
      npc_stats: {
        ...baseStats,
        weapon_name: compWep?.name || item.name || 'Strike',
        attack_ap: f.apCost,
        attack_mod: f.attackMod,
        flat_damage: f.flatDamage,
        reach_feet: reachFeet,
        __inventory: nextInv,
      },
    });
  }

  async swapWeaponSlot(): Promise<void> {
    const tok = this.token();
    if (!this.canControl()) return;
    if (tok.current_ap < 1) return;
    await this.vttStore.switchCharacterWeaponSlotInVtt(tok);
  }

  triggerPcArt(art: ResolvedCombatArt): void {
    const tok = this.token();
    const st = this.stats();
    if (!this.canControl() || !st) return;
    const cd = this.getArtCooldown(art);
    if (cd > 0 || tok.current_ap < art.apCost || !art.meetsWeaponRequirement) {
      return;
    }
    this.activeFlyout.set(null);
    this.vttStore.beginCombatArtTargetSelection(tok, art, st);
  }

  triggerNpcArt(node: PerkNodeModel): void {
    const tok = this.token();
    const apCost = Number(node.ap_cost ?? 1);
    if (!this.canControl() || tok.current_ap < apCost) return;
    this.activeFlyout.set(null);
    this.vttStore.beginNpcStandaloneArtTargetSelection(tok, node);
  }

  async toggleRaiseGuard(): Promise<void> {
    if (this.isMultiSelect()) {
      const eligible = this.controllableGroup().filter(
        (t) => t.shield_block > 0
      );
      if (eligible.length === 0) return;
      const allRaised = eligible.every((t) => t.shield_raised);
      if (allRaised) {
        await this.vttStore.recordablePatchTokensBatch(
          eligible.map((t) => ({
            tokenId: t.id,
            patch: { shield_raised: false },
          })),
          `Lower Guard (${eligible.length} Tokens)`
        );
        return;
      }
      const toRaise = eligible.filter(
        (t) =>
          !t.shield_raised &&
          t.current_ap >= 1 &&
          (t.max_sp <= 0 || t.current_sp > 0)
      );
      if (toRaise.length === 0) return;
      await this.vttStore.recordablePatchTokensBatch(
        toRaise.map((t) => ({
          tokenId: t.id,
          patch: {
            shield_raised: true,
            current_ap: Math.max(0, t.current_ap - 1),
          },
        })),
        `Raise Guard (${toRaise.length} Tokens)`
      );
      return;
    }

    const tok = this.token();
    if (!this.canControl() || tok.shield_block <= 0) return;
    await this.vttStore.toggleTokenRaiseShield(tok);
  }

  async triggerReaction(kind: 'parry' | 'dodge'): Promise<void> {
    if (this.isMultiSelect()) {
      const eligible = this.controllableGroup().filter(
        (t) => t.current_ap >= 1 && (kind === 'parry' || this.canTokenDodge(t))
      );
      if (eligible.length === 0) return;

      await this.vttStore.recordablePatchTokensBatch(
        eligible.map((t) => ({
          tokenId: t.id,
          patch: { current_ap: Math.max(0, t.current_ap - 1) },
        })),
        `${kind === 'parry' ? 'Parry' : 'Dodge'} Reaction (${eligible.length} Tokens)`
      );

      for (const t of eligible) {
        if (kind === 'parry') {
          await this.rollHudCheckForToken(
            t,
            'Parry Reaction',
            this.getTokenParryMod(t),
            '1 AP spent'
          );
        } else {
          await this.rollHudCheckForToken(
            t,
            'Dodge Reaction',
            this.getTokenDodgeMod(t),
            '1 AP spent · Shifts 5 ft · Flawless (+5) refunds 1 AP'
          );
        }
      }
      return;
    }

    const tok = this.token();
    if (!this.canControl() || tok.current_ap < 1) return;
    if (kind === 'dodge' && !this.canDodge()) return;

    await this.vttStore.recordablePatchToken(
      tok.id,
      { current_ap: Math.max(0, tok.current_ap - 1) },
      `${kind === 'parry' ? 'Parry' : 'Dodge'} Reaction (${tok.name})`
    );

    const st = this.stats();
    if (kind === 'parry') {
      const detail = st
        ? `1 AP spent · Flawless (+5) deals ${st.flawlessParryCounterSp} SP`
        : '1 AP spent';
      await this.rollHudCheck('Parry Reaction', this.parryMod(), detail);
    } else {
      await this.rollHudCheck(
        'Dodge Reaction',
        this.dodgeMod(),
        '1 AP spent · Shifts 5 ft · Flawless (+5) refunds 1 AP'
      );
    }
  }

  async triggerStanceRecovery(): Promise<void> {
    if (this.isMultiSelect()) {
      const eligible = this.controllableGroup().filter(
        (t) => t.current_ap >= 1 && t.current_sp < t.max_sp
      );
      for (const t of eligible) {
        await this.vttStore.performStanceRecovery(t);
      }
      return;
    }

    const tok = this.token();
    if (!this.canControl()) return;
    await this.vttStore.performStanceRecovery(tok);
  }

  async triggerTacticalAction(
    label: 'Move' | 'Aim' | 'Interact',
    _detailText?: string
  ): Promise<void> {
    if (this.isMultiSelect()) {
      const eligible = this.controllableGroup().filter(
        (t) => t.current_ap >= 1
      );
      if (eligible.length === 0) return;
      await this.vttStore.recordablePatchTokensBatch(
        eligible.map((t) => ({
          tokenId: t.id,
          patch: { current_ap: Math.max(0, t.current_ap - 1) },
        })),
        `${label} (${eligible.length} Tokens)`
      );
      if (typeof this.vttStore.postLog === 'function') {
        const names = eligible.map((t) => t.name).join(', ');
        await this.vttStore.postLog({
          kind: 'system',
          title: `${eligible.length} tokens used ${label} (1 AP)`,
          detail: names,
        });
      }
      return;
    }

    const tok = this.token();
    if (!this.canControl() || tok.current_ap < 1) return;
    await this.vttStore.recordablePatchToken(
      tok.id,
      { current_ap: Math.max(0, tok.current_ap - 1) },
      `${label} (${tok.name})`
    );
    if (typeof this.vttStore.postLog === 'function') {
      await this.vttStore.postLog({
        kind: 'system',
        title: `${tok.name} used ${label} (1 AP)`,
        detail: null,
        senderNameOverride: tok.name,
      });
    }
  }

  async rollAttributeCheck(attr: AttributeName): Promise<void> {
    const targets = this.isMultiSelect()
      ? this.controllableGroup()
      : [this.token()];
    for (const t of targets) {
      const val = this.getTokenAttributes(t)[attr] ?? 0;
      await this.rollHudCheckForToken(
        t,
        `${attr} Check`,
        val,
        `${attr} ${val >= 0 ? '+' : ''}${val}`
      );
    }
  }

  async rollCombatSkillCheck(skill: CombatSkillName): Promise<void> {
    const targets = this.isMultiSelect()
      ? this.controllableGroup()
      : [this.token()];
    for (const t of targets) {
      const attrs = this.getTokenAttributes(t);
      const rank = this.getTokenCombatSkills(t)[skill] ?? 0;
      if (skill === 'Parry') {
        await this.rollHudCheckForToken(
          t,
          'Parry Check',
          this.getTokenParryMod(t),
          `Technique +${attrs.Technique ?? 0}, Parry +${rank}`
        );
        continue;
      }
      if (skill === 'Dodge') {
        await this.rollHudCheckForToken(
          t,
          'Dodge Check',
          this.getTokenDodgeMod(t),
          `Agility +${attrs.Agility ?? 0}, Dodge +${rank}`
        );
        continue;
      }
      const govAttr: AttributeName =
        skill === 'Shoot'
          ? (attrs.Technique ?? 0) >= (attrs.Agility ?? 0)
            ? 'Technique'
            : 'Agility'
          : skill === 'Block'
            ? 'Iron'
            : (attrs.Brawn ?? 0) >= (attrs.Technique ?? 0)
              ? 'Brawn'
              : 'Technique';
      const govVal = attrs[govAttr] ?? 0;
      await this.rollHudCheckForToken(
        t,
        `${skill} Check`,
        govVal + rank,
        `${govAttr} +${govVal}, ${skill} +${rank}`
      );
    }
  }

  async rollFieldSkillCheck(skill: FieldSkillName): Promise<void> {
    const targets = this.isMultiSelect()
      ? this.controllableGroup()
      : [this.token()];
    for (const t of targets) {
      const info = this.getTokenFieldSkillTotals(t)[skill];
      if (!info) continue;
      await this.rollHudCheckForToken(
        t,
        `${skill} Check`,
        info.total,
        `${info.govAttr} +${info.govVal}, Rank ${info.rank}`
      );
    }
  }

  async rollHudCheck(
    label: string,
    modifier: number,
    detail?: string
  ): Promise<void> {
    await this.rollHudCheckForToken(this.token(), label, modifier, detail);
  }

  async rollHudCheckForToken(
    tok: VttTokenModel,
    label: string,
    modifier: number,
    detail?: string
  ): Promise<void> {
    const vis = this.vttStore.resolveTokenVisuals(tok);
    await this.vttStore.rollActorSheetCheck({
      speakerName: tok.name,
      speakerColor: tok.color || '#38B29A',
      speakerIcon: tok.icon || 'greatsword',
      speakerFaction: tok.faction,
      speakerPortraitUrl: vis.portraitUrl,
      speakerTokenImageUrl: vis.tokenImageUrl,
      speakerTokenAppearance: vis.tokenAppearance,
      label,
      modifier,
      detail,
    });
  }

  async useInventoryItem(
    item: ActorInventoryItem,
    consumeOne: boolean
  ): Promise<void> {
    const tok = this.token();
    if (!this.canControl() || tok.current_ap < 1) return;

    await this.vttStore.recordablePatchToken(
      tok.id,
      { current_ap: Math.max(0, tok.current_ap - 1) },
      `Use ${item.name} (${tok.name})`
    );

    if (consumeOne) {
      await this.adjustInventoryItemQty(item.id, -1);
    }

    if (typeof this.vttStore.postLog === 'function') {
      await this.vttStore.postLog({
        kind: 'system',
        title: `Used ${item.name}`,
        detail: consumeOne ? '−1 qty' : null,
        senderNameOverride: tok.name,
      });
    }
  }

  async adjustInventoryItemQty(itemId: string, delta: number): Promise<void> {
    if (!this.canControl()) return;
    const ch = this.char();
    if (ch) {
      await this.vttStore.updateCharacterFromVttSheet(ch.id, (curr) => ({
        ...curr,
        inventory: normalizeInventoryItems(curr.inventory)
          .map((it) =>
            it.id === itemId
              ? { ...it, quantity: Math.max(0, it.quantity + delta) }
              : it
          )
          .filter((it) => it.quantity > 0),
      }));
      return;
    }

    const tok = this.token();
    const actor = this.linkedActor();
    const nextInv = this.inventoryItems()
      .map((it) =>
        it.id === itemId
          ? { ...it, quantity: Math.max(0, it.quantity + delta) }
          : it
      )
      .filter((it) => it.quantity > 0);
    await this.vttStore.updateNpcFromVttSheet(actor?.id ?? null, tok.id, {
      npc_stats: {
        ...(actor?.npc_stats ?? tok.npc_stats ?? {}),
        __inventory: nextInv,
      },
    });
  }

  async equipCarriedWeaponToSlot(
    item: ActorInventoryItem,
    slot: 1 | 2
  ): Promise<void> {
    const ch = this.char();
    if (!ch || !this.canControl() || !item.compendium_id) return;
    const allWeapons =
      typeof this.compendiumStore.allWeapons === 'function'
        ? this.compendiumStore.allWeapons()
        : [];
    const wep = allWeapons.find((w) => w.id === item.compendium_id);
    if (!wep) return;

    await this.vttStore.updateCharacterFromVttSheet(ch.id, (curr) => {
      const prevSlotId =
        slot === 1 ? curr.weapon_slot_1_id : curr.weapon_slot_2_id;
      const prevWep = prevSlotId
        ? (allWeapons.find((w) => w.id === prevSlotId) ?? null)
        : null;
      let nextInv = normalizeInventoryItems(curr.inventory)
        .map((it) =>
          it.id === item.id ? { ...it, quantity: it.quantity - 1 } : it
        )
        .filter((it) => it.quantity > 0);
      if (prevWep) {
        nextInv = [
          ...nextInv,
          {
            id: `item-${Date.now()}`,
            category: 'weapon',
            compendium_id: prevWep.id,
            subcategory: prevWep.category,
            name: prevWep.name,
            quantity: 1,
            description: prevWep.trait_description || '',
            gov_attribute: prevWep.gov_attribute,
            gov_skill: prevWep.gov_skill,
            ap_cost: prevWep.ap_cost,
            base_damage: prevWep.base_damage,
            reach_feet: Math.max(5, (prevWep.reach_tiles ?? 1) * 5),
            two_handed: isWeaponTwoHanded(prevWep),
          },
        ];
      }
      const nextSlot1 = slot === 1 ? wep.id : curr.weapon_slot_1_id;
      const nextSlot2 = slot === 2 ? wep.id : curr.weapon_slot_2_id;
      const activeId = curr.active_weapon_slot === 1 ? nextSlot1 : nextSlot2;
      const activeWep = activeId
        ? (allWeapons.find((w) => w.id === activeId) ?? null)
        : null;
      return {
        ...curr,
        weapon_slot_1_id: nextSlot1,
        weapon_slot_2_id: nextSlot2,
        equipped_shield: isWeaponTwoHanded(activeWep)
          ? 'None'
          : curr.equipped_shield,
        inventory: nextInv,
      };
    });
  }

  async endActiveTurn(): Promise<void> {
    if (!this.canEndTurn()) return;
    await this.vttStore.advanceTurn();
  }
}
