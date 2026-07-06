import type { Station } from '../types';

/**
 * 駅定義。
 *
 * connectedStationIds と propertyIds はここでは空にしておき、
 * sampleData.ts の組み立て時に routes / properties から自動導出する。
 * (単一情報源を routes / properties 側に置くことで、編集時の不整合を防ぐ)
 */
type StationSeed = Omit<Station, 'connectedStationIds' | 'propertyIds'>;

export const sampleStationSeeds: StationSeed[] = [
  { id: 'central', name: 'セントラル', regionId: 'midtown', position: { x: 390, y: 270 } },
  {
    id: 'market-street',
    name: 'マーケット通り',
    regionId: 'midtown',
    position: { x: 280, y: 330 },
  },
  { id: 'university', name: '大学前', regionId: 'midtown', position: { x: 300, y: 160 } },
  { id: 'old-town', name: '旧市街', regionId: 'bayside', position: { x: 170, y: 380 } },
  { id: 'harbor', name: 'ハーバー', regionId: 'bayside', position: { x: 140, y: 470 } },
  { id: 'riverside', name: 'リバーサイド', regionId: 'bayside', position: { x: 520, y: 350 } },
  { id: 'airport', name: 'エアポート', regionId: 'bayside', position: { x: 670, y: 430 } },
  { id: 'tech-park', name: 'テックパーク', regionId: 'highland', position: { x: 500, y: 130 } },
  { id: 'mountain-gate', name: '山の手ゲート', regionId: 'highland', position: { x: 640, y: 70 } },
  { id: 'hot-spring', name: '温泉郷', regionId: 'highland', position: { x: 730, y: 210 } },
];
