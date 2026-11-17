/**
 * Sound Manager 확장 내부(콘텐츠 훅 · 브리지 · 백그라운드 · 팝업) 간 공유 타입과 프로토콜 정의.
 */

export type ThemeKey = "teal" | "amber" | "cobalt" | "emerald";
export type ModePref = "dark" | "light" | "system";
export type ExclusiveMode = "solo" | "focus";
/** 1.1.0 이하 저장 세션 변환에만 쓰는 옛 노멀라이저 모드 */
export type LegacyChannelNormMode = "follow" | "on" | "off";
/** 기본 제공 노멀라이저 프리셋 키 */
export type AutoNormPreset = "classical" | "music" | "standard" | "night";
/** 고급 FX에서 "모든 채널" 값을 따르거나 채널별로 따로 둘 수 있는 모듈 */
export type FxModuleKey = "norm" | "gate" | "comp";
/** 고급 FX 편집 대상: 모든 채널(전역) 또는 특정 탭 채널 */
export type FxTarget = "global" | number;
export type NormSpeedPreset = "slow" | "std" | "fast";
export type NormVizMode = "spectrum2d" | "bar1d";
export type CompRatioPreset = 2 | 4 | 8;
export type EffectiveNormSource = "off" | "auto" | "custom-on" | "custom-off";

/** color-preset.md에 바인딩된 단일 화면 모드(다크 또는 라이트) 토큰 묶음 */
export interface ThemeTokens {
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  /** Focus 상태 전용색 (테마 주색과 같은 밝기·채도, 다른 색상) */
  focus: string;
  onFocus: string;
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

/** 노멀라이저 프리셋 한 벌이 담는 신호 처리 값 */
export interface NormParams {
  /** 목표 기준 음압 (-20 .. -12 LUFS) */
  targetLufs: number;
  /** EBU 3341 계측 창·응답 속도 ("slow": 9s | "std": 3s | "fast": 0.4s) */
  speed: NormSpeedPreset;
  /** 대표 음압 채택 구간 하한 LUFS — 이보다 작은 여린 소리는 적분에서 제외 */
  rangeLowLufs: number;
  /** 대표 음압 채택 구간 상한 LUFS — 이보다 큰 강주 폭발음은 적분에서 제외 */
  rangeHighLufs: number;
  /** 적분 생략 시 보정 게인이 0.0dB로 복귀하는 텐션 속도 (0.05 .. 1.50 dB/s) */
  zeroReturnRate: number;
  /** 구간을 스치는 급변을 거르는 최소 연속 체류 블록 수 */
  minDwellBlocks: number;
  /** 최대 증폭 한계 (dB) */
  maxBoostDb: number;
}

/** 노멀라이저 설정 자리(모든 채널 또는 한 채널) */
export interface NormSlot extends NormParams {
  enabled: boolean;
  /** 기본 프리셋 키, 내 프리셋 id("u…"), 또는 ""(사용자 지정) */
  presetId: string;
  /** 고른 프리셋에서 세부 값을 바꿨는지 (고를 때 복사하므로 비교가 아니라 저장값) */
  modified: boolean;
}

export interface GateSlot {
  enabled: boolean;
  /** 노이즈 게이트 차단 임계값 (-65 .. -30 dB) */
  thresholdDb: number;
}

export interface CompSlot {
  enabled: boolean;
  /** 컴프레서 압축 비율 프리셋 (2:1 | 4:1 | 8:1) */
  ratio: CompRatioPreset;
}

/** 노멀라이저·게이트·컴프레서 한 벌 */
export interface FxLayer {
  norm: NormSlot;
  gate: GateSlot;
  comp: CompSlot;
}

/**
 * 채널별 고급 FX 설정 상태.
 * `own`에 모듈이 없으면 그 모듈은 "모든 채널" 값(`settings.globalFx`)을 따른다.
 * 패닝은 따름/따로 대신, 채널 값에 전체 밸런스(`settings.globalPan`)를 더한다.
 */
export interface ChannelFxState {
  own: Partial<FxLayer>;
  /** 이 채널의 패닝 (-100 좌측 끝 .. 0 중앙 .. +100 우측 끝) */
  pan: number;
}

/** 사용자가 저장한 노멀라이저 프리셋 */
export interface UserNormPreset extends NormParams {
  id: string;
  name: string;
}

/** 고급 FX 편집 한 건 (팝업의 즉시 반영과 백그라운드의 실제 반영이 같은 함수로 적용) */
export type FxEdit =
  | { kind: "detach"; module: FxModuleKey }
  | { kind: "relink"; module: FxModuleKey }
  | { kind: "norm"; patch: Partial<NormParams> & { enabled?: boolean } }
  | { kind: "gate"; patch: Partial<GateSlot> }
  | { kind: "comp"; patch: Partial<CompSlot> }
  | { kind: "pan"; value: number }
  | { kind: "pickPreset"; presetId: string };

export interface ResolvedNormalizerConfig {
  active: boolean;
  targetLufs: number;
  speed: NormSpeedPreset;
  source: EffectiveNormSource;
}

export interface ResolvedNormalizerBounds {
  rangeLowLufs: number;
  rangeHighLufs: number;
  zeroReturnRate: number;
  minDwellBlocks: number;
  maxBoostDb: number;
}

/** 백그라운드가 MAIN 월드 오디오 DSP 체인에 전달하는 실효 신호 처리 파라미터 */
export interface DspConfigPayload {
  normActive: boolean;
  normTargetLufs: number;
  normSpeed: NormSpeedPreset;
  normRangeLowLufs?: number;
  normRangeHighLufs?: number;
  normZeroReturnRate?: number;
  normMinDwellBlocks?: number;
  normMaxBoostDb?: number;
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
  /** "모든 채널" 고급 FX 값 — 따르는 채널에 걸린다. `globalFx.norm.enabled`가 상단 `균일 N` 스위치 */
  globalFx: FxLayer;
  /** 전체 밸런스 — 모든 채널 패닝에 더해진다 (-100 .. +100) */
  globalPan: number;
  /** 사용자가 저장한 노멀라이저 프리셋 목록 */
  userPresets: UserNormPreset[];
  /** 고급 FX 노멀라이저 시각화 뷰 모드 ("spectrum2d" 2D 프리퀀시 상·하 구간 | "bar1d" 1D 수평 구간) */
  normVizMode?: NormVizMode;
  /** 최초 실행 온보딩(빠른 투어 안내) 확인/생략 완료 여부 */
  onboardingDone: boolean;
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
  vuLevelL?: number;
  vuLevelR?: number;
  inputLufs?: number;
  spectrumBins?: number[];
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
  inputLufs?: number;
  spectrumBins?: number[];
  vuLevel: number;
  vuPeak: number;
  vuLevelL?: number;
  vuLevelR?: number;
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
  | { type: "APPLY_GAIN"; targetGain: number; rampSec?: number }
  | { type: "APPLY_DSP"; dsp: DspConfigPayload }
  | { type: "SET_PLAYING"; shouldPlay: boolean }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_METERING"; active: boolean }
  | { type: "REQUEST_REPORT" };

/** MAIN 월드 오디오 훅이 브리지로 내보내는 이벤트 */
export type HookReportEvent =
  | { type: "MEDIA_REPORT"; payload: FrameMediaPayload }
  | {
      type: "VU_TICK";
      vuLevel: number;
      vuPeak: number;
      vuLevelL?: number;
      vuLevelR?: number;
      inputLufs?: number;
      spectrumBins?: number[];
      normTrimDb: number;
    };

/** ISOLATED 콘텐츠 브리지 -> 백그라운드 메시지 */
export type BridgeToBgMessage =
  | { source: "content-bridge"; type: "FRAME_REPORT"; payload: FrameMediaPayload }
  | {
      source: "content-bridge";
      type: "FRAME_VU";
      vuLevel: number;
      vuPeak: number;
      vuLevelL?: number;
      vuLevelR?: number;
      inputLufs?: number;
      spectrumBins?: number[];
      normTrimDb: number;
    }
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
  | { source: "popup"; type: "TOGGLE_TAB_PLAY"; tabId: number; shouldPlay?: boolean }
  | { source: "popup"; type: "TOGGLE_DOMAIN_PIN"; tabId: number }
  | { source: "popup"; type: "JUMP_TO_TAB"; tabId: number; windowId: number }
  | { source: "popup"; type: "SET_ALPHA"; alpha: number }
  | { source: "popup"; type: "SET_MASTER_DB"; masterDb: number }
  | { source: "popup"; type: "TOGGLE_MASTER_MUTE" }
  | { source: "popup"; type: "TOGGLE_AUTO_NORM" }
  | { source: "popup"; type: "SET_AUTO_NORM_PRESET"; preset: string; enable?: boolean }
  | { source: "popup"; type: "EDIT_FX"; target: FxTarget; edit: FxEdit }
  | { source: "popup"; type: "SAVE_USER_PRESET"; target: FxTarget; id: string; name: string }
  | { source: "popup"; type: "OVERWRITE_USER_PRESET"; target: FxTarget }
  | { source: "popup"; type: "RENAME_USER_PRESET"; id: string; name: string }
  | { source: "popup"; type: "DELETE_USER_PRESET"; id: string }
  | { source: "popup"; type: "SET_NORM_VIZ_MODE"; mode: NormVizMode }
  | { source: "popup"; type: "COMPLETE_ONBOARDING" }
  | { source: "popup"; type: "SET_ADV_RACK_OPEN"; open: boolean }
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
      levels: Array<{
        tabId: number;
        vuLevel: number;
        vuPeak: number;
        vuLevelL?: number;
        vuLevelR?: number;
        inputLufs?: number;
        spectrumBins?: number[];
        normTrimDb: number;
      }>;
    };
