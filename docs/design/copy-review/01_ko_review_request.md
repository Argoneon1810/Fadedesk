# Fadedesk 한국어 문구 검토 요청

## 요청

아래는 Chrome 확장 프로그램 **Fadedesk**의 화면에 실제로 보이는 한국어 문구 전부입니다.
이 문구들은 AI(영어권 모델)가 써서 번역투, 기계적인 말투, 어색한 조어가 섞여 있습니다.
한국어를 모국어로 쓰는 일반 사용자가 읽었을 때 자연스럽고 바로 이해되는 문구로 다듬어 주세요.

## 앱 소개 (문맥)

- 여러 브라우저 탭에서 나는 소리(유튜브, 스트리밍, 음악 등)를 한 화면에서 조절하는 오디오 믹서입니다.
- 탭마다 세로 "채널"(페이더, 레벨 미터, 재생/정지, M·S·F 스위치)이 있고, 오른쪽에 전체를 다루는 "마스터 버스"가 있습니다.
- M = 음소거, S = Solo(이 탭만 듣기), F = Focus(이 탭은 그대로, 다른 탭은 줄이기).
- "노멀라이저"(균일 N)는 탭마다 다른 음량을 자동으로 맞추는 기능이고 프리셋(클래식·음악·표준·야간)과 사용자가 저장한 "내 프리셋"이 있습니다.
- "고급 FX" 랙에서 노멀라이저·노이즈 게이트·컴프레서·패닝을 "모든 채널" 또는 "이 채널"에 따로 겁니다. 채널이 "모든 채널 따름"이면 잠겨 있고 "이 채널만 따로"를 눌러야 바꿀 수 있습니다.
- 사용자: 오디오 전문가가 아닌 일반 Chrome 사용자가 대부분입니다. 오디오 용어(dB, LUFS, 컴프레서, 노이즈 게이트, 패닝, Solo, Focus)는 그대로 둡니다.

## 지켜 주실 것

1. **자리 표시자는 그대로 둡니다.** `{p}`, `{n}`, `{desc}` 같은 중괄호 안 이름은 프로그램이 값을 넣는 자리입니다. 지우거나 바꾸거나 순서를 함부로 바꾸지 마세요(문장 안 위치는 옮겨도 됩니다).
2. **길이를 늘리지 않습니다.** 팝업은 폭이 고정(768px)이고, 채널 한 줄은 약 94px, 고급 FX 랙은 214px입니다. 버튼·배지·짧은 라벨(대략 12자 이하)은 원문보다 길어지면 안 됩니다. 도움말 본문·툴팁은 조금 길어져도 됩니다.
3. **기호와 숫자는 그대로 둡니다**: `▸ ▾ ◂ ↗ ⠿ 📌 🔗 ● ★ · α`, dB·LUFS 값, 단축키.
4. **같은 대상은 같은 말로** 부릅니다. 예: "채널"과 "탭"을 섞어 쓰는 곳, "모든 채널"과 "전체"를 섞어 쓰는 곳이 있으면 지적하고 하나로 맞추는 안을 주세요.
5. 버튼은 짧은 명사형/동사형으로, 설명문은 "~합니다" 체로 통일되어 있습니다. 이 체계를 바꿔야 한다고 보면 이유와 함께 따로 제안해 주세요.
6. 문구가 가리키는 기능을 바꾸지 마세요. 뜻이 불분명한 원문은 고치지 말고 "뜻 불명"으로 표시해 주세요.

## 돌려주실 형식

1. **고친 항목만** 아래 표로 주세요. 고칠 것이 없는 항목은 빼 주세요.

   | 키 | 원문 | 제안 | 이유(짧게) |
   |---|---|---|---|

2. 그다음 **용어 통일 제안**을 따로 표로 주세요: 지금 섞여 쓰이는 말 / 통일할 말 / 해당 키들.
3. 마지막에 전체적인 인상(번역투가 특히 심한 곳, 반복되는 버릇)을 3~5줄로 적어 주세요.

키는 아래 목록의 굵은 글씨(`ui.xxx` 등)를 그대로 써 주세요. 이 키로 코드에 되돌려 넣습니다.

---

## 1. 팝업 화면 공통 (상단 바, 채널, 마스터 버스, 알림 토스트)

- **ui.pageTitleWindow**: Fadedesk — 독립 콘솔
- **ui.scanning**: 탐색 중...
- **ui.statusCounts(p, w)**: 재생 {p} · 대기 {w}
- **ui.themeBtnTitle**: 컬러 테마 및 화면 모드 설정
- **ui.helpBtnTitle**: 사용법 및 안전 유의사항
- **ui.popoutBtnTitle**: 독립 창으로 분리해 원하는 크기로 조절
- **ui.popoutBtnAria**: 독립 창으로 콘솔 분리
- **ui.alphaBoxTitle**: Focus 감쇠(α): 노브 드래그·휠 조절 · 우측 수치 클릭 시 직접 입력
- **ui.alphaTrackTitle**: 노브 드래그로 조절 · 더블클릭 시 0.70(-12dB) 복귀
- **ui.alphaReadoutAria**: Focus 감쇠 데시벨 직접 입력
- **ui.alphaReadoutTitle**: 클릭하여 Focus 감쇠 dB(예: -12, -15.5, 0) 또는 비율(예: 0.75) 직접 입력
- **ui.alphaInputAria**: Focus 감쇠 dB 입력
- **ui.resetModesLabel**: S·F 해제
- **ui.resetModesTitle**: 켜져 있는 Solo / Focus 모드를 모두 해제합니다
- **ui.autoNormLabel**: 균일 N
- **ui.autoNormBtnTitle(desc)**: 모든 채널 노멀라이저 (현재: {desc}) — 클릭 시 ON/OFF · '이 채널만' 채널은 건드리지 않음
- **ui.autoNormPresetAria**: 자동 노멀라이저 프리셋 선택
- **ui.autoNormPresetTitle(desc)**: 자동 노멀라이저 프리셋 선택 (현재: {desc})
- **ui.advRackOpenLabel**: 고급 FX ◂
- **ui.advRackClosedLabel**: 고급 FX ▸
- **ui.advRackTitle**: 고급 FX 랙 열기/닫기 (모든 채널 · 이 채널)
- **ui.sideFxAria**: 고급 FX
- **ui.themeDialogAria**: 컬러 테마 및 화면 모드
- **ui.themeHeader**: 컬러 테마
- **ui.modeHeader**: 화면 모드
- **ui.modeLabels.dark**: 다크
- **ui.modeLabels.light**: 라이트
- **ui.modeLabels.system**: 시스템
- **ui.systemResolvedLabel(isDark)**: 시스템(다크)
- **ui.normDialogAria**: 이지 노멀라이저 프리셋
- **ui.normHeader**: 이지 노멀라이저 프리셋
- **ui.normListAria**: 이지 노멀라이저 프리셋 목록
- **ui.emptyTitle**: 활성 미디어 탭이 없습니다
- **ui.emptyDesc**: 동영상·스트리밍·음악 사이트에서 미디어를 재생하면 채널 스트립이 이 자리에 자동으로 정렬됩니다.
- **ui.toastPresetApplied(s)**: 균일 N: {s} 프리셋 적용
- **ui.toastZoneMoved(t, p)**: {t}: 재생 구역 이동 · 즉시 재생
- **ui.toastChannelFallback**: 채널
- **ui.toastPinCleared(h)**: {h} 기본 볼륨 해제
- **ui.toastPinSaved(h, d)**: {h} {d}dB 고정
- **ui.toastJumpTab(t)**: 탭 이동: {t}
- **ui.inlineDirectInput**: 직접 입력
- **ui.dropToPlay**: 여기에 놓아 재생
- **ui.dropToPause**: 여기에 놓아 일시정지
- **ui.dropHere**: 여기에 배치
- **ui.gripTitle**: 드래그하여 채널 순서 변경 · 재생↔일시정지 구역 이동 시 즉시 전환
- **ui.faderTrackTitle**: 노브 드래그 · 휠 조절 (Shift+휠 미세) · 더블클릭 0.0dB 복귀
- **ui.faderKnobTitle**: 노브를 잡아 위아래로 드래그 · 더블클릭 시 0.0dB 복귀
- **ui.readoutTitle**: 클릭하여 dB 직접 입력 (Enter 적용 · Esc 취소)
- **ui.channelDbAria**: 채널 데시벨 직접 입력
- **ui.playToggleTitle**: 재생 / 일시정지
- **ui.playActiveLabel**: 재생
- **ui.playIdleLabel**: 대기
- **ui.muteTitle**: 음소거 (Mute)
- **ui.soloTitle**: Solo (클릭: 단독 전환/해제 · Shift+클릭: 다중 · Focus와 상호 배타)
- **ui.focusTitle**: Focus (클릭: 단독 전환/해제 · Shift+클릭: 다중 · Solo와 상호 배타)
- **ui.normBadgeCustomOn**: 개별 노멀라이저 고정 ON
- **ui.normBadgeCustomOff**: 전역 균일 N 개별 제외됨
- **ui.normBadgeGlobal(s)**: 전역 균일 N 적용 중 ({s})
- **ui.headerJumpTitle(t, d)**: {t} ({d}) — 클릭 시 해당 탭·창으로 이동
- **ui.subCorsCap**: 보안 0dB 상한
- **ui.subPaused**: 일시정지
- **ui.subMuted**: 음소거
- **ui.subAttenuated(d)**: 실효 {d}dB
- **ui.subNormTrim(d)**: 균일 {d}dB
- **ui.subPinned**: 도메인 고정
- **ui.subIndividual**: 개별 볼륨
- **ui.pinDisabledTitle**: 도메인 정보를 사용할 수 없는 탭입니다
- **ui.pinSavedTitle(dom, db)**: {dom} 기본값 ({db} dB) · 클릭하여 고정/해제
- **ui.pinSetTitle(db, dom)**: 현재 볼륨({db} dB)을 {dom} 새 탭 기본값으로 고정
- **ui.masterTitle**: 전체 출력
- **ui.masterTrackTitle**: 노브 드래그 · 휠 조절 · 더블클릭 0.0dB 복귀
- **ui.masterReadoutTitle**: 클릭하여 마스터 dB 직접 입력 (Enter 적용 · Esc 취소)
- **ui.masterInputAria**: 마스터 데시벨 직접 입력
- **ui.masterSub**: 마스터 게인
- **ui.masterPauseAll**: 전체 정지
- **ui.masterPlayAll**: 전체 재생
- **ui.masterMuteAll**: 전체 음소거
- **ui.fxUnselectedTitle**: 채널 미선택
- **ui.fxUnselectedSub**: 활성 미디어 탭을 선택하세요
- **ui.fxNoActiveTitle**: 활성 채널 없음
- **ui.fxNoActiveSub**: 미디어를 재생하면 그 탭을 고를 수 있습니다
- **ui.fxCorsSub**: 교차 출처·DRM 보안으로 DSP 자동 우회
- **ui.fxTrimIdle**: 대기
- **ui.fxTrimCors**: 보안 0dB · 우회
- **ui.fxTrimActive(d)**: 보정 {d}dB
- **ui.fxTrimOff**: 보정 OFF
- **ui.fxModeCustomOn**: 개별 고정 ON
- **ui.fxModeCustomOff**: 전역 제외 OFF
- **ui.fxModeGlobalOn(s)**: 전역 균일({s})
- **ui.fxModeGlobalIdle**: 전역 대기
- **ui.fxNormCardTitle**: 노멀라이저
- **ui.fxNormCustomHint(l)**: 개별 {l}
- **ui.fxNormTargetLabel**: 개별 목표 음압
- **ui.fxNormTargetAria**: 개별 목표 음압 LUFS
- **ui.fxNormSpeeds.slow**: 완만
- **ui.fxNormSpeeds.std**: 표준
- **ui.fxNormSpeeds.fast**: 민감
- **ui.fxVizExpandTitle**: 대표 구간 표시기 펼치기 (주파수 스펙트럼 확장)
- **ui.fxVizCollapseTitle**: 대표 구간 표시기 접기 (막대 축소)
- **ui.fxBoundHighTag(l)**: 상한 {l} ↕
- **ui.fxBoundLowTag(l)**: 하한 {l} ↕
- **ui.fxTargetPinTag(l)**: 목표 {l}
- **ui.fxRangeSummary(low, high)**: 대표 [{low}..{high}]
- **ui.fxRangePreview(curLow, curHigh, nextLow, nextHigh)**: 대표 [{curLow}..{curHigh}] → [{nextLow}..{nextHigh}]
- **ui.fxTensionLabel**: 0dB 회귀 텐션
- **ui.fxTensionAria**: 적분 생략 시 0.0dB 복귀 텐션 속도
- **ui.fxStateInBand**: 채택 적분 중
- **ui.fxStateReturnZero**: 0dB 복귀 ↺
- **ui.fxStateIdle**: 대기 중
- **ui.normMiniTitle**: 실시간 음압 · 대표 구간
- **ui.fxPanCardTitle**: 패닝 (Pan)
- **ui.fxPanResetTitle**: 클릭 시 중앙(C) 복귀
- **ui.fxPanAria**: 스테레오 좌우 패닝
- **ui.fxGateCardTitle**: 노이즈 게이트
- **ui.fxGateFloorLabel**: 바닥 차단
- **ui.fxGateAria**: 노이즈 게이트 임계값 dB
- **ui.fxCompCardTitle**: 컴프레서
- **ui.fxCompRatios.2**: 약 2:1
- **ui.fxCompRatios.4**: 중 4:1
- **ui.fxCompRatios.8**: 강 8:1

## 2. 고급 FX 랙과 세부 창, 내 프리셋

- **fx.scopeAll**: 모든 채널
- **fx.scopeThis()**: 이 채널
- **fx.globalTitle**: 모든 채널 기본 설정
- **fx.globalSub(n)**: 여기서 바꾸면 채널 {n}개에 걸립니다
- **fx.channelSub(h)**: {h} · 이 채널에 걸린 효과
- **fx.modTitle.norm**: 노멀라이저
- **fx.modTitle.gate**: 노이즈 게이트
- **fx.modTitle.comp**: 컴프레서
- **fx.modTitle.pan**: 패닝
- **fx.modTitle.balance**: 전체 밸런스
- **fx.detailOpen**: 세부 ▸
- **fx.detailClose**: 세부 ◂
- **fx.detailTitle(t)**: {t} 세부
- **fx.detailCloseAria**: 세부 창 닫기
- **fx.stateFollow**: 🔗 모든 채널 따름
- **fx.stateOwn**: ● 이 채널만
- **fx.btnDetach**: 이 채널만 따로
- **fx.btnRelink**: 모든 채널 따르기
- **fx.globalApplies**: 모든 채널에 걸림
- **fx.globalExcept(n)**: 따로 정한 채널 {n}개 제외
- **fx.lockedHint**: 모든 채널 값을 따르는 중입니다. 먼저 '이 채널만 따로'를 누르세요.
- **fx.detailSubGlobal**: 모든 채널 기본 설정
- **fx.detailSubOwn(h)**: {h} · 이 채널만
- **fx.detailSubLocked(h)**: {h} · 모든 채널 따름 (잠김)
- **fx.detailSubPan(h)**: {h} · 이 채널
- **fx.off**: 꺼짐
- **fx.gateSummary(db)**: 바닥 {db} dB
- **fx.compSummary(r)**: 비율 {r}:1
- **fx.panFinal(s)**: 최종 {s}
- **fx.balanceSummary(s)**: 전체 {s}
- **fx.panFormula(f, c, g)**: 최종 {f} = 이 채널 {c} + 전체 {g}
- **fx.balanceNote**: 모든 채널의 패닝에 더해집니다. 채널끼리의 좌우 배치는 그대로 두고 전체를 옮깁니다.
- **fx.gateNote**: 이보다 작은 소리(배경 잡음)를 막습니다.
- **fx.presetCustom**: 사용자 지정
- **fx.presetModifiedSuffix**:  (수정됨)
- **fx.presetAria**: 노멀라이저 프리셋
- **fx.modifiedFrom(n)**: "{n}"에서 바뀜
- **fx.customValues**: 사용자 지정 값
- **fx.saveAsUser**: 내 프리셋으로 저장
- **fx.overwrite(n)**: "{n}" 덮어쓰기
- **fx.revert**: 되돌리기
- **fx.save**: 저장
- **fx.defaultPresetName**: 내 프리셋
- **fx.presetNameAria**: 내 프리셋 이름
- **fx.manageOpen**: 내 프리셋 관리…
- **fx.manageClose**: 내 프리셋 관리 닫기
- **fx.rename**: 이름
- **fx.remove**: 지우기
- **fx.ok**: 확인
- **fx.deleteNote**: 지워도 이미 이 프리셋을 고른 채널의 값은 그대로 남습니다(사용자 지정).
- **fx.masterFxBtn**: 전체 FX
- **fx.masterFxTitle**: 모든 채널에 걸 고급 FX를 고칩니다
- **fx.toastPresetSaved(n)**: 내 프리셋 "{n}" 저장
- **fx.toastPresetDeleted(n)**: 내 프리셋 "{n}" 지움
- **fx.chipFollow(n)**: {n}: 모든 채널 설정을 따라 켜짐
- **fx.chipOwn(n)**: {n}: 이 채널만 따로 켜짐
- **fx.chipOff(n)**: {n}: 꺼짐
- **fx.chipPan(s)**: 최종 패닝 {s}
- **fx.popoverMine**: 내 프리셋
- **fx.popoverNote**: 여기서 고르면 '모든 채널 따름' 채널에 걸립니다. 채널마다 따로 고르려면 고급 FX에서 그 채널을 고르세요.
- **fx.liveFrom(h)**: 실시간 음압: {h}

## 3. 노멀라이저 프리셋 이름·설명

- **preset.classical.label**: 클래식 · 원음 (광대역)
- **preset.classical.shortLabel**: 클래식
- **preset.classical.badge**: -16 LUFS · 광대역(15s)
- **preset.classical.spec**: 대표 [-28..-13] · 체류 1.8s · 0회귀 0.50dB/s · 최대 +4dB
- **preset.classical.summary**: 여린 독주(ppp)와 폭발하는 강주(fff)는 제외하고 0.0dB로 물러나 원음의 넓은 강약 의도를 살립니다.
- **preset.music.label**: 음악 (강약 보존 · 기본)
- **preset.music.shortLabel**: 음악
- **preset.music.badge**: -16 LUFS · 완만(9s)
- **preset.music.spec**: 대표 [-32..-10] · 체류 1.2s · 0회귀 0.35dB/s · 최대 +6dB
- **preset.music.summary**: 곡 안의 후렴·프리즈 대비는 유지하고 곡이 바뀔 때 평균 음압 편차만 부드럽게 맞춥니다.
- **preset.standard.label**: 표준 (영상·방송)
- **preset.standard.shortLabel**: 표준
- **preset.standard.badge**: -16 LUFS · 표준(3s)
- **preset.standard.spec**: 대표 [-36..-8] · 체류 0.45s · 0회귀 0.25dB/s · 최대 +7.5dB
- **preset.standard.summary**: 유튜브·스트리밍·강의 탭을 오갈 때 들쭉날쭉한 목소리와 배경음 볼륨을 빠르게 정렬합니다.
- **preset.night.label**: 야간 (강한 균일)
- **preset.night.shortLabel**: 야간
- **preset.night.badge**: -18 LUFS · 민감(0.4s)
- **preset.night.spec**: 대표 [-42..-6] · 체류 0.15s · 0회귀 0.15dB/s · 최대 +9dB
- **preset.night.summary**: 늦은 밤 청취 시 갑작스러운 큰 소리는 빠르게 누르고 작은 대사를 또렷하게 유지합니다.

## 4. 도움말 창과 실화면 투어 (길어져도 되는 본문)

- **help.dialogAria**: Fadedesk 사용법 및 안전 안내
- **help.closeAria**: 도움말 닫기
- **help.tabTour**: 빠른 투어
- **help.tabEasy**: 콘솔 사용법
- **help.tabAdv**: 노멀라이저 · 고급 FX
- **help.introTitle**: 실제 콘솔 화면 위에서 주요 기능을 바로 익혀 보세요
- **help.introItems[0].lead**: 탭 바로 이동 & 창 분리
- **help.introItems[0].body**: 채널 헤더(↗)를 눌러 재생 중인 탭으로 바로 이동하거나, 상단 창 분리(↗)로 콘솔을 독립 창에 띄워 둡니다.
- **help.introItems[1].lead**: 정밀 볼륨 & 집중 청취
- **help.introItems[1].body**: 탭별 -60 ~ +12dB 증폭, 직접 숫자 입력, 배경 탭만 부드럽게 줄이는 Focus(F)를 제공합니다.
- **help.introItems[2].lead**: 모든 채널 노멀라이저와 내 프리셋
- **help.introItems[2].body**: 클래식·음악·표준·야간 프리셋으로 탭 사이 음량을 맞추고, 바꾼 값은 내 프리셋으로 저장해 다시 고릅니다.
- **help.introNote**: 열린 미디어 탭이 없어도 투어 동안 중립 예시 채널 2개가 임시로 표시되며, 끝나거나 건너뛰면 즉시 원래 화면으로 돌아갑니다.
- **help.tourStartBtn**: 실화면 투어 시작 ▸
- **help.tourSkipBtn**: 바로 쓰기 (건너뛰기)
- **help.introSub**: 상단 ? 버튼에서 사용법과 안전 유의사항을 언제든 다시 볼 수 있습니다 · Esc로 닫기
- **help.easyHint**: 밑줄 친 부품 이름에 커서를 올리면 위치를 미리 보고, 클릭하면 고정됩니다.
- **help.advHint**: 밑줄 친 프리셋·부품 이름에 커서를 올려 도면 위치를 확인할 수 있습니다.
- **help.safetyHint**: 청력·장비 보호와 중요 알림, 보안 페이지 호환을 위해 사용 전 꼭 확인해 주세요.
- **help.pinnedTip**: ✓ 클릭으로 고정됨 · 칩 다시 클릭 또는 바깥 클릭 시 닫힘
- **help.unpinnedTip**: 💡 칩을 클릭하면 화면에 고정됩니다
- **help.stepAria(idx)**: {idx}1단계
- **help.prevBtn**: 이전
- **help.nextBtn**: 다음
- **help.easySteps[0].title**: 탭 바로 이동 · 독립 창 분리 · 테마 전환
- **help.easySteps[0].bullets[0]**: 채널 상단 [탭 이동 헤더](파비콘 · 사이트명 · ↗)를 클릭하거나 채널 선택 후 Enter를 누르면 해당 미디어가 열린 브라우저 탭·창으로 즉시 이동합니다.
- **help.easySteps[0].bullets[1]**: 상단 [독립 창 분리](↗) 버튼으로 팝업을 별도 창으로 떼어내 상시 띄워 둘 수 있으며(최소 520×420 자동 유지), 좌측 색상 점(●)에서 4종 테마와 다크·라이트 모드를 전환합니다.
- **help.easySteps[0].bullets[2]**: 전역 단축키(Alt+Shift+M 콘솔 열기, Alt+Shift+0 전체 음소거, Alt+Shift+F Focus 순환 · macOS는 Ctrl+Shift)와 방향키·0·M/S/F/P 조작을 지원합니다.
- **help.easySteps[1].title**: 탭별 볼륨 증폭 · 노브 조작 · 수치 직접 입력
- **help.easySteps[1].bullets[0]**: 실수로 트랙을 건드려 볼륨이 튀는 것을 막기 위해 드래그는 [페이더] 위의 사각 [노브]를 직접 잡고 움직이며, 레일 위에서는 마우스 휠(Shift+휠 미세 조절)과 더블클릭(0.0dB 복귀)이 동작합니다.
- **help.easySteps[1].bullets[1]**: 0 눈금 위로 올리면 최대 +12dB(약 4배)까지 증폭되며 우측 [레벨 미터]로 실시간 출력 레벨을 확인합니다.
- **help.easySteps[1].bullets[2]**: 아래 [수치 표시창]을 클릭하면 -8.5처럼 원하는 데시벨 숫자를 키보드로 직접 입력합니다.
- **help.easySteps[2].title**: 집중 청취(M·S·F) · 드래그 정렬 · 도메인 핀
- **help.easySteps[2].bullets[0]**: 하단 [스위치 뱅크]에서 F(Focus)를 켜면 선택 탭은 그대로 두고 나머지 탭만 상단 Focus α 비율만큼 줄입니다(우측 데시벨 수치 클릭 시 직접 입력, S 단독 청취, Shift+클릭 다중 선택).
- **help.easySteps[2].bullets[1]**: 맨 위 좌측 [드래그 핸들]을 끌어 순서를 바꾸거나, 구분선 너머 우측 대기 구역에 놓아 즉시 일시정지·좌측으로 옮겨 즉시 재생합니다.
- **help.easySteps[2].bullets[2]**: 재생 버튼 오른쪽 [도메인 핀]을 켜면 같은 사이트를 새 탭으로 열 때 현재 볼륨이 초기값으로 자동 적용됩니다.
- **help.easySteps[3].title**: 자동 볼륨 균일화(균일 N ▾) 옵션 읽는 법과 마스터 제어
- **help.easySteps[3].bullets[0]**: 상단 [균일 N ▾]는 기본 켜짐(음악 모드)으로 동작하며, 우측 ▾에서 클래식(광대역) · 음악(기본) · 표준(영상/방송) · 야간(강한 균일) 4종 프리셋을 고릅니다.
- **help.easySteps[3].bullets[1]**: 옵션 읽는 법: '-16 LUFS · 9s'는 목표 기준 음량(-16)과 평균을 재는 시간 창(9초)을 뜻하며, '대표 [-32..-10] · 0회귀'는 이 구간 안의 소리만 평균에 반영하고 여린 독주나 폭발음에서는 원음(0.0dB)으로 물러난다는 뜻입니다(채널 하단 '균일 +2.4dB'는 현재 자동 보정량).
- **help.easySteps[3].bullets[2]**: 우측 고정 [마스터 버스]와 각 채널의 2열(L/R) [레벨 미터]로 스테레오 출력 밸런스를 보며 전체 볼륨·정지·음소거를 한 번에 제어합니다.
- **help.easySteps[4].title**: 안전 및 유의사항 (청력 · 중요 알림 · 호환 · 면책)
- **help.easySteps[4].bullets[0]**: 청력·스피커 보호: +0dB 초과 증폭(채널·마스터·노멀라이저 중첩)이나 Solo 해제 시 소리가 크게 커질 수 있으니 이어폰 착용 시 낮은 볼륨에서 서서히 올리세요.
- **help.easySteps[4].bullets[1]**: 통화·경보 주의: 전체 음소거, Solo·Focus 감쇠, 노이즈 게이트는 다른 탭의 화상회의·호출·일정 알림·비상 경보음까지 함께 줄이거나 차단합니다.
- **help.easySteps[4].bullets[2]**: 시험·보안·웹 DAW: 브라우저 오디오 API에 연결되므로 변조 검사에 민감한 온라인 시험·금융 보안 페이지나 웹 작곡 도구에서는 확장을 잠시 끄거나 시크릿 창을 이용하세요.
- **help.easySteps[4].bullets[3]**: 계측·프라이버시·면책: LUFS·미터는 실시간 청취 보정용 근사치(공인 계측기 아님, 0dB 보안 탭은 설정 볼륨 표시)이며 모든 창의 미디어 탭 제목이 함께 보이므로 화면 공유 시 유의하세요. 본 확장(GPL-3.0-or-later)은 보증 없이 '있는 그대로(AS IS)' 무상 제공되며 사용상 손해에 대해 법령 범위 내에서 책임을 지지 않습니다.
- **help.advSteps[0].title**: 대표 음압 구간(3-A) · 0.0dB 회귀 텐션과 4종 프리셋
- **help.advSteps[0].bullets[0]**: 노멀라이저는 원본 입력 음압 중 '평균 음압을 대표하기에 마땅한 구간(예: -32 ~ -10 LUFS)' 안에 들어온 소리만 적분하며, 구간 밖의 여린 독주(ppp)나 강주 폭발(fff)은 제외하고 0.0dB 회귀 텐션으로 서서히 원음 볼륨(0.0dB)으로 복귀합니다.
- **help.advSteps[0].bullets[1]**: 클래식처럼 곡 전체에 걸쳐 다이나믹 레인지가 넓은 음악은 [균일 N ▾]에서 '클래식(광대역)' 프리셋을 고르면 급격한 도약 스침을 배제하고 원음 강약 대비를 보존합니다.
- **help.advSteps[0].bullets[2]**: 상단 [균일 N ▾] 팝오버 하단에서도 현재 탭의 실시간 입력 음압과 대표 채택 구간을 미니 바로 즉시 확인할 수 있습니다.
- **help.advSteps[1].title**: 고급 FX: 모든 채널 · 이 채널, 세부 창과 내 프리셋
- **help.advSteps[1].bullets[0]**: 고급 FX ▸ 랙 맨 위 [모든 채널 \| 이 채널] 탭(또는 MASTER BUS의 '전체 FX')으로 고칠 대상을 고릅니다. 지금 고치는 대상은 바탕이 떠올라 보입니다(채널, 또는 모든 채널이면 MASTER BUS).
- **help.advSteps[1].bullets[1]**: 카드마다 '🔗 모든 채널 따름'이면 모든 채널 값을 쓰며 잠겨 있고, '이 채널만 따로'를 눌러야 그 채널 값만 바꿀 수 있습니다. 패닝은 이 채널 값에 '전체 밸런스'가 더해집니다.
- **help.advSteps[1].bullets[2]**: 카드의 '세부 ▸'로 세부 창을 열어 프리셋·대표 구간(↕ 스펙트럼 / ↔ 막대)·0dB 회귀 텐션·목표 LUFS를 다루고, 바꾼 값은 '내 프리셋으로 저장'해 다른 채널에서도 고를 수 있습니다.
- **help.advSteps[2].title**: 스테레오 패닝(Pan) & 노이즈 게이트
- **help.advSteps[2].bullets[0]**: 패닝 (L100 ~ C ~ R100): 각 탭의 소리를 좌우 공간에 배치해 여러 방송·음악을 동시에 들을 때 명료도를 높입니다(더블클릭 또는 C 버튼으로 중앙 복귀).
- **help.advSteps[2].bullets[1]**: 노이즈 게이트 (-65 ~ -30 dB): 대사 사이 무음 구간의 마이크 화이트노이즈·바닥 잡음을 차단합니다.
- **help.advSteps[3].title**: 다이내믹 컴프레서 & 교차 출처 보안 0dB 상한
- **help.advSteps[3].bullets[0]**: 컴프레서 (약 2:1 · 중 4:1 · 강 8:1): 갑작스럽게 튀는 비명이나 폭발음 피크를 매끄럽게 눌러 귀를 보호합니다.
- **help.advSteps[3].bullets[1]**: 보안 0dB 상한: 교차 출처(CORS)·DRM 보호 미디어는 저작권 보호 정책을 존중해 기본 볼륨 제어(0dB 이하 감쇠)로 자동 전환되며 [페이더] 상단에 빗금이 표시되고 미터는 설정 볼륨 기준으로 표시됩니다.
- **help.terms.tabJump.name**: 탭 이동 헤더 (Tab Jump)
- **help.terms.tabJump.subtitle**: 파비콘 · 도메인 · ↗ 바로 이동 버튼
- **help.terms.tabJump.description**: 채널 상단 파비콘·사이트명·↗ 버튼입니다. 클릭하거나 채널 선택 후 Enter를 누르면 해당 미디어가 재생 중인 브라우저 탭과 창으로 즉시 포커스가 이동합니다.
- **help.terms.popout.name**: 독립 창 분리 (Popout)
- **help.terms.popout.subtitle**: 상단 데크 ? 옆 창 분리(↗) 버튼
- **help.terms.popout.description**: 상단 데크의 창 분리 버튼입니다. 팝업을 독립 콘솔 창으로 떼어내 항상 띄워 두고 크기를 자유롭게 조절할 수 있습니다(최소 520×420 크기 자동 유지).
- **help.terms.normSplit.name**: 균일 N ▾ (Normalizer Split)
- **help.terms.normSplit.subtitle**: 상단 자동 음압 평준화 스플릿 버튼
- **help.terms.normSplit.description**: 상단 '모든 채널' 노멀라이저 스플릿 버튼입니다. 본체를 누르면 즉시 ON/OFF되며('이 채널만'으로 따로 둔 채널은 그대로), 우측 ▾에서 클래식(광대역) · 음악(강약 보존) · 표준(영상/방송) · 야간(강한 균일) 프리셋과 내 프리셋을 고릅니다.
- **help.terms.fader.name**: 페이더 (Fader)
- **help.terms.fader.subtitle**: 채널 중앙 볼륨 슬롯 · 눈금 영역
- **help.terms.fader.description**: 채널 중앙의 볼륨 슬롯과 눈금 영역입니다. 마우스 휠(Shift+휠 미세 조절)로 음량을 조절하거나 더블클릭해 0.0dB로 복귀합니다(오조작 방지를 위해 드래그는 노브 전용).
- **help.terms.knob.name**: 노브 (Knob)
- **help.terms.knob.subtitle**: 볼륨 조절 사각 손잡이 캡
- **help.terms.knob.description**: 페이더와 상단 Focus α 슬라이더 위의 사각 손잡이 캡입니다. 마우스로 직접 잡고 위아래로 끌어 -60dB ~ +12dB를 조절하며, 더블클릭 시 0.0dB로 즉시 복귀합니다.
- **help.terms.meter.name**: 레벨 미터 (Level Meter)
- **help.terms.meter.subtitle**: 실시간 출력 음량 20단 피크 미터
- **help.terms.meter.description**: 페이더·눈금 오른쪽의 20단 실시간 피크 미터입니다. 현재 채널의 출력 음량 크기와 과증폭(+0dB 초과 경고) 여부를 녹색·주황·적색 막대로 보여줍니다.
- **help.terms.readout.name**: 수치 표시창 (Readout)
- **help.terms.readout.subtitle**: 스트립 전체 폭 dB 표시 · 직접 입력창
- **help.terms.readout.description**: 페이더 아래 전체 폭 데시벨 표시창입니다. 클릭하면 원하는 수치(예: -8.5)를 키보드로 직접 타이핑하여 Enter로 즉시 적용할 수 있습니다.
- **help.terms.grip.name**: 드래그 핸들 (Grip Handle)
- **help.terms.grip.subtitle**: 채널 맨 위 6점(⠿) 이동 손잡이
- **help.terms.grip.description**: 채널 맨 위 좌측 점 6개(⠿) 손잡이(우측에는 노멀라이저 N 배지 표시)입니다. 좌우로 끌어 순서를 바꾸거나, 우측 대기 구역에 놓아 즉시 일시정지할 수 있습니다.
- **help.terms.pin.name**: 도메인 핀 (Domain Pin)
- **help.terms.pin.subtitle**: 하단 재생 버튼 오른쪽 압정(📌) 스위치
- **help.terms.pin.description**: 하단 재생 버튼 오른쪽의 압정(📌) 스위치입니다. 켜 두면 이후 같은 사이트를 새 탭으로 열 때 현재 설정한 볼륨이 시작 기본값으로 자동 적용됩니다.
- **help.terms.switchBank.name**: 스위치 뱅크 (Switch Bank)
- **help.terms.switchBank.subtitle**: 채널 최하단 M · S · F 3버튼 묶음
- **help.terms.switchBank.description**: 채널 맨 아래 M · S · F 3버튼 묶음입니다. M(음소거), S(단독 청취), F(선택 탭 외 배경 탭 감쇠 · Shift+클릭 다중 선택)로 여러 탭 간의 청취 집중도를 빠르게 전환합니다.
- **help.terms.masterBus.name**: 마스터 버스 (Master Bus)
- **help.terms.masterBus.subtitle**: 콘솔 우측 고정 전체 출력 스트립
- **help.terms.masterBus.description**: 콘솔 우측에 고정된 전체 출력 스트립입니다. 좌·우 2열 스테레오 레벨 미터, 중앙 마스터 페이더, 하단 전체 정지 및 전체 음소거 2단 버튼으로 구성됩니다.
- **help.tourDialogAria**: Fadedesk 콘솔 실화면 투어
- **help.tourDemoPill**: 예시 채널 표시 중
- **help.tourSkipLabel**: 투어 건너뛰기
- **help.tourPrevLabel**: 이전
- **help.tourNextLabel**: 다음
- **help.tourDoneLabel**: 완료
- **help.demoTrackTitle**: 예시 · 어쿠스틱 세션 트랙
- **help.demoStreamTitle**: 예시 · 라이브 토크 방송 (대기)
- **help.tourSteps[0].title**: 상단 테마 · 도움말(?) · 독립 창 분리(↗)
- **help.tourSteps[0].desc**: 좌측 색상 점(●)에서 테마·모드를 바꾸고, 창 분리(↗) 버튼으로 콘솔을 별도 창으로 떼어내 항상 띄워 둘 수 있습니다.
- **help.tourSteps[1].title**: 채널 헤더 클릭 → 해당 탭 바로 이동(↗)
- **help.tourSteps[1].desc**: 파비콘·사이트명·↗ 영역을 클릭(또는 Enter)하면 여러 창의 수많은 탭 중에서 소리가 나는 해당 탭으로 즉시 이동합니다.
- **help.tourSteps[2].title**: 페이더 노브 드래그 & dB 직접 입력
- **help.tourSteps[2].desc**: 사각 노브를 끌어 -60dB~+12dB까지 조절하고, 아래 숫자창을 클릭해 원하는 데시벨을 직접 타이핑할 수 있습니다.
- **help.tourSteps[3].title**: 재생 전환 · 도메인 핀(📌) · 드래그 정렬(⠿)
- **help.tourSteps[3].desc**: 재생 옆 압정(📌)을 켜면 사이트 기본 볼륨으로 기억되며, 맨 위 6점 핸들(⠿)을 우측 대기 구역에 놓으면 즉시 일시정지됩니다.
- **help.tourSteps[4].title**: 집중 청취(M · S · F)와 상단 Focus α
- **help.tourSteps[4].desc**: F(Focus)를 켜면 이 탭만 또렷하게 두고 다른 탭들은 상단 Focus α 비율만큼 줄입니다. 우측 데시벨 수치도 직접 입력할 수 있습니다.
- **help.tourSteps[5].title**: 모든 채널 노멀라이저(균일 N ▾)
- **help.tourSteps[5].desc**: 본체로 모든 채널 노멀라이저를 켜고 끄며, 우측 ▾에서 클래식 · 음악 · 표준 · 야간 프리셋이나 내 프리셋을 고릅니다. '이 채널만'으로 따로 둔 채널은 건드리지 않습니다.
- **help.tourSteps[6].title**: 마스터 버스 · 전체 FX
- **help.tourSteps[6].desc**: 우측 마스터 버스에서 전체 볼륨·일괄 정지·음소거를 다루고, '전체 FX'를 누르면 고급 FX 랙이 모든 채널을 고치는 상태로 열립니다.
- **help.tourSteps[7].title**: 고급 FX 랙: 모든 채널 · 이 채널
- **help.tourSteps[7].desc**: 랙 위 탭으로 고칠 대상을 고릅니다. '🔗 모든 채널 따름' 카드는 잠겨 있어 '이 채널만 따로'를 눌러야 바뀌고, '세부 ▸'에서 바꾼 값은 내 프리셋으로 저장합니다. 채널 위 N G C P 칩은 지금 걸린 효과입니다.

## 5. 컬러 테마 이름

- **theme.teal**: 스튜디오 틸
- **theme.amber**: 콘솔 앰버
- **theme.cobalt**: 프리시전 코발트
- **theme.emerald**: 브로드캐스트 에메랄드

## 6. 세부 창 이름 (화면 낭독기용)

- **html.fxDetailAria**: 고급 FX 세부

## 7. 도움말 그림(도면) 안의 짧은 라벨

- **schematic.normLabel**: 균일 N
- **schematic.playLabel**: 재생
- **schematic.pauseAllLabel**: 전체 정지
- **schematic.muteAllLabel**: 전체 음소거

## 8. 확장 프로그램 이름·설명·단축키 이름 (Chrome 확장 관리 화면과 스토어에 보임)

- **locale.extDescription**: 여러 창과 백그라운드 탭의 소리를 한곳에서 재생·정지하고 dB 페이더, Focus/Solo, 스테레오 팬, 음량 평준화(LUFS), 도메인 핀으로 제어하는 오디오 콘솔
- **locale.actionTitle**: Fadedesk — 탭별 오디오 믹서 콘솔
- **locale.cmdOpenConsole**: Fadedesk 콘솔 팝업 열기
- **locale.cmdToggleMasterMute**: 전체 출력 음소거(Master Mute) 토글
- **locale.cmdCycleFocus**: 재생 중인 미디어 탭 순서대로 Focus 전환
