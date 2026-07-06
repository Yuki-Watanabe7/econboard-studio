import type { GameLogEntry } from '../game/types';

interface GameLogProps {
  logs: GameLogEntry[];
  maxEntries?: number;
}

/** ゲームログ(新しいものが上) */
export function GameLog({ logs, maxEntries = 30 }: GameLogProps) {
  const recent = logs.slice(-maxEntries).reverse();
  return (
    <section className="panel">
      <h2>ログ</h2>
      <ul className="game-log">
        {recent.map((entry) => (
          <li key={entry.id} className={`log-entry log-entry--${entry.type}`}>
            <span className="log-time">
              {entry.year}年{entry.month}月
            </span>
            <span className="log-message">{entry.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
