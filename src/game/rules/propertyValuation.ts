import type { GameState, Property } from '../types';
import { addLog } from './helpers';

/**
 * 年次の物件価格改定。
 *
 * モデル(README「物件価格の年次変動」参照):
 *   変動率 = 期待成長率(growthPotential) + 一様ノイズ(riskLevel に応じた振れ幅)
 *   新価格 = max(最低価格, round(現在価格 × (1 + 変動率)))
 *
 * - growthPotential が高いほど期待変動率が高い(上昇しやすい)
 * - riskLevel が高いほどノイズの振れ幅が大きい(上下に大きく動く)
 * - 経済 modifier(evaluatePropertyValue の評価倍率)は一時的な倍率として
 *   評価時に掛かるだけで price 自体は変えない。この改定は price を恒久的に
 *   動かすため、両者は役割が異なり二重計上にはならない
 * - 乱数は物件1件につき1回、properties の配列順に消費する(シード固定で再現可能)
 */

/** growthPotential ごとの期待変動率(年率) */
export const GROWTH_DRIFT: Record<Property['growthPotential'], number> = {
  1: -0.02,
  2: 0.02,
  3: 0.06,
};

/** riskLevel ごとのノイズ振れ幅(±この割合まで一様分布) */
export const RISK_AMPLITUDE: Record<Property['riskLevel'], number> = {
  1: 0.04,
  2: 0.1,
  3: 0.18,
};

/** 最低価格 = 基準価格 × この割合(下回らない) */
export const MIN_PRICE_RATIO = 0.3;

/** 個別ログを出す変動率のしきい値(これ未満の変動は集約ログのみ) */
export const LARGE_CHANGE_LOG_THRESHOLD = 0.1;

/** 物件の最低価格。基準価格の一定割合を下回らない(最低 1G) */
export function minPropertyPrice(property: Property): number {
  return Math.max(1, Math.round(property.basePrice * MIN_PRICE_RATIO));
}

/**
 * 物件1件の改定後価格を計算する。乱数は1回だけ消費する。
 * 整数に丸め、最低価格を下回らない。
 */
export function calculateNewPrice(property: Property, random: () => number): number {
  const drift = GROWTH_DRIFT[property.growthPotential];
  const noise = (2 * random() - 1) * RISK_AMPLITUDE[property.riskLevel];
  const next = Math.round(property.price * (1 + drift + noise));
  return Math.max(minPropertyPrice(property), next);
}

/**
 * 全物件の価格を改定する。年次決算(settleYear)の後、年の繰り上げ前に呼ぶ。
 * ログは集約1件 + 変動率が LARGE_CHANGE_LOG_THRESHOLD 以上の物件のみ個別に出す。
 * 総資産の再計算は行わない(呼び出し側 advanceMonth の settleMonth が行う)。
 */
export function fluctuatePropertyPrices(state: GameState, random: () => number): GameState {
  const changes = state.properties.map((property) => {
    const newPrice = calculateNewPrice(property, random);
    return { property, newPrice, rate: (newPrice - property.price) / property.price };
  });

  let next: GameState = {
    ...state,
    properties: changes.map(({ property, newPrice }) => ({ ...property, price: newPrice })),
  };

  const up = changes.filter((c) => c.rate > 0).length;
  const down = changes.filter((c) => c.rate < 0).length;
  const flat = changes.length - up - down;
  const averageRate = changes.length
    ? changes.reduce((sum, c) => sum + c.rate, 0) / changes.length
    : 0;
  next = addLog(
    next,
    'economy',
    `物件価格改定: 上昇 ${up}件 / 下落 ${down}件 / 横ばい ${flat}件(平均 ${formatRate(averageRate)})`,
  );

  for (const { property, newPrice, rate } of changes) {
    if (Math.abs(rate) < LARGE_CHANGE_LOG_THRESHOLD) continue;
    next = addLog(
      next,
      'economy',
      `${property.name} の価格が ${property.price.toLocaleString()}G → ${newPrice.toLocaleString()}G(${formatRate(rate)})に変動した`,
    );
  }
  return next;
}

/** 変動率を「+5.0%」形式で表示する */
export function formatRate(rate: number): string {
  const percent = (rate * 100).toFixed(1);
  return `${rate >= 0 ? '+' : ''}${percent}%`;
}
