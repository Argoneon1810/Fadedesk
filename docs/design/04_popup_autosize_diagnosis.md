# `0.4.0`~`0.5.0` 팝업 크기·인터랙션·재생 제어 원인 실측 및 `0.5.1` 명세

## 1. 재현 방법 (실제 Chrome 확장 팝업 `AutoResize` 경로)

외부 창 크기를 고정하는 `--window-size=680,420` 탭 방식은 Chrome 확장 팝업(`ExtensionPopup`의 `EnableAutoResize(25×25 .. 800×600)`)의 초기 뷰포트 수축 현상을 재현하지 못한다. 반드시 아래 CDP 경로로 검증해야 한다.

1. Chrome(`--headless=new --enable-unsafe-extension-debugging --remote-debugging-port=<PORT>`) 기동
2. 브라우저 CDP 세션에서 `Extensions.loadUnpacked({ path: ".../dist/unpacked" })` 호출
3. 확장 Service Worker CDP 세션에서 `chrome.action.openPopup()` 호출 후 생성된 `chrome-extension://<id>/popup.html` 타깃 측정 및 `Page.captureScreenshot` 캡처

---

## 2. 실측 수치 대조 (Chrome 157, 채널 3개 기준)

| 조건 (`static/popup.css`) | `window.innerWidth` | `#console-root` 폭 / `scrollWidth` | `.top-deck` 높이 | `.deck-right` 우측 끝 | `.channels-scroll` (`clientWidth` / `scrollWidth`) | 판정 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **현재 `0.4.0` 원본**<br>`min-width: 400px; max-width: min(792px, 100vw);` | **`400px`** | `400px` / `413px` | `69px` (2줄) | **`414px`** (`14px` 잘림) | `281px` / `327px` (`46px` 잘림) | 초기 `100vw=400px`에 `max-width`가 스스로 잠겨 확장 불가 (`res/popup_autosize/proof_1_current_040.png`) |
| **대안 A (컴팩트 가변형)**<br>`max-width: 780px;` (`100vw`만 제거) | **`446px`** | `446px` / `444px` | `69px` (2줄) | **`433px`** (잘림 `0`) | `327px` / `327px` (잘림 `0`) | 잘림 해소. 채널이 적을 땐 빈 여백 없이 2줄 헤더로 밀착되고, 채널 증가·FX 오픈 시 1줄 `780px`로 확장 (`proof_2_only_remove_100vw.png`) |
| **대안 B (`0.5.0` 적용: `width: max-content`)**<br>`display: flex; width: max-content; min-width: 716px; max-width: 780px;` | **`716px`~`780px`** | `716px` / `716px` | `42px` (1줄) | **`704px`** (잘림 `0`) | `591px` / `591px` (잘림 `0`) | `400px` 잠금은 풀렸으나, 상단 `#status-pill` 토스트·구분선 출몰 시 `max-content` 폭이 미세 변동하는 부작용 확인 |
| **`0.5.1` 확정안 (고정 외곽 폭)**<br>`width: 740px` (`고급 FX` 열림 시 `780px`) + `#status-pill` 고정 폭 | **`740px` / `780px`** | `740px` / `740px` | `42px` (1줄) | 잘림 `0` | 내부 가로 스크롤만 동작 | 재생·정지 전환, 토스트 출력, 드래그 슬롯 삽입 중에도 팝업 창 크기 변동 `0px` 보장 |

---

## 3. 가설 검증 및 기각·확정 원인 표 (`0.4.0` → `0.5.1`)

| 대상 현상 | 초기 가설 | 코드·실측 검증 결과 | 최종 판정 및 처방 |
| :--- | :--- | :--- | :--- |
| **팝업 축소 및 모달과의 비율 일치** | 튜토리얼 모달(`.help-modal`)이 팝업 외곽 크기를 자기 비율로 끌어내렸다 | `#help-backdrop`은 닫혀 있을 때 `display: none !important`이며 열려 있을 때도 `position: absolute; inset: 0`이라 부모 크기를 결정하지 못함. 반대로 `#console-root`가 `max-width: min(792px, 100vw)` 때문에 `400px`에 잠겼고, 그 안에서 `456px` 모달이 `max-width: calc(100% - 16px)`로 눌려 팝업과 같은 비율로 수축됨 | **가설 기각 (역인과 확정)**: 팝업의 `100vw` 상한 제거 + `0.5.1`에서 `740px`(`FX` 시 `780px`) 고정 폭 적용 |
| **중첩 용어 카드 호버 깜빡임** | 2단계 설명 카드가 칩의 포인터 호버를 가로채 `pointerleave`/`pointerenter` 루프를 일으킨다 | `.nested-term-card`(`bottom: 44px`)에 `pointer-events: none`이 없어 하단 `.term-chip` 위로 겹치는 순간 칩의 호버가 끊어졌다 복구됨을 확인 | **확정 (`0.5.0`)**: 미고정 호버 시 `pointer-events: none`, 클릭 고정(`data-pinned="true"`) 시에만 `auto` |
| **YouTube Music 정지 후 재생 복귀 불능** | 재생 그룹 드롭 또는 재생 버튼 클릭이 미디어 `play()`까지 도달하지 못한다 | ① 사이트 자체 상시 `"running"` `AudioContext`(`pageContexts`)가 `<video>` 정지 후에도 `playingCount=1`을 보고해 `wasPlaying === true` 오판(`SET_PLAYING` 미전송, `TOGGLE_PLAY` 역동작) 유발. ② `setFramePlaying(true)`가 `lastActiveElements`의 첫 항목만 시도하고 `AudioContext.resume()`을 `else` 분기에 가둠 | **확정 (`0.5.1`)**: HTML 미디어 존재 시 보조 `AudioContext`의 `playingCount` 가산 제외, 명시적 `SET_TAB_PLAYING` 전달, 최근 활성 미디어 역순 `play()` + 컨텍스트 일괄 `resume()` |
| **비선택 채널 첫 클릭 유실 (2회 클릭 필요)** | 채널 선택 처리가 버튼 클릭보다 먼저 개입해 첫 클릭을 삼킨다 | 카드 `pointerdown` → `onSelectChannel` → `renderAll()`이 `playBtn.innerHTML = ...`로 눌려 있던 `<svg>`·`<span>` 자식 노드를 파괴해 `pointerup` 시 브라우저 `click` 이벤트 합성이 취소됨 | **확정 (`0.5.1`)**: 버튼 내부 고정 자식 노드 유지 + `.console-btn > * { pointer-events: none }` + 경량 채널 선택 갱신 |
| **방금 정지시킨 채널 재드래그 시 `'여기에 놓아 재생'` 우측 밀림** | 일시정지 직후 비동기 상태 갱신이 드래그 DOM과 충돌한다 | 드롭 직후 도착하는 백그라운드 `SNAPSHOT` 또는 `1,600ms` 토스트 타이머의 `renderAll()` → `reconcileChannelStrips()`가 드래그 중 `pauseDivider.remove()`를 실행하고 정지 채널들을 `children[0]`(`'여기에 놓아 재생'`) 앞으로 끼워 넣음 | **확정 (`0.5.1`)**: 드래그 진행 중 `reconcileChannelStrips()` DOM 순서 변경 잠금 + 선분 대신 블럭형 드롭 슬롯 일원화 및 빈 반대 그룹 조건(`movedCh.playing` 대조) 적용 |

---

## 4. 캡처 사본 경로

- 현재 `0.4.0` 재현: `docs/design/res/popup_autosize/proof_1_current_040.png`
- 대안 A (3채널): `docs/design/res/popup_autosize/proof_2_only_remove_100vw.png`
- 대안 B (3채널): `docs/design/res/popup_autosize/proof_3_intrinsic_fix.png`
- 6채널 + 고급 FX 열림: `docs/design/res/popup_autosize/proof_4_6ch_fx_open.png`
