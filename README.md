# EconBoard Studio

編集可能な**経済ボードゲーム基盤**(エンジン)です。

路線上を移動し、駅の物件を購入し、決算で収益を得て、総資産を競う——というターン制経済ゲームの「状態遷移モデル」を核とし、路線図・駅・物件・経済イベントを**データとして編集・拡張できる**ことを目的としています。

> **重要:** 本プロジェクトは既存の市販ゲームのクローンではありません。ジャンルとしての「すごろく型経済ゲーム」を、独自ルール・独自データで設計するための土台です。

## 技術スタック

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)(ビルド/開発サーバ)
- [boardgame.io](https://boardgame.io/)(ターン制ゲームの状態管理)
- SVG による路線図描画(ゲームエンジン非依存)
- [Vitest](https://vitest.dev/)(テスト)
- [Zod](https://zod.dev/)(ゲームデータのスキーマ検証)
- ESLint / Prettier

## 起動方法

```bash
npm install
npm run dev      # 開発サーバ起動(http://localhost:5173)
```

その他のコマンド:

```bash
npm run test     # テスト実行(Vitest)
npm run lint     # ESLint
npm run build    # 型チェック + 本番ビルド
npm run format   # Prettier で整形
```

## 現在できること(MVP)

- 2〜4人のローカル(ホットシート)プレイ
- SVG 路線図上に駅・路線・プレイヤー位置を表示
- サイコロを振り、出目ちょうどの歩数で到達できる駅を選んで移動
  (直前の駅へは引き返せない。行き止まりのみ折り返し可)
- 到着駅の物件を購入
- 全プレイヤーの手番が一巡すると1ヶ月進行。12月終了時に**年次決算**(保有物件の収益が現金に加算)
- **ゲーム終了条件**: 指定年数(既定: 3年)の最終年の年次決算後、総資産ランキングで勝敗を確定
  (同額1位は同率優勝。終了後は移動・購入・トレード・イベント発火のすべてが無効)
- 経済イベントの適用(開発用パネルから手動発火)
  - 地域好況: 対象地域の物件収益率が一定期間上昇
  - カテゴリ不況: 対象カテゴリの物件評価額が一定期間低下
- プレイヤー間トレードの最小実装(物件の現金買い取り提案 → 受諾/拒否)
- ゲームログ表示・GameState を確認できる開発用パネル

### 手番の基本フロー

各プレイヤーの手番は必ず次の順で進みます。

1. **サイコロを振る**(`rollAndMove`)— 出目ちょうどで到達できる駅がハイライトされる
2. **行き先を選んで移動**(`moveTo`)— ハイライトされた駅から1つ選ぶ
3. **到着後の行動(任意)** — 到着駅の物件購入、トレード提案など
4. **ターン終了**(`endTurn`)— 次のプレイヤーへ手番が移る

ターン終了は**移動を終えた後にのみ**行えます。サイコロを振る前や、行き先を選んでいない
途中の状態では手番を終了できません(手番のパスは仕様として存在しません)。

## アーキテクチャ

本体は「画面」ではなく「ゲーム状態遷移モデル」です。レイヤーを次のように分けています。

```text
src/
  game/
    types.ts          # ドメインモデルの型定義(すべて JSON シリアライズ可能)
    schema.ts         # Zod スキーマ + ID 参照の整合性検査
    sampleData.ts     # データの組み立て(接続情報・物件紐付けの自動導出)
    initialState.ts   # 初期 GameState の生成
    game.ts           # boardgame.io 統合(move 定義のみ。ルールは持たない)
    data/             # 編集対象のゲームデータ
      regions.ts      #   地域
      stations.ts     #   駅(座標・所属地域)
      routes.ts       #   路線(無向エッジ)
      properties.ts   #   物件
      events.ts       #   経済イベント定義
    rules/            # 純粋関数のルール層(UI/boardgame.io 非依存)
      movement.ts     #   サイコロ・到達可能駅・移動
      property.ts     #   物件購入
      settlement.ts   #   月次/年次決算・総資産計算・カレンダー進行
      trade.ts        #   トレードオファーの作成/受諾/拒否
      economy.ts      #   経済イベント・収益率/評価額の倍率計算
    __tests__/        # ルールのテスト(仕様書を兼ねる)
  components/         # React UI(差し替え可能な表示層)
  app/App.tsx         # 人数選択 + boardgame.io クライアント起動
```

### 設計上の判断

- **ルールはすべて純粋関数**: `rules/` の関数は `GameState` を受け取り、新しい `GameState` を返すか、`{ ok: false, reason }` で失敗理由を返します。boardgame.io 層(`game.ts`)は「move 引数の受け渡しと INVALID_MOVE への変換」のみを行い、ルールを一切持ちません。これにより UI や boardgame.io を差し替えてもゲームロジックはそのまま使えます。
- **データは JSON に近い構造**: 型はすべてプレーンオブジェクトで、ID 文字列で相互参照します。将来 JSON ファイルやエディタ UI からの読み込みにそのまま移行できます。
- **冗長情報の自動導出**: 駅の `connectedStationIds` と `propertyIds` は手書きせず、路線(`routes.ts`)と物件(`properties.ts`)から組み立て時に導出します(`sampleData.ts` の `buildStations`)。編集時の参照ミスを構造的に防ぐためです。
- **乱数の注入**: `rollDice` は乱数生成器を引数で受け取ります。テストでは固定値、実行時は boardgame.io の `random` プラグイン(リプレイ・シード対応)を使います。
- **時間の進行**: 全プレイヤーの手番一巡 = 1ヶ月。月次処理(`settleMonth`)で期限切れ経済効果の除去と総資産再計算、12月終了時の年次決算(`settleYear`)で物件収益を支払います。
- **ゲーム終了**: `gameLengthYears`(既定3年、`createInitialState` のオプションで変更可)で指定した最終年の年次決算後、総資産を再計算して最終順位を確定します(`finalizeGame`)。勝者・順位は `GameState` の `winnerPlayerIds` / `finalRanking` に保持され、同額1位は複数勝者になります。boardgame.io の `endIf` ではなく `GameState` 側で終了状態を持つことで、保存・リプレイ・UI 表示から扱いやすくしています。

## ゲームデータ設計

| 概念          | 型                                                                          | 概要                                         |
| ------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| GameMap       | `regions` / `stations` / `edges`                                            | 路線図はグラフ。駅がノード、路線が無向エッジ |
| Station       | `id, name, regionId, position, connectedStationIds, propertyIds`            | SVG 座標を持つ                               |
| Property      | `price, baseYieldRate, category, riskLevel, growthPotential, ownerPlayerId` | 年間収益 = 価格 × 収益率 × 経済倍率          |
| Player        | `cash, currentStationId, ownedPropertyIds, netWorth, status`                | 総資産 = 現金 + 物件評価額                   |
| TradeOffer    | `offeredCash/PropertyIds, requestedCash/PropertyIds, status, expiresOnTurn` | pending は同時に1件のみ                      |
| EconomicEvent | `effects[](地域 or カテゴリ × 収益/評価倍率), durationMonths`               | 適用すると有効期限付き modifier になる       |

サンプルデータはすべて**架空都市「エコノポリス」**のものです(駅10・物件22・地域3・イベント2)。

## 将来的な編集機能の設計方針

現在の `src/game/data/` がそのまま「編集対象データ」です。エディタ実装時は次の方針を想定しています。

1. **データの外部化**: `data/*.ts` を JSON ファイル化し、`schema.ts` の Zod スキーマで読み込み時に検証する(スキーマと整合性検査 `validateGameData` は実装済み)
2. **マップエディタ**: SVG 上で駅のドラッグ配置・エッジの接続編集 → `GameMap` JSON を出力
3. **物件/イベントエディタ**: フォームベースで `Property` / `EconomicEvent` を編集
4. **複数マップ対応**: `GameMap.id` 単位でマップを切り替え、初期状態生成(`createInitialState`)にマップを注入する

## 今後実装したいこと

- [ ] 目的地システム(目的地到着ボーナス)
- [ ] 駅マス種別(イベントマス・カードマスなど)による経済イベントの自動発生
- [ ] 物件価格の変動(growthPotential / riskLevel を使った年次変動)
- [ ] トレード UI の拡充(物件同士の交換・複数物件・現金要求)
- [x] ゲーム終了条件(指定年数経過で総資産1位が勝利)
- [ ] 破産処理
- [ ] ゲーム年数(`gameLengthYears`)をセットアップ UI から変更できるようにする
- [ ] マップ/物件データの JSON 外部化とエディタ UI
- [ ] boardgame.io のマルチプレイヤー対応(Local → SocketIO)
- [ ] プレイヤーごとの視点分離(トレード受諾権限の厳密化)

## IP / アセットに関する注意

- 既存作品のキャラクター、名称、画像、音声、カード名、固有演出は**使用しません**。
- 既存ゲームのルールをそのまま再現するのではなく、**独自の経済ボードゲーム**として設計します。
- サンプルデータの駅名・物件名・イベント名はすべて架空・一般名詞ベースです。今後データを追加する際も同様の方針を守ってください。

## 既知の制約

- ローカル(1画面共有)プレイ専用。トレードの受諾/拒否も同じ画面から操作するため、move 呼び出し元の権限検証は行っていない(マルチプレイヤー化の際に stage/playerID 検証を導入予定)
- 経済イベントは開発用パネルからの手動発火のみ
- 物件の売却(銀行への返却)は未実装
- ゲーム年数は固定(既定3年)。`createInitialState` / boardgame.io の setupData では変更できるが、セットアップ UI は未対応
