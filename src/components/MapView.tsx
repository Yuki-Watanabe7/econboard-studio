import type { GameMap, Player, StationId } from '../game/types';
import { StationView } from './StationView';

interface MapViewProps {
  map: GameMap;
  players: Player[];
  currentPlayerId: string;
  reachableStationIds: StationId[];
  destinationStationId: StationId;
  onStationClick: (stationId: StationId) => void;
}

/** 路線図全体の SVG 描画 */
export function MapView({
  map,
  players,
  currentPlayerId,
  reachableStationIds,
  destinationStationId,
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
          isDestination={destinationStationId === station.id}
          onClick={onStationClick}
        />
      ))}
      {/* 凡例: イベント駅・所持金イベント駅・目的地 */}
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
          イベント駅(経済イベント)
        </text>
        <circle cx={250} cy={500} r={8} fill="#3b4256" stroke="#1c2333" strokeWidth={1} />
        <circle cx={250} cy={500} r={11} className="station-cash-ring" />
        <text
          x={250}
          y={503}
          textAnchor="middle"
          className="station-cash-mark station-cash-mark--legend"
        >
          G
        </text>
        <text x={268} y={504} className="map-legend-label">
          所持金イベント駅(現金の増減)
        </text>
        <circle cx={490} cy={500} r={8} fill="#3b4256" stroke="#1c2333" strokeWidth={1} />
        <circle cx={490} cy={500} r={11} className="station-destination-ring" />
        <g className="station-destination-flag">
          <line x1={499} y1={493} x2={499} y2={482} />
          <polygon points="499,482 508,484.5 499,487" />
        </g>
        <text x={514} y={504} className="map-legend-label">
          目的地(到着で報酬)
        </text>
      </g>
    </svg>
  );
}
