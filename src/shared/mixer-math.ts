import type {
  AutoNormPreset,
  ChannelFxState,
  ChannelNormMode,
  CompRatioPreset,
  DspConfigPayload,
  ExclusiveMode,
  NormSpeedPreset,
  ResolvedNormalizerConfig,
} from "./types";

/**
 * dB 로그 볼륨 변환, Focus 일반화 원-핫 감쇠, 비파괴 2계층 노멀라이저 해석, 선형 진폭 RSS 마스터 미터 연산.
 */

export const MIN_DB = -60;
export const MAX_DB = 12;
export const MAX_FOCUS_DIM_DB = 40;
export const LED_COUNT = 20;
export const SCALE_TICKS: readonly number[] = [12, 6, 0, -12, -24, -48];

export const DEFAULT_CHANNEL_FX: Readonly<ChannelFxState> = {
  normMode: "follow",
  normTargetLufs: -16,
  normSpeed: "std",
  pan: 0,
  gateEnabled: false,
  gateThresholdDb: -48,
  compEnabled: false,
  compRatio: 4,
};

export const AUTO_NORM_PRESET_META: Record<
  AutoNormPreset,
  {
    label: string;
    shortLabel: string;
    badge: string;
    targetLufs: number;
    speed: NormSpeedPreset;
    summary: string;
  }
> = {
  music: {
    label: "음악 (강약 보존)",
    shortLabel: "음악",
    badge: "-16 LUFS · 완만(9s)",
    targetLufs: -16,
    speed: "slow",
    summary: "BS.1770 게이팅 9초 장기 계측으로 곡 안의 후렴·프리즈 대비는 살리고 곡 간 평균 음압만 맞춥니다.",
  },
  standard: {
    label: "표준 (영상·방송)",
    shortLabel: "표준",
    badge: "-16 LUFS · 표준(3s)",
    targetLufs: -16,
    speed: "std",
    summary: "EBU 3341 3초 단기(Short-Term) 계측으로 유튜브·스트리밍·강의 탭 간 음압 편차를 정렬합니다.",
  },
  night: {
    label: "야간 (강한 균일)",
    shortLabel: "야간",
    badge: "-18 LUFS · 민감(0.4s)",
    targetLufs: -18,
    speed: "fast",
    summary: "EBU 3341 0.4초 순간(Momentary) 계측으로 갑작스러운 큰 소리는 빠르게 누르고 대사를 유지합니다.",
  },
};

export interface GainChannelInput {
  tabId: number;
  db: number;
  muted: boolean;
  solo: boolean;
  focus: boolean;
  playing: boolean;
  corsCap: boolean;
}

export interface MixerContextInput {
  alpha: number;
  masterDb: number;
  masterMuted: boolean;
  anySolo: boolean;
  anyFocus: boolean;
}

/** dB 값을 0.1dB 단위로 반올림하고 허용 범위(-60dB .. +12dB 또는 보안 0dB 상한)로 제한한다. */
export function clampDb(db: number, corsCap = false): number {
  if (!Number.isFinite(db) || db <= MIN_DB) return MIN_DB;
  const upper = corsCap ? 0 : MAX_DB;
  const rounded = Math.round(db * 10) / 10;
  return Math.max(MIN_DB, Math.min(upper, rounded));
}

/**
 * 사용자가 직접 입력한 dB 문자열을 파싱한다.
 * 빈 문자열이나 잘못된 입력은 볼륨이 의도치 않게 바뀌지 않도록 null을 반환한다.
 */
export function parseDbInput(raw: string, corsCap = false): number | null {
  const normalized = raw
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\s*d[bB]$/i, "")
    .trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower === "-inf" || lower === "-infinity" || lower === "-∞" || lower === "∞") {
    return MIN_DB;
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return clampDb(parsed, corsCap);
}

/**
 * Focus 스무딩 계수 α를 0.0025 단위로 정규화한다 (0 <= α <= 1, 감쇠량 0.1dB 해상도와 1:1 대응).
 */
export function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 0.7;
  const clamped = Math.max(0, Math.min(1, alpha));
  return Math.round(clamped * 400) / 400;
}

/** 슬라이더 드래그·마우스 휠 조작 시 0.05(2dB) 단위로 정돈한다. */
export function clampAlphaStep(alpha: number): number {
  if (!Number.isFinite(alpha)) return 0.7;
  const clamped = Math.max(0, Math.min(1, alpha));
  return Math.round(clamped * 20) / 20;
}

/** Focus 목표 감쇠량(dB, -40..0)을 α 계수(0..1)로 역변환한다 (-40dB 이하는 Solo 0으로 스냅). */
export function focusDimDbToAlpha(dimDb: number): number {
  if (!Number.isFinite(dimDb) || dimDb <= -MAX_FOCUS_DIM_DB) return 0;
  if (dimDb >= 0) return 1;
  return clampAlpha(1 + dimDb / MAX_FOCUS_DIM_DB);
}

/**
 * 상단 Focus α 수치창 직접 입력 문자열을 α(0..1)로 파싱한다.
 * - 음수 또는 dB 접미사 입력(예: "-12", "-15.5", "-18dB", "0", "-40", "-inf"): 감쇠 dB로 해석
 * - 부호·단위 없는 0 초과 1 이하 소수 입력(예: "0.7", "0.65", "1.0"): α 비율로 해석
 */
export function parseFocusInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\u2212/g, "-");
  if (!trimmed) return null;

  const hasDbSuffix = /\s*d[bB]$/i.test(trimmed);
  const hasAlphaPrefix = /^[\u03b1aA]\s*[:=]?\s*/.test(trimmed);
  const body = trimmed
    .replace(/\s*d[bB]$/i, "")
    .replace(/^[\u03b1aA]\s*[:=]?\s*/, "")
    .trim();
  if (!body) return null;

  const lower = body.toLowerCase();
  if (lower === "-inf" || lower === "-infinity" || lower === "-∞" || lower === "∞") {
    return 0;
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(body)) {
    return null;
  }
  const parsed = Number(body);
  if (!Number.isFinite(parsed)) return null;

  if (hasAlphaPrefix) {
    return clampAlpha(parsed);
  }
  if (!hasDbSuffix && !body.startsWith("-") && !body.startsWith("+") && parsed > 0 && parsed <= 1 && body.includes(".")) {
    return clampAlpha(parsed);
  }
  return focusDimDbToAlpha(parsed);
}

/** dB 값을 선형 배율(Linear Gain)로 변환한다 (-60dB 이하는 완전 무음 0으로 스냅). */
export function dbToLinear(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_DB) return 0;
  return Math.pow(10, db / 20);
}

/** 선형 배율을 dB로 역변환한다. */
export function linearToDb(gain: number): number {
  if (!Number.isFinite(gain) || gain <= 0) return -Infinity;
  const db = 20 * Math.log10(gain);
  return db <= MIN_DB ? -Infinity : db;
}

/** 페이더 트랙 위치 비율 [0, 1] <-> dB [-60, +12] 변환 */
export function dbToRatio(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_DB) return 0;
  if (db >= MAX_DB) return 1;
  return (db - MIN_DB) / (MAX_DB - MIN_DB);
}

export function ratioToDb(ratio: number, corsCap = false): number {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const rawDb = MIN_DB + r * (MAX_DB - MIN_DB);
  const halfStep = Math.round(rawDb * 2) / 2;
  return clampDb(halfStep, corsCap);
}

/** 로그 VU 위치 비율 [0, 1]을 원래 선형 파형 진폭으로 역변환한다. */
export function ratioToLinearAmplitude(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const clamped = Math.min(1, ratio);
  const db = MIN_DB + clamped * (MAX_DB - MIN_DB);
  return db <= MIN_DB ? 0 : Math.pow(10, db / 20);
}

/**
 * 개별 채널의 로그 VU 비율을 선형 진폭으로 복원한 뒤, 스테레오 패닝 배율과
 * 비상관 신호 제곱합 제곱근(RSS, sqrt(sum A_i^2))으로 MASTER BUS 좌/우 VU 비율을 계산한다.
 * 로그 비율 단순 합산으로 인해 0dB 이하 채널들이 레드존(+7.5dB 이상)으로 포화되던 문제를 방지한다.
 */
export function computeMasterStereoVu(
  channels: ReadonlyArray<{
    playing: boolean;
    muted: boolean;
    corsCap: boolean;
    vuLevel: number;
    fx?: { pan: number };
  }>,
  masterMuted: boolean,
): { left: number; right: number } {
  if (masterMuted) return { left: 0, right: 0 };

  let sumSqL = 0;
  let sumSqR = 0;
  for (const ch of channels) {
    if (!ch.playing || ch.muted || ch.vuLevel <= 0) continue;
    const amp = ratioToLinearAmplitude(ch.vuLevel);
    if (amp <= 0) continue;
    const pan = ch.corsCap ? 0 : Math.max(-100, Math.min(100, ch.fx?.pan ?? 0));
    const gainL = pan <= 0 ? 1 : Math.cos((pan / 100) * (Math.PI / 2));
    const gainR = pan >= 0 ? 1 : Math.cos((-pan / 100) * (Math.PI / 2));
    sumSqL += amp * gainL * (amp * gainL);
    sumSqR += amp * gainR * (amp * gainR);
  }

  const mixL = Math.sqrt(sumSqL);
  const mixR = Math.sqrt(sumSqR);
  return {
    left: mixL <= 0 ? 0 : dbToRatio(Math.min(MAX_DB, linearToDb(mixL))),
    right: mixR <= 0 ? 0 : dbToRatio(Math.min(MAX_DB, linearToDb(mixR))),
  };
}

/**
 * Focus 모드 비선택 채널의 로그 감쇠량 G_dim(α) = -40 * (1 - α) dB.
 * α = 0 이면 순수 Solo(-∞ dB), α = 0.70 이면 -12.0 dB, α = 1.0 이면 0.0 dB.
 */
export function getFocusDimDb(alpha: number): number {
  if (alpha <= 0) return -Infinity;
  if (alpha >= 1) return 0;
  const dim = -Math.round(MAX_FOCUS_DIM_DB * (1 - alpha) * 10) / 10;
  return dim === 0 ? 0 : dim;
}

/** 상단 Focus α 표시창 문자열("0.70 · -12dB", "0.61 · -15.5dB", "0.00 · -∞")을 생성한다. */
export function formatFocusReadout(alpha: number): string {
  const dim = getFocusDimDb(alpha);
  const dimStr = !Number.isFinite(dim)
    ? "-∞"
    : dim === 0
      ? "0dB"
      : Number.isInteger(dim)
        ? `${dim.toFixed(0)}dB`
        : `${dim.toFixed(1)}dB`;
  return `${alpha.toFixed(2)} · ${dimStr}`;
}

/** 화면 표시용 dB 문자열 포맷 ("+4.5", "0.0", "-6.0", "-∞") */
export function formatDb(db: number): string {
  if (!Number.isFinite(db) || db <= MIN_DB) return "-∞";
  const fixed = db.toFixed(1);
  return db > 0 ? `+${fixed}` : fixed === "-0.0" ? "0.0" : fixed;
}

/** 스테레오 패닝 표시 문자열 ("C", "L25", "R30") */
export function formatPan(pan: number): string {
  const rounded = Math.round(pan);
  if (rounded === 0) return "C";
  return rounded < 0 ? `L${Math.abs(rounded)}` : `R${rounded}`;
}

/** 채널 FX 부분 패치를 안전하게 검증·병합하여 새 ChannelFxState 객체를 반환한다. */
export function sanitizeChannelFx(
  base?: Partial<ChannelFxState> | null,
  patch?: Partial<ChannelFxState> | null,
): ChannelFxState {
  const merged = { ...DEFAULT_CHANNEL_FX, ...(base ?? {}), ...(patch ?? {}) };
  const validModes: ChannelNormMode[] = ["follow", "on", "off"];
  const validSpeeds: NormSpeedPreset[] = ["slow", "std", "fast"];
  const validRatios: CompRatioPreset[] = [2, 4, 8];

  const normMode = validModes.includes(merged.normMode) ? merged.normMode : "follow";
  const normTargetLufs = Number.isFinite(merged.normTargetLufs)
    ? Math.max(-20, Math.min(-12, Math.round(merged.normTargetLufs)))
    : -16;
  const rawSpeed = merged.normSpeed as string;
  const normSpeed: NormSpeedPreset =
    rawSpeed === "music"
      ? "slow"
      : validSpeeds.includes(rawSpeed as NormSpeedPreset)
        ? (rawSpeed as NormSpeedPreset)
        : "std";
  const pan = Number.isFinite(merged.pan)
    ? Math.max(-100, Math.min(100, Math.round(merged.pan)))
    : 0;
  const gateEnabled = Boolean(merged.gateEnabled);
  const gateThresholdDb = Number.isFinite(merged.gateThresholdDb)
    ? Math.max(-65, Math.min(-30, Math.round(merged.gateThresholdDb)))
    : -48;
  const compEnabled = Boolean(merged.compEnabled);
  const compRatio = validRatios.includes(merged.compRatio) ? merged.compRatio : 4;

  return {
    normMode,
    normTargetLufs,
    normSpeed,
    pan,
    gateEnabled,
    gateThresholdDb,
    compEnabled,
    compRatio,
  };
}

/**
 * 전역 `autoNormEnabled`(`균일 N`) 스위치와 채널별 고급 `ChannelFxState`를 비파괴로 합성한다.
 * - `normMode === "on"`: 전역 스위치와 무관하게 사용자의 개별 목표 음압·속도로 동작
 * - `normMode === "off"`: 전역 스위치가 켜져도 우회하며 사용자의 세부 수치는 그대로 보존
 * - `normMode === "follow"`: 전역 스위치를 따르며 전역 프리셋(음악 / 표준 / 야간)을 사용
 */
export function resolveEffectiveNormalizer(
  autoNormEnabled: boolean,
  fx: ChannelFxState,
  corsCap: boolean,
  autoNormPreset: AutoNormPreset = "standard",
): ResolvedNormalizerConfig {
  if (corsCap) {
    return { active: false, targetLufs: -16, speed: "std", source: "off" };
  }
  if (fx.normMode === "on") {
    return {
      active: true,
      targetLufs: fx.normTargetLufs,
      speed: fx.normSpeed,
      source: "custom-on",
    };
  }
  if (fx.normMode === "off") {
    return {
      active: false,
      targetLufs: fx.normTargetLufs,
      speed: fx.normSpeed,
      source: "custom-off",
    };
  }
  const meta = AUTO_NORM_PRESET_META[autoNormPreset] ?? AUTO_NORM_PRESET_META.standard;
  return {
    active: autoNormEnabled,
    targetLufs: meta.targetLufs,
    speed: meta.speed,
    source: autoNormEnabled ? "auto" : "off",
  };
}

/** 오디오 훅(`dsp-chain.ts`)에 전달할 채널별 DSP 설정 페이로드를 생성한다. */
export function buildDspConfigPayload(
  autoNormEnabled: boolean,
  fx: ChannelFxState,
  corsCap: boolean,
  autoNormPreset: AutoNormPreset = "standard",
): DspConfigPayload {
  const norm = resolveEffectiveNormalizer(autoNormEnabled, fx, corsCap, autoNormPreset);
  if (corsCap) {
    return {
      normActive: false,
      normTargetLufs: -16,
      normSpeed: "std",
      pan: 0,
      gateEnabled: false,
      gateThresholdDb: -48,
      compEnabled: false,
      compRatio: 4,
    };
  }
  return {
    normActive: norm.active,
    normTargetLufs: norm.targetLufs,
    normSpeed: norm.speed,
    pan: fx.pan,
    gateEnabled: fx.gateEnabled,
    gateThresholdDb: fx.gateThresholdDb,
    compEnabled: fx.compEnabled,
    compRatio: fx.compRatio,
  };
}

/**
 * 오디오 그래프에 실제로 주입할 채널의 목표 dB를 계산한다.
 * 일시정지 중인 탭이라도 재생 재개 순간 팝 노이즈(폭음)가 나지 않도록 게인 값을 미리 유지한다.
 */
export function computeAppliedChannelDb(ch: GainChannelInput, ctx: MixerContextInput): number {
  if (ch.muted || ctx.masterMuted || ch.db <= MIN_DB || ctx.masterDb <= MIN_DB) {
    return -Infinity;
  }
  const cappedChannelDb = ch.corsCap ? Math.min(0, ch.db) : ch.db;
  let totalDb = cappedChannelDb + ctx.masterDb;

  if (ctx.anySolo) {
    if (!ch.solo) return -Infinity;
  } else if (ctx.anyFocus && !ch.focus) {
    const dim = getFocusDimDb(ctx.alpha);
    if (!Number.isFinite(dim)) return -Infinity;
    totalDb += dim;
  }

  if (ch.corsCap) {
    totalDb = Math.min(0, totalDb);
  }
  return totalDb <= MIN_DB ? -Infinity : totalDb;
}

/** 오디오 훅에 전달할 최종 선형 게인 g_eff = g_master * g_i * w_i(α) * (1 - muted_i) */
export function computeAppliedLinearGain(ch: GainChannelInput, ctx: MixerContextInput): number {
  return dbToLinear(computeAppliedChannelDb(ch, ctx));
}

/** 팝업 UI에 표시할 실효 출력 dB (재생 중이 아니면 -∞ 표시) */
export function computeDisplayedEffectiveDb(ch: GainChannelInput, ctx: MixerContextInput): number {
  if (!ch.playing) return -Infinity;
  return computeAppliedChannelDb(ch, ctx);
}

/**
 * Solo(S)와 Focus(F)의 상호 배타 토글 규칙을 적용한다.
 * - S를 켜면 모든 F가 해제되고, F를 켜면 모든 S가 해제된다.
 * - 일반 클릭: 단독 선택으로 전환하되, 이미 유일한 선택 채널이었다면 해제한다.
 * - Shift+클릭: 반대 모드는 모두 해제하면서 현재 모드의 다중 선택 집합에 토글한다.
 */
export function toggleExclusiveFlags<T extends { tabId: number; solo: boolean; focus: boolean }>(
  items: T[],
  targetTabId: number,
  mode: ExclusiveMode,
  shiftKey: boolean,
): void {
  const otherMode: ExclusiveMode = mode === "solo" ? "focus" : "solo";
  for (const item of items) {
    item[otherMode] = false;
  }
  const target = items.find((item) => item.tabId === targetTabId);
  if (!target) return;

  if (shiftKey) {
    target[mode] = !target[mode];
    return;
  }

  const activeCount = items.filter((item) => item[mode]).length;
  const wasSoleActive = target[mode] && activeCount === 1;
  for (const item of items) {
    item[mode] = false;
  }
  target[mode] = !wasSoleActive;
}

/** 탭의 현재 dB가 저장된 도메인 기본값과 일치해 핀이 켜진 상태인지 판별한다. */
export function isChannelPinned(domainDefaults: Record<string, number>, domain: string, db: number): boolean {
  if (!domain || !Object.prototype.hasOwnProperty.call(domainDefaults, domain)) return false;
  const saved = domainDefaults[domain];
  return typeof saved === "number" && Math.abs(saved - db) < 0.01;
}

/** URL 문자열에서 도메인 식별자와 콘솔 상단용 짧은 호스트 라벨을 추출한다. */
export function extractDomainInfo(rawUrl?: string): { domain: string; shortHost: string } {
  if (!rawUrl) return { domain: "", shortHost: "tab" };
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") {
      return { domain: "local.file", shortHost: "file" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { domain: "", shortHost: parsed.protocol.replace(":", "") || "tab" };
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    const firstLabel = parts[0] ?? host;
    return { domain: host, shortHost: firstLabel };
  } catch {
    return { domain: "", shortHost: "tab" };
  }
}
