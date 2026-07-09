import { describe, expect, it } from 'vitest';
import { grantItem, handleUseItem, isItemUsableNow } from '../rules/items';
import { updatePlayer } from '../rules/helpers';
import { sampleItems } from '../sampleData';
import { createInitialState } from '../initialState';
import type { ItemDefinition } from '../types';
import { setupState } from './testUtils';

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

    const result = handleUseItem(state, '0', state.players[0].inventory[0].instanceId, sampleItems);

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

    const result = handleUseItem(state, '0', instanceId, sampleItems);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toEqual([]);
  });

  it('使用結果がログに残る', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;

    const result = handleUseItem(state, '0', instanceId, sampleItems);

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

    const result = handleUseItem(state, '0', instanceId, sampleItems);

    expect(result.ok).toBe(false);
  });

  it('破産しているプレイヤーは使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = updatePlayer(state, '0', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));

    const result = handleUseItem(state, '0', instanceId, sampleItems);

    expect(result.ok).toBe(false);
  });

  it('ゲーム終了後は使用できない', () => {
    let state = setupState();
    state = grantItem(state, '0', 'grant-cash-small');
    const instanceId = state.players[0].inventory[0].instanceId;
    state = { ...state, gameOver: true };

    const result = handleUseItem(state, '0', instanceId, sampleItems);

    expect(result.ok).toBe(false);
  });

  it('所持していないアイテムは使用できない', () => {
    const state = setupState();
    const result = handleUseItem(state, '0', 'no-such-instance', sampleItems);
    expect(result.ok).toBe(false);
  });

  it('存在しないプレイヤーは使用できない', () => {
    const state = setupState();
    const result = handleUseItem(state, '9', 'no-such-instance', sampleItems);
    expect(result.ok).toBe(false);
  });
});
