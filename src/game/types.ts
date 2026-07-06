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

/** 物件カテゴリ。将来はデータ側で自由に追加できるよう string union に留める */
export type PropertyCategory = 'food' | 'tourism' | 'industry' | 'retail' | 'tech';

/**
 * 駅マス種別。到着時の効果を決める。
 * - normal: 到着効果なし
 * - event: 到着時に経済イベントが1件発生する
 * 将来 'card' | 'bonus' | 'tax' などを追加する想定(schema.ts の enum も併せて更新する)
 */
export type StationType = 'normal' | 'event';

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
  /** 購入価格(通貨単位: G) */
  price: number;
  /** 年間の基礎収益率(0.10 = 価格の10%/年) */
  baseYieldRate: number;
  ownerPlayerId: PlayerId | null;
  /** 1(安全)〜3(ハイリスク)。将来のイベント連動用 */
  riskLevel: 1 | 2 | 3;
  /** 1(低成長)〜3(高成長)。将来の価格変動用 */
  growthPotential: 1 | 2 | 3;
  description: string;
}

export interface PlayerStatusFlags {
  skipNextTurn: boolean;
  bankrupt: boolean;
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

export type GameLogType = 'system' | 'move' | 'purchase' | 'settlement' | 'trade' | 'economy';

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
  /** 直近のサイコロの出目(手番開始時は null) */
  lastDiceRoll: number | null;
  /** 出目確定後に選択可能な到達先(awaitingDestination の間のみ有効) */
  reachableStationIds: StationId[];
  turnStage: TurnStage;
  /** ログ ID 採番用カウンタ(純粋関数で採番するため状態に持つ) */
  nextLogId: number;
  /** トレードオファー ID 採番用カウンタ */
  nextTradeOfferId: number;
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
