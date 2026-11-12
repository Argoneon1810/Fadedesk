# Sound Manager 작업 인계서 (`HANDOFF.md`)

## 1. 다른 PC에서 바로 클론·빌드하는 방법 (외부 Python 불필요, 순수 Node)

```bash
git clone -b main https://github.com/Argoneon1810/sound_manager.git
cd sound_manager
npm install
npm run build
```

- `npm run build`는 외부 Python이나 시스템 도구 없이 **Node 내장 모듈(`node:zlib`)과 `esbuild`만으로** `dist/unpacked/` 및 `dist/sound-manager-0.4.0.zip`을 생성한다.
- Chrome `chrome://extensions` → **압축해제된 확장 프로그램을 로드합니다**에는 저장소 루트가 아닌 **`dist/unpacked`** 폴더만 선택한다.
- 실제 Chrome 확장 팝업 `AutoResize` 수치 확인: `node scripts/verify-popup-autosize.mjs`

---

## 2. 브랜치 및 태그 상태

`main`과 `work/help-modal-and-brand-badge`가 모두 최신 커밋을 가리키며, 각 판의 이력은 불변 Git 태그(`v0.1.0` ~ `v0.4.0`)와 작업 가지로 함께 보존되어 있다.

| 태그 / 가지 | 판 번호 / 역할 | 상태 요약 |
| :--- | :--- | :--- |
| `v0.1.0` (`work/initial-console`) | `0.1.0` | 탭별 로그 dB 볼륨(`-60`~`+12dB`), Focus 모드(`α`), 도메인 핀, 4종 테마 |
| `v0.2.0` (`work/db-inline-edit`) | `0.2.0` | dB 수치 표시창 클릭 시 인라인 숫자 직접 입력 |
| `work/v6-dsp-design` | 설계·시안(`v6`·`v7`) | 2계층 노멀라이저 및 우측 사이드 FX 랙 C안 확정 |
| `v0.3.0` (`work/channel-dsp-and-console-ux`) | `0.3.0` | 채널 다이나믹 노멀라이저(`균일 N`), 고급 FX 사이드 랙(Pan/Gate/Comp), 투톤 빗금 게이지, 그립 드래그 정렬, 선형 RSS 마스터 VU |
| `v0.4.0` / **`main`** / **`work/help-modal-and-brand-badge`** | **`0.4.0` + 최신 빌드·인계** | 박스형 `SOUND MANAGER` 명판 배지 + 원형 `?` 2탭 4단계 도움말 모달 + 8종 실물 부품 인라인 SVG 중첩 카드 + 순수 Node 빌드 파이프라인 |

*(참고: GitHub 웹 설정의 Default branch가 첫 푸시 당시 생성된 `work/db-inline-edit`로 되어 있다면 `git clone -b main ...`으로 클론하거나, GitHub 저장소 `Settings → General → Default branch`에서 `main`으로 변경하면 `-b main` 없이도 항상 최신 `main`이 클론된다.)*

---

## 3. 바로 결정·진행할 다음 작업 (`0.4.1`)

### [백로그] 사용자 식별 현안 및 의심 원인

1. **호버 설명 중첩 모달(Level 2 카드) 포커스 간섭 및 플리커링(Flickering) 이슈**:
   - **현상**: 부품 칩 호버 시 나타나는 2단계 설명 모달이 커서 포커스를 가로채어 칩의 호버(`pointerleave`)가 즉시 끊어짐. 호버가 끊기면 카드가 닫히고, 닫히면 다시 커서가 칩 위에 닿아 호버가 재발생하며 깜빡이는 무한 루프 플리커링 발생.
   - **조치 방향**: 중첩 모달 카드의 `pointer-events: none` 설정 또는 마우스 경로 영역/호버 상태 머신 분리 검토.

2. **확장 팝업 사이즈의 모달 크기/비율 종속 이슈**:
   - **현상**: 익스텐션 팝업의 가로·세로 사이즈가 모달의 크기 및 비율에 비례하여 묶여 있는 현상 식별.
   - **조치 방향**: 팝업 루트(`#console-root`)와 콘솔 베이의 크기 결정권이 내부 모달(`.help-modal`, `#help-backdrop`)의 크기/비율에 역으로 끌려가지 않도록 독립적 분리 검토.

---

### 기존 진행 대기 항목 (팝업 AutoResize 및 0.4.1 작업)

1. **현안 (`0.4.0` 확장 팝업 가로폭 `400px` 자가 잠금 버그)**:
   - 원인 실측 결과와 실제 `chrome.action.openPopup()` 캡처 4장이 `docs/design/04_popup_autosize_diagnosis.md` 및 `docs/design/res/popup_autosize/`에 보존되어 있다.
   - 사용자의 선택 대기 항목:
     - **대안 A (컴팩트 가변형, `446px`~`780px`)**: `static/popup.css`의 `#console-root`에서 `max-width: min(792px, 100vw)`를 `max-width: 780px`로 변경
     - **대안 B (1줄 콘솔형, `710px`~`780px`)**: 대안 A + `#console-root { display: flex; width: max-content; min-width: 520px; }` + `.top-deck { flex-wrap: nowrap; column-gap: 8px; }`
2. **`0.4.1` 반영 시 필수 동반 작업**:
   - `static/manifest.json` 버전을 **`0.4.1`**로 올리고 `CHANGELOG.md`에 `## 0.4.1 에서 고친 것` 절을 추가한다.
   - `tests/popup-layout-audit.mjs`에 `scripts/verify-popup-autosize.mjs`와 동일한 실제 확장 팝업 `AutoResize` 검증을 통합한다.
