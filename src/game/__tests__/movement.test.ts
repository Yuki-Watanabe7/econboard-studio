import { describe, expect, it } from 'vitest';
import {
  applyDiceRoll,
  getReachableStations,
  movePlayer,
  rollDice,
  rollMultipleDice,
} from '../rules/movement';
import { sampleMap } from '../sampleData';
import { lineMap, setupState } from './testUtils';

describe('rollDice', () => {
  it('乱数が最小のとき 1 を返す', () => {
    expect(rollDice(() => 0)).toBe(1);
  });

  it('乱数が最大のとき 6 を返す', () => {
    expect(rollDice(() => 0.9999)).toBe(6);
  });

  it('面数を指定できる', () => {
    expect(rollDice(() => 0.9999, 8)).toBe(8);
  });
});

describe('rollMultipleDice', () => {
  it('指定した個数のサイコロを振り、個々の出目と合計を返す', () => {
    const values = [0.4, 0.75]; // rollDice: 3, 5
    let i = 0;
    const result = rollMultipleDice(() => values[i++], 2);
    expect(result.rolls).toEqual([3, 5]);
    expect(result.total).toBe(8);
  });

  it('1個のときは通常のサイコロと同じ', () => {
    const result = rollMultipleDice(() => 0, 1);
    expect(result.rolls).toEqual([1]);
    expect(result.total).toBe(1);
  });
});

describe('applyDiceRoll', () => {
  it('合計歩数から到達可能駅を計算し、turnStage を awaitingDestination にする', () => {
    const state = setupState();
    const result = applyDiceRoll(state, '0', 2, () => 0); // 1 + 1 = 2

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastDiceRolls).toEqual([1, 1]);
    expect(result.state.lastDiceRoll).toBe(2);
    expect(result.state.turnStage).toBe('awaitingDestination');
    expect(result.state.reachableStationIds).toEqual(getReachableStations(sampleMap, 'central', 2));
  });

  it('個々の出目と合計をログに残す', () => {
    const values = [0.4, 0.75]; // 3, 5
    let i = 0;
    const state = setupState();
    const result = applyDiceRoll(state, '0', 2, () => values[i++]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.logs.at(-1)?.message).toContain('3 + 5 = 8');
  });

  it('存在しないプレイヤーは失敗する', () => {
    const state = setupState();
    const result = applyDiceRoll(state, '9', 2, () => 0);
    expect(result.ok).toBe(false);
  });
});

describe('getReachableStations', () => {
  it('1歩なら隣接駅に到達できる', () => {
    expect(getReachableStations(lineMap, 'A', 1)).toEqual(['B']);
  });

  it('直線マップで2歩なら2つ先の駅だけに到達する(すぐ引き返せない)', () => {
    // A → B → A は「直前の駅へ引き返す」移動なので許可されない
    expect(getReachableStations(lineMap, 'A', 2)).toEqual(['C']);
  });

  it('行き止まりの駅では折り返しができる', () => {
    // B → A(行き止まり)→ B と、B → C → D の2通り
    expect(getReachableStations(lineMap, 'B', 2)).toEqual(['B', 'D']);
  });

  it('0歩なら現在駅を返す', () => {
    expect(getReachableStations(lineMap, 'B', 0)).toEqual(['B']);
  });

  it('サンプルマップのセントラルから1歩で3方向に分岐できる', () => {
    expect(getReachableStations(sampleMap, 'central', 1)).toEqual([
      'market-street',
      'riverside',
      'university',
    ]);
  });
});

describe('movePlayer', () => {
  it('プレイヤーの現在駅を更新し、ログを残す', () => {
    const state = setupState();
    const result = movePlayer(state, '0', 'harbor');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players.find((p) => p.id === '0');
    expect(player?.currentStationId).toBe('harbor');
    expect(result.state.logs.at(-1)?.message).toContain('ハーバー');
  });

  it('存在しない駅への移動は失敗する', () => {
    const state = setupState();
    const result = movePlayer(state, '0', 'no-such-station');
    expect(result.ok).toBe(false);
  });

  it('存在しないプレイヤーの移動は失敗する', () => {
    const state = setupState();
    const result = movePlayer(state, '9', 'harbor');
    expect(result.ok).toBe(false);
  });
});
