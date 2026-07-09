import { describe, expect, it } from 'vitest';
import { grantItem, handleUseItem, isItemUsableNow } from '../rules/items';
import { updatePlayer } from '../rules/helpers';
import { getReachableStations } from '../rules/movement';
import { sampleItems, sampleMap } from '../sampleData';
import { createInitialState } from '../initialState';
import type { ItemDefinition } from '../types';
import { setupState } from './testUtils';

/** rollDice(0.4)=3, rollDice(0.75)=5 になる乱数列(合計8) */
function fixedRandomSequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++];
}

function itemById(id: string): ItemDefinition {
  const item = sampleItems.find((i) => i.id === id);
  if (!item) throw new Error(`アイテム ${id} が見つからない`);
  return item;
}

describe('createInitialState の初期所持アイテム', () => {
  it('指定したアイテムを全プレイヤーに持たせられる', () => {
    const state = createInitialState(2, { startingItemIds: ['grant-cash-small'] });
    for (const player of state.players) {
      expect(player.inventory).toHaveLength(1);
      expect(player.inventory[0].itemId).toBe('grant-cash-small');
    }
  });

  it('startingItemIds を空にすればアイテムを持たない', () => {
    const state = createInitialState(2, { startingItemIds: [] });
    for (const player of state.players) {
      expect(player.inventory).toEqual([]);
    }
  });
});

describe('grantItem', () => {
  it('所持インスタンスを追加し、インスタンス ID を採番する', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    state = grantItem(state, '0', 'grant-cash-small');

    expect(state.players[0].inventory).toHaveLength(2);
    const [first, second] = state.players[0].inventory;
    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.itemId).toBe('grant-cash-small');
  });
});

describe('isItemUsableNow', () => {
  const grantCashSmall = itemById('grant-cash-small');

  it('usableTimings に対応する turnStage では true', () => {
    expect(isItemUsableNow(grantCashSmall, 'idle')).toBe(true); // beforeRoll
  });

  it('usableTimings に対応しない turnStage では false', () => {
    expect(isItemUsableNow(grantCashSmall, 'awaitingDestination')).toBe(false); // afterRoll
    expect(isItemUsableNow(grantCashSmall, 'arrived')).toBe(false); // afterArrival
  });
});

describe('handleUseItem', () => {
  it('使用すると効果が発生し、現金と総資産が更新される', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const before = state.players[0];

    const result = handleUseItem(
      state,
      '0',
      state.players[0].inventory[0].instanceId,
      sampleItems,
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players[0];
    expect(player.cash).toBe(before.cash + 500);
    expect(player.netWorth).toBe(before.netWorth + 500);
  });

  it('使用後はインベントリから消費される', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toEqual([]);
  });

  it('使用結果がログに残る', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.state.logs.some((l) => l.type === 'item' && l.message.includes('臨時収入の書類')),
    ).toBe(true);
  });

  it('使用可能タイミング外では使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = { ...state, turnStage: 'awaitingDestination' };

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('破産しているプレイヤーは使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = updatePlayer(state, '0', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('ゲーム終了後は使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = { ...state, gameOver: true };

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('所持していないアイテムは使用できない', () => {
    const state = setupState();
    const result = handleUseItem(state, '0', 'no-such-instance', sampleItems, () => 0);
    expect(result.ok).toBe(false);
  });

  it('存在しないプレイヤーは使用できない', () => {
    const state = setupState();
    const result = handleUseItem(state, '9', 'no-such-instance', sampleItems, () => 0);
    expect(result.ok).toBe(false);
  });
});

describe('handleUseItem — 複数サイコロ系アイテム(double-dice/triple-dice)', () => {
  it('固定乱数で2個サイコロの合計が期待値になる', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(
      state,
      '0',
      instanceId,
      sampleItems,
      fixedRandomSequence([0.4, 0.75]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastDiceRolls).toEqual([3, 5]);
    expect(result.state.lastDiceRoll).toBe(8);
  });

  it('合計歩数に基づいて到達可能駅が計算される', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    // rollDice(0) は常に1を返すので、2個で合計2歩
    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.reachableStationIds).toEqual(getReachableStations(sampleMap, 'central', 2));
  });

  it('使用後 turnStage が awaitingDestination になる', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnStage).toBe('awaitingDestination');
  });

  it('使用後はインベントリから消費される', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toEqual([]);
  });

  it('ログに個別の出目と合計が表示される', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(
      state,
      '0',
      instanceId,
      sampleItems,
      fixedRandomSequence([0.4, 0.75]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.logs.some((l) => l.message.includes('3 + 5 = 8'))).toBe(true);
  });

  it('triple-dice は3個のサイコロを振る', () => {
    let state = setupState();
    state = grantItem(state, '0', 'triple-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastDiceRolls).toEqual([1, 1, 1]);
    expect(result.state.lastDiceRoll).toBe(3);
  });

  it('サイコロ後(awaitingDestination)には double-dice を使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = { ...state, turnStage: 'awaitingDestination' };

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('ゲーム終了後は使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = { ...state, gameOver: true };

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('破産しているプレイヤーは使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'double-dice');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = updatePlayer(state, '0', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });
});

describe('handleUseItem — サイコロの振り直し(reroll-dice)', () => {
  it('直前のサイコロと同じ個数を振り直し、到達可能駅を再計算する', () => {
    let state = setupState();
    state = grantItem(state, '0', 'reroll-dice');
    state = { ...state, turnStage: 'awaitingDestination', lastDiceRolls: [3, 5], lastDiceRoll: 8 };
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(
      state,
      '0',
      instanceId,
      sampleItems,
      fixedRandomSequence([0.1, 0.6]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastDiceRolls).toEqual([1, 4]);
    expect(result.state.lastDiceRoll).toBe(5);
    expect(result.state.reachableStationIds).toEqual(getReachableStations(sampleMap, 'central', 5));
  });

  it('使用後はインベントリから消費される', () => {
    let state = setupState();
    state = grantItem(state, '0', 'reroll-dice');
    state = { ...state, turnStage: 'awaitingDestination', lastDiceRolls: [4], lastDiceRoll: 4 };
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toEqual([]);
  });

  it('サイコロを振る前(idle)には使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'reroll-dice');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('ゲーム終了後は使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'reroll-dice');
    state = {
      ...state,
      turnStage: 'awaitingDestination',
      lastDiceRolls: [4],
      lastDiceRoll: 4,
      gameOver: true,
    };
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });

  it('破産しているプレイヤーは使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'reroll-dice');
    state = { ...state, turnStage: 'awaitingDestination', lastDiceRolls: [4], lastDiceRoll: 4 };
    state = updatePlayer(state, '0', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems, () => 0);

    expect(result.ok).toBe(false);
  });
});
