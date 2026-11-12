/**
 * Sound Manager 확장 내부(콘텐츠 훅 · 브리지 · 백그라운드 · 팝업) 간 공유 타입과 프로토콜 정의.
 */

export type ThemeKey = "teal" | "amber" | "cobalt" | "emerald";
export type ModePref = "dark" | "light" | "system";
export type ExclusiveMode = "solo" | "focus";

/** color-preset.md에 바인딩된 단일 화면 모드(다크 또는 라이트) 토큰 묶음 */
export interface ThemeTokens {
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  bg: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  muted: string;
  states: {
    success: string;
    warning: string;
    danger: string;
    onDanger: string;
  };
}

export interface PaletteEntry {
  label: string;
  dark: ThemeTokens;
  light: ThemeTokens;
}

/** chrome.storage.local에 영구 저장되는 사용자 설정 */
export interface PersistedSettings {
  theme: ThemeKey;
  modePref: ModePref;
  /** Focus 스무딩 계수 (0..1, 기본값 0.70 => 비선택 채널 -12dB 감쇠) */
  alpha: number;
  /** 전체 출력 마스터 게인 (-60..+12 dB) */
  masterDb: number;
  /** 전체 출력 음소거 여부 */
  masterMuted: boolean;
  /** 도메인별 새 탭 기본 볼륨 dB (명시적 핀 고정 시에만 갱신·삭제) */
  domainDefaults: Record<string, number>;
}

/** MAIN 월드 오디오 훅이 프레임 단위로 측정해 보고하는 미디어 상태 */
export interface FrameMediaPayload {
  hasMedia: boolean;
  playingCount: number;
  pausedCount: number;
  corsRestricted: boolean;
  mediaTitle: string;
  vuLevel: number;
  vuPeak: number;
}

/** 팝업 콘솔에 렌더링되는 탭 단위 채널 스트립 상태 */
export interface TabChannelState {
  tabId: number;
  windowId: number;
  title: string;
  domain: string;
  shortHost: string;
  favIconUrl: string;
  playing: boolean;
  audible: boolean;
  mediaCount: number;
  db: number;
  muted: boolean;
  solo: boolean;
  focus: boolean;
  corsCap: boolean;
  vuLevel: number;
  vuPeak: number;
  firstSeenAt: number;
}

/** 팝업 전체 스냅샷 */
export interface ConsoleSnapshot {
  settings: PersistedSettings;
  channels: TabChannelState[];
}

/** MAIN 월드 <-> ISOLATED 월드 커스텀 이벤트 이름 */
export const HOOK_TO_BRIDGE_EVENT = "__sound_manager_hook_to_bridge__";
export const BRIDGE_TO_HOOK_EVENT = "__sound_manager_bridge_to_hook__";
export const POPUP_PORT_NAME = "sound-manager-popup-port";

/** MAIN 월드 오디오 훅이 수신하는 명령 */
export type HookCommand =
  | { type: "APPLY_GAIN"; targetGain: number }
  | { type: "SET_PLAYING"; shouldPlay: boolean }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_METERING"; active: boolean }
  | { type: "REQUEST_REPORT" };

/** MAIN 월드 오디오 훅이 브리지로 내보내는 이벤트 */
export type HookReportEvent =
  | { type: "MEDIA_REPORT"; payload: FrameMediaPayload }
  | { type: "VU_TICK"; vuLevel: number; vuPeak: number };

/** ISOLATED 콘텐츠 브리지 -> 백그라운드 메시지 */
export type BridgeToBgMessage =
  | { source: "content-bridge"; type: "FRAME_REPORT"; payload: FrameMediaPayload }
  | { source: "content-bridge"; type: "FRAME_VU"; vuLevel: number; vuPeak: number }
  | { source: "content-bridge"; type: "FRAME_UNLOAD" };

/** 백그라운드 -> ISOLATED 콘텐츠 브리지 메시지 */
export type BgToBridgeMessage = {
  target: "content-bridge";
  command: HookCommand;
};

/** 팝업 -> 백그라운드 제어 액션 메시지 */
export type PopupActionMessage =
  | { source: "popup"; type: "GET_SNAPSHOT" }
  | { source: "popup"; type: "SET_TAB_DB"; tabId: number; db: number }
  | { source: "popup"; type: "TOGGLE_TAB_MUTE"; tabId: number }
  | { source: "popup"; type: "TOGGLE_TAB_MODE"; tabId: number; mode: ExclusiveMode; shiftKey: boolean }
  | { source: "popup"; type: "CLEAR_MODES" }
  | { source: "popup"; type: "TOGGLE_TAB_PLAY"; tabId: number }
  | { source: "popup"; type: "TOGGLE_DOMAIN_PIN"; tabId: number }
  | { source: "popup"; type: "JUMP_TO_TAB"; tabId: number; windowId: number }
  | { source: "popup"; type: "SET_ALPHA"; alpha: number }
  | { source: "popup"; type: "SET_MASTER_DB"; masterDb: number }
  | { source: "popup"; type: "TOGGLE_MASTER_MUTE" }
  | { source: "popup"; type: "SET_ALL_PLAYING"; shouldPlay: boolean }
  | { source: "popup"; type: "SET_THEME"; theme: ThemeKey; modePref: ModePref };

/** 백그라운드 -> 팝업 포트 실시간 푸시 메시지 */
export type BgToPopupPortMessage =
  | { type: "SNAPSHOT"; snapshot: ConsoleSnapshot }
  | { type: "VU_BATCH"; levels: Array<{ tabId: number; vuLevel: number; vuPeak: number }> };
