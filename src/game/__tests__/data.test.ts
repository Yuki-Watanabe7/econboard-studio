import { describe, expect, it } from 'vitest';
import { validateGameData, economicEventSchema } from '../schema';
import { sampleEvents, sampleMap, sampleProperties } from '../sampleData';
import type { Station } from '../types';

/**
 * サンプルデータの整合性テスト。
 * 将来マップや物件を編集した際、このテストが壊れていれば参照ミスがあるとわかる。
 */
describe('サンプルデータの整合性', () => {
  it('スキーマ検証と ID 参照検査をすべて通過する', () => {
    expect(validateGameData(sampleMap, sampleProperties)).toEqual([]);
  });

  it('駅数は 8〜12 の範囲にある', () => {
    expect(sampleMap.stations.length).toBeGreaterThanOrEqual(8);
    expect(sampleMap.stations.length).toBeLessThanOrEqual(12);
  });

  it('すべての駅に 1〜3 件の物件がある', () => {
    for (const station of sampleMap.stations) {
      expect(station.propertyIds.length).toBeGreaterThanOrEqual(1);
      expect(station.propertyIds.length).toBeLessThanOrEqual(3);
    }
  });

  it('すべての駅が少なくとも1つの路線に接続されている', () => {
    for (const station of sampleMap.stations) {
      expect(station.connectedStationIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('接続情報はエッジと双方向で一致している', () => {
    const byId = new Map(sampleMap.stations.map((s) => [s.id, s]));
    for (const station of sampleMap.stations) {
      for (const neighborId of station.connectedStationIds) {
        expect(byId.get(neighborId)?.connectedStationIds).toContain(station.id);
      }
    }
  });

  it('経済イベント定義がスキーマを満たす', () => {
    for (const event of sampleEvents) {
      expect(economicEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('イベント駅が少なくとも1つある', () => {
    expect(sampleMap.stations.some((s) => s.stationType === 'event')).toBe(true);
  });

  it('不正な駅マス種別は validateGameData が検出する', () => {
    const broken = {
      ...sampleMap,
      stations: sampleMap.stations.map((s, i) =>
        i === 0 ? { ...s, stationType: 'no-such-type' as Station['stationType'] } : s,
      ),
    };
    const problems = validateGameData(broken, sampleProperties);
    expect(problems.some((p) => p.includes('stationType'))).toBe(true);
  });
});
