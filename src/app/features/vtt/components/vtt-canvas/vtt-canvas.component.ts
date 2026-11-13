import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompendiumIconComponent } from '../../../../shared/compendium-icon/compendium-icon.component';
import {
  HexPathResult,
  clampHexToBounds,
  feetToWorldPixels,
  findHexPath,
  getHexDistanceFeet,
  getHexPolygonPoints,
  getHexRadius,
  getHexWorldBounds,
  hexKey,
  hexToWorldCenter,
  isHexInBounds,
  parseHexKey,
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
  HexCoord,
  VttLightSource,
  VttPoint,
  VttTokenModel,
  VttWallSegment,
} from '../../models/vtt.model';
import { VttStore } from '../../store/vtt.store';

interface DragTokenState {
  tokenId: string;
  startHex: HexCoord;
  currentHex: HexCoord;
  hasMoved: boolean;
  shiftOverride: boolean;
  pathResult: HexPathResult;
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
  hpPct: number;
  spPct: number;
  isSelected: boolean;
  isTurnActive: boolean;
  isControllable: boolean;
  isTargetable: boolean;
  inTargetReach: boolean;
  distanceFromAttackerFeet: number | null;
  apPips: number[];
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
  imports: [FormsModule, CompendiumIconComponent],
  templateUrl: './vtt-canvas.component.html',
})
export class VttCanvasComponent implements AfterViewInit {
  readonly vttStore = inject(VttStore);
  private readonly destroyRef = inject(DestroyRef);

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
  readonly isPanning = signal(false);

  readonly hoveredHex = signal<HexCoord | null>(null);
  readonly dragTokenState = signal<DragTokenState | null>(null);
  readonly dragLightState = signal<DragLightState | null>(null);
  readonly lightPlacementDraft = signal<LightPlacementDraft | null>(null);
  readonly lightContextMenu = signal<LightContextMenuState | null>(null);
  readonly editingLightDraft = signal<EditingLightDraft | null>(null);
  readonly rulerStart = signal<HexCoord | null>(null);
  readonly rulerCurrent = signal<HexCoord | null>(null);
  readonly wallDraftStart = signal<VttPoint | null>(null);
  readonly wallDraftCurrent = signal<VttPoint | null>(null);

  readonly mapImage = signal<HTMLImageElement | null>(null);
  readonly mapNaturalSize = signal<{ width: number; height: number } | null>(null);

  private loadedMapUrl: string | null = null;
  private lastFittedSceneId: string | null = null;
  private offscreenFogCanvas: HTMLCanvasElement | null = null;
  private panPointerStart: { x: number; y: number; origPanX: number; origPanY: number } | null =
    null;
  private pingAnimFrame: number | null = null;

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  readonly worldBounds = computed(() => {
    const hb = getHexWorldBounds(this.vttStore.gridGeometry());
    const nat = this.mapNaturalSize();
    return {
      width: Math.max(hb.width, nat?.width ?? 0),
      height: Math.max(hb.height, nat?.height ?? 0),
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

  readonly lightPolygons = computed<ComputedLightPolygon[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    return buildLightPolygons(
      this.effectiveSceneLights(),
      this.vttStore.sceneTokens(),
      sc.walls,
      this.vttStore.gridGeometry()
    );
  });

  readonly observerVisions = computed<ComputedObserverVision[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    const wb = this.worldBounds();
    const maxDiag = Math.hypot(wb.width, wb.height) + 300;
    return buildObserverVisions(
      this.vttStore.observerTokens(),
      sc.walls,
      this.vttStore.gridGeometry(),
      sc.global_illumination,
      maxDiag
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
    return Math.max(5, worldPixelsToFeet(distPx, this.vttStore.gridGeometry().gridSizePx));
  });

  readonly renderableTokens = computed<RenderableVttToken[]>(() => {
    const sc = this.vttStore.activeScene();
    if (!sc) return [];
    const geom = this.vttStore.gridGeometry();
    const isGm = this.vttStore.isGm();
    const preview = this.vttStore.previewPlayerVision();
    const restrictVision = !isGm || preview;
    const visions = this.observerVisions();
    const lights = this.lightPolygons();
    const drag = this.dragTokenState();
    const selId = this.vttStore.selectedTokenId();
    const pendingTarget = this.vttStore.pendingTargetAction();
    const attackerTok = pendingTarget
      ? this.vttStore.sceneTokens().find((t) => t.id === pendingTarget.attackerTokenId) ?? null
      : null;

    const results: RenderableVttToken[] = [];

    for (const tok of this.vttStore.sceneTokens()) {
      const controllable = this.vttStore.canControlToken(tok);

      if (tok.is_hidden && restrictVision && !controllable) {
        continue;
      }

      if (
        restrictVision &&
        sc.fog_enabled &&
        !sc.explored_fog?.revealed_all &&
        tok.faction !== 'ally' &&
        !controllable
      ) {
        const tokCenter = hexToWorldCenter({ col: tok.x, row: tok.y }, geom);
        const seen = isWorldPointVisibleToObservers(
          tokCenter,
          visions,
          lights,
          sc.walls,
          sc.global_illumination
        );
        if (!seen) {
          continue;
        }
      }

      const displayCoord =
        drag && drag.tokenId === tok.id
          ? drag.currentHex
          : { col: tok.x, row: tok.y };
      const center = hexToWorldCenter(displayCoord, geom);
      const radiusPx = Math.max(
        18,
        getHexRadius(geom.gridSizePx) * 0.72 * Math.min(2, Math.max(1, tok.size || 1))
      );

      let distFromAttacker: number | null = null;
      let inReach = false;
      const isTargetable = Boolean(pendingTarget && attackerTok && attackerTok.id !== tok.id);
      if (isTargetable && attackerTok && pendingTarget) {
        distFromAttacker = getHexDistanceFeet(
          { col: attackerTok.x, row: attackerTok.y },
          { col: tok.x, row: tok.y }
        );
        inReach = distFromAttacker <= pendingTarget.reachFeet;
      }

      const maxAp = Math.max(1, Math.min(8, tok.max_ap || 4));
      const pips = Array.from({ length: maxAp }, (_, idx) => idx);

      results.push({
        token: tok,
        center,
        radiusPx,
        hpPct: Math.max(0, Math.min(100, (tok.current_hp / Math.max(1, tok.max_hp)) * 100)),
        spPct:
          tok.max_sp > 0
            ? Math.max(0, Math.min(100, (tok.current_sp / tok.max_sp) * 100))
            : 0,
        isSelected: selId === tok.id,
        isTurnActive: sc.combat_active && sc.active_turn_token_id === tok.id,
        isControllable: controllable,
        isTargetable,
        inTargetReach: inReach,
        distanceFromAttackerFeet: distFromAttacker,
        apPips: pips,
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

      if (!showAll && sc.fog_enabled && !sc.explored_fog?.revealed_all) {
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
        if (!inActiveLos && !exploredSet.has(key)) {
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
        } else {
          const img = new Image();
          img.onload = () => {
            if (this.loadedMapUrl === url) {
              this.mapImage.set(img);
              this.mapNaturalSize.set({
                width: img.naturalWidth || 1200,
                height: img.naturalHeight || 800,
              });
            }
          };
          img.onerror = () => {
            if (this.loadedMapUrl === url) {
              this.mapImage.set(null);
              this.mapNaturalSize.set(null);
            }
          };
          img.src = url;
        }
      }

      if (sc && sc.id !== this.lastFittedSceneId && this.viewportWidth() > 100) {
        this.lastFittedSceneId = sc.id;
        queueMicrotask(() => this.fitMapToViewport());
      }
    });

    effect(() => {
      if (this.vttStore.activeTool() !== 'light') {
        this.lightContextMenu.set(null);
        this.editingLightDraft.set(null);
      }
    });

    effect(() => {
      this.vttStore.activeScene();
      this.vttStore.sceneTokens();
      this.vttStore.gridGeometry();
      this.vttStore.previewPlayerVision();
      this.vttStore.isGm();
      this.vttStore.activeTool();
      this.vttStore.selectedLightId();
      this.vttStore.pendingTargetAction();
      this.vttStore.pendingClash();
      this.lightPolygons();
      this.observerVisions();
      this.viewportWidth();
      this.viewportHeight();
      this.panX();
      this.panY();
      this.zoom();
      this.hoveredHex();
      this.dragTokenState();
      this.lightPlacementDraft();
      this.editingLightDraft();
      this.activeRulerPath();
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
    const wb = this.worldBounds();
    if (vw <= 40 || vh <= 40 || wb.width <= 0 || wb.height <= 0) return;

    const pad = 64;
    const scaleX = (vw - pad * 2) / wb.width;
    const scaleY = (vh - pad * 2) / wb.height;
    const nextZoom = Math.max(0.3, Math.min(1.35, Math.min(scaleX, scaleY)));
    const nextPanX = Math.round((vw - wb.width * nextZoom) / 2);
    const nextPanY = Math.round((vh - wb.height * nextZoom) / 2);

    this.zoom.set(Number(nextZoom.toFixed(3)));
    this.panX.set(nextPanX);
    this.panY.set(nextPanY);
  }

  zoomByStep(delta: number): void {
    const vw = this.viewportWidth();
    const vh = this.viewportHeight();
    this.applyZoomAroundScreenPoint(vw / 2, vh / 2, this.zoom() + delta);
  }

  private applyZoomAroundScreenPoint(sx: number, sy: number, rawNextZoom: number): void {
    const prevZoom = this.zoom();
    const nextZoom = Math.max(0.28, Math.min(2.4, rawNextZoom));
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
    const walls = this.vttStore.activeScene()?.walls ?? [];
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
    return best ?? pt;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.viewportRef().nativeElement.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.11 : 0.9;
    this.applyZoomAroundScreenPoint(sx, sy, this.zoom() * factor);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  onViewportPointerDown(event: PointerEvent): void {
    const sc = this.vttStore.activeScene();
    if (!sc) return;

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
      event.button === 2 ||
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

    if (event.button !== 0) return;

    const worldPt = this.screenToWorld(event.clientX, event.clientY);
    const geom = this.vttStore.gridGeometry();
    const hex = clampHexToBounds(
      worldPointToHex(worldPt, geom),
      geom.gridWidth,
      geom.gridHeight
    );

    if (tool === 'ruler') {
      this.rulerStart.set(hex);
      this.rulerCurrent.set(hex);
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
  }

  onTokenPointerDown(event: PointerEvent, item: RenderableVttToken): void {
    event.stopPropagation();

    if (event.altKey && event.button === 0) {
      void this.vttStore.pingWorldPoint(item.center);
      return;
    }

    if (event.button === 1 || event.button === 2 || this.spacePressed()) {
      this.onViewportPointerDown(event);
      return;
    }

    if (event.button !== 0) return;

    const pendingTarget = this.vttStore.pendingTargetAction();
    if (pendingTarget) {
      if (pendingTarget.attackerTokenId !== item.token.id) {
        void this.vttStore.launchClashAgainstTarget(item.token.id);
      }
      return;
    }

    this.vttStore.selectedTokenId.set(item.token.id);
    this.vttStore.selectedLightId.set(null);

    const tool = this.vttStore.activeTool();
    if (tool === 'ruler') {
      const startHex = { col: item.token.x, row: item.token.y };
      this.rulerStart.set(startHex);
      this.rulerCurrent.set(startHex);
      return;
    }

    if (tool === 'select' && item.isControllable) {
      const startHex = { col: item.token.x, row: item.token.y };
      this.dragTokenState.set({
        tokenId: item.token.id,
        startHex,
        currentHex: startHex,
        hasMoved: false,
        shiftOverride: event.shiftKey && this.vttStore.isGm(),
        pathResult: { reachable: true, path: [startHex], steps: 0, feet: 0 },
      });
    }
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
    if (!this.vttStore.isGm()) return;

    this.dragLightState.set(null);
    this.vttStore.selectedLightId.set(light.id);

    const rect = this.viewportRef().nativeElement.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const clampedX = Math.max(12, Math.min(this.viewportWidth() - 196, rawX + 8));
    const clampedY = Math.max(12, Math.min(this.viewportHeight() - 160, rawY + 8));

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
    const geom = this.vttStore.gridGeometry();
    const rawHex = worldPointToHex(worldPt, geom);

    if (insideViewport && isHexInBounds(rawHex, geom.gridWidth, geom.gridHeight)) {
      const prev = this.hoveredHex();
      if (!prev || prev.col !== rawHex.col || prev.row !== rawHex.row) {
        this.hoveredHex.set(rawHex);
      }
    } else if (this.hoveredHex() !== null) {
      this.hoveredHex.set(null);
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

    if (this.rulerStart()) {
      const clamped = clampHexToBounds(rawHex, geom.gridWidth, geom.gridHeight);
      this.rulerCurrent.set(clamped);
      return;
    }

    const dragTok = this.dragTokenState();
    if (dragTok) {
      const clamped = clampHexToBounds(rawHex, geom.gridWidth, geom.gridHeight);
      const shiftOverride = event.shiftKey && this.vttStore.isGm();
      if (
        clamped.col !== dragTok.currentHex.col ||
        clamped.row !== dragTok.currentHex.row ||
        shiftOverride !== dragTok.shiftOverride
      ) {
        const pathRes = shiftOverride
          ? {
              reachable: true,
              path: [dragTok.startHex, clamped],
              steps: getHexDistanceFeet(dragTok.startHex, clamped) / 5,
              feet: getHexDistanceFeet(dragTok.startHex, clamped),
            }
          : findHexPath(dragTok.startHex, clamped, geom, sc.walls);

        this.dragTokenState.set({
          ...dragTok,
          currentHex: clamped,
          hasMoved:
            clamped.col !== dragTok.startHex.col ||
            clamped.row !== dragTok.startHex.row,
          shiftOverride,
          pathResult: pathRes,
        });
      }
    }
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    if (this.isPanning()) {
      this.isPanning.set(false);
      this.panPointerStart = null;
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

    if (this.rulerStart()) {
      this.rulerStart.set(null);
      this.rulerCurrent.set(null);
    }

    const dragTok = this.dragTokenState();
    if (dragTok) {
      this.dragTokenState.set(null);
      if (
        dragTok.hasMoved &&
        (dragTok.pathResult.reachable || dragTok.shiftOverride)
      ) {
        void this.vttStore.moveTokenToHex(
          dragTok.tokenId,
          dragTok.currentHex.col,
          dragTok.currentHex.row,
          dragTok.pathResult.feet,
          dragTok.shiftOverride
        );
      }
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      if (this.lightContextMenu()) {
        this.lightContextMenu.set(null);
      }
      if (this.editingLightDraft()) {
        this.editingLightDraft.set(null);
      }
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
  }

  private renderFrame(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    const sc = this.vttStore.activeScene();
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const vw = Math.max(1, this.viewportWidth());
    const vh = Math.max(1, this.viewportHeight());
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    const targetW = Math.round(vw * dpr);
    const targetH = Math.round(vh * dpr);
    if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
      canvasEl.width = targetW;
      canvasEl.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#060B0A';
    ctx.fillRect(0, 0, vw, vh);

    if (!sc) return;

    const geom = this.vttStore.gridGeometry();
    const wb = this.worldBounds();
    const z = this.zoom();
    const px = this.panX();
    const py = this.panY();
    const R = getHexRadius(geom.gridSizePx);

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(z, z);

    const img = this.mapImage();
    if (img) {
      ctx.fillStyle = '#0B1412';
      ctx.fillRect(0, 0, wb.width, wb.height);
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    } else {
      const floorGrad = ctx.createLinearGradient(0, 0, wb.width, wb.height);
      floorGrad.addColorStop(0, '#0F1C1A');
      floorGrad.addColorStop(0.5, '#132421');
      floorGrad.addColorStop(1, '#0C1715');
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, 0, wb.width, wb.height);

      ctx.strokeStyle = 'rgba(56, 178, 154, 0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, Math.max(0, wb.width - 2), Math.max(0, wb.height - 2));
    }

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
      const brightStop = Math.max(0.05, Math.min(0.92, lp.brightRadiusPx / lp.dimRadiusPx));
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

    if (sc.grid_opacity > 0.01) {
      ctx.beginPath();
      for (let col = 0; col < geom.gridWidth; col++) {
        for (let row = 0; row < geom.gridHeight; row++) {
          const c = hexToWorldCenter({ col, row }, geom);
          const pts = getHexPolygonPoints(c, R);
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
        }
      }
      ctx.strokeStyle = `rgba(215, 238, 234, ${Math.min(0.9, sc.grid_opacity)})`;
      ctx.lineWidth = Math.max(0.8, 1.15 / z);
      ctx.stroke();
    }

    const pendingTarget = this.vttStore.pendingTargetAction();
    if (pendingTarget) {
      const attacker = this.vttStore
        .sceneTokens()
        .find((t) => t.id === pendingTarget.attackerTokenId);
      if (attacker) {
        ctx.save();
        for (let col = 0; col < geom.gridWidth; col++) {
          for (let row = 0; row < geom.gridHeight; row++) {
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
        ctx.restore();
      }
    }

    const hov = this.hoveredHex();
    if (hov) {
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

    if (sc.fog_enabled) {
      this.renderFogLayer(ctx, vw, vh, dpr, px, py, z, wb, R);
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(z, z);

    this.renderWallsAndDraft(ctx, z);
    this.renderLightGuidesAndDraft(ctx, z);
    this.renderPathsAndRulers(ctx, z, R);
    this.renderPendingClashVector(ctx, z);
    this.renderPings(ctx, z);

    ctx.restore();
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
    const brightPx = feetToWorldPixels(target.bright_feet ?? 0, geom.gridSizePx);
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
    const baseDarkness = playerMode
      ? 0.985
      : Math.max(0.28, Math.min(0.62, sc.darkness_level * 0.52));

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
    } else if (sc.explored_fog?.cells?.length) {
      fctx.beginPath();
      const expandedR = hexRadius * 1.07;
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

      if (!sc.global_illumination && lights.length > 0 && obs.unboundedLosPolygon.length >= 3) {
        fctx.save();
        fctx.beginPath();
        fctx.moveTo(obs.unboundedLosPolygon[0].x, obs.unboundedLosPolygon[0].y);
        for (let i = 1; i < obs.unboundedLosPolygon.length; i++) {
          fctx.lineTo(obs.unboundedLosPolygon[i].x, obs.unboundedLosPolygon[i].y);
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

    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.drawImage(fogCanvas, 0, 0);
    mainCtx.restore();
  }

  private renderWallsAndDraft(ctx: CanvasRenderingContext2D, z: number): void {
    const sc = this.vttStore.activeScene();
    if (!sc) return;

    const showAllWalls = this.vttStore.isGm() && !this.vttStore.previewPlayerVision();
    const visibleDoorIds = new Set(this.visibleDoorHandles().map((d) => d.wall.id));

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
    const geom = this.vttStore.gridGeometry();
    const dragTok = this.dragTokenState();

    if (dragTok && dragTok.hasMoved) {
      const tok = this.vttStore.sceneTokens().find((t) => t.id === dragTok.tokenId);
      const speedFeet = tok?.move_feet ?? 20;
      const pathRes = dragTok.pathResult;

      let stroke = '#38B29A';
      if (!pathRes.reachable && !dragTok.shiftOverride) {
        stroke = '#F43F5E';
      } else if (pathRes.feet > speedFeet * 2) {
        stroke = '#FB7185';
      } else if (pathRes.feet > speedFeet) {
        stroke = '#F59E0B';
      }

      this.strokeHexPath(ctx, pathRes.path, geom, stroke, z, hexRadius);

      const endPt = hexToWorldCenter(dragTok.currentHex, geom);
      const label =
        !pathRes.reachable && !dragTok.shiftOverride
          ? `Blocked (${pathRes.feet} ft)`
          : pathRes.feet <= speedFeet
            ? `${pathRes.feet} ft · 1 Move`
            : `${pathRes.feet} ft · ${Math.ceil(pathRes.feet / Math.max(5, speedFeet))} Moves`;
      this.drawWorldPill(ctx, endPt.x, endPt.y - hexRadius - 14 / z, label, stroke, z);
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
      this.drawWorldPill(ctx, endPt.x, endPt.y - hexRadius - 12 / z, label, stroke, z);
    }
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
      ctx.arc(pt.x, pt.y, i === coords.length - 1 ? 5.5 / z : 3.2 / z, 0, Math.PI * 2);
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

  private renderPendingClashVector(ctx: CanvasRenderingContext2D, z: number): void {
    const clash = this.vttStore.pendingClash();
    if (!clash) return;
    const toks = this.vttStore.sceneTokens();
    const att = toks.find((t) => t.id === clash.attackerTokenId);
    const def = toks.find((t) => t.id === clash.defenderTokenId);
    if (!att || !def) return;

    const geom = this.vttStore.gridGeometry();
    const a = hexToWorldCenter({ col: att.x, row: att.y }, geom);
    const b = hexToWorldCenter({ col: def.x, row: def.y }, geom);

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
