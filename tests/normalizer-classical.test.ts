import assert from "node:assert/strict";
import test from "node:test";
import { MixerStateStore } from "../src/background/state-store";
import { createDspChain, DEFAULT_DSP_CONFIG } from "../src/content/dsp-chain";
import {
  buildDspConfigPayload, builtinParams, defaultChannelFx, defaultGlobalFx, sanitizeChannelFx,
} from "../src/shared/fx-model";
import type { AutoNormPreset, FxLayer } from "../src/shared/types";

/** "모든 채널" 노멀라이저를 기본 프리셋으로 맞춘 전역 층 */
function globalWith(key: AutoNormPreset): FxLayer {
  const g = defaultGlobalFx();
  g.norm = { ...g.norm, ...builtinParams(key), presetId: key };
  return g;
}

/**
 * 3-A 대표 음압 구간([하한, 상한] LUFS) · 0.0dB 회귀 텐션 · 스침 방지 체류(Dwell) ·
 * 저볼륨(siteVolume) 역보정 · 스테레오 2열(L/R) 미터링 및 2D/1D 시각화 토글 통합 검증 수트.
 */

const BS1770_OFFSET_DB = -0.691;

function lufsToAmplitude(lufs: number): number {
  const powerDb = lufs - BS1770_OFFSET_DB;
  return Math.pow(10, powerDb / 20);
}

function createTestDspHarness() {
  let currentAmplitude = 0;
  let customFreqSeeder: ((buf: Float32Array) => void) | null = null;

  class MockAudioNode {
    connect(dest: unknown): unknown {
      return dest;
    }
  }

  class MockGainNode extends MockAudioNode {
    gain = {
      value: 1,
      cancelScheduledValues: () => {},
      setTargetAtTime: (target: number) => {
        this.gain.value = target;
      },
    };
  }

  class MockAnalyserNode extends MockAudioNode {
    fftSize = 2048;
    getFloatTimeDomainData(buf: Float32Array): void {
      buf.fill(currentAmplitude);
    }
    getFloatFrequencyData(buf: Float32Array): void {
      if (customFreqSeeder) {
        customFreqSeeder(buf);
        return;
      }
      const db = currentAmplitude <= 1e-5 ? -100 : 20 * Math.log10(currentAmplitude);
      buf.fill(db);
    }
  }

  class MockBiquadFilterNode extends MockAudioNode {
    type = "highpass";
    frequency = { value: 0 };
    Q = { value: 0.5 };
    gain = { value: 0 };
  }

  class MockDynamicsCompressorNode extends MockAudioNode {
    threshold = { value: -20 };
    knee = { value: 12 };
    ratio = { value: 4 };
    attack = { value: 0.008 };
    release = { value: 0.16 };
  }

  class MockStereoPannerNode extends MockAudioNode {
    pan = {
      value: 0,
      cancelScheduledValues: () => {},
      setTargetAtTime: (target: number) => {
        this.pan.value = target;
      },
    };
  }

  const ctx = {
    currentTime: 0,
    destination: {},
    createGain: () => new MockGainNode(),
    createAnalyser: () => new MockAnalyserNode(),
    createBiquadFilter: () => new MockBiquadFilterNode(),
    createDynamicsCompressor: () => new MockDynamicsCompressorNode(),
    createStereoPanner: () => new MockStereoPannerNode(),
  } as unknown as AudioContext;

  const chain = createDspChain(ctx, 1.0, DEFAULT_DSP_CONFIG, new WeakSet());

  return {
    chain,
    setLufs: (lufs: number) => {
      currentAmplitude = lufs <= -90 ? 0 : lufsToAmplitude(lufs);
    },
    setAmplitude: (amp: number) => {
      currentAmplitude = amp;
    },
    setFreqSeeder: (fn: ((buf: Float32Array) => void) | null) => {
      customFreqSeeder = fn;
    },
  };
}

test("시나리오 1: 클래식 교향곡(여린 도입부 20s -> 중위 주선율 15s -> 강주 폭발 12s -> 여린 독주 18s)에서 3-A 대표 구간과 0.0dB 회귀 텐션 검증", () => {
  const { chain, setLufs } = createTestDspHarness();
  const classicalDsp = buildDspConfigPayload(globalWith("classical"), 0, defaultChannelFx(), false);

  // 1) 여린 도입부 ppp (-38.0 LUFS, 20초 = 267틱): 대표 구간([-28..-13]) 하한 미달이므로 억지 증폭 없이 0.0dB 유지
  setLufs(-38.0);
  for (let i = 0; i < 267; i++) {
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  assert.equal(chain.getNormTrimDb(), 0, "여린 도입부(ppp)는 대표 구간 밖이므로 0.0dB를 유지해야 함");

  // 2) 중위 주선율 mp~mf (-21.0 LUFS, 15초 = 200틱): 대표 구간 안이므로 목표(-16 LUFS)를 향해 완만히 양수 보정
  setLufs(-21.0);
  for (let i = 0; i < 200; i++) {
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  const midTrim = chain.getNormTrimDb();
  assert.ok(midTrim >= 2.5 && midTrim <= 4.0, `중위 주선율은 +2.5~+4.0dB 범위로 보정되어야 함 (실측: ${midTrim}dB)`);

  // 3) 금관·팀파니 강주 폭발 fff (-7.0 LUFS, 12초 = 160틱):
  // 상한(-13 LUFS) 초과 아웃라이어이므로 음수(-9dB)로 찍어 누르지 않고 0.0dB 회귀 텐션에 의해 0.0dB로 복귀
  setLufs(-7.0);
  for (let i = 0; i < 160; i++) {
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  const tuttiTrim = chain.getNormTrimDb();
  assert.equal(tuttiTrim, 0, `강주 폭발(fff) 후에는 찍어 누르지 않고 0.0dB 원음 볼륨으로 복귀해야 함 (실측: ${tuttiTrim}dB)`);

  // 4) 강주 직후 고요한 목관 독주 pp (-36.0 LUFS, 18초 = 240틱):
  // 이전 강주 때문에 음수 게인이 동결되는 현상 없이 0.0dB 그대로 원음 독주를 유지
  setLufs(-36.0);
  for (let i = 0; i < 240; i++) {
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  assert.equal(chain.getNormTrimDb(), 0, "강주 직후 여린 독주(pp)에서도 0.0dB 원음 상태를 유지해야 함");
});

test("시나리오 2: 여린 소리(-38 LUFS) 15초 후 0.3초 만에 강주(-7 LUFS)로 급상승할 때 대표 구간 스침 방지(Minimum Dwell) 검증", () => {
  const { chain, setLufs } = createTestDspHarness();
  const classicalDsp = buildDspConfigPayload(globalWith("classical"), 0, defaultChannelFx(), false);

  // 1) 15초(200틱) 동안 -38 LUFS 여린 현악
  setLufs(-38.0);
  for (let i = 0; i < 200; i++) {
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  assert.equal(chain.getNormTrimDb(), 0);

  // 2) 0.3초(4틱) 동안 -38 LUFS -> -7 LUFS 급상승 (중간 2틱이 [-28..-13] 구간을 스쳐 지나감)
  const rampLufs = [-38.0, -27.7, -17.3, -7.0];
  for (const lufs of rampLufs) {
    setLufs(lufs);
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  assert.equal(
    chain.getNormTrimDb(),
    0,
    "0.3초 급상승 중 대표 구간을 스쳐 지나간 미확정 샘플에 의해 게인이 튀지 않아야 함",
  );

  // 3) 이어지는 10초(133틱) 대폭발 투티(-7 LUFS)에서도 0.0dB 유지
  setLufs(-7.0);
  for (let i = 0; i < 133; i++) {
    chain.tickDynamicDsp(classicalDsp, true, 1.0);
  }
  assert.equal(chain.getNormTrimDb(), 0);
});

test("시나리오 3: 목표 음압을 -20 LUFS로 낮춘 상태에서 평범한 음원(-14 LUFS) 재생 시 3-A 절대 대표 구간 정상 감쇠 검증", () => {
  const { chain, setLufs } = createTestDspHarness();
  // 1.1.0 "개별 ON" 세션을 그대로 넣어 새 구조 변환까지 함께 확인한다
  const customQuietFx = {
    pan: 0,
    normMode: "on" as const,
    normTargetLufs: -20,
    normSpeed: "std" as const,
    normRangeLowLufs: -32,
    normRangeHighLufs: -10,
    normZeroReturnRate: 0.35,
  };
  const dsp = buildDspConfigPayload(defaultGlobalFx(), 0, sanitizeChannelFx(customQuietFx), false);

  // -14.0 LUFS 평범한 음원은 목표 음압이 -20 LUFS로 낮아져도 3-A 절대 구간([-32..-10]) 안에 정상 포함됨
  setLufs(-14.0);
  for (let i = 0; i < 200; i++) {
    chain.tickDynamicDsp(dsp, true, 1.0);
  }
  const trim = chain.getNormTrimDb();
  assert.ok(
    trim <= -5.5 && trim >= -6.2,
    `목표 -20 LUFS에서 -14 LUFS 입력은 약 -6.0dB 감쇠되어야 함 (실측: ${trim}dB)`,
  );
});

test("시나리오 4: 사이트 자체 볼륨(siteVolume=0.2, -14dB)을 낮춰 듣는 사용자에게 억지 부스트가 걸리지 않는 역보정 검증", () => {
  const { chain, setLufs } = createTestDspHarness();
  const musicDsp = buildDspConfigPayload(globalWith("music"), 0, defaultChannelFx(), false);

  // 원음은 -16.0 LUFS 정석 음원인데, 사용자가 사이트 플레이어 볼륨을 20%(0.2배, -14dB)로 줄여 놓아
  // 실제 WebAudio 입구(preAnalyser)에는 -30.0 LUFS로 줄어든 파형이 유입되는 상황
  setLufs(-30.0);
  for (let i = 0; i < 160; i++) {
    chain.tickDynamicDsp(musicDsp, true, 0.2);
  }

  // siteVolume(0.2) 역보정에 의해 원음(-16.0 LUFS)으로 정확히 인식하므로 불필요한 +6dB 부스트를 걸지 않고 0.0dB 유지
  assert.ok(
    Math.abs(chain.getNormTrimDb()) <= 0.2,
    `사이트 볼륨을 낮춘 사용자의 정상 음원(-16 LUFS)에 억지 부스트를 걸지 않아야 함 (실측: ${chain.getNormTrimDb()}dB)`,
  );
  assert.ok(
    Math.abs(chain.getInputLufs() - -16.0) <= 0.3,
    `복원된 입력 음압은 원음 기준 -16.0 LUFS여야 함 (실측: ${chain.getInputLufs()} LUFS)`,
  );
});

test("시나리오 5: 기본 ON(음악 모드) 초기값, 4종 프리셋(클래식 포함), 2D/1D 시각화 모드 토글 및 스테레오 L/R 미터 검증", () => {
  const store = new MixerStateStore();
  // 1-A: 기본 상태는 모든 채널 노멀라이저 켜짐 · 음악 프리셋 · normVizMode === "spectrum2d"
  assert.equal(store.getSettings().globalFx.norm.enabled, true);
  assert.equal(store.getSettings().globalFx.norm.presetId, "music");
  assert.equal(store.getSettings().normVizMode, "spectrum2d");

  // 2D 스펙트럼 <-> 1D 수평 구간 토글 및 영속 복원 검증
  store.setNormVizMode("bar1d");
  assert.equal(store.getSettings().normVizMode, "bar1d");
  store.hydrateSettings({ normVizMode: "spectrum2d", autoNormPreset: "classical" });
  assert.equal(store.getSettings().normVizMode, "spectrum2d");
  // 1.1.0 설정(autoNormPreset)은 모든 채널 노멀라이저로 옮겨진다
  assert.equal(store.getSettings().globalFx.norm.presetId, "classical");
  assert.equal(store.getSettings().globalFx.norm.minDwellBlocks, 24);

  // 6-A: 패닝 적용 시 스테레오 L/R VU 비율 분리 검증
  const { chain, setAmplitude } = createTestDspHarness();
  setAmplitude(0.25);
  chain.syncStaticDsp({ ...DEFAULT_DSP_CONFIG, pan: -60 });
  const stereoLeft = chain.readPostStereoVuRatio();
  assert.ok(stereoLeft.left > stereoLeft.right, "좌측 패닝(-60) 시 L 미터가 R 미터보다 높아야 함");

  chain.syncStaticDsp({ ...DEFAULT_DSP_CONFIG, pan: 60 });
  const stereoRight = chain.readPostStereoVuRatio();
  assert.ok(stereoRight.right > stereoRight.left, "우측 패닝(+60) 시 R 미터가 L 미터보다 높아야 함");

  // 주파수 스펙트럼 추출 검증: 베이킹된 고정 파형 없이 실제 FFT 대역 분포(저역 vs 고역)에 따라 모양이 달라지는지 확인
  const { chain: specChain, setLufs, setFreqSeeder } = createTestDspHarness();
  setLufs(-18.0);
  // 1) 저역(인덱스 1..20)에 에너지가 집중된 경우
  setFreqSeeder((buf) => {
    buf.fill(-95);
    for (let i = 1; i <= 20; i++) buf[i] = -38;
  });
  specChain.tickDynamicDsp(DEFAULT_DSP_CONFIG, true, 1.0);
  const bassBins = specChain.getSpectrumBins();
  assert.ok(
    bassBins[2]! > bassBins[13]! + 15,
    `저역 집중 신호에서는 저역 밴드가 고역 밴드보다 현저히 높아야 함 (low=${bassBins[2]}, high=${bassBins[13]})`,
  );

  // 2) 고역(인덱스 200..600)에 에너지가 집중된 경우
  setFreqSeeder((buf) => {
    buf.fill(-95);
    for (let i = 200; i <= 600; i++) buf[i] = -38;
  });
  specChain.tickDynamicDsp(DEFAULT_DSP_CONFIG, true, 1.0);
  const trebleBins = specChain.getSpectrumBins();
  assert.ok(
    trebleBins[13]! > trebleBins[2]! + 15,
    `고역 집중 신호에서는 고역 밴드가 저역 밴드보다 현저히 높아야 함 (low=${trebleBins[2]}, high=${trebleBins[13]})`,
  );
});
