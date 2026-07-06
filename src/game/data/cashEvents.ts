import type { CashEvent } from '../types';

/**
 * 固定の所持金イベント定義。将来はここを編集・追加してイベントを増やす。
 * 所持金イベント駅(stationType: 'cashEvent')到着時に1件が一様ランダムで発生する
 * (rules/stationEffects.ts → rules/cashEvents.ts)。
 */
export const sampleCashEvents: CashEvent[] = [
  {
    id: 'cash-windfall',
    name: '臨時収入',
    description: '思わぬ収入が舞い込んだ。1,000G を受け取る。',
    effect: { type: 'income', amount: 1000 },
  },
  {
    id: 'cash-local-tax',
    name: '地方税',
    description: 'エコノポリス市への納税期限が来た。1,000G を支払う。',
    effect: { type: 'payment', amount: 1000 },
  },
  {
    id: 'cash-maintenance',
    name: '物件維持費',
    description: '保有物件の点検・修繕の時期。保有物件1件につき 300G を支払う。',
    effect: { type: 'paymentPerProperty', amountPerProperty: 300 },
  },
  {
    id: 'cash-asset-tax',
    name: '資産税',
    description: '資産の査定が行われた。総資産の 5% を支払う。',
    effect: { type: 'paymentNetWorthRate', rate: 0.05 },
  },
  {
    id: 'cash-subsidy',
    name: '生活支援補助金',
    description: '市の補助金制度が発動。現金が最も少ないプレイヤーが 1,500G を受け取る。',
    effect: { type: 'incomeToPoorest', amount: 1500 },
  },
];
