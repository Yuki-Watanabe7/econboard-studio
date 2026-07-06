import type { GameState, Property, PropertyId } from '../game/types';
import { calculatePropertyIncome } from '../game/rules/economy';
import { formatRate } from '../game/rules/propertyValuation';
import { CATEGORY_LABELS, playerColor } from './constants';

/** 基準価格からの変動表示(年次価格改定の結果)。変動がなければ何も出さない */
function PriceTrend({ property }: { property: Property }) {
  if (property.price === property.basePrice) return null;
  const rate = (property.price - property.basePrice) / property.basePrice;
  const direction = rate > 0 ? 'up' : 'down';
  return (
    <span
      className={`price-trend price-trend--${direction}`}
      title={`基準価格 ${property.basePrice.toLocaleString()}G`}
    >
      {rate > 0 ? '▲' : '▼'}
      {formatRate(rate)}
    </span>
  );
}

interface PropertyListProps {
  G: GameState;
  currentPlayerId: string;
  canBuy: boolean;
  onBuy: (propertyId: PropertyId) => void;
}

/** 現在プレイヤーがいる駅の物件一覧と購入ボタン */
export function PropertyList({ G, currentPlayerId, canBuy, onBuy }: PropertyListProps) {
  const player = G.players.find((p) => p.id === currentPlayerId);
  if (!player) return null;
  const station = G.map.stations.find((s) => s.id === player.currentStationId);
  if (!station) return null;
  const properties = G.properties.filter((p) => p.stationId === station.id);

  return (
    <section className="panel">
      <h2>{station.name} の物件</h2>
      {properties.length === 0 && <p className="muted">この駅に物件はない</p>}
      <ul className="property-list">
        {properties.map((property) => {
          const income = calculatePropertyIncome(property, station.regionId, G.economicState);
          const owner = property.ownerPlayerId
            ? G.players.find((p) => p.id === property.ownerPlayerId)
            : null;
          const affordable = player.cash >= property.price;
          return (
            <li key={property.id} className="property-row">
              <div className="property-main">
                <span className="property-name">{property.name}</span>
                <span className="category-badge">
                  {CATEGORY_LABELS[property.category] ?? property.category}
                </span>
              </div>
              <div className="property-detail">
                価格 {property.price.toLocaleString()}G <PriceTrend property={property} /> /
                年間収益 {income.toLocaleString()}G({Math.round(property.baseYieldRate * 100)}%)
              </div>
              <div className="property-action">
                {owner ? (
                  <span className="owner-tag" style={{ color: playerColor(owner.id) }}>
                    {owner.name} 所有
                  </span>
                ) : canBuy ? (
                  <button
                    disabled={!affordable}
                    onClick={() => onBuy(property.id)}
                    title={affordable ? undefined : '現金が足りません'}
                  >
                    購入する
                  </button>
                ) : (
                  <span className="muted">未所有</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
