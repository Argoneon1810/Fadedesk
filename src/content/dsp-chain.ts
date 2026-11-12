import { dbToLinear, dbToRatio, linearToDb } from "../shared/mixer-math";
import type { DspConfigPayload } from "../shared/types";

/**
 * 페이지 MAIN 월드 채널별 실시간 WebAudio DSP 체인.
 * - Pre-Fader 다이나믹 노멀라이저: K-가중 사이드체인(60Hz HPF + 2kHz High-Shelf)으로 원본 음압을 측정하여,
 *   사용자의 페이더 조작과 독립적으로 탭 내 곡·영상 간 음압 편차를 매끄럽게 평준화한다.
 * - 노이즈 게이트: 발화 사이 바닥 잡음·마이크 히스를 히스테리시스 감쇠로 제거한다.
 * - 채널 컴프레서 · 스테레오 패닝 · -0.8dBFS 안전 리미터를 단일 오디오 그래프로 통합한다.
 */

const GAIN_SMOOTH_TAU_SEC = 0.025;
const GATE_ATTACK_TAU_SEC = 0.012;
const GATE_RELEASE_TAU_SEC = 0.085;
const SILENCE_FREEZE_DB = -45;
const MIN_NORM_TRIM_DB = -14;
const MAX_NORM_TRIM_DB = 10;

export const DEFAULT_DSP_CONFIG: Readonly<DspConfigPayload> = {
  normActive: false,
  normTargetLufs: -16,
  normSpeed: "std",
  pan: 0,
  gateEnabled: false,
  gateThresholdDb: -48,
  compEnabled: false,
  compRatio: 4,
};

export interface DspChainInstance {
  ctx: BaseAudioContext;
  /** 미디어 소스나 페이지 오디오 노드가 연결되는 체인 입구 */
  inputNode: GainNode;
  /** 사용자 볼륨·Focus·Master 배율이 반영되는 페이더 GainNode */
  faderGain: GainNode;
  /** 최종 출력 파형 피크를 측정하는 Post-Fader AnalyserNode */
  postAnalyser: AnalyserNode;
  postBuffer: Float32Array<ArrayBuffer>;
  /** 사용자 목표 선형 게인을 스무딩 적용 */
  applyFaderGain: (targetGain: number) => void;
  /** 정적 DSP 파라미터(패닝·컴프레서) 즉시 반영 */
  syncStaticDsp: (dsp: DspConfigPayload) => void;
  /** 75ms 주기로 노이즈 게이트와 다이나믹 노멀라이저 이득을 갱신하고 현재 보정 dB를 반환 */
  tickDynamicDsp: (dsp: DspConfigPayload, isPlaying: boolean) => number;
  /** 탭 내 곡·영상 전환 시 이전 음압 기억을 빠르게 재동기화 */
  notifyTrackTransition: () => void;
  /** 최종 출력 VU 비율 [0, 1] 측정 */
  readPostVuRatio: () => number;
  /** 현재 노멀라이저 보정 dB 조회 */
  getNormTrimDb: () => number;
}

type RawConnectFn = (
  this: AudioNode,
  destinationNode: AudioNode,
  output?: number,
  input?: number,
) => AudioNode;

export function setAudioParamSmooth(
  param: AudioParam,
  ctx: BaseAudioContext,
  target: number,
  tauSec = GAIN_SMOOTH_TAU_SEC,
): void {
  const safeVal = Number.isFinite(target) ? target : 0;
  try {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(safeVal, now, tauSec);
  } catch {
    param.value = safeVal;
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

function measureSidechainEnergy(
  analyser: AnalyserNode,
  buf: Float32Array<ArrayBuffer>,
): { rmsDb: number; peakDb: number } {
  try {
    analyser.getFloatTimeDomainData(buf);
    let sumSq = 0;
    let peak = 0;
    const len = buf.length || 1;
    for (let i = 0; i < len; i++) {
      const sample = buf[i] ?? 0;
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / len);
    const rmsDb = rms <= 0.0001 ? -90 : 20 * Math.log10(rms);
    const peakDb = peak <= 0.0001 ? -90 : 20 * Math.log10(peak);
    return { rmsDb, peakDb };
  } catch {
    return { rmsDb: -90, peakDb: -90 };
  }
}

export function createDspChain(
  ctx: AudioContext,
  initialTargetGain: number,
  initialDsp: DspConfigPayload,
  internalBypassNodes: WeakSet<AudioNode>,
  rawConnect?: RawConnectFn,
): DspChainInstance {
  const connectNode = <T extends AudioNode>(from: AudioNode, to: T): T => {
    if (rawConnect) {
      rawConnect.call(from, to);
      return to;
    }
    from.connect(to);
    return to;
  };

  // 첫 번째 GainNode를 faderGain으로 생성해 기존 단일 GainNode 테스트 불변식과도 호환 유지
  const faderGain = ctx.createGain();
  faderGain.gain.value = Math.max(0, Number.isFinite(initialTargetGain) ? initialTargetGain : 1);

  const inputNode = ctx.createGain();
  const gateGain = ctx.createGain();
  const normGain = ctx.createGain();

  const postAnalyser = ctx.createAnalyser();
  postAnalyser.fftSize = 256;
  const postBuffer = new Float32Array(new ArrayBuffer(postAnalyser.fftSize * 4));

  const preAnalyser = ctx.createAnalyser();
  preAnalyser.fftSize = 256;
  const preBuffer = new Float32Array(new ArrayBuffer(preAnalyser.fftSize * 4));

  const anyCtx = ctx as unknown as {
    createBiquadFilter?: () => BiquadFilterNode;
    createDynamicsCompressor?: () => DynamicsCompressorNode;
    createStereoPanner?: () => StereoPannerNode;
  };

  // 1. K-가중(ITU-R BS.1770 근사) Pre-Fader 사이드체인 계측 경로 (무음 싱크로 오디오 스레드 풀 보장)
  const zeroSink = ctx.createGain();
  zeroSink.gain.value = 0;
  internalBypassNodes.add(zeroSink);
  if (typeof anyCtx.createBiquadFilter === "function") {
    const hpFilter = anyCtx.createBiquadFilter.call(ctx);
    hpFilter.type = "highpass";
    hpFilter.frequency.value = 60;
    hpFilter.Q.value = 0.5;

    const shelfFilter = anyCtx.createBiquadFilter.call(ctx);
    shelfFilter.type = "highshelf";
    shelfFilter.frequency.value = 2000;
    shelfFilter.gain.value = 4.0;

    connectNode(inputNode, hpFilter);
    connectNode(hpFilter, shelfFilter);
    connectNode(shelfFilter, preAnalyser);
  } else {
    connectNode(inputNode, preAnalyser);
  }
  connectNode(preAnalyser, zeroSink);
  connectNode(zeroSink, ctx.destination);

  // 2. 메인 오디오 경로: input -> gate -> norm -> (dry/wet compressor) -> fader -> panner -> limiter -> postAnalyser
  connectNode(inputNode, gateGain);
  connectNode(gateGain, normGain);

  let compressor: DynamicsCompressorNode | null = null;
  let dryCompGain: GainNode | null = null;
  let wetCompGain: GainNode | null = null;

  if (typeof anyCtx.createDynamicsCompressor === "function") {
    compressor = anyCtx.createDynamicsCompressor.call(ctx);
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = initialDsp.compRatio;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.16;

    dryCompGain = ctx.createGain();
    wetCompGain = ctx.createGain();
    dryCompGain.gain.value = initialDsp.compEnabled ? 0 : 1;
    wetCompGain.gain.value = initialDsp.compEnabled ? 1.22 : 0;

    connectNode(normGain, dryCompGain);
    connectNode(dryCompGain, faderGain);
    connectNode(normGain, compressor);
    connectNode(compressor, wetCompGain);
    connectNode(wetCompGain, faderGain);
  } else {
    connectNode(normGain, faderGain);
  }

  let tailNode: AudioNode = faderGain;
  let stereoPanner: StereoPannerNode | null = null;
  if (typeof anyCtx.createStereoPanner === "function") {
    stereoPanner = anyCtx.createStereoPanner.call(ctx);
    stereoPanner.pan.value = Math.max(-1, Math.min(1, initialDsp.pan / 100));
    connectNode(tailNode, stereoPanner);
    tailNode = stereoPanner;
  }

  if (typeof anyCtx.createDynamicsCompressor === "function") {
    const safetyLimiter = anyCtx.createDynamicsCompressor.call(ctx);
    safetyLimiter.threshold.value = -0.8;
    safetyLimiter.knee.value = 2.5;
    safetyLimiter.ratio.value = 16;
    safetyLimiter.attack.value = 0.002;
    safetyLimiter.release.value = 0.08;
    connectNode(tailNode, safetyLimiter);
    tailNode = safetyLimiter;
  }

  internalBypassNodes.add(postAnalyser);
  connectNode(tailNode, postAnalyser);
  connectNode(postAnalyser, ctx.destination);

  let gateOpen = true;
  let normTrimDb = 0;
  let shortLufs = -16;
  let longLufs = -16;
  let hasVoicedHistory = false;
  let relockTicks = 0;

  function syncStaticDsp(dsp: DspConfigPayload): void {
    if (!dsp.normActive && normTrimDb !== 0) {
      normTrimDb = 0;
      setAudioParamSmooth(normGain.gain, ctx, 1.0, 0.04);
    }
    if (!dsp.gateEnabled) {
      gateOpen = true;
      setAudioParamSmooth(gateGain.gain, ctx, 1.0, GATE_ATTACK_TAU_SEC);
    }
    if (stereoPanner) {
      const panVal = Math.max(-1, Math.min(1, dsp.pan / 100));
      setAudioParamSmooth(stereoPanner.pan, ctx, panVal, 0.02);
    }
    if (compressor && dryCompGain && wetCompGain) {
      compressor.ratio.value = dsp.compRatio;
      const makeup = dsp.compRatio === 8 ? 1.32 : dsp.compRatio === 4 ? 1.22 : 1.12;
      setAudioParamSmooth(dryCompGain.gain, ctx, dsp.compEnabled ? 0 : 1, 0.025);
      setAudioParamSmooth(wetCompGain.gain, ctx, dsp.compEnabled ? makeup : 0, 0.025);
    }
  }

  function tickDynamicDsp(dsp: DspConfigPayload, isPlaying: boolean): number {
    syncStaticDsp(dsp);
    const { rmsDb, peakDb } = measureSidechainEnergy(preAnalyser, preBuffer);

    // 1. 노이즈 게이트 (3dB 히스테리시스로 말끝 잘림 방지)
    if (dsp.gateEnabled && isPlaying) {
      const openTh = dsp.gateThresholdDb;
      const closeTh = dsp.gateThresholdDb - 3;
      if (gateOpen && rmsDb < closeTh) gateOpen = false;
      else if (!gateOpen && rmsDb >= openTh) gateOpen = true;

      setAudioParamSmooth(
        gateGain.gain,
        ctx,
        gateOpen ? 1.0 : 0.06,
        gateOpen ? GATE_ATTACK_TAU_SEC : GATE_RELEASE_TAU_SEC,
      );
    } else {
      gateOpen = true;
      setAudioParamSmooth(gateGain.gain, ctx, 1.0, GATE_ATTACK_TAU_SEC);
    }

    // 2. Pre-Fader 다이나믹 노멀라이저
    if (!dsp.normActive) {
      normTrimDb = Math.abs(normTrimDb) < 0.08 ? 0 : normTrimDb * 0.72;
      setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), 0.04);
      return Math.round(normTrimDb * 10) / 10;
    }

    if (!isPlaying) {
      return Math.round(normTrimDb * 10) / 10;
    }

    // 무음 구간 동결(Silence Freeze): 대사 휴지기나 곡 사이 무음에서 배경 히스가 증폭되지 않도록 현재 게인 고정
    if (rmsDb < SILENCE_FREEZE_DB) {
      return Math.round(normTrimDb * 10) / 10;
    }

    const approxLufs = rmsDb - 0.7;
    if (!hasVoicedHistory) {
      shortLufs = approxLufs;
      longLufs = approxLufs;
      hasVoicedHistory = true;
    } else {
      shortLufs += (approxLufs - shortLufs) * 0.38;
      const longAlpha = relockTicks > 0 ? 0.28 : 0.08;
      longLufs += (approxLufs - longLufs) * longAlpha;
    }
    if (relockTicks > 0) relockTicks--;

    const ceilingSafeTrim = -1.0 - peakDb;
    const rawTargetTrim = Math.min(dsp.normTargetLufs - longLufs, ceilingSafeTrim);
    const clampedTargetTrim = Math.max(
      MIN_NORM_TRIM_DB,
      Math.min(MAX_NORM_TRIM_DB, rawTargetTrim),
    );

    const predictedPeakDb = peakDb + normTrimDb;
    const suddenJump = shortLufs - longLufs > 5.5 && clampedTargetTrim < normTrimDb;
    const baseAlpha = dsp.normSpeed === "fast" ? 0.28 : dsp.normSpeed === "slow" ? 0.06 : 0.14;
    const stepAlpha =
      predictedPeakDb > -1.0 || suddenJump
        ? 0.52
        : relockTicks > 0
          ? Math.max(baseAlpha, 0.26)
          : baseAlpha;

    normTrimDb += (clampedTargetTrim - normTrimDb) * stepAlpha;
    normTrimDb = Math.max(MIN_NORM_TRIM_DB, Math.min(MAX_NORM_TRIM_DB, normTrimDb));
    setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), 0.035);
    return Math.round(normTrimDb * 10) / 10;
  }

  syncStaticDsp(initialDsp);

  return {
    ctx,
    inputNode,
    faderGain,
    postAnalyser,
    postBuffer,
    applyFaderGain: (targetGain: number) => {
      setAudioParamSmooth(faderGain.gain, ctx, Math.max(0, targetGain), GAIN_SMOOTH_TAU_SEC);
    },
    syncStaticDsp,
    tickDynamicDsp,
    notifyTrackTransition: () => {
      relockTicks = 18;
    },
    readPostVuRatio: () => computePeakRatioFromAnalyser(postAnalyser, postBuffer),
    getNormTrimDb: () => Math.round(normTrimDb * 10) / 10,
  };
}
