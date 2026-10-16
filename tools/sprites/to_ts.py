import base64, json, sys
png, js, out, fxpng, fxjs = sys.argv[1:6]
d = base64.b64encode(open(png, 'rb').read()).decode()
fr = json.load(open(js))
s = '''/**
 * 카일루스(★7) 컨셉아트에서 직접 잘라 만든 스프라이트 시트 (자동 생성 — 손으로 고치지 말 것).
 * 처리: 프레임별 잘라내기 → 테두리에서 이어진 배경만 제거 → 선명화 → 0.6배 면적 평균 축소
 *       → 공용 40색 팔레트 → 1픽셀 외곽선. ax/ay = 발 기준점(프레임 안 좌표).
 * 이름에 '_'가 든 칸(run0_1 등)은 앞·뒤 칸 사이를 광학 흐름으로 예측해 만든 사이 동작,
 * jump/fall/crouch/dash는 원본 칸을 부위별로 접고 늘이고 기울여 만든 변형 동작.
 */
export const CAELUS_SHEET = 'data:image/png;base64,%s';

export interface SheetFrame { x: number; y: number; w: number; h: number; ax: number; ay: number }
export const CAELUS_FRAMES: Record<string, SheetFrame> = %s;

/**
 * 스킬 이펙트·장비 그림 (컨셉아트 「스킬」 줄과 「무기/장비 디테일」에서 원본 크기 그대로 추출).
 * add = 빛 이펙트: 배경색을 뺀 '빛의 양'만 담겨 있어 가산 혼합(lighter)으로 그린다.
 */
export const CAELUS_FX_SHEET = 'data:image/png;base64,%s';
export interface FxFrame { x: number; y: number; w: number; h: number; add: boolean }
export const CAELUS_FX: Record<'card' | 'spike' | 'slash' | 'circle' | 'sword', FxFrame> = %s;
''' % (d, json.dumps({k: {kk: v[kk] for kk in ('x', 'y', 'w', 'h', 'ax', 'ay')} for k, v in fr.items()}),
       base64.b64encode(open(fxpng, 'rb').read()).decode(), json.dumps(json.load(open(fxjs))))
open(out, 'w').write(s)
print(len(s))
