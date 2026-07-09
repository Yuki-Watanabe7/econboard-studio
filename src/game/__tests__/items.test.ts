import { describe, expect, it } from 'vitest';
import {
  MAX_INVENTORY_SIZE,
  acquireRandomItem,
  buyShopItem,
  grantItem,
  handleUseItem,
  isInventoryFull,
  isItemUsableNow,
  selectRandomItem,
} from '../rules/items';
import { updatePlayer } from '../rules/helpers';
import { getReachableStations } from '../rules/movement';
import { itemMassPool, sampleItems, sampleMap, shopOffers } from '../sampleData';
import { createInitialState } from '../initialState';
import type { ItemDefinition, ShopOffer } from '../types';
import { setupState } from './testUtils';

/** テスト用: プレイヤーの所持数を所持上限まで埋める */
function fillInventory(state = setupState(), playerId = '0') {
  let next = state;
  for (let i = 0; i < MAX_INVENTORY_SIZE; i++) {
    next = grantItem(next, playerId, 'grant-cash-small');
  }
  return next;
}

function shopOfferFor(itemId: string): ShopOffer {
  const offer = shopOffers.find((o) => o.itemId === itemId);
  if (!offer) throw new Error(`ショップ品揃え ${itemId} が見つからない`);
  return offer;
}

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

describe('selectRandomItem', () => {
  it('入手候補が空なら null を返す', () => {
    expect(selectRandomItem([], () => 0)).toBeNull();
  });

  it('乱数が最小のとき先頭の候補を選ぶ', () => {
    expect(selectRandomItem(itemMassPool, () => 0)).toBe(itemMassPool[0]);
  });

  it('乱数が最大のとき末尾の候補を選ぶ', () => {
    expect(selectRandomItem(itemMassPool, () => 0.9999)).toBe(itemMassPool.at(-1));
  });
});

describe('isInventoryFull', () => {
  it('所持数が上限未満なら false、上限に達したら true', () => {
    const state = setupState();
    expect(isInventoryFull(state.players[0])).toBe(false);
    const full = fillInventory(state);
    expect(isInventoryFull(full.players[0])).toBe(true);
  });
});

describe('acquireRandomItem(アイテム入手マス)', () => {
  it('入手候補から1つを付与し、ログに残す', () => {
    const state = setupState();
    const result = acquireRandomItem(state, '0', sampleItems, itemMassPool, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 乱数 0 → itemMassPool[0] = 'grant-cash-small'
    expect(result.state.players[0].inventory).toHaveLength(1);
    expect(result.state.players[0].inventory[0].itemId).toBe(itemMassPool[0]);
    expect(result.state.logs.some((l) => l.type === 'item' && l.message.includes('入手'))).toBe(
      true,
    );
  });

  it('乱数を固定すると入手アイテムを再現できる', () => {
    const state = setupState();
    const first = acquireRandomItem(state, '0', sampleItems, itemMassPool, () => 0.9999);
    const second = acquireRandomItem(state, '0', sampleItems, itemMassPool, () => 0.9999);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.state.players[0].inventory[0].itemId).toBe(itemMassPool.at(-1));
    expect(first.state.players[0].inventory[0].itemId).toBe(
      second.state.players[0].inventory[0].itemId,
    );
  });

  it('所持上限に達している場合はアイテムが増えず、その旨をログに残す', () => {
    const state = fillInventory();
    const result = acquireRandomItem(state, '0', sampleItems, itemMassPool, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toHaveLength(MAX_INVENTORY_SIZE);
    expect(result.state.logs.some((l) => l.message.includes('所持上限'))).toBe(true);
  });

  it('破産しているプレイヤーは入手しない(状態は変化しない)', () => {
    let state = setupState();
    state = updatePlayer(state, '0', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));
    const result = acquireRandomItem(state, '0', sampleItems, itemMassPool, () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toHaveLength(0);
    expect(result.state.logs).toHaveLength(state.logs.length);
  });

  it('入手候補が空なら何もしない', () => {
    const state = setupState();
    const result = acquireRandomItem(state, '0', sampleItems, [], () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].inventory).toHaveLength(0);
  });

  it('存在しないプレイヤーは失敗する', () => {
    const result = acquireRandomItem(setupState(), '9', sampleItems, itemMassPool, () => 0);
    expect(result.ok).toBe(false);
  });
});

describe('buyShopItem(ショップマス)', () => {
  it('購入すると現金が減り、アイテムが増える', () => {
    const state = setupState();
    const offer = shopOfferFor('double-dice');
    const before = state.players[0];

    const result = buyShopItem(state, '0', offer, sampleItems);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players[0];
    expect(player.cash).toBe(before.cash - offer.price);
    expect(player.inventory).toHaveLength(1);
    expect(player.inventory[0].itemId).toBe('double-dice');
  });

  it('総資産が支払い分だけ再計算される', () => {
    const state = setupState();
    const offer = shopOfferFor('double-dice');
    const before = state.players[0];

    const result = buyShopItem(state, '0', offer, sampleItems);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].netWorth).toBe(before.netWorth - offer.price);
  });

  it('購入と支払いがログに残る(支払いは chargePlayer を再利用)', () => {
    const state = setupState();
    const offer = shopOfferFor('double-dice');

    const result = buyShopItem(state, '0', offer, sampleItems);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.logs.some((l) => l.type === 'item' && l.message.includes('購入'))).toBe(
      true,
    );
    expect(
      result.state.logs.some((l) => l.type === 'settlement' && l.message.includes('支払')),
    ).toBe(true);
  });

  it('現金が足りない場合は購入できない(破産させない)', () => {
    let state = setupState();
    const offer = shopOfferFor('double-dice');
    state = updatePlayer(state, '0', (p) => ({ ...p, cash: offer.price - 1 }));

    const result = buyShopItem(state, '0', offer, sampleItems);

    expect(result.ok).toBe(false);
  });

  it('所持上限に達している場合は購入できない', () => {
    const state = fillInventory();
    const offer = shopOfferFor('double-dice');

    const result = buyShopItem(state, '0', offer, sampleItems);

    expect(result.ok).toBe(false);
  });

  it('破産しているプレイヤーは購入できない', () => {
    let state = setupState();
    state = updatePlayer(state, '0', (p) => ({ ...p, status: { ...p.status, bankrupt: true } }));
    const offer = shopOfferFor('double-dice');

    const result = buyShopItem(state, '0', offer, sampleItems);

    expect(result.ok).toBe(false);
  });

  it('存在しないアイテムの品揃えは購入できない', () => {
    const state = setupState();
    const result = buyShopItem(state, '0', { itemId: 'no-such-item', price: 100 }, sampleItems);
    expect(result.ok).toBe(false);
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
