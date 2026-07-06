import { describe, expect, it } from 'vitest';
import { getReachableStations, movePlayer, rollDice } from '../rules/movement';
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
