import assert from "node:assert/strict";
import test from "node:test";
import { installAudioHook } from "../src/content/audio-hook";

/**
 * 모의 브라우저 환경에서 audio-hook의 CORS/DRM 무음 방지 폴백, WebAudio 증폭(+12dB),
 * 실시간 DSP 체인(다이나믹 노멀라이저 · 무음 동결 Silence Freeze · 스테레오 패닝) 동작을 검증한다.
 */

function createMockAudioEnvironment() {
  let mediaElementSourceCalls = 0;
  let sampleAmplitude = 0.25;
  const createdGains: Array<{ value: number; lastTau: number }> = [];
  const createdPanners: Array<{ value: number }> = [];

  class FakeMediaElement {
    private _rawVolume = 1.0;
    paused = true;
    ended = false;
    muted = false;
    currentTime = 1.5;
    readyState = 4;
    currentSrc = "";
    crossOrigin: string | null = null;
    mediaKeys: unknown = null;
    srcObject: unknown = null;
    isConnected = true;
    private attrs = new Map<string, string>();
    private listeners = new Map<string, Set<EventListener>>();

    get volume(): number {
      return this._rawVolume;
    }
    set volume(v: number) {
      this._rawVolume = v;
    }
    getRawUnderlyingVolume(): number {
      return this._rawVolume;
    }
    getAttribute(name: string): string | null {
      return this.attrs.get(name) ?? null;
    }
    setAttribute(name: string, val: string): void {
      this.attrs.set(name, val);
    }
    addEventListener(type: string, cb: EventListener): void {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type)!.add(cb);
    }
    emit(type: string): void {
      this.listeners.get(type)?.forEach((cb) => cb({} as Event));
    }
    async play(): Promise<void> {
      this.paused = false;
      this.emit("play");
    }
    pause(): void {
      this.paused = true;
      this.emit("pause");
    }
  }

  class FakeAudioNode {
    context: FakeAudioContext;
    connectedTargets: unknown[] = [];
    constructor(ctx: FakeAudioContext) {
      this.context = ctx;
    }
    connect(dest: unknown): unknown {
      this.connectedTargets.push(dest);
      return dest;
    }
  }

  class FakeGainNode extends FakeAudioNode {
    gain: {
      value: number;
      cancelScheduledValues: () => void;
      setTargetAtTime: (target: number, startTime?: number, timeConstant?: number) => void;
    };
    constructor(ctx: FakeAudioContext) {
      super(ctx);
      const state = { value: 1.0, lastTau: 0 };
      createdGains.push(state);
      this.gain = {
        get value() {
          return state.value;
        },
        set value(v: number) {
          state.value = v;
        },
        cancelScheduledValues: () => {},
        setTargetAtTime: (target: number, _startTime = 0, timeConstant = 0) => {
          state.value = target;
          state.lastTau = timeConstant;
        },
      };
    }
  }

  class FakeAnalyserNode extends FakeAudioNode {
    fftSize = 256;
    getFloatTimeDomainData(buf: Float32Array): void {
      buf.fill(sampleAmplitude);
    }
  }

  class FakeBiquadFilterNode extends FakeAudioNode {
    type = "highpass";
    frequency = { value: 60 };
    Q = { value: 0.5 };
    gain = { value: 0 };
  }

  class FakeDynamicsCompressorNode extends FakeAudioNode {
    threshold = { value: -24 };
    knee = { value: 30 };
    ratio = { value: 12 };
    attack = { value: 0.003 };
    release = { value: 0.25 };
  }

  class FakeStereoPannerNode extends FakeAudioNode {
    pan: {
      value: number;
      cancelScheduledValues: () => void;
      setTargetAtTime: (target: number) => void;
    };
    constructor(ctx: FakeAudioContext) {
      super(ctx);
      const state = { value: 0 };
      createdPanners.push(state);
      this.pan = {
        get value() {
          return state.value;
        },
        set value(v: number) {
          state.value = v;
        },
        cancelScheduledValues: () => {},
        setTargetAtTime: (target: number) => {
          state.value = target;
        },
      };
    }
  }

  class FakeAudioContext {
    state: AudioContextState = "running";
    currentTime = 0;
    destination = { kind: "real-destination" };
    addEventListener(): void {}
    async resume(): Promise<void> {
      this.state = "running";
    }
    async suspend(): Promise<void> {
      this.state = "suspended";
    }
    createMediaElementSource(_el: unknown): FakeAudioNode {
      mediaElementSourceCalls++;
      return new FakeAudioNode(this);
    }
    createGain(): FakeGainNode {
      return new FakeGainNode(this);
    }
    createAnalyser(): FakeAnalyserNode {
      return new FakeAnalyserNode(this);
    }
    createBiquadFilter(): FakeBiquadFilterNode {
      return new FakeBiquadFilterNode(this);
    }
    createDynamicsCompressor(): FakeDynamicsCompressorNode {
      return new FakeDynamicsCompressorNode(this);
    }
    createStereoPanner(): FakeStereoPannerNode {
      return new FakeStereoPannerNode(this);
    }
  }

  const docListeners = new Map<string, Set<EventListener>>();
  const fakeWindow = {
    __SOUND_MANAGER_SKIP_AUTO_INSTALL__: true,
    location: { href: "https://www.youtube.com/watch?v=1", origin: "https://www.youtube.com" },
    navigator: { mediaSession: { metadata: { title: "테스트 스트림" } } },
    HTMLMediaElement: FakeMediaElement,
    Element: class {},
    AudioNode: FakeAudioNode,
    AudioContext: FakeAudioContext,
    CustomEvent: class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    MutationObserver: class {
      observe(): void {}
      disconnect(): void {}
    },
    document: {
      readyState: "complete",
      documentElement: { querySelectorAll: () => [] },
      querySelectorAll: () => [],
      addEventListener(type: string, cb: EventListener) {
        if (!docListeners.has(type)) docListeners.set(type, new Set());
        docListeners.get(type)!.add(cb);
      },
      removeEventListener(type: string, cb: EventListener) {
        docListeners.get(type)?.delete(cb);
      },
      dispatchEvent(ev: { type: string }) {
        docListeners.get(ev.type)?.forEach((cb) => cb(ev as unknown as Event));
        return true;
      },
    },
  };

  return {
    win: fakeWindow as unknown as Window & typeof globalThis,
    FakeMediaElement,
    FakeAudioNode,
    getMediaElementSourceCalls: () => mediaElementSourceCalls,
    createdGains,
    createdPanners,
    setSampleAmplitude: (val: number) => {
      sampleAmplitude = val;
    },
  };
}

test("동일 출처 및 MSE(blob:) 미디어는 WebAudio GainNode로 +12dB(약 3.98배) 증폭된다", async () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  const mseVideo = new env.FakeMediaElement();
  mseVideo.currentSrc = "blob:https://www.youtube.com/9912-abcd";
  mseVideo.volume = 0.8;
  await mseVideo.play();

  assert.equal(env.getMediaElementSourceCalls(), 1);
  controller.dispatchCommand({ type: "APPLY_GAIN", targetGain: 3.98 });

  // 사이트 슬라이더 볼륨(0.8)은 보존되고 GainNode가 3.98배 증폭을 담당
  assert.equal(mseVideo.volume, 0.8);
  assert.equal(mseVideo.getRawUnderlyingVolume(), 0.8);
  assert.equal(env.createdGains[0]?.value, 3.98);
  assert.equal(controller.getSnapshot().corsRestricted, false);

  controller.dispose();
});

test("교차 출처(CORS 미설정) 및 DRM(mediaKeys) 영상은 소리 끊김 없이 네이티브 볼륨 폴백으로 동작한다", async () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  const crossOriginVideo = new env.FakeMediaElement();
  crossOriginVideo.currentSrc = "https://cdn.external-host.net/live.mp4";
  crossOriginVideo.crossOrigin = null;
  crossOriginVideo.volume = 0.8;
  await crossOriginVideo.play();

  const drmVideo = new env.FakeMediaElement();
  drmVideo.currentSrc = "blob:https://www.youtube.com/drm-stream";
  drmVideo.mediaKeys = { keySystem: "com.widevine.alpha" };
  await drmVideo.play();

  // createMediaElementSource가 단 한 번도 호출되지 않아 오디오 무음 현상이 원천 차단됨
  assert.equal(env.getMediaElementSourceCalls(), 0);
  assert.equal(controller.getSnapshot().corsRestricted, true);

  // +6dB(2.0배) 요청 시 1.0배(0dB) 상한으로 클램핑
  controller.dispatchCommand({ type: "APPLY_GAIN", targetGain: 2.0 });
  assert.equal(crossOriginVideo.volume, 0.8);
  assert.ok(Math.abs(crossOriginVideo.getRawUnderlyingVolume() - 0.8) < 1e-6);

  // Focus 감쇠(-12dB ≈ 0.25배) 요청 시 사이트에 보이는 volume은 0.8로 유지하면서 실제 출력만 0.20으로 감쇠
  controller.dispatchCommand({ type: "APPLY_GAIN", targetGain: 0.25 });
  assert.equal(crossOriginVideo.volume, 0.8);
  assert.ok(Math.abs(crossOriginVideo.getRawUnderlyingVolume() - 0.2) < 1e-6);

  controller.dispose();
});

test("페이지 자체 AudioContext.destination 직결 노드는 버스 GainNode를 거쳐 제어된다", () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  const pageCtx = new env.win.AudioContext();
  const osc = new env.FakeAudioNode(pageCtx as never);
  osc.connect(pageCtx.destination);

  controller.dispatchCommand({ type: "APPLY_GAIN", targetGain: 0.5 });
  const snap = controller.getSnapshot();
  assert.equal(snap.hasMedia, true);
  assert.equal(snap.playingCount, 1);
  assert.equal(env.createdGains[0]?.value, 0.5);

  controller.dispose();
});

test("APPLY_DSP: normActive 활성화 시 저음량 신호 자동 증폭(normTrimDb > 0) 및 무음 동결(Silence Freeze) 검증", async () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  const video = new env.FakeMediaElement();
  video.currentSrc = "blob:https://www.youtube.com/quiet-voice";
  video.volume = 1.0;
  await video.play();

  // 1) 0.05 저음량 신호(약 -26dBFS): normActive 활성화 후 tick 수행 시 목표 음압(-16 LUFS)을 향해 이득 상향 보정 (normTrimDb > 0)
  env.setSampleAmplitude(0.05);
  controller.dispatchCommand({
    type: "APPLY_DSP",
    dsp: {
      normActive: true,
      normTargetLufs: -16,
      normSpeed: "std",
      pan: 0,
      gateEnabled: false,
      gateThresholdDb: -48,
      compEnabled: false,
      compRatio: 4,
    },
  });

  controller.stepTick();
  const snapAfterTick = controller.getSnapshot();
  assert.ok(
    snapAfterTick.normTrimDb > 0,
    `Active quiet signal should boost trim > 0 dB, got ${snapAfterTick.normTrimDb}`,
  );
  const activeTrim = snapAfterTick.normTrimDb;

  // 2) 거의 무음인 배경 신호(0.0005 진폭, 약 -66dBFS < -45dBFS Silence Freeze)
  // 대사 휴지기나 곡 사이 무음에서 배경 히스 잡음이 펌핑 증폭되지 않도록 normTrimDb가 동결 유지됨
  env.setSampleAmplitude(0.0005);
  controller.stepTick();
  controller.stepTick();
  const snapAfterSilence = controller.getSnapshot();
  assert.equal(
    snapAfterSilence.normTrimDb,
    activeTrim,
    "Silence Freeze should preserve trim without boosting hiss",
  );

  controller.dispose();
});

test("APPLY_DSP: 스테레오 패닝(pan: -50 -> -0.5) 설정 및 normActive 해제 시 normTrimDb 0dB 즉시 리셋 검증", async () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  const video = new env.FakeMediaElement();
  video.currentSrc = "blob:https://www.youtube.com/stereo-track";
  video.volume = 1.0;
  await video.play();

  env.setSampleAmplitude(0.05);

  // 1) pan: -50, normActive: true 적용
  controller.dispatchCommand({
    type: "APPLY_DSP",
    dsp: {
      normActive: true,
      normTargetLufs: -16,
      normSpeed: "std",
      pan: -50,
      gateEnabled: false,
      gateThresholdDb: -48,
      compEnabled: false,
      compRatio: 4,
    },
  });
  controller.stepTick();

  assert.ok(env.createdPanners.length > 0);
  assert.equal(env.createdPanners[0]?.value, -0.5);
  assert.ok(controller.getSnapshot().normTrimDb > 0);

  // 2) normActive: false 해제 시 패닝(-0.5)은 유지되고 normTrimDb는 0.0dB로 즉시 리셋
  controller.dispatchCommand({
    type: "APPLY_DSP",
    dsp: {
      normActive: false,
      normTargetLufs: -16,
      normSpeed: "std",
      pan: -50,
      gateEnabled: false,
      gateThresholdDb: -48,
      compEnabled: false,
      compRatio: 4,
    },
  });
  controller.stepTick();

  assert.equal(env.createdPanners[0]?.value, -0.5);
  assert.equal(controller.getSnapshot().normTrimDb, 0);

  controller.dispose();
});

test("보조 AudioContext('running')가 있어도 HTML 미디어가 일시정지면 playingCount=0 · pausedCount=1을 보고한다", async () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  const ytMusicVideo = new env.FakeMediaElement();
  ytMusicVideo.currentSrc = "blob:https://music.youtube.com/track-1";
  await ytMusicVideo.play();
  ytMusicVideo.pause();

  // 사이트 보조 AudioContext가 상시 running 상태로 destination에 연결되어 있는 상황 재현
  const auxCtx = new env.win.AudioContext();
  const auxNode = new env.FakeAudioNode(auxCtx as never);
  auxNode.connect(auxCtx.destination);

  const snap = controller.getSnapshot();
  assert.equal(snap.hasMedia, true);
  assert.equal(snap.playingCount, 0);
  assert.equal(snap.pausedCount, 1);

  controller.dispose();
});

test("SET_PLAYING(true): 분리된 더미 오디오 요소를 건너뛰고 최근 활성 미디어 재생과 일시중단된 AudioContext.resume()을 함께 수행한다", async () => {
  const env = createMockAudioEnvironment();
  const controller = installAudioHook(env.win);

  // 먼저 등록된 뒤 DOM에서 떨어져 나간 더미 요소
  const deadAudio = new env.FakeMediaElement();
  deadAudio.currentSrc = "";
  deadAudio.readyState = 0;
  await deadAudio.play();
  deadAudio.pause();
  deadAudio.isConnected = false;

  // 실제 곡을 재생하다가 일시정지된 활성 미디어 요소
  const liveVideo = new env.FakeMediaElement();
  liveVideo.currentSrc = "blob:https://music.youtube.com/live-song";
  await liveVideo.play();
  liveVideo.pause();

  const pageCtx = new env.win.AudioContext();
  const osc = new env.FakeAudioNode(pageCtx as never);
  osc.connect(pageCtx.destination);
  await pageCtx.suspend();
  assert.equal(pageCtx.state, "suspended");

  controller.dispatchCommand({ type: "SET_PLAYING", shouldPlay: true });
  await Promise.resolve();

  assert.equal(liveVideo.paused, false);
  assert.equal(pageCtx.state, "running");
  assert.equal(controller.getSnapshot().playingCount, 1);

  controller.dispose();
});

test("BS.1770/EBU 3341 노멀라이저: 완만(9s) 창은 후렴 다이내믹을 보존하고, 상대 게이트(-10 LU)는 프리즈 구간 과증폭을 차단한다", async () => {
  const runChorusScenario = async (normSpeed: "slow" | "fast"): Promise<{ introTrim: number; chorusTrim: number }> => {
    const env = createMockAudioEnvironment();
    const controller = installAudioHook(env.win);
    const audio = new env.FakeMediaElement();
    audio.currentSrc = "blob:https://music.youtube.com/dynamic-song";
    await audio.play();

    controller.dispatchCommand({
      type: "APPLY_DSP",
      dsp: {
        normActive: true,
        normTargetLufs: -16,
        normSpeed,
        pan: 0,
        gateEnabled: false,
        gateThresholdDb: -48,
        compEnabled: false,
        compRatio: 4,
      },
    });

    // 조용한 도입부(-24 dBFS 수준, 진폭 ~0.063) 20틱 진행
    env.setSampleAmplitude(0.063);
    for (let i = 0; i < 20; i++) controller.stepTick();
    const introTrim = controller.getSnapshot().normTrimDb;

    // 의도된 후렴구 폭발(-11 dBFS 수준, 진폭 ~0.28) 4틱 직후 비교
    env.setSampleAmplitude(0.28);
    for (let i = 0; i < 4; i++) controller.stepTick();
    const chorusTrim = controller.getSnapshot().normTrimDb;

    controller.dispose();
    return { introTrim, chorusTrim };
  };

  const slowMusicRes = await runChorusScenario("slow");
  const fastNightRes = await runChorusScenario("fast");

  assert.ok(slowMusicRes.introTrim <= 6.0);
  assert.ok(Math.abs(slowMusicRes.introTrim - slowMusicRes.chorusTrim) < 1.2);
  assert.ok(fastNightRes.introTrim - fastNightRes.chorusTrim > 3.5);

  // 곡 중간 프리즈(잔향 -32 dBFS, 24틱 ≈ 1.8초) 후 드럼 강타(-6 dBFS) 시나리오:
  // ITU-R BS.1770-4 -10 LU 상대 게이트에 의해 프리즈 동안 게인이 단 0.1dB도 치솟지 않아 직후 드럼이 폭음으로 튀지 않음
  for (const speed of ["slow", "std", "fast"] as const) {
    const env = createMockAudioEnvironment();
    const controller = installAudioHook(env.win);
    const audio = new env.FakeMediaElement();
    audio.currentSrc = `blob:https://music.youtube.com/freeze-${speed}`;
    await audio.play();
    env.setSampleAmplitude(0.224); // -13 dBFS 일반 연주 구간
    controller.dispatchCommand({
      type: "APPLY_DSP",
      dsp: {
        normActive: true,
        normTargetLufs: -16,
        normSpeed: speed,
        pan: 0,
        gateEnabled: false,
        gateThresholdDb: -48,
        compEnabled: false,
        compRatio: 4,
      },
    });
    for (let i = 0; i < 20; i++) controller.stepTick();
    const beforeFreezeTrim = controller.getSnapshot().normTrimDb;

    env.setSampleAmplitude(0.025); // -32 dBFS 프리즈·리버브 잔향 (절대 무음 게이트보다 크지만 -10 LU 상대 게이트 미만)
    for (let i = 0; i < 24; i++) controller.stepTick();
    const endOfFreezeTrim = controller.getSnapshot().normTrimDb;
    assert.equal(endOfFreezeTrim, beforeFreezeTrim, `Freeze must not boost gain in mode=${speed}`);

    env.setSampleAmplitude(0.5); // -6 dBFS 드럼 강타 복귀 -> 증폭 없이 즉시 감쇠 방향으로 반응
    controller.stepTick();
    assert.ok(controller.getSnapshot().normTrimDb <= beforeFreezeTrim);
    controller.dispose();
  }
});

test("0.9.0 보안 0dB 폴백 탭 결정론적 레벨 표시(가짜 난수 미터 제거) 및 Solo 해제 완만 복귀(rampSec: 0.3) 검증", async () => {
  // 1) CORS 폴백 미디어의 연속 실행 레벨이 난수 흔들림 없이 완전히 동일한 결정론적 수열을 내는지 검증
  const runCorsVu = async (): Promise<number[]> => {
    const envCors = createMockAudioEnvironment();
    const ctrlCors = installAudioHook(envCors.win);
    try {
      const corsVideo = new envCors.FakeMediaElement();
      corsVideo.currentSrc = "https://cdn.external-host.example/stream.mp4";
      corsVideo.crossOrigin = null;
      corsVideo.volume = 0.75;
      await corsVideo.play();

      ctrlCors.dispatchCommand({ type: "SET_METERING", active: true });
      ctrlCors.dispatchCommand({ type: "APPLY_GAIN", targetGain: 0.8 });
      const seq: number[] = [];
      for (let i = 0; i < 6; i++) {
        ctrlCors.stepTick();
        seq.push(ctrlCors.getSnapshot().vuLevel);
      }
      return seq;
    } finally {
      ctrlCors.dispose();
    }
  };

  const seqA = await runCorsVu();
  const seqB = await runCorsVu();
  assert.ok(seqA[5]! > 0);
  assert.deepEqual(seqA, seqB, "CORS fallback VU sequence must be 100% deterministic without Math.random()");

  // 2) 마지막 Solo 탭이 닫힐 때 전달되는 rampSec: 0.3 이 시정수 tau = 0.1s 로 스케줄링되는지 검증
  const envWebAudio = createMockAudioEnvironment();
  const ctrlWebAudio = installAudioHook(envWebAudio.win);
  try {
    const mseAudio = new envWebAudio.FakeMediaElement();
    mseAudio.currentSrc = "blob:https://www.youtube.com/solo-release";
    await mseAudio.play();

    ctrlWebAudio.dispatchCommand({ type: "APPLY_GAIN", targetGain: 1.0, rampSec: 0.3 });
    assert.ok(Math.abs((envWebAudio.createdGains[0]?.lastTau ?? 0) - 0.1) < 1e-6);
  } finally {
    ctrlWebAudio.dispose();
  }
});
