# 무료·오픈소스 대안 탐색 로그 (`01_search_log.md`)

작성 시작: 2026-11-12  
목적: [00_criteria.md](./00_criteria.md) 기준에 부합하는 무료·오픈소스 Chrome 확장프로그램(및 관련 도구)을 탐색하고, 실제 소스 코드(`manifest.json`, 오디오 제어 메커니즘, 팝업 UI 구조)까지 검증한 과정을 단계별로 기록한다.

---

## 0. 탐색 전략 및 사전 분류 가설

Chrome 확장프로그램 생태계에서 미디어·볼륨 관련 도구는 크게 4가지 부류로 나뉜다. 각 부류별로 오픈소스 후보를 전수 탐색해 교차 기능(중앙 멀티탭 패널 + 비-`tabCapture` 볼륨/증폭 + 재생 제어 + 도메인 기억)을 갖춘 프로젝트가 있는지 확인한다.

1. **부류 A — 탭 볼륨 부스터 계열** (예: Volume Master, Sound Booster, Volume Booster, Ears Audio Toolkit 등)
   - 가설: 대다수가 클로즈드소스이거나 `chrome.tabCapture` + `activeTab` 기반이라 백그라운드 원격 제어 불가 및 파란 아이콘 문제가 있을 가능성이 높음. **비-`tabCapture`(DOM `HTMLMediaElement` / WebAudio 주입) 기반 오픈소스 볼륨 믹서**가 존재하는지 집중 검색.
2. **부류 B — 멀티탭 오디오/미디어 컨트롤러 허브 계열** (예: Chrome Media Hub 대체 확장, Tab Audio Muter, Audible Tabs Manager, Media Controller 팝업 확장 등)
   - 가설: 재생/일시정지·탭 이동은 지원하지만 탭별 볼륨 슬라이더나 `+dB` 증폭, 도메인 볼륨 기억이 빠져 있을 가능성 확인.
3. **부류 C — 올인원 오픈소스 웹 미디어 제어 도구** (예: `polywock/globalSpeed` 등 대형 오픈소스 미디어 확장)
   - 가설: `Global Speed`는 오픈소스이면서 탭별 미디어 제어·볼륨·증폭·단축키·URL 규칙(도메인 기억 유사)을 폭넓게 지원함. 실제 팝업에서 **멀티탭 동시 목록 제어**가 되는지, 증폭 시 `tabCapture`를 쓰는지 Content Script `GainNode`를 쓰는지 GitHub 소스를 직접 대조할 핵심 1순위 검증 대상!
4. **부류 D — GitHub 신생/니치 오픈소스 MV3 탭 오디오 믹서** (`github.com` 키워드 검색: `chrome extension tab volume mixer`, `multi tab volume control manifest v3`, `tab audio controller gainnode` 등)
   - Chrome 웹 스토어 검색 상위에 안 잡히더라도 GitHub에 공개된 오픈소스 믹서 확장이 있는지 탐색.

---

## 1. 단계별 검색 기록

*(조사 진행에 따라 실시간 추가)*

### 1.1 1차 검색 (GitHub & 오픈소스 멀티탭 볼륨/미디어 믹서 탐색)

**검색 쿼리**:
- `site:github.com chrome extension multi tab volume mixer play pause control popup`
- `site:github.com polywock globalSpeed volume boost multi tab media control tabCapture`
- `site:github.com chrome extension tab audio mixer volume controller manifest v3 gainnode`
- `open source chrome extension control volume and playback of multiple tabs mixer popup`

**발굴된 1차 후보군**:
1. **`BenjaminPhi5/Mix-Tab`**: 탭 오디오 믹서 전용 Chromium 확장. Gain/Volume 슬라이더, Pan, 3-band EQ, **Mute / Solo / Mute All**, HTML5 오디오 태그 자동 감지 기반 팝업이라고 소개됨 → **소스 코드 직접 확인 필요**(`tabCapture` 사용 여부, MV2/MV3 여부, Play/Pause·도메인 기억 지원 여부).
2. **`chinhfey-wayne/modulate` (Modulate)**: MV3 기반 오픈소스 탭 볼륨 믹서. 탭별 볼륨 조절·음소거·부스트·일시정지(Pause) 지원 언급 → **소스 코드 직접 확인 필요**(`tabCapture` 의존 여부, 백그라운드 원격 제어 가능 여부, 도메인 기억 여부).
3. **`polywock/globalSpeed` (Global Speed)**: 대형 오픈소스 미디어 제어 확장. URL별 규칙(도메인 기억 대응 가능성), 볼륨 부스트(600%), 미디어 단축키/제어 보유. 요약상 오디오 이펙트에 `tabCapture`를 쓴다고 하나 HTML 요소 직접 제어 모드가 따로 있는지, 팝업에서 멀티탭 동시 패널을 제공하는지 **소스 코드 직접 검증 필요**.
4. **`peak-flow/chrome-tools`**: 탭 관리 + 탭별 볼륨 슬라이더 + 오디오 재생 탭 추적 + Pause All 팝업 → **소스 코드 직접 확인 필요**.
5. **`Vadagon/volume-manager`**, **`developerInfiniti/volume-master`**, **`iefedev/sound-chef-extension`**: MV3 기반이나 Offscreen + `chrome.tabCapture` 아키텍처로 요약됨 → `tabCapture` 강제 여부 및 백그라운드 탭 즉시 제어 가능 여부 확인 예정.
6. **`wokalek/tab-volume`**, **`Akshay-Ramesh-VITC/Volume-Master-Pro`**: 경량 탭 볼륨/스위처 확장 → 세부 메커니즘 확인 예정.

### 1.2 2차 검색 (`createMediaElementSource` 기반 & Firefox/Chrome 교차 확장 탐색)

**아이디어**: Firefox는 `chrome.tabCapture`를 통한 오디오 스트림 라우팅을 지원하지 않으므로, **Chrome·Firefox 동시 지원 오픈소스 볼륨 확장**은 구조적으로 Content Script(`HTMLMediaElement` + WebAudio `GainNode`) 방식을 사용할 수밖에 없다. 이 경로로 비-`tabCapture` + 도메인 기억 확장을 추가 발굴했다.

**검색 쿼리**:
- `site:github.com "createMediaElementSource" chrome extension popup all tabs volume play pause`
- `site:github.com chrome firefox extension tab volume mixer boost domain remember volume`
- `"BenjaminPhi5/Mix-Tab" OR "modulate" chrome extension tab volume mixer github`
- `chrome web store extension open source control volume of all tabs media player popup`

**추가 발굴된 주요 후보군**:
1. **`Chaython/volumecontrol`**: Firefox·Chromium 확장 겸 Userscript. `-32 dB ~ +32 dB` WebAudio 라우팅, 사이트/URL별 볼륨 기억(per-site settings), 노멀라이제이션 지원이라고 소개됨 → **멀티탭 중앙 제어 팝업 및 Play/Pause 유무 직접 확인 필요**.
2. **`MasterAlexS/VolumeBooster`**: Firefox·Chrome MV3 확장, 도메인 기반 볼륨 기억(smart domain-based memory) 및 증폭 → **멀티탭 제어/재생 제어/실제 코드 검증 필요**.
3. **`techygeekshome/VolumeGeek`**: Chrome/Firefox 볼륨 부스터(600%), 리미터, "Remember for this site" 기능 → **멀티탭 제어/실제 코드 검증 필요**.
4. **`sanjeed5/sound-booster`**, **`Cludes/cludesamp`**: `createMediaElementSource` + `GainNode` + 리미터/컴프레서 구조이나 단일 활성 탭 대상인지 확인 필요.

### 1.3 3차 검색 (GitHub REST API 직접 조회 및 Global Media Control 확장군 대조)

검색 엔진 요약의 부정확성을 배제하기 위해 GitHub Repository Search API를 직접 호출해 실제 저장소 존재 여부·최근 커밋 시각·라이선스를 전수 확인했다.

- **오류 교정 확인**:
  - `chinhfey-wayne/modulate`는 404이며 실제 저장소명은 **`chinhfey-wayne/modulate-tab-volume-mixer`** (2026-10-04 푸시)임을 확인.
  - `BenjaminPhi5/Mix-Tab`은 최종 업데이트가 **2019-07-09**인 구형 Manifest V2 확장으로 현대 Chrome에서 실행 불가 가능성 높음(매니페스트 직접 확인 예정).
- **유력 검증 대상 압축 (실제 활성 오픈소스 저장소)**:
  1. **`polywock/globalSpeed`** (★2,847, 2026-09-28): 가장 성숙한 오픈소스 웹 미디어 제어 확장. 팝업 내 멀티탭 미디어 허브 지원 여부, 볼륨/부스트의 `tabCapture` 의존성 유무, URL 규칙 동작 방식 정밀 코드 대조 진행.
  2. **`Chaython/volumecontrol`** (★98, 2026-11-11, ISC): `-32 dB ~ +32 dB` WebAudio 라우팅 + 사이트별 기억 지원. 멀티탭 중앙 패널 및 재생/일시정지 지원 여부 코드 확인 진행.
  3. **`ungive/media-control-extension`** (★61, 2026-06-11): 멀티탭 미디어 컨트롤 허브. 볼륨/증폭 및 비-MediaSession 지원 여부 코드 확인 진행.
  4. **`piousdeer/chrome-volume-manager`** (★39), **`Vadagon/volume-manager`** (★23), **`wokalek/tab-volume`** (★20): 탭 볼륨 매니저 3종 코드(`manifest.json`의 `tabCapture` 여부, 팝업 멀티탭 목록·재생 제어·도메인 기억) 확인 진행.
  5. **`ZepengW/GMC-Enhance`** (★4, 2026-01-07, GPL-3.0): Chrome Global Media Control 강화 확장. 탭별 볼륨/증폭/비-MediaSession/도메인 기억 여부 확인 진행.
  6. **`chinhfey-wayne/modulate-tab-volume-mixer`** (2026-10-04), **`peak-flow/chrome-tools`** (2026-02-22), **`uamau20k/VolumeBooster-FrutigerAero`** (2026-07-03), **`ramazansancar/volume-booster-tab-extension`** (2026-10-04): 신생 MV3 오픈소스 믹서군 코드 구조 확인 진행.

### 1.4 4차 검증 (상위 후보 저장소 실제 소스 코드·매니페스트 정밀 대조)

검색 요약문이나 스토어 소개글의 과장을 걸러내기 위해 GitHub Raw 파일(`manifest.json`, `popup.*`, `content.*`, `promo.ts` 등)을 직접 읽어 검증했다.

1. **`chinhfey-wayne/modulate-tab-volume-mixer` ("Modulate") — 즉시 탈락 (가짜 오픈소스 저장소)**
   - 홍보 문구에는 "100% open-source"로 적혀 있으나 실제 GitHub 트리를 조회한 결과 `README.md`와 홍보용 PNG 이미지 5장만 존재하고 **소스 코드가 단 한 줄도 없음**(총 파일 7개).

2. **`ungive/media-control-extension` — 즉시 탈락 (클로즈드 라이선스 + 볼륨 기능 없음)**
   - `README.md` 하단에 `This code is source-available only at this time ... All rights reserved.`로 명시되어 오픈소스가 아니며, 재생/탐색 허브일 뿐 볼륨·증폭 기능이 없음.

3. **`Vadagon/volume-manager`, `wokalek/tab-volume`, `icoe44/tab-mute-mixer`, `rafi1919/siren-audio-mixer`, `piousdeer/chrome-volume-manager` — 즉시 탈락 (`tabCapture` 의존 또는 MV2 구형)**
   - 매니페스트 확인 결과 모두 `permissions`에 `"tabCapture"`(및 MV3의 경우 `"offscreen"`, `"activeTab"`)를 요구함(단, `piousdeer`와 `BenjaminPhi5/Mix-Tab`은 구형 MV2).
   - 파란 녹화 아이콘 노출, 전체화면/오디오 지연 문제뿐 아니라, `activeTab` 제약으로 인해 백그라운드 탭을 직접 클릭·방문하기 전에는 캡처를 시작할 수 없으며 재생/일시정지 제어도 없음.

4. **`polywock/globalSpeed` (★2,847) — 부분 충족 (멀티탭 미디어 허브 우수 / 부스트 시 `tabCapture` 강제 & 외부 프로모션 요청 존재)**
   - **확인된 코드**: `staticCh/manifest.json`, `src/popup/MainPanel.tsx`, `src/popup/MediaView.tsx`, `src/popup/AudioPanel.tsx`, `src/background/utils/promo.ts`, `package.json`.
   - **장점**: 팝업 하단 `MediaViews`에서 모든 창·백그라운드 탭(일시정지 탭 포함)의 미디어를 자동 나열하고 재생/일시정지, ±5초 탐색, 탐색바, 음소거, 탭 포커스 이동(`GrRevert`), PiP를 즉시 제어함.
   - **결격 지점**:
     1. 멀티탭 목록(`MediaView.tsx` 167~169행)의 볼륨 슬라이더는 `min={0} max={1} step={0.1}`로 **0~100%(10% 단위)까지만 조절**됨.
     2. 100% 초과 볼륨 증폭(`AudioPanel.tsx` 311~315행 `ensureCaptured()`)은 **현재 활성 탭 하나에 대해서만 `initTabCapture` (`chrome.tabCapture`)를 호출**하여 동작함 → 파란 아이콘 노출 및 백그라운드 원격 부스트 불가.
     3. `src/background/utils/promo.ts` 18행에서 외부 `PROMO_URL`을 `fetch`하여 팝업 하단 `SelfPromo.tsx` 배너를 노출하는 원격 통신 코드가 포함되어 있으며, 저장소에 명시적 오픈소스 라이선스 파일이 없음.
     4. Solo 버튼 없음.

5. **`ZepengW/GMC-Enhance` (GPL-3.0) — 부분 충족 (비-`tabCapture` 멀티탭 허브 + 10밴드 EQ / 볼륨 부스트·도메인 볼륨 기억·Solo 부재)**
   - **확인된 코드**: `manifest.json`, `popup.html`, `content.js` (72.5 KB).
   - **장점**: `tabCapture` 권한 없이(`["activeTab", "tabs", "storage"]`) 모든 탭의 재생/일시정지, 탐색, 배속, `0~100%` 볼륨·음소거, 10밴드 EQ(`createMediaElementSource` 기반)를 제공함.
   - **결격 지점**:
     1. 기본 볼륨 제어가 `media.volume`(`0~100%`)에만 묶여 있어 **전용 볼륨 부스트(>100%) 슬라이더가 없음**.
     2. 페이지별 EQ 프리셋 저장(`saveEQForPage`)만 있고 **도메인별 볼륨 기억 기능이 없음**.
     3. **Solo 기능 없음**.
     4. `popup.html` 및 오버레이 문자열이 중국어 간체(`未检测到任何标签页的音视频` 등)로 하드코딩되어 있음.

6. **`TueJon/tj-volume-mixer` (MIT, v2.0.0, 2026-11-09) — 부분 충족 (비-`tabCapture` 멀티탭 0~600% 부스트 / 재생 제어 전무 & 동일 도메인 탭 볼륨 강제 연동 버그)**
   - **확인된 코드**: `public/manifest.json`, `src/Popup.jsx`, `public/js/content.js`.
   - **장점**: `tabCapture` 없이 모든 탭(일시정지된 `<audio>`/`<video>` 보유 탭 포함)을 팝업에 띄우고 `0~600%` 볼륨 조절(`100%` 이하 `el.volume`, `100%` 초과 `GainNode`) 및 음소거를 지원하며, 외부 통신 없는 깔끔한 MIT 오픈소스임.
   - **결격 지점**:
     1. **재생 / 일시정지(Play/Pause) 제어가 전혀 없음**.
     2. **해당 탭으로 포커스 이동(Jump to Tab) 버튼이 없음**.
     3. **Solo 기능이 없음**.
     4. **동일 도메인 멀티탭 독립 조작 불가**: `Popup.jsx`(142~176행)와 `content.js`(130~137행 `chrome.storage.onChanged`)가 볼륨을 탭 ID가 아닌 `origin`(`https://www.youtube.com`) 키 하나로만 동기화함. 따라서 유튜브 탭 2개를 열어 두고 한 탭의 볼륨을 줄이면 **이미 열려 있던 다른 유튜브 탭의 볼륨까지 실시간으로 똑같이 덮어써짐** (2차 인터뷰 Q4 조건 정면 위배).
     5. `<audio>`/`<video>` 태그만 탐색하므로 순수 WebAudio 전용 소스는 감지하지 못함.

7. **`Chaython/volumecontrol` (★98, ISC, v7.1, 2026-11-11) — 부분 충족 (최고 수준의 단일 탭 dB/WebAudio 엔진 / 멀티탭 중앙 제어 및 재생 제어 전무)**
   - **확인된 코드**: `manifest.json`, `popup.html`, `README.md`.
   - **장점**: `tabCapture` 없이 `MAIN` 월드 오디오 훅으로 `-32 dB ~ +32 dB` 로그 스케일 슬라이더, 도메인/경로별 볼륨 기억(`Remember` 체크 시 저장, 미체크 시 탭별 독립 유지), 실시간 출력 피크 미터(`dBFS`), 노멀라이저/컴프레서, DRM·CORS 자동 감지 및 `0 dB` 안전 폴백을 완벽히 구현함.
   - **결격 지점**:
     1. `manifest.json` 권한이 `["storage", "activeTab"]`뿐이라 **현재 보고 있는 활성 탭 하나만 제어**할 수 있음(백그라운드 멀티탭 중앙 패널 아님).
     2. **재생 / 일시정지(Play/Pause), Solo, 탭 이동 기능이 전혀 없음**.

8. **`peak-flow/chrome-tools`** — `popup.html` 확인 결과 볼륨 슬라이더(`0~300%`)는 현재 활성 탭 전용이며, 백그라운드 탭 영역(`Audible Tabs`)은 `Pause All` 일괄 정지 위주의 보조 도구에 그침.

---

## 2. 탐색 종료 요약

- [00_criteria.md](./00_criteria.md)의 필수 요건을 **모두 만족하는 무료·오픈소스 완성 대안은 현재 생태계에 존재하지 않음(0건)**.
- 다만 부분 영역별로 강점이 뚜렷한 근접 후보 4종(`Global Speed`, `GMC-Enhance`, `TJ Volume Mixer`, `Volume Control`)을 최종 비교 보고서([02_candidates_report.md](./02_candidates_report.md))로 정리하여 사용자 적합성 인터뷰에 상정한다.
