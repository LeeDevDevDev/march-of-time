import {
  AxialCoord,
  CubeCoord,
  HexCoord,
  VttPoint,
  VttWallSegment,
} from '../models/vtt.model';

export const HEX_SQRT3 = Math.sqrt(3);

export interface HexGridGeometry {
  gridWidth: number;
  gridHeight: number;
  gridSizePx: number;
  offsetX: number;
  offsetY: number;
}

const CUBE_DIRECTIONS: CubeCoord[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];

export function hexKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseHexKey(key: string): HexCoord | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const col = Number(parts[0]);
  const row = Number(parts[1]);
  if (Number.isNaN(col) || Number.isNaN(row)) return null;
  return { col, row };
}

export function offsetToCube(col: number, row: number): CubeCoord {
  const parity = col & 1;
  const q = col;
  const r = row - (col - parity) / 2;
  const s = -q - r;
  return { q, r, s };
}

export function offsetToAxial(col: number, row: number): AxialCoord {
  const { q, r } = offsetToCube(col, row);
  return { q, r };
}

export function cubeToOffset(q: number, r: number): HexCoord {
  const parity = q & 1;
  const col = q;
  const row = r + (q - parity) / 2;
  return { col, row };
}

export function cubeRound(qf: number, rf: number, sf: number): CubeCoord {
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);

  const qDiff = Math.abs(q - qf);
  const rDiff = Math.abs(r - rf);
  const sDiff = Math.abs(s - sf);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r, s: s === 0 ? 0 : s };
}

export function getHexRadius(gridSizePx: number): number {
  return Math.max(12, gridSizePx / 2);
}

export function getHexStepPixels(gridSizePx: number): number {
  return HEX_SQRT3 * getHexRadius(gridSizePx);
}

export function feetToWorldPixels(feet: number, gridSizePx: number): number {
  if (feet <= 0) return 0;
  return (feet / 5) * getHexStepPixels(gridSizePx);
}

export function worldPixelsToFeet(px: number, gridSizePx: number): number {
  const step = getHexStepPixels(gridSizePx);
  if (step <= 0) return 0;
  return Math.round((px / step) * 5);
}

export function hexToWorldCenter(
  coord: HexCoord,
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>
): VttPoint {
  const R = getHexRadius(geom.gridSizePx);
  const parity = coord.col & 1;
  const x = geom.offsetX + R + coord.col * 1.5 * R;
  const y =
    geom.offsetY +
    (HEX_SQRT3 / 2) * R +
    (coord.row + 0.5 * parity) * HEX_SQRT3 * R;
  return { x, y };
}

export function worldPointToHex(
  pt: VttPoint,
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>
): HexCoord {
  const R = getHexRadius(geom.gridSizePx);
  const originX = geom.offsetX + R;
  const originY = geom.offsetY + (HEX_SQRT3 / 2) * R;
  const lx = pt.x - originX;
  const ly = pt.y - originY;

  const qf = ((2 / 3) * lx) / R;
  const rf = ((-1 / 3) * lx + (HEX_SQRT3 / 3) * ly) / R;
  const rounded = cubeRound(qf, rf, -qf - rf);
  return cubeToOffset(rounded.q, rounded.r);
}

export function clampHexToBounds(
  coord: HexCoord,
  gridWidth: number,
  gridHeight: number
): HexCoord {
  return {
    col: Math.max(0, Math.min(Math.max(1, gridWidth) - 1, coord.col)),
    row: Math.max(0, Math.min(Math.max(1, gridHeight) - 1, coord.row)),
  };
}

export function isHexInBounds(
  coord: HexCoord,
  gridWidth: number,
  gridHeight: number
): boolean {
  return (
    coord.col >= 0 &&
    coord.col < gridWidth &&
    coord.row >= 0 &&
    coord.row < gridHeight
  );
}

export function getHexPolygonPoints(center: VttPoint, radius: number): VttPoint[] {
  const pts: VttPoint[] = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (Math.PI / 180) * (60 * i);
    pts.push({
      x: center.x + radius * Math.cos(angleRad),
      y: center.y + radius * Math.sin(angleRad),
    });
  }
  return pts;
}

export function getHexWorldBounds(geom: HexGridGeometry): {
  width: number;
  height: number;
} {
  const R = getHexRadius(geom.gridSizePx);
  const cols = Math.max(1, geom.gridWidth);
  const rows = Math.max(1, geom.gridHeight);
  const width = geom.offsetX * 2 + R * (1.5 * (cols - 1) + 2);
  const height = geom.offsetY * 2 + HEX_SQRT3 * R * (rows + 0.5);
  return { width, height };
}

export function getHexDistanceSpaces(a: HexCoord, b: HexCoord): number {
  const ac = offsetToCube(a.col, a.row);
  const bc = offsetToCube(b.col, b.row);
  return (
    (Math.abs(ac.q - bc.q) + Math.abs(ac.r - bc.r) + Math.abs(ac.s - bc.s)) / 2
  );
}

export function getHexDistanceFeet(a: HexCoord, b: HexCoord): number {
  return getHexDistanceSpaces(a, b) * 5;
}

export function getHexNeighbors(
  coord: HexCoord,
  gridWidth?: number,
  gridHeight?: number
): HexCoord[] {
  const c = offsetToCube(coord.col, coord.row);
  const neighbors: HexCoord[] = [];
  for (const dir of CUBE_DIRECTIONS) {
    const next = cubeToOffset(c.q + dir.q, c.r + dir.r);
    if (
      gridWidth !== undefined &&
      gridHeight !== undefined &&
      !isHexInBounds(next, gridWidth, gridHeight)
    ) {
      continue;
    }
    neighbors.push(next);
  }
  return neighbors;
}

export function doesWallBlockMovement(wall: VttWallSegment): boolean {
  if (wall.kind === 'door' && wall.open) return false;
  return true;
}

export function doesWallBlockVision(wall: VttWallSegment): boolean {
  if (wall.kind === 'window') return false;
  if (wall.kind === 'door' && wall.open) return false;
  return true;
}

function cross2d(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

export function segmentsIntersect(
  a1: VttPoint,
  a2: VttPoint,
  b1: VttPoint,
  b2: VttPoint,
  inclusive = false
): boolean {
  const rX = a2.x - a1.x;
  const rY = a2.y - a1.y;
  const sX = b2.x - b1.x;
  const sY = b2.y - b1.y;

  const denom = cross2d(rX, rY, sX, sY);
  const qpX = b1.x - a1.x;
  const qpY = b1.y - a1.y;

  if (Math.abs(denom) < 1e-8) {
    return false;
  }

  const t = cross2d(qpX, qpY, sX, sY) / denom;
  const u = cross2d(qpX, qpY, rX, rY) / denom;

  if (inclusive) {
    return t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6;
  }
  return t >= 0.0001 && t <= 0.9999 && u >= 0.0001 && u <= 0.9999;
}

export function isHexStepBlockedByWalls(
  fromHex: HexCoord,
  toHex: HexCoord,
  walls: VttWallSegment[],
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>
): boolean {
  if (walls.length === 0) return false;
  const p1 = hexToWorldCenter(fromHex, geom);
  const p2 = hexToWorldCenter(toHex, geom);

  for (const w of walls) {
    if (!doesWallBlockMovement(w)) continue;
    if (
      segmentsIntersect(
        p1,
        p2,
        { x: w.x1, y: w.y1 },
        { x: w.x2, y: w.y2 },
        true
      )
    ) {
      return true;
    }
  }
  return false;
}

export interface HexPathResult {
  reachable: boolean;
  path: HexCoord[];
  steps: number;
  feet: number;
}

export function findHexPath(
  start: HexCoord,
  goal: HexCoord,
  geom: HexGridGeometry,
  walls: VttWallSegment[] = []
): HexPathResult {
  if (start.col === goal.col && start.row === goal.row) {
    return { reachable: true, path: [start], steps: 0, feet: 0 };
  }
  if (!isHexInBounds(goal, geom.gridWidth, geom.gridHeight)) {
    return { reachable: false, path: [start], steps: 0, feet: 0 };
  }

  const startKey = hexKey(start.col, start.row);
  const goalKey = hexKey(goal.col, goal.row);

  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, HexCoord>();
  const openList: { coord: HexCoord; key: string; f: number }[] = [
    {
      coord: start,
      key: startKey,
      f: getHexDistanceSpaces(start, goal),
    },
  ];
  const closed = new Set<string>();

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    if (current.key === goalKey) {
      const path: HexCoord[] = [goal];
      let cursor = goal;
      let cursorKey = goalKey;
      while (cameFrom.has(cursorKey)) {
        cursor = cameFrom.get(cursorKey)!;
        cursorKey = hexKey(cursor.col, cursor.row);
        path.unshift(cursor);
      }
      const steps = path.length - 1;
      return {
        reachable: true,
        path,
        steps,
        feet: steps * 5,
      };
    }

    closed.add(current.key);
    const currentG = gScore.get(current.key) ?? 0;

    for (const next of getHexNeighbors(
      current.coord,
      geom.gridWidth,
      geom.gridHeight
    )) {
      const nextKey = hexKey(next.col, next.row);
      if (closed.has(nextKey)) continue;
      if (isHexStepBlockedByWalls(current.coord, next, walls, geom)) continue;

      const tentativeG = currentG + 1;
      const prevBest = gScore.get(nextKey);
      if (prevBest === undefined || tentativeG < prevBest) {
        cameFrom.set(nextKey, current.coord);
        gScore.set(nextKey, tentativeG);
        const f = tentativeG + getHexDistanceSpaces(next, goal);
        const existing = openList.find((item) => item.key === nextKey);
        if (existing) {
          existing.f = f;
        } else {
          openList.push({ coord: next, key: nextKey, f });
        }
      }
    }
  }

  const fallbackSteps = getHexDistanceSpaces(start, goal);
  return {
    reachable: false,
    path: [start, goal],
    steps: fallbackSteps,
    feet: fallbackSteps * 5,
  };
}
