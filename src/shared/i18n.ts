import { AUTO_NORM_PRESET_META } from "./mixer-math";
import { PALETTES } from "./palettes";
import type {
  AutoNormPreset,
  ChannelNormMode,
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
  { label: string; shortLabel: string; badge: string; summary: string }
> = {
  music: {
    label: "Music (Dynamic)",
    shortLabel: "Music",
    badge: "-16 LUFS · Slow(9s)",
    summary:
      "9s BS.1770 gated window preserves intra-song chorus dynamics while matching loudness across tracks.",
  },
  standard: {
    label: "Standard (Video)",
    shortLabel: "Std",
    badge: "-16 LUFS · Std(3s)",
    summary:
      "3s EBU 3341 short-term window balances loudness across video, live stream, and lecture tabs.",
  },
  night: {
    label: "Night (Even)",
    shortLabel: "Night",
    badge: "-18 LUFS · Fast(0.4s)",
    summary:
      "0.4s EBU 3341 momentary window tames sudden loud peaks quickly while keeping speech clear.",
  },
};

export function getLocalizedPresetMeta(
  preset: AutoNormPreset,
  locale: UiLocale = getUiLocale(),
): {
  label: string;
  shortLabel: string;
  badge: string;
  targetLufs: number;
  speed: NormSpeedPreset;
  summary: string;
} {
  const base = AUTO_NORM_PRESET_META[preset] ?? AUTO_NORM_PRESET_META.standard;
  if (locale !== "en") return base;
  const en = AUTO_NORM_META_EN[preset] ?? AUTO_NORM_META_EN.standard;
  return {
    ...base,
    label: en.label,
    shortLabel: en.shortLabel,
    badge: en.badge,
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
  fxNormModes: Record<ChannelNormMode, string>;
  fxNormSpeeds: Record<NormSpeedPreset, string>;
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
  popoutBtnTitle: "독립 창으로 분리해 원하는 크기로 조절",
  popoutBtnAria: "독립 창으로 콘솔 분리",
  alphaBoxTitle: "Focus 감쇠(α): 노브 드래그·휠 조절 · 우측 수치 클릭 시 직접 입력",
  alphaTrackTitle: "노브 드래그로 조절 · 더블클릭 시 0.70(-12dB) 복귀",
  alphaReadoutAria: "Focus 감쇠 데시벨 직접 입력",
  alphaReadoutTitle: "클릭하여 Focus 감쇠 dB(예: -12, -15.5, 0) 또는 비율(예: 0.75) 직접 입력",
  alphaInputAria: "Focus 감쇠 dB 입력",
  resetModesLabel: "S·F 해제",
  resetModesTitle: "켜져 있는 Solo / Focus 모드를 모두 해제합니다",
  autoNormLabel: "균일 N",
  autoNormBtnTitle: (desc) => `전역 자동 노멀라이저 (현재 프리셋: ${desc}) — 클릭 시 ON/OFF`,
  autoNormPresetAria: "자동 노멀라이저 프리셋 선택",
  autoNormPresetTitle: (desc) => `자동 노멀라이저 프리셋 선택 (현재: ${desc})`,
  advRackOpenLabel: "고급 FX ◂",
  advRackClosedLabel: "고급 FX ▸",
  advRackTitle: "선택 채널 고급 FX 사이드 랙 열기/닫기",
  sideFxAria: "선택 채널 고급 FX",
  themeDialogAria: "컬러 테마 및 화면 모드",
  themeHeader: "컬러 테마",
  modeHeader: "화면 모드",
  modeLabels: { dark: "다크", light: "라이트", system: "시스템" },
  systemResolvedLabel: (isDark) => `시스템(${isDark ? "다크" : "라이트"})`,
  normDialogAria: "이지 노멀라이저 프리셋",
  normHeader: "이지 노멀라이저 프리셋",
  normListAria: "이지 노멀라이저 프리셋 목록",
  emptyTitle: "활성 미디어 탭이 없습니다",
  emptyDesc: "동영상·스트리밍·음악 사이트에서 미디어를 재생하면 채널 스트립이 이 자리에 자동으로 정렬됩니다.",
  toastPresetApplied: (s) => `균일 N: ${s} 프리셋 적용`,
  toastZoneMoved: (t, p) => `${t}: ${p ? "재생 구역 이동 · 즉시 재생" : "일시정지 구역 이동 · 즉시 정지"}`,
  toastChannelFallback: "채널",
  toastPinCleared: (h) => `${h} 기본 볼륨 해제`,
  toastPinSaved: (h, d) => `${h} ${d}dB 고정`,
  toastJumpTab: (t) => `탭 이동: ${t}`,
  inlineDirectInput: "직접 입력",
  dropToPlay: "여기에 놓아 재생",
  dropToPause: "여기에 놓아 일시정지",
  dropHere: "여기에 배치",
  gripTitle: "드래그하여 채널 순서 변경 · 재생↔일시정지 구역 이동 시 즉시 전환",
  faderTrackTitle: "노브 드래그 · 휠 조절 (Shift+휠 미세) · 더블클릭 0.0dB 복귀",
  faderKnobTitle: "노브를 잡아 위아래로 드래그 · 더블클릭 시 0.0dB 복귀",
  readoutTitle: "클릭하여 dB 직접 입력 (Enter 적용 · Esc 취소)",
  channelDbAria: "채널 데시벨 직접 입력",
  playToggleTitle: "재생 / 일시정지",
  playActiveLabel: "재생",
  playIdleLabel: "대기",
  muteTitle: "음소거 (Mute)",
  soloTitle: "Solo (클릭: 단독 전환/해제 · Shift+클릭: 다중 · Focus와 상호 배타)",
  focusTitle: "Focus (클릭: 단독 전환/해제 · Shift+클릭: 다중 · Solo와 상호 배타)",
  normBadgeCustomOn: "개별 노멀라이저 고정 ON",
  normBadgeCustomOff: "전역 균일 N 개별 제외됨",
  normBadgeGlobal: (s) => `전역 균일 N 적용 중 (${s})`,
  headerJumpTitle: (t, d) => `${t}${d ? ` (${d})` : ""} — 클릭 시 해당 탭·창으로 이동`,
  subCorsCap: "보안 0dB 상한",
  subPaused: "일시정지",
  subMuted: "음소거",
  subAttenuated: (d) => `실효 ${d}dB`,
  subNormTrim: (d) => `균일 ${d}dB`,
  subPinned: "도메인 고정",
  subIndividual: "개별 볼륨",
  pinDisabledTitle: "도메인 정보를 사용할 수 없는 탭입니다",
  pinSavedTitle: (dom, db) => `${dom} 기본값 (${db} dB) · 클릭하여 고정/해제`,
  pinSetTitle: (db, dom) => `현재 볼륨(${db} dB)을 ${dom} 새 탭 기본값으로 고정`,
  masterTitle: "전체 출력",
  masterTrackTitle: "노브 드래그 · 휠 조절 · 더블클릭 0.0dB 복귀",
  masterReadoutTitle: "클릭하여 마스터 dB 직접 입력 (Enter 적용 · Esc 취소)",
  masterInputAria: "마스터 데시벨 직접 입력",
  masterSub: "마스터 게인",
  masterPauseAll: "전체 정지",
  masterPlayAll: "전체 재생",
  masterMuteAll: "전체 음소거",
  fxUnselectedTitle: "채널 미선택",
  fxUnselectedSub: "활성 미디어 탭을 선택하세요",
  fxNoActiveTitle: "활성 채널 없음",
  fxNoActiveSub: "미디어 재생 시 채널별 고급 FX가 활성화됩니다",
  fxCorsSub: "교차 출처·DRM 보안으로 DSP 자동 우회",
  fxTrimIdle: "대기",
  fxTrimCors: "보안 0dB · 우회",
  fxTrimActive: (d) => `보정 ${d}dB`,
  fxTrimOff: "보정 OFF",
  fxModeCustomOn: "개별 고정 ON",
  fxModeCustomOff: "전역 제외 OFF",
  fxModeGlobalOn: (s) => `전역 균일(${s})`,
  fxModeGlobalIdle: "전역 대기",
  fxNormCardTitle: "노멀라이저",
  fxNormCustomHint: (l) => `개별 ${l}`,
  fxNormTargetLabel: "개별 목표 음압",
  fxNormTargetAria: "개별 목표 음압 LUFS",
  fxNormModes: { follow: "전역 따름", on: "개별 ON", off: "개별 OFF" },
  fxNormSpeeds: { slow: "완만", std: "표준", fast: "민감" },
  fxPanCardTitle: "패닝 (Pan)",
  fxPanResetTitle: "클릭 시 중앙(C) 복귀",
  fxPanAria: "스테레오 좌우 패닝",
  fxGateCardTitle: "노이즈 게이트",
  fxGateFloorLabel: "바닥 차단",
  fxGateAria: "노이즈 게이트 임계값 dB",
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
  autoNormBtnTitle: (desc) => `Global Auto Normalizer (Preset: ${desc}) — click to toggle`,
  autoNormPresetAria: "Select Auto Normalizer preset",
  autoNormPresetTitle: (desc) => `Select Auto Normalizer preset (Current: ${desc})`,
  advRackOpenLabel: "FX Rack ◂",
  advRackClosedLabel: "FX Rack ▸",
  advRackTitle: "Toggle per-channel FX side rack",
  sideFxAria: "Selected channel FX rack",
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
  fxNoActiveSub: "Play media in a tab to unlock per-channel FX",
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
  fxNormModes: { follow: "Follow", on: "On", off: "Off" },
  fxNormSpeeds: { slow: "Slow", std: "Std", fast: "Fast" },
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
