# Sound Manager 작업 인계서 (`HANDOFF.md`)

## 1. 다른 PC에서 바로 클론·빌드하는 방법 (외부 Python 불필요, 순수 Node)

```bash
git clone -b main https://github.com/Argoneon1810/sound_manager.git
cd sound_manager
npm install
npm run build
```

- `npm run build`는 외부 Python이나 시스템 도구 없이 **Node 내장 모듈(`node:zlib`)과 `esbuild`만으로** `dist/unpacked/` 및 `dist/sound-manager-<version>.zip`을 생성한다.
- Chrome `chrome://extensions` → **압축해제된 확장 프로그램을 로드합니다**에는 저장소 루트가 아닌 **`dist/unpacked`** 폴더만 선택한다.
- 전체 정적 타입·단위·빌드·실제 확장 팝업 UI 감사 실행: `npm test`

---

## 2. 브랜치 및 태그 상태

| 태그 / 가지 | 판 번호 / 역할 | 상태 요약 |
| :--- | :--- | :--- |
| `v0.1.0` (`work/initial-console`) | `0.1.0` | 탭별 로그 dB 볼륨(`-60`~`+12dB`), Focus 모드(`α`), 도메인 핀, 4종 테마 |
| `v0.2.0` (`work/db-inline-edit`) | `0.2.0` | dB 수치 표시창 클릭 시 인라인 숫자 직접 입력 |
| `work/v6-dsp-design` | 설계·시안(`v6`·`v7`) | 2계층 노멀라이저 및 우측 사이드 FX 랙 C안 확정 |
| `v0.3.0` (`work/channel-dsp-and-console-ux`) | `0.3.0` | 채널 다이나믹 노멀라이저(`균일 N`), 고급 FX 사이드 랙(Pan/Gate/Comp), 투톤 빗금 게이지, 그립 드래그 정렬, 선형 RSS 마스터 VU |
| `v0.4.0` / `main` | `0.4.0` | 박스형 `SOUND MANAGER` 명판 배지 + 원형 `?` 2탭 4단계 도움말 모달 + 8종 실물 부품 인라인 SVG 중첩 카드 + 순수 Node 빌드 파이프라인 |
| `v1.0.0` / `main` | `1.0.0` | 크롬 웹 스토어 최초 출시 판 (한·영 다국어, 7단계 스포트라이트 투어, 안전 고지, BS.1770-4 노멀라이저) |
| **`v1.1.0-unstable` (`work/normalizer` → `main`)** | **`1.1.0` (`1.1.0-unstable`)** | 3-A 대표 음압 구간·`0.0 dB` 회귀 텐션·스침 방지 체류(`Dwell`), `클래식` 프리셋 신설, 기본 켜짐(`음악`), 사이트 볼륨 역보정·피크 헤드룸 가드, 실시간 16대역 스펙트럼 확장/축소 뷰, 팝오버 호버 구간 비교, 전 채널·마스터 우측 2열(L/R) 미터 통일 |
| **`work/fx-scope-ux`** | **`1.2.1`** | (1.2.1: 팝업 그리기 CPU 절감 — `docs/research/performance/01_cpu_audit.md`) 고급 FX "모든 채널" 층(범위 탭 · MASTER BUS `전체 FX`), 노멀라이저 두 축 분리 · 따름 잠금, 전체 밸런스, 내 프리셋(복사), 세부 창, `N G C P` 칩, 활성 채널 떠오름, Focus 전용색, 원인별 빗금. 설계 기록 `docs/design/05_fx_scope_redesign.md`, 시안 `docs/design/mockups/v9-*` |

*(참고: GitHub 웹 설정의 Default branch가 첫 푸시 당시 생성된 `work/db-inline-edit`로 되어 있다면 `git clone -b main ...`으로 클론하거나, GitHub 저장소 `Settings → General → Default branch`에서 `main`으로 변경하면 `-b main` 없이도 항상 최신 `main`이 클론된다.)*

---

## 3. 검증된 원인 및 해결 내역 요약 (`0.4.0` → `0.5.1`)

세부 실측 수치와 기각 가설 대조표는 `docs/design/04_popup_autosize_diagnosis.md`에 기록되어 있다.

1. **확장 팝업 축소 및 도움말 모달 비율 일치 현상 (역인과 확인 · `0.5.0`~`0.5.1` 해결)**
   - 모달이 팝업을 줄인 것이 아니라, `#console-root`의 `max-width: min(792px, 100vw)`가 초기 뷰포트(`400px`)에 스스로 잠기면서 내부 `456px` 모달까지 `max-width: calc(100% - 16px)`에 맞춰 함께 줄어들어 두 비율이 일치해 보였던 현상임.
   - `100vw` 자가 잠금을 제거하고, 상단 상태 캡슐(`#status-pill`) 토스트나 구분선 출몰에도 팝업 크기가 흔들리지 않도록 팝업 모드 외곽 폭을 `740px`(`고급 FX` 열림 시 `780px`)로 고정함.
2. **도움말 2단계 용어 카드 호버 깜빡임 (`0.5.0` 해결)**
   - 미고정 호버 미리보기 상태에서는 `.nested-term-card`에 `pointer-events: none`을 유지하고 클릭 고정(`data-pinned="true"`) 시에만 `auto`로 전환해 하단 칩 호버 간섭을 차단함.
3. **독립 콘솔 창 분리 (`0.5.0` 추가)**
   - 상단 `?` 옆 `↗` 버튼(`#popout-btn`)으로 `popup.html?view=window` 독립 창을 열거나 기존 창으로 포커스를 옮기며, 사용자가 조절한 창 크기를 설정에 저장·복원함.
4. **드래그 앤 드롭 블럭 슬롯 일원화 및 비동기 재정렬 잠금 (`0.5.1` 해결)**
   - `3px` 선분 표시기를 블럭형 드롭 슬롯으로 교체하고, 반대 그룹이 비어 있을 때만(`movedCh.playing` 기준) `'여기에 놓아 일시정지'` / `'여기에 놓아 재생'` 슬롯을 표시하며 그 슬롯 자체를 드롭 타깃으로 삼음.
   - 드래그 진행 중 도착하는 `SNAPSHOT`·토스트 타이머의 `reconcileChannelStrips()`가 `pauseDivider`를 제거해 `'여기에 놓아 재생'` 블럭을 오른쪽 끝으로 밀어내던 경쟁 상태를 차단함.
5. **비선택 채널 첫 클릭 유실 및 YouTube Music 재생 복귀 불능 (`0.5.1` 해결)**
   - 카드 `pointerdown` 선택 시 버튼 `innerHTML`을 재대입해 클릭 대상 자식 노드를 파괴하던 구조를 고정 자식 참조 + `.console-btn > * { pointer-events: none }`으로 고쳐 첫 클릭에 선택과 조작이 동시에 수행되게 함.
   - 프레임에 `<video>`/`<audio>`가 있을 때 상시 `"running"` 상태인 사이트 보조 `AudioContext`가 `playingCount`를 `1`로 오염시키던 문제를 분리하고, 명시적 재생 명령 전달·최근 활성 미디어 역순 `play()`·일시 중단된 `AudioContext` 동반 `resume()`을 적용함.

---

## 4. 보류 백로그 (`Known Issues`)

1. **오디오 훅 핫스왑(`Hot-Swap`) 시 구버전 `dspChain` 고착 및 `보안 0dB 상한` 오탐 현상 (우선순위 낮음 · 보류)**
   - **현상**: 개발 중 확장을 새로고침(`↻`)하거나 판올림한 뒤 이미 열려 있던 YouTube · YouTube Music 등 SPA 미디어 탭을 새로고침 없이 계속 쓰면, 실제 DRM이 없는 일반 스트림인데도 `보안 0dB 상한`(`교차 출처·DRM 보안으로 DSP 자동 우회`)으로 표시되며 노멀라이저가 우회되거나 새 판의 DSP 변경이 즉시 반영되지 않음. **해당 탭을 한 번 새로고침(`F5`)하면 즉시 정상 복귀됨**(일반 사용 환경에서는 확장 업데이트 빈도가 낮아 영향이 작음).
   - **코드에서 확인된 원인**:
     1. `src/content/audio-hook.ts`(`tryAttachWebAudioToElement`)와 `src/content/webaudio-patch.ts`(`state.pageContexts`)가 핫스왑 시 바깥 컨트롤러만 교체하고 `state.hookedEntries` 내부 `dspChain` 인스턴스는 구버전 그대로 유지함(판본 간 `DspChainInstance` 메서드 추가 시 곡 전환 이벤트에서 `TypeError` 발생 가능).
     2. `buildSnapshot()`이 주 활성 플레이어가 정상 연결되어 있어도 같은 프레임의 멈춰 있는 부수 `<video>`·`<audio>`(미리보기·광고 등) 하나만 교차 출처 URL이면 프레임 전체를 `corsRestricted = true`로 합산함.
     3. SPA에서 동일 `<video>` 요소를 재사용할 때 이전 스트림에서 기록된 `encryptedElements`·`failedWebAudioElements`(`WeakSet`)가 다음 비-DRM 스트림 전환(`emptied` / 새 `src`) 시 해제되지 않음.
   - **추후 조치 방향**:
     - 핫스왑 시 `sourceNode`(`MediaElementAudioSourceNode`)는 유지하되 기존 `dspChain` 연결만 `disconnect()`하고 새 판의 `createDspChain()`으로 무중단 재결선(Rewire)하도록 개선.
     - 활성 재생 미디어 기준으로 `corsRestricted`를 판정하고, 소스 교체 시 `mediaKeys` 유무를 재확인해 이전 스트림의 보안 제한 기록을 갱신하도록 수정.

2. **`#norm-popover` 닫힘 시 포커스 잔류로 인한 `aria-hidden` 경고 (`Known Issue` · 다음 작업 시 수정)**
   - **현상**: `popup.html?view=window` 등에서 `#norm-popover` 내부의 `<button.norm-preset-item>`을 클릭해 프리셋을 선택하고 팝오버를 닫을 때, 클릭된 버튼이 포커스를 유지한 상태에서 부모 `<div#norm-popover>`에 `aria-hidden="true"`가 설정되면서 Chrome 확장 오류 창에 `Blocked aria-hidden on an element because its descendant retained focus` 경고가 기록됨.
   - **원인**: `src/popup/norm-popover.ts`에서 `!open`일 때 내부 자식 요소의 포커스를 상단 트리거 버튼(`#auto-norm-preset-btn`)으로 되돌리거나 `blur()`하지 않고 바로 `pop.setAttribute("aria-hidden", "true")`를 호출함(`#theme-popover`도 동일 패턴 점검 필요).
   - **조치 예정**: 팝오버가 닫힐 때(`!open`) `pop.contains(document.activeElement)`이면 트리거 버튼(`#auto-norm-preset-btn` / `#theme-dot-btn`)으로 포커스를 복원하고 `inert` 속성을 함께 동기화하도록 수정.
