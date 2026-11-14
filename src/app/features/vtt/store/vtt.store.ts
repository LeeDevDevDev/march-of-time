import { Injectable, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UserAssetsStore } from '../../../core/assets/user-assets.store';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  ActiveCombatTag,
  CombatStatusEffect,
  WeaponModel,
  resolveWeaponVisuals,
} from '../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { VttSettingsStore } from '../../../core/settings/vtt-settings.store';
import {
  CharacterModel,
  DerivedCharacterStats,
  ResolvedCombatArt,
  UPGRADE_SLOT_PREFIX,
  computeDerivedStats,
} from '../../characters/models/character.model';
import { CharacterService } from '../../characters/services/character.service';
import { CharacterStore } from '../../characters/store/character.store';
import {
  ActorTemplateDraft,
  CollectionsStore,
  buildActorTemplateFromCharacter,
  buildActorTemplateFromNpcPreset,
} from '../../collections/collections.store';
import { GameCardModel } from '../../dashboard/models/campaign.model';
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
  DEFAULT_VTT_GRID_HEIGHT,
  DEFAULT_VTT_GRID_OPACITY,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_GRID_WIDTH,
  DEFAULT_VTT_SCENE_HEIGHT_PX,
  DEFAULT_VTT_SCENE_PADDING,
  DEFAULT_VTT_SCENE_WIDTH_PX,
  CollectionActorModel,
  HexCoord,
  VttClashResolution,
  VttDefenseChoice,
  VttDirectoryScope,
  VttExploredFog,
  VttFaction,
  VttFolderModel,
  VttLightSource,
  VttLogEntry,
  VttNpcPreset,
  VttPendingClash,
  VttPoint,
  VttRosterActorModel,
  VttRosterDragPayload,
  VttSceneModel,
  VttTokenModel,
  VttToolMode,
  VttWallKind,
  VttWallSegment,
} from '../models/vtt.model';
import { VttPingBroadcast, VttService } from '../services/vtt.service';

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
  readonly folders = signal<VttFolderModel[]>([]);
  readonly rosterActors = signal<VttRosterActorModel[]>([]);
  readonly draggingRosterPayload = signal<VttRosterDragPayload | null>(null);
  readonly scenes = signal<VttSceneModel[]>([]);
  readonly activeSceneId = signal<string | null>(null);
  readonly tokens = signal<VttTokenModel[]>([]);
  readonly logs = signal<VttLogEntry[]>([]);
  readonly allCharacters = signal<CharacterModel[]>([]);

  readonly activeTool = signal<VttToolMode>('select');
  readonly activeWallKind = signal<VttWallKind>('wall');
  readonly previewPlayerVision = signal(false);
  readonly enforceApOnMove = signal(false);

  readonly selectedTokenId = signal<string | null>(null);
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

  readonly selectedToken = computed<VttTokenModel | null>(() => {
    const id = this.selectedTokenId();
    if (!id) return null;
    return this.sceneTokens().find((t) => t.id === id) ?? null;
  });

  readonly characterByIdMap = computed(() => {
    const map = new Map<string, CharacterModel>();
    for (const c of this.allCharacters()) {
      map.set(c.id, c);
    }
    for (const c of this.characterStore.characters()) {
      map.set(c.id, c);
    }
    return map;
  });

  readonly selectedTokenCharacter = computed<CharacterModel | null>(() => {
    const tok = this.selectedToken();
    if (!tok?.character_id) return null;
    return this.characterByIdMap().get(tok.character_id) ?? null;
  });

  readonly selectedTokenDerived = computed<DerivedCharacterStats | null>(() => {
    const char = this.selectedTokenCharacter();
    if (!char) return null;
    return computeDerivedStats(
      char,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes()
    );
  });

  readonly observerTokens = computed<VttTokenModel[]>(() => {
    const sc = this.activeScene();
    if (!sc || !sc.token_vision) return [];

    const all = this.sceneTokens().filter((t) => !t.is_hidden);
    const gm = this.isGm();

    if (gm) {
      if (!this.previewPlayerVision()) {
        return all.filter((t) => t.faction === 'ally');
      }
      const sel = this.selectedToken();
      if (sel && !sel.is_hidden) {
        return [sel];
      }
      return all.filter((t) => t.faction === 'ally');
    }

    const controlled = all.filter((t) => this.canControlToken(t));
    const sel = this.selectedToken();
    if (sel && controlled.some((t) => t.id === sel.id)) {
      return [sel];
    }
    return controlled;
  });

  readonly initiativeTokens = computed<VttTokenModel[]>(() => {
    const sc = this.activeScene();
    const list = this.sceneTokens().filter(
      (t) => this.isGm() || !t.is_hidden
    );
    if (!sc || sc.initiative_order.length === 0) return list;

    const byId = new Map(list.map((t) => [t.id, t]));
    const ordered: VttTokenModel[] = [];
    for (const id of sc.initiative_order) {
      const found = byId.get(id);
      if (found) {
        ordered.push(found);
        byId.delete(id);
      }
    }
    for (const leftover of byId.values()) {
      ordered.push(leftover);
    }
    return ordered;
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
    const entry: VttUndoEntry = {
      ...payload,
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sceneId,
      label,
      createdAt: Date.now(),
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

  canControlToken(token: VttTokenModel | null | undefined): boolean {
    if (!token) return false;
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    if (!uid) return false;
    if (token.owner_id === uid) return true;
    if (token.character_id) {
      const ch = this.characterByIdMap().get(token.character_id);
      if (ch && ch.owner_id === uid) return true;
    }
    return false;
  }

  getDefenderCapabilities(token: VttTokenModel): DefenderClashCapabilities {
    if (token.character_id) {
      const ch = this.characterByIdMap().get(token.character_id);
      if (ch) {
        const stats = computeDerivedStats(
          ch,
          this.compendiumStore.allWeapons(),
          this.compendiumStore.allPerkNodes()
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

        const scenesRes = await this.vttService.fetchCampaignScenes(
          campaignId,
          campData.gm_id
        );
        this.needsMigration.set(scenesRes.needsMigration);
        loadedScenes = scenesRes.scenes;
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

      if (initialTokens.length > 0) {
        const myToken =
          initialTokens.find((t) => this.canControlToken(t)) ??
          initialTokens[0];
        this.selectedTokenId.set(myToken?.id ?? null);
      }

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
          },
          onRosterActorDelete: (actorId) => {
            this.rosterActors.update((curr) =>
              curr.filter((a) => a.id !== actorId)
            );
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
              if (this.selectedTokenId() === incomingToken.id) {
                this.selectedTokenId.set(null);
              }
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
            if (this.selectedTokenId() === tokenId) {
              this.selectedTokenId.set(null);
            }
          },
          onLogInsert: (entry) => {
            const alreadyPresent = this.logs().some((e) => e.id === entry.id);
            if (!alreadyPresent) {
              this.logs.update((curr) => [...curr, entry]);
              this.triggerLogAudioCue(entry.kind);
            }
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
    this.pendingTargetAction.set(null);
    this.draggingRosterPayload.set(null);
    this.selectedTokenId.set(null);
    this.selectedLightId.set(null);
    this.activePings.set([]);
    this.activeSceneNaturalSize.set(null);
    this.latestDiceThrow.set(null);
    this.seenDiceThrowIds.clear();
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
        sc.grid_mode
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

  async deployCharacterToken(
    character: CharacterModel,
    placement?: { worldPt: VttPoint; unsnapped: boolean }
  ): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;

    const existing = this.sceneTokens().find(
      (t) => t.character_id === character.id
    );
    if (existing) {
      this.selectedTokenId.set(existing.id);
      if (placement && this.canControlToken(existing)) {
        if (sc.grid_mode === 'gridless' || placement.unsnapped) {
          await this.moveTokenToWorldPoint(
            existing.id,
            placement.worldPt,
            0,
            true
          );
        } else {
          const resolved = this.resolveDropPlacement('ally', placement);
          await this.moveTokenToHex(
            existing.id,
            resolved.col,
            resolved.row,
            0,
            true
          );
        }
        return;
      }
      this.notifications.info(
        'Already Deployed',
        `${character.name} is already on this battlemap.`
      );
      return;
    }

    const stats = computeDerivedStats(
      character,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes()
    );
    const wepVis = stats.activeWeapon
      ? resolveWeaponVisuals(stats.activeWeapon)
      : { icon: 'greatsword', color: '#38B29A' };
    const spawn = this.resolveDropPlacement('ally', placement);
    const axial = offsetToAxial(spawn.col, spawn.row);

    const res = await this.vttService.insertToken({
      encounter_id: sc.id,
      character_id: character.id,
      owner_id: character.owner_id,
      name: character.name,
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
      current_hp: Math.min(character.current_hp, stats.maxHp),
      max_hp: stats.maxHp,
      current_sp: Math.min(character.current_sp, stats.maxSp),
      max_sp: stats.maxSp,
      current_ap: character.current_ap ?? 4,
      max_ap: 4,
      armor_dr: stats.armorDr,
      shield_block: stats.shieldBlockTotal,
      move_feet: stats.moveFeet,
      vision_feet: 60,
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: Boolean(character.active_cooldowns?.['__shield_raised']),
      is_hidden: false,
      statuses: [],
      npc_stats: spawn.unsnappedOnGrid ? { __unsnapped: true } : {},
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
    return Boolean(uid && actor.owner_id === uid);
  }

  canDeployRosterActor(actor: VttRosterActorModel): boolean {
    if (this.isGm()) return true;
    const uid = this.authStore.user()?.id;
    if (!uid) return false;
    if (actor.owner_id === uid) return true;
    if (actor.character_id) {
      const char =
        this.allCharacters().find((c) => c.id === actor.character_id) ??
        this.characterStore
          .characters()
          .find((c) => c.id === actor.character_id);
      if (char?.owner_id === uid) return true;
    }
    return false;
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
    if (!camp || !uid) return null;
    if (!this.isGm() && draft.actor_kind !== 'character') {
      return null;
    }

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

    const res = await this.vttService.createRosterActor({
      campaign_id: camp.id,
      folder_id: this.isGm() ? draft.folder_id || null : null,
      character_id: draft.source_character_id || null,
      collection_actor_id: linkedCollectionId,
      owner_id: options?.ownerId ?? uid,
      actor_kind: draft.actor_kind,
      is_unique: draft.is_unique,
      name: draft.name.trim() || 'Unnamed Actor',
      faction: this.isGm() ? draft.faction : 'ally',
      size: Math.max(1, Math.round(draft.size || 1)),
      icon: draft.icon || 'greatsword',
      color: draft.color || '#38B29A',
      max_hp: Math.max(1, Math.round(draft.max_hp || 10)),
      max_sp: Math.max(0, Math.round(draft.max_sp ?? 5)),
      max_ap: Math.max(1, Math.round(draft.max_ap || 4)),
      armor_dr: Math.max(0, Math.round(draft.armor_dr ?? 0)),
      shield_block: Math.max(0, Math.round(draft.shield_block ?? 0)),
      move_feet: Math.max(0, Math.round(draft.move_feet ?? 20)),
      vision_feet: Math.max(0, Math.round(draft.vision_feet ?? 60)),
      light_bright_feet: Math.max(0, Math.round(draft.light_bright_feet ?? 0)),
      light_dim_feet: Math.max(0, Math.round(draft.light_dim_feet ?? 0)),
      light_color: draft.light_color || '#F59E0B',
      npc_stats: { ...draft.npc_stats },
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

  async importCharacterToRoster(
    character: CharacterModel,
    folderId: string | null = null
  ): Promise<VttRosterActorModel | null> {
    const existing = this.rosterActors().find(
      (a) => a.character_id === character.id
    );
    if (existing) {
      if (this.isGm() && folderId !== existing.folder_id) {
        await this.updateRosterActor(existing.id, { folder_id: folderId });
      }
      this.notifications.info(
        'Already in Actors',
        `${character.name} is already loaded in Actors.`
      );
      return existing;
    }

    if (
      !this.allCharacters().some((c) => c.id === character.id)
    ) {
      this.allCharacters.update((curr) => [...curr, character]);
    }

    const draft = buildActorTemplateFromCharacter(
      character,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes(),
      folderId
    );
    return this.createRosterActorFromScratch(draft, {
      ownerId: character.owner_id,
    });
  }

  async importCollectionActorToRoster(
    colActor: CollectionActorModel,
    folderId: string | null = null
  ): Promise<VttRosterActorModel | null> {
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
        light_bright_feet: colActor.light_bright_feet,
        light_dim_feet: colActor.light_dim_feet,
        light_color: colActor.light_color,
        npc_stats: { ...colActor.npc_stats },
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

    this.rosterActors.update((curr) =>
      curr.map((a) => (a.id === actorId ? { ...a, ...patch } : a))
    );

    const err = await this.vttService.updateRosterActor(
      camp.id,
      actorId,
      patch
    );
    if (err) {
      this.notifications.error('Actor Update Error', err);
      return false;
    }
    return true;
  }

  async duplicateRosterActor(
    actorId: string
  ): Promise<VttRosterActorModel | null> {
    const existing = this.rosterActors().find((a) => a.id === actorId);
    if (!existing || !this.canManageRosterActor(existing)) return null;

    return this.createRosterActorFromScratch({
      folder_id: existing.folder_id,
      source_character_id: existing.character_id,
      actor_kind: existing.actor_kind,
      is_unique: existing.is_unique,
      name: `${existing.name} (Copy)`,
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
      light_bright_feet: existing.light_bright_feet,
      light_dim_feet: existing.light_dim_feet,
      light_color: existing.light_color,
      npc_stats: { ...existing.npc_stats },
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
    if (!camp || !existing || !this.canManageRosterActor(existing)) return;

    this.rosterActors.update((curr) => curr.filter((a) => a.id !== actorId));
    const err = await this.vttService.deleteRosterActor(camp.id, actorId);
    if (err) {
      this.notifications.error('Actor Delete Error', err);
    }
  }

  async saveRosterActorToCollections(
    actorId: string
  ): Promise<CollectionActorModel | null> {
    const existing = this.rosterActors().find((a) => a.id === actorId);
    if (!existing) return null;

    const saved = await this.collectionsStore.createActorFromScratch({
      folder_id: null,
      source_character_id: existing.character_id,
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
      light_bright_feet: existing.light_bright_feet,
      light_dim_feet: existing.light_dim_feet,
      light_color: existing.light_color,
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

    const isUniquePersona = actor.is_unique || Boolean(actor.character_id);
    if (isUniquePersona) {
      const existingToken = this.sceneTokens().find(
        (t) =>
          (actor.character_id && t.character_id === actor.character_id) ||
          t.npc_stats?.__roster_actor_id === actor.id
      );
      if (existingToken) {
        this.selectedTokenId.set(existingToken.id);
        if (placement && this.canControlToken(existingToken)) {
          if (sc.grid_mode === 'gridless' || placement.unsnapped) {
            await this.moveTokenToWorldPoint(
              existingToken.id,
              placement.worldPt,
              0,
              true
            );
          } else {
            const resolved = this.resolveDropPlacement(
              actor.faction,
              placement
            );
            await this.moveTokenToHex(
              existingToken.id,
              resolved.col,
              resolved.row,
              0,
              true
            );
          }
          return (
            this.sceneTokens().find((t) => t.id === existingToken.id) ??
            existingToken
          );
        }
        this.notifications.info(
          'Already Deployed',
          `${actor.name} is already on this scene.`
        );
        return existingToken;
      }
    }

    const linkedChar = actor.character_id
      ? (this.allCharacters().find((c) => c.id === actor.character_id) ??
        this.characterStore
          .characters()
          .find((c) => c.id === actor.character_id) ??
        null)
      : null;

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
        this.compendiumStore.allPerkNodes()
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

    let finalName = actor.name;
    if (!isUniquePersona) {
      const sameBaseCount = this.sceneTokens().filter((t) =>
        t.name.startsWith(actor.name)
      ).length;
      if (sameBaseCount > 0) {
        finalName = `${actor.name} ${sameBaseCount + 1}`;
      }
    }

    const spawn = this.resolveDropPlacement(actor.faction, placement);
    const axial = offsetToAxial(spawn.col, spawn.row);

    const res = await this.vttService.insertToken({
      encounter_id: sc.id,
      character_id: actor.character_id,
      owner_id:
        linkedChar?.owner_id ??
        actor.owner_id ??
        this.authStore.user()?.id ??
        null,
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
      light_bright_feet: actor.light_bright_feet,
      light_dim_feet: actor.light_dim_feet,
      light_color: actor.light_color || '#FF9B42',
      shield_raised: shieldRaised,
      is_hidden: false,
      statuses: [],
      npc_stats: {
        ...actor.npc_stats,
        __roster_actor_id: actor.id,
        __unsnapped: spawn.unsnappedOnGrid,
      },
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

    const res = await this.vttService.insertToken({
      encounter_id: sc.id,
      character_id: null,
      owner_id: this.authStore.user()?.id ?? null,
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
      light_bright_feet: 0,
      light_dim_feet: 0,
      light_color: '#FF9B42',
      shield_raised: false,
      is_hidden: false,
      statuses: [],
      npc_stats: { ...preset.npc_stats },
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

    if (
      existing.character_id &&
      (patch.current_hp !== undefined ||
        patch.current_sp !== undefined ||
        patch.current_ap !== undefined ||
        patch.shield_raised !== undefined)
    ) {
      await this.syncTokenVitalsToCharacter(existing.character_id, patch);
    }
  }

  private async syncTokenVitalsToCharacter(
    characterId: string,
    patch: Partial<VttTokenModel>
  ): Promise<void> {
    const char = this.characterByIdMap().get(characterId);
    if (!char) return;
    const uid = this.authStore.user()?.id;
    if (char.owner_id !== uid && !this.authStore.isAdmin()) return;

    const nextCooldowns = { ...(char.active_cooldowns ?? {}) };
    if (patch.shield_raised !== undefined) {
      if (patch.shield_raised) {
        nextCooldowns['__shield_raised'] = 1;
      } else {
        delete nextCooldowns['__shield_raised'];
      }
    }

    const updated: CharacterModel = {
      ...char,
      current_hp:
        patch.current_hp !== undefined ? patch.current_hp : char.current_hp,
      current_sp:
        patch.current_sp !== undefined ? patch.current_sp : char.current_sp,
      current_ap:
        patch.current_ap !== undefined ? patch.current_ap : char.current_ap,
      active_cooldowns: nextCooldowns,
    };

    this.allCharacters.update((list) =>
      list.map((c) => (c.id === characterId ? updated : c))
    );
    await this.characterService.updateCharacterRecord(characterId, updated);
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
    if (this.selectedTokenId() === tokenId) {
      this.selectedTokenId.set(null);
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
    if (token.character_id) {
      const ch = this.characterByIdMap().get(token.character_id);
      if (ch) {
        const stats = computeDerivedStats(
          ch,
          this.compendiumStore.allWeapons(),
          this.compendiumStore.allPerkNodes()
        );
        recoveryAmount = stats.stanceRecoverySp;
      }
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
    if (!token.character_id || token.current_ap < 1) return;
    const ch = this.characterByIdMap().get(token.character_id);
    if (!ch) return;

    const nextSlot: 1 | 2 = ch.active_weapon_slot === 1 ? 2 : 1;
    const updatedChar: CharacterModel = {
      ...ch,
      active_weapon_slot: nextSlot,
      current_ap: Math.max(0, token.current_ap - 1),
    };
    const nextStats = computeDerivedStats(
      updatedChar,
      this.compendiumStore.allWeapons(),
      this.compendiumStore.allPerkNodes()
    );
    const vis = nextStats.activeWeapon
      ? resolveWeaponVisuals(nextStats.activeWeapon)
      : { icon: token.icon ?? 'greatsword' };

    this.allCharacters.update((list) =>
      list.map((c) => (c.id === ch.id ? updatedChar : c))
    );
    await this.characterService.updateCharacterRecord(ch.id, updatedChar);
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
    if (weapon && stats && token.character_id) {
      const ch = this.characterByIdMap().get(token.character_id);
      if (!ch) return;
      const reachFeet = Math.max(
        (weapon.reach_tiles ?? 1) * 5,
        (weapon.thrown_range_tiles ?? 0) * 5
      );
      const hooks = weapon.rule_hooks ?? {};
      this.pendingTargetAction.set({
        attackerTokenId: token.id,
        kind: 'weapon',
        actionName: `${weapon.name} Strike`,
        apCost: weapon.ap_cost,
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
    const reachFeet = wep
      ? Math.max(
          (wep.reach_tiles ?? 1) * 5,
          (wep.thrown_range_tiles ?? 0) * 5
        )
      : 5;

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

    if (
      attacker.character_id &&
      action.perkId &&
      action.cooldownRounds > 0
    ) {
      const ch = this.characterByIdMap().get(attacker.character_id);
      if (ch) {
        const nextCooldowns = {
          ...(ch.active_cooldowns ?? {}),
          [action.perkId]: action.cooldownRounds,
        };
        const updated = {
          ...ch,
          current_ap: nextAp,
          active_cooldowns: nextCooldowns,
        };
        this.allCharacters.update((list) =>
          list.map((c) => (c.id === ch.id ? updated : c))
        );
        await this.characterService.updateCharacterRecord(ch.id, updated);
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
    const attackRoll =
      manual !== null
        ? createManualRoll(manual, pending.attackMod)
        : roll2d10Check(pending.attackMod, this.attackRollMode());

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
      attackRoll,
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

    const built = buildPhysicalDiceFrom2d10Roll(attackRoll);
    let diceThrow: VttDiceThrowPayload | undefined;
    if (manual === null) {
      diceThrow = this.createDiceThrowPayload({
        label: `${attacker.name} · ${pending.actionName}`,
        formula: built.formula,
        total: attackRoll.total,
        dice: built.physicalDice,
        senderNameOverride: attacker.name,
      });
      this.enqueueDiceThrow(diceThrow, true);
    }

    await this.patchScene(sc.id, { pending_clash: clash });
    await this.postLog({
      kind: 'clash',
      title: `${attacker.name} attacks ${defender.name} with ${pending.actionName} (Roll ${attackRoll.total})`,
      detail: `Distance ${distFeet} ft · ${pending.flatDamage} Raw DMG${pending.combatTags.length ? ' · [' + pending.combatTags.join(', ') + ']' : ''} — Awaiting ${defender.name}'s reaction`,
      payload: {
        roll: attackRoll,
        chips: built.chips,
        ...(diceThrow ? { diceThrow } : {}),
      },
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

    const resolution = resolveClashReaction(clash, reaction, caps, customRoll);
    if (
      (reaction === 'parry' || reaction === 'dodge') &&
      customRoll === undefined &&
      resolution.defenseRoll
    ) {
      const built = buildPhysicalDiceFrom2d10Roll(resolution.defenseRoll);
      const reactionLabel = reaction === 'parry' ? 'Parry' : 'Dodge';
      const diceThrow = this.createDiceThrowPayload({
        label: `${defender.name} · ${reactionLabel}`,
        formula: built.formula,
        total: resolution.defenseRoll.total,
        dice: built.physicalDice,
        senderNameOverride: defender.name,
      });
      this.settingsStore.playUiCue('dice');
      this.enqueueDiceThrow(diceThrow, true);
    }

    await this.patchScene(sc.id, {
      pending_clash: {
        ...clash,
        selectedReaction: reaction,
        resolution,
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
    if (!sc) return;
    await this.patchScene(sc.id, { pending_clash: null });
  }

  async startCombatEncounter(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    const visible = this.sceneTokens().filter((t) => !t.is_hidden);
    if (visible.length === 0) return;

    const allies = visible.filter((t) => t.faction === 'ally');
    const others = visible.filter((t) => t.faction !== 'ally');
    const interleaved: string[] = [];
    const maxLen = Math.max(allies.length, others.length);
    for (let i = 0; i < maxLen; i++) {
      if (allies[i]) interleaved.push(allies[i].id);
      if (others[i]) interleaved.push(others[i].id);
    }

    const firstId = interleaved[0] ?? null;
    for (const tok of visible) {
      await this.patchToken(tok.id, {
        current_ap: tok.max_ap,
        shield_raised: false,
      });
    }

    await this.patchScene(sc.id, {
      combat_active: true,
      round_number: 1,
      initiative_order: interleaved,
      active_turn_token_id: firstId,
    });
    this.enforceApOnMove.set(true);
    await this.postLog({
      kind: 'round',
      title: 'Combat Started — Round 1',
      detail: `${interleaved.length} combatants ready · All AP refreshed`,
    });
  }

  async advanceTurn(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    const order = this.initiativeTokens().filter((t) => t.current_hp > 0);
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

    if (nextTok.character_id) {
      const ch = this.characterByIdMap().get(nextTok.character_id);
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
        const updated = {
          ...ch,
          current_ap: nextTok.max_ap,
          active_cooldowns: nextCd,
        };
        this.allCharacters.update((list) =>
          list.map((c) => (c.id === ch.id ? updated : c))
        );
        await this.characterService.updateCharacterRecord(ch.id, updated);
      }
    }

    await this.patchScene(sc.id, {
      round_number: nextRound,
      active_turn_token_id: nextTok.id,
      initiative_order: order.map((t) => t.id),
    });

    await this.postLog({
      kind: 'round',
      title: `Round ${nextRound} — ${nextTok.name}'s Turn`,
      detail: `AP refreshed to ${nextTok.max_ap} · Guard reset`,
    });
  }

  async endCombatEncounter(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    await this.patchScene(sc.id, {
      combat_active: false,
      active_turn_token_id: null,
      pending_clash: null,
    });
    this.enforceApOnMove.set(false);
    await this.postLog({
      kind: 'round',
      title: 'Combat Ended',
      detail: 'Returned to exploration mode.',
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
    };
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
    this.latestDiceThrow.set(payload);

    if (broadcastToRoom) {
      void this.vttService.sendDiceThrow?.(this.realtimeChannel, payload);
    }
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
  }): Promise<void> {
    const camp = this.campaign();
    if (!camp) return;
    const entry = await this.vttService.insertLog({
      campaign_id: camp.id,
      encounter_id: this.activeScene()?.id ?? null,
      sender_id: this.authStore.user()?.id ?? null,
      sender_name: this.authStore.displayName() || 'Adventurer',
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
