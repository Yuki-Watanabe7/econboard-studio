import type { GameState, Player, PlayerId, RuleResult } from '../types';
import { addLog, findPlayer, updatePlayer } from './helpers';
import { endPlayerTurn, finalizeGame, recalculateAllNetWorth } from './settlement';

/** 破産していないプレイヤーの一覧 */
export function solventPlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.status.bankrupt);
}

/**
 * 破産処理。プレイヤーを脱落状態にする。
 * - `status.bankrupt` を true にする
 * - 保有物件をすべて未所有(`ownerPlayerId: null`)に戻す(MVP 仕様: 清算・売却交渉なし)
 * - 破産していないプレイヤーが1人以下になったら、その時点でゲームを終了する
 *
 * 将来の支払い系イベントからも再利用できる独立した純粋関数(issue #5)。
 */
export function declareBankruptcy(state: GameState, playerId: PlayerId): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: false, reason: `${player.name} はすでに破産している` };
  }

  const releasedCount = player.ownedPropertyIds.length;
  let next: GameState = {
    ...state,
    properties: state.properties.map((p) =>
      p.ownerPlayerId === playerId ? { ...p, ownerPlayerId: null } : p,
    ),
  };
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    ownedPropertyIds: [],
    status: { ...p.status, bankrupt: true },
  }));
  next = recalculateAllNetWorth(next);
  next = addLog(
    next,
    'system',
    `${player.name} は破産した(物件${releasedCount}件を手放して脱落)`,
    playerId,
  );

  // 破産者が本人だった場合、進行中のトレードは成立し得ないため破棄する
  if (
    next.pendingTradeOffer &&
    (next.pendingTradeOffer.fromPlayerId === playerId ||
      next.pendingTradeOffer.toPlayerId === playerId)
  ) {
    next = addLog(next, 'trade', '破産により進行中のトレードオファーは無効になった');
    next = { ...next, pendingTradeOffer: null };
  }

  // 残りが1人以下なら続行不能。その時点の総資産でゲームを終了する
  if (solventPlayers(next).length <= 1) {
    next = addLog(next, 'system', '破産していないプレイヤーが1人以下になったためゲームを終了する');
    next = finalizeGame(next);
  }
  return { ok: true, state: next };
}

/**
 * 汎用の支払い処理。将来の支払い系イベント(税・罰金など)から使う想定。
 * - 現金が足りる場合: 全額を支払う
 * - 足りない場合: 払える分だけ支払って現金0になり、破産処理(declareBankruptcy)を行う
 */
export function chargePlayer(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  description: string,
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: false, reason: `${player.name} は破産しているため支払いできない` };
  }
  if (amount < 0) {
    return { ok: false, reason: '支払額は0以上でなければならない' };
  }

  const paid = Math.min(player.cash, amount);
  let next = updatePlayer(state, playerId, (p) => ({ ...p, cash: p.cash - paid }));
  next = addLog(
    next,
    'settlement',
    `${player.name} は ${description} で ${paid}G を支払った`,
    playerId,
  );
  if (paid < amount) {
    next = addLog(
      next,
      'settlement',
      `${player.name} は ${amount - paid}G を支払えなかった`,
      playerId,
    );
    return declareBankruptcy(next, playerId);
  }
  next = recalculateAllNetWorth(next);
  return { ok: true, state: next };
}

/**
 * 破産プレイヤーの手番を何もせずに終了する。
 * boardgame.io 層の turn.onBegin から呼ばれ、カレンダー進行(endPlayerTurn)は通常どおり行う。
 */
export function skipBankruptPlayerTurn(state: GameState, isLastPlayerInRound: boolean): RuleResult {
  const player = findPlayer(state, state.currentPlayerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${state.currentPlayerId} が存在しない` };
  }
  if (!player.status.bankrupt) {
    return { ok: false, reason: `${player.name} は破産していないためスキップできない` };
  }
  const next = addLog(
    state,
    'system',
    `${player.name} は破産しているため手番をスキップした`,
    player.id,
  );
  return endPlayerTurn(next, isLastPlayerInRound);
}
