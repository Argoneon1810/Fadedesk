import { AUTO_NORM_PRESET_META } from "./mixer-math";
import type {
  AutoNormPreset,
  ChannelFxState,
  CompRatioPreset,
  CompSlot,
  DspConfigPayload,
  FxEdit,
  FxLayer,
  FxModuleKey,
  GateSlot,
  NormParams,
  NormSlot,
  NormSpeedPreset,
  ResolvedNormalizerConfig,
  UserNormPreset,
} from "./types";

/**
 * 고급 FX 2계층 모델 ("모든 채널" 층 + 채널 층).
 * - 노멀라이저·게이트·컴프레서: 채널 `own`에 모듈이 없으면 "모든 채널" 값을 따른다.
 * - 패닝: 채널 값 + 전체 밸런스.
 * - 팝업의 즉시 반영과 백그라운드의 실제 반영이 같은 편집 함수(`applyFxEdit`)를 쓴다.
 * - 1.1.0 이하의 저장 설정·세션을 새 구조로 변환한다.
 */

export const BUILTIN_PRESET_KEYS: readonly AutoNormPreset[] = ["classical", "music", "standard", "night"];
export const MAX_USER_PRESETS = 20;
export const MAX_PRESET_NAME_LEN = 16;

const VALID_SPEEDS: readonly NormSpeedPreset[] = ["slow", "std", "fast"];
const VALID_RATIOS: readonly CompRatioPreset[] = [2, 4, 8];
const NORM_PARAM_KEYS: ReadonlyArray<keyof NormParams> = [
  "targetLufs", "speed", "rangeLowLufs", "rangeHighLufs", "zeroReturnRate", "minDwellBlocks", "maxBoostDb",
];

export function isBuiltinPreset(id: string): id is AutoNormPreset {
  return (BUILTIN_PRESET_KEYS as readonly string[]).includes(id);
}

export function builtinParams(key: AutoNormPreset): NormParams {
  const m = AUTO_NORM_PRESET_META[key] ?? AUTO_NORM_PRESET_META.music;
  return {
    targetLufs: m.targetLufs,
    speed: m.speed,
    rangeLowLufs: m.rangeLowLufs,
    rangeHighLufs: m.rangeHighLufs,
    zeroReturnRate: m.zeroReturnRate,
    minDwellBlocks: m.minDwellBlocks,
    maxBoostDb: m.maxBoostDb,
  };
}

/** 1.1.0 "개별 ON"이 속도만으로 정하던 체류·증폭 한계 (옛 세션 변환용) */
function dwellBoostForSpeed(speed: NormSpeedPreset): { minDwellBlocks: number; maxBoostDb: number } {
  if (speed === "fast") return { minDwellBlocks: 2, maxBoostDb: 9 };
  if (speed === "std") return { minDwellBlocks: 6, maxBoostDb: 7.5 };
  return { minDwellBlocks: 16, maxBoostDb: 6 };
}

export const DEFAULT_GATE: Readonly<GateSlot> = { enabled: false, thresholdDb: -48 };
export const DEFAULT_COMP: Readonly<CompSlot> = { enabled: false, ratio: 4 };

export function defaultGlobalFx(): FxLayer {
  return {
    norm: { enabled: true, presetId: "music", modified: false, ...builtinParams("music") },
    gate: { ...DEFAULT_GATE },
    comp: { ...DEFAULT_COMP },
  };
}

export function defaultChannelFx(): ChannelFxState {
  return { own: {}, pan: 0 };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function clampPan(v: unknown): number {
  return Math.round(clamp(num(v, 0), -100, 100));
}

export function sanitizeNormParams(raw: unknown, fallback: NormParams): NormParams {
  const r = isObj(raw) ? raw : {};
  const speed = VALID_SPEEDS.includes(r.speed as NormSpeedPreset) ? (r.speed as NormSpeedPreset) : fallback.speed;
  const low = Math.round(clamp(num(r.rangeLowLufs, fallback.rangeLowLufs), -56, -14));
  const high = Math.round(clamp(num(r.rangeHighLufs, fallback.rangeHighLufs), low + 4, -2));
  return {
    targetLufs: Math.round(clamp(num(r.targetLufs, fallback.targetLufs), -20, -12)),
    speed,
    rangeLowLufs: low,
    rangeHighLufs: high,
    zeroReturnRate: Math.round(clamp(num(r.zeroReturnRate, fallback.zeroReturnRate), 0.05, 1.5) * 100) / 100,
    minDwellBlocks: Math.round(clamp(num(r.minDwellBlocks, fallback.minDwellBlocks), 1, 64)),
    maxBoostDb: Math.round(clamp(num(r.maxBoostDb, fallback.maxBoostDb), 0, 12) * 10) / 10,
  };
}

export function sanitizeNormSlot(raw: unknown, fallback: NormSlot): NormSlot {
  const r = isObj(raw) ? raw : {};
  const presetId = typeof r.presetId === "string" ? r.presetId.slice(0, 40) : fallback.presetId;
  return {
    ...sanitizeNormParams(r, fallback),
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
    presetId,
    modified: presetId !== "" && typeof r.modified === "boolean" ? r.modified : false,
  };
}

export function sanitizeGate(raw: unknown, fallback: GateSlot = DEFAULT_GATE): GateSlot {
  const r = isObj(raw) ? raw : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
    thresholdDb: Math.round(clamp(num(r.thresholdDb, fallback.thresholdDb), -65, -30)),
  };
}

export function sanitizeComp(raw: unknown, fallback: CompSlot = DEFAULT_COMP): CompSlot {
  const r = isObj(raw) ? raw : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
    ratio: VALID_RATIOS.includes(r.ratio as CompRatioPreset) ? (r.ratio as CompRatioPreset) : fallback.ratio,
  };
}

export function sanitizeFxLayer(raw: unknown): FxLayer {
  const d = defaultGlobalFx();
  const r = isObj(raw) ? raw : {};
  return {
    norm: sanitizeNormSlot(r.norm, d.norm),
    gate: sanitizeGate(r.gate, d.gate),
    comp: sanitizeComp(r.comp, d.comp),
  };
}

/**
 * 저장 설정의 "모든 채널" 층을 읽는다.
 * 1.1.0 이하(`autoNormEnabled`·`autoNormPreset`)는 노멀라이저 전역 슬롯으로 옮긴다.
 */
export function migrateGlobalFx(raw: unknown): FxLayer {
  const r = isObj(raw) ? raw : {};
  if (isObj(r.globalFx)) return sanitizeFxLayer(r.globalFx);
  const layer = defaultGlobalFx();
  const key = typeof r.autoNormPreset === "string" && isBuiltinPreset(r.autoNormPreset) ? r.autoNormPreset : "music";
  layer.norm = { ...layer.norm, ...builtinParams(key), presetId: key };
  if (typeof r.autoNormEnabled === "boolean") layer.norm.enabled = r.autoNormEnabled;
  return layer;
}

/**
 * 탭 채널의 FX 상태를 검증한다. 새 구조(`own`)와 1.1.0 이하 구조(`normMode` 등)를 모두 받는다.
 * 같은 값을 두 번 거쳐도 결과가 같다(서비스 워커가 다시 뜰 때마다 거치므로).
 */
export function sanitizeChannelFx(raw: unknown): ChannelFxState {
  const r = isObj(raw) ? raw : {};
  const out = defaultChannelFx();
  out.pan = clampPan(r.pan);
  const d = defaultGlobalFx();

  if (isObj(r.own)) {
    if (r.own.norm !== undefined) out.own.norm = sanitizeNormSlot(r.own.norm, d.norm);
    if (r.own.gate !== undefined) out.own.gate = sanitizeGate(r.own.gate);
    if (r.own.comp !== undefined) out.own.comp = sanitizeComp(r.own.comp);
    return out;
  }

  // 1.1.0 이하 구조
  const mode = r.normMode;
  if (mode === "on" || mode === "off") {
    const rawSpeed = r.normSpeed === "music" || r.normSpeed === "classical" ? "slow" : r.normSpeed;
    const speed = VALID_SPEEDS.includes(rawSpeed as NormSpeedPreset) ? (rawSpeed as NormSpeedPreset) : "slow";
    const params = sanitizeNormParams(
      {
        targetLufs: r.normTargetLufs,
        speed,
        rangeLowLufs: r.normRangeLowLufs,
        rangeHighLufs: r.normRangeHighLufs,
        zeroReturnRate: r.normZeroReturnRate,
        ...dwellBoostForSpeed(speed),
      },
      builtinParams("music"),
    );
    out.own.norm = { ...params, enabled: mode === "on", presetId: "", modified: false };
  }
  const gate = sanitizeGate({ enabled: r.gateEnabled, thresholdDb: r.gateThresholdDb });
  if (gate.enabled || gate.thresholdDb !== DEFAULT_GATE.thresholdDb) out.own.gate = gate;
  const comp = sanitizeComp({ enabled: r.compEnabled, ratio: r.compRatio });
  if (comp.enabled || comp.ratio !== DEFAULT_COMP.ratio) out.own.comp = comp;
  return out;
}

export function sanitizePresetName(name: unknown, fallback: string): string {
  const s = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, MAX_PRESET_NAME_LEN) : "";
  return s || fallback;
}

export function sanitizeUserPresets(raw: unknown): UserNormPreset[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: UserNormPreset[] = [];
  for (const item of raw) {
    if (!isObj(item) || typeof item.id !== "string" || !item.id.startsWith("u") || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      id: item.id.slice(0, 40),
      name: sanitizePresetName(item.name, "Preset"),
      ...sanitizeNormParams(item, builtinParams("music")),
    });
    if (out.length >= MAX_USER_PRESETS) break;
  }
  return out;
}

/* ───────── 실효값 해석 ───────── */

export function effectiveModule<K extends FxModuleKey>(globalFx: FxLayer, fx: ChannelFxState, key: K): {
  slot: FxLayer[K];
  own: boolean;
} {
  const own = fx.own[key];
  return own ? { slot: own as FxLayer[K], own: true } : { slot: globalFx[key], own: false };
}

export function effectivePan(globalPan: number, fx: ChannelFxState, corsCap = false): number {
  if (corsCap) return 0;
  return clampPan(fx.pan + globalPan);
}

export function resolveEffectiveNormalizer(
  globalFx: FxLayer,
  fx: ChannelFxState,
  corsCap: boolean,
): ResolvedNormalizerConfig & { slot: NormSlot } {
  const { slot, own } = effectiveModule(globalFx, fx, "norm");
  if (corsCap) return { active: false, targetLufs: slot.targetLufs, speed: slot.speed, source: "off", slot };
  if (own) {
    return {
      active: slot.enabled,
      targetLufs: slot.targetLufs,
      speed: slot.speed,
      source: slot.enabled ? "custom-on" : "custom-off",
      slot,
    };
  }
  return {
    active: slot.enabled,
    targetLufs: slot.targetLufs,
    speed: slot.speed,
    source: slot.enabled ? "auto" : "off",
    slot,
  };
}

/** 오디오 훅(`dsp-chain.ts`)에 전달할 채널별 DSP 설정 페이로드 */
export function buildDspConfigPayload(
  globalFx: FxLayer,
  globalPan: number,
  fx: ChannelFxState,
  corsCap: boolean,
): DspConfigPayload {
  const norm = resolveEffectiveNormalizer(globalFx, fx, corsCap);
  const gate = effectiveModule(globalFx, fx, "gate").slot;
  const comp = effectiveModule(globalFx, fx, "comp").slot;
  const s = norm.slot;
  if (corsCap) {
    const m = builtinParams("music");
    return {
      normActive: false,
      normTargetLufs: m.targetLufs,
      normSpeed: m.speed,
      normRangeLowLufs: m.rangeLowLufs,
      normRangeHighLufs: m.rangeHighLufs,
      normZeroReturnRate: m.zeroReturnRate,
      normMinDwellBlocks: m.minDwellBlocks,
      normMaxBoostDb: m.maxBoostDb,
      pan: 0,
      gateEnabled: false,
      gateThresholdDb: DEFAULT_GATE.thresholdDb,
      compEnabled: false,
      compRatio: DEFAULT_COMP.ratio,
    };
  }
  return {
    normActive: norm.active,
    normTargetLufs: s.targetLufs,
    normSpeed: s.speed,
    normRangeLowLufs: s.rangeLowLufs,
    normRangeHighLufs: s.rangeHighLufs,
    normZeroReturnRate: s.zeroReturnRate,
    normMinDwellBlocks: s.minDwellBlocks,
    normMaxBoostDb: s.maxBoostDb,
    pan: effectivePan(globalPan, fx),
    gateEnabled: gate.enabled,
    gateThresholdDb: gate.thresholdDb,
    compEnabled: comp.enabled,
    compRatio: comp.ratio,
  };
}

/* ───────── 프리셋 ───────── */

export function findPresetParams(id: string, userPresets: readonly UserNormPreset[]): NormParams | null {
  if (isBuiltinPreset(id)) return builtinParams(id);
  const u = userPresets.find((p) => p.id === id);
  if (!u) return null;
  const { id: _id, name: _name, ...params } = u;
  return params;
}

function pickParams(src: NormParams): NormParams {
  const out = {} as Record<keyof NormParams, unknown>;
  for (const k of NORM_PARAM_KEYS) out[k] = src[k];
  return out as unknown as NormParams;
}

/* ───────── 편집 적용 (팝업·백그라운드 공용) ───────── */

/** 편집 대상 층(모든 채널이면 전역 설정, 채널이면 그 채널 FX)을 하나로 다루기 위한 묶음 */
export interface FxEditContext {
  globalFx: FxLayer;
  globalPan: number;
  userPresets: readonly UserNormPreset[];
}

/** 설정 객체(전역 FX·전체 밸런스·내 프리셋을 가진 것)를 편집 묶음으로 감싼다. 쓰기는 원래 객체에 반영된다. */
export function settingsEditContext(s: { globalFx: FxLayer; globalPan: number; userPresets: UserNormPreset[] }): FxEditContext {
  return {
    get globalFx() { return s.globalFx; },
    set globalFx(v) { s.globalFx = v; },
    get globalPan() { return s.globalPan; },
    set globalPan(v) { s.globalPan = v; },
    get userPresets() { return s.userPresets; },
  };
}

function applyNormPatch(slot: NormSlot, patch: Partial<NormParams> & { enabled?: boolean }): NormSlot {
  let changedParam = false;
  const next: NormSlot = { ...slot };
  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  for (const k of NORM_PARAM_KEYS) {
    if (patch[k] !== undefined && patch[k] !== slot[k]) {
      (next as unknown as Record<string, unknown>)[k] = patch[k];
      changedParam = true;
    }
  }
  const clean = sanitizeNormSlot(next, slot);
  if (changedParam && clean.presetId !== "") clean.modified = true;
  return clean;
}

function applyPickPreset(slot: NormSlot, presetId: string, userPresets: readonly UserNormPreset[]): NormSlot | null {
  const params = findPresetParams(presetId, userPresets);
  if (!params) return null;
  return { ...slot, ...pickParams(params), presetId, modified: false };
}

/** "모든 채널" 층에 편집을 적용한다. 바뀌었으면 true. */
export function applyGlobalFxEdit(ctx: FxEditContext, edit: FxEdit): boolean {
  switch (edit.kind) {
    case "norm":
      ctx.globalFx.norm = applyNormPatch(ctx.globalFx.norm, edit.patch);
      return true;
    case "gate":
      ctx.globalFx.gate = sanitizeGate({ ...ctx.globalFx.gate, ...edit.patch }, ctx.globalFx.gate);
      return true;
    case "comp":
      ctx.globalFx.comp = sanitizeComp({ ...ctx.globalFx.comp, ...edit.patch }, ctx.globalFx.comp);
      return true;
    case "pan":
      ctx.globalPan = clampPan(edit.value);
      return true;
    case "pickPreset": {
      const next = applyPickPreset(ctx.globalFx.norm, edit.presetId, ctx.userPresets);
      if (!next) return false;
      ctx.globalFx.norm = next;
      return true;
    }
    default:
      return false; // detach/relink는 채널 전용
  }
}

/**
 * 채널 층에 편집을 적용한 새 FX 상태를 돌려준다. 바뀌지 않으면 null.
 * "모든 채널 따름" 상태(own에 없음)의 모듈은 잠겨 있어 값 편집을 거부한다 (질문 3 가 · 잠금).
 */
export function applyChannelFxEdit(fx: ChannelFxState, ctx: FxEditContext, edit: FxEdit): ChannelFxState | null {
  const next: ChannelFxState = { own: { ...fx.own }, pan: fx.pan };
  switch (edit.kind) {
    case "detach": {
      if (next.own[edit.module]) return null;
      const src = ctx.globalFx[edit.module];
      (next.own as Record<string, unknown>)[edit.module] = { ...src };
      return next;
    }
    case "relink":
      if (!next.own[edit.module]) return null;
      delete next.own[edit.module];
      return next;
    case "norm":
      if (!next.own.norm) return null;
      next.own.norm = applyNormPatch(next.own.norm, edit.patch);
      return next;
    case "gate":
      if (!next.own.gate) return null;
      next.own.gate = sanitizeGate({ ...next.own.gate, ...edit.patch }, next.own.gate);
      return next;
    case "comp":
      if (!next.own.comp) return null;
      next.own.comp = sanitizeComp({ ...next.own.comp, ...edit.patch }, next.own.comp);
      return next;
    case "pan":
      next.pan = clampPan(edit.value);
      return next;
    case "pickPreset": {
      if (!next.own.norm) return null;
      const picked = applyPickPreset(next.own.norm, edit.presetId, ctx.userPresets);
      if (!picked) return null;
      next.own.norm = picked;
      return next;
    }
  }
}

/** 지금 노멀라이저 값으로 내 프리셋을 만든다. 그 자리는 새 프리셋을 가리키고 수정됨이 풀린다. */
export function saveUserPreset(
  userPresets: UserNormPreset[],
  slot: NormSlot,
  id: string,
  name: string,
): { presets: UserNormPreset[]; slot: NormSlot } | null {
  if (!id.startsWith("u") || userPresets.some((p) => p.id === id) || userPresets.length >= MAX_USER_PRESETS) {
    return null;
  }
  const preset: UserNormPreset = { id, name: sanitizePresetName(name, "Preset"), ...pickParams(slot) };
  return { presets: [...userPresets, preset], slot: { ...slot, presetId: id, modified: false } };
}

/** 그 자리가 고른 내 프리셋을 지금 값으로 덮어쓴다. 다른 채널에 복사된 값은 그대로 둔다. */
export function overwriteUserPreset(
  userPresets: UserNormPreset[],
  slot: NormSlot,
): { presets: UserNormPreset[]; slot: NormSlot } | null {
  const idx = userPresets.findIndex((p) => p.id === slot.presetId);
  if (idx < 0) return null;
  const presets = userPresets.slice();
  presets[idx] = { ...presets[idx]!, ...pickParams(slot) };
  return { presets, slot: { ...slot, modified: false } };
}

export function renameUserPreset(userPresets: UserNormPreset[], id: string, name: string): UserNormPreset[] | null {
  const idx = userPresets.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const presets = userPresets.slice();
  presets[idx] = { ...presets[idx]!, name: sanitizePresetName(name, presets[idx]!.name) };
  return presets;
}

/** 내 프리셋을 지운다. 그것을 가리키던 자리는 값을 그대로 두고 "사용자 지정"이 된다. */
export function detachSlotFromPreset(slot: NormSlot, deletedId: string): NormSlot {
  return slot.presetId === deletedId ? { ...slot, presetId: "", modified: false } : slot;
}

export function newUserPresetId(now = Date.now()): string {
  return `u${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
