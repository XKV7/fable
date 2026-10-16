/** 가챠 확률 데이터. 밸런싱은 여기 수치만 바꾸면 된다. */
export const GACHA = {
  rate7: 0.0001, // 0.01%
  rate6: 0.001, // 0.1%
  rate5: 0.005, // 0.5%
  rate4: 0.0939, // 9.39%  (★3 = 나머지 90%)
  hardPity: 100, // 천장: 마지막 ★5 이상 이후 100번째 뽑기는 ★5 이상 확정 (배너별)
  pickupRate5: 0.5, // 픽업 배너 ★5가 픽업일 확률
  pickupRate4: 0.5,
  costSingle: 160,
  costTen: 1600,
  rotationRuns: 3, // 런 3회마다 픽업 교체
};

/** 희귀도별 확률 (높은 등급부터) */
export const RATE_TABLE: [7 | 6 | 5 | 4 | 3, number][] = [
  [7, GACHA.rate7],
  [6, GACHA.rate6],
  [5, GACHA.rate5],
  [4, GACHA.rate4],
  [3, 1 - GACHA.rate7 - GACHA.rate6 - GACHA.rate5 - GACHA.rate4],
];

export type BannerKind = 'char' | 'weapon' | 'pickup';

export const BANNER_INFO: Record<BannerKind, { name: string; desc: string }> = {
  char: { name: '영웅의 부름', desc: '모든 영웅이 등장하는 상시 계약 배너' },
  weapon: { name: '망자의 무기고', desc: '모든 무기가 등장하는 상시 무기 배너' },
  pickup: { name: '별의 인도', desc: '픽업 영웅의 등장 확률 대폭 상승 · 런 3회마다 교체' },
};
