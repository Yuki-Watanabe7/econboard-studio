import { describe, expect, it } from 'vitest';
import { buyProperty } from '../rules/property';
import { updatePlayer } from '../rules/helpers';
import { INITIAL_CASH } from '../initialState';
import { giveProperty, setupState } from './testUtils';

// プレイヤー0 は初期状態で「セントラル」にいる
const BAKERY = 'prop-central-bakery'; // セントラルの物件・価格 1200G

describe('buyProperty', () => {
  it('現金・所有者・保有物件リストが更新される', () => {
    const state = setupState();
    const result = buyProperty(state, '0', BAKERY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players.find((p) => p.id === '0');
    const property = result.state.properties.find((p) => p.id === BAKERY);

    expect(player?.cash).toBe(INITIAL_CASH - 1200);
    expect(player?.ownedPropertyIds).toContain(BAKERY);
    expect(property?.ownerPlayerId).toBe('0');
  });

  it('購入しても総資産は変わらない(現金が資産に変わるだけ)', () => {
    const state = setupState();
    const result = buyProperty(state, '0', BAKERY);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const player = result.state.players.find((p) => p.id === '0');
    expect(player?.netWorth).toBe(INITIAL_CASH);
  });

  it('所持金が足りない場合は失敗する', () => {
    let state = setupState();
    state = updatePlayer(state, '0', (p) => ({ ...p, cash: 100 }));
    const result = buyProperty(state, '0', BAKERY);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('現金が足りない');
  });

  it('すでに所有されている物件は購入できない', () => {
    let state = setupState();
    state = giveProperty(state, '1', BAKERY);
    const result = buyProperty(state, '0', BAKERY);
    expect(result.ok).toBe(false);
  });

  it('現在いる駅以外の物件は購入できない', () => {
    const state = setupState(); // プレイヤー0 はセントラルにいる
    const result = buyProperty(state, '0', 'prop-harbor-seafood');
    expect(result.ok).toBe(false);
  });
});
