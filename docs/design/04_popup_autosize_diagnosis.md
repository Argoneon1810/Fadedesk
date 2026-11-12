# `0.4.0` Chrome 확장 팝업 `400px` 잘림 원인 실측 및 `0.4.1` 수정 명세

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
| **대안 B (1줄 콘솔형)**<br>`display: flex; width: max-content; min-width: 520px; max-width: 780px;` + `.top-deck { flex-wrap: nowrap; column-gap: 8px; }` | **`709px`** | `710px` / `708px` | `42px` (1줄) | **`697px`** (잘림 `0`) | `591px` / `591px` (잘림 `0`) | 시안(v7)과 동일하게 항상 상단 바 1줄 유지. 채널 1~4개일 때는 우측 빈 베이 여백 표시 (`proof_3_intrinsic_fix.png`) |
| **채널 6개 + 고급 FX 열림 (대안 A·B 공통)** | **`780px`** | `780px` / `780px` | `42px` (1줄) | `768px` (잘림 `0`) | `447px` / `633px` (정상 가로 스크롤) | Chrome 팝업 상한(`800px`) 안쪽 `780px`까지 자동 확장 후 채널 영역만 가로 스크롤 (`proof_4_6ch_fx_open.png`) |

---

## 3. 캡처 사본 경로

- 현재 `0.4.0` 재현: `docs/design/res/popup_autosize/proof_1_current_040.png`
- 대안 A (3채널): `docs/design/res/popup_autosize/proof_2_only_remove_100vw.png`
- 대안 B (3채널): `docs/design/res/popup_autosize/proof_3_intrinsic_fix.png`
- 6채널 + 고급 FX 열림: `docs/design/res/popup_autosize/proof_4_6ch_fx_open.png`
