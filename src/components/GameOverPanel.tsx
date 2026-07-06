import type { GameState } from '../game/types';
import { playerColor } from './constants';

interface GameOverPanelProps {
  G: GameState;
}

/** ゲーム終了時の勝者と最終ランキングの表示 */
export function GameOverPanel({ G }: GameOverPanelProps) {
  const winnerNames = G.winnerPlayerIds
    .map((id) => G.players.find((p) => p.id === id)?.name ?? id)
    .join(' と ');

  return (
    <section className="panel panel--game-over">
      <h2>ゲーム終了</h2>
      <p className="winner-line">
        優勝: <strong>{winnerNames}</strong>
        {G.winnerPlayerIds.length > 1 && '(同率優勝)'}
      </p>
      <ol className="final-ranking">
        {G.finalRanking.map((entry) => {
          const player = G.players.find((p) => p.id === entry.playerId);
          return (
            <li key={entry.playerId} className="final-ranking-row">
              <span className="final-rank">{entry.rank}位</span>
              <span
                className="player-dot"
                style={{ backgroundColor: playerColor(entry.playerId) }}
              />
              <span className="player-name">{player?.name ?? entry.playerId}</span>
              {entry.bankrupt && <span className="bankrupt-badge">破産(脱落)</span>}
              <span className="final-net-worth">総資産 {entry.netWorth.toLocaleString()}G</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
