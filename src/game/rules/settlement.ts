import type { FinalRankingEntry, GameState, Player, RuleResult } from '../types';
import { addLog, findPlayer, findStation, updatePlayer } from './helpers';
import { assessPropertyValue, calculatePropertyIncome, expireModifiers } from './economy';
import { fluctuatePropertyPrices } from './propertyValuation';

/** プレイヤーの総資産 = 現金 + 保有物件の現在評価額 */
export function calculateNetWorth(state: GameState, player: Player): number {
  const assetValue = player.ownedPropertyIds.reduce((sum, propertyId) => {
    const property = state.properties.find((p) => p.id === propertyId);
    if (!property) return sum;
    const station = findStation(state, property.stationId);
    if (!station) return sum;
    return sum + assessPropertyValue(property, station.regionId, state.economicState);
  }, 0);
  return player.cash + assetValue;
}

/** 全プレイヤーの netWorth を再計算する */
export function recalculateAllNetWorth(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, netWorth: calculateNetWorth(state, p) })),
  };
}

/**
 * 月次処理。月が進んだ直後に呼ぶ。
 * - 期限切れの経済 modifier を除去
 * - 総資産を再計算
 */
export function settleMonth(state: GameState): GameState {
  let next = expireModifiers(state);
  next = recalculateAllNetWorth(next);
  next = addLog(next, 'settlement', `${next.currentYear}年${next.currentMonth}月になった`);
  return next;
}

/**
 * 年次決算。各プレイヤーに保有物件の年間収益を支払う。
 * 12月の全プレイヤー手番終了後(年が変わる直前)に呼ぶ。
 */
export function settleYear(state: GameState): GameState {
  let next = state;
  for (const player of state.players) {
    if (player.status.bankrupt) continue; // 破産者は脱落済みのため決算対象外
    const income = player.ownedPropertyIds.reduce((sum, propertyId) => {
      const property = next.properties.find((p) => p.id === propertyId);
      if (!property) return sum;
      const station = findStation(next, property.stationId);
      if (!station) return sum;
      return sum + calculatePropertyIncome(property, station.regionId, next.economicState);
    }, 0);
    next = updatePlayer(next, player.id, (p) => ({ ...p, cash: p.cash + income }));
    next = addLog(
      next,
      'settlement',
      `年次決算: ${player.name} は物件収益 ${income}G を受け取った`,
      player.id,
    );
  }
  return recalculateAllNetWorth(next);
}

/**
 * 総資産降順の最終順位を作る。同額は同順位、次の順位は人数分飛ぶ(1,1,3 形式)。
 * 破産者は脱落扱いとし、総資産に関わらず非破産者より下位に置く(破産者同士は総資産降順)。
 */
export function buildFinalRanking(state: GameState): FinalRankingEntry[] {
  const sorted = [...state.players].sort((a, b) => {
    if (a.status.bankrupt !== b.status.bankrupt) return a.status.bankrupt ? 1 : -1;
    return b.netWorth - a.netWorth;
  });
  let prev: { netWorth: number; bankrupt: boolean } | null = null;
  let prevRank = 1;
  return sorted.map((player, index) => {
    const bankrupt = player.status.bankrupt;
    const isTie = prev !== null && player.netWorth === prev.netWorth && bankrupt === prev.bankrupt;
    const rank = isTie ? prevRank : index + 1;
    prev = { netWorth: player.netWorth, bankrupt };
    prevRank = rank;
    return { playerId: player.id, netWorth: player.netWorth, rank, bankrupt };
  });
}

/**
 * ゲーム終了処理。最終年の年次決算(settleYear)の後に呼ぶ。
 * 総資産を再計算して最終順位を確定し、gameOver 状態にする。
 * 同額1位が複数いる場合は全員を勝者とする。
 */
export function finalizeGame(state: GameState): GameState {
  let next = recalculateAllNetWorth(state);
  const finalRanking = buildFinalRanking(next);
  const winnerPlayerIds = finalRanking.filter((e) => e.rank === 1).map((e) => e.playerId);
  next = {
    ...next,
    gameOver: true,
    finalRanking,
    winnerPlayerIds,
    pendingTradeOffer: null,
    lastDiceRoll: null,
    lastDiceRolls: [],
    reachableStationIds: [],
    turnStage: 'idle',
  };
  const winnerNames = winnerPlayerIds.map((id) => findPlayer(next, id)?.name ?? id).join(' と ');
  return addLog(
    next,
    'system',
    `ゲーム終了! 優勝は ${winnerNames}(総資産 ${finalRanking[0]?.netWorth.toLocaleString()}G)`,
  );
}

/**
 * 全プレイヤーの手番が一巡した際のカレンダー進行。
 * 12月が終わる場合は年次決算(settleYear)→ 物件価格改定(fluctuatePropertyPrices)を
 * 行ってから年を繰り上げる。改定後の総資産再計算は settleMonth が行う。
 * 最終年(gameLengthYears 年目)の年次決算後は年を繰り上げずゲームを終了する。
 * 価格改定は「翌年の価格」を決める処理のため、ゲームが終了する年には行わない
 * (最終順位が最後の決断の後の運だけで動くのを避ける)。
 * 乱数は価格改定に使う(rollDice と同様に注入してテスト可能にする)。
 */
export function advanceMonth(state: GameState, random: () => number): GameState {
  if (state.currentMonth >= 12) {
    const settled = settleYear(state);
    if (settled.currentYear >= settled.gameLengthYears) {
      return finalizeGame(settled);
    }
    const revalued = fluctuatePropertyPrices(settled, random);
    return settleMonth({ ...revalued, currentYear: revalued.currentYear + 1, currentMonth: 1 });
  }
  return settleMonth({ ...state, currentMonth: state.currentMonth + 1 });
}

/** 手番終了時の共通処理。ターン番号を進め、一巡していれば月も進める */
export function endPlayerTurn(
  state: GameState,
  isLastPlayerInRound: boolean,
  random: () => number,
): RuleResult {
  let next: GameState = {
    ...state,
    turnNumber: state.turnNumber + 1,
    lastDiceRoll: null,
    lastDiceRolls: [],
    reachableStationIds: [],
    turnStage: 'idle',
  };
  if (isLastPlayerInRound) {
    next = advanceMonth(next, random);
  }
  // 失効したトレードオファーを掃除する
  if (next.pendingTradeOffer && next.pendingTradeOffer.expiresOnTurn < next.turnNumber) {
    next = addLog(next, 'trade', 'トレードオファーは期限切れになった');
    next = { ...next, pendingTradeOffer: null };
  }
  return { ok: true, state: next };
}
