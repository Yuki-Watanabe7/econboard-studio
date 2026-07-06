import { describe, expect, it } from 'vitest';
import { acceptTradeOffer, createTradeOffer, rejectTradeOffer } from '../rules/trade';
import { INITIAL_CASH } from '../initialState';
import { giveProperty, setupState } from './testUtils';
import type { GameState } from '../types';

const BAKERY = 'prop-central-bakery';
const SEAFOOD = 'prop-harbor-seafood';

/** プレイヤー1 が海鮮食堂を持っている状態で、プレイヤー0 が「現金2000Gで譲って」と提案する */
function setupWithOffer(): GameState {
  let state = setupState();
  state = giveProperty(state, '1', SEAFOOD);
  const result = createTradeOffer(state, {
    fromPlayerId: '0',
    toPlayerId: '1',
    offeredCash: 2000,
    requestedCash: 0,
    offeredPropertyIds: [],
    requestedPropertyIds: [SEAFOOD],
  });
  if (!result.ok) throw new Error(`オファー作成に失敗: ${result.reason}`);
  return result.state;
}

describe('createTradeOffer', () => {
  it('pending 状態のオファーが作成される', () => {
    const state = setupWithOffer();
    const offer = state.pendingTradeOffer;

    expect(offer).not.toBeNull();
    expect(offer?.status).toBe('pending');
    expect(offer?.fromPlayerId).toBe('0');
    expect(offer?.toPlayerId).toBe('1');
    expect(offer?.offeredCash).toBe(2000);
    expect(offer?.requestedPropertyIds).toEqual([SEAFOOD]);
    expect(offer?.expiresOnTurn).toBe(state.turnNumber + state.players.length);
  });

  it('相手が所有していない物件は要求できない', () => {
    const state = setupState(); // 誰も物件を持っていない
    const result = createTradeOffer(state, {
      fromPlayerId: '0',
      toPlayerId: '1',
      offeredCash: 2000,
      requestedCash: 0,
      offeredPropertyIds: [],
      requestedPropertyIds: [SEAFOOD],
    });
    expect(result.ok).toBe(false);
  });

  it('自分が所有していない物件は提示できない', () => {
    const state = setupState();
    const result = createTradeOffer(state, {
      fromPlayerId: '0',
      toPlayerId: '1',
      offeredCash: 0,
      requestedCash: 0,
      offeredPropertyIds: [BAKERY],
      requestedPropertyIds: [],
    });
    expect(result.ok).toBe(false);
  });

  it('未解決のオファーがあるときは新規作成できない', () => {
    const state = setupWithOffer();
    const result = createTradeOffer(state, {
      fromPlayerId: '1',
      toPlayerId: '0',
      offeredCash: 100,
      requestedCash: 0,
      offeredPropertyIds: [],
      requestedPropertyIds: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('acceptTradeOffer', () => {
  it('現金と物件の所有権が交換される', () => {
    const state = setupWithOffer();
    const result = acceptTradeOffer(state, state.pendingTradeOffer!.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const p0 = result.state.players.find((p) => p.id === '0');
    const p1 = result.state.players.find((p) => p.id === '1');
    const seafood = result.state.properties.find((p) => p.id === SEAFOOD);

    expect(p0?.cash).toBe(INITIAL_CASH - 2000);
    expect(p1?.cash).toBe(INITIAL_CASH + 2000);
    expect(p0?.ownedPropertyIds).toContain(SEAFOOD);
    expect(p1?.ownedPropertyIds).not.toContain(SEAFOOD);
    expect(seafood?.ownerPlayerId).toBe('0');
    expect(result.state.pendingTradeOffer).toBeNull();
  });

  it('期限切れのオファーは受諾できない', () => {
    const state = setupWithOffer();
    const expired = { ...state, turnNumber: state.pendingTradeOffer!.expiresOnTurn + 1 };
    const result = acceptTradeOffer(expired, expired.pendingTradeOffer!.id);
    expect(result.ok).toBe(false);
  });

  it('存在しないオファー ID は受諾できない', () => {
    const state = setupWithOffer();
    const result = acceptTradeOffer(state, 'trade-999');
    expect(result.ok).toBe(false);
  });
});

describe('rejectTradeOffer', () => {
  it('オファーが取り下げられ、状態は変化しない', () => {
    const state = setupWithOffer();
    const result = rejectTradeOffer(state, state.pendingTradeOffer!.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingTradeOffer).toBeNull();

    // 現金・所有権は元のまま
    const p0 = result.state.players.find((p) => p.id === '0');
    const seafood = result.state.properties.find((p) => p.id === SEAFOOD);
    expect(p0?.cash).toBe(INITIAL_CASH);
    expect(seafood?.ownerPlayerId).toBe('1');
  });
});
