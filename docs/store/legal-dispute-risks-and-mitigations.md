# 인앱·스토어 법적 분쟁 소지 전수 점검 및 예방 조치 명세 (`docs/store/legal-dispute-risks-and-mitigations.md`)

작성일: 2026-11-12 (`0.9.0` 반영 완료: 2026-11-13)  
목적: `Fadedesk` 공개 출시 전 청력 보호 표기와 함께 반영한 **잠재적 법적 분쟁·민원·심사 오해 요인 7가지**의 코드상 근거와 인앱·코드 예방 조치를 기록한다.

---

## 한눈에 보는 7대 분쟁·심사 시비 소지 및 반영 현황 (`0.9.0`)

| 번호 | 분쟁·클레임 시나리오 | 코드상 실제 작동 근거 | `0.9.0` 반영 조치 |
| --- | --- | --- | --- |
| **1** | **청력 손상 · 스피커 파손**<br>(다중 증폭 중첩 및 Solo 탭 종료 시 급발진 폭음) | 채널(`+12dB`) + 마스터(`+12dB`) + 노멀라이저(`+9dB`) + 컴프레서(`+2.4dB`) 합산 증폭 및 유일한 `Solo` 탭 종료(`onRemoved`) 시 타 탭 즉시 복귀 | 인앱 도움말 5단계(`안전 및 유의사항`)·스토어 청력 주의 고지 + **유일한 `Solo` 탭 닫힘 시 타 탭 `0.3초` 완만한 페이드인 복귀** |
| **2** | **비상 경보 · 화상회의 · 업무 알림 누락**<br>(Solo·Focus·노이즈 게이트에 의한 중요 소리 차단) | `Solo`, `Focus(α=0)`, `Master Mute`, `Noise Gate`가 화상회의, 메신저 호출, 일정·거래 알람, 웹 경보음(`AudioContext` 패치 포함)까지 함께 감쇠·차단함 | 인앱 도움말 5단계에 통화·호출·경보·안전 알림 환경 주의 명시 |
| **3** | **온라인 시험 부정행위 오탐 · 금융 보안 · 웹 작곡 툴 충돌** | 모든 사이트·프레임(`all_frames: true`, `world: "MAIN"`) 시작 시점에 `window.AudioContext`, `AudioNode.prototype.connect`, `HTMLMediaElement.prototype.play/volume`을 패치함 | 인앱 도움말 5단계·스토어 안내에 온라인 시험 감독·금융 보안·웹 DAW 사용 시 확장 일시 중지 또는 시크릿 창 이용 권장 명시 |
| **4** | **`LUFS` 방송 납품용 계측기 오인 · 보안 탭 가상 미터 오해** | `ITU-R BS.1770-4 · EBU 3341` 표준 기반이나 브라우저 실시간 청취 보정용 근사 계측이며, 보안(`0dB` 상한) 탭에서는 파형 샘플 접근이 차단됨 | 인앱 도움말에 실시간 청취 보정용이며 공인 납품 계측기가 아님을 명시 + **`corsCap` 탭의 `Math.random()` 가상 흔들림 제거(정직한 고정 레벨 표시)** |
| **5** | **화면 공유 · 공용 PC에서의 사생활 탭 노출** | 최소화 창·다른 모니터 창의 모든 미디어 탭 제목과 도메인을 콘솔 한 화면에 모아서 띄우며, 도메인 핀 목록(`domainDefaults`)이 로컬에 영구 보관됨 | 인앱 도움말 5단계·개인정보처리방침에 모든 일반 창의 미디어 탭 통합 표시(화면 공유 시 유의) 및 로컬 핀 저장 안내 |
| **6** | **무상 배포자 '무보증(AS IS) · 손해배상 면책' 약관 부재** | 무료 오픈소스 배포 시 개발자를 보호하는 표준 무보증·면책 고지 필요 | 루트 `LICENSE` (`GPL-3.0-or-later` §15·§16) 채택 + 인앱 도움말 5단계에 한·영 무보증(`AS IS`) 및 책임 제한 요약 수록 |
| **7** | **온보딩 투어 예시 채널의 타사 상표·실제 곡명 노출** | `0.7.0` `createDemoTourChannels()`에 실제 곡 제목과 타사 서비스 도메인이 하드코딩되어 빈 브라우저 투어 및 심사 테스트 시 노출됨 | `src/popup/tour-overlay.ts` 예시 채널을 RFC 2606 예약 도메인(`audio.example`, `live.example`)과 한·영 중립 일반 명사로 전면 교체 |

---

## 항목별 인앱 반영 문구 요약 (`[콘솔 사용법]` → `5 / 5 안전 및 유의사항` / `Safety & Notices`)

1. **청력·스피커 보호 (`Hearing & Speaker Safety`)**:
   - 국문: `+0 dB` 초과 증폭(채널·마스터·노멀라이저 중첩)이나 `Solo` 해제 시 소리가 크게 올라갈 수 있습니다. 이어폰·헤드폰 착용 시 낮은 볼륨에서 서서히 올리세요.
   - 영문: Boosting above `0 dB` (especially stacking channel, master, and normalizer gain) or clearing `Solo` can raise loudness sharply. Start low when wearing headphones.
2. **중요 통화·경보음 주의 (`Calls & Critical Alerts`)**:
   - 국문: 전체 음소거, `Solo`·`Focus`, 노이즈 게이트는 다른 탭의 화상회의·호출·일정 및 경보음까지 함께 줄이거나 차단합니다.
   - 영문: `Mute All`, `Solo`, `Focus`, and `Noise Gate` also attenuate or silence web calls, alarms, and emergency alerts in other tabs.
3. **보안·시험·웹 DAW 호환 (`Exams, Security & Web DAWs`)**:
   - 국문: 브라우저 오디오 API에 연결되므로 환경 변조 검사에 민감한 온라인 시험·금융 보안 페이지나 웹 작곡·녹음 도구에서는 확장을 잠시 끄거나 시크릿 창을 쓰세요.
   - 영문: Because Fadedesk hooks browser audio APIs, pause the extension or use Incognito during proctored online exams, strict banking checks, or Web DAW sessions.
4. **계측 한계 및 화면 공유 주의 (`Metering & Screen Sharing`)**:
   - 국문: `LUFS`·레벨 미터는 실시간 청취 보정용 근사치로 공인 방송 계측기를 대체하지 않으며(`0 dB` 보안 탭은 설정 볼륨 기준 표시), 모든 창의 미디어 탭 제목이 함께 보이므로 화면 공유 시 유의하세요.
   - 영문: `LUFS` and level meters are real-time listening estimates, not certified compliance meters (`0 dB`-capped tabs show configured level). All windows' media tab titles appear together—check before screen sharing.
5. **무보증 및 책임 제한 (`No Warranty · GPL-3.0`)**:
   - 국문: 이 소프트웨어는 보증 없이 '있는 그대로(AS IS)' 무상 제공되며(`GPL-3.0-or-later`), 음량 증폭·음소거·외부 사이트 충돌로 인한 손해에 대해 개발자는 법령이 허용하는 범위에서 책임을 지지 않습니다.
   - 영문: Provided free of charge `"AS IS"` without warranty (`GPL-3.0-or-later`). To the extent permitted by law, the author is not liable for damages from gain boost, muting, or site conflicts.
