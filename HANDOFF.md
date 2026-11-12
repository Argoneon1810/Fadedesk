# Sound Manager 작업 인계서 (`HANDOFF.md`)

## 1. 새 PC에서 바로 이어서 작업하는 방법

```bash
git clone https://github.com/Argoneon1810/sound_manager.git
cd sound_manager
git checkout work/help-modal-and-brand-badge
npm install
npm run build
```

- Chrome `chrome://extensions` → **압축해제된 확장 프로그램을 로드합니다**에는 저장소 루트가 아닌 **`dist/unpacked`** 폴더만 선택한다.

---

## 2. 현재 브랜치 구조 및 커밋 상태 (단일 선형 이력)

`CLAUDE.md` §3에 작성된 임시 가지 규칙(기능별 `work/<주제>` 분기, 사용자 수락 후 `main` 반영)에 따라 모든 커밋이 하나의 선형 체인으로 이어져 있으며, **최신 작업본은 `work/help-modal-and-brand-badge` 가지**에 있다.

| 가지 이름 | 판 번호 / 역할 | 상태 요약 |
| :--- | :--- | :--- |
| `main` (`c54673d`) | 초기 문서·시안(`v1`~`v5`) | 코드 병합 전 기준선 (브랜치 운영 규칙 사용자 합의 대기) |
| `work/initial-console` (`8dca39c`) | `0.1.0` | 탭별 로그 dB 볼륨(`-60`~`+12dB`), Focus 모드(`α`), 도메인 핀, 4종 테마 |
| `work/db-inline-edit` (`3d1a707`) | `0.2.0` | dB 수치 표시창 클릭 시 인라인 숫자 직접 입력 |
| `work/v6-dsp-design` (`9179488`) | 설계·시안(`v6`·`v7`) | 2계층 노멀라이저 및 우측 사이드 FX 랙 C안 확정 |
| `work/channel-dsp-and-console-ux` (`980e983`) | `0.3.0` | 채널 다이나믹 노멀라이저(`균일 N`), 고급 FX 사이드 랙(Pan/Gate/Comp), 투톤 빗금 게이지, 그립 드래그 정렬, 선형 RSS 마스터 VU |
| **`work/help-modal-and-brand-badge`** (최신 `HEAD`) | **`0.4.0`** | 박스형 `SOUND MANAGER` 명판 배지 + 원형 `?` 2탭 4단계 도움말 모달 + 8종 실물 부품 인라인 SVG 중첩 카드 (호버 미리보기 / 클릭 고정 / 2단 `Escape`) |

---

## 3. 새 PC에서 바로 결정·진행할 다음 작업 (`0.4.1`)

1. **현안 (`0.4.0` 확장 팝업 가로폭 `400px` 자가 잠금 버그)**:
   - 원인 실측 결과와 실제 `chrome.action.openPopup()` 캡처 4장이 `docs/design/04_popup_autosize_diagnosis.md` 및 `docs/design/res/popup_autosize/`에 보존되어 있다.
   - 사용자의 선택 대기 항목:
     - **대안 A (컴팩트 가변형, `446px`~`780px`)**: `static/popup.css`의 `#console-root`에서 `max-width: min(792px, 100vw)`를 `max-width: 780px`로 변경
     - **대안 B (1줄 콘솔형, `710px`~`780px`)**: 대안 A + `#console-root { display: flex; width: max-content; min-width: 520px; }` + `.top-deck { flex-wrap: nowrap; column-gap: 8px; }`
2. **`0.4.1` 반영 시 필수 동반 작업**:
   - `0.4.0`은 이미 Chrome에 로드해 시험한 판이므로 `static/manifest.json` 버전을 **`0.4.1`**로 올리고 `CHANGELOG.md`에 `## 0.4.1 에서 고친 것` 절을 추가한다.
   - `tests/popup-layout-audit.mjs`에 `Extensions.loadUnpacked` + `chrome.action.openPopup()` 기반의 실제 확장 팝업 `AutoResize` 검증 시나리오를 추가한다.
3. **브랜치 운영 규칙 합의**:
   - 현재 `CLAUDE.md` §3의 다중 `work/*` 가지 방식을 유지할지, 단일 `main`(또는 `dev` → `main`) 흐름으로 단순화할지 사용자와 합의 후 `CLAUDE.md` / `AGENTS.md` 및 원격 기본 브랜치(`origin/HEAD`)를 정리한다.
