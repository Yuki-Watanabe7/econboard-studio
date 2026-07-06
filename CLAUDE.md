# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

編集可能な経済ボードゲーム基盤(エンジン)。路線上を移動・物件購入・決算・総資産を競うターン制ゲーム。既存市販ゲームのクローンではないため、**既存作品の固有名詞・キャラクター・カード名・演出は使用しない**こと。サンプルデータはすべて架空都市「エコノポリス」のもの。

技術スタック: React + TypeScript + Vite + boardgame.io + Zod + Vitest。UI は SVG 描画のみ(ゲームエンジン非依存)。

## コマンド

```bash
npm run dev          # 開発サーバ (http://localhost:5173)
npm run test         # 全テスト実行 (Vitest)
npx vitest run src/game/__tests__/trade.test.ts   # 単一テストファイル
npx vitest run -t "テスト名の一部"                  # テスト名で絞り込み
npm run lint         # ESLint (flat config)
npm run build        # tsc -b + vite build
npm run format       # Prettier 整形(コミット前に実行推奨)
```

## アーキテクチャ(最重要)

本体は「画面」ではなく「ゲーム状態遷移モデル」。レイヤー間の依存方向を必ず守る:

```
data/ (編集対象データ) → rules/ (純粋関数) → game.ts (boardgame.io 統合) → components/ (React UI)
```

1. **`src/game/rules/`** — すべてのゲームルールは純粋関数。`GameState` を受け取り、新しい `GameState` を返すか `{ ok: false, reason }`(`RuleResult` 型)を返す。**boardgame.io / React / DOM に依存させないこと。** 乱数は関数注入(`rollDice(random)`)。
2. **`src/game/game.ts`** — boardgame.io の move 定義のみ。ルールを書かない。純粋関数を呼び、失敗時に `INVALID_MOVE` へ変換するだけの薄い層。
3. **`src/components/`** — 表示層。状態の解釈・変更をここに書かない。

新ルールを追加するときは: rules/ に純粋関数 + `__tests__/` にテスト → game.ts に move を追加 → UI に配線、の順。

## ドメインモデルの約束事

- 全データは JSON シリアライズ可能なプレーンオブジェクト。ID 文字列で相互参照(オブジェクト参照禁止)。型は `src/game/types.ts` に集約。
- プレイヤー ID は boardgame.io の playerID(`'0'`〜`'3'`)と一致させている。
- **駅の `connectedStationIds` / `propertyIds` は手書きしない。** `sampleData.ts` の `buildStations` が routes / properties から自動導出する。マップ編集は `src/game/data/`(regions / stations / routes / properties / events)のみ変更する。
- データ整合性は `schema.ts` の Zod スキーマ + `validateGameData`(ID 参照検査)で担保し、`__tests__/data.test.ts` が常時検証。データを編集したらこのテストが安全網になる。
- 時間進行: 全プレイヤー手番一巡 = 1ヶ月(`settlement.ts` の `advanceMonth`)。月次処理で経済 modifier の期限切れ除去、12月終了時に年次決算(`settleYear`)で物件収益を支払う。経済イベントは適用時に期限付き `EconomicModifier` になり、収益率/評価額に倍率で効く。
- ログ ID・トレード ID は `GameState` 内のカウンタ(`nextLogId` / `nextTradeOfferId`)で採番する(純粋性維持のため `Date.now()` 等は使わない)。

## 現状の制約(意図的な設計)

- ローカル(ホットシート)専用。トレードの受諾/拒否も同一画面から操作するため、move 呼び出し元の playerID 権限検証は行っていない。マルチプレイヤー化の際に stage / playerID 検証を導入する予定。
- 経済イベントは DebugPanel からの手動発火のみ(`triggerEconomicEvent` move)。
- テストは `environment: 'node'` で動く(DOM 不要のルールテストが中心)。UI テストを追加する場合は jsdom の導入が必要。
