import type { ItemDefinition, ItemId, ShopOffer } from '../types';

/**
 * 固定のアイテム定義。将来はここを編集・追加してアイテムを増やす。
 * 複数サイコロ系(double-dice/triple-dice/reroll-dice)は、目的地到着・イベント駅回避・
 * 物件購入狙いなど、移動前の戦術的選択を作ることを目的としたアイテム
 * (issue: 複数サイコロ系アイテムを実装し、移動前の戦術的選択を増やす)。
 */
export const sampleItems: ItemDefinition[] = [
  {
    id: 'grant-cash-small',
    name: '臨時収入の書類',
    description:
      '使用するとその場で 500G を受け取る、アイテム基盤確認用のテストアイテム。手番開始時(サイコロを振る前)に使用できる。',
    usableTimings: ['beforeRoll'],
    effect: { type: 'grantCash', amount: 500 },
  },
  {
    id: 'double-dice',
    name: 'ダブルダイス',
    description:
      '通常のサイコロの代わりにサイコロを2個振り、合計の歩数で移動する。手番開始時(サイコロを振る前)に使用できる。',
    usableTimings: ['beforeRoll'],
    effect: { type: 'multiRoll', diceCount: 2 },
  },
  {
    id: 'triple-dice',
    name: 'トリプルダイス',
    description:
      '通常のサイコロの代わりにサイコロを3個振り、合計の歩数で移動する。手番開始時(サイコロを振る前)に使用できる。',
    usableTimings: ['beforeRoll'],
    effect: { type: 'multiRoll', diceCount: 3 },
  },
  {
    id: 'reroll-dice',
    name: 'サイコロの振り直し',
    description:
      '直前に振ったサイコロ(個数はそのまま)を振り直し、移動候補を再計算する。サイコロを振った後、行き先を選ぶ前に使用できる。',
    usableTimings: ['afterRoll'],
    effect: { type: 'rerollDice' },
  },
];

/**
 * アイテム入手マス(stationType: 'item')の獲得候補。
 * 到着時に一様ランダムで1つが選ばれ、所持上限に達していなければ入手できる
 * (rules/items.ts の acquireRandomItem)。将来は重み付け抽選に拡張できる。
 */
export const itemMassPool: ItemId[] = [
  'grant-cash-small',
  'double-dice',
  'triple-dice',
  'reroll-dice',
];

/**
 * ショップマス(stationType: 'shop')の品揃え。
 * 到着後、現金を払って購入できる(rules/items.ts の buyShopItem)。
 * grant-cash-small は使用時 +500G のため、無利益となるよう 500G より高く設定する。
 */
export const shopOffers: ShopOffer[] = [
  { itemId: 'grant-cash-small', price: 700 },
  { itemId: 'double-dice', price: 500 },
  { itemId: 'triple-dice', price: 900 },
  { itemId: 'reroll-dice', price: 400 },
];
