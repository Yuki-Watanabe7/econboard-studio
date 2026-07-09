import type { GameMap, Property, PropertySeed, RouteEdge, Station } from './types';
import { sampleRegions } from './data/regions';
import { sampleStationSeeds } from './data/stations';
import { sampleRoutes } from './data/routes';
import { samplePropertySeeds } from './data/properties';
import { sampleEvents } from './data/events';
import { sampleCashEvents } from './data/cashEvents';
import { sampleItems, itemMassPool, shopOffers } from './data/items';

/**
 * 物件データから Property を組み立てる。
 * basePrice(基準価格)は初期 price と等しいため手書きさせず、ここで導出する。
 */
export function buildProperties(seeds: PropertySeed[]): Property[] {
  return seeds.map((seed) => ({ ...seed, basePrice: seed.price }));
}

export const sampleProperties: Property[] = buildProperties(samplePropertySeeds);

/**
 * 駅の connectedStationIds / propertyIds を routes / properties から導出して
 * GameMap を組み立てる。
 *
 * 冗長な参照情報を手書きさせないことで、将来マップを編集する際の
 * 不整合(接続の書き忘れ・物件の紐付けミス)を防ぐ。
 */
export function buildStations(
  seeds: Omit<Station, 'connectedStationIds' | 'propertyIds'>[],
  routes: RouteEdge[],
  properties: Property[],
): Station[] {
  return seeds.map((seed) => ({
    ...seed,
    connectedStationIds: routes
      .filter((e) => e.fromStationId === seed.id || e.toStationId === seed.id)
      .map((e) => (e.fromStationId === seed.id ? e.toStationId : e.fromStationId)),
    propertyIds: properties.filter((p) => p.stationId === seed.id).map((p) => p.id),
  }));
}

export const sampleMap: GameMap = {
  id: 'econopolis',
  name: '架空都市エコノポリス線',
  regions: sampleRegions,
  stations: buildStations(sampleStationSeeds, sampleRoutes, sampleProperties),
  edges: sampleRoutes,
};

export {
  sampleCashEvents,
  sampleEvents,
  sampleItems,
  itemMassPool,
  shopOffers,
  sampleRegions,
  sampleRoutes,
};
