import {
  DEFAULT_DICE_APPEARANCE,
  VttDiceAppearance,
  sanitizeDiceAppearance,
} from '../../../core/settings/vtt-settings.store';
import {
  VTT_CHAT_COMMANDS,
  VttChatCommandConfig,
  getPrimaryCommandTrigger,
  resolveSlashCommand,
} from '../config/vtt-commands.config';
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
  recipientIds?: string[];
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

  const rawRecipients = obj['recipientIds'];
  const recipientIds = Array.isArray(rawRecipients)
    ? rawRecipients
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
    : undefined;

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
    ...(recipientIds && recipientIds.length > 0 ? { recipientIds } : {}),
  };
}

const SIDES_TO_DIE_TYPE: Record<number, PolyhedralDieType> = {
  4: 'd4',
  6: 'd6',
  8: 'd8',
  10: 'd10',
  12: 'd12',
  20: 'd20',
  100: 'd100',
};

type KeepDropMode = 'kh' | 'kl' | 'dh' | 'dl';

interface ParsedFormulaDieTerm {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number;
  dieType: PolyhedralDieType;
  keepDropMode: KeepDropMode | null;
  keepDropAmount: number;
}

interface ParsedFormulaModTerm {
  kind: 'mod';
  sign: 1 | -1;
  value: number;
}

type ParsedFormulaTerm = ParsedFormulaDieTerm | ParsedFormulaModTerm;

export type ParsedFormulaRollOutcome =
  | {
      ok: true;
      result: CustomDicePoolRollResult;
      customLabel: string | null;
    }
  | {
      ok: false;
      error: string;
    };

function tokenizeFormulaExpression(
  rawExpr: string
): { ok: true; terms: ParsedFormulaTerm[] } | { ok: false; error: string } {
  const normalized = rawExpr
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s+/g, '');

  if (!normalized) {
    return {
      ok: true,
      terms: [
        {
          kind: 'dice',
          sign: 1,
          count: 2,
          sides: 10,
          dieType: 'd10',
          keepDropMode: null,
          keepDropAmount: 0,
        },
      ],
    };
  }

  const rawTokens = normalized.match(/[+-]?[^+-]+/g);
  if (!rawTokens || rawTokens.join('') !== normalized) {
    return { ok: false, error: 'Malformed dice formula.' };
  }

  const terms: ParsedFormulaTerm[] = [];
  for (const tok of rawTokens) {
    let sign: 1 | -1 = 1;
    let body = tok;
    if (body.startsWith('+')) {
      sign = 1;
      body = body.slice(1);
    } else if (body.startsWith('-')) {
      sign = -1;
      body = body.slice(1);
    }

    if (!body) {
      return { ok: false, error: 'Incomplete operator in dice formula.' };
    }

    if (/^\d+$/.test(body)) {
      const modVal = parseInt(body, 10);
      if (!Number.isFinite(modVal) || modVal > 9999) {
        return { ok: false, error: 'Modifier out of range.' };
      }
      terms.push({ kind: 'mod', sign, value: modVal });
      continue;
    }

    const dieMatch = /^(\d*)d(\d+)(?:(kh|kl|dh|dl)(\d*))?$/i.exec(body);
    if (!dieMatch) {
      return {
        ok: false,
        error: `Unrecognized roll term "${tok}". Try a formula like 2d10 + 3 or 1d20 + 1d6.`,
      };
    }

    const count = dieMatch[1] ? parseInt(dieMatch[1], 10) : 1;
    const sides = parseInt(dieMatch[2], 10);
    const dieType = SIDES_TO_DIE_TYPE[sides];

    if (!dieType) {
      return {
        ok: false,
        error: `Unsupported die d${sides}. Supported dice: d4, d6, d8, d10, d12, d20, d100.`,
      };
    }
    if (!Number.isFinite(count) || count < 1 || count > MAX_DICE_PER_TYPE) {
      return {
        ok: false,
        error: `Dice count per group must be between 1 and ${MAX_DICE_PER_TYPE}.`,
      };
    }

    const kdRaw = dieMatch[3] ? (dieMatch[3].toLowerCase() as KeepDropMode) : null;
    const kdAmt = kdRaw
      ? dieMatch[4]
        ? parseInt(dieMatch[4], 10)
        : 1
      : 0;

    if (kdRaw && (kdAmt < 1 || kdAmt >= count)) {
      return {
        ok: false,
        error: `Keep/drop count (${kdRaw}${kdAmt}) must be less than the ${count} rolled dice.`,
      };
    }

    terms.push({
      kind: 'dice',
      sign,
      count,
      sides,
      dieType,
      keepDropMode: kdRaw,
      keepDropAmount: kdAmt,
    });
  }

  const hasAnyDice = terms.some((t) => t.kind === 'dice');
  if (!hasAnyDice) {
    terms.unshift({
      kind: 'dice',
      sign: 1,
      count: 2,
      sides: 10,
      dieType: 'd10',
      keepDropMode: null,
      keepDropAmount: 0,
    });
  }

  return { ok: true, terms };
}

function computeDroppedIndices(
  values: number[],
  mode: KeepDropMode | null,
  amount: number
): Set<number> {
  const dropped = new Set<number>();
  if (!mode || amount <= 0 || values.length <= 1) {
    return dropped;
  }

  const indexed = values.map((v, idx) => ({ v, idx }));
  if (mode === 'kh') {
    indexed.sort((a, b) => b.v - a.v || a.idx - b.idx);
    for (let i = amount; i < indexed.length; i++) {
      dropped.add(indexed[i].idx);
    }
  } else if (mode === 'kl') {
    indexed.sort((a, b) => a.v - b.v || a.idx - b.idx);
    for (let i = amount; i < indexed.length; i++) {
      dropped.add(indexed[i].idx);
    }
  } else if (mode === 'dh') {
    indexed.sort((a, b) => b.v - a.v || a.idx - b.idx);
    for (let i = 0; i < Math.min(amount, indexed.length); i++) {
      dropped.add(indexed[i].idx);
    }
  } else if (mode === 'dl') {
    indexed.sort((a, b) => a.v - b.v || a.idx - b.idx);
    for (let i = 0; i < Math.min(amount, indexed.length); i++) {
      dropped.add(indexed[i].idx);
    }
  }

  return dropped;
}

function formatParsedTermLabel(term: ParsedFormulaDieTerm): string {
  const kdSuffix = term.keepDropMode
    ? `${term.keepDropMode}${term.keepDropAmount}`
    : '';
  return `${term.count}${term.dieType}${kdSuffix}`;
}

export function parseAndRollDiceFormula(
  rawFormula: string,
  rollDieFn: (sides: number) => number = defaultRandomInt
): ParsedFormulaRollOutcome {
  const hashIdx = rawFormula.indexOf('#');
  const exprPart = (
    hashIdx === -1 ? rawFormula : rawFormula.slice(0, hashIdx)
  ).trim();
  const customLabelRaw =
    hashIdx === -1 ? '' : rawFormula.slice(hashIdx + 1).trim();
  const customLabel = customLabelRaw.length > 0 ? customLabelRaw : null;

  const tokenized = tokenizeFormulaExpression(exprPart);
  if (!tokenized.ok) {
    return tokenized;
  }

  const groups: RolledPoolGroup[] = [];
  const chips: RolledDieChip[] = [];
  const physicalDice: VttPhysicalDieRoll[] = [];
  const formulaParts: string[] = [];
  const detailParts: string[] = [];

  let diceSubtotal = 0;
  let modifier = 0;

  for (const term of tokenized.terms) {
    if (term.kind === 'mod') {
      modifier += term.sign * term.value;
      continue;
    }

    const values: number[] = [];
    for (let i = 0; i < term.count; i++) {
      const raw = rollDieFn(term.sides);
      const val = Math.max(1, Math.min(term.sides, Math.floor(raw)));
      values.push(val);
    }

    const droppedSet = computeDroppedIndices(
      values,
      term.keepDropMode,
      term.keepDropAmount
    );

    let keptSum = 0;
    values.forEach((val, idx) => {
      const isDropped = droppedSet.has(idx);
      if (!isDropped) {
        keptSum += val;
      }

      chips.push({
        dieType: term.dieType,
        value: val,
        sides: term.sides,
        isMax: val === term.sides,
        isMin: val === 1,
        ...(isDropped ? { dropped: true } : {}),
      });

      if (physicalDice.length < MAX_TOTAL_PHYSICAL_DICE) {
        if (term.dieType === 'd100') {
          const tensTarget = val === 100 ? 0 : Math.floor(val / 10) * 10;
          const unitsTarget = val === 100 ? 0 : val % 10;
          physicalDice.push({
            kind: 'd100',
            targetValue: tensTarget,
            ...(isDropped ? { dropped: true } : {}),
          });
          if (physicalDice.length < MAX_TOTAL_PHYSICAL_DICE) {
            physicalDice.push({
              kind: 'd10_units',
              targetValue: unitsTarget,
              ...(isDropped ? { dropped: true } : {}),
            });
          }
        } else {
          physicalDice.push({
            kind: term.dieType,
            targetValue: val,
            ...(isDropped ? { dropped: true } : {}),
          });
        }
      }
    });

    const signedGroupTotal = term.sign * keptSum;
    diceSubtotal += signedGroupTotal;

    groups.push({
      dieType: term.dieType,
      count: term.count,
      sides: term.sides,
      values,
      subtotal: signedGroupTotal,
    });

    const termLabel = formatParsedTermLabel(term);
    if (formulaParts.length === 0) {
      formulaParts.push(term.sign < 0 ? `−${termLabel}` : termLabel);
    } else {
      formulaParts.push(term.sign < 0 ? `− ${termLabel}` : `+ ${termLabel}`);
    }

    const valListLabel = values
      .map((v, idx) => (droppedSet.has(idx) ? `${v}✕` : `${v}`))
      .join(', ');
    const detailTerm = `${termLabel} (${valListLabel})`;
    if (detailParts.length === 0) {
      detailParts.push(term.sign < 0 ? `−${detailTerm}` : detailTerm);
    } else {
      detailParts.push(term.sign < 0 ? `− ${detailTerm}` : `+ ${detailTerm}`);
    }
  }

  if (modifier > 0) {
    formulaParts.push(`+ ${modifier}`);
    detailParts.push(`+ ${modifier}`);
  } else if (modifier < 0) {
    formulaParts.push(`− ${Math.abs(modifier)}`);
    detailParts.push(`− ${Math.abs(modifier)}`);
  }

  const total = diceSubtotal + modifier;
  return {
    ok: true,
    customLabel,
    result: {
      groups,
      chips,
      physicalDice,
      diceSubtotal,
      modifier,
      total,
      formula: formulaParts.join(' '),
      detail: detailParts.join(' '),
    },
  };
}

export function extractDicePoolFromChatInput(
  rawInput: string,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): DicePoolCounts {
  const pool = createEmptyDicePool();
  const resolved = resolveSlashCommand(rawInput, registry);
  if (
    !resolved ||
    (resolved.config.action !== 'roll' && resolved.config.action !== 'gm_roll')
  ) {
    return pool;
  }

  const hashIdx = resolved.rest.indexOf('#');
  const exprPart = (
    hashIdx === -1 ? resolved.rest : resolved.rest.slice(0, hashIdx)
  ).trim();
  if (!exprPart) {
    return pool;
  }

  const tokenized = tokenizeFormulaExpression(exprPart);
  if (!tokenized.ok) {
    const looseRegex = /(?:^|[+])\s*(\d*)d(4|6|8|100|10|12|20)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = looseRegex.exec(exprPart)) !== null) {
      const cnt = m[1] ? parseInt(m[1], 10) : 1;
      const sides = parseInt(m[2], 10);
      const dieType = SIDES_TO_DIE_TYPE[sides];
      if (dieType && Number.isFinite(cnt) && cnt > 0) {
        pool[dieType] = Math.min(MAX_DICE_PER_TYPE, pool[dieType] + cnt);
      }
    }
    return pool;
  }

  const hasExplicitDiceInRaw = /\d*d\d+/i.test(exprPart);
  if (!hasExplicitDiceInRaw) {
    return pool;
  }

  for (const term of tokenized.terms) {
    if (term.kind === 'dice' && term.sign > 0) {
      pool[term.dieType] = Math.min(
        MAX_DICE_PER_TYPE,
        pool[term.dieType] + term.count
      );
    }
  }

  return pool;
}

export function applyDieClickToChatInput(
  rawInput: string,
  die: PolyhedralDieType,
  delta: number,
  registry: readonly VttChatCommandConfig[] = VTT_CHAT_COMMANDS
): string {
  const step = Math.trunc(delta);
  if (step === 0) return rawInput;

  const resolved = resolveSlashCommand(rawInput, registry);
  const isRollCmd =
    resolved &&
    (resolved.config.action === 'roll' || resolved.config.action === 'gm_roll');

  if (!isRollCmd) {
    if (step < 0) {
      return rawInput;
    }
    const trigger = getPrimaryCommandTrigger('roll', registry);
    const count = Math.min(MAX_DICE_PER_TYPE, step);
    return `${trigger} ${count}${die}`;
  }

  const trigger = resolved.matchedTrigger;
  const hashIdx = resolved.rest.indexOf('#');
  const exprPart = (
    hashIdx === -1 ? resolved.rest : resolved.rest.slice(0, hashIdx)
  ).trim();
  const commentSuffix =
    hashIdx === -1 ? '' : ` # ${resolved.rest.slice(hashIdx + 1).trim()}`.trimEnd();

  const tokenized = exprPart ? tokenizeFormulaExpression(exprPart) : null;
  const hasExplicitDice = /\d*d\d+/i.test(exprPart);

  const plainDiceOrder: { dieType: PolyhedralDieType; count: number }[] = [];
  const preservedTail: string[] = [];

  if (tokenized && tokenized.ok) {
    for (const term of tokenized.terms) {
      if (
        term.kind === 'dice' &&
        !hasExplicitDice &&
        term.dieType === 'd10' &&
        term.count === 2
      ) {
        continue;
      }

      if (term.kind === 'dice' && term.sign > 0 && !term.keepDropMode) {
        const existing = plainDiceOrder.find((p) => p.dieType === term.dieType);
        if (existing) {
          existing.count = Math.min(
            MAX_DICE_PER_TYPE,
            existing.count + term.count
          );
        } else {
          plainDiceOrder.push({ dieType: term.dieType, count: term.count });
        }
      } else if (term.kind === 'dice') {
        const label = formatParsedTermLabel(term);
        preservedTail.push(term.sign < 0 ? `- ${label}` : `+ ${label}`);
      } else {
        preservedTail.push(
          term.sign < 0 ? `- ${term.value}` : `+ ${term.value}`
        );
      }
    }
  } else if (exprPart) {
    if (step < 0) return rawInput;
    return `${rawInput.trimEnd()} + ${Math.min(MAX_DICE_PER_TYPE, step)}${die}`;
  }

  const targetEntry = plainDiceOrder.find((p) => p.dieType === die);
  if (targetEntry) {
    const nextCount = Math.max(
      0,
      Math.min(MAX_DICE_PER_TYPE, targetEntry.count + step)
    );
    targetEntry.count = nextCount;
  } else if (step > 0) {
    plainDiceOrder.push({
      dieType: die,
      count: Math.min(MAX_DICE_PER_TYPE, step),
    });
  }

  const activePlain = plainDiceOrder.filter((p) => p.count > 0);
  const parts: string[] = activePlain.map((p) => `${p.count}${p.dieType}`);

  let rebuiltExpr = parts.join(' + ');
  if (preservedTail.length > 0) {
    const tailStr = preservedTail.join(' ');
    if (rebuiltExpr) {
      rebuiltExpr = `${rebuiltExpr} ${tailStr}`;
    } else {
      rebuiltExpr = tailStr.replace(/^\+\s*/, '').replace(/^-\s*/, '-');
    }
  }

  if (!rebuiltExpr && !commentSuffix) {
    return '';
  }

  if (!rebuiltExpr && commentSuffix) {
    return `${trigger}${commentSuffix}`;
  }

  return `${trigger} ${rebuiltExpr}${commentSuffix}`;
}
