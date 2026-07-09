import type {
  GameState,
  ItemDefinition,
  ItemId,
  ItemUsageTiming,
  Player,
  PlayerId,
  RuleResult,
  ShopOffer,
  TurnStage,
} from '../types';
import { addLog, findPlayer, updatePlayer } from './helpers';
import { chargePlayer } from './bankruptcy';
import { applyDiceRoll } from './movement';
import { recalculateAllNetWorth } from './settlement';

/**
 * アイテムの所持上限。アイテム入手マス・ショップでの入手はこの上限で頭打ちになる
 * (初期配布 grantItem はゲームルールではなくセットアップのため上限の対象外)。
 */
export const MAX_INVENTORY_SIZE = 3;

/** インベントリが所持上限に達しているか(これ以上入手できない) */
export function isInventoryFull(player: Player): boolean {
  return player.inventory.length >= MAX_INVENTORY_SIZE;
}

/**
 * アイテムの所持・使用・消費。
 *
 * アイテム定義(ItemDefinition, data/items.ts)と所持(PlayerInventoryItem, Player.inventory)は
 * 分けて扱う。同じアイテムを複数所持できるよう、所持側は定義 ID とは別のインスタンス ID を持つ。
 * 使用可能タイミングは GameState.turnStage から導出する(TIMING_BY_TURN_STAGE)。
 */

/** turnStage と使用タイミングの対応。turnStage を追加したら併せて更新する */
const TIMING_BY_TURN_STAGE: Record<TurnStage, ItemUsageTiming> = {
  idle: 'beforeRoll',
  awaitingDestination: 'afterRoll',
  arrived: 'afterArrival',
};

/** アイテムが現在の手番状態で使用可能か */
export function isItemUsableNow(definition: ItemDefinition, turnStage: TurnStage): boolean {
  return definition.usableTimings.includes(TIMING_BY_TURN_STAGE[turnStage]);
}

/**
 * 新しい所持アイテムインスタンスをプレイヤーに付与する。
 * 初期配布(initialState.ts)や将来の報酬付与から使う想定。
 */
export function grantItem(
  state: GameState,
  playerId: PlayerId,
  itemId: ItemDefinition['id'],
): GameState {
  const instanceId = `item-${state.nextItemInstanceId}`;
  let next: GameState = { ...state, nextItemInstanceId: state.nextItemInstanceId + 1 };
  next = updatePlayer(next, playerId, (p) => ({
    ...p,
    inventory: [...p.inventory, { instanceId, itemId }],
  }));
  return next;
}

/**
 * 入手候補から1つを一様ランダムで選ぶ。候補が空なら null。
 * MVP では一様ランダム(stationEffects.ts の selectEconomicEvent と同じ方針)。
 */
export function selectRandomItem(itemPool: ItemId[], random: () => number): ItemId | null {
  if (itemPool.length === 0) {
    return null;
  }
  const index = Math.min(Math.floor(random() * itemPool.length), itemPool.length - 1);
  return itemPool[index];
}

/**
 * アイテム入手マス(stationType: 'item')到着時の処理。入手候補から1つを抽選して付与する。
 * - 所持上限に達している場合は入手せず、その旨をログに残す
 * - 破産プレイヤーは入手対象外(手番は自動スキップされるため通常は到達しないが防御的に扱う)
 * - 入手候補が未登録なら何もしない
 * 失敗(ok:false)は「プレイヤー/アイテム定義が見つからない」異常時のみで、
 * 通常の入手可否はすべて ok:true(state を返す)で表現する。
 */
export function acquireRandomItem(
  state: GameState,
  playerId: PlayerId,
  items: ItemDefinition[],
  itemPool: ItemId[],
  random: () => number,
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: true, state };
  }
  if (isInventoryFull(player)) {
    return {
      ok: true,
      state: addLog(
        state,
        'item',
        `${player.name} は所持上限(${MAX_INVENTORY_SIZE}個)に達しており、アイテムを入手できなかった`,
        playerId,
      ),
    };
  }

  const itemId = selectRandomItem(itemPool, random);
  if (!itemId) {
    return { ok: true, state };
  }
  const definition = items.find((d) => d.id === itemId);
  if (!definition) {
    return { ok: false, reason: `アイテム定義 ${itemId} が見つからない` };
  }

  let next = grantItem(state, playerId, itemId);
  next = addLog(
    next,
    'item',
    `${player.name} はアイテムマスで ${definition.name} を入手した`,
    playerId,
  );
  return { ok: true, state: next };
}

/**
 * ショップマス(stationType: 'shop')でのアイテム購入。
 * 条件: プレイヤーが存在する / 破産していない / 所持上限に達していない / 現金が足りる。
 * 支払いは chargePlayer に委譲する(破産・支払いイベントとの整合性を保つ)。
 * ただしショップ購入で破産させないため、現金不足は購入不可(ok:false)として弾き、
 * chargePlayer には支払い可能な金額のみを渡す。
 */
export function buyShopItem(
  state: GameState,
  playerId: PlayerId,
  offer: ShopOffer,
  items: ItemDefinition[],
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: false, reason: `${player.name} は破産しているため購入できない` };
  }
  const definition = items.find((d) => d.id === offer.itemId);
  if (!definition) {
    return { ok: false, reason: `アイテム定義 ${offer.itemId} が見つからない` };
  }
  if (isInventoryFull(player)) {
    return { ok: false, reason: `所持上限(${MAX_INVENTORY_SIZE}個)のため購入できない` };
  }
  if (player.cash < offer.price) {
    return { ok: false, reason: '現金が足りないため購入できない' };
  }

  const charged = chargePlayer(state, playerId, offer.price, `${definition.name}の購入`);
  if (!charged.ok) {
    return charged;
  }
  let next = grantItem(charged.state, playerId, offer.itemId);
  next = addLog(
    next,
    'item',
    `${player.name} はショップで ${definition.name} を購入した`,
    playerId,
  );
  return { ok: true, state: next };
}

/**
 * アイテム効果を適用する。効果種別ごとの分岐は、効果種別が増えたらここに追加する。
 * サイコロ系の効果(multiRoll/rerollDice)は乱数を必要とするため random を注入する。
 */
function applyItemEffect(
  state: GameState,
  playerId: PlayerId,
  definition: ItemDefinition,
  random: () => number,
): RuleResult {
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  const effect = definition.effect;
  switch (effect.type) {
    case 'grantCash': {
      let next = updatePlayer(state, playerId, (p) => ({ ...p, cash: p.cash + effect.amount }));
      next = addLog(
        next,
        'item',
        `${player.name} は ${definition.name} を使用し、${effect.amount.toLocaleString()}G を受け取った`,
        playerId,
      );
      return { ok: true, state: recalculateAllNetWorth(next) };
    }
    case 'multiRoll': {
      const rolled = applyDiceRoll(state, playerId, effect.diceCount, random);
      if (!rolled.ok) return rolled;
      const next = addLog(
        rolled.state,
        'item',
        `${player.name} は ${definition.name} を使用した`,
        playerId,
      );
      return { ok: true, state: next };
    }
    case 'rerollDice': {
      const diceCount = state.lastDiceRolls.length || 1;
      const rerolled = applyDiceRoll(state, playerId, diceCount, random, { isReroll: true });
      if (!rerolled.ok) return rerolled;
      const next = addLog(
        rerolled.state,
        'item',
        `${player.name} は ${definition.name} を使用した`,
        playerId,
      );
      return { ok: true, state: next };
    }
  }
}

/**
 * 所持アイテムを使用する。
 * 条件: プレイヤーが存在する / 破産していない / ゲーム終了後でない /
 *       アイテムを所持している / 現在の手番状態で使用可能なタイミングである
 * 使用後はインベントリから消費され、効果を適用してログに残す。
 * random はサイコロ系の効果(multiRoll/rerollDice)でのみ使われる。
 *
 * 関数名は `use` から始めると ESLint(react-hooks)が React Hook と誤認するため、
 * `handleUseItem` としている。
 */
export function handleUseItem(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  itemDefinitions: ItemDefinition[],
  random: () => number,
): RuleResult {
  if (state.gameOver) {
    return { ok: false, reason: 'ゲームは終了しているためアイテムを使用できない' };
  }
  const player = findPlayer(state, playerId);
  if (!player) {
    return { ok: false, reason: `プレイヤー ${playerId} が存在しない` };
  }
  if (player.status.bankrupt) {
    return { ok: false, reason: `${player.name} は破産しているためアイテムを使用できない` };
  }

  const inventoryItem = player.inventory.find((i) => i.instanceId === instanceId);
  if (!inventoryItem) {
    return { ok: false, reason: `アイテム ${instanceId} を所持していない` };
  }
  const definition = itemDefinitions.find((d) => d.id === inventoryItem.itemId);
  if (!definition) {
    return { ok: false, reason: `アイテム定義 ${inventoryItem.itemId} が見つからない` };
  }
  if (!isItemUsableNow(definition, state.turnStage)) {
    return { ok: false, reason: `${definition.name} は今のタイミングでは使用できない` };
  }

  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    inventory: p.inventory.filter((i) => i.instanceId !== instanceId),
  }));
  return applyItemEffect(next, playerId, definition, random);
}
