import { CombatStatusEffect } from '../../../core/compendium/compendium.model';
import {
  VttClashResolution,
  VttDefenseChoice,
  VttDiceRoll,
  VttPendingClash,
} from '../models/vtt.model';

export interface DefenderClashCapabilities {
  currentSp: number;
  currentHp: number;
  currentAp: number;
  armorDr: number;
  shieldBlock: number;
  shieldRaised: boolean;
  parryMod: number;
  dodgeMod: number;
  canDodge: boolean;
  enablesMartialParry: boolean;
  flawlessCounterSp: number;
}

export interface LegalReactionsSummary {
  canParry: boolean;
  parryDisabledReason: string | null;
  canDodge: boolean;
  dodgeDisabledReason: string | null;
  blockActive: boolean;
  blockDisabledByPiercing: boolean;
  effectiveBlockMitigation: number;
}

function randomD10(): number {
  return Math.floor(Math.random() * 10) + 1;
}

export function roll2d10Check(
  modifier: number,
  mode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
  fixedDice?: [number, number] | [number, number, number]
): VttDiceRoll {
  const d1 = fixedDice?.[0] ?? randomD10();
  const d2 = fixedDice?.[1] ?? randomD10();

  if (mode === 'normal') {
    return {
      d1,
      d2,
      mode: 'normal',
      modifier,
      total: d1 + d2 + modifier,
    };
  }

  const d3 = fixedDice?.[2] ?? randomD10();
  const sorted = [d1, d2, d3].sort((a, b) => a - b);
  const keptSum =
    mode === 'advantage' ? sorted[1] + sorted[2] : sorted[0] + sorted[1];

  return {
    d1,
    d2,
    d3,
    mode,
    modifier,
    total: keptSum + modifier,
  };
}

export function createManualRoll(total: number, modifier = 0): VttDiceRoll {
  const raw = Math.max(2, total - modifier);
  const d1 = Math.min(10, Math.max(1, Math.floor(raw / 2)));
  const d2 = Math.max(1, raw - d1);
  return {
    d1,
    d2,
    mode: 'manual',
    modifier,
    total,
  };
}

export function getLegalDefenderReactions(
  clash: Pick<VttPendingClash, 'disallowedDefenses'>,
  defender: DefenderClashCapabilities
): LegalReactionsSummary {
  const noParryTag = clash.disallowedDefenses.includes('Parry');
  const noDodgeTag = clash.disallowedDefenses.includes('Dodge');
  const noBlockTag = clash.disallowedDefenses.includes('Block');

  let parryDisabledReason: string | null = null;
  if (noParryTag) {
    parryDisabledReason = 'Cannot Parry (Crushing)';
  } else if (defender.currentAp < 1) {
    parryDisabledReason = 'Requires 1 AP';
  }

  let dodgeDisabledReason: string | null = null;
  if (noDodgeTag) {
    dodgeDisabledReason = 'Cannot Dodge (Sweeping)';
  } else if (!defender.canDodge) {
    dodgeDisabledReason = 'Disabled by Heavy Gear';
  } else if (defender.currentAp < 1) {
    dodgeDisabledReason = 'Requires 1 AP';
  }

  const blockActive =
    defender.shieldRaised &&
    defender.shieldBlock > 0 &&
    defender.currentSp > 0 &&
    !noBlockTag;

  return {
    canParry: parryDisabledReason === null,
    parryDisabledReason,
    canDodge: dodgeDisabledReason === null,
    dodgeDisabledReason,
    blockActive,
    blockDisabledByPiercing:
      defender.shieldRaised &&
      defender.shieldBlock > 0 &&
      defender.currentSp > 0 &&
      noBlockTag,
    effectiveBlockMitigation: blockActive ? defender.shieldBlock : 0,
  };
}

export function computeHitDamageCascade(
  clash: Pick<
    VttPendingClash,
    | 'rawFlatDamage'
    | 'bonusSpDamage'
    | 'ignoreArmorDr'
    | 'disallowedDefenses'
  >,
  defender: Pick<
    DefenderClashCapabilities,
    'currentSp' | 'armorDr' | 'shieldBlock' | 'shieldRaised'
  >
): {
  spDamageToDefender: number;
  hpDamageToDefender: number;
  shieldMitigated: number;
  armorMitigated: number;
} {
  const blockAllowed = !clash.disallowedDefenses.includes('Block');
  const effectiveBlock =
    defender.shieldRaised && defender.currentSp > 0 && blockAllowed
      ? Math.max(0, defender.shieldBlock)
      : 0;
  const rawDmg = Math.max(0, clash.rawFlatDamage);
  const shieldMitigated = Math.min(rawDmg, effectiveBlock);
  const damageAfterBlock = Math.max(0, rawDmg - effectiveBlock);

  const curSp = Math.max(0, defender.currentSp);
  const spAbsorbedPhysical = Math.min(curSp, damageAfterBlock);
  const remainingSp = curSp - spAbsorbedPhysical;
  const spFromBonus = Math.min(
    remainingSp,
    Math.max(0, clash.bonusSpDamage)
  );
  const spDamageToDefender = spAbsorbedPhysical + spFromBonus;

  const hpOverflow = Math.max(0, damageAfterBlock - spAbsorbedPhysical);
  const effectiveArmorDr = Math.max(
    0,
    defender.armorDr - Math.max(0, clash.ignoreArmorDr)
  );
  const armorMitigated =
    hpOverflow > 0 ? Math.min(hpOverflow, effectiveArmorDr) : 0;
  const hpDamageToDefender = Math.max(0, hpOverflow - effectiveArmorDr);

  return {
    spDamageToDefender,
    hpDamageToDefender,
    shieldMitigated,
    armorMitigated,
  };
}

export function computeUndefendedHitDamage(
  clash: Pick<VttPendingClash, 'rawFlatDamage' | 'ignoreArmorDr'>,
  defender: Pick<DefenderClashCapabilities, 'armorDr'>
): {
  spDamageToDefender: number;
  hpDamageToDefender: number;
  shieldMitigated: number;
  armorMitigated: number;
} {
  const rawDmg = Math.max(0, clash.rawFlatDamage);
  const effectiveArmorDr = Math.max(
    0,
    defender.armorDr - Math.max(0, clash.ignoreArmorDr)
  );
  const armorMitigated =
    rawDmg > 0 ? Math.min(rawDmg, effectiveArmorDr) : 0;
  const hpDamageToDefender = Math.max(0, rawDmg - effectiveArmorDr);

  return {
    spDamageToDefender: 0,
    hpDamageToDefender,
    shieldMitigated: 0,
    armorMitigated,
  };
}

export function formatClashOutcomeStatus(
  reaction: VttDefenseChoice,
  hitLanded: boolean,
  flawless = false,
  blocked = false
): string {
  if (hitLanded) {
    if (reaction === 'parry') return 'Attack Succeeded · Parry Failed';
    if (reaction === 'dodge') return 'Attack Succeeded · Dodge Failed';
    if (blocked) return 'Attack Succeeded · Guard Blocked';
    return 'Attack Succeeded';
  }
  if (reaction === 'parry') {
    return flawless
      ? 'Defense Succeeded · Flawless Parry'
      : 'Defense Succeeded · Parried';
  }
  if (reaction === 'dodge') {
    return flawless
      ? 'Defense Succeeded · Flawless Dodge'
      : 'Defense Succeeded · Dodged';
  }
  return 'Defense Succeeded';
}

export function formatClashDamageParts(
  spDamage: number,
  hpDamage: number,
  counterSp = 0
): string[] {
  const parts: string[] = [];
  if (spDamage > 0) {
    parts.push(`−${spDamage} SP`);
  }
  if (hpDamage > 0) {
    parts.push(`−${hpDamage} HP`);
  }
  if (counterSp > 0) {
    parts.push(`Counter −${counterSp} SP`);
  }
  return parts;
}

export function resolveClashReaction(
  clash: VttPendingClash,
  reaction: VttDefenseChoice,
  defender: DefenderClashCapabilities,
  providedDefenseRoll?: VttDiceRoll,
  providedAttackRoll?: VttDiceRoll
): VttClashResolution {
  const atkRoll =
    providedAttackRoll ??
    clash.attackRoll ??
    roll2d10Check(clash.attackMod ?? 0, clash.attackRollMode ?? 'normal');
  const uniqueStatuses = Array.from(
    new Set(clash.inflictStatuses ?? [])
  ) as Exclude<CombatStatusEffect, 'None'>[];
  const willBreakGuard = (spDamage: number): boolean =>
    Boolean(
      defender.shieldRaised &&
        (defender.currentSp <= 0 ||
          (spDamage > 0 && defender.currentSp - spDamage <= 0))
    );

  if (reaction === 'parry') {
    const defRoll =
      providedDefenseRoll ?? roll2d10Check(defender.parryMod, 'normal');
    const margin = defRoll.total - atkRoll.total;
    const defended = margin > 0;
    const flawless = defended && margin >= 5;

    if (defended) {
      const counterSp =
        flawless && defender.enablesMartialParry
          ? Math.max(0, defender.flawlessCounterSp)
          : 0;
      const chipSp =
        !flawless && clash.defendedSpChip > 0
          ? Math.min(defender.currentSp, clash.defendedSpChip)
          : 0;
      const guardBroken = willBreakGuard(chipSp);
      const parts = [
        formatClashOutcomeStatus('parry', false, flawless),
        ...formatClashDamageParts(chipSp, 0, counterSp),
        ...(guardBroken ? ['Guard Lowered'] : []),
      ];

      return {
        reaction: 'parry',
        defenseRoll: defRoll,
        hitLanded: false,
        flawlessDefense: flawless,
        defenderApSpent: 1,
        spDamageToDefender: chipSp,
        hpDamageToDefender: 0,
        counterSpToAttacker: counterSp,
        shieldMitigated: 0,
        armorMitigated: 0,
        defenderGuardBroken: guardBroken,
        inflictedStatuses: [],
        pushFeet: 0,
        shiftDefenderFeet: 0,
        shiftAttackerFeet: clash.selfShiftFeet ?? 0,
        summary: parts.join(' · '),
      };
    }

    const cascade = computeHitDamageCascade(clash, defender);
    const guardBroken = willBreakGuard(cascade.spDamageToDefender);
    const dmgParts = formatClashDamageParts(
      cascade.spDamageToDefender,
      cascade.hpDamageToDefender
    );
    return {
      reaction: 'parry',
      defenseRoll: defRoll,
      hitLanded: true,
      flawlessDefense: false,
      defenderApSpent: 1,
      spDamageToDefender: cascade.spDamageToDefender,
      hpDamageToDefender: cascade.hpDamageToDefender,
      counterSpToAttacker: 0,
      shieldMitigated: cascade.shieldMitigated,
      armorMitigated: cascade.armorMitigated,
      defenderGuardBroken: guardBroken,
      inflictedStatuses: uniqueStatuses,
      pushFeet: clash.pushFeet ?? 0,
      shiftDefenderFeet: 0,
      shiftAttackerFeet: clash.selfShiftFeet ?? 0,
      summary: [
        formatClashOutcomeStatus('parry', true, false),
        ...(dmgParts.length > 0 ? dmgParts : ['0 DMG']),
        ...(guardBroken ? ['Guard Lowered'] : []),
      ].join(' · '),
    };
  }

  if (reaction === 'dodge') {
    const defRoll =
      providedDefenseRoll ?? roll2d10Check(defender.dodgeMod, 'normal');
    const margin = defRoll.total - atkRoll.total;
    const defended = margin > 0;
    const flawless = defended && margin >= 5;
    const apSpent = flawless ? 0 : 1;

    if (defended) {
      return {
        reaction: 'dodge',
        defenseRoll: defRoll,
        hitLanded: false,
        flawlessDefense: flawless,
        defenderApSpent: apSpent,
        spDamageToDefender: 0,
        hpDamageToDefender: 0,
        counterSpToAttacker: 0,
        shieldMitigated: 0,
        armorMitigated: 0,
        defenderGuardBroken: false,
        inflictedStatuses: [],
        pushFeet: 0,
        shiftDefenderFeet: 5,
        shiftAttackerFeet: clash.selfShiftFeet ?? 0,
        summary: formatClashOutcomeStatus('dodge', false, flawless),
      };
    }

    const cascade = computeHitDamageCascade(clash, defender);
    const guardBroken = willBreakGuard(cascade.spDamageToDefender);
    const dmgParts = formatClashDamageParts(
      cascade.spDamageToDefender,
      cascade.hpDamageToDefender
    );
    return {
      reaction: 'dodge',
      defenseRoll: defRoll,
      hitLanded: true,
      flawlessDefense: false,
      defenderApSpent: 1,
      spDamageToDefender: cascade.spDamageToDefender,
      hpDamageToDefender: cascade.hpDamageToDefender,
      counterSpToAttacker: 0,
      shieldMitigated: cascade.shieldMitigated,
      armorMitigated: cascade.armorMitigated,
      defenderGuardBroken: guardBroken,
      inflictedStatuses: uniqueStatuses,
      pushFeet: clash.pushFeet ?? 0,
      shiftDefenderFeet: 5,
      shiftAttackerFeet: clash.selfShiftFeet ?? 0,
      summary: [
        formatClashOutcomeStatus('dodge', true, false),
        ...(dmgParts.length > 0 ? dmgParts : ['0 DMG']),
        ...(guardBroken ? ['Guard Lowered'] : []),
      ].join(' · '),
    };
  }

  const blockAllowed = !clash.disallowedDefenses.includes('Block');
  const blockActive =
    defender.shieldRaised &&
    defender.shieldBlock > 0 &&
    defender.currentSp > 0 &&
    blockAllowed;

  const cascade = blockActive
    ? computeHitDamageCascade(clash, defender)
    : computeUndefendedHitDamage(clash, defender);
  const guardBroken = blockActive
    ? willBreakGuard(cascade.spDamageToDefender)
    : Boolean(defender.shieldRaised && defender.currentSp <= 0);
  const dmgParts = formatClashDamageParts(
    cascade.spDamageToDefender,
    cascade.hpDamageToDefender
  );

  return {
    reaction: 'take_hit',
    defenseRoll: null,
    hitLanded: true,
    flawlessDefense: false,
    defenderApSpent: 0,
    spDamageToDefender: cascade.spDamageToDefender,
    hpDamageToDefender: cascade.hpDamageToDefender,
    counterSpToAttacker: 0,
    shieldMitigated: cascade.shieldMitigated,
    armorMitigated: cascade.armorMitigated,
    defenderGuardBroken: guardBroken,
    inflictedStatuses: uniqueStatuses,
    pushFeet: clash.pushFeet ?? 0,
    shiftDefenderFeet: 0,
    shiftAttackerFeet: clash.selfShiftFeet ?? 0,
    summary: [
      formatClashOutcomeStatus('take_hit', true, false, blockActive),
      ...(dmgParts.length > 0 ? dmgParts : ['0 DMG']),
      ...(guardBroken ? ['Guard Lowered'] : []),
    ].join(' · '),
  };
}
