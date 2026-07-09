import type {
  GameState,
  ItemDefinition,
  ItemUsageTiming,
  PlayerId,
  RuleResult,
  TurnStage,
} from '../types';
import { addLog, findPlayer, updatePlayer } from './helpers';
import { applyDiceRoll } from './movement';
import { recalculateAllNetWorth } from './settlement';

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
