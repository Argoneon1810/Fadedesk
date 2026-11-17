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
/** 최대 슬라이딩 참조 창 블록 수 (200 * 75ms = 15.0s) */
const MAX_GATE_HISTORY_BLOCKS = 200;
/** 하한 미달(휴지기·잔향) 시 0.0dB 회귀 텐션 작동 전 단기 호흡 유예 블록 수 (24 * 75ms = 1.8s) */
const LOW_HOLD_GRACE_BLOCKS = 24;
/** 급격한 음압 도약 시 대표 구간을 스쳐 지나가는 과도 샘플을 걸러내는 최소 연속 블록 수 (6 * 75ms = 0.45s) */
const TRANSIENT_CONFIRM_BLOCKS = 6;
const MIN_NORM_TRIM_DB = -16.0;
const SPECTRUM_BIN_COUNT = 16;

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
  normSpeed: "slow",
  normRangeLowLufs: -32,
  normRangeHighLufs: -10,
  normZeroReturnRate: 0.35,
  normMinDwellBlocks: 1,
  normMaxBoostDb: 6.0,
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
  /** 사용자 목표 선형 게인을 스무딩 적용 (rampSec 지정 시 완만한 복귀 시정수 사용) */
  applyFaderGain: (targetGain: number, rampSec?: number) => void;
  /** 정적 DSP 파라미터(패닝·컴프레서) 즉시 반영 */
  syncStaticDsp: (dsp: DspConfigPayload) => void;
  /** 75ms 주기로 노이즈 게이트와 대표 구간·0dB 텐션 노멀라이저 이득을 갱신하고 현재 보정 dB를 반환 */
  tickDynamicDsp: (dsp: DspConfigPayload, isPlaying: boolean, siteVolume?: number) => number;
  /** 탭 내 곡·영상 전환 시 이전 프로그램의 적분 이력을 초기화 */
  notifyTrackTransition: () => void;
  /** 최종 출력 모노 VU 비율 [0, 1] 측정 */
  readPostVuRatio: () => number;
  /** 최종 출력 스테레오(L/R) 및 모노 VU 비율 [0, 1] 측정 (6-A) */
  readPostStereoVuRatio: () => { left: number; right: number; mono: number };
  /** 현재 노멀라이저 보정 dB 조회 */
  getNormTrimDb: () => number;
  /** 최근 계측된 원본 입력 음압(LUFS) 조회 */
  getInputLufs: () => number;
  /** 2D 프리퀀시 스펙트럼 시각화용 16-밴드 dB 배열([-60..0]) 조회 */
  getSpectrumBins: () => number[];
  /** 핫스왑 시 구 DSP 체인 연결 해제 */
  dispose?: () => void;
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
): { meanSquare: number; rmsDb: number; blockLufs: number; peakDb: number } {
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
    const meanSquare = sumSq / len;
    if (meanSquare <= 1e-10) {
      return { meanSquare: 0, rmsDb: -100, blockLufs: -100, peakDb: -100 };
    }
    const powerDb = 10 * Math.log10(meanSquare);
    const peakDb = peak <= 1e-5 ? -100 : 20 * Math.log10(peak);
    return {
      meanSquare,
      rmsDb: powerDb,
      blockLufs: BS1770_OFFSET_DB + powerDb,
      peakDb,
    };
  } catch {
    return { meanSquare: 0, rmsDb: -100, blockLufs: -100, peakDb: -100 };
  }
}

function extractSpectrumBins(
  analyser: AnalyserNode,
  freqBuf: Float32Array<ArrayBuffer>,
  intrinsicLufs: number,
  sampleRate = 48000,
): number[] {
  const anyAnalyser = analyser as unknown as {
    getFloatFrequencyData?: (array: Float32Array<ArrayBuffer>) => void;
  };
  if (typeof anyAnalyser.getFloatFrequencyData !== "function" || intrinsicLufs <= -59.5) {
    return Array.from({ length: SPECTRUM_BIN_COUNT }, () => -60);
  }
  try {
    anyAnalyser.getFloatFrequencyData(freqBuf);
    const total = freqBuf.length || 1024;
    const nyquist = Math.max(8000, sampleRate / 2);
    const binHz = nyquist / total;
    const fMin = 25;
    const fMax = Math.min(18000, nyquist * 0.92);
    const bandPowers: number[] = [];

    for (let b = 0; b < SPECTRUM_BIN_COUNT; b++) {
      const f0 = fMin * Math.pow(fMax / fMin, b / SPECTRUM_BIN_COUNT);
      const f1 = fMin * Math.pow(fMax / fMin, (b + 1) / SPECTRUM_BIN_COUNT);
      const x0 = Math.max(1, f0 / binHz);
      const x1 = Math.max(x0 + 0.25, Math.min(total - 1, f1 / binHz));

      let powerSum = 0;
      let weightSum = 0;
      const kStart = Math.max(1, Math.floor(x0));
      const kEnd = Math.min(total - 1, Math.ceil(x1));

      if (kEnd <= kStart + 1) {
        const xMid = 0.5 * (x0 + x1);
        const kLow = Math.max(1, Math.min(total - 2, Math.floor(xMid)));
        const frac = xMid - kLow;
        const dbLow = freqBuf[kLow] ?? -120;
        const dbHigh = freqBuf[kLow + 1] ?? -120;
        const interpDb =
          (Number.isFinite(dbLow) ? dbLow : -120) * (1 - frac) +
          (Number.isFinite(dbHigh) ? dbHigh : -120) * frac;
        powerSum = interpDb > -115 ? Math.pow(10, interpDb / 10) : 0;
        weightSum = 1;
      } else {
        for (let k = kStart; k <= kEnd; k++) {
          const val = freqBuf[k] ?? -120;
          if (Number.isFinite(val) && val > -115) {
            powerSum += Math.pow(10, val / 10);
          }
          weightSum += 1;
        }
      }
      // 옥타브 대역 에너지 밀도(핑크 노이즈 기준 평탄화: 대역폭 비례 가중)
      const bandEnergy = weightSum > 0 ? powerSum / Math.sqrt(weightSum) : 0;
      bandPowers.push(bandEnergy);
    }

    const totalPower = bandPowers.reduce((acc, p) => acc + p, 0);
    if (totalPower <= 1e-12) {
      return Array.from({ length: SPECTRUM_BIN_COUNT }, () => -60);
    }
    const meanBandPower = totalPower / SPECTRUM_BIN_COUNT;
    return bandPowers.map((p) => {
      if (p <= 1e-14) return -60;
      const relDb = 10 * Math.log10(p / meanBandPower);
      const calibratedDb = intrinsicLufs + relDb;
      return Math.max(-60, Math.min(0, Math.round(calibratedDb * 10) / 10));
    });
  } catch {
    return Array.from({ length: SPECTRUM_BIN_COUNT }, () => -60);
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
  const freqBuffer = new Float32Array(new ArrayBuffer((preAnalyser.fftSize / 2) * 4));

  const anyCtx = ctx as unknown as {
    createBiquadFilter?: () => BiquadFilterNode;
    createDynamicsCompressor?: () => DynamicsCompressorNode;
    createStereoPanner?: () => StereoPannerNode;
    createChannelSplitter?: (numberOfOutputs?: number) => ChannelSplitterNode;
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
  let currentPan = initialDsp.pan;
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

  let postAnalyserL: AnalyserNode | null = null;
  let postAnalyserR: AnalyserNode | null = null;
  let postBufferL: Float32Array<ArrayBuffer> | null = null;
  let postBufferR: Float32Array<ArrayBuffer> | null = null;
  if (typeof anyCtx.createChannelSplitter === "function") {
    try {
      const splitter = anyCtx.createChannelSplitter.call(ctx, 2);
      postAnalyserL = ctx.createAnalyser();
      postAnalyserR = ctx.createAnalyser();
      postAnalyserL.fftSize = 256;
      postAnalyserR.fftSize = 256;
      postBufferL = new Float32Array(new ArrayBuffer(postAnalyserL.fftSize * 4));
      postBufferR = new Float32Array(new ArrayBuffer(postAnalyserR.fftSize * 4));
      connectNode(tailNode, splitter);
      splitter.connect(postAnalyserL, 0);
      splitter.connect(postAnalyserR, 1);
      connectNode(postAnalyserL, zeroSink);
      connectNode(postAnalyserR, zeroSink);
    } catch {
      postAnalyserL = null;
      postAnalyserR = null;
    }
  }

  internalBypassNodes.add(postAnalyser);
  connectNode(tailNode, postAnalyser);
  connectNode(postAnalyser, ctx.destination);

  let gateOpen = true;
  let normTrimDb = 0;
  let lastInputLufs = -100;
  let lastSpectrumBins: number[] = Array.from({ length: SPECTRUM_BIN_COUNT }, () => -60);
  /** 대표 음압 구간([하한, 상한])으로 확정된 K-가중 블록 평균제곱(z_k) 슬라이딩 링 버퍼 */
  const zHistory: number[] = [];
  /** 급격한 음압 점프(스침) 판별을 위한 임시 진입 버퍼 */
  const tentativeBuffer: number[] = [];
  let consecutiveInBand = 0;
  let skippedLowBlocks = 0;

  function applyZeroReturnTension(zeroReturnRate: number): void {
    if (zeroReturnRate <= 0 || Math.abs(normTrimDb) < 0.005) {
      if (Math.abs(normTrimDb) < 0.005) normTrimDb = 0;
      return;
    }
    const stepDb = zeroReturnRate * TICK_SEC;
    if (normTrimDb > 0) {
      normTrimDb = Math.max(0, normTrimDb - stepDb);
    } else {
      normTrimDb = Math.min(0, normTrimDb + stepDb);
    }
    setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), GAIN_SMOOTH_TAU_SEC);
  }

  function syncStaticDsp(dsp: DspConfigPayload): void {
    currentPan = dsp.pan;
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

  function tickDynamicDsp(dsp: DspConfigPayload, isPlaying: boolean, siteVolume = 1.0): number {
    syncStaticDsp(dsp);
    const { meanSquare, rmsDb, blockLufs, peakDb } = measureBlockMeanSquare(preAnalyser, preBuffer);

    // 사이트 자체 볼륨 슬라이더(siteVolume)를 낮춘 사용자를 초저음량 음원으로 오판하지 않도록 원음 기준 음압 복원
    const clampedSiteVol = Math.max(0.05, Math.min(1, Number.isFinite(siteVolume) && siteVolume > 0 ? siteVolume : 1));
    const siteVolDbOffset = meanSquare > 0 ? 20 * Math.log10(clampedSiteVol) : 0;
    const intrinsicMeanSquare = meanSquare > 0 ? meanSquare / (clampedSiteVol * clampedSiteVol) : 0;
    const intrinsicLufs = meanSquare > 0 ? blockLufs - siteVolDbOffset : -100;
    const intrinsicPeakDb = meanSquare > 0 ? peakDb - siteVolDbOffset : -100;

    if (isPlaying && meanSquare > 0) {
      lastInputLufs = Math.round(intrinsicLufs * 10) / 10;
      lastSpectrumBins = extractSpectrumBins(
        preAnalyser,
        freqBuffer,
        lastInputLufs,
        typeof ctx.sampleRate === "number" && ctx.sampleRate > 0 ? ctx.sampleRate : 48000,
      );
    } else if (!isPlaying) {
      lastInputLufs = -100;
      lastSpectrumBins = Array.from({ length: SPECTRUM_BIN_COUNT }, () => -60);
    }

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

    // 2. 3-A 대표 음압 구간([하한, 상한] LUFS) + 0.0dB 회귀 텐션 + 스침 방지 체류 라우드니스 노멀라이저
    if (!dsp.normActive) {
      normTrimDb = Math.abs(normTrimDb) < 0.08 ? 0 : normTrimDb * 0.72;
      setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), 0.04);
      return Math.round(normTrimDb * 10) / 10;
    }

    if (!isPlaying) {
      return Math.round(normTrimDb * 10) / 10;
    }

    const lowLufs =
      typeof dsp.normRangeLowLufs === "number" ? dsp.normRangeLowLufs : ABSOLUTE_GATE_LUFS;
    const highLufs =
      typeof dsp.normRangeHighLufs === "number" ? Math.max(lowLufs + 4, dsp.normRangeHighLufs) : 0;
    const zeroReturnRate =
      typeof dsp.normZeroReturnRate === "number" ? Math.max(0, dsp.normZeroReturnRate) : 0.35;
    const minDwellBlocks =
      typeof dsp.normMinDwellBlocks === "number" ? Math.max(1, dsp.normMinDwellBlocks) : 1;
    const profile = NORM_BALLISTIC_PROFILES[dsp.normSpeed] ?? NORM_BALLISTIC_PROFILES.std;
    const maxBoostDb =
      typeof dsp.normMaxBoostDb === "number" ? dsp.normMaxBoostDb : profile.maxBoostDb;

    // Stage A: BS.1770 절대 무음(-55 LUFS) 미만은 완전 침묵 동결
    if (intrinsicLufs < ABSOLUTE_GATE_LUFS || intrinsicMeanSquare <= 0) {
      tentativeBuffer.length = 0;
      consecutiveInBand = 0;
      return Math.round(normTrimDb * 10) / 10;
    }

    // Stage B: 3-A 대표 음압 구간([lowLufs, highLufs]) 판별
    const belowBand = intrinsicLufs < lowLufs;
    const aboveBand = intrinsicLufs > highLufs;
    if (belowBand || aboveBand) {
      // 대표 구간을 잠깐 스쳐 지나가다 빠져나간 미확정 샘플은 폐기(스침 방지)
      tentativeBuffer.length = 0;
      consecutiveInBand = 0;
      if (aboveBand) {
        skippedLowBlocks = 0;
        if (normTrimDb > 0) {
          // 상한 초과(강주 폭발 fff): 이전 여린 구간에서 걸린 양수 부스트가 리미터를 때리지 않도록 즉시 0.0dB 텐션 복귀 작동
          applyZeroReturnTension(zeroReturnRate);
        }
      } else {
        // 하한 미달(여린 독주 ppp / 프리즈): 단기 호흡 유예(1.8s) 후 0.0dB 텐션 복귀 작동
        skippedLowBlocks++;
        if (skippedLowBlocks > LOW_HOLD_GRACE_BLOCKS) {
          applyZeroReturnTension(zeroReturnRate);
        }
      }
      return Math.round(normTrimDb * 10) / 10;
    }

    // 대표 구간 내라도 기존 확정 평균 대비 -10 LU 미만인 급격한 잔향/휴지기이면 동결 후 텐션 적용
    if (zHistory.length > 0) {
      let sumExisting = 0;
      for (let i = 0; i < zHistory.length; i++) sumExisting += zHistory[i]!;
      const relativeGateZ = (sumExisting / zHistory.length) * RELATIVE_GATE_LINEAR_RATIO;
      if (intrinsicMeanSquare < relativeGateZ) {
        tentativeBuffer.length = 0;
        consecutiveInBand = 0;
        skippedLowBlocks++;
        if (skippedLowBlocks > LOW_HOLD_GRACE_BLOCKS) {
          applyZeroReturnTension(zeroReturnRate);
        }
        return Math.round(normTrimDb * 10) / 10;
      }
    }

    consecutiveInBand++;
    skippedLowBlocks = 0;

    // 스침 방지(Minimum In-Band Dwell): 체류 조건(minDwellBlocks > 1)이 활성화된 상태에서
    // 빈 윈도우에 첫 진입 시 최소 연속 블록(TRANSIENT_CONFIRM_BLOCKS)에 도달하기 전까지는 임시 버퍼에만 보관
    const requiredConfirm = minDwellBlocks > 1 ? Math.min(TRANSIENT_CONFIRM_BLOCKS, minDwellBlocks) : 1;
    if (zHistory.length === 0 && consecutiveInBand < requiredConfirm) {
      tentativeBuffer.push(intrinsicMeanSquare);
      applyZeroReturnTension(zeroReturnRate);
      return Math.round(normTrimDb * 10) / 10;
    }

    if (tentativeBuffer.length > 0) {
      for (const tz of tentativeBuffer) {
        zHistory.push(tz);
      }
      tentativeBuffer.length = 0;
    }
    zHistory.push(intrinsicMeanSquare);
    const maxWindow = Math.max(MAX_GATE_HISTORY_BLOCKS, profile.windowBlocks);
    while (zHistory.length > maxWindow) {
      zHistory.shift();
    }

    // Stage C: 활성 계측 창에서 상대 게이트를 통과한 대표 블록 평균제곱 산출
    let sumAll = 0;
    for (let i = 0; i < zHistory.length; i++) sumAll += zHistory[i]!;
    const relativeGateZ = (sumAll / zHistory.length) * RELATIVE_GATE_LINEAR_RATIO;

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
    const maturity = minDwellBlocks > 1 ? Math.min(1, zHistory.length / minDwellBlocks) : 1;

    // 피크 헤드룸 가드(문제 2 해결): 양수 부스트가 말단 -1.0dBFS 안전 리미터(20:1)를 때려 음색을 찌그러뜨리지 않도록 상한 보호
    const safeHeadroomBoost =
      intrinsicPeakDb > -40 ? Math.max(0, -1.2 - intrinsicPeakDb) : maxBoostDb;
    const effectiveMaxBoost = Math.min(maxBoostDb, safeHeadroomBoost);

    const rawTargetTrimDb = Math.max(
      MIN_NORM_TRIM_DB,
      Math.min(effectiveMaxBoost, dsp.normTargetLufs - gatedLoudnessLufs),
    );
    const targetTrimDb = rawTargetTrimDb * maturity;

    // Stage D: 1차 지수 볼리스틱스 (감쇠 시 τ_attack, 증폭·복귀 시 τ_release)
    const tauSec = targetTrimDb < normTrimDb ? profile.attackTauSec : profile.releaseTauSec;
    const alpha = 1 - Math.exp(-TICK_SEC / tauSec);
    normTrimDb += alpha * (targetTrimDb - normTrimDb);
    normTrimDb = Math.max(MIN_NORM_TRIM_DB, Math.min(maxBoostDb, normTrimDb));

    setAudioParamSmooth(normGain.gain, ctx, dbToLinear(normTrimDb), GAIN_SMOOTH_TAU_SEC);
    return Math.round(normTrimDb * 10) / 10;
  }

  function readPostStereoVuRatio(): { left: number; right: number; mono: number } {
    const mono = computePeakRatioFromAnalyser(postAnalyser, postBuffer);
    if (postAnalyserL && postAnalyserR && postBufferL && postBufferR) {
      const left = computePeakRatioFromAnalyser(postAnalyserL, postBufferL);
      const right = computePeakRatioFromAnalyser(postAnalyserR, postBufferR);
      if (left > 0 || right > 0) {
        return { left, right, mono: Math.max(mono, left, right) };
      }
    }
    if (mono <= 0) return { left: 0, right: 0, mono: 0 };
    const clampedPan = Math.max(-100, Math.min(100, currentPan));
    if (clampedPan === 0) return { left: mono, right: mono, mono };
    const amp = Math.pow(10, (-60 + mono * 72) / 20);
    const gainL = clampedPan <= 0 ? 1 : Math.cos((clampedPan / 100) * (Math.PI / 2));
    const gainR = clampedPan >= 0 ? 1 : Math.cos((-clampedPan / 100) * (Math.PI / 2));
    return {
      left: gainL <= 0.001 ? 0 : dbToRatio(Math.min(12, linearToDb(amp * gainL))),
      right: gainR <= 0.001 ? 0 : dbToRatio(Math.min(12, linearToDb(amp * gainR))),
      mono,
    };
  }

  syncStaticDsp(initialDsp);

  return {
    ctx,
    inputNode,
    faderGain,
    postAnalyser,
    postBuffer,
    applyFaderGain: (targetGain: number, rampSec?: number) => {
      const tau = typeof rampSec === "number" && rampSec > 0 ? rampSec / 3 : GAIN_SMOOTH_TAU_SEC;
      setAudioParamSmooth(faderGain.gain, ctx, Math.max(0, targetGain), tau);
    },
    syncStaticDsp,
    tickDynamicDsp,
    notifyTrackTransition: () => {
      zHistory.length = 0;
      tentativeBuffer.length = 0;
      consecutiveInBand = 0;
      skippedLowBlocks = 0;
    },
    readPostVuRatio: () => computePeakRatioFromAnalyser(postAnalyser, postBuffer),
    readPostStereoVuRatio,
    getNormTrimDb: () => Math.round(normTrimDb * 10) / 10,
    getInputLufs: () => lastInputLufs,
    getSpectrumBins: () => lastSpectrumBins.slice(),
    dispose: () => {
      try { inputNode.disconnect(); } catch {}
      try { postAnalyser.disconnect(); } catch {}
      try { zeroSink.disconnect(); } catch {}
    },
  };
}
