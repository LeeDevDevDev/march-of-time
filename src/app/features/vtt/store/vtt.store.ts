import { Injectable, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  ActiveCombatTag,
  CombatStatusEffect,
  WeaponModel,
  resolveWeaponVisuals,
} from '../../../core/compendium/compendium.model';
import { CompendiumStore } from '../../../core/compendium/compendium.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import {
  CharacterModel,
  DerivedCharacterStats,
  ResolvedCombatArt,
  UPGRADE_SLOT_PREFIX,
  computeDerivedStats,
} from '../../characters/models/character.model';
import { CharacterService } from '../../characters/services/character.service';
import { CharacterStore } from '../../characters/store/character.store';
import { GameCardModel } from '../../dashboard/models/campaign.model';
import {
  DefenderClashCapabilities,
  createManualRoll,
  getLegalDefenderReactions,
  resolveClashReaction,
  roll2d10Check,
} from '../engine/clash.engine';
import {
  HexGridGeometry,
  clampHexToBounds,
  getHexDistanceFeet,
  getHexWorldBounds,
  offsetToAxial,
} from '../engine/hex-grid.engine';
import {
  buildLightPolygons,
  buildObserverVisions,
  collectNewlyExploredHexKeys,
} from '../engine/visibility.engine';
import {
  VttClashResolution,
  VttDefenseChoice,
  VttFaction,
  VttLightSource,
  VttLogEntry,
  VttNpcPreset,
  VttPendingClash,
  VttPoint,
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

@Injectable({ providedIn: 'root' })
export class VttStore {
  private readonly vttService = inject(VttService);
  private readonly authStore = inject(AuthStore);
  private readonly compendiumStore = inject(CompendiumStore);
  private readonly characterStore = inject(CharacterStore);
  private readonly characterService = inject(CharacterService);
  private readonly notifications = inject(NotificationStore);

  private realtimeChannel: RealtimeChannel | null = null;

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly needsMigration = signal(false);

  readonly campaign = signal<GameCardModel | null>(null);
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

  readonly attackRollMode = signal<'normal' | 'advantage' | 'disadvantage'>(
    'normal'
  );
  readonly manualRollOverride = signal<number | null>(null);

  readonly isGm = computed(() => {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id;
    if (!camp || !uid) return false;
    return camp.gm_id === uid || this.authStore.isAdmin();
  });

  readonly activeScene = computed<VttSceneModel | null>(() => {
    const list = this.scenes();
    const sel = this.activeSceneId();
    if (sel) {
      const found = list.find((s) => s.id === sel);
      if (found) return found;
    }
    return list.find((s) => s.is_active_scene) ?? list[0] ?? null;
  });

  readonly gridGeometry = computed<HexGridGeometry>(() => {
    const sc = this.activeScene();
    return {
      gridWidth: sc?.grid_width ?? 16,
      gridHeight: sc?.grid_height ?? 11,
      gridSizePx: sc?.grid_size_px ?? 64,
      offsetX: sc?.grid_offset_x ?? 0,
      offsetY: sc?.grid_offset_y ?? 0,
    };
  });

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
    const all = this.sceneTokens().filter((t) => !t.is_hidden);
    const uid = this.authStore.user()?.id;
    const gm = this.isGm();

    if (gm) {
      if (!this.previewPlayerVision()) {
        return all.filter((t) => t.faction === 'ally');
      }
      const sel = this.selectedToken();
      if (sel && sel.faction === 'ally') {
        return [sel];
      }
      return all.filter((t) => t.faction === 'ally');
    }

    const owned = all.filter((t) => {
      if (t.owner_id && t.owner_id === uid) return true;
      if (t.character_id) {
        const ch = this.characterByIdMap().get(t.character_id);
        if (ch && ch.owner_id === uid) return true;
      }
      return false;
    });

    return owned.length > 0
      ? owned
      : all.filter((t) => t.faction === 'ally');
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
      ]);

      const [campRes, visibleChars] = await Promise.all([
        this.vttService.fetchCampaignById(campaignId),
        this.vttService.fetchAllVisibleCharacters(),
      ]);

      if (!campRes.data) {
        this.error.set(campRes.error ?? 'Campaign not found.');
        this.isLoading.set(false);
        return;
      }

      this.campaign.set(campRes.data);
      this.allCharacters.set(visibleChars);

      const scenesRes = await this.vttService.fetchCampaignScenes(
        campaignId,
        campRes.data.gm_id
      );
      this.needsMigration.set(scenesRes.needsMigration);

      let loadedScenes = scenesRes.scenes;
      const uid = this.authStore.user()?.id;
      const userIsGm =
        campRes.data.gm_id === uid || this.authStore.isAdmin();

      if (loadedScenes.length === 0 && userIsGm && uid) {
        const created = await this.vttService.createScene({
          campaign_id: campaignId,
          gm_id: uid,
          name: `${campRes.data.name} — Skirmish`,
          is_active_scene: true,
          grid_width: 16,
          grid_height: 11,
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

      const [initialTokens, initialLogs] = await Promise.all([
        initialScene
          ? this.vttService.fetchSceneTokens(initialScene.id)
          : Promise.resolve([]),
        this.vttService.fetchCampaignLogs(campaignId),
      ]);

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
            const hadScene = this.scenes().some(
              (s) => s.id === incomingScene.id
            );
            this.scenes.update((curr) =>
              hadScene
                ? curr.map((s) =>
                    s.id === incomingScene.id ? incomingScene : s
                  )
                : [...curr, incomingScene]
            );
            if (!this.isGm() && incomingScene.is_active_scene) {
              const prevActive = this.activeSceneId();
              if (prevActive !== incomingScene.id) {
                this.activeSceneId.set(incomingScene.id);
                void this.loadTokensForScene(incomingScene.id);
              }
            }
          },
          onEncounterDelete: (deletedId) => {
            this.scenes.update((curr) =>
              curr.filter((s) => s.id !== deletedId)
            );
            if (this.activeSceneId() === deletedId) {
              const fallback = this.scenes()[0]?.id ?? null;
              this.activeSceneId.set(fallback);
              if (fallback) {
                void this.loadTokensForScene(fallback);
              }
            }
          },
          onTokenUpsert: (incomingToken) => {
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
            this.logs.update((curr) =>
              curr.some((e) => e.id === entry.id) ? curr : [...curr, entry]
            );
          },
          onPing: (ping) => {
            this.activePings.update((curr) => [...curr, ping]);
            setTimeout(() => {
              this.activePings.update((curr) =>
                curr.filter((p) => p.createdAt !== ping.createdAt)
              );
            }, 2400);
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
    this.selectedTokenId.set(null);
    this.selectedLightId.set(null);
    this.activePings.set([]);
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
    this.activeSceneId.set(sceneId);
    await this.loadTokensForScene(sceneId);

    if (makePartyActive && this.isGm()) {
      const all = this.scenes();
      for (const sc of all) {
        const nextActive = sc.id === sceneId;
        if (sc.is_active_scene !== nextActive) {
          await this.patchScene(sc.id, { is_active_scene: nextActive });
        }
      }
      this.notifications.success(
        'Active Map Switched',
        'Players have been moved to this scene.'
      );
    }
  }

  async createNewScene(name: string, width = 16, height = 11): Promise<void> {
    const camp = this.campaign();
    const uid = this.authStore.user()?.id;
    if (!camp || !uid || !this.isGm()) return;

    const trimmed = name.trim() || 'New Battlemap';
    const res = await this.vttService.createScene({
      campaign_id: camp.id,
      gm_id: uid,
      name: trimmed,
      is_active_scene: false,
      grid_width: Math.max(6, Math.min(48, width)),
      grid_height: Math.max(6, Math.min(48, height)),
    });

    if (res.error || !res.scene) {
      this.notifications.error(
        'Unable to Create Scene',
        res.error ?? 'Unknown error.'
      );
      return;
    }

    this.scenes.update((curr) =>
      curr.some((s) => s.id === res.scene!.id) ? curr : [...curr, res.scene!]
    );
    await this.selectOrActivateScene(res.scene.id, true);
  }

  async patchScene(
    sceneId: string,
    patch: Partial<VttSceneModel>
  ): Promise<void> {
    this.scenes.update((curr) =>
      curr.map((s) => (s.id === sceneId ? { ...s, ...patch } : s))
    );
    const res = await this.vttService.updateScene(
      sceneId,
      patch,
      this.needsMigration()
    );
    if (res.needsMigration) {
      this.needsMigration.set(true);
    }
    if (res.error) {
      this.notifications.error('Scene Sync Error', res.error);
    }
  }

  async uploadActiveSceneMap(file: File): Promise<void> {
    const camp = this.campaign();
    const sc = this.activeScene();
    if (!camp || !sc || !this.isGm()) return;

    const res = await this.vttService.uploadMapImage(camp.id, file);
    if (res.error || !res.url) {
      this.notifications.error('Map Upload Failed', res.error ?? '');
      return;
    }

    await this.patchScene(sc.id, { map_image_url: res.url });
    this.notifications.success(
      'Battlemap Uploaded',
      'Custom map image applied to current scene.'
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

    const wall: VttWallSegment = {
      id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x1: Math.round(a.x),
      y1: Math.round(a.y),
      x2: Math.round(b.x),
      y2: Math.round(b.y),
      kind,
      open: kind === 'door' ? false : undefined,
    };

    await this.patchScene(sc.id, { walls: [...sc.walls, wall] });
    this.syncExploredFogFromObservers();
  }

  async toggleDoor(wallId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;
    const target = sc.walls.find((w) => w.id === wallId && w.kind === 'door');
    if (!target) return;

    const nextWalls = sc.walls.map((w) =>
      w.id === wallId ? { ...w, open: !w.open } : w
    );
    await this.patchScene(sc.id, { walls: nextWalls });
    this.syncExploredFogFromObservers();
  }

  async deleteWallSegment(wallId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    await this.patchScene(sc.id, {
      walls: sc.walls.filter((w) => w.id !== wallId),
    });
    this.syncExploredFogFromObservers();
  }

  async clearAllWalls(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
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
    await this.patchScene(sc.id, { lights: [...sc.lights, light] });
    this.selectedLightId.set(light.id);
    this.syncExploredFogFromObservers();
    return light;
  }

  async clearAllLights(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
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
    const nextLights = sc.lights.map((l) =>
      l.id === lightId ? { ...l, ...patch } : l
    );
    await this.patchScene(sc.id, { lights: nextLights });
    this.syncExploredFogFromObservers();
  }

  async deleteLightSource(lightId: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
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
    await this.patchScene(sc.id, {
      explored_fog: { cells: [], revealed_all: false },
    });
    this.syncExploredFogFromObservers();
  }

  async revealEntireMapFog(): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;
    await this.patchScene(sc.id, {
      explored_fog: {
        cells: sc.explored_fog.cells ?? [],
        revealed_all: true,
      },
    });
  }

  syncExploredFogFromObservers(): void {
    const sc = this.activeScene();
    if (!sc || !sc.fog_enabled || sc.explored_fog?.revealed_all) return;

    const observers = this.observerTokens();
    if (observers.length === 0) return;

    const geom = this.gridGeometry();
    const bounds = getHexWorldBounds(geom);
    const maxDiag = Math.hypot(bounds.width, bounds.height) + 200;

    const lights = buildLightPolygons(
      sc.lights,
      this.sceneTokens(),
      sc.walls,
      geom
    );
    const visions = buildObserverVisions(
      observers,
      sc.walls,
      geom,
      sc.global_illumination,
      maxDiag
    );

    const existing = new Set<string>(sc.explored_fog.cells ?? []);
    const newlySeen = collectNewlyExploredHexKeys(
      existing,
      visions,
      lights,
      sc.walls,
      geom,
      sc.global_illumination
    );

    if (newlySeen.length > 0) {
      const merged = [...existing, ...newlySeen];
      void this.patchScene(sc.id, {
        explored_fog: {
          ...sc.explored_fog,
          cells: merged,
        },
      });
    }
  }

  private findOpenSpawnHex(preferredFaction: VttFaction): {
    col: number;
    row: number;
  } {
    const geom = this.gridGeometry();
    const occupied = new Set(
      this.sceneTokens().map((t) => `${t.x},${t.y}`)
    );
    const startCol =
      preferredFaction === 'enemy'
        ? Math.max(1, geom.gridWidth - 3)
        : 2;
    const centerRow = Math.floor(geom.gridHeight / 2);

    for (let radius = 0; radius < Math.max(geom.gridWidth, geom.gridHeight); radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          const col = startCol + dc;
          const row = centerRow + dr;
          if (
            col >= 0 &&
            col < geom.gridWidth &&
            row >= 0 &&
            row < geom.gridHeight &&
            !occupied.has(`${col},${row}`)
          ) {
            return { col, row };
          }
        }
      }
    }

    return { col: 1, row: 1 };
  }

  async deployCharacterToken(character: CharacterModel): Promise<void> {
    const sc = this.activeScene();
    if (!sc) return;

    const existing = this.sceneTokens().find(
      (t) => t.character_id === character.id
    );
    if (existing) {
      this.selectedTokenId.set(existing.id);
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
    const spawn = this.findOpenSpawnHex('ally');
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
      npc_stats: {},
    });

    if (res.error || !res.token) {
      this.notifications.error(
        'Unable to Deploy Character',
        res.error ?? 'Unknown error.'
      );
      return;
    }

    this.tokens.update((curr) =>
      curr.some((t) => t.id === res.token!.id) ? curr : [...curr, res.token!]
    );
    this.selectedTokenId.set(res.token.id);
    this.syncExploredFogFromObservers();
    await this.postLog({
      kind: 'system',
      title: `${character.name} entered the battlefield`,
      detail: `HP ${res.token.current_hp}/${res.token.max_hp} · SP ${res.token.current_sp}/${res.token.max_sp} · Move ${res.token.move_feet} ft`,
    });
  }

  async spawnNpcPreset(preset: VttNpcPreset, customName?: string): Promise<void> {
    const sc = this.activeScene();
    if (!sc || !this.isGm()) return;

    const sameBaseCount = this.sceneTokens().filter((t) =>
      t.name.startsWith(customName?.trim() || preset.name)
    ).length;
    const finalName =
      customName?.trim() ||
      (sameBaseCount > 0 ? `${preset.name} ${sameBaseCount + 1}` : preset.name);

    const spawn = this.findOpenSpawnHex(preset.faction);
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

    this.tokens.update((curr) =>
      curr.some((t) => t.id === res.token!.id) ? curr : [...curr, res.token!]
    );
    this.selectedTokenId.set(res.token.id);
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
      this.needsMigration()
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
    freeOverride = false
  ): Promise<void> {
    const tok = this.sceneTokens().find((t) => t.id === tokenId);
    const sc = this.activeScene();
    if (!tok || !sc || !this.canControlToken(tok)) return;

    const clamped = clampHexToBounds(
      { col, row },
      sc.grid_width,
      sc.grid_height
    );
    if (clamped.col === tok.x && clamped.row === tok.y) return;

    const axial = offsetToAxial(clamped.col, clamped.row);
    const patch: Partial<VttTokenModel> = {
      x: clamped.col,
      y: clamped.row,
      q: axial.q,
      r: axial.r,
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

    await this.patchToken(tokenId, patch);
    this.syncExploredFogFromObservers();
  }

  async removeToken(tokenId: string): Promise<void> {
    const tok = this.tokens().find((t) => t.id === tokenId);
    if (!tok || !this.canControlToken(tok)) return;

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
      await this.patchToken(token.id, { shield_raised: false });
      return;
    }
    if (token.current_ap < 1) return;
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

    await this.postLog({
      kind: 'roll',
      title: `${attacker.name} · ${pending.actionName} → ${roll.total}`,
      detail: `2d10 (${roll.d1}+${roll.d2}) + ${roll.modifier} · ${pending.flatDamage} Flat DMG${pending.combatTags.length ? ' · ' + pending.combatTags.join('/') : ''}`,
      payload: { roll },
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
        const updated = { ...ch, current_ap: nextAp, active_cooldowns: nextCooldowns };
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

    const distFeet = getHexDistanceFeet(
      { col: attacker.x, row: attacker.y },
      { col: defender.x, row: defender.y }
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

    await this.patchScene(sc.id, { pending_clash: clash });
    await this.postLog({
      kind: 'clash',
      title: `${attacker.name} attacks ${defender.name} with ${pending.actionName} (Roll ${attackRoll.total})`,
      detail: `Distance ${distFeet} ft · ${pending.flatDamage} Raw DMG${pending.combatTags.length ? ' · [' + pending.combatTags.join(', ') + ']' : ''} — Awaiting ${defender.name}'s reaction`,
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
    const diceDetail =
      roll.d3 !== undefined
        ? `3d10 (${roll.d1}, ${roll.d2}, ${roll.d3} · ${mode})`
        : `2d10 (${roll.d1}+${roll.d2})`;
    await this.postLog({
      kind: 'roll',
      title: `${label} → ${roll.total}`,
      detail: `${diceDetail} ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)}`,
      payload: { roll },
    });
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
      this.logs.update((curr) =>
        curr.some((e) => e.id === entry.id) ? curr : [...curr, entry]
      );
    }
  }

  async pingWorldPoint(pt: VttPoint): Promise<void> {
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
