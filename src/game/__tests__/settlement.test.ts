import { describe, expect, it } from 'vitest';
import {
  advanceMonth,
  buildFinalRanking,
  calculateNetWorth,
  settleMonth,
  settleYear,
} from '../rules/settlement';
import { applyEconomicEvent, calculatePropertyIncome } from '../rules/economy';
import { INITIAL_CASH } from '../initialState';
import { sampleEvents } from '../sampleData';
import { giveProperty, setupState } from './testUtils';

// 中央ベーカリー: 価格 1200G × 収益率 0.12 = 年間 144G
const BAKERY = 'prop-central-bakery';
const BAKERY_INCOME = 144;
// 海鮮食堂(ベイサイド地域): 価格 900G × 収益率 0.18 = 年間 162G
const SEAFOOD = 'prop-harbor-seafood';
const SEAFOOD_INCOME = 162;

describe('calculatePropertyIncome', () => {
  it('価格 × 基礎収益率で年間収益を計算する', () => {
    const state = setupState();
    const bakery = state.properties.find((p) => p.id === BAKERY)!;
    expect(calculatePropertyIncome(bakery, 'midtown', state.economicState)).toBe(BAKERY_INCOME);
  });
});

describe('settleYear', () => {
  it('保有物件に応じた年間収益を各プレイヤーに加算する', () => {
    let state = setupState();
    state = giveProperty(state, '0', BAKERY);
    state = giveProperty(state, '0', SEAFOOD);

    const settled = settleYear(state);

    const p0 = settled.players.find((p) => p.id === '0');
    const p1 = settled.players.find((p) => p.id === '1');
    expect(p0?.cash).toBe(INITIAL_CASH + BAKERY_INCOME + SEAFOOD_INCOME);
    expect(p1?.cash).toBe(INITIAL_CASH); // 物件なし → 収益なし
  });

  it('経済イベント(地域好況)で収益が増える', () => {
    let state = setupState();
    state = giveProperty(state, '0', SEAFOOD);

    // ベイサイド好況: ベイサイド地域の収益率 1.5 倍
    const boom = sampleEvents.find((e) => e.id === 'ev-bayside-boom')!;
    const applied = applyEconomicEvent(state, boom);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const settled = settleYear(applied.state);
    const p0 = settled.players.find((p) => p.id === '0');
    expect(p0?.cash).toBe(INITIAL_CASH + Math.round(SEAFOOD_INCOME * 1.5));
  });
});

describe('calculateNetWorth', () => {
  it('現金 + 保有物件の評価額を返す', () => {
    let state = setupState();
    state = giveProperty(state, '0', BAKERY); // 価格 1200G
    const p0 = state.players.find((p) => p.id === '0')!;
    expect(calculateNetWorth(state, p0)).toBe(INITIAL_CASH + 1200);
  });

  it('評価額が下がるイベント中は総資産も下がる', () => {
    let state = setupState();
    state = giveProperty(state, '0', 'prop-central-department'); // retail / 4000G

    const slump = sampleEvents.find((e) => e.id === 'ev-retail-slump')!; // retail 評価 0.7 倍
    const applied = applyEconomicEvent(state, slump);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const p0 = applied.state.players.find((p) => p.id === '0')!;
    expect(calculateNetWorth(applied.state, p0)).toBe(INITIAL_CASH + Math.round(4000 * 0.7));
  });
});

describe('settleMonth', () => {
  it('期限切れの経済 modifier を除去する', () => {
    let state = setupState(); // 1年目4月開始
    const slump = sampleEvents.find((e) => e.id === 'ev-retail-slump')!; // 6ヶ月継続
    const applied = applyEconomicEvent(state, slump);
    if (!applied.ok) throw new Error('unreachable');
    state = applied.state;
    expect(state.economicState.activeModifiers).toHaveLength(1);

    // 4月適用 + 6ヶ月 → 9月まで有効、10月の月次処理で除去される
    const inSeptember = settleMonth({ ...state, currentMonth: 9 });
    expect(inSeptember.economicState.activeModifiers).toHaveLength(1);

    const inOctober = settleMonth({ ...state, currentMonth: 10 });
    expect(inOctober.economicState.activeModifiers).toHaveLength(0);
  });
});

describe('advanceMonth', () => {
  it('通常の月は +1 される', () => {
    const state = setupState();
    const next = advanceMonth(state);
    expect(next.currentMonth).toBe(5);
    expect(next.currentYear).toBe(1);
  });

  it('12月の次は年次決算が走り、翌年1月になる', () => {
    let state = setupState();
    state = giveProperty(state, '0', BAKERY);
    state = { ...state, currentMonth: 12 };

    const next = advanceMonth(state);

    expect(next.currentYear).toBe(2);
    expect(next.currentMonth).toBe(1);
    const p0 = next.players.find((p) => p.id === '0');
    expect(p0?.cash).toBe(INITIAL_CASH + BAKERY_INCOME); // 年次収益が支払われている
  });
});

describe('ゲーム終了(advanceMonth / buildFinalRanking)', () => {
  it('最終年より前の12月ではゲーム終了しない', () => {
    let state = setupState(); // gameLengthYears は既定の3年
    state = { ...state, currentYear: 2, currentMonth: 12 };

    const next = advanceMonth(state);

    expect(next.gameOver).toBe(false);
    expect(next.currentYear).toBe(3);
    expect(next.currentMonth).toBe(1);
    expect(next.finalRanking).toHaveLength(0);
  });

  it('最終年の12月終了時に年次決算を経てゲーム終了する', () => {
    let state = setupState();
    state = giveProperty(state, '0', BAKERY); // 価格 1200G / 年間収益 144G
    state = { ...state, currentYear: state.gameLengthYears, currentMonth: 12 };

    const next = advanceMonth(state);

    expect(next.gameOver).toBe(true);
    // 年は繰り上がらず最終年の12月のまま
    expect(next.currentYear).toBe(state.gameLengthYears);
    expect(next.currentMonth).toBe(12);

    // 年次決算(収益 144G)が支払われたうえで総資産が再計算されている
    const p0Entry = next.finalRanking.find((e) => e.playerId === '0');
    expect(p0Entry?.netWorth).toBe(INITIAL_CASH + BAKERY_INCOME + 1200);
  });

  it('総資産降順のランキングが確定し、1位が勝者になる', () => {
    let state = setupState(3);
    state = giveProperty(state, '1', BAKERY); // p1 だけ物件あり → 総資産・収益とも最大
    state = { ...state, currentYear: state.gameLengthYears, currentMonth: 12 };

    const next = advanceMonth(state);

    expect(next.winnerPlayerIds).toEqual(['1']);
    expect(next.finalRanking.map((e) => e.playerId)).toEqual(['1', '0', '2']);
    // p0 と p2 は同額(初期現金のまま)なので同順位
    expect(next.finalRanking.map((e) => e.rank)).toEqual([1, 2, 2]);
  });

  it('同額1位の場合は複数勝者(同率優勝)になる', () => {
    let state = setupState(2); // 両者とも初期現金のみで同額
    state = { ...state, currentYear: state.gameLengthYears, currentMonth: 12 };

    const next = advanceMonth(state);

    expect(next.gameOver).toBe(true);
    expect(next.winnerPlayerIds).toHaveLength(2);
    expect(next.winnerPlayerIds).toContain('0');
    expect(next.winnerPlayerIds).toContain('1');
    expect(next.finalRanking.map((e) => e.rank)).toEqual([1, 1]);
  });

  it('buildFinalRanking は同額を同順位にし、次の順位を人数分飛ばす(1,1,3)', () => {
    let state = setupState(3);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === '2' ? { ...p, netWorth: 5000 } : { ...p, netWorth: 12000 },
      ),
    };

    const ranking = buildFinalRanking(state);

    expect(ranking.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(ranking[2].playerId).toBe('2');
  });
});
