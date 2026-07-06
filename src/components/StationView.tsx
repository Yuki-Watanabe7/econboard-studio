import type { Player, Station } from '../game/types';
import { REGION_COLORS, playerColor } from './constants';

interface StationViewProps {
  station: Station;
  playersHere: Player[];
  isReachable: boolean;
  isCurrentPlayerHere: boolean;
  isDestination: boolean;
  onClick?: (stationId: string) => void;
}

/** SVG 上の駅1つ(駅マーク + 駅名 + プレイヤー駒) */
export function StationView({
  station,
  playersHere,
  isReachable,
  isCurrentPlayerHere,
  isDestination,
  onClick,
}: StationViewProps) {
  const { x, y } = station.position;
  const fill = REGION_COLORS[station.regionId] ?? '#888888';

  return (
    <g
      className={`station ${isReachable ? 'station--reachable' : ''}`}
      onClick={isReachable && onClick ? () => onClick(station.id) : undefined}
      role={isReachable ? 'button' : undefined}
    >
      {isReachable && <circle cx={x} cy={y} r={24} className="station-halo" />}
      <circle
        cx={x}
        cy={y}
        r={16}
        fill={fill}
        stroke={isCurrentPlayerHere ? '#ffffff' : '#1c2333'}
        strokeWidth={isCurrentPlayerHere ? 3 : 1.5}
      />
      {station.stationType === 'event' && (
        <>
          <circle cx={x} cy={y} r={20} className="station-event-ring" />
          <text x={x} y={y + 5} textAnchor="middle" className="station-event-mark">
            !
          </text>
        </>
      )}
      {station.stationType === 'cashEvent' && (
        <>
          <circle cx={x} cy={y} r={20} className="station-cash-ring" />
          <text x={x} y={y + 5} textAnchor="middle" className="station-cash-mark">
            G
          </text>
        </>
      )}
      {isDestination && (
        <>
          <circle cx={x} cy={y} r={24} className="station-destination-ring" />
          <g className="station-destination-flag">
            <line x1={x + 17} y1={y - 15} x2={x + 17} y2={y - 34} />
            <polygon points={`${x + 17},${y - 34} ${x + 33},${y - 29.5} ${x + 17},${y - 25}`} />
          </g>
        </>
      )}
      <text x={x} y={y + 34} textAnchor="middle" className="station-name">
        {station.name}
      </text>
      {playersHere.map((player, i) => (
        <circle
          key={player.id}
          cx={x - 12 + i * 8}
          cy={y - 22}
          r={5}
          fill={playerColor(player.id)}
          stroke="#0f1420"
          strokeWidth={1}
        />
      ))}
    </g>
  );
}
