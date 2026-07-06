/** プレイヤーの表示色(playerID '0'〜'3' に対応) */
export const PLAYER_COLORS = ['#e05d5d', '#4d8fd6', '#4caf7d', '#d8a13a'];

/** 地域ごとの駅の表示色 */
export const REGION_COLORS: Record<string, string> = {
  midtown: '#5b7fbe',
  bayside: '#3fa8a0',
  highland: '#bd8452',
};

export const CATEGORY_LABELS: Record<string, string> = {
  food: '飲食',
  tourism: '観光',
  industry: '工業',
  retail: '小売',
  tech: 'テック',
};

export function playerColor(playerId: string): string {
  return PLAYER_COLORS[Number(playerId) % PLAYER_COLORS.length];
}
