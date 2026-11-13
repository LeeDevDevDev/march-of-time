import {
  HexCoord,
  VttGridMode,
  VttLightSource,
  VttPoint,
  VttTokenModel,
  VttWallSegment,
} from '../models/vtt.model';
import {
  HexGridGeometry,
  doesWallBlockVision,
  feetToWorldPixels,
  getTokenWorldCenter,
  hexKey,
  hexToWorldCenter,
  segmentsIntersect,
} from './hex-grid.engine';

export interface ComputedLightPolygon {
  id: string;
  origin: VttPoint;
  brightRadiusPx: number;
  dimRadiusPx: number;
  color: string;
  polygon: VttPoint[];
}

export interface ComputedObserverVision {
  tokenId: string;
  origin: VttPoint;
  personalVisionPx: number;
  personalPolygon: VttPoint[];
  unboundedLosPolygon: VttPoint[];
}

interface SimpleSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function hasLineOfSight(
  from: VttPoint,
  to: VttPoint,
  walls: VttWallSegment[]
): boolean {
  for (const w of walls) {
    if (!doesWallBlockVision(w)) continue;
    if (
      segmentsIntersect(from, to, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })
    ) {
      return false;
    }
  }
  return true;
}

export function computeVisibilityPolygon(
  origin: VttPoint,
  maxRadiusPx: number,
  walls: VttWallSegment[],
  circleSteps = 48
): VttPoint[] {
  if (maxRadiusPx <= 1) return [];

  const pad = 12;
  const minX = origin.x - maxRadiusPx - pad;
  const maxX = origin.x + maxRadiusPx + pad;
  const minY = origin.y - maxRadiusPx - pad;
  const maxY = origin.y + maxRadiusPx + pad;

  const segments: SimpleSegment[] = [
    { x1: minX, y1: minY, x2: maxX, y2: minY },
    { x1: maxX, y1: minY, x2: maxX, y2: maxY },
    { x1: maxX, y1: maxY, x2: minX, y2: maxY },
    { x1: minX, y1: maxY, x2: minX, y2: minY },
  ];

  for (const w of walls) {
    if (!doesWallBlockVision(w)) continue;
    const segMinX = Math.min(w.x1, w.x2);
    const segMaxX = Math.max(w.x1, w.x2);
    const segMinY = Math.min(w.y1, w.y2);
    const segMaxY = Math.max(w.y1, w.y2);
    if (segMaxX < minX || segMinX > maxX || segMaxY < minY || segMinY > maxY) {
      continue;
    }
    segments.push({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 });
  }

  const rawAngles: number[] = [];
  const eps = 0.00018;

  for (const seg of segments) {
    const a1 = Math.atan2(seg.y1 - origin.y, seg.x1 - origin.x);
    const a2 = Math.atan2(seg.y2 - origin.y, seg.x2 - origin.x);
    rawAngles.push(a1 - eps, a1, a1 + eps, a2 - eps, a2, a2 + eps);
  }

  for (let i = 0; i < circleSteps; i++) {
    const a = -Math.PI + (2 * Math.PI * i) / circleSteps;
    rawAngles.push(a);
  }

  rawAngles.sort((a, b) => a - b);

  const angles: number[] = [];
  for (const a of rawAngles) {
    if (angles.length === 0 || Math.abs(a - angles[angles.length - 1]) > 1e-6) {
      angles.push(a);
    }
  }

  const polygon: VttPoint[] = [];

  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let bestT = maxRadiusPx;

    for (const seg of segments) {
      const sx = seg.x2 - seg.x1;
      const sy = seg.y2 - seg.y1;
      const denom = dx * sy - dy * sx;
      if (Math.abs(denom) < 1e-9) continue;

      const qpx = seg.x1 - origin.x;
      const qpy = seg.y1 - origin.y;
      const t = (qpx * sy - qpy * sx) / denom;
      if (t <= 0 || t >= bestT) continue;

      const u = (qpx * dy - qpy * dx) / denom;
      if (u >= -1e-5 && u <= 1.00001) {
        bestT = t;
      }
    }

    polygon.push({
      x: origin.x + dx * bestT,
      y: origin.y + dy * bestT,
    });
  }

  return polygon;
}

export function isPointInPolygon(pt: VttPoint, polygon: VttPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function buildLightPolygons(
  mapLights: VttLightSource[],
  tokens: VttTokenModel[],
  walls: VttWallSegment[],
  geom: HexGridGeometry,
  gridMode: VttGridMode = 'square'
): ComputedLightPolygon[] {
  const results: ComputedLightPolygon[] = [];

  for (const light of mapLights) {
    if (light.enabled === false) continue;
    const dimFeet = Math.max(light.dim_feet ?? 0, light.bright_feet ?? 0);
    if (dimFeet <= 0) continue;
    const brightPx = feetToWorldPixels(light.bright_feet ?? 0, geom.gridSizePx);
    const dimPx = feetToWorldPixels(dimFeet, geom.gridSizePx);
    const origin = { x: light.x, y: light.y };
    results.push({
      id: light.id,
      origin,
      brightRadiusPx: brightPx,
      dimRadiusPx: dimPx,
      color: light.color || '#FF9B42',
      polygon: computeVisibilityPolygon(origin, dimPx, walls),
    });
  }

  for (const tok of tokens) {
    if (tok.is_hidden) continue;
    const dimFeet = Math.max(tok.light_dim_feet ?? 0, tok.light_bright_feet ?? 0);
    if (dimFeet <= 0) continue;
    const origin = getTokenWorldCenter(tok, geom, gridMode);
    const brightPx = feetToWorldPixels(tok.light_bright_feet ?? 0, geom.gridSizePx);
    const dimPx = feetToWorldPixels(dimFeet, geom.gridSizePx);
    results.push({
      id: `tok-light-${tok.id}`,
      origin,
      brightRadiusPx: brightPx,
      dimRadiusPx: dimPx,
      color: tok.light_color || '#FF9B42',
      polygon: computeVisibilityPolygon(origin, dimPx, walls),
    });
  }

  return results;
}

export function buildObserverVisions(
  observers: VttTokenModel[],
  walls: VttWallSegment[],
  geom: HexGridGeometry,
  globalIllumination: boolean,
  maxWorldDiagPx: number,
  gridMode: VttGridMode = 'square'
): ComputedObserverVision[] {
  return observers.map((tok) => {
    const origin = getTokenWorldCenter(tok, geom, gridMode);
    const visionFeet = Math.max(
      5,
      tok.vision_feet ?? 60,
      tok.light_dim_feet ?? 0,
      tok.light_bright_feet ?? 0
    );
    const personalPx = globalIllumination
      ? maxWorldDiagPx
      : feetToWorldPixels(visionFeet, geom.gridSizePx);
    const unboundedLosPolygon = computeVisibilityPolygon(
      origin,
      maxWorldDiagPx,
      walls,
      64
    );
    const personalPolygon = globalIllumination
      ? unboundedLosPolygon
      : computeVisibilityPolygon(origin, personalPx, walls, 48);

    return {
      tokenId: tok.id,
      origin,
      personalVisionPx: personalPx,
      personalPolygon,
      unboundedLosPolygon,
    };
  });
}

export function isWorldPointVisibleToObservers(
  target: VttPoint,
  observers: ComputedObserverVision[],
  lights: ComputedLightPolygon[],
  walls: VttWallSegment[],
  globalIllumination: boolean
): boolean {
  if (observers.length === 0) return false;

  for (const obs of observers) {
    if (globalIllumination) {
      if (hasLineOfSight(obs.origin, target, walls)) {
        return true;
      }
      continue;
    }

    const dx = target.x - obs.origin.x;
    const dy = target.y - obs.origin.y;
    const inPersonalRange =
      dx * dx + dy * dy <= obs.personalVisionPx * obs.personalVisionPx;

    let inAnyLightRange = false;
    if (!inPersonalRange) {
      for (const light of lights) {
        const ldx = target.x - light.origin.x;
        const ldy = target.y - light.origin.y;
        if (ldx * ldx + ldy * ldy <= light.dimRadiusPx * light.dimRadiusPx) {
          inAnyLightRange = true;
          break;
        }
      }
    }

    if (!inPersonalRange && !inAnyLightRange) {
      continue;
    }

    if (!hasLineOfSight(obs.origin, target, walls)) {
      continue;
    }

    if (inPersonalRange) {
      return true;
    }

    for (const light of lights) {
      const ldx = target.x - light.origin.x;
      const ldy = target.y - light.origin.y;
      if (ldx * ldx + ldy * ldy <= light.dimRadiusPx * light.dimRadiusPx) {
        if (hasLineOfSight(light.origin, target, walls)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function collectNewlyExploredHexKeys(
  existingKeys: Set<string>,
  observers: ComputedObserverVision[],
  lights: ComputedLightPolygon[],
  walls: VttWallSegment[],
  geom: HexGridGeometry,
  globalIllumination: boolean
): string[] {
  if (observers.length === 0) return [];
  const added: string[] = [];

  for (let col = 0; col < geom.gridWidth; col++) {
    for (let row = 0; row < geom.gridHeight; row++) {
      const key = hexKey(col, row);
      if (existingKeys.has(key)) continue;
      const coord: HexCoord = { col, row };
      const center = hexToWorldCenter(coord, geom);
      if (
        isWorldPointVisibleToObservers(
          center,
          observers,
          lights,
          walls,
          globalIllumination
        )
      ) {
        added.push(key);
      }
    }
  }

  return added;
}

export function findNearestDoorOnCanvas(
  pt: VttPoint,
  walls: VttWallSegment[],
  maxDistPx = 18
): VttWallSegment | null {
  let best: VttWallSegment | null = null;
  let bestDist = maxDistPx;

  for (const w of walls) {
    if (w.kind !== 'door') continue;
    const mx = (w.x1 + w.x2) / 2;
    const my = (w.y1 + w.y2) / 2;
    const d = Math.hypot(pt.x - mx, pt.y - my);
    if (d <= bestDist) {
      bestDist = d;
      best = w;
    }
  }

  return best;
}

export function distancePointToSegment(
  pt: VttPoint,
  a: VttPoint,
  b: VttPoint
): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-6) return Math.hypot(pt.x - a.x, pt.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((pt.x - a.x) * vx + (pt.y - a.y) * vy) / lenSq)
  );
  const projX = a.x + t * vx;
  const projY = a.y + t * vy;
  return Math.hypot(pt.x - projX, pt.y - projY);
}
