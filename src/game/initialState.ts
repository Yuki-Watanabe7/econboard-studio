import type { GameState, Player } from './types';
import { sampleMap, sampleProperties } from './sampleData';
import { selectDestinationStation } from './rules/destination';

export const INITIAL_CASH = 10000;
export const START_STATION_ID = 'central';
/** 既定のゲーム年数。この年の年次決算をもってゲーム終了となる */
export const DEFAULT_GAME_LENGTH_YEARS = 3;

/** 初期状態のオプション。将来 UI(セットアップ画面)から注入する想定 */
export interface InitialStateOptions {
  gameLengthYears?: number;
}

/**
 * 初期状態を生成する。
 * プレイヤー ID は boardgame.io の playerID('0', '1', ...)と一致させる。
 * 乱数は最初の目的地の抽選に使う(boardgame.io の setup から注入。既定は先頭候補固定)。
 */
export function createInitialState(
  numPlayers: number,
  options: InitialStateOptions = {},
  random: () => number = () => 0,
): GameState {
  const gameLengthYears = options.gameLengthYears ?? DEFAULT_GAME_LENGTH_YEARS;
  const players: Player[] = Array.from({ length: numPlayers }, (_, i) => ({
    id: String(i),
    name: `プレイヤー${i + 1}`,
    cash: INITIAL_CASH,
    currentStationId: START_STATION_ID,
    ownedPropertyIds: [],
    netWorth: INITIAL_CASH,
    status: { skipNextTurn: false, bankrupt: false },
  }));

  // 最初の目的地。全員が立つスタート駅は除外する(開始と同時の到着を防ぐ)
  const destinationStationId =
    selectDestinationStation(sampleMap.stations, random, [START_STATION_ID]) ?? START_STATION_ID;
  const destinationName =
    sampleMap.stations.find((s) => s.id === destinationStationId)?.name ?? destinationStationId;

  return {
    players,
    currentPlayerId: '0',
    turnNumber: 1,
    currentMonth: 4, // 年度開始をイメージして4月スタート
    currentYear: 1,
    map: sampleMap,
    properties: sampleProperties.map((p) => ({ ...p })),
    logs: [
      {
        id: 0,
        turnNumber: 1,
        year: 1,
        month: 4,
        type: 'system',
        message: `ゲーム開始(${numPlayers}人プレイ)。${gameLengthYears}年目の年次決算で総資産1位が勝利!`,
      },
      {
        id: 1,
        turnNumber: 1,
        year: 1,
        month: 4,
        type: 'destination',
        message: `最初の目的地は ${destinationName} に決まった`,
      },
    ],
    pendingTradeOffer: null,
    economicState: { activeModifiers: [] },
    currentDestinationStationId: destinationStationId,
    lastDiceRoll: null,
    reachableStationIds: [],
    turnStage: 'idle',
    nextLogId: 2,
    nextTradeOfferId: 1,
    gameLengthYears,
    gameOver: false,
    winnerPlayerIds: [],
    finalRanking: [],
  };
}
