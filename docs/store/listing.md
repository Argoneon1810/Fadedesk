# 크롬 웹 스토어 등록 글 모음 (`docs/store/listing.md`)

크롬 웹 스토어 개발자 대시보드(`https://chrome.google.com/webstore/devconsole`)에 붙여 넣을 문구와 선택 값을 탭 순서대로 정리했습니다. 회색 코드 상자 안의 글을 복사해 그대로 넣으면 됩니다.

- **확장 이름**: `Fadedesk`
- **공개 저장소 주소**: `https://github.com/Argoneon1810/Fadedesk`
- **지원 언어**: 영어(`default_locale: "en"`) · 한국어(`ko`) 동시 제공 (`static/_locales/{en,ko}/messages.json`)

---

## 올리기 전 선행 조건 확인

1. **공개 저장소 푸시 및 `PRIVACY.md` 접속 확인**: `https://github.com/Argoneon1810/Fadedesk` 저장소를 공개(`Public`)로 두고 `main` 브랜치를 올린 뒤, 개인정보처리방침 원본 주소(`https://raw.githubusercontent.com/Argoneon1810/Fadedesk/main/PRIVACY.md`)를 시크릿 창에서 열어 HTTP `200`으로 본문이 보이는지 먼저 확인합니다. 저장소가 비공개(`404`)이거나 `github.com/.../blob/...` 주소를 넣으면 **Purple Lithium** 사유로 자동 거절됩니다.
2. **실기 확인한 빌드 준비**: `dist/unpacked/`로 Chrome에서 동작을 확인한 판(지금 `1.2.4`)으로 `npm test`를 실행해 `dist/fadedesk-1.2.4.zip`을 생성합니다.

---

## 1. 패키지 탭 (Package)

업로드 파일: `dist/fadedesk-1.2.4.zip` (루트에 `manifest.json` 및 `_locales/{en,ko}/messages.json` 포함, 총 17개 런타임 파일)

| 항목 | 한국어 (`ko`, 96자 / 상한 132자) | 영어 (`en`, 126자 / 상한 132자) |
| --- | --- | --- |
| 이름 (`extName`) | Fadedesk | Fadedesk |
| 짧은 설명 (`extDescription`) | 여러 창과 백그라운드 탭의 소리를 한곳에서 재생·정지하고 dB 페이더, Focus/Solo, 스테레오 팬, 음량 평준화(LUFS), 사이트 고정 핀으로 제어하는 오디오 콘솔 | Per-tab audio mixer console with dB faders, Focus ducking, Solo, stereo pan, loudness normalizer, compressor, and domain pins. |

---

## 2. 스토어 등록정보 탭 (Store Listing)

> `_locales`를 쓰는 확장은 대시보드 **Store Listing** 탭 우측 상단 언어 선택기에서 **English**와 **한국어** 두 언어를 각각 선택해 아래 상세 설명과 스크린샷을 채웁니다.

### 상세 설명 — 한국어 (`한국어`)

```text
Fadedesk는 여러 브라우저 창과 백그라운드 탭에서 재생 중인 동영상·오디오 소리를 한 화면에 모아 제어하는 탭별 스튜디오 오디오 믹서 콘솔입니다.

주요 기능
• 탭별 dB 볼륨 페이더: 무음(-60 dB)부터 증폭(+12 dB)까지 직관적인 로그 눈금으로 세밀하게 조절합니다. 실수로 트랙을 건드려 소리가 튀지 않도록 노브 직접 드래그 방식을 쓰며, 숫자 표시창 클릭 직접 입력과 더블클릭 0.0 dB 복귀를 지원합니다.
• 재생·일시정지 · 구역 정렬 · 탭 바로 이동(↗): 탭을 일일이 찾아다니지 않고 콘솔에서 바로 미디어를 재생하거나 멈추며, 채널 카드를 끌어 재생·대기 구역 사이를 이동하거나 헤더(↗)를 눌러 소리가 나는 브라우저 탭·창으로 즉시 이동합니다.
• Mute / Solo / Focus 집중 청취: 특정 탭만 음소거하거나(M), 선택한 탭만 단독으로 듣거나(S, 종료 시 0.3초 소프트 복귀), 주력 탭은 선명하게 유지하면서 나머지 배경 탭 소리만 설정한 Focus α 비율만큼 부드럽게 낮춰(F) 함께 들을 수 있습니다.
• 4종 노멀라이저 프리셋 & 내 프리셋 저장: 상단 균일 N(▾) 버튼으로 클래식(15s 광대역)·음악(9s 강약 보존)·표준(3s 영상/방송)·야간(0.4s 강한 균일) 프리셋을 바로 전환해 탭마다 다른 음량을 자동으로 맞춥니다. 유효 구간 안의 소리만 계산해 조용한 구간이나 폭발음에서 볼륨이 튀지 않으며, 직접 조절한 유효 구간·원음 복귀 속도·목표 음량(LUFS)은 내 프리셋(최대 20개)으로 저장해 언제든 불러올 수 있습니다.
• 고급 FX 랙(모든 채널 · 이 채널): 노멀라이저, 스테레오 패닝(Pan · 전체 밸런스), 노이즈 게이트(차단 기준 조절), 다이내믹 컴프레서를 모든 채널에 한 번에 적용하거나 '이 채널만 따로' 풀어 채널마다 다르게 설정할 수 있습니다.
• 사이트 고정 핀(📌) · 별도 콘솔 창(↗) · 8단계 화면 투어: 자주 방문하는 사이트의 시작 볼륨을 핀으로 기억하고, 콘솔을 크기 조절 가능한 별도 창으로 띄워 둘 수 있습니다. 다크·라이트 4가지 스튜디오 테마와 예시 채널로 바로 체험하는 8단계 화면 투어를 제공합니다.

안전·호환성 및 저작권 안내 (콘솔 내 ? 도움말에서도 상시 확인 가능)
• 실시간 청취 제어 전용: 브라우저 안에서 재생되는 소리의 크기와 청취 균형만 실시간으로 조절합니다. 오디오 녹음, 스트림 추출, 파일 다운로드, 광고 차단, 저작권 보호(DRM) 우회 기능은 일절 포함하지 않습니다.
• 제한 미디어 자동 호환: 암호화된 보호 콘텐츠(DRM)나 교차 출처 제한 미디어는 소리 끊김이 생기지 않도록 브라우저 기본 볼륨 범위(0 dB 이하)로 자동 전환해 안전하게 동작합니다.
• 청력 및 기기 보호 주의: +0 dB 초과 증폭(채널·마스터·노멀라이저 중첩 포함)이나 Solo 해제 시 소리가 크게 커질 수 있으니 이어폰·헤드폰 착용 시 낮은 볼륨에서 서서히 올려 사용하세요.
• 통화·경보 및 민감 페이지 주의: 전체 음소거, Solo·Focus, 노이즈 게이트를 켜면 다른 탭의 화상회의·호출·일정 알림·비상 경보음까지 함께 줄어들거나 차단됩니다. 또한 브라우저 오디오 API에 연결되므로 변조 검사에 민감한 온라인 감독 시험·금융 보안 페이지·웹 DAW에서는 확장을 잠시 끄거나 시크릿 창을 이용하세요.
• 계측·화면 공유·무보증 안내: 표시되는 LUFS와 레벨 미터는 실시간 청취 보정용 근사치이며 납품 검수용 공인 계측기가 아닙니다. 모든 창의 미디어 탭 제목이 함께 표시되므로 화면 공유 시 유의하세요. 본 확장은 GPL-3.0-or-later 라이선스 하에 보증 없이 '있는 그대로(AS IS)' 무상 제공됩니다.

개인정보 보호
아무것도 수집하지 않고 기기 밖으로 아무것도 보내지 않습니다. 설정한 볼륨과 테마만 브라우저 내부 저장소에 보관되며 외부 통신 코드가 없습니다.

소스 코드 및 문의: https://github.com/Argoneon1810/Fadedesk
```

### 상세 설명 — 영어 (`English`)

```text
Fadedesk is a studio-style per-tab audio mixer console that lets you control volume, playback, and listening balance across multiple browser windows and background tabs from one place.

Key Features
• Per-Tab dB Faders: Adjust volume smoothly on a logarithmic scale from silence (-60 dB) up to +12 dB boost. Knob-only dragging prevents accidental track-click jumps; click any digital readout to type an exact dB value or double-click to reset to 0.0 dB.
• Remote Play/Pause, Drag Zones & Tab Jump (↗): Start or pause media tabs without hunting across windows, drag strips between Playing and Paused zones, or click a strip header (↗) to focus the exact browser tab and window playing audio.
• Mute / Solo / Focus Ducking: Mute individual tabs (M), isolate selected tabs (S, with smooth 0.3s recovery on close), or keep your main tab clear while gently lowering background tabs (F) by an adjustable Focus α ducking depth.
• 4 Loudness Presets & My Presets: Switch among Classical (15s wide), Music (9s dynamic), Standard (3s video), and Night (0.4s even) from Level N ▾. The normalizer only follows sound inside its active band, so quiet passages and sudden peaks don't make the volume jump. Save tuned values as My Presets (up to 20).
• FX Rack (All channels · This tab): Apply Normalizer, Stereo Pan with Global Balance, Noise Gate, and Compressor to all channels at once, or press 'Set separately' to give one tab its own settings.
• Domain Volume Pin, Pop-out Window & 4 Studio Themes: Save a default startup volume per website while keeping open tabs independent, detach the mixer into a resizable standalone window, explore controls with an optional 8-step Screen Tour, and choose from four dark and light studio themes.

Audio Safety, Compatibility & Content Respect (also available anytime via the in-app ? button)
• Real-Time Playback Control Only: Fadedesk only adjusts real-time listening volume and balance inside your browser. It does NOT record, rip, extract, or download audio streams, block ads, or circumvent DRM.
• Seamless DRM & Cross-Origin Fallback: Protected streams (DRM/EME) and cross-origin restricted media automatically fall back to standard browser volume control (up to 0 dB) so playback never mutes or breaks.
• Hearing & Speaker Caution: Boosting above 0 dB (especially stacking channel, master, and normalizer gain) or clearing Solo can raise loudness sharply. Start at a low volume when wearing headphones.
• Critical Alerts & Sensitive Pages: Master Mute, Solo, Focus, and Noise Gate also turn down or silence web calls, meetings, alarms, and emergency alerts in other tabs. Because Fadedesk hooks browser audio APIs, pause the extension or use Incognito during proctored online exams, strict banking security checks, or Web DAW production.
• Metering, Screen Sharing & No Warranty: LUFS and VU readouts are real-time listening estimates, not certified compliance meters. Media tab titles from all open windows appear together—check before sharing your screen. Provided free "AS IS" without warranty under GPL-3.0-or-later.

Privacy
Fadedesk collects nothing and sends nothing over the network. All mixer settings stay locally inside your browser.

Source code & support: https://github.com/Argoneon1810/Fadedesk
```

### 그래픽 자산 및 등록정보 항목

| 항목 | 넣을 값 / 파일 경로 |
| --- | --- |
| 카테고리 | `Productivity` → `Tools` (또는 대시보드 분류상 `Make Chrome Yours` → `Functionality & UI`) |
| 스토어 아이콘 (`128×128`) | `static/icons/icon128.png` (`96×96` 본체 + 사방 `16px` 투명 패딩 규격 반영 완료) |
| 작은 프로모션 타일 (`440×280`) | `docs/store/promo-440x280.png` (24-bit RGB PNG, 알파 없음) |
| 스크린샷 (`1280×800`, 언어별 4장) | 영어 등록 페이지: `docs/store/screenshots/1~4-*.png` · 한국어 등록 페이지: `docs/store/screenshots/ko/1~4-*.png` (대시보드 우측 상단 언어 선택기에서 언어마다 그 언어 그림만 올린다) |
| └ 1 `1-console-overview.png` | 콘솔 전체: 탭 5개 채널 · Focus · 마스터 스테레오 미터 |
| └ 2 `2-fx-rack.png` | 고급 FX 랙(이 채널) · 노멀라이저 세부 창 |
| └ 3 `3-spotlight-tour.png` | 화면 투어 8단계(고급 FX 랙 · N·G·C·P 배지) |
| └ 4 `4-help-and-safety.png` | 도움말 창의 안전 및 유의사항 |
| 홈페이지 URL | `https://github.com/Argoneon1810/Fadedesk` |
| 지원 URL | `https://github.com/Argoneon1810/Fadedesk/issues` |
| 성인 콘텐츠 | 아니오 (`No`) |

---

## 3. 개인정보 보호 관행 탭 (Privacy Practices)

### 단일 목적 (Single Purpose Description)

```text
Fadedesk has one single purpose: giving the user unified real-time playback and audio mixer control (dB volume faders, Mute/Solo/Focus ducking, stereo pan, noise gate, dynamic compression, and loudness leveling) over media playing across open browser tabs. The toolbar popup, optional pop-out mixer window, and keyboard shortcuts are all ways to operate that single per-tab audio mixer.
```

### 권한 사유 (Permission Justifications)

#### `tabs`

```text
Identifies open tabs across browser windows that contain active or audible media so the mixer console can display each tab's title, domain label, and favicon on its channel strip, focus/highlight a tab on request, and match the tab's hostname against user-pinned default domain volumes locally. Tab URLs and titles are never transmitted off the device.
```

#### `storage`

```text
Stores the user's mixer preferences (master volume, mute, theme, pop-out window size, all-channel FX settings, user-named presets, and user-pinned domain default volumes) in chrome.storage.local, and holds active tab strip state (tab title, URL, per-tab volume/FX/Focus settings) in chrome.storage.session so the Manifest V3 service worker can restore mixer strips after waking from idle. Nothing leaves the browser.
```

#### `scripting`

```text
Injects the extension's local audio controller and bridge scripts into tabs that were already open when the extension was installed or updated, so the user can adjust volume on existing media tabs immediately without having to reload every open tab. No remote code is ever loaded or executed.
```

#### 호스트 권한 (`<all_urls>` 및 `file://*/*`)

```text
HTML5 <video>, <audio>, and Web Audio playback can occur on any website or local media file opened in Chrome, not on a fixed list of domains. Broad host access (<all_urls> and local file:// media pages when enabled by the user) is required to attach real-time Web Audio gain, pan, noise gate, compression, and loudness controls directly to media elements wherever the user plays audio. Audio and page content are processed strictly in memory inside the browser and are never recorded, stored, or transmitted.
```

### 원격 코드·데이터 수집 체크표

| 항목 | 선택 값 | 근거 및 심사 대응 메모 |
| --- | --- | --- |
| 원격 코드 사용 여부 (Remote code) | `No, I am not using remote code` | 번들 17개 런타임 파일 전수 스캔 결과 `eval`, `new Function`, 외부 스크립트, `fetch` 0건 (`connect-src 'none'`). |
| 데이터 수집 유형 9개 체크박스 | **모두 체크하지 않음** | 외부 서버로 수집·전송하는 데이터가 전혀 없음. 모든 연산과 설정 저장이 브라우저 로컬에서만 이루어짐. |
| 필수 인증 3개 체크박스 | **3개 모두 체크** | 제3자 판매/이전 안 함, 단일 목적 외 사용 안 함, 신용도 평가/대출 목적 사용 안 함. |
| 개인정보처리방침 URL | `https://raw.githubusercontent.com/Argoneon1810/Fadedesk/main/PRIVACY.md` | `<all_urls>` 권한 확장은 방침 URL 기재가 **법적·정책적 필수**입니다. 반드시 `raw.githubusercontent.com` 주소를 쓰고, 제출 직전 시크릿 창에서 `200 OK`를 확인합니다. |

> **심사관이 로컬 탭 제목·사이트 고정 핀 저장을 이유로 데이터 유형 체크를 요구할 때의 대응**:
> 심사에서 `tabs` 권한이나 오디오 신호 읽기를 이유로 체크를 요구하면, 거절 메일에 지목된 항목(`Web history` 또는 `Website content`)만 체크하고 *"Processed locally inside the browser only; never transmitted off the user's device"* 사유와 함께 재제출합니다. `PRIVACY.md`에는 이미 로컬 저장(`local`/`session`)과 실시간 메모리 연산 방식이 모두 적혀 있어 방침 본문을 고치지 않아도 일관성이 유지됩니다.

---

## 4. 테스트 안내 탭 (Reviewer Test Instructions — 영문 445자 / 상한 500자)

로그인 정보 칸(Username / Password)은 비워 두고, 추가 안내(Additional instructions) 칸에 아래 글을 넣습니다.

```text
No login needed. 1) Open 2+ tabs playing HTML5 audio or video (e.g., Wikimedia Commons audio or any public video). 2) Click the toolbar icon (Alt+Shift+M, or Ctrl+Shift+M on macOS) to open Fadedesk. 3) Drag a channel fader knob (-60 to +12 dB) or click M (Mute), S (Solo), or F (Focus ducking). 4) Click FX Rack to test Loudness Normalizer, Stereo Pan, Noise Gate, and Compressor. 5) Click ? for the guided tour and safety notices, or Pop-out (↗).
```
