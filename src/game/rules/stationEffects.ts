import type { CashEvent, EconomicEvent, GameState, PlayerId, RuleResult } from '../types';
import { applyEconomicEvent } from './economy';
import { applyCashEvent, selectCashEvent } from './cashEvents';
import { findPlayer, findStation } from './helpers';

/**
 * 駅到着時のマス効果。
 *
 * movePlayer(移動そのもの)とは分離し、「到着した駅の種別に応じた効果」だけを扱う。
 * 乱数・イベント定義はともに引数で注入し、純粋関数性とテスト容易性を保つ。
 */

/**
 * 発生させる経済イベントを1件選ぶ。イベントが未登録なら null。
 *
 * MVP では一様ランダム。将来、地域・駅種別・カテゴリに応じた重み付けを行う場合は
 * この関数に選択コンテキスト(到着駅など)を渡して拡張する。
 */
export function selectEconomicEvent(
  events: EconomicEvent[],
  random: () => number,
): EconomicEvent | null {
  if (events.length === 0) {
    return null;
  }
  const index = Math.min(Math.floor(random() * events.length), events.length - 1);
  return events[index];
}

/**
 * プレイヤーの現在駅の種別に応じた到着効果を解決する。
 * - normal: 何もしない
 * - event: 登録済み経済イベントから1件を選んで適用する(未登録なら何もしない)
 * - cashEvent: 登録済み所持金イベントから1件を選んで到着プレイヤーに適用する(未登録なら何もしない)
 */
export function resolveStationArrival(
  state: GameState,
  playerId: PlayerId,
  events: EconomicEvent[],
  cashEvents: CashEvent[],
  random: () => number,
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  const station = findStation(state, player.currentStationId);
  if (!station) {
    return { ok: false, reason: `駅 ${player.currentStationId} が存在しない` };
  }

  if (station.stationType === 'event') {
    const event = selectEconomicEvent(events, random);
    if (!event) {
      return { ok: true, state };
    }
    return applyEconomicEvent(state, event);
  }

  if (station.stationType === 'cashEvent') {
    const event = selectCashEvent(cashEvents, random);
    if (!event) {
      return { ok: true, state };
    }
    return applyCashEvent(state, playerId, event);
  }

  return { ok: true, state };
}
