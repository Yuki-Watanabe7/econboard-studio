import type { GameState } from '../game/types';
import { sampleCashEvents, sampleEvents } from '../game/sampleData';

interface DebugPanelProps {
  G: GameState;
  onTriggerEvent: (eventId: string) => void;
  onTriggerCashEvent: (cashEventId: string) => void;
  onForceBankruptcy: (playerId: string) => void;
}

/** 開発用パネル: 経済イベント・所持金イベント・破産の手動発火と GameState の確認 */
export function DebugPanel({
  G,
  onTriggerEvent,
  onTriggerCashEvent,
  onForceBankruptcy,
}: DebugPanelProps) {
  // map はサイズが大きく不変なので JSON 表示からは省く
  const rest = { ...G, map: `(${G.map.name} — 表示省略)` };

  return (
    <section className="panel panel--debug">
      <h2>開発用パネル</h2>
      <div className="debug-events">
        <p className="muted">経済イベントを手動発火(将来はマスやカードから発生させる):</p>
        <div className="button-row">
          {sampleEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onTriggerEvent(event.id)}
              title={event.description}
              disabled={G.gameOver}
            >
              {event.name}
            </button>
          ))}
        </div>
        {G.economicState.activeModifiers.length > 0 && (
          <p className="muted">有効な経済効果: {G.economicState.activeModifiers.length}件</p>
        )}
      </div>
      <div className="debug-events">
        <p className="muted">所持金イベントを現在手番のプレイヤーに手動発火:</p>
        <div className="button-row">
          {sampleCashEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onTriggerCashEvent(event.id)}
              title={event.description}
              disabled={G.gameOver}
            >
              {event.name}
            </button>
          ))}
        </div>
      </div>
      <div className="debug-events">
        <p className="muted">強制破産(支払い系の所持金イベントからも発生する):</p>
        <div className="button-row">
          {G.players.map((player) => (
            <button
              key={player.id}
              onClick={() => onForceBankruptcy(player.id)}
              disabled={G.gameOver || player.status.bankrupt}
            >
              {player.name}を破産
            </button>
          ))}
        </div>
      </div>
      <details>
        <summary>GameState を表示(map を除く)</summary>
        <pre className="debug-json">{JSON.stringify(rest, null, 2)}</pre>
      </details>
    </section>
  );
}
