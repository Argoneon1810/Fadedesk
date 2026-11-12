import type { DspConfigPayload } from "../shared/types";
import {
  computePeakRatioFromAnalyser,
  createDspChain,
  setAudioParamSmooth,
  type DspChainInstance,
} from "./dsp-chain";
import type { HookSharedState } from "./hook-state";

/**
 * 페이지 자체 WebAudio(AudioContext.destination 직결) 출력을 가로채 채널 DSP 체인(노멀라이저·패닝·게이트·컴프레서·페이더)을 삽입한다.
 * - 확장 내부 전용 AudioContext(internalContexts)와 종단 노드(internalBypassNodes)는 우회하여 재귀·이중 증폭을 원천 차단한다.
 * - HookSharedState의 webAudioPatched 가드를 통해 문서 수명 동안 window.AudioContext 및 AudioNode.prototype.connect는 단 1회만 래핑된다.
 */

export { computePeakRatioFromAnalyser };

export function applyGainParamSmooth(
  param: AudioParam,
  ctx: BaseAudioContext,
  gain: number,
): void {
  setAudioParamSmooth(param, ctx, Math.max(0, Number.isFinite(gain) ? gain : 1));
}

export interface WrappedContextEntry {
  ctx: AudioContext;
  dspChain: DspChainInstance;
  hasConnectedNodes: boolean;
}

export interface PageWebAudioPatchOptions {
  win: Window & typeof globalThis;
  OrigAudioCtx: typeof AudioContext | undefined;
  internalContexts: WeakSet<BaseAudioContext>;
  internalBypassNodes: WeakSet<AudioNode>;
  pageContexts: Set<WrappedContextEntry>;
  getTargetGain: () => number;
  getDspConfig: () => DspConfigPayload;
  onActivityChange: () => void;
}

type ConnectNodeFn = (
  this: AudioNode,
  destinationNode: AudioNode,
  output?: number,
  input?: number,
) => AudioNode;

/**
 * HookSharedState를 기반으로 페이지 WebAudio 패치를 1회만 설치한다.
 */
export function installPageWebAudioPatchOnce(
  win: Window & typeof globalThis,
  state: HookSharedState,
): void {
  if (state.webAudioPatched) return;

  const OrigAudioCtx = state.OrigAudioCtx;
  const origConnect = state.origConnect;
  if (!OrigAudioCtx || !origConnect) return;

  const connectNode = origConnect as unknown as ConnectNodeFn;

  win.AudioNode.prototype.connect = function patchedConnect(
    this: AudioNode,
    destination: AudioNode | AudioParam,
    output?: number,
    input?: number,
  ): AudioNode | void {
    if (
      destination &&
      !state.internalBypassNodes.has(this) &&
      !state.internalContexts.has(this.context) &&
      state.destToEntry.has(destination as AudioDestinationNode)
    ) {
      const entry = state.destToEntry.get(destination as AudioDestinationNode)!;
      entry.hasConnectedNodes = true;
      state.delegates.onActivityChange();
      return connectNode.call(this, entry.dspChain.inputNode, output, 0);
    }
    return (origConnect as unknown as (...args: unknown[]) => AudioNode | void).call(
      this,
      destination,
      output,
      input,
    );
  } as typeof AudioNode.prototype.connect;

  class PatchedAudioContext extends OrigAudioCtx {
    constructor(options?: AudioContextOptions) {
      super(options);
      try {
        const dspChain = createDspChain(
          this,
          state.delegates.getTargetGain(),
          state.delegates.getDspConfig(),
          state.internalBypassNodes,
          connectNode,
        );
        const entry: WrappedContextEntry = {
          ctx: this,
          dspChain,
          hasConnectedNodes: false,
        };
        state.destToEntry.set(this.destination, entry);
        state.pageContexts.add(entry);
        this.addEventListener("statechange", () => {
          state.delegates.onActivityChange();
        });
      } catch {
        // 컨텍스트 제약 시 원본 그대로 동작
      }
    }
  }

  win.AudioContext = PatchedAudioContext;
  if ("webkitAudioContext" in win) {
    (win as unknown as Record<string, unknown>).webkitAudioContext = PatchedAudioContext;
  }
  state.webAudioPatched = true;
}

/**
 * 레거시 옵션 기반 설치 호환 함수.
 */
export function installPageWebAudioPatch(opts: PageWebAudioPatchOptions): void {
  const {
    win,
    OrigAudioCtx,
    internalContexts,
    internalBypassNodes,
    pageContexts,
    getTargetGain,
    getDspConfig,
    onActivityChange,
  } = opts;

  if (!OrigAudioCtx || !win.AudioNode?.prototype?.connect) return;

  const destToEntry = new WeakMap<AudioDestinationNode, WrappedContextEntry>();
  const origConnect = win.AudioNode.prototype.connect;
  const connectNode = origConnect as unknown as ConnectNodeFn;

  win.AudioNode.prototype.connect = function patchedConnect(
    this: AudioNode,
    destination: AudioNode | AudioParam,
    output?: number,
    input?: number,
  ): AudioNode | void {
    if (
      destination &&
      !internalBypassNodes.has(this) &&
      !internalContexts.has(this.context) &&
      destToEntry.has(destination as AudioDestinationNode)
    ) {
      const entry = destToEntry.get(destination as AudioDestinationNode)!;
      entry.hasConnectedNodes = true;
      onActivityChange();
      return connectNode.call(this, entry.dspChain.inputNode, output, 0);
    }
    return (origConnect as unknown as (...args: unknown[]) => AudioNode | void).call(
      this,
      destination,
      output,
      input,
    );
  } as typeof AudioNode.prototype.connect;

  class PatchedAudioContext extends OrigAudioCtx {
    constructor(options?: AudioContextOptions) {
      super(options);
      try {
        const dspChain = createDspChain(
          this,
          getTargetGain(),
          getDspConfig(),
          internalBypassNodes,
          connectNode,
        );
        const entry: WrappedContextEntry = {
          ctx: this,
          dspChain,
          hasConnectedNodes: false,
        };
        destToEntry.set(this.destination, entry);
        pageContexts.add(entry);
        this.addEventListener("statechange", onActivityChange);
      } catch {
        // 컨텍스트 제약 시 원본 그대로 동작
      }
    }
  }

  win.AudioContext = PatchedAudioContext;
  if ("webkitAudioContext" in win) {
    (win as unknown as Record<string, unknown>).webkitAudioContext = PatchedAudioContext;
  }
}
