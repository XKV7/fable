# 컨셉아트 → 게임 스프라이트

영웅 컨셉아트(동작 칸 + 스킬 에셋 + 무기/장비 디테일이 들어 있는 한 장)를 게임용 고해상도 스프라이트로 바꾸는 도구.
원본 그림은 `art/concept/`, 결과는 `src/gfx/sheets/<id>.ts` (카일루스만 `src/gfx/caelusSheet.ts`).

## 새 영웅 추가 순서
1. 그림을 `art/concept/<id>.webp`에 둔다.
2. 칸 위치 찾기: `python3 -I tools/sprites/find.py 그림 미리보기.png [허용차] [팽창]` (배경이 고른 시트)
   또는 패널형 컨셉아트는 줄마다 `python3 -I tools/sprites/rowsplit.py 그림 미리보기.png 40 5 "x0,y0,x1,y1;..."`.
   붙어 버린 칸은 확대 미리보기로 경계를 보고 직접 나눈다.
3. `tools/sprites/heroes/<id>.json` 작성 (기존 파일 참고)
   - `frames`: idle0.., run0.., attack0.., cast0.., hit0.., die0.. 의 원본 상자 `[x0,y0,x1,y1]`
   - `fx`: 스킬 에셋 `[상자, 'add'(빛, 가산 혼합) | 'cut'(물체) | 'cutb'(어두운 기운 속 밝은 물체), 축척, (다른 그림 경로)]`
     스킬 에셋은 애니메이션 칸이 아니라 "이런 스킬이겠다"를 보여 주는 그림 → 영웅 데이터에서 투사체·장판·연출로 쓴다.
   - `poses`: 게임 포즈 → 칸 이름, `cycles`: idle/run/hurt/dead 순환
   - `tol`: 배경 허용차 (단색 배경 8~14, 그라데이션 패널 16~24)
4. 저장소 루트에서 `python3 -I tools/sprites/hero.py tools/sprites/heroes/<id>.json src/gfx/sheets/<id>.ts 미리보기.png`
5. `src/gfx/hd.ts`의 `LOADERS`(와 넓은 칸이면 `WIDE`)에 한 줄 추가, `src/data/characters*.ts`에 영웅 데이터.
   에셋은 `pic: { name: '<id>:<에셋>' ... }`(투사체·장판), `boomPic`, 동작 이벤트 `{ k: 'pic', name }`으로 쓴다.

필요 패키지: Pillow, numpy, scipy, opencv-python-headless.
