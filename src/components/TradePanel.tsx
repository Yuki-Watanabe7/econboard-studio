import { useState } from 'react';
import type { GameState, PropertyId } from '../game/types';

interface TradePanelProps {
  G: GameState;
  currentPlayerId: string;
  onCreateOffer: (input: {
    toPlayerId: string;
    offeredCash: number;
    requestedCash: number;
    offeredPropertyIds: PropertyId[];
    requestedPropertyIds: PropertyId[];
  }) => void;
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
}

/**
 * トレードの最小 UI。
 * 現状は「他プレイヤーの物件を現金で買い取る提案」のみフォームで作成できる。
 * (ルール層はフル交換に対応済み。UI の拡張は今後の課題)
 */
export function TradePanel({
  G,
  currentPlayerId,
  onCreateOffer,
  onAccept,
  onReject,
}: TradePanelProps) {
  const [targetPropertyId, setTargetPropertyId] = useState('');
  const [offeredCash, setOfferedCash] = useState(1000);

  const offer = G.pendingTradeOffer;
  const othersProperties = G.properties.filter(
    (p) => p.ownerPlayerId !== null && p.ownerPlayerId !== currentPlayerId,
  );

  if (offer) {
    const from = G.players.find((p) => p.id === offer.fromPlayerId);
    const to = G.players.find((p) => p.id === offer.toPlayerId);
    const describeSide = (cash: number, propertyIds: PropertyId[]) => {
      const parts: string[] = [];
      if (cash > 0) parts.push(`${cash.toLocaleString()}G`);
      for (const id of propertyIds) {
        parts.push(G.properties.find((p) => p.id === id)?.name ?? id);
      }
      return parts.length > 0 ? parts.join(' + ') : 'なし';
    };
    return (
      <section className="panel">
        <h2>トレード提案(未解決)</h2>
        <p>
          {from?.name} → {to?.name}
        </p>
        <p>提示: {describeSide(offer.offeredCash, offer.offeredPropertyIds)}</p>
        <p>要求: {describeSide(offer.requestedCash, offer.requestedPropertyIds)}</p>
        <p className="muted">期限: ターン{offer.expiresOnTurn}まで</p>
        <div className="button-row">
          <button onClick={() => onAccept(offer.id)}>{to?.name} として受諾</button>
          <button onClick={() => onReject(offer.id)}>{to?.name} として拒否</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>トレード</h2>
      {othersProperties.length === 0 ? (
        <p className="muted">他プレイヤーが物件を所有すると、買い取り提案ができる</p>
      ) : (
        <div className="trade-form">
          <label>
            相手の物件:
            <select value={targetPropertyId} onChange={(e) => setTargetPropertyId(e.target.value)}>
              <option value="">選択してください</option>
              {othersProperties.map((p) => {
                const owner = G.players.find((pl) => pl.id === p.ownerPlayerId);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name}({owner?.name} 所有 / 現在価格 {p.price.toLocaleString()}G)
                  </option>
                );
              })}
            </select>
          </label>
          <label>
            提示額(G):
            <input
              type="number"
              min={0}
              step={100}
              value={offeredCash}
              onChange={(e) => setOfferedCash(Number(e.target.value))}
            />
          </label>
          <button
            disabled={targetPropertyId === ''}
            onClick={() => {
              const property = G.properties.find((p) => p.id === targetPropertyId);
              if (!property || property.ownerPlayerId === null) return;
              onCreateOffer({
                toPlayerId: property.ownerPlayerId,
                offeredCash,
                requestedCash: 0,
                offeredPropertyIds: [],
                requestedPropertyIds: [property.id],
              });
              setTargetPropertyId('');
            }}
          >
            買い取りを提案
          </button>
        </div>
      )}
    </section>
  );
}
