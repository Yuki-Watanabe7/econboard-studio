import { describe, expect, it } from 'vitest';
import type { Property } from '../types';
import {
  GROWTH_DRIFT,
  LARGE_CHANGE_LOG_THRESHOLD,
  RISK_AMPLITUDE,
  calculateNewPrice,
  fluctuatePropertyPrices,
  formatRate,
  minPropertyPrice,
} from '../rules/propertyValuation';
import { advanceMonth, calculateNetWorth, recalculateAllNetWorth } from '../rules/settlement';
import { applyEconomicEvent, assessPropertyValue } from '../rules/economy';
import { INITIAL_CASH } from '../initialState';
import { sampleEvents } from '../sampleData';
import { giveProperty, setupState } from './testUtils';

/** テスト用の物件を作る(価格 1000G / 基準価格 1000G) */
function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-test',
    stationId: 'central',
    name: 'テスト物件',
    category: 'retail',
    price: 1000,
    basePrice: 1000,
    baseYieldRate: 0.1,
    ownerPlayerId: null,
    riskLevel: 2,
    growthPotential: 2,
    description: '',
    ...overrides,
  };
}

// 乱数 0.5 でノイズが 0 になり、growthPotential の期待成長率だけが効く
const noNoise = () => 0.5;

describe('calculateNewPrice', () => {
  it('乱数 0.5(ノイズ 0)では growthPotential の期待成長率どおりに変動する', () => {
    const low = makeProperty({ growthPotential: 1 });
    const mid = makeProperty({ growthPotential: 2 });
    const high = makeProperty({ growthPotential: 3 });
    expect(calculateNewPrice(low, noNoise)).toBe(Math.round(1000 * (1 + GROWTH_DRIFT[1])));
    expect(calculateNewPrice(mid, noNoise)).toBe(Math.round(1000 * (1 + GROWTH_DRIFT[2])));
    expect(calculateNewPrice(high, noNoise)).toBe(Math.round(1000 * (1 + GROWTH_DRIFT[3])));
  });

  it('growthPotential が高い物件のほうが同条件で新価格が高い(上昇しやすい)', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      const low = calculateNewPrice(makeProperty({ growthPotential: 1 }), () => r);
      const high = calculateNewPrice(makeProperty({ growthPotential: 3 }), () => r);
      expect(high).toBeGreaterThan(low);
    }
  });

  it('riskLevel が高いほど上下の振れ幅が大きい', () => {
    const spread = (riskLevel: Property['riskLevel']) => {
      const p = makeProperty({ riskLevel });
      return calculateNewPrice(p, () => 1) - calculateNewPrice(p, () => 0);
    };
    expect(spread(3)).toBeGreaterThan(spread(2));
    expect(spread(2)).toBeGreaterThan(spread(1));
    // 振れ幅は ±amplitude の一様分布(最良 - 最悪 = 2 × amplitude × price)
    expect(spread(3)).toBe(
      Math.round(1000 * (1 + GROWTH_DRIFT[2] + RISK_AMPLITUDE[3])) -
        Math.round(1000 * (1 + GROWTH_DRIFT[2] - RISK_AMPLITUDE[3])),
    );
  });

  it('価格は整数に丸められる', () => {
    const p = makeProperty({ price: 777, growthPotential: 3, riskLevel: 3 });
    expect(Number.isInteger(calculateNewPrice(p, () => 0.123))).toBe(true);
  });

  it('最低価格(基準価格の一定割合)を下回らない', () => {
    const floor = minPropertyPrice(makeProperty());
    // 最悪の乱数を引き続けても floor 未満にならない
    let p = makeProperty({ growthPotential: 1, riskLevel: 3 });
    for (let i = 0; i < 50; i += 1) {
      p = { ...p, price: calculateNewPrice(p, () => 0) };
      expect(p.price).toBeGreaterThanOrEqual(floor);
    }
    expect(p.price).toBe(floor); // 十分下落すれば floor に張り付く
  });
});

describe('fluctuatePropertyPrices', () => {
  it('全物件の価格が改定され、basePrice は変わらない', () => {
    const state = setupState();
    const next = fluctuatePropertyPrices(state, noNoise);
    expect(next.properties).toHaveLength(state.properties.length);
    for (const [i, before] of state.properties.entries()) {
      const after = next.properties[i];
      expect(after.basePrice).toBe(before.basePrice);
      expect(after.price).toBe(calculateNewPrice(before, noNoise));
    }
  });

  it('集約ログを1件出し、小さな変動は個別ログに出さない', () => {
    const state = setupState();
    // ノイズ 0 → 変動は最大でも ±6% なので個別ログ(しきい値10%)は出ない
    const next = fluctuatePropertyPrices(state, noNoise);
    const logs = next.logs.slice(state.logs.length);
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('economy');
    expect(logs[0].message).toContain('物件価格改定');
  });

  it('変動率がしきい値以上の物件だけ個別ログに出す', () => {
    const state = setupState();
    // 乱数 1(最大上振れ)→ riskLevel 2 以上は +12% 超で個別ログ対象になる
    const next = fluctuatePropertyPrices(state, () => 1);
    const logs = next.logs.slice(state.logs.length);
    const expected = state.properties.filter((p) => {
      const rate = (calculateNewPrice(p, () => 1) - p.price) / p.price;
      return Math.abs(rate) >= LARGE_CHANGE_LOG_THRESHOLD;
    });
    expect(expected.length).toBeGreaterThan(0);
    expect(logs).toHaveLength(1 + expected.length); // 集約1件 + 個別
    for (const p of expected) {
      expect(logs.some((l) => l.message.includes(p.name))).toBe(true);
    }
  });

  it('価格改定は総資産の評価額に反映される(再計算後)', () => {
    let state = setupState();
    state = giveProperty(state, '0', 'prop-airport-cargo'); // 7000G / growth 3 / risk 3
    state = recalculateAllNetWorth(state);

    let next = fluctuatePropertyPrices(state, noNoise); // +6%
    next = recalculateAllNetWorth(next);

    const newPrice = Math.round(7000 * (1 + GROWTH_DRIFT[3]));
    const p0 = next.players.find((p) => p.id === '0')!;
    expect(next.properties.find((p) => p.id === 'prop-airport-cargo')?.price).toBe(newPrice);
    expect(p0.netWorth).toBe(INITIAL_CASH + newPrice);
  });

  it('経済 modifier の評価倍率とは二重計上にならない(改定後価格 × 倍率で評価)', () => {
    let state = setupState();
    const slump = sampleEvents.find((e) => e.id === 'ev-retail-slump')!; // retail 評価 0.7 倍
    const applied = applyEconomicEvent(state, slump);
    if (!applied.ok) throw new Error('unreachable');
    state = applied.state;

    const next = fluctuatePropertyPrices(state, noNoise);
    const dept = next.properties.find((p) => p.id === 'prop-central-department')!; // retail / growth 2
    const newPrice = Math.round(4000 * (1 + GROWTH_DRIFT[2]));
    expect(dept.price).toBe(newPrice); // price 自体に倍率は掛からない
    expect(assessPropertyValue(dept, 'midtown', next.economicState)).toBe(
      Math.round(newPrice * 0.7), // 評価時にのみ倍率が掛かる
    );
  });
});

describe('advanceMonth との統合', () => {
  it('12月の年次処理で価格が改定され、所有者の総資産に反映される', () => {
    let state = setupState();
    state = giveProperty(state, '0', 'prop-central-bakery'); // 1200G / growth 2 / 年間収益 144G
    state = { ...state, currentMonth: 12 };

    const next = advanceMonth(state, noNoise);

    const newPrice = Math.round(1200 * (1 + GROWTH_DRIFT[2]));
    expect(next.properties.find((p) => p.id === 'prop-central-bakery')?.price).toBe(newPrice);
    const p0 = next.players.find((p) => p.id === '0')!;
    // 総資産 = 初期現金 + 年次収益(改定前価格ベース) + 改定後の物件評価額
    expect(p0.netWorth).toBe(INITIAL_CASH + 144 + newPrice);
    expect(p0.netWorth).toBe(calculateNetWorth(next, p0));
  });

  it('年の途中(12月以外)では価格は変動しない', () => {
    const state = setupState(); // 4月
    const next = advanceMonth(state, () => 1);
    expect(next.properties.map((p) => p.price)).toEqual(state.properties.map((p) => p.price));
  });

  it('最終年の年次処理では価格改定を行わない(順位確定直前の運変動を避ける)', () => {
    let state = setupState();
    state = { ...state, currentYear: state.gameLengthYears, currentMonth: 12 };
    const next = advanceMonth(state, () => 1);
    expect(next.gameOver).toBe(true);
    expect(next.properties.map((p) => p.price)).toEqual(state.properties.map((p) => p.price));
  });
});

describe('formatRate', () => {
  it('正負に応じて符号付きパーセントで表示する', () => {
    expect(formatRate(0.06)).toBe('+6.0%');
    expect(formatRate(-0.125)).toBe('-12.5%');
    expect(formatRate(0)).toBe('+0.0%');
  });
});
