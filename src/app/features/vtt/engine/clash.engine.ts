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
    defender.shieldRaised && defender.shieldBlock > 0 && !noBlockTag;

  return {
    canParry: parryDisabledReason === null,
    parryDisabledReason,
    canDodge: dodgeDisabledReason === null,
    dodgeDisabledReason,
    blockActive,
    blockDisabledByPiercing:
      defender.shieldRaised && defender.shieldBlock > 0 && noBlockTag,
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
    defender.shieldRaised && blockAllowed
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

export function resolveClashReaction(
  clash: VttPendingClash,
  reaction: VttDefenseChoice,
  defender: DefenderClashCapabilities,
  providedDefenseRoll?: VttDiceRoll
): VttClashResolution {
  const uniqueStatuses = Array.from(
    new Set(clash.inflictStatuses ?? [])
  ) as Exclude<CombatStatusEffect, 'None'>[];

  if (reaction === 'parry') {
    const defRoll =
      providedDefenseRoll ?? roll2d10Check(defender.parryMod, 'normal');
    const margin = defRoll.total - clash.attackRoll.total;
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
      const parts = [
        flawless
          ? `Flawless Parry (${defRoll.total} vs ${clash.attackRoll.total})!`
          : `Parried (${defRoll.total} vs ${clash.attackRoll.total})!`,
      ];
      if (counterSp > 0) {
        parts.push(`Flawless Counter deals ${counterSp} SP DMG to ${clash.attackerName}`);
      }
      if (chipSp > 0) {
        parts.push(`${chipSp} SP chip taken`);
      }

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
        inflictedStatuses: [],
        pushFeet: 0,
        shiftDefenderFeet: 0,
        shiftAttackerFeet: clash.selfShiftFeet ?? 0,
        summary: parts.join(' · '),
      };
    }

    const cascade = computeHitDamageCascade(clash, defender);
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
      inflictedStatuses: uniqueStatuses,
      pushFeet: clash.pushFeet ?? 0,
      shiftDefenderFeet: 0,
      shiftAttackerFeet: clash.selfShiftFeet ?? 0,
      summary: `Parry Broken (${defRoll.total} vs ${clash.attackRoll.total}) · ${cascade.spDamageToDefender} SP & ${cascade.hpDamageToDefender} HP DMG`,
    };
  }

  if (reaction === 'dodge') {
    const defRoll =
      providedDefenseRoll ?? roll2d10Check(defender.dodgeMod, 'normal');
    const margin = defRoll.total - clash.attackRoll.total;
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
        inflictedStatuses: [],
        pushFeet: 0,
        shiftDefenderFeet: 5,
        shiftAttackerFeet: clash.selfShiftFeet ?? 0,
        summary: flawless
          ? `Flawless Dodge (${defRoll.total} vs ${clash.attackRoll.total}) · 1 AP Refunded · Shift 5 ft`
          : `Dodged (${defRoll.total} vs ${clash.attackRoll.total}) · Shift 5 ft`,
      };
    }

    const cascade = computeHitDamageCascade(clash, defender);
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
      inflictedStatuses: uniqueStatuses,
      pushFeet: clash.pushFeet ?? 0,
      shiftDefenderFeet: 5,
      shiftAttackerFeet: clash.selfShiftFeet ?? 0,
      summary: `Caught Mid-Dodge (${defRoll.total} vs ${clash.attackRoll.total}) · ${cascade.spDamageToDefender} SP & ${cascade.hpDamageToDefender} HP DMG`,
    };
  }

  const cascade = computeHitDamageCascade(clash, defender);
  const summaryParts = [
    `Direct Hit (Roll ${clash.attackRoll.total})`,
    `${cascade.spDamageToDefender} SP & ${cascade.hpDamageToDefender} HP DMG`,
  ];
  if (cascade.shieldMitigated > 0) {
    summaryParts.push(`Block −${cascade.shieldMitigated}`);
  }
  if (cascade.armorMitigated > 0) {
    summaryParts.push(`Armor DR −${cascade.armorMitigated}`);
  }

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
    inflictedStatuses: uniqueStatuses,
    pushFeet: clash.pushFeet ?? 0,
    shiftDefenderFeet: 0,
    shiftAttackerFeet: clash.selfShiftFeet ?? 0,
    summary: summaryParts.join(' · '),
  };
}
