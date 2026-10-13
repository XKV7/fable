# 망자의 계약 (Pact of the Fallen) — 설계 초안

## 아키텍처
- `src/core` : 고정 60Hz 루프, 입력(키보드·게임패드·재설정), WebAudio 합성, RNG, 저장
- `src/gfx`  : 렌더러(480×270 월드 캔버스 + 정수 배율 UI 레이어), 절차적 픽셀 스프라이트 생성·캐싱, 파티클, 배경
- `src/data` : 캐릭터·무기·유물·문장·적·보스·방 템플릿·가챠 확률·영구강화·업적·이벤트 **데이터 정의** (밸런싱은 여기만 수정)
- `src/game` : 순수 로직(데미지 계산, 가챠, 문장 판정) + 엔티티(플레이어/적/보스/투사체/장판) + 액션 DSL 실행기 + 효과 훅 엔진 + 런/맵 생성
- `src/scenes`: 장면 상태 머신 (타이틀 → 거점 → 가챠/도감/편성/육성/상점 → 런 → 결과)

## 엔티티 구조
엔티티는 공통 `Body`(위치·속도·충돌박스·중력·접지) 위에 `Fighter`(체력·상태이상·넉백·히트스톱·피격무적) 를 얹는 단순 조합 구조.
플레이어/적/보스는 각각 상태 머신(idle/run/jump/fall/dash/action/hurt/dead)을 가진다.

## 액션 DSL
모든 공격/스킬/교대공격은 `ActionDef` 데이터: 길이(프레임), 캔슬 가능 프레임, 이동, 무적 구간, 그리고
프레임별 이벤트(`hit`, `proj`, `field`, `summon`, `buff`, `shield`, `timestop`, `counter`, `teleport`, `meteor`, `fx`, `sfx`).
캐릭터 데이터는 이 DSL로만 기술되므로 코드 수정 없이 새 캐릭터를 만들 수 있다.

## 효과 훅
유물·무기·문장·패시브·각성은 `Effect` 목록: 상시 스탯 / 조건부 스탯 / 트리거(`hit`,`crit`,`finisher`,`kill`,`dash`,`swap`,`skill`,`hurt`,`roomStart`,`interval`) → 프리미티브(`status`,`explode`,`chain`,`heal`,`shield`,`proj`,`buff`,`cdr`,`echo`,`wave`,`gold`).

## 저장 구조
`localStorage['pact_save_v1']` 에 JSON: 재화, 보유 캐릭터(레벨·각성), 무기(재련), 배너별 천장, 영구강화, 업적, 저주 단계, 통계, 설정·키 설정.
모든 접근은 try/catch — 실패해도 메모리 상태로 동작.
