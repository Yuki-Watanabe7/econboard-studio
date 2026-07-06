import { describe, expect, it } from 'vitest';
import { applyCashEvent, findPoorestPlayer, selectCashEvent } from '../rules/cashEvents';
import { resolveStationArrival } from '../rules/stationEffects';
import { movePlayer } from '../rules/movement';
import { updatePlayer } from '../rules/helpers';
import { sampleCashEvents, sampleEvents } from '../sampleData';
import type { CashEvent, GameState, PlayerId, StationId } from '../types';
import { giveProperty, setupState } from './testUtils';

function cashEventById(id: string): CashEvent {
  const event = sampleCashEvents.find((e) => e.id === id);
  if (!event) throw new Error(`所持金イベント ${id} が見つからない`);
  return event;
}

function setCash(state: GameState, playerId: PlayerId, cash: number): GameState {
  return updatePlayer(state, playerId, (p) => ({ ...p, cash, netWorth: cash }));
}

/** プレイヤー0 を指定駅へ移動させた直後の状態を作る */
function arriveAt(stationId: StationId, state: GameState = setupState()): GameState {
  const moved = movePlayer(state, '0', stationId);
  if (!moved.ok) throw new Error(moved.reason);
  return moved.state;
}

describe('selectCashEvent', () => {
  it('イベントが未登録なら null を返す', () => {
    expect(selectCashEvent([], () => 0)).toBeNull();
  });

  it('乱数が最小のとき先頭のイベントを選ぶ', () => {
    expect(selectCashEvent(sampleCashEvents, () => 0)?.id).toBe(sampleCashEvents[0].id);
  });

  it('乱数が最大のとき末尾のイベントを選ぶ', () => {
    expect(selectCashEvent(sampleCashEvents, () => 0.9999)?.id).toBe(sampleCashEvents.at(-1)?.id);
  });

  it('乱数を固定すると選択を再現できる', () => {
    const first = selectCashEvent(sampleCashEvents, () => 0.5);
    const second = selectCashEvent(sampleCashEvents, () => 0.5);
    expect(first).not.toBeNull();
    expect(first).toEqual(second);
  });
});

describe('applyCashEvent', () => {
  it('収入イベントで現金と総資産が増える', () => {
    const state = setupState();
    const before = state.players[0];
    const result = applyCashEvent(state, '0', cashEventById('cash-windfall'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players[0];
    expect(player.cash).toBe(before.cash + 1000);
    expect(player.netWorth).toBe(before.netWorth + 1000);
    expect(
      result.state.logs.some((l) => l.type === 'cashEvent' && l.message.includes('臨時収入')),
    ).toBe(true);
  });

  it('支払いイベントで現金と総資産が減る', () => {
    const state = setupState();
    const before = state.players[0];
    const result = applyCashEvent(state, '0', cashEventById('cash-local-tax'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players[0];
    expect(player.cash).toBe(before.cash - 1000);
    expect(player.netWorth).toBe(before.netWorth - 1000);
    expect(player.status.bankrupt).toBe(false);
    // 発生ログ + 支払いログ(chargePlayer)の両方が残る
    expect(
      result.state.logs.some((l) => l.type === 'cashEvent' && l.message.includes('地方税')),
    ).toBe(true);
    expect(
      result.state.logs.some(
        (l) => l.type === 'settlement' && l.message.includes('1000G を支払った'),
      ),
    ).toBe(true);
  });

  it('現金不足の支払いイベントで既存の破産処理が発動する', () => {
    let state = setupState();
    state = giveProperty(state, '0', 'prop-harbor-warehouse');
    state = setCash(state, '0', 500);
    const result = applyCashEvent(state, '0', cashEventById('cash-local-tax'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players[0];
    expect(player.status.bankrupt).toBe(true);
    expect(player.cash).toBe(0);
    expect(player.ownedPropertyIds).toEqual([]);
    // 保有物件は未所有に戻る(declareBankruptcy の清算)
    expect(
      result.state.properties.find((p) => p.id === 'prop-harbor-warehouse')?.ownerPlayerId,
    ).toBeNull();
  });

  it('保有物件数連動イベントは物件数 × 単価を支払う', () => {
    let state = setupState();
    state = giveProperty(state, '0', 'prop-harbor-warehouse');
    state = giveProperty(state, '0', 'prop-harbor-ferry-shop');
    const before = state.players[0];
    const result = applyCashEvent(state, '0', cashEventById('cash-maintenance'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 物件2件 × 300G = 600G
    expect(result.state.players[0].cash).toBe(before.cash - 600);
    expect(
      result.state.logs.some(
        (l) => l.type === 'settlement' && l.message.includes('600G を支払った'),
      ),
    ).toBe(true);
  });

  it('保有物件がなければ物件維持費の支払いは 0G になる', () => {
    const state = setupState();
    const before = state.players[0];
    const result = applyCashEvent(state, '0', cashEventById('cash-maintenance'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].cash).toBe(before.cash);
    expect(result.state.players[0].status.bankrupt).toBe(false);
  });

  it('資産税は物件評価額を含む総資産の割合で計算される', () => {
    let state = setupState();
    state = giveProperty(state, '0', 'prop-harbor-ferry-shop'); // 価格 1300
    const result = applyCashEvent(state, '0', cashEventById('cash-asset-tax'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 総資産 = 現金 10000 + 物件 1300 = 11300 → 5% = 565
    expect(result.state.players[0].cash).toBe(10000 - 565);
    expect(
      result.state.logs.some(
        (l) => l.type === 'settlement' && l.message.includes('565G を支払った'),
      ),
    ).toBe(true);
  });

  it('補助金は到着プレイヤーではなく現金最少のプレイヤーが受け取る', () => {
    let state = setupState(2);
    state = setCash(state, '1', 3000);
    const result = applyCashEvent(state, '0', cashEventById('cash-subsidy'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].cash).toBe(10000); // 発火したプレイヤーは変化しない
    expect(result.state.players[1].cash).toBe(3000 + 1500);
    expect(result.state.players[1].netWorth).toBe(3000 + 1500);
  });

  it('現金最少の判定から破産プレイヤーは除外される', () => {
    let state = setupState(3);
    state = setCash(state, '1', 0);
    state = updatePlayer(state, '1', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));
    state = setCash(state, '2', 5000);

    expect(findPoorestPlayer(state)?.id).toBe('2');
  });

  it('存在しないプレイヤーへの適用は失敗する', () => {
    const result = applyCashEvent(setupState(), '9', cashEventById('cash-windfall'));
    expect(result.ok).toBe(false);
  });
});

describe('resolveStationArrival(所持金イベント駅)', () => {
  it('所持金イベント駅に到着すると所持金イベントが発生する', () => {
    // old-town は stationType: 'cashEvent'。乱数 0 → sampleCashEvents[0](臨時収入)
    const state = arriveAt('old-town');
    const result = resolveStationArrival(state, '0', sampleEvents, sampleCashEvents, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].cash).toBe(state.players[0].cash + 1000);
    expect(result.state.economicState.activeModifiers).toHaveLength(0); // 経済イベントは発生しない
    const eventLog = result.state.logs.find((l) => l.type === 'cashEvent');
    expect(eventLog?.message).toContain('所持金イベント発生: 臨時収入');
  });

  it('乱数を固定すると発生イベントを再現できる', () => {
    const state = arriveAt('old-town');
    const first = resolveStationArrival(state, '0', sampleEvents, sampleCashEvents, () => 0.9999);
    const second = resolveStationArrival(state, '0', sampleEvents, sampleCashEvents, () => 0.9999);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state).toEqual(second.state);
    // 末尾のイベント(生活支援補助金)が選ばれる
    expect(first.state.logs.some((l) => l.message.includes('生活支援補助金'))).toBe(true);
  });

  it('イベントが未登録なら所持金イベント駅でも何も起きない', () => {
    const state = arriveAt('old-town');
    const result = resolveStationArrival(state, '0', sampleEvents, [], () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(state);
  });

  it('通常駅・経済イベント駅では所持金イベントは発生しない', () => {
    // riverside は normal、harbor は event
    for (const stationId of ['riverside', 'harbor'] as const) {
      const state = arriveAt(stationId);
      const result = resolveStationArrival(state, '0', sampleEvents, sampleCashEvents, () => 0);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.state.players[0].cash).toBe(state.players[0].cash);
      expect(result.state.logs.some((l) => l.type === 'cashEvent')).toBe(false);
    }
  });
});
