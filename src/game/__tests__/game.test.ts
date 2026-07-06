import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { EconBoardGame } from '../game';
import { DEFAULT_GAME_LENGTH_YEARS } from '../initialState';
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

  it('moveTo でイベント駅に到着すると経済イベントが自動発生する', () => {
    const client = createClient(2);

    // 固定シードでイベント駅への到着が起きるまで手番を進める
    let eventStationVisits = 0;
    let guard = 0;
    while (eventStationVisits === 0 && guard < 100) {
      client.moves.rollAndMove();
      let G = client.getState()!.G;
      // 到達可能ならイベント駅を優先して選ぶ
      const stationById = new Map(G.map.stations.map((s) => [s.id, s]));
      const dest =
        G.reachableStationIds.find((id) => stationById.get(id)?.stationType === 'event') ??
        G.reachableStationIds[0];
      client.moves.moveTo(dest);
      G = client.getState()!.G;

      if (stationById.get(dest)?.stationType === 'event') {
        eventStationVisits += 1;
        // 到着直後に経済イベントのログと modifier が追加されている
        expect(G.economicState.activeModifiers.length).toBeGreaterThan(0);
        expect(G.logs.at(-1)?.type).toBe('economy');
        expect(G.logs.at(-1)?.message).toContain('経済イベント発生');
      }
      client.moves.endTurn();
      guard += 1;
    }
    expect(eventStationVisits).toBeGreaterThan(0);
  });

  it('指定年数の最終決算後にゲーム終了し、以降の move は無効になる', () => {
    const client = createClient(2);

    // ゲーム終了まで「サイコロ → 移動 → ターン終了」を繰り返す
    // (1年目4月開始 → 3年目12月まで 33ヶ月 × 2人 = 66手番)
    let guard = 0;
    while (!client.getState()!.G.gameOver && guard < 200) {
      client.moves.rollAndMove();
      const G = client.getState()!.G;
      client.moves.moveTo(G.reachableStationIds[0]);
      client.moves.endTurn();
      guard += 1;
    }

    const G = client.getState()!.G;
    expect(G.gameOver).toBe(true);
    expect(G.currentYear).toBe(DEFAULT_GAME_LENGTH_YEARS);
    expect(G.currentMonth).toBe(12);
    expect(G.finalRanking).toHaveLength(2);
    expect(G.winnerPlayerIds.length).toBeGreaterThanOrEqual(1);
    // ランキングは総資産降順
    expect(G.finalRanking[0].netWorth).toBeGreaterThanOrEqual(G.finalRanking[1].netWorth);

    // ゲーム終了後の move はすべて無効(状態が変化しない)
    const before = client.getState()!.G;
    client.moves.rollAndMove();
    client.moves.endTurn();
    client.moves.buyProperty(before.properties[0].id);
    client.moves.triggerEconomicEvent('ev-bayside-boom');
    expect(client.getState()!.G).toEqual(before);
  });
});
