import type { GameState, PlayerId, PropertyId, RuleResult, TradeOffer } from '../types';
import { addLog, findPlayer, updatePlayer, updateProperty } from './helpers';
import { recalculateAllNetWorth } from './settlement';

export interface TradeOfferInput {
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  offeredCash: number;
  requestedCash: number;
  offeredPropertyIds: PropertyId[];
  requestedPropertyIds: PropertyId[];
  /** 省略時はプレイヤー人数ぶんのターン(=一巡)で失効 */
  expiresOnTurn?: number;
}

function playerOwnsAll(state: GameState, playerId: PlayerId, propertyIds: PropertyId[]): boolean {
  return propertyIds.every((id) =>
    state.properties.some((p) => p.id === id && p.ownerPlayerId === playerId),
  );
}

/** トレードオファーを作成し pending 状態にする(同時に有効なのは1件のみ) */
export function createTradeOffer(state: GameState, input: TradeOfferInput): RuleResult {
  const from = findPlayer(state, input.fromPlayerId);
  const to = findPlayer(state, input.toPlayerId);
  if (!from || !to) {
    return { ok: false, reason: '存在しないプレイヤーが指定されている' };
  }
  if (from.id === to.id) {
    return { ok: false, reason: '自分自身とは取引できない' };
  }
  if (state.pendingTradeOffer && state.pendingTradeOffer.status === 'pending') {
    return { ok: false, reason: '未解決のトレードオファーがすでに存在する' };
  }
  if (input.offeredCash < 0 || input.requestedCash < 0) {
    return { ok: false, reason: '現金額は0以上でなければならない' };
  }
  const hasContent =
    input.offeredCash > 0 ||
    input.requestedCash > 0 ||
    input.offeredPropertyIds.length > 0 ||
    input.requestedPropertyIds.length > 0;
  if (!hasContent) {
    return { ok: false, reason: '空のオファーは作成できない' };
  }
  if (!playerOwnsAll(state, from.id, input.offeredPropertyIds)) {
    return { ok: false, reason: '提示した物件の中に自分が所有していないものがある' };
  }
  if (!playerOwnsAll(state, to.id, input.requestedPropertyIds)) {
    return { ok: false, reason: '要求した物件の中に相手が所有していないものがある' };
  }
  if (from.cash < input.offeredCash) {
    return { ok: false, reason: '提示額が所持金を超えている' };
  }

  const offer: TradeOffer = {
    id: `trade-${state.nextTradeOfferId}`,
    fromPlayerId: from.id,
    toPlayerId: to.id,
    offeredCash: input.offeredCash,
    requestedCash: input.requestedCash,
    offeredPropertyIds: [...input.offeredPropertyIds],
    requestedPropertyIds: [...input.requestedPropertyIds],
    status: 'pending',
    expiresOnTurn: input.expiresOnTurn ?? state.turnNumber + state.players.length,
  };

  let next: GameState = {
    ...state,
    pendingTradeOffer: offer,
    nextTradeOfferId: state.nextTradeOfferId + 1,
  };
  next = addLog(
    next,
    'trade',
    `${from.name} が ${to.name} にトレードを提案した(提示 ${offer.offeredCash}G + 物件${offer.offeredPropertyIds.length}件 / 要求 ${offer.requestedCash}G + 物件${offer.requestedPropertyIds.length}件)`,
    from.id,
  );
  return { ok: true, state: next };
}

/** オファーを受諾し、現金と物件所有権を交換する */
export function acceptTradeOffer(state: GameState, offerId: string): RuleResult {
  const offer = state.pendingTradeOffer;
  if (!offer || offer.id !== offerId || offer.status !== 'pending') {
    return { ok: false, reason: '対象のオファーが存在しないか、すでに解決済み' };
  }
  if (offer.expiresOnTurn < state.turnNumber) {
    return { ok: false, reason: 'オファーは期限切れになっている' };
  }
  const from = findPlayer(state, offer.fromPlayerId);
  const to = findPlayer(state, offer.toPlayerId);
  if (!from || !to) {
    return { ok: false, reason: '取引相手が存在しない' };
  }
  if (from.cash < offer.offeredCash) {
    return { ok: false, reason: '提案者の現金が不足している' };
  }
  if (to.cash < offer.requestedCash) {
    return { ok: false, reason: '受諾側の現金が不足している' };
  }
  if (!playerOwnsAll(state, from.id, offer.offeredPropertyIds)) {
    return { ok: false, reason: '提示物件の所有状況が変わっている' };
  }
  if (!playerOwnsAll(state, to.id, offer.requestedPropertyIds)) {
    return { ok: false, reason: '要求物件の所有状況が変わっている' };
  }

  let next = updatePlayer(state, from.id, (p) => ({
    ...p,
    cash: p.cash - offer.offeredCash + offer.requestedCash,
    ownedPropertyIds: [
      ...p.ownedPropertyIds.filter((id) => !offer.offeredPropertyIds.includes(id)),
      ...offer.requestedPropertyIds,
    ],
  }));
  next = updatePlayer(next, to.id, (p) => ({
    ...p,
    cash: p.cash + offer.offeredCash - offer.requestedCash,
    ownedPropertyIds: [
      ...p.ownedPropertyIds.filter((id) => !offer.requestedPropertyIds.includes(id)),
      ...offer.offeredPropertyIds,
    ],
  }));
  for (const propertyId of offer.offeredPropertyIds) {
    next = updateProperty(next, propertyId, (p) => ({ ...p, ownerPlayerId: offer.toPlayerId }));
  }
  for (const propertyId of offer.requestedPropertyIds) {
    next = updateProperty(next, propertyId, (p) => ({ ...p, ownerPlayerId: offer.fromPlayerId }));
  }
  next = { ...next, pendingTradeOffer: null };
  next = recalculateAllNetWorth(next);
  next = addLog(next, 'trade', `${to.name} がトレードを受諾した`, to.id);
  return { ok: true, state: next };
}

/** オファーを拒否する */
export function rejectTradeOffer(state: GameState, offerId: string): RuleResult {
  const offer = state.pendingTradeOffer;
  if (!offer || offer.id !== offerId || offer.status !== 'pending') {
    return { ok: false, reason: '対象のオファーが存在しないか、すでに解決済み' };
  }
  const to = findPlayer(state, offer.toPlayerId);
  let next: GameState = { ...state, pendingTradeOffer: null };
  next = addLog(
    next,
    'trade',
    `${to?.name ?? offer.toPlayerId} がトレードを拒否した`,
    offer.toPlayerId,
  );
  return { ok: true, state: next };
}
