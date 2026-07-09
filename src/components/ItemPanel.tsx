import type { GameState } from '../game/types';
import { isItemUsableNow } from '../game/rules/items';
import { sampleItems } from '../game/sampleData';

interface ItemPanelProps {
  G: GameState;
  currentPlayerId: string;
  onUseItem: (instanceId: string) => void;
}

/** 現在手番のプレイヤーの所持アイテム一覧と使用ボタン */
export function ItemPanel({ G, currentPlayerId, onUseItem }: ItemPanelProps) {
  const player = G.players.find((p) => p.id === currentPlayerId);
  if (!player) return null;

  return (
    <section className="panel">
      <h2>所持アイテム</h2>
      {player.inventory.length === 0 ? (
        <p className="muted">アイテムを所持していない</p>
      ) : (
        <ul className="item-list">
          {player.inventory.map((inventoryItem) => {
            const definition = sampleItems.find((d) => d.id === inventoryItem.itemId);
            if (!definition) return null;
            const usable =
              !G.gameOver && !player.status.bankrupt && isItemUsableNow(definition, G.turnStage);
            return (
              <li key={inventoryItem.instanceId} className="item-row">
                <div className="item-main">
                  <span className="item-name">{definition.name}</span>
                </div>
                <p className="muted item-description">{definition.description}</p>
                <button
                  disabled={!usable}
                  onClick={() => onUseItem(inventoryItem.instanceId)}
                  title={usable ? undefined : '今のタイミングでは使用できない'}
                >
                  使用する
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
