/**
 * ドメインモデルの型定義。
 *
 * 設計方針:
 * - すべて JSON シリアライズ可能なプレーンなデータ構造にする
 *   (boardgame.io の状態同期・保存、および将来のマップエディタでの編集を容易にするため)
 * - ID は文字列で参照し合う。オブジェクト参照は持たない。
 */

export type RegionId = string;
export type StationId = string;
export type PropertyId = string;
export type PlayerId = string;
export type EconomicEventId = string;
export type CashEventId = string;
export type ItemId = string;

/** 物件カテゴリ。将来はデータ側で自由に追加できるよう string union に留める */
export type PropertyCategory = 'food' | 'tourism' | 'industry' | 'retail' | 'tech';

/**
 * 駅マス種別。到着時の効果を決める。
 * - normal: 到着効果なし
 * - event: 到着時に経済イベントが1件発生する
 * - cashEvent: 到着時に所持金イベント(現金の増減)が1件発生する
 * - item: 到着時にランダムでアイテムを1つ獲得する(所持上限に達している場合は入手できない)
 * - shop: 到着後、現金を払ってアイテムを購入できる(自動発生する効果はない)
 * 将来 'card' | 'bonus' などを追加する想定(schema.ts の enum も併せて更新する)
 */
export type StationType = 'normal' | 'event' | 'cashEvent' | 'item' | 'shop';

export interface Region {
  id: RegionId;
  name: string;
}

export interface Station {
  id: StationId;
  name: string;
  regionId: RegionId;
  /** 駅マス種別。到着時の効果(経済イベント発生など)を決める */
  stationType: StationType;
  /** SVG 描画用の論理座標 */
  position: { x: number; y: number };
  /** 接続駅。edges と冗長だが、移動計算とデータ編集の双方で扱いやすいよう保持する */
  connectedStationIds: StationId[];
  propertyIds: PropertyId[];
}

/** 路線は無向エッジとして扱う */
export interface RouteEdge {
  id: string;
  fromStationId: StationId;
  toStationId: StationId;
}

export interface GameMap {
  id: string;
  name: string;
  regions: Region[];
  stations: Station[];
  edges: RouteEdge[];
}

export interface Property {
  id: PropertyId;
  stationId: StationId;
  name: string;
  category: PropertyCategory;
  /**
   * 現在価格(通貨単位: G)。購入価格・収益計算・評価額の基準。
   * 年次の価格改定(rules/propertyValuation.ts)で変動する。
   */
  price: number;
  /**
   * 基準価格(編集データ由来の初期価格)。ゲーム中は変化しない。
   * 価格改定の下限(最低価格)と UI の変動表示の基準に使う。
   * データ編集時は price のみ書き、組み立て時に自動導出する(sampleData.ts)。
   */
  basePrice: number;
  /** 年間の基礎収益率(0.10 = 価格の10%/年) */
  baseYieldRate: number;
  ownerPlayerId: PlayerId | null;
  /** 1(安全)〜3(ハイリスク)。年次価格改定の振れ幅に効く */
  riskLevel: 1 | 2 | 3;
  /** 1(低成長)〜3(高成長)。年次価格改定の期待上昇率に効く */
  growthPotential: 1 | 2 | 3;
  description: string;
}

/**
 * 編集対象の物件データ。basePrice は初期 price と常に等しいため手書きさせず、
 * データ組み立て時(sampleData.ts の buildProperties)に自動導出する。
 */
export type PropertySeed = Omit<Property, 'basePrice'>;

export interface PlayerStatusFlags {
  skipNextTurn: boolean;
  bankrupt: boolean;
}

/**
 * アイテムを使用できる手番のタイミング。GameState.turnStage と対応させる
 * (idle → beforeRoll, awaitingDestination → afterRoll, arrived → afterArrival)。
 */
export type ItemUsageTiming = 'beforeRoll' | 'afterRoll' | 'afterArrival';

/**
 * アイテムの効果。将来効果種別を追加する場合はここに union を足し、
 * rules/items.ts の適用処理と schema.ts の itemEffectSchema を併せて更新する。
 */
export type ItemEffect =
  | { type: 'grantCash'; amount: number }
  /** サイコロを diceCount 個振り、合計歩数で移動候補を計算する(rollAndMove の代わり) */
  | { type: 'multiRoll'; diceCount: number }
  /** 直近のサイコロ(個数はそのまま)を振り直し、移動候補を再計算する */
  | { type: 'rerollDice' };

/** 編集可能なアイテム定義(データ)。所持側は PlayerInventoryItem で表現する */
export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  /** このいずれかのタイミングに該当すれば使用できる */
  usableTimings: ItemUsageTiming[];
  effect: ItemEffect;
}

/**
 * プレイヤーが所持するアイテムの1インスタンス。
 * 同じアイテムを複数所持できるよう、定義 ID とは別に所持インスタンス ID を持つ。
 */
export interface PlayerInventoryItem {
  instanceId: string;
  itemId: ItemId;
}

/**
 * ショップマスの品揃え1件(編集可能なデータ)。
 * 到着後、現金を price 支払うことで対象アイテムを購入できる(rules/items.ts の buyShopItem)。
 */
export interface ShopOffer {
  itemId: ItemId;
  /** 購入価格(通貨単位: G) */
  price: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  cash: number;
  currentStationId: StationId;
  ownedPropertyIds: PropertyId[];
  /** 現金 + 保有物件の評価額。決算・購入・売買のたびに再計算する */
  netWorth: number;
  status: PlayerStatusFlags;
  inventory: PlayerInventoryItem[];
}

export type TradeOfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface TradeOffer {
  id: string;
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  /** from → to へ渡す現金 */
  offeredCash: number;
  /** to → from へ要求する現金 */
  requestedCash: number;
  /** from が手放す物件 */
  offeredPropertyIds: PropertyId[];
  /** to に要求する物件 */
  requestedPropertyIds: PropertyId[];
  status: TradeOfferStatus;
  /** このターン番号を過ぎると失効する */
  expiresOnTurn: number;
}

/** 経済イベントの効果対象 */
export interface EconomicEffectTarget {
  type: 'region' | 'category';
  id: string; // RegionId または PropertyCategory
}

/** イベント定義に含まれる個々の効果 */
export interface EconomicEffect {
  target: EconomicEffectTarget;
  /** 収益率に掛かる倍率(省略時 1.0) */
  yieldMultiplier?: number;
  /** 評価額に掛かる倍率(省略時 1.0) */
  valueMultiplier?: number;
}

/** 編集可能なイベント定義(データ) */
export interface EconomicEvent {
  id: EconomicEventId;
  name: string;
  description: string;
  effects: EconomicEffect[];
  /** 効果の持続月数。null なら永続 */
  durationMonths: number | null;
}

/** ゲーム内で現在有効な効果(イベント適用時に生成される) */
export interface EconomicModifier {
  sourceEventId: EconomicEventId;
  target: EconomicEffectTarget;
  yieldMultiplier: number;
  valueMultiplier: number;
  /** この年月の decay 処理(settleMonth)で除去される。null なら永続 */
  expiresAfter: { year: number; month: number } | null;
}

export interface EconomicState {
  activeModifiers: EconomicModifier[];
}

/**
 * 所持金イベントの効果。MVP では1イベント = 単一効果。
 * 支払い系(payment*)は既存の支払い・破産処理(rules/bankruptcy.ts の chargePlayer)を
 * 再利用して解決する。効果種別を追加したら schema.ts の cashEventEffectSchema と
 * rules/cashEvents.ts の適用処理を併せて更新する。
 */
export type CashEventEffect =
  /** 到着プレイヤーへの固定額の収入(臨時収入など) */
  | { type: 'income'; amount: number }
  /** 到着プレイヤーの固定額の支払い(税・罰金など) */
  | { type: 'payment'; amount: number }
  /** 到着プレイヤーの保有物件数に比例した支払い(維持費など) */
  | { type: 'paymentPerProperty'; amountPerProperty: number }
  /** 到着プレイヤーの総資産に比例した支払い(資産税など)。rate は 0〜1 の割合 */
  | { type: 'paymentNetWorthRate'; rate: number }
  /** 現金が最も少ない(破産していない)プレイヤーへの収入(補助金など) */
  | { type: 'incomeToPoorest'; amount: number };

/** 編集可能な所持金イベント定義(データ) */
export interface CashEvent {
  id: CashEventId;
  name: string;
  description: string;
  effect: CashEventEffect;
}

export type GameLogType =
  | 'system'
  | 'move'
  | 'purchase'
  | 'settlement'
  | 'trade'
  | 'economy'
  | 'destination'
  | 'cashEvent'
  | 'item';

export interface GameLogEntry {
  id: number;
  turnNumber: number;
  year: number;
  month: number;
  type: GameLogType;
  message: string;
  playerId?: PlayerId;
}

/** 手番内の進行状態 */
export type TurnStage = 'idle' | 'awaitingDestination' | 'arrived';

/** ゲーム終了時の最終順位1件分 */
export interface FinalRankingEntry {
  playerId: PlayerId;
  netWorth: number;
  /** 1始まり。同額は同順位とし、次の順位は人数分飛ぶ(1,1,3 形式) */
  rank: number;
  /** 破産による脱落者は総資産に関わらず非破産者より下位になる */
  bankrupt: boolean;
}

export interface GameState {
  players: Player[];
  currentPlayerId: PlayerId;
  turnNumber: number;
  currentMonth: number;
  currentYear: number;
  map: GameMap;
  properties: Property[];
  logs: GameLogEntry[];
  pendingTradeOffer: TradeOffer | null;
  economicState: EconomicState;
  /**
   * 現在の目的地駅(全プレイヤー共通)。到着したプレイヤーは報酬を得て、
   * 直前と異なる駅から次の目的地が抽選される(rules/destination.ts)
   */
  currentDestinationStationId: StationId;
  /** 直近のサイコロの出目の合計(手番開始時は null) */
  lastDiceRoll: number | null;
  /**
   * 直近のサイコロの個々の出目(手番開始時は空配列)。
   * 通常のサイコロは1個、複数サイコロ系アイテム使用時はその個数分になる。
   * reroll-dice はこの配列の長さと同じ個数を振り直す。
   */
  lastDiceRolls: number[];
  /** 出目確定後に選択可能な到達先(awaitingDestination の間のみ有効) */
  reachableStationIds: StationId[];
  turnStage: TurnStage;
  /** ログ ID 採番用カウンタ(純粋関数で採番するため状態に持つ) */
  nextLogId: number;
  /** トレードオファー ID 採番用カウンタ */
  nextTradeOfferId: number;
  /** アイテム所持インスタンス ID 採番用カウンタ */
  nextItemInstanceId: number;
  /** ゲームの長さ(年数)。この年の年次決算をもって終了する */
  gameLengthYears: number;
  /** 最終年の年次決算後に true。以降すべての move は無効 */
  gameOver: boolean;
  /** 同額1位を許容するため配列で持つ(gameOver までは空) */
  winnerPlayerIds: PlayerId[];
  /** 総資産降順の最終順位(gameOver までは空) */
  finalRanking: FinalRankingEntry[];
}

/**
 * ルール関数の返り値。失敗理由を型で表現し、boardgame.io 層で INVALID_MOVE に変換する。
 */
export type RuleResult<T = GameState> = { ok: true; state: T } | { ok: false; reason: string };
