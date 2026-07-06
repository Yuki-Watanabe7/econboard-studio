import { describe, expect, it } from 'vitest';
import {
  DESTINATION_REWARD,
  calculateDestinationReward,
  resolveDestinationArrival,
  selectDestinationStation,
} from '../rules/destination';
import { createInitialState, START_STATION_ID } from '../initialState';
import { movePlayer } from '../rules/movement';
import { sampleMap } from '../sampleData';
import type { GameState } from '../types';
import { setupState } from './testUtils';

/** プレイヤー0 を現在の目的地へ移動させた直後の状態を作る */
function arriveAtDestination(state: GameState = setupState()): GameState {
  const moved = movePlayer(state, '0', state.currentDestinationStationId);
  if (!moved.ok) throw new Error(moved.reason);
  return moved.state;
}

describe('selectDestinationStation', () => {
  it('駅が存在しなければ null を返す', () => {
    expect(selectDestinationStation([], () => 0)).toBeNull();
  });

  it('除外指定した駅は選ばれない', () => {
    const excluded = sampleMap.stations.map((s) => s.id).slice(1);
    const selected = selectDestinationStation(sampleMap.stations, () => 0.5, excluded);
    expect(selected).toBe(sampleMap.stations[0].id);
  });

  it('すべての駅を除外すると null を返す', () => {
    const allIds = sampleMap.stations.map((s) => s.id);
    expect(selectDestinationStation(sampleMap.stations, () => 0, allIds)).toBeNull();
  });

  it('乱数を固定すると抽選結果を再現できる', () => {
    const first = selectDestinationStation(sampleMap.stations, () => 0.7);
    const second = selectDestinationStation(sampleMap.stations, () => 0.7);
    expect(first).toBe(second);
  });

  it('乱数が最小のとき先頭候補、最大のとき末尾候補を選ぶ', () => {
    expect(selectDestinationStation(sampleMap.stations, () => 0)).toBe(sampleMap.stations[0].id);
    expect(selectDestinationStation(sampleMap.stations, () => 0.9999)).toBe(
      sampleMap.stations.at(-1)?.id,
    );
  });
});

describe('createInitialState(目的地)', () => {
  it('初期状態で目的地が設定されており、実在する駅を指す', () => {
    const state = setupState();
    const station = state.map.stations.find((s) => s.id === state.currentDestinationStationId);
    expect(station).toBeDefined();
  });

  it('スタート駅は最初の目的地に選ばれない', () => {
    // 乱数を全域で走査しても常にスタート駅以外が選ばれる
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const state = createInitialState(2, {}, () => r);
      expect(state.currentDestinationStationId).not.toBe(START_STATION_ID);
    }
  });

  it('最初の目的地のログが残る', () => {
    const state = setupState();
    const log = state.logs.find((l) => l.type === 'destination');
    expect(log?.message).toContain('最初の目的地');
  });
});

describe('calculateDestinationReward', () => {
  it('MVP では固定額を返す', () => {
    expect(calculateDestinationReward(setupState(), '0')).toBe(DESTINATION_REWARD);
  });

  it('存在しないプレイヤーには 0 を返す', () => {
    expect(calculateDestinationReward(setupState(), '9')).toBe(0);
  });
});

describe('resolveDestinationArrival', () => {
  it('目的地以外の駅に到着しても何も起きない', () => {
    const state = setupState();
    // スタート駅は目的地ではない(初期抽選で除外される)
    const result = resolveDestinationArrival(state, '0', () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].cash).toBe(state.players[0].cash);
    expect(result.state.currentDestinationStationId).toBe(state.currentDestinationStationId);
    expect(result.state.logs).toHaveLength(state.logs.length);
  });

  it('目的地に到着すると現金が増え、総資産が再計算される', () => {
    const state = arriveAtDestination();
    const result = resolveDestinationArrival(state, '0', () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players[0];
    expect(player.cash).toBe(state.players[0].cash + DESTINATION_REWARD);
    expect(player.netWorth).toBe(player.cash); // 物件未所有なので総資産 = 現金
  });

  it('目的地に到着すると到着ログが残る', () => {
    const state = arriveAtDestination();
    const result = resolveDestinationArrival(state, '0', () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const arrivalLog = result.state.logs.find(
      (l) => l.type === 'destination' && l.message.includes('到着'),
    );
    expect(arrivalLog?.message).toContain(`${DESTINATION_REWARD.toLocaleString()}G`);
    expect(arrivalLog?.playerId).toBe('0');
  });

  it('到着後に次の目的地が抽選され、直前と同じ駅は選ばれない', () => {
    const state = arriveAtDestination();
    const previousDestination = state.currentDestinationStationId;

    // 乱数を全域で走査しても直前の目的地は選ばれない
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const result = resolveDestinationArrival(state, '0', () => r);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.currentDestinationStationId).not.toBe(previousDestination);
      const nextLog = result.state.logs.at(-1);
      expect(nextLog?.type).toBe('destination');
      expect(nextLog?.message).toContain('次の目的地');
    }
  });

  it('乱数を固定すると次の目的地の抽選を再現できる', () => {
    const state = arriveAtDestination();
    const first = resolveDestinationArrival(state, '0', () => 0.6);
    const second = resolveDestinationArrival(state, '0', () => 0.6);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state.currentDestinationStationId).toBe(second.state.currentDestinationStationId);
  });

  it('ゲーム終了後は目的地処理が発生しない', () => {
    const state: GameState = { ...arriveAtDestination(), gameOver: true };
    const result = resolveDestinationArrival(state, '0', () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toBe(state);
  });

  it('存在しないプレイヤーの到着解決は失敗する', () => {
    const result = resolveDestinationArrival(setupState(), '9', () => 0);
    expect(result.ok).toBe(false);
  });
});
