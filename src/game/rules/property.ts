import type { GameState, PlayerId, PropertyId, RuleResult } from '../types';
import { addLog, findPlayer, findProperty, updatePlayer, updateProperty } from './helpers';
import { recalculateAllNetWorth } from './settlement';

/**
 * 物件を購入する。
 * 条件: 物件が存在する / 未所有 / プレイヤーがその駅にいる / 現金が足りる
 */
export function buyProperty(
  state: GameState,
  playerId: PlayerId,
  propertyId: PropertyId,
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  const property = findProperty(state, propertyId);
  if (!property) {
    return { ok: false, reason: `物件 ${propertyId} が存在しない` };
  }
  if (property.ownerPlayerId !== null) {
    return { ok: false, reason: `${property.name} はすでに所有されている` };
  }
  if (player.currentStationId !== property.stationId) {
    return { ok: false, reason: `${property.name} は現在いる駅の物件ではない` };
  }
  if (player.cash < property.price) {
    return { ok: false, reason: `現金が足りない(必要 ${property.price}G / 所持 ${player.cash}G)` };
  }

  let next = updatePlayer(state, playerId, (p) => ({
    ...p,
    cash: p.cash - property.price,
    ownedPropertyIds: [...p.ownedPropertyIds, propertyId],
  }));
  next = updateProperty(next, propertyId, (p) => ({ ...p, ownerPlayerId: playerId }));
  next = recalculateAllNetWorth(next);
  next = addLog(
    next,
    'purchase',
    `${player.name} が ${property.name} を ${property.price}G で購入した`,
    playerId,
  );
  return { ok: true, state: next };
}
