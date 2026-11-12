import { dbToRatio, linearToDb } from "../shared/mixer-math";

/**
 * 페이지 자체 WebAudio(AudioContext.destination 직결) 출력을 가로채 버스 GainNode와 AnalyserNode를 삽입하고,
 * Gain 스무딩 및 파형 피크 측정(AnalyserNode) 보조 연산을 제공한다.
 * 확장 내부 전용 AudioContext(internalContexts)는 우회하여 이중 증폭을 원천 차단한다.
 */

const RAMP_TIME_CONSTANT_SEC = 0.025; // 약 75ms(3*tau) 스무딩으로 클릭 노이즈 방지

export function applyGainParamSmooth(
  param: AudioParam,
  ctx: BaseAudioContext,
  gain: number,
): void {
  const safeGain = Math.max(0, Number.isFinite(gain) ? gain : 1);
  try {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(safeGain, now, RAMP_TIME_CONSTANT_SEC);
  } catch {
    param.value = safeGain;
  }
}

export function computePeakRatioFromAnalyser(
  analyser: AnalyserNode,
  buf: Float32Array<ArrayBuffer>,
): number {
  try {
    analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const abs = Math.abs(buf[i] ?? 0);
      if (abs > peak) peak = abs;
    }
    if (peak <= 0.0005) return 0;
    return dbToRatio(Math.min(12, linearToDb(peak)));
  } catch {
    return 0;
  }
}

export interface WrappedContextEntry {
  ctx: AudioContext;
  busGain: GainNode;
  analyser: AnalyserNode;
  buffer: Float32Array<ArrayBuffer>;
  hasConnectedNodes: boolean;
}

export interface PageWebAudioPatchOptions {
  win: Window & typeof globalThis;
  OrigAudioCtx: typeof AudioContext | undefined;
  internalContexts: WeakSet<BaseAudioContext>;
  internalBypassNodes: WeakSet<AudioNode>;
  pageContexts: Set<WrappedContextEntry>;
  getTargetGain: () => number;
  onActivityChange: () => void;
}

type ConnectNodeFn = (
  this: AudioNode,
  destinationNode: AudioNode,
  output?: number,
  input?: number,
) => AudioNode;

export function installPageWebAudioPatch(opts: PageWebAudioPatchOptions): void {
  const {
    win,
    OrigAudioCtx,
    internalContexts,
    internalBypassNodes,
    pageContexts,
    getTargetGain,
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
      return connectNode.call(this, entry.busGain, output, 0);
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
        const busGain = this.createGain();
        const analyser = this.createAnalyser();
        analyser.fftSize = 256;
        busGain.gain.value = Math.max(0, getTargetGain());
        internalBypassNodes.add(analyser);
        connectNode.call(busGain, analyser);
        connectNode.call(analyser, this.destination);

        const entry: WrappedContextEntry = {
          ctx: this,
          busGain,
          analyser,
          buffer: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)),
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
