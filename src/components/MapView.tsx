import type { GameMap, Player, StationId } from '../game/types';
import { StationView } from './StationView';

interface MapViewProps {
  map: GameMap;
  players: Player[];
  currentPlayerId: string;
  reachableStationIds: StationId[];
  onStationClick: (stationId: StationId) => void;
}

/** 路線図全体の SVG 描画 */
export function MapView({
  map,
  players,
  currentPlayerId,
  reachableStationIds,
  onStationClick,
}: MapViewProps) {
  const stationById = new Map(map.stations.map((s) => [s.id, s]));
  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  return (
    <svg viewBox="0 0 800 520" className="map-view" aria-label={map.name}>
      {/* 路線(エッジ) */}
      {map.edges.map((edge) => {
        const from = stationById.get(edge.fromStationId);
        const to = stationById.get(edge.toStationId);
        if (!from || !to) return null;
        return (
          <line
            key={edge.id}
            x1={from.position.x}
            y1={from.position.y}
            x2={to.position.x}
            y2={to.position.y}
            className="route-edge"
          />
        );
      })}
      {/* 駅 */}
      {map.stations.map((station) => (
        <StationView
          key={station.id}
          station={station}
          playersHere={players.filter((p) => p.currentStationId === station.id)}
          isReachable={reachableStationIds.includes(station.id)}
          isCurrentPlayerHere={currentPlayer?.currentStationId === station.id}
          onClick={onStationClick}
        />
      ))}
      {/* 凡例: イベント駅 */}
      <g className="map-legend" aria-label="凡例">
        <circle cx={24} cy={500} r={8} fill="#3b4256" stroke="#1c2333" strokeWidth={1} />
        <circle cx={24} cy={500} r={11} className="station-event-ring" />
        <text
          x={24}
          y={503}
          textAnchor="middle"
          className="station-event-mark station-event-mark--legend"
        >
          !
        </text>
        <text x={42} y={504} className="map-legend-label">
          イベント駅(到着で経済イベント発生)
        </text>
      </g>
    </svg>
  );
}
