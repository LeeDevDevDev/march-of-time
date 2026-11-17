import {
  Injectable,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UserAssetsStore } from '../../../core/assets/user-assets.store';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  ActiveCombatTag,
  CombatStatusEffect,
  WeaponModel,
  computeCombatArtReachFeet,
  resolveCombatArtRangeMode,
  resolveWeaponVisuals,
} from '../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { VttSettingsStore } from '../../../core/settings/vtt-settings.store';
import {
  allocateFloatingWindowId,
  focusFloatingWindow,
  releaseFloatingWindow,
} from '../../../shared/floating-window-stack';
import {
  ActorInventoryItem,
  AttributeName,
  CharacterModel,
  DerivedCharacterStats,
  PerkNodeModel,
  ResolvedCombatArt,
  UPGRADE_SLOT_PREFIX,
  computeDerivedStats,
  normalizeInventoryItems,
} from '../../characters/models/character.model';
import {
  CharacterService,
  normalizeCharacterRecord,
} from '../../characters/services/character.service';
import { CharacterStore } from '../../characters/store/character.store';
import {
  ActorTemplateDraft,
  CollectionsStore,
  buildActorTemplateFromCharacter,
  buildActorTemplateFromNpcPreset,
} from '../../collections/collections.store';
import { GameCardModel } from '../../dashboard/models/campaign.model';
import {
  VTT_CHAT_COMMANDS,
  VttChatCommandConfig,
  getAllCommandTriggers,
  isUnknownSlashCommand,
  resolveSlashCommand,
} from '../config/vtt-commands.config';
import {
  DefenderClashCapabilities,
  createManualRoll,
  getLegalDefenderReactions,
  resolveClashReaction,
  roll2d10Check,
} from '../engine/clash.engine';
import {
  DicePoolCounts,
  VttDiceThrowPayload,
  VttPhysicalDieRoll,
  buildPhysicalDiceFrom2d10Roll,
  generateThrowSeed,
  getTotalDiceInPool,
  parseAndRollDiceFormula,
  rollCustomDicePool,
  sanitizeIncomingDiceThrowPayload,
} from '../engine/dice-roller.engine';
import { canNestFolderInside } from '../engine/directory-tree.engine';
import {
  HexGridGeometry,
  SceneCanvasLayout,
  clampHexToBounds,
  clampWorldPointToBounds,
  computeSceneCanvasLayout,
  getTokenDistanceFeet,
  getTokenWorldCenter,
  hexKey,
  hexToWorldCenter,
  offsetToAxial,
  parseHexKey,
  worldPointToHex,
} from '../engine/hex-grid.engine';
import {
  buildLightPolygons,
  buildObserverVisions,
  collectNewlyExploredHexKeys,
} from '../engine/visibility.engine';
import {
  DEFAULT_VTT_BG_COLOR,
  DEFAULT_VTT_DARKNESS_LEVEL,
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  DEFAULT_VTT_GRID_HEIGHT,
  DEFAULT_VTT_GRID_OPACITY,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_GRID_WIDTH,
  DEFAULT_VTT_SCENE_HEIGHT_PX,
  DEFAULT_VTT_SCENE_PADDING,
  DEFAULT_VTT_SCENE_WIDTH_PX,
  CollectionActorModel,
  HexCoord,
  VttActorKind,
  VttClashResolution,
  VttDefenseChoice,
  VttDirectoryScope,
  VttExploredFog,
  VttFaction,
  VttFolderModel,
  VttLightSource,
  VttLogEntry,
  VttNpcPreset,
  VttNpcStats,
  VttParticipant,
  VttPendingClash,
  VttPoint,
  VttCompendiumDragPayload,
  VttRosterActorModel,
  VttRosterDragPayload,
  VttSceneModel,
  VttTokenModel,
  VttToolMode,
  VttWallKind,
  VttWallSegment,
  TokenAppearanceConfig,
  VTT_INITIATION_PHASE_SENTINEL,
  VTT_NPC_PRESETS,
  cloneDetachedNpcStats,
  cloneDetachedVttCharacterSheet,
  enrichNpcStatsWithVisuals,
  makeDetachedVttCharacterId,
  normalizeNpcAttributes,
  normalizeTokenAppearance,
  normalizeTokenRotation,
  parseCharacterIdFromUrlOrInput,
  parseCollectionActorIdFromUrlOrInput,
  resolveActorDarkvisionFeet,
  resolveActorTokenDisplayName,
  resolveEntityPortraitUrl,
  resolveEntityTokenAppearance,
  resolveEntityTokenImageUrl,
  resolveRosterActorSourceCharacterId,
  sanitizeOptionalImageUrl,
} from '../models/vtt.model';
import { VttPingBroadcast, VttService } from '../services/vtt.service';

export type VttSpeakerMode = 'user' | 'character';

export interface BatchTokenMoveInput {
  tokenId: string;
  distanceFeet: number;
  freeOverride?: boolean;
  targetHex?: HexCoord;
  targetWorld?: VttPoint;
}

export interface VttOpenSheetTarget {
  rosterActorId: string | null;
  characterId: string | null;
  tokenId: string | null;
}

export interface VttOpenSheetWindowEntry {
  key: string;
  target: VttOpenSheetTarget;
  focusTick: number;
  windowId: number;
}

export interface VttResolvedChatSpeaker {
  name: string;
  mode: VttSpeakerMode;
  tokenId: string | null;
  characterId: string | null;
  color: string | null;
  icon?: string | null;
  faction?: VttFaction;
  portraitUrl?: string | null;
  tokenImageUrl?: string | null;
  tokenAppearance?: TokenAppearanceConfig;
}

export interface VttWhisperTargetOption {
  key: string;
  insertToken: string;
  label: string;
  sublabel: string;
  userIds: string[];
}

export interface PendingTargetAction {
  attackerTokenId: string;
  kind: 'weapon' | 'combat_art';
  actionName: string;
  apCost: number;
  cooldownRounds: number;
  perkId: string | null;
  reachFeet: number;
  attackMod: number;
  flatDamage: number;
  combatTags: ActiveCombatTag[];
  disallowedDefenses: ('Parry' | 'Dodge' | 'Block')[];
  bonusSpDamage: number;
  ignoreArmorDr: number;
  defendedSpChip: number;
  pushFeet: number;
  selfShiftFeet: number;
  inflictStatuses: Exclude<CombatStatusEffect, 'None'>[];
}

export type VttUndoPayload =
  | {
      kind: 'token_patch';
      tokenId: string;
      previousTokenPatch: Partial<VttTokenModel>;
      previousExploredFog?: VttExploredFog;
    }
  | {
      kind: 'token_spawned';
      tokenId: string;
      previousExploredFog?: VttExploredFog;
    }
  | {
      kind: 'token_removed';
      tokenSnapshot: VttTokenModel;
    }
  | {
      kind: 'tokens_batch';
      patches?: {
        tokenId: string;
        previousTokenPatch: Partial<VttTokenModel>;
      }[];
      removedSnapshots?: VttTokenModel[];
      previousExploredFog?: VttExploredFog;
      selectedTokenIdsAfterUndo?: string[];
      coalesceKey?: string;
    }
  | {
      kind: 'scene_patch';
      previousScenePatch: Partial<VttSceneModel>;
      selectedLightIdAfterUndo?: string | null;
    };

export type VttUndoEntry = VttUndoPayload & {
  id: string;
  sceneId: string;
  label: string;
  createdAt: number;
};

const MAX_VTT_UNDO_STACK = 30;
const ROTATION_UNDO_COALESCE_MS = 900;

function createSyncedPrimaryTokenSignal(idsSig: WritableSignal<string[]>): {
  primarySig: WritableSignal<string | null>;
  setPrimaryDirect: (val: string | null) => void;
} {
  const base = signal<string | null>(null);
  const rawSet = base.set.bind(base);
  base.set = (val: string | null) => {
    rawSet(val);
    idsSig.set(val ? [val] : []);
  };
  base.update = (fn: (value: string | null) => string | null) => {
    const next = fn(base());
    base.set(next);
  };
  return {
    primarySig: base,
    setPrimaryDirect: rawSet,
  };
}

function cloneExploredFog(fog: VttExploredFog | undefined): VttExploredFog {
  return {
    cells: [...(fog?.cells ?? [])],
    revealed_all: Boolean(fog?.revealed_all),
    ...(fog?.__scene_meta ? { __scene_meta: { ...fog.__scene_meta } } : {}),
  };
}

function cloneWalls(walls: VttWallSegment[]): VttWallSegment[] {
  return (walls ?? []).map((w) => ({ ...w }));
}

function cloneLights(lights: VttLightSource[]): VttLightSource[] {
  return (lights ?? []).map((l) => ({ ...l }));
}

export const VTT_COMBAT_TRACKER_LAYOUT_STORAGE_KEY =
  'mot.vtt.combat_tracker_window.v1';

interface StoredCombatTrackerWindowLayout {
  position: { x: number; y: number } | null;
  minimized: boolean;
}

function readStoredCombatTrackerLayout(): StoredCombatTrackerWindowLayout {
  try {
    if (typeof localStorage === 'undefined') {
      return { position: null, minimized: false };
    }
    const raw = localStorage.getItem(VTT_COMBAT_TRACKER_LAYOUT_STORAGE_KEY);
    if (!raw) return { position: null, minimized: false };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const x = parsed['x'];
    const y = parsed['y'];
    const hasCoords =
      typeof x === 'number' &&
      Number.isFinite(x) &&
      typeof y === 'number' &&
      Number.isFinite(y);
    return {
      position: hasCoords ? { x: Math.round(x), y: Math.round(y) } : null,
      minimized: Boolean(parsed['minimized']),
    };
  } catch {
    return { position: null, minimized: false };
  }
}

function writeStoredCombatTrackerLayout(
  position: { x: number; y: number } | null,
  minimized: boolean
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      VTT_COMBAT_TRACKER_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...(position ? { x: Math.round(position.x), y: Math.round(position.y) } : {}),
        minimized,
      })
    );
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class VttStore {
  private readonly vttService = inject(VttService);
  private readonly authStore = inject(AuthStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly characterStore = inject(CharacterStore);
  private readonly characterService = inject(CharacterService);
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly userAssetsStore = inject(UserAssetsStore);
  private readonly notifications = inject(NotificationStore);
  private readonly settingsStore = inject(VttSettingsStore);

  private realtimeChannel: RealtimeChannel | null = null;

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly needsMigration = signal(false);

  readonly campaign = signal<GameCardModel | null>(null);
  readonly participants = signal<VttParticipant[]>([]);
  readonly folders = signal<VttFolderModel[]>([]);
  readonly rosterActors = signal<VttRosterActorModel[]>([]);
  readonly draggingRosterPayload = signal<VttRosterDragPayload | null>(null);
  readonly draggingCompendiumPayload = signal<VttCompendiumDragPayload | null>(
    null
  );
  readonly scenes = signal<VttSceneModel[]>([]);
  readonly activeSceneId = signal<string | null>(null);
  readonly tokens = signal<VttTokenModel[]>([]);
  readonly logs = signal<VttLogEntry[]>([]);
  readonly allCharacters = signal<CharacterModel[]>([]);

  readonly visibleLogs = computed<VttLogEntry[]>(() =>
    this.logs().filter((entry) => this.isLogVisibleToCurrentUser(entry))
  );

  readonly whisperTargets = computed<VttWhisperTargetOption[]>(() => {
    const camp = this.campaign();
    const myId = this.authStore.user()?.id ?? null;
    const list: VttWhisperTargetOption[] = [];
    const seenUserIds = new Set<string>();

    if (camp?.gm_id) {
      const gmPart = this.participants().find((p) => p.user_id === camp.gm_id);
      list.push({
        key: 'gm',
        insertToken: 'gm',
        label: 'GM',
        sublabel: gmPart?.display_name || 'Game Master',
        userIds: [camp.gm_id],
      });
    }

    for (const part of this.participants()) {
      if (part.user_id === myId || seenUserIds.has(part.user_id)) continue;
      seenUserIds.add(part.user_id);
      const tokenStr = part.handle
        ? `@${part.handle}`
        : part.display_name.includes(' ')
          ? `"${part.display_name}"`
          : part.display_name;
      list.push({
        key: `user-${part.user_id}`,
        insertToken: tokenStr,
        label: part.display_name,
        sublabel: part.handle
          ? `@${part.handle} · ${part.role === 'gm' ? 'GM' : 'Player'}`
          : part.role === 'gm'
            ? 'GM'
            : 'Player',
        userIds: [part.user_id],
      });
    }

    for (const ch of this.allCharacters()) {
      if (!ch.owner_id || ch.owner_id === myId || seenUserIds.has(ch.owner_id)) {
        continue;
      }
      seenUserIds.add(ch.owner_id);
      const tokenStr = ch.name.includes(' ') ? `"${ch.name}"` : ch.name;
      list.push({
        key: `char-${ch.id}`,
        insertToken: tokenStr,
        label: ch.name,
        sublabel: 'Character',
        userIds: [ch.owner_id],
      });
    }

    return list;
  });

  readonly assignablePlayers = computed<VttParticipant[]>(() => {
    const camp = this.campaign();
    const gmId = camp?.gm_id ?? null;
    const seen = new Set<string>();
    const list: VttParticipant[] = [];

    for (const part of this.participants()) {
      if (!part.user_id || part.user_id === gmId || part.role === 'gm') {
        continue;
      }
      if (seen.has(part.user_id)) continue;
      seen.add(part.user_id);
      list.push(part);
    }

    return list;
  });

  readonly activeTool = signal<VttToolMode>('select');
  readonly activeWallKind = signal<VttWallKind>('wall');
  readonly previewPlayerVision = signal(false);
  readonly enforceApOnMove = signal(false);

  private readonly _selectedTokenIds = signal<string[]>([]);
  private readonly primaryTokenSync = createSyncedPrimaryTokenSignal(
    this._selectedTokenIds
  );

  readonly selectedTokenIds = this._selectedTokenIds.asReadonly();
  readonly selectedTokenId = this.primaryTokenSync.primarySig;
  readonly selectedRosterActorId = signal<string | null>(null);
  readonly selectedCharacterId = signal<string | null>(null);
  readonly openSheetWindows = signal<VttOpenSheetWindowEntry[]>([]);
  readonly openSheetTarget = signal<VttOpenSheetTarget | null>(null);
  readonly openTokenizerTarget = signal<VttOpenSheetTarget | null>(null);
  readonly openTokenizerFocusTick = signal<number>(0);
  private nextSheetFocusTick = 1;
  readonly gmSpeakerMode = signal<VttSpeakerMode>('user');
  readonly selectedLightId = signal<string | null>(null);
  readonly pendingTargetAction = signal<PendingTargetAction | null>(null);
  readonly activePings = signal<VttPingBroadcast[]>([]);
  readonly activeSceneNaturalSize = signal<{
    width: number;
    height: number;
  } | null>(null);

  readonly attackRollMode = signal<'normal' | 'advantage' | 'disadvantage'>(
    'normal'
  );
  readonly manualRollOverride = signal<number | null>(null);
  readonly latestDiceThrow = signal<VttDiceThrowPayload | null>(null);
  readonly undoStack = signal<VttUndoEntry[]>([]);
  readonly isUndoing = signal(false);

  private readonly seenDiceThrowIds = new Set<string>();
  private readonly inFlightTokenRotationPatches = new Map<
    string,
    { inFlight: boolean; queuedPatch: Partial<VttTokenModel> | null }
  >();

  readonly isGm = computed(() => {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id;
    if (!camp || !uid) return false;
    return camp.gm_id === uid || this.authStore.isAdmin();
  });

  readonly mapFolders = computed<VttFolderModel[]>(() =>
    this.folders().filter((f) => f.scope === 'maps')
  );

  readonly activeScene = computed<VttSceneModel | null>(() => {
    const list = this.scenes();
    if (list.length === 0) return null;
    const sel = this.activeSceneId();
    if (sel) {
      const found = list.find((s) => s.id === sel);
      if (found) return found;
    }
    return list.find((s) => s.is_active_scene) ?? list[0] ?? null;
  });

  readonly partyActiveScene = computed<VttSceneModel | null>(() => {
    const list = this.scenes();
    return list.find((s) => s.is_active_scene) ?? list[0] ?? null;
  });

  readonly sceneLayout = computed<SceneCanvasLayout>(() =>
    this.getSceneLayout(this.activeScene())
  );

  readonly gridGeometry = computed<HexGridGeometry>(
    () => this.sceneLayout().geometry
  );

  readonly sceneTokens = computed<VttTokenModel[]>(() => {
    const sc = this.activeScene();
    if (!sc) return [];
    return this.tokens().filter((t) => t.encounter_id === sc.id);
  });

  readonly selectedTokens = computed<VttTokenModel[]>(() => {
    const ids = this.selectedTokenIds();
    if (ids.length === 0) return [];
    const byId = new Map(this.sceneTokens().map((t) => [t.id, t]));
    const resolved: VttTokenModel[] = [];
    for (const id of ids) {
      const tok = byId.get(id);
      if (tok) {
        resolved.push(tok);
      }
    }
    return resolved;
  });

  readonly controllableSelectedTokens = computed<VttTokenModel[]>(() =>
    this.selectedTokens().filter((t) => this.isGm() || this.canControlToken(t))
  );

  readonly selectedToken = computed<VttTokenModel | null>(() => {
    const id = this.selectedTokenId();
    if (!id) return null;
    return this.sceneTokens().find((t) => t.id === id) ?? null;
  });

  setSelectedTokens(
    tokenIds: readonly string[],
    primaryId?: string | null
  ): void {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const rawId of tokenIds) {
      const trimmed = rawId?.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      unique.push(trimmed);
    }

    this._selectedTokenIds.set(unique);
    if (unique.length === 0) {
      this.primaryTokenSync.setPrimaryDirect(null);
      return;
    }

    const resolvedPrimary =
      primaryId && seen.has(primaryId)
        ? primaryId
        : unique[unique.length - 1];
    this.primaryTokenSync.setPrimaryDirect(resolvedPrimary);
  }

  selectSingleToken(tokenId: string | null): void {
    this.selectedTokenId.set(tokenId);
  }

  toggleTokenInSelection(tokenId: string): void {
    const trimmed = tokenId?.trim();
    if (!trimmed) return;
    const curr = this._selectedTokenIds();
    if (curr.includes(trimmed)) {
      this.setSelectedTokens(curr.filter((id) => id !== trimmed));
    } else {
      this.setSelectedTokens([...curr, trimmed], trimmed);
    }
  }

  clearTokenSelection(): void {
    this.selectedTokenId.set(null);
  }

  isTokenSelected(tokenId: string): boolean {
    return this._selectedTokenIds().includes(tokenId);
  }

  private pruneRemovedTokenFromSelection(tokenId: string): void {
    const curr = this._selectedTokenIds();
    if (curr.includes(tokenId)) {
      this.setSelectedTokens(curr.filter((id) => id !== tokenId));
      return;
    }
    if (this.selectedTokenId() === tokenId) {
      this.selectedTokenId.set(null);
    }
  }

  resolveRosterActorCharacterSheet(
    actor: VttRosterActorModel | null | undefined
  ): CharacterModel | null {
    if (!actor || actor.actor_kind === 'npc') return null;
    const rawEmbedded = actor.npc_stats?.__character_sheet;
    if (
      rawEmbedded &&
      typeof rawEmbedded === 'object' &&
      !Array.isArray(rawEmbedded)
    ) {
      const normalized = normalizeCharacterRecord(
        rawEmbedded as CharacterModel
      );
      const sheetId =
        typeof normalized.id === 'string' && normalized.id.trim().length > 0
          ? normalized.id.trim()
          : `vtt-actor-char:${actor.id}`;
      return cloneDetachedVttCharacterSheet(normalized, sheetId);
    }
    if (actor.character_id) {
      const found =
        this.allCharacters().find((c) => c.id === actor.character_id) ??
        this.characterStore
          .characters()
          .find((c) => c.id === actor.character_id) ??
        this.characterStore.getCharacterById(actor.character_id) ??
        null;
      if (found) {
        return cloneDetachedVttCharacterSheet(
          found,
          `vtt-actor-char:${actor.id}`
        );
      }
    }
    return null;
  }

  resolveCharacterForToken(
    tok: VttTokenModel | null | undefined
  ): CharacterModel | null {
    if (!tok) return null;
    const linkedActor = this.resolveRosterActorForToken(tok);
    if (linkedActor) {
      const actorSheet = this.resolveRosterActorCharacterSheet(linkedActor);
      if (actorSheet) return actorSheet;
    }
    const rawTokEmbedded = tok.npc_stats?.__character_sheet;
    if (
      rawTokEmbedded &&
      typeof rawTokEmbedded === 'object' &&
      !Array.isArray(rawTokEmbedded)
    ) {
      const normalized = normalizeCharacterRecord(
        rawTokEmbedded as CharacterModel
      );
      const sheetId =
        typeof normalized.id === 'string' && normalized.id.trim().length > 0
          ? normalized.id.trim()
          : `vtt-token-char:${tok.id}`;
      return cloneDetachedVttCharacterSheet(normalized, sheetId);
    }
    if (tok.character_id) {
      return this.characterByIdMap().get(tok.character_id) ?? null;
    }
    return null;
  }

  private findRosterActorsForCharacterId(
    characterId: string | null | undefined
  ): VttRosterActorModel[] {
    if (!characterId) return [];
    const roster = this.rosterActors();
    const direct = roster.filter(
      (a) =>
        a.actor_kind !== 'npc' &&
        (a.character_id === characterId ||
          this.resolveRosterActorCharacterSheet(a)?.id === characterId)
    );
    if (direct.length > 0) return direct;
    return roster.filter(
      (a) =>
        a.actor_kind !== 'npc' &&
        resolveRosterActorSourceCharacterId(a) === characterId
    );
  }

  readonly characterByIdMap = computed(() => {
    const map = new Map<string, CharacterModel>();
    for (const c of this.characterStore.characters()) {
      map.set(c.id, cloneDetachedVttCharacterSheet(c, c.id));
    }
    for (const c of this.allCharacters()) {
      map.set(c.id, cloneDetachedVttCharacterSheet(c, c.id));
    }
    for (const actor of this.rosterActors()) {
      const sheet = this.resolveRosterActorCharacterSheet(actor);
      if (sheet) {
        map.set(sheet.id, sheet);
      }
    }
    return map;
  });

  readonly selectedTokenCharacter = computed<CharacterModel | null>(() => {
    return this.resolveCharacterForToken(this.selectedToken());
  });

  private getArmorsForStats() {
    return typeof this.compendiumStore.allArmors === 'function'
      ? this.compendiumStore.allArmors()
      : undefined;
  }

  readonly selectedTokenDerived = computed<DerivedCharacterStats | null>(() => {
    const char = this.selectedTokenCharacter();
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      this.getArmorsForStats()
    );
  });

  resolveTargetRosterActor(
    target: VttOpenSheetTarget | null
  ): VttRosterActorModel | null {
    if (!target) return null;
    const roster = this.rosterActors();
    if (target.rosterActorId) {
      const direct = roster.find((a) => a.id === target.rosterActorId);
      if (direct) return direct;
    }
    if (target.characterId) {
      const matched = this.findRosterActorsForCharacterId(target.characterId);
      if (matched.length > 0) return matched[0];
    }
    if (target.tokenId) {
      const tok = this.tokens().find((t) => t.id === target.tokenId);
      if (tok) {
        const byTok = this.resolveRosterActorForToken(tok);
        if (byTok) return byTok;
      }
    }
    return null;
  }

  resolveTargetToken(target: VttOpenSheetTarget | null): VttTokenModel | null {
    if (!target) return null;
    if (target.tokenId) {
      const direct = this.tokens().find((t) => t.id === target.tokenId);
      if (direct) return direct;
    }
    const actor = this.resolveTargetRosterActor(target);
    const actorSheetId = this.resolveRosterActorCharacterSheet(actor)?.id ?? null;
    const charId =
      target.characterId ?? actorSheetId ?? actor?.character_id ?? null;
    const sel = this.selectedToken();
    if (
      sel &&
      ((actor && sel.npc_stats?.__roster_actor_id === actor.id) ||
        (charId &&
          (sel.character_id === charId ||
            this.resolveCharacterForToken(sel)?.id === charId)))
    ) {
      return sel;
    }
    const onScene = this.sceneTokens();
    if (actor) {
      const byActor = onScene.find(
        (t) => t.npc_stats?.__roster_actor_id === actor.id
      );
      if (byActor) return byActor;
    }
    if (charId) {
      const byChar = onScene.find(
        (t) =>
          t.character_id === charId ||
          this.resolveCharacterForToken(t)?.id === charId
      );
      if (byChar) return byChar;
    }
    return null;
  }

  resolveTargetCharacter(
    target: VttOpenSheetTarget | null
  ): CharacterModel | null {
    if (!target) return null;
    const actor = this.resolveTargetRosterActor(target);
    const actorSheet = this.resolveRosterActorCharacterSheet(actor);
    if (actorSheet) return actorSheet;
    const tok = this.resolveTargetToken(target);
    const tokSheet = this.resolveCharacterForToken(tok);
    if (tokSheet) return tokSheet;
    const charId =
      target.characterId ?? actor?.character_id ?? tok?.character_id ?? null;
    if (!charId) return null;
    const fromMap = this.characterByIdMap().get(charId);
    if (fromMap) return fromMap;
    const fromStore = this.characterStore.getCharacterById(charId);
    return fromStore ? cloneDetachedVttCharacterSheet(fromStore, charId) : null;
  }

  readonly openSheetRosterActor = computed<VttRosterActorModel | null>(() =>
    this.resolveTargetRosterActor(this.openSheetTarget())
  );

  readonly openSheetToken = computed<VttTokenModel | null>(() =>
    this.resolveTargetToken(this.openSheetTarget())
  );

  readonly openSheetCharacter = computed<CharacterModel | null>(() =>
    this.resolveTargetCharacter(this.openSheetTarget())
  );

  computeDerivedForCharacter(
    char: CharacterModel | null
  ): DerivedCharacterStats | null {
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      this.getArmorsForStats()
    );
  }

  readonly openSheetDerived = computed<DerivedCharacterStats | null>(() =>
    this.computeDerivedForCharacter(this.openSheetCharacter())
  );

  resolveSheetWindowKey(target: VttOpenSheetTarget): string {
    const actor = this.resolveTargetRosterActor(target);
    if (
      actor &&
      (actor.actor_kind === 'character' || actor.is_unique || !target.tokenId)
    ) {
      return `actor:${actor.id}`;
    }
    const charId = target.characterId ?? actor?.character_id ?? null;
    if (charId) {
      return `char:${charId}`;
    }
    if (target.tokenId) {
      return `token:${target.tokenId}`;
    }
    return `${target.rosterActorId ?? ''}|${target.characterId ?? ''}|${target.tokenId ?? ''}`;
  }

  private syncPrimaryOpenSheetTarget(
    entries: readonly VttOpenSheetWindowEntry[]
  ): void {
    if (entries.length === 0) {
      this.openSheetTarget.set(null);
      return;
    }
    let top = entries[0];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].focusTick >= top.focusTick) {
        top = entries[i];
      }
    }
    this.openSheetTarget.set(top.target);
  }

  private upsertOpenSheetWindow(target: VttOpenSheetTarget): void {
    const key = this.resolveSheetWindowKey(target);
    const tick = ++this.nextSheetFocusTick;
    let focusedId: number | null = null;
    this.openSheetWindows.update((curr) => {
      const idx = curr.findIndex((e) => e.key === key);
      if (idx >= 0) {
        focusedId = curr[idx].windowId;
        return curr.map((e, i) =>
          i === idx
            ? {
                key,
                target: {
                  rosterActorId:
                    target.rosterActorId ?? e.target.rosterActorId,
                  characterId: target.characterId ?? e.target.characterId,
                  tokenId: target.tokenId ?? e.target.tokenId,
                },
                focusTick: tick,
                windowId: e.windowId,
              }
            : e
        );
      }
      const newWinId = allocateFloatingWindowId();
      focusedId = newWinId;
      return [...curr, { key, target, focusTick: tick, windowId: newWinId }];
    });
    if (focusedId !== null) {
      focusFloatingWindow(focusedId);
    }
    this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
  }

  focusOpenSheetWindow(key: string): void {
    if (!key) return;
    const tick = ++this.nextSheetFocusTick;
    let focusedId: number | null = null;
    this.openSheetWindows.update((curr) =>
      curr.map((entry) => {
        if (entry.key !== key) return entry;
        focusedId = entry.windowId;
        return { ...entry, focusTick: tick };
      })
    );
    if (focusedId !== null) {
      focusFloatingWindow(focusedId);
      this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
    }
  }

  closeSheetWindow(key: string): void {
    if (!key) return;
    let releasedId: number | null = null;
    this.openSheetWindows.update((curr) =>
      curr.filter((entry) => {
        if (entry.key === key) {
          releasedId = entry.windowId;
          return false;
        }
        return true;
      })
    );
    if (releasedId !== null) {
      releaseFloatingWindow(releasedId);
    }
    this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
  }

  closeTopmostActorSheet(): boolean {
    const entries = this.openSheetWindows();
    if (entries.length === 0) {
      if (this.openSheetTarget()) {
        this.openSheetTarget.set(null);
        return true;
      }
      return false;
    }
    let top = entries[0];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].focusTick >= top.focusTick) {
        top = entries[i];
      }
    }
    this.closeSheetWindow(top.key);
    return true;
  }

  readonly openTokenizerRosterActor = computed<VttRosterActorModel | null>(() =>
    this.resolveTargetRosterActor(this.openTokenizerTarget())
  );

  readonly openTokenizerToken = computed<VttTokenModel | null>(() =>
    this.resolveTargetToken(this.openTokenizerTarget())
  );

  readonly openTokenizerCharacter = computed<CharacterModel | null>(() =>
    this.resolveTargetCharacter(this.openTokenizerTarget())
  );

  readonly openTokenizerDerived = computed<DerivedCharacterStats | null>(() => {
    const char = this.openTokenizerCharacter();
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      this.getArmorsForStats()
    );
  });

  resolveRosterActorForToken(
    tok: VttTokenModel | null | undefined
  ): VttRosterActorModel | null {
    if (!tok) return null;
    const roster = this.rosterActors();
    if (tok.npc_stats?.__roster_actor_id) {
      const byId = roster.find((a) => a.id === tok.npc_stats.__roster_actor_id);
      if (byId) return byId;
    }
    if (tok.character_id) {
      const byChar = roster.find((a) => a.character_id === tok.character_id);
      if (byChar) return byChar;
    }
    return null;
  }

  resolveTokenVisuals(tok: VttTokenModel): {
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  } {
    const linkedActor = this.resolveRosterActorForToken(tok);
    const linkedChar = this.resolveCharacterForToken(tok);
    return {
      portraitUrl: resolveEntityPortraitUrl(tok, linkedActor, linkedChar),
      tokenImageUrl: resolveEntityTokenImageUrl(tok, linkedActor, linkedChar),
      tokenAppearance: resolveEntityTokenAppearance(
        tok,
        linkedActor,
        linkedChar
      ),
    };
  }

  resolveRosterActorVisuals(actor: VttRosterActorModel): {
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  } {
    const linkedChar = this.resolveRosterActorCharacterSheet(actor);
    return {
      portraitUrl: resolveEntityPortraitUrl(actor, linkedChar),
      tokenImageUrl: resolveEntityTokenImageUrl(actor, linkedChar),
      tokenAppearance: resolveEntityTokenAppearance(actor, linkedChar),
    };
  }

  readonly activeCharacterSpeaker = computed<
    Omit<VttResolvedChatSpeaker, 'mode'> | null
  >(() => {
    const gm = this.isGm();
    const pending = this.pendingTargetAction();
    if (pending?.attackerTokenId) {
      const attTok =
        this.sceneTokens().find((t) => t.id === pending.attackerTokenId) ??
        this.tokens().find((t) => t.id === pending.attackerTokenId) ??
        null;
      if (attTok && (gm || this.canControlToken(attTok))) {
        const vis = this.resolveTokenVisuals(attTok);
        return {
          name: attTok.name,
          tokenId: attTok.id,
          characterId: attTok.character_id,
          color: attTok.color || null,
          icon: attTok.icon || 'user',
          faction: attTok.faction,
          portraitUrl: vis.portraitUrl,
          tokenImageUrl: vis.tokenImageUrl,
          tokenAppearance: vis.tokenAppearance,
        };
      }
    }

    const selTokId = this.selectedTokenId();
    if (selTokId) {
      const tok =
        this.sceneTokens().find((t) => t.id === selTokId) ??
        this.tokens().find((t) => t.id === selTokId) ??
        null;
      if (tok && (gm || this.canControlToken(tok))) {
        const vis = this.resolveTokenVisuals(tok);
        return {
          name: tok.name,
          tokenId: tok.id,
          characterId: tok.character_id,
          color: tok.color || null,
          icon: tok.icon || 'user',
          faction: tok.faction,
          portraitUrl: vis.portraitUrl,
          tokenImageUrl: vis.tokenImageUrl,
          tokenAppearance: vis.tokenAppearance,
        };
      }
    }

    const rosterId = this.selectedRosterActorId();
    if (rosterId) {
      const actor = this.rosterActors().find((a) => a.id === rosterId) ?? null;
      if (actor && (gm || this.canDeployRosterActor(actor))) {
        const vis = this.resolveRosterActorVisuals(actor);
        const linkedSheet = this.resolveRosterActorCharacterSheet(actor);
        return {
          name: resolveActorTokenDisplayName(actor, linkedSheet?.name),
          tokenId: null,
          characterId: actor.character_id,
          color: actor.color || null,
          icon: actor.icon || 'user',
          faction: actor.faction,
          portraitUrl: vis.portraitUrl,
          tokenImageUrl: vis.tokenImageUrl,
          tokenAppearance: vis.tokenAppearance,
        };
      }
    }

    const charId = this.selectedCharacterId();
    if (charId) {
      const ch = this.characterByIdMap().get(charId) ?? null;
      if (ch && this.canEditCharacterInVtt(charId)) {
        const linkedActor =
          this.findRosterActorsForCharacterId(charId)[0] ?? null;
        const sceneTok =
          this.sceneTokens().find(
            (t) =>
              t.character_id === charId ||
              this.resolveCharacterForToken(t)?.id === charId
          ) ?? null;
        return {
          name:
            sceneTok?.name ||
            resolveActorTokenDisplayName(linkedActor, ch.name),
          tokenId: sceneTok?.id ?? null,
          characterId: ch.id,
          color: '#38B29A',
          icon: 'user',
          faction: 'ally',
          portraitUrl: resolveEntityPortraitUrl(sceneTok, linkedActor, ch),
          tokenImageUrl: resolveEntityTokenImageUrl(sceneTok, linkedActor, ch),
          tokenAppearance: resolveEntityTokenAppearance(
            sceneTok,
            linkedActor,
            ch
          ),
        };
      }
    }

    return null;
  });

  readonly effectivePublicSpeaker = computed<VttResolvedChatSpeaker>(() => {
    const gm = this.isGm();
    const fallbackUser =
      this.authStore.displayName() || (gm ? 'GM' : 'Adventurer');
    const charSpeaker = this.activeCharacterSpeaker();

    if (gm) {
      if (this.gmSpeakerMode() === 'character' && charSpeaker) {
        return {
          ...charSpeaker,
          mode: 'character',
        };
      }
      return {
        name: fallbackUser,
        mode: 'user',
        tokenId: null,
        characterId: null,
        color: null,
      };
    }

    if (charSpeaker) {
      return {
        ...charSpeaker,
        mode: 'character',
      };
    }
    return {
      name: fallbackUser,
      mode: 'user',
      tokenId: null,
      characterId: null,
      color: null,
    };
  });

  setGmSpeakerMode(mode: VttSpeakerMode): void {
    this.gmSpeakerMode.set(mode);
  }

  selectRosterActorForSpeech(actorId: string | null): void {
    this.selectedRosterActorId.set(actorId);
    if (actorId) {
      this.selectedCharacterId.set(null);
      this.selectedTokenId.set(null);
    }
  }

  selectCharacterForSpeech(characterId: string | null): void {
    this.selectedCharacterId.set(characterId);
    if (characterId) {
      this.selectedRosterActorId.set(null);
      this.selectedTokenId.set(null);
    }
  }

  readonly observerTokens = computed<VttTokenModel[]>(() => {
    const sc = this.activeScene();
    if (!sc || !sc.token_vision) return [];

    const all = this.sceneTokens().filter((t) => !t.is_hidden);
    const gm = this.isGm();

    if (gm) {
      if (!this.previewPlayerVision()) {
        return all.filter((t) => t.faction === 'ally');
      }
      const selList = this.selectedTokens().filter((t) => !t.is_hidden);
      if (selList.length > 0) {
        return selList;
      }
      return all.filter((t) => t.faction === 'ally');
    }

    const controlled = all.filter((t) => this.canControlToken(t));
    const controlledIdSet = new Set(controlled.map((t) => t.id));
    const selList = this.selectedTokens().filter((t) =>
      controlledIdSet.has(t.id)
    );
    if (selList.length > 0) {
      return selList;
    }
    return controlled;
  });

  readonly combatTrackerDrawerOpen = signal<boolean>(false);
  readonly combatTrackerPosition = signal<{ x: number; y: number } | null>(
    readStoredCombatTrackerLayout().position
  );
  readonly combatTrackerMinimized = signal<boolean>(
    readStoredCombatTrackerLayout().minimized
  );

  readonly isCombatInitiationOpen = computed<boolean>(() => {
    const sc = this.activeScene();
    if (!sc || sc.combat_active) return false;
    return (sc.initiative_order ?? []).includes(VTT_INITIATION_PHASE_SENTINEL);
  });

  readonly isCombatTrackerUnlocked = computed<boolean>(() => {
    const sc = this.activeScene();
    if (!sc) return false;
    return sc.combat_active || this.isCombatInitiationOpen();
  });

  readonly allEnrolledCombatTokens = computed<VttTokenModel[]>(() => {
    const sc = this.activeScene();
    if (!sc) return [];
    if (!sc.combat_active && !this.isCombatInitiationOpen()) {
      return [];
    }
    const cleanOrder = (sc.initiative_order ?? []).filter(
      (id) => id !== VTT_INITIATION_PHASE_SENTINEL
    );
    const orderSet = new Set(cleanOrder);
    const enrolled = this.sceneTokens().filter((t) => {
      if (t.npc_stats?.__in_combat === false) return false;
      return (
        orderSet.has(t.id) ||
        t.npc_stats?.__in_combat === true ||
        typeof t.npc_stats?.__initiative === 'number'
      );
    });
    return this.sortCombatantTokens(enrolled, cleanOrder);
  });

  readonly enrolledCombatTokens = computed<VttTokenModel[]>(() =>
    this.allEnrolledCombatTokens().filter((t) => this.isGm() || !t.is_hidden)
  );

  readonly unrolledSceneTokens = computed<VttTokenModel[]>(() => {
    const enrolledIds = new Set(
      this.allEnrolledCombatTokens().map((t) => t.id)
    );
    return this.sceneTokens().filter(
      (t) => !enrolledIds.has(t.id) && (this.isGm() || !t.is_hidden)
    );
  });

  readonly unrolledControllableTokens = computed<VttTokenModel[]>(() => {
    const enrolledIds = new Set(
      this.allEnrolledCombatTokens().map((t) => t.id)
    );
    return this.sceneTokens().filter(
      (t) =>
        !t.is_hidden &&
        this.canControlToken(t) &&
        (!enrolledIds.has(t.id) || typeof t.npc_stats?.__initiative !== 'number')
    );
  });

  readonly initiativeTokens = computed<VttTokenModel[]>(() => {
    const enrolled = this.enrolledCombatTokens();
    if (enrolled.length > 0) return enrolled;
    const sc = this.activeScene();
    if (sc?.combat_active) return [];
    return this.sceneTokens().filter((t) => this.isGm() || !t.is_hidden);
  });

  readonly pendingClash = computed<VttPendingClash | null>(
    () => this.activeScene()?.pending_clash ?? null
  );

  readonly pendingClashDefender = computed<VttTokenModel | null>(() => {
    const clash = this.pendingClash();
    if (!clash) return null;
    return (
      this.sceneTokens().find((t) => t.id === clash.defenderTokenId) ?? null
    );
  });

  readonly pendingClashCapabilities =
    computed<DefenderClashCapabilities | null>(() => {
      const def = this.pendingClashDefender();
      if (!def) return null;
      return this.getDefenderCapabilities(def);
    });

  readonly pendingClashLegalReactions = computed(() => {
    const clash = this.pendingClash();
    const caps = this.pendingClashCapabilities();
    if (!clash || !caps) return null;
    return getLegalDefenderReactions(clash, caps);
  });

  readonly activeSceneUndoStack = computed<VttUndoEntry[]>(() => {
    const sc = this.activeScene();
    if (!sc) return [];
    return this.undoStack().filter((entry) => entry.sceneId === sc.id);
  });

  readonly canUndo = computed<boolean>(
    () => this.activeSceneUndoStack().length > 0 && !this.isUndoing()
  );

  readonly nextUndoLabel = computed<string | null>(() => {
    const list = this.activeSceneUndoStack();
    return list.length > 0 ? list[list.length - 1].label : null;
  });

  pushUndoEntry(
    sceneId: string,
    label: string,
    payload: VttUndoPayload
  ): void {
    if (this.isUndoing() || !sceneId) return;
    const now = Date.now();
    const incomingCoalesceKey =
      payload.kind === 'tokens_batch' ? payload.coalesceKey : undefined;

    if (incomingCoalesceKey) {
      const curr = this.undoStack();
      for (let i = curr.length - 1; i >= 0; i--) {
        if (curr[i].sceneId !== sceneId) continue;
        const topSceneEntry = curr[i];
        if (
          topSceneEntry.kind === 'tokens_batch' &&
          topSceneEntry.coalesceKey === incomingCoalesceKey &&
          now - topSceneEntry.createdAt <= ROTATION_UNDO_COALESCE_MS
        ) {
          const updatedTop: VttUndoEntry = {
            ...topSceneEntry,
            label,
            createdAt: now,
          };
          this.undoStack.set([
            ...curr.slice(0, i),
            updatedTop,
            ...curr.slice(i + 1),
          ]);
          return;
        }
        break;
      }
    }

    const entry: VttUndoEntry = {
      ...payload,
      id: `undo-${now}-${Math.random().toString(36).slice(2, 6)}`,
      sceneId,
      label,
      createdAt: now,
    };
    this.undoStack.update((curr) => {
      const appended = [...curr, entry];
      return appended.length > MAX_VTT_UNDO_STACK
        ? appended.slice(appended.length - MAX_VTT_UNDO_STACK)
        : appended;
    });
  }

  async undoLastAction(): Promise<boolean> {
    const sc = this.activeScene();
    if (!sc || this.isUndoing()) return false;

    const stack = this.undoStack();
    let targetIdx = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].sceneId === sc.id) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) return false;

    const entry = stack[targetIdx];
    this.undoStack.set([
      ...stack.slice(0, targetIdx),
      ...stack.slice(targetIdx + 1),
    ]);

    this.isUndoing.set(true);
    try {
      if (entry.kind === 'token_patch') {
        const tok = this.tokens().find((t) => t.id === entry.tokenId);
        if (tok) {
          await this.patchToken(entry.tokenId, entry.previousTokenPatch);
          this.selectedTokenId.set(entry.tokenId);
        }
        if (entry.previousExploredFog) {
          await this.patchScene(sc.id, {
            explored_fog: cloneExploredFog(entry.previousExploredFog),
          });
        } else {
          this.syncExploredFogFromObservers();
        }
      } else if (entry.kind === 'token_spawned') {
        await this.removeTokenInternal(entry.tokenId);
        if (entry.previousExploredFog) {
          await this.patchScene(sc.id, {
            explored_fog: cloneExploredFog(entry.previousExploredFog),
          });
        }
      } else if (entry.kind === 'token_removed') {
        const snap = entry.tokenSnapshot;
        const { id: snapId, ...restSnap } = snap;
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            snapId
          );
        const res = await this.vttService.insertToken({
          ...restSnap,
          ...(isUuid ? { id: snapId } : {}),
        });
        if (!res.error && res.token) {
          this.tokens.update((curr) =>
            curr.some((t) => t.id === res.token!.id)
              ? curr
              : [...curr, res.token!]
          );
          this.selectedTokenId.set(res.token.id);
          this.syncExploredFogFromObservers();
        }
      } else if (entry.kind === 'tokens_batch') {
        const restoredIds: string[] = [];
        if (entry.patches?.length) {
          for (const item of entry.patches) {
            const tok = this.tokens().find((t) => t.id === item.tokenId);
            if (tok) {
              await this.patchToken(item.tokenId, item.previousTokenPatch);
              restoredIds.push(item.tokenId);
            }
          }
        }
        if (entry.removedSnapshots?.length) {
          for (const snap of entry.removedSnapshots) {
            const { id: snapId, ...restSnap } = snap;
            const isUuid =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                snapId
              );
            const res = await this.vttService.insertToken({
              ...restSnap,
              ...(isUuid ? { id: snapId } : {}),
            });
            if (!res.error && res.token) {
              this.tokens.update((curr) =>
                curr.some((t) => t.id === res.token!.id)
                  ? curr
                  : [...curr, res.token!]
              );
              restoredIds.push(res.token.id);
            }
          }
        }
        if (entry.previousExploredFog) {
          await this.patchScene(sc.id, {
            explored_fog: cloneExploredFog(entry.previousExploredFog),
          });
        } else {
          this.syncExploredFogFromObservers();
        }
        const finalSelection =
          entry.selectedTokenIdsAfterUndo &&
          entry.selectedTokenIdsAfterUndo.length > 0 &&
          !entry.removedSnapshots?.length
            ? entry.selectedTokenIdsAfterUndo
            : restoredIds;
        if (finalSelection.length > 0) {
          this.setSelectedTokens(finalSelection);
        }
      } else if (entry.kind === 'scene_patch') {
        await this.patchScene(sc.id, entry.previousScenePatch);
        if (entry.selectedLightIdAfterUndo !== undefined) {
          this.selectedLightId.set(entry.selectedLightIdAfterUndo);
        }
        if (entry.previousScenePatch.explored_fog === undefined) {
          this.syncExploredFogFromObservers();
        }
      }

      this.notifications.info('Undid Event', entry.label);
      return true;
    } finally {
      this.isUndoing.set(false);
    }
  }

  getSceneLayout(
    scene: VttSceneModel | null,
    natOverride?: { width: number; height: number } | null
  ): SceneCanvasLayout {
    const nat =
      natOverride !== undefined
        ? natOverride
        : scene && this.activeScene()?.id === scene.id
          ? this.activeSceneNaturalSize()
          : null;
    return computeSceneCanvasLayout({
      sceneWidthPx: scene?.scene_width ?? null,
      sceneHeightPx: scene?.scene_height ?? null,
      naturalImageWidth: scene?.map_image_url ? nat?.width ?? null : null,
      naturalImageHeight: scene?.map_image_url ? nat?.height ?? null : null,
      gridSizePx: scene?.grid_size_px ?? DEFAULT_VTT_GRID_SIZE_PX,
      padding: scene?.padding ?? DEFAULT_VTT_SCENE_PADDING,
      offsetX: scene?.grid_offset_x ?? 0,
      offsetY: scene?.grid_offset_y ?? 0,
    });
  }

  getFoldersForScope(scope: VttDirectoryScope): VttFolderModel[] {
    return this.folders().filter((f) => f.scope === scope);
  }

  getActorAssignedUserId(
    actor: VttRosterActorModel | null | undefined
  ): string | null {
    if (!actor) return null;
    const stats = actor.npc_stats ?? {};
    if ('__assigned_user_id' in stats) {
      return stats.__assigned_user_id || null;
    }
    return null;
  }

  getActorAssignedParticipant(
    actor: VttRosterActorModel | null | undefined
  ): VttParticipant | null {
    const assignedId = this.getActorAssignedUserId(actor);
    if (!assignedId) return null;
    const found = this.participants().find((p) => p.user_id === assignedId);
    if (found) return found;
    return {
      user_id: assignedId,
      display_name: 'Assigned Player',
      handle: null,
      role: 'player',
    };
  }

  getTokenAssignedUserId(
    token: VttTokenModel | null | undefined
  ): string | null {
    if (!token) return null;
    const roster = this.rosterActors();
    if (token.npc_stats?.__roster_actor_id) {
      const linked = roster.find(
        (a) => a.id === token.npc_stats.__roster_actor_id
      );
      if (linked) {
        return this.getActorAssignedUserId(linked);
      }
    }
    if (token.character_id) {
      const linkedByChar = roster.find(
        (a) => a.character_id === token.character_id
      );
      if (linkedByChar) {
        return this.getActorAssignedUserId(linkedByChar);
      }
    }
    const stats = token.npc_stats ?? {};
    if ('__assigned_user_id' in stats) {
      return stats.__assigned_user_id || null;
    }
    if (token.character_id) {
      return null;
    }
    if (token.owner_id && token.owner_id !== this.campaign()?.gm_id) {
      return token.owner_id;
    }
    return null;
  }

  canEditCharacterInVtt(characterId: string | null | undefined): boolean {
    if (!characterId) return false;
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    if (!uid) return false;
    const matchedActors = this.findRosterActorsForCharacterId(characterId);
    if (matchedActors.some((a) => this.getActorAssignedUserId(a) === uid)) {
      return true;
    }
    return this.tokens().some(
      (t) =>
        (t.character_id === characterId ||
          this.resolveCharacterForToken(t)?.id === characterId) &&
        this.getTokenAssignedUserId(t) === uid
    );
  }

  canControlToken(token: VttTokenModel | null | undefined): boolean {
    if (!token) return false;
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    if (!uid) return false;
    return this.getTokenAssignedUserId(token) === uid;
  }

  getDefenderCapabilities(token: VttTokenModel): DefenderClashCapabilities {
    const ch = this.resolveCharacterForToken(token);
    if (ch) {
      const stats = computeDerivedStats(
        ch,
        this.compendiumStore.allWeapons(),
        this.compendiumStore.allPerkNodes(),
        this.getArmorsForStats()
      );
      return {
        currentSp: token.current_sp,
        currentHp: token.current_hp,
        currentAp: token.current_ap,
        armorDr: stats.armorDr,
        shieldBlock: stats.shieldBlockTotal,
        shieldRaised: token.shield_raised,
        parryMod: stats.parryMod,
        dodgeMod: stats.dodgeMod,
        canDodge: stats.canDodge,
        enablesMartialParry: stats.enablesMartialParry,
        flawlessCounterSp: stats.flawlessParryCounterSp,
      };
    }

    const npc = token.npc_stats ?? {};
    const parryMod = Number(npc.parry_mod ?? 2);
    return {
      currentSp: token.current_sp,
      currentHp: token.current_hp,
      currentAp: token.current_ap,
      armorDr: token.armor_dr,
      shieldBlock: token.shield_block,
      shieldRaised: token.shield_raised,
      parryMod,
      dodgeMod: Number(npc.dodge_mod ?? 2),
      canDodge: npc.can_dodge !== false,
      enablesMartialParry: Boolean(npc.enables_martial_parry),
      flawlessCounterSp: 2 + parryMod,
    };
  }

  async enterCampaignRoom(campaignId: string): Promise<void> {
    this.leaveRoom();
    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.authStore.waitForInit();
      await Promise.all([
        this.compendiumStore.ensureLoaded(),
        this.characterStore.ensureLoaded(),
        this.collectionsStore.loadCollections(),
      ]);

      let campData: GameCardModel | null = null;
      let loadedScenes: VttSceneModel[] = [];
      let initialTokens: VttTokenModel[] = [];
      let initialLogs: VttLogEntry[] = [];
      let hydratedFromBundle = false;

      if (typeof this.vttService.fetchRoomBundle === 'function') {
        const roomRes = await this.vttService.fetchRoomBundle(campaignId);
        if (!roomRes.fallback) {
          if (!roomRes.bundle) {
            this.error.set(roomRes.error ?? 'Campaign not found.');
            this.isLoading.set(false);
            return;
          }

          hydratedFromBundle = true;
          campData = roomRes.bundle.campaign;
          this.campaign.set(campData);
          this.participants.set(roomRes.bundle.participants ?? []);
          this.allCharacters.set(roomRes.bundle.characters);
          this.folders.set(roomRes.bundle.folders);
          this.rosterActors.set(roomRes.bundle.rosterActors);
          this.needsMigration.set(false);

          loadedScenes = roomRes.bundle.scenes;
          initialTokens = roomRes.bundle.tokens;
          initialLogs = roomRes.bundle.logs;
        }
      }

      if (!hydratedFromBundle) {
        const [campRes, visibleChars, loadedFolders, loadedRoster] =
          await Promise.all([
            this.vttService.fetchCampaignById(campaignId),
            this.vttService.fetchAllVisibleCharacters(),
            this.vttService.fetchCampaignFolders(campaignId),
            this.vttService.fetchCampaignRosterActors(campaignId),
          ]);

        if (!campRes.data) {
          this.error.set(campRes.error ?? 'Campaign not found.');
          this.isLoading.set(false);
          return;
        }

        campData = campRes.data;
        this.campaign.set(campData);
        this.allCharacters.set(visibleChars);
        this.folders.set(loadedFolders);
        this.rosterActors.set(loadedRoster);
        if (
          typeof this.vttService.fetchCampaignParticipants === 'function'
        ) {
          this.participants.set(
            await this.vttService.fetchCampaignParticipants(
              campaignId,
              campData.gm_id
            )
          );
        }

        const scenesRes = await this.vttService.fetchCampaignScenes(
          campaignId,
          campData.gm_id
        );
        this.needsMigration.set(scenesRes.needsMigration);
        loadedScenes = scenesRes.scenes;
      }

      for (const ch of this.allCharacters()) {
        this.characterStore.upsertRealtimeCharacter(ch);
      }

      const uid = this.authStore.user()?.id;
      const userIsGm = campData!.gm_id === uid || this.authStore.isAdmin();

      if (loadedScenes.length === 0 && userIsGm && uid) {
        const initLayout = computeSceneCanvasLayout({
          sceneWidthPx: DEFAULT_VTT_SCENE_WIDTH_PX,
          sceneHeightPx: DEFAULT_VTT_SCENE_HEIGHT_PX,
          gridSizePx: DEFAULT_VTT_GRID_SIZE_PX,
          padding: DEFAULT_VTT_SCENE_PADDING,
        });
        const created = await this.vttService.createScene({
          campaign_id: campaignId,
          gm_id: uid,
          name: `${campData!.name} — Blank Scene`,
          is_active_scene: true,
          grid_mode: 'square',
          scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
          scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
          padding: DEFAULT_VTT_SCENE_PADDING,
          grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
          grid_opacity: DEFAULT_VTT_GRID_OPACITY,
          grid_width: initLayout.gridCols,
          grid_height: initLayout.gridRows,
          background_color: DEFAULT_VTT_BG_COLOR,
        });
        if (created.needsMigration) {
          this.needsMigration.set(true);
        }
        if (created.scene) {
          loadedScenes = [created.scene];
        }
      }

      this.scenes.set(loadedScenes);
      const initialScene =
        loadedScenes.find((s) => s.is_active_scene) ?? loadedScenes[0] ?? null;
      this.activeSceneId.set(initialScene?.id ?? null);

      if (!hydratedFromBundle) {
        const [fetchedTokens, fetchedLogs] = await Promise.all([
          initialScene
            ? this.vttService.fetchSceneTokens(initialScene.id)
            : Promise.resolve([]),
          this.vttService.fetchCampaignLogs(campaignId),
        ]);
        initialTokens = fetchedTokens;
        initialLogs = fetchedLogs;
      } else if (
        initialScene &&
        initialTokens.length === 0 &&
        loadedScenes.length === 1 &&
        !loadedScenes[0].token_count
      ) {
        initialTokens = [];
      }

      this.tokens.set(initialTokens);
      this.logs.set(initialLogs);
      this.selectedTokenId.set(null);

      this.realtimeChannel = this.vttService.subscribeToCampaignRealtime(
        campaignId,
        {
          onEncounterUpsert: (incomingScene) => {
            const existingLocal = this.scenes().find(
              (s) => s.id === incomingScene.id
            );
            const mergedScene: VttSceneModel =
              existingLocal?.folder_id?.startsWith('local-folder-') &&
              !incomingScene.folder_id
                ? { ...incomingScene, folder_id: existingLocal.folder_id }
                : incomingScene;

            this.scenes.update((curr) =>
              existingLocal
                ? curr.map((s) =>
                    s.id === mergedScene.id ? mergedScene : s
                  )
                : [...curr, mergedScene]
            );
            if (!this.isGm() && mergedScene.is_active_scene) {
              const prevActive = this.activeSceneId();
              if (prevActive !== mergedScene.id) {
                this.activeSceneNaturalSize.set(null);
                this.activeSceneId.set(mergedScene.id);
                void this.loadTokensForScene(mergedScene.id);
              }
            }
          },
          onEncounterDelete: (deletedId) => {
            this.scenes.update((curr) =>
              curr.filter((s) => s.id !== deletedId)
            );
            if (this.activeSceneId() === deletedId) {
              this.activeSceneNaturalSize.set(null);
              const fallback = this.scenes()[0]?.id ?? null;
              this.activeSceneId.set(fallback);
              if (fallback) {
                void this.loadTokensForScene(fallback);
              } else {
                this.tokens.set([]);
              }
            }
          },
          onFolderUpsert: (incomingFolder) => {
            this.folders.update((curr) => {
              const exists = curr.some((f) => f.id === incomingFolder.id);
              return exists
                ? curr.map((f) =>
                    f.id === incomingFolder.id ? incomingFolder : f
                  )
                : [...curr, incomingFolder];
            });
          },
          onFolderDelete: (folderId) => {
            this.folders.update((curr) =>
              curr.filter((f) => f.id !== folderId)
            );
          },
          onRosterActorUpsert: (incomingActor) => {
            this.rosterActors.update((curr) => {
              const existingLocal = curr.find(
                (a) => a.id === incomingActor.id
              );
              const mergedActor: VttRosterActorModel =
                existingLocal?.folder_id?.startsWith('local-folder-') &&
                !incomingActor.folder_id
                  ? { ...incomingActor, folder_id: existingLocal.folder_id }
                  : incomingActor;
              return existingLocal
                ? curr.map((a) => (a.id === mergedActor.id ? mergedActor : a))
                : [...curr, mergedActor];
            });
            if (!this.isGm()) {
              this.openSheetWindows.update((curr) =>
                curr.filter((e) => this.canEditTarget(e.target))
              );
              this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
            }
            if (
              !this.isGm() &&
              this.openTokenizerTarget() &&
              !this.canEditOpenTokenizer()
            ) {
              this.openTokenizerTarget.set(null);
            }
          },
          onRosterActorDelete: (actorId) => {
            this.rosterActors.update((curr) =>
              curr.filter((a) => a.id !== actorId)
            );
            this.openSheetWindows.update((curr) =>
              curr.filter(
                (e) =>
                  !(
                    e.target.rosterActorId === actorId && !e.target.characterId
                  )
              )
            );
            this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
            const tokTarget = this.openTokenizerTarget();
            if (
              tokTarget?.rosterActorId === actorId &&
              !tokTarget.characterId
            ) {
              this.openTokenizerTarget.set(null);
            }
          },
          onTokenUpsert: (incomingToken) => {
            if (
              incomingToken.is_hidden &&
              !this.isGm() &&
              !this.canControlToken(incomingToken)
            ) {
              this.tokens.update((curr) =>
                curr.filter((t) => t.id !== incomingToken.id)
              );
              this.pruneRemovedTokenFromSelection(incomingToken.id);
              return;
            }
            this.tokens.update((curr) => {
              const exists = curr.some((t) => t.id === incomingToken.id);
              return exists
                ? curr.map((t) =>
                    t.id === incomingToken.id ? incomingToken : t
                  )
                : [...curr, incomingToken];
            });
          },
          onTokenDelete: (tokenId) => {
            this.tokens.update((curr) =>
              curr.filter((t) => t.id !== tokenId)
            );
            this.pruneRemovedTokenFromSelection(tokenId);
            this.openSheetWindows.update((curr) =>
              curr.filter(
                (e) =>
                  !(
                    e.target.tokenId === tokenId &&
                    !e.target.rosterActorId &&
                    !e.target.characterId
                  )
              )
            );
            this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
            const tokTarget = this.openTokenizerTarget();
            if (
              tokTarget?.tokenId === tokenId &&
              !tokTarget.rosterActorId &&
              !tokTarget.characterId
            ) {
              this.openTokenizerTarget.set(null);
            }
          },
          onCharacterUpsert: (incomingChar) => {
            this.allCharacters.update((curr) => {
              const exists = curr.some((c) => c.id === incomingChar.id);
              return exists
                ? curr.map((c) =>
                    c.id === incomingChar.id ? incomingChar : c
                  )
                : [...curr, incomingChar];
            });
            this.characterStore.upsertRealtimeCharacter(incomingChar);
          },
          onLogInsert: (entry) => {
            const visible = this.isLogVisibleToCurrentUser(entry);
            const alreadyPresent = this.logs().some((e) => e.id === entry.id);
            if (!alreadyPresent) {
              this.logs.update((curr) => [...curr, entry]);
              if (visible) {
                this.triggerLogAudioCue(entry.kind);
              }
            }
            if (!visible) return;
            const embeddedThrow = sanitizeIncomingDiceThrowPayload(
              entry.payload?.['diceThrow']
            );
            if (
              embeddedThrow &&
              Math.abs(Date.now() - embeddedThrow.createdAt) < 20000
            ) {
              this.enqueueDiceThrow(embeddedThrow, false);
            }
          },
          onLogDelete: (logId) => {
            this.logs.update((curr) => curr.filter((e) => e.id !== logId));
          },
          onPing: (ping) => {
            this.settingsStore.playUiCue('ping');
            this.activePings.update((curr) => [...curr, ping]);
            setTimeout(() => {
              this.activePings.update((curr) =>
                curr.filter((p) => p.createdAt !== ping.createdAt)
              );
            }, 2400);
          },
          onDiceThrow: (incomingThrow) => {
            if (Math.abs(Date.now() - incomingThrow.createdAt) < 20000) {
              this.enqueueDiceThrow(incomingThrow, false);
            }
          },
        }
      );

      this.syncExploredFogFromObservers();
    } finally {
      this.isLoading.set(false);
    }
  }

  leaveRoom(): void {
    this.vttService.unsubscribeChannel(this.realtimeChannel);
    this.realtimeChannel = null;
    this.participants.set([]);
    this.pendingTargetAction.set(null);
    this.draggingRosterPayload.set(null);
    this.draggingCompendiumPayload.set(null);
    this.selectedTokenId.set(null);
    this.selectedRosterActorId.set(null);
    this.selectedCharacterId.set(null);
    this.openSheetWindows.set([]);
    this.openSheetTarget.set(null);
    this.openTokenizerTarget.set(null);
    this.gmSpeakerMode.set('user');
    this.selectedLightId.set(null);
    this.activePings.set([]);
    this.activeSceneNaturalSize.set(null);
    this.latestDiceThrow.set(null);
    this.seenDiceThrowIds.clear();
    this.inFlightTokenRotationPatches.clear();
    this.undoStack.set([]);
  }

  async createDirectoryFolder(input: {
    scope: VttDirectoryScope;
    name: string;
    parent_folder_id?: string | null;
    color?: string | null;
  }): Promise<VttFolderModel | null> {
    const camp = this.campaign();
    if (!camp || !this.isGm()) return null;

    const trimmed = input.name.trim() || 'New Folder';
    const parentId = input.parent_folder_id || null;
    if (!canNestFolderInside(null, parentId, this.folders(), input.scope)) {
      this.notifications.error(
        'Folder Depth Reached',
        'Folders can be nested up to 3 levels deep.'
      );
      return null;
    }

    const siblings = this.folders().filter(
      (f) => f.scope === input.scope && f.parent_folder_id === parentId
    );
    const nextSort =
      siblings.reduce((acc, s) => Math.max(acc, s.sort_order), -1) + 1;

    const res = await this.vttService.createFolder({
      campaign_id: camp.id,
      scope: input.scope,
      parent_folder_id: parentId,
      name: trimmed,
      color: input.color ?? '#C4491A',
      sort_order: nextSort,
    });

    if (res.error || !res.folder) {
      this.notifications.error(
        'Unable to Create Folder',
        res.error ?? 'Unknown error.'
      );
      return null;
    }

    this.folders.update((curr) =>
      curr.some((f) => f.id === res.folder!.id) ? curr : [...curr, res.folder!]
    );
    return res.folder;
  }

  async updateDirectoryFolder(
    folderId: string,
    patch: {
      name?: string;
      parent_folder_id?: string | null;
      color?: string | null;
      sort_order?: number;
    }
  ): Promise<void> {
    const camp = this.campaign();
    const target = this.folders().find((f) => f.id === folderId);
    if (!camp || !target || !this.isGm()) return;

    if (
      patch.parent_folder_id !== undefined &&
      !canNestFolderInside(
        folderId,
        patch.parent_folder_id,
        this.folders(),
        target.scope
      )
    ) {
      this.notifications.error(
        'Invalid Folder Move',
        'Cannot move a folder inside itself or exceed 3 nesting levels.'
      );
      return;
    }

    const cleanPatch: Partial<VttFolderModel> = {
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() || target.name : undefined,
    };
    if (cleanPatch.name === undefined) {
      delete cleanPatch.name;
    }

    this.folders.update((curr) =>
      curr.map((f) => (f.id === folderId ? { ...f, ...cleanPatch } : f))
    );

    const err = await this.vttService.updateFolder(camp.id, folderId, cleanPatch);
    if (err) {
      this.notifications.error('Folder Update Error', err);
    }
  }

  async deleteDirectoryFolder(folderId: string): Promise<void> {
    const camp = this.campaign();
    const target = this.folders().find((f) => f.id === folderId);
    if (!camp || !target || !this.isGm()) return;

    const fallbackParent = target.parent_folder_id ?? null;

    const childFolders = this.folders().filter(
      (f) => f.parent_folder_id === folderId
    );
    for (const cf of childFolders) {
      await this.updateDirectoryFolder(cf.id, {
        parent_folder_id: fallbackParent,
      });
    }

    if (target.scope === 'maps') {
      const affectedMaps = this.scenes().filter(
        (s) => s.folder_id === folderId
      );
      for (const sc of affectedMaps) {
        await this.patchScene(sc.id, { folder_id: fallbackParent });
      }
    } else if (target.scope === 'characters') {
      const affectedActors = this.rosterActors().filter(
        (a) => a.folder_id === folderId
      );
      for (const actor of affectedActors) {
        await this.updateRosterActor(actor.id, { folder_id: fallbackParent });
      }
    }

    this.folders.update((curr) => curr.filter((f) => f.id !== folderId));
    const err = await this.vttService.deleteFolder(camp.id, folderId);
    if (err) {
      this.notifications.error('Folder Delete Error', err);
    }
  }

  async loadTokensForScene(sceneId: string): Promise<void> {
    const loaded = await this.vttService.fetchSceneTokens(sceneId);
    this.tokens.set(loaded);
    this.syncExploredFogFromObservers();
  }

  async selectOrActivateScene(
    sceneId: string,
    makePartyActive = false
  ): Promise<void> {
    if (!sceneId) return;
    const prevId = this.activeSceneId();
    this.activeSceneId.set(sceneId);
    if (prevId !== sceneId) {
      this.activeSceneNaturalSize.set(null);
      this.selectedTokenId.set(null);
      this.selectedLightId.set(null);
      this.pendingTargetAction.set(null);
      await this.loadTokensForScene(sceneId);
    }

    if (makePartyActive && this.isGm()) {
      const prevScenes = this.scenes();
      const camp = this.campaign();

      if (camp && typeof this.vttService.activateSceneForParty === 'function') {
        const actRes = await this.vttService.activateSceneForParty(
          camp.id,
          sceneId
        );
        if (!actRes.fallback) {
          if (actRes.error) {
            this.notifications.error('Scene Activation Error', actRes.error);
            return;
          }
          this.scenes.update((curr) =>
            curr.map((s) => ({
              ...s,
              is_active_scene: s.id === sceneId,
            }))
          );
          this.notifications.success(
            'Party Moved to Scene',
            'Players are now viewing this scene.'
          );
          return;
        }
      }

      for (const sc of prevScenes) {
        const nextActive = sc.id === sceneId;
        if (sc.is_active_scene !== nextActive) {
          await this.patchScene(sc.id, { is_active_scene: nextActive });
        }
      }
      this.notifications.success(
        'Party Moved to Scene',
        'Players are now viewing this scene.'
      );
    }
  }

  async createBlankMap(input: {
    name: string;
    folder_id?: string | null;
    activateForParty?: boolean;
  }): Promise<VttSceneModel | null> {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id;
    if (!camp || !uid || !this.isGm()) return null;

    const trimmed = input.name.trim() || 'Untitled Scene';
    const hasExistingMaps = this.scenes().length > 0;
    const shouldActivate =
      !hasExistingMaps || Boolean(input.activateForParty);

    const siblings = this.scenes().filter(
      (s) => (s.folder_id ?? null) === (input.folder_id ?? null)
    );
    const nextSort =
      siblings.reduce((acc, s) => Math.max(acc, s.sort_order ?? 0), -1) + 1;

    const initLayout = computeSceneCanvasLayout({
      sceneWidthPx: DEFAULT_VTT_SCENE_WIDTH_PX,
      sceneHeightPx: DEFAULT_VTT_SCENE_HEIGHT_PX,
      gridSizePx: DEFAULT_VTT_GRID_SIZE_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
    });

    const res = await this.vttService.createScene({
      campaign_id: camp.id,
      gm_id: uid,
      name: trimmed,
      folder_id: input.folder_id ?? null,
      is_active_scene: shouldActivate,
      map_image_url: null,
      background_color: DEFAULT_VTT_BG_COLOR,
      grid_mode: 'square',
      scene_width: DEFAULT_VTT_SCENE_WIDTH_PX,
      scene_height: DEFAULT_VTT_SCENE_HEIGHT_PX,
      padding: DEFAULT_VTT_SCENE_PADDING,
      grid_width: initLayout.gridCols,
      grid_height: initLayout.gridRows,
      grid_size_px: DEFAULT_VTT_GRID_SIZE_PX,
      grid_opacity: DEFAULT_VTT_GRID_OPACITY,
      token_vision: true,
      fog_enabled: true,
      global_illumination: false,
      darkness_level: DEFAULT_VTT_DARKNESS_LEVEL,
      sort_order: nextSort,
    });

    if (res.needsMigration) {
      this.needsMigration.set(true);
    }

    if (res.error || !res.scene) {
      this.notifications.error(
        'Unable to Create Scene',
        res.error ?? 'Unknown error.'
      );
      return null;
    }

    this.scenes.update((curr) =>
      curr.some((s) => s.id === res.scene!.id) ? curr : [...curr, res.scene!]
    );
    await this.selectOrActivateScene(res.scene.id, shouldActivate);
    return res.scene;
  }

  async createNewScene(
    name: string,
    sceneWidthPx = DEFAULT_VTT_SCENE_WIDTH_PX,
    sceneHeightPx = DEFAULT_VTT_SCENE_HEIGHT_PX
  ): Promise<void> {
    const created = await this.createBlankMap({
      name,
      activateForParty: true,
    });
    if (
      created &&
      (sceneWidthPx !== DEFAULT_VTT_SCENE_WIDTH_PX ||
        sceneHeightPx !== DEFAULT_VTT_SCENE_HEIGHT_PX)
    ) {
      await this.patchScene(created.id, {
        scene_width: Math.max(200, Math.round(sceneWidthPx)),
        scene_height: Math.max(200, Math.round(sceneHeightPx)),
      });
    }
  }

  async moveSceneToFolder(
    sceneId: string,
    folderId: string | null
  ): Promise<void> {
    if (!this.isGm()) return;
    const sc = this.scenes().find((s) => s.id === sceneId);
    if (!sc || (sc.folder_id ?? null) === (folderId ?? null)) return;
    await this.patchScene(sceneId, { folder_id: folderId ?? null });
  }

  async duplicateScene(sceneId: string): Promise<VttSceneModel | null> {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id;
    const source = this.scenes().find((s) => s.id === sceneId);
    if (!camp || !uid || !source || !this.isGm()) return null;

    const clonedWalls: VttWallSegment[] = (source.walls ?? []).map((w, idx) => ({
      ...w,
      id: `wall-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    }));
    const clonedLights: VttLightSource[] = (source.lights ?? []).map(
      (l, idx) => ({
        ...l,
        id: `light-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      })
    );

    const res = await this.vttService.createScene({
      campaign_id: camp.id,
      gm_id: uid,
      name: `${source.name} (Copy)`,
      folder_id: source.folder_id,
      is_active_scene: false,
      map_image_url: source.map_image_url,
      background_color: source.background_color,
      grid_mode: source.grid_mode,
      scene_width: source.scene_width,
      scene_height: source.scene_height,
      padding: source.padding,
      grid_width: source.grid_width,
      grid_height: source.grid_height,
      grid_size_px: source.grid_size_px,
      grid_offset_x: source.grid_offset_x,
      grid_offset_y: source.grid_offset_y,
      grid_opacity: source.grid_opacity,
      token_vision: source.token_vision,
      fog_enabled: source.fog_enabled,
      global_illumination: source.global_illumination,
      darkness_level: source.darkness_level,
      walls: clonedWalls,
      lights: clonedLights,
      sort_order: (source.sort_order ?? 0) + 1,
    });

    if (res.error || !res.scene) {
      this.notifications.error(
        'Unable to Duplicate Scene',
        res.error ?? 'Unknown error.'
      );
      return null;
    }

    this.scenes.update((curr) =>
      curr.some((s) => s.id === res.scene!.id) ? curr : [...curr, res.scene!]
    );
    await this.selectOrActivateScene(res.scene.id, false);
    this.notifications.success('Scene Duplicated', `Created "${res.scene.name}".`);
    return res.scene;
  }

  async deleteSceneById(sceneId: string): Promise<void> {
    if (!this.isGm()) return;
    const target = this.scenes().find((s) => s.id === sceneId);
    if (!target) return;

    const wasViewing = this.activeScene()?.id === sceneId;
    const wasPartyActive = target.is_active_scene;

    this.scenes.update((curr) => curr.filter((s) => s.id !== sceneId));
    this.tokens.update((curr) =>
      curr.filter((t) => t.encounter_id !== sceneId)
    );
    this.undoStack.update((curr) =>
      curr.filter((entry) => entry.sceneId !== sceneId)
    );

    const err = await this.vttService.deleteScene(sceneId);
    if (err) {
      this.notifications.error('Unable to Delete Scene', err);
      return;
    }

    const remaining = this.scenes();
    if (remaining.length === 0) {
      this.activeSceneNaturalSize.set(null);
      this.activeSceneId.set(null);
      this.selectedTokenId.set(null);
      this.selectedLightId.set(null);
      this.tokens.set([]);
      return;
    }

    const fallback =
      remaining.find((s) => s.is_active_scene) ?? remaining[0];
    if (wasViewing) {
      await this.selectOrActivateScene(fallback.id, wasPartyActive);
    } else if (wasPartyActive) {
      await this.patchScene(fallback.id, { is_active_scene: true });
    }
  }

  async patchScene(
    sceneId: string,
    patch: Partial<VttSceneModel>
  ): Promise<void> {
    const prevScene = this.scenes().find((s) => s.id === sceneId) ?? null;
    const enrichedPatch: Partial<VttSceneModel> = { ...patch };

    const layoutAffecting =
      prevScene !== null &&
      (patch.padding !== undefined ||
        patch.grid_size_px !== undefined ||
        patch.scene_width !== undefined ||
        patch.scene_height !== undefined ||
        patch.grid_offset_x !== undefined ||
        patch.grid_offset_y !== undefined ||
        patch.map_image_url !== undefined);

    const oldLayout = prevScene ? this.getSceneLayout(prevScene) : null;
    let newLayout: SceneCanvasLayout | null = null;
    let dx = 0;
    let dy = 0;

    if (prevScene) {
      const urlChanged =
        patch.map_image_url !== undefined &&
        patch.map_image_url !== prevScene.map_image_url;
      const candidate: VttSceneModel = { ...prevScene, ...enrichedPatch };
      newLayout = this.getSceneLayout(candidate, urlChanged ? null : undefined);

      if (layoutAffecting && oldLayout && newLayout) {
        enrichedPatch.grid_width = newLayout.gridCols;
        enrichedPatch.grid_height = newLayout.gridRows;
        dx = newLayout.sceneX - oldLayout.sceneX;
        dy = newLayout.sceneY - oldLayout.sceneY;

        if ((dx !== 0 || dy !== 0) && patch.walls === undefined && prevScene.walls.length > 0) {
          enrichedPatch.walls = prevScene.walls.map((w) => ({
            ...w,
            x1: Math.round(w.x1 + dx),
            y1: Math.round(w.y1 + dy),
            x2: Math.round(w.x2 + dx),
            y2: Math.round(w.y2 + dy),
          }));
        }

        if ((dx !== 0 || dy !== 0) && patch.lights === undefined && prevScene.lights.length > 0) {
          enrichedPatch.lights = prevScene.lights.map((l) => ({
            ...l,
            x: Math.round(l.x + dx),
            y: Math.round(l.y + dy),
          }));
        }

        const sizeChanged =
          patch.grid_size_px !== undefined &&
          patch.grid_size_px !== prevScene.grid_size_px;
        if (
          (dx !== 0 || dy !== 0 || sizeChanged) &&
          patch.explored_fog === undefined &&
          (prevScene.explored_fog?.cells?.length ?? 0) > 0
        ) {
          const remapped = new Set<string>();
          for (const key of prevScene.explored_fog?.cells ?? []) {
            const parsed = parseHexKey(key);
            if (!parsed) continue;
            const oldPt = hexToWorldCenter(parsed, oldLayout.geometry);
            const nextHex = worldPointToHex(
              { x: oldPt.x + dx, y: oldPt.y + dy },
              newLayout.geometry
            );
            if (
              nextHex.col >= 0 &&
              nextHex.col < newLayout.gridCols &&
              nextHex.row >= 0 &&
              nextHex.row < newLayout.gridRows
            ) {
              remapped.add(hexKey(nextHex.col, nextHex.row));
            }
          }
          enrichedPatch.explored_fog = {
            ...prevScene.explored_fog,
            cells: Array.from(remapped),
          };
        }
      }
    }

    this.scenes.update((curr) =>
      curr.map((s) => (s.id === sceneId ? { ...s, ...enrichedPatch } : s))
    );

    const res = await this.vttService.updateScene(
      sceneId,
      enrichedPatch,
      this.needsMigration(),
      prevScene
    );
    if (res.needsMigration) {
      this.needsMigration.set(true);
    }
    if (res.error) {
      this.notifications.error('Scene Sync Error', res.error);
      return;
    }

    if (
      prevScene &&
      oldLayout &&
      newLayout &&
      this.activeScene()?.id === sceneId
    ) {
      const modeChanged =
        patch.grid_mode !== undefined &&
        patch.grid_mode !== prevScene.grid_mode;
      const sizeChanged =
        patch.grid_size_px !== undefined &&
        patch.grid_size_px !== prevScene.grid_size_px;

      if (modeChanged || dx !== 0 || dy !== 0 || sizeChanged) {
        await this.reconcileSceneTokensAfterLayoutChange(
          sceneId,
          prevScene.grid_mode,
          oldLayout,
          enrichedPatch.grid_mode ?? prevScene.grid_mode,
          newLayout,
          dx,
          dy
        );
      }
    }
  }

  private async reconcileSceneTokensAfterLayoutChange(
    sceneId: string,
    prevMode: VttSceneModel['grid_mode'],
    oldLayout: SceneCanvasLayout,
    nextMode: VttSceneModel['grid_mode'],
    newLayout: SceneCanvasLayout,
    dx: number,
    dy: number
  ): Promise<void> {
    const sceneToks = this.tokens().filter((t) => t.encounter_id === sceneId);
    const bounds = {
      width: newLayout.totalWidth,
      height: newLayout.totalHeight,
    };

    for (const tok of sceneToks) {
      const prevPt = getTokenWorldCenter(tok, oldLayout.geometry, prevMode);
      const shiftedPt = clampWorldPointToBounds(
        { x: prevPt.x + dx, y: prevPt.y + dy },
        bounds
      );
      const snapped = clampHexToBounds(
        worldPointToHex(shiftedPt, newLayout.geometry),
        newLayout.geometry.gridWidth,
        newLayout.geometry.gridHeight
      );
      const axial = offsetToAxial(snapped.col, snapped.row);

      if (nextMode !== 'gridless') {
        if (
          tok.x !== snapped.col ||
          tok.y !== snapped.row ||
          tok.world_x !== null ||
          tok.world_y !== null
        ) {
          await this.patchToken(tok.id, {
            x: snapped.col,
            y: snapped.row,
            q: axial.q,
            r: axial.r,
            world_x: null,
            world_y: null,
          });
        }
      } else {
        const nextWx = Math.round(shiftedPt.x);
        const nextWy = Math.round(shiftedPt.y);
        if (
          tok.x !== snapped.col ||
          tok.y !== snapped.row ||
          tok.world_x !== nextWx ||
          tok.world_y !== nextWy
        ) {
          await this.patchToken(tok.id, {
            x: snapped.col,
            y: snapped.row,
            q: axial.q,
            r: axial.r,
            world_x: nextWx,
            world_y: nextWy,
          });
        }
      }
    }
  }

  async uploadMapFile(
    file: File,
    folderId?: string | null
  ): Promise<string | null> {
    const camp = this.campaign();
    if (!camp || !this.isGm()) return null;

    if (this.authStore.user()) {
      const savedAsset = await this.userAssetsStore.uploadAssetFile(file, {
        purpose: 'maps',
        folderId,
      });
      if (savedAsset) {
        return savedAsset.public_url;
      }
    }

    const res = await this.vttService.uploadMapImage(camp.id, file);
    if (res.error || !res.url) {
      this.notifications.error('Scene Image Upload Failed', res.error ?? '');
      return null;
    }
    return res.url;
  }

  private probeImageFileDimensions(
    file: File
  ): Promise<{ width: number; height: number } | null> {
    if (typeof Image === 'undefined' || typeof URL === 'undefined') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(
          img.naturalWidth > 0 && img.naturalHeight > 0
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : null
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  }

  async uploadActiveSceneMap(file: File): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    const [url, dims] = await Promise.all([
      this.uploadMapFile(file),
      this.probeImageFileDimensions(file),
    ]);
    if (!url) return;

    await this.patchScene(sc.id, {
      map_image_url: url,
      scene_width: dims?.width ?? null,
      scene_height: dims?.height ?? null,
    });
    this.notifications.success(
      'Scene Background Updated',
      'Custom background image applied to current scene.'
    );
  }

  async addWallSegment(
    a: VttPoint,
    b: VttPoint,
    kind: VttWallKind
  ): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 8) return;

    const prevWalls = cloneWalls(sc.walls);
    const prevFog = cloneExploredFog(sc.explored_fog);

    const wall: VttWallSegment = {
      id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x1: Math.round(a.x),
      y1: Math.round(a.y),
      x2: Math.round(b.x),
      y2: Math.round(b.y),
      kind,
      open: kind === 'door' ? false : undefined,
    };

    const kindLabel =
      kind === 'door' ? 'Door' : kind === 'window' ? 'Window' : 'Wall';
    this.pushUndoEntry(sc.id, `Add ${kindLabel} Segment`, {
      kind: 'scene_patch',
      previousScenePatch: {
        walls: prevWalls,
        explored_fog: prevFog,
      },
    });

    await this.patchScene(sc.id, { walls: [...sc.walls, wall] });
    this.syncExploredFogFromObservers();
  }

  async toggleDoor(wallId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;
    const target = sc.walls.find((w) => w.id === wallId && w.kind === 'door');
    if (!target) return;

    const prevWalls = cloneWalls(sc.walls);
    const prevFog = cloneExploredFog(sc.explored_fog);
    this.pushUndoEntry(sc.id, target.open ? 'Close Door' : 'Open Door', {
      kind: 'scene_patch',
      previousScenePatch: {
        walls: prevWalls,
        explored_fog: prevFog,
      },
    });

    const nextWalls = sc.walls.map((w) =>
      w.id === wallId ? { ...w, open: !w.open } : w
    );
    await this.patchScene(sc.id, { walls: nextWalls });
    this.syncExploredFogFromObservers();
  }

  async deleteWallSegment(wallId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    const target = sc.walls.find((w) => w.id === wallId);
    if (!target) return;

    const prevWalls = cloneWalls(sc.walls);
    const prevFog = cloneExploredFog(sc.explored_fog);
    this.pushUndoEntry(sc.id, 'Delete Wall Segment', {
      kind: 'scene_patch',
      previousScenePatch: {
        walls: prevWalls,
        explored_fog: prevFog,
      },
    });

    await this.patchScene(sc.id, {
      walls: sc.walls.filter((w) => w.id !== wallId),
    });
    this.syncExploredFogFromObservers();
  }

  async clearAllWalls(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm() || sc.walls.length === 0) return;

    this.pushUndoEntry(sc.id, 'Clear All Walls', {
      kind: 'scene_patch',
      previousScenePatch: {
        walls: cloneWalls(sc.walls),
        explored_fog: cloneExploredFog(sc.explored_fog),
      },
    });

    await this.patchScene(sc.id, { walls: [] });
  }

  async addLightSource(
    pt: VttPoint,
    options?: {
      bright_feet?: number;
      dim_feet?: number;
      color?: string;
    }
  ): Promise<VttLightSource | null> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return null;

    const prevLights = cloneLights(sc.lights);
    const prevFog = cloneExploredFog(sc.explored_fog);
    const prevSelectedLight = this.selectedLightId();

    const dimFeet = Math.max(5, Math.round(options?.dim_feet ?? 40));
    const brightFeet = Math.max(
      0,
      Math.min(dimFeet, Math.round(options?.bright_feet ?? 20))
    );
    const light: VttLightSource = {
      id: `light-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      bright_feet: brightFeet,
      dim_feet: dimFeet,
      color: options?.color ?? '#FF9B42',
      enabled: true,
    };

    this.pushUndoEntry(sc.id, 'Place Light Source', {
      kind: 'scene_patch',
      previousScenePatch: {
        lights: prevLights,
        explored_fog: prevFog,
      },
      selectedLightIdAfterUndo: prevSelectedLight,
    });

    await this.patchScene(sc.id, { lights: [...sc.lights, light] });
    this.selectedLightId.set(light.id);
    this.syncExploredFogFromObservers();
    return light;
  }

  async clearAllLights(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm() || sc.lights.length === 0) return;

    this.pushUndoEntry(sc.id, 'Clear All Lights', {
      kind: 'scene_patch',
      previousScenePatch: {
        lights: cloneLights(sc.lights),
        explored_fog: cloneExploredFog(sc.explored_fog),
      },
      selectedLightIdAfterUndo: null,
    });

    await this.patchScene(sc.id, { lights: [] });
    this.selectedLightId.set(null);
    this.syncExploredFogFromObservers();
  }

  async updateLightSource(
    lightId: string,
    patch: Partial<VttLightSource>
  ): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    const existing = sc.lights.find((l) => l.id === lightId);
    if (!existing) return;

    const movedOnly =
      patch.x !== undefined &&
      patch.y !== undefined &&
      patch.bright_feet === undefined &&
      patch.dim_feet === undefined &&
      patch.enabled === undefined;

    this.pushUndoEntry(
      sc.id,
      movedOnly ? 'Move Light Source' : 'Edit Light Source',
      {
        kind: 'scene_patch',
        previousScenePatch: {
          lights: cloneLights(sc.lights),
          explored_fog: cloneExploredFog(sc.explored_fog),
        },
      }
    );

    const nextLights = sc.lights.map((l) =>
      l.id === lightId ? { ...l, ...patch } : l
    );
    await this.patchScene(sc.id, { lights: nextLights });
    this.syncExploredFogFromObservers();
  }

  async deleteLightSource(lightId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    const existing = sc.lights.find((l) => l.id === lightId);
    if (!existing) return;

    this.pushUndoEntry(sc.id, 'Delete Light Source', {
      kind: 'scene_patch',
      previousScenePatch: {
        lights: cloneLights(sc.lights),
        explored_fog: cloneExploredFog(sc.explored_fog),
      },
      selectedLightIdAfterUndo: lightId,
    });

    await this.patchScene(sc.id, {
      lights: sc.lights.filter((l) => l.id !== lightId),
    });
    if (this.selectedLightId() === lightId) {
      this.selectedLightId.set(null);
    }
  }

  async resetExploredFog(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    this.pushUndoEntry(sc.id, 'Reset Explored Fog', {
      kind: 'scene_patch',
      previousScenePatch: {
        explored_fog: cloneExploredFog(sc.explored_fog),
      },
    });

    await this.patchScene(sc.id, {
      explored_fog: {
        ...sc.explored_fog,
        cells: [],
        revealed_all: false,
      },
    });
    this.syncExploredFogFromObservers();
  }

  async revealEntireMapFog(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    this.pushUndoEntry(sc.id, 'Reveal Entire Scene Fog', {
      kind: 'scene_patch',
      previousScenePatch: {
        explored_fog: cloneExploredFog(sc.explored_fog),
      },
    });

    await this.patchScene(sc.id, {
      explored_fog: {
        ...sc.explored_fog,
        cells: sc.explored_fog.cells ?? [],
        revealed_all: true,
      },
    });
  }

  async toggleSceneBooleanField(
    field: 'token_vision' | 'fog_enabled' | 'global_illumination'
  ): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    const prevValue = sc[field];
    const prevFog = cloneExploredFog(sc.explored_fog);

    const undoLabel =
      field === 'token_vision'
        ? 'Toggle Token Vision'
        : field === 'fog_enabled'
          ? 'Toggle Fog Exploration'
          : 'Toggle Global Illumination';

    this.pushUndoEntry(sc.id, undoLabel, {
      kind: 'scene_patch',
      previousScenePatch: {
        [field]: prevValue,
        explored_fog: prevFog,
      },
    });

    await this.patchScene(sc.id, { [field]: !prevValue });
    this.syncExploredFogFromObservers();
  }

  syncExploredFogFromObservers(): void {
    this.syncExploredFogAlongTokenWaypoints();
  }

  private syncExploredFogAlongTokenWaypoints(
    movingTokenId?: string,
    intermediateWaypoints?: {
      col: number;
      row: number;
      world_x: number | null;
      world_y: number | null;
    }[]
  ): void {
    const sc = this.activeScene();
    if (
      !sc ||
      !sc.token_vision ||
      !sc.fog_enabled ||
      sc.explored_fog?.revealed_all
    ) {
      return;
    }

    const observers = this.isGm()
      ? this.sceneTokens().filter((t) => !t.is_hidden && t.faction === 'ally')
      : this.observerTokens();
    if (observers.length === 0) return;

    const layout = this.sceneLayout();
    const geom = layout.geometry;
    const maxDiag = Math.hypot(layout.totalWidth, layout.totalHeight) + 200;
    const allSceneTokens = this.sceneTokens();

    const existing = new Set<string>(sc.explored_fog.cells ?? []);
    const initialCount = existing.size;

    const collectAtStep = (
      overrideTokenId?: string,
      overridePos?: {
        col: number;
        row: number;
        world_x: number | null;
        world_y: number | null;
      }
    ) => {
      const stepSceneTokens =
        overrideTokenId && overridePos
          ? allSceneTokens.map((t) =>
              t.id === overrideTokenId
                ? {
                    ...t,
                    x: overridePos.col,
                    y: overridePos.row,
                    world_x: overridePos.world_x,
                    world_y: overridePos.world_y,
                  }
                : t
            )
          : allSceneTokens;

      const stepObservers =
        overrideTokenId && overridePos
          ? observers.map((t) =>
              t.id === overrideTokenId
                ? {
                    ...t,
                    x: overridePos.col,
                    y: overridePos.row,
                    world_x: overridePos.world_x,
                    world_y: overridePos.world_y,
                  }
                : t
            )
          : observers;

      const lights = buildLightPolygons(
        sc.lights,
        stepSceneTokens,
        sc.walls,
        geom,
        sc.grid_mode
      );
      const visions = buildObserverVisions(
        stepObservers,
        sc.walls,
        geom,
        sc.global_illumination,
        maxDiag,
        sc.grid_mode,
        sc.darkness_level
      );
      const newlySeen = collectNewlyExploredHexKeys(
        existing,
        visions,
        lights,
        sc.walls,
        geom,
        sc.global_illumination
      );
      for (const k of newlySeen) {
        existing.add(k);
      }
    };

    if (
      movingTokenId &&
      intermediateWaypoints &&
      intermediateWaypoints.length > 0 &&
      observers.some((o) => o.id === movingTokenId)
    ) {
      for (const wp of intermediateWaypoints) {
        collectAtStep(movingTokenId, wp);
      }
    }

    collectAtStep();

    if (existing.size > initialCount) {
      void this.patchScene(sc.id, {
        explored_fog: {
          ...sc.explored_fog,
          cells: Array.from(existing),
        },
      });
    }
  }

  private findOpenSpawnLocation(preferredFaction: VttFaction): {
    col: number;
    row: number;
    world_x: number | null;
    world_y: number | null;
  } {
    const sc = this.activeScene();
    const layout = this.sceneLayout();
    const geom = layout.geometry;
    const existingTokens = this.sceneTokens();
    const occupied = new Set(existingTokens.map((t) => `${t.x},${t.y}`));

    const minInner = clampHexToBounds(
      worldPointToHex(
        { x: layout.sceneX + 32, y: layout.sceneY + 32 },
        geom
      ),
      geom.gridWidth,
      geom.gridHeight
    );
    const maxInner = clampHexToBounds(
      worldPointToHex(
        {
          x: layout.sceneX + Math.max(48, layout.innerWidth - 32),
          y: layout.sceneY + Math.max(48, layout.innerHeight - 32),
        },
        geom
      ),
      geom.gridWidth,
      geom.gridHeight
    );

    const insetX = Math.min(
      layout.innerWidth * 0.22,
      Math.max(80, layout.gridSizePx * 2)
    );
    const anchorWorld =
      preferredFaction === 'enemy'
        ? {
            x: layout.sceneX + layout.innerWidth - insetX,
            y: layout.sceneY + layout.innerHeight * 0.5,
          }
        : {
            x: layout.sceneX + insetX,
            y: layout.sceneY + layout.innerHeight * 0.5,
          };
    const anchorHex = clampHexToBounds(
      worldPointToHex(anchorWorld, geom),
      geom.gridWidth,
      geom.gridHeight
    );

    let chosenCol = anchorHex.col;
    let chosenRow = anchorHex.row;
    let found = false;

    const minCol = Math.min(minInner.col, maxInner.col);
    const maxCol = Math.max(minInner.col, maxInner.col);
    const minRow = Math.min(minInner.row, maxInner.row);
    const maxRow = Math.max(minInner.row, maxInner.row);

    for (
      let radius = 0;
      radius <= Math.max(maxCol - minCol, maxRow - minRow) + 1 && !found;
      radius++
    ) {
      for (let dc = -radius; dc <= radius && !found; dc++) {
        for (let dr = -radius; dr <= radius && !found; dr++) {
          const col = anchorHex.col + dc;
          const row = anchorHex.row + dr;
          if (
            col >= minCol &&
            col <= maxCol &&
            row >= minRow &&
            row <= maxRow &&
            !occupied.has(`${col},${row}`)
          ) {
            chosenCol = col;
            chosenRow = row;
            found = true;
          }
        }
      }
    }

    if (!found) {
      for (
        let radius = 0;
        radius < Math.max(geom.gridWidth, geom.gridHeight) && !found;
        radius++
      ) {
        for (let dc = -radius; dc <= radius && !found; dc++) {
          for (let dr = -radius; dr <= radius && !found; dr++) {
            const col = anchorHex.col + dc;
            const row = anchorHex.row + dr;
            if (
              col >= 0 &&
              col < geom.gridWidth &&
              row >= 0 &&
              row < geom.gridHeight &&
              !occupied.has(`${col},${row}`)
            ) {
              chosenCol = col;
              chosenRow = row;
              found = true;
            }
          }
        }
      }
    }

    if (sc?.grid_mode === 'gridless') {
      const basePt = hexToWorldCenter({ col: chosenCol, row: chosenRow }, geom);
      let wx = Math.round(basePt.x);
      let wy = Math.round(basePt.y);

      const bounds = {
        width: layout.totalWidth,
        height: layout.totalHeight,
      };
      for (let attempt = 0; attempt < 16; attempt++) {
        const collides = existingTokens.some((t) => {
          const tc = getTokenWorldCenter(t, geom, 'gridless');
          return Math.hypot(tc.x - wx, tc.y - wy) < 34;
        });
        if (!collides) break;
        const angle = (attempt * Math.PI) / 4;
        const ring = 44 * (1 + Math.floor(attempt / 8));
        const shifted = clampWorldPointToBounds(
          {
            x: basePt.x + Math.cos(angle) * ring,
            y: basePt.y + Math.sin(angle) * ring,
          },
          bounds
        );
        wx = shifted.x;
        wy = shifted.y;
      }

      return { col: chosenCol, row: chosenRow, world_x: wx, world_y: wy };
    }

    return { col: chosenCol, row: chosenRow, world_x: null, world_y: null };
  }

  private resolveDropPlacement(
    faction: VttFaction,
    placement?: { worldPt: VttPoint; unsnapped: boolean }
  ): {
    col: number;
    row: number;
    world_x: number | null;
    world_y: number | null;
    unsnappedOnGrid: boolean;
  } {
    const sc = this.activeScene();
    if (!sc || !placement) {
      const spawn = this.findOpenSpawnLocation(faction);
      return {
        col: spawn.col,
        row: spawn.row,
        world_x: spawn.world_x,
        world_y: spawn.world_y,
        unsnappedOnGrid: false,
      };
    }

    const layout = this.sceneLayout();
    const geom = layout.geometry;
    const bounds = { width: layout.totalWidth, height: layout.totalHeight };
    const clampedWorld = clampWorldPointToBounds(placement.worldPt, bounds);
    const clampedHex = clampHexToBounds(
      worldPointToHex(clampedWorld, geom),
      geom.gridWidth,
      geom.gridHeight
    );

    if (sc.grid_mode === 'gridless') {
      return {
        col: clampedHex.col,
        row: clampedHex.row,
        world_x: clampedWorld.x,
        world_y: clampedWorld.y,
        unsnappedOnGrid: false,
      };
    }

    if (placement.unsnapped) {
      return {
        col: clampedHex.col,
        row: clampedHex.row,
        world_x: clampedWorld.x,
        world_y: clampedWorld.y,
        unsnappedOnGrid: true,
      };
    }

    return {
      col: clampedHex.col,
      row: clampedHex.row,
      world_x: null,
      world_y: null,
      unsnappedOnGrid: false,
    };
  }

  getNextTopTokenZIndex(): number {
    const tokens = this.sceneTokens();
    if (tokens.length === 0) return 0;
    let maxZ = 0;
    for (const t of tokens) {
      const z = Number(t.npc_stats?.__z_index ?? 0);
      if (Number.isFinite(z) && z > maxZ) {
        maxZ = z;
      }
    }
    return maxZ + 1;
  }

  async deployCharacterToken(
    character: CharacterModel,
    placement?: { worldPt: VttPoint; unsnapped: boolean }
  ): Promise<void> {
    const sc = this.activeScene();
    if (
      !sc ||
      (!this.isGm() && !this.canEditCharacterInVtt(character.id))
    ) {
      return;
    }

    let linkedActor: VttRosterActorModel | null =
      this.findRosterActorsForCharacterId(character.id)[0] ?? null;
    if (
      !linkedActor &&
      this.isGm() &&
      typeof this.vttService.createRosterActor === 'function'
    ) {
      linkedActor = await this.importCharacterToRoster(character, null, {
        silent: true,
      });
    }
    if (linkedActor) {
      await this.deployRosterActor(linkedActor.id, placement);
      return;
    }

    const assignedUserId = null;
    const detachedSheet = cloneDetachedVttCharacterSheet(character);

    const stats = computeDerivedStats(
      detachedSheet,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      this.getArmorsForStats()
    );
    const wepVis = stats.activeWeapon
      ? resolveWeaponVisuals(stats.activeWeapon)
      : { icon: 'greatsword', color: '#38B29A' };
    const spawn = this.resolveDropPlacement('ally', placement);
    const axial = offsetToAxial(spawn.col, spawn.row);
    const topZ = this.getNextTopTokenZIndex();
    const portraitUrl = resolveEntityPortraitUrl(detachedSheet);
    const tokenImageUrl = resolveEntityTokenImageUrl(detachedSheet);
    const tokenAppearance = resolveEntityTokenAppearance(detachedSheet);

    const res = await this.vttService.insertToken({
      encounter_id: sc.id,
      character_id: null,
      owner_id: assignedUserId,
      name: detachedSheet.name,
      faction: 'ally',
      x: spawn.col,
      y: spawn.row,
      q: axial.q,
      r: axial.r,
      world_x: spawn.world_x,
      world_y: spawn.world_y,
      size: 1,
      icon: wepVis.icon,
      color: '#38B29A',
      current_hp: Math.min(detachedSheet.current_hp, stats.maxHp),
      max_hp: stats.maxHp,
      current_sp: Math.min(detachedSheet.current_sp, stats.maxSp),
      max_sp: stats.maxSp,
      current_ap: detachedSheet.current_ap ?? 4,
      max_ap: 4,
      armor_dr: stats.armorDr,
      shield_block: stats.shieldBlockTotal,
      move_feet: stats.moveFeet,
      vision_feet: DEFAULT_VTT_DIM_VISION_FEET,
      darkvision_feet: DEFAULT_VTT_DARKVISION_FEET,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: Boolean(
        detachedSheet.active_cooldowns?.['__shield_raised']
      ),
      is_hidden: false,
      statuses: [],
      portrait_url: portraitUrl,
      token_image_url: tokenImageUrl,
      token_appearance: tokenAppearance,
      npc_stats: enrichNpcStatsWithVisuals(
        {
          __assigned_user_id: assignedUserId,
          __z_index: topZ,
          __source_character_id: character.id,
          __character_sheet: detachedSheet,
          ...(spawn.unsnappedOnGrid ? { __unsnapped: true } : {}),
        },
        portraitUrl,
        tokenImageUrl,
        tokenAppearance
      ),
    });

    if (res.error || !res.token) {
      this.notifications.error(
        'Unable to Deploy Character',
        res.error ?? 'Unknown error.'
      );
      return;
    }

    const prevFog = cloneExploredFog(sc.explored_fog);
    this.tokens.update((curr) =>
      curr.some((t) => t.id === res.token!.id) ? curr : [...curr, res.token!]
    );
    this.selectedTokenId.set(res.token.id);
    this.pushUndoEntry(sc.id, `Deploy ${res.token.name}`, {
      kind: 'token_spawned',
      tokenId: res.token.id,
      previousExploredFog: prevFog,
    });
    this.syncExploredFogFromObservers();
  }

  canManageRosterActor(actor: VttRosterActorModel): boolean {
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    return Boolean(uid && this.getActorAssignedUserId(actor) === uid);
  }

  canDeployRosterActor(actor: VttRosterActorModel): boolean {
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    return Boolean(uid && this.getActorAssignedUserId(actor) === uid);
  }

  async assignRosterActorToPlayer(
    actorId: string,
    userId: string | null
  ): Promise<boolean> {
    const camp = this.campaign();
    const target = this.rosterActors().find((a) => a.id === actorId);
    if (!camp || !target || !this.isGm()) return false;

    const normalizedUserId =
      typeof userId === 'string' && userId.trim().length > 0
        ? userId.trim()
        : null;
    const nextStats: VttNpcStats = {
      ...(target.npc_stats ?? {}),
      __assigned_user_id: normalizedUserId,
    };
    const patch: Partial<VttRosterActorModel> = {
      owner_id: normalizedUserId,
      npc_stats: nextStats,
    };

    this.rosterActors.update((curr) =>
      curr.map((a) => (a.id === actorId ? { ...a, ...patch } : a))
    );

    const err = await this.vttService.updateRosterActor(
      camp.id,
      actorId,
      patch
    );
    if (err) {
      this.notifications.error('Assignment Error', err);
      return false;
    }

    const linkedTokens = this.tokens().filter(
      (t) =>
        t.npc_stats?.__roster_actor_id === actorId ||
        Boolean(target.character_id && t.character_id === target.character_id)
    );
    for (const tok of linkedTokens) {
      await this.patchToken(tok.id, {
        owner_id: normalizedUserId,
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __assigned_user_id: normalizedUserId,
        },
      });
    }

    this.syncExploredFogFromObservers();
    const assignedPart = normalizedUserId
      ? this.participants().find((p) => p.user_id === normalizedUserId)
      : null;
    this.notifications.info(
      normalizedUserId ? 'Actor Assigned' : 'Actor Unassigned',
      normalizedUserId
        ? `${target.name} assigned to ${assignedPart?.display_name ?? 'Player'}.`
        : `${target.name} is now GM-only (unassigned).`
    );
    return true;
  }

  async assignTokenToPlayer(
    tokenId: string,
    userId: string | null
  ): Promise<boolean> {
    if (!this.isGm()) return false;
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok) return false;

    const linkedActor =
      (tok.npc_stats?.__roster_actor_id
        ? this.rosterActors().find(
            (a) => a.id === tok.npc_stats.__roster_actor_id
          )
        : null) ??
      (tok.character_id
        ? this.rosterActors().find((a) => a.character_id === tok.character_id)
        : null);

    if (linkedActor) {
      return this.assignRosterActorToPlayer(linkedActor.id, userId);
    }

    const normalizedUserId =
      typeof userId === 'string' && userId.trim().length > 0
        ? userId.trim()
        : null;
    await this.patchToken(tok.id, {
      owner_id: normalizedUserId,
      npc_stats: {
        ...(tok.npc_stats ?? {}),
        __assigned_user_id: normalizedUserId,
      },
    });
    this.syncExploredFogFromObservers();
    return true;
  }

  async createRosterActorFromScratch(
    draft: ActorTemplateDraft,
    options?: {
      ownerId?: string | null;
      collectionActorId?: string | null;
      saveToCollections?: boolean;
      silent?: boolean;
    }
  ): Promise<VttRosterActorModel | null> {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id ?? null;
    if (!camp || !uid || !this.isGm()) return null;

    let linkedCollectionId = options?.collectionActorId ?? null;
    if (options?.saveToCollections) {
      const savedCol = await this.collectionsStore.createActorFromScratch(
        { ...draft, folder_id: null },
        true
      );
      if (savedCol) {
        linkedCollectionId = savedCol.id;
      }
    }

    const siblings = this.rosterActors().filter(
      (a) => (a.folder_id ?? null) === (draft.folder_id ?? null)
    );
    const nextSort =
      siblings.reduce((acc, a) => Math.max(acc, a.sort_order ?? 0), -1) + 1;

    const assignedUserId =
      options?.ownerId !== undefined && options.ownerId
        ? options.ownerId
        : null;
    const portraitUrl = resolveEntityPortraitUrl(draft);
    const tokenImageUrl = resolveEntityTokenImageUrl(draft);
    const tokenAppearance = resolveEntityTokenAppearance(draft);
    const sourceCharId =
      draft.source_character_id ??
      draft.npc_stats?.__source_character_id ??
      null;

    let embeddedSheet: CharacterModel | null | undefined =
      draft.npc_stats?.__character_sheet;
    if (
      draft.actor_kind === 'character' &&
      !embeddedSheet &&
      sourceCharId
    ) {
      const found =
        this.allCharacters().find((c) => c.id === sourceCharId) ??
        this.characterStore.characters().find((c) => c.id === sourceCharId) ??
        this.characterStore.getCharacterById(sourceCharId) ??
        null;
      if (found) {
        embeddedSheet = cloneDetachedVttCharacterSheet(found);
      }
    } else if (
      draft.actor_kind === 'character' &&
      embeddedSheet &&
      typeof embeddedSheet === 'object'
    ) {
      const normalized = normalizeCharacterRecord(embeddedSheet);
      const nextSheetId =
        normalized.id &&
        normalized.id !== sourceCharId &&
        normalized.id.trim().length > 0
          ? normalized.id
          : makeDetachedVttCharacterId();
      embeddedSheet = cloneDetachedVttCharacterSheet(normalized, nextSheetId);
    }

    const res = await this.vttService.createRosterActor({
      campaign_id: camp.id,
      folder_id: draft.folder_id || null,
      character_id: null,
      collection_actor_id: linkedCollectionId,
      owner_id: assignedUserId,
      actor_kind: draft.actor_kind,
      is_unique: draft.is_unique,
      name: draft.name.trim() || 'Unnamed Actor',
      faction: draft.faction,
      size: Math.max(1, Math.round(draft.size || 1)),
      icon: draft.icon || 'greatsword',
      color: draft.color || '#38B29A',
      max_hp: Math.max(1, Math.round(draft.max_hp || 10)),
      max_sp: Math.max(0, Math.round(draft.max_sp ?? 5)),
      max_ap: Math.max(1, Math.round(draft.max_ap || 4)),
      armor_dr: Math.max(0, Math.round(draft.armor_dr ?? 0)),
      shield_block: Math.max(0, Math.round(draft.shield_block ?? 0)),
      move_feet: Math.max(0, Math.round(draft.move_feet ?? 20)),
      vision_feet: Math.max(
        0,
        Math.round(draft.vision_feet ?? DEFAULT_VTT_DIM_VISION_FEET)
      ),
      darkvision_feet: resolveActorDarkvisionFeet(
        draft.darkvision_feet,
        draft.npc_stats
      ),
      light_bright_feet: Math.max(0, Math.round(draft.light_bright_feet ?? 0)),
      light_dim_feet: Math.max(0, Math.round(draft.light_dim_feet ?? 0)),
      light_color: draft.light_color || '#F59E0B',
      portrait_url: portraitUrl,
      token_image_url: tokenImageUrl,
      token_appearance: tokenAppearance,
      npc_stats: enrichNpcStatsWithVisuals(
        {
          ...draft.npc_stats,
          __darkvision_feet: resolveActorDarkvisionFeet(
            draft.darkvision_feet,
            draft.npc_stats
          ),
          __assigned_user_id: assignedUserId,
          ...(draft.actor_kind === 'character'
            ? {
                __source_character_id: sourceCharId,
                ...(embeddedSheet ? { __character_sheet: embeddedSheet } : {}),
              }
            : {}),
        },
        portraitUrl,
        tokenImageUrl,
        tokenAppearance
      ),
      notes: draft.notes ?? '',
      sort_order: nextSort,
    });

    if (res.error || !res.actor) {
      if (!options?.silent) {
        this.notifications.error(
          'Unable to Add Actor',
          res.error ?? 'Unknown error.'
        );
      }
      return null;
    }

    this.rosterActors.update((curr) =>
      curr.some((a) => a.id === res.actor!.id) ? curr : [...curr, res.actor!]
    );
    if (!options?.silent) {
      this.notifications.success(
        'Added to Actors',
        `${res.actor.name} is ready in Actors.`
      );
    }
    return res.actor;
  }

  private async fetchSourceCharacterFresh(
    characterId: string
  ): Promise<CharacterModel | null> {
    if (!characterId) return null;
    if (typeof this.characterService.fetchCharacterById === 'function') {
      try {
        const res = await this.characterService.fetchCharacterById(characterId);
        if (res?.data) {
          const fresh = normalizeCharacterRecord(res.data);
          this.allCharacters.update((curr) =>
            curr.some((c) => c.id === fresh.id)
              ? curr.map((c) => (c.id === fresh.id ? fresh : c))
              : [...curr, fresh]
          );
          return fresh;
        }
      } catch {
        return (
          this.characterStore.getCharacterById(characterId) ??
          this.allCharacters().find((c) => c.id === characterId) ??
          null
        );
      }
    }
    return (
      this.characterStore.getCharacterById(characterId) ??
      this.allCharacters().find((c) => c.id === characterId) ??
      null
    );
  }

  async importCharacterToRoster(
    character: CharacterModel,
    folderId: string | null = null,
    options?: { silent?: boolean }
  ): Promise<VttRosterActorModel | null> {
    if (!this.isGm()) return null;
    const existing = this.rosterActors().find(
      (a) =>
        a.actor_kind !== 'npc' &&
        resolveRosterActorSourceCharacterId(a) === character.id
    );
    if (existing) {
      if (folderId !== null && folderId !== existing.folder_id) {
        await this.updateRosterActor(existing.id, { folder_id: folderId });
      }
      if (!options?.silent) {
        this.notifications.info(
          'Already in Actors',
          `${character.name} is already loaded in Actors. Use Re-import to copy fresh sheet changes.`
        );
      }
      return existing;
    }

    if (!this.allCharacters().some((c) => c.id === character.id)) {
      this.allCharacters.update((curr) => [...curr, character]);
    }

    const draft = buildActorTemplateFromCharacter(
      character,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      folderId,
      this.getArmorsForStats()
    );
    return this.createRosterActorFromScratch(draft, {
      silent: options?.silent,
    });
  }

  async reimportCharacterForActor(actorId: string): Promise<boolean> {
    return this.reimportRosterActorFromSource(actorId);
  }

  async reimportRosterActorFromSource(actorId: string): Promise<boolean> {
    const actor = this.rosterActors().find((a) => a.id === actorId);
    if (!actor || !this.canManageRosterActor(actor)) return false;

    if (actor.collection_actor_id) {
      if (typeof this.collectionsStore.loadCollections === 'function') {
        await this.collectionsStore.loadCollections(true);
      }
      const colActor =
        this.collectionsStore
          .actors()
          .find((c) => c.id === actor.collection_actor_id) ?? null;
      if (colActor) {
        const portraitUrl = resolveEntityPortraitUrl(colActor);
        const tokenImageUrl = resolveEntityTokenImageUrl(colActor);
        const tokenAppearance = resolveEntityTokenAppearance(colActor);
        const darkvisionFeet = resolveActorDarkvisionFeet(
          colActor.darkvision_feet,
          colActor.npc_stats
        );
        const existingSheet = this.resolveRosterActorCharacterSheet(actor);
        const clonedNpcStats = cloneDetachedNpcStats(colActor.npc_stats);
        if (
          colActor.actor_kind === 'character' &&
          clonedNpcStats.__character_sheet
        ) {
          const detachedId =
            existingSheet?.id &&
            existingSheet.id !== colActor.source_character_id
              ? existingSheet.id
              : makeDetachedVttCharacterId();
          clonedNpcStats.__character_sheet = cloneDetachedVttCharacterSheet(
            clonedNpcStats.__character_sheet,
            detachedId
          );
        }

        const ok = await this.updateRosterActor(actor.id, {
          character_id: null,
          actor_kind: colActor.actor_kind,
          is_unique: colActor.is_unique,
          name: colActor.name,
          faction: colActor.faction,
          size: colActor.size,
          icon: colActor.icon,
          color: colActor.color,
          max_hp: colActor.max_hp,
          max_sp: colActor.max_sp,
          max_ap: colActor.max_ap,
          armor_dr: colActor.armor_dr,
          shield_block: colActor.shield_block,
          move_feet: colActor.move_feet,
          vision_feet: colActor.vision_feet,
          darkvision_feet: darkvisionFeet,
          light_bright_feet: colActor.light_bright_feet,
          light_dim_feet: colActor.light_dim_feet,
          light_color: colActor.light_color,
          portrait_url: portraitUrl,
          token_image_url: tokenImageUrl,
          token_appearance: tokenAppearance,
          notes: colActor.notes ?? '',
          npc_stats: enrichNpcStatsWithVisuals(
            {
              ...clonedNpcStats,
              __darkvision_feet: darkvisionFeet,
              __assigned_user_id: this.getActorAssignedUserId(actor),
            },
            portraitUrl,
            tokenImageUrl,
            tokenAppearance
          ),
        });
        if (!ok) return false;

        const deployedTokens = this.tokens().filter(
          (t) => t.npc_stats?.__roster_actor_id === actor.id
        );
        for (const tok of deployedTokens) {
          await this.patchToken(tok.id, {
            current_hp: colActor.max_hp,
            current_sp: colActor.max_sp,
            current_ap: colActor.max_ap,
          });
        }

        this.notifications.success(
          'Actor Re-imported',
          `Copied the latest details from ${colActor.name} in Collections.`
        );
        return true;
      }
    }

    const sourceId = resolveRosterActorSourceCharacterId(actor);
    if (sourceId) {
      await this.compendiumStore.ensureLoaded();
      const freshChar = await this.fetchSourceCharacterFresh(sourceId);
      if (!freshChar) {
        this.notifications.error(
          'Unable to Re-import Character',
          'Could not find the original Character Sheet.'
        );
        return false;
      }

      const existingSheet = this.resolveRosterActorCharacterSheet(actor);
      const detachedId =
        existingSheet?.id && existingSheet.id !== sourceId
          ? existingSheet.id
          : makeDetachedVttCharacterId();

      const weapons = this.compendiumStore.allWeapons();
      const perkNodes = this.compendiumStore.allPerkNodes();
      const armors = this.getArmorsForStats();
      const stats = computeDerivedStats(freshChar, weapons, perkNodes, armors);
      const wepVis = stats.activeWeapon
        ? resolveWeaponVisuals(stats.activeWeapon)
        : { icon: actor.icon || 'greatsword', color: '#38B29A' };
      const reachFeet = stats.activeWeapon
        ? Math.max(5, Math.round((stats.activeWeapon.reach_tiles ?? 1) * 5))
        : 5;

      const portraitUrl = sanitizeOptionalImageUrl(freshChar.portrait_url);
      const tokenImageUrl = sanitizeOptionalImageUrl(freshChar.token_image_url);
      const tokenAppearance = normalizeTokenAppearance(
        freshChar.token_appearance
      );

      const sheetCopy = cloneDetachedVttCharacterSheet(
        {
          ...freshChar,
          current_hp: Math.max(
            0,
            Math.min(stats.maxHp, freshChar.current_hp ?? stats.maxHp)
          ),
          current_sp: Math.max(
            0,
            Math.min(stats.maxSp, freshChar.current_sp ?? stats.maxSp)
          ),
          current_ap: Math.max(0, Math.min(8, freshChar.current_ap ?? 4)),
        },
        detachedId
      );

      const normalizedInv = normalizeInventoryItems(sheetCopy.inventory);
      const prevCharId = actor.character_id;

      const ok = await this.updateRosterActor(actor.id, {
        character_id: null,
        actor_kind: 'character',
        is_unique: true,
        name: sheetCopy.name,
        icon: wepVis.icon,
        max_hp: stats.maxHp,
        max_sp: stats.maxSp,
        armor_dr: stats.armorDr,
        shield_block: stats.shieldBlockTotal,
        move_feet: stats.moveFeet,
        portrait_url: portraitUrl,
        token_image_url: tokenImageUrl,
        token_appearance: tokenAppearance,
        notes: sheetCopy.notes ?? '',
        npc_stats: enrichNpcStatsWithVisuals(
          {
            ...actor.npc_stats,
            weapon_name: stats.activeWeapon?.name ?? 'Unarmed',
            attack_ap: stats.activeWeapon?.ap_cost ?? 1,
            attack_mod: stats.attackRollMod,
            flat_damage: stats.flatWeaponDamage,
            reach_feet: reachFeet,
            parry_mod: stats.parryMod,
            dodge_mod: stats.dodgeMod,
            can_dodge: stats.canDodge,
            enables_martial_parry: stats.enablesMartialParry,
            __inventory: normalizedInv,
            __source_character_id: sourceId,
            __character_sheet: sheetCopy,
          },
          portraitUrl,
          tokenImageUrl,
          tokenAppearance
        ),
      });

      if (!ok) return false;

      const deployedTokens = this.tokens().filter(
        (t) =>
          t.npc_stats?.__roster_actor_id === actor.id ||
          Boolean(prevCharId && t.character_id === prevCharId)
      );
      for (const tok of deployedTokens) {
        await this.patchToken(tok.id, {
          character_id: null,
          name: sheetCopy.name,
          icon: wepVis.icon,
          max_hp: stats.maxHp,
          current_hp: sheetCopy.current_hp,
          max_sp: stats.maxSp,
          current_sp: sheetCopy.current_sp,
          current_ap: sheetCopy.current_ap,
          armor_dr: stats.armorDr,
          shield_block: stats.shieldBlockTotal,
          move_feet: stats.moveFeet,
          portrait_url: portraitUrl,
          token_image_url: tokenImageUrl,
          token_appearance: tokenAppearance,
          shield_raised: Boolean(
            sheetCopy.active_cooldowns?.['__shield_raised']
          ),
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __roster_actor_id: actor.id,
          },
        });
      }

      this.notifications.success(
        'Character Re-imported',
        `Copied the latest details from ${sheetCopy.name}'s Character Sheet.`
      );
      return true;
    }

    const presetId = actor.npc_stats?.__source_preset_id;
    if (presetId) {
      const preset = VTT_NPC_PRESETS.find((p) => p.id === presetId) ?? null;
      if (preset) {
        const draft = buildActorTemplateFromNpcPreset(preset, actor.folder_id);
        const darkvisionFeet = resolveActorDarkvisionFeet(
          draft.darkvision_feet,
          draft.npc_stats
        );
        const ok = await this.updateRosterActor(actor.id, {
          name: draft.name,
          faction: draft.faction,
          size: draft.size,
          icon: draft.icon,
          color: draft.color,
          max_hp: draft.max_hp,
          max_sp: draft.max_sp,
          max_ap: draft.max_ap,
          armor_dr: draft.armor_dr,
          shield_block: draft.shield_block,
          move_feet: draft.move_feet,
          vision_feet: draft.vision_feet,
          darkvision_feet: darkvisionFeet,
          light_bright_feet: draft.light_bright_feet,
          light_dim_feet: draft.light_dim_feet,
          light_color: draft.light_color,
          portrait_url: null,
          token_image_url: null,
          token_appearance: normalizeTokenAppearance(null),
          notes: draft.notes,
          npc_stats: {
            ...draft.npc_stats,
            __darkvision_feet: darkvisionFeet,
            __assigned_user_id: this.getActorAssignedUserId(actor),
          },
        });
        if (!ok) return false;

        const deployedTokens = this.tokens().filter(
          (t) => t.npc_stats?.__roster_actor_id === actor.id
        );
        for (const tok of deployedTokens) {
          await this.patchToken(tok.id, {
            current_hp: draft.max_hp,
            current_sp: draft.max_sp,
            current_ap: draft.max_ap,
          });
        }

        this.notifications.success(
          'NPC Re-imported',
          `Reset ${draft.name} from its Starter NPC template.`
        );
        return true;
      }
    }

    this.notifications.info(
      'No Linked Source Sheet',
      'This VTT actor was created from scratch and has no external template to re-import from.'
    );
    return false;
  }

  async importCharacterByUrlOrId(
    rawInput: string,
    folderId: string | null = null
  ): Promise<VttRosterActorModel | null> {
    if (!this.isGm()) return null;

    const parsedCollectionId = parseCollectionActorIdFromUrlOrInput(rawInput);
    if (parsedCollectionId) {
      if (typeof this.collectionsStore.loadCollections === 'function') {
        await this.collectionsStore.loadCollections(true);
      }
      const colActor =
        this.collectionsStore
          .actors()
          .find((c) => c.id === parsedCollectionId) ?? null;
      if (!colActor) {
        this.notifications.error(
          'Collection Actor Not Found',
          'Could not find an actor in your Collections matching that link.'
        );
        return null;
      }
      const existingCol = this.rosterActors().find(
        (a) => a.collection_actor_id === colActor.id
      );
      if (existingCol) {
        if (folderId !== null && folderId !== existingCol.folder_id) {
          await this.updateRosterActor(existingCol.id, { folder_id: folderId });
        }
        await this.reimportRosterActorFromSource(existingCol.id);
        return (
          this.rosterActors().find((a) => a.id === existingCol.id) ??
          existingCol
        );
      }
      return this.importCollectionActorToRoster(colActor, folderId);
    }

    const parsedId = parseCharacterIdFromUrlOrInput(rawInput);
    if (!parsedId) {
      this.notifications.error(
        'Invalid Import URL',
        'Paste a valid Character Sheet URL, Collections URL, or ID.'
      );
      return null;
    }

    await this.compendiumStore.ensureLoaded();
    const freshChar = await this.fetchSourceCharacterFresh(parsedId);
    if (!freshChar) {
      const colFallback =
        this.collectionsStore.actors().find((c) => c.id === parsedId) ?? null;
      if (colFallback) {
        const existingCol = this.rosterActors().find(
          (a) => a.collection_actor_id === colFallback.id
        );
        if (existingCol) {
          await this.reimportRosterActorFromSource(existingCol.id);
          return (
            this.rosterActors().find((a) => a.id === existingCol.id) ??
            existingCol
          );
        }
        return this.importCollectionActorToRoster(colFallback, folderId);
      }
      this.notifications.error(
        'Character Not Found',
        'Could not find a Character Sheet matching that link.'
      );
      return null;
    }

    const existing = this.rosterActors().find(
      (a) =>
        a.actor_kind !== 'npc' &&
        resolveRosterActorSourceCharacterId(a) === freshChar.id
    );
    if (existing) {
      if (folderId !== null && folderId !== existing.folder_id) {
        await this.updateRosterActor(existing.id, { folder_id: folderId });
      }
      await this.reimportRosterActorFromSource(existing.id);
      return this.rosterActors().find((a) => a.id === existing.id) ?? existing;
    }

    return this.importCharacterToRoster(freshChar, folderId);
  }

  async importCollectionActorToRoster(
    colActor: CollectionActorModel,
    folderId: string | null = null
  ): Promise<VttRosterActorModel | null> {
    if (!this.isGm()) return null;
    return this.createRosterActorFromScratch(
      {
        folder_id: folderId,
        source_character_id: colActor.source_character_id,
        actor_kind: colActor.actor_kind,
        is_unique: colActor.is_unique,
        name: colActor.name,
        faction: colActor.faction,
        size: colActor.size,
        icon: colActor.icon,
        color: colActor.color,
        max_hp: colActor.max_hp,
        max_sp: colActor.max_sp,
        max_ap: colActor.max_ap,
        armor_dr: colActor.armor_dr,
        shield_block: colActor.shield_block,
        move_feet: colActor.move_feet,
        vision_feet: colActor.vision_feet,
        darkvision_feet: resolveActorDarkvisionFeet(
          colActor.darkvision_feet,
          colActor.npc_stats
        ),
        light_bright_feet: colActor.light_bright_feet,
        light_dim_feet: colActor.light_dim_feet,
        light_color: colActor.light_color,
        portrait_url: resolveEntityPortraitUrl(colActor),
        token_image_url: resolveEntityTokenImageUrl(colActor),
        token_appearance: resolveEntityTokenAppearance(colActor),
        npc_stats: {
          ...cloneDetachedNpcStats(colActor.npc_stats),
          __assigned_user_id: null,
        },
        notes: colActor.notes,
      },
      {
        collectionActorId: colActor.id,
      }
    );
  }

  async importNpcPresetToRoster(
    preset: VttNpcPreset,
    folderId: string | null = null
  ): Promise<VttRosterActorModel | null> {
    if (!this.isGm()) return null;
    const draft = buildActorTemplateFromNpcPreset(preset, folderId);
    return this.createRosterActorFromScratch(draft);
  }

  async updateRosterActor(
    actorId: string,
    patch: Partial<VttRosterActorModel>
  ): Promise<boolean> {
    const camp = this.campaign();
    const target = this.rosterActors().find((a) => a.id === actorId);
    if (!camp || !target || !this.canManageRosterActor(target)) return false;

    const normalizedPatch: Partial<VttRosterActorModel> = { ...patch };
    const hasVisualPatch =
      patch.portrait_url !== undefined ||
      patch.token_image_url !== undefined ||
      patch.token_appearance !== undefined;
    if (patch.portrait_url !== undefined) {
      normalizedPatch.portrait_url = sanitizeOptionalImageUrl(
        patch.portrait_url
      );
    }
    if (patch.token_image_url !== undefined) {
      normalizedPatch.token_image_url = sanitizeOptionalImageUrl(
        patch.token_image_url
      );
    }
    if (patch.token_appearance !== undefined) {
      normalizedPatch.token_appearance = normalizeTokenAppearance(
        patch.token_appearance
      );
    }
    if (hasVisualPatch) {
      normalizedPatch.npc_stats = enrichNpcStatsWithVisuals(
        normalizedPatch.npc_stats ?? target.npc_stats,
        normalizedPatch.portrait_url !== undefined
          ? normalizedPatch.portrait_url
          : target.portrait_url,
        normalizedPatch.token_image_url !== undefined
          ? normalizedPatch.token_image_url
          : target.token_image_url,
        normalizedPatch.token_appearance !== undefined
          ? normalizedPatch.token_appearance
          : target.token_appearance
      );
    }

    this.rosterActors.update((curr) =>
      curr.map((a) => (a.id === actorId ? { ...a, ...normalizedPatch } : a))
    );

    const err = await this.vttService.updateRosterActor(
      camp.id,
      actorId,
      normalizedPatch
    );
    if (err) {
      this.notifications.error('Actor Update Error', err);
      return false;
    }

    const linkedTokens = this.tokens().filter(
      (t) =>
        t.npc_stats?.__roster_actor_id === actorId ||
        Boolean(target.character_id && t.character_id === target.character_id)
    );
    if (linkedTokens.length > 0) {
      const nextActorDisplayName = resolveActorTokenDisplayName({
        name: normalizedPatch.name ?? target.name,
        npc_stats: normalizedPatch.npc_stats ?? target.npc_stats,
      });
      const actorTokenNameChanged =
        normalizedPatch.name !== undefined ||
        (normalizedPatch.npc_stats !== undefined &&
          normalizedPatch.npc_stats.__token_name !==
            target.npc_stats?.__token_name);
      let needsFogSync = false;
      for (const tok of linkedTokens) {
        const tokenPatch: Partial<VttTokenModel> = {};
        if (actorTokenNameChanged && !tok.npc_stats?.__custom_token_name) {
          tokenPatch.name = nextActorDisplayName;
        }
        if (normalizedPatch.faction !== undefined) {
          tokenPatch.faction = normalizedPatch.faction;
        }
        if (normalizedPatch.size !== undefined) {
          tokenPatch.size = normalizedPatch.size;
        }
        if (normalizedPatch.icon !== undefined) {
          tokenPatch.icon = normalizedPatch.icon;
        }
        if (normalizedPatch.color !== undefined) {
          tokenPatch.color = normalizedPatch.color;
        }
        if (normalizedPatch.portrait_url !== undefined) {
          tokenPatch.portrait_url = normalizedPatch.portrait_url;
        }
        if (normalizedPatch.token_image_url !== undefined) {
          tokenPatch.token_image_url = normalizedPatch.token_image_url;
        }
        if (normalizedPatch.token_appearance !== undefined) {
          tokenPatch.token_appearance = normalizedPatch.token_appearance;
        }
        if (normalizedPatch.max_hp !== undefined) {
          tokenPatch.max_hp = normalizedPatch.max_hp;
          if (tok.current_hp > normalizedPatch.max_hp) {
            tokenPatch.current_hp = normalizedPatch.max_hp;
          }
        }
        if (normalizedPatch.max_sp !== undefined) {
          tokenPatch.max_sp = normalizedPatch.max_sp;
          if (tok.current_sp > normalizedPatch.max_sp) {
            tokenPatch.current_sp = normalizedPatch.max_sp;
          }
        }
        if (normalizedPatch.max_ap !== undefined) {
          tokenPatch.max_ap = normalizedPatch.max_ap;
          if (tok.current_ap > normalizedPatch.max_ap) {
            tokenPatch.current_ap = normalizedPatch.max_ap;
          }
        }
        if (normalizedPatch.armor_dr !== undefined) {
          tokenPatch.armor_dr = normalizedPatch.armor_dr;
        }
        if (normalizedPatch.shield_block !== undefined) {
          tokenPatch.shield_block = normalizedPatch.shield_block;
        }
        if (normalizedPatch.move_feet !== undefined) {
          tokenPatch.move_feet = normalizedPatch.move_feet;
          needsFogSync = true;
        }
        if (normalizedPatch.vision_feet !== undefined) {
          tokenPatch.vision_feet = normalizedPatch.vision_feet;
          needsFogSync = true;
        }
        if (normalizedPatch.darkvision_feet !== undefined) {
          tokenPatch.darkvision_feet = normalizedPatch.darkvision_feet;
          needsFogSync = true;
        }
        if (normalizedPatch.character_id === null && tok.character_id) {
          tokenPatch.character_id = null;
        }
        if (normalizedPatch.npc_stats !== undefined) {
          const { __character_sheet: _omitSheet, ...actorStatsForToken } =
            normalizedPatch.npc_stats;
          tokenPatch.npc_stats = {
            ...(tok.npc_stats ?? {}),
            ...actorStatsForToken,
            __roster_actor_id: actorId,
            ...(tok.npc_stats?.__world_x !== undefined
              ? { __world_x: tok.npc_stats.__world_x }
              : {}),
            ...(tok.npc_stats?.__world_y !== undefined
              ? { __world_y: tok.npc_stats.__world_y }
              : {}),
            ...(tok.npc_stats?.__unsnapped !== undefined
              ? { __unsnapped: tok.npc_stats.__unsnapped }
              : {}),
            ...(tok.npc_stats?.__flip_x !== undefined
              ? { __flip_x: tok.npc_stats.__flip_x }
              : {}),
            ...(tok.npc_stats?.__flip_y !== undefined
              ? { __flip_y: tok.npc_stats.__flip_y }
              : {}),
            ...(tok.npc_stats?.__z_index !== undefined
              ? { __z_index: tok.npc_stats.__z_index }
              : {}),
            ...(tok.npc_stats?.__rotation !== undefined
              ? { __rotation: tok.npc_stats.__rotation }
              : {}),
            ...(tok.npc_stats?.__custom_token_name !== undefined
              ? { __custom_token_name: tok.npc_stats.__custom_token_name }
              : {}),
          };
          delete tokenPatch.npc_stats.__character_sheet;
        }
        if (Object.keys(tokenPatch).length > 0) {
          await this.patchToken(tok.id, tokenPatch);
        }
      }
      if (needsFogSync) {
        this.syncExploredFogFromObservers();
      }
    }

    return true;
  }

  async duplicateRosterActor(
    actorId: string
  ): Promise<VttRosterActorModel | null> {
    const existing = this.rosterActors().find((a) => a.id === actorId);
    if (!existing || !this.isGm()) return null;

    const copyName = `${existing.name} (Copy)`;
    const existingSheet = this.resolveRosterActorCharacterSheet(existing);
    const clonedSheet = existingSheet
      ? cloneDetachedVttCharacterSheet({
          ...existingSheet,
          name: copyName,
        })
      : undefined;

    return this.createRosterActorFromScratch({
      folder_id: existing.folder_id,
      source_character_id: resolveRosterActorSourceCharacterId(existing),
      actor_kind: existing.actor_kind,
      is_unique: existing.is_unique,
      name: copyName,
      faction: existing.faction,
      size: existing.size,
      icon: existing.icon,
      color: existing.color,
      max_hp: existing.max_hp,
      max_sp: existing.max_sp,
      max_ap: existing.max_ap,
      armor_dr: existing.armor_dr,
      shield_block: existing.shield_block,
      move_feet: existing.move_feet,
      vision_feet: existing.vision_feet,
      darkvision_feet: resolveActorDarkvisionFeet(
        existing.darkvision_feet,
        existing.npc_stats
      ),
      light_bright_feet: existing.light_bright_feet,
      light_dim_feet: existing.light_dim_feet,
      light_color: existing.light_color,
      portrait_url: existing.portrait_url,
      token_image_url: existing.token_image_url,
      token_appearance: existing.token_appearance,
      npc_stats: {
        ...existing.npc_stats,
        __assigned_user_id: null,
        ...(clonedSheet ? { __character_sheet: clonedSheet } : {}),
      },
      notes: existing.notes,
    });
  }

  async moveRosterActorToFolder(
    actorId: string,
    folderId: string | null
  ): Promise<void> {
    if (!this.isGm()) return;
    const existing = this.rosterActors().find((a) => a.id === actorId);
    if (!existing || (existing.folder_id ?? null) === (folderId ?? null)) {
      return;
    }
    await this.updateRosterActor(actorId, { folder_id: folderId ?? null });
  }

  async deleteRosterActor(actorId: string): Promise<void> {
    const camp = this.campaign();
    const existing = this.rosterActors().find((a) => a.id === actorId);
    if (!camp || !existing || !this.isGm()) return;

    this.rosterActors.update((curr) => curr.filter((a) => a.id !== actorId));
    this.openSheetWindows.update((curr) =>
      curr.filter((e) => e.target.rosterActorId !== actorId)
    );
    this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
    if (this.openTokenizerTarget()?.rosterActorId === actorId) {
      this.openTokenizerTarget.set(null);
    }
    const err = await this.vttService.deleteRosterActor(camp.id, actorId);
    if (err) {
      this.notifications.error('Actor Delete Error', err);
    }
  }

  openActorSheet(actorId: string): void {
    const actor = this.rosterActors().find((a) => a.id === actorId);
    if (!actor || (!this.isGm() && !this.canDeployRosterActor(actor))) return;
    const hasSceneToken = this.sceneTokens().some(
      (t) =>
        t.npc_stats?.__roster_actor_id === actor.id ||
        (Boolean(actor.character_id) && t.character_id === actor.character_id)
    );
    if (!hasSceneToken) {
      this.clearTokenSelection();
    }
    const sheet = this.resolveRosterActorCharacterSheet(actor);
    const charId = sheet?.id ?? actor.character_id ?? null;
    this.selectedRosterActorId.set(actor.id);
    this.selectedCharacterId.set(charId);
    if (
      actor.character_id &&
      !actor.npc_stats?.__character_sheet &&
      !this.characterByIdMap().has(actor.character_id)
    ) {
      void this.characterStore.ensureCharacterLoaded(actor.character_id);
    }
    this.upsertOpenSheetWindow({
      rosterActorId: actor.id,
      characterId: charId,
      tokenId: null,
    });
  }

  openCharacterSheetInVtt(characterId: string): void {
    if (!characterId || !this.canEditCharacterInVtt(characterId)) return;
    const linkedActor =
      this.findRosterActorsForCharacterId(characterId)[0] ?? null;
    const sheet = linkedActor
      ? this.resolveRosterActorCharacterSheet(linkedActor)
      : null;
    const resolvedCharId = sheet?.id ?? characterId;
    const hasSceneToken = this.sceneTokens().some(
      (t) =>
        t.character_id === characterId ||
        t.character_id === resolvedCharId ||
        (Boolean(linkedActor) &&
          t.npc_stats?.__roster_actor_id === linkedActor?.id)
    );
    if (!hasSceneToken) {
      this.clearTokenSelection();
    }
    this.selectedRosterActorId.set(linkedActor?.id ?? null);
    this.selectedCharacterId.set(resolvedCharId);
    if (!sheet && !this.characterByIdMap().has(characterId)) {
      void this.characterStore.ensureCharacterLoaded(characterId);
    }
    this.upsertOpenSheetWindow({
      rosterActorId: linkedActor?.id ?? null,
      characterId: resolvedCharId,
      tokenId: null,
    });
  }

  openTokenSheet(tokenId: string): void {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || (!this.isGm() && !this.canControlToken(tok))) return;
    const linkedActor = this.resolveRosterActorForToken(tok);
    const sheet = this.resolveCharacterForToken(tok);
    const charId =
      sheet?.id ?? tok.character_id ?? linkedActor?.character_id ?? null;
    if (linkedActor) {
      this.selectedRosterActorId.set(linkedActor.id);
    }
    if (charId) {
      this.selectedCharacterId.set(charId);
      if (!sheet && tok.character_id && !this.characterByIdMap().has(tok.character_id)) {
        void this.characterStore.ensureCharacterLoaded(tok.character_id);
      }
    }
    this.upsertOpenSheetWindow({
      rosterActorId: linkedActor?.id ?? null,
      characterId: charId,
      tokenId: tok.id,
    });
  }

  closeActorSheet(key?: string): void {
    if (key) {
      this.closeSheetWindow(key);
      return;
    }
    for (const entry of this.openSheetWindows()) {
      releaseFloatingWindow(entry.windowId);
    }
    this.openSheetWindows.set([]);
    this.openSheetTarget.set(null);
  }

  canEditTarget(target: VttOpenSheetTarget | null): boolean {
    if (!target) return false;
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    if (!uid) return false;
    const actor = this.resolveTargetRosterActor(target);
    if (actor) {
      return this.getActorAssignedUserId(actor) === uid;
    }
    const tok = this.resolveTargetToken(target);
    if (tok) {
      return this.getTokenAssignedUserId(tok) === uid;
    }
    const char = this.resolveTargetCharacter(target);
    if (char) {
      return this.canEditCharacterInVtt(char.id);
    }
    return false;
  }

  canEditOpenSheet(): boolean {
    return this.canEditTarget(this.openSheetTarget());
  }

  canEditOpenTokenizer(): boolean {
    return this.canEditTarget(this.openTokenizerTarget());
  }

  openTokenizerStudio(target: VttOpenSheetTarget): void {
    if (!this.canEditTarget(target)) return;
    const actor = this.resolveTargetRosterActor(target);
    const tok = this.resolveTargetToken(target);
    const sheet =
      this.resolveRosterActorCharacterSheet(actor) ??
      this.resolveCharacterForToken(tok);
    const charId =
      target.characterId ??
      sheet?.id ??
      actor?.character_id ??
      tok?.character_id ??
      null;
    this.openTokenizerTarget.set({
      rosterActorId: target.rosterActorId ?? actor?.id ?? null,
      characterId: charId,
      tokenId: target.tokenId ?? null,
    });
    this.openTokenizerFocusTick.update((n) => n + 1);
  }

  openTokenizerFromOpenSheet(): void {
    const target = this.openSheetTarget();
    if (!target) return;
    this.openTokenizerStudio(target);
  }

  openTokenizerForActor(actorId: string): void {
    const actor = this.rosterActors().find((a) => a.id === actorId);
    if (!actor || (!this.isGm() && !this.canDeployRosterActor(actor))) return;
    const sheet = this.resolveRosterActorCharacterSheet(actor);
    this.openTokenizerStudio({
      rosterActorId: actor.id,
      characterId: sheet?.id ?? actor.character_id ?? null,
      tokenId: null,
    });
  }

  openTokenizerForToken(tokenId: string): void {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || (!this.isGm() && !this.canControlToken(tok))) return;
    const linkedActor = this.resolveRosterActorForToken(tok);
    const sheet = this.resolveCharacterForToken(tok);
    this.openTokenizerStudio({
      rosterActorId: linkedActor?.id ?? null,
      characterId:
        sheet?.id ?? tok.character_id ?? linkedActor?.character_id ?? null,
      tokenId: tok.id,
    });
  }

  closeTokenizerStudio(): void {
    this.openTokenizerTarget.set(null);
  }

  async updateTokenizerDisplayName(rawName: string): Promise<void> {
    if (!this.canEditOpenTokenizer()) return;
    const trimmed = rawName.trim();
    if (!trimmed) return;

    const tok = this.openTokenizerToken();
    const actor = this.openTokenizerRosterActor();
    const char = this.openTokenizerCharacter();
    const sheetBaseName = (char?.name || actor?.name || '').trim();
    const isUniqueActor = Boolean(
      actor && (actor.is_unique || actor.actor_kind === 'character')
    );

    if (tok) {
      if (actor && isUniqueActor) {
        const nextActorTokenName =
          sheetBaseName && trimmed !== sheetBaseName ? trimmed : null;
        await this.patchToken(tok.id, {
          name: trimmed,
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __token_name: nextActorTokenName,
            __custom_token_name: false,
          },
        });
        await this.updateRosterActor(actor.id, {
          npc_stats: {
            ...actor.npc_stats,
            __token_name: nextActorTokenName,
          },
        });
        return;
      }

      const actorDefaultName = actor
        ? resolveActorTokenDisplayName(actor, sheetBaseName)
        : sheetBaseName;
      const isCustom = Boolean(actorDefaultName && trimmed !== actorDefaultName);
      await this.patchToken(tok.id, {
        name: trimmed,
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __custom_token_name: isCustom,
        },
      });
      return;
    }

    if (actor) {
      const nextActorTokenName =
        sheetBaseName && trimmed !== sheetBaseName ? trimmed : null;
      await this.updateRosterActor(actor.id, {
        npc_stats: {
          ...actor.npc_stats,
          __token_name: nextActorTokenName,
        },
      });
      return;
    }

    if (char) {
      const charTokens = this.tokens().filter(
        (t) =>
          t.character_id === char.id ||
          this.resolveCharacterForToken(t)?.id === char.id
      );
      for (const ct of charTokens) {
        await this.patchToken(ct.id, {
          name: trimmed,
          npc_stats: {
            ...(ct.npc_stats ?? {}),
            __custom_token_name: trimmed !== char.name,
          },
        });
      }
    }
  }

  async resetTokenizerDisplayName(): Promise<void> {
    if (!this.canEditOpenTokenizer()) return;
    const tok = this.openTokenizerToken();
    const actor = this.openTokenizerRosterActor();
    const char = this.openTokenizerCharacter();
    const sheetBaseName = (char?.name || actor?.name || '').trim();
    if (!sheetBaseName) return;

    if (tok) {
      await this.patchToken(tok.id, {
        name: sheetBaseName,
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __token_name: null,
          __custom_token_name: false,
        },
      });
    }
    if (actor) {
      const isUniqueActor = actor.is_unique || actor.actor_kind === 'character';
      if (!tok || isUniqueActor) {
        await this.updateRosterActor(actor.id, {
          npc_stats: {
            ...actor.npc_stats,
            __token_name: null,
          },
        });
      }
    }
  }

  async createVttActorQuick(input: {
    name: string;
    actor_kind: VttActorKind;
    folder_id?: string | null;
    saveToCollections?: boolean;
  }): Promise<VttRosterActorModel | null> {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id ?? null;
    if (!camp || !uid || !this.isGm()) return null;

    const resolvedKind: VttActorKind = input.actor_kind;
    const trimmedName =
      input.name.trim() ||
      (resolvedKind === 'npc' ? 'New NPC' : 'New Player Character');

    await this.compendiumStore.ensureLoaded();

    if (resolvedKind === 'character') {
      const detachedCharId = makeDetachedVttCharacterId();
      const vttChar: CharacterModel = {
        id: detachedCharId,
        owner_id: uid,
        name: trimmedName,
        level: 1,
        attributes: {
          Brawn: 0,
          Agility: 0,
          Technique: 0,
          Iron: 0,
          Cunning: 0,
        },
        combat_skills: {
          Strike: 0,
          Shoot: 0,
          Parry: 0,
          Dodge: 0,
          Block: 0,
        },
        field_skills: {
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
        },
        current_hp: 10,
        current_sp: 5,
        current_ap: 4,
        equipped_armor: 'None',
        equipped_shield: 'None',
        weapon_slot_1_id: null,
        weapon_slot_2_id: null,
        active_weapon_slot: 1,
        unlocked_perk_ids: [],
        active_cooldowns: {},
        inventory: [],
        notes: '',
        portrait_url: null,
        token_image_url: null,
        token_appearance: normalizeTokenAppearance(undefined),
      };

      const draft = buildActorTemplateFromCharacter(
        vttChar,
        this.compendiumStore.allWeapons(),
        this.compendiumStore.allPerkNodes(),
        input.folder_id ?? null,
        this.getArmorsForStats()
      );
      draft.source_character_id = null;
      if (draft.npc_stats) {
        draft.npc_stats.__source_character_id = null;
        if (draft.npc_stats.__character_sheet) {
          draft.npc_stats.__character_sheet.id = detachedCharId;
        }
      }
      draft.notes = '';

      const actor = await this.createRosterActorFromScratch(draft, {
        saveToCollections: input.saveToCollections,
        silent: true,
      });
      if (!actor) {
        this.notifications.error(
          'Unable to Add Player Character',
          'Could not add Player Character to campaign Actors.'
        );
        return null;
      }

      this.notifications.success(
        'Player Character Created',
        `${actor.name} is ready. Configure their sheet anytime.`
      );
      this.openActorSheet(actor.id);
      return actor;
    }

    const npcDraft: ActorTemplateDraft = {
      folder_id: input.folder_id ?? null,
      source_character_id: null,
      actor_kind: 'npc',
      is_unique: false,
      name: trimmedName,
      faction: 'enemy',
      size: 1,
      icon: 'battleaxe',
      color: '#EF4444',
      max_hp: 8,
      max_sp: 4,
      max_ap: 4,
      armor_dr: 0,
      shield_block: 0,
      move_feet: 20,
      vision_feet: DEFAULT_VTT_DIM_VISION_FEET,
      darkvision_feet: DEFAULT_VTT_DARKVISION_FEET,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#F59E0B',
      npc_stats: {
        weapon_name: 'Unarmed',
        attack_ap: 1,
        attack_mod: 2,
        flat_damage: 3,
        reach_feet: 5,
        combat_tag: 'None',
        parry_mod: 1,
        dodge_mod: 1,
        can_dodge: true,
        enables_martial_parry: false,
        attributes: {
          Brawn: 0,
          Agility: 0,
          Technique: 0,
          Iron: 0,
          Cunning: 0,
        },
        combat_skills: {
          Strike: 0,
          Shoot: 0,
          Parry: 0,
          Dodge: 0,
          Block: 0,
        },
        field_skills: {
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
        },
        __darkvision_feet: DEFAULT_VTT_DARKVISION_FEET,
        __inventory: [],
      },
      notes: '',
    };

    const npcActor = await this.createRosterActorFromScratch(npcDraft, {
      saveToCollections: input.saveToCollections,
      silent: true,
    });
    if (!npcActor) {
      this.notifications.error(
        'Unable to Create NPC',
        'Could not create NPC in campaign Actors.'
      );
      return null;
    }

    this.notifications.success(
      'NPC Created',
      `${npcActor.name} is ready. Edit stats or deploy anytime.`
    );
    this.openActorSheet(npcActor.id);
    return npcActor;
  }

  async initializeLinkedCharacterForActor(
    actorId: string
  ): Promise<CharacterModel | null> {
    const actor = this.rosterActors().find((a) => a.id === actorId);
    if (!actor || !this.canManageRosterActor(actor)) return null;
    const existingSheet = this.resolveRosterActorCharacterSheet(actor);
    if (existingSheet) {
      return existingSheet;
    }

    await this.compendiumStore.ensureLoaded();
    const uid = this.authStore.user()?.id ?? '';
    const seededInventory = normalizeInventoryItems(
      actor.npc_stats?.__inventory
    );
    const portraitUrl = resolveEntityPortraitUrl(actor);
    const tokenImageUrl = resolveEntityTokenImageUrl(actor);
    const tokenAppearance = resolveEntityTokenAppearance(actor);
    const baseChar: CharacterModel = {
      id: makeDetachedVttCharacterId(),
      owner_id: uid,
      name: actor.name,
      level: 1,
      attributes: {
        Brawn: 0,
        Agility: 0,
        Technique: 0,
        Iron: 0,
        Cunning: 0,
      },
      combat_skills: {
        Strike: 0,
        Shoot: 0,
        Parry: 0,
        Dodge: 0,
        Block: 0,
      },
      field_skills: {
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
      },
      current_hp: 10,
      current_sp: 5,
      current_ap: 4,
      equipped_armor: 'None',
      equipped_shield: 'None',
      weapon_slot_1_id: null,
      weapon_slot_2_id: null,
      active_weapon_slot: 1,
      unlocked_perk_ids: [],
      active_cooldowns: {},
      inventory: seededInventory,
      notes: actor.notes ?? '',
      portrait_url: portraitUrl,
      token_image_url: tokenImageUrl,
      token_appearance: tokenAppearance,
    };
    const stats = computeDerivedStats(
      baseChar,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      this.getArmorsForStats()
    );
    const createdChar: CharacterModel = cloneDetachedVttCharacterSheet(
      {
        ...baseChar,
        current_hp: stats.maxHp,
        current_sp: stats.maxSp,
      },
      baseChar.id
    );

    await this.updateRosterActor(actor.id, {
      character_id: null,
      actor_kind: 'character',
      is_unique: true,
      max_hp: stats.maxHp,
      max_sp: stats.maxSp,
      armor_dr: stats.armorDr,
      shield_block: stats.shieldBlockTotal,
      move_feet: stats.moveFeet,
      npc_stats: enrichNpcStatsWithVisuals(
        {
          ...actor.npc_stats,
          __source_character_id: resolveRosterActorSourceCharacterId(actor),
          __character_sheet: createdChar,
        },
        portraitUrl,
        tokenImageUrl,
        tokenAppearance
      ),
    });
    const tick = ++this.nextSheetFocusTick;
    this.openSheetWindows.update((curr) =>
      curr.map((e) =>
        e.target.rosterActorId === actor.id
          ? {
              key: `actor:${actor.id}`,
              target: {
                rosterActorId: actor.id,
                characterId: createdChar.id,
                tokenId: e.target.tokenId,
              },
              focusTick: tick,
              windowId: e.windowId,
            }
          : e
      )
    );
    if (
      !this.openSheetWindows().some(
        (e) => e.target.rosterActorId === actor.id
      )
    ) {
      this.upsertOpenSheetWindow({
        rosterActorId: actor.id,
        characterId: createdChar.id,
        tokenId: this.openSheetTarget()?.tokenId ?? null,
      });
    } else {
      this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
    }
    if (this.openTokenizerTarget()?.rosterActorId === actor.id) {
      this.openTokenizerTarget.set({
        rosterActorId: actor.id,
        characterId: createdChar.id,
        tokenId: this.openTokenizerTarget()?.tokenId ?? null,
      });
    }
    return createdChar;
  }

  async updateCharacterFromVttSheet(
    characterId: string,
    mutator: (char: CharacterModel) => CharacterModel
  ): Promise<void> {
    if (!characterId || !this.canEditCharacterInVtt(characterId)) return;

    const linkedActors = this.findRosterActorsForCharacterId(characterId);
    const currentFromActor =
      linkedActors.length > 0
        ? this.resolveRosterActorCharacterSheet(linkedActors[0])
        : null;
    const currentFromToken =
      !currentFromActor
        ? (this.tokens()
            .map((t) => this.resolveCharacterForToken(t))
            .find((c) => c?.id === characterId) ?? null)
        : null;
    const fallbackStore = this.characterStore.getCharacterById(characterId);
    const current =
      currentFromActor ??
      currentFromToken ??
      this.characterByIdMap().get(characterId) ??
      (fallbackStore
        ? cloneDetachedVttCharacterSheet(fallbackStore, characterId)
        : null);
    if (!current) return;

    const weapons = this.compendiumStore.allWeapons();
    const perkNodes = this.compendiumStore.allPerkNodes();
    const armors = this.getArmorsForStats();
    const oldDerived = computeDerivedStats(current, weapons, perkNodes, armors);
    const mutated = mutator(cloneDetachedVttCharacterSheet(current, current.id));
    const nextDerived = computeDerivedStats(mutated, weapons, perkNodes, armors);

    const hpGrowth =
      mutated.current_hp === current.current_hp
        ? Math.max(0, nextDerived.maxHp - oldDerived.maxHp)
        : 0;
    const spGrowth =
      mutated.current_sp === current.current_sp
        ? Math.max(0, nextDerived.maxSp - oldDerived.maxSp)
        : 0;

    const normalizedInv = normalizeInventoryItems(mutated.inventory);
    const normalizedPortrait =
      mutated.portrait_url !== undefined
        ? sanitizeOptionalImageUrl(mutated.portrait_url)
        : sanitizeOptionalImageUrl(current.portrait_url);
    const normalizedTokenImg =
      mutated.token_image_url !== undefined
        ? sanitizeOptionalImageUrl(mutated.token_image_url)
        : sanitizeOptionalImageUrl(current.token_image_url);
    const normalizedAppearance =
      mutated.token_appearance !== undefined
        ? normalizeTokenAppearance(mutated.token_appearance)
        : normalizeTokenAppearance(current.token_appearance);

    const clamped: CharacterModel = cloneDetachedVttCharacterSheet(
      {
        ...mutated,
        id: current.id,
        name: mutated.name.trim() || current.name,
        current_hp: Math.max(
          0,
          Math.min(nextDerived.maxHp, mutated.current_hp + hpGrowth)
        ),
        current_sp: Math.max(
          0,
          Math.min(nextDerived.maxSp, mutated.current_sp + spGrowth)
        ),
        current_ap: Math.max(0, Math.min(8, mutated.current_ap ?? 4)),
        inventory: normalizedInv,
        notes: mutated.notes ?? current.notes ?? '',
        portrait_url: normalizedPortrait,
        token_image_url: normalizedTokenImg,
        token_appearance: normalizedAppearance,
      },
      current.id
    );

    const reachFeet = nextDerived.activeWeapon
      ? Math.max(5, Math.round((nextDerived.activeWeapon.reach_tiles ?? 1) * 5))
      : 5;

    const patchedTokenIds = new Set<string>();
    for (const actor of linkedActors) {
      const prevActorCharId = actor.character_id;
      const actorSheetId =
        this.resolveRosterActorCharacterSheet(actor)?.id ?? clamped.id;
      const actorSheetCopy = cloneDetachedVttCharacterSheet(
        clamped,
        actorSheetId
      );
      const nextIcon = nextDerived.activeWeapon
        ? resolveWeaponVisuals(nextDerived.activeWeapon).icon
        : actor.icon || 'greatsword';
      await this.updateRosterActor(actor.id, {
        character_id: null,
        name: actorSheetCopy.name,
        icon: nextIcon,
        max_hp: nextDerived.maxHp,
        max_sp: nextDerived.maxSp,
        armor_dr: nextDerived.armorDr,
        shield_block: nextDerived.shieldBlockTotal,
        move_feet: nextDerived.moveFeet,
        portrait_url: normalizedPortrait,
        token_image_url: normalizedTokenImg,
        token_appearance: normalizedAppearance,
        notes: actorSheetCopy.notes ?? actor.notes,
        npc_stats: enrichNpcStatsWithVisuals(
          {
            ...actor.npc_stats,
            weapon_name: nextDerived.activeWeapon?.name ?? 'Unarmed',
            attack_ap: nextDerived.activeWeapon?.ap_cost ?? 1,
            attack_mod: nextDerived.attackRollMod,
            flat_damage: nextDerived.flatWeaponDamage,
            reach_feet: reachFeet,
            parry_mod: nextDerived.parryMod,
            dodge_mod: nextDerived.dodgeMod,
            can_dodge: nextDerived.canDodge,
            enables_martial_parry: nextDerived.enablesMartialParry,
            __inventory: normalizedInv,
            __source_character_id: resolveRosterActorSourceCharacterId(actor),
            __character_sheet: actorSheetCopy,
          },
          normalizedPortrait,
          normalizedTokenImg,
          normalizedAppearance
        ),
      });

      const actorTokens = this.tokens().filter(
        (t) =>
          t.npc_stats?.__roster_actor_id === actor.id ||
          Boolean(prevActorCharId && t.character_id === prevActorCharId)
      );
      for (const tok of actorTokens) {
        patchedTokenIds.add(tok.id);
        const resolvedTokenName = tok.npc_stats?.__custom_token_name
          ? tok.name
          : resolveActorTokenDisplayName(
              { name: actorSheetCopy.name, npc_stats: actor.npc_stats },
              actorSheetCopy.name
            );
        await this.patchToken(tok.id, {
          character_id: null,
          name: resolvedTokenName,
          max_hp: nextDerived.maxHp,
          current_hp: actorSheetCopy.current_hp,
          max_sp: nextDerived.maxSp,
          current_sp: actorSheetCopy.current_sp,
          current_ap: actorSheetCopy.current_ap,
          armor_dr: nextDerived.armorDr,
          shield_block: nextDerived.shieldBlockTotal,
          move_feet: nextDerived.moveFeet,
          portrait_url: normalizedPortrait,
          token_image_url: normalizedTokenImg,
          token_appearance: normalizedAppearance,
          shield_raised: Boolean(
            actorSheetCopy.active_cooldowns?.['__shield_raised']
          ),
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __roster_actor_id: actor.id,
          },
        });
      }
    }

    const standaloneTokens = this.tokens().filter(
      (t) =>
        !patchedTokenIds.has(t.id) &&
        (t.character_id === characterId ||
          this.resolveCharacterForToken(t)?.id === characterId)
    );
    for (const tok of standaloneTokens) {
      await this.patchToken(tok.id, {
        character_id: null,
        name: tok.npc_stats?.__custom_token_name ? tok.name : clamped.name,
        max_hp: nextDerived.maxHp,
        current_hp: clamped.current_hp,
        max_sp: nextDerived.maxSp,
        current_sp: clamped.current_sp,
        current_ap: clamped.current_ap,
        armor_dr: nextDerived.armorDr,
        shield_block: nextDerived.shieldBlockTotal,
        move_feet: nextDerived.moveFeet,
        portrait_url: normalizedPortrait,
        token_image_url: normalizedTokenImg,
        token_appearance: normalizedAppearance,
        shield_raised: Boolean(clamped.active_cooldowns?.['__shield_raised']),
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __character_sheet: clamped,
        },
      });
    }
  }

  async updateNpcFromVttSheet(
    actorId: string | null,
    tokenId: string | null,
    patch: Partial<VttRosterActorModel>
  ): Promise<void> {
    if (actorId) {
      const existing = this.rosterActors().find((a) => a.id === actorId);
      if (!existing || !this.canManageRosterActor(existing)) return;
      const normalizedPatch: Partial<VttRosterActorModel> = { ...patch };
      if (normalizedPatch.darkvision_feet !== undefined) {
        normalizedPatch.npc_stats = {
          ...(normalizedPatch.npc_stats ?? existing.npc_stats),
          __darkvision_feet: normalizedPatch.darkvision_feet,
        };
      } else if (normalizedPatch.npc_stats !== undefined) {
        normalizedPatch.npc_stats = {
          ...existing.npc_stats,
          ...normalizedPatch.npc_stats,
        };
      }
      await this.updateRosterActor(actorId, normalizedPatch);
      return;
    }

    if (tokenId) {
      const tok = this.tokens().find((t) => t.id === tokenId);
      if (!tok || !this.canControlToken(tok)) return;
      const tokenPatch: Partial<VttTokenModel> = {};
      if (patch.name !== undefined) tokenPatch.name = patch.name;
      if (patch.faction !== undefined) tokenPatch.faction = patch.faction;
      if (patch.size !== undefined) tokenPatch.size = patch.size;
      if (patch.icon !== undefined) tokenPatch.icon = patch.icon;
      if (patch.color !== undefined) tokenPatch.color = patch.color;
      if (patch.portrait_url !== undefined) {
        tokenPatch.portrait_url = sanitizeOptionalImageUrl(patch.portrait_url);
      }
      if (patch.token_image_url !== undefined) {
        tokenPatch.token_image_url = sanitizeOptionalImageUrl(
          patch.token_image_url
        );
      }
      if (patch.token_appearance !== undefined) {
        tokenPatch.token_appearance = normalizeTokenAppearance(
          patch.token_appearance
        );
      }
      if (patch.max_hp !== undefined) {
        tokenPatch.max_hp = patch.max_hp;
        if (tok.current_hp > patch.max_hp) {
          tokenPatch.current_hp = patch.max_hp;
        }
      }
      if (patch.max_sp !== undefined) {
        tokenPatch.max_sp = patch.max_sp;
        if (tok.current_sp > patch.max_sp) {
          tokenPatch.current_sp = patch.max_sp;
        }
      }
      if (patch.max_ap !== undefined) {
        tokenPatch.max_ap = patch.max_ap;
        if (tok.current_ap > patch.max_ap) {
          tokenPatch.current_ap = patch.max_ap;
        }
      }
      if (patch.armor_dr !== undefined) tokenPatch.armor_dr = patch.armor_dr;
      if (patch.shield_block !== undefined) {
        tokenPatch.shield_block = patch.shield_block;
      }
      if (patch.move_feet !== undefined) tokenPatch.move_feet = patch.move_feet;
      if (patch.vision_feet !== undefined) {
        tokenPatch.vision_feet = patch.vision_feet;
      }
      if (patch.darkvision_feet !== undefined) {
        tokenPatch.darkvision_feet = patch.darkvision_feet;
      }
      if (
        patch.npc_stats !== undefined ||
        patch.darkvision_feet !== undefined ||
        patch.portrait_url !== undefined ||
        patch.token_image_url !== undefined ||
        patch.token_appearance !== undefined
      ) {
        tokenPatch.npc_stats = {
          ...(tok.npc_stats ?? {}),
          ...(patch.npc_stats ?? {}),
          ...(patch.darkvision_feet !== undefined
            ? { __darkvision_feet: patch.darkvision_feet }
            : {}),
          ...(patch.portrait_url !== undefined
            ? { __portrait_url: tokenPatch.portrait_url }
            : {}),
          ...(patch.token_image_url !== undefined
            ? { __token_image_url: tokenPatch.token_image_url }
            : {}),
          ...(patch.token_appearance !== undefined
            ? { __token_appearance: tokenPatch.token_appearance }
            : {}),
        };
      }
      await this.patchToken(tok.id, tokenPatch);
      if (
        patch.vision_feet !== undefined ||
        patch.darkvision_feet !== undefined ||
        patch.move_feet !== undefined
      ) {
        this.syncExploredFogFromObservers();
      }
    }
  }

  async rollActorSheetCheck(input: {
    speakerName: string;
    speakerColor?: string | null;
    speakerIcon?: string | null;
    speakerFaction?: VttFaction;
    speakerPortraitUrl?: string | null;
    speakerTokenImageUrl?: string | null;
    speakerTokenAppearance?: TokenAppearanceConfig;
    label: string;
    modifier: number;
    detail?: string;
  }): Promise<void> {
    const manual = this.manualRollOverride();
    const roll =
      manual !== null
        ? createManualRoll(manual, input.modifier)
        : roll2d10Check(input.modifier, this.attackRollMode());
    const built = buildPhysicalDiceFrom2d10Roll(roll);
    const fullLabel = `${input.speakerName} · ${input.label}`;
    const speakerVisualExtras: Record<string, unknown> = {
      ...(input.speakerColor ? { speaker_color: input.speakerColor } : {}),
      ...(input.speakerIcon ? { speaker_icon: input.speakerIcon } : {}),
      ...(input.speakerFaction
        ? { speaker_faction: input.speakerFaction }
        : {}),
      ...(input.speakerPortraitUrl
        ? { speaker_portrait_url: input.speakerPortraitUrl }
        : {}),
      ...(input.speakerTokenImageUrl
        ? { speaker_token_image_url: input.speakerTokenImageUrl }
        : {}),
      ...(input.speakerTokenAppearance
        ? { speaker_token_appearance: input.speakerTokenAppearance }
        : {}),
    };

    if (manual === null) {
      const diceThrow = this.createDiceThrowPayload({
        label: fullLabel,
        formula: built.formula,
        total: roll.total,
        dice: built.physicalDice,
        senderNameOverride: input.speakerName,
      });
      this.settingsStore.playUiCue('dice');
      this.enqueueDiceThrow(diceThrow, true);
      await this.postLog({
        kind: 'roll',
        title: `${fullLabel} (${built.formula}) → ${roll.total}`,
        detail: input.detail ?? null,
        senderNameOverride: input.speakerName,
        payload: {
          roll,
          chips: built.chips,
          formula: built.formula,
          modifier: input.modifier,
          total: roll.total,
          diceThrow,
          speaker_mode: 'character',
          ...speakerVisualExtras,
        },
      });
      return;
    }

    await this.postLog({
      kind: 'roll',
      title: `${fullLabel} (Manual) → ${roll.total}`,
      detail: input.detail ?? null,
      senderNameOverride: input.speakerName,
      payload: {
        roll,
        chips: built.chips,
        formula: 'Manual',
        modifier: input.modifier,
        total: roll.total,
        speaker_mode: 'character',
        ...speakerVisualExtras,
      },
    });
  }

  async saveRosterActorToCollections(
    actorId: string
  ): Promise<CollectionActorModel | null> {
    const existing = this.rosterActors().find((a) => a.id === actorId);
    if (!existing) return null;

    const saved = await this.collectionsStore.createActorFromScratch({
      folder_id: null,
      source_character_id: resolveRosterActorSourceCharacterId(existing),
      actor_kind: existing.actor_kind,
      is_unique: existing.is_unique,
      name: existing.name,
      faction: existing.faction,
      size: existing.size,
      icon: existing.icon,
      color: existing.color,
      max_hp: existing.max_hp,
      max_sp: existing.max_sp,
      max_ap: existing.max_ap,
      armor_dr: existing.armor_dr,
      shield_block: existing.shield_block,
      move_feet: existing.move_feet,
      vision_feet: existing.vision_feet,
      darkvision_feet: resolveActorDarkvisionFeet(
        existing.darkvision_feet,
        existing.npc_stats
      ),
      light_bright_feet: existing.light_bright_feet,
      light_dim_feet: existing.light_dim_feet,
      light_color: existing.light_color,
      portrait_url: existing.portrait_url,
      token_image_url: existing.token_image_url,
      token_appearance: existing.token_appearance,
      npc_stats: { ...existing.npc_stats },
      notes: existing.notes,
    });
    if (saved) {
      await this.updateRosterActor(actorId, { collection_actor_id: saved.id });
    }
    return saved;
  }

  async deployRosterActor(
    actorId: string,
    placement?: { worldPt: VttPoint; unsnapped: boolean }
  ): Promise<VttTokenModel | null> {
    const sc = this.activeScene();
    const actor = this.rosterActors().find((a) => a.id === actorId);
    if (!sc || !actor || !this.canDeployRosterActor(actor)) return null;

    const linkedChar = this.resolveRosterActorCharacterSheet(actor);

    let maxHp = actor.max_hp;
    let currentHp = actor.max_hp;
    let maxSp = actor.max_sp;
    let currentSp = actor.max_sp;
    let currentAp = actor.max_ap;
    let armorDr = actor.armor_dr;
    let shieldBlock = actor.shield_block;
    let moveFeet = actor.move_feet;
    let shieldRaised = false;

    if (linkedChar) {
      const stats = computeDerivedStats(
        linkedChar,
        this.compendiumStore.allWeapons(),
        this.compendiumStore.allPerkNodes(),
        this.getArmorsForStats()
      );
      maxHp = stats.maxHp;
      currentHp = Math.min(linkedChar.current_hp, stats.maxHp);
      maxSp = stats.maxSp;
      currentSp = Math.min(linkedChar.current_sp, stats.maxSp);
      currentAp = linkedChar.current_ap ?? actor.max_ap;
      armorDr = stats.armorDr;
      shieldBlock = stats.shieldBlockTotal;
      moveFeet = stats.moveFeet;
      shieldRaised = Boolean(linkedChar.active_cooldowns?.['__shield_raised']);
    }

    const baseDisplayName = resolveActorTokenDisplayName(
      actor,
      linkedChar?.name
    );
    let finalName = baseDisplayName;
    let numberedCopy = false;
    const numberCopies =
      actor.actor_kind === 'npc' && !actor.is_unique && !actor.character_id;
    if (numberCopies) {
      const sameBaseCount = this.sceneTokens().filter((t) =>
        t.name.startsWith(baseDisplayName)
      ).length;
      if (sameBaseCount > 0) {
        finalName = `${baseDisplayName} ${sameBaseCount + 1}`;
        numberedCopy = true;
      }
    }

    const assignedUserId = this.getActorAssignedUserId(actor);
    const spawn = this.resolveDropPlacement(actor.faction, placement);
    const axial = offsetToAxial(spawn.col, spawn.row);
    const topZ = this.getNextTopTokenZIndex();
    const portraitUrl = resolveEntityPortraitUrl(actor, linkedChar);
    const tokenImageUrl = resolveEntityTokenImageUrl(actor, linkedChar);
    const tokenAppearance = resolveEntityTokenAppearance(actor, linkedChar);
    const { __character_sheet: _omitSheet, ...actorStatsForToken } =
      actor.npc_stats ?? {};

    const res = await this.vttService.insertToken({
      encounter_id: sc.id,
      character_id: null,
      owner_id: assignedUserId,
      name: finalName,
      faction: actor.faction,
      x: spawn.col,
      y: spawn.row,
      q: axial.q,
      r: axial.r,
      world_x: spawn.world_x,
      world_y: spawn.world_y,
      size: Math.max(1, actor.size),
      icon: actor.icon || 'greatsword',
      color: actor.color || '#38B29A',
      current_hp: currentHp,
      max_hp: maxHp,
      current_sp: currentSp,
      max_sp: maxSp,
      current_ap: currentAp,
      max_ap: actor.max_ap,
      armor_dr: armorDr,
      shield_block: shieldBlock,
      move_feet: moveFeet,
      vision_feet: actor.vision_feet,
      darkvision_feet: resolveActorDarkvisionFeet(
        actor.darkvision_feet,
        actor.npc_stats
      ),
      light_bright_feet: actor.light_bright_feet,
      light_dim_feet: actor.light_dim_feet,
      light_color: actor.light_color || '#FF9B42',
      shield_raised: shieldRaised,
      is_hidden: false,
      statuses: [],
      portrait_url: portraitUrl,
      token_image_url: tokenImageUrl,
      token_appearance: tokenAppearance,
      npc_stats: enrichNpcStatsWithVisuals(
        {
          ...actorStatsForToken,
          __darkvision_feet: resolveActorDarkvisionFeet(
            actor.darkvision_feet,
            actor.npc_stats
          ),
          __assigned_user_id: assignedUserId,
          __roster_actor_id: actor.id,
          __unsnapped: spawn.unsnappedOnGrid,
          __z_index: topZ,
          ...(numberedCopy ? { __custom_token_name: true } : {}),
        },
        portraitUrl,
        tokenImageUrl,
        tokenAppearance
      ),
    });

    if (res.error || !res.token) {
      this.notifications.error(
        'Unable to Deploy Actor',
        res.error ?? 'Unknown error.'
      );
      return null;
    }

    const prevFog = cloneExploredFog(sc.explored_fog);
    this.tokens.update((curr) =>
      curr.some((t) => t.id === res.token!.id) ? curr : [...curr, res.token!]
    );
    this.selectedTokenId.set(res.token.id);
    this.pushUndoEntry(sc.id, `Deploy ${res.token.name}`, {
      kind: 'token_spawned',
      tokenId: res.token.id,
      previousExploredFog: prevFog,
    });
    this.syncExploredFogFromObservers();
    return res.token;
  }

  async dropActorAtWorldPoint(
    payload: VttRosterDragPayload,
    worldPt: VttPoint,
    unsnapped: boolean
  ): Promise<void> {
    this.draggingRosterPayload.set(null);

    if (payload.kind === 'roster-actor' && payload.actorId) {
      await this.deployRosterActor(payload.actorId, { worldPt, unsnapped });
      return;
    }

    if (payload.kind === 'character' && payload.characterId) {
      const char =
        this.allCharacters().find((c) => c.id === payload.characterId) ??
        this.characterStore
          .characters()
          .find((c) => c.id === payload.characterId);
      if (char) {
        await this.deployCharacterToken(char, { worldPt, unsnapped });
      }
    }
  }

  async spawnNpcPreset(
    preset: VttNpcPreset,
    customName?: string
  ): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    const sameBaseCount = this.sceneTokens().filter((t) =>
      t.name.startsWith(customName?.trim() || preset.name)
    ).length;
    const finalName =
      customName?.trim() ||
      (sameBaseCount > 0 ? `${preset.name} ${sameBaseCount + 1}` : preset.name);

    const spawn = this.findOpenSpawnLocation(preset.faction);
    const axial = offsetToAxial(spawn.col, spawn.row);
    const resolvedDarkvision = resolveActorDarkvisionFeet(
      preset.darkvision_feet,
      preset.npc_stats
    );

    const res = await this.vttService.insertToken({
      encounter_id: sc.id,
      character_id: null,
      owner_id: null,
      name: finalName,
      faction: preset.faction,
      x: spawn.col,
      y: spawn.row,
      q: axial.q,
      r: axial.r,
      world_x: spawn.world_x,
      world_y: spawn.world_y,
      size: 1,
      icon: preset.icon,
      color: preset.color,
      current_hp: preset.max_hp,
      max_hp: preset.max_hp,
      current_sp: preset.max_sp,
      max_sp: preset.max_sp,
      current_ap: preset.max_ap,
      max_ap: preset.max_ap,
      armor_dr: preset.armor_dr,
      shield_block: preset.shield_block,
      move_feet: preset.move_feet,
      vision_feet: preset.vision_feet,
      darkvision_feet: resolvedDarkvision,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: {
        ...preset.npc_stats,
        __darkvision_feet: resolvedDarkvision,
        __assigned_user_id: null,
        __z_index: this.getNextTopTokenZIndex(),
      },
    });

    if (res.error || !res.token) {
      this.notifications.error(
        'Unable to Spawn NPC',
        res.error ?? 'Unknown error.'
      );
      return;
    }

    const prevFog = cloneExploredFog(sc.explored_fog);
    this.tokens.update((curr) =>
      curr.some((t) => t.id === res.token!.id) ? curr : [...curr, res.token!]
    );
    this.selectedTokenId.set(res.token.id);
    this.pushUndoEntry(sc.id, `Spawn ${res.token.name}`, {
      kind: 'token_spawned',
      tokenId: res.token.id,
      previousExploredFog: prevFog,
    });
    this.syncExploredFogFromObservers();
  }

  async recordablePatchToken(
    tokenId: string,
    patch: Partial<VttTokenModel>,
    label: string
  ): Promise<void> {
    const existing = this.tokens().find((t) => t.id === tokenId);
    if (!existing) return;

    const previousTokenPatch: Partial<VttTokenModel> = {};
    let hasChange = false;
    for (const key of Object.keys(patch) as (keyof VttTokenModel)[]) {
      const nextVal = patch[key];
      const prevVal = existing[key];
      if (nextVal !== prevVal) {
        hasChange = true;
        if (Array.isArray(prevVal)) {
          (previousTokenPatch as Record<string, unknown>)[key] = [...prevVal];
        } else if (prevVal && typeof prevVal === 'object') {
          (previousTokenPatch as Record<string, unknown>)[key] = {
            ...(prevVal as Record<string, unknown>),
          };
        } else {
          (previousTokenPatch as Record<string, unknown>)[key] = prevVal;
        }
      }
    }
    if (!hasChange) return;

    const affectsVisibility =
      patch.light_bright_feet !== undefined ||
      patch.light_dim_feet !== undefined ||
      patch.vision_feet !== undefined ||
      patch.darkvision_feet !== undefined ||
      patch.is_hidden !== undefined;
    const sc = this.scenes().find((s) => s.id === existing.encounter_id);
    const prevFog =
      affectsVisibility && sc ? cloneExploredFog(sc.explored_fog) : undefined;

    this.pushUndoEntry(existing.encounter_id, label, {
      kind: 'token_patch',
      tokenId: existing.id,
      previousTokenPatch,
      previousExploredFog: prevFog,
    });

    await this.patchToken(tokenId, patch);
    if (affectsVisibility) {
      this.syncExploredFogFromObservers();
    }
  }

  async recordablePatchTokensBatch(
    entries: readonly { tokenId: string; patch: Partial<VttTokenModel> }[],
    label: string
  ): Promise<void> {
    if (entries.length === 0) return;
    if (entries.length === 1) {
      await this.recordablePatchToken(
        entries[0].tokenId,
        entries[0].patch,
        label
      );
      return;
    }

    const undoPatches: {
      tokenId: string;
      previousTokenPatch: Partial<VttTokenModel>;
    }[] = [];
    const toApply: {
      tok: VttTokenModel;
      patch: Partial<VttTokenModel>;
    }[] = [];
    let affectsVisibility = false;

    for (const entry of entries) {
      const existing = this.tokens().find((t) => t.id === entry.tokenId);
      if (!existing || !this.canControlToken(existing)) continue;

      const previousTokenPatch: Partial<VttTokenModel> = {};
      let hasChange = false;
      for (const key of Object.keys(entry.patch) as (keyof VttTokenModel)[]) {
        const nextVal = entry.patch[key];
        const prevVal = existing[key];
        if (nextVal !== prevVal) {
          hasChange = true;
          if (Array.isArray(prevVal)) {
            (previousTokenPatch as Record<string, unknown>)[key] = [...prevVal];
          } else if (prevVal && typeof prevVal === 'object') {
            (previousTokenPatch as Record<string, unknown>)[key] = {
              ...(prevVal as Record<string, unknown>),
            };
          } else {
            (previousTokenPatch as Record<string, unknown>)[key] = prevVal;
          }
        }
      }
      if (!hasChange) continue;

      if (
        entry.patch.light_bright_feet !== undefined ||
        entry.patch.light_dim_feet !== undefined ||
        entry.patch.vision_feet !== undefined ||
        entry.patch.darkvision_feet !== undefined ||
        entry.patch.is_hidden !== undefined
      ) {
        affectsVisibility = true;
      }

      undoPatches.push({ tokenId: existing.id, previousTokenPatch });
      toApply.push({ tok: existing, patch: entry.patch });
    }

    if (toApply.length === 0) return;
    if (toApply.length === 1) {
      await this.recordablePatchToken(
        toApply[0].tok.id,
        toApply[0].patch,
        label
      );
      return;
    }

    const sceneId = toApply[0].tok.encounter_id;
    const sc = this.scenes().find((s) => s.id === sceneId);
    const prevFog =
      affectsVisibility && sc ? cloneExploredFog(sc.explored_fog) : undefined;

    this.pushUndoEntry(sceneId, label, {
      kind: 'tokens_batch',
      patches: undoPatches,
      previousExploredFog: prevFog,
      selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
    });

    await Promise.all(
      toApply.map(({ tok, patch }) => this.patchToken(tok.id, patch))
    );
    if (affectsVisibility) {
      this.syncExploredFogFromObservers();
    }
  }

  async patchToken(
    tokenId: string,
    patch: Partial<VttTokenModel>
  ): Promise<void> {
    const existing = this.tokens().find((t) => t.id === tokenId);
    if (!existing) return;

    this.tokens.update((curr) =>
      curr.map((t) => (t.id === tokenId ? { ...t, ...patch } : t))
    );

    const err = await this.vttService.updateToken(
      tokenId,
      patch,
      this.needsMigration(),
      existing
    );
    if (err) {
      this.notifications.error('Token Sync Error', err);
      return;
    }

    const tokenSheet = this.resolveCharacterForToken(existing);
    if (
      tokenSheet &&
      (patch.current_hp !== undefined ||
        patch.current_sp !== undefined ||
        patch.current_ap !== undefined ||
        patch.shield_raised !== undefined)
    ) {
      await this.syncTokenVitalsToCharacter(existing, tokenSheet, patch);
    }
  }

  private async persistDetachedSheetOnActorForToken(
    token: VttTokenModel,
    updatedSheet: CharacterModel,
    extraActorPatch?: Partial<VttRosterActorModel>
  ): Promise<void> {
    const camp = this.campaign();
    const linkedActor = this.resolveRosterActorForToken(token);
    if (linkedActor && camp && this.canManageRosterActor(linkedActor)) {
      const actorSheetId =
        this.resolveRosterActorCharacterSheet(linkedActor)?.id ??
        updatedSheet.id;
      const sheetCopy = cloneDetachedVttCharacterSheet(
        updatedSheet,
        actorSheetId
      );
      const actorPatch: Partial<VttRosterActorModel> = {
        ...extraActorPatch,
        character_id: null,
        npc_stats: {
          ...(linkedActor.npc_stats ?? {}),
          ...(extraActorPatch?.npc_stats ?? {}),
          __source_character_id: resolveRosterActorSourceCharacterId(linkedActor),
          __character_sheet: sheetCopy,
        },
      };
      this.rosterActors.update((curr) =>
        curr.map((a) =>
          a.id === linkedActor.id ? { ...a, ...actorPatch } : a
        )
      );
      await this.vttService.updateRosterActor(
        camp.id,
        linkedActor.id,
        actorPatch
      );
      return;
    }

    if (token.npc_stats?.__character_sheet || token.character_id) {
      const sheetCopy = cloneDetachedVttCharacterSheet(
        updatedSheet,
        updatedSheet.id
      );
      const tokStatsPatch: Partial<VttTokenModel> = {
        character_id: null,
        npc_stats: {
          ...(token.npc_stats ?? {}),
          __character_sheet: sheetCopy,
        },
      };
      this.tokens.update((curr) =>
        curr.map((t) => (t.id === token.id ? { ...t, ...tokStatsPatch } : t))
      );
      await this.vttService.updateToken(
        token.id,
        tokStatsPatch,
        this.needsMigration(),
        token
      );
    }
  }

  private async syncTokenVitalsToCharacter(
    token: VttTokenModel,
    char: CharacterModel,
    patch: Partial<VttTokenModel>
  ): Promise<void> {
    if (!this.canEditCharacterInVtt(char.id) && !this.canControlToken(token)) {
      return;
    }

    const prevShieldRaised = Boolean(
      char.active_cooldowns?.['__shield_raised']
    );
    const nextShieldRaised =
      patch.shield_raised !== undefined
        ? Boolean(patch.shield_raised)
        : prevShieldRaised;
    const nextHp =
      patch.current_hp !== undefined ? patch.current_hp : char.current_hp;
    const nextSp =
      patch.current_sp !== undefined ? patch.current_sp : char.current_sp;
    const nextAp =
      patch.current_ap !== undefined ? patch.current_ap : char.current_ap;

    if (
      nextHp === char.current_hp &&
      nextSp === char.current_sp &&
      nextAp === char.current_ap &&
      nextShieldRaised === prevShieldRaised
    ) {
      return;
    }

    const nextCooldowns = { ...(char.active_cooldowns ?? {}) };
    if (patch.shield_raised !== undefined) {
      if (patch.shield_raised) {
        nextCooldowns['__shield_raised'] = 1;
      } else {
        delete nextCooldowns['__shield_raised'];
      }
    }

    const updated: CharacterModel = cloneDetachedVttCharacterSheet(
      {
        ...char,
        current_hp: nextHp,
        current_sp: nextSp,
        current_ap: nextAp,
        active_cooldowns: nextCooldowns,
      },
      char.id
    );

    await this.persistDetachedSheetOnActorForToken(token, updated);
  }

  async moveTokenToHex(
    tokenId: string,
    col: number,
    row: number,
    distanceFeet: number,
    freeOverride = false,
    intermediateHexes?: HexCoord[]
  ): Promise<void> {
    const tok = this.sceneTokens().find((t) => t.id === tokenId);
    const sc = this.activeScene();
    if (!tok || !sc || !this.canControlToken(tok)) return;

    const geom = this.gridGeometry();
    const clamped = clampHexToBounds(
      { col, row },
      geom.gridWidth,
      geom.gridHeight
    );
    const hasWaypoints = Boolean(
      intermediateHexes && intermediateHexes.length > 0
    );
    if (
      !hasWaypoints &&
      clamped.col === tok.x &&
      clamped.row === tok.y &&
      (tok.world_x === null || tok.world_x === undefined) &&
      !tok.npc_stats?.__unsnapped
    ) {
      return;
    }

    const prevFog = cloneExploredFog(sc.explored_fog);
    const previousTokenPatch: Partial<VttTokenModel> = {
      x: tok.x,
      y: tok.y,
      q: tok.q,
      r: tok.r,
      world_x: tok.world_x,
      world_y: tok.world_y,
      current_ap: tok.current_ap,
      npc_stats: { ...tok.npc_stats },
    };

    const axial = offsetToAxial(clamped.col, clamped.row);
    const patch: Partial<VttTokenModel> = {
      x: clamped.col,
      y: clamped.row,
      q: axial.q,
      r: axial.r,
      world_x: null,
      world_y: null,
      ...(tok.npc_stats?.__unsnapped
        ? { npc_stats: { ...tok.npc_stats, __unsnapped: false } }
        : {}),
    };

    if (
      sc.combat_active &&
      this.enforceApOnMove() &&
      !freeOverride &&
      distanceFeet > 0
    ) {
      const moveActionsNeeded = Math.max(
        1,
        Math.ceil(distanceFeet / Math.max(5, tok.move_feet))
      );
      patch.current_ap = Math.max(0, tok.current_ap - moveActionsNeeded);
    }

    const roundedFeet = Math.round(distanceFeet);
    const moveLabel = hasWaypoints
      ? `Chained Move ${tok.name} (${roundedFeet} ft)`
      : roundedFeet > 0
        ? `Move ${tok.name} (${roundedFeet} ft)`
        : `Move ${tok.name}`;

    this.pushUndoEntry(sc.id, moveLabel, {
      kind: 'token_patch',
      tokenId: tok.id,
      previousTokenPatch,
      previousExploredFog: prevFog,
    });

    await this.patchToken(tokenId, patch);
    if (hasWaypoints && intermediateHexes) {
      this.syncExploredFogAlongTokenWaypoints(
        tokenId,
        intermediateHexes.map((h) => {
          const ch = clampHexToBounds(h, geom.gridWidth, geom.gridHeight);
          return {
            col: ch.col,
            row: ch.row,
            world_x: null,
            world_y: null,
          };
        })
      );
    } else {
      this.syncExploredFogFromObservers();
    }
  }

  async moveTokenToWorldPoint(
    tokenId: string,
    worldPt: VttPoint,
    distanceFeet: number,
    freeOverride = false,
    worldBoundsOverride?: { width: number; height: number },
    intermediateWorldPts?: VttPoint[]
  ): Promise<void> {
    const tok = this.sceneTokens().find((t) => t.id === tokenId);
    const sc = this.activeScene();
    if (!tok || !sc || !this.canControlToken(tok)) return;

    const layout = this.sceneLayout();
    const geom = layout.geometry;
    const bounds = worldBoundsOverride ?? {
      width: layout.totalWidth,
      height: layout.totalHeight,
    };
    const clampedWorld = clampWorldPointToBounds(worldPt, bounds);
    const nearestHex = clampHexToBounds(
      worldPointToHex(clampedWorld, geom),
      geom.gridWidth,
      geom.gridHeight
    );
    const hasWaypoints = Boolean(
      intermediateWorldPts && intermediateWorldPts.length > 0
    );

    const unsnappedOnGrid = sc.grid_mode !== 'gridless';

    if (
      !hasWaypoints &&
      tok.world_x === clampedWorld.x &&
      tok.world_y === clampedWorld.y &&
      tok.x === nearestHex.col &&
      tok.y === nearestHex.row &&
      Boolean(tok.npc_stats?.__unsnapped) === unsnappedOnGrid
    ) {
      return;
    }

    const prevFog = cloneExploredFog(sc.explored_fog);
    const previousTokenPatch: Partial<VttTokenModel> = {
      x: tok.x,
      y: tok.y,
      q: tok.q,
      r: tok.r,
      world_x: tok.world_x,
      world_y: tok.world_y,
      current_ap: tok.current_ap,
      npc_stats: { ...tok.npc_stats },
    };

    const axial = offsetToAxial(nearestHex.col, nearestHex.row);
    const patch: Partial<VttTokenModel> = {
      x: nearestHex.col,
      y: nearestHex.row,
      q: axial.q,
      r: axial.r,
      world_x: clampedWorld.x,
      world_y: clampedWorld.y,
      ...(unsnappedOnGrid
        ? { npc_stats: { ...tok.npc_stats, __unsnapped: true } }
        : {}),
    };

    if (
      sc.combat_active &&
      this.enforceApOnMove() &&
      !freeOverride &&
      distanceFeet > 0
    ) {
      const moveActionsNeeded = Math.max(
        1,
        Math.ceil(distanceFeet / Math.max(5, tok.move_feet))
      );
      patch.current_ap = Math.max(0, tok.current_ap - moveActionsNeeded);
    }

    const roundedFeet = Math.round(distanceFeet);
    const moveLabel = hasWaypoints
      ? `Chained Move ${tok.name} (${roundedFeet} ft)`
      : roundedFeet > 0
        ? `Move ${tok.name} (${roundedFeet} ft)`
        : `Move ${tok.name}`;

    this.pushUndoEntry(sc.id, moveLabel, {
      kind: 'token_patch',
      tokenId: tok.id,
      previousTokenPatch,
      previousExploredFog: prevFog,
    });

    await this.patchToken(tokenId, patch);
    if (hasWaypoints && intermediateWorldPts) {
      this.syncExploredFogAlongTokenWaypoints(
        tokenId,
        intermediateWorldPts.map((pt) => {
          const cw = clampWorldPointToBounds(pt, bounds);
          const sh = clampHexToBounds(
            worldPointToHex(cw, geom),
            geom.gridWidth,
            geom.gridHeight
          );
          return {
            col: sh.col,
            row: sh.row,
            world_x: cw.x,
            world_y: cw.y,
          };
        })
      );
    } else {
      this.syncExploredFogFromObservers();
    }
  }

  async moveTokensBatch(
    moves: readonly BatchTokenMoveInput[],
    worldBoundsOverride?: { width: number; height: number }
  ): Promise<void> {
    if (moves.length === 0) return;
    if (moves.length === 1) {
      const single = moves[0];
      if (single.targetWorld) {
        await this.moveTokenToWorldPoint(
          single.tokenId,
          single.targetWorld,
          single.distanceFeet,
          Boolean(single.freeOverride),
          worldBoundsOverride
        );
      } else if (single.targetHex) {
        await this.moveTokenToHex(
          single.tokenId,
          single.targetHex.col,
          single.targetHex.row,
          single.distanceFeet,
          Boolean(single.freeOverride)
        );
      }
      return;
    }

    const sc = this.activeScene();
    if (!sc) return;

    const layout = this.sceneLayout();
    const geom = layout.geometry;
    const bounds = worldBoundsOverride ?? {
      width: layout.totalWidth,
      height: layout.totalHeight,
    };
    const unsnappedOnGrid = sc.grid_mode !== 'gridless';

    const undoPatches: {
      tokenId: string;
      previousTokenPatch: Partial<VttTokenModel>;
    }[] = [];
    const forwardPatches: {
      tokenId: string;
      patch: Partial<VttTokenModel>;
    }[] = [];

    for (const item of moves) {
      const tok = this.sceneTokens().find((t) => t.id === item.tokenId);
      if (!tok || !this.canControlToken(tok)) continue;

      if (item.targetWorld) {
        const clampedWorld = clampWorldPointToBounds(item.targetWorld, bounds);
        const nearestHex = clampHexToBounds(
          worldPointToHex(clampedWorld, geom),
          geom.gridWidth,
          geom.gridHeight
        );
        if (
          tok.world_x === clampedWorld.x &&
          tok.world_y === clampedWorld.y &&
          tok.x === nearestHex.col &&
          tok.y === nearestHex.row &&
          Boolean(tok.npc_stats?.__unsnapped) === unsnappedOnGrid
        ) {
          continue;
        }

        const axial = offsetToAxial(nearestHex.col, nearestHex.row);
        const patch: Partial<VttTokenModel> = {
          x: nearestHex.col,
          y: nearestHex.row,
          q: axial.q,
          r: axial.r,
          world_x: clampedWorld.x,
          world_y: clampedWorld.y,
          ...(unsnappedOnGrid
            ? { npc_stats: { ...tok.npc_stats, __unsnapped: true } }
            : {}),
        };

        if (
          sc.combat_active &&
          this.enforceApOnMove() &&
          !item.freeOverride &&
          item.distanceFeet > 0
        ) {
          const moveActionsNeeded = Math.max(
            1,
            Math.ceil(item.distanceFeet / Math.max(5, tok.move_feet))
          );
          patch.current_ap = Math.max(0, tok.current_ap - moveActionsNeeded);
        }

        undoPatches.push({
          tokenId: tok.id,
          previousTokenPatch: {
            x: tok.x,
            y: tok.y,
            q: tok.q,
            r: tok.r,
            world_x: tok.world_x,
            world_y: tok.world_y,
            current_ap: tok.current_ap,
            npc_stats: { ...tok.npc_stats },
          },
        });
        forwardPatches.push({ tokenId: tok.id, patch });
      } else if (item.targetHex) {
        const clamped = clampHexToBounds(
          item.targetHex,
          geom.gridWidth,
          geom.gridHeight
        );
        if (
          clamped.col === tok.x &&
          clamped.row === tok.y &&
          (tok.world_x === null || tok.world_x === undefined) &&
          !tok.npc_stats?.__unsnapped
        ) {
          continue;
        }

        const axial = offsetToAxial(clamped.col, clamped.row);
        const patch: Partial<VttTokenModel> = {
          x: clamped.col,
          y: clamped.row,
          q: axial.q,
          r: axial.r,
          world_x: null,
          world_y: null,
          ...(tok.npc_stats?.__unsnapped
            ? { npc_stats: { ...tok.npc_stats, __unsnapped: false } }
            : {}),
        };

        if (
          sc.combat_active &&
          this.enforceApOnMove() &&
          !item.freeOverride &&
          item.distanceFeet > 0
        ) {
          const moveActionsNeeded = Math.max(
            1,
            Math.ceil(item.distanceFeet / Math.max(5, tok.move_feet))
          );
          patch.current_ap = Math.max(0, tok.current_ap - moveActionsNeeded);
        }

        undoPatches.push({
          tokenId: tok.id,
          previousTokenPatch: {
            x: tok.x,
            y: tok.y,
            q: tok.q,
            r: tok.r,
            world_x: tok.world_x,
            world_y: tok.world_y,
            current_ap: tok.current_ap,
            npc_stats: { ...tok.npc_stats },
          },
        });
        forwardPatches.push({ tokenId: tok.id, patch });
      }
    }

    if (forwardPatches.length === 0) return;

    const prevFog = cloneExploredFog(sc.explored_fog);
    this.pushUndoEntry(
      sc.id,
      `Move ${forwardPatches.length} Tokens`,
      {
        kind: 'tokens_batch',
        patches: undoPatches,
        previousExploredFog: prevFog,
        selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      }
    );

    await Promise.all(
      forwardPatches.map((entry) => this.patchToken(entry.tokenId, entry.patch))
    );
    this.syncExploredFogFromObservers();
  }

  private async patchTokenCoalesced(
    tokenId: string,
    patch: Partial<VttTokenModel>
  ): Promise<void> {
    const existing = this.tokens().find((t) => t.id === tokenId);
    if (!existing) return;

    this.tokens.update((curr) =>
      curr.map((t) => (t.id === tokenId ? { ...t, ...patch } : t))
    );

    const tracker = this.inFlightTokenRotationPatches.get(tokenId);
    if (tracker?.inFlight) {
      tracker.queuedPatch = patch;
      return;
    }

    const state = {
      inFlight: true,
      queuedPatch: null as Partial<VttTokenModel> | null,
    };
    this.inFlightTokenRotationPatches.set(tokenId, state);

    let activePatch: Partial<VttTokenModel> | null = patch;
    try {
      while (activePatch) {
        const currentTok =
          this.tokens().find((t) => t.id === tokenId) ?? existing;
        const err = await this.vttService.updateToken(
          tokenId,
          activePatch,
          this.needsMigration(),
          currentTok
        );
        if (err) {
          this.notifications.error('Token Sync Error', err);
          break;
        }
        activePatch = state.queuedPatch;
        state.queuedPatch = null;
      }
    } finally {
      this.inFlightTokenRotationPatches.delete(tokenId);
    }
  }

  async rotateTokensByDelta(
    tokenIds: readonly string[],
    deltaDegrees: number
  ): Promise<void> {
    if (!Number.isFinite(deltaDegrees) || deltaDegrees === 0) return;
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          Boolean(t) && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;

    const sceneId = targets[0].encounter_id;
    const undoPatches = targets.map((tok) => ({
      tokenId: tok.id,
      previousTokenPatch: {
        npc_stats: { ...(tok.npc_stats ?? {}) },
      },
    }));
    const coalesceKey = `rotate:${targets
      .map((t) => t.id)
      .sort()
      .join(',')}`;
    const label =
      targets.length === 1
        ? `Rotate ${targets[0].name}`
        : `Rotate ${targets.length} Tokens`;

    this.pushUndoEntry(sceneId, label, {
      kind: 'tokens_batch',
      patches: undoPatches,
      selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      coalesceKey,
    });

    await Promise.all(
      targets.map((tok) => {
        const currDeg = normalizeTokenRotation(tok.npc_stats?.__rotation);
        const nextDeg = normalizeTokenRotation(currDeg + deltaDegrees);
        return this.patchTokenCoalesced(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __rotation: nextDeg,
          },
        });
      })
    );
  }

  async setTokensRotation(
    tokenIds: readonly string[],
    degrees: number
  ): Promise<void> {
    const targetDeg = normalizeTokenRotation(degrees);
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          t !== undefined &&
          (this.isGm() || this.canControlToken(t)) &&
          normalizeTokenRotation(t.npc_stats?.__rotation) !== targetDeg
      );
    if (targets.length === 0) return;

    const sceneId = targets[0].encounter_id;
    const undoPatches = targets.map((tok) => ({
      tokenId: tok.id,
      previousTokenPatch: {
        npc_stats: { ...(tok.npc_stats ?? {}) },
      },
    }));
    const label =
      targets.length === 1
        ? `Reset Rotation (${targets[0].name})`
        : `Reset Rotation (${targets.length} Tokens)`;

    this.pushUndoEntry(sceneId, label, {
      kind: 'tokens_batch',
      patches: undoPatches,
      selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
    });

    await Promise.all(
      targets.map((tok) =>
        this.patchToken(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __rotation: targetDeg,
          },
        })
      )
    );
  }

  async setTokensHidden(
    tokenIds: readonly string[],
    hidden: boolean
  ): Promise<void> {
    if (!this.isGm()) return;
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel => t !== undefined && t.is_hidden !== hidden
      );
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.toggleTokenHidden(targets[0].id);
      return;
    }

    const sceneId = targets[0].encounter_id;
    const sc = this.scenes().find((s) => s.id === sceneId);
    const prevFog = sc ? cloneExploredFog(sc.explored_fog) : undefined;

    this.pushUndoEntry(
      sceneId,
      `${hidden ? 'Hide' : 'Reveal'} ${targets.length} Tokens`,
      {
        kind: 'tokens_batch',
        patches: targets.map((tok) => ({
          tokenId: tok.id,
          previousTokenPatch: { is_hidden: tok.is_hidden },
        })),
        previousExploredFog: prevFog,
        selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      }
    );

    await Promise.all(
      targets.map((tok) => this.patchToken(tok.id, { is_hidden: hidden }))
    );
    this.syncExploredFogFromObservers();
  }

  async toggleTokensHiddenBatch(tokenIds: readonly string[]): Promise<void> {
    if (!this.isGm()) return;
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter((t): t is VttTokenModel => Boolean(t));
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.toggleTokenHidden(targets[0].id);
      return;
    }
    const shouldHide = targets.some((t) => !t.is_hidden);
    await this.setTokensHidden(
      targets.map((t) => t.id),
      shouldHide
    );
  }

  async toggleTokenHidden(tokenId: string): Promise<void> {
    if (!this.isGm()) return;
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok) return;
    const sc = this.scenes().find((s) => s.id === tok.encounter_id);
    const prevFog = sc ? cloneExploredFog(sc.explored_fog) : undefined;

    this.pushUndoEntry(
      tok.encounter_id,
      `${tok.is_hidden ? 'Reveal' : 'Hide'} ${tok.name}`,
      {
        kind: 'token_patch',
        tokenId: tok.id,
        previousTokenPatch: { is_hidden: tok.is_hidden },
        previousExploredFog: prevFog,
      }
    );

    await this.patchToken(tok.id, { is_hidden: !tok.is_hidden });
    this.syncExploredFogFromObservers();
  }

  async flipTokensHorizontal(tokenIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          Boolean(t) && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.toggleTokenFlipX(targets[0].id);
      return;
    }

    const sceneId = targets[0].encounter_id;
    this.pushUndoEntry(
      sceneId,
      `Flip Horizontal (${targets.length} Tokens)`,
      {
        kind: 'tokens_batch',
        patches: targets.map((tok) => ({
          tokenId: tok.id,
          previousTokenPatch: { npc_stats: { ...(tok.npc_stats ?? {}) } },
        })),
        selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      }
    );

    await Promise.all(
      targets.map((tok) =>
        this.patchToken(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __flip_x: !Boolean(tok.npc_stats?.__flip_x),
          },
        })
      )
    );
  }

  async flipTokensVertical(tokenIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          Boolean(t) && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.toggleTokenFlipY(targets[0].id);
      return;
    }

    const sceneId = targets[0].encounter_id;
    this.pushUndoEntry(
      sceneId,
      `Flip Vertical (${targets.length} Tokens)`,
      {
        kind: 'tokens_batch',
        patches: targets.map((tok) => ({
          tokenId: tok.id,
          previousTokenPatch: { npc_stats: { ...(tok.npc_stats ?? {}) } },
        })),
        selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      }
    );

    await Promise.all(
      targets.map((tok) =>
        this.patchToken(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __flip_y: !Boolean(tok.npc_stats?.__flip_y),
          },
        })
      )
    );
  }

  async toggleTokenFlipX(tokenId: string): Promise<void> {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || (!this.isGm() && !this.canControlToken(tok))) return;
    const nextFlipX = !Boolean(tok.npc_stats?.__flip_x);
    await this.recordablePatchToken(
      tok.id,
      {
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __flip_x: nextFlipX,
        },
      },
      `Flip Horizontal (${tok.name})`
    );
  }

  async toggleTokenFlipY(tokenId: string): Promise<void> {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || (!this.isGm() && !this.canControlToken(tok))) return;
    const nextFlipY = !Boolean(tok.npc_stats?.__flip_y);
    await this.recordablePatchToken(
      tok.id,
      {
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __flip_y: nextFlipY,
        },
      },
      `Flip Vertical (${tok.name})`
    );
  }

  async bringTokensToFront(tokenIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          Boolean(t) && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.bringTokenToFront(targets[0].id);
      return;
    }

    const sceneId = targets[0].encounter_id;
    const targetIdSet = new Set(targets.map((t) => t.id));
    const peers = this.tokens().filter(
      (t) => t.encounter_id === sceneId && !targetIdSet.has(t.id)
    );
    if (peers.length === 0) return;

    let maxPeerZ = -Infinity;
    for (const peer of peers) {
      const z = Number(peer.npc_stats?.__z_index ?? 0);
      const safeZ = Number.isFinite(z) ? z : 0;
      if (safeZ > maxPeerZ) {
        maxPeerZ = safeZ;
      }
    }
    const baseZ = (Number.isFinite(maxPeerZ) ? maxPeerZ : 0) + 1;

    const sortedTargets = [...targets].sort((a, b) => {
      const za = Number(a.npc_stats?.__z_index ?? 0);
      const zb = Number(b.npc_stats?.__z_index ?? 0);
      return (Number.isFinite(za) ? za : 0) - (Number.isFinite(zb) ? zb : 0);
    });

    const minTargetZ = Number(sortedTargets[0].npc_stats?.__z_index ?? 0);
    if (Number.isFinite(minTargetZ) && minTargetZ > maxPeerZ) return;

    this.pushUndoEntry(
      sceneId,
      `Bring to Front (${sortedTargets.length} Tokens)`,
      {
        kind: 'tokens_batch',
        patches: sortedTargets.map((tok) => ({
          tokenId: tok.id,
          previousTokenPatch: { npc_stats: { ...(tok.npc_stats ?? {}) } },
        })),
        selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      }
    );

    await Promise.all(
      sortedTargets.map((tok, idx) =>
        this.patchToken(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __z_index: baseZ + idx,
          },
        })
      )
    );
  }

  async sendTokensToBack(tokenIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          Boolean(t) && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.sendTokenToBack(targets[0].id);
      return;
    }

    const sceneId = targets[0].encounter_id;
    const targetIdSet = new Set(targets.map((t) => t.id));
    const peers = this.tokens().filter(
      (t) => t.encounter_id === sceneId && !targetIdSet.has(t.id)
    );
    if (peers.length === 0) return;

    let minPeerZ = Infinity;
    for (const peer of peers) {
      const z = Number(peer.npc_stats?.__z_index ?? 0);
      const safeZ = Number.isFinite(z) ? z : 0;
      if (safeZ < minPeerZ) {
        minPeerZ = safeZ;
      }
    }
    const sortedTargets = [...targets].sort((a, b) => {
      const za = Number(a.npc_stats?.__z_index ?? 0);
      const zb = Number(b.npc_stats?.__z_index ?? 0);
      return (Number.isFinite(za) ? za : 0) - (Number.isFinite(zb) ? zb : 0);
    });

    const maxTargetZ = Number(
      sortedTargets[sortedTargets.length - 1].npc_stats?.__z_index ?? 0
    );
    if (Number.isFinite(maxTargetZ) && maxTargetZ < minPeerZ) return;

    const baseZ =
      (Number.isFinite(minPeerZ) ? minPeerZ : 0) - sortedTargets.length;

    this.pushUndoEntry(
      sceneId,
      `Send to Back (${sortedTargets.length} Tokens)`,
      {
        kind: 'tokens_batch',
        patches: sortedTargets.map((tok) => ({
          tokenId: tok.id,
          previousTokenPatch: { npc_stats: { ...(tok.npc_stats ?? {}) } },
        })),
        selectedTokenIdsAfterUndo: [...this.selectedTokenIds()],
      }
    );

    await Promise.all(
      sortedTargets.map((tok, idx) =>
        this.patchToken(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __z_index: baseZ + idx,
          },
        })
      )
    );
  }

  async bringTokenToFront(tokenId: string): Promise<void> {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || (!this.isGm() && !this.canControlToken(tok))) return;
    const peers = this.tokens().filter(
      (t) => t.encounter_id === tok.encounter_id && t.id !== tok.id
    );
    if (peers.length === 0) return;
    let maxPeerZ = -Infinity;
    for (const peer of peers) {
      const z = Number(peer.npc_stats?.__z_index ?? 0);
      const safeZ = Number.isFinite(z) ? z : 0;
      if (safeZ > maxPeerZ) {
        maxPeerZ = safeZ;
      }
    }
    const currZ = Number(tok.npc_stats?.__z_index ?? 0);
    const nextZ = (Number.isFinite(maxPeerZ) ? maxPeerZ : 0) + 1;
    if (Number.isFinite(currZ) && currZ > maxPeerZ) return;

    await this.recordablePatchToken(
      tok.id,
      {
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __z_index: nextZ,
        },
      },
      `Bring to Front (${tok.name})`
    );
  }

  async sendTokenToBack(tokenId: string): Promise<void> {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || (!this.isGm() && !this.canControlToken(tok))) return;
    const peers = this.tokens().filter(
      (t) => t.encounter_id === tok.encounter_id && t.id !== tok.id
    );
    if (peers.length === 0) return;
    let minPeerZ = Infinity;
    for (const peer of peers) {
      const z = Number(peer.npc_stats?.__z_index ?? 0);
      const safeZ = Number.isFinite(z) ? z : 0;
      if (safeZ < minPeerZ) {
        minPeerZ = safeZ;
      }
    }
    const currZ = Number(tok.npc_stats?.__z_index ?? 0);
    const nextZ = (Number.isFinite(minPeerZ) ? minPeerZ : 0) - 1;
    if (Number.isFinite(currZ) && currZ < minPeerZ) return;

    await this.recordablePatchToken(
      tok.id,
      {
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __z_index: nextZ,
        },
      },
      `Send to Back (${tok.name})`
    );
  }

  async removeTokensBatch(tokenIds: readonly string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.tokens().find((t) => t.id === id))
      .filter((t): t is VttTokenModel => t !== undefined && this.canControlToken(t));
    if (targets.length === 0) return;
    if (targets.length === 1) {
      await this.removeToken(targets[0].id);
      return;
    }

    const sceneId = targets[0].encounter_id;
    const snapshots: VttTokenModel[] = targets.map((tok) => ({
      ...tok,
      statuses: [...(tok.statuses ?? [])],
      npc_stats: { ...(tok.npc_stats ?? {}) },
    }));

    this.pushUndoEntry(sceneId, `Remove ${targets.length} Tokens`, {
      kind: 'tokens_batch',
      removedSnapshots: snapshots,
    });

    await Promise.all(targets.map((tok) => this.removeTokenInternal(tok.id)));
  }

  async removeToken(tokenId: string): Promise<void> {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return;

    const snapshot: VttTokenModel = {
      ...tok,
      statuses: [...(tok.statuses ?? [])],
      npc_stats: { ...(tok.npc_stats ?? {}) },
    };
    this.pushUndoEntry(tok.encounter_id, `Remove ${tok.name}`, {
      kind: 'token_removed',
      tokenSnapshot: snapshot,
    });

    await this.removeTokenInternal(tokenId);
  }

  private async removeTokenInternal(tokenId: string): Promise<void> {
    this.tokens.update((curr) => curr.filter((t) => t.id !== tokenId));
    this.pruneRemovedTokenFromSelection(tokenId);
    if (this.pendingTargetAction()?.attackerTokenId === tokenId) {
      this.pendingTargetAction.set(null);
    }
    this.openSheetWindows.update((curr) =>
      curr.filter(
        (e) =>
          !(
            e.target.tokenId === tokenId &&
            !e.target.rosterActorId &&
            !e.target.characterId
          )
      )
    );
    this.syncPrimaryOpenSheetTarget(this.openSheetWindows());
    const tokTarget = this.openTokenizerTarget();
    if (
      tokTarget?.tokenId === tokenId &&
      !tokTarget.rosterActorId &&
      !tokTarget.characterId
    ) {
      this.openTokenizerTarget.set(null);
    }
    const err = await this.vttService.deleteToken(tokenId);
    if (err) {
      this.notifications.error('Unable to Remove Token', err);
    }
  }

  async toggleTokenStatus(
    token: VttTokenModel,
    status: Exclude<CombatStatusEffect, 'None'>
  ): Promise<void> {
    const curr = token.statuses ?? [];
    const next = curr.includes(status)
      ? curr.filter((s) => s !== status)
      : [...curr, status];
    this.pushUndoEntry(
      token.encounter_id,
      `Toggle ${status} on ${token.name}`,
      {
        kind: 'token_patch',
        tokenId: token.id,
        previousTokenPatch: { statuses: [...curr] },
      }
    );
    await this.patchToken(token.id, { statuses: next });
  }

  async performStanceRecovery(token: VttTokenModel): Promise<void> {
    if (!this.canControlToken(token) || token.current_ap < 1) return;
    let recoveryAmount = 3;
    const ch = this.resolveCharacterForToken(token);
    if (ch) {
      const stats = computeDerivedStats(
        ch,
        this.compendiumStore.allWeapons(),
        this.compendiumStore.allPerkNodes(),
        this.getArmorsForStats()
      );
      recoveryAmount = stats.stanceRecoverySp;
    }

    const nextSp = Math.min(token.max_sp, token.current_sp + recoveryAmount);
    this.pushUndoEntry(token.encounter_id, `Stance Recovery (${token.name})`, {
      kind: 'token_patch',
      tokenId: token.id,
      previousTokenPatch: {
        current_ap: token.current_ap,
        current_sp: token.current_sp,
      },
    });
    await this.patchToken(token.id, {
      current_ap: Math.max(0, token.current_ap - 1),
      current_sp: nextSp,
    });
    await this.postLog({
      kind: 'roll',
      title: `${token.name} used Stance Recovery (1 AP)`,
      detail: `Recovered +${nextSp - token.current_sp} SP (now ${nextSp}/${token.max_sp} SP)`,
    });
  }

  async toggleTokenRaiseShield(token: VttTokenModel): Promise<void> {
    if (!this.canControlToken(token)) return;
    if (token.shield_raised) {
      this.pushUndoEntry(token.encounter_id, `Lower Guard (${token.name})`, {
        kind: 'token_patch',
        tokenId: token.id,
        previousTokenPatch: { shield_raised: true },
      });
      await this.patchToken(token.id, { shield_raised: false });
      return;
    }
    if (token.current_ap < 1) return;
    this.pushUndoEntry(token.encounter_id, `Raise Guard (${token.name})`, {
      kind: 'token_patch',
      tokenId: token.id,
      previousTokenPatch: {
        shield_raised: token.shield_raised,
        current_ap: token.current_ap,
      },
    });
    await this.patchToken(token.id, {
      shield_raised: true,
      current_ap: Math.max(0, token.current_ap - 1),
    });
    await this.postLog({
      kind: 'roll',
      title: `${token.name} raised Guard / Shield (1 AP)`,
      detail: `Mitigates ${token.shield_block} DMG vs non-Piercing attacks until next turn.`,
    });
  }

  async switchCharacterWeaponSlotInVtt(token: VttTokenModel): Promise<void> {
    if (token.current_ap < 1) return;
    const ch = this.resolveCharacterForToken(token);
    if (!ch) return;

    const nextSlot: 1 | 2 = ch.active_weapon_slot === 1 ? 2 : 1;
    const updatedChar: CharacterModel = cloneDetachedVttCharacterSheet(
      {
        ...ch,
        active_weapon_slot: nextSlot,
        current_ap: Math.max(0, token.current_ap - 1),
      },
      ch.id
    );
    const nextStats = computeDerivedStats(
      updatedChar,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      this.getArmorsForStats()
    );
    const vis = nextStats.activeWeapon
      ? resolveWeaponVisuals(nextStats.activeWeapon)
      : { icon: token.icon ?? 'greatsword' };
    const reachFeet = nextStats.activeWeapon
      ? Math.max(5, Math.round((nextStats.activeWeapon.reach_tiles ?? 1) * 5))
      : 5;

    await this.persistDetachedSheetOnActorForToken(token, updatedChar, {
      icon: vis.icon,
      shield_block: nextStats.shieldBlockTotal,
      npc_stats: {
        weapon_name: nextStats.activeWeapon?.name ?? 'Unarmed',
        attack_ap: nextStats.activeWeapon?.ap_cost ?? 1,
        attack_mod: nextStats.attackRollMod,
        flat_damage: nextStats.flatWeaponDamage,
        reach_feet: reachFeet,
        parry_mod: nextStats.parryMod,
        dodge_mod: nextStats.dodgeMod,
        can_dodge: nextStats.canDodge,
        enables_martial_parry: nextStats.enablesMartialParry,
      },
    });
    await this.patchToken(token.id, {
      current_ap: Math.max(0, token.current_ap - 1),
      shield_block: nextStats.shieldBlockTotal,
      shield_raised: nextStats.usesRaiseShield ? token.shield_raised : false,
      icon: vis.icon,
    });
    await this.postLog({
      kind: 'system',
      title: `${token.name} switched to ${nextStats.activeWeapon?.name ?? 'Unarmed'} (1 AP)`,
      detail: `Active Slot ${nextSlot}`,
    });
  }

  beginWeaponTargetSelection(
    token: VttTokenModel,
    weapon?: WeaponModel | null,
    stats?: DerivedCharacterStats | null
  ): void {
    const ch = this.resolveCharacterForToken(token);
    if (stats && ch) {
      const reachFeet = weapon
        ? Math.max(
            (weapon.reach_tiles ?? 1) * 5,
            (weapon.thrown_range_tiles ?? 0) * 5
          )
        : 5;
      const hooks = weapon?.rule_hooks ?? {};
      this.pendingTargetAction.set({
        attackerTokenId: token.id,
        kind: 'weapon',
        actionName: weapon ? `${weapon.name} Strike` : 'Unarmed Strike',
        apCost: weapon?.ap_cost ?? 1,
        cooldownRounds: 0,
        perkId: null,
        reachFeet,
        attackMod: stats.attackRollMod,
        flatDamage: stats.flatWeaponDamage,
        combatTags: [],
        disallowedDefenses: [],
        bonusSpDamage: 0,
        ignoreArmorDr: Number(hooks['ignore_armor_dr'] ?? 0),
        defendedSpChip: Number(hooks['defended_sp_damage'] ?? 0),
        pushFeet: 0,
        selfShiftFeet: 0,
        inflictStatuses: [],
      });
      return;
    }

    const npc = token.npc_stats ?? {};
    const tag =
      npc.combat_tag && npc.combat_tag !== 'None' ? [npc.combat_tag] : [];
    const disallow: ('Parry' | 'Dodge' | 'Block')[] = [];
    if (tag.includes('Crushing')) disallow.push('Parry');
    if (tag.includes('Sweeping')) disallow.push('Dodge');
    if (tag.includes('Piercing')) disallow.push('Block');

    this.pendingTargetAction.set({
      attackerTokenId: token.id,
      kind: 'weapon',
      actionName: npc.weapon_name || 'Melee Strike',
      apCost: Number(npc.attack_ap ?? 1),
      cooldownRounds: 0,
      perkId: null,
      reachFeet: Number(npc.reach_feet ?? 5),
      attackMod: Number(npc.attack_mod ?? 3),
      flatDamage: Number(npc.flat_damage ?? 4),
      combatTags: tag,
      disallowedDefenses: disallow,
      bonusSpDamage: 0,
      ignoreArmorDr: 0,
      defendedSpChip: 0,
      pushFeet: 0,
      selfShiftFeet: 0,
      inflictStatuses: [],
    });
  }

  beginCombatArtTargetSelection(
    token: VttTokenModel,
    art: ResolvedCombatArt,
    stats: DerivedCharacterStats
  ): void {
    if (!art.meetsWeaponRequirement) return;
    const wep = stats.activeWeapon;
    const reachFeet =
      typeof art.reachFeet === 'number'
        ? art.reachFeet
        : computeCombatArtReachFeet(art.baseNode, wep);

    const baseHooks = art.baseNode.rule_hooks ?? {};
    let bonusSp = Number(baseHooks.bonus_sp_damage ?? 0);
    let ignoreDr = Number(
      (baseHooks.ignore_armor_dr ?? 0) +
        Number(wep?.rule_hooks?.['ignore_armor_dr'] ?? 0)
    );
    let pushTiles = Number(baseHooks.push_tiles ?? 0);
    let shiftTiles = Number(baseHooks.self_shift_tiles ?? 0);
    const statuses = new Set<Exclude<CombatStatusEffect, 'None'>>();
    if (baseHooks.inflict_status && baseHooks.inflict_status !== 'None') {
      statuses.add(baseHooks.inflict_status);
    }

    for (const upg of art.appliedUpgrades) {
      const s = upg.rule_hooks?.__art_upgrade;
      if (!s) continue;
      bonusSp += Number(s.bonus_sp_damage ?? 0);
      ignoreDr += Number(s.ignore_armor_dr ?? 0);
      pushTiles += Number(s.push_tiles ?? 0);
      shiftTiles += Number(s.self_shift_tiles ?? 0);
      for (const st of s.inflict_statuses ?? []) {
        if (st) statuses.add(st);
      }
    }

    this.pendingTargetAction.set({
      attackerTokenId: token.id,
      kind: 'combat_art',
      actionName: art.baseNode.name,
      apCost: art.apCost,
      cooldownRounds: art.cooldownRounds,
      perkId: art.baseNode.id,
      reachFeet,
      attackMod: stats.attackRollMod + art.bonusAttackMod,
      flatDamage: stats.flatWeaponDamage + art.bonusFlatDamage,
      combatTags: art.combatTags,
      disallowedDefenses: art.disallowedDefenses,
      bonusSpDamage: bonusSp,
      ignoreArmorDr: ignoreDr,
      defendedSpChip: Number(wep?.rule_hooks?.['defended_sp_damage'] ?? 0),
      pushFeet: Math.round(pushTiles * 5),
      selfShiftFeet: Math.round(shiftTiles * 5),
      inflictStatuses: Array.from(statuses),
    });
  }

  getNpcStandaloneNodes(
    entity: { npc_stats?: VttNpcStats | null } | null | undefined
  ): PerkNodeModel[] {
    const rawIds = entity?.npc_stats?.__standalone_perk_ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0) return [];
    const allNodes =
      typeof this.compendiumStore.allPerkNodes === 'function'
        ? this.compendiumStore.allPerkNodes()
        : [];
    if (allNodes.length === 0) return [];
    const byId = new Map<string, PerkNodeModel>();
    for (const node of allNodes) {
      byId.set(node.id, node);
    }
    const resolved: PerkNodeModel[] = [];
    for (const id of rawIds) {
      if (typeof id !== 'string') continue;
      const found = byId.get(id);
      if (found) {
        resolved.push(found);
      }
    }
    return resolved;
  }

  getNpcStandaloneCombatArts(token: VttTokenModel): PerkNodeModel[] {
    return this.getNpcStandaloneNodes(token).filter(
      (node) => node.node_type === 'combat_art'
    );
  }

  beginNpcStandaloneArtTargetSelection(
    token: VttTokenModel,
    node: PerkNodeModel
  ): void {
    const npc = token.npc_stats ?? {};
    const hooks = node.rule_hooks ?? {};
    const apCost = Math.max(1, Number(node.ap_cost ?? 1));
    const bonusAtk = Number(hooks.bonus_attack_mod ?? 0);
    const bonusDmg = Number(hooks.bonus_flat_damage ?? 0);
    const combatTags: ActiveCombatTag[] =
      node.combat_tag && node.combat_tag !== 'None' ? [node.combat_tag] : [];
    const disallowedDefenses: ('Parry' | 'Dodge' | 'Block')[] = [];
    if (combatTags.includes('Crushing')) disallowedDefenses.push('Parry');
    if (combatTags.includes('Sweeping')) disallowedDefenses.push('Dodge');
    if (combatTags.includes('Piercing')) disallowedDefenses.push('Block');
    const inflictStatuses: Exclude<CombatStatusEffect, 'None'>[] =
      hooks.inflict_status && hooks.inflict_status !== 'None'
        ? [hooks.inflict_status]
        : [];

    const rangeMode = resolveCombatArtRangeMode(node);
    const npcBaseReach = Math.max(5, Number(npc.reach_feet ?? 5));
    const npcReachFeet =
      rangeMode === 'custom_feet'
        ? computeCombatArtReachFeet(node)
        : rangeMode === 'melee_reach' && npcBaseReach > 10
          ? 5
          : npcBaseReach;

    this.pendingTargetAction.set({
      attackerTokenId: token.id,
      kind: 'combat_art',
      actionName: node.name,
      apCost,
      cooldownRounds: Math.max(0, Number(node.cooldown_rounds ?? 0)),
      perkId: node.id,
      reachFeet: npcReachFeet,
      attackMod: Number(npc.attack_mod ?? 3) + bonusAtk,
      flatDamage: Number(npc.flat_damage ?? 4) + bonusDmg,
      combatTags,
      disallowedDefenses,
      bonusSpDamage: Number(hooks.bonus_sp_damage ?? 0),
      ignoreArmorDr: Number(hooks.ignore_armor_dr ?? 0),
      defendedSpChip: 0,
      pushFeet: Math.round(Number(hooks.push_tiles ?? 0) * 5),
      selfShiftFeet: Math.round(Number(hooks.self_shift_tiles ?? 0) * 5),
      inflictStatuses,
    });
  }

  cancelTargetSelection(): void {
    this.pendingTargetAction.set(null);
  }

  async rollPendingActionFreeform(): Promise<void> {
    const pending = this.pendingTargetAction();
    if (!pending) return;
    const attacker = this.sceneTokens().find(
      (t) => t.id === pending.attackerTokenId
    );
    if (!attacker) return;

    const manual = this.manualRollOverride();
    const roll =
      manual !== null
        ? createManualRoll(manual, pending.attackMod)
        : roll2d10Check(pending.attackMod, this.attackRollMode());

    await this.consumeAttackerActionCost(attacker, pending);
    this.pendingTargetAction.set(null);
    this.manualRollOverride.set(null);

    const built = buildPhysicalDiceFrom2d10Roll(roll);
    let diceThrow: VttDiceThrowPayload | undefined;
    if (manual === null) {
      diceThrow = this.createDiceThrowPayload({
        label: `${attacker.name} · ${pending.actionName}`,
        formula: built.formula,
        total: roll.total,
        dice: built.physicalDice,
        senderNameOverride: attacker.name,
      });
      this.enqueueDiceThrow(diceThrow, true);
    }

    await this.postLog({
      kind: 'roll',
      title: `${attacker.name} · ${pending.actionName} → ${roll.total}`,
      detail: `2d10 (${roll.d1}+${roll.d2}) + ${roll.modifier} · ${pending.flatDamage} Flat DMG${pending.combatTags.length ? ' · ' + pending.combatTags.join('/') : ''}`,
      payload: {
        roll,
        chips: built.chips,
        ...(diceThrow ? { diceThrow } : {}),
      },
    });
  }

  private async consumeAttackerActionCost(
    attacker: VttTokenModel,
    action: PendingTargetAction
  ): Promise<void> {
    const nextAp = Math.max(0, attacker.current_ap - action.apCost);
    await this.patchToken(attacker.id, { current_ap: nextAp });

    if (action.perkId && action.cooldownRounds > 0) {
      const ch = this.resolveCharacterForToken(attacker);
      if (ch) {
        const nextCooldowns = {
          ...(ch.active_cooldowns ?? {}),
          [action.perkId]: action.cooldownRounds,
        };
        const updated = cloneDetachedVttCharacterSheet(
          {
            ...ch,
            current_ap: nextAp,
            active_cooldowns: nextCooldowns,
          },
          ch.id
        );
        await this.persistDetachedSheetOnActorForToken(attacker, updated);
      }
    }
  }

  async launchClashAgainstTarget(defenderTokenId: string): Promise<void> {
    const sc = this.activeScene();
    const pending = this.pendingTargetAction();
    if (!sc || !pending) return;

    const attacker = this.sceneTokens().find(
      (t) => t.id === pending.attackerTokenId
    );
    const defender = this.sceneTokens().find((t) => t.id === defenderTokenId);
    if (!attacker || !defender || attacker.id === defender.id) return;

    const distFeet = getTokenDistanceFeet(
      attacker,
      defender,
      this.gridGeometry(),
      sc.grid_mode
    );

    const manual = this.manualRollOverride();
    const rollMode = this.attackRollMode();

    await this.consumeAttackerActionCost(attacker, pending);

    const clash: VttPendingClash = {
      id: `clash-${Date.now()}`,
      attackerTokenId: attacker.id,
      attackerName: attacker.name,
      defenderTokenId: defender.id,
      defenderName: defender.name,
      actionName: pending.actionName,
      actionKind: pending.kind,
      perkId: pending.perkId,
      apSpent: pending.apCost,
      cooldownRounds: pending.cooldownRounds,
      distanceFeet: distFeet,
      reachFeet: pending.reachFeet,
      combatTags: pending.combatTags,
      disallowedDefenses: pending.disallowedDefenses,
      attackMod: pending.attackMod,
      attackRollMode: rollMode,
      manualAttackTotal: manual,
      attackRoll: null,
      rawFlatDamage: pending.flatDamage,
      bonusSpDamage: pending.bonusSpDamage,
      ignoreArmorDr: pending.ignoreArmorDr,
      defendedSpChip: pending.defendedSpChip,
      pushFeet: pending.pushFeet,
      selfShiftFeet: pending.selfShiftFeet,
      inflictStatuses: pending.inflictStatuses,
      createdAt: new Date().toISOString(),
    };

    this.pendingTargetAction.set(null);
    this.manualRollOverride.set(null);
    this.attackRollMode.set('normal');

    const modSign = pending.attackMod >= 0 ? '+' : '';
    await this.patchScene(sc.id, { pending_clash: clash });
    await this.postLog({
      kind: 'clash',
      title: `${attacker.name} targets ${defender.name} with ${pending.actionName}`,
      detail: `Distance ${distFeet} ft · 2d10${modSign}${pending.attackMod} · ${pending.flatDamage} Raw DMG${pending.combatTags.length ? ' · [' + pending.combatTags.join(', ') + ']' : ''} — Awaiting ${defender.name}'s reaction before rolling`,
    });
  }

  async declareClashReaction(
    reaction: VttDefenseChoice,
    manualDefenseTotal?: number | null
  ): Promise<void> {
    const sc = this.activeScene();
    const clash = this.pendingClash();
    const defender = this.pendingClashDefender();
    if (!sc || !clash || !defender) return;
    if (!this.canControlToken(defender) && !this.isGm()) return;

    const atkMod = clash.attackMod ?? 0;
    const attackRoll =
      clash.attackRoll ??
      (clash.manualAttackTotal !== undefined && clash.manualAttackTotal !== null
        ? createManualRoll(clash.manualAttackTotal, atkMod)
        : roll2d10Check(atkMod, clash.attackRollMode ?? 'normal'));

    const caps = this.getDefenderCapabilities(defender);
    const mod =
      reaction === 'parry'
        ? caps.parryMod
        : reaction === 'dodge'
          ? caps.dodgeMod
          : 0;
    const customRoll =
      manualDefenseTotal !== undefined && manualDefenseTotal !== null
        ? createManualRoll(manualDefenseTotal, mod)
        : undefined;

    const clashWithAttack: VttPendingClash = {
      ...clash,
      attackRoll,
    };

    const resolution = resolveClashReaction(
      clashWithAttack,
      reaction,
      caps,
      customRoll,
      attackRoll
    );

    let playedCue = false;
    const builtAttack = buildPhysicalDiceFrom2d10Roll(attackRoll);
    let attackDiceThrow: VttDiceThrowPayload | undefined;
    if (
      !clash.attackRoll &&
      (clash.manualAttackTotal === undefined || clash.manualAttackTotal === null)
    ) {
      attackDiceThrow = this.createDiceThrowPayload({
        label: `${clash.attackerName} · ${clash.actionName}`,
        formula: builtAttack.formula,
        total: attackRoll.total,
        dice: builtAttack.physicalDice,
        senderNameOverride: clash.attackerName,
      });
      this.settingsStore.playUiCue('dice');
      playedCue = true;
      this.enqueueDiceThrow(attackDiceThrow, true);
    }

    if (
      (reaction === 'parry' || reaction === 'dodge') &&
      customRoll === undefined &&
      resolution.defenseRoll
    ) {
      const builtDef = buildPhysicalDiceFrom2d10Roll(resolution.defenseRoll);
      const reactionLabel = reaction === 'parry' ? 'Parry' : 'Dodge';
      const defDiceThrow = this.createDiceThrowPayload({
        label: `${defender.name} · ${reactionLabel}`,
        formula: builtDef.formula,
        total: resolution.defenseRoll.total,
        dice: builtDef.physicalDice,
        senderNameOverride: defender.name,
      });
      if (!playedCue) {
        this.settingsStore.playUiCue('dice');
      }
      this.enqueueDiceThrow(defDiceThrow, true);
    }

    const reactionTitle =
      reaction === 'parry'
        ? `Parry ${resolution.defenseRoll?.total ?? 0}`
        : reaction === 'dodge'
          ? `Dodge ${resolution.defenseRoll?.total ?? 0}`
          : 'Take Hit';

    await this.patchScene(sc.id, {
      pending_clash: {
        ...clashWithAttack,
        selectedReaction: reaction,
        resolution,
      },
    });

    await this.postLog({
      kind: 'roll',
      title: `Clash Rolled: ${clash.attackerName} (${attackRoll.total}) vs ${defender.name} (${reactionTitle})`,
      detail: `${resolution.summary} — Awaiting GM to apply outcome`,
      payload: {
        roll: attackRoll,
        chips: builtAttack.chips,
        ...(attackDiceThrow ? { diceThrow: attackDiceThrow } : {}),
      },
    });
  }

  async applyPendingClashOutcome(
    overrides?: Partial<
      Pick<
        VttClashResolution,
        | 'hitLanded'
        | 'spDamageToDefender'
        | 'hpDamageToDefender'
        | 'counterSpToAttacker'
        | 'defenderApSpent'
      >
    >
  ): Promise<void> {
    if (!this.isGm()) return;
    const sc = this.activeScene();
    const clash = this.pendingClash();
    if (!sc || !clash?.resolution) return;

    const attacker = this.sceneTokens().find(
      (t) => t.id === clash.attackerTokenId
    );
    const defender = this.sceneTokens().find(
      (t) => t.id === clash.defenderTokenId
    );

    const res: VttClashResolution = {
      ...clash.resolution,
      ...overrides,
    };

    if (defender) {
      const mergedStatuses = res.hitLanded
        ? Array.from(
            new Set([...(defender.statuses ?? []), ...res.inflictedStatuses])
          )
        : defender.statuses;

      await this.patchToken(defender.id, {
        current_ap: Math.max(0, defender.current_ap - res.defenderApSpent),
        current_sp: Math.max(0, defender.current_sp - res.spDamageToDefender),
        current_hp: Math.max(0, defender.current_hp - res.hpDamageToDefender),
        statuses: mergedStatuses,
      });
    }

    if (attacker && res.counterSpToAttacker > 0) {
      await this.patchToken(attacker.id, {
        current_sp: Math.max(0, attacker.current_sp - res.counterSpToAttacker),
      });
    }

    await this.patchScene(sc.id, { pending_clash: null });
    await this.postLog({
      kind: 'damage',
      title: `Clash Resolved: ${clash.attackerName} vs ${clash.defenderName}`,
      detail: `${res.summary} → ${clash.defenderName} takes ${res.spDamageToDefender} SP & ${res.hpDamageToDefender} HP DMG${res.counterSpToAttacker > 0 ? ` · ${clash.attackerName} takes ${res.counterSpToAttacker} Counter SP` : ''}`,
    });
  }

  async cancelPendingClash(): Promise<void> {
    const sc = this.activeScene();
    const clash = this.pendingClash();
    if (!sc || !clash) return;
    if (clash.resolution) {
      if (!this.isGm()) return;
    } else {
      const attacker = this.sceneTokens().find(
        (t) => t.id === clash.attackerTokenId
      );
      const defender = this.sceneTokens().find(
        (t) => t.id === clash.defenderTokenId
      );
      if (
        !this.isGm() &&
        !this.canControlToken(attacker) &&
        !this.canControlToken(defender)
      ) {
        return;
      }
    }
    await this.patchScene(sc.id, { pending_clash: null });
  }

  resolveTokenInitiativeInfo(tok: VttTokenModel): {
    mod: number;
    govAttr: AttributeName;
  } {
    const ch = this.resolveCharacterForToken(tok);
    if (ch) {
      return {
        mod: ch.attributes.Cunning ?? 0,
        govAttr: 'Cunning',
      };
    }
    const actor = this.resolveRosterActorForToken(tok);
    const attrs = normalizeNpcAttributes(
      actor?.npc_stats?.attributes ?? tok.npc_stats?.attributes
    );
    return {
      mod: attrs.Cunning ?? 0,
      govAttr: 'Cunning',
    };
  }

  private sortCombatantTokens(
    tokens: readonly VttTokenModel[],
    fallbackOrder: readonly string[] = []
  ): VttTokenModel[] {
    if (tokens.length === 0) return [];

    const rolled = tokens
      .filter((t) => typeof t.npc_stats?.__initiative === 'number')
      .slice()
      .sort((a, b) => {
        const scoreDiff =
          Number(b.npc_stats?.__initiative ?? 0) -
          Number(a.npc_stats?.__initiative ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        const modDiff =
          Number(b.npc_stats?.__initiative_mod ?? 0) -
          Number(a.npc_stats?.__initiative_mod ?? 0);
        if (modDiff !== 0) return modDiff;
        if (a.faction !== b.faction) {
          return a.faction === 'ally' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    const unrolled = tokens.filter(
      (t) => typeof t.npc_stats?.__initiative !== 'number'
    );
    if (unrolled.length === 0) {
      return rolled;
    }

    const fallbackIndex = new Map<string, number>();
    fallbackOrder.forEach((id, idx) => fallbackIndex.set(id, idx));

    const inFallback = unrolled
      .filter((t) => fallbackIndex.has(t.id))
      .slice()
      .sort(
        (a, b) =>
          (fallbackIndex.get(a.id) ?? 0) - (fallbackIndex.get(b.id) ?? 0)
      );

    const notInFallback = unrolled.filter((t) => !fallbackIndex.has(t.id));
    const allies = notInFallback.filter((t) => t.faction === 'ally');
    const others = notInFallback.filter((t) => t.faction !== 'ally');
    const interleaved: VttTokenModel[] = [];
    const maxLen = Math.max(allies.length, others.length);
    for (let i = 0; i < maxLen; i++) {
      if (allies[i]) interleaved.push(allies[i]);
      if (others[i]) interleaved.push(others[i]);
    }

    return [...rolled, ...inFallback, ...interleaved];
  }

  private stripCombatInitiativeFields(
    stats: VttNpcStats | null | undefined,
    inCombatFlag?: boolean
  ): VttNpcStats {
    const next: VttNpcStats = { ...(stats ?? {}) };
    delete next.__initiative;
    delete next.__initiative_mod;
    if (inCombatFlag === undefined) {
      delete next.__in_combat;
    } else {
      next.__in_combat = inCombatFlag;
    }
    return next;
  }

  private buildSceneInitiativeOrder(
    sc: VttSceneModel,
    tokenIds: readonly string[],
    keepPhase1Open?: boolean
  ): string[] {
    const cleanIds = tokenIds.filter(
      (id) => id !== VTT_INITIATION_PHASE_SENTINEL
    );
    const shouldIncludeSentinel =
      !sc.combat_active &&
      (keepPhase1Open ??
        (sc.initiative_order ?? []).includes(VTT_INITIATION_PHASE_SENTINEL));
    return shouldIncludeSentinel
      ? [VTT_INITIATION_PHASE_SENTINEL, ...cleanIds]
      : cleanIds;
  }

  toggleCombatTrackerDrawer(force?: boolean): void {
    this.combatTrackerDrawerOpen.update((curr) =>
      force !== undefined ? force : !curr
    );
  }

  saveCombatTrackerPosition(coords: { x: number; y: number }): void {
    const normalized = {
      x: Math.round(coords.x),
      y: Math.round(coords.y),
    };
    this.combatTrackerPosition.set(normalized);
    writeStoredCombatTrackerLayout(normalized, this.combatTrackerMinimized());
  }

  saveCombatTrackerMinimized(minimized: boolean): void {
    this.combatTrackerMinimized.set(minimized);
    writeStoredCombatTrackerLayout(this.combatTrackerPosition(), minimized);
  }

  async logManualApAdjustment(
    tok: VttTokenModel,
    previousAp: number,
    nextAp: number,
    maxAp = tok.max_ap
  ): Promise<void> {
    if (previousAp === nextAp || !this.isCombatTrackerUnlocked()) {
      return;
    }
    const diff = nextAp - previousAp;
    const diffLabel = diff > 0 ? `+${diff}` : `−${Math.abs(diff)}`;
    const vis = this.resolveTokenVisuals(tok);
    await this.postLog({
      kind: 'system',
      title: `${tok.name} · AP Adjusted (${diffLabel} AP)`,
      detail: `${previousAp}/${maxAp} AP → ${nextAp}/${maxAp} AP`,
      senderNameOverride: tok.name,
      payload: {
        speaker_mode: 'character',
        speaker_color: tok.color || '#FDBA74',
        speaker_icon: tok.icon || 'greatsword',
        speaker_faction: tok.faction,
        ...(vis.portraitUrl ? { speaker_portrait_url: vis.portraitUrl } : {}),
        ...(vis.tokenImageUrl
          ? { speaker_token_image_url: vis.tokenImageUrl }
          : {}),
        ...(vis.tokenAppearance
          ? { speaker_token_appearance: vis.tokenAppearance }
          : {}),
        ...(tok.is_hidden ? { visibility: 'gm' } : {}),
      },
    });
  }

  async initiateCombatPhase(silentLog = false): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm() || sc.combat_active) return;
    if (this.isCombatInitiationOpen()) {
      this.combatTrackerDrawerOpen.set(true);
      return;
    }

    const staleTokens = this.sceneTokens().filter(
      (t) =>
        t.npc_stats?.__in_combat !== undefined ||
        t.npc_stats?.__initiative !== undefined ||
        t.npc_stats?.__initiative_mod !== undefined
    );
    for (const tok of staleTokens) {
      await this.patchToken(tok.id, {
        npc_stats: this.stripCombatInitiativeFields(tok.npc_stats),
      });
    }

    this.combatTrackerDrawerOpen.set(true);
    await this.patchScene(sc.id, {
      initiative_order: [VTT_INITIATION_PHASE_SENTINEL],
      active_turn_token_id: null,
    });

    if (!silentLog) {
      await this.postLog({
        kind: 'round',
        title: 'Combat Initiation — Roll Initiative!',
        detail: 'Roll Initiative (2d10 + Cunning) to enter the Combat Tracker.',
      });
    }
  }

  async rollInitiativeForTokens(tokenIds: readonly string[]): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.sceneTokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          t !== undefined && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;

    if (this.isGm() && !sc.combat_active && !this.isCombatInitiationOpen()) {
      await this.initiateCombatPhase(true);
    }

    const activeSc = this.activeScene() ?? sc;
    const canEnrollInTracker =
      activeSc.combat_active || this.isCombatInitiationOpen();

    const manual = this.manualRollOverride();
    let playedCue = false;

    for (const startTok of targets) {
      const tok =
        this.sceneTokens().find((t) => t.id === startTok.id) ?? startTok;
      const { mod, govAttr } = this.resolveTokenInitiativeInfo(tok);
      const roll =
        manual !== null
          ? createManualRoll(manual, mod)
          : roll2d10Check(mod, this.attackRollMode());
      const built = buildPhysicalDiceFrom2d10Roll(roll);
      const vis = this.resolveTokenVisuals(tok);
      const fullLabel = `${tok.name} · Initiative`;

      if (canEnrollInTracker) {
        await this.patchToken(tok.id, {
          npc_stats: {
            ...(tok.npc_stats ?? {}),
            __in_combat: true,
            __initiative: roll.total,
            __initiative_mod: mod,
          },
        });
      }

      const speakerVisualExtras: Record<string, unknown> = {
        speaker_color: tok.color || '#38B29A',
        speaker_icon: tok.icon || 'greatsword',
        speaker_faction: tok.faction,
        ...(vis.portraitUrl ? { speaker_portrait_url: vis.portraitUrl } : {}),
        ...(vis.tokenImageUrl
          ? { speaker_token_image_url: vis.tokenImageUrl }
          : {}),
        ...(vis.tokenAppearance
          ? { speaker_token_appearance: vis.tokenAppearance }
          : {}),
      };

      const diceThrow =
        manual === null
          ? this.createDiceThrowPayload({
              label: fullLabel,
              formula: built.formula,
              total: roll.total,
              dice: built.physicalDice,
              senderNameOverride: tok.name,
            })
          : undefined;

      if (diceThrow && !playedCue) {
        playedCue = true;
        this.settingsStore.playUiCue('dice');
        this.enqueueDiceThrow(diceThrow, true);
      }

      await this.postLog({
        kind: 'roll',
        title: `${fullLabel} (${built.formula}) → ${roll.total}`,
        detail: `${govAttr} ${mod >= 0 ? '+' : ''}${mod}`,
        senderNameOverride: tok.name,
        payload: {
          roll,
          chips: built.chips,
          formula: built.formula,
          modifier: mod,
          total: roll.total,
          ...(diceThrow ? { diceThrow } : {}),
          speaker_mode: 'character',
          ...speakerVisualExtras,
        },
      });
    }

    if (!canEnrollInTracker) {
      return;
    }

    const latestAfterRoll = this.activeScene() ?? activeSc;
    if (!latestAfterRoll.combat_active) {
      this.combatTrackerDrawerOpen.set(true);
    }

    if (this.isGm()) {
      const enrolled = this.allEnrolledCombatTokens();
      const nextIds = enrolled.map((t) => t.id);
      const nextOrder = this.buildSceneInitiativeOrder(
        latestAfterRoll,
        nextIds,
        !latestAfterRoll.combat_active
      );
      const firstLivingId =
        enrolled.find((t) => t.current_hp > 0 && !t.is_hidden)?.id ??
        enrolled.find((t) => t.current_hp > 0)?.id ??
        nextIds[0] ??
        null;
      await this.patchScene(sc.id, {
        initiative_order: nextOrder,
        ...(latestAfterRoll.combat_active && !latestAfterRoll.active_turn_token_id
          ? { active_turn_token_id: firstLivingId }
          : {}),
      });
    }
  }

  async rollInitiativeForMyTokens(): Promise<void> {
    const pending = this.unrolledControllableTokens().map((t) => t.id);
    if (pending.length > 0) {
      await this.rollInitiativeForTokens(pending);
      return;
    }
    const mine = this.sceneTokens()
      .filter((t) => !t.is_hidden && this.canControlToken(t))
      .map((t) => t.id);
    if (mine.length > 0) {
      await this.rollInitiativeForTokens(mine);
    }
  }

  private isGmNpcToken(tok: VttTokenModel): boolean {
    const sc = this.activeScene();
    const gmId = this.campaign()?.gm_id ?? sc?.gm_id ?? null;
    if (tok.owner_id && tok.owner_id !== gmId) {
      return false;
    }
    if (this.resolveCharacterForToken(tok)) {
      return false;
    }
    const actor = this.resolveRosterActorForToken(tok);
    if (actor) {
      return actor.actor_kind === 'npc';
    }
    return tok.faction !== 'ally';
  }

  async rollInitiativeForSceneNpcs(): Promise<void> {
    if (!this.isGm()) return;
    const sc = this.activeScene();
    if (sc && !sc.combat_active && !this.isCombatInitiationOpen()) {
      await this.initiateCombatPhase(true);
    }
    const npcs = this.sceneTokens().filter(
      (t) =>
        this.isGmNpcToken(t) &&
        (!t.is_hidden || t.npc_stats?.__in_combat === true)
    );
    if (npcs.length === 0) return;
    const unrolled = npcs.filter(
      (t) =>
        typeof t.npc_stats?.__initiative !== 'number' ||
        t.npc_stats?.__in_combat === false
    );
    const targetIds = (unrolled.length > 0 ? unrolled : npcs).map((t) => t.id);
    await this.rollInitiativeForTokens(targetIds);
  }

  async rollInitiativeForAllSceneTokens(): Promise<void> {
    if (!this.isGm()) return;
    const sc = this.activeScene();
    if (sc && !sc.combat_active && !this.isCombatInitiationOpen()) {
      await this.initiateCombatPhase(true);
    }
    const candidates = this.sceneTokens().filter(
      (t) => !t.is_hidden || t.npc_stats?.__in_combat === true
    );
    if (candidates.length === 0) return;
    const unrolled = candidates.filter(
      (t) =>
        typeof t.npc_stats?.__initiative !== 'number' ||
        t.npc_stats?.__in_combat === false
    );
    const targetIds = (unrolled.length > 0 ? unrolled : candidates).map(
      (t) => t.id
    );
    await this.rollInitiativeForTokens(targetIds);
  }

  async addTokensToCombat(tokenIds: readonly string[]): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;
    if (!sc.combat_active && !this.isCombatInitiationOpen() && !this.isGm()) {
      return;
    }
    const uniqueIds = Array.from(new Set(tokenIds));
    const targets = uniqueIds
      .map((id) => this.sceneTokens().find((t) => t.id === id))
      .filter(
        (t): t is VttTokenModel =>
          t !== undefined && (this.isGm() || this.canControlToken(t))
      );
    if (targets.length === 0) return;

    if (this.isGm() && !sc.combat_active && !this.isCombatInitiationOpen()) {
      await this.initiateCombatPhase(true);
    }

    for (const startTok of targets) {
      const tok =
        this.sceneTokens().find((t) => t.id === startTok.id) ?? startTok;
      await this.patchToken(tok.id, {
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __in_combat: true,
        },
      });
    }

    const latestScene = this.activeScene() ?? sc;
    if (!latestScene.combat_active) {
      this.combatTrackerDrawerOpen.set(true);
    }

    if (this.isGm()) {
      const enrolled = this.allEnrolledCombatTokens();
      await this.patchScene(sc.id, {
        initiative_order: this.buildSceneInitiativeOrder(
          latestScene,
          enrolled.map((t) => t.id),
          !latestScene.combat_active
        ),
      });
    }
  }

  async setTokenInitiativeScore(
    tokenId: string,
    score: number | null
  ): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    if (!sc.combat_active && !this.isCombatInitiationOpen()) {
      await this.initiateCombatPhase(true);
    }
    const tok = this.sceneTokens().find((t) => t.id === tokenId);
    if (!tok) return;

    const { mod } = this.resolveTokenInitiativeInfo(tok);
    const nextStats: VttNpcStats = {
      ...(tok.npc_stats ?? {}),
      __in_combat: true,
      __initiative_mod:
        typeof tok.npc_stats?.__initiative_mod === 'number'
          ? tok.npc_stats.__initiative_mod
          : mod,
    };
    if (score === null || !Number.isFinite(score)) {
      delete nextStats.__initiative;
    } else {
      nextStats.__initiative = Math.round(score);
    }

    await this.patchToken(tok.id, { npc_stats: nextStats });
    const latestScene = this.activeScene() ?? sc;
    const nextIds = this.allEnrolledCombatTokens().map((t) => t.id);
    await this.patchScene(sc.id, {
      initiative_order: this.buildSceneInitiativeOrder(latestScene, nextIds),
    });
  }

  async removeTokenFromCombat(tokenId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    const tok = this.sceneTokens().find((t) => t.id === tokenId);
    if (!tok) return;

    let replacementActiveId: string | null | undefined = undefined;
    if (sc.combat_active && sc.active_turn_token_id === tokenId) {
      const currentOrder = this.allEnrolledCombatTokens().filter(
        (t) => t.current_hp > 0 && (t.id === tokenId || !t.is_hidden)
      );
      const currIdx = currentOrder.findIndex((t) => t.id === tokenId);
      const remaining = currentOrder.filter((t) => t.id !== tokenId);
      if (remaining.length === 0) {
        replacementActiveId = null;
      } else {
        const nextIdx = currIdx >= 0 ? currIdx % remaining.length : 0;
        replacementActiveId = remaining[nextIdx].id;
      }
    }

    await this.patchToken(tok.id, {
      npc_stats: this.stripCombatInitiativeFields(tok.npc_stats),
    });

    const filteredPrevIds = (sc.initiative_order ?? []).filter(
      (id) => id !== tokenId && id !== VTT_INITIATION_PHASE_SENTINEL
    );
    const filteredPrevOrder = this.buildSceneInitiativeOrder(
      sc,
      filteredPrevIds
    );
    await this.patchScene(sc.id, {
      initiative_order: filteredPrevOrder,
      ...(replacementActiveId !== undefined
        ? { active_turn_token_id: replacementActiveId }
        : {}),
    });

    const latestScene = this.activeScene() ?? sc;
    const finalOrder = this.buildSceneInitiativeOrder(
      latestScene,
      this.allEnrolledCombatTokens().map((t) => t.id)
    );
    if (
      finalOrder.length !== filteredPrevOrder.length ||
      finalOrder.some((id, idx) => id !== filteredPrevOrder[idx])
    ) {
      await this.patchScene(sc.id, { initiative_order: finalOrder });
    }
  }

  async clearInitiativeLobby(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    const toReset = this.sceneTokens().filter(
      (t) =>
        t.npc_stats?.__in_combat !== undefined ||
        t.npc_stats?.__initiative !== undefined ||
        t.npc_stats?.__initiative_mod !== undefined
    );
    for (const tok of toReset) {
      await this.patchToken(tok.id, {
        npc_stats: this.stripCombatInitiativeFields(tok.npc_stats),
      });
    }

    this.combatTrackerDrawerOpen.set(false);
    await this.patchScene(sc.id, {
      combat_active: false,
      round_number: 1,
      initiative_order: [],
      active_turn_token_id: null,
      pending_clash: null,
    });
  }

  async startCombatEncounter(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    let combatants = this.allEnrolledCombatTokens();
    if (combatants.length === 0) {
      const visible = this.sceneTokens().filter((t) => !t.is_hidden);
      if (visible.length === 0) return;
      combatants = this.sortCombatantTokens(visible);
    }

    const cleanPrevOrder = (sc.initiative_order ?? []).filter(
      (id) => id !== VTT_INITIATION_PHASE_SENTINEL
    );
    const orderedCombatants = this.sortCombatantTokens(
      combatants,
      cleanPrevOrder
    );
    const orderedIds = orderedCombatants.map((t) => t.id);
    const firstId =
      orderedCombatants.find((t) => t.current_hp > 0 && !t.is_hidden)?.id ??
      orderedCombatants.find((t) => t.current_hp > 0)?.id ??
      orderedIds[0] ??
      null;

    for (const tok of orderedCombatants) {
      await this.patchToken(tok.id, {
        current_ap: tok.max_ap,
        shield_raised: false,
        npc_stats: {
          ...(tok.npc_stats ?? {}),
          __in_combat: true,
        },
      });
    }

    this.combatTrackerDrawerOpen.set(false);
    await this.patchScene(sc.id, {
      combat_active: true,
      round_number: 1,
      initiative_order: orderedIds,
      active_turn_token_id: firstId,
    });
    this.enforceApOnMove.set(true);
    await this.postLog({
      kind: 'round',
      title: 'Combat Started — Round 1',
      detail: `${orderedIds.length} combatant${orderedIds.length === 1 ? '' : 's'} in turn order · All AP refreshed`,
    });
  }

  async advanceTurn(): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;
    const activeTok = sc.active_turn_token_id
      ? (this.sceneTokens().find((t) => t.id === sc.active_turn_token_id) ??
        null)
      : null;
    if (!this.isGm() && (!activeTok || !this.canControlToken(activeTok))) {
      return;
    }

    const allCombatants = this.allEnrolledCombatTokens();
    const visibleLiving = allCombatants.filter(
      (t) => t.current_hp > 0 && !t.is_hidden
    );
    const order =
      visibleLiving.length > 0
        ? visibleLiving
        : allCombatants.filter((t) => t.current_hp > 0);
    if (order.length === 0) return;

    const currIdx = order.findIndex((t) => t.id === sc.active_turn_token_id);
    const wrapped = currIdx === -1 || currIdx + 1 >= order.length;
    const nextIdx = wrapped ? 0 : currIdx + 1;
    const nextTok = order[nextIdx];
    const nextRound =
      currIdx !== -1 && wrapped ? sc.round_number + 1 : sc.round_number;

    await this.patchToken(nextTok.id, {
      current_ap: nextTok.max_ap,
      shield_raised: false,
    });

    const ch = this.resolveCharacterForToken(nextTok);
    if (ch) {
      const nextCd: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(ch.active_cooldowns ?? {})) {
        if (k.startsWith(UPGRADE_SLOT_PREFIX)) {
          nextCd[k] = v;
        } else if (k !== '__shield_raised') {
          const rem = Number(v) - 1;
          if (rem > 0) nextCd[k] = rem;
        }
      }
      const updated = cloneDetachedVttCharacterSheet(
        {
          ...ch,
          current_ap: nextTok.max_ap,
          active_cooldowns: nextCd,
        },
        ch.id
      );
      await this.persistDetachedSheetOnActorForToken(nextTok, updated);
    }

    await this.patchScene(sc.id, {
      round_number: nextRound,
      active_turn_token_id: nextTok.id,
      initiative_order: allCombatants.map((t) => t.id),
    });

    await this.postLog({
      kind: 'round',
      title: `Round ${nextRound} — ${nextTok.name}'s Turn`,
      detail: `AP refreshed to ${nextTok.max_ap} · Guard reset`,
    });
  }

  async previousTurn(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !sc.combat_active || !this.isGm()) return;

    const allCombatants = this.allEnrolledCombatTokens();
    const visibleLiving = allCombatants.filter(
      (t) => t.current_hp > 0 && !t.is_hidden
    );
    const order =
      visibleLiving.length > 0
        ? visibleLiving
        : allCombatants.filter((t) => t.current_hp > 0);
    if (order.length === 0) return;

    const currIdx = order.findIndex((t) => t.id === sc.active_turn_token_id);
    const wrappedBack = currIdx <= 0;
    const prevIdx = wrappedBack ? order.length - 1 : currIdx - 1;
    const prevTok = order[prevIdx];
    const prevRound =
      currIdx === 0 ? Math.max(1, sc.round_number - 1) : sc.round_number;

    await this.patchToken(prevTok.id, {
      current_ap: prevTok.max_ap,
      shield_raised: false,
    });

    await this.patchScene(sc.id, {
      round_number: prevRound,
      active_turn_token_id: prevTok.id,
      initiative_order: allCombatants.map((t) => t.id),
    });

    await this.postLog({
      kind: 'round',
      title: `Round ${prevRound} — ${prevTok.name}'s Turn`,
      detail: `Turn rewound by GM · AP refreshed to ${prevTok.max_ap}`,
    });
  }

  async setActiveCombatTurn(tokenId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !sc.combat_active || !this.isGm()) return;
    const tok = this.allEnrolledCombatTokens().find((t) => t.id === tokenId);
    if (!tok) return;

    await this.patchToken(tok.id, {
      current_ap: tok.max_ap,
      shield_raised: false,
    });

    await this.patchScene(sc.id, {
      active_turn_token_id: tok.id,
      initiative_order: this.allEnrolledCombatTokens().map((t) => t.id),
    });

    await this.postLog({
      kind: 'round',
      title: `Round ${sc.round_number} — ${tok.name}'s Turn`,
      detail: `Active turn set by GM · AP refreshed to ${tok.max_ap}`,
    });
  }

  async endCombatEncounter(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    const toReset = this.sceneTokens().filter(
      (t) =>
        t.npc_stats?.__in_combat !== undefined ||
        t.npc_stats?.__initiative !== undefined ||
        t.npc_stats?.__initiative_mod !== undefined
    );
    for (const tok of toReset) {
      await this.patchToken(tok.id, {
        npc_stats: this.stripCombatInitiativeFields(tok.npc_stats),
      });
    }

    this.combatTrackerDrawerOpen.set(false);
    await this.patchScene(sc.id, {
      combat_active: false,
      round_number: 1,
      active_turn_token_id: null,
      initiative_order: [],
      pending_clash: null,
    });
    this.enforceApOnMove.set(false);
    await this.postLog({
      kind: 'round',
      title: 'Combat Ended',
      detail: 'Initiative order cleared.',
    });
  }

  async rollQuickDice(
    label: string,
    modifier: number,
    mode: 'normal' | 'advantage' | 'disadvantage' = 'normal'
  ): Promise<void> {
    const roll = roll2d10Check(modifier, mode);
    const built = buildPhysicalDiceFrom2d10Roll(roll);
    const diceThrow = this.createDiceThrowPayload({
      label,
      formula: built.formula,
      total: roll.total,
      dice: built.physicalDice,
    });
    this.enqueueDiceThrow(diceThrow, true);

    const diceDetail =
      roll.d3 !== undefined
        ? `3d10 (${roll.d1}, ${roll.d2}, ${roll.d3} · ${mode})`
        : `2d10 (${roll.d1}+${roll.d2})`;
    await this.postLog({
      kind: 'roll',
      title: `${label} → ${roll.total}`,
      detail: `${diceDetail} ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)}`,
      payload: { roll, chips: built.chips, diceThrow },
    });
  }

  async rollCustomDicePool(
    label: string,
    pool: Partial<DicePoolCounts>,
    modifier = 0
  ): Promise<void> {
    if (getTotalDiceInPool(pool) <= 0) {
      await this.rollQuickDice(label, modifier, 'normal');
      return;
    }

    const res = rollCustomDicePool(pool, modifier);
    const diceThrow = this.createDiceThrowPayload({
      label,
      formula: res.formula,
      total: res.total,
      dice: res.physicalDice,
    });
    this.enqueueDiceThrow(diceThrow, true);

    await this.postLog({
      kind: 'roll',
      title: `${label} (${res.formula}) → ${res.total}`,
      detail: res.detail,
      payload: {
        chips: res.chips,
        groups: res.groups,
        formula: res.formula,
        modifier: res.modifier,
        total: res.total,
        diceThrow,
      },
    });
  }

  previewTestDiceRoll(): void {
    if (!this.settingsStore.preferences().enable3dDice) {
      this.settingsStore.updatePreferences({ enable3dDice: true });
    }
    const res = rollCustomDicePool(
      { d20: 1, d10: 2, d8: 1, d6: 1 },
      0
    );
    const diceThrow = this.createDiceThrowPayload({
      label: 'Preview Roll',
      formula: res.formula,
      total: res.total,
      dice: res.physicalDice,
    });
    this.settingsStore.playUiCue('dice');
    this.enqueueDiceThrow(diceThrow, false);
  }

  private createDiceThrowPayload(input: {
    label: string;
    formula: string;
    total: number;
    dice: VttPhysicalDieRoll[];
    senderNameOverride?: string;
    recipientIds?: string[];
  }): VttDiceThrowPayload {
    return {
      id: `throw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: this.authStore.user()?.id ?? null,
      senderName:
        input.senderNameOverride ||
        this.authStore.displayName() ||
        'Adventurer',
      label: input.label,
      formula: input.formula,
      total: input.total,
      dice: input.dice,
      appearance: { ...this.settingsStore.preferences().diceAppearance },
      seed: generateThrowSeed(),
      createdAt: Date.now(),
      ...(input.recipientIds && input.recipientIds.length > 0
        ? { recipientIds: input.recipientIds }
        : {}),
    };
  }

  isLogVisibleToCurrentUser(entry: VttLogEntry): boolean {
    const rawRecips = entry.payload?.['recipient_ids'];
    if (!Array.isArray(rawRecips)) {
      return true;
    }
    if (this.authStore.isAdmin()) {
      return true;
    }
    const uid = this.authStore.user()?.id;
    if (!uid) {
      return false;
    }
    if (entry.sender_id && entry.sender_id === uid) {
      return true;
    }
    return rawRecips.some((id) => typeof id === 'string' && id === uid);
  }

  isDiceThrowVisibleToCurrentUser(payload: VttDiceThrowPayload): boolean {
    if (!Array.isArray(payload.recipientIds) || payload.recipientIds.length === 0) {
      return true;
    }
    if (this.authStore.isAdmin()) {
      return true;
    }
    const uid = this.authStore.user()?.id;
    if (!uid) {
      return false;
    }
    if (payload.senderId && payload.senderId === uid) {
      return true;
    }
    return payload.recipientIds.includes(uid);
  }

  enqueueDiceThrow(
    payload: VttDiceThrowPayload,
    broadcastToRoom = false
  ): void {
    if (!payload?.id || this.seenDiceThrowIds.has(payload.id)) {
      return;
    }
    if (this.seenDiceThrowIds.size > 200) {
      const oldest = this.seenDiceThrowIds.values().next().value;
      if (oldest) {
        this.seenDiceThrowIds.delete(oldest);
      }
    }
    this.seenDiceThrowIds.add(payload.id);

    if (this.isDiceThrowVisibleToCurrentUser(payload)) {
      this.latestDiceThrow.set(payload);
    }

    if (broadcastToRoom) {
      void this.vttService.sendDiceThrow?.(this.realtimeChannel, payload);
    }
  }

  private resolveWhisperCommandArgs(rest: string):
    | {
        ok: true;
        recipientIds: string[];
        recipientLabel: string;
        message: string;
      }
    | {
        ok: false;
        error: string;
      } {
    const trimmed = rest.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: 'Specify a recipient and message, such as gm or @handle followed by your message.',
      };
    }

    const camp = this.campaign();
    const candidates: {
      names: string[];
      label: string;
      userIds: string[];
    }[] = [];

    if (camp?.gm_id) {
      const gmPart = this.participants().find((p) => p.user_id === camp.gm_id);
      const gmNames = ['gm', 'dm', 'warden', 'gamemaster'];
      if (gmPart?.handle) {
        gmNames.push(gmPart.handle.toLowerCase(), `@${gmPart.handle.toLowerCase()}`);
      }
      if (gmPart?.display_name) {
        gmNames.push(gmPart.display_name.toLowerCase());
      }
      candidates.push({
        names: gmNames,
        label: 'GM',
        userIds: [camp.gm_id],
      });
    }

    for (const part of this.participants()) {
      const names = [part.display_name.toLowerCase()];
      if (part.handle) {
        names.push(part.handle.toLowerCase(), `@${part.handle.toLowerCase()}`);
      }
      candidates.push({
        names,
        label: part.role === 'gm' ? `GM (${part.display_name})` : part.display_name,
        userIds: [part.user_id],
      });
    }

    for (const ch of this.allCharacters()) {
      if (!ch.owner_id) continue;
      candidates.push({
        names: [ch.name.toLowerCase()],
        label: ch.name,
        userIds: [ch.owner_id],
      });
    }

    for (const tok of this.tokens()) {
      if (!tok.owner_id) continue;
      candidates.push({
        names: [tok.name.toLowerCase()],
        label: tok.name,
        userIds: [tok.owner_id],
      });
    }

    for (const log of this.logs()) {
      if (!log.sender_id || !log.sender_name) continue;
      candidates.push({
        names: [log.sender_name.toLowerCase()],
        label: log.sender_name,
        userIds: [log.sender_id],
      });
    }

    let rawTarget = '';
    let message = '';

    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      const quote = trimmed[0];
      const closeIdx = trimmed.indexOf(quote, 1);
      if (closeIdx === -1) {
        return { ok: false, error: 'Unclosed quote around whisper recipient.' };
      }
      rawTarget = trimmed.slice(1, closeIdx).trim();
      message = trimmed.slice(closeIdx + 1).trim();
    } else {
      const lowerRest = trimmed.toLowerCase();
      let matchedMultiWord: {
        nameLen: number;
        cand: (typeof candidates)[number];
      } | null = null;

      for (const cand of candidates) {
        for (const alias of cand.names) {
          if (!alias.includes(' ')) continue;
          if (
            lowerRest.startsWith(alias + ' ') &&
            (!matchedMultiWord || alias.length > matchedMultiWord.nameLen)
          ) {
            matchedMultiWord = { nameLen: alias.length, cand };
          }
        }
      }

      if (matchedMultiWord) {
        const msg = trimmed.slice(matchedMultiWord.nameLen).trim();
        if (!msg) {
          return { ok: false, error: 'Enter a whisper message after the recipient.' };
        }
        return {
          ok: true,
          recipientIds: matchedMultiWord.cand.userIds,
          recipientLabel: matchedMultiWord.cand.label,
          message: msg,
        };
      }

      const spIdx = trimmed.search(/\s/);
      if (spIdx === -1) {
        return { ok: false, error: 'Enter a whisper message after the recipient.' };
      }
      rawTarget = trimmed.slice(0, spIdx).trim();
      message = trimmed.slice(spIdx + 1).trim();
    }

    if (!rawTarget || !message) {
      return { ok: false, error: 'Specify both a recipient and a whisper message.' };
    }

    const q = rawTarget.toLowerCase();
    const qStripped = q.replace(/^@/, '');

    const exact = candidates.find((c) =>
      c.names.some((n) => n === q || n === qStripped)
    );
    if (exact) {
      return {
        ok: true,
        recipientIds: exact.userIds,
        recipientLabel: exact.label,
        message,
      };
    }

    const prefixMatch = candidates.find((c) =>
      c.names.some((n) => n.startsWith(qStripped) && qStripped.length >= 2)
    );
    if (prefixMatch) {
      return {
        ok: true,
        recipientIds: prefixMatch.userIds,
        recipientLabel: prefixMatch.label,
        message,
      };
    }

    return {
      ok: false,
      error: `Could not find participant "${rawTarget}" in this campaign.`,
    };
  }

  private buildSpeakerPayloadFields(
    speaker: VttResolvedChatSpeaker
  ): Record<string, unknown> {
    if (speaker.mode !== 'character') {
      return {
        speaker_mode: this.isGm() ? 'gm_user' : 'user',
      };
    }
    return {
      speaker_mode: 'character',
      ...(speaker.tokenId ? { speaker_token_id: speaker.tokenId } : {}),
      ...(speaker.characterId
        ? { speaker_character_id: speaker.characterId }
        : {}),
      ...(speaker.color ? { speaker_color: speaker.color } : {}),
      ...(speaker.icon ? { speaker_icon: speaker.icon } : {}),
      ...(speaker.faction ? { speaker_faction: speaker.faction } : {}),
      ...(speaker.portraitUrl
        ? { speaker_portrait_url: speaker.portraitUrl }
        : {}),
      ...(speaker.tokenImageUrl
        ? { speaker_token_image_url: speaker.tokenImageUrl }
        : {}),
      ...(speaker.tokenAppearance
        ? { speaker_token_appearance: speaker.tokenAppearance }
        : {}),
    };
  }

  getLogSpeakerVisuals(entry: VttLogEntry): {
    displayImageUrl: string | null;
    tokenImageUrl: string | null;
    portraitUrl: string | null;
    appearance: TokenAppearanceConfig;
    icon: string;
    color: string | null;
    faction: VttFaction;
  } | null {
    const payload = entry.payload ?? {};
    if (payload['speaker_mode'] !== 'character') {
      return null;
    }

    const tokenId =
      typeof payload['speaker_token_id'] === 'string'
        ? payload['speaker_token_id']
        : null;
    const characterId =
      typeof payload['speaker_character_id'] === 'string'
        ? payload['speaker_character_id']
        : null;

    const liveTok = tokenId
      ? (this.tokens().find((t) => t.id === tokenId) ?? null)
      : null;
    const liveChar = characterId
      ? (this.characterByIdMap().get(characterId) ?? null)
      : null;
    const liveActor = liveTok
      ? this.resolveRosterActorForToken(liveTok)
      : characterId
        ? (this.rosterActors().find((a) => a.character_id === characterId) ??
          null)
        : null;

    const payloadTokenImageUrl = sanitizeOptionalImageUrl(
      payload['speaker_token_image_url']
    );
    const payloadPortraitUrl = sanitizeOptionalImageUrl(
      payload['speaker_portrait_url']
    );
    const payloadAppearance = payload['speaker_token_appearance']
      ? normalizeTokenAppearance(payload['speaker_token_appearance'])
      : null;

    const tokenImageUrl =
      resolveEntityTokenImageUrl(liveTok, liveActor, liveChar) ??
      payloadTokenImageUrl;
    const portraitUrl =
      resolveEntityPortraitUrl(liveTok, liveActor, liveChar) ??
      payloadPortraitUrl;
    const baseAppearance =
      liveTok || liveActor || liveChar
        ? resolveEntityTokenAppearance(liveTok, liveActor, liveChar)
        : (payloadAppearance ?? normalizeTokenAppearance(null));

    const displayImageUrl = tokenImageUrl ?? portraitUrl;
    const appearance: TokenAppearanceConfig =
      tokenImageUrl || !portraitUrl
        ? baseAppearance
        : {
            ...baseAppearance,
            scale: 1,
            offset_x: 0,
            offset_y: 0,
          };

    const rawFaction = payload['speaker_faction'];
    const faction: VttFaction =
      liveTok?.faction ??
      liveActor?.faction ??
      (rawFaction === 'ally' || rawFaction === 'enemy' || rawFaction === 'neutral'
        ? rawFaction
        : 'ally');

    const icon =
      liveTok?.icon ||
      liveActor?.icon ||
      (typeof payload['speaker_icon'] === 'string' &&
      payload['speaker_icon'].trim()
        ? payload['speaker_icon'].trim()
        : 'user');

    const color =
      liveTok?.color ||
      liveActor?.color ||
      (typeof payload['speaker_color'] === 'string' &&
      payload['speaker_color'].trim()
        ? payload['speaker_color'].trim()
        : faction === 'ally'
          ? '#38B29A'
          : null);

    return {
      displayImageUrl,
      tokenImageUrl,
      portraitUrl,
      appearance,
      icon,
      color,
      faction,
    };
  }

  async executeChatOrCommand(
    rawInput: string,
    registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
  ): Promise<{ cleared: boolean }> {
    const trimmed = (rawInput ?? '').trim();
    if (!trimmed) {
      return { cleared: false };
    }

    const unknownCmd = isUnknownSlashCommand(trimmed, registry);
    if (unknownCmd) {
      const validList = registry
        .filter((c) => !c.gmOnly || this.isGm())
        .map((c) => c.primary)
        .join(', ');
      this.notifications.error(
        'Unknown Command',
        `"${unknownCmd}" is not recognized. Available commands: ${validList}`
      );
      return { cleared: false };
    }

    const resolved = resolveSlashCommand(trimmed, registry);
    if (!resolved) {
      const speaker = this.effectivePublicSpeaker();
      await this.postLog({
        kind: 'chat',
        title: trimmed,
        senderNameOverride: speaker.name,
        payload: this.buildSpeakerPayloadFields(speaker),
      });
      return { cleared: true };
    }

    const action = resolved.config.action;

    if (action === 'ooc') {
      if (!resolved.rest) {
        this.notifications.error(
          'Empty OOC Message',
          'Provide a message after the out-of-character command.'
        );
        return { cleared: false };
      }
      const userDisplay =
        this.authStore.displayName() || (this.isGm() ? 'GM' : 'Adventurer');
      await this.postLog({
        kind: 'chat',
        title: resolved.rest,
        senderNameOverride: userDisplay,
        payload: {
          ooc: true,
          speaker_mode: 'user',
        },
      });
      return { cleared: true };
    }

    if (action === 'roll' || action === 'gm_roll') {
      const parsed = parseAndRollDiceFormula(resolved.rest);
      if (!parsed.ok) {
        this.notifications.error('Invalid Roll Formula', parsed.error);
        return { cleared: false };
      }

      const res = parsed.result;
      const speaker = this.effectivePublicSpeaker();
      const hasCharIdentity = speaker.mode === 'character';
      const baseActorLabel = hasCharIdentity
        ? `${speaker.name} · Roll`
        : 'Dice Roll';
      const rollLabel = parsed.customLabel
        ? hasCharIdentity
          ? `${speaker.name} · ${parsed.customLabel}`
          : parsed.customLabel
        : baseActorLabel;

      const camp = this.campaign();
      const isGmPrivate = action === 'gm_roll';
      const recipientIds =
        isGmPrivate && camp?.gm_id ? [camp.gm_id] : undefined;

      const diceThrow = this.createDiceThrowPayload({
        label: isGmPrivate ? `${rollLabel} (GM)` : rollLabel,
        formula: res.formula,
        total: res.total,
        dice: res.physicalDice,
        senderNameOverride: speaker.name,
        recipientIds,
      });
      this.enqueueDiceThrow(diceThrow, true);

      await this.postLog({
        kind: 'roll',
        title: `${rollLabel} (${res.formula}) → ${res.total}`,
        detail: res.detail,
        senderNameOverride: speaker.name,
        payload: {
          chips: res.chips,
          groups: res.groups,
          formula: res.formula,
          modifier: res.modifier,
          total: res.total,
          diceThrow,
          ...this.buildSpeakerPayloadFields(speaker),
          ...(isGmPrivate
            ? {
                visibility: 'gm_roll',
                recipient_label: 'GM',
                ...(recipientIds ? { recipient_ids: recipientIds } : {}),
              }
            : {}),
        },
      });
      return { cleared: true };
    }

    if (action === 'whisper') {
      const parsedWhisper = this.resolveWhisperCommandArgs(resolved.rest);
      if (!parsedWhisper.ok) {
        this.notifications.error('Whisper Failed', parsedWhisper.error);
        return { cleared: false };
      }

      const speaker = this.effectivePublicSpeaker();
      await this.postLog({
        kind: 'chat',
        title: parsedWhisper.message,
        senderNameOverride: speaker.name,
        payload: {
          visibility: 'whisper',
          recipient_ids: parsedWhisper.recipientIds,
          recipient_label: parsedWhisper.recipientLabel,
          ...this.buildSpeakerPayloadFields(speaker),
        },
      });
      return { cleared: true };
    }

    if (action === 'emote') {
      if (!resolved.rest) {
        this.notifications.error(
          'Empty Emote',
          'Provide an action description after the emote command.'
        );
        return { cleared: false };
      }
      const speaker = this.effectivePublicSpeaker();
      await this.postLog({
        kind: 'chat',
        title: `${speaker.name} ${resolved.rest}`,
        senderNameOverride: speaker.name,
        payload: {
          emote: true,
          ...this.buildSpeakerPayloadFields(speaker),
        },
      });
      return { cleared: true };
    }

    if (action === 'clear') {
      if (!this.isGm()) {
        this.notifications.error(
          'Permission Denied',
          'Only the Game Master can clear the campaign log.'
        );
        return { cleared: false };
      }
      await this.clearAllLogs();
      return { cleared: true };
    }

    if (action === 'help') {
      const camp = this.campaign();
      const lines = registry
        .filter((c) => !c.gmOnly || this.isGm())
        .map((c) => {
          const allTriggers = getAllCommandTriggers(c).join(', ');
          const usage = c.usage ? ` ${c.usage}` : '';
          return `${allTriggers}${usage} — ${c.description}`;
        });

      const helpEntry: VttLogEntry = {
        id: `local-help-${Date.now()}`,
        campaign_id: camp?.id ?? 'local',
        encounter_id: this.activeScene()?.id ?? null,
        sender_id: this.authStore.user()?.id ?? null,
        sender_name: 'Command Reference',
        kind: 'system',
        title: 'Slash Commands & Shorthands',
        detail: lines.join('\n'),
        payload: {
          visibility: 'whisper',
          recipient_ids: this.authStore.user()?.id
            ? [this.authStore.user()!.id]
            : [],
          recipient_label: 'You',
        },
        created_at: new Date().toISOString(),
      };
      this.logs.update((curr) => [...curr, helpEntry]);
      return { cleared: true };
    }

    return { cleared: false };
  }

  canDeleteLog(entry: VttLogEntry): boolean {
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    return Boolean(uid && entry.sender_id && entry.sender_id === uid);
  }

  async deleteLogEntry(logId: string): Promise<void> {
    const target = this.logs().find((e) => e.id === logId);
    if (!target || !this.canDeleteLog(target)) return;

    this.logs.update((curr) => curr.filter((e) => e.id !== logId));
    const err = await this.vttService.deleteLog(logId);
    if (err) {
      this.logs.update((curr) =>
        curr.some((e) => e.id === target.id)
          ? curr
          : [...curr, target].sort((a, b) =>
              a.created_at.localeCompare(b.created_at)
            )
      );
      this.notifications.error('Unable to Delete Log', err);
    }
  }

  async clearAllLogs(): Promise<void> {
    const camp = this.campaign();
    if (!camp || !this.isGm()) return;
    const previous = this.logs();
    if (previous.length === 0) return;

    this.logs.set([]);
    const err = await this.vttService.clearCampaignLogs(camp.id);
    if (err) {
      this.logs.set(previous);
      this.notifications.error('Unable to Clear Logs', err);
    }
  }

  async postLog(input: {
    kind: VttLogEntry['kind'];
    title: string;
    detail?: string | null;
    payload?: Record<string, unknown>;
    senderNameOverride?: string;
  }): Promise<void> {
    const camp = this.campaign();
    if (!camp) return;
    const resolvedSender =
      input.senderNameOverride?.trim() ||
      this.authStore.displayName() ||
      'Adventurer';
    const entry = await this.vttService.insertLog({
      campaign_id: camp.id,
      encounter_id: this.activeScene()?.id ?? null,
      sender_id: this.authStore.user()?.id ?? null,
      sender_name: resolvedSender,
      kind: input.kind,
      title: input.title,
      detail: input.detail ?? null,
      payload: input.payload ?? {},
    });
    if (entry) {
      const alreadyPresent = this.logs().some((e) => e.id === entry.id);
      if (!alreadyPresent) {
        this.logs.update((curr) => [...curr, entry]);
        this.triggerLogAudioCue(entry.kind);
      }
    }
  }

  private triggerLogAudioCue(kind: VttLogEntry['kind']): void {
    if (kind === 'roll' || kind === 'clash' || kind === 'damage') {
      this.settingsStore.playUiCue('dice');
    } else if (kind === 'round') {
      this.settingsStore.playUiCue('turn');
    }
  }

  async pingWorldPoint(pt: VttPoint): Promise<void> {
    this.settingsStore.playUiCue('ping');
    await this.vttService.sendMapPing(this.realtimeChannel, {
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      senderName: this.authStore.displayName() || 'Player',
      color: this.isGm() ? '#FF8C5A' : '#38B29A',
      createdAt: Date.now(),
    });
  }

  getPerkCooldown(char: CharacterModel | null, perkId: string): number {
    if (!char) return 0;
    return Math.max(0, Number(char.active_cooldowns?.[perkId] ?? 0));
  }
}
