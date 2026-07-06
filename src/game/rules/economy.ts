import type {
  EconomicEvent,
  EconomicModifier,
  EconomicState,
  GameState,
  Property,
  RegionId,
  RuleResult,
} from '../types';
import { addLog } from './helpers';

/** 年月の比較。a < b なら負、a === b なら 0、a > b なら正 */
export function compareYearMonth(
  a: { year: number; month: number },
  b: { year: number; month: number },
): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

export function addMonths(
  base: { year: number; month: number },
  months: number,
): { year: number; month: number } {
  const total = base.year * 12 + (base.month - 1) + months;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function modifierApplies(
  modifier: EconomicModifier,
  regionId: RegionId,
  category: Property['category'],
): boolean {
  if (modifier.target.type === 'region') {
    return modifier.target.id === regionId;
  }
  return modifier.target.id === category;
}

/** その物件に効いている収益率倍率(該当 modifier の積) */
export function getYieldMultiplier(
  economicState: EconomicState,
  regionId: RegionId,
  category: Property['category'],
): number {
  return economicState.activeModifiers
    .filter((m) => modifierApplies(m, regionId, category))
    .reduce((acc, m) => acc * m.yieldMultiplier, 1);
}

/** その物件に効いている評価額倍率(該当 modifier の積) */
export function getValueMultiplier(
  economicState: EconomicState,
  regionId: RegionId,
  category: Property['category'],
): number {
  return economicState.activeModifiers
    .filter((m) => modifierApplies(m, regionId, category))
    .reduce((acc, m) => acc * m.valueMultiplier, 1);
}

/** 物件1件の年間収益(経済状態の倍率込み) */
export function calculatePropertyIncome(
  property: Property,
  regionId: RegionId,
  economicState: EconomicState,
): number {
  const multiplier = getYieldMultiplier(economicState, regionId, property.category);
  return Math.round(property.price * property.baseYieldRate * multiplier);
}

/** 物件1件の現在評価額(経済状態の倍率込み) */
export function assessPropertyValue(
  property: Property,
  regionId: RegionId,
  economicState: EconomicState,
): number {
  const multiplier = getValueMultiplier(economicState, regionId, property.category);
  return Math.round(property.price * multiplier);
}

/**
 * 経済イベントを適用し、有効な modifier を追加する。
 * durationMonths が n の場合、適用月を含めて n ヶ月効果が続く。
 */
export function applyEconomicEvent(state: GameState, event: EconomicEvent): RuleResult {
  if (event.effects.length === 0) {
    return { ok: false, reason: `イベント ${event.id} に効果が定義されていない` };
  }

  const expiresAfter =
    event.durationMonths === null
      ? null
      : addMonths({ year: state.currentYear, month: state.currentMonth }, event.durationMonths - 1);

  const modifiers: EconomicModifier[] = event.effects.map((effect) => ({
    sourceEventId: event.id,
    target: effect.target,
    yieldMultiplier: effect.yieldMultiplier ?? 1,
    valueMultiplier: effect.valueMultiplier ?? 1,
    expiresAfter,
  }));

  let next: GameState = {
    ...state,
    economicState: {
      ...state.economicState,
      activeModifiers: [...state.economicState.activeModifiers, ...modifiers],
    },
  };
  next = addLog(next, 'economy', `経済イベント発生: ${event.name} — ${event.description}`);
  return { ok: true, state: next };
}

/** 現在の年月を過ぎた modifier を取り除く(settleMonth から呼ばれる) */
export function expireModifiers(state: GameState): GameState {
  const now = { year: state.currentYear, month: state.currentMonth };
  const remaining = state.economicState.activeModifiers.filter(
    (m) => m.expiresAfter === null || compareYearMonth(m.expiresAfter, now) >= 0,
  );
  if (remaining.length === state.economicState.activeModifiers.length) {
    return state;
  }
  return {
    ...state,
    economicState: { ...state.economicState, activeModifiers: remaining },
  };
}
