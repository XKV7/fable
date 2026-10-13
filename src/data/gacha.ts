/** 가챠 확률 데이터. 밸런싱은 여기 수치만 바꾸면 된다. */
export const GACHA = {
  rate5: 0.015,
  rate4: 0.13,
  softPityStart: 45, // 이 회차(포함)부터 ★5 확률 점진 상승
  hardPity: 60, // 이 회차에 ★5 확정
  pity4: 10, // 10회 안에 ★4 이상 1개 보장
  pickupRate5: 0.5, // 픽업 배너 ★5가 픽업일 확률 (실패 시 다음 ★5 픽업 확정)
  pickupRate4: 0.5,
  costSingle: 160,
  costTen: 1600,
  rotationRuns: 3, // 런 3회마다 픽업 교체
};

/** 소프트 천장: 45회차부터 60회차까지 선형으로 1.0에 도달 */
export function rate5At(pullIndex: number): number {
  // pullIndex: 이번 뽑기가 마지막 ★5 이후 몇 번째인지 (1부터)
  const { rate5, softPityStart, hardPity } = GACHA;
  if (pullIndex >= hardPity) return 1;
  if (pullIndex < softPityStart) return rate5;
  const steps = hardPity - softPityStart + 1; // 16
  const k = pullIndex - softPityStart + 1; // 1..15
  return rate5 + ((1 - rate5) * k) / steps;
}

export type BannerKind = 'char' | 'weapon' | 'pickup';

export const BANNER_INFO: Record<BannerKind, { name: string; desc: string }> = {
  char: { name: '영웅의 부름', desc: '모든 영웅이 등장하는 상시 계약 배너' },
  weapon: { name: '망자의 무기고', desc: '모든 무기가 등장하는 상시 무기 배너' },
  pickup: { name: '별의 인도', desc: '픽업 영웅의 등장 확률 대폭 상승 · 런 3회마다 교체' },
};
