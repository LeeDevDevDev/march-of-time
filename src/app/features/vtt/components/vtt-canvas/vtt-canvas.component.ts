import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VttSettingsStore } from '../../../../core/settings/vtt-settings.store';
import { ColorPickerComponent } from '../../../../shared/color-picker/color-picker.component';
import { TokenAvatarComponent } from '../../../../shared/token-avatar/token-avatar.component';
import {
  HexPathResult,
  TokenTravelAnimation,
  clampHexToBounds,
  clampWorldPointToBounds,
  createTokenTravelAnimation,
  feetToWorldPixels,
  findHexPath,
  getHexDistanceFeet,
  getHexPolygonPoints,
  getHexRadius,
  getTileSizePx,
  getTokenDistanceFeet,
  getTokenWorldCenter,
  hexKey,
  hexToWorldCenter,
  isHexInBounds,
  isWorldSegmentBlockedByWalls,
  parseHexKey,
  sampleTokenTravelAnimation,
  worldPixelsToFeet,
  worldPointToHex,
} from '../../engine/hex-grid.engine';
import {
  ComputedLightPolygon,
  ComputedObserverVision,
  buildLightPolygons,
  buildObserverVisions,
  isWorldPointVisibleToObservers,
} from '../../engine/visibility.engine';
import {
  DEFAULT_VTT_BG_COLOR,
  HexCoord,
  TokenAppearanceConfig,
  VttGridMode,
  VttLightSource,
  VttPoint,
  VttRosterDragPayload,
  VttTokenModel,
  VttWallSegment,
  normalizeTokenRotation,
} from '../../models/vtt.model';
import { BatchTokenMoveInput, VttStore } from '../../store/vtt.store';
import { VttFloatingWindowComponent } from '../vtt-floating-window/vtt-floating-window.component';

interface DragCompanionTokenState {
  tokenId: string;
  startHex: HexCoord;
  currentHex: HexCoord;
  startWorld: VttPoint;
  currentWorld: VttPoint;
  reachable: boolean;
  feet: number;
}

interface DragTokenState {
  tokenId: string;
  gridMode: VttGridMode;
  freeUnsnap: boolean;
  startHex: HexCoord;
  currentHex: HexCoord;
  startWorld: VttPoint;
  currentWorld: VttPoint;
  pointerDownWorld: VttPoint;
  hasMoved: boolean;
  shiftOverride: boolean;
  pathResult: HexPathResult;
  gridlessBlocked: boolean;
  gridlessFeet: number;
  companions: DragCompanionTokenState[];
  toggleOffOnClick: boolean;
  narrowToSingleOnClick: boolean;
}

interface MarqueeSelectState {
  startWorld: VttPoint;
  currentWorld: VttPoint;
  startScreen: VttPoint;
  currentScreen: VttPoint;
  additive: boolean;
  initialSelectedIds: string[];
  hasMoved: boolean;
}

export interface MarqueeBoxView {
  left: number;
  top: number;
  width: number;
  height: number;
  count: number;
}

export interface ChainedMoveLeg {
  fromHex: HexCoord;
  toHex: HexCoord;
  fromWorld: VttPoint;
  toWorld: VttPoint;
  hexPath: HexCoord[];
  feet: number;
  cumulativeFeet: number;
  shiftOverride: boolean;
  freeUnsnap: boolean;
}

export interface ChainedTokenMoveState {
  tokenId: string;
  tokenName: string;
  gridMode: VttGridMode;
  originHex: HexCoord;
  originWorld: VttPoint;
  currentHex: HexCoord;
  currentWorld: VttPoint;
  legs: ChainedMoveLeg[];
  totalFeet: number;
  anyShiftOverride: boolean;
  lastUnsnapped: boolean;
}

interface RosterDropPreviewState {
  worldPt: VttPoint;
  hex: HexCoord;
  unsnapped: boolean;
  name: string;
  color: string;
}

interface DragLightState {
  lightId: string;
  startPoint: VttPoint;
  currentPoint: VttPoint;
  hasMoved: boolean;
}

interface LightPlacementDraft {
  origin: VttPoint;
  current: VttPoint;
  dragged: boolean;
  brightFeet: number;
  dimFeet: number;
}

export interface LightContextMenuState {
  lightId: string;
  screenX: number;
  screenY: number;
}

export interface TokenContextMenuState {
  tokenId: string;
  screenX: number;
  screenY: number;
}

export interface EditingLightDraft {
  lightId: string;
  bright_feet: number;
  dim_feet: number;
  color: string;
  enabled: boolean;
}

export interface RenderableVttToken {
  token: VttTokenModel;
  center: VttPoint;
  radiusPx: number;
  tileSizePx: number;
  hpPct: number;
  spPct: number;
  isSelected: boolean;
  isTurnActive: boolean;
  isControllable: boolean;
  isTargetable: boolean;
  inTargetReach: boolean;
  distanceFromAttackerFeet: number | null;
  apPips: number[];
  flipX: boolean;
  flipY: boolean;
  rotationDeg: number;
  artTransform: string;
  tokenImageUrl: string | null;
  tokenAppearance: TokenAppearanceConfig;
}

export interface RenderableDoorHandle {
  wall: VttWallSegment;
  x: number;
  y: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#FF9B42').replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) || 255;
    const g = parseInt(clean.slice(2, 4), 16) || 155;
    const b = parseInt(clean.slice(4, 6), 16) || 66;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(255, 155, 66, ${alpha})`;
}

@Component({
  selector: 'app-vtt-canvas',
  standalone: true,
  imports: [
    FormsModule,
    ColorPickerComponent,
    TokenAvatarComponent,
    VttFloatingWindowComponent,
  ],
  templateUrl: './vtt-canvas.component.html',
})
export class VttCanvasComponent implements AfterViewInit {
  readonly vttStore = inject(VttStore);
  readonly settingsStore = inject(VttSettingsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly requestCreateMap = output<void>();

  readonly lightColorSwatches = [
    '#FF9B42',
    '#FEF08A',
    '#38BDF8',
    '#38B29A',
    '#C084FC',
    '#F43F5E',
  ];

  readonly viewportRef = viewChild.required<ElementRef<HTMLDivElement>>('viewportEl');
  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('battleCanvas');

  readonly viewportWidth = signal(1200);
  readonly viewportHeight = signal(760);

  readonly panX = signal(48);
  readonly panY = signal(48);
  readonly zoom = signal(1);
  readonly spacePressed = signal(false);
  readonly ctrlPressed = signal(false);
  readonly shiftPressed = signal(false);
  readonly isPanning = signal(false);

  readonly hoveredHex = signal<HexCoord | null>(null);
  readonly lastPointerWorld = signal<VttPoint | null>(null);
  readonly rosterDropPreview = signal<RosterDropPreviewState | null>(null);
  readonly dragTokenState = signal<DragTokenState | null>(null);
  readonly marqueeSelectState = signal<MarqueeSelectState | null>(null);
  readonly chainedTokenMove = signal<ChainedTokenMoveState | null>(null);
  readonly dragLightState = signal<DragLightState | null>(null);
  readonly lightPlacementDraft = signal<LightPlacementDraft | null>(null);
  readonly lightContextMenu = signal<LightContextMenuState | null>(null);
  readonly tokenContextMenu = signal<TokenContextMenuState | null>(null);
  readonly editingLightDraft = signal<EditingLightDraft | null>(null);
  readonly rulerStart = signal<HexCoord | null>(null);
  readonly rulerCurrent = signal<HexCoord | null>(null);
  readonly rulerWorldStart = signal<VttPoint | null>(null);
  readonly rulerWorldCurrent = signal<VttPoint | null>(null);
  readonly wallDraftStart = signal<VttPoint | null>(null);
  readonly wallDraftCurrent = signal<VttPoint | null>(null);

  readonly mapImage = signal<HTMLImageElement | null>(null);
  readonly mapNaturalSize = signal<{ width: number; height: number } | null>(null);
  readonly tokenAnimPositions = signal<Record<string, VttPoint>>({});

  private loadedMapUrl: string | null = null;
  private lastFittedSceneId: string | null = null;
  private trackedAnimSceneId: string | null = null;
  private readonly activeTokenAnimations = new Map<string, TokenTravelAnimation>();
  private readonly lastTokenCenters = new Map<string, VttPoint>();
  private tokenTravelAnimFrame: number | null = null;
  private offscreenFogCanvas: HTMLCanvasElement | null = null;
  private panPointerStart: {
    x: number;
    y: number;
    origPanX: number;
    origPanY: number;
  } | null = null;
  private pingAnimFrame: number | null = null;
  private suppressContextMenuUntil = 0;
  private suppressRightPanUntilPointerUp = false;
  private readonly isMacPlatform =
    typeof navigator !== 'undefined' &&
    /mac|ipod|iphone|ipad/i.test(navigator.platform || navigator.userAgent || '');

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  readonly isGridless = computed(
    () => this.vttStore.activeScene()?.grid_mode === 'gridless'
  );

  readonly marqueeBoxRect = computed<MarqueeBoxView | null>(() => {
    const m = this.marqueeSelectState();
    if (!m || !m.hasMoved) return null;
    const left = Math.min(m.startScreen.x, m.currentScreen.x);
    const top = Math.min(m.startScreen.y, m.currentScreen.y);
    const width = Math.max(1, Math.abs(m.currentScreen.x - m.startScreen.x));
    const height = Math.max(1, Math.abs(m.currentScreen.y - m.startScreen.y));
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
      count: this.vttStore.controllableSelectedTokens().length,
    };
  });

  readonly worldBounds = computed(() => {
    const layout = this.vttStore.sceneLayout();
    return {
      width: layout.totalWidth,
      height: layout.totalHeight,
    };
  });

  readonly effectiveSceneLights = computed<VttLightSource[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    const dragging = this.dragLightState();
    const editing = this.editingLightDraft();
    const placing = this.lightPlacementDraft();

    const mapped = sc.lights.map((l) => {
      let next = l;
      if (dragging && l.id === dragging.lightId) {
        next = {
          ...next,
          x: Math.round(dragging.currentPoint.x),
          y: Math.round(dragging.currentPoint.y),
        };
      }
      if (editing && l.id === editing.lightId) {
        next = {
          ...next,
          bright_feet: editing.bright_feet,
          dim_feet: editing.dim_feet,
          color: editing.color,
          enabled: editing.enabled,
        };
      }
      return next;
    });

    if (placing && placing.dragged) {
      mapped.push({
        id: '__placement-preview__',
        x: Math.round(placing.origin.x),
        y: Math.round(placing.origin.y),
        bright_feet: placing.brightFeet,
        dim_feet: placing.dimFeet,
        color: '#FF9B42',
        enabled: true,
      });
    }

    return mapped;
  });

  readonly contextMenuLight = computed<VttLightSource | null>(() => {
    const menu = this.lightContextMenu();
    if (!menu) return null;
    return (
      this.effectiveSceneLights().find((l) => l.id === menu.lightId) ?? null
    );
  });

  readonly contextMenuToken = computed<VttTokenModel | null>(() => {
    const menu = this.tokenContextMenu();
    if (!menu) return null;
    return (
      this.vttStore.sceneTokens().find((t) => t.id === menu.tokenId) ?? null
    );
  });

  readonly contextMenuTargetTokens = computed<VttTokenModel[]>(() => {
    const primary = this.contextMenuToken();
    if (!primary) return [];
    const selected = this.vttStore.controllableSelectedTokens();
    if (selected.length > 1 && selected.some((t) => t.id === primary.id)) {
      return selected;
    }
    return [primary];
  });

  readonly contextMenuAllHidden = computed<boolean>(() => {
    const targets = this.contextMenuTargetTokens();
    return targets.length > 0 && targets.every((t) => t.is_hidden);
  });

  readonly contextMenuSomeHidden = computed<boolean>(() =>
    this.contextMenuTargetTokens().some((t) => t.is_hidden)
  );

  readonly contextMenuAnyRotated = computed<boolean>(() =>
    this.contextMenuTargetTokens().some(
      (t) => normalizeTokenRotation(t.npc_stats?.__rotation) !== 0
    )
  );

  readonly animatedSceneTokens = computed<VttTokenModel[]>(() => {
    const tokens = this.vttStore.sceneTokens();
    const animPos = this.tokenAnimPositions();
    if (Object.keys(animPos).length === 0) return tokens;
    return tokens.map((tok) => {
      const pt = animPos[tok.id];
      if (!pt) return tok;
      return {
        ...tok,
        world_x: pt.x,
        world_y: pt.y,
        npc_stats: { ...(tok.npc_stats ?? {}), __unsnapped: true },
      };
    });
  });

  readonly animatedObserverTokens = computed<VttTokenModel[]>(() => {
    const observers = this.vttStore.observerTokens();
    const animPos = this.tokenAnimPositions();
    if (Object.keys(animPos).length === 0) return observers;
    return observers.map((tok) => {
      const pt = animPos[tok.id];
      if (!pt) return tok;
      return {
        ...tok,
        world_x: pt.x,
        world_y: pt.y,
        npc_stats: { ...(tok.npc_stats ?? {}), __unsnapped: true },
      };
    });
  });

  readonly lightPolygons = computed<ComputedLightPolygon[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    return buildLightPolygons(
      this.effectiveSceneLights(),
      this.animatedSceneTokens(),
      sc.walls,
      this.vttStore.gridGeometry(),
      sc.grid_mode
    );
  });

  readonly observerVisions = computed<ComputedObserverVision[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc || !sc.token_vision) return [];
    const wb = this.worldBounds();
    const maxDiag = Math.hypot(wb.width, wb.height) + 300;
    return buildObserverVisions(
      this.animatedObserverTokens(),
      sc.walls,
      this.vttStore.gridGeometry(),
      sc.global_illumination,
      maxDiag,
      sc.grid_mode,
      sc.darkness_level
    );
  });

  readonly activeRulerPath = computed<HexPathResult | null>(() => {
    const start = this.rulerStart();
    const end = this.rulerCurrent();
    if (!start || !end) return null;
    return findHexPath(
      start,
      end,
      this.vttStore.gridGeometry(),
      this.vttStore.activeScene()?.walls ?? []
    );
  });

  readonly wallDraftFeet = computed<number>(() => {
    const a = this.wallDraftStart();
    const b = this.wallDraftCurrent();
    if (!a || !b) return 0;
    const distPx = Math.hypot(b.x - a.x, b.y - a.y);
    return Math.max(
      5,
      worldPixelsToFeet(distPx, this.vttStore.gridGeometry().gridSizePx)
    );
  });

  readonly renderableTokens = computed<RenderableVttToken[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    const geom = this.vttStore.gridGeometry();
    const isGm = this.vttStore.isGm();
    const preview = this.vttStore.previewPlayerVision();
    const restrictVision = !isGm || preview;
    const observerIds = new Set(
      this.vttStore.observerTokens().map((o) => o.id)
    );
    const visions = this.observerVisions();
    const lights = this.lightPolygons();
    const drag = this.dragTokenState();
    const chain = this.chainedTokenMove();
    const animPos = this.tokenAnimPositions();
    const instantMove = this.settingsStore.preferences().tokenMoveSpeed <= 0;
    const selectedIdSet = new Set(this.vttStore.selectedTokenIds());
    const pendingTarget = this.vttStore.pendingTargetAction();
    const attackerTok = pendingTarget
      ? this.vttStore
          .sceneTokens()
          .find((t) => t.id === pendingTarget.attackerTokenId) ?? null
      : null;

    const results: RenderableVttToken[] = [];
    const orderedTokens = this.vttStore
      .sceneTokens()
      .map((tok, idx) => ({
        tok,
        idx,
        z: Number(tok.npc_stats?.__z_index ?? 0),
      }))
      .sort((a, b) => (a.z !== b.z ? a.z - b.z : a.idx - b.idx))
      .map((entry) => entry.tok);

    for (const tok of orderedTokens) {
      const controllable = this.vttStore.canControlToken(tok);

      if (tok.is_hidden && restrictVision) {
        continue;
      }

      const restingCenter =
        animPos[tok.id] ?? getTokenWorldCenter(tok, geom, sc.grid_mode);

      if (
        restrictVision &&
        sc.token_vision &&
        !sc.explored_fog?.revealed_all &&
        (!controllable || preview) &&
        !observerIds.has(tok.id)
      ) {
        const seen = isWorldPointVisibleToObservers(
          restingCenter,
          visions,
          lights,
          sc.walls,
          sc.global_illumination
        );
        if (!seen) {
          continue;
        }
      }

      let center = restingCenter;
      if (instantMove && drag) {
        if (drag.tokenId === tok.id) {
          center = drag.freeUnsnap
            ? drag.currentWorld
            : hexToWorldCenter(drag.currentHex, geom);
        } else if (drag.hasMoved && drag.companions.length > 0) {
          const comp = drag.companions.find((c) => c.tokenId === tok.id);
          if (comp) {
            center = drag.freeUnsnap
              ? comp.currentWorld
              : hexToWorldCenter(comp.currentHex, geom);
          }
        }
      } else if (instantMove && chain && chain.tokenId === tok.id) {
        center = chain.lastUnsnapped
          ? chain.currentWorld
          : hexToWorldCenter(chain.currentHex, geom);
      }

      const sizeScale = Math.min(2, Math.max(1, tok.size || 1));
      const radiusPx = Math.max(
        18,
        getHexRadius(geom.gridSizePx) * 0.82 * sizeScale
      );
      const tileSizePx = Math.max(
        radiusPx * 2 + 6,
        getTileSizePx(geom.gridSizePx) * sizeScale
      );

      let distFromAttacker: number | null = null;
      let inReach = false;
      const isTargetable = Boolean(
        pendingTarget && attackerTok && attackerTok.id !== tok.id
      );
      if (isTargetable && attackerTok && pendingTarget) {
        distFromAttacker = getTokenDistanceFeet(
          attackerTok,
          tok,
          geom,
          sc.grid_mode
        );
        inReach = distFromAttacker <= pendingTarget.reachFeet;
      }

      const maxAp = Math.max(1, Math.min(8, tok.max_ap || 4));
      const pips = Array.from({ length: maxAp }, (_, idx) => idx);
      const flipX = Boolean(tok.npc_stats?.__flip_x);
      const flipY = Boolean(tok.npc_stats?.__flip_y);
      const rotationDeg = normalizeTokenRotation(tok.npc_stats?.__rotation);
      const flipPart =
        flipX && flipY
          ? 'scale(-1, -1)'
          : flipX
            ? 'scaleX(-1)'
            : flipY
              ? 'scaleY(-1)'
              : '';
      const rotPart = rotationDeg !== 0 ? `rotate(${rotationDeg}deg)` : '';
      const artTransform =
        rotPart && flipPart
          ? `${rotPart} ${flipPart}`
          : rotPart || flipPart || 'none';
      const resolvedVisuals = this.vttStore.resolveTokenVisuals(tok);

      results.push({
        token: tok,
        center,
        radiusPx,
        tileSizePx,
        hpPct: Math.max(
          0,
          Math.min(100, (tok.current_hp / Math.max(1, tok.max_hp)) * 100)
        ),
        spPct:
          tok.max_sp > 0
            ? Math.max(0, Math.min(100, (tok.current_sp / tok.max_sp) * 100))
            : 0,
        isSelected: selectedIdSet.has(tok.id),
        isTurnActive: sc.combat_active && sc.active_turn_token_id === tok.id,
        isControllable: controllable,
        isTargetable,
        inTargetReach: inReach,
        distanceFromAttackerFeet: distFromAttacker,
        apPips: pips,
        flipX,
        flipY,
        rotationDeg,
        artTransform,
        tokenImageUrl: resolvedVisuals.tokenImageUrl,
        tokenAppearance: resolvedVisuals.tokenAppearance,
      });
    }

    return results;
  });

  readonly visibleDoorHandles = computed<RenderableDoorHandle[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    const isGm = this.vttStore.isGm();
    const preview = this.vttStore.previewPlayerVision();
    const showAll = isGm && !preview;
    const geom = this.vttStore.gridGeometry();
    const visions = this.observerVisions();
    const lights = this.lightPolygons();
    const exploredSet = new Set(sc.explored_fog?.cells ?? []);

    const list: RenderableDoorHandle[] = [];
    for (const w of sc.walls) {
      if (w.kind !== 'door') continue;
      const mx = (w.x1 + w.x2) / 2;
      const my = (w.y1 + w.y2) / 2;

      if (!showAll && sc.token_vision && !sc.explored_fog?.revealed_all) {
        const doorHex = worldPointToHex({ x: mx, y: my }, geom);
        const key = hexKey(doorHex.col, doorHex.row);
        const otherWalls = sc.walls.filter((other) => other.id !== w.id);
        const inActiveLos = isWorldPointVisibleToObservers(
          { x: mx, y: my },
          visions,
          lights,
          otherWalls,
          sc.global_illumination
        );
        const rememberedInFog = sc.fog_enabled && exploredSet.has(key);
        if (!inActiveLos && !rememberedInFog) {
          continue;
        }
      }

      list.push({ wall: w, x: mx, y: my });
    }
    return list;
  });

  readonly editableWallHandles = computed(() => {
    const sc = this.vttStore.activeScene();
    if (
      !sc ||
      !this.vttStore.isGm() ||
      this.vttStore.previewPlayerVision() ||
      this.vttStore.activeTool() !== 'wall'
    ) {
      return [];
    }
    return sc.walls.map((w) => ({
      wall: w,
      mx: (w.x1 + w.x2) / 2,
      my: (w.y1 + w.y2) / 2,
    }));
  });

  readonly editableLightHandles = computed<VttLightSource[]>(() => {
    if (
      !this.vttStore.isGm() ||
      this.vttStore.previewPlayerVision() ||
      this.vttStore.activeTool() !== 'light'
    ) {
      return [];
    }
    return this.effectiveSceneLights().filter(
      (l) => l.id !== '__placement-preview__'
    );
  });

  constructor() {
    effect(() => {
      const sc = this.vttStore.activeScene();
      const url = sc?.map_image_url?.trim() || null;
      if (url !== this.loadedMapUrl) {
        this.loadedMapUrl = url;
        if (!url) {
          this.mapImage.set(null);
          this.mapNaturalSize.set(null);
          this.vttStore.activeSceneNaturalSize.set(null);
        } else {
          const img = new Image();
          img.onload = () => {
            if (this.loadedMapUrl === url) {
              const nat = {
                width: img.naturalWidth || 1600,
                height: img.naturalHeight || 1100,
              };
              this.mapImage.set(img);
              this.mapNaturalSize.set(nat);
              this.vttStore.activeSceneNaturalSize.set(nat);

              const currentSc = this.vttStore.activeScene();
              if (
                currentSc &&
                (!currentSc.scene_width || !currentSc.scene_height)
              ) {
                queueMicrotask(() => this.fitMapToViewport());
              }
            }
          };
          img.onerror = () => {
            if (this.loadedMapUrl === url) {
              this.mapImage.set(null);
              this.mapNaturalSize.set(null);
              this.vttStore.activeSceneNaturalSize.set(null);
            }
          };
          img.src = url;
        }
      }

      if (!sc) {
        this.lastFittedSceneId = null;
        this.dragTokenState.set(null);
        this.marqueeSelectState.set(null);
        this.chainedTokenMove.set(null);
      } else if (
        sc.id !== this.lastFittedSceneId &&
        this.viewportWidth() > 100
      ) {
        this.lastFittedSceneId = sc.id;
        this.tokenContextMenu.set(null);
        this.dragTokenState.set(null);
        this.marqueeSelectState.set(null);
        this.chainedTokenMove.set(null);
        queueMicrotask(() => this.fitMapToViewport());
      }
    });

    effect(() => {
      const tool = this.vttStore.activeTool();
      if (tool !== 'light') {
        this.lightContextMenu.set(null);
        this.editingLightDraft.set(null);
      }
      if (tool !== 'select') {
        this.dragTokenState.set(null);
        this.marqueeSelectState.set(null);
        this.chainedTokenMove.set(null);
      }
    });

    effect(() => {
      const sc = this.vttStore.activeScene();
      const tokens = this.vttStore.sceneTokens();
      const geom = this.vttStore.gridGeometry();
      const speed = this.settingsStore.preferences().tokenMoveSpeed;

      if (!sc) {
        this.trackedAnimSceneId = null;
        this.lastTokenCenters.clear();
        this.clearAllTokenTravelAnimations();
        return;
      }

      if (sc.id !== this.trackedAnimSceneId) {
        this.trackedAnimSceneId = sc.id;
        this.lastTokenCenters.clear();
        this.clearAllTokenTravelAnimations();
        for (const tok of tokens) {
          this.lastTokenCenters.set(
            tok.id,
            getTokenWorldCenter(tok, geom, sc.grid_mode)
          );
        }
        return;
      }

      if (speed <= 0) {
        this.clearAllTokenTravelAnimations();
        this.lastTokenCenters.clear();
        for (const tok of tokens) {
          this.lastTokenCenters.set(
            tok.id,
            getTokenWorldCenter(tok, geom, sc.grid_mode)
          );
        }
        return;
      }

      const currentAnimMap = untracked(() => this.tokenAnimPositions());
      const seenIds = new Set<string>();
      let startedNewAnim = false;
      let removedAnim = false;

      for (const tok of tokens) {
        seenIds.add(tok.id);
        const nextCenter = getTokenWorldCenter(tok, geom, sc.grid_mode);
        const prevCenter = this.lastTokenCenters.get(tok.id);

        if (!prevCenter) {
          this.lastTokenCenters.set(tok.id, nextCenter);
          continue;
        }

        const dist = Math.hypot(
          nextCenter.x - prevCenter.x,
          nextCenter.y - prevCenter.y
        );
        if (dist > 1.5) {
          const originPt = currentAnimMap[tok.id] ?? prevCenter;
          this.lastTokenCenters.set(tok.id, nextCenter);

          let waypoints: VttPoint[] = [originPt, nextCenter];
          if (
            sc.grid_mode !== 'gridless' &&
            !tok.npc_stats?.__unsnapped
          ) {
            const fromHex = clampHexToBounds(
              worldPointToHex(originPt, geom),
              geom.gridWidth,
              geom.gridHeight
            );
            const toHex = { col: tok.x, row: tok.y };
            const pathRes = findHexPath(fromHex, toHex, geom, sc.walls);
            if (pathRes.reachable && pathRes.path.length > 2) {
              waypoints = [
                originPt,
                ...pathRes.path
                  .slice(1)
                  .map((h) => hexToWorldCenter(h, geom)),
              ];
            }
          }

          const anim = createTokenTravelAnimation(
            waypoints,
            speed,
            geom.gridSizePx,
            this.nowAnimClockMs()
          );
          if (anim) {
            this.activeTokenAnimations.set(tok.id, anim);
            startedNewAnim = true;
          }
        }
      }

      for (const existingId of Array.from(this.lastTokenCenters.keys())) {
        if (!seenIds.has(existingId)) {
          this.lastTokenCenters.delete(existingId);
          if (this.activeTokenAnimations.delete(existingId)) {
            removedAnim = true;
          }
        }
      }

      if (startedNewAnim || removedAnim) {
        this.syncTokenAnimPositionsNow();
        this.startTokenTravelLoopIfNeeded();
      }
    });

    effect(() => {
      this.vttStore.activeScene();
      this.vttStore.sceneLayout();
      this.vttStore.sceneTokens();
      this.vttStore.gridGeometry();
      this.vttStore.previewPlayerVision();
      this.vttStore.isGm();
      this.vttStore.activeTool();
      this.vttStore.selectedLightId();
      this.vttStore.pendingTargetAction();
      this.vttStore.pendingClash();
      this.tokenAnimPositions();
      this.lightPolygons();
      this.observerVisions();
      this.viewportWidth();
      this.viewportHeight();
      this.panX();
      this.panY();
      this.zoom();
      this.ctrlPressed();
      this.shiftPressed();
      this.hoveredHex();
      this.rosterDropPreview();
      this.dragTokenState();
      this.chainedTokenMove();
      this.lightPlacementDraft();
      this.editingLightDraft();
      this.activeRulerPath();
      this.rulerWorldStart();
      this.rulerWorldCurrent();
      this.wallDraftStart();
      this.wallDraftCurrent();
      this.mapImage();

      const pings = this.vttStore.activePings();
      this.renderFrame();

      if (pings.length > 0 && this.pingAnimFrame === null) {
        const step = () => {
          this.renderFrame();
          if (this.vttStore.activePings().length > 0) {
            this.pingAnimFrame = requestAnimationFrame(step);
          } else {
            this.pingAnimFrame = null;
          }
        };
        this.pingAnimFrame = requestAnimationFrame(step);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.pingAnimFrame !== null) {
        cancelAnimationFrame(this.pingAnimFrame);
      }
      if (this.tokenTravelAnimFrame !== null) {
        cancelAnimationFrame(this.tokenTravelAnimFrame);
      }
    });
  }

  ngAfterViewInit(): void {
    const vp = this.viewportRef().nativeElement;
    const rect = vp.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.viewportWidth.set(Math.round(rect.width));
      this.viewportHeight.set(Math.round(rect.height));
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width > 0 && cr.height > 0) {
            this.viewportWidth.set(Math.round(cr.width));
            this.viewportHeight.set(Math.round(cr.height));
          }
        }
      });
      ro.observe(vp);
      this.destroyRef.onDestroy(() => ro.disconnect());
    }

    this.fitMapToViewport();
    this.renderFrame();
  }

  fitMapToViewport(): void {
    const vw = this.viewportWidth();
    const vh = this.viewportHeight();
    const layout = this.vttStore.sceneLayout();
    if (
      vw <= 40 ||
      vh <= 40 ||
      layout.innerWidth <= 0 ||
      layout.innerHeight <= 0
    ) {
      return;
    }

    const pad = 76;
    const scaleX = Math.max(80, vw - pad * 2) / layout.innerWidth;
    const scaleY = Math.max(80, vh - pad * 2) / layout.innerHeight;
    const nextZoom = Math.max(0.12, Math.min(1.35, Math.min(scaleX, scaleY)));

    const sceneCenterX = layout.sceneX + layout.innerWidth / 2;
    const sceneCenterY = layout.sceneY + layout.innerHeight / 2;
    const nextPanX = Math.round(vw / 2 - sceneCenterX * nextZoom);
    const nextPanY = Math.round(vh / 2 - sceneCenterY * nextZoom);

    this.zoom.set(Number(nextZoom.toFixed(3)));
    this.panX.set(nextPanX);
    this.panY.set(nextPanY);
  }

  zoomByStep(delta: number): void {
    const vw = this.viewportWidth();
    const vh = this.viewportHeight();
    this.applyZoomAroundScreenPoint(vw / 2, vh / 2, this.zoom() + delta);
  }

  private applyZoomAroundScreenPoint(
    sx: number,
    sy: number,
    rawNextZoom: number
  ): void {
    const prevZoom = this.zoom();
    const nextZoom = Math.max(0.12, Math.min(2.4, rawNextZoom));
    if (Math.abs(nextZoom - prevZoom) < 0.001) return;

    const wx = (sx - this.panX()) / prevZoom;
    const wy = (sy - this.panY()) / prevZoom;
    this.zoom.set(Number(nextZoom.toFixed(3)));
    this.panX.set(Math.round(sx - wx * nextZoom));
    this.panY.set(Math.round(sy - wy * nextZoom));
  }

  screenToWorld(clientX: number, clientY: number): VttPoint {
    const rect = this.viewportRef().nativeElement.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - this.panX()) / this.zoom(),
      y: (sy - this.panY()) / this.zoom(),
    };
  }

  private snapWallVertex(pt: VttPoint, bypassSnap: boolean): VttPoint {
    if (bypassSnap) return pt;
    const sc = this.vttStore.activeScene();
    const walls = sc?.walls ?? [];
    const threshold = 14 / this.zoom();
    let best: VttPoint | null = null;
    let bestDist = threshold;

    for (const w of walls) {
      const d1 = Math.hypot(pt.x - w.x1, pt.y - w.y1);
      if (d1 <= bestDist) {
        bestDist = d1;
        best = { x: w.x1, y: w.y1 };
      }
      const d2 = Math.hypot(pt.x - w.x2, pt.y - w.y2);
      if (d2 <= bestDist) {
        bestDist = d2;
        best = { x: w.x2, y: w.y2 };
      }
    }
    if (best) return best;

    if (sc && sc.grid_mode !== 'gridless') {
      const geom = this.vttStore.gridGeometry();
      const step = Math.max(20, geom.gridSizePx);
      const gx =
        geom.offsetX + Math.round((pt.x - geom.offsetX) / step) * step;
      const gy =
        geom.offsetY + Math.round((pt.y - geom.offsetY) / step) * step;
      if (Math.hypot(pt.x - gx, pt.y - gy) <= 10 / this.zoom()) {
        return { x: Math.round(gx), y: Math.round(gy) };
      }
    }
    return pt;
  }

  private isFloatingWindowTarget(target: EventTarget | null): boolean {
    if (!target || typeof HTMLElement === 'undefined') return false;
    return target instanceof HTMLElement
      ? Boolean(target.closest('[data-vtt-floating-window]'))
      : false;
  }

  private resolveRotationWheelTargetIds(event: WheelEvent): string[] {
    const selectedControllable = this.vttStore.controllableSelectedTokens();
    if (selectedControllable.length > 0) {
      return selectedControllable.map((t) => t.id);
    }

    if (
      typeof HTMLElement !== 'undefined' &&
      event.target instanceof HTMLElement
    ) {
      const tokenEl = event.target.closest('[data-token-id]');
      const domTokenId = tokenEl?.getAttribute('data-token-id');
      if (domTokenId) {
        const tok = this.vttStore
          .sceneTokens()
          .find((t) => t.id === domTokenId);
        if (
          tok &&
          (this.vttStore.isGm() || this.vttStore.canControlToken(tok))
        ) {
          return [tok.id];
        }
      }
    }

    const worldPt = this.screenToWorld(event.clientX, event.clientY);
    const renderable = this.renderableTokens();
    for (let i = renderable.length - 1; i >= 0; i--) {
      const item = renderable[i];
      if (!this.vttStore.isGm() && !item.isControllable) continue;
      const dist = Math.hypot(
        worldPt.x - item.center.x,
        worldPt.y - item.center.y
      );
      if (dist <= item.radiusPx) {
        return [item.token.id];
      }
    }
    return [];
  }

  onWheel(event: WheelEvent): void {
    if (this.isFloatingWindowTarget(event.target)) return;
    event.preventDefault();

    if (event.shiftKey) {
      const rawDelta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (rawDelta === 0) return;

      const targetIds = this.resolveRotationWheelTargetIds(event);
      if (targetIds.length === 0) return;

      const stepDeg = event.ctrlKey || event.metaKey ? 5 : 15;
      const deltaDeg = rawDelta > 0 ? stepDeg : -stepDeg;
      void this.vttStore.rotateTokensByDelta(targetIds, deltaDeg);
      return;
    }

    const rect = this.viewportRef().nativeElement.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.11 : 0.9;
    this.applyZoomAroundScreenPoint(sx, sy, this.zoom() * factor);
  }

  private isPhysicalRightClick(event: MouseEvent): boolean {
    if (event.button !== 2) return false;
    if (this.isMacPlatform && event.ctrlKey && (event.buttons & 2) === 0) {
      return false;
    }
    return true;
  }

  private isPrimaryPointerDown(event: PointerEvent): boolean {
    if (event.button === 0) return true;
    if (
      this.isMacPlatform &&
      event.button === 2 &&
      event.ctrlKey &&
      (event.buttons & 2) === 0
    ) {
      return true;
    }
    return false;
  }

  hasActiveChainedOrDragMove(): boolean {
    return this.dragTokenState() !== null || this.chainedTokenMove() !== null;
  }

  cancelActiveMovementOrDraft(): boolean {
    const activeMarquee = this.marqueeSelectState();
    const hadActive =
      this.dragTokenState() !== null ||
      activeMarquee !== null ||
      this.chainedTokenMove() !== null ||
      this.rulerStart() !== null ||
      this.rulerWorldStart() !== null ||
      this.wallDraftStart() !== null ||
      this.lightPlacementDraft() !== null ||
      this.dragLightState() !== null;

    if (!hadActive) return false;

    this.dragTokenState.set(null);
    if (activeMarquee) {
      this.marqueeSelectState.set(null);
      this.vttStore.setSelectedTokens(activeMarquee.initialSelectedIds);
    }
    this.chainedTokenMove.set(null);
    this.rulerStart.set(null);
    this.rulerCurrent.set(null);
    this.rulerWorldStart.set(null);
    this.rulerWorldCurrent.set(null);
    this.wallDraftStart.set(null);
    this.wallDraftCurrent.set(null);
    this.lightPlacementDraft.set(null);
    this.dragLightState.set(null);
    return true;
  }

  private computeMarqueeTokenIds(
    startWorld: VttPoint,
    endWorld: VttPoint,
    seedIds: readonly string[]
  ): string[] {
    const minX = Math.min(startWorld.x, endWorld.x);
    const maxX = Math.max(startWorld.x, endWorld.x);
    const minY = Math.min(startWorld.y, endWorld.y);
    const maxY = Math.max(startWorld.y, endWorld.y);

    const controllableSceneIds = new Set(
      this.vttStore
        .sceneTokens()
        .filter((t) => this.vttStore.isGm() || this.vttStore.canControlToken(t))
        .map((t) => t.id)
    );
    const nextIds: string[] = [];
    const seen = new Set<string>();

    for (const id of seedIds) {
      if (controllableSceneIds.has(id) && !seen.has(id)) {
        seen.add(id);
        nextIds.push(id);
      }
    }

    for (const item of this.renderableTokens()) {
      if (!this.vttStore.isGm() && !item.isControllable) continue;
      if (seen.has(item.token.id)) continue;
      const clampedX = Math.max(minX, Math.min(maxX, item.center.x));
      const clampedY = Math.max(minY, Math.min(maxY, item.center.y));
      const dist = Math.hypot(
        item.center.x - clampedX,
        item.center.y - clampedY
      );
      if (dist <= item.radiusPx * 0.75) {
        seen.add(item.token.id);
        nextIds.push(item.token.id);
      }
    }

    return nextIds;
  }

  private nowAnimClockMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private clearAllTokenTravelAnimations(): void {
    if (this.tokenTravelAnimFrame !== null) {
      cancelAnimationFrame(this.tokenTravelAnimFrame);
      this.tokenTravelAnimFrame = null;
    }
    this.activeTokenAnimations.clear();
    if (Object.keys(untracked(() => this.tokenAnimPositions())).length > 0) {
      this.tokenAnimPositions.set({});
    }
  }

  private syncTokenAnimPositionsNow(): void {
    const now = this.nowAnimClockMs();
    const nextPositions: Record<string, VttPoint> = {};
    for (const [tokenId, anim] of Array.from(
      this.activeTokenAnimations.entries()
    )) {
      const sampled = sampleTokenTravelAnimation(anim, now);
      if (sampled.done) {
        this.activeTokenAnimations.delete(tokenId);
      } else {
        nextPositions[tokenId] = sampled.point;
      }
    }
    this.tokenAnimPositions.set(nextPositions);
  }

  private startTokenTravelLoopIfNeeded(): void {
    if (
      this.tokenTravelAnimFrame !== null ||
      this.activeTokenAnimations.size === 0 ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      return;
    }
    const tick = () => {
      this.tokenTravelAnimFrame = null;
      if (this.settingsStore.preferences().tokenMoveSpeed <= 0) {
        this.clearAllTokenTravelAnimations();
        return;
      }
      this.syncTokenAnimPositionsNow();
      if (this.activeTokenAnimations.size > 0) {
        this.tokenTravelAnimFrame = requestAnimationFrame(tick);
      }
    };
    this.tokenTravelAnimFrame = requestAnimationFrame(tick);
  }

  private queueTokenTravelWaypoints(
    tokenId: string,
    waypoints: VttPoint[]
  ): void {
    const speed = this.settingsStore.preferences().tokenMoveSpeed;
    if (speed <= 0 || waypoints.length < 2) {
      return;
    }
    const geom = this.vttStore.gridGeometry();
    const anim = createTokenTravelAnimation(
      waypoints,
      speed,
      geom.gridSizePx,
      this.nowAnimClockMs()
    );
    if (!anim) {
      return;
    }
    this.lastTokenCenters.set(tokenId, anim.targetEnd);
    this.activeTokenAnimations.set(tokenId, anim);
    this.syncTokenAnimPositionsNow();
    this.startTokenTravelLoopIfNeeded();
  }

  commitActiveChainedMove(): void {
    const chain = this.chainedTokenMove();
    this.chainedTokenMove.set(null);
    this.dragTokenState.set(null);
    if (!chain || chain.legs.length === 0) return;
    this.commitChainedTokenMoveState(chain);
  }

  private commitChainedTokenMoveState(chain: ChainedTokenMoveState): void {
    if (chain.legs.length === 0) return;
    const geom = this.vttStore.gridGeometry();
    const currentAnimPt = this.tokenAnimPositions()[chain.tokenId];
    const waypoints: VttPoint[] = [currentAnimPt ?? chain.originWorld];
    for (const leg of chain.legs) {
      if (leg.freeUnsnap) {
        waypoints.push(leg.toWorld);
      } else {
        const steps =
          leg.hexPath.length > 1 ? leg.hexPath.slice(1) : [leg.toHex];
        for (const h of steps) {
          waypoints.push(hexToWorldCenter(h, geom));
        }
      }
    }
    this.queueTokenTravelWaypoints(chain.tokenId, waypoints);

    if (chain.lastUnsnapped) {
      const intermediateWorldPts = chain.legs
        .slice(0, -1)
        .map((leg) => leg.toWorld);
      void this.vttStore.moveTokenToWorldPoint(
        chain.tokenId,
        chain.currentWorld,
        chain.totalFeet,
        chain.anyShiftOverride,
        this.worldBounds(),
        intermediateWorldPts
      );
      return;
    }

    const traversed: HexCoord[] = [];
    for (const leg of chain.legs) {
      const steps =
        leg.hexPath.length > 1 ? leg.hexPath.slice(1) : [leg.toHex];
      for (const h of steps) {
        traversed.push(h);
      }
    }
    const intermediateHexes =
      traversed.length > 1 ? traversed.slice(0, -1) : undefined;

    void this.vttStore.moveTokenToHex(
      chain.tokenId,
      chain.currentHex.col,
      chain.currentHex.row,
      chain.totalFeet,
      chain.anyShiftOverride,
      intermediateHexes
    );
  }

  private recomputeDragTokenForPointer(
    dragTok: DragTokenState,
    worldPt: VttPoint,
    shiftHeld: boolean
  ): DragTokenState {
    const sc = this.vttStore.activeScene();
    const geom = this.vttStore.gridGeometry();
    const shiftOverride = shiftHeld && this.vttStore.isGm();
    const freeUnsnap = dragTok.gridMode === 'gridless' || shiftHeld;

    if (freeUnsnap) {
      const clampedWorld = clampWorldPointToBounds(
        worldPt,
        this.worldBounds(),
        20
      );
      const clampedHex = clampHexToBounds(
        worldPointToHex(clampedWorld, geom),
        geom.gridWidth,
        geom.gridHeight
      );
      const distPx = Math.hypot(
        clampedWorld.x - dragTok.startWorld.x,
        clampedWorld.y - dragTok.startWorld.y
      );
      const pointerDist = Math.hypot(
        worldPt.x - dragTok.pointerDownWorld.x,
        worldPt.y - dragTok.pointerDownWorld.y
      );
      const moved =
        dragTok.hasMoved ||
        distPx > 4 / this.zoom() ||
        pointerDist > 4 / this.zoom();
      const feet = worldPixelsToFeet(distPx, geom.gridSizePx);
      const blocked =
        !shiftOverride &&
        isWorldSegmentBlockedByWalls(
          dragTok.startWorld,
          clampedWorld,
          sc?.walls ?? []
        );

      const dx = clampedWorld.x - dragTok.startWorld.x;
      const dy = clampedWorld.y - dragTok.startWorld.y;
      const companions = dragTok.companions.map((comp) => {
        const compWorld = clampWorldPointToBounds(
          { x: comp.startWorld.x + dx, y: comp.startWorld.y + dy },
          this.worldBounds(),
          20
        );
        const compHex = clampHexToBounds(
          worldPointToHex(compWorld, geom),
          geom.gridWidth,
          geom.gridHeight
        );
        const compDistPx = Math.hypot(
          compWorld.x - comp.startWorld.x,
          compWorld.y - comp.startWorld.y
        );
        const compFeet = worldPixelsToFeet(compDistPx, geom.gridSizePx);
        const compBlocked =
          !shiftOverride &&
          isWorldSegmentBlockedByWalls(
            comp.startWorld,
            compWorld,
            sc?.walls ?? []
          );
        return {
          ...comp,
          currentHex: compHex,
          currentWorld: compWorld,
          reachable: !compBlocked,
          feet: compFeet,
        };
      });

      return {
        ...dragTok,
        freeUnsnap: true,
        currentHex: clampedHex,
        currentWorld: clampedWorld,
        hasMoved: moved,
        shiftOverride,
        gridlessBlocked: blocked,
        gridlessFeet: feet,
        companions,
      };
    }

    const rawHex = worldPointToHex(worldPt, geom);
    const clamped = clampHexToBounds(rawHex, geom.gridWidth, geom.gridHeight);
    const startTileCenter = hexToWorldCenter(dragTok.startHex, geom);
    const targetTileCenter = hexToWorldCenter(clamped, geom);
    const startedOffCenter =
      Math.hypot(
        dragTok.startWorld.x - startTileCenter.x,
        dragTok.startWorld.y - startTileCenter.y
      ) > 2;
    const pointerDist = Math.hypot(
      worldPt.x - dragTok.pointerDownWorld.x,
      worldPt.y - dragTok.pointerDownWorld.y
    );

    const pathRes = shiftOverride
      ? {
          reachable: true,
          path: [dragTok.startHex, clamped],
          steps: getHexDistanceFeet(dragTok.startHex, clamped) / 5,
          feet: getHexDistanceFeet(dragTok.startHex, clamped),
        }
      : findHexPath(dragTok.startHex, clamped, geom, sc?.walls ?? []);

    const tileWorldDx = targetTileCenter.x - startTileCenter.x;
    const tileWorldDy = targetTileCenter.y - startTileCenter.y;
    const companions = dragTok.companions.map((comp) => {
      const compStartTileCenter = hexToWorldCenter(comp.startHex, geom);
      const compHex = clampHexToBounds(
        worldPointToHex(
          {
            x: compStartTileCenter.x + tileWorldDx,
            y: compStartTileCenter.y + tileWorldDy,
          },
          geom
        ),
        geom.gridWidth,
        geom.gridHeight
      );
      const compWorld = hexToWorldCenter(compHex, geom);
      if (shiftOverride) {
        return {
          ...comp,
          currentHex: compHex,
          currentWorld: compWorld,
          reachable: true,
          feet: getHexDistanceFeet(comp.startHex, compHex),
        };
      }
      const compPath = findHexPath(
        comp.startHex,
        compHex,
        geom,
        sc?.walls ?? []
      );
      return {
        ...comp,
        currentHex: compHex,
        currentWorld: compWorld,
        reachable: compPath.reachable,
        feet: compPath.feet,
      };
    });

    return {
      ...dragTok,
      freeUnsnap: false,
      currentHex: clamped,
      currentWorld: targetTileCenter,
      hasMoved:
        clamped.col !== dragTok.startHex.col ||
        clamped.row !== dragTok.startHex.row ||
        (startedOffCenter && pointerDist > 4 / this.zoom()),
      shiftOverride,
      pathResult: pathRes,
      companions,
    };
  }

  onViewportDragOver(event: DragEvent): void {
    const sc = this.vttStore.activeScene();
    if (!sc) return;

    const payload = this.vttStore.draggingRosterPayload();
    const hasRosterMime = Boolean(
      event.dataTransfer?.types?.includes('application/x-mot-roster')
    );
    if (!payload && !hasRosterMime) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    const rawWorld = this.screenToWorld(event.clientX, event.clientY);
    const clampedWorld = clampWorldPointToBounds(
      rawWorld,
      this.worldBounds(),
      20
    );
    const geom = this.vttStore.gridGeometry();
    const clampedHex = clampHexToBounds(
      worldPointToHex(clampedWorld, geom),
      geom.gridWidth,
      geom.gridHeight
    );
    const unsnapped = sc.grid_mode === 'gridless' || Boolean(event.shiftKey);

    this.rosterDropPreview.set({
      worldPt: clampedWorld,
      hex: clampedHex,
      unsnapped,
      name: payload?.name ?? 'Deploy Actor',
      color: payload?.color ?? '#38B29A',
    });
  }

  onViewportDragLeave(event: DragEvent): void {
    const vp = this.viewportRef().nativeElement;
    const rel = event.relatedTarget as Node | null;
    if (!rel || !vp.contains(rel)) {
      this.rosterDropPreview.set(null);
    }
  }

  onViewportDrop(event: DragEvent): void {
    const sc = this.vttStore.activeScene();
    this.rosterDropPreview.set(null);
    if (!sc) return;

    let payload = this.vttStore.draggingRosterPayload();
    if (!payload && event.dataTransfer) {
      const rawJson =
        event.dataTransfer.getData('application/x-mot-roster') ||
        event.dataTransfer.getData('text/plain');
      if (rawJson && rawJson.startsWith('{')) {
        try {
          const parsed = JSON.parse(rawJson) as VttRosterDragPayload;
          if (
            parsed &&
            (parsed.kind === 'roster-actor' || parsed.kind === 'character')
          ) {
            payload = parsed;
          }
        } catch {
          payload = null;
        }
      }
    }

    if (!payload) return;
    event.preventDefault();

    const rawWorld = this.screenToWorld(event.clientX, event.clientY);
    const clampedWorld = clampWorldPointToBounds(
      rawWorld,
      this.worldBounds(),
      20
    );
    const unsnapped = sc.grid_mode === 'gridless' || Boolean(event.shiftKey);
    void this.vttStore.dropActorAtWorldPoint(payload, clampedWorld, unsnapped);
  }

  @HostListener('window:mousedown', ['$event'])
  onWindowMouseDown(event: MouseEvent): void {
    if (!this.isPhysicalRightClick(event)) return;
    if (this.cancelActiveMovementOrDraft()) {
      this.suppressContextMenuUntil = Date.now() + 400;
      this.suppressRightPanUntilPointerUp = true;
      this.isPanning.set(false);
      this.panPointerStart = null;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onContextMenu(event: MouseEvent): void {
    if (this.isFloatingWindowTarget(event.target)) return;
    event.preventDefault();
    if (
      Date.now() < this.suppressContextMenuUntil ||
      this.cancelActiveMovementOrDraft()
    ) {
      this.suppressContextMenuUntil = Date.now() + 400;
      event.stopPropagation();
    }
  }

  onViewportPointerDown(event: PointerEvent): void {
    if (this.isFloatingWindowTarget(event.target)) return;
    const sc = this.vttStore.activeScene();
    if (!sc) return;

    this.ctrlPressed.set(Boolean(event.ctrlKey || event.metaKey));

    if (this.isPhysicalRightClick(event)) {
      if (
        this.suppressRightPanUntilPointerUp ||
        this.cancelActiveMovementOrDraft()
      ) {
        this.suppressContextMenuUntil = Date.now() + 400;
        this.suppressRightPanUntilPointerUp = true;
        event.preventDefault();
        return;
      }
    }

    if (this.tokenContextMenu()) {
      this.tokenContextMenu.set(null);
    }

    if (this.lightContextMenu()) {
      this.lightContextMenu.set(null);
      if (event.button === 0 && this.vttStore.activeTool() === 'light') {
        return;
      }
    }

    if (event.altKey && event.button === 0) {
      const worldPt = this.screenToWorld(event.clientX, event.clientY);
      void this.vttStore.pingWorldPoint(worldPt);
      return;
    }

    const tool = this.vttStore.activeTool();
    if (
      event.button === 1 ||
      this.isPhysicalRightClick(event) ||
      this.spacePressed() ||
      tool === 'pan'
    ) {
      this.isPanning.set(true);
      this.panPointerStart = {
        x: event.clientX,
        y: event.clientY,
        origPanX: this.panX(),
        origPanY: this.panY(),
      };
      return;
    }

    if (!this.isPrimaryPointerDown(event)) return;

    const worldPt = this.screenToWorld(event.clientX, event.clientY);
    const geom = this.vttStore.gridGeometry();
    const activeChain = this.chainedTokenMove();

    if (tool === 'select' && activeChain) {
      if (event.ctrlKey || event.metaKey || this.ctrlPressed()) {
        this.shiftPressed.set(Boolean(event.shiftKey));
        this.lastPointerWorld.set(worldPt);
        const seedDrag: DragTokenState = {
          tokenId: activeChain.tokenId,
          gridMode: activeChain.gridMode,
          freeUnsnap: activeChain.gridMode === 'gridless' || Boolean(event.shiftKey),
          startHex: activeChain.currentHex,
          currentHex: activeChain.currentHex,
          startWorld: activeChain.currentWorld,
          currentWorld: activeChain.currentWorld,
          pointerDownWorld: activeChain.currentWorld,
          hasMoved: false,
          shiftOverride: Boolean(event.shiftKey) && this.vttStore.isGm(),
          pathResult: {
            reachable: true,
            path: [activeChain.currentHex],
            steps: 0,
            feet: 0,
          },
          gridlessBlocked: false,
          gridlessFeet: 0,
          companions: [],
          toggleOffOnClick: false,
          narrowToSingleOnClick: false,
        };
        this.dragTokenState.set(
          this.recomputeDragTokenForPointer(
            seedDrag,
            worldPt,
            Boolean(event.shiftKey)
          )
        );
        return;
      }

      this.commitActiveChainedMove();
    }

    if (tool === 'ruler') {
      if (sc.grid_mode === 'gridless') {
        const clamped = clampWorldPointToBounds(worldPt, this.worldBounds(), 8);
        this.rulerWorldStart.set(clamped);
        this.rulerWorldCurrent.set(clamped);
      } else {
        const hex = clampHexToBounds(
          worldPointToHex(worldPt, geom),
          geom.gridWidth,
          geom.gridHeight
        );
        this.rulerStart.set(hex);
        this.rulerCurrent.set(hex);
      }
      return;
    }

    if (tool === 'wall' && this.vttStore.isGm()) {
      const snapped = this.snapWallVertex(worldPt, event.shiftKey);
      this.wallDraftStart.set(snapped);
      this.wallDraftCurrent.set(snapped);
      return;
    }

    if (tool === 'light' && this.vttStore.isGm()) {
      this.lightPlacementDraft.set({
        origin: worldPt,
        current: worldPt,
        dragged: false,
        brightFeet: 20,
        dimFeet: 40,
      });
      return;
    }

    if (this.vttStore.pendingTargetAction()) {
      this.vttStore.cancelTargetSelection();
      return;
    }

    if (tool === 'select') {
      const initialSelectedIds = [...this.vttStore.selectedTokenIds()];
      const additive = Boolean(event.shiftKey);
      if (!additive) {
        this.vttStore.clearTokenSelection();
      }
      this.vttStore.selectedLightId.set(null);
      const rect = this.viewportRef().nativeElement.getBoundingClientRect();
      const startScreen = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      this.marqueeSelectState.set({
        startWorld: worldPt,
        currentWorld: worldPt,
        startScreen,
        currentScreen: startScreen,
        additive,
        initialSelectedIds,
        hasMoved: false,
      });
    }
  }

  onTokenPointerDown(event: PointerEvent, item: RenderableVttToken): void {
    event.stopPropagation();

    this.ctrlPressed.set(Boolean(event.ctrlKey || event.metaKey));

    if (this.tokenContextMenu()) {
      this.tokenContextMenu.set(null);
    }
    if (this.lightContextMenu()) {
      this.lightContextMenu.set(null);
    }

    if (this.isPhysicalRightClick(event)) {
      if (
        this.suppressRightPanUntilPointerUp ||
        this.cancelActiveMovementOrDraft()
      ) {
        this.suppressContextMenuUntil = Date.now() + 400;
        this.suppressRightPanUntilPointerUp = true;
        event.preventDefault();
        return;
      }
      if (this.vttStore.isGm() || item.isControllable) {
        return;
      }
    }

    if (event.altKey && event.button === 0) {
      void this.vttStore.pingWorldPoint(item.center);
      return;
    }

    if (
      event.button === 1 ||
      this.isPhysicalRightClick(event) ||
      this.spacePressed()
    ) {
      this.onViewportPointerDown(event);
      return;
    }

    if (!this.isPrimaryPointerDown(event)) return;

    const pendingTarget = this.vttStore.pendingTargetAction();
    if (pendingTarget) {
      if (pendingTarget.attackerTokenId !== item.token.id) {
        void this.vttStore.launchClashAgainstTarget(item.token.id);
      }
      return;
    }

    const existingChain = this.chainedTokenMove();
    if (existingChain && existingChain.tokenId !== item.token.id) {
      this.commitActiveChainedMove();
    }

    this.vttStore.selectedLightId.set(null);

    const sc = this.vttStore.activeScene();
    const gridMode = sc?.grid_mode ?? 'square';
    const tool = this.vttStore.activeTool();
    const shiftHeld = Boolean(event.shiftKey);

    if (tool === 'ruler') {
      this.vttStore.selectSingleToken(item.token.id);
      if (gridMode === 'gridless') {
        this.rulerWorldStart.set(item.center);
        this.rulerWorldCurrent.set(item.center);
      } else {
        const startHex = { col: item.token.x, row: item.token.y };
        this.rulerStart.set(startHex);
        this.rulerCurrent.set(startHex);
      }
      return;
    }

    if (tool !== 'select') {
      this.vttStore.selectSingleToken(item.token.id);
      return;
    }

    if (!item.isControllable) {
      if (!shiftHeld || this.vttStore.controllableSelectedTokens().length === 0) {
        this.vttStore.selectSingleToken(item.token.id);
      }
      return;
    }

    const wasAlreadySelected = this.vttStore.isTokenSelected(item.token.id);
    const priorControllable = this.vttStore.controllableSelectedTokens();
    let toggleOffOnClick = false;
    let narrowToSingleOnClick = false;

    if (shiftHeld) {
      if (wasAlreadySelected) {
        toggleOffOnClick = true;
      } else {
        const controllableIds = priorControllable.map((t) => t.id);
        this.vttStore.setSelectedTokens([...controllableIds, item.token.id]);
      }
    } else if (wasAlreadySelected && priorControllable.length > 1) {
      narrowToSingleOnClick = true;
    } else {
      this.vttStore.selectSingleToken(item.token.id);
    }

    const chainForToken = this.chainedTokenMove();
    const geom = this.vttStore.gridGeometry();
    const isMidAnim = Boolean(this.tokenAnimPositions()[item.token.id]);
    const startHex =
      chainForToken && chainForToken.tokenId === item.token.id
        ? chainForToken.currentHex
        : isMidAnim
          ? clampHexToBounds(
              worldPointToHex(item.center, geom),
              geom.gridWidth,
              geom.gridHeight
            )
          : { col: item.token.x, row: item.token.y };
    const startWorld =
      chainForToken && chainForToken.tokenId === item.token.id
        ? chainForToken.currentWorld
        : item.center;
    const pointerDownWorld = this.screenToWorld(event.clientX, event.clientY);
    this.shiftPressed.set(shiftHeld);
    this.lastPointerWorld.set(pointerDownWorld);

    const isChainingMove = Boolean(
      (chainForToken && chainForToken.tokenId === item.token.id) ||
        event.ctrlKey ||
        event.metaKey
    );
    const companions: DragCompanionTokenState[] = isChainingMove
      ? []
      : this.vttStore
          .controllableSelectedTokens()
          .filter((t) => t.id !== item.token.id)
          .map((compTok) => {
            const compAnimPt = this.tokenAnimPositions()[compTok.id];
            const compCenter =
              compAnimPt ?? getTokenWorldCenter(compTok, geom, gridMode);
            const compStartHex = compAnimPt
              ? clampHexToBounds(
                  worldPointToHex(compCenter, geom),
                  geom.gridWidth,
                  geom.gridHeight
                )
              : { col: compTok.x, row: compTok.y };
            return {
              tokenId: compTok.id,
              startHex: compStartHex,
              currentHex: compStartHex,
              startWorld: compCenter,
              currentWorld: compCenter,
              reachable: true,
              feet: 0,
            };
          });

    this.dragTokenState.set({
      tokenId: item.token.id,
      gridMode,
      freeUnsnap: gridMode === 'gridless' || shiftHeld,
      startHex,
      currentHex: startHex,
      startWorld,
      currentWorld: startWorld,
      pointerDownWorld,
      hasMoved: false,
      shiftOverride: shiftHeld && this.vttStore.isGm(),
      pathResult: { reachable: true, path: [startHex], steps: 0, feet: 0 },
      gridlessBlocked: false,
      gridlessFeet: 0,
      companions,
      toggleOffOnClick,
      narrowToSingleOnClick,
    });
  }

  onTokenContextMenu(event: MouseEvent, item: RenderableVttToken): void {
    event.preventDefault();
    event.stopPropagation();
    if (
      Date.now() < this.suppressContextMenuUntil ||
      this.cancelActiveMovementOrDraft()
    ) {
      this.suppressContextMenuUntil = Date.now() + 400;
      return;
    }
    if (!this.vttStore.isGm() && !item.isControllable) return;

    this.dragTokenState.set(null);
    this.lightContextMenu.set(null);
    const controllableSelected = this.vttStore.controllableSelectedTokens();
    const keepMultiSelection =
      controllableSelected.length > 1 &&
      controllableSelected.some((t) => t.id === item.token.id);
    if (!keepMultiSelection) {
      this.vttStore.selectSingleToken(item.token.id);
    }
    this.vttStore.selectedLightId.set(null);

    const rect = this.viewportRef().nativeElement.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const clampedX = Math.max(
      12,
      Math.min(this.viewportWidth() - 240, rawX + 8)
    );
    const clampedY = Math.max(
      12,
      Math.min(this.viewportHeight() - 365, rawY + 8)
    );

    this.tokenContextMenu.set({
      tokenId: item.token.id,
      screenX: Math.round(clampedX),
      screenY: Math.round(clampedY),
    });
  }

  getTokenRotationDegrees(token: VttTokenModel): number {
    return normalizeTokenRotation(token.npc_stats?.__rotation);
  }

  private resolveMenuTargetTokenIds(fallbackId?: string): string[] {
    const targets = this.contextMenuTargetTokens();
    if (targets.length > 0) {
      return targets.map((t) => t.id);
    }
    return fallbackId ? [fallbackId] : [];
  }

  openTokenSheetFromMenu(tokenId: string): void {
    this.tokenContextMenu.set(null);
    this.vttStore.openTokenSheet(tokenId);
  }

  openTokenTokenizerFromMenu(tokenId: string): void {
    this.tokenContextMenu.set(null);
    this.vttStore.openTokenizerForToken(tokenId);
  }

  toggleTokenHiddenFromMenu(token: VttTokenModel): void {
    const ids = this.resolveMenuTargetTokenIds(token.id);
    this.tokenContextMenu.set(null);
    void this.vttStore.toggleTokensHiddenBatch(ids);
  }

  toggleTokenFlipXFromMenu(tokenId: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.flipTokensHorizontal(ids);
  }

  toggleTokenFlipYFromMenu(tokenId: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.flipTokensVertical(ids);
  }

  rotateTokens90FromMenu(tokenId?: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.rotateTokensByDelta(ids, 90);
  }

  resetTokensRotationFromMenu(tokenId?: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.setTokensRotation(ids, 0);
  }

  bringTokenToFrontFromMenu(tokenId: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.bringTokensToFront(ids);
  }

  sendTokenToBackFromMenu(tokenId: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.sendTokensToBack(ids);
  }

  removeTokenFromMenu(tokenId: string): void {
    const ids = this.resolveMenuTargetTokenIds(tokenId);
    this.tokenContextMenu.set(null);
    void this.vttStore.removeTokensBatch(ids);
  }

  onDoorButtonClick(event: MouseEvent, wallId: string): void {
    event.stopPropagation();
    void this.vttStore.toggleDoor(wallId);
  }

  onDeleteWallClick(event: MouseEvent, wallId: string): void {
    event.stopPropagation();
    void this.vttStore.deleteWallSegment(wallId);
  }

  onLightHandlePointerDown(event: PointerEvent, light: VttLightSource): void {
    event.stopPropagation();
    if (!this.vttStore.isGm()) return;
    if (event.button === 2) {
      return;
    }
    this.lightContextMenu.set(null);
    if (event.button !== 0) return;

    this.vttStore.selectedLightId.set(light.id);
    this.dragLightState.set({
      lightId: light.id,
      startPoint: { x: light.x, y: light.y },
      currentPoint: { x: light.x, y: light.y },
      hasMoved: false,
    });
  }

  onLightHandleContextMenu(event: MouseEvent, light: VttLightSource): void {
    event.preventDefault();
    event.stopPropagation();
    if (
      Date.now() < this.suppressContextMenuUntil ||
      this.cancelActiveMovementOrDraft()
    ) {
      this.suppressContextMenuUntil = Date.now() + 400;
      return;
    }
    if (!this.vttStore.isGm()) return;

    this.dragLightState.set(null);
    this.vttStore.selectedLightId.set(light.id);

    const rect = this.viewportRef().nativeElement.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const clampedX = Math.max(
      12,
      Math.min(this.viewportWidth() - 196, rawX + 8)
    );
    const clampedY = Math.max(
      12,
      Math.min(this.viewportHeight() - 160, rawY + 8)
    );

    this.lightContextMenu.set({
      lightId: light.id,
      screenX: Math.round(clampedX),
      screenY: Math.round(clampedY),
    });
  }

  onLightHandleDoubleClick(event: MouseEvent, light: VttLightSource): void {
    event.stopPropagation();
    if (!this.vttStore.isGm()) return;
    this.openEditLightModal(light.id);
  }

  openEditLightModal(lightId: string): void {
    this.lightContextMenu.set(null);
    const sc = this.vttStore.activeScene();
    const found = sc?.lights.find((l) => l.id === lightId);
    if (!found) return;

    this.vttStore.selectedLightId.set(found.id);
    this.editingLightDraft.set({
      lightId: found.id,
      bright_feet: found.bright_feet ?? 20,
      dim_feet: Math.max(found.dim_feet ?? 40, found.bright_feet ?? 20),
      color: found.color || '#FF9B42',
      enabled: found.enabled !== false,
    });
  }

  updateEditLightDimFeet(rawVal: number | string): void {
    const draft = this.editingLightDraft();
    if (!draft) return;
    const parsed = Math.max(0, Math.min(300, Math.round(Number(rawVal) || 0)));
    this.editingLightDraft.set({
      ...draft,
      dim_feet: parsed,
      bright_feet: Math.min(draft.bright_feet, parsed),
    });
  }

  updateEditLightBrightFeet(rawVal: number | string): void {
    const draft = this.editingLightDraft();
    if (!draft) return;
    const parsed = Math.max(0, Math.min(300, Math.round(Number(rawVal) || 0)));
    this.editingLightDraft.set({
      ...draft,
      bright_feet: parsed,
      dim_feet: Math.max(draft.dim_feet, parsed),
    });
  }

  updateEditLightColor(color: string): void {
    const draft = this.editingLightDraft();
    if (!draft) return;
    this.editingLightDraft.set({
      ...draft,
      color: color || '#FF9B42',
    });
  }

  updateEditLightEnabled(enabled: boolean): void {
    const draft = this.editingLightDraft();
    if (!draft) return;
    this.editingLightDraft.set({
      ...draft,
      enabled,
    });
  }

  async saveEditingLight(): Promise<void> {
    const draft = this.editingLightDraft();
    if (!draft) return;
    this.editingLightDraft.set(null);
    await this.vttStore.updateLightSource(draft.lightId, {
      bright_feet: draft.bright_feet,
      dim_feet: Math.max(draft.dim_feet, draft.bright_feet),
      color: draft.color,
      enabled: draft.enabled,
    });
  }

  cancelEditingLight(): void {
    this.editingLightDraft.set(null);
  }

  toggleLightEnabledFromMenu(light: VttLightSource): void {
    this.lightContextMenu.set(null);
    void this.vttStore.updateLightSource(light.id, {
      enabled: light.enabled === false,
    });
  }

  deleteLightFromMenu(lightId: string): void {
    this.lightContextMenu.set(null);
    if (this.editingLightDraft()?.lightId === lightId) {
      this.editingLightDraft.set(null);
    }
    void this.vttStore.deleteLightSource(lightId);
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    const nextCtrl = Boolean(event.ctrlKey || event.metaKey);
    if (nextCtrl !== this.ctrlPressed()) {
      this.ctrlPressed.set(nextCtrl);
      if (!nextCtrl && !this.dragTokenState() && this.chainedTokenMove()) {
        this.commitActiveChainedMove();
      }
    }
    const nextShift = Boolean(event.shiftKey);
    if (nextShift !== this.shiftPressed()) {
      this.shiftPressed.set(nextShift);
    }

    if (
      (event.buttons & 2) !== 0 &&
      (this.dragTokenState() !== null ||
        this.chainedTokenMove() !== null ||
        this.marqueeSelectState() !== null)
    ) {
      this.cancelActiveMovementOrDraft();
      this.suppressContextMenuUntil = Date.now() + 400;
      this.suppressRightPanUntilPointerUp = true;
      return;
    }

    if (this.isPanning() && this.panPointerStart) {
      const dx = event.clientX - this.panPointerStart.x;
      const dy = event.clientY - this.panPointerStart.y;
      this.panX.set(Math.round(this.panPointerStart.origPanX + dx));
      this.panY.set(Math.round(this.panPointerStart.origPanY + dy));
      return;
    }

    const sc = this.vttStore.activeScene();
    if (!sc) return;

    const vpEl = this.viewportRef()?.nativeElement;
    if (!vpEl) return;
    const rect = vpEl.getBoundingClientRect();
    const insideViewport =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    const worldPt = this.screenToWorld(event.clientX, event.clientY);
    this.lastPointerWorld.set(worldPt);
    const geom = this.vttStore.gridGeometry();
    const rawHex = worldPointToHex(worldPt, geom);

    if (
      sc.grid_mode !== 'gridless' &&
      insideViewport &&
      isHexInBounds(rawHex, geom.gridWidth, geom.gridHeight)
    ) {
      const prev = this.hoveredHex();
      if (!prev || prev.col !== rawHex.col || prev.row !== rawHex.row) {
        this.hoveredHex.set(rawHex);
      }
    } else if (this.hoveredHex() !== null) {
      this.hoveredHex.set(null);
    }

    const marquee = this.marqueeSelectState();
    if (marquee) {
      const currentScreen = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const screenDist = Math.hypot(
        currentScreen.x - marquee.startScreen.x,
        currentScreen.y - marquee.startScreen.y
      );
      const hasMoved = marquee.hasMoved || screenDist > 4;
      this.marqueeSelectState.set({
        ...marquee,
        currentWorld: worldPt,
        currentScreen,
        hasMoved,
      });
      if (hasMoved) {
        const matched = this.computeMarqueeTokenIds(
          marquee.startWorld,
          worldPt,
          marquee.additive ? marquee.initialSelectedIds : []
        );
        this.vttStore.setSelectedTokens(matched);
      }
      return;
    }

    const dragLight = this.dragLightState();
    if (dragLight) {
      const movedDist = Math.hypot(
        worldPt.x - dragLight.startPoint.x,
        worldPt.y - dragLight.startPoint.y
      );
      this.dragLightState.set({
        ...dragLight,
        currentPoint: worldPt,
        hasMoved: dragLight.hasMoved || movedDist > 3 / this.zoom(),
      });
      return;
    }

    const lightDraft = this.lightPlacementDraft();
    if (lightDraft) {
      const distPx = Math.hypot(
        worldPt.x - lightDraft.origin.x,
        worldPt.y - lightDraft.origin.y
      );
      const dragged = distPx >= 12 / this.zoom();
      const rawFeet = worldPixelsToFeet(distPx, geom.gridSizePx);
      const snappedDim = Math.max(10, Math.round(rawFeet / 5) * 5);
      const snappedBright = Math.round(snappedDim / 2 / 5) * 5;
      this.lightPlacementDraft.set({
        origin: lightDraft.origin,
        current: worldPt,
        dragged,
        brightFeet: dragged ? snappedBright : 20,
        dimFeet: dragged ? snappedDim : 40,
      });
      return;
    }

    if (this.wallDraftStart()) {
      this.wallDraftCurrent.set(this.snapWallVertex(worldPt, event.shiftKey));
      return;
    }

    if (this.rulerWorldStart()) {
      this.rulerWorldCurrent.set(
        clampWorldPointToBounds(worldPt, this.worldBounds(), 8)
      );
      return;
    }

    if (this.rulerStart()) {
      const clamped = clampHexToBounds(rawHex, geom.gridWidth, geom.gridHeight);
      this.rulerCurrent.set(clamped);
      return;
    }

    const dragTok = this.dragTokenState();
    if (dragTok) {
      this.dragTokenState.set(
        this.recomputeDragTokenForPointer(dragTok, worldPt, nextShift)
      );
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onWindowPointerUp(event: PointerEvent): void {
    if (event.button === 2 || (event.buttons & 2) === 0) {
      this.suppressRightPanUntilPointerUp = false;
    }

    if (this.isPanning()) {
      this.isPanning.set(false);
      this.panPointerStart = null;
    }

    if (event.button === 2 && !this.isPrimaryPointerDown(event)) {
      return;
    }

    const marquee = this.marqueeSelectState();
    if (marquee) {
      this.marqueeSelectState.set(null);
      const vpEl = this.viewportRef()?.nativeElement;
      if (vpEl) {
        const rect = vpEl.getBoundingClientRect();
        const endScreen = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const moved =
          marquee.hasMoved ||
          Math.hypot(
            endScreen.x - marquee.startScreen.x,
            endScreen.y - marquee.startScreen.y
          ) > 4;
        if (moved) {
          const endWorld = this.screenToWorld(event.clientX, event.clientY);
          const matched = this.computeMarqueeTokenIds(
            marquee.startWorld,
            endWorld,
            marquee.additive ? marquee.initialSelectedIds : []
          );
          this.vttStore.setSelectedTokens(matched);
        }
      }
    }

    const dragLight = this.dragLightState();
    if (dragLight) {
      this.dragLightState.set(null);
      if (dragLight.hasMoved) {
        void this.vttStore.updateLightSource(dragLight.lightId, {
          x: Math.round(dragLight.currentPoint.x),
          y: Math.round(dragLight.currentPoint.y),
        });
      }
    }

    const lightDraft = this.lightPlacementDraft();
    if (lightDraft) {
      this.lightPlacementDraft.set(null);
      void this.vttStore.addLightSource(lightDraft.origin, {
        bright_feet: lightDraft.brightFeet,
        dim_feet: lightDraft.dimFeet,
      });
    }

    const wallStart = this.wallDraftStart();
    const wallEnd = this.wallDraftCurrent();
    if (wallStart && wallEnd) {
      this.wallDraftStart.set(null);
      this.wallDraftCurrent.set(null);
      void this.vttStore.addWallSegment(
        wallStart,
        wallEnd,
        this.vttStore.activeWallKind()
      );
    }

    if (this.rulerWorldStart()) {
      this.rulerWorldStart.set(null);
      this.rulerWorldCurrent.set(null);
    }

    if (this.rulerStart()) {
      this.rulerStart.set(null);
      this.rulerCurrent.set(null);
    }

    const rawDragTok = this.dragTokenState();
    if (rawDragTok) {
      this.dragTokenState.set(null);
      const pointerUpWorld = this.screenToWorld(event.clientX, event.clientY);
      const dragTok = this.recomputeDragTokenForPointer(
        rawDragTok,
        pointerUpWorld,
        Boolean(event.shiftKey)
      );

      const keepChaining = Boolean(
        event.ctrlKey || event.metaKey || this.ctrlPressed()
      );
      const existingChain = this.chainedTokenMove();
      const geom = this.vttStore.gridGeometry();
      const startTileCenter = hexToWorldCenter(dragTok.startHex, geom);
      const startedOffCenter =
        Math.hypot(
          dragTok.startWorld.x - startTileCenter.x,
          dragTok.startWorld.y - startTileCenter.y
        ) > 2;

      const legValid = dragTok.freeUnsnap
        ? dragTok.hasMoved &&
          (!dragTok.gridlessBlocked || dragTok.shiftOverride)
        : dragTok.hasMoved &&
          (dragTok.pathResult.reachable || dragTok.shiftOverride) &&
          (dragTok.currentHex.col !== dragTok.startHex.col ||
            dragTok.currentHex.row !== dragTok.startHex.row ||
            startedOffCenter);

      if (legValid && dragTok.companions.length > 0 && !keepChaining) {
        this.chainedTokenMove.set(null);
        const batchMoves: BatchTokenMoveInput[] = [];
        if (dragTok.freeUnsnap) {
          this.queueTokenTravelWaypoints(dragTok.tokenId, [
            dragTok.startWorld,
            dragTok.currentWorld,
          ]);
          batchMoves.push({
            tokenId: dragTok.tokenId,
            distanceFeet: dragTok.gridlessFeet,
            freeOverride: dragTok.shiftOverride,
            targetWorld: dragTok.currentWorld,
          });
        } else {
          const pathSteps =
            dragTok.pathResult.path.length > 1
              ? dragTok.pathResult.path.slice(1)
              : [dragTok.currentHex];
          this.queueTokenTravelWaypoints(dragTok.tokenId, [
            dragTok.startWorld,
            ...pathSteps.map((h) => hexToWorldCenter(h, geom)),
          ]);
          batchMoves.push({
            tokenId: dragTok.tokenId,
            distanceFeet: dragTok.pathResult.feet,
            freeOverride: dragTok.shiftOverride,
            targetHex: dragTok.currentHex,
          });
        }

        for (const comp of dragTok.companions) {
          if (!comp.reachable && !dragTok.shiftOverride) continue;
          this.queueTokenTravelWaypoints(comp.tokenId, [
            comp.startWorld,
            comp.currentWorld,
          ]);
          if (dragTok.freeUnsnap) {
            batchMoves.push({
              tokenId: comp.tokenId,
              distanceFeet: comp.feet,
              freeOverride: dragTok.shiftOverride,
              targetWorld: comp.currentWorld,
            });
          } else {
            batchMoves.push({
              tokenId: comp.tokenId,
              distanceFeet: comp.feet,
              freeOverride: dragTok.shiftOverride,
              targetHex: comp.currentHex,
            });
          }
        }

        void this.vttStore.moveTokensBatch(batchMoves, this.worldBounds());
      } else if (legValid) {
        const legFeet = dragTok.freeUnsnap
          ? dragTok.gridlessFeet
          : dragTok.pathResult.feet;
        const baseChain =
          existingChain && existingChain.tokenId === dragTok.tokenId
            ? existingChain
            : null;
        const originHex = baseChain ? baseChain.originHex : dragTok.startHex;
        const originWorld = baseChain
          ? baseChain.originWorld
          : dragTok.startWorld;
        const prevLegs = baseChain ? baseChain.legs : [];
        const nextTotalFeet = (baseChain ? baseChain.totalFeet : 0) + legFeet;
        const nextWorld = dragTok.freeUnsnap
          ? dragTok.currentWorld
          : hexToWorldCenter(dragTok.currentHex, geom);

        const newLeg: ChainedMoveLeg = {
          fromHex: dragTok.startHex,
          toHex: dragTok.currentHex,
          fromWorld: dragTok.startWorld,
          toWorld: nextWorld,
          hexPath: dragTok.freeUnsnap ? [] : dragTok.pathResult.path,
          feet: legFeet,
          cumulativeFeet: nextTotalFeet,
          shiftOverride: dragTok.shiftOverride,
          freeUnsnap: dragTok.freeUnsnap,
        };

        const tok = this.vttStore
          .sceneTokens()
          .find((t) => t.id === dragTok.tokenId);

        const nextChain: ChainedTokenMoveState = {
          tokenId: dragTok.tokenId,
          tokenName: tok?.name ?? 'Token',
          gridMode: dragTok.gridMode,
          originHex,
          originWorld,
          currentHex: dragTok.currentHex,
          currentWorld: nextWorld,
          legs: [...prevLegs, newLeg],
          totalFeet: nextTotalFeet,
          anyShiftOverride:
            Boolean(baseChain?.anyShiftOverride) || dragTok.shiftOverride,
          lastUnsnapped: dragTok.freeUnsnap,
        };

        if (keepChaining) {
          this.chainedTokenMove.set(nextChain);
        } else if (nextChain.legs.length > 1) {
          this.chainedTokenMove.set(null);
          this.commitChainedTokenMoveState(nextChain);
        } else {
          this.chainedTokenMove.set(null);
          if (dragTok.freeUnsnap) {
            this.queueTokenTravelWaypoints(dragTok.tokenId, [
              dragTok.startWorld,
              dragTok.currentWorld,
            ]);
            void this.vttStore.moveTokenToWorldPoint(
              dragTok.tokenId,
              dragTok.currentWorld,
              dragTok.gridlessFeet,
              dragTok.shiftOverride,
              this.worldBounds()
            );
          } else {
            const pathSteps =
              dragTok.pathResult.path.length > 1
                ? dragTok.pathResult.path.slice(1)
                : [dragTok.currentHex];
            this.queueTokenTravelWaypoints(dragTok.tokenId, [
              dragTok.startWorld,
              ...pathSteps.map((h) => hexToWorldCenter(h, geom)),
            ]);
            void this.vttStore.moveTokenToHex(
              dragTok.tokenId,
              dragTok.currentHex.col,
              dragTok.currentHex.row,
              dragTok.pathResult.feet,
              dragTok.shiftOverride
            );
          }
        }
      } else {
        if (!dragTok.hasMoved) {
          if (dragTok.toggleOffOnClick) {
            this.vttStore.toggleTokenInSelection(dragTok.tokenId);
          } else if (dragTok.narrowToSingleOnClick && !keepChaining) {
            this.vttStore.selectSingleToken(dragTok.tokenId);
          }
        }
        if (!keepChaining && existingChain) {
          this.commitActiveChainedMove();
        }
      }
    }
  }

  dismissTransientEscapeState(): boolean {
    let dismissed = false;
    if (this.editingLightDraft()) {
      this.editingLightDraft.set(null);
      dismissed = true;
    }
    if (this.lightContextMenu()) {
      this.lightContextMenu.set(null);
      dismissed = true;
    }
    if (this.tokenContextMenu()) {
      this.tokenContextMenu.set(null);
      dismissed = true;
    }
    if (this.cancelActiveMovementOrDraft()) {
      dismissed = true;
    }
    return dismissed;
  }

  private syncShiftStateChange(shiftHeld: boolean): void {
    this.shiftPressed.set(shiftHeld);
    const dragTok = this.dragTokenState();
    const lastPt = this.lastPointerWorld();
    if (dragTok && lastPt) {
      this.dragTokenState.set(
        this.recomputeDragTokenForPointer(dragTok, lastPt, shiftHeld)
      );
    }
    const dropPrev = this.rosterDropPreview();
    const sc = this.vttStore.activeScene();
    if (dropPrev && sc && sc.grid_mode !== 'gridless') {
      this.rosterDropPreview.set({
        ...dropPrev,
        unsnapped: shiftHeld,
      });
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Control' || event.key === 'Meta') {
      this.ctrlPressed.set(true);
    }
    if (event.key === 'Shift') {
      this.syncShiftStateChange(true);
    }
    const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (event.code === 'Space') {
      this.spacePressed.set(true);
    }
  }

  @HostListener('window:keyup', ['$event'])
  onWindowKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spacePressed.set(false);
    }
    if (event.key === 'Shift' || (!event.shiftKey && this.shiftPressed())) {
      this.syncShiftStateChange(false);
    }
    if (
      event.key === 'Control' ||
      event.key === 'Meta' ||
      (!event.ctrlKey && !event.metaKey && this.ctrlPressed())
    ) {
      this.ctrlPressed.set(false);
      if (!this.dragTokenState() && this.chainedTokenMove()) {
        this.commitActiveChainedMove();
      }
    }
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    this.spacePressed.set(false);
    this.ctrlPressed.set(false);
    this.shiftPressed.set(false);
    this.rosterDropPreview.set(null);
    this.isPanning.set(false);
    this.panPointerStart = null;
    this.suppressRightPanUntilPointerUp = false;
    this.cancelActiveMovementOrDraft();
  }

  private renderFrame(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    const sc = this.vttStore.activeScene();
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const vw = Math.max(1, this.viewportWidth());
    const vh = Math.max(1, this.viewportHeight());
    const dpr = Math.min(
      2,
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    );

    const targetW = Math.round(vw * dpr);
    const targetH = Math.round(vh * dpr);
    if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
      canvasEl.width = targetW;
      canvasEl.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050908';
    ctx.fillRect(0, 0, vw, vh);

    if (!sc) return;

    const layout = this.vttStore.sceneLayout();
    const geom = layout.geometry;
    const wb = this.worldBounds();
    const z = this.zoom();
    const px = this.panX();
    const py = this.panY();
    const R = getHexRadius(geom.gridSizePx);
    const bgColor = sc.background_color || DEFAULT_VTT_BG_COLOR;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(z, z);

    if (layout.padding > 0) {
      ctx.fillStyle = '#091211';
      ctx.fillRect(0, 0, layout.totalWidth, layout.totalHeight);

      ctx.save();
      ctx.strokeStyle = 'rgba(138, 176, 171, 0.22)';
      ctx.lineWidth = Math.max(1, 1.4 / z);
      ctx.setLineDash([8 / z, 6 / z]);
      ctx.strokeRect(
        0.5 / z,
        0.5 / z,
        Math.max(0, layout.totalWidth - 1 / z),
        Math.max(0, layout.totalHeight - 1 / z)
      );
      ctx.restore();
    }

    const img = this.mapImage();
    ctx.fillStyle = bgColor;
    ctx.fillRect(
      layout.sceneX,
      layout.sceneY,
      layout.innerWidth,
      layout.innerHeight
    );

    if (img) {
      ctx.drawImage(
        img,
        layout.sceneX,
        layout.sceneY,
        layout.innerWidth,
        layout.innerHeight
      );
    } else {
      const sheen = ctx.createLinearGradient(
        layout.sceneX,
        layout.sceneY,
        layout.sceneX + layout.innerWidth,
        layout.sceneY + layout.innerHeight
      );
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.028)');
      sheen.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      sheen.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
      ctx.fillStyle = sheen;
      ctx.fillRect(
        layout.sceneX,
        layout.sceneY,
        layout.innerWidth,
        layout.innerHeight
      );
    }

    ctx.strokeStyle = 'rgba(56, 178, 154, 0.42)';
    ctx.lineWidth = Math.max(1, 2 / z);
    ctx.strokeRect(
      layout.sceneX,
      layout.sceneY,
      layout.innerWidth,
      layout.innerHeight
    );

    const lights = this.lightPolygons();
    for (const lp of lights) {
      if (lp.polygon.length < 3 || lp.dimRadiusPx <= 1) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lp.polygon[0].x, lp.polygon[0].y);
      for (let i = 1; i < lp.polygon.length; i++) {
        ctx.lineTo(lp.polygon[i].x, lp.polygon[i].y);
      }
      ctx.closePath();
      ctx.clip();

      const grad = ctx.createRadialGradient(
        lp.origin.x,
        lp.origin.y,
        0,
        lp.origin.x,
        lp.origin.y,
        lp.dimRadiusPx
      );
      const brightStop = Math.max(
        0.05,
        Math.min(0.92, lp.brightRadiusPx / lp.dimRadiusPx)
      );
      grad.addColorStop(0, hexToRgba(lp.color, 0.36));
      grad.addColorStop(brightStop, hexToRgba(lp.color, 0.19));
      grad.addColorStop(1, hexToRgba(lp.color, 0));

      ctx.fillStyle = grad;
      ctx.fillRect(
        lp.origin.x - lp.dimRadiusPx,
        lp.origin.y - lp.dimRadiusPx,
        lp.dimRadiusPx * 2,
        lp.dimRadiusPx * 2
      );
      ctx.restore();
    }

    if (sc.grid_mode !== 'gridless' && sc.grid_opacity > 0.01) {
      const step = Math.max(20, geom.gridSizePx);
      const visMinX = Math.max(0, -px / z - step);
      const visMaxX = Math.min(layout.totalWidth, (vw - px) / z + step);
      const visMinY = Math.max(0, -py / z - step);
      const visMaxY = Math.min(layout.totalHeight, (vh - py) / z + step);

      if (visMinX < visMaxX && visMinY < visMaxY) {
        const startColLine = Math.floor((visMinX - geom.offsetX) / step);
        const endColLine = Math.ceil((visMaxX - geom.offsetX) / step);
        const startRowLine = Math.floor((visMinY - geom.offsetY) / step);
        const endRowLine = Math.ceil((visMaxY - geom.offsetY) / step);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, layout.totalWidth, layout.totalHeight);
        ctx.clip();

        ctx.beginPath();
        for (let col = startColLine; col <= endColLine; col++) {
          const x = geom.offsetX + col * step;
          if (x < 0 || x > layout.totalWidth) continue;
          ctx.moveTo(x, visMinY);
          ctx.lineTo(x, visMaxY);
        }
        for (let row = startRowLine; row <= endRowLine; row++) {
          const y = geom.offsetY + row * step;
          if (y < 0 || y > layout.totalHeight) continue;
          ctx.moveTo(visMinX, y);
          ctx.lineTo(visMaxX, y);
        }
        ctx.strokeStyle = `rgba(215, 238, 234, ${Math.min(0.9, sc.grid_opacity)})`;
        ctx.lineWidth = Math.max(0.75, 1.15 / z);
        ctx.stroke();
        ctx.restore();
      }
    }

    const pendingTarget = this.vttStore.pendingTargetAction();
    if (pendingTarget) {
      const attacker = this.vttStore
        .sceneTokens()
        .find((t) => t.id === pendingTarget.attackerTokenId);
      if (attacker) {
        ctx.save();
        if (sc.grid_mode === 'gridless') {
          const attOrigin = getTokenWorldCenter(attacker, geom, 'gridless');
          const reachPx = feetToWorldPixels(
            pendingTarget.reachFeet,
            geom.gridSizePx
          );
          ctx.beginPath();
          ctx.arc(attOrigin.x, attOrigin.y, reachPx, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 146, 60, 0.11)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.55)';
          ctx.lineWidth = 2 / z;
          ctx.setLineDash([7 / z, 5 / z]);
          ctx.stroke();
        } else {
          const reachSteps = Math.max(
            1,
            Math.ceil(pendingTarget.reachFeet / 5) + 2
          );
          const colStart = Math.max(0, attacker.x - reachSteps);
          const colEnd = Math.min(geom.gridWidth - 1, attacker.x + reachSteps);
          const rowStart = Math.max(0, attacker.y - reachSteps);
          const rowEnd = Math.min(geom.gridHeight - 1, attacker.y + reachSteps);

          for (let col = colStart; col <= colEnd; col++) {
            for (let row = rowStart; row <= rowEnd; row++) {
              const dFeet = getHexDistanceFeet(
                { col: attacker.x, row: attacker.y },
                { col, row }
              );
              if (dFeet > 0 && dFeet <= pendingTarget.reachFeet) {
                const c = hexToWorldCenter({ col, row }, geom);
                const pts = getHexPolygonPoints(c, R * 0.96);
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                  ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(251, 146, 60, 0.13)';
                ctx.fill();
              }
            }
          }
        }
        ctx.restore();
      }
    }

    const hov = this.hoveredHex();
    const suppressTileHover =
      Boolean(this.dragTokenState()?.freeUnsnap) ||
      Boolean(this.rosterDropPreview()?.unsnapped);
    if (sc.grid_mode !== 'gridless' && hov && !suppressTileHover) {
      const hc = hexToWorldCenter(hov, geom);
      const pts = getHexPolygonPoints(hc, R * 0.97);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 178, 154, 0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.55)';
      ctx.lineWidth = 1.8 / z;
      ctx.stroke();
    }

    ctx.restore();

    if (sc.token_vision) {
      this.renderFogLayer(ctx, vw, vh, dpr, px, py, z, wb, R);
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(z, z);

    this.renderWallsAndDraft(ctx, z);
    this.renderLightGuidesAndDraft(ctx, z);
    this.renderPathsAndRulers(ctx, z, R);
    this.renderRosterDropPreview(ctx, z, R);
    this.renderPendingClashVector(ctx, z);
    this.renderPings(ctx, z);

    ctx.restore();
  }

  private renderRosterDropPreview(
    ctx: CanvasRenderingContext2D,
    z: number,
    hexRadius: number
  ): void {
    const preview = this.rosterDropPreview();
    const sc = this.vttStore.activeScene();
    if (!preview || !sc) return;

    const geom = this.vttStore.gridGeometry();
    const center = preview.unsnapped
      ? preview.worldPt
      : hexToWorldCenter(preview.hex, geom);
    const tint = preview.color || '#38B29A';

    ctx.save();
    if (!preview.unsnapped && sc.grid_mode !== 'gridless') {
      const pts = getHexPolygonPoints(center, hexRadius * 0.97);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(tint, 0.18);
      ctx.fill();
      ctx.strokeStyle = tint;
      ctx.lineWidth = 2.2 / z;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(center.x, center.y, hexRadius * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(tint, 0.24);
    ctx.fill();
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.strokeStyle = tint;
    ctx.lineWidth = 2.4 / z;
    ctx.stroke();
    ctx.restore();

    const modeHint =
      sc.grid_mode === 'gridless'
        ? 'Free Position'
        : preview.unsnapped
          ? 'Free Position (Shift)'
          : `Tile (${preview.hex.col}, ${preview.hex.row}) · Shift = Free`;
    this.drawWorldPill(
      ctx,
      center.x,
      center.y - hexRadius - 14 / z,
      `Deploy ${preview.name} · ${modeHint}`,
      tint,
      z
    );
  }

  private renderLightGuidesAndDraft(
    ctx: CanvasRenderingContext2D,
    z: number
  ): void {
    if (
      !this.vttStore.isGm() ||
      this.vttStore.previewPlayerVision() ||
      this.vttStore.activeTool() !== 'light'
    ) {
      return;
    }

    const geom = this.vttStore.gridGeometry();
    const placing = this.lightPlacementDraft();
    if (placing && placing.dragged) {
      const dimPx = feetToWorldPixels(placing.dimFeet, geom.gridSizePx);
      const brightPx = feetToWorldPixels(placing.brightFeet, geom.gridSizePx);

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 155, 66, 0.85)';
      ctx.lineWidth = 2 / z;
      ctx.setLineDash([7 / z, 5 / z]);
      ctx.beginPath();
      ctx.arc(placing.origin.x, placing.origin.y, dimPx, 0, Math.PI * 2);
      ctx.stroke();

      if (brightPx > 0) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
        ctx.setLineDash([4 / z, 4 / z]);
        ctx.beginPath();
        ctx.arc(placing.origin.x, placing.origin.y, brightPx, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      this.drawWorldPill(
        ctx,
        placing.origin.x,
        placing.origin.y - dimPx - 14 / z,
        `Emit ${placing.brightFeet} / ${placing.dimFeet} ft`,
        '#FF9B42',
        z
      );
      return;
    }

    const focusId =
      this.editingLightDraft()?.lightId ?? this.vttStore.selectedLightId();
    if (!focusId) return;

    const target = this.effectiveSceneLights().find((l) => l.id === focusId);
    if (!target) return;

    const dimFeet = Math.max(target.dim_feet ?? 0, target.bright_feet ?? 0);
    if (dimFeet <= 0) return;

    const dimPx = feetToWorldPixels(dimFeet, geom.gridSizePx);
    const brightPx = feetToWorldPixels(
      target.bright_feet ?? 0,
      geom.gridSizePx
    );
    const tint = target.color || '#FF9B42';

    ctx.save();
    ctx.strokeStyle = hexToRgba(tint, 0.72);
    ctx.lineWidth = 1.8 / z;
    ctx.setLineDash([8 / z, 6 / z]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, dimPx, 0, Math.PI * 2);
    ctx.stroke();

    if (brightPx > 0 && brightPx < dimPx) {
      ctx.strokeStyle = hexToRgba(tint, 0.45);
      ctx.setLineDash([4 / z, 4 / z]);
      ctx.beginPath();
      ctx.arc(target.x, target.y, brightPx, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderFogLayer(
    mainCtx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    dpr: number,
    px: number,
    py: number,
    z: number,
    wb: { width: number; height: number },
    hexRadius: number
  ): void {
    const sc = this.vttStore.activeScene();
    if (!sc) return;

    if (!this.offscreenFogCanvas && typeof document !== 'undefined') {
      this.offscreenFogCanvas = document.createElement('canvas');
    }
    const fogCanvas = this.offscreenFogCanvas;
    if (!fogCanvas) return;

    const targetW = Math.round(vw * dpr);
    const targetH = Math.round(vh * dpr);
    if (fogCanvas.width !== targetW || fogCanvas.height !== targetH) {
      fogCanvas.width = targetW;
      fogCanvas.height = targetH;
    }

    const fctx = fogCanvas.getContext('2d');
    if (!fctx) return;

    const isGm = this.vttStore.isGm();
    const preview = this.vttStore.previewPlayerVision();
    const playerMode = !isGm || preview;
    const clampedDarkness = Math.max(0, Math.min(1, sc.darkness_level ?? 0));
    const baseDarkness = playerMode
      ? 0.985
      : sc.global_illumination
        ? 0.28
        : Math.max(0.32, Math.min(0.64, 0.32 + clampedDarkness * 0.32));

    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, vw, vh);
    fctx.fillStyle = `rgba(5, 10, 9, ${baseDarkness})`;
    fctx.fillRect(0, 0, vw, vh);

    fctx.save();
    fctx.translate(px, py);
    fctx.scale(z, z);
    fctx.globalCompositeOperation = 'destination-out';

    const geom = this.vttStore.gridGeometry();
    const shroudPunchAlpha = playerMode ? 0.42 : 0.35;

    if (sc.explored_fog?.revealed_all) {
      fctx.fillStyle = `rgba(0, 0, 0, ${shroudPunchAlpha})`;
      fctx.fillRect(-40, -40, wb.width + 80, wb.height + 80);
    } else if (sc.fog_enabled && sc.explored_fog?.cells?.length) {
      fctx.beginPath();
      const expandedR = hexRadius * 1.04;
      for (const key of sc.explored_fog.cells) {
        const parsed = parseHexKey(key);
        if (!parsed) continue;
        const c = hexToWorldCenter(parsed, geom);
        const pts = getHexPolygonPoints(c, expandedR);
        fctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          fctx.lineTo(pts[i].x, pts[i].y);
        }
        fctx.closePath();
      }
      fctx.fillStyle = `rgba(0, 0, 0, ${shroudPunchAlpha})`;
      fctx.fill();
    }

    const visions = this.observerVisions();
    const lights = this.lightPolygons();

    for (const obs of visions) {
      if (obs.personalPolygon.length >= 3) {
        fctx.beginPath();
        fctx.moveTo(obs.personalPolygon[0].x, obs.personalPolygon[0].y);
        for (let i = 1; i < obs.personalPolygon.length; i++) {
          fctx.lineTo(obs.personalPolygon[i].x, obs.personalPolygon[i].y);
        }
        fctx.closePath();
        fctx.fillStyle = 'rgba(0, 0, 0, 1)';
        fctx.fill();
      }

      if (
        !sc.global_illumination &&
        lights.length > 0 &&
        obs.unboundedLosPolygon.length >= 3
      ) {
        fctx.save();
        fctx.beginPath();
        fctx.moveTo(obs.unboundedLosPolygon[0].x, obs.unboundedLosPolygon[0].y);
        for (let i = 1; i < obs.unboundedLosPolygon.length; i++) {
          fctx.lineTo(
            obs.unboundedLosPolygon[i].x,
            obs.unboundedLosPolygon[i].y
          );
        }
        fctx.closePath();
        fctx.clip();

        for (const lp of lights) {
          if (lp.polygon.length < 3) continue;
          fctx.beginPath();
          fctx.moveTo(lp.polygon[0].x, lp.polygon[0].y);
          for (let i = 1; i < lp.polygon.length; i++) {
            fctx.lineTo(lp.polygon[i].x, lp.polygon[i].y);
          }
          fctx.closePath();
          fctx.fillStyle = 'rgba(0, 0, 0, 1)';
          fctx.fill();
        }
        fctx.restore();
      }
    }

    fctx.restore();

    if (!sc.global_illumination && visions.length > 0) {
      const nightVeilAlpha = playerMode
        ? 0.14 + clampedDarkness * 0.2
        : 0.05 + clampedDarkness * 0.09;

      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.globalCompositeOperation = 'destination-over';
      fctx.fillStyle = `rgba(6, 12, 22, ${nightVeilAlpha})`;
      fctx.fillRect(0, 0, vw, vh);

      if (lights.length > 0) {
        fctx.save();
        fctx.translate(px, py);
        fctx.scale(z, z);
        fctx.globalCompositeOperation = 'destination-out';

        for (const obs of visions) {
          if (obs.unboundedLosPolygon.length < 3) continue;
          fctx.save();
          fctx.beginPath();
          fctx.moveTo(
            obs.unboundedLosPolygon[0].x,
            obs.unboundedLosPolygon[0].y
          );
          for (let i = 1; i < obs.unboundedLosPolygon.length; i++) {
            fctx.lineTo(
              obs.unboundedLosPolygon[i].x,
              obs.unboundedLosPolygon[i].y
            );
          }
          fctx.closePath();
          fctx.clip();

          for (const lp of lights) {
            if (lp.polygon.length < 3 || lp.dimRadiusPx <= 1) continue;
            const brightStop =
              lp.brightRadiusPx > 0
                ? Math.min(0.95, Math.max(0.05, lp.brightRadiusPx / lp.dimRadiusPx))
                : 0;
            const burnGrad = fctx.createRadialGradient(
              lp.origin.x,
              lp.origin.y,
              0,
              lp.origin.x,
              lp.origin.y,
              lp.dimRadiusPx
            );
            if (brightStop > 0) {
              burnGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
              burnGrad.addColorStop(brightStop, 'rgba(0, 0, 0, 1)');
              burnGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
            } else {
              burnGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
              burnGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
            }

            fctx.beginPath();
            fctx.moveTo(lp.polygon[0].x, lp.polygon[0].y);
            for (let i = 1; i < lp.polygon.length; i++) {
              fctx.lineTo(lp.polygon[i].x, lp.polygon[i].y);
            }
            fctx.closePath();
            fctx.fillStyle = burnGrad;
            fctx.fill();
          }

          fctx.restore();
        }

        fctx.restore();
      }
    }

    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.drawImage(fogCanvas, 0, 0);
    mainCtx.restore();
  }

  private renderWallsAndDraft(ctx: CanvasRenderingContext2D, z: number): void {
    const sc = this.vttStore.activeScene();
    if (!sc) return;

    const showAllWalls =
      this.vttStore.isGm() && !this.vttStore.previewPlayerVision();
    const visibleDoorIds = new Set(
      this.visibleDoorHandles().map((d) => d.wall.id)
    );

    for (const w of sc.walls) {
      if (!showAllWalls) {
        if (w.kind !== 'door' || !visibleDoorIds.has(w.id)) {
          continue;
        }
      }

      ctx.save();
      ctx.lineCap = 'round';
      if (w.kind === 'wall') {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4 / z;
        ctx.setLineDash([]);
      } else if (w.kind === 'window') {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3.5 / z;
        ctx.setLineDash([8 / z, 6 / z]);
      } else if (w.open) {
        ctx.strokeStyle = '#38B29A';
        ctx.lineWidth = 3 / z;
        ctx.setLineDash([5 / z, 6 / z]);
      } else {
        ctx.strokeStyle = '#EA580C';
        ctx.lineWidth = 5.5 / z;
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();

      if (showAllWalls && this.vttStore.activeTool() === 'wall') {
        ctx.fillStyle = '#FDE68A';
        const r = 3.5 / z;
        ctx.beginPath();
        ctx.arc(w.x1, w.y1, r, 0, Math.PI * 2);
        ctx.arc(w.x2, w.y2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const draftA = this.wallDraftStart();
    const draftB = this.wallDraftCurrent();
    if (draftA && draftB) {
      ctx.save();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 4 / z;
      ctx.setLineDash([7 / z, 5 / z]);
      ctx.beginPath();
      ctx.moveTo(draftA.x, draftA.y);
      ctx.lineTo(draftB.x, draftB.y);
      ctx.stroke();

      const mx = (draftA.x + draftB.x) / 2;
      const my = (draftA.y + draftB.y) / 2 - 14 / z;
      this.drawWorldPill(
        ctx,
        mx,
        my,
        `${this.vttStore.activeWallKind().toUpperCase()} · ${this.wallDraftFeet()} ft`,
        '#F59E0B',
        z
      );
      ctx.restore();
    }
  }

  private renderPathsAndRulers(
    ctx: CanvasRenderingContext2D,
    z: number,
    hexRadius: number
  ): void {
    const sc = this.vttStore.activeScene();
    const geom = this.vttStore.gridGeometry();
    const chain = this.chainedTokenMove();
    const dragTok = this.dragTokenState();

    if (chain && chain.legs.length > 0) {
      const chainTok = this.vttStore
        .sceneTokens()
        .find((t) => t.id === chain.tokenId);
      const speedFeet = chainTok?.move_feet ?? 20;
      const originPt = chain.originWorld;

      ctx.save();
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.72)';
      ctx.lineWidth = 2 / z;
      ctx.setLineDash([5 / z, 4 / z]);
      ctx.beginPath();
      ctx.arc(originPt.x, originPt.y, hexRadius * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const hasActiveDragLeg = Boolean(
        dragTok && dragTok.tokenId === chain.tokenId && dragTok.hasMoved
      );

      for (let i = 0; i < chain.legs.length; i++) {
        const leg = chain.legs[i];
        let legStroke = '#38B29A';
        if (leg.cumulativeFeet > speedFeet * 2) {
          legStroke = '#FB7185';
        } else if (leg.cumulativeFeet > speedFeet) {
          legStroke = '#F59E0B';
        }

        if (leg.freeUnsnap) {
          this.strokeWorldRay(ctx, leg.fromWorld, leg.toWorld, legStroke, z);
        } else {
          this.strokeHexPath(ctx, leg.hexPath, geom, legStroke, z, hexRadius);
        }

        const isLastLockedLeg = i === chain.legs.length - 1;
        if (!isLastLockedLeg || hasActiveDragLeg) {
          const wpPt = leg.freeUnsnap
            ? leg.toWorld
            : hexToWorldCenter(leg.toHex, geom);
          this.drawWorldPill(
            ctx,
            wpPt.x,
            wpPt.y - hexRadius * 0.55 - 8 / z,
            `${leg.cumulativeFeet} ft`,
            legStroke,
            z
          );
        }
      }

      if (!hasActiveDragLeg) {
        let chainStroke = '#38B29A';
        if (chain.totalFeet > speedFeet * 2) {
          chainStroke = '#FB7185';
        } else if (chain.totalFeet > speedFeet) {
          chainStroke = '#F59E0B';
        }
        const chainEndPt = chain.lastUnsnapped
          ? chain.currentWorld
          : hexToWorldCenter(chain.currentHex, geom);
        if (
          chainTok &&
          this.settingsStore.preferences().tokenMoveSpeed > 0
        ) {
          this.drawTokenDestinationGhost(
            ctx,
            chainEndPt,
            chainTok,
            chainStroke,
            hexRadius,
            z
          );
        }
        const movesNeeded = Math.max(
          1,
          Math.ceil(chain.totalFeet / Math.max(5, speedFeet))
        );
        const chainLabel = `${chain.totalFeet} ft · ${movesNeeded} ${movesNeeded === 1 ? 'Move' : 'Moves'} · Chain`;
        this.drawWorldPill(
          ctx,
          chainEndPt.x,
          chainEndPt.y - hexRadius - 14 / z,
          chainLabel,
          chainStroke,
          z
        );
      }
    }

    if (dragTok && dragTok.hasMoved) {
      const tok = this.vttStore
        .sceneTokens()
        .find((t) => t.id === dragTok.tokenId);
      const speedFeet = tok?.move_feet ?? 20;
      const priorFeet =
        chain && chain.tokenId === dragTok.tokenId ? chain.totalFeet : 0;

      if (dragTok.freeUnsnap) {
        const legFeet = dragTok.gridlessFeet;
        const totalFeet = priorFeet + legFeet;
        let stroke = '#38B29A';
        if (dragTok.gridlessBlocked && !dragTok.shiftOverride) {
          stroke = '#F43F5E';
        } else if (totalFeet > speedFeet * 2) {
          stroke = '#FB7185';
        } else if (totalFeet > speedFeet) {
          stroke = '#F59E0B';
        }

        this.strokeWorldRay(
          ctx,
          dragTok.startWorld,
          dragTok.currentWorld,
          stroke,
          z
        );
        if (tok && this.settingsStore.preferences().tokenMoveSpeed > 0) {
          this.drawTokenDestinationGhost(
            ctx,
            dragTok.currentWorld,
            tok,
            stroke,
            hexRadius,
            z
          );
        }

        const freeBadge =
          dragTok.gridMode !== 'gridless' ? ' · Free (Shift)' : '';
        const movesNeeded =
          totalFeet > 0
            ? Math.ceil(totalFeet / Math.max(5, speedFeet))
            : 0;
        const movesStr =
          movesNeeded === 0
            ? 'Free Nudge'
            : `${movesNeeded} ${movesNeeded === 1 ? 'Move' : 'Moves'}`;
        const label =
          dragTok.gridlessBlocked && !dragTok.shiftOverride
            ? priorFeet > 0
              ? `Blocked (${priorFeet} + ${legFeet} ft)`
              : `Blocked (${legFeet} ft)`
            : priorFeet > 0
              ? `${totalFeet} ft (+${legFeet} ft) · ${movesStr}${freeBadge}`
              : `${totalFeet} ft · ${movesStr}${freeBadge}${this.ctrlPressed() ? ' · Chain' : ''}`;
        this.drawWorldPill(
          ctx,
          dragTok.currentWorld.x,
          dragTok.currentWorld.y - hexRadius - 14 / z,
          label,
          stroke,
          z
        );
      } else {
        const pathRes = dragTok.pathResult;
        const legFeet = pathRes.feet;
        const totalFeet = priorFeet + legFeet;

        let stroke = '#38B29A';
        if (!pathRes.reachable && !dragTok.shiftOverride) {
          stroke = '#F43F5E';
        } else if (totalFeet > speedFeet * 2) {
          stroke = '#FB7185';
        } else if (totalFeet > speedFeet) {
          stroke = '#F59E0B';
        }

        this.strokeHexPath(ctx, pathRes.path, geom, stroke, z, hexRadius);

        const endPt = hexToWorldCenter(dragTok.currentHex, geom);
        if (tok && this.settingsStore.preferences().tokenMoveSpeed > 0) {
          this.drawTokenDestinationGhost(
            ctx,
            endPt,
            tok,
            stroke,
            hexRadius,
            z
          );
        }
        const movesNeeded = Math.max(
          1,
          Math.ceil(totalFeet / Math.max(5, speedFeet))
        );
        const movesStr = `${movesNeeded} ${movesNeeded === 1 ? 'Move' : 'Moves'}`;
        const label =
          !pathRes.reachable && !dragTok.shiftOverride
            ? priorFeet > 0
              ? `Blocked (${priorFeet} + ${legFeet} ft)`
              : `Blocked (${legFeet} ft)`
            : priorFeet > 0
              ? `${totalFeet} ft (+${legFeet} ft) · ${movesStr}`
              : `${totalFeet} ft · ${movesStr}${this.ctrlPressed() ? ' · Chain' : ''}`;
        this.drawWorldPill(
          ctx,
          endPt.x,
          endPt.y - hexRadius - 14 / z,
          label,
          stroke,
          z
        );
      }

      if (dragTok.companions.length > 0) {
        const sceneToks = this.vttStore.sceneTokens();
        for (const comp of dragTok.companions) {
          const compTok = sceneToks.find((t) => t.id === comp.tokenId);
          const compStroke =
            comp.reachable || dragTok.shiftOverride ? '#38B29A' : '#F43F5E';
          this.strokeWorldRay(
            ctx,
            comp.startWorld,
            comp.currentWorld,
            compStroke,
            z
          );
          if (compTok && this.settingsStore.preferences().tokenMoveSpeed > 0) {
            this.drawTokenDestinationGhost(
              ctx,
              comp.currentWorld,
              compTok,
              compStroke,
              hexRadius,
              z
            );
          }
        }
      }
    }

    const rWorldA = this.rulerWorldStart();
    const rWorldB = this.rulerWorldCurrent();
    if (rWorldA && rWorldB) {
      const distPx = Math.hypot(rWorldB.x - rWorldA.x, rWorldB.y - rWorldA.y);
      if (distPx > 3) {
        const feet = worldPixelsToFeet(distPx, geom.gridSizePx);
        const blocked = isWorldSegmentBlockedByWalls(
          rWorldA,
          rWorldB,
          sc?.walls ?? []
        );
        const stroke = blocked ? '#F43F5E' : '#38BDF8';
        this.strokeWorldRay(ctx, rWorldA, rWorldB, stroke, z);
        const label = blocked ? `${feet} ft (Wall Blocked)` : `${feet} ft`;
        this.drawWorldPill(
          ctx,
          rWorldB.x,
          rWorldB.y - 22 / z,
          label,
          stroke,
          z
        );
      }
    }

    const rulerPath = this.activeRulerPath();
    if (rulerPath && rulerPath.path.length > 1) {
      const stroke = rulerPath.reachable ? '#38BDF8' : '#F43F5E';
      this.strokeHexPath(ctx, rulerPath.path, geom, stroke, z, hexRadius);
      const lastHex = rulerPath.path[rulerPath.path.length - 1];
      const endPt = hexToWorldCenter(lastHex, geom);
      const label = rulerPath.reachable
        ? `${rulerPath.feet} ft`
        : `${rulerPath.feet} ft (Wall Blocked)`;
      this.drawWorldPill(
        ctx,
        endPt.x,
        endPt.y - hexRadius - 12 / z,
        label,
        stroke,
        z
      );
    }
  }

  private strokeWorldRay(
    ctx: CanvasRenderingContext2D,
    fromPt: VttPoint,
    toPt: VttPoint,
    color: string,
    z: number
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.2 / z;
    ctx.lineCap = 'round';
    ctx.setLineDash([8 / z, 5 / z]);

    ctx.beginPath();
    ctx.moveTo(fromPt.x, fromPt.y);
    ctx.lineTo(toPt.x, toPt.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(fromPt.x, fromPt.y, 4 / z, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(toPt.x, toPt.y, 6 / z, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private strokeHexPath(
    ctx: CanvasRenderingContext2D,
    coords: HexCoord[],
    geom: ReturnType<VttStore['gridGeometry']>,
    color: string,
    z: number,
    hexRadius: number
  ): void {
    if (coords.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5 / z;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([8 / z, 5 / z]);

    ctx.beginPath();
    const first = hexToWorldCenter(coords[0], geom);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < coords.length; i++) {
      const pt = hexToWorldCenter(coords[i], geom);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 1; i < coords.length; i++) {
      const pt = hexToWorldCenter(coords[i], geom);
      ctx.beginPath();
      ctx.arc(
        pt.x,
        pt.y,
        i === coords.length - 1 ? 5.5 / z : 3.2 / z,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = color;
      ctx.fill();
    }

    const destPts = getHexPolygonPoints(
      hexToWorldCenter(coords[coords.length - 1], geom),
      hexRadius * 0.94
    );
    ctx.beginPath();
    ctx.moveTo(destPts[0].x, destPts[0].y);
    for (let i = 1; i < destPts.length; i++) {
      ctx.lineTo(destPts[i].x, destPts[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 / z;
    ctx.stroke();

    ctx.restore();
  }

  private drawTokenDestinationGhost(
    ctx: CanvasRenderingContext2D,
    center: VttPoint,
    token: VttTokenModel,
    borderColor: string,
    hexRadius: number,
    z: number
  ): void {
    const r = Math.max(
      18,
      hexRadius * 0.82 * Math.min(2, Math.max(1, token.size || 1))
    );
    const fillHex =
      token.color ||
      (token.faction === 'enemy'
        ? '#E11D48'
        : token.faction === 'neutral'
          ? '#D97706'
          : '#0D9488');

    ctx.save();
    ctx.fillStyle = hexToRgba(fillHex, 0.28);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2.4 / z;
    ctx.setLineDash([6 / z, 4 / z]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    const initials = (token.name || '?').trim().slice(0, 2).toUpperCase();
    ctx.font = `700 ${Math.max(11, Math.round(r * 0.62))}px "Cinzel", serif`;
    ctx.fillStyle = 'rgba(235, 245, 243, 0.82)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, center.x, center.y + 1 / z);
    ctx.restore();
  }

  private renderPendingClashVector(
    ctx: CanvasRenderingContext2D,
    z: number
  ): void {
    const sc = this.vttStore.activeScene();
    const clash = this.vttStore.pendingClash();
    if (!sc || !clash) return;
    const toks = this.vttStore.sceneTokens();
    const att = toks.find((t) => t.id === clash.attackerTokenId);
    const def = toks.find((t) => t.id === clash.defenderTokenId);
    if (!att || !def) return;

    const geom = this.vttStore.gridGeometry();
    const animPos = this.tokenAnimPositions();
    const a = animPos[att.id] ?? getTokenWorldCenter(att, geom, sc.grid_mode);
    const b = animPos[def.id] ?? getTokenWorldCenter(def, geom, sc.grid_mode);

    ctx.save();
    ctx.strokeStyle = '#FB923C';
    ctx.lineWidth = 3.5 / z;
    ctx.setLineDash([9 / z, 5 / z]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  private renderPings(ctx: CanvasRenderingContext2D, z: number): void {
    const now = Date.now();
    for (const ping of this.vttStore.activePings()) {
      const elapsed = Math.max(0, now - ping.createdAt);
      const progress = Math.min(1, elapsed / 2200);
      const alpha = 1 - progress;
      const r1 = (12 + progress * 58) / z;
      const r2 = (4 + progress * 34) / z;

      ctx.save();
      ctx.strokeStyle = hexToRgba(ping.color || '#38B29A', alpha);
      ctx.lineWidth = 2.8 / z;
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, r1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ping.x, ping.y, r2, 0, Math.PI * 2);
      ctx.stroke();

      this.drawWorldPill(
        ctx,
        ping.x,
        ping.y - r1 - 10 / z,
        ping.senderName,
        ping.color || '#38B29A',
        z
      );
      ctx.restore();
    }
  }

  private drawWorldPill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    borderColor: string,
    z: number
  ): void {
    ctx.save();
    const fontSize = Math.round(12 / z);
    ctx.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
    const metrics = ctx.measureText(text);
    const padX = 8 / z;
    const h = 22 / z;
    const w = metrics.width + padX * 2;

    ctx.fillStyle = 'rgba(9, 16, 15, 0.92)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5 / z;

    const rx = x - w / 2;
    const ry = y - h / 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, w, h, 6 / z);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EBF5F3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5 / z);
    ctx.restore();
  }
}
