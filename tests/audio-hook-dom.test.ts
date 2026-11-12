import assert from "node:assert/strict";
import test from "node:test";
import { installAudioHook } from "../src/content/audio-hook";

/**
 * 모의 브라우저 환경에서 audio-hook의 CORS/DRM 무음 방지 폴백과 WebAudio 증폭(+12dB) 동작을 검증한다.
 */

function createMockAudioEnvironment() {
  let mediaElementSourceCalls = 0;
  const createdGains: Array<{ value: number }> = [];

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
      buf.fill(0.25);
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
