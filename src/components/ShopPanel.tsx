import type { GameState } from '../game/types';
import { MAX_INVENTORY_SIZE, isInventoryFull } from '../game/rules/items';
import { sampleItems, shopOffers } from '../game/sampleData';

interface ShopPanelProps {
  G: GameState;
  currentPlayerId: string;
  onBuy: (itemId: string) => void;
}

/**
 * ショップマス到着時に表示する購入パネル。
 * 現在手番のプレイヤーがショップマス(stationType: 'shop')にいる場合のみ描画する。
 */
export function ShopPanel({ G, currentPlayerId, onBuy }: ShopPanelProps) {
  const player = G.players.find((p) => p.id === currentPlayerId);
  if (!player) return null;

  const station = G.map.stations.find((s) => s.id === player.currentStationId);
  if (station?.stationType !== 'shop') return null;

  const canBuyHere = !G.gameOver && G.turnStage === 'arrived' && !player.status.bankrupt;
  const full = isInventoryFull(player);

  return (
    <section className="panel">
      <h2>ショップ({station.name})</h2>
      {full && (
        <p className="muted">所持上限({MAX_INVENTORY_SIZE}個)に達しているため購入できません。</p>
      )}
      <ul className="item-list">
        {shopOffers.map((offer) => {
          const definition = sampleItems.find((d) => d.id === offer.itemId);
          if (!definition) return null;
          const affordable = player.cash >= offer.price;
          const usable = canBuyHere && !full && affordable;
          const reason = !canBuyHere
            ? '今は購入できない'
            : full
              ? '所持上限に達している'
              : !affordable
                ? '現金が足りない'
                : undefined;
          return (
            <li key={offer.itemId} className="item-row">
              <div className="item-main">
                <span className="item-name">{definition.name}</span>
                <span className="shop-price">{offer.price.toLocaleString()}G</span>
              </div>
              <p className="muted item-description">{definition.description}</p>
              <button disabled={!usable} onClick={() => onBuy(offer.itemId)} title={reason}>
                購入する
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
