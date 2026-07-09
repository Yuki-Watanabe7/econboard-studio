import type { ItemDefinition } from '../types';

/**
 * 固定のアイテム定義。将来はここを編集・追加してアイテムを増やす。
 * MVP ではアイテム基盤の確認用に、単純な効果のアイテムを1つだけ用意する
 * (issue: アイテム基盤の導入)。
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
];
