import { useMemo, useState } from 'react';
import { Client } from 'boardgame.io/react';
import { EconBoardGame } from '../game/game';
import { GameBoard } from '../components/GameBoard';

/**
 * エントリ画面。人数選択後にローカル(ホットシート)クライアントを起動する。
 * boardgame.io 付属のデバッグパネルは使わず、自前の DebugPanel を使う。
 */
export function App() {
  const [numPlayers, setNumPlayers] = useState<number | null>(null);

  const GameClient = useMemo(() => {
    if (numPlayers === null) return null;
    return Client({
      game: EconBoardGame,
      board: GameBoard,
      numPlayers,
      debug: false,
    });
  }, [numPlayers]);

  if (GameClient === null) {
    return (
      <div className="setup-screen">
        <h1>EconBoard Studio</h1>
        <p>編集可能な経済ボードゲーム基盤(開発版)</p>
        <p>プレイ人数を選んでください</p>
        <div className="setup-buttons">
          {[2, 3, 4].map((n) => (
            <button key={n} onClick={() => setNumPlayers(n)}>
              {n}人でプレイ
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <GameClient />;
}
