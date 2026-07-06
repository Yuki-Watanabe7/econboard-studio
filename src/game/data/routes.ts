import type { RouteEdge } from '../types';

/** 路線(無向エッジ)。分岐は central / riverside / tech-park に持たせている */
export const sampleRoutes: RouteEdge[] = [
  { id: 'e01', fromStationId: 'central', toStationId: 'market-street' },
  { id: 'e02', fromStationId: 'market-street', toStationId: 'old-town' },
  { id: 'e03', fromStationId: 'old-town', toStationId: 'harbor' },
  { id: 'e04', fromStationId: 'harbor', toStationId: 'riverside' },
  { id: 'e05', fromStationId: 'central', toStationId: 'riverside' },
  { id: 'e06', fromStationId: 'riverside', toStationId: 'airport' },
  { id: 'e07', fromStationId: 'airport', toStationId: 'hot-spring' },
  { id: 'e08', fromStationId: 'central', toStationId: 'university' },
  { id: 'e09', fromStationId: 'university', toStationId: 'tech-park' },
  { id: 'e10', fromStationId: 'tech-park', toStationId: 'mountain-gate' },
  { id: 'e11', fromStationId: 'mountain-gate', toStationId: 'hot-spring' },
  { id: 'e12', fromStationId: 'tech-park', toStationId: 'riverside' },
];
