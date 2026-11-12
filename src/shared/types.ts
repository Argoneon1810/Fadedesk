/**
 * Sound Manager 확장 내부(콘텐츠 훅 · 브리지 · 백그라운드 · 팝업) 간 공유 타입과 프로토콜 정의.
 */

export type ThemeKey = "teal" | "amber" | "cobalt" | "emerald";
export type ModePref = "dark" | "light" | "system";
export type ExclusiveMode = "solo" | "focus";
export type ChannelNormMode = "follow" | "on" | "off";
export type NormSpeedPreset = "slow" | "std" | "fast";
export type CompRatioPreset = 2 | 4 | 8;
export type EffectiveNormSource = "off" | "auto" | "custom-on" | "custom-off";

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

/**
 * 채널별 고급 FX 설정 상태.
 * 전역 `autoNormEnabled`(`균일 N`) 스위치와 물리적으로 분리되어, 전역 스위치를 토글해도 값이 지워지지 않는다.
 */
export interface ChannelFxState {
  /** 노멀라이저 작동 방식: 전역 스위치 추종("follow") | 개별 강제 켜짐("on") | 개별 강제 꺼짐("off") */
  normMode: ChannelNormMode;
  /** 개별 모드("on")에서 사용할 목표 기준 음압 (-20 .. -12 LUFS, 기본 -16) */
  normTargetLufs: number;
  /** 개별 모드("on")에서 사용할 추종 반응 속도 ("slow" | "std" | "fast") */
  normSpeed: NormSpeedPreset;
  /** 스테레오 패닝 (-100 좌측 끝 .. 0 중앙 .. +100 우측 끝) */
  pan: number;
  /** 바닥 잡음 차단 노이즈 게이트 활성 여부 */
  gateEnabled: boolean;
  /** 노이즈 게이트 차단 임계값 (-65 .. -30 dB, 기본 -48) */
  gateThresholdDb: number;
  /** 채널 다이내믹 컴프레서 활성 여부 */
  compEnabled: boolean;
  /** 컴프레서 압축 비율 프리셋 (2:1 | 4:1 | 8:1) */
  compRatio: CompRatioPreset;
}

export interface ResolvedNormalizerConfig {
  active: boolean;
  targetLufs: number;
  speed: NormSpeedPreset;
  source: EffectiveNormSource;
}

/** 백그라운드가 MAIN 월드 오디오 DSP 체인에 전달하는 실효 신호 처리 파라미터 */
export interface DspConfigPayload {
  normActive: boolean;
  normTargetLufs: number;
  normSpeed: NormSpeedPreset;
  pan: number;
  gateEnabled: boolean;
  gateThresholdDb: number;
  compEnabled: boolean;
  compRatio: CompRatioPreset;
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
  /** 전역 Easy 다이나믹 노멀라이저(`균일 N`) 스위치 — `normMode === "follow"` 채널에만 적용 */
  autoNormEnabled: boolean;
  /** 우측 고급 FX 사이드 랙 열림 여부 */
  advRackOpen: boolean;
  /** 분리된 독립 콘솔 창(Popout)의 마지막 가로 폭 (px, 기본 780) */
  popoutWidth: number;
  /** 분리된 독립 콘솔 창(Popout)의 마지막 세로 높이 (px, 기본 480) */
  popoutHeight: number;
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
  normTrimDb: number;
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
  fx: ChannelFxState;
  normTrimDb: number;
  vuLevel: number;
  vuPeak: number;
  firstSeenAt: number;
  sortOrder: number;
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
  | { type: "APPLY_DSP"; dsp: DspConfigPayload }
  | { type: "SET_PLAYING"; shouldPlay: boolean }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_METERING"; active: boolean }
  | { type: "REQUEST_REPORT" };

/** MAIN 월드 오디오 훅이 브리지로 내보내는 이벤트 */
export type HookReportEvent =
  | { type: "MEDIA_REPORT"; payload: FrameMediaPayload }
  | { type: "VU_TICK"; vuLevel: number; vuPeak: number; normTrimDb: number };

/** ISOLATED 콘텐츠 브리지 -> 백그라운드 메시지 */
export type BridgeToBgMessage =
  | { source: "content-bridge"; type: "FRAME_REPORT"; payload: FrameMediaPayload }
  | { source: "content-bridge"; type: "FRAME_VU"; vuLevel: number; vuPeak: number; normTrimDb: number }
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
  | { source: "popup"; type: "TOGGLE_AUTO_NORM" }
  | { source: "popup"; type: "SET_ADV_RACK_OPEN"; open: boolean }
  | { source: "popup"; type: "UPDATE_TAB_FX"; tabId: number; patch: Partial<ChannelFxState> }
  | {
      source: "popup";
      type: "REORDER_CHANNELS";
      movedTabId: number;
      targetZone: "playing" | "paused";
      orderedPlayingIds: number[];
      orderedPausedIds: number[];
    }
  | { source: "popup"; type: "SET_ALL_PLAYING"; shouldPlay: boolean }
  | { source: "popup"; type: "SET_THEME"; theme: ThemeKey; modePref: ModePref }
  | { source: "popup"; type: "OPEN_STANDALONE_WINDOW" }
  | { source: "popup"; type: "SAVE_POPOUT_BOUNDS"; width: number; height: number };

/** 백그라운드 -> 팝업 포트 실시간 푸시 메시지 */
export type BgToPopupPortMessage =
  | { type: "SNAPSHOT"; snapshot: ConsoleSnapshot }
  | {
      type: "VU_BATCH";
      levels: Array<{ tabId: number; vuLevel: number; vuPeak: number; normTrimDb: number }>;
    };
