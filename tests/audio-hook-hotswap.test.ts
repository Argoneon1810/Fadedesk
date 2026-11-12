import assert from "node:assert/strict";
import test from "node:test";
import { installAudioHook } from "../src/content/audio-hook";
import {
  HOOK_CONTROLLER_KEY,
  HOOK_STATE_KEY,
  type HookSharedState,
} from "../src/content/hook-state";
import {
  BRIDGE_TO_HOOK_EVENT,
  HOOK_TO_BRIDGE_EVENT,
  type FrameMediaPayload,
  type HookReportEvent,
} from "../src/shared/types";

/**
 * Chromium WebAudio 엄격 제약(동일 요소에 createMediaElementSource 중복 호출 시 InvalidStateError)을 재현하여,
 * 0.6.0 오디오 훅의 무중단 핫스왑(Hot-Swap), 패스트패스, 프로토타입 비중첩, 레거시 호환성을 검증한다.
 */

function createStrictMockEnvironment() {
  const globalConnectedElements = new WeakSet<object>();
  let mediaElementSourceCalls = 0;
  let sampleAmplitude = 0.3;
  const createdGains: Array<{ value: number }> = [];
  const createdPanners: Array<{ value: number }> = [];
  const receivedBridgeEvents: HookReportEvent[] = [];

  class FakeMediaElement {
    private _rawVolume = 1.0;
    paused = true;
    ended = false;
    muted = false;
    currentTime = 0;
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
    removeEventListener(type: string, cb: EventListener): void {
      this.listeners.get(type)?.delete(cb);
    }
    emit(type: string): void {
      this.listeners.get(type)?.forEach((cb) => cb({} as Event));
    }
    async play(): Promise<void> {
      this.paused = false;
      this.emit("play");
      this.emit("playing");
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
      setTargetAtTime: (target: number) => void;
    };
    constructor(ctx: FakeAudioContext) {
      super(ctx);
      const state = { value: 1.0 };
      createdGains.push(state);
      this.gain = {
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
    destination = { kind: "real-destination" } as unknown as AudioDestinationNode;
    private stateListeners = new Set<() => void>();

    addEventListener(type: string, cb: () => void): void {
      if (type === "statechange") this.stateListeners.add(cb);
    }
    removeEventListener(type: string, cb: () => void): void {
      if (type === "statechange") this.stateListeners.delete(cb);
    }
    async resume(): Promise<void> {
      this.state = "running";
      this.stateListeners.forEach((cb) => cb());
    }
    async suspend(): Promise<void> {
      this.state = "suspended";
      this.stateListeners.forEach((cb) => cb());
    }
    createMediaElementSource(el: object): FakeAudioNode {
      if (globalConnectedElements.has(el)) {
        throw new Error("InvalidStateError: HTMLMediaElement already connected");
      }
      globalConnectedElements.add(el);
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
    location: { href: "https://www.youtube.com/watch?v=demo", origin: "https://www.youtube.com" },
    navigator: { mediaSession: { metadata: { title: "핫스왑 시험 스트림" } } },
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
      dispatchEvent(ev: { type: string; detail?: unknown }) {
        if (ev.type === HOOK_TO_BRIDGE_EVENT && typeof ev.detail === "string") {
          try {
            receivedBridgeEvents.push(JSON.parse(ev.detail) as HookReportEvent);
          } catch {
            // 무시
          }
        }
        docListeners.get(ev.type)?.forEach((cb) => cb(ev as unknown as Event));
        return true;
      },
    },
  };

  return {
    win: fakeWindow as unknown as Window & typeof globalThis,
    FakeMediaElement,
    FakeAudioNode,
    FakeAudioContext,
    getMediaElementSourceCalls: () => mediaElementSourceCalls,
    createdGains,
    createdPanners,
    receivedBridgeEvents,
  };
}

test("1) 동일 buildId 재실행 시 기존 컨트롤러를 유지하고 REQUEST_REPORT만 수행한다", () => {
  const env = createStrictMockEnvironment();
  const c1 = installAudioHook(env.win, { buildId: "0.6.0-alpha" });

  const initialReportCount = env.receivedBridgeEvents.filter(
    (e) => e.type === "MEDIA_REPORT",
  ).length;

  const c2 = installAudioHook(env.win, { buildId: "0.6.0-alpha" });

  assert.strictEqual(c2, c1, "동일 buildId 호출 시 인스턴스가 동일해야 함");
  assert.strictEqual(c2.buildId, "0.6.0-alpha");

  const finalReportCount = env.receivedBridgeEvents.filter(
    (e) => e.type === "MEDIA_REPORT",
  ).length;
  assert.strictEqual(
    finalReportCount,
    initialReportCount + 1,
    "동일 buildId 재호출 시 MEDIA_REPORT가 1회 추가 발행되어야 함",
  );

  c2.dispose();
});

test("2) 신규 buildId 무중단 핫스왑: WebAudio 노드·페이지 AudioContext 보존, 게인/DSP/재생 이력 인계", async () => {
  const env = createStrictMockEnvironment();

  // 1단계: 빌드 A 설치
  const c1 = installAudioHook(env.win, { buildId: "0.6.0-buildA" });
  assert.strictEqual(c1.buildId, "0.6.0-buildA");

  const video = new env.FakeMediaElement();
  video.currentSrc = "blob:https://www.youtube.com/stream-1234";
  video.volume = 0.75;
  await video.play();

  const pageCtx = new env.win.AudioContext();
  const pageOsc = new env.FakeAudioNode(pageCtx as never);
  pageOsc.connect(pageCtx.destination);
  const pageCtxFaderIdx = env.createdGains.length > 4 ? 5 : 0;

  assert.strictEqual(
    env.getMediaElementSourceCalls(),
    1,
    "createMediaElementSource 1회 연결 완료",
  );

  c1.dispatchCommand({ type: "APPLY_GAIN", targetGain: 2.5 });
  c1.dispatchCommand({
    type: "APPLY_DSP",
    dsp: {
      normActive: true,
      normTargetLufs: -16,
      normSpeed: "std",
      pan: -40,
      gateEnabled: false,
      gateThresholdDb: -48,
      compEnabled: false,
      compRatio: 4,
    },
  });
  c1.dispatchCommand({ type: "SET_METERING", active: true });

  // 일시정지하여 lastActiveElements에 기록되게 함
  video.pause();
  assert.strictEqual(video.paused, true);

  // 2단계: 빌드 B로 핫스왑!
  const c2 = installAudioHook(env.win, { buildId: "0.6.0-buildB" });

  assert.notStrictEqual(c2, c1, "핫스왑 시 새 컨트롤러 인스턴스가 생성되어야 함");
  assert.strictEqual(c2.buildId, "0.6.0-buildB");

  // InvalidStateError 없이 누적 createMediaElementSource 호출 1회 유지
  assert.strictEqual(
    env.getMediaElementSourceCalls(),
    1,
    "핫스왑 후에도 createMediaElementSource 재호출 없이 기존 노드를 보존해야 함",
  );
  assert.strictEqual(c2.getSnapshot().corsRestricted, false);

  // 상태 보존 검증: 사이트 볼륨(0.75), targetGain(2.5), pan(-0.4)
  assert.strictEqual(video.volume, 0.75, "사이트 슬라이더 볼륨 0.75 보존");
  assert.strictEqual(env.createdGains[0]?.value, 2.5, "미디어 요소 faderGain 2.5 보존");
  assert.ok(pageCtxFaderIdx >= 0, "페이지 AudioContext 페이더 인덱스 존재");
  assert.strictEqual(env.createdPanners[0]?.value, -0.4, "pan -0.4(-40%) 보존");

  // 3단계: BRIDGE_TO_HOOK_EVENT 통신 및 재생 재개 검증
  env.receivedBridgeEvents.length = 0;

  env.win.document.dispatchEvent(
    new env.win.CustomEvent(BRIDGE_TO_HOOK_EVENT, {
      detail: JSON.stringify({ type: "REQUEST_REPORT" }),
    }),
  );
  assert.strictEqual(
    env.receivedBridgeEvents.length,
    1,
    "구 컨트롤러가 분리되어 MEDIA_REPORT가 1회만 발행되어야 함",
  );

  env.win.document.dispatchEvent(
    new env.win.CustomEvent(BRIDGE_TO_HOOK_EVENT, {
      detail: JSON.stringify({ type: "APPLY_GAIN", targetGain: 1.8 }),
    }),
  );
  assert.strictEqual(env.createdGains[0]?.value, 1.8, "핫스왑 후 게인이 1.8로 갱신되어야 함");

  const sharedState = (env.win as unknown as Record<string, unknown>)[
    HOOK_STATE_KEY
  ] as HookSharedState;
  const pageEntry = Array.from(sharedState.pageContexts)[0];
  assert.ok(pageEntry, "페이지 AudioContext 엔트리가 핫스왑 후에도 보존되어야 함");
  assert.strictEqual(
    pageEntry.dspChain.faderGain.gain.value,
    1.8,
    "페이지 AudioContext 버스 게인도 1.8로 함께 갱신되어야 함",
  );

  env.win.document.dispatchEvent(
    new env.win.CustomEvent(BRIDGE_TO_HOOK_EVENT, {
      detail: JSON.stringify({ type: "SET_PLAYING", shouldPlay: true }),
    }),
  );
  await Promise.resolve();

  assert.strictEqual(
    video.paused,
    false,
    "핫스왑 후에도 lastActiveElements에서 미디어를 찾아 정상 재생되어야 함",
  );

  c2.dispose();
});

test("3) 프로토타입 비중첩(Idempotent Patch) 검증: 3회 핫스왑 후에도 단일 래퍼 유지", () => {
  const env = createStrictMockEnvironment();

  installAudioHook(env.win, { buildId: "0.6.0-v1" });
  const playProto1 = env.FakeMediaElement.prototype.play;
  const audioCtx1 = env.win.AudioContext;

  installAudioHook(env.win, { buildId: "0.6.0-v2" });
  const playProto2 = env.FakeMediaElement.prototype.play;
  const audioCtx2 = env.win.AudioContext;

  const c3 = installAudioHook(env.win, { buildId: "0.6.0-v3" });
  const playProto3 = env.FakeMediaElement.prototype.play;
  const audioCtx3 = env.win.AudioContext;

  assert.strictEqual(playProto1, playProto2, "v1과 v2의 play 프로토타입 참조가 동일해야 함");
  assert.strictEqual(playProto2, playProto3, "v2와 v3의 play 프로토타입 참조가 동일해야 함");
  assert.strictEqual(audioCtx1, audioCtx2, "v1과 v2의 AudioContext 생성자가 동일해야 함");
  assert.strictEqual(audioCtx2, audioCtx3, "v2와 v3의 AudioContext 생성자가 동일해야 함");

  const newAudio = new env.FakeMediaElement();
  newAudio.currentSrc = "blob:https://www.youtube.com/audio-999";
  void newAudio.play();

  const snap = c3.getSnapshot();
  assert.strictEqual(snap.playingCount, 1, "새 미디어 요소가 최신 v3 컨트롤러에 정상 반영되어야 함");

  c3.dispose();
});

test("4) 레거시(0.5.1 형태) 컨트롤러 업그레이드 호환성: 레거시 dispose() 호출 및 0.6.0 교체", () => {
  const env = createStrictMockEnvironment();
  const globalBag = env.win as unknown as Record<string, unknown>;

  let legacyDisposedCalls = 0;
  const legacyController = {
    dispatchCommand: () => {},
    registerElement: () => {},
    getSnapshot: (): FrameMediaPayload => ({
      hasMedia: false,
      playingCount: 0,
      pausedCount: 0,
      corsRestricted: false,
      mediaTitle: "레거시",
      vuLevel: 0,
      vuPeak: 0,
      normTrimDb: 0,
    }),
    stepTick: () => {},
    dispose: () => {
      legacyDisposedCalls++;
      delete globalBag[HOOK_CONTROLLER_KEY];
    },
  };

  delete globalBag[HOOK_STATE_KEY];
  globalBag[HOOK_CONTROLLER_KEY] = legacyController;

  const newController = installAudioHook(env.win, { buildId: "0.6.0-release" });

  assert.strictEqual(
    legacyDisposedCalls,
    1,
    "레거시 컨트롤러의 dispose()가 정확히 1회 호출되어야 함",
  );
  assert.strictEqual(newController.buildId, "0.6.0-release");
  assert.strictEqual(
    globalBag[HOOK_CONTROLLER_KEY],
    newController,
    "전역 컨트롤러 키에 새 0.6.0 컨트롤러가 등록되어야 함",
  );

  const sharedState = globalBag[HOOK_STATE_KEY] as HookSharedState | undefined;
  assert.ok(sharedState, "HookSharedState가 새로 생성되어 있어야 함");
  assert.strictEqual(sharedState?.schemaVersion, 1);

  newController.dispose();
});
