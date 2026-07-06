import type { CashEvent, GameState, Player, PlayerId, RuleResult } from '../types';
import { addLog, findPlayer, updatePlayer } from './helpers';
import { chargePlayer, solventPlayers } from './bankruptcy';
import { calculateNetWorth, recalculateAllNetWorth } from './settlement';

/**
 * 所持金イベント(現金の増減)。
 *
 * 所持金イベント駅(stationType: 'cashEvent')到着時に1件が発生する
 * (rules/stationEffects.ts)。支払い系の効果は既存の支払い・破産処理
 * (bankruptcy.ts の chargePlayer)を再利用し、破産ルールを重複実装しない。
 * 乱数・イベント定義はともに引数で注入し、純粋関数性とテスト容易性を保つ。
 */

/**
 * 発生させる所持金イベントを1件選ぶ。イベントが未登録なら null。
 * MVP では一様ランダム(selectEconomicEvent と同じ方針)。
 */
export function selectCashEvent(events: CashEvent[], random: () => number): CashEvent | null {
  if (events.length === 0) {
    return null;
  }
  const index = Math.min(Math.floor(random() * events.length), events.length - 1);
  return events[index];
}

/** 現金が最も少ない(破産していない)プレイヤー。同額の場合は手番順で先のプレイヤー */
export function findPoorestPlayer(state: GameState): Player | undefined {
  return solventPlayers(state).reduce<Player | undefined>(
    (poorest, p) => (poorest === undefined || p.cash < poorest.cash ? p : poorest),
    undefined,
  );
}

/** プレイヤーに現金を加算し、ログを残して総資産を再計算する */
function grantCash(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  message: string,
): GameState {
  let next = updatePlayer(state, playerId, (p) => ({ ...p, cash: p.cash + amount }));
  next = addLog(next, 'cashEvent', message, playerId);
  return recalculateAllNetWorth(next);
}

/**
 * 所持金イベントを到着プレイヤーに適用する。
 * - 収入系: 現金を加算して総資産を再計算する
 * - 支払い系: chargePlayer に委譲する(現金不足なら破産処理が発動する)
 */
export function applyCashEvent(state: GameState, playerId: PlayerId, event: CashEvent): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: false, reason: `${player.name} は破産しているためイベントの対象にならない` };
  }

  const occurred = addLog(
    state,
    'cashEvent',
    `所持金イベント発生: ${event.name} — ${event.description}`,
    playerId,
  );

  const effect = event.effect;
  switch (effect.type) {
    case 'income':
      return {
        ok: true,
        state: grantCash(
          occurred,
          playerId,
          effect.amount,
          `${player.name} は ${effect.amount.toLocaleString()}G を受け取った`,
        ),
      };
    case 'payment':
      return chargePlayer(occurred, playerId, effect.amount, event.name);
    case 'paymentPerProperty': {
      const count = player.ownedPropertyIds.length;
      const amount = count * effect.amountPerProperty;
      return chargePlayer(
        occurred,
        playerId,
        amount,
        `${event.name}(保有物件${count}件 × ${effect.amountPerProperty.toLocaleString()}G)`,
      );
    }
    case 'paymentNetWorthRate': {
      const netWorth = calculateNetWorth(occurred, player);
      const amount = Math.round(netWorth * effect.rate);
      const percent = Number((effect.rate * 100).toFixed(2));
      return chargePlayer(
        occurred,
        playerId,
        amount,
        `${event.name}(総資産 ${netWorth.toLocaleString()}G の ${percent}%)`,
      );
    }
    case 'incomeToPoorest': {
      const recipient = findPoorestPlayer(occurred);
      if (!recipient) {
        return { ok: false, reason: '破産していないプレイヤーがいない' };
      }
      return {
        ok: true,
        state: grantCash(
          occurred,
          recipient.id,
          effect.amount,
          `現金が最も少ない ${recipient.name} は ${effect.amount.toLocaleString()}G を受け取った`,
        ),
      };
    }
  }
}
