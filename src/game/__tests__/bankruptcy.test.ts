import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { chargePlayer, declareBankruptcy, solventPlayers } from '../rules/bankruptcy';
import { advanceMonth, buildFinalRanking, settleYear } from '../rules/settlement';
import { movePlayer } from '../rules/movement';
import { buyProperty } from '../rules/property';
import { acceptTradeOffer, createTradeOffer } from '../rules/trade';
import { updatePlayer } from '../rules/helpers';
import { INITIAL_CASH } from '../initialState';
import { EconBoardGame } from '../game';
import type { GameState, PlayerId } from '../types';
import { giveProperty, setupState } from './testUtils';

const BAKERY = 'prop-central-bakery'; // 価格 1200G
const SEAFOOD = 'prop-harbor-seafood'; // 価格 900G

/** テスト用: プレイヤーを破産させた状態を作る(3人ゲームなら続行される) */
function bankruptPlayer(state: GameState, playerId: PlayerId): GameState {
  const result = declareBankruptcy(state, playerId);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe('declareBankruptcy', () => {
  it('破産フラグが立ち、保有物件がすべて未所有に戻る', () => {
    let state = setupState(3);
    state = giveProperty(state, '0', BAKERY);
    state = giveProperty(state, '0', SEAFOOD);

    const next = bankruptPlayer(state, '0');

    const p0 = next.players.find((p) => p.id === '0')!;
    expect(p0.status.bankrupt).toBe(true);
    expect(p0.ownedPropertyIds).toEqual([]);
    // ownedPropertyIds と ownerPlayerId の整合性: どの物件も '0' を所有者にしていない
    expect(next.properties.every((p) => p.ownerPlayerId !== '0')).toBe(true);
    expect(next.properties.find((p) => p.id === BAKERY)?.ownerPlayerId).toBeNull();
    expect(next.properties.find((p) => p.id === SEAFOOD)?.ownerPlayerId).toBeNull();
  });

  it('破産後は総資産が再計算される(物件を失い現金のみになる)', () => {
    let state = setupState(3);
    state = giveProperty(state, '0', BAKERY);

    const next = bankruptPlayer(state, '0');

    const p0 = next.players.find((p) => p.id === '0')!;
    expect(p0.netWorth).toBe(p0.cash);
  });

  it('他プレイヤーの物件には影響しない', () => {
    let state = setupState(3);
    state = giveProperty(state, '0', BAKERY);
    state = giveProperty(state, '1', SEAFOOD);

    const next = bankruptPlayer(state, '0');

    expect(next.properties.find((p) => p.id === SEAFOOD)?.ownerPlayerId).toBe('1');
    expect(next.players.find((p) => p.id === '1')?.ownedPropertyIds).toEqual([SEAFOOD]);
  });

  it('すでに破産しているプレイヤーには適用できない', () => {
    const state = bankruptPlayer(setupState(3), '0');
    const result = declareBankruptcy(state, '0');
    expect(result.ok).toBe(false);
  });

  it('破産者が当事者の進行中トレードオファーは破棄される', () => {
    let state = setupState(3);
    const created = createTradeOffer(state, {
      fromPlayerId: '0',
      toPlayerId: '1',
      offeredCash: 100,
      requestedCash: 0,
      offeredPropertyIds: [],
      requestedPropertyIds: [],
    });
    if (!created.ok) throw new Error(created.reason);
    state = created.state;

    const next = bankruptPlayer(state, '1');
    expect(next.pendingTradeOffer).toBeNull();
  });

  it('3人中1人の破産ではゲームは続行する', () => {
    const next = bankruptPlayer(setupState(3), '0');
    expect(next.gameOver).toBe(false);
    expect(solventPlayers(next).map((p) => p.id)).toEqual(['1', '2']);
  });

  it('残り1人になったら即座にゲーム終了し、残ったプレイヤーが勝者になる', () => {
    let state = setupState(2);
    state = giveProperty(state, '1', BAKERY);

    const next = bankruptPlayer(state, '0');

    expect(next.gameOver).toBe(true);
    expect(next.winnerPlayerIds).toEqual(['1']);
    // 破産者は総資産に関わらず脱落扱いで下位になる
    expect(next.finalRanking.map((e) => e.playerId)).toEqual(['1', '0']);
    expect(next.finalRanking[1].bankrupt).toBe(true);
  });
});

describe('chargePlayer', () => {
  it('現金が足りる場合は全額を支払い、破産しない', () => {
    const state = setupState(3);
    const result = chargePlayer(state, '0', 3000, '修繕費');
    if (!result.ok) throw new Error(result.reason);

    const p0 = result.state.players.find((p) => p.id === '0')!;
    expect(p0.cash).toBe(INITIAL_CASH - 3000);
    expect(p0.status.bankrupt).toBe(false);
  });

  it('現金が不足する場合は払える分だけ支払って現金0になり、破産する', () => {
    let state = setupState(3);
    state = giveProperty(state, '0', BAKERY);

    const result = chargePlayer(state, '0', INITIAL_CASH + 5000, '災害復旧費');
    if (!result.ok) throw new Error(result.reason);

    const p0 = result.state.players.find((p) => p.id === '0')!;
    expect(p0.cash).toBe(0);
    expect(p0.status.bankrupt).toBe(true);
    expect(p0.ownedPropertyIds).toEqual([]);
    expect(result.state.properties.find((p) => p.id === BAKERY)?.ownerPlayerId).toBeNull();
  });

  it('ちょうど全額の支払いでは破産しない', () => {
    const state = setupState(3);
    const result = chargePlayer(state, '0', INITIAL_CASH, '一括支払い');
    if (!result.ok) throw new Error(result.reason);

    const p0 = result.state.players.find((p) => p.id === '0')!;
    expect(p0.cash).toBe(0);
    expect(p0.status.bankrupt).toBe(false);
  });

  it('破産済みプレイヤーへの請求は失敗する', () => {
    const state = bankruptPlayer(setupState(3), '0');
    const result = chargePlayer(state, '0', 100, 'テスト請求');
    expect(result.ok).toBe(false);
  });
});

describe('破産プレイヤーの行動制限', () => {
  it('移動できない', () => {
    const state = bankruptPlayer(setupState(3), '0');
    const result = movePlayer(state, '0', 'central');
    expect(result.ok).toBe(false);
  });

  it('物件を購入できない', () => {
    const state = bankruptPlayer(setupState(3), '0');
    // 現在駅(central)の物件でも購入できないことを確認する
    const property = state.properties.find((p) => p.stationId === 'central')!;
    const result = buyProperty(state, '0', property.id);
    expect(result.ok).toBe(false);
  });

  it('トレードを作成できない(提案者・相手のどちらでも)', () => {
    const state = bankruptPlayer(setupState(3), '0');
    const input = {
      offeredCash: 100,
      requestedCash: 0,
      offeredPropertyIds: [],
      requestedPropertyIds: [],
    };
    expect(createTradeOffer(state, { ...input, fromPlayerId: '0', toPlayerId: '1' }).ok).toBe(
      false,
    );
    expect(createTradeOffer(state, { ...input, fromPlayerId: '1', toPlayerId: '0' }).ok).toBe(
      false,
    );
  });

  it('オファー作成後に当事者が破産した場合は受諾できない', () => {
    let state = setupState(3);
    const created = createTradeOffer(state, {
      fromPlayerId: '0',
      toPlayerId: '1',
      offeredCash: 100,
      requestedCash: 0,
      offeredPropertyIds: [],
      requestedPropertyIds: [],
    });
    if (!created.ok) throw new Error(created.reason);
    const offerId = created.state.pendingTradeOffer!.id;
    // トレード破棄処理を通さず破産状態のみ再現する(受諾側ガードの単体検証)
    state = updatePlayer(created.state, '0', (p) => ({
      ...p,
      status: { ...p.status, bankrupt: true },
    }));

    expect(acceptTradeOffer(state, offerId).ok).toBe(false);
  });
});

describe('破産プレイヤーがいる状態の決算処理', () => {
  it('年次決算で破産者は収益を受け取らない', () => {
    let state = setupState(3);
    state = giveProperty(state, '1', BAKERY); // 年間収益 144G
    state = bankruptPlayer(state, '0');

    const settled = settleYear(state);

    expect(settled.players.find((p) => p.id === '0')?.cash).toBe(INITIAL_CASH);
    expect(settled.players.find((p) => p.id === '1')?.cash).toBe(INITIAL_CASH + 144);
  });

  it('月次・年次処理(advanceMonth)が破産者込みでも壊れない', () => {
    let state = bankruptPlayer(setupState(3), '0');
    state = { ...state, currentMonth: 12 };

    const next = advanceMonth(state, () => 0.5);

    expect(next.currentYear).toBe(2);
    expect(next.currentMonth).toBe(1);
  });
});

describe('buildFinalRanking(破産者を含む)', () => {
  it('破産者は総資産に関わらず非破産者より下位になる', () => {
    let state = setupState(3);
    // 破産者 '0' に最大の総資産を持たせてもランキングは最下位になる
    state = bankruptPlayer(state, '0');
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === '0' ? { ...p, netWorth: 99999 } : { ...p, netWorth: 5000 },
      ),
    };

    const ranking = buildFinalRanking(state);

    expect(ranking.map((e) => e.playerId)).toEqual(['1', '2', '0']);
    expect(ranking.map((e) => e.rank)).toEqual([1, 1, 3]);
    expect(ranking.map((e) => e.bankrupt)).toEqual([false, false, true]);
  });
});

describe('boardgame.io 統合(破産)', () => {
  function createClient(numPlayers: number) {
    return Client<GameState>({
      game: { ...EconBoardGame, seed: 'bankruptcy-test' },
      numPlayers,
    });
  }

  function playOneTurn(client: ReturnType<typeof createClient>) {
    client.moves.rollAndMove();
    const G = client.getState()!.G;
    client.moves.moveTo(G.reachableStationIds[0]);
    client.moves.endTurn();
  }

  it('破産プレイヤーの手番はスキップされる', () => {
    const client = createClient(3);
    client.moves.forceBankruptcy('1');

    playOneTurn(client); // '0' の手番終了 → '1' はスキップされ '2' の手番になる

    const state = client.getState()!;
    expect(state.ctx.currentPlayer).toBe('2');
    expect(state.G.currentPlayerId).toBe('2');
    // スキップでもターン番号は進む('0' 終了で2、'1' スキップで3)
    expect(state.G.turnNumber).toBe(3);
  });

  it('破産プレイヤーが最終手番でも月は進む', () => {
    const client = createClient(3);
    client.moves.forceBankruptcy('2');

    playOneTurn(client); // '0'
    playOneTurn(client); // '1' → '2' はスキップされ月が進んで '0' に戻る

    const state = client.getState()!;
    expect(state.ctx.currentPlayer).toBe('0');
    expect(state.G.currentMonth).toBe(5); // 4月開始 → 一巡で5月
  });

  it('2人プレイで1人が破産すると即ゲーム終了する', () => {
    const client = createClient(2);
    client.moves.forceBankruptcy('1');

    const G = client.getState()!.G;
    expect(G.gameOver).toBe(true);
    expect(G.winnerPlayerIds).toEqual(['0']);
    expect(G.finalRanking.find((e) => e.playerId === '1')?.bankrupt).toBe(true);
  });
});
