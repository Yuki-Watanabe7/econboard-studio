import type { Station } from '../types';

/**
 * 駅定義。
 *
 * connectedStationIds と propertyIds はここでは空にしておき、
 * sampleData.ts の組み立て時に routes / properties から自動導出する。
 * (単一情報源を routes / properties 側に置くことで、編集時の不整合を防ぐ)
 *
 * stationType はマス種別。'event' の駅に到着すると経済イベントが自動発生する
 * (rules/stationEffects.ts)。種別を編集したら __tests__/data.test.ts が安全網になる。
 */
type StationSeed = Omit<Station, 'connectedStationIds' | 'propertyIds'>;

export const sampleStationSeeds: StationSeed[] = [
  {
    id: 'central',
    name: 'セントラル',
    regionId: 'midtown',
    stationType: 'normal',
    position: { x: 390, y: 270 },
  },
  {
    id: 'market-street',
    name: 'マーケット通り',
    regionId: 'midtown',
    stationType: 'event',
    position: { x: 280, y: 330 },
  },
  {
    id: 'university',
    name: '大学前',
    regionId: 'midtown',
    stationType: 'normal',
    position: { x: 300, y: 160 },
  },
  {
    id: 'old-town',
    name: '旧市街',
    regionId: 'bayside',
    stationType: 'normal',
    position: { x: 170, y: 380 },
  },
  {
    id: 'harbor',
    name: 'ハーバー',
    regionId: 'bayside',
    stationType: 'event',
    position: { x: 140, y: 470 },
  },
  {
    id: 'riverside',
    name: 'リバーサイド',
    regionId: 'bayside',
    stationType: 'normal',
    position: { x: 520, y: 350 },
  },
  {
    id: 'airport',
    name: 'エアポート',
    regionId: 'bayside',
    stationType: 'normal',
    position: { x: 670, y: 430 },
  },
  {
    id: 'tech-park',
    name: 'テックパーク',
    regionId: 'highland',
    stationType: 'event',
    position: { x: 500, y: 130 },
  },
  {
    id: 'mountain-gate',
    name: '山の手ゲート',
    regionId: 'highland',
    stationType: 'normal',
    position: { x: 640, y: 70 },
  },
  {
    id: 'hot-spring',
    name: '温泉郷',
    regionId: 'highland',
    stationType: 'normal',
    position: { x: 730, y: 210 },
  },
];
