import type { GameState, PlayerId, RuleResult, Station, StationId } from '../types';
import { addLog, findPlayer, findStation, updatePlayer } from './helpers';
import { recalculateAllNetWorth } from './settlement';

/**
 * 目的地システム。
 *
 * 全プレイヤー共通の目的地駅を1つ持ち、到着したプレイヤーに報酬を支払って
 * 次の目的地を抽選する。movePlayer(移動そのもの)・駅種別効果(stationEffects)
 * とは分離し、乱数は注入して純粋関数性とテスト容易性を保つ。
 *
 * 同一駅で目的地到着と駅種別効果が重なる場合の解決順は game.ts の moveTo が定める:
 * 移動ログ → 目的地到着報酬 → 駅種別効果(経済イベント)。
 */

/** 目的地到着報酬の固定額(MVP) */
export const DESTINATION_REWARD = 2000;

/**
 * 次の目的地を1駅選ぶ。候補がなければ null。
 *
 * excludeStationIds に直前の目的地を渡すことで「同じ駅の連続選択」を防ぐ。
 * MVP では一様ランダム。将来、現在地からの距離や地域に応じた重み付けを行う場合は
 * この関数に選択コンテキストを渡して拡張する。
 */
export function selectDestinationStation(
  stations: Station[],
  random: () => number,
  excludeStationIds: StationId[] = [],
): StationId | null {
  const candidates = stations.filter((s) => !excludeStationIds.includes(s.id));
  if (candidates.length === 0) {
    return null;
  }
  const index = Math.min(Math.floor(random() * candidates.length), candidates.length - 1);
  return candidates[index].id;
}

/**
 * 目的地到着報酬を計算する。MVP では固定額。
 *
 * 将来の拡張候補(距離連動・年数連動・順位補正)がいずれも GameState と
 * 対象プレイヤーから導出できるよう、この署名で固定している。
 */
export function calculateDestinationReward(state: GameState, playerId: PlayerId): number {
  const player = findPlayer(state, playerId);
  if (!player) {
    return 0;
  }
  return DESTINATION_REWARD;
}

/**
 * プレイヤーの現在駅が目的地なら、報酬支払い → 次の目的地の抽選を行う。
 * 目的地以外の駅、またはゲーム終了後は何もしない。
 * 報酬支払い後は総資産を再計算する。
 */
export function resolveDestinationArrival(
  state: GameState,
  playerId: PlayerId,
  random: () => number,
): RuleResult {
  if (state.gameOver) {
    return { ok: true, state };
  }
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.currentStationId !== state.currentDestinationStationId) {
    return { ok: true, state };
  }
  const station = findStation(state, state.currentDestinationStationId);
  if (!station) {
    return { ok: false, reason: `目的地駅 ${state.currentDestinationStationId} が存在しない` };
  }

  const reward = calculateDestinationReward(state, playerId);
  let next = updatePlayer(state, playerId, (p) => ({ ...p, cash: p.cash + reward }));
  next = addLog(
    next,
    'destination',
    `${player.name} が目的地 ${station.name} に到着! 報酬 ${reward.toLocaleString()}G を獲得した`,
    playerId,
  );

  // 直前の目的地と同じ駅は連続で選ばない
  const nextDestinationId = selectDestinationStation(next.map.stations, random, [station.id]);
  if (nextDestinationId !== null) {
    const nextStation = findStation(next, nextDestinationId);
    next = { ...next, currentDestinationStationId: nextDestinationId };
    next = addLog(next, 'destination', `次の目的地は ${nextStation?.name} に決まった`);
  }

  return { ok: true, state: recalculateAllNetWorth(next) };
}
