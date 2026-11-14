import {
  DEFAULT_DICE_APPEARANCE,
  VttDiceAppearance,
  sanitizeDiceAppearance,
} from '../../../core/settings/vtt-settings.store';
import { VttDiceRoll } from '../models/vtt.model';

export type PolyhedralDieType =
  | 'd4'
  | 'd6'
  | 'd8'
  | 'd10'
  | 'd12'
  | 'd20'
  | 'd100';

export type PhysicalDieMeshKind =
  | 'd4'
  | 'd6'
  | 'd8'
  | 'd10'
  | 'd10_units'
  | 'd12'
  | 'd20'
  | 'd100';

export const POLYHEDRAL_DIE_TYPES: readonly PolyhedralDieType[] = [
  'd4',
  'd6',
  'd8',
  'd10',
  'd12',
  'd20',
  'd100',
];

export const POLYHEDRAL_DIE_SIDES: Record<PolyhedralDieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

export type DicePoolCounts = Record<PolyhedralDieType, number>;

export interface VttPhysicalDieRoll {
  kind: PhysicalDieMeshKind;
  targetValue: number;
  dropped?: boolean;
}

export interface RolledDieChip {
  dieType: PolyhedralDieType;
  value: number;
  sides: number;
  isMax: boolean;
  isMin: boolean;
  dropped?: boolean;
}

export interface RolledPoolGroup {
  dieType: PolyhedralDieType;
  count: number;
  sides: number;
  values: number[];
  subtotal: number;
}

export interface CustomDicePoolRollResult {
  groups: RolledPoolGroup[];
  chips: RolledDieChip[];
  physicalDice: VttPhysicalDieRoll[];
  diceSubtotal: number;
  modifier: number;
  total: number;
  formula: string;
  detail: string;
}

export interface VttDiceThrowPayload {
  id: string;
  senderId: string | null;
  senderName: string;
  label: string;
  formula: string;
  total: number;
  dice: VttPhysicalDieRoll[];
  appearance: VttDiceAppearance;
  seed: number;
  createdAt: number;
}

export const MAX_DICE_PER_TYPE = 15;
export const MAX_TOTAL_PHYSICAL_DICE = 24;

export function createEmptyDicePool(): DicePoolCounts {
  return {
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    d20: 0,
    d100: 0,
  };
}

export function getTotalDiceInPool(pool: Partial<DicePoolCounts>): number {
  let sum = 0;
  for (const die of POLYHEDRAL_DIE_TYPES) {
    sum += Math.max(0, Math.floor(Number(pool[die] ?? 0)));
  }
  return sum;
}

export function adjustDiePoolCount(
  pool: DicePoolCounts,
  die: PolyhedralDieType,
  delta: number,
  maxPerDie = MAX_DICE_PER_TYPE
): DicePoolCounts {
  const current = Math.max(0, Math.floor(Number(pool[die] ?? 0)));
  const nextCount = Math.max(0, Math.min(maxPerDie, current + Math.trunc(delta)));
  return {
    ...pool,
    [die]: nextCount,
  };
}

export function formatDicePoolFormula(
  pool: Partial<DicePoolCounts>,
  modifier = 0
): string {
  const terms: string[] = [];
  for (const die of POLYHEDRAL_DIE_TYPES) {
    const count = Math.max(0, Math.floor(Number(pool[die] ?? 0)));
    if (count > 0) {
      terms.push(`${count}${die}`);
    }
  }
  if (terms.length === 0) {
    terms.push('0d10');
  }
  const mod = Math.trunc(Number(modifier) || 0);
  if (mod > 0) {
    return `${terms.join(' + ')} + ${mod}`;
  }
  if (mod < 0) {
    return `${terms.join(' + ')} − ${Math.abs(mod)}`;
  }
  return terms.join(' + ');
}

function defaultRandomInt(sides: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / sides) * sides;
    let val = 0;
    do {
      crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return (val % sides) + 1;
  }
  return Math.floor(Math.random() * sides) + 1;
}

export function generateThrowSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return Math.max(1, Math.floor(Math.random() * 0x7fffffff));
}

export function rollCustomDicePool(
  pool: Partial<DicePoolCounts>,
  modifier = 0,
  rollDieFn: (sides: number) => number = defaultRandomInt
): CustomDicePoolRollResult {
  const groups: RolledPoolGroup[] = [];
  const chips: RolledDieChip[] = [];
  const physicalDice: VttPhysicalDieRoll[] = [];
  let diceSubtotal = 0;

  for (const dieType of POLYHEDRAL_DIE_TYPES) {
    const count = Math.max(
      0,
      Math.min(MAX_DICE_PER_TYPE, Math.floor(Number(pool[dieType] ?? 0)))
    );
    if (count <= 0) continue;

    const sides = POLYHEDRAL_DIE_SIDES[dieType];
    const values: number[] = [];
    let groupSum = 0;

    for (let i = 0; i < count; i++) {
      const raw = rollDieFn(sides);
      const val = Math.max(1, Math.min(sides, Math.floor(raw)));
      values.push(val);
      groupSum += val;

      chips.push({
        dieType,
        value: val,
        sides,
        isMax: val === sides,
        isMin: val === 1,
      });

      if (physicalDice.length < MAX_TOTAL_PHYSICAL_DICE) {
        if (dieType === 'd100') {
          const tensTarget = val === 100 ? 0 : Math.floor(val / 10) * 10;
          const unitsTarget = val === 100 ? 0 : val % 10;
          physicalDice.push({ kind: 'd100', targetValue: tensTarget });
          if (physicalDice.length < MAX_TOTAL_PHYSICAL_DICE) {
            physicalDice.push({ kind: 'd10_units', targetValue: unitsTarget });
          }
        } else {
          physicalDice.push({ kind: dieType, targetValue: val });
        }
      }
    }

    diceSubtotal += groupSum;
    groups.push({
      dieType,
      count,
      sides,
      values,
      subtotal: groupSum,
    });
  }

  const mod = Math.trunc(Number(modifier) || 0);
  const total = diceSubtotal + mod;
  const formula = formatDicePoolFormula(pool, mod);

  const detailTerms = groups.map(
    (g) => `${g.count}${g.dieType} (${g.values.join(', ')})`
  );
  let detail = detailTerms.join(' + ');
  if (mod > 0) {
    detail = detail ? `${detail} + ${mod}` : `+${mod}`;
  } else if (mod < 0) {
    detail = detail ? `${detail} − ${Math.abs(mod)}` : `−${Math.abs(mod)}`;
  }

  return {
    groups,
    chips,
    physicalDice,
    diceSubtotal,
    modifier: mod,
    total,
    formula,
    detail,
  };
}

export function buildPhysicalDiceFrom2d10Roll(
  roll: VttDiceRoll
): { physicalDice: VttPhysicalDieRoll[]; chips: RolledDieChip[]; formula: string } {
  if (roll.d3 !== undefined && (roll.mode === 'advantage' || roll.mode === 'disadvantage')) {
    const vals = [roll.d1, roll.d2, roll.d3];
    let dropIdx = 0;
    if (roll.mode === 'advantage') {
      let minVal = vals[0];
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] < minVal) {
          minVal = vals[i];
          dropIdx = i;
        }
      }
    } else {
      let maxVal = vals[0];
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] > maxVal) {
          maxVal = vals[i];
          dropIdx = i;
        }
      }
    }

    const physicalDice: VttPhysicalDieRoll[] = vals.map((v, idx) => ({
      kind: 'd10',
      targetValue: Math.max(1, Math.min(10, Math.round(v))),
      dropped: idx === dropIdx,
    }));

    const chips: RolledDieChip[] = vals.map((v, idx) => {
      const clamped = Math.max(1, Math.min(10, Math.round(v)));
      return {
        dieType: 'd10',
        value: clamped,
        sides: 10,
        isMax: clamped === 10,
        isMin: clamped === 1,
        dropped: idx === dropIdx,
      };
    });

    const mod = Math.trunc(Number(roll.modifier) || 0);
    const baseLabel = roll.mode === 'advantage' ? '3d10kh2' : '3d10kl2';
    const formula =
      mod > 0
        ? `${baseLabel} + ${mod}`
        : mod < 0
          ? `${baseLabel} − ${Math.abs(mod)}`
          : baseLabel;

    return { physicalDice, chips, formula };
  }

  const vals = [roll.d1, roll.d2];
  const physicalDice: VttPhysicalDieRoll[] = vals.map((v) => ({
    kind: 'd10',
    targetValue: Math.max(1, Math.min(10, Math.round(v))),
  }));
  const chips: RolledDieChip[] = vals.map((v) => {
    const clamped = Math.max(1, Math.min(10, Math.round(v)));
    return {
      dieType: 'd10',
      value: clamped,
      sides: 10,
      isMax: clamped === 10,
      isMin: clamped === 1,
    };
  });
  const mod = Math.trunc(Number(roll.modifier) || 0);
  const formula =
    mod > 0
      ? `2d10 + ${mod}`
      : mod < 0
        ? `2d10 − ${Math.abs(mod)}`
        : '2d10';

  return { physicalDice, chips, formula };
}

export function extractLogRollChips(
  payload: Record<string, unknown> | null | undefined
): RolledDieChip[] {
  if (!payload || typeof payload !== 'object') return [];

  const rawChips = payload['chips'];
  if (Array.isArray(rawChips) && rawChips.length > 0) {
    const valid: RolledDieChip[] = [];
    for (const item of rawChips) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const dieType = obj['dieType'] as PolyhedralDieType;
      const val = Number(obj['value']);
      const sides = Number(obj['sides']) || POLYHEDRAL_DIE_SIDES[dieType] || 10;
      if (POLYHEDRAL_DIE_TYPES.includes(dieType) && Number.isFinite(val)) {
        valid.push({
          dieType,
          value: Math.round(val),
          sides,
          isMax: Boolean(obj['isMax'] ?? val === sides),
          isMin: Boolean(obj['isMin'] ?? val === 1),
          dropped: Boolean(obj['dropped']),
        });
      }
    }
    if (valid.length > 0) return valid;
  }

  const rawRoll = payload['roll'];
  if (rawRoll && typeof rawRoll === 'object') {
    const r = rawRoll as Partial<VttDiceRoll>;
    if (typeof r.d1 === 'number' && typeof r.d2 === 'number') {
      return buildPhysicalDiceFrom2d10Roll({
        d1: r.d1,
        d2: r.d2,
        d3: typeof r.d3 === 'number' ? r.d3 : undefined,
        mode: r.mode,
        modifier: Number(r.modifier ?? 0),
        total: Number(r.total ?? r.d1 + r.d2),
      }).chips;
    }
  }

  return [];
}

export function sanitizeIncomingDiceThrowPayload(
  raw: unknown
): VttDiceThrowPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj['id'] === 'string' ? obj['id'].trim() : '';
  if (!id) return null;

  const rawDice = obj['dice'];
  if (!Array.isArray(rawDice) || rawDice.length === 0) return null;

  const allowedKinds = new Set<PhysicalDieMeshKind>([
    'd4',
    'd6',
    'd8',
    'd10',
    'd10_units',
    'd12',
    'd20',
    'd100',
  ]);
  const dice: VttPhysicalDieRoll[] = [];
  for (const item of rawDice) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;
    const kind = d['kind'] as PhysicalDieMeshKind;
    const targetValue = Number(d['targetValue']);
    if (allowedKinds.has(kind) && Number.isFinite(targetValue)) {
      dice.push({
        kind,
        targetValue: Math.round(targetValue),
        dropped: Boolean(d['dropped']),
      });
    }
    if (dice.length >= MAX_TOTAL_PHYSICAL_DICE) break;
  }
  if (dice.length === 0) return null;

  return {
    id,
    senderId: typeof obj['senderId'] === 'string' ? obj['senderId'] : null,
    senderName:
      typeof obj['senderName'] === 'string' && obj['senderName'].trim()
        ? obj['senderName'].trim()
        : 'Adventurer',
    label:
      typeof obj['label'] === 'string' && obj['label'].trim()
        ? obj['label'].trim()
        : 'Dice Roll',
    formula:
      typeof obj['formula'] === 'string' ? obj['formula'] : '',
    total: Number.isFinite(Number(obj['total'])) ? Number(obj['total']) : 0,
    dice,
    appearance: sanitizeDiceAppearance(obj['appearance'], DEFAULT_DICE_APPEARANCE),
    seed: Number.isFinite(Number(obj['seed'])) ? Number(obj['seed']) : 1,
    createdAt: Number.isFinite(Number(obj['createdAt']))
      ? Number(obj['createdAt'])
      : Date.now(),
  };
}
