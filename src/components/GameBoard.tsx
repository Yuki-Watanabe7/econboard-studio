import type { BoardProps } from 'boardgame.io/react';
import type { GameState } from '../game/types';
import { MapView } from './MapView';
import { PlayerPanel } from './PlayerPanel';
import { PropertyList } from './PropertyList';
import { GameLog } from './GameLog';
import { TradePanel } from './TradePanel';
import { DebugPanel } from './DebugPanel';
import { GameOverPanel } from './GameOverPanel';
import { playerColor } from './constants';

/**
 * メイン画面。boardgame.io の Client から G / ctx / moves を受け取り、
 * 各パネルに配る。状態の解釈・変更はすべてゲーム層に委ねる。
 */
export function GameBoard({ G, ctx, moves }: BoardProps<GameState>) {
  const currentPlayerId = ctx.currentPlayer;
  const currentPlayer = G.players.find((p) => p.id === currentPlayerId);
  const destinationStation = G.map.stations.find((s) => s.id === G.currentDestinationStationId);

  return (
    <div className="app">
      <header className="app-header">
        <h1>EconBoard Studio</h1>
        <div className="turn-info">
          <span>
            {G.currentYear}年{G.currentMonth}月
          </span>
          <span>ターン {G.turnNumber}</span>
          <span className="destination-label">⚑ 目的地: {destinationStation?.name}</span>
          {G.gameOver ? (
            <span className="current-player">ゲーム終了</span>
          ) : (
            <span className="current-player" style={{ color: playerColor(currentPlayerId) }}>
              ● {currentPlayer?.name} の手番
            </span>
          )}
        </div>
      </header>

      <div className="layout">
        <main className="board-area">
          {G.gameOver && <GameOverPanel G={G} />}
          <MapView
            map={G.map}
            players={G.players.filter((p) => !p.status.bankrupt)}
            currentPlayerId={currentPlayerId}
            reachableStationIds={G.turnStage === 'awaitingDestination' ? G.reachableStationIds : []}
            destinationStationId={G.currentDestinationStationId}
            onStationClick={(stationId) => moves.moveTo(stationId)}
          />

          <div className="controls panel">
            <button
              onClick={() => moves.rollAndMove()}
              disabled={G.gameOver || G.turnStage !== 'idle'}
            >
              サイコロを振る
            </button>
            {G.lastDiceRoll !== null && <span className="dice-result">出目: {G.lastDiceRoll}</span>}
            {G.turnStage === 'awaitingDestination' && (
              <span className="hint">光っている駅をクリックして移動先を選ぶ</span>
            )}
            <button
              onClick={() => moves.endTurn()}
              disabled={G.gameOver || G.turnStage !== 'arrived'}
            >
              ターン終了
            </button>
          </div>

          <PropertyList
            G={G}
            currentPlayerId={currentPlayerId}
            canBuy={!G.gameOver && G.turnStage === 'arrived'}
            onBuy={(propertyId) => moves.buyProperty(propertyId)}
          />
        </main>

        <aside className="sidebar">
          <PlayerPanel G={G} currentPlayerId={currentPlayerId} />
          {!G.gameOver && (
            <TradePanel
              G={G}
              currentPlayerId={currentPlayerId}
              onCreateOffer={(input) => moves.createTradeOffer(input)}
              onAccept={(offerId) => moves.acceptTradeOffer(offerId)}
              onReject={(offerId) => moves.rejectTradeOffer(offerId)}
            />
          )}
          <GameLog logs={G.logs} />
          <DebugPanel
            G={G}
            onTriggerEvent={(eventId) => moves.triggerEconomicEvent(eventId)}
            onTriggerCashEvent={(cashEventId) => moves.triggerCashEvent(cashEventId)}
            onForceBankruptcy={(playerId) => moves.forceBankruptcy(playerId)}
          />
        </aside>
      </div>
    </div>
  );
}
