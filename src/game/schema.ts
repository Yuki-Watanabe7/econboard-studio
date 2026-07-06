import { z } from 'zod';
import type { GameMap, Property } from './types';

/**
 * ゲームデータの Zod スキーマ。
 *
 * 将来のマップエディタや外部 JSON 読み込みの入口で使う想定。
 * 型 (types.ts) と二重定義になるが、実行時検証には schema、
 * コード内の静的型には types を使い分ける。
 */

export const regionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

/** 駅マス種別。types.ts の StationType と対応させる(種別追加時は両方を更新) */
export const stationTypeSchema = z.enum(['normal', 'event', 'cashEvent']);

export const stationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  regionId: z.string().min(1),
  stationType: stationTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  connectedStationIds: z.array(z.string()),
  propertyIds: z.array(z.string()),
});

export const routeEdgeSchema = z.object({
  id: z.string().min(1),
  fromStationId: z.string().min(1),
  toStationId: z.string().min(1),
});

export const gameMapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  regions: z.array(regionSchema).min(1),
  stations: z.array(stationSchema).min(2),
  edges: z.array(routeEdgeSchema).min(1),
});

export const propertySchema = z.object({
  id: z.string().min(1),
  stationId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['food', 'tourism', 'industry', 'retail', 'tech']),
  price: z.number().positive(),
  basePrice: z.number().positive(),
  baseYieldRate: z.number().positive().max(1),
  ownerPlayerId: z.string().nullable(),
  riskLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  growthPotential: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  description: z.string(),
});

export const economicEffectSchema = z.object({
  target: z.object({ type: z.enum(['region', 'category']), id: z.string().min(1) }),
  yieldMultiplier: z.number().positive().optional(),
  valueMultiplier: z.number().positive().optional(),
});

export const economicEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  effects: z.array(economicEffectSchema).min(1),
  durationMonths: z.number().int().positive().nullable(),
});

/** 所持金イベントの効果。types.ts の CashEventEffect と対応させる(種別追加時は両方を更新) */
export const cashEventEffectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('income'), amount: z.number().int().positive() }),
  z.object({ type: z.literal('payment'), amount: z.number().int().positive() }),
  z.object({
    type: z.literal('paymentPerProperty'),
    amountPerProperty: z.number().int().positive(),
  }),
  z.object({ type: z.literal('paymentNetWorthRate'), rate: z.number().positive().max(1) }),
  z.object({ type: z.literal('incomeToPoorest'), amount: z.number().int().positive() }),
]);

export const cashEventSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  effect: cashEventEffectSchema,
});

/**
 * スキーマ検証に加えて、ID 参照の整合性を検査する。
 * 戻り値は問題の説明文の配列(空なら整合)。
 */
export function validateGameData(map: GameMap, properties: Property[]): string[] {
  const problems: string[] = [];

  const mapResult = gameMapSchema.safeParse(map);
  if (!mapResult.success) {
    problems.push(...mapResult.error.issues.map((i) => `map: ${i.path.join('.')}: ${i.message}`));
  }
  for (const property of properties) {
    const r = propertySchema.safeParse(property);
    if (!r.success) {
      problems.push(...r.error.issues.map((i) => `property ${property.id}: ${i.message}`));
    }
  }

  const regionIds = new Set(map.regions.map((r) => r.id));
  const stationIds = new Set(map.stations.map((s) => s.id));
  const propertyIds = new Set(properties.map((p) => p.id));

  for (const station of map.stations) {
    if (!regionIds.has(station.regionId)) {
      problems.push(`station ${station.id}: 未定義の region ${station.regionId}`);
    }
    for (const id of station.connectedStationIds) {
      if (!stationIds.has(id)) {
        problems.push(`station ${station.id}: 未定義の接続先 ${id}`);
      }
    }
    for (const id of station.propertyIds) {
      if (!propertyIds.has(id)) {
        problems.push(`station ${station.id}: 未定義の物件 ${id}`);
      }
    }
  }

  for (const edge of map.edges) {
    if (!stationIds.has(edge.fromStationId) || !stationIds.has(edge.toStationId)) {
      problems.push(`edge ${edge.id}: 未定義の駅を参照している`);
    }
    if (edge.fromStationId === edge.toStationId) {
      problems.push(`edge ${edge.id}: 自己ループは許可されない`);
    }
  }

  for (const property of properties) {
    if (!stationIds.has(property.stationId)) {
      problems.push(`property ${property.id}: 未定義の駅 ${property.stationId}`);
    }
  }

  return problems;
}
