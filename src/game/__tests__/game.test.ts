import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { EconBoardGame } from '../game';
import type { GameState } from '../types';

/**
 * boardgame.io 統合の煙テスト。
 * ルール単体ではなく「move → 状態遷移」の配線が正しいことを確認する。
 */
function createClient(numPlayers = 2) {
  return Client<GameState>({
    game: { ...EconBoardGame, seed: 'integration-test' },
    numPlayers,
  });
}

describe('boardgame.io 統合', () => {
  it('サイコロ → 行き先選択 → 到着 → ターン終了が一巡する', () => {
    const client = createClient();

    client.moves.rollAndMove();
    let G = client.getState()!.G;
    expect(G.lastDiceRoll).toBeGreaterThanOrEqual(1);
    expect(G.lastDiceRoll).toBeLessThanOrEqual(6);
    expect(G.turnStage).toBe('awaitingDestination');
    expect(G.reachableStationIds.length).toBeGreaterThan(0);

    client.moves.moveTo(G.reachableStationIds[0]);
    G = client.getState()!.G;
    expect(G.turnStage).toBe('arrived');

    client.moves.endTurn();
    const state = client.getState()!;
    expect(state.ctx.currentPlayer).toBe('1');
    expect(state.G.turnStage).toBe('idle');
    expect(state.G.turnNumber).toBe(2);
  });

  it('全プレイヤーが一巡すると月が進む', () => {
    const client = createClient(2);

    for (let i = 0; i < 2; i += 1) {
      client.moves.rollAndMove();
      const G = client.getState()!.G;
      client.moves.moveTo(G.reachableStationIds[0]);
      client.moves.endTurn();
    }

    const G = client.getState()!.G;
    expect(G.currentMonth).toBe(5); // 4月開始 → 一巡で5月
  });

  it('サイコロを振る前にターン終了はできない', () => {
    const client = createClient();
    client.moves.endTurn(); // INVALID_MOVE になるはず

    const state = client.getState()!;
    expect(state.ctx.currentPlayer).toBe('0'); // 手番は変わらない
    expect(state.G.turnStage).toBe('idle');
    expect(state.G.turnNumber).toBe(1); // ターン番号も進まない
    expect(state.G.currentMonth).toBe(4); // 月も進まない
  });

  it('行き先を選ばずにターン終了はできない', () => {
    const client = createClient();
    client.moves.rollAndMove();
    client.moves.endTurn(); // INVALID_MOVE になるはず

    const state = client.getState()!;
    expect(state.ctx.currentPlayer).toBe('0'); // 手番は変わらない
    expect(state.G.turnStage).toBe('awaitingDestination');
  });

  it('未対応の駅の物件は購入できず、到着駅の物件は購入できる', () => {
    const client = createClient();
    client.moves.rollAndMove();
    let G = client.getState()!.G;
    const dest = G.reachableStationIds[0];
    client.moves.moveTo(dest);

    G = client.getState()!.G;
    const propertyHere = G.properties.find((p) => p.stationId === dest);
    const propertyElsewhere = G.properties.find((p) => p.stationId !== dest);

    // 到着していない駅の物件 → 変化しない
    client.moves.buyProperty(propertyElsewhere!.id);
    G = client.getState()!.G;
    expect(G.properties.find((p) => p.id === propertyElsewhere!.id)?.ownerPlayerId).toBeNull();

    // 到着駅の物件 → 購入できる
    client.moves.buyProperty(propertyHere!.id);
    G = client.getState()!.G;
    expect(G.properties.find((p) => p.id === propertyHere!.id)?.ownerPlayerId).toBe('0');
  });
});
