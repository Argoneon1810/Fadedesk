import { resolveBuildId } from "../shared/build-id";
import type { DspConfigPayload } from "../shared/types";
import { DEFAULT_DSP_CONFIG, type DspChainInstance } from "./dsp-chain";
import type { WrappedContextEntry } from "./webaudio-patch";

/**
 * 페이지 수명(Page Lifecycle) 동안 단 하나만 존재하는 오디오 훅 공유 상태.
 * - 확장 리로드 또는 버전 업그레이드 시 이전 컨트롤러의 타이머·옵저버만 해제하고,
 *   이미 연결된 WebAudio 노드 그래프·HTMLMediaElement 프로토타입 패치·볼륨 이력은 보존한다.
 */

export const HOOK_STATE_KEY = "__SOUND_MANAGER_HOOK_STATE__";
export const HOOK_CONTROLLER_KEY = "__SOUND_MANAGER_CONTROLLER__";

export interface ElementAudioEntry {
  sourceNode: AudioNode;
  dspChain: DspChainInstance;
}

export interface HookDelegates {
  registerElement: (el: HTMLMediaElement) => void;
  syncElementGain: (el: HTMLMediaElement) => void;
  onElementEncrypted: (el: HTMLMediaElement) => void;
  onElementPlay: (el: HTMLMediaElement) => void;
  onElementStateChange: (el: HTMLMediaElement) => void;
  onElementTrackChange: (el: HTMLMediaElement) => void;
  getTargetGain: () => number;
  getDspConfig: () => DspConfigPayload;
  onActivityChange: () => void;
}

export interface HookSharedState {
  readonly schemaVersion: 1;
  origVolGet: (() => number) | undefined;
  origVolSet: ((val: number) => void) | undefined;
  origPlay: (() => Promise<void>) | undefined;
  OrigAudioCtx: typeof AudioContext | undefined;
  origConnect: typeof AudioNode.prototype.connect | undefined;
  sharedCtx: AudioContext | null;
  targetGain: number;
  currentDsp: DspConfigPayload;
  meteringActive: boolean;
  vuCur: number;
  vuPeak: number;
  vuCurL: number;
  vuCurR: number;
  lastInputLufs: number;
  lastSpectrumBins: number[];
  lastNormTrimDb: number;
  trackedElements: Set<HTMLMediaElement>;
  lastActiveElements: Set<HTMLMediaElement>;
  boundElements: WeakSet<HTMLMediaElement>;
  encryptedElements: WeakSet<HTMLMediaElement>;
  failedWebAudioElements: WeakSet<HTMLMediaElement>;
  siteVolumeMap: WeakMap<HTMLMediaElement, number>;
  hookedEntries: WeakMap<HTMLMediaElement, ElementAudioEntry>;
  internalContexts: WeakSet<BaseAudioContext>;
  internalBypassNodes: WeakSet<AudioNode>;
  pageContexts: Set<WrappedContextEntry>;
  destToEntry: WeakMap<AudioDestinationNode, WrappedContextEntry>;
  mediaProtoPatched: boolean;
  webAudioPatched: boolean;
  delegates: HookDelegates;
}

export function resolveHookBuildId(override?: string): string {
  return resolveBuildId(override);
}

/**
 * 윈도우 전역에서 HookSharedState 싱글턴을 가져오거나 새로 생성한다.
 * 이미 존재하는 경우 새 컨트롤러의 delegates와 기본 DSP 필드를 병합해 바인딩한다.
 */
export function getOrCreateHookState(
  win: Window & typeof globalThis,
  delegates: HookDelegates,
): HookSharedState {
  const globalBag = win as unknown as Record<string, unknown>;
  const existing = globalBag[HOOK_STATE_KEY] as HookSharedState | undefined;

  if (existing && existing.schemaVersion === 1) {
    existing.delegates = delegates;
    existing.currentDsp = { ...DEFAULT_DSP_CONFIG, ...existing.currentDsp };
    if (typeof existing.vuCurL !== "number") existing.vuCurL = existing.vuCur ?? 0;
    if (typeof existing.vuCurR !== "number") existing.vuCurR = existing.vuCur ?? 0;
    if (typeof existing.lastInputLufs !== "number") existing.lastInputLufs = -100;
    if (!Array.isArray(existing.lastSpectrumBins)) existing.lastSpectrumBins = [];
    return existing;
  }

  const MediaProto = win.HTMLMediaElement?.prototype;
  const volDesc = MediaProto ? Object.getOwnPropertyDescriptor(MediaProto, "volume") : undefined;
  const OrigAudioCtx =
    win.AudioContext ||
    (win as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const origConnect = win.AudioNode?.prototype?.connect;
  const origPlay = MediaProto?.play;

  const state: HookSharedState = {
    schemaVersion: 1,
    origVolGet: volDesc?.get,
    origVolSet: volDesc?.set,
    origPlay,
    OrigAudioCtx,
    origConnect,
    sharedCtx: null,
    targetGain: 1.0,
    currentDsp: { ...DEFAULT_DSP_CONFIG },
    meteringActive: false,
    vuCur: 0,
    vuPeak: 0,
    vuCurL: 0,
    vuCurR: 0,
    lastInputLufs: -100,
    lastSpectrumBins: [],
    lastNormTrimDb: 0,
    trackedElements: new Set<HTMLMediaElement>(),
    lastActiveElements: new Set<HTMLMediaElement>(),
    boundElements: new WeakSet<HTMLMediaElement>(),
    encryptedElements: new WeakSet<HTMLMediaElement>(),
    failedWebAudioElements: new WeakSet<HTMLMediaElement>(),
    siteVolumeMap: new WeakMap<HTMLMediaElement, number>(),
    hookedEntries: new WeakMap<HTMLMediaElement, ElementAudioEntry>(),
    internalContexts: new WeakSet<BaseAudioContext>(),
    internalBypassNodes: new WeakSet<AudioNode>(),
    pageContexts: new Set<WrappedContextEntry>(),
    destToEntry: new WeakMap<AudioDestinationNode, WrappedContextEntry>(),
    mediaProtoPatched: false,
    webAudioPatched: false,
    delegates,
  };

  globalBag[HOOK_STATE_KEY] = state;
  return state;
}

export function readSiteVolume(state: HookSharedState, el: HTMLMediaElement): number {
  const saved = state.siteVolumeMap.get(el);
  if (typeof saved === "number") return saved;
  const initial = state.origVolGet ? state.origVolGet.call(el) : el.volume;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(initial) ? initial : 1));
  state.siteVolumeMap.set(el, clamped);
  return clamped;
}

export function writeRawVolume(
  state: HookSharedState,
  el: HTMLMediaElement,
  val: number,
): void {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 1));
  if (state.origVolSet) {
    state.origVolSet.call(el, clamped);
  }
}

export function isElementCorsOrDrmRestricted(
  state: HookSharedState,
  win: Window & typeof globalThis,
  el: HTMLMediaElement,
): boolean {
  if (state.failedWebAudioElements.has(el) || state.encryptedElements.has(el)) return true;
  const anyEl = el as unknown as { mediaKeys?: unknown; srcObject?: unknown };
  if (anyEl.mediaKeys != null || anyEl.srcObject != null) return true;

  const src = el.currentSrc || el.getAttribute("src") || "";
  if (!src) return false;
  if (src.startsWith("blob:") || src.startsWith("data:")) return false;

  try {
    const parsed = new URL(src, win.location.href);
    if (parsed.origin === win.location.origin) return false;
    return el.crossOrigin === null || el.crossOrigin === "";
  } catch {
    return true;
  }
}

export function ensureSharedContext(state: HookSharedState): AudioContext | null {
  if (state.sharedCtx && state.sharedCtx.state !== "closed") return state.sharedCtx;
  if (!state.OrigAudioCtx) return null;
  try {
    const ctx = new state.OrigAudioCtx();
    state.internalContexts.add(ctx);
    state.sharedCtx = ctx;
    return ctx;
  } catch {
    return null;
  }
}

/**
 * HTMLMediaElement.prototype.play 및 volume 디스크립터를 1회만 패치한다.
 * 콜백 내부에서는 state.delegates를 호출하므로 핫스왑 시 재패치 없이 새 컨트롤러로 즉시 위임된다.
 */
export function installMediaPrototypePatchesOnce(
  win: Window & typeof globalThis,
  state: HookSharedState,
): void {
  if (state.mediaProtoPatched) return;
  const MediaProto = win.HTMLMediaElement?.prototype;

  if (MediaProto && state.origVolGet && state.origVolSet) {
    if (typeof state.origPlay === "function") {
      const origPlay = state.origPlay;
      MediaProto.play = function patchedPlay(this: HTMLMediaElement): Promise<void> {
        state.delegates.registerElement(this);
        state.lastActiveElements.delete(this);
        state.lastActiveElements.add(this);
        state.delegates.syncElementGain(this);
        return origPlay.call(this);
      };
    }

    Object.defineProperty(MediaProto, "volume", {
      configurable: true,
      enumerable: true,
      get(this: HTMLMediaElement): number {
        return readSiteVolume(state, this);
      },
      set(this: HTMLMediaElement, nextVal: number): void {
        const clamped = Math.max(0, Math.min(1, Number(nextVal)));
        if (!Number.isFinite(clamped)) return;
        state.siteVolumeMap.set(this, clamped);
        state.delegates.registerElement(this);
        state.delegates.syncElementGain(this);
      },
    });

    state.mediaProtoPatched = true;
  }
}

/**
 * 개별 HTMLMediaElement에 8개 라이프사이클 이벤트 리스너를 단 1회만 등록한다.
 * 콜백은 항상 state.delegates를 실시간으로 참조하므로 핫스왑 후에도 중복 없이 최신 핸들러가 동작한다.
 */
export function bindElementEventsOnce(
  state: HookSharedState,
  el: HTMLMediaElement,
): void {
  if (state.boundElements.has(el)) return;
  state.boundElements.add(el);

  el.addEventListener("encrypted", () => state.delegates.onElementEncrypted(el), { passive: true });
  el.addEventListener("play", () => state.delegates.onElementPlay(el), { passive: true });
  el.addEventListener("playing", () => state.delegates.onElementPlay(el), { passive: true });
  el.addEventListener("pause", () => state.delegates.onElementStateChange(el), { passive: true });
  el.addEventListener("ended", () => state.delegates.onElementStateChange(el), { passive: true });
  el.addEventListener("loadedmetadata", () => state.delegates.onElementTrackChange(el), { passive: true });
  el.addEventListener("durationchange", () => state.delegates.onElementTrackChange(el), { passive: true });
  el.addEventListener("emptied", () => state.delegates.onElementTrackChange(el), { passive: true });
}
