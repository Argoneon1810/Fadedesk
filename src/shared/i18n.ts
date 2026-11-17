import { AUTO_NORM_PRESET_META } from "./mixer-math";
import { PALETTES } from "./palettes";
import type {
  AutoNormPreset,
  CompRatioPreset,
  ModePref,
  NormSpeedPreset,
  ThemeKey,
} from "./types";

/**
 * Fadedesk 한·영 런타임 다국어(i18n) 해석 및 UI 문구 사전 모듈.
 * - 우선순위: URL `?lang=ko|en` -> `chrome.i18n.getUILanguage()` -> `<html lang>` -> `navigator.language`
 * - 팝업 고정 폭(768px/788px, 상태 알약 124px, 스트립 94px, FX 랙 214px) 안에서 줄바꿈·잘림이 없도록 한·영 길이를 함께 설계한다.
 */

export type UiLocale = "ko" | "en";

let cachedLocale: UiLocale | null = null;

export function resolveUiLocale(): UiLocale {
  try {
    const loc = (globalThis as { location?: Location }).location;
    if (loc?.search) {
      const q = new URLSearchParams(loc.search).get("lang")?.trim().toLowerCase();
      if (q === "en") return "en";
      if (q === "ko") return "ko";
    }
  } catch {
    // URL 파싱 실패 무시
  }

  try {
    const uiLang = (globalThis as { chrome?: typeof chrome }).chrome?.i18n?.getUILanguage?.();
    if (typeof uiLang === "string" && uiLang.trim().length > 0) {
      return uiLang.trim().toLowerCase().startsWith("ko") ? "ko" : "en";
    }
  } catch {
    // 확장 외 테스트 환경 무시
  }

  try {
    const docLang = (globalThis as { document?: Document }).document?.documentElement?.lang;
    if (typeof docLang === "string" && docLang.trim().length > 0) {
      return docLang.trim().toLowerCase().startsWith("ko") ? "ko" : "en";
    }
  } catch {
    // DOM 미존재 환경 무시
  }

  try {
    const navLang = (globalThis as { navigator?: Navigator }).navigator?.language;
    if (typeof navLang === "string" && navLang.trim().length > 0) {
      return navLang.trim().toLowerCase().startsWith("ko") ? "ko" : "en";
    }
  } catch {
    // navigator 미존재 환경 무시
  }

  return "ko";
}

export function getUiLocale(): UiLocale {
  if (cachedLocale === null) {
    cachedLocale = resolveUiLocale();
  }
  return cachedLocale;
}

export function resetUiLocaleCache(): void {
  cachedLocale = null;
}

const THEME_LABELS_EN: Record<ThemeKey, string> = {
  teal: "Studio Teal",
  amber: "Console Amber",
  cobalt: "Precision Cobalt",
  emerald: "Broadcast Emerald",
};

export function getThemeLabel(theme: ThemeKey, locale: UiLocale = getUiLocale()): string {
  return locale === "en" ? THEME_LABELS_EN[theme] : PALETTES[theme].label;
}

const AUTO_NORM_META_EN: Record<
  AutoNormPreset,
  { label: string; shortLabel: string; badge: string; spec: string; summary: string }
> = {
  classical: {
    label: "Classical (Wide Range)",
    shortLabel: "Class.",
    badge: "-16 LUFS · Wide(15s)",
    spec: "Band [-28..-13] · Dwell 1.8s · Return 0.50dB/s · Max +4dB",
    summary:
      "Excludes soft solos (ppp) and loud tuttis (fff) while returning toward 0.0 dB to preserve wide dynamics.",
  },
  music: {
    label: "Music (Default)",
    shortLabel: "Music",
    badge: "-16 LUFS · Slow(9s)",
    spec: "Band [-32..-10] · Dwell 1.2s · Return 0.35dB/s · Max +6dB",
    summary:
      "Preserves intra-song chorus dynamics while gently matching average loudness across tracks.",
  },
  standard: {
    label: "Standard (Video)",
    shortLabel: "Std",
    badge: "-16 LUFS · Std(3s)",
    spec: "Band [-36..-8] · Dwell 0.45s · Return 0.25dB/s · Max +7.5dB",
    summary:
      "Balances speech and background loudness quickly across video, live stream, and lecture tabs.",
  },
  night: {
    label: "Night (Even)",
    shortLabel: "Night",
    badge: "-18 LUFS · Fast(0.4s)",
    spec: "Band [-42..-6] · Dwell 0.15s · Return 0.15dB/s · Max +9dB",
    summary:
      "Tames sudden loud peaks quickly while keeping quiet speech clear for late-night listening.",
  },
};

export function getLocalizedPresetMeta(
  preset: AutoNormPreset,
  locale: UiLocale = getUiLocale(),
): {
  label: string;
  shortLabel: string;
  badge: string;
  spec: string;
  targetLufs: number;
  speed: NormSpeedPreset;
  rangeLowLufs: number;
  rangeHighLufs: number;
  zeroReturnRate: number;
  summary: string;
} {
  const base = AUTO_NORM_PRESET_META[preset] ?? AUTO_NORM_PRESET_META.music;
  if (locale !== "en") return base;
  const en = AUTO_NORM_META_EN[preset] ?? AUTO_NORM_META_EN.music;
  return {
    ...base,
    label: en.label,
    shortLabel: en.shortLabel,
    badge: en.badge,
    spec: en.spec,
    summary: en.summary,
  };
}

export interface UiDictionary {
  pageTitlePopup: string;
  pageTitleWindow: string;
  scanning: string;
  statusCounts: (playing: number, paused: number) => string;
  themeBtnTitle: string;
  helpBtnTitle: string;
  popoutBtnTitle: string;
  popoutBtnAria: string;
  alphaBoxTitle: string;
  alphaTrackTitle: string;
  alphaReadoutAria: string;
  alphaReadoutTitle: string;
  alphaInputAria: string;
  resetModesLabel: string;
  resetModesTitle: string;
  autoNormLabel: string;
  autoNormBtnTitle: (presetDesc: string) => string;
  autoNormPresetAria: string;
  autoNormPresetTitle: (presetDesc: string) => string;
  advRackOpenLabel: string;
  advRackClosedLabel: string;
  advRackTitle: string;
  sideFxAria: string;
  themeDialogAria: string;
  themeHeader: string;
  modeHeader: string;
  modeLabels: Record<ModePref, string>;
  systemResolvedLabel: (isDark: boolean) => string;
  normDialogAria: string;
  normHeader: string;
  normListAria: string;
  emptyTitle: string;
  emptyDesc: string;
  toastPresetApplied: (shortLabel: string) => string;
  toastZoneMoved: (title: string, playing: boolean) => string;
  toastChannelFallback: string;
  toastPinCleared: (host: string) => string;
  toastPinSaved: (host: string, dbStr: string) => string;
  toastJumpTab: (title: string) => string;
  inlineDirectInput: string;
  dropToPlay: string;
  dropToPause: string;
  dropHere: string;
  gripTitle: string;
  faderTrackTitle: string;
  faderKnobTitle: string;
  readoutTitle: string;
  channelDbAria: string;
  playToggleTitle: string;
  playActiveLabel: string;
  playIdleLabel: string;
  muteTitle: string;
  soloTitle: string;
  focusTitle: string;
  normBadgeCustomOn: string;
  normBadgeCustomOff: string;
  normBadgeGlobal: (presetShort: string) => string;
  headerJumpTitle: (title: string, domain: string) => string;
  subCorsCap: string;
  subPaused: string;
  subMuted: string;
  subAttenuated: (dbStr: string) => string;
  subNormTrim: (trimStr: string) => string;
  subPinned: string;
  subIndividual: string;
  pinDisabledTitle: string;
  pinSavedTitle: (domain: string, savedDb: string) => string;
  pinSetTitle: (curDb: string, domain: string) => string;
  masterTitle: string;
  masterTrackTitle: string;
  masterReadoutTitle: string;
  masterInputAria: string;
  masterSub: string;
  masterPauseAll: string;
  masterPlayAll: string;
  masterMuteAll: string;
  fxUnselectedTitle: string;
  fxUnselectedSub: string;
  fxNoActiveTitle: string;
  fxNoActiveSub: string;
  fxCorsSub: string;
  fxTrimIdle: string;
  fxTrimCors: string;
  fxTrimActive: (trimStr: string) => string;
  fxTrimOff: string;
  fxModeCustomOn: string;
  fxModeCustomOff: string;
  fxModeGlobalOn: (shortLabel: string) => string;
  fxModeGlobalIdle: string;
  fxNormCardTitle: string;
  fxNormCustomHint: (lufs: number) => string;
  fxNormTargetLabel: string;
  fxNormTargetAria: string;
  fxNormSpeeds: Record<NormSpeedPreset, string>;
  fxVizExpandTitle: string;
  fxVizCollapseTitle: string;
  fxBoundHighTag: (lufs: number) => string;
  fxBoundLowTag: (lufs: number) => string;
  fxTargetPinTag: (lufs: number) => string;
  fxRangeSummary: (low: number, high: number) => string;
  fxRangePreview: (curLow: number, curHigh: number, nextLow: number, nextHigh: number) => string;
  fxTensionLabel: string;
  fxTensionAria: string;
  fxStateInBand: string;
  fxStateReturnZero: string;
  fxStateIdle: string;
  normMiniTitle: string;
  fxPanCardTitle: string;
  fxPanResetTitle: string;
  fxPanAria: string;
  fxGateCardTitle: string;
  fxGateFloorLabel: string;
  fxGateAria: string;
  fxCompCardTitle: string;
  fxCompRatios: Record<CompRatioPreset, string>;
}

const KO_UI: UiDictionary = {
  pageTitlePopup: "Fadedesk",
  pageTitleWindow: "Fadedesk — 독립 콘솔",
  scanning: "탐색 중...",
  statusCounts: (p, w) => `재생 ${p} · 대기 ${w}`,
  themeBtnTitle: "컬러 테마 및 화면 모드 설정",
  helpBtnTitle: "사용법 및 안전 유의사항",
  popoutBtnTitle: "별도 창으로 분리 (크기 조절 가능)",
  popoutBtnAria: "콘솔을 별도 창으로 분리",
  alphaBoxTitle: "Focus 볼륨 줄임(α): 드래그·휠로 조절 · 우측 숫자 클릭해 직접 입력",
  alphaTrackTitle: "드래그하여 조절 · 더블클릭하면 0.70(-12dB)으로 초기화",
  alphaReadoutAria: "Focus 볼륨 줄임 폭(dB) 직접 입력",
  alphaReadoutTitle: "클릭하여 Focus로 줄일 dB(예: -12, -15.5)나 비율(예: 0.75) 직접 입력",
  alphaInputAria: "Focus 볼륨 줄임 폭(dB) 입력",
  resetModesLabel: "S·F 해제",
  resetModesTitle: "켜져 있는 Solo / Focus 모드를 모두 해제합니다",
  autoNormLabel: "균일 N",
  autoNormBtnTitle: (desc) => `모든 채널 노멀라이저 (현재: ${desc}) — 클릭하여 켜기/끄기 · '이 채널만' 설정된 곳은 제외`,
  autoNormPresetAria: "노멀라이저 프리셋 선택",
  autoNormPresetTitle: (desc) => `노멀라이저 프리셋 선택 (현재: ${desc})`,
  advRackOpenLabel: "고급 FX ◂",
  advRackClosedLabel: "고급 FX ▸",
  advRackTitle: "고급 FX 랙 열기/닫기 (모든 채널 · 이 채널)",
  sideFxAria: "고급 FX",
  themeDialogAria: "컬러 테마 및 화면 모드",
  themeHeader: "컬러 테마",
  modeHeader: "화면 모드",
  modeLabels: { dark: "다크", light: "라이트", system: "시스템" },
  systemResolvedLabel: (isDark) => `시스템(${isDark ? "다크" : "라이트"})`,
  normDialogAria: "노멀라이저 프리셋",
  normHeader: "노멀라이저 프리셋",
  normListAria: "노멀라이저 프리셋 목록",
  emptyTitle: "재생 중인 미디어 탭이 없습니다",
  emptyDesc: "동영상·스트리밍·음악 사이트에서 소리를 재생하면 이곳에 채널이 자동으로 나타납니다.",
  toastPresetApplied: (s) => `균일 N: ${s} 프리셋 적용`,
  toastZoneMoved: (t, p) => `${t}: ${p ? "재생 구역으로 이동 · 바로 재생" : "대기 구역으로 이동 · 바로 일시정지"}`,
  toastChannelFallback: "채널",
  toastPinCleared: (h) => `${h} 기본 볼륨 해제`,
  toastPinSaved: (h, d) => `${h} ${d}dB 고정`,
  toastJumpTab: (t) => `탭 이동: ${t}`,
  inlineDirectInput: "직접 입력",
  dropToPlay: "여기에 놓아 재생",
  dropToPause: "여기에 놓아 일시정지",
  dropHere: "여기에 놓기",
  gripTitle: "드래그하여 채널 순서 변경 · 재생↔일시정지 구역 이동 시 즉시 전환",
  faderTrackTitle: "노브 드래그 · 휠로 조절 (Shift+휠: 미세 조절) · 더블클릭 시 0.0dB",
  faderKnobTitle: "위아래로 드래그 · 더블클릭하면 0.0dB로 초기화",
  readoutTitle: "클릭하여 dB 직접 입력 (Enter 적용 · Esc 취소)",
  channelDbAria: "채널 데시벨 직접 입력",
  playToggleTitle: "재생 / 일시정지",
  playActiveLabel: "재생",
  playIdleLabel: "대기",
  muteTitle: "음소거 (Mute)",
  soloTitle: "Solo: 이 채널만 듣기 (Shift+클릭: 여러 개 선택 · Focus와 동시 사용 불가)",
  focusTitle: "Focus: 다른 채널 줄이기 (Shift+클릭: 여러 개 선택 · Solo와 동시 사용 불가)",
  normBadgeCustomOn: "이 채널만 켜짐",
  normBadgeCustomOff: "이 채널만 꺼짐",
  normBadgeGlobal: (s) => `모든 채널 적용 중 (${s})`,
  headerJumpTitle: (t, d) => `${t}${d ? ` (${d})` : ""} — 클릭 시 해당 탭·창으로 이동`,
  subCorsCap: "보안 제한 (0dB)",
  subPaused: "일시정지",
  subMuted: "음소거",
  subAttenuated: (d) => `최종 ${d}dB`,
  subNormTrim: (d) => `균일 ${d}dB`,
  subPinned: "사이트 고정",
  subIndividual: "개별 볼륨",
  pinDisabledTitle: "사이트 주소를 확인할 수 없는 탭입니다",
  pinSavedTitle: (dom, db) => `${dom} 기본 볼륨 (${db} dB) · 클릭하여 고정 해제`,
  pinSetTitle: (db, dom) => `현재 볼륨(${db} dB)을 ${dom} 새 탭 기본값으로 고정`,
  masterTitle: "전체 출력",
  masterTrackTitle: "드래그 · 휠로 조절 · 더블클릭하면 0.0dB로 초기화",
  masterReadoutTitle: "클릭하여 마스터 dB 직접 입력 (Enter 적용 · Esc 취소)",
  masterInputAria: "마스터 데시벨 직접 입력",
  masterSub: "마스터 게인",
  masterPauseAll: "전체 정지",
  masterPlayAll: "전체 재생",
  masterMuteAll: "전체 음소거",
  fxUnselectedTitle: "채널 미선택",
  fxUnselectedSub: "왼쪽에서 채널을 선택하세요",
  fxNoActiveTitle: "재생 중인 채널 없음",
  fxNoActiveSub: "미디어를 재생하면 채널이 나타납니다",
  fxCorsSub: "사이트 보안으로 고급 FX 제한됨",
  fxTrimIdle: "대기",
  fxTrimCors: "보안 제한 (0dB)",
  fxTrimActive: (d) => `보정 ${d}dB`,
  fxTrimOff: "보정 꺼짐",
  fxModeCustomOn: "이 채널만 켜짐",
  fxModeCustomOff: "이 채널만 꺼짐",
  fxModeGlobalOn: (s) => `모든 채널 (${s})`,
  fxModeGlobalIdle: "모든 채널 대기",
  fxNormCardTitle: "노멀라이저",
  fxNormCustomHint: (l) => `개별 ${l}`,
  fxNormTargetLabel: "목표 음량",
  fxNormTargetAria: "목표 음량 LUFS",
  fxNormSpeeds: { slow: "완만", std: "표준", fast: "민감" },
  fxVizExpandTitle: "유효 구간 그래프 펼치기 (스펙트럼 보기)",
  fxVizCollapseTitle: "유효 구간 그래프 접기 (막대로 보기)",
  fxBoundHighTag: (l) => `상한 ${l} ↕`,
  fxBoundLowTag: (l) => `하한 ${l} ↕`,
  fxTargetPinTag: (l) => `목표 ${l}`,
  fxRangeSummary: (low, high) => `유효 [${low}..${high}]`,
  fxRangePreview: (curLow, curHigh, nextLow, nextHigh) => `유효 [${curLow}..${curHigh}] → [${nextLow}..${nextHigh}]`,
  fxTensionLabel: "원음 복귀 속도",
  fxTensionAria: "유효 구간을 벗어났을 때 0.0dB로 돌아가는 속도",
  fxStateInBand: "음량 맞추는 중",
  fxStateReturnZero: "원음 복귀 ↺",
  fxStateIdle: "대기 중",
  normMiniTitle: "실시간 음량 · 유효 구간",
  fxPanCardTitle: "패닝 (Pan)",
  fxPanResetTitle: "클릭하여 가운데(C)로 초기화",
  fxPanAria: "스테레오 좌우 패닝",
  fxGateCardTitle: "노이즈 게이트",
  fxGateFloorLabel: "차단 기준",
  fxGateAria: "노이즈 게이트 차단 기준 dB",
  fxCompCardTitle: "컴프레서",
  fxCompRatios: { 2: "약 2:1", 4: "중 4:1", 8: "강 8:1" },
};

const EN_UI: UiDictionary = {
  pageTitlePopup: "Fadedesk",
  pageTitleWindow: "Fadedesk — Console Window",
  scanning: "Scanning...",
  statusCounts: (p, w) => `${p} Play · ${w} Idle`,
  themeBtnTitle: "Color theme & appearance mode",
  helpBtnTitle: "Console guide & safety notices",
  popoutBtnTitle: "Detach console into a resizable window",
  popoutBtnAria: "Detach into standalone window",
  alphaBoxTitle: "Focus ducking (α): drag knob / scroll wheel · click value to type dB",
  alphaTrackTitle: "Drag knob to adjust · double-click to reset to 0.70 (-12dB)",
  alphaReadoutAria: "Type Focus ducking dB directly",
  alphaReadoutTitle: "Click to enter Focus ducking in dB (e.g. -12, -15.5, 0) or ratio (e.g. 0.75)",
  alphaInputAria: "Focus ducking dB input",
  resetModesLabel: "Clear S·F",
  resetModesTitle: "Clear all active Solo and Focus modes",
  autoNormLabel: "Level N",
  autoNormBtnTitle: (desc) => `All-channel normalizer (Current: ${desc}) — click to toggle; tabs set separately are unaffected`,
  autoNormPresetAria: "Select Auto Normalizer preset",
  autoNormPresetTitle: (desc) => `Select Auto Normalizer preset (Current: ${desc})`,
  advRackOpenLabel: "FX Rack ◂",
  advRackClosedLabel: "FX Rack ▸",
  advRackTitle: "Toggle FX Rack (all channels · this tab)",
  sideFxAria: "FX Rack",
  themeDialogAria: "Color theme and appearance",
  themeHeader: "Color Theme",
  modeHeader: "Appearance",
  modeLabels: { dark: "Dark", light: "Light", system: "System" },
  systemResolvedLabel: (isDark) => `Auto(${isDark ? "Dark" : "Light"})`,
  normDialogAria: "Loudness Normalizer Presets",
  normHeader: "Loudness Preset",
  normListAria: "Loudness normalizer preset list",
  emptyTitle: "No active media tabs",
  emptyDesc: "Play video or audio in any browser tab and its channel strip will appear here automatically.",
  toastPresetApplied: (s) => `Level N: ${s} preset`,
  toastZoneMoved: (t, p) => `${t}: ${p ? "Moved to Play" : "Moved to Pause"}`,
  toastChannelFallback: "Channel",
  toastPinCleared: (h) => `${h} pin cleared`,
  toastPinSaved: (h, d) => `${h} pinned at ${d}dB`,
  toastJumpTab: (t) => `Jump: ${t}`,
  inlineDirectInput: "Type dB",
  dropToPlay: "Drop to Play",
  dropToPause: "Drop to Pause",
  dropHere: "Drop Here",
  gripTitle: "Drag to reorder · move across divider to Play or Pause",
  faderTrackTitle: "Drag knob · scroll wheel (Shift+wheel fine) · double-click for 0.0dB",
  faderKnobTitle: "Drag fader cap up/down · double-click to reset to 0.0dB",
  readoutTitle: "Click to type dB value (Enter to apply · Esc to cancel)",
  channelDbAria: "Type channel dB value",
  playToggleTitle: "Play / Pause",
  playActiveLabel: "Play",
  playIdleLabel: "Idle",
  muteTitle: "Mute channel (M)",
  soloTitle: "Solo (Click: exclusive · Shift+Click: multi · mutually exclusive with Focus)",
  focusTitle: "Focus (Click: exclusive · Shift+Click: multi · mutually exclusive with Solo)",
  normBadgeCustomOn: "Per-channel normalizer forced ON",
  normBadgeCustomOff: "Excluded from global Level N",
  normBadgeGlobal: (s) => `Global Level N active (${s})`,
  headerJumpTitle: (t, d) => `${t}${d ? ` (${d})` : ""} — click to jump to tab`,
  subCorsCap: "0dB Sec Cap",
  subPaused: "Paused",
  subMuted: "Muted",
  subAttenuated: (d) => `Eff ${d}dB`,
  subNormTrim: (d) => `Lvl ${d}dB`,
  subPinned: "Pinned",
  subIndividual: "Channel dB",
  pinDisabledTitle: "Domain pinning unavailable for this tab",
  pinSavedTitle: (dom, db) => `${dom} default (${db} dB) · click to toggle pin`,
  pinSetTitle: (db, dom) => `Pin ${db} dB as default for new ${dom} tabs`,
  masterTitle: "Master Out",
  masterTrackTitle: "Drag knob · scroll wheel · double-click for 0.0dB",
  masterReadoutTitle: "Click to type Master dB (Enter to apply · Esc to cancel)",
  masterInputAria: "Type Master dB value",
  masterSub: "Master Gain",
  masterPauseAll: "Pause All",
  masterPlayAll: "Play All",
  masterMuteAll: "Mute All",
  fxUnselectedTitle: "No Channel",
  fxUnselectedSub: "Select an active media tab",
  fxNoActiveTitle: "No Active Tab",
  fxNoActiveSub: "Play media in a tab to select it here",
  fxCorsSub: "DSP bypassed due to CORS / DRM media policy",
  fxTrimIdle: "Idle",
  fxTrimCors: "0dB · Bypass",
  fxTrimActive: (d) => `Trim ${d}dB`,
  fxTrimOff: "Trim OFF",
  fxModeCustomOn: "Custom ON",
  fxModeCustomOff: "Bypass OFF",
  fxModeGlobalOn: (s) => `Global (${s})`,
  fxModeGlobalIdle: "Global Idle",
  fxNormCardTitle: "Normalizer",
  fxNormCustomHint: (l) => `Custom ${l}`,
  fxNormTargetLabel: "Target Loudness",
  fxNormTargetAria: "Target loudness LUFS",
  fxNormSpeeds: { slow: "Slow", std: "Std", fast: "Fast" },
  fxVizExpandTitle: "Expand representative band visualizer",
  fxVizCollapseTitle: "Collapse representative band visualizer",
  fxBoundHighTag: (l) => `Max ${l} ↕`,
  fxBoundLowTag: (l) => `Min ${l} ↕`,
  fxTargetPinTag: (l) => `Tgt ${l}`,
  fxRangeSummary: (low, high) => `Band [${low}..${high}]`,
  fxRangePreview: (curLow, curHigh, nextLow, nextHigh) => `Band [${curLow}..${curHigh}] → [${nextLow}..${nextHigh}]`,
  fxTensionLabel: "0dB Return",
  fxTensionAria: "0.0 dB return tension speed when out of band",
  fxStateInBand: "In-Band Active",
  fxStateReturnZero: "0dB Return ↺",
  fxStateIdle: "Idle",
  normMiniTitle: "Live Input & Target Band",
  fxPanCardTitle: "Stereo Pan",
  fxPanResetTitle: "Click to reset to Center (C)",
  fxPanAria: "Stereo left-right pan",
  fxGateCardTitle: "Noise Gate",
  fxGateFloorLabel: "Floor Cutoff",
  fxGateAria: "Noise gate threshold dB",
  fxCompCardTitle: "Compressor",
  fxCompRatios: { 2: "Low 2:1", 4: "Med 4:1", 8: "High 8:1" },
};

export function ui(locale: UiLocale = getUiLocale()): UiDictionary {
  return locale === "en" ? EN_UI : KO_UI;
}

export function applyStaticPopupI18n(doc: Document = document): void {
  const locale = getUiLocale();
  const t = ui(locale);
  doc.documentElement.lang = locale;
  if (doc.documentElement.dataset.view !== "window") {
    doc.title = t.pageTitlePopup;
  }

  const setAttr = (id: string, attr: string, val: string): void => {
    doc.getElementById(id)?.setAttribute(attr, val);
  };
  const setText = (id: string, val: string): void => {
    const el = doc.getElementById(id);
    if (el) el.textContent = val;
  };

  setAttr("theme-dot-btn", "title", t.themeBtnTitle);
  setAttr("help-btn", "title", t.helpBtnTitle);
  setAttr("popout-btn", "title", t.popoutBtnTitle);
  setAttr("popout-btn", "aria-label", t.popoutBtnAria);
  setText("status-text", t.scanning);
  setAttr("alpha-box", "title", t.alphaBoxTitle);
  setAttr("alpha-track", "title", t.alphaTrackTitle);
  setAttr("alpha-readout-btn", "aria-label", t.alphaReadoutAria);
  setAttr("alpha-readout-btn", "title", t.alphaReadoutTitle);
  setAttr("alpha-input", "aria-label", t.alphaInputAria);
  setText("reset-modes-btn", t.resetModesLabel);
  setAttr("reset-modes-btn", "title", t.resetModesTitle);
  setText("auto-norm-btn", t.autoNormLabel);
  setAttr("auto-norm-preset-btn", "aria-label", t.autoNormPresetAria);
  setText("adv-rack-btn", t.advRackClosedLabel);
  setAttr("adv-rack-btn", "title", t.advRackTitle);
  setAttr("side-fx-rack", "aria-label", t.sideFxAria);
  setAttr("theme-popover", "aria-label", t.themeDialogAria);
  setAttr("norm-popover", "aria-label", t.normDialogAria);

  const popLabels = doc.querySelectorAll<HTMLElement>("#theme-popover .pop-label");
  if (popLabels[0]) popLabels[0].textContent = t.themeHeader;
  if (popLabels[1]) popLabels[1].textContent = t.modeHeader;
}
