import type { Game, Move } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { GameState, PlayerId, PropertyId, StationId } from './types';
import { createInitialState, type InitialStateOptions } from './initialState';
import { addLog, findPlayer } from './rules/helpers';
import { getReachableStations, movePlayer, rollDice } from './rules/movement';
import { buyProperty } from './rules/property';
import { endPlayerTurn } from './rules/settlement';
import {
  acceptTradeOffer,
  createTradeOffer,
  rejectTradeOffer,
  type TradeOfferInput,
} from './rules/trade';
import { applyEconomicEvent } from './rules/economy';
import { sampleEvents } from './sampleData';

/**
 * boardgame.io 統合レイヤー。
 *
 * 方針: ルールはすべて rules/ の純粋関数に置き、この層は
 * 「move 引数の受け取り → ルール関数呼び出し → 失敗時 INVALID_MOVE」だけを担当する。
 *
 * 現状はローカル(ホットシート)プレイ前提。トレードの受諾/拒否も同じ画面から
 * 操作するため、move の呼び出し元プレイヤー検証は行っていない(README 参照)。
 */

const rollAndMove: Move<GameState> = ({ G, random }) => {
  if (G.gameOver) return INVALID_MOVE;
  if (G.turnStage !== 'idle') return INVALID_MOVE;
  const player = findPlayer(G, G.currentPlayerId);
  if (!player) return INVALID_MOVE;

  const roll = rollDice(() => random.Number());
  const reachable = getReachableStations(G.map, player.currentStationId, roll);
  let next: GameState = {
    ...G,
    lastDiceRoll: roll,
    reachableStationIds: reachable,
    turnStage: 'awaitingDestination',
  };
  next = addLog(next, 'move', `${player.name} はサイコロで ${roll} を出した`, player.id);
  return next;
};

const moveTo: Move<GameState> = ({ G }, toStationId: StationId) => {
  if (G.gameOver) return INVALID_MOVE;
  if (G.turnStage !== 'awaitingDestination') return INVALID_MOVE;
  if (!G.reachableStationIds.includes(toStationId)) return INVALID_MOVE;

  const result = movePlayer(G, G.currentPlayerId, toStationId);
  if (!result.ok) return INVALID_MOVE;
  return { ...result.state, reachableStationIds: [], turnStage: 'arrived' as const };
};

const buyPropertyMove: Move<GameState> = ({ G }, propertyId: PropertyId) => {
  if (G.gameOver) return INVALID_MOVE;
  if (G.turnStage !== 'arrived') return INVALID_MOVE;
  const result = buyProperty(G, G.currentPlayerId, propertyId);
  if (!result.ok) return INVALID_MOVE;
  return result.state;
};

const endTurnMove: Move<GameState> = ({ G, ctx, events }) => {
  if (G.gameOver) return INVALID_MOVE;
  // サイコロ前('idle')・移動途中('awaitingDestination')ではターンを終了できない。
  // 手番は必ず「サイコロ → 移動 → (任意で購入等) → ターン終了」の順に進む(issue #3)。
  if (G.turnStage !== 'arrived') return INVALID_MOVE;
  const isLastPlayerInRound = ctx.playOrderPos === ctx.numPlayers - 1;
  const result = endPlayerTurn(G, isLastPlayerInRound);
  if (!result.ok) return INVALID_MOVE;
  // 最終年の年次決算でゲームが終了した場合は手番を回さない
  if (!result.state.gameOver) {
    events.endTurn();
  }
  return result.state;
};

const createTradeOfferMove: Move<GameState> = (
  { G },
  input: Omit<TradeOfferInput, 'fromPlayerId'>,
) => {
  if (G.gameOver) return INVALID_MOVE;
  const result = createTradeOffer(G, { ...input, fromPlayerId: G.currentPlayerId });
  if (!result.ok) return INVALID_MOVE;
  return result.state;
};

const acceptTradeOfferMove: Move<GameState> = ({ G }, offerId: string) => {
  if (G.gameOver) return INVALID_MOVE;
  const result = acceptTradeOffer(G, offerId);
  if (!result.ok) return INVALID_MOVE;
  return result.state;
};

const rejectTradeOfferMove: Move<GameState> = ({ G }, offerId: string) => {
  if (G.gameOver) return INVALID_MOVE;
  const result = rejectTradeOffer(G, offerId);
  if (!result.ok) return INVALID_MOVE;
  return result.state;
};

/** 開発用: 固定イベントを手動発火する(将来は駅マスやカードから発火する想定) */
const triggerEconomicEvent: Move<GameState> = ({ G }, eventId: string) => {
  if (G.gameOver) return INVALID_MOVE;
  const event = sampleEvents.find((e) => e.id === eventId);
  if (!event) return INVALID_MOVE;
  const result = applyEconomicEvent(G, event);
  if (!result.ok) return INVALID_MOVE;
  return result.state;
};

export const EconBoardGame: Game<GameState> = {
  name: 'econboard',

  // setupData で gameLengthYears 等を注入できる(将来のセットアップ UI 用)
  setup: ({ ctx }, setupData?: InitialStateOptions) =>
    createInitialState(ctx.numPlayers, setupData),

  minPlayers: 2,
  maxPlayers: 4,

  turn: {
    onBegin: ({ G, ctx }) => {
      G.currentPlayerId = ctx.currentPlayer as PlayerId;
    },
  },

  moves: {
    rollAndMove,
    moveTo,
    buyProperty: buyPropertyMove,
    endTurn: endTurnMove,
    createTradeOffer: createTradeOfferMove,
    acceptTradeOffer: acceptTradeOfferMove,
    rejectTradeOffer: rejectTradeOfferMove,
    triggerEconomicEvent,
  },
};
