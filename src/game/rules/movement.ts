import type { GameMap, GameState, PlayerId, RuleResult, StationId } from '../types';
import { addLog, findPlayer, findStation, updatePlayer } from './helpers';

/**
 * サイコロを振る。乱数生成器を注入することでテスト可能にする。
 * boardgame.io 統合側では ctx.random を渡す。
 */
export function rollDice(random: () => number, sides = 6): number {
  const value = Math.floor(random() * sides) + 1;
  return Math.min(Math.max(value, 1), sides);
}

function buildAdjacency(map: GameMap): Map<StationId, StationId[]> {
  const adjacency = new Map<StationId, StationId[]>();
  for (const station of map.stations) {
    adjacency.set(station.id, []);
  }
  for (const edge of map.edges) {
    adjacency.get(edge.fromStationId)?.push(edge.toStationId);
    adjacency.get(edge.toStationId)?.push(edge.fromStationId);
  }
  return adjacency;
}

/**
 * 指定歩数ちょうどで到達できる駅の一覧を返す。
 *
 * 移動ルール:
 * - 1歩ごとに接続駅へ進む
 * - 直前にいた駅へすぐ引き返すことはできない(行き止まりの場合のみ折り返し可)
 */
export function getReachableStations(
  map: GameMap,
  fromStationId: StationId,
  steps: number,
): StationId[] {
  if (steps <= 0) {
    return [fromStationId];
  }
  const adjacency = buildAdjacency(map);

  // (現在駅, 直前駅) の組を状態として steps 回展開する
  let frontier = new Map<string, { station: StationId; prev: StationId | null }>();
  frontier.set(`${fromStationId}|`, { station: fromStationId, prev: null });

  for (let step = 0; step < steps; step += 1) {
    const next = new Map<string, { station: StationId; prev: StationId | null }>();
    for (const { station, prev } of frontier.values()) {
      const neighbors = adjacency.get(station) ?? [];
      let options = neighbors.filter((n) => n !== prev);
      if (options.length === 0) {
        options = neighbors; // 行き止まり: 折り返しを許可
      }
      for (const neighbor of options) {
        next.set(`${neighbor}|${station}`, { station: neighbor, prev: station });
      }
    }
    frontier = next;
  }

  return [...new Set([...frontier.values()].map((f) => f.station))].sort();
}

/** プレイヤーを指定駅へ移動させる(到達可能かどうかの検証は呼び出し側の責務) */
export function movePlayer(
  state: GameState,
  playerId: PlayerId,
  toStationId: StationId,
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: false, reason: `${player.name} は破産しているため移動できない` };
  }
  const station = findStation(state, toStationId);
  if (!station) {
    return { ok: false, reason: `駅 ${toStationId} が存在しない` };
  }

  let next = updatePlayer(state, playerId, (p) => ({ ...p, currentStationId: toStationId }));
  next = addLog(next, 'move', `${player.name} が ${station.name} に到着した`, playerId);
  return { ok: true, state: next };
}
