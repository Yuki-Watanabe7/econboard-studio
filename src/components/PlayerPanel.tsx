import type { GameState } from '../game/types';
import { playerColor } from './constants';

interface PlayerPanelProps {
  G: GameState;
  currentPlayerId: string;
}

/** 全プレイヤーの現金・保有物件数・総資産の一覧 */
export function PlayerPanel({ G, currentPlayerId }: PlayerPanelProps) {
  return (
    <section className="panel">
      <h2>プレイヤー状況</h2>
      <ul className="player-list">
        {G.players.map((player) => {
          const station = G.map.stations.find((s) => s.id === player.currentStationId);
          return (
            <li
              key={player.id}
              className={`player-row ${player.id === currentPlayerId ? 'player-row--active' : ''}`}
            >
              <span className="player-dot" style={{ backgroundColor: playerColor(player.id) }} />
              <span className="player-name">{player.name}</span>
              <span className="player-station">@{station?.name ?? '?'}</span>
              <span className="player-stats">
                現金 {player.cash.toLocaleString()}G / 物件 {player.ownedPropertyIds.length}件 /
                総資産 {player.netWorth.toLocaleString()}G
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
