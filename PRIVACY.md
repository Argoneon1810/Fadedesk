# Fadedesk 개인정보처리방침 / Privacy Policy

시행일 / Effective date: 2026-11-18

## 한국어

**Fadedesk는 사용자의 개인정보를 수집하지 않으며, 어떤 데이터도 기기 밖으로 전송하지 않습니다.**

1. **수집하거나 외부로 보내는 정보.** 없습니다. 개인 식별 정보, 방문 기록, 재생한 영상·음악 기록, 오디오 데이터를 외부 서버로 수집하거나 전송하지 않습니다. 이 확장에는 네트워크 요청(`fetch`, `XMLHttpRequest`, `WebSocket`)을 보내는 코드가 없으며, 보안 정책(`connect-src 'none'`)으로 외부 통신을 원천 차단합니다.
2. **기기에 영구 저장하는 설정 (`chrome.storage.local`).** 사용자가 직접 고른 콘솔 설정만 브라우저 내부 저장소에 보관합니다. 저장 항목은 마스터 볼륨·마스터 음소거, Focus α(다른 채널을 줄이는 폭), 컬러 테마·화면 모드(다크·라이트·시스템), 별도 콘솔 창의 크기(가로·세로), 고급 FX 랙 열림 여부, 노멀라이저 그래프 보기 방식(스펙트럼/막대), 모든 채널 효과 설정(노멀라이저 켜짐 여부·프리셋·목표 음량·유효 구간 등 세부 값, 노이즈 게이트, 컴프레서, 전체 밸런스), 내 프리셋(사용자가 직접 입력한 이름과 노멀라이저 값, 최대 20개), 화면 투어(온보딩) 완료 여부, 그리고 **사용자가 직접 '사이트 고정 핀'을 켰을 때만 기록되는 해당 사이트 이름(예: `example.com`)과 기본 볼륨**입니다. 이 값은 기기 밖으로 나가지 않으며 확장을 삭제하면 함께 지워집니다.
3. **브라우저 실행 중에만 유지되는 임시 탭 상태 (`chrome.storage.session`).** 백그라운드 서비스 워커가 절전 상태에서 깨어날 때 콘솔의 채널 목록을 끊김 없이 되살리기 위해, 소리가 나거나 미디어가 있는 탭마다 탭 주소(URL)·탭 제목·재생 중인 미디어 제목·도메인·파비콘 주소, 재생 상태, 채널 순서, 그리고 그 탭에 정한 볼륨·음소거·Solo·Focus 및 이 채널만 따로 정한 효과 설정을 브라우저 메모리의 세션 저장소에 임시로 보관합니다. 이 정보는 디스크에 영구 기록되지 않고 기기 밖으로 나가지 않으며, 탭이나 브라우저를 닫으면 즉시 사라집니다.
4. **오디오 신호 처리 및 저작권 보호(DRM) 준수.** 볼륨 증폭·감쇠, 스테레오 좌우 배치, 노이즈 게이트, 다이내믹 컴프레서, 음량 평준화(LUFS 추정), 실시간 레벨 미터 표시를 위해 브라우저 내부(Web Audio API)에서 재생 신호의 순간 크기만 연산합니다. **오디오 스트림을 녹음·저장·추출·다운로드하지 않으며**, 암호화된 저작권 보호 미디어(DRM/EME)나 교차 출처 제한 미디어는 우회하지 않고 브라우저 표준 볼륨 범위 안에서만 동작합니다.
5. **제3자 제공 및 분석 도구.** 없습니다. 광고, 추적기, 외부 분석 도구를 일절 사용하지 않습니다.
6. **요구 권한 안내.**
   - `tabs`: 여러 창과 백그라운드 탭 중 미디어가 있는 탭을 식별해 콘솔 채널에 제목·사이트 이름·아이콘을 표시하고 사이트 고정 핀의 기본 볼륨을 적용하기 위해 사용합니다.
   - `storage`: 사용자가 설정한 볼륨·테마·창 크기(`local`)와 현재 열린 탭의 임시 콘솔 상태(`session`)를 브라우저 안에 보관하기 위해 사용합니다.
   - `scripting` 및 모든 사이트 접근(`<all_urls>`, 사용자 허용 시 로컬 `file://` 미디어 포함): 특정 사이트에 한정되지 않고 사용자가 여는 모든 웹페이지와 로컬 미디어 탭의 동영상·오디오 요소 볼륨을 제어하며, 확장 설치 직후 이미 열려 있던 탭도 새로고침 없이 바로 인식하기 위해 사용합니다.
7. **문의.** <https://github.com/Argoneon1810/Fadedesk/issues>

이 방침이 바뀌면 이 문서를 갱신하고 시행일을 새로 적습니다.

## English

**Fadedesk does not collect your personal information and does not transmit any data off your device.**

1. **Data collected or transmitted.** None. Fadedesk does not collect or send personal information, browsing history, media listening history, or audio content to any server. The extension contains no network-request code (`fetch`, `XMLHttpRequest`, or `WebSocket`), and its Content Security Policy (`connect-src 'none'`) blocks all outbound connections.
2. **Settings stored on your device (`chrome.storage.local`).** Only the console settings you choose are saved locally in your browser: master volume and mute, Focus α, color theme and display mode, pop-out console window size, whether the FX Rack is open, the normalizer graph view, the all-channel FX settings (normalizer, noise gate, compressor, Global Balance), My Presets you save (the name you type and its normalizer values), onboarding tour completion, and **the site hostname (for example, `example.com`) and default volume level only when you turn on the Domain Pin**. These settings never leave your device and are removed when you uninstall the extension.
3. **Temporary tab state (`chrome.storage.session`).** So the Manifest V3 service worker can restore channel strips seamlessly after waking from idle, each open media tab's address (URL), title, media title, domain, favicon URL, playback state, strip order, and the volume, mute, Solo, Focus, and per-tab FX settings you set for it are held in the browser's session storage. This state is never written permanently to disk, never leaves your device, and is cleared when the tab or browser closes.
4. **Local audio processing and DRM respect.** Volume gain, stereo panning, noise gate, dynamic compression, loudness normalization, and level metering are computed strictly in real time inside your browser via the Web Audio API. **Audio streams are never recorded, stored, extracted, or downloaded.** DRM-protected media (Encrypted Media Extensions) and cross-origin restricted streams are never bypassed and fall back safely to standard browser volume control.
5. **Sharing and analytics.** None. Fadedesk uses no advertising, tracking, or third-party analytics.
6. **Permissions.**
   - `tabs`: Identifies open tabs playing or holding media across windows to display channel labels/favicons in the mixer and match user-pinned domain defaults locally.
   - `storage`: Saves your mixer preferences (`chrome.storage.local`) and ephemeral session strip state (`chrome.storage.session`) inside the browser.
   - `scripting` and host access (`<all_urls>`, plus local `file://` media tabs when allowed by the user): Attaches real-time volume and audio balance controls to `<video>` and `<audio>` elements on any website you visit, including tabs that were already open when the extension was installed.
7. **Contact.** <https://github.com/Argoneon1810/Fadedesk/issues>

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

If this policy changes, this document will be updated and the effective date revised.
