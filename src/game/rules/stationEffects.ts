import type {
  CashEvent,
  EconomicEvent,
  GameState,
  ItemDefinition,
  ItemId,
  PlayerId,
  RuleResult,
} from '../types';
import { applyEconomicEvent } from './economy';
import { applyCashEvent, selectCashEvent } from './cashEvents';
import { acquireRandomItem } from './items';
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
 * - item: 入手候補からランダムで1つを付与する(所持上限に達している場合は入手できない)
 * - shop: 到着時に自動発生する効果はない(購入は buyShopItem move による能動操作)
 *
 * items / itemPool はアイテム入手マス用。既存呼び出し(イベント/所持金イベントのテスト)を
 * 壊さないよう任意引数とし、省略時は item マスでも何も起きない。
 */
export function resolveStationArrival(
  state: GameState,
  playerId: PlayerId,
  events: EconomicEvent[],
  cashEvents: CashEvent[],
  random: () => number,
  items: ItemDefinition[] = [],
  itemPool: ItemId[] = [],
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

  if (station.stationType === 'item') {
    return acquireRandomItem(state, playerId, items, itemPool, random);
  }

  // shop マスは到着時の自動効果なし(normal と同様に素通り)
  return { ok: true, state };
}
