import {
  AxialCoord,
  CubeCoord,
  DEFAULT_VTT_GRID_SIZE_PX,
  DEFAULT_VTT_SCENE_HEIGHT_PX,
  DEFAULT_VTT_SCENE_PADDING,
  DEFAULT_VTT_SCENE_WIDTH_PX,
  HexCoord,
  VttGridMode,
  VttNpcStats,
  VttPoint,
  VttTokenModel,
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

export interface SceneCanvasLayoutInput {
  sceneWidthPx?: number | null;
  sceneHeightPx?: number | null;
  naturalImageWidth?: number | null;
  naturalImageHeight?: number | null;
  gridSizePx: number;
  gridMode?: VttGridMode | null;
  padding?: number | null;
  offsetX?: number;
  offsetY?: number;
}

export interface SceneCanvasLayout {
  innerWidth: number;
  innerHeight: number;
  padding: number;
  padX: number;
  padY: number;
  sceneX: number;
  sceneY: number;
  totalWidth: number;
  totalHeight: number;
  gridSizePx: number;
  gridCols: number;
  gridRows: number;
  innerCols: number;
  innerRows: number;
  innerStartCol: number;
  innerEndCol: number;
  innerStartRow: number;
  innerEndRow: number;
  mapGridLeft: number;
  mapGridRight: number;
  mapGridTop: number;
  mapGridBottom: number;
  geometry: HexGridGeometry;
}

const SQUARE_DIRECTIONS: HexCoord[] = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
  { col: 1, row: 1 },
  { col: 1, row: -1 },
  { col: -1, row: 1 },
  { col: -1, row: -1 },
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
  const q = col === 0 ? 0 : col;
  const r = row === 0 ? 0 : row;
  const s = -q - r;
  return { q, r, s: s === 0 ? 0 : s };
}

export function offsetToAxial(col: number, row: number): AxialCoord {
  return {
    q: col === 0 ? 0 : col,
    r: row === 0 ? 0 : row,
  };
}

export function cubeToOffset(q: number, r: number): HexCoord {
  return {
    col: q === 0 ? 0 : q,
    row: r === 0 ? 0 : r,
  };
}

export function cubeRound(qf: number, rf: number, sf: number): CubeCoord {
  const q = Math.round(qf);
  const r = Math.round(rf);
  const s = Number.isFinite(sf) ? Math.round(sf) : -q - r;
  return {
    q: q === 0 ? 0 : q,
    r: r === 0 ? 0 : r,
    s: s === 0 ? 0 : s,
  };
}

export function getTileSizePx(gridSizePx: number): number {
  return Math.max(20, Number(gridSizePx) || DEFAULT_VTT_GRID_SIZE_PX);
}

export function getHexRadius(gridSizePx: number): number {
  return getTileSizePx(gridSizePx) / 2;
}

export function getHexStepPixels(gridSizePx: number): number {
  return getTileSizePx(gridSizePx);
}

export function computeSceneCanvasLayout(
  input: SceneCanvasLayoutInput
): SceneCanvasLayout {
  const rawInnerWidth =
    input.sceneWidthPx && input.sceneWidthPx > 0
      ? Math.max(200, Math.round(input.sceneWidthPx))
      : input.naturalImageWidth && input.naturalImageWidth > 0
        ? Math.max(200, Math.round(input.naturalImageWidth))
        : DEFAULT_VTT_SCENE_WIDTH_PX;

  const rawInnerHeight =
    input.sceneHeightPx && input.sceneHeightPx > 0
      ? Math.max(200, Math.round(input.sceneHeightPx))
      : input.naturalImageHeight && input.naturalImageHeight > 0
        ? Math.max(200, Math.round(input.naturalImageHeight))
        : DEFAULT_VTT_SCENE_HEIGHT_PX;

  const safeGridSizePx = Math.max(
    20,
    Math.min(
      400,
      rawInnerWidth,
      rawInnerHeight,
      Math.round(Number(input.gridSizePx) || DEFAULT_VTT_GRID_SIZE_PX)
    )
  );

  const isGridless = input.gridMode === 'gridless';
  const snappedMapCols = Math.max(1, Math.round(rawInnerWidth / safeGridSizePx));
  const snappedMapRows = Math.max(1, Math.round(rawInnerHeight / safeGridSizePx));
  const innerWidth = isGridless
    ? rawInnerWidth
    : snappedMapCols * safeGridSizePx;
  const innerHeight = isGridless
    ? rawInnerHeight
    : snappedMapRows * safeGridSizePx;

  const rawPadding =
    input.padding !== null &&
    input.padding !== undefined &&
    Number.isFinite(Number(input.padding))
      ? Number(input.padding)
      : DEFAULT_VTT_SCENE_PADDING;
  const padding = Math.max(0, Math.min(1, Number(rawPadding.toFixed(2))));

  const rawOffX = Math.round(Number(input.offsetX) || 0);
  const rawOffY = Math.round(Number(input.offsetY) || 0);
  let innerOffX = ((rawOffX % safeGridSizePx) + safeGridSizePx) % safeGridSizePx;
  let innerOffY = ((rawOffY % safeGridSizePx) + safeGridSizePx) % safeGridSizePx;
  if (innerWidth - innerOffX < safeGridSizePx) {
    innerOffX = Math.max(0, innerWidth - safeGridSizePx);
  }
  if (innerHeight - innerOffY < safeGridSizePx) {
    innerOffY = Math.max(0, innerHeight - safeGridSizePx);
  }

  const padCols =
    padding > 0 ? Math.ceil((innerWidth * padding) / safeGridSizePx) : 0;
  const padRows =
    padding > 0 ? Math.ceil((innerHeight * padding) / safeGridSizePx) : 0;
  const padX = padCols * safeGridSizePx;
  const padY = padRows * safeGridSizePx;

  const sceneX = Math.round(padX);
  const sceneY = Math.round(padY);
  const totalWidth = Math.round(innerWidth + sceneX * 2);
  const totalHeight = Math.round(innerHeight + sceneY * 2);

  const innerCols = Math.max(
    1,
    Math.floor((innerWidth - innerOffX) / safeGridSizePx)
  );
  const innerRows = Math.max(
    1,
    Math.floor((innerHeight - innerOffY) / safeGridSizePx)
  );

  const gridCols = Math.max(
    innerCols,
    Math.floor((totalWidth - innerOffX) / safeGridSizePx)
  );
  const gridRows = Math.max(
    innerRows,
    Math.floor((totalHeight - innerOffY) / safeGridSizePx)
  );

  const innerStartCol = padCols;
  const innerEndCol = padCols + innerCols - 1;
  const innerStartRow = padRows;
  const innerEndRow = padRows + innerRows - 1;

  const mapGridLeft = innerOffX + innerStartCol * safeGridSizePx;
  const mapGridRight = innerOffX + (innerEndCol + 1) * safeGridSizePx;
  const mapGridTop = innerOffY + innerStartRow * safeGridSizePx;
  const mapGridBottom = innerOffY + (innerEndRow + 1) * safeGridSizePx;

  return {
    innerWidth,
    innerHeight,
    padding,
    padX,
    padY,
    sceneX,
    sceneY,
    totalWidth,
    totalHeight,
    gridSizePx: safeGridSizePx,
    gridCols,
    gridRows,
    innerCols,
    innerRows,
    innerStartCol,
    innerEndCol,
    innerStartRow,
    innerEndRow,
    mapGridLeft,
    mapGridRight,
    mapGridTop,
    mapGridBottom,
    geometry: {
      gridWidth: gridCols,
      gridHeight: gridRows,
      gridSizePx: safeGridSizePx,
      offsetX: innerOffX,
      offsetY: innerOffY,
    },
  };
}

export function isHexStraddlingMapBorder(
  coord: HexCoord,
  layout: SceneCanvasLayout
): boolean {
  const step = getTileSizePx(layout.geometry.gridSizePx);
  const x1 = layout.geometry.offsetX + coord.col * step;
  const x2 = x1 + step;
  const y1 = layout.geometry.offsetY + coord.row * step;
  const y2 = y1 + step;

  if (
    x1 < -0.01 ||
    x2 > layout.totalWidth + 0.01 ||
    y1 < -0.01 ||
    y2 > layout.totalHeight + 0.01
  ) {
    return true;
  }

  const mapLeft = layout.sceneX;
  const mapRight = layout.sceneX + layout.innerWidth;
  const mapTop = layout.sceneY;
  const mapBottom = layout.sceneY + layout.innerHeight;

  const overlapsMapInterior =
    x1 < mapRight - 0.01 &&
    x2 > mapLeft + 0.01 &&
    y1 < mapBottom - 0.01 &&
    y2 > mapTop + 0.01;
  if (!overlapsMapInterior) {
    return false;
  }

  const fullyInsideMap =
    x1 >= mapLeft - 0.01 &&
    x2 <= mapRight + 0.01 &&
    y1 >= mapTop - 0.01 &&
    y2 <= mapBottom + 0.01;
  return !fullyInsideMap;
}

export function clampHexToSceneLayout(
  coord: HexCoord,
  layout: SceneCanvasLayout,
  worldHint?: VttPoint | null
): HexCoord {
  let col = Math.max(0, Math.min(Math.max(1, layout.gridCols) - 1, coord.col));
  let row = Math.max(0, Math.min(Math.max(1, layout.gridRows) - 1, coord.row));
  if (!isHexStraddlingMapBorder({ col, row }, layout)) {
    return { col, row };
  }

  const step = getTileSizePx(layout.geometry.gridSizePx);
  const hint =
    worldHint ?? hexToWorldCenter({ col, row }, layout.geometry);
  const mapLeft = layout.sceneX;
  const mapRight = layout.sceneX + layout.innerWidth;
  const mapTop = layout.sceneY;
  const mapBottom = layout.sceneY + layout.innerHeight;

  const colLeft = layout.geometry.offsetX + col * step;
  const colRight = colLeft + step;
  if (colLeft < mapLeft - 0.01 && colRight > mapLeft + 0.01) {
    if (hint.x < mapLeft && col - 1 >= 0) {
      col = col - 1;
    } else {
      col = layout.innerStartCol;
    }
  } else if (colLeft < mapRight - 0.01 && colRight > mapRight + 0.01) {
    if (hint.x > mapRight && col + 1 < layout.gridCols) {
      col = col + 1;
    } else {
      col = layout.innerEndCol;
    }
  }

  const rowTop = layout.geometry.offsetY + row * step;
  const rowBottom = rowTop + step;
  if (rowTop < mapTop - 0.01 && rowBottom > mapTop + 0.01) {
    if (hint.y < mapTop && row - 1 >= 0) {
      row = row - 1;
    } else {
      row = layout.innerStartRow;
    }
  } else if (rowTop < mapBottom - 0.01 && rowBottom > mapBottom + 0.01) {
    if (hint.y > mapBottom && row + 1 < layout.gridRows) {
      row = row + 1;
    } else {
      row = layout.innerEndRow;
    }
  }

  return { col, row };
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
  const step = getTileSizePx(geom.gridSizePx);
  return {
    x: geom.offsetX + (coord.col + 0.5) * step,
    y: geom.offsetY + (coord.row + 0.5) * step,
  };
}

export function worldPointToHex(
  pt: VttPoint,
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>
): HexCoord {
  const step = getTileSizePx(geom.gridSizePx);
  const col = Math.floor((pt.x - geom.offsetX) / step);
  const row = Math.floor((pt.y - geom.offsetY) / step);
  return {
    col: col === 0 ? 0 : col,
    row: row === 0 ? 0 : row,
  };
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

export function getHexPolygonPoints(
  center: VttPoint,
  radius: number
): VttPoint[] {
  return [
    { x: center.x - radius, y: center.y - radius },
    { x: center.x + radius, y: center.y - radius },
    { x: center.x + radius, y: center.y + radius },
    { x: center.x - radius, y: center.y + radius },
  ];
}

export function getHexWorldBounds(geom: HexGridGeometry): {
  width: number;
  height: number;
} {
  const step = getTileSizePx(geom.gridSizePx);
  const cols = Math.max(1, geom.gridWidth);
  const rows = Math.max(1, geom.gridHeight);
  const width = Math.max(0, geom.offsetX) + cols * step;
  const height = Math.max(0, geom.offsetY) + rows * step;
  return { width, height };
}

export function getHexDistanceSpaces(a: HexCoord, b: HexCoord): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function getHexDistanceFeet(a: HexCoord, b: HexCoord): number {
  return getHexDistanceSpaces(a, b) * 5;
}

export type TokenPositionLike = Pick<
  VttTokenModel,
  'x' | 'y' | 'world_x' | 'world_y'
> & {
  npc_stats?: VttNpcStats | null;
};

export function getTokenWorldCenter(
  token: TokenPositionLike,
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>,
  gridMode: VttGridMode = 'square'
): VttPoint {
  const isUnsnapped =
    gridMode === 'gridless' || Boolean(token.npc_stats?.__unsnapped);
  if (
    isUnsnapped &&
    typeof token.world_x === 'number' &&
    !Number.isNaN(token.world_x) &&
    typeof token.world_y === 'number' &&
    !Number.isNaN(token.world_y)
  ) {
    return { x: token.world_x, y: token.world_y };
  }
  return hexToWorldCenter({ col: token.x, row: token.y }, geom);
}

export function getTokenDistanceFeet(
  a: TokenPositionLike,
  b: TokenPositionLike,
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>,
  gridMode: VttGridMode = 'square'
): number {
  const useWorldDistance =
    gridMode === 'gridless' ||
    Boolean(a.npc_stats?.__unsnapped) ||
    Boolean(b.npc_stats?.__unsnapped);
  if (useWorldDistance) {
    const pa = getTokenWorldCenter(a, geom, gridMode);
    const pb = getTokenWorldCenter(b, geom, gridMode);
    const distPx = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    if (distPx < 1) return 0;
    const stepPx = getHexStepPixels(geom.gridSizePx);
    if (stepPx <= 0) return 0;
    return Math.max(5, Math.round(distPx / stepPx) * 5);
  }
  return getHexDistanceFeet({ col: a.x, row: a.y }, { col: b.x, row: b.y });
}

export function clampWorldPointToBounds(
  pt: VttPoint,
  bounds: { width: number; height: number },
  marginPx = 22
): VttPoint {
  const minX = Math.min(marginPx, bounds.width / 2);
  const maxX = Math.max(minX, bounds.width - marginPx);
  const minY = Math.min(marginPx, bounds.height / 2);
  const maxY = Math.max(minY, bounds.height - marginPx);
  return {
    x: Math.round(Math.max(minX, Math.min(maxX, pt.x))),
    y: Math.round(Math.max(minY, Math.min(maxY, pt.y))),
  };
}

export function getHexNeighbors(
  coord: HexCoord,
  gridWidth?: number,
  gridHeight?: number
): HexCoord[] {
  const neighbors: HexCoord[] = [];
  for (const dir of SQUARE_DIRECTIONS) {
    const next = {
      col: coord.col + dir.col,
      row: coord.row + dir.row,
    };
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

export function isWorldSegmentBlockedByWalls(
  fromPt: VttPoint,
  toPt: VttPoint,
  walls: VttWallSegment[]
): boolean {
  if (walls.length === 0) return false;
  for (const w of walls) {
    if (!doesWallBlockMovement(w)) continue;
    if (
      segmentsIntersect(
        fromPt,
        toPt,
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

export function isHexStepBlockedByWalls(
  fromHex: HexCoord,
  toHex: HexCoord,
  walls: VttWallSegment[],
  geom: Pick<HexGridGeometry, 'gridSizePx' | 'offsetX' | 'offsetY'>
): boolean {
  if (walls.length === 0) return false;
  const p1 = hexToWorldCenter(fromHex, geom);
  const p2 = hexToWorldCenter(toHex, geom);
  if (isWorldSegmentBlockedByWalls(p1, p2, walls)) {
    return true;
  }
  if (fromHex.col !== toHex.col && fromHex.row !== toHex.row) {
    const orthA = hexToWorldCenter({ col: toHex.col, row: fromHex.row }, geom);
    const orthB = hexToWorldCenter({ col: fromHex.col, row: toHex.row }, geom);
    const blockedViaA =
      isWorldSegmentBlockedByWalls(p1, orthA, walls) ||
      isWorldSegmentBlockedByWalls(orthA, p2, walls);
    const blockedViaB =
      isWorldSegmentBlockedByWalls(p1, orthB, walls) ||
      isWorldSegmentBlockedByWalls(orthB, p2, walls);
    if (blockedViaA && blockedViaB) {
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

function squareHeuristic(
  from: HexCoord,
  goal: HexCoord,
  dxGoal: number,
  dyGoal: number
): number {
  const remDx = Math.abs(goal.col - from.col);
  const remDy = Math.abs(goal.row - from.row);
  const minD = Math.min(remDx, remDy);
  const maxD = Math.max(remDx, remDy);
  const cross = Math.abs(
    (from.col - goal.col) * dyGoal - dxGoal * (from.row - goal.row)
  );
  return maxD - minD + minD * 1.001 + cross * 0.00001;
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
  const dxGoal = goal.col - start.col;
  const dyGoal = goal.row - start.row;

  const gScore = new Map<string, number>([[startKey, 0]]);
  const cameFrom = new Map<string, HexCoord>();
  const openList: { coord: HexCoord; key: string; f: number }[] = [
    {
      coord: start,
      key: startKey,
      f: squareHeuristic(start, goal, dxGoal, dyGoal),
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

      const isDiagonal =
        next.col !== current.coord.col && next.row !== current.coord.row;
      const stepCost = isDiagonal ? 1.001 : 1;
      const tentativeG = currentG + stepCost;
      const prevBest = gScore.get(nextKey);
      if (prevBest === undefined || tentativeG + 1e-9 < prevBest) {
        cameFrom.set(nextKey, current.coord);
        gScore.set(nextKey, tentativeG);
        const f = tentativeG + squareHeuristic(next, goal, dxGoal, dyGoal);
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

export interface TokenTravelAnimation {
  waypoints: VttPoint[];
  cumulativeLengthsPx: number[];
  totalLengthPx: number;
  startedAtMs: number;
  durationMs: number;
  targetEnd: VttPoint;
}

export function createTokenTravelAnimation(
  waypoints: VttPoint[],
  speedFeetPerSec: number,
  gridSizePx: number,
  startedAtMs: number,
  maxDurationMs?: number
): TokenTravelAnimation | null {
  if (speedFeetPerSec <= 0 || waypoints.length < 2) {
    return null;
  }

  const deduped: VttPoint[] = [waypoints[0]];
  const cumulative: number[] = [0];
  let totalPx = 0;

  for (let i = 1; i < waypoints.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = waypoints[i];
    const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (segLen < 0.5) {
      continue;
    }
    totalPx += segLen;
    deduped.push(curr);
    cumulative.push(totalPx);
  }

  if (deduped.length < 2 || totalPx < 1) {
    return null;
  }

  const speedPxPerSec = feetToWorldPixels(
    speedFeetPerSec,
    Math.max(10, gridSizePx)
  );
  if (speedPxPerSec <= 0) {
    return null;
  }

  const rawDurationMs = Math.max(40, (totalPx / speedPxPerSec) * 1000);
  const durationMs =
    typeof maxDurationMs === 'number' && maxDurationMs > 0
      ? Math.max(40, Math.min(rawDurationMs, maxDurationMs))
      : rawDurationMs;
  return {
    waypoints: deduped,
    cumulativeLengthsPx: cumulative,
    totalLengthPx: totalPx,
    startedAtMs,
    durationMs,
    targetEnd: deduped[deduped.length - 1],
  };
}

export function sampleTokenTravelAnimation(
  anim: TokenTravelAnimation,
  nowMs: number
): { point: VttPoint; done: boolean } {
  const elapsed = nowMs - anim.startedAtMs;
  if (elapsed <= 0) {
    return { point: anim.waypoints[0], done: false };
  }
  if (elapsed + 1e-6 >= anim.durationMs || anim.totalLengthPx <= 0) {
    return { point: anim.targetEnd, done: true };
  }

  const t = elapsed / anim.durationMs;
  const distPx = t * anim.totalLengthPx;

  let segEndIdx = 1;
  while (
    segEndIdx < anim.cumulativeLengthsPx.length - 1 &&
    anim.cumulativeLengthsPx[segEndIdx] < distPx
  ) {
    segEndIdx++;
  }

  const segStartDist = anim.cumulativeLengthsPx[segEndIdx - 1];
  const segEndDist = anim.cumulativeLengthsPx[segEndIdx];
  const segSpan = Math.max(0.0001, segEndDist - segStartDist);
  const localT = Math.max(0, Math.min(1, (distPx - segStartDist) / segSpan));

  const p0 = anim.waypoints[segEndIdx - 1];
  const p1 = anim.waypoints[segEndIdx];

  return {
    point: {
      x: p0.x + (p1.x - p0.x) * localT,
      y: p0.y + (p1.y - p0.y) * localT,
    },
    done: false,
  };
}
