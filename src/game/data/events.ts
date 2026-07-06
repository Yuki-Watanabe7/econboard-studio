import type { EconomicEvent } from '../types';

/** 固定の経済イベント定義。将来はここを編集・追加してイベントを増やす */
export const sampleEvents: EconomicEvent[] = [
  {
    id: 'ev-bayside-boom',
    name: 'ベイサイド好況',
    description: '港湾地区の貿易が活発化。ベイサイド地域の物件収益率が12ヶ月間 1.5 倍になる。',
    effects: [{ target: { type: 'region', id: 'bayside' }, yieldMultiplier: 1.5 }],
    durationMonths: 12,
  },
  {
    id: 'ev-retail-slump',
    name: '小売不況',
    description: '消費の冷え込みにより、小売(retail)物件の評価額が6ヶ月間 0.7 倍になる。',
    effects: [{ target: { type: 'category', id: 'retail' }, valueMultiplier: 0.7 }],
    durationMonths: 6,
  },
];
