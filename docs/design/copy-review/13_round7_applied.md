# 7차 Gemini 문구 검토 반영 기록: 개인정보처리방침 (2026-11-18)

- 요청: `12_round7_privacy_request.md`. 한국어 항목 2·3과 6의 `tabs` 줄을 Gemini 답 그대로 넣었다.
- 대조: 코드(`PersistedSettings` → `chrome.storage.local`, `SerializedTabSession` → `chrome.storage.session`)에서 뽑은 저장 목록과 한국어·영어 글을 항목별로 맞대어 빠짐·덧붙임이 없음을 확인했다(영구 10가지, 세션 4묶음).
- 바로잡은 1.0.0 때의 틀린 기술
  - 탭마다의 볼륨·효과 값은 영구 저장(2번)이 아니라 세션 저장(3번)에 있다.
  - 별도 창은 크기만 저장한다(위치 저장 없음, `background.ts`의 `windows.create`가 `width`/`height`만 씀).
  - 세션 저장에 탭 주소(URL)·미디어 제목·채널 순서가 들어간다.
- 새로 적은 저장 항목: 모든 채널 효과 설정, 내 프리셋(사용자가 입력한 이름과 값), 노멀라이저 그래프 보기 방식, 고급 FX 랙 열림 여부, Focus α.
- 영어 2·3번은 Claude가 같은 목록으로 고쳤다. 시행일은 2026-11-18.
- Gemini의 덧붙임 지적에 따라 한국어 README의 별도 창 "위치·크기 기억"을 "크기 기억"으로 고쳤다. 영어 README와 스토어 `storage` 권한 사유의 "window bounds"도 "window size"로 고치고, 탭마다의 값은 세션 저장으로 옮겨 적었다.
