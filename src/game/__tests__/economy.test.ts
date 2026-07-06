import { describe, expect, it } from 'vitest';
import {
  addMonths,
  applyEconomicEvent,
  assessPropertyValue,
  calculatePropertyIncome,
  compareYearMonth,
} from '../rules/economy';
import { sampleEvents } from '../sampleData';
import { setupState } from './testUtils';

describe('addMonths / compareYearMonth', () => {
  it('年をまたぐ加算ができる', () => {
    expect(addMonths({ year: 1, month: 4 }, 11)).toEqual({ year: 2, month: 3 });
    expect(addMonths({ year: 1, month: 12 }, 1)).toEqual({ year: 2, month: 1 });
  });

  it('年月を比較できる', () => {
    expect(compareYearMonth({ year: 1, month: 4 }, { year: 1, month: 4 })).toBe(0);
    expect(compareYearMonth({ year: 1, month: 12 }, { year: 2, month: 1 })).toBeLessThan(0);
  });
});

describe('applyEconomicEvent', () => {
  it('イベントの効果が active modifier として追加される', () => {
    const state = setupState(); // 1年目4月
    const boom = sampleEvents.find((e) => e.id === 'ev-bayside-boom')!; // 12ヶ月継続
    const result = applyEconomicEvent(state, boom);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const modifier = result.state.economicState.activeModifiers[0];
    expect(modifier.sourceEventId).toBe('ev-bayside-boom');
    expect(modifier.target).toEqual({ type: 'region', id: 'bayside' });
    expect(modifier.yieldMultiplier).toBe(1.5);
    expect(modifier.valueMultiplier).toBe(1); // 未指定は 1.0
    // 4月適用 + 12ヶ月継続 → 翌年3月まで有効
    expect(modifier.expiresAfter).toEqual({ year: 2, month: 3 });
  });

  it('地域好況イベントは対象地域の物件収益率を上げる', () => {
    const state = setupState();
    const boom = sampleEvents.find((e) => e.id === 'ev-bayside-boom')!;
    const result = applyEconomicEvent(state, boom);
    if (!result.ok) throw new Error('unreachable');

    const seafood = state.properties.find((p) => p.id === 'prop-harbor-seafood')!; // ベイサイド
    const bakery = state.properties.find((p) => p.id === 'prop-central-bakery')!; // ミッドタウン

    // ベイサイドの物件: 900 × 0.18 × 1.5 = 243
    expect(calculatePropertyIncome(seafood, 'bayside', result.state.economicState)).toBe(243);
    // 対象外地域の物件は変化なし: 1200 × 0.12 = 144
    expect(calculatePropertyIncome(bakery, 'midtown', result.state.economicState)).toBe(144);
  });

  it('カテゴリ不況イベントは対象カテゴリの評価額を下げる', () => {
    const state = setupState();
    const slump = sampleEvents.find((e) => e.id === 'ev-retail-slump')!;
    const result = applyEconomicEvent(state, slump);
    if (!result.ok) throw new Error('unreachable');

    const department = state.properties.find((p) => p.id === 'prop-central-department')!; // retail
    const bakery = state.properties.find((p) => p.id === 'prop-central-bakery')!; // food

    // retail: 4000 × 0.7 = 2800
    expect(assessPropertyValue(department, 'midtown', result.state.economicState)).toBe(2800);
    // 対象外カテゴリは変化なし
    expect(assessPropertyValue(bakery, 'midtown', result.state.economicState)).toBe(1200);
  });
});
