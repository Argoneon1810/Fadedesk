# 스토어 출시 사전 감사 및 비디오(TiltFill) 대비 오디오(Fadedesk) 법·정책·저작권 비교서

작성일: 2026-11-12 (확정 갱신: 2026-11-13)  
기준 판본: `Fadedesk` `0.9.0` (`work/release-fadedesk`, 스토어 초판 `1.0.0` 직전 검수판) / 참조 선행 사례: `TiltFill` `1.0.0` (`zoom_to_fill`)

---

## 1. TiltFill 출시 경험에서 그대로 가져오는 것

자매 프로젝트 `TiltFill`(`ekodgikandbohjbgfofemohoefkpgkpd`)을 출시하며 검증한 계정·절차 중 Fadedesk에 그대로 적용되는 항목입니다.

1. **개발자 등록비 추가 지출 없음 (US\$0)**: 크롬 웹 스토어 개발자 등록비(US\$5)는 계정당 최초 1회만 내며 최대 20개 확장을 게시할 수 있으므로 기존 개발자 계정에 바로 새 항목으로 올릴 수 있습니다.
2. **2단계 인증(2SV) 및 비거래자(Non-Trader) 설정**: 무료·인앱결제 없음·비상업 개인 프로젝트이므로 EU 디지털서비스법(DSA)상 `Non-Trader` 설정이 그대로 유지되어 집 주소·전화번호 공개 의무가 없습니다.
3. **`raw.githubusercontent.com` 개인정보처리방침 호스팅**: `github.com/.../blob/...` 주소는 비로그인 크롤러에 `429`/`503`을 반환해 **Purple Lithium** 거절을 유발하므로, 공개 저장소 `main` 브랜치의 `https://raw.githubusercontent.com/Argoneon1810/Fadedesk/main/PRIVACY.md` 주소를 씁니다.
4. **MV3 확장 업데이트 시 고아(Orphan) 스크립트 방어**: `src/content/content-bridge.ts`에 `if (!chrome?.runtime?.id) return;` 및 `try/catch`가 구현되어 있어 확장 업데이트 직후 기존 탭에서 `Extension context invalidated` 예외가 발생하지 않습니다.
5. **공개 저장소 분리 운영**: 내부 개발 저장소(`Argoneon1810/sound_manager`)와 별개로, 정제된 출시 본문과 문서만 담는 공개 저장소(`https://github.com/Argoneon1810/Fadedesk`)를 동일하게 운영합니다.

---

## 2. 비디오 조작(TiltFill) vs 오디오 조작(Fadedesk) 7대 기준·법·저작권 차이

TiltFill은 `www.youtube.com` 한 곳의 `<video>` 화면 비율과 회전만 다뤘으나, Fadedesk는 **모든 웹사이트의 오디오 신호와 탭 메타데이터**를 다룹니다. 이에 따라 적용되는 법령과 스토어 심사 기준이 아래와 같이 달라집니다.

| 비교 축 | TiltFill (비디오 조작) | Fadedesk (오디오 조작) | Fadedesk 준수 현황 및 대응 |
| --- | --- | --- | --- |
| **1. 요청 권한과 심사 강도** | `storage` + `https://www.youtube.com/*` (단일 사이트 한정 → 빠른 일반 심사) | `tabs`, `storage`, `scripting` + `<all_urls>` + `file://*/*` (**전 사이트 접근 → 수동 심층 심사 대상**) | 각 권한의 단일 목적 연계성(`file://` 로컬 미디어 포함)을 `docs/store/listing.md` 대시보드 사유란에 구체적으로 소명함. |
| **2. 개인정보처리방침 법적 의무** | 선택 사항이나 권장되어 비치함 (탭 URL·제목 미접근) | **`<all_urls>` 및 `tabs` 사용으로 공개 URL 비치 필수** (누락·접속 불가 시 **Purple Lithium** 즉시 거절) | 루트 `PRIVACY.md`에 `storage.local`(`domainDefaults` 포함)과 `storage.session`(임시 탭 상태) 처리 구조를 한·영 병기로 명시함. |
| **3. 저작권법상 기술적보호조치(DRM) 무력화 금지** | 일반 유튜브 공개 영상 CSS 회전·크롭 위주 (DRM 우회 쟁점 낮음) | 스트리밍 서비스의 **EME(`mediaKeys` / Widevine DRM)** 및 교차 출처(CORS) 스트림 존재. 우회·복호화 시도 시 **한국 저작권법 제104조의2 및 미국 DMCA §1201 위반** | `src/content/audio-hook.ts`에서 `encrypted` 이벤트·`el.mediaKeys`·CORS 미허용 요소를 감지하면 WebAudio 납치를 즉시 포기하고 표준 `HTMLMediaElement.volume`(`0 dB` 이하)으로 안전 폴백함 (**법령 완벽 준수**). |
| **4. 스트리밍 복제·전송권 및 CWS 다운로드 금지 정책** | 화면 표시 변환만 수행 | CWS는 스트리밍 **오디오 녹음·추출·다운로드(리핑) 확장을 엄격히 영구 차단**함. `tabCapture` 사용이나 모호한 설명만으로도 오인 거절 위험이 있음 | `scripts/build.mjs`가 `tabCapture` 권한을 빌드 단계에서 차단함. 스토어 설명과 방침에 **"녹음·추출·다운로드·광고 차단·DRM 우회 없음"**을 명시해 오인을 차단함. |
| **5. 오디오 코덱 특허 및 표준(LUFS) 표기** | 코덱·표준 무관 | MP3/AAC/Opus 디코딩과 WebAudio 필터를 활용하며, UI에 `-16 LUFS` 목표 음량 평준화를 표기함 | 코덱 디코딩과 DSP 노드 연산은 모두 **Chrome 브라우저 내장 Web Audio API**를 호출할 뿐 자체 코덱 바이너리를 배포하지 않으므로 특허 실시료 대상이 아님. 인앱 도움말에 실시간 청취 보정용 구현이며 공인 계측기가 아님을 명시함. |
| **6. 상표권 및 키워드 스팸 규제** | `YouTube™` 단일 플랫폼 대상이라 "for YouTube" 표기 허용 | 특정 사이트 전용이 아닌 범용 믹서임. 설명문이나 투어 데모에 타사 브랜드명을 나열하면 **상표권 침해 및 Yellow Argon(키워드 스팸)** 거절 대상 | 스토어 설명과 인앱 온보딩 투어(`audio.example` / `live.example`)에서 타사 상표·실제 곡명을 전수 배제하고 일반 명사로 서술함. |
| **7. 스크린샷 저작권 + 청력·장비 안전 고지** | 영상 프레임 저작권만 확인하면 됐음 (`Charge` CC BY 4.0, NASA 퍼블릭 도메인) | ① 콘솔 스트립에 **곡 제목·아티스트명·앨범 재킷 파비콘·스트리밍 로고**가 찍히면 저작권·상표권 침해 소지<br>② **`+12 dB` 증폭** 및 `Solo` 해제 시 청력 손상·스피커 클리핑 위험 존재 | ① 스크린샷과 프로모션 타일은 자체 제작 중립 채널 데이터로 촬영·렌더링<br>② `-1.0 dBFS` 안전 리미터 + `Solo` 탭 종료 시 완만한 페이드인(`0.3s`) + 인앱 도움말 5단계(`안전 및 유의사항`) 및 스토어 설명 고지 완비. |

---

## 3. 배포 번들(`dist/`) 및 기술 규격 확정 현황 (`0.9.0` 기준)

| 점검 항목 | 관련 CWS 거절 코드 | 확정 결과 (`0.9.0`) | 판정 |
| --- | --- | --- | --- |
| Manifest V3 및 최소 Chrome 버전(`111`) | Blue (MV2 거부) | `"manifest_version": 3`, 서비스 워커 모듈 정상 | 통과 |
| 원격 코드·동적 실행 (`eval`, `new Function`, 외부 스크립트) | Red / Blue | 런타임 파일 전수 검색 **0건** | 통과 |
| 외부 네트워크 요청 (`fetch`, `XHR`, `WebSocket`, `sendBeacon`) | Red Silicon | 전수 검색 **0건**, CSP `connect-src 'none'` 강제 | 통과 |
| 금지 권한 (`tabCapture`, `cookies`, `history`) | Purple Potassium | 전수 검색 **0건**, `scripts/build.mjs`에서 자동 검증 | 통과 |
| 제3자 런타임 npm 패키지 번들 포함 여부 | 라이선스 고지 의무 | `dependencies` 없음, 런타임 외부 패키지 **0건** | 통과 |
| ZIP 루트 구조 (`manifest.json` 최상위 위치, 개발 파일 미포함) | 패키지 업로드 오류 | 루트에 화이트리스트 16개 런타임 파일(`_locales/{en,ko}` 포함)만 존재 | 통과 |
| **128×128 스토어 아이콘 여백** (`static/icons/icon128.png`) | 스토어 그래픽 가이드라인 | `scripts/generate-icons.py`에서 `128px` 아이콘을 **내부 96×96px + 사방 투명 여백 16px (`[16..111]`)** 규격으로 생성 (`16/32/48px`은 툴바 가독성 유지) | **반영 완료** |
| **macOS 전역 단축키 분리** (`static/manifest.json` `commands`) | macOS 사용성 | `default: Alt+Shift+M/0/F`, `mac: MacCtrl+Shift+M/0/F` 병기 | **반영 완료** |
| **`file://*/*` 콘텐츠 스크립트 매칭** (`static/manifest.json`) | Purple Potassium (권한 소명) | 유지 결정 — `docs/store/listing.md` 권한 소명문 및 `PRIVACY.md`에 사용자 허용 시 로컬 미디어 제어 목적 명시 | **반영 완료** |
| **확장 프로그램 브랜드명** (`Fadedesk`) | 검색 노출·식별성 | 동명 확장과의 혼동을 피하기 위해 고유 브랜드 **`Fadedesk`** (`dist/fadedesk-*.zip`) 채택 | **반영 완료** |
| **한·영 동시 다국어 지원** (`static/_locales/{en,ko}/`) | 글로벌 노출·Featured 배지 | `"default_locale": "en"` 기준 한국어·영어 매니페스트 및 인앱 콘솔·도움말·투어 전체 동시 지원 | **반영 완료** |
| **오픈소스 라이선스** (`LICENSE`) | 저작권·무보증 면책 | TiltFill과 동일하게 **`GPL-3.0-or-later`** (`Copyright (C) 2026 Jinhoon Choi`) 채택 | **반영 완료** |
