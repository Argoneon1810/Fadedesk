import { dbToLinear, dbToRatio, linearToDb } from "../shared/mixer-math";
import type { DspConfigPayload, NormSpeedPreset } from "../shared/types";

/**
 * 페이지 MAIN 월드 채널별 실시간 WebAudio DSP 체인.
 * - Pre-Fader 라우드니스 노멀라이저: ITU-R BS.1770-4 표준 K-가중 필터(1681.97Hz High-Shelf + 38.14Hz RLB HPF)와
 *   2단계 게이팅(-55 LUFS 절대 게이트 + -10.0 LU 상대 게이트), EBU Tech 3341 표준 슬라이딩 계측 창(0.45s / 3.0s / 9.0s),
 *   그리고 물리 시정수(τ_attack < τ_release) 기반 1차 지수 볼리스틱스만으로 동작한다.
 *   상단 '균일 N ▾' 이지 프리셋은 별도 우회 수식 없이 이 단일 엔진의 (목표 LUFS, EBU 계측 창) 조합만 지정한다.
 * - 노이즈 게이트: 발화 사이 바닥 잡음·마이크 히스를 3dB 히스테리시스 감쇠로 차단한다.
 * - 채널 컴프레서 · 스테레오 패닝 · -1.0dBFS 피크 안전 리미터를 단일 오디오 그래프로 통합한다.
 */

const TICK_SEC = 0.075;
const GAIN_SMOOTH_TAU_SEC = 0.025;
const GATE_ATTACK_TAU_SEC = 0.012;
const GATE_RELEASE_TAU_SEC = 0.085;

/** ITU-R BS.1770-4 §2.2 K-가중 평균제곱 -> LUFS 변환 상수 (-0.691 dB) */
const BS1770_OFFSET_DB = -0.691;
/** 실시간 웹 오디오(코덱 바닥 잡음 고려) 절대 무음 게이트 Γ_a (LUFS) */
const ABSOLUTE_GATE_LUFS = -55.0;
/** ITU-R BS.1770-4 §2.2 표준 상대 게이트 오프셋 (-10.0 LU -> 평균제곱 0.1배) */
const RELATIVE_GATE_LINEAR_RATIO = 0.1;
/** 최대 슬라이딩 참조 창 블록 수 (120 * 75ms = 9.0s) */
const MAX_GATE_HISTORY_BLOCKS = 120;
const MIN_NORM_TRIM_DB = -16.0;

/**
 * EBU Tech 3341 계측 시간축(Momentary 0.45s / Short-Term 3.0s / Long-Term 9.0s) 및
 * 표준 비대칭 물리 시정수(감쇠 τ_attack << 증폭·복귀 τ_release).
 */
const NORM_BALLISTIC_PROFILES: Readonly<
  Record<
    NormSpeedPreset,
    {
      windowBlocks: number;
      attackTauSec: number;
      releaseTauSec: number;
      maxBoostDb: number;
    }
  >
> = {
  slow: { windowBlocks: 120, attackTauSec: 1.5, releaseTauSec: 6.0, maxBoostDb: 6.0 },
  std: { windowBlocks: 40, attackTauSec: 0.4, releaseTauSec: 2.5, maxBoostDb: 7.5 },
  fast: { windowBlocks: 6, attackTauSec: 0.15, releaseTauSec: 1.2, maxBoostDb: 9.0 },
};

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
  /** 75ms 주기로 노이즈 게이트와 BS.1770-4 게이팅 라우드니스 노멀라이저 이득을 갱신하고 현재 보정 dB를 반환 */
  tickDynamicDsp: (dsp: DspConfigPayload, isPlaying: boolean) => number;
  /** 탭 내 곡·영상 전환 시 이전 프로그램의 적분 이력을 초기화 */
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

function measureBlockMeanSquare(
  analyser: AnalyserNode,
  buf: Float32Array<ArrayBuffer>,
): { meanSquare: number; rmsDb: number; blockLufs: number } {
  try {
    analyser.getFloatTimeDomainData(buf);
    let sumSq = 0;
    const len = buf.length || 1;
    for (let i = 0; i < len; i++) {
      const sample = buf[i] ?? 0;
      sumSq += sample * sample;
    }
    const meanSquare = sumSq / len;
    if (meanSquare <= 1e-10) {
      return { meanSquare: 0, rmsDb: -100, blockLufs: -100 };
    }
    const powerDb = 10 * Math.log10(meanSquare);
    return {
      meanSquare,
      rmsDb: powerDb,
      blockLufs: BS1770_OFFSET_DB + powerDb,
    };
  } catch {
    return { meanSquare: 0, rmsDb: -100, blockLufs: -100 };
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
  preAnalyser.fftSize = 2048;
  const preBuffer = new Float32Array(new ArrayBuffer(preAnalyser.fftSize * 4));

  const anyCtx = ctx as unknown as {
    createBiquadFilter?: () => BiquadFilterNode;
    createDynamicsCompressor?: () => DynamicsCompressorNode;
    createStereoPanner?: () => StereoPannerNode;
  };

  // 1. ITU-R BS.1770-4 §2.1 2단 K-가중 필터 사이드체인 계측 경로
  const zeroSink = ctx.createGain();
  zeroSink.gain.value = 0;
  internalBypassNodes.add(zeroSink);
  if (typeof anyCtx.createBiquadFilter === "function") {
    // Stage 1: 음향 두부 모델 High-Shelf (1681.97Hz, +4.0dB, Q=0.7072)
    const shelfFilter = anyCtx.createBiquadFilter.call(ctx);
    shelfFilter.type = "highshelf";
    shelfFilter.frequency.value = 1681.97;
    shelfFilter.Q.value = 0.7072;
    shelfFilter.gain.value = 4.0;

    // Stage 2: RLB(Revised Low-frequency B-curve) High-Pass (38.14Hz, Q=0.5003)
    const rlbFilter = anyCtx.createBiquadFilter.call(ctx);
    rlbFilter.type = "highpass";
    rlbFilter.frequency.value = 38.14;
    rlbFilter.Q.value = 0.5003;

    connectNode(inputNode, shelfFilter);
    connectNode(shelfFilter, rlbFilter);
    connectNode(rlbFilter, preAnalyser);
  } else {
    connectNode(inputNode, preAnalyser);
  }
  connectNode(preAnalyser, zeroSink);
  connectNode(zeroSink, ctx.destination);

  // 2. 메인 오디오 경로: input -> gate -> norm -> (dry/wet compressor) -> fader -> panner -> safetyLimiter -> postAnalyser
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
    safetyLimiter.threshold.value = -1.0;
    safetyLimiter.knee.value = 2.0;
    safetyLimiter.ratio.value = 20;
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
  /** ITU-R BS.1770-4 절대 게이트를 통과한 최근 K-가중 블록 평균제곱(z_k) 슬라이딩 링 버퍼 */
  const zHistory: number[] = [];

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
    const { meanSquare, rmsDb, blockLufs } = measureBlockMeanSquare(preAnalyser, preBuffer);

    // 1. 노이즈 게이트 (3dB 히스테리시스로 발화 말끝 잘림 방지)
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

    // 2. ITU-R BS.1770-4 + EBU Tech 3341 게이팅 라우드니스 노멀라이저
    if (!dsp.normActive) {
      normTrimDb = Math.abs(normTrimDb) < 0.08 ? 0 : normTrimDb * 0.72;
      setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), 0.04);
      return Math.round(normTrimDb * 10) / 10;
    }

    if (!isPlaying) {
      return Math.round(normTrimDb * 10) / 10;
    }

    // Stage A: BS.1770 절대 게이트(Γ_a = -55 LUFS) 미만 무음·바닥 히스 구간은 게인 적분 동결(Gated AGC Hold)
    if (blockLufs < ABSOLUTE_GATE_LUFS || meanSquare <= 0) {
      return Math.round(normTrimDb * 10) / 10;
    }

    zHistory.push(meanSquare);
    if (zHistory.length > MAX_GATE_HISTORY_BLOCKS) {
      zHistory.shift();
    }

    // Stage B: 참조 창 내 절대 게이트 통과 블록 평균제곱으로 상대 게이트 임계치(Γ_r = L_Γa - 10.0 LU) 산출
    let sumAll = 0;
    for (let i = 0; i < zHistory.length; i++) {
      sumAll += zHistory[i]!;
    }
    const meanUngated = sumAll / zHistory.length;
    const relativeGateZ = meanUngated * RELATIVE_GATE_LINEAR_RATIO;

    // 현재 유입되는 신호 자체가 상대 게이트(-10 LU) 아래의 잔향·프리즈·휴지기이면 전경 신호 복귀 전까지 게인 동결
    if (meanSquare < relativeGateZ) {
      return Math.round(normTrimDb * 10) / 10;
    }

    // Stage C: 활성 EBU 3341 계측 창(0.45s / 3.0s / 9.0s)에서 상대 게이트를 통과한 전경 블록 평균제곱 산출
    const profile = NORM_BALLISTIC_PROFILES[dsp.normSpeed] ?? NORM_BALLISTIC_PROFILES.std;
    const startIdx = Math.max(0, zHistory.length - profile.windowBlocks);
    let gatedSum = 0;
    let gatedCount = 0;
    for (let i = startIdx; i < zHistory.length; i++) {
      const z = zHistory[i]!;
      if (z >= relativeGateZ) {
        gatedSum += z;
        gatedCount++;
      }
    }
    if (gatedCount === 0) {
      return Math.round(normTrimDb * 10) / 10;
    }

    const gatedLoudnessLufs = BS1770_OFFSET_DB + 10 * Math.log10(gatedSum / gatedCount);
    const targetTrimDb = Math.max(
      MIN_NORM_TRIM_DB,
      Math.min(profile.maxBoostDb, dsp.normTargetLufs - gatedLoudnessLufs),
    );

    // Stage D: 1차 지수 볼리스틱스 (감쇠 시 τ_attack, 증폭·복귀 시 τ_release)
    const tauSec = targetTrimDb < normTrimDb ? profile.attackTauSec : profile.releaseTauSec;
    const alpha = 1 - Math.exp(-TICK_SEC / tauSec);
    normTrimDb += alpha * (targetTrimDb - normTrimDb);
    normTrimDb = Math.max(MIN_NORM_TRIM_DB, Math.min(profile.maxBoostDb, normTrimDb));

    setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), GAIN_SMOOTH_TAU_SEC);
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
      zHistory.length = 0;
    },
    readPostVuRatio: () => computePeakRatioFromAnalyser(postAnalyser, postBuffer),
    getNormTrimDb: () => Math.round(normTrimDb * 10) / 10,
  };
}
