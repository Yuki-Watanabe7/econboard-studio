import type { GameMap, GameState, PlayerId, PropertyId } from '../types';
import { createInitialState } from '../initialState';
import { updatePlayer, updateProperty } from '../rules/helpers';

/** テスト用: 初期状態を作る */
export function setupState(numPlayers = 2): GameState {
  return createInitialState(numPlayers);
}

/** テスト用: 購入手続きを経ずに物件を所有させる */
export function giveProperty(
  state: GameState,
  playerId: PlayerId,
  propertyId: PropertyId,
): GameState {
  let next = updateProperty(state, propertyId, (p) => ({ ...p, ownerPlayerId: playerId }));
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    ownedPropertyIds: [...p.ownedPropertyIds, propertyId],
  }));
  return next;
}

/** テスト用: 一直線の路線 A - B - C - D(A と D は行き止まり) */
export const lineMap: GameMap = {
  id: 'line-map',
  name: 'テスト用直線マップ',
  regions: [{ id: 'r1', name: 'テスト地域' }],
  stations: [
    {
      id: 'A',
      name: 'A駅',
      regionId: 'r1',
      position: { x: 0, y: 0 },
      connectedStationIds: ['B'],
      propertyIds: [],
    },
    {
      id: 'B',
      name: 'B駅',
      regionId: 'r1',
      position: { x: 100, y: 0 },
      connectedStationIds: ['A', 'C'],
      propertyIds: [],
    },
    {
      id: 'C',
      name: 'C駅',
      regionId: 'r1',
      position: { x: 200, y: 0 },
      connectedStationIds: ['B', 'D'],
      propertyIds: [],
    },
    {
      id: 'D',
      name: 'D駅',
      regionId: 'r1',
      position: { x: 300, y: 0 },
      connectedStationIds: ['C'],
      propertyIds: [],
    },
  ],
  edges: [
    { id: 'ab', fromStationId: 'A', toStationId: 'B' },
    { id: 'bc', fromStationId: 'B', toStationId: 'C' },
    { id: 'cd', fromStationId: 'C', toStationId: 'D' },
  ],
};
