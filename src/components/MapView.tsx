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
    </svg>
  );
}
