import type {
  GameLogType,
  GameState,
  Player,
  PlayerId,
  Property,
  PropertyId,
  Station,
  StationId,
} from '../types';

/** ルール関数共通の小さなユーティリティ。すべて非破壊(新しい state を返す) */

export function findPlayer(state: GameState, playerId: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function findProperty(state: GameState, propertyId: PropertyId): Property | undefined {
  return state.properties.find((p) => p.id === propertyId);
}

export function findStation(state: GameState, stationId: StationId): Station | undefined {
  return state.map.stations.find((s) => s.id === stationId);
}

export function updatePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: Player) => Player,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? update(p) : p)),
  };
}

export function updateProperty(
  state: GameState,
  propertyId: PropertyId,
  update: (property: Property) => Property,
): GameState {
  return {
    ...state,
    properties: state.properties.map((p) => (p.id === propertyId ? update(p) : p)),
  };
}

export function addLog(
  state: GameState,
  type: GameLogType,
  message: string,
  playerId?: PlayerId,
): GameState {
  return {
    ...state,
    nextLogId: state.nextLogId + 1,
    logs: [
      ...state.logs,
      {
        id: state.nextLogId,
        turnNumber: state.turnNumber,
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
        ...(playerId !== undefined ? { playerId } : {}),
      },
    ],
  };
}
