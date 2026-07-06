import { describe, expect, it } from 'vitest';
import { resolveStationArrival, selectEconomicEvent } from '../rules/stationEffects';
import { movePlayer } from '../rules/movement';
import { calculatePropertyIncome } from '../rules/economy';
import { recalculateAllNetWorth } from '../rules/settlement';
import { sampleEvents } from '../sampleData';
import type { GameState, StationId } from '../types';
import { giveProperty, setupState } from './testUtils';

/** プレイヤー0 を指定駅へ移動させた直後の状態を作る */
function arriveAt(stationId: StationId, state: GameState = setupState()): GameState {
  const moved = movePlayer(state, '0', stationId);
  if (!moved.ok) throw new Error(moved.reason);
  return moved.state;
}

describe('selectEconomicEvent', () => {
  it('イベントが未登録なら null を返す', () => {
    expect(selectEconomicEvent([], () => 0)).toBeNull();
  });

  it('乱数が最小のとき先頭のイベントを選ぶ', () => {
    expect(selectEconomicEvent(sampleEvents, () => 0)?.id).toBe(sampleEvents[0].id);
  });

  it('乱数が最大のとき末尾のイベントを選ぶ', () => {
    expect(selectEconomicEvent(sampleEvents, () => 0.9999)?.id).toBe(sampleEvents.at(-1)?.id);
  });
});

describe('resolveStationArrival', () => {
  it('通常駅に到着してもイベントは発生しない', () => {
    // riverside は stationType: 'normal'
    const state = arriveAt('riverside');
    const result = resolveStationArrival(state, '0', sampleEvents, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.economicState.activeModifiers).toHaveLength(0);
    expect(result.state.logs).toHaveLength(state.logs.length);
  });

  it('イベント駅に到着すると経済イベントが発生し、modifier とログが追加される', () => {
    // harbor は stationType: 'event'。乱数 0 → sampleEvents[0](ベイサイド好況)
    const state = arriveAt('harbor');
    const result = resolveStationArrival(state, '0', sampleEvents, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.economicState.activeModifiers.length).toBeGreaterThan(0);
    expect(result.state.economicState.activeModifiers[0].sourceEventId).toBe('ev-bayside-boom');
    const lastLog = result.state.logs.at(-1);
    expect(lastLog?.type).toBe('economy');
    expect(lastLog?.message).toContain('ベイサイド好況');
  });

  it('乱数を固定すると発生イベントを再現できる', () => {
    const state = arriveAt('harbor');
    const first = resolveStationArrival(state, '0', sampleEvents, () => 0.9999);
    const second = resolveStationArrival(state, '0', sampleEvents, () => 0.9999);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state.economicState.activeModifiers[0].sourceEventId).toBe('ev-retail-slump');
    expect(first.state.economicState.activeModifiers).toEqual(
      second.state.economicState.activeModifiers,
    );
  });

  it('イベントが未登録ならイベント駅でも何も起きない', () => {
    const state = arriveAt('harbor');
    const result = resolveStationArrival(state, '0', [], () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.economicState.activeModifiers).toHaveLength(0);
  });

  it('存在しないプレイヤーの到着解決は失敗する', () => {
    const result = resolveStationArrival(setupState(), '9', sampleEvents, () => 0);
    expect(result.ok).toBe(false);
  });

  it('発生した収益率イベントが物件の年間収益に反映される', () => {
    // ベイサイド好況(収益率 1.5 倍)を harbor 到着で発生させる
    const state = arriveAt('harbor');
    const result = resolveStationArrival(state, '0', sampleEvents, () => 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const warehouse = result.state.properties.find((p) => p.id === 'prop-harbor-warehouse')!;
    const income = calculatePropertyIncome(warehouse, 'bayside', result.state.economicState);
    expect(income).toBe(Math.round(3000 * 0.13 * 1.5)); // 585(基礎 390 の 1.5 倍)
  });

  it('発生した評価額イベントが総資産に反映される', () => {
    // 小売不況(評価額 0.7 倍)を harbor 到着で発生させる
    let state = giveProperty(setupState(), '0', 'prop-harbor-ferry-shop'); // retail / 価格 1300
    state = arriveAt('harbor', state);
    const result = resolveStationArrival(state, '0', sampleEvents, () => 0.9999);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const next = recalculateAllNetWorth(result.state);
    const player = next.players.find((p) => p.id === '0')!;
    expect(player.netWorth).toBe(player.cash + Math.round(1300 * 0.7));
  });
});
