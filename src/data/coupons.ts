import type { SaveData } from '../game/save';

/** 쿠폰 보상 */
export interface CouponReward {
  stones?: number; // 영혼석
  crystals?: number; // 영혼 결정
  chars?: string[]; // 영웅 (이미 있으면 중복 = 각성 재료)
  weapons?: string[]; // 무기
}
export interface CouponDef {
  reward: CouponReward;
  desc: string; // 받을 때 보여 줄 설명
  /** 이 날짜(YYYY-MM-DD, 그날 끝까지)가 지나면 사용 불가. 없으면 기한 없음 */
  until?: string;
}

/**
 * 쿠폰 코드 목록. 코드는 대소문자·공백 구분 없이 입력 가능(대문자로 맞춰 비교).
 * 예) PACT2026: { reward: { stones: 1600 }, desc: '영혼석 1600', until: '2026-12-31' },
 * (사용자가 나중에 추가 예정 — 지금은 비어 있음)
 */
export const COUPONS: Record<string, CouponDef> = {};

export const normCoupon = (code: string): string => code.trim().toUpperCase().replace(/\s+/g, '');

/** 쿠폰 사용: 성공하면 보상을 기록에 더하고 설명을, 실패하면 오류 문구를 돌려준다 (계정마다 한 번) */
export function redeemCoupon(save: SaveData, raw: string, now = new Date()): { ok: true; desc: string } | { ok: false; error: string } {
  const code = normCoupon(raw);
  if (!code) return { ok: false, error: '쿠폰 코드를 입력하세요' };
  const def = COUPONS[code];
  if (!def) return { ok: false, error: '존재하지 않는 쿠폰 코드입니다' };
  if (save.usedCoupons.includes(code)) return { ok: false, error: '이 계정에서 이미 사용한 쿠폰입니다' };
  if (def.until && now.getTime() > new Date(`${def.until}T23:59:59`).getTime()) return { ok: false, error: '기간이 지난 쿠폰입니다' };
  const r = def.reward;
  if (r.stones) save.stones += r.stones;
  if (r.crystals) save.crystals += r.crystals;
  for (const id of r.chars ?? []) {
    const c = save.chars[id];
    if (c) c.count++;
    else save.chars[id] = { lv: 1, aw: 0, count: 1 };
  }
  for (const id of r.weapons ?? []) {
    const w = save.weapons[id];
    if (w) w.count = (w.count ?? 1) + 1;
    else save.weapons[id] = { rf: 1, count: 1 };
  }
  save.usedCoupons.push(code);
  return { ok: true, desc: def.desc };
}
