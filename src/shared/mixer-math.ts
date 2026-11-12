import type { ExclusiveMode } from "./types";

/**
 * dB 로그 볼륨 변환, Focus 일반화 원-핫 감쇠, Solo/Focus 상호 배타 전환 연산.
 */

export const MIN_DB = -60;
export const MAX_DB = 12;
export const MAX_FOCUS_DIM_DB = 40;
export const LED_COUNT = 18;
export const SCALE_TICKS: readonly number[] = [12, 6, 0, -12, -24, -48];

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

/** Focus 스무딩 계수 α를 0.05 단위로 정규화한다 (0 <= α <= 1). */
export function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 0.7;
  const clamped = Math.max(0, Math.min(1, alpha));
  return Math.round(clamped * 20) / 20;
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

/** 화면 표시용 dB 문자열 포맷 ("+4.5", "0.0", "-6.0", "-∞") */
export function formatDb(db: number): string {
  if (!Number.isFinite(db) || db <= MIN_DB) return "-∞";
  const fixed = db.toFixed(1);
  return db > 0 ? `+${fixed}` : fixed === "-0.0" ? "0.0" : fixed;
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
